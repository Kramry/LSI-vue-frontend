<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { getSession, logout } from '../services/api'

const router = useRouter()
const user = ref(null)
const signingOut = ref(false)

const links = [
  { label: 'Dashboard', to: '/dashboard', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Accounts', to: '/accounts', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Trainees', to: '/trainees', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Programs', to: '/programs', roles: ['administrator', 'staff'] },
  { label: 'Classes', to: '/classes', roles: ['administrator', 'staff'] },
  { label: 'My classes', to: '/classes', roles: ['instructor'] },
  { label: 'Schedules', to: '/schedules', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Enrollments', to: '/enrollments', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Attendance', to: '/attendance', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Announcements', to: '/announcements', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Inquiries', to: '/inquiries', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Assessments', to: '/assessments', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Payments', to: '/payments', roles: ['administrator', 'staff', 'trainee'] },
  { label: 'Analytics', to: '/analytics', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Activity log', to: '/activity', roles: ['administrator', 'staff'] },
  { label: 'Documents', to: '/documents', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Certificates', to: '/certificates', roles: ['administrator', 'staff', 'trainee'] },
  { label: 'Certificates to sign', to: '/certificates/signing', roles: ['administrator', 'staff'] },
  { label: 'Certificate settings', to: '/certificate-settings', roles: ['administrator'] }
]

const visibleLinks = () => links.filter((link) => link.roles.includes(user.value?.role))

async function signOut() {
  signingOut.value = true
  try {
    await logout()
    await router.replace('/login')
  } catch {
    // The API layer already displays the request error toast.
  } finally {
    signingOut.value = false
  }
}

onMounted(async () => {
  const session = await getSession()
  user.value = session.user
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="side-top">
        <RouterLink class="brand" to="/dashboard">
          <img class="brand-mark" src="/lsi-official-logo.jpg" alt="LSI logo">
          <span class="brand-text">LSI <span>SmartTrack</span></span>
        </RouterLink>

        <div class="account">
          <span class="avatar" aria-hidden="true">{{ (user?.full_name || '?').trim().charAt(0).toUpperCase() }}</span>
          <p class="user-summary">
            <strong>{{ user?.full_name || 'Loading account...' }}</strong>
            <span>{{ user?.role || '' }}</span>
          </p>
          <button class="sign-out sign-out-compact" :disabled="signingOut" @click="signOut">
            {{ signingOut ? '…' : 'Sign out' }}
          </button>
        </div>
      </div>

      <nav aria-label="Main navigation">
        <RouterLink v-for="link in visibleLinks()" :key="link.to" :to="link.to">
          {{ link.label }}
        </RouterLink>
      </nav>

      <div class="side-bottom">
        <button class="sign-out" :disabled="signingOut" @click="signOut">
          {{ signingOut ? 'Signing out...' : 'Sign out' }}
        </button>
        <p class="side-note">Calapan City, Oriental Mindoro</p>
      </div>
    </aside>

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<<style scoped>
.app-shell {
  --navy: #173a60;
  --navy-deep: #112c49;
  --blue: #265f94;
  --sky: #8fc4f5;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  min-height: 100vh;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  background: var(--page, #f3f6fb);
}

/* ================= Sidebar ================= */
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px 14px 18px;
  overflow-y: auto;
  overflow-x: hidden;
  isolation: isolate;
  color: #e3edf7;
  background:
    radial-gradient(90% 40% at 0% 0%, rgb(143 196 245 / 22%), transparent 70%),
    linear-gradient(180deg, var(--navy) 0%, var(--navy-deep) 100%);
  animation: slide-in-left 0.6s var(--ease) both;
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / 20%) transparent;
}

/* a thin light that travels down the right edge */
.sidebar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  z-index: -1;
  width: 2px;
  height: 120px;
  background: linear-gradient(180deg, transparent, var(--sky), transparent);
  opacity: 0.7;
  animation: edge-travel 6s ease-in-out infinite;
  pointer-events: none;
}

.side-top {
  display: grid;
  gap: 18px;
}

/* ---------- Brand ---------- */
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 8px;
  color: #fff;
  text-decoration: none;
  animation: fade-down 0.6s var(--ease) 0.1s both;
}

.brand-mark {
  display: block;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: contain;
  transition: transform 0.45s var(--spring);
}

.brand:hover .brand-mark {
  transform: rotate(-10deg) scale(1.12);
}

.brand-text {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.brand-text span {
  display: block;
  color: var(--sky);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* ================= Account card ================= */
.account {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 12px;
  background: rgb(255 255 255 / 7%);
  overflow: hidden;
  animation: pop-in 0.6s var(--spring) 0.2s both;
  transition: background 0.25s ease, border-color 0.25s ease, transform 0.3s var(--ease);
}

.account:hover {
  background: rgb(255 255 255 / 11%);
  border-color: rgb(143 196 245 / 40%);
  transform: translateY(-1px);
}

.avatar {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #e3effb;
  color: var(--navy-deep);
  font-weight: 800;
}

/* slowly turning ring around the avatar */
.avatar::before {
  content: '';
  position: absolute;
  inset: -3px;
  z-index: -1;
  border-radius: 50%;
  background: conic-gradient(from 0deg, var(--sky), transparent 40%, var(--sky) 70%, transparent);
  animation: spin 6s linear infinite;
}

/* the page's own colour fills the gap between the ring and the avatar */
.avatar::after {
  content: '';
  position: absolute;
  inset: -1px;
  z-index: -1;
  border-radius: 50%;
  background: #1d4470;
}

/* online dot */
.account::after {
  content: '';
  position: absolute;
  top: 12px;
  left: 40px;
  width: 9px;
  height: 9px;
  border: 2px solid #1d4470;
  border-radius: 50%;
  background: #5fd08c;
  animation: ping 2.4s ease-out infinite;
}

.user-summary {
  display: grid;
  gap: 3px;
  min-width: 0;
  margin: 0;
  font-size: 14px;
}

.user-summary strong {
  overflow: hidden;
  color: #fff;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-summary span {
  color: var(--sky);
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
}

/* ================= Navigation ================= */
nav {
  display: grid;
  gap: 4px;
}

nav a {
  position: relative;
  padding: 11px 14px;
  border-radius: 9px;
  color: #c3d4e6;
  font-size: 14.5px;
  font-weight: 500;
  text-decoration: none;
  overflow: hidden;
  isolation: isolate;
  animation: slide-in-left 0.55s var(--ease) both;
  transition: color 0.2s ease, transform 0.3s var(--ease);
}

nav a,
.sign-out-compact,
.sign-out {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* staggered entrance: works for short and long (admin) menus */
nav a:nth-child(1)  { animation-delay: 0.30s; }
nav a:nth-child(2)  { animation-delay: 0.35s; }
nav a:nth-child(3)  { animation-delay: 0.40s; }
nav a:nth-child(4)  { animation-delay: 0.45s; }
nav a:nth-child(5)  { animation-delay: 0.50s; }
nav a:nth-child(6)  { animation-delay: 0.55s; }
nav a:nth-child(7)  { animation-delay: 0.60s; }
nav a:nth-child(8)  { animation-delay: 0.65s; }
nav a:nth-child(9)  { animation-delay: 0.70s; }
nav a:nth-child(10) { animation-delay: 0.75s; }
nav a:nth-child(11) { animation-delay: 0.80s; }
nav a:nth-child(n + 12) { animation-delay: 0.85s; }

/* the hover highlight grows from the left edge */
nav a::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 9px;
  background: linear-gradient(90deg, rgb(143 196 245 / 22%), rgb(143 196 245 / 6%));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s var(--ease);
}

nav a:hover {
  color: #fff;
  transform: translateX(5px);
}

nav a:hover::after {
  transform: scaleX(1);
}

/* active page: glowing bar and a soft highlight */
nav a.router-link-active {
  color: #fff;
  background: rgb(143 196 245 / 18%);
  font-weight: 700;
  transform: translateX(3px);
}

nav a.router-link-active::after {
  transform: scaleX(1);
  opacity: 0.6;
}

nav a.router-link-active::before {
  content: '';
  position: absolute;
  top: 9px;
  bottom: 9px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--sky);
  box-shadow: 0 0 12px 1px rgb(143 196 245 / 75%);
  animation: bar-grow 0.45s var(--spring) both;
}

nav a:focus-visible,
.sign-out:focus-visible,
.brand:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

/* ================= Bottom ================= */
.side-bottom {
  display: grid;
  gap: 12px;
  margin-top: auto;
  animation: fade-in 0.8s ease 0.9s both;
}

.sign-out {
  position: relative;
  padding: 11px 14px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 9px;
  background: transparent;
  color: #e3edf7;
  font: inherit;
  font-weight: 700;
  text-align: center;
  overflow: hidden;
  cursor: pointer;
  transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease, transform 0.2s var(--spring);
}

/* hovering sign out warms the button so it reads as "leaving" */
.sign-out:hover:not(:disabled) {
  background: rgb(255 120 100 / 14%);
  border-color: rgb(255 150 135 / 55%);
  color: #ffd9d3;
  transform: translateY(-1px);
}

.sign-out:active:not(:disabled) {
  transform: scale(0.97);
}

.sign-out:disabled {
  cursor: wait;
  opacity: 0.8;
}

.sign-out:disabled::after {
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

.sign-out-compact {
  display: none;
}

.side-note {
  margin: 0;
  color: rgb(227 237 247 / 60%);
  font-size: 12px;
  text-align: center;
}

/* ================= Main ================= */
.main-content {
  min-width: 0;
  width: 100%;
  padding: 30px;
}

/* ================= Keyframes ================= */
@keyframes slide-in-left {
  from {
    opacity: 0;
    transform: translateX(-22px);
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

@keyframes pop-in {
  0% {
    opacity: 0;
    transform: scale(0.9) translateY(8px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes bar-grow {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes edge-travel {
  0% {
    top: -140px;
  }
  100% {
    top: 110%;
  }
}

@keyframes ping {
  0% {
    box-shadow: 0 0 0 0 rgb(95 208 140 / 65%);
  }
  70%,
  100% {
    box-shadow: 0 0 0 8px rgb(95 208 140 / 0%);
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

/* ================= Tablet and phone: top bar ================= */
@media (max-width: 860px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: sticky;
    z-index: 20;
    height: auto;
    gap: 10px;
    padding: 12px 14px 10px;
    overflow: visible;
    box-shadow: 0 8px 20px -12px rgb(17 44 73 / 70%);
    animation-name: fade-down;
  }

  .sidebar::after {
    display: none;
  }

  .side-top {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
  }

  .brand {
    padding: 0;
  }

  .brand-text span {
    display: inline;
    margin-left: 4px;
    letter-spacing: 0.1em;
  }

  .account {
    justify-self: end;
    padding: 6px 8px 6px 10px;
    border-radius: 999px;
  }

  .account::after {
    top: 6px;
    left: 30px;
    width: 8px;
    height: 8px;
  }

  .avatar {
    width: 30px;
    height: 30px;
    font-size: 13px;
  }

  .user-summary {
    display: none;
  }

  .sign-out-compact {
    display: block;
    padding: 6px 12px;
    font-size: 13px;
  }

  nav {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  nav::-webkit-scrollbar {
    display: none;
  }

  nav a {
    flex: none;
    padding: 8px 14px;
    border-radius: 999px;
    white-space: nowrap;
    animation-name: fade-down;
  }

  nav a:hover,
  nav a.router-link-active {
    transform: none;
  }

  nav a::after {
    border-radius: 999px;
  }

  nav a.router-link-active::before {
    display: none;
  }

  .side-bottom {
    display: none;
  }

  .main-content {
    width: 100%;
    min-width: 0;
    padding: clamp(0.75rem, 4vw, 1.125rem);
  }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .sidebar::after,
  .brand,
  .account,
  .account::after,
  .avatar::before,
  nav a,
  nav a.router-link-active::before,
  .side-bottom,
  .sign-out:disabled::after {
    animation: none;
  }

  .brand-mark,
  .account,
  nav a,
  nav a::after,
  .sign-out {
    transition: none;
  }
}
</style>