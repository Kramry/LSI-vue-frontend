<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSession, login } from '../services/api'
import { isAnalyticsConsentGranted, setAnalyticsConsent } from '../services/analytics'

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const analyticsConsent = ref(isAnalyticsConsentGranted())

function updateAnalyticsConsent() {
  setAnalyticsConsent(analyticsConsent.value)
}

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

        <label class="analytics-consent">
          <input v-model="analyticsConsent" type="checkbox" @change="updateAnalyticsConsent">
          <span>Allow privacy-safe usage analytics. You can change this after signing in.</span>
        </label>

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
  --field: #eef3fb;
  --danger: #b4281f;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);

  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  min-height: 100vh;
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  color: var(--text);
  background: #fff;
}

/* ================= Left brand panel ================= */
.brand-panel {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 64px clamp(32px, 7vw, 110px) 48px;
  color: #fff;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(60% 50% at 18% 12%, rgb(143 196 245 / 30%), transparent 70%),
    radial-gradient(55% 45% at 90% 85%, rgb(38 95 148 / 65%), transparent 70%),
    linear-gradient(160deg, #1b4470 0%, var(--navy) 45%, var(--navy-deep) 100%);
  background-size: 140% 140%, 140% 140%, 100% 100%;
  animation: aurora 16s ease-in-out infinite alternate;
}

/* drifting diagonal lines */
.brand-panel::before {
  content: '';
  position: absolute;
  inset: -20%;
  z-index: -1;
  background: repeating-linear-gradient(
    135deg,
    transparent 0 120px,
    rgb(255 255 255 / 5%) 120px 121px
  );
  animation: drift 30s linear infinite;
  pointer-events: none;
}

/* soft floating orb */
.brand-panel::after {
  content: '';
  position: absolute;
  right: -90px;
  bottom: 14%;
  z-index: -1;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgb(143 196 245 / 45%), rgb(143 196 245 / 0%) 70%);
  filter: blur(6px);
  animation: float 9s ease-in-out infinite;
  pointer-events: none;
}

.brand-panel > * {
  position: relative;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  animation: fade-down 0.7s var(--ease) both;
}

.brand img {
  display: block;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: contain;
  transition: transform 0.4s var(--ease);
}

.brand:hover img {
  transform: rotate(-8deg) scale(1.08);
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
  animation: rise 0.9s var(--ease) 0.15s both;
}

/* shimmering highlighted line */
.pitch em {
  font-weight: 500;
  background: linear-gradient(100deg, #8fc4f5 20%, #e6f3ff 45%, #8fc4f5 70%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: var(--sky);
  animation: shimmer 5s ease-in-out 1.2s infinite;
}

.pitch p {
  max-width: 30em;
  margin: 0;
  color: rgb(255 255 255 / 88%);
  font-size: 18px;
  line-height: 1.75;
  animation: rise 0.9s var(--ease) 0.3s both;
}

.brand-panel footer {
  color: rgb(255 255 255 / 80%);
  font-size: 14px;
  animation: fade-in 1s ease 0.7s both;
}

/* ================= Right form panel ================= */
.form-panel {
  position: relative;
  min-width: 0;
  display: grid;
  place-items: center;
  padding: 40px clamp(24px, 6vw, 80px);
  overflow: hidden;
  background:
    radial-gradient(45% 40% at 100% 0%, rgb(143 196 245 / 22%), transparent 70%),
    radial-gradient(40% 35% at 0% 100%, rgb(38 95 148 / 8%), transparent 70%),
    #fff;
}

.login-card {
  display: grid;
  gap: 8px;
  width: min(100%, 440px);
}

/* staggered entrance for everything in the card */
.login-card > * {
  animation: rise 0.7s var(--ease) both;
}

.login-card > :nth-child(1) { animation-delay: 0.1s; }
.login-card > :nth-child(2) { animation-delay: 0.17s; }
.login-card > :nth-child(3) { animation-delay: 0.24s; }
.login-card > :nth-child(4) { animation-delay: 0.31s; }
.login-card > :nth-child(5) { animation-delay: 0.38s; }
.login-card > :nth-child(6) { animation-delay: 0.45s; }
.login-card > :nth-child(7) { animation-delay: 0.52s; }
.login-card > :nth-child(8) { animation-delay: 0.59s; }
.login-card > :nth-child(9) { animation-delay: 0.66s; }

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

/* pulsing "secure" dot */
.eyebrow::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2d8a57;
  animation: pulse 2.2s ease-out infinite;
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
  transition: color 0.2s ease;
}

