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
            <RouterLink v-if="isStaff" to="/trainees"><span>Manage trainees</span><b aria-hidden="true">→</b></RouterLink>
            <RouterLink v-if="role !== 'trainee'" to="/attendance"><span>View attendance</span><b aria-hidden="true">→</b></RouterLink>
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
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  max-width: 1450px;
  margin: auto;
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
  gap: 14px;
  margin-bottom: 20px;
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

/* a light sweep that crosses the banner every few seconds */
.page-header::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -40%;
  width: 30%;
  background: linear-gradient(100deg, transparent, rgb(143 196 245 / 20%), transparent);
  transform: skewX(-20deg);
  animation: sweep 7s ease-in-out 1.2s infinite;
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
  font-size: clamp(1.65rem, 2.5vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.01em;
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

/* "live" dot beside the label */
.eyebrow::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5fd08c;
  animation: ping 2s ease-out infinite;
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
  position: relative;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s var(--spring);
}

.secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 20%);
  transform: translateY(-2px);
}

.secondary-button:active:not(:disabled) {
  transform: scale(0.96);
}

.secondary-button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

/* refresh in progress: a small spinner replaces the hover state */
.secondary-button:disabled {
  padding-right: 38px;
  opacity: 0.8;
  cursor: wait;
}

.secondary-button:disabled::after {
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

/* ================= Stat cards ================= */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.secondary-button,
.quick-actions a,
.header-actions a {
  min-height: 44px;
}

.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--line);
  border-top: 3px solid var(--blue);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  animation: pop-in 0.6s var(--spring) both;
  transition: transform 0.3s var(--ease), box-shadow 0.3s ease, border-color 0.3s ease;
}

.stat-card:nth-child(1) { animation-delay: 0.05s; }
.stat-card:nth-child(2) { animation-delay: 0.12s; }
.stat-card:nth-child(3) { animation-delay: 0.19s; }
.stat-card:nth-child(4) { animation-delay: 0.26s; }

.stat-card:nth-child(4n + 2) {
  border-top-color: var(--sky);
}

.stat-card:nth-child(4n + 3) {
  border-top-color: var(--ok);
}

.stat-card:nth-child(4n) {
  border-top-color: var(--warn);
}

/* glow that follows the card on hover */
.stat-card::after {
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

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 22px 34px -22px rgb(17 44 73 / 60%);
}

.stat-card:hover::after {
  opacity: 1;
}

.stat-icon {
  position: relative;
  z-index: 1;
  flex: none;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  font-size: 22px;
  transition: transform 0.4s var(--spring);
}

.stat-card:hover .stat-icon {
  transform: rotate(-8deg) scale(1.14);
}

.stat-card > div:not(.stat-icon),
.stat-card p,
.stat-card h2 {
  position: relative;
  z-index: 1;
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
  animation: number-in 0.7s var(--ease) 0.3s both;
}

/* ================= Layout and panels ================= */
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
  transition: box-shadow 0.3s ease, transform 0.3s var(--ease);
}

.panel:hover {
  box-shadow: 0 16px 34px -20px rgb(17 44 73 / 50%);
}

/* panels slide in from their own side */
.main-col > * {
  animation: slide-left 0.7s var(--ease) both;
}

.main-col > :nth-child(1) { animation-delay: 0.3s; }
.main-col > :nth-child(2) { animation-delay: 0.42s; }
.main-col > :nth-child(3) { animation-delay: 0.54s; }

.side-col > * {
  animation: slide-right 0.7s var(--ease) both;
}

.side-col > :nth-child(1) { animation-delay: 0.38s; }
.side-col > :nth-child(2) { animation-delay: 0.5s; }

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
  animation: breathe 1.4s ease-in-out infinite;
}

/* ================= Weekly chart: bars grow upward ================= */
.weekly-chart {
  display: flex;
  gap: 10px;
  align-items: stretch;
  width: 100%;
  min-height: 13.75rem;
  aspect-ratio: 16 / 5;
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
  transition: background 0.2s ease;
}

