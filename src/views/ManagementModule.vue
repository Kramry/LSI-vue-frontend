<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { apiGet, apiPost, apiRequest, ApiError } from '../services/api'

interface ModuleField {
  name: string
  label: string
  type?: 'text' | 'email' | 'password' | 'textarea' | 'date' | 'time' | 'select' | 'options'
  required?: boolean
  values?: string[]
  choices?: Array<{ id: number | string; label: string }>
}

interface ModulePayload {
  title: string
  section: string
  records: Array<Record<string, string | number | string[] | null>>
  columns: string[]
  primary_key: string
  fields: ModuleField[]
  can_manage: boolean
  can_create: boolean
}

const props = defineProps<{ section: string }>()
const section = computed(() => props.section)
const singularTitle = computed(() => ({
  programs: 'program',
  users: 'user account',
  classes: 'class',
  schedules: 'schedule',
  enrollments: 'enrollment',
  announcements: 'announcement',
  inquiries: 'inquiry'
}[section.value] || 'record'))
const module = ref<ModulePayload | null>(null)
const loading = ref(true)
const saving = ref(false)
const deletingId = ref<number | null>(null)
const error = ref('')
const editingId = ref<number | null>(null)
const formOpen = ref(false)
const search = ref('')
const form = reactive<Record<string, string>>({})
const visibleRecords = computed(() => {
  const records = module.value?.records || []
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return records
  return records.filter((record) => Object.values(record).some((value) =>
    String(value ?? '').toLocaleLowerCase().includes(query)
  ))
})

function blankForm() {
  for (const key of Object.keys(form)) delete form[key]
  for (const field of module.value?.fields || []) form[field.name] = ''
}

function normalizeValue(field: ModuleField, value: string | number | string[] | null | undefined) {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  return field.type === 'time' ? stringValue.slice(0, 5) : stringValue
}

function startCreate() {
  editingId.value = null
  formOpen.value = true
  blankForm()
}

function startEdit(record: Record<string, string | number | string[] | null>) {
  if (!module.value) return
  const id = Number(record[module.value.primary_key])
  if (!Number.isInteger(id) || id < 1) return

  editingId.value = id
  formOpen.value = true
  blankForm()
  for (const field of module.value.fields) {
    form[field.name] = normalizeValue(field, record[field.name])
  }
}

async function loadModule() {
  loading.value = true
  error.value = ''
  module.value = null
  editingId.value = null
  formOpen.value = section.value === 'users'
  try {
    const response = await apiGet<ModulePayload>(`/modules/${encodeURIComponent(section.value)}`)
    module.value = response.data
    formOpen.value = section.value === 'users' && response.data.can_manage
    blankForm()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load this section.'
  } finally {
    loading.value = false
  }
}

async function saveRecord() {
  if (!module.value) return
  saving.value = true
  error.value = ''
  try {
    const body: Record<string, string | number> = { ...form }
    if (editingId.value) body[module.value.primary_key] = editingId.value
    await apiPost(`/modules/${encodeURIComponent(section.value)}/save`, body)
    await loadModule()
  } catch (reason) {
    error.value = reason instanceof ApiError
      ? reason.message
      : reason instanceof Error ? reason.message : 'Unable to save this record.'
  } finally {
    saving.value = false
  }
}

async function deleteRecord(record: Record<string, string | number | string[] | null>) {
  if (!module.value) return
  const id = Number(record[module.value.primary_key])
  if (!Number.isInteger(id) || id < 1) return
  const actionLabel = section.value === 'programs' ? 'Archive' : 'Delete'
  const confirmation = section.value === 'programs'
    ? 'Archive this program? Its classes and history will be retained.'
    : `Delete this ${module.value.title.toLowerCase()} record?`
  if (!window.confirm(confirmation)) return

  deletingId.value = id
  error.value = ''
  try {
    await apiRequest(`/modules/${encodeURIComponent(section.value)}/${id}`, { method: 'DELETE' })
    if (editingId.value === id) startCreate()
    await loadModule()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to delete this record.'
  } finally {
    deletingId.value = null
  }
}

