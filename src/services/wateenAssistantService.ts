import {
  COMPETITIONS,
  INITIAL_JORDAN_TEAMS_DIRECTORY,
  PRIMARY_COMPETITION_LIST,
} from '../constants/competitions';
import {
  AppDataState,
  CompetitionId,
  MatchItem,
  NewsArticle,
  StandingRow,
} from '../types/sports';
import { formatAmmanDateTime } from '../utils/ammanTime';
import { getMatchStatusArabicLabel, isLiveMatchStatus } from '../utils/matchStatus';
import {
  computeCompetitionStatsSummary,
  normalizeArabicTeamName,
  resolveTeamFromDirectory,
} from '../utils/sportsMathEngine';
import { sortStandings } from '../components/StandingsTable';
import { INJURY_STATUS_META } from './playersAndMedicalService';

export type AssistantSensitiveActionType =
  | 'approve_top_queued_news'
  | 'recalculate_standings'
  | 'send_breaking_notification'
  | 'draft_match_score_update';

export interface AssistantPendingAction {
  id: string;
  actionType: AssistantSensitiveActionType;
  titleAr: string;
  descriptionAr: string;
  impactWarningAr: string;
  payload: Record<string, unknown>;
}

export interface AssistantResponse {
  id: string;
  query: string;
  intent: string;
  answerText: string;
  bullets: string[];
  sourcesUsed: string[];
  dataLastUpdatedAt: string;
  dataLastUpdatedFormatted: string;
  containsDemoData: boolean;
  requiresAdminConfirmation: boolean;
  pendingAction?: AssistantPendingAction;
  generatedSocialPost?: string;
}

function detectCompetitionFromPrompt(
  prompt: string
): { id: CompetitionId; name: string } | null {
  const norm = normalizeArabicTeamName(prompt);
  if (/محترفين/.test(norm)) return { id: 'pro_league', name: COMPETITIONS.pro_league.name };
  if (/درجه اولي|الدرجه الاولي|الاولي/.test(norm))
    return { id: 'first_div', name: COMPETITIONS.first_div.name };
  if (/درجه ثانيه|الدرجه الثانيه|الثانيه/.test(norm))
    return { id: 'second_div', name: COMPETITIONS.second_div.name };
  if (/درجه ثالثه|الدرجه الثالثه|الثالثه/.test(norm))
    return { id: 'third_div', name: COMPETITIONS.third_div.name };
  if (/سيدات|محترفات/.test(norm))
    return { id: 'womens_league', name: COMPETITIONS.womens_league.name };
  if (/كاس الاردن|الكاس/.test(norm))
    return { id: 'jordan_cup', name: COMPETITIONS.jordan_cup.name };
  if (/النشامي|منتخب/.test(norm))
    return { id: 'national_teams', name: COMPETITIONS.national_teams.name };
  if (/تحت 20|شباب/.test(norm)) return { id: 'youth_u20', name: COMPETITIONS.youth_u20.name };
  if (/تحت 17|ناشئين/.test(norm)) return { id: 'youth_u17', name: COMPETITIONS.youth_u17.name };
  if (/تحت 15|اشبال/.test(norm)) return { id: 'youth_u15', name: COMPETITIONS.youth_u15.name };
  if (/واعدين|براعم/.test(norm))
    return { id: 'youth_grassroots', name: COMPETITIONS.youth_grassroots.name };
  if (/بطولات عربيه|بطوله عربيه|دوري روشن|السعودي|المصري/.test(norm))
    return { id: 'arab_championships', name: COMPETITIONS.arab_championships.name };
  if (/اسيويه|ابطال اسيا|كاس اسيا/.test(norm))
    return { id: 'afc_competitions', name: COMPETITIONS.afc_competitions.name };
  if (/عالميه|ابطال اوروبا|كاس العالم|دوريات عالميه/.test(norm))
    return { id: 'global_leagues', name: COMPETITIONS.global_leagues.name };
  return null;
}

