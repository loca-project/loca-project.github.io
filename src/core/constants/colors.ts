import type { MoodKey } from './tags';

/**
 * 「雰囲気」に対応するマーカー色（要件 3.3・ADR 0014）。地図フィルタのチップも同じ色を使う。
 * 通常と 1 型・2 型・3 型の色覚で、仮マーカー・撮影リクエストを含む全組の CIEDE2000 が 17 以上。
 * OSM の水面 #AAD3DF・陸 #F2EFE9 とのコントラスト比も 6 色とも 2 以上（T98）。
 */
export const MOOD_HEX: Record<MoodKey, string> = {
  lively: '#D4780F', // 橙 - 活気、人の熱
  calm: '#218B6E', // 深緑 - 自然、平穏
  dreamy: '#B164D4', // 紫 - 非日常
  grand: '#105074', // 紺 - 深さ、スケール
  nostalgic: '#4A3C37', // こげ茶 - セピア、記憶
  thrill: '#BA1506', // 赤 - 緊張、高揚
};

/** 仮マーカーおよび雰囲気が未設定・不明なときの色。要件 3.2 により仮マーカーは一律グレー。 */
export const NEUTRAL_HEX = '#9CA3AF';

/** 撮影リクエストマーカーの色（動画がまだ無い地点）。 */
export const REQUEST_HEX = '#111827';

export function moodColor(mood?: string): string {
  if (!mood) return NEUTRAL_HEX;
  return (MOOD_HEX as Record<string, string>)[mood] ?? NEUTRAL_HEX;
}
