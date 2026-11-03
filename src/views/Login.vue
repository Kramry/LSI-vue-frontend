<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSession, login } from '../services/api'

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

function safeRedirect(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/dashboard'
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await login(username.value, password.value)
    await router.replace(safeRedirect(route.query.redirect))
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to sign in.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const session = await getSession()
    if (session.authenticated) {
      await router.replace(safeRedirect(route.query.redirect))
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to connect to SmartTrack.'
  }
})
</script>

<template>
  <div class="login-page">
    <aside class="brand-panel">
      <div class="brand">
        <img src="/lsi-official-logo.jpg" alt="LSI logo">
        <div class="brand-copy">
          <strong>LSI</strong>
          <span>SmartTrack</span>
        </div>
      </div>

      <div class="pitch">
        <h2>LANGUAGE SKILLS INSTITUTE,<br><em>Oriental Mindoro.</em></h2>
        <p>
          Empowering Communication, Building Futures.
        </p>
      </div>

      <footer>Calapan City, Oriental Mindoro / Philippines</footer>
    </aside>

    <main class="form-panel">
      <form class="login-card" @submit.prevent="submit">
        <p class="eyebrow">Secure access</p>
        <h1>Welcome back</h1>
        <p class="intro">Sign in with your SmartTrack account.</p>

        <label for="username">Username</label>
        <input id="username" v-model.trim="username" autocomplete="username" required>

        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" :disabled="loading">
          <span>{{ loading ? 'Signing in...' : 'Sign in' }}</span>
          <span aria-hidden="true">↗</span>
        </button>

        <p class="register-link">Need an account? <RouterLink to="/register">Register here</RouterLink></p>
      </form>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  --navy: #173a60;
  --navy-deep: #112c49;
  --blue: #265f94;
  --blue-hover: #1f4f7d;
  --sky: #8fc4f5;
  --text: #1b2a3a;
  --muted: #5d6f82;
  --line: #d5dfeb;
  --field: #eaf0fb;
  --danger: #b4281f;

  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  min-height: 100vh;
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  color: var(--text);
  background: #fff;
}

/* ---------- Left brand panel ---------- */
.brand-panel {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 64px clamp(32px, 7vw, 110px) 48px;
  color: #fff;
  background: var(--navy);
  overflow: hidden;
}

.brand-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    135deg,
    transparent 0 120px,
    rgb(255 255 255 / 4%) 120px 121px
  );
  pointer-events: none;
}

.brand-panel > * {
  position: relative;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand img {
  display: block;
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

.brand-copy strong {
  font-size: 20px;
  font-weight: 700;
}

.brand-copy span {
  color: var(--sky);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.pitch h2 {
  margin: 0 0 24px;
  font-family: 'Fraunces', Georgia, serif;
  font-size: clamp(40px, 5vw, 72px);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.pitch em {
  color: var(--sky);
  font-weight: 500;
}

.pitch p {
  max-width: 30em;
  margin: 0;
  color: rgb(255 255 255 / 88%);
  font-size: 18px;
  line-height: 1.75;
}

.brand-panel footer {
  color: rgb(255 255 255 / 80%);
  font-size: 14px;
}

/* ---------- Right form panel ---------- */
.form-panel {
  min-width: 0;
  display: grid;
  place-items: center;
  padding: 40px clamp(24px, 6vw, 80px);
  background: #fff;
}

.login-card {
  display: grid;
  gap: 8px;
  width: min(100%, 440px);
}

.eyebrow {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1,
.intro {
  margin: 0;
}

h1 {
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 38px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.intro {
  margin-bottom: 22px;
  color: var(--muted);
  font-size: 16px;
}

label {
  margin-top: 6px;
  color: var(--navy-deep);
  font-size: 14px;
  font-weight: 600;
}

input {
  width: 100%;
  padding: 15px 16px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  font-size: 16px;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

input:hover {
  border-color: #b6c8de;
}

input:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 18%);
}

button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  padding: 18px 22px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  background: var(--blue);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

button:hover:not(:disabled) {
  background: var(--blue-hover);
}

button:active:not(:disabled) {
  transform: translateY(1px);
}

button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.register-link {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}

.register-link a {
  color: var(--navy);
  font-weight: 700;
}

.form-error {
  margin: 4px 0 0;
  padding: 10px 12px;
  border-left: 3px solid var(--danger);
  border-radius: 4px;
  background: #fdeceb;
  color: var(--danger);
  font-size: 13px;
}

/* ---------- Responsive ---------- */
@media (max-width: 760px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    gap: 28px;
    padding: 32px 24px;
  }

  .pitch h2 {
    font-size: 36px;
  }

  .pitch p,
  .brand-panel footer {
    display: none;
  }

  .form-panel {
    align-items: start;
    padding-top: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  input,
  button {
    transition: none;
  }
}
</style>