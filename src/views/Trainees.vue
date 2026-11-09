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
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  max-width: 1450px;
  margin: auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

/* ================= Banner ================= */
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
  background: linear-gradient(120deg, var(--navy) 0%, #1b4470 60%, var(--navy) 100%);
  overflow: hidden;
  animation: drop-in 0.6s var(--ease) both;
}

.page-heading::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, transparent 0 120px, rgb(255 255 255 / 4%) 120px 121px);
  pointer-events: none;
}

/* a small ID badge floats behind the heading */
.page-heading::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 10%;
  width: 92px;
  height: 124px;
  margin-top: -62px;
  border: 1.5px solid rgb(143 196 245 / 40%);
  border-radius: 12px;
  background:
    radial-gradient(circle at 50% 34%, rgb(143 196 245 / 40%) 0 15px, transparent 16px),
    linear-gradient(rgb(143 196 245 / 30%), rgb(143 196 245 / 30%)) 50% 66px / 52px 3px no-repeat,
    linear-gradient(rgb(143 196 245 / 22%), rgb(143 196 245 / 22%)) 50% 80px / 38px 3px no-repeat,
    rgb(255 255 255 / 5%);
  transform: rotate(8deg);
  transform-origin: top center;
  animation: badge-swing 6s ease-in-out infinite;
  pointer-events: none;
}

.page-heading > * {
  position: relative;
  z-index: 1;
}

.page-heading h1 {
  margin: 0;
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.01em;
  animation: rise 0.7s var(--ease) 0.1s both;
}

.page-heading .muted {
  margin: 6px 0 0;
  color: rgb(255 255 255 / 80%);
  animation: rise 0.7s var(--ease) 0.2s both;
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
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: var(--sky);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.eyebrow::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5fd08c;
  animation: ping 2.2s ease-out infinite;
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

.heading-actions > * {
  animation: pop-in 0.55s var(--spring) both;
}

.heading-actions > :nth-child(1) { animation-delay: 0.25s; }
.heading-actions > :nth-child(2) { animation-delay: 0.33s; }
.heading-actions > :nth-child(n + 3) { animation-delay: 0.41s; }

/* ================= Buttons ================= */
.primary-button,
.secondary-button {
  position: relative;
  min-height: 42px;
  padding: 10px 18px;
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

.page-heading .secondary-button {
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
}

.page-heading .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
  transform: translateY(-2px);
}

/* a primary button placed in the banner reads best in white */
.page-heading .primary-button {
  background: #fff;
  color: var(--navy-deep);
  box-shadow: none;
}

.page-heading .primary-button:hover:not(:disabled) {
  background: #e3effb;
  box-shadow: 0 14px 24px -14px rgb(0 0 0 / 55%);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: scale(0.97);
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
.text-button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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

/* ================= Panels and summary cards ================= */
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
  animation: rise 0.65s var(--ease) 0.1s both;
  transition: box-shadow 0.3s ease;
}

.panel:hover {
  box-shadow: 0 16px 34px -20px rgb(17 44 73 / 50%);
}

.panel:nth-of-type(2) { animation-delay: 0.18s; }
.panel:nth-of-type(n + 3) { animation-delay: 0.26s; }

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.summary-card {
  position: relative;
  border-top: 3px solid var(--blue);
  overflow: hidden;
  animation: pop-in 0.6s var(--spring) both;
  transition: transform 0.3s var(--ease), box-shadow 0.3s ease;
}

.summary-card:nth-child(1) { animation-delay: 0.05s; }
.summary-card:nth-child(2) { animation-delay: 0.12s; }
.summary-card:nth-child(3) { animation-delay: 0.19s; }

.summary-card:nth-child(3n + 2) {
  border-top-color: var(--sky);
}

.summary-card:nth-child(3n) {
  border-top-color: var(--ok);
}

/* soft glow that appears on hover */
.summary-card::after {
  content: '';
  position: absolute;
  top: -60%;
  right: -30%;
  width: 70%;
  height: 160%;
  background: radial-gradient(circle, rgb(143 196 245 / 28%), transparent 65%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.summary-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 22px 34px -22px rgb(17 44 73 / 60%);
}

.summary-card:hover::after {
  opacity: 1;
}

.summary-card span,
.summary-card strong {
  position: relative;
  z-index: 1;
  display: block;
}

.summary-card span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.summary-card strong {
  margin-top: 8px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
  animation: number-in 0.7s var(--ease) 0.3s both;
}

/* ================= Messages ================= */
.message {
  margin: 16px 0 0;
  padding: 12px 14px;
  border-radius: 6px;
}

.error {
  border-left: 3px solid var(--danger);
  background: #fdeceb;
  color: var(--danger);
  animation: shake 0.45s ease both;
}

.success {
  position: relative;
  padding-left: 52px;
  border-left: 3px solid var(--ok);
  background: #e3f4ea;
  color: #1f6b41;
  overflow: hidden;
  animation: pop-in 0.5s var(--spring) both;
}

/* a green tick bursts out beside a saved trainee */
.success::before {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 14px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-top: -13px;
  border-radius: 50%;
  background: var(--ok);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  animation: tick-pop 0.55s var(--spring) 0.1s both, ring-green 1.1s ease-out 0.25s 2;
}

/* ================= Form ================= */
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

/* fields appear one after another */
.form-grid > * {
  animation: rise 0.5s var(--ease) both;
}

.form-grid > :nth-child(1) { animation-delay: 0.15s; }
.form-grid > :nth-child(2) { animation-delay: 0.2s; }
.form-grid > :nth-child(3) { animation-delay: 0.25s; }
.form-grid > :nth-child(4) { animation-delay: 0.3s; }
.form-grid > :nth-child(5) { animation-delay: 0.35s; }
.form-grid > :nth-child(6) { animation-delay: 0.4s; }
.form-grid > :nth-child(7) { animation-delay: 0.45s; }
.form-grid > :nth-child(8) { animation-delay: 0.5s; }
.form-grid > :nth-child(9) { animation-delay: 0.55s; }
.form-grid > :nth-child(n + 10) { animation-delay: 0.6s; }

.form-grid label,
.filters label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.form-grid label:has(input:focus, select:focus, textarea:focus),
.filters label:has(input:focus, select:focus) {
  color: var(--blue);
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
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
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
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 20px -14px rgb(38 95 148 / 55%);
  transform: translateY(-1px);
}

.wide {
  grid-column: 1 / -1;
}

.form-actions {
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}

/* ================= Filters and toolbar ================= */
.filters {
  display: flex;
  gap: 12px;
  align-items: end;
}

/* the search field widens when you click into it, like opening a directory */
.search-label {
  min-width: 260px;
}

.search-label input {
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease), min-width 0.4s var(--ease);
}

.search-label input:focus {
  min-width: 340px;
}

.toolbar {
  align-items: end;
}

/* ================= Table: the directory fills in ================= */
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

tbody tr {
  animation: row-in 0.5s var(--ease) both;
  transition: background 0.2s ease, box-shadow 0.25s ease;
}

tbody tr:nth-child(1) { animation-delay: 0.25s; }
tbody tr:nth-child(2) { animation-delay: 0.31s; }
tbody tr:nth-child(3) { animation-delay: 0.37s; }
tbody tr:nth-child(4) { animation-delay: 0.43s; }
tbody tr:nth-child(5) { animation-delay: 0.49s; }
tbody tr:nth-child(6) { animation-delay: 0.55s; }
tbody tr:nth-child(7) { animation-delay: 0.61s; }
tbody tr:nth-child(8) { animation-delay: 0.67s; }
tbody tr:nth-child(n + 9) { animation-delay: 0.73s; }

tbody tr:last-child td {
  border-bottom: 0;
}

/* a hovered person: sky edge appears and the name steps in */
tbody tr:hover {
  background: #f6f9fd;
  box-shadow: inset 3px 0 0 var(--sky);
}

td:first-child {
  color: var(--navy-deep);
  font-weight: 600;
  transition: color 0.2s ease, padding-left 0.25s var(--ease);
}

tbody tr:hover td:first-child {
  color: var(--blue);
  padding-left: 18px;
}

td small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-weight: 400;
}

