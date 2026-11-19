import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  CalendarDays,
  ChevronLeft,
  Flag,
  Globe,
  Newspaper,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import {
  ARAB_GLOBAL_COMPETITION_IDS,
  COMPETITIONS,
  NEWS_TAG_LABELS,
  YOUTH_COMPETITION_IDS,
} from '../constants/competitions';
import { CompetitionId, MatchItem, NewsArticle } from '../types/sports';
import { StandingsTable, sortStandings } from '../components/StandingsTable';
import { MatchCard } from '../components/MatchCard';
import { TeamCrest } from '../components/TeamCrest';
import { formatRelativeAmman } from '../utils/ammanTime';

interface CompetitionsPageProps {
  selectedCompetitionId: CompetitionId | null;
  onSelectCompetition: (id: CompetitionId | null) => void;
  onSelectArticle: (article: NewsArticle) => void;
  onSelectMatch: (match: MatchItem) => void;
}

type DetailTab = 'standings' | 'matches' | 'scorers' | 'news';

function formatArabicCount(count: number, singular: string, dual: string, plural: string): string {
  if (count === 0) return `لا توجد ${plural}`;
  if (count === 1) return `${singular} واحدة`;
  if (count === 2) return dual;
  if (count <= 10) return `${count} ${plural}`;
  return `${count} ${singular}`;
}