.day-column:hover {
  background: rgb(143 196 245 / 18%);
}

.day-column span {
  color: var(--navy-deep);
  font-weight: 700;
  animation: fade-in 0.5s ease 0.9s both;
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
  transform-origin: bottom;
  animation: grow 0.9s var(--spring) both;
  transition: filter 0.2s ease, transform 0.25s var(--spring);
}

.day-column:nth-child(1) .bar-area i { animation-delay: 0.55s; }
.day-column:nth-child(2) .bar-area i { animation-delay: 0.63s; }
.day-column:nth-child(3) .bar-area i { animation-delay: 0.71s; }
.day-column:nth-child(4) .bar-area i { animation-delay: 0.79s; }
.day-column:nth-child(5) .bar-area i { animation-delay: 0.87s; }
.day-column:nth-child(6) .bar-area i { animation-delay: 0.95s; }
.day-column:nth-child(7) .bar-area i { animation-delay: 1.03s; }

.day-column:hover .bar-area i {
  filter: brightness(1.08);
  transform: scaleX(1.12);
}

.day-column.peak .bar-area i {
  background: linear-gradient(180deg, var(--sky), var(--blue));
}

.day-column.peak span {
  color: var(--blue);
}

/* ================= Recent attendance: rows slide in ================= */
.activity {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 -10px;
  padding: 14px 10px;
  border-bottom: 1px solid var(--line);
  border-radius: 10px;
  animation: slide-left 0.55s var(--ease) both;
  transition: background 0.2s ease, transform 0.25s var(--ease);
}

.activity:nth-of-type(1) { animation-delay: 0.7s; }
.activity:nth-of-type(2) { animation-delay: 0.78s; }
.activity:nth-of-type(3) { animation-delay: 0.86s; }
.activity:nth-of-type(4) { animation-delay: 0.94s; }
.activity:nth-of-type(5) { animation-delay: 1.02s; }
.activity:nth-of-type(n + 6) { animation-delay: 1.1s; }

.activity:last-of-type {
  border-bottom: 0;
}

.activity:hover {
  background: #f6f9fd;
  transform: translateX(4px);
}

.activity-dot {
  position: relative;
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

/* a soft ring ripples out from the dot on hover */
.activity-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: inherit;
  opacity: 0;
}

.activity:hover .activity-dot::after {
  animation: ripple 0.9s ease-out infinite;
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
  transition: transform 0.25s var(--spring);
}

.activity:hover .status-pill {
  transform: scale(1.08);
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

/* ================= Side rail ================= */
.quick-actions a {
  position: relative;
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
  overflow: hidden;
  isolation: isolate;
  transition: color 0.3s ease, border-color 0.3s ease, transform 0.3s var(--ease);
}

.quick-actions a:first-of-type {
  margin-top: 14px;
}

/* the row fills with blue from the left on hover */
.quick-actions a::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(90deg, var(--blue), #2c6ba5);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s var(--ease);
}

.quick-actions a b {
  color: var(--blue);
  transition: transform 0.3s var(--spring), color 0.3s ease;
}

.quick-actions a:hover {
  border-color: var(--blue);
  color: #fff;
  transform: translateX(3px);
}

.quick-actions a:hover::before {
  transform: scaleX(1);
}

.quick-actions a:hover b {
  color: #fff;
  transform: translateX(5px);
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
  animation: slide-right 0.55s var(--ease) both;
  transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s var(--ease);
}

.announcement:nth-of-type(1) { animation-delay: 0.75s; }
.announcement:nth-of-type(2) { animation-delay: 0.85s; }
.announcement:nth-of-type(3) { animation-delay: 0.95s; }
.announcement:nth-of-type(n + 4) { animation-delay: 1.05s; }

.announcement:hover {
  border-left-color: var(--blue);
  background: #eef5fd;
  transform: translateX(-3px);
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

/* ================= Table ================= */
.table-wrap {
  overflow: auto;
  width: 100%;
  -webkit-overflow-scrolling: touch;
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
}

table {
  width: 100%;
  min-width: 34rem;
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
  display: inline-block;
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--field);
  color: var(--navy);
  font-size: 12px;
  font-weight: 700;
  transition: background 0.2s ease, color 0.2s ease, transform 0.25s var(--spring);
}

tbody tr {
  animation: fade-up-small 0.5s var(--ease) both;
  transition: background 0.2s ease;
}

tbody tr:nth-child(1) { animation-delay: 0.9s; }
tbody tr:nth-child(2) { animation-delay: 0.97s; }
tbody tr:nth-child(3) { animation-delay: 1.04s; }
tbody tr:nth-child(4) { animation-delay: 1.11s; }
tbody tr:nth-child(n + 5) { animation-delay: 1.18s; }

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f6f9fd;
}

