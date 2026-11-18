import {
  CompetitionId,
  CompetitionRuleConfig,
  GoalkeeperStat,
  MatchItem,
  StandingRow,
  StandingZone,
  TeamDirectoryItem,
  TieBreakerCriterion,
} from '../types/sports';
import {
  getDefaultCompetitionRules,
  INITIAL_JORDAN_TEAMS_DIRECTORY,
} from '../constants/competitions';
import {
  generateDeterministicStandingId,
  generateDeterministicTeamId,
} from './deterministicIds';

export const UNCLEAR_VALUE_MARKER = 'غير واضح';

// تطبيع الأسماء العربية للمقارنة الدقيقة واكتشاف الأسماء المتشابهة
export function normalizeArabicTeamName(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/^(نادي|فريق|شباب نادي)\s+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[-_./\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// حساب مسافة التشابه Levenshtein لاكتشاف الأخطاء الإملائية في أسماء الأندية
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export interface TeamResolutionResult {
  status: 'matched' | 'similar' | 'unknown';
  canonicalName: string;
  shortName: string;
  color: string;
  suggestedTeamName?: string;
}

/**
 * مطابقة اسم الفريق مع سجل الفرق المعتمدة في البطولة أو الدليل العام
 */
export function resolveTeamFromDirectory(
  inputName: string,
  competitionId: CompetitionId,
  directory: TeamDirectoryItem[] = INITIAL_JORDAN_TEAMS_DIRECTORY,
  existingStandings: StandingRow[] = []
): TeamResolutionResult {
  const cleaned = (inputName || '').trim();
  if (!cleaned || cleaned === UNCLEAR_VALUE_MARKER) {
    return {
      status: 'unknown',
      canonicalName: cleaned || UNCLEAR_VALUE_MARKER,
      shortName: cleaned.slice(0, 10) || '؟',
      color: '#10B981',
    };
  }

  const normInput = normalizeArabicTeamName(cleaned);

  // 1) البحث في فرق الترتيب الحالية لنفس البطولة
  for (const row of existingStandings) {
    if (
      normalizeArabicTeamName(row.teamName) === normInput ||
      normalizeArabicTeamName(row.shortName) === normInput
    ) {
      return {
        status: 'matched',
        canonicalName: row.teamName,
        shortName: row.shortName,
        color: row.teamColor,
      };
    }
  }

  // 2) البحث عن تطابق تام أو عبر المرادفات في دليل الأندية
  for (const team of directory) {
    const normCanonical = normalizeArabicTeamName(team.name);
    const normShort = normalizeArabicTeamName(team.shortName);
    const aliasMatch = (team.aliases || []).some(
      (al) => normalizeArabicTeamName(al) === normInput
    );
    if (normCanonical === normInput || normShort === normInput || aliasMatch) {
      return {
        status: 'matched',
        canonicalName: team.name,
        shortName: team.shortName,
        color: team.color,
      };
    }
  }

  // 3) البحث عن تشابه جزئي أو إملائي قريب
  let bestCandidate: { name: string; shortName: string; color: string; dist: number } | null =
    null;

  const candidatesPool = [
    ...directory.map((d) => ({
      name: d.name,
      shortName: d.shortName,
      color: d.color,
      comp: d.competitionId,
    })),
    ...existingStandings.map((s) => ({
      name: s.teamName,
      shortName: s.shortName,
      color: s.teamColor,
      comp: s.competitionId,
    })),
  ];

  for (const cand of candidatesPool) {
    const normCand = normalizeArabicTeamName(cand.name);
    if (!normCand) continue;
    const dist = levenshteinDistance(normInput, normCand);
    const contains =
      (normInput.length >= 4 && normCand.includes(normInput)) ||
      (normCand.length >= 4 && normInput.includes(normCand));

    if (contains || dist <= 2) {
      const effectiveDist = contains ? 1 : dist;
      const bonus = cand.comp === competitionId ? -0.2 : 0;
      if (!bestCandidate || effectiveDist + bonus < bestCandidate.dist) {
        bestCandidate = {
          name: cand.name,
          shortName: cand.shortName,
          color: cand.color,
          dist: effectiveDist + bonus,
        };
      }
    }
  }

  if (bestCandidate) {
    return {
      status: 'similar',
      canonicalName: cleaned,
      shortName: bestCandidate.shortName,
      color: bestCandidate.color,
      suggestedTeamName: bestCandidate.name,
    };
  }

  return {
    status: 'unknown',
    canonicalName: cleaned,
    shortName: cleaned.replace(/^نادي\s+/, '').slice(0, 12),
    color: '#10B981',
  };
}

/**
 * التحقق من تكرار المباراة (نفس البطولة، الجولة، الفريق المستضيف، والفريق الضيف)
 */
export function isDuplicateMatchItem(
  candidate: {
    id?: string;
    competitionId: CompetitionId;
    round?: string;
    homeTeam?: string;
    awayTeam?: string;
    season?: string;
  },
  existingMatches: MatchItem[]
): MatchItem | null {
  const normHome = normalizeArabicTeamName(candidate.homeTeam || '');
  const normAway = normalizeArabicTeamName(candidate.awayTeam || '');
  const normRound = (candidate.round || '').trim();

  if (!normHome || !normAway) return null;

  for (const m of existingMatches) {
    if (candidate.id && m.id === candidate.id) continue;
    if (m.competitionId !== candidate.competitionId) continue;
    const sameTeams =
      normalizeArabicTeamName(m.homeTeam) === normHome &&
      normalizeArabicTeamName(m.awayTeam) === normAway;
    const sameRound = !normRound || !m.round || m.round.trim() === normRound;
    if (sameTeams && sameRound) {
      return m;
    }
  }
  return null;
}

/**
 * حساب المواجهات المباشرة بين فريقين متعادلين بالنقاط
 */
function computeHeadToHead(
  teamANorm: string,
  teamBNorm: string,
  finishedMatches: MatchItem[],
  rule: CompetitionRuleConfig
): { pointsDiff: number; gdDiff: number } {
  let ptsA = 0;
  let ptsB = 0;
  let gdA = 0;
  let gdB = 0;

  for (const m of finishedMatches) {
    const h = normalizeArabicTeamName(m.homeTeam);
    const a = normalizeArabicTeamName(m.awayTeam);
    if ((h === teamANorm && a === teamBNorm) || (h === teamBNorm && a === teamANorm)) {
      const aIsHome = h === teamANorm;
      const goalsA = aIsHome ? m.homeScore : m.awayScore;
      const goalsB = aIsHome ? m.awayScore : m.homeScore;
      gdA += goalsA - goalsB;
      gdB += goalsB - goalsA;
      if (goalsA > goalsB) {
        ptsA += rule.pointsWin;
        ptsB += rule.pointsLoss;
      } else if (goalsA < goalsB) {
        ptsB += rule.pointsWin;
        ptsA += rule.pointsLoss;
      } else {
        ptsA += rule.pointsDraw;
        ptsB += rule.pointsDraw;
      }
    }
  }

  return {
    pointsDiff: ptsB - ptsA,
    gdDiff: gdB - gdA,
  };
}

/**
 * تحديد منطقة الترتيب (بطل، آسيوي، صعود، هبوط) بناءً على لائحة البطولة
 */
function resolveStandingZone(
  position: number,
  totalTeams: number,
  rule: CompetitionRuleConfig
): StandingZone {
  if (rule.championSpots > 0 && position <= rule.championSpots) {
    return 'champion';
  }
  if (
    rule.continentalSpots > 0 &&
    position > rule.championSpots &&
    position <= rule.championSpots + rule.continentalSpots
  ) {
    return 'continental';
  }
  if (rule.promotionSpots > 0 && position <= rule.promotionSpots) {
    return 'promotion';
  }
  if (
    rule.relegationSpots > 0 &&
    totalTeams > rule.relegationSpots &&
    position > totalTeams - rule.relegationSpots
  ) {
    return 'relegation';
  }
  return 'none';
}

/**
 * ترتيب صفوف الجدول حسب النقاط ثم معايير كسر التعادل المحددة في لائحة البطولة
 */
export function sortStandingsByCompetitionRules(
  rows: StandingRow[],
  finishedMatches: MatchItem[],
  rule?: CompetitionRuleConfig
): StandingRow[] {
  const activeRule =
    rule ||
    getDefaultCompetitionRules()[rows[0]?.competitionId || 'pro_league'] ||
    getDefaultCompetitionRules().pro_league;

  const tiebreakers: TieBreakerCriterion[] =
    activeRule.tiebreakers && activeRule.tiebreakers.length > 0
      ? activeRule.tiebreakers
      : ['head_to_head_points', 'head_to_head_gd', 'goal_difference', 'goals_for', 'wins'];

  const cloned = rows.map((r) => ({ ...r }));

  cloned.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    const normA = normalizeArabicTeamName(a.teamName);
    const normB = normalizeArabicTeamName(b.teamName);
    const h2h = computeHeadToHead(normA, normB, finishedMatches, activeRule);

    for (const criterion of tiebreakers) {
      if (criterion === 'head_to_head_points' && h2h.pointsDiff !== 0) {
        return h2h.pointsDiff;
      }
      if (criterion === 'head_to_head_gd' && h2h.gdDiff !== 0) {
        return h2h.gdDiff;
      }
      if (criterion === 'goal_difference') {
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
      }
      if (criterion === 'goals_for' && b.goalsFor !== a.goalsFor) {
        return b.goalsFor - a.goalsFor;
      }
      if (criterion === 'wins' && b.won !== a.won) {
        return b.won - a.won;
      }
    }

    return a.teamName.localeCompare(b.teamName, 'ar');
  });

  const total = cloned.length;
  return cloned.map((row, idx) => {
    const position = idx + 1;
    return {
      ...row,
      position,
      zone: resolveStandingZone(position, total, activeRule),
    };
  });
}

