<template>
	<div class="top-bar">
		<h3 class="tittle" @click="goTo('/')">
			<img class="top-bar-logo" :src="resolvedTopBarLogoUrl" :alt="topBarTittle" />
			<span v-if="showTitleText" class="title-text">
				<template v-if="topBarShowText">{{ topBarTittle }}</template>
				<template v-if="titleSuffix">
					<span class="title-suffix__sep" aria-hidden="true">·</span>
					<el-tooltip
						:content="titleSuffix"
						placement="bottom"
						effect="dark"
						popper-class="n-tooltip--on-dark"
						:disabled="!suffixOverflow"
					>
						<span
							ref="suffixRef"
							class="title-suffix__name"
							@mouseenter="syncSuffixOverflow"
						>{{ titleSuffix }}</span>
					</el-tooltip>
				</template>
			</span>
		</h3>
		<div v-if="!guest" class="menu-button-box">
			<slot name="external-menu"> </slot>
			<span
				class="menu-button"
				:class="{ active: showMenuCard }"
				@click="handleMenuCard"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="feather feather-menu"
				>
					<line x1="3" y1="12" x2="21" y2="12"></line>
					<line x1="3" y1="6" x2="21" y2="6"></line>
					<line x1="3" y1="18" x2="21" y2="18"></line>
				</svg>
			</span>
			<div class="user-dropdown">
				<button class="user-profile" type="button" @click.stop="toggleUserMenu">
					<span class="user-meta">
						<el-tooltip
							:content="displayUsername"
							placement="bottom"
							effect="dark"
							popper-class="n-tooltip--on-dark"
							:disabled="!userNameOverflow"
						>
							<span
								ref="userNameRef"
								class="user-name"
								@mouseenter="syncUserNameOverflow"
							>{{ displayUsername }}</span>
						</el-tooltip>
					</span>
					<span class="user-avatar">
						<img :src="defaultAvatar" alt="" />
					</span>
				</button>
			</div>
		</div>
	</div>
	<template v-if="!guest">
		<MenuCard
			ref="menuCardRef"
			class="menu-card"
			@show-change="showMenuCard = $event"
		/>
		<MenuCard
			ref="userMenuCardRef"
			mode="user"
			:title="sessionInfo.username || '用户'"
			class="user-menu-card"
			@show-change="showUserMenu = $event"
		/>
	</template>
</template>

<script setup lang="ts">
import { ElTooltip } from 'element-plus'
import { computed, ref } from 'vue'
import MenuCard from '@/pages/components/menuCard.vue'
import { topBarLogoUrl, topBarLogoUrlOnDark, topBarTittle, topBarShowText } from '@/oem'
import { goTo } from '@/routes'
import defaultAvatar from '@/assets/avatar.png'
import { getSessionInfo } from '@/utils/role'

/** 顶栏主标题后的可选后缀（如当前智能体名称） */
const props = withDefaults(
	defineProps<{
		titleSuffix?: string
		/** 未登录认证页：仅展示 logo 与标题 */
		guest?: boolean
	}>(),
	{ titleSuffix: '', guest: false }
)

const showTitleText = computed(
	() => topBarShowText || !!props.titleSuffix
)

/** 顶栏为深色玻璃背景，优先使用浅色 wordmark */
const resolvedTopBarLogoUrl = computed(
	() => topBarLogoUrlOnDark || topBarLogoUrl
)

const showMenuCard = ref(false)
const showUserMenu = ref(false)
const menuCardRef = ref<InstanceType<typeof MenuCard> | null>(null)
const userMenuCardRef = ref<InstanceType<typeof MenuCard> | null>(null)
const sessionInfo = ref(getSessionInfo())
const displayUsername = computed(() => sessionInfo.value.username || '用户')
const userNameRef = ref<HTMLElement | null>(null)
const userNameOverflow = ref(false)
const suffixRef = ref<HTMLElement | null>(null)
const suffixOverflow = ref(false)

function syncUserNameOverflow() {
	const el = userNameRef.value
	userNameOverflow.value = el ? el.scrollWidth > el.clientWidth : false
}

function syncSuffixOverflow() {
	const el = suffixRef.value
	suffixOverflow.value = el ? el.scrollWidth > el.clientWidth : false
}

const handleMenuCard = () => {
	hideUserMenu()
	menuCardRef.value?.show()
}

const toggleUserMenu = () => {
	menuCardRef.value?.hide()
	userMenuCardRef.value?.show()
}

const hideUserMenu = () => {
	userMenuCardRef.value?.hide()
}
</script>

