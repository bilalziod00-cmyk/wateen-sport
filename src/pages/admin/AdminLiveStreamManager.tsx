import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Power,
  Radio,
  Trash2,
  Tv,
  X,
  Youtube,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { COMPETITIONS } from '../../constants/competitions';
import { CompetitionId, LiveStreamItem } from '../../types/sports';
import { parseLiveStreamUrl } from '../../utils/streamEmbed';
import { LiveStreamPlayer } from '../../components/LiveStreamPlayer';

export const AdminLiveStreamManager: React.FC = () => {
  const {
    data,
    saveLiveStream,
    deleteLiveStream,
    toggleLiveStreamActive,
    showToast,
  } = useAppData();

  const formRef = useRef<HTMLFormElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [competitionId, setCompetitionId] = useState<CompetitionId>('pro_league');
  const [isLive, setIsLive] = useState(true);

  const parsed = parseLiveStreamUrl(url);
  const streams = data.liveStreams || [];

  const resetForm = () => {
    setEditingId(null);
    setUrl('');
    setTitle('');
    setSubtitle('');
    setCompetitionId('pro_league');
    setIsLive(true);
  };

  const handleEdit = (st: LiveStreamItem) => {
    setEditingId(st.id);
    setUrl(st.url);
    setTitle(st.title);
    setSubtitle(st.subtitle);
    setCompetitionId(st.competitionId);
    setIsLive(st.isLive);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !parsed.isValid) {
      showToast('الصق رابط يوتيوب أو فيسبوك صالحاً أولاً', 'crimson');
      return;
    }
    if (!title.trim()) {
      showToast('اكتب عنوان البث المباشر (مثال: الحسين × الفيصلي)', 'crimson');
      return;
    }

    await saveLiveStream({
      id: editingId || `stream-${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim() || 'بث مباشر عبر وتين سبورت',
      url: parsed.originalUrl,
      platform: parsed.platform,
      competitionId,
      isLive,
      createdAt: new Date().toISOString(),
    });

    resetForm();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-rose-500" />
          البث المباشر داخل التطبيق (يوتيوب وفيسبوك)
        </h2>
        <p className="text-[11px] text-slate-400 mt-0.5">
          فقط انسخ رابط البث المباشر من يوتيوب أو فيسبوك والصقه هنا — سيظهر مشغّل البث تلقائياً في
          الصفحة الرئيسية لجميع المستخدمين!
        </p>
      </div>

      {/* نموذج لصق الرابط وتشغيل البث */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="rounded-2xl bg-[#111B29] border border-rose-500/35 p-4 space-y-3.5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-rose-300">
            {editingId ? 'تعديل رابط البث المباشر' : 'إضافة بث مباشر جديد (يوتيوب / فيسبوك)'}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 text-xs text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
              إلغاء التعديل
            </button>
          )}
        </div>

        {/* خانة لصق الرابط */}
        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-slate-200">
            1. الصق رابط البث من يوتيوب أو فيسبوك *
          </label>
          <input
            type="url"
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=...  أو  https://www.facebook.com/.../videos/..."
            className="w-full rounded-xl bg-[#070B10] border border-white/15 focus:border-rose-400 focus:outline-none px-3.5 py-3 text-xs text-left text-emerald-300 font-semibold"
            required
          />

          {/* تأكيد ذكي فوري لنوع الرابط */}
          {url.trim() && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold border ${
                parsed.isValid
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/35'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {parsed.isValid
                ? `تم التعرف تلقائياً: ${parsed.platformLabel} (جاهز للتشغيل داخل التطبيق)`
                : 'الرابط غير واضح — تأكد من نسخ الرابط كاملاً من يوتيوب أو فيسبوك'}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              2. عنوان البث المباشر *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: بث مباشر: الوحدات × الرمثا — دوري المحترفين"
              className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2.5 text-xs text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">3. البطولة / القسم</label>
            <select
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value as CompetitionId)}
              className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2.5 text-xs text-white"
            >
              {Object.values(COMPETITIONS).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-300 mb-1">
              وصف قصير (اختياري)
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="مثال: تغطية مباشرة من ستاد عمّان الدولي..."
              className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        <label className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 cursor-pointer">
          <span className="text-xs font-extrabold text-rose-200 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-rose-400" />
            عرض البث الآن في أعلى الصفحة الرئيسية للمشجعين
          </span>
          <input
            type="checkbox"
            checked={isLive}
            onChange={(e) => setIsLive(e.target.checked)}
            className="w-4 h-4 accent-rose-500"
          />
        </label>

        {/* معاينة حية قبل النشر */}
        {url.trim() && parsed.isValid && title.trim() && (
          <div className="pt-2 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400">معاينة كيف سيظهر البث للمستخدمين:</div>
            <LiveStreamPlayer
              stream={{
                id: 'preview',
                title,
                subtitle,
                url: parsed.originalUrl,
                platform: parsed.platform,
                competitionId,
                isLive,
                createdAt: new Date().toISOString(),
              }}
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-glow-red"
        >
          <Radio className="w-4 h-4" />
          {editingId ? 'حفظ تعديلات البث الآن' : '🔴 نشر وتشغيل البث المباشر الآن'}
        </button>
      </form>

      {/* قائمة البثوث المسجلة */}
      <div className="space-y-2.5">
        <div className="text-xs font-extrabold text-slate-400">
          قائمة روابط البث المحفوظة ({streams.length})
        </div>

        {streams.length === 0 ? (
          <div className="rounded-2xl bg-[#0E1621] border border-white/8 p-6 text-center text-xs text-slate-400">
            لا توجد روابط بث محفوظة بعد. الصق رابط يوتيوب أو فيسبوك بالأعلى لتشغيل أول بث!
          </div>
        ) : (
          streams.map((st) => (
            <div
              key={st.id}
              className="rounded-2xl bg-[#0E1621] border border-white/10 p-3.5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        st.isLive
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {st.isLive ? '🔴 شغّال الآن بالرئيسية' : 'متوقف (مخفي)'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded-md">
                      {st.platform === 'youtube' ? (
                        <Youtube className="w-3 h-3 text-red-400" />
                      ) : (
                        <Tv className="w-3 h-3 text-blue-400" />
                      )}
                      {st.platform === 'youtube' ? 'يوتيوب' : st.platform === 'facebook' ? 'فيسبوك' : 'رابط مباشر'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-black text-white">{st.title}</div>
                  <div dir="ltr" className="text-[10px] text-slate-500 truncate text-right">
                    {st.url}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => toggleLiveStreamActive(st.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                    st.isLive
                      ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                      : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {st.isLive ? 'إيقاف البث' : 'تشغيل البث الآن'}
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(st)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-300 text-xs font-extrabold"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={() => deleteLiveStream(st.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs font-extrabold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
