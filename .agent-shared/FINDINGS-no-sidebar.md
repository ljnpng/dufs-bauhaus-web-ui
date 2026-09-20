# FINDINGS — no-sidebar（implementer）

状态：完成并 commit（未 push）。工作树仅本工作流产物。

## Commits

| hash | type | 内容 |
|---|---|---|
| `f67f16a` | feat | remove desktop sidebar for full-width file table（`js/desktop.js`、`styles/desktop.css`） |
| （见本次 docs commit） | docs | 本文件 + `.agent-shared/DECISIONS.md` |

`index.html` 无改动（本来就没有 sidebar/statusbar 挂载点，见 §3）。

## 1. 最终产物变更

| 文件 | 变更 |
|---|---|
| `js/desktop.js` | 删除 `renderSidebar()`（aside brand/nav/目录列表/Storage）。桌面 index 不再挂侧栏，`renderDesktopIndex` 现为单栏 `desktop-shell > desktop-main(toolbar+content)`。后续用户决定再删除 statusbar，故最终**无** `renderStatusBar`、无 `Storage` 文案。toolbar/breadcrumb/search/sort/table/row menu/empty/editor 逻辑零改动。 |
| `styles/desktop.css` | 删除 640px 内 `.desktop-sidebar`、整个 `>=1024px` 侧栏块、以及过渡期的 `.desktop-statusbar` 样式。`.desktop-shell` 为单栏 `flex-direction:column` 100vh 全宽。 |
| `index.html` | 未改。 |
| `.agent-shared/DECISIONS.md` | 由协调者维护，本次仅原样提交（见 §6 提醒）。 |

## 2. 用户两轮决定

1. 桌面端 sidebar（>=1024px、232px、含目录列表）整体删除，主表区全宽单栏；tablet/mobile 行为不变。
2. 因无存储容量数据，过渡期加在表格下方的 Storage statusbar 也整体删除（`Storage unavailable` 不再出现在产品中）。

## 3. index.html 说明

全仓确认 `index.html` 从未有 sidebar/statusbar 挂载点：侧栏完全由 `renderSidebar()` 在 `#desktop-view` 内动态生成。因此“删挂载点”无对象可删，未改该文件。真实 dufs 的 index.html 内容未变。

## 4. 验证

- `node --check`：`app.js`、`js/core.js`、`js/desktop.js`、`js/mobile.js`、`js/overlays.js` 全 OK。
- 静态冒烟（`python3 -m http.server` + fixture，Playwright 驱动系统 Chrome）：1440/768/375 × {Index 3 条, 空目录, Edit, View, Edit+!editable}，11 次渲染 **ALL PASS**：
  - `.desktop-sidebar` / `.desktop-statusbar` DOM 均为 0；`body.textContent` 无 `Storage`；无 `.fatal`。
  - Index 全宽：1440/768 时 `.desktop-main` 宽 = 视口宽；无横向滚动。
  - 空目录标题 `This folder is empty`；Edit textarea 可编辑 + Save；View readonly 无 Save；不可编辑显示 `Editing unavailable`。
  - console error 0、pageerror 0、HTTP>=400 0、requestfailed 0，server log 无 404。
- 线上 8090（dufs `--assets $PWD`, prefix `/__dufs_v0.46.0__/`）：`curl` 取回的 `js/desktop.js` 与 `styles/desktop.css` 与工作树 **逐字节相同**，且 `renderSidebar`/`renderStatusBar`/`Storage unavailable` 计数均为 0。dufs 启动时只缓存 index.html，JS/CSS 按请求读盘，故无需重启即已生效。根路径需带浏览器 `Accept` 才返回自定义 UI（否则是 dufs noscript 列表），这是 dufs 既有行为。
- `rg --hidden`：产品文件中 `statusbar`/`Storage`/`storage` 零命中；`sidebar` 仅剩 `styles/tokens.css:52 --size-sidebar`（死 token，见 §5）；其余命中都在 `.agent-shared/` 文档内。
- 无 secrets，无 `../dufs/` 改动，未 push。

## 5. 残留 / 待办

- `styles/tokens.css:52 --size-sidebar: 14.5rem;` 现为无引用死 token。tokens.css 不在本实现者可写范围，未删；建议后续清理。
- `styles/mobile.css` 的 `.mobile-brand` 等移动端品牌元素与 sidebar 无关，保持不动。

## 6. 需协调者注意

`.agent-shared/DECISIONS.md` 第 122 行仍写“Storage 指示器移到表格下方 36px slim statusbar（>=1024px 显示）”，与第二轮“删除 statusbar”决定冲突。按指示未改该文件，请协调者更新。
