import { COMPETITIONS } from '../constants/competitions';
import { AppDataState } from '../types/sports';
import { isLiveMatchStatus } from '../utils/matchStatus';
import { getDefaultAutomationSettings } from './schemaMigrationService';

export type AdminDashboardTabId =
  | 'overview'
  | 'smart_import'
  | 'news_intel'
  | 'automation_budget'
  | 'ai_assistant'
  | 'news'
  | 'live'
  | 'matches'
  | 'standings'
  | 'players_medical'
  | 'auto_design'
  | 'media_push'
  | 'cloud';

export interface AdminDashboardKpis {
  publishedArticles: number;
  breakingArticles: number;
  reviewQueueCount: number;
  enabledSources: number;
  failedSources: number;
  totalMatches: number;
  liveMatches: number;
  finishedMatches: number;
  standingsRows: number;
  standingsHistoryCount: number;
  scorersCount: number;
  goalkeepersCount: number;
  verifiedInjuries: number;
  teamsCount: number;
  studioCardsCount: number;
  activeStreamsCount: number;
  bannersCount: number;
  notificationsCount: number;
  dailyRequestsUsed: number;
  dailyRequestsLimit: number;
  monthlySpentUsd: number;
  monthlyBudgetUsd: number;
  totalCacheHits: number;
  unresolvedAlerts: number;
  auditLogsCount: number;
  importBatchesCount: number;
  pendingImportsCount: number;
  competitionsCount: number;
  schemaVersion: number;
}

export interface AdminSectionDescriptor {
  order: number;
  id: string;
  titleAr: string;
  subtitleAr: string;
  groupAr: 'الذكاء والأخبار' | 'المباريات والترتيب' | 'اللاعبون والطب' | 'الإنتاج والأتمتة' | 'الإدارة والأمان';
  targetTab: AdminDashboardTabId;
  getBadgeValue: (kpis: AdminDashboardKpis) => string;
}

/**
 * حساب كافة مؤشرات الأداء (KPIs) الحية للوحة التحكم المركزية من بيانات التطبيق الفعلية دون تخمين
 */
export function computeAdminDashboardKpis(data: AppDataState): AdminDashboardKpis {
  const settings = { ...getDefaultAutomationSettings(), ...(data.automationSettings || {}) };
  const sources = data.newsSources || [];
  const enabledSourcesList = sources.filter((s) => s.enabled);

  return {
    publishedArticles: data.articles.length,
    breakingArticles: data.articles.filter((a) => a.isBreaking).length,
    reviewQueueCount: (data.reviewQueueArticles || []).length,
    enabledSources: enabledSourcesList.length,
    failedSources: enabledSourcesList.filter((s) => s.lastStatus === 'error').length,
    totalMatches: data.matches.length,
    liveMatches: data.matches.filter((m) => isLiveMatchStatus(m.status)).length,
    finishedMatches: data.matches.filter((m) => m.status === 'finished').length,
    standingsRows: data.standings.length,
    standingsHistoryCount: (data.standingsHistory || []).length,
    scorersCount: data.scorers.length,
    goalkeepersCount: (data.goalkeepers || []).length,
    verifiedInjuries: (data.injuries || []).filter((inj) => inj.isVerifiedOfficial).length,
    teamsCount: (data.teamsDirectory || []).length,
    studioCardsCount: data.cards.length,
    activeStreamsCount: (data.liveStreams || []).filter((s) => s.isLive).length,
    bannersCount: data.banners.length,
    notificationsCount: data.notifications.length,
    dailyRequestsUsed: Number(settings.dailyRequestsUsed || 0),
    dailyRequestsLimit: Number(settings.dailyRequestsLimit || 120),
    monthlySpentUsd: Number(settings.monthlySpentEstimateUsd || 0),
    monthlyBudgetUsd: Number(settings.monthlyBudgetUsd || 10),
    totalCacheHits: Number(settings.totalCacheHits || 0),
    unresolvedAlerts: (data.automationAlerts || []).filter((a) => !a.resolved).length,
    auditLogsCount: (data.auditLogs || []).length,
    importBatchesCount: (data.importBatches || []).length,
    pendingImportsCount: (data.importBatches || []).filter(
      (b) => b.status === 'Pending Review' || b.status === 'Needs Correction'
    ).length,
    competitionsCount:
      Object.keys(COMPETITIONS).filter((id) => id !== 'general').length +
      (data.customCompetitions || []).length,
    schemaVersion: data.schemaVersion || 1,
  };
}

