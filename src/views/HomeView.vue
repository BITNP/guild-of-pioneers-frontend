<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue'
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <AppSidebar />
    <main class="flex flex-1 flex-col gap-6 p-8">
      <header>
        <h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p class="text-sm text-muted-foreground">Your home page will live here.</p>
      </header>
    </main>
  </div>
</template>
