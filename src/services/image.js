import { v4 as uuidv4 } from 'uuid'
import AvifWorker from './avif.worker.js?worker'

let worker = null

function getWorker() {
  if (!worker) {
    worker = new AvifWorker()
  }
  return worker
}

function encodeInWorker(imageData, options) {
  return new Promise((resolve, reject) => {
    const w = getWorker()
    w.onmessage = (e) => {
      if (e.data.error) {
        reject(new Error(e.data.error))
      } else {
        resolve(e.data.buffer)
      }
    }
    w.onerror = (err) => reject(err)
    w.postMessage({ imageData, options })
  })
}

/**
 * Compress image to AVIF using @jsquash/avif WASM encoder in a Web Worker.
 * Runs off the main thread so the UI stays responsive.
 * @param {File} file
 * @param {{ quality?: number, maxDim?: number }} [options]
 */
export async function compressImage(file, options = {}) {
  const maxDim  = options.maxDim  ?? 1920
  const quality = options.quality ?? 50

  const bitmap = await createImageBitmap(file)

  let { width, height } = bitmap
  if (maxDim > 0 && (width > maxDim || height > maxDim)) {
    const ratio = Math.min(maxDim / width, maxDim / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const imageData = ctx.getImageData(0, 0, width, height)

  const avifBuffer = await encodeInWorker(imageData, {
    quality,
    speed: 8,
    subsample: 1,
  })

  const imageId = uuidv4()

  return {
    imageId,
    data: new Uint8Array(avifBuffer),
    mimeType: 'image/avif',
  }
}

const objectUrls = new Map()

export function getCachedImageUrl(imageId) {
  return objectUrls.get(imageId) || null
}

export function createImageUrl(imageId, data) {
  if (objectUrls.has(imageId)) return objectUrls.get(imageId)
  const blob = new Blob([data], { type: 'image/avif' })
  const url = URL.createObjectURL(blob)
  objectUrls.set(imageId, url)
  return url
}

export function createImageUrlFromBlob(imageId, blob) {
  if (objectUrls.has(imageId)) return objectUrls.get(imageId)
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
