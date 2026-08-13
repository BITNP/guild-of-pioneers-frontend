<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    avatar?: string | null
    sizeClass?: string
  }>(),
  {
    avatar: null,
    sizeClass: 'h-8 w-8 text-xs',
  },
)

const failed = ref(false)
watch(
  () => props.avatar,
  () => {
    failed.value = false
  },
)

const initial = computed(() => (props.name || '?').charAt(0).toUpperCase())
</script>

<template>
  <img
    v-if="avatar && !failed"
    :src="avatar"
    :alt="`${name}'s avatar`"
    class="shrink-0 rounded-full object-cover"
    :class="sizeClass"
    @error="failed = true"
  />
  <div
    v-else
    class="flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
    :class="sizeClass"
    :title="name"
  >
    {{ initial }}
  </div>
</template>
