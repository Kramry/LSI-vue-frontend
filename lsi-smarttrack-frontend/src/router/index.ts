
import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'
import { getSession } from '../services/api'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          component: () => import('../views/Dashboard.vue')
        },
        {
          path: 'accounts',
          component: () => import('../views/Profile.vue')
        },
        {
          path: 'trainees',
          component: () => import('../views/Trainees.vue')
        },
        {
          path: 'attendance',
          component: () => import('../views/Attendance.vue')
        },
        {
          path: 'programs',
          component: () => import('../views/ManagementModule.vue'),
          props: { section: 'programs' },
          meta: { roles: ['administrator', 'staff'] }
        },
        {
          path: 'classes',
          component: () => import('../views/ManagementModule.vue'),
          props: { section: 'classes' },
          meta: { roles: ['administrator', 'staff', 'instructor'] }
        },
        {
          path: 'schedules',
          component: () => import('../views/ManagementModule.vue'),
          props: { section: 'schedules' },
          meta: { roles: ['administrator', 'staff', 'instructor'] }
        },
        {
          path: 'enrollments',
          component: () => import('../views/ManagementModule.vue'),
          props: { section: 'enrollments' },
          meta: { roles: ['administrator', 'staff', 'instructor'] }
        },
        {
          path: 'announcements',
          component: () => import('../views/ManagementModule.vue'),
          props: { section: 'announcements' },
          meta: { roles: ['administrator', 'staff', 'instructor', 'trainee'] }
        },
        {
          path: 'inquiries',
          component: () => import('../views/ManagementModule.vue'),
          props: { section: 'inquiries' },
          meta: { roles: ['administrator', 'staff', 'instructor', 'trainee'] }
        },
        {
          path: 'assessments',
          component: () => import('../views/Assessments.vue'),
          meta: { roles: ['administrator', 'staff'] }
        },
        {
          path: 'payments',
          component: () => import('../views/Payments.vue'),
          meta: { roles: ['administrator', 'staff', 'trainee'] }
        },
        {
          path: 'analytics',
          component: () => import('../views/Analytics.vue'),
          meta: { roles: ['administrator', 'staff', 'instructor'] }
        },
        {
          path: 'documents',
          component: () => import('../views/Documents.vue'),
          meta: { roles: ['administrator', 'staff', 'instructor', 'trainee'] }
        },
        {
          path: 'certificates',
          component: () => import('../views/Certificate.vue'),
          meta: { roles: ['administrator', 'staff', 'trainee'] }
        },
        {
          path: 'certificates/signing',
          component: () => import('../views/Certificate.vue'),
          props: { mode: 'signing' },
          meta: { roles: ['administrator', 'staff'] }
        },
        {
          path: 'certificate-settings',
          component: () => import('../views/Certificate.vue'),
          props: { mode: 'settings' },
          meta: { roles: ['administrator'] }
        }
      ]
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue')
    }
  ]
})

router.beforeEach(async (to) => {
  if (to.name === 'login') return true

  try {
    const session = await getSession()
    if (session.authenticated) {
      const allowedRoles = to.meta.roles as string[] | undefined
      if (allowedRoles && !allowedRoles.includes(session.user?.role || '')) {
        return '/dashboard'
      }
      return true
    }
  } catch {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  return { name: 'login', query: { redirect: to.fullPath } }
})

export default router
