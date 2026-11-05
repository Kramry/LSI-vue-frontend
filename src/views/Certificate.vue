<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { apiFileUrl, apiGet, apiPost, getSession } from '../services/api'

type Row = Record<string, string | number | boolean | null | undefined>
interface Template {
  template_id?: number
  version?: number
  mode: string
  file_path?: string | null
  field_layout?: Record<string, { x: number; y: number; font_size: number; align: string }>
  settings: Record<string, string>
}
interface CertificateData {
  records?: Row[]
  eligibility?: Row[]
  certificates?: Row[]
  certificate_stats?: Record<string, number>
  signatories?: Row[]
  signatory_accounts?: Array<{ id: number; label: string }>
  certificate_template?: Template
  certificate_template_versions?: Row[]
  configs?: Record<string, string | number>
}
interface VerificationData {
  certificate: { certificate_number: string; trainee_name: string; program_name: string; class_name: string; issue_date: string; status: string }
  signatories: Array<{ name: string; position: string; signed_at: string; hash_valid: boolean }>
  integrity_valid: boolean
}

const props = defineProps<{ mode?: 'signing' | 'settings' }>()
const mode = computed(() => props.mode || (window.location.pathname === '/certificates/signing' ? 'signing' : window.location.pathname === '/certificate-settings' ? 'settings' : 'records'))
const role = ref('')
const data = ref<CertificateData>({})
const certificates = ref<Row[]>([])
const selected = ref<Row | null>(null)
const verifiedRecord = ref<VerificationData | null>(null)
const busy = ref(false)
const loading = ref(true)
const error = ref('')
const notice = ref('')
const filter = ref('')
const reviewForms = reactive<Record<string, { reason: string }>>({})
const password = ref('')
const rejectionRemarks = ref('')
const signingData = ref<CertificateData>({})
const settingData = ref<CertificateData>({})
const signatureCanvas = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
const signatureDirty = ref(false)
const signatureFile = ref<File | null>(null)
const signatoryId = ref('')
const signatoryForm = ref({ user_id: '', name: '', position: '', x_position: '50', y_position: '85' })
const templateForm = reactive({
  mode: 'generated', save_action: 'activate', source_template_id: '',
  min_attendance_percentage: '75', require_documents: true, require_assessments: false, required_assessment_count: '1',
  institution_name: 'LSI Training Center', title_text: 'Certificate of Completion',
  body_text: 'This is to certify that {trainee_name} has successfully completed {program_name} on {date_completed}.',
  signatory_name: '', signatory_title: '', border_style: 'double', accent_color: '#1d563c', font: 'helvetica'
})
const templateFile = ref<File | null>(null)
const logoFile = ref<File | null>(null)
const layoutFields = ['trainee_name', 'program_name', 'date_completed', 'certificate_number', 'signatory_name', 'verification_code'] as const
type LayoutField = typeof layoutFields[number]
const layoutLabels: Record<LayoutField, string> = {
  trainee_name: 'Trainee name', program_name: 'Program name', date_completed: 'Completion date',
  certificate_number: 'Certificate number', signatory_name: 'Signatory name', verification_code: 'Verification code'
}
const blankLayout = () => ({ x: '50', y: '50', font_size: '16', align: 'center' })
const fieldLayout = reactive<Record<LayoutField, { x: string; y: string; font_size: string; align: string }>>({
  trainee_name: blankLayout(),
  program_name: blankLayout(),
  date_completed: blankLayout(),
  certificate_number: blankLayout(),
  signatory_name: blankLayout(),
  verification_code: blankLayout()
})
const isAdmin = computed(() => role.value === 'administrator')
const isStaff = computed(() => ['administrator', 'staff'].includes(role.value))
const isTrainee = computed(() => role.value === 'trainee')
const filteredCertificates = computed(() => {
  const search = filter.value.trim().toLowerCase()
  return certificates.value.filter((row) => !search || [row.trainee_name, row.program_name, row.class_name, row.certificate_number, row.status].some((value) => String(value || '').toLowerCase().includes(search)))
})

function money(value: unknown) {
  return String(value ?? '')
}

function safeError(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback
}

async function loadRecords() {
  loading.value = true
  error.value = ''
  try {
    const section = isTrainee.value ? 'my_certificates' : 'certificates'
    const response = await apiGet<CertificateData>(`/modules/${section}`)
    data.value = response.data
    certificates.value = response.data.records || []
  } catch (reason) {
    error.value = safeError(reason, 'Unable to load certificate records.')
  } finally {
    loading.value = false
  }
}