/* status badges: active people get a live, pulsing dot */
.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px 4px 10px;
  border-radius: 999px;
  background: #e3f4ea;
  color: #1f6b41;
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
  animation: pop-in 0.45s var(--spring) both;
}

.status::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: ping-green 2.4s ease-out 1s infinite;
}

.status.inactive {
  background: #e8edf4;
  color: #4b5d73;
}

.status.inactive::before {
  animation: none;
}

/* row actions stay quiet until the row is hovered or focused */
td .text-button {
  opacity: 0.6;
}

tbody tr:hover .text-button,
tbody tr:focus-within .text-button {
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

.text-button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.danger {
  color: var(--danger);
}

/* delete warns before you click: the button trembles once on hover */
.text-button.danger:hover:not(:disabled) {
  background: #fdeceb;
  color: var(--danger);
  animation: tremble 0.35s ease 1;
}

.empty {
  padding: 32px;
  text-align: center;
  color: var(--muted);
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
    transform: scale(0.82);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes row-in {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes number-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* the ID badge sways gently, as if hanging from a lanyard */
@keyframes badge-swing {
  0%,
  100% {
    transform: rotate(8deg);
  }
  50% {
    transform: rotate(2deg);
  }
}

@keyframes ping {
  0% {
    box-shadow: 0 0 0 0 rgb(95 208 140 / 65%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 9px rgb(95 208 140 / 0%);
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

@keyframes tick-pop {
  from {
    transform: scale(0) rotate(-40deg);
  }
  to {
    transform: none;
  }
}

@keyframes ring-green {
  0% {
    box-shadow: 0 0 0 0 rgb(45 138 87 / 55%);
  }
  100% {
    box-shadow: 0 0 0 14px rgb(45 138 87 / 0%);
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

  .search-label input:focus {
    min-width: 0;
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

  .page-heading::after {
    display: none;
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

  /* no hover on touch screens, so keep row actions fully visible */
  td .text-button {
    opacity: 1;
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page-heading,
  .page-heading::after,
  .page-heading h1,
  .page-heading .muted,
  .eyebrow::before,
  .heading-actions > *,
  .primary-button:disabled::after,
  .panel,
  .summary-card,
  .summary-card strong,
  .error,
  .success,
  .success::before,
  .form-grid > *,
  tbody tr,
  .status,
  .status::before,
  .text-button.danger:hover:not(:disabled) {
    animation: none;
  }

  .primary-button,
  .primary-button::before,
  .secondary-button,
  .panel,
  .summary-card,
  .summary-card::after,
  .form-grid input,
  .form-grid select,
  .form-grid textarea,
  .form-grid label,
  .filters input,
  .filters select,
  .search-label input,
  .text-button,
  tbody tr,
  td:first-child {
    transition: none;
  }
}
</style>