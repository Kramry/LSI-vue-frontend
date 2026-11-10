export interface ApiResponse<T> {
  ok: true
  data: T
  message: string
}

export interface SessionData {
  authenticated: boolean
  user: {
    user_id: number
    full_name: string
    username: string
    role: string
  } | null
  csrf: string
}

export class ApiError extends Error {
  status: number
  errors: Record<string, string>
}

export function apiRequest<T = Record<string, unknown>>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>>

export function apiGet<T = Record<string, unknown>>(path: string): Promise<ApiResponse<T>>
export function apiPost<T = Record<string, unknown>>(path: string, body: unknown): Promise<ApiResponse<T>>
export function apiFileUrl(path: string): string
export interface DownloadFileOptions {
  filename?: string
  openInNewTab?: boolean
}
export function downloadFile(path: string, options?: DownloadFileOptions): Promise<{ fileUrl: string; fileName: string; blob: Blob }>
export function getSession(): Promise<SessionData>
export function login(username: string, password: string): Promise<SessionData>
export function register(profile: Record<string, string>): Promise<{ registered: true }>
export function logout(): Promise<{ authenticated: false }>
export function scanAttendance(scan: {
  qr_code: string
  scan_action: 'in' | 'out'
  class_id: number
  schedule_id: number | null
}): Promise<ApiResponse<{
  trainee: { trainee_id: number; name: string }
  status: string
  scan_action: 'in' | 'out'
}>>