tbody tr:hover .code-chip {
  background: var(--blue);
  color: #fff;
  transform: scale(1.06);
}

/* ================= States ================= */
.inline-error {
  margin: 0 0 16px;
  padding: 12px 14px;
  border-left: 3px solid var(--danger);
  border-radius: 6px;
  background: #fdeceb;
  color: var(--danger);
  animation: shake 0.45s ease both;
}

.empty {
  padding: 24px;
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

@keyframes pop-in {
  0% {
    opacity: 0;
    transform: translateY(22px) scale(0.92);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes slide-left {
  from {
    opacity: 0;
    transform: translateX(-26px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes slide-right {
  from {
    opacity: 0;
    transform: translateX(26px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes fade-up-small {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes grow {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
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

@keyframes sweep {
  0%,
  55% {
    left: -40%;
  }
  100% {
    left: 130%;
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

@keyframes ripple {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(2.8);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
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
@media (min-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .layout {
    grid-template-columns: minmax(0, 1fr) 21.25rem;
  }
}

@media (max-width: 1023px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .side-col {
    grid-template-columns: 1fr;
  }

  .side-col > * {
    animation-name: slide-left;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .side-col {
    grid-template-columns: 1fr;
  }

  .activity {
    flex-wrap: wrap;
  }

  .activity-meta {
    text-align: left;
  }

  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .secondary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .weekly-chart {
    gap: 0.5rem;
    min-height: 12rem;
    aspect-ratio: 4 / 3;
    overflow-x: auto;
  }

  .day-column {
    min-width: 2.75rem;
  }

  .panel,
  .stat-card {
    padding: clamp(1rem, 4vw, 1.375rem);
  }

  .panel h2 {
    font-size: clamp(1.125rem, 5vw, 1.25rem);
  }

  .muted,
  .lead {
    font-size: clamp(0.8125rem, 3.5vw, 0.875rem);
  }
}

@media (max-width: 479px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    padding: clamp(1rem, 5vw, 1.375rem);
  }

  .page-header h1 {
    font-size: clamp(1.45rem, 7vw, 1.625rem);
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .panel {
    padding: 1rem;
  }

  .stat-card {
    gap: 0.875rem;
  }

  table {
    min-width: 30rem;
  }

  .date-label,
  .secondary-button {
    width: 100%;
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page-header,
  .page-header::after,
  .eyebrow::before,
  .stat-card,
  .stat-card h2,
  .main-col > *,
  .side-col > *,
  .loading,
  .day-column span,
  .bar-area i,
  .activity,
  .announcement,
  tbody tr,
  .inline-error,
  .secondary-button:disabled::after,
  .activity:hover .activity-dot::after {
    animation: none;
  }

  .secondary-button,
  .stat-card,
  .stat-card::after,
  .stat-icon,
  .panel,
  .day-column,
  .bar-area i,
  .activity,
  .status-pill,
  .quick-actions a,
  .quick-actions a::before,
  .quick-actions a b,
  .announcement,
  .code-chip,
  tbody tr {
    transition: none;
  }
}
</style>