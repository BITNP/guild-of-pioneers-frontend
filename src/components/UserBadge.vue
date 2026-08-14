<script setup lang="ts">
import UserAvatar from '@/components/UserAvatar.vue'
import type { UserSummary } from '@/lib/api'

withDefaults(
  defineProps<{
    user: UserSummary | null | undefined
    showAvatar?: boolean
    showName?: boolean
    avatarSizeClass?: string
    nameClass?: string
  }>(),
  {
    showAvatar: true,
    showName: true,
    avatarSizeClass: 'h-6 w-6 text-[10px]',
    nameClass: '',
  },
)
</script>

<template>
  <RouterLink
    v-if="user"
    :to="{ name: 'user', params: { id: user.id } }"
    class="inline-flex items-center gap-1.5 rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:opacity-80"
    :title="user.userName"
  >
    <UserAvatar
      v-if="showAvatar"
      :name="user.userName"
      :avatar="user.avatar"
      :size-class="avatarSizeClass"
    />
    <span
      v-if="showName"
      class="text-sm font-medium underline-offset-2 hover:underline"
      :class="nameClass"
    >
      {{ user.userName }}
    </span>
  </RouterLink>
</template>
