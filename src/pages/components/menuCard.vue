<template>
	<div v-show="showMenuCard" ref="menuCardRef" class="menu-card-card glass-card">
		<div class="menu-card-card-header">
			<div class="menu-card-card-header-title">
				<div class="menu-card-card-header-title-text">
					<el-tooltip
						:content="menuTitle"
						placement="top"
						effect="dark"
						:disabled="!menuTitleOverflow"
					>
						<div
							ref="menuTitleRef"
							class="menu-card-card-header-title-text-title"
							@mouseenter="syncMenuTitleOverflow"
						>
							{{ menuTitle }}
						</div>
					</el-tooltip>
				</div>
			</div>
		</div>
		<div class="menu-card-content">
			<ul v-if="props.mode === 'system'" class="menu-card-list">
				<hr />
				<li class="menu-card-item" @click="goTo('/')">
					{{ '🏠 ' + t('homepage') }}
				</li>
				<hr />
				<li class="menu-card-item" v-if="canAccessChat" @click="goTo('/agents')">
					{{ '🤖 ' + t('ai.assistant') }}
				</li>
				<li class="menu-card-item" v-if="canAccessAdmin" @click="goTo('/kb')">
					{{ '📚 ' + t('kb.knowledge.base') }}
				</li>
				<li class="menu-card-item" v-if="canAccessAdmin" @click="goTo('/mcp')">
					{{ '🧩 ' + t('mcp.title') }}
				</li>
				<li class="menu-card-item" v-if="canAccessAdmin" @click="goTo('/files')">
					{{ '📁 ' + t('files.title') }}
				</li>
				<li class="menu-card-item" v-if="canAccessAdmin" @click="goTo('/settings')">
					{{ '⚙️ ' + t('settings.title') }}
				</li>
			</ul>
			<ul v-else class="menu-card-list">
				<hr />
				<li class="menu-card-item" @click="goTo('/account')">
					{{ t('account.title') }}
				</li>
				<hr />
				<li class="menu-card-item" @click="goTo('/logout')">
					{{ t('logout') }}
				</li>
			</ul>
		</div>
	</div>
</template>
<script setup lang="ts">
import { t } from '@ai-system/lib'
import { ElTooltip } from 'element-plus'
import { computed, ref, onUnmounted, watch } from 'vue'
import { goTo } from '@/routes'
import { hasRoleAccess, ROLE_ADMIN, ROLE_USER } from '@/utils/role'

defineExpose({
	show,
	hide
})

const props = withDefaults(
	defineProps<{
		mode?: 'system' | 'user'
		title?: string
	}>(),
	{
		mode: 'system',
		title: ''
	}
)

const emit = defineEmits(['show-change'])

const showMenuCard = ref(false)
const menuCardRef = ref<HTMLElement | null>(null)
const isClickOutsideEnabled = ref(false)
const canAccessChat = computed(() => hasRoleAccess(ROLE_USER))
const canAccessAdmin = computed(() => hasRoleAccess(ROLE_ADMIN))
const menuTitle = computed(() => props.title || t('common.system.options'))
const menuTitleRef = ref<HTMLElement | null>(null)
const menuTitleOverflow = ref(false)

function syncMenuTitleOverflow() {
	const el = menuTitleRef.value
	menuTitleOverflow.value = el ? el.scrollWidth > el.clientWidth : false
}

function show() {
	showMenuCard.value = !showMenuCard.value
	if (showMenuCard.value) {
		setTimeout(() => {
			isClickOutsideEnabled.value = true
			document.addEventListener('click', handleClickOutside)
		}, 0)
	} else {
		hide()
	}
}

function hide() {
	showMenuCard.value = false
	isClickOutsideEnabled.value = false
	document.removeEventListener('click', handleClickOutside)
}

const handleClickOutside = (event: MouseEvent) => {
	if (!isClickOutsideEnabled.value) {
		return
	}
	if (menuCardRef.value && !menuCardRef.value.contains(event.target as Node)) {
		showMenuCard.value = false
		isClickOutsideEnabled.value = false
		document.removeEventListener('click', handleClickOutside)
	}
}

onUnmounted(() => {
	document.removeEventListener('click', handleClickOutside)
})

watch(showMenuCard, (newValue) => {
	emit('show-change', newValue)
})

</script>
<style lang="scss" scoped>
.menu-card-card {
	border-radius: var(--n-radius-quadruple);
	display: flex;
	flex-direction: column;
	padding: 20px;
	position: fixed;
	top: 20px;
	right: 20px;
	width: 250px;
	max-height: 80vh;
	z-index: 1000;
	box-sizing: border-box;

	.menu-card-card-header-title-text :deep(.el-tooltip__trigger) {
		display: block;
		min-width: 0;
		max-width: 100%;
	}

	.menu-card-card-header-title-text-title {
		padding-left: var(--n-padding-basic);
		font-size: 18px;
		font-weight: bold;
		line-height: var(--n-font-line-height-3);
		color: var(--n-color-text-primary);
		margin-bottom: 15px;
		max-width: 100%;
		box-sizing: border-box;
		overflow-x: hidden;
		overflow-y: visible;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.menu-card-content {
		flex: 1;
	}

	.menu-card-list {
		list-style: none;
		padding: 0;
		margin: 0;
		hr {
			border: none;
			height: 1px;
			background-color: var(--n-color-border);
			margin: 4px 0;
		}
	}

	.menu-card-item {
		color: var(--n-color-text-primary);
		cursor: pointer;
		border-radius: var(--n-radius-triple);
		padding: var(--n-padding-basic);

		&:last-child {
			border-bottom: none;
		}

		&:hover {
			background-color: var(--el-color-primary);
		}
	}
}
</style>
