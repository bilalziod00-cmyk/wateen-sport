import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);

console.log('====================================================================');
console.log('  WATEEN SPORT AI - Phase 3 Verification (WATEEN AI & News Intel)   ');
console.log('====================================================================');

// 1) تحميل وحدات الخادم (Firebase Cloud Functions - Node 20 CommonJS)
const wateenAiCore = require('../firebase/functions/wateenAiCore.js');
const newsCollector = require('../firebase/functions/newsCollector.js');

// 2) تجميع وحدات العميل TypeScript للاختبار الفعلي
await build({
  entryPoints: [
    'src/services/newsIntelligenceService.ts',
    'src/services/schemaMigrationService.ts',
    'src/services/persistentStorageService.ts',
    'src/data/seedData.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['firebase/*'],
  outdir: 'node_modules/.cache/wateen-phase3-tests',
  define: {
    'import.meta.env.VITE_DEFAULT_ADMIN_PIN': '"2026"',
  },
  write: true,
});

const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear(),
};

const newsSvc = await import('../node_modules/.cache/wateen-phase3-tests/services/newsIntelligenceService.js');
const migMod = await import('../node_modules/.cache/wateen-phase3-tests/services/schemaMigrationService.js');
const storageMod = await import('../node_modules/.cache/wateen-phase3-tests/services/persistentStorageService.js');
const seedMod = await import('../node_modules/.cache/wateen-phase3-tests/data/seedData.js');

let passed = 0;
async function runTest(num, title, fn) {
  await fn();
  passed++;
  console.log(`✓ [Phase 3 Test ${num}/7] PASSED: ${title}`);
}

const SAMPLE_JFA_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>الاتحاد الأردني لكرة القدم</title>
    <item>
      <title><![CDATA[رسمياً: الاتحاد الأردني يصدر جدول مباريات الجولة 16 من دوري المحترفين]]></title>
      <link>https://www.jfa.jo/news/round-16-schedule</link>
      <description><![CDATA[أصدر الاتحاد الأردني لكرة القدم جدول مواعيد وملاعب الجولة السادسة عشرة من دوري المحترفين بتوقيت عمّان.]]></description>
      <pubDate>Wed, 18 Nov 2026 14:00:00 GMT</pubDate>
      <media:content url="https://www.jfa.jo/uploads/round16.jpg" medium="image" />
    </item>
    <item>
      <title><![CDATA[أنباء غير مؤكدة عن مفاوضات انتقال مهاجم جديد إلى نادي الفيصلي]]></title>
      <link>https://www.jfa.jo/news/transfer-rumor-1</link>
      <description><![CDATA[تداولت تقارير غير مؤكدة إشاعات حول اقتراب مهاجم محترف من الانضمام إلى صفوف الفيصلي.]]></description>
      <pubDate>Wed, 18 Nov 2026 15:00:00 GMT</pubDate>
    </item>
    <item>
      <title><![CDATA[التشكيلة المتوقعة لمواجهة الحسين إربد والوحدات في قمة الأسبوع]]></title>
      <link>https://www.jfa.jo/news/predicted-lineup</link>
      <description><![CDATA[قراءة فنية وتوقعات التشكيلة المتوقعة للقمة المرتقبة على ستاد الحسن.]]></description>
      <pubDate>Wed, 18 Nov 2026 16:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

// ---------------------------------------------------------------------------
// Test 1: RSS 2.0 + Atom XML Parsing (Server & Client Parity)
// ---------------------------------------------------------------------------
await runTest(
  1,
  'تحليل خلاصات RSS 2.0 و Atom باللغتين العربية والإنجليزية مع CDATA والصور والروابط في الخادم والعميل',
  async () => {
    const serverItems = newsCollector.parseRssOrAtomFeedXml(SAMPLE_JFA_RSS_XML, {
      name: 'الاتحاد الأردني لكرة القدم (JFA)',
    });
    const clientItems = newsSvc.parseRssOrAtomXml(SAMPLE_JFA_RSS_XML, {
      name: 'الاتحاد الأردني لكرة القدم (JFA)',
    });

    assert.equal(serverItems.length, 3);
    assert.equal(clientItems.length, 3);
    assert.equal(serverItems[0].link, 'https://www.jfa.jo/news/round-16-schedule');
    assert.equal(serverItems[0].imageUrl, 'https://www.jfa.jo/uploads/round16.jpg');
    assert.equal(clientItems[0].imageUrl, 'https://www.jfa.jo/uploads/round16.jpg');

    const atomXml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>AFC Champions League Jordan Clubs Update</title>
          <link href="https://www.the-afc.com/en/news/jordan-clubs" />
          <summary>Official schedule confirmed by AFC.</summary>
          <updated>2026-11-18T12:00:00Z</updated>
        </entry>
      </feed>`;
    const atomParsed = newsCollector.parseRssOrAtomFeedXml(atomXml, { name: 'AFC' });
    assert.equal(atomParsed.length, 1);
    assert.equal(atomParsed[0].link, 'https://www.the-afc.com/en/news/jordan-clubs');
  }
);

// ---------------------------------------------------------------------------
// Test 2: Switchable WATEEN AI Server Core (OpenAI <-> Gemini) + Budget Guard
// ---------------------------------------------------------------------------
await runTest(
  2,
  'تبديل محرك WATEEN AI على الخادم بين OpenAI API و Gemini API + حارس السقف المالي والحد اليومي',
  async () => {
    const oldOpenAi = process.env.OPENAI_API_KEY;
    const oldGemini = process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-server-openai-key';
    process.env.GEMINI_API_KEY = 'test-server-gemini-key';

    let calledUrls = [];
    const mockFetch = async (url) => {
      calledUrls.push(String(url));
      if (String(url).includes('api.openai.com')) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'الاتحاد الأردني يعلن مواعيد الجولة 16 من دوري المحترفين',
                    summary: 'أصدر الاتحاد الأردني الجدول الرسمي لمباريات الجولة 16 بتوقيت عمّان.',
                    content: 'أعلن الاتحاد الأردني لكرة القدم مواعيد وملاعب الجولة السادسة عشرة رسمياً.',
                    tag: 'official',
                    competitionId: 'pro_league',
                    editorialType: 'confirmed_news',
                    isBreaking: false,
                  }),
                },
              },
            ],
            usage: { total_tokens: 450 },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'تحديد ملاعب ومواعيد الجولة السادسة عشرة لدوري المحترفين',
                      summary: 'جدول رسمي جديد من الاتحاد الأردني لكرة القدم.',
                      content: 'نشر الاتحاد الأردني مواعيد الجولة 16 رسمياً.',
                      tag: 'official',
                      competitionId: 'pro_league',
                      editorialType: 'confirmed_news',
                      isBreaking: false,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    };

    try {
      const source = {
        id: 'src-jfa-official',
        name: 'الاتحاد الأردني لكرة القدم (JFA)',
        trustedForAutoPublish: true,
      };
      const rawItem = {
        title: 'رسمياً: الاتحاد الأردني يصدر جدول مباريات الجولة 16 من دوري المحترفين',
        content: 'أصدر الاتحاد الأردني جدول مباريات الجولة 16.',
        link: 'https://www.jfa.jo/news/round-16-schedule',
      };

      // 1) OpenAI provider
      const openAiOut = await wateenAiCore.rewriteAndVerifySportsNews({
        rawItem,
        source,
        settings: {
          aiProvider: 'openai',
          aiModel: 'gpt-4o-mini',
          autoPublishEnabled: true,
          allowedAutoPublishTags: ['official', 'match_report'],
          dailyRequestsLimit: 100,
          dailyRequestsUsed: 5,
          monthlyBudgetUsd: 10,
          monthlySpentEstimateUsd: 0.5,
        },
        fetchImpl: mockFetch,
      });
      assert.equal(openAiOut.aiMeta.aiRewritten, true);
      assert.equal(openAiOut.aiMeta.provider, 'openai');
      assert.equal(openAiOut.decision.publishStatus, 'auto_publish');
      assert.ok(calledUrls[0].includes('api.openai.com'));

      // 2) Switch cleanly to Gemini provider
      const geminiOut = await wateenAiCore.rewriteAndVerifySportsNews({
        rawItem: { ...rawItem, link: 'https://www.jfa.jo/news/round-16-schedule-2' },
        source,
        settings: {
          aiProvider: 'gemini',
          aiModel: 'gemini-2.0-flash',
          autoPublishEnabled: true,
          allowedAutoPublishTags: ['official'],
          dailyRequestsLimit: 100,
          dailyRequestsUsed: 6,
          monthlyBudgetUsd: 10,
          monthlySpentEstimateUsd: 0.5,
        },
        fetchImpl: mockFetch,
      });
      assert.equal(geminiOut.aiMeta.aiRewritten, true);
      assert.equal(geminiOut.aiMeta.provider, 'gemini');
      assert.ok(calledUrls[1].includes('generativelanguage.googleapis.com'));

      // 3) Budget guard stops calls when monthly ceiling reached
      const budgetBlocked = await wateenAiCore.invokeServerAiCompletion({
        systemPrompt: 'test',
        userPrompt: 'test',
        settings: {
          aiProvider: 'openai',
          monthlyBudgetUsd: 5,
          monthlySpentEstimateUsd: 5.01,
          pauseOnBudgetExceeded: true,
        },
        fetchImpl: mockFetch,
      });
      assert.equal(budgetBlocked.ok, false);
      assert.equal(budgetBlocked.budgetBlocked, true);
    } finally {
      if (oldOpenAi === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldOpenAi;
      if (oldGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = oldGemini;
    }
  }
);

// ---------------------------------------------------------------------------
// Test 3: 3-State Smart Publishing Policy (Confirmed vs Rumor vs Prediction)
// ---------------------------------------------------------------------------
await runTest(
  3,
  'سياسة النشر الذكي الثلاثية: نشر الخبر الرسمي المؤكد، وتحويل الإشاعات والتوقعات لطابور المراجعة دائماً',
  async () => {
    const trustedSource = {
      id: 'src-jfa-official',
      name: 'الاتحاد الأردني لكرة القدم (JFA)',
      region: 'jordan',
      method: 'rss',
      url: 'https://www.jfa.jo/rss',
      trustedForAutoPublish: true,
      enabled: true,
      pollIntervalMinutes: 30,
    };

    const settingsAutoOn = {
      ...migMod.getDefaultAutomationSettings(),
      autoPublishEnabled: true,
    };

    const cycle = await newsSvc.runNewsIntelligenceBatch({
      sources: [trustedSource],
      existingArticles: [],
      queuedArticles: [],
      settings: settingsAutoOn,
      manualXmlBySourceId: {
        'src-jfa-official': SAMPLE_JFA_RSS_XML,
      },
    });

    assert.equal(cycle.published.length, 1, 'الخبر الرسمي المؤكد فقط يُنشر تلقائياً');
    assert.equal(cycle.published[0].editorialType, 'confirmed_news');
    assert.equal(cycle.published[0].isDemo, false);
    assert.equal(cycle.published[0].sourceUrl, 'https://www.jfa.jo/news/round-16-schedule');

    assert.equal(cycle.queued.length, 2, 'إشاعة الانتقال والتشكيلة المتوقعة تذهبان لطابور المراجعة');
    const typesInQueue = cycle.queued.map((q) => q.editorialType).sort();
    assert.deepEqual(typesInQueue, ['prediction', 'transfer_rumor']);
  }
);

// ---------------------------------------------------------------------------
// Test 4: Safe Mode (autoPublishEnabled = false) forces ALL news to review_queue
// ---------------------------------------------------------------------------
await runTest(
  4,
  'الوضع الآمن (autoPublishEnabled: false) يحوّل حتى الأخبار الرسمية لطابور المراجعة قبل النشر',
  async () => {
    const trustedSource = migMod.getDefaultNewsSources()[0];
    const safeSettings = {
      ...migMod.getDefaultAutomationSettings(),
      autoPublishEnabled: false,
    };
    const res = newsSvc.processRawNewsItemForWateen({
      rawItem: {
        title: 'الاتحاد الأردني يعتمد ملاعب الجولة 17 لدوري المحترفين',
        content: 'بيان رسمي من الاتحاد الأردني يحدد ملاعب الجولة السابعة عشرة.',
        link: 'https://www.jfa.jo/news/round-17',
      },
      source: trustedSource,
      settings: safeSettings,
      existingArticles: [],
      queuedArticles: [],
    });
    assert.equal(res.decision.publishStatus, 'review_queue');
  }
);

// ---------------------------------------------------------------------------
// Test 5: Duplicate Rejection & Contradiction Detection -> Review Queue
// ---------------------------------------------------------------------------
await runTest(
  5,
  'منع الأخبار المكررة بالرابط أو التشابه العالي + رصد تضارب النتائج/النفي وتحويله لطابور المراجعة',
  async () => {
    const trustedSource = migMod.getDefaultNewsSources()[0];
    const settingsAutoOn = {
      ...migMod.getDefaultAutomationSettings(),
      autoPublishEnabled: true,
    };

    const existing = [
      {
        id: 'news_existing_1',
        title: 'فوز الفيصلي على الوحدات 2 1 في دوري المحترفين',
        originalTitle: 'فوز الفيصلي على الوحدات 2-1 في دوري المحترفين',
        summary: 'ملخص',
        content: 'محتوى',
        sourceUrl: 'https://www.jfa.jo/news/faisaly-wehdat-2-1',
        competitionId: 'pro_league',
        tag: 'match_report',
        isBreaking: false,
        imageUrl: '',
        author: 'وتين سبورت',
        publishedAt: '2026-11-18T12:00:00.000Z',
        views: 10,
      },
    ];

    // 1) خبر مكرر بنفس الرابط -> مرفوض
    const dupRes = newsSvc.processRawNewsItemForWateen({
      rawItem: {
        title: 'فوز الفيصلي على الوحدات 2-1 في قمة المحترفين',
        content: 'تفاصيل الفوز',
        link: 'https://www.jfa.jo/news/faisaly-wehdat-2-1/',
      },
      source: trustedSource,
      settings: settingsAutoOn,
      existingArticles: existing,
      queuedArticles: [],
    });
    assert.equal(dupRes.duplicateCheck.isDuplicate, true);
    assert.equal(dupRes.decision.publishStatus, 'rejected');

    // 2) خبر متضارب النتيجة (3-1 مقابل 2-1) -> يُحوَّل للمراجعة ولا يُنشر تلقائياً
    const contraRes = newsSvc.processRawNewsItemForWateen({
      rawItem: {
        title: 'فوز الفيصلي على الوحدات 3-1 في دوري المحترفين',
        content: 'خبر متضارب في النتيجة',
        link: 'https://other-source.example/match-3-1',
      },
      source: trustedSource,
      settings: settingsAutoOn,
      existingArticles: existing,
      queuedArticles: [],
    });
    assert.equal(contraRes.duplicateCheck.hasContradiction, true);
    assert.equal(contraRes.decision.publishStatus, 'review_queue');
  }
);

// ---------------------------------------------------------------------------
// Test 6: Honest Source Error Handling (No Fabricated News When Source Fails)
// ---------------------------------------------------------------------------
await runTest(
  6,
  'معالجة أخطاء المصادر بصدق: عند تعطل مصدر RSS (HTTP 503) يُسجل خطأ واضح ولا يُختلق أي خبر وهمي',
  async () => {
    const failingFetch = async () => ({
      ok: false,
      status: 503,
      headers: { get: () => 'text/html' },
      text: async () => 'Service Unavailable',
    });

    const serverBatch = await newsCollector.collectAndProcessNewsBatch({
      sources: [
        {
          id: 'src-down',
          name: 'مصدر متعطل مؤقتاً',
          url: 'https://down.example/rss',
          enabled: true,
          trustedForAutoPublish: true,
        },
      ],
      existingArticles: [],
      settings: migMod.getDefaultAutomationSettings(),
      fetchImpl: failingFetch,
    });

    assert.equal(serverBatch.published.length, 0);
    assert.equal(serverBatch.queued.length, 0);
    assert.equal(serverBatch.sourceUpdates.length, 1);
    assert.equal(serverBatch.sourceUpdates[0].lastStatus, 'error');
    assert.ok(serverBatch.sourceUpdates[0].lastError.includes('503'));
  }
);

// ---------------------------------------------------------------------------
// Test 7: Firestore Rules Coverage + Phase 3 Verified Backup Snapshot
// ---------------------------------------------------------------------------
await runTest(
  7,
  'التحقق من قواعد أمان Firestore للمجموعات الجديدة وحفظ نسخة احتياطية موثقة للمرحلة الثالثة',
  async () => {
    const rulesText = fs.readFileSync(path.resolve('firebase/firestore.rules'), 'utf8');
    const requiredCollections = [
      'news',
      'news_sources',
      'review_queue',
      'injuries',
      'player_statistics',
      'standings_history',
      'ai_tasks',
      'app_settings',
      'import_jobs',
    ];
    for (const col of requiredCollections) {
      assert.ok(
        rulesText.includes(`match /${col}/`),
        `المجموعة ${col} يجب أن تكون محمية في firestore.rules`
      );
    }

    const freshState = migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state;
    const snap = storageMod.createPreMigrationBackupSnapshot(freshState);
    const backupsDir = path.resolve('backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const p3Path = path.join(backupsDir, 'phase3-verified-backup.json');
    fs.writeFileSync(p3Path, JSON.stringify(snap, null, 2), 'utf8');
    assert.ok(fs.existsSync(p3Path));
  }
);

console.log('====================================================================');
console.log(`ALL ${passed}/7 PHASE 3 WATEEN AI & NEWS INTELLIGENCE TESTS PASSED!`);
console.log('====================================================================');
