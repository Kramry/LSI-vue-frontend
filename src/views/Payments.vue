<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFileUrl, apiGet, apiPost, getSession } from '../services/api'

type PaymentRecord = Record<string, string | number | null>
interface PaymentData {
  view?: string
  fees?: PaymentRecord[]
  payments?: PaymentRecord[]
  proofs?: PaymentRecord[]
  pending_proofs?: PaymentRecord[]
  recent_payments?: PaymentRecord[]
  fee_types?: PaymentRecord[]
  programs?: PaymentRecord[]
  classes?: PaymentRecord[]
  bonds?: PaymentRecord[]
  summary?: Record<string, number>
  report_rows?: PaymentRecord[]
  outstanding?: PaymentRecord[]
}

const role = ref('')
const view = ref('cashier')
const data = ref<PaymentData>({ view: 'cashier' })
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const lastReceiptId = ref('')
const today = new Date().toISOString().slice(0, 10)
const startDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
const endDate = ref(today)
const reportType = ref('collections')
const editingFeeId = ref('')
const feeForm = ref({ program_id: '', class_id: '', fee_kind: 'registration', fee_name: '', amount: '', due_date: '', required_for_certificate: false })
const paymentForm = ref({ trainee_fee_id: '', amount: '', method: 'cash', reference_number: '', payment_date: today, remarks: '' })
const proofForm = ref({ trainee_fee_id: '', amount: '', method: 'bank', reference_number: '', payment_date: today })
const proofFile = ref<File | null>(null)
const bondForms = ref<Record<string, { action: string; amount: string; transaction_date: string; method: string; reference_number: string; remarks: string }>>({})
const isStaff = computed(() => ['administrator', 'staff'].includes(role.value))
const isTrainee = computed(() => role.value === 'trainee')
const tabs = [
  { id: 'cashier', label: 'Cashier' },
  { id: 'fees', label: 'Fee setup' },
  { id: 'bonds', label: 'Bonds' },
  { id: 'reports', label: 'Reports' }
]

function money(value: unknown) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    let path = '/payments'
    if (isStaff.value) {
      const query = new URLSearchParams({ view: view.value })
      if (view.value === 'reports') {
        query.set('start_date', startDate.value)
        query.set('end_date', endDate.value)
      }
      path += `?${query}`
    }
    const response = await apiGet<PaymentData>(path)
    data.value = response.data
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load payment records.'
  } finally {
    loading.value = false
  }
}

function selectView(nextView: string) {
  view.value = nextView
  notice.value = ''
  load()
}

function editFee(fee: PaymentRecord) {
  editingFeeId.value = String(fee.fee_type_id)
  feeForm.value = {
    program_id: String(fee.program_id || ''),
    class_id: String(fee.class_id || ''),
    fee_kind: String(fee.fee_kind || 'registration'),
    fee_name: String(fee.fee_name || ''),
    amount: String(fee.amount || ''),
    due_date: String(fee.due_date || ''),
    required_for_certificate: Number(fee.required_for_certificate) === 1
  }
}

function resetFeeForm() {
  editingFeeId.value = ''
  feeForm.value = { program_id: '', class_id: '', fee_kind: 'registration', fee_name: '', amount: '', due_date: '', required_for_certificate: false }
}

async function submit(path: string, body: unknown, success: string) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost(path, body)
    notice.value = response.message || success
    await load()
    return response.data
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'The request could not be completed.'
    return null
  } finally {
    busy.value = false
  }
}

async function saveFee() {
  const form = new FormData()
  form.append('fee_type_id', editingFeeId.value)
  Object.entries(feeForm.value).forEach(([key, value]) => {
    if (typeof value !== 'boolean' || value) form.append(key, String(value))
  })
  await submit('/payments/fees/save', form, 'Fee configuration saved.')
  resetFeeForm()
}

async function deactivateFee(fee: PaymentRecord) {
  if (!window.confirm(`Deactivate ${fee.fee_name}? Existing trainee balances will remain unchanged.`)) return
  await submit(`/payments/fees/${fee.fee_type_id}/deactivate`, {}, 'Fee configuration deactivated.')
}

async function recordPayment() {
  lastReceiptId.value = ''
  const result = await submit('/payments/record', paymentForm.value, 'Payment recorded.')
  if (result?.payment_id) {
    lastReceiptId.value = String(result.payment_id)
    paymentForm.value = { trainee_fee_id: '', amount: '', method: 'cash', reference_number: '', payment_date: today, remarks: '' }
  }
}

async function startXenditPayment(fee: PaymentRecord, flow: 'invoice' | 'payment-link') {
  if (Number(fee.balance || 0) <= 0) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost<{ checkout_url: string }>('/payments/xendit', {
      trainee_fee_id: fee.trainee_fee_id,
      flow
    })
    if (!response.data?.checkout_url) throw new Error('Xendit did not return a checkout URL.')
    window.location.assign(response.data.checkout_url)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to start Xendit payment.'
  } finally {
    busy.value = false
  }
}

