<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, fetchActions, fetchProjects, fetchTasks, type Action, type Project, type Task } from '@/lib/api'
import { useAuth } from '@/composables/useAuth'

type NodeKind = 'root' | 'project' | 'task' | 'action'

interface MindMapNode {
  id: string
  label: string
  fullLabel: string
  kind: NodeKind
  projectId?: number
  taskId?: number
  actionId?: number
  finished?: boolean
  related?: boolean
  children: MindMapNode[]
  x: number // horizontal center
  y: number // vertical center
  diameter: number
  depth: number
  subtreeWidth?: number
}

interface Edge {
  x1: number
  y1: number
  x2: number
  y2: number
  fromRoot: boolean
  childFinished: boolean
}

interface LayoutResult {
  positioned: MindMapNode[]
  edges: Edge[]
  width: number
  height: number
}

const RADIUS_PADDING = 5
const NODE_DIAMETER = 176
const CHILD_GAP = 26
// Vertical gap above each row: index by depth (0 = above the root row,
// 1 = above the Project row, 2 = above the Task row, ...). The last value is
// used as a fallback for any deeper levels.
const ROW_GAPS = [100, 300, 300]
// Vertical jitter magnitude per row, same depth convention as ROW_GAPS.
const MAX_Y_OFFSETS = [0, 200, 200]
const PADDING = 24
const MIN_SCALE = 0.2
const MAX_SCALE = 3
const NODE_FONT_SIZE = 20
const ROOT_FONT_SIZE = 15
const MAX_LABEL_WIDTH = NODE_DIAMETER - RADIUS_PADDING * 2

const router = useRouter()
const { user } = useAuth()
const loading = ref(true)
const error = ref<string | null>(null)
const tree = ref<MindMapNode | null>(null)

function estimateTextWidth(text: string, fontSize: number = NODE_FONT_SIZE): number {
  const asciiWidth = fontSize * 0.585
  const wideWidth = fontSize * 1.077
  let width = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    const wide =
      (code >= 0x2e80 && code <= 0x9fff) || // CJK unified ideographs and radicals
      (code >= 0xac00 && code <= 0xd7af) || // Hangul
      (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility ideographs
      (code >= 0xff00 && code <= 0xffef) // full-width forms
    width += wide ? wideWidth : asciiWidth
  }
  return width
}

function truncateLabel(label: string, maxWidth: number, fontSize: number = NODE_FONT_SIZE): string {
  if (estimateTextWidth(label, fontSize) <= maxWidth) return label
  let result = ''
  let used = 0
  const ellipsis = '…'
  for (const ch of label) {
    const charWidth = estimateTextWidth(ch, fontSize)
    if (used + charWidth + estimateTextWidth(ellipsis, fontSize) > maxWidth) break
    result += ch
    used += charWidth
  }
  return result + ellipsis
}

// Deterministic pseudo-random hash of a label, so a node keeps the same
// vertical offset across reloads and the tree shape never changes.
function titleHash(label: string): number {
  let hash = 0
  for (const ch of label) {
    hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  }
  return hash
}

function verticalOffset(label: string, depth: number): number {
  const maxOffset = MAX_Y_OFFSETS[depth] ?? MAX_Y_OFFSETS[MAX_Y_OFFSETS.length - 1]
  // Offset is measured from the row's base position upward (bottom-up), so a
  // node never moves toward the row below it.
  return ((titleHash(label) % 1000) / 1000) * maxOffset
}

function makeNode(
  kind: NodeKind,
  id: string,
  label: string,
  extras: Partial<MindMapNode>,
  children: MindMapNode[],
): MindMapNode {
  return {
    id,
    label: kind === 'root' ? label : truncateLabel(label, MAX_LABEL_WIDTH),
    fullLabel: label,
    kind,
    children,
    x: 0,
    y: 0,
    depth: 0,
    diameter: NODE_DIAMETER,
    ...extras,
  }
}

