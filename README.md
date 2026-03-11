# file-meta

[中文文档](./README_zh.md)

A browser-based tool for annotating local files with Markdown. Similar to TagSpaces, but more lightweight — designed for quick, casual notes.

## What it does

Pick a local folder and the app displays its file tree on the left. Click any file to write Markdown annotations on the right. Paste or drag images in and they get compressed automatically into tiny AVIF files. All annotations and images are packed into a single `.annotations.pb.gz` file at the folder root. The data is machine-independent — as long as the file names stay the same, moving, sharing, or backing up the folder won't lose a single annotation.

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
- Default database filename is `.annotations.pb.gz`
- Fully customizable: the name and extension are entered separately, with `.pb.gz` as the default extension; a custom extension is also supported
- The chosen filename is persisted in IndexedDB and restored automatically the next time the same folder is opened
- When opening a folder, any `.pb.gz` file found at the root is detected and loaded automatically — no manual selection needed

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
- **Storage format**: Protocol Buffers + gzip. The schema is minimal:

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

- **History**: Folder handles and database filenames are stored in IndexedDB so you can reopen recent folders from the history list without going through the folder picker again.

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
- protobufjs + native CompressionStream (gzip)
- vue-i18n (Chinese / English)
- Tailwind CSS + PrimeIcons
