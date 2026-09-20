# Integrator findings

状态：完成。未 commit / push；未修改 `../dufs/`；除本文件外未改动任何仓库文件（结论见任务 1）。

## 任务 1：overlays.js core import + node --check

- 现网文件 `js/overlays.js:1` **已经是** `import { assetUrl } from './core.js?ui=0.1.0';`（带版本串）。
  A 的 findings 描述的是旧状态（无 query），当前工作树已被 B 修好，无需再改。
- 全仓 import 审计（rg）：`app.js`、`js/desktop.js`、`js/mobile.js`、`js/overlays.js` 对 `core.js` / `overlays.js` 的引用**全部带 `?ui=0.1.0`**，无任何裸 `core.js`。
- `node --check`：`app.js`、`js/core.js`、`js/desktop.js`、`js/mobile.js`、`js/overlays.js` 全部 OK。
- 真实浏览器网络证据：一次桌面加载中 `core.js` 只有**一个** distinct URL
  `http://127.0.0.1:5000/__dufs_v0.46.0__/js/core.js?ui=0.1.0`，证明无双 core 实例。

## 任务 2：跨模块契约核对

| 契约 | 结果 | 证据 |
|---|---|---|
| `index.css` @import 顺序 `tokens→base→desktop→mobile→overlays` | PASS | `rg -n '@import' index.css`，且每个 import 带 `?ui=0.1.0` |
| `app.js` import：core/desktop/mobile/overlays | PASS | `app.js:1-10`，全部 `?ui=0.1.0`；导出名与各模块 `export function` 一致 |
| icon 命名真实存在 | PASS | `icons/` 含 `folder-empty(-hidden)`、`folder-non-empty(-hidden)`、`file-{generic,txt,md,json,js,py,java,pdf,zip,image}`、`symlink-badge`、`actions.svg` |
| action sprite symbol 齐全 | PASS | `icons/actions.svg` 含 desktop/mobile 用到的全部 id：home/back/refresh/search/list/upload/download/delete/edit/copy/move/more/add/logout/login/close/eye/folder/folder-plus/file-plus/check/alert/info |
| `ui` 方法两端一致 | PASS | 契约要求 `menu/prompt/confirm/toast/showUploadQueue/showFatal/emptyState` 均在 `createUiServices` 返回对象；调用方 desktop/mobile/app 均按契约调用，另用 B 的非破坏性扩展 `error/empty/onUploadUpdate/setUploadQueue` |
| `context` shape | PASS | `app.js:67` `{data,query,capabilities,api,uploadQueue,ui}`；ui 在创建后回填 |
| 无 CDN / 无硬编码 dufs 版本 | PASS | `rg 'https?://|__dufs_v' app.js index.html index.css js styles` 仅命中 SVG 命名空间常量 |
| CSS 无外链资源 | PASS | `styles/*.css` 无 `url(...)` |

无契约冲突，无需 planner 裁决。

## 任务 3：真实 dufs 端到端

环境：`../dufs/target/debug/dufs`（v0.46.0，`cargo build` 从零 47s），临时 `SERVE_DIR=$(mktemp -d)`，`--assets $PWD`，端口 5000。

> 重要测试注意：dufs `detect_noscript()` 把 `curl/…` 等 UA 视为无脚本客户端，会返回服务端 no-JS 列表页。测自定义 UI 必须带浏览器 UA：`-A 'Mozilla/5.0 …'`。这不是产品缺陷，但会让 curl 验证误判。

### 核心项（全 PASS）