<style lang="scss" scoped>
.top-bar {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	height: var(--n-topbar-height, 50px);
	background: var(--n-topbar-glass-bg);
	backdrop-filter: blur(var(--n-topbar-blur)) saturate(var(--n-topbar-saturate));
	-webkit-backdrop-filter: blur(var(--n-topbar-blur)) saturate(var(--n-topbar-saturate));
	border: 1px solid var(--n-topbar-border);
	box-shadow: var(--n-topbar-shadow);
	color: var(--n-topbar-text);
	isolation: isolate;
	display: flex;
	align-items: center;
	justify-content: left;
	z-index: 100;

	.tittle {
		margin: 0 0 0 20px;
		font-size: 16px;
		line-height: 32px;
		font-weight: 500;
		color: var(--n-topbar-text);
		text-shadow: var(--n-topbar-text-shadow);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0;
		min-width: 0;
		max-width: calc(100% - 168px);

		.top-bar-logo {
			height: 32px;
			width: auto;
			flex-shrink: 0;
			display: block;
			object-fit: contain;
		}

		.title-text {
			display: inline-flex;
			align-items: center;
			height: 32px;
			min-width: 0;
			flex: 0 1 auto;
			overflow: hidden;
			font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
			font-size: 20px;
			font-weight: 500;
			line-height: 32px;
      margin-left: 12px;
			color: var(--n-topbar-text-muted);
		}

		.title-suffix__sep {
			box-sizing: border-box;
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 18px;
			height: 32px;
			font-size: 16px;
			line-height: 1;
			color: color-mix(in srgb, var(--n-topbar-text-muted) 72%, transparent);
		}

		.title-suffix__name {
			min-width: 0;
			height: 32px;
			line-height: 32px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.title-text :deep(.el-tooltip__trigger) {
			display: inline-flex;
			align-items: center;
			height: 32px;
			min-width: 0;
			max-width: 100%;
			line-height: 32px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.menu-button-box {
		position: absolute;
		display: flex;
		align-items: center;
		gap: 6px;
		right: 0;
		height: 100%;
		padding-right: 6px;

		.user-dropdown {
			position: relative;
			height: 100%;
			display: flex;
			align-items: center;
			flex: 0 0 auto;
		}

		.user-profile {
			height: var(--n-topbar-height, 50px);
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 0 10px 0 12px;
			border: 0;
			background: transparent;
			color: var(--n-topbar-text);
			cursor: pointer;
			transition: background-color 0.2s ease;

			&:hover,
			&:focus-visible {
				background: var(--n-topbar-hover-bg);
				outline: none;
			}
		}

		.user-meta {
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 0;

			:deep(.el-tooltip__trigger) {
				display: block;
				min-width: 0;
				max-width: 100%;
			}
		}

		.user-name {
			display: inline-block;
			max-width: 120px;
			line-height: var(--n-font-line-height-2);
			overflow-x: hidden;
			overflow-y: visible;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 14px;
			color: var(--n-topbar-text);
		}

		.user-avatar {
			width: 32px;
			height: 32px;
			flex: 0 0 auto;
			display: block;
			border-radius: 50%;
			background: var(--n-topbar-hover-bg);
			border: 1px solid var(--n-topbar-divider);
			overflow: hidden;

			img {
				width: 100%;
				height: 100%;
				display: block;
				object-fit: cover;
			}
		}

		.menu-button {
			font-size: 24px;
			cursor: pointer;
			width: 36px;
			height: 36px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: var(--n-topbar-text-muted);
			border-radius: 8px;
			transition: all 0.3s;

			&:hover {
				color: var(--n-topbar-text);
				background: var(--n-topbar-hover-bg);
			}

			&.active {
				color: var(--el-color-primary);
				background: color-mix(
					in srgb,
					var(--el-color-primary) 22%,
					var(--n-topbar-hover-bg)
				);
			}
		}
	}

	/* 窄视图：缩小标题与图标；隐藏用户名，保留菜单按钮与头像 */
	@media (max-width: 768px) {
		.tittle {
			margin-left: 12px;
			max-width: calc(100% - 120px);

			.title-text,
			.title-suffix__name,
			.title-text :deep(.el-tooltip__trigger) {
				font-size: 16px;
			}
		}

		.menu-button-box {
			gap: 2px;
			padding-right: 4px;

			.menu-button {
				width: 30px;
				height: 30px;
				font-size: 20px;

				svg {
					width: 20px;
					height: 20px;
				}
			}

			.user-profile {
				gap: 0;
				padding: 0 8px;
			}

			.user-meta,
			.user-name {
				display: none;
			}

			.user-avatar {
				width: 26px;
				height: 26px;
			}
		}
	}
}
.menu-card {
	position: fixed;
	top: 60px;
	right: 10px;
	z-index: 100;
}

.user-menu-card {
	position: fixed;
	top: 60px;
	right: 10px;
	z-index: 100;
}
</style>
