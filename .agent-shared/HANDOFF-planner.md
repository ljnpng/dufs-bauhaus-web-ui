# Implementer handoff

先读 `REQUIREMENTS.md`、`DECISIONS.md`、`CONTRACTS-dufs.md`。不得修改 `../dufs/`。

## 冻结接口

### 模块依赖

```text
index.html
  -> index.css -> styles/{tokens,base,desktop,mobile,overlays}.css
  -> app.js
       -> js/core.js
       -> js/desktop.js
       -> js/mobile.js
       -> js/overlays.js
```

依赖方向单向：视图模块可 import `core.js`；`core.js` 不 import 视图。

`app.js` 解析一次 DATA，建立一次 UI services，再调用视图。Index 同时生成 desktop/tablet 和 mobile DOM，由 CSS breakpoint 显隐，避免 resize 重建。Edit/View 只生成共享 editor shell。

### `core.js` exports

```js
parseIndexData()
getQueryState()
assetUrl(path)
baseUrl()
joinEntryUrl(name, options)
joinAbsolutePath(path)
isDirectory(item)
isSymlink(item)
formatMtime(ms)
formatSize(item)
iconName(item)
capabilities(data)
api
createUploadQueue(options)
```

`capabilities()` 返回固定 shape：

```js
{
  upload, create, copy,
  remove, move, edit,
  search, archive,
  login, logout
}
```

判定遵循 `DECISIONS.md`。不要在视图里重复解释权限。

`api` 固定方法：`head`、`put`、`patch`、`patchAppend`、`delete`、`mkcol`、`move`、`copy`、`checkAuth`、`logout`、`downloadUrl`。成功返回 Response 或必要值；非 2xx 抛含 status/body 的 Error。

### 视图 exports

```js
// js/desktop.js
renderDesktopIndex(root, context)
renderEditor(root, context)

// js/mobile.js
renderMobileIndex(root, context)

// js/overlays.js
createUiServices(root, context)
```

`context` 固定 shape：

```js
{
  data,
  query,
  capabilities,
  api,
  uploadQueue,
  ui
}
```

`ui` 固定方法：

```js
ui.menu(anchor, items)
ui.prompt(options)       // Promise<string|null>
ui.confirm(options)      // Promise<boolean>
ui.toast(message, type)
ui.showUploadQueue()
ui.showFatal(error)
```

Menu item shape：`{ id, label, icon, danger, disabled, run }`。Dialog 禁用页面滚动、捕获焦点、Escape 关闭、关闭后归还焦点。

### DOM 挂载点

由 A 在 `index.html` 固定：

```text
#app
#desktop-view
#mobile-view
#overlay-root
#toast-root
#index-data
```

B 只依赖这些 id，不改 `index.html`。

## Implementer A：桌面、数据与集成

### 独占文件

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

不要修改 B 文件。`index.css` 预先按冻结顺序 import B 的 `mobile.css`、`overlays.css`；`app.js` 预先 import B exports。

### 工作项

1. 建立静态入口、占位符、noscript redirect、挂载点、语义 landmarks。
2. 落实全部 token；组件 CSS 不出现重复的颜色、尺寸、间距 magic value。
3. 实现 DATA Unicode base64 解码、kind dispatch、失败态。
4. 实现 URL 层。所有目录、文件、breadcrumb、Destination 都兼容非根 `uri_prefix`、空格、`#`、`?`、Unicode、嵌套路径。
5. 实现 API、认证、token 下载与单并发续传队列。
6. Desktop：232px sidebar、56px toolbar、breadcrumb、搜索、Upload、table、sort、row actions、selected/hover/focus。
7. Tablet：隐藏 sidebar；保留 table/toolbar。
8. Sidebar 只列当前 IndexData 可见目录，不伪造完整目录树。
9. Storage 组件显示 `Storage unavailable`，不画假比例。
10. Index empty/query-empty/`dir_exists=false` 调用 B 的 empty-state service/markup contract。
11. Edit/View：共享 shell、breadcrumb、下载、文本加载、textarea、保存、只读、可预览媒体 iframe、不可编辑说明。
12. 权限门控按 `capabilities()`；服务端错误交给 `ui`。

### Desktop 行为

- 列：Name、Last Modified、Size、Actions。首版不放无批量行为的 checkbox。
- 行高 44px。Name 可伸缩；mtime/size/actions 固定且不换行。
- 排序只导航服务端 `?sort=name|mtime|size&order=asc|desc`，保留 `q`。
- 搜索 submit 导航 `?q=`；清空回当前目录无 query。
- 目录点击补 `/`；文件默认下载/打开；View 明确使用 `?view`；Edit 使用 `?edit`。
- 目录下载只在 `allow_archive` 下使用 `?zip`。
- 登录：`CHECKAUTH ?login` 后 reload。登出：`LOGOUT` 后回无 query 的当前 URL。

