<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type CSSProperties } from 'vue'
import { apiFileUrl, apiGet, apiPost, apiRequest, downloadFile, fetchProtectedBlob, getSession } from '../services/api'

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
const signingPreviewUrl = ref('')
const signingPreviewError = ref('')
let signingPreviewRevision = 0
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
const editingTemplateVersion = ref<number | null>(null)
const templateForm = reactive({
  mode: 'generated', save_action: 'activate', source_template_id: '',
  min_attendance_percentage: '75', require_documents: true, require_assessments: false, required_assessment_count: '1',
  institution_name: 'LSI Training Center', title_text: 'Certificate of Completion',
  body_text: 'This is to certify that {trainee_name} has successfully completed {program_name} on {date_completed}.',
  signatory_name: '', signatory_title: '', border_style: 'double', accent_color: '#1d563c', font: 'helvetica'
})
const templateFile = ref<File | null>(null)
const logoFile = ref<File | null>(null)
const templateFilePreviewUrl = ref('')
const logoPreviewUrl = ref('')
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
const activeTemplateFileUrl = computed(() => {
  if (templateForm.mode !== 'upload') return ''
  const templateId = templateForm.source_template_id || String(settingData.value.certificate_template?.template_id || '')
  if (!templateId) return ''
  const version = settingData.value.certificate_template_versions?.find((item) => String(item.template_id) === templateId)
  const activeTemplate = settingData.value.certificate_template
  const activeFilePath = String(activeTemplate?.template_id || '') === templateId ? activeTemplate?.file_path : ''
  const filePath = version?.file_path || activeFilePath
  return filePath ? apiFileUrl(`/certificate-templates/${templateId}/file`) : ''
})
const uploadedBackgroundUrl = computed(() => templateFilePreviewUrl.value || activeTemplateFileUrl.value)
const uploadedBackgroundIsImage = computed(() => {
  const file = templateFile.value
  if (file) return file.type.startsWith('image/')
  const templateId = templateForm.source_template_id || String(settingData.value.certificate_template?.template_id || '')
  const version = settingData.value.certificate_template_versions?.find((item) => String(item.template_id) === templateId)
  const path = String(version?.file_path || settingData.value.certificate_template?.file_path || '')
  return /\.(png|jpe?g|gif|webp)(?:[?#].*)?$/i.test(path)
})
const previewBody = computed(() => {
  const placeholders: Record<string, string> = {
    trainee_name: 'Alex Morgan',
    program_name: 'Workplace Safety Training',
    date_completed: 'November 7, 2026',
    cert_no: 'LSI-2026-001',
    certificate_number: 'LSI-2026-001',
    signatory_name: templateForm.signatory_name || 'Authorized Signatory',
    signatory_title: templateForm.signatory_title || 'Training Director',
    verification_code: 'VERIFY-8F3A21'
  }
  return templateForm.body_text.replace(/\{([^}]+)\}/g, (placeholder, key: string) => placeholders[key] ?? placeholder)
})
const previewFont = computed(() => ({
  helvetica: 'Arial, Helvetica, sans-serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace'
}[templateForm.font] || 'Arial, Helvetica, sans-serif'))
const filteredCertificates = computed(() => {
  const search = filter.value.trim().toLowerCase()
  return certificates.value.filter((row) => !search || [row.trainee_name, row.program_name, row.class_name, row.certificate_number, row.status].some((value) => String(value || '').toLowerCase().includes(search)))
})

watch(templateFile, (file) => {
  if (templateFilePreviewUrl.value) URL.revokeObjectURL(templateFilePreviewUrl.value)
  templateFilePreviewUrl.value = file ? URL.createObjectURL(file) : ''
})
watch(logoFile, (file) => {
  if (logoPreviewUrl.value) URL.revokeObjectURL(logoPreviewUrl.value)
  logoPreviewUrl.value = file ? URL.createObjectURL(file) : ''
})
watch(selected, async (certificate) => {
  const revision = ++signingPreviewRevision
  if (signingPreviewUrl.value) URL.revokeObjectURL(signingPreviewUrl.value)
  signingPreviewUrl.value = ''
  signingPreviewError.value = ''
  if (!certificate) return

  try {
    const pdf = await fetchProtectedBlob(`/certificates/${certificate.certificate_id}/sign-preview`)
    const objectUrl = URL.createObjectURL(pdf)
    if (revision !== signingPreviewRevision) URL.revokeObjectURL(objectUrl)
    else signingPreviewUrl.value = objectUrl
  } catch (reason) {
    if (revision === signingPreviewRevision) {
      signingPreviewError.value = reason instanceof Error ? reason.message : 'Unable to load the certificate preview.'
      error.value = signingPreviewError.value
    }
  }
})
onBeforeUnmount(() => {
  signingPreviewRevision += 1
  if (templateFilePreviewUrl.value) URL.revokeObjectURL(templateFilePreviewUrl.value)
  if (logoPreviewUrl.value) URL.revokeObjectURL(logoPreviewUrl.value)
  if (signingPreviewUrl.value) URL.revokeObjectURL(signingPreviewUrl.value)
})

async function openProtectedFile(path: string, fileName: string, openInNewTab = false) {
  try {
    await downloadFile(path, { filename: fileName, openInNewTab })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to open the requested file.'
  }
}

function previewFieldStyle(field: LayoutField): CSSProperties {
  const layout = fieldLayout[field]
  const align: CSSProperties['textAlign'] = layout.align === 'left' || layout.align === 'right' ? layout.align : 'center'
  const translateX = align === 'left' ? '0%' : align === 'right' ? '-100%' : '-50%'
  return {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    fontSize: `${layout.font_size}px`,
    textAlign: align,
    transform: `translate(${translateX}, -50%)`
  }
}

function previewFieldText(field: LayoutField) {
  const values: Record<LayoutField, string> = {
    trainee_name: 'Alex Morgan',
    program_name: 'Workplace Safety Training',
    date_completed: 'November 7, 2026',
    certificate_number: 'LSI-2026-001',
    signatory_name: templateForm.signatory_name || 'Authorized Signatory',
    verification_code: 'VERIFY-8F3A21'
  }
  return values[field]
}

function money(value: unknown) {
  return String(value ?? '')
}

const ic: Record<string, string> = {
  refresh: '<path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/>',
  review: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M16 11l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  download: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  external: '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"/>',
  eraser: '<path d="M7 21h13"/><path d="M5.5 13.5l8-8a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8l-8 8H8.5l-3-3a2 2 0 010-3z"/>',
  save: '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  checkCircle: '<path d="M22 11.1V12a10 10 0 11-5.9-9.1"/><path d="M22 4L12 14l-3-3"/>',
  rotate: '<path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 11-2.1-9.4L23 10"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.8 4H7.2a2 2 0 00-1.7 1.1z"/>',
}

function pct(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
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
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await apiRequest(`/certificate-signatories/${item.signatory_id}`, { method: 'DELETE' })
    notice.value = response.message || 'Signatory deactivated.'
    await reload()
  } catch (reason) {
    error.value = safeError(reason, 'The signatory could not be deactivated.')
  } finally {
    busy.value = false
  }
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
  editingTemplateVersion.value = null
}

async function activateTemplate(id: unknown) {
  await postAction(`/certificate-templates/${id}/activate`, {}, 'Certificate template activated.')
}

