import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  AppDataState,
  AppNotification,
  CloudConnectionState,
  CompetitionId,
  CompetitionRuleConfig,
  CustomCompetitionItem,
  FirebaseCloudConfig,
  GoalkeeperStat,
  HeroBanner,
  ImportRevisionEntry,
  InjuryReportItem,
  LiveStreamItem,
  MatchEvent,
  MatchItem,
  MatchStatus,
  NewsArticle,
  NewsSourceConfig,
  SmartImportBatch,
  SportsGraphicCard,
  StandingRow,
  StandingsHistoryEntry,
  TeamDirectoryItem,
  TopScorer,
  WateenAutomationSettings,
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
  fetchCloudStateFromFirestore,
  getSavedFirebaseConfig,
  initFirebaseCloud,
  isFirebaseReady,
  migrateLocalDataToFirestoreWithVerification,
  queueCloudPushNotification,
  saveCloudState,
  saveFirebaseConfig,
  signInAdminWithFirebaseEmail,
  signInAnonymousIfAllowed,
  signOutFirebaseAdmin,
  subscribeToCloudState,
  subscribeToFirebaseAuth,
  teardownFirebaseCloud,
  uploadMediaToCloud,
} from '../services/firebaseService';
import {
  createPreMigrationBackupSnapshot,
  getPreMigrationBackupSnapshot,
  loadStateFromIndexedDB,
  LOCAL_DATA_KEY,
  mergeStatesWithoutDuplication,
  MigrationVerificationReport,
  PreMigrationBackupSnapshot,
  saveStateToIndexedDB,
} from '../services/persistentStorageService';
import {
  initializeNativeDisplay,
  initializeNotificationsAfterSplash,
} from '../services/nativeAndroid';
import {
  getDefaultAutomationSettings,
  getDefaultNewsSources,
  migrateAppStateSafely,
} from '../services/schemaMigrationService';
import {
  NewsCollectionCycleResult,
  processRawNewsItemForWateen,
  RawFetchedNewsItem,
  runNewsIntelligenceBatch,
} from '../services/newsIntelligenceService';
import {
  appendMatchEventSafely,
  createStandingsHistoryEntry,
  validateManualStandingAdjustment,
} from '../services/matchIntelligenceService';
import { validateAndBuildInjuryReport } from '../services/playersAndMedicalService';
import {
  generateDeterministicGoalkeeperId,
  generateDeterministicMatchId,
  generateDeterministicNewsId,
  generateDeterministicPlayerId,
  generateDeterministicStandingId,
  generateDeterministicTeamId,
} from '../utils/deterministicIds';
import { isLiveMatchStatus } from '../utils/matchStatus';

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
  cloudConnectionState: CloudConnectionState;
  cloudConfig: FirebaseCloudConfig | null;
  cloudSyncStatus: 'idle' | 'syncing' | 'connected' | 'error';
  cloudError: string | null;
  firebaseUserEmail: string | null;
  preMigrationBackup: PreMigrationBackupSnapshot | null;
  lastMigrationReport: MigrationVerificationReport | null;

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

  // إدارة المباريات والنتائج وذكاء المباريات
  saveMatch: (match: MatchItem) => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  adjustMatchScore: (id: string, side: 'home' | 'away', delta: number) => Promise<void>;
  updateMatchLiveState: (id: string, status: MatchStatus, liveMinute?: number) => Promise<void>;
  recordMatchEvent: (
    matchId: string,
    event: Omit<MatchEvent, 'id'>,
    syncScoreOnGoal?: boolean
  ) => Promise<boolean>;

  // إدارة الترتيب والهدافين والحراس وقواعد البطولات
  saveStandingRow: (row: StandingRow) => Promise<boolean>;
  deleteStandingRow: (id: string) => Promise<void>;
  saveScorer: (scorer: TopScorer) => Promise<void>;
  deleteScorer: (id: string) => Promise<void>;
  saveGoalkeeper: (gk: GoalkeeperStat) => Promise<void>;
  deleteGoalkeeper: (id: string) => Promise<void>;
  saveInjuryReport: (
    report: Omit<InjuryReportItem, 'id' | 'lastUpdatedAt'> & { id?: string }
  ) => Promise<boolean>;
  deleteInjuryReport: (id: string) => Promise<void>;
  updateTeamDirectoryItem: (team: TeamDirectoryItem) => Promise<void>;
  saveCompetitionRule: (rule: CompetitionRuleConfig) => Promise<void>;
  saveCustomCompetition: (comp: CustomCompetitionItem) => Promise<void>;
  deleteCustomCompetition: (id: string) => Promise<void>;
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

  // الذكاء الإخباري ومصادر الأخبار وطابور المراجعة وإعدادات WATEEN AI
  saveNewsSource: (source: NewsSourceConfig) => Promise<void>;
  deleteNewsSource: (id: string) => Promise<void>;
  toggleNewsSourceEnabled: (id: string) => Promise<void>;
  toggleNewsSourceTrusted: (id: string) => Promise<void>;
  updateAutomationSettings: (patch: Partial<WateenAutomationSettings>) => Promise<void>;
  ingestManualNewsOrRss: (params: {
    items: RawFetchedNewsItem[];
    sourceId?: string;
    sourceName?: string;
    sourceTrusted?: boolean;
  }) => Promise<{ publishedCount: number; queuedCount: number; rejectedCount: number }>;
  runNewsIntelligenceNow: () => Promise<NewsCollectionCycleResult>;
  updateQueuedArticle: (article: NewsArticle) => Promise<void>;
  approveQueuedArticle: (articleId: string) => Promise<void>;
  rejectQueuedArticle: (articleId: string, reason?: string) => Promise<void>;

  // إعدادات السحابة والنسخ الاحتياطي والمصادقة
  connectFirebase: (config: FirebaseCloudConfig) => Promise<boolean>;
  disconnectFirebase: () => Promise<void>;
  pushCurrentDataToCloud: () => Promise<boolean>;
  pullDataFromCloudNow: () => Promise<boolean>;
  migrateLocalDataToCloudVerified: () => Promise<MigrationVerificationReport>;
  createBackupSnapshotNow: () => PreMigrationBackupSnapshot;
  restorePreMigrationBackup: () => Promise<boolean>;
  loginAdminWithFirebaseEmail: (email: string, password: string) => Promise<boolean>;
  logoutFirebaseAdmin: () => Promise<void>;
  exportBackupJson: () => string;
  importBackupJson: (jsonText: string) => Promise<boolean>;
  resetToDemoData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function loadInitialLocalState(): AppDataState {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppDataState>;
      if (parsed && (Array.isArray(parsed.articles) || Array.isArray(parsed.matches))) {
        const { state, didMigrate } = migrateAppStateSafely(parsed, INITIAL_SEED_DATA);
        if (didMigrate) {
          // حفظ نسخة احتياطية كاملة للحالة القديمة قبل الترقية
          try {
            createPreMigrationBackupSnapshot({
              ...INITIAL_SEED_DATA,
              ...parsed,
            } as AppDataState);
            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(state));
          } catch {
            // ignore storage quota errors safely
          }
        }
        return state;
      }
    }
  } catch {
    // fallback to seed safely
  }
  return migrateAppStateSafely(null, INITIAL_SEED_DATA).state;
}

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppDataState>(() => loadInitialLocalState());
  const [cloudConfig, setCloudConfig] = useState<FirebaseCloudConfig | null>(() =>
    getSavedFirebaseConfig()
  );
  const [cloudMode, setCloudMode] = useState<'local' | 'firebase'>('local');
  const [cloudConnectionState, setCloudConnectionState] = useState<CloudConnectionState>('local');
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'connected' | 'error'>(
    'idle'
  );
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [firebaseUserEmail, setFirebaseUserEmail] = useState<string | null>(null);
  const [preMigrationBackup, setPreMigrationBackup] = useState<PreMigrationBackupSnapshot | null>(
    () => getPreMigrationBackupSnapshot()
  );
  const [lastMigrationReport, setLastMigrationReport] =
    useState<MigrationVerificationReport | null>(null);

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
  const authUnsubRef = useRef<(() => void) | null>(null);

  const showToast = useCallback((text: string, tone: 'emerald' | 'crimson' | 'amber' = 'emerald') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), text, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // حفظ محلي مزدوج (localStorage + IndexedDB) + مزامنة فورية مع Firebase Firestore إن كان متصلاً
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
        saveStateToIndexedDB('main_app_state', nextState).catch(() => {});
        return nextState;
      });

      if (isFirebaseReady()) {
        setCloudSyncStatus('syncing');
        const saved = await saveCloudState(nextState);
        if (saved) {
          setCloudSyncStatus('connected');
          setCloudConnectionState('connected');
          setCloudError(null);
        } else {
          setCloudSyncStatus('error');
          setCloudConnectionState('failed');
          setCloudError('تعذر الحفظ السحابي، تم الحفظ محلياً في الجهاز.');
        }
      }
    },
    []
  );

  // ربط Firebase الفعلي وقراءة البيانات من السحابة ومزامنة البيانات المحلية دون تكرار أو فقدان
  const activateFirebase = useCallback(
    async (config: FirebaseCloudConfig, notify = false): Promise<boolean> => {
      setCloudConnectionState('connecting');
      setCloudSyncStatus('syncing');
      setCloudError(null);

      // إنشاء نسخة احتياطية تلقائية قبل أي اتصال أو نقل سحابي
      setData((currentLocal) => {
        const snap = createPreMigrationBackupSnapshot(currentLocal);
        setPreMigrationBackup(snap);
        return currentLocal;
      });

      const res = await initFirebaseCloud(config);
      if (!res.ok) {
        setCloudMode('local');
        setCloudConnectionState('failed');
        setCloudSyncStatus('error');
        setCloudError(res.error || 'فشل الاتصال السحابي');
        if (notify) showToast('فشل الاتصال بـ Firebase — تحقق من الإعدادات', 'crimson');
        return false;
      }

      if (authUnsubRef.current) {
        authUnsubRef.current();
      }
      authUnsubRef.current = subscribeToFirebaseAuth((user) => {
        setFirebaseUserEmail(user?.email || (user?.isAnonymous ? 'جلسة مصادقة سحابية' : null));
      });
      await signInAnonymousIfAllowed();

      // قراءة البيانات الموجودة في السحابة ودمجها مع البيانات المحلية بدون تكرار
      const remoteExisting = await fetchCloudStateFromFirestore();
      if (remoteExisting) {
        setData((prevLocal) => {
          const merged = mergeStatesWithoutDuplication(prevLocal, remoteExisting);
          try {
            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(merged));
          } catch {
            // ignore
          }
          saveStateToIndexedDB('main_app_state', merged).catch(() => {});
          return merged;
        });
      }

      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      unsubRef.current = subscribeToCloudState(
        (remoteState) => {
          setData((prevLocal) => {
            const merged = mergeStatesWithoutDuplication(prevLocal, remoteState);
            try {
              localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(merged));
            } catch {
              // ignore
            }
            saveStateToIndexedDB('main_app_state', merged).catch(() => {});
            return merged;
          });
          setCloudSyncStatus('connected');
          setCloudConnectionState('connected');
          setCloudError(null);
        },
        (err) => {
          setCloudSyncStatus('error');
          setCloudConnectionState('failed');
          setCloudError(err);
        }
      );

      setCloudConfig(config);
      setCloudMode('firebase');
      setCloudConnectionState('connected');
      setCloudSyncStatus('connected');
      setCloudError(null);
      if (notify) showToast('تم الاتصال السحابي الفعلي مع Firebase بنجاح', 'emerald');
      return true;
    },
    [showToast]
  );

  // استرجاع البيانات من IndexedDB في حال تم مسح localStorage + تفعيل السحابة إن وجدت
  useEffect(() => {
    initializeNativeDisplay();

    // ضمان إنشاء نسخة احتياطية أولية وحفظها في IndexedDB
    const rawLocal = localStorage.getItem(LOCAL_DATA_KEY);
    if (!rawLocal) {
      loadStateFromIndexedDB<AppDataState>('main_app_state').then((idbState) => {
        if (idbState && (Array.isArray(idbState.matches) || Array.isArray(idbState.articles))) {
          const { state: migratedIdb } = migrateAppStateSafely(idbState, INITIAL_SEED_DATA);
          setData((prev) => {
            const merged = mergeStatesWithoutDuplication(prev, migratedIdb);
            try {
              localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(merged));
            } catch {
              // ignore
            }
            return merged;
          });
        }
      });
    } else {
      saveStateToIndexedDB('main_app_state', data).catch(() => {});
    }

    if (!getPreMigrationBackupSnapshot()) {
      const snap = createPreMigrationBackupSnapshot(data);
      setPreMigrationBackup(snap);
    }

    const saved = getSavedFirebaseConfig();
    if (saved) {
      activateFirebase(saved, false);
    }

    return () => {
      if (unsubRef.current) unsubRef.current();
      if (authUnsubRef.current) authUnsubRef.current();
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

  // قراءة البيانات من السحابة فوراً عند تسجيل الدخول
  const pullDataFromCloudNow = useCallback(async (): Promise<boolean> => {
    if (!isFirebaseReady()) return false;
    setCloudSyncStatus('syncing');
    const remote = await fetchCloudStateFromFirestore();
    if (!remote) {
      setCloudSyncStatus('connected');
      return false;
    }
    setData((prev) => {
      const merged = mergeStatesWithoutDuplication(prev, remote);
      try {
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      saveStateToIndexedDB('main_app_state', merged).catch(() => {});
      return merged;
    });
    setCloudSyncStatus('connected');
    setCloudConnectionState('connected');
    showToast('تم استرجاع ومزامنة أحدث البيانات من السحابة بنجاح', 'emerald');
    return true;
  }, [showToast]);

  // إدارة صلاحية المالك (وعند تسجيل الدخول يقرأ البيانات من السحابة تلقائياً إن كانت متصلة)
  const unlockAdmin = useCallback(
    (pin: string) => {
      if (pin.trim() === data.adminPin.trim()) {
        setIsAdminUnlocked(true);
        try {
          sessionStorage.setItem(ADMIN_SESSION_KEY, 'unlocked');
        } catch {
          // ignore
        }
        if (isFirebaseReady()) {
          pullDataFromCloudNow();
        }
        showToast('أهلاً بك في لوحة تحكم وتين سبورت', 'emerald');
        return true;
      }
      showToast('رمز الدخول غير صحيح', 'crimson');
      return false;
    },
    [data.adminPin, pullDataFromCloudNow, showToast]
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
        const resolvedId =
          exists || (article.id && !/^art-\d+/.test(article.id))
            ? article.id
            : generateDeterministicNewsId({
                sourceUrl: article.sourceUrl,
                originalTitle: article.originalTitle || article.title,
              });
        const normalizedArticle: NewsArticle = {
          ...article,
          id: resolvedId,
          isDemo: false,
        };
        const existsAfterId = prev.articles.some((a) => a.id === normalizedArticle.id);
        const articles = existsAfterId
          ? prev.articles.map((a) => (a.id === normalizedArticle.id ? normalizedArticle : a))
          : [normalizedArticle, ...prev.articles];
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

        const deterministicId =
          previousMatch || (match.id && !/^m-\d+/.test(match.id))
            ? match.id
            : generateDeterministicMatchId({
                competitionId: match.competitionId,
                season: match.season,
                round: match.round,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
              });

        const approvedMatch: MatchItem = {
          ...match,
          id: deterministicId,
          homeTeamId: match.homeTeamId || generateDeterministicTeamId(match.homeTeam),
          awayTeamId: match.awayTeamId || generateDeterministicTeamId(match.awayTeam),
          isApproved: true,
          isDemo: false,
        };
        const exists = prev.matches.some((m) => m.id === approvedMatch.id);
        const matches = exists
          ? prev.matches.map((m) => (m.id === approvedMatch.id ? approvedMatch : m))
          : [approvedMatch, ...prev.matches];

        const rule = prev.competitionRules?.[approvedMatch.competitionId];
        const directory = prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY;
        const standingsUpdated =
          approvedMatch.status === 'finished' || previousMatch?.status === 'finished';
        const standings = standingsUpdated
          ? applyApprovedMatchResultToStandings(
              approvedMatch,
              previousMatch,
              prev.standings,
              matches,
              rule,
              directory
            )
          : prev.standings;

        let nextHistory: StandingsHistoryEntry[] = prev.standingsHistory || [];
        if (standingsUpdated) {
          const compSorted = standings.filter(
            (s) => s.competitionId === approvedMatch.competitionId
          );
          const histEntry = createStandingsHistoryEntry({
            competitionId: approvedMatch.competitionId,
            season: approvedMatch.season || rule?.season || '2026 / 2027',
            round: approvedMatch.round,
            triggerType: 'match_result',
            reason: `اعتماد نتيجة ${approvedMatch.homeTeam} (${approvedMatch.homeScore}-${approvedMatch.awayScore}) ${approvedMatch.awayTeam}`,
            actor: 'مدير النظام',
            sortedCompRows: compSorted,
          });
          nextHistory = [histEntry, ...nextHistory].slice(0, 150);
        }

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
          standingsHistory: nextHistory,
          auditLogs: [auditEntry, ...(prev.auditLogs || [])].slice(0, 150),
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
          liveMinute:
            isLiveMatchStatus(status) && status !== 'halftime'
              ? liveMinute ?? previousMatch.liveMinute ?? 1
              : undefined,
        };
        const matches = prev.matches.map((m) => (m.id === id ? updatedMatch : m));
        const standingsChanged = status === 'finished' || previousMatch.status === 'finished';
        const standings = standingsChanged
          ? applyApprovedMatchResultToStandings(
              updatedMatch,
              previousMatch,
              prev.standings,
              matches,
              prev.competitionRules?.[updatedMatch.competitionId],
              prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY
            )
          : prev.standings;

        let nextHistory = prev.standingsHistory || [];
        if (standingsChanged) {
          const histEntry = createStandingsHistoryEntry({
            competitionId: updatedMatch.competitionId,
            season: updatedMatch.season || '2026 / 2027',
            round: updatedMatch.round,
            triggerType: 'match_result',
            reason: `تحديث حالة المباراة إلى (${status}): ${updatedMatch.homeTeam} ${updatedMatch.homeScore}-${updatedMatch.awayScore} ${updatedMatch.awayTeam}`,
            actor: 'مدير النظام',
            sortedCompRows: standings.filter(
              (s) => s.competitionId === updatedMatch.competitionId
            ),
          });
          nextHistory = [histEntry, ...nextHistory].slice(0, 150);
        }

        return { ...prev, matches, standings, standingsHistory: nextHistory };
      });
      showToast('تم تحديث حالة المباراة والترتيب فوراً', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const recordMatchEvent = useCallback(
    async (
      matchId: string,
      event: Omit<MatchEvent, 'id'>,
      syncScoreOnGoal = true
    ): Promise<boolean> => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return false;
      }

      let resultStatus: { added: boolean; reason?: string } = { added: false };
      await commitState((prev) => {
        const target = prev.matches.find((m) => m.id === matchId);
        if (!target) {
          resultStatus = { added: false, reason: 'المباراة غير موجودة' };
          return prev;
        }
        const appended = appendMatchEventSafely(target, event, syncScoreOnGoal);
        resultStatus = { added: appended.added, reason: appended.reason };
        if (!appended.added) return prev;

        const matches = prev.matches.map((m) => (m.id === matchId ? appended.match : m));
        const standings =
          appended.match.status === 'finished' && event.type === 'goal' && syncScoreOnGoal
            ? applyApprovedMatchResultToStandings(
                appended.match,
                target,
                prev.standings,
                matches,
                prev.competitionRules?.[appended.match.competitionId],
                prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY
              )
            : prev.standings;
        return { ...prev, matches, standings };
      });

      if (!resultStatus.added) {
        showToast(resultStatus.reason || 'تعذر تسجيل الحدث', 'crimson');
        return false;
      }
      showToast('تم تسجيل حدث المباراة بنجاح', 'emerald');
      return true;
    },
    [commitState, isAdminUnlocked, showToast]
  );

  // جداول الترتيب (مع إلزام تسجيل سبب التعديل اليدوي وحفظ اللقطة التاريخية)
  const saveStandingRow = useCallback(
    async (row: StandingRow): Promise<boolean> => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return false;
      }

      const existingRow = data.standings.find((s) => s.id === row.id) || null;
      const validation = validateManualStandingAdjustment({
        isEditingExisting: Boolean(existingRow),
        previousRow: existingRow,
        nextRow: row,
      });
      if (!validation.ok) {
        showToast(validation.error || 'يرجى كتابة سبب التعديل اليدوي', 'crimson');
        return false;
      }

      await commitState((prev) => {
        const exists = prev.standings.some((s) => s.id === row.id);
        const resolvedId =
          exists || (row.id && !/^st-\d+/.test(row.id))
            ? row.id
            : generateDeterministicStandingId({
                competitionId: row.competitionId,
                season: row.season,
                groupName: row.groupName,
                teamName: row.teamName,
              });
        const normalizedRow: StandingRow = {
          ...row,
          id: resolvedId,
          teamId: row.teamId || generateDeterministicTeamId(row.teamName),
          isDemo: false,
        };
        const existsAfterId = prev.standings.some((s) => s.id === normalizedRow.id);
        const rawStandings = existsAfterId
          ? prev.standings.map((s) => (s.id === normalizedRow.id ? normalizedRow : s))
          : [...prev.standings, normalizedRow];

        const compRows = rawStandings.filter((s) => s.competitionId === row.competitionId);
        const otherRows = rawStandings.filter((s) => s.competitionId !== row.competitionId);
        const sortedComp = sortStandingsByCompetitionRules(
          compRows,
          prev.matches.filter((m) => m.competitionId === row.competitionId && m.status === 'finished'),
          prev.competitionRules?.[row.competitionId]
        );

        const reasonText =
          (row.manualAdjustmentReason || '').trim() ||
          `تعديل يدوي في جدول الترتيب للفريق (${normalizedRow.teamName})`;
        const histEntry = createStandingsHistoryEntry({
          competitionId: row.competitionId,
          season:
            row.season || prev.competitionRules?.[row.competitionId]?.season || '2026 / 2027',
          triggerType: 'manual_adjustment',
          reason: reasonText,
          actor: 'مدير النظام',
          sortedCompRows: sortedComp,
        });

        const auditEntry: ImportRevisionEntry = {
          id: `aud-st-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'مدير النظام',
          action: 'MANUAL_STANDINGS_ADJUSTMENT',
          details: `${normalizedRow.teamName}: ${reasonText} (النقاط: ${normalizedRow.points}${
            normalizedRow.pointsDeducted ? `، خصم: ${normalizedRow.pointsDeducted}` : ''
          })`,
        };

        return {
          ...prev,
          standings: [...otherRows, ...sortedComp],
          standingsHistory: [histEntry, ...(prev.standingsHistory || [])].slice(0, 150),
          auditLogs: [auditEntry, ...(prev.auditLogs || [])].slice(0, 150),
        };
      });
      showToast('تم تحديث الترتيب وحفظ السبب في السجل التاريخي', 'emerald');
      return true;
    },
    [commitState, data.standings, isAdminUnlocked, showToast]
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
        const resolvedId =
          exists || (scorer.id && !/^sc-\d+/.test(scorer.id))
            ? scorer.id
            : generateDeterministicPlayerId({
                competitionId: scorer.competitionId,
                playerName: scorer.playerName,
                teamName: scorer.teamName,
              });
        const normalizedScorer: TopScorer = {
          ...scorer,
          id: resolvedId,
          teamId: scorer.teamId || generateDeterministicTeamId(scorer.teamName),
          isDemo: false,
        };
        const existsAfterId = prev.scorers.some((s) => s.id === normalizedScorer.id);
        const scorers = existsAfterId
          ? prev.scorers.map((s) => (s.id === normalizedScorer.id ? normalizedScorer : s))
          : [...prev.scorers, normalizedScorer];
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
        const resolvedId =
          exists || (gk.id && !/^gk-\d+/.test(gk.id))
            ? gk.id
            : generateDeterministicGoalkeeperId({
                competitionId: gk.competitionId,
                playerName: gk.playerName,
                teamName: gk.teamName,
              });
        const normalizedGk: GoalkeeperStat = {
          ...gk,
          id: resolvedId,
          teamId: gk.teamId || generateDeterministicTeamId(gk.teamName),
          isDemo: false,
        };
        const existsAfterId = list.some((g) => g.id === normalizedGk.id);
        const goalkeepers = existsAfterId
          ? list.map((g) => (g.id === normalizedGk.id ? normalizedGk : g))
          : [...list, normalizedGk];
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

  // القسم الطبي الإخباري (الإصابات والجاهزية — يتطلب مصدراً موثقاً)
  const saveInjuryReport = useCallback(
    async (
      report: Omit<InjuryReportItem, 'id' | 'lastUpdatedAt'> & { id?: string }
    ): Promise<boolean> => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return false;
      }
      const checked = validateAndBuildInjuryReport(report);
      if (!checked.ok) {
        showToast(checked.error, 'crimson');
        return false;
      }

      await commitState((prev) => {
        const list = prev.injuries || [];
        const exists = list.some((x) => x.id === checked.record.id);
        const injuries = exists
          ? list.map((x) => (x.id === checked.record.id ? checked.record : x))
          : [checked.record, ...list];
        const auditEntry: ImportRevisionEntry = {
          id: `aud-inj-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'مدير النظام',
          action: exists ? 'UPDATE_INJURY_REPORT' : 'CREATE_INJURY_REPORT',
          details: `تقرير طبي (${checked.record.playerName} - ${checked.record.teamName}): ${checked.record.declaredInjury} [المصدر: ${checked.record.sourceName}]`,
        };
        return {
          ...prev,
          injuries,
          auditLogs: [auditEntry, ...(prev.auditLogs || [])].slice(0, 150),
        };
      });
      showToast('تم حفظ التقرير الطبي الموثق في قسم الإصابات والجاهزية', 'emerald');
      return true;
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const deleteInjuryReport = useCallback(
    async (id: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        injuries: (prev.injuries || []).filter((x) => x.id !== id),
      }));
      showToast('تم حذف سجل الإصابة من القسم الطبي', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const updateTeamDirectoryItem = useCallback(
    async (team: TeamDirectoryItem) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => {
        const dir = prev.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY;
        const exists = dir.some((t) => t.id === team.id);
        const teamsDirectory = exists
          ? dir.map((t) => (t.id === team.id ? team : t))
          : [team, ...dir];
        return { ...prev, teamsDirectory };
      });
      showToast(`تم تحديث بطاقة النادي "${team.name}" بنجاح`, 'emerald');
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
        const histEntry = createStandingsHistoryEntry({
          competitionId,
          season: rule?.season || '2026 / 2027',
          triggerType: 'recalculation',
          reason: `إعادة احتساب الترتيب التلقائي من المباريات المعتمدة`,
          actor: 'محرك الحسابات الرياضية',
          sortedCompRows: standings.filter((s) => s.competitionId === competitionId),
        });
        return {
          ...prev,
          standings,
          standingsHistory: [histEntry, ...(prev.standingsHistory || [])].slice(0, 150),
        };
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
        id: generateDeterministicTeamId(cleanName),
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
              id: generateDeterministicTeamId(clean),
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
                  : generateDeterministicStandingId({
                      competitionId: targetBatch.competitionId,
                      season: targetBatch.season,
                      groupName: targetBatch.groupName,
                      teamName: tName,
                    }),
              competitionId: targetBatch.competitionId,
              season: targetBatch.season,
              groupName: targetBatch.groupName,
              teamId: generateDeterministicTeamId(tName),
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
              isDemo: false,
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

            const effectiveSeason = r.season || targetBatch.season;
            const effectiveRound = String(
              r.roundNumber || r.round || targetBatch.roundName || 'الجولة 1'
            );
            const deterministicMatchId = generateDeterministicMatchId({
              competitionId: targetBatch.competitionId,
              season: effectiveSeason,
              round: effectiveRound,
              homeTeam: hTeam,
              awayTeam: aTeam,
            });
            const existingMatch =
              nextMatches.find((m) => m.id === deterministicMatchId) ||
              isDuplicateMatchItem(
                {
                  competitionId: targetBatch.competitionId,
                  round: effectiveRound,
                  homeTeam: hTeam,
                  awayTeam: aTeam,
                  season: effectiveSeason,
                },
                nextMatches
              );

            const newMatch: MatchItem = {
              id: existingMatch?.id || deterministicMatchId,
              competitionId: targetBatch.competitionId,
              season: effectiveSeason,
              ageCategory: r.ageCategory || targetBatch.ageCategory,
              groupName: r.groupName || targetBatch.groupName,
              round: effectiveRound,
              homeTeamId: generateDeterministicTeamId(hTeam),
              awayTeamId: generateDeterministicTeamId(aTeam),
              homeTeam: hTeam,
              homeShort: hTeam.replace(/^نادي\s+/, '').slice(0, 10),
              homeColor: existingMatch?.homeColor || '#10B981',
              awayTeam: aTeam,
              awayShort: aTeam.replace(/^نادي\s+/, '').slice(0, 10),
              awayColor: existingMatch?.awayColor || '#38BDF8',
              homeScore: Number(r.homeScore) || 0,
              awayScore: Number(r.awayScore) || 0,
              status:
                r.matchStatus ||
                r.status ||
                (targetBatch.dataType === 'match_schedule' ? 'upcoming' : 'finished'),
              kickoffIso:
                r.matchDate && !Number.isNaN(new Date(r.matchDate).getTime())
                  ? new Date(r.matchDate).toISOString()
                  : existingMatch?.kickoffIso || new Date().toISOString(),
              stadium: String(r.stadium ?? existingMatch?.stadium ?? ''),
              isApproved: true,
              isDemo: false,
              importBatchId: targetBatch.id,
              events: existingMatch?.events || [],
              stats: existingMatch?.stats,
            };

            nextMatches = existingMatch
              ? nextMatches.map((m) => (m.id === existingMatch.id ? newMatch : m))
              : [newMatch, ...nextMatches];
            if (newMatch.status === 'finished' || existingMatch?.status === 'finished') {
              nextStandings = applyApprovedMatchResultToStandings(
                newMatch,
                existingMatch || null,
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
                  : generateDeterministicPlayerId({
                      competitionId: targetBatch.competitionId,
                      playerName: pName,
                      teamName: tName || 'غير محدد',
                    }),
              competitionId: targetBatch.competitionId,
              season: targetBatch.season,
              teamId: generateDeterministicTeamId(tName || 'غير محدد'),
              playerName: pName,
              teamName: tName || 'غير محدد',
              teamColor: '#10B981',
              goals: Number(r.goals) || 0,
              assists: Number(r.assists) || 0,
              matches: Number(r.matches) || 1,
              isDemo: false,
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
                  : generateDeterministicGoalkeeperId({
                      competitionId: targetBatch.competitionId,
                      playerName: pName,
                      teamName: tName || 'غير محدد',
                    }),
              competitionId: targetBatch.competitionId,
              season: targetBatch.season,
              teamId: generateDeterministicTeamId(tName || 'غير محدد'),
              playerName: pName,
              teamName: tName || 'غير محدد',
              teamColor: '#10B981',
              matches: Number(r.matches) || 1,
              cleanSheets: Number(r.cleanSheets) || 0,
              goalsConceded: Number(r.goalsConceded) || 0,
              isDemo: false,
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

  // إضافة أو تعديل بطولة مخصصة جديدة
  const saveCustomCompetition = useCallback(
    async (comp: CustomCompetitionItem) => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return;
      }
      await commitState((prev) => {
        const list = prev.customCompetitions || [];
        const exists = list.some((c) => c.id === comp.id);
        const customCompetitions = exists
          ? list.map((c) => (c.id === comp.id ? comp : c))
          : [comp, ...list];
        return { ...prev, customCompetitions };
      });
      showToast(`تم حفظ البطولة "${comp.name}" ومزامنتها بنجاح`, 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const deleteCustomCompetition = useCallback(
    async (id: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        customCompetitions: (prev.customCompetitions || []).filter((c) => c.id !== id),
      }));
      showToast('تم حذف البطولة المخصصة', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  // السحابة والنسخ الاحتياطي والتحقق من النقل
  const createBackupSnapshotNow = useCallback((): PreMigrationBackupSnapshot => {
    const snap = createPreMigrationBackupSnapshot(data);
    setPreMigrationBackup(snap);
    showToast('تم إنشاء وحفظ نسخة احتياطية محلية محمية قبل النقل', 'emerald');
    return snap;
  }, [data, showToast]);

  const restorePreMigrationBackup = useCallback(async (): Promise<boolean> => {
    const snap = getPreMigrationBackupSnapshot() || preMigrationBackup;
    if (!snap || !snap.state) {
      showToast('لا توجد نسخة احتياطية محفوظة للاستعادة', 'crimson');
      return false;
    }
    await commitState(() => snap.state);
    showToast(`تمت استعادة النسخة الاحتياطية (${snap.backupId}) بنجاح`, 'emerald');
    return true;
  }, [commitState, preMigrationBackup, showToast]);

  const migrateLocalDataToCloudVerified =
    useCallback(async (): Promise<MigrationVerificationReport> => {
      const snap = createPreMigrationBackupSnapshot(data);
      setPreMigrationBackup(snap);

      if (!isFirebaseReady()) {
        const failedReport: MigrationVerificationReport = {
          ok: false,
          backupId: snap.backupId,
          backupCreatedAt: snap.createdAt,
          countsMatched: false,
          localCounts: snap.counts,
          cloudCounts: {
            competitionsCount: 0,
            teamsCount: 0,
            matchesCount: 0,
            standingsCount: 0,
            scorersCount: 0,
            goalkeepersCount: 0,
            articlesCount: 0,
            importsCount: 0,
          },
          migratedAt: new Date().toISOString(),
          error: 'غير متصل بـ Firebase؛ يرجى تفعيل الربط أولاً',
        };
        setLastMigrationReport(failedReport);
        showToast(failedReport.error!, 'crimson');
        return failedReport;
      }

      setCloudSyncStatus('syncing');
      setCloudConnectionState('connecting');

      const { report, mergedState } = await migrateLocalDataToFirestoreWithVerification(data);
      setLastMigrationReport(report);

      if (report.ok && report.countsMatched) {
        setData(mergedState);
        try {
          localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(mergedState));
        } catch {
          // ignore
        }
        saveStateToIndexedDB('main_app_state', mergedState).catch(() => {});
        setCloudSyncStatus('connected');
        setCloudConnectionState('connected');
        setCloudError(null);
        showToast(
          'تم نقل جميع البيانات المحلية إلى Firestore والتحقق من تطابق عدد السجلات 100%',
          'emerald'
        );
      } else {
        setCloudSyncStatus('error');
        setCloudConnectionState('failed');
        setCloudError(report.error || 'فشل التحقق من تطابق السجلات');
        showToast(report.error || 'تعذر إتمام النقل السحابي — النسخة المحلية محفوظة بأمان', 'crimson');
      }
      return report;
    }, [data, showToast]);

  const loginAdminWithFirebaseEmail = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      if (!isFirebaseReady()) {
        showToast('قم بتوصيل إعدادات Firebase أولاً قبل تسجيل الدخول السحابي', 'crimson');
        return false;
      }
      setCloudConnectionState('connecting');
      const res = await signInAdminWithFirebaseEmail(email, password);
      if (!res.ok) {
        setCloudConnectionState('failed');
        setCloudError(res.error || 'فشل تسجيل الدخول السحابي');
        showToast(res.error || 'فشل تسجيل الدخول عبر Firebase Auth', 'crimson');
        return false;
      }
      setFirebaseUserEmail(res.userEmail || email.trim());
      setIsAdminUnlocked(true);
      try {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'unlocked');
      } catch {
        // ignore
      }
      await pullDataFromCloudNow();
      setCloudConnectionState('connected');
      showToast(`تم تسجيل الدخول السحابي (${res.userEmail}) واسترجاع البيانات`, 'emerald');
      return true;
    },
    [pullDataFromCloudNow, showToast]
  );

  const logoutFirebaseAdmin = useCallback(async () => {
    await signOutFirebaseAdmin();
    setFirebaseUserEmail(null);
    showToast('تم تسجيل الخروج من جلسة Firebase Auth', 'amber');
  }, [showToast]);

  // السحابة والنسخ الاحتياطي
  const connectFirebase = useCallback(
    async (config: FirebaseCloudConfig) => {
      saveFirebaseConfig(config);
      const ok = await activateFirebase(config, true);
      if (ok) {
        const { report, mergedState } = await migrateLocalDataToFirestoreWithVerification(data);
        setLastMigrationReport(report);
        if (report.ok) {
          setData(mergedState);
          try {
            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(mergedState));
          } catch {
            // ignore
          }
          saveStateToIndexedDB('main_app_state', mergedState).catch(() => {});
        }
      }
      return ok;
    },
    [activateFirebase, data]
  );

  const disconnectFirebase = useCallback(async () => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (authUnsubRef.current) {
      authUnsubRef.current();
      authUnsubRef.current = null;
    }
    await teardownFirebaseCloud();
    saveFirebaseConfig(null);
    setCloudConfig(null);
    setCloudMode('local');
    setCloudConnectionState('local');
    setCloudSyncStatus('idle');
    setCloudError(null);
    setFirebaseUserEmail(null);
    showToast('تم التحويل إلى الوضع المحلي (بياناتك المحلية محفوظة بالكامل)', 'amber');
  }, [showToast]);

  const pushCurrentDataToCloud = useCallback(async () => {
    const report = await migrateLocalDataToCloudVerified();
    return report.ok;
  }, [migrateLocalDataToCloudVerified]);

  const exportBackupJson = useCallback(() => JSON.stringify(data, null, 2), [data]);

  const importBackupJson = useCallback(
    async (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText) as Partial<AppDataState>;
        if (!Array.isArray(parsed.articles) || !Array.isArray(parsed.matches)) {
          showToast('ملف النسخة الاحتياطية غير صالح', 'crimson');
          return false;
        }
        const { state: migrated } = migrateAppStateSafely(parsed, INITIAL_SEED_DATA);
        await commitState(() => migrated);
        showToast('تم استعادة النسخة الاحتياطية وترحيلها بأمان بنجاح', 'emerald');
        return true;
      } catch {
        showToast('صيغة JSON غير صحيحة', 'crimson');
        return false;
      }
    },
    [commitState, showToast]
  );

  // ============================================================================
  // الذكاء الإخباري (News Intelligence)، إدارة المصادر، طابور المراجعة وإعدادات WATEEN AI
  // ============================================================================
  const saveNewsSource = useCallback(
    async (source: NewsSourceConfig) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => {
        const list = prev.newsSources || getDefaultNewsSources();
        const exists = list.some((s) => s.id === source.id);
        const newsSources = exists
          ? list.map((s) => (s.id === source.id ? source : s))
          : [source, ...list];
        return { ...prev, newsSources };
      });
      showToast(`تم حفظ مصدر الأخبار "${source.name}" بنجاح`, 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const deleteNewsSource = useCallback(
    async (id: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        newsSources: (prev.newsSources || []).filter((s) => s.id !== id),
      }));
      showToast('تم حذف المصدر الإخباري', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const toggleNewsSourceEnabled = useCallback(
    async (id: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        newsSources: (prev.newsSources || getDefaultNewsSources()).map((s) =>
          s.id === id ? { ...s, enabled: !s.enabled } : s
        ),
      }));
      showToast('تم تحديث حالة تفعيل المصدر', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const toggleNewsSourceTrusted = useCallback(
    async (id: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        newsSources: (prev.newsSources || getDefaultNewsSources()).map((s) =>
          s.id === id ? { ...s, trustedForAutoPublish: !s.trustedForAutoPublish } : s
        ),
      }));
      showToast('تم تحديث درجة موثوقية المصدر للنشر التلقائي', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const updateAutomationSettings = useCallback(
    async (patch: Partial<WateenAutomationSettings>) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        automationSettings: {
          ...(prev.automationSettings || getDefaultAutomationSettings()),
          ...patch,
        },
      }));
      showToast('تم حفظ إعدادات محرك WATEEN AI والأتمتة بنجاح', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const ingestManualNewsOrRss = useCallback(
    async (params: {
      items: RawFetchedNewsItem[];
      sourceId?: string;
      sourceName?: string;
      sourceTrusted?: boolean;
    }): Promise<{ publishedCount: number; queuedCount: number; rejectedCount: number }> => {
      if (!isAdminUnlocked) {
        showToast('غير مصرح: يجب فتح قفل لوحة الإدارة أولاً', 'crimson');
        return { publishedCount: 0, queuedCount: 0, rejectedCount: 0 };
      }

      const settings = data.automationSettings || getDefaultAutomationSettings();
      const matchedSource =
        (data.newsSources || []).find((s) => s.id === params.sourceId) ||
        ({
          id: params.sourceId || 'src-manual',
          name: params.sourceName || 'مصدر رسمي مضاف يدوياً',
          region: 'jordan',
          method: 'rss',
          url: '',
          trustedForAutoPublish: Boolean(params.sourceTrusted),
          enabled: true,
          pollIntervalMinutes: 30,
        } as NewsSourceConfig);

      const published: NewsArticle[] = [];
      const queued: NewsArticle[] = [];
      let rejectedCount = 0;

      const runningExisting = [...data.articles];
      const runningQueued = [...(data.reviewQueueArticles || [])];

      for (const rawItem of params.items) {
        const res = processRawNewsItemForWateen({
          rawItem,
          source: matchedSource,
          settings,
          existingArticles: runningExisting,
          queuedArticles: runningQueued,
        });

        if (res.decision.publishStatus === 'auto_publish') {
          published.push(res.article);
          runningExisting.push(res.article);
        } else if (res.decision.publishStatus === 'review_queue') {
          queued.push(res.article);
          runningQueued.push(res.article);
        } else {
          rejectedCount += 1;
        }
      }

      if (published.length > 0 || queued.length > 0) {
        const auditEntry: ImportRevisionEntry = {
          id: `news-ing-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'الذكاء الإخباري WATEEN AI',
          action: 'NEWS_INTELLIGENCE_INGEST',
          details: `معالجة ${params.items.length} عناصر من (${matchedSource.name}): نُشر تلقائياً ${published.length}، أُرسل للمراجعة ${queued.length}، رُفض للتكرار/النقص ${rejectedCount}.`,
        };
        await commitState((prev) => ({
          ...prev,
          articles: [...published, ...prev.articles],
          reviewQueueArticles: [...queued, ...(prev.reviewQueueArticles || [])],
          auditLogs: [auditEntry, ...(prev.auditLogs || [])].slice(0, 150),
        }));
      }

      showToast(
        `النتيجة: نُشر ${published.length} • في طابور المراجعة ${queued.length} • مكرر/مرفوض ${rejectedCount}`,
        published.length > 0 ? 'emerald' : 'amber'
      );

      return {
        publishedCount: published.length,
        queuedCount: queued.length,
        rejectedCount,
      };
    },
    [commitState, data.articles, data.automationSettings, data.newsSources, data.reviewQueueArticles, isAdminUnlocked, showToast]
  );

  const runNewsIntelligenceNow = useCallback(async (): Promise<NewsCollectionCycleResult> => {
    const sources = data.newsSources || getDefaultNewsSources();
    const settings = data.automationSettings || getDefaultAutomationSettings();
    const result = await runNewsIntelligenceBatch({
      sources,
      existingArticles: data.articles,
      queuedArticles: data.reviewQueueArticles || [],
      settings,
    });

    const auditEntry: ImportRevisionEntry = {
      id: `news-run-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'جامع الأخبار WATEEN AI',
      action: 'NEWS_COLLECTION_CYCLE',
      details: `دورة فحص ${result.sourceUpdates.length} مصادر: نُشر ${result.published.length}، للمراجعة ${result.queued.length}، مرفوض ${result.rejected.length}.`,
    };

    await commitState((prev) => {
      const updatedSources = (prev.newsSources || getDefaultNewsSources()).map((src) => {
        const upd = result.sourceUpdates.find((u) => u.id === src.id);
        return upd ? { ...src, ...upd } : src;
      });
      return {
        ...prev,
        newsSources: updatedSources,
        articles: [...result.published, ...prev.articles],
        reviewQueueArticles: [...result.queued, ...(prev.reviewQueueArticles || [])],
        auditLogs: [auditEntry, ...(prev.auditLogs || [])].slice(0, 150),
      };
    });

    const failedSources = result.sourceUpdates.filter((u) => u.lastStatus === 'error').length;
    showToast(
      failedSources > 0 && result.published.length === 0 && result.queued.length === 0
        ? `تعذر الجلب المباشر من ${failedSources} مصادر من المتصفح (بسبب CORS/الشبكة) — يمكنك اللصق المباشر لخلاصة RSS أو التفعيل عبر Cloud Functions`
        : `اكتملت دورة الأخبار: نُشر ${result.published.length} • للمراجعة ${result.queued.length} • مرفوض ${result.rejected.length}`,
      result.published.length + result.queued.length > 0 ? 'emerald' : 'amber'
    );

    return result;
  }, [commitState, data.articles, data.automationSettings, data.newsSources, data.reviewQueueArticles, showToast]);

  const updateQueuedArticle = useCallback(
    async (article: NewsArticle) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => ({
        ...prev,
        reviewQueueArticles: (prev.reviewQueueArticles || []).map((q) =>
          q.id === article.id ? article : q
        ),
      }));
      showToast('تم حفظ تعديل مسودة الخبر في طابور المراجعة', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const approveQueuedArticle = useCallback(
    async (articleId: string) => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => {
        const queue = prev.reviewQueueArticles || [];
        const target = queue.find((q) => q.id === articleId);
        if (!target) return prev;
        const approvedArticle: NewsArticle = {
          ...target,
          publishStatus: 'auto_publish',
          verificationStatus: 'verified',
          isDemo: false,
          publishedAt: new Date().toISOString(),
        };
        const exists = prev.articles.some((a) => a.id === approvedArticle.id);
        const articles = exists
          ? prev.articles.map((a) => (a.id === approvedArticle.id ? approvedArticle : a))
          : [approvedArticle, ...prev.articles];
        const auditEntry: ImportRevisionEntry = {
          id: `aud-q-app-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'مدير النظام',
          action: 'APPROVE_QUEUED_NEWS',
          details: `اعتماد ونشر خبر من طابور المراجعة: "${approvedArticle.title}" (المصدر: ${approvedArticle.sourceName || 'غير محدد'})`,
        };
        return {
          ...prev,
          articles,
          reviewQueueArticles: queue.filter((q) => q.id !== articleId),
          auditLogs: [auditEntry, ...(prev.auditLogs || [])].slice(0, 150),
        };
      });
      showToast('تم اعتماد الخبر ونشره فوراً في التطبيق', 'emerald');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const rejectQueuedArticle = useCallback(
    async (articleId: string, reason = 'غير مناسب للنشر') => {
      if (!isAdminUnlocked) return;
      await commitState((prev) => {
        const queue = prev.reviewQueueArticles || [];
        const target = queue.find((q) => q.id === articleId);
        const auditEntry: ImportRevisionEntry = {
          id: `aud-q-rej-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'مدير النظام',
          action: 'REJECT_QUEUED_NEWS',
          details: `رفض خبر من طابور المراجعة: "${target?.title || articleId}" — السبب: ${reason}`,
        };
        return {
          ...prev,
          reviewQueueArticles: queue.filter((q) => q.id !== articleId),
          auditLogs: [auditEntry, ...(prev.auditLogs || [])].slice(0, 150),
        };
      });
      showToast('تم رفض الخبر وإزالته من طابور المراجعة', 'amber');
    },
    [commitState, isAdminUnlocked, showToast]
  );

  const resetToDemoData = useCallback(async () => {
    await commitState((prev) => {
      const { state: freshSeed } = migrateAppStateSafely(null, {
        ...INITIAL_SEED_DATA,
        adminPin: prev.adminPin,
      });
      return freshSeed;
    });
    showToast('تمت استعادة البيانات الرياضية الأردنية الأولية للعرض', 'amber');
  }, [commitState, showToast]);

  return (
    <AppDataContext.Provider
      value={{
        data,
        cloudMode,
        cloudConnectionState,
        cloudConfig,
        cloudSyncStatus,
        cloudError,
        firebaseUserEmail,
        preMigrationBackup,
        lastMigrationReport,
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
        recordMatchEvent,
        saveStandingRow,
        deleteStandingRow,
        saveScorer,
        deleteScorer,
        saveGoalkeeper,
        deleteGoalkeeper,
        saveInjuryReport,
        deleteInjuryReport,
        updateTeamDirectoryItem,
        saveCompetitionRule,
        saveCustomCompetition,
        deleteCustomCompetition,
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
        pullDataFromCloudNow,
        migrateLocalDataToCloudVerified,
        createBackupSnapshotNow,
        restorePreMigrationBackup,
        loginAdminWithFirebaseEmail,
        logoutFirebaseAdmin,
        exportBackupJson,
        importBackupJson,
        resetToDemoData,
        saveNewsSource,
        deleteNewsSource,
        toggleNewsSourceEnabled,
        toggleNewsSourceTrusted,
        updateAutomationSettings,
        ingestManualNewsOrRss,
        runNewsIntelligenceNow,
        updateQueuedArticle,
        approveQueuedArticle,
        rejectQueuedArticle,
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
