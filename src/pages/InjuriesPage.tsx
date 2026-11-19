import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Calendar,
  ExternalLink,
  Search,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { COMPETITIONS } from '../constants/competitions';
import { InjuryReportItem } from '../types/sports';
import { INJURY_STATUS_META } from '../services/playersAndMedicalService';
import { formatAmmanDateTime } from '../utils/ammanTime';

export const InjuriesPage: React.FC = () => {
  const { data } = useAppData();
  const [statusFilter, setStatusFilter] = useState<'all' | InjuryReportItem['returnStatus']>('all');
  const [query, setQuery] = useState('');

  const injuries = data.injuries || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...injuries]
      .filter((item) => {
        if (statusFilter !== 'all' && item.returnStatus !== statusFilter) return false;
        if (q) {
          const hit =
            item.playerName.toLowerCase().includes(q) ||
            item.teamName.toLowerCase().includes(q) ||
            item.declaredInjury.toLowerCase().includes(q) ||
            item.sourceName.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
      );
  }, [injuries, statusFilter, query]);

  return (
    <div className="space-y-4">
      {/* الترويسة الطبية الموثقة */}
      <div className="rounded-3xl bg-gradient-to-l from-rose-600/20 via-[#0E1722] to-black border border-rose-500/35 p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-rose-300">
            <Stethoscope className="w-4 h-4" />
            القسم الطبي الإخباري — الإصابات والجاهزية
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-black text-emerald-300">
            منسوب لمصادر رسمية
          </span>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          يعرض هذا القسم حالات الإصابات والتأهيل والجاهزية المُعلنة من بيانات الأندية أو الاتحادات أو المؤتمرات الصحفية الرسمية فقط، ولا يُقدّم أي تشخيص طبي غير موثّق.
        </p>
      </div>

      {/* شريط البحث والفلترة */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم اللاعب، النادي، نوع الإصابة، أو المصدر..."
            className="w-full rounded-2xl bg-[#0E1621] border border-white/10 focus:border-emerald-500/50 outline-none py-2.5 pr-10 pl-4 text-xs text-white placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {(
            [
              ['all', `الكل (${injuries.length})`],
              ['injured', 'مصاب'],
              ['rehab', 'تأهيل'],
              ['light_training', 'تدريب خفيف'],
              ['fit_to_play', 'جاهز للعب'],
              ['unknown', 'بانتظار التقرير'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border whitespace-nowrap ${
                statusFilter === key
                  ? 'bg-emerald-500 text-black border-emerald-400'
                  : 'bg-[#0E1621] text-slate-300 border-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* قائمة تقارير الإصابات والجاهزية */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-8 text-center space-y-2">
          <Activity className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-black text-white">
            لا توجد تقارير إصابات مسجلة مطابقة للفلتر الحالي
          </div>
          <p className="text-xs text-slate-400">
            تُضاف تقارير الإصابات فور صدور بيان رسمي من النادي أو الاتحاد من قسم اللاعبين والطب في لوحة التحكم.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inj) => {
            const statusMeta =
              INJURY_STATUS_META[inj.returnStatus] || INJURY_STATUS_META.unknown;
            const compMeta = COMPETITIONS[inj.competitionId] || COMPETITIONS.pro_league;
            return (
              <article
                key={inj.id}
                className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-white">
                        {inj.playerName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-slate-200">
                        {inj.teamName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${compMeta.badgeColor}`}
                      >
                        {compMeta.shortName}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-black shrink-0 ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                <div className="rounded-xl bg-black/40 border border-white/8 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">الإصابة المُعلنة</div>
                    <div className="font-extrabold text-rose-200 mt-0.5">
                      {inj.declaredInjury}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">مدة الغياب المُعلنة</div>
                    <div className="font-extrabold text-amber-300 mt-0.5">
                      {inj.declaredAbsenceDuration || 'غير محدد رسمياً'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      تاريخ الإعلان
                    </div>
                    <div className="font-bold text-slate-200 mt-0.5 tabular-nums">
                      {inj.announcedDate}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {inj.isVerifiedOfficial ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>المصدر:</span>
                    <span className="font-bold text-sky-300">{inj.sourceName}</span>
                    {inj.sourceUrl && (
                      <a
                        href={inj.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-emerald-300 hover:underline mr-1"
                      >
                        البيان الرسمي
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <span className="tabular-nums text-[10px]">
                    آخر تحديث: {formatAmmanDateTime(inj.lastUpdatedAt)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
