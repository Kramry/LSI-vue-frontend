<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import AiChatAssistant from '../components/AiChatAssistant.vue'
import { getSession, logout } from '../services/api'

const router = useRouter()
const route = useRoute()
const user = ref(null)
const signingOut = ref(false)
const navOpen = ref(false)
const compactLayout = window.matchMedia('(max-width: 1023px)')
const isCompact = ref(compactLayout.matches)
let previousBodyOverflow = ''

const links = [
  { label: 'Dashboard', to: '/dashboard', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Profile', to: '/accounts', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'User accounts', to: '/users', roles: ['administrator', 'staff'] },
  { label: 'Trainees', to: '/trainees', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Programs', to: '/programs', roles: ['administrator', 'staff'] },
  { label: 'Classes', to: '/classes', roles: ['administrator', 'staff'] },
  { label: 'My classes', to: '/classes', roles: ['instructor'] },
  { label: 'Schedules', to: '/schedules', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Enrollments', to: '/enrollments', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Attendance', to: '/attendance', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'Announcements', to: '/announcements', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Inquiries', to: '/inquiries', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Assessments', to: '/assessments', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Payments', to: '/payments', roles: ['administrator', 'staff', 'trainee'] },
  { label: 'Analytics', to: '/analytics', roles: ['administrator', 'staff', 'instructor'] },
  { label: 'AI Management', to: '/ai-management', roles: ['administrator'] },
  { label: 'Activity log', to: '/activity', roles: ['administrator', 'staff'] },
  { label: 'Documents', to: '/documents', roles: ['administrator', 'staff', 'instructor', 'trainee'] },
  { label: 'Certificates', to: '/certificates', roles: ['administrator', 'staff', 'trainee'] },
  { label: 'Certificates to sign', to: '/certificates/signing', roles: ['administrator', 'staff'] },
  { label: 'Certificate settings', to: '/certificate-settings', roles: ['administrator'] }
]

const visibleLinks = () => links.filter((link) => link.roles.includes(user.value?.role))

function closeNavigation() {
  if (navOpen.value) document.body.style.overflow = previousBodyOverflow
  navOpen.value = false
}

function toggleNavigation() {
  if (navOpen.value) {
    closeNavigation()
    return
  }
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  navOpen.value = true
  nextTick(() => document.querySelector('#main-navigation a')?.focus())
}

function handleKeydown(event) {
  if (event.key === 'Escape' && navOpen.value) closeNavigation()
}

function handleViewportChange(event) {
  isCompact.value = event.matches
  if (!event.matches) closeNavigation()
}

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

watch(() => route.fullPath, () => {
  closeNavigation()
  nextTick(() => {
    const navigation = document.querySelector('#main-navigation')
    if (navigation) navigation.scrollTop = 0
  })
})

onMounted(async () => {
  document.addEventListener('keydown', handleKeydown)
  compactLayout.addEventListener('change', handleViewportChange)
  const session = await getSession()
  user.value = session.user
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  compactLayout.removeEventListener('change', handleViewportChange)
  closeNavigation()
})
</script>

<template>
  <div class="app-shell" :class="{ 'nav-open': navOpen }">
    <header class="mobile-header">
      <RouterLink class="mobile-brand" to="/dashboard">
        <img class="brand-mark" src="/lsi-official-logo.jpg" alt="">
        <span>LSI <strong>SmartTrack</strong></span>
      </RouterLink>
      <button
        class="menu-toggle"
        type="button"
        aria-controls="main-navigation"
        :aria-expanded="navOpen"
        :aria-label="navOpen ? 'Close navigation menu' : 'Open navigation menu'"
        @click="toggleNavigation"
      >
        <span></span><span></span><span></span>
      </button>
    </header>

    <button
      class="sidebar-backdrop"
      type="button"
      aria-label="Close navigation menu"
      tabindex="-1"
      @click="closeNavigation"
    ></button>

    <aside
      id="main-navigation"
      class="sidebar"
      :inert="isCompact && !navOpen"
      :aria-hidden="isCompact && !navOpen ? 'true' : 'false'"
    >
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
        <RouterLink v-for="link in visibleLinks()" :key="link.label" :to="link.to" @click="closeNavigation">
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
    <AiChatAssistant />
  </div>
</template>

<style scoped>
.app-shell {
  --navy: #173a60;
  --navy-deep: #0e2640;
  --blue: #2a68a3;
  --sky: #8fc4f5;
  --mint: #5fd08c;
  --line: #dbe4ef;
  --page: #f3f6fb;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* ---------- Navigation icon set (line icons drawn as masks, so they take currentColor) ---------- */
  --n-dot: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3C/svg%3E");
  --n-home: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='7.5' height='9' rx='1.5'/%3E%3Crect x='13.5' y='3' width='7.5' height='5' rx='1.5'/%3E%3Crect x='13.5' y='11' width='7.5' height='10' rx='1.5'/%3E%3Crect x='3' y='15' width='7.5' height='6' rx='1.5'/%3E%3C/svg%3E");
  --n-layers: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l9 5-9 5-9-5z'/%3E%3Cpath d='M3 13l9 5 9-5'/%3E%3C/svg%3E");
  --n-cap: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 9l10-5 10 5-10 5z'/%3E%3Cpath d='M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5'/%3E%3C/svg%3E");
  --n-calendar: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M3 10h18M8 3v4M16 3v4'/%3E%3C/svg%3E");
  --n-userplus: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='8' r='3.5'/%3E%3Cpath d='M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 8v6M16 11h6'/%3E%3C/svg%3E");
  --n-scan: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16'/%3E%3C/svg%3E");
  --n-file: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 3h7l5 5v13H7z'/%3E%3Cpath d='M14 3v5h5M10 13h6M10 17h6'/%3E%3C/svg%3E");
  --n-bars: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 20V10M12 20V4M19 20v-7'/%3E%3C/svg%3E");
  --n-award: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='9' r='5'/%3E%3Cpath d='M9 13.5L8 21l4-2 4 2-1-7.5'/%3E%3C/svg%3E");
  --n-megaphone: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 10v4h3l7 4V6L6 10z'/%3E%3Cpath d='M16.5 8.5a5 5 0 0 1 0 7'/%3E%3C/svg%3E");
  --n-message: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4z'/%3E%3Cpath d='M8 9h8M8 12h5'/%3E%3C/svg%3E");
  --n-wallet: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z'/%3E%3Cpath d='M4 7l12-3v3'/%3E%3Ccircle cx='16' cy='13.5' r='1'/%3E%3C/svg%3E");
  --n-shield: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z'/%3E%3Cpath d='M9 12l2 2 4-4'/%3E%3C/svg%3E");
  --n-users: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='8' r='3.5'/%3E%3Cpath d='M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6'/%3E%3Ccircle cx='17.5' cy='9' r='2.5'/%3E%3Cpath d='M17 14c2.6 0 4.5 1.8 4.5 4.5'/%3E%3C/svg%3E");
  --n-book: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z'/%3E%3Cpath d='M4 17a3 3 0 0 1 3-3h11M8 8h6'/%3E%3C/svg%3E");
  --n-user: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M4 21c0-4 3.6-7 8-7s8 3 8 7'/%3E%3C/svg%3E");
  --n-sliders: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7h9M17 7h3M4 17h3M11 17h9'/%3E%3Ccircle cx='15' cy='7' r='2'/%3E%3Ccircle cx='9' cy='17' r='2'/%3E%3C/svg%3E");
  --n-list: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 6h11M9 12h11M9 18h11'/%3E%3Cpath d='M4.5 6h.01M4.5 12h.01M4.5 18h.01'/%3E%3C/svg%3E");
  --n-door: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4'/%3E%3Cpath d='M16 8l4 4-4 4M20 12H9'/%3E%3C/svg%3E");

  min-height: 100vh;
  width: 100%;
  max-width: 100vw;
  min-width: 0;
  overflow-x: clip;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  background:
    radial-gradient(60% 40% at 100% 0%, rgb(143 196 245 / 22%), transparent 70%),
    var(--page);
}

/* ================= Inline SVG icons (still supported, e.g. in the sign-out button) ================= */
.nav-icon {
  flex: none;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.35s var(--spring), color 0.2s ease;
}

/* links never show a second, inline icon next to the CSS one */
nav a > .nav-icon {
  display: none;
}

/* ================= Mobile header ================= */
.mobile-header { display: none; }

.mobile-brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--navy-deep);
  font-weight: 800;
  text-decoration: none;
}
.mobile-brand strong { color: var(--blue); }

.menu-toggle {
  position: relative;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 12px;
  color: var(--navy);
  background: #fff;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s var(--spring), box-shadow 0.2s ease;
}
.menu-toggle:hover { background: #eef4fb; box-shadow: 0 4px 12px rgb(23 58 96 / 12%); }
.menu-toggle:active { transform: scale(0.92); }
.menu-toggle:focus-visible { outline: 3px solid var(--sky); outline-offset: 2px; }

.menu-toggle span {
  width: 19px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transition: transform 0.35s var(--ease), opacity 0.2s ease;
}
/* hamburger morphs into an X when the menu is open */
.app-shell.nav-open .menu-toggle span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.app-shell.nav-open .menu-toggle span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.app-shell.nav-open .menu-toggle span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

.sidebar-backdrop { display: none; }

/* ================= Sidebar ================= */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 30;
  width: 260px;
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
    radial-gradient(80% 36% at 0% 0%, rgb(143 196 245 / 28%), transparent 70%),
    radial-gradient(70% 30% at 100% 100%, rgb(95 208 140 / 12%), transparent 70%),
    linear-gradient(180deg, var(--navy) 0%, var(--navy-deep) 100%);
  background-size: 130% 130%, 130% 130%, 100% 100%;
  animation: slide-in-left 0.6s var(--ease) both, aurora 14s ease-in-out 0.6s infinite alternate;
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / 20%) transparent;
}

