// النماذج البرمجية الأساسية لتطبيق وتين سبورت (Wateen Sport) + نظام الإدخال الذكي وإدارة البطولات

export type CompetitionId =
  | 'pro_league'
  | 'first_div'
  | 'second_div'
  | 'third_div'
  | 'youth_u20'
  | 'youth_u17'
  | 'youth_u15'
  | 'youth_grassroots'
  | 'womens_league'
  | 'jordan_cup'
  | 'national_teams'
  | 'general';

export type MainCompetitionGroup =
  | 'pro_league'
  | 'first_div'
  | 'second_div'
  | 'third_div'
  | 'youth'
  | 'womens_league'
  | 'jordan_cup'
  | 'national_teams';

export type NewsCategoryTag =
  | 'club_news'
  | 'transfers'
  | 'injuries'
  | 'tactical_analysis'
  | 'match_report'
  | 'official';

export interface StatPair {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface NewsArticle {
  id: string;
  title: string;
  originalTitle?: string;
  originalContent?: string;
  summary: string;
  content: string;
  competitionId: CompetitionId;
  tag: NewsCategoryTag;
  isBreaking: boolean;
  imageUrl: string;
  imageRightsNote?: string;
  author: string;
  sourceName?: string;
  sourceUrl?: string;
  collectedAt?: string;
  publishedAt: string; // ISO string
  relatedTeamId?: string;
  relatedPlayerId?: string;
  editorialType?: 'confirmed_news' | 'analysis' | 'prediction' | 'opinion';
  verificationStatus?: 'verified' | 'pending_review' | 'rejected';
  confidenceScore?: number;
  publishStatus?: 'auto_published' | 'manual_published' | 'pending_review' | 'rejected' | 'draft';
  isDemo?: boolean;
  views: number;
  statsCard?: {
    title: string;
    subtitle?: string;
    items: StatPair[];
  };
  relatedMatchId?: string;
}

// دعم حالات المباريات الشاملة (8 حالات): لم تبدأ، مباشرة، الشوط الأول، الاستراحة، الشوط الثاني، انتهت، مؤجلة، ملغاة
export type MatchStatus =
  | 'live'
  | 'first_half'
  | 'halftime'
  | 'second_half'
  | 'upcoming'
  | 'finished'
  | 'postponed'
  | 'cancelled';

export interface MatchEvent {
  id: string;
  minute: number;
  team: 'home' | 'away';
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution';
  playerName: string;
  detail?: string;
}

export interface MatchStats {
  possessionHome: number;
  shotsHome: number;
  shotsAway: number;
  shotsOnTargetHome: number;
  shotsOnTargetAway: number;
  cornersHome: number;
  cornersAway: number;
  foulsHome: number;
  foulsAway: number;
}

export interface MatchItem {
  id: string;
  competitionId: CompetitionId;
  season?: string;
  ageCategory?: string;
  groupName?: string;
  round: string;
  homeTeamId?: string;
  homeTeam: string;
  homeShort: string;
  homeColor: string;
  awayTeamId?: string;
  awayTeam: string;
  awayShort: string;
  awayColor: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  liveMinute?: number;
  kickoffIso: string; // بتوقيت عمّان عند العرض
  stadium: string;
  referee?: string;
  broadcast?: string;
  liveStreamUrl?: string;
  postponedReason?: string;
  featured?: boolean;
  isApproved?: boolean;
  isDemo?: boolean;
  sourceName?: string;
  importBatchId?: string;
  events: MatchEvent[];
  stats?: MatchStats;
}

export type StreamPlatform = 'youtube' | 'facebook' | 'other';

export interface LiveStreamItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  platform: StreamPlatform;
  competitionId: CompetitionId;
  isLive: boolean;
  createdAt: string;
}

export type StandingZone = 'champion' | 'continental' | 'promotion' | 'relegation' | 'none';

export interface StandingRow {
  id: string;
  competitionId: CompetitionId;
  season?: string;
  groupName?: string;
  teamId?: string;
  teamName: string;
  shortName: string;
  teamColor: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  pointsDeducted?: number;
  position?: number;
  manualAdjustmentReason?: string;
  isDemo?: boolean;
  form: ('W' | 'D' | 'L')[];
  zone?: StandingZone;
}

export interface StandingsHistoryEntry {
  id: string;
  competitionId: CompetitionId;
  season: string;
  recordedAt: string;
  reason: string;
  actor: string;
  snapshot: {
    teamId?: string;
    teamName: string;
    position: number;
    played: number;
    points: number;
    goalDifference: number;
  }[];
}

export interface TopScorer {
  id: string;
  competitionId: CompetitionId;
  season?: string;
  teamId?: string;
  playerName: string;
  photoUrl?: string;
  teamName: string;
  teamColor: string;
  shirtNumber?: number;
  minutesPlayed?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
  rating?: number | null;
  goals: number;
  assists: number;
  matches: number;
  position?: string;
  isDemo?: boolean;
}

