<script setup lang="ts">
import { computed } from 'vue'
import { UserPlus, X } from '@lucide/vue'
import UserAvatar from '@/components/UserAvatar.vue'
import type { UserSummary } from '@/lib/api'

const props = defineProps<{
  title: string
  users: UserSummary[]
  modelValue: number[]
  excludeIds?: number[]
}>()

const emit = defineEmits<{
  'update:modelValue': [ids: number[]]
  close: []
}>()

const selectedUsers = computed(() =>
  props.users.filter((user) => props.modelValue.includes(user.id)),
)

function toggle(user: UserSummary) {
  if (props.excludeIds?.includes(user.id)) return
  const next = [...props.modelValue]
  const index = next.indexOf(user.id)
  if (index === -1) {
    next.push(user.id)
  } else {
    next.splice(index, 1)
  }
  emit('update:modelValue', next)
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="emit('close')"
  >
    <div class="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-border bg-card text-card-foreground shadow-lg">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 class="text-sm font-semibold tracking-tight">{{ title }}</h2>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-4 w-4" :stroke-width="2" />
        </button>
      </div>

      <div class="flex flex-col gap-2 border-b border-border px-4 py-3">
        <span class="text-xs font-medium text-muted-foreground">Selected</span>
        <div v-if="selectedUsers.length" class="flex flex-wrap gap-2">
          <span
            v-for="selected in selectedUsers"
            :key="selected.id"
            class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted py-0.5 pl-0.5 pr-2 text-xs font-medium text-muted-foreground"
          >
            <UserAvatar
              :name="selected.userName"
              :avatar="selected.avatar"
              size-class="h-5 w-5 text-[10px]"
            />
            {{ selected.userName }}
          </span>
        </div>
        <p v-else class="text-sm text-muted-foreground">No users selected yet.</p>
      </div>

      <div class="flex-1 overflow-y-auto px-2 py-2">
        <p v-if="users.length === 0" class="px-2 py-4 text-sm text-muted-foreground">No users available.</p>
        <ul v-else class="flex flex-col">
          <li
            v-for="available in users"
            :key="available.id"
            class="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50"
          >
            <UserAvatar
              :name="available.userName"
              :avatar="available.avatar"
              size-class="h-8 w-8 text-xs"
            />
            <span class="flex-1 truncate text-sm font-medium">{{ available.userName }}</span>
            <button
              type="button"
              class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              :disabled="excludeIds?.includes(available.id)"
              @click="toggle(available)"
            >
              <UserPlus v-if="!modelValue.includes(available.id) && !excludeIds?.includes(available.id)" class="h-3.5 w-3.5" :stroke-width="2" />
              <X v-else-if="modelValue.includes(available.id)" class="h-3.5 w-3.5" :stroke-width="2" />
              {{
                modelValue.includes(available.id)
                  ? 'Remove'
                  : excludeIds?.includes(available.id)
                    ? 'Unavailable'
                    : 'Add'
              }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
