<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiGet, apiRequest } from '../services/api'

const categories = ref([])
const documents = ref([])
const search = ref('')
const loading = ref(false)
const uploadBusy = ref(false)
const testBusy = ref(false)
const status = ref('')
const testQuestion = ref('')
const testAnswer = ref('')
const selectedFile = ref(null)
const replacementFiles = ref({})
const form = ref({ title: '', category_id: '', audience: 'public', approved_for_ai: false })
const visibleDocuments = computed(() => documents.value.filter((document) => {
  const query = search.value.trim().toLocaleLowerCase()
  return !query || `${document.title} ${document.original_filename} ${document.category_name}`.toLocaleLowerCase().includes(query)
}))

async function loadData() {
  loading.value = true
  try {
    const [categoryResponse, documentResponse] = await Promise.all([
      apiGet('/ai/categories'), apiGet(`/ai/documents?search=${encodeURIComponent(search.value)}`)
    ])
    categories.value = categoryResponse.data.categories || []
    documents.value = documentResponse.data.documents || []
  } finally {
    loading.value = false
  }
}

async function uploadDocument(file = selectedFile.value, replacement = null) {
  if (!file) return
  if (!replacement && !form.value.approved_for_ai) {
    status.value = 'Confirm the document is approved for AI use and contains no unnecessary personal information.'
    return
  }
  uploadBusy.value = true
  status.value = 'Uploading and indexing with Gemini File Search…'
  const body = new FormData()
  body.set('document', file)
  body.set('title', replacement?.title || form.value.title)
  body.set('category_id', String(replacement?.category_id || form.value.category_id))
  body.set('audience', replacement?.audience || form.value.audience)
  body.set('version', String(replacement ? Number(replacement.version || 1) + 1 : 1))
  body.set('approved_for_ai', '1')
  try {
    const response = await apiRequest('/ai/documents', { method: 'POST', body })
    if (replacement) {
      await apiRequest(`/ai/documents/${replacement.document_id}/status`, { method: 'POST', body: { status: 'inactive' } })
    }
    status.value = 'Document indexed successfully.'
    selectedFile.value = null
    form.value = { title: '', category_id: '', audience: 'public', approved_for_ai: false }
    await loadData()
    return response.data
  } catch (error) {
    status.value = error?.message || 'The document could not be indexed.'
  } finally {
    uploadBusy.value = false
  }
}

async function changeStatus(document) {
  const nextStatus = document.status === 'active' ? 'inactive' : 'active'
  await apiRequest(`/ai/documents/${document.document_id}/status`, { method: 'POST', body: { status: nextStatus } })
  await loadData()
}

async function deleteDocument(document) {
  if (!window.confirm(`Delete “${document.title}” from the library and Gemini File Search?`)) return
  await apiRequest(`/ai/documents/${document.document_id}`, { method: 'DELETE' })
  await loadData()
}

