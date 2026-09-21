# 稳定决定

## 边界

- 目标目录是本仓库根目录；`../dufs/` 只读。
- 产物是原生 HTML/CSS/JavaScript，无构建、框架、CDN、运行时依赖。
- `index.html` 必须保留 `__ASSETS_PREFIX__`、`__INDEX_DATA__`。资源只从前者派生。
- `?json`、`?simple`、`?noscript` 由 dufs 服务端处理。UI 不拦截、不改写这些响应。

## 文件布局

```text
index.html                 HTML 壳、挂载点、template 数据、noscript 跳转
index.css                  CSS 入口；只 @import 下列文件
app.js                     ES module 入口；选择 Index/Edit/View 与响应式视图
favicon.ico
styles/tokens.css          全局 token
styles/base.css            reset、可访问性、共享组件
styles/desktop.css         >= 640px；桌面表格（单栏全宽，无侧栏）
styles/mobile.css          < 640px；列表、顶栏加号菜单
styles/overlays.css        menu、dialog、toast、上传状态、empty state
js/core.js                 DATA、URL、格式化、权限、API、上传队列
js/desktop.js              desktop/table/toolbar
js/mobile.js               mobile/list/topbar add menu
js/overlays.js             menu/dialog/empty/upload/editor state
icons/actions.svg          action symbol sprite
icons/folder-*.svg         empty/non-empty/hidden variants
icons/file-*.svg           generic + txt/md/json/js/py/java/pdf/zip/image
icons/symlink-badge.svg    符号链接叠层
icons/LICENSE.md           第三方 icon 来源与许可证
```

`index.html` 仅直接引用：

```html
<link rel="icon" href="__ASSETS_PREFIX__favicon.ico">
<link rel="stylesheet" href="__ASSETS_PREFIX__index.css">
<body data-assets-prefix="__ASSETS_PREFIX__">
  <template id="index-data">__INDEX_DATA__</template>
  <script type="module" src="__ASSETS_PREFIX__app.js"></script>
</body>
```

子模块、CSS import 使用入口文件相对 URL。动态 icon URL 由 `assetUrl()` 生成，禁止硬编码 `/__dufs_v...__/`。

## Token

组件只能引用 token。媒体查询阈值是 CSS 常量，因 custom property 不能用于 `@media`。

### 1. Color

```css
--color-bg: #faf8f5;
--color-surface: #ffffff;
--color-text: #14213d;
--color-text-muted: #687280;
--color-border: #e5e7eb;
--color-bauhaus-blue: #0758c9;
--color-bauhaus-red: #ef3340;
--color-bauhaus-yellow: #f5b82e;
--color-bauhaus-yellow-ink: #a97400;   /* 浅底小字用的可读黄 */
--color-primary: var(--color-bauhaus-blue);
--color-primary-hover: #06449e;
--color-primary-soft: #e8f0fa;
--color-success: #16a34a;
--color-danger: var(--color-bauhaus-red);
--color-danger-hover: #c81e2b;
--color-danger-soft: #fef2f2;
--color-hover: #f3f4f6;
--color-disabled: #9ca3af;
--color-backdrop: rgba(20, 33, 61, 0.36);
```

红、黄、蓝只作操作、状态、几何 accent，不作大面积背景。

语义映射（2026-09-21 统一）：

- 蓝 `#0758c9`：主操作、选中、焦点、链接、进度。
- 黄 `#f5b82e`：进行中/激活/按压反馈。
- 红 `#ef3340`：危险、删除、错误。

蓝必须用 `--color-bauhaus-blue`，不得再出现 Tailwind 蓝 `#2563eb`；`--color-primary` / `--color-danger` 均引用 Bauhaus 原色。静态 icon 资产内嵌同一批 hex（见 `icons/*`）。

### 2. Typography

```css
--font-ui: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-display: var(--font-ui);
--font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
--font-size-caption: 0.75rem;   /* 12px */
--font-size-ui: 0.875rem;       /* 14px */
--font-size-mobile: 1rem;       /* 16px */
--font-size-section: 1.25rem;   /* 20px */
--font-size-page: 1.75rem;      /* 28px */
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--line-height-tight: 1.25;
--line-height-ui: 1.5;
--tracking-caps: 0.04em;
```

字体走现代中性路线（Inter + 系统 fallback），不拉取 Web Font。

大写 + `--tracking-caps` **只**用于表头（`.file-table th`）这一个 micro-label。按钮、对话框/empty/fatal 标题、badge 一律 sentence case。2026-09-21 调整为「现代为底 + Bauhaus 小细节」。

