const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * 1) تعيين صلاحية المدير (Custom Claims: { admin: true, role: 'admin' }) من جهة الخادم
 */
exports.assignWateenAdminClaim = onCall(async (request) => {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'غير مصرح: هذه العملية مخصصة للمدير العام فقط.');
  }

  const targetUid = request.data?.uid;
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'يرجى تحديد معرف المستخدم uid.');
  }

  await admin.auth().setCustomUserClaims(targetUid, {
    admin: true,
    role: 'admin',
  });

  await admin.firestore().collection('audit_logs').add({
    actorUid: request.auth.uid,
    targetUid,
    action: 'ASSIGN_ADMIN_CLAIM',
    timestamp: new Date().toISOString(),
  });

  return { ok: true, uid: targetUid };
});

/**
 * 2) دالة سحابية تلقائية لبث إشعارات Push Notification عبر FCM لجميع هواتف أندرويد المسجلة
 */
exports.broadcastWateenPush = onDocumentCreated('push_requests/{reqId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const payload = snap.data();
  const title = payload.title || 'وتين سبورت ⚽';
  const body = payload.body || 'تحديث جديد من الملاعب الأردنية';

  const db = admin.firestore();
  const tokensSnap = await db.collection('fcm_tokens').get();
  const tokens = tokensSnap.docs.map((d) => d.id).filter(Boolean);

  if (tokens.length === 0) {
    await snap.ref.update({ status: 'no_tokens', processedAt: new Date().toISOString() });
    return;
  }

  const chunkSize = 500;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: {
          channelId: 'wateen_breaking_news',
          sound: 'default',
          color: '#00E640',
        },
      },
      data: {
        type: String(payload.type || 'breaking'),
        competitionId: String(payload.competitionId || 'pro_league'),
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    const invalidTokens = [];
    response.responses.forEach((res, idx) => {
      if (!res.success && res.error?.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(chunk[idx]);
      }
    });
    for (const bad of invalidTokens) {
      await db.collection('fcm_tokens').doc(bad).delete();
    }
  }

  await snap.ref.update({
    status: 'sent',
    successCount,
    failureCount,
    processedAt: new Date().toISOString(),
  });
});
