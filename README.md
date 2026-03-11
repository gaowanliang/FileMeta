# file-meta

[中文文档](./README_zh.md)

A browser-based tool for annotating local files with Markdown. Similar to TagSpaces, but more lightweight — designed for quick, casual notes.

## What it does

Pick a local folder and the app displays its file tree on the left. Click any file to write Markdown annotations on the right. Paste or drag images in and they get compressed automatically into tiny AVIF files. All annotations and images are packed into a single `.annotations.fmdb` file at the folder root. The data is machine-independent — as long as the file names stay the same, moving, sharing, or backing up the folder won't lose a single annotation.

## Features

### File Annotation
- File tree on the left; click any file to start annotating with Markdown
- Annotated files are marked with a bookmark icon
- Search/filter files by name
- Sidebar width is draggable

### Image Support
- Paste or drag-and-drop images directly into the editor
- Automatically compressed via a WASM AVIF encoder; a 4 MB PNG typically becomes 50–150 KB
- Images are embedded inline as `local-avif://<uuid>` — no external dependencies

### Database File Management
- Default database filename is `.annotations.fmdb`
- Fully customizable: the name and extension are entered separately, with `.fmdb` as the default extension; `.pb.gz` (legacy format) and custom extensions are also supported
- The chosen filename is persisted in IndexedDB and restored automatically the next time the same folder is opened
- When opening a folder, `.fmdb` and `.pb.gz` files at the root are detected and loaded automatically (`.fmdb` takes priority) — no manual selection needed
- Legacy `.pb.gz` files are automatically migrated to the new format on the first save

### Orphan Annotation Manager
- When a file that has an annotation gets deleted or moved, the annotation is not lost — it becomes an "orphan"
- A warning button appears in the header showing the orphan count
- Clicking it opens a dedicated full-page manager: orphans are listed on the left, and a full Milkdown editor on the right lets you keep editing them
- Orphans can be reassigned to any existing file in the tree, or deleted

### Settings
Click the gear icon in the top-right to open the settings page. The following options are available:

| Category | Option | Description |
|----------|--------|-------------|
| Appearance | Dark Mode | Toggle between light and dark themes |
| Appearance | Language | Chinese / English |
| Editor | Auto-save delay | How long after you stop typing before saving. Can be disabled for manual-save only. |
| Images | Compression quality | AVIF encoding quality: Low / Medium / High / Best |
| Images | Max dimension | Scale images down before compression (720px – 1920px, or no limit) |

All settings are saved to `localStorage` and persist across page reloads.

## How it works

- **File access**: Uses the browser-native [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API). Entirely local — no server involved.
- **Image compression**: Web Worker + WASM AVIF encoder, running off the main thread so the UI stays responsive.
- **Storage format**: A custom binary container format called FMDB. Text annotations and image data are stored in separate sections within a single file.

### FMDB Container Format

The file consists of four sections laid out sequentially:

```
┌────────────────────────────────────┐
│ Header (32 bytes, fixed)           │
│  Magic "FMDB"     4 bytes         │
│  Version          2 bytes uint16LE │
│  Flags            2 bytes uint16LE │
│  Meta offset      4 bytes uint32LE │
│  Meta size        4 bytes uint32LE │
│  Index offset     4 bytes uint32LE │
│  Index size       4 bytes uint32LE │
│  Reserved         8 bytes          │
├────────────────────────────────────┤
│ Image Data                         │
│  Raw AVIF binaries, concatenated   │
├────────────────────────────────────┤
│ Image Index (gzip + Protobuf)      │
│  Image ID → {offset, size}        │
├────────────────────────────────────┤
│ Metadata (gzip + Protobuf)         │
│  File path → Markdown annotation   │
└────────────────────────────────────┘
```

This design brings three benefits:

1. **Fast open**: Only the header + metadata + index need to be read (typically a few KB). No image data is loaded into memory.
2. **On-demand image loading**: An image is only fetched via `File.slice()` when it needs to be displayed, then cached as a Blob URL.
3. **Fast save**: When text annotations change, image data is passed directly from the old file to the write stream via `File.slice()` — it never enters JavaScript memory. Only the metadata and index need to be re-encoded (KB-level).

The index and metadata sections are serialized with Protobuf and then gzip-compressed (plain text and integers compress well). Image data is stored as raw AVIF bytes (AVIF is already a high-compression format; gzip on top provides virtually no benefit).

The corresponding Protobuf schema:

```protobuf
message FileAnnotation {
  string markdown_content = 1;
  int64 updated_at = 2;
}

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
```

- **History**: Folder handles and database filenames are stored in IndexedDB so you can reopen recent folders from the history list without going through the folder picker again.
- **Backward compatibility**: Legacy `.pb.gz` files are automatically detected and read when opened; they are migrated to FMDB format on the first save.

## Browser support

Requires a Chromium-based browser (Chrome, Edge, Brave, Arc, etc.). The File System Access API is currently only supported by Chromium; Firefox and Safari are not compatible.

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
- [Milkdown](https://milkdown.dev/) (Markdown editor built on ProseMirror)
- [@jsquash/avif](https://github.com/nicktomlin/jsquash) (WASM AVIF encoder)
- protobufjs + native CompressionStream
- Custom FMDB binary container format
- vue-i18n (Chinese / English)
- Tailwind CSS + PrimeIcons
