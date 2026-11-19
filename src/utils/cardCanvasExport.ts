import {
  AutoTemplateCardType,
  CardExportSizePreset,
  CompetitionId,
  GoalkeeperStat,
  InjuryReportItem,
  MatchItem,
  NewsArticle,
  SportsGraphicCard,
  StandingRow,
  TopScorer,
} from '../types/sports';
import { COMPETITIONS } from '../constants/competitions';
import { getMatchStatusArabicLabel } from './matchStatus';
import { INJURY_STATUS_META, UNAVAILABLE_STAT_TEXT } from '../services/playersAndMedicalService';

const ACCENT_HEX = {
  emerald: '#00E640',
  crimson: '#E11D48',
  gold: '#F59E0B',
  sky: '#0EA5E9',
};

export const EXPORT_SIZE_PRESETS: Record<
  CardExportSizePreset,
  { id: CardExportSizePreset; label: string; width: number; height: number }
> = {
  instagram_square: {
    id: 'instagram_square',
    label: 'إنستغرام مربع (1080×1080)',
    width: 1080,
    height: 1080,
  },
  instagram_portrait: {
    id: 'instagram_portrait',
    label: 'إنستغرام بورتريه (1080×1350)',
    width: 1080,
    height: 1350,
  },
  facebook_landscape: {
    id: 'facebook_landscape',
    label: 'فيسبوك منشور عريض (1200×630)',
    width: 1200,
    height: 630,
  },
};

export const WATEEN_STUDIO_TEMPLATES_11: {
  id: AutoTemplateCardType;
  label: string;
  desc: string;
}[] = [
  { id: 'match_card', label: 'بطاقة مباراة', desc: 'تصميم بطاقة لمباراة قادمة أو مؤجلة' },
  { id: 'result_card', label: 'بطاقة نتيجة', desc: 'تصميم بطاقة لنتيجة مباراة معتمدة' },
  { id: 'standings_card', label: 'جدول ترتيب', desc: 'تصميم جدول ترتيب البطولة المعتمد' },
  { id: 'round_fixtures_card', label: 'جدول مباريات الجولة', desc: 'تصميم كامل لمباريات ونتائج الجولة' },
  { id: 'top_scorers_card', label: 'قائمة الهدافين', desc: 'تصميم قائمة هدافي البطولة' },
  { id: 'goalkeepers_card', label: 'إحصائيات الحراس', desc: 'تصميم الشباك النظيفة والأهداف المستقبلة' },
  { id: 'mvp_player_card', label: 'بطاقة أفضل لاعب', desc: 'تصميم بطاقة نجم الجولة من أرقام القاعدة' },
  { id: 'lineup_card', label: 'بطاقة التشكيلة', desc: 'تشكيلة وأبرز لاعبي الفريق المعتمدين' },
  { id: 'breaking_news_card', label: 'بطاقة خبر عاجل', desc: 'خبر عاجل موثق باسم المصدر الرسمي' },
  { id: 'transfer_card', label: 'بطاقة انتقال', desc: 'خبر انتقال/تعاقد رسمي معتمد' },
  { id: 'injury_card', label: 'بطاقة إصابة وجاهزية', desc: 'تقرير طبي رسمي بمصدر ومدة الغياب' },
];

/**
 * التحقق من أن البيانات المصدر معتمدة رسمياً قبل إنشاء أي تصميم رياضي
 */
export function canGenerateGraphicFromSource(isApprovedSource = true): boolean {
  return isApprovedSource === true;
}

/**
 * توليد بطاقة رياضية تلقائية من البيانات الرسمية المعتمدة (11 قالباً احترافياً بهوية WATEEN SPORT)
 * يمنع اختلاق أي أسماء لاعبين أو تقييمات أو أخبار غير موجودة في قاعدة البيانات المعتمدة
 */
