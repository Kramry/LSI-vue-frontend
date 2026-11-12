<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiGet, apiPost, apiRequest, ApiError } from '../services/api'

interface ClassCard {
  class_id: number
  class_name: string
  program_id: number
  program_name: string
  room: string | null
  start_date: string | null
  end_date: string | null
  schedule_summary: string | null
  enrolled_count: number
  today_present: number
  today_late: number
  today_not_scanned: number
  teaching_status: 'ongoing' | 'upcoming' | 'completed' | string
}
interface Choice { id: number | string; label: string }
interface ClassesData { classes: ClassCard[]; programs: Choice[]; instructors: Choice[] }

const data = ref<ClassesData>({ classes: [], programs: [], instructors: [] })
const loading = ref(true)
const error = ref('')
const search = ref('')
const programId = ref('')
const instructorId = ref('')
const status = ref('')
const role = ref('')
const formOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const form = reactive({
  class_name: '',
  program_id: '',
  instructor_id: '',
  start_date: '',
  end_date: '',
  status: 'active'
})

const isStaff = computed(() => ['administrator', 'staff'].includes(role.value))
const filteredClasses = computed(() => data.value.classes.filter((item) => {
  const term = search.value.trim().toLowerCase()
  return (!term || [item.class_name, item.program_name, item.room].some((value) => String(value || '').toLowerCase().includes(term)))
    && (!programId.value || String(item.program_id) === programId.value)
    && (!instructorId.value || String((item as ClassCard & { instructor_id?: number }).instructor_id) === instructorId.value)
    && (!status.value || item.teaching_status === status.value)
}))

function resetForm() {
  form.class_name = ''
  form.program_id = ''
  form.instructor_id = ''
  form.start_date = ''
  form.end_date = ''
  form.status = 'active'
  editingId.value = null
}

function openCreateForm() {
  resetForm()
  formError.value = ''
  formOpen.value = true
}

function openEditForm(item: ClassCard) {
  form.class_name = item.class_name
  form.program_id = String(item.program_id)
  form.instructor_id = String((item as ClassCard & { instructor_id?: number }).instructor_id || '')
  form.start_date = item.start_date || ''
  form.end_date = item.end_date || ''
  form.status = 'active'
  editingId.value = item.class_id
  formError.value = ''
  formOpen.value = true
}

function closeCreateForm() {
  formOpen.value = false
  formError.value = ''
}

async function saveClass() {
  saving.value = true
  formError.value = ''
  try {
    const payload: any = {
      class_name: form.class_name,
      program_id: form.program_id,
      instructor_id: form.instructor_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status
    }
    if (editingId.value) {
      payload.class_id = editingId.value
    }
    await apiPost('/classes/save', payload)
    closeCreateForm()
    await load()
  } catch (reason) {
    formError.value = reason instanceof ApiError
      ? reason.message
      : reason instanceof Error ? reason.message : 'Unable to save this class.'
  } finally {
    saving.value = false
  }
}

async function deleteClass(id: number) {
  if (!confirm('Are you sure you want to delete this class?')) return
  deletingId.value = id
  try {
    await apiRequest(`/classes/${id}`, { method: 'DELETE' })
    await load()
  } catch (reason) {
    error.value = reason instanceof ApiError
      ? reason.message
      : reason instanceof Error ? reason.message : 'Unable to delete this class.'
  } finally {
    deletingId.value = null
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const query = new URLSearchParams()
    if (programId.value) query.set('program_id', programId.value)
    if (instructorId.value) query.set('instructor_id', instructorId.value)
    const response = await apiGet<ClassesData>(`/classes${query.size ? `?${query}` : ''}`)
    data.value = response.data
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load classes.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const session = await apiGet<{ user: { role: string } | null }>('/session')
  role.value = session.data.user?.role || ''
  await load()
})
</script>

