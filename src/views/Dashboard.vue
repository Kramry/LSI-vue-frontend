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
/* Registered so the angle can be animated (orbit light, hover borders) */
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.dashboard {
  --navy: #173a60;
  --navy-deep: #0d2239;
  --ink: #081727;
  --blue: #2a6aa8;
  --blue-hover: #215a92;
  --sky: #8fc4f5;
  --ice: #e6f3ff;
  --gold: #e8c98a;
  --text: #16263a;
  --muted: #5d6f82;
  --line: #e1e8f1;
  --field: #eef3fb;
  --ok: #2d8a57;
  --warn: #c98a00;
  --danger: #b4281f;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");

  /* line icons for the stat cards (drawn with CSS masks, no emoji) */
  --i-people: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='9' cy='8' r='3.2'/><path d='M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5'/><circle cx='17' cy='9' r='2.4'/><path d='M17 14c2.5 0 4.5 1.7 4.5 4.5'/></svg>");
  --i-check: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='9'/><path d='M8 12.5l3 3 5-6'/></svg>");
  --i-clock: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='9'/><path d='M12 7v5l3.5 2'/></svg>");
  --i-calendar: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='3.5' y='5' width='17' height='15' rx='3'/><path d='M3.5 10h17M8 3v4M16 3v4'/></svg>");

  width: 100%;
  min-width: 0;
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
  padding: 30px 32px;
  border-radius: 20px;
  color: #fff;
  overflow: hidden;
  isolation: isolate;
  background:
    var(--grain),
    radial-gradient(40% 90% at 8% 0%, rgb(143 196 245 / 34%), transparent 70%),
    radial-gradient(30% 80% at 60% 120%, rgb(232 201 138 / 14%), transparent 70%),
    radial-gradient(45% 100% at 100% 60%, rgb(42 106 168 / 65%), transparent 72%),
    linear-gradient(120deg, #1d4a79 0%, var(--navy) 40%, var(--navy-deep) 100%);
  background-size: 180px 180px, auto, auto, auto, auto;
  background-blend-mode: soft-light, normal, normal, normal, normal;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 10%),
    0 24px 40px -28px rgb(8 23 39 / 80%);
  animation: drop-in 0.7s var(--ease) both;
}

/* concentric rings with a slowly rotating light, same motif as sign-in */
.page-header::before {
  content: '';
  position: absolute;
  top: 50%;
  right: -8%;
  z-index: -1;
  width: 520px;
  aspect-ratio: 1;
  translate: 0 -50%;
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle at center, transparent 0 46px, rgb(255 255 255 / 8%) 46px 47px),
    conic-gradient(
      from var(--angle),
      transparent 0deg,
      rgb(143 196 245 / 26%) 40deg,
      transparent 90deg,
      transparent 210deg,
      rgb(232 201 138 / 16%) 250deg,
      transparent 300deg
    );
  -webkit-mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  animation: orbit 40s linear infinite;
  pointer-events: none;
}

/* a light sweep that crosses the banner every few seconds */
.page-header::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -40%;
  z-index: -1;
  width: 24%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 12%), transparent);
  transform: skewX(-20deg);
  animation: sweep 8s ease-in-out 1.4s infinite;
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
  font-size: clamp(1.75rem, 2.8vw, 2.4rem);
  font-weight: 500;
  font-variation-settings: 'opsz' 120, 'SOFT' 50;
  letter-spacing: -0.025em;
  line-height: 1.05;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  padding: 4px 12px 4px 10px;
  border-radius: 999px;
  background: rgb(95 208 140 / 12%);
  box-shadow: inset 0 0 0 1px rgb(95 208 140 / 35%);
  color: #b9f0d0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
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
  max-width: 40em;
  margin: 10px 0 0;
  color: rgb(255 255 255 / 78%);
  font-size: 15px;
  line-height: 1.55;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-label,
.secondary-button {
  padding: 10px 16px;
  border: 0;
  border-radius: 12px;
  background: rgb(255 255 255 / 10%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 22%);
  backdrop-filter: blur(10px);
  color: #fff;
  font: inherit;
  font-size: 13px;
}

