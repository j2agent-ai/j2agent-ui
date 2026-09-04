<template>
	<el-dialog
		v-model="visible"
		:title="
			type === 'agents'
				? t('resource.permission.title.agents')
				: t('resource.permission.title.knowledge')
		"
		width="min(820px, calc(100vw - 32px))"
		class="resource-dialog"
		append-to-body
		align-center
		:close-on-click-modal="false"
		@open="open"
	>
		<div class="resource-dialog-content">
			<div class="resource-context">
				<span>{{ t('resource.permission.current') }}</span
				><code>{{ resourceName || resourceId }}</code>
			</div>
			<el-alert
				v-if="loadError"
				:title="t('resource.permission.load.failed')"
				type="error"
				:closable="false"
				show-icon
			/>
			<section class="resource-section visibility-section">
				<div>
					<h3>{{ t('resource.permission.public') }}</h3>
					<p>
						{{
							type === 'agents'
								? t('resource.permission.public.hint.agents')
								: t('resource.permission.public.hint.knowledge')
						}}
					</p>
				</div>
				<div class="visibility-controls">
					<el-switch
						v-model="isPublic"
						:active-text="
							isPublic
								? t('resource.permission.public.on')
								: t('resource.permission.public.off')
						"
						:disabled="busy || loadError || visibilitySaving"
						:aria-label="t('resource.permission.public')"
					/>
					<el-tag v-if="visibilityDirty" size="small" type="warning">{{
						t('resource.permission.unsaved')
					}}</el-tag>
					<el-button
						type="primary"
						:loading="visibilitySaving"
						:disabled="busy || loadError || !visibilityDirty"
						@click="saveVisibility"
						>{{ t('common.save') }}</el-button
					>
				</div>
			</section>
			<section ref="grantFormSection" class="resource-section">
				<div class="resource-section-heading">
					<h3>
						{{
							editing
								? t('resource.permission.grant.edit')
								: t('resource.permission.grant.add')
						}}
					</h3>
					<el-button v-if="editing" link type="primary" @click="resetForm">{{
						t('resource.permission.grant.cancelEdit')
					}}</el-button>
				</div>
				<p>{{ t('resource.permission.grant.hint') }}</p>
				<el-form
					class="permission-form"
					label-position="top"
					:disabled="busy || loadError || visibilitySaving"
					@submit.prevent
				>
                    <el-form-item :label="t('resource.permission.username')"
						><el-input
                            v-model="username"
                            :placeholder="t('resource.permission.username.placeholder')"
							:readonly="editing"
					/></el-form-item>
					<el-form-item :label="t('resource.permission.level')">
						<el-select v-model="level">
							<el-option
								v-if="type === 'knowledge'"
								:value="1"
								:label="t('resource.permission.level.manage')"
							/>
							<el-option
								:value="2"
								:label="
									type === 'agents'
										? t('resource.permission.level.use')
										: t('resource.permission.level.read')
								"
							/>
						</el-select>
					</el-form-item>
					<el-form-item :label="t('resource.permission.expires')"
						><el-date-picker
							v-model="expiresAt"
							type="datetime"
							value-format="x"
							:placeholder="t('resource.permission.expires.placeholder')"
					/></el-form-item>
					<div class="permission-form-footer">
						<span>{{
							level === 1
								? t('resource.permission.level.hint.manage')
								: type === 'agents'
									? t('resource.permission.level.hint.use')
									: t('resource.permission.level.hint.read')
						}}</span>
						<el-button
							type="primary"
							:loading="busy"
							:disabled="!username.trim() || loadError"
							@click="save"
							>{{
								editing
									? t('resource.permission.grant.saveChanges')
									: t('resource.permission.grant.save')
							}}</el-button
						>
					</div>
				</el-form>
			</section>
			<section class="resource-section">
				<div class="resource-section-heading">
					<h3>
						{{ t('resource.permission.granted') }}
						<el-tag size="small" type="info" round>{{ grants.length }}</el-tag>
					</h3>
					<el-button link type="primary" :disabled="busy" @click="load">{{
						t('common.refresh')
					}}</el-button>
				</div>
				<el-table
					:data="grants"
					v-loading="busy"
					class="resource-table"
					max-height="300"
				>
					<el-table-column
						prop="username"
						:label="t('resource.permission.username')"
						min-width="160"
					/>
					<el-table-column :label="t('resource.permission.level')" width="100">
						<template #default="{ row }">
							<el-tag
								size="small"
								:type="row.permissionLevel === 1 ? 'warning' : 'info'"
								>{{ grantLevelLabel(row.permissionLevel) }}</el-tag
							>
						</template>
					</el-table-column>
					<el-table-column
						:label="t('resource.permission.validity')"
						min-width="180"
					>
						<template #default="{ row }">
							{{
								row.expiresAt
									? new Date(row.expiresAt).toLocaleString()
									: t('resource.permission.permanent')
							}}
							<el-tag v-if="row.expired" type="danger">{{
								t('resource.permission.expired')
							}}</el-tag>
						</template>
					</el-table-column>
					<el-table-column
						:label="t('common.action')"
						width="124"
						fixed="right"
					>
						<template #default="{ row }">
							<el-button
								link
								type="primary"
								:disabled="busy"
								@click="editGrant(row)"
								>{{ t('common.edit') }}</el-button
							>
							<el-button
								link
								type="danger"
								:disabled="busy"
								@click="revoke(row.username)"
								>{{ t('resource.permission.revoke') }}</el-button
							>
						</template>
					</el-table-column>
					<template #empty>
						<el-empty
							:image-size="56"
							:description="
								loadError
									? t('resource.permission.empty.error')
									: t('resource.permission.empty')
							"
						/>
					</template>
				</el-table>
				<div class="grant-mobile-list" v-loading="busy">
					<el-empty
						v-if="!grants.length"
						:image-size="56"
						:description="
							loadError
								? t('resource.permission.empty.error')
								: t('resource.permission.empty')
						"
					/>
					<article
						v-for="row in grants"
						:key="row.username"
						class="grant-mobile-item"
					>
						<code>{{ row.username }}</code>
						<div class="grant-mobile-tags">
							<el-tag
								size="small"
								:type="row.permissionLevel === 1 ? 'warning' : 'info'"
								>{{ grantLevelLabel(row.permissionLevel) }}</el-tag
							>
							<el-tag v-if="row.expired" size="small" type="danger">{{
								t('resource.permission.expired')
							}}</el-tag>
						</div>
						<p>
							{{
								row.expiresAt
									? t('resource.permission.expires.at', {
											time: new Date(row.expiresAt).toLocaleString()
										})
									: t('resource.permission.permanent.valid')
							}}
						</p>
						<div class="grant-mobile-actions">
							<el-button
								link
								type="primary"
								:disabled="busy"
								@click="editGrant(row)"
								>{{ t('common.edit') }}</el-button
							>
							<el-button
								link
								type="danger"
								:disabled="busy"
								@click="revoke(row.username)"
								>{{ t('resource.permission.revoke') }}</el-button
							>
						</div>
					</article>
				</div>
			</section>
		</div>
		<template #footer>
			<div class="resource-dialog-footer">
				<span>{{ t('resource.permission.footer') }}</span>
				<el-button @click="visible = false">{{ t('common.close') }}</el-button>
			</div>
		</template>
	</el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'
