<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { ApiError, fetchProject, fetchTasks, type Project, type Task, type UserSummary } from '@/lib/api'
import { formatDate, timeAgo } from '@/lib/utils'

const AVATAR_SIZE = 32
const AVATAR_GAP = 8

const route = useRoute()

const project = ref<Project | null>(null)
const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const projectId = computed(() => Number(route.params.id))

async function load() {
  loading.value = true
  error.value = null
  try {
    const [projectData, taskData] = await Promise.all([
      fetchProject(projectId.value),
      fetchTasks(projectId.value),
    ])
    project.value = projectData
    tasks.value = taskData
  } catch (err) {
    project.value = null
    tasks.value = []
    error.value =
      err instanceof ApiError && err.status === 404
        ? 'Project not found.'
        : 'Failed to load project.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(projectId, load)

// Members row: leaders first, then members, deduplicated by user id.
const allMembers = computed<UserSummary[]>(() => {
  const current = project.value
  if (!current) return []
  const seen = new Set<number>()
  const result: UserSummary[] = []
  for (const user of [...current.leaders, ...current.members]) {
    if (!seen.has(user.id)) {
      seen.add(user.id)
      result.push(user)
    }
  }
  return result
})

// Measure the members row and reserve the last slot for "…" when members overflow.
const membersRow = ref<HTMLElement | null>(null)
const rowWidth = ref(0)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      rowWidth.value = entry.contentRect.width
    }
  })
  if (membersRow.value) resizeObserver.observe(membersRow.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

const visibleMembers = computed(() => {
  const members = allMembers.value
  if (rowWidth.value <= 0) return members
  const fit = Math.max(0, Math.floor((rowWidth.value + AVATAR_GAP) / (AVATAR_SIZE + AVATAR_GAP)))
  if (fit >= members.length) return members
  return members.slice(0, Math.max(fit - 1, 0))
})

const hiddenMemberCount = computed(() => allMembers.value.length - visibleMembers.value.length)
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <AppSidebar />
    <main class="flex flex-1 flex-col gap-6 p-8">
      <p v-if="loading" class="text-sm text-muted-foreground">Loading…</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

      <template v-else-if="project">
        <header>
          <RouterLink
            :to="{ name: 'project' }"
            class="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to projects
          </RouterLink>
        </header>

        <!-- Project info -->
        <section class="rounded-lg border bg-card p-6 text-card-foreground">
          <h1 class="text-xl font-semibold tracking-tight">{{ project.title }}</h1>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span class="text-xs font-medium text-muted-foreground">Leader</span>
            <span v-if="project.leaders.length === 0" class="text-sm text-muted-foreground">—</span>
            <span v-for="leader in project.leaders" :key="leader.id" class="inline-flex items-center gap-1.5">
              <UserAvatar :name="leader.userName" :avatar="leader.avatar" size-class="h-6 w-6 text-[10px]" />
              <span class="text-sm font-medium">{{ leader.userName }}</span>
            </span>
          </div>

          <p class="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
            {{ project.description ?? 'No description.' }}
          </p>

          <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="flex flex-col gap-1">
              <dt class="text-xs text-muted-foreground">Created</dt>
              <dd class="text-sm font-medium">{{ formatDate(project.createdDate) ?? '—' }}</dd>
            </div>
            <div v-if="project.endDate" class="flex flex-col gap-1">
              <dt class="text-xs text-muted-foreground">Ends</dt>
              <dd class="text-sm font-medium">{{ formatDate(project.endDate) ?? '—' }}</dd>
            </div>
            <div class="flex flex-col gap-1">
              <dt class="text-xs text-muted-foreground">Last updated</dt>
              <dd class="text-sm font-medium">
                {{ formatDate(project.updatedDate) ?? '—' }}
                <span class="text-xs font-normal text-muted-foreground">({{ timeAgo(project.updatedDate) }})</span>
              </dd>
            </div>
          </dl>
        </section>

        <!-- Members -->
        <section class="rounded-lg border bg-card p-4 text-card-foreground">
          <div
            ref="membersRow"
            class="flex h-8 items-center gap-2 overflow-hidden"
            :aria-label="allMembers.map((member) => member.userName).join(', ')"
          >
            <template v-if="allMembers.length === 0">
              <span class="text-sm text-muted-foreground">No members yet.</span>
            </template>
            <template v-else>
              <UserAvatar
                v-for="member in visibleMembers"
                :key="member.id"
                :name="member.userName"
                :avatar="member.avatar"
                size-class="h-8 w-8 text-xs"
              />
              <div
                v-if="hiddenMemberCount > 0"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground"
                :title="`${hiddenMemberCount} more`"
              >
                …
              </div>
            </template>
          </div>
        </section>

        <!-- Tasks -->
        <section class="flex flex-col gap-3">
          <h2 class="text-sm font-semibold tracking-tight text-muted-foreground">Tasks</h2>
          <p v-if="tasks.length === 0" class="text-sm text-muted-foreground">No tasks yet.</p>
          <article
            v-for="task in tasks"
            :key="task.id"
            class="rounded-lg border bg-card p-4 text-card-foreground"
          >
            <h3 class="truncate text-sm font-medium">{{ task.title }}</h3>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span v-if="task.leaders.length === 0">No leader</span>
              <span v-for="leader in task.leaders" :key="leader.id" class="inline-flex items-center gap-1.5">
                <UserAvatar :name="leader.userName" :avatar="leader.avatar" size-class="h-5 w-5 text-[10px]" />
                <span class="font-medium text-foreground/80">{{ leader.userName }}</span>
              </span>
              <span>updated {{ timeAgo(task.updatedDate) }}</span>
            </div>
          </article>
        </section>
      </template>
    </main>
  </div>
</template>
