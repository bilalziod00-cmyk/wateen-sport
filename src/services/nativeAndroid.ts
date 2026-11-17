import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerDevicePushToken } from './firebaseService';

// تهيئة إعدادات أندرويد الأصلية عند تشغيل التطبيق كـ APK (شريط الحالة، شاشة البداية، والإشعارات الفورية)
export async function initializeNativeAndroid(
  onForegroundNotification?: (title: string, body: string) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#070B10' });
  } catch {
    // ignore on unsupported platforms
  }

  try {
    await SplashScreen.hide();
  } catch {
    // ignore
  }

  try {
    const permStatus = await PushNotifications.checkPermissions();
    let receive = permStatus.receive;
    if (receive === 'prompt') {
      const requested = await PushNotifications.requestPermissions();
      receive = requested.receive;
    }

    if (receive === 'granted') {
      await PushNotifications.register();

      PushNotifications.addListener('registration', (token) => {
        registerDevicePushToken(token.value, Capacitor.getPlatform());
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        if (onForegroundNotification) {
          onForegroundNotification(
            notification.title || 'وتين سبورت',
            notification.body || 'تحديث رياضي جديد'
          );
        }
      });
    }
  } catch {
    // Push requires google-services.json inside android/app/ when built with FCM
  }
}
