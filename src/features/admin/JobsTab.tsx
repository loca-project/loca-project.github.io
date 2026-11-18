/**
 * 定期処理のタブ（T27）。Actions が jobs/{id} に残した最後の実行の記録を出す（ADR 0017・0021）。
 * 読めるのは管理者だけ（ルール）。
 */

import React, { useEffect, useState } from 'react';
import type { JobRecord } from '@/ports';
import { formatDateTime } from '@/core/logic/format';
import { useServices } from '@/shared/hooks/useServices';
import { useAdminI18n } from './useAdminI18n';

export default function JobsTab() {
  const { adminStore } = useServices();
  const { t } = useAdminI18n();
  const [jobs, setJobs] = useState<JobRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminStore) return;
    adminStore
      .jobs()
      .then(setJobs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [adminStore]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!jobs) return <p className="text-xs text-gray-500">{t.details.loading}</p>;
  if (jobs.length === 0) return <p className="text-xs text-gray-500">{t.admin.jobsEmpty}</p>;

  const names = t.admin.jobNames as Record<string, string>;
  const labels = t.admin.jobValues as Record<string, string>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {jobs.map((job) => (
        <section key={job.id} className="rounded-lg border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-800">{names[job.id] ?? job.id}</h3>
          <p className="mb-2 text-[11px] text-gray-500">
            {t.admin.jobRanAt}: {job.ranAt ? formatDateTime(job.ranAt) : '-'}
          </p>
          <dl className="text-xs">
            {Object.entries(job.values).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b border-gray-50 py-1">
                <dt className="text-gray-500">{labels[key] ?? key}</dt>
                <dd className="font-mono text-gray-800">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
