<script setup lang="ts">
import { ref } from 'vue'
import { Cropper, type CropperResult } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { decodeGifFrames, encodeCroppedGif, type CropRect } from '@/lib/gifAvatar'

type CropperInstance = InstanceType<typeof Cropper>

const props = defineProps<{
  src: string
  file?: File | null
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  confirm: [file: File]
  cancel: []
  error: [message: string]
}>()

const cropperRef = ref<CropperInstance | null>(null)
const busy = ref(false)

const stencilProps = {
  movable: true,
  resizable: true,
  handlers: {},
  lines: {},
  overlay: true,
  boundingBox: false,
  aspectRatio: 1,
}

async function confirm() {
  if (props.loading || busy.value) return
  const result = cropperRef.value?.getResult()
  if (!result?.canvas) return

  if (props.file?.type === 'image/gif') {
    busy.value = true
    try {
      const blob = await cropGif(result)
      emit('confirm', new File([blob], 'avatar.gif', { type: 'image/gif' }))
    } catch (error) {
      emit('error', 'Could not preserve GIF animation. The first frame was uploaded instead.')
      emit('confirm', new File([toPngBlob(result.canvas)], 'avatar.png', { type: 'image/png' }))
    } finally {
      busy.value = false
    }
    return
  }

  const sourceCanvas = result.canvas
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(sourceCanvas, 0, 0, 512, 512)

  canvas.toBlob((blob) => {
    if (!blob) return
    emit('confirm', new File([blob], 'avatar.png', { type: 'image/png' }))
  }, 'image/png')
}

function toPngBlob(sourceCanvas: HTMLCanvasElement): Blob {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  ctx?.drawImage(sourceCanvas, 0, 0, 512, 512)
  const dataUrl = canvas.toDataURL('image/png')
  const binary = atob(dataUrl.split(',')[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'image/png' })
}

async function cropGif(result: CropperResult): Promise<Blob> {
  const file = props.file
  if (!file) throw new Error('Missing GIF file')
  const buffer = await file.arrayBuffer()
  const decoded = await decodeGifFrames(buffer)
  const scaleX = result.image.width > 0 ? decoded.width / result.image.width : 1
  const scaleY = result.image.height > 0 ? decoded.height / result.image.height : 1
  const crop: CropRect = {
    left: result.coordinates.left * scaleX,
    top: result.coordinates.top * scaleY,
    width: result.coordinates.width * scaleX,
    height: result.coordinates.height * scaleY,
  }
  return encodeCroppedGif(decoded.frames, crop, decoded.width, decoded.height, 512)
}

function onOpenChange(open: boolean) {
  if (!open) emit('cancel')
}
</script>

<template>
  <DialogRoot :open="true" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/50" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg"
      >
        <DialogTitle class="text-lg font-semibold tracking-tight">Upload avatar</DialogTitle>
        <p class="mt-1 text-sm text-muted-foreground">Drag or zoom to crop your avatar.</p>

        <div class="avatar-cropper mt-4 h-72 w-full overflow-hidden rounded-md bg-black">
          <Cropper
            ref="cropperRef"
            :src="src"
            :aspect-ratio="1"
            :stencil-props="stencilProps"
          />
        </div>

        <p
          v-if="error"
          class="mt-3 text-sm text-destructive"
          role="alert"
        >
          {{ error }}
        </p>

        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            :disabled="loading || busy"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            :disabled="loading || busy"
            @click="confirm"
          >
            {{ loading || busy ? 'Processing…' : 'Confirm' }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.avatar-cropper .vue-simple-line {
  border-color: #000;
}

.avatar-cropper .vue-simple-line--east {
  border-right-width: 2px;
}

.avatar-cropper .vue-simple-line--west {
  border-left-width: 2px;
}

.avatar-cropper .vue-simple-line--south {
  border-bottom-width: 2px;
}

.avatar-cropper .vue-simple-line--north {
  border-top-width: 2px;
}

.avatar-cropper .vue-simple-line--hover {
  border-color: #000;
}

.avatar-cropper .vue-simple-handler--west-north,
.avatar-cropper .vue-simple-handler--east-south,
.avatar-cropper .vue-simple-handler--west-south,
.avatar-cropper .vue-simple-handler--east-north {
  border-color: #000;
  border-width: 3px;
  opacity: 1;
}
</style>
