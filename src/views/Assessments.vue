<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { apiGet, apiPost, getSession } from '../services/api'

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
interface TimedAssessment {
  timed_assessment_id: number
  class_id: number
  assessment_title: string
  assessment_type: string
  description: string | null
  instructions: string
  start_at: string
  scheduled_end_at: string
  deadline_at: string
  duration_minutes: number
  allow_late_submission: number
  status: 'draft' | 'published' | 'closed'
  class_name: string
  instructor_name: string
  assigned_count: number
  effective_deadline?: string
  submission_status?: 'on_time' | 'late' | 'not_submitted' | 'pending' | 'excused'
  submission_id?: number | null
  submitted_at?: string | null
  submitted_score?: string | null
  result_text?: string | null
  is_excused?: number
  excuse_reason?: string | null
}
interface MonitoringRow {
  timed_assessment_id: number
  assessment_title: string
  assessment_type: string
  instructor_name: string
  class_name: string
  trainee_id: number
  trainee_name: string
  trainee_number: string
  effective_deadline: string
  submitted_at: string | null
  submission_status: 'on_time' | 'late' | 'not_submitted' | 'pending' | 'excused'
  submitted_score: string | null
  result_text: string | null
  is_excused: number
}
interface TimedData {
  role: string
  server_time: string
  assessments: TimedAssessment[]
  classes?: Choice[]
  trainees?: Choice[]
  instructors?: Choice[]
  notifications: { notification_id: number; message: string; created_at: string }[]
  monitoring?: MonitoringRow[]
  statistics?: {
    assigned: number
    on_time: number
    late: number
    not_submitted: number
    pending: number
    excused: number
    compliance_percentage: number
  }
}

const records = ref<Assessment[]>([])
const trainees = ref<Choice[]>([])
const classes = ref<Choice[]>([])
const editingId = ref<number | null>(null)
const timedAssessmentId = ref<number | null>(null)
const role = ref('')
const timedAssessments = ref<TimedAssessment[]>([])
const monitoring = ref<MonitoringRow[]>([])
const instructors = ref<Choice[]>([])
const notifications = ref<TimedData['notifications']>([])
const selectedAssessmentId = ref('')
const monitorClassId = ref('')
const monitorInstructorId = ref('')
const monitorStatus = ref('')
const monitorDate = ref('')
const monitorSearch = ref('')
const stats = ref<TimedData['statistics']>({
  assigned: 0, on_time: 0, late: 0, not_submitted: 0, pending: 0, excused: 0, compliance_percentage: 0
})
const formError = ref('')
const serverTime = ref(0)
let serverClockAtSync = 0
let countdownTimer: ReturnType<typeof setInterval> | undefined
let refreshTimer: ReturnType<typeof setInterval> | undefined
const timedForm = ref({
  class_id: '',
  assessment_title: '',
  assessment_type: 'quiz',
  description: '',
  instructions: '',
  start_at: localDateTimeInput(new Date()),
  scheduled_end_at: localDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
  duration_minutes: '60',
  allow_late_submission: false
})
const submissions = ref<Record<number, { score: string; result_text: string }>>({})
const form = ref({ trainee_id: '', class_id: '', assessment_name: '', outcome: 'pass', assessment_date: new Date().toISOString().slice(0, 10), notes: '', time_limit_minutes: '' })
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')

function localDateTimeInput(value: Date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(value)
  return parts.replace(' ', 'T')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const session = await getSession()
    role.value = session.user?.role || ''
    await loadTimed()
    if (role.value !== 'trainee') {
      const response = await apiGet<AssessmentData>('/modules/assessments')
      records.value = response.data.records || []
      trainees.value = response.data.assessment_options?.trainees || []
      if (!classes.value.length) classes.value = response.data.assessment_options?.classes || []
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load assessments.'
  } finally {
    loading.value = false
  }
}

function monitoringQuery() {
  const query = new URLSearchParams()
  if (selectedAssessmentId.value) query.set('timed_assessment_id', selectedAssessmentId.value)
  if (monitorClassId.value) query.set('class_id', monitorClassId.value)
  if (monitorInstructorId.value) query.set('instructor_id', monitorInstructorId.value)
  if (monitorStatus.value) query.set('submission_status', monitorStatus.value)
  if (monitorDate.value) query.set('assessment_date', monitorDate.value)
  if (monitorSearch.value.trim()) query.set('search', monitorSearch.value.trim())
  return query
}