/**
 * الأقسام الـ 18 الموحدة في لوحة التحكم المركزية لمنصة WATEEN AI
 */
export const ADMIN_CENTRAL_18_SECTIONS: AdminSectionDescriptor[] = [
  {
    order: 1,
    id: 'sec_overview_kpis',
    titleAr: '1. النظرة العامة ومؤشرات الأداء',
    subtitleAr: 'ملخص الأرقام الفورية عبر الأخبار والمباريات والميزانية',
    groupAr: 'الإدارة والأمان',
    targetTab: 'overview',
    getBadgeValue: (k) => `${k.competitionsCount} بطولة`,
  },
  {
    order: 2,
    id: 'sec_smart_import',
    titleAr: '2. الإدخال الذكي AI (OCR / Excel)',
    subtitleAr: 'استيراد الصور والجداول والنصوص مع فحص الثقة والحساب',
    groupAr: 'الذكاء والأخبار',
    targetTab: 'smart_import',
    getBadgeValue: (k) => `${k.importBatchesCount} دفعة`,
  },
  {
    order: 3,
    id: 'sec_wateen_ai_core',
    titleAr: '3. محرك الذكاء الإخباري WATEEN AI',
    subtitleAr: 'التحرير الصحفي الذكي وكشف التكرار والتضارب',
    groupAr: 'الذكاء والأخبار',
    targetTab: 'news_intel',
    getBadgeValue: (k) => `${k.publishedArticles} منشور`,
  },
  {
    order: 4,
    id: 'sec_news_sources',
    titleAr: '4. المصادر المعتمدة (أردنية/عربية/عالمية)',
    subtitleAr: 'إدارة خلاصات RSS وواجهات API الرسمية المعتمدة',
    groupAr: 'الذكاء والأخبار',
    targetTab: 'news_intel',
    getBadgeValue: (k) => `${k.enabledSources} مفعّل`,
  },
  {
    order: 5,
    id: 'sec_review_queue',
    titleAr: '5. طابور مراجعة المدير (3 حالات نشر)',
    subtitleAr: 'مراجعة واعتماد أو رفض الأخبار غير المؤكدة أو الشائعات',
    groupAr: 'الذكاء والأخبار',
    targetTab: 'news_intel',
    getBadgeValue: (k) => `${k.reviewQueueCount} بانتظار`,
  },
  {
    order: 6,
    id: 'sec_news_editor',
    titleAr: '6. تحرير الأخبار والعاجل',
    subtitleAr: 'كتابة وتعديل وحذف الأخبار وتفعيل الشريط العاجل',
    groupAr: 'الذكاء والأخبار',
    targetTab: 'news',
    getBadgeValue: (k) => `${k.breakingArticles} عاجل`,
  },
  {
    order: 7,
    id: 'sec_ai_assistant',
    titleAr: '7. المساعد التفاعلي Wateen AI Assistant',
    subtitleAr: 'أوامر عربية ذكية لقراءة البيانات وإعداد التقارير بتأكيد المدير',
    groupAr: 'الذكاء والأخبار',
    targetTab: 'ai_assistant',
    getBadgeValue: () => 'جاهز',
  },
  {
    order: 8,
    id: 'sec_competitions_rules',
    titleAr: '8. البطولات والقواعد وكسر التعادل',
    subtitleAr: 'البطولات الأردنية والعربية والآسيوية والعالمية ولوائح النقاط',
    groupAr: 'المباريات والترتيب',
    targetTab: 'standings',
    getBadgeValue: (k) => `${k.competitionsCount} بطولة`,
  },
  {
    order: 9,
    id: 'sec_matches_live_events',
    titleAr: '9. المباريات والنتائج (8 حالات وأحداث)',
    subtitleAr: 'جدولة وتحديث النتائج والأهداف والبطاقات والتبديلات',
    groupAr: 'المباريات والترتيب',
    targetTab: 'matches',
    getBadgeValue: (k) => `${k.totalMatches} مباراة (${k.liveMatches} مباشر)`,
  },
  {
    order: 10,
    id: 'sec_live_streams',
    titleAr: '10. البث المباشر المرئي',
    subtitleAr: 'تشغيل وإدارة روابط البث المباشر داخل التطبيق',
    groupAr: 'المباريات والترتيب',
    targetTab: 'live',
    getBadgeValue: (k) => `${k.activeStreamsCount} نشط`,
  },
  {
    order: 11,
    id: 'sec_standings_history',
    titleAr: '11. جدول الترتيب والسجل التاريخي',
    subtitleAr: 'الترتيب التلقائي، التعديل المعلل بسبب، وتوثيق المراحل',
    groupAr: 'المباريات والترتيب',
    targetTab: 'standings',
    getBadgeValue: (k) => `${k.standingsRows} صف • ${k.standingsHistoryCount} سجل`,
  },
  {
    order: 12,
    id: 'sec_teams_directory',
    titleAr: '12. الأندية والدليل الموحد للفرق',
    subtitleAr: 'الأسماء الرسمية، المرادفات (Aliases)، والمدن والملاعب',
    groupAr: 'اللاعبون والطب',
    targetTab: 'players_medical',
    getBadgeValue: (k) => `${k.teamsCount} نادٍ`,
  },
  {
    order: 13,
    id: 'sec_players_stats',
    titleAr: '13. اللاعبون والهدافون وحراس المرمى',
    subtitleAr: 'سجلات دقيقة مع إظهار "غير متوفر" عند غياب الإحصاء',
    groupAr: 'اللاعبون والطب',
    targetTab: 'players_medical',
    getBadgeValue: (k) => `${k.scorersCount + k.goalkeepersCount} لاعب/حارس`,
  },
  {
    order: 14,
    id: 'sec_medical_injuries',
    titleAr: '14. القسم الطبي الإخباري (الإصابات)',
    subtitleAr: 'تحديثات الإصابات والجاهزية المنسوبة حصرياً لمصدر رسمي',
    groupAr: 'اللاعبون والطب',
    targetTab: 'players_medical',
    getBadgeValue: (k) => `${k.verifiedInjuries} موثقة`,
  },
  {
    order: 15,
    id: 'sec_auto_design_studio',
    titleAr: '15. استوديو التصميم التلقائي (11 قالباً)',
    subtitleAr: 'توليد بطاقات المباريات والترتيب بمقاسات FB و Instagram',
    groupAr: 'الإنتاج والأتمتة',
    targetTab: 'auto_design',
    getBadgeValue: (k) => `${k.studioCardsCount} بطاقة • 11 قالب`,
  },
  {
    order: 16,
    id: 'sec_banners_push',
    titleAr: '16. البنرات والإشعارات الفورية',
    subtitleAr: 'إدارة السلايدر الرئيسي وإرسال إشعارات التطبيق',
    groupAr: 'الإنتاج والأتمتة',
    targetTab: 'media_push',
    getBadgeValue: (k) => `${k.bannersCount} بنر • ${k.notificationsCount} إشعار`,
  },
  {
    order: 17,
    id: 'sec_scheduler_budget',
    titleAr: '17. الأتمتة المجدولة، الكاش والميزانية',
    subtitleAr: 'حد الطلبات اليومي، السقف الشهري، الكاش، والتنبيهات',
    groupAr: 'الإنتاج والأتمتة',
    targetTab: 'automation_budget',
    getBadgeValue: (k) => `$${k.monthlySpentUsd.toFixed(2)} / $${k.monthlyBudgetUsd}`,
  },
  {
    order: 18,
    id: 'sec_cloud_security_audit',
    titleAr: '18. السحابة (Firebase)، النسخ الاحتياطي والأمان',
    subtitleAr: 'المزامنة، استعادة البيانات، وحماية مفاتيح الخادم',
    groupAr: 'الإدارة والأمان',
    targetTab: 'cloud',
    getBadgeValue: (k) => `v${k.schemaVersion} • ${k.auditLogsCount} تدقيق`,
  },
];
