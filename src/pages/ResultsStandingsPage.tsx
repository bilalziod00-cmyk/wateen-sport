import React, { useMemo, useState } from 'react';
import { Award, Calendar, Clock, Filter, Radio, Shield, Table2, Trophy } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { COMPETITIONS, PRIMARY_COMPETITION_LIST } from '../constants/competitions';
import { CompetitionId, MatchItem, MatchStatus } from '../types/sports';
import { getAmmanNowClock } from '../utils/ammanTime';
import { computeCompetitionStatsSummary } from '../utils/sportsMathEngine';
import { isLiveMatchStatus, MATCH_STATUS_SORT_WEIGHT } from '../utils/matchStatus';
import { computeTeamRankDeltas } from '../services/matchIntelligenceService';
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
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [standingsComp, setStandingsComp] = useState<CompetitionId>('pro_league');

  const liveCount = useMemo(
    () => data.matches.filter((m) => isLiveMatchStatus(m.status)).length,
    [data.matches]
  );

  // أرشيف الجولات المتوفرة
  const availableRounds = useMemo(() => {
    const list = data.matches
      .filter((m) => compFilter === 'all' || m.competitionId === compFilter)
      .map((m) => m.round);
    return Array.from(new Set(list));
  }, [data.matches, compFilter]);

  // قائمة الفرق المتوفرة لفلترة "نتائج كل فريق"
  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    data.matches
      .filter((m) => compFilter === 'all' || m.competitionId === compFilter)
      .forEach((m) => {
        set.add(m.homeTeam);
        set.add(m.awayTeam);
      });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [data.matches, compFilter]);

  const filteredMatches = useMemo(() => {
    return data.matches
      .filter((m) => {
        if (statusFilter === 'live') {
          if (!isLiveMatchStatus(m.status)) return false;
        } else if (statusFilter !== 'all' && m.status !== statusFilter) {
          return false;
        }
        if (compFilter !== 'all' && m.competitionId !== compFilter) return false;
        if (roundFilter !== 'all' && m.round !== roundFilter) return false;
        if (teamFilter !== 'all' && m.homeTeam !== teamFilter && m.awayTeam !== teamFilter)
          return false;
        return true;
      })
      .sort((a, b) => {
        if (MATCH_STATUS_SORT_WEIGHT[a.status] !== MATCH_STATUS_SORT_WEIGHT[b.status]) {
          return MATCH_STATUS_SORT_WEIGHT[a.status] - MATCH_STATUS_SORT_WEIGHT[b.status];
        }
        return new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime();
      });
  }, [data.matches, statusFilter, compFilter, roundFilter, teamFilter]);

  const selectedStandings = useMemo(
    () => data.standings.filter((s) => s.competitionId === standingsComp),
    [data.standings, standingsComp]
  );

  const rankDeltas = useMemo(
    () =>
      computeTeamRankDeltas(
        selectedStandings,
        data.standingsHistory || [],
        standingsComp
      ),
    [selectedStandings, data.standingsHistory, standingsComp]
  );

  const selectedScorers = useMemo(
    () =>
      data.scorers
        .filter((s) => s.competitionId === standingsComp)
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists),
    [data.scorers, standingsComp]
  );

  const compStats = useMemo(
    () =>
      computeCompetitionStatsSummary(
        standingsComp,
        data.standings,
        data.matches,
        data.goalkeepers || []
      ),
    [standingsComp, data.standings, data.matches, data.goalkeepers]
  );

  return (
    <div className="space-y-4 pb-6">
      {/* الترويسة وتوقيت عمّان */}
      <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white">النتائج وجداول الترتيب والإحصائيات</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            جميع المواعيد معروضة تلقائياً بتوقيت العاصمة عمّان والملاعب الأردنية
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-extrabold text-emerald-300 tabular-nums">
          <Clock className="w-3.5 h-3.5" />
          عمّان: {getAmmanNowClock()}
        </div>
      </div>

      {/* تبديل رئيسي: مركز المباريات / جداول الترتيب والإحصائيات */}
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
          <span>المباريات والجولات</span>
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
          <span>الترتيب والإحصائيات</span>
        </button>
      </div>

      {section === 'matches' ? (
        <div className="space-y-3.5">
          {/* تصفية حالة المباراة (الكل، مباشر، القادمة، المنتهية، المؤجلة، الملغاة) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {[
              { id: 'all' as const, label: 'الكل' },
              { id: 'live' as const, label: `مباشر (${liveCount})` },
              { id: 'upcoming' as const, label: 'القادمة' },
              { id: 'finished' as const, label: 'المنتهية' },
              { id: 'postponed' as const, label: 'المؤجلة' },
              { id: 'cancelled' as const, label: 'الملغاة' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                  statusFilter === st.id
                    ? st.id === 'live'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
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
              onClick={() => {
                setCompFilter('all');
                setRoundFilter('all');
                setTeamFilter('all');
              }}
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
                onClick={() => {
                  setCompFilter(cid);
                  setRoundFilter('all');
                  setTeamFilter('all');
                }}
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

          {/* أرشيف الجولات + فلتر نتائج كل فريق */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-2xl bg-[#0E1621] border border-white/10 p-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-extrabold text-slate-300 shrink-0">أرشيف الجولات:</span>
              <select
                value={roundFilter}
                onChange={(e) => setRoundFilter(e.target.value)}
                className="flex-1 rounded-xl bg-black/60 border border-white/15 px-3 py-1.5 text-xs font-bold text-white"
              >
                <option value="all">جميع الجولات</option>
                {availableRounds.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-xs font-extrabold text-slate-300 shrink-0">نتائج الفريق:</span>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="flex-1 rounded-xl bg-black/60 border border-white/15 px-3 py-1.5 text-xs font-bold text-white"
              >
                <option value="all">جميع الأندية والفرق</option>
                {availableTeams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* قائمة المباريات */}
          {filteredMatches.length === 0 ? (
            <div className="rounded-2xl bg-[#0E1621] border border-white/8 p-10 text-center space-y-2">
              <Radio className="w-7 h-7 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">
                لا توجد مباريات ضمن التصفية الحالية
              </div>
              <p className="text-xs text-slate-500">
                يمكنك استيراد جولة كاملة أو تعديل النتائج من مركز الإدخال الذكي في لوحة التحكم.
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
        <div className="space-y-4">
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

          {/* ملخص إحصائيات الفرق التلقائي (أفضل هجوم، أفضل دفاع، الأكثر فوزاً) */}
          {compStats.bestAttack && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-2xl bg-[#0E1621] border border-emerald-500/30 p-3">
                <div className="text-[10px] font-bold text-emerald-400">أقوى هجوم</div>
                <div className="text-sm font-black text-white mt-0.5">
                  {compStats.bestAttack.teamName}
                </div>
                <div className="text-xs font-extrabold text-slate-400">
                  {compStats.bestAttack.goalsFor} هدفاً
                </div>
              </div>
              <div className="rounded-2xl bg-[#0E1621] border border-sky-500/30 p-3">
                <div className="text-[10px] font-bold text-sky-400">أقوى دفاع</div>
                <div className="text-sm font-black text-white mt-0.5">
                  {compStats.bestDefense?.teamName || '-'}
                </div>
                <div className="text-xs font-extrabold text-slate-400">
                  استقبل {compStats.bestDefense?.goalsAgainst ?? 0} أهداف
                </div>
              </div>
              <div className="rounded-2xl bg-[#0E1621] border border-amber-500/30 p-3">
                <div className="text-[10px] font-bold text-amber-400">الأكثر فوزاً</div>
                <div className="text-sm font-black text-white mt-0.5">
                  {compStats.mostWins?.teamName || '-'}
                </div>
                <div className="text-xs font-extrabold text-slate-400">
                  {compStats.mostWins?.won ?? 0} انتصارات
                </div>
              </div>
              <div className="rounded-2xl bg-[#0E1621] border border-white/10 p-3">
                <div className="text-[10px] font-bold text-slate-400">نقاط الفوز / التعادل</div>
                <div className="text-sm font-black text-white mt-0.5">
                  {data.competitionRules?.[standingsComp]?.pointsWin ?? 3} فوز •{' '}
                  {data.competitionRules?.[standingsComp]?.pointsDraw ?? 1} تعادل
                </div>
                <div className="text-[11px] font-bold text-emerald-300">لائحة معتمدة</div>
              </div>
            </div>
          )}

          {/* جدول الترتيب */}
          <StandingsTable
            rows={selectedStandings}
            rankDeltas={rankDeltas}
            title={`جدول ترتيب ${COMPETITIONS[standingsComp].name}`}
          />

          {/* قوائم الهدافين وإحصائيات حراس المرمى (الشباك النظيفة) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ترتيب الهدافين */}
            <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  ترتيب الهدافين وصنّاع الأهداف
                </h3>
                <span className="text-[11px] text-slate-400">
                  {COMPETITIONS[standingsComp].shortName}
                </span>
              </div>

              {selectedScorers.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">
                  لا توجد بيانات هدافين مسجلة لهذه البطولة حالياً
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedScorers.map((sc, i) => (
                    <div
                      key={sc.id}
                      className="flex items-center justify-between rounded-2xl bg-black/35 border border-white/8 px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-black text-white">{sc.playerName}</div>
                          <div className="text-[10px] text-slate-400">
                            {sc.teamName} • {sc.matches} مباراة
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-black">
                          {sc.goals} هدف
                        </span>
                        <span className="px-2 py-1 rounded-xl bg-white/5 text-slate-300 font-bold text-[11px]">
                          {sc.assists} صناعة
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* إحصائيات حراس المرمى (الشباك النظيفة والأهداف المستقبلة) */}
            <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  إحصائيات حراس المرمى (الشباك النظيفة)
                </h3>
                <span className="text-[11px] text-slate-400">كلين شيت + أهداف مستقبلة</span>
              </div>

              {compStats.topGoalkeepers.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">
                  لا توجد إحصائيات حراس مسجلة لهذه البطولة حالياً
                </div>
              ) : (
                <div className="space-y-2">
                  {compStats.topGoalkeepers.map((gk, i) => (
                    <div
                      key={gk.id}
                      className="flex items-center justify-between rounded-2xl bg-black/35 border border-white/8 px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-black text-white">{gk.playerName}</div>
                          <div className="text-[10px] text-slate-400">
                            {gk.teamName} • {gk.matches} مباراة
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-black">
                          {gk.cleanSheets} شباك نظيفة
                        </span>
                        <span className="px-2 py-1 rounded-xl bg-rose-500/15 text-rose-300 font-bold text-[11px]">
                          استقبل {gk.goalsConceded}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
