<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Camera, Pencil } from '@lucide/vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AvatarCropper from '@/components/AvatarCropper.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAuth } from '@/composables/useAuth'
import { ApiError, fetchUser, type User } from '@/lib/api'

const route = useRoute()
const { user, refresh, uploadAvatar, updateProfile, updateUserProfile, uploadUserAvatar } = useAuth()

const isOwnProfile = computed(() => route.name === 'account')
const profileId = computed(() => Number(route.params.id))

const isAdmin = computed(() => user.value?.departments.some((d) => d.department === 'ADMIN') ?? false)
const canEdit = computed(() => isOwnProfile.value || isAdmin.value)

const profile = ref<User | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const displayUser = computed<User | null>(() => (isOwnProfile.value ? user.value : profile.value))

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024

const fileInput = ref<HTMLInputElement | null>(null)
const cropSrc = ref<string | null>(null)
const cropFile = ref<File | null>(null)
const cropLoading = ref(false)
const cropError = ref<string | null>(null)
const fileError = ref('')

const isEditing = ref(false)
const saving = ref(false)
const editError = ref<string | null>(null)
const editForm = reactive({
  phone: '',
  email: '',
})

async function load() {
  if (isOwnProfile.value) {
    if (user.value === null) {
      await refresh()
    }
    return
  }
  loading.value = true
  error.value = null
  try {
    profile.value = await fetchUser(profileId.value)
  } catch (err) {
    profile.value = null
    error.value =
      err instanceof ApiError && err.status === 404
        ? 'User not found.'
        : 'Failed to load user.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.fullPath, load)

function startEdit() {
  if (!displayUser.value) return
  editForm.phone = displayUser.value.phone
  editForm.email = displayUser.value.email ?? ''
  editError.value = null
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editError.value = null
}

async function onSaveEdit() {
  if (!user.value || !displayUser.value) return
  editError.value = null
  saving.value = true
  try {
    const input = {
      phone: editForm.phone,
      email: editForm.email.trim() || null,
    }
    const updated = isOwnProfile.value
      ? await updateProfile(input)
      : await updateUserProfile(profileId.value, input)
    if (!isOwnProfile.value) {
      profile.value = updated
    }
    isEditing.value = false
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      editError.value = 'Phone is already in use.'
    } else if (error instanceof ApiError && error.status === 400) {
      editError.value = error.message
    } else if (error instanceof ApiError && error.status >= 500) {
      editError.value = 'Something went wrong on our end. Please try again later.'
    } else if (error instanceof Error) {
      editError.value = error.message
    } else {
      editError.value = 'Something went wrong. Please try again.'
    }
  } finally {
    saving.value = false
  }
}

function openFilePicker() {
  fileError.value = ''
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  fileError.value = ''
  if (!file) return

  if (!ALLOWED_TYPES.includes(file.type)) {
    fileError.value = 'Unsupported image type. Please choose a JPEG, PNG, WebP, or GIF file.'
    return
  }
  if (file.size > MAX_SIZE) {
    fileError.value = 'Image is too large. Maximum size is 5MB.'
    return
  }

  cropSrc.value = URL.createObjectURL(file)
  cropFile.value = file
  cropError.value = null
}

function closeCrop() {
  if (cropSrc.value) URL.revokeObjectURL(cropSrc.value)
  cropSrc.value = null
  cropFile.value = null
  cropError.value = null
}

async function onCropConfirm(file: File) {
  cropLoading.value = true
  cropError.value = null
  try {
    const updated = isOwnProfile.value
      ? await uploadAvatar(file)
      : await uploadUserAvatar(profileId.value, file)
    if (!isOwnProfile.value) {
      profile.value = updated
    }
    closeCrop()
  } catch (error) {
    cropError.value =
      error instanceof ApiError && error.status === 413
        ? 'Image is too large. Maximum size is 5MB.'
        : error instanceof Error
          ? error.message
          : 'Upload failed. Please try again.'
  } finally {
    cropLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <AppSidebar />
    <main class="flex flex-1 flex-col gap-6 p-8">
      <header>
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ isOwnProfile ? 'My Account' : (displayUser?.userName ?? 'User') }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ isOwnProfile ? 'Your account information.' : 'User profile.' }}
        </p>
      </header>

      <p v-if="loading" class="text-sm text-muted-foreground">Loading…</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
      <p v-else-if="!displayUser" class="text-sm text-muted-foreground">Loading your information…</p>

      <div v-else class="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div class="flex flex-wrap items-center gap-4">
          <div class="group relative">
            <UserAvatar
              :name="displayUser.userName"
              :avatar="displayUser.avatar"
              size-class="h-14 w-14 text-lg font-bold"
            />
            <button
              v-if="canEdit"
              type="button"
              class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
              :aria-label="`Change ${displayUser.userName}'s avatar`"
              @click="openFilePicker"
            >
              <Camera class="h-5 w-5" :stroke-width="2" />
            </button>
          </div>
          <div class="flex flex-1 flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ displayUser.userName }}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                #{{ displayUser.id }}
              </span>
            </div>
          </div>
          <button
            v-if="canEdit"
            type="button"
            class="ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            @click="isEditing ? cancelEdit() : startEdit()"
          >
            <Pencil v-if="!isEditing" class="h-4 w-4" :stroke-width="2" />
            {{ isEditing ? 'Cancel' : 'Edit' }}
          </button>
        </div>

        <p
          v-if="fileError"
          class="text-sm text-destructive"
          role="alert"
        >
          {{ fileError }}
        </p>

        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="hidden"
          @change="onFileChange"
        >

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
            <label for="profile-phone" class="text-xs text-muted-foreground">Phone</label>
            <input
              v-if="canEdit && isEditing"
              id="profile-phone"
              v-model="editForm.phone"
              type="text"
              class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
            <span v-else class="text-sm font-medium">{{ displayUser.phone }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
            <label for="profile-email" class="text-xs text-muted-foreground">Email</label>
            <input
              v-if="canEdit && isEditing"
              id="profile-email"
              v-model="editForm.email"
              type="email"
              class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
            <span v-else class="text-sm font-medium">{{ displayUser.email ?? '—' }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
            <span class="text-xs text-muted-foreground">Department</span>
            <span v-if="displayUser.departments.length" class="text-sm font-medium">
              {{ displayUser.departments.map(d => d.department).join(', ') }}
            </span>
            <span v-else class="text-sm font-medium">—</span>
          </div>
          <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
            <span class="text-xs text-muted-foreground">Role</span>
            <span v-if="displayUser.departments.length" class="text-sm font-medium">
              {{ displayUser.departments.map(d => d.role).join(', ') }}
            </span>
            <span v-else class="text-sm font-medium">—</span>
          </div>
        </div>

        <p
          v-if="editError"
          class="text-sm text-destructive"
          role="alert"
        >
          {{ editError }}
        </p>

        <div v-if="canEdit && isEditing" class="flex justify-end">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            :disabled="saving"
            @click="onSaveEdit"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </main>

    <AvatarCropper
      v-if="cropSrc"
      :src="cropSrc"
      :file="cropFile"
      :loading="cropLoading"
      :error="cropError"
      @confirm="onCropConfirm"
      @cancel="closeCrop"
      @error="(message) => (fileError = message)"
    />
  </div>
</template>
