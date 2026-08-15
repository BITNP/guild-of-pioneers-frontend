<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UserPlus, X } from '@lucide/vue'
import AppSidebar from '@/components/AppSidebar.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import UserPickerDialog from '@/components/UserPickerDialog.vue'
import { useAuth } from '@/composables/useAuth'
import {
  ApiError,
  createTask,
  fetchProject,
  fetchTask,
  fetchUsers,
  updateTask,
  type Project,
  type Task,
  type UserSummary,
} from '@/lib/api'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const isEdit = computed(() => route.name === 'task-edit')
const projectId = computed(() => Number(route.params.id))
const taskId = computed(() => Number(route.params.taskId))

const loading = ref(true)
const formError = ref<string | null>(null)
const saving = ref(false)

const title = ref('')
const description = ref('')

const allUsers = ref<UserSummary[]>([])
const projectData = ref<Project | null>(null)
const leaderIds = ref<number[]>([])
const memberIds = ref<number[]>([])

const creatorId = computed(() => user.value?.id)
const isCreator = computed(() => (id: number) => id === creatorId.value)

const usersById = computed(() => new Map(allUsers.value.map((u) => [u.id, u])))
const leaderUsers = computed(() => leaderIds.value
  .map((id) => usersById.value.get(id))
  .filter((u): u is UserSummary => !!u))
const memberUsers = computed(() => memberIds.value
  .map((id) => usersById.value.get(id))
  .filter((u): u is UserSummary => !!u))

const pickerGroup = ref<'leader' | 'member' | null>(null)
const pickerTitle = computed(() => (pickerGroup.value === 'leader' ? 'Add leaders' : 'Add members'))
const activeGroupIds = computed<number[]>({
  get: () => (pickerGroup.value === 'leader' ? leaderIds.value : memberIds.value),
  set: (value) => {
    if (pickerGroup.value === 'leader') {
      leaderIds.value = value
    } else if (pickerGroup.value === 'member') {
      memberIds.value = value
    }
  },
})
const pickerExcludeIds = computed(() => (pickerGroup.value === 'leader' ? memberIds.value : leaderIds.value))

const projectUsers = computed<UserSummary[]>(() => {
  const project = projectData.value
  if (!project) return []
  return [...project.leaders, ...project.members]
})

const pageTitle = computed(() => (isEdit.value ? 'Edit Task' : 'New Task'))
const backTarget = computed(() => ({ name: 'project-detail', params: { id: projectId.value } }))
const backLabel = computed(() => 'Back to project')
const submitLabel = computed(() =>
  isEdit.value ? (saving.value ? 'Saving…' : 'Save changes') : saving.value ? 'Creating…' : 'Create task',
)

onMounted(async () => {
  if (isEdit.value) {
    try {
      const [taskData, users, project] = await Promise.all([
        fetchTask(taskId.value),
        fetchUsers(),
        fetchProject(projectId.value),
      ])
      if (!canEditTask(taskData)) {
        router.replace({ name: 'project-detail', params: { id: projectId.value } })
        return
      }
      title.value = taskData.title
      description.value = taskData.description ?? ''
      leaderIds.value = [...taskData.leaderIds]
      memberIds.value = [...taskData.memberIds]
      allUsers.value = users
      projectData.value = project
    } catch {
      router.replace({ name: 'project-detail', params: { id: projectId.value } })
      return
    } finally {
      loading.value = false
    }
    return
  }

  try {
    const [project, users] = await Promise.all([
      fetchProject(projectId.value),
      fetchUsers(),
    ])
    if (!canCreateTask(project)) {
      router.replace({ name: 'project-detail', params: { id: projectId.value } })
      return
    }
    if (creatorId.value !== undefined && !leaderIds.value.includes(creatorId.value)) {
      leaderIds.value.push(creatorId.value)
    }
    allUsers.value = users
    projectData.value = project
  } catch {
    router.replace({ name: 'project-detail', params: { id: projectId.value } })
    return
  } finally {
    loading.value = false
  }
})

function canCreateTask(projectData: Project): boolean {
  const currentUser = user.value
  if (!currentUser) return false
  const isAdmin = currentUser.departments.some((d) => d.department === 'ADMIN')
  return isAdmin
    || projectData.leaderIds.includes(currentUser.id)
    || projectData.memberIds.includes(currentUser.id)
}

function canEditTask(taskData: Task): boolean {
  const currentUser = user.value
  if (!currentUser) return false
  const isAdmin = currentUser.departments.some((d) => d.department === 'ADMIN')
  return isAdmin || taskData.leaderIds.includes(currentUser.id)
}

function openPicker(group: 'leader' | 'member') {
  formError.value = null
  pickerGroup.value = group
}

function closePicker() {
  pickerGroup.value = null
}

