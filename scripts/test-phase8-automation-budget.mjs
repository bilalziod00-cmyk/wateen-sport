import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);

console.log('====================================================================');
console.log('  WATEEN SPORT AI - Phase 8 Verification (Automation & Budget Guard)');
console.log('====================================================================');

await build({
  entryPoints: [
    'src/services/automationAndCacheService.ts',
    'src/services/schemaMigrationService.ts',
    'src/services/persistentStorageService.ts',
    'src/data/seedData.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['firebase/*'],
  outdir: 'node_modules/.cache/wateen-phase8-tests',
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

const clientAuto = await import('../node_modules/.cache/wateen-phase8-tests/services/automationAndCacheService.js');
const migMod = await import('../node_modules/.cache/wateen-phase8-tests/services/schemaMigrationService.js');
const storageMod = await import('../node_modules/.cache/wateen-phase8-tests/services/persistentStorageService.js');
const seedMod = await import('../node_modules/.cache/wateen-phase8-tests/data/seedData.js');

const schedServer = require('../firebase/functions/scheduledAutomation.js');

const baseState = migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state;

let passed = 0;
async function runTest(num, title, fn) {
  await fn();
  passed++;
  console.log(`✓ [Phase 8 Test ${num}/7] PASSED: ${title}`);
}

const sampleRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>الاتحاد الأردني يحدد موعد قمة الجولة 17 من دوري المحترفين</title>
    <link>https://www.jfa.jo/news/round17-summit</link>
    <description>أعلن الاتحاد الأردني لكرة القدم إقامة مباراة الفيصلي والوحدات مساء الجمعة بتوقيت عمّان.</description>
    <pubDate>Thu, 19 Nov 2026 10:00:00 +0300</pubDate>
  </item>
</channel></rss>`;

const testSource = {
  id: 'src-jfa-official',
  name: 'الاتحاد الأردني لكرة القدم (JFA)',
  region: 'jordan',
  method: 'rss',
  url: 'https://www.jfa.jo/rss',
  trustedForAutoPublish: true,
  enabled: true,
  pollIntervalMinutes: 30,
};

// ---------------------------------------------------------------------------
// Test 1: Daily Limit & Monthly USD Budget Guard Pauses Server Execution
// ---------------------------------------------------------------------------
await runTest(
  1,
  'إيقاف التشغيل التلقائي فوراً عند بلوغ الحد اليومي أو السقف المالي الشهري وإصدار تنبيه للمدير',
  async () => {
    let networkCalls = 0;
    const blockedFetch = async () => {
      networkCalls++;
      return { ok: true, text: async () => sampleRssXml };
    };

    const todayAmman = schedServer.getAmmanDateParts(new Date('2026-11-19T12:00:00Z')).dayKey;
    const monthAmman = schedServer.getAmmanDateParts(new Date('2026-11-19T12:00:00Z')).monthKey;

    const overDailyCycle = await schedServer.executeScheduledWateenCycle({
      sources: [testSource],
      existingArticles: baseState.articles,
      settings: {
        automationEnabled: true,
        dailyRequestsLimit: 100,
        dailyRequestsUsed: 100,
        monthlyBudgetUsd: 10,
        monthlySpentEstimateUsd: 1.5,
        pauseOnBudgetExceeded: true,
        lastBudgetResetDate: todayAmman,
        lastMonthlyResetMonth: monthAmman,
      },
      fetchImpl: blockedFetch,
      now: new Date('2026-11-19T12:00:00Z'),
      sleepFn: async () => {},
    });

    assert.equal(overDailyCycle.pausedByBudget, true);
    assert.equal(networkCalls, 0, 'Must NOT call network or AI when daily quota reached');
    assert.ok(overDailyCycle.alerts.some((a) => a.severity === 'warning'));

    const overMonthlyCycle = await schedServer.executeScheduledWateenCycle({
      sources: [testSource],
      existingArticles: baseState.articles,
      settings: {
        automationEnabled: true,
        dailyRequestsLimit: 100,
        dailyRequestsUsed: 10,
        monthlyBudgetUsd: 5,
        monthlySpentEstimateUsd: 5.02,
        pauseOnBudgetExceeded: true,
        lastBudgetResetDate: todayAmman,
        lastMonthlyResetMonth: monthAmman,
      },
      fetchImpl: blockedFetch,
      now: new Date('2026-11-19T12:00:00Z'),
      sleepFn: async () => {},
    });

    assert.equal(overMonthlyCycle.pausedByBudget, true);
    assert.equal(networkCalls, 0, 'Must NOT call AI when monthly budget exceeded');
    assert.match(overMonthlyCycle.pausedReason || '', /السقف المالي الشهري/);
  }
);

// ---------------------------------------------------------------------------
// Test 2: Automatic Amman-Time Daily & Monthly Counter Rollover
// ---------------------------------------------------------------------------
await runTest(
  2,
  'تصفير العداد اليومي عند دخول يوم جديد والشهري عند دخول شهر جديد بتوقيت عمّان',
  async () => {
    const rolledDay = schedServer.rolloverBudgetCountersIfNeeded(
      {
        dailyRequestsUsed: 120,
        monthlySpentEstimateUsd: 4.2,
        lastBudgetResetDate: '2026-11-18',
        lastMonthlyResetMonth: '2026-11',
      },
      new Date('2026-11-19T08:00:00Z')
    );

    assert.equal(rolledDay.didResetDaily, true);
    assert.equal(rolledDay.didResetMonthly, false);
    assert.equal(rolledDay.settings.dailyRequestsUsed, 0);
    assert.equal(rolledDay.settings.monthlySpentEstimateUsd, 4.2);

    const rolledMonth = schedServer.rolloverBudgetCountersIfNeeded(
      {
        dailyRequestsUsed: 45,
        monthlySpentEstimateUsd: 9.8,
        lastBudgetResetDate: '2026-11-30',
        lastMonthlyResetMonth: '2026-11',
      },
      new Date('2026-11-30T22:00:00Z') // 01:00 AM Dec 1 in Amman UTC+3!
    );

    assert.equal(rolledMonth.dayKey, '2026-12-01');
    assert.equal(rolledMonth.didResetDaily, true);
    assert.equal(rolledMonth.didResetMonthly, true);
    assert.equal(rolledMonth.settings.monthlySpentEstimateUsd, 0);
  }
);

// ---------------------------------------------------------------------------
// Test 3: Two-Level Caching (TTL Pre-Fetch + Content-Hash Deduplication)
// ---------------------------------------------------------------------------
await runTest(
  3,
  'التخزين المؤقت (TTL + بصمة المحتوى) يمنع الطلبات المكررة ويوفر استهلاك AI',
  async () => {
    const prevKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-cache-openai-key';
    let fetchCount = 0;
    let aiCallCount = 0;

    const rssAndAiFetch = async (url) => {
      if (String(url).includes('api.openai.com')) {
        aiCallCount++;
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'الاتحاد الأردني يحدد موعد قمة الجولة 17 من دوري المحترفين',
                    summary: 'موعد قمة الفيصلي والوحدات مساء الجمعة بتوقيت عمّان.',
                    content: 'أعلن الاتحاد الأردني لكرة القدم إقامة مباراة القمة مساء الجمعة.',
                    tag: 'official',
                    competitionId: 'pro_league',
                    editorialType: 'confirmed_news',
                    isBreaking: false,
                  }),
                },
              },
            ],
            usage: { total_tokens: 300 },
          }),
        };
      }
      fetchCount++;
      return {
        ok: true,
        headers: { get: () => 'application/rss+xml' },
        text: async () => sampleRssXml,
      };
    };

    try {
      const t0 = new Date('2026-11-19T10:00:00Z');
      const cycle1 = await schedServer.executeScheduledWateenCycle({
        sources: [testSource],
        existingArticles: baseState.articles,
        settings: {
          automationEnabled: true,
          autoPublishEnabled: true,
          aiProvider: 'openai',
          allowedAutoPublishTags: ['official', 'match_report', 'club_news'],
          cacheTtlMinutes: 20,
          dailyRequestsLimit: 100,
          dailyRequestsUsed: 0,
          lastBudgetResetDate: '2026-11-19',
          lastMonthlyResetMonth: '2026-11',
        },
        fetchImpl: rssAndAiFetch,
        now: t0,
        sleepFn: async () => {},
      });

      assert.equal(fetchCount, 1);
      assert.equal(aiCallCount, 1);
      assert.equal(cycle1.published.length, 1);

      // Within 5 mins -> Level 1 TTL hit, zero fetches and zero AI calls!
      const cycle2 = await schedServer.executeScheduledWateenCycle({
        sources: [testSource],
        existingArticles: [...baseState.articles, ...cycle1.published],
        settings: cycle1.updatedSettings,
        fetchImpl: rssAndAiFetch,
        now: new Date(t0.getTime() + 5 * 60_000),
        sleepFn: async () => {},
      });

      assert.equal(fetchCount, 1, 'TTL cache must prevent even network fetch inside 30m window');
      assert.equal(aiCallCount, 1, 'No AI request during TTL cache hit');
      assert.ok(cycle2.stats.cacheHits >= 1);

      // After 45 mins with SAME RSS XML -> Level 2 contentHash hit, zero AI spend!
      const cycle3 = await schedServer.executeScheduledWateenCycle({
        sources: [testSource],
        existingArticles: [...baseState.articles, ...cycle1.published],
        settings: cycle2.updatedSettings,
        fetchImpl: rssAndAiFetch,
        now: new Date(t0.getTime() + 45 * 60_000),
        sleepFn: async () => {},
      });

      assert.equal(fetchCount, 2, 'Network checked once after TTL');
      assert.equal(aiCallCount, 1, 'Content hash cache must skip AI call for unchanged feed');
      assert.equal(cycle3.published.length, 0);
      assert.ok(cycle3.stats.cacheHits >= 1);
      assert.equal(cycle3.stats.aiRequestsUsed, 0);
    } finally {
      if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prevKey;
    }
  }
);

// ---------------------------------------------------------------------------
// Test 4: Auto-Retry Succeeds on Transient Errors & Creates Explicit Admin Alert on Failure
// ---------------------------------------------------------------------------
await runTest(
  4,
  'إعادة المحاولة التلقائية عند الفشل المؤقت وإصدار تنبيه صريح للمدير عند التعطل دون اختلاق أخبار',
  async () => {
    let flakyAttempts = 0;
    const flakyFetch = async () => {
      flakyAttempts++;
      if (flakyAttempts < 2) {
        return { ok: false, status: 503 };
      }
      return {
        ok: true,
        headers: { get: () => 'application/rss+xml' },
        text: async () => sampleRssXml,
      };
    };

    const recovered = await schedServer.executeScheduledWateenCycle({
      sources: [testSource],
      existingArticles: baseState.articles,
      settings: {
        automationEnabled: true,
        autoPublishEnabled: false,
        maxRetryAttempts: 2,
        dailyRequestsLimit: 100,
        lastBudgetResetDate: '2026-11-19',
        lastMonthlyResetMonth: '2026-11',
      },
      fetchImpl: flakyFetch,
      now: new Date('2026-11-19T12:00:00Z'),
      sleepFn: async () => {},
    });

    assert.equal(flakyAttempts, 2, 'Should retry once after 503 and succeed');
    assert.equal(recovered.ok, true);
    assert.equal(recovered.queued.length, 1);

    let deadAttempts = 0;
    const deadFetch = async () => {
      deadAttempts++;
      throw new Error('ECONNRESET network unreachable');
    };

    const failedCycle = await schedServer.executeScheduledWateenCycle({
      sources: [testSource],
      existingArticles: baseState.articles,
      settings: {
        automationEnabled: true,
        maxRetryAttempts: 2,
        dailyRequestsLimit: 100,
        lastBudgetResetDate: '2026-11-19',
        lastMonthlyResetMonth: '2026-11',
      },
      fetchImpl: deadFetch,
      now: new Date('2026-11-19T12:00:00Z'),
      sleepFn: async () => {},
    });

    assert.equal(deadAttempts, 3, '1 initial attempt + 2 retries = 3 total attempts');
    assert.equal(failedCycle.ok, false);
    assert.equal(failedCycle.published.length, 0, 'Never fabricate articles on error');
    assert.equal(failedCycle.alerts.length, 1);
    assert.equal(failedCycle.alerts[0].severity, 'error');
    assert.equal(failedCycle.sourceUpdates[0].lastStatus, 'error');
  }
);

// ---------------------------------------------------------------------------
// Test 5: Offline & Stale UX Never Shows Cached Data as Fresh Live Updates
// ---------------------------------------------------------------------------
await runTest(
  5,
  'عدم عرض البيانات المخزنة كـ "تحديث مباشر" عند انقطاع الإنترنت أو فشل المصادر',
  async () => {
    const offlineStatus = clientAuto.evaluateDataFreshnessStatus({
      isOnline: false,
      lastUpdatedAt: '2026-11-19T09:00:00Z',
      failedSourcesCount: 0,
      totalEnabledSources: 6,
      nowMs: new Date('2026-11-19T09:05:00Z').getTime(),
    });

    assert.equal(offlineStatus.mode, 'offline');
    assert.equal(offlineStatus.showWarningBanner, true);
    assert.match(offlineStatus.messageAr, /غير متصل بالإنترنت/);

    const errStatus = clientAuto.evaluateDataFreshnessStatus({
      isOnline: true,
      lastUpdatedAt: '2026-11-19T09:00:00Z',
      failedSourcesCount: 2,
      totalEnabledSources: 6,
      nowMs: new Date('2026-11-19T09:05:00Z').getTime(),
    });

    assert.equal(errStatus.mode, 'source_error');
    assert.equal(errStatus.showWarningBanner, true);

    const offlineRun = await clientAuto.runBudgetAwareCollectionCycle({
      sources: [testSource],
      existingArticles: baseState.articles,
      queuedArticles: [],
      settings: migMod.getDefaultAutomationSettings(),
      isOnline: false,
    });

    assert.equal(offlineRun.ok, false);
    assert.equal(offlineRun.published.length, 0);
    assert.ok(offlineRun.alerts.some((a) => /الشبكة|الإنترنت/.test(a.title + a.message)));
  }
);

// ---------------------------------------------------------------------------
// Test 6: Server Cloud Scheduler Trigger & Zero Client-Side Secret Keys
// ---------------------------------------------------------------------------
await runTest(
  6,
  'تصدير دالة الجدولة السحابية runScheduledWateenAutomation وخلو كود العميل من أي مفاتيح سرية',
  async () => {
    const fnIndexSrc = fs.readFileSync('firebase/functions/index.js', 'utf8');
    assert.match(fnIndexSrc, /onSchedule\(/);
    assert.match(fnIndexSrc, /exports\.runScheduledWateenAutomation\s*=\s*onSchedule/);
    assert.match(fnIndexSrc, /executeScheduledWateenCycle/);

    // Verify no hardcoded OpenAI/Gemini API keys anywhere under src/
    const srcFiles = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js)$/.test(entry.name)) srcFiles.push(full);
      }
    }
    walk('src');
    for (const f of srcFiles) {
      const content = fs.readFileSync(f, 'utf8');
      assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(content), `Potential OpenAI key leaked in ${f}`);
      assert.ok(!/AIzaSy[A-Za-z0-9_-]{25,}/.test(content), `Potential Google API key leaked in ${f}`);
    }
  }
);

// ---------------------------------------------------------------------------
// Test 7: Merge Preservation + Phase 8 Verified Backup Snapshot
// ---------------------------------------------------------------------------
await runTest(
  7,
  'حفظ تنبيهات الأتمتة وإعدادات الميزانية في الدمج السحابي وحفظ النسخة الاحتياطية للمرحلة الثامنة',
  async () => {
    const merged = storageMod.mergeStatesWithoutDuplication(
      {
        ...baseState,
        automationAlerts: [
          {
            id: 'al-local-1',
            severity: 'warning',
            title: 'تنبيه محلي',
            message: 'رسالة اختبارية',
            createdAt: '2026-11-19T03:00:00Z',
          },
        ],
      },
      {
        ...baseState,
        lastSyncSuccessAt: '2026-11-19T03:10:00Z',
        automationAlerts: [
          {
            id: 'al-cloud-1',
            severity: 'error',
            title: 'تنبيه سحابي',
            message: 'تعذر مصدر خارجي',
            createdAt: '2026-11-19T03:05:00Z',
          },
        ],
      }
    );

    assert.equal(merged.automationAlerts?.length, 2);
    assert.equal(merged.lastSyncSuccessAt, '2026-11-19T03:10:00Z');

    const snapshot = {
      phase: 8,
      title: 'Scheduled Automation, Cache, Retries, Budget Caps & Offline Honesty Backup',
      createdAt: new Date().toISOString(),
      schemaVersion: migMod.CURRENT_SCHEMA_VERSION,
      automationSettingsDefaults: migMod.getDefaultAutomationSettings(),
      testsPassed: passed + 1,
    };
    fs.mkdirSync('backups', { recursive: true });
    fs.writeFileSync('backups/phase8-verified-backup.json', JSON.stringify(snapshot, null, 2), 'utf8');
    assert.ok(fs.existsSync('backups/phase8-verified-backup.json'));
  }
);

console.log('--------------------------------------------------------------------');
console.log(`ALL PHASE 8 TESTS PASSED: ${passed}/7 verified checks passed.`);
console.log('--------------------------------------------------------------------');
