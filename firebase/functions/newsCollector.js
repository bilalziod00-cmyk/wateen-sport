'use strict';

const { rewriteAndVerifySportsNews } = require('./wateenAiCore');

function decodeHtmlEntities(str) {
  return String(str || '')
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

function stripHtmlTags(html) {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagContent(block, tagNames) {
  for (const tag of tagNames) {
    const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = block.match(regex);
    if (m && m[1]) {
      return m[1].trim();
    }
  }
  return '';
}

function extractImageFromBlock(block) {
  const mediaMatch =
    block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["']/i) ||
    block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  if (mediaMatch && mediaMatch[1] && /^https?:\/\//i.test(mediaMatch[1])) {
    return mediaMatch[1].trim();
  }
  return '';
}

/**
 * تحليل خلاصات RSS 2.0 و Atom الرسمية بترميز UTF-8 سليم دون أي مكتبات خارجية ثقيلة
 */
function parseRssOrAtomFeedXml(xmlText, source) {
  const cleaned = String(xmlText || '').replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  const itemBlocks = cleaned.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const entryBlocks = itemBlocks.length > 0 ? [] : cleaned.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  const items = [];
  for (const block of blocks) {
    const rawTitle = extractTagContent(block, ['title']);
    const title = stripHtmlTags(rawTitle);

    let link = stripHtmlTags(extractTagContent(block, ['link', 'guid']));
    if (!link) {
      const atomLinkMatch = block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i);
      if (atomLinkMatch) link = decodeHtmlEntities(atomLinkMatch[1]).trim();
    }

    const rawDesc = extractTagContent(block, [
      'content:encoded',
      'content',
      'description',
      'summary',
    ]);
    const description = stripHtmlTags(rawDesc);

    const rawDate = stripHtmlTags(
      extractTagContent(block, ['pubDate', 'published', 'updated', 'dc:date'])
    );
    const parsedDate = rawDate && !Number.isNaN(new Date(rawDate).getTime())
      ? new Date(rawDate).toISOString()
      : new Date().toISOString();

    const imageUrl = extractImageFromBlock(block) || extractImageFromBlock(decodeHtmlEntities(rawDesc));

    if (title && title.length >= 6) {
      items.push({
        title,
        description,
        content: description,
        link,
        publishedAt: parsedDate,
        imageUrl,
        sourceName: source?.name || 'مصدر RSS رسمي',
      });
    }
  }

  return items;
}

/**
 * جلب الأخبار الحقيقية من مصدر RSS/API واحد مع معالجة صريحة للأخطاء دون اختلاق أي بيانات
 */
async function fetchNewsFromSource(source, fetchImpl = globalThis.fetch, timeoutMs = 12000) {
  if (!source || !source.url || !/^https?:\/\//i.test(source.url)) {
    return {
      ok: false,
      items: [],
      error: 'رابط المصدر غير صالح أو مفقود',
    };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetchImpl(source.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'WateenSportNewsBot/2.0 (+https://wateensport.app)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json',
      },
      signal: controller ? controller.signal : undefined,
    });

    if (!res.ok) {
      return {
        ok: false,
        items: [],
        error: `استجابة المصدر غير متاحة (HTTP ${res.status})`,
      };
    }

    const contentType = (res.headers?.get?.('content-type') || '').toLowerCase();
    const rawBody = await res.text();

    if (contentType.includes('application/json') || rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
      try {
        const json = JSON.parse(rawBody);
        const list = Array.isArray(json) ? json : Array.isArray(json.items) ? json.items : Array.isArray(json.articles) ? json.articles : [];
        const items = list
          .map((it) => ({
            title: String(it.title || '').trim(),
            description: String(it.description || it.summary || it.content || '').trim(),
            content: String(it.content || it.description || it.summary || '').trim(),
            link: String(it.url || it.link || '').trim(),
            publishedAt: it.publishedAt || it.pubDate || new Date().toISOString(),
            imageUrl: String(it.imageUrl || it.urlToImage || '').trim(),
            sourceName: source.name,
          }))
          .filter((it) => it.title.length >= 6);
        return { ok: true, items, error: null };
      } catch {
        return { ok: false, items: [], error: 'تعذر قراءة JSON من المصدر' };
      }
    }

    const items = parseRssOrAtomFeedXml(rawBody, source);
    return { ok: true, items, error: null };
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: err && err.name === 'AbortError'
        ? 'انتهت مهلة الاتصال بالمصدر (Timeout)'
        : `تعذر الاتصال بالمصدر: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * تشغيل دورة الذكاء الإخباري الكاملة على المصادر المفعّلة:
 * جلب حقيقي -> فحص التكرار والتضارب -> إعادة الصياغة التحريرية -> التوجيه الثلاثي (نشر / مراجعة / رفض)
 */
async function collectAndProcessNewsBatch({
  sources = [],
  existingArticles = [],
  settings = {},
  maxItemsPerSource = 8,
  fetchImpl = globalThis.fetch,
}) {
  const published = [];
  const queued = [];
  const rejected = [];
  const sourceUpdates = [];
  const seenPool = [...existingArticles];
  let requestsUsed = 0;
  let totalCostUsd = 0;

  const workingSettings = { ...settings };

  for (const source of sources) {
    if (!source || !source.enabled) continue;
    const nowIso = new Date().toISOString();
    const fetched = await fetchNewsFromSource(source, fetchImpl);

    if (!fetched.ok) {
      sourceUpdates.push({
        id: source.id,
        lastFetchedAt: nowIso,
        lastStatus: 'error',
        lastError: fetched.error,
      });
      continue;
    }

    sourceUpdates.push({
      id: source.id,
      lastFetchedAt: nowIso,
      lastStatus: 'ok',
      lastError: null,
      fetchedCount: fetched.items.length,
    });

    const slice = fetched.items.slice(0, maxItemsPerSource);
    for (const rawItem of slice) {
      const processed = await rewriteAndVerifySportsNews({
        rawItem,
        source,
        settings: workingSettings,
        existingArticles: seenPool,
        fetchImpl,
      });

      if (processed.aiMeta && processed.aiMeta.aiRewritten) {
        requestsUsed += 1;
        totalCostUsd += processed.aiMeta.estimatedCostUsd || 0;
        workingSettings.dailyRequestsUsed = (workingSettings.dailyRequestsUsed || 0) + 1;
        workingSettings.monthlySpentEstimateUsd =
          (workingSettings.monthlySpentEstimateUsd || 0) + (processed.aiMeta.estimatedCostUsd || 0);
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
  }

  return {
    published,
    queued,
    rejected,
    sourceUpdates,
    budgetUsageDelta: {
      requestsUsed,
      totalCostUsd: Number(totalCostUsd.toFixed(5)),
    },
  };
}

module.exports = {
  decodeHtmlEntities,
  stripHtmlTags,
  parseRssOrAtomFeedXml,
  fetchNewsFromSource,
  collectAndProcessNewsBatch,
};
