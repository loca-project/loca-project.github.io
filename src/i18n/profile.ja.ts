/** プロフィール・自分の投稿・投稿者の公開プロフィールの日本語リソース。ja.ts の profile・myPosts・poster に入る。 */

// プロフィール（要件 2.5・2.6・ADR 0019）。同意の文面を変えたら CONSENT_VERSION を上げる
export const profileJa = {
  menu: 'プロフィール',
  registerTitle: 'プロフィールの登録',
  registerLead: 'はじめてのログインです。投稿者名にするニックネームを決め、同意事項を確認してください。',
  nickname: 'ニックネーム',
  nicknameHint: '1〜20 字。ほかの人と同じ名前は使えません。マーカーの投稿者名として公開されます（Google の名前は公開しません）',
  consentsTitle: '同意事項',
  consents: {
    rights: '登録する YouTube 動画は、自分が撮影・制作し、公開する権利（著作権など）を持つものです。第三者が制作した動画は登録しません。',
    onSite: '登録する動画は、マーカーの場所で実際に撮影した実写の映像です。生成 AI で作った映像や、別の場所の映像は登録しません。',
    data: 'ニックネーム・同意した日時・投稿した内容（動画の URL、位置、タグ、現地メモ、撮影機器）を、地図への表示と利用状況の統計のために Loca が保存し、ニックネームと投稿を公開することに同意します。',
  },
  privacyNote: 'メールアドレスと Google の名前はログインの仕組み（Firebase Authentication）の外には保存せず、公開もしません。',
  register: '登録',
  registered: 'プロフィールを登録しました',
  cancelRegister: 'キャンセル（ログアウト）',
  editTitle: 'プロフィール',
  google: '連携中の Google アカウント',
  createdAt: '登録日',
  agreedAt: '同意した日時',
  nicknameNote: 'これまでのマーカーの投稿者名も新しい名前になります。変更は 1 分に 1 回まで',
  update: '更新',
  updated: 'プロフィールを更新しました',
  // 公開プロフィールの YouTube チャンネル（T55・ADR 0029）
  channel: '自分の YouTube チャンネル（任意）',
  channelNote: 'チャンネルの URL（youtube.com/@ハンドル か /channel/UC…）。あなたの公開プロフィールに載り、ほかのユーザーがチャンネルへ移れます。空にして更新すると消えます',
  channelInvalid: 'youtube.com/@ハンドル か youtube.com/channel/UC… の形で入れてください',
  aligned: '{count} 件のマーカーの投稿者名をニックネームにそろえました',
  loadFailed: 'プロフィールを読み込めませんでした。時間をおいて再読み込みしてください。',
  needed: '投稿するにはプロフィールの登録が必要です',
  deleteAccount: 'アカウントを削除',
  // アカウント削除（要件 2.7・ADR 0021）。論理削除で、完全な消去は 30 日後
  deletion: {
    title: '【最終確認】アカウントの削除',
    lead: 'この操作は元に戻せません。',
    items: [
      '投稿したマーカーはすべて地図から消え、撮影リクエストはすべて取り下げ、付けたいいねはすべて外します。',
      'プロフィール（ニックネーム・同意の記録）と、Google ログインの登録を消します。',
      '消した投稿は、誤操作や通報の調査のため 30 日間は管理者だけが見られる形で残り、そのあと完全に消去します。',
      '同じ Google アカウントでもう一度ログインすると、新しい利用者として登録からやり直しになります。これまでの投稿は引き継げません。',
    ],
    reauthNote: '「アカウントを削除する」を押すと、本人確認のため Google のログイン画面が出ます。',
    confirm: 'アカウントを削除する',
    running: '削除しています...',
    done: 'アカウントを削除しました（マーカー {markers} 件・撮影リクエスト {requests} 件）',
    failed: '途中で止まりました: {message} もう一度「アカウントを削除する」を押すと、続きから進めます。',
  },
};

// 自分の投稿の一覧（T53）
export const myPostsJa = {
  menu: '自分の投稿',
  title: '自分の投稿',
  tabStatistics: '統計',
  tabMarkers: '投稿動画（{count}）',
  tabRequests: '撮影リクエスト（{count}）',
  heat: '熱量 {heat}（{count} 件）',
  selectAll: 'すべて選択（{selected} / {total}）',
  jump: '地図へ',
  delete: '削除',
  withdraw: '取り下げ',
  deleteSelected: '選んだ {count} 件を削除',
  withdrawSelected: '選んだ {count} 地点を取り下げ',
  confirmDeleteMarkers: '{count} 件のマーカーを削除しますか？地図から消え、30 日後に完全に消去されます。',
  confirmWithdraw: '{count} 地点の撮影リクエストを取り下げますか？使った熱量が戻ります。',
  deletedMarkers: '{count} 件のマーカーを削除しました',
  withdrawn: '{count} 件の撮影リクエストを取り下げました（熱量が戻りました）',
  emptyMarkers: 'まだマーカーを投稿していません。左の「投稿」タブから登録できます。',
  emptyRequests: 'まだ撮影リクエストを出していません。',
};

// 投稿者の公開プロフィール（T82）
export const posterJa = {
  open: 'この投稿者のプロフィールを見る',
  title: '{name} さんのプロフィール',
  posts: '投稿動画',
  likes: '受け取ったいいね',
  flames: '受け取った炎',
  answered: '撮影リクエスト {count} 件に動画で応えました',
  note: '炎は、撮影リクエストに動画で応え、依頼者に受け取られた熱量の合計です。いいねと炎は、いま地図にある動画の分の合計です。',
  list: '投稿動画',
  empty: '地図に出ている投稿動画はありません。',
  markerFlames: '炎 {heat}（撮影リクエスト {count} 件に応えた動画）',
  channel: 'YouTube チャンネル',
};