async function testResponse() {
  if (!testQuestion.value.trim()) return
  testBusy.value = true
  testAnswer.value = 'Testing…'
  try {
    const response = await apiRequest('/ai/test', { method: 'POST', body: { message: testQuestion.value.trim() } })
    let payload = response
    while (payload?.data && typeof payload.data === 'object') payload = payload.data
    testAnswer.value = typeof payload?.answer === 'string' && payload.answer.trim()
      ? payload.answer.trim() : 'The assistant returned an empty answer.'
  } catch (error) {
    testAnswer.value = error?.message || 'Gemini could not answer the test question.'
  } finally {
    testBusy.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="ai-management-page">
    <!-- Header + live summary -->
    <header class="page-heading">
      <div class="heading-text">
        <span class="heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/></svg>
        </span>
        <div>
          <p class="eyebrow">Administrator portal</p>
          <h1>AI Management</h1>
          <p class="subtitle">Manage approved source documents and test grounded answers.</p>
        </div>
      </div>
      <ul class="stats" aria-label="Library summary">
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>
          <strong>{{ visibleDocuments.length }}</strong><span>Documents</span>
        </li>
        <li class="stat-active">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>
          <strong>{{ visibleDocuments.filter(d => d.status === 'active').length }}</strong><span>Active</span>
        </li>
        <li class="stat-busy">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/></svg>
          <strong>{{ visibleDocuments.filter(d => d.processing_status !== 'ready' && d.processing_status !== 'failed').length }}</strong><span>Processing</span>
        </li>
      </ul>
    </header>
 
    <div class="workspace">
      <!-- Library (main column) -->
      <section class="panel library-panel">
        <div class="library-heading">
          <div>
            <h2>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2z"/><path d="M4 5v7c0 1.1 3.6 2 8 2s8-.9 8-2V5"/><path d="M4 12v7c0 1.1 3.6 2 8 2s8-.9 8-2v-7"/></svg>
              Document library
            </h2>
            <p>Search, activate, deactivate, replace, or delete AI source documents.</p>
          </div>
          <label class="search-field">
            <span class="sr-only">Search documents</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
            <input v-model="search" type="search" placeholder="Search title, category, or filename" @input="loadData">
          </label>
        </div>
 
        <div v-if="loading" class="skeleton-list" aria-label="Loading documents">
          <span v-for="n in 4" :key="n" class="skeleton"></span>
        </div>
 
        <div v-else-if="visibleDocuments.length" class="table-scroll">
          <table>
            <thead>
              <tr><th>Document</th><th>Category</th><th>Audience</th><th>Status</th><th class="actions-col">Actions</th></tr>
            </thead>
            <tbody>
              <tr v-for="document in visibleDocuments" :key="document.document_id">
                <td>
                  <div class="doc-cell">
                    <span class="file-badge" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>
                    </span>
                    <div>
                      <strong>{{ document.title }}</strong>
                      <small>{{ document.original_filename }} · v{{ document.version }}</small>
                    </div>
                  </div>
                </td>
                <td>{{ document.category_name || '—' }}</td>
                <td>
                  <span class="audience">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 5a3.5 3.5 0 010 6.5M18 14.8c2 .6 3.2 2.4 3.5 5.2"/></svg>
                    {{ { public: 'All users', teaching: 'Instructors', staff: 'Staff', admin: 'Admins only' }[document.audience] || document.audience }}
                  </span>
                </td>
                <td>
                  <span class="pill" :class="'pill-' + document.processing_status">
                    <i class="dot"></i>{{ document.processing_status }}
                  </span>
                  <small class="state-line" :class="{ 'is-active': document.status === 'active' }">
                    {{ document.status }}<template v-if="document.processing_error"> · {{ document.processing_error }}</template>
                  </small>
                </td>
                <td>
                  <div class="row-actions">
                    <button v-if="document.processing_status === 'ready'" class="icon-button" type="button" :title="document.status === 'active' ? 'Deactivate' : 'Activate'" @click="changeStatus(document)">
                      <svg v-if="document.status === 'active'" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>
                      {{ document.status === 'active' ? 'Deactivate' : 'Activate' }}
                    </button>
                    <label class="icon-button replace-control" title="Replace file">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>
                      Replace
                      <input type="file" accept=".pdf,.docx,.txt" @change="replacementFiles[document.document_id] = $event.target.files?.[0] || null; replacementFiles[document.document_id] && uploadDocument(replacementFiles[document.document_id], document)">
                    </label>
                    <button class="icon-button danger" type="button" title="Delete" @click="deleteDocument(document)">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
 
        <div v-else class="empty-state">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          <p>No AI knowledge documents found. Upload one to get started.</p>
        </div>
      </section>
 
      <!-- Side column: upload + test -->
      <aside class="side-column">
        <section class="panel">
          <h2>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>
            Add a knowledge document
          </h2>
          <form class="document-form" @submit.prevent="uploadDocument()">
            <label>Document title
              <input v-model.trim="form.title" maxlength="180" required placeholder="e.g. Student handbook 2026">
            </label>
            <div class="field-row">
              <label>Category
                <select v-model="form.category_id" required>
                  <option value="">Choose a category</option>
                  <option v-for="category in categories" :key="category.category_id" :value="category.category_id">{{ category.name }}</option>
                </select>
              </label>
              <label>Available to
                <select v-model="form.audience">
                  <option value="public">All portal users</option>
                  <option value="teaching">Instructors and administrators</option>
                  <option value="staff">Staff and administrators</option>
                  <option value="admin">Administrators only</option>
                </select>
              </label>
            </div>
 
            <label class="dropzone" :class="{ 'has-file': selectedFile }">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M12 17v-5M9.5 14.5L12 12l2.5 2.5"/></svg>
              <span class="dz-title">{{ selectedFile ? selectedFile.name : 'Choose a file to upload' }}</span>
              <span class="dz-hint">PDF, DOCX, or TXT · max 15 MB</span>
              <input type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain" required @change="selectedFile = $event.target.files?.[0] || null">
            </label>
 
            <label class="approval-check">
              <input v-model="form.approved_for_ai" type="checkbox" required>
              <span>I confirm this copy is approved for student facing AI use and contains no unnecessary personal or confidential information.</span>
            </label>
 
            <button class="primary-button" type="submit" :disabled="uploadBusy">
              <span v-if="uploadBusy" class="spinner" aria-hidden="true"></span>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>
              {{ uploadBusy ? 'Indexing…' : 'Upload and index' }}
            </button>
            <p class="form-status" role="status" aria-live="polite">{{ status }}</p>
          </form>
        </section>
 
        <section class="panel test-panel">
          <h2>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H10l-5 4v-4H6a2 2 0 01-2-2z"/></svg>
            Test AI responses
          </h2>
          <form class="document-form" @submit.prevent="testResponse">
            <label>Question
              <textarea v-model="testQuestion" rows="3" maxlength="2000" placeholder="Ask about a policy or training document" required></textarea>
            </label>
            <button class="secondary-button" type="submit" :disabled="testBusy">
              <span v-if="testBusy" class="spinner dark" aria-hidden="true"></span>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-7z"/></svg>
              {{ testBusy ? 'Testing…' : 'Test answer' }}
            </button>
          </form>
 
          <div v-if="testBusy" class="chat-bubble bot" aria-label="AI is answering">
            <span class="avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/></svg></span>
            <div class="bubble typing"><i></i><i></i><i></i></div>
          </div>
          <div v-else-if="testAnswer" class="chat-bubble bot" role="status">
            <span class="avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/></svg></span>
            <div class="bubble test-answer">{{ testAnswer }}</div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
 
<style scoped>
/* Registered so the angle can be animated (orbit light, focus borders) */
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.ai-management-page {
  --ink: #14283d;
  --navy: #153a5e;
  --navy-deep: #0d2239;
  --muted: #5f7186;
  --line: #e0e8f1;
  --surface: #ffffff;
  --canvas: #f2f6fa;
  --brand: #1f5f99;
  --brand-deep: #174a79;
  --brand-soft: #e7f0f9;
  --sky: #8fc4f5;
  --teal: #0e8a86;
  --teal-soft: #dcf3f1;
  --amber: #a8620a;
  --amber-soft: #fdf0d9;
  --danger: #b42318;
  --danger-soft: #fdeceb;
  --radius: 18px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  --chev: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235f7186' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");

  max-width: 1400px;
  margin: 0 auto;
  padding: 4px 2px 24px;
  color: var(--ink);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
}

svg {
  width: 1.1em;
  height: 1.1em;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ================= Header ================= */
.page-heading {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin: 8px 0 22px;
  padding: 28px 30px;
  border-radius: 22px;
  color: #fff;
  overflow: hidden;
  isolation: isolate;
  background:
    var(--grain),
    radial-gradient(40% 90% at 6% 0%, rgb(143 196 245 / 34%), transparent 70%),
    radial-gradient(34% 90% at 70% 130%, rgb(14 138 134 / 55%), transparent 70%),
    radial-gradient(45% 100% at 100% 50%, rgb(31 95 153 / 70%), transparent 72%),
    linear-gradient(120deg, #1d4a79 0%, var(--navy) 42%, var(--navy-deep) 100%);
  background-size: 180px 180px, 140% 140%, 140% 140%, 140% 140%, 100% 100%;
  background-blend-mode: soft-light, normal, normal, normal, normal;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%), 0 28px 44px -30px rgb(8 23 39 / 85%);
  animation: heading-in 0.7s var(--ease) both, sheen 16s ease-in-out infinite alternate;
}

/* concentric rings with a slowly rotating light */
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
    conic-gradient(from var(--angle), transparent 0deg, rgb(143 196 245 / 26%) 40deg, transparent 90deg, transparent 210deg, rgb(94 214 208 / 20%) 250deg, transparent 300deg);
  -webkit-mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  animation: orbit 42s linear infinite;
  pointer-events: none;
}

.heading-text {
  display: flex;
  align-items: center;
  gap: 18px;
}

.heading-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 24%), rgb(255 255 255 / 6%)),
    rgb(255 255 255 / 8%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 28%), 0 14px 26px -12px rgb(0 0 0 / 55%);
  backdrop-filter: blur(10px);
}

