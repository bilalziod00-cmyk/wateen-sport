import React, { useEffect } from 'react';
import { ArrowRight, BarChart3, Clock, Eye, Flame, Radio, User } from 'lucide-react';
import { MatchItem, NewsArticle } from '../types/sports';
import { COMPETITIONS, NEWS_TAG_LABELS } from '../constants/competitions';
import { formatAmmanDateTime } from '../utils/ammanTime';
import { ShareBar } from '../components/ShareSheet';
import { useAppData } from '../context/AppDataContext';

interface ArticleDetailModalProps {
  article: NewsArticle;
  onClose: () => void;
  onOpenMatch?: (match: MatchItem) => void;
}

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  article,
  onClose,
  onOpenMatch,
}) => {
  const { data, incrementArticleViews } = useAppData();

  useEffect(() => {
    incrementArticleViews(article.id);
  }, [article.id, incrementArticleViews]);

  const comp = COMPETITIONS[article.competitionId];
  const tag = NEWS_TAG_LABELS[article.tag];
  const relatedMatch = article.relatedMatchId
    ? data.matches.find((m) => m.id === article.relatedMatchId)
    : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-[#070B10] overflow-y-auto">
      <div className="max-w-3xl mx-auto min-h-full flex flex-col">
        {/* شريط علوي ثابت */}
        <header className="sticky top-0 z-20 px-4 py-3 bg-[#070B10]/90 backdrop-blur-lg border-b border-white/10 flex items-center justify-between gap-2 safe-top">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/15 text-xs font-extrabold text-white"
          >
            <ArrowRight className="w-4 h-4" />
            رجوع
          </button>
          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${comp.badgeColor}`}>
            {comp.name}
          </span>
        </header>

        {/* الصورة الرئيسية */}
        <div className="relative h-60 sm:h-72 bg-pitch-900">
          <img
            src={article.imageUrl || './images/stadium-night.jpg'}
            alt={article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B10] via-[#070B10]/30 to-transparent" />
          <div className="absolute bottom-3 right-4 left-4 flex items-center gap-2 flex-wrap">
            {article.isBreaking && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-black shadow">
                <Flame className="w-3.5 h-3.5" />
                خبر عاجل
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-lg border text-xs font-extrabold ${tag.color}`}>
              {tag.label}
            </span>
          </div>
        </div>

        {/* نص الخبر */}
        <div className="px-4 sm:px-6 py-5 space-y-5 flex-1">
          <h1 className="text-xl sm:text-2xl font-black text-white leading-snug">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 border-y border-white/8 py-3">
            <span className="inline-flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              {article.author}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              {formatAmmanDateTime(article.publishedAt)} (توقيت عمّان)
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              {article.views.toLocaleString('ar-JO')} مشاهدة
            </span>
          </div>

          <p className="text-sm sm:text-base font-bold text-emerald-100/95 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 leading-relaxed">
            {article.summary}
          </p>

          <div className="space-y-4 text-sm sm:text-base text-slate-200 leading-8 whitespace-pre-line">
            {article.content}
          </div>

          {/* البطاقة الإحصائية المرفقة بالخبر إن وجدت */}
          {article.statsCard && article.statsCard.items.length > 0 && (
            <div className="rounded-3xl bg-gradient-to-br from-[#12202D] via-[#0E1621] to-[#080D14] border border-emerald-500/30 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-400">
                    <BarChart3 className="w-4 h-4" />
                    بطاقة وتين الإحصائية
                  </div>
                  <h3 className="text-base font-black text-white mt-0.5">
                    {article.statsCard.title}
                  </h3>
                  {article.statsCard.subtitle && (
                    <p className="text-xs text-slate-400">{article.statsCard.subtitle}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {article.statsCard.items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl p-3.5 border ${
                      item.highlight
                        ? 'bg-emerald-500/15 border-emerald-400/35'
                        : 'bg-black/30 border-white/8'
                    }`}
                  >
                    <div className="text-[11px] text-slate-400">{item.label}</div>
                    <div
                      className={`text-base font-black mt-1 tabular-nums ${
                        item.highlight ? 'text-emerald-300' : 'text-white'
                      }`}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ربط بمباراة ذات صلة إن وجدت */}
          {relatedMatch && onOpenMatch && (
            <button
              type="button"
              onClick={() => onOpenMatch(relatedMatch)}
              className="w-full rounded-2xl bg-[#0E1621] border border-emerald-500/30 hover:border-emerald-400 p-4 flex items-center justify-between gap-3 transition-all"
            >
              <div className="text-right">
                <div className="text-[11px] font-bold text-emerald-400 inline-flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5" />
                  المباراة المرتبطة بالخبر
                </div>
                <div className="text-sm font-black text-white mt-1">
                  {relatedMatch.homeTeam} ({relatedMatch.homeScore} - {relatedMatch.awayScore}){' '}
                  {relatedMatch.awayTeam}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{relatedMatch.stadium}</div>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-extrabold shrink-0">
                صفحة المباراة
              </span>
            </button>
          )}

          {/* شريط المشاركة السريعة */}
          <div className="rounded-2xl bg-[#0E1621] border border-white/10 p-4">
            <ShareBar
              payload={{
                title: article.title,
                text: article.summary,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
