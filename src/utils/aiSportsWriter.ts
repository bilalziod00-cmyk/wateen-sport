import { CompetitionId, NewsCategoryTag, StatPair } from '../types/sports';
import { COMPETITIONS } from '../constants/competitions';

export interface AiGeneratedArticleDraft {
  title: string;
  summary: string;
  content: string;
  competitionId: CompetitionId;
  tag: NewsCategoryTag;
  isBreaking: boolean;
  statsCard?: {
    title: string;
    items: StatPair[];
  };
  usedEngine: 'gemini' | 'instant_local';
}

// كشف البطولة الأردنية تلقائياً من الملاحظة السريعة
function detectCompetition(prompt: string): CompetitionId {
  const p = prompt.toLowerCase();
  if (/تحت\s*20|الشباب|شباب تحت/.test(p)) return 'youth_u20';
  if (/تحت\s*17|الناشئين|ناشئين/.test(p)) return 'youth_u17';
  if (/تحت\s*15|الأشبال|اشبال/.test(p)) return 'youth_u15';
  if (/واعدين|الواعدين|براعم|أكاديميات/.test(p)) return 'youth_grassroots';
  if (/النشامى|المنتخب|الأولمبي|التعمري|النعيمات/.test(p)) return 'national_teams';
  if (/كأس الأردن|الكأس|كاس الاردن/.test(p)) return 'jordan_cup';
  if (/الدرجة الثالثة|درجة ثالثة|المفرق|عجلون|مؤتة|الهاشمية/.test(p)) return 'third_div';
  if (/الدرجة الثانية|درجة ثانية|الكرمل|الطرة|دوقرة|الحصن|الطفيلة/.test(p)) return 'second_div';
  if (/الدرجة الأولى|درجة أولى|درجة اولى|العربي|كفرسوم|اتحاد الرمثا|البقعة|سحاب|الجليل|اليرموك/.test(p))
    return 'first_div';
  if (
    /المحترفين|الحسين|الفيصلي|الوحدات|الرمثا|السلط|شباب الأردن|الأهلي|الجزيرة|الصريح|معان|العقبة|مغير/.test(
      p
    )
  ) {
    return 'pro_league';
  }
  return 'general';
}

// كشف نوع التغطية تلقائياً
function detectTag(prompt: string): NewsCategoryTag {
  if (/تعاقد|انتقال|صفقة|وقّع|وقع|ميركاتو|إعارة|اعارة|ضم|انضم/.test(prompt)) return 'transfers';
  if (/إصابة|اصابة|تقرير طبي|جاهزية|تعافي|غياب|فحوصات/.test(prompt)) return 'injuries';
  if (/تحليل|تكتيك|أرقام|ارقام|إحصائ|احصائ|استحواذ/.test(prompt)) return 'tactical_analysis';
  if (/فاز|فوز|انتصر|انتصار|تعادل|خسر|خسارة|هزم|سحق|هدف|أهداف|\d+\s*[-–:]\s*\d+/.test(prompt))
    return 'match_report';
  if (/قرار|اتحاد|رسمياً|رسميا|بيان|عقوبة|تأجيل|موعد/.test(prompt)) return 'official';
  return 'club_news';
}