// Bottom-up tree layout: the root sits at the bottom center and children fan
// out above it. Each subtree is sized by the widest row below it, and parent
// nodes are centered horizontally over their children.
function computePositions(root: MindMapNode): LayoutResult {
  const subtreeWidth = (node: MindMapNode): number => {
    if (node.children.length === 0) {
      node.subtreeWidth = node.diameter
    } else {
      let total = 0
      for (const child of node.children) total += subtreeWidth(child)
      total += CHILD_GAP * (node.children.length - 1)
      node.subtreeWidth = Math.max(node.diameter, total)
    }
    return node.subtreeWidth
  }

  const totalWidth = subtreeWidth(root)

  const assignX = (node: MindMapNode, center: number): void => {
    node.x = center
    if (node.children.length > 0) {
      const childrenWidth =
        node.children.reduce((sum, child) => sum + (child.subtreeWidth ?? 0), 0) +
        CHILD_GAP * (node.children.length - 1)
      let cursor = center - childrenWidth / 2
      for (const child of node.children) {
        assignX(child, cursor + (child.subtreeWidth ?? 0) / 2)
        cursor += (child.subtreeWidth ?? 0) + CHILD_GAP
      }
    }
  }
  assignX(root, totalWidth / 2)

  const positioned: MindMapNode[] = []
  const rowMax: number[] = []
  const collect = (node: MindMapNode, depth: number): void => {
    node.depth = depth
    rowMax[depth] = Math.max(rowMax[depth] ?? 0, node.diameter)
    positioned.push(node)
    for (const child of node.children) collect(child, depth + 1)
  }
  collect(root, 0)

  const maxOffset = Math.max(...MAX_Y_OFFSETS)
  const contentHeight =
    rowMax.reduce((sum, height) => sum + height, 0) +
    ROW_GAPS.slice(0, Math.max(0, rowMax.length - 1)).reduce((sum, gap) => sum + gap, 0) +
    maxOffset * 2
  let cumulative = 0
  for (let depth = 0; depth < rowMax.length; depth++) {
    const rowBottom = contentHeight - cumulative - rowMax[depth] - maxOffset
    cumulative += rowMax[depth]
    if (depth < rowMax.length - 1) cumulative += ROW_GAPS[depth] ?? ROW_GAPS[ROW_GAPS.length - 1]
    for (const node of positioned) {
      if (node.depth === depth) {
        node.y = rowBottom + node.diameter / 2 - (node.depth === 0 ? 0 : verticalOffset(node.fullLabel, node.depth))
      }
    }
  }

  const edges: Edge[] = []
  const buildEdges = (node: MindMapNode): void => {
    for (const child of node.children) {
      edges.push({
        x1: node.x,
        y1: node.y - node.diameter / 2, // parent top
        x2: child.x,
        y2: child.y + child.diameter / 2, // child bottom
        fromRoot: node.kind === 'root',
        childFinished: child.finished === true,
      })
      buildEdges(child)
    }
  }
  buildEdges(root)

  return {
    positioned,
    edges,
    width: totalWidth,
    height: contentHeight,
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const userId = user.value?.id
    const projects: Project[] = await fetchProjects()
    const taskLists = await Promise.all(projects.map((project) => fetchTasks(project.id)))
    const tasks: Task[] = taskLists.flat()
    const actionLists = await Promise.all(tasks.map((task) => fetchActions(task.id)))
    const actionsByTask = new Map<number, Action[]>()
    tasks.forEach((task, index) => actionsByTask.set(task.id, actionLists[index]))

    tree.value = makeNode(
      'root',
      'root',
      'Guild of Pioneers',
      {},
      projects.map((project, projectIndex) =>
        makeNode(
          'project',
          `project-${project.id}`,
          project.title,
          {
            projectId: project.id,
            related: userId != null && (project.leaderIds.includes(userId) || project.memberIds.includes(userId)),
          },
          taskLists[projectIndex].map((task) =>
            makeNode(
              'task',
              `task-${task.id}`,
              task.title,
              {
                projectId: project.id,
                taskId: task.id,
                related: userId != null && (task.leaderIds.includes(userId) || task.memberIds.includes(userId)),
              },
              (actionsByTask.get(task.id) ?? []).map((action) =>
                makeNode(
                  'action',
                  `action-${action.id}`,
                  action.title,
                  {
                    projectId: project.id,
                    taskId: task.id,
                    actionId: action.id,
                    finished: action.endDate != null,
                    related: userId != null && action.memberIds.includes(userId),
                  },
                  [],
                ),
              ),
            ),
          ),
        ),
      ),
    )
  } catch (err) {
    tree.value = null
    error.value = err instanceof ApiError ? err.message : 'Failed to load projects.'
  } finally {
    loading.value = false
  }
}