export function buildAutoTemplateCardFromOfficialData(params: {
  templateType: AutoTemplateCardType;
  competitionId: CompetitionId;
  roundName?: string;
  match?: MatchItem;
  standings?: StandingRow[];
  roundMatches?: MatchItem[];
  scorers?: TopScorer[];
  goalkeepers?: GoalkeeperStat[];
  mvpPlayer?: {
    playerName: string;
    teamName: string;
    goals: number;
    assists: number;
    rating?: number | string | null;
  };
  article?: NewsArticle;
  injury?: InjuryReportItem;
  lineupPlayers?: string[];
  lineupTeamName?: string;
  sizePreset?: CardExportSizePreset;
}): SportsGraphicCard | null {
  const comp = COMPETITIONS[params.competitionId] || COMPETITIONS.pro_league;
  const now = new Date().toISOString();
  const sizePreset = params.sizePreset || 'instagram_square';

  // رفض توليد بطاقة من مباراة غير معتمدة
  if (params.match && params.match.isApproved === false) {
    return null;
  }

  if (params.templateType === 'match_card' && params.match) {
    const m = params.match;
    return {
      id: `auto-match-${Date.now()}`,
      type: 'match_card',
      kicker: `بطاقة مباراة • ${comp.name}`,
      title: `${m.homeTeam}  ×  ${m.awayTeam}`,
      subtitle: `${m.round}  •  ${m.stadium || 'الملعب غير محدد'}`,
      competitionId: params.competitionId,
      imageUrl: './images/stadium-night.jpg',
      accent: 'emerald',
      isApprovedSource: true,
      sizePreset,
      metrics: [
        { label: 'الجولة', value: m.round, highlight: true },
        { label: 'الملعب', value: (m.stadium || UNAVAILABLE_STAT_TEXT).slice(0, 16) },
        { label: 'الحالة', value: getMatchStatusArabicLabel(m.status, m.liveMinute), highlight: true },
      ],
      createdAt: now,
    };
  }

  if (params.templateType === 'result_card' && params.match) {
    const m = params.match;
    return {
      id: `auto-res-${Date.now()}`,
      type: 'result_card',
      kicker: `نتيجة رسمية معتمدة • ${comp.name}`,
      title: `${m.homeTeam}  ${m.homeScore} - ${m.awayScore}  ${m.awayTeam}`,
      subtitle: `${m.round}  •  ${m.stadium || 'الملعب غير محدد'}`,
      competitionId: params.competitionId,
      imageUrl: './images/match-action.jpg',
      accent: 'emerald',
      isApprovedSource: true,
      sizePreset,
      metrics: [
        { label: m.homeShort || m.homeTeam, value: `${m.homeScore}`, highlight: m.homeScore >= m.awayScore },
        { label: 'النتيجة النهائية', value: `${m.homeScore} - ${m.awayScore}`, highlight: true },
        { label: m.awayShort || m.awayTeam, value: `${m.awayScore}`, highlight: m.awayScore >= m.homeScore },
      ],
      createdAt: now,
    };
  }

  if (params.templateType === 'standings_card') {
    const rows = (params.standings || [])
      .filter((s) => s.competitionId === params.competitionId)
      .slice(0, 6);
    if (rows.length === 0) return null;
    return {
      id: `auto-st-${Date.now()}`,
      type: 'standings_card',
      kicker: `جدول الترتيب الرسمي • ${comp.season}`,
      title: `ترتيب ${comp.name}`,
      subtitle: 'تحديث تلقائي معتمد — وتين سبورت',
      competitionId: params.competitionId,
      imageUrl: './images/stadium-night.jpg',
      accent: 'emerald',
      isApprovedSource: true,
      sizePreset,
      tableRows: rows.map((r, i) => [
        `${r.position || i + 1}`,
        r.teamName,
        `لعب ${r.played}`,
        `فارق ${r.goalsFor - r.goalsAgainst >= 0 ? `+${r.goalsFor - r.goalsAgainst}` : r.goalsFor - r.goalsAgainst}`,
        `${r.points} نقطة`,
      ]),
      metrics: rows.slice(0, 3).map((r, i) => ({
        label: `#${i + 1} ${r.shortName}`,
        value: `${r.points} نقطة`,
        highlight: i === 0,
      })),
      createdAt: now,
    };
  }

  if (params.templateType === 'round_fixtures_card') {
    const list = (params.roundMatches || []).slice(0, 6);
    if (list.length === 0) return null;
    const roundTitle = params.roundName || list[0]?.round || 'مباريات الجولة';
    return {
      id: `auto-rnd-${Date.now()}`,
      type: 'round_fixtures_card',
      kicker: `مباريات ونتائج الجولة • ${comp.shortName}`,
      title: `${roundTitle} — ${comp.name}`,
      subtitle: 'جدول مباريات الجولة المعتمد بتوقيت عمّان',
      competitionId: params.competitionId,
      imageUrl: './images/stadium-night.jpg',
      accent: 'sky',
      isApprovedSource: true,
      sizePreset,
      tableRows: list.map((m) => [
        m.homeTeam,
        m.status === 'finished'
          ? `${m.homeScore} - ${m.awayScore}`
          : m.status === 'postponed'
          ? 'مؤجلة'
          : m.status === 'cancelled'
          ? 'ملغاة'
          : 'VS',
        m.awayTeam,
        (m.stadium || 'غير محدد').slice(0, 16),
      ]),
      metrics: [
        { label: 'عدد المباريات', value: `${list.length}`, highlight: true },
        { label: 'البطولة', value: comp.shortName },
        { label: 'الجولة', value: roundTitle, highlight: true },
      ],
      createdAt: now,
    };
  }

  if (params.templateType === 'top_scorers_card') {
    const list = (params.scorers || [])
      .filter((s) => s.competitionId === params.competitionId)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 5);
    if (list.length === 0) return null;
    return {
      id: `auto-sc-${Date.now()}`,
      type: 'top_scorers_card',
      kicker: `سباق الحذاء الذهبي • ${comp.shortName}`,
      title: `قائمة هدافي ${comp.name}`,
      subtitle: 'إحصائيات التهديف والصناعة المعتمدة',
      competitionId: params.competitionId,
      imageUrl: './images/match-action.jpg',
      accent: 'gold',
      isApprovedSource: true,
      sizePreset,
      tableRows: list.map((s, i) => [
        `#${i + 1}`,
        s.playerName,
        s.teamName,
        `${s.goals} هدف`,
        `${s.assists} صناعة`,
      ]),
      metrics: list.slice(0, 3).map((s, i) => ({
        label: `${s.playerName} (${s.teamName})`,
        value: `${s.goals} أهداف`,
        highlight: i === 0,
      })),
      createdAt: now,
    };
  }

  if (params.templateType === 'goalkeepers_card') {
    const list = (params.goalkeepers || [])
      .filter((g) => g.competitionId === params.competitionId)
      .sort((a, b) => b.cleanSheets - a.cleanSheets || a.goalsConceded - b.goalsConceded)
      .slice(0, 5);
    if (list.length === 0) return null;
    return {
      id: `auto-gk-${Date.now()}`,
      type: 'goalkeepers_card',
      kicker: `القفاز الذهبي • الشباك النظيفة`,
      title: `إحصائيات حراس ${comp.name}`,
      subtitle: 'الأكثر حفاظاً على نظافة الشباك',
      competitionId: params.competitionId,
      imageUrl: './images/stadium-night.jpg',
      accent: 'emerald',
      isApprovedSource: true,
      sizePreset,
      tableRows: list.map((g, i) => [
        `#${i + 1}`,
        g.playerName,
        g.teamName,
        `${g.cleanSheets} كلين شيت`,
        `استقبل ${g.goalsConceded}`,
      ]),
      metrics: list.slice(0, 3).map((g, i) => ({
        label: `${g.playerName} (${g.teamName})`,
        value: `${g.cleanSheets} شباك نظيفة`,
        highlight: i === 0,
      })),
      createdAt: now,
    };
  }

  if (params.templateType === 'mvp_player_card' && params.mvpPlayer) {
    const p = params.mvpPlayer;
    const ratingValue =
      p.rating !== null && p.rating !== undefined && String(p.rating).trim() !== ''
        ? String(p.rating)
        : UNAVAILABLE_STAT_TEXT;
    return {
      id: `auto-mvp-${Date.now()}`,
      type: 'mvp_player_card',
      kicker: `بطاقة أفضل لاعب • ${comp.shortName}`,
      title: p.playerName,
      subtitle: `نجم ${p.teamName} في ${comp.name}`,
      competitionId: params.competitionId,
      imageUrl: './images/match-action.jpg',
      accent: 'emerald',
      isApprovedSource: true,
      sizePreset,
      metrics: [
        { label: 'الأهداف', value: `${p.goals}`, highlight: true },
        { label: 'صناعة الأهداف', value: `${p.assists}` },
        { label: 'التقييم الرسمي', value: ratingValue, highlight: ratingValue !== UNAVAILABLE_STAT_TEXT },
      ],
      createdAt: now,
    };
  }

  // القالب 8: بطاقة التشكيلة (من قائمة لاعبي الفريق المسجلين أو التشكيلة الرسمية المدخلة)
  if (params.templateType === 'lineup_card') {
    const cleanLineup = (params.lineupPlayers || []).map((x) => x.trim()).filter(Boolean);
    const derivedSquad = (params.scorers || [])
      .filter((s) => !params.lineupTeamName || s.teamName === params.lineupTeamName)
      .map((s) => `${s.playerName} (${s.position || s.teamName})`);
    const finalPlayers = cleanLineup.length > 0 ? cleanLineup : derivedSquad;
    if (finalPlayers.length === 0) return null;

    const teamLabel = params.lineupTeamName || params.match?.homeTeam || comp.shortName;
    return {
      id: `auto-lineup-${Date.now()}`,
      type: 'lineup_card',
      kicker: `القائمة المعتمدة • ${comp.shortName}`,
      title: `تشكيلة ${teamLabel}`,
      subtitle: params.match
        ? `${params.match.homeTeam} × ${params.match.awayTeam} (${params.match.round})`
        : `${comp.name} • موسم ${comp.season}`,
      competitionId: params.competitionId,
      imageUrl: './images/stadium-night.jpg',
      accent: 'emerald',
      isApprovedSource: true,
      sizePreset,
      tableRows: finalPlayers.slice(0, 6).map((pName, idx) => [`#${idx + 1}`, pName]),
      metrics: [
        { label: 'الفريق', value: teamLabel.slice(0, 16), highlight: true },
        { label: 'اللاعبون المدرجون', value: `${finalPlayers.length}` },
        { label: 'البطولة', value: comp.shortName, highlight: true },
      ],
      createdAt: now,
    };
  }

  // القالب 9: بطاقة خبر عاجل (من خبر معتمد في قاعدة البيانات فقط)
  if (params.templateType === 'breaking_news_card' && params.article) {
    const art = params.article;
    if (art.verificationStatus === 'rejected') return null;
    return {
      id: `auto-brk-${Date.now()}`,
      type: 'breaking_news_card',
      kicker: `عاجل • ${comp.shortName}`,
      title: art.title,
      subtitle: `${art.summary.slice(0, 68)} • المصدر: ${art.sourceName || art.author}`,
      competitionId: art.competitionId || params.competitionId,
      imageUrl: art.imageUrl || './images/stadium-night.jpg',
      accent: 'crimson',
      isApprovedSource: true,
      sizePreset,
      metrics: [
        { label: 'البطولة', value: comp.shortName, highlight: true },
        { label: 'التصنيف', value: 'خبر عاجل' },
        { label: 'المصدر', value: (art.sourceName || art.author).slice(0, 18), highlight: true },
      ],
      createdAt: now,
    };
  }

  // القالب 10: بطاقة انتقال رسمي (من خبر انتقالات موثق)
  if (params.templateType === 'transfer_card' && params.article) {
    const art = params.article;
    if (art.verificationStatus === 'rejected') return null;
    return {
      id: `auto-tr-${Date.now()}`,
      type: 'transfer_card',
      kicker: `سوق الانتقالات الرسمي • ${comp.shortName}`,
      title: art.title,
      subtitle: `المصدر: ${art.sourceName || art.author}`,
      competitionId: art.competitionId || params.competitionId,
      imageUrl: art.imageUrl || './images/match-action.jpg',
      accent: 'gold',
      isApprovedSource: true,
      sizePreset,
      metrics: [
        { label: 'البطولة', value: comp.shortName, highlight: true },
        { label: 'الحالة', value: art.editorialType === 'transfer_rumor' ? 'تحت المتابعة' : 'مؤكد' },
        { label: 'المصدر', value: (art.sourceName || art.author).slice(0, 18), highlight: true },
      ],
      createdAt: now,
    };
  }

  // القالب 11: بطاقة إصابة وجاهزية (من سجل طبي منسوب لمصدر رسمي فقط)
  if (params.templateType === 'injury_card' && params.injury) {
    const inj = params.injury;
    if (!inj.sourceName || !inj.sourceName.trim()) return null;
    const statusLabel =
      INJURY_STATUS_META[inj.returnStatus]?.label || 'بانتظار التقرير الرسمي';
    return {
      id: `auto-inj-${Date.now()}`,
      type: 'injury_card',
      kicker: `التقرير الطبي الموثّق • ${inj.teamName}`,
      title: `${inj.playerName} — ${inj.declaredInjury}`,
      subtitle: `المصدر الرسمي: ${inj.sourceName} (${inj.announcedDate})`,
      competitionId: inj.competitionId || params.competitionId,
      imageUrl: './images/stadium-night.jpg',
      accent: 'crimson',
      isApprovedSource: true,
      sizePreset,
      metrics: [
        { label: 'النادي', value: inj.teamName.slice(0, 16), highlight: true },
        { label: 'الحالة', value: statusLabel },
        { label: 'مدة الغياب', value: (inj.declaredAbsenceDuration || 'غير محدد رسمياً').slice(0, 18), highlight: true },
      ],
      createdAt: now,
    };
  }

  return null;
}

