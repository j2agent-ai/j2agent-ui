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
					<span v-if="props.mode === 'user'" class="menu-card-role-badge">
						{{ currentRoleLabel }}
					</span>
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
				<li class="menu-card-item" v-if="canAccessChat" @click="goTo(AI_HUB_CHAT_PATH)">
					{{ '🤖 ' + t('ai.hub') }}
				</li>
				<li class="menu-card-item" v-if="canAccessChat" @click="goTo(KNOWLEDGE_QA_CHAT_PATH)">
					{{ '📚 ' + t('ai.knowledge.qa') }}
				</li>
				<li class="menu-card-item" v-if="canAccessKbAdmin" @click="goTo('/kb')">
					{{ '📚 ' + t('kb.knowledge.base') }}
				</li>
				<li class="menu-card-item" v-if="canAccessAdmin" @click="goTo('/agents')">
					{{ '💡 ' + t('ai.assistant') }}
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
				<hr />
				<li
					ref="languageItemRef"
					class="menu-card-item menu-card-language"
					:class="{ active: showLanguageMenu }"
					@click.stop="toggleLanguageMenu"
				>
					<span class="menu-card-language-title">
						{{ '💬 ' + t('settings.language') }}
					</span>
				</li>
			</ul>
			<ul v-else class="menu-card-list">
				<hr />
				<li class="menu-card-item" @click="goTo('/account')">
					{{ t('account.title') }}
				</li>
				<hr />
				<li class="menu-card-item" @click="handleLogout">
					{{ t('logout') }}
				</li>
			</ul>
		</div>
	</div>
	<Teleport to="body">
		<ul
			v-show="showLanguageMenu"
			ref="languageSubmenuRef"
			class="menu-card-language-submenu glass-card"
			:style="languageSubmenuStyle"
			@click.stop
		>
			<li
				v-for="option in languageOptions"
				:key="option.value"
				class="menu-card-language-option"
				:class="{ selected: currentLangMode === option.value }"
				@click="switchLanguage(option.value)"
			>
				<span>{{ option.label }}</span>
			</li>
		</ul>
	</Teleport>
</template>
<script setup lang="ts">
import { t } from '@ai-system/lib'
import { ElTooltip } from 'element-plus'
import { computed, nextTick, ref, onUnmounted, watch } from 'vue'
import { getLangStorage, normalizeLangMode } from '@ai-system/utils'
import { goTo } from '@/routes'
import {
	AI_HUB_CHAT_PATH,
	KNOWLEDGE_QA_CHAT_PATH
} from '@/pages/chat/ts/agent/universal-assistant'
import {
	getUserRole,
	hasRoleAccess,
	ROLE_ADMIN,
	ROLE_KB_ADMIN,
	ROLE_USER
} from '@/utils/role'

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
const canAccessKbAdmin = computed(() => hasRoleAccess(ROLE_KB_ADMIN))
const menuTitle = computed(() => props.title || t('common.system.options'))
const currentRoleLabel = computed(() => {
	const role = getUserRole()
	if (role === ROLE_ADMIN) {
		return t('user.management.role.admin')
	}
	if (role === ROLE_KB_ADMIN) {
		return t('user.management.role.kbAdmin')
	}
	return t('user.management.role.user')
})
const menuTitleRef = ref<HTMLElement | null>(null)
const menuTitleOverflow = ref(false)
const languageItemRef = ref<HTMLElement | null>(null)
const languageSubmenuRef = ref<HTMLElement | null>(null)
const languageSubmenuStyle = ref<Record<string, string>>({})
const currentLangMode = ref(normalizeLangMode(getLangStorage()))
const showLanguageMenu = ref(false)
const LANGUAGE_SUBMENU_WIDTH = 160
const LANGUAGE_SUBMENU_GAP = 8
const LANGUAGE_SUBMENU_EDGE = 8

function getTopbarSafeTop() {
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue('--n-topbar-height')
		.trim()
	const topbarHeight = Number.parseFloat(raw) || 50
	return topbarHeight + LANGUAGE_SUBMENU_EDGE
}

const languageOptions = computed(() => [
	{ label: t('settings.language.system'), value: 'system' },
	{ label: t('settings.language.zh'), value: 'zh' },
	{ label: t('settings.language.en'), value: 'en' }
])

function handleLogout() {
	void goTo('/logout')
}

function syncMenuTitleOverflow() {
	const el = menuTitleRef.value
	menuTitleOverflow.value = el ? el.scrollWidth > el.clientWidth : false
}

function switchLanguage(lang: string | number | boolean) {
	if (typeof lang !== 'string') {
		return
	}
	const langMode = normalizeLangMode(lang)
	currentLangMode.value = langMode
	window.webApp?.switchLang(langMode)
	showLanguageMenu.value = false
}

function toggleLanguageMenu() {
	showLanguageMenu.value = !showLanguageMenu.value
	if (showLanguageMenu.value) {
		nextTick(syncLanguageSubmenuPosition)
	}
}