function editTemplate(item: Row) {
  const activeTemplate = settingData.value.certificate_template
  const isActiveTemplate = String(activeTemplate?.template_id) === String(item.template_id)
  const editableFields = [
    'institution_name', 'title_text', 'body_text', 'signatory_name', 'signatory_title',
    'border_style', 'accent_color', 'font'
  ] as const
  const nestedSettings = item.settings && typeof item.settings === 'object'
    ? item.settings as Record<string, unknown>
    : null
  const directSettings = editableFields.some((field) => item[field] !== undefined) ? item : null
  const versionSettings = nestedSettings && editableFields.some((field) => nestedSettings[field] !== undefined)
    ? nestedSettings
    : directSettings || (isActiveTemplate ? activeTemplate?.settings : null)
  const fields = versionSettings
    ? editableFields.filter((field) => versionSettings[field] !== undefined)
    : []

  if (!fields.length && !isActiveTemplate) {
    error.value = 'This template version does not include its settings, so it cannot be edited.'
    return
  }

  fields.forEach((field) => {
    templateForm[field] = String(versionSettings?.[field] ?? '')
  })
  const versionLayout = versionSettings?.field_layout ?? item.field_layout
  if (versionLayout && typeof versionLayout === 'object') {
    const layout = versionLayout as Record<string, { x?: number; y?: number; font_size?: number; align?: string }>
    layoutFields.forEach((field) => {
      const value = layout[field]
      if (value) {
        fieldLayout[field] = {
          x: String(value.x ?? 50),
          y: String(value.y ?? 50),
          font_size: String(value.font_size ?? 16),
          align: value.align || 'center'
        }
      }
    })
  } else if (isActiveTemplate && activeTemplate?.field_layout) {
    layoutFields.forEach((field) => {
      const value = activeTemplate.field_layout?.[field]
      if (value) {
        fieldLayout[field] = {
          x: String(value.x),
          y: String(value.y),
          font_size: String(value.font_size),
          align: value.align || 'center'
        }
      }
    })
  }

  templateForm.mode = String(item.mode || activeTemplate?.mode || 'generated')
  templateForm.source_template_id = String(item.template_id || '')
  templateForm.save_action = 'draft'
  const version = Number(item.version)
  editingTemplateVersion.value = Number.isFinite(version) ? version : null
  error.value = ''
  notice.value = `Editing v${item.version}; saving will create a new draft version.`
  document.querySelector('.page-heading')?.scrollIntoView({ behavior: 'smooth' })
}

async function deleteTemplate(item: Row) {
  if (Number(item.is_active)) return
  if (!window.confirm(`Delete certificate template v${item.version}? This cannot be undone.`)) return
  await postAction(`/certificate-templates/${item.template_id}/delete`, {}, 'Certificate template deleted.')
}

