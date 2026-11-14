<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { apiGet } from '../services/api'

interface ClassInfo { class_id: number; class_name: string; program_name: string; room: string | null; start_date: string | null; end_date: string | null }
interface Roster { trainee_id: number; first_name: string; last_name: string; trainee_number: string; attendance_total: number; attendance_attended: number; assessments_passed: number; assessments_failed: number }
interface DetailData { class: ClassInfo; schedules: Array<Record<string, string>>; roster: Roster[]; attendance: Array<Record<string, string>>; assessments: Array<Record<string, string>>; documents: Array<Record<string, string>>; announcements: Array<Record<string, string>>; stats: { attendance_rate: number; assessments_passed: number; pending_documents: number } }

const route = useRoute()
const data = ref<DetailData | null>(null)
const loading = ref(true)
const error = ref('')
const tabs = ['overview', 'trainees', 'schedule', 'attendance', 'assessments', 'documents', 'announcements']
const tab = computed(() => tabs.includes(String(route.query.tab)) ? String(route.query.tab) : 'overview')
const classId = computed(() => String(route.params.id))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiGet<DetailData>(`/classes/${encodeURIComponent(classId.value)}`)
    data.value = response.data
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load class details.'
  } finally {
    loading.value = false
  }
}

function attendanceRate(item: Roster) {
  return item.attendance_total ? `${Math.round((item.attendance_attended / item.attendance_total) * 1000) / 10}%` : '—'
}

onMounted(load)
</script>

