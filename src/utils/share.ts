import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export type SharePlatform = 'whatsapp' | 'facebook' | 'instagram' | 'native' | 'copy';

export interface SharePayload {
  title: string;
  text: string;
  url?: string;
}

// المشاركة السريعة عبر واتساب، فيسبوك، إنستغرام، ومشاركة أندرويد الأصلية
export async function shareSportsContent(
  platform: SharePlatform,
  payload: SharePayload
): Promise<{ ok: boolean; message: string }> {
  const appUrl = payload.url || (typeof window !== 'undefined' ? window.location.href : 'https://wateensport.jo');
  const fullText = `${payload.title}\n\n${payload.text}\n\nعبر تطبيق وتين سبورت ⚽🇯🇴\n${appUrl}`;

  try {
    if (platform === 'whatsapp') {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      return { ok: true, message: 'تم فتح واتساب للمشاركة' };
    }

    if (platform === 'facebook') {
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appUrl)}&quote=${encodeURIComponent(`${payload.title} - ${payload.text}`)}`;
      window.open(fbUrl, '_blank', 'noopener,noreferrer');
      return { ok: true, message: 'تم فتح فيسبوك للمشاركة' };
    }

    if (platform === 'instagram') {
      await copyToClipboard(fullText);
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: payload.title,
          text: fullText,
          dialogTitle: 'مشاركة عبر إنستغرام أو التطبيقات',
        });
        return { ok: true, message: 'تم فتح قائمة المشاركة ونسخ النص لإنستغرام' };
      }
      return {
        ok: true,
        message: 'تم نسخ نص البطاقة/الخبر بنجاح — الصقه مباشرة في ستوري أو منشور إنستغرام',
      };
    }

    if (platform === 'native') {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: payload.title,
          text: fullText,
          url: appUrl,
          dialogTitle: 'مشاركة من وتين سبورت',
        });
        return { ok: true, message: 'تمت المشاركة بنجاح' };
      }
      if (navigator.share) {
        await navigator.share({
          title: payload.title,
          text: fullText,
          url: appUrl,
        });
        return { ok: true, message: 'تمت المشاركة بنجاح' };
      }
      await copyToClipboard(fullText);
      return { ok: true, message: 'تم نسخ النص والرابط للحافظة' };
    }

    await copyToClipboard(fullText);
    return { ok: true, message: 'تم نسخ النص بنجاح' };
  } catch {
    await copyToClipboard(fullText);
    return { ok: true, message: 'تم نسخ المحتوى للحافظة للمشاركة السريعة' };
  }
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
