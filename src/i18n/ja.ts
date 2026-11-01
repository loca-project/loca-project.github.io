/** 日本語リソース。これが基準となる形（en.ts は同じ形を満たす）。 */

import { activityJa } from './activity.ja';
import { adminJa } from './admin.ja';
import { formJa } from './form.ja';
import { profileJa, myPostsJa, posterJa } from './profile.ja';
import { officialJa, reportReasonsJa } from './report.ja';

export const ja = {
  appName: 'Loca',
  tagline: '地図に残す、あの場所の記録',
  close: '閉じる',
  stats: '統計',

  menu: {
    label: 'メニュー',
    language: '言語',
  },

  auth: {
    signIn: 'Google でログイン',
    login: 'ログイン',
    signOut: 'ログアウト',
    signedIn: 'ログインしました',
    signedOut: 'ログアウトしました',
  },

  profile: profileJa,

  myPosts: myPostsJa,

  post: {
    pickHint: '地図をクリックすると、その場所が入ります（あとから動かせます）',
    needPlace: '地図をクリックして場所を選んでください',
    loginTitle: '投稿するにはログインが必要です',
    loginBody: 'Google アカウントでログインすると、マーカーと撮影リクエストを投稿できます。',
  },

  request: {
    breakdown: 'このリクエストの中身（熱量の内訳）',
    heatRule: '熱量は 1 人あたり合計 {max} まで使えます（取り下げると戻ります）。',
    noBreakdown: '内訳はありません（古い形式のリクエストです）',
    mine: 'あなたのリクエスト: 熱量 {heat}（{count} 件）',
    withdraw: '自分のリクエストを取り下げる',
    confirmWithdraw: 'この地点のあなたのリクエストを取り下げますか？使った熱量 {heat} が戻ります。',
    withdrawn: 'リクエストを取り下げました（熱量が戻りました）',
    howToAnswer: 'この条件で撮影して投稿すると、リクエストに応えられます。',
  },

  poster: posterJa,

  // ユーザーのタブ（T88・T93・ADR 0031）。地図にある動画の投稿者だけを探せる
  people: {
    name: 'ユーザー名',
    placeholder: '名前の一部（空ならすべて）',
    order: 'ソート順',
    orders: { posts: '投稿数', likes: 'いいね', requests: '撮影リクエスト' },
    search: '検索',
    results: 'ユーザー',
    stats: '投稿 {posts}・いいね {likes}・リクエスト {requests}',
    profile: 'プロフィール',
    note: '地図に動画を投稿している人だけが出ます。条件に合う動画だけで数えます。いいねは毎晩の集計、撮影リクエストは動画で応えた件数です。',
  },

  // 撮影リクエストへの回答（T43・ADR 0028）。「炎」は受け取ったリクエストの熱量
  answers: {
    formBanner: '撮影リクエスト {count} 件に応える投稿です。登録すると依頼者に「動画が届きました」と知らせます。',
    notice: '撮影リクエストに動画が届きました（{count} 件）',
    open: '見る',
    dismiss: '閉じる',
    heading: '届いた動画',
    row: '「{title}」 ・ {by}',
    watch: '動画を見る',
    receive: '受け取る',
    confirmReceive: '「{title}」を受け取りますか？このリクエストは閉じ、熱量 {heat} が戻ります。投稿者には炎 {heat} が届きます。',
    received: '受け取りました（熱量 {heat} が戻りました）',
  },

  store: {
    submit: '登録する',
    update: '更新する',
    edit: '編集',
    delete: '削除',
    confirmDelete: 'このマーカーを削除しますか？削除すると元に戻せません。',
    saved: 'マーカーを登録しました',
    updated: 'マーカーを更新しました',
    deleted: 'マーカーを削除しました',
    loginRequired: '投稿するにはログインしてください（右上の「ログイン」）',
    note: '登録すると、すぐに地図に表示されます。',
    unavailable: 'この構成では投稿を受け付けていません。',
    submitRequest: 'リクエストする',
    requestSaved: '撮影リクエストを登録しました',
    heatLeft: '使える熱量の残り: {left} / {max}（1 人あたりの合計）',
  },

  sidebar: {
    map: '検索',
    post: '投稿',
    request: 'リクエスト',
    region: '地域別',
    people: 'ユーザー',
    gear: '機器別',
    collapse: 'メニューを閉じる',
    expand: 'メニューを開く',
  },

  headers: {
    mapSearch: '地図検索',
    regionRanking: '地域別ランキング',
    people: 'ユーザー',
    gearRanking: '機器別ランキング',
    requestRanking: '撮影リクエストランキング',
    newReg: '投稿',
    editMarker: 'マーカーを編集',
    viewMarker: 'マーカー情報',
    searchResults: '検索結果',
    requestTitle: '撮影リクエスト',
    requestList: 'リクエスト一覧',
  },

  form: formJa,

  empty: {
    body: 'まだ 1 件も登録がありません。\n左の「投稿」タブから、あなたが撮った場所と動画を最初の 1 件として残してください。',
    howTo: '投稿のしかたを見る',
    dismiss: '地図を見る',
  },

  contribute: {
    checking: '動画情報を確認しています...',
    guideTitle: '投稿の流れ',
    guide1: '左の「投稿」タブを開き、地図で場所を選ぶ',
    guide2: '動画 URL とタグ（撮影リクエストなら熱量と条件）を入力する',
    guide3: '右上からログインして「登録する」を押す',
    guide4: 'すぐに地図に表示される。自分の投稿はあとから編集・削除できる',
    guideNote:
      '投稿には Google アカウントでのログインが必要です。地図の表示は毎晩まとめて作り直し、それまでの登録・編集・削除はその場で反映されます。',
  },
  actions: {
    share: '共有',
    report: '通報',
    copyLink: 'リンクをコピー',
    linkCopied: 'この地図のリンクをコピーしました（絞り込みと選んだマーカーを含みます）。',
    linkCopyFailed: 'リンクをコピーできませんでした。アドレスバーの URL を共有してください。',
    reportTitle: '通報する',
    reportDesc: '当てはまる項目を選択してください（複数選択可）。',
    reportDetail: '詳細（任意）',
    cancel: 'キャンセル',
    submit: '送信',
    reportSent: '通報しました。管理者が確認します。',
    reportUpdated: '通報の内容を更新しました。管理者が確認します。',
    reportLogin: '通報するにはログインしてください（右上の「ログイン」）',
    reportUnavailable: 'この構成では通報を受け付けていません。',
  },

  // いいね（ADR 0016・0024）。投稿者への「ありがとう」。ユーザーのタブでは件数の順に並べられる（ADR 0031）
  likes: {
    label: 'いいね {count}',
    hint: '投稿者に「ありがとう」を届けます',
    undo: 'もう一度押すと外します',
    own: '自分の投稿にはいいねできません',
    login: 'いいねするにはログインしてください（右上の「ログイン」）',
    received: '受け取ったいいね: 合計 {count}',
    receivedRow: 'いいね {count}',
  },

  details: {
    btnLabel: '詳細情報',
    title: 'タイトル',
    channel: 'チャンネル',
    registeredAt: 'Loca への登録日',
    views: '再生数',
    publishedAt: 'YouTube への投稿日',
    publishedPending: '毎晩の更新で入ります',
    duration: '長さ',
    statsPending: '再生数などは毎晩更新します',
    contributor: '投稿者',
    loading: '読み込み中...',
    error: '情報の取得に失敗しました。',
    openYoutube: 'YouTube で開く',
    watchHere: 'ここで再生',
  },

  reportReasons: reportReasonsJa,
  official: officialJa,

  tags: {
    subject: '映っているもの',
    mood: '雰囲気',
    season: '撮影の季節',
    timeOfDay: '撮影の時間帯',
    style: '撮り方',
    required: '必須',
    optionalGroup: '分かれば（任意）',
    optionalHint: 'もう一度押すと選択を外せます',
    memo: '現地メモ',
    optional: '任意',
    memoPlaceholder: '例: 北側の展望台から撮影。駐車場あり',
  },

  mapFilter: {
    label: '地図フィルター',
    videos: '動画',
    requests: '撮影リクエスト',
    more: 'フィルター',
    kinds: '表示するもの',
    clear: '条件をクリア',
    close: '閉じる',
    showing: '動画 {shown} / {total} 件',
    requestNote: '撮影リクエストには季節・時間帯・撮り方だけが効きます（機器の分類は動画だけ）',
  },

  filters: {
    registeredRange: '動画の投稿日',
    length: '動画の長さ',
    lengthAll: 'すべて',
    lengthShort: '4分未満',
    lengthMedium: '4分以上20分未満',
    lengthLong: '20分以上',
    tags: 'タグで絞り込む',
    prefecture: '都道府県',
    season: '動画を投稿した四半期',
    equipmentFilter: '機器フィルタ',
    limit: '表示件数',
    allTime: '全期間',
    pastYear: '1年以内',
    past6m: '半年以内',
    past3m: '3ヶ月以内',
    past1m: '1ヶ月以内',
    past2w: '2週間以内',
    today: '当日',
    any: 'すべて',
    allJapan: '全国',
    allSeasons: 'すべて',
    q1: '1月-3月',
    q2: '4月-6月',
    q3: '7月-9月',
    q4: '10月-12月',
    allMakers: '全メーカー',
  },

  results: {
    empty: '該当する結果がありません。',
    limitMsg: '現在、フィルタが適用されているため、表示は最大{limit}件に制限されています',
    count: '{count}件',
    videos: '本',
    channel: 'チャンネル',
    registered: '登録',
  },

  // 管理者モード（要件 5・T27〜T61）。中身は admin.ja.ts
  admin: adminJa,
  activity: activityJa,

  alerts: {
    invalidUrl: 'Youtube URL の形式が正しくありません。',
    invalidCoord: '緯度・経度の値が正しくありません。',
    missingTags: '「映っているもの」と「雰囲気」を選択してください。',
    memoTooLong: '現地メモは 80 字までです。',
    fetchFail:
      '動画情報の取得に失敗しました。URL が正しいか、動画が非公開になっていないか確認してください。',
    fetchTimeout: 'YouTube が応答しません。しばらく待ってから、もう一度お試しください。',
    locFail: '地名の取得に失敗しました。場所を変えるか、しばらく待って再試行してください。',
    duplicateUrl: 'この動画はすでに登録されています。',
    placeNotFound: '場所が見つかりませんでした。',
  },

  runtime: {
    title: '公開データの状態',
    upToDate: '最新',
    degraded: '注意',
    generatedAt: '生成日時',
    dataUnavailable: '公開データを読み込めませんでした。時間をおいて再読み込みしてください。',
    mapUnavailable: '地図タイル（OpenStreetMap）を取得できませんでした。時間をおいて再読み込みしてください。',
    updateAvailable: '新しい版があります。再読み込みすると、投稿や保存が正しく動きます。',
    reload: '再読み込み',
  },
};

export type Dictionary = typeof ja;
