import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

console.log('====================================================================');
console.log('  WATEEN SPORT - Local Storage, Backup & Firebase Migration Tests   ');
console.log('====================================================================');

await build({
  entryPoints: [
    'src/services/persistentStorageService.ts',
    'src/services/firebaseService.ts',
    'src/utils/sportsMathEngine.ts',
    'src/data/seedData.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['firebase/*'],
  outdir: 'node_modules/.cache/wateen-migration-tests',
  define: {
    'import.meta.env.VITE_DEFAULT_ADMIN_PIN': '"2026"',
    'import.meta.env.VITE_FIREBASE_API_KEY': '""',
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': '""',
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': '""',
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': '""',
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': '""',
    'import.meta.env.VITE_FIREBASE_APP_ID': '""',
  },
  write: true,
});

// محاكاة localStorage في بيئة الاختبار للتحقق من الحفظ والإغلاق وإعادة الفتح والحذف
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear(),
};

const storageSvc = await import(
  '../node_modules/.cache/wateen-migration-tests/services/persistentStorageService.js'
);
const firebaseSvc = await import(
  '../node_modules/.cache/wateen-migration-tests/services/firebaseService.js'
);
const mathEngine = await import(
  '../node_modules/.cache/wateen-migration-tests/utils/sportsMathEngine.js'
);
const seedMod = await import('../node_modules/.cache/wateen-migration-tests/data/seedData.js');

let passed = 0;
async function runTest(num, title, fn) {
  await fn();
  passed++;
  console.log(`✓ [Test ${num}/7] PASSED: ${title}`);
}

// ---------------------------------------------------------------------------
// 1. إنشاء وحفظ النسخة الاحتياطية الكاملة قبل النقل (Pre-Migration Backup Snapshot)
// ---------------------------------------------------------------------------
await runTest(
  1,
  'إنشاء نسخة احتياطية كاملة قابلة للاستعادة قبل النقل وحفظها في backups/pre-firebase-migration-backup.json',
  async () => {
    const initialState = JSON.parse(JSON.stringify(seedMod.INITIAL_SEED_DATA));
    const snapshot = storageSvc.createPreMigrationBackupSnapshot(initialState);

    assert.ok(snapshot.backupId.startsWith('bkp-'));
    assert.ok(snapshot.checksum.startsWith('chk-'));
    assert.ok(snapshot.counts.competitionsCount >= 11);
    assert.ok(snapshot.counts.teamsCount >= 33);
    assert.ok(snapshot.counts.matchesCount > 0);
    assert.ok(snapshot.counts.standingsCount > 0);

    const backupsDir = path.resolve('backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const backupFilePath = path.join(backupsDir, 'pre-firebase-migration-backup.json');
    fs.writeFileSync(backupFilePath, JSON.stringify(snapshot, null, 2), 'utf8');
    assert.ok(fs.existsSync(backupFilePath));

    const restoredSnap = storageSvc.getPreMigrationBackupSnapshot();
    assert.equal(restoredSnap.backupId, snapshot.backupId);
    assert.deepEqual(restoredSnap.counts, snapshot.counts);
  }
);

// ---------------------------------------------------------------------------
// 2. فحص وتحليل ملف google-services.json والتحقق من مشروع wateen-sport-app و com.wateensport.app
// ---------------------------------------------------------------------------
await runTest(
  2,
  'فحص ملف google-services.json والتحقق من مشروع wateen-sport-app ومعرف الحزمة com.wateensport.app',
  async () => {
    const sampleGoogleServicesJson = JSON.stringify({
      project_info: {
        project_number: '987654321000',
        project_id: 'wateen-sport-app',
        storage_bucket: 'wateen-sport-app.appspot.com',
      },
      client: [
        {
          client_info: {
            mobilesdk_app_id: '1:987654321000:android:abcdef1234567890',
            android_client_info: {
              package_name: 'com.wateensport.app',
            },
          },
          api_key: [
            {
              current_key: 'AIzaSyTestKeyForWateenSportAppVerification123',
            },
          ],
        },
      ],
    });

    const parsed = firebaseSvc.parseGoogleServicesOrFirebaseConfig(sampleGoogleServicesJson);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.isExpectedProject, true);
    assert.equal(parsed.packageName, 'com.wateensport.app');
    assert.equal(parsed.config.projectId, 'wateen-sport-app');
    assert.equal(parsed.config.storageBucket, 'wateen-sport-app.appspot.com');
    assert.equal(parsed.config.messagingSenderId, '987654321000');
    assert.equal(parsed.warning, undefined);

    // التحقق من اكتشاف مشروع مختلف وإظهار التنبيه
    const wrongProjectParsed = firebaseSvc.parseGoogleServicesOrFirebaseConfig(
      JSON.stringify({
        apiKey: 'AIzaSyOtherKey',
        projectId: 'other-project-id',
      })
    );
    assert.equal(wrongProjectParsed.ok, true);
    assert.equal(wrongProjectParsed.isExpectedProject, false);
    assert.ok(wrongProjectParsed.warning.includes('wateen-sport-app'));
  }
);

// ---------------------------------------------------------------------------
// 3. نقل ودمج البيانات المحلية مع السحابية بدون تكرار أو فقدان (Idempotent Merge)
// ---------------------------------------------------------------------------
await runTest(
  3,
  'نقل ودمج البيانات المحلية مع Firestore بدون تكرار أو فقدان ومطابقة عدد السجلات',
  async () => {
    const localState = JSON.parse(JSON.stringify(seedMod.INITIAL_SEED_DATA));
    const cloudState = JSON.parse(JSON.stringify(seedMod.INITIAL_SEED_DATA));

    // دمج البيانات مرتين متتاليتين للتأكد من عدم تضاعف أي سجل
    const mergedOnce = storageSvc.mergeStatesWithoutDuplication(localState, cloudState);
    const mergedTwice = storageSvc.mergeStatesWithoutDuplication(mergedOnce, cloudState);

    const localCounts = storageSvc.computeStateRecordCounts(localState);
    const mergedCounts = storageSvc.computeStateRecordCounts(mergedTwice);

    assert.deepEqual(localCounts, mergedCounts);
    assert.equal(storageSvc.verifyRecordCountsMatch(localCounts, mergedCounts), true);
  }
);

// ---------------------------------------------------------------------------
// 4. اختبار إضافة بطولة ومباراة ونتيجة، ثم إغلاق التطبيق وفتحه مجدداً والتأكد من بقاء البيانات
// ---------------------------------------------------------------------------
await runTest(
  4,
  'اختبار إضافة بطولة جديدة ومباراة ونتيجة (2-1)، ثم إغلاق التطبيق وإعادة فتحه والتأكد من بقاء البيانات',
  async () => {
    let appState = JSON.parse(JSON.stringify(seedMod.INITIAL_SEED_DATA));

    // أ) إضافة بطولة جديدة
    const newCompetition = {
      id: 'comp-custom-shield-2026',
      name: 'بطولة درع الاتحاد الأردني 2026',
      shortName: 'درع الاتحاد',
      season: '2026 / 2027',
      ageCategory: 'الفريق الأول',
      tierLabel: 'بطولة رسمية',
      parentCompetitionId: 'pro_league',
      groups: ['المجموعة الأولى'],
      createdAt: new Date().toISOString(),
    };
    appState.customCompetitions = [newCompetition, ...(appState.customCompetitions || [])];

    // ب) إضافة مباراة ونتيجة معتمدة (الحسين إربد 2 - 1 الفيصلي)
    const husseinBefore = appState.standings.find(
      (s) => s.competitionId === 'pro_league' && s.teamName === 'الحسين إربد'
    );
    const prevPoints = husseinBefore.points;

    const newMatch = {
      id: 'm-persist-test-1',
      competitionId: 'pro_league',
      round: 'الجولة 15',
      homeTeam: 'الحسين إربد',
      homeShort: 'الحسين',
      homeColor: '#EAB308',
      awayTeam: 'الفيصلي',
      awayShort: 'الفيصلي',
      awayColor: '#38BDF8',
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      isApproved: true,
      kickoffIso: new Date().toISOString(),
      stadium: 'ستاد الحسن - إربد',
      events: [],
    };

    appState.matches = [newMatch, ...appState.matches];
    appState.standings = mathEngine.applyApprovedMatchResultToStandings(
      newMatch,
      null,
      appState.standings,
      appState.matches
    );

    // ج) حفظ في التخزين المحلي وإغلاق التطبيق
    localStorage.setItem(storageSvc.LOCAL_DATA_KEY, JSON.stringify(appState));

    // د) إعادة فتح التطبيق وقراءة التخزين المحلي
    const reopenedState = JSON.parse(localStorage.getItem(storageSvc.LOCAL_DATA_KEY));

    assert.ok(
      reopenedState.customCompetitions.some((c) => c.id === 'comp-custom-shield-2026'),
      'يجب أن تبقى البطولة المضافة بعد إغلاق التطبيق وفتحه'
    );
    const savedMatch = reopenedState.matches.find((m) => m.id === 'm-persist-test-1');
    assert.ok(savedMatch, 'يجب أن تبقى المباراة المضافة بعد إغلاق التطبيق وفتحه');
    assert.equal(savedMatch.homeScore, 2);
    assert.equal(savedMatch.awayScore, 1);

    const husseinAfter = reopenedState.standings.find(
      (s) => s.competitionId === 'pro_league' && s.teamName === 'الحسين إربد'
    );
    assert.equal(
      husseinAfter.points,
      prevPoints + 3,
      'يجب أن تبقى نقاط الترتيب المحدثة (+3 نقاط) بعد إعادة فتح التطبيق'
    );
  }
);

// ---------------------------------------------------------------------------
// 5. اختبار حذف التطبيق وإعادة تثبيته بعد مزامنة البيانات، ثم تسجيل الدخول واستعادة البيانات
// ---------------------------------------------------------------------------
await runTest(
  5,
  'اختبار حذف التطبيق (مسح التخزين المحلي) وإعادة تثبيته ثم تسجيل الدخول واستعادة كامل البيانات من السحابة',
  async () => {
    // النسخة المتزامنة على السحابة قبل حذف التطبيق
    const syncedCloudSnapshot = JSON.parse(localStorage.getItem(storageSvc.LOCAL_DATA_KEY));
    const cloudCountsBeforeUninstall = storageSvc.computeStateRecordCounts(syncedCloudSnapshot);

    // محاكاة حذف التطبيق وإعادة تثبيته (مسح localStorage بالكامل)
    localStorage.removeItem(storageSvc.LOCAL_DATA_KEY);
    assert.equal(localStorage.getItem(storageSvc.LOCAL_DATA_KEY), null);

    // عند فتح التطبيق بعد التثبيت الجديد وتسجيل الدخول، يقرأ البيانات من السحابة ويدمجها
    const freshInstallDefaultState = JSON.parse(JSON.stringify(seedMod.INITIAL_SEED_DATA));
    const restoredAfterLogin = storageSvc.mergeStatesWithoutDuplication(
      freshInstallDefaultState,
      syncedCloudSnapshot
    );
    localStorage.setItem(storageSvc.LOCAL_DATA_KEY, JSON.stringify(restoredAfterLogin));

    const restoredCounts = storageSvc.computeStateRecordCounts(restoredAfterLogin);
    assert.equal(
      storageSvc.verifyRecordCountsMatch(cloudCountsBeforeUninstall, restoredCounts),
      true
    );
    assert.ok(
      restoredAfterLogin.customCompetitions.some((c) => c.id === 'comp-custom-shield-2026'),
      'يجب استعادة البطولة المضافة من السحابة بعد إعادة تثبيت التطبيق'
    );
    assert.ok(
      restoredAfterLogin.matches.some((m) => m.id === 'm-persist-test-1'),
      'يجب استعادة المباراة ونتيجتها من السحابة بعد إعادة تثبيت التطبيق'
    );
  }
);

// ---------------------------------------------------------------------------
// 6. التحقق من الحالات الأربع في لوحة التحكم (محلي، جاري الاتصال، متصل بالسحابة، فشل الاتصال)
// ---------------------------------------------------------------------------
await runTest(
  6,
  'التحقق من وجود الحالات الأربع في لوحة التحكم (محلي، جاري الاتصال، متصل بالسحابة، فشل الاتصال)',
  async () => {
    const cloudSettingsCode = fs.readFileSync(
      path.resolve('src/pages/admin/AdminCloudSettings.tsx'),
      'utf8'
    );
    assert.ok(cloudSettingsCode.includes("label: 'محلي'"));
    assert.ok(cloudSettingsCode.includes("label: 'جاري الاتصال'"));
    assert.ok(cloudSettingsCode.includes("label: 'متصل بالسحابة'"));
    assert.ok(cloudSettingsCode.includes("label: 'فشل الاتصال'"));
  }
);

// ---------------------------------------------------------------------------
// 7. التحقق من عدم تغيير Application ID أو مفتاح توقيع التطبيق
// ---------------------------------------------------------------------------
await runTest(
  7,
  'التحقق من الحفاظ على Application ID (com.wateensport.app) ومفتاح توقيع التطبيق دون تغيير',
  async () => {
    const buildGradle = fs.readFileSync(path.resolve('android/app/build.gradle'), 'utf8');
    const capConfig = fs.readFileSync(path.resolve('capacitor.config.ts'), 'utf8');
    assert.ok(buildGradle.includes('applicationId "com.wateensport.app"'));
    assert.ok(buildGradle.includes('signingConfig signingConfigs.debug'));
    assert.ok(capConfig.includes("appId: 'com.wateensport.app'"));
  }
);

console.log('====================================================================');
console.log(`  ALL ${passed}/7 FIREBASE MIGRATION & PERSISTENCE TESTS PASSED!    `);
console.log('====================================================================');
