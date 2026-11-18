import { MatchStatus } from '../types/sports';

export const LIVE_MATCH_STATUSES: ReadonlyArray<MatchStatus> = [
  'live',
  'first_half',
  'halftime',
  'second_half',
];

export function isLiveMatchStatus(status: MatchStatus): boolean {
  return (
    status === 'live' ||
    status === 'first_half' ||
    status === 'halftime' ||
    status === 'second_half'
  );
}

export const MATCH_STATUS_SORT_WEIGHT: Record<MatchStatus, number> = {
  live: 0,
  first_half: 0,
  halftime: 0,
  second_half: 0,
  upcoming: 1,
  finished: 2,
  postponed: 3,
  cancelled: 4,
};

export function getMatchStatusArabicLabel(status: MatchStatus, liveMinute?: number): string {
  const minSuffix = liveMinute ? ` ${liveMinute}'` : '';
  switch (status) {
    case 'live':
      return `مباشر${minSuffix}`;
    case 'first_half':
      return `الشوط الأول${minSuffix}`;
    case 'halftime':
      return 'استراحة بين الشوطين';
    case 'second_half':
      return `الشوط الثاني${minSuffix}`;
    case 'upcoming':
      return 'قادمة';
    case 'finished':
      return 'انتهت';
    case 'postponed':
      return 'مؤجلة';
    case 'cancelled':
      return 'ملغاة';
  }
}

export function getMatchStatusShortBadge(status: MatchStatus, liveMinute?: number): string {
  const minSuffix = liveMinute ? ` ${liveMinute}'` : '';
  switch (status) {
    case 'live':
      return `مباشر${minSuffix}`;
    case 'first_half':
      return `ش1${minSuffix}`;
    case 'halftime':
      return 'استراحة';
    case 'second_half':
      return `ش2${minSuffix}`;
    case 'upcoming':
      return 'قادمة';
    case 'finished':
      return 'انتهت';
    case 'postponed':
      return 'مؤجلة';
    case 'cancelled':
      return 'ملغاة';
  }
}