async function loadSigningQueue() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiGet<CertificateData>('/certificates/to-sign')
    signingData.value = response.data
    certificates.value = response.data.certificates || []
  } catch (reason) {
    error.value = safeError(reason, 'Unable to load the signing queue.')
  } finally {
    loading.value = false
  }
}

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiGet<CertificateData>('/modules/certificate_config')
    settingData.value = response.data
    const config = response.data.configs || {}
    const template = response.data.certificate_template
    templateForm.min_attendance_percentage = String(config.min_attendance_percentage ?? 75)
    templateForm.require_documents = String(config.require_documents ?? '1') === '1'
    templateForm.require_assessments = String(config.require_assessments ?? '0') === '1'
    templateForm.required_assessment_count = String(config.required_assessment_count ?? 1)
    if (template) {
      templateForm.mode = template.mode || 'generated'
      templateForm.source_template_id = String(template.template_id || '')
      Object.assign(templateForm, template.settings || {})
      templateForm.border_style = template.settings?.border_style || 'double'
      templateForm.accent_color = template.settings?.accent_color || '#1d563c'
      templateForm.font = template.settings?.font || 'helvetica'
      const currentLayout = template.field_layout || {}
      layoutFields.forEach((field, index) => {
        const layout = currentLayout[field] || { x: 50, y: 30 + index * 10, font_size: 16, align: 'center' }
        fieldLayout[field] = { x: String(layout.x), y: String(layout.y), font_size: String(layout.font_size), align: layout.align || 'center' }
      })
    } else {
      layoutFields.forEach((field, index) => { fieldLayout[field] = { x: '50', y: String(30 + index * 10), font_size: '16', align: 'center' } })
    }
  } catch (reason) {
    error.value = safeError(reason, 'Unable to load certificate settings.')
  } finally {
    loading.value = false
  }
}

async function reload() {
  if (mode.value === 'signing') return loadSigningQueue()
  if (mode.value === 'settings') return loadSettings()
  return loadRecords()
}

function reviewForm(id: unknown) {
  const key = String(id)
  if (!reviewForms[key]) reviewForms[key] = { reason: '' }
  return reviewForms[key]
}

async function postAction(path: string, body: unknown, success: string) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost(path, body)
    notice.value = response.message || success
    await reload()
    return response.data
  } catch (reason) {
    error.value = safeError(reason, 'The certificate action could not be completed.')
    return null
  } finally {
    busy.value = false
  }
}

async function reviewEligibility(row: Row, decision: 'approved' | 'rejected') {
  const form = reviewForm(row.eligibility_id)
  if (decision === 'rejected' && !form.reason.trim()) {
    error.value = 'Enter a reason before rejecting eligibility.'
    return
  }
  await postAction('/certificates/review', { eligibility_id: row.eligibility_id, decision, reason: form.reason }, `Eligibility ${decision}.`)
}

async function recalculate(row: Row) {
  await postAction('/certificates/recalculate', { trainee_id: row.trainee_id, class_id: row.class_id }, 'Eligibility recalculated.')
}

async function issue(row: Row) {
  await postAction('/certificates/issue', { trainee_id: row.trainee_id, class_id: row.class_id }, 'Certificate queued for signature.')
}

async function resubmitCertificate(row: Row) {
  await postAction(`/certificates/${row.certificate_id}/resubmit`, {}, 'Certificate resubmitted for signature.')
}

async function revoke(row: Row) {
  const reason = window.prompt(`Reason for revoking certificate ${row.certificate_number}:`)
  if (!reason?.trim()) return
  await postAction('/certificates/revoke', { certificate_id: row.certificate_id, reason }, 'Certificate revoked.')
}

async function verifyCertificate(row: Row) {
  error.value = ''
  try {
    const query = new URLSearchParams({ certificate_number: String(row.certificate_number || '') })
    const response = await apiGet<VerificationData>(`/verify-certificate?${query}`)
    verifiedRecord.value = response.data
  } catch (reason) {
    error.value = safeError(reason, 'Unable to verify this certificate.')
  }
}

async function openSigning(row: Row) {
  error.value = ''
  selected.value = row
}

async function signCertificate() {
  if (!selected.value || !password.value) {
    error.value = 'Re-enter your password to apply your signature.'
    return
  }
  await postAction(`/certificates/${selected.value.certificate_id}/sign`, { password: password.value }, 'Signature recorded.')
  selected.value = null
  password.value = ''
}

async function rejectSignature() {
  if (!selected.value || !rejectionRemarks.value.trim()) {
    error.value = 'Enter remarks before returning the certificate.'
    return
  }
  await postAction(`/certificates/${selected.value.certificate_id}/reject-signature`, { remarks: rejectionRemarks.value }, 'Certificate returned to staff.')
  selected.value = null
  rejectionRemarks.value = ''
}