- `/` 200、`content-type: text/html`、`cache-control: no-cache`、`x-content-type-options: nosniff`。
- HTML 中 **无** `__ASSETS_PREFIX__` / `__INDEX_DATA__` 残留；资源前缀 `/__dufs_v0.46.0__/`。
- 静态资源全部 `200` + 正确 MIME：`index.css`(text/css)、`app.js`(text/javascript)、`favicon.ico`(image/x-icon)、`styles/{tokens,base,desktop,mobile,overlays}.css`、`js/{core,desktop,mobile,overlays}.js`、16 个 icon svg(image/svg+xml)。资源响应带 `cache-control: public, max-age=31536000, immutable`。
- `?json` → `application/json`，`kind=Index`、`paths=7`，不是 UI。
- `?simple` → 纯文本名称列表（`.hidden-empty/`、`配置.json` …）。
- `?noscript` → 服务端无脚本 HTML（`<title>Index of /</title>`，无 `app.js`）。
- `?q=read` → 唯一 `README.md`；`?sort=size&order=desc`、`?sort=name&order=asc` 排序正确；`?q=read&sort=name` 保留 q。
- `INDEX_DATA` base64 → JSON 解出 `uri_prefix:/`、`allow_*`/`dir_exists`/`auth`/`user`/`paths` 字段正确；目录 size=子条目数。
- CRUD：`PUT`(201) / `MKCOL`(201) / `COPY`(204) / `MOVE`(204, 源消失) / `DELETE`(204)，文件系统状态核对。
- 断点续传：`PUT "ABCDE"` → `HEAD` `content-length: 5` → `PATCH X-Update-Range: append "FGHIJ"` (204) → 最终 `ABCDEFGHIJ` 10 字节。
- 编码 Destination：`COPY` 到 `dest%20%C3%BC.txt` 生成真实 `dest ü.txt`；源名含 `#`、`?`、空格、Unicode 均正确。
- `?edit`：`kind=Edit, editable=true, user=null`；`?view`：`kind=View, editable=true`；`blob.bin?edit`：`kind=Edit, editable=false`。

### 真实浏览器（Playwright Chromium，23/23 PASS）

浏览器 UA 直接访问 dufs：
- 1440px：桌面 table 7 行、sidebar 可见、`Storage unavailable`、`#dufs-icon-sprite` 注入、7 个 entry icon `naturalWidth>0`、`.hidden-empty` 用 `folder-empty-hidden.svg`；无 4xx/5xx、无 console error、无 pageerror。
- 375px：mobile-shell 可见、desktop 隐藏、7 行 mobile-row；无 error/失败请求。
- `?edit`：textarea 载入 `# hello`、Save 加载后启用；`?view`：textarea readonly、无 Save；`blob.bin?view`：显示 `Preview unavailable`。
- 搜索/排序导航：Size 点击 → `/?sort=size&order=asc`；搜索 read → `/?q=read`（1 行 README.md）；再点 Name → `/?q=read&sort=name&order=desc`（保留 q）。

### path-prefix（`--path-prefix files`）

- `/files/` 200；资源前缀 `/files/__dufs_v0.46.0__/`；`uri_prefix=/files/`；裸 `/` 返回 400。
- 浏览器：root breadcrumb=`/files/`、首行 entry=`/files/.hidden-empty/`、sidebar home=`/files/`；页面所有 root-absolute href 均带 `/files/` 前缀，无遗漏；无 console/网络错误。
- `/files/` 下 PUT/MKCOL/COPY/MOVE/DELETE 全部 2xx，产物清理干净。

### Auth（`-a 'admin:admin@/:rw' -a 'guest:guest@/'`）

- 匿名 GET `/` → 401（无匿名读取规则，由浏览器原生认证对话框接管；符合 dufs 行为）。
- guest：200，`auth=true user=guest`，`allow_upload=false/allow_delete=false/allow_search=true/allow_archive=true`；
  guest PUT → 403。
- admin：200，`allow_upload/delete=true`；PUT 201、DELETE 204。
- `CHECKAUTH` admin → body `admin` 200；匿名 → 401（用于 `forceLogin` 触发认证）。
- `?tokengen` admin → 200，返回 token 字符串。
- Playwright 门控：guest 无 Upload 按钮、行菜单无 Delete；admin 有 Upload，文件行菜单为 `Download,View,Edit,Rename/Move,Copy,Delete`；两者 console 无 error。
  （注：DOM 中 mobile FAB 菜单始终渲染并在 `.ui-menu-item` 命中，属 desktop+mobile 双 DOM 预期，非重复菜单。）

## 结论 / 升级项

- 无阻断问题，无契约冲突。任务 1 的“问题”在当前工作树已不存在。
- 非阻断观察（无需现在处理）：
  - 匿名无读取规则时页面 401，UI 登录按钮在“auth 且允许匿名为 user=null”场景才出现；这是 dufs 认证模型决定的，与服务端契约一致。
  - `?ui=0.1.0` immutable cache 绕过依赖 query 变更；同 dufs 版本下换文件仍需改版本串（与 DECISIONS/R3 一致）。

## 未覆盖

- Safari 外部/内联 sprite<use> 实测（本次仅 Chromium）。
- 代理环境下 CHECKAUTH/LOGOUT/MKCOL/MOVE/COPY/PATCH 与 `Destination` 行为。
- Digest 之外 Basic 认证、SHA-512 哈希密码场景。