function syncLanguageSubmenuPosition() {
	const el = languageItemRef.value
	if (!el) {
		return
	}
	const rect = el.getBoundingClientRect()
	const submenuHeight = languageSubmenuRef.value?.offsetHeight || 0
	const preferLeft = rect.left - LANGUAGE_SUBMENU_WIDTH - LANGUAGE_SUBMENU_GAP
	const openToLeft = preferLeft >= LANGUAGE_SUBMENU_EDGE
	const safeTop = getTopbarSafeTop()
	let left = openToLeft
		? preferLeft
		: Math.min(
			rect.left,
			window.innerWidth - LANGUAGE_SUBMENU_WIDTH - LANGUAGE_SUBMENU_EDGE
		)
	let top = openToLeft ? rect.top : rect.bottom + LANGUAGE_SUBMENU_GAP
	if (!openToLeft && top + submenuHeight > window.innerHeight - LANGUAGE_SUBMENU_EDGE) {
		top = rect.top - submenuHeight - LANGUAGE_SUBMENU_GAP
	}
	const maxTop = Math.max(
		safeTop,
		window.innerHeight - submenuHeight - LANGUAGE_SUBMENU_EDGE
	)
	left = Math.max(LANGUAGE_SUBMENU_EDGE, left)
	top = Math.min(Math.max(safeTop, top), maxTop)
	languageSubmenuStyle.value = {
		left: `${left}px`,
		top: `${top}px`,
		width: `${LANGUAGE_SUBMENU_WIDTH}px`
	}
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
	showLanguageMenu.value = false
	isClickOutsideEnabled.value = false
	document.removeEventListener('click', handleClickOutside)
	window.removeEventListener('resize', syncLanguageSubmenuPosition)
}

const handleClickOutside = (event: MouseEvent) => {
	if (!isClickOutsideEnabled.value) {
		return
	}
	const target = event.target as Node
	if (
		menuCardRef.value &&
		!menuCardRef.value.contains(target) &&
		!languageSubmenuRef.value?.contains(target)
	) {
		showMenuCard.value = false
		showLanguageMenu.value = false
		isClickOutsideEnabled.value = false
		document.removeEventListener('click', handleClickOutside)
		window.removeEventListener('resize', syncLanguageSubmenuPosition)
	}
}

onUnmounted(() => {
	document.removeEventListener('click', handleClickOutside)
	window.removeEventListener('resize', syncLanguageSubmenuPosition)
})

watch(showMenuCard, (newValue) => {
	if (!newValue) {
		showLanguageMenu.value = false
	}
	emit('show-change', newValue)
})

watch(showLanguageMenu, (newValue) => {
	if (newValue) {
		window.addEventListener('resize', syncLanguageSubmenuPosition)
	} else {
		window.removeEventListener('resize', syncLanguageSubmenuPosition)
	}
})

</script>
<style lang="scss" scoped>
.menu-card-card {
	border-radius: var(--n-radius-quadruple);
	display: flex;
	flex-direction: column;
	padding: 20px;
	position: fixed;
	top: calc(var(--n-topbar-height, 50px) + 10px);
	right: 20px;
	width: 280px;
	max-height: calc(100vh - var(--n-topbar-height, 50px) - 20px);
	z-index: 1000;
	box-sizing: border-box;

	.menu-card-card-header-title-text :deep(.el-tooltip__trigger) {
		display: inline-flex;
		min-width: 0;
		max-width: 100%;
	}

	.menu-card-card-header-title-text-title {
		padding-left: var(--n-padding-basic);
		font-size: 18px;
		font-weight: bold;
		line-height: var(--n-font-line-height-3);
		color: var(--n-color-text-primary);
		max-width: 100%;
		box-sizing: border-box;
		overflow-x: hidden;
		overflow-y: visible;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.menu-card-card-header-title-text {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		margin-bottom: 15px;
	}

	.menu-card-role-badge {
		flex: 0 0 auto;
		max-width: 120px;
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--el-color-primary) 14%, transparent);
		color: var(--el-color-primary);
		font-size: 12px;
		font-weight: 600;
		line-height: 20px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
		display: flex;
		align-items: center;
		min-height: 40px;
		box-sizing: border-box;
		max-width: 100%;
		color: var(--n-color-text-primary);
		cursor: pointer;
		border-radius: var(--n-radius-triple);
		padding: var(--n-padding-basic);
		line-height: var(--n-font-line-height-2);
		white-space: normal;
		overflow-wrap: anywhere;

		&:last-child {
			border-bottom: none;
		}

		&:hover {
			background-color: var(--el-color-primary);
		}
	}

	.menu-card-language {
		position: relative;

		&.active {
			background-color: var(--el-color-primary);
		}
	}

	.menu-card-language-title {
		display: block;
		overflow: hidden;
		white-space: normal;
		overflow-wrap: anywhere;
		line-height: inherit;
	}
}

.menu-card-language-submenu {
	position: fixed;
	padding: 20px;
	margin: 0;
	list-style: none;
	z-index: 1002;
	box-sizing: border-box;
	border-radius: var(--n-radius-quadruple);
	overflow: visible;
}

.menu-card-language-option {
	display: flex;
	align-items: center;
	min-height: 40px;
	box-sizing: border-box;
	color: var(--n-color-text-primary);
	border-radius: var(--n-radius-triple);
	padding: var(--n-padding-basic);
	line-height: var(--n-font-line-height-2);
	white-space: nowrap;
	cursor: pointer;

	&:hover,
	&.selected {
		background-color: var(--el-color-primary);
	}
}
</style>
