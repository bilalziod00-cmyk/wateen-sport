import React, { useState } from 'react';
import { ExternalLink, Play, Radio, Tv, Youtube } from 'lucide-react';
import { LiveStreamItem } from '../types/sports';
import { COMPETITIONS } from '../constants/competitions';
import { parseLiveStreamUrl } from '../utils/streamEmbed';
import { ShareBar } from './ShareSheet';

interface LiveStreamPlayerProps {
  stream: LiveStreamItem;
  autoPlayBox?: boolean;
}

export const LiveStreamPlayer: React.FC<LiveStreamPlayerProps> = ({
  stream,
  autoPlayBox = false,
}) => {
  const [playing, setPlaying] = useState(autoPlayBox);
  const parsed = parseLiveStreamUrl(stream.url);
  const comp = COMPETITIONS[stream.competitionId];

  return (
    <div className="rounded-3xl bg-gradient-to-b from-[#17121E] via-[#0E1621] to-[#0A1019] border border-rose-500/40 overflow-hidden shadow-glow-red">
      {/* ترويسة البث المباشر */}
      <div className="px-4 py-3 flex items-center justify-between gap-2 bg-rose-500/10 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black shrink-0 shadow">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse-live" />
            بث مباشر
          </span>
          <span className="text-[11px] font-bold text-slate-300 truncate">{comp.shortName}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border ${
              parsed.platform === 'youtube'
                ? 'bg-red-500/15 text-red-300 border-red-500/35'
                : parsed.platform === 'facebook'
                ? 'bg-blue-500/15 text-blue-300 border-blue-500/35'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
            }`}
          >
            {parsed.platform === 'youtube' ? (
              <Youtube className="w-3 h-3" />
            ) : (
              <Tv className="w-3 h-3" />
            )}
            {parsed.platformLabel}
          </span>
        </div>
      </div>

      {/* منطقة الفيديو 16:9 */}
      <div className="relative aspect-video bg-black w-full">
        {playing && parsed.embedUrl ? (
          <iframe
            src={parsed.embedUrl}
            title={stream.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (parsed.embedUrl) {
                setPlaying(true);
              } else if (parsed.originalUrl) {
                window.open(parsed.originalUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            className="relative w-full h-full flex flex-col items-center justify-center gap-3 group overflow-hidden"
          >
            <img
              src="./images/stadium-night.jpg"
              alt={stream.title}
              className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/30" />
            <div className="relative z-10 w-16 h-16 rounded-full bg-rose-600 group-hover:bg-rose-500 text-white flex items-center justify-center shadow-[0_0_32px_rgba(225,29,72,0.65)] transition-transform group-hover:scale-110">
              <Play className="w-7 h-7 fill-current mr-0.5" />
            </div>
            <div className="relative z-10 px-4 text-center">
              <div className="text-sm sm:text-base font-black text-white">
                اضغط لتشغيل البث المباشر داخل التطبيق
              </div>
              <div className="text-[11px] text-rose-200/90 mt-0.5 flex items-center justify-center gap-1">
                <Radio className="w-3.5 h-3.5" />
                {parsed.platformLabel}
              </div>
            </div>
          </button>
        )}
      </div>

      {/* تفاصيل البث + فتح بالرابط الأصلي + مشاركة */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-white leading-snug">
            {stream.title}
          </h3>
          {stream.subtitle && (
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{stream.subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/8">
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-[11px] font-extrabold text-slate-200"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            فتح في {parsed.platform === 'youtube' ? 'يوتيوب' : parsed.platform === 'facebook' ? 'فيسبوك' : 'المتصفح'}
          </a>

          <ShareBar
            compact
            payload={{
              title: `🔴 بث مباشر الآن: ${stream.title}`,
              text: `شاهد البث المباشر الآن عبر تطبيق وتين سبورت: ${parsed.originalUrl}`,
              url: parsed.originalUrl,
            }}
          />
        </div>
      </div>
    </div>
  );
};
