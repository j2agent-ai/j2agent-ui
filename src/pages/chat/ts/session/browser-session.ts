/**
 * 浏览器本地会话记录。
 * 仅缓存一个"下次自动重入的对话 id"，完全以 localStorage 为准，不做任何时间判断。
 *
 * 记录的生命值由 UI 交互维护：
 * - 每次发消息交互时调用 recordLatestSession 刷新（充值生命值）；
 * - 点新建对话时调用 clearLatestSession 清空。
 */
const STORAGE_KEY = 'ai.chat.browserLatestSession.v1'

type BrowserLatestSessionRecord = {
  agentId: string
  contextId: string
  /** 生命值：最近一次交互的时间戳，仅作元数据保留，不参与自动进入判断 */
  recordedAt: number
}

const readStoredRecord = (): BrowserLatestSessionRecord | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as BrowserLatestSessionRecord
    if (!record?.agentId || !record?.contextId) {
      // 数据无效，清理
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return record
  } catch {
    return null
  }
}

/** 读取缓存的下次自动重入会话；无记录或数据无效时返回 null */
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
