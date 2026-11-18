import type { CapacitorConfig } from '@capacitor/cli';

// إعدادات حزمة أندرويد لتطبيق وتين سبورت (Wateen Sport)
const config: CapacitorConfig = {
  appId: 'com.wateensport.app',
  appName: 'وتين سبورت',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'FIT_CENTER',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