/* soft dotted texture */
.sidebar::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: radial-gradient(rgb(255 255 255 / 7%) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(180deg, #000, transparent 70%);
  pointer-events: none;
}

/* light travelling down the right edge */
.sidebar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  z-index: -1;
  width: 2px;
  height: 140px;
  background: linear-gradient(180deg, transparent, var(--sky), transparent);
  opacity: 0.7;
  animation: edge-travel 6s ease-in-out infinite;
  pointer-events: none;
}

.side-top { display: grid; gap: 20px; }

/* ---------- Brand ---------- */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  color: #fff;
  text-decoration: none;
  animation: fade-down 0.6s var(--ease) 0.1s both;
}

.brand-mark {
  display: block;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  object-fit: contain;
  box-shadow: 0 6px 16px rgb(0 0 0 / 28%);
  animation: float 4s ease-in-out infinite;
  transition: transform 0.45s var(--spring);
}
.brand:hover .brand-mark { transform: rotate(-12deg) scale(1.14); }

.brand-text {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.1;
}

/* the product name has a slow shimmer */
.brand-text span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  background: linear-gradient(100deg, var(--sky) 25%, #e6f3ff 48%, var(--sky) 70%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: var(--sky);
  animation: shimmer 6s ease-in-out 1.4s infinite;
}

