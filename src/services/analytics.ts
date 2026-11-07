import posthog from 'posthog-js'

interface AnalyticsUser {
  user_id: number | string
  role: string
}

type EventProperties = Record<string, string | number | boolean | null | undefined>

const consentKey = 'smarttrack.analytics-consent'
const projectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim()
const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'
const enabled = import.meta.env.VITE_POSTHOG_ENABLED?.toLowerCase() !== 'false'
const developmentEnabled = import.meta.env.VITE_POSTHOG_ENABLE_IN_DEVELOPMENT?.toLowerCase() === 'true'

let initialized = false
let currentUser: AnalyticsUser | null = null
let identifiedUserId = ''
let lastPagePath = ''
let lastPaymentStatus = ''

function isConfigured() {
  return Boolean(projectToken && enabled && (!import.meta.env.DEV || developmentEnabled))
}

function hasAnalyticsConsent() {
  return typeof window !== 'undefined' && window.localStorage.getItem(consentKey) === 'granted'
}

export function initializeAnalytics() {
  if (initialized || !projectToken || !isConfigured() || !hasAnalyticsConsent()) return

  posthog.init(projectToken, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    person_profiles: 'identified_only',
    ip: false,
    before_send: (event) => {
      if (!event?.properties) return event
      const safePath = window.location.pathname.replace(/\/\d+(?=\/|$)/g, '/:id')
      event.properties.$current_url = `${window.location.origin}${safePath}`
      delete event.properties.$initial_current_url
      delete event.properties.$referrer
      delete event.properties.$initial_referrer
      return event
    }
  })
  initialized = true
}

function capture(event: string, properties: EventProperties, allowAnonymous = false) {
  if (!isConfigured() || !hasAnalyticsConsent()) return
  if (!allowAnonymous && !currentUser) return
  initializeAnalytics()
  if (!initialized) return

  posthog.capture(event, {
    ...properties,
    ...(currentUser ? { user_role: currentUser.role } : {}),
    timestamp: new Date().toISOString()
  })
}

export function isAnalyticsConsentGranted() {
  return hasAnalyticsConsent()
}

export function setAnalyticsConsent(granted: boolean) {
  window.localStorage.setItem(consentKey, granted ? 'granted' : 'denied')
  if (!granted) {
    if (initialized) {
      posthog.opt_out_capturing()
      posthog.reset()
    }
    identifiedUserId = ''
    lastPagePath = ''
    lastPaymentStatus = ''
    return
  }

  initializeAnalytics()
  if (initialized) posthog.opt_in_capturing()
  if (currentUser) identifyAnalyticsUser(currentUser)
}

export function identifyAnalyticsUser(user: AnalyticsUser | null) {
  currentUser = user && user.user_id && user.role
    ? { user_id: user.user_id, role: user.role }
    : null

  if (!currentUser) {
    if (initialized && identifiedUserId) posthog.reset()
    identifiedUserId = ''
    return
  }

  initializeAnalytics()
  if (!initialized) return
  const distinctId = String(currentUser.user_id)
  if (identifiedUserId === distinctId) return
  if (identifiedUserId) posthog.reset()
  posthog.identify(distinctId, { role: currentUser.role })
  identifiedUserId = distinctId
}

export function captureAnalyticsEvent(event: string, module: string, category: string, extra: EventProperties = {}) {
  capture(event, { module, event_category: category, ...extra })
}

export function captureAnonymousAnalyticsEvent(event: string, module: string, category: string, extra: EventProperties = {}) {
  capture(event, { module, event_category: category, ...extra }, true)
}

export function trackPageView(path: string, title: string, dedupeKey = path) {
  if (!path || dedupeKey === lastPagePath) return
  lastPagePath = dedupeKey
  captureAnalyticsEvent('page_view', 'navigation', 'website', {
    page_path: path,
    page_title: title
  })
}

export function trackRouteActivity(path: string, paymentStatus?: unknown) {
  if (!currentUser) return

  if (path === '/dashboard' && currentUser.role === 'trainee') {
    captureAnalyticsEvent('trainee_dashboard_viewed', 'dashboard', 'trainee')
  }
  if (path === '/classes' || path === '/classes/:id') {
    captureAnalyticsEvent('training_viewed', 'training', 'engagement')
  }
  if (path === '/attendance') {
    captureAnalyticsEvent('attendance_viewed', 'attendance', 'engagement')
  }
  if (path === '/announcements') {
    captureAnalyticsEvent('announcement_viewed', 'announcements', 'engagement')
  }

  if (path === '/payments' && (paymentStatus === 'success' || paymentStatus === 'failed')) {
    const status = String(paymentStatus)
    if (lastPaymentStatus !== status) {
      captureAnalyticsEvent(status === 'success' ? 'payment_completed' : 'payment_failed', 'payments', 'transaction')
      lastPaymentStatus = status
    }
  } else if (path === '/payments') {
    lastPaymentStatus = ''
  }
}

