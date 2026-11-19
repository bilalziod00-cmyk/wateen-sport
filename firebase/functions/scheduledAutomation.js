'use strict';

/**
 * مجدول الأتمتة الخلفي، التخزين المؤقت (Caching)، إعادة المحاولة، وحارس الميزانية لـ WATEEN AI
 * يعمل في Cloud Functions Node 20 وبصيغة Pure JS قابلة للاختبار المباشر دون مكتبات خارجية.
 */

const {
  checkAiBudgetAllowed,
  rewriteAndVerifySportsNews,
  stableHash,
} = require('./wateenAiCore');
const { fetchNewsFromSource } = require('./newsCollector');

/**
 * استخراج اليوم والشهر بتوقيت عمّان (UTC+3) لضبط عداد الحدود اليومية والميزانية الشهرية بدقة.
 */
function getAmmanDateParts(nowInput = new Date()) {
  const dateObj = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const ammanMs = dateObj.getTime() + 3 * 60 * 60 * 1000;
  const isoAmman = new Date(ammanMs).toISOString();
  return {
    dayKey: isoAmman.slice(0, 10),
    monthKey: isoAmman.slice(0, 7),
    isoNow: dateObj.toISOString(),
  };
}

/**
 * تصفير العداد اليومي عند دخول يوم جديد، والعداد الشهري عند بداية شهر جديد.
 */
function rolloverBudgetCountersIfNeeded(settings = {}, nowInput = new Date()) {
  const { dayKey, monthKey } = getAmmanDateParts(nowInput);
  const nextSettings = { ...settings };
  let didResetDaily = false;
  let didResetMonthly = false;

  if (nextSettings.lastBudgetResetDate !== dayKey) {
    nextSettings.dailyRequestsUsed = 0;
    nextSettings.lastBudgetResetDate = dayKey;
    didResetDaily = true;
  }

  if (nextSettings.lastMonthlyResetMonth !== monthKey) {
    nextSettings.monthlySpentEstimateUsd = 0;
    nextSettings.lastMonthlyResetMonth = monthKey;
    didResetMonthly = true;
  }

  return {
    settings: nextSettings,
    didResetDaily,
    didResetMonthly,
    dayKey,
    monthKey,
  };
}

/**
 * حساب بصمة حتمية لمحتوى عناصر المصدر لتجنب إعادة تشغيل الذكاء الاصطناعي على أخبار لم تتغير.
 */
function computeSourceItemsHash(items = []) {
  const fingerprint = (items || [])
    .slice(0, 12)
    .map((item) =>
      `${String(item.title || '').trim()}|${String(item.link || '').trim()}|${String(item.publishedAt || '').trim()}`
    )
    .join('||');
  return stableHash(fingerprint || 'empty_feed');
}

/**
 * فحص صلاحية الكاش بناءً على مدة الصلاحية TTL وبصمة المحتوى الاختيارية.
 */
function isSourceCacheFresh({ sourceId, contentHash, cacheMap = {}, ttlMinutes = 20, nowMs = Date.now() }) {
  const entry = cacheMap && sourceId ? cacheMap[sourceId] : null;
  if (!entry || !entry.cachedAt) return false;
  const cachedAtMs = new Date(entry.cachedAt).getTime();
  if (Number.isNaN(cachedAtMs)) return false;

  const ttlMs = Math.max(1, Number(ttlMinutes || 20)) * 60 * 1000;
  const withinTtl = nowMs - cachedAtMs >= 0 && nowMs - cachedAtMs < ttlMs;
  if (!withinTtl) return false;

  if (contentHash !== undefined) {
    return entry.contentHash === contentHash;
  }
  return true;
}

const defaultSleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

/**
 * تنفيذ عملية شبكة مع إعادة محاولة تلقائية في حالات الفشل المؤقت.
 */
async function runWithRetry(operationFn, { maxRetries = 2, baseDelayMs = 150, sleepFn = defaultSleep } = {}) {
  const allowedAttempts = Math.max(1, Number(maxRetries || 0) + 1);
  const errors = [];

  for (let attempt = 1; attempt <= allowedAttempts; attempt += 1) {
    try {
      const result = await operationFn(attempt);
      if (result && result.ok === false) {
        const errMsg = result.error || 'فشل الاستجابة من المصدر';
        errors.push(errMsg);
      } else {
        return {
          ok: true,
          result,
          attempts: attempt,
          errors,
          finalError: null,
        };
      }
    } catch (err) {
      errors.push(err?.message || 'خطأ شبكة غير متوقع');
    }

    if (attempt < allowedAttempts && baseDelayMs > 0) {
      await sleepFn(baseDelayMs * attempt);
    }
  }

  return {
    ok: false,
    result: null,
    attempts: allowedAttempts,
    errors,
    finalError: errors[errors.length - 1] || 'تعذر الوصول للمصدر بعد إعادة المحاولة',
  };
}

