<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiGet, getSession } from '../services/api'

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
const isFinance = computed(() => ['administrator', 'staff'].includes(role.value))
const maxTrendValue = computed(() => Math.max(1, ...(data.value?.trend.map((item) => item.present + item.late + item.absent) ?? [1])))

function money(value: unknown) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
}

function barWidth(value: number, max: number) {
  return `${max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0}%`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const query = new URLSearchParams({ start_date: startDate.value, end_date: endDate.value })
    if (classId.value) query.set('class_id', classId.value)
    const response = await apiGet<AnalyticsData>(`/analytics?${query}`)
    data.value = response.data
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
      <button class="secondary-button" :disabled="loading" @click="load">Refresh</button>
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

/* ---------- Banner ---------- */
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

.eyebrow.dark {
  color: var(--blue);
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

/* ---------- Filters ---------- */
.filters,
.panel,
.kpi {
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
  grid-template-columns: repeat(4, minmax(130px, 1fr));
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

/* ---------- Buttons ---------- */
.primary-button,
.secondary-button {
  min-height: 42px;
  padding: 9px 16px;
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

.page-heading .secondary-button {
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
}

.page-heading .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: translateY(1px);
}

.primary-button:disabled,
.secondary-button:disabled {
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

/* ---------- KPI cards ---------- */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin: 18px 0;
}

.kpi {
  border-top: 3px solid var(--blue);
}

.kpi:nth-child(5n + 2) {
  border-top-color: var(--sky);
}

.kpi:nth-child(5n + 3) {
  border-top-color: var(--ok);
}

.kpi:nth-child(5n + 4) {
  border-top-color: var(--warn);
}

.kpi:nth-child(5n) {
  border-top-color: var(--danger);
}

.kpi span {
  display: block;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.kpi strong {
  display: block;
  margin-top: 10px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
}

.kpi-sub {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 13px;
}

/* ---------- Headings in panels ---------- */
.panel h2,
.panel h3,
.finance-heading h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
}

.panel h2,
.finance-heading h2 {
  font-size: 21px;
}

.panel h3 {
  font-size: 18px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
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

/* ---------- Two-column rows ---------- */
.split {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 18px;
  align-items: start;
}

.stack {
  display: grid;
  gap: 18px;
}

/* ---------- Trend chart ---------- */
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
}

.trend-day {
  flex: 1;
  min-width: 40px;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 8px;
  border-radius: 8px;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  transition: background 0.15s;
}

.trend-day:hover {
  background: rgb(143 196 245 / 20%);
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
  border-radius: 4px 4px 0 0;
  transition: filter 0.15s;
}

.trend-day:hover .bar {
  filter: brightness(1.08);
}

.present {
  background: var(--ok);
}

.late {
  background: var(--warn);
}

.absent {
  background: var(--danger);
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

/* ---------- Status breakdown ---------- */
.status-block {
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

.status-block:last-child {
  border-bottom: 0;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
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
}

.mini-track {
  height: 8px;
  border-radius: 8px;
  background: #e8eef7;
  overflow: hidden;
}

.mini-track i {
  display: block;
  height: 100%;
  border-radius: 8px;
  background: var(--blue);
}

.method {
  text-transform: capitalize;
}

.method em {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--field);
  color: var(--blue);
  font-size: 11.5px;
  font-style: normal;
  font-weight: 700;
}

/* ---------- Tables ---------- */
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
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  background: var(--field);
  color: var(--navy);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.num {
  text-align: right;
}

.strong {
  color: var(--navy-deep);
  font-weight: 600;
}

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f6f9fd;
}

.rate {
  display: inline-block;
  min-width: 56px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
  text-align: center;
}

.rate.good {
  background: #e3f4ea;
  color: #1f6b41;
}

.rate.mid {
  background: #fbf0d3;
  color: #8a5d00;
}

.rate.low {
  background: #fdeceb;
  color: var(--danger);
}

.empty {
  padding: 26px;
  text-align: center;
  color: var(--muted);
}

/* ---------- Finance ---------- */
.finance {
  padding-top: 8px;
  border-top: 1px dashed #b6c8de;
}

.finance-heading {
  margin-top: 22px;
}

.collection-list {
  margin-top: 14px;
}

.collection-row {
  display: grid;
  grid-template-columns: 56px minmax(80px, 1fr) 120px;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  font-size: 12.5px;
}

.collection-row strong {
  text-align: right;
  color: var(--navy-deep);
}

.collection-track {
  height: 10px;
  border-radius: 8px;
  background: #e8eef7;
  overflow: hidden;
}

.collection-track i {
  display: block;
  height: 100%;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--sky), var(--blue));
}

/* ---------- Responsive ---------- */
@media (max-width: 1000px) {
  .split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 850px) {
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .filters {
    grid-template-columns: 1fr;
  }

  .page-heading {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px 20px;
  }

  .page-heading h1 {
    font-size: 26px;
  }

  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .kpi {
    padding: 14px;
  }

  .kpi strong {
    font-size: 22px;
  }

  .section-heading {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  input,
  select,
  .primary-button,
  .secondary-button,
  .trend-day,
  .bar {
    transition: none;
  }
}
</style>