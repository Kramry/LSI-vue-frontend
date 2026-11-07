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
interface TraineeClass { class_id: number; class_name: string; program_id: number; program_name: string }
interface DocumentsData {
  records: DocumentRecord[]
  can_upload: boolean
  can_manage_documents: boolean
  can_review_documents: boolean
  can_manage_requirements: boolean
  document_requirements: Requirement[]
  trainee_classes: TraineeClass[]
  document_options: { trainees: Choice[]; classes: Choice[] }
}
interface StorageStatus { enabled: boolean; provider: string; fallback_available: boolean }

const data = ref<DocumentsData | null>(null)
const storage = ref<StorageStatus>({ enabled: false, provider: 'local', fallback_available: true })
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
const traineeRequirements = computed(() => data.value?.document_requirements || [])

function requirementStatus(requirement: Requirement) {
  const submitted = (data.value?.records || []).find((item) =>
    String(item.class_id || '') === String(requirement.class_id) && item.document_name === requirement.required_document_name
  )
  if (!submitted) return 'Not submitted'
  return submitted.review_status === 'approved' ? 'Approved' : submitted.review_status === 'rejected' ? 'Needs resubmission' : 'Pending review'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [response, storageResponse] = await Promise.all([
      apiGet<DocumentsData>('/modules/documents'),
      apiGet<StorageStatus>('/storage/status')
    ])
    data.value = response.data
    storage.value = storageResponse.data
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
      class_id: classId.value,
      required_document_name: requirementName.value,
    })
    notice.value = response.message || 'Required document added.'
    classId.value = ''
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
        <div v-if="data?.can_review_documents" class="summary" :class="{ clear: !pendingCount }">
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
        <p class="storage-badge" :class="{ cloud: storage.enabled }">
          <span class="storage-dot" aria-hidden="true"></span>
          {{ storage.enabled ? `Cloud storage · ${storage.provider.toUpperCase()}` : 'Local storage' }}
        </p>

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
                  <template v-if="data?.can_review_documents && item.trainee_id && item.review_status === 'pending'">
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

    <section v-if="isTrainee" class="panel requirements-panel">
      <div class="section-heading">
        <div>
          <h2>My class requirements</h2>
          <p class="muted">These are the programs and classes you are enrolled in, with the documents you must submit.</p>
        </div>
      </div>
      <div v-if="data?.trainee_classes?.length" class="trainee-classes">
        <article v-for="item in data.trainee_classes" :key="item.class_id" class="trainee-class">
          <span class="eyebrow">Program</span>
          <strong>{{ item.program_name }}</strong>
          <span>{{ item.class_name }}</span>
        </article>
      </div>
      <p v-else class="empty">You are not assigned to a class yet.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Class</th><th>Required document</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="item in traineeRequirements" :key="item.requirement_id">
              <td>{{ item.class_name }}</td>
              <td>{{ item.required_document_name }}</td>
              <td><span class="status" :class="{ approved: requirementStatus(item) === 'Approved' }">{{ requirementStatus(item) }}</span></td>
            </tr>
            <tr v-if="!traineeRequirements.length"><td colspan="3" class="empty">No document requirements configured for your assigned classes.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="data?.can_manage_requirements" class="panel requirements-panel">
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
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  max-width: 1450px;
  margin: auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
}

/* ================= Banner ================= */
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
  background: linear-gradient(120deg, var(--navy) 0%, #1b4470 60%, var(--navy) 100%);
  overflow: hidden;
  animation: drop-in 0.6s var(--ease) both;
}

.page-heading::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, transparent 0 120px, rgb(255 255 255 / 4%) 120px 121px);
  pointer-events: none;
}

