import {
  CompetitionId,
  NewsArticle,
  NewsCategoryTag,
  NewsEditorialType,
  NewsPublishStatus,
  NewsSourceConfig,
  NewsVerificationStatus,
  WateenAutomationSettings,
} from '../types/sports';
import { generateDeterministicNewsId } from '../utils/deterministicIds';
import { normalizeArabicTeamName } from '../utils/sportsMathEngine';

export interface RawFetchedNewsItem {
  title: string;
  content: string;
  link?: string;
  publishedAt?: string;
  imageUrl?: string;
  sourceName?: string;
}

export interface DuplicateContradictionReport {
  isDuplicate: boolean;
  duplicateOfId?: string;
  hasContradiction: boolean;
  contradictionReason?: string;
}

export interface ThreeStatePublishDecision {
  publishStatus: NewsPublishStatus;
  verificationStatus: NewsVerificationStatus;
  reasonsAr: string[];
}

export interface ProcessedNewsResult {
  article: NewsArticle;
  decision: ThreeStatePublishDecision;
  duplicateCheck: DuplicateContradictionReport;
}

export interface NewsCollectionCycleResult {
  published: NewsArticle[];
  queued: NewsArticle[];
  rejected: { article: NewsArticle; reasonsAr: string[] }[];
  sourceUpdates: Pick<NewsSourceConfig, 'id' | 'lastFetchedAt' | 'lastStatus' | 'lastError'>[];
}

export const EDITORIAL_TYPE_LABELS: Record<
  NewsEditorialType,
  { label: string; color: string; isConfirmed: boolean }
> = {
  confirmed_news: {
    label: 'خبر مؤكد',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    isConfirmed: true,
  },
  analysis: {
    label: 'تحليل فني',
    color: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    isConfirmed: false,
  },
  opinion: {
    label: 'رأي / مقال',
    color: 'bg-purple-500/15 text-purple-300 border-purple-500/35',
    isConfirmed: false,
  },
  prediction: {
    label: 'توقع / قراءة مسبقة',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    isConfirmed: false,
  },
  transfer_rumor: {
    label: 'إشاعة / أنباء غير مؤكدة',
    color: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    isConfirmed: false,
  },
};

