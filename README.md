# file-meta

[中文文档](./README_zh.md)

A browser-based tool for annotating files in local folders. No server, no account, no upload — everything stays on your machine. It's similar to TagSpaces but more lightweight, intended for simple, light-weight annotations.

## What it does

You pick a local folder, and the app shows its file tree. Click any file and write Markdown notes about it. Paste or drag images in — they get compressed to tiny AVIF files automatically. All your annotations and images are packed into a single `.annotations.pb.gz` file at the folder root. Move the folder, share it, back it up — the annotations travel with it. Annotations are not tied to a particular machine — as long as file names remain unchanged, moving, sharing, or backing up the folder won't affect the annotations.

## How it works

- **File access** happens through the browser's [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API). No server involved.
- **Images** are compressed client-side using a WASM-based AVIF encoder. A 4MB PNG typically becomes 50–150KB. They're stored inline in the database, referenced as `local-avif://<uuid>` in Markdown.
- **Storage format** is Protocol Buffers + gzip. The schema is simple:

```protobuf
message FileAnnotation {
  string markdown_content = 1;
  int64 updated_at = 2;
}

message WorkspaceDB {
  map<string, FileAnnotation> files = 1;   // path → annotation
  map<string, bytes> images = 2;           // uuid → AVIF binary
}
```

- **Auto-save** kicks in 3 seconds after you stop typing. Manual save is also available.
- **Recent folders** are remembered via IndexedDB so you can reopen them without the folder picker.

## Browser support

Requires a Chromium-based browser (Chrome, Edge, Brave, Arc, etc.) because the File System Access API is only supported by these browsers; Firefox and Safari do not support `showDirectoryPicker`.

## Setup

```sh
npm install
npm run dev
```

Build for production:

```sh
npm run build
```

## Tech stack

- Vue 3 + Vite + Pinia
- [Milkdown](https://milkdown.dev/) (Markdown editor, built on ProseMirror)
- [@jsquash/avif](https://github.com/nicktomlin/jsquash) (WASM AVIF encoder)
- protobufjs + native CompressionStream (gzip)
- vue-i18n (English / Chinese)
- Tailwind CSS + PrimeIcons
