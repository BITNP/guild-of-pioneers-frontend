declare module 'gifenc' {
  export interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options: {
        palette: number[][]
        delay?: number
        transparent?: boolean
        transparentIndex?: number
        repeat?: number
        dispose?: number
        first?: boolean
      },
    ): void
    finish(): void
    bytes(): Uint8Array<ArrayBuffer>
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoderInstance
  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number, options?: object): number[][]
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array
}
