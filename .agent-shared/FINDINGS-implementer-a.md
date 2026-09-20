# Implementer A findings

状态：A 工作项完成。未 commit / push，未修改 `../dufs/`。

## 交付文件（A 独占）

```text
index.html
index.css
app.js
favicon.ico
styles/tokens.css
styles/base.css
styles/desktop.css
js/core.js
js/desktop.js
```

## 实现要点

- `index.html`：保留 `__ASSETS_PREFIX__` / `__INDEX_DATA__`（均含于会被服务端全局替换的位置）；挂载点 `#app`、`#desktop-view`、`#mobile-view`、`#overlay-root`、`#toast-root`、`#index-data`；`<noscript>` meta refresh 到 `?noscript` + 文本兜底；入口 CSS/JS 带 `?ui=0.1.0`。
- token：`styles/tokens.css` 完整落地 DECISIONS 第 1–8 节 + Motion/Z-index/Density；组件 CSS 无重复 magic value（已脚本校验 `var()` 全部存在于 tokens）。
- `js/core.js` 导出冻结接口，另导 `UI_VERSION`。DATA 用 `atob` + `TextDecoder('utf-8')` 解码；`kind` 仅 `Index|Edit|View`，否则失败关闭。URL 逐段 `encodeURIComponent`，兼容非根 `uri_prefix`、空格、`#`、`?`、Unicode。`api` 方法齐全；`logout` 用 XHR 保留 username；`downloadUrl` 登录时先 `?tokengen` 再 `?token=`。上传队列单并发，首次 PUT，retry 先 HEAD（=size 完成 / >size 覆盖确认后 PUT / 0<offset<size 用 PATCH append / 404 PUT），有 pending 时注册 `beforeunload`。
- `js/desktop.js`：>=640 表格（232px sidebar 仅 >=1024）、56px toolbar、breadcrumb（根固定 `uri_prefix`）、search `?q=`、sort 只改 `sort/order` 保留 `q`、44px 行、row action menu、selected 行、`Storage unavailable`、empty/pending/search 空态走 B 的空态服务。
- `app.js`：解析 DATA 一次 → 建 `ui` services 与 uploadQueue → context → kind dispatch；Index 同时渲染 desktop + mobile（CSS 断点显隐）；Edit/View 共享 editor shell，mobile 置空。
- Edit/View：文本 `textarea`；`View` 强制 readonly；仅 `Edit && editable && caps.edit`（upload&&delete）显示 Save；保存 PUT 后检查响应再 reload；`editable=false` 的 pdf/image/audio/video 用 `sandbox=""` iframe，其他显示说明 + Download；读取原始文件用无 query 的 `baseUrl()`。

## 与 B 的接口协调（重要）

1. **JS 版本查询串必须一致，否则 core 会双实例（DATA 分裂）。**
   - A 与 B 的 `mobile.js` 目前都用 `./core.js?ui=0.1.0`、`./overlays.js?ui=0.1.0`，共享同一 core 实例。
   - 但 `js/overlays.js` 第 1 行是 `import { assetUrl } from './core.js'`（**无** query），会再加载一份 core。当前无害：overlays 只用到无状态的 `assetUrl`。若 overlays 以后要用 `DATA` / `capabilities` / `joinAbsolutePath`，必须改成 `./core.js?ui=0.1.0`，否则读到的是 DATA 未初始化的副本。
