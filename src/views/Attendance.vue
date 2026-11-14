<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import QrScanner from 'qr-scanner'
import { apiGet, apiPost, ApiError, getSession, scanAttendance } from '../services/api'
import {
  enqueueScan,
  listQueuedScans,
  removeQueuedScan,
  type QueuedScan
} from '../services/attendanceQueue'

interface AttendanceClass {
  class_id: number
  class_name: string
}

interface AttendanceSchedule {
  schedule_id: number
  schedule_date?: string
  start_time: string
  end_time: string
}

interface AttendanceChoice {
  id: number
  label: string
  class_id?: number
}

interface AttendanceRecord {
  attendance_id: number
  trainee_name: string
  class_name: string | null
  time_in: string | null
  time_out: string | null
  status: string
}

interface ScanResult {
  trainee: { trainee_id: number; name: string }
  status: string
  scan_action: 'in' | 'out'
}

const classes = ref<AttendanceClass[]>([])
const schedules = ref<AttendanceSchedule[]>([])
const records = ref<AttendanceRecord[]>([])
const selectedClass = ref('')
const selectedSchedule = ref('')
const scanAction = ref<'in' | 'out'>('in')
const qrCode = ref('')
const traineeQrCode = ref('')
const traineeQrImage = ref('')
const loading = ref(true)
const loadingSchedules = ref(false)
const submitting = ref(false)
const syncing = ref(false)
const pageError = ref('')
const scanError = ref('')
const recentScan = ref<{ result: ScanResult; message: string } | null>(null)
const queuedScans = ref<QueuedScan[]>([])
const cameraVideo = ref<HTMLVideoElement | null>(null)
const cameraOpen = ref(false)
const cameraStarting = ref(false)
const cameraScanning = ref(false)
const cameraError = ref('')
const manualSaving = ref(false)
const manualError = ref('')
const manualNotice = ref('')
const manualOptions = ref<{
  trainees: AttendanceChoice[]
  classes: AttendanceChoice[]
}>({ trainees: [], classes: [] })
const manualSchedules = ref<AttendanceChoice[]>([])
const manualForm = ref({
  trainee_id: '',
  class_id: '',
  schedule_id: '',
  attendance_date: new Date().toISOString().slice(0, 10),
  time_in: '',
  time_out: '',
  status: 'Present',
  remarks: ''
})
let cameraScanner: QrScanner | null = null
let cameraProcessing = false
let refreshTimer: ReturnType<typeof setInterval> | undefined

async function loadTodayRecords() {
  const response = await apiGet<{ records: AttendanceRecord[] }>('/attendance/today')
  records.value = response.data.records
}

async function loadSchedules(classId: string) {
  schedules.value = []
  selectedSchedule.value = ''
  if (!classId) return

  loadingSchedules.value = true
  try {
    const response = await apiGet<{ schedules: AttendanceSchedule[] }>(
      `/attendance/classes/${encodeURIComponent(classId)}/schedules`
    )
    schedules.value = response.data.schedules
  } catch (reason) {
    pageError.value = reason instanceof Error ? reason.message : 'Unable to load today’s sessions.'
  } finally {
    loadingSchedules.value = false
  }
}

async function loadPage() {
  loading.value = true
  pageError.value = ''
  try {
    const [classResponse, attendanceResponse] = await Promise.all([
      apiGet<{ classes: AttendanceClass[] }>('/attendance/classes'),
      apiGet<{ records: AttendanceRecord[] }>('/attendance/today')
    ])
    classes.value = classResponse.data.classes
    records.value = attendanceResponse.data.records
    manualOptions.value = {
      trainees: [],
      classes: classes.value.map((item) => ({ id: item.class_id, label: item.class_name }))
    }

    const firstClass = classes.value[0]
    if (!selectedClass.value && firstClass) {
      selectedClass.value = String(firstClass.class_id)
    }

    if (!classes.value.length) {
      pageError.value = 'There are no active classes available for attendance.'
    }
    void loadManualTrainees()
  } catch (reason) {
    pageError.value = reason instanceof Error ? reason.message : 'Unable to load attendance.'
  } finally {
    loading.value = false
  }
}

async function loadTraineeQr() {
  try {
    const session = await getSession()
    if (session.user?.role !== 'trainee') return
    const response = await apiGet<{ trainee: { qr_code?: string } | null }>('/modules/profile')
    traineeQrCode.value = response.data.trainee?.qr_code || ''
    traineeQrImage.value = traineeQrCode.value
      ? await QRCode.toDataURL(traineeQrCode.value, { margin: 2, width: 220 })
      : ''
  } catch (reason) {
    pageError.value = reason instanceof Error ? reason.message : 'Unable to load your QR code.'
  }
}

