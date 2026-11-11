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
    <header class="page-heading"><div><p class="eyebrow">ADMINISTRATOR PORTAL</p><h1>AI Management</h1><p>Manage approved source documents and test grounded answers.</p></div></header>
    <div class="management-grid">
      <section class="panel">
        <h2>Add a knowledge document</h2>
        <form class="document-form" @submit.prevent="uploadDocument()">
          <label>Document title<input v-model.trim="form.title" maxlength="180" required></label>
          <label>Category<select v-model="form.category_id" required><option value="">Choose a category</option><option v-for="category in categories" :key="category.category_id" :value="category.category_id">{{ category.name }}</option></select></label>
          <label>Available to<select v-model="form.audience"><option value="public">All portal users</option><option value="teaching">Instructors and administrators</option><option value="staff">Staff and administrators</option><option value="admin">Administrators only</option></select></label>
          <label>File (PDF, DOCX, or TXT; max 15 MB)<input type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain" required @change="selectedFile = $event.target.files?.[0] || null"></label>
          <label class="approval-check"><input v-model="form.approved_for_ai" type="checkbox" required><span>I confirm this copy is approved for student facing AI use and contains no unnecessary personal or confidential information.</span></label>
          <button class="primary-button" type="submit" :disabled="uploadBusy">{{ uploadBusy ? 'Indexing…' : 'Upload and index' }}</button>
          <p class="form-status" role="status" aria-live="polite">{{ status }}</p>
        </form>
      </section>
      <section class="panel test-panel">
        <h2>Test AI responses</h2>
        <form class="document-form" @submit.prevent="testResponse"><label>Question<textarea v-model="testQuestion" rows="3" maxlength="2000" placeholder="Ask about a policy or training document" required></textarea></label><button class="secondary-button" type="submit" :disabled="testBusy">{{ testBusy ? 'Testing…' : 'Test answer' }}</button></form>
        <div v-if="testAnswer" class="test-answer" role="status">{{ testAnswer }}</div>
      </section>
    </div>
    <section class="panel library-panel">
      <div class="library-heading"><div><h2>Document library</h2><p>Search, activate, deactivate, replace, or delete AI source documents.</p></div><label class="search-field">Search<input v-model="search" type="search" placeholder="Title, category, or filename" @input="loadData"></label></div>
      <p v-if="loading" class="empty-state">Loading documents…</p>
      <div v-else-if="visibleDocuments.length" class="table-scroll"><table><thead><tr><th>Document</th><th>Category</th><th>Audience</th><th>Processing / status</th><th>Actions</th></tr></thead><tbody><tr v-for="document in visibleDocuments" :key="document.document_id"><td><strong>{{ document.title }}</strong><small>{{ document.original_filename }} · v{{ document.version }}</small></td><td>{{ document.category_name || '—' }}</td><td>{{ document.audience }}</td><td><span>{{ document.processing_status }}</span><small>{{ document.status }}<template v-if="document.processing_error"> · {{ document.processing_error }}</template></small></td><td><div class="row-actions"><button v-if="document.processing_status === 'ready'" class="link-button" type="button" @click="changeStatus(document)">{{ document.status === 'active' ? 'Deactivate' : 'Activate' }}</button><button class="link-button danger" type="button" @click="deleteDocument(document)">Delete</button><label class="link-button replace-control">Replace<input type="file" accept=".pdf,.docx,.txt" @change="replacementFiles[document.document_id] = $event.target.files?.[0] || null; replacementFiles[document.document_id] && uploadDocument(replacementFiles[document.document_id], document)"></label></div></td></tr></tbody></table></div>
      <p v-else class="empty-state">No AI knowledge documents found.</p>
    </section>
  </div>
</template>

<style scoped>
.ai-management-page{max-width:1400px;margin:0 auto;color:#18324b}.page-heading{display:flex;justify-content:space-between;align-items:center;margin:8px 0 22px}.page-heading h1{margin:4px 0;font-size:clamp(1.7rem,3vw,2.4rem)}.page-heading p:last-child{margin:0;color:#64748b}.eyebrow{margin:0;color:#52708b;font-size:.75rem;font-weight:800;letter-spacing:.12em}.management-grid{display:grid;grid-template-columns:minmax(300px,.8fr) minmax(320px,1.2fr);gap:18px}.panel{min-width:0;margin-bottom:18px;padding:20px;border:1px solid #dbe4ef;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgb(23 58 96 / 5%)}.panel h2{margin:0 0 15px;font-size:1.1rem}.document-form{display:grid;gap:12px}.document-form>label{display:grid;gap:6px;color:#31506a;font-size:.9rem;font-weight:650}.document-form input:not([type=file]):not([type=checkbox]),.document-form select,.document-form textarea,.search-field input{width:100%;min-width:0;padding:10px 11px;border:1px solid #cbd7e4;border-radius:9px;background:#fff;color:#18324b;font:inherit}.document-form input[type=file]{font:inherit}.approval-check{grid-template-columns:auto 1fr!important;align-items:start;line-height:1.45}.approval-check input{margin-top:3px}.primary-button,.secondary-button{justify-self:start;border:0;border-radius:9px;padding:10px 14px;color:#fff;background:#245f96;font:inherit;font-weight:700;cursor:pointer}.secondary-button{background:#eaf2fa;color:#214d75}.primary-button:disabled,.secondary-button:disabled{opacity:.55;cursor:wait}.form-status{min-height:1.2em;margin:0;color:#31506a;font-size:.86rem}.test-answer{margin-top:14px;padding:13px;border-radius:10px;background:#f4f8fc;white-space:pre-wrap;overflow-wrap:anywhere}.library-panel{margin-top:2px}.library-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:12px}.library-heading h2{margin:0}.library-heading p{margin:5px 0 0;color:#64748b;font-size:.9rem}.search-field{display:grid;min-width:min(300px,100%);gap:5px;color:#31506a;font-size:.85rem;font-weight:650}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:.9rem}th,td{padding:12px 10px;border-bottom:1px solid #e5ebf2;vertical-align:top}th{color:#52708b;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}td small{display:block;margin-top:4px;color:#64748b}.row-actions{display:flex;flex-wrap:wrap;gap:8px}.link-button{border:0;padding:3px 0;color:#245f96;background:none;font:inherit;font-size:.85rem;font-weight:700;cursor:pointer}.link-button.danger{color:#b42318}.replace-control input{display:none}.empty-state{padding:20px;text-align:center;color:#64748b}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:900px){.management-grid{grid-template-columns:1fr}}@media(max-width:600px){.library-heading{align-items:stretch;flex-direction:column}.search-field{min-width:0}.panel{padding:15px}.ai-management-page{padding:0 2px}}
</style>
