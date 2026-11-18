import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerDevicePushToken } from './firebaseService';

const PUSH_PERMISSION_ASKED_KEY = 'wateen_push_permission_asked_v1';
let listenersAttached = false;

/**
 * 1) تهيئة شريط الحالة وإخفاء شاشة البداية الأصلية بعد رسم شاشة الافتتاح السينمائية
 * (لا تطلب صلاحية الإشعارات هنا أبداً قبل اكتمال تهيئة التطبيق والانتقال للرئيسية)
 */
export async function initializeNativeDisplay(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });
  } catch {
    // ignore on unsupported platforms
  }

  try {
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {
    // ignore
  }
}

/**
 * 2) تهيئة ومعالجة صلاحيات الإشعارات (Android 13+) بعد الانتقال الفعلي للصفحة الرئيسية
 * - لا تطلب الإشعارات قبل تهيئة التطبيق
 * - لا تغلق التطبيق عند السماح أو الرفض
 * - لا تكرر طلب الصلاحية في كل تشغيل
 */
export async function initializeNotificationsAfterSplash(
  onForegroundNotification?: (title: string, body: string) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const permStatus = await PushNotifications.checkPermissions();
    let receive = permStatus.receive;

    const alreadyAsked = (() => {
      try {
        return localStorage.getItem(PUSH_PERMISSION_ASKED_KEY) === 'true';
      } catch {
        return false;
      }
    })();

    // طلب الصلاحية مرة واحدة فقط عند أول تشغيل بعد اكتمال شاشة الافتتاح
    if ((receive === 'prompt' || receive === 'prompt-with-rationale') && !alreadyAsked) {
      try {
        localStorage.setItem(PUSH_PERMISSION_ASKED_KEY, 'true');
      } catch {
        // ignore storage restrictions
      }

      try {
        const requested = await PushNotifications.requestPermissions();
        receive = requested.receive;
      } catch {
        // في حال إغلاق نافذة الصلاحية أو رفضها يستمر التطبيق بشكل طبيعي
        return;
      }
    } else if (receive === 'granted' || receive === 'denied') {
      try {
        localStorage.setItem(PUSH_PERMISSION_ASKED_KEY, 'true');
      } catch {
        // ignore
      }
    }

    // في حال الرفض، لا نقوم بأي إجراء قد يعطل التطبيق ونستمر في الصفحة الرئيسية
    if (receive !== 'granted') {
      return;
    }

    if (!listenersAttached) {
      listenersAttached = true;

      await PushNotifications.removeAllListeners().catch(() => {});

      await PushNotifications.addListener('registration', (token) => {
        if (token?.value) {
          registerDevicePushToken(token.value, Capacitor.getPlatform()).catch(() => {});
        }
      });

      await PushNotifications.addListener('registrationError', () => {
        // يتم التجاهل بأمان عند عدم وجود google-services.json دون إغلاق التطبيق
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        if (onForegroundNotification) {
          onForegroundNotification(
            notification.title || 'وتين سبورت',
            notification.body || 'تحديث رياضي جديد'
          );
        }
      });
    }

    await PushNotifications.register().catch(() => {
      // محمي أيضاً في طبقة Java الأصلية لمنع أي IllegalStateException
    });
  } catch {
    // ضمان استمرار عمل التطبيق دون أي توقف
  }
}

// الإبقاء على الدالة القديمة للتوافق مع أي استدعاء سابق
export async function initializeNativeAndroid(
  onForegroundNotification?: (title: string, body: string) => void
): Promise<void> {
  await initializeNativeDisplay();
  window.setTimeout(() => {
    initializeNotificationsAfterSplash(onForegroundNotification);
  }, 2400);
}
