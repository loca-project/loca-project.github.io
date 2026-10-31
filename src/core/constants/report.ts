import type { ReportReason } from '@/core/types';

/** 通報理由の選択肢（要件 3.8）。文言は i18n 側に持つ。 */
export const REPORT_REASONS: { id: ReportReason; labelKey: string }[] = [
  { id: 'copyright', labelKey: 'reportCopyright' },
  { id: 'takedown', labelKey: 'reportTakedown' },
  { id: 'illegal', labelKey: 'reportIllegal' },
  { id: 'misleading_location', labelKey: 'reportLocation' },
  { id: 'disinformation', labelKey: 'reportFalse' },
  { id: 'harassment', labelKey: 'reportHarassment' },
];

/** 通報の窓に出す理由。公式の紹介は本人の投稿ではないので「登録者本人以外の動画」を出さず、取り下げの依頼を出す（ADR 0036）。 */
export function reportReasonsFor(official: boolean) {
  return REPORT_REASONS.filter((r) => (official ? r.id !== 'copyright' : r.id !== 'takedown'));
}