/* faint document sheets floating behind the heading */
.page-heading::after {
  content: '';
  position: absolute;
  top: -30px;
  right: 8%;
  width: 120px;
  height: 150px;
  border: 1px solid rgb(143 196 245 / 35%);
  border-radius: 10px;
  background:
    linear-gradient(rgb(143 196 245 / 35%), rgb(143 196 245 / 35%)) 16px 34px / 56px 3px no-repeat,
    linear-gradient(rgb(143 196 245 / 25%), rgb(143 196 245 / 25%)) 16px 52px / 82px 3px no-repeat,
    linear-gradient(rgb(143 196 245 / 25%), rgb(143 196 245 / 25%)) 16px 70px / 70px 3px no-repeat,
    rgb(255 255 255 / 5%);
  transform: rotate(12deg);
  animation: sheet-float 8s ease-in-out infinite;
  pointer-events: none;
}

.page-heading > * {
  position: relative;
  z-index: 1;
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

/* pending-review chip: gently pulses while documents are waiting */
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
  animation: pop-in 0.6s var(--spring) 0.2s both, attention 2.6s ease-in-out 1.4s infinite;
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
  animation: pop-in 0.6s var(--spring) 0.2s both;
}

.muted {
  color: var(--muted);
  font-size: 14px;
}

/* ================= Layout and panels ================= */
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
  transition: box-shadow 0.3s ease;
}

.panel:hover {
  box-shadow: 0 16px 34px -20px rgb(17 44 73 / 50%);
}

.upload-panel {
  position: sticky;
  top: 16px;
  border-top: 3px solid var(--blue);
  animation: slide-left 0.7s var(--ease) 0.15s both;
}

.list-panel {
  animation: slide-right 0.7s var(--ease) 0.25s both;
}

.layout.single .list-panel {
  animation-name: rise;
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

/* storage badge */
.storage-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: fit-content;
  margin: 12px 0 0;
  padding: 6px 10px;
  border: 1px solid #dfe7f1;
  border-radius: 999px;
  color: #64748b;
  background: #f5f7fa;
  font-size: 11px;
  font-weight: 700;
}

.storage-badge.cloud {
  border-color: #b7dfc7;
  color: #1d6b3b;
  background: #effaf2;
}

.storage-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
}

.storage-badge.cloud .storage-dot {
  background: #2f9e5b;
  animation: ping-green 2.2s ease-out infinite;
}