<template>
  <main v-if="data" class="detail-page">
    <RouterLink class="back-link" to="/classes">← Back to classes</RouterLink>

    <header class="page-header">
      <div>
        <p class="eyebrow">SMARTTRACK / CLASS</p>
        <h1>{{ data.class.class_name }}</h1>
        <p class="lead">{{ data.class.program_name }} · {{ data.class.start_date || '—' }} to {{ data.class.end_date || '—' }}</p>
      </div>
      <div class="actions">
        <RouterLink class="ghost-button" :to="{ path: '/attendance', query: { class_id: data.class.class_id } }">Take attendance</RouterLink>
        <RouterLink class="light-button" :to="{ path: '/assessments', query: { class_id: data.class.class_id } }">Record assessment</RouterLink>
      </div>
    </header>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>

    <nav class="tabs" aria-label="Class detail tabs">
      <RouterLink
        v-for="item in tabs"
        :key="item"
        :class="{ active: tab === item }"
        :aria-current="tab === item ? 'page' : undefined"
        :to="{ query: { tab: item } }"
      >{{ item }}</RouterLink>
    </nav>

    <!-- Overview -->
    <template v-if="tab === 'overview'">
      <section class="stat-grid" aria-label="Class figures">
        <div class="stat"><strong>{{ data.stats.attendance_rate }}%</strong><span>Attendance rate</span></div>
        <div class="stat"><strong>{{ data.stats.assessments_passed }}</strong><span>Assessments passed</span></div>
        <div class="stat"><strong>{{ data.stats.pending_documents }}</strong><span>Pending documents</span></div>
        <div class="stat"><strong>{{ data.roster.length }}</strong><span>Enrolled trainees</span></div>
      </section>

      <section class="overview-grid">
        <article class="panel">
          <h2>Class information</h2>
          <dl class="info-list">
            <div><dt>Program</dt><dd>{{ data.class.program_name }}</dd></div>
            <div><dt>Room</dt><dd>{{ data.class.room || 'Not assigned' }}</dd></div>
            <div><dt>Start date</dt><dd>{{ data.class.start_date || '—' }}</dd></div>
            <div><dt>End date</dt><dd>{{ data.class.end_date || '—' }}</dd></div>
          </dl>
        </article>

        <article class="panel">
          <h2>Overall attendance</h2>
          <p class="muted">Across all sessions held so far.</p>
          <p class="big-number">{{ data.stats.attendance_rate }}%</p>
          <div class="bar" role="img" :aria-label="`Attendance rate ${data.stats.attendance_rate} percent`">
            <i :style="{ width: `${Math.min(100, Math.max(0, Number(data.stats.attendance_rate) || 0))}%` }"></i>
          </div>
        </article>
      </section>
    </template>

    <!-- Trainees -->
    <section v-else-if="tab === 'trainees'" class="panel">
      <div class="section-heading">
        <h2>Trainee roster</h2>
        <span class="count-badge">{{ data.roster.length }} trainees</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Trainee number</th>
              <th>Attendance</th>
              <th class="num">Pass</th>
              <th class="num">Fail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.roster" :key="item.trainee_id">
              <td>
                <span class="person">
                  <span class="avatar" aria-hidden="true">{{ (item.first_name || '?').charAt(0).toUpperCase() }}</span>
                  <strong>{{ item.first_name }} {{ item.last_name }}</strong>
                </span>
              </td>
              <td>{{ item.trainee_number }}</td>
              <td>{{ attendanceRate(item) }}</td>
              <td class="num pass">{{ item.assessments_passed }}</td>
              <td class="num fail">{{ item.assessments_failed }}</td>
              <td class="end"><RouterLink class="text-button" :to="{ path: '/trainees', query: { search: item.last_name } }">View profile</RouterLink></td>
            </tr>
            <tr v-if="!data.roster.length"><td colspan="6" class="empty">No trainees are enrolled in this class yet.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Schedule -->
    <section v-else-if="tab === 'schedule'" class="panel">
      <div class="section-heading"><h2>Class sessions</h2></div>
      <TableView v-if="data.schedules.length" :rows="data.schedules" :columns="[['schedule_date','Date'],['start_time','Start'],['end_time','End']]" />
      <p v-else class="empty-box">No sessions are scheduled for this class.</p>
    </section>

    <!-- Attendance -->
    <section v-else-if="tab === 'attendance'" class="panel">
      <div class="section-heading">
        <h2>Attendance: today and last 7 days</h2>
        <RouterLink class="primary-button" :to="{ path: '/attendance', query: { class_id: data.class.class_id } }">Open scanner</RouterLink>
      </div>
      <TableView v-if="data.attendance.length" :rows="data.attendance" :columns="[['attendance_date','Date'],['trainee_name','Trainee'],['status','Status'],['time_in','Time in'],['time_out','Time out']]" />
      <p v-else class="empty-box">No attendance recorded in the last 7 days.</p>
    </section>

    <!-- Assessments -->
    <section v-else-if="tab === 'assessments'" class="panel">
      <div class="section-heading">
        <h2>Assessment results</h2>
        <RouterLink class="primary-button" :to="{ path: '/assessments', query: { class_id: data.class.class_id } }">Add result</RouterLink>
      </div>
      <TableView v-if="data.assessments.length" :rows="data.assessments" :columns="[['trainee_name','Trainee'],['assessment_name','Assessment'],['outcome','Outcome'],['assessment_date','Date'],['notes','Notes']]" />
      <p v-else class="empty-box">No assessment results recorded yet.</p>
    </section>

    <!-- Documents -->
    <section v-else-if="tab === 'documents'" class="panel">
      <div class="section-heading">
        <h2>Class documents</h2>
        <RouterLink class="primary-button" :to="{ path: '/documents', query: { class_id: data.class.class_id } }">Upload document</RouterLink>
      </div>
      <TableView v-if="data.documents.length" :rows="data.documents" :columns="[['trainee_name','Trainee'],['document_name','Document'],['upload_date','Uploaded'],['review_status','Review']]" />
      <p v-else class="empty-box">No documents uploaded for this class.</p>
    </section>

    <!-- Announcements -->
    <section v-else class="panel">
      <div class="section-heading">
        <h2>Announcements</h2>
        <RouterLink class="primary-button" :to="{ path: '/announcements', query: { class_id: data.class.class_id } }">Post announcement</RouterLink>
      </div>
      <article v-for="item in data.announcements" :key="item.announcement_id" class="announcement">
        <h3>{{ item.title }}</h3>
        <p>{{ item.content }}</p>
        <small>{{ item.created_at }} · {{ item.author }}</small>
      </article>
      <p v-if="!data.announcements.length" class="empty-box">No announcements for this class.</p>
    </section>
  </main>

  <main v-else class="detail-page">
    <p v-if="loading" class="panel loading">Loading class...</p>
    <p v-else class="inline-error">{{ error }}</p>
  </main>
