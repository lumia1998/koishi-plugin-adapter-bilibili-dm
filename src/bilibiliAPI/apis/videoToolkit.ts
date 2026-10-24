import type { Context } from 'koishi';
import type { BilibiliDmBot } from '../../bot/bot';
import type { BilibiliCommentMention } from './comment';
import { BilibiliError } from './types';

export interface VideoBrief
{
  bvid: string;
  aid: number;
  cid: number;
  title: string;
  author: string;
  uid: string;
  duration: number;
  pubdate: number;
  play: number;
  comments: number;
  description: string;
  url: string;
}

export interface VideoComment
{
  rpid: string;
  root: string;
  parent: string;
  uid: string;
  name: string;
  text: string;
  likes: number;
  mentions: boolean;
}

export interface VideoSubtitle
{
  bvid: string;
  cid: number;
  language: string;
  text: string;
}

export interface VideoCommentOptions
{
  limit?: number;
  root?: string;
  sort?: 'hot' | 'time';
  anonymous?: boolean;
}

export interface UserVideoOptions
{
  days?: number;
  pages?: number;
}

export interface FavoriteFolder
{
  id: number;
  title: string;
}

export interface VideoAudioOptions
{
  maxDuration?: number;
  maxBytes?: number;
}

export interface VideoAudio
{
  bvid: string;
  cid: number;
  duration: number;
  mime: 'audio/mp4';
  data: Buffer;
}

export interface VideoToolkit
{
  getVideoAudio(bvid: string, options?: VideoAudioOptions): Promise<VideoAudio>;
  getVideoSubtitle(bvid: string): Promise<VideoSubtitle>;
  getVideoComments(bvid: string, options?: VideoCommentOptions): Promise<VideoComment[]>;
  getUserVideos(uid: string, options?: UserVideoOptions): Promise<VideoBrief[]>;
  getRelatedVideos(bvid: string): Promise<VideoBrief[]>;
  createVideoComment(bvid: string, text: string, mentions?: BilibiliCommentMention[]): Promise<string>;
  getFavoriteFolders(): Promise<FavoriteFolder[]>;
  addVideoToFavorite(bvid: string, folderId: string): Promise<void>;
  getCommentVisibility(bvid: string, rpid: string, root?: string): Promise<'public' | 'pending' | 'missing'>;
}

interface Response<T> { code: number; message?: string; data: T; }
interface RawVideo
{
  bvid?: string; aid?: number; cid?: number; title?: string; author?: string;
  owner?: { name: string; mid: number; }; mid?: number; duration?: number;
  length?: string; pubdate?: number; created?: number; play?: number;
  comment?: number; desc?: string; description?: string;
  stat?: { view: number; reply: number; }; pages?: { cid: number; }[];
}
interface RawComment
{
  rpid: number; rpid_str?: string; root?: number; root_str?: string;
  parent?: number; parent_str?: string; like: number;
  member: { mid: string; uname: string; };
  content: { message: string; members?: unknown[]; };
}

function normalize(raw: RawVideo): VideoBrief
{
  return {
    bvid: raw.bvid || '', aid: raw.aid || 0, cid: raw.cid || raw.pages?.[0]?.cid || 0,
    title: (raw.title || '').replace(/<[^>]+>/g, ''),
    author: raw.owner?.name || raw.author || '', uid: String(raw.owner?.mid || raw.mid || ''),
    duration: raw.duration || (raw.length || '').split(':').reduce((n, part) => n * 60 + Number(part), 0),
    pubdate: raw.pubdate || raw.created || 0, play: raw.stat?.view || raw.play || 0,
    comments: raw.stat?.reply || raw.comment || 0, description: raw.desc || raw.description || '',
    url: `https://www.bilibili.com/video/${raw.bvid}`,
  };
}

/** Explicit video APIs for other plugins. Errors propagate instead of becoming empty results. */
export class VideoToolkitAPI implements VideoToolkit
{
  constructor(private bot: BilibiliDmBot, private ctx: Context) { }

