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
const form = ref({ trainee_id: '', class_id: '', assessment_name: '', outcome: 'pass', assessment_date: new Date().toISOString().slice(0, 10), notes: '' })
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
    assessment_date: item.assessment_date, notes: item.notes || ''
  }
  notice.value = ''
}

function resetForm() {
  editingId.value = null
  form.value = {
    trainee_id: '', class_id: '', assessment_name: '', outcome: 'pass',
    assessment_date: new Date().toISOString().slice(0, 10), notes: ''
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
      <div class="tr-heading-main">
        <span class="tr-heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1z"/><path d="M8 6H6a1 1 0 00-1 1v13a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-1-1h-2"/><path d="M9 13l2 2 4-4.5"/></svg>
        </span>
        <div>
          <p class="eyebrow">SMARTTRACK / ACADEMIC RECORDS</p>
          <h1>Assessments</h1>
          <p class="muted">Timed assessment schedules, trainee submissions, and class compliance.</p>
        </div>
      </div>
      <button class="secondary-button tr-refresh" :disabled="loading" @click="load">
        <svg :class="{ spinning: loading }" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 11-2.6-5.9"/><path d="M20 4v5h-5"/></svg>
        {{ loading ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>
 
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="inline-success" role="status">{{ notice }}</p>
 
    <section v-if="notifications.length" class="panel tr-notifications" aria-label="Assessment notifications">
      <h2>
        <span class="tr-bell" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 004 0"/></svg></span>
        Assessment notifications
      </h2>
      <ul>
        <li v-for="item in notifications.slice(0, 5)" :key="item.notification_id">{{ item.message }}</li>
      </ul>
    </section>
 
    <template v-if="role === 'trainee'">
      <!-- 1. Summary strip -->
      <section class="tr-summary" aria-label="Assessment summary">
        <article>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <div><strong>{{ timedAssessments.filter(i => i.submission_status === 'pending').length }}</strong><span>To do</span></div>
        </article>
        <article class="ok">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>
          <div><strong>{{ timedAssessments.filter(i => i.submission_id).length }}</strong><span>Submitted</span></div>
        </article>
        <article class="bad">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>
          <div><strong>{{ timedAssessments.filter(i => i.submission_status === 'not_submitted').length }}</strong><span>Missed</span></div>
        </article>
      </section>
 
      <!-- 2. Assessment list -->
      <section class="panel tr-list-panel">
        <div class="section-heading">
          <div>
            <h2>My assigned assessments</h2>
            <p class="muted tr-server-note">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 118 0v3"/></svg>
              Deadlines are checked against SmartTrack server time.
            </p>
          </div>
        </div>
 
        <div v-if="loading" class="tr-skeletons" aria-label="Loading assessments">
          <span v-for="n in 2" :key="n" class="tr-skeleton"></span>
        </div>
 
        <div v-else-if="!timedAssessments.length" class="tr-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1z"/><path d="M8 6H6a1 1 0 00-1 1v13a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-1-1h-2"/></svg>
          <p>No timed assessments have been assigned to your classes.</p>
        </div>
 
        <div v-else class="tr-cards">
          <article
            v-for="(item, index) in timedAssessments"
            :key="item.timed_assessment_id"
            class="tr-card"
            :class="'is-' + (item.submission_status || 'pending')"
            :style="{ animationDelay: Math.min(index, 6) * 70 + 'ms' }"
          >
            <!-- Card header -->
            <div class="tr-card-head">
              <span class="tr-type-icon" aria-hidden="true">
                <svg v-if="item.assessment_type === 'quiz'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2M12 17v.5"/></svg>
                <svg v-else-if="item.assessment_type === 'examination'" viewBox="0 0 24 24"><path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10.5V15c0 1.2 2.2 3 5 3s5-1.8 5-3v-4.5"/></svg>
                <svg v-else viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>
              </span>
              <div class="tr-card-title">
                <h3>{{ item.assessment_title }}</h3>
                <ul class="tr-chips">
                  <li>{{ item.assessment_type.replace('_', ' ') }}</li>
                  <li>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/></svg>
                    {{ item.class_name }}
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/></svg>
                    {{ item.instructor_name || 'Not assigned' }}
                  </li>
                </ul>
              </div>
              <span class="tr-pill" :class="item.submission_status || 'pending'">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <template v-if="item.submission_status === 'on_time'"><path d="M5 12.5l4.5 4.5L19 7"/></template>
                  <template v-else-if="item.submission_status === 'late' || item.submission_status === 'not_submitted'"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></template>
                  <template v-else-if="item.submission_status === 'excused'"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></template>
                  <template v-else><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></template>
                </svg>
                {{ (item.submission_status || 'pending').replace('_', ' ') }}
              </span>
            </div>
 
            <p v-if="item.description" class="tr-description">{{ item.description }}</p>
 
            <!-- Timeline -->
            <div class="tr-timeline">
              <div>
                <span class="tr-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v3M17 4v3M4 9h16"/><rect x="4" y="6" width="16" height="14" rx="2"/></svg>Starts</span>
                <strong>{{ formatDate(item.start_at) }}</strong>
              </div>
              <span class="tr-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h15M14 7l5 5-5 5"/></svg></span>
              <div>
                <span class="tr-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>Deadline</span>
                <strong>{{ formatDate(item.effective_deadline || item.deadline_at) }}</strong>
              </div>
              <div>
                <span class="tr-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M12 3v3"/><circle cx="12" cy="14" r="7"/><path d="M12 10.5V14l2 1.5"/></svg>Duration</span>
                <strong>{{ item.duration_minutes }} minutes</strong>
              </div>
              <div v-if="item.submitted_at">
                <span class="tr-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>Submitted</span>
                <strong>{{ formatDate(item.submitted_at) }}</strong>
              </div>
            </div>
 
            <!-- Instructions -->
            <div class="tr-instructions">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>
              <div><strong>Instructions</strong><p>{{ item.instructions }}</p></div>
            </div>
 
            <!-- Countdown: not yet open -->
            <div v-if="item.submission_status === 'pending' && !hasStarted(item)" class="tr-countdown">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/></svg>
              <span>Opens in</span><strong>{{ formatRemaining(startSeconds(item)) }}</strong>
            </div>
 
            <!-- Countdown: in progress -->
            <div
              v-else-if="item.submission_status === 'pending'"
              class="tr-countdown running"
              :class="{ urgent: remainingSeconds(item) <= 60, warning: remainingSeconds(item) > 60 && remainingSeconds(item) <= 300 }"
            >
              <svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 3h4"/></svg>
              <span>Remaining time</span><strong>{{ formatRemaining(remainingSeconds(item)) }}</strong>
              <em v-if="remainingSeconds(item) <= 60">Deadline is imminent</em>
              <em v-else-if="remainingSeconds(item) <= 300">5 minutes or less remain</em>
              <div class="tr-bar" aria-hidden="true">
                <i :style="{ width: Math.max(0, Math.min(100, remainingSeconds(item) / (item.duration_minutes * 60) * 100)) + '%' }"></i>
              </div>
            </div>
 
            <!-- Status messages -->
            <p v-if="item.submission_status === 'not_submitted'" class="tr-note bad" role="alert">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>
              <span>The submission period has ended without a submission.<template v-if="item.allow_late_submission"> Late submissions are still accepted.</template></span>
            </p>
            <p v-if="item.submission_status === 'excused'" class="tr-note excused" role="status">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>
              <span>You are excused<template v-if="item.excuse_reason">: {{ item.excuse_reason }}</template>.</span>
            </p>
 
            <!-- Submitted result -->
            <div v-if="item.submission_id" class="tr-result">
              <span class="tr-check" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg></span>
              <div>
                <strong>Submission recorded</strong>
                <span v-if="item.submitted_score !== null" class="tr-score">Score: {{ item.submitted_score }}</span>
                <span v-if="item.result_text">{{ item.result_text }}</span>
              </div>
            </div>
 
            <!-- Submission form -->
            <form
              v-else-if="item.status === 'published' && hasStarted(item) && !item.is_excused
                && (item.submission_status === 'pending' || (item.submission_status === 'not_submitted' && item.allow_late_submission))"
              class="form-grid submission-form tr-form"
              @submit.prevent="submitTimed(item)"
            >
              <label>Score (optional, 0–100)
                <input v-model="submissions[item.timed_assessment_id]!.score" type="number" min="0" max="100" step="0.01">
              </label>
              <label class="wide">Assessment result
                <textarea v-model="submissions[item.timed_assessment_id]!.result_text" rows="3" maxlength="5000" placeholder="Enter your result or response"></textarea>
              </label>
              <div class="actions wide">
                <button class="primary-button tr-submit" type="submit">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-7z"/></svg>
                  Submit assessment
                </button>
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
          <label class="wide">Notes<textarea v-model.trim="form.notes" maxlength="2000" rows="3"></textarea></label>
          <div class="actions wide">
            <button class="primary-button" type="submit" :disabled="saving">{{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Record result' }}</button>
            <button v-if="editingId" class="secondary-button" type="button" @click="resetForm">Cancel edit</button>
          </div>
        </form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Trainee</th><th>Program / class</th><th>Assessment</th><th>Outcome</th><th>Date</th><th>Assessor</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="item in records" :key="item.assessment_id">
                <td>{{ item.trainee_name }}<small>{{ item.trainee_number }}</small></td>
                <td>{{ item.program_name }}<small>{{ item.class_name }}</small></td>
                <td>{{ item.assessment_name }}</td>
                <td><span class="pill" :class="item.outcome">{{ item.outcome }}</span></td>
                <td>{{ item.assessment_date }}</td>
                <td>{{ item.assessor_name }}</td><td>{{ item.notes || '—' }}</td>
                <td class="actions"><button class="text-button" @click="edit(item)">Edit</button><button class="text-button danger" @click="remove(item)">Delete</button></td>
              </tr>
              <tr v-if="!records.length"><td colspan="8" class="empty">No assessment outcome records found.</td></tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </div>
</template>
 
<style scoped>
/* Registered so the angle can be animated (orbit light, focus borders) */
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.page {
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
  --purple: #6941a5;
  --muted: #5d6f82;
  --line: #e1e8f1;
  --field: #f1f5fb;
  /* used below but never defined in the original */
  --text: #16263a;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  --chev: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d6f82' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
}

.page svg {
  width: 1.1em;
  height: 1.1em;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ================= Banner ================= */
.page-heading,
.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.page-heading {
  position: relative;
  align-items: center;
  padding: 30px 32px;
  border-radius: 20px;
  color: #fff;
  overflow: hidden;
  isolation: isolate;
  background:
    var(--grain),
    radial-gradient(40% 90% at 6% 0%, rgb(143 196 245 / 34%), transparent 70%),
    radial-gradient(30% 80% at 60% 120%, rgb(232 201 138 / 14%), transparent 70%),
    radial-gradient(45% 100% at 100% 60%, rgb(42 106 168 / 65%), transparent 72%),
    linear-gradient(120deg, #1d4a79 0%, var(--navy) 40%, var(--navy-deep) 100%);
  background-size: 180px 180px, auto, auto, auto, auto;
  background-blend-mode: soft-light, normal, normal, normal, normal;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%), 0 28px 44px -30px rgb(8 23 39 / 85%);
  animation: tr-drop 0.7s var(--ease) both;
}

/* concentric rings with a slowly rotating light, same motif as the other pages */
.page-heading::before {
  content: '';
  position: absolute;
  top: 50%;
  right: -6%;
  z-index: -1;
  width: 540px;
  aspect-ratio: 1;
  translate: 0 -50%;
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle at center, transparent 0 46px, rgb(255 255 255 / 8%) 46px 47px),
    conic-gradient(from var(--angle), transparent 0deg, rgb(143 196 245 / 26%) 40deg, transparent 90deg, transparent 210deg, rgb(232 201 138 / 16%) 250deg, transparent 300deg);
  -webkit-mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  animation: tr-orbit 42s linear infinite;
  pointer-events: none;
}

.page-heading > * {
  position: relative;
}

.page-heading h1 {
  margin: 0;
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-size: clamp(1.9rem, 3vw, 2.6rem);
  font-weight: 500;
  font-variation-settings: 'opsz' 120, 'SOFT' 50;
  letter-spacing: -0.025em;
  line-height: 1.05;
}

.page-heading .muted {
  margin: 10px 0 0;
  color: rgb(255 255 255 / 78%);
  font-size: 15px;
}

.eyebrow {
  display: inline-block;
  margin: 0 0 10px;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgb(143 196 245 / 12%);
  box-shadow: inset 0 0 0 1px rgb(143 196 245 / 35%);
  color: var(--sky);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.tr-heading-main {
  display: flex;
  align-items: center;
  gap: 18px;
}

.tr-heading-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: linear-gradient(145deg, rgb(255 255 255 / 24%), rgb(255 255 255 / 6%)), rgb(255 255 255 / 8%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 28%), 0 14px 26px -12px rgb(0 0 0 / 55%);
  backdrop-filter: blur(10px);
}

/* soft ring that breathes around the icon */
.tr-heading-icon::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 22px;
  box-shadow: 0 0 0 1px rgb(143 196 245 / 35%);
  animation: tr-halo 3.2s ease-out infinite;
}

.tr-heading-icon svg {
  width: 28px;
  height: 28px;
}

.muted {
  color: var(--muted);
  font-size: 14px;
}

/* ================= Panels ================= */
.section-heading h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.6rem;
  font-weight: 600;
  font-variation-settings: 'opsz' 72, 'SOFT' 40;
  letter-spacing: -0.02em;
}

.panel {
  margin-top: 18px;
  padding: 26px 28px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #fcfdff);
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 14px 30px -22px rgb(17 44 73 / 40%);
  transition: box-shadow 0.35s ease, border-color 0.35s ease;
  animation: tr-rise 0.6s var(--ease) both;
}

.panel:hover {
  border-color: #d3deec;
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 24px 40px -24px rgb(17 44 73 / 48%);
}

/* ================= Forms ================= */
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.form-grid label,
.filter-grid label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.01em;
  transition: color 0.2s ease;
}

.form-grid label:has(input:focus, select:focus, textarea:focus),
.filter-grid label:has(input:focus, select:focus) {
  color: var(--blue);
}

/* 1px border is a second background layer, so a light can travel around it on focus */
.form-grid input:not([type='checkbox']),
.form-grid select,
.form-grid textarea,
.filter-grid input,
.filter-grid select {
  width: 100%;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(#f5f8fd, #f5f8fd) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  color: var(--text);
  font: inherit;
  transition: box-shadow 0.3s ease, transform 0.3s var(--ease);
}

.form-grid select,
.filter-grid select {
  appearance: none;
  padding-right: 38px;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(#f5f8fd, #f5f8fd) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  cursor: pointer;
}

.form-grid textarea {
  min-height: 96px;
  line-height: 1.55;
  resize: vertical;
}

.form-grid input:not([type='checkbox']):hover:not(:focus),
.form-grid textarea:hover:not(:focus),
.filter-grid input:hover:not(:focus) {
  background:
    linear-gradient(#f5f8fd, #f5f8fd) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

.form-grid select:hover:not(:focus),
.filter-grid select:hover:not(:focus) {
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(#f5f8fd, #f5f8fd) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

.form-grid input:not([type='checkbox']):focus,
.form-grid textarea:focus,
.filter-grid input:focus {
  outline: none;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: tr-spin-angle 3.5s linear infinite;
}

.form-grid select:focus,
.filter-grid select:focus {
  outline: none;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: tr-spin-angle 3.5s linear infinite;
}

.wide {
  grid-column: 1 / -1;
}

.submission-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-top: 16px;
  border-top: 1px dashed #cdd9e8;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 10px !important;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  accent-color: var(--blue);
}

.deadline-preview {
  margin: 0;
  padding: 13px 15px;
  border-radius: 12px;
  background: linear-gradient(90deg, #edf4fc, #f6faff);
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 14%);
  color: var(--navy-deep);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.filter-button {
  align-self: end;
}

/* ================= Buttons ================= */
.actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.export-actions {
  flex-wrap: wrap;
}

.primary-button,
.secondary-button {
  position: relative;
  min-height: 44px;
  padding: 11px 18px;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  isolation: isolate;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.25s var(--ease), box-shadow 0.3s ease;
}

.primary-button {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 16%), rgb(255 255 255 / 0%) 55%),
    linear-gradient(135deg, #2f74b3 0%, var(--blue) 50%, #1c4a78 100%);
  color: #fff;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 30%), inset 0 -1px 0 rgb(0 0 0 / 18%), 0 14px 24px -14px rgb(38 95 148 / 90%);
}

/* light sweep on hover */
.primary-button::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -60%;
  z-index: -1;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 32%), transparent);
  transform: skewX(-20deg);
  transition: left 0.8s var(--ease);
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 34%), inset 0 -1px 0 rgb(0 0 0 / 18%), 0 22px 30px -16px rgb(38 95 148 / 95%);
}

.primary-button:hover:not(:disabled)::before {
  left: 130%;
}

.secondary-button {
  background: #e6eef8;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 14%);
  color: var(--navy-deep);
}

.secondary-button:hover:not(:disabled) {
  background: #d9e6f5;
  transform: translateY(-2px);
}

.page-heading .secondary-button {
  background: rgb(255 255 255 / 10%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 24%);
  backdrop-filter: blur(10px);
  color: #fff;
}

.page-heading .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 20%);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
.text-button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.primary-button:disabled {
  opacity: 0.68;
  cursor: not-allowed;
}

.text-button {
  padding: 5px 9px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--blue);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s var(--ease);
}

.text-button:hover {
  background: var(--field);
  color: var(--navy-deep);
  transform: translateY(-1px);
}

.danger {
  color: var(--danger);
}

.text-button.danger:hover {
  background: #fdeceb;
  color: var(--danger);
}

.tr-refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tr-refresh svg.spinning {
  animation: tr-spin 0.8s linear infinite;
}

.tr-submit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tr-submit svg {
  transition: transform 0.3s var(--spring);
}

.tr-submit:hover svg {
  transform: translate(3px, -3px);
}

/* ================= Messages ================= */
.inline-error,
.inline-success {
  display: flex;
  align-items: center;
  width: fit-content;
  max-width: min(100%, 820px);
  margin-top: 14px;
  padding: 11px 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.55;
  animation: tr-slide-down 0.45s var(--ease) both;
}

.inline-error {
  border-left-width: 3px;
  border-color: rgb(196 77 68 / 18%);
  background: linear-gradient(90deg, #fff0ee, #fff7f5);
  color: #a3332b;
}

.inline-success {
  border-left-width: 3px;
  border-color: rgb(25 121 77 / 18%);
  background: linear-gradient(90deg, #e8f7ee, #f4fbf6);
  color: #1a6b4b;
}

/* ================= Tables ================= */
.table-wrap {
  overflow: auto;
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

th {
  background: linear-gradient(180deg, #f3f7fd, var(--field));
  color: var(--navy);
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

tbody tr {
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f4f8fe;
  box-shadow: inset 3px 0 0 var(--blue);
}

td small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--muted);
}

/* ================= Pills ================= */
.pill,
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 4px 11px;
  border-radius: 999px;
  background: #e3f4ea;
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 22%);
  color: #1f6b41;
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
  white-space: nowrap;
}

.pill.fail {
  background: #fdeceb;
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 20%);
  color: var(--danger);
}

.status-pill {
  background: #edf1f7;
  box-shadow: inset 0 0 0 1px rgb(71 85 105 / 18%);
  color: #475569;
}

.status-pill.published,
.status-pill.on_time {
  background: #e3f4ea;
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 22%);
  color: #1f6b41;
}

.status-pill.pending {
  background: #e7f2fc;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 20%);
  color: #265f94;
}

.status-pill.late,
.status-pill.not_submitted {
  background: #fdeceb;
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 20%);
  color: var(--danger);
}

