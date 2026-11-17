// النماذج البرمجية الأساسية لتطبيق وتين سبورت (Wateen Sport)

export type CompetitionId =
  | 'pro_league'
  | 'first_div'
  | 'second_div'
  | 'third_div'
  | 'youth_u20'
  | 'youth_u17'
  | 'youth_u15'
  | 'youth_grassroots'
  | 'jordan_cup'
  | 'national_teams'
  | 'general';

export type MainCompetitionGroup =
  | 'pro_league'
  | 'first_div'
  | 'second_div'
  | 'third_div'
  | 'youth'
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
  summary: string;
  content: string;
  competitionId: CompetitionId;
  tag: NewsCategoryTag;
  isBreaking: boolean;
  imageUrl: string;
  author: string;
  publishedAt: string; // ISO string
  views: number;
  statsCard?: {
    title: string;
    subtitle?: string;
    items: StatPair[];
  };
  relatedMatchId?: string;
}

export type MatchStatus = 'live' | 'upcoming' | 'finished';

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
  round: string;
  homeTeam: string;
  homeShort: string;
  homeColor: string;
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
  featured?: boolean;
  events: MatchEvent[];
  stats?: MatchStats;
}

export type StandingZone = 'champion' | 'continental' | 'promotion' | 'relegation' | 'none';

export interface StandingRow {
  id: string;
  competitionId: CompetitionId;
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
  form: ('W' | 'D' | 'L')[];
  zone?: StandingZone;
}

export interface TopScorer {
  id: string;
  competitionId: CompetitionId;
  playerName: string;
  teamName: string;
  teamColor: string;
  goals: number;
  assists: number;
  matches: number;
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

export interface SportsGraphicCard {
  id: string;
  type: 'matchday' | 'player_spotlight' | 'transfer_alert' | 'tactical_stat';
  kicker: string;
  title: string;
  subtitle: string;
  competitionId: CompetitionId;
  imageUrl: string;
  accent: 'emerald' | 'crimson' | 'gold' | 'sky';
  metrics: StatPair[];
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

export interface AppDataState {
  articles: NewsArticle[];
  matches: MatchItem[];
  standings: StandingRow[];
  scorers: TopScorer[];
  banners: HeroBanner[];
  cards: SportsGraphicCard[];
  notifications: AppNotification[];
  adminPin: string;
  updatedAt: string;
}

export type NavTab = 'home' | 'competitions' | 'results' | 'admin';