// محرك صياغة صحفية ذكي فوري بدون الحاجة لأي API خارجي
function generateInstantArabicDraft(rawNote: string): AiGeneratedArticleDraft {
  const note = rawNote.trim();
  const competitionId = detectCompetition(note);
  const tag = detectTag(note);
  const compName = COMPETITIONS[competitionId].name;
  const isBreaking = /عاجل|رسمياً|رسميا|فاز|تعاقد|إصابة|هدف|إقالة|اقالة/.test(note);
  const scoreMatch = note.match(/(\d+)\s*[-–:]\s*(\d+)/);

  let title = note;
  if (tag === 'transfers') {
    title = note.startsWith('عاجل') ? note : `رسمياً في الميركاتو: ${note}`;
  } else if (tag === 'match_report') {
    title = note.startsWith('عاجل') ? note : `${note} في قمة ${compName}`;
  } else if (tag === 'injuries') {
    title = `تحديث طبي وجاهزية: ${note}`;
  } else if (tag === 'tactical_analysis') {
    title = `تحليل وتين الرقمي: ${note}`;
  } else if (isBreaking && !note.startsWith('عاجل')) {
    title = `عاجل | ${note}`;
  }

  const summary =
    tag === 'transfers'
      ? `تطورات متسارعة في سوق الانتقالات الأردنية ضمن ${compName}؛ ${note} في خطوة تعزز الطموحات خلال المرحلة المقبلة.`
      : tag === 'match_report'
      ? `شهدت منافسات ${compName} أحداثاً مثيرة؛ حيث ${note} وسط متابعة جماهيرية وإعلامية واسعة عبر وتين سبورت.`
      : tag === 'injuries'
      ? `متابعة خاصة من وتين سبورت للحالة الطبية والجاهزية البدنية؛ ${note} قبل الاستحقاقات القادمة في ${compName}.`
      : `متابعة حصرية من وتين سبورت لأحدث مستجدات ${compName}: ${note}.`;

  const paragraph2 =
    tag === 'transfers'
      ? `وتأتي هذه الخطوة ضمن خطة الإدارة والجهاز الفني لتدعيم الصفوف بعناصر قادرة على صناعة الفارق في الاستحقاقات المحلية، وسط ترحيب كبير من الجماهير التي تترقب الظهور الأول في الملاعب الأردنية.`
      : tag === 'match_report'
      ? `وفرض الإيقاع التكتيكي والالتزام البدني كلمته على مجريات اللقاء، حيث نجحت الكتيبة الفنية في استثمار التحولات السريعة والكرات الثابتة لترجيح الكفة وحصد نتيجة مؤثرة في سباق ${compName}.`
      : tag === 'injuries'
      ? `ويخضع اللاعب لمتابعة دقيقة من الكادر الطبي وخبراء التأهيل لتسريع وتيرة العودة الآمنة إلى التدريبات الجماعية دون مجازفة، مع تجهيز البدائل الفنية المناسبة.`
      : `وتتابع عدسة «وتين سبورت» كافة التفاصيل أولاً بأول من قلب الملاعب والأندية الأردنية، مع رصد الأرقام والإحصائيات وردود الفعل الرسمية حال صدورها.`;

  const paragraph3 = `ابقَ على تواصل دائم مع تطبيق «وتين سبورت» لمتابعة النتائج اللحظية بتوقيت عمّان، جداول الترتيب المحدّثة، والتغطية الخاصة لجميع الدرجات والفئات العمرية في الكرة الأردنية.`;

  const content = `${note}.\n\n${paragraph2}\n\n${paragraph3}`;

  const statsItems: StatPair[] = [
    { label: 'البطولة', value: COMPETITIONS[competitionId].shortName, highlight: true },
    {
      label: 'نوع التغطية',
      value:
        tag === 'transfers'
          ? 'انتقالات'
          : tag === 'match_report'
          ? 'نتيجة مباراة'
          : tag === 'injuries'
          ? 'تقرير طبي'
          : tag === 'tactical_analysis'
          ? 'تحليل رقمي'
          : 'متابعة خاصة',
    },
  ];
  if (scoreMatch) {
    statsItems.unshift({
      label: 'النتيجة المسجلة',
      value: `${scoreMatch[1]} - ${scoreMatch[2]}`,
      highlight: true,
    });
  }

  return {
    title: title.slice(0, 120),
    summary,
    content,
    competitionId,
    tag,
    isBreaking,
    statsCard: {
      title: `ملخص سريع — ${COMPETITIONS[competitionId].shortName}`,
      items: statsItems,
    },
    usedEngine: 'instant_local',
  };
}

/**
 * الصياغة بالذكاء الاصطناعي:
 * - إذا أدخل المالك مفتاح Google Gemini API المجاني: يستخدم نموذج Gemini Flash الحقيقي.
 * - وإذا لم يُدخل مفتاحاً: يعمل المحرر الذكي المدمج فوراً 100% مجاناً وبدون انتظار.
 */
export async function generateSportsArticleWithAI(
  shortIdea: string,
  geminiApiKey?: string
): Promise<AiGeneratedArticleDraft> {
  const localDraft = generateInstantArabicDraft(shortIdea);

  const apiKey = geminiApiKey?.trim();
  if (!apiKey) {
    return localDraft;
  }

  try {
    const prompt = `أنت محرر رياضي محترف في تطبيق "وتين سبورت" المتخصص بالكرة الأردنية.
حوّل هذه الملاحظة القصيرة إلى خبر رياضي عربي احترافي متكامل بصيغة JSON فقط بدون أي نص إضافي أو علامات markdown:
الملاحظة: "${shortIdea}"

أعد كائن JSON بهذه الحقول بالضبط:
{
  "title": "عنوان صحفي جذاب وقوي باللغة العربية",
  "summary": "ملخص من جملتين",
  "content": "نص الخبر الكامل من 3 فقرات احترافية مفصولة بسطر فارغ",
  "isBreaking": true or false,
  "statsTitle": "عنوان بطاقة أرقام مختصرة",
  "stats": [{"label": "مؤشر", "value": "قيمة"}]
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!res.ok) return localDraft;
    const json = await res.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return localDraft;

    const cleaned = rawText.replace(/^```json\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      title: parsed.title || localDraft.title,
      summary: parsed.summary || localDraft.summary,
      content: parsed.content || localDraft.content,
      competitionId: localDraft.competitionId,
      tag: localDraft.tag,
      isBreaking: typeof parsed.isBreaking === 'boolean' ? parsed.isBreaking : localDraft.isBreaking,
      statsCard:
        Array.isArray(parsed.stats) && parsed.stats.length > 0
          ? {
              title: parsed.statsTitle || localDraft.statsCard?.title || 'أرقام وتين سبورت',
              items: parsed.stats.slice(0, 4).map((s: StatPair, i: number) => ({
                label: String(s.label || ''),
                value: String(s.value || ''),
                highlight: i === 0,
              })),
            }
          : localDraft.statsCard,
      usedEngine: 'gemini',
    };
  } catch {
    return localDraft;
  }
}