async function loadTimed(showLoading = false) {
  if (showLoading) loading.value = true
  const query = monitoringQuery()
  try {
    const response = await apiGet<TimedData>(`/assessments/timed${query.size ? `?${query}` : ''}`)
    const data = response.data
    role.value = data.role || role.value
    serverTime.value = Date.parse(data.server_time)
    serverClockAtSync = performance.now()
    timedAssessments.value = data.assessments || []
    for (const item of timedAssessments.value) {
      if (!submissions.value[item.timed_assessment_id]) {
        submissions.value[item.timed_assessment_id] = { score: '', result_text: '' }
      }
    }
    notifications.value = data.notifications || []
    if (role.value !== 'trainee') {
      classes.value = data.classes || classes.value
      trainees.value = data.trainees || trainees.value
      instructors.value = data.instructors || []
      monitoring.value = data.monitoring || []
      stats.value = data.statistics || stats.value
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load timed assessments.'
  } finally {
    if (showLoading) loading.value = false
  }
}

function resetTimedForm() {
  timedAssessmentId.value = null
  timedForm.value = {
    class_id: '',
    assessment_title: '',
    assessment_type: 'quiz',
    description: '',
    instructions: '',
    start_at: localDateTimeInput(new Date()),
    scheduled_end_at: localDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
    duration_minutes: '60',
    allow_late_submission: false
  }
}

function editTimed(item: TimedAssessment) {
  timedAssessmentId.value = item.timed_assessment_id
  timedForm.value = {
    class_id: String(item.class_id),
    assessment_title: item.assessment_title,
    assessment_type: item.assessment_type,
    description: item.description || '',
    instructions: item.instructions,
    start_at: localDateTimeInput(new Date(item.start_at)),
    scheduled_end_at: localDateTimeInput(new Date(item.scheduled_end_at)),
    duration_minutes: String(item.duration_minutes),
    allow_late_submission: Boolean(item.allow_late_submission)
  }
  formError.value = ''
}

async function saveTimed() {
  saving.value = true
  formError.value = ''
  try {
    await apiPost('/assessments/timed/save', {
      timed_assessment_id: timedAssessmentId.value || '',
      ...timedForm.value
    })
    notice.value = timedAssessmentId.value ? 'Timed assessment updated.' : 'Timed assessment saved as a draft.'
    resetTimedForm()
    await loadTimed()
  } catch (reason) {
    formError.value = reason instanceof Error ? reason.message : 'Unable to save the timed assessment.'
  } finally {
    saving.value = false
  }
}

async function publishTimed(item: TimedAssessment) {
  if (!window.confirm(`Publish "${item.assessment_title}" to all currently enrolled trainees in ${item.class_name}?`)) return
  try {
    await apiPost(`/assessments/timed/${item.timed_assessment_id}/publish`, {})
    notice.value = 'Assessment published and assigned to the class roster.'
    await loadTimed()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to publish assessment.'
  }
}

async function closeTimed(item: TimedAssessment) {
  if (!window.confirm(`Close "${item.assessment_title}" now? Trainees will no longer be able to submit.`)) return
  try {
    await apiPost(`/assessments/timed/${item.timed_assessment_id}/close`, {})
    notice.value = 'Assessment closed.'
    await loadTimed()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to close assessment.'
  }
}

async function submitTimed(item: TimedAssessment) {
  const submission = submissions.value[item.timed_assessment_id] || { score: '', result_text: '' }
  try {
    await apiPost(`/assessments/timed/${item.timed_assessment_id}/submit`, submission)
    notice.value = 'Your submission was recorded using the server timestamp.'
    await loadTimed()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to submit assessment.'
  }
}

async function manageRecipient(row: MonitoringRow, action: 'extend' | 'excuse') {
  const reason = window.prompt(action === 'extend' ? 'Reason for deadline extension:' : 'Reason for exemption:')
  if (!reason?.trim()) return
  const body: Record<string, string> = { action, reason: reason.trim() }
  if (action === 'extend') {
    const defaultDeadline = localDateTimeInput(new Date(row.effective_deadline))
    const deadline = window.prompt('New deadline (Manila time, YYYY-MM-DDTHH:mm):', defaultDeadline)
    if (!deadline) return
    body.extended_deadline = deadline
  }
  try {
    await apiPost(`/assessments/timed/${row.timed_assessment_id}/recipient/${row.trainee_id}`, body)
    notice.value = action === 'extend' ? 'Deadline extension approved.' : 'Trainee marked excused.'
    await loadTimed()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to update trainee status.'
  }
}

function currentServerTime() {
  return serverTime.value + (performance.now() - serverClockAtSync)
}

function remainingSeconds(item: TimedAssessment & { effective_deadline?: string }) {
  const deadline = item.effective_deadline || item.deadline_at
  return Math.max(0, Math.ceil((Date.parse(deadline) - currentServerTime()) / 1000))
}

function startSeconds(item: TimedAssessment) {
  return Math.max(0, Math.ceil((Date.parse(item.start_at) - currentServerTime()) / 1000))
}

function hasStarted(item: TimedAssessment) {
  return startSeconds(item) === 0
}

function formatRemaining(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'
  }).format(new Date(value))
}