async function loadManualTrainees() {
  try {
    const response = await apiGet<{
      records: Array<{ trainee_id: number; first_name: string; last_name: string; status: string }>
    }>('/modules/trainees')
    manualOptions.value.trainees = (response.data.records || [])
      .filter((trainee) => trainee.status === 'active')
      .map((trainee) => ({
        id: trainee.trainee_id,
        label: `${trainee.first_name} ${trainee.last_name}`
      }))
  } catch (reason) {
    manualError.value = reason instanceof Error ? reason.message : 'Unable to load trainees for manual attendance.'
  }
}

async function loadManualSchedules() {
  manualSchedules.value = []
  manualForm.value.schedule_id = ''
  if (!manualForm.value.class_id) return

  try {
    const response = await apiGet<{ schedules: AttendanceSchedule[] }>(
      `/attendance/classes/${encodeURIComponent(manualForm.value.class_id)}/schedules`
    )
    manualSchedules.value = response.data.schedules.map((schedule) => ({
      id: schedule.schedule_id,
      label: `${schedule.schedule_date || ''} ${schedule.start_time} – ${schedule.end_time}`.trim()
    }))
  } catch (reason) {
    manualError.value = reason instanceof Error ? reason.message : 'Unable to load schedules for manual attendance.'
  }
}

function schedulesForManualClass() {
  return manualSchedules.value
}

async function submitManualRecord() {
  manualError.value = ''
  manualNotice.value = ''
  const form = manualForm.value
  if (!form.trainee_id || !form.attendance_date || !form.status) {
    manualError.value = 'Choose a trainee, attendance date, and status.'
    return
  }
  manualSaving.value = true
  try {
    const response = await apiPost('/modules/attendance/save', {
      trainee_id: Number(form.trainee_id),
      class_id: form.class_id ? Number(form.class_id) : '',
      schedule_id: form.schedule_id ? Number(form.schedule_id) : '',
      attendance_date: form.attendance_date,
      time_in: form.time_in,
      time_out: form.time_out,
      status: form.status,
      remarks: form.remarks
    })
    manualNotice.value = response.message || 'Attendance record created.'
    manualForm.value = {
      ...form,
      trainee_id: '',
      time_in: '',
      time_out: '',
      remarks: ''
    }
    await loadTodayRecords()
  } catch (reason) {
    manualError.value = reason instanceof Error ? reason.message : 'Unable to create the attendance record.'
  } finally {
    manualSaving.value = false
  }
}

async function refreshQueuedScans() {
  queuedScans.value = await listQueuedScans()
}

function showStatusToast(message: string) {
  window.dispatchEvent(new CustomEvent('app-toast', {
    detail: { message, type: 'error' }
  }))
}

async function syncQueuedScans() {
  if (!navigator.onLine || syncing.value || !queuedScans.value.length) return
  syncing.value = true
  try {
    for (const queued of queuedScans.value) {
      try {
        await scanAttendance({
          qr_code: queued.qr_code,
          scan_action: queued.scan_action,
          class_id: queued.class_id,
          schedule_id: queued.schedule_id
        })
        await removeQueuedScan(queued.id)
      } catch (reason) {
        if (reason instanceof ApiError && reason.status === 422) {
          await removeQueuedScan(queued.id)
          showStatusToast(`An offline scan could not be recorded: ${reason.message}`)
          continue
        }
        break
      }
    }
    await refreshQueuedScans()
    if (navigator.onLine) await loadTodayRecords()
  } finally {
    syncing.value = false
  }
}

async function submitScan() {
  scanError.value = ''
  recentScan.value = null
  const scan = {
    qr_code: qrCode.value.trim(),
    scan_action: scanAction.value,
    class_id: Number(selectedClass.value),
    schedule_id: selectedSchedule.value ? Number(selectedSchedule.value) : null
  }

  if (!scan.qr_code || !scan.class_id) {
    scanError.value = 'Choose a class and scan or enter a trainee QR code.'
    return
  }

  submitting.value = true
  try {
    if (!navigator.onLine) {
      await enqueueScan(scan)
      await refreshQueuedScans()
      qrCode.value = ''
      scanError.value = 'Connection is offline. The scan is saved on this device and will sync when online.'
      return
    }

    let response
    try {
      response = await scanAttendance(scan)
    } catch (reason) {
      if (!(reason instanceof ApiError) || reason.status !== 0) throw reason
      await enqueueScan(scan)
      await refreshQueuedScans()
      qrCode.value = ''
      scanError.value = 'The server is unreachable. The scan is saved on this device and will sync when online.'
      return
    }

    recentScan.value = { result: response.data, message: response.message }
    qrCode.value = ''
    await loadTodayRecords().catch(() => undefined)
  } catch (reason) {
    scanError.value = reason instanceof Error ? reason.message : 'Unable to record the scan.'
  } finally {
    submitting.value = false
  }
}

