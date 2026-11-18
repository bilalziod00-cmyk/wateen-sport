import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  AppDataState,
  AppNotification,
  CompetitionId,
  FirebaseCloudConfig,
  HeroBanner,
  LiveStreamItem,
  MatchItem,
  MatchStatus,
  NewsArticle,
  SportsGraphicCard,
  StandingRow,
  TopScorer,
} from '../types/sports';
import { INITIAL_SEED_DATA } from '../data/seedData';
import {
  getSavedFirebaseConfig,
  initFirebaseCloud,
  isFirebaseReady,
  queueCloudPushNotification,
  saveCloudState,
  saveFirebaseConfig,
  subscribeToCloudState,
  teardownFirebaseCloud,
  uploadMediaToCloud,
} from '../services/firebaseService';
import {
  initializeNativeDisplay,
  initializeNotificationsAfterSplash,
} from '../services/nativeAndroid';

const LOCAL_DATA_KEY = 'wateen_sport_data_v1';
const ADMIN_SESSION_KEY = 'wateen_admin_session_v1';
const LAST_READ_NOTIF_KEY = 'wateen_last_read_notif_v1';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'emerald' | 'crimson' | 'amber';
}

interface AppDataContextValue {
  data: AppDataState;
  cloudMode: 'local' | 'firebase';
  cloudConfig: FirebaseCloudConfig | null;
  cloudSyncStatus: 'idle' | 'syncing' | 'connected' | 'error';
  cloudError: string | null;

  // إشعارات الواجهة والـ Toast
  toast: ToastMessage | null;
  showToast: (text: string, tone?: 'emerald' | 'crimson' | 'amber') => void;
  unreadNotificationsCount: number;
  markNotificationsRead: () => void;

  // صلاحيات المالك للوحة التحكم
  isAdminUnlocked: boolean;
  unlockAdmin: (pin: string) => boolean;
  lockAdmin: () => void;
  changeAdminPin: (newPin: string) => Promise<void>;

  // إدارة الأخبار
  saveArticle: (article: NewsArticle) => Promise<void>;
  deleteArticle: (id: string) => Promise<void>;
  toggleArticleBreaking: (id: string) => Promise<void>;
  incrementArticleViews: (id: string) => void;

  // إدارة المباريات والنتائج
  saveMatch: (match: MatchItem) => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  adjustMatchScore: (id: string, side: 'home' | 'away', delta: number) => Promise<void>;
  updateMatchLiveState: (id: string, status: MatchStatus, liveMinute?: number) => Promise<void>;

  // إدارة الترتيب والهدافين
  saveStandingRow: (row: StandingRow) => Promise<void>;
  deleteStandingRow: (id: string) => Promise<void>;
  saveScorer: (scorer: TopScorer) => Promise<void>;
  deleteScorer: (id: string) => Promise<void>;

  // إدارة البنرات والبطاقات الرياضية والصور والبث المباشر
  saveBanner: (banner: HeroBanner) => Promise<void>;
  deleteBanner: (id: string) => Promise<void>;
  saveSportsCard: (card: SportsGraphicCard) => Promise<void>;
  deleteSportsCard: (id: string) => Promise<void>;
  saveLiveStream: (stream: LiveStreamItem) => Promise<void>;
  deleteLiveStream: (id: string) => Promise<void>;
  toggleLiveStreamActive: (id: string) => Promise<void>;
  saveGeminiApiKey: (apiKey: string) => Promise<void>;
  uploadImageAsset: (blob: Blob, fallbackDataUrl: string, folder?: string) => Promise<string>;

  // الإشعارات الفورية
  sendPushNotification: (payload: {
    title: string;
    body: string;
    type: AppNotification['type'];
    competitionId?: CompetitionId;
  }) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;

