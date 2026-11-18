/**
 * 管理者モード（要件 5・T27）。右上のメニューの「管理者モード」から開く（admins/{uid} がある人だけに出す）。
 *
 * タブ（要件 5.1 の順）: 統計分析（5.2.1）、ユーザー管理（5.2.4・T59）、投稿動画（5.2.5・T60）、撮影リクエスト（5.2.5）、
 * 定期処理（jobs の記録）、通報（3.8・T61）、ログ一覧（5.2.3・T60）。機器（T28・ADR 0025）は撮影リクエストの右。
 * 投稿動画と撮影リクエストは「自分の投稿」と同じ形で、書き出しもここで行う（旧「データエクスポート」タブは廃止）。
 * タブの見た目は DashboardTabs で共有する。画面の判定は表示の切り替えにだけ使い、権限はルールが守る。
 */

import React, { useState } from 'react';
import type { EquipmentDef, MarkerData, RequestMarkerData } from '@/core/types';
import Modal from '@/shared/components/Modal';
import DashboardTabs from '@/shared/components/DashboardTabs';
import { useAdminI18n } from './useAdminI18n';
import StatisticsTab from './StatisticsTab';
import JobsTab from './JobsTab';
import UsersTab from './UsersTab';
import MarkersTab from './MarkersTab';
import RequestsTab from './RequestsTab';
import EquipmentTab from './EquipmentTab';
import LogsTab from './LogsTab';
import ReportsTab from './ReportsTab';

type TabId = 'statistics' | 'users' | 'markers' | 'requests' | 'equipment' | 'jobs' | 'reports' | 'logs';

interface AdminDashboardProps {
  open: boolean;
  markers: MarkerData[];
  requestMarkers: RequestMarkerData[];
  /** 公開中の機器マスタ（機器のタブ） */
  equipment: EquipmentDef[];
  onClose: () => void;
  /** 投稿動画・通報の「地図へ」（管理者モードを閉じて地図を移す） */
  onJump: (marker: MarkerData) => void;
  /** 撮影リクエストの「地図へ」 */
  onJumpRequest: (spot: RequestMarkerData) => void;
}

export default function AdminDashboard({ open, markers, requestMarkers, equipment, onClose, onJump, onJumpRequest }: AdminDashboardProps) {
  const { t } = useAdminI18n();
  const [tab, setTab] = useState<TabId>('statistics');

  return (
    <Modal open={open} title={t.admin.mode} size="lg" fixedHeight onClose={onClose}>
      <DashboardTabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'statistics', icon: 'fa-chart-pie', label: t.admin.tabStatistics },
          { id: 'users', icon: 'fa-users-gear', label: t.admin.tabUsers },
          { id: 'markers', icon: 'fa-video', label: t.admin.tabMarkers },
          { id: 'requests', icon: 'fa-hand', label: t.admin.tabRequests },
          { id: 'equipment', icon: 'fa-camera', label: t.admin.tabEquipment },
          { id: 'jobs', icon: 'fa-clock-rotate-left', label: t.admin.tabJobs },
          { id: 'reports', icon: 'fa-flag', label: t.admin.tabReports },
          { id: 'logs', icon: 'fa-scroll', label: t.admin.tabLogs },
        ]}
      />
      {/* タブの列は固定し、中身だけをここで巻き取る。一覧を持つタブは md 以上でこの高さいっぱいに伸ばす（h-full）。
          md 未満の一覧は自分では巻き取らず、ここだけが巻き取る（二重に巻き取らせない。T85） */}
      <div className="min-h-0 grow overflow-y-auto">
        {tab === 'statistics' && <StatisticsTab markers={markers} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'markers' && <MarkersTab markers={markers} onJump={onJump} />}
        {tab === 'requests' && <RequestsTab markers={markers} requestMarkers={requestMarkers} onJump={onJumpRequest} />}
        {tab === 'equipment' && <EquipmentTab equipment={equipment} />}
        {tab === 'jobs' && <JobsTab />}
        {tab === 'reports' && <ReportsTab markers={markers} onJump={onJump} />}
        {tab === 'logs' && <LogsTab markers={markers} />}
      </div>
    </Modal>
  );
}
