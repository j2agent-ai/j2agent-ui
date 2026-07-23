/** 平台通用助手（通用 AI 助手入口）常量 */
export const UNIVERSAL_ASSISTANT_ID = 'universal_assistant'
export const KNOWLEDGE_QA_ASSISTANT_ID = 'knowledge_qa_assistant'

export const AI_HUB_CHAT_PATH = `/chat/assistant?agent-id=${UNIVERSAL_ASSISTANT_ID}`
export const KNOWLEDGE_QA_CHAT_PATH = `/chat/assistant?agent-id=${KNOWLEDGE_QA_ASSISTANT_ID}`

/** 通用助手是否展示热门问题（qa-template） */
export const UNIVERSAL_ASSISTANT_SHOW_HOT_QUESTIONS = true
