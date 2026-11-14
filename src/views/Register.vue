<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { apiGet, register } from '../services/api'

const router = useRouter()
const firstName = ref('')
const lastName = ref('')
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

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await register({
      full_name: `${firstName.value} ${lastName.value}`.trim(),
      first_name: firstName.value,
      last_name: lastName.value,
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
        <p class="intro">Create a trainee account to access your training records.</p>

        <div class="two-col">
          <label for="first-name">First name<input id="first-name" v-model.trim="firstName" autocomplete="given-name" required></label>
          <label for="last-name">Last name<input id="last-name" v-model.trim="lastName" autocomplete="family-name" required></label>
        </div>

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

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" :disabled="loading">
          <span>{{ loading ? 'Creating account...' : 'Create account' }}</span>
          <span aria-hidden="true">↗</span>
        </button>

        <p class="switch-page">Already have an account? <RouterLink to="/login">Sign in</RouterLink></p>
      </form>

      <section class="staff-registration" aria-labelledby="staff-registration-title">
        <h2 id="staff-registration-title">Staff or instructor?</h2>
        <p>Staff and instructor accounts are set up by an LSI administrator. Contact the LSI office to request access.</p>
      </section>
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

.register-page {
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
  /* select chevron, reused across states */
  --chevron:
    linear-gradient(45deg, transparent 50%, var(--muted) 50%) calc(100% - 20px) 50% / 6px 6px no-repeat padding-box,
    linear-gradient(135deg, var(--muted) 50%, transparent 50%) calc(100% - 14px) 50% / 6px 6px no-repeat padding-box;

  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  min-height: 100vh;
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  color: var(--text);
  background: #fff;
}

/* ================= Left brand panel (stays put while the form scrolls) ================= */
.brand-panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 52.38vw;
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
    var(--grain),
    radial-gradient(50% 42% at 12% 8%, rgb(143 196 245 / 38%), transparent 70%),
    radial-gradient(30% 26% at 55% 92%, rgb(232 201 138 / 16%), transparent 70%),
    radial-gradient(55% 50% at 100% 70%, rgb(42 106 168 / 70%), transparent 72%),
    linear-gradient(165deg, #1d4a79 0%, var(--navy) 38%, var(--navy-deep) 78%, var(--ink) 100%);
  background-size: 180px 180px, 140% 140%, 140% 140%, 140% 140%, 100% 100%;
  background-blend-mode: soft-light, normal, normal, normal, normal;
  animation: aurora 18s ease-in-out infinite alternate;
}

/* concentric orbit rings with a slowly rotating light */
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
  grid-column: 2;
  min-width: 0;
  display: grid;
  place-items: center;
  gap: 0;
  padding: 40px clamp(24px, 6vw, 80px);
  isolation: isolate;
  background:
    radial-gradient(40% 32% at 100% 0%, rgb(143 196 245 / 26%), transparent 70%),
    radial-gradient(36% 28% at 0% 100%, rgb(42 106 168 / 10%), transparent 70%),
    #fbfcfe;
}

/* fine dot grid, fades out toward the edges */
.form-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: radial-gradient(rgb(23 58 96 / 16%) 1px, transparent 1.2px);
  background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(65% 55% at 50% 50%, #000, transparent 100%);
  mask-image: radial-gradient(65% 55% at 50% 50%, #000, transparent 100%);
  pointer-events: none;
}

.register-card {
  position: relative;
  display: grid;
  gap: 8px;
  width: min(100%, 460px);
  padding: clamp(26px, 4vw, 40px);
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

/* secondary note under the card: quiet, with an accent edge instead of a box */
.staff-registration {
  width: min(100%, 460px);
  margin-top: 20px;
  padding: 16px 20px 16px 22px;
  border: 1px dashed #bfd0e4;
  border-left: 3px solid var(--sky);
  border-radius: 6px 14px 14px 6px;
  background: rgb(247 249 253 / 80%);
  backdrop-filter: blur(6px);
}

.staff-registration h2 {
  margin: 0 0 6px;
  color: var(--navy-deep);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.005em;
}

.staff-registration p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

/* staggered entrance for everything in the card */
.register-card > * {
  animation: rise 0.8s var(--ease) both;
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
  justify-self: start;
  margin: 0 0 6px;
  padding: 5px 12px 5px 10px;
  border-radius: 999px;
  background: rgb(42 106 168 / 8%);
  box-shadow: inset 0 0 0 1px rgb(42 106 168 / 22%);
  color: var(--blue);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.eyebrow::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--blue);
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
  margin-bottom: 14px;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.55;
}

/* ================= Fields ================= */
label {
  margin-top: 6px;
  color: var(--navy-deep);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
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

/* 1px border is a second background layer, so on focus a light can
   travel around the edge with no extra markup */
input,
select,
textarea {
  width: 100%;
  padding: 13px 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(var(--line), var(--line)) border-box;
  color: var(--text);
  font: inherit;
  font-size: 15px;
  font-weight: 400;
  transition: box-shadow 0.3s ease, background-color 0.2s ease, transform 0.3s var(--ease);
}

textarea {
  min-height: 90px;
  resize: vertical;
}

select {
  appearance: none;
  padding-right: 38px;
  background:
    var(--chevron),
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(var(--line), var(--line)) border-box;
  cursor: pointer;
}

input::placeholder,
textarea::placeholder {
  color: #9aabc2;
}

input:hover:not(:focus),
textarea:hover:not(:focus) {
  background:
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

select:hover:not(:focus) {
  background:
    var(--chevron),
    linear-gradient(var(--field), var(--field)) padding-box,
    linear-gradient(#b3c6dd, #b3c6dd) border-box;
}

input:focus,
textarea:focus {
  outline: none;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow:
    0 0 0 4px rgb(42 106 168 / 12%),
    0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
}

select:focus {
  outline: none;
  background:
    var(--chevron),
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), var(--blue), var(--sky) 25%, var(--blue) 50%, var(--sky) 75%, var(--blue)) border-box;
  box-shadow:
    0 0 0 4px rgb(42 106 168 / 12%),
    0 14px 26px -16px rgb(42 106 168 / 60%);
  transform: translateY(-1px);
  animation: spin-angle 3.5s linear infinite;
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

/* ================= Register button ================= */
button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding: 17px 22px;
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
  transition: transform 0.25s var(--ease), box-shadow 0.3s ease;
}

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

/* ================= Errors and links ================= */
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

.switch-page {
  margin: 14px 0 0;
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
  bottom: -3px;
  left: 0;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--blue), var(--sky));
  transform: scaleX(0.3);
  transform-origin: left;
  transition: transform 0.35s var(--ease);
}

.switch-page a:hover::after,
.switch-page a:focus-visible::after {
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
    box-shadow: 0 0 0 0 rgb(42 106 168 / 45%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 9px rgb(42 106 168 / 0%);
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
    left: auto;
    width: auto;
    gap: 28px;
    height: auto;
    min-height: 260px;
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

  .pitch {
    margin: 48px 0 20px;
  }

  .pitch h2 {
    margin-bottom: 0;
    font-size: 40px;
  }

  .pitch p,
  .brand-panel footer {
    display: none;
  }

  .form-panel {
    grid-column: 1;
    align-items: start;
    padding: 28px 16px 40px;
  }

  .register-card {
    padding: 26px 20px;
    border-radius: 20px;
  }

  .two-col {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 32px;
  }
}

/* ================= Fallbacks ================= */
@supports not (backdrop-filter: blur(1px)) {
  .register-card {
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
  .register-card > *,
  .eyebrow::before,
  .form-error,
  input:focus,
  select:focus,
  textarea:focus,
  button:disabled::after {
    animation: none;
  }

  input,
  select,
  textarea,
  label,
  button,
  button::before,
  button > span:last-child,
  .switch-page a::after {
    transition: none;
  }
}
</style>