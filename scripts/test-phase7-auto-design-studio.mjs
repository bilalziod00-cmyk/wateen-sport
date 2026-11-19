import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

console.log('====================================================================');
console.log('  WATEEN SPORT AI - Phase 7 Verification (11-Template Auto Studio)  ');
console.log('====================================================================');

await build({
  entryPoints: [
    'src/utils/cardCanvasExport.ts',
    'src/services/schemaMigrationService.ts',
    'src/services/persistentStorageService.ts',
    'src/data/seedData.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['firebase/*'],
  outdir: 'node_modules/.cache/wateen-phase7-tests',
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

const cardMod = await import('../node_modules/.cache/wateen-phase7-tests/utils/cardCanvasExport.js');
const migMod = await import('../node_modules/.cache/wateen-phase7-tests/services/schemaMigrationService.js');
const storageMod = await import('../node_modules/.cache/wateen-phase7-tests/services/persistentStorageService.js');
const seedMod = await import('../node_modules/.cache/wateen-phase7-tests/data/seedData.js');

const state = migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state;

let passed = 0;
async function runTest(num, title, fn) {
  await fn();
  passed++;
  console.log(`✓ [Phase 7 Test ${num}/5] PASSED: ${title}`);
}

// ---------------------------------------------------------------------------
// Test 1: All 11 Official Studio Templates Registered & Generate Clean Cards
// ---------------------------------------------------------------------------
await runTest(
  1,
  'توفر وتوليد جميع القوالب الـ 11 في استوديو التصاميم الرياضية من البيانات المعتمدة',
  async () => {
    assert.equal(cardMod.WATEEN_STUDIO_TEMPLATES_11.length, 11);

    const sampleMatch = state.matches[0];
    const sampleArticle = state.articles[0];
    const sampleInjury = {
      id: 'inj_studio_1',
      playerName: 'موسى التعمري',
      teamName: 'النشامى',
      competitionId: 'national_teams',
      declaredInjury: 'إجهاد عضلي خفيف',
      announcedDate: '2026-11-18',
      lastUpdatedAt: '2026-11-18T12:00:00.000Z',
      declaredAbsenceDuration: '4 أيام حسب التقرير الرسمي',
      returnStatus: 'light_training',
      sourceName: 'المركز الإعلامي للاتحاد الأردني',
      isVerifiedOfficial: true,
    };

    const generated = [];
    for (const tpl of cardMod.WATEEN_STUDIO_TEMPLATES_11) {
      const card = cardMod.buildAutoTemplateCardFromOfficialData({
        templateType: tpl.id,
        competitionId: 'pro_league',
        match: { ...sampleMatch, isApproved: true },
        standings: state.standings,
        roundMatches: state.matches.slice(0, 3),
        scorers: state.scorers,
        goalkeepers: state.goalkeepers || [],
        mvpPlayer: {
          playerName: state.scorers[0].playerName,
          teamName: state.scorers[0].teamName,
          goals: state.scorers[0].goals,
          assists: state.scorers[0].assists,
          rating: null, // غائب -> يجب أن يظهر غير متوفر
        },
        article: sampleArticle,
        injury: sampleInjury,
        lineupPlayers: ['يزيد أبو ليلى', 'إحسان حداد', 'يزن العرب'],
        lineupTeamName: 'الحسين إربد',
        sizePreset: 'instagram_portrait',
      });
      assert.ok(card, `فشل توليد القالب ${tpl.id}`);
      assert.equal(card.type, tpl.id);
      assert.equal(card.isApprovedSource, true);
      assert.equal(card.sizePreset, 'instagram_portrait');
      generated.push(card);
    }

    assert.equal(generated.length, 11);
    const mvpCard = generated.find((c) => c.type === 'mvp_player_card');
    assert.ok(mvpCard);
    assert.equal(
      mvpCard.metrics.find((m) => m.label === 'التقييم الرسمي')?.value,
      'غير متوفر',
      'يجب عدم اختلاق تقييم وهمي مثل 9.1 عند غياب التقييم'
    );
  }
);

// ---------------------------------------------------------------------------
// Test 2: Strictly Rejects Unapproved Matches, Rejected News & Unattributed Injuries
// ---------------------------------------------------------------------------
await runTest(
  2,
  'منع توليد تصاميم من مباريات غير معتمدة أو أخبار مرفوضة أو إصابات بدون مصدر رسمي',
  async () => {
    const unapprovedMatch = { ...state.matches[0], isApproved: false };
    assert.equal(
      cardMod.buildAutoTemplateCardFromOfficialData({
        templateType: 'result_card',
        competitionId: 'pro_league',
        match: unapprovedMatch,
      }),
      null
    );

    const rejectedArticle = { ...state.articles[0], verificationStatus: 'rejected' };
    assert.equal(
      cardMod.buildAutoTemplateCardFromOfficialData({
        templateType: 'breaking_news_card',
        competitionId: 'pro_league',
        article: rejectedArticle,
      }),
      null
    );

    const noSourceInjury = {
      id: 'inj_bad',
      playerName: 'لاعب',
      teamName: 'ناد',
      competitionId: 'pro_league',
      declaredInjury: 'إصابة',
      announcedDate: '2026-11-18',
      lastUpdatedAt: '2026-11-18T12:00:00.000Z',
      declaredAbsenceDuration: 'غير محدد رسمياً',
      returnStatus: 'injured',
      sourceName: '',
      isVerifiedOfficial: false,
    };
    assert.equal(
      cardMod.buildAutoTemplateCardFromOfficialData({
        templateType: 'injury_card',
        competitionId: 'pro_league',
        injury: noSourceInjury,
      }),
      null
    );
  }
);

// ---------------------------------------------------------------------------
// Test 3: Export Dimension Presets for Instagram & Facebook
// ---------------------------------------------------------------------------
await runTest(
  3,
  'دعم مقاسات التصدير الرسمية لإنستغرام (1080×1080 و 1080×1350) وفيسبوك (1200×630)',
  async () => {
    assert.equal(cardMod.EXPORT_SIZE_PRESETS.instagram_square.width, 1080);
    assert.equal(cardMod.EXPORT_SIZE_PRESETS.instagram_square.height, 1080);
    assert.equal(cardMod.EXPORT_SIZE_PRESETS.instagram_portrait.width, 1080);
    assert.equal(cardMod.EXPORT_SIZE_PRESETS.instagram_portrait.height, 1350);
    assert.equal(cardMod.EXPORT_SIZE_PRESETS.facebook_landscape.width, 1200);
    assert.equal(cardMod.EXPORT_SIZE_PRESETS.facebook_landscape.height, 630);
  }
);

// ---------------------------------------------------------------------------
// Test 4: Studio UI Editor Capabilities Verification
// ---------------------------------------------------------------------------
await runTest(
  4,
  'التحقق من وجود محرر النص والصور والخلفيات ومقاسات FB/IG داخل واجهة الاستوديو',
  async () => {
    const studioCode = fs.readFileSync(
      path.resolve('src/pages/admin/AdminAutoDesignStudio.tsx'),
      'utf8'
    );
    assert.ok(studioCode.includes('WATEEN_STUDIO_TEMPLATES_11'));
    assert.ok(studioCode.includes('EXPORT_SIZE_PRESETS'));
    assert.ok(studioCode.includes('solid_black'));
    assert.ok(studioCode.includes('handleUploadCustomBg'));
  }
);

// ---------------------------------------------------------------------------
// Test 5: Save Verified Phase 7 Backup Snapshot
// ---------------------------------------------------------------------------
await runTest(
  5,
  'حفظ نسخة احتياطية موثقة للمرحلة السابعة في backups/phase7-verified-backup.json',
  async () => {
    const snap = storageMod.createPreMigrationBackupSnapshot(state);
    const backupsDir = path.resolve('backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const p7Path = path.join(backupsDir, 'phase7-verified-backup.json');
    fs.writeFileSync(p7Path, JSON.stringify(snap, null, 2), 'utf8');
    assert.ok(fs.existsSync(p7Path));
  }
);

console.log('====================================================================');
console.log(`ALL ${passed}/5 PHASE 7 AUTO DESIGN STUDIO (11 TEMPLATES) TESTS PASSED!`);
console.log('====================================================================');
