import { API_BASE_URL } from '../config'
import {
  captureAnalyticsEvent,
  captureAnonymousAnalyticsEvent,
  identifyAnalyticsUser,
  trackApiActivity
} from './analytics'

let csrfToken = ''

export class ApiError extends Error {
  constructor(message, status = 0, errors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

function showErrorToast(message) {
  window.dispatchEvent(new CustomEvent('app-toast', {
    detail: { message, type: 'error' }
  }))
}

function redirectToLogin() {
  if (window.location.pathname === '/login') return
  const redirect = `${window.location.pathname}${window.location.search}`
  window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`)
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const urlPath = path.startsWith('/') ? path : `/${path}`
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  let body = options.body
  if (body !== undefined && !isFormData && typeof body !== 'string') {
    body = JSON.stringify(body)
  }
  if (body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken) await getSession()
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${urlPath}`, {
      ...options,
      method,
      body,
      headers,
      credentials: 'include'
    })
  } catch {
    trackApiActivity(urlPath, method, options.body, false)
    const error = new ApiError('The server could not be reached. Check your connection and try again.')
    showErrorToast(error.message)
    throw error
  }

  let payload
  let responseText = ''
  try {
    responseText = await response.text()
    payload = responseText ? JSON.parse(responseText) : null
  } catch {
    payload = null
  }

  if (!payload || typeof payload !== 'object') {
    const error = new ApiError(
      response.ok
        ? 'The server returned an invalid response.'
        : `The server returned an invalid response (${response.status}).`,
      response.status
    )
    showErrorToast(error.message)
    throw error
  }

  const data = payload.data && typeof payload.data === 'object' ? payload.data : {}
  if (typeof data.csrf === 'string') csrfToken = data.csrf

  if (!response.ok || payload.ok !== true) {
    trackApiActivity(urlPath, method, options.body, false)
    const error = new ApiError(
      payload.message || `Request failed (${response.status}).`,
      response.status,
      payload.errors || {}
    )
    if (response.status === 401 && !['/login', '/session'].includes(urlPath)) {
      redirectToLogin()
    }
    showErrorToast(error.message)
    throw error
  }

  trackApiActivity(urlPath, method, options.body)
  return payload
}

export function apiGet(path) {
  return apiRequest(path)
}

export function apiPost(path, body) {
  return apiRequest(path, { method: 'POST', body })
}

export function apiFileUrl(path) {
  const urlPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${urlPath}`
}

export async function getSession() {
  const response = await apiRequest('/session')
  identifyAnalyticsUser(response.data.authenticated ? response.data.user : null)
  return response.data
}

export async function login(username, password) {
  try {
    const response = await apiRequest('/login', {
      method: 'POST',
      body: { username, password }
    })
    identifyAnalyticsUser(response.data.authenticated ? response.data.user : null)
    if (response.data.user) {
      captureAnalyticsEvent('user_logged_in', 'authentication', 'authentication')
    }
    return response.data
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 401) {
      captureAnonymousAnalyticsEvent('login_failed', 'authentication', 'authentication')
    }
    throw reason
  }
}

export async function register(profile) {
  const response = await apiRequest('/register', {
    method: 'POST',
    body: profile
  })
  return response.data
}

export async function logout() {
  const response = await apiRequest('/logout', { method: 'POST', body: {} })
  captureAnalyticsEvent('user_logged_out', 'authentication', 'authentication')
  csrfToken = ''
  identifyAnalyticsUser(null)
  return response.data
}

export async function scanAttendance(scan) {
  return apiPost('/attendance/scan', scan)
}
