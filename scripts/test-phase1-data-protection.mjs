import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

console.log('====================================================================');
console.log('  WATEEN SPORT AI - Phase 1 Verification (Data Protection & Safety) ');
console.log('====================================================================');

await build({
  entryPoints: [
    'src/utils/deterministicIds.ts',
    'src/utils/matchStatus.ts',
    'src/utils/sportsMathEngine.ts',
    'src/services/schemaMigrationService.ts',
    'src/services/persistentStorageService.ts',
    'src/components/StandingsTable.tsx',
    'src/data/seedData.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'lucide-react', 'firebase/*'],
  outdir: 'node_modules/.cache/wateen-phase1-tests',
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

const idsMod = await import('../node_modules/.cache/wateen-phase1-tests/utils/deterministicIds.js');
const statusMod = await import('../node_modules/.cache/wateen-phase1-tests/utils/matchStatus.js');
const mathMod = await import('../node_modules/.cache/wateen-phase1-tests/utils/sportsMathEngine.js');
const migMod = await import('../node_modules/.cache/wateen-phase1-tests/services/schemaMigrationService.js');
const storageMod = await import('../node_modules/.cache/wateen-phase1-tests/services/persistentStorageService.js');
const tableMod = await import('../node_modules/.cache/wateen-phase1-tests/components/StandingsTable.js');
const seedMod = await import('../node_modules/.cache/wateen-phase1-tests/data/seedData.js');

let passed = 0;
async function runTest(num, title, fn) {
  await fn();
  passed++;
  console.log(`✓ [Phase 1 Test ${num}/6] PASSED: ${title}`);
}

// ---------------------------------------------------------------------------
// Test 1: Safe APK Upgrade Migration (v1 -> v2) with Zero Data Loss
// ---------------------------------------------------------------------------
await runTest(
  1,
  'ترقية قاعدة بيانات قديمة (v1 -> v2) دون حذف أي بيانات للمستخدم ومع إضافة المعرفات العلائقية وسجل الترحيل',
  async () => {
    const legacyV1State = {
      // بدون schemaVersion لمحاكاة إصدار قديم قبل التحديث
      adminPin: '9876',
      updatedAt: '2026-10-01T10:00:00.000Z',
      articles: [
        {
          id: 'user-art-1',
          title: 'خبر محفوظ من المستخدم قبل التحديث',
          summary: 'ملخص الخبر',
          content: 'تفاصيل الخبر الحقيقي',
          competitionId: 'pro_league',
          tag: 'official',
          isBreaking: true,
          author: 'أبو بلال',
          publishedAt: '2026-10-01T09:00:00.000Z',
          views: 150,
          imageUrl: '',
        },
      ],
      matches: [
        {
          id: 'user-match-1',
          competitionId: 'pro_league',
          round: 'الأسبوع 14',
          homeTeam: 'الفيصلي',
          homeShort: 'الفيصلي',
          homeColor: '#0EA5E9',
          awayTeam: 'الوحدات',
          awayShort: 'الوحدات',
          awayColor: '#10B981',
          homeScore: 2,
          awayScore: 1,
          status: 'finished',
          kickoffIso: '2026-10-01T16:00:00.000Z',
          stadium: 'ستاد عمّان الدولي',
          events: [],
        },
      ],
      standings: [
        {
          id: 'user-st-1',
          competitionId: 'pro_league',
          teamName: 'الفيصلي',
          shortName: 'الفيصلي',
          teamColor: '#0EA5E9',
          played: 14,
          won: 10,
          drawn: 3,
          lost: 1,
          goalsFor: 28,
          goalsAgainst: 9,
          points: 33,
          form: ['W', 'W', 'D', 'W', 'W'],
        },
      ],
      scorers: [
        {
          id: 'user-sc-1',
          competitionId: 'pro_league',
          playerName: 'أحمد العرسان',
          teamName: 'الفيصلي',
          teamColor: '#0EA5E9',
          goals: 11,
          assists: 5,
          matches: 14,
        },
      ],
      banners: [],
      cards: [],
      notifications: [],
      customCompetitions: [
        {
          id: 'custom-cup-1',
          name: 'بطولة خماسي عمّان',
          shortName: 'خماسي عمّان',
          category: 'cup',
          season: '2026/2027',
          createdAt: '2026-10-01T08:00:00.000Z',
        },
      ],
    };

    const res = migMod.migrateAppStateSafely(legacyV1State, seedMod.INITIAL_SEED_DATA);
    assert.equal(res.didMigrate, true);
    assert.equal(res.fromVersion, 1);
    assert.equal(res.toVersion, migMod.CURRENT_SCHEMA_VERSION);
    assert.equal(res.state.schemaVersion, 2);

    // التأكد من بقاء كافة سجلات المستخدم 100%
    assert.equal(res.state.adminPin, '9876');
    assert.equal(res.state.articles.length, 1);
    assert.equal(res.state.articles[0].id, 'user-art-1');
    assert.equal(res.state.matches.length, 1);
    assert.equal(res.state.matches[0].id, 'user-match-1');
    assert.equal(res.state.matches[0].homeTeamId, idsMod.generateDeterministicTeamId('الفيصلي'));
    assert.equal(res.state.matches[0].awayTeamId, idsMod.generateDeterministicTeamId('الوحدات'));
    assert.equal(res.state.standings.length, 1);
    assert.equal(res.state.standings[0].teamId, idsMod.generateDeterministicTeamId('الفيصلي'));
    assert.equal(res.state.scorers[0].teamId, idsMod.generateDeterministicTeamId('الفيصلي'));
    assert.equal(res.state.customCompetitions.length, 1);
    assert.ok(Array.isArray(res.state.newsSources) && res.state.newsSources.length >= 6);
    assert.ok(res.state.automationSettings && res.state.automationSettings.aiProvider === 'openai');
    assert.ok(res.state.auditLogs.some((a) => a.action === 'SCHEMA_MIGRATION_COMPLETED'));

    // إعادة الترحيل يجب أن تكون Idempotent بدون تكرار
    const secondRes = migMod.migrateAppStateSafely(res.state, seedMod.INITIAL_SEED_DATA);
    assert.equal(secondRes.didMigrate, false);
    assert.equal(
      secondRes.state.auditLogs.filter((a) => a.action === 'SCHEMA_MIGRATION_COMPLETED').length,
      1
    );
  }
);

// ---------------------------------------------------------------------------
// Test 2: Deterministic IDs & Zero Duplicates on Re-Import / Merge
// ---------------------------------------------------------------------------
await runTest(
  2,
  'توليد معرفات ثابتة (Deterministic IDs) متطابقة رغم اختلاف الهمزات/كلمة نادي ومنع التكرار عند الدمج',
  async () => {
    const t1 = idsMod.generateDeterministicTeamId('نادي الوحدات');
    const t2 = idsMod.generateDeterministicTeamId('الوحدات');
    assert.equal(t1, t2);
    assert.ok(t1.startsWith('tm_'));

    const t3 = idsMod.generateDeterministicTeamId('الأهلي');
    const t4 = idsMod.generateDeterministicTeamId('الاهلي');
    assert.equal(t3, t4);

    const m1 = idsMod.generateDeterministicMatchId({
      competitionId: 'pro_league',
      season: '2026/2027',
      round: 'الأسبوع 15',
      homeTeam: 'الحسين إربد',
      awayTeam: 'نادي الفيصلي',
    });
    const m2 = idsMod.generateDeterministicMatchId({
      competitionId: 'pro_league',
      season: '2026/2027',
      round: 'الاسبوع 15',
      homeTeam: 'الحسين اربد',
      awayTeam: 'الفيصلي',
    });
    assert.equal(m1, m2);
    assert.ok(m1.startsWith('match_'));

    const s1 = idsMod.generateDeterministicStandingId({
      competitionId: 'first_div',
      season: '2026/2027',
      groupName: 'الدوري العام',
      teamName: 'الكرمل',
    });
    const s2 = idsMod.generateDeterministicStandingId({
      competitionId: 'first_div',
      season: '2026/2027',
      groupName: 'الدوري العام',
      teamName: 'نادي الكرمل',
    });
    assert.equal(s1, s2);

    const n1 = idsMod.generateDeterministicNewsId({
      sourceUrl: 'https://www.jfa.jo/news/123/',
      originalTitle: 'خبر رسمي',
    });
    const n2 = idsMod.generateDeterministicNewsId({
      sourceUrl: 'https://www.jfa.jo/news/123',
      originalTitle: 'خبر رسمي معدل',
    });
    assert.equal(n1, n2);

    // اختبار الدمج بدون تكرار مع حفظ حقول v2 الجديدة
    const baseState = migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state;
    const sampleMatch = {
      id: m1,
      competitionId: 'pro_league',
      round: 'الأسبوع 15',
      homeTeam: 'الحسين إربد',
      homeShort: 'الحسين',
      homeColor: '#F59E0B',
      awayTeam: 'الفيصلي',
      awayShort: 'الفيصلي',
      awayColor: '#0EA5E9',
      homeScore: 1,
      awayScore: 1,
      status: 'finished',
      kickoffIso: '2026-11-18T17:00:00.000Z',
      stadium: 'ستاد الحسن',
      events: [],
      isDemo: false,
    };
    const localWithMatch = {
      ...baseState,
      matches: [sampleMatch],
      injuries: [
        {
          id: idsMod.generateDeterministicInjuryId({
            playerName: 'يزن النعيمات',
            teamName: 'النشامى',
            announcedDate: '2026-11-18',
          }),
          playerName: 'يزن النعيمات',
          teamName: 'النشامى',
          status: 'doubtful',
          sourceName: 'الاتحاد الأردني',
          updatedAt: '2026-11-18T12:00:00.000Z',
          isOfficialSource: true,
        },
      ],
    };
    const cloudSameMatch = {
      ...baseState,
      matches: [{ ...sampleMatch, homeScore: 2 }],
      injuries: [...localWithMatch.injuries],
    };
    const merged = storageMod.mergeStatesWithoutDuplication(localWithMatch, cloudSameMatch);
    assert.equal(merged.matches.length, 1, 'يجب منع تكرار المباراة ذات المعرف الثابت');
    assert.equal(merged.matches[0].homeScore, 2, 'يجب تحديث السجل بأحدث قيمة');
    assert.equal(merged.injuries.length, 1, 'يجب الحفاظ على سجل الإصابات بدون تكرار');
    assert.equal(merged.schemaVersion, 2);
  }
);

// ---------------------------------------------------------------------------
// Test 3: StandingsTable preserves Head-to-Head tie-breaker position
// ---------------------------------------------------------------------------
await runTest(
  3,
  'إصلاح تعارض ترتيب StandingsTable بحيث يحترم المواجهات المباشرة (Head-to-Head) بدل تجاوزها بفارق الأهداف',
  async () => {
    const finishedMatches = [
      {
        id: 'h2h-m1',
        competitionId: 'pro_league',
        round: 'الجولة 5',
        homeTeam: 'الرمثا',
        homeShort: 'الرمثا',
        homeColor: '#0EA5E9',
        awayTeam: 'السلط',
        awayShort: 'السلط',
        awayColor: '#10B981',
        homeScore: 2,
        awayScore: 0,
        status: 'finished',
        kickoffIso: '2026-11-01T15:00:00.000Z',
        stadium: 'ستاد الحسن',
        events: [],
      },
    ];

    const rawRows = [
      {
        id: 'st-salt',
        competitionId: 'pro_league',
        teamName: 'السلط',
        shortName: 'السلط',
        teamColor: '#10B981',
        played: 10,
        won: 6,
        drawn: 2,
        lost: 2,
        goalsFor: 20,
        goalsAgainst: 8, // فارق أهداف +12 أعلى من الرمثا!
        points: 20,
        form: ['W', 'W'],
      },
      {
        id: 'st-ramtha',
        competitionId: 'pro_league',
        teamName: 'الرمثا',
        shortName: 'الرمثا',
        teamColor: '#0EA5E9',
        played: 10,
        won: 6,
        drawn: 2,
        lost: 2,
        goalsFor: 12,
        goalsAgainst: 9, // فارق أهداف +3 أقل من السلط لكنه فاز بالمواجهة المباشرة 2-0
        points: 20,
        form: ['W', 'D'],
      },
    ];

    const engineSorted = mathMod.sortStandingsByCompetitionRules(rawRows, finishedMatches);
    assert.equal(engineSorted[0].teamName, 'الرمثا');
    assert.equal(engineSorted[0].position, 1);
    assert.equal(engineSorted[1].teamName, 'السلط');
    assert.equal(engineSorted[1].position, 2);

    // نمرر الصفوف معكوسة إلى StandingsTable.sortStandings للتحقق من عدم كسر المواجهات المباشرة
    const uiSorted = tableMod.sortStandings([engineSorted[1], engineSorted[0]]);
    assert.equal(uiSorted[0].teamName, 'الرمثا', 'الرمثا يجب أن يبقى أولاً بالمواجهات المباشرة');
    assert.equal(uiSorted[1].teamName, 'السلط');
  }
);

// ---------------------------------------------------------------------------
// Test 4: All 8 MatchStatus states handled accurately
// ---------------------------------------------------------------------------
await runTest(
  4,
  'دعم جميع حالات المباراة الثمانية (لم تبدأ، الشوط الأول، استراحة، الشوط الثاني، مباشر، انتهت، مؤجلة، ملغاة)',
  async () => {
    const allStatuses = [
      'upcoming',
      'live',
      'first_half',
      'halftime',
      'second_half',
      'finished',
      'postponed',
      'cancelled',
    ];
    for (const st of allStatuses) {
      assert.equal(typeof statusMod.MATCH_STATUS_SORT_WEIGHT[st], 'number');
      assert.ok(statusMod.getMatchStatusArabicLabel(st, 35).length > 0);
      assert.ok(statusMod.getMatchStatusShortBadge(st, 35).length > 0);
    }
    assert.equal(statusMod.isLiveMatchStatus('first_half'), true);
    assert.equal(statusMod.isLiveMatchStatus('halftime'), true);
    assert.equal(statusMod.isLiveMatchStatus('second_half'), true);
    assert.equal(statusMod.isLiveMatchStatus('live'), true);
    assert.equal(statusMod.isLiveMatchStatus('upcoming'), false);
    assert.equal(statusMod.isLiveMatchStatus('finished'), false);
    assert.equal(statusMod.getMatchStatusArabicLabel('halftime'), 'استراحة بين الشوطين');
    assert.equal(statusMod.getMatchStatusArabicLabel('first_half', 27), "الشوط الأول 27'");
  }
);

// ---------------------------------------------------------------------------
// Test 5: Demo tagging vs Real approved match standings generation
// ---------------------------------------------------------------------------
await runTest(
  5,
  'تمييز البيانات الأولية للعرض بـ isDemo: true وعدم خلطها مع نتائج المباريات الحقيقية المعتمدة',
  async () => {
    const fresh = migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state;
    assert.ok(fresh.articles.every((a) => a.isDemo === true));
    assert.ok(fresh.matches.every((m) => m.isDemo === true));
    assert.ok(fresh.standings.every((s) => s.isDemo === true));

    const realMatch = {
      id: idsMod.generateDeterministicMatchId({
        competitionId: 'second_div',
        season: '2026/2027',
        round: 'الجولة 1',
        homeTeam: 'الكرمل',
        awayTeam: 'عجلون',
      }),
      competitionId: 'second_div',
      season: '2026/2027',
      round: 'الجولة 1',
      homeTeamId: idsMod.generateDeterministicTeamId('الكرمل'),
      awayTeamId: idsMod.generateDeterministicTeamId('عجلون'),
      homeTeam: 'الكرمل',
      homeShort: 'الكرمل',
      homeColor: '#10B981',
      awayTeam: 'عجلون',
      awayShort: 'عجلون',
      awayColor: '#38BDF8',
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      kickoffIso: '2026-11-18T14:00:00.000Z',
      stadium: 'ملعب الأمير هاشم',
      events: [],
      isApproved: true,
      isDemo: false,
    };

    const updatedStandings = mathMod.applyApprovedMatchResultToStandings(
      realMatch,
      null,
      [],
      [realMatch]
    );
    assert.equal(updatedStandings.length, 2);
    const karmel = updatedStandings.find((r) => r.teamName === 'الكرمل');
    assert.ok(karmel);
    assert.ok(karmel.id.startsWith('st_'), 'معرف صف الترتيب يجب أن يكون ثابتاً');
    assert.equal(karmel.teamId, idsMod.generateDeterministicTeamId('الكرمل'));
    assert.equal(karmel.points, 3);
    assert.equal(karmel.isDemo, false);
  }
);

// ---------------------------------------------------------------------------
// Test 6: Android applicationId guard + Save Verified Phase 1 Backup Snapshot
// ---------------------------------------------------------------------------
await runTest(
  6,
  'التحقق من ثبات applicationId ("com.wateensport.app") وحفظ نسخة احتياطية موثقة للمرحلة الأولى',
  async () => {
    const gradleContent = fs.readFileSync(path.resolve('android/app/build.gradle'), 'utf8');
    assert.ok(
      gradleContent.includes('applicationId "com.wateensport.app"'),
      'يجب الحفاظ على applicationId دون تغيير لحماية تحديثات APK'
    );

    const freshState = migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state;
    const snap = storageMod.createPreMigrationBackupSnapshot(freshState);
    const backupsDir = path.resolve('backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const phase1BackupPath = path.join(backupsDir, 'phase1-verified-backup.json');
    fs.writeFileSync(phase1BackupPath, JSON.stringify(snap, null, 2), 'utf8');
    assert.ok(fs.existsSync(phase1BackupPath));
    assert.equal(snap.state.schemaVersion, 2);
  }
);

console.log('====================================================================');
console.log(`ALL ${passed}/6 PHASE 1 DATA PROTECTION & UPGRADE TESTS PASSED!`);
console.log('====================================================================');