function editSignatory(item: Row) {
  signatoryId.value = String(item.signatory_id)
  signatoryForm.value = {
    user_id: String(item.user_id), name: String(item.name || ''),
    position: String(item.position || ''), x_position: String(item.x_position ?? 50), y_position: String(item.y_position ?? 85)
  }
  signatureDirty.value = false
  signatureFile.value = null
  notice.value = ''
}

function resetSignatory() {
  signatoryId.value = ''
  signatoryForm.value = { user_id: '', name: '', position: '', x_position: '50', y_position: '85' }
  signatureDirty.value = false
  signatureFile.value = null
  clearCanvas()
}

function canvasPoint(event: PointerEvent) {
  const canvas = signatureCanvas.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY }
}

function startDrawing(event: PointerEvent) {
  const point = canvasPoint(event)
  const canvas = signatureCanvas.value
  if (!point || !canvas) return
  canvas.setPointerCapture(event.pointerId)
  const context = canvas.getContext('2d')
  if (!context) return
  context.beginPath()
  context.moveTo(point.x, point.y)
  context.lineWidth = 3
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#111827'
  isDrawing.value = true
  signatureDirty.value = true
  signatureFile.value = null
}

function draw(event: PointerEvent) {
  if (!isDrawing.value) return
  const point = canvasPoint(event)
  const context = signatureCanvas.value?.getContext('2d')
  if (!point || !context) return
  context.lineTo(point.x, point.y)
  context.stroke()
}

function stopDrawing() {
  isDrawing.value = false
}

function clearCanvas() {
  const context = signatureCanvas.value?.getContext('2d')
  if (context && signatureCanvas.value) context.clearRect(0, 0, signatureCanvas.value.width, signatureCanvas.value.height)
  signatureDirty.value = false
}

function onSignatureFile(event: Event) {
  signatureFile.value = (event.target as HTMLInputElement).files?.[0] || null
  if (signatureFile.value) {
    signatureDirty.value = false
    clearCanvas()
  }
}

async function saveSignatory() {
  const form = new FormData()
  form.append('signatory_id', signatoryId.value)
  Object.entries(signatoryForm.value).forEach(([key, value]) => form.append(key, value))
  if (signatureFile.value) form.append('signature_image', signatureFile.value)
  if (signatureDirty.value && signatureCanvas.value) form.append('signature_data', signatureCanvas.value.toDataURL('image/png'))
  await postAction('/certificate-signatories/save', form, 'Signatory saved.')
  resetSignatory()
}

async function deactivateSignatory(item: Row) {
  if (!window.confirm(`Deactivate ${item.name} as a certificate signatory?`)) return
  await postAction(`/certificate-signatories/${item.signatory_id}/delete`, {}, 'Signatory deactivated.')
}

function onTemplateFile(event: Event) {
  templateFile.value = (event.target as HTMLInputElement).files?.[0] || null
}
function onLogoFile(event: Event) {
  logoFile.value = (event.target as HTMLInputElement).files?.[0] || null
}

async function saveTemplate() {
  const form = new FormData()
  Object.entries(templateForm).forEach(([key, value]) => {
    if (typeof value !== 'boolean' || value) form.append(key, String(value))
  })
  form.append('field_layout_present', '1')
  layoutFields.forEach((field) => {
    Object.entries(fieldLayout[field]).forEach(([key, value]) => form.append(`field_layout[${field}][${key}]`, value))
  })
  if (templateFile.value) form.append('template_file', templateFile.value)
  if (logoFile.value) form.append('logo', logoFile.value)
  const result = await postAction('/certificate-config', form, 'Certificate settings saved.')
  if (result === null) return
  templateFile.value = null
  logoFile.value = null
}

async function activateTemplate(id: unknown) {
  await postAction(`/certificate-templates/${id}/activate`, {}, 'Certificate template activated.')
}

onMounted(async () => {
  try {
    const session = await getSession()
    role.value = session.user?.role || ''
  } catch (reason) {
    error.value = safeError(reason, 'Unable to load your account.')
  }
  await reload()
})
</script>