function reportCameraError(reason: Error | string) {
  if (reason instanceof Error) {
    if (reason.name === 'NotAllowedError' || reason.name === 'PermissionDeniedError') {
      cameraError.value = 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
      return
    }
    if (reason.name === 'NotFoundError' || reason.name === 'DevicesNotFoundError') {
      cameraError.value = 'No camera was found. Connect a camera or use a QR reader/manual entry.'
      return
    }
    if (reason.name === 'NotReadableError' || reason.name === 'TrackStartError') {
      cameraError.value = 'The camera is already in use by another app. Close it and try again.'
      return
    }
  }

  const message = typeof reason === 'string' ? reason : reason.message
  if (message !== QrScanner.NO_QR_CODE_FOUND) {
    cameraError.value = message || 'The camera could not scan a QR code.'
  }
}

async function handleCameraDecode(result: QrScanner.ScanResult) {
  if (cameraProcessing || submitting.value || !result.data.trim()) return

  cameraProcessing = true
  cameraScanner?.stop()
  cameraScanning.value = false
  qrCode.value = result.data.trim()
  cameraError.value = ''

  try {
    await submitScan()
  } finally {
    cameraProcessing = false
    if (cameraOpen.value && cameraScanner) {
      try {
        await cameraScanner.start()
        cameraScanning.value = true
      } catch (reason) {
        reportCameraError(reason instanceof Error ? reason : 'The camera could not restart.')
        cameraScanning.value = false
      }
    }
  }
}

async function startCameraScanner() {
  if (!window.isSecureContext) {
    cameraError.value = 'Camera access requires HTTPS. Use localhost for local development.'
    return
  }

  cameraError.value = ''
  cameraStarting.value = true
  cameraOpen.value = true
  await nextTick()

  if (!cameraVideo.value) {
    cameraOpen.value = false
    cameraStarting.value = false
    cameraError.value = 'The camera preview could not be initialized.'
    return
  }

  const scanner = new QrScanner(cameraVideo.value, handleCameraDecode, {
    preferredCamera: 'environment',
    maxScansPerSecond: 10,
    highlightScanRegion: true,
    highlightCodeOutline: true,
    returnDetailedScanResult: true,
    onDecodeError: reportCameraError
  })
  cameraScanner = scanner

  try {
    await scanner.start()
    if (cameraScanner !== scanner || !cameraOpen.value) {
      scanner.stop()
      scanner.destroy()
      return
    }
    cameraScanning.value = true
  } catch (reason) {
    scanner.destroy()
    if (cameraScanner !== scanner) return
    cameraScanner = null
    cameraOpen.value = false
    reportCameraError(reason instanceof Error ? reason : 'Camera access was denied or unavailable.')
  } finally {
    cameraStarting.value = false
  }
}

function stopCameraScanner() {
  cameraOpen.value = false
  cameraStarting.value = false
  cameraScanning.value = false
  cameraScanner?.destroy()
  cameraScanner = null
}

function handleOnline() {
  void syncQueuedScans()
}

watch(selectedClass, (classId) => {
  void loadSchedules(classId)
})

