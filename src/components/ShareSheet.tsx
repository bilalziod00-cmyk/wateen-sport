import React from 'react';
import { Copy, Instagram, MessageCircle, Share2, Globe } from 'lucide-react';
import { shareSportsContent, SharePayload, SharePlatform } from '../utils/share';
import { useAppData } from '../context/AppDataContext';

interface ShareBarProps {
  payload: SharePayload;
  compact?: boolean;
}

export const ShareBar: React.FC<ShareBarProps> = ({ payload, compact = false }) => {
  const { showToast } = useAppData();

  const handleShare = async (platform: SharePlatform) => {
    const res = await shareSportsContent(platform, payload);
    showToast(res.message, 'emerald');
  };

  return (
    <div className={compact ? 'flex items-center gap-1.5' : 'space-y-2'}>
      {!compact && (
        <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5 text-emerald-400" />
          مشاركة سريعة على منصات التواصل
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleShare('whatsapp')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#4ADE80] border border-[#25D366]/30 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {!compact && <span>واتساب</span>}
        </button>

        <button
          type="button"
          onClick={() => handleShare('facebook')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#1877F2]/15 hover:bg-[#1877F2]/25 text-[#60A5FA] border border-[#1877F2]/30 transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          {!compact && <span>فيسبوك</span>}
        </button>

        <button
          type="button"
          onClick={() => handleShare('instagram')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-l from-pink-500/20 via-rose-500/20 to-amber-500/20 hover:from-pink-500/30 text-pink-300 border border-pink-500/30 transition-colors"
        >
          <Instagram className="w-3.5 h-3.5" />
          {!compact && <span>إنستغرام</span>}
        </button>

        <button
          type="button"
          onClick={() => handleShare('native')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/8 hover:bg-white/15 text-slate-200 border border-white/15 transition-colors"
        >
          {compact ? <Copy className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          {!compact && <span>مشاركة / نسخ</span>}
        </button>
      </div>
    </div>
  );
};