</template>

<style scoped>
.classes-page,
.detail-page {
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
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  --chev: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d6f82' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  color: #16263a;
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;

  /* ---------- Icon set (line icons, drawn as masks so they take currentColor) ---------- */
  --i-clock: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M12 7v5l3 2'/%3E%3C/svg%3E");
  --i-pin: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z'/%3E%3Ccircle cx='12' cy='10' r='2.5'/%3E%3C/svg%3E");
  --i-calendar: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M3 10h18M8 3v4M16 3v4'/%3E%3C/svg%3E");
  --i-users: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='8' r='3.5'/%3E%3Cpath d='M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6'/%3E%3Ccircle cx='17.5' cy='9' r='2.5'/%3E%3Cpath d='M17 14c2.6 0 4.5 1.8 4.5 4.5'/%3E%3C/svg%3E");
  --i-check: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M8 12.5l3 3 5-6'/%3E%3C/svg%3E");
  --i-hourglass: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9'/%3E%3C/svg%3E");
  --i-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h14M13 6l6 6-6 6'/%3E%3C/svg%3E");
  --i-scan: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16'/%3E%3C/svg%3E");
  --i-clipboard: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='6' y='4' width='12' height='17' rx='2'/%3E%3Cpath d='M9 2.5h6V6H9zM9 12h6M9 16h4'/%3E%3C/svg%3E");
  --i-refresh: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5'/%3E%3C/svg%3E");
  --i-search: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M21 21l-4.3-4.3'/%3E%3C/svg%3E");
  --i-cap: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 9l10-5 10 5-10 5z'/%3E%3Cpath d='M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5'/%3E%3C/svg%3E");
  --i-layers: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l9 5-9 5-9-5z'/%3E%3Cpath d='M3 13l9 5 9-5'/%3E%3C/svg%3E");
  --i-pencil: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 20h4L19 9l-4-4L4 16z'/%3E%3Cpath d='M13.5 6.5l4 4'/%3E%3C/svg%3E");
  --i-trash: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'/%3E%3C/svg%3E");

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

.detail-page {
  min-width: 0;
}

.detail-page .back-link {
  width: fit-content;
  color: var(--blue);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.detail-page .back-link:hover {
  color: var(--blue-hover);
  text-decoration: underline;
}

.detail-page .actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  padding: 0;
  border: 0;
}

.detail-page .actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 9px 14px;
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  transition: background 0.2s ease, transform 0.2s ease;
}

.detail-page .actions a:hover {
  background: rgb(255 255 255 / 16%);
  transform: translateY(-1px);
}

.detail-page .tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  scrollbar-width: thin;
}

.detail-page .tabs a {
  flex: 0 0 auto;
  padding: 9px 13px;
  border-radius: 7px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  text-transform: capitalize;
  transition: background 0.2s ease, color 0.2s ease;
}

.detail-page .tabs a:hover {
  background: var(--field);
  color: var(--navy-deep);
}

.detail-page .tabs a.active {
  background: var(--navy);
  color: #fff;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat-grid .stat {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.stat-grid .stat strong {
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 25px;
  font-weight: 600;
}

.stat-grid .stat span {
  color: var(--muted);
  font-size: 12px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.detail-page .panel h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 21px;
  font-weight: 600;
}

.info-list {
  display: grid;
  gap: 12px;
  margin: 18px 0 0;
}

.info-list > div {
  display: grid;
  grid-template-columns: minmax(100px, 0.45fr) minmax(0, 1fr);
  gap: 12px;
}

.info-list dt {
  color: var(--muted);
  font-size: 13px;
}

.info-list dd {
  min-width: 0;
  margin: 0;
  color: var(--text);
  font-size: 14px;
}

