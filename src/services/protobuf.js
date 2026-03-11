import protobuf from 'protobufjs'

const protoSchema = `
syntax = "proto3";

message FileAnnotation {
  string markdown_content = 1;
  int64 updated_at = 2;
}

// Legacy format (v0, no container)
message WorkspaceDB {
  map<string, FileAnnotation> files = 1;
  map<string, bytes> images = 2;
}

// FMDB container sections
message MetadataDB {
  map<string, FileAnnotation> files = 1;
}

message ImageEntry {
  uint32 offset = 1;
  uint32 size = 2;
}

message ImageIndex {
  map<string, ImageEntry> entries = 1;
}
`

const DECODE_OPTS = {
  longs: Number,
  bytes: Uint8Array,
  defaults: true,
}

let typesCache = null

function getTypes() {
  if (typesCache) return typesCache
  const root = protobuf.parse(protoSchema).root
  typesCache = {
    WorkspaceDB: root.lookupType('WorkspaceDB'),
    MetadataDB: root.lookupType('MetadataDB'),
    ImageIndex: root.lookupType('ImageIndex'),
  }
  return typesCache
}

function ensureUint8Array(buffer) {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
}

// ── Legacy WorkspaceDB encode/decode ────────────────────────

export function encode(data) {
  const T = getTypes().WorkspaceDB
  const msg = T.create(data)
  return T.encode(msg).finish()
}

export function decode(buffer) {
  const T = getTypes().WorkspaceDB
  const msg = T.decode(ensureUint8Array(buffer))
  return T.toObject(msg, DECODE_OPTS)
}

// ── MetadataDB encode/decode ────────────────────────────────

export function encodeMetadata(data) {
  const T = getTypes().MetadataDB
  const msg = T.create(data)
  return T.encode(msg).finish()
}

export function decodeMetadata(buffer) {
  const T = getTypes().MetadataDB
  const msg = T.decode(ensureUint8Array(buffer))
  return T.toObject(msg, DECODE_OPTS)
}

// ── ImageIndex encode/decode ────────────────────────────────

export function encodeImageIndex(data) {
  const T = getTypes().ImageIndex
  const msg = T.create(data)
  return T.encode(msg).finish()
}

export function decodeImageIndex(buffer) {
  const T = getTypes().ImageIndex
  const msg = T.decode(ensureUint8Array(buffer))
  return T.toObject(msg, DECODE_OPTS)
}

// ── Gzip compress/decompress ────────────────────────────────

export async function compress(data) {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function decompress(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// ── Combined helpers ────────────────────────────────────────

// Legacy
export async function encodeAndCompress(dbData) {
  const encoded = encode(dbData)
  return compress(encoded)
}

export async function decompressAndDecode(gzData) {
  const decompressed = await decompress(gzData)
  return decode(decompressed)
}

// FMDB sections
export async function compressMetadata(filesObj) {
  const encoded = encodeMetadata({ files: filesObj })
  return compress(encoded)
}

export async function decompressMetadata(gzData) {
  const raw = await decompress(gzData)
  return decodeMetadata(raw)
}

export async function compressImageIndex(entriesObj) {
  const encoded = encodeImageIndex({ entries: entriesObj })
  return compress(encoded)
}

export async function decompressImageIndex(gzData) {
  const raw = await decompress(gzData)
  return decodeImageIndex(raw)
}
