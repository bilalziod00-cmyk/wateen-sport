import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Cloud,
  Home,
  ShieldCheck,
  Table2,
  Trophy,
} from 'lucide-react';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { CompetitionId, MatchItem, NavTab, NewsArticle } from './types/sports';
import { HomePage } from './pages/HomePage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { ResultsStandingsPage } from './pages/ResultsStandingsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ArticleDetailModal } from './pages/ArticleDetailModal';
import { MatchDetailModal } from './pages/MatchDetailModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { CinematicSplashScreen } from './components/CinematicSplashScreen';

const WateenShell: React.FC = () => {
  const {
    data,
    cloudMode,
    toast,
    unreadNotificationsCount,
    markNotificationsRead,
    isAdminUnlocked,
  } = useAppData();

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<CompetitionId | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const selectedArticle: NewsArticle | null = selectedArticleId
    ? data.articles.find((a) => a.id === selectedArticleId) || null
    : null;

  const selectedMatch: MatchItem | null = selectedMatchId
    ? data.matches.find((m) => m.id === selectedMatchId) || null
    : null;

  const liveMatchesCount = data.matches.filter((m) => m.status === 'live').length;

  const handleOpenCompetition = (id: CompetitionId) => {
    setSelectedCompetitionId(id);
    setActiveTab('competitions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems: { id: NavTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'competitions', label: 'البطولات', icon: Trophy },
    { id: 'results', label: 'النتائج والترتيب', icon: Table2, badge: liveMatchesCount },
    { id: 'admin', label: 'لوحة التحكم', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-[#070B10] text-slate-100">
      {showSplash && <CinematicSplashScreen onFinished={() => setShowSplash(false)} />}
      {/* الترويسة العلوية الثابتة بهوية وتين سبورت */}
      <header className="sticky top-0 z-30 bg-[#070B10]/90 backdrop-blur-xl border-b border-white/10 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              setSelectedCompetitionId(null);
            }}
            className="flex items-center gap-2.5 text-right"
          >
            <img
              src="./images/app-icon.png"
              alt="شعار وتين سبورت"
              className="w-11 h-11 rounded-full bg-black border-2 border-[#00FF40]/70 shadow-[0_0_14px_rgba(0,255,64,0.35)] object-contain"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black tracking-tight text-white">
                  وتين سبورت
                </span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  WATEEN SPORT
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                <Activity className="w-3 h-3 text-rose-500" />
                نبض الملاعب والكرة الأردنية
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {/* مؤشر المزامنة السحابية */}
            {cloudMode === 'firebase' && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-300">
                <Cloud className="w-3 h-3" />
                متصل لحظياً
              </span>
            )}

            {/* زر جرس الإشعارات */}
            <button
              type="button"
              aria-label="الإشعارات"
              onClick={() => {
                setNotificationsOpen(true);
                markNotificationsRead();
              }}
              className="relative w-10 h-10 rounded-xl bg-[#0E1621] hover:bg-[#142030] border border-white/10 flex items-center justify-center text-slate-200 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-5 pt-4 pb-24">
        {activeTab === 'home' && (
          <HomePage
            onSelectArticle={(art) => setSelectedArticleId(art.id)}
            onSelectMatch={(match) => setSelectedMatchId(match.id)}
            onOpenCompetition={handleOpenCompetition}
            onJumpToResults={() => setActiveTab('results')}
          />
        )}

        {activeTab === 'competitions' && (
          <CompetitionsPage
            selectedCompetitionId={selectedCompetitionId}
            onSelectCompetition={setSelectedCompetitionId}
            onSelectArticle={(art) => setSelectedArticleId(art.id)}
            onSelectMatch={(match) => setSelectedMatchId(match.id)}
          />
        )}

        {activeTab === 'results' && (
          <ResultsStandingsPage onSelectMatch={(match) => setSelectedMatchId(match.id)} />
        )}

        {activeTab === 'admin' && <AdminDashboardPage />}
      </main>

      {/* شريط التنقل السفلي السريع */}
      <nav
        aria-label="التنقل الرئيسي"
        className="fixed bottom-0 inset-x-0 z-30 bg-[#0A1019]/95 backdrop-blur-xl border-t border-white/10 safe-bottom"
      >
        <div className="max-w-4xl mx-auto px-2 py-1.5 grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'competitions') setSelectedCompetitionId(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'stroke-[2.4]' : 'stroke-[1.9]'}`} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -left-2.5 px-1 min-w-[16px] h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                  {item.id === 'admin' && isAdminUnlocked && (
                    <span className="absolute -top-1 -left-1.5 w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] font-extrabold mt-1 leading-none">
                  {item.label}
                </span>
                {active && (
                  <span className="absolute bottom-0.5 w-6 h-0.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* صفحة تفاصيل الخبر */}
      {selectedArticle && (
        <ArticleDetailModal
          article={selectedArticle}
          onClose={() => setSelectedArticleId(null)}
          onOpenMatch={(m) => {
            setSelectedArticleId(null);
            setSelectedMatchId(m.id);
          }}
        />
      )}

      {/* صفحة تفاصيل المباراة */}
      {selectedMatch && (
        <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatchId(null)} />
      )}

      {/* درج الإشعارات */}
      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      {/* شريط التنبيهات السريع Toast */}
      {toast && (
        <div className="fixed bottom-24 inset-x-4 z-[60] flex justify-center pointer-events-none">
          <div
            className={`px-4 py-2.5 rounded-2xl border text-xs sm:text-sm font-extrabold shadow-2xl backdrop-blur-xl ${
              toast.tone === 'emerald'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
                : toast.tone === 'crimson'
                ? 'bg-rose-950/95 border-rose-500/50 text-rose-200'
                : 'bg-amber-950/95 border-amber-500/50 text-amber-200'
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppDataProvider>
      <WateenShell />
    </AppDataProvider>
  );
}
