import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpLeft,
  CheckCircle2,
  ClipboardList,
  Database,
  DollarSign,
  Globe,
  Layers,
  Newspaper,
  Radio,
  ShieldCheck,
  Stethoscope,
  Trophy,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import {
  ADMIN_CENTRAL_18_SECTIONS,
  AdminDashboardTabId,
  computeAdminDashboardKpis,
} from '../../services/adminHubMetrics';
import { formatAmmanDateTime } from '../../utils/ammanTime';

interface AdminOverviewHubProps {
  onNavigateTab: (tab: AdminDashboardTabId) => void;
}

export const AdminOverviewHub: React.FC<AdminOverviewHubProps> = ({ onNavigateTab }) => {
  const { data, isOnline, cloudConnectionState } = useAppData();

  const kpis = useMemo(() => computeAdminDashboardKpis(data), [data]);
  const recentAudits = useMemo(() => (data.auditLogs || []).slice(0, 6), [data.auditLogs]);

  return (
    <div className="space-y-5">
      {/* شريط مؤشرات الأداء الشاملة (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-[#0E1621] border border-emerald-500/25 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
            <span>الأخبار وطابور المراجعة</span>
            <Newspaper className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-white tabular-nums">
            {kpis.publishedArticles}{' '}
            <span className="text-xs font-bold text-amber-300">
              ({kpis.reviewQueueCount} مراجعة)
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            {kpis.enabledSources} مصادر نشطة • {kpis.breakingArticles} عاجل
          </div>
        </div>

        <div className="rounded-2xl bg-[#0E1621] border border-sky-500/25 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-sky-300">
            <span>المباريات والبطولات</span>
            <Trophy className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-white tabular-nums">
            {kpis.totalMatches}{' '}
            <span className="text-xs font-bold text-rose-300">({kpis.liveMatches} مباشر)</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {kpis.competitionsCount} بطولة (أردنية، عربية، عالمية)
          </div>
        </div>

        <div className="rounded-2xl bg-[#0E1621] border border-purple-500/25 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-purple-300">
            <span>الأندية، اللاعبون والطب</span>
            <Stethoscope className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-white tabular-nums">
            {kpis.teamsCount}{' '}
            <span className="text-xs font-bold text-emerald-300">
              • {kpis.verifiedInjuries} إصابة موثقة
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            {kpis.scorersCount + kpis.goalkeepersCount} لاعب وحارس • {kpis.standingsHistoryCount} سجل ترتيب
          </div>
        </div>

        <div className="rounded-2xl bg-[#0E1621] border border-amber-500/25 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
            <span>الأتمتة والميزانية</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-white tabular-nums">
            ${kpis.monthlySpentUsd.toFixed(2)}{' '}
            <span className="text-xs font-bold text-slate-400">/ ${kpis.monthlyBudgetUsd}</span>
          </div>
          <div className="text-[10px] text-slate-400">
            طلبات اليوم: {kpis.dailyRequestsUsed}/{kpis.dailyRequestsLimit} • كاش: {kpis.totalCacheHits}
          </div>
        </div>
      </div>

      {/* حالة النظام والأمان والتوسع */}
      <div className="rounded-2xl bg-[#0E1621] border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-300">
            <ShieldCheck className="w-4 h-4" />
            مفاتيح الذكاء الاصطناعي محمية على الخادم
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-sky-300">
            <Globe className="w-4 h-4" />
            تغطية شاملة: الأردن + البطولات العربية والآسيوية والعالمية
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-300">
            <Database className="w-4 h-4 text-slate-400" />
            هيكل البيانات v{kpis.schemaVersion} ({cloudConnectionState === 'connected' ? 'متصل بـ Firebase' : 'محلي مؤمّن'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-200 font-black text-[11px] inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              غير متصل
            </span>
          )}
          {kpis.unresolvedAlerts > 0 ? (
            <button
              type="button"
              onClick={() => onNavigateTab('automation_budget')}
              className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-200 font-black text-[11px] inline-flex items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {kpis.unresolvedAlerts} تنبيه بحاجة لمراجعة
            </button>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-bold text-[11px] inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              لا توجد أخطاء نشطة
            </span>
          )}
        </div>
      </div>

      {/* خريطة الأقسام الـ 18 الموحدة */}
      <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              خريطة الأقسام الـ 18 المركزية لمنصة WATEEN AI
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              اضغط على أي قسم للانتقال مباشرة إلى أدواته التشغيلية دون مغادرة لوحة التحكم.
            </p>
          </div>
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            {ADMIN_CENTRAL_18_SECTIONS.length} قسماً متكاملاً
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {ADMIN_CENTRAL_18_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => onNavigateTab(sec.targetTab)}
              className="group text-right rounded-2xl bg-[#070B10] hover:bg-[#111A27] border border-white/10 hover:border-emerald-500/45 p-3.5 transition-all flex flex-col justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold text-sky-300 bg-sky-500/10 border border-sky-500/25 px-2 py-0.5 rounded-full">
                    {sec.groupAr}
                  </span>
                  <ArrowUpLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
                </div>
                <div className="text-xs font-black text-white leading-snug">{sec.titleAr}</div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {sec.subtitleAr}
                </p>
              </div>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-black text-emerald-300">
                <span>الحالة المباشرة:</span>
                <span>{sec.getBadgeValue(kpis)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* سجل التدقيق والعمليات الأخيرة */}
      <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-400" />
            أحدث عمليات سجل التدقيق والمراجعة ({kpis.auditLogsCount})
          </h3>
          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            توثيق تلقائي لكل تعديل
          </span>
        </div>

        {recentAudits.length === 0 ? (
          <div className="rounded-2xl bg-[#070B10] border border-white/5 p-4 text-center text-xs text-slate-400">
            سجل التدقيق فارغ حالياً — يتم تسجيل كل عملية استيراد أو تعديل يدوي أو نشر ذكي تلقائياً.
          </div>
        ) : (
          <div className="space-y-2">
            {recentAudits.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl bg-[#070B10] border border-white/8 px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white/10 text-emerald-300">
                      {log.action}
                    </span>
                    <span className="text-[11px] font-bold text-slate-300">{log.actor}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{log.details}</p>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                  {formatAmmanDateTime(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* تلميح البث والاستوديو */}
      <div className="rounded-2xl bg-[#0E1621] border border-white/8 p-3 text-[11px] text-slate-400 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-rose-400" />
          البث المباشر النشط: <strong className="text-white">{kpis.activeStreamsCount}</strong> • بطاقات الاستوديو:{' '}
          <strong className="text-white">{kpis.studioCardsCount}</strong>
        </span>
        <button
          type="button"
          onClick={() => onNavigateTab('auto_design')}
          className="text-emerald-300 hover:text-emerald-200 font-bold"
        >
          فتح الاستوديو ←
        </button>
      </div>
    </div>
  );
};
