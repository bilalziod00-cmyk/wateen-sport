/**
 * تطبيع الاسم العربي داخلياً (بدون استيراد دائري) لضمان تطابق البصمة مع sportsMathEngine
 */
function normalizeArabicKey(raw: string | undefined): string {
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

/**
 * توليد بصمة ثابتة (Deterministic FNV-1a 32-bit Hash) لإنتاج معرفات دائمة لا تتغير عند إعادة الاستيراد أو تحديث التطبيق
 */
export function stableHash(input: string): string {
  const str = (input || '').trim().toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function normKey(raw: string | undefined): string {
  return normalizeArabicKey(raw).replace(/\s+/g, '_');
}

/** معرف ثابت للفريق بناءً على الاسم المعياري */
export function generateDeterministicTeamId(teamName: string): string {
  return `tm_${stableHash(normKey(teamName))}`;
}

/** معرف ثابت للمباراة يمنع التكرار نهائياً عند إعادة الاستيراد أو المزامنة */
export function generateDeterministicMatchId(params: {
  competitionId: string;
  season?: string;
  round?: string;
  homeTeam: string;
  awayTeam: string;
}): string {
  const key = [
    params.competitionId || 'pro_league',
    (params.season || '2026_2027').replace(/\s+/g, ''),
    normKey(params.round || 'round_1'),
    normKey(params.homeTeam),
    normKey(params.awayTeam),
  ].join('|');
  return `match_${stableHash(key)}`;
}

/** معرف ثابت لصف الترتيب لكل فريق في بطولة وموسم ومجموعة */
export function generateDeterministicStandingId(params: {
  competitionId: string;
  season?: string;
  groupName?: string;
  teamName: string;
}): string {
  const key = [
    params.competitionId || 'pro_league',
    (params.season || '2026_2027').replace(/\s+/g, ''),
    normKey(params.groupName || 'general'),
    normKey(params.teamName),
  ].join('|');
  return `st_${stableHash(key)}`;
}

/** معرف ثابت للاعب داخل بطولته وناديه */
export function generateDeterministicPlayerId(params: {
  competitionId: string;
  playerName: string;
  teamName: string;
}): string {
  const key = [
    params.competitionId || 'pro_league',
    normKey(params.playerName),
    normKey(params.teamName),
  ].join('|');
  return `pl_${stableHash(key)}`;
}

/** معرف ثابت لحارس المرمى داخل بطولته وناديه */
export function generateDeterministicGoalkeeperId(params: {
  competitionId: string;
  playerName: string;
  teamName: string;
}): string {
  const key = [
    params.competitionId || 'pro_league',
    normKey(params.playerName),
    normKey(params.teamName),
  ].join('|');
  return `gk_${stableHash(key)}`;
}

/** معرف ثابت للخبر لمنع تكرار الأخبار المجلوبة من نفس الرابط أو العنوان */
export function generateDeterministicNewsId(params: {
  sourceUrl?: string;
  originalTitle: string;
}): string {
  const canonicalUrl = (params.sourceUrl || '').trim().toLowerCase().replace(/\/+$/, '');
  const key = canonicalUrl || normKey(params.originalTitle);
  return `news_${stableHash(key)}`;
}

/** معرف ثابت لسجل إصابة لاعب */
export function generateDeterministicInjuryId(params: {
  playerName: string;
  teamName: string;
  announcedDate?: string;
}): string {
  const key = [
    normKey(params.playerName),
    normKey(params.teamName),
    (params.announcedDate || '').slice(0, 10),
  ].join('|');
  return `inj_${stableHash(key)}`;
}