/**
 * تشغيل دورة أتمتة مجدولة كاملة:
 * - تصفير عدادات اليوم/الشهر عند اللزوم
 * - فحص إيقاف الأتمتة أو تجاوز السقف المالي/اليومي
 * - فحص كاش TTL وبصمة المحتوى لتقليل التكلفة ومنع الطلبات المكررة
 * - إعادة محاولة المصادر المتعثرة وتوليد تنبيهات واضحة للمالك عند الفشل
 */
async function executeScheduledWateenCycle({
  sources = [],
  existingArticles = [],
  settings = {},
  cacheMap,
  fetchImpl = globalThis.fetch,
  maxItemsPerSource = 8,
  forceBypassCache = false,
  now = new Date(),
  sleepFn = defaultSleep,
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  const { isoNow } = getAmmanDateParts(nowDate);

  const rollover = rolloverBudgetCountersIfNeeded(settings, nowDate);
  const workingSettings = {
    automationEnabled: true,
    cacheTtlMinutes: 20,
    maxRetryAttempts: 2,
    totalCacheHits: 0,
    ...rollover.settings,
  };

  const nextCacheMap = {
    ...(cacheMap || workingSettings.sourceCacheHashes || {}),
  };

  const alerts = [];
  const published = [];
  const queued = [];
  const rejected = [];
  const sourceUpdates = [];
  const seenPool = [...existingArticles];

  let cacheHits = 0;
  let aiRequestsUsed = 0;
  let estimatedCostUsd = 0;
  let totalFetchAttempts = 0;

  if (workingSettings.automationEnabled === false) {
    return {
      ok: true,
      skippedByConfig: true,
      pausedByBudget: false,
      pausedReason: 'الأتمتة المجدولة متوقفة حالياً من إعدادات لوحة التحكم.',
      didResetDaily: rollover.didResetDaily,
      didResetMonthly: rollover.didResetMonthly,
      published,
      queued,
      rejected,
      sourceUpdates,
      alerts,
      updatedSettings: workingSettings,
      updatedCacheMap: nextCacheMap,
      stats: { totalFetchAttempts, cacheHits, aiRequestsUsed, estimatedCostUsd },
    };
  }

  const initialBudget = checkAiBudgetAllowed(workingSettings);
  if (!initialBudget.allowed) {
    alerts.push({
      id: `alert_budget_${stableHash(`${isoNow}_${initialBudget.reason}`)}`,
      severity: 'warning',
      title: 'تم إيقاف الأتمتة تلقائياً — بلوغ سقف الميزانية أو الحد اليومي',
      message: initialBudget.reason,
      createdAt: isoNow,
      resolved: false,
    });
    workingSettings.lastAutomationError = initialBudget.reason;
    workingSettings.lastFailureAlertAt = isoNow;

    return {
      ok: false,
      skippedByConfig: false,
      pausedByBudget: true,
      pausedReason: initialBudget.reason,
      didResetDaily: rollover.didResetDaily,
      didResetMonthly: rollover.didResetMonthly,
      published,
      queued,
      rejected,
      sourceUpdates,
      alerts,
      updatedSettings: workingSettings,
      updatedCacheMap: nextCacheMap,
      stats: { totalFetchAttempts, cacheHits, aiRequestsUsed, estimatedCostUsd },
    };
  }

  let pausedByBudget = false;
  let pausedReason = null;

  for (const source of sources) {
    if (!source || !source.enabled) continue;

    const effectiveTtl = Number(source.pollIntervalMinutes || workingSettings.cacheTtlMinutes || 20);
    if (!forceBypassCache && isSourceCacheFresh({ sourceId: source.id, cacheMap: nextCacheMap, ttlMinutes: effectiveTtl, nowMs })) {
      cacheHits += 1;
      sourceUpdates.push({
        id: source.id,
        lastFetchedAt: source.lastFetchedAt || isoNow,
        lastStatus: source.lastStatus === 'error' ? 'error' : 'ok',
        lastError: undefined,
        cacheHit: true,
      });
      continue;
    }

    const retryOut = await runWithRetry(
      () => fetchNewsFromSource(source, fetchImpl),
      {
        maxRetries: Number(workingSettings.maxRetryAttempts ?? 2),
        baseDelayMs: 120,
        sleepFn,
      }
    );
    totalFetchAttempts += retryOut.attempts;

    if (!retryOut.ok) {
      const errorDetails = `المصدر (${source.name}): ${retryOut.finalError} بعد ${retryOut.attempts} محاولات.`;
      alerts.push({
        id: `alert_src_${stableHash(`${source.id}_${isoNow}_${retryOut.finalError}`)}`,
        severity: 'error',
        sourceId: source.id,
        title: `فشل جلب المصدر: ${source.name}`,
        message: errorDetails,
        createdAt: isoNow,
        resolved: false,
      });
      sourceUpdates.push({
        id: source.id,
        lastFetchedAt: isoNow,
        lastStatus: 'error',
        lastError: retryOut.finalError,
      });
      workingSettings.lastAutomationError = errorDetails;
      workingSettings.lastFailureAlertAt = isoNow;
      continue;
    }

    const fetched = retryOut.result;
    const contentHash = computeSourceItemsHash(fetched.items);
    const prevCacheEntry = nextCacheMap[source.id];

    if (!forceBypassCache && prevCacheEntry && prevCacheEntry.contentHash === contentHash) {
      cacheHits += 1;
      nextCacheMap[source.id] = { contentHash, cachedAt: isoNow };
      sourceUpdates.push({
        id: source.id,
        lastFetchedAt: isoNow,
        lastStatus: 'ok',
        lastError: undefined,
        cacheHit: true,
        fetchedCount: fetched.items.length,
      });
      continue;
    }

    nextCacheMap[source.id] = { contentHash, cachedAt: isoNow };
    sourceUpdates.push({
      id: source.id,
      lastFetchedAt: isoNow,
      lastStatus: 'ok',
      lastError: undefined,
      fetchedCount: fetched.items.length,
    });

    const itemsSlice = (fetched.items || []).slice(0, maxItemsPerSource);
    for (const rawItem of itemsSlice) {
      const midBudget = checkAiBudgetAllowed(workingSettings);
      if (!midBudget.allowed) {
        pausedByBudget = true;
        pausedReason = midBudget.reason;
        alerts.push({
          id: `alert_budget_mid_${stableHash(`${isoNow}_${midBudget.reason}`)}`,
          severity: 'warning',
          title: 'إيقاف منتصف الدورة — بلوغ حد الميزانية',
          message: midBudget.reason,
          createdAt: isoNow,
          resolved: false,
        });
        break;
      }

      const processed = await rewriteAndVerifySportsNews({
        rawItem,
        source,
        settings: workingSettings,
        existingArticles: seenPool,
        fetchImpl,
      });

      if (processed.aiMeta && processed.aiMeta.aiRewritten) {
        aiRequestsUsed += 1;
        const deltaCost = Number(processed.aiMeta.estimatedCostUsd || 0);
        estimatedCostUsd += deltaCost;
        workingSettings.dailyRequestsUsed = Number(workingSettings.dailyRequestsUsed || 0) + 1;
        workingSettings.monthlySpentEstimateUsd = Number(
          (Number(workingSettings.monthlySpentEstimateUsd || 0) + deltaCost).toFixed(5)
        );
      }

      if (processed.decision.publishStatus === 'auto_publish') {
        published.push(processed.article);
        seenPool.push(processed.article);
      } else if (processed.decision.publishStatus === 'review_queue') {
        queued.push(processed.article);
        seenPool.push(processed.article);
      } else {
        rejected.push(processed.article);
      }
    }

    if (pausedByBudget) break;
  }

  workingSettings.totalCacheHits = Number(workingSettings.totalCacheHits || 0) + cacheHits;
  workingSettings.sourceCacheHashes = nextCacheMap;
  workingSettings.lastAutomationRunAt = isoNow;
  if (alerts.length === 0) {
    workingSettings.lastAutomationError = undefined;
  }

  return {
    ok: alerts.filter((a) => a.severity === 'error').length === 0 && !pausedByBudget,
    skippedByConfig: false,
    pausedByBudget,
    pausedReason,
    didResetDaily: rollover.didResetDaily,
    didResetMonthly: rollover.didResetMonthly,
    published,
    queued,
    rejected,
    sourceUpdates,
    alerts,
    updatedSettings: workingSettings,
    updatedCacheMap: nextCacheMap,
    stats: {
      totalFetchAttempts,
      cacheHits,
      aiRequestsUsed,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(5)),
    },
  };
}

module.exports = {
  getAmmanDateParts,
  rolloverBudgetCountersIfNeeded,
  computeSourceItemsHash,
  isSourceCacheFresh,
  runWithRetry,
  executeScheduledWateenCycle,
};