function cancelTemplateEdit() {
  editingTemplateVersion.value = null
  templateForm.source_template_id = String(settingData.value.certificate_template?.template_id || '')
  void loadSettings()
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
        <p class="eyebrow"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.award"/>SMARTTRACK / CERTIFICATES</p>
        <h1>{{ mode === 'signing' ? 'Certificates to sign' : mode === 'settings' ? 'Certificate settings' : isTrainee ? 'My certificates' : 'Certificate eligibility' }}</h1>
        <p class="muted">{{ mode === 'signing' ? 'Review the certificate PDF before signing or returning it to staff.' : mode === 'settings' ? 'Configure eligibility, certificate templates, document requirements, and signatories.' : isTrainee ? 'Track eligibility and download issued certificates.' : 'Review eligibility and track certificates through signing and issuance.' }}</p>
      </div>
      <button class="secondary-button" :class="{ spin: loading }" :disabled="loading" @click="reload"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.refresh"/>Refresh</button>
    </header>

    <p v-if="error" class="inline-error" role="alert"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.alert"/><span>{{ error }}</span></p>
    <p v-if="notice" class="inline-success" role="status"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.checkCircle"/><span>{{ notice }}</span></p>
    <p v-if="loading" class="muted loading"><span class="spinner" aria-hidden="true"></span>Loading certificate data…</p>

    <!-- ===================== SIGNING ===================== -->
    <template v-if="!loading && mode === 'signing'">
      <section v-if="selected" class="panel signing-panel">
        <div class="section-heading">
          <div>
            <h2>{{ selected.certificate_number }}</h2>
            <p class="muted">{{ selected.trainee_name }} · {{ selected.program_name }} · {{ selected.class_name }}</p>
          </div>
          <button class="secondary-button" @click="selected = null"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.back"/>Back to queue</button>
        </div>

        <div class="signing-layout">
          <iframe v-if="signingPreviewUrl" class="preview" :src="signingPreviewUrl" title="Certificate signing preview"></iframe>
          <div v-else class="preview preview-loading" :role="signingPreviewError ? 'alert' : 'status'">{{ signingPreviewError || 'Loading certificate preview…' }}</div>

          <aside class="signing-side">
            <form class="side-card sign-actions" @submit.prevent="signCertificate">
              <h3>Sign this certificate</h3>
              <p class="muted">Confirm your password to apply your signature.</p>
              <label>Password confirmation<input v-model="password" type="password" autocomplete="current-password" required></label>
              <button class="primary-button" :disabled="busy"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.pen"/>{{ busy ? 'Signing…' : 'Sign certificate' }}</button>
            </form>

            <form class="side-card reject-form" @submit.prevent="rejectSignature">
              <h3>Return to staff</h3>
              <p class="muted">Explain what needs to be corrected.</p>
              <label>Remarks<textarea v-model.trim="rejectionRemarks" maxlength="1000" rows="3" required></textarea></label>
              <button class="danger-button" :disabled="busy"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.undo"/>Reject / return</button>
            </form>
          </aside>
        </div>
      </section>

      <section v-else class="panel">
        <div class="section-heading">
          <div>
            <h2><span class="h-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.pen"/></span>Assigned certificates</h2>
            <p class="muted">Open a certificate to review the PDF and sign it.</p>
          </div>
          <span class="count-badge"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.clock"/>{{ certificates.length }} waiting</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Certificate</th><th>Trainee</th><th>Program / class</th><th>Completed</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="item in certificates" :key="String(item.certificate_id)">
                <td class="strong">{{ item.certificate_number }}</td>
                <td>{{ item.trainee_name }}</td>
                <td>{{ item.program_name }} / {{ item.class_name }}</td>
                <td>{{ item.completion_date }}</td>
                <td class="end"><button class="text-button" @click="openSigning(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.pen"/>Review PDF &amp; sign</button></td>
              </tr>
              <tr v-if="!certificates.length"><td colspan="5" class="empty"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.inbox"/><span>No certificates currently assigned to you.</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ===================== SETTINGS ===================== -->
    <template v-else-if="!loading && mode === 'settings' && isAdmin">
      <nav class="jump-nav" aria-label="Settings sections">
        <button
          v-for="item in [['sec-eligibility', '1  Eligibility', 'shield'], ['sec-template', '2  Template', 'file'], ['sec-versions', '3  Versions', 'layers'], ['sec-signatories', '4  Signatories', 'users']]"
          :key="item[0]"
          type="button"
          @click="$el.querySelector('#' + item[0])?.scrollIntoView({ behavior: 'smooth', block: 'start' })"
        ><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic[item[2]]"/>{{ item[1] }}</button>
      </nav>

      <!-- Eligibility and template share one form and one save button -->
      <form class="settings-form" @submit.prevent="saveTemplate">
        <section id="sec-eligibility" class="panel">
          <div class="section-heading">
            <div>
              <h2><span class="h-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.shield"/></span>Eligibility requirements</h2>
              <p class="muted">What a trainee must complete before a certificate can be issued.</p>
            </div>
          </div>
          <div class="form-grid cols-4">
            <label>Minimum attendance (%)<input v-model="templateForm.min_attendance_percentage" type="number" min="0" max="100" step="0.1" required></label>
            <label>Required assessment count<input v-model="templateForm.required_assessment_count" type="number" min="1" max="100" required></label>
            <label class="checkbox"><input v-model="templateForm.require_documents" type="checkbox"> Require approved documents</label>
            <label class="checkbox"><input v-model="templateForm.require_assessments" type="checkbox"> Require completed assessments</label>
          </div>
        </section>

        <section id="sec-template" class="panel">
          <div class="section-heading">
            <div>
              <h2><span class="h-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.file"/></span>Certificate template</h2>
              <p class="muted">Files and logos are limited to 5 MB and stored privately.</p>
            </div>
          </div>

          <p v-if="editingTemplateVersion !== null" class="edit-banner" role="status">
            Editing v{{ editingTemplateVersion }} as a new draft. Saving creates a new version; existing versions are preserved.
            <button type="button" class="text-button" @click="cancelTemplateEdit"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.x"/>Cancel edit</button>
          </p>

          <div class="template-layout">
            <!-- left: all the fields, grouped -->
            <div class="template-fields">
              <div class="group">
                <h3 class="group-title">Mode and saving</h3>
                <div class="form-grid cols-2">
                  <label>Template mode<select v-model="templateForm.mode"><option value="generated">Generated design</option><option value="upload">Uploaded background</option></select></label>
                  <label>Save as<select v-model="templateForm.save_action"><option value="activate">Activate immediately</option><option value="draft">Save draft version</option></select></label>
                </div>
              </div>

              <div class="group">
                <h3 class="group-title">Content</h3>
                <p class="hint">Placeholders: {trainee_name}, {program_name}, {date_completed}, {cert_no}, {signatory_name}, {signatory_title}, {verification_code}.</p>
                <div class="form-grid cols-2">
                  <label>Institution name<input v-model.trim="templateForm.institution_name" maxlength="150" required></label>
                  <label>Title text<input v-model.trim="templateForm.title_text" maxlength="150" required></label>
                  <label class="wide">Certificate body<textarea v-model.trim="templateForm.body_text" maxlength="2000" rows="3" required></textarea></label>
                  <label>Fallback printed signatory name<input v-model.trim="templateForm.signatory_name" maxlength="150" required></label>
                  <label>Fallback printed signatory title<input v-model.trim="templateForm.signatory_title" maxlength="150" required></label>
                </div>
              </div>

              <div class="group">
                <h3 class="group-title">Appearance</h3>
                <div class="form-grid cols-2">
                  <label>Border<select v-model="templateForm.border_style"><option value="none">None</option><option value="single">Single</option><option value="double">Double</option></select></label>
                  <label>Font<select v-model="templateForm.font"><option value="helvetica">Helvetica</option><option value="times">Times</option><option value="courier">Courier</option></select></label>
                  <label>Accent color<input v-model="templateForm.accent_color" type="color" required></label>
                  <label>Logo (PNG/JPG, max 5 MB)<input type="file" accept=".png,.jpg,.jpeg" @change="onLogoFile"></label>
                  <label v-if="templateForm.mode === 'upload'" class="wide">Background (PDF/PNG/JPG, max 5 MB)<input type="file" accept=".pdf,.png,.jpg,.jpeg" @change="onTemplateFile"></label>
                </div>
              </div>

              <div v-if="templateForm.mode === 'upload'" class="group">
                <h3 class="group-title">Field positions</h3>
                <p class="hint">Set field positions as percentages of the page, plus font size and alignment.</p>
                <div class="layout-list">
                  <div v-for="field in layoutFields" :key="field" class="layout-item">
                    <strong>{{ layoutLabels[field] }}</strong>
                    <label>X %<input v-model="fieldLayout[field].x" type="number" min="0" max="100" step="0.1"></label>
                    <label>Y %<input v-model="fieldLayout[field].y" type="number" min="0" max="100" step="0.1"></label>
                    <label>Font size<input v-model="fieldLayout[field].font_size" type="number" min="6" max="72" step="0.5"></label>
                    <label>Align<select v-model="fieldLayout[field].align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                  </div>
                </div>
              </div>
            </div>

            <!-- right: live preview stays in view while editing -->
            <aside class="template-preview">
              <section class="certificate-live-preview" aria-live="polite">
                <div class="section-heading">
                  <div>
                    <h3>Live certificate preview</h3>
                    <p class="muted">Updates as you edit, using sample trainee details.</p>
                  </div>
                  <a v-if="templateForm.mode === 'upload' && uploadedBackgroundUrl && !uploadedBackgroundIsImage" class="text-button" :href="uploadedBackgroundUrl" target="_blank" rel="noopener"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.external"/>Open PDF background</a>
                </div>

                <div v-if="templateForm.mode === 'upload'" class="certificate-preview-sheet uploaded-preview" :style="{ '--preview-accent': templateForm.accent_color, fontFamily: previewFont }">
                  <img v-if="uploadedBackgroundUrl && uploadedBackgroundIsImage" class="certificate-background-image" :src="uploadedBackgroundUrl" alt="">
                  <div v-else class="uploaded-preview-placeholder">
                    <span v-if="uploadedBackgroundUrl">PDF background selected; previewing the edited field positions.</span>
                    <span v-else>Choose an image or PDF background to preview your uploaded design.</span>
                  </div>
                  <div v-for="field in layoutFields" :key="field" class="positioned-preview-field" :style="previewFieldStyle(field)">{{ previewFieldText(field) }}</div>
                </div>

                <div v-else class="certificate-preview-sheet generated-preview" :class="`border-${templateForm.border_style}`" :style="{ '--preview-accent': templateForm.accent_color, fontFamily: previewFont }">
                  <img v-if="logoPreviewUrl" class="certificate-preview-logo" :src="logoPreviewUrl" alt="Selected certificate logo">
                  <p class="preview-institution">{{ templateForm.institution_name || 'Institution name' }}</p>
                  <h4>{{ templateForm.title_text || 'Certificate title' }}</h4>
                  <p class="preview-body">{{ previewBody }}</p>
                  <div class="preview-signature">
                    <strong>{{ templateForm.signatory_name || 'Authorized Signatory' }}</strong>
                    <span>{{ templateForm.signatory_title || 'Signatory title' }}</span>
                  </div>
                  <small>Certificate No. LSI-2026-001 · Verification code VERIFY-8F3A21</small>
                </div>
              </section>
            </aside>
          </div>

          <div class="form-footer">
            <p class="muted">Saves the eligibility requirements and the template together.</p>
            <button class="primary-button" :disabled="busy"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.save"/>{{ busy ? 'Saving…' : 'Save template and eligibility settings' }}</button>
          </div>
        </section>
      </form>

      <section id="sec-versions" class="panel">
        <div class="section-heading">
          <div>
            <h2><span class="h-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.layers"/></span>Template versions</h2>
            <p class="muted">Previous versions are kept so issued certificates never change.</p>
          </div>
          <span class="count-badge"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.layers"/>{{ settingData.certificate_template_versions?.length || 0 }} versions</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Version</th><th>Mode</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="item in settingData.certificate_template_versions || []" :key="String(item.template_id)">
                <td class="strong">v{{ item.version }}</td>
                <td class="cap">{{ item.mode }}</td>
                <td><span class="pill" :class="Number(item.is_active) ? 'issued' : 'draft'">{{ Number(item.is_active) ? 'Active' : 'Draft' }}</span></td>
                <td class="row-actions">
                  <button class="text-button" :disabled="busy" @click="editTemplate(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.pen"/>Edit</button>
                  <button v-if="!Number(item.is_active)" class="text-button" :disabled="busy" @click="activateTemplate(item.template_id)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.zap"/>Create active version from this</button>
                  <a v-if="item.file_path" class="text-button" :href="apiFileUrl(`/certificate-templates/${item.template_id}/file`)" target="_blank" rel="noopener"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.external"/>Preview file</a>
                  <button v-if="!Number(item.is_active)" class="text-button danger" :disabled="busy" @click="deleteTemplate(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.trash"/>Delete</button>
                </td>
              </tr>
              <tr v-if="!settingData.certificate_template_versions?.length"><td colspan="4" class="empty"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.inbox"/><span>No template versions.</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="sec-signatories" class="panel">
        <div class="section-heading">
          <div>
            <h2><span class="h-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.users"/></span>{{ signatoryId ? 'Edit signatory' : 'Add signatory' }}</h2>
            <p class="muted">People who sign certificates before they are issued.</p>
          </div>
        </div>

        <form class="signatory-form" @submit.prevent="saveSignatory">
          <div class="group">
            <h3 class="group-title">Account and details</h3>
            <div class="form-grid cols-3">
              <label>System account<select v-model="signatoryForm.user_id" required><option value="" disabled>Select administrator or staff</option><option v-for="account in settingData.signatory_accounts || []" :key="account.id" :value="String(account.id)">{{ account.label }}</option></select></label>
              <label>Printed name<input v-model.trim="signatoryForm.name" maxlength="150" required></label>
              <label>Position<input v-model.trim="signatoryForm.position" maxlength="150" required></label>
            </div>
          </div>

          <div class="group">
            <h3 class="group-title">Signature</h3>
            <div class="form-grid cols-3">
              <label>Signature X position (%)<input v-model="signatoryForm.x_position" type="number" min="0" max="100" step="0.1" required></label>
              <label>Signature Y position (%)<input v-model="signatoryForm.y_position" type="number" min="0" max="100" step="0.1" required></label>
              <label>Signature PNG (transparent, max 1 MB)<input type="file" accept="image/png,.png" @change="onSignatureFile"></label>
            </div>
            <p class="hint">Or draw a signature on the transparent pad.</p>
            <canvas ref="signatureCanvas" class="signature-pad" width="700" height="180" @pointerdown="startDrawing" @pointermove="draw" @pointerup="stopDrawing" @pointercancel="stopDrawing" @pointerleave="stopDrawing"></canvas>
            <button type="button" class="secondary-button" @click="clearCanvas"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.eraser"/>Clear signature pad</button>
          </div>

          <div class="form-footer">
            <span></span>
            <div class="actions">
              <button v-if="signatoryId" type="button" class="secondary-button" @click="resetSignatory"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.x"/>Cancel</button>
              <button class="primary-button" :disabled="busy"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.save"/>{{ busy ? 'Saving…' : signatoryId ? 'Save signatory' : 'Add signatory' }}</button>
            </div>
          </div>
        </form>

        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Position</th><th>Account</th><th>Status</th><th>Position (%)</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="item in settingData.signatories || []" :key="String(item.signatory_id)">
                <td class="strong">{{ item.name }}</td>
                <td>{{ item.position }}</td>
                <td>{{ item.account_name }}</td>
                <td><span class="pill" :class="Number(item.is_active) ? 'issued' : 'draft'">{{ Number(item.is_active) ? 'Active' : 'Inactive' }}</span></td>
                <td>{{ item.x_position }}, {{ item.y_position }}</td>
                <td class="row-actions">
                  <button class="text-button" @click="editSignatory(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.pen"/>Edit</button>
                  <button v-if="Number(item.is_active)" class="text-button danger" @click="deactivateSignatory(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.ban"/>Deactivate</button>
                </td>
              </tr>
              <tr v-if="!settingData.signatories?.length"><td colspan="6" class="empty"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.inbox"/><span>No signatories configured.</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ===================== TRAINEE ===================== -->
    <template v-else-if="!loading && mode === 'records' && isTrainee">
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2><span class="h-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.userCheck"/></span>My certificate eligibility</h2>
            <p class="muted">Your progress toward each certificate.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Program / class</th><th>Attendance</th><th>Documents</th><th>Assessments</th><th>Eligibility</th><th>Review status</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in data.eligibility || []" :key="String(item.eligibility_id)">
                <td class="strong">{{ item.program_name }} / {{ item.class_name }}</td>
                <td><div class="meter-cell"><span>{{ item.attendance_percentage }}%</span><span class="meter"><i :style="{ width: pct(item.attendance_percentage) + '%' }"></i></span></div></td>
                <td>{{ item.documents_approved }} / {{ item.documents_required }}</td>
                <td>{{ item.assessments_completed }} / {{ item.assessments_required }}</td>
                <td><span class="pill" :class="Number(item.is_eligible) ? 'issued' : 'pending'">{{ Number(item.is_eligible) ? 'Eligible' : 'Requirements incomplete' }}</span></td>
                <td><span class="pill" :class="String(item.approval_status || '').toLowerCase()">{{ item.approval_status }}</span></td>
              </tr>
              <tr v-if="!data.eligibility?.length"><td colspan="6" class="empty"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.inbox"/><span>No eligibility records available.</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-heading">
          <div>
            <h2><span class="h-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.award"/></span>Issued certificates</h2>
            <p class="muted">Download your certificate once it has been signed.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Certificate number</th><th>Program / class</th><th>Issue date</th><th>Status</th><th>Download</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in certificates" :key="String(item.certificate_id)">
                <td class="strong">{{ item.certificate_number }}</td>
                <td>{{ item.program_name }} / {{ item.class_name }}</td>
                <td>{{ item.issue_date }}</td>
                <td><span class="pill" :class="String(item.status || '').toLowerCase()">{{ item.status }}</span></td>
                <td class="row-actions">
                  <button v-if="item.status === 'issued'" type="button" class="text-button" @click="openProtectedFile(`/certificates/${item.certificate_id}/download`, `certificate-${item.certificate_id}.pdf`, true)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.download"/>Download PDF</button>
                  <button v-if="item.status === 'issued'" class="text-button" @click="verifyCertificate(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.shield"/>Verify</button>
                  <span v-if="item.status !== 'issued'" class="muted">Available after signing</span>
                </td>
              </tr>
              <tr v-if="!certificates.length"><td colspan="5" class="empty"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.inbox"/><span>No certificates issued yet.</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ===================== STAFF RECORDS ===================== -->
    <template v-else-if="!loading && mode === 'records' && isStaff">
      <section class="stats-grid" aria-label="Certificate figures">
        <article class="stat"><em class="stat-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.userCheck"/></em><span>Eligible</span><strong>{{ data.certificate_stats?.eligible || 0 }}</strong></article>
        <article class="stat"><em class="stat-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.clock"/></em><span>Awaiting approval</span><strong>{{ data.certificate_stats?.pending || 0 }}</strong></article>
        <article class="stat"><em class="stat-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.pen"/></em><span>Awaiting signatures</span><strong>{{ data.certificate_stats?.signing || 0 }}</strong></article>
        <article class="stat"><em class="stat-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.award"/></em><span>Issued</span><strong>{{ data.certificate_stats?.issued || 0 }}</strong></article>
      </section>

      <section class="panel">
        <div class="section-heading">
          <div>
            <h2><span class="h-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.review"/></span>Eligibility and certificate status</h2>
            <p class="muted">Review eligible trainees; approved eligibility queues the certificate for assigned signatories.</p>
          </div>
          <input v-model="filter" class="search" placeholder="Search trainee, program, status" aria-label="Search eligibility records">
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Program / class</th>
                <th>Attendance</th>
                <th>Documents</th>
                <th>Assessments</th>
                <th>Eligibility</th>
                <th>Status</th>
                <th>Certificate</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredCertificates" :key="String(item.eligibility_id)">
                <td><span class="strong">{{ item.trainee_name }}</span><small>{{ item.trainee_number }}</small></td>
                <td>{{ item.program_name }} / {{ item.class_name }}</td>
                <td><div class="meter-cell"><span>{{ item.attendance_percentage }}%</span><span class="meter"><i :style="{ width: pct(item.attendance_percentage) + '%' }"></i></span></div></td>
                <td>{{ item.documents_approved }} / {{ item.documents_required }}</td>
                <td>{{ item.assessments_completed }} / {{ item.assessments_required }}</td>
                <td>
                  <span v-if="Number(item.is_eligible)" class="pill issued">Eligible</span>
                  <span v-else class="pill pending">{{ item.ineligibility_reasons || 'Not eligible' }}</span>
                </td>
                <td><span class="pill" :class="String(item.status || '').toLowerCase()">{{ item.status }}</span></td>
                <td>{{ item.certificate_number || '—' }}<small>{{ item.issue_date || '' }}</small></td>
                <td class="row-actions">
                  <button v-if="!item.certificate_id && item.is_eligible" class="text-button" @click="recalculate(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.refresh"/>Recalculate</button>

                  <template v-if="!item.certificate_id && item.is_eligible && item.approval_status === 'pending'">
                    <textarea v-model="reviewForm(item.eligibility_id).reason" placeholder="Reason if rejecting"></textarea>
                    <button class="text-button approve" @click="reviewEligibility(item, 'approved')"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.check"/>Approve</button>
                    <button class="text-button danger" @click="reviewEligibility(item, 'rejected')"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.x"/>Reject</button>
                  </template>

                  <button v-if="!item.certificate_id && item.approval_status === 'approved'" class="text-button" @click="issue(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.send"/>Queue certificate</button>
                  <button v-if="item.status === 'draft' && item.certificate_id" class="text-button" @click="resubmitCertificate(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.rotate"/>Resubmit for signatures</button>
                  <small v-if="item.signature_rejection_remarks" class="rejection-note">{{ item.signature_rejection_remarks }}</small>

                  <button v-if="item.status === 'issued'" type="button" class="text-button" @click="openProtectedFile(`/certificates/${item.certificate_id}/download`, `certificate-${item.certificate_id}.pdf`, true)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.download"/>Download</button>
                  <button v-if="item.status === 'issued'" class="text-button" @click="verifyCertificate(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.shield"/>Verify</button>
                  <button v-if="item.status === 'issued'" class="text-button danger" @click="revoke(item)"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.ban"/>Revoke</button>
                </td>
              </tr>
              <tr v-if="!filteredCertificates.length"><td colspan="9" class="empty"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.inbox"/><span>No eligibility records match your search.</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ===================== VERIFICATION (all modes) ===================== -->
    <section v-if="verifiedRecord" class="panel verification-panel" aria-live="polite">
      <div class="section-heading">
        <div>
          <h2><span class="h-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.shield"/></span>Certificate verification</h2>
          <p class="muted">{{ verifiedRecord.certificate.certificate_number }} · {{ verifiedRecord.certificate.trainee_name }}</p>
        </div>
        <button class="secondary-button" @click="verifiedRecord = null"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.x"/>Close</button>
      </div>
      <p class="verification-result" :class="{ valid: verifiedRecord.integrity_valid, invalid: !verifiedRecord.integrity_valid }">{{ verifiedRecord.integrity_valid ? 'Valid — stored signature hashes match the certificate data.' : 'Tampered or incomplete — one or more signature hashes do not match, or no signatures are recorded.' }}</p>
      <p class="verify-meta"><strong>Status:</strong> {{ verifiedRecord.certificate.status }} · <strong>Issued:</strong> {{ verifiedRecord.certificate.issue_date || '—' }}</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Signatory</th><th>Position</th><th>Signed at</th><th>Hash</th></tr></thead>
          <tbody>
            <tr v-for="(signature, index) in verifiedRecord.signatories" :key="`${signature.name}-${index}`">
              <td class="strong">{{ signature.name }}</td>
              <td>{{ signature.position }}</td>
              <td>{{ signature.signed_at }}</td>
              <td><span class="pill" :class="signature.hash_valid ? 'issued' : 'revoked'">{{ signature.hash_valid ? 'Valid' : 'Tampered' }}</span></td>
            </tr>
            <tr v-if="!verifiedRecord.signatories.length"><td colspan="4" class="empty"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" v-html="ic.inbox"/><span>No completed signatures found.</span></td></tr>
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

  max-width: 1500px;
  margin: auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

/* ================= Banner and headings ================= */
.page-heading,
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
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

/* a seal that turns slowly behind the heading */
.page-heading::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 9%;
  width: 150px;
  height: 150px;
  margin-top: -75px;
  border: 2px dashed rgb(143 196 245 / 40%);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgb(143 196 245 / 22%) 0 38%, transparent 39%),
    radial-gradient(circle, transparent 0 56%, rgb(143 196 245 / 28%) 57% 59%, transparent 60%);
  animation: seal-spin 28s linear infinite;
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

