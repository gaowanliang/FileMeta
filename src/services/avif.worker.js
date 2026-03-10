import avifEncode from '@jsquash/avif/encode.js'

self.onmessage = async (e) => {
  const { imageData, options } = e.data
  try {
    const buffer = await avifEncode(imageData, options)
    self.postMessage({ buffer }, [buffer])
  } catch (err) {
    self.postMessage({ error: err.message })
  }
}
