import {
  AutoTemplateCardType,
  CompetitionId,
  GoalkeeperStat,
  MatchItem,
  SportsGraphicCard,
  StandingRow,
  TopScorer,
} from '../types/sports';
import { COMPETITIONS } from '../constants/competitions';

const ACCENT_HEX = {
  emerald: '#00E640',
  crimson: '#E11D48',
  gold: '#F59E0B',
  sky: '#0EA5E9',
};

/**
 * التحقق من أن البيانات المصدر معتمدة رسمياً قبل إنشاء أي تصميم رياضي
 */
export function canGenerateGraphicFromSource(isApprovedSource = true): boolean {
  return isApprovedSource === true;
}

/**
 * توليد بطاقة رياضية تلقائية من البيانات الرسمية المعتمدة (7 قوالب احترافية بهوية WATEEN SPORT)
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
  mvpPlayer?: { playerName: string; teamName: string; goals: number; assists: number; rating?: string };
}): SportsGraphicCard | null {
  const comp = COMPETITIONS[params.competitionId];
  const now = new Date().toISOString();

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
      subtitle: `${m.round}  •  ${m.stadium}`,
      competitionId: params.competitionId,
      imageUrl: './images/stadium-night.jpg',
      accent: 'emerald',
      isApprovedSource: true,
      metrics: [
        { label: 'الجولة', value: m.round, highlight: true },
        { label: 'الملعب', value: m.stadium.slice(0, 16) },
        { label: 'الحالة', value: m.status === 'postponed' ? 'مؤجلة' : 'مباراة قادمة', highlight: true },
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
      subtitle: `${m.round}  •  ${m.stadium}`,
      competitionId: params.competitionId,
      imageUrl: './images/match-action.jpg',
      accent: 'emerald',
      isApprovedSource: true,
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
      tableRows: list.map((m) => [
        m.homeTeam,
        m.status === 'finished' ? `${m.homeScore} - ${m.awayScore}` : m.status === 'postponed' ? 'مؤجلة' : 'VS',
        m.awayTeam,
        m.stadium.slice(0, 16),
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
      metrics: [
        { label: 'الأهداف', value: `${p.goals}`, highlight: true },
        { label: 'صناعة الأهداف', value: `${p.assists}` },
        { label: 'تقييم وتين', value: p.rating || '9.1', highlight: true },
      ],
      createdAt: now,
    };
  }

  return null;
}

// توليد بطاقة وتين سبورت كصورة PNG عالية الدقة (1080×1080) مع شعار وعلامة WATEEN SPORT المائية
export async function exportSportsCardAsPng(card: SportsGraphicCard): Promise<boolean> {
  if (card.isApprovedSource === false) {
    return false;
  }

  try {
    const size = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const accent = ACCENT_HEX[card.accent] || '#00E640';
    const comp = COMPETITIONS[card.competitionId] || COMPETITIONS.pro_league;

    // 1) خلفية سوداء رياضية مستوحاة من الملاعب
    const bgGrad = ctx.createLinearGradient(0, 0, size, size);
    bgGrad.addColorStop(0, '#040B07');
    bgGrad.addColorStop(0.55, '#000000');
    bgGrad.addColorStop(1, '#06140C');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // 2) صورة الملعب في النصف العلوي
    try {
      const bgImg = await loadImage(card.imageUrl || './images/stadium-night.jpg');
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, size, 480);
      ctx.clip();
      const scale = Math.max(size / bgImg.width, 480 / bgImg.height);
      const dw = bgImg.width * scale;
      const dh = bgImg.height * scale;
      ctx.drawImage(bgImg, (size - dw) / 2, (480 - dh) / 2, dw, dh);
      ctx.restore();
    } catch {
      // fallback gradient
    }

    // 3) تدرج سينمائي فوق الخلفية
    const overlay = ctx.createLinearGradient(0, 60, 0, 520);
    overlay.addColorStop(0, 'rgba(0,0,0,0.35)');
    overlay.addColorStop(0.7, 'rgba(0,0,0,0.88)');
    overlay.addColorStop(1, '#000000');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, size, 520);

    // 4) علامة مائية متكررة باسم WATEEN SPORT
    ctx.save();
    ctx.font = '900 28px Cairo, sans-serif';
    ctx.fillStyle = 'rgba(0, 230, 64, 0.045)';
    for (let wy = 140; wy < size; wy += 180) {
      for (let wx = 80; wx < size; wx += 340) {
        ctx.fillText('WATEEN SPORT', wx, wy);
      }
    }
    ctx.restore();

    // 5) خط علوي فسفوري
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, size, 14);

    // 6) رسم شعار وتين سبورت الدائري الرسمي في الترويسة
    try {
      const logoImg = await loadImage('./images/app-icon.png');
      ctx.save();
      ctx.beginPath();
      ctx.arc(110, 105, 54, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logoImg, 56, 51, 108, 108);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(110, 105, 55, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = accent;
      ctx.stroke();
    } catch {
      // ignore if logo unavailable
    }

    // 7) شارة الكيكر والبطولة
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.font = '800 30px Cairo, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(`${card.kicker}  •  ${comp.shortName}`, size - 64, 96);

    // 8) العنوان الرئيسي والفرعي
    ctx.font = '900 54px Cairo, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    wrapRtlText(ctx, card.title, size - 64, 340, size - 128, 68, 2);

    ctx.font = '600 28px Cairo, sans-serif';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(card.subtitle.slice(0, 64), size - 64, 445);

    // 9) إذا كان القالب يحتوي على جدول (ترتيب / مباريات جولة / هدافين / حراس)
    if (Array.isArray(card.tableRows) && card.tableRows.length > 0) {
      const rows = card.tableRows.slice(0, 6);
      const startY = 485;
      const rowH = 68;

      rows.forEach((rCells, idx) => {
        const y = startY + idx * (rowH + 10);
        roundRect(ctx, 56, y, size - 112, rowH, 18);
        ctx.fillStyle = idx === 0 ? 'rgba(0, 230, 64, 0.16)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = idx === 0 ? accent : 'rgba(255, 255, 255, 0.12)';
        ctx.stroke();

        ctx.font = '800 26px Cairo, sans-serif';
        ctx.fillStyle = idx === 0 ? accent : '#FFFFFF';
        ctx.textAlign = 'right';
        ctx.fillText(rCells.slice(0, 2).join('  •  '), size - 86, y + 44);

        ctx.textAlign = 'left';
        ctx.font = '800 25px Cairo, sans-serif';
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(rCells.slice(2).join('   |   '), 86, y + 44);
      });
    } else {
      // صناديق الإحصائيات الثلاثة
      const metrics = card.metrics.slice(0, 3);
      const boxW = 300;
      const boxH = 195;
      const gap = 26;
      const totalW = metrics.length * boxW + (metrics.length - 1) * gap;
      const startX = (size - totalW) / 2;
      const boxY = 640;

      metrics.forEach((m, idx) => {
        const x = startX + idx * (boxW + gap);
        roundRect(ctx, x, boxY, boxW, boxH, 28);
        ctx.fillStyle = m.highlight ? 'rgba(0, 230, 64, 0.16)' : 'rgba(255,255,255,0.05)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = m.highlight ? accent : 'rgba(255,255,255,0.14)';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = '900 50px Cairo, sans-serif';
        ctx.fillStyle = m.highlight ? accent : '#FFFFFF';
        ctx.fillText(m.value.slice(0, 14), x + boxW / 2, boxY + 96);

        ctx.font = '700 24px Cairo, sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(m.label.slice(0, 20), x + boxW / 2, boxY + 152);
      });
    }

    // 10) تذييل الهوية البصرية الرسمي
    ctx.textAlign = 'right';
    ctx.font = '900 34px Cairo, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('وتين سبورت  |  WATEEN SPORT', size - 64, 1015);

    ctx.textAlign = 'left';
    ctx.font = '700 24px Cairo, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText('نبض الملاعب والكرة الأردنية ⚽🇯🇴', 64, 1015);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `wateen-sport-${card.type}-${card.id}.png`;
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
