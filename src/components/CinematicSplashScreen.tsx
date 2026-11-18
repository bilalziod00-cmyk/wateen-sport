import React, { useEffect, useState } from 'react';

interface CinematicSplashScreenProps {
  onFinished: () => void;
}

export const CinematicSplashScreen: React.FC<CinematicSplashScreenProps> = ({ onFinished }) => {
  const [progress, setProgress] = useState(12);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const duration = 1850; // مدة قصيرة ومناسبة للتهيئة قبل الانتقال التلقائي للرئيسية

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round(12 + (elapsed / duration) * 88));
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(interval);
      }
    }, 45);

    const fadeTimer = window.setTimeout(() => {
      setFadingOut(true);
    }, duration);

    const doneTimer = window.setTimeout(() => {
      onFinished();
    }, duration + 320);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onFinished]);

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black text-white select-none overflow-hidden transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* خلفية ملعب كرة القدم الليلي وإضاءة الملاعب */}
      <div className="absolute inset-0">
        <img
          src="./branding/splash_background.png"
          alt="خلفية ملعب وتين سبورت"
          className="w-full h-full object-cover object-center opacity-40 blur-[2px] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/35 to-black/95" />
      </div>

      {/* التصميم الرئيسي لشاشة الافتتاح في المنتصف */}
      <div className="relative z-10 flex-1 w-full max-w-md mx-auto flex flex-col items-center justify-center px-4 pt-4">
        <div className="relative w-full aspect-square max-h-[68dvh] rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,255,64,0.22)] border border-[#00FF40]/25 bg-black">
          <img
            src="./branding/splash_artwork.png"
            alt="وتين سبورت - WATEEN SPORT"
            className="w-full h-full object-contain"
          />
          {/* لمعة إضاءة سينمائية خفيفة */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* الهوية النصية المعتمدة لتعزيز الوضوح على جميع الشاشات */}
        <div className="sr-only">
          <h1>وتين سبورت - WATEEN SPORT</h1>
          <p>نبض الملاعب والكرة الأردنية</p>
        </div>
      </div>

      {/* حركة التحميل الاحترافية في أسفل الشاشة */}
      <div className="relative z-20 w-full max-w-xs mx-auto px-6 pb-9 pt-2 flex flex-col items-center gap-2.5 safe-bottom">
        {/* شريط التحميل الفسفوري المتحرك */}
        <div className="w-full h-3.5 rounded-full bg-black/90 border border-white/70 p-0.5 shadow-[0_0_20px_rgba(0,255,64,0.35)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00b82e] via-[#00ff40] to-[#6eff8f] shadow-[0_0_14px_#00ff40] transition-all duration-75 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* نص وحركة التحميل */}
        <div className="flex items-center justify-center gap-2.5 text-xs sm:text-sm font-extrabold text-white tracking-wide">
          <span>جارٍ تحميل التطبيق ...</span>
          <span className="inline-block w-4 h-4 rounded-full border-2 border-dotted border-white/90 border-t-[#00ff40] animate-spin" />
        </div>
      </div>
    </div>
  );
};
