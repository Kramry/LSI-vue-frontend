<script setup lang="ts">
import QRCode from 'qrcode'
import { onMounted, ref } from 'vue'
import { apiGet, apiPost } from '../services/api'

interface ProfileUser {
  user_id: number
  full_name: string
  username: string
  role: string
}

interface TraineeProfile {
  trainee_id: number
  first_name: string
  last_name: string
  contact_number: string
  qr_code?: string
}

const user = ref<ProfileUser | null>(null)
const trainee = ref<TraineeProfile | null>(null)
const qrImage = ref('')
const loading = ref(true)
const savingProfile = ref(false)
const savingPassword = ref(false)
const error = ref('')
const notice = ref('')
const profileForm = ref({ full_name: '', first_name: '', last_name: '', contact_number: '' })
const passwordForm = ref({ current_password: '', new_password: '' })

async function loadProfile() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiGet<{ user: ProfileUser; trainee: TraineeProfile | null }>('/modules/profile')
    user.value = response.data.user
    trainee.value = response.data.trainee
    qrImage.value = trainee.value?.qr_code
      ? await QRCode.toDataURL(trainee.value.qr_code, { margin: 2, width: 220 })
      : ''
    profileForm.value = trainee.value
      ? {
          full_name: '',
          first_name: trainee.value.first_name,
          last_name: trainee.value.last_name,
          contact_number: trainee.value.contact_number
        }
      : { full_name: user.value.full_name, first_name: '', last_name: '', contact_number: '' }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load your profile.'
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  savingProfile.value = true
  error.value = ''
  notice.value = ''
  try {
    const body = trainee.value
      ? {
          first_name: profileForm.value.first_name,
          last_name: profileForm.value.last_name,
          contact_number: profileForm.value.contact_number
        }
      : { full_name: profileForm.value.full_name }
    const response = await apiPost<{ user: ProfileUser }>('/profile/save', body)
    if (response.data.user) user.value = response.data.user
    notice.value = response.message || 'Profile updated.'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to update your profile.'
  } finally {
    savingProfile.value = false
  }
}

async function savePassword() {
  savingPassword.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await apiPost('/profile/password', passwordForm.value)
    passwordForm.value = { current_password: '', new_password: '' }
    notice.value = response.message || 'Password updated.'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to update your password.'
  } finally {
    savingPassword.value = false
  }
}

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <main class="profile-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">SMARTTRACK / ACCOUNT</p>
        <h1>My profile</h1>
        <p class="lead">Update your account details and password.</p>
      </div>
    </header>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="inline-success" role="status">{{ notice }}</p>
    <p v-if="loading" class="muted">Loading your profile...</p>

    <div v-else class="profile-grid">
      <section class="panel">
        <p class="eyebrow">Personal details</p>
        <h2>Account profile</h2>
        <form class="form-grid" @submit.prevent="saveProfile">
          <template v-if="trainee">
            <label>First name<input v-model.trim="profileForm.first_name" required></label>
            <label>Last name<input v-model.trim="profileForm.last_name" required></label>
            <label>Contact number<input v-model.trim="profileForm.contact_number" maxlength="20" required></label>
          </template>
          <label v-else>Full name<input v-model.trim="profileForm.full_name" maxlength="150" required></label>
          <label>Username<input :value="user?.username" disabled></label>
          <button class="primary-button" type="submit" :disabled="savingProfile">
            {{ savingProfile ? 'Saving...' : 'Save profile' }}
          </button>
        </form>
      </section>

      <section class="panel">
        <p class="eyebrow">Credentials</p>
        <h2>Change password</h2>
        <form class="form-grid" @submit.prevent="savePassword">
          <label>Current password<input v-model="passwordForm.current_password" type="password" required></label>
          <label>New password<input v-model="passwordForm.new_password" type="password" minlength="10" required></label>
          <button class="secondary-button" type="submit" :disabled="savingPassword">
            {{ savingPassword ? 'Updating...' : 'Update password' }}
          </button>
        </form>
      </section>
    </div>

    <section v-if="trainee" class="panel trainee-id">
      <p class="eyebrow">Trainee QR ID</p>
      <h2>{{ trainee.first_name }} {{ trainee.last_name }}</h2>
      <img v-if="qrImage" class="qr-image" :src="qrImage" :alt="`QR code for ${trainee.first_name} ${trainee.last_name}`">
      <p class="muted">{{ trainee.qr_code || 'QR code is managed by the training center.' }}</p>
    </section>
  </main>
</template>

