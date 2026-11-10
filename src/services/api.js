import { API_BASE_URL } from '../config'

let csrfToken = ''
let accessToken = window.sessionStorage.getItem('smarttrack_access_token') || ''
let refreshPromise = null

function saveAccessToken(token) {
  accessToken = token
  if (token) {
    window.sessionStorage.setItem('smarttrack_access_token', token)
  } else {
    window.sessionStorage.removeItem('smarttrack_access_token')
  }
}

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

async function request(path, options, canRefresh, silent) {
  const method = (options.method || 'GET').toUpperCase()
  const urlPath = path.startsWith('/') ? path : `/${path}`
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  let body = options.body
  if (body !== undefined && !isFormData && typeof body !== 'string') {
    body = JSON.stringify(body)
  }
  if (body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken) {
      await request('/session', {}, false, true)
    }
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
    const error = new ApiError('The server could not be reached. Check your connection and try again.')
    if (!silent) showErrorToast(error.message)
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
    const responseTextPreview = responseText
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180)
    const contentType = response.headers.get('Content-Type') || ''
    const isMarkupOrStylesheet = /text\/(?:html|css)/i.test(contentType)
      || /@font-face|<\/?(?:!doctype|html|head|body|style)\b/i.test(responseText)
    let message = response.ok
      ? `The analytics server returned an invalid response (HTTP ${response.status}).`
      : `The server returned an invalid response (${response.status}).`
    if (responseTextPreview && !isMarkupOrStylesheet) {
      message = `${responseTextPreview}${/HTTP [0-9]+/.test(responseTextPreview) ? '' : ` (HTTP ${response.status})`}`
    }
    const error = new ApiError(
      message,
      response.status
    )
    if (!silent) showErrorToast(error.message)
    throw error
  }

  const data = payload.data && typeof payload.data === 'object' ? payload.data : {}
  if (typeof data.csrf === 'string') csrfToken = data.csrf
  if (typeof data.access_token === 'string') saveAccessToken(data.access_token)

  const isAuthenticationFailure = response.status === 401
    || payload.ok === false && (
      payload.authenticated === false
      || /sign in|not authenticated|session expired|login required/i.test(String(payload.message || ''))
    )

  if (!response.ok || payload.ok !== true) {
    if (response.status === 401 && canRefresh && accessToken
      && !['/login', '/refresh', '/session'].includes(urlPath)) {
      try {
        await refreshAccessToken()
        return request(path, options, false, silent)
      } catch (refreshError) {
        saveAccessToken('')
      }
    }

    const error = new ApiError(
      payload.message || `Request failed (${response.status}).`,
      response.status,
      payload.errors || {}
    )
    if (isAuthenticationFailure && !['/login', '/session', '/refresh'].includes(urlPath)) {
      redirectToLogin()
    }
    if (!silent) showErrorToast(error.message)
    throw error
  }

  return payload
}

export function apiRequest(path, options = {}) {
  return request(path, options, true, false)
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = request('/refresh', {
      method: 'POST',
      body: {}
    }, false, true)
      .then((response) => response.data)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
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

export async function downloadFile(path, options = {}) {
  const urlPath = path.startsWith('/') ? path : `/${path}`
  const response = await fetch(`${API_BASE_URL}${urlPath}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: '*/*' }
  })

  if (!response.ok) {
    let message = `The server could not fetch the requested file (${response.status}).`
    try {
      const payload = await response.json()
      if (payload?.message) message = payload.message
    } catch {
      try {
        const text = await response.text()
        if (text) message = text.replace(/\s+/g, ' ').trim().slice(0, 180)
      } catch {
        // ignore secondary parsing errors
      }
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const fileUrl = URL.createObjectURL(blob)
  const fileName = options.filename || path.split('/').pop() || 'download'

  if (options.openInNewTab) {
    const popup = window.open(fileUrl, '_blank', 'noopener,noreferrer')
    if (!popup) {
      URL.revokeObjectURL(fileUrl)
      throw new Error('Your browser blocked the file preview popup. Please allow pop-ups and try again.')
    }
    return { fileUrl, fileName, blob }
  }

  const anchor = document.createElement('a')
  anchor.href = fileUrl
  anchor.download = fileName
  anchor.rel = 'noopener noreferrer'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  setTimeout(() => URL.revokeObjectURL(fileUrl), 500)
  return { fileUrl, fileName, blob }
}

export async function getSession() {
  const response = await apiRequest('/session')
  if (response.data.authenticated) return response.data

  try {
    await refreshAccessToken()
  } catch (reason) {
    if (!(reason instanceof ApiError) || ![401, 403].includes(reason.status)) {
      throw reason
    }
    return response.data
  }

  const refreshedSession = await apiRequest('/session')
  return refreshedSession.data
}

export async function login(username, password) {
  try {
    const response = await apiRequest('/login', {
      method: 'POST',
      body: { username, password }
    })
    return response.data
  } catch (reason) {
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
  csrfToken = ''
  saveAccessToken('')
  return response.data
}

export async function scanAttendance(scan) {
  return apiPost('/attendance/scan', scan)
}