<template>
  <main class="classes-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">SMARTTRACK / TEACHING</p>
        <h1>{{ role === 'instructor' ? 'My classes' : 'Classes' }}</h1>
        <p class="lead">Manage your classes, trainees, attendance and assessment results.</p>
      </div>
      <div class="heading-side">
        <div v-if="!loading" class="count-chip">
          <strong>{{ filteredClasses.length }}</strong>
          <span>{{ filteredClasses.length === 1 ? 'class' : 'classes' }}</span>
        </div>
        <button v-if="isStaff" class="primary-button header-button" @click="openCreateForm">+ Add Class</button>
        <button class="secondary-button header-button" :disabled="loading" @click="load">Refresh</button>
      </div>
    </header>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>

    <section v-if="formOpen && isStaff" class="panel form-panel">
      <div class="form-heading">
        <div>
          <h2>{{ editingId ? 'Edit Class' : 'Add Class' }}</h2>
          <p class="muted">{{ editingId ? 'Update class details.' : 'Create a class for a training program.' }}</p>
        </div>
        <button class="secondary-button" type="button" @click="closeCreateForm">Cancel</button>
      </div>
      <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
      <form class="class-form" @submit.prevent="saveClass">
        <label>
          <span>Class name <em>*</em></span>
          <input v-model="form.class_name" required>
        </label>
        <label>
          <span>Program <em>*</em></span>
          <select v-model="form.program_id" required>
            <option value="">Choose a program</option>
            <option v-for="item in data.programs" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
          </select>
        </label>
        <label>
          <span>Instructor</span>
          <select v-model="form.instructor_id">
            <option value="">Unassigned</option>
            <option v-for="item in data.instructors" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
          </select>
        </label>
        <label>
          <span>Start date</span>
          <input v-model="form.start_date" type="date">
        </label>
        <label>
          <span>End date</span>
          <input v-model="form.end_date" type="date">
        </label>
        <label>
          <span>Status <em>*</em></span>
          <select v-model="form.status" required>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div class="form-actions">
          <button class="primary-button" type="submit" :disabled="saving">
            {{ saving ? 'Saving...' : (editingId ? 'Update class' : 'Create class') }}
          </button>
        </div>
      </form>
    </section>

    <section class="panel filters" aria-label="Filters">
      <label class="search-field">
        <span class="sr-only">Search classes</span>
        <input v-model="search" aria-label="Search classes" placeholder="Search classes or programs">
      </label>
      <select v-model="programId" aria-label="Filter by program">
        <option value="">All programs</option>
        <option v-for="item in data.programs" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
      </select>
      <select v-if="role !== 'instructor'" v-model="instructorId" aria-label="Filter by instructor">
        <option value="">All instructors</option>
        <option v-for="item in data.instructors" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
      </select>
      <select v-model="status" aria-label="Filter by status">
        <option value="">All statuses</option>
        <option value="ongoing">Ongoing</option>
        <option value="upcoming">Upcoming</option>
        <option value="completed">Completed</option>
      </select>
    </section>

    <p v-if="loading" class="panel muted loading">Loading classes...</p>

    <section v-else-if="!filteredClasses.length" class="panel empty-state">
      <h2>No classes found</h2>
      <p class="muted">No classes match the selected filters.</p>
    </section>

    <section v-else class="class-grid">
      <article
        v-for="item in filteredClasses"
        :key="item.class_id"
        class="panel class-card"
        :class="item.teaching_status"
      >
        <div class="card-top">
          <div class="card-heading">
            <p class="program">{{ item.program_name }}</p>
            <h2>{{ item.class_name }}</h2>
          </div>
          <span class="status-pill" :class="item.teaching_status">{{ item.teaching_status }}</span>
        </div>

        <dl class="class-meta">
          <div>
            <dt>Schedule</dt>
            <dd>{{ item.schedule_summary || 'No sessions scheduled' }}</dd>
          </div>
          <div>
            <dt>Room</dt>
            <dd>{{ item.room || 'Not assigned' }}</dd>
          </div>
          <div>
            <dt>Dates</dt>
            <dd>{{ item.start_date || '—' }} to {{ item.end_date || '—' }}</dd>
          </div>
        </dl>

        <div class="today">
          <div class="today-head">
            <span>Today’s attendance</span>
            <strong>{{ Number(item.today_present || 0) + Number(item.today_late || 0) }} of {{ item.enrolled_count }}</strong>
          </div>
          <div class="bar" role="img" :aria-label="`${Number(item.today_present || 0) + Number(item.today_late || 0)} of ${item.enrolled_count} trainees scanned today`">
            <i :style="{ width: `${Math.min(100, ((Number(item.today_present || 0) + Number(item.today_late || 0)) / Math.max(1, Number(item.enrolled_count || 0))) * 100)}%` }"></i>
          </div>
        </div>

        <div class="stats">
          <div>
            <strong>{{ item.enrolled_count }}</strong>
            <span>Enrolled</span>
          </div>
          <div>
            <strong>{{ Number(item.today_present || 0) + Number(item.today_late || 0) }}</strong>
            <span>Scanned today</span>
          </div>
          <div>
            <strong>{{ item.today_not_scanned }}</strong>
            <span>Not scanned</span>
          </div>
        </div>

        <div class="actions">
          <RouterLink class="primary-button" :to="`/classes/${item.class_id}`">Open class</RouterLink>
          <RouterLink class="secondary-button" :to="{ path: '/attendance', query: { class_id: item.class_id } }">Take attendance</RouterLink>
          <RouterLink class="secondary-button" :to="{ path: '/assessments', query: { class_id: item.class_id } }">Record assessment</RouterLink>
          <template v-if="isStaff">
            <button class="secondary-button" type="button" @click="openEditForm(item)">Edit</button>
            <button class="danger-button" type="button" :disabled="deletingId === item.class_id" @click="deleteClass(item.class_id)">
              {{ deletingId === item.class_id ? 'Deleting...' : 'Delete' }}
            </button>
          </template>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.classes-page {
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

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

/* ================= Banner ================= */
.page-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
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

/* timetable hour-lines drift slowly behind the heading */
.page-header::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 40%;
  background:
    repeating-linear-gradient(90deg, rgb(143 196 245 / 14%) 0 1px, transparent 1px 48px),
    repeating-linear-gradient(0deg, rgb(143 196 245 / 10%) 0 1px, transparent 1px 26px);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 75%);
  mask-image: linear-gradient(90deg, transparent, #000 75%);
  animation: hours-drift 14s linear infinite;
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
  animation: rise 0.7s var(--ease) 0.1s both;
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
  animation: rise 0.7s var(--ease) 0.2s both;
}

