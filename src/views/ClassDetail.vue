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
    <header class="page-header"><div><p class="eyebrow">SMARTTRACK / CLASS</p><h1>{{ data.class.class_name }}</h1><p class="lead">{{ data.class.program_name }} · {{ data.class.start_date || '—' }} to {{ data.class.end_date || '—' }}</p></div><div class="actions"><RouterLink class="secondary-button" to="/classes">Back to classes</RouterLink><RouterLink class="secondary-button" :to="{ path: '/attendance', query: { class_id: data.class.class_id } }">Take attendance</RouterLink><RouterLink class="primary-button" :to="{ path: '/assessments', query: { class_id: data.class.class_id } }">Record assessment</RouterLink></div></header>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <nav class="tabs" aria-label="Class detail tabs"><RouterLink v-for="item in tabs" :key="item" :class="{ active: tab === item }" :to="{ query: { tab: item } }">{{ item }}</RouterLink></nav>
    <section v-if="tab === 'overview'" class="content-grid"><div class="stat"><strong>{{ data.stats.attendance_rate }}%</strong><span>Attendance rate</span></div><div class="stat"><strong>{{ data.stats.assessments_passed }}</strong><span>Assessments passed</span></div><div class="stat"><strong>{{ data.stats.pending_documents }}</strong><span>Pending documents</span></div><div class="stat"><strong>{{ data.roster.length }}</strong><span>Enrolled trainees</span></div><article class="panel wide"><h2>Class information</h2><p><strong>Program:</strong> {{ data.class.program_name }}</p><p><strong>Room:</strong> {{ data.class.room || 'Not assigned' }}</p></article></section>
    <section v-else-if="tab === 'trainees'" class="panel"><h2>Trainee roster</h2><div class="table-wrap"><table><thead><tr><th>Name</th><th>Trainee number</th><th>Attendance</th><th>Pass</th><th>Fail</th><th></th></tr></thead><tbody><tr v-for="item in data.roster" :key="item.trainee_id"><td>{{ item.first_name }} {{ item.last_name }}</td><td>{{ item.trainee_number }}</td><td>{{ attendanceRate(item) }}</td><td>{{ item.assessments_passed }}</td><td>{{ item.assessments_failed }}</td><td><RouterLink class="text-button" :to="{ path: '/trainees', query: { search: item.last_name } }">View profile</RouterLink></td></tr></tbody></table></div></section>
    <section v-else-if="tab === 'schedule'" class="panel"><h2>Class sessions</h2><TableView :rows="data.schedules" :columns="[['schedule_date','Date'],['start_time','Start'],['end_time','End']]" /></section>
    <section v-else-if="tab === 'attendance'" class="panel"><h2>Attendance: today and last 7 days</h2><TableView :rows="data.attendance" :columns="[['attendance_date','Date'],['trainee_name','Trainee'],['status','Status'],['time_in','Time in'],['time_out','Time out']]" /></section>
    <section v-else-if="tab === 'assessments'" class="panel"><div class="section-heading"><h2>Assessment results</h2><RouterLink class="primary-button" :to="{ path: '/assessments', query: { class_id: data.class.class_id } }">Add result</RouterLink></div><TableView :rows="data.assessments" :columns="[['trainee_name','Trainee'],['assessment_name','Assessment'],['outcome','Outcome'],['assessment_date','Date'],['notes','Notes']]" /></section>
    <section v-else-if="tab === 'documents'" class="panel"><div class="section-heading"><h2>Class documents</h2><RouterLink class="primary-button" :to="{ path: '/documents', query: { class_id: data.class.class_id } }">Upload document</RouterLink></div><TableView :rows="data.documents" :columns="[['trainee_name','Trainee'],['document_name','Document'],['upload_date','Uploaded'],['review_status','Review']]" /></section>
    <section v-else class="panel"><div class="section-heading"><h2>Announcements</h2><RouterLink class="primary-button" :to="{ path: '/announcements', query: { class_id: data.class.class_id } }">Post announcement</RouterLink></div><article v-for="item in data.announcements" :key="item.announcement_id" class="announcement"><h3>{{ item.title }}</h3><p>{{ item.content }}</p><small>{{ item.created_at }} · {{ item.author }}</small></article><p v-if="!data.announcements.length" class="muted">No announcements for this class.</p></section>
  </main>
  <main v-else class="detail-page"><p v-if="loading" class="panel loading">Loading class...</p><p v-else class="inline-error">{{ error }}</p></main>
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'
export default defineComponent({
  components: {
    TableView: defineComponent({
      props: { rows: { type: Array, required: true }, columns: { type: Array, required: true } },
      setup(props) { return () => h('div', { class: 'table-wrap' }, [h('table', [h('thead', [h('tr', (props.columns as Array<[string, string]>).map(([key, label]) => h('th', { key }, label)))]), h('tbody', (props.rows as Array<Record<string, string>>).map((row, index) => h('tr', { key: index }, (props.columns as Array<[string, string]>).map(([key]) => h('td', { key }, row[key] || '—')))))])]) }
    })
  }
})
</script>

<style scoped>
.detail-page{--navy:#173a60;--blue:#265f94;--sky:#8fc4f5;--muted:#5d6f82;display:grid;gap:20px;max-width:1400px;margin:0 auto;font-family:'DM Sans','Segoe UI',system-ui,sans-serif;color:#1b2a3a}.page-header{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:26px 28px;border-radius:14px;color:#fff;background:var(--navy)}.page-header h1{margin:0;color:#fff;font:600 32px 'Fraunces',Georgia,serif}.eyebrow{margin:0 0 8px;color:var(--sky);font-size:12px;font-weight:700;letter-spacing:.14em}.lead{margin:6px 0 0;color:#fffc}.actions,.section-heading{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.tabs{display:flex;gap:4px;overflow-x:auto}.tabs a{white-space:nowrap;padding:10px 14px;border-radius:8px;color:var(--blue);text-decoration:none;text-transform:capitalize}.tabs a.active{background:var(--blue);color:#fff}.content-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.stat{padding:16px;border:1px solid #dfe7f1;border-radius:9px;background:#f4f8fd}.stat strong,.stat span{display:block}.stat strong{font-size:24px;color:var(--navy)}.stat span{font-size:12px;color:var(--muted)}.wide{grid-column:1/-1}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th{background:#eaf1fb;color:var(--navy);font-size:11px;text-align:left}th,td{padding:11px;border-bottom:1px solid #e1e8f1;vertical-align:top}.primary-button,.secondary-button{display:inline-flex;align-items:center;min-height:40px;padding:8px 13px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px}.primary-button{background:var(--blue);color:#fff}.secondary-button{background:#e3ebf6;color:#112c49}.text-button{color:var(--blue);font-weight:700}.announcement{padding:14px 0;border-bottom:1px solid #e1e8f1}.announcement h3{margin:0 0 6px}.announcement p{white-space:pre-wrap}.loading{text-align:center}@media(max-width:750px){.page-header{display:grid}.content-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:480px){.content-grid{grid-template-columns:1fr}}
</style>
