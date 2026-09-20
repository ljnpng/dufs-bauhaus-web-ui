# dufs --assets 精确契约

> 由 dufs-scout 收集，基于 dufs/ 源码分析（只读参考）。
> 覆盖版本：当前 main 分支。

---

## 1. --assets 目录要求

**来源：** `src/args.rs` `sanitize_assets_path()` 行 397–411

```
fn sanitize_assets_path<P: AsRef<Path>>(path: P) -> Result<PathBuf> {
    let path = Self::sanitize_path(path)?;
    if !path.join("index.html").exists() {
        bail!("Path `{}` doesn't contains index.html", path.display());
    }
    Ok(path)
}
```

| 文件 | 必需/可选 | 行为 |
|------|---------|------|
| `index.html` | **必需** | 不存在时 bail! 启动失败 |
| `404.html` | 可选 | 若存在则赋给 `args.error_page`，作为自定义 404 页面 |
| 其他静态文件（`index.js`、`index.css`、`favicon.ico`、图片等） | 可选 | 通过 `__dufs_v{VERSION}__/` 前缀按需请求 |

**设置方式：**
- CLI: `--assets <path>`
- 环境变量: `DUFS_ASSETS=<path>`
- 配置文件: `assets: <path>`

路径先经 `sanitize_path()` 处理（存在性检查 + `canonicalize`），再检查 `index.html`。

---

## 2. index.html 占位符替换逻辑

**来源：** `src/server.rs`

### 两个占位符

| 占位符 | 替换值 | 替换位置 |
|--------|--------|---------|
| `__ASSETS_PREFIX__` | `{uri_prefix}{assets_prefix}` 即 `/{path-prefix?}__dufs_v{VERSION}__/` | HTML 中所有出现处 |
| `__INDEX_DATA__` | base64(JSON(IndexData 或 EditData)) | HTML 中所有出现处 |

### 替换代码（`send_index`，行 ~1304–1310）

```rust
let index_data = STANDARD.encode(serde_json::to_string(&data)?);
self.html
    .replace(
        "__ASSETS_PREFIX__",
        &format!("{}{}", self.args.uri_prefix, self.assets_prefix),
    )
    .replace("__INDEX_DATA__", &index_data)
```

`handle_edit_file`（行 ~1020–1040）做相同替换，data 为 `EditData`。

### assets_prefix 的值

```rust
// server.rs:72
let assets_prefix = format!("__dufs_v{}__/", env!("CARGO_PKG_VERSION"));
```

例：dufs v0.40.0 → `__dufs_v0.40.0__/`

### 原始 index.html 中的使用示例

```html
<!-- assets/index.html -->
<link rel="icon" type="image/x-icon" href="__ASSETS_PREFIX__favicon.ico">
<link rel="stylesheet" href="__ASSETS_PREFIX__index.css">
<template id="index-data">__INDEX_DATA__</template>
<script src="__ASSETS_PREFIX__index.js"></script>
```

---

## 3. `__dufs_v{VERSION}__/` 静态资源 serving

**来源：** `src/server.rs` `handle_internal()` 行 790–840

```rust
async fn handle_internal(&self, req_path: &str, ...) -> Result<bool> {
    if let Some(name) = req_path.strip_prefix(&self.assets_prefix) {
        match self.args.assets.as_ref() {
            Some(assets_path) => {
                let path = assets_path.join(name);
                if path.exists() {
                    self.handle_send_file(&path, ...).await?;
                } else {
                    status_not_found(res);
                    return Ok(true);
                }
            }
            None => match name {
                "index.js" => { /* 内置 */ }
                "index.css" => { /* 内置 */ }
                "favicon.ico" => { /* 内置 */ }
                _ => { status_not_found(res); }
            },
        }
        // 统一注入缓存头
        res.headers_mut().insert("cache-control",
            HeaderValue::from_static("public, max-age=31536000, immutable"));
        res.headers_mut().insert("x-content-type-options",
            HeaderValue::from_static("nosniff"));
        Ok(true)
    } else if req_path == HEALTH_CHECK_PATH { ... }
}
```

**规则摘要：**
- 请求路径以 `__dufs_v{VERSION}__/` 开头时进入此分支
- 若设置了 `--assets`：从 `assets_dir/name` 提供文件；不存在则 404
- 若未设置 `--assets`：只内置 `index.js`、`index.css`、`favicon.ico`，其余 404
- 所有静态资源响应均附带 `Cache-Control: public, max-age=31536000, immutable`
- HTTP 访问日志跳过此路径（server.rs 行 ~105）