// إحصائيات حراس المرمى (الشباك النظيفة والأهداف المستقبلة)
export interface GoalkeeperStat {
  id: string;
  competitionId: CompetitionId;
  season?: string;
  teamId?: string;
  playerName: string;
  teamName: string;
  teamColor: string;
  matches: number;
  cleanSheets: number;
  goalsConceded: number;
  saves?: number | null;
  isDemo?: boolean;
}

// القسم الطبي الإخباري: الإصابات والجاهزية
export interface InjuryReportItem {
  id: string;
  playerId?: string;
  playerName: string;
  teamId?: string;
  teamName: string;
  competitionId: CompetitionId;
  declaredInjury: string;
  announcedDate: string;
  lastUpdatedAt: string;
  declaredAbsenceDuration: string; // أو "غير محدد رسمياً"
  returnStatus: 'injured' | 'rehab' | 'light_training' | 'fit_to_play' | 'unknown';
  sourceName: string;
  sourceUrl?: string;
  isVerifiedOfficial: boolean;
}

// مصادر الأخبار الرسمية (أردنية، عربية، عالمية)
export interface NewsSourceConfig {
  id: string;
  name: string;
  region: 'jordan' | 'arab' | 'global';
  method: 'rss' | 'official_api' | 'open_data' | 'manual_verified';
  url: string;
  trustedForAutoPublish: boolean;
  enabled: boolean;
  pollIntervalMinutes: number;
  lastCheckedAt?: string;
  lastStatus?: 'ok' | 'error' | 'idle';
  lastError?: string;
}

// إعدادات محرك WATEEN AI والأتمتة وحدود التكلفة
export interface WateenAutomationSettings {
  aiProvider: 'openai' | 'gemini' | 'server_proxy';
  aiModel: string;
  autoPublishEnabled: boolean;
  allowedAutoPublishTags: NewsCategoryTag[];
  newsPollIntervalMinutes: number;
  matchesPollIntervalMinutes: number;
  monthlyBudgetUsd: number;
  dailyRequestsLimit: number;
  dailyRequestsUsed: number;
  monthlySpentEstimateUsd: number;
  pauseOnBudgetExceeded: boolean;
  lastAutomationRunAt?: string;
}

// معايير كسر التعادل القابلة للتخصيص لكل بطولة
export type TieBreakerCriterion =
  | 'head_to_head_points'
  | 'head_to_head_gd'
  | 'goal_difference'
  | 'goals_for'
  | 'wins';

// قواعد البطولة القابلة للإعداد من لوحة الإدارة
export interface CompetitionRuleConfig {
  competitionId: CompetitionId;
  season: string;
  ageCategory: string;
  groups: string[];
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  championSpots: number;
  continentalSpots: number;
  promotionSpots: number;
  relegationSpots: number;
  tiebreakers: TieBreakerCriterion[];
  updatedAt: string;
}

// سجل الفرق المعتمدة والمرادفات الذكية
export interface TeamDirectoryItem {
  id: string;
  name: string;
  shortName: string;
  color: string;
  competitionId: CompetitionId;
  groupName?: string;
  city?: string;
  stadium?: string;
  aliases: string[];
}

// ============================================================================
// نماذج مركز الإدخال الذكي (AI Sports Data Import) والمراجعة والاعتماد
// ============================================================================

export type SmartImportDataType =
  | 'standings_table'
  | 'match_schedule'
  | 'match_results'
  | 'teams_list'
  | 'players_list'
  | 'top_scorers'
  | 'goalkeepers_stats'
  | 'players_stats'
  | 'rounds_data';

export type ImportSourceFormat = 'image' | 'pdf' | 'excel_csv' | 'pasted_text';

export type ImportBatchStatus =
  | 'Pending Review'
  | 'Needs Correction'
  | 'Approved'
  | 'Rejected'
  | 'Published';

export interface ImportedRowIssue {
  field: string;
  type: 'unclear' | 'missing' | 'unknown_team' | 'duplicate' | 'conflict' | 'warning';
  blocking: boolean;
  message: string;
  suggestedTeamName?: string;
}

/**
 * المخطط الموحد للمباراة والصف المستخرج (Unified Match & Sports Row Schema)
 */
export interface SmartImportExtractedRow {
  rowId: string;
  sourceFileName: string;
  tableIndex?: number;
  tableTitle?: string;

  // الحقول الإلزامية الموحدة للمباراة
  competitionName?: string;
  season?: string;
  ageCategory?: string;
  groupName?: string;
  roundNumber?: string;
  round?: string;
  matchDate?: string;
  matchTime?: string;
  kickoffTime?: string;
  stadium?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number | string | null;
  awayScore?: number | string | null;
  matchStatus?: MatchStatus;
  status?: MatchStatus;
  sourceReference?: string;
  extractionConfidence?: number; // 0..100
  validationWarnings?: string[];