onMounted(async () => {
  try {
    await loadPage()
    await loadTraineeQr()
    await refreshQueuedScans()
    if (navigator.onLine) await syncQueuedScans()
  } catch (reason) {
    pageError.value = reason instanceof Error ? reason.message : 'Unable to initialize attendance.'
  }
  window.addEventListener('online', handleOnline)
  refreshTimer = setInterval(() => {
    if (navigator.onLine) void loadTodayRecords().catch(() => undefined)
  }, 30_000)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  stopCameraScanner()
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="attendance-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">LSI SMARTTRACK</p>
        <h1>Attendance</h1>
        <p class="lead">Scan trainee IDs and monitor today’s attendance.</p>
      </div>
      <button class="secondary-button" :disabled="loading" @click="loadPage">
        Refresh
      </button>
    </header>

    <p v-if="pageError" class="inline-error" role="alert">{{ pageError }}</p>

    <section v-if="traineeQrImage" class="panel trainee-qr-panel">
      <div>
        <p class="eyebrow">Your attendance QR</p>
        <h2>Show this code when checking in</h2>
        <p class="muted">Present this QR code to the attendance scanner.</p>
        <strong>{{ traineeQrCode }}</strong>
      </div>
      <img class="trainee-qr-image" :src="traineeQrImage" alt="Your attendance QR code">
    </section>

    <section class="panel scanner-panel">
      <div class="section-heading">
        <div>
          <h2>Attendance scanner</h2>
          <p>Use your webcam or phone camera, or scan with a USB QR reader. Scans are queued locally if offline.</p>
        </div>
        <div class="scanner-tools">
          <span v-if="queuedScans.length" class="queue-badge">
            {{ queuedScans.length }} pending sync{{ queuedScans.length === 1 ? '' : 's' }}
          </span>
          <button
            v-if="!cameraOpen"
            class="primary-button camera-button"
            type="button"
            :disabled="cameraStarting || loading || !classes.length"
            @click="startCameraScanner"
          >
            {{ cameraStarting ? 'Starting camera...' : 'Use camera' }}
          </button>
          <button
            v-else
            class="stop-button camera-button"
            type="button"
            @click="stopCameraScanner"
          >
            Stop camera
          </button>
        </div>
      </div>

      <div v-if="cameraOpen" class="camera-scanner">
        <div class="camera-frame">
          <video ref="cameraVideo" class="camera-preview" muted playsinline></video>
          <div class="camera-guide" aria-hidden="true">
            <span class="corner tl"></span>
            <span class="corner tr"></span>
            <span class="corner bl"></span>
            <span class="corner br"></span>
            <span class="scan-line"></span>
          </div>
        </div>
        <p class="camera-status" role="status">
          {{ cameraStarting ? 'Requesting camera access…' : cameraScanning ? 'Camera ready. Point it at a trainee QR code.' : 'Waiting for the camera…' }}
        </p>
      </div>
      <p v-if="cameraError" class="inline-error" role="alert">{{ cameraError }}</p>

      <form class="scan-form" @submit.prevent="submitScan">
        <label>
          Class
          <select v-model="selectedClass" required :disabled="loading">
            <option value="" disabled>Select a class</option>
            <option v-for="item in classes" :key="item.class_id" :value="String(item.class_id)">
              {{ item.class_name }}
            </option>
          </select>
        </label>

        <label>
          Today’s session
          <select v-model="selectedSchedule" :disabled="loadingSchedules || !schedules.length">
            <option value="">No session selected</option>
            <option v-for="item in schedules" :key="item.schedule_id" :value="String(item.schedule_id)">
              {{ item.start_time }} – {{ item.end_time }}
            </option>
          </select>
        </label>

        <div class="action-field">
          <span class="field-label" id="scan-action-label">Scan action</span>
          <div class="segmented" role="group" aria-labelledby="scan-action-label">
            <button
              type="button"
              :class="{ active: scanAction === 'in' }"
              :aria-pressed="scanAction === 'in'"
              @click="scanAction = 'in'"
            >
              Time in
            </button>
            <button
              type="button"
              :class="{ active: scanAction === 'out' }"
              :aria-pressed="scanAction === 'out'"
              @click="scanAction = 'out'"
            >
              Time out
            </button>
          </div>
        </div>

        <label class="qr-field">
          Trainee QR code (camera or manual)
          <input
            v-model="qrCode"
            autocomplete="off"
            autofocus
            placeholder="Scan or enter QR code"
            required
          >
        </label>

        <button class="primary-button" type="submit" :disabled="submitting || loading || !classes.length">
          {{ submitting ? 'Recording...' : 'Record attendance' }}
        </button>
      </form>

      <p v-if="loadingSchedules" class="muted">Loading today’s sessions...</p>
      <p v-if="scanError" class="inline-error" role="status">{{ scanError }}</p>
      <div v-if="recentScan" class="scan-result" role="status">
        <strong>{{ recentScan.result.trainee.name }}</strong>
        <span>{{ recentScan.message }} Status: {{ recentScan.result.status }}.</span>
      </div>
      <p v-if="syncing" class="muted">Syncing saved scans...</p>
    </section>

    <section class="panel manual-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Manual entry</p>
          <h2>Add attendance</h2>
          <p>Create an attendance record without a QR code or camera.</p>
        </div>
      </div>

      <form class="manual-form" @submit.prevent="submitManualRecord">
        <label>
          Trainee
          <select v-model="manualForm.trainee_id" required>
            <option value="" disabled>Choose...</option>
            <option v-for="trainee in manualOptions.trainees" :key="trainee.id" :value="String(trainee.id)">
              {{ trainee.label }}
            </option>
          </select>
        </label>

        <label>
          Class
          <select v-model="manualForm.class_id" @change="loadManualSchedules">
            <option value="">Choose...</option>
            <option v-for="item in manualOptions.classes" :key="item.id" :value="String(item.id)">
              {{ item.label }}
            </option>
          </select>
        </label>

        <label>
          Schedule
          <select v-model="manualForm.schedule_id">
            <option value="">Choose...</option>
            <option v-for="item in schedulesForManualClass()" :key="item.id" :value="String(item.id)">
              {{ item.label }}
            </option>
          </select>
        </label>

        <label>
          Attendance date
          <input v-model="manualForm.attendance_date" type="date" required>
        </label>

        <label>
          Time in
          <input v-model="manualForm.time_in" type="time">
        </label>

        <label>
          Time out
          <input v-model="manualForm.time_out" type="time">
        </label>

        <label>
          Status
          <select v-model="manualForm.status" required>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
          </select>
        </label>

        <label class="remarks-field">
          Remarks
          <textarea v-model="manualForm.remarks" rows="3"></textarea>
        </label>

        <button class="primary-button" type="submit" :disabled="manualSaving || loading || !manualOptions.trainees.length">
          {{ manualSaving ? 'Creating record...' : 'Create record' }}
        </button>
      </form>
      <p v-if="manualError" class="inline-error" role="alert">{{ manualError }}</p>
      <p v-if="manualNotice" class="inline-success" role="status">{{ manualNotice }}</p>
    </section>

    <section class="panel live-panel">
      <div class="section-heading">
        <div>
          <h2>Today’s attendance</h2>
          <p>Live records for classes you are authorized to manage.</p>
        </div>
        <span class="record-count">{{ records.length }} records</span>
      </div>

      <p v-if="loading" class="muted">Loading attendance records...</p>
      <p v-else-if="!records.length" class="empty-state">No attendance has been recorded today.</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Trainee</th>
              <th>Class</th>
              <th>Time in</th>
              <th>Time out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in records" :key="record.attendance_id">
              <td class="name-cell">{{ record.trainee_name }}</td>
              <td>{{ record.class_name || '—' }}</td>
              <td>{{ record.time_in || '—' }}</td>
              <td>{{ record.time_out || '—' }}</td>
              <td>
                <span class="status-pill" :class="String(record.status || '').toLowerCase()">
                  {{ record.status }}
                </span>
              </td>
            </tr>
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

.attendance-page {
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
.page-header,
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.page-header {
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
.page-header::before {
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

/* a thin scan beam crosses the banner every few seconds (kept: it fits a scanner page) */
.page-header::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  width: 3px;
  background: linear-gradient(180deg, transparent, var(--sky), transparent);
  box-shadow: 0 0 18px 3px rgb(143 196 245 / 55%);
  animation: beam 6s ease-in-out 1s infinite;
  pointer-events: none;
}

.page-header > * {
  position: relative;
  z-index: 1;
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

.lead {
  margin: 10px 0 0;
  color: rgb(255 255 255 / 78%);
  font-size: 15px;
}

.page-header .secondary-button {
  background: rgb(255 255 255 / 10%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 24%);
  backdrop-filter: blur(10px);
  color: #fff;
}

.page-header .secondary-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 20%);
  transform: translateY(-2px);
}

/* ================= Panels ================= */
.panel {
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #fcfdff);
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 14px 30px -22px rgb(17 44 73 / 40%);
  animation: rise 0.65s var(--ease) both;
  transition: box-shadow 0.35s ease, border-color 0.35s ease;
}

.panel:nth-of-type(1) { animation-delay: 0.1s; }
.panel:nth-of-type(2) { animation-delay: 0.2s; }
.panel:nth-of-type(n + 3) { animation-delay: 0.3s; }

.panel:hover {
  border-color: #d3deec;
  box-shadow: 0 1px 2px rgb(17 44 73 / 5%), 0 24px 40px -24px rgb(17 44 73 / 48%);
}

.section-heading h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 23px;
  font-weight: 600;
  font-variation-settings: 'opsz' 48, 'SOFT' 40;
  letter-spacing: -0.015em;
}

.section-heading p,
.muted {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

/* ================= Trainee QR card ================= */
.trainee-qr-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.trainee-qr-image {
  position: relative;
  width: 220px;
  height: 220px;
  padding: 14px;
  border-radius: 20px;
  background: #fff;
  /* a thin gradient frame, so the code reads as an "ID card" */
  border: 1px solid transparent;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(145deg, var(--sky), var(--blue) 55%, var(--navy)) border-box;
  box-shadow: 0 22px 38px -22px rgb(17 44 73 / 60%);
  animation: pop-in 0.7s var(--spring) 0.3s both;
  transition: transform 0.4s var(--spring), box-shadow 0.3s ease;
}

.trainee-qr-image:hover {
  transform: scale(1.04) rotate(-1deg);
  box-shadow: 0 30px 44px -22px rgb(17 44 73 / 70%);
}

/* ================= Scan form ================= */
.scan-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 22px;
}

.scan-form > * {
  animation: rise 0.5s var(--ease) both;
}

.scan-form > :nth-child(1) { animation-delay: 0.3s; }
.scan-form > :nth-child(2) { animation-delay: 0.36s; }
.scan-form > :nth-child(3) { animation-delay: 0.42s; }
.scan-form > :nth-child(4) { animation-delay: 0.48s; }
.scan-form > :nth-child(n + 5) { animation-delay: 0.54s; }

.scan-form label,
.action-field,
.manual-form label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.01em;
  transition: color 0.2s ease;
}

.scan-form label:has(input:focus, select:focus),
.manual-form label:has(input:focus, select:focus, textarea:focus) {
  color: var(--blue);
}

.field-label {
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 650;
}

/* 1px border is a second background layer, so a light can travel around it on focus */
.scan-form input,
.scan-form select,
.manual-form input,
.manual-form select,
.manual-form textarea {
  width: 100%;
  box-sizing: border-box;
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

.scan-form select,
.manual-form select {
  appearance: none;
  padding-right: 38px;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#d9e2ee, #d9e2ee) border-box;
  cursor: pointer;
}

.manual-form textarea {
  min-height: 90px;
  line-height: 1.55;
  resize: vertical;
}

.scan-form input:hover:not(:focus):not(:disabled),
.manual-form input:hover:not(:focus),
.manual-form textarea:hover:not(:focus) {
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

.scan-form select:hover:not(:focus):not(:disabled),
.manual-form select:hover:not(:focus) {
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

.scan-form input:focus,
.manual-form input:focus,
.manual-form textarea:focus {
  outline: none;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

.scan-form select:focus,
.manual-form select:focus {
  outline: none;
  background:
    var(--chev) calc(100% - 12px) 50% / 16px 16px no-repeat padding-box,
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow: 0 0 0 4px rgb(42 106 168 / 12%), 0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

.scan-form input:disabled,
.scan-form select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.qr-field {
  grid-column: span 2;
}

/* the QR field is "armed": a soft ready-to-scan glow until it is focused */
.qr-field input {
  font-size: 16px;
  letter-spacing: 0.02em;
  animation: armed 2.8s ease-in-out 1s infinite;
}

.qr-field input:focus {
  animation: spin-angle 3.5s linear infinite;
}

/* Time in / Time out toggle */
.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 46px;
  padding: 4px;
  border-radius: 14px;
  background: var(--field);
  box-shadow: inset 0 1px 3px rgb(17 44 73 / 10%), inset 0 0 0 1px var(--line);
}

.segmented button {
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--muted);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.25s var(--spring);
}

.segmented button:hover:not(.active) {
  background: rgb(255 255 255 / 65%);
  color: var(--navy-deep);
}

.segmented button.active {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 16%), rgb(255 255 255 / 0%) 55%),
    linear-gradient(135deg, #2f74b3, #1c4a78);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 30%), 0 10px 16px -8px rgb(38 95 148 / 85%);
  color: #fff;
  animation: toggle-pop 0.4s var(--spring);
}

/* ================= Buttons ================= */
.primary-button,
.secondary-button,
.stop-button {
  position: relative;
  align-self: end;
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

.secondary-button {
  background: #e6eef8;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 14%);
  color: var(--navy-deep);
}

.secondary-button:hover:not(:disabled) {
  background: #d9e6f5;
  transform: translateY(-2px);
}

.stop-button {
  background: #fdeceb;
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 20%);
  color: var(--danger);
}

.stop-button:hover {
  background: #f9d9d5;
  transform: translateY(-2px);
}

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled),
.stop-button:active {
  transform: translateY(0) scale(0.98);
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
.stop-button:focus-visible,
.segmented button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.primary-button:disabled,
.secondary-button:disabled {
  cursor: wait;
  opacity: 0.78;
}

/* recording: progress stripe along the bottom edge */
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

.scanner-tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.camera-button {
  align-self: auto;
}

/* ================= Camera ================= */
.camera-scanner {
  max-width: 720px;
  margin: 22px auto 0;
  overflow: hidden;
  border-radius: 20px;
  background: var(--navy-deep);
  box-shadow: 0 0 0 1px rgb(143 196 245 / 22%), 0 30px 50px -28px rgb(17 44 73 / 80%);
  animation: camera-open 0.6s var(--ease) both;
}

.camera-frame {
  position: relative;
}

/* darkened edges draw the eye to the target square */
.camera-frame::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 45%, rgb(10 25 45 / 55%) 100%);
  pointer-events: none;
}

.camera-preview {
  display: block;
  width: 100%;
  max-height: 480px;
  object-fit: cover;
}

.camera-guide {
  position: absolute;
  inset: 12% 18%;
  z-index: 1;
  pointer-events: none;
  animation: lock-on 1.4s var(--ease) both;
}

.corner {
  position: absolute;
  width: 34px;
  height: 34px;
  border: 0 solid var(--sky);
  filter: drop-shadow(0 0 6px rgb(143 196 245 / 70%));
  animation: corner-pulse 2.4s ease-in-out 1.4s infinite;
}

.corner.tl {
  top: 0;
  left: 0;
  border-width: 4px 0 0 4px;
  border-top-left-radius: 10px;
}

.corner.tr {
  top: 0;
  right: 0;
  border-width: 4px 4px 0 0;
  border-top-right-radius: 10px;
}

.corner.bl {
  bottom: 0;
  left: 0;
  border-width: 0 0 4px 4px;
  border-bottom-left-radius: 10px;
}

.corner.br {
  right: 0;
  bottom: 0;
  border-width: 0 4px 4px 0;
  border-bottom-right-radius: 10px;
}

.scan-line {
  position: absolute;
  left: 4%;
  right: 4%;
  top: 10%;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--sky), transparent);
  box-shadow: 0 0 12px rgb(143 196 245 / 90%);
  animation: sweep 2.2s ease-in-out infinite alternate;
}

