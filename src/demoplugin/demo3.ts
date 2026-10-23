/*

import { Context, Schema, Universal } from 'koishi'

// import { } from '@lumia.wang/koishi-plugin-adapter-bilibili'

export const name = 'bilibili-live-chat-demo'

export function apply(ctx: Context) {

    let danmakuStats = {
        count: 0,
        users: new Set<string>(),
        startTime: Date.now()
    }

    ctx.on('bilibili/live-chat' as any, (data) => {
        if (data.message.type === 'danmaku') {
            danmakuStats.count++
            danmakuStats.users.add(data.message.data.uname)
        }
    })

    // 监听直播间弹幕事件
    ctx.on('bilibili/live-chat' as any, (data) => {
        const { roomId, roomInfo, message } = data
        switch (message.type) {
            case 'danmaku':
                // 处理弹幕消息
                // 主要是这种
                const danmaku = message.data
                ctx.logger.info(`[直播间 ${roomId}] ${danmaku.uname}: ${danmaku.text}`)

                // // 检测粉丝牌 // 没什么用吧
                // if (danmaku.medal) {
                //     ctx.logger.info(`[直播间 ${roomId}] ${danmaku.uname} 佩戴粉丝牌: ${danmaku.medal.name} (${danmaku.medal.level}级)`)
                // }
                break

            case 'gift':
                // 处理礼物消息
                const gift = message.data
                ctx.logger.info(`[直播间 ${roomId}] ${gift.uname} 送出了 ${gift.num} 个 ${gift.giftName} (价值: ${gift.total_coin}币)`)
                break

            case 'welcome':
                // 处理用户进入直播间
                const welcome = message.data
                ctx.logger.info(`[直播间 ${roomId}] ${welcome.uname} 进入直播间`)
                break

            case 'super_chat':
                // 处理醒目留言
                ctx.logger.info(`[直播间 ${roomId}] ${JSON.stringify(message.data)}`)
                break

            case 'guard_buy':
                // 处理上舰消息
                ctx.logger.info(`[直播间 ${roomId}] ${JSON.stringify(message.data)}`)
                break

            default:
                // 其他类型消息
                ctx.logger.info(`[直播间 ${roomId}] [${message.type}]:`, message.raw?.cmd || 'unknown')
                break
        }
    })

    ctx.command('live <action> [roomId:number]', '直播间控制命令')
        .example('live enter 123456 - 进入直播间123456')
        .example('live leave - 退出当前直播间')
        .example('live status - 查看当前状态')
        .action(async ({ session }, action, roomId) => {
            const bot = Object.values(ctx.bots).find(b => b.selfId === '312276085' || b.user?.id === '312276085');
            if (!bot || bot.status !== Universal.Status.ONLINE) {
                ctx.logger.error(`机器人离线或未找到`);
                return '❌ 机器人离线或未找到';
            }
            if (bot == null) return '❌ 机器人未找到';

            const bilibiliBot = bot as any;

            // 检查bot是否支持直播间功能
            if (!bilibiliBot.enterLiveRoom) {
                return '❌ 当前机器人不支持直播间功能'
            }

            try {
                switch (action) {
                    case 'enter':
                        if (!roomId) {
                            return '❌ 请提供直播间ID\n用法: live enter <房间ID>'
                        }

                        // 检查房间ID是否有效
                        if (roomId <= 0) {
                            return '❌ 直播间ID必须是正整数'
                        }

                        await bilibiliBot.enterLiveRoom(roomId)
                        return `✅ 成功进入直播间 ${roomId}\n现在可以接收该直播间的弹幕消息了！`

                    case 'leave':
                        const currentRoomId = bilibiliBot.getCurrentLiveRoomId()
                        if (!currentRoomId) {
                            return '❌ 当前未在任何直播间中'
                        }

                        await bilibiliBot.leaveLiveRoom()
                        return `✅ 成功退出直播间 ${currentRoomId}`

                    case 'status':
                        const currentRoom = bilibiliBot.getCurrentLiveRoomId()
                        const isConnected = bilibiliBot.isConnectedToLiveRoom()

                        if (currentRoom) {
                            const statusText = isConnected ? '✅ 已连接' : '❌ 连接断开'
                            return `📊 当前状态:\n直播间: ${currentRoom}\n连接状态: ${statusText}`
                        } else {
                            return '📊 当前状态: 未在任何直播间中'
                        }

                    default:
                        return `❌ 未知操作: ${action}\n\n可用操作:\n• enter <房间ID> - 进入直播间\n• leave - 退出直播间\n• status - 查看状态`
                }
            } catch (error) {
                console.error('直播间操作失败:', error)
                return `❌ 操作失败: ${error.message}`
            }
        })

    ctx.command('live-stats', '查看弹幕统计')
        .action(async ({ session }) => {
            const bot = Object.values(ctx.bots).find(b => b.selfId === '312276085' || b.user?.id === '312276085');
            if (!bot || bot.status !== Universal.Status.ONLINE) {
                ctx.logger.error(`机器人离线或未找到`);
                return '❌ 机器人离线或未找到';
            }
            if (bot == null) return '❌ 机器人未找到';

            const bilibiliBot = bot as any;
            const currentRoomId = bilibiliBot?.getCurrentLiveRoomId()

            if (!currentRoomId) {
                return '❌ 当前未在任何直播间中'
            }

            const duration = Math.floor((Date.now() - danmakuStats.startTime) / 1000)
            const avgPerMinute = duration > 0 ? Math.floor((danmakuStats.count / duration) * 60) : 0

            return `📈 弹幕统计 (直播间 ${currentRoomId}):\n` +
                `• 总弹幕数: ${danmakuStats.count}\n` +
                `• 发言用户: ${danmakuStats.users.size}\n` +
                `• 统计时长: ${duration}秒\n` +
                `• 平均频率: ${avgPerMinute}条/分钟`
        })

    ctx.command('live-reset-stats', '重置弹幕统计')
        .action(() => {
            danmakuStats = {
                count: 0,
                users: new Set<string>(),
                startTime: Date.now()
            }
            return '✅ 弹幕统计已重置'
        })

}
*/