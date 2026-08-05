<script setup lang="ts">
import { GraduationCap, Home, ListTodo, Settings } from '@lucide/vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const items = [
  { label: 'Home', icon: Home, to: 'home' },
  { label: 'My BITNP', icon: GraduationCap, to: 'my-bitnp' },
  { label: 'Todo', icon: ListTodo },
  { label: 'Settings', icon: Settings, to: 'settings' },
]

function isActive(item: (typeof items)[number]): boolean {
  return 'to' in item && item.to === route.name
}
</script>

<template>
  <aside class="flex h-full w-[220px] shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
    <div class="flex items-center gap-2 px-4 pt-5">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
        G
      </div>
      <span class="text-sm font-semibold tracking-tight">Guild of Pioneers</span>
    </div>

    <nav class="flex flex-1 flex-col gap-1 px-2">
      <component
        :is="'to' in item ? 'RouterLink' : 'button'"
        v-for="item in items"
        :key="item.label"
        :to="'to' in item ? { name: item.to } : undefined"
        :type="'to' in item ? undefined : 'button'"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        :class="
          isActive(item)
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
        "
      >
        <component :is="item.icon" class="h-4 w-4 shrink-0" :stroke-width="isActive(item) ? 2.4 : 2" />
        {{ item.label }}
      </component>
    </nav>

    <div class="px-4 pb-4">
      <span class="text-xs text-sidebar-foreground/50">v0.0.0</span>
    </div>
  </aside>
</template>
