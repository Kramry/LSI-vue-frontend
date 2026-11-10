<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
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

watch(() => route.fullPath, closeNavigation)

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
  </div>
</template>

<style scoped>
.app-shell {
  --navy: #173a60;
  --navy-deep: #0e2640;
  --blue: #2a68a3;
  --sky: #8fc4f5;
  --mint: #5fd08c;
  --line: #dbe4ef;          /* was used but never defined */
  --page: #f3f6fb;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
 
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
 
/* ================= Icons (inline SVG, inherits text colour) ================= */
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
    radial-gradient(80% 36% at 0% 0%, rgb(143 196 245 / 26%), transparent 70%),
    radial-gradient(70% 30% at 100% 100%, rgb(95 208 140 / 10%), transparent 70%),
    linear-gradient(180deg, var(--navy) 0%, var(--navy-deep) 100%);
  animation: slide-in-left 0.6s var(--ease) both;
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
.brand-text span {
  display: block;
  margin-top: 2px;
  color: var(--sky);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
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
 
/* shine sweep on hover */
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
nav { display: grid; align-content: start; gap: 4px; }
 
nav a {
  position: relative;
  padding: 11px 14px;
  border-radius: 11px;
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
  box-sizing: border-box;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
/* icon + label are left aligned (was centred) */
nav a { justify-content: flex-start; gap: 12px; }
.sign-out { justify-content: center; gap: 10px; }
.sign-out-compact { justify-content: center; }
 
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
 
/* highlight grows from the left edge */
nav a::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 11px;
  background: linear-gradient(90deg, rgb(143 196 245 / 24%), rgb(143 196 245 / 5%));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s var(--ease);
}
 
nav a:hover { color: #fff; transform: translateX(5px); }
nav a:hover::after { transform: scaleX(1); }
nav a:hover .nav-icon { transform: scale(1.18) rotate(-6deg); color: var(--sky); }
 
/* active page */
nav a.router-link-active {
  color: #fff;
  background: rgb(143 196 245 / 16%);
  font-weight: 700;
  transform: translateX(3px);
  box-shadow: inset 0 0 0 1px rgb(143 196 245 / 22%);
}
nav a.router-link-active::after { transform: scaleX(1); opacity: 0.6; }
nav a.router-link-active .nav-icon { color: var(--sky); animation: icon-pop 0.5s var(--spring) both; }
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
  padding: 11px 14px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 11px;
  background: transparent;
  color: #e3edf7;
  font: inherit;
  font-weight: 700;
  text-align: center;
  overflow: hidden;
  cursor: pointer;
  transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease, transform 0.2s var(--spring);
}
.sign-out:hover:not(:disabled) {
  background: rgb(255 120 100 / 15%);
  border-color: rgb(255 150 135 / 55%);
  color: #ffd9d3;
  transform: translateY(-1px);
}
.sign-out:hover:not(:disabled) .nav-icon { transform: translateX(4px); }
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
 
.sign-out-compact { display: none; }
 
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
@keyframes icon-pop {
  0%   { transform: scale(0.6) rotate(-20deg); }
  100% { transform: scale(1) rotate(0); }
}
@keyframes bar-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes spin     { to { transform: rotate(360deg); } }
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
@keyframes edge-travel { 0% { top: -140px; } 100% { top: 110%; } }
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
    animation: none;
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
 
  /* re-run the stagger every time the drawer opens */
  .app-shell.nav-open .sidebar nav a { animation: slide-in-left 0.45s var(--ease) both; }
 
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
    padding: 11px 14px;
    border-radius: 11px;
    white-space: normal;
    animation: none;
  }
  .sidebar nav a:hover { transform: translateX(5px); }
  .sidebar nav a.router-link-active { transform: translateX(3px); }
  .sidebar nav a::after { border-radius: 11px; }
 
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
  .sidebar, .sidebar::after, .brand, .brand-mark, .account, .account::after,
  .avatar::before, nav a, nav a.router-link-active::before,
  nav a.router-link-active .nav-icon, .nav-badge, .main-content,
  .side-bottom, .sign-out:disabled::after,
  .app-shell.nav-open .sidebar nav a, .app-shell.nav-open .sidebar-backdrop {
    animation: none;
  }
  .brand-mark, .account, nav a, nav a::after, .nav-icon, .sign-out,
  .menu-toggle, .menu-toggle span, .sidebar {
    transition: none;
  }
}
</style>