.camera-status {
  margin: 0;
  padding: 13px 16px;
  background: linear-gradient(180deg, rgb(255 255 255 / 4%), transparent);
  color: rgb(255 255 255 / 88%);
  text-align: center;
  font-size: 13px;
}

/* ================= Messages and scan result ================= */
.inline-error {
  margin: 14px 0 0;
  padding: 13px 16px;
  border-left: 3px solid var(--danger);
  border-radius: 10px;
  background: linear-gradient(90deg, #fdeceb, #fff6f5);
  color: var(--danger);
  font-size: 13px;
  animation: shake 0.45s ease both;
}

.page-header + .inline-error {
  margin: 0;
}

.inline-success {
  color: var(--ok);
  font-size: 13px;
  font-weight: 600;
  animation: pop-in 0.5s var(--spring) both;
}

/* success burst: the confirmation grows in with a ring and a tick */
.scan-result {
  position: relative;
  display: grid;
  gap: 4px;
  margin-top: 16px;
  padding: 16px 18px 16px 68px;
  border-left: 3px solid var(--ok);
  border-radius: 14px;
  background: linear-gradient(90deg, #e3f4ea, #eef8f2);
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 16%);
  color: #1f6b41;
  overflow: hidden;
  animation: result-in 0.6s var(--spring) both;
}

.scan-result::before {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 18px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-top: -17px;
  border-radius: 50%;
  background: linear-gradient(145deg, #4cb37d, var(--ok));
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  animation: tick-pop 0.6s var(--spring) 0.15s both, ring 1.1s ease-out 0.2s 2;
}

/* a light wash sweeps across the card once */
.scan-result::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -50%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 60%), transparent);
  transform: skewX(-20deg);
  animation: wash 1.2s ease 0.2s both;
}

