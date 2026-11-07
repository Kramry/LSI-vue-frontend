<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { apiGet, register } from '../services/api'
import { isAnalyticsConsentGranted, setAnalyticsConsent } from '../services/analytics'

const router = useRouter()
const firstName = ref('')
const lastName = ref('')
const role = ref('trainee')
const username = ref('')
const email = ref('')
const sex = ref('')
const dateOfBirth = ref('')
const address = ref('')
const contactNumber = ref('')
const course = ref('')
const programId = ref('')
const programs = ref<{ id: number | string; label: string }[]>([])
const password = ref('')
const passwordConfirmation = ref('')
const loading = ref(false)
const error = ref('')
const analyticsConsent = ref(isAnalyticsConsentGranted())

function updateAnalyticsConsent() {
  setAnalyticsConsent(analyticsConsent.value)
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await register({
      full_name: `${firstName.value} ${lastName.value}`.trim(),
      first_name: firstName.value,
      last_name: lastName.value,
      role: role.value,
      username: username.value,
      email: email.value,
      sex: sex.value,
      date_of_birth: dateOfBirth.value,
      address: address.value,
      contact_number: contactNumber.value,
      course: course.value,
      program_id: programId.value,
      password: password.value,
      password_confirmation: passwordConfirmation.value
    })
    await router.replace({ name: 'login' })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to create your account.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const response = await apiGet<{ programs: { id: number | string; label: string }[] }>('/registration-options')
    programs.value = response.data.programs || []
  } catch {
    programs.value = []
  }
})
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

        <div class="two-col">
          <label for="first-name">First name<input id="first-name" v-model.trim="firstName" autocomplete="given-name" required></label>
          <label for="last-name">Last name<input id="last-name" v-model.trim="lastName" autocomplete="family-name" required></label>
        </div>

        <label for="role">Role<select id="role" v-model="role" required><option value="trainee">Trainee</option><option value="instructor">Instructor</option><option value="staff">Staff</option></select></label>

        <label for="username">Username</label>
        <input id="username" v-model.trim="username" autocomplete="username" required>

        <label for="email">Email</label>
        <input id="email" v-model.trim="email" type="email" autocomplete="email" required>

        <div class="two-col">
          <label for="sex">Sex<select id="sex" v-model="sex" required><option value="" disabled>Select sex</option><option>Male</option><option>Female</option><option>Other</option></select></label>
          <label for="date-of-birth">Date of birth<input id="date-of-birth" v-model="dateOfBirth" type="date"></label>
        </div>

        <label for="address">Address<textarea id="address" v-model.trim="address" rows="2"></textarea></label>
        <div class="two-col">
          <label for="contact-number">Contact number<input id="contact-number" v-model.trim="contactNumber" required></label>
          <label for="course">Course / qualification<input id="course" v-model.trim="course" required></label>
        </div>
        <label for="program">Training program<select id="program" v-model="programId"><option value="">Not assigned yet</option><option v-for="program in programs" :key="String(program.id)" :value="String(program.id)">{{ program.label }}</option></select></label>

        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" minlength="10" autocomplete="new-password" required>

        <label for="password-confirmation">Confirm password</label>
        <input id="password-confirmation" v-model="passwordConfirmation" type="password" minlength="10" autocomplete="new-password" required>

        <label class="analytics-consent">
          <input v-model="analyticsConsent" type="checkbox" @change="updateAnalyticsConsent">
          <span>Allow privacy-safe usage analytics. You can change this after signing in.</span>
        </label>

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
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
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
  min-width: 0;
  display: grid;
  place-items: center;
  padding: 40px clamp(24px, 6vw, 80px);
  background:
    radial-gradient(45% 35% at 100% 0%, rgb(143 196 245 / 22%), transparent 70%),
    radial-gradient(40% 30% at 0% 100%, rgb(38 95 148 / 8%), transparent 70%),
    #fff;
}

.register-card {
  display: grid;
  gap: 8px;
  width: min(100%, 440px);
}

