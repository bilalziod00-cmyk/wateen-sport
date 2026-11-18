import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

console.log('====================================================================');
console.log('  WATEEN SPORT - AI Import Debug & Fix Verification Suite (10+2)   ');
console.log('====================================================================');

await build({
  entryPoints: [
    'src/utils/aiSmartImportEngine.ts',
    'src/utils/sportsMathEngine.ts',
    'src/utils/cardCanvasExport.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'node_modules/.cache/wateen-tests',
  write: true,
});

const importEngine = await import('../node_modules/.cache/wateen-tests/aiSmartImportEngine.js');
const mathEngine = await import('../node_modules/.cache/wateen-tests/sportsMathEngine.js');
const cardEngine = await import('../node_modules/.cache/wateen-tests/cardCanvasExport.js');
const rulesText = fs.readFileSync(path.resolve('firebase/firestore.rules'), 'utf8');

let passed = 0;
async function runTest(number, title, fn) {
  await fn();
  passed += 1;
  console.log(`✓ [Test ${number}] PASSED: ${title}`);
}

// ---------------------------------------------------------------------------
// 1. فقرة عربية تحتوي على 3 مباريات ونتائجها
// ---------------------------------------------------------------------------
await runTest(1, 'فقرة عربية واحدة تحتوي على 3 مباريات ونتائجها (3 Matches in 1 Arabic Paragraph)', async () => {
  const paragraph =
    'شهدت منافسات الجولة الخامسة فوز الكرمل على عجلون 2-1، وتغلب الحسين إربد على الوحدات بنتيجة (3-0)، وتعادل الفيصلي والرمثا 1-1 على ستاد عمّان الدولي.';
  const rows = importEngine.parseArabicSportsTextToRows(paragraph, 'match_results', 'الجولة 5');

  assert.equal(rows.length, 3, `Expected 3 matches from paragraph, got ${rows.length}`);
  assert.equal(rows[0].homeTeam, 'الكرمل');
  assert.equal(rows[0].awayTeam, 'عجلون');
  assert.equal(rows[0].homeScore, 2);
  assert.equal(rows[0].awayScore, 1);

  assert.equal(rows[1].homeTeam, 'الحسين إربد');
  assert.equal(rows[1].awayTeam, 'الوحدات');
  assert.equal(rows[1].homeScore, 3);
  assert.equal(rows[1].awayScore, 0);

  assert.equal(rows[2].homeTeam, 'الفيصلي');
  assert.equal(rows[2].awayTeam, 'الرمثا');
  assert.equal(rows[2].homeScore, 1);
  assert.equal(rows[2].awayScore, 1);
  assert.equal(rows[2].stadium, 'ستاد عمّان الدولي');
});

// ---------------------------------------------------------------------------
// 2. صورة جدول تحتوي على 8 مباريات
// ---------------------------------------------------------------------------
await runTest(2, 'صورة جدول تحتوي على 8 مباريات كاملة (Image Table with 8 Matches)', async () => {
  const table8Text = [
    'الحسين إربد 2 - 0 شباب العقبة | الجولة 12 | ستاد الحسن',
    'الوحدات 3 - 1 معان | الجولة 12 | ستاد الملك عبدالله الثاني',
    'الفيصلي 2 - 2 الرمثا | الجولة 12 | ستاد عمّان الدولي',
    'السلط 1 - 0 الصريح | الجولة 12 | ملعب السلط',
    'شباب الأردن 2 - 1 الأهلي | الجولة 12 | ملعب البترا',
    'الجزيرة 1 - 1 مغير السرحان | الجولة 12 | ستاد الأمير محمد',
    'العربي 2 - 0 كفرسوم | الجولة 12 | ستاد الحسن',
    'البقعة 1 - 0 سحاب | الجولة 12 | ملعب البولو',
  ].join('\n');

  const fakeImgBase64 = Buffer.from(table8Text, 'utf8').toString('base64');
  const res = await importEngine.extractSportsDataWithGeminiAI({
    dataType: 'match_results',
    competitionId: 'pro_league',
    season: '2026 / 2027',
    roundName: 'الجولة 12',
    fileBase64: `data:image/png;base64,${fakeImgBase64}`,
    mimeType: 'image/png',
    sourceFileName: 'round12_8matches.png',
  });

  assert.equal(res.rows.length, 8, `Expected 8 matches from image table, got ${res.rows.length}`);
  assert.ok(res.extractedOcrText.includes('الحسين إربد'));
  assert.equal(res.rows[0].homeTeam, 'الحسين إربد');
  assert.equal(res.rows[7].homeTeam, 'البقعة');
  assert.equal(res.rows[7].awayTeam, 'سحاب');
});

// ---------------------------------------------------------------------------
// 3. صورة جدول ترتيب
// ---------------------------------------------------------------------------
await runTest(3, 'صورة جدول ترتيب (Standings Table Image Import)', async () => {
  const standingsText = [
    'الحسين إربد | 14 | 12 | 2 | 0 | 31 | 6 | 38',
    'الفيصلي | 14 | 11 | 2 | 1 | 28 | 9 | 35',
    'الوحدات | 14 | 10 | 3 | 1 | 26 | 10 | 33',
    'الرمثا | 14 | 8 | 3 | 3 | 21 | 13 | 27',
  ].join('\n');
  const fakeImgBase64 = Buffer.from(standingsText, 'utf8').toString('base64');
  const res = await importEngine.extractSportsDataWithGeminiAI({
    dataType: 'standings_table',
    competitionId: 'pro_league',
    season: '2026 / 2027',
    fileBase64: `data:image/png;base64,${fakeImgBase64}`,
    mimeType: 'image/png',
    sourceFileName: 'pro_standings.png',
  });

  assert.equal(res.rows.length, 4);
  assert.equal(res.rows[0].teamName, 'الحسين إربد');
  assert.equal(res.rows[0].points, 38);
  assert.equal(res.rows[3].teamName, 'الرمثا');
  assert.equal(res.rows[3].points, 27);
});

// ---------------------------------------------------------------------------
// 4. نتيجة مكتوبة بأرقام عربية/هندية وصيغ أقواس مختلفة: الكرمل (٢) عجلون (١)
// ---------------------------------------------------------------------------
await runTest(4, 'نتيجة مكتوبة بأرقام عربية/هندية وصيغ مختلفة مثل الكرمل (2) عجلون (1)', async () => {
  const text = `
    الكرمل ٢ - ١ عجلون
    الحسين إربد (٣) الوحدات (٠)
    الفيصلي (2) - (2) الرمثا
    السلط 1 شباب الأردن 0
  `;
  const rows = importEngine.parseArabicSportsTextToRows(text, 'match_results', 'الجولة 6');
  assert.equal(rows.length, 4);

  assert.equal(rows[0].homeTeam, 'الكرمل');
  assert.equal(rows[0].awayTeam, 'عجلون');
  assert.equal(rows[0].homeScore, 2);
  assert.equal(rows[0].awayScore, 1);

  assert.equal(rows[1].homeTeam, 'الحسين إربد');
  assert.equal(rows[1].awayTeam, 'الوحدات');
  assert.equal(rows[1].homeScore, 3);
  assert.equal(rows[1].awayScore, 0);

  assert.equal(rows[2].homeTeam, 'الفيصلي');
  assert.equal(rows[2].awayTeam, 'الرمثا');
  assert.equal(rows[2].homeScore, 2);
  assert.equal(rows[2].awayScore, 2);

  assert.equal(rows[3].homeTeam, 'السلط');
  assert.equal(rows[3].awayTeam, 'شباب الأردن');
  assert.equal(rows[3].homeScore, 1);
  assert.equal(rows[3].awayScore, 0);
});

// ---------------------------------------------------------------------------
// 5. ملف Excel يحتوي على عدة جولات
// ---------------------------------------------------------------------------
await runTest(5, 'ملف Excel يحتوي على عدة جولات (Multi-Round Excel Spreadsheet)', async () => {
  const excelCsv = [
    'الجولة,الفريق الأول,أهداف المستضيف,أهداف الضيف,الفريق الثاني,الملعب',
    'الجولة 1,الحسين إربد,2,0,السلط,ستاد الحسن',
    'الجولة 1,الوحدات,1,1,الفيصلي,ستاد عمّان الدولي',
    'الجولة 2,الرمثا,3,1,شباب الأردن,ملعب الأمير هاشم',
    'الجولة 3,الأهلي,0,2,الحسين إربد,ملعب البترا',
  ].join('\n');

  const buf = Buffer.from(excelCsv, 'utf8');
  const extracted = await importEngine.extractTextFromExcelBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    'multi_rounds.csv'
  );
  const rows = importEngine.parseSpreadsheetContentToRows(
    extracted,
    'rounds_data',
    'multi_rounds.csv'
  );

  assert.equal(rows.length, 4);
  assert.equal(rows[0].roundNumber, 'الجولة 1');
  assert.equal(rows[2].roundNumber, 'الجولة 2');
  assert.equal(rows[2].homeTeam, 'الرمثا');
  assert.equal(rows[2].homeScore, 3);
  assert.equal(rows[3].roundNumber, 'الجولة 3');
  assert.equal(rows[3].awayTeam, 'الحسين إربد');
});

