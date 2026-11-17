import React from 'react';
import { Download, Sparkles } from 'lucide-react';
import { SportsGraphicCard } from '../types/sports';
import { COMPETITIONS } from '../constants/competitions';
import { ShareBar } from './ShareSheet';
import { exportSportsCardAsPng } from '../utils/cardCanvasExport';
import { useAppData } from '../context/AppDataContext';

interface SportsCardItemProps {
  card: SportsGraphicCard;
}

const accentStyles = {
  emerald: {
    border: 'border-emerald-500/35',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    glow: 'from-emerald-600/30 via-[#0C141F]/90 to-[#070B10]',
    value: 'text-emerald-300',
  },
  crimson: {
    border: 'border-rose-500/35',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
    glow: 'from-rose-600/30 via-[#0C141F]/90 to-[#070B10]',
    value: 'text-rose-300',
  },
  gold: {
    border: 'border-amber-500/35',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    glow: 'from-amber-600/30 via-[#0C141F]/90 to-[#070B10]',
    value: 'text-amber-300',
  },
  sky: {
    border: 'border-sky-500/35',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
    glow: 'from-sky-600/30 via-[#0C141F]/90 to-[#070B10]',
    value: 'text-sky-300',
  },
};

export const SportsCardItem: React.FC<SportsCardItemProps> = ({ card }) => {
  const { showToast } = useAppData();
  const style = accentStyles[card.accent] || accentStyles.emerald;
  const comp = COMPETITIONS[card.competitionId];

  const handleDownloadCard = async () => {
    const ok = await exportSportsCardAsPng(card);
    showToast(
      ok ? 'تم حفظ بطاقة وتين سبورت كصورة PNG جاهزة لإنستغرام وواتساب' : 'تعذر تصدير الصورة',
      ok ? 'emerald' : 'crimson'
    );
  };

  const shareText = [
    card.subtitle,
    ...card.metrics.map((m) => `• ${m.label}: ${m.value}`),
  ].join('\n');

  return (
    <article
      className={`relative rounded-2xl border ${style.border} overflow-hidden min-w-[295px] sm:min-w-[320px] flex flex-col justify-between shadow-xl bg-[#0B121B]`}
    >
      {/* خلفية الصورة مع تدرج سينمائي */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={card.imageUrl || './images/stadium-night.jpg'}
          alt={card.title}
          className="w-full h-full object-cover"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${style.glow}`} />
        <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border backdrop-blur-md ${style.badge}`}
          >
            <Sparkles className="w-3 h-3" />
            {card.kicker}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-black/55 text-[10px] font-bold text-slate-200 border border-white/10">
            {comp.shortName}
          </span>
        </div>

        <div className="absolute bottom-3 right-3 left-3">
          <h3 className="text-base font-black text-white leading-snug drop-shadow">
            {card.title}
          </h3>
          <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">{card.subtitle}</p>
        </div>
      </div>

      {/* الأرقام الإحصائية */}
      <div className="p-3.5 space-y-3 bg-pitch-900/95">
        <div className="grid grid-cols-3 gap-2">
          {card.metrics.slice(0, 3).map((metric, i) => (
            <div
              key={i}
              className="rounded-xl bg-[#111B29] border border-white/8 px-2 py-2 text-center"
            >
              <div
                className={`text-sm font-black tabular-nums ${
                  metric.highlight ? style.value : 'text-white'
                }`}
              >
                {metric.value}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-tight line-clamp-1">
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={handleDownloadCard}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-extrabold text-amber-300"
          >
            <Download className="w-3 h-3" />
            حفظ صورة
          </button>
          <ShareBar
            compact
            payload={{
              title: `${card.kicker} — ${card.title}`,
              text: shareText,
            }}
          />
        </div>
      </div>
    </article>
  );
};