**实践含义：** 自定义 assets 目录里放任何文件（如 `app.css`、`app.js`、图片），都可通过 `__ASSETS_PREFIX__app.css` 引用。

---

## 4. IndexData / EditData 全部字段

### 4a. IndexData（目录列表页和搜索结果）

**来源：** `src/server.rs` 行 1553–1568，`send_index()` 行 ~1295

```rust
pub struct IndexData {
    pub href: String,           // 当前目录相对路径，如 "/" 或 "/subdir"
    pub kind: DataKind,         // 始终为 "Index"
    pub uri_prefix: String,     // URL 前缀，如 "/" 或 "/myprefix/"
    pub allow_upload: bool,     // 服务器允许上传 AND 当前用户有读写权限
    pub allow_delete: bool,     // 服务器允许删除 AND 当前用户有读写权限
    pub allow_search: bool,     // 服务器允许搜索（不受用户权限约束）
    pub allow_archive: bool,    // 服务器允许下载 zip（不受用户权限约束）
    pub dir_exists: bool,       // 当前目录是否实际存在（false=待创建）
    pub auth: bool,             // 服务器是否启用认证（AccessControl::has_users()）
    pub user: Option<String>,   // 当前已认证用户名，匿名为 null
    pub paths: Vec<PathItem>,   // 目录条目列表（排序后）
}
```

**注意：** `allow_upload` 和 `allow_delete` 是全局权限与用户读写权限的交集：
```rust
allow_upload: self.args.allow_upload && readwrite,
allow_delete: self.args.allow_delete && readwrite,
```

### 4b. EditData（文件编辑/查看页）

**来源：** `src/server.rs` 行 1660–1670，`handle_edit_file()` 行 ~1005

```rust
struct EditData {
    href: String,           // 当前文件相对路径
    kind: DataKind,         // "Edit" 或 "View"
    uri_prefix: String,     // URL 前缀
    allow_upload: bool,     // 服务器允许上传（直接取 args.allow_upload，无读写权限过滤）
    allow_delete: bool,     // 服务器允许删除（直接取 args.allow_delete）
    auth: bool,             // 是否启用认证
    user: Option<String>,   // 当前用户
    editable: bool,         // 文件可编辑：size<=4MB AND 内容检测为文本
}
```

**editable 判断逻辑：**
```rust
const EDITABLE_TEXT_MAX_SIZE: u64 = 4194304; // 4MB
let editable = meta.len() <= EDITABLE_TEXT_MAX_SIZE
    && content_inspector::inspect(&buffer).is_text();
```

### 4c. PathItem（paths 数组中的每个条目）

**来源：** `src/server.rs` 行 1569–1575

```rust
pub struct PathItem {
    pub path_type: PathType,  // "Dir" | "SymlinkDir" | "File" | "SymlinkFile"
    pub name: String,         // 相对于当前目录的路径，目录不带尾部斜杠
    pub mtime: u64,           // Unix 时间戳（毫秒），0 表示不可用
    pub size: u64,            // 文件=字节数；目录=子条目数（上限 1000）
}
```

**PathType 枚举：**

| 值 | 含义 |
|----|------|
| `"Dir"` | 普通目录 |
| `"SymlinkDir"` | 指向目录的符号链接 |
| `"File"` | 普通文件 |
| `"SymlinkFile"` | 指向文件的符号链接 |

**目录 size 的特殊含义：**
```rust
// server.rs to_pathitem(), 当 PathType::Dir 或 SymlinkDir 时：
let mut count = 0;
// 遍历子条目计数，超过 MAX_SUBPATHS_COUNT(1000) 时截止
if count >= MAX_SUBPATHS_COUNT { break; }
```
所以目录的 `size` 字段 = 子条目数量（隐藏文件已排除），最大值 1000（超过时显示 >999）。

### 4d. DataKind 枚举

| 值 | 触发条件 |
|----|---------|
| `"Index"` | GET 目录、搜索结果 |
| `"Edit"` | GET 文件 + `?edit` 参数 |
| `"View"` | GET 文件 + `?view` 参数 |

---

## 5. 文件操作 API

### 5a. 基础 CRUD

