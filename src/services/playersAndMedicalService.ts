import {
  GoalkeeperStat,
  InjuryReportItem,
  MatchItem,
  StandingRow,
  TeamDirectoryItem,
  TopScorer,
} from '../types/sports';
import {
  generateDeterministicInjuryId,
  generateDeterministicTeamId,
} from '../utils/deterministicIds';
import { normalizeArabicTeamName } from '../utils/sportsMathEngine';

export const UNAVAILABLE_STAT_TEXT = 'غير متوفر';

/**
 * تنسيق الإحصائية بأمان: إذا كانت القيمة غير متوفرة أو null أو undefined تُرجع "غير متوفر"
 * ولا تخترع أبداً أرقاماً أو تقييمات وهمية
 */
export function formatStatOrUnavailable(
  value: number | string | null | undefined,
  suffix = ''
): string {
  if (value === null || value === undefined) return UNAVAILABLE_STAT_TEXT;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? `${trimmed}${suffix}` : UNAVAILABLE_STAT_TEXT;
  }
  if (!Number.isFinite(value)) return UNAVAILABLE_STAT_TEXT;
  return `${value}${suffix}`;
}

export const INJURY_STATUS_META: Record<
  InjuryReportItem['returnStatus'],
  { label: string; badgeClass: string }
> = {
  injured: {
    label: 'مصاب',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  rehab: {
    label: 'برنامج تأهيلي',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  light_training: {
    label: 'تدريب خفيف',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  fit_to_play: {
    label: 'جاهز للعب',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  unknown: {
    label: 'بانتظار التقرير الرسمي',
    badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/35',
  },
};

export interface PlayerProfileViewModel {
  id: string;
  role: 'outfield' | 'goalkeeper';
  playerName: string;
  teamName: string;
  teamId: string;
  teamColor: string;
  competitionId: TopScorer['competitionId'];
  positionText: string;
  shirtNumberText: string;
  matchesText: string;
  goalsText: string;
  assistsText: string;
  minutesPlayedText: string;
  yellowCardsText: string;
  redCardsText: string;
  ratingText: string;
  cleanSheetsText: string;
  goalsConcededText: string;
  savesText: string;
  activeInjury: InjuryReportItem | null;
  teamStanding: StandingRow | null;
  isDemo: boolean;
}

export function buildPlayerProfileSummary(params: {
  scorer?: TopScorer;
  goalkeeper?: GoalkeeperStat;
  standings: StandingRow[];
  injuries: InjuryReportItem[];
}): PlayerProfileViewModel {
  const { scorer, goalkeeper, standings, injuries } = params;
  const source = scorer || goalkeeper!;
  const normPlayer = normalizeArabicTeamName(source.playerName);
  const normTeam = normalizeArabicTeamName(source.teamName);

  const activeInjury =
    injuries.find(
      (inj) =>
        normalizeArabicTeamName(inj.playerName) === normPlayer &&
        normalizeArabicTeamName(inj.teamName) === normTeam &&
        inj.returnStatus !== 'fit_to_play'
    ) ||
    injuries.find((inj) => normalizeArabicTeamName(inj.playerName) === normPlayer) ||
    null;

  const teamStanding =
    standings.find(
      (s) =>
        s.competitionId === source.competitionId &&
        normalizeArabicTeamName(s.teamName) === normTeam
    ) || null;

  if (scorer) {
    return {
      id: scorer.id,
      role: 'outfield',
      playerName: scorer.playerName,
      teamName: scorer.teamName,
      teamId: scorer.teamId || generateDeterministicTeamId(scorer.teamName),
      teamColor: scorer.teamColor || '#10B981',
      competitionId: scorer.competitionId,
      positionText: formatStatOrUnavailable(scorer.position),
      shirtNumberText: formatStatOrUnavailable(scorer.shirtNumber, ''),
      matchesText: formatStatOrUnavailable(scorer.matches),
      goalsText: formatStatOrUnavailable(scorer.goals),
      assistsText: formatStatOrUnavailable(scorer.assists),
      minutesPlayedText: formatStatOrUnavailable(scorer.minutesPlayed, ' د'),
      yellowCardsText: formatStatOrUnavailable(scorer.yellowCards),
      redCardsText: formatStatOrUnavailable(scorer.redCards),
      ratingText: formatStatOrUnavailable(scorer.rating),
      cleanSheetsText: UNAVAILABLE_STAT_TEXT,
      goalsConcededText: UNAVAILABLE_STAT_TEXT,
      savesText: UNAVAILABLE_STAT_TEXT,
      activeInjury,
      teamStanding,
      isDemo: Boolean(scorer.isDemo),
    };
  }

  return {
    id: goalkeeper!.id,
    role: 'goalkeeper',
    playerName: goalkeeper!.playerName,
    teamName: goalkeeper!.teamName,
    teamId: goalkeeper!.teamId || generateDeterministicTeamId(goalkeeper!.teamName),
    teamColor: goalkeeper!.teamColor || '#10B981',
    competitionId: goalkeeper!.competitionId,
    positionText: 'حارس مرمى',
    shirtNumberText: UNAVAILABLE_STAT_TEXT,
    matchesText: formatStatOrUnavailable(goalkeeper!.matches),
    goalsText: UNAVAILABLE_STAT_TEXT,
    assistsText: UNAVAILABLE_STAT_TEXT,
    minutesPlayedText: UNAVAILABLE_STAT_TEXT,
    yellowCardsText: UNAVAILABLE_STAT_TEXT,
    redCardsText: UNAVAILABLE_STAT_TEXT,
    ratingText: UNAVAILABLE_STAT_TEXT,
    cleanSheetsText: formatStatOrUnavailable(goalkeeper!.cleanSheets),
    goalsConcededText: formatStatOrUnavailable(goalkeeper!.goalsConceded),
    savesText: formatStatOrUnavailable(goalkeeper!.saves),
    activeInjury,
    teamStanding,
    isDemo: Boolean(goalkeeper!.isDemo),
  };
}

export interface TeamProfileViewModel {
  team: TeamDirectoryItem;
  cityText: string;
  stadiumText: string;
  coachText: string;
  standing: StandingRow | null;
  recentFinishedMatches: MatchItem[];
  upcomingMatches: MatchItem[];
  squadScorers: TopScorer[];
  squadGoalkeepers: GoalkeeperStat[];
  activeInjuries: InjuryReportItem[];
}

export function buildTeamProfileSummary(params: {
  team: TeamDirectoryItem;
  matches: MatchItem[];
  standings: StandingRow[];
  scorers: TopScorer[];
  goalkeepers: GoalkeeperStat[];
  injuries: InjuryReportItem[];
}): TeamProfileViewModel {
  const { team, matches, standings, scorers, goalkeepers, injuries } = params;
  const normTeam = normalizeArabicTeamName(team.name);

  const isSameTeam = (candidateName: string) => {
    const n = normalizeArabicTeamName(candidateName);
    return n === normTeam || (team.aliases || []).some((al) => normalizeArabicTeamName(al) === n);
  };

  const standing = standings.find((s) => isSameTeam(s.teamName)) || null;

  const teamMatches = matches.filter((m) => isSameTeam(m.homeTeam) || isSameTeam(m.awayTeam));
  const recentFinishedMatches = [...teamMatches]
    .filter((m) => m.status === 'finished')
    .sort((a, b) => new Date(b.kickoffIso).getTime() - new Date(a.kickoffIso).getTime())
    .slice(0, 5);

  const upcomingMatches = [...teamMatches]
    .filter((m) => m.status !== 'finished' && m.status !== 'cancelled')
    .sort((a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime())
    .slice(0, 5);

  return {
    team,
    cityText: formatStatOrUnavailable(team.city),
    stadiumText: formatStatOrUnavailable(team.stadium),
    coachText: formatStatOrUnavailable(team.coachName),
    standing,
    recentFinishedMatches,
    upcomingMatches,
    squadScorers: scorers.filter((s) => isSameTeam(s.teamName)),
    squadGoalkeepers: goalkeepers.filter((g) => isSameTeam(g.teamName)),
    activeInjuries: injuries.filter((inj) => isSameTeam(inj.teamName)),
  };
}

/**
 * التحقق الإلزامي للقسم الطبي الإخباري (الإصابات والجاهزية):
 * - يمنع أي تشخيص طبي أو خبر إصابة غير منسوب لمصدر رسمي واضح
 * - يرفض الحفظ إذا لم يُذكر اسم اللاعب والنادي والإصابة المعلنة واسم المصدر
 * - يرفض الإصابات التي تُسجّل بصفة رسمية دون رابط مصدر أو اعتماد رسمي مرفق
 */
export function validateAndBuildInjuryReport(
  input: Omit<InjuryReportItem, 'id' | 'lastUpdatedAt'> & { id?: string }
): { ok: true; record: InjuryReportItem } | { ok: false; error: string } {
  const playerName = (input.playerName || '').trim();
  const teamName = (input.teamName || '').trim();
  const declaredInjury = (input.declaredInjury || '').trim();
  const sourceName = (input.sourceName || '').trim();
  const sourceUrl = (input.sourceUrl || '').trim();
  const announcedDate = (input.announcedDate || '').trim() || new Date().toISOString().slice(0, 10);

  if (playerName.length < 2) {
    return { ok: false, error: 'يرجى إدخال اسم اللاعب المصاب بدقة.' };
  }
  if (teamName.length < 2) {
    return { ok: false, error: 'يرجى تحديد النادي أو المنتخب التابع له اللاعب.' };
  }
  if (declaredInjury.length < 3) {
    return { ok: false, error: 'يرجى ذكر نوع الإصابة المعلن فقط دون تشخيصات غير موثقة.' };
  }
  if (sourceName.length < 3) {
    return {
      ok: false,
      error:
        'ممنوع نشر تشخيص طبي دون مصدر: يرجى إدخال اسم المصدر الرسمي (بيان النادي / الاتحاد / التصريح الرسمي).',
    };
  }
  if (!input.isVerifiedOfficial && !sourceUrl) {
    return {
      ok: false,
      error:
        'يجب تأكيد الاعتماد الرسمي للمصدر أو إرفاق رابط البيان الرسمي قبل نشر التقرير الطبي.',
    };
  }

  const nowIso = new Date().toISOString();
  const record: InjuryReportItem = {
    id:
      input.id ||
      generateDeterministicInjuryId({
        playerName,
        teamName,
        announcedDate,
      }),
    playerId: input.playerId,
    playerName,
    teamId: input.teamId || generateDeterministicTeamId(teamName),
    teamName,
    competitionId: input.competitionId || 'pro_league',
    declaredInjury,
    announcedDate,
    lastUpdatedAt: nowIso,
    declaredAbsenceDuration:
      (input.declaredAbsenceDuration || '').trim() || 'غير محدد رسمياً',
    returnStatus: input.returnStatus || 'unknown',
    sourceName,
    sourceUrl: sourceUrl || undefined,
    isVerifiedOfficial: Boolean(input.isVerifiedOfficial),
  };

  return { ok: true, record };
}