.status-pill.excused {
  background: #f1eafd;
  box-shadow: inset 0 0 0 1px rgb(105 65 165 / 20%);
  color: var(--purple);
}

/* ================= Stats / legacy ================= */
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
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background:
    radial-gradient(120% 90% at 100% 0%, rgb(143 196 245 / 14%), transparent 60%),
    #f8fbff;
  transition: transform 0.3s var(--ease), box-shadow 0.3s ease;
}

.stat-grid article:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 28px -22px rgb(17 44 73 / 55%);
}

.stat-grid span {
  color: var(--muted);
  font-size: 12px;
}

.stat-grid strong {
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 24px;
  font-weight: 500;
  line-height: 1.05;
}

.legacy-panel summary {
  color: var(--navy-deep);
  font-weight: 700;
  cursor: pointer;
  transition: color 0.2s ease;
}

.legacy-panel summary:hover {
  color: var(--blue);
}

/* ================= Notifications ================= */
.tr-notifications h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: -0.015em;
}

.tr-bell {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: #fff3d8;
  box-shadow: inset 0 0 0 1px rgb(201 138 0 / 25%);
  color: #825a00;
}

.tr-bell svg {
  transform-origin: 50% 0;
  animation: tr-ring 3.5s ease-in-out 1s infinite;
}