/* ================= Upload form ================= */
.upload-form {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.upload-form > * {
  animation: rise 0.55s var(--ease) both;
}

.upload-form > :nth-child(1) { animation-delay: 0.35s; }
.upload-form > :nth-child(2) { animation-delay: 0.42s; }
.upload-form > :nth-child(3) { animation-delay: 0.49s; }
.upload-form > :nth-child(4) { animation-delay: 0.56s; }
.upload-form > :nth-child(5) { animation-delay: 0.63s; }
.upload-form > :nth-child(n + 6) { animation-delay: 0.7s; }

.upload-form label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.upload-form label:has(input:focus, select:focus) {
  color: var(--blue);
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
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
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
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 20px -14px rgb(38 95 148 / 55%);
  transform: translateY(-1px);
}

/* file picker: a drop zone that invites a file */
.upload-form input[type='file'] {
  padding: 22px 12px;
  border: 2px dashed #b6c8de;
  border-radius: 12px;
  background:
    repeating-linear-gradient(135deg, rgb(143 196 245 / 0%) 0 12px, rgb(143 196 245 / 14%) 12px 24px),
    #f9fbfe;
  background-size: 34px 34px, auto;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  animation: rise 0.55s var(--ease) 0.56s both, zone-breathe 3s ease-in-out 1.4s infinite;
  transition: border-color 0.25s ease, background-color 0.25s ease, transform 0.3s var(--spring);
}

.upload-form input[type='file']:hover {
  border-color: var(--blue);
  background-color: #eef5fd;
  transform: scale(1.015);
  animation: rise 0.55s var(--ease) 0.56s both, stripes 1.2s linear infinite;
}

.upload-form input[type='file']:focus {
  transform: none;
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
  transition: background 0.2s ease, transform 0.2s var(--spring);
}

.upload-form input[type='file']::file-selector-button:hover {
  background: var(--blue-hover);
  transform: translateY(-1px);
}

/* ================= Buttons ================= */
.primary-button,
.secondary-button {
  position: relative;
  min-height: 44px;
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s var(--spring), box-shadow 0.25s ease;
}

.primary-button {
  background: linear-gradient(135deg, #2c6ba5 0%, var(--blue) 60%, #1f4f7d 100%);
  color: #fff;
  box-shadow: 0 12px 22px -14px rgb(38 95 148 / 85%);
}

/* light sweep across the button on hover */
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
  transform: translateY(-2px);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: scale(0.97);
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
.text-button:focus-visible,
.clear-filters:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

/* busy state: a progress stripe along the bottom edge */
.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.75;
  cursor: wait;
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

/* ================= Messages ================= */
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
  animation: shake 0.45s ease both;
}

.inline-success {
  border-left: 3px solid var(--ok);
  background: #e3f4ea;
  color: #1f6b41;
  animation: pop-in 0.5s var(--spring) both;
}

/* ================= Filters and cards ================= */
.count-badge {
  padding: 6px 12px;
  border-radius: 999px;
  background: #e0eefc;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  animation: pop-in 0.5s var(--spring) 0.5s both;
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

.document-filters label,
.requirement-form label {
  display: grid;
  gap: 5px;
  color: var(--navy);
  font-size: 12px;
  font-weight: 700;
}

.document-filters input,
.document-filters select,
.requirement-form input,
.requirement-form select {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--text);
  background: #fff;
  font: inherit;
  font-size: 13px;
  transition: border-color 0.2s ease, box-shadow 0.25s ease;
}

.document-filters input:focus,
.document-filters select:focus,
.requirement-form input:focus,
.requirement-form select:focus {
  outline: none;
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgb(38 95 148 / 16%);
}

.clear-filters {
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--blue);
  background: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s var(--spring);
}

.clear-filters:hover {
  background: var(--field);
  color: var(--navy-deep);
  transform: translateY(-1px);
}

.requirements-panel {
  margin-top: 20px;
  animation: rise 0.6s var(--ease) 0.4s both;
}

.trainee-classes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.trainee-class {
  display: grid;
  gap: 4px;
  padding: 14px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--sky);
  border-radius: 10px;
  background: #f8fafd;
  color: var(--muted);
  font-size: 13px;
  animation: rise 0.5s var(--ease) both;
  transition: transform 0.3s var(--spring), box-shadow 0.3s ease, border-left-color 0.25s ease;
}

.trainee-class:nth-child(1) { animation-delay: 0.5s; }
.trainee-class:nth-child(2) { animation-delay: 0.58s; }
.trainee-class:nth-child(3) { animation-delay: 0.66s; }
.trainee-class:nth-child(n + 4) { animation-delay: 0.74s; }

.trainee-class:hover {
  border-left-color: var(--blue);
  box-shadow: 0 14px 24px -18px rgb(17 44 73 / 55%);
  transform: translateY(-3px);
}

.trainee-class strong {
  color: var(--navy);
  font-size: 15px;
}

.requirement-form {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1.5fr) auto;
  gap: 12px;
  align-items: end;
  margin-top: 18px;
}

.loading {
  padding: 24px 0;
  text-align: center;
  animation: breathe 1.4s ease-in-out infinite;
}

/* ================= Documents table: rows lay out like papers ================= */
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

tbody tr {
  animation: paper-in 0.55s var(--ease) both;
  transition: background 0.2s ease, box-shadow 0.25s ease;
}

