import { computed, ref } from 'vue'
import { fetchAuthStatus, logout as apiLogout, registerUser as apiRegister, updateProfile as apiUpdateProfile, updateUserProfile as apiUpdateUserProfile, uploadAvatar as apiUploadAvatar, uploadUserAvatar as apiUploadUserAvatar, type AuthState, type AuthStatus, type RegisterInput, type UpdateProfileInput, type User } from '@/lib/api'
import { safeReturnTo } from '@/lib/authNavigation'

const user = ref<User | null>(null)
const isLoading = ref(false)
const state = ref<AuthState>('anonymous')
const suggestions = ref<AuthStatus['suggestions']>(null)
const bootstrapAdmin = ref(false)

const isAuthenticated = computed(() => user.value !== null)

async function refresh(): Promise<boolean> {
  const status = await fetchAuthStatus()
  state.value = status.state
  user.value = status.user
  suggestions.value = status.suggestions
  bootstrapAdmin.value = status.bootstrapAdmin
  return isAuthenticated.value
}

function login(returnTo = '/'): void {
  window.location.assign(`/api/auth/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`)
}

async function logout(): Promise<void> {
  await apiLogout()
  user.value = null
  state.value = 'anonymous'
  suggestions.value = null
  bootstrapAdmin.value = false
}

async function register(input: RegisterInput): Promise<User> {
  user.value = await apiRegister(input)
  state.value = 'active'
  suggestions.value = null
  bootstrapAdmin.value = false
  return user.value
}

async function uploadAvatar(file: File): Promise<User> {
  user.value = await apiUploadAvatar(file)
  return user.value
}

async function updateProfile(profile: UpdateProfileInput): Promise<User> {
  user.value = await apiUpdateProfile(profile)
  return user.value
}

async function updateUserProfile(id: number, profile: UpdateProfileInput): Promise<User> {
  return apiUpdateUserProfile(id, profile)
}

async function uploadUserAvatar(id: number, file: File): Promise<User> {
  return apiUploadUserAvatar(id, file)
}

export function useAuth() {
  return {
    user,
    isLoading,
    isAuthenticated,
    state,
    suggestions,
    bootstrapAdmin,
    refresh,
    login,
    register,
    logout,
    uploadAvatar,
    updateProfile,
    updateUserProfile,
    uploadUserAvatar,
  }
}
