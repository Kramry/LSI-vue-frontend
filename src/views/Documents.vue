<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFileUrl, apiGet, apiPost, getSession } from '../services/api'

interface DocumentRecord {
  document_id: number
  trainee_id: number | null
  class_id: number | null
  trainee_name: string
  document_name: string
  upload_date: string
  review_status: 'pending' | 'approved' | 'rejected' | string
  status: string
  access_level: string
}
interface Choice { id: number | string; label: string }
interface Requirement { requirement_id: number; class_id: number; class_name: string; required_document_name: string }
interface DocumentsData {
  records: DocumentRecord[]
  can_upload: boolean
  can_manage_documents: boolean
  document_requirements: Requirement[]
  document_options: { trainees: Choice[]; classes: Choice[] }
}

const data = ref<DocumentsData | null>(null)
const role = ref('')
const requirementId = ref('')
const requirementClassId = ref('')
const requirementName = ref('')
const documentName = ref('')
const traineeId = ref('')
const classId = ref('')
const accessLevel = ref('private')
const file = ref<File | null>(null)
const uploadBusy = ref(false)
const busyId = ref<number | null>(null)
const requirementBusy = ref(false)
const loading = ref(true)
const error = ref('')
const notice = ref('')
const search = ref('')
const statusFilter = ref('')
const accessFilter = ref('')
const isTrainee = computed(() => role.value === 'trainee')
const canUpload = computed(() => data.value?.can_upload ?? false)
const pendingCount = computed(() => data.value?.records.filter((item) => item.trainee_id && item.review_status === 'pending').length ?? 0)
const filteredRecords = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (data.value?.records || []).filter((item) => {
    const matchesSearch = !term || [item.document_name, item.trainee_name, item.upload_date, item.review_status, item.access_level]
      .some((value) => String(value || '').toLowerCase().includes(term))
    const matchesStatus = !statusFilter.value || (item.trainee_id ? item.review_status : '') === statusFilter.value
    const matchesAccess = !accessFilter.value || item.access_level === accessFilter.value
    return matchesSearch && matchesStatus && matchesAccess
  })
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiGet<DocumentsData>('/modules/documents')
    data.value = response.data
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load documents.'
  } finally {
    loading.value = false
  }
}

function chooseFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] || null
}

async function upload() {
  if (!file.value) {
    error.value = 'Select a document to upload.'
    return
  }
  const body = new FormData()
  body.append('document', file.value)
  if (isTrainee.value) {
    body.append('requirement_id', requirementId.value)
  } else {
    body.append('document_name', documentName.value)
    body.append('trainee_id', traineeId.value)
    body.append('class_id', classId.value)
    body.append('document_scope', accessLevel.value === 'institution' ? 'institution' : 'trainee')
    body.append('access_level', accessLevel.value)
  }
  uploadBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost('/documents/upload', body)
    notice.value = response.message || 'Document uploaded.'
    file.value = null
    ;(document.querySelector('#document-file') as HTMLInputElement | null)?.form?.reset()
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to upload the document.'
  } finally {
    uploadBusy.value = false
  }
}

async function review(item: DocumentRecord, decision: 'approved' | 'rejected') {
  busyId.value = item.document_id
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost(`/documents/${item.document_id}/review`, { decision })
    notice.value = response.message || `Document ${decision}.`
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to review this document.'
  } finally {
    busyId.value = null
  }
}

async function removeDocument(item: DocumentRecord) {
  if (!window.confirm(`Delete "${item.document_name}" permanently? This also removes the stored file.`)) {
    return
  }

  busyId.value = item.document_id
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost(`/documents/${item.document_id}/delete`, {})
    notice.value = response.message || 'Document deleted.'
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to delete this document.'
  } finally {
    busyId.value = null
  }
}

async function saveRequirement() {
  requirementBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost('/certificate-requirements/save', {
      class_id: requirementClassId.value,
      required_document_name: requirementName.value,
    })
    notice.value = response.message || 'Required document added.'
    requirementClassId.value = ''
    requirementName.value = ''
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to add the document requirement.'
  } finally {
    requirementBusy.value = false
  }
}