<template>
  <div class="page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">SMARTTRACK / CERTIFICATES</p>
        <h1>{{ mode === 'signing' ? 'Certificates to sign' : mode === 'settings' ? 'Certificate settings' : isTrainee ? 'My certificates' : 'Certificate eligibility' }}</h1>
        <p class="muted">{{ mode === 'signing' ? 'Review the certificate PDF before signing or returning it to staff.' : mode === 'settings' ? 'Configure eligibility, certificate templates, document requirements, and signatories.' : isTrainee ? 'Track eligibility and download issued certificates.' : 'Review eligibility and track certificates through signing and issuance.' }}</p>
      </div>
      <button class="secondary-button" :disabled="loading" @click="reload">Refresh</button>
    </header>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="inline-success" role="status">{{ notice }}</p>
    <p v-if="loading" class="muted">Loading certificate data…</p>

    <template v-if="!loading && mode === 'signing'">
      <section v-if="selected" class="panel signing-panel">
        <div class="section-heading"><div><h2>{{ selected.certificate_number }}</h2><p class="muted">{{ selected.trainee_name }} · {{ selected.program_name }} · {{ selected.class_name }}</p></div><button class="secondary-button" @click="selected = null">Back to queue</button></div>
        <iframe class="preview" :src="apiFileUrl(`/certificates/${selected.certificate_id}/sign-preview`)" title="Certificate signing preview"></iframe>
        <form class="sign-actions" @submit.prevent="signCertificate">
          <label>Password confirmation<input v-model="password" type="password" autocomplete="current-password" required></label>
          <button class="primary-button" :disabled="busy">{{ busy ? 'Signing…' : 'Sign certificate' }}</button>
        </form>
        <form class="reject-form" @submit.prevent="rejectSignature">
          <label>Return to staff with remarks<textarea v-model.trim="rejectionRemarks" maxlength="1000" rows="2" required></textarea></label>
          <button class="danger-button" :disabled="busy">Reject / return</button>
        </form>
      </section>
      <section v-else class="panel">
        <h2>Assigned certificates</h2>
        <div class="table-wrap"><table><thead><tr><th>Certificate</th><th>Trainee</th><th>Program / class</th><th>Completed</th><th>Action</th></tr></thead>
          <tbody><tr v-for="item in certificates" :key="String(item.certificate_id)"><td>{{ item.certificate_number }}</td><td>{{ item.trainee_name }}</td><td>{{ item.program_name }} / {{ item.class_name }}</td><td>{{ item.completion_date }}</td><td><button class="text-button" @click="openSigning(item)">Review PDF & sign</button></td></tr><tr v-if="!certificates.length"><td colspan="5" class="empty">No certificates currently assigned to you.</td></tr></tbody>
        </table></div>
      </section>
    </template>

    <template v-else-if="!loading && mode === 'settings' && isAdmin">
      <section class="panel">
        <h2>Eligibility requirements</h2>
        <form class="form-grid" @submit.prevent="saveTemplate">
          <label>Minimum attendance (%)<input v-model="templateForm.min_attendance_percentage" type="number" min="0" max="100" step="0.1" required></label>
          <label>Required assessment count<input v-model="templateForm.required_assessment_count" type="number" min="1" max="100" required></label>
          <label class="checkbox"><input v-model="templateForm.require_documents" type="checkbox"> Require approved documents</label>
          <label class="checkbox"><input v-model="templateForm.require_assessments" type="checkbox"> Require completed assessments</label>
        </form>
      </section>
      <section class="panel">
        <h2>Certificate template</h2>
        <p class="muted">Template files and logos are limited to 5 MB and stored privately. Placeholders: {trainee_name}, {program_name}, {date_completed}, {cert_no}, {signatory_name}, {signatory_title}, {verification_code}.</p>
        <form class="form-grid" @submit.prevent="saveTemplate">
          <label>Template mode<select v-model="templateForm.mode"><option value="generated">Generated design</option><option value="upload">Uploaded background</option></select></label>
          <label>Save as<select v-model="templateForm.save_action"><option value="activate">Activate immediately</option><option value="draft">Save draft version</option></select></label>
          <label>Institution name<input v-model.trim="templateForm.institution_name" maxlength="150" required></label>
          <label>Title text<input v-model.trim="templateForm.title_text" maxlength="150" required></label>
          <label class="wide">Certificate body<textarea v-model.trim="templateForm.body_text" maxlength="2000" rows="3" required></textarea></label>
          <label>Printed signatory name<input v-model.trim="templateForm.signatory_name" maxlength="150" required></label>
          <label>Printed signatory title<input v-model.trim="templateForm.signatory_title" maxlength="150" required></label>
          <label>Border<select v-model="templateForm.border_style"><option value="none">None</option><option value="single">Single</option><option value="double">Double</option></select></label>
          <label>Accent color<input v-model="templateForm.accent_color" type="color" required></label>
          <label>Font<select v-model="templateForm.font"><option value="helvetica">Helvetica</option><option value="times">Times</option><option value="courier">Courier</option></select></label>
          <label v-if="templateForm.mode === 'upload'">Background (PDF/PNG/JPG, max 5 MB)<input type="file" accept=".pdf,.png,.jpg,.jpeg" @change="onTemplateFile"></label>
          <label>Logo (PNG/JPG, max 5 MB)<input type="file" accept=".png,.jpg,.jpeg" @change="onLogoFile"></label>
          <template v-if="templateForm.mode === 'upload'">
            <p class="wide muted">Set field positions as percentages of the page, plus font size and alignment.</p>
            <div v-for="field in layoutFields" :key="field" class="layout-item">
              <strong>{{ layoutLabels[field] }}</strong><label>X %<input v-model="fieldLayout[field].x" type="number" min="0" max="100" step="0.1"></label>
              <label>Y %<input v-model="fieldLayout[field].y" type="number" min="0" max="100" step="0.1"></label>
              <label>Font size<input v-model="fieldLayout[field].font_size" type="number" min="6" max="72" step="0.5"></label>
              <label>Align<select v-model="fieldLayout[field].align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
            </div>
          </template>
          <button class="primary-button wide" :disabled="busy">{{ busy ? 'Saving…' : 'Save template and eligibility settings' }}</button>
        </form>
        <div class="table-wrap"><table><thead><tr><th>Version</th><th>Mode</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody><tr v-for="item in settingData.certificate_template_versions || []" :key="String(item.template_id)"><td>v{{ item.version }}</td><td>{{ item.mode }}</td><td>{{ Number(item.is_active) ? 'Active' : 'Draft' }}</td><td><button v-if="!Number(item.is_active)" class="text-button" @click="activateTemplate(item.template_id)">Create active version from this</button><a v-if="item.file_path" class="text-button" :href="apiFileUrl(`/certificate-templates/${item.template_id}/file`)" target="_blank" rel="noopener">Preview file</a></td></tr><tr v-if="!settingData.certificate_template_versions?.length"><td colspan="4" class="empty">No template versions.</td></tr></tbody>
        </table></div>
      </section>

      <section class="panel">
        <h2>{{ signatoryId ? 'Edit signatory' : 'Add signatory' }}</h2>
        <form class="form-grid" @submit.prevent="saveSignatory">
          <label>System account<select v-model="signatoryForm.user_id" required><option value="" disabled>Select administrator or staff</option><option v-for="account in settingData.signatory_accounts || []" :key="account.id" :value="String(account.id)">{{ account.label }}</option></select></label>
          <label>Printed name<input v-model.trim="signatoryForm.name" maxlength="150" required></label>
          <label>Position<input v-model.trim="signatoryForm.position" maxlength="150" required></label>
          <label>Signature X position (%)<input v-model="signatoryForm.x_position" type="number" min="0" max="100" step="0.1" required></label>
          <label>Signature Y position (%)<input v-model="signatoryForm.y_position" type="number" min="0" max="100" step="0.1" required></label>
          <label>Signature PNG (transparent, max 1 MB)<input type="file" accept="image/png,.png" @change="onSignatureFile"></label>
          <div class="wide">
            <p class="muted">Or draw a signature on the transparent pad.</p>
            <canvas ref="signatureCanvas" class="signature-pad" width="700" height="180" @pointerdown="startDrawing" @pointermove="draw" @pointerup="stopDrawing" @pointercancel="stopDrawing" @pointerleave="stopDrawing"></canvas>
            <button type="button" class="secondary-button" @click="clearCanvas">Clear signature pad</button>
          </div>
          <div class="actions wide"><button class="primary-button" :disabled="busy">{{ busy ? 'Saving…' : signatoryId ? 'Save signatory' : 'Add signatory' }}</button><button v-if="signatoryId" type="button" class="secondary-button" @click="resetSignatory">Cancel</button></div>
        </form>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Position</th><th>Account</th><th>Status</th><th>Position (%)</th><th>Actions</th></tr></thead>
          <tbody><tr v-for="item in settingData.signatories || []" :key="String(item.signatory_id)"><td>{{ item.name }}</td><td>{{ item.position }}</td><td>{{ item.account_name }}</td><td>{{ Number(item.is_active) ? 'Active' : 'Inactive' }}</td><td>{{ item.x_position }}, {{ item.y_position }}</td><td class="actions"><button class="text-button" @click="editSignatory(item)">Edit</button><button v-if="Number(item.is_active)" class="text-button danger" @click="deactivateSignatory(item)">Deactivate</button></td></tr><tr v-if="!settingData.signatories?.length"><td colspan="6" class="empty">No signatories configured.</td></tr></tbody>
        </table></div>
      </section>

    </template>

    <template v-else-if="!loading && mode === 'records' && isTrainee">
      <section class="panel">
        <h2>My certificate eligibility</h2><div class="table-wrap"><table><thead><tr><th>Program / class</th><th>Attendance</th><th>Documents</th><th>Assessments</th><th>Eligibility</th><th>Review status</th></tr></thead>
          <tbody><tr v-for="item in data.eligibility || []" :key="String(item.eligibility_id)"><td>{{ item.program_name }} / {{ item.class_name }}</td><td>{{ item.attendance_percentage }}%</td><td>{{ item.documents_approved }} / {{ item.documents_required }}</td><td>{{ item.assessments_completed }} / {{ item.assessments_required }}</td><td>{{ Number(item.is_eligible) ? 'Eligible' : 'Requirements incomplete' }}</td><td>{{ item.approval_status }}</td></tr><tr v-if="!data.eligibility?.length"><td colspan="6" class="empty">No eligibility records available.</td></tr></tbody>
        </table></div>
      </section>
      <section class="panel section"><h2>Issued certificates</h2><div class="table-wrap"><table><thead><tr><th>Certificate number</th><th>Program / class</th><th>Issue date</th><th>Status</th><th>Download</th></tr></thead>
        <tbody><tr v-for="item in certificates" :key="String(item.certificate_id)"><td>{{ item.certificate_number }}</td><td>{{ item.program_name }} / {{ item.class_name }}</td><td>{{ item.issue_date }}</td><td>{{ item.status }}</td><td><a v-if="item.status === 'issued'" :href="apiFileUrl(`/certificates/${item.certificate_id}/download`)" target="_blank" rel="noopener">Download PDF</a><button v-if="item.status === 'issued'" class="text-button" @click="verifyCertificate(item)">Verify</button><span v-if="item.status !== 'issued'">Available after signing</span></td></tr><tr v-if="!certificates.length"><td colspan="5" class="empty">No certificates issued yet.</td></tr></tbody>
      </table></div></section>
    </template>

    <template v-else-if="!loading && mode === 'records' && isStaff">
      <section class="stats-grid">
        <article class="stat"><span>Eligible</span><strong>{{ data.certificate_stats?.eligible || 0 }}</strong></article><article class="stat"><span>Awaiting approval</span><strong>{{ data.certificate_stats?.pending || 0 }}</strong></article><article class="stat"><span>Awaiting signatures</span><strong>{{ data.certificate_stats?.signing || 0 }}</strong></article><article class="stat"><span>Issued</span><strong>{{ data.certificate_stats?.issued || 0 }}</strong></article>
      </section>
      <section class="panel">
        <div class="section-heading"><div><h2>Eligibility and certificate status</h2><p class="muted">Review eligible trainees; approved eligibility queues the certificate for assigned signatories.</p></div><input v-model="filter" class="search" placeholder="Search trainee, program, status"></div>
        <div class="table-wrap"><table><thead><tr><th>Trainee</th><th>Program / class</th><th>Attendance</th><th>Documents</th><th>Assessments</th><th>Eligibility</th><th>Status</th><th>Certificate</th><th>Actions</th></tr></thead>
          <tbody><tr v-for="item in filteredCertificates" :key="String(item.eligibility_id)">
            <td>{{ item.trainee_name }}<small>{{ item.trainee_number }}</small></td><td>{{ item.program_name }} / {{ item.class_name }}</td><td>{{ item.attendance_percentage }}%</td><td>{{ item.documents_approved }} / {{ item.documents_required }}</td><td>{{ item.assessments_completed }} / {{ item.assessments_required }}</td><td>{{ Number(item.is_eligible) ? 'Eligible' : item.ineligibility_reasons || 'Not eligible' }}</td><td>{{ item.status }}</td><td>{{ item.certificate_number || '—' }}<small>{{ item.issue_date || '' }}</small></td>
            <td class="row-actions">
              <button v-if="!item.certificate_id && item.is_eligible" class="text-button" @click="recalculate(item)">Recalculate</button>
              <template v-if="!item.certificate_id && item.is_eligible && item.approval_status === 'pending'"><textarea v-model="reviewForm(item.eligibility_id).reason" placeholder="Reason if rejecting"></textarea><button class="text-button approve" @click="reviewEligibility(item, 'approved')">Approve</button><button class="text-button danger" @click="reviewEligibility(item, 'rejected')">Reject</button></template>
              <button v-if="!item.certificate_id && item.approval_status === 'approved'" class="text-button" @click="issue(item)">Queue certificate</button>
              <button v-if="item.status === 'draft' && item.certificate_id" class="text-button" @click="resubmitCertificate(item)">Resubmit for signatures</button>
              <small v-if="item.signature_rejection_remarks" class="rejection-note">{{ item.signature_rejection_remarks }}</small>
              <button v-if="item.status === 'issued'" class="text-button danger" @click="revoke(item)">Revoke</button>
              <a v-if="item.status === 'issued'" :href="apiFileUrl(`/certificates/${item.certificate_id}/download`)" target="_blank" rel="noopener">Download</a>
              <button v-if="item.status === 'issued'" class="text-button" @click="verifyCertificate(item)">Verify</button>
            </td>
          </tr><tr v-if="!filteredCertificates.length"><td colspan="9" class="empty">No eligibility records match your search.</td></tr></tbody>
        </table></div>
      </section>
    </template>
    <section v-if="verifiedRecord" class="panel verification-panel" aria-live="polite">
      <div class="section-heading"><div><h2>Certificate verification</h2><p class="muted">{{ verifiedRecord.certificate.certificate_number }} · {{ verifiedRecord.certificate.trainee_name }}</p></div><button class="secondary-button" @click="verifiedRecord = null">Close</button></div>
      <p class="verification-result" :class="{ valid: verifiedRecord.integrity_valid, invalid: !verifiedRecord.integrity_valid }">{{ verifiedRecord.integrity_valid ? 'Valid — stored signature hashes match the certificate data.' : 'Tampered or incomplete — one or more signature hashes do not match, or no signatures are recorded.' }}</p>
      <p><strong>Status:</strong> {{ verifiedRecord.certificate.status }} · <strong>Issued:</strong> {{ verifiedRecord.certificate.issue_date || '—' }}</p>
      <div class="table-wrap"><table><thead><tr><th>Signatory</th><th>Position</th><th>Signed at</th><th>Hash</th></tr></thead><tbody><tr v-for="(signature, index) in verifiedRecord.signatories" :key="`${signature.name}-${index}`"><td>{{ signature.name }}</td><td>{{ signature.position }}</td><td>{{ signature.signed_at }}</td><td>{{ signature.hash_valid ? 'Valid' : 'Tampered' }}</td></tr><tr v-if="!verifiedRecord.signatories.length"><td colspan="4" class="empty">No completed signatures found.</td></tr></tbody></table></div>
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
  --danger: #b4281f;

  max-width: 1500px;
  margin: auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

