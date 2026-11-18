import { AppDataState } from '../types/sports';

export const LOCAL_DATA_KEY = 'wateen_sport_data_v1';
export const PRE_MIGRATION_BACKUP_KEY = 'wateen_sport_pre_migration_backup_v1';
const IDB_NAME = 'WateenSportPersistentDB';
const IDB_STORE = 'app_state_store';
const IDB_VERSION = 1;

export interface RecordCountsManifest {
  competitionsCount: number;
  teamsCount: number;
  matchesCount: number;
  standingsCount: number;
  scorersCount: number;
  goalkeepersCount: number;
  articlesCount: number;
  importsCount: number;
}

export interface PreMigrationBackupSnapshot {
  backupId: string;
  createdAt: string;
  counts: RecordCountsManifest;
  checksum: string;
  state: AppDataState;
}

export interface MigrationVerificationReport {
  ok: boolean;
  backupId: string;
  backupCreatedAt: string;
  countsMatched: boolean;
  localCounts: RecordCountsManifest;
  cloudCounts: RecordCountsManifest;
  migratedAt: string;
  error?: string;
}

/**
 * حساب عدد السجلات الفعلي في كل قسم للمطابقة الدقيقة قبل وبعد النقل السحابي
 */
export function computeStateRecordCounts(state: AppDataState): RecordCountsManifest {
  return {
    competitionsCount:
      Object.keys(state.competitionRules || {}).length +
      (state.customCompetitions?.length || 0),
    teamsCount: state.teamsDirectory?.length || 0,
    matchesCount: state.matches?.length || 0,
    standingsCount: state.standings?.length || 0,
    scorersCount: state.scorers?.length || 0,
    goalkeepersCount: state.goalkeepers?.length || 0,
    articlesCount: state.articles?.length || 0,
    importsCount: state.importBatches?.length || 0,
  };
}

/**
 * التحقق من تطابق عدد السجلات بين النسخة المحلية والنسخة السحابية بعد النقل
 */
export function verifyRecordCountsMatch(
  localCounts: RecordCountsManifest,
  cloudCounts: RecordCountsManifest
): boolean {
  return (
    cloudCounts.competitionsCount >= localCounts.competitionsCount &&
    cloudCounts.teamsCount >= localCounts.teamsCount &&
    cloudCounts.matchesCount >= localCounts.matchesCount &&
    cloudCounts.standingsCount >= localCounts.standingsCount &&
    cloudCounts.scorersCount >= localCounts.scorersCount &&
    cloudCounts.goalkeepersCount >= localCounts.goalkeepersCount &&
    cloudCounts.articlesCount >= localCounts.articlesCount
  );
}

function computeSimpleChecksum(state: AppDataState): string {
  const counts = computeStateRecordCounts(state);
  const raw = `${counts.competitionsCount}:${counts.teamsCount}:${counts.matchesCount}:${counts.standingsCount}:${counts.scorersCount}:${counts.goalkeepersCount}:${counts.articlesCount}:${state.updatedAt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `chk-${Math.abs(hash).toString(16)}`;
}

/**
 * إنشاء نسخة احتياطية كاملة قابلة للاستعادة قبل أي عملية نقل إلى Firestore
 */
export function createPreMigrationBackupSnapshot(
  currentState: AppDataState
): PreMigrationBackupSnapshot {
  const counts = computeStateRecordCounts(currentState);
  const snapshot: PreMigrationBackupSnapshot = {
    backupId: `bkp-${Date.now()}`,
    createdAt: new Date().toISOString(),
    counts,
    checksum: computeSimpleChecksum(currentState),
    state: JSON.parse(JSON.stringify(currentState)) as AppDataState,
  };

  try {
    localStorage.setItem(PRE_MIGRATION_BACKUP_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota error
  }

  saveStateToIndexedDB('pre_migration_backup', snapshot).catch(() => {});
  return snapshot;
}

/**
 * قراءة النسخة الاحتياطية المحفوظة ما قبل النقل
 */
export function getPreMigrationBackupSnapshot(): PreMigrationBackupSnapshot | null {
  try {
    const raw = localStorage.getItem(PRE_MIGRATION_BACKUP_KEY);
    if (raw) {
      return JSON.parse(raw) as PreMigrationBackupSnapshot;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * حفظ واسترجاع البيانات عبر IndexedDB لضمان بقاء البيانات حتى عند إغلاق التطبيق أو امتلاء localStorage
 */
function openPersistentIDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveStateToIndexedDB(key: string, value: unknown): Promise<boolean> {
  const db = await openPersistentIDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function loadStateFromIndexedDB<T>(key: string): Promise<T | null> {
  const db = await openPersistentIDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as T) || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/**
 * دمج البيانات المحلية مع السحابية بدون تكرار أو فقدان أي بطولة أو مباراة أو نتيجة (Idempotent Merge)
 */
export function mergeStatesWithoutDuplication(
  localState: AppDataState,
  cloudState: AppDataState
): AppDataState {
  const mergeById = <T extends { id: string }>(localArr: T[] = [], cloudArr: T[] = []): T[] => {
    const map = new Map<string, T>();
    for (const item of localArr) {
      if (item && item.id) map.set(item.id, item);
    }
    for (const item of cloudArr) {
      if (item && item.id) map.set(item.id, item);
    }
    return Array.from(map.values());
  };

  return {
    ...localState,
    ...cloudState,
    schemaVersion: Math.max(localState.schemaVersion || 1, cloudState.schemaVersion || 1),
    customCompetitions: mergeById(
      localState.customCompetitions || [],
      cloudState.customCompetitions || []
    ),
    competitionRules: {
      ...(localState.competitionRules || {}),
      ...(cloudState.competitionRules || {}),
    },
    teamsDirectory: mergeById(
      localState.teamsDirectory || [],
      cloudState.teamsDirectory || []
    ),
    matches: mergeById(localState.matches || [], cloudState.matches || []),
    standings: mergeById(localState.standings || [], cloudState.standings || []),
    standingsHistory: mergeById(
      localState.standingsHistory || [],
      cloudState.standingsHistory || []
    ).slice(0, 150),
    scorers: mergeById(localState.scorers || [], cloudState.scorers || []),
    goalkeepers: mergeById(localState.goalkeepers || [], cloudState.goalkeepers || []),
    injuries: mergeById(localState.injuries || [], cloudState.injuries || []),
    articles: mergeById(localState.articles || [], cloudState.articles || []),
    reviewQueueArticles: mergeById(
      localState.reviewQueueArticles || [],
      cloudState.reviewQueueArticles || []
    ),
    newsSources: mergeById(localState.newsSources || [], cloudState.newsSources || []),
    banners: mergeById(localState.banners || [], cloudState.banners || []),
    cards: mergeById(localState.cards || [], cloudState.cards || []),
    liveStreams: mergeById(localState.liveStreams || [], cloudState.liveStreams || []),
    importBatches: mergeById(localState.importBatches || [], cloudState.importBatches || []),
    auditLogs: mergeById(localState.auditLogs || [], cloudState.auditLogs || []).slice(0, 150),
    notifications: mergeById(localState.notifications || [], cloudState.notifications || []).slice(
      0,
      50
    ),
    automationSettings: cloudState.automationSettings || localState.automationSettings,
    updatedAt: new Date().toISOString(),
  };
}
