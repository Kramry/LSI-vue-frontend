<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiGet, apiPost, getSession } from '../services/api'
import { Line, Doughnut, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface AnalyticsData {
  filters: { start_date: string; end_date: string; class_id: number | null }
  class_options: Array<{ class_id: number; class_name: string }>
  summary: {
    active_trainees: number
    active_classes: number
    attendance_records: number
    absent_records: number
    attendance_rate: number
  }
  trend: Array<{ date: string; label: string; present: number; late: number; absent: number }>
  status: Record<string, number>
  classes: Array<Record<string, string | number>>
  trainees: Array<Record<string, string | number | null>>
  payments?: {
    summary: Record<string, number>
    collections: Array<{ date: string; label: string; amount: number }>
    by_fee_kind: Array<{ fee_kind: string; net_collected: number }>
    by_method: Array<{ method: string; payment_count: number; net_collected: number }>
  }
  training?: {
    summary: {
      total_enrolled: number
      active_trainees: number
      inactive_trainees: number
      completed_trainings: number
      completion_rate: number
    }
    trainees_per_batch: Array<{
      class_id: number
      class_name: string
      program_name: string
      trainee_count: number
      start_date: string
      end_date: string
    }>
    monthly_trends: Array<{ month: string; new_registrations: number }>
    program_popularity: Array<{
      program_id: number
      program_name: string
      program_code: string
      trainee_count: number
      class_count: number
    }>
  }
  documents?: {
    summary: {
      total_submitted: number
      verified: number
      rejected: number
      pending: number
      missing: number
      completion_rate: number
    }
    completion_by_class: Array<{
      class_id: number
      class_name: string
      required_count: number
      submitted_count: number
      completion_rate: number
    }>
    document_types: Array<{
      document_name: string
      count: number
      approved: number
      rejected: number
      pending: number
    }>
  }
  certificates?: {
    summary: {
      total_issued: number
      issued: number
      pending: number
      revoked: number
    }
    certificates_per_batch: Array<{
      class_id: number
      class_name: string
      program_name: string
      certificate_count: number
      trainee_count: number
    }>
    monthly_issuance: Array<{ month: string; certificates_issued: number }>
    eligibility: {
      total_eligible: number
      eligible: number
      not_eligible: number
      avg_attendance: number
    }
  }
  announcements?: {
    summary: {
      total_published: number
      published: number
      draft: number
      email_notifications: number
      sms_notifications: number
      read_notifications: number
      unread_notifications: number
      failed_notifications: number
    }
    read_statistics: Array<{
      announcement_id: number
      title: string
      created_at: string
      unique_readers: number
    }>
  }
}

interface AiInsights {
  overview: string
  key_observations: string[]
  positive_trends: string[]
  concerns: string[]
  recommendations: Array<{ priority: string; action: string; reason: string }>
  data_limitations: string[]
  generated_at?: string
}

const today = new Date()
const localDate = (date: Date) => {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}
const endDate = ref(localDate(today))
const startDate = ref(localDate(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)))
const classId = ref('')
const role = ref('')
const data = ref<AnalyticsData | null>(null)
const loading = ref(false)
const error = ref('')
const aiInsights = ref<AiInsights | null>(null)
const aiLoading = ref(false)
const aiError = ref('')
const isFinance = computed(() => ['administrator', 'staff'].includes(role.value))
const selectedClassName = computed(() => data.value?.class_options.find(item => String(item.class_id) === classId.value)?.class_name || 'All available classes')
const maxTrendValue = computed(() => Math.max(1, ...(data.value?.trend.map((item) => item.present + item.late + item.absent) ?? [1])))

// Chart data configurations
const attendanceTrendData = computed(() => ({
  labels: data.value?.trend.map(item => item.label) || [],
  datasets: [
    { label: 'Present', data: data.value?.trend.map(item => item.present) || [], borderColor: '#2d8a57', backgroundColor: '#2d8a57', tension: 0.25 },
    { label: 'Late', data: data.value?.trend.map(item => item.late) || [], borderColor: '#d99100', backgroundColor: '#d99100', tension: 0.25 },
    { label: 'Absent', data: data.value?.trend.map(item => item.absent) || [], borderColor: '#c4372c', backgroundColor: '#c4372c', tension: 0.25 }
  ]
}))

const attendanceStatusData = computed(() => ({
  labels: Object.keys(data.value?.status || {}),
  datasets: [{ data: Object.values(data.value?.status || {}), backgroundColor: ['#2d8a57', '#d99100', '#c4372c'] }]
}))

const trainingTrendData = computed(() => ({
  labels: data.value?.training?.monthly_trends.map(item => item.month) || [],
  datasets: [{ label: 'New registrations', data: data.value?.training?.monthly_trends.map(item => item.new_registrations) || [], borderColor: '#265f94', backgroundColor: '#265f94', tension: 0.25 }]
}))

const trainingProgramsData = computed(() => ({
  labels: data.value?.training?.program_popularity.map(item => item.program_name) || [],
  datasets: [{ label: 'Trainees', data: data.value?.training?.program_popularity.map(item => item.trainee_count) || [], backgroundColor: '#265f94' }]
}))

const docsStatusData = computed(() => ({
  labels: ['Verified', 'Rejected', 'Pending'],
  datasets: [{ data: [data.value?.documents?.summary?.verified || 0, data.value?.documents?.summary?.rejected || 0, data.value?.documents?.summary?.pending || 0], backgroundColor: ['#2d8a57', '#c4372c', '#d99100'] }]
}))

const docsTypesData = computed(() => ({
  labels: data.value?.documents?.document_types.map(item => item.document_name) || [],
  datasets: [{ label: 'Count', data: data.value?.documents?.document_types.map(item => item.count) || [], backgroundColor: '#6a4c93' }]
}))

const certsTrendData = computed(() => ({
  labels: data.value?.certificates?.monthly_issuance.map(item => item.month) || [],
  datasets: [{ label: 'Certificates issued', data: data.value?.certificates?.monthly_issuance.map(item => item.certificates_issued) || [], borderColor: '#2d8a57', backgroundColor: '#2d8a57', tension: 0.25 }]
}))

const certsStatusData = computed(() => ({
  labels: ['Issued', 'Pending', 'Revoked'],
  datasets: [{ data: [data.value?.certificates?.summary?.issued || 0, data.value?.certificates?.summary?.pending || 0, data.value?.certificates?.summary?.revoked || 0], backgroundColor: ['#2d8a57', '#d99100', '#c4372c'] }]
}))

const annTypesData = computed(() => ({
  labels: ['Email', 'SMS'],
  datasets: [{ data: [data.value?.announcements?.summary?.email_notifications || 0, data.value?.announcements?.summary?.sms_notifications || 0], backgroundColor: ['#265f94', '#6a4c93'] }]
}))

const annReadData = computed(() => ({
  labels: ['Read', 'Unread'],
  datasets: [{ data: [data.value?.announcements?.summary?.read_notifications || 0, data.value?.announcements?.summary?.unread_notifications || 0], backgroundColor: ['#2d8a57', '#5d6f82'] }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 } }
  }
}

function money(value: unknown) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
}