function decodeHtmlEntities(str: string): string {
  return (str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtmlTags(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractXmlTag(block: string, tagNames: string[]): string {
  for (const tag of tagNames) {
    const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = block.match(regex);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function extractImageUrlFromXml(block: string): string {
  const m =
    block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["']/i) ||
    block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  if (m && m[1] && /^https?:\/\//i.test(m[1])) {
    return m[1].trim();
  }
  return '';
}

/**
 * تحليل خلاصة RSS 2.0 أو Atom رسمية إلى عناصر إخبارية خام
 */
export function parseRssOrAtomXml(
  xmlText: string,
  source?: Pick<NewsSourceConfig, 'name'>
): RawFetchedNewsItem[] {
  const cleaned = (xmlText || '').replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  const itemBlocks = cleaned.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const entryBlocks =
    itemBlocks.length > 0 ? [] : cleaned.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  const items: RawFetchedNewsItem[] = [];
  for (const block of blocks) {
    const title = stripHtmlTags(extractXmlTag(block, ['title']));
    let link = stripHtmlTags(extractXmlTag(block, ['link', 'guid']));
    if (!link) {
      const hrefMatch = block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i);
      if (hrefMatch) link = decodeHtmlEntities(hrefMatch[1]).trim();
    }

    const rawDesc = extractXmlTag(block, ['content:encoded', 'content', 'description', 'summary']);
    const content = stripHtmlTags(rawDesc);
    const rawDate = stripHtmlTags(
      extractXmlTag(block, ['pubDate', 'published', 'updated', 'dc:date'])
    );
    const publishedAt =
      rawDate && !Number.isNaN(new Date(rawDate).getTime())
        ? new Date(rawDate).toISOString()
        : new Date().toISOString();
    const imageUrl = extractImageUrlFromXml(block) || extractImageUrlFromXml(decodeHtmlEntities(rawDesc));

    if (title.length >= 6) {
      items.push({
        title,
        content: content || title,
        link,
        publishedAt,
        imageUrl,
        sourceName: source?.name || 'مصدر RSS رسمي',
      });
    }
  }
  return items;
}

function tokenizeNormalizedTitle(title: string): Set<string> {
  const stopWords = new Set([
    'في',
    'من',
    'على',
    'الى',
    'عن',
    'مع',
    'بعد',
    'قبل',
    'خلال',
    'ضمن',
    'ضد',
    'امام',
    'بين',
    'لكره',
    'القدم',
    'الاردني',
    'الاردنيه',
    'عاجل',
    'رسميا',
    'the',
    'and',
    'for',
    'with',
  ]);
  const norm = normalizeArabicTeamName(title)
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return new Set(norm.split(' ').filter((w) => w.length >= 2 && !stopWords.has(w)));
}

export function computeNewsTitleSimilarity(titleA: string, titleB: string): number {
  const a = tokenizeNormalizedTitle(titleA);
  const b = tokenizeNormalizedTitle(titleB);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) {
    if (b.has(w)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * تصنيف نوع المادة التحريرية بدقة (تمييز الخبر المؤكد عن الرأي والتوقع والتحليل والإشاعة)
 */
export function classifyEditorialType(
  title: string,
  content: string,
  _source?: Pick<NewsSourceConfig, 'trustedForAutoPublish'>
): NewsEditorialType {
  const full = `${title || ''} ${content || ''}`;
  if (
    /إشاع|شائع|تقارير غير مؤكدة|أنباء عن مفاوضات|مقترب من|يرتبط بالانتقال|rumor|rumour|linked with/i.test(
      full
    )
  ) {
    return 'transfer_rumor';
  }
  if (/توقع|توقعات|التشكيلة المتوقعة|السيناريو المتوقع|prediction|predicted/i.test(full)) {
    return 'prediction';
  }
  if (/رأي|مقال|وجهة نظر|عمود صحفي|opinion|editorial/i.test(full)) {
    return 'opinion';
  }
  if (/تحليل تكتيكي|قراءة فنية|أرقام وإحصائيات|تحليل رقمي|tactical analysis/i.test(full)) {
    return 'analysis';
  }
  return 'confirmed_news';
}

export function inferNewsCompetitionId(title: string, content: string): CompetitionId {
  const full = `${title} ${content}`;
  if (/الدرجة الثالثة|الثالثة/.test(full)) return 'third_div';
  if (/الدرجة الثانية|الثانية|الكرمل|عجلون/.test(full)) return 'second_div';
  if (/الدرجة الأولى|الأولى|العربي إربد|اليرموك|اتحاد الرمثا/.test(full)) return 'first_div';
  if (/كأس الأردن/.test(full)) return 'jordan_cup';
  if (/سيدات|السيدات/.test(full)) return 'womens_league';
  if (/النشامى|المنتخب الوطني|المنتخب الأردني/.test(full)) return 'national_teams';
  if (/تحت 20|الشباب|الأولمبي/.test(full)) return 'youth_u20';
  if (/تحت 17|الناشئين/.test(full)) return 'youth_u17';
  if (/تحت 15|الأشبال/.test(full)) return 'youth_u15';
  if (/البراعم|تحت 13|الفئات السنية/.test(full)) return 'youth_grassroots';
  return 'pro_league';
}

export function inferNewsCategoryTag(
  title: string,
  content: string,
  editorialType: NewsEditorialType,
  sourceTrusted = false
): NewsCategoryTag {
  const full = `${title} ${content}`;
  if (editorialType === 'transfer_rumor' || /انتقال|تعاقد|صفقة|يوقع|انضمام|إعارة|transfer|signing/i.test(full)) {
    return 'transfers';
  }
  if (/إصابة|إصابات|تمزق|غياب|فحص طبي|تأهيل|جاهزية|injury|injured/i.test(full)) {
    return 'injuries';
  }
  if (editorialType === 'analysis' || /تحليل|تكتيك|إحصائيات|أرقام/.test(full)) {
    return 'tactical_analysis';
  }
  if (/فاز|تغلب|تعادل|نتيجة|الجولة|انتهت|أهداف/.test(full)) {
    return 'match_report';
  }
  if (sourceTrusted || /رسمياً|الاتحاد الأردني|بيان رسمي|قرار|جدول/.test(full)) {
    return 'official';
  }
  return 'club_news';
}

/**
 * فحص التكرار وتضارب المعلومات مقابل الأخبار المنشورة وطابور المراجعة
 */
export function detectDuplicateOrContradiction(
  candidate: { originalTitle: string; sourceUrl?: string },
  existingArticles: NewsArticle[] = [],
  queuedArticles: NewsArticle[] = []
): DuplicateContradictionReport {
  const pool = [...existingArticles, ...queuedArticles];
  const candUrl = (candidate.sourceUrl || '').trim().toLowerCase().replace(/\/+$/, '');
  const candTitle = (candidate.originalTitle || '').trim();
  const candNorm = normalizeArabicTeamName(candTitle);
  const candScoreMatch = candNorm.match(/(\d+)\s+(\d+)/);
  const candIsDenial = /ينفي|نفي|لا صحه|غير صحيح|يكذب|شائعه/i.test(candNorm);

  for (const existing of pool) {
    const exUrl = (existing.sourceUrl || '').trim().toLowerCase().replace(/\/+$/, '');
    if (candUrl && exUrl && candUrl === exUrl) {
      return {
        isDuplicate: true,
        duplicateOfId: existing.id,
        hasContradiction: false,
      };
    }

    const exTitle = existing.originalTitle || existing.title;
    const sim = computeNewsTitleSimilarity(candTitle, exTitle);
    if (sim >= 0.72) {
      const exNorm = normalizeArabicTeamName(exTitle);
      const exScoreMatch = exNorm.match(/(\d+)\s+(\d+)/);
      const exIsDenial = /ينفي|نفي|لا صحه|غير صحيح|يكذب|شائعه/i.test(exNorm);

      if (
        candScoreMatch &&
        exScoreMatch &&
        (candScoreMatch[1] !== exScoreMatch[1] || candScoreMatch[2] !== exScoreMatch[2])
      ) {
        return {
          isDuplicate: false,
          hasContradiction: true,
          contradictionReason: `تضارب محتمل في النتيجة مع خبر سابق: "${existing.title}"`,
        };
      }

      if (candIsDenial !== exIsDenial) {
        return {
          isDuplicate: false,
          hasContradiction: true,
          contradictionReason: `تضارب بين التأكيد والنفي مع خبر سابق: "${existing.title}"`,
        };
      }

      return {
        isDuplicate: true,
        duplicateOfId: existing.id,
        hasContradiction: false,
      };
    }
  }

  return { isDuplicate: false, hasContradiction: false };
}

/**
 * تقييم سياسة النشر الذكي الثلاثية (نشر تلقائي / طابور المراجعة / مرفوض)
 */
export function evaluateThreeStatePublishDecision(
  article: NewsArticle,
  source: NewsSourceConfig | null | undefined,
  settings: WateenAutomationSettings,
  duplicateCheck: DuplicateContradictionReport
): ThreeStatePublishDecision {
  if (duplicateCheck.isDuplicate) {
    return {
      publishStatus: 'rejected',
      verificationStatus: 'rejected',
      reasonsAr: ['خبر مكرر موجود مسبقاً في قاعدة البيانات أو طابور المراجعة'],
    };
  }

  if (!article.originalTitle || article.originalTitle.trim().length < 8) {
    return {
      publishStatus: 'rejected',
      verificationStatus: 'rejected',
      reasonsAr: ['عنوان الخبر ناقص أو غير صالح'],
    };
  }

  if (duplicateCheck.hasContradiction) {
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr: [
        duplicateCheck.contradictionReason || 'يوجد تضارب في المعلومات يتطلب مراجعة المدير',
      ],
    };
  }

  if (article.editorialType && article.editorialType !== 'confirmed_news') {
    const label = EDITORIAL_TYPE_LABELS[article.editorialType]?.label || article.editorialType;
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr: [`المادة مصنفة كـ "${label}" — لا تُنشر تلقائياً بدون اعتماد المدير`],
    };
  }

  if (!source || !source.trustedForAutoPublish) {
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr: ['المصدر غير مفعّل للنشر التلقائي ويحتاج مراجعة المدير'],
    };
  }

  if (!settings.autoPublishEnabled) {
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr: ['النشر التلقائي متوقف في إعدادات الأتمتة (الوضع الآمن للمراجعة)'],
    };
  }

  if (
    settings.allowedAutoPublishTags &&
    settings.allowedAutoPublishTags.length > 0 &&
    !settings.allowedAutoPublishTags.includes(article.tag)
  ) {
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr: [`التصنيف (${article.tag}) غير مشمول ضمن فئات النشر التلقائي`],
    };
  }

  return {
    publishStatus: 'auto_publish',
    verificationStatus: 'verified',
    reasonsAr: ['مصدر رسمي موثوق + خبر مؤكد + بدون تكرار أو تضارب'],
  };
}

/**
 * صياغة تحريرية عربية محايدة ومنظمة دون اختلاق أي معلومة خارج النص الأصلي
 */
function buildCleanEditorialRewrite(rawItem: RawFetchedNewsItem, sourceName: string) {
  const cleanTitle = rawItem.title.replace(/^(عاجل\s*[:|–-]\s*)/, '').trim();
  const cleanContent = (rawItem.content || rawItem.title).trim();

  const summary =
    cleanContent.length > 190
      ? `${cleanContent.slice(0, 190).trim()}...`
      : cleanContent;

  const formattedBody = [
    cleanContent,
    '',
    `— المصدر الموثّق: ${sourceName}${rawItem.link ? ` (${rawItem.link})` : ''}`,
  ].join('\n');

  return {
    title: cleanTitle,
    summary,
    content: formattedBody,
  };
}

/**
 * معالجة عنصر إخباري خام وتحويله إلى خبر منظم جاهز للنشر أو طابور المراجعة أو الرفض
 */
export function processRawNewsItemForWateen(params: {
  rawItem: RawFetchedNewsItem;
  source?: NewsSourceConfig | null;
  settings: WateenAutomationSettings;
  existingArticles: NewsArticle[];
  queuedArticles: NewsArticle[];
}): ProcessedNewsResult {
  const { rawItem, source, settings, existingArticles, queuedArticles } = params;
  const sourceName = source?.name || rawItem.sourceName || 'مصدر رسمي';
  const sourceUrl = (rawItem.link || '').trim();
  const editorialType = classifyEditorialType(rawItem.title, rawItem.content, source || undefined);
  const competitionId = inferNewsCompetitionId(rawItem.title, rawItem.content);
  const tag = inferNewsCategoryTag(
    rawItem.title,
    rawItem.content,
    editorialType,
    Boolean(source?.trustedForAutoPublish)
  );

  const duplicateCheck = detectDuplicateOrContradiction(
    { originalTitle: rawItem.title, sourceUrl },
    existingArticles,
    queuedArticles
  );

  const rewritten = buildCleanEditorialRewrite(rawItem, sourceName);
  const id = generateDeterministicNewsId({
    sourceUrl,
    originalTitle: rawItem.title,
  });

  const draftArticle: NewsArticle = {
    id,
    title: rewritten.title,
    summary: rewritten.summary,
    content: rewritten.content,
    originalTitle: rawItem.title.trim(),
    originalContent: rawItem.content.trim(),
    sourceName,
    sourceUrl: sourceUrl || undefined,
    competitionId,
    tag,
    editorialType,
    verificationStatus: 'needs_review',
    publishStatus: 'review_queue',
    isBreaking: /^عاجل|رسمياً/.test(rawItem.title.trim()) && editorialType === 'confirmed_news',
    imageUrl: rawItem.imageUrl || './images/stadium-night.jpg',
    author: `وتين سبورت AI • ${sourceName}`,
    publishedAt: rawItem.publishedAt || new Date().toISOString(),
    views: 0,
    isDemo: false,
  };

  const decision = evaluateThreeStatePublishDecision(
    draftArticle,
    source,
    settings,
    duplicateCheck
  );

  const finalArticle: NewsArticle = {
    ...draftArticle,
    publishStatus: decision.publishStatus,
    verificationStatus: decision.verificationStatus,
  };

  return {
    article: finalArticle,
    decision,
    duplicateCheck,
  };
}

/**
 * جلب مباشر لخلاصة RSS/API من مصدر واحد مع معالجة واضحة للأخطاء (لا يختلق أي أخبار عند الفشل)
 */
export async function fetchLiveSourceItems(
  source: NewsSourceConfig,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<{ ok: boolean; items: RawFetchedNewsItem[]; error?: string }> {
  if (!source.url || !/^https?:\/\//i.test(source.url)) {
    return { ok: false, items: [], error: 'رابط المصدر غير صالح' };
  }

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
    const res = await fetchImpl(source.url, {
      method: 'GET',
      signal: controller ? controller.signal : undefined,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        ok: false,
        items: [],
        error: `تعذر الجلب من المصدر (HTTP ${res.status})`,
      };
    }

    const body = await res.text();
    if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
      const json = JSON.parse(body);
      const arr = Array.isArray(json)
        ? json
        : Array.isArray(json.items)
        ? json.items
        : Array.isArray(json.articles)
        ? json.articles
        : [];
      const items: RawFetchedNewsItem[] = arr
        .map((it: Record<string, unknown>) => ({
          title: String(it.title || '').trim(),
          content: String(it.content || it.description || it.summary || '').trim(),
          link: String(it.url || it.link || '').trim(),
          publishedAt: String(it.publishedAt || it.pubDate || new Date().toISOString()),
          imageUrl: String(it.imageUrl || it.urlToImage || '').trim(),
          sourceName: source.name,
        }))
        .filter((it: RawFetchedNewsItem) => it.title.length >= 6);
      return { ok: true, items };
    }

    const items = parseRssOrAtomXml(body, source);
    if (items.length === 0) {
      return {
        ok: false,
        items: [],
        error: 'تم الاتصال بالمصدر ولكن لم تُعثر على عناصر RSS/Atom صالحة',
      };
    }
    return { ok: true, items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      items: [],
      error: `تعذر الجلب المباشر من المتصفح/الشبكة (${msg}) — يُنصح بتشغيل الجلب عبر Firebase Cloud Functions`,
    };
  }
}

/**
 * تشغيل دورة جمع الأخبار ومعالجتها عبر سياسة النشر الثلاثية
 */
export async function runNewsIntelligenceBatch(params: {
  sources: NewsSourceConfig[];
  existingArticles: NewsArticle[];
  queuedArticles: NewsArticle[];
  settings: WateenAutomationSettings;
  manualXmlBySourceId?: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<NewsCollectionCycleResult> {
  const {
    sources,
    existingArticles,
    queuedArticles,
    settings,
    manualXmlBySourceId,
    fetchImpl = globalThis.fetch,
  } = params;

  const published: NewsArticle[] = [];
  const queued: NewsArticle[] = [];
  const rejected: { article: NewsArticle; reasonsAr: string[] }[] = [];
  const sourceUpdates: Pick<
    NewsSourceConfig,
    'id' | 'lastFetchedAt' | 'lastStatus' | 'lastError'
  >[] = [];

  const runningExisting = [...existingArticles];
  const runningQueued = [...queuedArticles];

  for (const source of sources) {
    if (!source.enabled) continue;
    const nowIso = new Date().toISOString();

    let rawItems: RawFetchedNewsItem[] = [];
    if (manualXmlBySourceId && manualXmlBySourceId[source.id]) {
      rawItems = parseRssOrAtomXml(manualXmlBySourceId[source.id], source);
      sourceUpdates.push({
        id: source.id,
        lastFetchedAt: nowIso,
        lastStatus: rawItems.length > 0 ? 'ok' : 'error',
        lastError: rawItems.length > 0 ? undefined : 'محتوى RSS لا يحتوي على عناصر صالحة',
      });
    } else {
      const fetched = await fetchLiveSourceItems(source, fetchImpl);
      if (!fetched.ok) {
        sourceUpdates.push({
          id: source.id,
          lastFetchedAt: nowIso,
          lastStatus: 'error',
          lastError: fetched.error,
        });
        continue;
      }
      rawItems = fetched.items;
      sourceUpdates.push({
        id: source.id,
        lastFetchedAt: nowIso,
        lastStatus: 'ok',
        lastError: undefined,
      });
    }

    for (const rawItem of rawItems.slice(0, 10)) {
      const processed = processRawNewsItemForWateen({
        rawItem,
        source,
        settings,
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
        rejected.push({
          article: processed.article,
          reasonsAr: processed.decision.reasonsAr,
        });
      }
    }
  }

  return {
    published,
    queued,
    rejected,
    sourceUpdates,
  };
}
