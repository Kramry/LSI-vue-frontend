<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiGet, apiPost } from '../services/api'

interface Row { [key: string]: string | number | null }
interface Field { name: string; label: string; type?: string; required?: boolean; values?: string[]; choices?: Array<{ id: number | string; label: string }> }
interface ModuleData { records: Row[]; fields: Field[]; can_create: boolean; can_manage: boolean }
interface HistoryItem { id: number; title: string; trainee_name: string; recipient: string; channel: string; status: string; error_message: string | null; sent_at: string | null; created_at: string }
interface HistoryData { history: HistoryItem[]; settings: { sms_enabled: boolean; email_enabled: boolean; ready?: boolean }; ready: boolean; missing_tables?: string[] }

const announcements = ref<ModuleData | null>(null)
const trainees = ref<Row[]>([])
const classes = ref<Row[]>([])
const history = ref<HistoryItem[]>([])
const settings = ref({ sms_enabled: false, email_enabled: false })
const notificationReady = ref(true)
const missingTables = ref<string[]>([])
const role = ref('')
const error = ref('')
const notice = ref('')
const loading = ref(true)
const saving = ref(false)
const sending = ref(false)
const editingId = ref<number | null>(null)
const formOpen = ref(false)
const form = ref<Record<string, string>>({})
const recipientMode = ref('all')
const classId = ref('')
const traineeIds = ref<string[]>([])
const channels = ref<string[]>(['email'])
const historyChannel = ref('')
const historyStatus = ref('')
const testChannel = ref('email')
const testRecipient = ref('')

const published = computed(() => (announcements.value?.records || []).filter((item) => item.status === 'published'))
const filteredHistory = computed(() => history.value.filter((item) =>
  (!historyChannel.value || item.channel === historyChannel.value) &&
  (!historyStatus.value || item.status === historyStatus.value)
))
const estimatedRecipients = computed(() => {
  if (recipientMode.value === 'selected') return traineeIds.value.length
  if (recipientMode.value === 'batch') return classes.value.find((item) => String(item.class_id) === classId.value)?.enrolled_count || 0
  return trainees.value.length
})

function blankForm() {
  form.value = {}
  for (const field of announcements.value?.fields || []) form.value[field.name] = field.name === 'status' ? 'draft' : field.name === 'category' ? 'General' : ''
}
function startCreate() { editingId.value = null; formOpen.value = true; blankForm() }
function startEdit(item: Row) {
  editingId.value = Number(item.announcement_id)
  formOpen.value = true
  blankForm()
  for (const field of announcements.value?.fields || []) form.value[field.name] = item[field.name] == null ? '' : String(item[field.name])
}
function cancel() { formOpen.value = false; editingId.value = null }

