<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiGet, getSession } from '../services/api'

interface AttendanceRow {
  attendance_date: string
  time_in: string | null
  time_out: string | null
  status: string
  first_name: string
  last_name: string
  program_name: string | null
}
interface DashboardData {
  stats: { trainees: number; programs: number; present_today: number; follow_up: number }
  attendance: AttendanceRow[]
  announcements: Array<{ announcement_id: number; title: string; content: string; created_at: string }>
  charts?: {
    weekly: Array<{ date: string; total: number }>
    status: Record<string, number>
    programs: Array<{ name: string; code: string; trainees: number; attendance: number }>
    late_this_week: number
    absent_this_week: number
  }
}

const data = ref<DashboardData | null>(null)
const role = ref('')
const loading = ref(true)
const error = ref('')
const isStaff = computed(() => ['administrator', 'staff'].includes(role.value))
const today = computed(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date()))

const stats = computed(() => {
  if (!data.value) return []
  return [
    { title: role.value === 'trainee' ? 'My trainee profile' : 'Active trainees', value: data.value.stats.trainees, icon: '👥', color: '#dbeafe' },
    { title: 'Active programs', value: data.value.stats.programs, icon: '▦', color: '#ede9fe' },
    { title: 'Present today', value: data.value.stats.present_today, icon: '✓', color: '#dcfce7' },
    { title: role.value === 'trainee' ? 'Recent absences' : 'Follow-up needed', value: data.value.stats.follow_up, icon: '!', color: '#fee2e2' }
  ]
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiGet<DashboardData>('/dashboard')
    data.value = response.data
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load dashboard data.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const session = await getSession()
    role.value = session.user?.role || ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load your account.'
  }
  await load()
})
</script>

<template>
  <div class="dashboard">
    <header class="page-header">
      <div>
        <p class="eyebrow">LSI SMARTTRACK</p>
        <h1>Dashboard overview</h1>
        <p class="lead">Live trainee, attendance, and system updates.</p>
      </div>
      <div class="header-actions">
        <span class="date-label">{{ today }}</span>
        <button class="secondary-button" :disabled="loading" @click="load">Refresh</button>
      </div>
    </header>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="loading && !data" class="muted loading">Loading dashboard…</p>

    <template v-if="data">
      <section class="stats-grid" aria-label="Key figures">
        <article v-for="stat in stats" :key="stat.title" class="stat-card">
          <div class="stat-icon" :style="{ background: stat.color }">{{ stat.icon }}</div>
          <div class="stat-text">
            <p>{{ stat.title }}</p>
            <h2>{{ Number(stat.value).toLocaleString() }}</h2>
          </div>
        </article>
      </section>

      <div class="layout">
        <div class="main-col">
          <article v-if="data.charts" class="panel">
            <div class="panel-head">
              <div>
                <h2>Attendance this week</h2>
                <p class="muted">Daily attendance records for the last seven days.</p>
              </div>
            </div>
            <div class="weekly-chart">
              <div
                v-for="item in data.charts.weekly"
                :key="item.date"
                class="day-column"
                :class="{ peak: item.total > 0 && item.total === Math.max(...data.charts.weekly.map((day) => day.total)) }"
                :title="`${item.date}: ${item.total} records`"
              >
                <span>{{ item.total }}</span>
                <div class="bar-area">
                  <i :style="{ height: `${Math.min(100, item.total / Math.max(1, ...data.charts.weekly.map((day) => day.total)) * 100)}%` }"></i>
                </div>
                <small>{{ item.date }}</small>
              </div>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <h2>Recent attendance</h2>
                <p class="muted">Latest attendance activity visible to your account.</p>
              </div>
            </div>
            <div
              v-for="(item, index) in data.attendance"
              :key="`${item.attendance_date}-${item.time_in}-${index}`"
              class="activity"
            >
              <div class="activity-dot" :class="String(item.status || '').toLowerCase()"></div>
              <div class="activity-info">
                <strong>{{ item.first_name }} {{ item.last_name }}</strong>
                <p>{{ item.program_name || 'Trainee' }}</p>
              </div>
              <span class="status-pill" :class="String(item.status || '').toLowerCase()">{{ item.status }}</span>
              <div class="activity-meta">
                <span>{{ item.attendance_date }}</span>
                <small>{{ item.time_in || '—' }}</small>
              </div>
            </div>
            <p v-if="!data.attendance.length" class="empty">No recent attendance records.</p>
          </article>

          <article v-if="data.charts && isStaff" class="panel">
            <div class="panel-head">
              <div>
                <h2>Program overview</h2>
                <p class="muted">Active trainees and attendance records per program.</p>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Code</th>
                    <th class="num">Active trainees</th>
                    <th class="num">Attendance records</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="program in data.charts.programs" :key="program.code">
                    <td class="program-name">{{ program.name }}</td>
                    <td><span class="code-chip">{{ program.code }}</span></td>
                    <td class="num">{{ program.trainees }}</td>
                    <td class="num">{{ program.attendance }}</td>
                  </tr>
                  <tr v-if="!data.charts.programs.length">
                    <td colspan="4" class="empty">No program data available.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <aside class="side-col">
          <article class="panel quick-actions">
            <h2>Quick links</h2>
            <p class="muted">Go to common tasks</p>
            <RouterLink to="/trainees"><span>Manage trainees</span><b aria-hidden="true">→</b></RouterLink>
            <RouterLink to="/attendance"><span>View attendance</span><b aria-hidden="true">→</b></RouterLink>
            <RouterLink v-if="isStaff" to="/payments"><span>Manage payments</span><b aria-hidden="true">→</b></RouterLink>
            <RouterLink v-if="isStaff" to="/analytics"><span>View analytics</span><b aria-hidden="true">→</b></RouterLink>
            <RouterLink v-if="isStaff" to="/documents"><span>Review documents</span><b aria-hidden="true">→</b></RouterLink>
          </article>

          <article class="panel">
            <h2>Announcements</h2>
            <p class="muted">Latest published updates</p>
            <div v-for="item in data.announcements" :key="item.announcement_id" class="announcement">
              <strong>{{ item.title }}</strong>
              <p>{{ item.content }}</p>
              <small>{{ item.created_at }}</small>
            </div>
            <p v-if="!data.announcements.length" class="empty">No published announcements.</p>
          </article>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
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

