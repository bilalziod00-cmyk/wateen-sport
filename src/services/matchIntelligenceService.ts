import {
  CompetitionId,
  MatchEvent,
  MatchItem,
  MatchStatus,
  StandingRow,
  StandingsHistoryEntry,
} from '../types/sports';
import {
  generateDeterministicMatchId,
  generateDeterministicTeamId,
} from '../utils/deterministicIds';
import { isLiveMatchStatus } from '../utils/matchStatus';
import { normalizeArabicTeamName } from '../utils/sportsMathEngine';

/**
 * التحقق الإلزامي من سبب التعديل اليدوي على جدول الترتيب (بما يشمل خصم النقاط أو تغيير النقاط يدوياً)
 */
export function validateManualStandingAdjustment(params: {
  isEditingExisting: boolean;
  previousRow?: StandingRow | null;
  nextRow: StandingRow;
}): { ok: boolean; error?: string } {
  const { isEditingExisting, previousRow, nextRow } = params;
  const reason = (nextRow.manualAdjustmentReason || '').trim();
  const hasPointDeduction = (nextRow.pointsDeducted || 0) > 0;
  const hasManualPointsOverride =
    nextRow.points !== nextRow.won * 3 + nextRow.drawn - (nextRow.pointsDeducted || 0);

  const statsChangedManually =
    isEditingExisting &&
    previousRow &&
    (previousRow.points !== nextRow.points ||
      previousRow.played !== nextRow.played ||
      previousRow.won !== nextRow.won ||
      previousRow.drawn !== nextRow.drawn ||
      previousRow.lost !== nextRow.lost ||
      previousRow.goalsFor !== nextRow.goalsFor ||
      previousRow.goalsAgainst !== nextRow.goalsAgainst ||
      (previousRow.pointsDeducted || 0) !== (nextRow.pointsDeducted || 0));

  if ((statsChangedManually || hasPointDeduction || hasManualPointsOverride) && reason.length < 4) {
    return {
      ok: false,
      error:
        'يجب إدخال سبب واضح للتعديل اليدوي أو خصم النقاط (4 أحرف على الأقل) لحفظه في سجل التغييرات التاريخي',
    };
  }

  return { ok: true };
}

/**
 * إنشاء لقطة تاريخية منظمة لتغيير جدول الترتيب (Standings History Snapshot)
 */
