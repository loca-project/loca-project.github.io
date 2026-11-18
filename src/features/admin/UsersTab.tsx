/**
 * ユーザー管理のタブ（要件 5.2.4・T59）。管理者・一般のユーザー・ブラックリストの 3 区画を横に並べる。
 * 利用者はニックネームと uid で見分ける（メールと Google の名前は保存しない。ADR 0019）。
 * 操作は「削除」（プロフィールと名前の索引。マーカーは消さない）と「ブラックリスト」の 2 つ。管理者には操作を出さない。
 * 区画ごとにニックネームか uid で絞れる。外枠・操作ボタンの幅・ボタンのある行の高さは区画の間でそろえる（T74）。
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { AdminUserLists, AdminUserRow } from '@/ports';
import { usersMatching } from '@/core/logic/adminUsers';
import { formatDate } from '@/core/logic/format';
import { Button, TextInput } from '@/shared/components/Controls';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useAdminI18n } from './useAdminI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useAuth } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/components/Toast';

/** 1 人分の行。登録日が無くても行を 3 段にして、区画の間で行の高さをそろえる。 */
function UserLine({ row, children }: { row: AdminUserRow; children?: React.ReactNode }) {
  const { t } = useAdminI18n();
  return (
    <li className="border-b border-gray-50 py-2">
      <p className="truncate text-xs font-bold text-gray-800">{row.nickname ?? t.admin.users.noProfile}</p>
      <p className="truncate font-mono text-[10px] text-gray-400" title={row.uid}>
        {row.uid}
      </p>
      <p className="text-[10px] text-gray-500">
        {t.profile.createdAt}: {row.createdAt > 0 ? formatDate(row.createdAt) : '—'}
      </p>
      {/* ボタンはどの区画でも同じ幅（2 列の格子の 1 マス）にそろえる */}
      {children && <div className="mt-1.5 grid grid-cols-2 gap-1.5">{children}</div>}
    </li>
  );
}

/** 区画。見出しの下に検索欄を置き、ニックネームか uid で絞る。件数は「絞った数 / 全体」。 */
function Section({ title, rows, render }: { title: string; rows: AdminUserRow[]; render: (row: AdminUserRow) => React.ReactNode }) {
  const { t } = useAdminI18n();
  const u = t.admin.users;
  const [query, setQuery] = useState('');
  const shown = usersMatching(rows, query);
  const label = u.searchIn.replace('{title}', title);
  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-lg border border-gray-100 p-3">
      <h3 className="mb-1.5 text-xs font-bold text-gray-700">
        {title}（{query.trim() ? `${shown.length} / ${rows.length}` : rows.length}）
      </h3>
      <TextInput type="search" value={query} placeholder={label} aria-label={label} onChange={(e) => setQuery(e.target.value)} />
      {/* スクロールバーの有無で中の幅が変わり、区画の間でボタンの幅がずれないよう、場所を常に空けておく */}
      <ul className="mt-1 md:min-h-0 md:grow md:overflow-y-auto md:[scrollbar-gutter:stable]">
        {shown.map(render)}
        {shown.length === 0 && <li className="py-3 text-center text-[11px] text-gray-400">{u.noMatch}</li>}
      </ul>
    </section>
  );
}

export default function UsersTab() {
  const { adminStore } = useServices();
  const { t } = useAdminI18n();
  const u = t.admin.users;
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const [lists, setLists] = useState<AdminUserLists | null>(null);
  const { user } = useAuth();

  const reload = useCallback(async () => {
    if (!adminStore) return;
    try {
      setLists(await adminStore.users());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [adminStore, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 確認してから実行し、終わったら読み直す。 */
  const act = (confirmText: string, action: () => Promise<void>, done: string) => () => {
    if (!window.confirm(confirmText)) return;
    void exclusive(async () => {
      try {
        await action();
        toast.success(done);
        await reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  if (!adminStore) return null;
  if (!lists) return <p className="text-xs text-gray-500">{t.details.loading}</p>;

  const name = (row: AdminUserRow) => row.nickname ?? row.uid;
  const me = user?.uid ?? null;
  // 自分が管理者になった時刻。これより後に管理者になった人だけを一般に戻せる（ルールの adminSince と同じ。T75）
  const mySince = lists.admins.find((r) => r.uid === me)?.adminSince ?? 0;
  return (
    <div className="md:flex md:h-full md:flex-col">
      <div className="mb-3 flex items-center gap-3">
        <Button variant="secondary" onClick={() => void exclusive(reload)} disabled={loading}>
          <i className="fa-solid fa-rotate mr-1.5" />
          {u.reload}
        </Button>
        <p className="text-[11px] text-gray-500">{u.note}</p>
      </div>
      <div className="grid gap-3 md:min-h-0 md:grow md:grid-cols-3 md:grid-rows-[minmax(0,1fr)]">
        <Section
          title={u.admins}
          rows={lists.admins}
          render={(row) => (
            <UserLine key={row.uid} row={row}>
              {/* 自分自身と、自分より先に管理者になった人は一般に戻せない（ルールでも拒否する。T75） */}
              {row.uid === me ? (
                <span className="text-[11px] text-gray-400">{u.you}</span>
              ) : (row.adminSince ?? 0) <= mySince ? (
                <span className="text-[11px] text-gray-400">{u.senior}</span>
              ) : (
                <Button
                  variant="dangerSoft"
                  disabled={loading}
                  onClick={act(u.confirmToUser.replace('{name}', name(row)), () => adminStore.revokeAdmin(row.uid), u.demoted)}
                >
                  {u.toUser}
                </Button>
              )}
            </UserLine>
          )}
        />
        <Section
          title={u.users}
          rows={lists.users}
          render={(row) => (
            <UserLine key={row.uid} row={row}>
              <Button
                variant="primarySoft"
                disabled={loading || row.nickname === null}
                onClick={act(u.confirmToAdmin.replace('{name}', name(row)), () => adminStore.grantAdmin(row.uid), u.promoted)}
              >
                {u.toAdmin}
              </Button>
              <Button
                variant="dangerSoft"
                disabled={loading}
                onClick={act(u.confirmDelete.replace('{name}', name(row)), () => adminStore.deleteUser(row.uid), u.deleted)}
              >
                {u.delete}
              </Button>
              <Button
                variant="danger"
                disabled={loading}
                onClick={act(u.confirmBlacklist.replace('{name}', name(row)), () => adminStore.blacklist(row.uid), u.blacklisted)}
              >
                {u.toBlacklist}
              </Button>
            </UserLine>
          )}
        />
        <Section
          title={u.blacklist}
          rows={lists.blacklist}
          render={(row) => (
            <UserLine key={row.uid} row={row}>
              <Button
                variant="secondary"
                disabled={loading}
                onClick={act(u.confirmUnblacklist.replace('{name}', name(row)), () => adminStore.unblacklist(row.uid), u.unblacklisted)}
              >
                {u.unblacklist}
              </Button>
            </UserLine>
          )}
        />
      </div>
    </div>
  );
}