function bodyField(body: unknown, key: string): unknown {
  if (body instanceof FormData) return body.get(key)
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>
      return parsed[key]
    } catch {
      return undefined
    }
  }
  if (body && typeof body === 'object') return (body as Record<string, unknown>)[key]
  return undefined
}

function internalId(value: unknown) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

export function trackApiActivity(path: string, method: string, body?: unknown, succeeded = true) {
  const endpoint = (path.split('?')[0] || path).replace(/^\/api(?=\/)/, '')
  const verb = method.toUpperCase()

  if (!succeeded) {
    if (verb === 'POST' && endpoint === '/payments/xendit') {
      captureAnalyticsEvent('payment_failed', 'payments', 'transaction')
    }
    return
  }

  if (verb === 'POST' && endpoint === '/register' && bodyField(body, 'role') === 'trainee') {
    captureAnonymousAnalyticsEvent('trainee_registered', 'trainees', 'account', { user_role: 'trainee' })
    return
  }
  if (verb === 'POST' && endpoint === '/profile/save' && currentUser?.role === 'trainee') {
    captureAnalyticsEvent('trainee_profile_updated', 'trainees', 'profile')
    return
  }
  if (verb === 'POST' && endpoint === '/modules/trainees/save') {
    if (internalId(bodyField(body, 'trainee_id'))) {
      captureAnalyticsEvent('trainee_profile_updated', 'trainees', 'profile')
    } else {
      captureAnalyticsEvent('trainee_registered', 'trainees', 'account')
    }
    return
  }
  if (verb === 'POST' && endpoint === '/modules/enrollments/save') {
    const status = String(bodyField(body, 'status') || '').toLowerCase()
    const enrollmentId = internalId(bodyField(body, 'enrollment_id'))
    const trainingId = internalId(bodyField(body, 'class_id') ?? bodyField(body, 'program_id'))
    if (status === 'completed') {
      captureAnalyticsEvent('training_completed', 'training', 'completion', trainingId ? { training_id: trainingId } : {})
    } else if (!enrollmentId) {
      captureAnalyticsEvent('training_enrolled', 'training', 'enrollment', trainingId ? { training_id: trainingId } : {})
    }
    return
  }
  if (verb === 'POST' && endpoint === '/documents/upload') {
    captureAnalyticsEvent('document_uploaded', 'documents', 'submission')
    if (currentUser?.role === 'trainee') {
      captureAnalyticsEvent('document_submission_completed', 'documents', 'submission')
    }
    return
  }
  if (verb === 'POST' && (endpoint === '/attendance/scan' || endpoint === '/modules/attendance/save')) {
    captureAnalyticsEvent('attendance_marked', 'attendance', 'record')
    return
  }
  if (verb === 'POST' && endpoint === '/certificates/issue') {
    const trainingId = internalId(bodyField(body, 'class_id'))
    captureAnalyticsEvent('training_completed', 'training', 'completion', trainingId ? { training_id: trainingId } : {})
    captureAnalyticsEvent('certificate_generated', 'certificates', 'issuance')
    return
  }
  if (verb === 'POST' && endpoint === '/modules/announcements/save') {
    if (!internalId(bodyField(body, 'announcement_id'))) {
      captureAnalyticsEvent('announcement_created', 'announcements', 'management')
    }
    return
  }
  if (verb === 'POST' && endpoint === '/payments/xendit') {
    captureAnalyticsEvent('payment_initiated', 'payments', 'transaction')
    return
  }
  if (verb === 'POST' && endpoint === '/payments/record') {
    captureAnalyticsEvent('payment_completed', 'payments', 'transaction')
  }
}

export function trackFileAccess(target: EventTarget | null) {
  if (!(target instanceof Element)) return
  const anchor = target.closest('a[href]') as HTMLAnchorElement | null
  if (!anchor) return
  const pathname = new URL(anchor.href, window.location.origin).pathname
  if (/\/api\/documents\/\d+$/.test(pathname)) {
    captureAnalyticsEvent('document_viewed', 'documents', 'content')
  } else if (/\/api\/certificates\/\d+\/download$/.test(pathname)) {
    captureAnalyticsEvent('certificate_downloaded', 'certificates', 'content')
  }
}