### Edit/View

- `Edit && editable && upload && delete` 才显示 Save。
- `View` textarea 必须 readonly；不显示 Save、Move、Delete。
- `editable=false`：pdf/image/audio/video 可 sandboxed iframe；其他格式显示说明与 Download。
- 读取原文件必须用无 query 的 `baseUrl()`。
- 保存 PUT 后检查响应再 reload；不能只捕获网络异常。

### A 完成条件

- B 的文件为空壳时，A 模块自身可静态 lint/import。
- 真实 dufs 下 desktop、tablet、Edit、View 可用。
- Network 中无 CDN、无硬编码 dufs 版本路径、无未编码 Destination。

## Implementer B：移动端、资产与状态

### 独占文件

```text
styles/mobile.css
styles/overlays.css
js/mobile.js
js/overlays.js
icons/**
```

不要修改 A 文件。若冻结接口不足，把变更请求写入 `.agent-shared/FINDINGS-implementer-b.md`，不要直接改接口所有者文件。

### 工作项

1. Mobile 独立布局：brand/menu、breadcrumb、search、52px file rows、FAB、60px bottom nav。
2. 每行显示 icon、name、次要信息、overflow action。优先 name；mtime 在窄屏省略，size 保留。
3. FAB 仅在 upload capability 下显示；展开 Upload/New folder/New file，点击外部或 Escape 关闭。
4. Bottom nav：Files；居中 FAB；More 打开全局 menu。无能力时布局仍居中且不留死按钮。
5. Context menu：Download/View；按能力加入 Edit、Rename/Move、Copy、Delete。目录 Copy 不出现；目录 Download 受 archive 门控。
6. Dialogs：新建目录、新建文件、移动/重命名、复制目标、删除确认、覆盖确认、错误。
7. 上传状态：queued/running/progress/failed/retry/complete；retry 调用 A 的 queue，不自行 fetch。
8. Empty states：空目录、搜索无结果、待上传才创建目录、fatal error。文字简短，几何插画只用 token 色。
9. 文件资产：folder empty/non-empty/hidden empty/hidden non-empty；generic 与 txt/md/json/js/py/java/pdf/zip/image；symlink badge。
10. Action sprite：home/back/forward/search/refresh/list/grid/upload/download/delete/edit/copy/move/more/sort/login/logout/add/close。
11. 若复制 Lucide path，在 `icons/LICENSE.md` 记录来源、版本、ISC 许可证；自绘资产标明 original。
12. 所有 SVG 有一致 viewBox/optical size；装饰 SVG `aria-hidden=true`；icon-only button 有 `aria-label`。
13. Menu/dialog/toast/FAB 使用冻结 z-index；遵守 reduced motion。

### Icon 选择

```text
Dir + size=0                     folder-empty
Dir + size>0                     folder-non-empty
name startsWith('.')             hidden variant
SymlinkDir/SymlinkFile           base icon + symlink badge
.txt                             file-txt
.md/.markdown                    file-md
.json                            file-json
.js/.mjs/.cjs/.ts/.tsx/.jsx     file-js
.py                              file-py
.java                            file-java
.pdf                             file-pdf
.zip/.tar/.gz/.tgz/.7z/.rar      file-zip
.jpg/.jpeg/.png/.gif/.webp/.svg  file-image
other/no extension               file-generic
```

大小写不敏感。名称必须通过 DOM `textContent`，不可拼未转义 HTML。

### Context action 到 API

| Action | 调用 |
|---|---|
| Download | `api.downloadUrl(url)` 后原生 `<a download>` |
| View | 导航 `url + '?view'` |
| Edit | 导航 `url + '?edit'` |
| Rename/Move | `api.move(src, joinAbsolutePath(input))` |
| Copy | `api.copy(src, joinAbsolutePath(input))` |
| Delete | confirm 后 `api.delete(url)` |
| New folder | `api.mkcol(joinEntryUrl(name))` |
| New file | `api.put(joinEntryUrl(name), '')` 后 `?edit` |

成功 mutation 统一 reload；不做易漂移的局部 DATA 修补。

### B 完成条件

- 320、375、430px 宽度无横向滚动。
- 触控目标至少 44px；键盘能操作 FAB/menu/dialog。
- 无权限动作不渲染，不只 disabled。
- 图标在暖白和 selected 蓝底上均清晰。