.scan-result strong {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 18px;
  font-weight: 600;
}

.empty-state {
  padding: 36px 8px;
  border: 1px dashed #cdd9e8;
  border-radius: 16px;
  color: var(--muted);
  text-align: center;
}

/* ================= Manual attendance ================= */
.manual-panel {
  display: grid;
  gap: 18px;
}

.manual-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
}

.manual-form > * {
  animation: rise 0.5s var(--ease) both;
}

.manual-form > :nth-child(1) { animation-delay: 0.3s; }
.manual-form > :nth-child(2) { animation-delay: 0.36s; }
.manual-form > :nth-child(3) { animation-delay: 0.42s; }
.manual-form > :nth-child(4) { animation-delay: 0.48s; }
.manual-form > :nth-child(n + 5) { animation-delay: 0.54s; }

.remarks-field {
  grid-column: span 2;
}

.manual-form .primary-button {
  grid-column: span 2;
  justify-self: start;
}

/* ================= Table: rows scan in ================= */
.queue-badge,
.record-count {
  display: inline-flex;
  align-items: center;
  padding: 6px 13px;
  border-radius: 999px;
  background: #e0eefc;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 18%);
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  animation: pop-in 0.5s var(--spring) 0.4s both;
}

/* pending-sync badge breathes so unsent scans are not forgotten */
.queue-badge {
  background: #fbf0d3;
  box-shadow: inset 0 0 0 1px rgb(201 138 0 / 28%);
  color: #8a5d00;
  animation: pop-in 0.5s var(--spring) both, glow-amber 2.6s ease-in-out 0.8s infinite;
}

