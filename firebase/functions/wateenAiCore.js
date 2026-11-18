'use strict';

/**
 * محرك WATEEN AI المركزي على الخادم (Firebase Cloud Functions - Node 20)
 * - يدعم التبديل الكامل بين مزوّدي الذكاء الاصطناعي: OpenAI API و Gemini API بدون كسر التطبيق
 * - جميع مفاتيح API تقرأ حصرياً من متغيرات البيئة الآمنة على الخادم (Secret Manager / Env) ولا تُضمَّن في APK أبداً
 * - يحترم السقف المالي الشهري والحد اليومي للطلبات ويمنع اختلاق أي أخبار أو نتائج غير موجودة في المصدر
 */

const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
};

const COST_ESTIMATE_PER_1K_TOKENS_USD = {
  openai: 0.00035,
  gemini: 0.0002,
};

function normalizeArabicForCompare(raw) {
  return String(raw || '')
    .trim()
    .replace(/^(نادي|فريق|عاجل|رسمياً|رسميا)\s+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stableHash(input) {
  const str = String(input || '').trim().toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function generateDeterministicNewsId(sourceUrl, originalTitle) {
  const canonicalUrl = String(sourceUrl || '').trim().toLowerCase().replace(/\/+$/, '');
  const key = canonicalUrl || normalizeArabicForCompare(originalTitle).replace(/\s+/g, '_');
  return `news_${stableHash(key)}`;
}

function tokenizeArabicTitle(title) {
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
    'نادي',
    'فريق',
    'the',
    'and',
    'for',
    'with',
    'vs',
  ]);
  return new Set(
    normalizeArabicForCompare(title)
      .split(' ')
      .filter((w) => w.length >= 2 && !stopWords.has(w))
  );
}

function computeTitleSimilarity(titleA, titleB) {
  const a = tokenizeArabicTitle(titleA);
  const b = tokenizeArabicTitle(titleB);
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const w of a) {
    if (b.has(w)) intersect += 1;
  }
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

/**
 * تصنيف نوع المادة الصحفية بدقة (تمييز الخبر المؤكد عن التحليل والرأي والتوقع والإشاعة)
 */
function classifyEditorialType(title, content, source) {
  const full = `${title || ''} ${content || ''}`;
  if (/إشاع|شائع|تقارير غير مؤكدة|أنباء عن مفاوضات|مقترب من|يرتبط بالانتقال|rumor|rumour|linked with/i.test(full)) {
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
  if (source && source.trustedForAutoPublish) {
    return 'confirmed_news';
  }
  return 'confirmed_news';
}

/**
 * اكتشاف الأخبار المكررة والأخبار المتضاربة (مثل تعارض النتيجة أو نفي خبر رسمي)
 */
function detectDuplicateOrContradiction(candidate, existingArticles = []) {
  const candUrl = String(candidate.sourceUrl || '').trim().toLowerCase().replace(/\/+$/, '');
  const candTitle = String(candidate.originalTitle || candidate.title || '').trim();
  const candNorm = normalizeArabicForCompare(candTitle);
  const candScoreMatch = candNorm.match(/(\d+)\s+(\d+)/);
  const candIsDenial = /ينفي|نفي|لا صحه|غير صحيح|يكذب|شائعه/i.test(candNorm);

  let isDuplicate = false;
  let duplicateOfId = null;
  let hasContradiction = false;
  let contradictionReason = null;

  for (const existing of existingArticles) {
    if (!existing) continue;
    const exUrl = String(existing.sourceUrl || '').trim().toLowerCase().replace(/\/+$/, '');
    if (candUrl && exUrl && candUrl === exUrl) {
      isDuplicate = true;
      duplicateOfId = existing.id;
      break;
    }

    const exTitle = String(existing.originalTitle || existing.title || '');
    const sim = computeTitleSimilarity(candTitle, exTitle);

    if (sim >= 0.72) {
      const exNorm = normalizeArabicForCompare(exTitle);
      const exScoreMatch = exNorm.match(/(\d+)\s+(\d+)/);
      const exIsDenial = /ينفي|نفي|لا صحه|غير صحيح|يكذب|شائعه/i.test(exNorm);

      // فحص تضارب النتيجة بين خبرين عن نفس المباراة
      if (
        candScoreMatch &&
        exScoreMatch &&
        (candScoreMatch[1] !== exScoreMatch[1] || candScoreMatch[2] !== exScoreMatch[2])
      ) {
        hasContradiction = true;
        contradictionReason = `تضارب محتمل في النتيجة مع خبر سابق (${existing.title})`;
        break;
      }

      // فحص تضارب تأكيد مقابل نفي
      if (candIsDenial !== exIsDenial) {
        hasContradiction = true;
        contradictionReason = `تضارب بين التأكيد والنفي مع خبر سابق (${existing.title})`;
        break;
      }

      isDuplicate = true;
      duplicateOfId = existing.id;
      break;
    }
  }

  return {
    isDuplicate,
    duplicateOfId,
    hasContradiction,
    contradictionReason,
  };
}

/**
 * فحص سقف التكلفة والحد اليومي قبل أي استدعاء مدفوع للذكاء الاصطناعي
 */
function checkAiBudgetAllowed(settings = {}) {
  const dailyLimit = Number(settings.dailyRequestsLimit ?? 120);
  const dailyUsed = Number(settings.dailyRequestsUsed ?? 0);
  const monthlyBudget = Number(settings.monthlyBudgetUsd ?? 10);
  const monthlySpent = Number(settings.monthlySpentEstimateUsd ?? 0);
  const pauseOnExceeded = settings.pauseOnBudgetExceeded !== false;

  if (pauseOnExceeded && dailyUsed >= dailyLimit) {
    return {
      allowed: false,
      reason: `تم بلوغ الحد اليومي لطلبات الذكاء الاصطناعي (${dailyUsed}/${dailyLimit})`,
    };
  }
  if (pauseOnExceeded && monthlySpent >= monthlyBudget) {
    return {
      allowed: false,
      reason: `تم بلوغ السقف المالي الشهري ($${monthlySpent.toFixed(2)} / $${monthlyBudget.toFixed(2)})`,
    };
  }
  return { allowed: true, reason: null };
}

/**
 * سياسة النشر الذكي الثلاثية (auto_publish / review_queue / rejected)
 */
function evaluateThreeStateDecision({ article, source, settings = {}, duplicateCheck }) {
  const reasonsAr = [];

  if (duplicateCheck && duplicateCheck.isDuplicate) {
    return {
      publishStatus: 'rejected',
      verificationStatus: 'rejected',
      reasonsAr: ['خبر مكرر موجود مسبقاً بنفس الرابط أو العنوان'],
    };
  }

  if (!article.originalTitle || String(article.originalTitle).trim().length < 8) {
    return {
      publishStatus: 'rejected',
      verificationStatus: 'rejected',
      reasonsAr: ['عنوان الخبر ناقص أو غير صالح للنشر'],
    };
  }

  if (duplicateCheck && duplicateCheck.hasContradiction) {
    reasonsAr.push(duplicateCheck.contradictionReason || 'تضارب مع خبر سابق يتطلب تحقق المدير');
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr,
    };
  }

  if (article.editorialType !== 'confirmed_news') {
    reasonsAr.push(`المادة مصنفة كـ (${article.editorialType}) ولا تُنشر تلقائياً بدون مراجعة`);
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr,
    };
  }

  if (!source || !source.trustedForAutoPublish) {
    reasonsAr.push('المصدر غير مفعّل للنشر التلقائي ويحتاج مراجعة المدير');
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr,
    };
  }

  if (!settings.autoPublishEnabled) {
    reasonsAr.push('النشر التلقائي متوقف حالياً من إعدادات الأتمتة (الوضع الآمن للمراجعة)');
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr,
    };
  }

  const allowedTags = Array.isArray(settings.allowedAutoPublishTags)
    ? settings.allowedAutoPublishTags
    : ['official', 'match_report', 'club_news'];

  if (article.tag && !allowedTags.includes(article.tag)) {
    reasonsAr.push(`التصنيف (${article.tag}) غير مدرج في تصنيفات النشر التلقائي`);
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr,
    };
  }

  if (article.verificationStatus !== 'verified') {
    reasonsAr.push('الخبر لم يجتز التحقق الكامل بعد');
    return {
      publishStatus: 'review_queue',
      verificationStatus: 'needs_review',
      reasonsAr,
    };
  }

  reasonsAr.push('مصدر رسمي موثوق + خبر مؤكد + بدون تكرار أو تضارب');
  return {
    publishStatus: 'auto_publish',
    verificationStatus: 'verified',
    reasonsAr,
  };
}

