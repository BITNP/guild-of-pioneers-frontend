export interface User {
  id: number
  userName: string
  avatar: string | null
  phone: string
  email: string | null
  department: string | null
}

interface ApiErrorBody {
  status: number
  error: string
  message: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers,
  })

  if (!response.ok) {
    let body: ApiErrorBody | null = null
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(response.status, body?.message ?? `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function login(phone: string, password: string, rememberMe: boolean): Promise<User> {
  return apiFetch<User>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password, rememberMe }),
  })
}

export function logout(): Promise<void> {
  return apiFetch<void>('/api/auth/logout', { method: 'POST' })
}

export function fetchMe(): Promise<User> {
  return apiFetch<User>('/api/auth/me')
}

export function uploadAvatar(file: File): Promise<User> {
  const body = new FormData()
  body.append('file', file)
  return apiFetch<User>('/api/auth/avatar', {
    method: 'PUT',
    body,
  })
}