function columnLabel(column: string) {
  return column.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getRecordKeyValue(record: Record<string, string | number | string[] | null>, key?: string) {
  if (!key) return ''
  return String(record[key] ?? '')
}

function getRecordId(record: Record<string, string | number | string[] | null>) {
  const key = module.value?.primary_key
  if (!key) return NaN
  return Number(record[key])
}

watch(section, () => {
  void loadModule()
})

onMounted(() => {
  void loadModule()
})
</script>

<template>
  <main class="module-page" :data-section="section">
    <header class="page-header">
      <div class="heading-main">
        <span class="section-icon" aria-hidden="true"></span>
        <div class="heading-text">
          <p class="eyebrow">SMARTTRACK / {{ columnLabel(section).toUpperCase() }}</p>
          <h1>{{ module?.title || columnLabel(section) }}</h1>
          <p class="lead">Records and actions are provided by the SmartTrack backend.</p>
        </div>
      </div>
      <div class="heading-actions">
        <button
          v-if="module?.can_create && !editingId && section !== 'users'"
          class="add-button"
          @click="startCreate"
        >
          Add record
        </button>
        <button class="secondary-button" :disabled="loading" @click="loadModule">Refresh</button>
      </div>
    </header>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>

    <div v-if="loading" class="panel loading-panel" role="status" aria-live="polite">
      <p class="loading-text">
        <span class="spinner" aria-hidden="true"></span>
        Loading {{ columnLabel(section).toLowerCase() }}...
      </p>
      <div class="skeleton-list" aria-hidden="true">
        <span class="skeleton"></span>
        <span class="skeleton"></span>
        <span class="skeleton"></span>
        <span class="skeleton"></span>
      </div>
    </div>

    <template v-else-if="module">
      <div class="module-workspace" :class="{ 'users-workspace': section === 'users' }">
        <!-- ============ Add / edit form ============ -->
        <section
          v-if="module.can_manage && formOpen && (module.can_create || editingId)"
          class="panel form-panel"
          :class="{ editing: !!editingId }"
          aria-labelledby="record-form-title"
        >
          <div class="form-head">
            <span class="form-badge" :class="editingId ? 'is-edit' : 'is-new'" aria-hidden="true"></span>
            <div class="form-titles">
              <p class="form-mode">{{ editingId ? 'Editing' : 'New entry' }}</p>
              <h2 id="record-form-title">{{ editingId ? (section === 'users' ? 'Edit user account' : 'Edit record') : `Add ${singularTitle}` }}</h2>
              <p v-if="section === 'inquiries' && editingId" class="hint">Reply to the trainee and update the inquiry status.</p>
              <p v-else class="hint">Fields marked required must be filled in before saving.</p>
            </div>
            <button v-if="editingId && module.can_create" class="secondary-button cancel-button" @click="startCreate">
              Cancel edit
            </button>
          </div>

          <form class="record-form" @submit.prevent="saveRecord">
            <label
              v-for="field in module.fields"
              :key="field.name"
              :class="{ wide: field.type === 'textarea' }"
            >
              <span class="label-text">
                {{ field.label }}<em v-if="field.required" class="req" aria-hidden="true"> *</em>
              </span>
              <textarea
                v-if="field.type === 'textarea'"
                v-model="form[field.name]"
                :required="field.required"
                rows="3"
              />
              <select
                v-else-if="field.type === 'select' || field.type === 'options'"
                v-model="form[field.name]"
                :required="field.required"
              >
                <option value="">{{ field.required ? 'Choose an option' : 'None' }}</option>
                <option
                  v-for="choice in (field.type === 'select'
                    ? (field.values || []).map((value) => ({ id: value, label: value }))
                    : field.choices || [])"
                  :key="choice.id"
                  :value="String(choice.id)"
                >
                  {{ choice.label }}
                </option>
              </select>
              <input
                v-else
                v-model="form[field.name]"
                :type="field.type || 'text'"
                :required="field.required"
              >
            </label>

            <div class="form-actions">
              <p class="legend"><em class="req" aria-hidden="true">*</em> Required</p>
              <div class="form-buttons">
                <span v-if="saving" class="muted saving-note">Saving changes...</span>
                <button class="primary-button" type="submit" :disabled="saving">
                  {{ saving ? 'Saving...' : editingId ? 'Save changes' : section === 'users' ? 'Create record' : 'Create' }}
                </button>
              </div>
            </div>
          </form>
        </section>

        <!-- ============ Records list ============ -->
        <section class="panel list-panel">
          <div class="section-heading">
            <div class="list-title">
              <h2>{{ module.title }}</h2>
              <p>{{ section === 'users' ? 'Create and manage staff and trainee sign-in accounts.' : 'All records you are allowed to see.' }}</p>
            </div>
            <span class="count-badge">
              {{ visibleRecords.length }} record{{ visibleRecords.length === 1 ? '' : 's' }}
            </span>
          </div>

          <label v-if="section === 'users'" class="record-search">
            <span class="label-text">Search records</span>
            <span class="search-box">
              <input v-model="search" type="search" placeholder="Search name, username, role, or status">
            </span>
          </label>

          <div v-if="!visibleRecords.length" class="empty-state">
            <span class="empty-icon" aria-hidden="true"></span>
            <p>{{ search ? 'No matching user accounts found.' : `No ${module.title.toLowerCase()} found.` }}</p>
            <button v-if="module.can_create && !editingId" class="primary-button" @click="startCreate">
              Add the first record
            </button>
          </div>

          <div v-else class="table-wrap" tabindex="0">
            <table>
              <caption class="sr-only">{{ module.title }}</caption>
              <thead>
                <tr>
                  <th v-for="column in module.columns" :key="column" scope="col">{{ columnLabel(column) }}</th>
                  <th v-if="section === 'classes'" scope="col">Trainee requirements</th>
                  <th v-if="module.can_manage" scope="col" class="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in visibleRecords" :key="String(getRecordId(record) || getRecordKeyValue(record, module?.primary_key))">
                  <td
                    v-for="(column, index) in module.columns"
                    :key="column"
                    :class="{ 'name-cell': index === 0 }"
                  >
                    <span v-if="index === 0" class="cell-person">
                      <span class="avatar" aria-hidden="true">
                        <span class="initial">{{ String(record[column] ?? '?').trim().charAt(0).toUpperCase() }}</span>
                      </span>
                      <span class="cell-text">{{ record[column] ?? '—' }}</span>
                    </span>
                    <span
                      v-else-if="['status', 'role', 'outcome', 'review_status', 'approval_status', 'teaching_status'].includes(column) && record[column]"
                      class="pill"
                      :class="String(record[column]).toLowerCase().replace(/\s+/g, '-')"
                    >{{ record[column] }}</span>
                    <template v-else>{{ record[column] ?? '—' }}</template>
                  </td>
                  <td v-if="section === 'classes'">
                    <ul v-if="Array.isArray(record.requirements) && record.requirements.length" class="requirements-list">
                      <li v-for="requirement in record.requirements" :key="requirement">{{ requirement }}</li>
                    </ul>
                    <span v-else class="muted">None listed</span>
                  </td>
                  <td v-if="module.can_manage" class="row-actions">
                    <button
                      class="text-button edit"
                      :aria-label="`Edit ${getRecordKeyValue(record, module?.columns[0]) || 'record'}`"
                      @click="startEdit(record)"
                    >Edit</button>
                    <button
                      v-if="section !== 'programs' || record.status !== 'inactive'"
                      class="text-button danger"
                      :class="{ archive: section === 'programs' }"
                      :aria-label="`${section === 'programs' ? 'Archive' : 'Delete'} ${getRecordKeyValue(record, module?.columns[0]) || 'record'}`"
                      :disabled="deletingId === getRecordId(record)"
                      @click="deleteRecord(record)"
                    >
                      {{ deletingId === getRecordId(record)
                        ? (section === 'programs' ? 'Archiving...' : 'Deleting...')
                        : (section === 'programs' ? 'Archive' : 'Delete') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.module-page {
  --navy: #173a60;
  --navy-deep: #0d2239;
  --ink: #081727;
  --blue: #2a6aa8;
  --sky: #8fc4f5;
  --ice: #e6f3ff;
  --gold: #e8c98a;
  --ok: #2d8a57;
  --warn: #c98a00;
  --danger: #b4281f;
  --muted: #5d6f82;
  --line: #e1e8f1;
  --field: #f1f5fb;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  --chev: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d6f82' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  color: #16263a;
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;

  /* section accent (overridden per section below) */
  --accent: #265f94;
  --accent-soft: #e0eefc;

  /* ---------- Icon set (line icons drawn as masks, so they take currentColor) ---------- */
  --i-plus: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 5v14M5 12h14'/%3E%3C/svg%3E");
  --i-refresh: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5'/%3E%3C/svg%3E");
  --i-pencil: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 20h4L19 9l-4-4L4 16z'/%3E%3Cpath d='M13.5 6.5l4 4'/%3E%3C/svg%3E");
  --i-trash: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'/%3E%3C/svg%3E");
  --i-archive: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='4' rx='1'/%3E%3Cpath d='M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4'/%3E%3C/svg%3E");
  --i-check: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7'/%3E%3C/svg%3E");
  --i-check-circle: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M8 12.5l3 3 5-6'/%3E%3C/svg%3E");
  --i-x: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 6l12 12M18 6L6 18'/%3E%3C/svg%3E");
  --i-alert: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 4l9 16H3z'/%3E%3Cpath d='M12 10v4M12 17.5v.5'/%3E%3C/svg%3E");
  --i-search: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M21 21l-4.3-4.3'/%3E%3C/svg%3E");
  --i-inbox: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 13l3-8h12l3 8v6H3z'/%3E%3Cpath d='M3 13h5l1 3h6l1-3h5'/%3E%3C/svg%3E");

  /* management sections */
  --i-users: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='8' r='3.5'/%3E%3Cpath d='M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6'/%3E%3Ccircle cx='17.5' cy='9' r='2.5'/%3E%3Cpath d='M17 14c2.6 0 4.5 1.8 4.5 4.5'/%3E%3C/svg%3E");
  --i-cap: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 9l10-5 10 5-10 5z'/%3E%3Cpath d='M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5'/%3E%3C/svg%3E");
  --i-book: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z'/%3E%3Cpath d='M4 17a3 3 0 0 1 3-3h11M8 8h6'/%3E%3C/svg%3E");
  --i-layers: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l9 5-9 5-9-5z'/%3E%3Cpath d='M3 13l9 5 9-5'/%3E%3C/svg%3E");
  --i-calendar: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M3 10h18M8 3v4M16 3v4'/%3E%3C/svg%3E");
  --i-userplus: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='8' r='3.5'/%3E%3Cpath d='M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 8v6M16 11h6'/%3E%3C/svg%3E");
  --i-megaphone: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 10v4h3l7 4V6L6 10z'/%3E%3Cpath d='M16.5 8.5a5 5 0 0 1 0 7'/%3E%3C/svg%3E");
  --i-message: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4z'/%3E%3Cpath d='M8 9h8M8 12h5'/%3E%3C/svg%3E");
  --i-award: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='9' r='5'/%3E%3Cpath d='M9 13.5L8 21l4-2 4 2-1-7.5'/%3E%3C/svg%3E");
  --i-file: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 3h7l5 5v13H7z'/%3E%3Cpath d='M14 3v5h5M10 13h6M10 17h6'/%3E%3C/svg%3E");
  --i-table: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='16' rx='2'/%3E%3Cpath d='M3 10h18M3 15h18M9 4v16'/%3E%3C/svg%3E");

  --section-icon: var(--i-table);

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

/* ---------- Per-section icon and accent color ---------- */
.module-page[data-section='users']         { --section-icon: var(--i-users);     --accent: #265f94; --accent-soft: #e0eefc; }
.module-page[data-section='trainees']      { --section-icon: var(--i-cap);       --accent: #2f78b6; --accent-soft: #e3effa; }
.module-page[data-section='programs']      { --section-icon: var(--i-book);      --accent: #1f8a8a; --accent-soft: #dcf2f2; }
.module-page[data-section='classes']       { --section-icon: var(--i-layers);    --accent: #3a63c4; --accent-soft: #e4ebfa; }
.module-page[data-section='schedules']     { --section-icon: var(--i-calendar);  --accent: #b87400; --accent-soft: #fbf0d3; }
.module-page[data-section='enrollments']   { --section-icon: var(--i-userplus);  --accent: #2d8a57; --accent-soft: #e3f4ea; }
.module-page[data-section='announcements'] { --section-icon: var(--i-megaphone); --accent: #c2570f; --accent-soft: #fde9dc; }
.module-page[data-section='inquiries']     { --section-icon: var(--i-message);   --accent: #6b5bd2; --accent-soft: #ebe8fb; }
.module-page[data-section='assessments']   { --section-icon: var(--i-award);     --accent: #8a4fb8; --accent-soft: #f1e8f9; }
.module-page[data-section='documents']     { --section-icon: var(--i-file);      --accent: #3d7c9a; --accent-soft: #e2f0f6; }
.module-page[data-section='attendance']    { --section-icon: var(--i-check-circle); --accent: #2d8a57; --accent-soft: #e3f4ea; }

.module-workspace { display: contents; }

.users-workspace {
  display: grid;
  grid-template-columns: minmax(300px, 0.8fr) minmax(0, 2fr);
  align-items: start;
  gap: 18px;
}

.users-workspace .form-panel,
.users-workspace .list-panel { min-width: 0; }

.users-workspace .form-panel {
  position: sticky;
  top: 16px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ================= Icon base: every icon below shares these rules ================= */
.section-icon::before,
.form-badge::before,
.empty-icon::before,
.add-button::before,
.page-header .secondary-button::before,
.cancel-button::before,
.primary-button::before,
.text-button::before,
.search-box::before,
.list-title h2::before,
.inline-error::before,
.requirements-list li::before,
.avatar::before {
  content: '';
  flex: none;
  display: inline-block;
  width: 17px;
  height: 17px;
  background-color: currentColor;
  -webkit-mask-image: var(--icon);
  mask-image: var(--icon);
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  transition: transform 0.3s var(--spring), color 0.25s ease, background-color 0.25s ease;
}

/* ================= Banner ================= */
.page-header,
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.page-header {
  position: relative;
  align-items: center;
  padding: 26px 28px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(120deg, var(--navy) 0%, #1b4470 60%, var(--navy) 100%);
  overflow: hidden;
  animation: drop-in 0.6s var(--ease) both;
}

.page-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, transparent 0 120px, rgb(255 255 255 / 4%) 120px 121px);
  pointer-events: none;
}

/* faint table-grid lines drift behind the heading */
.page-header::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 38%;
  background:
    repeating-linear-gradient(0deg, rgb(143 196 245 / 12%) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(90deg, rgb(143 196 245 / 12%) 0 1px, transparent 1px 64px);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 70%);
  mask-image: linear-gradient(90deg, transparent, #000 70%);
  animation: grid-drift 14s linear infinite;
  pointer-events: none;
}

.page-header > * {
  position: relative;
  z-index: 1;
}

.heading-main {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

/* glass tile holding the section icon: floats gently, with a ring that ripples out */
.section-icon {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 1px solid rgb(255 255 255 / 26%);
  border-radius: 16px;
  background: rgb(255 255 255 / 12%);
  color: #fff;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 25%), 0 14px 24px -14px rgb(0 0 0 / 55%);
  animation: tile-in 0.7s var(--spring) 0.1s both, float 5s ease-in-out 1s infinite;
}

.section-icon::before {
  --icon: var(--section-icon);
  width: 28px;
  height: 28px;
}

.section-icon::after {
  content: '';
  position: absolute;
  inset: -1px;
  border: 2px solid rgb(143 196 245 / 60%);
  border-radius: inherit;
  animation: ring-out 2.8s ease-out 1.2s infinite;
}

.page-header h1 {
  margin: 0;
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.01em;
  animation: rise 0.7s var(--ease) 0.15s both;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--sky);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.lead {
  margin: 6px 0 0;
  color: rgb(255 255 255 / 80%);
  font-size: 14px;
  animation: rise 0.7s var(--ease) 0.25s both;
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ================= Panels ================= */
.panel {
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
  transition: box-shadow 0.3s ease;
}

.panel:hover {
  box-shadow: 0 16px 34px -20px rgb(17 44 73 / 50%);
}

.list-panel {
  animation: rise 0.65s var(--ease) 0.15s both;
}

.muted {
  color: var(--muted);
  font-size: 14px;
}

.section-heading h2,
.form-titles h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
}

.section-heading p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
}

/* list title with the section icon in its accent color */
.list-title h2 {
  display: flex;
  align-items: center;
  gap: 10px;
}

.list-title h2::before {
  --icon: var(--section-icon);
  width: 22px;
  height: 22px;
  color: var(--accent);
}

.list-panel:hover .list-title h2::before {
  transform: translateY(-2px) rotate(-8deg);
}

/* ================= Loading: spinner and shimmering skeleton rows ================= */
.loading-panel {
  display: grid;
  gap: 18px;
}

.loading-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  animation: breathe 1.4s ease-in-out infinite;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.skeleton-list {
  display: grid;
  gap: 12px;
}

.skeleton {
  display: block;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(90deg, #eef3fa 25%, #f8fbff 45%, #eef3fa 65%) 0 0 / 220% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton:nth-child(2) { animation-delay: 0.12s; width: 94%; }
.skeleton:nth-child(3) { animation-delay: 0.24s; width: 88%; }
.skeleton:nth-child(4) { animation-delay: 0.36s; width: 76%; }

/* ================= Form: opens like a drawer ================= */
.form-panel {
  position: relative;
  border-top: 3px solid transparent;
  transform-origin: top center;
  animation: drawer-open 0.55s var(--ease) both;
}

.form-panel::before {
  content: '';
  position: absolute;
  top: -3px;
  left: 0;
  height: 3px;
  border-radius: 12px 12px 0 0;
  background: linear-gradient(90deg, var(--accent), var(--sky));
  animation: edge-draw 0.8s var(--ease) 0.1s both;
}

.form-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 14px;
}

.form-badge {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 13px;
  background: var(--accent-soft);
  color: var(--accent);
  animation: pop-in 0.6s var(--spring) 0.15s both;
}

.form-badge::before {
  width: 22px;
  height: 22px;
}

.form-badge.is-new::before { --icon: var(--i-plus); }
.form-badge.is-edit::before {
  --icon: var(--i-pencil);
  animation: wiggle 2.8s ease-in-out 0.8s infinite;
}

.form-mode {
  display: inline-block;
  margin: 0 0 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.form-panel.editing .form-mode {
  background: #fbf0d3;
  color: #8a5d00;
}

.hint {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13.5px;
}

.record-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 22px;
}

/* fields appear one after another */
.record-form > * {
  animation: rise 0.5s var(--ease) both;
}

.record-form > :nth-child(1) { animation-delay: 0.15s; }
.record-form > :nth-child(2) { animation-delay: 0.2s; }
.record-form > :nth-child(3) { animation-delay: 0.25s; }
.record-form > :nth-child(4) { animation-delay: 0.3s; }
.record-form > :nth-child(5) { animation-delay: 0.35s; }
.record-form > :nth-child(6) { animation-delay: 0.4s; }
.record-form > :nth-child(7) { animation-delay: 0.45s; }
.record-form > :nth-child(8) { animation-delay: 0.5s; }
.record-form > :nth-child(n + 9) { animation-delay: 0.55s; }

.record-form label {
  display: grid;
  gap: 7px;
  align-content: start;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.record-form label:has(input:focus, select:focus, textarea:focus) {
  color: var(--accent);
}

.record-form .wide {
  grid-column: 1 / -1;
}

/* the required star pulses gently */
.req {
  display: inline-block;
  color: var(--danger);
  font-style: normal;
  animation: star-pulse 2.4s ease-in-out infinite;
}

.record-form input,
.record-form select,
.record-form textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
}

.record-form textarea {
  min-height: 96px;
  resize: vertical;
}

.record-form input:hover,
.record-form select:hover,
.record-form textarea:hover {
  border-color: #b6c8de;
}

.record-form input:focus,
.record-form select:focus,
.record-form textarea:focus {
  outline: none;
  border-color: var(--accent);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 14%), 0 10px 20px -14px rgb(38 95 148 / 55%);
  transform: translateY(-1px);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}

.legend {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
}

.form-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.saving-note {
  animation: breathe 1.2s ease-in-out infinite;
}

/* ================= Buttons ================= */
.primary-button,
.secondary-button,
.add-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 9px 18px;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s var(--spring), box-shadow 0.25s ease;
}

.primary-button {
  background: linear-gradient(135deg, #2c6ba5 0%, var(--blue) 60%, #1f4f7d 100%);
  color: #fff;
  box-shadow: 0 12px 22px -14px rgb(38 95 148 / 85%);
}

/* light sweep on hover (icon uses ::before, sweep uses ::after) */
.primary-button::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -60%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 28%), transparent);
  transform: skewX(-20deg);
  transition: left 0.7s var(--ease);
  pointer-events: none;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 18px 26px -14px rgb(38 95 148 / 90%);
}

.primary-button:hover:not(:disabled)::after {
  left: 130%;
}

/* saving: the sweep becomes a progress stripe along the bottom edge */
.primary-button:disabled::after {
  top: auto;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--sky), transparent);
  background-size: 50% 100%;
  background-repeat: no-repeat;
  transform: none;
  transition: none;
  animation: load 1.1s ease-in-out infinite;
}

.form-buttons .primary-button::before { --icon: var(--i-check); }
.empty-state .primary-button::before { --icon: var(--i-plus); }

.primary-button:hover:not(:disabled)::before {
  transform: scale(1.2) rotate(-6deg);
}

.secondary-button {
  background: #e3ebf6;
  color: var(--navy-deep);
}

.secondary-button:hover:not(:disabled) {
  background: #d3e0f0;
  transform: translateY(-1px);
}

.page-header .secondary-button {
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
  animation: pop-in 0.55s var(--spring) 0.3s both;
}

.page-header .secondary-button::before { --icon: var(--i-refresh); }
.cancel-button::before { --icon: var(--i-x); width: 15px; height: 15px; }

.page-header .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
  transform: translateY(-2px);
}

/* refresh turns on hover and spins while loading */
.page-header .secondary-button:hover:not(:disabled)::before {
  transform: rotate(180deg);
}

.page-header .secondary-button:disabled::before {
  animation: spin 0.8s linear infinite;
}

/* "Add record": the plus turns a quarter on hover */
.add-button {
  background: #fff;
  color: var(--navy-deep);
  animation: pop-in 0.6s var(--spring) 0.25s both;
}

.add-button::before {
  --icon: var(--i-plus);
  width: 16px;
  height: 16px;
  color: var(--blue);
}

.add-button:hover {
  background: #e3effb;
  transform: translateY(-2px);
  box-shadow: 0 14px 24px -14px rgb(0 0 0 / 55%);
}

.add-button:hover::before {
  transform: rotate(90deg) scale(1.15);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled),
.add-button:active {
  transform: scale(0.97);
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
.add-button:focus-visible,
.text-button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

button:disabled {
  cursor: wait;
  opacity: 0.7;
}

/* ================= Messages ================= */
.inline-error {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-left: 3px solid var(--danger);
  border-radius: 6px;
  background: #fdeceb;
  color: var(--danger);
  font-size: 13px;
  animation: shake 0.45s ease both;
}

.inline-error::before {
  --icon: var(--i-alert);
}

/* ================= Search ================= */
.record-search {
  display: grid;
  gap: 7px;
  max-width: 340px;
  margin: 14px 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  transition: max-width 0.4s var(--ease), color 0.2s ease;
}

.record-search:focus-within {
  max-width: 460px;
  color: var(--accent);
}

.search-box {
  position: relative;
  display: block;
}

.search-box::before {
  --icon: var(--i-search);
  position: absolute;
  top: 50%;
  left: 13px;
  z-index: 1;
  width: 17px;
  height: 17px;
  margin-top: -8.5px;
  color: var(--muted);
  pointer-events: none;
}

.record-search:focus-within .search-box::before {
  color: var(--accent);
  transform: scale(1.18) rotate(-10deg);
}

.record-search input {
  width: 100%;
  min-height: 42px;
  padding: 9px 12px 9px 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease;
}

.record-search input:focus {
  outline: none;
  border-color: var(--accent);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 14%);
}

/* ================= Empty state ================= */
.empty-state {
  display: grid;
  gap: 14px;
  justify-items: center;
  margin-top: 16px;
  padding: 40px 8px;
  border: 1px dashed #b6c8de;
  border-radius: 10px;
  background:
    radial-gradient(rgb(17 44 73 / 6%) 1px, transparent 1px) 0 0 / 16px 16px,
    #f9fbfe;
  color: var(--muted);
  text-align: center;
  animation: rise 0.6s var(--ease) 0.3s both;
}

.empty-state p {
  margin: 0;
}

.empty-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  animation: bob 3s ease-in-out infinite;
}

.empty-icon::before {
  --icon: var(--section-icon);
  width: 28px;
  height: 28px;
}

.empty-icon::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
  border-radius: 50%;
  opacity: 0;
  animation: ring-out 2.8s ease-out 0.6s infinite;
}

/* ================= Table: rows cascade like ledger entries ================= */
.count-badge {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  animation: pop-in 0.5s var(--spring) 0.4s both;
}

.table-wrap {
  overflow: auto;
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.table-wrap:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 14px;
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}

th {
  background: var(--field);
  color: var(--navy);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

tbody tr {
  animation: ledger-in 0.5s var(--ease) both;
  transition: background 0.2s ease, box-shadow 0.25s ease;
}

tbody tr:nth-child(1) { animation-delay: 0.3s; }
tbody tr:nth-child(2) { animation-delay: 0.36s; }
tbody tr:nth-child(3) { animation-delay: 0.42s; }
tbody tr:nth-child(4) { animation-delay: 0.48s; }
tbody tr:nth-child(5) { animation-delay: 0.54s; }
tbody tr:nth-child(6) { animation-delay: 0.6s; }
tbody tr:nth-child(7) { animation-delay: 0.66s; }
tbody tr:nth-child(8) { animation-delay: 0.72s; }
tbody tr:nth-child(n + 9) { animation-delay: 0.78s; }

tbody tr:last-child td {
  border-bottom: 0;
}

/* hovered record: an accent edge appears */
tbody tr:hover {
  background: #f6f9fd;
  box-shadow: inset 3px 0 0 var(--accent);
}

/* first column: avatar and name */
.name-cell {
  color: var(--navy-deep);
  font-weight: 600;
}

.cell-person {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.cell-text {
  transition: color 0.2s ease, transform 0.25s var(--ease);
}

tbody tr:hover .cell-text {
  color: var(--accent);
  transform: translateX(3px);
}

.avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
  font-weight: 800;
  transition: transform 0.35s var(--spring), background 0.25s ease, color 0.25s ease;
}

/* people sections show the initial; other sections show the section icon */
.avatar::before {
  --icon: var(--section-icon);
  width: 17px;
  height: 17px;
}

.avatar .initial {
  display: none;
}

.module-page[data-section='users'] .avatar .initial,
.module-page[data-section='trainees'] .avatar .initial {
  display: inline;
}

.module-page[data-section='users'] .avatar::before,
.module-page[data-section='trainees'] .avatar::before {
  display: none;
}

tbody tr:hover .avatar {
  background: var(--accent);
  color: #fff;
  transform: scale(1.12) rotate(-6deg);
}

/* initials get a few friendly tones so a long list is easy to scan */
.module-page[data-section='users'] tbody tr:nth-child(4n + 2) .avatar,
.module-page[data-section='trainees'] tbody tr:nth-child(4n + 2) .avatar { background: #e3f4ea; color: #1f6b41; }
.module-page[data-section='users'] tbody tr:nth-child(4n + 3) .avatar,
.module-page[data-section='trainees'] tbody tr:nth-child(4n + 3) .avatar { background: #fbf0d3; color: #8a5d00; }
.module-page[data-section='users'] tbody tr:nth-child(4n) .avatar,
.module-page[data-section='trainees'] tbody tr:nth-child(4n) .avatar { background: #ebe8fb; color: #5846b8; }

.module-page[data-section='users'] tbody tr:hover .avatar,
.module-page[data-section='trainees'] tbody tr:hover .avatar {
  background: var(--accent);
  color: #fff;
}

/* ================= Status pills ================= */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px 4px 10px;
  border-radius: 999px;
  background: #e0eefc;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
  white-space: nowrap;
  animation: pop-in 0.45s var(--spring) both;
}

.pill::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

/* green: good or live */
.pill.active,
.pill.approved,
.pill.present,
.pill.pass,
.pill.paid,
.pill.published,
.pill.resolved,
.pill.verified,
.pill.administrator,
.pill.issued {
  background: #e3f4ea;
  color: #1f6b41;
}

.pill.active::before,
.pill.ongoing::before {
  animation: ping-green 2.4s ease-out 1s infinite;
}

/* amber: waiting */
.pill.pending,
.pill.late,
.pill.upcoming,
.pill.draft,
.pill.open,
.pill.staff {
  background: #fbf0d3;
  color: #8a5d00;
}

.pill.pending::before,
.pill.upcoming::before {
  animation: ping-amber 2.6s ease-out 1s infinite;
}

/* red: problem */
.pill.rejected,
.pill.absent,
.pill.fail,
.pill.revoked {
  background: #fdeceb;
  color: var(--danger);
}

/* grey: finished or off */
.pill.inactive,
.pill.completed,
.pill.closed,
.pill.archived {
  background: #e8edf4;
  color: #4b5d73;
}

/* ================= Trainee requirements list ================= */
.requirements-list {
  min-width: 190px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--text);
}

.requirements-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  animation: rise 0.45s var(--ease) both;
}

.requirements-list li:nth-child(1) { animation-delay: 0.4s; }
.requirements-list li:nth-child(2) { animation-delay: 0.47s; }
.requirements-list li:nth-child(3) { animation-delay: 0.54s; }
.requirements-list li:nth-child(n + 4) { animation-delay: 0.6s; }

.requirements-list li + li {
  margin-top: 5px;
}

.requirements-list li::before {
  --icon: var(--i-check-circle);
  width: 15px;
  height: 15px;
  color: var(--ok);
}

tbody tr:hover .requirements-list li::before {
  transform: scale(1.2);
}

/* ================= Row actions ================= */
.actions-col {
  text-align: right;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  white-space: nowrap;
}

/* row actions stay quiet until the row is hovered or focused */
.row-actions .text-button {
  opacity: 0.55;
}

tbody tr:hover .row-actions .text-button,
tbody tr:focus-within .row-actions .text-button {
  opacity: 1;
}

.text-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--blue);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease, transform 0.2s var(--spring);
}

.text-button::before {
  width: 15px;
  height: 15px;
}

.text-button.edit::before { --icon: var(--i-pencil); }
.text-button.danger::before { --icon: var(--i-trash); }
.text-button.danger.archive::before { --icon: var(--i-archive); }

.text-button:hover:not(:disabled) {
  background: var(--field);
  color: var(--navy-deep);
  transform: translateY(-1px);
}

.text-button.edit:hover:not(:disabled)::before {
  transform: rotate(-14deg) scale(1.15);
}

.text-button:active:not(:disabled) {
  transform: scale(0.94);
}

.text-button.danger {
  color: var(--danger);
}

/* delete warns before you click: the button trembles once on hover */
.text-button.danger:hover:not(:disabled) {
  background: #fdeceb;
  color: var(--danger);
  animation: tremble 0.35s ease 1;
}

.text-button.danger:hover:not(:disabled)::before {
  transform: scale(1.15);
}

/* ================= Keyframes ================= */
@keyframes drop-in {
  from {
    opacity: 0;
    transform: translateY(-14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes tile-in {
  0% {
    opacity: 0;
    transform: scale(0.6) rotate(-14deg);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes drawer-open {
  from {
    opacity: 0;
    transform: scaleY(0.88) translateY(-12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes edge-draw {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

@keyframes ledger-in {
  from {
    opacity: 0;
    transform: translateX(-18px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes grid-drift {
  from {
    background-position: 0 0, 0 0;
  }
  to {
    background-position: 0 22px, 64px 0;
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

@keyframes ring-out {
  0% {
    opacity: 0.7;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

@keyframes wiggle {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(2px, 1px) rotate(8deg);
  }
  50% {
    transform: translate(-1px, 2px) rotate(-4deg);
  }
  75% {
    transform: translate(2px, -1px) rotate(6deg);
  }
}

@keyframes star-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(1.3);
  }
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-7px);
  }
}

@keyframes tremble {
  25% {
    transform: translateX(-2px) rotate(-1deg);
  }
  50% {
    transform: translateX(2px) rotate(1deg);
  }
  75% {
    transform: translateX(-1px);
  }
}

@keyframes ping-green {
  0% {
    box-shadow: 0 0 0 0 rgb(45 138 87 / 55%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 7px rgb(45 138 87 / 0%);
  }
}

@keyframes ping-amber {
  0% {
    box-shadow: 0 0 0 0 rgb(201 138 0 / 50%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 7px rgb(201 138 0 / 0%);
  }
}

@keyframes shimmer {
  from {
    background-position: 120% 0;
  }
  to {
    background-position: -120% 0;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes load {
  from {
    background-position: -50% 0;
  }
  to {
    background-position: 150% 0;
  }
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@keyframes shake {
  10%,
  90% {
    transform: translateX(-1px);
  }
  20%,
  80% {
    transform: translateX(2px);
  }
  30%,
  50%,
  70% {
    transform: translateX(-4px);
  }
  40%,
  60% {
    transform: translateX(4px);
  }
}

/* ================= Responsive ================= */
@media (max-width: 1000px) {
  .users-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .users-workspace .form-panel {
    position: relative;
    top: auto;
  }
}

@media (max-width: 650px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px 20px;
  }

  .page-header::after {
    display: none;
  }

  .page-header h1 {
    font-size: 26px;
  }

  .section-icon {
    width: 48px;
    height: 48px;
    border-radius: 13px;
  }

  .heading-actions {
    width: 100%;
    justify-content: space-between;
  }

  .form-head {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .cancel-button {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .record-form {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .form-buttons {
    justify-content: space-between;
  }

  .panel {
    padding: 16px;
  }

  .record-search:focus-within {
    max-width: 340px;
  }

  /* no hover on touch screens, so keep row actions fully visible */
  .row-actions .text-button {
    opacity: 1;
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .module-page,
  .module-page *,
  .module-page *::before,
  .module-page *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>