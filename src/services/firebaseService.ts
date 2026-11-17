import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  collection,
  addDoc,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { AppDataState, AppNotification, FirebaseCloudConfig } from '../types/sports';

const CONFIG_STORAGE_KEY = 'wateen_firebase_config_v1';
const STATE_DOC_PATH = 'wateen_app/main_state';

let firebaseApp: FirebaseApp | null = null;
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

export async function initFirebaseCloud(
  config: FirebaseCloudConfig
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (getApps().length > 0) {
      for (const app of getApps()) {
        await deleteApp(app);
      }
    }
    firebaseApp = initializeApp(config, 'wateen-cloud');
    firestoreDb = getFirestore(firebaseApp);
    try {
      firebaseStorage = getStorage(firebaseApp);
    } catch {
      firebaseStorage = null;
    }
    return { ok: true };
  } catch (err) {
    firebaseApp = null;
    firestoreDb = null;
    firebaseStorage = null;
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر الاتصال بـ Firebase',
    };
  }
}

export async function teardownFirebaseCloud(): Promise<void> {
  if (getApps().length > 0) {
    for (const app of getApps()) {
      await deleteApp(app);
    }
  }
  firebaseApp = null;
  firestoreDb = null;
  firebaseStorage = null;
}

export function isFirebaseReady(): boolean {
  return firestoreDb !== null;
}

// الاستماع اللحظي لتعديلات قاعدة البيانات السحابية بحيث تظهر فوراً على جميع هواتف أندرويد
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
        if (data && Array.isArray(data.articles)) {
          onData(data);
        }
      }
    },
    (err) => {
      onError(err.message || 'خطأ في المزامنة السحابية');
    }
  );
}

// حفظ الحالة كاملة على Firestore
export async function saveCloudState(state: AppDataState): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const docRef = doc(firestoreDb, STATE_DOC_PATH);
    await setDoc(docRef, { ...state, updatedAt: new Date().toISOString() }, { merge: false });
    return true;
  } catch (err) {
    console.error('Firestore save error:', err);
    return false;
  }
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

// إرسال طلب إشعار Push Notification عبر Firestore ليقوم Firebase Cloud Function ببثه فوراً عبر FCM
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

// تسجيل رمز جهاز أندرويد (FCM Token) لاستقبال الإشعارات الفورية
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