async function uploadProof() {
  if (!proofFile.value) {
    error.value = 'Select your proof file.'
    return
  }
  const form = new FormData()
  Object.entries(proofForm.value).forEach(([key, value]) => form.append(key, value))
  form.append('proof_file', proofFile.value)
  await submit('/payments/proofs', form, 'Proof submitted for verification.')
  proofFile.value = null
}

function onProofFile(event: Event) {
  proofFile.value = (event.target as HTMLInputElement).files?.[0] || null
}

async function reviewProof(proof: PaymentRecord, decision: 'verified' | 'rejected') {
  const remarks = decision === 'rejected'
    ? window.prompt('Enter the reason for rejecting this proof:') || ''
    : window.prompt('Optional remarks for verification:') || ''
  if (decision === 'rejected' && !remarks.trim()) return
  await submit(`/payments/proofs/${proof.proof_id}/review`, { decision, remarks }, `Proof ${decision}.`)
}

function bondForm(id: unknown) {
  const key = String(id)
  if (!bondForms.value[key]) {
    bondForms.value[key] = { action: 'refund', amount: '', transaction_date: today, method: 'bank', reference_number: '', remarks: '' }
  }
  return bondForms.value[key]
}

async function processBond(bond: PaymentRecord) {
  const form = bondForm(bond.trainee_fee_id)
  if (form.action === 'forfeit' && !form.remarks.trim()) {
    error.value = 'A reason is required to forfeit a bond.'
    return
  }
  await submit(`/payments/bonds/${bond.trainee_fee_id}/action`, form, `Bond ${form.action} recorded.`)
}

async function reversePayment(payment: PaymentRecord) {
  const amount = window.prompt(`Amount to reverse (maximum ${money(payment.amount)}):`)
  if (!amount) return
  const remarks = window.prompt('Reason for this reversal:')
  if (!remarks?.trim()) return
  await submit(`/payments/${payment.payment_id}/reverse`, { amount, remarks }, 'Payment reversal recorded.')
}

function feeOption(fee: PaymentRecord) {
  return `${fee.program_name} · ${fee.class_name} · ${fee.trainee_name} · ${fee.fee_name} (balance ${money(fee.balance)})`
}

const reportExportUrl = computed(() => {
  const query = new URLSearchParams({ start_date: startDate.value, end_date: endDate.value })
  if (reportType.value === 'outstanding') query.set('report', 'outstanding')
  query.set('format', 'csv')
  return apiFileUrl(`/payments/report/export?${query}`)
})
const reportPdfUrl = computed(() => {
  const query = new URLSearchParams({ start_date: startDate.value, end_date: endDate.value, format: 'pdf' })
  if (reportType.value === 'outstanding') query.set('report', 'outstanding')
  return apiFileUrl(`/payments/report/export?${query}`)
})

onMounted(async () => {
  try {
    const session = await getSession()
    role.value = session.user?.role || ''
    if (isTrainee.value) view.value = 'my_payments'
    const query = new URLSearchParams(window.location.search)
    const paymentResult = query.get('payment')
    const reference = query.get('reference_id')
    if (isTrainee.value && paymentResult === 'success' && reference) {
      try {
        const response = await apiGet<{ status: 'paid' | 'pending' | 'failed' }>(
          `/payments/xendit/status?reference_id=${encodeURIComponent(reference)}`
        )
        notice.value = response.data.status === 'paid'
          ? 'Payment confirmed and recorded.'
          : 'Payment is being verified. Refresh in a moment to see the updated status.'
      } catch {
        notice.value = 'Payment return received. Its status will update after Xendit confirms it.'
      }
    } else if (isTrainee.value && paymentResult === 'failed') {
      notice.value = 'Payment was not completed. Your fee balance has not changed.'
    }
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load your account.'
  }
})
</script>