.page-heading .secondary-button {
  border: 1px solid rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
}

.page-heading .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 22%);
  transform: translateY(-2px);
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

.section-heading .muted {
  margin: 4px 0 0;
}

.loading {
  padding: 28px 0;
  text-align: center;
  animation: breathe 1.4s ease-in-out infinite;
}

/* ================= Panels ================= */
.panel {
  position: relative;
  margin-top: 18px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
  animation: rise 0.6s var(--ease) 0.1s both;
  transition: box-shadow 0.3s ease;
}

.panel:hover {
  box-shadow: 0 16px 34px -20px rgb(17 44 73 / 50%);
}

.section {
  margin-top: 20px;
}

/* the blue tab on top of settings panels draws itself in */
.settings-form .panel::before,
#sec-versions::before,
#sec-signatories::before {
  content: '';
  position: absolute;
  top: 0;
  left: 24px;
  width: 64px;
  height: 4px;
  border-radius: 0 0 6px 6px;
  background: linear-gradient(90deg, var(--blue), var(--sky));
  transform-origin: left;
  animation: tab-draw 0.7s var(--ease) 0.3s both;
}

/* ================= Buttons ================= */
.secondary-button,
.primary-button,
.danger-button {
  position: relative;
  min-height: 42px;
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

/* light sweep on hover */
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

.secondary-button:hover:not(:disabled) {
  background: #d3e0f0;
  transform: translateY(-1px);
}

.danger-button {
  background: #fdeceb;
  color: var(--danger);
}

.danger-button:hover:not(:disabled) {
  background: #f9d9d5;
  transform: translateY(-1px);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled),
.danger-button:active:not(:disabled) {
  transform: scale(0.97);
}

.primary-button:disabled,
.secondary-button:disabled,
.danger-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* busy: progress stripe along the bottom edge */
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

.primary-button:focus-visible,
.secondary-button:focus-visible,
.danger-button:focus-visible,
.text-button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.text-button {
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--blue);
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
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

/* ================= Tables: rows cascade in ================= */
.table-wrap {
  overflow: auto;
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 6px 18px -16px rgb(17 44 73 / 50%);
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

tbody tr {
  animation: row-in 0.5s var(--ease) both;
  transition: background 0.2s ease, box-shadow 0.25s ease;
}

tbody tr:nth-child(1) { animation-delay: 0.25s; }
tbody tr:nth-child(2) { animation-delay: 0.31s; }
tbody tr:nth-child(3) { animation-delay: 0.37s; }
tbody tr:nth-child(4) { animation-delay: 0.43s; }
tbody tr:nth-child(5) { animation-delay: 0.49s; }
tbody tr:nth-child(6) { animation-delay: 0.55s; }
tbody tr:nth-child(n + 7) { animation-delay: 0.61s; }

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f6f9fd;
  box-shadow: inset 3px 0 0 var(--sky);
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

td.row-actions a {
  padding: 5px 10px;
  border-radius: 6px;
}

td.row-actions a:hover {
  background: var(--field);
  text-decoration: none;
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--muted);
}

.strong {
  color: var(--navy-deep);
  font-weight: 600;
}

.cap {
  text-transform: capitalize;
}

th.end,
td.end {
  text-align: right;
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
  animation: rise 0.5s var(--ease) both;
}

.count-badge {
  padding: 6px 13px;
  border: 1px solid #cfe1f5;
  border-radius: 999px;
  background: #e8f2fc;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  animation: pop-in 0.5s var(--spring) 0.35s both;
}

/* status pills */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px 4px 10px;
  border-radius: 999px;
  background: #fbf0d3;
  color: #8a5d00;
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
  white-space: nowrap;
  animation: pop-in 0.45s var(--spring) both;
}