.secondary-button {
  position: relative;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.25s var(--spring), box-shadow 0.25s ease;
}

.secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 20%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 38%), 0 12px 22px -12px rgb(0 0 0 / 60%);
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
  min-width: 0;
  gap: 16px;
}

.secondary-button,
.quick-actions a,
.header-actions a {
  min-height: 44px;
}

.stat-card {
  /* each card carries its own tone; the icon tile, accent and glow all read from it */
  --tone: var(--blue);
  --tone-rgb: 42 106 168;
  --icon: var(--i-people);

  position: relative;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background:
    radial-gradient(120% 90% at 100% 0%, rgb(var(--tone-rgb) / 9%), transparent 60%),
    linear-gradient(180deg, #fff, #fbfcfe);
  overflow: hidden;
  animation: pop-in 0.7s var(--spring) both;
  transition: transform 0.35s var(--ease), box-shadow 0.35s ease, border-color 0.35s ease;
}

.stat-card:nth-child(1) { animation-delay: 0.05s; }
.stat-card:nth-child(2) { animation-delay: 0.12s; }
.stat-card:nth-child(3) { animation-delay: 0.19s; }
.stat-card:nth-child(4) { animation-delay: 0.26s; }

.stat-card:nth-child(4n + 1) {
  --tone: var(--blue);
  --tone-rgb: 42 106 168;
  --icon: var(--i-people);
}

.stat-card:nth-child(4n + 2) {
  --tone: #4a93d6;
  --tone-rgb: 74 147 214;
  --icon: var(--i-check);
}

.stat-card:nth-child(4n + 3) {
  --tone: var(--ok);
  --tone-rgb: 45 138 87;
  --icon: var(--i-clock);
}

.stat-card:nth-child(4n) {
  --tone: var(--warn);
  --tone-rgb: 201 138 0;
  --icon: var(--i-calendar);
}

/* accent: a short tone-coloured line that stretches across on hover */
.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 22px;
  width: 36px;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--tone);
  transition: width 0.5s var(--ease);
}

/* glow that follows the card on hover */
.stat-card::after {
  content: '';
  position: absolute;
  top: -60%;
  right: -30%;
  width: 70%;
  height: 160%;
  background: radial-gradient(circle, rgb(var(--tone-rgb) / 22%), transparent 65%);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}

.stat-card:hover {
  border-color: rgb(var(--tone-rgb) / 35%);
  transform: translateY(-5px);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 80%) inset,
    0 26px 38px -24px rgb(var(--tone-rgb) / 55%);
}

.stat-card:hover::before {
  width: calc(100% - 44px);
}

.stat-card:hover::after {
  opacity: 1;
}

/* Icon tile. Whatever text/emoji is inside is hidden and a line icon is drawn instead. */
.stat-icon {
  position: relative;
  z-index: 1;
  flex: none;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 70%), rgb(255 255 255 / 0%) 60%),
    rgb(var(--tone-rgb) / 12%);
  box-shadow:
    inset 0 0 0 1px rgb(var(--tone-rgb) / 22%),
    0 10px 18px -12px rgb(var(--tone-rgb) / 70%);
  font-size: 0;
  line-height: 0;
  color: transparent;
  transition: transform 0.45s var(--spring), background 0.3s ease, box-shadow 0.3s ease;
}

.stat-icon::before {
  content: '';
  width: 26px;
  height: 26px;
  background: var(--tone);
  -webkit-mask: var(--icon) center / contain no-repeat;
  mask: var(--icon) center / contain no-repeat;
  transition: background 0.3s ease;
}

.stat-card:hover .stat-icon {
  background: var(--tone);
  box-shadow: 0 14px 22px -12px rgb(var(--tone-rgb) / 85%);
  transform: rotate(-6deg) scale(1.1);
}

.stat-card:hover .stat-icon::before {
  background: #fff;
}

.stat-card > div:not(.stat-icon),
.stat-card p,
.stat-card h2 {
  position: relative;
  z-index: 1;
}

