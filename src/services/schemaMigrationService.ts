import {
  AppDataState,
  NewsSourceConfig,
  WateenAutomationSettings,
} from '../types/sports';
import {
  getDefaultCompetitionRules,
  INITIAL_JORDAN_TEAMS_DIRECTORY,
} from '../constants/competitions';
import { generateDeterministicTeamId } from '../utils/deterministicIds';

export const CURRENT_SCHEMA_VERSION = 2;

export function getDefaultAutomationSettings(): WateenAutomationSettings {
  const nowIso = new Date().toISOString();
  return {
    aiProvider: 'openai',
    aiModel: 'gpt-4o-mini',
    autoPublishEnabled: false, // افتراضياً يتطلب مراجعة المدير لحين تفعيل المصادر الموثوقة
    allowedAutoPublishTags: ['official', 'match_report', 'club_news'],
    newsPollIntervalMinutes: 30,
    matchesPollIntervalMinutes: 15,
    monthlyBudgetUsd: 10,
    dailyRequestsLimit: 120,
    dailyRequestsUsed: 0,
    monthlySpentEstimateUsd: 0,
    pauseOnBudgetExceeded: true,
    automationEnabled: true,
    cacheTtlMinutes: 20,
    maxRetryAttempts: 2,
    lastBudgetResetDate: nowIso.slice(0, 10),
    lastMonthlyResetMonth: nowIso.slice(0, 7),
    totalCacheHits: 0,
    sourceCacheHashes: {},
  };
}

export function getDefaultNewsSources(): NewsSourceConfig[] {
  return [
    {
      id: 'src-jfa-official',
      name: 'الاتحاد الأردني لكرة القدم (JFA)',
      region: 'jordan',
      method: 'rss',
      url: 'https://www.jfa.jo/rss',
      trustedForAutoPublish: true,
      enabled: true,
      pollIntervalMinutes: 30,
      lastStatus: 'idle',
    },
    {
      id: 'src-petra-sports',
      name: 'وكالة الأنباء الأردنية (بترا) — الرياضة',
      region: 'jordan',
      method: 'rss',
      url: 'https://petra.gov.jo/Include/InnerPage.jsp?ID=sports&lang=ar&name=rss',
      trustedForAutoPublish: true,
      enabled: true,
      pollIntervalMinutes: 30,
      lastStatus: 'idle',
    },
    {
      id: 'src-alghad-sports',
      name: 'صحيفة الغد الأردنية — القسم الرياضي',
      region: 'jordan',
      method: 'rss',
      url: 'https://alghad.com/section/%d8%b1%d9%8a%d8%a7%d8%b6%d8%a9/feed/',
      trustedForAutoPublish: false,
      enabled: true,
      pollIntervalMinutes: 45,
      lastStatus: 'idle',
    },
    {
      id: 'src-alrai-sports',
      name: 'صحيفة الرأي الأردنية — الرياضة',
      region: 'jordan',
      method: 'rss',
      url: 'https://alrai.com/rss/sports',
      trustedForAutoPublish: false,
      enabled: true,
      pollIntervalMinutes: 45,
      lastStatus: 'idle',
    },
    {
      id: 'src-kooora-arab',
      name: 'مصادر البطولات العربية والاتحاد العربي',
      region: 'arab',
      method: 'rss',
      url: 'https://www.uafaac.com/feed/',
      trustedForAutoPublish: false,
      enabled: true,
      pollIntervalMinutes: 60,
      lastStatus: 'idle',
    },
    {
      id: 'src-fifa-global',
      name: 'الاتحاد الدولي والآسيوي (AFC / FIFA)',
      region: 'global',
      method: 'rss',
      url: 'https://www.the-afc.com/en/rss.xml',
      trustedForAutoPublish: false,
      enabled: true,
      pollIntervalMinutes: 60,
      lastStatus: 'idle',
    },
  ];
}

/**
 * محرك الترحيل الآمن لقاعدة البيانات عند تحديث التطبيق (APK Upgrade Safe Migration):
 * - لا يحذف أي سجل موجود أبداً
 * - لا يعيد إنشاء قاعدة البيانات من الصفر عند وجود بيانات للمستخدم
 * - يربط المعرفات الثابتة (teamId, homeTeamId, awayTeamId) بالسجلات القديمة بأمان
 */