const showOnlyMine = ref(false)

function filterTree(node: MindMapNode): MindMapNode | null {
  if (node.kind === 'root') {
    return { ...node, children: node.children.map(filterTree).filter((n): n is MindMapNode => n != null) }
  }
  const children = node.children.map(filterTree).filter((n): n is MindMapNode => n != null)
  if (node.related || children.length > 0) {
    return { ...node, children }
  }
  return null
}

const displayTree = computed<MindMapNode | null>(() => {
  if (!tree.value) return null
  return showOnlyMine.value ? filterTree(tree.value) : tree.value
})

const layoutResult = computed<LayoutResult | null>(() => (displayTree.value ? computePositions(displayTree.value) : null))

function openNode(node: MindMapNode): void {
  if (node.kind === 'project' && node.projectId != null) {
    void router.push({ name: 'project-detail', params: { id: node.projectId } })
  } else if (node.kind === 'task' && node.projectId != null && node.taskId != null) {
    void router.push({ name: 'task-detail', params: { id: node.projectId, taskId: node.taskId } })
  } else if (
    node.kind === 'action' &&
    node.projectId != null &&
    node.taskId != null &&
    node.actionId != null
  ) {
    void router.push({
      name: 'action-edit',
      params: { id: node.projectId, taskId: node.taskId, actionId: node.actionId },
    })
  }
}

function edgePath(edge: Edge): string {
  const dy = Math.max(20, (edge.y1 - edge.y2) / 2)
  return `M ${edge.x1} ${edge.y1} C ${edge.x1} ${edge.y1 - dy}, ${edge.x2} ${edge.y2 + dy}, ${edge.x2} ${edge.y2}`
}

// Pan and zoom view. The map starts auto-fitted inside the viewport; the wheel
// zooms around the cursor (clamped to MIN_SCALE..MAX_SCALE) and dragging pans.
const container = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const containerHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

watch(container, (el) => {
  if (el && !resizeObserver) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width
        containerHeight.value = entry.contentRect.height
      }
    })
    resizeObserver.observe(el)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

const contentWidth = computed(() => (layoutResult.value?.width ?? 0) + PADDING * 2)
const contentHeight = computed(() => (layoutResult.value?.height ?? 0) + PADDING * 2)
const view = reactive({ scale: 1, x: 0, y: 0 })
const viewTransform = computed(
  () => `translate(${view.x + PADDING * view.scale} ${view.y + PADDING * view.scale}) scale(${view.scale})`,
)
const viewBox = computed(() =>
  containerWidth.value > 0 && containerHeight.value > 0
    ? `0 0 ${containerWidth.value} ${containerHeight.value}`
    : '0 0 1 1',
)

let initializedKey = ''
function resetView(): void {
  const result = layoutResult.value
  if (!result || containerWidth.value <= 0 || containerHeight.value <= 0) return
  const fit = Math.min(1, containerWidth.value / contentWidth.value, containerHeight.value / contentHeight.value)
  view.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit))
  view.x = (containerWidth.value - contentWidth.value * view.scale) / 2
  view.y = (containerHeight.value - contentHeight.value * view.scale) / 2
}

watch([layoutResult, containerWidth, containerHeight], () => {
  const result = layoutResult.value
  if (!result || containerWidth.value <= 0 || containerHeight.value <= 0) return
  const key = `${result.width}x${result.height}@${containerWidth.value}x${containerHeight.value}`
  if (key !== initializedKey) {
    initializedKey = key
    resetView()
  }
})

function onWheel(event: WheelEvent): void {
  const rect = container.value?.getBoundingClientRect()
  if (!rect) return
  const cursorX = event.clientX - rect.left
  const cursorY = event.clientY - rect.top
  const factor = Math.exp(-event.deltaY * 0.0015)
  const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor))
  const worldX = (cursorX - view.x) / view.scale
  const worldY = (cursorY - view.y) / view.scale
  view.scale = nextScale
  view.x = cursorX - worldX * nextScale
  view.y = cursorY - worldY * nextScale
}

const dragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let viewStartX = 0
let viewStartY = 0
let dragMoved = false
let downNodeId: string | null = null

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  const target = event.target as Element | null
  if (target?.closest('.mindmap-filter')) return
  dragging.value = true
  dragMoved = false
  downNodeId = target?.closest('.mindmap-node')?.getAttribute('data-node-id') ?? null
  dragStartX = event.clientX
  dragStartY = event.clientY
  viewStartX = view.x
  viewStartY = view.y
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value) return
  const dx = event.clientX - dragStartX
  const dy = event.clientY - dragStartY
  if (Math.hypot(dx, dy) > 4) dragMoved = true
  if (dragMoved) {
    view.x = viewStartX + dx
    view.y = viewStartY + dy
  }
}

function onPointerUp(): void {
  if (!dragMoved && downNodeId) {
    const node = layoutResult.value?.positioned.find((item) => item.id === downNodeId)
    if (node) openNode(node)
  }
  dragging.value = false
  dragMoved = false
  downNodeId = null
}

function onPointerCancel(): void {
  dragging.value = false
  dragMoved = false
  downNodeId = null
}

const hasProjects = computed(() => (tree.value?.children.length ?? 0) > 0)
const hasRelatedNodes = computed(() => (displayTree.value?.children.length ?? 0) > 0)

onMounted(load)
</script>

