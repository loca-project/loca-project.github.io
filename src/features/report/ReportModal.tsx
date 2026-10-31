/** マーカー通報モーダル（要件 3.8）。理由は複数選択可、詳細は任意入力。 */

import React, { useState } from 'react';
import type { ReportReason } from '@/core/types';
import { reportReasonsFor } from '@/core/constants';
import Modal from '@/shared/components/Modal';
import { Button, Checkbox, TextArea } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface ReportModalProps {
  open: boolean;
  /** 公式の紹介のマーカーか（理由の選択肢が変わる。ADR 0036） */
  official?: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (reasons: ReportReason[], detail: string) => void;
}

export default function ReportModal({ open, official = false, submitting, onClose, onSubmit }: ReportModalProps) {
  const { t } = useI18n();
  const [reasons, setReasons] = useState<ReportReason[]>([]);
  const [detail, setDetail] = useState('');

  const toggle = (id: ReportReason) =>
    setReasons((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  return (
    <Modal
      open={open}
      title={t.actions.reportTitle}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t.actions.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => onSubmit(reasons, detail.trim())}
            disabled={reasons.length === 0 || submitting}
          >
            {submitting ? t.form.processing : t.actions.submit}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[11px] text-gray-500">{t.actions.reportDesc}</p>

      <div className="flex flex-col gap-2">
        {reportReasonsFor(official).map((r) => (
          <Checkbox
            key={r.id}
            checked={reasons.includes(r.id)}
            onChange={() => toggle(r.id)}
          >
            {t.reportReasons[r.labelKey as keyof typeof t.reportReasons]}
          </Checkbox>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-1 text-[11px] font-bold text-gray-500">{t.actions.reportDetail}</p>
        <TextArea rows={4} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </div>
    </Modal>
  );
}
