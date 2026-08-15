<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Pencil } from '@lucide/vue'
import AppSidebar from '@/components/AppSidebar.vue'
import UserBadge from '@/components/UserBadge.vue'
import { useAuth } from '@/composables/useAuth'
import { ApiError, fetchActions, fetchTask, type Action, type Task, type UserSummary } from '@/lib/api'
import { formatDate, timeAgo } from '@/lib/utils'

const route = useRoute()
const { user } = useAuth()

const task = ref<Task | null>(null)
const actions = ref<Action[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const isAdmin = computed(() => {
  return user.value?.departments.some((d) => d.department === 'ADMIN') ?? false
})

const canEdit = computed(() => {
  if (!user.value || !task.value) return false
  return isAdmin.value || task.value.leaderIds.includes(user.value.id)
})

const projectId = computed(() => Number(route.params.id))
const taskId = computed(() => Number(route.params.taskId))

async function load() {
  loading.value = true
  error.value = null
  try {
    const [taskData, actionData] = await Promise.all([
      fetchTask(taskId.value),
      fetchActions(taskId.value),
    ])
    task.value = taskData
    actions.value = actionData
  } catch (err) {
    task.value = null
    actions.value = []
    error.value =
      err instanceof ApiError && err.status === 404
        ? 'Task not found.'
        : 'Failed to load task.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Finished actions (those with an end date) sink to the bottom; each group is
// ordered by last update time, newest first.
const sortedActions = computed(() =>
  [...actions.value].sort((a, b) => {
    const aDone = a.endDate != null ? 1 : 0
    const bDone = b.endDate != null ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    return new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime()
  }),
)

// Members row: leaders first, then members, deduplicated by user id.
const allMembers = computed<UserSummary[]>(() => {
  const current = task.value
  if (!current) return []
  const seen = new Set<number>()
  const result: UserSummary[] = []
  for (const member of [...current.leaders, ...current.members]) {
    if (!seen.has(member.id)) {
      seen.add(member.id)
      result.push(member)
    }
  }
  return result
})
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <AppSidebar />
    <main class="flex flex-1 flex-col gap-6 p-8">
      <p v-if="loading" class="text-sm text-muted-foreground">Loading…</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

      <template v-else-if="task">
        <header>
          <RouterLink
            :to="{ name: 'project-detail', params: { id: projectId } }"
            class="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to project
          </RouterLink>
        </header>

        <!-- Task info -->
        <section class="rounded-lg border bg-card p-6 text-card-foreground">
          <div class="flex items-start justify-between gap-4">
            <h1 class="text-xl font-semibold tracking-tight">{{ task.title }}</h1>
            <RouterLink
              v-if="canEdit"
              :to="{ name: 'task-edit', params: { id: projectId, taskId: task.id } }"
              class="ml-auto inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Pencil class="h-4 w-4" :stroke-width="2" />
              Edit
            </RouterLink>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span class="text-xs font-medium text-muted-foreground">Leader</span>
            <span v-if="task.leaders.length === 0" class="text-sm text-muted-foreground">—</span>
            <UserBadge
              v-for="leader in task.leaders"
              :key="leader.id"
              :user="leader"
              avatar-size-class="h-6 w-6 text-[10px]"
            />
          </div>

          <p class="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
            {{ task.description ?? 'No description.' }}
          </p>

          <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="flex flex-col gap-1">
              <dt class="text-xs text-muted-foreground">Created</dt>
              <dd class="text-sm font-medium">{{ formatDate(task.createdDate) ?? '—' }}</dd>
            </div>
            <div v-if="task.endDate" class="flex flex-col gap-1">
              <dt class="text-xs text-muted-foreground">Ends</dt>
              <dd class="text-sm font-medium">{{ formatDate(task.endDate) ?? '—' }}</dd>
            </div>
            <div class="flex flex-col gap-1">
              <dt class="text-xs text-muted-foreground">Last updated</dt>
              <dd class="text-sm font-medium">
                {{ formatDate(task.updatedDate) ?? '—' }}
                <span class="text-xs font-normal text-muted-foreground">({{ timeAgo(task.updatedDate) }})</span>
              </dd>
            </div>
          </dl>
        </section>

        <!-- Members -->
        <section class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-tight text-muted-foreground">Member</span>
          <div class="rounded-lg border bg-card p-4 text-card-foreground">
            <template v-if="allMembers.length === 0">
              <span class="text-sm text-muted-foreground">No members yet.</span>
            </template>
            <div v-else class="flex flex-wrap items-center gap-2">
              <UserBadge
                v-for="member in allMembers"
                :key="member.id"
                :user="member"
                avatar-size-class="h-8 w-8 text-xs"
              />
            </div>
          </div>
        </section>

        <!-- Actions -->
        <section class="flex flex-col gap-3">
          <h2 class="text-sm font-semibold tracking-tight text-muted-foreground">Actions</h2>
          <p v-if="actions.length === 0" class="text-sm text-muted-foreground">No actions yet.</p>
          <article
            v-for="action in sortedActions"
            :key="action.id"
            class="rounded-lg border bg-card p-4 text-card-foreground"
          >
            <h3
              class="truncate text-sm font-medium"
              :class="{ 'text-muted-foreground line-through': action.endDate != null }"
            >
              {{ action.title }}
            </h3>
            <p v-if="action.description" class="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {{ action.description }}
            </p>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span v-if="action.memberIds.length === 0">No members</span>
              <span v-else>{{ action.memberIds.length }} member{{ action.memberIds.length > 1 ? 's' : '' }}</span>
              <span>updated {{ timeAgo(action.updatedDate) }}</span>
            </div>
          </article>
        </section>
      </template>
    </main>
  </div>
</template>
