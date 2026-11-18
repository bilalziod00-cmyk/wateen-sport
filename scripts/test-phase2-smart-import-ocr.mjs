import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

console.log('====================================================================');
console.log('  WATEEN SPORT AI - Phase 2 Verification (OCR, UTF-8, Confidence)   ');
console.log('====================================================================');

await build({
  entryPoints: [
    'src/utils/imageOcrPreprocess.ts',
    'src/utils/aiSmartImportEngine.ts',
    'src/services/schemaMigrationService.ts',
    'src/services/persistentStorageService.ts',
    'src/data/seedData.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['firebase/*'],
  outdir: 'node_modules/.cache/wateen-phase2-tests',
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

const ocrMod = await import('../node_modules/.cache/wateen-phase2-tests/utils/imageOcrPreprocess.js');
const importMod = await import('../node_modules/.cache/wateen-phase2-tests/utils/aiSmartImportEngine.js');
const migMod = await import('../node_modules/.cache/wateen-phase2-tests/services/schemaMigrationService.js');
const storageMod = await import('../node_modules/.cache/wateen-phase2-tests/services/persistentStorageService.js');
const seedMod = await import('../node_modules/.cache/wateen-phase2-tests/data/seedData.js');

let passed = 0;
async function runTest(num, title, fn) {
  await fn();
  passed++;
  console.log(`✓ [Phase 2 Test ${num}/6] PASSED: ${title}`);
}

// ---------------------------------------------------------------------------
// Test 1: Pre-OCR Image Enhancement (Grayscale + Contrast Stretch + Sharpen)
// ---------------------------------------------------------------------------
await runTest(
  1,
  'معالجة تحسين الصورة قبل OCR (تدرج رمادي + توسيع التباين + زيادة حدة الحواف)',
  async () => {
    const w = 16;
    const h = 16;
    const rgba = new Uint8ClampedArray(w * h * 4);

    // إنشاء صورة جدول منخفضة التباين (خلفية 150 ونص داكن قليلاً 115 فقط)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const isText = x >= 4 && x <= 11 && y >= 4 && y <= 11 && (x % 2 === 0 || y % 2 === 0);
        rgba[idx] = isText ? 110 : 155;
        rgba[idx + 1] = isText ? 115 : 152;
        rgba[idx + 2] = isText ? 120 : 148;
        rgba[idx + 3] = 255;
      }
    }

    const res = ocrMod.enhanceRgbaBufferForOcr(rgba, w, h, {
      grayscale: true,
      contrastFactor: 1.45,
      sharpen: true,
    });

    assert.equal(res.processed.length, rgba.length);
    // التحقق من التدرج الرمادي الصافي (R === G === B)
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      assert.equal(res.processed[idx], res.processed[idx + 1]);
      assert.equal(res.processed[idx + 1], res.processed[idx + 2]);
    }
    // التباين الأصلي كان ~38 فقط، وبعد المعالجة يجب أن يرتفع بقوة فوق 180
    assert.ok(
      res.contrastSpread >= 180,
      `توقعنا تبايناً عالياً بعد التحسين >= 180، لكن حصلنا على ${res.contrastSpread}`
    );
  }
);

// ---------------------------------------------------------------------------
// Test 2: UTF-8 BOM & Zero-Width Cleanup Guarantee
// ---------------------------------------------------------------------------
await runTest(
  2,
  'ضمان ترميز UTF-8 السليم وإزالة BOM والمحارف غير المرئية في ملفات CSV العربية',
  async () => {
    const csvWithBomAndZeroWidth =
      '\uFEFFالجولة,الفريق الأول,أهداف المستضيف,أهداف الضيف,الفريق الثاني,الملعب\n' +
      'الجولة 16,الحسين\u200B إربد,2,0,الرمثا,ستاد الحسن';
    const bytes = new TextEncoder().encode(csvWithBomAndZeroWidth);
    const decoded = importMod.decodeSportsTextBufferUtf8(bytes);

    assert.ok(!decoded.startsWith('\uFEFF'), 'يجب إزالة BOM من بداية الملف');
    assert.ok(!decoded.includes('\u200B'), 'يجب تنظيف المحارف الصفرية غير المرئية');

    const rows = importMod.parseSpreadsheetContentToRows(decoded, 'match_results', 'utf8_test.csv');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].homeTeam, 'الحسين إربد');
    assert.equal(rows[0].awayTeam, 'الرمثا');
    assert.equal(rows[0].homeScore, 2);
    assert.equal(rows[0].awayScore, 0);
  }
);

// ---------------------------------------------------------------------------
// Test 3: English & Arabic 9-Column Standings Tables (with GD column) + English Matches
// ---------------------------------------------------------------------------
await runTest(
  3,
  'قراءة الجداول العربية والإنجليزية ذات 9 أعمدة (بما فيها عمود الفارق GD) دون خلطه مع النقاط',
  async () => {
    const englishCsv = [
      'Pos,Team,P,W,D,L,GF,GA,GD,Pts',
      '1,Al-Hussein SC,15,13,2,0,33,7,+26,41',
      '2,Al-Faisaly,15,11,2,2,28,11,+17,35',
      '3,Al-Wehdat,15,10,3,2,26,12,+14,33',
    ].join('\n');

    const engRows = importMod.parseSpreadsheetContentToRows(
      englishCsv,
      'standings_table',
      'english_table.csv'
    );
    assert.equal(engRows.length, 3);
    assert.equal(engRows[0].teamName, 'Al-Hussein SC');
    assert.equal(engRows[0].played, 15);
    assert.equal(engRows[0].goalsFor, 33);
    assert.equal(engRows[0].goalsAgainst, 7);
    assert.equal(engRows[0].points, 41, 'يجب قراءة النقاط 41 وليس الفارق +26');

    const arabic9Col = [
      '# | الفريق | لعب | فاز | تعادل | خسر | له | عليه | الفارق | النقاط',
      '1 | الحسين إربد | 15 | 13 | 2 | 0 | 33 | 7 | +26 | 41',
      '2 | الفيصلي | 15 | 11 | 2 | 2 | 28 | 11 | +17 | 35',
    ].join('\n');

    const arRows = importMod.parseArabicSportsTextToRows(
      arabic9Col,
      'standings_table',
      'الجولة 15',
      'arabic_9col.png'
    );
    assert.equal(arRows.length, 2);
    assert.equal(arRows[0].teamName, 'الحسين إربد');
    assert.equal(arRows[0].points, 41);
    assert.equal(arRows[1].teamName, 'الفيصلي');
    assert.equal(arRows[1].points, 35);

    // اختبار نتائج إنجليزية مع Round Header
    const engMatchesText = [
      'Round 15',
      'Al-Faisaly 2 - 1 Al-Wehdat',
      'Al-Hussein SC 3 - 0 Al-Ramtha',
    ].join('\n');
    const engMatches = importMod.parseArabicSportsTextToRows(
      engMatchesText,
      'match_results',
      'Round 1',
      'eng_matches.txt'
    );
    assert.equal(engMatches.length, 2);
    assert.equal(engMatches[0].roundNumber, 'Round 15');
    assert.equal(engMatches[0].homeTeam, 'Al-Faisaly');
    assert.equal(engMatches[0].homeScore, 2);
    assert.equal(engMatches[0].awayScore, 1);
  }
);

// ---------------------------------------------------------------------------
// Test 4: Per-Field Confidence Scores (fieldConfidences)
// ---------------------------------------------------------------------------
await runTest(
  4,
  'حساب نسبة الثقة لكل حقل على حدة (fieldConfidences) وتمييز الحقل المؤكد من المشابه ومن غير الواضح',
  async () => {
    const validated = importMod.validateExtractedImportRows(
      [
        {
          homeTeam: 'الفيصلي', // مطابق تماماً -> 98
          awayTeam: 'الوحدات', // مطابق تماماً -> 98
          homeScore: 2, // مؤكد -> 97
          awayScore: 'غير واضح', // مفقود -> 0
          stadium: '', // اختياري مفقود -> 50 (لا يمنع الاعتماد وحده)
          roundNumber: 'الجولة 16',
        },
        {
          homeTeam: 'الفيصلي',
          awayTeam: 'الحسين إربد',
          homeScore: 1,
          awayScore: 1,
          stadium: 'ستاد عمّان الدولي',
          roundNumber: 'الجولة 16',
        },
      ],
      'match_results',
      'pro_league'
    );

    const row0 = validated[0];
    assert.ok(row0.fieldConfidences);
    assert.equal(row0.fieldConfidences.homeTeam, 98);
    assert.equal(row0.fieldConfidences.awayTeam, 98);
    assert.equal(row0.fieldConfidences.homeScore, 97);
    assert.equal(row0.fieldConfidences.awayScore, 0);
    assert.equal(row0.fieldConfidences.stadium, 50);
    assert.equal(row0.isReadyForApproval, false);

    const row1 = validated[1];
    assert.equal(row1.fieldConfidences.homeTeam, 98);
    assert.equal(row1.fieldConfidences.awayTeam, 98);
    assert.equal(row1.fieldConfidences.homeScore, 97);
    assert.equal(row1.fieldConfidences.awayScore, 97);
    assert.equal(row1.fieldConfidences.stadium, 92);
    assert.equal(row1.isReadyForApproval, true);
    assert.ok(row1.extractionConfidence >= 94);
  }
);

// ---------------------------------------------------------------------------
// Test 5: Strict Arithmetic Validation Blocking Critical Errors
// ---------------------------------------------------------------------------
await runTest(
  5,
  'التحقق الحسابي الصارم: رفض الأخطاء الحرجة (لعب != فوز+تعادل+خسارة، نقاط مستحيلة، كلين شيت > مباريات)',
  async () => {
    const standingsValidated = importMod.validateExtractedImportRows(
      [
        // 1) خطأ حرج: لعب 15 بينما فوز+تعادل+خسارة = 13
        {
          teamName: 'الفيصلي',
          played: 15,
          won: 10,
          drawn: 2,
          lost: 1,
          goalsFor: 25,
          goalsAgainst: 10,
          points: 32,
        },
        // 2) خطأ حرج: نقاط 40 بينما أقصى حد ممكن لـ 10 فوز + 2 تعادل = 32
        {
          teamName: 'الوحدات',
          played: 15,
          won: 10,
          drawn: 2,
          lost: 3,
          goalsFor: 28,
          goalsAgainst: 12,
          points: 40,
        },
        // 3) حالة خصم نقاط محتمل: نقاط 29 < 32 (تنبيه غير مانع للاعتماد)
        {
          teamName: 'الرمثا',
          played: 15,
          won: 10,
          drawn: 2,
          lost: 3,
          goalsFor: 20,
          goalsAgainst: 11,
          points: 29,
        },
        // 4) صف سليم 100%
        {
          teamName: 'الحسين إربد',
          played: 15,
          won: 13,
          drawn: 2,
          lost: 0,
          goalsFor: 33,
          goalsAgainst: 7,
          points: 41,
        },
      ],
      'standings_table',
      'pro_league'
    );

    assert.equal(standingsValidated[0].isReadyForApproval, false, 'يجب حظر لعب != ف+ت+خ');
    assert.equal(standingsValidated[0].hasConflict, true);
    assert.equal(standingsValidated[0].fieldConfidences.played, 20);

    assert.equal(standingsValidated[1].isReadyForApproval, false, 'يجب حظر النقاط المستحيلة > الحد الأقصى');
    assert.equal(standingsValidated[1].hasConflict, true);
    assert.equal(standingsValidated[1].fieldConfidences.points, 20);

    assert.equal(standingsValidated[2].isReadyForApproval, true, 'خصم النقاط المحتمل يظهر كتنبيه لا يحظر الاعتماد');
    assert.equal(standingsValidated[2].fieldConfidences.points, 65);
    assert.ok(standingsValidated[2].issues.some((i) => i.type === 'warning' && !i.blocking));

    assert.equal(standingsValidated[3].isReadyForApproval, true);
    assert.equal(standingsValidated[3].hasConflict, false);

    // اختبار حارس مرمى بشباك نظيفة أكبر من عدد مبارياته
    const gkValidated = importMod.validateExtractedImportRows(
      [
        {
          playerName: 'يزيد أبو ليلى',
          teamName: 'الحسين إربد',
          matches: 8,
          cleanSheets: 12, // مستحيل حسابياً
          goalsConceded: 3,
        },
      ],
      'goalkeepers_stats',
      'pro_league'
    );
    assert.equal(gkValidated[0].isReadyForApproval, false);
    assert.equal(gkValidated[0].hasConflict, true);
    assert.equal(gkValidated[0].fieldConfidences.cleanSheets, 20);
  }
);

// ---------------------------------------------------------------------------
// Test 6: Save Verified Phase 2 Backup Snapshot
// ---------------------------------------------------------------------------
await runTest(
  6,
  'حفظ نسخة احتياطية موثقة بعد إتمام المرحلة الثانية في backups/phase2-verified-backup.json',
  async () => {
    const freshState = migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state;
    const snap = storageMod.createPreMigrationBackupSnapshot(freshState);
    const backupsDir = path.resolve('backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const p2Path = path.join(backupsDir, 'phase2-verified-backup.json');
    fs.writeFileSync(p2Path, JSON.stringify(snap, null, 2), 'utf8');
    assert.ok(fs.existsSync(p2Path));
  }
);

console.log('====================================================================');
console.log(`ALL ${passed}/6 PHASE 2 OCR, UTF-8 & CONFIDENCE TESTS PASSED!`);
console.log('====================================================================');
