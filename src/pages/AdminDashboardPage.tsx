import React, { useState } from 'react';
import {
  BellRing,
  Calendar,
  Cloud,
  Flame,
  Lock,
  Newspaper,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { AdminLockScreen } from './admin/AdminLockScreen';
import { AdminNewsManager } from './admin/AdminNewsManager';
import { AdminMatchesManager } from './admin/AdminMatchesManager';
import { AdminStandingsManager } from './admin/AdminStandingsManager';
import { AdminMediaAndPushManager } from './admin/AdminMediaAndPushManager';
import { AdminCloudSettings } from './admin/AdminCloudSettings';

type AdminTab = 'news' | 'matches' | 'standings' | 'media_push' | 'cloud';

export const AdminDashboardPage: React.FC = () => {
  const { data, isAdminUnlocked, lockAdmin, cloudMode } = useAppData();
  const [tab, setTab] = useState<AdminTab>('news');

  if (!isAdminUnlocked) {
    return <AdminLockScreen />;
  }

  const breakingCount = data.articles.filter((a) => a.isBreaking).length;
  const liveCount = data.matches.filter((m) => m.status === 'live').length;

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'news', label: 'الأخبار', icon: Newspaper },
    { id: 'matches', label: 'المباريات', icon: Calendar },
    { id: 'standings', label: 'الترتيب', icon: Table2 },
    { id: 'media_push', label: 'البنرات والإشعارات', icon: BellRing },
    { id: 'cloud', label: 'السحابة والأمان', icon: Cloud },
  ];

  return (
    <div className="space-y-5 pb-8">
      {/* ترويسة لوحة المالك */}
      <div className="rounded-3xl bg-gradient-to-l from-emerald-600/25 via-[#111C2B] to-[#0B121B] border border-emerald-500/30 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white">
                لوحة التحكم الإدارية — وتين سبورت
              </h1>
              <p className="text-[11px] text-slate-300">
                تحكم كامل وفوري بجميع أقسام التطبيق ({cloudMode === 'firebase' ? 'متصل بالسحابة' : 'وضع محلي'})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={lockAdmin}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-extrabold shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            قفل اللوحة
          </button>
        </div>

        {/* مؤشرات سريعة */}
        <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
          <div className="rounded-2xl bg-black/35 border border-white/10 py-2.5 px-1">
            <div className="text-lg font-black text-white">{data.articles.length}</div>
            <div className="text-[10px] text-slate-400">الأخبار</div>
          </div>
          <div className="rounded-2xl bg-black/35 border border-white/10 py-2.5 px-1">
            <div className="text-lg font-black text-rose-400 flex items-center justify-center gap-0.5">
              <Flame className="w-3.5 h-3.5" />
              {breakingCount}
            </div>
            <div className="text-[10px] text-slate-400">عاجل</div>
          </div>
          <div className="rounded-2xl bg-black/35 border border-white/10 py-2.5 px-1">
            <div className="text-lg font-black text-emerald-400">{liveCount}</div>
            <div className="text-[10px] text-slate-400">مباشر الآن</div>
          </div>
          <div className="rounded-2xl bg-black/35 border border-white/10 py-2.5 px-1">
            <div className="text-lg font-black text-amber-300">{data.notifications.length}</div>
            <div className="text-[10px] text-slate-400">الإشعارات</div>
          </div>
        </div>
      </div>

      {/* شريط أقسام لوحة التحكم - متجاوب بحيث تظهر كل التبويبات بدون قص */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {tabs.map((t, idx) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                idx === 4 ? 'col-span-2 sm:col-span-1' : ''
              } ${
                tab === t.id
                  ? 'bg-emerald-500 text-pitch-950 border-emerald-400 shadow-glow'
                  : 'bg-[#0E1621] text-slate-300 border-white/10 hover:border-white/25'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* القسم النشط */}
      <div>
        {tab === 'news' && <AdminNewsManager />}
        {tab === 'matches' && <AdminMatchesManager />}
        {tab === 'standings' && <AdminStandingsManager />}
        {tab === 'media_push' && <AdminMediaAndPushManager />}
        {tab === 'cloud' && <AdminCloudSettings />}
      </div>
    </div>
  );
};
