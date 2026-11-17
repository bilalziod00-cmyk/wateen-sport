import { SportsGraphicCard } from '../types/sports';
import { COMPETITIONS } from '../constants/competitions';

const ACCENT_HEX = {
  emerald: '#10B981',
  crimson: '#E11D48',
  gold: '#F59E0B',
  sky: '#0EA5E9',
};

// توليد بطاقة وتين سبورت كصورة PNG عالية الدقة (1080×1080) جاهزة للنشر على إنستغرام وواتساب وفيسبوك
export async function exportSportsCardAsPng(card: SportsGraphicCard): Promise<boolean> {
  try {
    const size = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const accent = ACCENT_HEX[card.accent] || '#10B981';
    const comp = COMPETITIONS[card.competitionId];

    // خلفية داكنة مستوحاة من الملاعب
    const bgGrad = ctx.createLinearGradient(0, 0, size, size);
    bgGrad.addColorStop(0, '#0B1420');
    bgGrad.addColorStop(0.55, '#070B10');
    bgGrad.addColorStop(1, '#0D1926');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // تحميل صورة الخلفية في النصف العلوي
    try {
      const bgImg = await loadImage(card.imageUrl || './images/stadium-night.jpg');
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, size, 580);
      ctx.clip();
      const scale = Math.max(size / bgImg.width, 580 / bgImg.height);
      const dw = bgImg.width * scale;
      const dh = bgImg.height * scale;
      ctx.drawImage(bgImg, (size - dw) / 2, (580 - dh) / 2, dw, dh);
      ctx.restore();
    } catch {
      // fallback gradient only
    }

    // تدرج سينمائي فوق الصورة
    const overlay = ctx.createLinearGradient(0, 100, 0, 620);
    overlay.addColorStop(0, 'rgba(7,11,16,0.2)');
    overlay.addColorStop(0.65, 'rgba(7,11,16,0.85)');
    overlay.addColorStop(1, '#070B10');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, size, 620);

    // خط علوي بلون الهوية
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, size, 12);

    // شارة الكيكر والبطولة
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.font = '800 30px Cairo, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(`${card.kicker}  •  ${comp.shortName}`, size - 64, 96);

    // العنوان الرئيسي
    ctx.font = '900 58px Cairo, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    wrapRtlText(ctx, card.title, size - 64, 495, size - 128, 72, 2);

    // العنوان الفرعي
    ctx.font = '600 30px Cairo, sans-serif';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(card.subtitle.slice(0, 56), size - 64, 625);

    // صناديق الإحصائيات الثلاثة
    const metrics = card.metrics.slice(0, 3);
    const boxW = 300;
    const boxH = 195;
    const gap = 26;
    const totalW = metrics.length * boxW + (metrics.length - 1) * gap;
    const startX = (size - totalW) / 2;
    const boxY = 695;

    metrics.forEach((m, idx) => {
      const x = startX + idx * (boxW + gap);
      roundRect(ctx, x, boxY, boxW, boxH, 28);
      ctx.fillStyle = m.highlight ? `${accent}26` : 'rgba(255,255,255,0.05)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = m.highlight ? accent : 'rgba(255,255,255,0.14)';
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 52px Cairo, sans-serif';
      ctx.fillStyle = m.highlight ? accent : '#FFFFFF';
      ctx.fillText(m.value.slice(0, 14), x + boxW / 2, boxY + 96);

      ctx.font = '700 24px Cairo, sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(m.label.slice(0, 20), x + boxW / 2, boxY + 152);
    });

    // تذييل وتين سبورت
    ctx.textAlign = 'right';
    ctx.font = '900 34px Cairo, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('وتين سبورت  |  Wateen Sport', size - 64, 995);

    ctx.textAlign = 'left';
    ctx.font = '700 24px Cairo, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText('نبض الكرة الأردنية ⚽🇯🇴', 64, 995);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `wateen-card-${card.id}.png`;
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
