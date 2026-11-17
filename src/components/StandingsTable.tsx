import React from 'react';
import { StandingRow } from '../types/sports';
import { TeamCrest } from './TeamCrest';

interface StandingsTableProps {
  rows: StandingRow[];
  title?: string;
  compact?: boolean;
}

export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

export const StandingsTable: React.FC<StandingsTableProps> = ({ rows, title, compact = false }) => {
  const sorted = sortStandings(rows);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl bg-[#0E1621] border border-white/8 p-8 text-center text-slate-400 text-sm">
        لا يوجد جدول ترتيب مضاف لهذه البطولة حالياً. يمكنك إضافته فوراً من لوحة التحكم.
      </div>
    );
  }

  const getZoneBar = (zone?: StandingRow['zone']) => {
    switch (zone) {
      case 'champion':
        return 'bg-amber-400';
      case 'continental':
      case 'promotion':
        return 'bg-emerald-500';
      case 'relegation':
        return 'bg-rose-500';
      default:
        return 'bg-transparent';
    }
  };

  return (
    <div className="rounded-2xl bg-[#0E1621]/95 border border-white/10 overflow-hidden shadow-lg">
      {title && (
        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between bg-[#131E2D]/70">
          <h3 className="text-sm font-extrabold text-white">{title}</h3>
          <span className="text-[11px] text-slate-400 font-semibold">{sorted.length} فرق</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="text-[11px] font-bold text-slate-400 border-b border-white/8 bg-pitch-900/70">
              <th className="py-2.5 pr-3 pl-1.5 w-9">#</th>
              <th className="py-2.5 px-2">الفريق</th>
              <th className="py-2.5 px-1.5 text-center">لعب</th>
              {!compact && <th className="py-2.5 px-1.5 text-center">ف</th>}
              {!compact && <th className="py-2.5 px-1.5 text-center">ت</th>}
              {!compact && <th className="py-2.5 px-1.5 text-center">خ</th>}
              <th className="py-2.5 px-1.5 text-center">+/-</th>
              <th className="py-2.5 pl-3 pr-1.5 text-center text-emerald-400">نقاط</th>
              {!compact && <th className="py-2.5 pl-3 pr-2 text-center hidden sm:table-cell">آخر 5</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs tabular-nums">
            {sorted.map((row, idx) => {
              const gd = row.goalsFor - row.goalsAgainst;
              return (
                <tr
                  key={row.id}
                  className="hover:bg-white/[0.03] transition-colors"
                >
                  <td className="py-2.5 pr-3 pl-1.5 relative font-extrabold text-slate-300">
                    <span
                      className={`absolute right-0 top-1.5 bottom-1.5 w-1 rounded-l-full ${getZoneBar(
                        row.zone
                      )}`}
                    />
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2 min-w-[115px]">
                      <TeamCrest
                        name={row.teamName}
                        shortName={row.shortName}
                        color={row.teamColor}
                        size="xs"
                      />
                      <span className="font-bold text-slate-100 truncate">{row.teamName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-1.5 text-center text-slate-300 font-semibold">
                    {row.played}
                  </td>
                  {!compact && (
                    <td className="py-2.5 px-1.5 text-center text-emerald-300/90">{row.won}</td>
                  )}
                  {!compact && (
                    <td className="py-2.5 px-1.5 text-center text-slate-400">{row.drawn}</td>
                  )}
                  {!compact && (
                    <td className="py-2.5 px-1.5 text-center text-rose-300/90">{row.lost}</td>
                  )}
                  <td
                    className={`py-2.5 px-1.5 text-center font-bold ${
                      gd > 0 ? 'text-emerald-400' : gd < 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                  <td className="py-2.5 pl-3 pr-1.5 text-center">
                    <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-black">
                      {row.points}
                    </span>
                  </td>
                  {!compact && (
                    <td className="py-2.5 pl-3 pr-2 hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {(row.form || []).slice(-5).map((f, i) => (
                          <span
                            key={i}
                            className={`w-4 h-4 rounded-md text-[9px] font-black flex items-center justify-center ${
                              f === 'W'
                                ? 'bg-emerald-500/25 text-emerald-300'
                                : f === 'D'
                                ? 'bg-slate-600/40 text-slate-300'
                                : 'bg-rose-500/25 text-rose-300'
                            }`}
                          >
                            {f === 'W' ? 'ف' : f === 'D' ? 'ت' : 'خ'}
                          </span>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* دليل ألوان المراكز */}
      <div className="px-4 py-2.5 bg-pitch-950/60 border-t border-white/5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> الصدارة / البطل
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> التأهل / الصعود
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> منطقة الهبوط
        </span>
      </div>
    </div>
  );
};