/**
 * استدعاء موحد وقابل للتبديل بين OpenAI API و Gemini API على الخادم فقط
 */
async function invokeServerAiCompletion({
  systemPrompt,
  userPrompt,
  settings = {},
  fetchImpl = globalThis.fetch,
}) {
  const provider = settings.aiProvider === 'gemini' ? 'gemini' : 'openai';
  const model = settings.aiModel || DEFAULT_MODELS[provider];

  const budgetCheck = checkAiBudgetAllowed(settings);
  if (!budgetCheck.allowed) {
    return {
      ok: false,
      provider,
      model,
      budgetBlocked: true,
      error: budgetCheck.reason,
      text: '',
      estimatedCostUsd: 0,
    };
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      return {
        ok: false,
        provider,
        model,
        missingKey: true,
        error: 'مفتاح OPENAI_API_KEY غير مُعد في متغيرات الخادم بعد',
        text: '',
        estimatedCostUsd: 0,
      };
    }

    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        provider,
        model,
        error: `OpenAI HTTP ${res.status}`,
        text: '',
        estimatedCostUsd: 0,
      };
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content || '';
    const totalTokens = Number(json?.usage?.total_tokens || 600);
    const estimatedCostUsd = Number(
      ((totalTokens / 1000) * COST_ESTIMATE_PER_1K_TOKENS_USD.openai).toFixed(5)
    );
    return { ok: true, provider, model, text, estimatedCostUsd };
  }

  // Gemini API على الخادم
  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (!geminiKey) {
    return {
      ok: false,
      provider: 'gemini',
      model,
      missingKey: true,
      error: 'مفتاح GEMINI_API_KEY غير مُعد في متغيرات الخادم بعد',
      text: '',
      estimatedCostUsd: 0,
    };
  }

  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      provider: 'gemini',
      model,
      error: `Gemini HTTP ${res.status}`,
      text: '',
      estimatedCostUsd: 0,
    };
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const estimatedCostUsd = Number((0.6 * COST_ESTIMATE_PER_1K_TOKENS_USD.gemini).toFixed(5));
  return { ok: true, provider: 'gemini', model, text, estimatedCostUsd };
}