function extractMentionedTeamsFromPrompt(
  prompt: string,
  state: AppDataState
): string[] {
  const normPrompt = normalizeArabicTeamName(prompt);
  const directory =
    state.teamsDirectory && state.teamsDirectory.length > 0
      ? state.teamsDirectory
      : INITIAL_JORDAN_TEAMS_DIRECTORY;

  const candidateNames = new Set<string>();
  directory.forEach((t) => candidateNames.add(t.name));
  (state.standings || []).forEach((s) => candidateNames.add(s.teamName));
  (state.matches || []).forEach((m) => {
    candidateNames.add(m.homeTeam);
    candidateNames.add(m.awayTeam);
  });

  const matched: { name: string; pos: number; len: number }[] = [];

  for (const cand of candidateNames) {
    const clean = (cand || '').trim();
    if (clean.length < 3) continue;
    const normCand = normalizeArabicTeamName(clean);
    if (!normCand || normCand.length < 3) continue;

    // تجنب المطابقة الخاطئة لأسماء قصيرة داخل كلمات عامة
    const idx = normPrompt.indexOf(normCand);
    if (idx !== -1) {
      matched.push({ name: clean, pos: idx, len: normCand.length });
      continue;
    }
    const resolved = directory.find(
      (d) => normalizeArabicTeamName(d.name) === normCand
    );
    if (resolved) {
      for (const al of resolved.aliases || []) {
        const normAl = normalizeArabicTeamName(al);
        if (normAl.length >= 4) {
          const alIdx = normPrompt.indexOf(normAl);
          if (alIdx !== -1) {
            matched.push({ name: resolved.name, pos: alIdx, len: normAl.length });
            break;
          }
        }
      }
    }
  }

  // ترتيب حسب موضع الذكر في الجملة ثم الأطول عند التداخل
  matched.sort((a, b) => a.pos - b.pos || b.len - a.len);
  const unique: string[] = [];
  const seenNorm = new Set<string>();
  for (const m of matched) {
    const n = normalizeArabicTeamName(m.name);
    if (!seenNorm.has(n)) {
      seenNorm.add(n);
      unique.push(m.name);
    }
  }

  // fallback إذا ذكر المستخدم اسماً واحداً عبر resolveTeamFromDirectory
  if (unique.length === 0) {
    const tokens = prompt.split(/\s+/).filter((w) => w.length >= 3);
    for (const tk of tokens) {
      const res = resolveTeamFromDirectory(tk, 'pro_league', directory, state.standings);
      if (res.status === 'matched') {
        unique.push(res.canonicalName);
        break;
      }
    }
  }

  return unique;
}

