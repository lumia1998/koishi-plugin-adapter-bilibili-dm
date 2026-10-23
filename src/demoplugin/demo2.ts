/*

import { Context, Schema } from 'koishi'

// import { } from '@lumia.wang/koishi-plugin-adapter-bilibili'

export const name = 'bilibili-api-tester'

export interface Config {
    // 测试用的UP主UID
    testUid: string
    // 是否启用定时测试
    enablePeriodicTest: boolean
    // 测试间隔（分钟）
    testInterval: number
}

export const Config: Schema<Config> = Schema.object({
    testUid: Schema.string().default('').description('测试用的UP主UID（留空则测试所有关注的UP主）'),
    enablePeriodicTest: Schema.boolean().default(false).description('启用定时测试'),
    testInterval: Schema.number().min(1).max(60).default(5).description('测试间隔（分钟）')
})

export function apply(ctx: Context, config: Config) {
    ctx.logger.info('Bilibili API 测试插件已启动')

    // 注册测试命令
    ctx.command('bili-test', 'Bilibili API 测试命令')

    // 测试获取所有关注UP主的动态
    ctx.command('bili-test.all-dynamics', '测试获取所有关注UP主的动态')
        .action(async ({ session }) => {
            if (!session) return '无法获取会话信息'

            try {
                // 查找 bilibili 平台的机器人
                const bilibiliBot = ctx.bots.find(bot => bot.platform === 'bilibili')
                if (!bilibiliBot) {
                    return '未找到 Bilibili 机器人实例，请确保适配器已启动'
                }

                session.send('正在获取所有关注UP主的动态...')

                const dynamics = await bilibiliBot.internal.getAllFollowedDynamics()
                // ctx.logger.info(JSON.stringify(dynamics))
                if (dynamics.length === 0) {
                    return '未获取到任何动态，可能原因：\n1. 没有关注任何UP主\n2. Cookie已失效\n3. API调用失败'
                }

                let result = `成功获取到 ${dynamics.length} 条动态：\n\n`

                // 显示前5条动态的详细信息
                const displayCount = Math.min(5, dynamics.length)
                for (let i = 0; i < displayCount; i++) {
                    const dynamic = dynamics[i]
                    const author = dynamic.modules.module_author
                    const content = dynamic.modules.module_dynamic

                    result += `${i + 1}. UP主: ${author.name} (${author.mid})\n`
                    result += `   动态ID: ${dynamic.id_str}\n`
                    result += `   动作: ${author.pub_action}\n`
                    result += `   时间: ${author.pub_time}\n`
                    result += `   类型: ${dynamic.type}\n`

                    if (content.desc?.text) {
                        const text = content.desc.text.length > 50
                            ? content.desc.text.substring(0, 50) + '...'
                            : content.desc.text
                        result += `   内容: ${text}\n`
                    }

                    if (content.major?.archive) {
                        result += `   视频: ${content.major.archive.title}\n`
                    }

                    result += '\n'
                }

                if (dynamics.length > displayCount) {
                    result += `... 还有 ${dynamics.length - displayCount} 条动态未显示`
                }

                return result

            } catch (error) {
                ctx.logger.error('获取动态失败:', error)
                return `获取动态失败: ${error.message}`
            }
        })

    // 测试获取指定UP主的动态
    ctx.command('bili-test.user-dynamics <uid:string>', '测试获取指定UP主的动态')
        .action(async ({ session }, uid) => {
            if (!session) return '无法获取会话信息'
            if (!uid) {
                uid = config.testUid
                if (!uid) {
                    return '请提供UP主UID，或在配置中设置 testUid'
                }
            }

            try {
                const bilibiliBot = ctx.bots.find(bot => bot.platform === 'bilibili')
                if (!bilibiliBot) {
                    return '未找到 Bilibili 机器人实例'
                }

                session.send(`正在获取UP主 ${uid} 的动态...`)

                const dynamics = await bilibiliBot.internal.getPersonalDynamics(uid)

                if (dynamics.length === 0) {
                    return `UP主 ${uid} 没有动态或获取失败`
                }

                let result = `UP主 ${uid} 的动态 (共 ${dynamics.length} 条)：\n\n`

                const displayCount = Math.min(3, dynamics.length)
                for (let i = 0; i < displayCount; i++) {
                    const dynamic = dynamics[i]
                    const author = dynamic.modules.module_author
                    const content = dynamic.modules.module_dynamic

                    result += `${i + 1}. ${author.name}\n`
                    result += `   动态ID: ${dynamic.id_str}\n`
                    result += `   时间: ${author.pub_time}\n`
                    result += `   类型: ${dynamic.type}\n`

                    if (content.desc?.text) {
                        const text = content.desc.text.length > 100
                            ? content.desc.text.substring(0, 100) + '...'
                            : content.desc.text
                        result += `   内容: ${text}\n`
                    }

                    result += '\n'
                }

                return result

            } catch (error) {
                ctx.logger.error('获取UP主动态失败:', error)
                return `获取UP主动态失败: ${error.message}`
            }
        })

    // 测试获取关注列表
    ctx.command('bili-test.following', '测试获取关注列表')
        .action(async ({ session }) => {
            if (!session) return '无法获取会话信息'

            try {
                const bilibiliBot = ctx.bots.find(bot => bot.platform === 'bilibili')
                if (!bilibiliBot) {
                    return '未找到 Bilibili 机器人实例'
                }

                session.send('正在获取关注列表...')

                const followings = await bilibiliBot.internal.getFollowedUsers(2) // 只获取前2页

                if (followings.length === 0) {
                    return '未获取到关注列表，可能Cookie已失效'
                }

                let result = `关注列表 (共 ${followings.length} 个)：\n\n`

                const displayCount = Math.min(10, followings.length)
                for (let i = 0; i < displayCount; i++) {
                    const user = followings[i]
                    result += `${i + 1}. ${user.uname} (${user.mid})\n`
                    if (user.sign) {
                        const sign = user.sign.length > 30
                            ? user.sign.substring(0, 30) + '...'
                            : user.sign
                        result += `   签名: ${sign}\n`
                    }
                    result += '\n'
                }

                if (followings.length > displayCount) {
                    result += `... 还有 ${followings.length - displayCount} 个未显示`
                }

                return result

            } catch (error) {
                ctx.logger.error('获取关注列表失败:', error)
                return `获取关注列表失败: ${error.message}`
            }
        })

    // 测试动态详情获取
    ctx.command('bili-test.dynamic-detail <dynamicId:string>', '测试获取动态详情')
        .action(async ({ session }, dynamicId) => {
            if (!session) return '无法获取会话信息'
            if (!dynamicId) {
                return '请提供动态ID'
            }

            try {
                const bilibiliBot = ctx.bots.find(bot => bot.platform === 'bilibili')
                if (!bilibiliBot) {
                    return '未找到 Bilibili 机器人实例'
                }

                session.send(`正在获取动态 ${dynamicId} 的详情...`)

                const dynamic = await bilibiliBot.internal.getDynamicDetail(dynamicId)

                if (!dynamic) {
                    return `动态 ${dynamicId} 不存在或获取失败`
                }

                const author = dynamic.modules.module_author
                const content = dynamic.modules.module_dynamic
                const stat = dynamic.modules.module_stat

                let result = `动态详情：\n\n`
                result += `UP主: ${author.name} (${author.mid})\n`
                result += `时间: ${author.pub_time}\n`
                result += `类型: ${dynamic.type}\n`
                result += `点赞: ${stat.like.count} | 转发: ${stat.forward.count} | 评论: ${stat.comment.count}\n\n`

                if (content.desc?.text) {
                    result += `文字内容:\n${content.desc.text}\n\n`
                }

                if (content.major?.archive) {
                    const video = content.major.archive
                    result += `视频信息:\n`
                    result += `标题: ${video.title}\n`
                    result += `BV号: ${video.bvid}\n`
                    result += `简介: ${video.desc}\n`
                }

                if (content.major?.draw) {
                    result += `图片动态，包含 ${content.major.draw.items.length} 张图片\n`
                }

                return result

            } catch (error) {
                ctx.logger.error('获取动态详情失败:', error)
                return `获取动态详情失败: ${error.message}`
            }
        })

    // 快速查看最新动态详情
    ctx.command('bili-test.latest-detail [index:number]', '查看最新动态的详情')
        .action(async ({ session }, index = 1) => {
            if (!session) return '无法获取会话信息'

            try {
                const bilibiliBot = ctx.bots.find(bot => bot.platform === 'bilibili')
                if (!bilibiliBot) {
                    return '未找到 Bilibili 机器人实例'
                }

                session.send('正在获取最新动态列表...')

                const dynamics = await bilibiliBot.internal.getAllFollowedDynamics()

                if (dynamics.length === 0) {
                    return '未获取到任何动态'
                }

                if (index < 1 || index > dynamics.length) {
                    return `索引超出范围，请输入 1-${dynamics.length} 之间的数字`
                }

                const targetDynamic = dynamics[index - 1]
                const dynamicId = targetDynamic.id_str

                session.send(`正在获取第 ${index} 条动态的详情...`)

                const dynamic = await bilibiliBot.internal.getDynamicDetail(dynamicId)

                if (!dynamic) {
                    return `动态详情获取失败`
                }

                const author = dynamic.modules.module_author
                const content = dynamic.modules.module_dynamic
                const stat = dynamic.modules.module_stat

                let result = `第 ${index} 条动态详情：\n\n`
                result += `UP主: ${author.name} (${author.mid})\n`
                result += `动态ID: ${dynamic.id_str}\n`
                result += `发布动作: ${author.pub_action}\n`
                result += `发布时间: ${author.pub_time}\n`
                result += `时间戳: ${author.pub_ts}\n`
                result += `动态类型: ${dynamic.type}\n`
                result += `可见性: ${dynamic.visible ? '正常显示' : '折叠动态'}\n`
                result += `点赞: ${stat.like.count} | 转发: ${stat.forward.count} | 评论: ${stat.comment.count}\n`

                // 显示UP主认证信息
                if (author.official_verify && author.official_verify.type !== -1) {
                    result += `认证: ${author.official_verify.desc}\n`
                }

                // 显示大会员信息
                if (author.vip && author.vip.status > 0) {
                    result += `大会员: ${author.vip.label?.text || '是'}\n`
                }

                result += '\n'

                // 显示文字内容（完整版）
                if (content.desc?.text) {
                    result += `📝 文字内容:\n${content.desc.text}\n\n`

                    // 如果是默认查看第1条，显示富文本节点详情
                    if (index === 1 && content.desc.rich_text_nodes) {
                        result += `富文本节点详情:\n`
                        content.desc.rich_text_nodes.forEach((node, i) => {
                            result += `  ${i + 1}. 类型: ${node.type}\n`
                            result += `     原文: ${node.orig_text}\n`
                            if (node.jump_url) {
                                result += `     链接: ${node.jump_url}\n`
                            }
                        })
                        result += '\n'
                    }
                }

                // 视频信息
                if (content.major?.archive) {
                    const video = content.major.archive
                    result += `🎬 视频信息:\n`
                    result += `标题: ${video.title}\n`
                    result += `AV号: ${video.aid}\n`
                    result += `BV号: ${video.bvid}\n`
                    result += `时长: ${video.duration_text}\n`
                    result += `链接: ${video.jump_url}\n`
                    result += `封面: ${video.cover}\n`
                    result += `播放: ${video.stat?.play || '未知'} | 弹幕: ${video.stat?.danmaku || '未知'}\n`
                    result += `简介: ${video.desc}\n\n`
                }

                // 图片动态
                if (content.major?.draw) {
                    const draw = content.major.draw
                    result += `🖼️ 图片动态 (共 ${draw.items.length} 张):\n`
                    draw.items.forEach((item, i) => {
                        result += `图片${i + 1}: ${item.src}\n`
                        result += `  尺寸: ${item.width}x${item.height}\n`
                        result += `  大小: ${(item.size / 1024).toFixed(2)}KB\n`
                    })
                    result += '\n'
                }

                // 专栏信息
                if (content.major?.article) {
                    const article = content.major.article
                    result += `📄 专栏信息:\n`
                    result += `标题: ${article.title}\n`
                    result += `CV号: ${article.id}\n`
                    result += `链接: ${article.jump_url}\n`
                    result += `阅读量: ${article.label}\n`
                    result += `摘要: ${article.desc}\n`
                    if (article.covers && article.covers.length > 0) {
                        result += `封面图:\n`
                        article.covers.forEach((cover, i) => {
                            result += `  ${i + 1}. ${cover}\n`
                        })
                    }
                    result += '\n'
                }

                // 直播信息
                if (content.major?.live) {
                    const live = content.major.live
                    result += `🔴 直播信息:\n`
                    result += `标题: ${live.title}\n`
                    result += `房间号: ${live.id}\n`
                    result += `状态: ${live.live_state === 1 ? '正在直播' : '直播结束'}\n`
                    result += `分区: ${live.desc_first}\n`
                    result += `观看: ${live.desc_second}\n`
                    result += `链接: ${live.jump_url}\n`
                    result += `封面: ${live.cover}\n\n`
                }

                // 转发的原动态信息
                if (dynamic.orig) {
                    const origAuthor = dynamic.orig.modules.module_author
                    const origContent = dynamic.orig.modules.module_dynamic
                    result += `🔄 转发的原动态:\n`
                    result += `原UP主: ${origAuthor.name} (${origAuthor.mid})\n`
                    result += `原动态ID: ${dynamic.orig.id_str}\n`
                    result += `原动态类型: ${dynamic.orig.type}\n`
                    if (origContent.desc?.text) {
                        const origText = origContent.desc.text.length > 100
                            ? origContent.desc.text.substring(0, 100) + '...'
                            : origContent.desc.text
                        result += `原内容: ${origText}\n`
                    }
                    result += '\n'
                }

                // 如果是默认查看第1条，显示原始数据结构（调试用）
                if (index === 1) {
                    result += `🔧 调试信息:\n`
                    result += `基础信息: comment_type=${dynamic.basic.comment_type}, rid=${dynamic.basic.rid_str}\n`
                    if (content.topic) {
                        result += `话题: ${content.topic.name} (${content.topic.id})\n`
                    }
                    if (content.additional) {
                        result += `附加内容类型: ${content.additional.type}\n`
                    }
                }

                return result

            } catch (error) {
                ctx.logger.error('获取最新动态详情失败:', error)
                return `获取最新动态详情失败: ${error.message}`
            }
        })

    // 测试动态监听状态
    ctx.command('bili-test.polling-status', '查看动态监听状态')
        .action(async ({ session }) => {
            if (!session) return '无法获取会话信息'

            try {
                const bilibiliBot = ctx.bots.find(bot => bot.platform === 'bilibili')
                if (!bilibiliBot) {
                    return '未找到 Bilibili 机器人实例'
                }

                const isActive = bilibiliBot.internal.isPollingActive()
                const baseline = bilibiliBot.internal.getCurrentBaseline()

                let result = `动态监听状态：\n\n`
                result += `监听状态: ${isActive ? '运行中' : '已停止'}\n`
                result += `当前基线: ${baseline}\n`

                return result

            } catch (error) {
                ctx.logger.error('获取监听状态失败:', error)
                return `获取监听状态失败: ${error.message}`
            }
        })

    // 手动启动/停止动态监听
    ctx.command('bili-test.toggle-polling', '切换动态监听状态')
        .action(async ({ session }) => {
            if (!session) return '无法获取会话信息'

            try {
                const bilibiliBot = ctx.bots.find(bot => bot.platform === 'bilibili')
                if (!bilibiliBot) {
                    return '未找到 Bilibili 机器人实例'
                }

                const isActive = bilibiliBot.internal.isPollingActive()

                if (isActive) {
                    bilibiliBot.internal.stopDynamicPolling()
                    return '动态监听已停止'
                } else {
                    bilibiliBot.internal.startDynamicPolling(60000) // 60秒间隔
                    return '动态监听已启动（60秒间隔）'
                }

            } catch (error) {
                ctx.logger.error('切换监听状态失败:', error)
                return `切换监听状态失败: ${error.message}`
            }
        })

    // 定时测试功能
    let testInterval: NodeJS.Timeout | null = null

    if (config.enablePeriodicTest) {
        const intervalMs = config.testInterval * 60 * 1000 // 转换为毫秒

        testInterval = setInterval(async () => {
            try {
                const bilibiliBot = ctx.bots.find(bot => bot.platform === 'bilibili')
                if (!bilibiliBot) {
                    ctx.logger.warn('[定时测试] 未找到 Bilibili 机器人实例')
                    return
                }

                ctx.logger.info('[定时测试] 开始测试动态获取...')

                const dynamics = await bilibiliBot.internal.getAllFollowedDynamics()
                ctx.logger.info(`[定时测试] 成功获取 ${dynamics.length} 条动态`)

                if (dynamics.length > 0) {
                    const latest = dynamics[0]
                    const author = latest.modules.module_author
                    ctx.logger.info(`[定时测试] 最新动态来自: ${author.name} (${author.pub_time})`)
                }

            } catch (error) {
                ctx.logger.error('[定时测试] 测试失败:', error)
            }
        }, intervalMs)

        ctx.logger.info(`[定时测试] 已启动，间隔 ${config.testInterval} 分钟`)
    }

    // 插件停用时清理
    ctx.on('dispose', () => {
        if (testInterval) {
            clearInterval(testInterval)
            ctx.logger.info('[定时测试] 已停止')
        }
        ctx.logger.info('Bilibili API 测试插件已停用')
    })
}

*/