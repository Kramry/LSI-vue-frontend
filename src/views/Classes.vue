<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiGet } from '../services/api'

interface ClassCard {
  class_id: number
  class_name: string
  program_id: number
  program_name: string
  room: string | null
  start_date: string | null
  end_date: string | null
  schedule_summary: string | null
  enrolled_count: number
  today_present: number
  today_late: number
  today_not_scanned: number
  teaching_status: 'ongoing' | 'upcoming' | 'completed' | string
}
interface Choice { id: number | string; label: string }
interface ClassesData { classes: ClassCard[]; programs: Choice[]; instructors: Choice[] }

const data = ref<ClassesData>({ classes: [], programs: [], instructors: [] })
const loading = ref(true)
const error = ref('')
const search = ref('')
const programId = ref('')
const instructorId = ref('')
const status = ref('')
const role = ref('')

const filteredClasses = computed(() => data.value.classes.filter((item) => {
  const term = search.value.trim().toLowerCase()
  return (!term || [item.class_name, item.program_name, item.room].some((value) => String(value || '').toLowerCase().includes(term)))
    && (!programId.value || String(item.program_id) === programId.value)
    && (!instructorId.value || String((item as ClassCard & { instructor_id?: number }).instructor_id) === instructorId.value)
    && (!status.value || item.teaching_status === status.value)
}))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const query = new URLSearchParams()
    if (programId.value) query.set('program_id', programId.value)
    if (instructorId.value) query.set('instructor_id', instructorId.value)
    const response = await apiGet<ClassesData>(`/classes${query.size ? `?${query}` : ''}`)
    data.value = response.data
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load classes.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const session = await apiGet<{ user: { role: string } | null }>('/session')
  role.value = session.data.user?.role || ''
  await load()
})
</script>

<template>
  <main class="classes-page">
    <header class="page-header">
      <div><p class="eyebrow">SMARTTRACK / TEACHING</p><h1>{{ role === 'instructor' ? 'My classes' : 'Classes' }}</h1><p class="lead">Manage your classes, trainees, attendance and assessment results.</p></div>
      <button class="secondary-button" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <section class="panel filters">
      <input v-model="search" aria-label="Search classes" placeholder="Search classes or programs">
      <select v-model="programId" aria-label="Filter by program"><option value="">All programs</option><option v-for="item in data.programs" :key="item.id" :value="String(item.id)">{{ item.label }}</option></select>
      <select v-if="role !== 'instructor'" v-model="instructorId" aria-label="Filter by instructor"><option value="">All instructors</option><option v-for="item in data.instructors" :key="item.id" :value="String(item.id)">{{ item.label }}</option></select>
      <select v-model="status" aria-label="Filter by status"><option value="">All statuses</option><option value="ongoing">Ongoing</option><option value="upcoming">Upcoming</option><option value="completed">Completed</option></select>
    </section>
    <p v-if="loading" class="panel muted loading">Loading classes...</p>
    <section v-else-if="!filteredClasses.length" class="panel empty-state"><h2>No classes found</h2><p class="muted">No classes match the selected filters.</p></section>
    <section v-else class="class-grid">
      <article v-for="item in filteredClasses" :key="item.class_id" class="panel class-card">
        <div class="card-heading"><div><p class="eyebrow">{{ item.program_name }}</p><h2>{{ item.class_name }}</h2></div><span class="status-pill" :class="item.teaching_status">{{ item.teaching_status }}</span></div>
        <div class="class-meta"><span><strong>Schedule:</strong> {{ item.schedule_summary || 'No sessions scheduled' }}</span><span><strong>Room:</strong> {{ item.room || 'Not assigned' }}</span><span><strong>Dates:</strong> {{ item.start_date || '—' }} to {{ item.end_date || '—' }}</span></div>
        <div class="stats"><div><strong>{{ item.enrolled_count }}</strong><span>Enrolled</span></div><div><strong>{{ item.today_present + item.today_late }}</strong><span>Scanned today</span></div><div><strong>{{ item.today_not_scanned }}</strong><span>Not scanned</span></div></div>
        <div class="actions"><RouterLink class="primary-button" :to="`/classes/${item.class_id}`">Open class</RouterLink><RouterLink class="secondary-button" :to="{ path: '/attendance', query: { class_id: item.class_id } }">Take attendance</RouterLink><RouterLink class="secondary-button" :to="{ path: '/assessments', query: { class_id: item.class_id } }">Record assessment</RouterLink></div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.classes-page{--navy:#173a60;--blue:#265f94;--sky:#8fc4f5;--text:#1b2a3a;--muted:#5d6f82;display:grid;gap:20px;max-width:1400px;margin:0 auto;color:var(--text);font-family:'DM Sans','Segoe UI',system-ui,sans-serif}.page-header{display:flex;justify-content:space-between;align-items:center;padding:26px 28px;border-radius:14px;color:#fff;background:var(--navy)}.page-header h1{margin:0;color:#fff;font:600 32px 'Fraunces',Georgia,serif}.eyebrow{margin:0 0 8px;color:var(--sky);font-size:12px;font-weight:700;letter-spacing:.14em}.lead{margin:6px 0 0;color:#fffc;font-size:14px}.filters{display:flex;flex-wrap:wrap;gap:12px}.filters input,.filters select{min-height:42px;padding:9px 12px;border:1px solid #dfe7f1;border-radius:8px;font:inherit}.filters input{flex:1;min-width:220px}.class-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}.class-card{display:grid;gap:16px}.card-heading{display:flex;justify-content:space-between;gap:12px}.card-heading h2{margin:0;font:600 22px 'Fraunces',Georgia,serif;color:#112c49}.class-meta{display:grid;gap:7px;color:var(--muted);font-size:13px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stats div{padding:10px;border-radius:8px;background:#eef4fc;text-align:center}.stats strong,.stats span{display:block}.stats strong{font-size:20px;color:var(--navy)}.stats span{font-size:11px;color:var(--muted)}.status-pill{padding:5px 10px;border-radius:999px;background:#e4effb;color:var(--blue);font-size:11px;font-weight:700;text-transform:capitalize;height:max-content}.status-pill.upcoming{background:#fff3d6;color:#785918}.status-pill.completed{background:#edf0f2;color:#596579}.actions{display:flex;flex-wrap:wrap;gap:8px}.primary-button,.secondary-button{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:8px 13px;border:0;border-radius:8px;text-decoration:none;font:700 13px inherit;cursor:pointer}.primary-button{background:var(--blue);color:#fff}.secondary-button{background:#e3ebf6;color:#112c49}.empty-state{text-align:center;padding:44px}.loading{text-align:center}@media(max-width:600px){.page-header{align-items:flex-start;display:grid}.stats{grid-template-columns:1fr}}
</style>