### 3. Spacing

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-12: 3rem;
--page-gutter-mobile: var(--space-4);
--page-gutter-desktop: var(--space-8);
--content-gap: var(--space-6);
--table-cell-inline: var(--space-4);
```

### 4. Size / layout

```css
--size-control: 2.25rem;        /* 36px */
--size-primary: 2.5rem;        /* 40px */
--size-toolbar: 3.5rem;         /* 56px */
--size-bottom-nav: 3.75rem;     /* 60px */
--size-fab: 3rem;               /* 48px */
--size-dialog-max: 30rem;       /* 480px */
--size-search-max: 20rem;       /* 320px */
```

Breakpoints：mobile `0–639px`；tablet `640–1023px`；desktop `>=1024px`。桌面端是全宽度单栏；Storage 指示器在表格下方显示。

### 5. Radius

```css
--radius-sm: 0.25rem;    /* 4px */
--radius-control: 0.375rem; /* 6px */
--radius-panel: 0.5rem;  /* 8px */
--radius-round: 999px;
```

现代圆角尺度；`--radius-round` 用于状态点、traffic dots、badge、进度条。

### 6. Border

```css
--border-width: 1px;
--border-default: var(--border-width) solid var(--color-border);
--border-control: var(--border-width) solid var(--color-border);
--border-strong: var(--border-width) solid var(--color-border);
--border-focus: 2px solid var(--color-primary);
--border-selected: 3px solid var(--color-primary);
```

所有边框统一为中性 1px 灰边（`--border-default/control/strong` 同值），不再用粗黑框。颜色靠 Bauhaus accent 承担：选中行 `box-shadow: inset 3px 0 0 var(--color-primary)`。

### 7. Shadow

```css
--shadow-panel: 0 1px 3px rgba(20, 33, 61, 0.08);
--shadow-menu: 0 8px 24px rgba(20, 33, 61, 0.14);
--shadow-dialog: 0 16px 40px rgba(20, 33, 61, 0.18);
```

回到现代柔和阴影表达层级。

### Bauhaus 小细节（唯一的结构性 Bauhaus 元素）

顶部红黄蓝 composition strip：`.desktop-toolbar` / `.mobile-header` / `.editor-toolbar` 的 `::before` 为 3px 三色线性渐变（`base.css`）。其余 Bauhaus 表达都在内容层：几何 logo/wordmark、traffic dots、彩色文件图标、几何 empty-state 插画、胶黄按压态、三原色语义。

- **文本按钮统一白底 + 首字母带色**：所有含文字的按钮一律白底（`--color-surface`）、中性 1px 灰边、正文 `--color-text`，不再有蓝色/红色填充；层级只靠首字母颜色。首字母由 `bauhausLabel()`（`js/overlays.js`）包成 `.bauhaus-initial`：默认蓝，`danger` 用红（`Delete` 等整行文字不全红）。覆盖 toolbar、editor、empty-state、dialog、upload/fatal 的全部文字按钮。菜单项同样无前置 icon、首字母按序循环 `red → yellow → blue`。纯 icon 按钮（排序、刷新、行内更多）不变，本就不带文字。
- **Bauhaus 几何 more（仅移动端 toolbar）**：移动顶栏右上角菜单按钮由红/黄/蓝 traffic dots 改为 `more-bauhaus` symbol —— 原始横排三点，其中两点换成红三角 + 黄方块，末点仍是蓝圆（横向一排；inline style 填充以覆盖 `.icon` 的 `stroke/fill`）。桌面 toolbar 的 "More actions" 与行内操作仍用标准竖点 `more`。原 `.mobile-traffic-dots` 代码与样式已删除。
- **搜索框**：放大镜用 `--color-primary` 蓝，清除 x 用 `--color-danger` 红（hover `--color-danger-hover`）；桌面与移动一致，桌面版桌面搜索框补上 leading 放大镜（`.toolbar-search__field`）。

### 8. Icon

```css
--icon-size-sm: 1rem;
--icon-size: 1.125rem;
--icon-size-mobile: 1.25rem;
--icon-size-file: 1.5rem;
--icon-size-grid: 3.5rem;
--icon-box: 1.5rem;
--icon-stroke: 1.875;
```

Action icon 使用统一 `24x24` viewBox/sprite；Folder/File 是独立资产。`.icon` 用 `stroke-linecap/linejoin: round`，标准 1.875 描边。隐藏项由点状轮廓表达；symlink 使用 badge，不另建整套图标。

### Motion

```css
--motion-fast: 120ms;
--motion-panel: 180ms;
--motion-ease: cubic-bezier(0.2, 0, 0, 1);
```

仅动画 opacity、transform、颜色。`prefers-reduced-motion: reduce` 下时长归零。

### Z-index

```css
--z-base: 0;
--z-sticky: 10;
--z-menu: 30;
--z-fab: 40;
--z-backdrop: 50;
--z-dialog: 60;
--z-toast: 70;
```

### Density

```css
--density-row-desktop: 2.75rem; /* 44px */
--density-row-mobile: 3.25rem;  /* 52px */
--density-hit-target: 2.75rem;  /* 44px */
```

## 数据与 URL

- `parseIndexData()`：读取 `#index-data.innerHTML`，`atob` 后用 `TextDecoder` 解 UTF-8，再 `JSON.parse`。解析失败渲染致命错误，不继续初始化。
- `DATA.kind` 只能是 `Index | Edit | View`。未知值失败关闭。
- `baseUrl()` 去掉 query/hash。
- `joinEntryUrl(name, { directory })`：以当前目录 URL 为基准；逐段 `encodeURIComponent`；目录补 `/`。
- `joinAbsolutePath(path)`：以 `location.origin + DATA.uri_prefix` 为根；逐段编码。禁止用字符串拼接绕过 `uri_prefix`。
- `assetUrl(path)`：`document.body.dataset.assetsPrefix + path`。
- 面包屑从 `DATA.href` 构建，根链接始终是 `DATA.uri_prefix`。
- 搜索生成 `?q=`；排序只更新 `sort/order`，保留有效 `q`，移除 `json/simple/noscript/edit/view`。

