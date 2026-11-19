import React, { useState } from 'react';
import {
  BellRing,
  Bot,
  Calendar,
  Cloud,
  Cpu,
  Flame,
  LayoutGrid,
  Lock,
  MessageSquareText,
  Newspaper,
  Palette,
  Radio,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Table2,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { AdminLockScreen } from './admin/AdminLockScreen';
import { AdminNewsManager } from './admin/AdminNewsManager';
import { AdminMatchesManager } from './admin/AdminMatchesManager';
import { AdminStandingsManager } from './admin/AdminStandingsManager';
import { AdminMediaAndPushManager } from './admin/AdminMediaAndPushManager';
import { AdminLiveStreamManager } from './admin/AdminLiveStreamManager';
import { AdminCloudSettings } from './admin/AdminCloudSettings';
import { AdminSmartImportCenter } from './admin/AdminSmartImportCenter';
import { AdminAutoDesignStudio } from './admin/AdminAutoDesignStudio';
import { AdminNewsSourcesAndQueue } from './admin/AdminNewsSourcesAndQueue';
import { AdminPlayersInjuriesManager } from './admin/AdminPlayersInjuriesManager';
import { AdminAiAssistantPage } from './admin/AdminAiAssistantPage';
import { AdminAutomationAndBudget } from './admin/AdminAutomationAndBudget';
import { AdminOverviewHub } from './admin/AdminOverviewHub';
import { AdminDashboardTabId } from '../services/adminHubMetrics';
import { isLiveMatchStatus } from '../utils/matchStatus';

type AdminTab = AdminDashboardTabId;

export const AdminDashboardPage: React.FC = () => {
  const { data, isAdminUnlocked, lockAdmin, cloudConnectionState } = useAppData();
  const [tab, setTab] = useState<AdminTab>('overview');

  if (!isAdminUnlocked) {
    return <AdminLockScreen />;
  }

  const connectionLabel =
    cloudConnectionState === 'connected'
      ? 'متصل بالسحابة'
      : cloudConnectionState === 'connecting'
      ? 'جاري الاتصال'
      : cloudConnectionState === 'failed'
      ? 'فشل الاتصال'
      : 'محلي';

  const breakingCount = data.articles.filter((a) => a.isBreaking).length;
  const liveCount = data.matches.filter((m) => isLiveMatchStatus(m.status)).length;
  const activeStreamsCount = (data.liveStreams || []).filter((s) => s.isLive).length;
  const pendingImportsCount = (data.importBatches || []).filter(
    (b) => b.status === 'Pending Review' || b.status === 'Needs Correction'
  ).length;
  const reviewQueueCount = (data.reviewQueueArticles || []).length;
  const activeAlertsCount = (data.automationAlerts || []).filter((a) => !a.resolved).length;

  const tabs: { id: AdminTab; label: string; icon: React.ElementType; highlight?: boolean }[] = [
    {
      id: 'overview',
      label: 'المركز الموحد (18)',
      icon: LayoutGrid,
    },
    {
      id: 'smart_import',
      label: `الإدخال الذكي AI${pendingImportsCount ? ` (${pendingImportsCount})` : ''}`,
      icon: Sparkles,
    },
    {
      id: 'news_intel',
      label: `الذكاء الإخباري${reviewQueueCount ? ` (${reviewQueueCount})` : ''}`,
      icon: Bot,
    },
    {
      id: 'automation_budget',
      label: `الأتمتة والميزانية${activeAlertsCount ? ` (${activeAlertsCount})` : ''}`,
      icon: Cpu,
      highlight: activeAlertsCount > 0,
    },
    { id: 'ai_assistant', label: 'المساعد الذكي AI', icon: MessageSquareText },
    { id: 'news', label: 'الأخبار والتحرير', icon: Newspaper },
    {
      id: 'live',
      label: `البث المباشر${activeStreamsCount ? ` (${activeStreamsCount})` : ''}`,
      icon: Radio,
      highlight: true,
    },
    { id: 'matches', label: 'المباريات والنتائج', icon: Calendar },
    { id: 'standings', label: 'الترتيب والهدافون', icon: Table2 },
    { id: 'players_medical', label: 'اللاعبون والإصابات', icon: Stethoscope },
    { id: 'auto_design', label: 'التصميم التلقائي', icon: Palette },
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
                لوحة التحكم الإدارية — وتين سبورت | WATEEN SPORT
              </h1>
              <p className="text-[11px] text-slate-300">
                الإدخال الذكي بالذكاء الاصطناعي وإدارة البطولات (حالة الاتصال: {connectionLabel})
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
            <div className="text-lg font-black text-amber-300">
              {(data.importBatches || []).length}
            </div>
            <div className="text-[10px] text-slate-400">عمليات الاستيراد</div>
          </div>
        </div>
      </div>

      {/* شريط أقسام لوحة التحكم - متجاوب بحيث تظهر كل التبويبات بدون قص */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                isActive
                  ? t.highlight
                    ? 'bg-rose-600 text-white border-rose-400 shadow-glow-red'
                    : 'bg-emerald-500 text-pitch-950 border-emerald-400 shadow-glow'
                  : t.highlight
                  ? 'bg-rose-500/10 text-rose-200 border-rose-500/35 hover:border-rose-400'
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
        {tab === 'overview' && <AdminOverviewHub onNavigateTab={setTab} />}
        {tab === 'smart_import' && <AdminSmartImportCenter />}
        {tab === 'news_intel' && <AdminNewsSourcesAndQueue />}
        {tab === 'automation_budget' && <AdminAutomationAndBudget />}
        {tab === 'ai_assistant' && <AdminAiAssistantPage />}
        {tab === 'news' && <AdminNewsManager />}
        {tab === 'live' && <AdminLiveStreamManager />}
        {tab === 'matches' && <AdminMatchesManager />}
        {tab === 'standings' && <AdminStandingsManager />}
        {tab === 'players_medical' && <AdminPlayersInjuriesManager />}
        {tab === 'auto_design' && <AdminAutoDesignStudio />}
        {tab === 'media_push' && <AdminMediaAndPushManager />}
        {tab === 'cloud' && <AdminCloudSettings />}
      </div>
    </div>
  );
};
