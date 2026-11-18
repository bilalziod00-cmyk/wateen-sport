import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

console.log('====================================================================');
console.log('  WATEEN SPORT AI - Phase 4 Verification (Match Intel & History)    ');
console.log('====================================================================');

await build({
  entryPoints: [
    'src/services/matchIntelligenceService.ts',
    'src/services/schemaMigrationService.ts',
    'src/services/persistentStorageService.ts',
    'src/utils/sportsMathEngine.ts',
    'src/data/seedData.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['firebase/*'],
  outdir: 'node_modules/.cache/wateen-phase4-tests',
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

const miMod = await import('../node_modules/.cache/wateen-phase4-tests/services/matchIntelligenceService.js');
const migMod = await import('../node_modules/.cache/wateen-phase4-tests/services/schemaMigrationService.js');
const storageMod = await import('../node_modules/.cache/wateen-phase4-tests/services/persistentStorageService.js');
const mathMod = await import('../node_modules/.cache/wateen-phase4-tests/utils/sportsMathEngine.js');
const seedMod = await import('../node_modules/.cache/wateen-phase4-tests/data/seedData.js');

let passed = 0;
async function runTest(num, title, fn) {
  await fn();
  passed++;
  console.log(`✓ [Phase 4 Test ${num}/6] PASSED: ${title}`);
}

// ---------------------------------------------------------------------------
// Test 1: External Feed Status Mapping (All 8 Statuses) & Honest Event Handling
// ---------------------------------------------------------------------------
await runTest(
  1,
  'تحويل أكواد المزودين الرسميين لجميع حالات المباراة الثمانية دون اختلاق أحداث غير موجودة',
  async () => {
    assert.equal(miMod.mapExternalStatusCodeToWateenStatus('NS'), 'upcoming');
    assert.equal(miMod.mapExternalStatusCodeToWateenStatus('1H'), 'first_half');
    assert.equal(miMod.mapExternalStatusCodeToWateenStatus('HT'), 'halftime');
    assert.equal(miMod.mapExternalStatusCodeToWateenStatus('2H'), 'second_half');
    assert.equal(miMod.mapExternalStatusCodeToWateenStatus('LIVE'), 'live');
    assert.equal(miMod.mapExternalStatusCodeToWateenStatus('FT'), 'finished');
    assert.equal(miMod.mapExternalStatusCodeToWateenStatus('PST'), 'postponed');
    assert.equal(miMod.mapExternalStatusCodeToWateenStatus('CANC'), 'cancelled');

    const normalizedLiveNoEvents = miMod.normalizeExternalMatchApiPayload({
      competitionId: 'pro_league',
      round: 'الأسبوع 16',
      homeTeam: 'الفيصلي',
      awayTeam: 'الحسين إربد',
      homeScore: 1,
      awayScore: 0,
      statusCode: '1H',
      liveMinute: 34,
      kickoffIso: '2026-11-19T16:00:00.000Z',
      stadium: 'ستاد عمّان الدولي',
    });
    assert.equal(normalizedLiveNoEvents.status, 'first_half');
    assert.equal(normalizedLiveNoEvents.liveMinute, 34);
    assert.equal(normalizedLiveNoEvents.events.length, 0, 'لا يجوز اختلاق أحداث غير مزودة من المصدر');
    assert.equal(normalizedLiveNoEvents.isDemo, false);
  }
);

// ---------------------------------------------------------------------------
// Test 2: Chronological Match Events Recording + Duplicate Event Guard + Score Sync
// ---------------------------------------------------------------------------
await runTest(
  2,
  'تسجيل أحداث المباراة (هدف، بطاقة، تبديل) بترتيب زمني مع تحديث النتيجة ومنع التكرار ورفض اللاعب الفارغ',
  async () => {
    let match = miMod.normalizeExternalMatchApiPayload({
      competitionId: 'pro_league',
      round: 'الأسبوع 16',
      homeTeam: 'الوحدات',
      awayTeam: 'الرمثا',
      homeScore: 0,
      awayScore: 0,
      statusCode: '2H',
      liveMinute: 60,
      kickoffIso: '2026-11-19T16:00:00.000Z',
    });

    // 1) رفض اسم لاعب فارغ
    const emptyRes = miMod.appendMatchEventSafely(match, {
      minute: 12,
      team: 'home',
      type: 'goal',
      playerName: '   ',
    });
    assert.equal(emptyRes.added, false);

    // 2) إضافة هدف في الدقيقة 68 ثم بطاقة صفراء في الدقيقة 22 -> الترتيب الزمني 22 ثم 68
    const goalRes = miMod.appendMatchEventSafely(
      match,
      { minute: 68, team: 'home', type: 'goal', playerName: 'إبراهيم صبرة' },
      true
    );
    assert.equal(goalRes.added, true);
    assert.equal(goalRes.match.homeScore, 1);
    assert.equal(goalRes.match.liveMinute, 68);
    match = goalRes.match;

    const cardRes = miMod.appendMatchEventSafely(
      match,
      { minute: 22, team: 'away', type: 'yellow_card', playerName: 'حمزة الدردور' },
      true
    );
    assert.equal(cardRes.added, true);
    assert.equal(cardRes.match.events[0].minute, 22);
    assert.equal(cardRes.match.events[1].minute, 68);
    match = cardRes.match;

    // 3) منع تكرار نفس الحدث في نفس الدقيقة واللاعب
    const dupRes = miMod.appendMatchEventSafely(
      match,
      { minute: 68, team: 'home', type: 'goal', playerName: 'إبراهيم صبرة' },
      true
    );
    assert.equal(dupRes.added, false);
    assert.equal(match.homeScore, 1);
  }
);

// ---------------------------------------------------------------------------
// Test 3: Mandatory Reason Guard for Manual Standings Adjustment & Deductions
// ---------------------------------------------------------------------------
await runTest(
  3,
  'إلزام المدير بإدخال سبب التعديل اليدوي أو خصم النقاط وعدم السماح بالحفظ بدون سبب',
  async () => {
    const prevRow = {
      id: 'st_team_a',
      competitionId: 'pro_league',
      teamName: 'الفيصلي',
      shortName: 'الفيصلي',
      teamColor: '#0EA5E9',
      played: 10,
      won: 6,
      drawn: 2,
      lost: 2,
      goalsFor: 18,
      goalsAgainst: 8,
      points: 20,
      form: ['W', 'W'],
    };

    // 1) تغيير يدوي بدون سبب -> مرفوض
    const badRes = miMod.validateManualStandingAdjustment({
      isEditingExisting: true,
      previousRow: prevRow,
      nextRow: { ...prevRow, points: 17, pointsDeducted: 3, manualAdjustmentReason: '' },
    });
    assert.equal(badRes.ok, false);

    // 2) نفس الأرقام دون تعديل يدوي لا يحتاج سبباً إضافياً
    const unchangedRes = miMod.validateManualStandingAdjustment({
      isEditingExisting: true,
      previousRow: prevRow,
      nextRow: { ...prevRow },
    });
    assert.equal(unchangedRes.ok, true);

    // 3) خصم نقاط مع سبب واضح -> مقبول
    const validRes = miMod.validateManualStandingAdjustment({
      isEditingExisting: true,
      previousRow: prevRow,
      nextRow: {
        ...prevRow,
        points: 17,
        pointsDeducted: 3,
        manualAdjustmentReason: 'قرار لجنة الانضباط في الاتحاد الأردني بخصم 3 نقاط',
      },
    });
    assert.equal(validRes.ok, true);
  }
);

// ---------------------------------------------------------------------------
// Test 4: Standings History Timeline + Team Rank Movement Deltas (▲ / ▼)
// ---------------------------------------------------------------------------
await runTest(
  4,
  'تسجيل السجل التاريخي للترتيب (standingsHistory) وحساب حركة المراكز (صعود ▲ وهبوط ▼) بدقة',
  async () => {
    const rowsRound1 = mathMod.sortStandingsByCompetitionRules(
      [
        {
          id: 'st_1',
          competitionId: 'first_div',
          teamName: 'العربي إربد',
          shortName: 'العربي',
          teamColor: '#10B981',
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          goalsFor: 2,
          goalsAgainst: 0,
          points: 3,
          form: ['W'],
        },
        {
          id: 'st_2',
          competitionId: 'first_div',
          teamName: 'اليرموك',
          shortName: 'اليرموك',
          teamColor: '#38BDF8',
          played: 1,
          won: 0,
          drawn: 1,
          lost: 0,
          goalsFor: 1,
          goalsAgainst: 1,
          points: 1,
          form: ['D'],
        },
      ],
      []
    );

    const hist1 = miMod.createStandingsHistoryEntry({
      competitionId: 'first_div',
      round: 'الجولة 1',
      triggerType: 'match_result',
      reason: 'نهاية الجولة 1',
      actor: 'نظام الترتيب الآلي',
      sortedCompRows: rowsRound1,
    });

    const rowsRound2 = mathMod.sortStandingsByCompetitionRules(
      [
        { ...rowsRound1[0], played: 2, lost: 1, points: 3, goalsAgainst: 3 },
        { ...rowsRound1[1], played: 2, won: 1, drawn: 1, points: 4, goalsFor: 4 },
      ],
      []
    );

    const hist2 = miMod.createStandingsHistoryEntry({
      competitionId: 'first_div',
      round: 'الجولة 2',
      triggerType: 'match_result',
      reason: 'فوز اليرموك وتصدره الترتيب',
      actor: 'نظام الترتيب الآلي',
      sortedCompRows: rowsRound2,
    });

    // السجل الأحدث في البداية [hist2, hist1]
    const deltas = miMod.computeTeamRankDeltas(rowsRound2, [hist2, hist1], 'first_div');
    assert.equal(deltas['اليرموك'], 1, 'اليرموك صعد من المركز 2 إلى 1 (+1)');
    assert.equal(deltas['العربي إربد'], -1, 'العربي إربد تراجع من المركز 1 إلى 2 (-1)');
  }
);

// ---------------------------------------------------------------------------
// Test 5: Standings Table & Admin Standings UI Integration Verification
// ---------------------------------------------------------------------------
await runTest(
  5,
  'التحقق من تكامل مؤشرات الحركة وأسباب التعديل اليدوي في المكونات البرمجية',
  async () => {
    const tableCode = fs.readFileSync(path.resolve('src/components/StandingsTable.tsx'), 'utf8');
    const adminStandingCode = fs.readFileSync(
      path.resolve('src/pages/admin/AdminStandingsManager.tsx'),
      'utf8'
    );
    const matchesMgrCode = fs.readFileSync(
      path.resolve('src/pages/admin/AdminMatchesManager.tsx'),
      'utf8'
    );
    assert.ok(tableCode.includes('rankDeltas'), 'StandingsTable يجب أن يدعم rankDeltas');
    assert.ok(
      adminStandingCode.includes('manualAdjustmentReason'),
      'AdminStandingsManager يجب أن يتضمن حقل سبب التعديل اليدوي'
    );
    assert.ok(
      adminStandingCode.includes('السجل التاريخي'),
      'AdminStandingsManager يجب أن يعرض تبويب السجل التاريخي'
    );
    assert.ok(
      matchesMgrCode.includes('recordMatchEvent'),
      'AdminMatchesManager يجب أن يدعم تسجيل الأحداث السريع'
    );
  }
);

// ---------------------------------------------------------------------------
// Test 6: Save Verified Phase 4 Backup Snapshot
// ---------------------------------------------------------------------------
await runTest(
  6,
  'حفظ نسخة احتياطية موثقة للمرحلة الرابعة في backups/phase4-verified-backup.json',
  async () => {
    const freshState = migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state;
    const snap = storageMod.createPreMigrationBackupSnapshot(freshState);
    const backupsDir = path.resolve('backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const p4Path = path.join(backupsDir, 'phase4-verified-backup.json');
    fs.writeFileSync(p4Path, JSON.stringify(snap, null, 2), 'utf8');
    assert.ok(fs.existsSync(p4Path));
  }
);

console.log('====================================================================');
console.log(`ALL ${passed}/6 PHASE 4 MATCH INTELLIGENCE & STANDINGS HISTORY PASSED!`);
console.log('====================================================================');