/* ================= Summary strip ================= */
.tr-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.tr-summary article {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background:
    radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, currentColor 9%, transparent), transparent 60%),
    linear-gradient(180deg, #fff, #fbfcfe);
  color: var(--blue);
  overflow: hidden;
  animation: tr-rise 0.6s var(--ease) both;
  transition: transform 0.3s var(--ease), box-shadow 0.3s ease;
}

.tr-summary article:nth-child(2) { animation-delay: 0.07s; }
.tr-summary article:nth-child(3) { animation-delay: 0.14s; }

.tr-summary article:hover {
  transform: translateY(-3px);
  box-shadow: 0 20px 30px -22px rgb(17 44 73 / 55%);
}

.tr-summary article.ok { color: var(--ok); }
.tr-summary article.bad { color: var(--danger); }

.tr-summary article > svg {
  width: 30px;
  height: 30px;
  padding: 11px;
  box-sizing: content-box;
  border-radius: 14px;
  background: currentColor;
  background: linear-gradient(145deg, color-mix(in srgb, currentColor 78%, white), currentColor);
  box-shadow: 0 12px 20px -12px currentColor;
  transition: transform 0.4s var(--spring);
}

.tr-summary article:hover > svg {
  transform: rotate(-6deg) scale(1.08);
}

