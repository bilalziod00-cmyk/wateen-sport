import React, { useMemo, useState } from 'react';
import { Calendar, Clock, Radio, Table2, Trophy } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { COMPETITIONS, PRIMARY_COMPETITION_LIST } from '../constants/competitions';
import { CompetitionId, MatchItem, MatchStatus } from '../types/sports';
import { getAmmanNowClock } from '../utils/ammanTime';
import { MatchCard } from '../components/MatchCard';
import { StandingsTable } from '../components/StandingsTable';

interface ResultsStandingsPageProps {
  onSelectMatch: (match: MatchItem) => void;
}

export const ResultsStandingsPage: React.FC<ResultsStandingsPageProps> = ({ onSelectMatch }) => {
  const { data } = useAppData();
  const [section, setSection] = useState<'matches' | 'standings'>('matches');
  const [statusFilter, setStatusFilter] = useState<'all' | MatchStatus>('all');
  const [compFilter, setCompFilter] = useState<'all' | CompetitionId>('all');
  const [standingsComp, setStandingsComp] = useState<CompetitionId>('pro_league');

  const liveCount = useMemo(
    () => data.matches.filter((m) => m.status === 'live').length,
    [data.matches]
  );

  const filteredMatches = useMemo(() => {
    const statusWeight = { live: 0, upcoming: 1, finished: 2 };
    return data.matches
      .filter((m) => {
        if (statusFilter !== 'all' && m.status !== statusFilter) return false;
        if (compFilter !== 'all' && m.competitionId !== compFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (statusWeight[a.status] !== statusWeight[b.status]) {
          return statusWeight[a.status] - statusWeight[b.status];
        }
        return new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime();
      });
  }, [data.matches, statusFilter, compFilter]);

  const selectedStandings = useMemo(
    () => data.standings.filter((s) => s.competitionId === standingsComp),
    [data.standings, standingsComp]
  );

  return (
    <div className="space-y-4 pb-6">
      {/* الترويسة وتوقيت عمّان */}
      <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white">النتائج وجداول الترتيب</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            جميع المواعيد معروضة تلقائياً بتوقيت العاصمة عمّان والملاعب الأردنية
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-extrabold text-emerald-300 tabular-nums">
          <Clock className="w-3.5 h-3.5" />
          عمّان: {getAmmanNowClock()}
        </div>
      </div>

      {/* تبديل رئيسي: مركز المباريات / جداول الترتيب */}
      <div className="grid grid-cols-2 gap-2 bg-[#0E1621] p-1.5 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setSection('matches')}
          className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
            section === 'matches'
              ? 'bg-emerald-500 text-pitch-950 shadow-glow'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span>المباريات</span>
          {liveCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                section === 'matches' ? 'bg-pitch-950/20 text-pitch-950' : 'bg-rose-500 text-white'
              }`}
            >
              {liveCount} مباشر
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSection('standings')}
          className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
            section === 'standings'
              ? 'bg-emerald-500 text-pitch-950 shadow-glow'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Table2 className="w-4 h-4 shrink-0" />
          <span>جداول الترتيب</span>
        </button>
      </div>

      {section === 'matches' ? (
        <div className="space-y-3.5">
          {/* تصفية حالة المباراة */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'all' as const, label: 'الكل' },
              { id: 'live' as const, label: `مباشر (${liveCount})` },
              { id: 'upcoming' as const, label: 'القادمة' },
              { id: 'finished' as const, label: 'السابقة' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                  statusFilter === st.id
                    ? st.id === 'live'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-white/12 text-white border-white/25'
                    : 'bg-[#0E1621] text-slate-400 border-white/8 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* تصفية البطولة أو الفئة العمرية */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setCompFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
                compFilter === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#0E1621] text-slate-400 border-white/8'
              }`}
            >
              جميع البطولات
            </button>
            {PRIMARY_COMPETITION_LIST.map((cid) => (
              <button
                key={cid}
                type="button"
                onClick={() => setCompFilter(cid)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
                  compFilter === cid
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#0E1621] text-slate-400 border-white/8'
                }`}
              >
                {COMPETITIONS[cid].shortName}
              </button>
            ))}
          </div>

          {/* قائمة المباريات */}
          {filteredMatches.length === 0 ? (
            <div className="rounded-2xl bg-[#0E1621] border border-white/8 p-10 text-center space-y-2">
              <Radio className="w-7 h-7 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">
                لا توجد مباريات ضمن التصفية الحالية
              </div>
              <p className="text-xs text-slate-500">
                يمكنك إضافة مباراة جديدة أو تعديل النتائج من لوحة التحكم.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMatches.map((m) => (
                <MatchCard key={m.id} match={m} onSelect={onSelectMatch} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* اختيار الدوري / الفئة العمرية للترتيب */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {PRIMARY_COMPETITION_LIST.filter((c) => c !== 'jordan_cup').map((cid) => (
              <button
                key={cid}
                type="button"
                onClick={() => setStandingsComp(cid)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap border transition-all ${
                  standingsComp === cid
                    ? 'bg-emerald-500 text-pitch-950 border-emerald-400 shadow'
                    : 'bg-[#0E1621] text-slate-300 border-white/8 hover:border-white/20'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                {COMPETITIONS[cid].shortName}
              </button>
            ))}
          </div>

          <StandingsTable
            rows={selectedStandings}
            title={`جدول ترتيب ${COMPETITIONS[standingsComp].name}`}
          />
        </div>
      )}
    </div>
  );
};
