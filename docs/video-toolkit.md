# Video toolkit API

Other plugins can use these methods on an authenticated `bot.internal` without maintaining another login or reading cookie files.

| Method | Result |
| --- | --- |
| `getVideoSubtitle(bvid)` | `{ bvid, cid, language, text }`; `text` is empty when no subtitle track exists |
| `getVideoComments(bvid, options?)` | Normalized comments with string IDs, text, author, likes and mention presence |
| `getUserVideos(uid, { days?, pages? })` | Recent submissions, ordered by publication time |
| `getRelatedVideos(bvid)` | Related videos as `VideoBrief[]` |
| `createVideoComment(bvid, text, mentions?)` | New top-level comment ID as a string |
| `getFavoriteFolders()` | The authenticated account's folder IDs and titles |
| `addVideoToFavorite(bvid, folderId)` | Adds a video to a folder |
| `getCommentVisibility(bvid, rpid, root?)` | `public`, `pending`, or `missing` |

`getVideoComments` accepts `limit` (1–60), `root` (thread root ID), `sort` (`hot` or `time`), and `anonymous`.
`getUserVideos` accepts `days` (1–90, default 7) and `pages` (1–5, default 2).
Mention objects are `{ id: 'numeric UID', name: 'exact nickname' }`; include the matching `@nickname` in the text. IDs should be passed as strings.

These new APIs propagate request failures and Bilibili error codes instead of treating them as empty content. A missing comment receipt does not trigger a retry. Existing `sendComment` behavior is unchanged: it remains a reply-only API for received comment targets.

`public` means the comment was found without login; `pending` means it was found only while logged in. `missing` means it was absent from the bounded pages inspected, not that sending failed. None of these states proves whether an @ notification was delivered.

WBI signing and CSRF come from the active adapter. Subtitle CDN downloads and anonymous comment queries use the separate context HTTP client, without the adapter's cookies.

```ts
const subtitle = await bot.internal.getVideoSubtitle('BV1xx411c7mD')
const comments = await bot.internal.getVideoComments('BV1xx411c7mD', { limit: 20 })
```

Offline verification: `npm test`. Type declarations: `npm run build`.