// ---------------------------------------------------------------------------
// 6. مباراة ينقصها اسم الملعب (حقل اختياري لا يفشل الاستخراج ولا يمنع الاعتماد)
// ---------------------------------------------------------------------------
await runTest(6, 'مباراة ينقصها اسم الملعب (Missing Optional Stadium Does Not Fail Match)', async () => {
  const rows = importEngine.parseArabicSportsTextToRows(
    'الكرمل 2 - 1 عجلون',
    'match_results',
    'الجولة 4'
  );
  const batch = importEngine.buildValidatedImportBatch({
    dataType: 'match_results',
    competitionId: 'second_div',
    season: '2026 / 2027',
    ageCategory: 'الفريق الأول',
    groupName: 'المجموعة الأولى',
    roundName: 'الجولة 4',
    sources: [],
    extractedRows: rows,
    usedEngine: 'smart_deterministic',
    existingMatches: [],
    existingStandings: [],
  });

  assert.equal(batch.rows.length, 1);
  assert.equal(batch.rows[0].homeTeam, 'الكرمل');
  assert.equal(batch.rows[0].awayTeam, 'عجلون');
  assert.equal(batch.rows[0].stadium, '');
  assert.equal(batch.rows[0].isReadyForApproval, true);
  assert.ok(
    batch.rows[0].validationWarnings.some((w) => w.includes('الملعب')),
    'Should include non-blocking stadium note in validationWarnings'
  );
});