.stat-card p {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.stat-card h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 34px;
  font-weight: 500;
  font-variation-settings: 'opsz' 96, 'SOFT' 40;
  line-height: 1.05;
  letter-spacing: -0.02em;
  animation: number-in 0.7s var(--ease) 0.3s both;
}

/* ================= Layout and panels ================= */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  min-width: 0;
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
  position: relative;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #fcfdff);
  box-shadow:
    0 1px 2px rgb(17 44 73 / 5%),
    0 14px 30px -22px rgb(17 44 73 / 40%);
  transition: box-shadow 0.35s ease, transform 0.35s var(--ease), border-color 0.35s ease;
}

.panel:hover {
  border-color: #d3deec;
  box-shadow:
    0 1px 2px rgb(17 44 73 / 5%),
    0 24px 40px -24px rgb(17 44 73 / 48%);
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
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 21px;
  font-weight: 600;
  font-variation-settings: 'opsz' 48, 'SOFT' 40;
  letter-spacing: -0.015em;
}

/* small tone mark before each panel title */
.panel h2::before {
  content: '';
  flex: none;
  width: 4px;
  height: 18px;
  border-radius: 4px;
  background: linear-gradient(180deg, var(--sky), var(--blue));
}

.muted {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.loading {
  padding: 24px 0;
  text-align: center;
  animation: breathe 1.4s ease-in-out infinite;
}

/* ================= Weekly chart: bars grow upward ================= */
.weekly-chart {
  display: flex;
  gap: 12px;
  align-items: stretch;
  width: 100%;
  min-width: 0;
  min-height: 13.75rem;
  aspect-ratio: 16 / 5;
  margin-top: 22px;
  position: relative;
}

.weekly-chart::before {
  content: '';
  position: absolute;
  inset: 24px 0 36px;
  z-index: 0;
  background: repeating-linear-gradient(180deg, transparent 0 43px, var(--line) 43px 44px);
  pointer-events: none;
}

.day-column {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
  border-radius: 10px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  transition: background 0.25s ease;
}

.day-column:hover {
  background: linear-gradient(180deg, rgb(143 196 245 / 22%), rgb(143 196 245 / 4%));
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
  width: min(32px, 60%);
  min-height: 3px;
  border-radius: 8px 8px 2px 2px;
  background: linear-gradient(180deg, #c9e2f9, #7aa7d0);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 60%);
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
  filter: brightness(1.06) saturate(1.1);
  transform: scaleX(1.12);
}

/* the busiest day is the one thing that glows */
.day-column.peak .bar-area i {
  background: linear-gradient(180deg, var(--sky), var(--blue));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 50%),
    0 0 0 4px rgb(42 106 168 / 10%),
    0 12px 22px -8px rgb(42 106 168 / 65%);
}

.day-column.peak span {
  color: var(--blue);
}

/* ================= Recent attendance: rows slide in ================= */
.activity {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 -12px;
  padding: 14px 12px;
  border-bottom: 1px solid var(--line);
  border-radius: 12px;
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
  background: linear-gradient(90deg, #f3f8fe, #fafcff);
  transform: translateX(4px);
}

.activity-dot {
  position: relative;
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--blue);
  box-shadow: 0 0 0 3px rgb(42 106 168 / 14%);
}

.activity-dot.present {
  background: var(--ok);
  box-shadow: 0 0 0 3px rgb(45 138 87 / 16%);
}

.activity-dot.late {
  background: var(--warn);
  box-shadow: 0 0 0 3px rgb(201 138 0 / 16%);
}

.activity-dot.absent {
  background: var(--danger);
  box-shadow: 0 0 0 3px rgb(180 40 31 / 14%);
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
  font-weight: 650;
}

.activity-info p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.status-pill {
  padding: 5px 12px;
  border-radius: 999px;
  background: #e0eefc;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 18%);
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
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 22%);
  color: #1f6b41;
}

.status-pill.late {
  background: #fbf0d3;
  box-shadow: inset 0 0 0 1px rgb(201 138 0 / 26%);
  color: #8a5d00;
}

