# @lumia.wang/koishi-plugin-adapter-bilibili

个人使用，不推荐任何人下载。

Lumia 独立维护的 Koishi B站适配器，基于 [adapter-bilibili-dm 2.8.5](https://github.com/bilibili-plugins/koishi-plugin-adapter-bilibili-dm)（MIT）。原作者与许可证保留，详见 [NOTICE.md](NOTICE.md)。

保留原适配器的扫码登录、私信、评论回复、关注管理、动态和直播监听能力，并提供视频字幕、评论、UP 投稿、相关推荐、一级评论、收藏及评论可见性 API。

## 安装

在 Koishi 插件市场搜索 `@lumia.wang/adapter-bilibili`，或在 Koishi 项目目录执行：

```bash
npm install @lumia.wang/koishi-plugin-adapter-bilibili
```

配置插件条目为 `@lumia.wang/adapter-bilibili`，填写 B站账号 UID，启用后在设置页扫码登录。

```yaml
plugins:
  '@lumia.wang/adapter-bilibili':
    selfId: '你的B站UID'
```

从原版切换时，将原插件条目替换为上述条目，保留其他设置。账号数据目录与原版兼容，无须复制 Cookie；不要同时启用同一 UID 的两个适配器实例。

B站私信只推送给最后打开私信页面的客户端。机器人无法接收私信时，关闭其他客户端的私信页面，再重新启用适配器。

## 视频工具 API

下游插件通过已登录的 B站 Bot 调用 `bot.internal`，不需要维护另一份凭证或网络客户端。

| 方法 | 功能 |
| --- | --- |
| `getVideoSubtitle(bvid)` | 字幕全文及语言 |
| `getVideoComments(bvid, options?)` | 热评、最新评论或楼中楼 |
| `getUserVideos(uid, options?)` | UP 主近期投稿 |
| `getRelatedVideos(bvid)` | 相关推荐 |
| `createVideoComment(bvid, text, mentions?)` | 新发一级评论，支持真正的 @ 映射 |
| `getFavoriteFolders()` | 当前账号的收藏夹 |
| `addVideoToFavorite(bvid, folderId)` | 收藏视频 |
| `getCommentVisibility(bvid, rpid, root?)` | 匿名公开、仅本人可见或未查到 |

这些新增接口会传递网络和 B站接口异常。无字幕返回空文本；接口错误不会伪装成无字幕。现有 `sendComment` 保持仅回复已有评论的行为，新发评论使用 `createVideoComment`。

```ts
import type { Internal } from '@lumia.wang/koishi-plugin-adapter-bilibili'

const text = await bot.internal.getVideoSubtitle('BV1xx411c7mD')
```

完整签名、返回类型和可见性语义见 [API 文档](docs/video-toolkit.md)。

## 开发

```bash
npm install
npm test
npm run build
npm pack
```

构建包含 TypeScript 声明、Node.js 运行入口及 Koishi 控制台客户端，发布包可以直接加载。主运行环境要求 Node.js 20+。

本 fork 的反馈与维护：[lumia1998/koishi-plugin-adapter-bilibili-dm](https://github.com/lumia1998/koishi-plugin-adapter-bilibili-dm)。原项目的功能说明可参考其[文档](https://bilibili-plugins.github.io/koishi-plugin-adapter-bilibili-dm/)。
