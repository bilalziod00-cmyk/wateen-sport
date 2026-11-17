import React, { useState } from 'react';
import { Edit3, Flame, ImagePlus, Plus, Trash2, X, BarChart3 } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { COMPETITIONS, NEWS_TAG_LABELS } from '../../constants/competitions';
import { CompetitionId, NewsArticle, NewsCategoryTag, StatPair } from '../../types/sports';
import { processImageFile } from '../../utils/imageUpload';
import { formatRelativeAmman } from '../../utils/ammanTime';

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
  const { data, saveArticle, deleteArticle, toggleArticleBreaking, uploadImageAsset, showToast } =
    useAppData();
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
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-white">إدارة الأخبار والمقالات</h2>
          <p className="text-[11px] text-slate-400">
            إضافة وتعديل وحذف الأخبار ووسمها كعاجلة لكل الدرجات والفئات العمرية
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-pitch-950 font-black text-xs shadow-glow shrink-0"
        >
          <Plus className="w-4 h-4" />
          إضافة خبر جديد
        </button>
      </div>

      {/* نموذج الإضافة / التعديل */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#111B29] border border-emerald-500/35 p-4 sm:p-5 space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-black text-emerald-300">
              {editingId ? 'تعديل خبر موجود' : 'نشر خبر جديد في وتين سبورت'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
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
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-pitch-950 font-black text-xs shadow-glow"
            >
              {editingId ? 'حفظ التعديلات فوراً' : 'نشر الخبر الآن'}
            </button>
          </div>
        </form>
      )}

      {/* قائمة الأخبار الحالية */}
      <div className="space-y-2.5">
        {data.articles.map((art) => (
          <div
            key={art.id}
            className="rounded-2xl bg-[#0E1621] border border-white/8 p-3.5 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={art.imageUrl || './images/stadium-night.jpg'}
                alt={art.title}
                className="w-16 h-14 rounded-xl object-cover shrink-0 border border-white/10"
              />
              <div className="min-w-0">
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
                <h4 className="text-xs sm:text-sm font-extrabold text-white line-clamp-1 mt-0.5">
                  {art.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                title="تبديل عاجل"
                onClick={() => toggleArticleBreaking(art.id)}
                className={`p-2 rounded-xl border text-xs ${
                  art.isBreaking
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-rose-300'
                }`}
              >
                <Flame className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="تعديل"
                onClick={() => openEdit(art)}
                className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="حذف"
                onClick={() => deleteArticle(art.id)}
                className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