## API

`js/core.js` 唯一持有网络与 mutation 逻辑，并导出：

```text
api.head(url)
api.put(url, body)
api.patch(url, body, range)      X-Update-Range: range
api.patchAppend(url, body)       patch(..., "append") 的语义封装
api.delete(url)
api.mkcol(url)
api.move(src, destination)       Destination: absolute encoded URL
api.copy(src, destination)       Destination: absolute encoded URL；仅文件
api.checkAuth(forceLogin=false)  CHECKAUTH；forceLogin => ?login
api.logout(user)                 XMLHttpRequest LOGOUT，保留 username 参数
api.downloadUrl(url)             已登录时 ?tokengen -> ?token；否则原 URL
```

所有 mutation 先 `checkAuth()`，再检查 2xx；错误进入统一 dialog/toast。HEAD 仅用于覆盖确认和续传偏移。

上传并发固定为 1。首次传输 `PUT`；失败重试先 HEAD：200 时读取 `content-length`，offset 小于文件大小则 `PATCH` + `X-Update-Range: append` + `file.slice(offset)`；404/无长度则 PUT；offset 等于文件大小视为完成；offset 大于文件大小要求覆盖确认后 PUT。离开页面时若队列或传输未结束，注册 `beforeunload`。

## 权限与 kind

| 能力 | 条件 |
|---|---|
| 上传、新建文件/目录、复制文件 | `allow_upload` |
| 删除 | `allow_delete` |
| 移动/重命名 | `allow_upload && allow_delete` |
| 编辑入口、保存已有文件 | `allow_upload && allow_delete` |
| 搜索 | `allow_search` |
| 下载目录 zip | `allow_archive` |
| 下载文件、View | 始终可见 |
| 登录/登出 | `auth`；由 `user` 决定当前态 |

- `Index`：渲染目录视图。
- `Edit`：渲染编辑 shell；`editable` 为 false 时预览支持格式，否则说明不可编辑。保存仍受上传/删除门控。
- `View`：同一查看 shell，永远只读，不显示保存/变更动作。
- 前端门控只改善 UI；服务端状态码仍是最终权限判定。

## 条目显示

- `Dir`、`SymlinkDir` 是目录；`File`、`SymlinkFile` 是文件。
- 目录 `size` 是子条目数：`0 items`、`1 item`、`n items`；`>=1000` 显示 `>999 items`。
- 文件 size 以 1024 为基数，保留最多一位小数。
- `mtime === 0` 显示 `—`；否则 `new Date(mtime)`，按本地 `YYYY-MM-DD HH:mm`。
- 点开头名称使用 hidden 图标；目录 `size===0` 用 empty，否则 non-empty；symlink 加 badge。
- 文件类型匹配不区分大小写。未知扩展名用 generic。

## Storage

IndexData 没有磁盘已用量、总容量或 quota。禁止从可见文件 size 推断容量，禁止写死效果图数字。

组件保留同样位置；默认显示无进度条的 `Storage unavailable`。将来只有服务端提供明确容量字段后才启用数值和比例。

## 缓存

dufs 对静态资源返回一年 immutable，前缀只随 dufs 版本变化。发布 UI 更新时，入口、CSS imports、JS imports、动态 icon URL 使用同一个具名 UI 版本，例如 `?ui=0.1.0`。不得只版本化入口。必须在真实 dufs 下验证查询不影响文件解析。
