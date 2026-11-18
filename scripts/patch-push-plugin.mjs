import fs from 'node:fs';
import path from 'node:path';

const pluginJavaPath = path.resolve(
  process.cwd(),
  'node_modules/@capacitor/push-notifications/android/src/main/java/com/capacitorjs/plugins/pushnotifications/PushNotificationsPlugin.java'
);

if (fs.existsSync(pluginJavaPath)) {
  let content = fs.readFileSync(pluginJavaPath, 'utf8');

  if (!content.includes('catch (Throwable e)')) {
    content = content.replace(
      /@PluginMethod\s+public void register\(PluginCall call\)\s*\{[\s\S]*?@PluginMethod\s+public void unregister\(PluginCall call\)\s*\{[\s\S]*?\n    \}/m,
      `@PluginMethod
    public void register(PluginCall call) {
        try {
            FirebaseMessaging.getInstance().setAutoInitEnabled(true);
            FirebaseMessaging
                .getInstance()
                .getToken()
                .addOnCompleteListener(
                    task -> {
                        if (!task.isSuccessful()) {
                            Exception ex = task.getException();
                            sendError(ex != null ? ex.getLocalizedMessage() : "FCM token registration skipped");
                            return;
                        }
                        sendToken(task.getResult());
                    }
                );
            call.resolve();
        } catch (Throwable e) {
            sendError(e.getLocalizedMessage());
            call.resolve();
        }
    }

    @PluginMethod
    public void unregister(PluginCall call) {
        try {
            FirebaseMessaging.getInstance().setAutoInitEnabled(false);
            FirebaseMessaging.getInstance().deleteToken();
            call.resolve();
        } catch (Throwable e) {
            call.resolve();
        }
    }`
    );

    fs.writeFileSync(pluginJavaPath, content, 'utf8');
    console.log('[Wateen Sport] Patched PushNotificationsPlugin.java to prevent Android 13+ crash when google-services.json is absent.');
  }
}
