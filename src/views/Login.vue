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
/* Registered so the angle can be animated (conic borders / orbit) */
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.login-page {
  --navy: #173a60;
  --navy-deep: #0d2239;
  --ink: #081727;
  --blue: #2a6aa8;
  --blue-hover: #215a92;
  --sky: #8fc4f5;
  --ice: #e6f3ff;
  --gold: #e8c98a;
  --text: #16263a;
  --muted: #5d6f82;
  --line: #d9e2ee;
  --field: #f1f5fb;
  --danger: #b4281f;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");

  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
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
    /* film grain */
    var(--grain),
    /* light leak, top left */
    radial-gradient(50% 42% at 12% 8%, rgb(143 196 245 / 38%), transparent 70%),
    /* warm kiss, lower middle */
    radial-gradient(30% 26% at 55% 92%, rgb(232 201 138 / 16%), transparent 70%),
    /* deep blue pool, right */
    radial-gradient(55% 50% at 100% 70%, rgb(42 106 168 / 70%), transparent 72%),
    linear-gradient(165deg, #1d4a79 0%, var(--navy) 38%, var(--navy-deep) 78%, var(--ink) 100%);
  background-size: 180px 180px, 140% 140%, 140% 140%, 140% 140%, 100% 100%;
  background-blend-mode: soft-light, normal, normal, normal, normal;
  animation: aurora 18s ease-in-out infinite alternate;
}

/* concentric orbit rings that slowly rotate, faded toward the corners */
.brand-panel::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 62%;
  z-index: -1;
  width: 150%;
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 50%;
  background:
    repeating-radial-gradient(
      circle at center,
      transparent 0 70px,
      rgb(255 255 255 / 7%) 70px 71px
    ),
    conic-gradient(
      from var(--angle),
      transparent 0deg,
      rgb(143 196 245 / 22%) 40deg,
      transparent 90deg,
      transparent 200deg,
      rgb(232 201 138 / 14%) 240deg,
      transparent 290deg
    );
  -webkit-mask-image: radial-gradient(circle at center, transparent 8%, #000 30%, transparent 62%);
  mask-image: radial-gradient(circle at center, transparent 8%, #000 30%, transparent 62%);
  animation: orbit 48s linear infinite;
  pointer-events: none;
}

/* glass sphere with a lit edge */
.brand-panel::after {
  content: '';
  position: absolute;
  right: clamp(-90px, -4vw, -30px);
  bottom: 16%;
  z-index: -1;
  width: clamp(200px, 22vw, 340px);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 26%, rgb(255 255 255 / 55%), rgb(255 255 255 / 0%) 34%),
    radial-gradient(circle at 50% 50%, rgb(143 196 245 / 28%), rgb(143 196 245 / 6%) 62%, transparent 72%),
    conic-gradient(from var(--angle), rgb(143 196 245 / 0%), rgb(143 196 245 / 55%), rgb(143 196 245 / 0%) 55%);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 18%),
    inset -20px -30px 60px rgb(8 23 39 / 55%),
    0 40px 80px -30px rgb(8 23 39 / 80%);
  backdrop-filter: blur(6px);
  animation: float 11s ease-in-out infinite, orbit 22s linear infinite;
  pointer-events: none;
}

.brand-panel > * {
  position: relative;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  animation: fade-down 0.8s var(--ease) both;
}

.brand img {
  display: block;
  width: 42px;
  height: 42px;
  padding: 4px;
  border-radius: 12px;
  object-fit: contain;
  background: rgb(255 255 255 / 10%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 22%), 0 10px 24px -10px rgb(0 0 0 / 55%);
  backdrop-filter: blur(8px);
  transition: transform 0.5s var(--ease);
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
  letter-spacing: -0.01em;
}