.status-pill.absent {
  background: #fdeceb;
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 20%);
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
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #f9fbfe;
  color: var(--navy-deep);
  font-weight: 600;
  text-decoration: none;
  overflow: hidden;
  isolation: isolate;
  transition: color 0.3s ease, border-color 0.3s ease, transform 0.3s var(--ease), box-shadow 0.3s ease;
}

.quick-actions a:first-of-type {
  margin-top: 16px;
}

/* the row fills with blue from the left on hover */
.quick-actions a::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(90deg, var(--blue), #3a7fbf);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.45s var(--ease);
}

.quick-actions a b {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgb(42 106 168 / 10%);
  color: var(--blue);
  transition: transform 0.3s var(--spring), color 0.3s ease, background 0.3s ease;
}

.quick-actions a:hover {
  border-color: var(--blue);
  color: #fff;
  box-shadow: 0 16px 24px -16px rgb(42 106 168 / 75%);
  transform: translateX(3px);
}

.quick-actions a:hover::before {
  transform: scaleX(1);
}

.quick-actions a:hover b {
  background: rgb(255 255 255 / 22%);
  color: #fff;
  transform: translateX(4px);
}

.quick-actions a:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.announcement {
  margin-top: 12px;
  padding: 14px 16px;
  border-left: 3px solid var(--sky);
  border-radius: 4px 12px 12px 4px;
  background: linear-gradient(90deg, #f3f8fe, #fafcff);
  animation: slide-right 0.55s var(--ease) both;
  transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s var(--ease);
}

.announcement:nth-of-type(1) { animation-delay: 0.75s; }
.announcement:nth-of-type(2) { animation-delay: 0.85s; }
.announcement:nth-of-type(3) { animation-delay: 0.95s; }
.announcement:nth-of-type(n + 4) { animation-delay: 1.05s; }

.announcement:hover {
  border-left-color: var(--blue);
  background: linear-gradient(90deg, #eaf3fd, #f6faff);
  transform: translateX(-3px);
}

.announcement strong {
  color: var(--navy-deep);
}

.announcement p {
  margin: 6px 0;
  color: #445769;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-line;
}

.announcement small {
  color: var(--muted);
}

/* ================= Table ================= */
.table-wrap {
  overflow: auto;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
  margin-top: 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
}

table {
  width: 100%;
  min-width: 34rem;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}

th {
  background: linear-gradient(180deg, #f3f7fd, var(--field));
  color: var(--navy);
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
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
  padding: 3px 10px;
  border-radius: 8px;
  background: var(--field);
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 14%);
  color: var(--navy);
  font-size: 12px;
  font-weight: 700;
  transition: background 0.2s ease, color 0.2s ease, transform 0.25s var(--spring);
}

tbody tr {
  animation: fade-up-small 0.5s var(--ease) both;
  transition: background 0.2s ease, box-shadow 0.2s ease;
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
  background: #f4f8fe;
  box-shadow: inset 3px 0 0 var(--blue);
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
  border-radius: 8px;
  background: linear-gradient(90deg, #fdeceb, #fff6f5);
  color: var(--danger);
  animation: shake 0.45s ease both;
}

.empty {
  padding: 28px;
  border: 1px dashed #cdd9e8;
  border-radius: 14px;
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

@keyframes orbit {
  to {
    --angle: 360deg;
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

  .page-header::before {
    right: -30%;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .stats-grid {
    grid-template-columns: minmax(0, 1fr);
  }

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
    border-radius: 18px;
  }

  .page-header::before {
    right: -60%;
    width: 420px;
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
    gap: 0.25rem;
    min-height: 12rem;
    aspect-ratio: 4 / 3;
    overflow: hidden;
  }

  .day-column {
    min-width: 0;
    font-size: 10px;
  }

  .day-column small { white-space: nowrap; }

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
    padding: clamp(1.1rem, 5vw, 1.5rem);
  }

  .page-header h1 {
    font-size: clamp(1.5rem, 7vw, 1.7rem);
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
  .page-header::before,
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
  .stat-card::before,
  .stat-card::after,
  .stat-icon,
  .stat-icon::before,
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