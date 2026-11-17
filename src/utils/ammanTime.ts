// أدوات تنسيق التاريخ والوقت بتوقيت عمّان (Asia/Amman)

const AMMAN_TZ = 'Asia/Amman';

export function formatAmmanTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('ar-JO', {
      timeZone: AMMAN_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '--:--';
  }
}

export function formatAmmanDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('ar-JO', {
      timeZone: AMMAN_TZ,
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatAmmanDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('ar-JO', {
      timeZone: AMMAN_TZ,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatRelativeAmman(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} د`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `منذ ${diffHours} س`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return formatAmmanDate(isoString);
  } catch {
    return 'الآن';
  }
}

export function getAmmanNowClock(): string {
  return new Intl.DateTimeFormat('ar-JO', {
    timeZone: AMMAN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}

export function toLocalDateTimeInput(isoString: string): string {
  try {
    const date = new Date(isoString);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return '';
  }
}
