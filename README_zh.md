# file-meta

[English](./README.md)

一个纯浏览器端的本地文件标注工具。类似于 TagSpaces，但更轻量，适合平时给文件随手写点备注。

## 它能做什么

选一个本地文件夹，应用会把里面的文件树展示在左侧。点击任意文件，就能在右侧用 Markdown 写标注。粘贴或拖入图片会自动压缩成体积极小的 AVIF 格式。所有标注和图片都打包进文件夹根目录的一个 `.annotations.pb.gz` 文件里，和机器无关——只要文件名不变，移动、分享、备份这个文件夹都不会丢失任何标注。

## 主要功能

### 文件标注
- 左侧文件树，点击文件即可开始写 Markdown 标注
- 已标注的文件会有书签图标提示
- 支持文件夹内搜索过滤
- 侧边栏宽度可拖拽调整

### 图片支持
- 粘贴或拖拽图片直接插入编辑器
- 自动通过 WASM AVIF 编码器压缩，一张 4MB 的 PNG 通常能压到 50–150KB
- 图片以 `local-avif://<uuid>` 形式内嵌于数据库，无外部依赖

### 数据库文件管理
- 默认数据库文件名为 `.annotations.pb.gz`
- 可自定义文件名：文件名与后缀分开输入，后缀默认为 `.pb.gz`，也支持自定义后缀
- 文件名设置会自动记录在 IndexedDB 中，下次打开同一文件夹时自动还原
- 打开文件夹时，会自动识别根目录中任意 `.pb.gz` 文件并载入，无需手动指定

### 孤儿文档管理
- 当标注所对应的源文件被删除或移走后，这些标注不会丢失，而是被标记为"孤儿文档"
- 顶部导航栏会出现警告按钮，标明孤儿数量
- 点击后进入专属管理页面：左侧列出所有孤儿，右侧提供完整的 Milkdown 编辑器，可以继续编辑
- 支持将孤儿标注重新分配给现有文件，或直接删除

### 设置
通过右上角的齿轮按钮可进入设置页面，支持以下自定义选项：

| 分类 | 选项 | 说明 |
|------|------|------|
| 外观 | 深色模式 | 切换亮色/暗色主题 |
| 外观 | 语言 | 中文 / English |
| 编辑器 | 自动保存延迟 | 停止输入后多久自动保存，可关闭（仅手动保存） |
| 图片处理 | 压缩质量 | AVIF 编码质量：低 / 中 / 高 / 最佳 |
| 图片处理 | 最大尺寸 | 压缩前的缩放上限（720px ~ 1920px，或不限制） |

所有设置保存在 `localStorage` 中，刷新页面不丢失。

## 工作原理

- **文件访问**：浏览器原生的 [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)，完全本地，不经过任何服务器。
- **图片压缩**：Web Worker + WASM AVIF 编码器，在后台线程完成，不阻塞 UI。
- **存储格式**：Protocol Buffers + gzip，结构极简：

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

- **历史记录**：文件夹句柄和数据库文件名记录在 IndexedDB，下次可直接从历史列表重新打开，无需重新选择。

## 浏览器要求

需要 Chromium 内核的浏览器（Chrome、Edge、Brave、Arc 等）。File System Access API 目前仅 Chromium 支持，Firefox 和 Safari 不兼容。

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
- [Milkdown](https://milkdown.dev/)（基于 ProseMirror 的 Markdown 编辑器）
- [@jsquash/avif](https://github.com/nicktomlin/jsquash)（WASM AVIF 编码器）
- protobufjs + 原生 CompressionStream（gzip）
- vue-i18n（中英双语）
- Tailwind CSS + PrimeIcons