.heading-side {
  display: flex;
  align-items: center;
  gap: 12px;
}

.count-chip {
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 8px 16px;
  border: 1px solid rgb(143 196 245 / 45%);
  border-radius: 10px;
  background: rgb(143 196 245 / 16%);
  color: #d6e9fb;
  font-size: 13px;
  animation: pop-in 0.6s var(--spring) 0.25s both;
}

.count-chip strong {
  display: inline-block;
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
  animation: number-in 0.7s var(--ease) 0.45s both;
}

.header-button {
  position: relative;
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
  animation: pop-in 0.55s var(--spring) 0.33s both;
}

.header-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
  transform: translateY(-2px);
}

/* refresh in progress: a small spinner replaces the hover state */
.header-button:disabled {
  padding-right: 38px;
}

.header-button:disabled::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 13px;
  width: 14px;
  height: 14px;
  margin-top: -7px;
  border: 2px solid rgb(255 255 255 / 35%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ================= Panels ================= */
.panel {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.muted {
  color: var(--muted);
  font-size: 14px;
}

.loading {
  text-align: center;
  animation: breathe 1.4s ease-in-out infinite;
}

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

/* ================= Add / edit form: opens like a drawer ================= */
.form-panel {
  position: relative;
  display: grid;
  gap: 18px;
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

.form-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.form-heading h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
}

.form-heading p {
  margin: 5px 0 0;
}

.class-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

/* fields appear one after another */
.class-form > * {
  animation: rise 0.5s var(--ease) both;
}

.class-form > :nth-child(1) { animation-delay: 0.15s; }
.class-form > :nth-child(2) { animation-delay: 0.2s; }
.class-form > :nth-child(3) { animation-delay: 0.25s; }
.class-form > :nth-child(4) { animation-delay: 0.3s; }
.class-form > :nth-child(5) { animation-delay: 0.35s; }
.class-form > :nth-child(6) { animation-delay: 0.4s; }
.class-form > :nth-child(7) { animation-delay: 0.45s; }
.class-form > :nth-child(8) { animation-delay: 0.5s; }
.class-form > :nth-child(n + 9) { animation-delay: 0.55s; }

.class-form label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.class-form label:has(input:focus, select:focus) {
  color: var(--blue);
}

/* the required star pulses gently */
.class-form label em {
  display: inline-block;
  color: var(--danger);
  font-style: normal;
  animation: star-pulse 2.4s ease-in-out infinite;
}

.class-form input,
.class-form select {
  width: 100%;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
}

.class-form input:hover,
.class-form select:hover {
  border-color: #b6c8de;
}

.class-form input:focus,
.class-form select:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 20px -14px rgb(38 95 148 / 55%);
  transform: translateY(-1px);
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  grid-column: 1 / -1;
  padding-top: 14px;
  border-top: 1px dashed var(--line);
}

/* ================= Filters ================= */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px;
  animation: rise 0.6s var(--ease) 0.1s both;
}