/* ---------- Headings ---------- */
.page-heading,
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.page-heading {
  position: relative;
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

.page-heading .secondary-button {
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
}

.page-heading .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
}

.section-heading h2,
.panel > h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--sky);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.muted {
  color: var(--muted);
  font-size: 14px;
}

/* ---------- Panels ---------- */
.panel {
  margin-top: 18px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

.section {
  margin-top: 20px;
}

/* ---------- Buttons ---------- */
.secondary-button,
.primary-button,
.danger-button {
  min-height: 42px;
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

.secondary-button:hover:not(:disabled) {
  background: #d3e0f0;
}

.danger-button {
  background: #fdeceb;
  color: var(--danger);
}

.danger-button:hover:not(:disabled) {
  background: #f9d9d5;
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled),
.danger-button:active:not(:disabled) {
  transform: translateY(1px);
}

.primary-button:disabled,
.secondary-button:disabled,
.danger-button:disabled {
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

/* ---------- Tables ---------- */
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
  vertical-align: top;
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

td small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
}

td a {
  color: var(--blue);
  font-weight: 600;
  text-decoration: none;
}

td a:hover {
  color: var(--navy-deep);
  text-decoration: underline;
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--muted);
}

.text-button {
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--blue);
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.text-button:hover {
  background: var(--field);
  color: var(--navy-deep);
}

.approve {
  color: var(--ok);
}

.approve:hover {
  background: #e3f4ea;
  color: #1f6b41;
}

.danger {
  color: var(--danger);
}

.text-button.danger:hover {
  background: #fdeceb;
  color: var(--danger);
}

/* ---------- Stat cards ---------- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin: 18px 0;
}

.stat {
  padding: 20px;
  border: 1px solid var(--line);
  border-top: 3px solid var(--blue);
  border-radius: 12px;
  background: #fff;
}

.stat:nth-child(4n + 2) {
  border-top-color: var(--sky);
}

.stat:nth-child(4n + 3) {
  border-top-color: #d99100;
}

.stat:nth-child(4n) {
  border-top-color: var(--ok);
}

.stat span {
  display: block;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.stat strong {
  display: block;
  margin-top: 8px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
}

/* ---------- Search and row actions ---------- */
.search {
  width: 100%;
  max-width: 300px;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
}

.row-actions {
  min-width: 190px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.row-actions textarea {
  width: 170px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}

.rejection-note {
  display: block;
  max-width: 220px;
  padding: 6px 8px;
  border-left: 3px solid var(--danger);
  border-radius: 4px;
  background: #fdeceb;
  color: var(--danger);
  white-space: normal;
}

/* ---------- Forms ---------- */
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.form-grid label,
.inline-form label,
.sign-actions label,
.reject-form label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
}

.form-grid input,
.form-grid select,
.form-grid textarea,
.inline-form input,
.inline-form select,
.sign-actions input,
.reject-form textarea,
.layout-item input,
.layout-item select,
.search,
.row-actions textarea {
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.form-grid input,
.form-grid select,
.form-grid textarea,
.inline-form input,
.inline-form select,
.sign-actions input,
.reject-form textarea,
.layout-item input,
.layout-item select {
  min-width: 0;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
}

.form-grid input[type='color'] {
  padding: 3px;
  height: 42px;
  cursor: pointer;
}

.form-grid input[type='file'] {
  padding: 8px;
  background: #fff;
}

.form-grid input:hover,
.form-grid select:hover,
.form-grid textarea:hover,
.inline-form input:hover,
.inline-form select:hover {
  border-color: #b6c8de;
}

.form-grid input:focus,
.form-grid select:focus,
.form-grid textarea:focus,
.inline-form input:focus,
.inline-form select:focus,
.sign-actions input:focus,
.reject-form textarea:focus,
.layout-item input:focus,
.layout-item select:focus,
.search:focus,
.row-actions textarea:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 18%);
}