async function deleteRequirement(item: Requirement) {
  if (!window.confirm(`Remove "${item.required_document_name}" from ${item.class_name}?`)) return

  requirementBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost(`/certificate-requirements/${item.requirement_id}/delete`, {})
    notice.value = response.message || 'Requirement removed.'
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to remove the document requirement.'
  } finally {
    requirementBusy.value = false
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
  <div class="page">
    <header class="page-heading">
      <div class="heading-text">
        <p class="eyebrow">SMARTTRACK / REQUIREMENTS</p>
        <h1>Documents</h1>
        <p class="muted">Submit trainee requirements and review uploaded documents.</p>
      </div>
      <div class="heading-actions">
        <div v-if="data?.can_manage_documents" class="summary" :class="{ clear: !pendingCount }">
          <strong>{{ pendingCount }}</strong>
          <span>awaiting review</span>
        </div>
        <button class="secondary-button" :disabled="loading" @click="load">Refresh</button>
      </div>
    </header>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="inline-success" role="status">{{ notice }}</p>

    <div class="layout" :class="{ single: !canUpload }">
      <aside v-if="canUpload" class="panel upload-panel">
        <h2>{{ isTrainee ? 'Submit a required document' : 'Upload a document' }}</h2>
        <p class="muted">PDF, JPG, PNG or DOCX, up to 10 MB.</p>

        <form class="upload-form" @submit.prevent="upload">
          <label v-if="isTrainee">
            Required document
            <select v-model="requirementId" required>
              <option value="" disabled>Select requirement</option>
              <option v-for="item in data?.document_requirements || []" :key="item.requirement_id" :value="String(item.requirement_id)">
                {{ item.class_name }} — {{ item.required_document_name }}
              </option>
            </select>
          </label>

          <template v-else>
            <label>
              Document name
              <input v-model.trim="documentName" maxlength="150" placeholder="e.g. Training plan Q4" required>
            </label>
            <label>
              Trainee
              <select v-model="traineeId" :required="accessLevel !== 'institution'">
                <option value="" disabled>Select trainee</option>
                <option v-for="item in data?.document_options.trainees || []" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
              </select>
            </label>
            <label v-if="role !== 'instructor'">
              Visibility
              <select v-model="accessLevel">
                <option value="private">Private</option>
                <option value="class">Class</option>
                <option value="staff">Staff only</option>
                <option value="institution">Institution</option>
              </select>
            </label>
            <label v-if="accessLevel === 'class' || role === 'instructor'">
              Class
              <select v-model="requirementClassId" required>
                <option value="" disabled>Select class</option>
                <option v-for="item in data?.document_options.classes || []" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
              </select>
            </label>
          </template>

          <label>
            File
            <input id="document-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" required @change="chooseFile">
          </label>

          <button class="primary-button" :disabled="uploadBusy">
            {{ uploadBusy ? 'Uploading…' : 'Upload document' }}
          </button>
        </form>
      </aside>

      <section class="panel list-panel">
        <div class="section-heading">
          <div>
            <h2>{{ isTrainee ? 'My documents' : 'Uploaded documents' }}</h2>
            <p class="muted">Review status is shown for trainee requirement submissions.</p>
          </div>
          <span v-if="!loading" class="count-badge">{{ filteredRecords.length }} of {{ data?.records?.length || 0 }} files</span>
        </div>

        <div v-if="!loading" class="document-filters">
          <label>
            Search documents
            <input v-model.trim="search" type="search" placeholder="Name, trainee, date">
          </label>
          <label>
            Review status
            <select v-model="statusFilter">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label>
            Access
            <select v-model="accessFilter">
              <option value="">All access levels</option>
              <option value="private">Private</option>
              <option value="class">Class</option>
              <option value="staff">Staff only</option>
              <option value="institution">Institution</option>
            </select>
          </label>
          <button v-if="search || statusFilter || accessFilter" class="clear-filters" type="button" @click="search = ''; statusFilter = ''; accessFilter = ''">
            Clear filters
          </button>
        </div>

        <p v-if="loading" class="muted loading">Loading documents…</p>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Trainee</th>
                <th>Uploaded</th>
                <th>Review status</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredRecords" :key="item.document_id">
                <td class="doc-name">{{ item.document_name }}</td>
                <td>{{ item.trainee_name || '—' }}</td>
                <td>{{ item.upload_date }}</td>
                <td>
                  <span class="status" :class="[item.review_status, { none: !item.trainee_id }]">
                    {{ item.trainee_id ? item.review_status : '—' }}
                  </span>
                </td>
                <td><span class="access">{{ item.access_level }}</span></td>
                <td class="actions">
                  <a class="text-button" :href="apiFileUrl(`/documents/${item.document_id}`)" target="_blank" rel="noopener">Download</a>
                  <template v-if="data?.can_manage_documents && item.trainee_id && item.review_status === 'pending'">
                    <button class="text-button approve" :disabled="busyId === item.document_id" @click="review(item, 'approved')">Approve</button>
                    <button class="text-button reject" :disabled="busyId === item.document_id" @click="review(item, 'rejected')">Reject</button>
                  </template>
                  <button v-if="data?.can_manage_documents" class="text-button delete-button" :disabled="busyId === item.document_id" @click="removeDocument(item)">
                    {{ busyId === item.document_id ? 'Deleting…' : 'Delete' }}
                  </button>
                </td>
              </tr>
              <tr v-if="!filteredRecords.length">
                <td colspan="6" class="empty">{{ data?.records?.length ? 'No documents match these filters.' : 'No documents uploaded yet.' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <section v-if="data?.can_manage_documents" class="panel requirements-panel">
      <div class="section-heading">
        <div>
          <h2>Required documents by class</h2>
          <p class="muted">Configure the documents trainees must submit for each class.</p>
        </div>
      </div>
      <form class="requirement-form" @submit.prevent="saveRequirement">
        <label>
          Class
          <select v-model="classId" required>
            <option value="" disabled>Select class</option>
            <option v-for="item in data?.document_options.classes || []" :key="item.id" :value="String(item.id)">{{ item.label }}</option>
          </select>
        </label>
        <label>
          Document name
          <input v-model.trim="requirementName" maxlength="150" required>
        </label>
        <button class="primary-button" :disabled="requirementBusy">
          {{ requirementBusy ? 'Adding…' : 'Add requirement' }}
        </button>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Class</th><th>Required document</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="item in data?.document_requirements || []" :key="item.requirement_id">
              <td>{{ item.class_name }}</td>
              <td>{{ item.required_document_name }}</td>
              <td><button class="text-button delete-button" :disabled="requirementBusy" @click="deleteRequirement(item)">Remove</button></td>
            </tr>
            <tr v-if="!data?.document_requirements?.length"><td colspan="3" class="empty">No requirements configured.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
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
}

/* ---------- Banner ---------- */
.page-heading,
.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.page-heading {
  position: relative;
  align-items: center;
  padding: 26px 28px;
  border-radius: 14px;
  color: #fff;
  background: var(--navy);
  overflow: hidden;
}

.page-heading::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, transparent 0 120px, rgb(255 255 255 / 4%) 120px 121px);
  pointer-events: none;
}