export const CompetitionsPage: React.FC<CompetitionsPageProps> = ({
  selectedCompetitionId,
  onSelectCompetition,
  onSelectArticle,
  onSelectMatch,
}) => {
  const { data } = useAppData();
  const [detailTab, setDetailTab] = useState<DetailTab>('standings');

  // يجب استدعاء جميع React Hooks قبل أي return شرطي
  const countByComp = useMemo(() => {
    const map: Record<string, { matches: number; live: number; news: number }> = {};
    for (const m of data.matches) {
      map[m.competitionId] = map[m.competitionId] || { matches: 0, live: 0, news: 0 };
      map[m.competitionId].matches += 1;
      if (
        m.status === 'live' ||
        m.status === 'first_half' ||
        m.status === 'halftime' ||
        m.status === 'second_half'
      ) {
        map[m.competitionId].live += 1;
      }
    }
    for (const a of data.articles) {
      map[a.competitionId] = map[a.competitionId] || { matches: 0, live: 0, news: 0 };
      map[a.competitionId].news += 1;
    }
    return map;
  }, [data.matches, data.articles]);

  // إذا اختار المستخدم بطولة محددة -> نعرض صفحتها الكاملة
  if (selectedCompetitionId) {
    const comp = COMPETITIONS[selectedCompetitionId];
    const isYouth = YOUTH_COMPETITION_IDS.includes(selectedCompetitionId);

    const compStandings = data.standings.filter((s) => s.competitionId === selectedCompetitionId);
    const compMatches = data.matches.filter((m) => m.competitionId === selectedCompetitionId);
    const compScorers = [...data.scorers]
      .filter((sc) => sc.competitionId === selectedCompetitionId)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists);
    const compNews = data.articles.filter((a) => a.competitionId === selectedCompetitionId);

    const sortedStandings = sortStandings(compStandings);
    const bestAttack = [...compStandings].sort((a, b) => b.goalsFor - a.goalsFor)[0];
    const bestDefense = [...compStandings].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];

    return (
      <div className="space-y-4 pb-6">
        {/* رأس صفحة البطولة */}
        <div
          className="relative rounded-3xl p-5 overflow-hidden border border-white/15 shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${comp.accentFrom}33, #0E1621 62%, #070B10 100%)`,
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <button
              type="button"
              onClick={() => onSelectCompetition(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-xs font-bold text-slate-200"
            >
              <ArrowRight className="w-4 h-4" />
              كل البطولات
            </button>
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-slate-200">
              موسم {comp.season}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white">{comp.name}</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">{comp.subtitle}</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-black/35 border border-white/10 py-2 px-2">
              <div className="text-base font-black text-white tabular-nums">{compMatches.length}</div>
              <div className="text-[10px] text-slate-400">مباريات</div>
            </div>
            <div className="rounded-xl bg-black/35 border border-white/10 py-2 px-2">
              <div className="text-base font-black text-emerald-300 tabular-nums">
                {sortedStandings[0]?.teamName || '—'}
              </div>
              <div className="text-[10px] text-slate-400">المتصدر</div>
            </div>
            <div className="rounded-xl bg-black/35 border border-white/10 py-2 px-2">
              <div className="text-base font-black text-amber-300 tabular-nums">{compNews.length}</div>
              <div className="text-[10px] text-slate-400">أخبار وتقارير</div>
            </div>
          </div>
        </div>

        {/* مبدّل سريع للفئات العمرية إذا كنا داخل الفئات */}
        {isYouth && (
          <div className="grid grid-cols-4 gap-1.5 bg-[#0E1621] p-1.5 rounded-2xl border border-white/10">
            {YOUTH_COMPETITION_IDS.map((yid) => (
              <button
                key={yid}
                type="button"
                onClick={() => onSelectCompetition(yid)}
                className={`py-2 rounded-xl text-xs font-extrabold transition-all ${
                  selectedCompetitionId === yid
                    ? 'bg-emerald-500 text-pitch-950 shadow'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                {COMPETITIONS[yid].shortName}
              </button>
            ))}
          </div>
        )}

        {/* التبويبات الأربعة داخل البطولة */}
        <div className="grid grid-cols-4 gap-1.5 bg-[#0E1621] p-1.5 rounded-2xl border border-white/10">
          {[
            { id: 'standings' as const, label: 'الترتيب', icon: Trophy },
            { id: 'matches' as const, label: 'المباريات', icon: CalendarDays },
            { id: 'scorers' as const, label: 'الهدافون', icon: Award },
            { id: 'news' as const, label: 'الأخبار', icon: Newspaper },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetailTab(t.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] sm:text-xs font-extrabold transition-all ${
                  detailTab === t.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* محتوى التبويب المختار */}
        {detailTab === 'standings' && (
          <StandingsTable rows={compStandings} title={`جدول ترتيب ${comp.name}`} />
        )}

        {detailTab === 'matches' && (
          <div className="space-y-3">
            {compMatches.length === 0 ? (
              <div className="rounded-2xl bg-[#0E1621] border border-white/8 p-8 text-center text-slate-400 text-sm">
                لا توجد مباريات مسجلة لهذه البطولة حالياً.
              </div>
            ) : (
              compMatches.map((m) => <MatchCard key={m.id} match={m} onSelect={onSelectMatch} />)
            )}
          </div>
        )}

        {detailTab === 'scorers' && (
          <div className="space-y-4">
            {/* إحصائيات هجومية ودفاعية مشتقة من الجدول */}
            {(bestAttack || bestDefense) && (
              <div className="grid grid-cols-2 gap-3">
                {bestAttack && (
                  <div className="rounded-2xl bg-[#0E1621] border border-emerald-500/25 p-3.5">
                    <div className="text-[11px] font-bold text-emerald-400">أقوى هجوم</div>
                    <div className="text-sm font-black text-white mt-1">{bestAttack.teamName}</div>
                    <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                      {bestAttack.goalsFor} هدفاً في {bestAttack.played} مباريات
                    </div>
                  </div>
                )}
                {bestDefense && (
                  <div className="rounded-2xl bg-[#0E1621] border border-sky-500/25 p-3.5">
                    <div className="text-[11px] font-bold text-sky-400">أقوى دفاع</div>
                    <div className="text-sm font-black text-white mt-1">{bestDefense.teamName}</div>
                    <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                      استقبل {bestDefense.goalsAgainst} أهداف فقط
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-[#0E1621] border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 bg-[#131E2D]/70 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white">قائمة الهدافين وصنّاع اللعب</h3>
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              {compScorers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  لم تتم إضافة الهدافين لهذه البطولة بعد — يمكنك إضافتهم من لوحة التحكم.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {compScorers.map((sc, idx) => (
                    <div
                      key={sc.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black tabular-nums ${
                            idx === 0
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                              : 'bg-white/5 text-slate-300'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <TeamCrest
                          name={sc.teamName}
                          shortName={sc.teamName.slice(0, 3)}
                          color={sc.teamColor}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-white truncate">
                            {sc.playerName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {sc.teamName} • {sc.matches} مباريات
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 tabular-nums">
                        <div className="text-center px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                          <div className="text-sm font-black text-emerald-300">{sc.goals}</div>
                          <div className="text-[9px] text-emerald-200/80">هدف</div>
                        </div>
                        <div className="text-center px-2.5 py-1 rounded-xl bg-white/5 border border-white/10">
                          <div className="text-sm font-black text-slate-200">{sc.assists}</div>
                          <div className="text-[9px] text-slate-400">أسيست</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {detailTab === 'news' && (
          <div className="space-y-3">
            {compNews.length === 0 ? (
              <div className="rounded-2xl bg-[#0E1621] border border-white/8 p-8 text-center text-slate-400 text-sm">
                لا توجد أخبار خاصة بهذه البطولة حالياً.
              </div>
            ) : (
              compNews.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => onSelectArticle(art)}
                  className="w-full text-right rounded-2xl bg-[#0E1621] border border-white/8 hover:border-emerald-500/35 p-3 flex gap-3 items-center transition-all"
                >
                  <img
                    src={art.imageUrl || './images/stadium-night.jpg'}
                    alt={art.title}
                    className="w-24 h-20 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span
                        className={`px-2 py-0.5 rounded border font-bold ${NEWS_TAG_LABELS[art.tag].color}`}
                      >
                        {NEWS_TAG_LABELS[art.tag].label}
                      </span>
                      <span className="text-slate-400">{formatRelativeAmman(art.publishedAt)}</span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-white line-clamp-2">
                      {art.title}
                    </h4>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // الشاشة الرئيسية لدليل البطولات الأردنية
  const mainTiers: { id: CompetitionId; icon: React.ElementType }[] = [
    { id: 'pro_league', icon: Trophy },
    { id: 'first_div', icon: Shield },
    { id: 'second_div', icon: Shield },
    { id: 'third_div', icon: Shield },
    { id: 'jordan_cup', icon: Award },
    { id: 'national_teams', icon: Flag },
  ];

  return (
    <div className="space-y-6 pb-6">
      <div className="rounded-3xl bg-gradient-to-l from-emerald-600/20 via-[#0E1621] to-[#0B121B] border border-emerald-500/25 p-5">
        <h1 className="text-xl font-black text-white">دليل البطولات الشاملة</h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
          تغطية كاملة لكل الدرجات الكروية الأردنية والفئات العمرية والمنتخبات الوطنية، بالإضافة إلى
          البطولات العربية والآسيوية والعالمية.
        </p>
      </div>

      {/* الدرجات الأربع + الكأس + المنتخبات */}
      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-300 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-emerald-400" />
          الدوريات والكؤوس والمنتخبات الوطنية
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mainTiers.map(({ id, icon: Icon }) => {
            const comp = COMPETITIONS[id];
            const stats = countByComp[id] || { matches: 0, live: 0, news: 0 };
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setDetailTab('standings');
                  onSelectCompetition(id);
                }}
                className="group text-right rounded-2xl bg-[#0E1621] border border-white/10 hover:border-emerald-500/40 p-4 transition-all active:scale-[0.99] relative overflow-hidden"
              >
                <div
                  className="absolute top-0 right-0 left-0 h-1"
                  style={{
                    background: `linear-gradient(to left, ${comp.accentFrom}, ${comp.accentTo})`,
                  }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border border-white/15"
                      style={{ backgroundColor: `${comp.accentFrom}25`, color: comp.accentFrom }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-white truncate">
                          {comp.name}
                        </h3>
                        {stats.live > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-black animate-pulse">
                            مباشر
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {comp.subtitle}
                      </p>
                    </div>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 shrink-0 mt-1" />
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-3 text-[11px] text-slate-400 tabular-nums">
                  <span>{formatArabicCount(stats.matches, 'مباراة', 'مباراتان', 'مباريات')}</span>
                  <span>•</span>
                  <span>
                    {stats.news === 0
                      ? 'لا توجد أخبار'
                      : stats.news === 1
                      ? 'خبر واحد'
                      : stats.news === 2
                      ? 'خبران'
                      : `${stats.news} أخبار`}
                  </span>
                  {comp.teamsCount && (
                    <>
                      <span>•</span>
                      <span>{comp.teamsCount} نادياً</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* قسم الفئات العمرية المستقل (تحت 20، تحت 17، تحت 15، الواعدين) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            الفئات العمرية (الشباب، الناشئين، الأشبال، الواعدين)
          </h2>
          <Sparkles className="w-4 h-4 text-teal-400" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {YOUTH_COMPETITION_IDS.map((yid) => {
            const comp = COMPETITIONS[yid];
            const stats = countByComp[yid] || { matches: 0, live: 0, news: 0 };
            return (
              <button
                key={yid}
                type="button"
                onClick={() => {
                  setDetailTab('standings');
                  onSelectCompetition(yid);
                }}
                className="text-right rounded-2xl bg-gradient-to-br from-[#0F1B26] to-[#0B121B] border border-teal-500/25 hover:border-teal-400/50 p-4 transition-all active:scale-[0.98]"
              >
                <span
                  className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black mb-2 border border-white/10"
                  style={{ backgroundColor: `${comp.accentFrom}25`, color: comp.accentFrom }}
                >
                  {comp.tierLabel}
                </span>
                <h3 className="text-sm font-black text-white leading-snug">{comp.name}</h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{comp.subtitle}</p>
                <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-teal-300">
                  <span>{formatArabicCount(stats.matches, 'مباراة', 'مباراتان', 'مباريات')}</span>
                  <ChevronLeft className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* البطولات العربية والآسيوية والعالمية */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-300 flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />
            البطولات العربية والآسيوية والعالمية
          </h2>
          <span className="text-[11px] font-bold text-sky-300">تغطية إقليمية ودولية</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ARAB_GLOBAL_COMPETITION_IDS.map((gid) => {
            const comp = COMPETITIONS[gid];
            const stats = countByComp[gid] || { matches: 0, live: 0, news: 0 };
            return (
              <button
                key={gid}
                type="button"
                onClick={() => {
                  setDetailTab('standings');
                  onSelectCompetition(gid);
                }}
                className="text-right rounded-2xl bg-gradient-to-br from-[#101A29] to-[#0B121B] border border-sky-500/25 hover:border-sky-400/55 p-4 transition-all active:scale-[0.98]"
              >
                <span
                  className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black mb-2 border border-white/10"
                  style={{ backgroundColor: `${comp.accentFrom}25`, color: comp.accentFrom }}
                >
                  {comp.tierLabel}
                </span>
                <h3 className="text-sm font-black text-white leading-snug">{comp.name}</h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{comp.subtitle}</p>
                <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-sky-300">
                  <span>
                    {formatArabicCount(stats.matches, 'مباراة', 'مباراتان', 'مباريات')} •{' '}
                    {stats.news} أخبار
                  </span>
                  <ChevronLeft className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