| 方法 | 路径 | 条件/Header | 响应 | 说明 |
|------|------|------------|------|------|
| `PUT` | `/path/to/file` | `allow_upload=true` | 201 Created / 403 / 405 | 创建或覆盖文件；若文件已存在且 size>0 须同时 `allow_delete=true` |
| `PATCH` | `/path/to/file` | `allow_upload=true`；`X-Update-Range: append` | 204 No Content | 断点续传追加；若 offset<size 须 `allow_delete=true` |
| `PATCH` | `/path/to/file` | `allow_upload=true`；`X-Update-Range: {range}` | 204 No Content | 覆写指定范围 |
| `DELETE` | `/path/to/file-or-dir` | `allow_delete=true` | 204 No Content | 删除文件或递归删除目录 |
| `MKCOL` | `/path/to/newdir` | `allow_upload=true` | 201 Created | 创建目录（含父级） |
| `MOVE` | `/path/to/src` | `allow_upload && allow_delete`；`Destination: <url>` | 204 No Content | 移动/重命名 |
| `COPY` | `/path/to/src` | `allow_upload=true`；`Destination: <url>` | 204 No Content | 复制文件（不支持目录） |

### 5b. GET 文件 / 目录

| 查询参数 | 触发行为 |
|---------|---------|
| （无参数，目录） | 返回 HTML 目录列表（包含 `__INDEX_DATA__`） |
| `?q=keyword` | 搜索目录（需 `allow_search=true`），返回 HTML |
| `?json` | 返回 JSON 格式的 IndexData 或 PathItem（文件时） |
| `?simple` | 返回纯文本名称列表（`name/\n` 格式） |
| `?zip` | 下载目录为 zip（需 `allow_archive=true`） |
| `?noscript` | 返回无 JS 的 HTML（noscript 降级） |
| `?edit` | 文件编辑页（kind=Edit） |
| `?view` | 文件查看页（kind=View） |
| `?hash` | 返回文件 SHA-256 哈希（需 `allow_hash=true`） |
| `?sort=name\|mtime\|size` | 排序字段 |
| `?order=asc\|desc` | 排序方向 |
| `?tokengen` | 生成下载 token（用于认证下载） |
| `?token=<token>` | 用 token 进行认证 |

### 5c. 特殊方法

| 方法 | 路径 | 说明 |
|------|------|------|
| `CHECKAUTH` | 任意路径 | 验证认证；`?login` 强制触发认证弹窗；响应体为用户名或空 |
| `LOGOUT` | 任意路径 | 触发 401 使客户端清除凭据 |
| `PROPFIND` | 任意路径 | WebDAV 属性查询（Depth: 0 或 1） |
| `OPTIONS` | 任意路径 | 返回 WebDAV Allow 头 |
| `HEAD` | 任意文件 | 获取 content-length 用于断点续传检测 |

### 5d. 健康检查

```
GET /__dufs__/health
→ 200 {"status":"OK"}
```

### 5e. 断点续传（Resumable Upload）流程

```sh
# 1. 获取已上传偏移
upload_offset=$(curl -I -s http://host/file | grep -i content-length | awk '{print $2}' | tr -d '\r')
# 2. 继续上传
dd skip=$upload_offset if=file status=none ibs=1 | \
  curl -X PATCH -H "X-Update-Range: append" --data-binary @- http://host/file
```

前端 `Uploader.retry()` 实现：
1. `HEAD` 请求获取 `content-length`
2. 用 `PATCH + X-Update-Range: append + file.slice(offset)` 续传

### 5f. Range 下载

支持标准 `Range: bytes=start-end` 请求（HTTP 206）。
支持多 range（multipart/byteranges）。
If-Modified-Since / If-None-Match / ETag 均支持。

### 5g. 认证

- HTTP Basic Auth 和 Digest Auth 均支持
- 默认认证方式为 Digest（`--auth-method` 可改为 basic）
- SHA-512 哈希密码支持（`$6$...` 格式）；哈希密码不兼容 Digest Auth

---

## 6. 前端解析 INDEX_DATA 逻辑

### 6a. 数据读取（`assets/index.js`）

```javascript
// index.js 行 175–180
window.addEventListener("DOMContentLoaded", async () => {
  const $indexData = document.getElementById('index-data');
  if (!$indexData) { alert("No data"); return; }
  DATA = JSON.parse(decodeBase64($indexData.innerHTML));
  // ...
});
```

