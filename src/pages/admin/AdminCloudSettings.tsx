import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  Download,
  FileJson,
  KeyRound,
  LogIn,
  LogOut,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Trophy,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import {
  CloudConnectionState,
  CompetitionId,
  CustomCompetitionItem,
  FirebaseCloudConfig,
} from '../../types/sports';
import {
  EXPECTED_ANDROID_PACKAGE_NAME,
  EXPECTED_FIREBASE_PROJECT_ID,
  parseGoogleServicesOrFirebaseConfig,
} from '../../services/firebaseService';
import { computeStateRecordCounts } from '../../services/persistentStorageService';
import { COMPETITIONS, PRIMARY_COMPETITION_LIST } from '../../constants/competitions';

const CONNECTION_STATE_META: Record<
  CloudConnectionState,
  { label: string; badgeStyle: string; boxStyle: string; desc: string }
> = {
  local: {
    label: 'محلي',
    badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    boxStyle: 'bg-[#0E1621] border-white/10',
    desc: 'البيانات محفوظة محلياً بأمان في الجهاز (localStorage + IndexedDB) مع نسخة احتياطية كاملة. ارفع ملف google-services.json أو أدخل مفاتيح مشروع wateen-sport-app لتفعيل المزامنة السحابية.',
  },
  connecting: {
    label: 'جاري الاتصال',
    badgeStyle: 'bg-sky-500/20 text-sky-300 border-sky-500/40 animate-pulse',
    boxStyle: 'bg-sky-950/20 border-sky-500/35',
    desc: 'جاري الاتصال بخوادم Firebase والتحقق من المصادقة ومطابقة السجلات...',
  },
  connected: {
    label: 'متصل بالسحابة',
    badgeStyle: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50',
    boxStyle: 'bg-emerald-500/10 border-emerald-500/35',
    desc: 'متصل فعلياً بقاعدة بيانات Cloud Firestore؛ جميع البطولات والمباريات والنتائج والترتيب متزامنة لحظياً.',
  },
  failed: {
    label: 'فشل الاتصال',
    badgeStyle: 'bg-rose-500/25 text-rose-200 border-rose-500/50',
    boxStyle: 'bg-rose-950/25 border-rose-500/40',
    desc: 'تعذر الاتصال بخادم Firebase؛ تحقق من صحة المفاتيح أو قواعد أمان Firestore. بياناتك المحلية محفوظة بالكامل ولم يفقد منها شيء.',
  },
};

