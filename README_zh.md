# file-meta

[English](./README.md)

一个纯浏览器端的本地文件标注工具。类似于TagSpaces，但是更加轻量化，适合轻度简单标注。

## 它能做什么

选一个本地文件夹，应用会展示里面的文件树。点击任意文件就能用 Markdown 写备注。粘贴或拖入图片会自动压缩成很小的 AVIF 格式。所有标注和图片最终打包进文件夹根目录的一个 `.annotations.pb.gz` 文件里。且不受电脑影响，只要保证文件名不变。移动、分享、备份这个文件夹不会影响标注。

## 工作原理

- **文件访问**用的是浏览器原生的 [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)，不经过任何服务器。
- **图片压缩**在浏览器端通过 WASM 的 AVIF 编码器完成。一张 4MB 的 PNG 通常能压到 50–150KB，直接嵌入数据库，在 Markdown 里用 `local-avif://<uuid>` 引用。
- **存储格式**是 Protocol Buffers + gzip，结构很简单：

```protobuf
message FileAnnotation {
  string markdown_content = 1;
  int64 updated_at = 2;
}

message WorkspaceDB {
  map<string, FileAnnotation> files = 1;   // 文件路径 → 标注
  map<string, bytes> images = 2;           // uuid → AVIF 二进制
}
```

- **自动保存**会在停止输入 3 秒后触发，也可以手动保存。
- **最近文件夹**记录在 IndexedDB 里，下次可以直接打开，不用重新选。

## 浏览器要求

需要 Chromium 内核的浏览器（Chrome、Edge、Brave、Arc 等），因为 File System Access API 只有这些浏览器支持。Firefox 和 Safari 不行。

## 开始使用

```sh
npm install
npm run dev
```

构建生产版本：

```sh
npm run build
```

## 技术栈

- Vue 3 + Vite + Pinia
- [Milkdown](https://milkdown.dev/)（Markdown 编辑器，基于 ProseMirror）
- [@jsquash/avif](https://github.com/nicktomlin/jsquash)（WASM AVIF 编码器）
- protobufjs + 原生 CompressionStream（gzip）
- vue-i18n（中英双语）
- Tailwind CSS + PrimeIcons
