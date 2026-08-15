<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ImagePlus, UserPlus, X } from '@lucide/vue'
import AppSidebar from '@/components/AppSidebar.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import UserPickerDialog from '@/components/UserPickerDialog.vue'
import { useAuth } from '@/composables/useAuth'
import { ApiError, createProject, fetchUsers, uploadProjectCover, type UserSummary } from '@/lib/api'

const router = useRouter()
const { user } = useAuth()

const isManager = computed(() => user.value?.isManager ?? false)

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024

const loading = ref(true)
const formError = ref<string | null>(null)
const saving = ref(false)

const title = ref('')
const description = ref('')

const coverInput = ref<HTMLInputElement | null>(null)
const coverFile = ref<File | null>(null)
const coverPreview = ref<string | null>(null)
const coverError = ref<string | null>(null)

const allUsers = ref<UserSummary[]>([])
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

let createdProjectId: number | null = null

onMounted(async () => {
  if (!isManager.value) {
    router.replace({ name: 'project' })
    return
  }
  if (creatorId.value !== undefined && !leaderIds.value.includes(creatorId.value)) {
    leaderIds.value.push(creatorId.value)
  }
  try {
    allUsers.value = await fetchUsers()
  } catch {
    formError.value = 'Failed to load users. Please try again.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
})

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

function openCoverPicker() {
  coverError.value = null
  coverInput.value?.click()
}

function onCoverChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  coverError.value = null
  if (!file) return

  if (!ALLOWED_TYPES.includes(file.type)) {
    coverError.value = 'Unsupported image type. Please choose a JPEG, PNG, WebP, or GIF file.'
    return
  }
  if (file.size > MAX_SIZE) {
    coverError.value = 'Image is too large. Maximum size is 5MB.'
    return
  }

  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverFile.value = file
  coverPreview.value = URL.createObjectURL(file)
}

function removeCover() {
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverFile.value = null
  coverPreview.value = null
  coverError.value = null
}

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 403) {
    return 'You do not have permission to create projects.'
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
    if (createdProjectId === null) {
      const created = await createProject({
        title: title.value.trim(),
        description: description.value.trim() || null,
        leaderIds: [...leaderIds.value],
        memberIds: [...memberIds.value],
      })
      createdProjectId = created.id
    }
    if (coverFile.value) {
      await uploadProjectCover(createdProjectId, coverFile.value)
    }
    router.push({ name: 'project-detail', params: { id: createdProjectId } })
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
            :to="{ name: 'project' }"
            class="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to projects
          </RouterLink>
          <h1 class="text-2xl font-semibold tracking-tight">New Project</h1>
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
              <span class="text-xs font-medium text-muted-foreground">Cover</span>
              <div class="relative aspect-video w-full max-w-md overflow-hidden rounded-md border border-border bg-muted">
                <img
                  v-if="coverPreview"
                  :src="coverPreview"
                  alt="Project cover preview"
                  class="h-full w-full object-cover"
                />
                <button
                  v-else
                  type="button"
                  class="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-accent/50"
                  @click="openCoverPicker"
                >
                  <ImagePlus class="h-8 w-8" :stroke-width="1.5" />
                  <span class="text-sm font-medium">Upload cover</span>
                </button>
              </div>
              <div v-if="coverPreview" class="flex gap-2">
                <button
                  type="button"
                  class="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  @click="openCoverPicker"
                >
                  Replace
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
                  @click="removeCover"
                >
                  Remove
                </button>
              </div>
              <p v-if="coverError" class="text-sm text-destructive" role="alert">{{ coverError }}</p>
              <input
                ref="coverInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="hidden"
                @change="onCoverChange"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="project-title" class="text-xs text-muted-foreground">Title</label>
              <input
                id="project-title"
                v-model="title"
                type="text"
                required
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Project title"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="project-description" class="text-xs text-muted-foreground">Description</label>
              <textarea
                id="project-description"
                v-model="description"
                rows="4"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="What is this project about?"
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
            {{ saving ? 'Creating…' : 'Create project' }}
          </button>
        </div>
      </form>
    </main>

    <UserPickerDialog
      v-if="pickerGroup"
      v-model="activeGroupIds"
      :title="pickerTitle"
      :users="allUsers"
      :exclude-ids="pickerExcludeIds"
      @close="closePicker"
    />
  </div>
</template>