.brand-copy span {
  padding: 3px 9px;
  border-radius: 999px;
  background: rgb(143 196 245 / 12%);
  box-shadow: inset 0 0 0 1px rgb(143 196 245 / 35%);
  color: var(--sky);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.pitch h2 {
  margin: 0 0 28px;
  font-family: 'Fraunces', Georgia, serif;
  font-size: clamp(42px, 5.2vw, 78px);
  font-weight: 500;
  font-variation-settings: 'opsz' 144, 'SOFT' 50;
  line-height: 1.02;
  letter-spacing: -0.03em;
  text-wrap: balance;
  animation: rise 1s var(--ease) 0.15s both;
}

/* highlighted line: slow light passing over the lettering */
.pitch em {
  font-style: italic;
  font-weight: 400;
  background: linear-gradient(100deg, #8fc4f5 15%, #fff 42%, var(--gold) 58%, #8fc4f5 85%);
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: var(--sky);
  animation: shimmer 7s ease-in-out 1.4s infinite;
}

.pitch p {
  max-width: 30em;
  margin: 0;
  padding-left: 20px;
  border-left: 1px solid rgb(255 255 255 / 28%);
  color: rgb(255 255 255 / 82%);
  font-size: 17px;
  line-height: 1.75;
  animation: rise 1s var(--ease) 0.3s both;
}

.brand-panel footer {
  color: rgb(255 255 255 / 65%);
  font-size: 13px;
  animation: fade-in 1.2s ease 0.8s both;
}

/* ================= Right form panel ================= */
.form-panel {
  position: relative;
  min-width: 0;
  display: grid;
  place-items: center;
  padding: 40px clamp(24px, 6vw, 80px);
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(40% 36% at 100% 0%, rgb(143 196 245 / 26%), transparent 70%),
    radial-gradient(36% 32% at 0% 100%, rgb(42 106 168 / 10%), transparent 70%),
    #fbfcfe;
}

/* fine dot grid that fades out toward the edges */
.form-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: radial-gradient(rgb(23 58 96 / 16%) 1px, transparent 1.2px);
  background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(60% 55% at 50% 50%, #000, transparent 100%);
  mask-image: radial-gradient(60% 55% at 50% 50%, #000, transparent 100%);
  pointer-events: none;
}

.login-card {
  position: relative;
  display: grid;
  gap: 8px;
  width: min(100%, 440px);
  padding: clamp(28px, 4vw, 44px);
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 22px;
  background: rgb(255 255 255 / 72%);
  box-shadow:
    0 0 0 1px rgb(23 58 96 / 7%),
    0 1px 2px rgb(23 58 96 / 6%),
    0 24px 48px -24px rgb(23 58 96 / 28%),
    0 60px 90px -50px rgb(23 58 96 / 25%);
  backdrop-filter: blur(18px) saturate(1.3);
}

/* staggered entrance for everything in the card */
.login-card > * {
  animation: rise 0.8s var(--ease) both;
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
  justify-self: start;
  margin: 0 0 6px;
  padding: 5px 12px 5px 10px;
  border-radius: 999px;
  background: rgb(45 138 87 / 8%);
  box-shadow: inset 0 0 0 1px rgb(45 138 87 / 22%);
  color: #226b45;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* pulsing "secure" dot */
.eyebrow::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2d8a57;
  animation: pulse 2.4s ease-out infinite;
}

h1,
.intro {
  margin: 0;
}

h1 {
  color: var(--navy-deep);
  font-family: 'Fraunces', Georgia, serif;
  font-size: 40px;
  font-weight: 600;
  font-variation-settings: 'opsz' 96, 'SOFT' 40;
  line-height: 1.08;
  letter-spacing: -0.025em;
}

.intro {
  margin-bottom: 22px;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.55;
}

label {
  margin-top: 8px;
  color: var(--navy-deep);
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: color 0.2s ease, transform 0.3s var(--ease);
}

/* label turns blue and nudges while its field is focused */
label:has(+ input:focus) {
  color: var(--blue);
  transform: translateX(3px);
}

/* Field: 1px border drawn by a second background layer, so on focus a
   light can travel around the edge without any extra markup. */
input {
  width: 100%;
  padding: 15px 16px;
  border: 1px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(var(--line), var(--line)) border-box;
  color: var(--text);
  font: inherit;
  font-size: 16px;
  transition: box-shadow 0.3s ease, background-color 0.2s ease, transform 0.3s var(--ease);
}

input::placeholder {
  color: #9aabc2;
}

input:hover:not(:focus) {
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

input:focus {
  outline: none;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(
      from var(--angle),
      var(--blue),
      var(--sky) 25%,
      var(--blue) 50%,
      var(--sky) 75%,
      var(--blue)
    ) border-box;
  box-shadow:
    0 0 0 4px rgb(42 106 168 / 12%),
    0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

/* soft browser autofill colour */
input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 100px #e6f0fc inset;
  -webkit-text-fill-color: var(--text);
}

/* ================= Sign-in button ================= */
button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding: 18px 22px;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  isolation: isolate;
  color: #fff;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 16%), rgb(255 255 255 / 0%) 55%),
    linear-gradient(135deg, #2f74b3 0%, var(--blue) 50%, #1c4a78 100%);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 30%),
    inset 0 -1px 0 rgb(0 0 0 / 18%),
    0 16px 28px -14px rgb(38 95 148 / 90%);
  transition: transform 0.25s var(--ease), box-shadow 0.3s ease, filter 0.2s ease;
}

/* light sweep across the button on hover */
button::before {
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

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 34%),
    inset 0 -1px 0 rgb(0 0 0 / 18%),
    0 24px 34px -16px rgb(38 95 148 / 95%);
}

button:hover:not(:disabled)::before {
  left: 130%;
}

button:active:not(:disabled) {
  transform: translateY(0) scale(0.99);
  box-shadow:
    inset 0 2px 6px rgb(0 0 0 / 22%),
    0 8px 16px -10px rgb(38 95 148 / 85%);
}

/* arrow nudges up and to the right */
button > span:last-child {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgb(255 255 255 / 16%);
  transition: transform 0.3s var(--ease), background 0.2s ease;
}

button:hover:not(:disabled) > span:last-child {
  background: rgb(255 255 255 / 26%);
  transform: translate(3px, -3px) rotate(8deg);
}

button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 3px;
}

/* loading: moving stripe along the bottom edge */
button:disabled {
  cursor: wait;
  opacity: 0.88;
}

button:disabled::after {
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

/* ================= Links and errors ================= */
.register-link {
  margin: 14px 0 0;
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
  bottom: -3px;
  left: 0;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--blue), var(--sky));
  transform: scaleX(0.3);
  transform-origin: left;
  transition: transform 0.35s var(--ease);
}

.register-link a:hover::after,
.register-link a:focus-visible::after {
  transform: scaleX(1);
}

.form-error {
  margin: 6px 0 0;
  padding: 11px 14px;
  border-left: 3px solid var(--danger);
  border-radius: 8px;
  background: linear-gradient(90deg, #fdeceb, #fff6f5);
  color: var(--danger);
  font-size: 13px;
  line-height: 1.45;
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
    background-position: 0 0, 0% 0%, 100% 100%, 100% 60%, 0 0;
  }
  to {
    background-position: 0 0, 30% 20%, 70% 80%, 70% 40%, 0 0;
  }
}

@keyframes orbit {
  to {
    --angle: 360deg;
  }
}

@keyframes spin-angle {
  to {
    --angle: 360deg;
  }
}

@keyframes float {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: -22px -30px;
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

  .brand-panel::before {
    left: 80%;
    width: 220%;
  }

  .brand-panel::after {
    right: -90px;
    bottom: -60px;
    width: 220px;
  }

  .pitch h2 {
    margin-bottom: 0;
    font-size: 36px;
  }

  .pitch p,
  .brand-panel footer {
    display: none;
  }

  .form-panel {
    align-items: start;
    padding: 28px 16px 40px;
  }

  .login-card {
    padding: 28px 22px;
    border-radius: 20px;
  }

  h1 {
    font-size: 32px;
  }
}

/* ================= Fallbacks ================= */
/* browsers without backdrop-filter get a solid card */
@supports not (backdrop-filter: blur(1px)) {
  .login-card {
    background: #fff;
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
  input:focus,
  button:disabled::after {
    animation: none;
  }

  input,
  label,
  button,
  button::before,
  button > span:last-child,
  .register-link a::after {
    transition: none;
  }
}
</style>