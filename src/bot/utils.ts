// 工具函数集合
import { logInfo, loggerError } from '../index';
import { Context } from 'koishi';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';

/** 新版数据目录 */
const CURRENT_DATA_DIR = ['data', 'adapter', 'adapter-bilibili-dm'] as const;
/** 旧版数据目录，用于兼容和迁移 */
const LEGACY_DATA_DIR = ['data', 'adapter-bilibili-dm'] as const;
/** 防止同一个 Context 并发执行重复迁移 */
const migrationPromises = new WeakMap<Context, Promise<void>>();

/**
 * 验证UID是否为有效的数字
 * @param uid UID字符串
 * @returns 是否为有效的数字UID
 */
export function isValidUid(uid: string): boolean
{
  return /^\d+$/.test(uid);
}

/**
 * 检查UID列表中是否包含通配符
 * @param blockedUids 屏蔽的UID列表
 * @returns 是否包含通配符
 */
export function hasWildcardUid(blockedUids: Array<{ name: string; uid: string; }>): boolean
{
  return blockedUids.some(item => item.uid.includes('*'));
}

/**
 * 检查是否应该忽略所有私信
 * @param blockedUids 屏蔽的UID列表
 * @returns 是否忽略所有私信
 */
export function shouldIgnoreAllPrivateMessages(blockedUids: Array<{ name: string; uid: string; }>): boolean
{
  return hasWildcardUid(blockedUids);
}

/**
 * 检查消息是否应该被屏蔽
 * @param senderUid 发送者UID
 * @param blockedUids 屏蔽的UID列表
 * @returns 是否屏蔽该消息
 */
export function shouldBlockMessage(senderUid: string, blockedUids: Array<{ name: string; uid: string; }>): boolean
{
  // 如果包含通配符，忽略所有私信
  if (shouldIgnoreAllPrivateMessages(blockedUids))
  {
    logInfo(`检测到通配符配置，忽略所有私信消息`);
    return true;
  }

  // 检查是否在屏蔽列表中
  const shouldBlock = blockedUids.some(blocked =>
  {
    // 只验证有效的数字UID
    if (!isValidUid(blocked.uid))
    {
      logInfo(`忽略无效的屏蔽UID配置: ${blocked.uid} (名称: ${blocked.name})`);
      return false;
    }
    return blocked.uid === senderUid;
  });

  if (shouldBlock)
  {
    logInfo(`屏蔽来自UID ${senderUid} 的消息`);
  }

  return shouldBlock;
}

/**
 * 过滤无效的屏蔽配置
 * @param blockedUids 原始屏蔽UID列表
 * @returns 过滤后的有效配置
 */
export function filterValidBlockedUids(blockedUids: Array<{ name: string; uid: string; }>): Array<{ name: string; uid: string; }>
{
  return blockedUids.filter(item =>
  {
    const isValid = isValidUid(item.uid) || item.uid.includes('*');
    if (!isValid)
    {
      logInfo(`过滤无效的屏蔽配置: UID=${item.uid}, 名称=${item.name}`);
    }
    return isValid;
  });
}

/**
 * 获取适配器的数据文件路径
 * @param ctx Koishi 上下文
 * @param selfId 机器人实例的 selfId
 * @param subpaths 文件或子目录路径
 * @returns 完整的文件路径
 */
export function getDataFilePath(ctx: Context, selfId: string, ...subpaths: string[]): string
{
  const currentPath = resolve(ctx.baseDir, ...CURRENT_DATA_DIR, selfId, ...subpaths);
  const legacyPath = resolve(ctx.baseDir, ...LEGACY_DATA_DIR, selfId, ...subpaths);

  // 新目录不存在但旧文件仍存在时回退到旧路径，保证迁移失败也能读取旧数据
  if (!existsSync(currentPath) && existsSync(legacyPath))
  {
    return legacyPath;
  }

  if (!selfId)
  {
    // 在没有 selfId 的情况下，返回基础数据目录
    return resolve(ctx.baseDir, ...CURRENT_DATA_DIR);
  }
  // 为每个 selfId 创建独立的子目录
  return currentPath;
}

/**
 * 将旧版数据目录迁移到新版数据目录
 * @param ctx Koishi 上下文
 */
export async function migrateAdapterData(ctx: Context): Promise<void>
{
  const running = migrationPromises.get(ctx);
  if (running)
  {
    return running;
  }

  const task = migrateAdapterDataInternal(ctx);
  migrationPromises.set(ctx, task);
  try
  {
    await task;
  } finally
  {
    migrationPromises.delete(ctx);
  }
}

async function migrateAdapterDataInternal(ctx: Context): Promise<void>
{
  const legacyRoot = resolve(ctx.baseDir, ...LEGACY_DATA_DIR);
  const currentRoot = resolve(ctx.baseDir, ...CURRENT_DATA_DIR);

  // 没有旧目录时无需迁移
  if (!existsSync(legacyRoot))
  {
    return;
  }

  logInfo(`检测到旧版数据目录: ${legacyRoot}`);

  try
  {
    if (!existsSync(currentRoot))
    {
      // 新目录不存在时直接整体改名，保留原有目录结构
      await mkdir(dirname(currentRoot), { recursive: true });
      try
      {
        await rename(legacyRoot, currentRoot);
        logInfo(`旧版数据目录已迁移到: ${currentRoot}`);
        return;
      } catch (error)
      {
        // Windows 可能因目录句柄占用导致 rename 失败，改为逐文件复制兜底
        logInfo(`目录改名失败，改用逐文件复制迁移: ${formatError(error)}`);
      }
    }

    // 新目录已存在或改名失败时递归复制，目标已存在的同名文件不覆盖
    const migrated = await copyDirectory(legacyRoot, currentRoot);
    if (!migrated)
    {
      loggerError(`旧版数据目录存在无法自动处理的冲突，保留原目录: ${legacyRoot}`);
      return;
    }

    // 复制已完成；旧目录如果仍被占用，保留下来留待下次启动继续清理
    await rm(legacyRoot, { recursive: true, force: true }).catch((error) =>
    {
      logInfo(`旧版数据目录暂时无法删除，将在下次启动继续清理: ${formatError(error)}`);
    });
    logInfo(`旧版数据目录已迁移到: ${currentRoot}`);
  } catch (error)
  {
    loggerError(`旧版数据目录迁移失败: `, error);
  }
}

/**
 * 递归复制旧目录到新目录
 * @returns 所有条目均已处理时返回 true
 */
async function copyDirectory(source: string, target: string): Promise<boolean>
{
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  let allHandled = true;

  for (const entry of entries)
  {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);

    if (entry.isDirectory())
    {
      if (!existsSync(targetPath) || (await isDirectory(targetPath)))
      {
        const handled = await copyDirectory(sourcePath, targetPath);
        if (!handled)
        {
          allHandled = false;
        }
      } else
      {
        loggerError(`数据迁移冲突，跳过目录: ${sourcePath}`);
        allHandled = false;
      }
    } else
    {
      if (!existsSync(targetPath))
      {
        await copyFile(sourcePath, targetPath);
      } else if (!(await isDirectory(targetPath)))
      {
        // 新目录已存在同名文件时不覆盖，视为已迁移
      } else
      {
        loggerError(`数据迁移冲突，跳过文件: ${sourcePath}`);
        allHandled = false;
      }
    }
  }

  return allHandled;
}

function formatError(error: unknown): string
{
  return error instanceof Error ? error.message : String(error);
}

async function isDirectory(target: string): Promise<boolean>
{
  try
  {
    return (await stat(target)).isDirectory();
  } catch
  {
    return false;
  }
}