function deadlinePreview() {
  const start = new Date(`${timedForm.value.start_at}:00+08:00`)
  const end = new Date(`${timedForm.value.scheduled_end_at}:00+08:00`)
  const duration = Number(timedForm.value.duration_minutes)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || duration < 1) return 'Choose a valid schedule and duration.'
  return formatDate(new Date(Math.min(end.getTime(), start.getTime() + duration * 60_000)).toISOString())
}

async function exportReport(format: 'csv' | 'excel' | 'pdf') {
  try {
    const query = monitoringQuery()
    query.set('format', format)
    const response = await apiGet<{ filename: string; content_type: string; content_base64: string }>(
      `/assessments/timed/report?${query}`
    )
    const binary = atob(response.data.content_base64)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const blob = new Blob([bytes], { type: response.data.content_type })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = response.data.filename
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to export compliance report.'
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
onMounted(() => {
  countdownTimer = setInterval(() => {
    serverTime.value = currentServerTime()
    serverClockAtSync = performance.now()
  }, 1000)
  refreshTimer = setInterval(() => { void loadTimed() }, 30_000)
})
onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">SMARTTRACK / ACADEMIC RECORDS</p>
        <h1>Assessments</h1>
        <p class="muted">Timed assessment schedules, trainee submissions, and class compliance.</p>
      </div>
      <button class="secondary-button" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="inline-success" role="status">{{ notice }}</p>

    <section v-if="notifications.length" class="panel notification-panel" aria-label="Assessment notifications">
      <h2>Assessment notifications</h2>
      <ul>
        <li v-for="item in notifications.slice(0, 5)" :key="item.notification_id">{{ item.message }}</li>
      </ul>
    </section>

    <template v-if="role === 'trainee'">
      <section class="panel">
        <div class="section-heading">
          <div><h2>My assigned assessments</h2><p class="muted">Deadlines are checked against SmartTrack server time.</p></div>
        </div>
        <p v-if="loading" class="muted">Loading assessments…</p>
        <p v-else-if="!timedAssessments.length" class="empty">No timed assessments have been assigned to your classes.</p>
        <div v-else class="trainee-assessments">
          <article v-for="item in timedAssessments" :key="item.timed_assessment_id" class="timed-card">
            <div class="timed-card-heading">
              <div>
                <p class="eyebrow">{{ item.assessment_type.replace('_', ' ') }} · {{ item.class_name }}</p>
                <h3>{{ item.assessment_title }}</h3>
                <p class="muted">Instructor: {{ item.instructor_name || 'Not assigned' }}</p>
              </div>
              <span class="status-pill" :class="item.submission_status || 'pending'">{{ (item.submission_status || 'pending').replace('_', ' ') }}</span>
            </div>
            <p v-if="item.description" class="description">{{ item.description }}</p>
            <div class="assessment-details">
              <p><strong>Instructions</strong><span>{{ item.instructions }}</span></p>
              <p><strong>Starts</strong><span>{{ formatDate(item.start_at) }}</span></p>
              <p><strong>Deadline</strong><span>{{ formatDate(item.effective_deadline || item.deadline_at) }}</span></p>
              <p><strong>Duration</strong><span>{{ item.duration_minutes }} minutes</span></p>
              <p v-if="item.submitted_at"><strong>Submitted</strong><span>{{ formatDate(item.submitted_at) }}</span></p>
            </div>
            <p v-if="item.submission_status === 'pending' && !hasStarted(item)" class="countdown">
              Opens in: <strong>{{ formatRemaining(startSeconds(item)) }}</strong>
            </p>
            <p v-else-if="item.submission_status === 'pending'" class="countdown" :class="{ urgent: remainingSeconds(item) <= 60, warning: remainingSeconds(item) > 60 && remainingSeconds(item) <= 300 }">
              Remaining time: <strong>{{ formatRemaining(remainingSeconds(item)) }}</strong>
              <span v-if="remainingSeconds(item) <= 60"> — deadline is imminent</span>
              <span v-else-if="remainingSeconds(item) <= 300"> — 5 minutes or less remain</span>
            </p>
            <p v-if="item.submission_status === 'not_submitted'" class="inline-error">
              The submission period has ended without a submission.
              <span v-if="item.allow_late_submission"> Late submissions are still accepted.</span>
            </p>
            <p v-if="item.submission_status === 'excused'" class="inline-success">
              You are excused<span v-if="item.excuse_reason">: {{ item.excuse_reason }}</span>.
            </p>
            <div v-if="item.submission_id" class="submitted-result">
              <strong>Submission recorded</strong>
              <span v-if="item.submitted_score !== null">Score: {{ item.submitted_score }}</span>
              <span v-if="item.result_text">{{ item.result_text }}</span>
            </div>
            <form
              v-else-if="item.status === 'published' && hasStarted(item) && !item.is_excused
                && (item.submission_status === 'pending' || (item.submission_status === 'not_submitted' && item.allow_late_submission))"
              class="form-grid submission-form"
              @submit.prevent="submitTimed(item)"
            >
              <label>Score (optional, 0–100)
                <input v-model="submissions[item.timed_assessment_id]!.score" type="number" min="0" max="100" step="0.01">
              </label>
              <label class="wide">Assessment result
                <textarea v-model="submissions[item.timed_assessment_id]!.result_text" rows="3" maxlength="5000" placeholder="Enter your result or response"></textarea>
              </label>
              <div class="actions wide">
                <button class="primary-button" type="submit">Submit assessment</button>
              </div>
            </form>
          </article>
        </div>
      </section>
    </template>

    <template v-else>
      <section v-if="role === 'administrator' || role === 'staff' || role === 'instructor'" class="panel">
        <div class="section-heading">
          <div>
            <h2>{{ timedAssessmentId ? 'Edit timed assessment draft' : 'Create timed assessment' }}</h2>
            <p class="muted">Publishing snapshots the class roster. Schedule and duration are locked after publishing.</p>
          </div>
        </div>
        <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
        <form class="form-grid" @submit.prevent="saveTimed">
          <label>Class or group
            <select v-model="timedForm.class_id" required>
              <option value="" disabled>Select class</option>
              <option v-for="item in classes" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
            </select>
          </label>
          <label>Assessment title
            <input v-model.trim="timedForm.assessment_title" maxlength="150" required>
          </label>
          <label>Assessment type
            <select v-model="timedForm.assessment_type" required>
              <option value="quiz">Quiz</option>
              <option value="examination">Examination</option>
              <option value="class_assessment">Class Assessment</option>
            </select>
          </label>
          <label>Assessment date and start time
            <input v-model="timedForm.start_at" type="datetime-local" required>
          </label>
          <label>Scheduled end / deadline
            <input v-model="timedForm.scheduled_end_at" type="datetime-local" required>
          </label>
          <label>Allowed duration (minutes)
            <input v-model="timedForm.duration_minutes" type="number" min="1" max="1440" required>
          </label>
          <p class="wide deadline-preview">Calculated submission deadline: <strong>{{ deadlinePreview() }}</strong></p>
          <label class="checkbox-label">
            <input v-model="timedForm.allow_late_submission" type="checkbox">
            Allow late submissions (marked LATE)
          </label>
          <label class="wide">Description
            <textarea v-model.trim="timedForm.description" rows="2" maxlength="5000"></textarea>
          </label>
          <label class="wide">Instructions for trainees
            <textarea v-model.trim="timedForm.instructions" rows="3" maxlength="5000" required></textarea>
          </label>
          <div class="actions wide">
            <button class="primary-button" type="submit" :disabled="saving">{{ saving ? 'Saving…' : timedAssessmentId ? 'Save draft changes' : 'Save as draft' }}</button>
            <button v-if="timedAssessmentId" class="secondary-button" type="button" @click="resetTimedForm">Cancel edit</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="section-heading">
          <div><h2>Assessment schedule</h2><p class="muted">{{ timedAssessments.length }} assessments</p></div>
        </div>
        <p v-if="loading" class="muted">Loading assessments…</p>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>Assessment</th><th>Class</th><th>Instructor</th><th>Schedule / deadline</th><th>Duration</th><th>Assigned</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="item in timedAssessments" :key="item.timed_assessment_id">
                <td>{{ item.assessment_title }}<small>{{ item.assessment_type.replace('_', ' ') }}</small></td>
                <td>{{ item.class_name }}</td>
                <td>{{ item.instructor_name }}</td>
                <td>{{ formatDate(item.start_at) }}<small>Deadline: {{ formatDate(item.deadline_at) }}</small></td>
                <td>{{ item.duration_minutes }} min</td>
                <td>{{ item.assigned_count }}</td>
                <td><span class="status-pill" :class="item.status">{{ item.status }}</span></td>
                <td class="actions">
                  <button v-if="item.status === 'draft'" class="text-button" @click="editTimed(item)">Edit</button>
                  <button v-if="item.status === 'draft'" class="text-button" @click="publishTimed(item)">Publish</button>
                  <button v-if="item.status === 'published'" class="text-button danger" @click="closeTimed(item)">Close</button>
                </td>
              </tr>
              <tr v-if="!timedAssessments.length"><td colspan="8" class="empty">No timed assessments created or assigned yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="role === 'administrator' || role === 'staff' || role === 'instructor'" class="panel">
        <div class="section-heading">
          <div><h2>Assessment compliance monitoring</h2><p class="muted">Statuses and deadlines are calculated using server time.</p></div>
          <div class="actions export-actions">
            <button class="secondary-button" @click="exportReport('excel')">Excel / CSV</button>
            <button class="secondary-button" @click="exportReport('pdf')">PDF</button>
          </div>
        </div>
        <div class="filter-grid">
          <label>Assessment
            <select v-model="selectedAssessmentId" @change="loadTimed(true)">
              <option value="">All assessments</option>
              <option v-for="item in timedAssessments" :key="item.timed_assessment_id" :value="String(item.timed_assessment_id)">{{ item.assessment_title }}</option>
            </select>
          </label>
          <label>Class / group
            <select v-model="monitorClassId" @change="loadTimed(true)">
              <option value="">All classes</option>
              <option v-for="item in classes" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
            </select>
          </label>
          <label v-if="role !== 'instructor'">Instructor
            <select v-model="monitorInstructorId" @change="loadTimed(true)">
              <option value="">All instructors</option>
              <option v-for="item in instructors" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
            </select>
          </label>
          <label>Trainee or title search
            <input v-model.trim="monitorSearch" type="search" placeholder="Search names or assessment">
          </label>
          <label>Status
            <select v-model="monitorStatus" @change="loadTimed(true)">
              <option value="">All statuses</option>
              <option value="on_time">On time</option><option value="late">Late</option>
              <option value="not_submitted">Not submitted</option><option value="pending">Pending</option>
              <option value="excused">Excused</option>
            </select>
          </label>
          <label>Assessment date<input v-model="monitorDate" type="date" @change="loadTimed(true)"></label>
          <button class="secondary-button filter-button" @click="loadTimed(true)">Apply filters</button>
        </div>
        <div class="stat-grid">
          <article><span>Assigned trainees</span><strong>{{ stats?.assigned || 0 }}</strong></article>
          <article><span>On time</span><strong>{{ stats?.on_time || 0 }}</strong></article>
          <article><span>Late</span><strong>{{ stats?.late || 0 }}</strong></article>
          <article><span>Not submitted</span><strong>{{ stats?.not_submitted || 0 }}</strong></article>
          <article><span>Pending</span><strong>{{ stats?.pending || 0 }}</strong></article>
          <article><span>Excused</span><strong>{{ stats?.excused || 0 }}</strong></article>
          <article><span>Compliance</span><strong>{{ stats?.compliance_percentage || 0 }}%</strong></article>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Trainee</th><th>Assessment</th><th>Instructor / class</th><th>Deadline</th><th>Submission time</th><th>Status</th><th>Score / result</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="row in monitoring" :key="`${row.timed_assessment_id}-${row.trainee_id}`">
                <td>{{ row.trainee_name }}<small>{{ row.trainee_number }}</small></td>
                <td>{{ row.assessment_title }}<small>{{ row.assessment_type.replace('_', ' ') }}</small></td>
                <td>{{ row.instructor_name }}<small>{{ row.class_name }}</small></td>
                <td>{{ formatDate(row.effective_deadline) }}</td>
                <td>{{ formatDate(row.submitted_at) }}</td>
                <td><span class="status-pill" :class="row.submission_status">{{ row.submission_status.replace('_', ' ') }}</span></td>
                <td>{{ row.submitted_score ?? '—' }}<small v-if="row.result_text">{{ row.result_text }}</small></td>
                <td class="actions">
                  <button v-if="row.submission_status !== 'excused'" class="text-button" @click="manageRecipient(row, 'extend')">Extend</button>
                  <button v-if="row.submission_status !== 'excused'" class="text-button danger" @click="manageRecipient(row, 'excuse')">Excuse</button>
                </td>
              </tr>
              <tr v-if="!monitoring.length"><td colspan="8" class="empty">Choose an assessment or adjust filters to view assigned trainees.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <details class="panel legacy-panel">
        <summary>Existing assessment outcome records (Pass / Fail)</summary>
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
          <label>Outcome<select v-model="form.outcome" required><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
          <label>Assessment date<input v-model="form.assessment_date" type="date" required></label>
          <label>Time limit (minutes)<input v-model.trim="form.time_limit_minutes" type="number" min="1" max="1440" placeholder="Optional"></label>
          <label class="wide">Notes<textarea v-model.trim="form.notes" maxlength="2000" rows="3"></textarea></label>
          <div class="actions wide">
            <button class="primary-button" type="submit" :disabled="saving">{{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Record result' }}</button>
            <button v-if="editingId" class="secondary-button" type="button" @click="resetForm">Cancel edit</button>
          </div>
        </form>
        <div class="table-wrap">
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
              <tr v-if="!records.length"><td colspan="9" class="empty">No assessment outcome records found.</td></tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
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

.notification-panel ul {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding-left: 20px;
  color: var(--navy-deep);
}

.trainee-assessments {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.timed-card {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: linear-gradient(145deg, #fff, #f8fbff);
}

.timed-card-heading,
.assessment-details {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.timed-card-heading h3 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
}

.timed-card-heading .muted {
  margin: 6px 0 0;
}

.assessment-details {
  flex-wrap: wrap;
  justify-content: flex-start;
  margin: 16px 0;
}

.assessment-details p {
  display: grid;
  gap: 4px;
  min-width: min(230px, 100%);
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.assessment-details strong {
  color: var(--navy-deep);
}

.description {
  margin: 14px 0 0;
  color: var(--text);
}

.countdown {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #e7f2fc;
  color: var(--navy);
}

.countdown.warning {
  background: #fff3d8;
  color: #825a00;
}

.countdown.urgent {
  background: #fdeceb;
  color: var(--danger);
  animation: countdown-pulse 1s ease-in-out infinite alternate;
}

.submitted-result {
  display: grid;
  gap: 6px;
  padding: 12px;
  border-radius: 8px;
  background: #e3f4ea;
  color: #1f6b41;
}

.submission-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 10px !important;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
}

.deadline-preview {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: #edf4fc;
  color: var(--navy-deep);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.filter-grid label {
  display: grid;
  gap: 6px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
}

.filter-grid input,
.filter-grid select {
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
}

.filter-button {
  align-self: end;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.stat-grid article {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f8fbff;
}

.stat-grid span {
  color: var(--muted);
  font-size: 12px;
}

.stat-grid strong {
  color: var(--navy-deep);
  font-size: 22px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 9px;
  border-radius: 999px;
  background: #edf1f7;
  color: #475569;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  white-space: nowrap;
}

.status-pill.published,
.status-pill.on_time {
  background: #e3f4ea;
  color: #1f6b41;
}

.status-pill.pending {
  background: #e7f2fc;
  color: #265f94;
}

.status-pill.late,
.status-pill.not_submitted {
  background: #fdeceb;
  color: var(--danger);
}

.status-pill.excused {
  background: #f1eafd;
  color: #6941a5;
}

.legacy-panel summary {
  color: var(--navy-deep);
  font-weight: 700;
  cursor: pointer;
}

.export-actions {
  flex-wrap: wrap;
}

@keyframes countdown-pulse {
  from { box-shadow: 0 0 0 0 rgb(180 40 31 / 0%); }
  to { box-shadow: 0 0 0 4px rgb(180 40 31 / 12%); }
}

/* ---------- Responsive ---------- */
@media (max-width: 850px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .timed-card-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-grid,
  .submission-form {
    grid-template-columns: 1fr;
  }

  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .section-heading {
    flex-direction: column;
  }

  .export-actions {
    width: 100%;
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