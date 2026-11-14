<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiGet, apiPost } from '../services/api'

interface Row { [key: string]: string | number | null }
interface Field { name: string; label: string; type?: string; required?: boolean; values?: string[]; choices?: Array<{ id: number | string; label: string }> }
interface ModuleData { records: Row[]; fields: Field[]; can_create: boolean; can_manage: boolean }
interface HistoryItem { id: number; title: string; trainee_name: string; recipient: string; channel: string; status: string; error_message: string | null; sent_at: string | null; created_at: string }
interface HistoryData { history: HistoryItem[]; settings: { email_enabled: boolean; ready?: boolean }; ready: boolean; missing_tables?: string[] }

const announcements = ref<ModuleData | null>(null)
const trainees = ref<Row[]>([])
const classes = ref<Row[]>([])
const history = ref<HistoryItem[]>([])
const settings = ref({ email_enabled: false })
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
async function removeNotification(id: number) {
  if (!window.confirm('Delete this notification history record?')) return
  try {
    await apiPost(`/notifications/${id}/delete`, {})
    notice.value = 'Notification history record deleted.'
    await load()
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to delete notification history record.' }
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
    <!-- Icon sprite: one definition, reused everywhere with <use> -->
    <svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="an-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="an-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></symbol>
        <symbol id="an-megaphone" viewBox="0 0 24 24"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></symbol>
        <symbol id="an-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
        <symbol id="an-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></symbol>
        <symbol id="an-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></symbol>
        <symbol id="an-send" viewBox="0 0 24 24"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" /></symbol>
        <symbol id="an-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3.5 7l8.5 6 8.5-6" /></symbol>
        <symbol id="an-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" /><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="17" cy="9" r="2.4" /><path d="M17 14c2.5 0 4.5 1.7 4.5 4.5" /></symbol>
        <symbol id="an-sliders" viewBox="0 0 24 24"><path d="M4 7h8M18 7h2M4 17h2M12 17h8" /><circle cx="15" cy="7" r="2.2" /><circle cx="9" cy="17" r="2.2" /></symbol>
        <symbol id="an-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></symbol>
        <symbol id="an-bell" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" /><path d="M10 21h4" /></symbol>
        <symbol id="an-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></symbol>
        <symbol id="an-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></symbol>
        <symbol id="an-warning" viewBox="0 0 24 24"><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4M12 17.5v.01" /></symbol>
        <symbol id="an-list" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></symbol>
        <symbol id="an-batch" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></symbol>
        <symbol id="an-pick" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></symbol>
      </defs>
    </svg>

    <!-- ============ Header ============ -->
    <header class="page-header">
      <div class="title-block">
        <p class="eyebrow"><svg class="ico"><use href="#an-megaphone" /></svg>SMARTTRACK / COMMUNICATIONS</p>
        <h1>Announcements</h1>
        <p class="lead">Publish updates and notify registered trainees.</p>
      </div>
      <div class="actions">
        <button v-if="announcements?.can_create" class="primary-button" @click="startCreate">
          <svg class="ico"><use href="#an-plus" /></svg>New announcement
        </button>
        <button class="secondary-button" :disabled="loading" @click="load">
          <svg class="ico" :class="{ spinning: loading }"><use href="#an-refresh" /></svg>Refresh
        </button>
      </div>
    </header>

    <!-- ============ Messages ============ -->
    <p v-if="error" class="message error" role="alert"><svg class="ico"><use href="#an-alert" /></svg><span>{{ error }}</span></p>
    <p v-if="notice" class="message success" role="status"><svg class="ico"><use href="#an-check" /></svg><span>{{ notice }}</span></p>
    <p v-if="(role === 'administrator' || role === 'staff') && !notificationReady" class="message warning" role="status"><svg class="ico"><use href="#an-warning" /></svg><span>Missing table(s): {{ missingTables.join(', ') || 'unknown' }}. Run announcement_notifications.sql against database <strong>lsi-smart-track</strong>, then refresh.</span></p>

    <!-- ============ Overview strip ============ -->
    <section class="stats" aria-label="Overview">
      <article class="stat" style="--tone: #2a6aa8; --tone-rgb: 42 106 168">
        <span class="stat-icon"><svg class="ico"><use href="#an-list" /></svg></span>
        <div><p>Announcements</p><strong>{{ announcements?.records?.length ?? 0 }}</strong></div>
      </article>
      <article class="stat" style="--tone: #2d8a57; --tone-rgb: 45 138 87">
        <span class="stat-icon"><svg class="ico"><use href="#an-check" /></svg></span>
        <div><p>Published</p><strong>{{ published?.length ?? 0 }}</strong></div>
      </article>
      <article v-if="role === 'administrator' || role === 'staff'" class="stat" style="--tone: #c98a00; --tone-rgb: 201 138 0">
        <span class="stat-icon"><svg class="ico"><use href="#an-bell" /></svg></span>
        <div><p>Notifications shown</p><strong>{{ filteredHistory?.length ?? 0 }}</strong></div>
      </article>
    </section>

    <!-- ============ Create / edit form ============ -->
    <Transition name="panel">
      <section v-if="formOpen" class="panel form-panel">
        <div class="section-heading">
          <h2><svg class="ico"><use href="#an-edit" /></svg>{{ editingId ? 'Edit announcement' : 'Create announcement' }}</h2>
          <button class="icon-button" type="button" aria-label="Close" @click="cancel"><svg class="ico"><use href="#an-close" /></svg>Close</button>
        </div>
        <form class="form-grid" @submit.prevent="save">
          <label class="field"><span class="label-text">Title</span><input v-model.trim="form.title" required></label>
          <label class="field"><span class="label-text">Category</span><select v-model="form.category"><option v-for="value in ['General','Training Schedule','Training Updates','Requirements','Important Notice']" :key="value">{{ value }}</option></select></label>
          <label class="field wide"><span class="label-text">Description</span><textarea v-model.trim="form.content" rows="5" required></textarea></label>
          <label class="field"><span class="label-text">Attachment URL</span><input v-model.trim="form.attachment" type="url" placeholder="https://..."></label>
          <label class="field"><span class="label-text">Publication date/time</span><input v-model="form.published_at" type="datetime-local"></label>
          <label class="field"><span class="label-text">Status</span><select v-model="form.status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
          <div class="wide form-actions">
            <button class="primary-button" :disabled="saving">{{ saving ? 'Saving…' : 'Save announcement' }}</button>
            <button type="button" class="secondary-button dark" @click="cancel">Cancel</button>
          </div>
        </form>
      </section>
    </Transition>

    <!-- ============ Main layout ============ -->
    <div class="content-grid" :class="{ single: role !== 'administrator' }">
      <!-- Left: what exists -->
      <div class="main-col">
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2><svg class="ico"><use href="#an-list" /></svg>Announcement records</h2>
              <p class="muted">Only published announcements can trigger notifications.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Published</th><th>Actions</th></tr></thead>
              <TransitionGroup name="row" tag="tbody">
                <tr v-for="item in announcements?.records || []" :key="String(item.announcement_id)">
                  <td data-label="Title"><strong>{{ item.title }}</strong><small>{{ item.content }}</small></td>
                  <td data-label="Category"><span class="chip">{{ item.category || 'General' }}</span></td>
                  <td data-label="Status"><span class="pill" :class="String(item.status ?? '')">{{ item.status }}</span></td>
                  <td data-label="Published"><span class="when"><svg class="ico"><use href="#an-clock" /></svg>{{ item.published_at || '—' }}</span></td>
                  <td data-label="Actions">
                    <div class="cell-actions">
                      <button class="text-button" @click="startEdit(item)"><svg class="ico"><use href="#an-edit" /></svg>Edit</button>
                      <button class="text-button danger" @click="remove(item)"><svg class="ico"><use href="#an-trash" /></svg>Delete</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!announcements?.records?.length" key="empty"><td colspan="5" class="empty"><svg class="ico big"><use href="#an-megaphone" /></svg>No announcements yet.</td></tr>
              </TransitionGroup>
            </table>
          </div>
        </section>

        <section v-if="role === 'administrator' || role === 'staff'" class="panel">
          <div class="section-heading">
            <h2><svg class="ico"><use href="#an-clock" /></svg>Notification history</h2>
            <div class="filters">
              <select v-model="historyChannel"><option value="">All channels</option><option value="email">Email</option></select>
              <select v-model="historyStatus"><option value="">All statuses</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="pending">Pending</option></select>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Announcement</th><th>Recipient</th><th>Channel</th><th>Status</th><th>Sent</th><th>Action</th></tr></thead>
              <TransitionGroup name="row" tag="tbody">
                <tr v-for="item in filteredHistory" :key="item.id">
                  <td data-label="Announcement"><strong>{{ item.title }}</strong></td>
                  <td data-label="Recipient">{{ item.trainee_name }}<small>{{ item.recipient }}</small></td>
                  <td data-label="Channel"><span class="chip"><svg class="ico"><use href="#an-mail" /></svg>{{ item.channel }}</span></td>
                  <td data-label="Status"><span class="pill" :class="String(item.status ?? '')">{{ item.status }}</span><small v-if="item.error_message" class="danger">{{ item.error_message }}</small></td>
                  <td data-label="Sent"><span class="when"><svg class="ico"><use href="#an-clock" /></svg>{{ item.sent_at || '—' }}</span></td>
                  <td data-label="Action">
                    <div class="cell-actions">
                      <button v-if="item.status === 'failed' && role === 'administrator'" class="text-button" @click="retry(item.id)"><svg class="ico"><use href="#an-refresh" /></svg>Retry</button>
                      <button v-if="role === 'administrator'" class="text-button danger" @click="removeNotification(item.id)"><svg class="ico"><use href="#an-trash" /></svg>Delete</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!filteredHistory.length" key="empty"><td colspan="6" class="empty"><svg class="ico big"><use href="#an-bell" /></svg>No notification history.</td></tr>
              </TransitionGroup>
            </table>
          </div>
        </section>
      </div>

      <!-- Right: what you can do (administrator only) -->
      <aside v-if="role === 'administrator'" class="side-col">
        <section class="panel send-panel">
          <h2><svg class="ico"><use href="#an-send" /></svg>Send email notifications</h2>
          <p class="muted">Choose a published announcement and recipients.</p>

          <div class="step">
            <span class="step-num">1</span>
            <label class="field"><span class="label-text">Announcement</span>
              <select v-model="form.send_announcement_id"><option v-for="item in published" :key="String(item.announcement_id)" :value="String(item.announcement_id)">{{ item.title }}</option></select>
            </label>
          </div>

          <div class="step">
            <span class="step-num">2</span>
            <div class="field">
              <span class="label-text">Recipients</span>
              <div class="choices" role="radiogroup" aria-label="Recipients">
                <label class="choice"><input v-model="recipientMode" type="radio" value="all"><span><svg class="ico"><use href="#an-users" /></svg>All registered trainees</span></label>
                <label class="choice"><input v-model="recipientMode" type="radio" value="batch"><span><svg class="ico"><use href="#an-batch" /></svg>Specific training batch</span></label>
                <label class="choice"><input v-model="recipientMode" type="radio" value="selected"><span><svg class="ico"><use href="#an-pick" /></svg>Selected trainees</span></label>
              </div>
              <label v-if="recipientMode === 'batch'" class="field nested"><span class="label-text">Training batch</span>
                <select v-model="classId"><option value="">Choose batch</option><option v-for="item in classes" :key="String(item.class_id)" :value="String(item.class_id)">{{ item.class_name }}</option></select>
              </label>
              <label v-if="recipientMode === 'selected'" class="field nested"><span class="label-text">Trainees</span>
                <select v-model="traineeIds" multiple><option v-for="item in trainees" :key="String(item.trainee_id)" :value="String(item.trainee_id)">{{ item.first_name }} {{ item.last_name }}</option></select>
              </label>
            </div>
          </div>

          <div class="step">
            <span class="step-num">3</span>
            <div class="channel-row">
              <label class="chip toggle"><input v-model="channels" type="checkbox" value="email"><span><svg class="ico"><use href="#an-mail" /></svg>Email <small v-if="!settings.email_enabled">(disabled)</small></span></label>
            </div>
          </div>

          <p class="recipient-count"><svg class="ico"><use href="#an-users" /></svg><strong>{{ estimatedRecipients }}</strong> recipient(s) selected</p>
          <button class="primary-button full send-button" :disabled="sending || !published.length" @click="send">
            <svg class="ico"><use href="#an-send" /></svg>{{ sending ? 'Sending…' : 'Confirm and send' }}
          </button>
        </section>

        <section class="panel">
          <h2><svg class="ico"><use href="#an-sliders" /></svg>Notification settings</h2>
          <div class="settings-grid">
            <label class="switch-row"><input v-model="settings.email_enabled" class="switch" type="checkbox"><span>Enable Brevo email</span></label>
            <button class="secondary-button dark" @click="saveSettings">Save settings</button>
          </div>
          <div class="test-row">
            <input v-model.trim="testRecipient" placeholder="Test email address">
            <button class="secondary-button dark" @click="testProvider"><svg class="ico"><use href="#an-send" /></svg>Send test email</button>
          </div>
        </section>
      </aside>
    </div>
  </main>
</template>

<style scoped>
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.announcements-page {
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

/* ---------- Icons ---------- */
.sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.ico {
  flex: none;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ico.big {
  width: 34px;
  height: 34px;
  margin-bottom: 8px;
  opacity: 0.55;
}

.ico.spinning {
  animation: spin 0.8s linear infinite;
}

/* ---------- Header ---------- */
.page-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 30px 32px;
  border-radius: 20px;
  color: #fff;
  overflow: hidden;
  isolation: isolate;
  background:
    var(--grain),
    radial-gradient(40% 90% at 8% 0%, rgb(143 196 245 / 34%), transparent 70%),
    radial-gradient(30% 80% at 60% 120%, rgb(232 201 138 / 14%), transparent 70%),
    radial-gradient(45% 100% at 100% 60%, rgb(42 106 168 / 65%), transparent 72%),
    linear-gradient(120deg, #1d4a79 0%, var(--navy) 40%, var(--navy-deep) 100%);
  background-size: 180px 180px, auto, auto, auto, auto;
  background-blend-mode: soft-light, normal, normal, normal, normal;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%), 0 24px 40px -28px rgb(8 23 39 / 80%);
  animation: drop-in 0.7s var(--ease) both;
}

.page-header::before {
  content: '';
  position: absolute;
  top: 50%;
  right: -8%;
  z-index: -1;
  width: 520px;
  aspect-ratio: 1;
  translate: 0 -50%;
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle at center, transparent 0 46px, rgb(255 255 255 / 8%) 46px 47px),
    conic-gradient(from var(--angle), transparent 0deg, rgb(143 196 245 / 26%) 40deg, transparent 90deg, transparent 210deg, rgb(232 201 138 / 16%) 250deg, transparent 300deg);
  -webkit-mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  mask-image: radial-gradient(circle at center, transparent 6%, #000 28%, transparent 66%);
  animation: orbit 40s linear infinite;
  pointer-events: none;
}

.page-header h1 {
  margin: 0;
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-size: clamp(1.9rem, 3vw, 2.5rem);
  font-weight: 500;
  font-variation-settings: 'opsz' 120, 'SOFT' 50;
  letter-spacing: -0.025em;
  line-height: 1.05;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  padding: 5px 12px 5px 10px;
  border-radius: 999px;
  background: rgb(143 196 245 / 12%);
  box-shadow: inset 0 0 0 1px rgb(143 196 245 / 35%);
  color: var(--sky);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.eyebrow .ico {
  width: 15px;
  height: 15px;
  animation: ring 4s ease-in-out 1.2s infinite;
  transform-origin: 70% 60%;
}

.lead {
  margin: 10px 0 0;
  color: rgb(255 255 255 / 78%);
  font-size: 15px;
}

.actions,
.section-heading,
.filters,
.test-row,
.settings-grid,
.channel-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.section-heading {
  justify-content: space-between;
  margin-bottom: 16px;
}

/* ---------- Messages ---------- */
.message {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 13px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  animation: slide-down 0.45s var(--ease) both;
}

.message .ico {
  margin-top: 1px;
}

.message.error {
  border-left: 3px solid var(--danger);
  color: #9e2922;
  background: linear-gradient(90deg, #fdeceb, #fff6f5);
  animation: slide-down 0.45s var(--ease) both, shake 0.45s ease 0.2s both;
}

.message.success {
  border-left: 3px solid var(--ok);
  color: #1d6b3b;
  background: linear-gradient(90deg, #e8f7ee, #f4fbf6);
}

.message.warning {
  border-left: 3px solid var(--warn);
  color: #785918;
  background: linear-gradient(90deg, #fff3cf, #fffaea);
}

/* ---------- Overview strip ---------- */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}

.stat {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background:
    radial-gradient(120% 90% at 100% 0%, rgb(var(--tone-rgb) / 9%), transparent 60%),
    linear-gradient(180deg, #fff, #fbfcfe);
  overflow: hidden;
  animation: pop-in 0.6s var(--spring) both;
  transition: transform 0.3s var(--ease), box-shadow 0.3s ease, border-color 0.3s ease;
}

.stat:nth-child(2) { animation-delay: 0.07s; }
.stat:nth-child(3) { animation-delay: 0.14s; }

.stat:hover {
  border-color: rgb(var(--tone-rgb) / 35%);
  transform: translateY(-3px);
  box-shadow: 0 20px 30px -22px rgb(var(--tone-rgb) / 60%);
}

.stat-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: rgb(var(--tone-rgb) / 12%);
  box-shadow: inset 0 0 0 1px rgb(var(--tone-rgb) / 22%);
  color: var(--tone);
  transition: transform 0.4s var(--spring), background 0.3s ease, color 0.3s ease;
}

.stat-icon .ico {
  width: 22px;
  height: 22px;
}

.stat:hover .stat-icon {
  background: var(--tone);
  color: #fff;
  transform: rotate(-6deg) scale(1.08);
}

.stat p {
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.stat strong {
  display: block;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 30px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.02em;
}

/* ---------- Layout ---------- */
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.content-grid.single {
  grid-template-columns: minmax(0, 1fr);
}

.main-col,
.side-col {
  display: grid;
  gap: 20px;
  min-width: 0;
}

.side-col {
  position: sticky;
  top: 16px;
}

.panel {
  position: relative;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #fcfdff);
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 14px 30px -22px rgb(17 44 73 / 40%);
  transition: box-shadow 0.35s ease, border-color 0.35s ease;
  animation: rise 0.7s var(--ease) both;
}

.main-col > .panel:nth-child(1),
.side-col > .panel:nth-child(1) { animation-delay: 0.15s; }
.main-col > .panel:nth-child(2),
.side-col > .panel:nth-child(2) { animation-delay: 0.27s; }

.panel:hover {
  border-color: #d3deec;
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 24px 40px -24px rgb(17 44 73 / 48%);
}

.panel h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 21px;
  font-weight: 600;
  font-variation-settings: 'opsz' 48, 'SOFT' 40;
  letter-spacing: -0.015em;
}

.panel h2 .ico {
  width: 22px;
  height: 22px;
  padding: 4px;
  box-sizing: content-box;
  border-radius: 9px;
  background: rgb(42 106 168 / 10%);
  color: var(--blue);
}

.muted {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

/* ---------- Form panel ---------- */
.form-panel {
  border-color: rgb(42 106 168 / 30%);
  box-shadow: 0 0 0 4px rgb(42 106 168 / 8%), 0 30px 50px -30px rgb(42 106 168 / 55%);
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.4s ease, transform 0.45s var(--ease);
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-14px) scale(0.985);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-grid .wide {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* ---------- Fields ---------- */
.field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.label-text {
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.01em;
  transition: color 0.2s ease;
}

.field:has(input:focus, select:focus, textarea:focus) > .label-text {
  color: var(--blue);
}

/* 1px border is a second background layer so a light can travel around it on focus */
.field input:not([type='checkbox']):not([type='radio']),
.field select,
.field textarea,
.test-row input,
.filters select {
  width: 100%;
  padding: 11px 13px;
  border: 1px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  color: #16263a;
  font: inherit;
  font-size: 14.5px;
  transition: box-shadow 0.3s ease, transform 0.3s var(--ease);
}

.field select,
.filters select {
  appearance: none;
  padding-right: 38px;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  cursor: pointer;
}

.field select[multiple] {
  min-height: 130px;
  padding-right: 13px;
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
}

.field textarea {
  resize: vertical;
  line-height: 1.55;
}

.field input:not([type='checkbox']):not([type='radio']):focus,
.field textarea:focus,
.test-row input:focus {
  outline: none;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

.field select:focus,
.filters select:focus {
  outline: none;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  animation: spin-angle 3.5s linear infinite;
}

.field select[multiple]:focus {
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
}

.field.nested {
  margin-top: 12px;
  animation: rise 0.45s var(--ease) both;
}

/* ---------- Send panel ---------- */
.step {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 12px;
  margin-top: 18px;
}

.step-num {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-top: 1px;
  border-radius: 50%;
  background: linear-gradient(145deg, #3a7fbf, var(--blue));
  box-shadow: 0 8px 14px -8px rgb(42 106 168 / 80%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.choices {
  display: grid;
  gap: 8px;
}

.choice {
  display: block;
  cursor: pointer;
}

.choice input,
.chip.toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.choice > span {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #f9fbfe;
  color: var(--navy-deep);
  font-size: 14px;
  font-weight: 600;
  transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease, transform 0.25s var(--ease);
}

.choice > span .ico {
  color: var(--muted);
  transition: color 0.25s ease, transform 0.35s var(--spring);
}

.choice:hover > span {
  border-color: #b3c6dd;
  transform: translateX(3px);
}

.choice input:checked + span {
  border-color: var(--blue);
  background: linear-gradient(90deg, #eaf3fd, #f6faff);
  box-shadow: inset 3px 0 0 var(--blue), 0 12px 20px -16px rgb(42 106 168 / 60%);
}

.choice input:checked + span .ico {
  color: var(--blue);
  transform: scale(1.15);
}

.choice input:focus-visible + span,
.chip.toggle input:focus-visible + span {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.channel-row {
  margin: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border-radius: 999px;
  background: #edf3fb;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 16%);
  color: var(--navy);
  font-size: 12.5px;
  font-weight: 650;
  text-transform: capitalize;
}

.chip .ico {
  width: 14px;
  height: 14px;
}

.chip.toggle {
  padding: 0;
  background: none;
  box-shadow: none;
  text-transform: none;
  cursor: pointer;
}

.chip.toggle > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 999px;
  background: #edf3fb;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 18%);
  font-size: 14px;
  transition: background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.25s var(--spring);
}

.chip.toggle:hover > span {
  transform: translateY(-1px);
}

.chip.toggle input:checked + span {
  background: linear-gradient(135deg, #3a7fbf, var(--blue));
  box-shadow: 0 10px 18px -10px rgb(42 106 168 / 85%);
  color: #fff;
}

.chip.toggle small {
  color: #a46b00;
}

.chip.toggle input:checked + span small {
  color: #ffe6a8;
}

.recipient-count {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(90deg, #edf4fd, #f6faff);
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 14%);
  color: var(--blue);
  font-weight: 600;
}

.recipient-count strong {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

/* ---------- Settings ---------- */
.settings-grid {
  justify-content: space-between;
  margin-top: 16px;
}

.switch-row {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.switch {
  position: relative;
  appearance: none;
  flex: none;
  width: 42px;
  height: 24px;
  margin: 0;
  border-radius: 999px;
  background: #c7d4e5;
  box-shadow: inset 0 1px 3px rgb(17 44 73 / 25%);
  cursor: pointer;
  transition: background 0.3s ease;
}

.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 5px rgb(17 44 73 / 35%);
  transition: transform 0.35s var(--spring);
}

.switch:checked {
  background: linear-gradient(135deg, #3a7fbf, var(--blue));
}

.switch:checked::after {
  transform: translateX(18px);
}

.switch:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.test-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #cdd9e8;
}

/* ---------- Buttons ---------- */
.primary-button,
.secondary-button,
.icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 10px 16px;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  isolation: isolate;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.25s var(--ease), box-shadow 0.3s ease, background 0.2s ease;
}

.primary-button {
  color: #fff;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 16%), rgb(255 255 255 / 0%) 55%),
    linear-gradient(135deg, #2f74b3 0%, var(--blue) 50%, #1c4a78 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 30%), inset 0 -1px 0 rgb(0 0 0 / 18%), 0 14px 24px -14px rgb(38 95 148 / 90%);
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
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 34%), inset 0 -1px 0 rgb(0 0 0 / 18%), 0 22px 30px -16px rgb(38 95 148 / 95%);
}

.primary-button:hover:not(:disabled)::before {
  left: 130%;
}

.primary-button:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.primary-button.full {
  width: 100%;
  margin-top: 12px;
  min-height: 48px;
}

.primary-button .ico {
  transition: transform 0.3s var(--spring);
}

.primary-button:hover:not(:disabled) .ico {
  transform: rotate(90deg);
}

/* the paper plane flies instead of rotating */
.send-button:hover:not(:disabled) .ico {
  transform: translate(3px, -3px);
}

.secondary-button {
  color: #fff;
  background: rgb(255 255 255 / 10%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 22%);
  backdrop-filter: blur(10px);
}

.secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 20%);
  transform: translateY(-2px);
}

.secondary-button.dark {
  color: var(--navy-deep);
  background: #e6eef8;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 14%);
  backdrop-filter: none;
}

.secondary-button.dark:hover:not(:disabled) {
  background: #d9e6f5;
}

.icon-button {
  min-height: 36px;
  padding: 7px 12px;
  color: var(--muted);
  background: #f1f5fb;
  font-size: 13px;
}

.icon-button:hover {
  color: var(--danger);
  background: #fdeceb;
}

.icon-button:hover .ico {
  transform: rotate(90deg);
}

.icon-button .ico {
  transition: transform 0.3s var(--spring);
}

button:disabled {
  opacity: 0.7;
  cursor: wait;
}

button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.text-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: 0;
  border-radius: 9px;
  color: var(--blue);
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s var(--ease);
}

.text-button .ico {
  width: 15px;
  height: 15px;
}

.text-button:hover {
  background: #e8f1fb;
  transform: translateY(-1px);
}

.text-button.danger:hover {
  background: #fdeceb;
}

.danger {
  color: var(--danger);
}

/* ---------- Tables ---------- */
.table-wrap {
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 14px;
}

table {
  width: 100%;
  min-width: 34rem;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  background: linear-gradient(180deg, #f3f7fd, #eaf1fb);
  color: var(--navy);
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
  text-align: left;
  white-space: nowrap;
}

th,
td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}

tbody tr {
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

tbody tr:hover {
  background: #f4f8fe;
  box-shadow: inset 3px 0 0 var(--blue);
}

tbody tr:last-child td {
  border-bottom: 0;
}

td strong {
  color: var(--navy-deep);
  font-weight: 650;
}

td small {
  display: block;
  max-width: 280px;
  margin-top: 4px;
  overflow: hidden;
  color: var(--muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

td small.danger {
  color: var(--danger);
}

.when {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
}

.when .ico {
  width: 14px;
  height: 14px;
}

.cell-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 11px;
  border-radius: 999px;
  background: #e0eefc;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 18%);
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
}

.pill::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.pill.published,
.pill.sent {
  background: #e3f4ea;
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 22%);
  color: #1f6b41;
}

.pill.draft,
.pill.pending {
  background: #fbf0d3;
  box-shadow: inset 0 0 0 1px rgb(201 138 0 / 26%);
  color: #8a5d00;
}

.pill.pending::before {
  animation: blink 1.4s ease-in-out infinite;
}

.pill.failed {
  background: #fdeceb;
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 20%);
  color: var(--danger);
}

.pill.archived {
  background: #eceff4;
  box-shadow: inset 0 0 0 1px rgb(93 111 130 / 22%);
  color: var(--muted);
}

.empty {
  padding: 36px 16px;
  color: var(--muted);
  text-align: center;
}

.empty .ico {
  display: block;
  margin-right: auto;
  margin-left: auto;
}

/* rows ease in when data loads, filters change, or items are removed */
.row-enter-active {
  transition: opacity 0.45s ease, transform 0.5s var(--ease);
}

.row-leave-active {
  transition: opacity 0.25s ease;
}

.row-enter-from {
  opacity: 0;
  transform: translateX(-14px);
}

.row-leave-to {
  opacity: 0;
}

/* ---------- Keyframes ---------- */
@keyframes drop-in {
  from { opacity: 0; transform: translateY(-14px); }
  to { opacity: 1; transform: none; }
}

@keyframes rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: none; }
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: none; }
}

@keyframes pop-in {
  from { opacity: 0; transform: translateY(18px) scale(0.94); }
  to { opacity: 1; transform: none; }
}

@keyframes orbit {
  to { --angle: 360deg; }
}

@keyframes spin-angle {
  to { --angle: 360deg; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes ring {
  0%, 60%, 100% { transform: rotate(0); }
  66% { transform: rotate(14deg); }
  72% { transform: rotate(-12deg); }
  78% { transform: rotate(8deg); }
  84% { transform: rotate(-4deg); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

@keyframes shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}

/* ---------- Responsive ---------- */
@media (max-width: 1000px) {
  .content-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .side-col {
    position: static;
  }

  /* on narrow screens the send panel comes first: it is the main action */
  .side-col {
    order: -1;
  }
}

@media (max-width: 700px) {
  .page-header {
    display: grid;
    padding: 24px 20px;
    border-radius: 18px;
  }

  .page-header::before {
    right: -60%;
    width: 420px;
  }

  .actions .primary-button,
  .actions .secondary-button {
    flex: 1;
  }

  .panel {
    padding: 18px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-grid .wide {
    grid-column: auto;
  }

  .test-row {
    grid-template-columns: 1fr;
  }

  /* tables become stacked cards, labelled from each cell's data-label */
  .table-wrap {
    border: 0;
  }

  table,
  tbody {
    display: block;
    min-width: 0;
  }

  thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  tbody tr {
    display: grid;
    gap: 8px;
    margin-bottom: 12px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: #fff;
  }

  tbody tr:hover {
    box-shadow: none;
  }

  td {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 0;
    border: 0;
  }

  td::before {
    content: attr(data-label);
    color: var(--muted);
    font-size: 12px;
    font-weight: 650;
  }

  td small {
    max-width: none;
    white-space: normal;
  }

  td.empty {
    display: block;
  }

  td.empty::before {
    content: none;
  }
}

/* ---------- Reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .page-header,
  .page-header::before,
  .eyebrow .ico,
  .ico.spinning,
  .message,
  .stat,
  .panel,
  .field.nested,
  .pill.pending::before,
  .field input:focus,
  .field select:focus,
  .field textarea:focus,
  .test-row input:focus,
  .filters select:focus {
    animation: none;
  }

  .panel-enter-active,
  .panel-leave-active,
  .row-enter-active,
  .row-leave-active,
  .stat,
  .stat-icon,
  .choice > span,
  .choice > span .ico,
  .chip.toggle > span,
  .switch,
  .switch::after,
  .primary-button,
  .primary-button::before,
  .primary-button .ico,
  .secondary-button,
  .icon-button .ico,
  .text-button {
    transition: none;
  }
}
</style>