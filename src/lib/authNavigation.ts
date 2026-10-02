import type { AuthState } from './api'

/** Keep login return paths on this site and outside machine endpoints. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || /[\\\s\u0000-\u001f\u007f]/.test(value) || /%(2f|5c|0[ad])/i.test(value)) return '/'
  try {
    const url = new URL(value, 'https://guild.invalid')
    if (url.origin !== 'https://guild.invalid' || url.pathname.startsWith('/api/') || url.pathname === '/login') return '/'
    return value
  } catch {
    return '/'
  }
}

/** Pending identities may use admission pages, but never enter a business route. */
export function authDestination(state: AuthState, route: {
  name: unknown; fullPath: string; public: boolean; redirect?: unknown
}): { name: string; query?: { redirect: string } } | null {
  if (state === 'anonymous' && route.name !== 'login') {
    return { name: 'login', query: { redirect: safeReturnTo(route.fullPath) } }
  }
  if (state === 'onboarding_required' && route.name !== 'register') {
    return { name: 'register', query: { redirect: safeReturnTo(route.public ? route.redirect : route.fullPath) } }
  }
  if (state === 'active' && route.public) return { name: 'home' }
  return null
}
