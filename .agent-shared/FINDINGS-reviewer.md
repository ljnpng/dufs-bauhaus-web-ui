# Reviewer findings（无行为变化的简化）

状态：完成。只改本工作树 untracked 产物（`app.js` 未动，`index.html`/`index.css`/`favicon.ico`/`icons/*` 未动）；
未改 `../dufs/`、未改 DECISIONS 契约与需求、未放宽任何期望、未 commit/push。
每次 JS 编辑后均 `node --check` 全过；静态冒烟全绿（见 §3）。

## 1. 已做的修改（均为删除冗余/去重，无行为变化）

| # | 文件 | 修改 | 无行为变化的理由 |
|---|---|---|---|
| R1 | `js/desktop.js` | 新增本地 `uriRoot(data)`，替换 `renderBreadcrumb`/`renderSidebar` 内两处逐字相同的 prefix 三元表达式 | 纯提取，表达式逐字一致 |
| R2 | `js/desktop.js` | 删除 `actionIcon(name)` 单行包装，调用处直接用已 import 的 `createIcon` | 包装函数体就是 `return createIcon(name)` |
| R3 | `js/desktop.js` | `buildQueryUrl` 去掉 `new URL(baseUrl(), origin)` 绕路，直接用 `baseUrl()` 拼 query | `baseUrl()` 即 `location.pathname`，`new URL(...).pathname` 与其恒等（浏览器已规范化） |
| R4 | `js/mobile.js` | 删除本地 `actionIcon` 自实现 + `SVG_NS`，改为 `import { createIcon }`（与 desktop 共用 `overlays.js` 实现），调用处 `actionIcon(` → `createIcon(` | 输出同为 `class="icon"` + `use href="#name"` 的 SVG；新实现多一个无视觉影响的 `focusable="false"`，顺手消除了两处 icon 实现分叉 |
| R5 | `js/overlays.js` | `el()` 删除 `html`/`dataset`/`style`/`on*` 四个死分支 | 全仓 `el(` 调用点只用 `class/text` + 普通属性 + `value===true` 布尔属性（`hidden`/`novalidate`），无一处传死分支 key |
| R6 | `js/overlays.js` | `queueItemsFrom` 删除 `queue.snapshot()` / `queue.items` 两个死分支，保留 `getItems` + `Array` | 唯一生产者是 core queue（有 `getItems`）；两处 `showUploadQueue` 调用均传 core queue 或空参 |
| R7 | `js/core.js` | `createUploadQueue` 删除 `options.concurrency` 可配分支，并发固定 `1` | DECISIONS 要求“上传并发固定为 1”；唯一调用方 `app.js` 从不传该选项 |
| R8 | `js/core.js` | `getQueryState` 嵌套三元改为 `order === "asc" \|\| order === "desc" ? order : ""` | 真值表逐项等价 |
| R9 | `styles/desktop.css` | 删除 `.desktop-empty*` 整块（含“when B provides no ui.empty service”过期注释） | 无 JS 生成该 class（desktop 回退路径用的是 `renderEmptyState`）；`rg` 全仓零引用 |
| R10 | `styles/desktop.css` | 删除 `.sidebar-link__icon` | 无 JS 设置该 class；零引用 |
| R11 | `styles/base.css` | 删除 `.editor-toolbar__title` | `renderEditor` 只用 breadcrumb + actions；零引用 |
| R12 | `styles/overlays.css` | 删除 `.ui-sr-only`（与 `base.css` 的 `.visually-hidden` 重复） | 零引用；a11y 隐藏统一用 `base.css` 的 `.visually-hidden` |

权限复查结论：视图层无重复解释权限——`desktop.js`/`mobile.js` 全经 `context.capabilities`（`upload/create/copy/remove/move/edit/search/archive/login/logout`）门控，
全仓无一处视图直读 `data.allow_*`；`capabilities()` 本体未动（契约 shape 保持）。

CSS 复查结论：除 `tokens.css` 定义外，全仓无 hex/rgb 字面量；剩余 `px` 仅出现在无 token 覆盖的场景
（visually-hidden 1px、focus `outline-offset`、menu 位移动画、viewport `calc`），本次未引入任何新字面量，
删除的 4 块死规则全部只引用过 token。

## 2. 有意不动的项（动了会改行为或改契约，留给 planner/implementer 裁决）

- `itemRootPath` / `entryHref` / `downloadTo` / `confirmOverwrite` / `runMove/runCopy/runDelete/runCreateFolder/runCreateFile` / `rowMenuItems`
  在 `desktop.js` 与 `mobile.js` 间近乎逐行重复：冻结布局无共享视图模块位，抽到 `core.js` 会扩大冻结 export 列表（改契约），两视图互 import 会破坏单向依赖，故保留并视为“独立信息层级”的设计代价。
- `mobile.js` 隐藏文件用 `entry-icon--hidden` 描边 class、`desktop.js` 对隐藏文件无表达：两端不一致，但对齐任一方向都是视觉变更，不在 reviewer 无行为变化授权内。
- `desktop.css` `.th-sort[aria-sort="..."]` 永远命中不了（`aria-sort` 设在 `th` 上，选择器写在 button `.th-sort` 上）：疑似 bug，但修选择器会让激活态变色（行为变化），仅记录不修。
- `.sidebar-brand__mark { gap: 2px }`（desktop） vs `.mobile-brand__mark { gap: var(--border-width) }`（mobile=1px）：
  brand 几何差 1px；冻结 token 无 2px 项，转 token 会改变桌面渲染，仅记录不改。
- `overlays.js` `STATUS_MAP`/`statusLabel` 中的 `retry` 状态：core queue 从不发射，但 HANDOFF-B6 明确要求上传状态含 retry 展示位，保留。
- `base.css` `.badge/.status-dot` 无 JS 引用：属共享组件库性质，未删（删减公共组件算范围外决策）。
- `ui.empty`（`overlays.js` 返回对象中的 lossy 包装）：无内部调用方，但属已暴露的 ui 服务方法，删除算契约收窄，保留。

## 3. 验证（修改后）

- `node --check`：`app.js`、`js/core.js`、`js/desktop.js`、`js/mobile.js`、`js/overlays.js` 全部 OK（每次编辑后执行，最后全量再过一遍）。
- 静态冒烟（HANDOFF §1 扩展）：临时目录 + fixture（Index 3 条含 hidden/symlink/Unicode／空目录／Edit+editable／View／Edit+!editable），
  `python3 -m http.server` 下 `index.css/app.js/js/*(4)/styles/*(5)/icons/*` 全 `200`，server log 零 `404`。
- Headless Chrome（系统 Chrome，`--virtual-time-budget`）：1440×900 / 768×1024 / 375×667 +
  空目录 + Edit/View fixture，共 8 次渲染：页面 console 零 error（日志仅 macOS headless `CVDisplayLink` 环境噪音，无 `CONSOLE`/`Uncaught`/`TypeError`），
  DOM 断言全过——desktop 3 行 / mobile 3 行、`folder-non-empty-hidden.svg`（`.cache`）、`symlink-badge.svg`、Unicode 名、
  空态标题 `This folder is empty`、Edit 有 textarea+Save、View textarea `readonly` 且无 Save、不可编辑显示预览不可用信息、无 `Unable to load`。
- 冒烟后临时目录、dom/log 产物已清理；`git status` 确认仅 untracked 产物，无 `../dufs` 改动，无 commit。
