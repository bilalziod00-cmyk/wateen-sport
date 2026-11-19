import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  MapPin,
  Search,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import {
  COMPETITIONS,
  INITIAL_JORDAN_TEAMS_DIRECTORY,
  PRIMARY_COMPETITION_LIST,
} from '../constants/competitions';
import { CompetitionId, MatchItem, TeamDirectoryItem } from '../types/sports';
import {
  buildPlayerProfileSummary,
  buildTeamProfileSummary,
  INJURY_STATUS_META,
  PlayerProfileViewModel,
} from '../services/playersAndMedicalService';
import { TeamCrest } from '../components/TeamCrest';
import { MatchCard } from '../components/MatchCard';
import { InjuriesPage } from './InjuriesPage';

interface PlayersAndTeamsPageProps {
  onSelectMatch?: (match: MatchItem) => void;
}

type HubSection = 'players' | 'teams' | 'injuries';

export const PlayersAndTeamsPage: React.FC<PlayersAndTeamsPageProps> = ({ onSelectMatch }) => {
  const { data } = useAppData();
  const [section, setSection] = useState<HubSection>('players');
  const [compFilter, setCompFilter] = useState<'all' | CompetitionId>('all');
  const [query, setQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfileViewModel | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const directory =
    data.teamsDirectory && data.teamsDirectory.length > 0
      ? data.teamsDirectory
      : INITIAL_JORDAN_TEAMS_DIRECTORY;
  const injuries = data.injuries || [];
  const goalkeepers = data.goalkeepers || [];

  const allPlayerProfiles = useMemo(() => {
    const outfield = (data.scorers || []).map((sc) =>
      buildPlayerProfileSummary({
        scorer: sc,
        standings: data.standings,
        injuries,
      })
    );
    const keepers = goalkeepers.map((gk) =>
      buildPlayerProfileSummary({
        goalkeeper: gk,
        standings: data.standings,
        injuries,
      })
    );
    return [...outfield, ...keepers];
  }, [data.scorers, goalkeepers, data.standings, injuries]);

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allPlayerProfiles.filter((p) => {
      if (compFilter !== 'all' && p.competitionId !== compFilter) return false;
      if (q) {
        return (
          p.playerName.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q) ||
          p.positionText.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allPlayerProfiles, compFilter, query]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directory.filter((t) => {
      if (compFilter !== 'all' && t.competitionId !== compFilter) return false;
      if (q) {
        return (
          t.name.toLowerCase().includes(q) ||
          (t.city || '').toLowerCase().includes(q) ||
          (t.aliases || []).some((al) => al.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [directory, compFilter, query]);

  const selectedTeamSummary = useMemo(() => {
    if (!selectedTeamId) return null;
    const team: TeamDirectoryItem | undefined = directory.find((t) => t.id === selectedTeamId);
    if (!team) return null;
    return buildTeamProfileSummary({
      team,
      matches: data.matches,
      standings: data.standings,
      scorers: data.scorers,
      goalkeepers,
      injuries,
    });
  }, [selectedTeamId, directory, data.matches, data.standings, data.scorers, goalkeepers, injuries]);

  // 1) شاشة ملف النادي التفصيلي
  if (selectedTeamSummary) {
    const t = selectedTeamSummary.team;
    const comp = COMPETITIONS[t.competitionId] || COMPETITIONS.pro_league;
    return (
      <div className="space-y-4 pb-6">
        <button
          type="button"
          onClick={() => setSelectedTeamId(null)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0E1621] border border-white/10 text-xs font-extrabold text-white"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لقائمة الأندية
        </button>

        <div className="rounded-3xl bg-gradient-to-l from-emerald-600/20 via-[#0E1722] to-black border border-emerald-500/35 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <TeamCrest name={t.name} shortName={t.shortName} color={t.color} size="lg" />
            <div>
              <div className="text-lg sm:text-xl font-black text-white">{t.name}</div>
              <div className="text-xs text-slate-300">{comp.name}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-2xl bg-black/45 border border-white/10 p-3">
              <div className="text-[10px] text-slate-400">المدينة</div>
              <div className="font-black text-white mt-0.5">{selectedTeamSummary.cityText}</div>
            </div>
            <div className="rounded-2xl bg-black/45 border border-white/10 p-3">
              <div className="text-[10px] text-slate-400">الملعب</div>
              <div className="font-black text-white mt-0.5">{selectedTeamSummary.stadiumText}</div>
            </div>
            <div className="rounded-2xl bg-black/45 border border-white/10 p-3">
              <div className="text-[10px] text-slate-400">المدرب</div>
              <div className="font-black text-white mt-0.5">{selectedTeamSummary.coachText}</div>
            </div>
            <div className="rounded-2xl bg-black/45 border border-white/10 p-3">
              <div className="text-[10px] text-slate-400">المركز / النقاط</div>
              <div className="font-black text-emerald-300 mt-0.5 tabular-nums">
                {selectedTeamSummary.standing
                  ? `#${selectedTeamSummary.standing.position || '-'} • ${selectedTeamSummary.standing.points} نقطة`
                  : 'غير متوفر'}
              </div>
            </div>
          </div>
        </div>

        {/* قائمة اللاعبين والحراس المسجلين للنادي */}
        <section className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 space-y-3">
          <h3 className="text-sm font-black text-white">اللاعبون والهدافون والحراس المسجلون</h3>
          {selectedTeamSummary.squadScorers.length === 0 &&
          selectedTeamSummary.squadGoalkeepers.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center">
              لا توجد بيانات لاعبين مسجلة لهذا النادي حالياً (الإحصائيات التفصيلية: غير متوفر)
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {selectedTeamSummary.squadScorers.map((sc) => (
                <div
                  key={sc.id}
                  className="rounded-2xl bg-black/40 border border-white/8 px-3 py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-black text-white">{sc.playerName}</div>
                    <div className="text-[10px] text-slate-400">
                      المركز: {sc.position || 'غير متوفر'} • القميص:{' '}
                      {sc.shirtNumber ?? 'غير متوفر'}
                    </div>
                  </div>
                  <div className="text-left font-black text-emerald-300 tabular-nums">
                    {sc.goals} هدف • {sc.assists} صناعة
                  </div>
                </div>
              ))}
              {selectedTeamSummary.squadGoalkeepers.map((gk) => (
                <div
                  key={gk.id}
                  className="rounded-2xl bg-black/40 border border-white/8 px-3 py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-black text-white">{gk.playerName}</div>
                    <div className="text-[10px] text-slate-400">حارس مرمى</div>
                  </div>
                  <div className="text-left font-black text-sky-300 tabular-nums">
                    {gk.cleanSheets} كلين شيت • استقبل {gk.goalsConceded}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* إصابات النادي إن وجدت */}
        {selectedTeamSummary.activeInjuries.length > 0 && (
          <section className="rounded-3xl bg-[#0E1621] border border-rose-500/30 p-4 space-y-2.5">
            <h3 className="text-sm font-black text-rose-300">حالات الإصابات والجاهزية بالنادي</h3>
            {selectedTeamSummary.activeInjuries.map((inj) => (
              <div
                key={inj.id}
                className="rounded-xl bg-black/40 border border-white/10 p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-black text-white">{inj.playerName}</div>
                  <div className="text-[11px] text-slate-400">
                    {inj.declaredInjury} • المصدر: {inj.sourceName}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                    INJURY_STATUS_META[inj.returnStatus].badgeClass
                  }`}
                >
                  {INJURY_STATUS_META[inj.returnStatus].label}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* المباريات القادمة والمنتهية */}
        {(selectedTeamSummary.upcomingMatches.length > 0 ||
          selectedTeamSummary.recentFinishedMatches.length > 0) && (
          <section className="space-y-3">
            <h3 className="text-sm font-black text-white">مباريات النادي</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ...selectedTeamSummary.upcomingMatches,
                ...selectedTeamSummary.recentFinishedMatches,
              ].map((m) => (
                <MatchCard key={m.id} match={m} onSelect={(mm) => onSelectMatch?.(mm)} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* الترويسة */}
      <div className="rounded-3xl bg-[#0E1621] border border-white/10 p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black text-white">
            قاعدة اللاعبين والأندية والمركز الطبي الرياضي
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            بيانات حقيقية وموثّقة — أي إحصائية غير متوفرة في المصادر تُعرض بوضوح كـ «غير متوفر» دون اختلاق
          </p>
        </div>
      </div>

      {/* التبويبات الثلاثة */}
      <div className="grid grid-cols-3 gap-2 bg-[#0E1621] p-1.5 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setSection('players')}
          className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ${
            section === 'players' ? 'bg-emerald-500 text-black shadow' : 'text-slate-300'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          اللاعبون ({allPlayerProfiles.length})
        </button>
        <button
          type="button"
          onClick={() => setSection('teams')}
          className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ${
            section === 'teams' ? 'bg-emerald-500 text-black shadow' : 'text-slate-300'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          الأندية ({directory.length})
        </button>
        <button
          type="button"
          onClick={() => setSection('injuries')}
          className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ${
            section === 'injuries' ? 'bg-rose-500 text-white shadow' : 'text-rose-300'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          الإصابات ({injuries.length})
        </button>
      </div>

      {section === 'injuries' ? (
        <InjuriesPage />
      ) : (
        <div className="space-y-3.5">
          {/* البحث وفلتر البطولة */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                section === 'players'
                  ? 'ابحث باسم اللاعب أو النادي أو المركز...'
                  : 'ابحث باسم النادي أو المدينة...'
              }
              className="w-full rounded-2xl bg-[#0E1621] border border-white/10 focus:border-emerald-500/50 outline-none py-2.5 pr-10 pl-4 text-xs text-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
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

          {/* 1) قائمة اللاعبين + بطاقة تفاصيل اللاعب عند الاختيار */}
          {section === 'players' && (
            <div className="space-y-3">
              {selectedPlayer && (
                <div className="rounded-3xl bg-[#111B29] border border-emerald-500/40 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-base font-black text-white">
                        {selectedPlayer.playerName}
                      </div>
                      <div className="text-xs text-emerald-300 font-bold">
                        {selectedPlayer.teamName} •{' '}
                        {COMPETITIONS[selectedPlayer.competitionId]?.shortName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPlayer(null)}
                      className="px-3 py-1 rounded-lg bg-white/10 text-xs font-bold text-slate-200"
                    >
                      إغلاق
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
                    <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                      <div className="text-[10px] text-slate-400">المركز</div>
                      <div className="font-black text-white mt-0.5">
                        {selectedPlayer.positionText}
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                      <div className="text-[10px] text-slate-400">رقم القميص</div>
                      <div className="font-black text-white mt-0.5">
                        {selectedPlayer.shirtNumberText}
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                      <div className="text-[10px] text-slate-400">المباريات</div>
                      <div className="font-black text-white mt-0.5">
                        {selectedPlayer.matchesText}
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                      <div className="text-[10px] text-slate-400">الدقائق</div>
                      <div className="font-black text-slate-200 mt-0.5">
                        {selectedPlayer.minutesPlayedText}
                      </div>
                    </div>

                    {selectedPlayer.role === 'goalkeeper' ? (
                      <>
                        <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                          <div className="text-[10px] text-slate-400">الشباك النظيفة</div>
                          <div className="font-black text-emerald-300 mt-0.5">
                            {selectedPlayer.cleanSheetsText}
                          </div>
                        </div>
                        <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                          <div className="text-[10px] text-slate-400">الأهداف المستقبلة</div>
                          <div className="font-black text-rose-300 mt-0.5">
                            {selectedPlayer.goalsConcededText}
                          </div>
                        </div>
                        <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                          <div className="text-[10px] text-slate-400">التصديات</div>
                          <div className="font-black text-slate-200 mt-0.5">
                            {selectedPlayer.savesText}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                          <div className="text-[10px] text-slate-400">الأهداف</div>
                          <div className="font-black text-emerald-300 mt-0.5">
                            {selectedPlayer.goalsText}
                          </div>
                        </div>
                        <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                          <div className="text-[10px] text-slate-400">الصناعة</div>
                          <div className="font-black text-sky-300 mt-0.5">
                            {selectedPlayer.assistsText}
                          </div>
                        </div>
                        <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                          <div className="text-[10px] text-slate-400">البطاقات (صفراء/حمراء)</div>
                          <div className="font-black text-amber-300 mt-0.5">
                            {selectedPlayer.yellowCardsText} / {selectedPlayer.redCardsText}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="rounded-xl bg-black/40 p-2.5 border border-white/10">
                      <div className="text-[10px] text-slate-400">التقييم</div>
                      <div className="font-black text-slate-200 mt-0.5">
                        {selectedPlayer.ratingText}
                      </div>
                    </div>
                  </div>

                  {selectedPlayer.activeInjury && (
                    <div className="rounded-xl bg-rose-950/40 border border-rose-500/35 px-3 py-2 text-xs text-rose-200">
                      الحالة الطبية: {selectedPlayer.activeInjury.declaredInjury} (
                      {INJURY_STATUS_META[selectedPlayer.activeInjury.returnStatus].label}) — المصدر:{' '}
                      {selectedPlayer.activeInjury.sourceName}
                    </div>
                  )}
                </div>
              )}

              {filteredPlayers.length === 0 ? (
                <div className="rounded-2xl bg-[#0E1621] border border-white/8 p-8 text-center text-xs text-slate-400">
                  لا يوجد لاعبون مطابقون للبحث الحالي.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlayer(p)}
                      className="text-right rounded-2xl bg-[#0E1621] hover:border-emerald-500/40 border border-white/10 p-3.5 flex items-center justify-between gap-2 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-white truncate">
                            {p.playerName}
                          </span>
                          {p.isDemo && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-bold">
                              عرض أولي
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {p.teamName} • {p.positionText}
                        </div>
                      </div>
                      <div className="text-left shrink-0 tabular-nums">
                        {p.role === 'goalkeeper' ? (
                          <span className="px-2.5 py-1 rounded-xl bg-sky-500/15 text-sky-300 text-xs font-black">
                            {p.cleanSheetsText} كلين شيت
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-black">
                            {p.goalsText} هدف
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2) قائمة الأندية */}
          {section === 'teams' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredTeams.map((team) => {
                const comp = COMPETITIONS[team.competitionId] || COMPETITIONS.pro_league;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    className="text-right rounded-2xl bg-[#0E1621] hover:border-emerald-500/40 border border-white/10 p-3.5 flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TeamCrest
                        name={team.name}
                        shortName={team.shortName}
                        color={team.color}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-black text-white truncate">{team.name}</div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                          {team.city || 'الأردن'} • {comp.shortName}
                        </div>
                      </div>
                    </div>
                    <Users className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
