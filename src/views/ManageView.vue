<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CalendarClock, Check, Copy, UserPlus } from '@lucide/vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { useAuth } from '@/composables/useAuth'
import { ApiError, createRegistrationTicket, type Department, type DepartmentRole, type RegistrationTicket } from '@/lib/api'

const { user } = useAuth()

const isAdmin = computed(() => user.value?.departments.some((d) => d.department === 'ADMIN') ?? false)
const isPresidium = computed(() => user.value?.departments.some((d) => d.department === 'PRESIDIUM') ?? false)
const canManageRegister = computed(() => isAdmin.value || isPresidium.value)

const DEPARTMENTS: Department[] = ['CLINIC', 'TECH', 'SUPPORT', 'MEDIA', 'PRESIDIUM']
const ROLES: DepartmentRole[] = ['LEADER', 'VICE', 'ADVISOR', 'MEMBER']
const PRESETS = [
  { label: '5 mins', minutes: 5 },
  { label: '30 mins', minutes: 30 },
  { label: '1 day', minutes: 24 * 60 },
]

const department = ref<Department | undefined>(undefined)
const role = ref<DepartmentRole>('MEMBER')
const expireDate = ref('')
const presetExpiresAt = ref<string | null>(null)
const activePreset = ref<number | null>(null)
const copied = ref(false)

const saving = ref(false)
const formError = ref<string | null>(null)
const ticket = ref<RegistrationTicket | null>(null)

const today = (() => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
})()

watch(expireDate, (value) => {
  if (value) {
    presetExpiresAt.value = null
    activePreset.value = null
  }
})

function applyPreset(minutes: number) {
  activePreset.value = minutes
  presetExpiresAt.value = new Date(Date.now() + minutes * 60_000).toISOString()
  expireDate.value = ''
}

async function copyCode() {
  const code = ticket.value?.code
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    copied.value = false
  }
}

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 403) {
    return 'You do not have permission to create registration tickets.'
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

async function onCreateTicket() {
  formError.value = null
  ticket.value = null
  copied.value = false
  const missing = [
    !department.value ? 'department' : null,
    !role.value ? 'role' : null,
    !presetExpiresAt.value && !expireDate.value ? 'expire date' : null,
  ].filter(Boolean)
  if (missing.length > 0) {
    formError.value = `Please select ${missing.join(', ')}.`
    return
  }

  saving.value = true
  try {
    const expiresAt = presetExpiresAt.value ?? new Date(`${expireDate.value}T23:59:59`).toISOString()
    ticket.value = await createRegistrationTicket({
      expiresAt,
      department: department.value as Department,
      role: role.value,
    })
    department.value = undefined
    role.value = 'MEMBER'
    expireDate.value = ''
    presetExpiresAt.value = null
    activePreset.value = null
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
      <header>
        <h1 class="text-2xl font-semibold tracking-tight">Manage</h1>
        <p class="text-sm text-muted-foreground">Management tools for the guild.</p>
      </header>

      <section
        class="rounded-lg border bg-card p-6 text-card-foreground"
        :class="!canManageRegister ? 'pointer-events-none select-none opacity-60' : ''"
      >
        <div class="flex items-center gap-2">
          <UserPlus class="h-5 w-5" :stroke-width="1.5" />
          <h2 class="text-base font-semibold tracking-tight">Register new user</h2>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          Create a registration ticket. Share the code with the new user so they can sign up.
        </p>

        <p v-if="!canManageRegister" class="mt-2 text-xs text-muted-foreground">
          Only admins and presidium members can register new users.
        </p>

        <div class="mt-4 flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label for="ticket-department" class="text-sm font-medium">Department</label>
            <select
              id="ticket-department"
              v-model="department"
              required
              class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
            >
              <option disabled value="">Select department</option>
              <option v-for="dept in DEPARTMENTS" :key="dept" :value="dept">{{ dept }}</option>
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <label for="ticket-role" class="text-sm font-medium">Role</label>
            <select
              id="ticket-role"
              v-model="role"
              required
              class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
            >
              <option disabled value="">Select role</option>
              <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <label for="ticket-expire-date" class="flex items-center gap-2 text-sm font-medium">
              <CalendarClock class="h-4 w-4" :stroke-width="2" />
              Expire date
            </label>
            <div class="flex gap-2">
              <button
                v-for="preset in PRESETS"
                :key="preset.minutes"
                type="button"
                class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                :class="activePreset === preset.minutes
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-input bg-background text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'"
                @click="applyPreset(preset.minutes)"
              >
                {{ preset.label }}
              </button>
            </div>
            <input
              id="ticket-expire-date"
              v-model="expireDate"
              type="date"
              :min="today"
              required
              class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
            >
          </div>

          <p v-if="formError" class="text-sm text-destructive" role="alert">{{ formError }}</p>

          <div class="flex justify-end">
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              :disabled="saving"
              @click="onCreateTicket"
            >
              {{ saving ? 'Creating…' : 'Confirm' }}
            </button>
          </div>
        </div>

        <div v-if="ticket" class="mt-4 rounded-md border border-border bg-muted p-4">
          <p class="text-xs text-muted-foreground">Registration ticket code</p>
          <div class="mt-1 flex items-center gap-2">
            <p class="font-mono text-lg font-semibold tracking-widest">{{ ticket.code }}</p>
            <button
              type="button"
              class="ml-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              :aria-label="copied ? 'Code copied' : 'Copy code'"
              @click="copyCode"
            >
              <Check v-if="copied" class="h-3.5 w-3.5" :stroke-width="2" />
              <Copy v-else class="h-3.5 w-3.5" :stroke-width="2" />
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ ticket.department }} · {{ ticket.role }} · Valid until {{ new Date(ticket.expiresAt).toLocaleString() }}
          </p>
        </div>
      </section>
    </main>
  </div>
</template>
