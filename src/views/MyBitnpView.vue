<script setup lang="ts">
import { onMounted } from 'vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { useAuth } from '@/composables/useAuth'

const { user, refresh } = useAuth()

onMounted(async () => {
  if (user.value === null) {
    await refresh()
  }
})
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
          <div class="flex flex-1 flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ user.userName }}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                #{{ user.id }}
              </span>
            </div>
          </div>
        </div>

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
  </div>
</template>