/* label turns blue while its field is focused (works when the input follows the label) */
label:has(+ input:focus) {
  color: var(--blue);
}

input {
  width: 100%;
  padding: 15px 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  font-size: 16px;
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
}

input::placeholder {
  color: #9aabc2;
}

input:hover {
  border-color: #b6c8de;
}

input:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 22px -14px rgb(38 95 148 / 55%);
  transform: translateY(-1px);
}

/* soft browser autofill colour */
input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 100px #e6f0fc inset;
  -webkit-text-fill-color: var(--text);
}

.analytics-consent {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 8px 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  cursor: pointer;
}

.analytics-consent input {
  flex: none;
  width: 16px;
  height: 16px;
  margin: 1px 0 0;
  padding: 0;
  accent-color: var(--blue);
  box-shadow: none;
  transform: none;
}

/* ================= Sign-in button ================= */
button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  padding: 18px 22px;
  border: 0;
  border-radius: 10px;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(135deg, #2c6ba5 0%, var(--blue) 55%, #1f4f7d 100%);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 14px 26px -14px rgb(38 95 148 / 85%);
  transition: transform 0.2s var(--ease), box-shadow 0.25s ease, filter 0.2s ease;
}

/* light sweep across the button on hover */
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
  box-shadow: 0 20px 30px -14px rgb(38 95 148 / 90%);
}

button:hover:not(:disabled)::before {
  left: 130%;
}

button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 8px 16px -10px rgb(38 95 148 / 85%);
}

/* arrow nudges up and to the right */
button > span:last-child {
  display: inline-block;
  transition: transform 0.25s var(--ease);
}

button:hover:not(:disabled) > span:last-child {
  transform: translate(4px, -3px);
}

button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 3px;
}

/* loading: moving stripe along the bottom edge */
button:disabled {
  cursor: wait;
  opacity: 0.85;
}

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

/* ================= Links and errors ================= */
.register-link {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}

.register-link a {
  position: relative;
  color: var(--navy);
  font-weight: 700;
  text-decoration: none;
}

.register-link a::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -2px;
  left: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--sky);
  transform: scaleX(0.3);
  transform-origin: left;
  transition: transform 0.3s var(--ease), background 0.2s ease;
}

.register-link a:hover::after {
  background: var(--blue);
  transform: scaleX(1);
}

.form-error {
  margin: 4px 0 0;
  padding: 10px 12px;
  border-left: 3px solid var(--danger);
  border-radius: 6px;
  background: #fdeceb;
  color: var(--danger);
  font-size: 13px;
  animation: shake 0.45s ease both;
}

/* ================= Keyframes ================= */
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes fade-down {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes aurora {
  from {
    background-position: 0% 0%, 100% 100%, 0 0;
  }
  to {
    background-position: 30% 20%, 70% 80%, 0 0;
  }
}

@keyframes drift {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(121px, 121px, 0);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(-24px, -28px, 0);
  }
}

@keyframes shimmer {
  0%,
  100% {
    background-position: 100% 0;
  }
  50% {
    background-position: 0% 0;
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgb(45 138 87 / 45%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 9px rgb(45 138 87 / 0%);
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

@keyframes load {
  from {
    background-position: -50% 0;
  }
  to {
    background-position: 150% 0;
  }
}

/* ================= Responsive ================= */
@media (max-width: 760px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    gap: 28px;
    padding: 32px 24px;
  }

  .brand-panel::after {
    right: -120px;
    bottom: -40px;
    width: 240px;
    height: 240px;
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

  h1 {
    font-size: 32px;
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .brand-panel,
  .brand-panel::before,
  .brand-panel::after,
  .brand,
  .pitch h2,
  .pitch em,
  .pitch p,
  .brand-panel footer,
  .login-card > *,
  .eyebrow::before,
  .form-error,
  button:disabled::after {
    animation: none;
  }

  input,
  button,
  button::before,
  button > span:last-child,
  .register-link a::after {
    transition: none;
  }
}
</style>