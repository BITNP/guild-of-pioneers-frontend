import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { decompressFrames, parseGIF } from 'gifuct-js'

export interface GifFrame {
  data: Uint8ClampedArray<ArrayBuffer>
  delay: number
}

export interface DecodedGif {
  width: number
  height: number
  frames: GifFrame[]
}

export interface CropRect {
  left: number
  top: number
  width: number
  height: number
}

const MAX_FRAMES = 200

export async function decodeGifFrames(buffer: ArrayBuffer): Promise<DecodedGif> {
  const parsed = parseGIF(buffer)
  const rawFrames = decompressFrames(parsed, true).slice(0, MAX_FRAMES)
  if (rawFrames.length === 0) {
    throw new Error('GIF contains no image frames')
  }

  const width = parsed.lsd.width
  const height = parsed.lsd.height

  const background = parsed.lsd.gct.exists && parsed.gct[parsed.lsd.backgroundColorIndex]
    ? parsed.gct[parsed.lsd.backgroundColorIndex]
    : null

  const state = document.createElement('canvas')
  state.width = width
  state.height = height
  const ctx = state.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported')

  const snapshot = document.createElement('canvas')
  snapshot.width = width
  snapshot.height = height
  const snapshotCtx = snapshot.getContext('2d')
  if (!snapshotCtx) throw new Error('Canvas is not supported')

  if (background) {
    ctx.fillStyle = `rgb(${background[0]}, ${background[1]}, ${background[2]})`
    ctx.fillRect(0, 0, width, height)
  }

  const patchCanvas = document.createElement('canvas')
  const patchCtx = patchCanvas.getContext('2d')

  const frames: GifFrame[] = []
  for (let i = 0; i < rawFrames.length; i++) {
    const frame = rawFrames[i]
    if (i > 0) {
      const prev = rawFrames[i - 1]
      if (prev.disposalType === 2) {
        if (background) {
          ctx.fillStyle = `rgb(${background[0]}, ${background[1]}, ${background[2]})`
          ctx.fillRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height)
        } else {
          ctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height)
        }
      } else if (prev.disposalType === 3) {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(snapshot, 0, 0)
      }
    }

    snapshotCtx.clearRect(0, 0, width, height)
    snapshotCtx.drawImage(state, 0, 0)

    if (patchCtx) {
      patchCanvas.width = frame.dims.width
      patchCanvas.height = frame.dims.height
      const patchImage = patchCtx.createImageData(frame.dims.width, frame.dims.height)
      patchImage.data.set(frame.patch)
      patchCtx.putImageData(patchImage, 0, 0)
      ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top)
    }

    const imageData = ctx.getImageData(0, 0, width, height)
    frames.push({ data: imageData.data, delay: frame.delay })
  }

  return { width, height, frames }
}

export function encodeCroppedGif(
  frames: GifFrame[],
  crop: CropRect,
  sourceWidth: number,
  sourceHeight: number,
  outputSize: number,
): Blob {
  if (frames.length === 0) {
    throw new Error('No frames to encode')
  }
  if (crop.width <= 0 || crop.height <= 0 || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Invalid crop area')
  }

  const left = Math.max(0, Math.min(sourceWidth, crop.left))
  const top = Math.max(0, Math.min(sourceHeight, crop.top))
  const width = Math.min(sourceWidth - left, crop.width)
  const height = Math.min(sourceHeight - top, crop.height)

  const full = document.createElement('canvas')
  full.width = sourceWidth
  full.height = sourceHeight
  const fullCtx = full.getContext('2d')

  const output = document.createElement('canvas')
  output.width = outputSize
  output.height = outputSize
  const outputCtx = output.getContext('2d')
  if (!fullCtx || !outputCtx) throw new Error('Canvas is not supported')

  const gif = GIFEncoder()
  for (const frame of frames) {
    fullCtx.putImageData(new ImageData(frame.data, sourceWidth, sourceHeight), 0, 0)
    outputCtx.imageSmoothingQuality = 'high'
    outputCtx.drawImage(full, left, top, width, height, 0, 0, outputSize, outputSize)

    const rgba = outputCtx.getImageData(0, 0, outputSize, outputSize).data
    const palette = quantize(rgba, 256)
    const index = applyPalette(rgba, palette)
    gif.writeFrame(index, outputSize, outputSize, { palette, delay: frame.delay })
  }
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}