/* soft ring that breathes around the icon */
.heading-icon::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 22px;
  box-shadow: 0 0 0 1px rgb(143 196 245 / 35%);
  animation: halo 3.2s ease-out infinite;
}

.heading-icon svg {
  width: 28px;
  height: 28px;
  fill: currentColor;
  stroke: none;
  animation: twinkle 3.2s ease-in-out infinite;
  transform-origin: center;
}

.page-heading h1 {
  margin: 4px 0;
  font-family: 'Fraunces', Georgia, serif;
  font-size: clamp(1.8rem, 3.2vw, 2.5rem);
  font-weight: 500;
  font-variation-settings: 'opsz' 120, 'SOFT' 50;
  line-height: 1.05;
  letter-spacing: -0.025em;
}

.eyebrow {
  display: inline-block;
  margin: 0;
  padding: 3px 11px;
  border-radius: 999px;
  background: rgb(143 196 245 / 12%);
  box-shadow: inset 0 0 0 1px rgb(143 196 245 / 35%);
  color: var(--sky);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.subtitle {
  margin: 6px 0 0;
  color: rgb(255 255 255 / 78%);
}

.stats {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stats li {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: 10px;
  min-width: 120px;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgb(255 255 255 / 10%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%);
  backdrop-filter: blur(10px);
  transition: transform 0.3s var(--ease), background 0.25s ease;
}

.stats li:hover {
  background: rgb(255 255 255 / 18%);
  transform: translateY(-2px);
}

.stats svg {
  grid-row: span 2;
  width: 24px;
  height: 24px;
  opacity: 0.9;
}

.stats strong {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.stats span {
  font-size: 0.78rem;
  opacity: 0.8;
}

.stat-busy svg {
  animation: spin 3s linear infinite;
}

/* ================= Layout ================= */
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(330px, 1fr);
  gap: 20px;
  align-items: start;
}

.side-column {
  display: grid;
  gap: 20px;
  position: sticky;
  top: 16px;
}

.panel {
  position: relative;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: linear-gradient(180deg, #fff, #fcfdff);
  box-shadow: 0 1px 2px rgb(23 58 96 / 5%), 0 16px 32px -24px rgb(23 58 96 / 40%);
  transition: box-shadow 0.35s ease, border-color 0.35s ease;
  animation: panel-in 0.6s var(--ease) both;
}

.panel:hover {
  border-color: #d0dcea;
  box-shadow: 0 1px 2px rgb(23 58 96 / 5%), 0 26px 42px -26px rgb(23 58 96 / 48%);
}

.library-panel { animation-delay: 0.1s; }
.side-column .panel:nth-child(1) { animation-delay: 0.16s; }
.side-column .panel:nth-child(2) { animation-delay: 0.24s; }

.panel h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 18px;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.2rem;
  font-weight: 600;
  font-variation-settings: 'opsz' 48, 'SOFT' 40;
  letter-spacing: -0.015em;
}

.panel h2 svg {
  width: 1.25em;
  height: 1.25em;
  padding: 5px;
  box-sizing: content-box;
  border-radius: 10px;
  color: var(--brand);
  background: var(--brand-soft);
  box-shadow: inset 0 0 0 1px rgb(31 95 153 / 14%);
}

/* ================= Forms ================= */
.document-form {
  display: grid;
  gap: 16px;
}

.document-form > label,
.field-row > label {
  display: grid;
  gap: 7px;
  color: #2a4560;
  font-size: 0.88rem;
  font-weight: 650;
  transition: color 0.2s ease;
}

.document-form > label:has(input:focus-visible, select:focus-visible, textarea:focus-visible),
.field-row > label:has(input:focus-visible, select:focus-visible, textarea:focus-visible) {
  color: var(--brand);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* 1px border is a second background layer, so a light can travel around it on focus */
.document-form input:not([type='file']):not([type='checkbox']),
.document-form select,
.document-form textarea,
.search-field input {
  width: 100%;
  min-width: 0;
  padding: 11px 13px;
  border: 1px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(#f7fafd, #f7fafd) padding-box,
    linear-gradient(#d3dfec, #d3dfec) border-box;
  color: var(--ink);
  font: inherit;
  transition: box-shadow 0.3s ease, transform 0.3s var(--ease);
}

.document-form select {
  appearance: none;
  padding-right: 38px;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(#f7fafd, #f7fafd) padding-box,
    linear-gradient(#d3dfec, #d3dfec) border-box;
  cursor: pointer;
}

.document-form input:focus-visible,
.document-form textarea:focus-visible,
.search-field input:focus-visible {
  outline: none;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--brand), var(--sky) 25%, var(--teal) 50%, var(--sky) 75%, var(--brand)) border-box;
  box-shadow: 0 0 0 4px rgb(31 95 153 / 12%), 0 14px 26px -16px rgb(31 95 153 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

.document-form select:focus-visible {
  outline: none;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--brand), var(--sky) 25%, var(--teal) 50%, var(--sky) 75%, var(--brand)) border-box;
  box-shadow: 0 0 0 4px rgb(31 95 153 / 12%), 0 14px 26px -16px rgb(31 95 153 / 60%);
  animation: spin-angle 3.5s linear infinite;
}

.document-form textarea {
  resize: vertical;
  line-height: 1.55;
}

/* ----- Dropzone ----- */
.dropzone {
  position: relative;
  display: grid !important;
  justify-items: center;
  gap: 4px;
  padding: 26px 16px;
  border: 2px dashed #b3c8dd;
  border-radius: 16px;
  background:
    radial-gradient(70% 90% at 50% 0%, rgb(143 196 245 / 22%), transparent 70%),
    #f7fafd;
  text-align: center;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.25s ease, background 0.25s ease, transform 0.3s var(--ease), box-shadow 0.3s ease;
}

.dropzone:hover,
.dropzone:focus-within {
  border-color: var(--brand);
  background:
    radial-gradient(70% 90% at 50% 0%, rgb(143 196 245 / 38%), transparent 70%),
    var(--brand-soft);
  box-shadow: 0 18px 30px -22px rgb(31 95 153 / 60%);
  transform: translateY(-2px);
}

.dropzone svg {
  width: 32px;
  height: 32px;
  color: var(--brand);
  transition: transform 0.35s var(--spring);
}

.dropzone:hover svg {
  transform: translateY(-4px) scale(1.08);
}

.dropzone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.dz-title {
  max-width: 100%;
  color: var(--ink);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.dz-hint {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 500;
}

.dropzone.has-file {
  border-style: solid;
  border-color: var(--teal);
  background:
    radial-gradient(70% 90% at 50% 0%, rgb(14 138 134 / 20%), transparent 70%),
    var(--teal-soft);
}

.dropzone.has-file svg {
  color: var(--teal);
  animation: pop 0.45s var(--spring);
}

.approval-check {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: start;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f7fafd;
  box-shadow: inset 0 0 0 1px var(--line);
  color: #2a4560;
  font-size: 0.86rem;
  line-height: 1.5;
}

.approval-check input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: var(--brand);
}

/* ----- Buttons ----- */
.primary-button,
.secondary-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  justify-self: start;
  min-height: 42px;
  padding: 10px 18px;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  isolation: isolate;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.25s var(--ease), box-shadow 0.3s ease, background 0.2s ease;
}

.primary-button {
  color: #fff;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 16%), rgb(255 255 255 / 0%) 55%),
    linear-gradient(135deg, #2f74b3 0%, var(--brand) 50%, var(--brand-deep) 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 30%), inset 0 -1px 0 rgb(0 0 0 / 18%), 0 14px 24px -14px rgb(31 95 153 / 90%);
}

/* light sweep on hover */
.primary-button::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -60%;
  z-index: -1;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 32%), transparent);
  transform: skewX(-20deg);
  transition: left 0.8s var(--ease);
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 34%), inset 0 -1px 0 rgb(0 0 0 / 18%), 0 22px 30px -16px rgb(31 95 153 / 95%);
}

.primary-button:hover:not(:disabled)::before {
  left: 130%;
}

.secondary-button {
  color: var(--brand-deep);
  background: var(--brand-soft);
  box-shadow: inset 0 0 0 1px rgb(31 95 153 / 14%);
}

.secondary-button:hover:not(:disabled) {
  background: #d9e8f6;
  transform: translateY(-2px);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
.icon-button:focus-visible {
  outline: 3px solid rgb(143 196 245 / 70%);
  outline-offset: 2px;
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.65;
  cursor: wait;
}

.primary-button svg {
  stroke-width: 2.2;
  transition: transform 0.3s var(--spring);
}

.primary-button:hover:not(:disabled) svg {
  transform: translateY(-2px) scale(1.08);
}

.form-status {
  min-height: 1.2em;
  margin: 0;
  color: #2a4560;
  font-size: 0.86rem;
}

/* ================= Chat test panel ================= */
.chat-bubble {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 18px;
  animation: bubble-in 0.4s var(--ease) both;
}

.avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, var(--teal), var(--brand));
  box-shadow: 0 10px 18px -10px rgb(14 138 134 / 85%), inset 0 0 0 1px rgb(255 255 255 / 25%);
}

