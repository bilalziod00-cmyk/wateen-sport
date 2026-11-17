import { CompetitionId, NewsCategoryTag } from '../types/sports';

export interface CompetitionMeta {
  id: CompetitionId;
  name: string;
  shortName: string;
  subtitle: string;
  tierLabel: string;
  accentFrom: string;
  accentTo: string;
  badgeColor: string;
  isYouth?: boolean;
  season: string;
  teamsCount?: number;
}

// تعريف شامل لكل بطولات ودرجات وفئات كرة القدم الأردنية
export const COMPETITIONS: Record<CompetitionId, CompetitionMeta> = {
  pro_league: {
    id: 'pro_league',
    name: 'دوري المحترفين الأردني',
    shortName: 'المحترفين',
    subtitle: 'القمة الكروية الأردنية - CFI',
    tierLabel: 'الدرجة الممتازة',
    accentFrom: '#10B981',
    accentTo: '#047857',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    season: '2026 / 2027',
    teamsCount: 12,
  },
  first_div: {
    id: 'first_div',
    name: 'دوري الدرجة الأولى الأردني',
    shortName: 'الدرجة الأولى',
    subtitle: 'صراع الصعود إلى دوري الأضواء',
    tierLabel: 'الدرجة الأولى',
    accentFrom: '#F59E0B',
    accentTo: '#B45309',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    season: '2026 / 2027',
    teamsCount: 14,
  },
  second_div: {
    id: 'second_div',
    name: 'دوري الدرجة الثانية الأردني',
    shortName: 'الدرجة الثانية',
    subtitle: 'بطولة أندية المحافظات والطموح',
    tierLabel: 'الدرجة الثانية',
    accentFrom: '#0EA5E9',
    accentTo: '#0369A1',
    badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    season: '2026 / 2027',
    teamsCount: 16,
  },
  third_div: {
    id: 'third_div',
    name: 'دوري الدرجة الثالثة الأردني',
    shortName: 'الدرجة الثالثة',
    subtitle: 'قاعدة الأندية الأردنية والمواهب الصاعدة',
    tierLabel: 'الدرجة الثالثة',
    accentFrom: '#8B5CF6',
    accentTo: '#5B21B6',
    badgeColor: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    season: '2026 / 2027',
    teamsCount: 24,
  },
  youth_u20: {
    id: 'youth_u20',
    name: 'دوري الشباب تحت 20 سنة',
    shortName: 'تحت 20',
    subtitle: 'الفئات العمرية - رافد المنتخبات والأندية',
    tierLabel: 'فئة الشباب',
    accentFrom: '#14B8A6',
    accentTo: '#0F766E',
    badgeColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    isYouth: true,
    season: '2026 / 2027',
    teamsCount: 12,
  },
  youth_u17: {
    id: 'youth_u17',
    name: 'دوري الناشئين تحت 17 سنة',
    shortName: 'تحت 17',
    subtitle: 'الفئات العمرية - جيل المستقبل الأردني',
    tierLabel: 'فئة الناشئين',
    accentFrom: '#06B6D4',
    accentTo: '#0E7490',
    badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    isYouth: true,
    season: '2026 / 2027',
    teamsCount: 12,
  },
  youth_u15: {
    id: 'youth_u15',
    name: 'دوري الأشبال تحت 15 سنة',
    shortName: 'تحت 15',
    subtitle: 'الفئات العمرية - التأسيس التكتيكي والفني',
    tierLabel: 'تحت 15',
    accentFrom: '#22C55E',
    accentTo: '#15803D',
    badgeColor: 'bg-green-500/15 text-green-300 border-green-500/30',
    isYouth: true,
    season: '2026 / 2027',
    teamsCount: 12,
  },
  youth_grassroots: {
    id: 'youth_grassroots',
    name: 'بطولات الواعدين والأكاديميات',
    shortName: 'الواعدين',
    subtitle: 'الفئات العمرية - مهرجانات ومواهب البراعم',
    tierLabel: 'الواعدين',
    accentFrom: '#84CC16',
    accentTo: '#4D7C0F',
    badgeColor: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
    isYouth: true,
    season: '2026 / 2027',
    teamsCount: 16,
  },
  jordan_cup: {
    id: 'jordan_cup',
    name: 'كأس الأردن',
    shortName: 'كأس الأردن',
    subtitle: 'أغلى الكؤوس ومفاجآت الأدوار الإقصائية',
    tierLabel: 'بطولة الكأس',
    accentFrom: '#F97316',
    accentTo: '#C2410C',
    badgeColor: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    season: '2026 / 2027',
    teamsCount: 32,
  },
  national_teams: {
    id: 'national_teams',
    name: 'المنتخبات الوطنية (النشامى)',
    shortName: 'النشامى',
    subtitle: 'المنتخب الأول، الأولمبي، الشباب، والناشئين',
    tierLabel: 'المنتخبات',
    accentFrom: '#E11D48',
    accentTo: '#9F1239',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    season: '2026 / 2027',
  },
  general: {
    id: 'general',
    name: 'أخبار الكرة الأردنية',
    shortName: 'أخبار عامة',
    subtitle: 'تغطية شاملة للأندية والاتحاد الأردني',
    tierLabel: 'عام',
    accentFrom: '#64748B',
    accentTo: '#334155',
    badgeColor: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    season: '2026 / 2027',
  },
};

export const YOUTH_COMPETITION_IDS: CompetitionId[] = [
  'youth_u20',
  'youth_u17',
  'youth_u15',
  'youth_grassroots',
];

export const PRIMARY_COMPETITION_LIST: CompetitionId[] = [
  'pro_league',
  'first_div',
  'second_div',
  'third_div',
  'youth_u20',
  'youth_u17',
  'youth_u15',
  'youth_grassroots',
  'jordan_cup',
  'national_teams',
];

export const NEWS_TAG_LABELS: Record<NewsCategoryTag, { label: string; color: string }> = {
  club_news: {
    label: 'أخبار الأندية',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  transfers: {
    label: 'الانتقالات',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  injuries: {
    label: 'الإصابات والجاهزية',
    color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  tactical_analysis: {
    label: 'تحليل فني ورقمي',
    color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  match_report: {
    label: 'تقرير مباراة',
    color: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  },
  official: {
    label: 'قرار رسمي',
    color: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
  },
};

export const JORDAN_STADIUMS: string[] = [
  'ستاد عمّان الدولي',
  'ستاد الحسن - إربد',
  'ستاد الملك عبدالله الثاني - القويسمة',
  'ستاد الأمير محمد - الزرقاء',
  'ستاد الأمير علي - المفرق',
  'ستاد العقبة',
  'ملعب السلط',
  'ملعب البترا - مدينة الحسين للشباب',
  'ملعب الأمير هاشم - الرمثا',
  'ملعب الأمير فيصل - الكرك',
  'ملعب جرش البلدي',
  'ملعب مأدبا',
  'ملعب عجلون',
  'ملعب البولو - مدينة الحسين للشباب',
];
