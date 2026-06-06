<template>
  <div class="chat-manage-container" @click.self="closeOnBackdrop">
    <div class="chat-manage-card" :class="{ 'is-busy': isBusy }">
      <div class="chat-manage-header">
        <el-input
          v-if="showSearchInput"
          ref="searchInputRef"
          v-model="searchKey"
          class="search-input"
          :placeholder="$t('ai.search.history.context')"
          :suffix-icon="Search"
          :disabled="isBusy"
          autofocus
          @blur="showSearchInput = false"
        />
        <template v-else>
          <el-button type="primary" class="add" round :disabled="isBusy" @click="addNewChat">
            <i class="iconfont icon-chat-new"></i>{{ $t('ai.add.new.chat') }}
          </el-button>
          <el-button
            class="search-button"
            :icon="Search"
            circle
            :disabled="isBusy"
            @click="handleShowSearch()"
          />
        </template>
      </div>
      <div v-show="filteredHistoryList?.length" class="chat-list">
        <div class="list-title fx">
          <div class="text">{{ $t('ai.history.chat') }}</div>
          <div class="delete" :class="{ disabled: isBusy }" @click="deleteHistoryChat()">
            <i class="iconfont icon-trash-alt"></i
            >{{ $t('ai.delete.all.chat') }}
          </div>
        </div>
        <div
          v-loading="listLoading"
          class="list-content"
          @scroll="onListScroll"
        >
          <div
            v-for="item in filteredHistoryList"
            :key="historyRowKey(item)"
            class="list-item fx"
            :class="{ active: checkedHistoryId === item.contextId, disabled: isBusy }"
          >
            <div
              class="cont fx"
              :class="{ disabled: isBusy }"
              style="height: 100%;"
              @click="goHistoryChat(item.contextId)"
            >
              <i class="iconfont icon-lishiduihua"></i>
              <p>{{ historyItemTitle(item) }}</p>
            </div>
            <el-dropdown trigger="hover" placement="bottom-end" :disabled="isBusy">
							<span class="el-dropdown-link" :class="{ disabled: isBusy }">
								<span class="iconfont icon-vgengduo">...</span>
							</span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    :disabled="isBusy"
                    @click.stop="deleteHistoryChat(item.contextId)"
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
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

/** 历史列表分页大小（请求 limit+1 用于判断是否还有下一页） */
const HISTORY_PAGE_SIZE = 30
import { Search } from '@element-plus/icons-vue'
import {
  ElButton,
  ElInput,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElMessageBox,
  ElMessage
} from 'element-plus'
import { getHistoryContextList, deleteHistoryContext } from '@/api/ai.api'
import type { HistoryContextItem } from '@/types/ai.types'
import { debounce, t } from '@ai-system/lib'
import { isChatNarrowLayout } from '../layout'

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
  isBusy: {
    type: Boolean,
    default: false
  },
  /** 与 ChatView/WebSocket 一致，用于列表过滤与删除范围 */
  agentId: {
    type: String,
    default: 'chat_assistant'
  }
})

/** 列表行稳定 key（同 context 多智能体时区分） */
const historyRowKey = (item: HistoryContextItem) =>
  `${item.contextId}\u0001${item.agentId ?? props.agentId}`

/** 兼容后端 title / 历史 tittle 字段 */
const historyItemTitle = (item: HistoryContextItem) =>
  item.title ?? item.tittle ?? ''
const searchInputRef = ref()
const showSearchInput = ref(false)
const searchKey = ref('')

const historyList = ref<HistoryContextItem[]>([])
const filteredHistoryList = ref<HistoryContextItem[]>([])
const checkedHistoryId = ref(props.currContextId)
const listLoading = ref(false)
const loadingMore = ref(false)
const searchLoading = ref(false)
const hasMore = ref(true)
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

watch(
  () => props.isBusy,
  (val) => {
    if (val) {
      showSearchInput.value = false
    }
  }
)

const blockWhenBusy = (messageKey = 'ai.assistant.waiting') => {
  if (!props.isBusy) {
    return false
  }
  ElMessage({
    message: t(messageKey),
    type: 'info'
  })
  return true
}

const handleShowSearch = () => {
  if (blockWhenBusy()) {
    return
  }
  showSearchInput.value = true
  nextTick(() => {
    searchKey.value = ''
    searchInputRef.value.focus()
  })
}
const addNewChat = () => {
  if (blockWhenBusy()) {
    return
  }
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
  getHistoryListData()
}

const goHistoryChat = (constextId) => {
  if (blockWhenBusy('ai.history.stop.chat.first')) {
    return
  }
  emit('showChatManage', false)
  checkedHistoryId.value = constextId
  props.historyChat(constextId)
  searchKey.value = ''
}

const fetchHistoryPage = async (offset: number) => {
  const res = await getHistoryContextList(offset, HISTORY_PAGE_SIZE + 1, props.agentId)
  return (res.data?.data ?? []) as HistoryContextItem[]
}

const mergeHistoryPage = (items: HistoryContextItem[]) => {
  const pageItems =
    items.length > HISTORY_PAGE_SIZE ? items.slice(0, HISTORY_PAGE_SIZE) : items
  hasMore.value = items.length > HISTORY_PAGE_SIZE
  const existing = new Set(historyList.value.map(historyRowKey))
  const unique = pageItems.filter(item => !existing.has(historyRowKey(item)))
  if (unique.length) {
    historyList.value = [...historyList.value, ...unique]
  }
}

const getHistoryListData = async () => {
  listLoading.value = true
  hasMore.value = true
  historyList.value = []
  try {
    const page = await fetchHistoryPage(0)
    mergeHistoryPage(page)
    filterList(searchKey.value)
  } finally {
    listLoading.value = false
  }
}

const loadMoreHistory = async () => {
  if (!hasMore.value || loadingMore.value || listLoading.value || searchLoading.value) {
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
    await loadMoreHistory()
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

const deleteHistoryChat = (contextId?: string) => {
  if (blockWhenBusy()) {
    return
  }
  ElMessageBox.confirm(
    t('ai.delete.warning'),
    contextId ? t('ai.delete.chat.confirm') : t('ai.delete.all.chat.confirm'),
    {
      customClass: 'n-dialog--danger',
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).then(async () => {
    let contextIds: string[]
    if (contextId) {
      contextIds = [contextId]
    } else {
      searchLoading.value = true
      try {
        await loadAllHistory()
      } finally {
        searchLoading.value = false
      }
      contextIds = historyList.value.map(item => item.contextId)
    }
    if (!contextIds.length) {
      return
    }
    await deleteHistoryContext(contextIds, props.agentId)
    await getHistoryListData()
    if (contextId) {
      if (contextId === checkedHistoryId.value) {
        addNewChat()
      }
    } else {
      emit('showChatManage', false)
      checkedHistoryId.value = ''
      props.newChat()
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

defineExpose({
  getHistoryListData
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

    &.is-busy {
      opacity: 0.8;
    }
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
      width: 100%;
      margin: 0 0 12px;
      padding: 0 var(--chat-list-pad-x);
      box-sizing: border-box;

      .delete {
        color: var(--el-color-info);
        cursor: pointer;

        &:hover {
          color: var(--el-color-primary);
        }
      }

      .delete.disabled {
        cursor: not-allowed;
        opacity: 0.5;
        pointer-events: none;
      }
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

        &.disabled {
          cursor: default;
        }

        .cont {
          width: calc(100% - 20px);
          flex-grow: 1;

          p {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }

        .cont.disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .el-dropdown-link.disabled {
          cursor: not-allowed;
          opacity: 0.5;
          pointer-events: none;
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
</style>
