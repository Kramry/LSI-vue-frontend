<script setup lang="ts">
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
      <p class="muted">{{ trainee.qr_code || 'QR code is managed by the training center.' }}</p>
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  --text: #1b2a3a;
  --muted: #5d6f82;
  --line: #d7e1ec;
  --blue: #265f94;
  --ok: #2d8a57;
  display: grid;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
}
.page-header { padding: 8px 0; }
.eyebrow { margin: 0 0 8px; color: var(--blue); font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
h1, h2 { margin: 0; font-family: Georgia, serif; }
h1 { font-size: clamp(32px, 5vw, 48px); }
h2 { margin-bottom: 20px; font-size: 25px; }
.lead, .muted { color: var(--muted); }
.panel { padding: 24px; border: 1px solid var(--line); border-radius: 10px; background: #fff; box-shadow: 0 12px 30px rgb(23 58 96 / 7%); }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.form-grid { display: grid; gap: 14px; }
label { display: grid; gap: 7px; color: var(--muted); font-size: 13px; font-weight: 700; }
input { box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; color: var(--text); font: inherit; }
input:disabled { background: #eef2ed; color: #708071; }
button { width: fit-content; padding: 10px 16px; border: 0; border-radius: 5px; background: var(--blue); color: #fff; font-weight: 700; cursor: pointer; }
button:disabled { opacity: .6; cursor: wait; }
.secondary-button { border: 1px solid #c5d5e5; background: #f7fafc; color: var(--blue); }
.inline-error { padding: 10px 12px; border-left: 3px solid #c52d2d; background: #fff0f0; color: #b4281f; }
.inline-success { color: var(--ok); font-weight: 700; }
.trainee-id { max-width: 310px; text-align: center; }
@media (max-width: 760px) { .profile-grid { grid-template-columns: 1fr; } }
</style>