.page-heading > * {
  position: relative;
}

.page-heading h1 {
  margin: 0;
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.page-heading .muted {
  margin: 6px 0 0;
  color: rgb(255 255 255 / 80%);
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--sky);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid rgb(242 190 60 / 55%);
  border-radius: 10px;
  background: rgb(242 190 60 / 16%);
  color: #ffe3a1;
  font-size: 13px;
}

.summary strong {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
}

.summary.clear {
  border-color: rgb(255 255 255 / 25%);
  background: rgb(255 255 255 / 10%);
  color: rgb(255 255 255 / 80%);
}

.muted {
  color: var(--muted);
  font-size: 14px;
}

/* ---------- Layout ---------- */
.layout {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
  margin-top: 18px;
}

.layout.single {
  grid-template-columns: 1fr;
}

.panel {
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.upload-panel {
  position: sticky;
  top: 16px;
  border-top: 3px solid var(--blue);
}

.panel h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 21px;
  font-weight: 600;
}

.upload-panel .muted {
  margin: 6px 0 0;
}

/* ---------- Upload form ---------- */
.upload-form {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.upload-form label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
}

.upload-form input,
.upload-form select {
  min-width: 0;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.upload-form input:hover,
.upload-form select:hover {
  border-color: #b6c8de;
}

.upload-form input:focus,
.upload-form select:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 18%);
}