import { t } from '@ai-system/lib'
import '@/styles/resource-management.scss'
const props = defineProps<{
	modelValue: boolean
	type: 'agents' | 'knowledge'
	resourceId: string
	resourceName?: string
}>()
const emit = defineEmits(['update:modelValue', 'changed'])
const visible = computed({
	get: () => props.modelValue,
	set: (v) => emit('update:modelValue', v)
})
const root = computed(
	() =>
		`/v1${globalUrlPrefix}rest/${programTag}/${
			props.type === 'agents' ? 'agents' : 'knowledge/repositories'
		}/${encodeURIComponent(props.resourceId)}`
)
interface Grant {
	username: string
	permissionLevel: number
	expiresAt: number | null
	expired: boolean
}
const grants = ref<Grant[]>([]),
	username = ref(''),
	level = ref(2),
	expiresAt = ref<string | null>(null),
	isPublic = ref(false),
	busy = ref(false)
const editing = ref(false),
	loadError = ref(false),
	visibilitySaving = ref(false)
const grantFormSection = ref<HTMLElement | null>(null)
const savedPublic = ref(false)
const visibilityDirty = computed(() => isPublic.value !== savedPublic.value)
/** 授权等级展示文案 */
const grantLevelLabel = (level: number) =>
	level === 1
		? t('resource.permission.level.manage')
		: props.type === 'agents'
			? t('resource.permission.level.use')
			: t('resource.permission.level.read')
