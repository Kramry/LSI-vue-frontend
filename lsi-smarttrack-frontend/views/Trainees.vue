<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiGet, apiPost } from '../services/api'

interface Trainee {
  trainee_id: number
  first_name: string
  last_name: string
  sex: string
  date_of_birth: string | null
  address: string | null
  email: string | null
  contact_number: string
  course: string
  status: string
  qr_code: string
  user_id: number | null
  program_id: number | null
  program_name: string | null
}
interface Choice { id: number | string; label: string }
interface Field { name: string; label: string; type?: string; choices?: Choice[]; values?: string[]; required?: boolean }
interface TraineeData {
  records: Trainee[]
  fields: Field[]
  can_manage: boolean
}

const records = ref<Trainee[]>([])
const fields = ref<Field[]>([])
const canManage = ref(false)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const statusFilter = ref('active')
const editingId = ref<number | null>(null)
const form = ref<Record<string, string>>({})

const filteredRecords = computed(() => {
  const term = search.value.trim().toLowerCase()
  return records.value.filter((trainee) => {
    const matchesStatus = !statusFilter.value || trainee.status === statusFilter.value
    const matchesSearch = !term || [
      trainee.first_name, trainee.last_name, trainee.qr_code, trainee.email,
      trainee.contact_number, trainee.course, trainee.program_name
    ].some((value) => String(value || '').toLowerCase().includes(term))
    return matchesStatus && matchesSearch
  })
})

const activeCount = computed(() => records.value.filter((trainee) => trainee.status === 'active').length)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiGet<TraineeData>('/modules/trainees')
    records.value = response.data.records || []
    fields.value = response.data.fields || []
    canManage.value = response.data.can_manage
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load trainee records.'
  } finally {
    loading.value = false
  }
}

function blankForm() {
  const values: Record<string, string> = {}
  fields.value.forEach((field) => {
    values[field.name] = field.name === 'status' ? 'active' : ''
  })
  return values
}

function startCreate() {
  editingId.value = null
  form.value = blankForm()
  error.value = ''
  notice.value = ''
}

function startEdit(trainee: Trainee) {
  editingId.value = trainee.trainee_id
  form.value = Object.fromEntries(fields.value.map((field) => {
    const value = trainee[field.name as keyof Trainee]
    return [field.name, value == null ? '' : String(value)]
  }))
  error.value = ''
  notice.value = ''
}

function cancelEdit() {
  editingId.value = null
  form.value = {}
}

async function save() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost('/modules/trainees/save', {
      trainee_id: editingId.value || '',
      ...form.value
    })
    notice.value = response.message || 'Trainee saved.'
    cancelEdit()
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to save the trainee.'
  } finally {
    saving.value = false
  }
}

