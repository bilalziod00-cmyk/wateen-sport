'use strict';

/**
 * أداة سطر أوامر لمنح أول حساب إداري صلاحية المدير (Custom Claim: admin=true, role='admin')
 * التشغيل بعد تسجيل الدخول بحساب مشروعك (GOOGLE_APPLICATION_CREDENTIALS):
 *   node firebase/functions/scripts/grant-admin.js admin@yourdomain.com
 */

const admin = require('firebase-admin');

async function main() {
  const targetEmail = (process.argv[2] || '').trim();
  if (!targetEmail || !targetEmail.includes('@')) {
    console.error('الاستخدام: node firebase/functions/scripts/grant-admin.js <admin-email>');
    process.exit(1);
  }

  admin.initializeApp({ projectId: 'wateen-sport-app' });
  const user = await admin.auth().getUserByEmail(targetEmail);

  await admin.auth().setCustomUserClaims(user.uid, {
    admin: true,
    role: 'admin',
  });

  await admin.firestore().collection('audit_logs').add({
    actorUid: 'cli_bootstrap',
    targetUid: user.uid,
    targetEmail,
    action: 'BOOTSTRAP_ADMIN_CLAIM',
    timestamp: new Date().toISOString(),
  });

  console.log(`✓ تم منح صلاحية المدير بنجاح للحساب: ${targetEmail} (uid: ${user.uid})`);
  console.log('تنبيه مهم: يرجى تسجيل الخروج وإعادة تسجيل الدخول في التطبيق لتحديث التوكن.');
}

main().catch((err) => {
  console.error('خطأ أثناء منح الصلاحية:', err && err.message ? err.message : err);
  process.exit(1);
});
