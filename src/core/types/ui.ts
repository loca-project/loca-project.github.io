/** 画面モードなど、UI 状態のドメイン型。 */

/** サイドメニューのタブ。 */
export enum TabMode {
  MAP = 'MAP',
  /** 最近のアクティビティ（新しい動画と撮影リクエスト。T80・ADR 0034） */
  ACTIVITY = 'ACTIVITY',
  /** 投稿（マーカーと撮影リクエスト）。このタブの間だけ地図のクリックで場所を選ぶ */
  POST = 'POST',
  RANKING_REQUEST = 'RANKING_REQUEST',
  RANKING_REGION = 'RANKING_REGION',
  /** ユーザー（投稿者を絞って並べる。T88・T93・ADR 0031）。チャンネル別ランキングの代わり */
  PEOPLE = 'PEOPLE',
  RANKING_EQUIPMENT = 'RANKING_EQUIPMENT',
  REQUEST_LIST = 'REQUEST_LIST',
}

/** 地図タブ内のモード。 */
export enum MapMode {
  SEARCH = 'SEARCH',
  REGISTER = 'REGISTER',
  EDIT = 'EDIT',
  /** 撮影リクエストマーカーの閲覧 */
  REQUEST_VIEW = 'REQUEST_VIEW',
}

export type LanguageCode = 'ja' | 'en';

/** 機器マスタの 1 分類（分類 → メーカー → シリーズ → モデル。ADR 0018）。category は EquipmentCategoryKey。 */
export interface EquipmentDef {
  category: string;
  makers: Array<{ name: string; series: Array<{ name: string; models: string[] }> }>;
}

