import React, { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Edit3,
  ExternalLink,
  FileCode2,
  Globe,
  Plus,
  RefreshCw,
  Rss,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { COMPETITIONS, NEWS_TAG_LABELS } from '../../constants/competitions';
import {
  NewsArticle,
  NewsCategoryTag,
  NewsSourceConfig,
  WateenAutomationSettings,
} from '../../types/sports';
import {
  EDITORIAL_TYPE_LABELS,
  parseRssOrAtomXml,
} from '../../services/newsIntelligenceService';
import {
  getDefaultAutomationSettings,
  getDefaultNewsSources,
} from '../../services/schemaMigrationService';
import { formatRelativeAmman } from '../../utils/ammanTime';

type SubSection = 'queue' | 'sources' | 'ai_policy';

export const AdminNewsSourcesAndQueue: React.FC = () => {
  const {
    data,
    saveNewsSource,
    deleteNewsSource,
    toggleNewsSourceEnabled,
    toggleNewsSourceTrusted,
    updateAutomationSettings,
    ingestManualNewsOrRss,
    runNewsIntelligenceNow,
    updateQueuedArticle,
    approveQueuedArticle,
    rejectQueuedArticle,
    showToast,
  } = useAppData();

  const [sub, setSub] = useState<SubSection>('queue');
  const [isRunningCycle, setIsRunningCycle] = useState(false);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [queueDraft, setQueueDraft] = useState<NewsArticle | null>(null);
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({});

  // إضافة مصدر RSS/API جديد
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceRegion, setNewSourceRegion] = useState<NewsSourceConfig['region']>('jordan');
  const [newSourceMethod, setNewSourceMethod] = useState<NewsSourceConfig['method']>('rss');
  const [newSourceTrusted, setNewSourceTrusted] = useState(false);

  // إدخال/معالجة خبر أو خلاصة RSS رسمية يدوياً عبر محرك النشر الثلاثي
  const [manualMode, setManualMode] = useState<'single' | 'rss_xml'>('single');
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualSourceId, setManualSourceId] = useState('src-jfa-official');
  const [manualXml, setManualXml] = useState('');

  const sources = data.newsSources && data.newsSources.length > 0 ? data.newsSources : getDefaultNewsSources();
  const queue = data.reviewQueueArticles || [];
  const settings: WateenAutomationSettings =
    data.automationSettings || getDefaultAutomationSettings();

  const handleRunCollection = async () => {
    setIsRunningCycle(true);
    try {
      await runNewsIntelligenceNow();
    } finally {
      setIsRunningCycle(false);
    }
  };

  const handleAddSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      showToast('يرجى إدخال اسم المصدر ورابطه الرسمي', 'crimson');
      return;
    }
    const item: NewsSourceConfig = {
      id: `src-${Date.now()}`,
      name: newSourceName.trim(),
      url: newSourceUrl.trim(),
      region: newSourceRegion,
      method: newSourceMethod,
      trustedForAutoPublish: newSourceTrusted,
      enabled: true,
      pollIntervalMinutes: 30,
      lastStatus: 'idle',
    };
    await saveNewsSource(item);
    setNewSourceName('');
    setNewSourceUrl('');
    setNewSourceTrusted(false);
    setShowAddSource(false);
  };

  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenSource = sources.find((s) => s.id === manualSourceId);
    if (manualMode === 'rss_xml') {
      if (!manualXml.trim()) {
        showToast('يرجى لصق نص خلاصة RSS/Atom أولاً', 'crimson');
        return;
      }
      const parsed = parseRssOrAtomXml(manualXml, chosenSource);
      if (parsed.length === 0) {
        showToast('لم يتم العثور على عناصر RSS/Atom صالحة داخل النص الملصق', 'crimson');
        return;
      }
      await ingestManualNewsOrRss({
        items: parsed,
        sourceId: chosenSource?.id,
        sourceName: chosenSource?.name,
        sourceTrusted: chosenSource?.trustedForAutoPublish,
      });
      setManualXml('');
      setSub('queue');
      return;
    }

    if (!manualTitle.trim() || !manualContent.trim()) {
      showToast('يرجى إدخال عنوان ونص الخبر الأصلي من المصدر', 'crimson');
      return;
    }

    await ingestManualNewsOrRss({
      items: [
        {
          title: manualTitle.trim(),
          content: manualContent.trim(),
          link: manualUrl.trim() || undefined,
          sourceName: chosenSource?.name || 'مصدر رسمي',
          publishedAt: new Date().toISOString(),
        },
      ],
      sourceId: chosenSource?.id,
      sourceName: chosenSource?.name,
      sourceTrusted: chosenSource?.trustedForAutoPublish,
    });

    setManualTitle('');
    setManualContent('');
    setManualUrl('');
    setSub('queue');
  };

  const toggleAllowedTag = async (tag: NewsCategoryTag) => {
    const current = settings.allowedAutoPublishTags || [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    await updateAutomationSettings({ allowedAutoPublishTags: next });
  };

  return (
    <div className="space-y-4">
      {/* الترويسة والإجراءات السريعة */}
      <div className="rounded-3xl bg-gradient-to-l from-emerald-600/20 via-[#0E1722] to-black border border-emerald-500/35 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300">
              <Bot className="w-4 h-4" />
              الذكاء الإخباري — WATEEN NEWS INTELLIGENCE
            </div>
            <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
              إدارة المصادر الرسمية، التحرير الذكي، وطابور المراجعة الثلاثي
            </h2>
            <p className="text-[11px] text-slate-400">
              جلب من مصادر RSS/APIs حقيقية • كشف التكرار والتضارب • فصل الخبر المؤكد عن الرأي والإشاعة
            </p>
          </div>

          <button
            type="button"
            disabled={isRunningCycle}
            onClick={handleRunCollection}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-glow disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isRunningCycle ? 'animate-spin' : ''}`} />
            {isRunningCycle ? 'جارٍ فحص المصادر...' : 'فحص وجلب الأخبار الآن'}
          </button>
        </div>

        {/* مؤشرات سريعة */}
        <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
          <div className="rounded-2xl bg-black/50 border border-white/10 py-2 px-2">
            <div className="text-base font-black text-amber-300">{queue.length}</div>
            <div className="text-[10px] text-slate-400">في طابور المراجعة</div>
          </div>
          <div className="rounded-2xl bg-black/50 border border-white/10 py-2 px-2">
            <div className="text-base font-black text-emerald-400">
              {sources.filter((s) => s.enabled).length} / {sources.length}
            </div>
            <div className="text-[10px] text-slate-400">مصادر مفعّلة</div>
          </div>
          <div className="rounded-2xl bg-black/50 border border-white/10 py-2 px-2">
            <div className="text-base font-black text-sky-300 uppercase">
              {settings.aiProvider}
            </div>
            <div className="text-[10px] text-slate-400">محرك الذكاء النشط</div>
          </div>
        </div>
      </div>

      {/* أزرار الأقسام الفرعية */}
      <div className="grid grid-cols-3 gap-2 bg-[#0D1520] p-1.5 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setSub('queue')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition-all ${
            sub === 'queue'
              ? 'bg-emerald-500 text-black shadow'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          طابور المراجعة ({queue.length})
        </button>
        <button
          type="button"
          onClick={() => setSub('sources')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition-all ${
            sub === 'sources'
              ? 'bg-emerald-500 text-black shadow'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          المصادر والجلب ({sources.length})
        </button>
        <button
          type="button"
          onClick={() => setSub('ai_policy')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition-all ${
            sub === 'ai_policy'
              ? 'bg-emerald-500 text-black shadow'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          محرك AI والنشر
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. طابور المراجعة والاعتماد (review_queue)                           */}
      {/* ==================================================================== */}
      {sub === 'queue' && (
        <div className="space-y-3">
          {queue.length === 0 ? (
            <div className="rounded-3xl bg-[#0D1520] border border-white/10 p-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-sm font-black text-white">
                طابور المراجعة فارغ حالياً
              </div>
              <p className="text-xs text-slate-400">
                أي خبر غير مؤكد أو إشاعة انتقال أو تحليل أو تضارب من المصادر سيظهر هنا لمراجعتك قبل النشر.
              </p>
            </div>
          ) : (
            queue.map((item) => {
              const edMeta =
                EDITORIAL_TYPE_LABELS[item.editorialType || 'confirmed_news'] ||
                EDITORIAL_TYPE_LABELS.confirmed_news;
              const tagMeta = NEWS_TAG_LABELS[item.tag] || NEWS_TAG_LABELS.club_news;
              const compMeta = COMPETITIONS[item.competitionId] || COMPETITIONS.pro_league;
              const isEditing = editingQueueId === item.id && queueDraft;
              const showOrig = Boolean(showOriginalMap[item.id]);

              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-[#0D1520] border border-amber-500/35 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-black ${edMeta.color}`}
                      >
                        {edMeta.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${tagMeta.color}`}
                      >
                        {tagMeta.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">
                        {compMeta.shortName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        • {formatRelativeAmman(item.publishedAt)}
                      </span>
                    </div>

                    {item.sourceName && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300">
                        <Globe className="w-3.5 h-3.5" />
                        <span>{item.sourceName}</span>
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-emerald-300 hover:underline"
                            title="فتح رابط المصدر الأصلي"
                          >
                            <ExternalLink className="w-3 h-3 mr-0.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2.5 bg-black/40 border border-emerald-500/30 rounded-xl p-3">
                      <input
                        type="text"
                        value={queueDraft.title}
                        onChange={(e) => setQueueDraft({ ...queueDraft, title: e.target.value })}
                        className="w-full rounded-lg bg-[#070B10] border border-white/15 px-3 py-2 text-xs font-black text-white"
                      />
                      <textarea
                        rows={2}
                        value={queueDraft.summary}
                        onChange={(e) => setQueueDraft({ ...queueDraft, summary: e.target.value })}
                        className="w-full rounded-lg bg-[#070B10] border border-white/15 px-3 py-2 text-xs text-slate-200"
                      />
                      <textarea
                        rows={4}
                        value={queueDraft.content}
                        onChange={(e) => setQueueDraft({ ...queueDraft, content: e.target.value })}
                        className="w-full rounded-lg bg-[#070B10] border border-white/15 px-3 py-2 text-xs text-slate-200"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQueueId(null);
                            setQueueDraft(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold text-slate-300"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await updateQueuedArticle(queueDraft);
                            setEditingQueueId(null);
                            setQueueDraft(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-black"
                        >
                          حفظ التعديل
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-black text-white leading-snug">{item.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.summary}</p>
                    </div>
                  )}

                  {/* عرض مقارنة النص الأصلي من المصدر */}
                  {item.originalTitle && (
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setShowOriginalMap((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                        }
                        className="text-[11px] font-bold text-slate-400 hover:text-emerald-300"
                      >
                        {showOrig ? 'إخفاء النص الأصلي للمصدر ▲' : 'مقارنة مع النص الأصلي للمصدر ▼'}
                      </button>
                      {showOrig && (
                        <div className="mt-2 rounded-xl bg-black/50 border border-white/10 p-3 space-y-1 text-[11px] text-slate-300">
                          <div className="font-black text-amber-300">
                            العنوان الأصلي: {item.originalTitle}
                          </div>
                          <div className="text-slate-400 leading-relaxed whitespace-pre-line">
                            {item.originalContent || '—'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* أزرار القرار النهائي للمدير */}
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => approveQueuedArticle(item.id)}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        اعتماد ونشر فوري
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQueueId(item.id);
                          setQueueDraft({ ...item });
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-300 text-xs font-bold"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        تعديل قبل النشر
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => rejectQueuedArticle(item.id, 'مرفوض من المدير أثناء المراجعة')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs font-bold"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      رفض وحذف
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. إدارة المصادر الرسمية والجلب (news_sources)                      */}
      {/* ==================================================================== */}
      {sub === 'sources' && (
        <div className="space-y-4">
          {/* إدخال خبر أو خلاصة RSS رسمية للمعالجة الفورية عبر المحرك الثلاثي */}
          <form
            onSubmit={handleManualIngest}
            className="rounded-2xl bg-[#0D1520] border border-emerald-500/30 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4" />
                معالجة خبر رسمي أو خلاصة RSS XML عبر محرك النشر الثلاثي
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setManualMode('single')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    manualMode === 'single'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/5 text-slate-300'
                  }`}
                >
                  خبر واحد من مصدر
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode('rss_xml')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    manualMode === 'rss_xml'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/5 text-slate-300'
                  }`}
                >
                  لصق RSS / Atom XML
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                اختر المصدر الإخباري المنسوب إليه
              </label>
              <select
                value={manualSourceId}
                onChange={(e) => setManualSourceId(e.target.value)}
                className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.trustedForAutoPublish ? 'موثوق للنشر التلقائي' : 'يتطلب مراجعة'})
                  </option>
                ))}
              </select>
            </div>

            {manualMode === 'single' ? (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="عنوان الخبر الأصلي من المصدر الرسمي..."
                  className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                />
                <textarea
                  rows={3}
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  placeholder="نص الخبر أو البيان الرسمي الأصلي..."
                  className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                />
                <input
                  type="url"
                  dir="ltr"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://www.jfa.jo/... (رابط المصدر الأصلي)"
                  className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-emerald-300 text-left"
                />
              </div>
            ) : (
              <textarea
                rows={4}
                dir="ltr"
                value={manualXml}
                onChange={(e) => setManualXml(e.target.value)}
                placeholder="<rss><channel><item><title>...</title><link>...</link><description>...</description></item></channel></rss>"
                className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs font-mono text-emerald-200 text-left"
              />
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs"
            >
              فحص التكرار والتضارب وتصنيف الخبر عبر WATEEN AI
            </button>
          </form>

          {/* قائمة المصادر الرسمية وإضافة مصدر جديد */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <Rss className="w-4 h-4 text-emerald-400" />
              المصادر الإخبارية المربوطة (الأردنية / العربية / العالمية)
            </h3>
            <button
              type="button"
              onClick={() => setShowAddSource(!showAddSource)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة مصدر
            </button>
          </div>

          {showAddSource && (
            <form
              onSubmit={handleAddSourceSubmit}
              className="rounded-2xl bg-[#111B29] border border-emerald-500/35 p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="اسم المصدر (مثال: نادي الوحدات الرسمي)"
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                  required
                />
                <input
                  type="url"
                  dir="ltr"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="https://example.com/rss.xml"
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-emerald-300 text-left"
                  required
                />
                <select
                  value={newSourceRegion}
                  onChange={(e) =>
                    setNewSourceRegion(e.target.value as NewsSourceConfig['region'])
                  }
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                >
                  <option value="jordan">الأردن (أولوية أولى)</option>
                  <option value="arab">البطولات العربية</option>
                  <option value="global">البطولات العالمية</option>
                </select>
                <select
                  value={newSourceMethod}
                  onChange={(e) =>
                    setNewSourceMethod(e.target.value as NewsSourceConfig['method'])
                  }
                  className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white"
                >
                  <option value="rss">RSS / Atom Feed</option>
                  <option value="official_api">Official API</option>
                  <option value="open_data">Open Data</option>
                </select>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newSourceTrusted}
                  onChange={(e) => setNewSourceTrusted(e.target.checked)}
                  className="accent-emerald-500"
                />
                مصدر رسمي موثوق مؤهل للنشر التلقائي (عند تفعيل النشر التلقائي)
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSource(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-black"
                >
                  حفظ المصدر
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2.5">
            {sources.map((src) => (
              <div
                key={src.id}
                className="rounded-2xl bg-[#0D1520] border border-white/10 p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-white">{src.name}</span>
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold text-slate-300">
                        {src.region === 'jordan'
                          ? 'أردني'
                          : src.region === 'arab'
                          ? 'عربي'
                          : 'عالمي'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-sky-500/15 text-[10px] font-bold text-sky-300 uppercase">
                        {src.method}
                      </span>
                      {src.lastStatus === 'ok' && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-[10px] font-bold text-emerald-300">
                          آخر جلب: سليم
                        </span>
                      )}
                      {src.lastStatus === 'error' && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-[10px] font-bold text-rose-300">
                          خطأ اتصال
                        </span>
                      )}
                    </div>
                    <div dir="ltr" className="text-[11px] text-slate-400 truncate text-right">
                      {src.url}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleNewsSourceTrusted(src.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${
                        src.trustedForAutoPublish
                          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {src.trustedForAutoPublish ? 'موثوق تلقائياً' : 'مراجعة إلزامية'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleNewsSourceEnabled(src.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${
                        src.enabled
                          ? 'bg-emerald-500 text-black border-emerald-400'
                          : 'bg-white/5 text-slate-400 border-white/10'
                      }`}
                    >
                      {src.enabled ? 'مفعّل' : 'متوقف'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNewsSource(src.id)}
                      className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300"
                      title="حذف المصدر"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {src.lastError && (
                  <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 px-3 py-1.5 text-[11px] text-rose-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{src.lastError}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. إعدادات محرك WATEEN AI وسياسة النشر الثلاثي                       */}
      {/* ==================================================================== */}
      {sub === 'ai_policy' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-950/35 border border-emerald-500/35 p-4 flex items-start gap-2.5 text-xs text-emerald-200">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-black text-white">
                حماية مفاتيح الذكاء الاصطناعي (Zero Secrets in APK)
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                لا تُخزَّن أي مفاتيح سرية لـ OpenAI أو Gemini داخل تطبيق Android APK. جميع الاستدعاءات السحابية تمر حصرياً عبر الخادم الآمن في <code className="text-emerald-300">firebase/functions/wateenAiCore.js</code> مع قابلية التبديل الكامل بين المزودين دون كسر التطبيق.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0D1520] border border-white/10 p-4 space-y-4">
            <div className="text-sm font-black text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" />
              اختيار مزوّد الذكاء الاصطناعي على الخادم
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  updateAutomationSettings({ aiProvider: 'openai', aiModel: 'gpt-4o-mini' })
                }
                className={`p-3.5 rounded-2xl border text-right transition-all ${
                  settings.aiProvider === 'openai'
                    ? 'bg-emerald-500/15 border-emerald-400 text-white'
                    : 'bg-black/40 border-white/10 text-slate-300'
                }`}
              >
                <div className="text-xs font-black text-emerald-300">OpenAI API (موصى به)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  النموذج الافتراضي: gpt-4o-mini • اقتصادي ودقيق في الصياغة الصحفية العربية
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateAutomationSettings({ aiProvider: 'gemini', aiModel: 'gemini-2.0-flash' })
                }
                className={`p-3.5 rounded-2xl border text-right transition-all ${
                  settings.aiProvider === 'gemini'
                    ? 'bg-emerald-500/15 border-emerald-400 text-white'
                    : 'bg-black/40 border-white/10 text-slate-300'
                }`}
              >
                <div className="text-xs font-black text-sky-300">Google Gemini API</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  النموذج الافتراضي: gemini-2.0-flash • متفوق في قراءة صور الجداول وPDF
                </div>
              </button>
            </div>

            {/* سياسة النشر الذكي الثلاثية */}
            <div className="pt-3 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-white">
                    تفعيل النشر التلقائي للأخبار المؤكدة من المصادر الموثوقة
                  </div>
                  <div className="text-[11px] text-slate-400">
                    عند الإيقاف، تُحوَّل جميع الأخبار الجديدة إلى طابور المراجعة أولاً (الوضع الآمن).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateAutomationSettings({ autoPublishEnabled: !settings.autoPublishEnabled })
                  }
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black border ${
                    settings.autoPublishEnabled
                      ? 'bg-emerald-500 text-black border-emerald-400'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {settings.autoPublishEnabled ? 'مفعّل (تلقائي للموثوق)' : 'متوقف (مراجعة إلزامية)'}
                </button>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-300 mb-2">
                  التصنيفات المسموح بنشرها تلقائياً (باقي التصنيفات والإشاعات والتوقعات تذهب للمراجعة دائماً):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(NEWS_TAG_LABELS) as NewsCategoryTag[]).map((tKey) => {
                    const active = (settings.allowedAutoPublishTags || []).includes(tKey);
                    return (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => toggleAllowedTag(tKey)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : 'bg-black/40 border-white/10 text-slate-400'
                        }`}
                      >
                        {NEWS_TAG_LABELS[tKey].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-[11px] text-slate-300 space-y-1">
                <div className="font-black text-amber-300 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  قواعد الحماية التحريرية الإلزامية (ثابتة لا تتعطل):
                </div>
                <div>1. الإشاعات والتوقعات ومقالات الرأي والتحليلات لا تُنشر تلقائياً أبداً وتُحوَّل للمراجعة.</div>
                <div>2. أي تضارب في نتيجة أو خبر (تأكيد مقابل نفي) يُحوَّل فوراً لطابور المراجعة مع تنبيه.</div>
                <div>3. أي خبر مكرر بنفس الرابط أو بنسبة تشابه عنوان ≥ 72% يُرفض تلقائياً.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
