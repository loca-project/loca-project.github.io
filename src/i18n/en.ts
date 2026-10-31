/**
 * 英語リソース。
 * 未定義のキーは日本語にフォールバックするため、部分定義でよい（index.ts でマージ）。
 */

import type { Dictionary } from './ja';
import type { DeepPartial } from './deepPartial';
import { activityEn } from './activity.en';
import { adminEn } from './admin.en';
import { formEn } from './form.en';
import { profileEn, myPostsEn, posterEn } from './profile.en';
import { officialEn, reportReasonsEn } from './report.en';

export const en: DeepPartial<Dictionary> = {
  appName: 'Loca',
  tagline: 'Map the places worth remembering',
  close: 'Close',
  stats: 'Stats',

  menu: {
    label: 'Menu',
    language: 'Language',
  },

  auth: {
    signIn: 'Sign in with Google',
    login: 'Sign in',
    signOut: 'Sign out',
    signedIn: 'Signed in',
    signedOut: 'Signed out',
  },

  profile: profileEn,

  myPosts: myPostsEn,

  post: {
    pickHint: 'Click the map to set the place (you can move it later)',
    needPlace: 'Click the map to choose a place',
    loginTitle: 'Sign in to post',
    loginBody: 'Sign in with Google to post markers and shooting requests.',
  },

  request: {
    breakdown: 'What people asked for (by heat)',
    heatRule: 'You can use up to {max} heat in total (withdrawing returns it).',
    noBreakdown: 'No breakdown (older request format)',
    mine: 'Your requests: heat {heat} ({count})',
    withdraw: 'Withdraw my requests',
    confirmWithdraw: 'Withdraw your requests at this spot? Heat {heat} will be returned.',
    withdrawn: 'Requests withdrawn (heat returned)',
    howToAnswer: 'Film under these conditions and post it to answer the request.',
  },

  poster: posterEn,

  people: {
    name: 'User name',
    placeholder: 'Part of a name (blank for all)',
    order: 'Sort by',
    orders: { posts: 'Videos', views: 'Views', likes: 'Likes', requests: 'Photo requests' },
    search: 'Search',
    results: 'Users',
    stats: '{posts} videos · {views} views · {likes} likes · {requests} requests',
    profile: 'Profile',
    note: 'Only people who have posted videos on the map appear. Counts use only matching videos. Likes are tallied nightly; requests are the ones answered with a video.',
  },

  answers: {
    formBanner: 'This post answers {count} shooting request(s). The requesters will be told a video has arrived.',
    notice: 'A video arrived for your shooting request ({count})',
    open: 'View',
    dismiss: 'Close',
    heading: 'Videos that arrived',
    row: '"{title}" · {by}',
    watch: 'Watch',
    receive: 'Accept',
    confirmReceive: 'Accept "{title}"? This request closes and you get {heat} heat back. The poster receives {heat} flame(s).',
    received: 'Accepted ({heat} heat returned)',
  },

  store: {
    submit: 'Register',
    update: 'Update',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: 'Delete this marker? This cannot be undone.',
    saved: 'Marker registered',
    updated: 'Marker updated',
    deleted: 'Marker deleted',
    loginRequired: 'Sign in to post ("Sign in" at the top right)',
    note: 'Your marker appears on the map right away.',
    unavailable: 'Posting is not available in this setup.',
    submitRequest: 'Request',
    requestSaved: 'Shooting request registered',
    heatLeft: 'Heat left: {left} / {max} (total per person)',
  },

  sidebar: {
    map: 'Search',
    post: 'Post',
    request: 'Requests',
    region: 'Region',
    people: 'Users',
    gear: 'Gear',
    collapse: 'Collapse menu',
    expand: 'Expand menu',
  },

  headers: {
    mapSearch: 'Map search',
    regionRanking: 'Regional ranking',
    people: 'Users',
    gearRanking: 'Equipment ranking',
    requestRanking: 'Shooting request ranking',
    newReg: 'Post',
    editMarker: 'Edit marker',
    viewMarker: 'Marker details',
    searchResults: 'Search results',
    requestTitle: 'Shooting request',
    requestList: 'Request list',
  },

  form: formEn,

  empty: {
    body: 'Nothing has been registered yet.\nUse the Post tab on the left to leave the first place you filmed.',
    howTo: 'See how to submit',
    dismiss: 'Just browse the map',
  },

  contribute: {
    checking: 'Checking the video...',
    guideTitle: 'How posting works',
    guide1: 'Open the Post tab on the left and choose a place on the map',
    guide2: 'Enter the video URL and tags (or heat and conditions for a shooting request)',
    guide3: 'Sign in at the top right and press Register',
    guide4: 'It appears on the map right away. You can edit or delete your posts later',
    guideNote:
      'Posting requires signing in with a Google account. The map is rebuilt nightly; posts, edits and deletions in between appear immediately.',
  },
  actions: {
    share: 'Share',
    report: 'Report',
    copyLink: 'Copy link',
    linkCopied: 'Link to this map copied (with your filters and the selected marker).',
    linkCopyFailed: 'Could not copy the link. Share the URL in the address bar instead.',
    reportTitle: 'Report this marker',
    reportDesc: 'Select all that apply.',
    reportDetail: 'Details (optional)',
    cancel: 'Cancel',
    submit: 'Submit',
    reportSent: 'Reported. An administrator will review it.',
    reportUpdated: 'Your report was updated. An administrator will review it.',
    reportLogin: 'Sign in to report ("Sign in" at the top right)',
    reportUnavailable: 'Reporting is not available in this setup.',
  },

  likes: {
    label: 'Like {count}',
    hint: 'Send a thank-you to the poster',
    undo: 'Press again to remove your like',
    own: 'You cannot like your own post',
    login: 'Sign in to like ("Sign in" at the top right)',
    received: 'Likes received: {count} in total',
    receivedRow: '{count} likes',
  },

  details: {
    btnLabel: 'Details',
    title: 'Title',
    channel: 'Channel',
    registeredAt: 'Added to Loca',
    views: 'Views',
    publishedAt: 'Published on YouTube',
    publishedPending: 'Filled in by the nightly update',
    duration: 'Length',
    statsPending: 'Views and other stats update nightly',
    contributor: 'Contributor',
    loading: 'Loading...',
    error: 'Could not load the details.',
    openYoutube: 'Open on YouTube',
    watchHere: 'Play here',
  },

  reportReasons: reportReasonsEn,
  official: officialEn,

  tags: {
    subject: 'What is in the video',
    mood: 'Mood',
    season: 'Season filmed',
    timeOfDay: 'Time of day filmed',
    style: 'How it was filmed',
    required: 'Required',
    optionalGroup: 'If you know (optional)',
    optionalHint: 'Tap again to clear',
    memo: 'On-site note',
    optional: 'optional',
    memoPlaceholder: 'e.g. Filmed from the north observation deck. Parking available',
  },

  mapFilter: {
    label: 'Map filter',
    videos: 'Videos',
    requests: 'Requests',
    more: 'Filter',
    kinds: 'Show',
    clear: 'Clear',
    close: 'Close',
    showing: 'Videos {shown} / {total}',
    requestNote: 'Only season, time of day and filming style apply to requests (equipment category applies to videos only)',
  },

  filters: {
    registeredRange: 'Published',
    length: 'Video length',
    lengthAll: 'All',
    lengthShort: 'Under 4 min',
    lengthMedium: '4–20 min',
    lengthLong: '20 min or more',
    tags: 'Filter by tags',
    prefecture: 'Prefecture',
    season: 'Published quarter',
    equipmentFilter: 'Equipment',
    limit: 'Rows',
    allTime: 'All time',
    pastYear: 'Past year',
    past6m: 'Past 6 months',
    past3m: 'Past 3 months',
    past1m: 'Past month',
    past2w: 'Past 2 weeks',
    today: 'Today',
    any: 'All',
    allJapan: 'All prefectures',
    allSeasons: 'All',
    q1: 'Jan-Mar',
    q2: 'Apr-Jun',
    q3: 'Jul-Sep',
    q4: 'Oct-Dec',
    allMakers: 'All manufacturers',
  },

  results: {
    empty: 'No results found.',
    limitMsg: 'Filters are active, so the list is limited to {limit} rows.',
    count: '{count} rows',
    videos: 'videos',
    channel: 'Channel',
    registered: 'Registered',
  },

  admin: adminEn,
  activity: activityEn,

  alerts: {
    invalidUrl: 'That YouTube URL is not valid.',
    invalidCoord: 'Latitude or longitude is out of range.',
    missingTags: 'Please choose what is in the video and its mood.',
    memoTooLong: 'The on-site note can be up to 80 characters.',
    fetchFail: 'Failed to fetch video info. Check the URL or whether the video is private.',
    fetchTimeout: 'YouTube is not responding. Please wait a moment and try again.',
    locFail: 'Failed to resolve the place name. Try another spot or retry shortly.',
    duplicateUrl: 'This video is already registered.',
    placeNotFound: 'That place could not be found.',
  },

  runtime: {
    title: 'Published data',
    upToDate: 'Current',
    degraded: 'Attention',
    generatedAt: 'Generated',
    dataUnavailable: 'Could not load the published data. Please reload in a moment.',
    mapUnavailable: 'Map tiles (OpenStreetMap) could not be loaded. Please reload later.',
    updateAvailable: 'A new version is available. Reload so that posting and saving work correctly.',
    reload: 'Reload',
  },
};