/* file picker as a drop-zone look */
.upload-form input[type='file'] {
  padding: 18px 12px;
  border: 2px dashed #b6c8de;
  background: #f9fbfe;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}

.upload-form input[type='file']::file-selector-button {
  margin-right: 12px;
  padding: 8px 14px;
  border: 0;
  border-radius: 6px;
  background: var(--blue);
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.upload-form input[type='file']::file-selector-button:hover {
  background: var(--blue-hover);
}

/* ---------- Buttons ---------- */
.primary-button,
.secondary-button {
  min-height: 44px;
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.primary-button {
  background: var(--blue);
  color: #fff;
}

.primary-button:hover:not(:disabled) {
  background: var(--blue-hover);
}

.secondary-button {
  background: #e3ebf6;
  color: var(--navy-deep);
}

.page-heading .secondary-button {
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
}

.page-heading .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: translateY(1px);
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---------- Messages ---------- */
.inline-error,
.inline-success {
  margin: 16px 0 0;
  padding: 12px 14px;
  border-radius: 6px;
}

.inline-error {
  border-left: 3px solid var(--danger);
  background: #fdeceb;
  color: var(--danger);
}

.inline-success {
  border-left: 3px solid var(--ok);
  background: #e3f4ea;
  color: #1f6b41;
}

/* ---------- Documents table ---------- */
.count-badge {
  padding: 6px 12px;
  border-radius: 999px;
  background: #e0eefc;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.document-filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 180px 180px auto;
  gap: 12px;
  align-items: end;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f8fafd;
}

.requirements-panel {
  margin-top: 20px;
}

.requirement-form {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1.5fr) auto;
  gap: 12px;
  align-items: end;
  margin-top: 18px;
}

.requirement-form label {
  display: grid;
  gap: 5px;
  color: var(--navy);
  font-size: 12px;
  font-weight: 700;
}

.requirement-form input,
.requirement-form select {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--text);
  background: #fff;
  font-size: 13px;
}

.document-filters label {
  display: grid;
  gap: 5px;
  color: var(--navy);
  font-size: 12px;
  font-weight: 700;
}

.document-filters input,
.document-filters select {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--text);
  background: #fff;
  font-size: 13px;
}

.clear-filters {
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--blue);
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.loading {
  padding: 24px 0;
}

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
  vertical-align: middle;
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

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f6f9fd;
}

.doc-name {
  color: var(--navy-deep);
  font-weight: 600;
}

.status {
  display: inline-block;
  padding: 4px 11px;
  border-radius: 999px;
  background: #fbf0d3;
  color: #8a5d00;
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
}

.status.approved {
  background: #e3f4ea;
  color: #1f6b41;
}

.status.rejected {
  background: #fdeceb;
  color: var(--danger);
}

.status.none {
  padding: 4px 0;
  background: none;
  color: var(--muted);
}

.access {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  background: var(--field);
  color: var(--navy);
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
}

.actions {
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
}

.text-button {
  padding: 5px 9px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--blue);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.text-button:hover:not(:disabled) {
  background: var(--field);
  color: var(--navy-deep);
}

.text-button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.approve {
  color: var(--ok);
}

.approve:hover:not(:disabled) {
  background: #e3f4ea;
  color: #1f6b41;
}

.reject {
  color: var(--danger);
}

.reject:hover:not(:disabled) {
  background: #fdeceb;
  color: var(--danger);
}

.delete-button {
  color: var(--danger);
}

.delete-button:hover:not(:disabled) {
  background: #fdeceb;
  color: #a52e2e;
}

.empty {
  padding: 32px;
  text-align: center;
  color: var(--muted);
}

/* ---------- Responsive ---------- */
@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .upload-panel {
    position: static;
  }

  .document-filters {
    grid-template-columns: 1fr 1fr;
  }

  .requirement-form {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 560px) {
  .document-filters {
    grid-template-columns: 1fr;
  }

  .requirement-form {
    grid-template-columns: 1fr;
  }

  .page-heading {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px 20px;
  }

  .page-heading h1 {
    font-size: 26px;
  }

  .heading-actions {
    width: 100%;
    justify-content: space-between;
  }

  .panel {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .upload-form input,
  .upload-form select,
  .primary-button,
  .secondary-button {
    transition: none;
  }
}
</style>