2. `createUiServices(root, context)`：A 传 `root = #overlay-root`，并在创建 ui 之前先建 uploadQueue、以可变 context 传入（B 会缓存 `context.uploadQueue`）。`context` 形状：`{ data, query, capabilities, api, uploadQueue, ui }`，`ui` 在创建后回填。
3. A 实际调用的 `ui` 方法：`menu(anchor, items)`、`prompt(options)`、`confirm(options)`、`showUploadQueue()`、`showFatal(error)`、`emptyState(container, spec)`；并直接 import `createIcon`、`renderEmptyState`。B 的 menu 返回 Promise（关闭时 resolve），A 用它清理 selected 行。
4. **上传队列契约**：B 的 `queueSnapshot` 支持 `snapshot()/items/getItems()`，`subscribeQueue` 支持 `subscribe(cb)`。A 提供 `getItems()` 与 `subscribe(cb)->unsub`。item 字段同时提供 `size/total`、`uploaded/loaded`、`progress(0..1)`、`status(queued|running|complete|failed)`、`error`、`id`、`name`，以匹配 B 的进度条与 Retry。
5. **图标引用**：
   - action 图标走 B 的 `createIcon`（sprite symbol `#icon-*`）。
   - 条目图标 A 用 `<img src="assetUrl('icons/<name>.svg')">`；目录 hidden 变体为 `<base>-hidden`（`folder-empty-hidden` / `folder-non-empty-hidden`）。B 在 14:32 前后把命名从 `folder-hidden-*` 改为 `folder-empty-hidden`，A 按 `<base>-hidden`。若 B 再改命名，请同步。
   - 仅有目录 hidden 变体；点开头的文件保持 base 图标（B 未提供 `file-*-hidden`），避免 404。
6. **缓存（R3）**：入口 `index.css`/`app.js` 与动态 `assetUrl` 带 `?ui=0.1.0`，JS 嵌套 import 也统一带 query（overlays 的 core 除外，见 1）。同 dufs 版本下替换文件仍可能被 immutable 缓存，属已接受限制。

## 空壳占位说明

14:30 左右 A 在 B 文件缺失时创建过 `styles/mobile.css`、`styles/overlays.css`、`js/mobile.js`、`js/overlays.js` 的最小空壳以保证 lint/import。B 随后已重写这四个文件（当前为 B 实现），A 之后未再改动它们。若 B 的早期版本曾被覆盖，请复查。

## 已验证

- `node --check`：`app.js`、`js/core.js`、`js/desktop.js`、`js/mobile.js`、`js/overlays.js` 全部通过。
- ES module 图：`app.js` → core/desktop/mobile/overlays 解析成功，`UI_VERSION` 一致。
- token 引用：`tokens/base/desktop.css` 中所有 `var(--*)` 均在 tokens.css 定义；CSS import 目标齐全。
- core 单元冒烟：Unicode/空格/`#`/`?` 编码、`uri_prefix=/files/`、`mtime=0 → —`、dir item 文案、1024 进制 size、iconName、capabilities、queue 方法。
- Playwright + `python3 -m http.server` 静态复现（fixture 替换占位符）：
  - 1440px：7 行渲染、sidebar 可见、`Storage unavailable`、`a#b?c.txt` → `/a%23b%3Fc.txt`、hidden 目录图标加载成功、无 404/console error。
  - 768px：sidebar 隐藏、table 可见。
  - 375px：desktop 隐藏、mobile 可见（B 视图），无 404/console error。
  - 空目录 `uri_prefix=/files/`：root breadcrumb=`/files/`，空态标题与 Upload/New folder/New file 按钮来自 B。
  - Edit：editor mode、textarea、Save 可见且加载后启用、Download 可见。
  - View：无 Save、iframe preview `sandbox=""`。
  - 排序点击导航 `/?sort=size&order=asc`；行 menu 打开/选中/Escape 清理正常。
- 静态扫描：A 文件无 CDN、无 `http(s)://` 外链、无硬编码 `__dufs_v`。

## 未覆盖 / 需真实 dufs 验证

- CHECKAUTH/LOGOUT/MKCOL/MOVE/COPY/PATCH 与 `Destination` 的代理/认证行为（静态复现不能证明）。
- `?ui=0.1.0` 查询在 dufs immutable 资源下不影响文件解析（契约推断 query 被 strip）。
- 登录态 `?tokengen`→`?token=` 下载链路。
- `--path-prefix files` 下 breadcrumb/upload/Destination/logout 保留前缀。
