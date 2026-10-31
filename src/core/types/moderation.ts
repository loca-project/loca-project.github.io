/** 通報まわりのドメイン型。 */

export type ReportReason =
  | 'copyright'
  /** 公式の紹介の掲載の取り下げの依頼（ADR 0036） */
  | 'takedown'
  | 'illegal'
  | 'misleading_location'
  | 'disinformation'
  | 'harassment';

/** Firestore の reports/{markerId}_{uid} の 1 件（1 人 1 マーカー 1 件）。時刻は epoch ms。 */
export interface ReportRecord {
  markerId: string;
  reporterUid: string;
  reasons: ReportReason[];
  status: 'open' | 'resolved';
  /** 任意の詳細（1000 字まで） */
  detail?: string;
  updatedAt: number;
}

/** マーカーごとの通報の集計（管理者画面用）。人数は通報した人の数で、同じ人の再通報は数えない。 */
export interface ReportSummary {
  markerId: string;
  /** 通報した人数 */
  reporters: number;
  /** 確認待ちの人数 */
  open: number;
  /** 理由ごとの人数 */
  reasons: Partial<Record<ReportReason, number>>;
  /** 最後に通報（再通報を含む）された時刻 */
  latestAt: number;
  /** 確認待ちの通報に書かれた詳細（空は除く。新しい順） */
  details: string[];
}