/**
 * المحرر الصحفي الذكي لمنصة وتين سبورت:
 * يعيد صياغة الخبر الأصلي بأسلوب صحفي عربي أصيل ومحايد مع حفظ النص الأصلي ورابط المصدر وعدم اختلاق أي معلومة
 */
async function rewriteAndVerifySportsNews({
  rawItem,
  source,
  settings = {},
  existingArticles = [],
  fetchImpl = globalThis.fetch,
}) {
  const originalTitle = String(rawItem.title || '').trim();
  const originalContent = String(rawItem.content || rawItem.description || '').trim();
  const sourceUrl = String(rawItem.link || rawItem.sourceUrl || '').trim();
  const sourceName = String(source?.name || rawItem.sourceName || 'مصدر رياضي').trim();
  const editorialType = classifyEditorialType(originalTitle, originalContent, source);
  const articleId = generateDeterministicNewsId(sourceUrl, originalTitle);

  const duplicateCheck = detectDuplicateOrContradiction(
    { originalTitle, sourceUrl },
    existingArticles
  );

  const systemPrompt = [
    'أنت المحرر الصحفي الرياضي الذكي لمنصة "وتين سبورت — WATEEN SPORT".',
    'التعليمات التحريرية الصارمة:',
    '1. أعد صياغة الخبر بلغة عربية رياضية سليمة، احترافية، محايدة، ومختلفة صياغياً عن النص الحرفي للمصدر دون نسخ حرفي.',
    '2. ممنوع تماماً اختلاق أي معلومة أو نتيجة أو تصريح أو اسم لاعب غير مذكور صراحة في النص الأصلي.',
    '3. التزم بالشفافية: إذا كان النص عبارة عن إشاعة أو رأي أو توقع فاذكر ذلك صراحة في editorialType.',
    '4. أعد كائن JSON فقط بالحقول: title, summary, content, tag, competitionId, editorialType, isBreaking, hashtags.',
  ].join('\n');

  const userPrompt = JSON.stringify({
    sourceName,
    sourceUrl,
    originalTitle,
    originalContent: originalContent.slice(0, 3500),
    publishedAt: rawItem.publishedAt || new Date().toISOString(),
  });

  let rewritten = null;
  let aiMeta = {
    aiRewritten: false,
    provider: settings.aiProvider || 'openai',
    estimatedCostUsd: 0,
    note: '',
  };

  if (!duplicateCheck.isDuplicate && originalTitle.length >= 8) {
    const aiRes = await invokeServerAiCompletion({
      systemPrompt,
      userPrompt,
      settings,
      fetchImpl,
    });

    if (aiRes.ok && aiRes.text) {
      try {
        const parsed = JSON.parse(aiRes.text);
        if (parsed && typeof parsed.title === 'string' && parsed.title.trim()) {
          rewritten = parsed;
          aiMeta = {
            aiRewritten: true,
            provider: aiRes.provider,
            estimatedCostUsd: aiRes.estimatedCostUsd,
            note: `تمت الصياغة عبر ${aiRes.provider} (${aiRes.model})`,
          };
        }
      } catch {
        aiMeta.note = 'تعذر تحليل استجابة JSON من نموذج الذكاء الاصطناعي — تم التحويل للمراجعة';
      }
    } else {
      aiMeta.note = aiRes.error || 'تعذر الاتصال بمحرك الذكاء الاصطناعي';
    }
  }

  const finalEditorialType =
    rewritten?.editorialType &&
    ['confirmed_news', 'analysis', 'opinion', 'prediction', 'transfer_rumor'].includes(
      rewritten.editorialType
    )
      ? rewritten.editorialType
      : editorialType;

  const summaryFallback =
    originalContent.length > 220
      ? `${originalContent.slice(0, 220).trim()}...`
      : originalContent || originalTitle;

  const builtArticle = {
    id: articleId,
    title: rewritten?.title?.trim() || originalTitle,
    summary: rewritten?.summary?.trim() || summaryFallback,
    content:
      rewritten?.content?.trim() ||
      `${originalContent || originalTitle}\n\nالمصدر: ${sourceName}${sourceUrl ? ` (${sourceUrl})` : ''}`,
    originalTitle,
    originalContent,
    sourceName,
    sourceUrl,
    competitionId: rewritten?.competitionId || 'pro_league',
    tag: rewritten?.tag || (source?.trustedForAutoPublish ? 'official' : 'club_news'),
    editorialType: finalEditorialType,
    verificationStatus:
      aiMeta.aiRewritten && source?.trustedForAutoPublish && !duplicateCheck.hasContradiction
        ? 'verified'
        : 'needs_review',
    publishStatus: 'review_queue',
    isBreaking: Boolean(rewritten?.isBreaking),
    imageUrl: rawItem.imageUrl || './images/stadium-night.jpg',
    imageRightsStatus: rawItem.imageUrl ? 'source_attributed' : 'platform_default',
    author: `وتين سبورت AI • نقلاً عن ${sourceName}`,
    publishedAt: rawItem.publishedAt || new Date().toISOString(),
    views: 0,
    isDemo: false,
    aiMeta,
  };

  const decision = evaluateThreeStateDecision({
    article: builtArticle,
    source,
    settings,
    duplicateCheck,
  });

  builtArticle.publishStatus = decision.publishStatus;
  builtArticle.verificationStatus = decision.verificationStatus;
  builtArticle.decisionReasonsAr = decision.reasonsAr;

  return {
    article: builtArticle,
    decision,
    duplicateCheck,
    aiMeta,
  };
}

module.exports = {
  DEFAULT_MODELS,
  normalizeArabicForCompare,
  generateDeterministicNewsId,
  computeTitleSimilarity,
  classifyEditorialType,
  detectDuplicateOrContradiction,
  checkAiBudgetAllowed,
  evaluateThreeStateDecision,
  invokeServerAiCompletion,
  rewriteAndVerifySportsNews,
};
