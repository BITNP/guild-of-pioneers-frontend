<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue'
import MindMap from '@/components/MindMap.vue'
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <AppSidebar />
    <main class="flex min-w-0 flex-1 flex-col gap-6 overflow-hidden p-8">
      <header class="shrink-0">
        <h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p class="text-sm text-muted-foreground">Browse the guild's projects, tasks, and actions below.</p>
      </header>

      <section class="flex min-h-0 flex-1 flex-col gap-3">
        <h2 class="shrink-0 text-sm font-semibold tracking-tight text-muted-foreground">Mind map</h2>
        <MindMap />
      </section>
    </main>
  </div>
</template>