.pill::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.pill.issued,
.pill.approved {
  background: #e3f4ea;
  color: #1f6b41;
}

.pill.draft {
  background: #e8edf4;
  color: #4b5d73;
}

.pill.revoked,
.pill.rejected {
  background: #fdeceb;
  color: var(--danger);
}

/* waiting states (pending, awaiting signature) breathe with an amber glow */
.pill:not(.issued):not(.approved):not(.draft):not(.revoked):not(.rejected) {
  animation: pop-in 0.45s var(--spring) both, glow-amber 2.8s ease-in-out 1s infinite;
}

/* ================= Stat cards ================= */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin: 18px 0;
}

.stat {
  position: relative;
  padding: 20px;
  border: 1px solid var(--line);
  border-top: 3px solid var(--blue);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  animation: pop-in 0.6s var(--spring) both;
  transition: transform 0.3s var(--ease), box-shadow 0.3s ease;
}

.stat:nth-child(1) { animation-delay: 0.05s; }
.stat:nth-child(2) { animation-delay: 0.12s; }
.stat:nth-child(3) { animation-delay: 0.19s; }
.stat:nth-child(4) { animation-delay: 0.26s; }

.stat:nth-child(4n + 2) {
  border-top-color: var(--sky);
}

.stat:nth-child(4n + 3) {
  border-top-color: #d99100;
}