tbody tr:nth-child(1) { animation-delay: 0.45s; }
tbody tr:nth-child(2) { animation-delay: 0.52s; }
tbody tr:nth-child(3) { animation-delay: 0.59s; }
tbody tr:nth-child(4) { animation-delay: 0.66s; }
tbody tr:nth-child(5) { animation-delay: 0.73s; }
tbody tr:nth-child(6) { animation-delay: 0.8s; }
tbody tr:nth-child(n + 7) { animation-delay: 0.87s; }

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f6f9fd;
  box-shadow: inset 3px 0 0 var(--sky);
}

.doc-name {
  color: var(--navy-deep);
  font-weight: 600;
  transition: color 0.2s ease;
}

tbody tr:hover .doc-name {
  color: var(--blue);
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
  animation: pop-in 0.5s var(--spring) both;
}

.status.approved {
  background: #e3f4ea;
  color: #1f6b41;
}

.status.rejected {
  background: #fdeceb;
  color: var(--danger);
}

/* pending items get a soft breathing glow so they stand out */
.status:not(.approved):not(.rejected):not(.none) {
  animation: pop-in 0.5s var(--spring) both, glow-amber 2.8s ease-in-out 1.2s infinite;
}

.status.none {
  padding: 4px 0;
  background: none;
  color: var(--muted);
  animation: none;
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
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s var(--spring);
}

.text-button:hover:not(:disabled) {
  background: var(--field);
  color: var(--navy-deep);
  transform: translateY(-1px);
}

.text-button:active:not(:disabled) {
  transform: scale(0.94);
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

.reject,
.delete-button {
  color: var(--danger);
}

.reject:hover:not(:disabled),
.delete-button:hover:not(:disabled) {
  background: #fdeceb;
  color: #a52e2e;
}

.empty {
  padding: 32px;
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

@keyframes pop-in {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

/* each row settles into place like a sheet of paper */
@keyframes paper-in {
  from {
    opacity: 0;
    transform: translateY(12px) rotate(-0.4deg);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes sheet-float {
  0%,
  100% {
    transform: rotate(12deg) translateY(0);
  }
  50% {
    transform: rotate(9deg) translateY(10px);
  }
}

@keyframes attention {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(242 190 60 / 0%);
  }
  50% {
    box-shadow: 0 0 0 7px rgb(242 190 60 / 20%);
  }
}

@keyframes zone-breathe {
  0%,
  100% {
    border-color: #b6c8de;
  }
  50% {
    border-color: var(--sky);
  }
}

@keyframes stripes {
  from {
    background-position: 0 0, 0 0;
  }
  to {
    background-position: 34px 0, 0 0;
  }
}

@keyframes glow-amber {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(201 138 0 / 0%);
  }
  50% {
    box-shadow: 0 0 0 5px rgb(201 138 0 / 16%);
  }
}

@keyframes ping-green {
  0% {
    box-shadow: 0 0 0 0 rgb(47 158 91 / 55%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 8px rgb(47 158 91 / 0%);
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

/* ================= Responsive ================= */
@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .upload-panel {
    position: static;
  }

  .list-panel {
    animation-name: rise;
  }

  .document-filters,
  .requirement-form {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 560px) {
  .document-filters,
  .requirement-form {
    grid-template-columns: 1fr;
  }

  .page-heading {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px 20px;
  }

  .page-heading::after {
    display: none;
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

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page-heading,
  .page-heading::after,
  .summary,
  .upload-panel,
  .list-panel,
  .storage-badge.cloud .storage-dot,
  .upload-form > *,
  .upload-form input[type='file'],
  .upload-form input[type='file']:hover,
  .primary-button:disabled::after,
  .inline-error,
  .inline-success,
  .count-badge,
  .requirements-panel,
  .trainee-class,
  .loading,
  tbody tr,
  .status {
    animation: none;
  }

  .panel,
  .upload-form input,
  .upload-form select,
  .upload-form label,
  .primary-button,
  .primary-button::before,
  .secondary-button,
  .clear-filters,
  .trainee-class,
  .text-button,
  tbody tr {
    transition: none;
  }
}
</style>