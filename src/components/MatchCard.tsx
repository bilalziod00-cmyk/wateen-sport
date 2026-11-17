import React from 'react';
import { Clock, MapPin, Radio, Tv } from 'lucide-react';
import { MatchItem } from '../types/sports';
import { COMPETITIONS } from '../constants/competitions';
import { formatAmmanDate, formatAmmanTime } from '../utils/ammanTime';
import { TeamCrest } from './TeamCrest';

interface MatchCardProps {
  match: MatchItem;
  compact?: boolean;
  onSelect: (match: MatchItem) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, compact = false, onSelect }) => {
  const comp = COMPETITIONS[match.competitionId];
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

  return (
    <button
      type="button"
      onClick={() => onSelect(match)}
      className={`w-full text-right rounded-2xl border transition-all duration-200 active:scale-[0.99] overflow-hidden ${
        isLive
          ? 'bg-gradient-to-br from-[#132229] via-[#0E1823] to-[#0B121B] border-emerald-500/40 shadow-glow'
          : 'bg-[#0E1621]/95 border-white/8 hover:border-emerald-500/25'
      } ${compact ? 'p-3.5 min-w-[275px]' : 'p-4'}`}
    >
      {/* الرأس: البطولة والجولة والحالة */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: comp.accentFrom }}
          />
          <span className="text-[11px] font-bold text-slate-300 truncate">{comp.shortName}</span>
          <span className="text-[10px] text-slate-500">• {match.round}</span>
        </div>

        {isLive ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse-live" />
            مباشر {match.liveMinute ? `${match.liveMinute}'` : ''}
          </span>
        ) : isFinished ? (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-white/10 shrink-0">
            انتهت
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 tabular-nums">
            <Clock className="w-3 h-3" />
            {formatAmmanTime(match.kickoffIso)}
          </span>
        )}
      </div>

      {/* الفرق والنتيجة */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* الفريق المستضيف */}
        <div
          className={
            compact
              ? 'flex flex-col items-center text-center gap-1.5 min-w-0'
              : 'flex items-center gap-2 min-w-0'
          }
        >
          <TeamCrest
            name={match.homeTeam}
            shortName={match.homeShort}
            color={match.homeColor}
            size={compact ? 'sm' : 'md'}
          />
          <span
            className={`text-xs sm:text-sm font-extrabold text-white leading-snug ${
              compact ? 'line-clamp-1 w-full' : 'line-clamp-2'
            }`}
          >
            {match.homeTeam}
          </span>
        </div>

        {/* مربع النتيجة أو التوقيت */}
        <div className="flex flex-col items-center justify-center px-1.5">
          {match.status === 'upcoming' ? (
            <div className="px-2.5 py-1.5 rounded-xl bg-pitch-900/90 border border-white/10 text-center">
              <div className="text-xs font-black text-emerald-400 tabular-nums">VS</div>
              <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                {formatAmmanDate(match.kickoffIso)}
              </div>
            </div>
          ) : (
            <div
              className={`px-3 py-1.5 rounded-xl border text-center tabular-nums whitespace-nowrap ${
                isLive
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-white'
                  : 'bg-pitch-900/90 border-white/10 text-slate-100'
              }`}
            >
              <span className="text-lg sm:text-xl font-black tracking-wider">
                {match.homeScore} <span className="text-slate-500 mx-0.5">-</span> {match.awayScore}
              </span>
            </div>
          )}
        </div>

        {/* الفريق الضيف */}
        <div
          className={
            compact
              ? 'flex flex-col items-center text-center gap-1.5 min-w-0'
              : 'flex items-center justify-end gap-2 min-w-0'
          }
        >
          {compact && (
            <TeamCrest
              name={match.awayTeam}
              shortName={match.awayShort}
              color={match.awayColor}
              size="sm"
            />
          )}
          <span
            className={`text-xs sm:text-sm font-extrabold text-white leading-snug ${
              compact ? 'line-clamp-1 w-full' : 'line-clamp-2 text-left'
            }`}
          >
            {match.awayTeam}
          </span>
          {!compact && (
            <TeamCrest
              name={match.awayTeam}
              shortName={match.awayShort}
              color={match.awayColor}
              size="md"
            />
          )}
        </div>
      </div>

      {/* التذييل: الملعب الأردني والتوقيت بتوقيت عمّان */}
      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-1 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{match.stadium}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {match.broadcast && !compact && (
            <span className="inline-flex items-center gap-1 text-amber-300/90">
              <Tv className="w-3 h-3" />
              {match.broadcast}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
            <Radio className="w-3 h-3 text-slate-500" />
            توقيت عمّان
          </span>
        </div>
      </div>
    </button>
  );
};
