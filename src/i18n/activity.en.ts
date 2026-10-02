/** 最近のアクティビティの英語リソース。en.ts の activity に入る（未定義のキーは日本語にフォールバックする）。 */

import type { activityJa } from './activity.ja';
import type { DeepPartial } from './deepPartial';

export const activityEn: DeepPartial<typeof activityJa> = {
  tab: 'Recent',
  title: 'Recent activity',
  video: '{poster} posted a video',
  request: 'Filming request (heat {heat})',
  noPlace: 'Unknown place',
  empty: 'No posts yet.',
  now: 'just now',
  minute: '{n} min ago',
  hour: '{n} h ago',
  day: '{n} d ago',
};
