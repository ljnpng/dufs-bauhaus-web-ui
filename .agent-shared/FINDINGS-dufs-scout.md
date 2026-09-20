# dufs-scout 调查发现

> 收集人：dufs-scout（只读，不做架构决策）  
> 日期：2026-09-20  
> 基于：dufs/ 源码（src/args.rs、src/server.rs、assets/index.html、assets/index.js）

---

## 已确认事实

### F1. index.html 必须包含两个占位符字符串

`src/server.rs` 的 `send_index()` 和 `handle_edit_file()` 对 `self.html` 做字符串 `.replace()`：

```rust
.replace("__ASSETS_PREFIX__", ...)
.replace("__INDEX_DATA__", ...)
```

若 index.html 中不包含 `__INDEX_DATA__`，页面将无法获取数据（DATA 为 undefined）。
若不包含 `__ASSETS_PREFIX__`，静态资源 URL 无法正确解析。

**结论：** 两个占位符都是功能必需，缺一不可。

### F2. `__INDEX_DATA__` 必须放在 `<template id="index-data">` 内（或等效位置）

JS 的读取方式：
```javascript
const $indexData = document.getElementById('index-data');
DATA = JSON.parse(decodeBase64($indexData.innerHTML));
```

如果自定义 UI 不使用内置的 `index.js`，可以自由选择放置位置。但如果复用 `index.js` 逻辑，则 **id="index-data"** 是硬编码约束。

### F3. 静态资源 URL 前缀随版本变化

`assets_prefix = "__dufs_v{CARGO_PKG_VERSION}__/"` 每次 dufs 版本升级都会变。
如果 index.html 硬编码了 `__dufs_v0.40.0__/index.js` 而不使用 `__ASSETS_PREFIX__`，升级后立即失效。

**结论：** 必须通过 `__ASSETS_PREFIX__` 占位符引用，不能硬编码版本号。

### F4. HTML 模板在启动时读入内存，修改需重启

```rust
let html = match args.assets.as_ref() {
    Some(path) => Cow::Owned(std::fs::read_to_string(path.join("index.html"))?),
    ...
};
```

**结论：** 热重载不支持。开发阶段需要重启 dufs 才能看到 index.html 改动。

### F5. 自定义 assets 目录中的文件 404 时服务端不 fallback 到内置

```rust
Some(assets_path) => {
    let path = assets_path.join(name);
    if path.exists() {
        self.handle_send_file(&path, ...).await?;
    } else {
        status_not_found(res);  // 直接 404，不 fallback
        return Ok(true);
    }
}
```

**结论：** 自定义目录必须包含所有自定义 UI 引用的静态文件；不能部分覆盖内置文件（除非使用相同文件名 + 完全替换）。

### F6. allow_upload / allow_delete 是交集权限

```rust
allow_upload: self.args.allow_upload && readwrite,
allow_delete: self.args.allow_delete && readwrite,
```

即：全局开关 AND 当前用户的读写权限。如果用户只有只读权限，即使服务器开了 allow_upload，前端也会收到 false。
EditData 中则不过滤读写权限（直接取 `self.args.allow_upload`）。

### F7. 目录的 size 字段语义与文件不同

目录 `size` = 子条目计数（上限 1000），不是字节数。自定义 UI 渲染目录大小时需要特殊处理。

### F8. mtime 是毫秒时间戳，不是秒

```rust
fn to_timestamp(time: &SystemTime) -> u64 {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
```

**结论：** `new Date(mtime)` 在 JavaScript 中可以直接使用（Date 接受毫秒）。

---

## 风险与注意事项

### R1. 占位符替换是全局字符串替换，无转义

```rust
self.html.replace("__INDEX_DATA__", &index_data)
```

index_data 是 base64 字符串，不含 HTML 特殊字符，安全。
但 `__ASSETS_PREFIX__` 的值含 `/` 字符，也不含危险字符。整体风险低。

**潜在风险：** 若自定义 index.html 模板中意外出现 `__INDEX_DATA__` 或 `__ASSETS_PREFIX__` 字样（如注释），会被替换。

### R2. 无 ?json 时 IndexData 嵌入 HTML，大目录下 HTML 体积较大

若目录有数千文件，IndexData 的 JSON + base64 编码会很大。
原始实现上限 `MAX_SUBPATHS_COUNT = 1000`（`src/server.rs:56`），超过 1000 个子目录时截止计数。
但 `list_dir()` 本身会列出所有文件，**未发现 paths 数组的条目数上限**。

**风险：** 极大目录可能导致 HTML 响应体积异常大。

### R3. 404 页面（error_page）仅在非 ?noscript 时生效

```rust
async fn handle_not_found(...) -> Result<()> {
    if let Some(error_page) = &self.args.error_page {
        if !has_query_flag(query_params, "noscript") {
            self.handle_send_file(error_page, ...).await?;
            *res.status_mut() = StatusCode::NOT_FOUND;
            return Ok(());
        }
    }
    status_not_found(res);
    Ok(())
}
```

`?noscript` 请求时不使用自定义 404 页。

### R4. 编辑功能限制：4MB 文本文件

`EDITABLE_TEXT_MAX_SIZE = 4194304`（4MB）。大文件或二进制文件 `editable=false`，前端显示"不可编辑"提示或 iframe 预览。

### R5. 自定义 UI 若不使用 index.js，需自行实现所有 API 调用

CHECKAUTH、LOGOUT 等非标准方法，以及 `X-Update-Range: append` 断点续传协议，均需手动实现。

### R6. 认证 token 机制

`?tokengen` 生成的 token 可放入 `?token=<token>` 用于绕过 HTTP Auth（适用于带认证的下载链接）。自定义 UI 若要支持认证场景下的直接下载，需考虑此机制。

---

## 未确认 / 待深入调查

### U1. paths 数组是否有条目数上限？

`list_dir()` 遍历所有条目，未发现 `send_index` 对 `paths` 截断。
`MAX_SUBPATHS_COUNT` 只用于计算目录的 `size` 字段，不限制 paths 长度。
超大目录的 HTML 体积值得关注，但未实测。

### U2. 并发上传时 `DUFS_MAX_UPLOADINGS = 1` 为硬编码

```javascript
var DUFS_MAX_UPLOADINGS = 1;
```

无法通过 DATA 字段配置。若自定义 UI 需要并发上传，需自行管理。

### U3. COPY 方法仅支持文件，不支持目录

```rust
"COPY" => {
    let meta = fs::symlink_metadata(path).await?;
    if meta.is_dir() {
        status_forbid(res);  // 目录直接 403
        return Ok(());
    }
    fs::copy(path, &dest).await?;
}
```

自定义 UI 如要支持目录复制，无法直接使用单一 COPY 请求。

### U4. 没有批量操作 API

无批量删除、批量移动端点。所有批量操作需前端逐一发请求。

### U5. WebDAV PROPFIND 返回的路径使用 `uri_prefix`

自定义 UI 使用 WebDAV 协议访问时，href 路径含 `uri_prefix`，需注意解析。

---

## 与 REQUIREMENTS.md / DECISIONS.md 的关联

- "第三方 webui 必须是静态 index.html+css+js，可被 dufs --assets 直接指向" → **已确认**：目录中只需 index.html（必需）+ 其他静态文件（按需），无服务端逻辑
- "占位符 `__ASSETS_PREFIX__`/`__INDEX_DATA__` 由服务端替换" → **已确认**：服务端做字符串替换，替换发生在响应生成时
- index.html 是唯一服务端读取的文件，其他 JS/CSS 由浏览器按需请求 → **已确认**