.search-field {
  flex: 1;
  min-width: 240px;
}

.filters input,
.filters select {
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
}

.filters input {
  width: 100%;
}

.filters input:hover,
.filters select:hover {
  border-color: #b6c8de;
}

.filters input:focus,
.filters select:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 20px -14px rgb(38 95 148 / 55%);
  transform: translateY(-1px);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ================= Class cards: dealt in like timetable slots ================= */
.class-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 18px;
}

.class-card {
  display: grid;
  gap: 18px;
  align-content: start;
  border-left: 4px solid var(--blue);
  animation: deal-in 0.65s var(--spring) both;
  transition: transform 0.3s var(--ease), box-shadow 0.3s ease, border-left-width 0.25s ease;
}

.class-grid > .class-card:nth-child(1) { animation-delay: 0.15s; }
.class-grid > .class-card:nth-child(2) { animation-delay: 0.23s; }
.class-grid > .class-card:nth-child(3) { animation-delay: 0.31s; }
.class-grid > .class-card:nth-child(4) { animation-delay: 0.39s; }
.class-grid > .class-card:nth-child(5) { animation-delay: 0.47s; }
.class-grid > .class-card:nth-child(6) { animation-delay: 0.55s; }
.class-grid > .class-card:nth-child(n + 7) { animation-delay: 0.63s; }

.class-card.upcoming {
  border-left-color: var(--warn);
}

.class-card.completed {
  border-left-color: #9aa9bb;
}

.class-card:hover {
  transform: translateY(-6px);
  border-left-width: 7px;
  box-shadow: 0 24px 38px -22px rgb(17 44 73 / 60%);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.program {
  margin: 0 0 4px;
  color: var(--blue);
  font-size: 12.5px;
  font-weight: 700;
}

.card-heading h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  transition: color 0.2s ease;
}

.class-card:hover .card-heading h2 {
  color: var(--blue);
}

/* status pills: a live class has a pulsing dot */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: none;
  padding: 5px 12px 5px 10px;
  border-radius: 999px;
  background: #e3f4ea;
  color: #1f6b41;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: capitalize;
  animation: pop-in 0.45s var(--spring) 0.3s both;
}

.status-pill::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: ping-green 2.2s ease-out 1s infinite;
}

.status-pill.upcoming {
  background: #fbf0d3;
  color: #8a5d00;
}

/* upcoming classes pulse amber, a softer "starting soon" signal */
.status-pill.upcoming::before {
  animation: ping-amber 2.6s ease-out 1s infinite;
}

.status-pill.completed {
  background: #e8edf4;
  color: #4b5d73;
}

.status-pill.completed::before {
  animation: none;
}

/* details as a label / value list */
.class-meta {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f6f9fd;
  font-size: 13.5px;
  transition: background 0.25s ease;
}

.class-card:hover .class-meta {
  background: #eef5fd;
}

.class-meta div {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 10px;
}

.class-meta dt {
  color: var(--muted);
  font-weight: 600;
}

.class-meta dd {
  margin: 0;
  color: var(--text);
}

/* today's attendance: the gauge fills when the card appears */
.today-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 13px;
}

.today-head strong {
  color: var(--navy-deep);
}

.bar {
  position: relative;
  height: 10px;
  border-radius: 8px;
  background: #e8eef7;
  overflow: hidden;
}

.bar i {
  position: relative;
  display: block;
  height: 100%;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--sky), var(--blue));
  transform-origin: left;
  animation: gauge-fill 1s var(--ease) 0.6s both;
  transition: width 0.3s ease;
}

/* a highlight runs along the filled part every few seconds */
.bar i::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -40%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 55%), transparent);
  animation: bar-shine 3.4s ease-in-out 1.8s infinite;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stats div {
  padding: 10px 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  text-align: center;
  transition: transform 0.3s var(--spring), border-color 0.25s ease, box-shadow 0.25s ease;
}

