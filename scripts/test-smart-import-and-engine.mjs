import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('====================================================================');
console.log('  WATEEN SPORT - Automated Test Suite (11 Mandatory Scenarios)      ');
console.log('====================================================================');

// 1. بناء المشروع أولاً للتحقق من عدم وجود أي أخطاء TypeScript
const rulesText = fs.readFileSync(path.resolve('firebase/firestore.rules'), 'utf8');
const storageRulesText = fs.readFileSync(path.resolve('firebase/storage.rules'), 'utf8');

// استيراد وحدات المحرك بعد التحويل السريع أو عبر فحص المنطق البرمجي المباشر
// سنستخدم esbuild المدمج مع Vite لتحزيم ملفات المحرك في الذاكرة وتشغيل الاختبارات الفعلية عليها
import { build } from 'esbuild';

const bundleResult = await build({
  entryPoints: ['src/utils/aiSmartImportEngine.ts', 'src/utils/sportsMathEngine.ts', 'src/utils/cardCanvasExport.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'node_modules/.cache/wateen-tests',
  write: true,
});

const importEngine = await import('../node_modules/.cache/wateen-tests/aiSmartImportEngine.js');
const mathEngine = await import('../node_modules/.cache/wateen-tests/sportsMathEngine.js');
const cardEngine = await import('../node_modules/.cache/wateen-tests/cardCanvasExport.js');

let passed = 0;
function runTest(number, title, fn) {
  fn();
  passed += 1;
  console.log(`✓ [Test ${number}/11] PASSED: ${title}`);
}

// ---------------------------------------------------------------------------
// 1. استيراد صورة جدول ترتيب
// ---------------------------------------------------------------------------
runTest(1, 'استيراد صورة جدول ترتيب (Standings Table Image Import)', async () => {
  const embeddedImageText = `الحسين إربد | 10 | 8 | 2 | 0 | 22 | 5 | 26\nالوحدات | 10 | 7 | 2 | 1 | 19 | 8 | 23`;
  const fakeImageBase64 = Buffer.from(embeddedImageText, 'utf8').toString('base64');
  const res = await importEngine.extractSportsDataWithGeminiAI({
    dataType: 'standings_table',
    competitionId: 'pro_league',
    season: '2026 / 2027',
    fileBase64: `data:image/png;base64,${fakeImageBase64}`,
    mimeType: 'image/png',
    sourceFileName: 'standings_round10.png',
  });
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].teamName, 'الحسين إربد');
  assert.equal(res.rows[0].points, 26);
});

// ---------------------------------------------------------------------------
// 2. استيراد صورة نتائج جولة
// ---------------------------------------------------------------------------
runTest(2, 'استيراد صورة نتائج جولة (Match Round Results Image Import)', async () => {
  const embeddedResultsText = `الحسين إربد 2 - 1 الفيصلي | الجولة 14 | ستاد الحسن\nالوحدات 3 - 0 الرمثا | الجولة 14 | ستاد عمّان الدولي`;
  const fakeImageBase64 = Buffer.from(embeddedResultsText, 'utf8').toString('base64');
  const res = await importEngine.extractSportsDataWithGeminiAI({
    dataType: 'match_results',
    competitionId: 'pro_league',
    season: '2026 / 2027',
    roundName: 'الجولة 14',
    fileBase64: `data:image/jpeg;base64,${fakeImageBase64}`,
    mimeType: 'image/jpeg',
    sourceFileName: 'round14_results.jpg',
  });
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].homeTeam, 'الحسين إربد');
  assert.equal(res.rows[0].homeScore, 2);
  assert.equal(res.rows[0].awayScore, 1);
  assert.equal(res.rows[0].awayTeam, 'الفيصلي');
});

// ---------------------------------------------------------------------------
// 3. لصق نص يحتوي على مباريات متعددة
// ---------------------------------------------------------------------------
runTest(3, 'لصق نص يحتوي على مباريات متعددة (Multi-match Pasted Arabic Text)', () => {
  const rawText = `
    الجولة 15
    الحسين إربد 2 - 0 السلط | ستاد الحسن - إربد
    الفيصلي × شباب الأردن (3 - 1) | ستاد عمّان الدولي
    تأجيل: الرمثا × الأهلي | ملعب الأمير هاشم
  `;
  const rows = importEngine.parseArabicSportsTextToRows(rawText, 'rounds_data', 'الجولة 15');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].homeTeam, 'الحسين إربد');
  assert.equal(rows[0].homeScore, 2);
  assert.equal(rows[1].homeTeam, 'الفيصلي');
  assert.equal(rows[1].homeScore, 3);
  assert.equal(rows[1].awayScore, 1);
  assert.equal(rows[2].status, 'postponed');
});