/* ================= Account card ================= */
.account {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgb(255 255 255 / 13%);
  border-radius: 14px;
  background: linear-gradient(135deg, rgb(255 255 255 / 11%), rgb(255 255 255 / 4%));
  backdrop-filter: blur(6px);
  overflow: hidden;
  animation: pop-in 0.6s var(--spring) 0.2s both;
  transition: background 0.25s ease, border-color 0.25s ease, transform 0.3s var(--ease), box-shadow 0.3s ease;
}

.account > :first-child { position: relative; z-index: 1; }

.account:hover {
  background: linear-gradient(135deg, rgb(255 255 255 / 15%), rgb(255 255 255 / 6%));
  border-color: rgb(143 196 245 / 45%);
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgb(0 0 0 / 22%);
}

.avatar {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--navy-deep);
  font-weight: 800;
  isolation: isolate;
}
.avatar::before {
  content: '';
  position: absolute;
  inset: -3px;
  z-index: -1;
  border-radius: 50%;
  background: conic-gradient(from 0deg, var(--sky), transparent 40%, var(--sky) 70%, transparent);
  animation: spin 6s linear infinite;
}
.avatar::after {
  content: '';
  position: absolute;
  inset: -1px;
  z-index: -1;
  border-radius: 50%;
  background: linear-gradient(160deg, #f2f8ff, #cfe4fa);
  box-shadow: 0 0 0 2px #1d4470;   /* gap between ring and avatar */
}

/* online dot */
.account::after {
  content: '';
  position: absolute;
  top: 42px;
  left: 44px;
  width: 9px;
  height: 9px;
  border: 2px solid #1d4470;
  border-radius: 50%;
  background: var(--mint);
  animation: ping 2.4s ease-out infinite;
}

.user-summary {
  display: grid;
  gap: 4px;
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

/* the role is a small chip */
.user-summary span {
  justify-self: start;
  padding: 2px 9px;
  border: 1px solid rgb(143 196 245 / 30%);
  border-radius: 999px;
  background: rgb(143 196 245 / 14%);
  color: var(--sky);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: capitalize;
}

/* ================= Navigation ================= */
nav { display: grid; align-content: start; gap: 4px; }

nav a,
.sign-out-compact,
.sign-out {
  box-sizing: border-box;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

nav a {
  --tone: var(--sky);   /* each link has its own icon colour */
  --ia: icon-tilt;      /* ...and its own hover animation */
  position: relative;
  justify-content: flex-start;
  gap: 13px;
  padding: 11px 14px 11px 12px;
  border-radius: 12px;
  color: #c3d4e6;
  font-size: 14.5px;
  font-weight: 500;
  text-decoration: none;
  overflow: hidden;
  isolation: isolate;
  /* the hover highlight grows from the left as a background */
  background: linear-gradient(90deg, rgb(143 196 245 / 24%), rgb(143 196 245 / 4%)) no-repeat left center / 0% 100%;
  animation: slide-in-left 0.55s var(--ease) both;
  transition: color 0.2s ease, transform 0.3s var(--ease), background-size 0.4s var(--ease), box-shadow 0.3s ease;
}

/* ---------- Icon (::before) ---------- */
nav a::before {
  --icon: var(--n-dot);
  content: '';
  flex: none;
  width: 21px;
  height: 21px;
  background-color: currentColor;
  -webkit-mask-image: var(--icon);
  mask-image: var(--icon);
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  color: #9fb8d2;
  transition: color 0.25s ease, transform 0.35s var(--spring), filter 0.3s ease;
}

/* which icon and colour each link gets (matched on the link's URL) */
nav a[href*='dashboard']      { --tone: #8fc4f5; --ia: icon-bounce; }
nav a[href*='dashboard']::before      { --icon: var(--n-home); }
nav a[href*='classes']        { --tone: #8fb7ff; --ia: icon-tilt; }
nav a[href*='classes']::before        { --icon: var(--n-layers); }
nav a[href*='trainees']       { --tone: #7fd6e6; --ia: icon-tilt; }
nav a[href*='trainees']::before       { --icon: var(--n-cap); }
nav a[href*='schedules']      { --tone: #ffd37a; --ia: icon-flip; }
nav a[href*='schedules']::before      { --icon: var(--n-calendar); }
nav a[href*='enrollments']    { --tone: #7be0a4; --ia: icon-bounce; }
nav a[href*='enrollments']::before    { --icon: var(--n-userplus); }
nav a[href*='attendance']     { --tone: #5fd08c; --ia: icon-scan; }
nav a[href*='attendance']::before     { --icon: var(--n-scan); }
nav a[href*='documents']      { --tone: #9ec5ff; --ia: icon-nudge; }
nav a[href*='documents']::before      { --icon: var(--n-file); }
nav a[href*='analytics']      { --tone: #b9a4ff; --ia: icon-bounce; }
nav a[href*='analytics']::before      { --icon: var(--n-bars); }
nav a[href*='assessments']    { --tone: #d6a8ff; --ia: icon-tilt; }
nav a[href*='assessments']::before    { --icon: var(--n-award); }
nav a[href*='announcements']  { --tone: #ffb27a; --ia: icon-ring; }
nav a[href*='announcements']::before  { --icon: var(--n-megaphone); }
nav a[href*='inquiries']      { --tone: #a9a6ff; --ia: icon-nudge; }
nav a[href*='inquiries']::before      { --icon: var(--n-message); }
nav a[href*='payments']       { --tone: #ffe08a; --ia: icon-bounce; }
nav a[href*='payments']::before       { --icon: var(--n-wallet); }
nav a[href*='certificates']   { --tone: #ffd37a; --ia: icon-tilt; }
nav a[href*='certificates']::before   { --icon: var(--n-award); }
nav a[href*='my-certificates']::before { --icon: var(--n-shield); }
nav a[href*='eligibility']    { --tone: #7be0a4; --ia: icon-bounce; }
nav a[href*='eligibility']::before    { --icon: var(--n-shield); }
nav a[href*='certificate-config'] { --tone: #8fc4f5; --ia: icon-flip; }
nav a[href*='certificate-config']::before { --icon: var(--n-sliders); }
nav a[href*='users']          { --tone: #8fc4f5; --ia: icon-tilt; }
nav a[href*='users']::before          { --icon: var(--n-users); }
nav a[href*='programs']       { --tone: #6fd6cc; --ia: icon-nudge; }
nav a[href*='programs']::before       { --icon: var(--n-book); }
nav a[href*='profile']        { --tone: #8fc4f5; --ia: icon-bounce; }
nav a[href*='profile']::before        { --icon: var(--n-user); }
nav a[href*='activity']       { --tone: #9ec5ff; --ia: icon-nudge; }
nav a[href*='activity']::before,
nav a[href*='logs']::before           { --icon: var(--n-list); }

/* staggered entrance */
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

/* ---------- Hover ---------- */
nav a:hover {
  color: #fff;
  transform: translateX(5px);
  background-size: 100% 100%;
}

/* on hover the icon takes its own colour, glows, and plays its own motion */
nav a:hover::before {
  color: var(--tone);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--tone) 65%, transparent));
  animation: var(--ia) 0.65s var(--spring);
}

/* ---------- Active page ---------- */
nav a.router-link-active {
  color: #fff;
  font-weight: 700;
  transform: translateX(3px);
  background-color: rgb(143 196 245 / 12%);
  background-size: 100% 100%;
  box-shadow: inset 0 0 0 1px rgb(143 196 245 / 24%), 0 10px 20px -14px rgb(0 0 0 / 60%);
}

nav a.router-link-active::before {
  color: var(--tone);
  filter: drop-shadow(0 0 7px color-mix(in srgb, var(--tone) 70%, transparent));
  animation: icon-pop 0.5s var(--spring) both;
}

/* glowing bar on the left edge */
nav a.router-link-active::after {
  content: '';
  position: absolute;
  top: 9px;
  bottom: 9px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--tone);
  box-shadow: 0 0 12px 1px color-mix(in srgb, var(--tone) 75%, transparent);
  animation: bar-grow 0.45s var(--spring) both;
}

/* optional count pill: <span class="nav-badge">3</span> */
.nav-badge {
  margin-left: auto;
  min-width: 22px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--sky);
  color: var(--navy-deep);
  font-size: 11.5px;
  font-weight: 800;
  text-align: center;
  animation: badge-pulse 2.4s ease-in-out infinite;
}

nav a:focus-visible,
.sign-out:focus-visible,
.brand:focus-visible { outline: 3px solid var(--sky); outline-offset: 2px; }

/* ================= Bottom ================= */
.side-bottom {
  display: grid;
  gap: 12px;
  margin-top: auto;
  animation: fade-in 0.8s ease 0.9s both;
}

.sign-out {
  position: relative;
  justify-content: center;
  gap: 10px;
  padding: 11px 14px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 12px;
  background: transparent;
  color: #e3edf7;
  font: inherit;
  font-weight: 700;
  text-align: center;
  overflow: hidden;
  cursor: pointer;
  transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease, transform 0.2s var(--spring);
}

/* a door icon shows when the template has no inline icon of its own */
.sign-out:not(:has(.nav-icon))::before {
  content: '';
  width: 18px;
  height: 18px;
  background-color: currentColor;
  -webkit-mask: var(--n-door) center / contain no-repeat;
  mask: var(--n-door) center / contain no-repeat;
  transition: transform 0.3s var(--spring);
}

.sign-out:hover:not(:disabled) {
  background: rgb(255 120 100 / 15%);
  border-color: rgb(255 150 135 / 55%);
  color: #ffd9d3;
  transform: translateY(-1px);
}
.sign-out:hover:not(:disabled) .nav-icon,
.sign-out:hover:not(:disabled):not(:has(.nav-icon))::before { transform: translateX(4px); }
.sign-out:active:not(:disabled) { transform: scale(0.97); }
.sign-out:disabled { cursor: wait; opacity: 0.8; }
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

.sign-out-compact { display: none; justify-content: center; }

.side-note {
  margin: 0;
  color: rgb(227 237 247 / 60%);
  font-size: 12px;
  text-align: center;
}

/* ================= Main ================= */
.main-content {
  grid-column: 2;
  min-width: 0;
  width: 100%;
  padding: 30px;
  animation: content-in 0.6s var(--ease) 0.15s both;
}

/* ================= Keyframes ================= */
@keyframes slide-in-left { from { opacity: 0; transform: translateX(-22px); } to { opacity: 1; transform: none; } }
@keyframes fade-down     { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
@keyframes fade-in       { from { opacity: 0; } to { opacity: 1; } }
@keyframes content-in    { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes pop-in {
  0%   { opacity: 0; transform: scale(0.9) translateY(8px); }
  100% { opacity: 1; transform: none; }
}
@keyframes bar-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes spin     { to { transform: rotate(360deg); } }
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
@keyframes edge-travel { 0% { top: -140px; } 100% { top: 110%; } }
@keyframes aurora {
  from { background-position: 0% 0%, 100% 100%, 0 0; }
  to   { background-position: 30% 20%, 70% 80%, 0 0; }
}
@keyframes shimmer {
  0%, 100% { background-position: 100% 0; }
  50%      { background-position: 0% 0; }
}
@keyframes ping {
  0%       { box-shadow: 0 0 0 0 rgb(95 208 140 / 65%); }
  70%,100% { box-shadow: 0 0 0 8px rgb(95 208 140 / 0%); }
}
@keyframes badge-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgb(143 196 245 / 55%); }
  50%      { box-shadow: 0 0 0 6px rgb(143 196 245 / 0%); }
}
@keyframes load {
  from { background-position: -50% 0; }
  to   { background-position: 150% 0; }
}

/* icon motions: each link picks one with --ia */
@keyframes icon-pop {
  0%   { transform: scale(0.6) rotate(-20deg); }
  100% { transform: scale(1) rotate(0); }
}
@keyframes icon-tilt {
  0%   { transform: none; }
  40%  { transform: scale(1.22) rotate(-12deg); }
  100% { transform: scale(1.1) rotate(-6deg); }
}
@keyframes icon-bounce {
  0%   { transform: translateY(0) scale(1); }
  40%  { transform: translateY(-5px) scale(1.2); }
  100% { transform: translateY(0) scale(1.08); }
}
@keyframes icon-flip {
  0%   { transform: rotateY(0); }
  100% { transform: rotateY(360deg) scale(1.1); }
}
@keyframes icon-nudge {
  0%   { transform: translateX(0); }
  35%  { transform: translateX(4px) scale(1.15); }
  70%  { transform: translateX(-2px) scale(1.1); }
  100% { transform: translateX(0) scale(1.08); }
}
@keyframes icon-scan {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.25); }
  50%  { transform: scale(0.92); }
  100% { transform: scale(1.1); }
}
@keyframes icon-ring {
  0%, 100% { transform: rotate(0) scale(1.1); }
  20% { transform: rotate(16deg) scale(1.2); }
  40% { transform: rotate(-14deg) scale(1.2); }
  60% { transform: rotate(10deg) scale(1.15); }
  80% { transform: rotate(-6deg) scale(1.12); }
}

/* ================= Tablet and phone: off-canvas navigation ================= */
@media (max-width: 1023px) {
  .app-shell { display: block; min-height: 100vh; }

  .mobile-header {
    position: sticky;
    top: 0;
    z-index: 31;
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border-bottom: 1px solid var(--line);
    padding: 8px 16px;
    background: rgb(255 255 255 / 88%);
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 16px rgb(17 44 73 / 8%);
  }

  .sidebar {
    position: fixed;
    z-index: 41;
    top: 64px;
    bottom: 0;
    left: 0;
    width: min(290px, 86vw);
    height: auto;
    gap: 18px;
    padding: 20px 14px 18px;
    overflow-y: auto;
    transform: translateX(-105%);
    visibility: hidden;
    transition: transform 0.35s var(--ease), visibility 0.35s ease;
    box-shadow: 12px 0 32px rgb(17 44 73 / 22%);
    animation: aurora 14s ease-in-out infinite alternate;
  }
  .app-shell.nav-open .sidebar { transform: translateX(0); visibility: visible; }

  .sidebar-backdrop {
    position: fixed;
    z-index: 40;
    inset: 64px 0 0;
    border: 0;
    background: rgb(10 25 42 / 45%);
    backdrop-filter: blur(2px);
    cursor: pointer;
  }
  .app-shell.nav-open .sidebar-backdrop {
    display: block;
    animation: fade-in 0.3s ease both;
  }
  .sidebar-backdrop:focus-visible { outline-offset: -4px; }

  .sidebar::after { display: block; }

  /* the stagger replays every time the drawer opens.
     Only the animation NAME changes, so the per-link delays above are kept
     (the old `animation:` shorthand reset every delay to 0). */
  .sidebar nav a { animation-name: none; }
  .app-shell.nav-open .sidebar nav a { animation-name: slide-in-left; }

  .side-top { grid-template-columns: minmax(0, 1fr); align-items: stretch; gap: 18px; }
  .brand { padding: 0 8px; }
  .brand-text span { display: block; margin-left: 0; letter-spacing: 0.16em; }
  .account { justify-self: stretch; padding: 12px; border-radius: 14px; }
  .account::after { top: 42px; left: 44px; width: 9px; height: 9px; }
  .avatar { width: 40px; height: 40px; font-size: 16px; }
  .user-summary { display: grid; }
  .sign-out-compact { display: none; }

  .sidebar nav {
    display: grid;
    width: auto;
    min-width: 0;
    gap: 4px;
    overflow: visible;
    padding-bottom: 0;
  }
  .sidebar nav a {
    padding: 11px 14px 11px 12px;
    border-radius: 12px;
    white-space: normal;
  }
  .sidebar nav a:hover { transform: translateX(5px); }
  .sidebar nav a.router-link-active { transform: translateX(3px); }

  .side-bottom { display: grid; }

  .main-content {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow-x: clip;
    padding: clamp(0.75rem, 4vw, 1.125rem);
  }
}

@media (max-width: 479px) {
  .brand-mark { width: 32px; height: 32px; }
  .mobile-header { padding-inline: 12px; }
  .main-content { padding-inline: 0.75rem; }
}

/* ================= Reduced motion ================= */
@media (prefers-reduced-motion: reduce) {
  .sidebar, .sidebar::after, .brand, .brand-mark, .brand-text span, .account,
  .account::after, .avatar::before, nav a, nav a::before, nav a:hover::before,
  nav a.router-link-active::before, nav a.router-link-active::after,
  .nav-badge, .main-content, .side-bottom, .sign-out:disabled::after,
  .app-shell.nav-open .sidebar nav a, .app-shell.nav-open .sidebar-backdrop {
    animation: none !important;
  }
  .brand-mark, .account, nav a, nav a::before, .nav-icon, .sign-out,
  .menu-toggle, .menu-toggle span, .sidebar {
    transition: none !important;
  }
}
</style>