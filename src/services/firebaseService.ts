import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  Auth,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  collection,
  addDoc,
  writeBatch,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { AppDataState, AppNotification, FirebaseCloudConfig } from '../types/sports';
import {
  computeStateRecordCounts,
  createPreMigrationBackupSnapshot,
  mergeStatesWithoutDuplication,
  MigrationVerificationReport,
  verifyRecordCountsMatch,
} from './persistentStorageService';

export const EXPECTED_FIREBASE_PROJECT_ID = 'wateen-sport-app';
export const EXPECTED_ANDROID_PACKAGE_NAME = 'com.wateensport.app';
const CONFIG_STORAGE_KEY = 'wateen_firebase_config_v1';
const STATE_DOC_PATH = 'wateen_app/main_state';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;

export function getEnvFirebaseConfig(): FirebaseCloudConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };
}

export function getSavedFirebaseConfig(): FirebaseCloudConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FirebaseCloudConfig;
      if (parsed.apiKey && parsed.projectId) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return getEnvFirebaseConfig();
}

export function saveFirebaseConfig(config: FirebaseCloudConfig | null): void {
  if (!config) {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    return;
  }
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

/**
 * قراءة وتحليل ملف google-services.json الرسمي أو كائن firebaseConfig والتحقق من مشروع wateen-sport-app
 */
export function parseGoogleServicesOrFirebaseConfig(rawInput: string): {
  ok: boolean;
  config?: FirebaseCloudConfig;
  packageName?: string;
  isExpectedProject?: boolean;
  warning?: string;
  error?: string;
} {
  const text = (rawInput || '').trim();
  if (!text) {
    return { ok: false, error: 'الملف أو النص المدخل فارغ' };
  }

  try {
    // دعم لصق كود JavaScript مثل const firebaseConfig = { ... };
    const jsonCandidate = text.includes('{')
      ? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
      : text;

    // تحويل مفاتيح JS غير المحاطة بعلامات تنصيص إن وجدت
    const normalizedJson = jsonCandidate.replace(
      /([{,]\s*)(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId)(\s*:)/g,
      '$1"$2"$3'
    );

    const parsed = JSON.parse(normalizedJson);

    // الحالة 1: ملف google-services.json الرسمي لأندرويد
    if (parsed.project_info && Array.isArray(parsed.client)) {
      const projectId = String(parsed.project_info.project_id || '').trim();
      const storageBucket =
        String(parsed.project_info.storage_bucket || '').trim() || `${projectId}.appspot.com`;
      const messagingSenderId = String(parsed.project_info.project_number || '').trim();

      // البحث عن العميل المطابق لمعرف الحزمة com.wateensport.app أو أول عميل متاح
      const matchingClient =
        parsed.client.find(
          (c: Record<string, unknown>) =>
            (c?.client_info as Record<string, Record<string, string>>)?.android_client_info
              ?.package_name === EXPECTED_ANDROID_PACKAGE_NAME
        ) || parsed.client[0];

      const packageName =
        matchingClient?.client_info?.android_client_info?.package_name || '';
      const appId = String(matchingClient?.client_info?.mobilesdk_app_id || '').trim();
      const apiKey = String(matchingClient?.api_key?.[0]?.current_key || '').trim();

      if (!projectId || !apiKey) {
        return {
          ok: false,
          error: 'ملف google-services.json ناقص: لم يتم العثور على project_id أو current_key',
        };
      }

      const warnings: string[] = [];
      if (projectId !== EXPECTED_FIREBASE_PROJECT_ID) {
        warnings.push(
          `تنبيه: معرف المشروع في الملف هو (${projectId}) وليس (${EXPECTED_FIREBASE_PROJECT_ID})`
        );
      }
      if (packageName && packageName !== EXPECTED_ANDROID_PACKAGE_NAME) {
        warnings.push(
          `تنبيه: معرف الحزمة في الملف هو (${packageName}) بينما معرف تطبيق أندرويد الثابت هو (${EXPECTED_ANDROID_PACKAGE_NAME})`
        );
      }

      return {
        ok: true,
        config: {
          apiKey,
          authDomain: `${projectId}.firebaseapp.com`,
          projectId,
          storageBucket,
          messagingSenderId,
          appId,
        },
        packageName,
        isExpectedProject: projectId === EXPECTED_FIREBASE_PROJECT_ID,
        warning: warnings.length > 0 ? warnings.join(' • ') : undefined,
      };
    }

    // الحالة 2: كائن firebaseConfig القياسي للويب
    if (parsed.apiKey && parsed.projectId) {
      const projectId = String(parsed.projectId).trim();
      return {
        ok: true,
        config: {
          apiKey: String(parsed.apiKey).trim(),
          authDomain: String(parsed.authDomain || `${projectId}.firebaseapp.com`).trim(),
          projectId,
          storageBucket: String(parsed.storageBucket || `${projectId}.appspot.com`).trim(),
          messagingSenderId: String(parsed.messagingSenderId || '').trim(),
          appId: String(parsed.appId || '').trim(),
        },
        isExpectedProject: projectId === EXPECTED_FIREBASE_PROJECT_ID,
        warning:
          projectId !== EXPECTED_FIREBASE_PROJECT_ID
            ? `تنبيه: معرف المشروع المدخل هو (${projectId}) بينما المشروع المتوقع هو (${EXPECTED_FIREBASE_PROJECT_ID})`
            : undefined,
      };
    }

    return {
      ok: false,
      error: 'لم يتم التعرف على صيغة الملف؛ يرجى رفع google-services.json أو كائن firebaseConfig',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'صيغة JSON غير صالحة',
    };
  }
}

/**
 * تهيئة الاتصال الفعلي مع Firebase (App + Auth + Firestore + Storage) والتحقق من استجابة الخادم
 */
export async function initFirebaseCloud(
  config: FirebaseCloudConfig
): Promise<{ ok: boolean; error?: string }> {
  if (!config?.apiKey?.trim() || !config?.projectId?.trim()) {
    return { ok: false, error: 'مفتاح API أو Project ID غير مكتمل' };
  }

  try {
    if (getApps().length > 0) {
      for (const app of getApps()) {
        await deleteApp(app);
      }
    }

    firebaseApp = initializeApp(config, 'wateen-cloud');
    firestoreDb = getFirestore(firebaseApp);

    try {
      firebaseAuth = getAuth(firebaseApp);
    } catch {
      firebaseAuth = null;
    }

    try {
      firebaseStorage = getStorage(firebaseApp);
    } catch {
      firebaseStorage = null;
    }

    // فحص اتصال فعلي مع خادم Firestore للتأكد من صحة المفاتيح والصلاحيات
    try {
      const probeRef = doc(firestoreDb, STATE_DOC_PATH);
      await getDoc(probeRef);
    } catch (probeErr) {
      const msg = probeErr instanceof Error ? probeErr.message : String(probeErr);
      // إذا كان الخطأ بسبب مفتاح API غير صالح أو مشروع غير موجود نفشل الاتصال بوضوح
      if (/api-key-not-valid|project.*not.*found|invalid-api-key|permission-denied/i.test(msg)) {
        await teardownFirebaseCloud();
        return {
          ok: false,
          error: `فشل التحقق من خادم Firebase (${config.projectId}): ${msg}`,
        };
      }
    }

    return { ok: true };
  } catch (err) {
    await teardownFirebaseCloud();
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر الاتصال بـ Firebase',
    };
  }
}

export async function teardownFirebaseCloud(): Promise<void> {
  if (getApps().length > 0) {
    for (const app of getApps()) {
      await deleteApp(app).catch(() => {});
    }
  }
  firebaseApp = null;
  firebaseAuth = null;
  firestoreDb = null;
  firebaseStorage = null;
}

export function isFirebaseReady(): boolean {
  return firestoreDb !== null;
}

/**
 * خدمات Firebase Authentication (تسجيل دخول المدير ومراقبة الجلسة)
 */
export async function signInAdminWithFirebaseEmail(
  email: string,
  password: string
): Promise<{ ok: boolean; userEmail?: string; uid?: string; error?: string }> {
  if (!firebaseAuth) {
    return { ok: false, error: 'خدمة Firebase Authentication غير مهيأة بعد' };
  }
  try {
    const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    return {
      ok: true,
      userEmail: cred.user.email || email.trim(),
      uid: cred.user.uid,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'فشل تسجيل الدخول عبر Firebase Auth',
    };
  }
}

export async function signInAnonymousIfAllowed(): Promise<User | null> {
  if (!firebaseAuth) return null;
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
  try {
    const cred = await signInAnonymously(firebaseAuth);
    return cred.user;
  } catch {
    return null;
  }
}

export async function signOutFirebaseAdmin(): Promise<void> {
  if (!firebaseAuth) return;
  try {
    await signOut(firebaseAuth);
  } catch {
    // ignore
  }
}

export function subscribeToFirebaseAuth(callback: (user: User | null) => void): () => void {
  if (!firebaseAuth) return () => {};
  return onAuthStateChanged(firebaseAuth, callback);
}

/**
 * قراءة البيانات مباشرة من Cloud Firestore (تُستخدم عند تسجيل الدخول أو بعد حذف التطبيق وإعادة تثبيته)
 */
export async function fetchCloudStateFromFirestore(): Promise<AppDataState | null> {
  if (!firestoreDb) return null;
  try {
    const docRef = doc(firestoreDb, STATE_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as AppDataState;
      if (data && Array.isArray(data.matches) && Array.isArray(data.standings)) {
        return data;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * الاستماع اللحظي لتعديلات قاعدة البيانات السحابية
 */
export function subscribeToCloudState(
  onData: (state: AppDataState) => void,
  onError: (err: string) => void
): Unsubscribe | null {
  if (!firestoreDb) return null;
  const docRef = doc(firestoreDb, STATE_DOC_PATH);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppDataState;
        if (data && Array.isArray(data.articles) && Array.isArray(data.matches)) {
          onData(data);
        }
      }
    },
    (err) => {
      onError(err.message || 'خطأ في المزامنة السحابية');
    }
  );
}

/**
 * حفظ البيانات في المستند الرئيسي + مجموعات Firestore المنظمة (competitions, teams, matches, standings, players, goalkeepers)
 * باستخدام معرفات ثابتة لمنع أي تكرار (Idempotent Batch Write)
 */
export async function saveCloudState(state: AppDataState): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const cleanPayload = JSON.parse(
      JSON.stringify({
        ...state,
        updatedAt: new Date().toISOString(),
      })
    ) as AppDataState;

    // 1) حفظ الحالة الموحدة للتزامن اللحظي السريع
    const mainDocRef = doc(firestoreDb, STATE_DOC_PATH);
    await setDoc(mainDocRef, cleanPayload, { merge: true });

    // 2) مزامنة المجموعات المنظمة في Firestore بدون تكرار (باستخدام docId الثابت لكل عنصر)
    try {
      const batch = writeBatch(firestoreDb);
      let opsCount = 0;
      const maxBatchOps = 450;

      // البطولات المخصصة واللوائح
      for (const [compId, rule] of Object.entries(cleanPayload.competitionRules || {})) {
        if (opsCount < maxBatchOps) {
          batch.set(doc(firestoreDb, 'competitions', compId), rule, { merge: true });
          opsCount++;
        }
      }
      for (const customComp of cleanPayload.customCompetitions || []) {
        if (opsCount < maxBatchOps && customComp.id) {
          batch.set(doc(firestoreDb, 'competitions', customComp.id), customComp, { merge: true });
          opsCount++;
        }
      }

      // الفرق
      for (const team of cleanPayload.teamsDirectory || []) {
        if (opsCount < maxBatchOps && team.id) {
          batch.set(doc(firestoreDb, 'teams', team.id), team, { merge: true });
          opsCount++;
        }
      }

      // المباريات والنتائج
      for (const match of cleanPayload.matches || []) {
        if (opsCount < maxBatchOps && match.id) {
          batch.set(doc(firestoreDb, 'matches', match.id), match, { merge: true });
          opsCount++;
        }
      }

      // جداول الترتيب
      for (const row of cleanPayload.standings || []) {
        if (opsCount < maxBatchOps && row.id) {
          batch.set(doc(firestoreDb, 'standings', row.id), row, { merge: true });
          opsCount++;
        }
      }

      // اللاعبون والهدافون
      for (const scorer of cleanPayload.scorers || []) {
        if (opsCount < maxBatchOps && scorer.id) {
          batch.set(doc(firestoreDb, 'players', scorer.id), scorer, { merge: true });
          opsCount++;
        }
      }

      // حراس المرمى
      for (const gk of cleanPayload.goalkeepers || []) {
        if (opsCount < maxBatchOps && gk.id) {
          batch.set(doc(firestoreDb, 'goalkeepers', gk.id), gk, { merge: true });
          opsCount++;
        }
      }

      if (opsCount > 0) {
        await batch.commit();
      }
    } catch {
      // في حال كانت قواعد Firestore تسمح بـ wateen_app فقط، يظل الحفظ الرئيسي ناجحاً
    }

    return true;
  } catch (err) {
    console.error('Firestore save error:', err);
    return false;
  }
}

