import {
  compressMetadata, decompressMetadata,
  compressImageIndex, decompressImageIndex,
} from './protobuf.js'

// ── Constants ───────────────────────────────────────────────

const MAGIC = new Uint8Array([0x46, 0x4D, 0x44, 0x42]) // "FMDB"
const HEADER_SIZE = 32
const FORMAT_VERSION = 1
const DESC_LINE = 'Read with https://github.com/gaowanliang/FileMeta\n'
const DESC_BYTES = new TextEncoder().encode(DESC_LINE)

// ── Format detection ────────────────────────────────────────

/**
 * Detect file format from the first bytes.
 * @param {Uint8Array} headerBytes – at least 4 bytes
 * @returns {'fmdb' | 'legacy-pbgz' | 'unknown'}
 */
export function detectFormat(headerBytes) {
  if (headerBytes[0] === 0x46 && headerBytes[1] === 0x4D &&
      headerBytes[2] === 0x44 && headerBytes[3] === 0x42) {
    return 'fmdb'
  }
  // gzip magic: 0x1f 0x8b
  if (headerBytes[0] === 0x1F && headerBytes[1] === 0x8B) {
    return 'legacy-pbgz'
  }
  return 'unknown'
}

// ── Header read / write ─────────────────────────────────────

/**
 * Build a 32-byte FMDB header.
 */
export function writeHeader({ version, flags, metaOffset, metaSize, indexOffset, indexSize }) {
  const buf = new ArrayBuffer(HEADER_SIZE)
  const u8 = new Uint8Array(buf)
  const view = new DataView(buf)

  u8.set(MAGIC, 0)                        //  0-3  magic
  view.setUint16(4, version, true)         //  4-5  version
  view.setUint16(6, flags, true)           //  6-7  flags
  view.setUint32(8, metaOffset, true)      //  8-11 meta offset
  view.setUint32(12, metaSize, true)       // 12-15 meta size
  view.setUint32(16, indexOffset, true)    // 16-19 index offset
  view.setUint32(20, indexSize, true)      // 20-23 index size
  // 24-31 reserved (zeros)

  return u8
}

/**
 * Parse a 32-byte FMDB header.
 * @param {ArrayBuffer} buffer – exactly HEADER_SIZE bytes
 */
export function readHeader(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] !== 0x46 || bytes[1] !== 0x4D ||
      bytes[2] !== 0x44 || bytes[3] !== 0x42) {
    throw new Error('Not an FMDB file')
  }
  const view = new DataView(buffer)
  return {
    version:     view.getUint16(4, true),
    flags:       view.getUint16(6, true),
    metaOffset:  view.getUint32(8, true),
    metaSize:    view.getUint32(12, true),
    indexOffset: view.getUint32(16, true),
    indexSize:   view.getUint32(20, true),
  }
}

// ── Read operations ─────────────────────────────────────────

/**
 * Read an FMDB file: returns metadata + imageIndex (zero image bytes loaded).
 * @param {File} file
 * @returns {Promise<{ files: Object, imageIndex: Object }>}
 */
export async function readFmdbFile(file) {
  // 1. Header
  const headerBuf = await file.slice(0, HEADER_SIZE).arrayBuffer()
  const header = readHeader(headerBuf)

  // 2. Metadata section (gzip + protobuf)
  const metaGz = new Uint8Array(
    await file.slice(header.metaOffset, header.metaOffset + header.metaSize).arrayBuffer()
  )
  const metadata = await decompressMetadata(metaGz)

  // 3. Image index section (gzip + protobuf)
  const indexGz = new Uint8Array(
    await file.slice(header.indexOffset, header.indexOffset + header.indexSize).arrayBuffer()
  )
  const imageIndex = await decompressImageIndex(indexGz)

  return {
    files: metadata.files || {},
    imageIndex: imageIndex.entries || {},
  }
}

/**
 * Read a single image from the container file on demand.
 * @param {File} file
 * @param {{ offset: number, size: number }} entry
 * @returns {Promise<Uint8Array>}
 */
export async function readImageFromFile(file, entry) {
  const buf = await file.slice(entry.offset, entry.offset + entry.size).arrayBuffer()
  return new Uint8Array(buf)
}

// ── Write operation ─────────────────────────────────────────

/**
 * Write a complete FMDB container file.
 *
 * For existing images (on-disk), passes file.slice() Blobs directly to
 * the writable stream — the browser copies at the OS level without pulling
 * bytes into the JS heap.
 *
 * @param {FileSystemFileHandle} fileHandle
 * @param {Object} opts
 * @param {Object} opts.files          – cleaned files map
 * @param {Object} opts.existingImages – Map<id, {offset, size}> from current file
 * @param {Object} opts.newImages      – Map<id, Uint8Array> newly added
 * @param {File|null} opts.oldFile     – previous File object (null on first save)
 * @returns {Promise<{ imageIndex: Object }>} – new imageIndex with updated offsets
 */
export async function writeFmdbFile(fileHandle, { files, existingImages, newImages, oldFile }) {
  // 1. Build ordered image list and compute offsets
  const imageEntries = {}  // new ImageIndex
  const imageWriteOps = [] // { blob: Blob|Uint8Array }
  let currentOffset = HEADER_SIZE + DESC_BYTES.length

  // Existing images — zero-copy via file.slice()
  for (const [id, entry] of Object.entries(existingImages)) {
    imageEntries[id] = { offset: currentOffset, size: entry.size }
    imageWriteOps.push(oldFile.slice(entry.offset, entry.offset + entry.size))
    currentOffset += entry.size
  }

  // New images — raw bytes from memory
  for (const [id, data] of Object.entries(newImages)) {
    imageEntries[id] = { offset: currentOffset, size: data.byteLength }
    imageWriteOps.push(data)
    currentOffset += data.byteLength
  }

  // 2. Compress index + metadata (both small)
  const indexGz = await compressImageIndex(imageEntries)
  const metaGz = await compressMetadata(files)

  const indexOffset = currentOffset
  const indexSize = indexGz.byteLength
  const metaOffset = indexOffset + indexSize
  const metaSize = metaGz.byteLength

  // 3. Build header with final offsets
  const header = writeHeader({
    version: FORMAT_VERSION,
    flags: 0,
    metaOffset,
    metaSize,
    indexOffset,
    indexSize,
  })

  // 4. Write sequentially
  const writable = await fileHandle.createWritable()
  await writable.write(header)
  await writable.write(DESC_BYTES)
  for (const blob of imageWriteOps) {
    await writable.write(blob)
  }
  await writable.write(indexGz)
  await writable.write(metaGz)
  await writable.close()

  return { imageIndex: imageEntries }
}
