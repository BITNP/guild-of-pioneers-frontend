import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { authDestination, safeReturnTo } from '../src/lib/authNavigation'
import { updateProfile, uploadAvatar } from '../src/lib/api'
import { useAuth } from '../src/composables/useAuth'

const originalFetch = globalThis.fetch
const member = { id: 7, userName: 'LocalName', phone: '13800000000', email: 'local@example.com', avatar: null, departments: [], isManager: false }
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
beforeEach(async () => {
  globalThis.fetch = async () => json({ state: 'anonymous', user: null, suggestions: null, bootstrapAdmin: false })
  await useAuth().refresh()
})
afterEach(() => { globalThis.fetch = originalFetch })

describe('admission routing', () => {
  test('unbound OIDC users cannot enter any business route', async () => {
    globalThis.fetch = async () => json({
      state: 'onboarding_required', user: null, suggestions: { userName: 'Suggested', email: null }, bootstrapAdmin: false,
    })
    const auth = useAuth()
    expect(await auth.refresh()).toBe(false)
    expect(auth.state.value).toBe('onboarding_required')
    expect(auth.user.value).toBeNull()
    expect(authDestination(auth.state.value, { name: 'project', fullPath: '/projects', public: false }))
      .toEqual({ name: 'register', query: { redirect: '/projects' } })
    expect(authDestination(auth.state.value, { name: 'register', fullPath: '/register', public: true })).toBeNull()
  })
  test('anonymous invitation routes require OIDC first', () => {
    expect(authDestination('anonymous', { name: 'register', fullPath: '/register', public: true }))
      .toEqual({ name: 'login', query: { redirect: '/register' } })
    expect(authDestination('active', { name: 'register', fullPath: '/register', public: true })).toEqual({ name: 'home' })
    expect(authDestination('active', { name: 'project', fullPath: '/projects', public: false })).toBeNull()
  })
  test('return paths cannot redirect off-site or loop through machine endpoints', () => {
    for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example', '/login', '/api/auth/login', ['//evil.example']]) {
      expect(safeReturnTo(value)).toBe('/')
    }
    expect(safeReturnTo('/projects/7?view=tree')).toBe('/projects/7?view=tree')
  })
})

describe('session and CSRF requests', () => {
  test('registration establishes membership directly without a password login', async () => {
    const requests = []
    globalThis.fetch = async (path, options) => {
      requests.push({ path, options })
      if (path === '/api/auth/csrf') return json({ token: 'current-csrf', headerName: 'X-CSRF-TOKEN' })
      if (path === '/api/auth/register') return json(member, 201)
      throw new Error('Unexpected request')
    }
    const auth = useAuth()
    await auth.register({ userName: 'LocalName', phone: '13800000000', email: null, ticketCode: 'INVITE' })
    expect(auth.state.value).toBe('active')
    expect(auth.user.value.id).toBe(7)
    expect(requests.map((r) => r.path)).toEqual(['/api/auth/csrf', '/api/auth/register'])
    const request = requests[1].options
    expect(request.credentials).toBe('same-origin')
    expect(request.headers.get('X-CSRF-TOKEN')).toBe('current-csrf')
    expect(JSON.parse(request.body)).not.toHaveProperty('password')
  })
  test('every write uses a fresh CSRF token, including multipart uploads', async () => {
    let token = 0
    const writes = []
    globalThis.fetch = async (path, options) => {
      if (path === '/api/auth/csrf') return json({ token: 'token-' + ++token, headerName: 'X-CSRF-TOKEN' })
      writes.push(options)
      return json(member)
    }
    await updateProfile({ phone: '13800000000', email: null })
    await uploadAvatar(new File(['image'], 'avatar.png', { type: 'image/png' }))
    expect(writes.map((r) => r.headers.get('X-CSRF-TOKEN'))).toEqual(['token-1', 'token-2'])
    expect(writes[1].body).toBeInstanceOf(FormData)
    expect(writes[1].headers.has('Content-Type')).toBe(false)
  })
  test('failed logout preserves UI authentication so the user can retry', async () => {
    globalThis.fetch = async () => json({ state: 'active', user: member, suggestions: null, bootstrapAdmin: false })
    const auth = useAuth()
    await auth.refresh()
    globalThis.fetch = async (path) => path === '/api/auth/csrf'
      ? json({ token: 'csrf', headerName: 'X-CSRF-TOKEN' }) : json({ message: 'Unavailable' }, 503)
    await expect(auth.logout()).rejects.toThrow('Unavailable')
    expect(auth.user.value.id).toBe(7)
    expect(auth.state.value).toBe('active')
  })
  test('successful local logout clears all admission state without a provider redirect', async () => {
    globalThis.fetch = async () => json({ state: 'active', user: member, suggestions: null, bootstrapAdmin: false })
    const auth = useAuth()
    await auth.refresh()
    const paths = []
    globalThis.fetch = async (path) => {
      paths.push(path)
      return path === '/api/auth/csrf' ? json({ token: 'csrf', headerName: 'X-CSRF-TOKEN' }) : new Response(null, { status: 204 })
    }
    await auth.logout()
    expect(paths).toEqual(['/api/auth/csrf', '/api/auth/logout'])
    expect(auth.user.value).toBeNull()
    expect(auth.state.value).toBe('anonymous')
    expect(auth.bootstrapAdmin.value).toBe(false)
  })
})
