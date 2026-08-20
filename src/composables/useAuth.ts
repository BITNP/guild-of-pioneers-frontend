import { computed, ref } from 'vue'
import { ApiError, fetchMe, login as apiLogin, logout as apiLogout, registerUser as apiRegister, updateProfile as apiUpdateProfile, updateUserProfile as apiUpdateUserProfile, uploadAvatar as apiUploadAvatar, uploadUserAvatar as apiUploadUserAvatar, type RegisterInput, type UpdateProfileInput, type User } from '@/lib/api'

const user = ref<User | null>(null)
const isLoading = ref(false)

const isAuthenticated = computed(() => user.value !== null)

async function refresh(): Promise<boolean> {
  try {
    user.value = await fetchMe()
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      user.value = null
      return false
    }
    throw error
  }
}

async function login(username: string, password: string, rememberMe: boolean): Promise<User> {
  isLoading.value = true
  try {
    user.value = await apiLogin(username, password, rememberMe)
    return user.value
  } finally {
    isLoading.value = false
  }
}

async function logout(): Promise<void> {
  try {
    await apiLogout()
  } finally {
    user.value = null
  }
}

async function register(input: RegisterInput): Promise<User> {
  await apiRegister(input)
  user.value = await apiLogin(input.userName, input.password, false)
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