.table-wrap {
  overflow-x: auto;
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 14px;
}

th,
td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

th {
  background: linear-gradient(180deg, #f3f7fd, var(--field));
  color: var(--navy);
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
}

/* a new record flashes briefly, then rows below slide in */
tbody tr {
  animation: record-in 0.55s var(--ease) both;
  transition: background 0.2s ease, box-shadow 0.25s ease;
}

tbody tr:nth-child(1) { animation: record-in 0.55s var(--ease) 0.35s both, new-flash 1.8s ease 0.5s 1; }
tbody tr:nth-child(2) { animation-delay: 0.42s; }
tbody tr:nth-child(3) { animation-delay: 0.49s; }
tbody tr:nth-child(4) { animation-delay: 0.56s; }
tbody tr:nth-child(5) { animation-delay: 0.63s; }
tbody tr:nth-child(6) { animation-delay: 0.7s; }
tbody tr:nth-child(n + 7) { animation-delay: 0.77s; }

.name-cell {
  color: var(--navy-deep);
  font-weight: 650;
  transition: color 0.2s ease;
}

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #f4f8fe;
  box-shadow: inset 3px 0 0 var(--blue);
}

tbody tr:hover .name-cell {
  color: var(--blue);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border-radius: 999px;
  background: #e0eefc;
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 18%);
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
  animation: pop-in 0.45s var(--spring) both;
}

