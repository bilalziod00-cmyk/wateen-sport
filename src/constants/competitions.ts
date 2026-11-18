import {
  CompetitionId,
  CompetitionRuleConfig,
  NewsCategoryTag,
  SmartImportDataType,
  TeamDirectoryItem,
  TieBreakerCriterion,
} from '../types/sports';

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
  isWomens?: boolean;
  season: string;
  ageCategory: string;
  defaultGroups: string[];
  teamsCount?: number;
}

// تعريف شامل لكل بطولات ودرجات وفئات كرة القدم الأردنية (بما يشمل بطولات السيدات والفئات العمرية والكؤوس)
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
    ageCategory: 'الفريق الأول',
    defaultGroups: ['الدوري العام'],
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
    ageCategory: 'الفريق الأول',
    defaultGroups: ['الدوري العام'],
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
    ageCategory: 'الفريق الأول',
    defaultGroups: ['المجموعة الأولى', 'المجموعة الثانية'],
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
    ageCategory: 'الفريق الأول',
    defaultGroups: ['مجموعة الشمال', 'مجموعة الوسط', 'مجموعة الجنوب'],
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
    ageCategory: 'تحت 20 سنة',
    defaultGroups: ['دوري النخبة تحت 20', 'المجموعة الأولى', 'المجموعة الثانية'],
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
    ageCategory: 'تحت 17 سنة',
    defaultGroups: ['دوري النخبة تحت 17', 'المجموعة الأولى', 'المجموعة الثانية'],
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
    ageCategory: 'تحت 15 سنة',
    defaultGroups: ['دوري الأشبال العام', 'المجموعة الأولى', 'المجموعة الثانية'],
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
    ageCategory: 'تحت 13 سنة والبراعم',
    defaultGroups: ['المجموعة الأولى', 'المجموعة الثانية'],
    teamsCount: 16,
  },
  womens_league: {
    id: 'womens_league',
    name: 'دوري المحترفات وبطولات السيدات',
    shortName: 'بطولات السيدات',
    subtitle: 'دوري المحترفات الأردني وكأس السيدات',
    tierLabel: 'بطولات السيدات',
    accentFrom: '#EC4899',
    accentTo: '#9D174D',
    badgeColor: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    isWomens: true,
    season: '2026 / 2027',
    ageCategory: 'سيدات - الفريق الأول',
    defaultGroups: ['دوري المحترفات العام'],
    teamsCount: 6,
  },
  jordan_cup: {
    id: 'jordan_cup',
    name: 'كأس الأردن والبطولات الإقصائية',
    shortName: 'كأس الأردن',
    subtitle: 'أغلى الكؤوس، درع الاتحاد، وكأس السوبر',
    tierLabel: 'بطولة الكأس',
    accentFrom: '#F97316',
    accentTo: '#C2410C',
    badgeColor: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    season: '2026 / 2027',
    ageCategory: 'الفريق الأول',
    defaultGroups: ['دور الـ 32', 'دور الـ 16', 'ربع النهائي', 'نصف النهائي', 'النهائي'],
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
    ageCategory: 'المنتخبات الوطنية',
    defaultGroups: ['المجموعة الآسيوية'],
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
    ageCategory: 'عام',
    defaultGroups: ['الدوري العام'],
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
  'womens_league',
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

export const TIE_BREAKER_LABELS: Record<TieBreakerCriterion, string> = {
  head_to_head_points: 'نقاط المواجهات المباشرة',
  head_to_head_gd: 'فارق أهداف المواجهات المباشرة',
  goal_difference: 'فارق الأهداف العام',
  goals_for: 'الأكثر تسجيلاً للأهداف',
  wins: 'الأكثر تحقيقاً للفوز',
};

export const SMART_IMPORT_DATA_TYPES: {
  id: SmartImportDataType;
  label: string;
  description: string;
}[] = [
  { id: 'standings_table', label: 'جدول ترتيب', description: 'استيراد جدول ترتيب كامل (لعب، فوز، تعادل، خسارة، أهداف، نقاط)' },
  { id: 'match_results', label: 'نتائج مباريات', description: 'استيراد نتائج مباريات منتهية وتحديث الترتيب تلقائياً' },
  { id: 'match_schedule', label: 'جدول مباريات', description: 'استيراد مواعيد وملاعب مباريات قادمة أو مؤجلة' },
  { id: 'rounds_data', label: 'بيانات الجولات', description: 'استيراد جولة كاملة دفعة واحدة (مباريات + نتائج + ملاعب)' },
  { id: 'teams_list', label: 'قائمة فرق', description: 'استيراد أندية وفرق البطولة والمجموعة' },
  { id: 'top_scorers', label: 'ترتيب الهدافين', description: 'استيراد قائمة هدافي البطولة وصنّاع الأهداف' },
  { id: 'goalkeepers_stats', label: 'إحصائيات الحراس', description: 'استيراد الشباك النظيفة والأهداف المستقبلة لحراس المرمى' },
  { id: 'players_stats', label: 'إحصائيات اللاعبين', description: 'استيراد مشاركات وأرقام اللاعبين التفصيلية' },
  { id: 'players_list', label: 'قائمة لاعبين', description: 'استيراد كشوفات وأسماء ومراكز لاعبي الأندية' },
];

// القواعد الافتراضية القابلة للتخصيص لكل بطولة من لوحة الإدارة
export function getDefaultCompetitionRules(): Record<string, CompetitionRuleConfig> {
  const rules: Record<string, CompetitionRuleConfig> = {};
  (Object.keys(COMPETITIONS) as CompetitionId[]).forEach((id) => {
    const meta = COMPETITIONS[id];
    rules[id] = {
      competitionId: id,
      season: meta.season,
      ageCategory: meta.ageCategory,
      groups: [...meta.defaultGroups],
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      championSpots: id === 'pro_league' || id === 'womens_league' ? 1 : 0,
      continentalSpots: id === 'pro_league' ? 2 : 0,
      promotionSpots: id === 'first_div' || id === 'second_div' || id === 'third_div' ? 2 : 0,
      relegationSpots: id === 'pro_league' ? 4 : id === 'first_div' || id === 'second_div' ? 2 : 0,
      tiebreakers: [
        'head_to_head_points',
        'head_to_head_gd',
        'goal_difference',
        'goals_for',
        'wins',
      ],
      updatedAt: new Date().toISOString(),
    };
  });
  return rules;
}

// دليل الأندية الأردنية الرسمي للمطابقة الذكية واكتشاف الأسماء المتشابهة
export const INITIAL_JORDAN_TEAMS_DIRECTORY: TeamDirectoryItem[] = [
  { id: 'tm-hussein', name: 'الحسين إربد', shortName: 'الحسين', color: '#FACC15', competitionId: 'pro_league', city: 'إربد', aliases: ['الحسين', 'الحسين اربد', 'نادي الحسين', 'غزاة الشمال'] },
  { id: 'tm-wehdat', name: 'الوحدات', shortName: 'الوحدات', color: '#10B981', competitionId: 'pro_league', city: 'عمّان', aliases: ['نادي الوحدات', 'المارد الأخضر', 'وحدات'] },
  { id: 'tm-faisaly', name: 'الفيصلي', shortName: 'الفيصلي', color: '#0EA5E9', competitionId: 'pro_league', city: 'عمّان', aliases: ['نادي الفيصلي', 'الزعيم', 'فيصلي'] },
  { id: 'tm-ramtha', name: 'الرمثا', shortName: 'الرمثا', color: '#1E40AF', competitionId: 'pro_league', city: 'الرمثا', aliases: ['نادي الرمثا', 'غزلان الشمال', 'رمثا'] },
  { id: 'tm-salt', name: 'السلط', shortName: 'السلط', color: '#1E3A8A', competitionId: 'pro_league', city: 'السلط', aliases: ['نادي السلط', 'الرهيب'] },
  { id: 'tm-shabab-jo', name: 'شباب الأردن', shortName: 'شباب الأردن', color: '#DC2626', competitionId: 'pro_league', city: 'عمّان', aliases: ['شباب الاردن', 'أسود غمدان'] },
  { id: 'tm-ahli', name: 'الأهلي', shortName: 'الأهلي', color: '#16A34A', competitionId: 'pro_league', city: 'عمّان', aliases: ['الاهلي', 'نادي الأهلي', 'الليث الأبيض'] },
  { id: 'tm-jazeera', name: 'الجزيرة', shortName: 'الجزيرة', color: '#EF4444', competitionId: 'pro_league', city: 'عمّان', aliases: ['نادي الجزيرة', 'الشياطين الحمر'] },
  { id: 'tm-aqaba', name: 'شباب العقبة', shortName: 'العقبة', color: '#0284C7', competitionId: 'pro_league', city: 'العقبة', aliases: ['العقبة', 'نادي شباب العقبة'] },
  { id: 'tm-maan', name: 'معان', shortName: 'معان', color: '#B45309', competitionId: 'pro_league', city: 'معان', aliases: ['نادي معان', 'ذئاب الجنوب'] },
  { id: 'tm-sareeh', name: 'الصريح', shortName: 'الصريح', color: '#EA580C', competitionId: 'pro_league', city: 'إربد', aliases: ['نادي الصريح'] },
  { id: 'tm-moghayer', name: 'مغير السرحان', shortName: 'مغير السرحان', color: '#475569', competitionId: 'pro_league', city: 'المفرق', aliases: ['نادي مغير السرحان', 'المغير'] },
  // الدرجة الأولى
  { id: 'tm-arabi', name: 'العربي', shortName: 'العربي', color: '#16A34A', competitionId: 'first_div', city: 'إربد', aliases: ['النادي العربي', 'عربي إربد'] },
  { id: 'tm-baqaa', name: 'البقعة', shortName: 'البقعة', color: '#111827', competitionId: 'first_div', city: 'البقعة', aliases: ['نادي البقعة'] },
  { id: 'tm-sahab', name: 'سحاب', shortName: 'سحاب', color: '#2563EB', competitionId: 'first_div', city: 'سحاب', aliases: ['نادي سحاب', 'أسود الشرق'] },
  { id: 'tm-ittihad-ramtha', name: 'اتحاد الرمثا', shortName: 'اتحاد الرمثا', color: '#F59E0B', competitionId: 'first_div', city: 'الرمثا', aliases: ['إتحاد الرمثا'] },
  { id: 'tm-kufrsoum', name: 'كفرسوم', shortName: 'كفرسوم', color: '#7C3AED', competitionId: 'first_div', city: 'إربد', aliases: ['نادي كفرسوم'] },
  { id: 'tm-jalil', name: 'الجليل', shortName: 'الجليل', color: '#DC2626', competitionId: 'first_div', city: 'إربد', aliases: ['نادي الجليل'] },
  { id: 'tm-yarmouk', name: 'اليرموك', shortName: 'اليرموك', color: '#059669', competitionId: 'first_div', city: 'عمّان', aliases: ['نادي اليرموك'] },
  // الدرجة الثانية والثالثة
  { id: 'tm-karmel', name: 'الكرمل', shortName: 'الكرمل', color: '#16A34A', competitionId: 'second_div', city: 'إربد', aliases: ['نادي الكرمل'] },
  { id: 'tm-turra', name: 'الطرة', shortName: 'الطرة', color: '#2563EB', competitionId: 'second_div', city: 'الرمثا', aliases: ['نادي الطرة'] },
  { id: 'tm-doqara', name: 'دوقرة', shortName: 'دوقرة', color: '#D97706', competitionId: 'second_div', city: 'إربد', aliases: ['نادي دوقرة'] },
  { id: 'tm-husn', name: 'الحصن', shortName: 'الحصن', color: '#9333EA', competitionId: 'second_div', city: 'إربد', aliases: ['نادي الحصن'] },
  { id: 'tm-jerash', name: 'جرش', shortName: 'جرش', color: '#0891B2', competitionId: 'second_div', city: 'جرش', aliases: ['نادي جرش'] },
  { id: 'tm-tafileh', name: 'الطفيلة', shortName: 'الطفيلة', color: '#E11D48', competitionId: 'second_div', city: 'الطفيلة', aliases: ['نادي الطفيلة'] },
  { id: 'tm-mafraq', name: 'المفرق', shortName: 'المفرق', color: '#0D9488', competitionId: 'third_div', city: 'المفرق', aliases: ['نادي المفرق'] },
  { id: 'tm-ajloun', name: 'عجلون', shortName: 'عجلون', color: '#15803D', competitionId: 'third_div', city: 'عجلون', aliases: ['نادي عجلون'] },
  { id: 'tm-mutah', name: 'مؤتة', shortName: 'مؤتة', color: '#B91C1C', competitionId: 'third_div', city: 'الكرك', aliases: ['نادي مؤتة'] },
  { id: 'tm-hashemiya', name: 'الهاشمية', shortName: 'الهاشمية', color: '#4338CA', competitionId: 'third_div', city: 'الزرقاء', aliases: ['نادي الهاشمية'] },
  // أندية السيدات
  { id: 'tm-etihad-w', name: 'الاتحاد للسيدات', shortName: 'الاتحاد', color: '#EC4899', competitionId: 'womens_league', city: 'عمّان', aliases: ['نادي الاتحاد للسيدات', 'الاتحاد'] },
  { id: 'tm-ammancfc-w', name: 'عمان FC للسيدات', shortName: 'عمان FC', color: '#10B981', competitionId: 'womens_league', city: 'عمّان', aliases: ['عمان اف سي', 'عمان FC'] },
  { id: 'tm-orthodox-w', name: 'الأرثوذكسي للسيدات', shortName: 'الأرثوذكسي', color: '#EF4444', competitionId: 'womens_league', city: 'عمّان', aliases: ['الأرثوذكسي', 'الارثوذكسي'] },
  { id: 'tm-hussein-w', name: 'الحسين للسيدات', shortName: 'الحسين سيدات', color: '#FACC15', competitionId: 'womens_league', city: 'إربد', aliases: ['الحسين إربد للسيدات'] },
  { id: 'tm-nashama-w', name: 'النصر للسيدات', shortName: 'النصر', color: '#3B82F6', competitionId: 'womens_league', city: 'عمّان', aliases: ['نادي النصر للسيدات', 'النصر'] },
  { id: 'tm-istqlal-w', name: 'الاستقلال للسيدات', shortName: 'الاستقلال', color: '#8B5CF6', competitionId: 'womens_league', city: 'عمّان', aliases: ['نادي الاستقلال للسيدات', 'الاستقلال'] },
];
