import React, { useRef, useState } from 'react';
import {
  BarChart3,
  Edit3,
  Flame,
  ImagePlus,
  KeyRound,
  Plus,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { COMPETITIONS, NEWS_TAG_LABELS } from '../../constants/competitions';
import { CompetitionId, NewsArticle, NewsCategoryTag, StatPair } from '../../types/sports';
import { processImageFile } from '../../utils/imageUpload';
import { formatRelativeAmman } from '../../utils/ammanTime';
import { generateSportsArticleWithAI } from '../../utils/aiSportsWriter';

const EMPTY_ARTICLE: Omit<NewsArticle, 'id' | 'publishedAt' | 'views'> = {
  title: '',
  summary: '',
  content: '',
  competitionId: 'pro_league',
  tag: 'club_news',
  isBreaking: false,
  imageUrl: './images/stadium-night.jpg',
  author: 'إدارة وتين سبورت',
};

export const AdminNewsManager: React.FC = () => {
  const {
    data,
    saveArticle,
    deleteArticle,
    toggleArticleBreaking,
    uploadImageAsset,
    saveGeminiApiKey,
    showToast,
  } = useAppData();

  const formRef = useRef<HTMLFormElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_ARTICLE);
  const [includeStats, setIncludeStats] = useState(false);
  const [statsTitle, setStatsTitle] = useState('');
  const [statsItems, setStatsItems] = useState<StatPair[]>([
    { label: '', value: '', highlight: true },
    { label: '', value: '' },
  ]);
  const [uploading, setUploading] = useState(false);

  // مساعد الصياغة السريعة بالذكاء الاصطناعي
  const [aiIdea, setAiIdea] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiKeyBox, setShowAiKeyBox] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(data.geminiApiKey || '');

  const scrollToForm = () => {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_ARTICLE);
    setIncludeStats(false);
    setStatsTitle('');
    setStatsItems([
      { label: '', value: '', highlight: true },
      { label: '', value: '' },
    ]);
    setShowForm(true);
    scrollToForm();
  };

  const openEdit = (art: NewsArticle) => {
    setEditingId(art.id);
    setForm({
      title: art.title,
      summary: art.summary,
      content: art.content,
      competitionId: art.competitionId,
      tag: art.tag,
      isBreaking: art.isBreaking,
      imageUrl: art.imageUrl,
      author: art.author,
    });
    if (art.statsCard && art.statsCard.items.length > 0) {
      setIncludeStats(true);
      setStatsTitle(art.statsCard.title);
      setStatsItems(art.statsCard.items);
    } else {
      setIncludeStats(false);
      setStatsTitle('');
      setStatsItems([
        { label: '', value: '', highlight: true },
        { label: '', value: '' },
      ]);
    }
    setShowForm(true);
    scrollToForm();
  };

  // توليد الخبر بالذكاء الاصطناعي (تعبئة للنموذج أو نشر فوري بضغطة زر)
  const handleAiGenerate = async (publishImmediately: boolean) => {
    if (!aiIdea.trim()) {
      showToast('اكتب سطراً واحداً عن الخبر أولاً (مثلاً: الحسين فاز 2-1 على الفيصلي)', 'amber');
      return;
    }
    setAiLoading(true);
    try {
      const draft = await generateSportsArticleWithAI(aiIdea.trim(), data.geminiApiKey);
      const imageUrl =
        draft.tag === 'match_report' || draft.tag === 'tactical_analysis'
          ? './images/match-action.jpg'
          : './images/stadium-night.jpg';

      if (publishImmediately) {
        const newArticle: NewsArticle = {
          id: `art-${Date.now()}`,
          title: draft.title,
          summary: draft.summary,
          content: draft.content,
          competitionId: draft.competitionId,
          tag: draft.tag,
          isBreaking: draft.isBreaking,
          imageUrl,
          author: 'محرر وتين الذكي • وتين سبورت',
          publishedAt: new Date().toISOString(),
          views: 1,
          statsCard: draft.statsCard,
        };
        await saveArticle(newArticle);
        setAiIdea('');
        showToast(
          draft.usedEngine === 'gemini'
            ? '⚡ تم صياغة ونشر الخبر فوراً عبر Gemini AI!'
            : '⚡ تم صياغة ونشر الخبر فوراً بالذكاء الاصطناعي!',
          'emerald'
        );
      } else {
        setEditingId(null);
        setForm({
          title: draft.title,
          summary: draft.summary,
          content: draft.content,
          competitionId: draft.competitionId,
          tag: draft.tag,
          isBreaking: draft.isBreaking,
          imageUrl,
          author: 'فريق تحرير وتين سبورت',
        });
        if (draft.statsCard) {
          setIncludeStats(true);
          setStatsTitle(draft.statsCard.title);
          setStatsItems(draft.statsCard.items);
        }
        setShowForm(true);
        scrollToForm();
        showToast('✨ تم تجهيز الخبر كاملاً — راجعه واضغط "نشر الخبر الآن"', 'emerald');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { dataUrl, blob } = await processImageFile(file, 1080, 0.82);
      const finalUrl = await uploadImageAsset(blob, dataUrl, 'news');
      setForm((prev) => ({ ...prev, imageUrl: finalUrl }));
      showToast('تم رفع وتجهيز صورة الخبر بنجاح', 'emerald');
    } catch {
      showToast('تعذر معالجة الصورة المختارة', 'crimson');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      showToast('يرجى إدخال عنوان الخبر ونصه الكامل', 'crimson');
      return;
    }

    const existing = editingId ? data.articles.find((a) => a.id === editingId) : null;
    const validStats = statsItems.filter((s) => s.label.trim() && s.value.trim());

    const article: NewsArticle = {
      id: editingId || `art-${Date.now()}`,
      ...form,
      summary: form.summary.trim() || form.content.trim().slice(0, 140),
      publishedAt: existing?.publishedAt || new Date().toISOString(),
      views: existing?.views ?? 1,
      statsCard:
        includeStats && validStats.length > 0
          ? {
              title: statsTitle.trim() || 'بطاقة أرقام وتين سبورت',
              items: validStats,
            }
          : undefined,
    };

    await saveArticle(article);
    setShowForm(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* ⚡ مساعد التحرير السريع بالذكاء الاصطناعي */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600/20 via-[#121D2E] to-[#0B121B] border border-emerald-400/40 p-4 space-y-3 shadow-glow">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                محرر وتين السريع بالذكاء الاصطناعي ⚡
              </h3>
              <p className="text-[11px] text-slate-300">
                اكتب جملة واحدة فقط وسيكتب الذكاء الاصطناعي العنوان والمقال والتصنيف وبطاقة الأرقام فوراً!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAiKeyBox((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 text-[10px] font-bold text-amber-300 shrink-0"
          >
            <KeyRound className="w-3 h-3" />
            {data.geminiApiKey ? 'Gemini مفعّل' : 'مفتاح Gemini (اختياري)'}
          </button>
        </div>

        {showAiKeyBox && (
          <div className="rounded-xl bg-black/40 border border-amber-400/25 p-3 space-y-2">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              يعمل المحرر الذكي تلقائياً بدون مفتاح، وإذا أردت صياغة متقدمة عبر{' '}
              <strong className="text-amber-300">Google Gemini</strong> الصق مفتاحك المجاني هنا:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                dir="ltr"
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 rounded-xl bg-[#070B10] border border-white/15 px-3 py-1.5 text-xs text-white text-left"
              />
              <button
                type="button"
                onClick={() => {
                  saveGeminiApiKey(geminiKeyInput);
                  setShowAiKeyBox(false);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-pitch-950 font-black text-xs"
              >
                حفظ
              </button>
            </div>
          </div>
        )}

        <textarea
          rows={2}
          value={aiIdea}
          onChange={(e) => setAiIdea(e.target.value)}
          placeholder="مثال: الوحدات يفوز على الرمثا 2-0 في ستاد الملك عبدالله بتألق مهند سمرين..."
          className="w-full rounded-2xl bg-[#070B10]/90 border border-white/15 focus:border-emerald-400 focus:outline-none px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500"
        />

        {/* أمثلة سريعة بضغطة زر */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            'الفيصلي يتعاقد مع مهاجم دولي جديد لمدة موسمين',
            'الحسين إربد يفوز 3-1 ويواصل صدارة المحترفين',
            'تألق كبير لنجوم تحت 20 سنة وتصعيد موهبتين للفريق الأول',
          ].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setAiIdea(ex)}
              className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-[10px] font-bold text-slate-300 whitespace-nowrap"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => handleAiGenerate(true)}
            className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-pitch-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-glow"
          >
            <Zap className="w-4 h-4 fill-current" />
            {aiLoading ? 'جاري الصياغة...' : 'صياغة ونشر فوري بضغطة واحدة'}
          </button>

          <button
            type="button"
            disabled={aiLoading}
            onClick={() => handleAiGenerate(false)}
            className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            صياغة وفتح للتعديل قبل النشر
          </button>
        </div>
      </div>

      {/* شريط العنوان وزر الإضافة اليدوية */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base font-black text-white">الأخبار المنشورة ({data.articles.length})</h2>
          <p className="text-[11px] text-slate-400">
            اضغط على «تعديل» تحت أي خبر لتعديله فوراً أو أضف خبراً يدوياً
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black text-xs shrink-0"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          خبر يدوي
        </button>
      </div>

      {/* نموذج الإضافة / التعديل */}
      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#111B29] border border-emerald-500/45 p-4 sm:p-5 space-y-4 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-black text-emerald-300">
              {editingId ? '✏️ تعديل الخبر المختار' : 'نشر خبر جديد في وتين سبورت'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 text-xs text-slate-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
              إغلاق
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">عنوان الخبر *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: عاجل.. الوحدات يعلن التعاقد مع مهاجم جديد..."
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3.5 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                الدرجة / الفئة / البطولة
              </label>
              <select
                value={form.competitionId}
                onChange={(e) =>
                  setForm({ ...form, competitionId: e.target.value as CompetitionId })
                }
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2.5 text-xs sm:text-sm text-white focus:border-emerald-400 focus:outline-none"
              >
                {Object.values(COMPETITIONS).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">نوع التغطية</label>
              <select
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value as NewsCategoryTag })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2.5 text-xs sm:text-sm text-white focus:border-emerald-400 focus:outline-none"
              >
                {Object.entries(NEWS_TAG_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">ملخص قصير</label>
              <input
                type="text"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="سطر تمهيدي يظهر في الصفحة الرئيسية..."
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">نص الخبر الكامل *</label>
              <textarea
                rows={5}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="اكتب تفاصيل الخبر والتحليل هنا..."
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-emerald-400 focus:outline-none leading-relaxed"
                required
              />
            </div>

            {/* رفع صورة أو رابط صورة */}
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-xs font-bold text-slate-300">صورة الخبر</label>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-extrabold cursor-pointer">
                  <ImagePlus className="w-4 h-4" />
                  {uploading ? 'جاري الرفع...' : 'رفع صورة من الجهاز'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImagePick}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="أو الصق رابط الصورة..."
                  className="flex-1 min-w-[200px] rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-slate-200 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              {form.imageUrl && (
                <img
                  src={form.imageUrl}
                  alt="معاينة"
                  className="h-28 w-48 object-cover rounded-xl border border-white/15"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم المحرر / المصدر</label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <label className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 cursor-pointer">
                <span className="text-xs font-extrabold text-rose-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  وسم كخبر عاجل في الرئيسية
                </span>
                <input
                  type="checkbox"
                  checked={form.isBreaking}
                  onChange={(e) => setForm({ ...form, isBreaking: e.target.checked })}
                  className="w-4 h-4 accent-rose-500"
                />
              </label>
            </div>
          </div>

          {/* إرفاق بطاقة إحصائية اختيارية */}
          <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" />
                إرفاق بطاقة إحصائية رقمية داخل صفحة الخبر
              </span>
              <input
                type="checkbox"
                checked={includeStats}
                onChange={(e) => setIncludeStats(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>

            {includeStats && (
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <input
                  type="text"
                  value={statsTitle}
                  onChange={(e) => setStatsTitle(e.target.value)}
                  placeholder="عنوان البطاقة الإحصائية (مثال: أرقام اللاعب هذا الموسم)"
                  className="w-full rounded-lg bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
                />
                {statsItems.map((st, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      type="text"
                      value={st.label}
                      onChange={(e) =>
                        setStatsItems((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item))
                        )
                      }
                      placeholder="المؤشر (مثال: الأهداف)"
                      className="rounded-lg bg-[#070B10] border border-white/12 px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={st.value}
                      onChange={(e) =>
                        setStatsItems((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item))
                        )
                      }
                      placeholder="القيمة (مثال: 12 هدفاً)"
                      className="rounded-lg bg-[#070B10] border border-white/12 px-2.5 py-1.5 text-xs text-emerald-300 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setStatsItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="px-2 rounded-lg bg-rose-500/15 text-rose-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setStatsItems((prev) => [...prev, { label: '', value: '' }])}
                  className="text-[11px] font-bold text-emerald-400 hover:underline"
                >
                  + إضافة مؤشر إحصائي آخر
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl bg-white/8 text-xs font-bold text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-pitch-950 font-black text-xs shadow-glow"
            >
              {editingId ? 'حفظ التعديلات فوراً' : 'نشر الخبر الآن'}
            </button>
          </div>
        </form>
      )}

      {/* قائمة الأخبار مع أزرار عربية واضحة للتعديل والحذف */}
      <div className="space-y-2.5">
        {data.articles.map((art) => (
          <div
            key={art.id}
            className="rounded-2xl bg-[#0E1621] border border-white/8 p-3.5 space-y-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={art.imageUrl || './images/stadium-night.jpg'}
                alt={art.title}
                className="w-16 h-14 rounded-xl object-cover shrink-0 border border-white/10 bg-pitch-900"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  {art.isBreaking && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black">
                      عاجل
                    </span>
                  )}
                  <span className="text-emerald-400 font-bold">
                    {COMPETITIONS[art.competitionId].shortName}
                  </span>
                  <span className="text-slate-500">• {formatRelativeAmman(art.publishedAt)}</span>
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-white line-clamp-2 mt-0.5">
                  {art.title}
                </h4>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => openEdit(art)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300 text-xs font-extrabold"
              >
                <Edit3 className="w-3.5 h-3.5" />
                تعديل الخبر
              </button>
              <button
                type="button"
                onClick={() => toggleArticleBreaking(art.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold ${
                  art.isBreaking
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-white/5 border-white/10 text-slate-300'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                {art.isBreaking ? 'إزالة عاجل' : 'جعله عاجلاً'}
              </button>
              <button
                type="button"
                onClick={() => deleteArticle(art.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-extrabold mr-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
