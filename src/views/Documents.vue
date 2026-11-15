<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFileUrl, apiGet, apiPost, apiRequest, downloadFile, getSession } from '../services/api'

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

async function openProtectedFile(path: string, fileName: string, openInNewTab = false) {
  try {
    await downloadFile(path, { filename: fileName, openInNewTab })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to open the requested file.'
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
    const response = await apiRequest(`/documents/${item.document_id}`, { method: 'DELETE' })
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
    const response = await apiRequest(`/certificate-requirements/${item.requirement_id}`, { method: 'DELETE' })
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
                  <button type="button" class="text-button" @click="openProtectedFile(`/documents/${item.document_id}`, `document-${item.document_id}.pdf`, true)">Download</button>
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
/* Registered so the angle can be animated (orbit light, focus borders) */
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.page {
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
  /* used below but never defined in the original */
  --text: #16263a;
  --blue-hover: #1f4f7d;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  --chev: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d6f82' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");

  display: grid;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
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
  padding: 30px 32px;
  border-radius: 20px;
  color: #fff;
  overflow: hidden;
  isolation: isolate;
  background:
    var(--grain),
    radial-gradient(40% 90% at 6% 0%, rgb(143 196 245 / 34%), transparent 70%),
    radial-gradient(30% 80% at 60% 120%, rgb(232 201 138 / 14%), transparent 70%),
    radial-gradient(45% 100% at 100% 60%, rgb(42 106 168 / 65%), transparent 72%),
    linear-gradient(120deg, #1d4a79 0%, var(--navy) 40%, var(--navy-deep) 100%);
  background-size: 180px 180px, auto, auto, auto, auto;
  background-blend-mode: soft-light, normal, normal, normal, normal;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%), 0 28px 44px -30px rgb(8 23 39 / 85%);
  animation: drop-in 0.7s var(--ease) both;
}

/* concentric rings with a slowly rotating light, same motif as the other pages */
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
    conic-gradient(from var(--angle), transparent 0deg, rgb(143 196 245 / 26%) 40deg, transparent 90deg, transparent 210deg, rgb(232 201 138 / 16%) 250deg, transparent 300deg);
  -webkit-mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  animation: orbit 42s linear infinite;
  pointer-events: none;
}

/* faint document sheet floating behind the heading (kept: it fits a documents page) */
.page-heading::after {
  content: '';
  position: absolute;
  top: -30px;
  right: 8%;
  z-index: -1;
  width: 120px;
  height: 150px;
  border: 1px solid rgb(143 196 245 / 35%);
  border-radius: 12px;
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
  font-size: clamp(1.9rem, 3vw, 2.5rem);
  font-weight: 500;
  font-variation-settings: 'opsz' 120, 'SOFT' 50;
  letter-spacing: -0.025em;
  line-height: 1.05;
}

.page-heading .muted {
  margin: 8px 0 0;
  color: rgb(255 255 255 / 78%);
  font-size: 15px;
}

.eyebrow {
  display: inline-block;
  margin: 0 0 12px;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgb(143 196 245 / 12%);
  box-shadow: inset 0 0 0 1px rgb(143 196 245 / 35%);
  color: var(--sky);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
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
  padding: 9px 18px;
  border-radius: 14px;
  background: rgb(242 190 60 / 16%);
  box-shadow: inset 0 0 0 1px rgb(242 190 60 / 50%);
  backdrop-filter: blur(10px);
  color: #ffe3a1;
  font-size: 13px;
  animation: pop-in 0.6s var(--spring) 0.2s both, attention 2.6s ease-in-out 1.4s infinite;
}

.summary strong {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 28px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.summary.clear {
  background: rgb(255 255 255 / 10%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 24%);
  color: rgb(255 255 255 / 80%);
  animation: pop-in 0.6s var(--spring) 0.2s both;
}

.muted {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
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
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #fcfdff);
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 14px 30px -22px rgb(17 44 73 / 40%);
  transition: box-shadow 0.35s ease, border-color 0.35s ease;
}

.panel:hover {
  border-color: #d3deec;
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 24px 40px -24px rgb(17 44 73 / 48%);
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
  font-size: 22px;
  font-weight: 600;
  font-variation-settings: 'opsz' 48, 'SOFT' 40;
  letter-spacing: -0.015em;
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
  padding: 6px 12px;
  border-radius: 999px;
  background: #f5f7fa;
  box-shadow: inset 0 0 0 1px #dfe7f1;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
}

.storage-badge.cloud {
  background: #effaf2;
  box-shadow: inset 0 0 0 1px #b7dfc7;
  color: #1d6b3b;
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
  font-weight: 650;
  letter-spacing: 0.01em;
  transition: color 0.2s ease;
}

.upload-form label:has(input:focus, select:focus) {
  color: var(--blue);
}

/* 1px border is a second background layer, so a light can travel around it on focus */
.upload-form input:not([type='file']),
.upload-form select {
  min-width: 0;
  width: 100%;
  min-height: 46px;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  color: var(--text);
  font: inherit;
  transition: box-shadow 0.3s ease, transform 0.3s var(--ease);
}

.upload-form select {
  appearance: none;
  padding-right: 38px;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  cursor: pointer;
}

.upload-form input:not([type='file']):hover:not(:focus) {
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

.upload-form select:hover:not(:focus) {
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

.upload-form input:not([type='file']):focus {
  outline: none;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

.upload-form select:focus {
  outline: none;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

/* file picker: a drop zone that invites a file */
.upload-form input[type='file'] {
  min-width: 0;
  width: 100%;
  padding: 24px 12px;
  border: 2px dashed #b6c8de;
  border-radius: 16px;
  background:
    repeating-linear-gradient(135deg, rgb(143 196 245 / 0%) 0 12px, rgb(143 196 245 / 14%) 12px 24px),
    #f9fbfe;
  background-size: 34px 34px, auto;
  color: var(--muted);
  font: inherit;
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
  outline: 3px solid var(--sky);
  outline-offset: 2px;
  transform: none;
}

.upload-form input[type='file']::file-selector-button {
  margin-right: 12px;
  padding: 8px 14px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #2f74b3, var(--blue));
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
  min-height: 46px;
  padding: 10px 20px;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  isolation: isolate;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.25s var(--ease), box-shadow 0.3s ease;
}

.primary-button {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 16%), rgb(255 255 255 / 0%) 55%),
    linear-gradient(135deg, #2f74b3 0%, var(--blue) 50%, #1c4a78 100%);
  color: #fff;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 30%), inset 0 -1px 0 rgb(0 0 0 / 18%), 0 14px 24px -14px rgb(38 95 148 / 90%);
}

/* light sweep across the button on hover */
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
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 34%), inset 0 -1px 0 rgb(0 0 0 / 18%), 0 22px 30px -16px rgb(38 95 148 / 95%);
}

.primary-button:hover:not(:disabled)::before {
  left: 130%;
}

.secondary-button {
  background: #e6eef8;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 14%);
  color: var(--navy-deep);
}

.secondary-button:hover:not(:disabled) {
  background: #d9e6f5;
  transform: translateY(-2px);
}

.page-heading .secondary-button {
  background: rgb(255 255 255 / 10%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 24%);
  backdrop-filter: blur(10px);
  color: #fff;
}

.page-heading .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 20%);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
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
  background: linear-gradient(90deg, transparent, var(--ice), transparent);
  background-size: 50% 100%;
  background-repeat: no-repeat;
  animation: load 1.1s ease-in-out infinite;
}

/* ================= Messages ================= */
.inline-error,
.inline-success {
  margin: 16px 0 0;
  padding: 13px 16px;
  border-radius: 12px;
}

.inline-error {
  border-left: 3px solid var(--danger);
  background: linear-gradient(90deg, #fdeceb, #fff6f5);
  color: var(--danger);
  animation: shake 0.45s ease both;
}

.inline-success {
  border-left: 3px solid var(--ok);
  background: linear-gradient(90deg, #e8f7ee, #f4fbf6);
  color: #1f6b41;
  animation: pop-in 0.5s var(--spring) both;
}

/* ================= Filters and cards ================= */
.count-badge {
  padding: 6px 13px;
  border-radius: 999px;
  background: #e0eefc;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 18%);
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
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fafd, #f4f8fc);
  box-shadow: inset 0 0 0 1px var(--line);
}

.document-filters label,
.requirement-form label {
  display: grid;
  gap: 5px;
  color: var(--navy);
  font-size: 12px;
  font-weight: 700;
  transition: color 0.2s ease;
}

.document-filters label:has(input:focus, select:focus),
.requirement-form label:has(input:focus, select:focus) {
  color: var(--blue);
}

.document-filters input,
.document-filters select,
.requirement-form input,
.requirement-form select {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  transition: box-shadow 0.3s ease;
}

.document-filters select,
.requirement-form select {
  appearance: none;
  padding-right: 34px;
  background:
    var(--chev) calc(100% - 10px) 50% / 15px 15px no-repeat padding-box,
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  cursor: pointer;
}

.document-filters input:focus,
.requirement-form input:focus {
  outline: none;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 3px rgb(42 106 168 / 14%);
  animation: spin-angle 3.5s linear infinite;
}

.document-filters select:focus,
.requirement-form select:focus {
  outline: none;
  background:
    var(--chev) calc(100% - 10px) 50% / 15px 15px no-repeat padding-box,
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 3px rgb(42 106 168 / 14%);
  animation: spin-angle 3.5s linear infinite;
}

.clear-filters {
  min-height: 40px;
  padding: 8px 14px;
  border: 0;
  border-radius: 10px;
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--blue);
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
  padding: 15px 16px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--sky);
  border-radius: 14px;
  background:
    radial-gradient(100% 80% at 100% 0%, rgb(143 196 245 / 12%), transparent 65%),
    #f9fbfe;
  color: var(--muted);
  font-size: 13px;
  animation: rise 0.5s var(--ease) both;
  transition: transform 0.35s var(--ease), box-shadow 0.35s ease, border-left-color 0.25s ease;
}

.trainee-class:nth-child(1) { animation-delay: 0.5s; }
.trainee-class:nth-child(2) { animation-delay: 0.58s; }
.trainee-class:nth-child(3) { animation-delay: 0.66s; }
.trainee-class:nth-child(n + 4) { animation-delay: 0.74s; }

.trainee-class:hover {
  border-left-color: var(--blue);
  box-shadow: 0 18px 28px -20px rgb(17 44 73 / 55%);
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
  border-radius: 14px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
}

th {
  background: linear-gradient(180deg, #f3f7fd, var(--field));
  color: var(--navy);
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
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
  background: #f4f8fe;
  box-shadow: inset 3px 0 0 var(--blue);
}

.doc-name {
  color: var(--navy-deep);
  font-weight: 650;
  transition: color 0.2s ease;
}

tbody tr:hover .doc-name {
  color: var(--blue);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px 4px 10px;
  border-radius: 999px;
  background: #fbf0d3;
  box-shadow: inset 0 0 0 1px rgb(201 138 0 / 26%);
  color: #8a5d00;
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
  animation: pop-in 0.5s var(--spring) both;
}

.status::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.status.approved {
  background: #e3f4ea;
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 22%);
  color: #1f6b41;
}

.status.rejected {
  background: #fdeceb;
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 20%);
  color: var(--danger);
}