  // حقول الترتيب واللاعبين والحراس
  teamName?: string;
  played?: number | string | null;
  won?: number | string | null;
  drawn?: number | string | null;
  lost?: number | string | null;
  goalsFor?: number | string | null;
  goalsAgainst?: number | string | null;
  points?: number | string | null;
  playerName?: string;
  playerPosition?: string;
  goals?: number | string | null;
  assists?: number | string | null;
  matches?: number | string | null;
  cleanSheets?: number | string | null;
  goalsConceded?: number | string | null;
  city?: string;

  // حالة التحقق البرمجي للصف
  isUnclear: boolean;
  isDuplicate: boolean;
  hasConflict: boolean;
  isReadyForApproval?: boolean;
  isApprovedRow?: boolean;
  unknownTeams: string[];
  issues: ImportedRowIssue[];
}

/**
 * سجل تشخيصي للمطور (Developer Diagnostic Debug Log)
 */
export interface ImportDiagnosticLog {
  timestamp: string;
  fileTypes: string[];
  extractedText: string;
  rawAiResponseSanitized: string;
  jsonItemsCount: number;
  parsedObjectsCount: number;
  readyObjectsCount: number;
  needsCorrectionCount: number;
  failedValidationFields: { rowIndex: number; field: string; reason: string }[];
  approvalRejectionReasons: string[];
  parseErrors: string[];
}

export interface ImportSourceFileMeta {
  id: string;
  name: string;
  mimeType: string;
  format: ImportSourceFormat;
  previewDataUrl?: string;
  rawTextPreview?: string;
  sizeBytes: number;
}

export interface ImportRevisionEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export interface SmartImportBatch {
  id: string;
  dataType: SmartImportDataType;
  competitionId: CompetitionId;
  season: string;
  ageCategory: string;
  groupName: string;
  roundName?: string;
  status: ImportBatchStatus;
  sources: ImportSourceFileMeta[];
  rawPastedText?: string;
  rows: SmartImportExtractedRow[];
  usedEngine: 'gemini_multimodal' | 'smart_deterministic';
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  diagnosticLog?: ImportDiagnosticLog;
  revisions: ImportRevisionEntry[];
}

export interface HeroBanner {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  accentColor: string;
  active: boolean;
  linkedArticleId?: string;
  linkedCompetitionId?: CompetitionId;
  order: number;
}

export type AutoTemplateCardType =
  | 'matchday'
  | 'player_spotlight'
  | 'transfer_alert'
  | 'tactical_stat'
  | 'match_card'
  | 'result_card'
  | 'standings_card'
  | 'round_fixtures_card'
  | 'top_scorers_card'
  | 'goalkeepers_card'
  | 'mvp_player_card';

export interface SportsGraphicCard {
  id: string;
  type: AutoTemplateCardType;
  kicker: string;
  title: string;
  subtitle: string;
  competitionId: CompetitionId;
  imageUrl: string;
  accent: 'emerald' | 'crimson' | 'gold' | 'sky';
  metrics: StatPair[];
  tableRows?: string[][];
  isApprovedSource?: boolean;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'breaking' | 'match_result' | 'announcement';
  competitionId?: CompetitionId;
  createdAt: string;
  sentViaCloud: boolean;
}

export interface FirebaseCloudConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface CustomCompetitionItem {
  id: string;
  name: string;
  shortName: string;
  season: string;
  ageCategory: string;
  tierLabel: string;
  parentCompetitionId: CompetitionId;
  groups: string[];
  createdAt: string;
}

export type CloudConnectionState = 'local' | 'connecting' | 'connected' | 'failed';

export interface AppDataState {
  schemaVersion?: number;
  articles: NewsArticle[];
  reviewQueueArticles?: NewsArticle[];
  newsSources?: NewsSourceConfig[];
  matches: MatchItem[];
  standings: StandingRow[];
  standingsHistory?: StandingsHistoryEntry[];
  scorers: TopScorer[];
  goalkeepers?: GoalkeeperStat[];
  injuries?: InjuryReportItem[];
  teamsDirectory?: TeamDirectoryItem[];
  competitionRules?: Record<string, CompetitionRuleConfig>;
  customCompetitions?: CustomCompetitionItem[];
  importBatches?: SmartImportBatch[];
  auditLogs?: ImportRevisionEntry[];
  automationSettings?: WateenAutomationSettings;
  banners: HeroBanner[];
  cards: SportsGraphicCard[];
  liveStreams: LiveStreamItem[];
  notifications: AppNotification[];
  adminPin: string;
  geminiApiKey?: string;
  updatedAt: string;
}

export type NavTab = 'home' | 'competitions' | 'results' | 'admin';