<style scoped>
.profile-page {
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

/* ================= Banner ================= */
.page-header {
  position: relative;
  padding: 28px 30px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(120deg, var(--navy) 0%, #1b4470 60%, var(--navy) 100%);
  overflow: hidden;
  animation: drop-in 0.6s var(--ease) both;
}

.page-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, transparent 0 120px, rgb(255 255 255 / 4%) 120px 121px);
  pointer-events: none;
}

/* a ring of light slowly circles behind the heading, like an avatar halo */
.page-header::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 8%;
  width: 150px;
  height: 150px;
  margin-top: -75px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, rgb(143 196 245 / 55%), transparent 35%, rgb(143 196 245 / 35%) 65%, transparent);
  -webkit-mask: radial-gradient(circle, transparent 58%, #000 60% 66%, transparent 68%);
  mask: radial-gradient(circle, transparent 58%, #000 60% 66%, transparent 68%);
  animation: spin 9s linear infinite;
  pointer-events: none;
}

.page-header > * {
  position: relative;
  z-index: 1;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: var(--sky);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.eyebrow::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5fd08c;
  animation: ping 2.2s ease-out infinite;
}

h1,
h2 {
  margin: 0;
  font-family: 'Fraunces', Georgia, serif;
}

h1 {
  color: #fff;
  font-size: clamp(30px, 5vw, 44px);
  font-weight: 600;
  letter-spacing: -0.01em;
}

h2 {
  margin-bottom: 20px;
  color: var(--navy-deep);
  font-size: 24px;
  font-weight: 600;
}

.lead,
.muted {
  color: var(--muted);
}

.page-header .lead {
  margin: 8px 0 0;
  color: rgb(255 255 255 / 80%);
}

/* ================= Panels ================= */
.panel {
  position: relative;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 30px -18px rgb(23 58 96 / 35%);
  animation: rise 0.65s var(--ease) 0.15s both;
  transition: box-shadow 0.3s ease, transform 0.3s var(--ease);
}

.panel:hover {
  box-shadow: 0 20px 38px -20px rgb(23 58 96 / 45%);
}

/* the blue tab on top of each panel draws itself in */
.panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 24px;
  width: 64px;
  height: 4px;
  border-radius: 0 0 6px 6px;
  background: linear-gradient(90deg, var(--blue), var(--sky));
  transform-origin: left;
  animation: tab-draw 0.7s var(--ease) 0.4s both;
}

/* the two columns arrive from opposite sides */
.profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.profile-grid > .panel:nth-child(odd) {
  animation-name: slide-left;
  animation-delay: 0.15s;
}

.profile-grid > .panel:nth-child(even) {
  animation-name: slide-right;
  animation-delay: 0.25s;
}

/* ================= Forms ================= */
.form-grid {
  display: grid;
  gap: 14px;
}

/* fields appear one after another */
.form-grid > * {
  animation: rise 0.5s var(--ease) both;
}

.form-grid > :nth-child(1) { animation-delay: 0.35s; }
.form-grid > :nth-child(2) { animation-delay: 0.41s; }
.form-grid > :nth-child(3) { animation-delay: 0.47s; }
.form-grid > :nth-child(4) { animation-delay: 0.53s; }
.form-grid > :nth-child(5) { animation-delay: 0.59s; }
.form-grid > :nth-child(6) { animation-delay: 0.65s; }
.form-grid > :nth-child(n + 7) { animation-delay: 0.71s; }

label {
  display: grid;
  gap: 7px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  transition: color 0.2s ease;
}

label:has(input:focus) {
  color: var(--blue);
}

input {
  box-sizing: border-box;
  width: 100%;
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
}

input:hover:not(:disabled) {
  border-color: #b6c8de;
}

input:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 20px -14px rgb(38 95 148 / 55%);
  transform: translateY(-1px);
}

/* locked fields look "hatched" and give a tiny nudge when you try them */
input:disabled {
  border-style: dashed;
  background:
    repeating-linear-gradient(135deg, rgb(143 196 245 / 0%) 0 8px, rgb(143 196 245 / 12%) 8px 16px),
    #f1f5f9;
  color: #6b7f86;
  cursor: not-allowed;
}

input:disabled:active {
  animation: nudge 0.3s ease;
}