- 数据载体：`<template id="index-data">__INDEX_DATA__</template>`
- 解码：`decodeBase64()` (行 ~985) → `atob()` + `TextDecoder` 处理 Unicode
- 解析：`JSON.parse()`

### 6b. DATA.kind 分支（行 ~228）

```javascript
if (DATA.kind === "Index") {
    // 目录列表页：setupIndexPage()
} else if (DATA.kind === "Edit") {
    // 编辑页：setupEditorPage()
} else if (DATA.kind === "View") {
    // 查看页：setupEditorPage()（editor.readonly=true）
}
```

### 6c. 关键函数与行号

| 函数 | 行号（约） | HTTP 方法 | 说明 |
|------|-----------|----------|------|
| `Uploader.ajax()` | ~215 | `PUT` / `PATCH+X-Update-Range:append` | 文件上传/续传 |
| `Uploader.retry()` | ~241 | `HEAD` + `PATCH` | 断点续传重试 |
| `deletePath()` | ~702 | — | 入口，调用 doDeletePath |
| `doDeletePath()` | ~716 | `DELETE` | 实际删除请求 |
| `movePath()` | ~733 | — | 入口，调用 doMovePath |
| `doMovePath()` | ~741 | `HEAD` + `MOVE+Destination` | 移动/重命名 |
| `saveChange()` | ~794 | `PUT` | 保存编辑器内容 |
| `checkAuth()` | ~804 | `CHECKAUTH` | 验证认证 |
| `logout()` | ~816 | `LOGOUT` | 登出 |
| `createFolder()` | ~825 | `MKCOL` | 创建目录 |
| `createFile()` | ~836 | `PUT` (空 body) | 创建空文件 |
| `decodeBase64()` | ~985 | — | Unicode-safe base64 解码 |
| `addBreadcrumb()` | ~328 | — | 使用 DATA.href + DATA.uri_prefix |
| `setupIndexPage()` | ~374 | — | 检查 DATA.allow_* 控制 UI |

### 6d. DATA 字段使用一览

| 字段 | 用于 |
|------|------|
| `DATA.href` | 面包屑导航路径 |
| `DATA.uri_prefix` | URL 拼接基础 |
| `DATA.kind` | 决定渲染模式 |
| `DATA.allow_upload` | 控制上传/新建文件夹/文件按钮显示 |
| `DATA.allow_delete` | 控制删除/移动/编辑按钮显示 |
| `DATA.allow_search` | 控制搜索栏显示 |
| `DATA.allow_archive` | 控制 zip 下载按钮 |
| `DATA.auth` | 控制登录/登出按钮；是否执行 CHECKAUTH |
| `DATA.user` | 显示用户名；token 下载功能 |
| `DATA.dir_exists` | 空目录提示文字 |
| `DATA.paths` | 渲染文件列表 |
| `DATA.editable` | （EditData）控制保存按钮和 iframe 预览 |

---

## 7. Server.init() 中 HTML 加载逻辑

```rust
// server.rs 行 ~82–88
let html = match args.assets.as_ref() {
    Some(path) => Cow::Owned(std::fs::read_to_string(path.join("index.html"))?),
    None => Cow::Borrowed(INDEX_HTML),
};
```

HTML 模板在**服务器启动时一次性读入内存**（`Cow::Owned`），后续每次请求做字符串替换。
因此，修改磁盘上的 `index.html` 需要**重启 dufs** 才能生效。

---

## 8. 内置 assets 文件列表（无 --assets 时可用）

| URL 路径 | Content-Type |
|---------|-------------|
| `__dufs_v{V}__/index.js` | `application/javascript; charset=UTF-8` |
| `__dufs_v{V}__/index.css` | `text/css; charset=UTF-8` |
| `__dufs_v{V}__/favicon.ico` | `image/x-icon` |

---

## 9. 响应头摘要

| Header | 值 | 来源 |
|--------|-----|------|
| `Cache-Control` (index) | `no-cache` | send_index / handle_edit_file |
| `Cache-Control` (assets) | `public, max-age=31536000, immutable` | handle_internal |
| `X-Content-Type-Options` | `nosniff` | handle_internal + send_index |
| `Content-Type` (index) | `text/html; charset=utf-8` | send_index |
| `Accept-Ranges` | `bytes` | handle_send_file |
