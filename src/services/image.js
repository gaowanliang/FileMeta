import { v4 as uuidv4 } from 'uuid'
import avifEncode from '@jsquash/avif/encode.js'

/**
 * Compress image to AVIF using @jsquash/avif WASM encoder.
 * Canvas.convertToBlob does NOT actually encode AVIF in most browsers,
 * silently falling back to PNG. This uses the real libavif WASM encoder.
 */
export async function compressImage(file) {
  const bitmap = await createImageBitmap(file)

  const maxDim = 1920
  let { width, height } = bitmap
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // Get raw pixel data for WASM encoder
  const imageData = ctx.getImageData(0, 0, width, height)

  // Encode to AVIF via WASM — quality 50 gives excellent compression
  // (0=worst, 100=lossless). Typically reduces 4MB PNG → 50-150KB AVIF.
  const avifBuffer = await avifEncode(imageData, {
    quality: 50,
    speed: 6,
    subsample: 1, // YUV420 for smaller size
  })

  const imageId = uuidv4()

  return {
    imageId,
    data: new Uint8Array(avifBuffer),
    mimeType: 'image/avif',
  }
}

const objectUrls = new Map()

export function createImageUrl(imageId, data) {
  if (objectUrls.has(imageId)) return objectUrls.get(imageId)
  const blob = new Blob([data], { type: 'image/avif' })
  const url = URL.createObjectURL(blob)
  objectUrls.set(imageId, url)
  return url
}

export function revokeImageUrl(imageId) {
  const url = objectUrls.get(imageId)
  if (url) {
    URL.revokeObjectURL(url)
    objectUrls.delete(imageId)
  }
}

export function revokeAllImageUrls() {
  for (const url of objectUrls.values()) {
    URL.revokeObjectURL(url)
  }
  objectUrls.clear()
}