.big-number {
  margin: 14px 0 10px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 28px;
  font-weight: 600;
}

.detail-page .section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.detail-page .count-badge {
  flex: 0 0 auto;
  padding: 6px 11px;
  border-radius: 999px;
  background: #e0eefc;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
}

.detail-page .table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.detail-page table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.detail-page th,
.detail-page td {
  padding: 11px 13px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  white-space: nowrap;
}

.detail-page th {
  background: var(--field);
  color: var(--navy-deep);
  font-size: 12px;
}

.detail-page .person {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.detail-page .avatar {
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: #e0eefc;
  color: var(--blue);
  font-weight: 700;
}

.detail-page .num,
.detail-page .end {
  text-align: right;
}

.detail-page .empty,
.detail-page .empty-box {
  padding: 18px;
  color: var(--muted);
  text-align: center;
}

.detail-page .announcement {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.detail-page .announcement:last-of-type {
  border-bottom: 0;
}

.detail-page .announcement h3 {
  margin: 0;
  color: var(--navy-deep);
  font-size: 16px;
}

.detail-page .announcement p {
  margin: 8px 0;
  color: var(--text);
  white-space: pre-wrap;
}

.detail-page .announcement small {
  color: var(--muted);
}

/* ================= Icon base: every icon below shares these rules ================= */
.search-field::before,
.count-chip::before,
.program::before,
.class-meta dt::before,
.stats div::before,
.actions .primary-button::after,
.actions .secondary-button::before,
.header-button::before,
.danger-button::before,
.form-heading h2::before {
  content: '';
  flex: none;
  display: inline-block;
  width: 16px;
  height: 16px;
  background-color: currentColor;
  -webkit-mask-image: var(--icon);
  mask-image: var(--icon);
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  transition: transform 0.3s var(--spring), color 0.25s ease, background-color 0.25s ease;
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
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid rgb(143 196 245 / 45%);
  border-radius: 10px;
  background: rgb(143 196 245 / 16%);
  color: #d6e9fb;
  font-size: 13px;
  animation: pop-in 0.6s var(--spring) 0.25s both;
}

.count-chip::before {
  --icon: var(--i-layers);
  width: 18px;
  height: 18px;
  color: var(--sky);
}

.count-chip:hover::before {
  transform: translateY(-2px) rotate(-8deg);
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

/* refresh button: its icon turns on hover and spins while loading */
.header-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
  animation: pop-in 0.55s var(--spring) 0.33s both;
}

.header-button::before {
  --icon: var(--i-refresh);
}

.header-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
  transform: translateY(-2px);
}

.header-button:hover:not(:disabled)::before {
  transform: rotate(180deg);
}

.header-button:disabled::before {
  animation: spin 0.8s linear infinite;
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
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
}

.form-heading h2::before {
  --icon: var(--i-pencil);
  width: 20px;
  height: 20px;
  color: var(--blue);
  animation: pencil-write 2.8s ease-in-out 0.8s infinite;
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

/* ================= Filters (with a search icon) ================= */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px;
  animation: rise 0.6s var(--ease) 0.1s both;
}

.search-field {
  position: relative;
  display: block;
  flex: 1;
  min-width: 240px;
}

.search-field::before {
  --icon: var(--i-search);
  position: absolute;
  top: 50%;
  left: 14px;
  z-index: 1;
  width: 18px;
  height: 18px;
  margin-top: -9px;
  color: var(--muted);
  pointer-events: none;
}

.search-field:focus-within::before {
  color: var(--blue);
  transform: scale(1.18) rotate(-10deg);
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
  padding-left: 42px;
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

/* program name with a graduation-cap icon */
.program {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 6px;
  color: var(--blue);
  font-size: 12.5px;
  font-weight: 700;
}

.program::before {
  --icon: var(--i-cap);
  width: 16px;
  height: 16px;
}

.class-card:hover .program::before {
  transform: translateY(-2px) rotate(-8deg);
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

/* details as a label / value list, each with its own icon */
.class-meta {
  display: grid;
  gap: 9px;
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
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.class-meta dt {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-weight: 600;
}

.class-meta dt::before {
  color: var(--sky);
}

.class-meta div:nth-child(1) dt::before { --icon: var(--i-clock); }
.class-meta div:nth-child(2) dt::before { --icon: var(--i-pin); }
.class-meta div:nth-child(3) dt::before { --icon: var(--i-calendar); }

/* icons turn blue and nudge when the card is hovered */
.class-card:hover .class-meta dt::before {
  color: var(--blue);
  transform: translateX(2px) scale(1.12);
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

/* stat tiles: an icon above each number */
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

.stats div::before {
  display: block;
  width: 20px;
  height: 20px;
  margin: 0 auto 6px;
  color: var(--blue);
}

.stats div:nth-child(1)::before { --icon: var(--i-users); }
.stats div:nth-child(2)::before { --icon: var(--i-check); color: var(--ok); }
.stats div:nth-child(3)::before { --icon: var(--i-hourglass); color: var(--warn); }

.stats div:hover {
  border-color: var(--sky);
  box-shadow: 0 12px 20px -16px rgb(38 95 148 / 55%);
  transform: translateY(-3px);
}

.stats div:hover::before {
  animation: icon-bounce 0.55s var(--spring);
}

.stats div:nth-child(3):hover::before {
  animation: hourglass-flip 0.7s var(--ease);
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
  gap: 8px;
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

/* "Open class": an arrow follows the label and slides forward on hover */
.actions .primary-button::after {
  --icon: var(--i-arrow);
  width: 18px;
  height: 18px;
}

.actions .primary-button:hover::after {
  transform: translateX(5px);
}

.secondary-button {
  background: #e3ebf6;
  color: var(--navy-deep);
}

.secondary-button:hover:not(:disabled) {
  background: #d3e0f0;
  transform: translateY(-1px);
}

/* "Take attendance" and "Record assessment" each get their own icon */
.actions .secondary-button:nth-child(2)::before { --icon: var(--i-scan); }
.actions .secondary-button:nth-child(3)::before { --icon: var(--i-clipboard); }

.actions .secondary-button::before {
  width: 17px;
  height: 17px;
  color: var(--blue);
}

.actions .secondary-button:hover::before {
  transform: scale(1.18) rotate(-6deg);
}

.danger-button {
  background: #fdebeb;
  color: var(--danger);
}

.danger-button::before {
  --icon: var(--i-trash);
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

/* icon motion */
@keyframes icon-bounce {
  0% {
    transform: translateY(0) scale(1);
  }
  40% {
    transform: translateY(-5px) scale(1.2);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes hourglass-flip {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(180deg);
  }
}

@keyframes pencil-write {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(2px, 1px) rotate(8deg);
  }
  50% {
    transform: translate(-1px, 2px) rotate(-4deg);
  }
  75% {
    transform: translate(2px, -1px) rotate(6deg);
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

/* ================= Responsive (tablet first, then phone) ================= */
@media (max-width: 850px) {
  .class-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .detail-page .actions {
    justify-content: flex-start;
  }

  .detail-page .actions a {
    flex: 1 1 140px;
  }

  .detail-page .tabs a {
    padding: 9px 11px;
  }

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

  .class-meta div {
    grid-template-columns: 88px minmax(0, 1fr);
  }

  .panel {
    padding: 16px;
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
  .header-button:disabled::before,
  .loading,
  .inline-error,
  .form-panel,
  .form-panel::before,
  .form-heading h2::before,
  .class-form > *,
  .class-form label em,
  .filters,
  .class-card,
  .status-pill,
  .status-pill::before,
  .bar i,
  .bar i::after,
  .stats strong,
  .stats div:hover::before,
  .danger-button:hover:not(:disabled),
  .primary-button:disabled::after,
  .empty-state,
  .empty-state::before {
    animation: none;
  }

  .search-field::before,
  .count-chip::before,
  .program::before,
  .class-meta dt::before,
  .stats div::before,
  .actions .primary-button::after,
  .actions .secondary-button::before,
  .header-button::before,
  .danger-button::before,
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