/* ================= Buttons ================= */
button {
  position: relative;
  width: fit-content;
  padding: 11px 18px;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(135deg, #2c6ba5 0%, var(--blue) 60%, #1f4f7d 100%);
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 12px 22px -14px rgb(38 95 148 / 85%);
  transition: transform 0.2s var(--spring), box-shadow 0.25s ease, background 0.2s ease;
}

/* light sweep on hover */
button::before {
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

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 18px 26px -14px rgb(38 95 148 / 90%);
}

button:hover:not(:disabled)::before {
  left: 130%;
}

button:active:not(:disabled) {
  transform: scale(0.97);
}

button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

button:disabled {
  opacity: 0.75;
  cursor: wait;
}

/* saving: progress stripe along the bottom edge */
button:disabled::after {
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

.secondary-button {
  border: 1px solid #c5d5e5;
  background: #f7fafc;
  color: var(--blue);
  box-shadow: none;
}

.secondary-button:hover:not(:disabled) {
  background: #e8f1fb;
  box-shadow: 0 12px 20px -16px rgb(38 95 148 / 60%);
}

.secondary-button::before {
  display: none;
}

/* ================= Messages ================= */
.inline-error {
  padding: 10px 12px;
  border-left: 3px solid var(--danger);
  border-radius: 6px;
  background: #fdeceb;
  color: var(--danger);
  animation: shake 0.45s ease both;
}

/* a saved change shows a green tick that pops in */
.inline-success {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ok);
  font-weight: 700;
  animation: pop-in 0.5s var(--spring) both;
}

.inline-success::before {
  content: '✓';
  display: grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--ok);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  animation: tick-pop 0.55s var(--spring) 0.1s both, ring-green 1.1s ease-out 0.2s 2;
}

/* ================= Trainee QR ID ================= */
.trainee-id {
  position: relative;
  max-width: 310px;
  text-align: center;
  animation: card-in 0.8s var(--spring) 0.45s both;
  transition: transform 0.45s var(--spring), filter 0.3s ease;
}

.trainee-id:hover {
  transform: translateY(-4px) rotate(-1.2deg);
}

/* the QR sits on a small card with a soft shadow */
.qr-image {
  display: block;
  width: 220px;
  height: 220px;
  margin: 0 auto 12px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 34px -22px rgb(17 44 73 / 60%);
  transition: box-shadow 0.3s ease;
}

.trainee-id:hover .qr-image {
  box-shadow: 0 28px 42px -22px rgb(17 44 73 / 70%);
}

/* a scanner beam sweeps over the QR code every few seconds */
.trainee-id::before {
  content: '';
  position: absolute;
  top: 10px;
  left: 50%;
  z-index: 1;
  width: 200px;
  height: 2px;
  margin-left: -100px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--sky), transparent);
  box-shadow: 0 0 12px rgb(143 196 245 / 90%);
  opacity: 0;
  animation: qr-beam 5s ease-in-out 1.4s infinite;
  pointer-events: none;
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
  from {
    opacity: 0;
    transform: scale(0.82);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* the ID card swings in like it is hanging from a lanyard */
@keyframes card-in {
  0% {
    opacity: 0;
    transform: translateY(-24px) rotate(-6deg);
  }
  60% {
    opacity: 1;
    transform: translateY(4px) rotate(1.5deg);
  }
  100% {
    transform: none;
  }
}

@keyframes qr-beam {
  0% {
    top: 10px;
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  45% {
    top: 222px;
    opacity: 1;
  }
  55%,
  100% {
    top: 222px;
    opacity: 0;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ping {
  0% {
    box-shadow: 0 0 0 0 rgb(95 208 140 / 65%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 9px rgb(95 208 140 / 0%);
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
    box-shadow: 0 0 0 12px rgb(45 138 87 / 0%);
  }
}

@keyframes nudge {
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
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
@media (max-width: 760px) {
  .profile-page {
    gap: clamp(0.875rem, 4vw, 1.25rem);
  }

  .profile-grid {
    grid-template-columns: 1fr;
  }

  .profile-grid > .panel:nth-child(odd),
  .profile-grid > .panel:nth-child(even) {
    animation-name: rise;
  }

  .page-header {
    padding: 22px 20px;
  }

  .page-header h1 {
    font-size: clamp(1.5rem, 8vw, 1.875rem);
  }

  .page-header::after {
    display: none;
  }

  .panel {
    padding: 18px;
  }

  .form-grid,
  .panel,
  label,
  input,
  button {
    min-width: 0;
  }

  .qr-image {
    width: 100%;
    max-width: 240px;
    height: auto;
    aspect-ratio: 1;
  }

  .trainee-id::before {
    display: none;
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .page-header,
  .page-header::after,
  .eyebrow::before,
  .panel,
  .panel::before,
  .profile-grid > .panel,
  .form-grid > *,
  button:disabled::after,
  .inline-error,
  .inline-success,
  .inline-success::before,
  .trainee-id,
  .trainee-id::before,
  input:disabled:active {
    animation: none;
  }

  .panel,
  label,
  input,
  button,
  button::before,
  .trainee-id,
  .qr-image {
    transition: none;
  }
}
</style>