.wide {
  grid-column: 1 / -1;
}

.checkbox {
  display: flex !important;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
}

.checkbox input {
  width: 18px;
  height: 18px;
  accent-color: var(--blue);
}

.layout-item {
  display: grid;
  grid-template-columns: 1.6fr repeat(4, minmax(80px, 1fr));
  gap: 10px;
  align-items: end;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--sky);
  border-radius: 8px;
  background: #f9fbfe;
}

.layout-item strong {
  color: var(--navy-deep);
}

.layout-item label {
  display: grid;
  gap: 4px;
  color: var(--muted);
  font-size: 11px;
}

.actions,
.sign-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.inline-form {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 14px;
  align-items: end;
  margin-top: 16px;
}

/* ---------- Signature pad, signing, preview ---------- */
.signature-pad {
  display: block;
  max-width: 100%;
  height: auto;
  margin-bottom: 10px;
  border: 2px dashed #b6c8de;
  border-radius: 10px;
  background:
    linear-gradient(transparent calc(100% - 38px), #cfdced calc(100% - 38px), #cfdced calc(100% - 37px), transparent calc(100% - 37px)),
    #fbfdff;
  touch-action: none;
  cursor: crosshair;
}

.preview {
  width: 100%;
  height: 650px;
  margin: 16px 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f3f6fb;
}

.sign-actions {
  max-width: 600px;
  margin: 14px 0;
}

.sign-actions label {
  flex: 1;
}

.reject-form {
  display: flex;
  gap: 12px;
  align-items: end;
  max-width: 800px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}

.reject-form label {
  flex: 1;
}

/* ---------- Verification ---------- */
.verification-panel {
  border-left: 4px solid var(--blue);
}

.verification-result {
  padding: 12px 14px;
  border-radius: 6px;
  font-weight: 700;
}

.verification-result.valid {
  border-left: 3px solid var(--ok);
  background: #e3f4ea;
  color: #1f6b41;
}

.verification-result.invalid {
  border-left: 3px solid var(--danger);
  background: #fdeceb;
  color: var(--danger);
}

/* ---------- Responsive ---------- */
@media (max-width: 850px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .layout-item {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .form-grid,
  .inline-form {
    grid-template-columns: 1fr;
  }

  .wide {
    grid-column: auto;
  }

  .page-heading,
  .section-heading {
    flex-wrap: wrap;
  }

  .page-heading {
    padding: 22px 20px;
  }

  .page-heading h1 {
    font-size: 26px;
  }

  .panel {
    padding: 16px;
  }

  .reject-form,
  .sign-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .preview {
    height: 450px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary-button,
  .secondary-button,
  .danger-button,
  .form-grid input,
  .form-grid select,
  .form-grid textarea {
    transition: none;
  }
}
</style>