.stats div:hover {
  border-color: var(--sky);
  box-shadow: 0 12px 20px -16px rgb(38 95 148 / 55%);
  transform: translateY(-3px);
}

.stats strong,
.stats span {
  display: block;
}

.stats strong {
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
  animation: number-in 0.7s var(--ease) 0.5s both;
}

.stats span {
  color: var(--muted);
  font-size: 11.5px;
}

/* ================= Buttons ================= */
.actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}

.actions .primary-button {
  grid-column: 1 / -1;
}

.primary-button,
.secondary-button,
.danger-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 9px 14px;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
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

.danger-button {
  background: #fdebeb;
  color: var(--danger);
}

/* delete warns before you click: the button trembles once on hover */
.danger-button:hover:not(:disabled) {
  background: #f9d3d3;
  animation: tremble 0.35s ease 1;
}

.primary-button:active,
.secondary-button:active:not(:disabled),
.danger-button:active:not(:disabled) {
  transform: scale(0.97);
}

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

.secondary-button:disabled,
.danger-button:disabled,
.primary-button:disabled {
  opacity: 0.65;
  cursor: wait;
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
.danger-button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

/* ================= Empty state ================= */
.empty-state {
  padding: 44px;
  text-align: center;
  background:
    radial-gradient(rgb(17 44 73 / 6%) 1px, transparent 1px) 0 0 / 16px 16px,
    #fff;
  animation: rise 0.6s var(--ease) 0.2s both;
}

/* an empty calendar tile that gently bobs */
.empty-state::before {
  content: '';
  display: block;
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border: 2px solid #b6c8de;
  border-radius: 10px;
  background:
    linear-gradient(var(--sky), var(--sky)) 0 0 / 100% 14px no-repeat,
    repeating-linear-gradient(90deg, #d6e2f0 0 8px, transparent 8px 14px) 8px 26px / 40px 4px no-repeat,
    repeating-linear-gradient(90deg, #d6e2f0 0 8px, transparent 8px 14px) 8px 38px / 28px 4px no-repeat,
    #fff;
  animation: bob 3s ease-in-out infinite;
}

.empty-state h2 {
  margin: 0 0 6px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
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

/* each card is dealt in with a slight tilt, like a timetable slot dropping into place */
@keyframes deal-in {
  0% {
    opacity: 0;
    transform: translateY(26px) rotate(-1.6deg) scale(0.95);
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

@keyframes number-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes gauge-fill {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@keyframes bar-shine {
  0%,
  60% {
    left: -40%;
  }
  100% {
    left: 130%;
  }
}

@keyframes hours-drift {
  from {
    background-position: 0 0, 0 0;
  }
  to {
    background-position: 48px 0, 0 26px;
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
@media (max-width: 600px) {
  .page-header {
    display: grid;
    align-items: flex-start;
    padding: 22px 20px;
  }

  .page-header::after {
    display: none;
  }

  .page-header h1 {
    font-size: 26px;
  }

  .heading-side {
    justify-content: space-between;
  }

  .class-grid {
    grid-template-columns: 1fr;
  }

  .actions {
    grid-template-columns: 1fr;
  }

  .class-form {
    grid-template-columns: 1fr;
  }

  .form-actions {
    grid-column: auto;
  }

  .stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .panel {
    padding: 16px;
  }
}

@media (max-width: 850px) {
  .class-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page-header,
  .page-header::after,
  .page-header h1,
  .lead,
  .count-chip,
  .count-chip strong,
  .header-button,
  .header-button:disabled::after,
  .loading,
  .inline-error,
  .form-panel,
  .form-panel::before,
  .class-form > *,
  .class-form label em,
  .filters,
  .class-card,
  .status-pill,
  .status-pill::before,
  .bar i,
  .bar i::after,
  .stats strong,
  .danger-button:hover:not(:disabled),
  .primary-button:disabled::after,
  .empty-state,
  .empty-state::before {
    animation: none;
  }

  .class-form label,
  .class-form input,
  .class-form select,
  .filters input,
  .filters select,
  .class-card,
  .card-heading h2,
  .class-meta,
  .stats div,
  .primary-button,
  .primary-button::before,
  .secondary-button,
  .danger-button {
    transition: none;
  }
}
</style>
