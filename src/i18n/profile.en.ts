/** プロフィール・自分の投稿・投稿者の公開プロフィールの英語リソース。en.ts の profile・myPosts・poster に入る。 */

import type { profileJa, myPostsJa, posterJa } from './profile.ja';
import type { DeepPartial } from './deepPartial';

export const profileEn: DeepPartial<typeof profileJa> = {
  menu: 'Profile',
  registerTitle: 'Create your profile',
  registerLead: 'This is your first sign-in. Choose a nickname to show as the poster name, and review the terms below.',
  nickname: 'Nickname',
  nicknameHint: '1–20 characters, not already used by someone else. Shown publicly as the poster of your markers (your Google name is never shown).',
  consentsTitle: 'Terms',
  consents: {
    rights:
      'The YouTube videos I register were filmed or made by me, and I hold the rights (such as copyright) to publish them. ' +
      'I will not register videos made by others.',
    onSite:
      'The videos I register are real footage actually filmed at the marker location. ' +
      'I will not register AI-generated footage or footage of other places.',
    data:
      'I agree that Loca stores my nickname, the time I agreed, and what I post (video URL, location, tags, field note, equipment) ' +
      'to show them on the map and compile usage statistics, and publishes my nickname and posts.',
  },
  privacyNote:
    'Your email address and Google name are not stored outside the sign-in system (Firebase Authentication) and are never published.',
  register: 'Register',
  registered: 'Profile created',
  cancelRegister: 'Cancel (sign out)',
  editTitle: 'Profile',
  google: 'Linked Google account',
  createdAt: 'Registered on',
  agreedAt: 'Agreed on',
  nicknameNote: 'Markers you already posted will show the new name too. You can change it once a minute.',
  update: 'Update',
  updated: 'Profile updated',
  channel: 'Your YouTube channel (optional)',
  channelNote: 'Channel URL (youtube.com/@handle or /channel/UC…). It is shown on your public profile so others can visit your channel. Update with it empty to remove.',
  channelInvalid: 'Enter it as youtube.com/@handle or youtube.com/channel/UC…',
  aligned: 'Updated the poster name on {count} marker(s) to your nickname',
  loadFailed: 'Could not load your profile. Please reload the page later.',
  needed: 'You need to create a profile before posting.',
  deleteAccount: 'Delete account',
  deletion: {
    title: 'Final check: delete your account',
    lead: 'This cannot be undone.',
    items: [
      'All your markers are removed from the map, all your shooting requests are withdrawn, and all your likes are removed.',
      'Your profile (nickname and consent record) and your Google sign-in registration are deleted.',
      'Removed posts are kept for 30 days, visible only to administrators (for mistakes and report reviews), then erased completely.',
      'If you sign in again with the same Google account, you start over as a new user. Your previous posts are not carried over.',
    ],
    reauthNote: 'After you press "Delete account", Google asks you to sign in again to confirm it is you.',
    confirm: 'Delete account',
    running: 'Deleting...',
    done: 'Your account was deleted ({markers} marker(s), {requests} shooting request(s)).',
    failed: 'Stopped partway: {message} Press "Delete account" again to continue from where it stopped.',
  },
};

export const myPostsEn: DeepPartial<typeof myPostsJa> = {
  menu: 'My posts',
  title: 'My posts',
  tabStatistics: 'Statistics',
  tabMarkers: 'Posted videos ({count})',
  tabRequests: 'Shooting requests ({count})',
  heat: 'Heat {heat} ({count})',
  selectAll: 'Select all ({selected} / {total})',
  jump: 'Map',
  delete: 'Delete',
  withdraw: 'Withdraw',
  deleteSelected: 'Delete {count} selected',
  withdrawSelected: 'Withdraw {count} selected',
  confirmDeleteMarkers: 'Delete {count} marker(s)? They are removed from the map and erased after 30 days.',
  confirmWithdraw: 'Withdraw your shooting requests at {count} spot(s)? The heat you used comes back.',
  deletedMarkers: 'Deleted {count} marker(s)',
  withdrawn: 'Withdrew {count} shooting request(s) (heat returned)',
  emptyMarkers: 'You have not posted any markers yet. Use the Post tab on the left.',
  emptyRequests: 'You have not made any shooting requests yet.',
};

export const posterEn: DeepPartial<typeof posterJa> = {
  open: 'View this poster\'s profile',
  title: 'Profile of {name}',
  posts: 'Videos',
  likes: 'Likes received',
  flames: 'Flames received',
  answered: 'Answered {count} shooting request(s) with a video',
  note: 'Flames are the heat of shooting requests answered with a video and accepted by the requester. Likes and flames count only videos currently on the map.',
  list: 'Videos',
  empty: 'No videos on the map.',
  markerFlames: '{heat} flame(s) (answered {count} shooting request(s))',
  channel: 'YouTube channel',
};
