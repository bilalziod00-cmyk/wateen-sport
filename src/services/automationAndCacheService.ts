import {
  AutomationAlertItem,
  NewsArticle,
  NewsSourceConfig,
  WateenAutomationSettings,
} from '../types/sports';
import { stableHash } from '../utils/deterministicIds';
import {
  fetchLiveSourceItems,
  parseRssOrAtomXml,
  processRawNewsItemForWateen,
  RawFetchedNewsItem,
} from './newsIntelligenceService';
import { getDefaultAutomationSettings } from './schemaMigrationService';

export interface BudgetHealthReport {
  allowed: boolean;
  reason: string | null;
  dailyUsed: number;
  dailyLimit: number;
  remainingDailyRequests: number;
  dailyPercent: number;
  monthlySpentUsd: number;
  monthlyBudgetUsd: number;
  remainingMonthlyUsd: number;
  monthlyPercent: number;
}

export interface DataFreshnessStatus {
  mode: 'offline' | 'source_error' | 'stale' | 'fresh';
  showWarningBanner: boolean;
  titleAr: string;
  messageAr: string;
  lastUpdatedIso: string;
}

export interface ClientAutomationCycleResult {
  ok: boolean;
  pausedByBudget: boolean;
  pausedReason: string | null;
  skippedByConfig: boolean;
  published: NewsArticle[];
  queued: NewsArticle[];
  rejected: { article: NewsArticle; reasonsAr: string[] }[];
  sourceUpdates: Pick<NewsSourceConfig, 'id' | 'lastFetchedAt' | 'lastStatus' | 'lastError'>[];
  alerts: AutomationAlertItem[];
  updatedSettings: WateenAutomationSettings;
  cacheHits: number;
  didResetDaily: boolean;
}

function getAmmanDateKeys(nowInput: Date = new Date()): {
  dayKey: string;
  monthKey: string;
  isoNow: string;
} {
  const ammanMs = nowInput.getTime() + 3 * 60 * 60 * 1000;
  const isoAmman = new Date(ammanMs).toISOString();
  return {
    dayKey: isoAmman.slice(0, 10),
    monthKey: isoAmman.slice(0, 7),
    isoNow: nowInput.toISOString(),
  };
}

/**
 * تصفير عداد الطلبات اليومي أو الإنفاق الشهري تلقائياً عند دخول يوم/شهر جديد بتوقيت عمّان
 */
export function rolloverClientBudgetCounters(
  settings: Partial<WateenAutomationSettings> | undefined,
  nowInput: Date = new Date()
): { settings: WateenAutomationSettings; didResetDaily: boolean; didResetMonthly: boolean } {
  const merged: WateenAutomationSettings = {
    ...getDefaultAutomationSettings(),
    ...(settings || {}),
  };
  const { dayKey, monthKey } = getAmmanDateKeys(nowInput);
  let didResetDaily = false;
  let didResetMonthly = false;

  if (merged.lastBudgetResetDate !== dayKey) {
    merged.dailyRequestsUsed = 0;
    merged.lastBudgetResetDate = dayKey;
    didResetDaily = true;
  }

  if (merged.lastMonthlyResetMonth !== monthKey) {
    merged.monthlySpentEstimateUsd = 0;
    merged.lastMonthlyResetMonth = monthKey;
    didResetMonthly = true;
  }

  return { settings: merged, didResetDaily, didResetMonthly };
}

/**
 * تقييم حالة الميزانية والحد اليومي وإصدار سبب الإيقاف إذا تم تجاوزه
 */
