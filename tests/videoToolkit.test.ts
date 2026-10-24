import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Context } from 'koishi';
import type { BilibiliDmBot } from '../src/bot/bot';
import { VideoToolkitAPI } from '../src/bilibiliAPI/apis/videoToolkit';

const bv = 'BV1xx411c7mD';
const info = { bvid: bv, aid: 123, cid: 456, duration: 120 };
const reply = {
  rpid: 1, rpid_str: '987654321987654321', root: 0, parent: 0,
  member: { mid: '42', uname: 'viewer' }, content: { message: '@friend 请你吃', members: [{}] }, like: 5,
};

function fixture()
{
  const calls: { url: string; params?: Record<string, unknown>; anonymous: boolean; body?: string; headers?: Record<string, string>; }[] = [];
  let audioTracks = [{ id: 30216, bandwidth: 64000, baseUrl: 'https://cdn.example/audio' }];
  let audioClosed = false;
  let tracks = [{ lan: 'en', subtitle_url: '//cdn.example/en' }, { lan: 'ai-zh', subtitle_url: '//cdn.example/zh' }];
  let authReplies = [reply], anonReplies = [reply];
  let code = 0;
  let postData: unknown = { rpid_str: '987654321987654321' };
  let page = 0;
  const signed: Record<string, unknown>[] = [];
  const get = (anonymous: boolean) => async (url: string, options: { params?: Record<string, unknown>; headers?: Record<string, string>; } = {}) =>
  {
    calls.push({ url, params: options.params, anonymous, headers: options.headers });
    if (url.endsWith('/audio')) return (async function* () {
      try { yield Buffer.from('first'); yield Buffer.from('second'); }
      finally { audioClosed = true; }
    })();
    if (url.startsWith('https://cdn.example/')) return { body: [{ content: '原文' }] };
    if (code) return { code, message: 'blocked' };
    let data: unknown;
    if (url.endsWith('/view')) data = info;
    else if (url.endsWith('/playurl')) data = { dash: { audio: audioTracks } };
    else if (url.endsWith('/v2') && url.includes('/player/')) data = { subtitle: { subtitles: tracks } };
    else if (url.includes('/reply/')) data = { replies: anonymous ? anonReplies : authReplies, cursor: { is_end: true, next: ++page } };
    else if (url.endsWith('/arc/search')) data = { list: { vlist: [
      { bvid: bv, aid: 123, title: '<em>new</em>', created: Math.floor(Date.now() / 1000), length: '2:30', author: 'up' },
      { bvid: 'BV1yy411c7mE', created: 1, length: '1:00' },
    ] } };
    else if (url.endsWith('/archive/related')) data = [{ ...info, title: 'related', duration: 50, owner: { mid: 7, name: 'up' }, stat: { view: 20, reply: 3 } }];
    else if (url.endsWith('/created/list-all')) data = { list: [{ id: 7, title: 'test' }] };
    return { code: 0, data };
  };
  const ctx = { http: { get: get(true) } } as unknown as Context;
  const bot = { selfId: '42', http: {
    getBiliJct: () => 'csrf-secret',
    getWbiSignature: async (params: Record<string, unknown>) => { signed.push(params); return { wts: 1, w_rid: 'signature' }; },
    http: {
      get: get(false),
      post: async (url: string, body: string) => { calls.push({ url, body, anonymous: false }); return { code, message: 'blocked', data: postData }; },
    },
  } } as unknown as BilibiliDmBot;
  return {
    api: new VideoToolkitAPI(bot, ctx), calls, signed,
    tracks: (value: typeof tracks) => { tracks = value; },
    audioTracks: (value: typeof audioTracks) => { audioTracks = value; },
    audioClosed: () => audioClosed,
    replies: (auth: typeof authReplies, anon: typeof anonReplies) => { authReplies = auth; anonReplies = anon; },
    error: (value: number) => { code = value; }, post: (value: unknown) => { postData = value; },
  };
}

test('subtitle uses adapter WBI and anonymous CDN client, preferring Chinese', async () =>
{
  const f = fixture();
  assert.deepEqual(await f.api.getVideoSubtitle(bv), { bvid: bv, cid: 456, language: 'ai-zh', text: '原文' });
  assert.deepEqual(f.signed, [{ aid: 123, cid: 456 }]);
  assert.equal(f.calls.at(-1)?.url, 'https://cdn.example/zh');
  assert.equal(f.calls.at(-1)?.anonymous, true);
  assert.equal(f.calls.find(c => c.url.includes('/player/'))?.params?.w_rid, 'signature');
});

test('audio uses adapter signing and downloads AAC without account cookies', async () =>
{
  const f = fixture();
  const result = await f.api.getVideoAudio(bv);
  assert.equal(result.data.toString(), 'firstsecond');
  assert.equal(result.mime, 'audio/mp4');
  assert.equal(result.duration, 120);
  assert.equal(f.calls.at(-1)?.anonymous, true);
  assert.equal(f.calls.at(-1)?.headers?.Cookie, undefined);
  assert.equal(f.signed[0].bvid, bv);
  assert.equal(f.calls.find(call => call.url.endsWith('/playurl'))?.params?.fnval, 16);
});