/**
 * محرك الحسابات الرياضية:
 * إعادة حساب جدول ترتيب البطولة تلقائياً عند اعتماد نتيجة مباراة جديدة أو تعديل نتيجة سابقة
 */
export function recalculateStandingsForCompetition(
  competitionId: CompetitionId,
  allMatches: MatchItem[],
  existingStandings: StandingRow[],
  rule?: CompetitionRuleConfig,
  directory: TeamDirectoryItem[] = INITIAL_JORDAN_TEAMS_DIRECTORY
): StandingRow[] {
  const activeRule =
    rule ||
    getDefaultCompetitionRules()[competitionId] ||
    getDefaultCompetitionRules().pro_league;

  const compStandings = existingStandings.filter((s) => s.competitionId === competitionId);
  const otherStandings = existingStandings.filter((s) => s.competitionId !== competitionId);

  const finishedCompMatches = allMatches.filter(
    (m) =>
      m.competitionId === competitionId &&
      m.status === 'finished' &&
      Number.isFinite(m.homeScore) &&
      Number.isFinite(m.awayScore) &&
      m.homeScore >= 0 &&
      m.awayScore >= 0
  );

  // إذا لم تكن هناك مباريات منتهية بعد، نرتب الجدول الحالي فقط حسب القواعد
  if (finishedCompMatches.length === 0) {
    const sortedExisting = sortStandingsByCompetitionRules(compStandings, [], activeRule);
    return [...otherStandings, ...sortedExisting];
  }

  // خريطة الفرق المشاركة في البطولة
  const teamMap = new Map<
    string,
    {
      existingRow?: StandingRow;
      teamName: string;
      shortName: string;
      teamColor: string;
      groupName?: string;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      pointsDeducted: number;
      form: ('W' | 'D' | 'L')[];
    }
  >();

  // تهيئة الفرق الموجودة مسبقاً في الجدول
  for (const row of compStandings) {
    const key = normalizeArabicTeamName(row.teamName);
    teamMap.set(key, {
      existingRow: row,
      teamName: row.teamName,
      shortName: row.shortName,
      teamColor: row.teamColor,
      groupName: row.groupName,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      pointsDeducted: row.pointsDeducted || 0,
      form: [],
    });
  }

  // ترتيب المباريات زمنياً لحساب سلسلة آخر 5 نتائج (Form) بدقة
  const chronologicalMatches = [...finishedCompMatches].sort(
    (a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
  );

  for (const match of chronologicalMatches) {
    const homeKey = normalizeArabicTeamName(match.homeTeam);
    const awayKey = normalizeArabicTeamName(match.awayTeam);

    if (!teamMap.has(homeKey)) {
      const resolved = resolveTeamFromDirectory(match.homeTeam, competitionId, directory, compStandings);
      teamMap.set(homeKey, {
        teamName: resolved.canonicalName,
        shortName: match.homeShort || resolved.shortName,
        teamColor: match.homeColor || resolved.color,
        groupName: match.groupName,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        pointsDeducted: 0,
        form: [],
      });
    }

    if (!teamMap.has(awayKey)) {
      const resolved = resolveTeamFromDirectory(match.awayTeam, competitionId, directory, compStandings);
      teamMap.set(awayKey, {
        teamName: resolved.canonicalName,
        shortName: match.awayShort || resolved.shortName,
        teamColor: match.awayColor || resolved.color,
        groupName: match.groupName,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        pointsDeducted: 0,
        form: [],
      });
    }

    const homeEntry = teamMap.get(homeKey)!;
    const awayEntry = teamMap.get(awayKey)!;

    homeEntry.played += 1;
    awayEntry.played += 1;
    homeEntry.goalsFor += match.homeScore;
    homeEntry.goalsAgainst += match.awayScore;
    awayEntry.goalsFor += match.awayScore;
    awayEntry.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      homeEntry.won += 1;
      awayEntry.lost += 1;
      homeEntry.form.push('W');
      awayEntry.form.push('L');
    } else if (match.homeScore < match.awayScore) {
      awayEntry.won += 1;
      homeEntry.lost += 1;
      awayEntry.form.push('W');
      homeEntry.form.push('L');
    } else {
      homeEntry.drawn += 1;
      awayEntry.drawn += 1;
      homeEntry.form.push('D');
      awayEntry.form.push('D');
    }
  }

  // دمج الفرق التي كان لها رصيد سابق في الجولات السابقة إذا كان عدد المباريات المسجلة أقل من رصيدها
  const computedRows: StandingRow[] = [];
  for (const [, entry] of teamMap.entries()) {
    const prev = entry.existingRow;
    const useAccumulatedFromMatches =
      !prev || entry.played >= prev.played || finishedCompMatches.length >= 3;

    const played = useAccumulatedFromMatches ? entry.played : prev.played;
    const won = useAccumulatedFromMatches ? entry.won : prev.won;
    const drawn = useAccumulatedFromMatches ? entry.drawn : prev.drawn;
    const lost = useAccumulatedFromMatches ? entry.lost : prev.lost;
    const goalsFor = useAccumulatedFromMatches ? entry.goalsFor : prev.goalsFor;
    const goalsAgainst = useAccumulatedFromMatches ? entry.goalsAgainst : prev.goalsAgainst;

    const rawPoints =
      won * activeRule.pointsWin +
      drawn * activeRule.pointsDraw +
      lost * activeRule.pointsLoss -
      (entry.pointsDeducted || 0);

    const effectiveGroup = entry.groupName || prev?.groupName || activeRule.groups[0] || 'الدوري العام';
    computedRows.push({
      id:
        prev?.id ||
        generateDeterministicStandingId({
          competitionId,
          season: activeRule.season,
          groupName: effectiveGroup,
          teamName: entry.teamName,
        }),
      competitionId,
      season: activeRule.season,
      groupName: effectiveGroup,
      teamId: prev?.teamId || generateDeterministicTeamId(entry.teamName),
      teamName: entry.teamName,
      shortName: entry.shortName,
      teamColor: entry.teamColor,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      points: Math.max(0, rawPoints),
      pointsDeducted: entry.pointsDeducted,
      isDemo: prev?.isDemo === true ? true : false,
      form:
        entry.form.length > 0
          ? entry.form.slice(-5)
          : prev?.form && prev.form.length > 0
          ? prev.form
          : ['W'],
    });
  }

  const sortedCompRows = sortStandingsByCompetitionRules(
    computedRows,
    finishedCompMatches,
    activeRule
  );

  return [...otherStandings, ...sortedCompRows];
}

