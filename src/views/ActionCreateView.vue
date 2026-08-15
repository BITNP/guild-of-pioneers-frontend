<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircle2, RotateCcw, UserPlus, X } from '@lucide/vue'
import AppSidebar from '@/components/AppSidebar.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import UserPickerDialog from '@/components/UserPickerDialog.vue'
import { useAuth } from '@/composables/useAuth'
import {
  ApiError,
  createAction,
  fetchAction,
  fetchProject,
  fetchTask,
  fetchUsers,
  finishAction,
  unfinishAction,
  updateAction,
  type Action,
  type Project,
  type Task,
  type UserSummary,
} from '@/lib/api'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const isEdit = computed(() => route.name === 'action-edit')
const projectId = computed(() => Number(route.params.id))
const taskId = computed(() => Number(route.params.taskId))
const actionId = computed(() => Number(route.params.actionId))

const loading = ref(true)
const formError = ref<string | null>(null)
const saving = ref(false)

const title = ref('')
const description = ref('')

const project = ref<Project | null>(null)
const allUsers = ref<UserSummary[]>([])
const memberIds = ref<number[]>([])
const isFinished = ref(false)

const creatorId = computed(() => user.value?.id)
const isCreator = computed(() => (id: number) => id === creatorId.value)
const isAdmin = computed(() => user.value?.departments.some((d) => d.department === 'ADMIN') ?? false)

const usersById = computed(() => new Map(allUsers.value.map((u) => [u.id, u])))
const memberUsers = computed(() => memberIds.value
  .map((id) => usersById.value.get(id))
  .filter((u): u is UserSummary => !!u))

// Project members (leaders first, then members, deduplicated) are the only
// users who may be assigned to an action.
const projectMembers = computed<UserSummary[]>(() => {
  const current = project.value
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

const pickerUsers = computed<UserSummary[]>(() => {
  const base = projectMembers.value
  const seen = new Set(base.map((u) => u.id))
  const result = [...base]
  for (const id of memberIds.value) {
    const u = usersById.value.get(id)
    if (u && !seen.has(id)) {
      seen.add(id)
      result.push(u)
    }
  }
  return result
})

const pickerOpen = ref(false)
const pickerExcludeIds = computed<number[]>(() => [])

const pageTitle = computed(() => (isEdit.value ? 'Edit Action' : 'New Action'))
const backTarget = computed(() => ({ name: 'task-detail', params: { id: projectId.value, taskId: taskId.value } }))
const backLabel = computed(() => 'Back to task')
const submitLabel = computed(() =>
  isEdit.value ? (saving.value ? 'Saving…' : 'Save changes') : saving.value ? 'Creating…' : 'Create action',
)

onMounted(async () => {
  if (isEdit.value) {
    try {
      const [actionData, projectData, users] = await Promise.all([
        fetchAction(actionId.value),
        fetchProject(projectId.value),
        fetchUsers(),
      ])
      if (!canEditAction(actionData)) {
        router.replace(backTarget.value)
        return
      }
      title.value = actionData.title
      description.value = actionData.description ?? ''
      memberIds.value = [...actionData.memberIds]
      isFinished.value = actionData.endDate != null
      project.value = projectData
      allUsers.value = users
    } catch {
      router.replace(backTarget.value)
      return
    } finally {
      loading.value = false
    }
    return
  }

  try {
    const [taskData, projectData, users] = await Promise.all([
      fetchTask(taskId.value),
      fetchProject(projectId.value),
      fetchUsers(),
    ])
    if (!canCreateAction(taskData)) {
      router.replace(backTarget.value)
      return
    }
    project.value = projectData
    allUsers.value = users
    if (creatorId.value !== undefined
      && !memberIds.value.includes(creatorId.value)
      && projectMembers.value.some((m) => m.id === creatorId.value)) {
      memberIds.value.push(creatorId.value)
    }
  } catch {
    router.replace(backTarget.value)
    return
  } finally {
    loading.value = false
  }
})

function canCreateAction(taskData: Task): boolean {
  const currentUser = user.value
  if (!currentUser) return false
  return isAdmin.value
    || taskData.leaderIds.includes(currentUser.id)
    || taskData.memberIds.includes(currentUser.id)
}

function canEditAction(actionData: Action): boolean {
  const currentUser = user.value
  if (!currentUser) return false
  return isAdmin.value || actionData.memberIds.includes(currentUser.id)
}

function removeUser(id: number) {
  const index = memberIds.value.indexOf(id)
  if (index !== -1) {
    memberIds.value.splice(index, 1)
  }
}

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 403) {
    return isEdit.value
      ? 'You do not have permission to edit this action.'
      : 'You do not have permission to create actions.'
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
      await updateAction(actionId.value, {
        title: title.value.trim(),
        description: description.value.trim() || null,
        memberIds: [...memberIds.value],
      })
    } else {
      await createAction({
        taskId: taskId.value,
        title: title.value.trim(),
        description: description.value.trim() || null,
        memberIds: [...memberIds.value],
      })
    }
    router.push(backTarget.value)
  } catch (err) {
    formError.value = messageFor(err, 'Something went wrong. Please try again.')
  } finally {
    saving.value = false
  }
}

async function onFinishToggle() {
  formError.value = null
  saving.value = true
  try {
    if (isFinished.value) {
      await unfinishAction(actionId.value)
    } else {
      await finishAction(actionId.value)
    }
    router.push(backTarget.value)
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
              <label for="action-title" class="text-xs text-muted-foreground">Title</label>
              <input
                id="action-title"
                v-model="title"
                type="text"
                required
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Action title"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="action-description" class="text-xs text-muted-foreground">Description</label>
              <textarea
                id="action-description"
                v-model="description"
                rows="4"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="What does this action involve?"
              ></textarea>
            </div>
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
              <span
                v-if="isCreator(member.id)"
                class="rounded-full border border-border bg-background px-1.5 text-[10px] font-semibold text-muted-foreground"
              >
                You
              </span>
              <button
                type="button"
                class="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                :aria-label="`Remove ${member.userName} from members`"
                @click="removeUser(member.id)"
              >
                <X class="h-3 w-3" :stroke-width="2" />
              </button>
            </span>
            <button
              type="button"
              class="ml-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              @click="pickerOpen = true"
            >
              <UserPlus class="h-3.5 w-3.5" :stroke-width="2" />
              Add
            </button>
          </div>
        </section>

        <p v-if="formError" class="text-sm text-destructive" role="alert">{{ formError }}</p>

        <div class="flex items-center justify-end gap-3">
          <button
            v-if="isEdit"
            type="button"
            :class="isFinished
              ? 'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground'
              : 'inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50'"
            :disabled="saving"
            @click="onFinishToggle"
          >
            <CheckCircle2 v-if="!isFinished" class="h-4 w-4" :stroke-width="2" />
            <RotateCcw v-else class="h-4 w-4" :stroke-width="2" />
            {{ isFinished ? 'Reopen' : 'Finish' }}
          </button>
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
      v-if="pickerOpen"
      v-model="memberIds"
      title="Add members"
      :users="pickerUsers"
      :exclude-ids="pickerExcludeIds"
      @close="pickerOpen = false"
    />
  </div>
</template>
