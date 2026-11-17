import React from 'react';
import { Bell, Flame, Megaphone, Trophy, X, Cloud, Smartphone } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { formatRelativeAmman } from '../utils/ammanTime';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ open, onClose }) => {
  const { data } = useAppData();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0B121B] h-full border-r border-white/10 flex flex-col shadow-2xl">
        <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between bg-[#0E1621]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">إشعارات وتين سبورت</h2>
              <p className="text-[11px] text-slate-400">تنبيهات الأخبار العاجلة ونتائج الملاعب الأردنية</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {data.notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              لا توجد إشعارات مرسلة حالياً.
            </div>
          ) : (
            data.notifications.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl bg-[#111B29] border border-white/8 p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      n.type === 'breaking'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : n.type === 'match_result'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {n.type === 'breaking' ? (
                      <Flame className="w-3 h-3" />
                    ) : n.type === 'match_result' ? (
                      <Trophy className="w-3 h-3" />
                    ) : (
                      <Megaphone className="w-3 h-3" />
                    )}
                    {n.type === 'breaking'
                      ? 'خبر عاجل'
                      : n.type === 'match_result'
                      ? 'نتيجة مباراة'
                      : 'تنبيه رياضي'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatRelativeAmman(n.createdAt)}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-white">{n.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{n.body}</p>
                <div className="pt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
                  {n.sentViaCloud ? (
                    <>
                      <Cloud className="w-3 h-3 text-emerald-400" />
                      <span>بُثّ عبر الإشعارات السحابية FCM</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-3 h-3 text-amber-400" />
                      <span>إشعار فوري داخل التطبيق</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