function resetForm() {
	username.value = ''
	level.value = 2
	expiresAt.value = null
	editing.value = false
}
function open() {
	resetForm()
	grants.value = []
	isPublic.value = false
	savedPublic.value = false
	void load()
}
async function load() {
	if (visibilitySaving.value) return
	const keepVisibilityDraft = visibilityDirty.value
	busy.value = true
	loadError.value = false
	try {
		const [a, b] = await Promise.all([
			http.get<Grant[]>(root.value + '/permissions'),
			http.get<{ isPublic: boolean }>(root.value + '/visibility')
		])
		grants.value = a.data
		savedPublic.value = b.data.isPublic
		if (!keepVisibilityDraft) isPublic.value = b.data.isPublic
	} catch {
		loadError.value = true
	} finally {
		busy.value = false
	}
}
async function save() {
	if (
		busy.value ||
		visibilitySaving.value ||
		loadError.value ||
		!username.value.trim()
	)
		return
	if (expiresAt.value && Number(expiresAt.value) <= Date.now()) {
		ElMessage.warning(t('resource.permission.expires.future'))
		return
	}
	busy.value = true
	try {
		await http.put(
			root.value + '/permissions/' + encodeURIComponent(username.value.trim()),
			{
				permissionLevel: level.value,
				expiresAt: expiresAt.value ? Number(expiresAt.value) : null
			}
		)
		resetForm()
		await load()
		emit('changed')
		ElMessage.success(t('resource.permission.grant.saved'))
	} catch {
		ElMessage.error(t('resource.permission.grant.save.failed'))
	} finally {
		busy.value = false
	}
}
async function saveVisibility() {
	if (
		busy.value ||
		loadError.value ||
		visibilitySaving.value ||
		!visibilityDirty.value
	)
		return
	const value = isPublic.value
	visibilitySaving.value = true
	try {
		await http.put(root.value + '/visibility', { isPublic: value })
		savedPublic.value = value
		emit('changed')
		ElMessage.success(t('resource.permission.public.saved'))
	} catch {
		ElMessage.error(t('resource.permission.public.save.failed'))
	} finally {
		visibilitySaving.value = false
	}
}
function editGrant(row: Grant) {
	username.value = row.username
	level.value = row.permissionLevel
	expiresAt.value = row.expiresAt ? String(row.expiresAt) : null
	editing.value = true
	void nextTick(
		() => grantFormSection.value?.scrollIntoView({ block: 'nearest' })
	)
}
async function revoke(username: string) {
	try {
		await ElMessageBox.confirm(
			t('resource.permission.revoke.confirm'),
			t('resource.permission.revoke.title')
		)
		await http.delete(root.value + '/permissions/' + encodeURIComponent(username))
		await load()
		emit('changed')
	} catch (e) {
		if (e !== 'cancel' && e !== 'close')
			ElMessage.error(t('resource.permission.revoke.failed'))
	}
}
</script>
<style scoped lang="scss">
.visibility-section {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
}
.visibility-section .el-switch {
	flex-shrink: 0;
}
.visibility-controls {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 10px;
	flex-shrink: 0;
}
.permission-form {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(100px, 0.65fr) minmax(0, 1.2fr);
	gap: 0 16px;
	margin-top: 20px;
}
.permission-form :deep(.el-select),
.permission-form :deep(.el-date-editor.el-input) {
	width: 100%;
}
.permission-form-footer {
	grid-column: 1 / -1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
}
.permission-form-footer span {
	font-size: 12px;
	line-height: 1.6;
	color: var(--n-color-text-muted);
}
.grant-mobile-list {
	display: none;
}
.grant-mobile-item {
	padding: 16px 0;
	border-top: 1px solid var(--n-color-border-soft);
}
.grant-mobile-item:first-child {
	margin-top: 12px;
}
.grant-mobile-item:last-child {
	padding-bottom: 0;
}
.grant-mobile-item code {
	font-size: 13px;
	overflow-wrap: anywhere;
}
.grant-mobile-tags {
	display: flex;
	gap: 6px;
	margin-top: 8px;
}
.grant-mobile-actions {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	margin-top: 12px;
}
@media (max-width: 640px) {
	.resource-table {
		display: none;
	}
	.grant-mobile-list {
		display: block;
	}
	.permission-form {
		grid-template-columns: 1fr;
	}
	.visibility-section {
		gap: 12px;
		align-items: flex-start;
		flex-direction: column;
	}
	.permission-form-footer {
		align-items: stretch;
		flex-direction: column;
	}
}
</style>