<template>
  <div class="page">
    <header class="page-heading">
      <div><p class="eyebrow">SMARTTRACK / FINANCE</p><h1>{{ isTrainee ? 'My payments' : 'Payments' }}</h1><p class="muted">{{ isTrainee ? 'View fees, payment history, receipts, and submit proof.' : 'Cashier, fee setup, bond management, and payment reports.' }}</p></div>
      <button class="secondary-button" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="inline-success" role="status">{{ notice }}</p>
    <p v-if="lastReceiptId" class="receipt-ready"><a :href="apiFileUrl(`/payments/receipt/${lastReceiptId}`)" target="_blank" rel="noopener">Open / print the official receipt PDF</a></p>

    <nav v-if="isStaff" class="tabs" aria-label="Payment sections">
      <button v-for="tab in tabs" :key="tab.id" :class="{ active: view === tab.id }" @click="selectView(tab.id)">{{ tab.label }}</button>
    </nav>

    <template v-if="isTrainee">
      <section class="kpi-grid">
        <article class="kpi"><span>Total outstanding</span><strong>{{ money((data.fees || []).reduce((sum, item) => sum + Number(item.balance || 0), 0)) }}</strong></article>
        <article class="kpi"><span>Fees</span><strong>{{ data.fees?.length || 0 }}</strong></article>
        <article class="kpi"><span>Pending proofs</span><strong>{{ (data.proofs || []).filter((proof) => proof.status === 'pending_verification').length }}</strong></article>
      </section>
      <section class="panel">
        <h2>Fee balances</h2>
        <div class="table-wrap"><table><thead><tr><th>Fee</th><th>Program / class</th><th>Due</th><th>Amount due</th><th>Paid</th><th>Balance</th><th>Bond status</th><th>Action</th></tr></thead>
          <tbody><tr v-for="fee in data.fees || []" :key="String(fee.trainee_fee_id)"><td>{{ fee.fee_name }}</td><td>{{ fee.program_name }} / {{ fee.class_name }}</td><td>{{ fee.due_date || '—' }}</td><td>{{ money(fee.amount_due) }}</td><td>{{ money(fee.amount_paid) }}</td><td>{{ money(fee.balance) }}</td><td>{{ fee.bond_status || '—' }}</td><td><button v-if="Number(fee.balance || 0) > 0" class="text-button" :disabled="busy" @click="startXenditPayment(fee, 'invoice')">Pay online</button><button v-if="Number(fee.balance || 0) > 0" class="text-button" :disabled="busy" @click="startXenditPayment(fee, 'payment-link')">Payment link</button></td></tr><tr v-if="!data.fees?.length"><td colspan="8" class="empty">No fees assigned.</td></tr></tbody>
        </table></div>
      </section>
      <section class="content-grid section">
        <article class="panel">
          <h2>Submit payment proof</h2><p class="muted">JPG, PNG, or PDF up to 5 MB. Reference numbers must be unique.</p>
          <form class="stack-form" @submit.prevent="uploadProof">
            <label>Fee<select v-model="proofForm.trainee_fee_id" required><option value="" disabled>Select fee</option><option v-for="fee in data.fees?.filter((item) => Number(item.balance) > 0) || []" :key="String(fee.trainee_fee_id)" :value="String(fee.trainee_fee_id)">{{ fee.fee_name }} · balance {{ money(fee.balance) }}</option></select></label>
            <label>Amount<input v-model="proofForm.amount" type="number" min="0.01" step="0.01" required></label>
            <label>Method<select v-model="proofForm.method"><option value="bank">Bank</option><option value="gcash">GCash</option><option value="other">Other</option></select></label>
            <label>Reference number<input v-model.trim="proofForm.reference_number" maxlength="100" required></label>
            <label>Date paid<input v-model="proofForm.payment_date" type="date" required></label>
            <label>Proof file<input type="file" accept=".jpg,.jpeg,.png,.pdf" required @change="onProofFile"></label>
            <button class="primary-button" :disabled="busy">{{ busy ? 'Submitting…' : 'Submit proof' }}</button>
          </form>
        </article>
        <article class="panel">
          <h2>Proof history</h2>
          <div class="table-wrap"><table><thead><tr><th>Fee</th><th>Amount</th><th>Reference</th><th>Status</th><th>Remarks</th><th>Proof</th></tr></thead>
            <tbody><tr v-for="proof in data.proofs || []" :key="String(proof.proof_id)"><td>{{ proof.fee_name }}</td><td>{{ money(proof.amount) }}</td><td>{{ proof.reference_number }}</td><td>{{ proof.status }}</td><td>{{ proof.remarks || '—' }}</td><td><a :href="apiFileUrl(`/payments/proof/${proof.proof_id}`)" target="_blank" rel="noopener">View</a></td></tr><tr v-if="!data.proofs?.length"><td colspan="6" class="empty">No proof submissions yet.</td></tr></tbody>
          </table></div>
        </article>
      </section>
      <section class="panel section">
        <h2>Payment history</h2>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Fee</th><th>Amount</th><th>Method</th><th>Reference</th><th>Receipt</th></tr></thead>
          <tbody><tr v-for="payment in data.payments || []" :key="String(payment.payment_id)"><td>{{ payment.payment_date }}</td><td>{{ payment.fee_name }}</td><td>{{ money(payment.amount) }}</td><td>{{ payment.method || '—' }}</td><td>{{ payment.reference_number || '—' }}</td><td><a v-if="payment.receipt_number" :href="apiFileUrl(`/payments/receipt/${payment.payment_id}`)" target="_blank" rel="noopener">{{ payment.receipt_number }}</a><span v-else>Reversal</span></td></tr><tr v-if="!data.payments?.length"><td colspan="6" class="empty">No payments recorded.</td></tr></tbody>
        </table></div>
      </section>
    </template>

    <template v-else-if="isStaff">
      <p v-if="loading" class="muted">Loading payment data…</p>
      <template v-else-if="view === 'cashier'">
        <section class="panel">
          <h2>Record payment</h2>
          <form class="form-grid" @submit.prevent="recordPayment">
            <label>Trainee fee<select v-model="paymentForm.trainee_fee_id" required><option value="" disabled>Select outstanding fee</option><option v-for="fee in data.fees || []" :key="String(fee.trainee_fee_id)" :value="String(fee.trainee_fee_id)">{{ feeOption(fee) }}</option></select></label>
            <label>Amount<input v-model="paymentForm.amount" type="number" min="0.01" step="0.01" required></label>
            <label>Method<select v-model="paymentForm.method"><option value="cash">Cash</option><option value="bank">Bank</option><option value="gcash">GCash</option><option value="other">Other</option></select></label>
            <label>Reference number<input v-model.trim="paymentForm.reference_number" maxlength="100"></label>
            <label>Date paid<input v-model="paymentForm.payment_date" type="date" required></label>
            <label>Remarks<input v-model.trim="paymentForm.remarks" maxlength="1000"></label>
            <button class="primary-button wide" :disabled="busy">{{ busy ? 'Recording…' : 'Record payment and generate receipt' }}</button>
          </form>
        </section>
        <section class="panel section">
          <h2>Payment proofs awaiting review</h2>
          <div class="table-wrap"><table><thead><tr><th>Trainee</th><th>Fee</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th><th>Proof</th><th>Review</th></tr></thead>
            <tbody><tr v-for="proof in data.pending_proofs || []" :key="String(proof.proof_id)"><td>{{ proof.trainee_name }}</td><td>{{ proof.fee_name }}</td><td>{{ money(proof.amount) }}</td><td>{{ proof.method }}</td><td>{{ proof.reference_number }}</td><td>{{ proof.payment_date }}</td><td><a :href="apiFileUrl(`/payments/proof/${proof.proof_id}`)" target="_blank" rel="noopener">View proof</a></td><td class="actions"><button class="text-button approve" :disabled="busy" @click="reviewProof(proof, 'verified')">Verify</button><button class="text-button reject" :disabled="busy" @click="reviewProof(proof, 'rejected')">Reject</button></td></tr><tr v-if="!data.pending_proofs?.length"><td colspan="8" class="empty">No payment proofs pending verification.</td></tr></tbody>
          </table></div>
        </section>
        <section class="panel section">
          <h2>Recent ledger entries</h2>
          <div class="table-wrap"><table><thead><tr><th>Date</th><th>Trainee</th><th>Fee</th><th>Type</th><th>Amount</th><th>Receipt</th><th>Action</th></tr></thead>
            <tbody><tr v-for="payment in data.recent_payments || []" :key="String(payment.payment_id)"><td>{{ payment.payment_date }}</td><td>{{ payment.trainee_name }}</td><td>{{ payment.fee_name }}</td><td>{{ payment.entry_type }}</td><td>{{ money(payment.amount) }}</td><td><a v-if="payment.receipt_number" :href="apiFileUrl(`/payments/receipt/${payment.payment_id}`)" target="_blank" rel="noopener">{{ payment.receipt_number }}</a><span v-else>—</span></td><td><button v-if="payment.entry_type === 'payment'" class="text-button reject" @click="reversePayment(payment)">Reverse</button></td></tr><tr v-if="!data.recent_payments?.length"><td colspan="7" class="empty">No ledger entries.</td></tr></tbody>
          </table></div>
        </section>
      </template>

      <template v-else-if="view === 'fees'">
        <section class="panel">
          <h2>{{ editingFeeId ? 'Edit fee configuration' : 'Configure fee' }}</h2>
          <p class="muted">Program fees apply unless overridden by a class-specific fee. Existing assigned balances are not changed.</p>
          <form class="form-grid" @submit.prevent="saveFee">
            <label>Program<select v-model="feeForm.program_id" required><option value="" disabled>Select program</option><option v-for="program in data.programs || []" :key="String(program.program_id)" :value="String(program.program_id)">{{ program.program_name }}</option></select></label>
            <label>Class override<select v-model="feeForm.class_id"><option value="">All program classes</option><option v-for="item in data.classes?.filter((entry) => !feeForm.program_id || String(entry.program_id) === feeForm.program_id) || []" :key="String(item.class_id)" :value="String(item.class_id)">{{ item.class_name }}</option></select></label>
            <label>Fee type<select v-model="feeForm.fee_kind"><option value="registration">Registration fee</option><option value="bond">Bond deposit</option></select></label>
            <label>Fee name<input v-model.trim="feeForm.fee_name" maxlength="120" required></label>
            <label>Amount<input v-model="feeForm.amount" type="number" min="0.01" step="0.01" required></label>
            <label>Due date<input v-model="feeForm.due_date" type="date"></label>
            <label class="checkbox"><input v-model="feeForm.required_for_certificate" type="checkbox"> Required for certificate eligibility</label>
            <div class="actions wide"><button class="primary-button" :disabled="busy">{{ editingFeeId ? 'Save changes' : 'Create fee' }}</button><button v-if="editingFeeId" type="button" class="secondary-button" @click="resetFeeForm">Cancel</button></div>
          </form>
        </section>
        <section class="panel section"><h2>Fee configurations</h2><div class="table-wrap"><table><thead><tr><th>Fee</th><th>Type</th><th>Program / class</th><th>Amount</th><th>Due date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody><tr v-for="fee in data.fee_types || []" :key="String(fee.fee_type_id)"><td>{{ fee.fee_name }}</td><td>{{ fee.fee_kind }}</td><td>{{ fee.program_name }}<small>{{ fee.class_name || 'All program classes' }}</small></td><td>{{ money(fee.amount) }}</td><td>{{ fee.due_date || '—' }}</td><td>{{ Number(fee.is_active) ? 'Active' : 'Inactive' }}</td><td class="actions"><button class="text-button" @click="editFee(fee)">Edit</button><button v-if="Number(fee.is_active)" class="text-button reject" @click="deactivateFee(fee)">Deactivate</button></td></tr><tr v-if="!data.fee_types?.length"><td colspan="7" class="empty">No fee types configured.</td></tr></tbody>
        </table></div></section>
      </template>

      <template v-else-if="view === 'bonds'">
        <section class="panel"><h2>Bond deposits</h2><div class="table-wrap"><table><thead><tr><th>Trainee</th><th>Class</th><th>Fee</th><th>Held</th><th>Status</th><th>Last action</th><th>Process refund / forfeiture</th></tr></thead>
          <tbody><tr v-for="bond in data.bonds || []" :key="String(bond.trainee_fee_id)">
            <td>{{ bond.trainee_name }}<small>{{ bond.trainee_number }}</small></td><td>{{ bond.class_name }}</td><td>{{ bond.fee_name }}</td><td>{{ money(bond.held_amount) }}</td><td>{{ bond.bond_status }}</td><td>{{ bond.last_action_type ? `${bond.last_action_type} · ${bond.last_action_by} · ${bond.last_action_date}` : '—' }}</td>
            <td><form class="bond-form" @submit.prevent="processBond(bond)">
              <select v-model="bondForm(bond.trainee_fee_id).action"><option value="refund" :disabled="bond.bond_status !== 'refund_pending'">Refund</option><option value="forfeit">Forfeit</option></select>
              <input v-model="bondForm(bond.trainee_fee_id).amount" type="number" min="0.01" step="0.01" :max="Number(bond.held_amount)" placeholder="Amount" required>
              <input v-model="bondForm(bond.trainee_fee_id).transaction_date" type="date" required>
              <select v-if="bondForm(bond.trainee_fee_id).action === 'refund'" v-model="bondForm(bond.trainee_fee_id).method"><option value="cash">Cash</option><option value="bank">Bank</option><option value="gcash">GCash</option><option value="other">Other</option></select>
              <input v-model="bondForm(bond.trainee_fee_id).reference_number" maxlength="100" placeholder="Reference">
              <input v-model="bondForm(bond.trainee_fee_id).remarks" :required="bondForm(bond.trainee_fee_id).action === 'forfeit'" placeholder="Remarks (required for forfeiture)">
              <button class="primary-button" :disabled="busy || Number(bond.held_amount) <= 0">Record</button>
            </form></td>
          </tr><tr v-if="!data.bonds?.length"><td colspan="7" class="empty">No bond deposits.</td></tr></tbody>
        </table></div></section>
      </template>

      <template v-else-if="view === 'reports'">
        <form class="panel report-filters" @submit.prevent="load">
          <label>From<input v-model="startDate" type="date" required></label><label>To<input v-model="endDate" type="date" required></label>
          <label>Report<select v-model="reportType"><option value="collections">Collections and bond transactions</option><option value="outstanding">Outstanding balances</option></select></label>
          <button class="primary-button">Apply</button>
          <a class="secondary-button" :href="reportExportUrl">Export CSV</a><a class="secondary-button" :href="reportPdfUrl" target="_blank" rel="noopener">Print / PDF</a>
        </form>
        <section class="kpi-grid">
          <article class="kpi"><span>Today's collection</span><strong>{{ money(data.summary?.daily_collection) }}</strong></article><article class="kpi"><span>Outstanding balance</span><strong>{{ money(data.summary?.outstanding) }}</strong></article><article class="kpi"><span>Bonds held</span><strong>{{ money(data.summary?.bonds_held) }}</strong></article><article class="kpi"><span>Refunds issued today</span><strong>{{ money(data.summary?.refunds_issued) }}</strong></article>
        </section>
        <section class="panel"><h2>{{ reportType === 'outstanding' ? 'Outstanding balances' : 'Ledger report' }}</h2><div class="table-wrap">
          <table v-if="reportType === 'outstanding'"><thead><tr><th>Trainee</th><th>Class</th><th>Fee</th><th>Type</th><th>Due date</th><th>Balance</th></tr></thead><tbody><tr v-for="row in data.outstanding || []" :key="String(row.trainee_fee_id)"><td>{{ row.trainee_name }}</td><td>{{ row.class_name }}</td><td>{{ row.fee_name }}</td><td>{{ row.fee_kind }}</td><td>{{ row.due_date || '—' }}</td><td>{{ money(row.balance) }}</td></tr><tr v-if="!data.outstanding?.length"><td colspan="6" class="empty">No outstanding balances.</td></tr></tbody></table>
          <table v-else><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Trainee</th><th>Fee</th><th>Amount</th><th>Method</th></tr></thead><tbody><tr v-for="(row, index) in data.report_rows || []" :key="`${row.reference}-${index}`"><td>{{ row.report_date }}</td><td>{{ row.report_type }}</td><td>{{ row.reference || row.reference_number || '—' }}</td><td>{{ row.trainee_name }}</td><td>{{ row.fee_name }}</td><td>{{ money(row.amount) }}</td><td>{{ row.method || '—' }}</td></tr><tr v-if="!data.report_rows?.length"><td colspan="7" class="empty">No transactions in this date range.</td></tr></tbody></table>
        </div></section>
      </template>
    </template>
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

