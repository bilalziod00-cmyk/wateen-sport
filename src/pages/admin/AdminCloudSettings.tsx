import React, { useState } from 'react';
import {
  Cloud,
  CloudOff,
  Download,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { FirebaseCloudConfig } from '../../types/sports';

export const AdminCloudSettings: React.FC = () => {
  const {
    cloudMode,
    cloudConfig,
    cloudSyncStatus,
    cloudError,
    connectFirebase,
    disconnectFirebase,
    pushCurrentDataToCloud,
    changeAdminPin,
    exportBackupJson,
    importBackupJson,
    resetToDemoData,
    showToast,
  } = useAppData();

  const [fbForm, setFbForm] = useState<FirebaseCloudConfig>({
    apiKey: cloudConfig?.apiKey || '',
    authDomain: cloudConfig?.authDomain || '',
    projectId: cloudConfig?.projectId || '',
    storageBucket: cloudConfig?.storageBucket || '',
    messagingSenderId: cloudConfig?.messagingSenderId || '',
    appId: cloudConfig?.appId || '',
  });

  const [newPin, setNewPin] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbForm.apiKey.trim() || !fbForm.projectId.trim()) {
      showToast('يرجى إدخال apiKey و projectId على الأقل', 'crimson');
      return;
    }
    setConnecting(true);
    await connectFirebase({
      ...fbForm,
      authDomain: fbForm.authDomain.trim() || `${fbForm.projectId.trim()}.firebaseapp.com`,
      storageBucket: fbForm.storageBucket.trim() || `${fbForm.projectId.trim()}.appspot.com`,
    });
    setConnecting(false);
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
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wateen-sport-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تحميل النسخة الاحتياطية بنجاح', 'emerald');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importBackupJson(text);
  };

  return (
    <div className="space-y-5">
      {/* حالة الاتصال السحابي */}
      <div
        className={`rounded-2xl border p-4 space-y-3 ${
          cloudMode === 'firebase'
            ? 'bg-emerald-500/10 border-emerald-500/35'
            : 'bg-[#0E1621] border-white/10'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {cloudMode === 'firebase' ? (
              <Cloud className="w-6 h-6 text-emerald-400" />
            ) : (
              <CloudOff className="w-6 h-6 text-amber-400" />
            )}
            <div>
              <h3 className="text-sm font-black text-white">
                {cloudMode === 'firebase'
                  ? `متصل بسحابة Firebase (${cloudConfig?.projectId})`
                  : 'الوضع المحلي (جاهز للربط السحابي)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {cloudMode === 'firebase'
                  ? 'أي خبر أو نتيجة تعدّلها هنا تظهر لحظياً على جميع هواتف أندرويد المثبّت عليها التطبيق.'
                  : 'اربط مشروع Firebase المجاني أدناه لتزامن فوري للبيانات والصور والإشعارات على كل الهواتف.'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-black/40 text-slate-200 border border-white/10 shrink-0">
            {cloudSyncStatus === 'connected'
              ? 'مزامنة حيّة'
              : cloudSyncStatus === 'syncing'
              ? 'جاري المزامنة...'
              : cloudSyncStatus === 'error'
              ? 'تحقق من الصلاحيات'
              : 'محلي'}
          </span>
        </div>

        {cloudError && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 px-3 py-2 text-xs text-rose-200">
            {cloudError}
          </div>
        )}

        {cloudMode === 'firebase' && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={pushCurrentDataToCloud}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-pitch-950 font-black text-xs"
            >
              <UploadCloud className="w-4 h-4" />
              رفع ومزامنة البيانات الحالية للسحابة
            </button>
            <button
              type="button"
              onClick={disconnectFirebase}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 font-bold text-xs"
            >
              فصل الاتصال السحابي
            </button>
          </div>
        )}
      </div>

      {/* نموذج ربط Firebase */}
      <form
        onSubmit={handleConnect}
        className="rounded-2xl bg-[#111B29] border border-white/10 p-4 space-y-3"
      >
        <h3 className="text-sm font-black text-white">إعدادات الربط السحابي (Firebase)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            { key: 'apiKey', label: 'API Key *', ph: 'AIzaSy...' },
            { key: 'projectId', label: 'Project ID *', ph: 'wateen-sport-app' },
            { key: 'authDomain', label: 'Auth Domain', ph: 'wateen-sport-app.firebaseapp.com' },
            { key: 'storageBucket', label: 'Storage Bucket', ph: 'wateen-sport-app.appspot.com' },
            { key: 'messagingSenderId', label: 'Messaging Sender ID', ph: '1234567890' },
            { key: 'appId', label: 'App ID', ph: '1:123456:web:abcdef' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-[11px] text-slate-400 mb-1">{f.label}</label>
              <input
                type="text"
                dir="ltr"
                value={fbForm[f.key as keyof FirebaseCloudConfig]}
                onChange={(e) => setFbForm({ ...fbForm, [f.key]: e.target.value })}
                placeholder={f.ph}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-slate-100 text-left"
              />
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={connecting}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-pitch-950 font-black text-xs"
        >
          <RefreshCw className={`w-4 h-4 ${connecting ? 'animate-spin' : ''}`} />
          {connecting ? 'جاري الربط...' : 'حفظ وتفعيل المزامنة السحابية'}
        </button>
      </form>

      {/* تغيير الرمز السري للمالك */}
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

      {/* النسخ الاحتياطي والاستعادة */}
      <div className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-3">
        <h3 className="text-sm font-black text-white">النسخ الاحتياطي وإدارة البيانات</h3>
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
            <input type="file" accept="application/json" onChange={handleImportFile} className="hidden" />
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
  );
};