/* staggered entrance for everything in the card */
.register-card > * {
  animation: rise 0.7s var(--ease) both;
}

.register-card > :nth-child(1) { animation-delay: 0.08s; }
.register-card > :nth-child(2) { animation-delay: 0.14s; }
.register-card > :nth-child(3) { animation-delay: 0.2s; }
.register-card > :nth-child(4) { animation-delay: 0.26s; }
.register-card > :nth-child(5) { animation-delay: 0.32s; }
.register-card > :nth-child(6) { animation-delay: 0.38s; }
.register-card > :nth-child(7) { animation-delay: 0.44s; }
.register-card > :nth-child(8) { animation-delay: 0.5s; }
.register-card > :nth-child(9) { animation-delay: 0.56s; }
.register-card > :nth-child(10) { animation-delay: 0.62s; }
.register-card > :nth-child(11) { animation-delay: 0.68s; }
.register-card > :nth-child(12) { animation-delay: 0.74s; }
.register-card > :nth-child(n + 13) { animation-delay: 0.8s; }

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

.eyebrow::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sky);
  animation: pulse 2.4s ease-out infinite;
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
  margin-bottom: 14px;
  color: var(--muted);
  font-size: 16px;
}

/* ================= Fields ================= */
label {
  margin-top: 6px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 700;
  transition: color 0.2s ease;
}

/* label turns blue while its field is focused (the field sits inside the label) */
label:has(input:focus, select:focus, textarea:focus) {
  color: var(--blue);
}

label input,
label select,
label textarea {
  display: block;
  margin-top: 6px;
}

input,
select,
textarea {
  width: 100%;
  padding: 13px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--field);
  color: var(--text);
  font: inherit;
  font-size: 15px;
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, transform 0.25s var(--ease);
}

textarea {
  min-height: 90px;
  resize: vertical;
}

select {
  appearance: none;
  padding-right: 38px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--muted) 50%),
    linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 20px) 50%, calc(100% - 14px) 50%;
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
  cursor: pointer;
}

input::placeholder,
textarea::placeholder {
  color: #9aabc2;
}

input:hover,
select:hover,
textarea:hover {
  border-color: #b6c8de;
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--blue);
  background-color: #fff;
  box-shadow: 0 0 0 4px rgb(38 95 148 / 16%), 0 10px 22px -14px rgb(38 95 148 / 55%);
  transform: translateY(-1px);
}

input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 100px #e6f0fc inset;
  -webkit-text-fill-color: var(--text);
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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

/* ================= Register button ================= */
button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding: 16px 20px;
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
  transition: transform 0.2s var(--ease), box-shadow 0.25s ease;
}

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

/* ================= Errors and links ================= */
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

.switch-page {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}

.switch-page a {
  position: relative;
  color: var(--navy);
  font-weight: 700;
  text-decoration: none;
}

.switch-page a::after {
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

.switch-page a:hover::after {
  background: var(--blue);
  transform: scaleX(1);
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
    box-shadow: 0 0 0 0 rgb(143 196 245 / 70%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 9px rgb(143 196 245 / 0%);
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
  .register-page {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    position: relative;
    align-self: stretch;
    gap: 28px;
    height: auto;
    min-height: 260px;
    padding: 32px 24px;
  }

  .brand-panel::after {
    right: -120px;
    bottom: -40px;
    width: 240px;
    height: 240px;
  }

  .pitch {
    margin: 48px 0 20px;
  }

  .pitch h2 {
    font-size: 42px;
  }

  .pitch p,
  .brand-panel footer {
    display: none;
  }

  .form-panel {
    align-items: start;
    padding-top: 36px;
  }

  .two-col {
    grid-template-columns: 1fr;
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
  .register-card > *,
  .eyebrow::before,
  .form-error,
  button:disabled::after {
    animation: none;
  }

  input,
  select,
  textarea,
  button,
  button::before,
  button > span:last-child,
  .switch-page a::after {
    transition: none;
  }
}
</style>