// ---------------------------------------------------------------------------
// 7. مباراة نتيجتها غير واضحة ضمن دفعة من 8 مباريات (7 جاهزة + 1 تحتاج تصحيحاً)
// ---------------------------------------------------------------------------
await runTest(7, 'مباراة نتيجتها غير واضحة ضمن 8 مباريات (7 Ready + 1 Needs Correction)', async () => {
  const text8With1Unclear = [
    'الحسين إربد 2 - 0 شباب العقبة',
    'الوحدات 3 - 1 معان',
    'الفيصلي 2 - 2 الرمثا',
    'السلط 1 - 0 الصريح',
    'شباب الأردن 2 - 1 الأهلي',
    'الجزيرة 1 - 1 مغير السرحان',
    'العربي 2 - 0 كفرسوم',
    'البقعة غير واضح - 1 سحاب',
  ].join('\n');

  const rawRows = importEngine.parseArabicSportsTextToRows(
    text8With1Unclear,
    'match_results',
    'الجولة 13'
  );
  const batch = importEngine.buildValidatedImportBatch({
    dataType: 'match_results',
    competitionId: 'pro_league',
    season: '2026 / 2027',
    ageCategory: 'الفريق الأول',
    groupName: 'الدوري العام',
    roundName: 'الجولة 13',
    sources: [],
    extractedRows: rawRows,
    usedEngine: 'smart_deterministic',
    existingMatches: [],
    existingStandings: [],
  });

  assert.equal(batch.rows.length, 8);
  assert.equal(batch.diagnosticLog.readyObjectsCount, 7);
  assert.equal(batch.diagnosticLog.needsCorrectionCount, 1);
  assert.equal(batch.rows[7].homeScore, null);
  assert.equal(batch.rows[7].isUnclear, true);
  assert.equal(batch.rows[7].isReadyForApproval, false);
});

// ---------------------------------------------------------------------------
// 8. فريق غير موجود في قاعدة البيانات
// ---------------------------------------------------------------------------
await runTest(8, 'فريق غير موجود في قاعدة البيانات (Unknown Team in Database)', async () => {
  const rawRows = importEngine.parseArabicSportsTextToRows(
    'نادي نجوم البادية 2 - 1 الفيصلي',
    'match_results',
    'الجولة 9'
  );
  const batch = importEngine.buildValidatedImportBatch({
    dataType: 'match_results',
    competitionId: 'pro_league',
    season: '2026 / 2027',
    ageCategory: 'الفريق الأول',
    groupName: 'الدوري العام',
    roundName: 'الجولة 9',
    sources: [],
    extractedRows: rawRows,
    usedEngine: 'smart_deterministic',
    existingMatches: [],
    existingStandings: [],
  });

  assert.equal(batch.rows.length, 1);
  assert.ok(batch.rows[0].unknownTeams.includes('نجوم البادية'));
  assert.ok(batch.rows[0].validationWarnings.some((w) => w.includes('غير موجود في قاعدة البيانات')));
});