.status-pill::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-pill.present {
  background: #e3f4ea;
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 22%);
  color: #1f6b41;
}

.status-pill.late {
  background: #fbf0d3;
  box-shadow: inset 0 0 0 1px rgb(201 138 0 / 26%);
  color: #8a5d00;
}

.status-pill.absent {
  background: #fdeceb;
  box-shadow: inset 0 0 0 1px rgb(180 40 31 / 20%);
  color: var(--danger);
}

/* ================= Keyframes ================= */
@keyframes drop-in { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
@keyframes rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes pop-in { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: none; } }
@keyframes orbit { to { --angle: 360deg; } }
@keyframes spin-angle { to { --angle: 360deg; } }
@keyframes beam { 0%, 45% { left: -4px; opacity: 0; } 55% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
@keyframes camera-open { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; } }
/* the target square shrinks in as if the camera is locking on */
@keyframes lock-on { from { opacity: 0; transform: scale(1.18); } to { opacity: 1; transform: none; } }
@keyframes corner-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes sweep { from { top: 10%; } to { top: 90%; } }
@keyframes armed { 0%, 100% { box-shadow: 0 0 0 0 rgb(42 106 168 / 0%); } 50% { box-shadow: 0 0 0 5px rgb(42 106 168 / 14%); } }
@keyframes toggle-pop { 0% { transform: scale(0.92); } 100% { transform: none; } }
@keyframes result-in { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes tick-pop { from { transform: scale(0) rotate(-40deg); } to { transform: none; } }
@keyframes ring { 0% { box-shadow: 0 0 0 0 rgb(45 138 87 / 55%); } 100% { box-shadow: 0 0 0 16px rgb(45 138 87 / 0%); } }
@keyframes wash { from { left: -50%; } to { left: 130%; } }
@keyframes record-in { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; } }
@keyframes new-flash { 0%, 100% { background: transparent; } 30% { background: rgb(143 196 245 / 28%); } }
@keyframes glow-amber { 0%, 100% { box-shadow: inset 0 0 0 1px rgb(201 138 0 / 28%), 0 0 0 0 rgb(201 138 0 / 0%); } 50% { box-shadow: inset 0 0 0 1px rgb(201 138 0 / 28%), 0 0 0 5px rgb(201 138 0 / 18%); } }
@keyframes load { from { background-position: -50% 0; } to { background-position: 150% 0; } }
@keyframes shake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-4px); } 40%, 60% { transform: translateX(4px); } }

/* ================= Responsive ================= */
@media (max-width: 850px) {
  .scan-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .qr-field { grid-column: span 2; }
  .trainee-qr-panel { flex-direction: column; align-items: flex-start; }
  .page-header::before { right: -30%; }
}

@media (max-width: 560px) {
  .page-header { flex-direction: column; align-items: flex-start; padding: 24px 20px; border-radius: 18px; }
  .page-header::before { right: -60%; width: 420px; }
  .page-header::after { display: none; }
  .page-header h1 { font-size: 26px; }
  .section-heading { flex-direction: column; }
  .scanner-tools { width: 100%; justify-content: space-between; }
  .scan-form,
  .manual-form { grid-template-columns: 1fr; }
  .qr-field,
  .remarks-field,
  .manual-form .primary-button { grid-column: auto; }
  .trainee-qr-image { width: 100%; max-width: 260px; height: auto; aspect-ratio: 1; }
  .panel { padding: 18px; }
  .camera-guide { inset: 10% 10%; }
  .scan-result { padding-left: 62px; }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .attendance-page *,
  .attendance-page *::before,
  .attendance-page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .scan-line {
    animation: none;
    top: 50%;
  }
}
</style>