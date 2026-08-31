/**
 * 浏览器本地会话记录。
 * 仅缓存一个"下次自动重入的对话 id"，有效期为 10 分钟。
 *
 * 记录的生命值由 UI 交互维护：
 * - 每次发消息交互时调用 recordLatestSession 刷新（充值生命值）；
 * - 点新建对话时调用 clearLatestSession 清空。
 */
const STORAGE_KEY = 'ai.chat.browserLatestSession.v1'
const LATEST_SESSION_TTL_MS = 10 * 60 * 1000

type BrowserLatestSessionRecord = {
  agentId: string
  contextId: string
  /** 最近一次交互时间，用于判断自动重入记录是否过期 */
  recordedAt: number
}

const readStoredRecord = (): BrowserLatestSessionRecord | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as BrowserLatestSessionRecord
    if (
      !record?.agentId ||
      !record?.contextId ||
      !Number.isFinite(record.recordedAt) ||
      Date.now() - record.recordedAt > LATEST_SESSION_TTL_MS
    ) {
      // 数据无效或已过期，清理
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return record
  } catch {
    return null
  }
}

/** 读取 10 分钟内缓存的下次自动重入会话；无记录、数据无效或过期时返回 null */
export const getLatestSession = (): { agentId: string; contextId: string } | null => {
  const record = readStoredRecord()
  if (!record) return null
  return { agentId: record.agentId, contextId: record.contextId }
}

/** 记录最新会话：每次用户发消息交互时刷新（覆盖式，只存一个） */
export const recordLatestSession = (
  agentId: string,
  contextId: string
): void => {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ agentId, contextId, recordedAt: Date.now() })
    )
  } catch {
    /* ignore */
  }
}

/** 清空记录：点新建对话时调用 */
export const clearLatestSession = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
