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

async function deleteRecord(record: Record<string, string | number | string[] | null>) {
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
                <th v-if="section === 'classes'">Trainee requirements</th>
                <th v-if="module.can_manage" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in module.records" :key="String(record[module.primary_key])">
                <td v-for="column in module.columns" :key="column">
                  {{ record[column] ?? '—' }}
                </td>
                <td v-if="section === 'classes'">
                  <ul v-if="Array.isArray(record.requirements) && record.requirements.length" class="requirements-list">
                    <li v-for="requirement in record.requirements" :key="requirement">{{ requirement }}</li>
                  </ul>
                  <span v-else class="muted">None listed</span>
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
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
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

/* faint table-grid lines slowly drift behind the heading */
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

/* the form opens like a drawer, with a blue edge that draws across the top */
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
  background: linear-gradient(90deg, var(--blue), var(--sky));
  animation: edge-draw 0.8s var(--ease) 0.1s both;
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
  animation: breathe 1.4s ease-in-out infinite;
}

/* ================= Form ================= */
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
  color: var(--blue);
}

.record-form .wide {
  grid-column: 1 / -1;
}

/* required star gently pulses until the field is filled */
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
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 20px -14px rgb(38 95 148 / 55%);
  transform: translateY(-1px);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}

/* ================= Buttons ================= */
.primary-button,
.secondary-button,
.add-button {
  position: relative;
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

/* light sweep on hover */
.primary-button::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -60%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 28%), transparent);
  transform: skewX(-20deg);
  transition: left 0.7s var(--ease);
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 18px 26px -14px rgb(38 95 148 / 90%);
}

.primary-button:hover:not(:disabled)::before {
  left: 130%;
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
}

.page-header .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
  transform: translateY(-2px);
}

/* "Add record": the plus turns on hover */
.add-button {
  background: #fff;
  color: var(--navy-deep);
  animation: pop-in 0.6s var(--spring) 0.25s both;
}

.add-button:hover {
  background: #e3effb;
  transform: translateY(-2px);
  box-shadow: 0 14px 24px -14px rgb(0 0 0 / 55%);
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

/* saving: progress stripe along the bottom edge */
.primary-button:disabled::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--sky), transparent);
  background-size: 50% 100%;
  background-repeat: no-repeat;
  animation: load 1.1s ease-in-out infinite;
}

/* ================= Messages and empty state ================= */
.inline-error {
  margin: 0;
  padding: 12px 14px;
  border-left: 3px solid var(--danger);
  border-radius: 6px;
  background: #fdeceb;
  color: var(--danger);
  font-size: 13px;
  animation: shake 0.45s ease both;
}

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

/* an empty tray that gently bobs */
.empty-state::before {
  content: '';
  width: 54px;
  height: 38px;
  border: 2px solid #b6c8de;
  border-radius: 6px 6px 14px 14px;
  background:
    linear-gradient(#b6c8de, #b6c8de) 50% 14px / 22px 2px no-repeat,
    #fff;
  animation: bob 3s ease-in-out infinite;
}

.empty-state p {
  margin: 0;
}

/* ================= Table: rows cascade like ledger entries ================= */
.count-badge {
  padding: 6px 12px;
  border-radius: 999px;
  background: #e0eefc;
  color: var(--blue);
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

.requirements-list {
  min-width: 190px;
  margin: 0;
  padding-left: 18px;
  color: var(--text);
}

.requirements-list li + li {
  margin-top: 4px;
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

td:first-child {
  color: var(--navy-deep);
  font-weight: 600;
  transition: color 0.2s ease, padding-left 0.25s var(--ease);
}

tbody tr:last-child td {
  border-bottom: 0;
}

/* hovered record: sky edge appears and the first cell steps in */
tbody tr:hover {
  background: #f6f9fd;
  box-shadow: inset 3px 0 0 var(--sky);
}

tbody tr:hover td:first-child {
  color: var(--blue);
  padding-left: 18px;
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

/* row actions stay quiet until the row is hovered or focused */
.row-actions .text-button {
  opacity: 0.55;
}

tbody tr:hover .row-actions .text-button,
tbody tr:focus-within .row-actions .text-button {
  opacity: 1;
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
  transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease, transform 0.2s var(--spring);
}

.text-button:hover:not(:disabled) {
  background: var(--field);
  color: var(--navy-deep);
  transform: translateY(-1px);
}

.text-button:active:not(:disabled) {
  transform: scale(0.94);
}

.text-button.danger {
  color: var(--danger);
}

/* delete warns before you click: the whole button trembles on hover */
.text-button.danger:hover:not(:disabled) {
  background: #fdeceb;
  color: var(--danger);
  animation: tremble 0.35s ease 1;
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

/* the drawer unfolds from the top */
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
    opacity: 0.5;
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

  /* no hover on touch screens, so keep row actions fully visible */
  .row-actions .text-button {
    opacity: 1;
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page-header,
  .page-header::after,
  .list-panel,
  .form-panel,
  .form-panel::before,
  .record-form > *,
  .req,
  .add-button,
  .primary-button:disabled::after,
  .inline-error,
  .empty-state,
  .empty-state::before,
  .loading,
  .count-badge,
  tbody tr,
  .text-button.danger:hover:not(:disabled) {
    animation: none;
  }

  .panel,
  .record-form input,
  .record-form select,
  .record-form textarea,
  .record-form label,
  .primary-button,
  .primary-button::before,
  .secondary-button,
  .add-button,
  .text-button,
  tbody tr,
  td:first-child {
    transition: none;
  }
}
</style>