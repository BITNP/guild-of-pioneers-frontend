<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { FolderKanban } from '@lucide/vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { fetchProjects, type Project } from '@/lib/api'

const projects = ref<Project[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    projects.value = await fetchProjects()
  } catch {
    error.value = 'Failed to load projects.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <AppSidebar />
    <main class="flex flex-1 flex-col gap-6 p-8">
      <header>
        <h1 class="text-2xl font-semibold tracking-tight">Projects</h1>
        <p class="text-sm text-muted-foreground">All projects, most recently updated first.</p>
      </header>

      <p v-if="loading" class="text-sm text-muted-foreground">Loading…</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
      <p v-else-if="projects.length === 0" class="text-sm text-muted-foreground">No projects yet.</p>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <article
          v-for="project in projects"
          :key="project.id"
          class="group overflow-hidden rounded-lg border bg-card text-card-foreground"
        >
          <div class="aspect-video w-full overflow-hidden bg-muted">
            <img
              v-if="project.cover"
              :src="project.cover"
              :alt="project.title"
              class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <div v-else class="flex h-full w-full items-center justify-center text-muted-foreground">
              <FolderKanban class="h-8 w-8" :stroke-width="1.5" />
            </div>
          </div>
          <div class="p-4">
            <h2 class="truncate text-sm font-medium">{{ project.title }}</h2>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>