/* ================= Banner ================= */
.page-heading {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
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

/* two coins drift slowly upward behind the heading */
.page-heading::after {
  content: '₱';
  position: absolute;
  right: 12%;
  bottom: -40px;
  display: grid;
  place-items: center;
  width: 74px;
  height: 74px;
  border: 2px solid rgb(143 196 245 / 45%);
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgb(143 196 245 / 35%), rgb(143 196 245 / 8%));
  color: rgb(255 255 255 / 55%);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 34px;
  font-weight: 600;
  box-shadow: -90px 30px 0 -22px rgb(143 196 245 / 16%);
  animation: coin-rise 9s ease-in-out infinite;
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

.loading {
  padding: 24px 0;
  text-align: center;
  animation: breathe 1.4s ease-in-out infinite;
}

/* ================= Panels ================= */
.panel,
.kpi {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
}

.panel {
  margin-top: 18px;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
  animation: rise 0.6s var(--ease) both;
  transition: box-shadow 0.3s ease;
}

.panel:hover {
  box-shadow: 0 16px 34px -20px rgb(17 44 73 / 50%);
}

/* panels that follow each other arrive one after another */
.panel:nth-of-type(2) { animation-delay: 0.08s; }
.panel:nth-of-type(3) { animation-delay: 0.16s; }
.panel:nth-of-type(n + 4) { animation-delay: 0.24s; }

.section {
  margin-top: 18px;
}

.panel h2 {
  margin: 0;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 21px;
  font-weight: 600;
}

.panel > .muted {
  margin: 6px 0 0;
}

/* trainee view: proof form beside proof history */
.content-grid {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.content-grid > .panel {
  margin-top: 0;
}

.content-grid > .panel:first-child {
  animation-name: slide-left;
}

.content-grid > .panel:last-child {
  animation-name: slide-right;
  animation-delay: 0.1s;
}

/* ================= Tabs ================= */
.tabs {
  display: flex;
  gap: 4px;
  overflow: auto;
  margin: 20px 0 0;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  scrollbar-width: none;
  animation: drop-in 0.55s var(--ease) 0.1s both;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tabs button {
  position: relative;
  padding: 10px 18px;
  border: 0;
  border-radius: 9px;
  background: none;
  color: var(--muted);
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s var(--spring), box-shadow 0.25s ease;
}

.tabs button:hover:not(.active) {
  background: var(--field);
  color: var(--navy-deep);
  transform: translateY(-1px);
}

.tabs button.active {
  background: var(--blue);
  color: #fff;
  box-shadow: 0 8px 16px -8px rgb(38 95 148 / 85%);
  animation: tab-pop 0.4s var(--spring);
}

.tabs button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

/* ================= Buttons ================= */
.primary-button,
.secondary-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
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

.primary-button:active:not(:disabled),
.secondary-button:active:not(:disabled) {
  transform: scale(0.97);
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
.text-button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* processing a payment: progress stripe along the bottom edge */
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
  position: relative;
  padding-left: 52px;
  border-left: 3px solid var(--ok);
  background: #e3f4ea;
  color: #1f6b41;
  overflow: hidden;
  animation: pop-in 0.5s var(--spring) both;
}

/* a green tick bursts out beside a saved payment */
.inline-success::before {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 14px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-top: -13px;
  border-radius: 50%;
  background: var(--ok);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  animation: tick-pop 0.55s var(--spring) 0.1s both, ring-green 1.1s ease-out 0.25s 2;
}

/* the receipt notice unrolls like a printed slip */
.receipt-ready {
  position: relative;
  margin: 16px 0 0;
  padding: 14px 16px 14px 56px;
  border-left: 3px solid var(--blue);
  border-bottom: 2px dashed #b6c8de;
  border-radius: 6px 6px 2px 2px;
  background: #e8f1fb;
  animation: receipt-print 0.9s var(--ease) both;
}

.receipt-ready::before {
  content: '₱';
  position: absolute;
  top: 50%;
  left: 14px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-top: -15px;
  border-radius: 50%;
  background: var(--blue);
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 16px;
  font-weight: 700;
  animation: ping-blue 2.4s ease-out 1s infinite;
}

.receipt-ready a {
  color: var(--blue);
  font-weight: 700;
  text-decoration: none;
  background: linear-gradient(var(--sky), var(--sky)) 0 100% / 0 2px no-repeat;
  transition: background-size 0.35s var(--ease), color 0.2s ease;
}

.receipt-ready a:hover {
  color: var(--navy-deep);
  background-size: 100% 2px;
}

/* ================= KPI cards ================= */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin: 18px 0;
}

.kpi {
  position: relative;
  border-top: 3px solid var(--blue);
  overflow: hidden;
  animation: pop-in 0.6s var(--spring) both;
  transition: transform 0.3s var(--ease), box-shadow 0.3s ease;
}

.kpi:nth-child(1) { animation-delay: 0.05s; }
.kpi:nth-child(2) { animation-delay: 0.12s; }
.kpi:nth-child(3) { animation-delay: 0.19s; }
.kpi:nth-child(4) { animation-delay: 0.26s; }
.kpi:nth-child(5) { animation-delay: 0.33s; }
.kpi:nth-child(n + 6) { animation-delay: 0.4s; }

.kpi:nth-child(4n + 2) {
  border-top-color: var(--sky);
}

.kpi:nth-child(4n + 3) {
  border-top-color: var(--ok);
}

.kpi:nth-child(4n) {
  border-top-color: var(--warn);
}

/* a coin shine sweeps across the card on hover */
.kpi::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -60%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgb(143 196 245 / 35%), transparent);
  transform: skewX(-20deg);
  pointer-events: none;
}

