<template>
  <div class="chat-manage-container" @click.self="closeOnBackdrop">
    <div class="chat-manage-card">
      <div class="chat-manage-header">
        <el-input
          v-if="showSearchInput"
          ref="searchInputRef"
          v-model="searchKey"
          class="search-input"
          :placeholder="$t('ai.search.history.context')"
          :suffix-icon="Search"
          autofocus
          @blur="showSearchInput = false"
        />
        <template v-else>
          <el-button type="primary" class="add" round @click="addNewChat">
            <i class="iconfont icon-chat-new"></i>{{ $t('ai.add.new.chat') }}
          </el-button>
          <el-button
            class="search-button"
            :icon="Search"
            circle
            @click="handleShowSearch()"
          />
        </template>
      </div>
      <div
        v-show="filteredHistoryList?.length || listRefreshing"
        class="chat-list"
      >
        <div class="list-title fx">
          <div class="text">{{ $t('ai.history.chat') }}</div>
          <div class="list-title-actions fx">
            <div
              v-if="batchMode"
              class="list-action clear-all"
              :class="{ 'is-disabled': selectedCount === 0 }"
              @click="selectedCount > 0 && confirmBatchDelete()"
            >
              <i class="iconfont icon-trash-alt"></i>{{ t('ai.batch.delete.action') }}
              <template v-if="selectedCount > 0"> ({{ selectedCount }})</template>
            </div>
            <div
              v-if="!batchMode"
              class="list-action batch-delete"
              @click="enterBatchMode()"
            >
              <i class="iconfont icon-trash-alt"></i>{{ $t('ai.batch.delete.chat') }}
            </div>
            <div
              v-else
              class="list-action batch-cancel"
              @click="exitBatchMode()"
            >
              {{ $t('ai.batch.delete.cancel') }}
            </div>
          </div>
        </div>
        <div class="list-content" @scroll="onListScroll">
          <div
            v-for="item in filteredHistoryList"
            :key="historyRowKey(item)"
            class="list-item fx"
            :class="{
              active: checkedHistoryId === item.contextId,
              'is-selected': batchMode && isHistoryItemSelected(item),
              'is-streaming': isHistoryItemBusy(item),
              'is-batch-mode': batchMode
            }"
            @click="handleListItemClick(item)"
          >
            <el-checkbox
              v-if="batchMode"
              class="batch-checkbox"
              :model-value="isHistoryItemSelected(item)"
              :disabled="isHistoryItemBusy(item)"
              @click.stop
              @update:model-value="(checked) => setHistoryItemSelected(item, !!checked)"
            />
            <div
              class="cont fx"
              style="height: 100%;"
            >
              <span
                v-if="isHistoryItemBusy(item)"
                class="streaming-orb"
                aria-hidden="true"
              />
              <i class="iconfont icon-lishiduihua"></i>
              <p>{{ historyItemTitle(item) }}</p>
            </div>
            <el-dropdown
              v-if="!batchMode"
              trigger="hover"
              placement="bottom-end"
            >
              <span class="el-dropdown-link">
                <span class="iconfont icon-vgengduo">...</span>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    :disabled="isHistoryItemBusy(item)"
                    @click.stop="deleteSingleHistoryChat(item)"
                  ><i class="iconfont icon-trash-alt"></i>
                    {{ t('common.delete') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div v-if="loadingMore" class="list-status">{{ t('ai.history.loading.more') }}</div>
          <div
            v-else-if="searchLoading"
            class="list-status"
          >{{ t('ai.history.search.loading') }}
          </div>
          <div v-if="listRefreshing" class="list-refresh-footer">
            <div class="list-refresh-bar" aria-hidden="true" />
            <div class="list-status">{{ t('ai.history.refreshing') }}</div>
          </div>
        </div>
        <div v-if="batchMode" class="list-batch-footer">
          <el-button
            type="danger"
            size="small"
            @click="clearAllHistoryChat()"
          >
            {{ t('ai.delete.all.chat') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

/** 历史列表分页大小（请求 limit+1 用于判断是否还有下一页） */
const HISTORY_PAGE_SIZE = 30
import { Search } from '@element-plus/icons-vue'
import {
  ElButton,
  ElInput,
  ElCheckbox,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElMessageBox,
  ElMessage
} from 'element-plus'
import {
  getHistoryContextList,
  deleteHistoryContext,
  clearAllHistoryContext
} from '@/api/ai.api'
import type { HistoryContextItem } from '@/types/ai.types'
import { debounce, t } from '@ai-system/lib'
import { isChatNarrowLayout } from '../ts/layout'
import { resolveHistoryItemTitle } from '../ts/history/title'
import { isContextStreaming } from '../ts/activity/live'
import { chatSessionRegistry } from '../ts/session/registry'
import { buildSessionKey } from '../ts/session/types'

const props = defineProps({
  newChat: {
    type: Function,
    required: true,
    default: () => {
    }
  },
  historyChat: {
    type: Function,
    required: true,
    default: () => {
    }
  },
  currContextId: {
    type: String,
    default: ''
  },
  messageContext: {
    type: Array,
    default: () => []
  },
  /** 与 ChatView/WebSocket 一致，用于列表过滤与删除范围 */
  agentId: {
    type: String,
    default: 'chat_assistant'
  }
})

/** 列表行稳定 key（同 context 多智能体时区分） */
const historyRowKey = (item: HistoryContextItem) =>
  buildSessionKey(item.agentId ?? props.agentId, item.contextId)

const historyItemTitle = (item: HistoryContextItem) =>
  resolveHistoryItemTitle(item.title ?? item.tittle, t)
const searchInputRef = ref()
const showSearchInput = ref(false)
const searchKey = ref('')

const historyList = ref<HistoryContextItem[]>([])
const filteredHistoryList = ref<HistoryContextItem[]>([])
const checkedHistoryId = ref(props.currContextId)
const listRefreshing = ref(false)
const loadingMore = ref(false)
const searchLoading = ref(false)
const hasMore = ref(true)
const batchMode = ref(false)
const selectedKeys = ref<Set<string>>(new Set())
const selectedCount = computed(() => selectedKeys.value.size)
const emit = defineEmits(['showChatManage'])

/** 窄屏遮罩空白处点击关闭（仅移动端生效） */
const closeOnBackdrop = () => {
  if (typeof window !== 'undefined' && isChatNarrowLayout(window.innerWidth)) {
    emit('showChatManage', false)
  }
}

watch(
  () => props.currContextId,
  (val) => {
    checkedHistoryId.value = val
  }
)

watch(
  () => props.agentId,
  () => {
    getHistoryListData()
  }
)

const isHistoryItemBusy = (item: HistoryContextItem) =>
  isContextStreaming(item.agentId ?? props.agentId, item.contextId)

const handleShowSearch = () => {
  showSearchInput.value = true
  nextTick(() => {
    searchKey.value = ''
    searchInputRef.value.focus()
  })
}
const addNewChat = () => {
  emit('showChatManage', false)
  if (!props.messageContext?.length) {
    ElMessage({
      message: t('ai.already.latest.chat'),
      type: 'success'
    })
    return
  }
  checkedHistoryId.value = ''
  props.newChat()
}

const goHistoryChat = (constextId: string) => {
  emit('showChatManage', false)
  checkedHistoryId.value = constextId
  props.historyChat(constextId)
  searchKey.value = ''
}

const handleListItemClick = (item: HistoryContextItem) => {
  if (batchMode.value) {
    if (isHistoryItemBusy(item)) {
      return
    }
    setHistoryItemSelected(item, !isHistoryItemSelected(item))
    return
  }
  goHistoryChat(item.contextId)
}

const fetchHistoryPage = async (offset: number) => {
  const res = await getHistoryContextList(offset, HISTORY_PAGE_SIZE + 1, props.agentId)
  return (res.data?.data ?? []) as HistoryContextItem[]
}

const mergeHistoryPage = (
  items: HistoryContextItem[],
  options?: { replace?: boolean }
) => {
  const pageItems =
    items.length > HISTORY_PAGE_SIZE ? items.slice(0, HISTORY_PAGE_SIZE) : items
  hasMore.value = items.length > HISTORY_PAGE_SIZE
  const byKey = options?.replace
    ? new Map<string, HistoryContextItem>()
    : new Map(historyList.value.map((item) => [historyRowKey(item), item]))
  for (const item of pageItems) {
    const key = historyRowKey(item)
    const existing = byKey.get(key)
    if (existing) {
      if (item.title !== undefined && (item.title ?? '').trim()) {
        existing.title = item.title
      }
      if (item.tittle !== undefined) {
        existing.tittle = item.tittle
      }
      if (item.lastUpdateTime !== undefined) {
        existing.lastUpdateTime = item.lastUpdateTime
      }
      if (item.agentId !== undefined) {
        existing.agentId = item.agentId
      }
    } else {
      byKey.set(key, { ...item })
    }
  }
  historyList.value = Array.from(byKey.values()).sort(
    (a, b) => (b.lastUpdateTime ?? 0) - (a.lastUpdateTime ?? 0)
  )
}

const getHistoryListData = async () => {
  listRefreshing.value = true
  hasMore.value = true
  try {
    const page = await fetchHistoryPage(0)
    mergeHistoryPage(page, { replace: true })
    filterList(searchKey.value)
  } finally {
    listRefreshing.value = false
  }
}

const loadMoreHistory = async () => {
  if (!hasMore.value || loadingMore.value || listRefreshing.value || searchLoading.value) {
    return
  }
  loadingMore.value = true
  try {
    const page = await fetchHistoryPage(historyList.value.length)
    mergeHistoryPage(page)
    filterList(searchKey.value)
  } finally {
    loadingMore.value = false
  }
}

const loadAllHistory = async () => {
  while (hasMore.value) {
    if (loadingMore.value || listRefreshing.value) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      continue
    }
    loadingMore.value = true
    try {
      const page = await fetchHistoryPage(historyList.value.length)
      mergeHistoryPage(page)
      filterList(searchKey.value)
    } finally {
      loadingMore.value = false
    }
  }
}

const onListScroll = (event: Event) => {
  const el = event.target as HTMLElement | null
  if (!el || !hasMore.value || searchKey.value.trim()) {
    return
  }
  const threshold = 64
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
    void loadMoreHistory()
  }
}

const isHistoryItemSelected = (item: HistoryContextItem) =>
  selectedKeys.value.has(historyRowKey(item))

const setHistoryItemSelected = (item: HistoryContextItem, checked: boolean) => {
  if (isHistoryItemBusy(item)) {
    return
  }
  const key = historyRowKey(item)
  const next = new Set(selectedKeys.value)
  if (checked) {
    next.add(key)
  } else {
    next.delete(key)
  }
  selectedKeys.value = next
}

const getSelectedContextIds = (): string[] => {
  const ids = new Set<string>()
  for (const key of selectedKeys.value) {
    const item = historyList.value.find((row) => historyRowKey(row) === key)
    if (item) {
      ids.add(item.contextId)
    }
  }
  return Array.from(ids)
}

const enterBatchMode = async () => {
  batchMode.value = true
  selectedKeys.value = new Set()
  searchLoading.value = true
  try {
    await loadAllHistory()
  } finally {
    searchLoading.value = false
  }
}

const exitBatchMode = () => {
  batchMode.value = false
  selectedKeys.value = new Set()
}

const deleteSessionsByContextIds = async (contextIds: string[]) => {
  // 须在 removeSession 之前记录：删除后 currContextId 会随活跃会话清空而无法比对
  const currentId = props.currContextId
  const removedCurrent = !!(currentId && contextIds.includes(currentId))
  for (const id of contextIds) {
    chatSessionRegistry.removeSession(props.agentId, id)
  }
  if (removedCurrent) {
    checkedHistoryId.value = ''
    await props.newChat()
  }
}

const deleteSingleHistoryChat = (item: HistoryContextItem) => {
  if (isHistoryItemBusy(item)) {
    ElMessage({
      message: t('ai.history.stop.chat.first'),
      type: 'warning'
    })
    return
  }
  ElMessageBox.confirm(t('ai.delete.warning'), t('ai.delete.chat.confirm'), {
    customClass: 'n-dialog--danger',
    confirmButtonText: t('common.ok'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  }).then(async () => {
    const contextId = item.contextId
    await deleteHistoryContext([contextId], props.agentId)
    await deleteSessionsByContextIds([contextId])
    await getHistoryListData()
  })
}

const confirmBatchDelete = () => {
  const contextIds = getSelectedContextIds()
  if (!contextIds.length) {
    return
  }
  ElMessageBox.confirm(
    t('ai.delete.warning'),
    t('ai.batch.delete.confirm', { count: contextIds.length }),
    {
      customClass: 'n-dialog--danger',
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).then(async () => {
    await deleteHistoryContext(contextIds, props.agentId)
    await deleteSessionsByContextIds(contextIds)
    exitBatchMode()
    await getHistoryListData()
  })
}

const clearAllHistoryChat = () => {
  ElMessageBox.confirm(
    t('ai.delete.warning'),
    t('ai.delete.all.chat.confirm'),
    {
      customClass: 'n-dialog--danger',
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).then(async () => {
    try {
      searchLoading.value = true
      try {
        await loadAllHistory()
      } finally {
        searchLoading.value = false
      }
      const deletableItems = historyList.value.filter(
        (item) => !isHistoryItemBusy(item)
      )
      const deletableContextIds = deletableItems.map((item) => item.contextId)
      if (!deletableContextIds.length) {
        return
      }
      await clearAllHistoryContext(props.agentId)
      await deleteSessionsByContextIds(deletableContextIds)
      await getHistoryListData()
    } finally {
      exitBatchMode()
    }
  })
}

const loadAllForSearch = debounce(async (key: string) => {
  if (!key.trim() || !hasMore.value) {
    searchLoading.value = false
    return
  }
  try {
    await loadAllHistory()
    filterList(key)
  } finally {
    searchLoading.value = false
  }
}, 300)

watch(
  () => searchKey.value,
  key => {
    filterList(key)
    if (!key.trim() || !hasMore.value) {
      loadAllForSearch.cancel()
      searchLoading.value = false
      return
    }
    searchLoading.value = true
    loadAllForSearch(key)
  }
)

const filterList = (key: string, data?: HistoryContextItem[]) => {
  const regex = new RegExp(key, 'i')
  const list = data ?? historyList.value
  filteredHistoryList.value = list.filter((item: HistoryContextItem) =>
    regex.test(historyItemTitle(item))
  )
}

const upsertSessionHistoryItem = (params: {
  contextId: string
  agentId?: string
  title?: string
  lastUpdateTime?: number
}) => {
  const agentId = params.agentId ?? props.agentId
  const now = params.lastUpdateTime ?? Date.now()
  const key = buildSessionKey(agentId, params.contextId)
  const existingIdx = historyList.value.findIndex(
    (item) => historyRowKey(item) === key
  )
  if (existingIdx >= 0) {
    const existing = historyList.value[existingIdx]
    existing.lastUpdateTime = now
    if (params.title) {
      existing.title = params.title
    }
    historyList.value.splice(existingIdx, 1)
    historyList.value.unshift(existing)
  } else {
    historyList.value.unshift({
      contextId: params.contextId,
      agentId,
      title: params.title ?? '',
      lastUpdateTime: now
    })
  }
  filterList(searchKey.value)
}

defineExpose({
  getHistoryListData,
  upsertSessionHistoryItem
})
</script>
<style lang="scss" scoped>
@use '@/styles/platform' as *;

.chat-manage-container {
  width: 340px;
  /* 右侧留足空间：卡片 elevation 阴影不压到聊天输入区左侧 */
  padding: 70px 24px var(--chat-side-gutter, 20px) 16px;
  margin: 0 12px 0 auto;
  display: flex;
  height: 100%;
  justify-content: center;
  overflow: visible;
  box-sizing: border-box;

  .iconfont {
    margin-right: 5px;
  }

  /* 窄屏浮层布局由 ChatView .is-history-open 控制，此处勿写全屏/70% 以免 v-show 关闭后仍占位 */

  .chat-manage-card {
    --chat-header-pad-top: 10px;
    --chat-list-gap-after-header: 10px;
    --chat-list-scroll-pad-top: 14px;
    --chat-list-pad-x: 10px;
    --chat-list-pad-bottom: 10px;
    @include n-glass-surface(2);
    box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
    border-radius: var(--n-radius-quadruple);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    height: 100%;
    flex: 1;
    width: 100%;
    max-width: 300px;
    margin: 0;
    padding: 20px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .chat-manage-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin: 0;
    padding: var(--chat-header-pad-top) var(--chat-list-pad-x) 16px;
    box-sizing: border-box;

    .el-button {
      height: 40px;
      margin: 0;

      &.add {
        flex: 1;
        min-width: 0;
        width: auto;
      }
    }

    .search-button {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      @include n-glass-surface(1);
      box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
    }

    .el-input {
      &.search-input {
        height: 40px;
        width: 100%;
        background: transparent;
        --el-input-bg-color: transparent;
        --el-input-border-color: transparent;
        --el-input-hover-border-color: transparent;
        --el-input-focus-border-color: transparent;

        :deep(.el-input__wrapper) {
          @include n-glass-surface(1);
          border-radius: 40px;
          transition: box-shadow 0.2s ease;
        }

        :deep(.el-input__inner) {
          background: transparent !important;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          box-shadow: none;
          color: var(--n-color-text-primary);
          font-family: inherit !important;
        }

        :deep(.el-input__inner::placeholder) {
          color: var(--n-color-text-placeholder);
        }

        :deep(.el-input__suffix) {
          background: transparent;
        }

        :deep(.el-input__wrapper:hover),
        :deep(.el-input__wrapper.is-focus) {
          box-shadow: 0 0 10px color-mix(in srgb, var(--el-color-primary) 30%, transparent),
          0 0 24px color-mix(in srgb, var(--el-color-primary) 14%, transparent),
          var(--n-shadow-elevation-1) !important;
        }

        :deep(.el-input__wrapper:hover:not(.is-focus)) {
          box-shadow: var(--n-shadow-elevation-1) !important;
        }

        :deep(input:-webkit-autofill),
        :deep(input:-webkit-autofill:hover),
        :deep(input:-webkit-autofill:focus) {
          -webkit-box-shadow: 0 0 0 1000px var(--n-color-bg-glass-weak) inset !important;
          -webkit-text-fill-color: var(--n-color-text-primary) !important;
          caret-color: var(--n-color-text-primary);
          transition: background-color 9999s ease-out;
        }
      }
    }
  }

  .chat-list {
    .text {
      color: var(--n-color-text-primary);
    }

    padding: var(--chat-list-gap-after-header) 0 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    flex: 1;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;

    .list-title {
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      width: 100%;
      margin: 0 0 12px;
      padding: 0 var(--chat-list-pad-x);
      box-sizing: border-box;

      .text {
        flex-shrink: 0;
        color: var(--n-color-text-primary);
        text-align: left;
      }

      .list-title-actions {
        flex-shrink: 0;
        align-items: center;
        gap: 10px;
        min-height: 18px;
      }

      .list-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 18px;
        color: var(--el-color-info);
        cursor: pointer;
        font-size: 12px;
        line-height: 18px;
        white-space: nowrap;

        .iconfont {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          line-height: 1;
          margin-right: 4px;
        }

        &:hover {
          color: var(--el-color-primary);
        }
      }

      .clear-all {
        color: var(--el-color-danger);

        &:hover {
          color: var(--el-color-danger);
          opacity: 0.82;
        }

        &.is-disabled {
          opacity: 0.45;
          cursor: not-allowed;
          pointer-events: none;
        }
      }
    }

    .list-batch-footer {
      flex-shrink: 0;
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 10px var(--chat-list-pad-x) var(--chat-list-pad-bottom);
      box-sizing: border-box;
      border-top: 1px solid color-mix(in srgb, var(--n-color-text-primary) 8%, transparent);
      background: transparent;
    }

    .list-content {
      width: 100%;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--chat-list-scroll-pad-top) var(--chat-list-pad-x) var(--chat-list-pad-bottom);
      box-sizing: border-box;

      .list-item {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin: 0 0 12px;
        padding: 0 14px;
        box-sizing: border-box;

        &:last-child {
          margin-bottom: 0;
        }

        @include n-glass-surface(1);
        box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
        border-radius: 15px;
        color: var(--n-color-text-primary);
        height: 45px;
        line-height: 45px;
        cursor: pointer;
        transition: color 0.2s ease,
        box-shadow 0.2s ease;

        &:hover {
          color: var(--el-color-primary);
        }

        &.active {
          color: var(--el-color-primary);
          box-shadow: 0 0 10px color-mix(in srgb, var(--el-color-primary) 30%, transparent),
          0 0 24px color-mix(in srgb, var(--el-color-primary) 14%, transparent);
        }

        &.is-selected {
          color: var(--el-color-primary);
          background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
        }

        &.is-batch-mode.is-streaming {
          opacity: 0.55;
          cursor: not-allowed;
          color: var(--n-color-text-placeholder);

          &:hover {
            color: var(--n-color-text-placeholder);
          }

          &.is-selected {
            color: var(--n-color-text-placeholder);
            background: transparent;
          }
        }

        &.is-batch-mode .cont {
          width: calc(100% - 28px);
        }

        .batch-checkbox {
          flex-shrink: 0;
          margin-right: 4px;
        }

        .cont {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: calc(100% - 20px);
          flex-grow: 1;
          min-width: 0;

          .streaming-orb {
            position: relative;
            flex-shrink: 0;
            width: 14px;
            height: 14px;
            display: inline-block;

            /* 外层柔光雾晕 */
            &::before {
              content: '';
              position: absolute;
              left: 50%;
              top: 50%;
              width: 20px;
              height: 20px;
              margin: -10px 0 0 -10px;
              border-radius: 50%;
              background: radial-gradient(
                circle at 50% 50%,
                rgba(255, 180, 120, 0.5) 0%,
                rgba(140, 190, 255, 0.38) 38%,
                rgba(255, 160, 100, 0.12) 58%,
                transparent 72%
              );
              filter: blur(5px);
              animation: streaming-orb-mist 2.4s ease-in-out infinite;
            }

            /* 内层渐变彩球 */
            &::after {
              content: '';
              position: absolute;
              left: 50%;
              top: 50%;
              width: 8px;
              height: 8px;
              margin: -4px 0 0 -4px;
              border-radius: 50%;
              background: conic-gradient(
                from 0deg,
                rgba(255, 147, 68, 0.82),
                rgba(200, 220, 255, 0.92),
                rgba(90, 160, 255, 0.88),
                rgba(255, 175, 110, 0.8),
                rgba(255, 147, 68, 0.82)
              );
              filter: blur(0.8px);
              box-shadow:
                0 0 5px rgba(255, 147, 68, 0.42),
                0 0 9px rgba(64, 158, 255, 0.28);
              animation: streaming-orb-spin 2s linear infinite;
            }
          }

          .iconfont {
            flex-shrink: 0;
            margin-right: 0;
          }

          p {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }

        .el-dropdown {
          z-index: 999;
          width: 20px;
          padding-left: 10px;
        }

        .icon-vgengduo {
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }

      .el-dropdown-link {
        display: flex;
        align-items: center;
      }

      .list-refresh-footer {
        position: sticky;
        bottom: calc(-1 * var(--chat-list-pad-bottom));
        z-index: 2;
        margin-top: 10px;
        pointer-events: none;
      }

      .list-refresh-bar {
        height: 2px;
        margin: 0 0 6px;
        border-radius: 2px;
        overflow: hidden;
        background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);

        &::after {
          content: '';
          display: block;
          height: 100%;
          width: 32%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--el-color-primary) 55%, transparent),
            transparent
          );
          animation: list-refresh-slide 1.15s ease-in-out infinite;
        }
      }

      .list-refresh-footer .list-status {
        padding: 0 0 2px;
        font-size: 11px;
        opacity: 0.55;
      }

      .list-status {
        padding: 8px 0 4px;
        font-size: 12px;
        line-height: 1.4;
        text-align: center;
        color: var(--n-color-text-placeholder);
      }
    }
  }
}

/* 窄屏：搜索条与历史卡片同 glass-2，避免盒中盒色差（上界与 layout.CHAT_NARROW_LAYOUT_MEDIA_MAX_PX 一致） */
@media (max-width: 1019px) {
  .chat-manage-container .chat-manage-header .el-input.search-input {
    :deep(.el-input__wrapper) {
      background: var(--n-color-bg-glass) !important;
      backdrop-filter: blur(var(--n-glass-blur-2)) saturate(var(--n-glass-saturate));
      -webkit-backdrop-filter: blur(var(--n-glass-blur-2)) saturate(var(--n-glass-saturate));
      box-shadow: var(--n-shadow-elevation-2) !important;
    }

    :deep(.el-input__wrapper:hover:not(.is-focus)) {
      box-shadow: var(--n-shadow-elevation-2) !important;
    }

    :deep(input:-webkit-autofill),
    :deep(input:-webkit-autofill:hover),
    :deep(input:-webkit-autofill:focus) {
      -webkit-box-shadow: 0 0 0 1000px var(--n-color-bg-glass) inset !important;
    }
  }
}

@keyframes streaming-orb-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes streaming-orb-mist {
  0%,
  100% {
    opacity: 0.72;
    transform: scale(0.9) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.1) rotate(180deg);
  }
}

@keyframes list-refresh-slide {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(380%);
  }
}
</style>