/* ---------- Banner ---------- */
.page-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
  padding: 26px 28px;
  border-radius: 14px;
  color: #fff;
  background: var(--navy);
  overflow: hidden;
}

.page-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, transparent 0 120px, rgb(255 255 255 / 4%) 120px 121px);
  pointer-events: none;
}

.page-header > * {
  position: relative;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-label,
.secondary-button {
  padding: 10px 14px;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 8px;
  background: rgb(255 255 255 / 10%);
  color: #fff;
  font: inherit;
  font-size: 13px;
}

.secondary-button {
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 20%);
}

.secondary-button:active:not(:disabled) {
  transform: translateY(1px);
}

.secondary-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

/* ---------- Stat cards ---------- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--line);
  border-top: 3px solid var(--blue);
  border-radius: 12px;
  background: #fff;
}

.stat-card:nth-child(4n + 2) {
  border-top-color: var(--sky);
}

.stat-card:nth-child(4n + 3) {
  border-top-color: var(--ok);
}

.stat-card:nth-child(4n) {
  border-top-color: var(--warn);
}

.stat-icon {
  flex: none;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  font-size: 22px;
}

.stat-card p {
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.stat-card h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
}

/* ---------- Two-column layout ---------- */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 18px;
  align-items: start;
  margin-top: 18px;
}

.main-col,
.side-col {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.panel {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.panel h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 20px;
  font-weight: 600;
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

/* ---------- Weekly chart ---------- */
.weekly-chart {
  display: flex;
  gap: 10px;
  align-items: stretch;
  height: 220px;
  margin-top: 20px;
  background-image: linear-gradient(var(--line) 1px, transparent 1px);
  background-size: 100% 44px;
  background-position: 0 24px;
}

.day-column {
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
  border-radius: 8px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  transition: background 0.15s;
}

.day-column:hover {
  background: rgb(143 196 245 / 18%);
}

.day-column span {
  color: var(--navy-deep);
  font-weight: 700;
}

.bar-area {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-bottom: 1px solid #c8d5e5;
}

.bar-area i {
  width: min(30px, 60%);
  min-height: 2px;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg, #b9d9f7, #7aa7d0);
}

.day-column.peak .bar-area i {
  background: linear-gradient(180deg, var(--sky), var(--blue));
}

.day-column.peak span {
  color: var(--blue);
}

/* ---------- Activity ---------- */
.activity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}

.activity:last-of-type {
  border-bottom: 0;
}

.activity-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--blue);
}

.activity-dot.present {
  background: var(--ok);
}

.activity-dot.late {
  background: var(--warn);
}

.activity-dot.absent {
  background: var(--danger);
}

.activity-info {
  flex: 1;
  min-width: 0;
}

.activity-info strong {
  color: var(--navy-deep);
}

.activity-info p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.status-pill {
  padding: 4px 11px;
  border-radius: 999px;
  background: #e0eefc;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
}

.status-pill.present {
  background: #e3f4ea;
  color: #1f6b41;
}

.status-pill.late {
  background: #fbf0d3;
  color: #8a5d00;
}

.status-pill.absent {
  background: #fdeceb;
  color: var(--danger);
}

.activity-meta {
  display: grid;
  gap: 3px;
  min-width: 78px;
  text-align: right;
  color: var(--muted);
  font-size: 12px;
}

/* ---------- Side rail ---------- */
.quick-actions a {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f9fbfe;
  color: var(--navy-deep);
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}

.quick-actions a:first-of-type {
  margin-top: 14px;
}

.quick-actions a b {
  color: var(--blue);
  transition: transform 0.15s;
}

.quick-actions a:hover {
  border-color: var(--sky);
  background: #eef5fd;
}

.quick-actions a:hover b {
  transform: translateX(3px);
}

.quick-actions a:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.announcement {
  margin-top: 12px;
  padding: 12px 14px;
  border-left: 3px solid var(--sky);
  border-radius: 0 8px 8px 0;
  background: #f6f9fd;
}

.announcement strong {
  color: var(--navy-deep);
}

.announcement p {
  margin: 6px 0;
  color: #445769;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-line;
}

.announcement small {
  color: var(--muted);
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

.num {
  text-align: right;
}

.program-name {
  color: var(--navy-deep);
  font-weight: 600;
}

.code-chip {
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--field);
  color: var(--navy);
  font-size: 12px;
  font-weight: 700;
}

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f6f9fd;
}

/* ---------- States ---------- */
.inline-error {
  margin: 0 0 16px;
  padding: 12px 14px;
  border-left: 3px solid var(--danger);
  border-radius: 6px;
  background: #fdeceb;
  color: var(--danger);
}

.empty {
  padding: 24px;
  text-align: center;
  color: var(--muted);
}

/* ---------- Responsive ---------- */
@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .side-col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .side-col {
    grid-template-columns: 1fr;
  }

  .activity {
    flex-wrap: wrap;
  }

  .activity-meta {
    text-align: left;
  }
}

@media (max-width: 500px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px 20px;
  }

  .page-header h1 {
    font-size: 26px;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .panel {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .secondary-button,
  .day-column,
  .quick-actions a,
  .quick-actions a b {
    transition: none;
  }
}
</style>