.stat:nth-child(4n) {
  border-top-color: var(--ok);
}

.stat:hover {
  transform: translateY(-5px);
  box-shadow: 0 22px 34px -22px rgb(17 44 73 / 60%);
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
  animation: number-in 0.7s var(--ease) 0.3s both;
}

/* ================= Search ================= */
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
  transition: border-color 0.2s ease, box-shadow 0.25s ease, max-width 0.35s var(--ease), background 0.2s ease;
}

/* the search box widens when you click into it */
.search:focus {
  max-width: 380px;
}

/* ================= Jump bar (settings) ================= */
.jump-nav {
  position: sticky;
  top: 0;
  z-index: 6;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  margin: 18px 0 0;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgb(255 255 255 / 92%);
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 28px -18px rgb(17 44 73 / 55%);
  scrollbar-width: none;
  animation: drop-in 0.55s var(--ease) 0.1s both;
}

.jump-nav::-webkit-scrollbar {
  display: none;
}

.jump-nav button {
  position: relative;
  flex: 1 0 auto;
  padding: 10px 18px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--muted);
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s var(--spring);
}

/* an underline grows under the hovered section */
.jump-nav button::after {
  content: '';
  position: absolute;
  right: 18px;
  bottom: 5px;
  left: 18px;
  height: 2px;
  border-radius: 2px;
  background: var(--sky);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.35s var(--ease);
}

.jump-nav button:hover {
  background: var(--field);
  color: var(--navy-deep);
  transform: translateY(-1px);
}

.jump-nav button:hover::after {
  transform: scaleX(1);
}

.jump-nav button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 1px;
}

#sec-eligibility,
#sec-template,
#sec-versions,
#sec-signatories {
  scroll-margin-top: 76px;
}

/* ================= Forms ================= */
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.form-grid.cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0;
}

.form-grid.cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0;
}

.form-grid.cols-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
  transition: color 0.2s ease;
}

.form-grid label:has(input:focus, select:focus, textarea:focus),
.inline-form label:has(input:focus, select:focus),
.sign-actions label:has(input:focus),
.reject-form label:has(textarea:focus) {
  color: var(--blue);
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
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
}

.form-grid textarea,
.reject-form textarea {
  resize: vertical;
}

.form-grid input[type='color'] {
  height: 42px;
  padding: 3px;
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
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 20px -14px rgb(38 95 148 / 55%);
}

.form-grid input:focus,
.form-grid select:focus,
.form-grid textarea:focus {
  transform: translateY(-1px);
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
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s var(--spring);
}

.checkbox:hover {
  border-color: #b6c8de;
  background: #e3ecf8;
  transform: translateY(-1px);
}

.checkbox:has(input:checked) {
  border-color: var(--blue);
  background: #e1edfa;
}

.form-grid .checkbox input {
  flex: none;
  width: 18px;
  min-height: 0;
  height: 18px;
  padding: 0;
  accent-color: var(--blue);
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

/* grouped blocks */
.group {
  margin-top: 26px;
  animation: rise 0.55s var(--ease) both;
}

.group:nth-child(1) { animation-delay: 0.2s; }
.group:nth-child(2) { animation-delay: 0.28s; }
.group:nth-child(3) { animation-delay: 0.36s; }
.group:nth-child(n + 4) { animation-delay: 0.44s; }

.group:first-child {
  margin-top: 0;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  color: var(--navy);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.group-title::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--sky);
  box-shadow: 0 0 0 3px rgb(143 196 245 / 28%);
  animation: marker-pulse 3s ease-in-out infinite;
}

.group-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line);
  transform-origin: left;
  animation: tab-draw 0.8s var(--ease) 0.3s both;
}

.hint {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f4f8fd;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}

/* field position rows */
.layout-list {
  display: grid;
  gap: 10px;
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
  animation: row-in 0.45s var(--ease) both;
  transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s var(--ease);
}

.layout-item:nth-child(1) { animation-delay: 0.3s; }
.layout-item:nth-child(2) { animation-delay: 0.36s; }
.layout-item:nth-child(3) { animation-delay: 0.42s; }
.layout-item:nth-child(4) { animation-delay: 0.48s; }
.layout-item:nth-child(5) { animation-delay: 0.54s; }
.layout-item:nth-child(n + 6) { animation-delay: 0.6s; }

.layout-item:hover {
  border-color: #cfdcec;
  border-left-color: var(--blue);
  box-shadow: 0 8px 20px -16px rgb(17 44 73 / 55%);
  transform: translateX(3px);
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

/* ================= Template editor and live preview ================= */
.template-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 0.95fr);
  gap: 28px;
  align-items: start;
  margin-top: 20px;
}

.template-preview {
  position: sticky;
  top: 80px;
  animation: slide-right 0.7s var(--ease) 0.3s both;
}

.edit-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 18px 0 0;
  padding: 13px 16px;
  border: 1px solid #cfe1f5;
  border-left: 4px solid var(--blue);
  border-radius: 8px;
  background: #eaf3fc;
  color: var(--navy-deep);
  font-size: 14px;
  line-height: 1.5;
  animation: slide-left 0.5s var(--ease) both;
}

.edit-banner::before {
  content: 'i';
  display: grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--blue);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  font-style: italic;
  animation: ping-blue 2.4s ease-out infinite;
}

.certificate-live-preview {
  padding: 18px;
  border: 1px solid #d4e0ee;
  border-radius: 14px;
  background:
    radial-gradient(rgb(17 44 73 / 7%) 1px, transparent 1px) 0 0 / 14px 14px,
    #eef3f9;
}

.certificate-live-preview .section-heading {
  align-items: center;
  margin-bottom: 14px;
}

.certificate-live-preview h3 {
  margin: 0;
  color: var(--navy-deep);
  font-size: 17px;
}

.certificate-live-preview .muted {
  margin: 4px 0 0;
}

/* the sheet lifts like paper and catches a sheen on hover */
.certificate-preview-sheet {
  position: relative;
  width: 100%;
  aspect-ratio: 1.414 / 1;
  overflow: hidden;
  border-radius: 4px;
  background: #fff;
  color: #233344;
  box-shadow: 0 1px 2px rgb(17 44 73 / 18%), 0 18px 36px -14px rgb(17 44 73 / 40%);
  animation: paper-in 0.7s var(--ease) 0.4s both;
  transition: transform 0.4s var(--ease), box-shadow 0.4s ease;
}

.certificate-preview-sheet:hover {
  transform: translateY(-4px) rotate(-0.4deg);
  box-shadow: 0 2px 4px rgb(17 44 73 / 18%), 0 28px 44px -16px rgb(17 44 73 / 50%);
}

.certificate-preview-sheet::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -50%;
  z-index: 2;
  width: 35%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 55%), transparent);
  transform: skewX(-20deg);
  pointer-events: none;
}

.certificate-preview-sheet:hover::after {
  animation: sheen 1s ease both;
}

.generated-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5%;
  border: 12px solid transparent;
  text-align: center;
}

.generated-preview.border-single {
  border-color: var(--preview-accent);
}

.generated-preview.border-double {
  border: 10px double var(--preview-accent);
}

.generated-preview.border-none {
  border-color: transparent;
}

