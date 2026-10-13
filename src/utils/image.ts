import { ChatError } from '../chat-service/types'

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
/** 壓縮後仍超過這個大小就不能送出 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
/** 超過這個大小才壓縮，並壓到它以下 */
const COMPRESS_ABOVE = 1024 * 1024

export interface PreparedImage {
  file: File
  previewUrl: string
  originalSize: number
  compressed: boolean
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** 縮小尺寸並降低畫質，直到小於 maxBytes。 */
export async function compressImage(file: Blob, maxBytes: number, startDim = 2048): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ChatError('image_type_unsupported')
  }
  const outType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
  const longSide = Math.max(bitmap.width, bitmap.height)
  const dims = [2048, 1600, 1280, 1024, 800, 600].filter((d) => d <= startDim)
  for (const dim of dims) {
    const scale = Math.min(1, dim / longSide)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) break
    if (outType === 'image/jpeg') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.72, 0.6, 0.5]) {
      const blob = await canvasToBlob(canvas, outType, quality)
      if (blob && blob.size <= maxBytes) {
        bitmap.close()
        return blob
      }
    }
  }
  bitmap.close()
  throw new ChatError('image_too_large')
}

/** 檢查類型、必要時壓縮，並產生預覽網址。呼叫者要負責 URL.revokeObjectURL。 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new ChatError('image_type_unsupported')

  let result: File = file
  let compressed = false
  if (file.type === 'image/gif') {
    // 壓縮會失去動畫，所以 GIF 太大就直接拒絕
    if (file.size > MAX_IMAGE_BYTES) throw new ChatError('image_too_large')
  } else if (file.size > COMPRESS_ABOVE) {
    const blob = await compressImage(file, COMPRESS_ABOVE)
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    result = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type })
    compressed = true
  }
  return {
    file: result,
    previewUrl: URL.createObjectURL(result),
    originalSize: file.size,
    compressed,
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
