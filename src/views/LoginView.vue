<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/api'

const router = useRouter()
const route = useRoute()
const { login } = useAuth()

const phone = ref('')
const password = ref('')
const rememberMe = ref(false)
const errorMessage = ref('')
const submitting = ref(false)

async function onSubmit() {
  errorMessage.value = ''
  if (!phone.value || !password.value) {
    errorMessage.value = 'Please enter your phone and password.'
    return
  }

  submitting.value = true
  try {
    await login(phone.value, password.value, rememberMe.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError && error.status === 401
        ? 'Invalid phone or password.'
        : error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-6">
    <div class="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
      <div class="mb-6 flex flex-col items-center gap-3 text-center">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          G
        </div>
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Guild of Pioneers</h1>
          <p class="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
      </div>

      <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
        <div class="flex flex-col gap-2">
          <label for="phone" class="text-sm font-medium">Phone</label>
          <input
            id="phone"
            v-model="phone"
            type="text"
            inputmode="numeric"
            autocomplete="username"
            class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            placeholder="Your phone number"
            :disabled="submitting"
          >
        </div>

        <div class="flex flex-col gap-2">
          <label for="password" class="text-sm font-medium">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            placeholder="Your password"
            :disabled="submitting"
          >
        </div>

        <label class="flex items-center gap-2 text-sm" for="remember-me">
          <input
            id="remember-me"
            v-model="rememberMe"
            type="checkbox"
            class="h-4 w-4 rounded border-input text-primary accent-primary disabled:opacity-50"
            :disabled="submitting"
          >
          <span class="text-muted-foreground">Remember me</span>
        </label>

        <p
          v-if="errorMessage"
          class="text-sm text-destructive"
          role="alert"
        >
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          :disabled="submitting"
        >
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>
