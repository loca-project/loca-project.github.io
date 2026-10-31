/** マーカー（登録済み動画）のドメイン型。 */

import type { MoodKey, SeasonKey, StyleKey, SubjectKey, TimeOfDayKey } from '@/core/constants/tags';

/**
 * タグ（要件 3.3・ADR 0014）。投稿者が現地や映像を見て付ける。各項目は 1 つだけ選ぶ。
 * 任意の項目は、未選択なら項目ごと持たない（空文字にしない）。
 */
export interface MarkerTags {
  /** 映っているもの（必須） */
  subject: SubjectKey;
  /** 雰囲気（必須）。マーカー色の決定に使う */
  mood: MoodKey;
  /** 撮影の季節 */
  season?: SeasonKey;
  /** 撮影の時間帯 */
  timeOfDay?: TimeOfDayKey;
  /** 撮り方 */
  style?: StyleKey;
}

/**
 * YouTube Data API から毎晩取る値（ADR 0017）。Actions だけが書く。時刻は epoch ms。
 * 取れない値（再生数を隠している動画など）は持たない。
 */
export interface YoutubeStats {
  viewCount?: number;
  likeCount?: number;
  /** 動画の投稿日時 */
  publishedAt?: number;
  /** 長さ（秒） */
  durationSec?: number;
  /** 最後に確かめた時刻 */
  checkedAt?: number;
}

/** 撮影機器（分類 → メーカー → シリーズ → モデル）。未選択は空文字で表す。 */
export interface Equipment {
  /** 分類のキー（ADR 0018）。旧データには無い */
  category?: string;
  manufacturer: string;
  series: string;
  model: string;
}

/** 公式の紹介の出所。提供元は YouTube の公式チャンネルの持ち主、根拠はそれを公式と確かめたページ。 */
export interface OfficialSource {
  provider: string;
  sourceUrl: string;
}

/**
 * 動画メタデータ。
 *
 * Google API を使わないため、取得できるのは YouTube oEmbed が返す 3 項目だけ。
 * 再生数・投稿日・再生時間は取得手段が無いので、この型には持たない。
 */
export interface VideoMeta {
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  source: 'oembed';
}

/** 逆ジオコーディングの結果。 */
export interface PlaceMeta {
  prefecture: string;
  city: string;
  /** 地名の出典（ADR 0032）。以前の国土地理院の値 gsi は保存していないので残さない */
  source: 'osm';
}

export interface MarkerData {
  id: string;
  youtubeUrl: string;
  /** YouTube の動画 ID（11 文字）。重複の禁止の索引 videos/{videoId} のキー */
  videoId?: string;
  lat: number;
  lng: number;

  tags: MarkerTags;
  /** 現地メモ（任意・80 字まで・改行なし）。空なら項目ごと持たない */
  memo?: string;
  /** 再生数・投稿日・長さ。まだ取っていないマーカーには無い */
  youtube?: YoutubeStats;
  equipment: Equipment;

  // oEmbed から取得した情報
  title?: string;
  channelTitle?: string;
  thumbnailUrl?: string;

  prefecture?: string;
  city?: string;

  /** 投稿者の表示名（プロフィールが入るまでは uid から作る仮の名前）。権限の判定には使わない */
  createdBy: string;
  /** 投稿者の Firebase の uid。本人かどうかの判定に使う（ADR 0012） */
  ownerUid?: string;
  /** Loca に登録された時刻（epoch ms）。並び替えと期間フィルタの基準 */
  createdAt: number;
  updatedAt?: number;
  /** 取り下げ済み。公開データには含めないが、混入しても弾けるよう型には残す */
  deleted?: boolean;
  /** 応えた撮影リクエストの ID（作成のときだけ付く。ADR 0028） */
  answers?: string[];
  /** 公式の紹介（提供元と根拠のページ）。運営が登録したマーカーにだけある。利用者の投稿の順位には数えない（ADR 0036） */
  official?: OfficialSource;
  /** Loca のいいねの件数。毎晩の同期が公開データにだけ入れる（0 件は無い。最大 1 日遅れ。T92）。YouTube の高評価数（youtube.likeCount）とは別 */
  likes?: number;
}

/** 新規登録時の入力（id とタイムスタンプは取り込み側で採番）。 */
export type MarkerDraft = Omit<MarkerData, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 利用者が書き換えられる項目（Firestore への書き込み用）。
 * 持ち主・投稿者名・時刻・削除フラグはアダプタが決めるので含めない。
 */
export type MarkerContent = Pick<
  MarkerData,
  'youtubeUrl' | 'lat' | 'lng' | 'tags' | 'memo' | 'equipment' | 'title' | 'channelTitle' | 'thumbnailUrl' | 'prefecture' | 'city' | 'answers'
> & { videoId: string };

/** 地図上の矩形範囲（範囲指定検索で使う）。 */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}
