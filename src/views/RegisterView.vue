<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Camera } from '@lucide/vue'
import AvatarCropper from '@/components/AvatarCropper.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAuth } from '@/composables/useAuth'
import { ApiError, validateTicket, type TicketValidation } from '@/lib/api'

const router = useRouter()
const { register, uploadAvatar } = useAuth()

const ticketCode = ref('')
const validating = ref(false)
const validateError = ref<string | null>(null)
const ticket = ref<TicketValidation | null>(null)

const form = reactive({
  userName: '',
  phone: '',
  email: '',
  password: '',
})

const submitting = ref(false)
const errorMessage = ref<string | null>(null)

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024

const fileInput = ref<HTMLInputElement | null>(null)
const cropSrc = ref<string | null>(null)
const cropFile = ref<File | null>(null)
const cropLoading = ref(false)
const cropError = ref<string | null>(null)
const fileError = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)

watch(ticketCode, () => {
  if (ticket.value || validateError.value) {
    ticket.value = null
    validateError.value = null
  }
})

async function onValidate() {
  validateError.value = null
  ticket.value = null
  const code = ticketCode.value.trim()
  if (!code) {
    validateError.value = 'Please enter your registration ticket code.'
    return
  }

  validating.value = true
  try {
    const result = await validateTicket(code)
    if (result.expired) {
      validateError.value = 'This ticket has expired.'
      return
    }
    ticket.value = result
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      validateError.value = 'Invalid ticket code.'
    } else if (error instanceof ApiError && error.status >= 500) {
      validateError.value = 'Something went wrong on our end. Please try again later.'
    } else if (error instanceof Error) {
      validateError.value = error.message
    } else {
      validateError.value = 'Something went wrong. Please try again.'
    }
  } finally {
    validating.value = false
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

function onCropConfirm(file: File) {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
  closeCrop()
}

async function onSubmit() {
  errorMessage.value = null

  if (!form.userName.trim()) {
    errorMessage.value = 'Please enter your username.'
    return
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    errorMessage.value = 'Please enter a valid phone number.'
    return
  }
  if (form.password.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.'
    return
  }
  const email = form.email.trim()
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errorMessage.value = 'Please enter a valid email address.'
    return
  }

  submitting.value = true
  try {
    await register({
      phone: form.phone,
      password: form.password,
      userName: form.userName.trim(),
      ticketCode: ticketCode.value.trim(),
      email: email || null,
    })
    if (avatarFile.value) {
      try {
        await uploadAvatar(avatarFile.value)
      } catch {
        // avatar is optional; registration has already succeeded
      }
    }
    router.replace('/')
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      errorMessage.value = 'Phone is already registered.'
    } else if (error instanceof ApiError && error.status === 400) {
      errorMessage.value = error.message
    } else if (error instanceof ApiError && error.status >= 500) {
      errorMessage.value = 'Something went wrong on our end. Please try again later.'
    } else if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = 'Something went wrong. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-6">
    <div class="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-sm">
      <div class="mb-6 flex flex-col items-center gap-3 text-center">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          G
        </div>
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Guild of Pioneers</h1>
          <p class="text-sm text-muted-foreground">Create your account</p>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="ticket-code" class="text-sm font-medium">Registration ticket code</label>
          <textarea
            id="ticket-code"
            v-model="ticketCode"
            rows="3"
            class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            placeholder="Paste your invitation code"
            :disabled="validating"
          />
        </div>

        <button
          type="button"
          class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          :disabled="validating"
          @click="onValidate"
        >
          {{ validating ? 'Validating…' : 'Validate' }}
        </button>

        <p
          v-if="validateError"
          class="text-sm text-destructive"
          role="alert"
        >
          {{ validateError }}
        </p>
      </div>

      <template v-if="ticket">
        <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
            <span class="text-xs text-muted-foreground">Department</span>
            <span class="text-sm font-medium">{{ ticket.department }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
            <span class="text-xs text-muted-foreground">Role</span>
            <span class="text-sm font-medium">{{ ticket.role }}</span>
          </div>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">
          You are invited as a {{ ticket.role.toLowerCase() }} in the {{ ticket.department.toLowerCase() }}
          department. This code is valid until {{ new Date(ticket.expiresAt).toLocaleString() }}.
        </p>

        <form
          class="mt-6 flex flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-sm"
          novalidate
          @submit.prevent="onSubmit"
        >
          <div class="flex items-center gap-4">
            <div class="group relative">
              <UserAvatar
                :name="form.userName || 'New member'"
                :avatar="avatarPreview"
                size-class="h-14 w-14 text-lg font-bold"
              />
              <button
                type="button"
                class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                aria-label="Upload avatar"
                @click="openFilePicker"
              >
                <Camera class="h-5 w-5" :stroke-width="2" />
              </button>
            </div>
            <div class="flex flex-1 flex-col gap-1">
              <h2 class="text-lg font-semibold">Your profile</h2>
              <p class="text-sm text-muted-foreground">Avatar is optional.</p>
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
              <label for="register-username" class="text-xs text-muted-foreground">Username</label>
              <input
                id="register-username"
                v-model="form.userName"
                type="text"
                class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                placeholder="Your username"
                :disabled="submitting"
              >
            </div>
            <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
              <label for="register-phone" class="text-xs text-muted-foreground">Phone</label>
              <input
                id="register-phone"
                v-model="form.phone"
                type="tel"
                class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                placeholder="Your phone number"
                :disabled="submitting"
              >
            </div>
            <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
              <label for="register-email" class="text-xs text-muted-foreground">Email <span class="font-normal">(optional)</span></label>
              <input
                id="register-email"
                v-model="form.email"
                type="email"
                class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                placeholder="you@example.com"
                :disabled="submitting"
              >
            </div>
            <div class="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
              <label for="register-password" class="text-xs text-muted-foreground">Password</label>
              <input
                id="register-password"
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                placeholder="At least 8 characters"
                :disabled="submitting"
              >
            </div>
          </div>

          <p
            v-if="errorMessage"
            class="text-sm text-destructive"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <div class="flex justify-end">
            <button
              type="submit"
              class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              :disabled="submitting"
            >
              {{ submitting ? 'Creating…' : 'Confirm' }}
            </button>
          </div>
        </form>
      </template>
    </div>

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