/**
 * تطبيق نتيجة مباراة معتمدة واحدة مباشرة على جدول الترتيب الحالي (إضافة أو تعديل نتيجة سابقة)
 */
export function applyApprovedMatchResultToStandings(
  newMatch: MatchItem,
  previousMatchState: MatchItem | null,
  currentStandings: StandingRow[],
  allMatches: MatchItem[],
  rule?: CompetitionRuleConfig,
  directory: TeamDirectoryItem[] = INITIAL_JORDAN_TEAMS_DIRECTORY
): StandingRow[] {
  const competitionId = newMatch.competitionId;
  const activeRule =
    rule ||
    getDefaultCompetitionRules()[competitionId] ||
    getDefaultCompetitionRules().pro_league;

  const compRows = currentStandings
    .filter((s) => s.competitionId === competitionId)
    .map((s) => ({ ...s, form: [...(s.form || [])] }));
  const otherRows = currentStandings.filter((s) => s.competitionId !== competitionId);

  const findOrCreateRow = (teamName: string, shortName: string, color: string): StandingRow => {
    const norm = normalizeArabicTeamName(teamName);
    let found = compRows.find((r) => normalizeArabicTeamName(r.teamName) === norm);
    if (!found) {
      const resolved = resolveTeamFromDirectory(teamName, competitionId, directory, compRows);
      const effectiveGroup = newMatch.groupName || activeRule.groups[0] || 'الدوري العام';
      found = {
        id: generateDeterministicStandingId({
          competitionId,
          season: activeRule.season,
          groupName: effectiveGroup,
          teamName: resolved.canonicalName,
        }),
        competitionId,
        season: activeRule.season,
        groupName: effectiveGroup,
        teamId: generateDeterministicTeamId(resolved.canonicalName),
        teamName: resolved.canonicalName,
        shortName: shortName || resolved.shortName,
        teamColor: color || resolved.color,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        isDemo: newMatch.isDemo === true ? true : false,
        form: [],
      };
      compRows.push(found);
    }
    return found;
  };

  // 1) إذا كانت المباراة منتهية سابقاً وتم تعديل نتيجتها، نعكس أثر النتيجة القديمة أولاً
  if (
    previousMatchState &&
    previousMatchState.status === 'finished' &&
    Number.isFinite(previousMatchState.homeScore) &&
    Number.isFinite(previousMatchState.awayScore)
  ) {
    const oldHome = findOrCreateRow(
      previousMatchState.homeTeam,
      previousMatchState.homeShort,
      previousMatchState.homeColor
    );
    const oldAway = findOrCreateRow(
      previousMatchState.awayTeam,
      previousMatchState.awayShort,
      previousMatchState.awayColor
    );

    oldHome.played = Math.max(0, oldHome.played - 1);
    oldAway.played = Math.max(0, oldAway.played - 1);
    oldHome.goalsFor = Math.max(0, oldHome.goalsFor - previousMatchState.homeScore);
    oldHome.goalsAgainst = Math.max(0, oldHome.goalsAgainst - previousMatchState.awayScore);
    oldAway.goalsFor = Math.max(0, oldAway.goalsFor - previousMatchState.awayScore);
    oldAway.goalsAgainst = Math.max(0, oldAway.goalsAgainst - previousMatchState.homeScore);

    if (previousMatchState.homeScore > previousMatchState.awayScore) {
      oldHome.won = Math.max(0, oldHome.won - 1);
      oldAway.lost = Math.max(0, oldAway.lost - 1);
    } else if (previousMatchState.homeScore < previousMatchState.awayScore) {
      oldAway.won = Math.max(0, oldAway.won - 1);
      oldHome.lost = Math.max(0, oldHome.lost - 1);
    } else {
      oldHome.drawn = Math.max(0, oldHome.drawn - 1);
      oldAway.drawn = Math.max(0, oldAway.drawn - 1);
    }
  }

  // 2) إذا كانت الحالة الجديدة منتهية، نضيف أثر النتيجة المعتمدة
  if (
    newMatch.status === 'finished' &&
    Number.isFinite(newMatch.homeScore) &&
    Number.isFinite(newMatch.awayScore)
  ) {
    const homeRow = findOrCreateRow(newMatch.homeTeam, newMatch.homeShort, newMatch.homeColor);
    const awayRow = findOrCreateRow(newMatch.awayTeam, newMatch.awayShort, newMatch.awayColor);

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += newMatch.homeScore;
    homeRow.goalsAgainst += newMatch.awayScore;
    awayRow.goalsFor += newMatch.awayScore;
    awayRow.goalsAgainst += newMatch.homeScore;

    if (newMatch.homeScore > newMatch.awayScore) {
      homeRow.won += 1;
      awayRow.lost += 1;
      homeRow.form = [...homeRow.form.slice(-4), 'W'];
      awayRow.form = [...awayRow.form.slice(-4), 'L'];
    } else if (newMatch.homeScore < newMatch.awayScore) {
      awayRow.won += 1;
      homeRow.lost += 1;
      awayRow.form = [...awayRow.form.slice(-4), 'W'];
      homeRow.form = [...homeRow.form.slice(-4), 'L'];
    } else {
      homeRow.drawn += 1;
      awayRow.drawn += 1;
      homeRow.form = [...homeRow.form.slice(-4), 'D'];
      awayRow.form = [...awayRow.form.slice(-4), 'D'];
    }
  }

  // 3) إعادة احتساب النقاط وترتيب الجدول حسب معايير كسر التعادل
  for (const r of compRows) {
    r.points = Math.max(
      0,
      r.won * activeRule.pointsWin +
        r.drawn * activeRule.pointsDraw +
        r.lost * activeRule.pointsLoss -
        (r.pointsDeducted || 0)
    );
  }

  const finishedCompMatches = allMatches.filter(
    (m) => m.competitionId === competitionId && m.status === 'finished'
  );
  const sorted = sortStandingsByCompetitionRules(compRows, finishedCompMatches, activeRule);
  return [...otherRows, ...sorted];
}

