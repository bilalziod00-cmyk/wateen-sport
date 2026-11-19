import React, { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Send,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import {
  AssistantPendingAction,
  AssistantResponse,
  processWateenAssistantCommand,
} from '../../services/wateenAssistantService';
import { CompetitionId } from '../../types/sports';

const QUICK_PROMPTS = [
  'ما هو ترتيب دوري المحترفين؟',
  'من هو هداف الدوري؟',
  'قارن بين الحسين إربد والوحدات',
  'حلل آخر 5 مباريات للفيصلي',
  'ما هي إصابات اللاعبين الحالية؟',
  'جهز منشور فيسبوك عن ترتيب المحترفين',
  'افحص حالة النظام ومصادر الأخبار',
  'اعتمد أول خبر في طابور المراجعة',
];

export const AdminAiAssistantPage: React.FC = () => {
  const {
    data,
    approveQueuedArticle,
    recalculateCompetitionStandings,
    sendPushNotification,
    showToast,
  } = useAppData();

  const [input, setInput] = useState('');
  const [history, setHistory] = useState<AssistantResponse[]>([
    processWateenAssistantCommand('افحص حالة النظام ومصادر الأخبار', data),
  ]);
  const [executedActionIds, setExecutedActionIds] = useState<Record<string, 'done' | 'cancelled'>>(
    {}
  );

  const handleRunCommand = (text: string) => {
    const q = text.trim();
    if (!q) return;
    const res = processWateenAssistantCommand(q, data);
    setHistory((prev) => [res, ...prev]);
    setInput('');
  };

  const handleConfirmPendingAction = async (action: AssistantPendingAction) => {
    if (executedActionIds[action.id]) return;

    if (action.actionType === 'approve_top_queued_news') {
      const articleId = String(action.payload.articleId || '');
      if (articleId) await approveQueuedArticle(articleId);
    } else if (action.actionType === 'recalculate_standings') {
      const compId = (action.payload.competitionId as CompetitionId) || 'pro_league';
      await recalculateCompetitionStandings(compId);
    } else if (action.actionType === 'send_breaking_notification') {
      await sendPushNotification({
        title: String(action.payload.title || 'وتين سبورت'),
        body: String(action.payload.body || 'تحديث عاجل'),
        type: 'announcement',
        competitionId: (action.payload.competitionId as CompetitionId) || 'pro_league',
      });
    }

    setExecutedActionIds((prev) => ({ ...prev, [action.id]: 'done' }));
  };

  const handleCancelPendingAction = (action: AssistantPendingAction) => {
    setExecutedActionIds((prev) => ({ ...prev, [action.id]: 'cancelled' }));
    showToast('تم إلغاء الإجراء الحساس بناءً على قرار المدير', 'amber');
  };

  const handleCopyPost = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('تم نسخ نص المنشور للحافظة', 'emerald');
    } catch {
      showToast('تعذر النسخ التلقائي — يمكنك نسخ النص يدوياً', 'amber');
    }
  };

  return (
    <div className="space-y-4">
      {/* الترويسة */}
      <div className="rounded-3xl bg-gradient-to-l from-emerald-600/20 via-[#0E1722] to-black border border-emerald-500/35 p-4 sm:p-5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300">
            <Bot className="w-4 h-4" />
            المساعد التفاعلي للمالك — WATEEN AI ASSISTANT
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-black text-emerald-300">
            مربوط بالقاعدة الحية • يذكر المصدر والتاريخ
          </span>
        </div>
        <h2 className="text-base font-black text-white">
          اسأل باللغة العربية عن الأخبار، الترتيب، مقارنة الفرق، الإصابات، أو جهّز منشورات السوشيال
        </h2>
        <p className="text-[11px] text-slate-400">
          جميع الإجابات مستخرجة من قاعدة البيانات والمصادر الموثقة فقط. أي عملية تعديل أو نشر أو إشعار حساسة تتوقف بانتظار موافقتك الصريحة.
        </p>
      </div>

      {/* أزرار أوامر سريعة */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp}
            type="button"
            onClick={() => handleRunCommand(qp)}
            className="px-2.5 py-1.5 rounded-xl bg-[#0D1520] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/35 text-[11px] font-bold text-slate-200 transition-colors"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* صندوق إدخال الأمر */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRunCommand(input);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب أمرك بالعربية... مثال: قارن بين الكرمل وعجلون / من هو هداف الدوري؟"
          className="flex-1 rounded-2xl bg-[#0D1520] border border-white/15 focus:border-emerald-400 outline-none px-4 py-3 text-xs sm:text-sm text-white placeholder:text-slate-500"
        />
        <button
          type="submit"
          className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 shrink-0 shadow-glow"
        >
          <Send className="w-4 h-4" />
          تنفيذ
        </button>
      </form>

      {/* سجل الردود */}
      <div className="space-y-3">
        {history.map((item) => {
          const actionStatus = item.pendingAction ? executedActionIds[item.pendingAction.id] : undefined;
          return (
            <div
              key={item.id}
              className="rounded-3xl bg-[#0D1520] border border-white/12 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-300 font-black">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  الأمر: {item.query}
                </span>
                {item.containsDemoData && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px]">
                    يتضمن بيانات أولية للعرض
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                {item.answerText}
              </p>

              {item.bullets.length > 0 && (
                <ul className="space-y-1.5 bg-black/40 border border-white/8 rounded-2xl p-3 text-xs text-slate-200">
                  {item.bullets.map((b, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              {item.generatedSocialPost && (
                <div className="rounded-2xl bg-emerald-950/30 border border-emerald-500/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-black text-emerald-300">
                    <span>مسودة المنشور الجاهزة للنشر</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPost(item.generatedSocialPost!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                    >
                      <Copy className="w-3 h-3" />
                      نسخ
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-100 leading-relaxed">
                    {item.generatedSocialPost}
                  </pre>
                </div>
              )}

              {/* بطاقة الموافقة على الإجراء الحساس */}
              {item.pendingAction && (
                <div className="rounded-2xl bg-amber-950/35 border border-amber-500/45 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{item.pendingAction.titleAr} — يتطلب موافقة المدير</span>
                  </div>
                  <p className="text-xs text-slate-200">{item.pendingAction.descriptionAr}</p>
                  <div className="text-[11px] text-amber-200/90 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.pendingAction.impactWarningAr}</span>
                  </div>

                  {actionStatus === 'done' ? (
                    <div className="inline-flex items-center gap-1 text-xs font-black text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      تم التنفيذ بموافقة المدير وتوثيقه في السجل
                    </div>
                  ) : actionStatus === 'cancelled' ? (
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                      <XCircle className="w-4 h-4" />
                      تم إلغاء التنفيذ
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleConfirmPendingAction(item.pendingAction!)}
                        className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تأكيد التنفيذ الآن
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelPendingAction(item.pendingAction!)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 text-slate-200 text-xs font-bold"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* تذييل إثبات المصدر وتاريخ آخر تحديث */}
              <div className="pt-2 border-t border-white/8 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-400" />
                  المصادر: {item.sourcesUsed.join(' • ')}
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3 text-slate-500" />
                  آخر تحديث للبيانات: {item.dataLastUpdatedFormatted}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