/**
 * نقل البيانات المحلية إلى Firestore مع إنشاء نسخة احتياطية مسبقة والتحقق من تطابق عدد السجلات
 */
export async function migrateLocalDataToFirestoreWithVerification(
  localState: AppDataState
): Promise<{
  report: MigrationVerificationReport;
  mergedState: AppDataState;
}> {
  // 1) إنشاء نسخة احتياطية إلزامية قابلة للاستعادة قبل النقل
  const backupSnapshot = createPreMigrationBackupSnapshot(localState);

  if (!firestoreDb) {
    return {
      report: {
        ok: false,
        backupId: backupSnapshot.backupId,
        backupCreatedAt: backupSnapshot.createdAt,
        countsMatched: false,
        localCounts: backupSnapshot.counts,
        cloudCounts: {
          competitionsCount: 0,
          teamsCount: 0,
          matchesCount: 0,
          standingsCount: 0,
          scorersCount: 0,
          goalkeepersCount: 0,
          articlesCount: 0,
          importsCount: 0,
        },
        migratedAt: new Date().toISOString(),
        error: 'غير متصل بـ Firestore حالياً',
      },
      mergedState: localState,
    };
  }

  // 2) قراءة أي بيانات سحابية سابقة ودمجها بدون تكرار أو فقدان
  const existingCloudState = await fetchCloudStateFromFirestore();
  const mergedState = existingCloudState
    ? mergeStatesWithoutDuplication(localState, existingCloudState)
    : localState;

  const expectedCounts = computeStateRecordCounts(mergedState);

  // 3) رفع البيانات المدمجة إلى Firestore
  const saved = await saveCloudState(mergedState);
  if (!saved) {
    return {
      report: {
        ok: false,
        backupId: backupSnapshot.backupId,
        backupCreatedAt: backupSnapshot.createdAt,
        countsMatched: false,
        localCounts: expectedCounts,
        cloudCounts: {
          competitionsCount: 0,
          teamsCount: 0,
          matchesCount: 0,
          standingsCount: 0,
          scorersCount: 0,
          goalkeepersCount: 0,
          articlesCount: 0,
          importsCount: 0,
        },
        migratedAt: new Date().toISOString(),
        error: 'تعذر كتابة البيانات في Firestore — تحقق من قواعد الأمان أو تسجيل الدخول',
      },
      mergedState: localState,
    };
  }

  // 4) التحقق الفعلي من السحابة ومطابقة عدد السجلات بعد النقل
  const verifiedCloudState = await fetchCloudStateFromFirestore();
  const cloudCounts = verifiedCloudState
    ? computeStateRecordCounts(verifiedCloudState)
    : {
        competitionsCount: 0,
        teamsCount: 0,
        matchesCount: 0,
        standingsCount: 0,
        scorersCount: 0,
        goalkeepersCount: 0,
        articlesCount: 0,
        importsCount: 0,
      };

  const countsMatched = verifyRecordCountsMatch(expectedCounts, cloudCounts);

  return {
    report: {
      ok: countsMatched,
      backupId: backupSnapshot.backupId,
      backupCreatedAt: backupSnapshot.createdAt,
      countsMatched,
      localCounts: expectedCounts,
      cloudCounts,
      migratedAt: new Date().toISOString(),
      error: countsMatched ? undefined : 'عدم تطابق في عدد السجلات بعد النقل — تم الاحتفاظ بالنسخة المحلية',
    },
    mergedState: verifiedCloudState || mergedState,
  };
}

// رفع الصور إلى Firebase Storage عند تفعيله
export async function uploadMediaToCloud(blob: Blob, folder = 'news'): Promise<string | null> {
  if (!firebaseStorage) return null;
  try {
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storageRef = ref(firebaseStorage, `wateen_media/${filename}`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}

export async function queueCloudPushNotification(notification: AppNotification): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    await addDoc(collection(firestoreDb, 'push_requests'), {
      ...notification,
      topic: 'wateen_all',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function registerDevicePushToken(token: string, platform: string): Promise<void> {
  if (!firestoreDb || !token) return;
  try {
    const tokenRef = doc(firestoreDb, 'fcm_tokens', token);
    await setDoc(
      tokenRef,
      {
        token,
        platform,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // non-fatal
  }
}