  private async get<T>(path: string, params: Record<string, string | number>, signed = false, anonymous = false): Promise<T>
  {
    const http = anonymous ? this.ctx.http : this.bot.http.http;
    const query = signed ? { ...params, ...await this.bot.http.getWbiSignature(params) } : params;
    const res = await http.get<Response<T>>('https://api.bilibili.com' + path, {
      params: query,
      headers: { Referer: 'https://www.bilibili.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    if (res.code !== 0) throw new BilibiliError(res.message || path, res.code);
    if (res.data == null) throw new Error(`Bilibili returned no data: ${path}`);
    return res.data;
  }

  private async post<T>(path: string, fields: Record<string, string | number>): Promise<T>
  {
    const csrf = this.bot.http.getBiliJct();
    if (!csrf) throw new Error('Bilibili login is unavailable');
    const body = new URLSearchParams(Object.entries({ ...fields, csrf }).map(([k, v]) => [k, String(v)]));
    const res = await this.bot.http.http.post<Response<T>>('https://api.bilibili.com' + path, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://www.bilibili.com/' },
    });
    if (res.code !== 0) throw new BilibiliError(res.message || path, res.code);
    return res.data;
  }

  private async info(bvid: string): Promise<RawVideo>
  {
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) throw new Error('Invalid BV id');
    return this.get<RawVideo>('/x/web-interface/view', { bvid });
  }

  async getVideoSubtitle(bvid: string): Promise<VideoSubtitle>
  {
    const info = await this.info(bvid);
    const cid = info.cid || info.pages?.[0]?.cid;
    if (!cid) throw new Error('Video has no cid');
    const data = await this.get<{ subtitle?: { subtitles: { lan: string; subtitle_url: string; }[]; }; }>(
      '/x/player/wbi/v2', { aid: info.aid, cid }, true,
    );
    const tracks = data.subtitle?.subtitles || [];
    const track = tracks.find(s => ['ai-zh', 'zh-CN', 'zh'].includes(s.lan)) || tracks[0];
    if (!track) return { bvid, cid, language: '', text: '' };
    const url = new URL(track.subtitle_url.startsWith('//') ? 'https:' + track.subtitle_url : track.subtitle_url);
    if (url.protocol !== 'https:') throw new Error('Invalid subtitle URL protocol');
    // Never send the adapter's authenticated client to a subtitle CDN.
    const body = await this.ctx.http.get<{ body: { content: string; }[]; }>(url.href);
    return { bvid, cid, language: track.lan, text: body.body.map(row => row.content).join('\n') };
  }

  /** Downloads one bounded AAC track for Node-based audio processing. */
  async getVideoAudio(bvid: string, options: VideoAudioOptions = {}): Promise<VideoAudio>
  {
    const maxDuration = options.maxDuration ?? 600;
    const maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
    if (!Number.isFinite(maxDuration) || maxDuration <= 0 || maxDuration > 1800) throw new Error('Invalid audio duration limit');
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 64 * 1024 * 1024) throw new Error('Invalid audio size limit');
    const info = await this.info(bvid);
    const cid = info.cid || info.pages?.[0]?.cid;
    if (!cid) throw new Error('Video has no cid');
    if (!info.duration || info.duration > maxDuration) throw new Error(`Video exceeds audio duration limit (${maxDuration}s)`);
    const player = await this.get<{ dash?: { audio?: { id: number; codecid?: number; mimeType?: string; baseUrl?: string; base_url?: string; bandwidth?: number; }[]; }; }>(
      '/x/player/wbi/playurl', { bvid, cid, fnval: 16, fnver: 0, fourk: 0, qn: 16 }, true,
    );
    const tracks = (player.dash?.audio || []).filter(track => [30216, 30232, 30280].includes(track.id) && (!track.codecid || track.codecid === 0));
    const track = tracks.sort((a, b) => (a.bandwidth || 0) - (b.bandwidth || 0))[0];
    if (!track) throw new Error('Video has no supported AAC audio track');
    const url = new URL(track.baseUrl || track.base_url || '');
    if (url.protocol !== 'https:') throw new Error('Invalid audio URL protocol');
    // The anonymous Koishi client retains proxy support without exposing the account Cookie.
    const stream = await this.ctx.http.get<AsyncIterable<Uint8Array>>(url.href, {
      responseType: 'stream', timeout: 60000,
      headers: { Referer: `https://www.bilibili.com/video/${bvid}`, 'User-Agent': 'Mozilla/5.0' },
    });
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of stream)
    {
      length += chunk.byteLength;
      if (length > maxBytes) throw new Error(`Audio exceeds download size limit (${maxBytes} bytes)`);
      chunks.push(Buffer.from(chunk));
    }
    if (!length) throw new Error('Video audio is empty');
    return { bvid, cid, duration: info.duration, mime: 'audio/mp4', data: Buffer.concat(chunks, length) };
  }

  async getVideoComments(bvid: string, options: VideoCommentOptions = {}): Promise<VideoComment[]>
  {
    const info = await this.info(bvid);
    const limit = Math.max(1, Math.min(options.limit ?? 30, 60));
    if (options.root && !/^\d+$/.test(options.root)) throw new Error('Invalid root comment id');
    const rows: VideoComment[] = [];
    let next = 0;
    for (let page = 1; page <= 3 && rows.length < limit; page++)
    {
      const data = await this.get<{ replies: RawComment[] | null; cursor?: { next: number; is_end: boolean; }; }>(
        options.root ? '/x/v2/reply/reply' : '/x/v2/reply/main',
        options.root
          ? { type: 1, oid: info.aid, root: options.root, ps: 20, pn: page }
          : { type: 1, oid: info.aid, mode: options.sort === 'time' ? 2 : 3, next, ps: 20 },
        false, !!options.anonymous,
      );
      const replies = data.replies || [];
      rows.push(...replies.map(raw => ({
        rpid: raw.rpid_str || String(raw.rpid), root: raw.root_str || String(raw.root || 0),
        parent: raw.parent_str || String(raw.parent || 0), uid: String(raw.member.mid),
        name: raw.member.uname, text: raw.content.message, likes: raw.like,
        mentions: !!raw.content.members?.length,
      })));
      if (!replies.length || (!options.root && (!data.cursor || data.cursor.is_end))) break;
      next = data.cursor?.next || 0;
    }
    return rows.slice(0, limit);
  }

  async getUserVideos(uid: string, options: UserVideoOptions = {}): Promise<VideoBrief[]>
  {
    if (!/^\d+$/.test(uid)) throw new Error('Invalid user id');
    const days = Math.max(1, Math.min(options.days ?? 7, 90));
    const pages = Math.max(1, Math.min(options.pages ?? 2, 5));
    const since = Date.now() / 1000 - days * 86400;
    const result = new Map<string, VideoBrief>();
    for (let pn = 1; pn <= pages; pn++)
    {
      const data = await this.get<{ list: { vlist: RawVideo[]; }; }>('/x/space/wbi/arc/search', {
        mid: uid, pn, ps: 30, order: 'pubdate',
      }, true);
      const rows = data.list.vlist.map(normalize);
      for (const row of rows) if (row.pubdate >= since) result.set(row.bvid, { ...row, uid });
      if (rows.length < 30 || rows.some(row => row.pubdate < since)) break;
    }
    return [...result.values()].sort((a, b) => b.pubdate - a.pubdate);
  }

  async getRelatedVideos(bvid: string): Promise<VideoBrief[]>
  {
    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) throw new Error('Invalid BV id');
    return (await this.get<RawVideo[]>('/x/web-interface/archive/related', { bvid })).map(normalize);
  }

  /** Creates a new top-level comment. sendComment remains a reply-only API. */
  async createVideoComment(bvid: string, text: string, mentions: BilibiliCommentMention[] = []): Promise<string>
  {
    if (!text.trim()) throw new Error('Comment text is empty');
    if (mentions.some(item => !/^\d+$/.test(item.id) || !item.name)) throw new Error('Invalid mention');
    const info = await this.info(bvid);
    const data = await this.post<{ rpid?: number; rpid_str?: string; reply?: { rpid: number; rpid_str?: string; }; }>('/x/v2/reply/add', {
      oid: info.aid, type: 1, plat: 1, message: text, root: 0, parent: 0,
      at_name_to_mid: JSON.stringify(Object.fromEntries(mentions.map(item => [item.name, item.id]))),
    });
    const id = data.rpid_str || data.reply?.rpid_str || String(data.rpid || data.reply?.rpid || '');
    if (!id) throw new Error('Comment submitted without rpid; do not resend automatically');
    return id;
  }

  async getFavoriteFolders(): Promise<FavoriteFolder[]>
  {
    const data = await this.get<{ list: FavoriteFolder[] | null; }>('/x/v3/fav/folder/created/list-all', { up_mid: this.bot.selfId });
    return data.list || [];
  }

  async addVideoToFavorite(bvid: string, folderId: string): Promise<void>
  {
    if (!/^\d+$/.test(folderId) || /^0+$/.test(folderId)) throw new Error('Invalid favorite folder id');
    const info = await this.info(bvid);
    await this.post('/x/v3/fav/resource/deal', { rid: info.aid, type: 2, add_media_ids: folderId, del_media_ids: '' });
  }

  async getCommentVisibility(bvid: string, rpid: string, root?: string): Promise<'public' | 'pending' | 'missing'>
  {
    if (!/^\d+$/.test(rpid)) throw new Error('Invalid comment id');
    const options: VideoCommentOptions = { limit: 60, root, sort: 'time', anonymous: true };
    if ((await this.getVideoComments(bvid, options)).some(item => item.rpid === rpid)) return 'public';
    if ((await this.getVideoComments(bvid, { ...options, anonymous: false })).some(item => item.rpid === rpid)) return 'pending';
    // Only a bounded set of comments is inspected; missing does not mean unsent.
    return 'missing';
  }
}
