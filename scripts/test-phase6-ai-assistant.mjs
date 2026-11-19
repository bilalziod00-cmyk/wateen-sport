import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

console.log('====================================================================');
console.log('  WATEEN SPORT AI - Phase 6 Verification (Interactive AI Assistant) ');
console.log('====================================================================');

await build({
  entryPoints: [
    'src/services/wateenAssistantService.ts',
    'src/services/schemaMigrationService.ts',
    'src/services/persistentStorageService.ts',
    'src/data/seedData.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'lucide-react', 'firebase/*'],
  outdir: 'node_modules/.cache/wateen-phase6-tests',
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

const asstMod = await import('../node_modules/.cache/wateen-phase6-tests/services/wateenAssistantService.js');
const migMod = await import('../node_modules/.cache/wateen-phase6-tests/services/schemaMigrationService.js');
const storageMod = await import('../node_modules/.cache/wateen-phase6-tests/services/persistentStorageService.js');
const seedMod = await import('../node_modules/.cache/wateen-phase6-tests/data/seedData.js');

const sampleState = {
  ...migMod.migrateAppStateSafely(null, seedMod.INITIAL_SEED_DATA).state,
  reviewQueueArticles: [
    {
      id: 'news_queue_1',
      title: 'الاتحاد الأردني يحدد موعد نصف نهائي كأس الأردن',
      summary: 'بيان رسمي يحدد الملاعب والساعة بتوقيت عمّان.',
      content: 'المحتوى الكامل للخبر.',
      competitionId: 'jordan_cup',
      tag: 'official',
      isBreaking: false,
      imageUrl: './images/stadium-night.jpg',
      author: 'وتين سبورت AI',
      sourceName: 'الاتحاد الأردني لكرة القدم (JFA)',
      publishedAt: '2026-11-19T01:00:00.000Z',
      views: 0,
      isDemo: false,
    },
  ],
  injuries: [
    {
      id: 'inj_test_1',
      playerName: 'يزن النعيمات',
      teamName: 'الفيصلي',
      competitionId: 'pro_league',
      declaredInjury: 'كدمة في الركبة',
      announcedDate: '2026-11-18',
      lastUpdatedAt: '2026-11-18T14:00:00.000Z',
      declaredAbsenceDuration: 'غير محدد رسمياً',
      returnStatus: 'rehab',
      sourceName: 'بيان نادي الفيصلي الرسمي',
      isVerifiedOfficial: true,
    },
  ],
};

let passed = 0;
async function runTest(num, title, fn) {
  await fn();
  passed++;
  console.log(`✓ [Phase 6 Test ${num}/6] PASSED: ${title}`);
}

// ---------------------------------------------------------------------------
// Test 1: Team Comparison ("قارن بين الكرمل وعجلون" / Standings & H2H)
// ---------------------------------------------------------------------------
await runTest(
  1,
  'أمر مقارنة فريقين («قارن بين الكرمل وعجلون») و («قارن بين الحسين إربد والوحدات») مع ذكر المصدر والتاريخ',
  async () => {
    const resPro = asstMod.processWateenAssistantCommand(
      'قارن بين الحسين إربد والوحدات',
      sampleState
    );
    assert.equal(resPro.intent, 'compare_teams');
    assert.ok(resPro.answerText.includes('الحسين إربد'));
    assert.ok(resPro.answerText.includes('الوحدات'));
    assert.ok(resPro.sourcesUsed.length > 0);
    assert.ok(resPro.dataLastUpdatedFormatted.length > 0);
    assert.equal(resPro.requiresAdminConfirmation, false);

    // الكرمل وعجلون غير متوفرين في جدول المحترفين الأولي -> يجب ألا يخترع لهما أرقاماً
    const resDiv2 = asstMod.processWateenAssistantCommand('قارن بين الكرمل وعجلون', sampleState);
    assert.equal(resDiv2.intent, 'compare_teams');
    assert.ok(
      resDiv2.bullets.some((b) => b.includes('غير متوفر')),
      'يجب الإقرار الصريح بأن الإحصائية غير متوفرة عند غيابها'
    );
  }
);

// ---------------------------------------------------------------------------
// Test 2: Top Scorer, Standings & Last 5 Matches Analysis
// ---------------------------------------------------------------------------
await runTest(
  2,
  'أوامر هداف الدوري، جدول الترتيب، وتحليل آخر 5 مباريات مع أرقام حقيقية ومصدر وتاريخ تحديث',
  async () => {
    const scorerRes = asstMod.processWateenAssistantCommand('من هو هداف الدوري؟', sampleState);
    assert.equal(scorerRes.intent, 'top_scorers');
    assert.ok(scorerRes.bullets.length > 0);
    assert.ok(scorerRes.sourcesUsed.length > 0);

    const standingsRes = asstMod.processWateenAssistantCommand('ما هو ترتيب دوري المحترفين؟', sampleState);
    assert.equal(standingsRes.intent, 'standings');
    assert.ok(standingsRes.bullets.some((b) => b.includes('أقوى هجوم')));

    const last5Res = asstMod.processWateenAssistantCommand(
      'حلل آخر 5 مباريات للفيصلي',
      sampleState
    );
    assert.ok(last5Res.intent.startsWith('analyze_last_5'));
    assert.ok(last5Res.sourcesUsed.length > 0);
  }
);

// ---------------------------------------------------------------------------
// Test 3: Injuries & Health System Inspection
// ---------------------------------------------------------------------------
await runTest(
  3,
  'أمر الإصابات والجاهزية يعرض التقارير المنسوبة للمصدر + أمر فحص حالة النظام ومصادر الأخبار',
  async () => {
    const injRes = asstMod.processWateenAssistantCommand('ما هي إصابات الفيصلي الحالية؟', sampleState);
    assert.equal(injRes.intent, 'injuries');
    assert.ok(injRes.bullets[0].includes('يزن النعيمات'));
    assert.ok(injRes.sourcesUsed.includes('بيان نادي الفيصلي الرسمي'));

    const healthRes = asstMod.processWateenAssistantCommand(
      'افحص حالة النظام ومصادر الأخبار',
      sampleState
    );
    assert.equal(healthRes.intent, 'system_health');
    assert.ok(healthRes.answerText.includes('طابور المراجعة'));
  }
);

// ---------------------------------------------------------------------------
// Test 4: Social Media Post Generation Strictly From Approved Data
// ---------------------------------------------------------------------------
await runTest(
  4,
  'تجهيز منشور فيسبوك/إنستغرام من بيانات الترتيب أو المباراة المعتمدة دون اختلاق',
  async () => {
    const postRes = asstMod.processWateenAssistantCommand(
      'جهز منشور فيسبوك عن ترتيب المحترفين',
      sampleState
    );
    assert.equal(postRes.intent, 'social_post_standings');
    assert.ok(postRes.generatedSocialPost && postRes.generatedSocialPost.includes('#وتين_سبورت'));
    assert.ok(postRes.sourcesUsed.length > 0);
  }
);

// ---------------------------------------------------------------------------
// Test 5: Sensitive Commands Blocked Until Explicit Admin Confirmation
// ---------------------------------------------------------------------------
await runTest(
  5,
  'منع تنفيذ العمليات الحساسة (اعتماد خبر، إعادة حساب، إرسال إشعار، تعديل نتيجة) قبل تأكيد المدير الصريح',
  async () => {
    const approveCmd = asstMod.processWateenAssistantCommand(
      'اعتمد ونشر أول خبر في طابور المراجعة',
      sampleState
    );
    assert.equal(approveCmd.requiresAdminConfirmation, true);
    assert.ok(approveCmd.pendingAction);
    assert.equal(approveCmd.pendingAction.actionType, 'approve_top_queued_news');

    const recalcCmd = asstMod.processWateenAssistantCommand(
      'أعد حساب ترتيب دوري المحترفين الآن',
      sampleState
    );
    assert.equal(recalcCmd.requiresAdminConfirmation, true);
    assert.equal(recalcCmd.pendingAction?.actionType, 'recalculate_standings');

    const pushCmd = asstMod.processWateenAssistantCommand(
      'أرسل إشعار عاجل عن قمة الحسين والوحدات',
      sampleState
    );
    assert.equal(pushCmd.requiresAdminConfirmation, true);
    assert.equal(pushCmd.pendingAction?.actionType, 'send_breaking_notification');

    const editScoreCmd = asstMod.processWateenAssistantCommand(
      'عدّل نتيجة مباراة الفيصلي إلى 5-0',
      sampleState
    );
    assert.equal(editScoreCmd.requiresAdminConfirmation, true);
    assert.equal(editScoreCmd.intent, 'sensitive_action_blocked');
  }
);

// ---------------------------------------------------------------------------
// Test 6: Dashboard Integration + Save Verified Phase 6 Backup Snapshot
// ---------------------------------------------------------------------------
await runTest(
  6,
  'التحقق من ربط المساعد التفاعلي في لوحة التحكم وحفظ نسخة احتياطية للمرحلة السادسة',
  async () => {
    const adminCode = fs.readFileSync(path.resolve('src/pages/AdminDashboardPage.tsx'), 'utf8');
    assert.ok(adminCode.includes('AdminAiAssistantPage'));
    assert.ok(adminCode.includes('ai_assistant'));

    const snap = storageMod.createPreMigrationBackupSnapshot(sampleState);
    const backupsDir = path.resolve('backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const p6Path = path.join(backupsDir, 'phase6-verified-backup.json');
    fs.writeFileSync(p6Path, JSON.stringify(snap, null, 2), 'utf8');
    assert.ok(fs.existsSync(p6Path));
  }
);

console.log('====================================================================');
console.log(`ALL ${passed}/6 PHASE 6 INTERACTIVE WATEEN AI ASSISTANT TESTS PASSED!`);
console.log('====================================================================');
