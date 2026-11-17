import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Clock,
  MapPin,
  ShieldAlert,
  Sparkles,
  Tv,
  UserCheck,
} from 'lucide-react';
import { MatchItem } from '../types/sports';
import { COMPETITIONS } from '../constants/competitions';
import { formatAmmanDate, formatAmmanTime } from '../utils/ammanTime';
import { TeamCrest } from '../components/TeamCrest';
import { ShareBar } from '../components/ShareSheet';
import { LiveStreamPlayer } from '../components/LiveStreamPlayer';
import { parseLiveStreamUrl } from '../utils/streamEmbed';

interface MatchDetailModalProps {
  match: MatchItem;
  onClose: () => void;
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({ match, onClose }) => {
  const comp = COMPETITIONS[match.competitionId];
  const isLive = match.status === 'live';

  const statsRows = match.stats
    ? [
        {
          label: 'الاستحواذ %',
          home: match.stats.possessionHome,
          away: 100 - match.stats.possessionHome,
          suffix: '%',
        },
        { label: 'التسديدات', home: match.stats.shotsHome, away: match.stats.shotsAway, suffix: '' },
        {
          label: 'على المرمى',
          home: match.stats.shotsOnTargetHome,
          away: match.stats.shotsOnTargetAway,
          suffix: '',
        },
        {
          label: 'الركنيات',
          home: match.stats.cornersHome,
          away: match.stats.cornersAway,
          suffix: '',
        },
        { label: 'الأخطاء', home: match.stats.foulsHome, away: match.stats.foulsAway, suffix: '' },
      ]
    : [];

  const shareSummary =
    match.status === 'upcoming'
      ? `${match.homeTeam} × ${match.awayTeam} — ${comp.name} (${match.round})\nالموعد: ${formatAmmanDate(match.kickoffIso)} الساعة ${formatAmmanTime(match.kickoffIso)} بتوقيت عمّان\nالملعب: ${match.stadium}`
      : `نتيجة المباراة (${isLive ? `مباشر ${match.liveMinute || ''}'` : 'نهائية'}): ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}\n${comp.name} • ${match.stadium}`;

  return (
    <div className="fixed inset-0 z-50 bg-[#070B10] overflow-y-auto">
      <div className="max-w-3xl mx-auto min-h-full flex flex-col">
        <header className="sticky top-0 z-20 px-4 py-3 bg-[#070B10]/90 backdrop-blur-lg border-b border-white/10 flex items-center justify-between safe-top">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/15 text-xs font-extrabold text-white"
          >
            <ArrowRight className="w-4 h-4" />
            رجوع
          </button>
          <span className="text-xs font-extrabold text-slate-300">
            {comp.name} • {match.round}
          </span>
        </header>

        <div className="p-4 sm:p-6 space-y-5">
          {/* لوحة الملعب والنتيجة */}
          <div className="relative rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#132431] via-[#0D1622] to-[#080D14] p-5 sm:p-6 shadow-2xl stadium-grid">
            <div className="flex items-center justify-center mb-4">
              {isLive ? (
                <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse-live" />
                  مباشر الآن • الدقيقة {match.liveMinute || 1}&apos;
                </span>
              ) : match.status === 'finished' ? (
                <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200 text-xs font-extrabold">
                  نهاية المباراة
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-xs font-extrabold tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  {formatAmmanDate(match.kickoffIso)} • {formatAmmanTime(match.kickoffIso)} (عمّان)
                </span>
              )}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="flex flex-col items-center text-center gap-2">
                <TeamCrest
                  name={match.homeTeam}
                  shortName={match.homeShort}
                  color={match.homeColor}
                  size="lg"
                />
                <div className="text-sm sm:text-base font-black text-white">{match.homeTeam}</div>
                <span className="text-[10px] text-slate-400">المستضيف</span>
              </div>

              <div className="text-center px-3">
                {match.status === 'upcoming' ? (
                  <div className="text-2xl font-black text-emerald-400 tracking-widest">VS</div>
                ) : (
                  <div className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-wider">
                    {match.homeScore} <span className="text-slate-500">-</span> {match.awayScore}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center text-center gap-2">
                <TeamCrest
                  name={match.awayTeam}
                  shortName={match.awayShort}
                  color={match.awayColor}
                  size="lg"
                />
                <div className="text-sm sm:text-base font-black text-white">{match.awayTeam}</div>
                <span className="text-[10px] text-slate-400">الضيف</span>
              </div>
            </div>

            {/* تفاصيل الملعب والحكم والقناة */}
            <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-center gap-1.5 bg-black/30 rounded-xl py-2 px-3">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{match.stadium}</span>
              </div>
              {match.referee && (
                <div className="flex items-center justify-center gap-1.5 bg-black/30 rounded-xl py-2 px-3">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">الحكم: {match.referee}</span>
                </div>
              )}
              {match.broadcast && (
                <div className="flex items-center justify-center gap-1.5 bg-black/30 rounded-xl py-2 px-3">
                  <Tv className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">{match.broadcast}</span>
                </div>
              )}
            </div>
          </div>

          {/* البث المباشر للمباراة (يوتيوب أو فيسبوك) إن وُجد */}
          {match.liveStreamUrl && (
            <LiveStreamPlayer
              stream={{
                id: `match-stream-${match.id}`,
                title: `بث مباشر: ${match.homeTeam} × ${match.awayTeam}`,
                subtitle: `${comp.name} • ${match.stadium}`,
                url: match.liveStreamUrl,
                platform: parseLiveStreamUrl(match.liveStreamUrl).platform,
                competitionId: match.competitionId,
                isLive: true,
                createdAt: match.kickoffIso,
              }}
            />
          )}

          {/* أحداث المباراة */}
          <section className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              أحداث وأهداف المباراة
            </div>
            {match.events.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                {match.status === 'upcoming'
                  ? 'ستظهر الأحداث والأهداف هنا لحظياً فور انطلاق صافرة البداية.'
                  : 'لم يتم تسجيل أحداث تفصيلية لهذه المباراة بعد.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {[...match.events]
                  .sort((a, b) => a.minute - b.minute)
                  .map((ev) => (
                    <div
                      key={ev.id}
                      className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 border ${
                        ev.team === 'home'
                          ? 'bg-emerald-500/8 border-emerald-500/20'
                          : 'bg-sky-500/8 border-sky-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-7 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center text-xs font-black text-emerald-300 tabular-nums shrink-0">
                          {ev.minute}&apos;
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5">
                            <span>
                              {ev.type === 'goal'
                                ? '⚽'
                                : ev.type === 'yellow_card'
                                ? '🟨'
                                : ev.type === 'red_card'
                                ? '🟥'
                                : '🔄'}
                            </span>
                            <span className="truncate">{ev.playerName}</span>
                          </div>
                          {ev.detail && (
                            <div className="text-[11px] text-slate-400 truncate">{ev.detail}</div>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-slate-300 shrink-0">
                        {ev.team === 'home' ? match.homeShort : match.awayShort}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* البطاقة الإحصائية الرقمية للمباراة */}
          {statsRows.length > 0 && (
            <section className="rounded-2xl bg-[#0E1621] border border-white/10 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                الإحصائيات الرقمية للمباراة
              </div>

              <div className="space-y-3.5">
                {statsRows.map((row) => {
                  const total = Math.max(1, row.home + row.away);
                  const homePct = Math.round((row.home / total) * 100);
                  return (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-extrabold tabular-nums">
                        <span className="text-emerald-300">
                          {row.home}
                          {row.suffix}
                        </span>
                        <span className="text-slate-400 font-bold">{row.label}</span>
                        <span className="text-sky-300">
                          {row.away}
                          {row.suffix}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-sky-500/35 overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
                          style={{ width: `${homePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* مشاركة بطاقة المباراة */}
          <section className="rounded-2xl bg-[#0E1621] border border-white/10 p-4">
            <ShareBar
              payload={{
                title: `${match.homeTeam} × ${match.awayTeam} | وتين سبورت`,
                text: shareSummary,
              }}
            />
          </section>

          <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            تتحدث النتائج والإحصائيات لحظياً فور تعديلها من لوحة تحكم وتين سبورت
          </div>
        </div>
      </div>
    </div>
  );
};
