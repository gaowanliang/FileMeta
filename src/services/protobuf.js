import protobuf from 'protobufjs'

const protoSchema = `
syntax = "proto3";

message FileAnnotation {
  string markdown_content = 1;
  int64 updated_at = 2;
}

message WorkspaceDB {
  map<string, FileAnnotation> files = 1;
  map<string, bytes> images = 2;
}
`

let WorkspaceDBType = null

function getType() {
  if (WorkspaceDBType) return WorkspaceDBType
  const root = protobuf.parse(protoSchema).root
  WorkspaceDBType = root.lookupType('WorkspaceDB')
  return WorkspaceDBType
}

export function encode(data) {
  const T = getType()
  const msg = T.create(data)
  return T.encode(msg).finish()
}

export function decode(buffer) {
  const T = getType()
  const msg = T.decode(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))
  return T.toObject(msg, {
    longs: Number,
    bytes: Uint8Array,
    defaults: true,
  })
}

export async function compress(data) {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function decompress(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodeAndCompress(dbData) {
  const encoded = encode(dbData)
  return compress(encoded)
}

export async function decompressAndDecode(gzData) {
  const decompressed = await decompress(gzData)
  return decode(decompressed)
}
