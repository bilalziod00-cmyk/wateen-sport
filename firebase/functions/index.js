const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { rewriteAndVerifySportsNews } = require('./wateenAiCore');
const { collectAndProcessNewsBatch } = require('./newsCollector');

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

/**
 * 3) دالة سحابية آمنة لتشغيل جامع الأخبار الذكي (News Intelligence) على الخادم
 * جميع مفاتيح OpenAI/Gemini تبقى على الخادم فقط ولا تصل أبداً إلى التطبيق
 */
exports.runWateenNewsCollection = onCall(async (request) => {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'غير مصرح: تشغيل جامع الأخبار مخصص للمدير فقط.');
  }

  const db = admin.firestore();
  const [sourcesSnap, newsSnap, queueSnap, settingsSnap] = await Promise.all([
    db.collection('news_sources').get(),
    db.collection('news').orderBy('publishedAt', 'desc').limit(150).get().catch(() => ({ docs: [] })),
    db.collection('review_queue').limit(150).get().catch(() => ({ docs: [] })),
    db.collection('app_settings').doc('automation').get().catch(() => null),
  ]);

  const sources = sourcesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const existingArticles = [
    ...newsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    ...queueSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  ];
  const settings = settingsSnap && settingsSnap.exists ? settingsSnap.data() : {};

  const result = await collectAndProcessNewsBatch({
    sources,
    existingArticles,
    settings,
    maxItemsPerSource: Number(request.data?.maxItemsPerSource || 6),
  });

  const batch = db.batch();
  for (const art of result.published) {
    batch.set(db.collection('news').doc(art.id), art, { merge: true });
  }
  for (const art of result.queued) {
    batch.set(db.collection('review_queue').doc(art.id), art, { merge: true });
  }
  for (const upd of result.sourceUpdates) {
    batch.set(db.collection('news_sources').doc(upd.id), upd, { merge: true });
  }
  if (result.budgetUsageDelta.requestsUsed > 0) {
    batch.set(
      db.collection('app_settings').doc('automation'),
      {
        dailyRequestsUsed: admin.firestore.FieldValue.increment(result.budgetUsageDelta.requestsUsed),
        monthlySpentEstimateUsd: admin.firestore.FieldValue.increment(result.budgetUsageDelta.totalCostUsd),
        lastNewsRunAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
  await batch.commit();

  await db.collection('audit_logs').add({
    actorUid: request.auth.uid,
    action: 'NEWS_INTELLIGENCE_RUN',
    publishedCount: result.published.length,
    queuedCount: result.queued.length,
    rejectedCount: result.rejected.length,
    timestamp: new Date().toISOString(),
  });

  return {
    ok: true,
    publishedCount: result.published.length,
    queuedCount: result.queued.length,
    rejectedCount: result.rejected.length,
    sourceUpdates: result.sourceUpdates,
  };
});

/**
 * 4) إعادة صياغة خبر واحد عبر محرك WATEEN AI على الخادم (OpenAI / Gemini)
 */
exports.rewriteNewsWithWateenAi = onCall(async (request) => {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'غير مصرح: هذه العملية مخصصة للمدير فقط.');
  }
  const rawItem = request.data?.rawItem;
  const source = request.data?.source || { name: 'مصدر رسمي', trustedForAutoPublish: false };
  if (!rawItem || !rawItem.title) {
    throw new HttpsError('invalid-argument', 'يجب تزويد عنوان ونص الخبر الأصلي.');
  }

  const db = admin.firestore();
  const settingsSnap = await db.collection('app_settings').doc('automation').get().catch(() => null);
  const settings = settingsSnap && settingsSnap.exists ? settingsSnap.data() : {};

  const out = await rewriteAndVerifySportsNews({ rawItem, source, settings, existingArticles: [] });
  return { ok: true, ...out };
});