.kpi:hover {
  transform: translateY(-5px);
  box-shadow: 0 22px 34px -22px rgb(17 44 73 / 60%);
}

.kpi:hover::after {
  animation: sheen 0.9s ease both;
}

.kpi span {
  display: block;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.kpi strong {
  display: block;
  margin-top: 8px;
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.1;
  animation: amount-in 0.8s var(--ease) 0.3s both;
}

/* ================= Forms ================= */
.form-grid,
.stack-form,
.report-filters {
  display: grid;
  gap: 16px;
  align-items: end;
}

.form-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18px;
}

.stack-form {
  grid-template-columns: 1fr;
  margin-top: 18px;
}

.report-filters {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 18px 0;
  box-shadow: 0 8px 24px -18px rgb(17 44 73 / 45%);
}

/* fields appear one after another */
.form-grid > *,
.stack-form > * {
  animation: rise 0.5s var(--ease) both;
}

.form-grid > :nth-child(1),
.stack-form > :nth-child(1) { animation-delay: 0.15s; }
.form-grid > :nth-child(2),
.stack-form > :nth-child(2) { animation-delay: 0.2s; }
.form-grid > :nth-child(3),
.stack-form > :nth-child(3) { animation-delay: 0.25s; }
.form-grid > :nth-child(4),
.stack-form > :nth-child(4) { animation-delay: 0.3s; }
.form-grid > :nth-child(5),
.stack-form > :nth-child(5) { animation-delay: 0.35s; }
.form-grid > :nth-child(6),
.stack-form > :nth-child(6) { animation-delay: 0.4s; }
.form-grid > :nth-child(n + 7),
.stack-form > :nth-child(n + 7) { animation-delay: 0.45s; }