function getTeamStandingAndMatches(teamName: string, state: AppDataState) {
  const norm = normalizeArabicTeamName(teamName);
  const standing: StandingRow | null =
    (state.standings || []).find((s) => normalizeArabicTeamName(s.teamName) === norm) || null;
  const matches: MatchItem[] = (state.matches || []).filter(
    (m) =>
      normalizeArabicTeamName(m.homeTeam) === norm ||
      normalizeArabicTeamName(m.awayTeam) === norm
  );
  const finished = [...matches]
    .filter((m) => m.status === 'finished')
    .sort((a, b) => new Date(b.kickoffIso).getTime() - new Date(a.kickoffIso).getTime());
  const upcoming = [...matches]
    .filter((m) => m.status !== 'finished' && m.status !== 'cancelled')
    .sort((a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime());
  return { standing, finished, upcoming };
}

function buildFinalResponse(
  base: Omit<
    AssistantResponse,
    'id' | 'dataLastUpdatedAt' | 'dataLastUpdatedFormatted' | 'requiresAdminConfirmation'
  > & { requiresAdminConfirmation?: boolean },
  state: AppDataState
): AssistantResponse {
  const updatedIso = state.updatedAt || new Date().toISOString();
  return {
    ...base,
    id: `asst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    dataLastUpdatedAt: updatedIso,
    dataLastUpdatedFormatted: formatAmmanDateTime(updatedIso),
    requiresAdminConfirmation: Boolean(base.requiresAdminConfirmation),
  };
}

/**
 * معالج أوامر المساعد التفاعلي Wateen AI Assistant:
 * - يجيب من قاعدة البيانات الفعلية والمصادر المسجلة فقط
 * - يذكر المصدر وتاريخ آخر تحديث دائماً
 * - يمنع تنفيذ أي عملية حساسة (نشر، إشعار، تعديل نتيجة/ترتيب، إعادة حساب) دون موافقة صريحة من المدير
 */
export function processWateenAssistantCommand(
  rawPrompt: string,
  state: AppDataState
): AssistantResponse {
  const prompt = (rawPrompt || '').trim();
  if (!prompt) {
    return buildFinalResponse(
      {
        query: '',
        intent: 'empty',
        answerText:
          'اكتب سؤالك أو أمرك الرياضي بالعربية (مثال: «من هو هداف الدوري؟»، «قارن بين الكرمل وعجلون»، «حلل آخر 5 مباريات للوحدات»، «جهز منشور فيسبوك»).',
        bullets: [],
        sourcesUsed: ['قاعدة بيانات وتين سبورت'],
        containsDemoData: false,
      },
      state
    );
  }

  const norm = normalizeArabicTeamName(prompt);
  const detectedComp = detectCompetitionFromPrompt(prompt);
  const teams = extractMentionedTeamsFromPrompt(prompt, state);
  const activeCompId: CompetitionId = detectedComp?.id || 'pro_league';
  const activeCompName = COMPETITIONS[activeCompId]?.name || 'دوري المحترفين الأردني';

  // ==========================================================================
  // 1) حارس العمليات الحساسة — تتطلب تأكيداً صريحاً من المدير قبل أي تعديل على القاعدة
  // ==========================================================================
  const isModifyScoreIntent = /عدل نتيجه|تعديل نتيجه|غير نتيجه|احذف|امسح/.test(norm);
  const isApproveQueueIntent =
    /اعتمد.*طابور|انشر.*طابور|موافقه.*خبر|انشر اول خبر/.test(norm);
  const isRecalcIntent = /اعد حساب|اعاده حساب|تحديث الترتيب الان/.test(norm);
  const isSendPushIntent = /ارسل اشعار|ابث اشعار|بث اشعار|اشعار عاجل/.test(norm);

  if (isApproveQueueIntent) {
    const queue = state.reviewQueueArticles || [];
    if (queue.length === 0) {
      return buildFinalResponse(
        {
          query: prompt,
          intent: 'sensitive_approve_queue_empty',
          answerText: 'طابور المراجعة فارغ حالياً؛ لا توجد أخبار معلّقة للاعتماد.',
          bullets: [],
          sourcesUsed: ['طابور مراجعة الأخبار (review_queue)'],
          containsDemoData: false,
        },
        state
      );
    }
    const target = queue[0];
    return buildFinalResponse(
      {
        query: prompt,
        intent: 'sensitive_action_confirmation_required',
        answerText: `هذا إجراء نشر حساس ويتطلب موافقتك الصريحة قبل التنفيذ: اعتماد ونشر الخبر "${target.title}" من المصدر (${target.sourceName || 'غير محدد'}).`,
        bullets: [
          `العنوان: ${target.title}`,
          `المصدر: ${target.sourceName || 'غير محدد'}`,
          'لن يتم النشر تلقائياً قبل الضغط على زر «تأكيد التنفيذ الآن».',
        ],
        sourcesUsed: ['طابور مراجعة الأخبار (review_queue)', target.sourceName || 'مصدر مسجل'],
        containsDemoData: false,
        requiresAdminConfirmation: true,
        pendingAction: {
          id: `act_approve_${target.id}`,
          actionType: 'approve_top_queued_news',
          titleAr: 'اعتماد ونشر خبر من طابور المراجعة',
          descriptionAr: `سيتم نشر الخبر "${target.title}" فوراً للجمهور وإزالته من طابور الانتظار.`,
          impactWarningAr: 'إجراء نشر فوري على التطبيق — يتطلب تأكيد المدير.',
          payload: { articleId: target.id },
        },
      },
      state
    );
  }

  if (isRecalcIntent) {
    return buildFinalResponse(
      {
        query: prompt,
        intent: 'sensitive_action_confirmation_required',
        answerText: `إعادة احتساب جدول ترتيب (${activeCompName}) سيحدّث المراكز والنقاط ويسجل لقطة جديدة في السجل التاريخي. يرجى تأكيد التنفيذ أولاً.`,
        bullets: [
          `البطولة المستهدفة: ${activeCompName}`,
          'سيتم تسجيل التغيير في السجل التاريخي للترتيب (standingsHistory).',
        ],
        sourcesUsed: ['محرك الحسابات الرياضية', activeCompName],
        containsDemoData: false,
        requiresAdminConfirmation: true,
        pendingAction: {
          id: `act_recalc_${activeCompId}`,
          actionType: 'recalculate_standings',
          titleAr: `إعادة حساب ترتيب ${activeCompName}`,
          descriptionAr: `سيُعاد حساب جدول الترتيب بناءً على جميع المباريات المنتهية المعتمدة في ${activeCompName}.`,
          impactWarningAr: 'تعديل على جدول الترتيب العام — يتطلب تأكيد المدير.',
          payload: { competitionId: activeCompId },
        },
      },
      state
    );
  }

  if (isSendPushIntent) {
    const cleanMsg = prompt.replace(/^(?:أرسل|ارسل|بث|ابث)\s+إشعار(?:\s+عاجل)?(?:\s+عن)?\s*/i, '').trim();
    const notifTitle = cleanMsg ? `تنبيه وتين سبورت: ${cleanMsg.slice(0, 60)}` : 'تنبيه رياضي من وتين سبورت';
    return buildFinalResponse(
      {
        query: prompt,
        intent: 'sensitive_action_confirmation_required',
        answerText: 'إرسال إشعار فوري (Push Notification) سيصل إلى جميع الأجهزة المسجلة، لذا يمنع تنفيذه بدون موافقتك الصريحة.',
        bullets: [
          `عنوان الإشعار المقترح: ${notifTitle}`,
          `النص: ${cleanMsg || 'تحديث رياضي جديد عبر منصة وتين سبورت'}`,
        ],
        sourcesUsed: ['نظام الإشعارات الفورية (FCM Queue)'],
        containsDemoData: false,
        requiresAdminConfirmation: true,
        pendingAction: {
          id: `act_push_${Date.now()}`,
          actionType: 'send_breaking_notification',
          titleAr: 'بث إشعار فوري لجميع المستخدمين',
          descriptionAr: `سيُرسل الإشعار بعنوان "${notifTitle}" لجميع المشتركين.`,
          impactWarningAr: 'بث عام لجميع مستخدمي التطبيق — يتطلب تأكيد المدير.',
          payload: {
            title: notifTitle,
            body: cleanMsg || 'تابع أحدث النتائج والأخبار في وتين سبورت',
            competitionId: activeCompId,
          },
        },
      },
      state
    );
  }

  if (isModifyScoreIntent) {
    return buildFinalResponse(
      {
        query: prompt,
        intent: 'sensitive_action_blocked',
        answerText:
          'تعديل نتائج المباريات أو حذف السجلات إجراءات حساسة محمية بصلاحيات المدير المباشرة؛ افتح تبويب «المباريات والنتائج» لتنفيذ التعديل أو الحذف مع توثيق السبب في سجل المراجعة.',
        bullets: [
          'ممنوع تعديل أو حذف النتائج عبر الأوامر النصية الآلية دون مراجعة وتأكيد مباشر.',
        ],
        sourcesUsed: ['نظام حماية البيانات الإدارية'],
        containsDemoData: false,
        requiresAdminConfirmation: true,
      },
      state
    );
  }

  // ==========================================================================
  // 2) تجهيز منشور فيسبوك / إنستغرام من البيانات المعتمدة فقط
  // ==========================================================================
  if (/منشور|بوست|فيسبوك|انستغرام|انستقرام|facebook|instagram/.test(norm)) {
    const teamA = teams[0];
    const teamB = teams[1];
    const targetMatch =
      teamA && teamB
        ? (state.matches || []).find((m) => {
            const h = normalizeArabicTeamName(m.homeTeam);
            const a = normalizeArabicTeamName(m.awayTeam);
            const nA = normalizeArabicTeamName(teamA);
            const nB = normalizeArabicTeamName(teamB);
            return (h === nA && a === nB) || (h === nB && a === nA);
          })
        : (state.matches || []).find((m) => m.competitionId === activeCompId && m.status === 'finished') ||
          state.matches[0];

    const compRows = sortStandings(
      (state.standings || []).filter((s) => s.competitionId === activeCompId)
    );

    if (targetMatch && /مبارا|نتيج|موعد/.test(norm) || (teamA && teamB && targetMatch)) {
      const statusText = getMatchStatusArabicLabel(targetMatch.status, targetMatch.liveMinute);
      const scoreOrVs =
        targetMatch.status === 'upcoming'
          ? 'VS'
          : `${targetMatch.homeScore} - ${targetMatch.awayScore}`;
      const post = [
        `⚽ ${COMPETITIONS[targetMatch.competitionId]?.name || activeCompName} | ${targetMatch.round}`,
        `${targetMatch.homeTeam}  ${scoreOrVs}  ${targetMatch.awayTeam}`,
        `📍 الملعب: ${targetMatch.stadium || 'غير محدد'} | الحالة: ${statusText}`,
        `⏰ التوقيت: ${formatAmmanDateTime(targetMatch.kickoffIso)} (توقيت عمّان)`,
        '',
        'تابع التغطية الكاملة على تطبيق وتين سبورت 🇯🇴🟢',
        '#وتين_سبورت #الكرة_الأردنية #WateenSport',
      ].join('\n');

      return buildFinalResponse(
        {
          query: prompt,
          intent: 'social_post_match',
          answerText: 'تم تجهيز مسودة منشور فيسبوك/إنستغرام بالاستناد إلى بيانات المباراة المسجلة فقط:',
          bullets: [
            `المباراة: ${targetMatch.homeTeam} × ${targetMatch.awayTeam}`,
            `البيانات معتمدة بتاريخ آخر تحديث للمنصة.`,
          ],
          sourcesUsed: [
            'قاعدة مباريات وتين سبورت',
            COMPETITIONS[targetMatch.competitionId]?.name || activeCompName,
          ],
          containsDemoData: Boolean(targetMatch.isDemo),
          generatedSocialPost: post,
        },
        state
      );
    }

    if (compRows.length > 0) {
      const top5 = compRows.slice(0, 5).map(
        (r, idx) =>
          `${r.position || idx + 1}. ${r.teamName} — ${r.points} نقطة (لعب ${r.played})`
      );
      const post = [
        `🏆 جدول ترتيب ${activeCompName} (أبرز المراكز):`,
        ...top5,
        '',
        '📊 متابعة مستمرة عبر منصة وتين سبورت ⚽🇯🇴',
        '#وتين_سبورت #دوري_المحترفين #الكرة_الأردنية',
      ].join('\n');
      return buildFinalResponse(
        {
          query: prompt,
          intent: 'social_post_standings',
          answerText: `تم تجهيز منشور ترتيب ${activeCompName} من جدول الترتيب المعتمد حالياً:`,
          bullets: top5,
          sourcesUsed: [`جدول ترتيب ${activeCompName}`],
          containsDemoData: compRows.every((r) => r.isDemo === true),
          generatedSocialPost: post,
        },
        state
      );
    }

    return buildFinalResponse(
      {
        query: prompt,
        intent: 'social_post_no_data',
        answerText:
          'لا تتوفر حالياً بيانات مباراة أو جدول ترتيب مطابقة لتوليد المنشور دون اختلاق أرقام.',
        bullets: [],
        sourcesUsed: ['قاعدة بيانات وتين سبورت'],
        containsDemoData: false,
      },
      state
    );
  }

  // ==========================================================================
  // 3) مقارنة فريقين من الترتيب والمواجهات المباشرة المسجلة
  // ==========================================================================
  if (/قارن|مقارن|مواجه/.test(norm) && teams.length >= 2) {
    const teamA = teams[0];
    const teamB = teams[1];
    const infoA = getTeamStandingAndMatches(teamA, state);
    const infoB = getTeamStandingAndMatches(teamB, state);

    const normA = normalizeArabicTeamName(teamA);
    const normB = normalizeArabicTeamName(teamB);
    const h2hMatches = (state.matches || []).filter((m) => {
      const h = normalizeArabicTeamName(m.homeTeam);
      const a = normalizeArabicTeamName(m.awayTeam);
      return (h === normA && a === normB) || (h === normB && a === normA);
    });

    const bullets: string[] = [];
    if (infoA.standing) {
      const gdA = infoA.standing.goalsFor - infoA.standing.goalsAgainst;
      bullets.push(
        `${teamA}: المركز #${infoA.standing.position || '-'} • ${infoA.standing.points} نقطة • لعب ${infoA.standing.played} (فوز ${infoA.standing.won} / تعادل ${infoA.standing.drawn} / خسارة ${infoA.standing.lost}) • له ${infoA.standing.goalsFor} عليه ${infoA.standing.goalsAgainst} (فارق ${gdA})`
      );
    } else {
      bullets.push(`${teamA}: إحصائيات جدول الترتيب غير متوفرة حالياً في القاعدة.`);
    }

    if (infoB.standing) {
      const gdB = infoB.standing.goalsFor - infoB.standing.goalsAgainst;
      bullets.push(
        `${teamB}: المركز #${infoB.standing.position || '-'} • ${infoB.standing.points} نقطة • لعب ${infoB.standing.played} (فوز ${infoB.standing.won} / تعادل ${infoB.standing.drawn} / خسارة ${infoB.standing.lost}) • له ${infoB.standing.goalsFor} عليه ${infoB.standing.goalsAgainst} (فارق ${gdB})`
      );
    } else {
      bullets.push(`${teamB}: إحصائيات جدول الترتيب غير متوفرة حالياً في القاعدة.`);
    }

    if (h2hMatches.length > 0) {
      h2hMatches.slice(0, 3).forEach((m) => {
        bullets.push(
          `مواجهة مسجلة (${m.round}): ${m.homeTeam} ${
            m.status === 'upcoming' ? '×' : `${m.homeScore}-${m.awayScore}`
          } ${m.awayTeam}`
        );
      });
    } else {
      bullets.push(`المواجهات المباشرة بين ${teamA} و${teamB}: غير متوفرة في سجل المباريات الحالي.`);
    }

    return buildFinalResponse(
      {
        query: prompt,
        intent: 'compare_teams',
        answerText: `مقارنة رقمية بين ${teamA} و${teamB} من قاعدة بيانات وتين سبورت:`,
        bullets,
        sourcesUsed: ['سجل جدول الترتيب في وتين سبورت', 'سجل المباريات المعتمدة'],
        containsDemoData: Boolean(infoA.standing?.isDemo || infoB.standing?.isDemo),
      },
      state
    );
  }

  // ==========================================================================
  // 4) تحليل آخر 5 مباريات لفريق محدد
  // ==========================================================================
  if (/اخر 5|اخر خمس|تحليل|حلل|سلسله|مستوي/.test(norm) && teams.length >= 1) {
    const team = teams[0];
    const { standing, finished, upcoming } = getTeamStandingAndMatches(team, state);
    const last5 = finished.slice(0, 5);

    if (last5.length === 0) {
      return buildFinalResponse(
        {
          query: prompt,
          intent: 'analyze_last_5_empty',
          answerText: `لا توجد مباريات منتهية مسجلة لـ ${team} حالياً في قاعدة البيانات.`,
          bullets: [
            standing
              ? `سجل الترتيب الحالي: ${standing.points} نقطة من ${standing.played} مباراة (نموذج آخر 5: ${(standing.form || []).join('-') || 'غير متوفر'})`
              : 'بيانات الترتيب لهذا الفريق غير متوفرة حالياً.',
            upcoming[0]
              ? `المباراة القادمة: ${upcoming[0].homeTeam} × ${upcoming[0].awayTeam} (${upcoming[0].round})`
              : 'لا توجد مباراة قادمة مجدولة حالياً.',
          ],
          sourcesUsed: ['سجل المباريات وجدول الترتيب في وتين سبورت'],
          containsDemoData: Boolean(standing?.isDemo),
        },
        state
      );
    }

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let gf = 0;
    let ga = 0;
    const normT = normalizeArabicTeamName(team);
    const matchLines = last5.map((m) => {
      const isHome = normalizeArabicTeamName(m.homeTeam) === normT;
      const myScore = isHome ? m.homeScore : m.awayScore;
      const oppScore = isHome ? m.awayScore : m.homeScore;
      gf += myScore;
      ga += oppScore;
      if (myScore > oppScore) wins += 1;
      else if (myScore < oppScore) losses += 1;
      else draws += 1;
      return `${m.round}: ${m.homeTeam} (${m.homeScore}-${m.awayScore}) ${m.awayTeam}`;
    });

    return buildFinalResponse(
      {
        query: prompt,
        intent: 'analyze_last_5',
        answerText: `تحليل آخر ${last5.length} مباريات مسجلة لـ ${team}: فاز ${wins}، تعادل ${draws}، خسر ${losses} (سجل ${gf} واستقبل ${ga} هدفاً).`,
        bullets: [
          ...matchLines,
          upcoming[0]
            ? `المواجهة القادمة: ${upcoming[0].homeTeam} × ${upcoming[0].awayTeam} بتوقيت ${formatAmmanDateTime(upcoming[0].kickoffIso)}`
            : 'المباراة القادمة: غير متوفرة حالياً في الجدول.',
        ],
        sourcesUsed: ['سجل المباريات المعتمدة في وتين سبورت'],
        containsDemoData: last5.some((m) => m.isDemo === true),
      },
      state
    );
  }

  // ==========================================================================
  // 5) هداف الدوري وأفضل حارس مرمى
  // ==========================================================================
  if (/هداف|الهدافين|الحذاء/.test(norm)) {
    const scorers = [...(state.scorers || [])]
      .filter((s) => !detectedComp || s.competitionId === detectedComp.id)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists);

    if (scorers.length === 0) {
      return buildFinalResponse(
        {
          query: prompt,
          intent: 'top_scorers_empty',
          answerText: `لا توجد إحصائيات هدافين مسجلة لـ ${activeCompName} حالياً (غير متوفر).`,
          bullets: [],
          sourcesUsed: [`قائمة الهدافين — ${activeCompName}`],
          containsDemoData: false,
        },
        state
      );
    }

    const top = scorers[0];
    return buildFinalResponse(
      {
        query: prompt,
        intent: 'top_scorers',
        answerText: `متصدر قائمة الهدافين في ${COMPETITIONS[top.competitionId]?.name || activeCompName} هو ${top.playerName} (${top.teamName}) برصيد ${top.goals} هدفاً و${top.assists} صناعة في ${top.matches} مباراة.`,
        bullets: scorers
          .slice(0, 5)
          .map(
            (s, i) =>
              `#${i + 1} ${s.playerName} (${s.teamName}) — ${s.goals} هدف • ${s.assists} أسيست`
          ),
        sourcesUsed: [`قائمة هدافي ${activeCompName} في وتين سبورت`],
        containsDemoData: Boolean(top.isDemo),
      },
      state
    );
  }

  if (/حارس|الشباك النظيفه|كلين شيت/.test(norm)) {
    const gks = [...(state.goalkeepers || [])]
      .filter((g) => !detectedComp || g.competitionId === detectedComp.id)
      .sort((a, b) => b.cleanSheets - a.cleanSheets || a.goalsConceded - b.goalsConceded);

    if (gks.length === 0) {
      return buildFinalResponse(
        {
          query: prompt,
          intent: 'goalkeepers_empty',
          answerText: `إحصائيات حراس المرمى لـ ${activeCompName} غير متوفرة حالياً.`,
          bullets: [],
          sourcesUsed: [`إحصائيات الحراس — ${activeCompName}`],
          containsDemoData: false,
        },
        state
      );
    }

    const best = gks[0];
    return buildFinalResponse(
      {
        query: prompt,
        intent: 'goalkeepers',
        answerText: `أفضل حارس بالشباك النظيفة هو ${best.playerName} (${best.teamName}) بـ ${best.cleanSheets} شباك نظيفة واستقبل ${best.goalsConceded} هدفاً.`,
        bullets: gks
          .slice(0, 5)
          .map(
            (g, i) =>
              `#${i + 1} ${g.playerName} (${g.teamName}) — ${g.cleanSheets} كلين شيت • استقبل ${g.goalsConceded}`
          ),
        sourcesUsed: [`إحصائيات الحراس في وتين سبورت`],
        containsDemoData: Boolean(best.isDemo),
      },
      state
    );
  }

  // ==========================================================================
  // 6) الإصابات والجاهزية الطبية الموثقة
  // ==========================================================================
  if (/اصاب|مصاب|طبي|جاهزيه/.test(norm)) {
    const injuries = (state.injuries || []).filter((inj) => {
      if (teams.length > 0) {
        return teams.some(
          (t) => normalizeArabicTeamName(t) === normalizeArabicTeamName(inj.teamName)
        );
      }
      if (detectedComp) return inj.competitionId === detectedComp.id;
      return true;
    });

    if (injuries.length === 0) {
      return buildFinalResponse(
        {
          query: prompt,
          intent: 'injuries_empty',
          answerText: 'لا توجد تقارير إصابات رسمية مسجلة حالياً ضمن هذا النطاق.',
          bullets: ['لا يُنشر أي تشخيص طبي إلا بوجود مصدر رسمي موثّق.'],
          sourcesUsed: ['القسم الطبي الإخباري في وتين سبورت'],
          containsDemoData: false,
        },
        state
      );
    }

    return buildFinalResponse(
      {
        query: prompt,
        intent: 'injuries',
        answerText: `تم رصد ${injuries.length} تقارير إصابات وجاهزية موثقة بمصادر رسمية:`,
        bullets: injuries.slice(0, 6).map(
          (inj) =>
            `${inj.playerName} (${inj.teamName}): ${inj.declaredInjury} — الحالة: ${INJURY_STATUS_META[inj.returnStatus].label} • الغياب: ${inj.declaredAbsenceDuration} (المصدر: ${inj.sourceName})`
        ),
        sourcesUsed: Array.from(new Set(injuries.map((i) => i.sourceName))),
        containsDemoData: false,
      },
      state
    );
  }

  // ==========================================================================
  // 7) جدول الترتيب وأقوى هجوم ودفاع
  // ==========================================================================
  if (/ترتيب|صداره|متصدر|اقوي هجوم|اقوي دفاع/.test(norm)) {
    const compRows = sortStandings(
      (state.standings || []).filter((s) => s.competitionId === activeCompId)
    );
    if (compRows.length === 0) {
      return buildFinalResponse(
        {
          query: prompt,
          intent: 'standings_empty',
          answerText: `جدول ترتيب ${activeCompName} غير متوفر حالياً في قاعدة البيانات.`,
          bullets: [],
          sourcesUsed: [`جداول الترتيب — ${activeCompName}`],
          containsDemoData: false,
        },
        state
      );
    }

    const summary = computeCompetitionStatsSummary(
      activeCompId,
      state.standings,
      state.matches,
      state.goalkeepers || []
    );

    const bullets = compRows
      .slice(0, 6)
      .map(
        (r, i) =>
          `#${r.position || i + 1} ${r.teamName} — ${r.points} نقطة (لعب ${r.played} • ف ${r.won} • ت ${r.drawn} • خ ${r.lost} • له ${r.goalsFor} عليه ${r.goalsAgainst})`
      );
    if (summary.bestAttack) {
      bullets.push(
        `أقوى هجوم: ${summary.bestAttack.teamName} (${summary.bestAttack.goalsFor} هدفاً)`
      );
    }
    if (summary.bestDefense) {
      bullets.push(
        `أقوى دفاع: ${summary.bestDefense.teamName} (استقبل ${summary.bestDefense.goalsAgainst} أهداف)`
      );
    }

    return buildFinalResponse(
      {
        query: prompt,
        intent: 'standings',
        answerText: `جدول ترتيب ${activeCompName} — يتصدره ${compRows[0].teamName} برصيد ${compRows[0].points} نقطة:`,
        bullets,
        sourcesUsed: [`جدول ترتيب ${activeCompName} في وتين سبورت`],
        containsDemoData: compRows.every((r) => r.isDemo === true),
      },
      state
    );
  }

  // ==========================================================================
  // 8) المباريات المباشرة أو القادمة أو نتائج فريق
  // ==========================================================================
  if (/مبار|نتائج|مباشر|قادمه|اليوم|جدول/.test(norm)) {
    const matches = (state.matches || []).filter((m) => {
      if (teams.length > 0) {
        return teams.some(
          (t) =>
            normalizeArabicTeamName(m.homeTeam) === normalizeArabicTeamName(t) ||
            normalizeArabicTeamName(m.awayTeam) === normalizeArabicTeamName(t)
        );
      }
      if (detectedComp) return m.competitionId === detectedComp.id;
      if (/مباشر/.test(norm)) return isLiveMatchStatus(m.status);
      if (/قادمه|اليوم/.test(norm)) return m.status === 'upcoming';
      return true;
    });

    if (matches.length === 0) {
      return buildFinalResponse(
        {
          query: prompt,
          intent: 'matches_empty',
          answerText: 'لا توجد مباريات مطابقة لاستعلامك حالياً في قاعدة البيانات.',
          bullets: [],
          sourcesUsed: ['سجل المباريات في وتين سبورت'],
          containsDemoData: false,
        },
        state
      );
    }

    return buildFinalResponse(
      {
        query: prompt,
        intent: 'matches',
        answerText: `تم العثور على ${matches.length} مباراة مطابقة:`,
        bullets: matches.slice(0, 6).map(
          (m) =>
            `${m.homeTeam} (${m.status === 'upcoming' ? 'VS' : `${m.homeScore}-${m.awayScore}`}) ${m.awayTeam} — ${getMatchStatusArabicLabel(m.status, m.liveMinute)} • ${m.stadium || 'ملعب غير محدد'}`
        ),
        sourcesUsed: ['سجل مباريات وتين سبورت (بتوقيت عمّان)'],
        containsDemoData: matches.every((m) => m.isDemo === true),
      },
      state
    );
  }

  // ==========================================================================
  // 9) آخر الأخبار وحالة النظام ومصادر الأخبار
  // ==========================================================================
  if (/حاله النظام|طابور|مصادر|اخطاء|تشخيص|تقرير عام/.test(norm)) {
    const sources = state.newsSources || [];
    const okCount = sources.filter((s) => s.lastStatus === 'ok').length;
    const errCount = sources.filter((s) => s.lastStatus === 'error').length;
    const queueCount = (state.reviewQueueArticles || []).length;
    const pendingImports = (state.importBatches || []).filter(
      (b) => b.status === 'Pending Review' || b.status === 'Needs Correction'
    ).length;

    return buildFinalResponse(
      {
        query: prompt,
        intent: 'system_health',
        answerText: `ملخص حالة منصة WATEEN SPORT AI: ${state.articles.length} خبر منشور، ${queueCount} أخبار في طابور المراجعة، ${pendingImports} دفعة استيراد معلّقة، و${sources.length} مصادر أخبار مربوطة.`,
        bullets: [
          `المباريات المسجلة: ${state.matches.length} (منها ${state.matches.filter((m) => isLiveMatchStatus(m.status)).length} مباشرة الآن)`,
          `صفوف الترتيب: ${state.standings.length} • الهدافون: ${state.scorers.length} • الإصابات: ${(state.injuries || []).length}`,
          `المصادر: ${okCount} سليمة • ${errCount} بها خطأ اتصال • ${sources.length - okCount - errCount} بانتظار الفحص`,
          `السقف المالي AI: $${(state.automationSettings?.monthlySpentEstimateUsd || 0).toFixed(2)} من أصل $${state.automationSettings?.monthlyBudgetUsd || 10}`,
        ],
        sourcesUsed: ['سجل المراقبة المركزي لـ WATEEN SPORT AI'],
        containsDemoData: false,
      },
      state
    );
  }

  // آخر الأخبار (افتراضي لأي سؤال عن أخبار نادٍ أو بطولة أو خبر)
  const matchingArticles: NewsArticle[] = (state.articles || []).filter((art) => {
    if (teams.length > 0) {
      return teams.some((t) =>
        normalizeArabicTeamName(`${art.title} ${art.summary}`).includes(normalizeArabicTeamName(t))
      );
    }
    if (detectedComp) return art.competitionId === detectedComp.id;
    const words = norm.split(' ').filter((w) => w.length >= 3);
    if (/اخبار|خبر|مستجدات/.test(norm) && words.length <= 3) return true;
    return words.some((w) => normalizeArabicTeamName(`${art.title} ${art.summary}`).includes(w));
  });

  if (matchingArticles.length > 0) {
    const sources = Array.from(
      new Set(
        matchingArticles
          .slice(0, 5)
          .map((a) => a.sourceName || a.author || 'إدارة وتين سبورت')
      )
    );
    return buildFinalResponse(
      {
        query: prompt,
        intent: 'news_lookup',
        answerText: `إليك أحدث ${Math.min(5, matchingArticles.length)} أخبار مطابقة في قاعدة البيانات:`,
        bullets: matchingArticles.slice(0, 5).map(
          (a) =>
            `• ${a.title} (${formatAmmanDateTime(a.publishedAt)} — المصدر: ${a.sourceName || a.author})`
        ),
        sourcesUsed: sources,
        containsDemoData: matchingArticles.every((a) => a.isDemo === true),
      },
      state
    );
  }

  return buildFinalResponse(
    {
      query: prompt,
      intent: 'no_matching_data',
      answerText:
        'لم يتم العثور على بيانات مطابقة لهذا الطلب في قاعدة البيانات الحالية، ولا يُمكن اختلاق معلومات غير موثّقة.',
      bullets: [
        `البطولات النشطة المتوفرة حالياً: ${PRIMARY_COMPETITION_LIST.slice(0, 4)
          .map((id) => COMPETITIONS[id].shortName)
          .join('، ')}`,
        'جرّب سؤالاً مثل: «من هو هداف الدوري؟» أو «قارن بين الفيصلي والوحدات» أو «حلل آخر 5 مباريات للحسين إربد».',
      ],
      sourcesUsed: ['قاعدة بيانات وتين سبورت'],
      containsDemoData: false,
    },
    state
  );
}