/**
 * حساب إحصائيات البطولة الشاملة (أفضل هجوم، أفضل دفاع، الشباك النظيفة، إحصائيات الفرق والحراس)
 */
export function computeCompetitionStatsSummary(
  competitionId: CompetitionId,
  standings: StandingRow[],
  matches: MatchItem[],
  goalkeepers: GoalkeeperStat[] = []
) {
  const compStandings = standings.filter((s) => s.competitionId === competitionId);
  const compMatches = matches.filter(
    (m) => m.competitionId === competitionId && m.status === 'finished'
  );
  const compGks = goalkeepers.filter((g) => g.competitionId === competitionId);

  const bestAttack = [...compStandings].sort((a, b) => b.goalsFor - a.goalsFor)[0] || null;
  const bestDefense =
    [...compStandings]
      .filter((s) => s.played > 0)
      .sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0] || null;
  const mostWins = [...compStandings].sort((a, b) => b.won - a.won)[0] || null;

  // حساب الشباك النظيفة لكل فريق من المباريات المنتهية
  const cleanSheetsByTeam = new Map<string, number>();
  for (const m of compMatches) {
    if (m.awayScore === 0) {
      cleanSheetsByTeam.set(m.homeTeam, (cleanSheetsByTeam.get(m.homeTeam) || 0) + 1);
    }
    if (m.homeScore === 0) {
      cleanSheetsByTeam.set(m.awayTeam, (cleanSheetsByTeam.get(m.awayTeam) || 0) + 1);
    }
  }

  const totalGoals = compMatches.reduce((acc, m) => acc + (m.homeScore || 0) + (m.awayScore || 0), 0);

  return {
    bestAttack,
    bestDefense,
    mostWins,
    totalMatchesFinished: compMatches.length,
    totalGoals,
    cleanSheetsByTeam: Object.fromEntries(cleanSheetsByTeam.entries()),
    topGoalkeepers: [...compGks].sort(
      (a, b) => b.cleanSheets - a.cleanSheets || a.goalsConceded - b.goalsConceded
    ),
  };
}