.form-grid label,
.stack-form label,
.report-filters label {
  display: grid;
  gap: 7px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.form-grid label:has(input:focus, select:focus),
.stack-form label:has(input:focus, select:focus),
.report-filters label:has(input:focus, select:focus) {
  color: var(--blue);
}

.form-grid input,
.form-grid select,
.stack-form input,
.stack-form select,
.report-filters input,
.report-filters select,
.bond-form input,
.bond-form select {
  min-width: 0;
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
}

.form-grid input:hover,
.form-grid select:hover,
.stack-form input:hover,
.stack-form select:hover,
.report-filters input:hover,
.report-filters select:hover {
  border-color: #b6c8de;
}

.form-grid input:focus,
.form-grid select:focus,
.stack-form input:focus,
.stack-form select:focus,
.report-filters input:focus,
.report-filters select:focus,
.bond-form input:focus,
.bond-form select:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 20px -14px rgb(38 95 148 / 55%);
}

.form-grid input:focus,
.form-grid select:focus,
.stack-form input:focus,
.stack-form select:focus {
  transform: translateY(-1px);
}

/* amount fields use a larger, easier-to-read figure */
.form-grid input[type='number'],
.stack-form input[type='number'] {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

/* proof upload: a drop zone that invites the file */
.stack-form input[type='file'] {
  padding: 18px 12px;
  border: 2px dashed #b6c8de;
  border-radius: 12px;
  background:
    repeating-linear-gradient(135deg, rgb(143 196 245 / 0%) 0 12px, rgb(143 196 245 / 14%) 12px 24px),
    #f9fbfe;
  background-size: 34px 34px, auto;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  animation: rise 0.5s var(--ease) 0.4s both, zone-breathe 3s ease-in-out 1.4s infinite;
  transition: border-color 0.25s ease, background-color 0.25s ease, transform 0.3s var(--spring);
}

.stack-form input[type='file']:hover {
  border-color: var(--blue);
  background-color: #eef5fd;
  transform: scale(1.015);
  animation: rise 0.5s var(--ease) 0.4s both, stripes 1.2s linear infinite;
}

.stack-form input[type='file']::file-selector-button {
  margin-right: 12px;
  padding: 7px 12px;
  border: 0;
  border-radius: 6px;
  background: var(--blue);
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s var(--spring);
}

.stack-form input[type='file']::file-selector-button:hover {
  background: var(--blue-hover);
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

.checkbox input {
  width: 18px !important;
  min-height: 0 !important;
  height: 18px;
  accent-color: var(--blue);
}

.actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* ================= Tables: ledger entries ================= */
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
  animation: ledger-in 0.5s var(--ease) both;
  transition: background 0.2s ease, box-shadow 0.25s ease;
}

tbody tr:nth-child(1) { animation-delay: 0.25s; }
tbody tr:nth-child(2) { animation-delay: 0.31s; }
tbody tr:nth-child(3) { animation-delay: 0.37s; }
tbody tr:nth-child(4) { animation-delay: 0.43s; }
tbody tr:nth-child(5) { animation-delay: 0.49s; }
tbody tr:nth-child(6) { animation-delay: 0.55s; }
tbody tr:nth-child(7) { animation-delay: 0.61s; }
tbody tr:nth-child(8) { animation-delay: 0.67s; }
tbody tr:nth-child(n + 9) { animation-delay: 0.73s; }

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
  background: linear-gradient(var(--sky), var(--sky)) 0 100% / 0 2px no-repeat;
  transition: background-size 0.3s var(--ease), color 0.2s ease;
}