export function createStandingsHistoryEntry(params: {
  competitionId: CompetitionId;
  season?: string;
  round?: string;
  triggerType: 'match_result' | 'manual_adjustment' | 'recalculation' | 'import_batch';
  reason: string;
  actor: string;
  sortedCompRows: StandingRow[];
}): StandingsHistoryEntry {
  const nowIso = new Date().toISOString();
  return {
    id: `sth_${params.competitionId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    competitionId: params.competitionId,
    season: params.season || '2026 / 2027',
    round: params.round,
    triggerType: params.triggerType,
    recordedAt: nowIso,
    reason: params.reason.trim(),
    actor: params.actor || 'نظام الترتيب الآلي',
    snapshot: params.sortedCompRows.map((r, idx) => ({
      teamId: r.teamId || generateDeterministicTeamId(r.teamName),
      teamName: r.teamName,
      position: r.position || idx + 1,
      played: r.played,
      points: r.points,
      goalDifference: r.goalsFor - r.goalsAgainst,
    })),
  };
}

/**
 * حساب حركة المراكز لكل فريق (▲ صعود / ▼ تراجع / 0 ثابت) مقارنة بآخر لقطة تاريخية سابقة
 */
export function computeTeamRankDeltas(
  currentCompRows: StandingRow[],
  history: StandingsHistoryEntry[],
  competitionId: CompetitionId
): Record<string, number> {
  const compHistory = history.filter((h) => h.competitionId === competitionId);
  // نحتاج اللقطة السابقة للّقطة الأحدث (إن وجدت لقطتان على الأقل)، أو اللقطة الوحيدة المحفوظة قبل آخر تغيير
  const referenceSnapshot =
    compHistory.length >= 2 ? compHistory[1] : compHistory.length === 1 ? compHistory[0] : null;

  if (!referenceSnapshot) return {};

  const prevPosByNorm = new Map<string, number>();
  for (const item of referenceSnapshot.snapshot) {
    prevPosByNorm.set(normalizeArabicTeamName(item.teamName), item.position);
  }

  const deltas: Record<string, number> = {};
  currentCompRows.forEach((row, idx) => {
    const curPos = row.position || idx + 1;
    const prevPos = prevPosByNorm.get(normalizeArabicTeamName(row.teamName));
    if (typeof prevPos === 'number') {
      // رقم موجب = صعد في الترتيب (مثلاً من المركز 3 إلى المركز 1 => +2)
      deltas[row.teamName] = prevPos - curPos;
    }
  });
  return deltas;
}

/**
 * إضافة حدث رسمي (هدف / بطاقة / تبديل) لمباراة بأمان ومنع التكرار مع تحديث النتيجة اختيارياً عند تسجيل هدف
 * ملاحظة أمانة البيانات: لا يُنشئ أحداثاً عشوائية أو وهمية أبداً
 */
export function appendMatchEventSafely(
  match: MatchItem,
  newEvent: Omit<MatchEvent, 'id'> & { id?: string },
  syncScoreOnGoal = true
): { match: MatchItem; added: boolean; reason?: string } {
  const playerClean = (newEvent.playerName || '').trim();
  if (!playerClean) {
    return { match, added: false, reason: 'يجب إدخال اسم اللاعب للحدث' };
  }
  const minute = Math.max(1, Math.min(130, Number(newEvent.minute) || 1));

  // منع تكرار نفس الحدث في نفس الدقيقة لنفس اللاعب ونفس النوع
  const duplicate = (match.events || []).some(
    (ev) =>
      ev.minute === minute &&
      ev.team === newEvent.team &&
      ev.type === newEvent.type &&
      normalizeArabicTeamName(ev.playerName) === normalizeArabicTeamName(playerClean)
  );
  if (duplicate) {
    return { match, added: false, reason: 'هذا الحدث مسجل مسبقاً في نفس الدقيقة لنفس اللاعب' };
  }

  const eventObj: MatchEvent = {
    id: newEvent.id || `ev_${match.id}_${minute}_${newEvent.type}_${Date.now()}`,
    minute,
    team: newEvent.team,
    type: newEvent.type,
    playerName: playerClean,
    detail: newEvent.detail?.trim() || undefined,
  };

  let homeScore = match.homeScore;
  let awayScore = match.awayScore;
  if (syncScoreOnGoal && eventObj.type === 'goal') {
    if (eventObj.team === 'home') homeScore += 1;
    else awayScore += 1;
  }

  const nextEvents = [...(match.events || []), eventObj].sort((a, b) => a.minute - b.minute);

  return {
    match: {
      ...match,
      homeScore,
      awayScore,
      liveMinute: isLiveMatchStatus(match.status)
        ? Math.max(match.liveMinute || 1, minute)
        : match.liveMinute,
      events: nextEvents,
    },
    added: true,
  };
}

/**
 * تحويل أكواد الحالة من مزودي البيانات الرسميين (API-Football / Sportmonks / JFA)
 * إلى الحالات الثمانية الموحدة في منصة وتين سبورت دون اختلاق أي أحداث مفقودة
 */
export function mapExternalStatusCodeToWateenStatus(rawCode: string): MatchStatus {
  const code = (rawCode || '').trim().toUpperCase();
  switch (code) {
    case 'NS':
    case 'TBD':
    case 'SCHEDULED':
    case 'UPCOMING':
      return 'upcoming';
    case '1H':
    case 'FIRST_HALF':
      return 'first_half';
    case 'HT':
    case 'HALFTIME':
      return 'halftime';
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'SECOND_HALF':
      return 'second_half';
    case 'LIVE':
    case 'IN_PLAY':
      return 'live';
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'FINISHED':
      return 'finished';
    case 'PST':
    case 'SUSP':
    case 'INT':
    case 'POSTPONED':
      return 'postponed';
    case 'CANC':
    case 'ABD':
    case 'AWD':
    case 'WO':
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'upcoming';
  }
}

export interface ExternalMatchFeedRecord {
  competitionId: CompetitionId;
  season?: string;
  round: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  statusCode: string;
  liveMinute?: number | null;
  kickoffIso: string;
  stadium?: string;
  events?: Omit<MatchEvent, 'id'>[];
}

/**
 * تطبيع بيانات مباراة قادمة من مزود خارجي رسمي إلى MatchItem بمعرف ثابت
 * بدون اختلاق أي أحداث إذا لم يزودها المصدر الرسمي
 */
export function normalizeExternalMatchApiPayload(record: ExternalMatchFeedRecord): MatchItem {
  const status = mapExternalStatusCodeToWateenStatus(record.statusCode);
  const id = generateDeterministicMatchId({
    competitionId: record.competitionId,
    season: record.season,
    round: record.round,
    homeTeam: record.homeTeam,
    awayTeam: record.awayTeam,
  });

  const events: MatchEvent[] = Array.isArray(record.events)
    ? record.events
        .filter((e) => e && e.playerName && Number.isFinite(Number(e.minute)))
        .map((e, idx) => ({
          id: `ext_ev_${id}_${idx}_${e.minute}`,
          minute: Number(e.minute),
          team: e.team,
          type: e.type,
          playerName: e.playerName.trim(),
          detail: e.detail,
        }))
        .sort((a, b) => a.minute - b.minute)
    : [];

  return {
    id,
    competitionId: record.competitionId,
    season: record.season || '2026 / 2027',
    round: record.round || 'الجولة 1',
    homeTeamId: generateDeterministicTeamId(record.homeTeam),
    awayTeamId: generateDeterministicTeamId(record.awayTeam),
    homeTeam: record.homeTeam.trim(),
    homeShort: record.homeTeam.trim().replace(/^نادي\s+/, '').slice(0, 10),
    homeColor: '#10B981',
    awayTeam: record.awayTeam.trim(),
    awayShort: record.awayTeam.trim().replace(/^نادي\s+/, '').slice(0, 10),
    awayColor: '#38BDF8',
    homeScore: typeof record.homeScore === 'number' && record.homeScore >= 0 ? record.homeScore : 0,
    awayScore: typeof record.awayScore === 'number' && record.awayScore >= 0 ? record.awayScore : 0,
    status,
    liveMinute:
      isLiveMatchStatus(status) && status !== 'halftime' && typeof record.liveMinute === 'number'
        ? record.liveMinute
        : undefined,
    kickoffIso: record.kickoffIso || new Date().toISOString(),
    stadium: record.stadium?.trim() || '',
    isApproved: true,
    isDemo: false,
    events,
  };
}