function barWidth(value: number, max: number) {
  return `${max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0}%`
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function exportToExcel() {
  if (!data.value) {
    alert('Please wait for analytics data to load before exporting.')
    return
  }
  const rows: unknown[][] = [
    ['Analytics Report'],
    ['Generated:', new Date().toISOString()],
    ['Date Range:', `${startDate.value} to ${endDate.value}`],
    []
  ]

  rows.push(
    ['SUMMARY'],
    ['Metric', 'Value'],
    ['Active Trainees', data.value.summary.active_trainees],
    ['Active Classes', data.value.summary.active_classes],
    ['Attendance Records', data.value.summary.attendance_records],
    ['Attendance Rate', `${data.value.summary.attendance_rate}%`],
    ['Absent Records', data.value.summary.absent_records],
    []
  )

  if (data.value.training) {
    rows.push(
      ['TRAINING ANALYTICS'],
      ['Metric', 'Value'],
      ['Total Enrolled', data.value.training.summary.total_enrolled],
      ['Active Trainees', data.value.training.summary.active_trainees],
      ['Completed Trainings', data.value.training.summary.completed_trainings],
      ['Completion Rate', `${data.value.training.summary.completion_rate}%`],
      []
    )
  }

  if (data.value.documents) {
    rows.push(
      ['DOCUMENT ANALYTICS'],
      ['Metric', 'Value'],
      ['Total Submitted', data.value.documents.summary.total_submitted],
      ['Verified', data.value.documents.summary.verified],
      ['Rejected', data.value.documents.summary.rejected],
      ['Pending', data.value.documents.summary.pending],
      ['Missing', data.value.documents.summary.missing],
      []
    )
  }

  if (data.value.certificates) {
    rows.push(
      ['CERTIFICATE ANALYTICS'],
      ['Metric', 'Value'],
      ['Total Issued', data.value.certificates.summary.total_issued],
      ['Issued', data.value.certificates.summary.issued],
      ['Pending', data.value.certificates.summary.pending],
      ['Revoked', data.value.certificates.summary.revoked],
      []
    )
  }

  if (data.value.announcements) {
    rows.push(
      ['ANNOUNCEMENT ANALYTICS'],
      ['Metric', 'Value'],
      ['Total Published', data.value.announcements.summary.total_published],
      ['Email Notifications', data.value.announcements.summary.email_notifications],
      ['SMS Notifications', data.value.announcements.summary.sms_notifications],
      ['Read Notifications', data.value.announcements.summary.read_notifications],
      ['Failed Notifications', data.value.announcements.summary.failed_notifications],
      []
    )
  }

  if (data.value.payments) {
    rows.push(
      ['PAYMENT ANALYTICS'],
      ['Metric', 'Value'],
      ['Net Collected', data.value.payments.summary.net_collected],
      ['Outstanding Balance', data.value.payments.summary.outstanding_balance],
      ['Bond Held', data.value.payments.summary.bond_held],
      []
    )
  }

  const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `analytics_report_${startDate.value}_to_${endDate.value}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function printReport() {
  if (!data.value) return
  window.print()
}

async function loadAiInsights() {
  aiError.value = ''
  try {
    const query = new URLSearchParams({ start_date: startDate.value, end_date: endDate.value })
    if (classId.value) query.set('class_id', classId.value)
    const payload = await apiGet<{ insights?: AiInsights }>(`/analytics/ai-insights?${query}`)
    aiInsights.value = payload.data.insights || null
  } catch (reason) {
    aiInsights.value = null
    aiError.value = reason instanceof Error
      ? reason.message
      : 'Cached AI insights could not be loaded.'
  }
}

async function generateAiInsights() {
  aiLoading.value = true
  aiError.value = ''
  try {
    const query = new URLSearchParams({ start_date: startDate.value, end_date: endDate.value })
    if (classId.value) query.set('class_id', classId.value)
    const payload = await apiPost<{ insights?: AiInsights }>(`/analytics/ai-insights/generate?${query}`, {})
    if (!payload.data.insights) throw new Error('Gemini returned no insights.')
    aiInsights.value = payload.data.insights
  } catch (reason) {
    aiError.value = reason instanceof Error ? reason.message : 'Gemini insights could not be generated.'
  } finally {
    aiLoading.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const query = new URLSearchParams({ start_date: startDate.value, end_date: endDate.value })
    if (classId.value) query.set('class_id', classId.value)
    const response = await apiGet<AnalyticsData>(`/analytics?${query}`)
    data.value = response.data
    await loadAiInsights()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load analytics.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const session = await getSession()
    role.value = session.user?.role || ''
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load analytics.'
  }
})
</script>

<template>
  <div class="page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">SMARTTRACK / REPORTING</p>
        <h1>Analytics</h1>
        <p class="muted">Attendance, class activity, and payment monitoring.</p>
      </div>
      <div class="button-group">
        <button class="secondary-button" :disabled="loading" @click="load">Refresh</button>
        <button class="secondary-button" :disabled="loading || !data" @click="exportToExcel">Export Excel</button>
        <button class="secondary-button" :disabled="loading || !data" @click="printReport">Print PDF</button>
      </div>
    </header>

    <form class="panel filters" @submit.prevent="load">
      <label>From <input v-model="startDate" type="date" required></label>
      <label>To <input v-model="endDate" type="date" required></label>
      <label>Class
        <select v-model="classId">
          <option value="">All available classes</option>
          <option v-for="item in data?.class_options || []" :key="item.class_id" :value="String(item.class_id)">
            {{ item.class_name }}
          </option>
        </select>
      </label>
      <button class="primary-button" type="submit" :disabled="loading">{{ loading ? 'Loading…' : 'Apply filters' }}</button>
    </form>

    <div class="print-meta">
      <p><strong>Report period:</strong> {{ startDate }} to {{ endDate }}</p>
      <p><strong>Class:</strong> {{ selectedClassName }}</p>
    </div>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="loading && !data" class="muted loading">Loading analytics…</p>

    <template v-if="data">
      <!-- 1. Headline figures -->
      <section class="kpi-grid" aria-label="Attendance summary">
        <article class="kpi"><span>Active trainees</span><strong>{{ data.summary.active_trainees.toLocaleString() }}</strong></article>
        <article class="kpi"><span>Active classes</span><strong>{{ data.summary.active_classes.toLocaleString() }}</strong></article>
        <article class="kpi"><span>Attendance records</span><strong>{{ data.summary.attendance_records.toLocaleString() }}</strong></article>
        <article class="kpi"><span>Attendance rate</span><strong>{{ data.summary.attendance_rate }}%</strong></article>
        <article class="kpi"><span>Absences</span><strong>{{ data.summary.absent_records.toLocaleString() }}</strong></article>
      </section>

      <!-- 2. Trend beside status breakdown -->
      <section class="split section">
        <article class="panel">
          <div class="section-heading">
            <div>
              <h2>Attendance trend</h2>
              <p class="muted">Daily counts for the selected period.</p>
            </div>
            <div class="legend"><span>Present</span><span>Late</span><span>Absent</span></div>
          </div>
          <div class="trend">
            <div v-for="item in data.trend" :key="item.date" class="trend-day">
              <div class="bar-stack" :title="`${item.label}: ${item.present} present, ${item.late} late, ${item.absent} absent`">
                <i class="bar present" :style="{ height: barWidth(item.present, maxTrendValue) }"></i>
                <i class="bar late" :style="{ height: barWidth(item.late, maxTrendValue) }"></i>
                <i class="bar absent" :style="{ height: barWidth(item.absent, maxTrendValue) }"></i>
              </div>
              <small>{{ item.label }}</small>
            </div>
          </div>
        </article>

        <article class="panel">
          <h2>Attendance status</h2>
          <p class="muted">Share of all records in this period.</p>
          <div v-for="(count, label) in data.status" :key="label" class="status-block">
            <div class="status-row">
              <span class="status-name"><i class="dot" :class="String(label).toLowerCase()"></i>{{ label }}</span>
              <strong>{{ count.toLocaleString() }}</strong>
            </div>
            <div class="mini-track">
              <i
                :class="String(label).toLowerCase()"
                :style="{ width: `${Math.round((Number(count) / Math.max(1, Object.values(data.status).reduce((sum, value) => sum + Number(value), 0))) * 100)}%` }"
              ></i>
            </div>
          </div>
        </article>
      </section>

      <!-- 3. Who needs attention -->
      <section class="panel section">
        <div class="section-heading">
          <div>
            <h2>Trainee monitoring</h2>
            <p class="muted">Up to 100 trainees with attendance in this date range.</p>
          </div>
          <span class="count-badge">{{ data.trainees.length }} trainees</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Class</th>
                <th class="num">Present</th>
                <th class="num">Late</th>
                <th class="num">Absent</th>
                <th class="num">Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trainee in data.trainees" :key="String(trainee.trainee_id)">
                <td class="strong">{{ trainee.trainee_name }}</td>
                <td>{{ trainee.classes }}</td>
                <td class="num">{{ trainee.present_records }}</td>
                <td class="num">{{ trainee.late_records }}</td>
                <td class="num">{{ trainee.absent_records }}</td>
                <td class="num">
                  <span class="rate" :class="Number(trainee.attendance_rate) >= 90 ? 'good' : Number(trainee.attendance_rate) >= 75 ? 'mid' : 'low'">{{ trainee.attendance_rate }}%</span>
                </td>
              </tr>
              <tr v-if="!data.trainees.length"><td colspan="6" class="empty">No attendance records in this range.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 4. Class overview -->
      <section class="panel section">
        <div class="section-heading">
          <div>
            <h2>Class overview</h2>
            <p class="muted">Attendance performance per class.</p>
          </div>
          <span class="count-badge">{{ data.classes.length }} classes</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Program</th>
                <th class="num">Active trainees</th>
                <th class="num">Attendance records</th>
                <th class="num">Absences</th>
                <th class="num">Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.classes" :key="item.class_id">
                <td class="strong">{{ item.class_name }}</td>
                <td>{{ item.program_name }}</td>
                <td class="num">{{ item.active_trainees }}</td>
                <td class="num">{{ item.attendance_records }}</td>
                <td class="num">{{ item.absent_records }}</td>
                <td class="num">
                  <span class="rate" :class="Number(item.attendance_rate) >= 90 ? 'good' : Number(item.attendance_rate) >= 75 ? 'mid' : 'low'">{{ item.attendance_rate }}%</span>
                </td>
              </tr>
              <tr v-if="!data.classes.length"><td colspan="6" class="empty">No class data available.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 5. Finance -->
      <section v-if="isFinance && data.payments" class="finance section">
        <header class="finance-heading">
          <p class="eyebrow dark">FINANCE / MONITORING</p>
          <h2>Payment analytics</h2>
          <p class="muted">Ledger collections follow the selected dates. Balances and held bonds are current totals.</p>
        </header>

        <div class="kpi-grid">
          <article class="kpi"><span>Net payments received</span><strong>{{ money(data.payments.summary.net_collected) }}</strong></article>
          <article class="kpi"><span>Outstanding balance</span><strong>{{ money(data.payments.summary.outstanding_balance) }}</strong></article>
          <article class="kpi"><span>Bonds held</span><strong>{{ money(data.payments.summary.bond_held) }}</strong></article>
          <article class="kpi"><span>Refunds in period</span><strong>{{ money(data.payments.summary.refunded) }}</strong></article>
          <article class="kpi"><span>Forfeited in period</span><strong>{{ money(data.payments.summary.forfeited) }}</strong></article>
          <article class="kpi"><span>Pending proofs</span><strong>{{ data.payments.summary.pending_proof_count }}</strong><small class="kpi-sub">{{ money(data.payments.summary.pending_proof_amount) }}</small></article>
        </div>

        <div class="split">
          <article class="panel">
            <h3>Collections by day</h3>
            <div class="collection-list">
              <div v-for="item in data.payments.collections" :key="item.date" class="collection-row">
                <span>{{ item.label }}</span>
                <div class="collection-track">
                  <i :style="{ width: barWidth(Math.max(item.amount, 0), Math.max(1, ...data.payments.collections.map((day) => day.amount))) }"></i>
                </div>
                <strong>{{ money(item.amount) }}</strong>
              </div>
            </div>
            <p v-if="!data.payments.collections.length" class="empty">No collections in this range.</p>
          </article>

          <div class="stack">
            <article class="panel">
              <h3>Payments by fee type</h3>
              <div v-for="item in data.payments.by_fee_kind" :key="item.fee_kind" class="status-row">
                <span>{{ item.fee_kind === 'bond' ? 'Bond deposit' : 'Registration fee' }}</span>
                <strong>{{ money(item.net_collected) }}</strong>
              </div>
              <p v-if="!data.payments.by_fee_kind.length" class="empty">No payments in this range.</p>
            </article>
            <article class="panel">
              <h3>Payments by method</h3>
              <div v-for="item in data.payments.by_method" :key="item.method" class="status-row">
                <span class="method">{{ item.method }} <em>{{ item.payment_count }}</em></span>
                <strong>{{ money(item.net_collected) }}</strong>
              </div>
              <p v-if="!data.payments.by_method.length" class="empty">No payments in this range.</p>
            </article>
          </div>
        </div>
      </section>

      <!-- 6. Training Analytics -->
      <section v-if="isFinance && data.training" class="finance section">
        <header class="finance-heading">
          <p class="eyebrow dark">TRAINING / ANALYTICS</p>
          <h2>Training analytics</h2>
          <p class="muted">Enrollment statistics, completion rates, and program popularity.</p>
        </header>

        <div class="kpi-grid">
          <article class="kpi"><span>Total enrolled</span><strong>{{ data.training.summary.total_enrolled.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Active trainees</span><strong>{{ data.training.summary.active_trainees.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Completed trainings</span><strong>{{ data.training.summary.completed_trainings.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Completion rate</span><strong>{{ data.training.summary.completion_rate }}%</strong></article>
          <article class="kpi"><span>Inactive trainees</span><strong>{{ data.training.summary.inactive_trainees.toLocaleString() }}</strong></article>
        </div>

        <div class="split">
          <article class="panel">
            <h3>Monthly enrollment trends</h3>
            <div class="chart-container">
              <Line :data="trainingTrendData" :options="chartOptions" />
            </div>
          </article>
          <article class="panel">
            <h3>Program popularity</h3>
            <div class="chart-container">
              <Bar :data="trainingProgramsData" :options="chartOptions" />
            </div>
          </article>
        </div>

        <section class="panel section">
          <div class="section-heading">
            <div>
              <h3>Trainees per training batch</h3>
              <p class="muted">Enrollment by class</p>
            </div>
            <span class="count-badge">{{ data.training.trainees_per_batch.length }} batches</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Program</th>
                  <th class="num">Trainees</th>
                  <th>Start date</th>
                  <th>End date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="batch in data.training.trainees_per_batch" :key="batch.class_id">
                  <td class="strong">{{ batch.class_name }}</td>
                  <td>{{ batch.program_name }}</td>
                  <td class="num">{{ batch.trainee_count }}</td>
                  <td>{{ batch.start_date }}</td>
                  <td>{{ batch.end_date }}</td>
                </tr>
                <tr v-if="!data.training.trainees_per_batch.length"><td colspan="5" class="empty">No training batch data available.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <!-- 7. Document Analytics -->
      <section v-if="isFinance && data.documents" class="finance section">
        <header class="finance-heading">
          <p class="eyebrow dark">DOCUMENTS / ANALYTICS</p>
          <h2>Document analytics</h2>
          <p class="muted">Document submission, verification, and completion rates.</p>
        </header>

        <div class="kpi-grid">
          <article class="kpi"><span>Total submitted</span><strong>{{ data.documents.summary.total_submitted.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Verified</span><strong>{{ data.documents.summary.verified.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Rejected</span><strong>{{ data.documents.summary.rejected.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Pending</span><strong>{{ data.documents.summary.pending.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Missing</span><strong>{{ data.documents.summary.missing.toLocaleString() }}</strong></article>
        </div>

        <div class="split">
          <article class="panel">
            <h3>Document status distribution</h3>
            <div class="chart-container">
              <Doughnut :data="docsStatusData" :options="{ responsive: true, maintainAspectRatio: false }" />
            </div>
          </article>
          <article class="panel">
            <h3>Document types</h3>
            <div class="chart-container">
              <Bar :data="docsTypesData" :options="chartOptions" />
            </div>
          </article>
        </div>

        <section class="panel section">
          <div class="section-heading">
            <div>
              <h3>Document completion by class</h3>
              <p class="muted">Completion rates per class</p>
            </div>
            <span class="count-badge">{{ data.documents.completion_by_class.length }} classes</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th class="num">Required</th>
                  <th class="num">Submitted</th>
                  <th class="num">Completion rate</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="completion in data.documents.completion_by_class" :key="completion.class_id">
                  <td class="strong">{{ completion.class_name }}</td>
                  <td class="num">{{ completion.required_count }}</td>
                  <td class="num">{{ completion.submitted_count }}</td>
                  <td class="num">{{ completion.completion_rate }}%</td>
                </tr>
                <tr v-if="!data.documents.completion_by_class.length"><td colspan="4" class="empty">No document completion data available.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <!-- 8. Certificate Analytics -->
      <section v-if="isFinance && data.certificates" class="finance section">
        <header class="finance-heading">
          <p class="eyebrow dark">CERTIFICATES / ANALYTICS</p>
          <h2>Certificate analytics</h2>
          <p class="muted">Certificate issuance, eligibility, and batch statistics.</p>
        </header>

        <div class="kpi-grid">
          <article class="kpi"><span>Total issued</span><strong>{{ data.certificates.summary.total_issued.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Pending generation</span><strong>{{ data.certificates.summary.pending.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Revoked</span><strong>{{ data.certificates.summary.revoked.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Eligible trainees</span><strong>{{ data.certificates.eligibility.eligible.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Avg attendance</span><strong>{{ data.certificates.eligibility.avg_attendance }}%</strong></article>
        </div>

        <div class="split">
          <article class="panel">
            <h3>Monthly certificate issuance</h3>
            <div class="chart-container">
              <Line :data="certsTrendData" :options="chartOptions" />
            </div>
          </article>
          <article class="panel">
            <h3>Certificate status</h3>
            <div class="chart-container">
              <Doughnut :data="certsStatusData" :options="{ responsive: true, maintainAspectRatio: false }" />
            </div>
          </article>
        </div>

        <section class="panel section">
          <div class="section-heading">
            <div>
              <h3>Certificates per training batch</h3>
              <p class="muted">Batch statistics</p>
            </div>
            <span class="count-badge">{{ data.certificates.certificates_per_batch.length }} batches</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Program</th>
                  <th class="num">Certificates</th>
                  <th class="num">Trainees</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="batch in data.certificates.certificates_per_batch" :key="batch.class_id">
                  <td class="strong">{{ batch.class_name }}</td>
                  <td>{{ batch.program_name }}</td>
                  <td class="num">{{ batch.certificate_count }}</td>
                  <td class="num">{{ batch.trainee_count }}</td>
                </tr>
                <tr v-if="!data.certificates.certificates_per_batch.length"><td colspan="4" class="empty">No certificate batch data available.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <!-- 9. Announcement Analytics -->
      <section v-if="isFinance && data.announcements" class="finance section">
        <header class="finance-heading">
          <p class="eyebrow dark">ANNOUNCEMENTS / ANALYTICS</p>
          <h2>Announcement analytics</h2>
          <p class="muted">Published announcements and notification statistics.</p>
        </header>

        <div class="kpi-grid">
          <article class="kpi"><span>Total published</span><strong>{{ data.announcements.summary.total_published.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Email sent</span><strong>{{ data.announcements.summary.email_notifications.toLocaleString() }}</strong></article>
          <article class="kpi"><span>SMS sent</span><strong>{{ data.announcements.summary.sms_notifications.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Read notifications</span><strong>{{ data.announcements.summary.read_notifications.toLocaleString() }}</strong></article>
          <article class="kpi"><span>Failed notifications</span><strong>{{ data.announcements.summary.failed_notifications.toLocaleString() }}</strong></article>
        </div>

        <div class="split">
          <article class="panel">
            <h3>Notification types</h3>
            <div class="chart-container">
              <Doughnut :data="annTypesData" :options="{ responsive: true, maintainAspectRatio: false }" />
            </div>
          </article>
          <article class="panel">
            <h3>Read vs unread</h3>
            <div class="chart-container">
              <Doughnut :data="annReadData" :options="{ responsive: true, maintainAspectRatio: false }" />
            </div>
          </article>
        </div>

        <section class="panel section">
          <div class="section-heading">
            <div>
              <h3>Announcement readership</h3>
              <p class="muted">Read statistics</p>
            </div>
            <span class="count-badge">{{ data.announcements.read_statistics.length }} announcements</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Announcement</th>
                  <th>Published date</th>
                  <th class="num">Unique readers</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="stat in data.announcements.read_statistics" :key="stat.announcement_id">
                  <td class="strong">{{ stat.title }}</td>
                  <td>{{ stat.created_at }}</td>
                  <td class="num">{{ stat.unique_readers }}</td>
                </tr>
                <tr v-if="!data.announcements.read_statistics.length"><td colspan="3" class="empty">No announcement read data available.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </template>

    <section class="panel section ai-insights-panel" aria-labelledby="gemini-insights-heading">
      <header class="insights-heading">
        <div>
          <p class="eyebrow dark">AI / GEMINI</p>
          <h2 id="gemini-insights-heading">Smart analytics insights</h2>
          <p class="muted">Gemini interprets MySQL-calculated statistics. No trainee names, payment references, or credentials are sent.</p>
        </div>
        <button class="primary-button" type="button" :disabled="aiLoading" @click="generateAiInsights">
          {{ aiLoading ? 'Generating…' : 'Generate insights' }}
        </button>
      </header>

      <p v-if="aiLoading" class="insights-status" role="status">Gemini is analyzing the current analytics summary…</p>
      <p v-else-if="aiError" class="insights-error" role="alert">{{ aiError }}</p>
      <div v-else-if="aiInsights" class="insights-grid">
        <article><h3>Overview</h3><p>{{ aiInsights.overview }}</p><small v-if="aiInsights.generated_at">Generated {{ aiInsights.generated_at }}</small></article>
        <article><h3>Key observations</h3><ul><li v-for="item in aiInsights.key_observations" :key="item">{{ item }}</li></ul></article>
        <article><h3>Positive trends</h3><ul><li v-for="item in aiInsights.positive_trends" :key="item">{{ item }}</li></ul></article>
        <article><h3>Concerns</h3><ul><li v-for="item in aiInsights.concerns" :key="item">{{ item }}</li></ul></article>
        <article class="recommendations"><h3>Recommendations</h3><ol><li v-for="(item, index) in aiInsights.recommendations" :key="index"><strong>{{ item.priority }} priority:</strong> {{ item.action }} <span>{{ item.reason }}</span></li></ol></article>
        <article><h3>Data limitations</h3><ul><li v-for="item in aiInsights.data_limitations" :key="item">{{ item }}</li></ul></article>
      </div>
      <p v-else class="insights-status">Generate insights to identify trends and recommendations from this report.</p>
    </section>
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
  --muted: #5d6f82;
  --line: #e1e8f1;
  --field: #f1f5fb;
  /* these three were used below but never defined in the original */
  --text: #16263a;
  --border: #e1e8f1;
  --surface-subtle: #f7fafd;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  --chev: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d6f82' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");

  /* ---------- Icon set (line icons drawn as masks, so they take currentColor) ---------- */
  --i-users: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='8' r='3.5'/%3E%3Cpath d='M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6'/%3E%3Ccircle cx='17.5' cy='9' r='2.5'/%3E%3Cpath d='M17 14c2.6 0 4.5 1.8 4.5 4.5'/%3E%3C/svg%3E");
  --i-layers: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l9 5-9 5-9-5z'/%3E%3Cpath d='M3 13l9 5 9-5'/%3E%3C/svg%3E");
  --i-clipboard: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='6' y='4' width='12' height='17' rx='2'/%3E%3Cpath d='M9 2.5h6V6H9zM9 12h6M9 16h4'/%3E%3C/svg%3E");
  --i-gauge: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 17a8 8 0 1 1 16 0'/%3E%3Cpath d='M12 17l4-5'/%3E%3Ccircle cx='12' cy='17' r='1'/%3E%3C/svg%3E");
  --i-user-x: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='8' r='3.5'/%3E%3Cpath d='M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6'/%3E%3Cpath d='M17 9l4 4M21 9l-4 4'/%3E%3C/svg%3E");
  --i-wallet: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z'/%3E%3Cpath d='M4 7l12-3v3'/%3E%3Ccircle cx='16' cy='13.5' r='1'/%3E%3C/svg%3E");
  --i-hourglass: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9'/%3E%3C/svg%3E");
  --i-shield: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z'/%3E%3Cpath d='M9 12l2 2 4-4'/%3E%3C/svg%3E");
  --i-undo: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 14L4 9l5-5'/%3E%3Cpath d='M4 9h10a6 6 0 0 1 0 12h-3'/%3E%3C/svg%3E");
  --i-ban: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M5.6 5.6l12.8 12.8'/%3E%3C/svg%3E");
  --i-clock: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M12 7v5l3 2'/%3E%3C/svg%3E");
  --i-funnel: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 5h18l-7 8v6l-4-2v-4z'/%3E%3C/svg%3E");
  --i-refresh: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5'/%3E%3C/svg%3E");
  --i-printer: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 9V3h10v6'/%3E%3Crect x='4' y='9' width='16' height='8' rx='2'/%3E%3Cpath d='M7 14h10v7H7z'/%3E%3C/svg%3E");
  --i-download: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 4v11M7 10l5 5 5-5M5 20h14'/%3E%3C/svg%3E");
  --i-sparkle: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'/%3E%3Cpath d='M19 16v4M17 18h4'/%3E%3C/svg%3E");
  --i-alert: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 4l9 16H3z'/%3E%3Cpath d='M12 10v4M12 17.5v.5'/%3E%3C/svg%3E");
  --i-trend-up: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 17l6-6 4 4 8-8'/%3E%3Cpath d='M15 7h6v6'/%3E%3C/svg%3E");
  --i-bulb: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 18h6M10 21h4'/%3E%3Cpath d='M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'/%3E%3C/svg%3E");
  --i-bars: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 20V10M12 20V4M19 20v-7'/%3E%3C/svg%3E");
  --i-coin: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M9 7v10M9 9h4.5a2 2 0 0 1 0 4H9'/%3E%3C/svg%3E");
  --i-file: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 3h7l5 5v13H7z'/%3E%3Cpath d='M14 3v5h5M10 13h6M10 17h6'/%3E%3C/svg%3E");
  --i-up: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 17L17 7M9 7h8v8'/%3E%3C/svg%3E");
  --i-flat: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h14M13 6l6 6-6 6'/%3E%3C/svg%3E");
  --i-down: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 7l10 10M17 9v8H9'/%3E%3C/svg%3E");
  --i-inbox: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 13l3-8h12l3 8v6H3z'/%3E%3Cpath d='M3 13h5l1 3h6l1-3h5'/%3E%3C/svg%3E");

  display: grid;
  gap: 20px;
  max-width: 1500px;
  margin: auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

/* ================= Icon base: every icon below shares these rules ================= */
.kpi::before,
.panel h2::before,
.panel h3::before,
.finance-heading h2::before,
.page-heading .secondary-button::before,
.button-group > *::before,
.filters .primary-button::before,
.insights-heading button::before,
.insights-heading h2::before,
.insights-grid h3::before,
.insights-status::before,
.rate::before,
.empty::before {
  content: '';
  flex: none;
  display: inline-block;
  width: 18px;
  height: 18px;
  background-color: currentColor;
  -webkit-mask-image: var(--icon);
  mask-image: var(--icon);
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  transition: transform 0.3s var(--spring), color 0.25s ease;
}

/* ================= Banner ================= */
.page-heading {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
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
  animation: drop-in 0.7s var(--ease) both;
}

/* concentric rings with a slowly rotating light, same motif as the sign-in pages */
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
  animation: orbit 42s linear infinite;
  pointer-events: none;
}

/* a small bar chart "breathes" behind the heading */
.page-heading::after {
  content: '';
  position: absolute;
  right: 8%;
  bottom: 0;
  z-index: -1;
  width: 150px;
  height: 96px;
  background:
    linear-gradient(rgb(143 196 245 / 34%), rgb(143 196 245 / 34%)) 0 100% / 18px 38% no-repeat,
    linear-gradient(rgb(143 196 245 / 26%), rgb(143 196 245 / 26%)) 33px 100% / 18px 64% no-repeat,
    linear-gradient(rgb(143 196 245 / 38%), rgb(143 196 245 / 38%)) 66px 100% / 18px 48% no-repeat,
    linear-gradient(rgb(143 196 245 / 30%), rgb(143 196 245 / 30%)) 99px 100% / 18px 86% no-repeat,
    linear-gradient(rgb(143 196 245 / 22%), rgb(143 196 245 / 22%)) 132px 100% / 18px 58% no-repeat;
  transform-origin: bottom;
  animation: bars-breathe 5s ease-in-out infinite;
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
  font-size: clamp(1.9rem, 3vw, 2.5rem);
  font-weight: 500;
  font-variation-settings: 'opsz' 120, 'SOFT' 50;
  letter-spacing: -0.025em;
  line-height: 1.05;
  animation: rise 0.7s var(--ease) 0.1s both;
}

.page-heading .muted {
  margin: 8px 0 0;
  color: rgb(255 255 255 / 78%);
  font-size: 15px;
  animation: rise 0.7s var(--ease) 0.2s both;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  padding: 5px 12px 5px 10px;
  border-radius: 999px;
  background: rgb(95 208 140 / 12%);
  box-shadow: inset 0 0 0 1px rgb(95 208 140 / 35%);
  color: #b9f0d0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.eyebrow::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5fd08c;
  animation: ping 2.2s ease-out infinite;
}

.eyebrow.dark {
  background: rgb(42 106 168 / 8%);
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 22%);
  color: var(--blue);
}

.eyebrow.dark::before {
  background: var(--blue);
  animation: ping-blue 2.4s ease-out infinite;
}

.muted {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.loading {
  padding: 24px 0;
  text-align: center;
  animation: breathe 1.4s ease-in-out infinite;
}

.section {
  margin-top: 20px;
}

/* ================= Filters ================= */
.filters,
.panel,
.kpi {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #fcfdff);
}

.panel {
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 14px 30px -22px rgb(17 44 73 / 40%);
  animation: rise 0.6s var(--ease) 0.15s both;
  transition: box-shadow 0.35s ease, border-color 0.35s ease;
}

.panel:hover {
  border-color: #d3deec;
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 24px 40px -24px rgb(17 44 73 / 48%);
}

.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(130px, 1fr));
  gap: 14px;
  align-items: end;
  margin: 18px 0;
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 14px 30px -22px rgb(17 44 73 / 40%);
  animation: rise 0.6s var(--ease) 0.1s both;
}

label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.01em;
  transition: color 0.2s ease;
}

label:has(input:focus, select:focus) {
  color: var(--blue);
}

/* 1px border is a second background layer, so a light can travel around it on focus */
input,
select {
  min-height: 44px;
  padding: 9px 13px;
  border: 1px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  color: var(--text);
  font: inherit;
  transition: box-shadow 0.3s ease, transform 0.3s var(--ease);
}

select {
  appearance: none;
  padding-right: 38px;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  cursor: pointer;
}

input:hover:not(:focus) {
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

select:hover:not(:focus) {
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

input:focus {
  outline: none;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

select:focus {
  outline: none;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

/* ================= Buttons ================= */
.primary-button,
.secondary-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 9px 18px;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
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

/* light sweep on hover (the icon uses ::before, the sweep uses ::after) */
.primary-button::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -60%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 32%), transparent);
  transform: skewX(-20deg);
  transition: left 0.8s var(--ease);
  pointer-events: none;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 34%), inset 0 -1px 0 rgb(0 0 0 / 18%), 0 22px 30px -16px rgb(38 95 148 / 95%);
}

.primary-button:hover:not(:disabled)::after {
  left: 130%;
}

/* busy: the sweep becomes a progress stripe along the bottom edge */
.primary-button:disabled::after {
  top: auto;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--ice), transparent);
  background-size: 50% 100%;
  background-repeat: no-repeat;
  transform: none;
  transition: none;
  animation: load 1.1s ease-in-out infinite;
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
  animation: pop-in 0.55s var(--spring) 0.3s both;
}

.page-heading .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 20%);
  transform: translateY(-2px);
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: translateY(0) scale(0.97);
}

.primary-button:focus-visible,
.secondary-button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* button icons */
.page-heading > .secondary-button::before,
.page-heading .button-group > :nth-child(1)::before {
  --icon: var(--i-refresh);
}

.button-group > :nth-child(2)::before {
  --icon: var(--i-printer);
}

.button-group > :nth-child(3)::before {
  --icon: var(--i-download);
}

.filters .primary-button::before {
  --icon: var(--i-funnel);
  width: 16px;
  height: 16px;
}

.insights-heading button::before {
  --icon: var(--i-sparkle);
}

/* refresh spins on hover; filter funnel tilts; print and download bounce */
.page-heading .secondary-button:hover:not(:disabled)::before {
  transform: rotate(180deg);
}

.page-heading .secondary-button:disabled::before {
  animation: spin 0.8s linear infinite;
}

.filters .primary-button:hover:not(:disabled)::before {
  transform: translateY(-1px) rotate(-12deg) scale(1.12);
}

.button-group > :nth-child(n + 2):hover::before {
  animation: icon-bounce 0.55s var(--spring);
}

.insights-heading button:hover:not(:disabled)::before {
  animation: twinkle 0.9s ease;
}

.inline-error {
  padding: 13px 16px;
  border-left: 3px solid var(--danger);
  border-radius: 10px;
  background: linear-gradient(90deg, #fdeceb, #fff6f5);
  color: var(--danger);
  animation: shake 0.45s ease both;
}

.print-meta {
  display: none;
}

/* ================= KPI cards: icon tile in the corner ================= */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin: 18px 0;
}

.kpi {
  --kc: var(--blue);
  --kt: #e0eefc;
  --kr: 42 106 168;
  position: relative;
  border-top: 3px solid var(--blue);
  background:
    radial-gradient(120% 90% at 100% 0%, rgb(var(--kr) / 9%), transparent 60%),
    linear-gradient(180deg, #fff, #fbfcfe);
  overflow: hidden;
  animation: pop-in 0.6s var(--spring) both;
  transition: transform 0.35s var(--ease), box-shadow 0.35s ease, border-color 0.35s ease;
}

.kpi:nth-child(1) { animation-delay: 0.05s; }
.kpi:nth-child(2) { animation-delay: 0.12s; }
.kpi:nth-child(3) { animation-delay: 0.19s; }
.kpi:nth-child(4) { animation-delay: 0.26s; }
.kpi:nth-child(5) { animation-delay: 0.33s; }
.kpi:nth-child(n + 6) { animation-delay: 0.4s; }

.kpi:nth-child(5n + 2) {
  --kc: #2f78b6;
  --kt: #e6f2fd;
  --kr: 74 147 214;
  border-top-color: var(--sky);
}

.kpi:nth-child(5n + 3) {
  --kc: var(--ok);
  --kt: #e3f4ea;
  --kr: 45 138 87;
  border-top-color: var(--ok);
}

.kpi:nth-child(5n + 4) {
  --kc: #b87400;
  --kt: #fbf0d3;
  --kr: 201 138 0;
  border-top-color: var(--warn);
}

.kpi:nth-child(5n) {
  --kc: var(--danger);
  --kt: #fdeceb;
  --kr: 180 40 31;
  border-top-color: var(--danger);
}

/* the tile behind the icon */
.kpi::after {
  content: '';
  position: absolute;
  top: 16px;
  right: 16px;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--kt);
  box-shadow: inset 0 0 0 1px rgb(var(--kr) / 20%);
  transition: transform 0.45s var(--spring), background 0.3s ease, box-shadow 0.3s ease;
}

.kpi::before {
  position: absolute;
  top: 27px;
  right: 27px;
  z-index: 1;
  width: 20px;
  height: 20px;
  color: var(--kc);
}

.kpi:hover {
  border-color: rgb(var(--kr) / 35%);
  transform: translateY(-5px);
  box-shadow: 0 26px 38px -24px rgb(var(--kr) / 55%);
}

/* on hover the tile fills with the card's colour and the icon turns white */
.kpi:hover::after {
  background: var(--kc);
  box-shadow: 0 14px 22px -12px rgb(var(--kr) / 80%);
  transform: rotate(-8deg) scale(1.1);
}

.kpi:hover::before {
  color: #fff;
  animation: icon-bounce 0.55s var(--spring);
}

/* attendance KPIs */
.kpi-grid .kpi:nth-child(1)::before { --icon: var(--i-users); }
.kpi-grid .kpi:nth-child(2)::before { --icon: var(--i-layers); }
.kpi-grid .kpi:nth-child(3)::before { --icon: var(--i-clipboard); }
.kpi-grid .kpi:nth-child(4)::before { --icon: var(--i-gauge); }
.kpi-grid .kpi:nth-child(5)::before { --icon: var(--i-user-x); }

/* finance KPIs override the same positions */
.finance .kpi-grid .kpi:nth-child(1)::before { --icon: var(--i-wallet); }
.finance .kpi-grid .kpi:nth-child(2)::before { --icon: var(--i-hourglass); }
.finance .kpi-grid .kpi:nth-child(3)::before { --icon: var(--i-shield); }
.finance .kpi-grid .kpi:nth-child(4)::before { --icon: var(--i-undo); }
.finance .kpi-grid .kpi:nth-child(5)::before { --icon: var(--i-ban); }
.finance .kpi-grid .kpi:nth-child(6)::before { --icon: var(--i-clock); }

.kpi span {
  display: block;
  padding-right: 52px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.kpi strong {
  display: block;
  margin-top: 12px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 32px;
  font-weight: 500;
  font-variation-settings: 'opsz' 96, 'SOFT' 40;
  line-height: 1.05;
  letter-spacing: -0.02em;
  animation: number-in 0.8s var(--ease) 0.3s both;
}

.kpi-sub {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 13px;
}

/* ================= Headings in panels (each gets a small icon) ================= */
.panel h2,
.panel h3,
.finance-heading h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-variation-settings: 'opsz' 48, 'SOFT' 40;
  letter-spacing: -0.015em;
}

.panel h2,
.finance-heading h2 {
  font-size: 21px;
}

.panel h3 {
  font-size: 18px;
}

.panel h2::before,
.panel h3::before {
  --icon: var(--i-bars);
  width: 20px;
  height: 20px;
  color: var(--blue);
}

.finance .panel h3::before,
.finance-heading h2::before {
  --icon: var(--i-coin);
  width: 22px;
  height: 22px;
  color: var(--ok);
}

.panel:hover h2::before,
.panel:hover h3::before {
  transform: translateY(-2px) rotate(-8deg);
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.count-badge {
  padding: 6px 13px;
  border-radius: 999px;
  background: #e0eefc;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 18%);
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  animation: pop-in 0.5s var(--spring) 0.4s both;
}

/* ================= Two-column rows ================= */
.split {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 18px;
  align-items: start;
}

.split > :first-child {
  animation: slide-left 0.7s var(--ease) 0.2s both;
}

.split > :last-child {
  animation: slide-right 0.7s var(--ease) 0.3s both;
}

.stack {
  display: grid;
  gap: 18px;
}

/* panels inside a sliding column should not animate twice */
.stack > .panel {
  animation: none;
}

/* ================= Trend chart: bars grow up from the baseline ================= */
.trend {
  display: flex;
  gap: 8px;
  align-items: stretch;
  height: 230px;
  margin-top: 22px;
  padding: 0 2px;
  overflow-x: auto;
  background-image: linear-gradient(var(--line) 1px, transparent 1px);
  background-size: 100% 40px;
  background-position: 0 4px;
  animation: fade-in 0.8s ease 0.3s both;
}

.trend-day {
  flex: 1;
  min-width: 40px;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 8px;
  border-radius: 10px;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  transition: background 0.25s ease;
}

.trend-day:hover {
  background: linear-gradient(180deg, rgb(143 196 245 / 22%), rgb(143 196 245 / 4%));
}

.bar-stack {
  height: 190px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  border-bottom: 1px solid #c8d5e5;
}

.bar {
  width: 10px;
  min-height: 0;
  border-radius: 5px 5px 1px 1px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 40%);
  transform-origin: bottom;
  animation: grow-up 0.9s var(--spring) both;
  transition: filter 0.2s ease, transform 0.25s var(--spring);
}

.trend-day:nth-child(1) .bar { animation-delay: 0.45s; }
.trend-day:nth-child(2) .bar { animation-delay: 0.49s; }
.trend-day:nth-child(3) .bar { animation-delay: 0.53s; }
.trend-day:nth-child(4) .bar { animation-delay: 0.57s; }
.trend-day:nth-child(5) .bar { animation-delay: 0.61s; }
.trend-day:nth-child(6) .bar { animation-delay: 0.65s; }
.trend-day:nth-child(7) .bar { animation-delay: 0.69s; }
.trend-day:nth-child(8) .bar { animation-delay: 0.73s; }
.trend-day:nth-child(9) .bar { animation-delay: 0.77s; }
.trend-day:nth-child(10) .bar { animation-delay: 0.81s; }
.trend-day:nth-child(11) .bar { animation-delay: 0.85s; }
.trend-day:nth-child(12) .bar { animation-delay: 0.89s; }
.trend-day:nth-child(n + 13) .bar { animation-delay: 0.93s; }

.trend-day:hover .bar {
  filter: brightness(1.1) saturate(1.1);
  transform: scaleX(1.25);
}

.present {
  background: linear-gradient(180deg, #4cb37d, var(--ok));
}

.late {
  background: linear-gradient(180deg, #e5a824, var(--warn));
}

.absent {
  background: linear-gradient(180deg, #d4544a, var(--danger));
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--muted);
  font-size: 12px;
}

.legend span::before {
  content: '';
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 7px;
  border-radius: 3px;
  background: var(--ok);
}

.legend span:nth-child(2)::before {
  background: var(--warn);
}

.legend span:nth-child(3)::before {
  background: var(--danger);
}

/* ================= Status breakdown: gauges fill ================= */
.status-block {
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  animation: rise 0.5s var(--ease) both;
}

.status-block:nth-of-type(1) { animation-delay: 0.45s; }
.status-block:nth-of-type(2) { animation-delay: 0.53s; }
.status-block:nth-of-type(3) { animation-delay: 0.61s; }
.status-block:nth-of-type(n + 4) { animation-delay: 0.69s; }

.status-block:last-child {
  border-bottom: 0;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  transition: padding-left 0.25s var(--ease);
}

.status-row:hover {
  padding-left: 6px;
}

.status-block .status-row {
  padding: 0 0 8px;
  border-bottom: 0;
}

.status-row strong {
  color: var(--navy-deep);
}

.status-name {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  text-transform: capitalize;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--blue);
  box-shadow: 0 0 0 3px rgb(42 106 168 / 14%);
}

.mini-track {
  height: 8px;
  border-radius: 4px;
  background: var(--field);
  box-shadow: inset 0 1px 2px rgb(17 44 73 / 8%);
  overflow: hidden;
}

.mini-track i {
  display: block;
  height: 100%;
  border-radius: 4px;
  transform-origin: left;
  animation: gauge-fill 1s var(--ease) 0.7s both;
  transition: width 0.3s ease;
}

/* ================= Chart containers (Chart.js canvases) ================= */
.chart-container {
  position: relative;
  height: 250px;
  margin-top: 20px;
  animation: wipe-in 1s var(--ease) 0.35s both;
}

/* ================= Tables: rows cascade in ================= */
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 14px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

thead {
  background: linear-gradient(180deg, #f3f7fd, var(--field));
}

th {
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  color: var(--navy);
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
  text-align: left;
  white-space: nowrap;
}

th.num {
  text-align: right;
}

td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  color: var(--text);
}

tbody tr {
  animation: row-in 0.5s var(--ease) both;
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

tbody tr:hover {
  background: #f4f8fe;
  box-shadow: inset 3px 0 0 var(--blue);
}

tbody tr:last-child td {
  border-bottom: 0;
}

td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

td.strong {
  color: var(--navy-deep);
  font-weight: 650;
  transition: color 0.2s ease;
}

tbody tr:hover td.strong {
  color: var(--blue);
}

.empty {
  padding: 28px;
  color: var(--muted);
  text-align: center;
}

.empty::before {
  --icon: var(--i-inbox);
  display: block;
  width: 32px;
  height: 32px;
  margin: 0 auto 8px;
  color: #b6c8de;
  animation: bob 3s ease-in-out infinite;
}

/* ================= Collection tracking: bars fill ================= */
.collection-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 18px;
}

.collection-row {
  display: grid;
  grid-template-columns: 56px minmax(80px, 1fr) 120px;
  gap: 12px;
  align-items: center;
  font-size: 12.5px;
  animation: row-in 0.5s var(--ease) both;
}

.collection-row:nth-child(1) { animation-delay: 0.4s; }
.collection-row:nth-child(2) { animation-delay: 0.46s; }
.collection-row:nth-child(3) { animation-delay: 0.52s; }
.collection-row:nth-child(4) { animation-delay: 0.58s; }
.collection-row:nth-child(5) { animation-delay: 0.64s; }
.collection-row:nth-child(n + 6) { animation-delay: 0.7s; }

.collection-row strong {
  color: var(--navy-deep);
  text-align: right;
}

.collection-track {
  height: 10px;
  border-radius: 6px;
  background: var(--field);
  box-shadow: inset 0 1px 2px rgb(17 44 73 / 8%);
  overflow: hidden;
}

.collection-track i {
  display: block;
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--sky), var(--blue));
  box-shadow: 0 0 12px rgb(42 106 168 / 45%);
  transform-origin: left;
  animation: gauge-fill 1s var(--ease) 0.6s both;
  transition: width 0.3s ease;
}

.method {
  text-transform: capitalize;
}

.method em {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--field);
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 16%);
  color: var(--blue);
  font-size: 11.5px;
  font-style: normal;
  font-weight: 700;
}

/* ================= Rate pills: a small trend arrow shows the level ================= */
.rate {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px 4px 8px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 650;
  animation: pop-in 0.45s var(--spring) both;
}

.rate::before {
  width: 13px;
  height: 13px;
}

.rate.good {
  background: #e0f4e9;
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 22%);
  color: var(--ok);
}

.rate.good::before {
  --icon: var(--i-up);
}

.rate.mid {
  background: #fef6e6;
  box-shadow: inset 0 0 0 1px rgb(201 138 0 / 26%);
  color: #a86d00;
}

.rate.mid::before {
  --icon: var(--i-flat);
}

.rate.low {
  background: #fdeceb;
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 20%);
  color: var(--danger);
}

.rate.low::before {
  --icon: var(--i-down);
}

tbody tr:hover .rate::before {
  animation: icon-bounce 0.55s var(--spring);
}

/* ================= Finance section ================= */
.finance {
  padding-top: 20px;
  border-top: 3px solid var(--navy);
  animation: rise 0.65s var(--ease) 0.2s both;
}

.finance-heading {
  margin: 0 0 18px;
  padding: 22px 24px;
  border-radius: 18px;
  background:
    radial-gradient(60% 120% at 100% 0%, rgb(45 138 87 / 10%), transparent 70%),
    linear-gradient(180deg, #f6f9fd, var(--field));
  box-shadow: inset 0 0 0 1px var(--line);
}

.finance-heading h2 {
  margin: 6px 0 0;
  font-size: 26px;
}

.finance-heading .muted {
  margin: 6px 0 0;
  color: var(--muted);
}

/* ================= AI insights ================= */
.insights-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.insights-heading h2::before {
  --icon: var(--i-sparkle);
  width: 22px;
  height: 22px;
  color: var(--blue);
  animation: twinkle 3.4s ease-in-out 1s infinite;
}

.insights-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0;
  color: var(--muted);
  animation: breathe 1.6s ease-in-out infinite;
}

.insights-status::before {
  --icon: var(--i-sparkle);
  color: var(--blue);
  animation: twinkle 1.4s ease-in-out infinite;
}

.insights-error {
  margin: 12px 0 0;
  padding: 14px 16px;
  border: 1px solid #f0c7c7;
  border-radius: 12px;
  background: linear-gradient(90deg, #fff7f7, #fffafa);
  color: var(--danger);
  animation: shake 0.45s ease both;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.insights-grid article {
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background:
    radial-gradient(100% 80% at 100% 0%, rgb(143 196 245 / 12%), transparent 65%),
    var(--surface-subtle);
  animation: deal-in 0.65s var(--spring) both;
  transition: transform 0.35s var(--ease), box-shadow 0.35s ease, border-color 0.25s ease;
}

.insights-grid article:nth-child(1) { animation-delay: 0.15s; }
.insights-grid article:nth-child(2) { animation-delay: 0.25s; }
.insights-grid article:nth-child(3) { animation-delay: 0.35s; }
.insights-grid article:nth-child(n + 4) { animation-delay: 0.45s; }

.insights-grid article:hover {
  border-color: var(--sky);
  box-shadow: 0 22px 34px -24px rgb(17 44 73 / 55%);
  transform: translateY(-4px);
}

.insights-grid h3 {
  margin: 0 0 10px;
}

/* a different icon and color for each insight card */
.insights-grid article:nth-child(1) h3::before { --icon: var(--i-file); color: var(--blue); }
.insights-grid article:nth-child(2) h3::before { --icon: var(--i-alert); color: #b87400; }
.insights-grid article:nth-child(3) h3::before { --icon: var(--i-trend-up); color: var(--ok); }
.insights-grid .recommendations h3::before { --icon: var(--i-bulb); color: #b87400; }

.insights-grid article:hover h3::before {
  animation: icon-bounce 0.55s var(--spring);
}

.insights-grid ul,
.insights-grid ol {
  margin: 0;
  padding-left: 20px;
}

.insights-grid li {
  line-height: 1.55;
  animation: rise 0.45s var(--ease) both;
}

.insights-grid li:nth-child(1) { animation-delay: 0.4s; }
.insights-grid li:nth-child(2) { animation-delay: 0.48s; }
.insights-grid li:nth-child(3) { animation-delay: 0.56s; }
.insights-grid li:nth-child(4) { animation-delay: 0.64s; }
.insights-grid li:nth-child(n + 5) { animation-delay: 0.72s; }

.insights-grid li + li {
  margin-top: 8px;
}

.insights-grid li span {
  display: block;
  margin-top: 3px;
  color: var(--muted);
}

.insights-grid .recommendations {
  grid-column: 1 / -1;
}

/* ================= Keyframes ================= */
@keyframes drop-in { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
@keyframes rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-left { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: none; } }
@keyframes slide-right { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }
@keyframes pop-in { from { opacity: 0; transform: scale(0.82); } to { opacity: 1; transform: none; } }
@keyframes deal-in { 0% { opacity: 0; transform: translateY(24px) rotate(-1.4deg) scale(0.95); } 100% { opacity: 1; transform: none; } }
@keyframes row-in { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; } }
/* numbers settle in out of a slight blur, as if being calculated */
@keyframes number-in { from { opacity: 0; transform: translateY(14px) scale(0.92); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes grow-up { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes gauge-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes wipe-in { from { opacity: 0; clip-path: inset(0 100% 0 0); } to { opacity: 1; clip-path: inset(0 0 0 0); } }
@keyframes bars-breathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.78); } }
@keyframes icon-bounce { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-5px) scale(1.2); } 100% { transform: translateY(0) scale(1); } }
@keyframes twinkle { 0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; } 50% { transform: scale(1.22) rotate(18deg); opacity: 0.7; } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes ping { 0% { box-shadow: 0 0 0 0 rgb(95 208 140 / 65%); } 70%, 100% { box-shadow: 0 0 0 9px rgb(95 208 140 / 0%); } }
@keyframes ping-blue { 0% { box-shadow: 0 0 0 0 rgb(42 106 168 / 45%); } 70%, 100% { box-shadow: 0 0 0 9px rgb(42 106 168 / 0%); } }
@keyframes orbit { to { --angle: 360deg; } }
@keyframes spin-angle { to { --angle: 360deg; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes load { from { background-position: -50% 0; } to { background-position: 150% 0; } }
@keyframes breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes shake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-4px); } 40%, 60% { transform: translateX(4px); } }

/* ================= Responsive ================= */
@media (max-width: 900px) {
  .split {
    grid-template-columns: 1fr;
  }

  .split > :first-child,
  .split > :last-child {
    animation-name: rise;
  }

  .filters {
    grid-template-columns: 1fr 1fr;
  }

  .filters button {
    grid-column: span 2;
  }

  .insights-heading {
    flex-direction: column;
  }

  .insights-grid {
    grid-template-columns: 1fr;
  }

  .page-heading {
    flex-direction: column;
    align-items: flex-start;
    padding: 26px 22px;
    border-radius: 18px;
  }

  .page-heading::before {
    right: -60%;
    width: 420px;
  }

  .page-heading::after {
    display: none;
  }
}

@media (max-width: 600px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .filters {
    grid-template-columns: 1fr;
  }

  .filters button {
    grid-column: span 1;
  }

  .collection-row {
    grid-template-columns: 48px minmax(60px, 1fr) 96px;
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page,
  .page *,
  .page *::before,
  .page *::after {
    animation: none !important;
    transition: none !important;
  }
}

/* ================= Print ================= */
@media print {
  /* animations and decorative icons must not affect the printed page */
  .page,
  .page *,
  .page *::before,
  .page *::after {
    animation: none !important;
    transition: none !important;
  }

  .page-heading::before,
  .page-heading::after,
  .kpi::before,
  .kpi::after,
  .panel h2::before,
  .panel h3::before,
  .rate::before {
    display: none !important;
  }

  :global(.app-shell) {
    display: block;
    background: #fff;
  }

  :global(.sidebar),
  .button-group,
  .filters,
  .inline-error,
  .loading {
    display: none !important;
  }

  .print-meta {
    display: block;
    margin-bottom: 12px;
  }

  .print-meta p {
    margin: 4px 0;
  }

  :global(.main-content) {
    padding: 0 !important;
  }

  .page {
    max-width: none;
    color: #111;
    font-size: 10pt;
  }

  .page-heading {
    padding: 0 0 12px;
    color: #111;
    background: #fff;
    box-shadow: none;
  }

  .page-heading h1,
  .page-heading .muted {
    color: #111;
  }

  .kpi span {
    padding-right: 0;
  }

  .panel {
    break-inside: avoid;
    box-shadow: none;
    background: #fff;
  }

  .table-wrap {
    overflow: visible;
  }
}
</style>