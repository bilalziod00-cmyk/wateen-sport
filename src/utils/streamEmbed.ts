import { StreamPlatform } from '../types/sports';

export interface ParsedStreamInfo {
  platform: StreamPlatform;
  platformLabel: string;
  embedUrl: string | null;
  originalUrl: string;
  isValid: boolean;
}

/**
 * تحليل وتحويل روابط البث المباشر من يوتيوب وفيسبوك إلى مشغّل مضمّن يعمل داخل التطبيق مباشرة
 */
export function parseLiveStreamUrl(rawUrl: string): ParsedStreamInfo {
  const url = rawUrl.trim();
  if (!url) {
    return {
      platform: 'other',
      platformLabel: 'غير محدد',
      embedUrl: null,
      originalUrl: '',
      isValid: false,
    };
  }

  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  // 1) استخراج معرف فيديو/بث يوتيوب بجميع صيغ الروابط
  const ytPatterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const regex of ytPatterns) {
    const match = normalized.match(regex);
    if (match && match[1]) {
      return {
        platform: 'youtube',
        platformLabel: 'بث يوتيوب مباشر',
        embedUrl: `https://www.youtube.com/embed/${match[1]}?autoplay=0&rel=0&modestbranding=1&playsinline=1`,
        originalUrl: normalized,
        isValid: true,
      };
    }
  }

  // دعم رابط قناة يوتيوب مباشر مثل youtube.com/@channel/live
  if (/youtube\.com/i.test(normalized)) {
    return {
      platform: 'youtube',
      platformLabel: 'يوتيوب',
      embedUrl: normalized.includes('/embed/') ? normalized : null,
      originalUrl: normalized,
      isValid: true,
    };
  }

  // 2) روابط بث وفيديو فيسبوك (facebook.com / m.facebook.com / fb.watch / fb.gg)
  if (/(?:facebook\.com|fb\.watch|fb\.gg)/i.test(normalized)) {
    // إذا كان المستخدم لصق رابط plugins/video.php جاهزاً نستخدمه مباشرة
    const embedUrl = normalized.includes('facebook.com/plugins/video.php')
      ? normalized
      : `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
          normalized
        )}&show_text=false&t=0`;

    return {
      platform: 'facebook',
      platformLabel: 'بث فيسبوك مباشر',
      embedUrl,
      originalUrl: normalized,
      isValid: true,
    };
  }

  // 3) أي رابط بث خارجي آخر (HLS / iframe / Twitch / إلخ)
  try {
    new URL(normalized);
    return {
      platform: 'other',
      platformLabel: 'بث مباشر خارجي',
      embedUrl: normalized,
      originalUrl: normalized,
      isValid: true,
    };
  } catch {
    return {
      platform: 'other',
      platformLabel: 'رابط غير صالح',
      embedUrl: null,
      originalUrl: url,
      isValid: false,
    };
  }
}