function removeUser(group: 'leader' | 'member', id: number) {
  const target = group === 'leader' ? leaderIds.value : memberIds.value
  const index = target.indexOf(id)
  if (index !== -1) {
    target.splice(index, 1)
  }
}

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 403) {
    return isEdit.value
      ? 'You do not have permission to edit this task.'
      : 'You do not have permission to create tasks.'
  }
  if (err instanceof ApiError && err.status === 400) {
    return err.message
  }
  if (err instanceof ApiError && err.status >= 500) {
    return 'Something went wrong on our end. Please try again later.'
  }
  if (err instanceof Error) {
    return err.message
  }
  return fallback
}

async function onSubmit() {
  formError.value = null
  if (!title.value.trim()) {
    formError.value = 'Title is required.'
    return
  }

  saving.value = true
  try {
    if (isEdit.value) {
      const id = taskId.value
      await updateTask(id, {
        title: title.value.trim(),
        description: description.value.trim() || null,
        leaderIds: [...leaderIds.value],
        memberIds: [...memberIds.value],
      })
      router.push({ name: 'project-detail', params: { id: projectId.value } })
      return
    }
    await createTask({
      projectId: projectId.value,
      title: title.value.trim(),
      description: description.value.trim() || null,
      leaderIds: [...leaderIds.value],
      memberIds: [...memberIds.value],
    })
    router.push({ name: 'project-detail', params: { id: projectId.value } })
  } catch (err) {
    formError.value = messageFor(err, 'Something went wrong. Please try again.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <AppSidebar />
    <main class="flex flex-1 flex-col gap-6 p-8">
      <header class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <RouterLink
            :to="backTarget"
            class="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {{ backLabel }}
          </RouterLink>
          <h1 class="text-2xl font-semibold tracking-tight">{{ pageTitle }}</h1>
        </div>
      </header>

      <p v-if="loading" class="text-sm text-muted-foreground">Loading…</p>

      <form
        v-else
        class="flex flex-col gap-6"
        @submit.prevent="onSubmit"
      >
        <section class="rounded-lg border bg-card p-6 text-card-foreground">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <label for="task-title" class="text-xs text-muted-foreground">Title</label>
              <input
                id="task-title"
                v-model="title"
                type="text"
                required
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Task title"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="task-description" class="text-xs text-muted-foreground">Description</label>
              <textarea
                id="task-description"
                v-model="description"
                rows="4"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="What does this task involve?"
              ></textarea>
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4 text-card-foreground">
            <span class="text-sm font-semibold tracking-tight text-muted-foreground">Leader</span>
            <span v-if="leaderUsers.length === 0" class="text-sm text-muted-foreground">—</span>
            <span
              v-for="leader in leaderUsers"
              :key="leader.id"
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted py-0.5 pl-0.5 pr-1 text-sm"
            >
              <UserAvatar
                :name="leader.userName"
                :avatar="leader.avatar"
                size-class="h-6 w-6 text-[10px]"
              />
              <span class="font-medium">{{ leader.userName }}</span>
              <span
                v-if="isCreator(leader.id)"
                class="rounded-full border border-border bg-background px-1.5 text-[10px] font-semibold text-muted-foreground"
              >
                You
              </span>
              <button
                type="button"
                class="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                :aria-label="`Remove ${leader.userName} from leaders`"
                @click="removeUser('leader', leader.id)"
              >
                <X class="h-3 w-3" :stroke-width="2" />
              </button>
            </span>
            <button
              type="button"
              class="ml-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              @click="openPicker('leader')"
            >
              <UserPlus class="h-3.5 w-3.5" :stroke-width="2" />
              Add
            </button>
          </div>
        </section>

        <section class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4 text-card-foreground">
            <span class="text-sm font-semibold tracking-tight text-muted-foreground">Member</span>
            <span v-if="memberUsers.length === 0" class="text-sm text-muted-foreground">—</span>
            <span
              v-for="member in memberUsers"
              :key="member.id"
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted py-0.5 pl-0.5 pr-1 text-sm"
            >
              <UserAvatar
                :name="member.userName"
                :avatar="member.avatar"
                size-class="h-6 w-6 text-[10px]"
              />
              <span class="font-medium">{{ member.userName }}</span>
              <button
                type="button"
                class="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                :aria-label="`Remove ${member.userName} from members`"
                @click="removeUser('member', member.id)"
              >
                <X class="h-3 w-3" :stroke-width="2" />
              </button>
            </span>
            <button
              type="button"
              class="ml-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              @click="openPicker('member')"
            >
              <UserPlus class="h-3.5 w-3.5" :stroke-width="2" />
              Add
            </button>
          </div>
        </section>

        <p v-if="formError" class="text-sm text-destructive" role="alert">{{ formError }}</p>

        <div class="flex justify-end">
          <button
            type="submit"
            class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            :disabled="saving"
          >
            {{ submitLabel }}
          </button>
        </div>
      </form>
    </main>

    <UserPickerDialog
      v-if="pickerGroup"
      v-model="activeGroupIds"
      :title="pickerTitle"
      :users="projectUsers"
      :exclude-ids="pickerExcludeIds"
      @close="closePicker"
    />
  </div>
</template>
