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

<script lang="ts">
import { defineComponent, h } from 'vue'

const PILL_KEYS = ['status', 'outcome', 'review_status']

export default defineComponent({
  components: {
    TableView: defineComponent({
      props: { rows: { type: Array, required: true }, columns: { type: Array, required: true } },
      setup(props) {
        return () =>
          h('div', { class: 'table-wrap' }, [
            h('table', [
              h('thead', [
                h('tr', (props.columns as Array<[string, string]>).map(([key, label]) => h('th', { key }, label)))
              ]),
              h('tbody', (props.rows as Array<Record<string, string>>).map((row, index) =>
                h('tr', { key: index }, (props.columns as Array<[string, string]>).map(([key]) => {
                  const value = row[key]
                  if (PILL_KEYS.includes(key) && value) {
                    return h('td', { key }, [
                      h('span', { class: ['pill', String(value).toLowerCase().replace(/\s+/g, '-')] }, value)
                    ])
                  }
                  return h('td', { key }, value || '—')
                }))
              ))
            ])
          ])
      }
    })
  }
})
</script>

<style scoped>
.detail-page {
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

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

.back-link {
  justify-self: start;
  margin-bottom: -8px;
  color: var(--blue);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.back-link:hover {
  color: var(--navy-deep);
  text-decoration: underline;
}

/* ---------- Banner ---------- */
.page-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
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

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* ---------- Buttons ---------- */
.primary-button,
.ghost-button,
.light-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, transform 0.1s;
}

.primary-button {
  background: var(--blue);
  color: #fff;
}

.primary-button:hover {
  background: var(--blue-hover);
}

.ghost-button {
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
}

.ghost-button:hover {
  background: rgb(255 255 255 / 22%);
}

.light-button {
  background: #fff;
  color: var(--navy-deep);
}

.light-button:hover {
  background: #e3effb;
}

.primary-button:active,
.ghost-button:active,
.light-button:active {
  transform: translateY(1px);
}

.primary-button:focus-visible,
.ghost-button:focus-visible,
.light-button:focus-visible,
.tabs a:focus-visible,
.text-button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

/* ---------- Tabs ---------- */
.tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  scrollbar-width: none;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tabs a {
  flex: none;
  padding: 10px 18px;
  border-radius: 9px;
  color: var(--muted);
  font-weight: 700;
  text-decoration: none;
  text-transform: capitalize;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.tabs a:hover:not(.active) {
  background: var(--field);
  color: var(--navy-deep);
}

.tabs a.active {
  background: var(--blue);
  color: #fff;
  box-shadow: 0 6px 14px -8px rgb(38 95 148 / 80%);
}

/* ---------- Overview ---------- */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.stat {
  padding: 20px;
  border: 1px solid var(--line);
  border-top: 3px solid var(--blue);
  border-radius: 12px;
  background: #fff;
}

.stat:nth-child(4n + 2) {
  border-top-color: var(--ok);
}

.stat:nth-child(4n + 3) {
  border-top-color: var(--warn);
}

.stat:nth-child(4n) {
  border-top-color: var(--sky);
}

.stat strong,
.stat span {
  display: block;
}

.stat strong {
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
}

.stat span {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.overview-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 18px;
}

.info-list {
  display: grid;
  gap: 4px;
  margin: 16px 0 0;
}

.info-list div {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

.info-list div:last-child {
  border-bottom: 0;
}

.info-list dt {
  color: var(--muted);
  font-weight: 600;
}

.info-list dd {
  margin: 0;
  color: var(--navy-deep);
  font-weight: 600;
}

.big-number {
  margin: 14px 0 10px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 46px;
  font-weight: 600;
  line-height: 1;
}

.bar {
  height: 12px;
  border-radius: 8px;
  background: #e8eef7;
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--sky), var(--blue));
  transition: width 0.3s ease;
}

/* ---------- Panels ---------- */
.panel {
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.panel h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 21px;
  font-weight: 600;
}

.muted {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.section-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.count-badge {
  padding: 6px 12px;
  border-radius: 999px;
  background: #e0eefc;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
}

/* ---------- Tables (:deep reaches the TableView helper) ---------- */
.table-wrap {
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.table-wrap :deep(table),
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table-wrap :deep(th),
th {
  padding: 12px 14px;
  background: var(--field);
  color: var(--navy);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.table-wrap :deep(td),
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
}

.table-wrap :deep(tbody tr:last-child td),
tbody tr:last-child td {
  border-bottom: 0;
}

.table-wrap :deep(tbody tr:hover),
tbody tr:hover {
  background: #f6f9fd;
}

.num {
  text-align: right;
}

th.num {
  text-align: right;
}

td.pass {
  color: #1f6b41;
  font-weight: 700;
}

td.fail {
  color: var(--danger);
  font-weight: 700;
}

td.end {
  text-align: right;
}

.person {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.person strong {
  color: var(--navy-deep);
}

.avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e3effb;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 800;
}

.text-button {
  padding: 5px 10px;
  border-radius: 6px;
  color: var(--blue);
  font-weight: 700;
  text-decoration: none;
}

.text-button:hover {
  background: var(--field);
  color: var(--navy-deep);
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--muted);
}

.empty-box {
  margin: 0;
  padding: 32px 12px;
  border: 1px dashed #b6c8de;
  border-radius: 10px;
  background: #f9fbfe;
  color: var(--muted);
  text-align: center;
}

/* status pills (rendered by TableView) */
.table-wrap :deep(.pill) {
  display: inline-block;
  padding: 4px 11px;
  border-radius: 999px;
  background: #e0eefc;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
}

.table-wrap :deep(.pill.present),
.table-wrap :deep(.pill.pass),
.table-wrap :deep(.pill.approved) {
  background: #e3f4ea;
  color: #1f6b41;
}

.table-wrap :deep(.pill.late),
.table-wrap :deep(.pill.pending) {
  background: #fbf0d3;
  color: #8a5d00;
}

.table-wrap :deep(.pill.absent),
.table-wrap :deep(.pill.fail),
.table-wrap :deep(.pill.rejected) {
  background: #fdeceb;
  color: var(--danger);
}

/* ---------- Announcements ---------- */
.announcement {
  margin-top: 12px;
  padding: 14px 16px;
  border-left: 3px solid var(--sky);
  border-radius: 0 10px 10px 0;
  background: #f6f9fd;
}

.announcement h3 {
  margin: 0 0 6px;
  color: var(--navy-deep);
}

.announcement p {
  margin: 0 0 8px;
  color: #445769;
  line-height: 1.55;
  white-space: pre-wrap;
}

.announcement small {
  color: var(--muted);
}

/* ---------- States ---------- */
.inline-error {
  margin: 0;
  padding: 12px 14px;
  border-left: 3px solid var(--danger);
  border-radius: 6px;
  background: #fdeceb;
  color: var(--danger);
}

.loading {
  text-align: center;
}

/* ---------- Responsive ---------- */
@media (max-width: 900px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 750px) {
  .page-header {
    display: grid;
    padding: 22px 20px;
  }

  .page-header h1 {
    font-size: 26px;
  }

  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }

  .panel {
    padding: 16px;
  }

  .info-list div {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary-button,
  .ghost-button,
  .light-button,
  .tabs a,
  .bar i {
    transition: none;
  }
}
</style>