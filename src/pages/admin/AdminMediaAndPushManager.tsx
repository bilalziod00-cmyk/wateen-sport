import React, { useState } from 'react';
import { BellRing, Eye, EyeOff, ImagePlus, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { COMPETITIONS } from '../../constants/competitions';
import { AppNotification, CompetitionId, SportsGraphicCard } from '../../types/sports';
import { processImageFile } from '../../utils/imageUpload';
import { formatRelativeAmman } from '../../utils/ammanTime';

export const AdminMediaAndPushManager: React.FC = () => {
  const {
    data,
    saveBanner,
    deleteBanner,
    saveSportsCard,
    deleteSportsCard,
    sendPushNotification,
    deleteNotification,
    uploadImageAsset,
    showToast,
    cloudMode,
  } = useAppData();

  const [section, setSection] = useState<'push' | 'banners' | 'cards'>('push');

  // نموذج الإشعار الفوري
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifType, setNotifType] = useState<AppNotification['type']>('breaking');
  const [notifComp, setNotifComp] = useState<CompetitionId>('pro_league');

  // نموذج البنر الرئيسي
  const [bnTitle, setBnTitle] = useState('');
  const [bnSubtitle, setBnSubtitle] = useState('');
  const [bnBadge, setBnBadge] = useState('تغطية حصرية • وتين سبورت');
  const [bnImage, setBnImage] = useState('./images/stadium-night.jpg');
  const [bnColor, setBnColor] = useState('#10B981');
  const [bnComp, setBnComp] = useState<CompetitionId>('pro_league');

  // نموذج البطاقة الرياضية
  const [cardKicker, setCardKicker] = useState('بطاقة رقمية • وتين سبورت');
  const [cardTitle, setCardTitle] = useState('');
  const [cardSubtitle, setCardSubtitle] = useState('');
  const [cardImage, setCardImage] = useState('./images/match-action.jpg');
  const [cardAccent, setCardAccent] = useState<SportsGraphicCard['accent']>('emerald');
  const [cardComp, setCardComp] = useState<CompetitionId>('pro_league');
  const [m1L, setM1L] = useState('الأهداف');
  const [m1V, setM1V] = useState('10');
  const [m2L, setM2L] = useState('التقييم');
  const [m2V, setM2V] = useState('8.5');
  const [m3L, setM3L] = useState('المباريات');
  const [m3V, setM3V] = useState('12');

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onDone: (url: string) => void,
    folder: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl, blob } = await processImageFile(file, 1080, 0.82);
      const url = await uploadImageAsset(blob, dataUrl, folder);
      onDone(url);
      showToast('تم رفع الصورة بنجاح', 'emerald');
    } catch {
      showToast('تعذر معالجة الصورة', 'crimson');
    }
  };

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) {
      showToast('أدخل عنوان ونص الإشعار أولاً', 'crimson');
      return;
    }
    await sendPushNotification({
      title: notifTitle.trim(),
      body: notifBody.trim(),
      type: notifType,
      competitionId: notifComp,
    });
    setNotifTitle('');
    setNotifBody('');
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bnTitle.trim()) return;
    await saveBanner({
      id: `bn-${Date.now()}`,
      badge: bnBadge.trim() || 'وتين سبورت',
      title: bnTitle.trim(),
      subtitle: bnSubtitle.trim(),
      imageUrl: bnImage || './images/stadium-night.jpg',
      accentColor: bnColor,
      active: true,
      linkedCompetitionId: bnComp,
      order: 0,
    });
    setBnTitle('');
    setBnSubtitle('');
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardTitle.trim()) return;
    await saveSportsCard({
      id: `card-${Date.now()}`,
      type: 'tactical_stat',
      kicker: cardKicker.trim() || 'وتين سبورت',
      title: cardTitle.trim(),
      subtitle: cardSubtitle.trim(),
      competitionId: cardComp,
      imageUrl: cardImage || './images/match-action.jpg',
      accent: cardAccent,
      metrics: [
        { label: m1L, value: m1V, highlight: true },
        { label: m2L, value: m2V },
        { label: m3L, value: m3V, highlight: true },
      ],
      createdAt: new Date().toISOString(),
    });
    setCardTitle('');
    setCardSubtitle('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1.5 bg-[#0E1621] p-1.5 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setSection('push')}
          className={`py-2 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 ${
            section === 'push' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/35' : 'text-slate-400'
          }`}
        >
          <BellRing className="w-3.5 h-3.5" />
          الإشعارات
        </button>
        <button
          type="button"
          onClick={() => setSection('banners')}
          className={`py-2 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 ${
            section === 'banners'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
              : 'text-slate-400'
          }`}
        >
          <ImagePlus className="w-3.5 h-3.5" />
          البنرات ({data.banners.length})
        </button>
        <button
          type="button"
          onClick={() => setSection('cards')}
          className={`py-2 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 ${
            section === 'cards'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
              : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          البطاقات ({data.cards.length})
        </button>
      </div>

      {/* مركز إرسال الإشعارات الفورية */}
      {section === 'push' && (
        <div className="space-y-4">
          <form
            onSubmit={handleSendPush}
            className="rounded-2xl bg-[#111B29] border border-rose-500/30 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-rose-400" />
                إرسال إشعار فوري لجميع المستخدمين
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  cloudMode === 'firebase'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {cloudMode === 'firebase' ? 'بث سحابي FCM مفعّل' : 'وضع محلي (داخل التطبيق)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <select
                value={notifType}
                onChange={(e) => setNotifType(e.target.value as AppNotification['type'])}
                className="rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              >
                <option value="breaking">🔥 خبر عاجل</option>
                <option value="match_result">⚽ نتيجة مباراة مهمة</option>
                <option value="announcement">📢 تنبيه عام / موعد مباراة</option>
              </select>

              <select
                value={notifComp}
                onChange={(e) => setNotifComp(e.target.value as CompetitionId)}
                className="rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              >
                {Object.values(COMPETITIONS).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              placeholder="عنوان الإشعار (مثال: عاجل ⚽ هدف أول للحسين إربد!)"
              className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3.5 py-2.5 text-xs sm:text-sm text-white"
              required
            />

            <textarea
              rows={3}
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              placeholder="نص الإشعار الذي سيظهر على شاشة هواتف المشجعين..."
              className="w-full rounded-xl bg-[#070B10] border border-white/12 px-3.5 py-2.5 text-xs sm:text-sm text-white"
              required
            />

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-glow-red"
            >
              <Send className="w-4 h-4" />
              بث الإشعار الفوري الآن
            </button>
          </form>

          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-400">سجل الإشعارات المرسلة</div>
            {data.notifications.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl bg-[#0E1621] border border-white/8 p-3.5 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-black text-white">{n.title}</div>
                  <p className="text-[11px] text-slate-400">{n.body}</p>
                  <div className="text-[10px] text-slate-500">{formatRelativeAmman(n.createdAt)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteNotification(n.id)}
                  className="p-2 rounded-xl bg-rose-500/15 text-rose-300 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* إدارة البنرات الرئيسية */}
      {section === 'banners' && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddBanner}
            className="rounded-2xl bg-[#111B29] border border-emerald-500/30 p-4 space-y-3"
          >
            <h3 className="text-sm font-black text-emerald-300">إضافة بنر جديد للصفحة الأولى</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={bnTitle}
                onChange={(e) => setBnTitle(e.target.value)}
                placeholder="العنوان العريض على البنر *"
                className="sm:col-span-2 rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
                required
              />
              <input
                type="text"
                value={bnSubtitle}
                onChange={(e) => setBnSubtitle(e.target.value)}
                placeholder="وصف مختصر أسفل العنوان"
                className="sm:col-span-2 rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={bnBadge}
                onChange={(e) => setBnBadge(e.target.value)}
                placeholder="شارة البنر"
                className="rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              />
              <div className="flex gap-2">
                <select
                  value={bnComp}
                  onChange={(e) => setBnComp(e.target.value as CompetitionId)}
                  className="flex-1 rounded-xl bg-[#070B10] border border-white/12 px-2.5 py-2 text-xs text-white"
                >
                  {Object.values(COMPETITIONS).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortName}
                    </option>
                  ))}
                </select>
                <input
                  type="color"
                  value={bnColor}
                  onChange={(e) => setBnColor(e.target.value)}
                  className="w-11 h-9 rounded-xl bg-[#070B10] border border-white/12 p-1"
                />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-extrabold cursor-pointer">
                  <ImagePlus className="w-4 h-4" />
                  رفع صورة البنر
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, setBnImage, 'banners')}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={bnImage}
                  onChange={(e) => setBnImage(e.target.value)}
                  className="flex-1 min-w-[160px] rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-slate-300"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-500 text-pitch-950 font-black text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              إضافة البنر للرئيسية
            </button>
          </form>

          <div className="space-y-2.5">
            {data.banners.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl bg-[#0E1621] border border-white/10 p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={b.imageUrl}
                    alt={b.title}
                    className="w-20 h-14 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] text-emerald-400 font-bold">{b.badge}</div>
                    <div className="text-xs font-black text-white truncate">{b.title}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => saveBanner({ ...b, active: !b.active })}
                    className={`p-2 rounded-xl border ${
                      b.active
                        ? 'bg-emerald-500/20 border-emerald-500/35 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-slate-500'
                    }`}
                    title={b.active ? 'إخفاء البنر' : 'تفعيل البنر'}
                  >
                    {b.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteBanner(b.id)}
                    className="p-2 rounded-xl bg-rose-500/15 text-rose-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* إدارة البطاقات والتصاميم الرياضية */}
      {section === 'cards' && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddCard}
            className="rounded-2xl bg-[#111B29] border border-amber-500/30 p-4 space-y-3"
          >
            <h3 className="text-sm font-black text-amber-300">إنشاء بطاقة رياضية رقمية جديدة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={cardKicker}
                onChange={(e) => setCardKicker(e.target.value)}
                placeholder="الوسم العلوي (مثال: نجم الجولة)"
                className="rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              />
              <div className="flex gap-2">
                <select
                  value={cardComp}
                  onChange={(e) => setCardComp(e.target.value as CompetitionId)}
                  className="flex-1 rounded-xl bg-[#070B10] border border-white/12 px-2.5 py-2 text-xs text-white"
                >
                  {Object.values(COMPETITIONS).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortName}
                    </option>
                  ))}
                </select>
                <select
                  value={cardAccent}
                  onChange={(e) => setCardAccent(e.target.value as SportsGraphicCard['accent'])}
                  className="rounded-xl bg-[#070B10] border border-white/12 px-2.5 py-2 text-xs text-white"
                >
                  <option value="emerald">أخضر ملاعب</option>
                  <option value="crimson">أحمر قرمزي</option>
                  <option value="gold">ذهبي بطولات</option>
                  <option value="sky">أزرق رياضي</option>
                </select>
              </div>
              <input
                type="text"
                value={cardTitle}
                onChange={(e) => setCardTitle(e.target.value)}
                placeholder="عنوان البطاقة *"
                className="sm:col-span-2 rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
                required
              />
              <input
                type="text"
                value={cardSubtitle}
                onChange={(e) => setCardSubtitle(e.target.value)}
                placeholder="سطر توضيحي قصير"
                className="sm:col-span-2 rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-white"
              />
              <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <input value={m1L} onChange={(e) => setM1L(e.target.value)} className="w-full rounded-lg bg-[#070B10] border border-white/12 px-2 py-1 text-[11px] text-slate-300" />
                  <input value={m1V} onChange={(e) => setM1V(e.target.value)} className="w-full rounded-lg bg-[#070B10] border border-white/12 px-2 py-1 text-xs font-black text-emerald-300" />
                </div>
                <div className="space-y-1">
                  <input value={m2L} onChange={(e) => setM2L(e.target.value)} className="w-full rounded-lg bg-[#070B10] border border-white/12 px-2 py-1 text-[11px] text-slate-300" />
                  <input value={m2V} onChange={(e) => setM2V(e.target.value)} className="w-full rounded-lg bg-[#070B10] border border-white/12 px-2 py-1 text-xs font-black text-white" />
                </div>
                <div className="space-y-1">
                  <input value={m3L} onChange={(e) => setM3L(e.target.value)} className="w-full rounded-lg bg-[#070B10] border border-white/12 px-2 py-1 text-[11px] text-slate-300" />
                  <input value={m3V} onChange={(e) => setM3V(e.target.value)} className="w-full rounded-lg bg-[#070B10] border border-white/12 px-2 py-1 text-xs font-black text-amber-300" />
                </div>
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-extrabold cursor-pointer">
                  <ImagePlus className="w-4 h-4" />
                  صورة البطاقة
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, setCardImage, 'cards')}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={cardImage}
                  onChange={(e) => setCardImage(e.target.value)}
                  className="flex-1 rounded-xl bg-[#070B10] border border-white/12 px-3 py-2 text-xs text-slate-300"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-400 text-pitch-950 font-black text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              نشر البطاقة في الرئيسية
            </button>
          </form>

          <div className="space-y-2">
            {data.cards.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl bg-[#0E1621] border border-white/10 p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img src={c.imageUrl} alt={c.title} className="w-16 h-12 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-amber-400 font-bold">{c.kicker}</div>
                    <div className="text-xs font-black text-white truncate">{c.title}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteSportsCard(c.id)}
                  className="p-2 rounded-xl bg-rose-500/15 text-rose-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
