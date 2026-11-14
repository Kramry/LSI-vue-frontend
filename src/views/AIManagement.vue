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
.ai-management-page {
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
}
 
svg { width: 1.1em; height: 1.1em; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
 
/* ---------- Header ---------- */
.page-heading {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px;
  margin: 8px 0 22px; padding: 22px 24px;
  border-radius: 18px; color: #fff;
  background: linear-gradient(120deg, #153a5e 0%, #1f5f99 60%, #0e8a86 130%);
  background-size: 160% 100%;
  box-shadow: 0 14px 34px rgb(21 58 94 / 18%);
  animation: heading-in .6s cubic-bezier(.2,.7,.2,1) both, sheen 14s ease-in-out infinite alternate;
}
.heading-text { display: flex; align-items: center; gap: 16px; }
.heading-icon {
  display: grid; place-items: center; width: 54px; height: 54px; border-radius: 16px;
  background: rgb(255 255 255 / 14%); border: 1px solid rgb(255 255 255 / 25%);
}
.heading-icon svg { width: 28px; height: 28px; fill: currentColor; stroke: none; animation: twinkle 3.2s ease-in-out infinite; transform-origin: center; }
.page-heading h1 { margin: 2px 0; font-size: clamp(1.6rem, 3vw, 2.3rem); line-height: 1.1; }
.eyebrow { margin: 0; font-size: .8rem; font-weight: 700; letter-spacing: .04em; opacity: .75; }
.subtitle { margin: 0; opacity: .85; }
 
.stats { display: flex; gap: 10px; margin: 0; padding: 0; list-style: none; }
.stats li {
  display: grid; grid-template-columns: auto auto; align-items: center; column-gap: 8px;
  min-width: 112px; padding: 10px 14px; border-radius: 12px;
  background: rgb(255 255 255 / 12%); border: 1px solid rgb(255 255 255 / 20%);
}
.stats svg { grid-row: span 2; width: 22px; height: 22px; opacity: .9; }
.stats strong { font-size: 1.35rem; line-height: 1; }
.stats span { font-size: .78rem; opacity: .8; }
.stat-busy svg { animation: spin 3s linear infinite; }
 
/* ---------- Layout ---------- */
.workspace { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr); gap: 20px; align-items: start; }
.side-column { display: grid; gap: 20px; position: sticky; top: 16px; }
 
.panel {
  min-width: 0; padding: 22px; border: 1px solid var(--line); border-radius: var(--radius);
  background: var(--surface); box-shadow: 0 6px 20px rgb(23 58 96 / 5%);
  animation: panel-in .5s cubic-bezier(.2,.7,.2,1) both;
}
.library-panel { animation-delay: .08s; }
.side-column .panel:nth-child(1) { animation-delay: .14s; }
.side-column .panel:nth-child(2) { animation-delay: .2s; }
 
.panel h2 { display: flex; align-items: center; gap: 9px; margin: 0 0 16px; font-size: 1.1rem; }
.panel h2 svg { width: 1.3em; height: 1.3em; padding: 5px; box-sizing: content-box; border-radius: 9px; color: var(--brand); background: var(--brand-soft); }
 
/* ---------- Forms ---------- */
.document-form { display: grid; gap: 14px; }
.document-form > label, .field-row > label { display: grid; gap: 6px; color: #2f4a63; font-size: .88rem; font-weight: 650; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
 
.document-form input:not([type=file]):not([type=checkbox]),
.document-form select,
.document-form textarea,
.search-field input {
  width: 100%; min-width: 0; padding: 10px 12px; border: 1px solid #c9d6e4; border-radius: 10px;
  background: #fff; color: var(--ink); font: inherit; transition: border-color .2s, box-shadow .2s;
}
.document-form input:focus-visible, .document-form select:focus-visible, .document-form textarea:focus-visible, .search-field input:focus-visible {
  outline: none; border-color: var(--brand); box-shadow: 0 0 0 4px rgb(31 95 153 / 15%);
}
.document-form textarea { resize: vertical; }
 
.dropzone {
  position: relative; display: grid !important; justify-items: center; gap: 4px; padding: 20px 14px; text-align: center;
  border: 2px dashed #b7c9dc; border-radius: 12px; background: #f7fafd; cursor: pointer;
  transition: border-color .2s, background .2s, transform .2s;
}
.dropzone:hover, .dropzone:focus-within { border-color: var(--brand); background: var(--brand-soft); }
.dropzone svg { width: 30px; height: 30px; color: var(--brand); transition: transform .25s; }
.dropzone:hover svg { transform: translateY(-3px); }
.dropzone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.dz-title { max-width: 100%; color: var(--ink); font-weight: 700; overflow-wrap: anywhere; }
.dz-hint { color: var(--muted); font-size: .8rem; font-weight: 500; }
.dropzone.has-file { border-style: solid; border-color: var(--teal); background: var(--teal-soft); }
.dropzone.has-file svg { color: var(--teal); animation: pop .35s ease; }
 
.approval-check { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; font-size: .86rem; line-height: 1.45; color: #2f4a63; }
.approval-check input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--brand); }
 
.primary-button, .secondary-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; justify-self: start;
  padding: 10px 16px; border: 0; border-radius: 10px; font: inherit; font-weight: 700; cursor: pointer;
  transition: transform .15s, box-shadow .2s, background .2s;
}
.primary-button { color: #fff; background: linear-gradient(135deg, var(--brand), var(--brand-deep)); box-shadow: 0 6px 14px rgb(31 95 153 / 28%); }
.secondary-button { color: var(--brand-deep); background: var(--brand-soft); }
.primary-button:hover:not(:disabled), .secondary-button:hover:not(:disabled) { transform: translateY(-1px); }
.primary-button:active:not(:disabled), .secondary-button:active:not(:disabled) { transform: translateY(1px); }
.primary-button:focus-visible, .secondary-button:focus-visible, .icon-button:focus-visible { outline: 3px solid rgb(31 95 153 / 35%); outline-offset: 2px; }
.primary-button:disabled, .secondary-button:disabled { opacity: .6; cursor: wait; }
.primary-button svg { stroke-width: 2.2; }
 
.form-status { min-height: 1.2em; margin: 0; color: #2f4a63; font-size: .86rem; }
 
/* ---------- Chat test panel ---------- */
.chat-bubble { display: flex; gap: 10px; align-items: flex-start; margin-top: 16px; animation: bubble-in .35s cubic-bezier(.2,.8,.3,1) both; }
.avatar { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 50%; color: #fff; background: linear-gradient(135deg, var(--teal), var(--brand)); }
.avatar svg { width: 18px; height: 18px; fill: currentColor; stroke: none; }
.bubble { min-width: 0; padding: 12px 14px; border-radius: 4px 14px 14px 14px; background: #f1f6fb; border: 1px solid var(--line); }
.test-answer { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
.typing { display: flex; gap: 5px; align-items: center; height: 20px; }
.typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--brand); animation: bounce 1s infinite ease-in-out; }
.typing i:nth-child(2) { animation-delay: .15s; }
.typing i:nth-child(3) { animation-delay: .3s; }
 
/* ---------- Library ---------- */
.library-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; }
.library-heading h2 { margin: 0; }
.library-heading p { margin: 6px 0 0; color: var(--muted); font-size: .9rem; }
 
.search-field { position: relative; display: block; min-width: min(300px, 100%); }
.search-field svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
.search-field input { padding-left: 36px; }
 
.table-scroll { overflow: auto; }
table { width: 100%; border-collapse: collapse; text-align: left; font-size: .9rem; }
th { padding: 10px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: .8rem; font-weight: 700; }
td { padding: 14px 10px; border-bottom: 1px solid #e8eef5; vertical-align: middle; }
tbody tr { transition: background .2s; }
tbody tr:hover { background: #f6f9fc; }
tbody tr:last-child td { border-bottom: 0; }
td small { display: block; margin-top: 3px; color: var(--muted); }
 
.doc-cell { display: flex; align-items: center; gap: 12px; }
.doc-cell strong { display: block; }
.file-badge { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 10px; color: var(--brand); background: var(--brand-soft); }
.file-badge svg { width: 20px; height: 20px; }
 
.audience { display: inline-flex; align-items: center; gap: 6px; color: #2f4a63; white-space: nowrap; }
.audience svg { color: var(--muted); }
 
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: .8rem; font-weight: 700; text-transform: capitalize; color: var(--amber); background: var(--amber-soft); }
.pill .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: pulse 1.4s ease-in-out infinite; }
.pill-ready { color: var(--teal); background: var(--teal-soft); }
.pill-ready .dot, .pill-failed .dot { animation: none; }
.pill-failed { color: var(--danger); background: var(--danger-soft); }
.state-line { text-transform: capitalize; }
.state-line.is-active { color: var(--teal); font-weight: 650; }
 
.row-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.icon-button {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 9px;
  background: #fff; color: var(--brand-deep); font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer;
  transition: background .2s, border-color .2s, transform .15s;
}
.icon-button:hover { background: var(--brand-soft); border-color: #bcd2e8; }
.icon-button:active { transform: scale(.96); }
.icon-button.danger { color: var(--danger); }
.icon-button.danger:hover { background: var(--danger-soft); border-color: #f2c4c0; }
.replace-control input { display: none; }
 
.empty-state { display: grid; justify-items: center; gap: 10px; padding: 36px 20px; text-align: center; color: var(--muted); }
.empty-state svg { width: 44px; height: 44px; color: #9db4cb; animation: float 3s ease-in-out infinite; }
.empty-state p { margin: 0; }
 
.skeleton-list { display: grid; gap: 10px; }
.skeleton { height: 56px; border-radius: 12px; background: linear-gradient(90deg, #eef3f8 25%, #f9fbfd 50%, #eef3f8 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite linear; }
 
.spinner { width: 16px; height: 16px; border: 2px solid rgb(255 255 255 / 40%); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
.spinner.dark { border-color: rgb(23 74 121 / 25%); border-top-color: var(--brand-deep); }
 
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
 
/* ---------- Keyframes ---------- */
@keyframes heading-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
@keyframes panel-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes bubble-in { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes sheen { to { background-position: 100% 0; } }
@keyframes twinkle { 0%, 100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.15) rotate(12deg); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: .5; } 40% { transform: translateY(-6px); opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.7); } }
@keyframes shimmer { to { background-position: -200% 0; } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes pop { 0% { transform: scale(.7); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
 
/* ---------- Responsive ---------- */
@media (max-width: 1000px) {
  .workspace { grid-template-columns: 1fr; }
  .side-column { position: static; order: -1; }
}
@media (max-width: 600px) {
  .page-heading { padding: 18px; }
  .stats { width: 100%; }
  .stats li { flex: 1; min-width: 0; }
  .field-row { grid-template-columns: 1fr; }
  .panel { padding: 16px; }
  .library-heading { align-items: stretch; flex-direction: column; }
  .search-field { min-width: 0; }
}
 
@media (prefers-reduced-motion: reduce) {
  .ai-management-page *, .ai-management-page *::before, .ai-management-page *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important;
  }
}
</style>