// توليد بطاقة وتين سبورت كصورة PNG عالية الدقة (1080×1080، 1080×1350، أو 1200×630) مع شعار وعلامة WATEEN SPORT المائية
export async function exportSportsCardAsPng(
  card: SportsGraphicCard,
  sizePreset: CardExportSizePreset = card.sizePreset || 'instagram_square'
): Promise<boolean> {
  if (card.isApprovedSource === false) {
    return false;
  }

  try {
    const presetMeta = EXPORT_SIZE_PRESETS[sizePreset] || EXPORT_SIZE_PRESETS.instagram_square;
    const width = presetMeta.width;
    const height = presetMeta.height;
    const isLandscape = width > height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const accent = ACCENT_HEX[card.accent] || '#00E640';
    const comp = COMPETITIONS[card.competitionId] || COMPETITIONS.pro_league;

    // 1) خلفية سوداء رياضية مستوحاة من الملاعب
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#040B07');
    bgGrad.addColorStop(0.55, '#000000');
    bgGrad.addColorStop(1, '#06140C');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2) صورة الخلفية المخصصة (ما لم يختر المدير خلفية داكنة نقية solid_black)
    const headerHeroH = Math.round(height * (isLandscape ? 0.44 : 0.45));
    if (card.imageUrl && card.imageUrl !== 'solid_black') {
      try {
        const bgImg = await loadImage(card.imageUrl);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, headerHeroH);
        ctx.clip();
        const scale = Math.max(width / bgImg.width, headerHeroH / bgImg.height);
        const dw = bgImg.width * scale;
        const dh = bgImg.height * scale;
        ctx.drawImage(bgImg, (width - dw) / 2, (headerHeroH - dh) / 2, dw, dh);
        ctx.restore();
      } catch {
        // fallback gradient
      }
    }

    // 3) تدرج سينمائي فوق الخلفية
    const overlay = ctx.createLinearGradient(0, Math.round(height * 0.05), 0, headerHeroH + 40);
    overlay.addColorStop(0, 'rgba(0,0,0,0.35)');
    overlay.addColorStop(0.7, 'rgba(0,0,0,0.88)');
    overlay.addColorStop(1, '#000000');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, headerHeroH + 40);

    // 4) علامة مائية متكررة باسم WATEEN SPORT
    ctx.save();
    ctx.font = '900 26px Cairo, sans-serif';
    ctx.fillStyle = 'rgba(0, 230, 64, 0.045)';
    for (let wy = 120; wy < height; wy += 170) {
      for (let wx = 70; wx < width; wx += 340) {
        ctx.fillText('WATEEN SPORT', wx, wy);
      }
    }
    ctx.restore();

    // 5) خط علوي فسفوري
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, width, isLandscape ? 10 : 14);

    // 6) رسم شعار وتين سبورت الدائري الرسمي في الترويسة
    const logoRadius = isLandscape ? 38 : 54;
    const logoX = isLandscape ? 82 : 110;
    const logoY = isLandscape ? 72 : 105;
    try {
      const logoImg = await loadImage('./images/app-icon.png');
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX, logoY, logoRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(
        logoImg,
        logoX - logoRadius,
        logoY - logoRadius,
        logoRadius * 2,
        logoRadius * 2
      );
      ctx.restore();

      ctx.beginPath();
      ctx.arc(logoX, logoY, logoRadius + 1, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = accent;
      ctx.stroke();
    } catch {
      // ignore if logo unavailable
    }

    // 7) شارة الكيكر والبطولة
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.font = isLandscape ? '800 22px Cairo, sans-serif' : '800 30px Cairo, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(`${card.kicker}  •  ${comp.shortName}`, width - 56, isLandscape ? 72 : 96);

    // 8) العنوان الرئيسي والفرعي
    ctx.font = isLandscape ? '900 38px Cairo, sans-serif' : '900 52px Cairo, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    const titleY = isLandscape ? 165 : Math.round(height * 0.31);
    wrapRtlText(ctx, card.title, width - 56, titleY, width - 112, isLandscape ? 48 : 66, 2);

    ctx.font = isLandscape ? '600 21px Cairo, sans-serif' : '600 27px Cairo, sans-serif';
    ctx.fillStyle = '#CBD5E1';
    const subY = isLandscape ? 255 : Math.round(height * 0.415);
    ctx.fillText(card.subtitle.slice(0, 72), width - 56, subY);

    // 9) محتوى الجدول أو صناديق الإحصائيات الثلاثة
    if (Array.isArray(card.tableRows) && card.tableRows.length > 0 && !isLandscape) {
      const rows = card.tableRows.slice(0, height >= 1300 ? 7 : 6);
      const startY = Math.round(height * 0.46);
      const rowH = height >= 1300 ? 74 : 66;

      rows.forEach((rCells, idx) => {
        const y = startY + idx * (rowH + 10);
        roundRect(ctx, 56, y, width - 112, rowH, 18);
        ctx.fillStyle = idx === 0 ? 'rgba(0, 230, 64, 0.16)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = idx === 0 ? accent : 'rgba(255, 255, 255, 0.12)';
        ctx.stroke();

        ctx.font = '800 25px Cairo, sans-serif';
        ctx.fillStyle = idx === 0 ? accent : '#FFFFFF';
        ctx.textAlign = 'right';
        ctx.fillText(rCells.slice(0, 2).join('  •  '), width - 86, y + Math.round(rowH * 0.64));

        ctx.textAlign = 'left';
        ctx.font = '800 24px Cairo, sans-serif';
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(rCells.slice(2).join('   |   '), 86, y + Math.round(rowH * 0.64));
      });
    } else {
      const metrics = card.metrics.slice(0, 3);
      const boxW = isLandscape ? 320 : 300;
      const boxH = isLandscape ? 145 : 195;
      const gap = 26;
      const totalW = metrics.length * boxW + (metrics.length - 1) * gap;
      const startX = (width - totalW) / 2;
      const boxY = isLandscape ? 320 : Math.round(height * 0.59);

      metrics.forEach((m, idx) => {
        const x = startX + idx * (boxW + gap);
        roundRect(ctx, x, boxY, boxW, boxH, isLandscape ? 20 : 28);
        ctx.fillStyle = m.highlight ? 'rgba(0, 230, 64, 0.16)' : 'rgba(255,255,255,0.05)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = m.highlight ? accent : 'rgba(255,255,255,0.14)';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = isLandscape ? '900 36px Cairo, sans-serif' : '900 46px Cairo, sans-serif';
        ctx.fillStyle = m.highlight ? accent : '#FFFFFF';
        ctx.fillText(m.value.slice(0, 16), x + boxW / 2, boxY + (isLandscape ? 72 : 96));

        ctx.font = isLandscape ? '700 20px Cairo, sans-serif' : '700 24px Cairo, sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(m.label.slice(0, 22), x + boxW / 2, boxY + (isLandscape ? 116 : 152));
      });
    }

    // 10) تذييل الهوية البصرية الرسمي
    const footerY = height - (isLandscape ? 42 : 65);
    ctx.textAlign = 'right';
    ctx.font = isLandscape ? '900 26px Cairo, sans-serif' : '900 34px Cairo, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('وتين سبورت  |  WATEEN SPORT', width - 56, footerY);

    ctx.textAlign = 'left';
    ctx.font = isLandscape ? '700 20px Cairo, sans-serif' : '700 24px Cairo, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText('نبض الملاعب والكرة الأردنية ⚽🇯🇴', 56, footerY);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `wateen-sport-${card.type}-${width}x${height}-${card.id}.png`;
    a.click();
    return true;
  } catch {
    return false;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapRtlText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
      lineCount += 1;
      if (lineCount >= maxLines - 1) break;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
}