export function migrateAppStateSafely(
  rawInput: Partial<AppDataState> | null | undefined,
  fallbackSeed: AppDataState
): {
  state: AppDataState;
  didMigrate: boolean;
  fromVersion: number;
  toVersion: number;
} {
  // إذا كان التشغيل الأول تماماً بدون أي بيانات سابقة، نعيد حالة البداية مع وسم العناصر الأولية بـ isDemo: true
  if (!rawInput || (!Array.isArray(rawInput.articles) && !Array.isArray(rawInput.matches))) {
    const cleanSeed: AppDataState = {
      ...fallbackSeed,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      articles: (fallbackSeed.articles || []).map((a) => ({ ...a, isDemo: true })),
      matches: (fallbackSeed.matches || []).map((m) => ({
        ...m,
        homeTeamId: m.homeTeamId || generateDeterministicTeamId(m.homeTeam),
        awayTeamId: m.awayTeamId || generateDeterministicTeamId(m.awayTeam),
        isDemo: true,
      })),
      standings: (fallbackSeed.standings || []).map((s) => ({
        ...s,
        teamId: s.teamId || generateDeterministicTeamId(s.teamName),
        isDemo: true,
      })),
      scorers: (fallbackSeed.scorers || []).map((sc) => ({
        ...sc,
        teamId: sc.teamId || generateDeterministicTeamId(sc.teamName),
        isDemo: true,
      })),
      goalkeepers: (fallbackSeed.goalkeepers || []).map((gk) => ({
        ...gk,
        teamId: gk.teamId || generateDeterministicTeamId(gk.teamName),
        isDemo: true,
      })),
      reviewQueueArticles: [],
      newsSources: getDefaultNewsSources(),
      standingsHistory: [],
      injuries: [],
      automationSettings: getDefaultAutomationSettings(),
      customCompetitions: fallbackSeed.customCompetitions || [],
      competitionRules: fallbackSeed.competitionRules || getDefaultCompetitionRules(),
      teamsDirectory: fallbackSeed.teamsDirectory || INITIAL_JORDAN_TEAMS_DIRECTORY,
      importBatches: [],
      auditLogs: [],
    };
    return {
      state: cleanSeed,
      didMigrate: false,
      fromVersion: CURRENT_SCHEMA_VERSION,
      toVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  const fromVersion = typeof rawInput.schemaVersion === 'number' ? rawInput.schemaVersion : 1;
  const didMigrate = fromVersion < CURRENT_SCHEMA_VERSION;

  // الحفاظ التام على جميع بيانات المستخدم الموجودة وإثرائها بالحقول الجديدة فقط
  const migratedMatches = (rawInput.matches || []).map((m) => ({
    ...m,
    homeTeamId: m.homeTeamId || generateDeterministicTeamId(m.homeTeam),
    awayTeamId: m.awayTeamId || generateDeterministicTeamId(m.awayTeam),
  }));

  const migratedStandings = (rawInput.standings || []).map((s) => ({
    ...s,
    teamId: s.teamId || generateDeterministicTeamId(s.teamName),
  }));

  const migratedScorers = (rawInput.scorers || []).map((sc) => ({
    ...sc,
    teamId: sc.teamId || generateDeterministicTeamId(sc.teamName),
  }));

  const migratedGoalkeepers = (
    Array.isArray(rawInput.goalkeepers) ? rawInput.goalkeepers : fallbackSeed.goalkeepers || []
  ).map((gk) => ({
    ...gk,
    teamId: gk.teamId || generateDeterministicTeamId(gk.teamName),
  }));

  const migratedAuditLogs = Array.isArray(rawInput.auditLogs) ? [...rawInput.auditLogs] : [];
  if (didMigrate) {
    migratedAuditLogs.unshift({
      id: `mig-${fromVersion}-to-${CURRENT_SCHEMA_VERSION}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'نظام الترحيل الآمن',
      action: 'SCHEMA_MIGRATION_COMPLETED',
      details: `تمت ترقية هيكل قاعدة البيانات بأمان من الإصدار v${fromVersion} إلى v${CURRENT_SCHEMA_VERSION} مع الحفاظ على ${migratedMatches.length} مباراة و${migratedStandings.length} صف ترتيب و${(rawInput.articles || []).length} خبر.`,
    });
  }

  const migratedState: AppDataState = {
    ...fallbackSeed,
    ...rawInput,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    articles: Array.isArray(rawInput.articles) ? rawInput.articles : fallbackSeed.articles,
    reviewQueueArticles: Array.isArray(rawInput.reviewQueueArticles)
      ? rawInput.reviewQueueArticles
      : [],
    newsSources:
      Array.isArray(rawInput.newsSources) && rawInput.newsSources.length > 0
        ? rawInput.newsSources
        : getDefaultNewsSources(),
    matches: migratedMatches,
    standings: migratedStandings,
    standingsHistory: Array.isArray(rawInput.standingsHistory) ? rawInput.standingsHistory : [],
    scorers: migratedScorers,
    goalkeepers: migratedGoalkeepers,
    injuries: Array.isArray(rawInput.injuries) ? rawInput.injuries : [],
    teamsDirectory:
      Array.isArray(rawInput.teamsDirectory) && rawInput.teamsDirectory.length > 0
        ? rawInput.teamsDirectory
        : INITIAL_JORDAN_TEAMS_DIRECTORY,
    competitionRules: rawInput.competitionRules
      ? { ...getDefaultCompetitionRules(), ...rawInput.competitionRules }
      : getDefaultCompetitionRules(),
    customCompetitions: Array.isArray(rawInput.customCompetitions)
      ? rawInput.customCompetitions
      : [],
    importBatches: Array.isArray(rawInput.importBatches) ? rawInput.importBatches : [],
    auditLogs: migratedAuditLogs.slice(0, 150),
    automationSettings: rawInput.automationSettings
      ? { ...getDefaultAutomationSettings(), ...rawInput.automationSettings }
      : getDefaultAutomationSettings(),
    automationAlerts: Array.isArray(rawInput.automationAlerts) ? rawInput.automationAlerts.slice(0, 80) : [],
    lastSyncSuccessAt: rawInput.lastSyncSuccessAt,
    liveStreams: Array.isArray(rawInput.liveStreams)
      ? rawInput.liveStreams
      : fallbackSeed.liveStreams,
    adminPin: rawInput.adminPin || fallbackSeed.adminPin,
    updatedAt: rawInput.updatedAt || new Date().toISOString(),
  };

  return {
    state: migratedState,
    didMigrate,
    fromVersion,
    toVersion: CURRENT_SCHEMA_VERSION,
  };
}