.generated-preview::before {
  content: '';
  position: absolute;
  inset: 20px;
  border: 1px solid color-mix(in srgb, var(--preview-accent), transparent 58%);
  pointer-events: none;
}

.generated-preview.border-none::before {
  display: none;
}

.certificate-preview-logo {
  position: absolute;
  top: 8%;
  left: 8%;
  width: 12%;
  height: 16%;
  object-fit: contain;
}

.preview-institution {
  margin: 0 0 3%;
  color: var(--preview-accent);
  font-size: clamp(12px, 2.2vw, 22px);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.generated-preview h4 {
  margin: 0 0 4%;
  color: var(--preview-accent);
  font-family: inherit;
  font-size: clamp(20px, 4vw, 42px);
}

.preview-body {
  max-width: 76%;
  margin: 0;
  font-size: clamp(12px, 1.7vw, 18px);
  line-height: 1.7;
  white-space: pre-wrap;
}

.preview-signature {
  display: grid;
  gap: 4px;
  min-width: 24%;
  margin-top: 7%;
  padding-top: 8px;
  border-top: 1px solid var(--preview-accent);
  font-size: clamp(11px, 1.5vw, 16px);
}

.generated-preview > small {
  position: absolute;
  right: 6%;
  bottom: 4%;
  left: 6%;
  color: #667789;
  font-size: clamp(8px, 1vw, 11px);
}

.certificate-background-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.uploaded-preview-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 12%;
  background: linear-gradient(135deg, #fff, #edf3f8);
  color: #667789;
  text-align: center;
}

.positioned-preview-field {
  position: absolute;
  z-index: 1;
  width: max-content;
  max-width: 90%;
  overflow: hidden;
  color: #172534;
  font-weight: 600;
  line-height: 1.1;
  white-space: nowrap;
  text-shadow: 0 1px 2px #fff, 0 0 4px #fff;
}

/* ================= Save footer ================= */
.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin: 28px -24px -24px;
  padding: 16px 24px;
  border-top: 1px solid var(--line);
  border-radius: 0 0 12px 12px;
  background: rgb(249 251 254 / 95%);
  backdrop-filter: blur(6px);
}

.settings-form .form-footer {
  position: sticky;
  bottom: 0;
  z-index: 4;
  box-shadow: 0 -10px 24px -18px rgb(17 44 73 / 55%);
}

.form-footer .muted {
  margin: 0;
}

/* ================= Signatories ================= */
/* the pad invites a signature: its dashed border breathes, and turns blue on hover */
.signature-pad {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 4px 0 10px;
  border: 2px dashed #b6c8de;
  border-radius: 10px;
  background:
    linear-gradient(transparent calc(100% - 38px), #cfdced calc(100% - 38px), #cfdced calc(100% - 37px), transparent calc(100% - 37px)),
    #fbfdff;
  touch-action: none;
  cursor: crosshair;
  animation: pad-wait 3.2s ease-in-out infinite;
  transition: border-color 0.25s ease, box-shadow 0.3s ease;
}

.signature-pad:hover {
  border-color: var(--blue);
  box-shadow: 0 12px 24px -18px rgb(38 95 148 / 55%);
  animation: none;
}

.signatory-form + .table-wrap {
  margin-top: 26px;
}

/* ================= Signing ================= */
.signing-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  gap: 22px;
  align-items: start;
  margin-top: 20px;
}

.preview {
  width: 100%;
  height: 650px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #f3f6fb;
  box-shadow: 0 16px 34px -22px rgb(17 44 73 / 60%);
  animation: paper-in 0.7s var(--ease) 0.15s both;
}

.preview-loading {
  display: grid;
  place-items: center;
  color: var(--muted);
}

.signing-side {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 16px;
}

.side-card {
  position: relative;
  display: grid;
  gap: 12px;
  padding: 20px 18px 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 26px -20px rgb(17 44 73 / 55%);
  animation: slide-right 0.6s var(--ease) both;
  transition: transform 0.3s var(--ease), box-shadow 0.3s ease;
}

.side-card.sign-actions { animation-delay: 0.25s; }
.side-card.reject-form { animation-delay: 0.38s; }

.side-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 20px 32px -22px rgb(17 44 73 / 60%);
}

.side-card h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--navy-deep);
  font-size: 17px;
}

.side-card h3::before {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 800;
}

.side-card .muted {
  margin: 0;
}

.side-card.sign-actions,
.side-card.reject-form {
  flex-direction: column;
  align-items: stretch;
  max-width: none;
  margin: 0;
}

.side-card.sign-actions {
  border-top: 3px solid var(--blue);
}

.side-card.sign-actions h3::before {
  content: '✓';
  background: #e1edfa;
  color: var(--blue);
  animation: ping-blue 2.6s ease-out 1s infinite;
}

.side-card.reject-form {
  border-top: 3px solid var(--danger);
}

.side-card.reject-form h3::before {
  content: '↩';
  background: #fdeceb;
  color: var(--danger);
}

.side-card .primary-button,
.side-card .danger-button {
  width: 100%;
}

/* ================= Verification: the result lands like a stamp ================= */
.verification-panel {
  border-left: 4px solid var(--blue);
  transform-origin: top center;
  animation: drawer-open 0.55s var(--ease) both;
}

.verification-result {
  position: relative;
  padding: 14px 16px 14px 62px;
  border-radius: 6px;
  font-weight: 700;
  overflow: hidden;
}

.verification-result::before {
  position: absolute;
  top: 50%;
  left: 16px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-top: -16px;
  border-radius: 50%;
  color: #fff;
  font-size: 17px;
  font-weight: 800;
}

.verification-result.valid {
  border-left: 3px solid var(--ok);
  background: #e3f4ea;
  color: #1f6b41;
  animation: stamp 0.6s var(--spring) both;
}

.verification-result.valid::before {
  content: '✓';
  background: var(--ok);
  animation: tick-pop 0.6s var(--spring) 0.2s both, ring-green 1.1s ease-out 0.3s 2;
}

/* a light wash crosses a valid result once */
.verification-result.valid::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -50%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 60%), transparent);
  transform: skewX(-20deg);
  animation: sheen 1.2s ease 0.3s both;
}

.verification-result.invalid {
  border-left: 3px solid var(--danger);
  background: #fdeceb;
  color: var(--danger);
  animation: shake 0.5s ease both;
}

.verification-result.invalid::before {
  content: '!';
  background: var(--danger);
  animation: tick-pop 0.5s var(--spring) 0.1s both, ring-red 1.1s ease-out 0.3s 2;
}

