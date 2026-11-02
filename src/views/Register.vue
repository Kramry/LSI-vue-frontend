<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { register } from '../services/api'

const router = useRouter()
const fullName = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await register(
      fullName.value,
      username.value,
      email.value,
      password.value,
      passwordConfirmation.value
    )
    await router.replace({ name: 'login' })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to create your account.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-page">
    <aside class="brand-panel">
      <div class="brand">
        <img src="/lsi-official-logo.jpg" alt="LSI logo">
        <div class="brand-copy">
          <strong>LSI</strong>
          <span>SmartTrack</span>
        </div>
      </div>

      <div class="pitch">
        <h2>Start your<br><em>training journey.</em></h2>
        <p>Create a SmartTrack trainee account to access your training records and attendance.</p>
      </div>

      <footer>Calapan City, Oriental Mindoro / Philippines</footer>
    </aside>

    <main class="form-panel">
      <form class="register-card" @submit.prevent="submit">
        <p class="eyebrow">Create an account</p>
        <h1>Join SmartTrack</h1>
        <p class="intro">Register as a trainee to get started.</p>

        <label for="full-name">Full name</label>
        <input id="full-name" v-model.trim="fullName" autocomplete="name" required>

        <label for="username">Username</label>
        <input id="username" v-model.trim="username" autocomplete="username" required>

        <label for="email">Email</label>
        <input id="email" v-model.trim="email" type="email" autocomplete="email" required>

        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" minlength="10" autocomplete="new-password" required>

        <label for="password-confirmation">Confirm password</label>
        <input id="password-confirmation" v-model="passwordConfirmation" type="password" minlength="10" autocomplete="new-password" required>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" :disabled="loading">
          <span>{{ loading ? 'Creating account...' : 'Create account' }}</span>
          <span aria-hidden="true">↗</span>
        </button>

        <p class="switch-page">Already have an account? <RouterLink to="/login">Sign in</RouterLink></p>
      </form>
    </main>
  </div>
</template>

<style scoped>
.register-page {
  --navy: #173a60;
  --navy-deep: #112c49;
  --sky: #8fc4f5;
  --text: #1b2a3a;
  --muted: #5d6f82;
  --line: #d5dfeb;
  --field: #eaf0fb;
  --danger: #b4281f;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  min-height: 100vh;
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  color: var(--text);
  background: #fff;
}

.brand-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 64px clamp(32px, 7vw, 110px) 48px;
  color: #fff;
  background: var(--navy);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand img {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: contain;
}

.brand-copy {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.brand-copy strong { font-size: 20px; }
.brand-copy span,
.eyebrow {
  color: var(--sky);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.pitch h2 {
  margin: 0 0 24px;
  font-family: 'Fraunces', Georgia, serif;
  font-size: clamp(40px, 5.4vw, 72px);
  line-height: 1.05;
}

.pitch em { color: var(--sky); }
.pitch p { max-width: 30em; font-size: 18px; line-height: 1.75; }
.brand-panel footer { color: rgb(255 255 255 / 80%); font-size: 14px; }

.form-panel {
  display: grid;
  place-items: center;
  padding: 40px clamp(24px, 6vw, 80px);
}

.register-card {
  display: grid;
  gap: 8px;
  width: min(100%, 440px);
}

.eyebrow { margin: 0; color: var(--muted); }
h1, .intro { margin: 0; }
h1 {
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 38px;
}
.intro { margin-bottom: 14px; color: var(--muted); }
label { margin-top: 6px; font-size: 13px; font-weight: 700; }
input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--field);
}
button {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding: 13px 16px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: var(--navy);
  cursor: pointer;
  font-weight: 700;
}
button:disabled { cursor: wait; opacity: 0.65; }
.form-error { color: var(--danger); font-size: 13px; }
.switch-page { margin: 12px 0 0; color: var(--muted); text-align: center; font-size: 14px; }
.switch-page a { color: var(--navy); font-weight: 700; }

@media (max-width: 760px) {
  .register-page { grid-template-columns: 1fr; }
  .brand-panel { min-height: 260px; padding: 32px 24px; }
  .pitch { margin: 48px 0 20px; }
  .pitch h2 { font-size: 42px; }
}
</style>
