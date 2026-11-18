import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  AppDataState,
  AppNotification,
  CompetitionId,
  CompetitionRuleConfig,
  FirebaseCloudConfig,
  GoalkeeperStat,
  HeroBanner,
  ImportRevisionEntry,
  LiveStreamItem,
  MatchItem,
  MatchStatus,
  NewsArticle,
  SmartImportBatch,
  SportsGraphicCard,
  StandingRow,
  TeamDirectoryItem,
  TopScorer,
} from '../types/sports';
import { INITIAL_SEED_DATA } from '../data/seedData';
import {
  getDefaultCompetitionRules,
  INITIAL_JORDAN_TEAMS_DIRECTORY,
} from '../constants/competitions';
import {
  applyApprovedMatchResultToStandings,
  isDuplicateMatchItem,
  normalizeArabicTeamName,
  recalculateStandingsForCompetition,
  sortStandingsByCompetitionRules,
  UNCLEAR_VALUE_MARKER,
} from '../utils/sportsMathEngine';
import { validateExtractedImportRows } from '../utils/aiSmartImportEngine';
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

  // إدارة الترتيب والهدافين والحراس وقواعد البطولات
  saveStandingRow: (row: StandingRow) => Promise<void>;
  deleteStandingRow: (id: string) => Promise<void>;
  saveScorer: (scorer: TopScorer) => Promise<void>;
  deleteScorer: (id: string) => Promise<void>;
  saveGoalkeeper: (gk: GoalkeeperStat) => Promise<void>;
  deleteGoalkeeper: (id: string) => Promise<void>;
  saveCompetitionRule: (rule: CompetitionRuleConfig) => Promise<void>;
  recalculateCompetitionStandings: (competitionId: CompetitionId) => Promise<void>;
  registerNewTeam: (team: {
    name: string;
    shortName?: string;
    color?: string;
    competitionId: CompetitionId;
    city?: string;
  }) => Promise<TeamDirectoryItem>;
  linkAliasToExistingTeam: (aliasName: string, targetCanonicalName: string) => Promise<void>;

  // مركز الإدخال الذكي (AI Sports Data Import) والمراجعة والاعتماد
  saveImportBatch: (batch: SmartImportBatch) => Promise<void>;
  approveAndPublishImportBatch: (batchId: string, actorName?: string) => Promise<boolean>;
  rejectImportBatch: (batchId: string, reason: string, actorName?: string) => Promise<void>;
  deleteImportBatch: (batchId: string) => Promise<void>;

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
          goalkeepers: Array.isArray(parsed.goalkeepers)
            ? parsed.goalkeepers
            : INITIAL_SEED_DATA.goalkeepers,
          teamsDirectory: Array.isArray(parsed.teamsDirectory)
            ? parsed.teamsDirectory
            : INITIAL_JORDAN_TEAMS_DIRECTORY,
          competitionRules: parsed.competitionRules
            ? { ...getDefaultCompetitionRules(), ...parsed.competitionRules }
            : getDefaultCompetitionRules(),
          importBatches: Array.isArray(parsed.importBatches) ? parsed.importBatches : [],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
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

  // المباريات (مع منع التكرار وتحديث جدول الترتيب تلقائياً عند اعتماد أو تعديل نتيجة مباراة)
  const saveMatch = useCallback(
    async (match: MatchItem) => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب تسجيل الدخول إلى لوحة الإدارة أولاً', 'crimson');
        return;
      }

      let blockedByDuplicate = false;
      await commitState((prev) => {
        const previousMatch = prev.matches.find((m) => m.id === match.id) || null;
        if (!previousMatch) {
          const dup = isDuplicateMatchItem(match, prev.matches);
          if (dup) {
            blockedByDuplicate = true;
            return prev;
          }
        }

        const approvedMatch: MatchItem = { ...match, isApproved: true };
        const exists = prev.matches.some((m) => m.id === approvedMatch.id);
        const matches = exists
          ? prev.matches.map((m) => (m.id === approvedMatch.id ? approvedMatch : m))
          : [approvedMatch, ...prev.matches];

        const rule = prev.competitionRules?.[approvedMatch.competitionId];
        const directory = prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY;
        const standings =
          approvedMatch.status === 'finished' || previousMatch?.status === 'finished'
            ? applyApprovedMatchResultToStandings(
                approvedMatch,
                previousMatch,
                prev.standings,
                matches,
                rule,
                directory
              )
            : prev.standings;

        const auditEntry: ImportRevisionEntry = {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'مدير النظام',
          action: previousMatch ? 'UPDATE_MATCH_RESULT' : 'CREATE_MATCH',
          details: `${previousMatch ? 'تعديل' : 'إضافة'} مباراة: ${approvedMatch.homeTeam} (${approvedMatch.homeScore}) - (${approvedMatch.awayScore}) ${approvedMatch.awayTeam} [${approvedMatch.round}]`,
        };

        return {
          ...prev,
          matches,
          standings,
          auditLogs: [auditEntry, ...(prev.auditLogs || [])].slice(0, 100),
        };
      });

      if (blockedByDuplicate) {
        showToast('تنبيه: هذه المباراة مسجلة مسبقاً في نفس البطولة والجولة!', 'crimson');
      } else {
        showToast('تم حفظ المباراة وتحديث جدول الترتيب تلقائياً', 'emerald');
      }
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const deleteMatch = useCallback(
    async (id: string) => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return;
      }
      await commitState((prev) => {
        const target = prev.matches.find((m) => m.id === id) || null;
        const matches = prev.matches.filter((m) => m.id !== id);
        let standings = prev.standings;
        if (target && target.status === 'finished') {
          standings = applyApprovedMatchResultToStandings(
            { ...target, status: 'upcoming' },
            target,
            prev.standings,
            matches,
            prev.competitionRules?.[target.competitionId],
            prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY
          );
        }
        return { ...prev, matches, standings };
      });
      showToast('تم حذف المباراة وتحديث الترتيب', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const adjustMatchScore = useCallback(
    async (id: string, side: 'home' | 'away', delta: number) => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return;
      }
      await commitState((prev) => {
        const previousMatch = prev.matches.find((m) => m.id === id) || null;
        if (!previousMatch) return prev;
        const updatedMatch: MatchItem =
          side === 'home'
            ? { ...previousMatch, homeScore: Math.max(0, previousMatch.homeScore + delta) }
            : { ...previousMatch, awayScore: Math.max(0, previousMatch.awayScore + delta) };

        const matches = prev.matches.map((m) => (m.id === id ? updatedMatch : m));
        const standings =
          updatedMatch.status === 'finished'
            ? applyApprovedMatchResultToStandings(
                updatedMatch,
                previousMatch,
                prev.standings,
                matches,
                prev.competitionRules?.[updatedMatch.competitionId],
                prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY
              )
            : prev.standings;
        return { ...prev, matches, standings };
      });
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const updateMatchLiveState = useCallback(
    async (id: string, status: MatchStatus, liveMinute?: number) => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return;
      }
      await commitState((prev) => {
        const previousMatch = prev.matches.find((m) => m.id === id) || null;
        if (!previousMatch) return prev;
        const updatedMatch: MatchItem = {
          ...previousMatch,
          status,
          liveMinute: status === 'live' ? liveMinute ?? previousMatch.liveMinute ?? 1 : undefined,
        };
        const matches = prev.matches.map((m) => (m.id === id ? updatedMatch : m));
        const standings =
          status === 'finished' || previousMatch.status === 'finished'
            ? applyApprovedMatchResultToStandings(
                updatedMatch,
                previousMatch,
                prev.standings,
                matches,
                prev.competitionRules?.[updatedMatch.competitionId],
                prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY
              )
            : prev.standings;
        return { ...prev, matches, standings };
      });
      showToast('تم تحديث حالة المباراة والترتيب فوراً', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  // جداول الترتيب
  const saveStandingRow = useCallback(
    async (row: StandingRow) => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return;
      }
      await commitState((prev) => {
        const exists = prev.standings.some((s) => s.id === row.id);
        const rawStandings = exists
          ? prev.standings.map((s) => (s.id === row.id ? row : s))
          : [...prev.standings, row];

        const compRows = rawStandings.filter((s) => s.competitionId === row.competitionId);
        const otherRows = rawStandings.filter((s) => s.competitionId !== row.competitionId);
        const sortedComp = sortStandingsByCompetitionRules(
          compRows,
          prev.matches.filter((m) => m.competitionId === row.competitionId && m.status === 'finished'),
          prev.competitionRules?.[row.competitionId]
        );
        return { ...prev, standings: [...otherRows, ...sortedComp] };
      });
      showToast('تم تحديث وإعادة ترتيب الجدول بنجاح', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const deleteStandingRow = useCallback(
    async (id: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        standings: prev.standings.filter((s) => s.id !== id),
      }));
      showToast('تم حذف الفريق من الجدول', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  // الهدافون والحراس وقواعد البطولات
  const saveScorer = useCallback(
    async (scorer: TopScorer) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => {
        const exists = prev.scorers.some((s) => s.id === scorer.id);
        const scorers = exists
          ? prev.scorers.map((s) => (s.id === scorer.id ? scorer : s))
          : [...prev.scorers, scorer];
        return { ...prev, scorers };
      });
      showToast('تم حفظ بيانات الهداف بنجاح', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const deleteScorer = useCallback(
    async (id: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        scorers: prev.scorers.filter((s) => s.id !== id),
      }));
      showToast('تم حذف اللاعب من قائمة الهدافين', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const saveGoalkeeper = useCallback(
    async (gk: GoalkeeperStat) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => {
        const list = prev.goalkeepers || [];
        const exists = list.some((g) => g.id === gk.id);
        const goalkeepers = exists
          ? list.map((g) => (g.id === gk.id ? gk : g))
          : [...list, gk];
        return { ...prev, goalkeepers };
      });
      showToast('تم حفظ إحصائيات حارس المرمى بنجاح', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const deleteGoalkeeper = useCallback(
    async (id: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        goalkeepers: (prev.goalkeepers || []).filter((g) => g.id !== id),
      }));
      showToast('تم حذف حارس المرمى من القائمة', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const saveCompetitionRule = useCallback(
    async (rule: CompetitionRuleConfig) => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return;
      }
      await commitState((prev) => {
        const rules = {
          ...(prev.competitionRules || getDefaultCompetitionRules()),
          [rule.competitionId]: { ...rule, updatedAt: new Date().toISOString() },
        };
        const compRows = prev.standings.filter((s) => s.competitionId === rule.competitionId);
        const otherRows = prev.standings.filter((s) => s.competitionId !== rule.competitionId);
        const recalculatedRows = compRows.map((r) => ({
          ...r,
          points: Math.max(
            0,
            r.won * rule.pointsWin +
              r.drawn * rule.pointsDraw +
              r.lost * rule.pointsLoss -
              (r.pointsDeducted || 0)
          ),
        }));
        const sortedComp = sortStandingsByCompetitionRules(
          recalculatedRows,
          prev.matches.filter(
            (m) => m.competitionId === rule.competitionId && m.status === 'finished'
          ),
          rule
        );
        return {
          ...prev,
          competitionRules: rules,
          standings: [...otherRows, ...sortedComp],
        };
      });
      showToast('تم حفظ لائحة البطولة وإعادة احتساب الترتيب تلقائياً', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const recalculateCompetitionStandings = useCallback(
    async (competitionId: CompetitionId) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => {
        const rule = prev.competitionRules?.[competitionId];
        const directory = prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY;
        const standings = recalculateStandingsForCompetition(
          competitionId,
          prev.matches,
          prev.standings,
          rule,
          directory
        );
        return { ...prev, standings };
      });
      showToast('تمت إعادة حساب الترتيب من النتائج المعتمدة', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const registerNewTeam = useCallback(
    async (team: {
      name: string;
      shortName?: string;
      color?: string;
      competitionId: CompetitionId;
      city?: string;
    }): Promise<TeamDirectoryItem> => {
      const cleanName = team.name.trim();
      const newTeam: TeamDirectoryItem = {
        id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        shortName: (team.shortName || cleanName.replace(/^نادي\s+/, '')).slice(0, 12),
        color: team.color || '#10B981',
        competitionId: team.competitionId,
        city: team.city || 'الأردن',
        aliases: [cleanName],
      };

      await commitState((prev) => {
        const dir = prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY;
        const exists = dir.some(
          (t) => normalizeArabicTeamName(t.name) === normalizeArabicTeamName(cleanName)
        );
        const teamsDirectory = exists ? dir : [...dir, newTeam];
        return { ...prev, teamsDirectory };
      });
      showToast(`تم تسجيل فريق "${cleanName}" في دليل الأندية المعتمدة`, 'emerald');
      return newTeam;
    },
    [commitState, showToast]
  );

  const linkAliasToExistingTeam = useCallback(
    async (aliasName: string, targetCanonicalName: string) => {
      const cleanAlias = aliasName.trim();
      if (!cleanAlias) return;
      await commitState((prev) => {
        const dir = prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY;
        const normTarget = normalizeArabicTeamName(targetCanonicalName);
        const teamsDirectory = dir.map((t) => {
          if (normalizeArabicTeamName(t.name) !== normTarget) return t;
          const aliases = Array.from(new Set([...(t.aliases || []), cleanAlias]));
          return { ...t, aliases };
        });
        return { ...prev, teamsDirectory };
      });
      showToast(`تم ربط الاسم "${cleanAlias}" بالنادي "${targetCanonicalName}"`, 'emerald');
    },
    [commitState, showToast]
  );

  // ============================================================================
  // مركز الإدخال الذكي (AI Sports Data Import) والمراجعة والاعتماد
  // ============================================================================
  const saveImportBatch = useCallback(
    async (batch: SmartImportBatch) => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return;
      }
      await commitState((prev) => {
        const list = prev.importBatches || [];
        const exists = list.some((b) => b.id === batch.id);
        const importBatches = exists
          ? list.map((b) => (b.id === batch.id ? { ...batch, updatedAt: new Date().toISOString() } : b))
          : [batch, ...list];
        return { ...prev, importBatches };
      });
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const approveAndPublishImportBatch = useCallback(
    async (batchId: string, actorName = 'مدير النظام'): Promise<boolean> => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: لا يمكن لغير المدير اعتماد البيانات ونشرها', 'crimson');
        return false;
      }

      const targetBatch = (data.importBatches || []).find((b) => b.id === batchId);
      if (!targetBatch) {
        showToast('عملية الاستيراد غير موجودة', 'crimson');
        return false;
      }

      // طبقة التحقق الإلزامية قبل الاعتماد النهائي
      const revalidatedRows = validateExtractedImportRows(
        targetBatch.rows,
        targetBatch.dataType,
        targetBatch.competitionId,
        data.matches,
        data.standings,
        data.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
        data.competitionRules?.[targetBatch.competitionId],
        {
          season: targetBatch.season,
          ageCategory: targetBatch.ageCategory,
          groupName: targetBatch.groupName,
          roundName: targetBatch.roundName,
        }
      );

      // فصل المباريات/الصفوف الجاهزة الصحيحة عن الصفوف الناقصة التي تحتاج تصحيحاً
      // لا نمنع اعتماد المباريات الصحيحة بسبب وجود مباراة أخرى ناقصة، ولا نعتمد أبداً مباراة ناقصة كأنها مؤكدة
      const readyRows = revalidatedRows.filter((r) => r.isReadyForApproval);
      const incompleteRows = revalidatedRows.filter((r) => !r.isReadyForApproval);

      if (readyRows.length === 0) {
        await commitState((prev) => ({
          ...prev,
          importBatches: (prev.importBatches || []).map((b) =>
            b.id === batchId
              ? {
                  ...b,
                  rows: revalidatedRows,
                  status: 'Needs Correction',
                  updatedAt: new Date().toISOString(),
                }
              : b
          ),
        }));
        showToast(
          'تم رفض الاعتماد: لا توجد أي مباراة مكتملة جاهزة للاعتماد؛ يرجى تصحيح الحقول غير الواضحة أولاً',
          'crimson'
        );
        return false;
      }

      const nowIso = new Date().toISOString();

      await commitState((prev) => {
        let nextMatches = [...prev.matches];
        let nextStandings = [...prev.standings];
        let nextScorers = [...prev.scorers];
        let nextGoalkeepers = [...(prev.goalkeepers || [])];
        let nextDirectory = [...(prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY)];
        const rule =
          prev.competitionRules?.[targetBatch.competitionId] ||
          getDefaultCompetitionRules()[targetBatch.competitionId];

        const ensureTeamInDirectory = (name: string) => {
          const clean = (name || '').trim();
          if (!clean || clean === UNCLEAR_VALUE_MARKER) return;
          const norm = normalizeArabicTeamName(clean);
          if (!nextDirectory.some((t) => normalizeArabicTeamName(t.name) === norm)) {
            nextDirectory.push({
              id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: clean,
              shortName: clean.replace(/^نادي\s+/, '').slice(0, 12),
              color: '#10B981',
              competitionId: targetBatch.competitionId,
              groupName: targetBatch.groupName,
              aliases: [clean],
            });
          }
        };

        if (targetBatch.dataType === 'standings_table') {
          const otherStandings = nextStandings.filter(
            (s) => s.competitionId !== targetBatch.competitionId
          );
          const compStandings = nextStandings.filter(
            (s) => s.competitionId === targetBatch.competitionId
          );

          for (const r of readyRows) {
            const tName = String(r.teamName || '').trim();
            if (!tName) continue;
            ensureTeamInDirectory(tName);
            const norm = normalizeArabicTeamName(tName);
            const existingIdx = compStandings.findIndex(
              (s) => normalizeArabicTeamName(s.teamName) === norm
            );
            const rowObj: StandingRow = {
              id:
                existingIdx >= 0
                  ? compStandings[existingIdx].id
                  : `st-${targetBatch.competitionId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              competitionId: targetBatch.competitionId,
              season: targetBatch.season,
              groupName: targetBatch.groupName,
              teamName: tName,
              shortName:
                existingIdx >= 0
                  ? compStandings[existingIdx].shortName
                  : tName.replace(/^نادي\s+/, '').slice(0, 12),
              teamColor:
                existingIdx >= 0 ? compStandings[existingIdx].teamColor : '#10B981',
              played: Number(r.played) || 0,
              won: Number(r.won) || 0,
              drawn: Number(r.drawn) || 0,
              lost: Number(r.lost) || 0,
              goalsFor: Number(r.goalsFor) || 0,
              goalsAgainst: Number(r.goalsAgainst) || 0,
              points: Number(r.points) || 0,
              form:
                existingIdx >= 0 && compStandings[existingIdx].form.length > 0
                  ? compStandings[existingIdx].form
                  : ['W', 'D', 'W'],
            };
            if (existingIdx >= 0) {
              compStandings[existingIdx] = rowObj;
            } else {
              compStandings.push(rowObj);
            }
          }

          const sortedComp = sortStandingsByCompetitionRules(
            compStandings,
            nextMatches.filter(
              (m) => m.competitionId === targetBatch.competitionId && m.status === 'finished'
            ),
            rule
          );
          nextStandings = [...otherStandings, ...sortedComp];
        } else if (
          targetBatch.dataType === 'match_results' ||
          targetBatch.dataType === 'match_schedule' ||
          targetBatch.dataType === 'rounds_data'
        ) {
          for (const r of readyRows) {
            const hTeam = String(r.homeTeam || '').trim();
            const aTeam = String(r.awayTeam || '').trim();
            if (!hTeam || !aTeam) continue;
            ensureTeamInDirectory(hTeam);
            ensureTeamInDirectory(aTeam);

            const newMatch: MatchItem = {
              id: `m-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              competitionId: targetBatch.competitionId,
              season: r.season || targetBatch.season,
              ageCategory: r.ageCategory || targetBatch.ageCategory,
              groupName: r.groupName || targetBatch.groupName,
              round: String(r.roundNumber || r.round || targetBatch.roundName || 'الجولة 1'),
              homeTeam: hTeam,
              homeShort: hTeam.replace(/^نادي\s+/, '').slice(0, 10),
              homeColor: '#10B981',
              awayTeam: aTeam,
              awayShort: aTeam.replace(/^نادي\s+/, '').slice(0, 10),
              awayColor: '#38BDF8',
              homeScore: Number(r.homeScore) || 0,
              awayScore: Number(r.awayScore) || 0,
              status:
                r.matchStatus ||
                r.status ||
                (targetBatch.dataType === 'match_schedule' ? 'upcoming' : 'finished'),
              kickoffIso:
                r.matchDate && !Number.isNaN(new Date(r.matchDate).getTime())
                  ? new Date(r.matchDate).toISOString()
                  : new Date().toISOString(),
              stadium: String(r.stadium ?? ''),
              isApproved: true,
              importBatchId: targetBatch.id,
              events: [],
            };

            nextMatches = [newMatch, ...nextMatches];
            if (newMatch.status === 'finished') {
              nextStandings = applyApprovedMatchResultToStandings(
                newMatch,
                null,
                nextStandings,
                nextMatches,
                rule,
                nextDirectory
              );
            }
          }
        } else if (
          targetBatch.dataType === 'top_scorers' ||
          targetBatch.dataType === 'players_stats' ||
          targetBatch.dataType === 'players_list'
        ) {
          for (const r of readyRows) {
            const pName = String(r.playerName || '').trim();
            const tName = String(r.teamName || '').trim();
            if (!pName) continue;
            ensureTeamInDirectory(tName);
            const normP = normalizeArabicTeamName(pName);
            const existingIdx = nextScorers.findIndex(
              (s) =>
                s.competitionId === targetBatch.competitionId &&
                normalizeArabicTeamName(s.playerName) === normP
            );
            const scorerObj: TopScorer = {
              id:
                existingIdx >= 0
                  ? nextScorers[existingIdx].id
                  : `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              competitionId: targetBatch.competitionId,
              season: targetBatch.season,
              playerName: pName,
              teamName: tName || 'غير محدد',
              teamColor: '#10B981',
              goals: Number(r.goals) || 0,
              assists: Number(r.assists) || 0,
              matches: Number(r.matches) || 1,
            };
            if (existingIdx >= 0) {
              nextScorers[existingIdx] = scorerObj;
            } else {
              nextScorers.push(scorerObj);
            }
          }
        } else if (targetBatch.dataType === 'goalkeepers_stats') {
          for (const r of readyRows) {
            const pName = String(r.playerName || '').trim();
            const tName = String(r.teamName || '').trim();
            if (!pName) continue;
            ensureTeamInDirectory(tName);
            const normP = normalizeArabicTeamName(pName);
            const existingIdx = nextGoalkeepers.findIndex(
              (g) =>
                g.competitionId === targetBatch.competitionId &&
                normalizeArabicTeamName(g.playerName) === normP
            );
            const gkObj: GoalkeeperStat = {
              id:
                existingIdx >= 0
                  ? nextGoalkeepers[existingIdx].id
                  : `gk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              competitionId: targetBatch.competitionId,
              season: targetBatch.season,
              playerName: pName,
              teamName: tName || 'غير محدد',
              teamColor: '#10B981',
              matches: Number(r.matches) || 1,
              cleanSheets: Number(r.cleanSheets) || 0,
              goalsConceded: Number(r.goalsConceded) || 0,
            };
            if (existingIdx >= 0) {
              nextGoalkeepers[existingIdx] = gkObj;
            } else {
              nextGoalkeepers.push(gkObj);
            }
          }
        } else if (targetBatch.dataType === 'teams_list') {
          for (const r of readyRows) {
            const tName = String(r.teamName || '').trim();
            if (!tName) continue;
            ensureTeamInDirectory(tName);
          }
        }

        const revisionEntry: ImportRevisionEntry = {
          id: `rev-${Date.now()}`,
          timestamp: nowIso,
          actor: actorName,
          action: incompleteRows.length > 0 ? 'PARTIAL_APPROVED_PUBLISHED' : 'APPROVED_AND_PUBLISHED',
          details:
            incompleteRows.length > 0
              ? `تم اعتماد ونشر ${readyRows.length} سجلات صحيحة، وإبقاء ${incompleteRows.length} سجلات غير مكتملة في المسودة للتصحيح`
              : `تم اعتماد ونشر جميع السجلات (${readyRows.length}) ضمن بطولة (${targetBatch.competitionId})`,
        };

        const importBatches = (prev.importBatches || []).map((b) =>
          b.id === batchId
            ? {
                ...b,
                rows: incompleteRows.length > 0 ? incompleteRows : revalidatedRows,
                status:
                  incompleteRows.length > 0
                    ? ('Needs Correction' as const)
                    : ('Published' as const),
                approvedBy: actorName,
                approvedAt: nowIso,
                updatedAt: nowIso,
                revisions: [revisionEntry, ...(b.revisions || [])],
              }
            : b
        );

        return {
          ...prev,
          matches: nextMatches,
          standings: nextStandings,
          scorers: nextScorers,
          goalkeepers: nextGoalkeepers,
          teamsDirectory: nextDirectory,
          importBatches,
          auditLogs: [revisionEntry, ...(prev.auditLogs || [])].slice(0, 100),
        };
      });

      if (incompleteRows.length > 0) {
        showToast(
          `تم اعتماد ونشر ${readyRows.length} مباريات صحيحة، وبقيت ${incompleteRows.length} مباراة تحتاج تصحيحاً في المراجعة`,
          'amber'
        );
      } else {
        showToast(
          `تم اعتماد ونشر جميع السجلات (${readyRows.length}) وتحديث الترتيب والإحصائيات تلقائياً!`,
          'emerald'
        );
      }
      return true;
    },
    [commitState, data, isAdminUnlocked, showToast]
  );

  const rejectImportBatch = useCallback(
    async (batchId: string, reason: string, actorName = 'مدير النظام') => {
      if (!isAdminUnlocked) return;
      const nowIso = new Date().toISOString();
      const rev: ImportRevisionEntry = {
        id: `rev-${Date.now()}`,
        timestamp: nowIso,
        actor: actorName,
        action: 'REJECTED_IMPORT',
        details: `تم رفض الاستيراد: ${reason || 'بيانات غير مطابقة'}`,
      };
      await commitState((prev) => ({
        ...prev,
        importBatches: (prev.importBatches || []).map((b) =>
          b.id === batchId
            ? {
                ...b,
                status: 'Rejected' as const,
                rejectedReason: reason,
                updatedAt: nowIso,
                revisions: [rev, ...(b.revisions || [])],
              }
            : b
        ),
        auditLogs: [rev, ...(prev.auditLogs || [])].slice(0, 100),
      }));
      showToast('تم رفض عملية الاستيراد وحفظها في السجل', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const deleteImportBatch = useCallback(
    async (batchId: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        importBatches: (prev.importBatches || []).filter((b) => b.id !== batchId),
      }));
      showToast('تم حذف مسودة الاستيراد', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
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
        saveGoalkeeper,
        deleteGoalkeeper,
        saveCompetitionRule,
        recalculateCompetitionStandings,
        registerNewTeam,
        linkAliasToExistingTeam,
        saveImportBatch,
        approveAndPublishImportBatch,
        rejectImportBatch,
        deleteImportBatch,
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
