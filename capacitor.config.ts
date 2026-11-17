import type { CapacitorConfig } from '@capacitor/cli';

// إعدادات حزمة أندرويد لتطبيق وتين سبورت (Wateen Sport)
const config: CapacitorConfig = {
  appId: 'com.wateensport.app',
  appName: 'وتين سبورت',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#070B10',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#070B10',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#070B10',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
