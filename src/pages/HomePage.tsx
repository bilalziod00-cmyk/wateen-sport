import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flame,
  Search,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { COMPETITIONS, NEWS_TAG_LABELS, YOUTH_COMPETITION_IDS } from '../constants/competitions';
import { CompetitionId, MatchItem, NewsArticle, NewsCategoryTag } from '../types/sports';
import { formatRelativeAmman } from '../utils/ammanTime';
import { MatchCard } from '../components/MatchCard';
import { SportsCardItem } from '../components/SportsCardItem';
import { LiveStreamPlayer } from '../components/LiveStreamPlayer';

interface HomePageProps {
  onSelectArticle: (article: NewsArticle) => void;
  onSelectMatch: (match: MatchItem) => void;
  onOpenCompetition: (id: CompetitionId) => void;
  onJumpToResults: () => void;
}

type FeedFilter =
  | 'all'
  | 'breaking'
  | 'pro_league'
  | 'first_div'
  | 'lower_divs'
  | 'youth'
  | 'transfers'
  | 'tactical_analysis'
  | 'injuries';

export const HomePage: React.FC<HomePageProps> = ({
  onSelectArticle,
  onSelectMatch,
  onOpenCompetition,
  onJumpToResults,
}) => {
  const { data } = useAppData();
  const [bannerIndex, setBannerIndex] = useState(0);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [query, setQuery] = useState('');

  const activeBanners = useMemo(
    () => data.banners.filter((b) => b.active).sort((a, b) => a.order - b.order),
    [data.banners]
  );

  const safeBannerIdx = activeBanners.length > 0 ? bannerIndex % activeBanners.length : 0;
  const currentBanner = activeBanners[safeBannerIdx];

  const breakingArticles = useMemo(
    () => data.articles.filter((a) => a.isBreaking),
    [data.articles]
  );

  const activeLiveStreams = useMemo(
    () => (data.liveStreams || []).filter((s) => s.isLive),
    [data.liveStreams]
  );

  const featuredMatches = useMemo(() => {
    const order = { live: 0, upcoming: 1, finished: 2 };
    return [...data.matches]
      .sort((a, b) => {
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      })
      .slice(0, 6);
  }, [data.matches]);

  const filteredArticles = useMemo(() => {
    return data.articles.filter((art) => {
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hit =
          art.title.toLowerCase().includes(q) ||
          art.summary.toLowerCase().includes(q) ||
          COMPETITIONS[art.competitionId].name.toLowerCase().includes(q);
        if (!hit) return false;
      }

      switch (filter) {
        case 'breaking':
          return art.isBreaking;
        case 'pro_league':
          return art.competitionId === 'pro_league';
        case 'first_div':
          return art.competitionId === 'first_div';
        case 'lower_divs':
          return art.competitionId === 'second_div' || art.competitionId === 'third_div';
        case 'youth':
          return YOUTH_COMPETITION_IDS.includes(art.competitionId);
        case 'transfers':
        case 'tactical_analysis':
        case 'injuries':
          return art.tag === (filter as NewsCategoryTag);
        default:
          return true;
      }
    });
  }, [data.articles, filter, query]);

  const filterChips: { id: FeedFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'breaking', label: 'عاجل' },
    { id: 'pro_league', label: 'المحترفين' },
    { id: 'first_div', label: 'الأولى' },
    { id: 'lower_divs', label: 'الثانية والثالثة' },
    { id: 'youth', label: 'الفئات العمرية' },
    { id: 'transfers', label: 'الانتقالات' },
    { id: 'tactical_analysis', label: 'تحليلات رقمية' },
    { id: 'injuries', label: 'الإصابات والجاهزية' },
  ];

  return (
    <div className="space-y-6 pb-6">
      {/* شريط الأخبار العاجلة */}
      {breakingArticles.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-l from-rose-600/20 via-[#15121B] to-[#0E1621] border border-rose-500/35 p-3 shadow-glow-red">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-black shrink-0 shadow">
              <Zap className="w-3.5 h-3.5 fill-current" />
              عاجل
            </span>
            <button
              type="button"
              onClick={() => onSelectArticle(breakingArticles[0])}
              className="text-xs sm:text-sm font-extrabold text-white text-right hover:text-rose-200 transition-colors line-clamp-1 flex-1"
            >
              {breakingArticles[0].title}
            </button>
            <ChevronLeft className="w-4 h-4 text-rose-400 shrink-0" />
          </div>
          {breakingArticles.length > 1 && (
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {breakingArticles.slice(1, 4).map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => onSelectArticle(art)}
                  className="text-[11px] font-bold text-rose-200/90 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg px-2.5 py-1 whitespace-nowrap"
                >
                  • {art.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* البث المباشر الفوري داخل التطبيق (يوتيوب / فيسبوك) */}
      {activeLiveStreams.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse-live" />
              <h2 className="text-base font-black text-white">البث المباشر الآن • وتين سبورت</h2>
            </div>
            <span className="text-[11px] font-bold text-rose-300">شاهد داخل التطبيق</span>
          </div>
          <div className="space-y-3">
            {activeLiveStreams.map((stream) => (
              <LiveStreamPlayer key={stream.id} stream={stream} />
            ))}
          </div>
        </section>
      )}

      {/* سلايدر البنرات الرئيسية */}
      {currentBanner && (
        <section className="relative rounded-3xl overflow-hidden border border-white/12 shadow-2xl bg-[#0B121B]">
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (currentBanner.linkedArticleId) {
                const found = data.articles.find((a) => a.id === currentBanner.linkedArticleId);
                if (found) {
                  onSelectArticle(found);
                  return;
                }
              }
              if (currentBanner.linkedCompetitionId) {
                onOpenCompetition(currentBanner.linkedCompetitionId);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && currentBanner.linkedCompetitionId) {
                onOpenCompetition(currentBanner.linkedCompetitionId);
              }
            }}
            className="relative h-56 sm:h-64 w-full cursor-pointer group"
          >
            <img
              src={currentBanner.imageUrl || './images/stadium-night.jpg'}
              alt={currentBanner.title}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070B10] via-[#070B10]/65 to-black/15" />

            <div className="absolute top-3.5 right-3.5 left-3.5 flex items-center justify-between">
              <span
                className="px-3 py-1 rounded-full text-[11px] font-black text-white shadow-lg border border-white/20 backdrop-blur-md"
                style={{ backgroundColor: `${currentBanner.accentColor}cc` }}
              >
                {currentBanner.badge}
              </span>
              {activeBanners.length > 1 && (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label="السابق"
                    onClick={() =>
                      setBannerIndex(
                        (prev) => (prev - 1 + activeBanners.length) % activeBanners.length
                      )
                    }
                    className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/75 border border-white/15 flex items-center justify-center text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="التالي"
                    onClick={() => setBannerIndex((prev) => (prev + 1) % activeBanners.length)}
                    className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/75 border border-white/15 flex items-center justify-center text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="absolute bottom-4 right-4 left-4 space-y-1.5">
              <h2 className="text-lg sm:text-xl font-black text-white leading-snug drop-shadow">
                {currentBanner.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed">
                {currentBanner.subtitle}
              </p>
              {activeBanners.length > 1 && (
                <div className="flex items-center gap-1.5 pt-1.5">
                  {activeBanners.map((b, idx) => (
                    <span
                      key={b.id}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === safeBannerIdx ? 'w-6 bg-emerald-400' : 'w-1.5 bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* أبرز مباريات الملاعب الأردنية */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-emerald-400" />
            <h2 className="text-base font-black text-white">أبرز المباريات • بتوقيت عمّان</h2>
          </div>
          <button
            type="button"
            onClick={onJumpToResults}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5"
          >
            جدول النتائج
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {featuredMatches.map((match) => (
            <div key={match.id} className="w-[290px] shrink-0">
              <MatchCard match={match} compact onSelect={onSelectMatch} />
            </div>
          ))}
        </div>
      </section>

      {/* البطاقات والتصاميم الرياضية */}
      {data.cards.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-black text-white">البطاقات والتصاميم الرياضية</h2>
            </div>
            <span className="text-[11px] font-bold text-slate-400">جاهزة للمشاركة</span>
          </div>

          <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1">
            {data.cards.map((card) => (
              <SportsCardItem key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* آخر أخبار الكرة الأردنية مع البحث والفلترة */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-rose-500" />
            <h2 className="text-base font-black text-white">آخر أخبار الملاعب الأردنية</h2>
          </div>
          <span className="text-[11px] text-slate-400 font-bold">
            {filteredArticles.length} خبر
          </span>
        </div>

        {/* شريط البحث السريع */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن نادٍ، بطولة، صفقة انتقال، أو تحليل..."
            className="w-full rounded-2xl bg-[#0E1621] border border-white/10 focus:border-emerald-500/50 focus:outline-none py-2.5 pr-10 pl-4 text-xs sm:text-sm text-white placeholder:text-slate-500"
          />
        </div>

        {/* أزرار التصنيف */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border transition-all ${
                filter === chip.id
                  ? 'bg-emerald-500 text-pitch-950 border-emerald-400 shadow-glow'
                  : 'bg-[#0E1621] text-slate-300 border-white/8 hover:border-white/20'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* قائمة الأخبار */}
        {filteredArticles.length === 0 ? (
          <div className="rounded-2xl bg-[#0E1621] border border-white/8 p-8 text-center text-slate-400 text-sm">
            لا توجد أخبار مطابقة للبحث أو التصنيف المختار حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredArticles.map((art) => {
              const comp = COMPETITIONS[art.competitionId];
              const tag = NEWS_TAG_LABELS[art.tag];
              return (
                <article
                  key={art.id}
                  onClick={() => onSelectArticle(art)}
                  className="group cursor-pointer rounded-2xl bg-[#0E1621]/95 border border-white/8 hover:border-emerald-500/35 overflow-hidden transition-all duration-200 flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <div className="relative h-44 overflow-hidden bg-pitch-900">
                      <img
                        src={art.imageUrl || './images/stadium-night.jpg'}
                        alt={art.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0E1621] via-transparent to-black/30" />

                      <div className="absolute top-2.5 right-2.5 left-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {art.isBreaking && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black shadow">
                              <Flame className="w-3 h-3" />
                              عاجل
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border backdrop-blur-md ${comp.badgeColor}`}
                          >
                            {comp.shortName}
                          </span>
                        </div>

                        {art.statsCard && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/65 text-amber-300 border border-amber-400/30 text-[10px] font-bold">
                            <BarChart3 className="w-3 h-3" />
                            بطاقة أرقام
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-md border font-bold text-[10px] ${tag.color}`}
                        >
                          {tag.label}
                        </span>
                        <span className="text-slate-400">{formatRelativeAmman(art.publishedAt)}</span>
                      </div>

                      <h3 className="text-sm sm:text-base font-black text-white leading-snug group-hover:text-emerald-300 transition-colors line-clamp-2">
                        {art.title}
                      </h3>

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {art.summary}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 bg-pitch-950/40">
                    <span className="inline-flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-emerald-500/80" />
                      {art.author}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      {art.views.toLocaleString('ar-JO')}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
