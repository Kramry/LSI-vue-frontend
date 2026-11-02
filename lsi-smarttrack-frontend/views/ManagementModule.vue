<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { apiGet, apiPost, ApiError } from '../services/api'

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
  records: Array<Record<string, string | number | null>>
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
const form = reactive<Record<string, string>>({})

function blankForm() {
  for (const key of Object.keys(form)) delete form[key]
  for (const field of module.value?.fields || []) form[field.name] = ''
}

function normalizeValue(field: ModuleField, value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  return field.type === 'time' ? stringValue.slice(0, 5) : stringValue
}

function startCreate() {
  editingId.value = null
  formOpen.value = true
  blankForm()
}

function startEdit(record: Record<string, string | number | null>) {
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
  formOpen.value = false
  try {
    const response = await apiGet<ModulePayload>(`/modules/${encodeURIComponent(section.value)}`)
    module.value = response.data
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

async function deleteRecord(record: Record<string, string | number | null>) {
  if (!module.value) return
  const id = Number(record[module.value.primary_key])
  if (!Number.isInteger(id) || id < 1) return
  if (!window.confirm(`Delete this ${module.value.title.toLowerCase()} record?`)) return

  deletingId.value = id
  error.value = ''
  try {
    await apiPost(`/modules/${encodeURIComponent(section.value)}/delete/${id}`, {})
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

watch(section, () => {
  void loadModule()
})

onMounted(() => {
  void loadModule()
})
</script>

<template>
  <main class="module-page">
    <header class="page-header">
      <div class="heading-text">
        <p class="eyebrow">SMARTTRACK / {{ columnLabel(section).toUpperCase() }}</p>
        <h1>{{ module?.title || columnLabel(section) }}</h1>
        <p class="lead">Records and actions are provided by the SmartTrack backend.</p>
      </div>
      <div class="heading-actions">
        <button
          v-if="module?.can_create && !editingId"
          class="add-button"
          @click="startCreate"
        >
          + Add record
        </button>
        <button class="secondary-button" :disabled="loading" @click="loadModule">Refresh</button>
      </div>
    </header>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="panel muted loading">Loading {{ columnLabel(section).toLowerCase() }}...</p>

    <template v-else-if="module">
      <section v-if="module.can_manage && formOpen && (module.can_create || editingId)" class="panel form-panel">
        <div class="section-heading">
          <div>
            <h2>{{ editingId ? 'Edit record' : `Add ${singularTitle}` }}</h2>
            <p v-if="section === 'inquiries' && editingId">Reply to the trainee and update the inquiry status.</p>
            <p v-else class="hint">Fields marked required must be filled in before saving.</p>
          </div>
          <button v-if="editingId && module.can_create" class="secondary-button" @click="startCreate">
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
            <button class="primary-button" type="submit" :disabled="saving">
              {{ saving ? 'Saving...' : editingId ? 'Save changes' : 'Create' }}
            </button>
            <span v-if="saving" class="muted">Saving changes...</span>
          </div>
        </form>
      </section>

      <section class="panel list-panel">
        <div class="section-heading">
          <div>
            <h2>{{ module.title }}</h2>
            <p>All records you are allowed to see.</p>
          </div>
          <span class="count-badge">
            {{ module.records.length }} record{{ module.records.length === 1 ? '' : 's' }}
          </span>
        </div>

        <div v-if="!module.records.length" class="empty-state">
          <p>No {{ module.title.toLowerCase() }} found.</p>
          <button v-if="module.can_create && !editingId" class="primary-button" @click="startCreate">
            Add the first record
          </button>
        </div>

        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th v-for="column in module.columns" :key="column">{{ columnLabel(column) }}</th>
                <th v-if="module.can_manage" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in module.records" :key="String(record[module.primary_key])">
                <td v-for="column in module.columns" :key="column">
                  {{ record[column] ?? '—' }}
                </td>
                <td v-if="module.can_manage" class="row-actions">
                  <button class="text-button" @click="startEdit(record)">Edit</button>
                  <button
                    class="text-button danger"
                    :disabled="deletingId === Number(record[module.primary_key])"
                    @click="deleteRecord(record)"
                  >
                    {{ deletingId === Number(record[module.primary_key]) ? 'Deleting...' : 'Delete' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.module-page {
  --navy: #173a60;
  --navy-deep: #112c49;
  --blue: #265f94;
  --blue-hover: #1f4f7d;
  --sky: #8fc4f5;
  --text: #1b2a3a;
  --muted: #5d6f82;
  --line: #e1e8f1;
  --field: #eaf0fb;
  --danger: #b4281f;

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
}

/* ---------- Banner ---------- */
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
  background: var(--navy);
  overflow: hidden;
}

.page-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, transparent 0 120px, rgb(255 255 255 / 4%) 120px 121px);
  pointer-events: none;
}

.page-header > * {
  position: relative;
}

.page-header h1 {
  margin: 0;
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.01em;
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
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ---------- Panels ---------- */
.panel {
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.form-panel {
  border-top: 3px solid var(--blue);
}

.section-heading h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
}

.section-heading p,
.muted {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.loading {
  text-align: center;
}

/* ---------- Form ---------- */
.record-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 22px;
}

.record-form label {
  display: grid;
  gap: 7px;
  align-content: start;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
}

.record-form .wide {
  grid-column: 1 / -1;
}

.req {
  color: var(--danger);
  font-style: normal;
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
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
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
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 18%);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}

/* ---------- Buttons ---------- */
.primary-button,
.secondary-button,
.add-button {
  min-height: 42px;
  padding: 9px 18px;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.primary-button {
  background: var(--blue);
  color: #fff;
}

.primary-button:hover:not(:disabled) {
  background: var(--blue-hover);
}

.secondary-button {
  background: #e3ebf6;
  color: var(--navy-deep);
}

.secondary-button:hover:not(:disabled) {
  background: #d3e0f0;
}

.page-header .secondary-button {
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
}

.page-header .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
}

.add-button {
  background: #fff;
  color: var(--navy-deep);
}

.add-button:hover {
  background: #e3effb;
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled),
.add-button:active {
  transform: translateY(1px);
}

button:disabled {
  cursor: wait;
  opacity: 0.6;
}

/* ---------- Messages and empty state ---------- */
.inline-error {
  margin: 0;
  padding: 12px 14px;
  border-left: 3px solid var(--danger);
  border-radius: 6px;
  background: #fdeceb;
  color: var(--danger);
  font-size: 13px;
}

.empty-state {
  display: grid;
  gap: 14px;
  justify-items: center;
  margin-top: 16px;
  padding: 36px 8px;
  border: 1px dashed #b6c8de;
  border-radius: 10px;
  background: #f9fbfe;
  color: var(--muted);
  text-align: center;
}

.empty-state p {
  margin: 0;
}

/* ---------- Table ---------- */
.count-badge {
  padding: 6px 12px;
  border-radius: 999px;
  background: #e0eefc;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.table-wrap {
  overflow: auto;
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
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
  vertical-align: top;
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

td:first-child {
  color: var(--navy-deep);
  font-weight: 600;
}

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f6f9fd;
}

.actions-col {
  text-align: right;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  white-space: nowrap;
}

.text-button {
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--blue);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.text-button:hover:not(:disabled) {
  background: var(--field);
  color: var(--navy-deep);
}

.text-button.danger {
  color: var(--danger);
}

.text-button.danger:hover:not(:disabled) {
  background: #fdeceb;
  color: var(--danger);
}

/* ---------- Responsive ---------- */
@media (max-width: 650px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px 20px;
  }

  .page-header h1 {
    font-size: 26px;
  }

  .heading-actions {
    width: 100%;
    justify-content: space-between;
  }

  .record-form {
    grid-template-columns: 1fr;
  }

  .panel {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .record-form input,
  .record-form select,
  .record-form textarea,
  .primary-button,
  .secondary-button,
  .add-button {
    transition: none;
  }
}
</style>