.verify-meta {
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

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.82);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes row-in {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes slide-left {
  from {
    opacity: 0;
    transform: translateX(-24px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes slide-right {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes number-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes tab-draw {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@keyframes drawer-open {
  from {
    opacity: 0;
    transform: scaleY(0.9) translateY(-12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* the sheet settles onto the page like paper being laid down */
@keyframes paper-in {
  from {
    opacity: 0;
    transform: translateY(18px) rotate(-1.2deg) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* an official stamp: lands big, then presses in */
@keyframes stamp {
  0% {
    opacity: 0;
    transform: scale(1.35) rotate(-3deg);
  }
  60% {
    opacity: 1;
    transform: scale(0.97) rotate(0.5deg);
  }
  100% {
    transform: none;
  }
}

@keyframes tick-pop {
  from {
    transform: scale(0) rotate(-40deg);
  }
  to {
    transform: none;
  }
}

@keyframes seal-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes sheen {
  from {
    left: -50%;
  }
  to {
    left: 130%;
  }
}

@keyframes pad-wait {
  0%,
  100% {
    border-color: #b6c8de;
  }
  50% {
    border-color: var(--sky);
  }
}

@keyframes marker-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgb(143 196 245 / 28%);
  }
  50% {
    box-shadow: 0 0 0 6px rgb(143 196 245 / 10%);
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

@keyframes ping-blue {
  0% {
    box-shadow: 0 0 0 0 rgb(38 95 148 / 40%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 9px rgb(38 95 148 / 0%);
  }
}

@keyframes ring-green {
  0% {
    box-shadow: 0 0 0 0 rgb(45 138 87 / 55%);
  }
  100% {
    box-shadow: 0 0 0 16px rgb(45 138 87 / 0%);
  }
}

@keyframes ring-red {
  0% {
    box-shadow: 0 0 0 0 rgb(180 40 31 / 50%);
  }
  100% {
    box-shadow: 0 0 0 16px rgb(180 40 31 / 0%);
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
@media (max-width: 1100px) {
  .template-layout,
  .signing-layout {
    grid-template-columns: 1fr;
  }

  .template-preview,
  .signing-side {
    position: static;
  }

  .template-preview,
  .side-card {
    animation-name: rise;
  }

  .form-grid.cols-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 850px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .layout-item {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .form-grid,
  .form-grid.cols-2,
  .form-grid.cols-3,
  .form-grid.cols-4,
  .inline-form {
    grid-template-columns: 1fr;
  }

  .wide {
    grid-column: auto;
  }

  .form-footer {
    flex-direction: column;
    align-items: stretch;
    margin: 24px -16px -16px;
    padding: 14px 16px;
  }

  .form-footer .actions {
    flex-direction: column;
    align-items: stretch;
  }

  .settings-form .panel::before,
  #sec-versions::before,
  #sec-signatories::before {
    left: 16px;
  }
}

@media (max-width: 560px) {
  .page-heading,
  .section-heading {
    flex-wrap: wrap;
  }

  .page-heading {
    padding: 22px 20px;
  }

  .page-heading::after {
    display: none;
  }

  .page-heading h1 {
    font-size: 26px;
  }

  .panel {
    padding: 16px;
  }

  .preview {
    height: 450px;
  }

  .verification-result {
    padding-left: 58px;
  }

  .search:focus {
    max-width: 100%;
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page-heading,
  .page-heading::after,
  .loading,
  .panel,
  .settings-form .panel::before,
  #sec-versions::before,
  #sec-signatories::before,
  .primary-button:disabled::after,
  .inline-error,
  .inline-success,
  tbody tr,
  .rejection-note,
  .count-badge,
  .pill,
  .stat,
  .stat strong,
  .jump-nav,
  .group,
  .group-title::before,
  .group-title::after,
  .layout-item,
  .template-preview,
  .edit-banner,
  .edit-banner::before,
  .certificate-preview-sheet,
  .certificate-preview-sheet:hover::after,
  .signature-pad,
  .preview,
  .side-card,
  .side-card.sign-actions h3::before,
  .verification-panel,
  .verification-result,
  .verification-result::before,
  .verification-result::after {
    animation: none;
  }

  .panel,
  .primary-button,
  .primary-button::before,
  .secondary-button,
  .danger-button,
  .text-button,
  .stat,
  .search,
  .jump-nav button,
  .jump-nav button::after,
  .form-grid input,
  .form-grid select,
  .form-grid textarea,
  .form-grid label,
  .checkbox,
  .layout-item,
  .certificate-preview-sheet,
  .signature-pad,
  .side-card,
  tbody tr {
    transition: none;
  }
}

/* =====================================================================
   Icons and extra polish (added layer)
   ===================================================================== */
.ico {
  flex: none;
  width: 1.15em;
  height: 1.15em;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.35s var(--spring);
}

/* buttons carry an icon next to the label */
.secondary-button,
.primary-button,
.danger-button,
.text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.text-button {
  gap: 6px;
}

.text-button .ico {
  width: 1em;
  height: 1em;
}

.primary-button .ico {
  position: relative;
  z-index: 1;
}

.primary-button:hover:not(:disabled) .ico {
  transform: translateX(2px) scale(1.14);
}

.secondary-button:hover:not(:disabled) .ico,
.danger-button:hover:not(:disabled) .ico,
.text-button:hover:not(:disabled) .ico {
  transform: scale(1.2) rotate(-8deg);
}

.text-button.approve:hover .ico {
  transform: scale(1.3) rotate(0deg);
}

.text-button.danger:hover .ico {
  animation: ico-shake 0.4s ease both;
}

/* refresh icon spins while data loads */
.spin .ico {
  animation: ico-spin 0.9s linear infinite;
}

/* heading icons */
.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.eyebrow .ico {
  width: 15px;
  height: 15px;
  animation: ico-float 3.2s ease-in-out infinite;
}

.section-heading h2 {
  display: flex;
  align-items: center;
  gap: 12px;
}

.h-ico {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, #e9f2fc, #d3e5f8);
  box-shadow: inset 0 0 0 1px rgb(38 95 148 / 14%);
  color: var(--blue);
  transition: transform 0.4s var(--spring), background 0.3s ease;
}

.h-ico .ico {
  width: 20px;
  height: 20px;
}

.panel:hover .h-ico {
  transform: rotate(-6deg) scale(1.07);
  background: linear-gradient(135deg, #dcecfb, #bfdaf5);
}

/* messages */
.inline-error,
.inline-success {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.inline-error .ico,
.inline-success .ico {
  width: 18px;
  height: 18px;
  margin-top: 2px;
}

.inline-success .ico {
  animation: tick-pop 0.6s var(--spring) both;
}

/* loading */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #d3e0f0;
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: ico-spin 0.8s linear infinite;
}

/* stat cards get a coloured icon tile */
.stat {
  padding-right: 66px;
}

.stat-ico {
  position: absolute;
  top: 16px;
  right: 16px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #e8f1fb;
  color: var(--blue);
  font-style: normal;
  transition: transform 0.4s var(--spring);
}

.stat-ico .ico {
  width: 21px;
  height: 21px;
  animation: ico-float 3.2s ease-in-out infinite;
}

.stat:nth-child(4n + 2) .stat-ico { background: #e6f3fd; color: #2f7db8; }
.stat:nth-child(4n + 3) .stat-ico { background: #fbf0d3; color: #a86f00; }
.stat:nth-child(4n) .stat-ico { background: #e3f4ea; color: var(--ok); }
.stat:nth-child(2) .stat-ico .ico { animation-delay: 0.3s; }
.stat:nth-child(3) .stat-ico .ico { animation-delay: 0.6s; }
.stat:nth-child(4) .stat-ico .ico { animation-delay: 0.9s; }

.stat:hover .stat-ico {
  transform: translateY(-3px) rotate(-8deg) scale(1.1);
}

/* search field icon (specificity beats the :focus background shorthand) */
.page .search:not(:disabled) {
  padding-left: 38px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d6f82' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M21 21l-4.3-4.3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 12px center;
  background-size: 18px;
}

/* jump navigation */
.jump-nav button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.jump-nav button:hover .ico {
  transform: translateY(-2px) scale(1.15);
}

/* count badges */
.count-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.count-badge .ico {
  width: 14px;
  height: 14px;
}

/* attendance progress bar */
.meter-cell {
  display: grid;
  gap: 5px;
  min-width: 72px;
}

.meter {
  display: block;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #e3ebf6;
}

.meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--blue), var(--sky));
  transform-origin: left;
  animation: meter-grow 0.9s var(--ease) 0.2s both;
}

/* empty states */
td.empty .ico {
  display: block;
  width: 36px;
  height: 36px;
  margin: 0 auto 8px;
  color: #a9bbd0;
  animation: ico-float 3.2s ease-in-out infinite;
}

/* extra keyframes */
@keyframes ico-spin {
  to { transform: rotate(360deg); }
}

@keyframes ico-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes ico-shake {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-14deg) scale(1.2); }
  75% { transform: rotate(14deg) scale(1.2); }
}

@keyframes meter-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

@media (prefers-reduced-motion: reduce) {
  .spin .ico,
  .spinner,
  .eyebrow .ico,
  .stat-ico .ico,
  td.empty .ico,
  .meter i,
  .inline-success .ico,
  .text-button.danger:hover .ico {
    animation: none;
  }

  .ico,
  .h-ico,
  .stat-ico {
    transition: none;
  }
}

</style>