td a:hover {
  color: var(--navy-deep);
  background-size: 100% 2px;
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--muted);
}

.text-button {
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--blue);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s var(--spring);
}

.text-button:hover:not(:disabled) {
  background: var(--field);
  transform: translateY(-1px);
}

.text-button:active:not(:disabled) {
  transform: scale(0.94);
}

.text-button:disabled {
  opacity: 0.5;
  cursor: wait;
}

/* verify / approve: friendly green */
.approve {
  color: var(--ok);
}

.approve:hover:not(:disabled) {
  background: #e3f4ea;
  color: #1f6b41;
}

/* reject / reverse: the button trembles once as a warning */
.reject {
  color: var(--danger);
}

.reject:hover:not(:disabled) {
  background: #fdeceb;
  color: var(--danger);
  animation: tremble 0.35s ease 1;
}

/* ================= Bond processing form ================= */
.bond-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(95px, 1fr));
  gap: 6px;
  min-width: 380px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f9fbfe;
  transition: border-color 0.25s ease, box-shadow 0.3s ease, background 0.25s ease;
}

/* the form you are working in lifts and glows */
.bond-form:focus-within {
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 14px 26px -18px rgb(38 95 148 / 60%);
}

.bond-form input,
.bond-form select {
  min-height: 38px;
  padding: 7px 10px;
  font-size: 13px;
}

