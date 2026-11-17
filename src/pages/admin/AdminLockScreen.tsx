import React, { useState } from 'react';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

export const AdminLockScreen: React.FC = () => {
  const { unlockAdmin } = useAppData();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = unlockAdmin(pin);
    if (!ok) {
      setShake(true);
      setPin('');
      window.setTimeout(() => setShake(false), 450);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-2 py-8">
      <div
        className={`w-full max-w-md rounded-3xl bg-gradient-to-b from-[#131F2F] to-[#0B121B] border border-emerald-500/25 p-6 sm:p-8 shadow-2xl space-y-6 transition-transform ${
          shake ? 'translate-x-2' : ''
        }`}
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shadow-glow">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-white">لوحة تحكم المالك</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            منطقة إدارية خاصة بمالك ومدير تطبيق <strong className="text-emerald-300">وتين سبورت</strong>.
            أدخل رمز الدخول السري لإدارة الأخبار والنتائج والترتيب والإشعارات.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              رمز الدخول السري (PIN)
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="أدخل رمز المالك..."
              className="w-full rounded-2xl bg-[#070B10] border border-white/15 focus:border-emerald-400 focus:outline-none py-3.5 px-4 text-center text-lg font-black tracking-[0.4em] text-white placeholder:tracking-normal placeholder:text-sm placeholder:font-normal placeholder:text-slate-500"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-pitch-950 font-black text-sm flex items-center justify-center gap-2 shadow-glow transition-all active:scale-[0.99]"
          >
            <ShieldCheck className="w-4 h-4" />
            دخول إلى لوحة التحكم
          </button>
        </form>

        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-3.5 text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-amber-300">للمالك عند أول استخدام:</strong> الرمز الافتراضي هو{' '}
          <code className="px-1.5 py-0.5 rounded bg-black/60 text-emerald-300 font-bold">2026</code>
          ، ويمكنك تغييره فوراً من تبويب <strong>السحابة والأمان</strong> داخل لوحة التحكم.
        </div>
      </div>
    </div>
  );
};