export function evaluateBudgetHealth(
  settings: Partial<WateenAutomationSettings> | undefined
): BudgetHealthReport {
  const s = { ...getDefaultAutomationSettings(), ...(settings || {}) };
  const dailyLimit = Math.max(1, Number(s.dailyRequestsLimit || 120));
  const dailyUsed = Math.max(0, Number(s.dailyRequestsUsed || 0));
  const monthlyBudgetUsd = Math.max(0.5, Number(s.monthlyBudgetUsd || 10));
  const monthlySpentUsd = Math.max(0, Number(s.monthlySpentEstimateUsd || 0));
  const pauseOnExceeded = s.pauseOnBudgetExceeded !== false;

  let allowed = true;
  let reason: string | null = null;

  if (pauseOnExceeded && dailyUsed >= dailyLimit) {
    allowed = false;
    reason = `تم بلوغ الحد اليومي لطلبات الذكاء الاصطناعي (${dailyUsed}/${dailyLimit}) وتم الإيقاف التلقائي لحماية التكلفة.`;
  } else if (pauseOnExceeded && monthlySpentUsd >= monthlyBudgetUsd) {
    allowed = false;
    reason = `تم بلوغ السقف المالي الشهري ($${monthlySpentUsd.toFixed(2)} / $${monthlyBudgetUsd.toFixed(2)}) وتم إيقاف التشغيل التلقائي.`;
  }

  return {
    allowed,
    reason,
    dailyUsed,
    dailyLimit,
    remainingDailyRequests: Math.max(0, dailyLimit - dailyUsed),
    dailyPercent: Math.min(100, Math.round((dailyUsed / dailyLimit) * 100)),
    monthlySpentUsd,
    monthlyBudgetUsd,
    remainingMonthlyUsd: Number(Math.max(0, monthlyBudgetUsd - monthlySpentUsd).toFixed(4)),
    monthlyPercent: Math.min(100, Math.round((monthlySpentUsd / monthlyBudgetUsd) * 100)),
  };
}

/**
 * بصمة محتوى عناصر المصدر لمنع تكرار المعالجة على بيانات لم تتغير
 */
export function computeClientItemsHash(items: RawFetchedNewsItem[]): string {
  const packed = (items || [])
    .slice(0, 12)
    .map((it) => `${it.title.trim()}|${(it.link || '').trim()}|${(it.publishedAt || '').trim()}`)
    .join('||');
  return stableHash(packed || 'empty_feed');
}

/**
 * فحص صلاحية التخزين المؤقت TTL ومطابقة بصمة المحتوى
 */
export function checkClientSourceCacheFreshness(params: {
  sourceId: string;
  ttlMinutes?: number;
  cacheMap?: Record<string, { contentHash: string; cachedAt: string }>;
  contentHash?: string;
  nowMs?: number;
}): boolean {
  const { sourceId, ttlMinutes = 20, cacheMap = {}, contentHash, nowMs = Date.now() } = params;
  const entry = cacheMap[sourceId];
  if (!entry || !entry.cachedAt) return false;
  const cachedMs = new Date(entry.cachedAt).getTime();
  if (Number.isNaN(cachedMs)) return false;

  const ttlMs = Math.max(1, Number(ttlMinutes || 20)) * 60_000;
  if (nowMs - cachedMs < 0 || nowMs - cachedMs >= ttlMs) return false;
  if (contentHash !== undefined) {
    return entry.contentHash === contentHash;
  }
  return true;
}

const delayMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

/**
 * إعادة محاولة تلقائية للعمليات الشبكية في حال فشل الاستجابة المؤقت
 */
