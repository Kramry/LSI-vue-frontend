<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiGet, apiPost, getSession } from '../services/api'

interface ReportConfig {
  name: string
  description: string
  formats: string[]
  filters: string[]
}

interface ReportsData {
  reports: Record<string, ReportConfig>
  programs: Array<{ program_id: number; program_name: string }>
  classes: Array<{ class_id: number; class_name: string }>
}

const loading = ref(false)
const error = ref('')
const reportConfigs = ref<Record<string, ReportConfig>>({})
const programs = ref<Array<{ program_id: number; program_name: string }>>([])
const classes = ref<Array<{ class_id: number; class_name: string }>>([])

const reportType = ref('')
const format = ref('csv')
const startDate = ref('')
const endDate = ref('')
const programId = ref('')
const classId = ref('')
const status = ref('')
const feeKind = ref('')
const method = ref('')

const selectedReport = computed(() => reportConfigs.value[reportType.value])
const visibleFilters = computed(() => selectedReport.value?.filters || [])

const today = new Date()
const localDate = (date: Date) => {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

startDate.value = localDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000))
endDate.value = localDate(today)

async function loadReports() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiGet<ReportsData>('/reports')
    reportConfigs.value = response.data.reports
    programs.value = response.data.programs
    classes.value = response.data.classes
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load report configurations.'
  } finally {
    loading.value = false
  }
}

async function generateReport() {
  if (!reportType.value) {
    error.value = 'Please select a report type.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const formData = new FormData()
    formData.append('report_type', reportType.value)
    formData.append('format', format.value)
    formData.append('start_date', startDate.value)
    formData.append('end_date', endDate.value)

    if (programId.value) formData.append('program_id', programId.value)
    if (classId.value) formData.append('class_id', classId.value)
    if (status.value) formData.append('status', status.value)
    if (feeKind.value) formData.append('fee_kind', feeKind.value)
    if (method.value) formData.append('method', method.value)

    const response = await apiPost('/reports/generate', formData)

    if (response.ok) {
      // For PDF/CSV, the response will trigger a download
      error.value = 'Report generated successfully.'
    } else {
      error.value = response.message || 'Failed to generate report.'
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to generate report.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    await getSession()
    await loadReports()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load reports.'
  }
})
</script>

<template>
  <div class="page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">SMARTTRACK / REPORTING</p>
        <h1>Report Generator</h1>
        <p class="muted">Generate and download reports in PDF or CSV format.</p>
      </div>
    </header>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="loading && !Object.keys(reportConfigs).length" class="muted loading">Loading report configurations…</p>

    <template v-if="Object.keys(reportConfigs).length">
      <form class="panel filters" @submit.prevent="generateReport">
        <label>Report Type
          <select v-model="reportType" required>
            <option value="">Select a report type</option>
            <option v-for="(config, key) in reportConfigs" :key="key" :value="key">
              {{ config.name }} - {{ config.description }}
            </option>
          </select>
        </label>

        <label>Format
          <select v-model="format" required>
            <option value="csv">CSV (Excel)</option>
            <option value="pdf">PDF</option>
          </select>
        </label>

        <label>Start Date
          <input v-model="startDate" type="date" required>
        </label>

        <label>End Date
          <input v-model="endDate" type="date" required>
        </label>

        <label v-if="visibleFilters.includes('program_id')">Program
          <select v-model="programId">
            <option value="">All programs</option>
            <option v-for="program in programs" :key="program.program_id" :value="String(program.program_id)">
              {{ program.program_name }}
            </option>
          </select>
        </label>

        <label v-if="visibleFilters.includes('class_id')">Class
          <select v-model="classId">
            <option value="">All classes</option>
            <option v-for="cls in classes" :key="cls.class_id" :value="String(cls.class_id)">
              {{ cls.class_name }}
            </option>
          </select>
        </label>

        <label v-if="visibleFilters.includes('status')">Status
          <select v-model="status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>

        <label v-if="visibleFilters.includes('fee_kind')">Fee Type
          <select v-model="feeKind">
            <option value="">All fee types</option>
            <option value="registration">Registration Fee</option>
            <option value="bond">Bond Deposit</option>
          </select>
        </label>

        <label v-if="visibleFilters.includes('method')">Payment Method
          <select v-model="method">
            <option value="">All methods</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="online">Online Payment</option>
          </select>
        </label>

        <button class="primary-button" type="submit" :disabled="loading">{{ loading ? 'Generating…' : 'Generate Report' }}</button>
      </form>

      <section class="panel section">
        <div class="section-heading">
          <div>
            <h2>Available Reports</h2>
            <p class="muted">Select a report type to generate and download.</p>
          </div>
          <span class="count-badge">{{ Object.keys(reportConfigs).length }} reports</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Description</th>
                <th>Formats</th>
                <th>Filters</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(config, key) in reportConfigs" :key="key">
                <td class="strong">{{ config.name }}</td>
                <td>{{ config.description }}</td>
                <td>{{ config.formats.map(f => f.toUpperCase()).join(', ') }}</td>
                <td>{{ config.filters.map(f => f.replace('_', ' ')).map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
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
  --warn: #d99100;
  --danger: #c4372c;

  max-width: 1500px;
  margin: auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

.page-heading {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
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

.eyebrow {
  margin: 0 0 8px;
  color: var(--sky);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.muted {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.loading {
  padding: 24px 0;
  text-align: center;
}

.section {
  margin-top: 20px;
}

.filters,
.panel {
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
}

.panel {
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  align-items: end;
  margin: 18px 0;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
}

input,
select {
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

input:hover,
select:hover {
  border-color: #b6c8de;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 18%);
}

.primary-button {
  min-height: 42px;
  padding: 9px 16px;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  background: var(--blue);
  color: #fff;
}

.primary-button:hover:not(:disabled) {
  background: var(--blue-hover);
}

.primary-button:active:not(:disabled) {
  transform: translateY(1px);
}

.primary-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.inline-error {
  padding: 12px 14px;
  border-left: 3px solid var(--danger);
  border-radius: 6px;
  background: #fdeceb;
  color: var(--danger);
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.panel h2,
.panel h3 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
}

.panel h2 {
  font-size: 21px;
}

.panel h3 {
  font-size: 18px;
}

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
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

thead {
  background: var(--field);
}

th {
  padding: 12px 16px;
  text-align: left;
  color: var(--navy-deep);
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--line);
}

td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  color: var(--text);
}

td.strong {
  font-weight: 600;
  color: var(--navy-deep);
}

@media (max-width: 900px) {
  .filters {
    grid-template-columns: 1fr 1fr;
  }

  .filters button {
    grid-column: span 2;
  }

  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 600px) {
  .filters {
    grid-template-columns: 1fr;
  }

  .filters button {
    grid-column: span 1;
  }
}
</style>