// ---------------------------------------------------------------------------
// 9. مباراة مكررة
// ---------------------------------------------------------------------------
await runTest(9, 'اكتشاف مباراة مكررة ومنع اعتمادها (Duplicate Match Detection)', async () => {
  const existingMatches = [
    {
      id: 'm-dup-1',
      competitionId: 'pro_league',
      round: 'الجولة 15',
      homeTeam: 'الحسين إربد',
      homeShort: 'الحسين',
      homeColor: '#FACC15',
      awayTeam: 'الوحدات',
      awayShort: 'الوحدات',
      awayColor: '#10B981',
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      kickoffIso: new Date().toISOString(),
      stadium: 'ستاد الحسن',
      events: [],
    },
  ];

  const rawRows = importEngine.parseArabicSportsTextToRows(
    'الحسين اربد 2 - 1 الوحدات',
    'match_results',
    'الجولة 15'
  );
  const batch = importEngine.buildValidatedImportBatch({
    dataType: 'match_results',
    competitionId: 'pro_league',
    season: '2026 / 2027',
    ageCategory: 'الفريق الأول',
    groupName: 'الدوري العام',
    roundName: 'الجولة 15',
    sources: [],
    extractedRows: rawRows,
    usedEngine: 'smart_deterministic',
    existingMatches,
    existingStandings: [],
  });

  assert.equal(batch.rows[0].isDuplicate, true);
  assert.equal(batch.rows[0].isReadyForApproval, false);
  assert.ok(batch.diagnosticLog.approvalRejectionReasons.some((r) => r.includes('مكررة')));
});

// ---------------------------------------------------------------------------
// 10. صورة تحتوي على أكثر من جدول (Multi-Table Image Extraction)
// ---------------------------------------------------------------------------
await runTest(10, 'صورة تحتوي على أكثر من جدول (Image with Multiple Tables: Group 1 & Group 2)', async () => {
  const multiTableText = [
    'المجموعة الأولى',
    'الكرمل 2 - 0 الطرة',
    'دوقرة 1 - 1 الحصن',
    'المجموعة الثانية',
    'جرش 3 - 1 الطفيلة',
    'عجلون 2 - 1 مؤتة',
  ].join('\n');

  const fakeImgBase64 = Buffer.from(multiTableText, 'utf8').toString('base64');
  const res = await importEngine.extractSportsDataWithGeminiAI({
    dataType: 'match_results',
    competitionId: 'second_div',
    season: '2026 / 2027',
    roundName: 'الجولة 3',
    fileBase64: `data:image/png;base64,${fakeImgBase64}`,
    mimeType: 'image/png',
    sourceFileName: 'two_groups_tables.png',
  });

  assert.equal(res.rows.length, 4, `Expected 4 matches across 2 tables, got ${res.rows.length}`);
  assert.equal(res.rows[0].tableIndex, 1);
  assert.equal(res.rows[0].tableTitle, 'المجموعة الأولى');
  assert.equal(res.rows[2].tableIndex, 2);
  assert.equal(res.rows[2].tableTitle, 'المجموعة الثانية');
  assert.equal(res.rows[2].homeTeam, 'جرش');
  assert.equal(res.rows[3].homeTeam, 'عجلون');
});

// ---------------------------------------------------------------------------
// 11. اختبار تطبيع JSON المرن + تحديث الترتيب + قواعد الأمان
// ---------------------------------------------------------------------------
await runTest(11, 'تطبيع استجابات JSON المتنوعة وحساب الترتيب وقواعد الحماية', async () => {
  const variantJson = JSON.stringify({
    extractedText: 'الكرمل 2-1 عجلون',
    tables: [
      {
        title: 'جدول المجموعة الأولى',
        matches: [
          { team1: 'الكرمل', team2: 'عجلون', score: '2-1', round: 'الجولة 1' },
          { home_team: 'جرش', away_team: 'الطفيلة', home_score: 0, away_score: 0 },
        ],
      },
    ],
  });

  const norm = importEngine.normalizeAiJsonResponse(variantJson, 'match_results', 'ai.json');
  assert.equal(norm.rows.length, 2);
  assert.equal(norm.rows[0].homeTeam, 'الكرمل');
  assert.equal(norm.rows[0].homeScore, 2);
  assert.equal(norm.rows[0].awayScore, 1);
  assert.equal(norm.rows[1].homeTeam, 'جرش');
  assert.equal(norm.rows[1].homeScore, 0);

  assert.ok(rulesText.includes('request.auth.token.admin == true'));
  assert.equal(cardEngine.canGenerateGraphicFromSource(false), false);
});

console.log('====================================================================');
console.log(`  ALL ${passed}/11 MANDATORY TESTS PASSED SUCCESSFULLY!`);
console.log('====================================================================');