test('audio duration and size limits stop work and close the download iterator', async () =>
{
  const f = fixture();
  await assert.rejects(f.api.getVideoAudio(bv, { maxDuration: 30 }), /duration limit/);
  assert.equal(f.calls.length, 1);
  await assert.rejects(f.api.getVideoAudio(bv, { maxBytes: 6 }), /size limit/);
  assert.equal(f.audioClosed(), true);
});

test('audio rejects invalid limits, unsupported tracks and unsafe protocols', async () =>
{
  const f = fixture();
  await assert.rejects(f.api.getVideoAudio(bv, { maxDuration: Infinity }), /duration limit/);
  await assert.rejects(f.api.getVideoAudio(bv, { maxBytes: 0 }), /size limit/);
  assert.equal(f.calls.length, 0);
  f.audioTracks([]);
  await assert.rejects(f.api.getVideoAudio(bv), /supported AAC/);
  f.audioTracks([{ id: 30216, bandwidth: 64000, baseUrl: 'http://cdn.example/audio' }]);
  await assert.rejects(f.api.getVideoAudio(bv), /URL protocol/);
});
test('no subtitle is empty, upstream errors are thrown with their code', async () =>
{
  const f = fixture();
  f.tracks([]);
  assert.equal((await f.api.getVideoSubtitle(bv)).text, '');
  f.error(-412);
  await assert.rejects(f.api.getVideoSubtitle(bv), err => (err as { biliCode: number; }).biliCode === -412);
});
test('comments keep string IDs and select latest/anonymous explicitly', async () =>
{
  const f = fixture();
  const result = await f.api.getVideoComments(bv, { anonymous: true, sort: 'time' });
  assert.equal(result[0].rpid, '987654321987654321');
  assert.equal(result[0].mentions, true);
  assert.equal(f.calls.at(-1)?.params?.mode, 2);
  assert.equal(f.calls.at(-1)?.anonymous, true);
  await f.api.getVideoComments(bv, { root: '12345', limit: 1 });
  assert.equal(f.calls.at(-1)?.params?.root, '12345');
  assert.equal(f.calls.at(-1)?.params?.pn, 1);
});
test('user feed signs requests and strictly filters old videos', async () =>
{
  const f = fixture();
  const list = await f.api.getUserVideos('99');
  assert.equal(list.length, 1);
  assert.equal(list[0].duration, 150);
  assert.equal(list[0].title, 'new');
  assert.equal(list[0].uid, '99');
  assert.equal(f.signed[0].mid, '99');
});
test('related metadata is normalized for downstream plugins', async () =>
{
  const f = fixture();
  const [item] = await f.api.getRelatedVideos(bv);
  assert.equal(item.author, 'up');
  assert.equal(item.play, 20);
  assert.equal(item.comments, 3);
});
test('new comment creates a root with CSRF and real mention mapping', async () =>
{
  const f = fixture();
  assert.equal(await f.api.createVideoComment(bv, '@friend hello', [{ id: '99', name: 'friend' }]), '987654321987654321');
  const body = new URLSearchParams(f.calls.at(-1)?.body);
  assert.equal(body.get('root'), '0');
  assert.equal(body.get('parent'), '0');
  assert.equal(body.get('csrf'), 'csrf-secret');
  assert.deepEqual(JSON.parse(body.get('at_name_to_mid')), { friend: '99' });
});
test('invalid inputs fail before networking; uncertain comment receipt is not retried', async () =>
{
  const f = fixture();
  await assert.rejects(f.api.createVideoComment(bv, 'hello', [{ id: 'bad', name: 'friend' }]));
  await assert.rejects(f.api.addVideoToFavorite(bv, '0'));
  await assert.rejects(f.api.getUserVideos('bad'));
  assert.equal(f.calls.length, 0);
  f.post({});
  await assert.rejects(f.api.createVideoComment(bv, 'hello'), /do not resend/);
  assert.equal(f.calls.filter(call => call.body).length, 1);
});
test('favorites use the selected bot and form-encoded write parameters', async () =>
{
  const f = fixture();
  assert.deepEqual(await f.api.getFavoriteFolders(), [{ id: 7, title: 'test' }]);
  assert.equal(f.calls.at(-1)?.params?.up_mid, '42');
  await f.api.addVideoToFavorite(bv, '7');
  const body = new URLSearchParams(f.calls.at(-1)?.body);
  assert.equal(body.get('rid'), '123');
  assert.equal(body.get('type'), '2');
  assert.equal(body.get('add_media_ids'), '7');
});
test('visibility distinguishes anonymous, self-only and missing without claiming delivery', async () =>
{
  const f = fixture();
  assert.equal(await f.api.getCommentVisibility(bv, reply.rpid_str), 'public');
  f.replies([reply], []);
  assert.equal(await f.api.getCommentVisibility(bv, reply.rpid_str), 'pending');
  f.replies([], []);
  assert.equal(await f.api.getCommentVisibility(bv, reply.rpid_str), 'missing');
  f.error(-412);
  await assert.rejects(f.api.getCommentVisibility(bv, reply.rpid_str));
});