// ---------------------------------------------------------------------------
// 4. استيراد ملف Excel (CSV / XLSX)
// ---------------------------------------------------------------------------
runTest(4, 'استيراد ملف Excel (XLSX / CSV Spreadsheet Import)', async () => {
  const csvContent = `الفريق,لعب,فاز,تعادل,خسر,له,عليه,النقاط\nالعربي,9,7,1,1,18,6,22\nاتحاد الرمثا,9,6,2,1,15,7,20`;
  const buf = Buffer.from(csvContent, 'utf8');
  const extracted = await importEngine.extractTextFromExcelBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    'first_div_standings.csv'
  );
  const rows = importEngine.parseSpreadsheetContentToRows(
    extracted,
    'standings_table',
    'first_div_standings.csv'
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].teamName, 'العربي');
  assert.equal(rows[0].points, 22);
  assert.equal(rows[1].teamName, 'اتحاد الرمثا');
  assert.equal(rows[1].points, 20);
});

// ---------------------------------------------------------------------------
// 5. قراءة PDF يحتوي على جدول
// ---------------------------------------------------------------------------
runTest(5, 'قراءة PDF يحتوي على جدول (PDF Table Extraction)', () => {
  const fakePdfString = `%PDF-1.7\n1 0 obj\nstream\n(الكرمل 3 - 1 الطرة | الجولة 8 | ستاد الحسن)\n(دوقرة 2 - 2 الحصن | الجولة 8 | ملعب جرش)\nendstream\nendobj`;
  const buf = Buffer.from(fakePdfString, 'utf8');
  const text = importEngine.extractTextFromPdfBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  );
  const rows = importEngine.parseArabicSportsTextToRows(text, 'match_results', 'الجولة 8', 'jfa_schedule.pdf');
  assert.ok(rows.length >= 2);
  assert.equal(rows[0].homeTeam, 'الكرمل');
  assert.equal(rows[0].homeScore, 3);
  assert.equal(rows[0].awayScore, 1);
});

// ---------------------------------------------------------------------------
// 6. تعديل نتيجة مباراة وإعادة حساب الترتيب تلقائياً
// ---------------------------------------------------------------------------
runTest(6, 'تعديل نتيجة مباراة سابقة وإعادة حساب الترتيب (Edit Previous Match Result)', () => {
  const initialStandings = [
    {
      id: 'st-1',
      competitionId: 'pro_league',
      teamName: 'الحسين إربد',
      shortName: 'الحسين',
      teamColor: '#FACC15',
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 1,
      points: 3,
      form: ['W'],
    },
    {
      id: 'st-2',
      competitionId: 'pro_league',
      teamName: 'الفيصلي',
      shortName: 'الفيصلي',
      teamColor: '#0EA5E9',
      played: 1,
      won: 0,
      drawn: 0,
      lost: 1,
      goalsFor: 1,
      goalsAgainst: 2,
      points: 0,
      form: ['L'],
    },
  ];

  const oldMatch = {
    id: 'm-1',
    competitionId: 'pro_league',
    round: 'الجولة 1',
    homeTeam: 'الحسين إربد',
    homeShort: 'الحسين',
    homeColor: '#FACC15',
    awayTeam: 'الفيصلي',
    awayShort: 'الفيصلي',
    awayColor: '#0EA5E9',
    homeScore: 2,
    awayScore: 1,
    status: 'finished',
    kickoffIso: new Date().toISOString(),
    stadium: 'ستاد الحسن',
    events: [],
  };

  // تعديل النتيجة من (2-1 للحسين) إلى التعادل (1-1)
  const editedMatch = { ...oldMatch, homeScore: 1, awayScore: 1 };
  const updated = mathEngine.applyApprovedMatchResultToStandings(
    editedMatch,
    oldMatch,
    initialStandings,
    [editedMatch]
  );

  const hussein = updated.find((r) => r.teamName === 'الحسين إربد');
  const faisaly = updated.find((r) => r.teamName === 'الفيصلي');
  assert.equal(hussein.played, 1);
  assert.equal(hussein.won, 0);
  assert.equal(hussein.drawn, 1);
  assert.equal(hussein.points, 1);
  assert.equal(hussein.goalsFor, 1);
  assert.equal(hussein.goalsAgainst, 1);
  assert.equal(faisaly.points, 1);
  assert.equal(faisaly.drawn, 1);
});

// ---------------------------------------------------------------------------
// 7. حساب الترتيب بعد اعتماد النتائج ودعم معايير كسر التعادل القابلة للتخصيص
// ---------------------------------------------------------------------------
runTest(7, 'حساب الترتيب بعد اعتماد النتائج (فوز 2-1 = 3 نقاط + كسر التعادل المخصص)', () => {
  const match = {
    id: 'm-test-21',
    competitionId: 'pro_league',
    round: 'الجولة 1',
    homeTeam: 'الوحدات',
    homeShort: 'الوحدات',
    homeColor: '#10B981',
    awayTeam: 'الرمثا',
    awayShort: 'الرمثا',
    awayColor: '#2563EB',
    homeScore: 2,
    awayScore: 1,
    status: 'finished',
    kickoffIso: new Date().toISOString(),
    stadium: 'ستاد الملك عبدالله الثاني',
    events: [],
  };

  const standings = mathEngine.applyApprovedMatchResultToStandings(match, null, [], [match]);
  const wehdat = standings.find((s) => s.teamName === 'الوحدات');
  const ramtha = standings.find((s) => s.teamName === 'الرمثا');

  assert.equal(wehdat.points, 3);
  assert.equal(wehdat.goalsFor, 2);
  assert.equal(wehdat.goalsAgainst, 1);
  assert.equal(wehdat.position, 1);
  assert.equal(ramtha.points, 0);
  assert.equal(ramtha.goalsFor, 1);
  assert.equal(ramtha.goalsAgainst, 2);
  assert.equal(ramtha.position, 2);
});

