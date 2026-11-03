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

<style scoped>
.app-shell {
  --navy: #173a60;
  --navy-deep: #112c49;
  --blue: #265f94;
  --sky: #8fc4f5;

  min-height: 100vh;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  background: var(--page, #f3f6fb);
}

/* ---------- Sidebar ---------- */
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px 14px 18px;
  overflow-y: auto;
  color: #e3edf7;
  background: linear-gradient(180deg, var(--navy) 0%, var(--navy-deep) 100%);
}

.side-top {
  display: grid;
  gap: 18px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 8px;
  color: #fff;
  text-decoration: none;
}

.brand-mark {
  display: block;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: contain;
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

/* ---------- Account card ---------- */
.account {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 12px;
  background: rgb(255 255 255 / 7%);
}

.avatar {
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

/* ---------- Navigation ---------- */
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
  transition: background 0.15s, color 0.15s;
}

nav a:hover {
  color: #fff;
  background: rgb(255 255 255 / 9%);
}

nav a.router-link-active {
  color: #fff;
  background: rgb(143 196 245 / 18%);
  font-weight: 700;
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
}

nav a:focus-visible,
.sign-out:focus-visible,
.brand:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

/* ---------- Bottom ---------- */
.side-bottom {
  display: grid;
  gap: 12px;
  margin-top: auto;
}

.sign-out {
  padding: 11px 14px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 9px;
  background: transparent;
  color: #e3edf7;
  font: inherit;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.sign-out:hover:not(:disabled) {
  background: rgb(255 255 255 / 10%);
  border-color: rgb(255 255 255 / 40%);
}

.sign-out:disabled {
  cursor: wait;
  opacity: 0.7;
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

/* ---------- Main ---------- */
.main-content {
  min-width: 0;
  padding: 30px;
}

/* ---------- Tablet and phone: top bar ---------- */
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
  }

  nav a.router-link-active::before {
    display: none;
  }

  .side-bottom {
    display: none;
  }

  .main-content {
    padding: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  nav a,
  .sign-out {
    transition: none;
  }
}
</style>