async function load() {
  loading.value = true
  error.value = ''
  try {
    const session = await apiGet<{ user: { role: string } }>('/session')
    role.value = session.data.user.role
    const moduleResponse = await apiGet<ModuleData>('/modules/announcements')
    announcements.value = moduleResponse.data
    if (role.value === 'administrator' || role.value === 'staff') {
      const [traineeResponse, classResponse, historyResponse] = await Promise.all([
        apiGet<{ records: Row[] }>('/modules/trainees'),
        apiGet<{ records: Row[] }>('/modules/classes'),
        apiGet<HistoryData>('/notifications/history')
      ])
      trainees.value = traineeResponse.data.records || []
      classes.value = classResponse.data.records || []
      history.value = historyResponse.data.history || []
      settings.value = historyResponse.data.settings
      notificationReady.value = historyResponse.data.ready
      missingTables.value = historyResponse.data.missing_tables || []
    }
    if (!formOpen.value) blankForm()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load announcements.'
  } finally { loading.value = false }
}
async function save() {
  saving.value = true; error.value = ''
  try {
    const body = { ...form.value, ...(editingId.value ? { announcement_id: editingId.value } : {}) }
    await apiPost('/modules/announcements/save', body)
    notice.value = 'Announcement saved.'
    cancel(); await load()
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to save announcement.' }
  finally { saving.value = false }
}
async function remove(item: Row) {
  if (!window.confirm('Delete this announcement?')) return
  try { await apiPost(`/modules/announcements/delete/${item.announcement_id}`, {}); await load() }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to delete announcement.' }
}
async function send() {
  const item = published.value.find((candidate) => String(candidate.announcement_id) === String(form.value.send_announcement_id)) || published.value[0]
  if (!item || !channels.value.length) { error.value = 'Publish an announcement and select a channel.'; return }
  if (!window.confirm(`Send this announcement to approximately ${estimatedRecipients.value} trainees?`)) return
  sending.value = true; error.value = ''
  try {
    const response = await apiPost('/notifications/send', { announcement_id: item.announcement_id, recipient_mode: recipientMode.value, class_id: classId.value, trainee_ids: traineeIds.value, channels: channels.value })
    notice.value = response.message || 'Notifications processed.'
    await load()
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to send notifications.' }
  finally { sending.value = false }
}
async function retry(id: number) {
  try { await apiPost(`/notifications/${id}/retry`, {}); await load() }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to retry notification.' }
}
async function saveSettings() {
  try { await apiPost('/notifications/settings', settings.value); notice.value = 'Notification settings saved.' }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to save settings.' }
}
async function testProvider() {
  try { await apiPost('/notifications/test', { channel: testChannel.value, recipient: testRecipient.value }); notice.value = 'Provider accepted the test notification.' }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Provider test failed.' }
}
onMounted(load)
</script>

<template>
  <main class="announcements-page">
    <header class="page-header"><div><p class="eyebrow">SMARTTRACK / COMMUNICATIONS</p><h1>Announcements</h1><p class="lead">Publish updates and notify registered trainees.</p></div><div class="actions"><button v-if="announcements?.can_create" class="primary-button" @click="startCreate">+ New announcement</button><button class="secondary-button" :disabled="loading" @click="load">Refresh</button></div></header>
    <p v-if="error" class="message error" role="alert">{{ error }}</p><p v-if="notice" class="message success" role="status">{{ notice }}</p><p v-if="(role === 'administrator' || role === 'staff') && !notificationReady" class="message warning" role="status">Missing table(s): {{ missingTables.join(', ') || 'unknown' }}. Run announcement_notifications.sql against database <strong>lsi-smart-track</strong>, then refresh.</p>
    <section v-if="formOpen" class="panel"><div class="section-heading"><h2>{{ editingId ? 'Edit announcement' : 'Create announcement' }}</h2><button class="text-button" @click="cancel">Close</button></div><form class="form-grid" @submit.prevent="save"><label>Title<input v-model.trim="form.title" required></label><label>Category<select v-model="form.category"><option v-for="value in ['General','Training Schedule','Training Updates','Requirements','Important Notice']" :key="value">{{ value }}</option></select></label><label class="wide">Description<textarea v-model.trim="form.content" rows="5" required></textarea></label><label>Attachment URL<input v-model.trim="form.attachment" type="url" placeholder="https://..."></label><label>Publication date/time<input v-model="form.published_at" type="datetime-local"></label><label>Status<select v-model="form.status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><div class="wide form-actions"><button class="primary-button" :disabled="saving">{{ saving ? 'Saving…' : 'Save announcement' }}</button><button type="button" class="secondary-button" @click="cancel">Cancel</button></div></form></section>
    <div class="content-grid">
      <section class="panel"><div class="section-heading"><div><h2>Announcement records</h2><p class="muted">Only published announcements can trigger notifications.</p></div></div><div class="table-wrap"><table><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Published</th><th>Actions</th></tr></thead><tbody><tr v-for="item in announcements?.records || []" :key="String(item.announcement_id)"><td><strong>{{ item.title }}</strong><small>{{ item.content }}</small></td><td>{{ item.category || 'General' }}</td><td>{{ item.status }}</td><td>{{ item.published_at || '—' }}</td><td><button class="text-button" @click="startEdit(item)">Edit</button><button class="text-button danger" @click="remove(item)">Delete</button></td></tr><tr v-if="!announcements?.records?.length"><td colspan="5" class="empty">No announcements yet.</td></tr></tbody></table></div></section>
      <section v-if="role === 'administrator'" class="panel"><h2>Send notifications</h2><p class="muted">Choose a published announcement and recipients.</p><label>Announcement<select v-model="form.send_announcement_id"><option v-for="item in published" :key="String(item.announcement_id)" :value="String(item.announcement_id)">{{ item.title }}</option></select></label><label>Recipients<select v-model="recipientMode"><option value="all">All registered trainees</option><option value="batch">Specific training batch</option><option value="selected">Selected trainees</option></select></label><label v-if="recipientMode === 'batch'">Training batch<select v-model="classId"><option value="">Choose batch</option><option v-for="item in classes" :key="String(item.class_id)" :value="String(item.class_id)">{{ item.class_name }}</option></select></label><label v-if="recipientMode === 'selected'">Trainees<select v-model="traineeIds" multiple><option v-for="item in trainees" :key="String(item.trainee_id)" :value="String(item.trainee_id)">{{ item.first_name }} {{ item.last_name }}</option></select></label><div class="channel-row"><label><input v-model="channels" type="checkbox" value="sms"> SMS <small v-if="!settings.sms_enabled">(disabled)</small></label><label><input v-model="channels" type="checkbox" value="email"> Email <small v-if="!settings.email_enabled">(disabled)</small></label></div><p class="recipient-count">{{ estimatedRecipients }} recipient(s) selected</p><button class="primary-button" :disabled="sending || !published.length" @click="send">{{ sending ? 'Sending…' : 'Confirm and send' }}</button></section>
    </div>
    <section v-if="role === 'administrator'" class="panel"><h2>Notification settings</h2><div class="settings-grid"><label><input v-model="settings.sms_enabled" type="checkbox"> Enable Semaphore SMS</label><label><input v-model="settings.email_enabled" type="checkbox"> Enable Brevo email</label><button class="secondary-button" @click="saveSettings">Save settings</button></div><div class="test-row"><select v-model="testChannel"><option value="email">Email</option><option value="sms">SMS</option></select><input v-model.trim="testRecipient" placeholder="Test email or Philippine mobile number"><button class="secondary-button" @click="testProvider">Send test</button></div></section>
    <section v-if="role === 'administrator' || role === 'staff'" class="panel"><div class="section-heading"><h2>Notification history</h2><div class="filters"><select v-model="historyChannel"><option value="">All channels</option><option value="sms">SMS</option><option value="email">Email</option></select><select v-model="historyStatus"><option value="">All statuses</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="pending">Pending</option></select></div></div><div class="table-wrap"><table><thead><tr><th>Announcement</th><th>Recipient</th><th>Channel</th><th>Status</th><th>Sent</th><th>Action</th></tr></thead><tbody><tr v-for="item in filteredHistory" :key="item.id"><td>{{ item.title }}</td><td>{{ item.trainee_name }}<small>{{ item.recipient }}</small></td><td>{{ item.channel }}</td><td>{{ item.status }}<small v-if="item.error_message" class="danger">{{ item.error_message }}</small></td><td>{{ item.sent_at || '—' }}</td><td><button v-if="item.status === 'failed' && role === 'administrator'" class="text-button" @click="retry(item.id)">Retry</button></td></tr><tr v-if="!filteredHistory.length"><td colspan="6" class="empty">No notification history.</td></tr></tbody></table></div></section>
  </main>
</template>

<style scoped>
.announcements-page{--navy:#173a60;--blue:#265f94;--sky:#8fc4f5;--muted:#5d6f82;display:grid;gap:20px;max-width:1400px;margin:0 auto;color:#1b2a3a;font-family:'DM Sans','Segoe UI',system-ui,sans-serif}.page-header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:26px 28px;border-radius:14px;color:#fff;background:var(--navy)}.page-header h1{margin:0;color:#fff;font:600 32px 'Fraunces',Georgia,serif}.eyebrow{margin:0 0 8px;color:var(--sky);font-size:12px;font-weight:700;letter-spacing:.14em}.lead{margin:6px 0;color:#fffc}.actions,.section-heading,.filters,.test-row,.settings-grid,.channel-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.content-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:20px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.form-grid .wide{grid-column:1/-1}.form-grid label,.panel>label,.test-row{display:grid;gap:6px;font-size:13px;font-weight:700}.form-grid input,.form-grid select,.form-grid textarea,.panel>label input,.panel>label select,.panel>label textarea,.test-row input,.test-row select{width:100%;padding:10px 12px;border:1px solid #d5dfeb;border-radius:8px;background:#eef4fc;font:inherit}.panel>label{margin-top:13px}.channel-row{margin:16px 0}.channel-row label,.settings-grid label{font-size:13px}.channel-row small{color:#a46b00}.recipient-count{padding:10px;border-radius:8px;color:var(--blue);background:#edf4fd;font-weight:700}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th{background:#eaf1fb;color:var(--navy);font-size:11px;text-align:left}th,td{padding:11px;border-bottom:1px solid #e1e8f1;vertical-align:top}td small{display:block;max-width:280px;margin-top:4px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.primary-button,.secondary-button{padding:10px 14px;border:0;border-radius:8px;font-weight:700;cursor:pointer;text-decoration:none}.primary-button{color:#fff;background:var(--blue)}.secondary-button{color:#112c49;background:#e3ebf6}.text-button{margin-right:8px;padding:0;border:0;color:var(--blue);background:none;font-weight:700;cursor:pointer}.danger{color:#b4281f}.empty{text-align:center;color:var(--muted)}.message{padding:12px;border-radius:8px}.message.error{color:#9e2922;background:#fff0ef}.message.success{color:#1d6b3b;background:#effaf2}.message.warning{color:#785918;background:#fff8df}@media(max-width:900px){.content-grid{grid-template-columns:1fr}}@media(max-width:600px){.page-header{display:grid}.form-grid{grid-template-columns:1fr}.form-grid .wide{grid-column:auto}}
</style>
