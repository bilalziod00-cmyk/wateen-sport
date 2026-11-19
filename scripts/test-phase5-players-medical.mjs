import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

console.log('====================================================================');
console.log('  WATEEN SPORT AI - Phase 5 Verification (Players, Clubs & Medical) ');
console.log('====================================================================');

await build({
  entryPoints: [
    'src/services/playersAndMedicalService.ts',
    'src/services/schemaMigrationService.ts',
    'src/services/persistentStorageService.ts',
    'src/data/seedData.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['firebase/*'],
  outdir: 'node_modules/.cache/wateen-phase5-tests',
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

const pmMod = await import('../node_modules/.cache/wateen-phase5-tests/services/playersAndMedicalService.js');
const migMod = await import('../node_modules/.cache/wateen-phase5-tests/services/schemaMigrationService.js');
const storageMod = await import('../node_modules/.cache/wateen-phase5-tests/services/persistentStorageService.js');
const seedMod = await import('../node_modules/.cache/wateen-phase5-tests/data/seedData.js');

let passed = 0;
async function runTest(num, title, fn) {
  await fn();
  passed++;
  console.log(`✓ [Phase 5 Test ${num}/6] PASSED: ${title}`);
}

// ---------------------------------------------------------------------------
// Test 1: Missing Player Stats Render "غير متوفر" (Zero Fabricated Numbers)
// ---------------------------------------------------------------------------
await runTest(
  1,
  'إظهار "غير متوفر" بدقة عند غياب الإحصائيات (الدقائق، البطاقات، التقييم، رقم القميص، التصديات) دون اختلاق أرقام',
  async () => {
    assert.equal(pmMod.formatStatOrUnavailable(null), 'غير متوفر');
    assert.equal(pmMod.formatStatOrUnavailable(undefined), 'غير متوفر');
    assert.equal(pmMod.formatStatOrUnavailable(''), 'غير متوفر');
    assert.equal(pmMod.formatStatOrUnavailable(NaN), 'غير متوفر');
    assert.equal(pmMod.formatStatOrUnavailable(0), '0', 'الصفر الحقيقي يظهر 0 وليس غير متوفر');
    assert.equal(pmMod.formatStatOrUnavailable(90, ' د'), '90 د');

    const profile = pmMod.buildPlayerProfileSummary({
      scorer: {
        id: 'pl_test_1',
        competitionId: 'pro_league',
        playerName: 'مهند أبو طه',
        teamName: 'الوحدات',
        teamColor: '#10B981',
        goals: 7,
        assists: 4,
        matches: 12,
        minutesPlayed: null,
        yellowCards: null,
        redCards: null,
        rating: null,
      },
      standings: [],
      injuries: [],
    });

    assert.equal(profile.goalsText, '7');
    assert.equal(profile.minutesPlayedText, 'غير متوفر');
    assert.equal(profile.yellowCardsText, 'غير متوفر');
    assert.equal(profile.redCardsText, 'غير متوفر');
    assert.equal(profile.ratingText, 'غير متوفر');
    assert.equal(profile.shirtNumberText, 'غير متوفر');
    assert.equal(profile.positionText, 'غير متوفر');
  }
);

// ---------------------------------------------------------------------------
// Test 2: Strict Medical Attribution Guard (No Diagnosis Without Official Source)
// ---------------------------------------------------------------------------
await runTest(
  2,
  'حماية القسم الطبي: منع نشر أي تشخيص أو إصابة غير منسوبة لمصدر رسمي، وتعيين مدة الغياب "غير محدد رسمياً" عند عدم ذكرها',
  async () => {
    // 1) رفض بدون اسم مصدر
    const noSourceRes = pmMod.validateAndBuildInjuryReport({
      playerName: 'يزن النعيمات',
      teamName: 'المنتخب الوطني',
      competitionId: 'national_teams',
      declaredInjury: 'كدمة في الركبة',
      announcedDate: '2026-11-19',
      declaredAbsenceDuration: '',
      returnStatus: 'injured',
      sourceName: '',
      isVerifiedOfficial: false,
    });
    assert.equal(noSourceRes.ok, false);

    // 2) رفض مصدر غير رسمي بدون رابط رسمي
    const unverifiedRes = pmMod.validateAndBuildInjuryReport({
      playerName: 'يزن النعيمات',
      teamName: 'المنتخب الوطني',
      competitionId: 'national_teams',
      declaredInjury: 'كدمة في الركبة',
      announcedDate: '2026-11-19',
      declaredAbsenceDuration: '',
      returnStatus: 'injured',
      sourceName: 'منشور غير رسمي',
      sourceUrl: '',
      isVerifiedOfficial: false,
    });
    assert.equal(unverifiedRes.ok, false);

    // 3) قبول تقرير موثق بمصدر رسمي مع ضبط مدة الغياب الفارغة إلى "غير محدد رسمياً"
    const officialRes = pmMod.validateAndBuildInjuryReport({
      playerName: 'يزن النعيمات',
      teamName: 'الحسين إربد',
      competitionId: 'pro_league',
      declaredInjury: 'شد في العضلة الضامة وفق الفحوصات الرسمية',
      announcedDate: '2026-11-19',
      declaredAbsenceDuration: '',
      returnStatus: 'rehab',
      sourceName: 'بيان نادي الحسين إربد الرسمي',
      sourceUrl: 'https://www.jfa.jo/medical/123',
      isVerifiedOfficial: true,
    });
    assert.equal(officialRes.ok, true);
    assert.equal(officialRes.record.declaredAbsenceDuration, 'غير محدد رسمياً');
    assert.equal(officialRes.record.isVerifiedOfficial, true);
    assert.ok(officialRes.record.id.startsWith('inj_'));
  }
);

// ---------------------------------------------------------------------------
// Test 3: Complete Team Profile Aggregation + Player Medical Linkage
// ---------------------------------------------------------------------------
await runTest(
  3,
  'بناء ملف النادي الشامل (المدينة، الملعب، المدرب، الترتيب، التشكيلة، المباريات، والإصابات) دون اختلاق',
  async () => {
    const injuryOut = pmMod.validateAndBuildInjuryReport({
      playerName: 'إبراهيم صبرة',
      teamName: 'الوحدات',
      competitionId: 'pro_league',
      declaredInjury: 'التواء خفيف في الكاحل',
      announcedDate: '2026-11-18',
      declaredAbsenceDuration: 'أسبوع واحد',
      returnStatus: 'light_training',
      sourceName: 'المركز الإعلامي لنادي الوحدات',
      isVerifiedOfficial: true,
    });
    assert.equal(injuryOut.ok, true);

    const teamProfile = pmMod.buildTeamProfileSummary({
      team: {
        id: 'tm-wehdat',
        name: 'الوحدات',
        shortName: 'الوحدات',
        color: '#10B981',
        competitionId: 'pro_league',
        city: 'عمّان',
        aliases: ['نادي الوحدات'],
      },
      matches: seedMod.INITIAL_SEED_DATA.matches,
      standings: seedMod.INITIAL_SEED_DATA.standings,
      scorers: seedMod.INITIAL_SEED_DATA.scorers,
      goalkeepers: seedMod.INITIAL_SEED_DATA.goalkeepers || [],
      injuries: [injuryOut.record],
    });

    assert.equal(teamProfile.cityText, 'عمّان');
    assert.equal(teamProfile.stadiumText, 'غير متوفر', 'الملعب غير المحدد يعرض "غير متوفر"');
    assert.equal(teamProfile.coachText, 'غير متوفر', 'المدرب غير المحدد يعرض "غير متوفر"');
    assert.equal(teamProfile.activeInjuries.length, 1);

    // التأكد من ربط الإصابة بملف اللاعب
    const playerWithInjury = pmMod.buildPlayerProfileSummary({
      scorer: {
        id: 'sc_sabra',
        competitionId: 'pro_league',
        playerName: 'إبراهيم صبرة',
        teamName: 'الوحدات',
        teamColor: '#10B981',
        goals: 9,
        assists: 2,
        matches: 14,
      },
      standings: seedMod.INITIAL_SEED_DATA.standings,
      injuries: [injuryOut.record],
    });
    assert.ok(playerWithInjury.activeInjury);
    assert.equal(playerWithInjury.activeInjury.returnStatus, 'light_training');
  }
);

// ---------------------------------------------------------------------------
// Test 4: Goalkeeper Profile Stats Handling
// ---------------------------------------------------------------------------
await runTest(
  4,
  'ملف حارس المرمى يعرض الشباك النظيفة والأهداف المستقبلة بدقة و"غير متوفر" للتصديات غير المسجلة',
  async () => {
    const gkProfile = pmMod.buildPlayerProfileSummary({
      goalkeeper: {
        id: 'gk_1',
        competitionId: 'pro_league',
        playerName: 'يزيد أبو ليلى',
        teamName: 'الحسين إربد',
        teamColor: '#FACC15',
        matches: 15,
        cleanSheets: 10,
        goalsConceded: 7,
        saves: null,
      },
      standings: [],
      injuries: [],
    });
    assert.equal(gkProfile.role, 'goalkeeper');
    assert.equal(gkProfile.cleanSheetsText, '10');
    assert.equal(gkProfile.goalsConcededText, '7');
    assert.equal(gkProfile.savesText, 'غير متوفر');
  }
);

// ---------------------------------------------------------------------------
// Test 5: UI Routing Integration Verification
// ---------------------------------------------------------------------------
await runTest(
  5,
  'التحقق من ربط صفحتي اللاعبين والأندية والقسم الطبي في التنقل الرئيسي ولوحة التحكم',
  async () => {
    const appCode = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
    const adminCode = fs.readFileSync(path.resolve('src/pages/AdminDashboardPage.tsx'), 'utf8');
    assert.ok(appCode.includes('PlayersAndTeamsPage'));
    assert.ok(appCode.includes('clubs_medical'));
    assert.ok(adminCode.includes('AdminPlayersInjuriesManager'));
    assert.ok(adminCode.includes('players_medical'));
  }
);

// ---------------------------------------------------------------------------
// Test 6: Save Verified Phase 5 Backup Snapshot
// ---------------------------------------------------------------------------
await runTest(
  6,
  'حفظ نسخة احتياطية موثقة للمرحلة الخامسة في backups/phase5-verified-backup.json',
  async () => {
    const freshState = migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state;
    const snap = storageMod.createPreMigrationBackupSnapshot(freshState);
    const backupsDir = path.resolve('backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const p5Path = path.join(backupsDir, 'phase5-verified-backup.json');
    fs.writeFileSync(p5Path, JSON.stringify(snap, null, 2), 'utf8');
    assert.ok(fs.existsSync(p5Path));
  }
);

console.log('====================================================================');
console.log(`ALL ${passed}/6 PHASE 5 PLAYERS, CLUBS & MEDICAL NEWS TESTS PASSED!`);
console.log('====================================================================');