.avatar svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  stroke: none;
}

.bubble {
  position: relative;
  min-width: 0;
  padding: 13px 16px;
  border-radius: 4px 16px 16px 16px;
  background: linear-gradient(180deg, #f3f8fd, #eef4fa);
  box-shadow: inset 0 0 0 1px var(--line), 0 10px 20px -16px rgb(23 58 96 / 40%);
}

.test-answer {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}

.typing {
  display: flex;
  gap: 5px;
  align-items: center;
  height: 20px;
}

.typing i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--teal), var(--brand));
  animation: bounce 1s infinite ease-in-out;
}

.typing i:nth-child(2) { animation-delay: 0.15s; }
.typing i:nth-child(3) { animation-delay: 0.3s; }

/* ================= Library ================= */
.library-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.library-heading h2 {
  margin: 0;
}

.library-heading p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.search-field {
  position: relative;
  display: block;
  min-width: min(300px, 100%);
}

.search-field svg {
  position: absolute;
  left: 13px;
  top: 50%;
  z-index: 1;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
  transition: color 0.25s ease;
}

.search-field:focus-within svg {
  color: var(--brand);
}

.search-field input {
  padding-left: 38px;
}

.table-scroll {
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 14px;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

th {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, #f3f7fd, #eaf1fb);
  color: #274a6d;
  font-size: 0.8rem;
  font-weight: 650;
  white-space: nowrap;
}

td {
  padding: 14px;
  border-bottom: 1px solid #e8eef5;
  vertical-align: middle;
}

tbody tr {
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

tbody tr:hover {
  background: #f4f8fe;
  box-shadow: inset 3px 0 0 var(--brand);
}

tbody tr:last-child td {
  border-bottom: 0;
}

td small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
}

.doc-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.doc-cell strong {
  display: block;
  font-weight: 650;
}

.file-badge {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  color: var(--brand);
  background: linear-gradient(145deg, #fff, var(--brand-soft));
  box-shadow: inset 0 0 0 1px rgb(31 95 153 / 18%);
  transition: transform 0.4s var(--spring), background 0.25s ease, color 0.25s ease;
}

.file-badge svg {
  width: 20px;
  height: 20px;
}

tbody tr:hover .file-badge {
  color: #fff;
  background: linear-gradient(135deg, #2f74b3, var(--brand-deep));
  transform: rotate(-6deg) scale(1.08);
}

.audience {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #2a4560;
  white-space: nowrap;
}

.audience svg {
  color: var(--muted);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 11px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgb(168 98 10 / 25%);
  color: var(--amber);
  background: var(--amber-soft);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: capitalize;
}

.pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.4s ease-in-out infinite;
}

.pill-ready {
  box-shadow: inset 0 0 0 1px rgb(14 138 134 / 25%);
  color: var(--teal);
  background: var(--teal-soft);
}

.pill-ready .dot,
.pill-failed .dot {
  animation: none;
}

.pill-failed {
  box-shadow: inset 0 0 0 1px rgb(180 35 24 / 22%);
  color: var(--danger);
  background: var(--danger-soft);
}

.state-line {
  text-transform: capitalize;
}

.state-line.is-active {
  color: var(--teal);
  font-weight: 650;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 11px;
  border: 0;
  border-radius: 10px;
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--brand-deep);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.2s var(--ease);
}

.icon-button svg {
  transition: transform 0.3s var(--spring);
}

.icon-button:hover {
  background: var(--brand-soft);
  box-shadow: inset 0 0 0 1px #bcd2e8;
  transform: translateY(-1px);
}

.icon-button:hover svg {
  transform: scale(1.15);
}

.icon-button:active {
  transform: scale(0.96);
}

.icon-button.danger {
  color: var(--danger);
}

.icon-button.danger:hover {
  background: var(--danger-soft);
  box-shadow: inset 0 0 0 1px #f2c4c0;
}

.replace-control input {
  display: none;
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 40px 20px;
  border: 1px dashed #cdd9e8;
  border-radius: 16px;
  text-align: center;
  color: var(--muted);
}

.empty-state svg {
  width: 46px;
  height: 46px;
  color: #9db4cb;
  animation: float 3s ease-in-out infinite;
}

.empty-state p {
  margin: 0;
}

.skeleton-list {
  display: grid;
  gap: 10px;
}

.skeleton {
  height: 58px;
  border-radius: 14px;
  background: linear-gradient(90deg, #eef3f8 25%, #f9fbfd 50%, #eef3f8 75%);
  background-size: 200% 100%;
  animation: shimmer 1.3s infinite linear;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgb(255 255 255 / 40%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner.dark {
  border-color: rgb(23 74 121 / 25%);
  border-top-color: var(--brand-deep);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ================= Keyframes ================= */
@keyframes heading-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
@keyframes panel-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes bubble-in { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes sheen { from { background-position: 0 0, 0% 0%, 100% 100%, 100% 60%, 0 0; } to { background-position: 0 0, 30% 20%, 70% 80%, 70% 40%, 0 0; } }
@keyframes orbit { to { --angle: 360deg; } }
@keyframes spin-angle { to { --angle: 360deg; } }
@keyframes twinkle { 0%, 100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.15) rotate(12deg); } }
@keyframes halo { 0% { opacity: 0.8; transform: scale(0.92); } 70%, 100% { opacity: 0; transform: scale(1.25); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-6px); opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
@keyframes shimmer { to { background-position: -200% 0; } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes pop { 0% { transform: scale(0.7); } 70% { transform: scale(1.18); } 100% { transform: scale(1); } }

/* ================= Responsive ================= */
@media (max-width: 1000px) {
  .workspace { grid-template-columns: 1fr; }
  .side-column { position: static; order: -1; }
  .page-heading::before { right: -30%; }
}

@media (max-width: 600px) {
  .page-heading { padding: 22px 18px; border-radius: 18px; }
  .page-heading::before { right: -60%; width: 420px; }
  .heading-icon { width: 50px; height: 50px; }
  .stats { width: 100%; }
  .stats li { flex: 1; min-width: 0; }
  .field-row { grid-template-columns: 1fr; }
  .panel { padding: 16px; }
  .library-heading { align-items: stretch; flex-direction: column; }
  .search-field { min-width: 0; }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .ai-management-page *,
  .ai-management-page *::before,
  .ai-management-page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>