.bond-form button {
  grid-column: 1 / -1;
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

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.84);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes tab-pop {
  0% {
    transform: scale(0.9);
  }
  100% {
    transform: none;
  }
}

/* amounts count up into place */
@keyframes amount-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.92);
    filter: blur(3px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}

@keyframes ledger-in {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* the receipt prints from the top down */
@keyframes receipt-print {
  from {
    opacity: 0;
    clip-path: inset(0 0 100% 0);
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    clip-path: inset(0 0 0 0);
    transform: none;
  }
}

@keyframes coin-rise {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-34px) rotate(14deg);
  }
}

@keyframes sheen {
  from {
    left: -60%;
  }
  to {
    left: 140%;
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

@keyframes ring-green {
  0% {
    box-shadow: 0 0 0 0 rgb(45 138 87 / 55%);
  }
  100% {
    box-shadow: 0 0 0 14px rgb(45 138 87 / 0%);
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

@keyframes tremble {
  25% {
    transform: translateX(-2px) rotate(-1deg);
  }
  50% {
    transform: translateX(2px) rotate(1deg);
  }
  75% {
    transform: translateX(-1px);
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
  .content-grid {
    grid-template-columns: 1fr;
  }

  .content-grid > .panel:first-child,
  .content-grid > .panel:last-child {
    animation-name: rise;
  }
}

@media (max-width: 850px) {
  .form-grid,
  .report-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .page-heading {
    padding: 22px 20px;
  }

  .page-heading::after {
    display: none;
  }

  .page-heading h1 {
    font-size: 26px;
  }

  .form-grid,
  .report-filters {
    grid-template-columns: 1fr;
  }

  .wide {
    grid-column: auto;
  }

  .panel {
    padding: 16px;
  }

  .bond-form {
    min-width: 0;
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page-heading,
  .page-heading::after,
  .loading,
  .panel,
  .tabs,
  .tabs button.active,
  .primary-button:disabled::after,
  .inline-error,
  .inline-success,
  .inline-success::before,
  .receipt-ready,
  .receipt-ready::before,
  .kpi,
  .kpi strong,
  .kpi:hover::after,
  .form-grid > *,
  .stack-form > *,
  .stack-form input[type='file'],
  .stack-form input[type='file']:hover,
  tbody tr,
  .reject:hover:not(:disabled) {
    animation: none;
  }

  .panel,
  .tabs button,
  .primary-button,
  .primary-button::before,
  .secondary-button,
  .kpi,
  .form-grid input,
  .form-grid select,
  .stack-form input,
  .stack-form select,
  .form-grid label,
  .checkbox,
  .text-button,
  .bond-form,
  tbody tr,
  td a,
  .receipt-ready a {
    transition: none;
  }
}
</style>