<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const { login } = useAuth()
const errorMessage = computed(() => {
  if (route.query.error === 'provider_unavailable' || route.query.error === 'unavailable') {
    return 'Sign-in is temporarily unavailable. Please try again.'
  }
  if (route.query.error) return 'Sign-in was cancelled or could not be completed. Please try again.'
  return ''
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-6">
    <div class="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
      <div class="mb-6 flex flex-col items-center gap-3 text-center">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">G</div>
        <h1 class="text-xl font-semibold tracking-tight">Guild of Pioneers</h1>
        <p class="text-sm text-muted-foreground">Sign in with your BITNP account.</p>
      </div>
      <p v-if="errorMessage" class="mb-4 text-sm text-destructive" role="alert">{{ errorMessage }}</p>
      <button
        type="button"
        class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm"
        @click="login(typeof route.query.redirect === 'string' ? route.query.redirect : '/')"
      >
        Sign in with BITNP
      </button>
      <p class="mt-4 text-sm text-muted-foreground">
        New members can complete their profile and enter an invitation code after signing in.
        If you already have a site account, contact a maintainer to link it.
      </p>
    </div>
  </div>
</template>