.tr-summary article > svg * {
  stroke: #fff;
}

.tr-summary strong {
  display: block;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.9rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.tr-summary span {
  color: var(--muted);
  font-size: 13px;
}

/* ================= Assignment cards ================= */
.tr-list-panel .section-heading h2 {
  font-size: 1.6rem;
}

.tr-server-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0;
}

.tr-cards {
  display: grid;
  gap: 18px;
  margin-top: 18px;
}

.tr-card {
  position: relative;
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 24px 24px 24px 30px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #fcfdff);
  overflow: hidden;
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 14px 30px -22px rgb(17 44 73 / 40%);
  animation: tr-rise 0.6s var(--ease) both;
  transition: box-shadow 0.3s ease, transform 0.3s var(--ease), border-color 0.3s ease;
}

.tr-card:hover {
  border-color: #d0dcea;
  transform: translateY(-3px);
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 26px 40px -26px rgb(17 44 73 / 55%);
}

/* status accent on the left edge */
.tr-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 6px;
  background: linear-gradient(180deg, var(--sky), var(--blue));
}

.tr-card.is-on_time::before { background: linear-gradient(180deg, #5cc08a, var(--ok)); }
.tr-card.is-late::before,
.tr-card.is-not_submitted::before { background: linear-gradient(180deg, #e0675d, var(--danger)); }
.tr-card.is-excused::before { background: linear-gradient(180deg, #a07ad6, var(--purple)); }

.tr-card-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.tr-type-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(145deg, #fff, #e7f2fc);
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 18%);
  color: var(--blue);
  transition: transform 0.4s var(--spring), background 0.3s ease, color 0.3s ease;
}

.tr-card:hover .tr-type-icon {
  background: linear-gradient(135deg, #2f74b3, #1c4a78);
  color: #fff;
  transform: rotate(-6deg) scale(1.06);
}

.tr-type-icon svg {
  width: 24px;
  height: 24px;
}

.tr-card-title {
  flex: 1;
  min-width: 0;
}

.tr-card-title h3 {
  margin: 0 0 8px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.2;
}

.tr-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tr-chips li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #eef3fa;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 12%);
  color: #3d5670;
  font-size: 12.5px;
  font-weight: 600;
  text-transform: capitalize;
}

.tr-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 6px 12px;
  border-radius: 999px;
  background: #e7f2fc;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 20%);
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-transform: capitalize;
  white-space: nowrap;
}

.tr-pill.on_time {
  background: #e3f4ea;
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 22%);
  color: #1f6b41;
}

.tr-pill.late,
.tr-pill.not_submitted {
  background: #fdeceb;
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 20%);
  color: var(--danger);
}

.tr-pill.excused {
  background: #f1eafd;
  box-shadow: inset 0 0 0 1px rgb(105 65 165 / 20%);
  color: var(--purple);
}

.tr-description {
  margin: 0;
  color: var(--text);
  line-height: 1.6;
}

/* ================= Timeline ================= */
.tr-timeline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 22px;
  padding: 15px 18px;
  border-radius: 14px;
  background: linear-gradient(90deg, #f3f8fe, #f9fbfe);
  box-shadow: inset 0 0 0 1px var(--line);
}

.tr-timeline > div {
  display: grid;
  gap: 3px;
}

.tr-timeline strong {
  color: var(--navy-deep);
  font-size: 14px;
}

.tr-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.tr-arrow {
  color: #9db4cb;
}

.tr-arrow svg {
  animation: tr-nudge 1.8s ease-in-out infinite;
}

.tr-instructions {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border: 1px dashed #bfd1ea;
  border-radius: 14px;
  background: rgb(231 242 252 / 30%);
  color: var(--blue);
}

.tr-instructions svg {
  margin-top: 2px;
}

.tr-instructions strong {
  color: var(--navy-deep);
  font-size: 13px;
}

.tr-instructions p {
  margin: 3px 0 0;
  color: var(--text);
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* ================= Countdown ================= */
.tr-countdown {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 15px 18px;
  border-radius: 14px;
  background: linear-gradient(90deg, #e3f0fc, #edf5fd);
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 16%);
  color: var(--navy);
}

.tr-countdown svg {
  width: 22px;
  height: 22px;
}

.tr-countdown strong {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.tr-countdown em {
  font-size: 13px;
  font-style: normal;
  font-weight: 700;
}

.tr-countdown .tick {
  animation: tr-tick 1s steps(2, jump-none) infinite;
  transform-origin: center;
}

.tr-countdown.warning {
  background: linear-gradient(90deg, #fff0cf, #fff8e6);
  box-shadow: inset 0 0 0 1px rgb(201 138 0 / 28%);
  color: #825a00;
}

.tr-countdown.urgent {
  background: linear-gradient(90deg, #fdeceb, #fff4f2);
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 24%);
  color: var(--danger);
  animation: countdown-pulse 1s ease-in-out infinite alternate;
}

.tr-bar {
  flex-basis: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgb(0 0 0 / 8%);
  overflow: hidden;
}

.tr-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: currentColor;
  transition: width 1s linear;
}

/* ================= Notes and result ================= */
.tr-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 13px 16px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

.tr-note.bad {
  background: linear-gradient(90deg, #fff0ee, #fff7f5);
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 14%);
  color: #a3332b;
}

.tr-note.excused {
  background: linear-gradient(90deg, #f1eafd, #f7f2fe);
  box-shadow: inset 0 0 0 1px rgb(105 65 165 / 16%);
  color: var(--purple);
}

.tr-note svg {
  margin-top: 2px;
}

.tr-result {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px 18px;
  border-radius: 14px;
  background: linear-gradient(90deg, #e3f4ea, #eef8f2);
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 20%);
  color: #1f6b41;
}

.tr-result > div {
  display: grid;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.tr-score {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.2rem;
  font-weight: 600;
}

.tr-check svg {
  width: 30px;
  height: 30px;
}

.tr-check circle {
  stroke-dasharray: 63;
  stroke-dashoffset: 63;
  animation: tr-draw 0.6s ease forwards;
}

.tr-check path {
  stroke-dasharray: 18;
  stroke-dashoffset: 18;
  animation: tr-draw 0.4s 0.45s ease forwards;
}

.tr-form {
  margin-top: 0;
}

/* ================= Empty + loading ================= */
.tr-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 44px 20px;
  border: 1px dashed #cdd9e8;
  border-radius: 16px;
  color: var(--muted);
  text-align: center;
}

.tr-empty svg {
  width: 48px;
  height: 48px;
  color: #9db4cb;
  animation: tr-float 3s ease-in-out infinite;
}

.tr-empty p {
  margin: 0;
}

.tr-skeletons {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.tr-skeleton {
  height: 150px;
  border-radius: 18px;
  background: linear-gradient(90deg, #eef3f8 25%, #f9fbfd 50%, #eef3f8 75%);
  background-size: 200% 100%;
  animation: tr-shimmer 1.3s linear infinite;
}

/* ================= Keyframes ================= */
@keyframes countdown-pulse { from { box-shadow: inset 0 0 0 1px rgb(180 40 31 / 24%), 0 0 0 0 rgb(180 40 31 / 0%); } to { box-shadow: inset 0 0 0 1px rgb(180 40 31 / 24%), 0 0 0 4px rgb(180 40 31 / 12%); } }
@keyframes tr-drop { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
@keyframes tr-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes tr-slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@keyframes tr-orbit { to { --angle: 360deg; } }
@keyframes tr-spin-angle { to { --angle: 360deg; } }
@keyframes tr-halo { 0% { opacity: 0.8; transform: scale(0.92); } 70%, 100% { opacity: 0; transform: scale(1.25); } }
@keyframes tr-spin { to { transform: rotate(360deg); } }
@keyframes tr-ring { 0%, 8%, 100% { transform: rotate(0); } 2% { transform: rotate(14deg); } 4% { transform: rotate(-12deg); } 6% { transform: rotate(8deg); } }
@keyframes tr-nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
@keyframes tr-tick { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
@keyframes tr-draw { to { stroke-dashoffset: 0; } }
@keyframes tr-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes tr-shimmer { to { background-position: -200% 0; } }

/* ================= Responsive ================= */
@media (max-width: 850px) {
  .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .page-heading::before { right: -30%; }
}

@media (max-width: 700px) {
  .tr-summary { grid-template-columns: 1fr; }
  .tr-card { padding: 20px 16px 20px 22px; }
  .tr-card-head { flex-wrap: wrap; }
  .tr-pill { order: -1; }
  .tr-arrow { display: none; }
}

@media (max-width: 560px) {
  .form-grid { grid-template-columns: 1fr; }
  .wide { grid-column: auto; }
  .panel { padding: 18px; }
  .page-heading { flex-direction: column; align-items: flex-start; padding: 24px 20px; border-radius: 18px; }
  .page-heading::before { right: -60%; width: 420px; }
  .page-heading h1 { font-size: 26px; }
  .filter-grid,
  .submission-form { grid-template-columns: 1fr; }
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .section-heading { flex-direction: column; }
  .export-actions { width: 100%; }
  .tr-heading-main { align-items: flex-start; }
  .tr-heading-icon { width: 48px; height: 48px; }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page *,
  .page *::before,
  .page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