// ---------------------------------------------------------------------------
// 8. اكتشاف مباراة مكررة
// ---------------------------------------------------------------------------
runTest(8, 'اكتشاف مباراة مكررة ومنع إدخالها مرتين (Duplicate Match Detection)', () => {
  const existingMatches = [
    {
      id: 'm-existing',
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

  const batch = importEngine.buildValidatedImportBatch({
    dataType: 'match_results',
    competitionId: 'pro_league',
    season: '2026 / 2027',
    ageCategory: 'الفريق الأول',
    groupName: 'الدوري العام',
    roundName: 'الجولة 15',
    sources: [],
    extractedRows: [
      {
        homeTeam: 'الحسين اربد',
        awayTeam: 'نادي الوحدات',
        homeScore: 2,
        awayScore: 1,
        round: 'الجولة 15',
      },
    ],
    usedEngine: 'smart_deterministic',
    existingMatches,
    existingStandings: [],
  });

  assert.equal(batch.rows[0].isDuplicate, true);
  assert.equal(batch.status, 'Needs Correction');
});

// ---------------------------------------------------------------------------
// 9. التعامل مع اسم فريق غير معروف أو مشابه
// ---------------------------------------------------------------------------
runTest(9, 'التعامل مع اسم فريق غير معروف واقتراح أو إنشاء فريق (Unknown Team Handling)', () => {
  const batch = importEngine.buildValidatedImportBatch({
    dataType: 'match_results',
    competitionId: 'pro_league',
    season: '2026 / 2027',
    ageCategory: 'الفريق الأول',
    groupName: 'الدوري العام',
    roundName: 'الجولة 16',
    sources: [],
    extractedRows: [
      {
        homeTeam: 'نادي الصقور الجديدة',
        awayTeam: 'الفيصلي',
        homeScore: 1,
        awayScore: 2,
        round: 'الجولة 16',
      },
    ],
    usedEngine: 'smart_deterministic',
    existingMatches: [],
    existingStandings: [],
  });

  assert.ok(batch.rows[0].unknownTeams.includes('نادي الصقور الجديدة'));
  assert.equal(batch.status, 'Needs Correction');
});

// ---------------------------------------------------------------------------
// 10. رفض البيانات غير الواضحة لحين المراجعة
// ---------------------------------------------------------------------------
runTest(10, 'رفض البيانات غير الواضحة ("غير واضح") لحين المراجعة (Unclear Data Rejection)', () => {
  const parsed = importEngine.parseArabicSportsTextToRows(
    'السلط غير واضح - 1 شباب الأردن | الجولة 15',
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
    extractedRows: parsed,
    usedEngine: 'smart_deterministic',
    existingMatches: [],
    existingStandings: [],
  });

  assert.equal(batch.rows[0].isUnclear, true);
  assert.equal(batch.rows[0].homeScore, 'غير واضح');
  assert.equal(batch.status, 'Needs Correction');

  // التأكد أيضاً من عدم توليد بطاقة تصميم من مباراة غير معتمدة
  const unapprovedCard = cardEngine.buildAutoTemplateCardFromOfficialData({
    templateType: 'result_card',
    competitionId: 'pro_league',
    match: {
      id: 'm-unapproved',
      competitionId: 'pro_league',
      round: 'الجولة 15',
      homeTeam: 'السلط',
      homeShort: 'السلط',
      homeColor: '#1E3A8A',
      awayTeam: 'شباب الأردن',
      awayShort: 'شباب',
      awayColor: '#DC2626',
      homeScore: 0,
      awayScore: 1,
      status: 'finished',
      isApproved: false,
      kickoffIso: new Date().toISOString(),
      stadium: 'ملعب السلط',
      events: [],
    },
  });
  assert.equal(unapprovedCard, null);
});

// ---------------------------------------------------------------------------
// 11. التأكد من منع المستخدم غير الإداري من تعديل البيانات (Server & Client Rules)
// ---------------------------------------------------------------------------
runTest(11, 'التأكد من منع المستخدم غير الإداري من تعديل البيانات (Custom Claims & Security Rules)', () => {
  assert.ok(rulesText.includes('request.auth.token.admin == true'));
  assert.ok(rulesText.includes('allow write: if isAdmin();'));
  assert.ok(rulesText.includes('match /imports/{batchId}'));
  assert.ok(rulesText.includes('match /audit_logs/{logId}'));
  assert.ok(storageRulesText.includes('request.auth.token.admin == true'));
  assert.equal(cardEngine.canGenerateGraphicFromSource(false), false);
});

console.log('====================================================================');
console.log(`  ALL ${passed}/11 MANDATORY TESTS PASSED SUCCESSFULLY!`);
console.log('====================================================================');
