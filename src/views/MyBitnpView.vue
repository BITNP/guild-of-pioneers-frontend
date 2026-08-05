<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Camera } from '@lucide/vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AvatarCropper from '@/components/AvatarCropper.vue'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/api'

const { user, refresh, uploadAvatar } = useAuth()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024

const fileInput = ref<HTMLInputElement | null>(null)
const cropSrc = ref<string | null>(null)
const cropLoading = ref(false)
const cropError = ref<string | null>(null)
const fileError = ref('')

onMounted(async () => {
  if (user.value === null) {
    await refresh()
  }
})

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
  cropError.value = null
}

function closeCrop() {
  if (cropSrc.value) URL.revokeObjectURL(cropSrc.value)
  cropSrc.value = null
  cropError.value = null
}

async function onCropConfirm(file: File) {
  cropLoading.value = true
  cropError.value = null
  try {
    await uploadAvatar(file)
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
        <h1 class="text-2xl font-semibold tracking-tight">My BITNP</h1>
        <p class="text-sm text-muted-foreground">Your account information.</p>
      </header>

      <div v-if="user" class="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div class="flex flex-wrap items-center gap-4">
          <div class="group relative">
            <img
              v-if="user.avatar"
              :src="user.avatar"
              :alt="`${user.userName}'s avatar`"
              class="h-14 w-14 rounded-full object-cover"
            >
            <div
              v-else
              class="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
            >
              {{ user.userName.charAt(0).toUpperCase() }}
            </div>
            <button
              type="button"
              class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
              :aria-label="`Change ${user.userName}'s avatar`"
              @click="openFilePicker"
            >
              <Camera class="h-5 w-5" :stroke-width="2" />
            </button>
          </div>
          <div class="flex flex-1 flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ user.userName }}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                #{{ user.id }}
              </span>
            </div>
          </div>
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
            <span class="text-xs text-muted-foreground">Phone</span>
            <span class="text-sm font-medium">{{ user.phone }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
            <span class="text-xs text-muted-foreground">Email</span>
            <span class="text-sm font-medium">{{ user.email ?? '—' }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
            <span class="text-xs text-muted-foreground">Department</span>
            <span class="text-sm font-medium">{{ user.department ?? 'null' }}</span>
          </div>
        </div>
      </div>

      <p v-else class="text-sm text-muted-foreground">Loading your information…</p>
    </main>

    <AvatarCropper
      v-if="cropSrc"
      :src="cropSrc"
      :loading="cropLoading"
      :error="cropError"
      @confirm="onCropConfirm"
      @cancel="closeCrop"
    />
  </div>
</template>
