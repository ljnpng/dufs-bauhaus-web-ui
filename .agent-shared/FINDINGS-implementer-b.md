# Implementer B findings

状态：完成。未修改 A 的文件；未 commit / push。

## 交付文件

```text
styles/mobile.css             mobile 独立布局（<640px）
styles/overlays.css           menu / dialog / toast / upload / empty / fatal
js/mobile.js                  renderMobileIndex
js/overlays.js                createUiServices + createIcon + ensureSprite + renderEmptyState
icons/actions.svg             action sprite（28 个 symbol）
icons/folder-*.svg            empty / non-empty / empty-hidden / non-empty-hidden
icons/file-*.svg              generic + txt/md/json/js/py/java/pdf/zip/image
icons/symlink-badge.svg
icons/LICENSE.md              original 声明 + Lucide ISC 参考
```

## 与 A 的接口对齐（已按 A 当前实现调整，未改 A 文件）

1. **Action sprite 用无前缀 symbol id**：`home`、`folder`、`upload` …。`createIcon(name)` 生成同文档 `<use href="#name">`；`ensureSprite()` 在首次 UI 初始化时把 `icons/actions.svg` 注入隐藏容器一次，避免 Safari 外部 fragment 问题。A 的 `desktop.js` 现已 `import { createIcon, renderEmptyState }`，与本实现一致。
2. **隐藏目录资产名**遵循 A 的 `iconName(item) + "-hidden"`：`folder-empty-hidden.svg`、`folder-non-empty-hidden.svg`（不是 `folder-hidden-*`）。
3. `ui.menu(anchor, items)` 返回 **Promise**，菜单关闭时 resolve（A 的 `openRowMenu` 依赖 thenable）。
4. `ui.confirm` / `ui.prompt` 同时接受 `confirmLabel` / `cancelLabel` 与 `confirmText` / `cancelText`。
5. 冻结接口之外新增的非破坏性扩展：
   - `ui.empty(options) -> Node`：A 的 desktop fallback 使用；按 `variant` 映射 `empty/search/missing`。
   - `ui.emptyState(container, spec)`：带动作按钮的版本，A 现用。
   - `ui.error(options)`：统一错误 dialog（toast/menu 失败用；错误正文做去 HTML/截断）。
   - `ui.onUploadUpdate(items)` / `ui.setUploadQueue(queue)`：A 的 `createUploadQueue.onUpdate` 会喂数据；`showUploadQueue()` 无参时用 `context.uploadQueue`（A 现在把完整 context 传给 `createUiServices`）。
   - `ui.closeMenu()`。
6. `showUploadQueue(queue?)` 可选入参；内部用 `queue.getItems()`（A 的实现）+ `queue.subscribe()`，retry 调 `queue.retry(id)`，不自行 fetch。

### Empty state spec（对 A）

```js
ui.emptyState(container, {
  kind: 'empty' | 'search' | 'pending' | 'error',
  query, capabilities,
  title, message,
  onUpload, onCreateFolder, onNewFile, onClearSearch,
});
```

`kind='empty'|'pending'` 且 `capabilities.upload` 时渲染 Upload/New folder/New file（有对应 handler 才渲染）；`kind='search'` 渲染 Clear search。文字一律 `textContent`。

## 行为决策

- 移动端整行主点击与桌面 name 链接一致：目录补 `/`，文件用原始 entry URL（不是 `?view`）；View 在 context menu（eye 图标）里。如果协调者希望文件主点击进 `?view`，改 `renderRow` 一行即可。
- Context menu 门控：目录不出现 Copy；目录下载受 `archive`；View 始终对文件可见；Edit 受 `edit`；Rename/Move 受 `move`；Delete 受 `remove`。无权限项不渲染。
- 隐藏文件没有独立资产，用 CSS 虚线轮廓 `.entry-icon--hidden`；隐藏目录用 dashed 资产。
- 覆盖确认：move/copy 前 `api.head` 200 时 `ui.confirm`（与 A 一致）。
- mutation 成功统一 reload。

## 验证（Python 静态复现 + Playwright Chromium，非真实 dufs）

- 320 / 375 / 430px：无横向滚动；100/200/…/430 已测。
- 7 行 fixture：图标映射正确（含 `.cache` → `folder-empty-hidden`、symlink badge、space/`#`/`?`/Unicode、zip/image/txt/md/json）。
- context menu：文件 `Download,View,Edit,Rename/Move,Copy,Delete`；目录 `Download as zip,Rename/Move,Delete`；无权限仅 `Download,View`。
- FAB 展开 Upload/New folder/New file；无 upload 能力时 FAB 不渲染，底部三栏仍居中。
- dialog：New folder prompt 打开/关闭、Escape、焦点归还正常。
- 上传状态：queued→running→failed→Retry；Retry 重新走 queue（`Failed - HTTP 501`，不发自己的请求）。
- 空态：空目录 / 搜索无结果 / `dir_exists=false` 三种几何插画（仅 token 色），动作按钮正确。
- 控制台无 error；无 404 / requestfailed；`#dufs-icon-sprite` 注入成功。
- desktop 1280px 与 tablet 900px 正常，mobile-view 在 >=640px 隐藏。

## 剩余风险 / 待联合验收

- B 未跑真实 dufs；`PATCH X-Update-Range`、MOVE/COPY/MKCOL 的真实行为需按 HANDOFF 真实 dufs 清单验证。
- 移动端 `pending`（`dir_exists=false`）文案用 B 默认 `This folder is not on disk yet.`；desktop 用 A 的 `Folder not found`。若需一致，A 给 `emptyState` 传 `title/message`（desktop 已传）。
- 桌面空态现在也带 Upload/New folder/New file（A 传了 handler），属预期，非重复 bug。
- `?ui=0.1.0` 版本串已随 `assetUrl` 生效，图标无 404；真实 dufs 的 immutable cache 仍待验证。

## 变更请求

冻结接口无需变更。仅建议协调者确认：文件主点击是否改为 `?view`。