async function deactivate(trainee: Trainee) {
  if (!window.confirm(`Deactivate ${trainee.first_name} ${trainee.last_name}?`)) return
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost(`/modules/trainees/delete/${trainee.trainee_id}`, {})
    notice.value = response.message || 'Trainee deactivated.'
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to deactivate the trainee.'
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">SMARTTRACK / PEOPLE</p>
        <h1>Trainee management</h1>
        <p class="muted">Trainee profiles, program assignments, and contact details.</p>
      </div>
      <div class="heading-actions">
        <button class="secondary-button" :disabled="loading" @click="load">Refresh</button>
        <button v-if="canManage" class="primary-button" @click="startCreate">Add trainee</button>
      </div>
    </header>

    <p v-if="error" class="message error" role="alert">{{ error }}</p>
    <p v-if="notice" class="message success" role="status">{{ notice }}</p>

    <section class="summary-grid">
      <article class="summary-card"><span>All trainee profiles</span><strong>{{ records.length.toLocaleString() }}</strong></article>
      <article class="summary-card"><span>Active trainees</span><strong>{{ activeCount.toLocaleString() }}</strong></article>
      <article class="summary-card"><span>Shown</span><strong>{{ filteredRecords.length.toLocaleString() }}</strong></article>
    </section>

    <section v-if="canManage && Object.keys(form).length" class="panel form-panel">
      <div class="section-heading">
        <div><h2>{{ editingId ? 'Edit trainee profile' : 'Add trainee profile' }}</h2><p class="muted">Fields marked required must be completed.</p></div>
        <button class="text-button" type="button" @click="cancelEdit">Close</button>
      </div>
      <form class="form-grid" @submit.prevent="save">
        <label v-for="field in fields" :key="field.name" :class="{ wide: field.type === 'textarea' }">
          {{ field.label }}
          <select v-if="field.type === 'select'" v-model="form[field.name]" :required="field.required">
            <option value="" disabled>Select {{ field.label.toLowerCase() }}</option>
            <option v-for="choice in field.values || []" :key="choice" :value="choice">{{ choice }}</option>
          </select>
          <select v-else-if="field.type === 'options'" v-model="form[field.name]" :required="field.required">
            <option value="">Not linked</option>
            <option v-for="choice in field.choices || []" :key="String(choice.id)" :value="String(choice.id)">{{ choice.label }}</option>
          </select>
          <textarea v-else-if="field.type === 'textarea'" v-model.trim="form[field.name]" rows="2" :required="field.required"></textarea>
          <input v-else v-model.trim="form[field.name]" :type="field.type || 'text'" :required="field.required">
        </label>
        <div class="form-actions wide">
          <button class="primary-button" type="submit" :disabled="saving">{{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Create trainee' }}</button>
          <button class="secondary-button" type="button" @click="cancelEdit">Cancel</button>
        </div>
      </form>
    </section>

    <section class="panel">
      <div class="toolbar">
        <div><h2>Trainee directory</h2><p class="muted">{{ filteredRecords.length }} matching profiles</p></div>
        <div class="filters">
          <label class="search-label">Search<input v-model.trim="search" type="search" placeholder="Name, QR, program, contact"></label>
          <label>Status<select v-model="statusFilter"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
      </div>

      <p v-if="loading" class="empty">Loading trainee records…</p>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Trainee</th><th>Trainee ID / QR</th><th>Program</th><th>Course</th><th>Contact</th><th>Status</th><th v-if="canManage">Actions</th></tr></thead>
          <tbody>
            <tr v-for="trainee in filteredRecords" :key="trainee.trainee_id">
              <td><strong>{{ trainee.first_name }} {{ trainee.last_name }}</strong><small>{{ trainee.email || 'No email provided' }}</small></td>
              <td>#{{ trainee.trainee_id }}<small>{{ trainee.qr_code }}</small></td>
              <td>{{ trainee.program_name || 'Not assigned' }}</td>
              <td>{{ trainee.course || '—' }}</td>
              <td>{{ trainee.contact_number || '—' }}</td>
              <td><span class="status" :class="trainee.status">{{ trainee.status }}</span></td>
              <td v-if="canManage" class="actions">
                <button class="text-button" @click="startEdit(trainee)">Edit</button>
                <button v-if="trainee.status === 'active'" class="text-button danger" @click="deactivate(trainee)">Deactivate</button>
              </td>
            </tr>
            <tr v-if="!filteredRecords.length"><td :colspan="canManage ? 7 : 6" class="empty">No trainee profiles match these filters.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  --navy: #173a60;
  --navy-deep: #112c49;
  --blue: #265f94;
  --blue-hover: #1f4f7d;
  --sky: #8fc4f5;
  --text: #1b2a3a;
  --muted: #5d6f82;
  --line: #e1e8f1;
  --field: #eaf0fb;
  --ok: #2d8a57;
  --warn: #c98a00;
  --danger: #b4281f;

  max-width: 1450px;
  margin: auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

/* ---------- Banner and headings ---------- */
.page-heading,
.section-heading,
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.page-heading {
  position: relative;
  align-items: center;
  padding: 26px 28px;
  border-radius: 14px;
  color: #fff;
  background: var(--navy);
  overflow: hidden;
}

.page-heading::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, transparent 0 120px, rgb(255 255 255 / 4%) 120px 121px);
  pointer-events: none;
}

.page-heading > * {
  position: relative;
}

.page-heading h1 {
  margin: 0;
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.page-heading .muted {
  margin: 6px 0 0;
  color: rgb(255 255 255 / 80%);
}

.section-heading h2,
.toolbar h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--sky);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.muted {
  color: var(--muted);
  font-size: 14px;
}

.heading-actions,
.actions,
.form-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ---------- Buttons ---------- */
.primary-button,
.secondary-button {
  min-height: 42px;
  padding: 10px 18px;
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

.page-heading .secondary-button {
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
}

.page-heading .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
}

/* a primary button placed in the banner reads best in white */
.page-heading .primary-button {
  background: #fff;
  color: var(--navy-deep);
}

.page-heading .primary-button:hover:not(:disabled) {
  background: #e3effb;
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: translateY(1px);
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---------- Panels and summary cards ---------- */
.panel,
.summary-card {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
}

.panel {
  margin-top: 18px;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.summary-card {
  border-top: 3px solid var(--blue);
}

.summary-card:nth-child(3n + 2) {
  border-top-color: var(--sky);
}

.summary-card:nth-child(3n) {
  border-top-color: var(--ok);
}

.summary-card span {
  display: block;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.summary-card strong {
  display: block;
  margin-top: 8px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
}

/* ---------- Messages ---------- */
.message {
  margin: 16px 0 0;
  padding: 12px 14px;
  border-radius: 6px;
}

.error {
  border-left: 3px solid var(--danger);
  background: #fdeceb;
  color: var(--danger);
}

.success {
  border-left: 3px solid var(--ok);
  background: #e3f4ea;
  color: #1f6b41;
}

/* ---------- Form ---------- */
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.form-grid label,
.filters label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
}

.form-grid input,
.form-grid select,
.form-grid textarea,
.filters input,
.filters select {
  min-width: 0;
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.form-grid textarea {
  min-height: 96px;
  resize: vertical;
}

.form-grid input:hover,
.form-grid select:hover,
.form-grid textarea:hover,
.filters input:hover,
.filters select:hover {
  border-color: #b6c8de;
}

.form-grid input:focus,
.form-grid select:focus,
.form-grid textarea:focus,
.filters input:focus,
.filters select:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 18%);
}

.wide {
  grid-column: 1 / -1;
}

.form-actions {
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}

/* ---------- Filters and toolbar ---------- */
.filters {
  display: flex;
  gap: 12px;
  align-items: end;
}

.search-label {
  min-width: 260px;
}

.toolbar {
  align-items: end;
}

/* ---------- Table ---------- */
.table-wrap {
  overflow: auto;
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
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

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f6f9fd;
}

td:first-child {
  color: var(--navy-deep);
  font-weight: 600;
}

td small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-weight: 400;
}

.status {
  display: inline-block;
  padding: 4px 11px;
  border-radius: 999px;
  background: #e3f4ea;
  color: #1f6b41;
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
}

.status.inactive {
  background: #e8edf4;
  color: #4b5d73;
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

.text-button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.danger {
  color: var(--danger);
}

.text-button.danger:hover:not(:disabled) {
  background: #fdeceb;
  color: var(--danger);
}

.empty {
  padding: 32px;
  text-align: center;
  color: var(--muted);
}

/* ---------- Responsive ---------- */
@media (max-width: 850px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .filters {
    width: 100%;
  }

  .filters label:first-child {
    flex: 1;
  }
}

@media (max-width: 560px) {
  .form-grid,
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .wide {
    grid-column: auto;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
    padding: 22px 20px;
  }

  .page-heading h1 {
    font-size: 26px;
  }

  .heading-actions {
    align-items: stretch;
    flex-direction: column;
    width: 100%;
  }

  .filters {
    align-items: stretch;
    flex-direction: column;
  }

  .search-label {
    min-width: 0;
  }

  .panel {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary-button,
  .secondary-button,
  .form-grid input,
  .form-grid select,
  .form-grid textarea {
    transition: none;
  }
}
</style>