/* pending items get a soft breathing glow so they stand out */
.status:not(.approved):not(.rejected):not(.none) {
  animation: pop-in 0.5s var(--spring) both, glow-amber 2.8s ease-in-out 1.2s infinite;
}

.status.none {
  padding: 4px 0;
  background: none;
  box-shadow: none;
  color: var(--muted);
  animation: none;
}

.status.none::before {
  display: none;
}

.access {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 8px;
  background: var(--field);
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 12%);
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
  padding: 6px 10px;
  border: 0;
  border-radius: 9px;
  background: none;
  color: var(--blue);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
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
  padding: 36px;
  text-align: center;
  color: var(--muted);
}

/* ================= Keyframes ================= */
@keyframes drop-in { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
@keyframes rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes slide-left { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: none; } }
@keyframes slide-right { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }
@keyframes pop-in { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: none; } }
/* each row settles into place like a sheet of paper */
@keyframes paper-in { from { opacity: 0; transform: translateY(12px) rotate(-0.4deg); } to { opacity: 1; transform: none; } }
@keyframes orbit { to { --angle: 360deg; } }
@keyframes spin-angle { to { --angle: 360deg; } }
@keyframes sheet-float { 0%, 100% { transform: rotate(12deg) translateY(0); } 50% { transform: rotate(9deg) translateY(10px); } }
@keyframes attention { 0%, 100% { box-shadow: inset 0 0 0 1px rgb(242 190 60 / 50%), 0 0 0 0 rgb(242 190 60 / 0%); } 50% { box-shadow: inset 0 0 0 1px rgb(242 190 60 / 50%), 0 0 0 7px rgb(242 190 60 / 20%); } }
@keyframes zone-breathe { 0%, 100% { border-color: #b6c8de; } 50% { border-color: var(--sky); } }
@keyframes stripes { from { background-position: 0 0, 0 0; } to { background-position: 34px 0, 0 0; } }
@keyframes glow-amber { 0%, 100% { box-shadow: inset 0 0 0 1px rgb(201 138 0 / 26%), 0 0 0 0 rgb(201 138 0 / 0%); } 50% { box-shadow: inset 0 0 0 1px rgb(201 138 0 / 26%), 0 0 0 5px rgb(201 138 0 / 16%); } }
@keyframes ping-green { 0% { box-shadow: 0 0 0 0 rgb(47 158 91 / 55%); } 70%, 100% { box-shadow: 0 0 0 8px rgb(47 158 91 / 0%); } }
@keyframes load { from { background-position: -50% 0; } to { background-position: 150% 0; } }
@keyframes breathe { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@keyframes shake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-4px); } 40%, 60% { transform: translateX(4px); } }

/* ================= Responsive ================= */
@media (max-width: 1000px) {
  .layout { grid-template-columns: 1fr; }
  .upload-panel { position: static; }
  .list-panel { animation-name: rise; }
  .document-filters,
  .requirement-form { grid-template-columns: 1fr 1fr; }
  .page-heading::before { right: -30%; }
}

@media (max-width: 560px) {
  .document-filters,
  .requirement-form { grid-template-columns: 1fr; }
  .page-heading { flex-direction: column; align-items: flex-start; padding: 24px 20px; border-radius: 18px; }
  .page-heading::before { right: -60%; width: 420px; }
  .page-heading::after { display: none; }
  .page-heading h1 { font-size: 26px; }
  .heading-actions { width: 100%; justify-content: space-between; }
  .panel { padding: 18px; }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page *,
  .page *::before,
  .page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>