  // إعدادات السحابة والنسخ الاحتياطي
  connectFirebase: (config: FirebaseCloudConfig) => Promise<boolean>;
  disconnectFirebase: () => Promise<void>;
  pushCurrentDataToCloud: () => Promise<boolean>;
  exportBackupJson: () => string;
  importBackupJson: (jsonText: string) => Promise<boolean>;
  resetToDemoData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function loadInitialLocalState(): AppDataState {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppDataState;
      if (parsed && Array.isArray(parsed.articles) && Array.isArray(parsed.matches)) {
        return {
          ...INITIAL_SEED_DATA,
          ...parsed,
          liveStreams: Array.isArray(parsed.liveStreams)
            ? parsed.liveStreams
            : INITIAL_SEED_DATA.liveStreams,
          adminPin: parsed.adminPin || INITIAL_SEED_DATA.adminPin,
        };
      }
    }
  } catch {
    // fallback to seed
  }
  return INITIAL_SEED_DATA;
}

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppDataState>(() => loadInitialLocalState());
  const [cloudConfig, setCloudConfig] = useState<FirebaseCloudConfig | null>(() =>
    getSavedFirebaseConfig()
  );
  const [cloudMode, setCloudMode] = useState<'local' | 'firebase'>('local');
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'connected' | 'error'>(
    'idle'
  );
  const [cloudError, setCloudError] = useState<string | null>(null);

  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'unlocked';
    } catch {
      return false;
    }
  });

  const [lastReadNotifAt, setLastReadNotifAt] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_READ_NOTIF_KEY) || '';
    } catch {
      return '';
    }
  });

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const showToast = useCallback((text: string, tone: 'emerald' | 'crimson' | 'amber' = 'emerald') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), text, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // حفظ محلي + مزامنة فورية مع Firebase Firestore إن كان متصلاً
  const commitState = useCallback(
    async (updater: (prev: AppDataState) => AppDataState) => {
      let nextState!: AppDataState;
      setData((prev) => {
        nextState = {
          ...updater(prev),
          updatedAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(nextState));
        } catch {
          // quota warning ignored safely
        }
        return nextState;
      });

      if (isFirebaseReady()) {
        setCloudSyncStatus('syncing');
        const saved = await saveCloudState(nextState);
        setCloudSyncStatus(saved ? 'connected' : 'error');
        if (!saved) {
          setCloudError('تعذر الحفظ السحابي، تم الحفظ محلياً مؤقتاً.');
        } else {
          setCloudError(null);
        }
      }
    },
    []
  );

  // ربط Firebase تلقائياً عند التشغيل إن كانت الإعدادات موجودة
  const activateFirebase = useCallback(
    async (config: FirebaseCloudConfig, notify = false): Promise<boolean> => {
      setCloudSyncStatus('syncing');
      const res = await initFirebaseCloud(config);
      if (!res.ok) {
        setCloudMode('local');
        setCloudSyncStatus('error');
        setCloudError(res.error || 'فشل الاتصال السحابي');
        if (notify) showToast('تعذر الاتصال بـ Firebase — تحقق من الإعدادات', 'crimson');
        return false;
      }

      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      unsubRef.current = subscribeToCloudState(
        (remoteState) => {
          setData(remoteState);
          try {
            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(remoteState));
          } catch {
            // ignore
          }
          setCloudSyncStatus('connected');
          setCloudError(null);
        },
        (err) => {
          setCloudSyncStatus('error');
          setCloudError(err);
        }
      );

      setCloudConfig(config);
      setCloudMode('firebase');
      setCloudSyncStatus('connected');
      setCloudError(null);
      if (notify) showToast('تم الربط السحابي مع Firebase بنجاح — التحديثات فورية الآن', 'emerald');
      return true;
    },
    [showToast]
  );

  useEffect(() => {
    // تهيئة العرض فقط أثناء شاشة الافتتاح دون طلب الإشعارات قبل اكتمال التهيئة
    initializeNativeDisplay();

    const saved = getSavedFirebaseConfig();
    if (saved) {
      activateFirebase(saved, false);
    }

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [activateFirebase]);

  // تفعيل الإشعارات بهدوء بعد انتهاء شاشة الافتتاح والانتقال للصفحة الرئيسية
  useEffect(() => {
    const timer = window.setTimeout(() => {
      initializeNotificationsAfterSplash((title, body) => {
        showToast(`${title}: ${body}`, 'amber');
      });
    }, 2350);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  const unreadNotificationsCount = data.notifications.filter(
    (n) => !lastReadNotifAt || new Date(n.createdAt).getTime() > new Date(lastReadNotifAt).getTime()
  ).length;

  const markNotificationsRead = useCallback(() => {
    const nowIso = new Date().toISOString();
    setLastReadNotifAt(nowIso);
    try {
      localStorage.setItem(LAST_READ_NOTIF_KEY, nowIso);
    } catch {
      // ignore
    }
  }, []);

  // إدارة صلاحية المالك
  const unlockAdmin = useCallback(
    (pin: string) => {
      if (pin.trim() === data.adminPin.trim()) {
        setIsAdminUnlocked(true);
        try {
          sessionStorage.setItem(ADMIN_SESSION_KEY, 'unlocked');
        } catch {
          // ignore
        }
        showToast('أهلاً بك في لوحة تحكم وتين سبورت', 'emerald');
        return true;
      }
      showToast('رمز الدخول غير صحيح', 'crimson');
      return false;
    },
    [data.adminPin, showToast]
  );

  const lockAdmin = useCallback(() => {
    setIsAdminUnlocked(false);
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
    showToast('تم قفل لوحة التحكم بنجاح', 'amber');
  }, [showToast]);

  const changeAdminPin = useCallback(
    async (newPin: string) => {
      await commitState((prev) => ({ ...prev, adminPin: newPin.trim() }));
      showToast('تم تحديث رمز الدخول السري بنجاح', 'emerald');
    },
    [commitState, showToast]
  );

  // الأخبار
  const saveArticle = useCallback(
    async (article: NewsArticle) => {
      await commitState((prev) => {
        const exists = prev.articles.some((a) => a.id === article.id);
        const articles = exists
          ? prev.articles.map((a) => (a.id === article.id ? article : a))
          : [article, ...prev.articles];
        return { ...prev, articles };
      });
      showToast('تم حفظ ونشر الخبر فوراً', 'emerald');
    },
    [commitState, showToast]
  );

  const deleteArticle = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        articles: prev.articles.filter((a) => a.id !== id),
      }));
      showToast('تم حذف الخبر بنجاح', 'amber');
    },
    [commitState, showToast]
  );

  const toggleArticleBreaking = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        articles: prev.articles.map((a) => (a.id === id ? { ...a, isBreaking: !a.isBreaking } : a)),
      }));
      showToast('تم تحديث حالة الخبر العاجل', 'emerald');
    },
    [commitState, showToast]
  );

  const incrementArticleViews = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        articles: prev.articles.map((a) => (a.id === id ? { ...a, views: a.views + 1 } : a)),
      };
      try {
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // المباريات
  const saveMatch = useCallback(
    async (match: MatchItem) => {
      await commitState((prev) => {
        const exists = prev.matches.some((m) => m.id === match.id);
        const matches = exists
          ? prev.matches.map((m) => (m.id === match.id ? match : m))
          : [match, ...prev.matches];
        return { ...prev, matches };
      });
      showToast('تم حفظ بيانات المباراة بنجاح', 'emerald');
    },
    [commitState, showToast]
  );

  const deleteMatch = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        matches: prev.matches.filter((m) => m.id !== id),
      }));
      showToast('تم حذف المباراة', 'amber');
    },
    [commitState, showToast]
  );

  const adjustMatchScore = useCallback(
    async (id: string, side: 'home' | 'away', delta: number) => {
      await commitState((prev) => ({
        ...prev,
        matches: prev.matches.map((m) => {
          if (m.id !== id) return m;
          return side === 'home'
            ? { ...m, homeScore: Math.max(0, m.homeScore + delta) }
            : { ...m, awayScore: Math.max(0, m.awayScore + delta) };
        }),
      }));
    },
    [commitState]
  );

  const updateMatchLiveState = useCallback(
    async (id: string, status: MatchStatus, liveMinute?: number) => {
      await commitState((prev) => ({
        ...prev,
        matches: prev.matches.map((m) =>
          m.id === id
            ? { ...m, status, liveMinute: status === 'live' ? liveMinute ?? m.liveMinute ?? 1 : undefined }
            : m
        ),
      }));
      showToast('تم تحديث حالة المباراة فوراً', 'emerald');
    },
    [commitState, showToast]
  );

  // جداول الترتيب
  const saveStandingRow = useCallback(
    async (row: StandingRow) => {
      await commitState((prev) => {
        const exists = prev.standings.some((s) => s.id === row.id);
        const standings = exists
          ? prev.standings.map((s) => (s.id === row.id ? row : s))
          : [...prev.standings, row];
        return { ...prev, standings };
      });
      showToast('تم تحديث جدول الترتيب بنجاح', 'emerald');
    },
    [commitState, showToast]
  );

  const deleteStandingRow = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        standings: prev.standings.filter((s) => s.id !== id),
      }));
      showToast('تم حذف الفريق من الجدول', 'amber');
    },
    [commitState, showToast]
  );

  // الهدافون
  const saveScorer = useCallback(
    async (scorer: TopScorer) => {
      await commitState((prev) => {
        const exists = prev.scorers.some((s) => s.id === scorer.id);
        const scorers = exists
          ? prev.scorers.map((s) => (s.id === scorer.id ? scorer : s))
          : [...prev.scorers, scorer];
        return { ...prev, scorers };
      });
      showToast('تم حفظ بيانات الهداف بنجاح', 'emerald');
    },
    [commitState, showToast]
  );

  const deleteScorer = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        scorers: prev.scorers.filter((s) => s.id !== id),
      }));
      showToast('تم حذف اللاعب من قائمة الهدافين', 'amber');
    },
    [commitState, showToast]
  );

  // البنرات والبطاقات والصور
  const saveBanner = useCallback(
    async (banner: HeroBanner) => {
      await commitState((prev) => {
        const exists = prev.banners.some((b) => b.id === banner.id);
        const banners = exists
          ? prev.banners.map((b) => (b.id === banner.id ? banner : b))
          : [banner, ...prev.banners];
        return { ...prev, banners };
      });
      showToast('تم حفظ البنر الرئيسي بنجاح', 'emerald');
    },
    [commitState, showToast]
  );

  const deleteBanner = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        banners: prev.banners.filter((b) => b.id !== id),
      }));
      showToast('تم حذف البنر', 'amber');
    },
    [commitState, showToast]
  );

  const saveSportsCard = useCallback(
    async (card: SportsGraphicCard) => {
      await commitState((prev) => {
        const exists = prev.cards.some((c) => c.id === card.id);
        const cards = exists
          ? prev.cards.map((c) => (c.id === card.id ? card : c))
          : [card, ...prev.cards];
        return { ...prev, cards };
      });
      showToast('تم حفظ البطاقة الرياضية بنجاح', 'emerald');
    },
    [commitState, showToast]
  );

  const deleteSportsCard = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        cards: prev.cards.filter((c) => c.id !== id),
      }));
      showToast('تم حذف البطاقة الرياضية', 'amber');
    },
    [commitState, showToast]
  );

  // إدارة البث المباشر (يوتيوب وفيسبوك)
  const saveLiveStream = useCallback(
    async (stream: LiveStreamItem) => {
      await commitState((prev) => {
        const list = prev.liveStreams || [];
        const exists = list.some((s) => s.id === stream.id);
        const liveStreams = exists
          ? list.map((s) => (s.id === stream.id ? stream : s))
          : [stream, ...list];
        return { ...prev, liveStreams };
      });
      showToast(stream.isLive ? 'تم تشغيل البث المباشر للجميع فوراً' : 'تم حفظ رابط البث بنجاح', 'emerald');
    },
    [commitState, showToast]
  );

  const deleteLiveStream = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        liveStreams: (prev.liveStreams || []).filter((s) => s.id !== id),
      }));
      showToast('تم حذف البث المباشر', 'amber');
    },
    [commitState, showToast]
  );

  const toggleLiveStreamActive = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        liveStreams: (prev.liveStreams || []).map((s) =>
          s.id === id ? { ...s, isLive: !s.isLive } : s
        ),
      }));
      showToast('تم تحديث حالة البث المباشر', 'emerald');
    },
    [commitState, showToast]
  );

  const saveGeminiApiKey = useCallback(
    async (apiKey: string) => {
      await commitState((prev) => ({ ...prev, geminiApiKey: apiKey.trim() }));
      showToast(
        apiKey.trim() ? 'تم حفظ مفتاح الذكاء الاصطناعي Gemini بنجاح' : 'تم تفعيل المحرر الذكي المدمج',
        'emerald'
      );
    },
    [commitState, showToast]
  );

  const uploadImageAsset = useCallback(
    async (blob: Blob, fallbackDataUrl: string, folder = 'uploads'): Promise<string> => {
      if (isFirebaseReady()) {
        const cloudUrl = await uploadMediaToCloud(blob, folder);
        if (cloudUrl) return cloudUrl;
      }
      return fallbackDataUrl;
    },
    []
  );

  // الإشعارات الفورية
  const sendPushNotification = useCallback(
    async (payload: {
      title: string;
      body: string;
      type: AppNotification['type'];
      competitionId?: CompetitionId;
    }) => {
      const notif: AppNotification = {
        id: `not-${Date.now()}`,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        competitionId: payload.competitionId,
        createdAt: new Date().toISOString(),
        sentViaCloud: isFirebaseReady(),
      };

      await commitState((prev) => ({
        ...prev,
        notifications: [notif, ...prev.notifications].slice(0, 40),
      }));

      if (isFirebaseReady()) {
        await queueCloudPushNotification(notif);
        showToast('تم بث الإشعار الفوري عبر السحابة لجميع الأجهزة', 'emerald');
      } else {
        showToast('تم نشر الإشعار داخل التطبيق (فعّل Firebase لبثه عبر FCM)', 'amber');
      }
    },
    [commitState, showToast]
  );

  const deleteNotification = useCallback(
    async (id: string) => {
      await commitState((prev) => ({
        ...prev,
        notifications: prev.notifications.filter((n) => n.id !== id),
      }));
      showToast('تم حذف الإشعار من السجل', 'amber');
    },
    [commitState, showToast]
  );

  // السحابة والنسخ الاحتياطي
  const connectFirebase = useCallback(
    async (config: FirebaseCloudConfig) => {
      saveFirebaseConfig(config);
      return await activateFirebase(config, true);
    },
    [activateFirebase]
  );

  const disconnectFirebase = useCallback(async () => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    await teardownFirebaseCloud();
    saveFirebaseConfig(null);
    setCloudConfig(null);
    setCloudMode('local');
    setCloudSyncStatus('idle');
    setCloudError(null);
    showToast('تم التحويل إلى الوضع المحلي', 'amber');
  }, [showToast]);

  const pushCurrentDataToCloud = useCallback(async () => {
    if (!isFirebaseReady()) {
      showToast('قم بربط إعدادات Firebase أولاً', 'crimson');
      return false;
    }
    setCloudSyncStatus('syncing');
    const ok = await saveCloudState(data);
    setCloudSyncStatus(ok ? 'connected' : 'error');
    showToast(
      ok ? 'تم رفع ومزامنة جميع البيانات للسحابة بنجاح' : 'فشل الرفع للسحابة — تحقق من قواعد Firestore',
      ok ? 'emerald' : 'crimson'
    );
    return ok;
  }, [data, showToast]);

  const exportBackupJson = useCallback(() => JSON.stringify(data, null, 2), [data]);

  const importBackupJson = useCallback(
    async (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText) as AppDataState;
        if (!Array.isArray(parsed.articles) || !Array.isArray(parsed.matches)) {
          showToast('ملف النسخة الاحتياطية غير صالح', 'crimson');
          return false;
        }
        await commitState(() => ({ ...INITIAL_SEED_DATA, ...parsed }));
        showToast('تم استعادة النسخة الاحتياطية بنجاح', 'emerald');
        return true;
      } catch {
        showToast('صيغة JSON غير صحيحة', 'crimson');
        return false;
      }
    },
    [commitState, showToast]
  );

  const resetToDemoData = useCallback(async () => {
    await commitState((prev) => ({
      ...INITIAL_SEED_DATA,
      adminPin: prev.adminPin,
    }));
    showToast('تمت استعادة البيانات الرياضية الأردنية الافتراضية', 'amber');
  }, [commitState, showToast]);

  return (
    <AppDataContext.Provider
      value={{
        data,
        cloudMode,
        cloudConfig,
        cloudSyncStatus,
        cloudError,
        toast,
        showToast,
        unreadNotificationsCount,
        markNotificationsRead,
        isAdminUnlocked,
        unlockAdmin,
        lockAdmin,
        changeAdminPin,
        saveArticle,
        deleteArticle,
        toggleArticleBreaking,
        incrementArticleViews,
        saveMatch,
        deleteMatch,
        adjustMatchScore,
        updateMatchLiveState,
        saveStandingRow,
        deleteStandingRow,
        saveScorer,
        deleteScorer,
        saveBanner,
        deleteBanner,
        saveSportsCard,
        deleteSportsCard,
        saveLiveStream,
        deleteLiveStream,
        toggleLiveStreamActive,
        saveGeminiApiKey,
        uploadImageAsset,
        sendPushNotification,
        deleteNotification,
        connectFirebase,
        disconnectFirebase,
        pushCurrentDataToCloud,
        exportBackupJson,
        importBackupJson,
        resetToDemoData,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