export const AdminCloudSettings: React.FC = () => {
  const {
    data,
    cloudConnectionState,
    cloudConfig,
    cloudError,
    firebaseUserEmail,
    preMigrationBackup,
    lastMigrationReport,
    connectFirebase,
    disconnectFirebase,
    pullDataFromCloudNow,
    migrateLocalDataToCloudVerified,
    createBackupSnapshotNow,
    restorePreMigrationBackup,
    loginAdminWithFirebaseEmail,
    logoutFirebaseAdmin,
    saveCustomCompetition,
    deleteCustomCompetition,
    changeAdminPin,
    exportBackupJson,
    importBackupJson,
    resetToDemoData,
    showToast,
  } = useAppData();

  const [fbForm, setFbForm] = useState<FirebaseCloudConfig>({
    apiKey: cloudConfig?.apiKey || '',
    authDomain: cloudConfig?.authDomain || `${EXPECTED_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: cloudConfig?.projectId || EXPECTED_FIREBASE_PROJECT_ID,
    storageBucket: cloudConfig?.storageBucket || `${EXPECTED_FIREBASE_PROJECT_ID}.appspot.com`,
    messagingSenderId: cloudConfig?.messagingSenderId || '',
    appId: cloudConfig?.appId || '',
  });

  const [configWarning, setConfigWarning] = useState<string | null>(null);
  const [rawConfigPaste, setRawConfigPaste] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // نموذج إضافة بطولة جديدة لاختبار الحفظ والمزامنة
  const [compName, setCompName] = useState<string>('');
  const [compSeason, setCompSeason] = useState<string>('2026 / 2027');
  const [compAge, setCompAge] = useState<string>('الفريق الأول');
  const [compParent, setCompParent] = useState<CompetitionId>('pro_league');

  const [newPin, setNewPin] = useState('');
  const [connecting, setConnecting] = useState(false);

  const currentCounts = computeStateRecordCounts(data);
  const connMeta = CONNECTION_STATE_META[cloudConnectionState];

  // استيراد ملف google-services.json مباشرة واستخراج إعدادات مشروع wateen-sport-app
  const handleGoogleServicesFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseGoogleServicesOrFirebaseConfig(text);
    e.target.value = '';

    if (!parsed.ok || !parsed.config) {
      showToast(parsed.error || 'ملف google-services.json غير صالح', 'crimson');
      return;
    }

    setFbForm(parsed.config);
    setConfigWarning(parsed.warning || null);
    showToast(
      `تم استخراج إعدادات مشروع (${parsed.config.projectId}) من الملف بنجاح — جاري الاتصال...`,
      'emerald'
    );
    setConnecting(true);
    await connectFirebase(parsed.config);
    setConnecting(false);
  };

  // تحليل نص google-services.json أو firebaseConfig الملصق
  const handleParsePastedConfig = async () => {
    const parsed = parseGoogleServicesOrFirebaseConfig(rawConfigPaste);
    if (!parsed.ok || !parsed.config) {
      showToast(parsed.error || 'تعذر قراءة إعدادات Firebase من النص الملصق', 'crimson');
      return;
    }
    setFbForm(parsed.config);
    setConfigWarning(parsed.warning || null);
    setRawConfigPaste('');
    setConnecting(true);
    await connectFirebase(parsed.config);
    setConnecting(false);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbForm.apiKey.trim() || !fbForm.projectId.trim()) {
      showToast('يرجى إدخال API Key و Project ID (wateen-sport-app) لتفعيل الاتصال الفعلي', 'crimson');
      return;
    }
    const pId = fbForm.projectId.trim();
    if (pId !== EXPECTED_FIREBASE_PROJECT_ID) {
      setConfigWarning(
        `تنبيه: معرف المشروع المدخل هو (${pId}) بينما المشروع القياسي المعتمد هو (${EXPECTED_FIREBASE_PROJECT_ID})`
      );
    } else {
      setConfigWarning(null);
    }

    setConnecting(true);
    await connectFirebase({
      ...fbForm,
      projectId: pId,
      authDomain: fbForm.authDomain.trim() || `${pId}.firebaseapp.com`,
      storageBucket: fbForm.storageBucket.trim() || `${pId}.appspot.com`,
    });
    setConnecting(false);
  };

  const handleFirebaseEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      showToast('يرجى إدخال البريد الإلكتروني وكلمة المرور لحساب المدير في Firebase Auth', 'crimson');
      return;
    }
    setAuthLoading(true);
    await loginAdminWithFirebaseEmail(adminEmail, adminPassword);
    setAdminPassword('');
    setAuthLoading(false);
  };

  const handleAddCustomCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) {
      showToast('يرجى إدخال اسم البطولة الجديدة', 'crimson');
      return;
    }
    const item: CustomCompetitionItem = {
      id: `comp-custom-${Date.now()}`,
      name: compName.trim(),
      shortName: compName.trim().slice(0, 16),
      season: compSeason.trim() || '2026 / 2027',
      ageCategory: compAge.trim() || 'الفريق الأول',
      tierLabel: COMPETITIONS[compParent].tierLabel,
      parentCompetitionId: compParent,
      groups: ['المجموعة الأولى', 'المجموعة الثانية'],
      createdAt: new Date().toISOString(),
    };
    await saveCustomCompetition(item);
    setCompName('');
  };

  const handlePinSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length < 4) {
      showToast('اختر رمزاً مكوناً من 4 أرقام أو أكثر', 'crimson');
      return;
    }
    await changeAdminPin(newPin.trim());
    setNewPin('');
  };

  const handleDownloadBackup = () => {
    createBackupSnapshotNow();
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wateen-sport-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم حفظ وتحميل النسخة الاحتياطية الكاملة بنجاح', 'emerald');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importBackupJson(text);
  };

  return (
    <div className="space-y-5">
      {/* 1. حالة الاتصال السحابي الواضحة (محلي / جاري الاتصال / متصل بالسحابة / فشل الاتصال) */}
      <div className={`rounded-3xl border p-4 sm:p-5 space-y-4 ${connMeta.boxStyle}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {cloudConnectionState === 'connected' ? (
              <Cloud className="w-7 h-7 text-emerald-400 shrink-0" />
            ) : cloudConnectionState === 'connecting' ? (
              <RefreshCw className="w-7 h-7 text-sky-400 animate-spin shrink-0" />
            ) : cloudConnectionState === 'failed' ? (
              <AlertTriangle className="w-7 h-7 text-rose-400 shrink-0" />
            ) : (
              <CloudOff className="w-7 h-7 text-amber-400 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">
                  حالة المزامنة: {connMeta.label}
                </h3>
                {cloudConfig?.projectId && (
                  <span className="text-[11px] font-mono text-emerald-300 bg-black/40 px-2 py-0.5 rounded-lg border border-white/10">
                    {cloudConfig.projectId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{connMeta.desc}</p>
            </div>
          </div>

          {/* الشارة الرسمية للحالات الأربع المطلوبة */}
          <div className="flex items-center gap-1.5">
            {(['local', 'connecting', 'connected', 'failed'] as CloudConnectionState[]).map(
              (st) => {
                const active = cloudConnectionState === st;
                return (
                  <span
                    key={st}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black border transition-all ${
                      active
                        ? CONNECTION_STATE_META[st].badgeStyle
                        : 'bg-black/30 text-slate-500 border-white/5 opacity-60'
                    }`}
                  >
                    {CONNECTION_STATE_META[st].label}
                  </span>
                );
              }
            )}
          </div>
        </div>

        {cloudError && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/35 px-3.5 py-2.5 text-xs text-rose-200 font-bold">
            سبب الخطأ: {cloudError}
          </div>
        )}

        {configWarning && (
          <div className="rounded-xl bg-amber-500/15 border border-amber-500/35 px-3.5 py-2.5 text-xs text-amber-200 font-bold">
            {configWarning}
          </div>
        )}

        {/* أزرار النقل الموثق والاسترجاع السحابي */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={migrateLocalDataToCloudVerified}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-glow"
          >
            <UploadCloud className="w-4 h-4" />
            نقل البيانات المحلية إلى Firestore مع التحقق من السجلات
          </button>

          <button
            type="button"
            onClick={pullDataFromCloudNow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 font-extrabold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            قراءة واسترجاع البيانات من السحابة الآن
          </button>

          {cloudConnectionState === 'connected' && (
            <button
              type="button"
              onClick={disconnectFirebase}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 font-bold text-xs"
            >
              فصل الاتصال السحابي
            </button>
          )}
        </div>
      </div>

      {/* 2. خريطة وجرد البيانات المحلية والنسخة الاحتياطية ومطابقة السجلات */}
      <div className="rounded-3xl bg-[#0D1622] border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-black text-white">
                جرد البيانات المحلية والنسخة الاحتياطية ومطابقة النقل السحابي
              </h3>
              <p className="text-[11px] text-slate-400">
                المعرف الثابت للتطبيق: <span className="font-mono text-emerald-300">{EXPECTED_ANDROID_PACKAGE_NAME}</span> • مشروع Firebase المعتمد: <span className="font-mono text-emerald-300">{EXPECTED_FIREBASE_PROJECT_ID}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={createBackupSnapshotNow}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-extrabold"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              تحديث لقطة الأمان قبل النقل
            </button>
            {preMigrationBackup && (
              <button
                type="button"
                onClick={restorePreMigrationBackup}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-extrabold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                استعادة نسخة ما قبل النقل
              </button>
            )}
          </div>
        </div>

        {/* جدول عدد السجلات الفعلي في كل قسم */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center tabular-nums">
          {[
            { label: 'البطولات', local: currentCounts.competitionsCount, cloud: lastMigrationReport?.cloudCounts.competitionsCount },
            { label: 'الفرق والأندية', local: currentCounts.teamsCount, cloud: lastMigrationReport?.cloudCounts.teamsCount },
            { label: 'المباريات والنتائج', local: currentCounts.matchesCount, cloud: lastMigrationReport?.cloudCounts.matchesCount },
            { label: 'صفوف الترتيب', local: currentCounts.standingsCount, cloud: lastMigrationReport?.cloudCounts.standingsCount },
            { label: 'اللاعبون والهدافون', local: currentCounts.scorersCount, cloud: lastMigrationReport?.cloudCounts.scorersCount },
            { label: 'حراس المرمى', local: currentCounts.goalkeepersCount, cloud: lastMigrationReport?.cloudCounts.goalkeepersCount },
            { label: 'الأخبار', local: currentCounts.articlesCount, cloud: lastMigrationReport?.cloudCounts.articlesCount },
            { label: 'دفعات الاستيراد', local: currentCounts.importsCount, cloud: lastMigrationReport?.cloudCounts.importsCount },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl bg-black/45 border border-white/10 p-2.5 space-y-1"
            >
              <div className="text-[10px] font-bold text-slate-400">{item.label}</div>
              <div className="text-base font-black text-white">{item.local}</div>
              {item.cloud !== undefined && (
                <div className="text-[10px] font-extrabold text-emerald-400">
                  سحابي: {item.cloud}
                </div>
              )}
            </div>
          ))}
        </div>

        {preMigrationBackup && (
          <div className="rounded-2xl bg-black/50 border border-emerald-500/25 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-300 font-bold">
              ✓ النسخة الاحتياطية المحمية جاهزة: <span className="font-mono text-emerald-300">{preMigrationBackup.backupId}</span> ({preMigrationBackup.checksum})
            </span>
            <span className="text-[11px] text-slate-400">
              محفوظة في localStorage و IndexedDB ولا تُحذف البيانات المحلية إلا بعد مطابقة السجلات
            </span>
          </div>
        )}

        {lastMigrationReport && (
          <div
            className={`rounded-2xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
              lastMigrationReport.countsMatched
                ? 'bg-emerald-950/35 border-emerald-500/45 text-emerald-200'
                : 'bg-rose-950/35 border-rose-500/45 text-rose-200'
            }`}
          >
            <span className="font-extrabold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {lastMigrationReport.countsMatched
                ? 'تم التحقق من النقل السحابي ومطابقة عدد السجلات بنجاح 100% دون تكرار أو فقدان'
                : lastMigrationReport.error || 'تعذر التحقق من تطابق السجلات السحابية'}
            </span>
            <span className="text-[11px] opacity-80">{lastMigrationReport.migratedAt}</span>
          </div>
        )}
      </div>

      {/* 3. ربط مشروع Firebase (wateen-sport-app) عبر رفع google-services.json أو إدخال المفاتيح */}
      <div className="rounded-3xl bg-[#111B29] border border-emerald-500/30 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <FileJson className="w-4 h-4 text-emerald-400" />
              ربط مشروع Firebase الفعلي ({EXPECTED_FIREBASE_PROJECT_ID})
            </h3>
            <p className="text-[11px] text-slate-400">
              ارفع ملف <span className="font-mono text-emerald-300">google-services.json</span> مباشرة أو الصق محتواه ليقوم النظام باستخراج المفاتيح والاتصال تلقائياً
            </p>
          </div>

          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-black">
            <Upload className="w-4 h-4" />
            رفع ملف google-services.json
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleGoogleServicesFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* صندوق لصق محتوى google-services.json أو firebaseConfig */}
        <div className="space-y-2">
          <textarea
            rows={3}
            dir="ltr"
            value={rawConfigPaste}
            onChange={(e) => setRawConfigPaste(e.target.value)}
            placeholder='أو الصق هنا محتوى ملف google-services.json أو كود const firebaseConfig = { apiKey: "...", projectId: "wateen-sport-app", ... }'
            className="w-full rounded-xl bg-[#070B10] border border-white/15 p-3 text-xs text-slate-200 font-mono text-left"
          />
          {rawConfigPaste.trim() && (
            <button
              type="button"
              onClick={handleParsePastedConfig}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black text-xs"
            >
              استخراج الإعدادات من النص والاتصال فوراً
            </button>
          )}
        </div>

        <form onSubmit={handleConnect} className="space-y-3 pt-2 border-t border-white/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { key: 'apiKey', label: 'API Key *', ph: 'AIzaSy...' },
              { key: 'projectId', label: 'Project ID *', ph: EXPECTED_FIREBASE_PROJECT_ID },
              {
                key: 'authDomain',
                label: 'Auth Domain',
                ph: `${EXPECTED_FIREBASE_PROJECT_ID}.firebaseapp.com`,
              },
              {
                key: 'storageBucket',
                label: 'Storage Bucket',
                ph: `${EXPECTED_FIREBASE_PROJECT_ID}.appspot.com`,
              },
              { key: 'messagingSenderId', label: 'Messaging Sender ID', ph: '1234567890' },
              { key: 'appId', label: 'App ID', ph: '1:123456:android:abcdef' },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-[11px] text-slate-400 mb-1">{f.label}</label>
                <input
                  type="text"
                  dir="ltr"
                  value={fbForm[f.key as keyof FirebaseCloudConfig]}
                  onChange={(e) => setFbForm({ ...fbForm, [f.key]: e.target.value })}
                  placeholder={f.ph}
                  className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-slate-100 text-left font-mono"
                />
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={connecting}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-pitch-950 font-black text-xs shadow-glow"
          >
            <RefreshCw className={`w-4 h-4 ${connecting ? 'animate-spin' : ''}`} />
            {connecting ? 'جاري الاتصال والتحقق...' : 'حفظ وتفعيل الربط السحابي ونقل البيانات'}
          </button>
        </form>
      </div>

      {/* 4. مصادقة المدير عبر Firebase Authentication لاسترجاع البيانات عند تسجيل الدخول أو إعادة تثبيت التطبيق */}
      <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <LogIn className="w-4 h-4 text-emerald-400" />
              تسجيل الدخول السحابي (Firebase Authentication)
            </h3>
            <p className="text-[11px] text-slate-400">
              عند تسجيل الدخول بعد إعادة تثبيت التطبيق، يقوم النظام بقراءة واستعادة جميع البطولات والمباريات والترتيب من السحابة تلقائياً
            </p>
          </div>
          {firebaseUserEmail && (
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold">
              متصل كـ: {firebaseUserEmail}
            </span>
          )}
        </div>

        <form onSubmit={handleFirebaseEmailLogin} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="email"
            dir="ltr"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@wateensport.com"
            className="rounded-xl bg-[#070B10] border border-white/15 px-3 py-2 text-xs text-white text-left"
          />
          <input
            type="password"
            dir="ltr"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="كلمة مرور Firebase Auth"
            className="rounded-xl bg-[#070B10] border border-white/15 px-3 py-2 text-xs text-white text-left"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={authLoading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              {authLoading ? 'جاري الدخول...' : 'تسجيل الدخول واستعادة البيانات'}
            </button>
            {firebaseUserEmail && (
              <button
                type="button"
                onClick={logoutFirebaseAdmin}
                className="px-3 py-2 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-bold"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 5. إدارة وإضافة بطولة جديدة (للتأكد من حفظ البطولات ومزامنتها وبقائها بعد إعادة التشغيل) */}
      <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-black text-white flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-emerald-400" />
          إضافة بطولة أو موسم جديد (تُحفظ محلياً وفي Firestore تلقائياً)
        </h3>

        <form
          onSubmit={handleAddCustomCompetition}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2.5"
        >
          <input
            type="text"
            value={compName}
            onChange={(e) => setCompName(e.target.value)}
            placeholder="اسم البطولة (مثال: بطولة درع المئوية)"
            className="rounded-xl bg-[#070B10] border border-white/15 px-3 py-2 text-xs text-white font-bold"
          />
          <input
            type="text"
            value={compSeason}
            onChange={(e) => setCompSeason(e.target.value)}
            placeholder="الموسم (2026 / 2027)"
            className="rounded-xl bg-[#070B10] border border-white/15 px-3 py-2 text-xs text-white"
          />
          <select
            value={compParent}
            onChange={(e) => setCompParent(e.target.value as CompetitionId)}
            className="rounded-xl bg-[#070B10] border border-white/15 px-3 py-2 text-xs text-white font-bold"
          >
            {PRIMARY_COMPETITION_LIST.map((cid) => (
              <option key={cid} value={cid}>
                تصنيف: {COMPETITIONS[cid].name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs"
          >
            <PlusCircle className="w-4 h-4" />
            إضافة البطولة وحفظها
          </button>
        </form>

        {(data.customCompetitions || []).length > 0 && (
          <div className="space-y-1.5 pt-2">
            {(data.customCompetitions || []).map((cc) => (
              <div
                key={cc.id}
                className="flex items-center justify-between rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-black text-emerald-300">{cc.name}</span>
                  <span className="text-slate-400 mx-2">• الموسم: {cc.season}</span>
                  <span className="text-slate-500">({cc.ageCategory})</span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteCustomCompetition(cc.id)}
                  className="text-rose-400 hover:text-rose-300 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. تغيير الرمز السري والنسخ الاحتياطي JSON */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form
          onSubmit={handlePinSave}
          className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-3"
        >
          <h3 className="text-sm font-black text-white flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-amber-400" />
            تغيير رمز دخول لوحة التحكم (PIN)
          </h3>
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="أدخل الرمز السري الجديد (4 أرقام فأكثر)"
              className="flex-1 rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-400 text-pitch-950 font-black text-xs shrink-0"
            >
              تحديث الرمز
            </button>
          </div>
        </form>

        <div className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-3">
          <h3 className="text-sm font-black text-white">تصدير واستيراد ملف النسخة الاحتياطية</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-300 text-xs font-extrabold"
            >
              <Download className="w-4 h-4" />
              تصدير نسخة احتياطية JSON
            </button>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-extrabold cursor-pointer">
              <Upload className="w-4 h-4" />
              استيراد نسخة JSON
              <input
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={resetToDemoData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs font-extrabold"
            >
              <RotateCcw className="w-4 h-4" />
              استعادة البيانات الافتراضية
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
