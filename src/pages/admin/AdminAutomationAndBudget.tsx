import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  DollarSign,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { getDefaultAutomationSettings } from '../../services/schemaMigrationService';
import {
  evaluateBudgetHealth,
  evaluateDataFreshnessStatus,
} from '../../services/automationAndCacheService';
import { formatAmmanDateTime } from '../../utils/ammanTime';

export const AdminAutomationAndBudget: React.FC = () => {
  const {
    data,
    isOnline,
    updateAutomationSettings,
    runScheduledAutomationCycle,
    resetDailyAutomationQuota,
    resolveAutomationAlert,
    clearResolvedAutomationAlerts,
  } = useAppData();

  const settings = useMemo(
    () => ({ ...getDefaultAutomationSettings(), ...(data.automationSettings || {}) }),
    [data.automationSettings]
  );

  const budget = useMemo(() => evaluateBudgetHealth(settings), [settings]);

  const enabledSources = useMemo(
    () => (data.newsSources || []).filter((s) => s.enabled),
    [data.newsSources]
  );
  const failedSourcesCount = useMemo(
    () => enabledSources.filter((s) => s.lastStatus === 'error').length,
    [enabledSources]
  );

  const freshness = useMemo(
    () =>
      evaluateDataFreshnessStatus({
        isOnline,
        lastUpdatedAt: data.updatedAt,
        lastSyncSuccessAt: data.lastSyncSuccessAt,
        failedSourcesCount,
        totalEnabledSources: enabledSources.length,
      }),
    [data.lastSyncSuccessAt, data.updatedAt, enabledSources.length, failedSourcesCount, isOnline]
  );

  const [running, setRunning] = useState(false);

  const alerts = data.automationAlerts || [];
  const unresolvedAlerts = alerts.filter((a) => !a.resolved);
  const cachedSourcesCount = Object.keys(settings.sourceCacheHashes || {}).length;

  const handleRunCycle = async (forceBypassCache = false) => {
    setRunning(true);
    try {
      await runScheduledAutomationCycle({ forceBypassCache });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ترويسة الجدولة الخلفية والتشغيل الفوري */}
      <div className="rounded-3xl bg-gradient-to-l from-sky-600/20 via-[#111C2B] to-[#0B121B] border border-sky-500/30 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/35 flex items-center justify-center text-sky-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                الأتمتة المجدولة، التخزين المؤقت والميزانية
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cloud Scheduler (كل 30 دقيقة بتوقيت عمّان) • كاش RSS • إعادة محاولة • حماية السقف المالي
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => handleRunCycle(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-pitch-950 text-xs font-black transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {running ? 'جاري الفحص...' : 'تشغيل دورة مع الكاش'}
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => handleRunCycle(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 text-xs font-extrabold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              فحص قسري (تجاوز الكاش)
            </button>
          </div>
        </div>

        {/* مؤشر حالة الشبكة والمصادر */}
        <div
          className={`rounded-2xl border px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 ${
            freshness.mode === 'offline'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
              : freshness.mode === 'source_error'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {freshness.mode === 'fresh' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>
              <strong>{freshness.titleAr}:</strong> {freshness.messageAr}
            </span>
          </div>
          <span className="text-[11px] opacity-85">
            آخر تشغيل أتمتة:{' '}
            {settings.lastAutomationRunAt
              ? formatAmmanDateTime(settings.lastAutomationRunAt)
              : 'لم تُشغّل بعد'}
          </span>
        </div>
      </div>

      {/* بطاقات الميزانية والحد اليومي والكاش */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* الحد اليومي للطلبات */}
        <div className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              الحد اليومي لطلبات AI
            </span>
            <button
              type="button"
              onClick={resetDailyAutomationQuota}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-sky-200"
            >
              <RotateCcw className="w-3 h-3" />
              تصفير العداد
            </button>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">
              {budget.dailyUsed} <span className="text-xs text-slate-400">/ {budget.dailyLimit}</span>
            </span>
            <span
              className={`text-xs font-extrabold ${
                budget.dailyPercent >= 90 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {budget.dailyPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                budget.dailyPercent >= 90
                  ? 'bg-rose-500'
                  : budget.dailyPercent >= 70
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${budget.dailyPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            متبقي اليوم: {budget.remainingDailyRequests} طلب • التصفير التالي: {settings.lastBudgetResetDate || 'تلقائي بتوقيت عمّان'}
          </p>
        </div>

        {/* السقف المالي الشهري */}
        <div className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-400" />
              السقف المالي الشهري (USD)
            </span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                budget.allowed
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
              }`}
            >
              {budget.allowed ? 'ضمن الحد' : 'متوقف للحماية'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">
              ${budget.monthlySpentUsd.toFixed(3)}{' '}
              <span className="text-xs text-slate-400">/ ${budget.monthlyBudgetUsd.toFixed(2)}</span>
            </span>
            <span className="text-xs font-extrabold text-amber-300">{budget.monthlyPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                budget.monthlyPercent >= 90 ? 'bg-rose-500' : 'bg-amber-400'
              }`}
              style={{ width: `${budget.monthlyPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            الرصيد التقديري المتبقي: ${budget.remainingMonthlyUsd.toFixed(3)} • الشهر: {settings.lastMonthlyResetMonth || 'الحالي'}
          </p>
        </div>

        {/* كفاءة التخزين المؤقت ومنع التكرار */}
        <div className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-sky-400" />
              التخزين المؤقت ومنع التكرار
            </span>
            <span className="text-[10px] font-bold text-sky-300">
              TTL: {settings.cacheTtlMinutes || 20} د
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{settings.totalCacheHits || 0}</span>
            <span className="text-xs text-slate-400">إصابة كاش (وفّرت AI)</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            بصمات المصادر المخزنة حالياً: <strong className="text-slate-200">{cachedSourcesCount}</strong> مصادر.
            عند تطابق البصمة أو صلاحية TTL، لا يُستهلك أي رصيد AI.
          </p>
        </div>
      </div>

      {/* نموذج إعدادات الجدولة والحدود والمزود */}
      <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 sm:p-5 space-y-4">
        <h4 className="text-sm font-black text-white">إعدادات التشغيل الآلي وسقف التكلفة</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="space-y-1 text-xs">
            <span className="text-slate-300 font-bold">حالة الأتمتة المجدولة</span>
            <select
              value={settings.automationEnabled !== false ? 'on' : 'off'}
              onChange={(e) =>
                updateAutomationSettings({ automationEnabled: e.target.value === 'on' })
              }
              className="w-full rounded-xl bg-[#070B10] border border-white/15 px-3 py-2.5 text-white font-bold"
            >
              <option value="on">مفعّلة (تعمل تلقائياً)</option>
              <option value="off">متوقفة مؤقتاً</option>
            </select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-300 font-bold">فترة فحص الأخبار (بالدقائق)</span>
            <input
              type="number"
              min={5}
              max={1440}
              value={settings.newsPollIntervalMinutes}
              onChange={(e) =>
                updateAutomationSettings({
                  newsPollIntervalMinutes: Math.max(5, Number(e.target.value || 30)),
                })
              }
              className="w-full rounded-xl bg-[#070B10] border border-white/15 px-3 py-2.5 text-white font-bold"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-300 font-bold">مدة صلاحية الكاش TTL (دقيقة)</span>
            <input
              type="number"
              min={1}
              max={240}
              value={settings.cacheTtlMinutes ?? 20}
              onChange={(e) =>
                updateAutomationSettings({
                  cacheTtlMinutes: Math.max(1, Number(e.target.value || 20)),
                })
              }
              className="w-full rounded-xl bg-[#070B10] border border-white/15 px-3 py-2.5 text-white font-bold"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-300 font-bold">الحد اليومي الأقصى للطلبات</span>
            <input
              type="number"
              min={5}
              max={5000}
              value={settings.dailyRequestsLimit}
              onChange={(e) =>
                updateAutomationSettings({
                  dailyRequestsLimit: Math.max(5, Number(e.target.value || 120)),
                })
              }
              className="w-full rounded-xl bg-[#070B10] border border-white/15 px-3 py-2.5 text-white font-bold"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-300 font-bold">السقف المالي الشهري ($)</span>
            <input
              type="number"
              min={1}
              step={0.5}
              max={500}
              value={settings.monthlyBudgetUsd}
              onChange={(e) =>
                updateAutomationSettings({
                  monthlyBudgetUsd: Math.max(1, Number(e.target.value || 10)),
                })
              }
              className="w-full rounded-xl bg-[#070B10] border border-white/15 px-3 py-2.5 text-white font-bold"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-300 font-bold">إعادات المحاولة عند تعطل المصدر</span>
            <input
              type="number"
              min={0}
              max={5}
              value={settings.maxRetryAttempts ?? 2}
              onChange={(e) =>
                updateAutomationSettings({
                  maxRetryAttempts: Math.max(0, Math.min(5, Number(e.target.value || 2))),
                })
              }
              className="w-full rounded-xl bg-[#070B10] border border-white/15 px-3 py-2.5 text-white font-bold"
            />
          </label>
        </div>

        <label className="flex items-center gap-2.5 pt-1 cursor-pointer text-xs text-slate-200 font-bold">
          <input
            type="checkbox"
            checked={settings.pauseOnBudgetExceeded !== false}
            onChange={(e) =>
              updateAutomationSettings({ pauseOnBudgetExceeded: e.target.checked })
            }
            className="w-4 h-4 accent-emerald-500 rounded"
          />
          <span>إيقاف طلبات الذكاء الاصطناعي تلقائياً عند بلوغ الحد اليومي أو السقف الشهري</span>
        </label>

        <div className="rounded-xl bg-[#070B10] border border-white/10 p-3 text-[11px] text-slate-400">
          أمان المفاتيح: مفاتيح <code className="text-emerald-300">OPENAI_API_KEY</code> و{' '}
          <code className="text-emerald-300">GEMINI_API_KEY</code> محفوظة حصرياً على الخادم في{' '}
          <span className="text-white font-bold">Firebase Cloud Functions</span> ولا تُخزّن داخل ملف APK أبداً.
        </div>
      </div>

      {/* سجل تنبيهات فشل المصادر أو تجاوز الميزانية */}
      <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            سجل تنبيهات المراقبة والأخطاء ({unresolvedAlerts.length} نشط)
          </h4>
          {alerts.some((a) => a.resolved) && (
            <button
              type="button"
              onClick={clearResolvedAutomationAlerts}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white"
            >
              <Trash2 className="w-3.5 h-3.5" />
              مسح المعالجة
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="rounded-2xl bg-[#070B10] border border-white/5 p-4 text-center text-xs text-slate-400">
            لا توجد تنبيهات أخطاء أو تجاوز ميزانية مسجلة حالياً.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {alerts.map((al) => (
              <div
                key={al.id}
                className={`rounded-2xl border p-3 flex items-start justify-between gap-3 ${
                  al.resolved
                    ? 'bg-[#070B10]/60 border-white/5 opacity-60'
                    : al.severity === 'error'
                    ? 'bg-rose-500/10 border-rose-500/35'
                    : 'bg-amber-500/10 border-amber-500/35'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        al.severity === 'error'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-200'
                      }`}
                    >
                      {al.severity === 'error' ? 'فشل مصدر' : 'تنبيه ميزانية/شبكة'}
                    </span>
                    <span className="text-xs font-extrabold text-white">{al.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{al.message}</p>
                  <p className="text-[10px] text-slate-500">{formatAmmanDateTime(al.createdAt)}</p>
                </div>

                {!al.resolved && (
                  <button
                    type="button"
                    onClick={() => resolveAutomationAlert(al.id)}
                    className="shrink-0 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/25 text-[11px] font-bold text-slate-200 hover:text-emerald-200 transition-colors"
                  >
                    تمت المراجعة
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