export async function retryAsyncWithBackoff<T extends { ok?: boolean; error?: string }>(
  operationFn: (attempt: number) => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<{ ok: boolean; result: T | null; attempts: number; finalError: string | null }> {
  const maxRetries = Math.max(0, Number(options.maxRetries ?? 2));
  const baseDelayMs = Math.max(0, Number(options.baseDelayMs ?? 150));
  const totalAllowed = maxRetries + 1;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= totalAllowed; attempt += 1) {
    try {
      const res = await operationFn(attempt);
      if (res && res.ok === false) {
        lastError = res.error || 'استجابة غير متاحة من المصدر';
      } else {
        return { ok: true, result: res, attempts: attempt, finalError: null };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'فشل الاتصال بالشبكة';
    }
    if (attempt < totalAllowed && baseDelayMs > 0) {
      await delayMs(baseDelayMs * attempt);
    }
  }

  return {
    ok: false,
    result: null,
    attempts: totalAllowed,
    finalError: lastError || 'تعذر الوصول للمصدر بعد إعادة المحاولة',
  };
}

/**
 * تقييم حداثة البيانات بدقة لمنع عرض البيانات المخزنة محلياً على أنها تحديث مباشر عند انقطاع الشبكة
 */
export function evaluateDataFreshnessStatus(params: {
  isOnline: boolean;
  lastUpdatedAt?: string;
  lastSyncSuccessAt?: string;
  failedSourcesCount?: number;
  totalEnabledSources?: number;
  nowMs?: number;
}): DataFreshnessStatus {
  const {
    isOnline,
    lastUpdatedAt,
    lastSyncSuccessAt,
    failedSourcesCount = 0,
    totalEnabledSources = 0,
    nowMs = Date.now(),
  } = params;

  const refIso = lastSyncSuccessAt || lastUpdatedAt || new Date(nowMs).toISOString();

  if (!isOnline) {
    return {
      mode: 'offline',
      showWarningBanner: true,
      titleAr: 'وضع عدم الاتصال بالإنترنت',
      messageAr:
        'أنت غير متصل بالإنترنت حالياً — يتم عرض البيانات المخزنة محلياً في جهازك فقط، وليست تحديثاً مباشراً أو فورياً من المصادر.',
      lastUpdatedIso: refIso,
    };
  }

  if (totalEnabledSources > 0 && failedSourcesCount > 0) {
    return {
      mode: 'source_error',
      showWarningBanner: true,
      titleAr: 'تنبيه تعذر الوصول إلى مصادر خارجية',
      messageAr: `تعذر التحديث المباشر من ${failedSourcesCount} مصدر من أصل ${totalEnabledSources} — يتم عرض آخر بيانات مؤكدة محفوظة بدون أي تخمين أو بيانات وهمية.`,
      lastUpdatedIso: refIso,
    };
  }

  const refMs = new Date(refIso).getTime();
  if (!Number.isNaN(refMs) && nowMs - refMs > 12 * 60 * 60 * 1000) {
    const hours = Math.floor((nowMs - refMs) / (60 * 60 * 1000));
    return {
      mode: 'stale',
      showWarningBanner: true,
      titleAr: 'البيانات محفوظة منذ فترة طويلة',
      messageAr: `آخر تحديث ناجح للبيانات تم قبل نحو ${hours} ساعة — يُنصح بإعادة المزامنة أو تشغيل جامع الأخبار للتحقق من أحدث التطورات.`,
      lastUpdatedIso: refIso,
    };
  }

  return {
    mode: 'fresh',
    showWarningBanner: false,
    titleAr: 'البيانات محدثة',
    messageAr: 'جميع المصادر المحلية والسحابية جاهزة ومحدثة.',
    lastUpdatedIso: refIso,
  };
}

/**
 * تشغيل دورة جمع ومعالجة مع احترام الميزانية والحد اليومي والكاش وإعادة المحاولة وتوليد تنبيهات الإدارة
 */
export async function runBudgetAwareCollectionCycle(params: {
  sources: NewsSourceConfig[];
  existingArticles: NewsArticle[];
  queuedArticles: NewsArticle[];
  settings?: WateenAutomationSettings;
  manualXmlBySourceId?: Record<string, string>;
  fetchImpl?: typeof fetch;
  forceBypassCache?: boolean;
  isOnline?: boolean;
  now?: Date;
}): Promise<ClientAutomationCycleResult> {
  const nowDate = params.now || new Date();
  const nowMs = nowDate.getTime();
  const isoNow = nowDate.toISOString();

  const rollover = rolloverClientBudgetCounters(params.settings, nowDate);
  const workingSettings: WateenAutomationSettings = {
    ...rollover.settings,
    sourceCacheHashes: { ...(rollover.settings.sourceCacheHashes || {}) },
  };

  const alerts: AutomationAlertItem[] = [];
  const published: NewsArticle[] = [];
  const queued: NewsArticle[] = [];
  const rejected: { article: NewsArticle; reasonsAr: string[] }[] = [];
  const sourceUpdates: Pick<NewsSourceConfig, 'id' | 'lastFetchedAt' | 'lastStatus' | 'lastError'>[] = [];
  let cacheHits = 0;

  if (params.isOnline === false) {
    const offlineMsg = 'تعذر تشغيل جامع المصادر لأن الجهاز غير متصل بالإنترنت — لم يتم تعديل البيانات المحفوظة.';
    alerts.push({
      id: `cli_alert_offline_${stableHash(isoNow)}`,
      severity: 'warning',
      title: 'إيقاف التشغيل التلقائي لعدم توفر الشبكة',
      message: offlineMsg,
      createdAt: isoNow,
      resolved: false,
    });
    workingSettings.lastAutomationError = offlineMsg;
    workingSettings.lastFailureAlertAt = isoNow;
    return {
      ok: false,
      pausedByBudget: false,
      pausedReason: null,
      skippedByConfig: false,
      published,
      queued,
      rejected,
      sourceUpdates,
      alerts,
      updatedSettings: workingSettings,
      cacheHits,
      didResetDaily: rollover.didResetDaily,
    };
  }

  if (workingSettings.automationEnabled === false) {
    return {
      ok: true,
      pausedByBudget: false,
      pausedReason: 'الأتمتة متوقفة حالياً من إعدادات لوحة التحكم.',
      skippedByConfig: true,
      published,
      queued,
      rejected,
      sourceUpdates,
      alerts,
      updatedSettings: workingSettings,
      cacheHits,
      didResetDaily: rollover.didResetDaily,
    };
  }

  const budgetCheck = evaluateBudgetHealth(workingSettings);
  if (!budgetCheck.allowed) {
    alerts.push({
      id: `cli_alert_budget_${stableHash(`${isoNow}_${budgetCheck.reason}`)}`,
      severity: 'warning',
      title: 'تجاوز حد الطلبات اليومية أو السقف المالي',
      message: budgetCheck.reason || 'تم إيقاف الدورة حفاظاً على الميزانية.',
      createdAt: isoNow,
      resolved: false,
    });
    workingSettings.lastAutomationError = budgetCheck.reason || undefined;
    workingSettings.lastFailureAlertAt = isoNow;
    return {
      ok: false,
      pausedByBudget: true,
      pausedReason: budgetCheck.reason,
      skippedByConfig: false,
      published,
      queued,
      rejected,
      sourceUpdates,
      alerts,
      updatedSettings: workingSettings,
      cacheHits,
      didResetDaily: rollover.didResetDaily,
    };
  }

  const cacheMap = { ...(workingSettings.sourceCacheHashes || {}) };
  const runningExisting = [...params.existingArticles];
  const runningQueued = [...params.queuedArticles];
  const fetchImpl = params.fetchImpl || globalThis.fetch;
  let pausedByBudget = false;
  let pausedReason: string | null = null;

  for (const source of params.sources) {
    if (!source.enabled) continue;

    const effectiveTtl = Number(source.pollIntervalMinutes || workingSettings.cacheTtlMinutes || 20);
    const hasManualXml = Boolean(params.manualXmlBySourceId && params.manualXmlBySourceId[source.id]);

    if (
      !params.forceBypassCache &&
      !hasManualXml &&
      checkClientSourceCacheFreshness({
        sourceId: source.id,
        ttlMinutes: effectiveTtl,
        cacheMap,
        nowMs,
      })
    ) {
      cacheHits += 1;
      sourceUpdates.push({
        id: source.id,
        lastFetchedAt: source.lastFetchedAt || isoNow,
        lastStatus: source.lastStatus === 'error' ? 'error' : 'ok',
        lastError: undefined,
      });
      continue;
    }

    let rawItems: RawFetchedNewsItem[] = [];
    if (hasManualXml && params.manualXmlBySourceId) {
      rawItems = parseRssOrAtomXml(params.manualXmlBySourceId[source.id], source);
    } else {
      const retryRes = await retryAsyncWithBackoff(
        () => fetchLiveSourceItems(source, fetchImpl),
        { maxRetries: workingSettings.maxRetryAttempts ?? 2, baseDelayMs: 100 }
      );
      if (!retryRes.ok || !retryRes.result) {
        const errTxt = retryRes.finalError || 'فشل الاتصال بالمصدر';
        sourceUpdates.push({
          id: source.id,
          lastFetchedAt: isoNow,
          lastStatus: 'error',
          lastError: errTxt,
        });
        alerts.push({
          id: `cli_alert_src_${stableHash(`${source.id}_${isoNow}_${errTxt}`)}`,
          severity: 'error',
          sourceId: source.id,
          title: `تعذر تحديث مصدر: ${source.name}`,
          message: `${errTxt} (بعد ${retryRes.attempts} محاولات)`,
          createdAt: isoNow,
          resolved: false,
        });
        continue;
      }
      rawItems = retryRes.result.items;
    }

    const contentHash = computeClientItemsHash(rawItems);
    const prevHashEntry = cacheMap[source.id];
    if (!params.forceBypassCache && prevHashEntry && prevHashEntry.contentHash === contentHash) {
      cacheHits += 1;
      cacheMap[source.id] = { contentHash, cachedAt: isoNow };
      sourceUpdates.push({
        id: source.id,
        lastFetchedAt: isoNow,
        lastStatus: 'ok',
        lastError: undefined,
      });
      continue;
    }

    cacheMap[source.id] = { contentHash, cachedAt: isoNow };
    sourceUpdates.push({
      id: source.id,
      lastFetchedAt: isoNow,
      lastStatus: 'ok',
      lastError: undefined,
    });

    for (const rawItem of rawItems.slice(0, 10)) {
      const midBudget = evaluateBudgetHealth(workingSettings);
      if (!midBudget.allowed) {
        pausedByBudget = true;
        pausedReason = midBudget.reason;
        alerts.push({
          id: `cli_alert_budget_mid_${stableHash(`${isoNow}_${midBudget.reason}`)}`,
          severity: 'warning',
          title: 'إيقاف منتصف التشغيل — بلوغ الميزانية',
          message: midBudget.reason || 'تم بلوغ السقف المحدد.',
          createdAt: isoNow,
          resolved: false,
        });
        break;
      }

      workingSettings.dailyRequestsUsed += 1;
      workingSettings.monthlySpentEstimateUsd = Number(
        (workingSettings.monthlySpentEstimateUsd + 0.00025).toFixed(5)
      );

      const processed = processRawNewsItemForWateen({
        rawItem,
        source,
        settings: workingSettings,
        existingArticles: runningExisting,
        queuedArticles: runningQueued,
      });

      if (processed.decision.publishStatus === 'auto_publish') {
        published.push(processed.article);
        runningExisting.push(processed.article);
      } else if (processed.decision.publishStatus === 'review_queue') {
        queued.push(processed.article);
        runningQueued.push(processed.article);
      } else {
        rejected.push({ article: processed.article, reasonsAr: processed.decision.reasonsAr });
      }
    }

    if (pausedByBudget) break;
  }

  workingSettings.totalCacheHits = Number(workingSettings.totalCacheHits || 0) + cacheHits;
  workingSettings.sourceCacheHashes = cacheMap;
  workingSettings.lastAutomationRunAt = isoNow;
  if (alerts.length === 0) {
    workingSettings.lastAutomationError = undefined;
  } else {
    workingSettings.lastAutomationError = alerts[0].message;
    workingSettings.lastFailureAlertAt = isoNow;
  }

  return {
    ok: alerts.filter((a) => a.severity === 'error').length === 0 && !pausedByBudget,
    pausedByBudget,
    pausedReason,
    skippedByConfig: false,
    published,
    queued,
    rejected,
    sourceUpdates,
    alerts,
    updatedSettings: workingSettings,
    cacheHits,
    didResetDaily: rollover.didResetDaily,
  };
}