## 共同验收

### 1. Python 静态复现

用于快速看 layout；不证明 dufs API。复制产物到临时目录，将模板替换成 fixture：

```sh
PREVIEW_DIR=$(mktemp -d)
cp -R index.html index.css app.js favicon.ico styles js icons "$PREVIEW_DIR/"
python3 - "$PREVIEW_DIR" <<'PY'
import base64
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
data = {
    "href": "/config/nvim",
    "kind": "Index",
    "uri_prefix": "/",
    "allow_upload": True,
    "allow_delete": True,
    "allow_search": True,
    "allow_archive": True,
    "dir_exists": True,
    "auth": False,
    "user": None,
    "paths": [
        {"path_type": "Dir", "name": ".cache", "mtime": 1787188500000, "size": 15},
        {"path_type": "File", "name": "README.md", "mtime": 1786496580000, "size": 1843},
        {"path_type": "SymlinkFile", "name": "配置.json", "mtime": 0, "size": 12100},
    ],
}
encoded = base64.b64encode(json.dumps(data, ensure_ascii=False).encode()).decode()
html = (root / "index.html").read_text()
html = html.replace("__ASSETS_PREFIX__", "/").replace("__INDEX_DATA__", encoded)
(root / "index.html").write_text(html)
PY
python3 -m http.server 8081 --directory "$PREVIEW_DIR"
```

检查 desktop/tablet/mobile、空 paths、搜索空态、长名、Unicode、hidden/symlink/file types。fixture 另测 Edit/View/editable true/false。

### 2. 真实 dufs

准备临时数据，不污染仓库：

```sh
SERVE_DIR=$(mktemp -d)
mkdir -p "$SERVE_DIR/.hidden-empty" "$SERVE_DIR/non-empty"
touch "$SERVE_DIR/empty.txt" "$SERVE_DIR/non-empty/child.txt"
printf '# hello\n' > "$SERVE_DIR/README.md"
printf '{"ok":true}\n' > "$SERVE_DIR/配置.json"
cargo run --manifest-path ../dufs/Cargo.toml -- \
  "$SERVE_DIR" -b 127.0.0.1 -p 5000 -A --assets "$PWD"
```

每次修改 `index.html` 后重启 dufs。检查：

- `/` 页面 200；所有 `__dufs_v...__/` 资源 200，MIME 正确。
- `curl -s http://127.0.0.1:5000/?json` 是 JSON，不是 UI。
- `curl -s http://127.0.0.1:5000/?simple` 是文本列表。
- `curl -s http://127.0.0.1:5000/?noscript` 是服务端无脚本 HTML。
- `?q=hello`、三列 asc/desc 排序、query 清理正确。
- file/dir mtime、file bytes、dir item count、`mtime=0` 格式正确。
- PUT、MKCOL、DELETE、MOVE、file COPY 成功；directory COPY 不提供。
- 人为中断上传后 Retry 发 HEAD，再发 PATCH `X-Update-Range: append`，最终字节一致。
- `?edit` 可编辑小文本；`?view` 只读；binary/大文件不误显示编辑器。
- 只开 upload、只开 delete、全关、`-A` 四种权限组合无越权按钮。

### 3. Path prefix

以 `--path-prefix files` 重启，访问 `/files/`：

- HTML 中 favicon/CSS/JS 位于 `/files/__dufs_v...__/`。
- root breadcrumb 回 `/files/`。
- entry、search、sort、upload、Destination、logout 均保留 `/files/`。

### 4. Auth

用测试凭据启动：

```sh
cargo run --manifest-path ../dufs/Cargo.toml -- \
  "$SERVE_DIR" -b 127.0.0.1 -p 5000 \
  --allow-upload --allow-delete --allow-search --allow-archive \
  -a 'admin:admin@/:rw' -a 'guest:guest@/' \
  --assets "$PWD"
```

检查 anonymous、guest、admin 的按钮门控；login 触发认证；logout 后凭据态清除；登录下载先 `?tokengen`，最终 URL 使用 `?token=`。

### 5. 浏览器与质量

- 最新 Chrome、Safari；desktop 1440px，tablet 768px，mobile 320/375/430px。
- 键盘顺序、focus ring、Escape、dialog focus return、screen-reader label。
- 控制台无 error；Network 无 404；慢速上传时 beforeunload 生效。
- CSS/JS 无外网依赖；刷新后无 stale asset。验证 UI query 版本能绕过 immutable cache。