<template>
  <div v-if="loading" class="flex h-full items-center justify-center text-sm text-muted-foreground">
    Loading projects…
  </div>

  <div v-else-if="error" class="flex h-full flex-col items-center justify-center gap-3 text-sm">
    <p class="text-destructive">{{ error }}</p>
    <button
      type="button"
      class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      @click="load"
    >
      Retry
    </button>
  </div>

  <div
    v-else
    ref="container"
    class="relative flex h-full w-full touch-none select-none flex-col overflow-hidden rounded-lg border bg-card"
    :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <div
      class="mindmap-filter absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full border bg-background/80 p-1 text-xs"
      role="group"
      aria-label="Node filter"
    >
      <button
        type="button"
        class="rounded-full px-2.5 py-1 font-medium transition-colors"
        :class="!showOnlyMine ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
        @click="showOnlyMine = false"
      >
        All
      </button>
      <button
        type="button"
        class="rounded-full px-2.5 py-1 font-medium transition-colors"
        :class="showOnlyMine ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
        @click="showOnlyMine = true"
      >
        Mine
      </button>
    </div>
    <span
      class="pointer-events-none absolute right-3 top-3 z-10 rounded-full border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground"
    >
      Scroll to zoom · drag to pan · click for details
    </span>
    <p v-if="!hasProjects" class="mb-3 text-sm text-muted-foreground">No projects yet.</p>
    <p v-else-if="showOnlyMine && !hasRelatedNodes" class="mb-3 text-sm text-muted-foreground">
      No nodes related to you.
    </p>
    <svg v-if="layoutResult" :viewBox="viewBox" class="block min-h-0 w-full flex-1" focusable="false">
      <g :transform="viewTransform">
        <path
          v-for="edge in layoutResult.edges"
          :key="`${edge.x1}-${edge.y1}-${edge.x2}-${edge.y2}`"
          :d="edgePath(edge)"
          :class="[
            'mindmap-edge',
            { 'mindmap-edge--root': edge.fromRoot, 'mindmap-edge--finished': edge.childFinished },
          ]"
        />
        <g
          v-for="node in layoutResult.positioned"
          :key="node.id"
          :class="[
            `mindmap-node mindmap-node--${node.kind}`,
            { 'mindmap-node--finished': node.finished },
            { 'mindmap-node--clickable': node.kind !== 'root' },
          ]"
          :tabindex="node.kind === 'root' ? undefined : 0"
          :role="node.kind === 'root' ? undefined : 'button'"
          :aria-label="node.kind === 'root' ? node.fullLabel : `Open ${node.fullLabel}`"
          :data-node-id="node.id"
          @keydown.enter="openNode(node)"
          @keydown.space.prevent="openNode(node)"
        >
          <title>{{ node.fullLabel }}</title>
          <circle :cx="node.x" :cy="node.y" :r="node.diameter / 2" />
          <text
            :x="node.x"
            :y="node.y"
            text-anchor="middle"
            dominant-baseline="central"
            :font-size="node.kind === 'root' ? ROOT_FONT_SIZE : NODE_FONT_SIZE"
          >
            {{ node.label }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
:global(:root) {
  --mm-edge: oklch(0.765 0.177 163.223);
  --mm-edge-root: oklch(0.5 0.09 45);
  --mm-root-fill: oklch(0.4 0.08 45);
  --mm-root-stroke: oklch(0.28 0.06 45);
  --mm-root-hover: oklch(0.48 0.09 45);
  --mm-project-fill: oklch(0.52 0.1 45);
  --mm-project-stroke: oklch(0.36 0.08 45);
  --mm-project-hover: oklch(0.6 0.11 45);
  --mm-task-fill: oklch(0.432 0.095 166.913);
  --mm-task-stroke: oklch(0.262 0.051 172.552);
  --mm-task-hover: oklch(0.508 0.118 165.612);
  --mm-action-fill: oklch(0.696 0.17 162.48);
  --mm-action-stroke: oklch(0.432 0.095 166.913);
  --mm-action-hover: oklch(0.765 0.177 163.223);
  --mm-finished-fill: oklch(85.773% 0.1621 119.54);
  --mm-finished-stroke: oklch(84.979% 0.1738 86.555);
  --mm-finished-hover: oklch(85.35% 0.17435 88.778);
  --mm-text-on-dark: oklch(0.985 0 0);
  --mm-text-on-light: oklch(0.262 0.051 172.552);
  --mm-focus-stroke: oklch(0.432 0.095 166.913);
}

.mindmap-edge {
  fill: none;
  stroke: var(--mm-edge);
  stroke-width: 2;
}

.mindmap-edge--root {
  stroke: var(--mm-edge-root);
}

.mindmap-edge--finished {
  stroke: var(--mm-finished-stroke);
}

.mindmap-node {
  outline: none;
}

.mindmap-node circle {
  transition:
    fill 150ms ease,
    stroke 150ms ease;
}

.mindmap-node text {
  font-family: var(--font-sans);
  pointer-events: none;
}

.mindmap-node--root circle {
  fill: var(--mm-root-fill);
  stroke: var(--mm-root-stroke);
  stroke-width: 2;
}

.mindmap-node--root text {
  fill: var(--mm-text-on-dark);
  font-weight: 600;
}

.mindmap-node--project circle {
  fill: var(--mm-project-fill);
  stroke: var(--mm-project-stroke);
  stroke-width: 2;
}

.mindmap-node--project text {
  fill: var(--mm-text-on-dark);
  font-weight: 500;
}

.mindmap-node--task circle {
  fill: var(--mm-task-fill);
  stroke: var(--mm-task-stroke);
  stroke-width: 1.5;
}

.mindmap-node--task text {
  fill: var(--mm-text-on-dark);
}

.mindmap-node--action circle {
  fill: var(--mm-action-fill);
  stroke: var(--mm-action-stroke);
  stroke-width: 1.5;
}

.mindmap-node--action text {
  fill: var(--mm-text-on-dark);
}

.mindmap-node--clickable {
  cursor: pointer;
}

.mindmap-node--root:hover circle,
.mindmap-node--root:focus-visible circle {
  fill: var(--mm-root-hover);
  stroke: var(--mm-focus-stroke);
}

.mindmap-node--project:hover circle,
.mindmap-node--project:focus-visible circle {
  fill: var(--mm-project-hover);
  stroke: var(--mm-focus-stroke);
}

.mindmap-node--task:hover circle,
.mindmap-node--task:focus-visible circle {
  fill: var(--mm-task-hover);
  stroke: var(--mm-focus-stroke);
}

.mindmap-node--action:hover circle,
.mindmap-node--action:focus-visible circle {
  fill: var(--mm-action-hover);
  stroke: var(--mm-focus-stroke);
}

.mindmap-node--finished circle {
  fill: var(--mm-finished-fill);
  stroke: var(--mm-finished-stroke);
}

.mindmap-node--finished text {
  fill: var(--mm-text-on-light);
  text-decoration: line-through;
}

.mindmap-node--finished:hover circle,
.mindmap-node--finished:focus-visible circle {
  fill: var(--mm-finished-hover);
  stroke: var(--mm-focus-stroke);
}
</style>
