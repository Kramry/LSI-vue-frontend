<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiGet, apiPost } from '../services/api'

interface Choice { id: number | string; label: string }
interface Assessment {
  assessment_id: number
  trainee_id: number
  class_id: number
  trainee_name: string
  trainee_number: string
  class_name: string
  program_name: string
  assessment_name: string
  outcome: string
  assessment_date: string
  assessor_name: string
  notes: string
  time_limit_minutes: number | null
}
interface AssessmentData {
  records: Assessment[]
  assessment_options: { trainees: Choice[]; classes: Choice[] }
}

const records = ref<Assessment[]>([])
const trainees = ref<Choice[]>([])
const classes = ref<Choice[]>([])
const editingId = ref<number | null>(null)
const form = ref({ trainee_id: '', class_id: '', assessment_name: '', outcome: 'pass', assessment_date: new Date().toISOString().slice(0, 10), notes: '', time_limit_minutes: '' })
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiGet<AssessmentData>('/modules/assessments')
    records.value = response.data.records || []
    trainees.value = response.data.assessment_options?.trainees || []
    classes.value = response.data.assessment_options?.classes || []
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load assessments.'
  } finally {
    loading.value = false
  }
}

function edit(item: Assessment) {
  editingId.value = item.assessment_id
  form.value = {
    trainee_id: String(item.trainee_id), class_id: String(item.class_id),
    assessment_name: item.assessment_name, outcome: item.outcome,
    assessment_date: item.assessment_date, notes: item.notes || '',
    time_limit_minutes: item.time_limit_minutes ? String(item.time_limit_minutes) : ''
  }
  notice.value = ''
}

function resetForm() {
  editingId.value = null
  form.value = {
    trainee_id: '', class_id: '', assessment_name: '', outcome: 'pass',
    assessment_date: new Date().toISOString().slice(0, 10), notes: '', time_limit_minutes: ''
  }
}

async function save() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await apiPost('/assessments/save', { assessment_id: editingId.value || '', ...form.value })
    notice.value = editingId.value ? 'Assessment updated.' : 'Assessment recorded.'
    resetForm()
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to save the assessment.'
  } finally {
    saving.value = false
  }
}

async function remove(item: Assessment) {
  if (!window.confirm(`Delete the assessment "${item.assessment_name}" for ${item.trainee_name}?`)) return
  error.value = ''
  notice.value = ''
  try {
    await apiPost(`/assessments/${item.assessment_id}/delete`, {})
    notice.value = 'Assessment deleted.'
    if (editingId.value === item.assessment_id) resetForm()
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to delete the assessment.'
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page-heading">
      <div><p class="eyebrow">SMARTTRACK / ACADEMIC RECORDS</p><h1>Assessments</h1><p class="muted">Record and review trainee assessment outcomes.</p></div>
      <button class="secondary-button" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="inline-success" role="status">{{ notice }}</p>

    <section class="panel">
      <h2>{{ editingId ? 'Edit assessment result' : 'Record assessment result' }}</h2>
      <form class="form-grid" @submit.prevent="save">
        <label>Trainee
          <select v-model="form.trainee_id" required>
            <option value="" disabled>Select trainee</option>
            <option v-for="item in trainees" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
          </select>
        </label>
        <label>Class
          <select v-model="form.class_id" required>
            <option value="" disabled>Select class</option>
            <option v-for="item in classes" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
          </select>
        </label>
        <label>Assessment name<input v-model.trim="form.assessment_name" maxlength="150" required></label>
        <label>Outcome
          <select v-model="form.outcome" required><option value="pass">Pass</option><option value="fail">Fail</option></select>
        </label>
        <label>Assessment date<input v-model="form.assessment_date" type="date" required></label>
        <label>Time limit (minutes)<input v-model.trim="form.time_limit_minutes" type="number" min="1" max="1440" placeholder="Optional"></label>
        <label class="wide">Notes<textarea v-model.trim="form.notes" maxlength="2000" rows="3"></textarea></label>
        <div class="actions wide">
          <button class="primary-button" type="submit" :disabled="saving">{{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Record result' }}</button>
          <button v-if="editingId" class="secondary-button" type="button" @click="resetForm">Cancel edit</button>
        </div>
      </form>
    </section>

    <section class="panel list-panel">
      <div class="section-heading"><div><h2>Assessment records</h2><p class="muted">{{ records.length }} records</p></div></div>
      <p v-if="loading" class="muted">Loading assessments…</p>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Trainee</th><th>Program / class</th><th>Assessment</th><th>Outcome</th><th>Date</th><th>Time limit</th><th>Assessor</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="item in records" :key="item.assessment_id">
              <td>{{ item.trainee_name }}<small>{{ item.trainee_number }}</small></td>
              <td>{{ item.program_name }}<small>{{ item.class_name }}</small></td>
              <td>{{ item.assessment_name }}</td>
              <td><span class="pill" :class="item.outcome">{{ item.outcome }}</span></td>
              <td>{{ item.assessment_date }}</td>
              <td>{{ item.time_limit_minutes ? item.time_limit_minutes + ' min' : '—' }}</td>
              <td>{{ item.assessor_name }}</td><td>{{ item.notes || '—' }}</td>
              <td class="actions"><button class="text-button" @click="edit(item)">Edit</button><button class="text-button danger" @click="remove(item)">Delete</button></td>
            </tr>
            <tr v-if="!records.length"><td colspan="9" class="empty">No assessment records found.</td></tr>
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
  --danger: #b4281f;

  max-width: 1450px;
  margin: auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
}

/* ---------- Headings ---------- */
.page-heading,
.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.page-heading {
  position: relative;
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

.section-heading h2 {
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

/* ---------- Panel and form ---------- */
.panel {
  margin-top: 18px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.form-grid label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
}

.form-grid input,
.form-grid select,
.form-grid textarea {
  width: 100%;
  padding: 11px 12px;
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
.form-grid textarea:hover {
  border-color: #b6c8de;
}

.form-grid input:focus,
.form-grid select:focus,
.form-grid textarea:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 18%);
}

.wide {
  grid-column: 1 / -1;
}

.actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* ---------- Buttons ---------- */
.primary-button,
.secondary-button {
  padding: 11px 18px;
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

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: translateY(1px);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---------- Messages ---------- */
.inline-error,
.inline-success {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 6px;
}

.inline-error {
  border-left: 3px solid var(--danger);
  background: #fdeceb;
  color: var(--danger);
}

.inline-success {
  border-left: 3px solid var(--ok);
  background: #e3f4ea;
  color: #1f6b41;
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

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f6f9fd;
}

td small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
}

/* Pass / Fail pills */
.pill {
  display: inline-block;
  padding: 4px 11px;
  border-radius: 20px;
  background: #e3f4ea;
  color: #1f6b41;
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
}

.pill.fail {
  background: #fdeceb;
  color: var(--danger);
}

.text-button {
  padding: 4px 6px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--blue);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.text-button:hover {
  background: var(--field);
  color: var(--navy-deep);
}

.danger {
  color: var(--danger);
}

.text-button.danger:hover {
  background: #fdeceb;
  color: var(--danger);
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--muted);
}

/* ---------- Responsive ---------- */
@media (max-width: 850px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .wide {
    grid-column: auto;
  }

  .panel {
    padding: 16px;
  }

  .page-heading {
    flex-direction: column;
    padding: 22px 20px;
  }

  .page-heading h1 {
    font-size: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .form-grid input,
  .form-grid select,
  .form-grid textarea,
  .primary-button,
  .secondary-button {
    transition: none;
  }
}
</style>