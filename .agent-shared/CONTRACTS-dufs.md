# dufs --assets Exact Contract

> Collected by dufs-scout, based on source analysis of dufs/ (read-only reference).
> Covers: current main branch.

---

## 1. --assets Directory Requirements

**Source:** `src/args.rs` `sanitize_assets_path()` lines 397–411

```
fn sanitize_assets_path<P: AsRef<Path>>(path: P) -> Result<PathBuf> {
    let path = Self::sanitize_path(path)?;
    if !path.join("index.html").exists() {
        bail!("Path `{}` doesn't contains index.html", path.display());
    }
    Ok(path)
}
```

| File | Required/Optional | Behavior |
|------|-------------------|----------|
| `index.html` | **Required** | `bail!` on startup if missing |
| `404.html` | Optional | If present, assigned to `args.error_page` as a custom 404 page |
| Other static files (`index.js`, `index.css`, `favicon.ico`, images, etc.) | Optional | Served on demand under the `__dufs_v{VERSION}__/` prefix |

**Configuration:**
- CLI: `--assets <path>`
- Environment variable: `DUFS_ASSETS=<path>`
- Config file: `assets: <path>`

The path is first processed by `sanitize_path()` (existence check + `canonicalize`), then checked for `index.html`.

---

## 2. index.html Placeholder Replacement

**Source:** `src/server.rs`

### Two Placeholders

| Placeholder | Replacement Value | Replacement Scope |
|-------------|-------------------|-------------------|
| `__ASSETS_PREFIX__` | `{uri_prefix}{assets_prefix}` i.e. `/{path-prefix?}__dufs_v{VERSION}__/` | All occurrences in HTML |
| `__INDEX_DATA__` | base64(JSON(IndexData or EditData)) | All occurrences in HTML |

### Replacement Code (`send_index`, lines ~1304–1310)

```rust
let index_data = STANDARD.encode(serde_json::to_string(&data)?);
self.html
    .replace(
        "__ASSETS_PREFIX__",
        &format!("{}{}", self.args.uri_prefix, self.assets_prefix),
    )
    .replace("__INDEX_DATA__", &index_data)
```

`handle_edit_file` (lines ~1020–1040) performs the same replacement with `EditData`.

### assets_prefix Value

```rust
// server.rs:72
let assets_prefix = format!("__dufs_v{}__/", env!("CARGO_PKG_VERSION"));
```

Example: dufs v0.40.0 → `__dufs_v0.40.0__/`

### Usage Example in Original index.html

```html
<!-- assets/index.html -->
<link rel="icon" type="image/x-icon" href="__ASSETS_PREFIX__favicon.ico">
<link rel="stylesheet" href="__ASSETS_PREFIX__index.css">
<template id="index-data">__INDEX_DATA__</template>
<script src="__ASSETS_PREFIX__index.js"></script>
```

---

## 3. `__dufs_v{VERSION}__/` Static Asset Serving

**Source:** `src/server.rs` `handle_internal()` lines 790–840

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
                "index.js" => { /* built-in */ }
                "index.css" => { /* built-in */ }
                "favicon.ico" => { /* built-in */ }
                _ => { status_not_found(res); }
            },
        }
        // Cache headers injected uniformly
        res.headers_mut().insert("cache-control",
            HeaderValue::from_static("public, max-age=31536000, immutable"));
        res.headers_mut().insert("x-content-type-options",
            HeaderValue::from_static("nosniff"));
        Ok(true)
    } else if req_path == HEALTH_CHECK_PATH { ... }
}
```

**Rules summary:**
- Requests whose path begins with `__dufs_v{VERSION}__/` enter this branch
- With `--assets`: serve from `assets_dir/name`; 404 if not found
- Without `--assets`: only `index.js`, `index.css`, and `favicon.ico` are built-in; all others 404
- All static asset responses include `Cache-Control: public, max-age=31536000, immutable`
- HTTP access log skips these paths (server.rs line ~105)

**Practical implication:** Any file placed in the custom assets directory (e.g. `app.css`, `app.js`, images) is accessible via `__ASSETS_PREFIX__app.css`.

---

## 4. IndexData / EditData Full Field Reference

### 4a. IndexData (directory listing and search results)

**Source:** `src/server.rs` lines 1553–1568, `send_index()` lines ~1295

```rust
pub struct IndexData {
    pub href: String,           // current directory relative path, e.g. "/" or "/subdir"
    pub kind: DataKind,         // always "Index"
    pub uri_prefix: String,     // URL prefix, e.g. "/" or "/myprefix/"
    pub allow_upload: bool,     // server allows upload AND current user has read-write access
    pub allow_delete: bool,     // server allows delete AND current user has read-write access
    pub allow_search: bool,     // server allows search (not gated by user permission)
    pub allow_archive: bool,    // server allows zip download (not gated by user permission)
    pub dir_exists: bool,       // whether the current directory actually exists on disk (false = pending creation)
    pub auth: bool,             // whether the server has authentication enabled (AccessControl::has_users())
    pub user: Option<String>,   // authenticated username; null for anonymous
    pub paths: Vec<PathItem>,   // sorted directory entry list
}
```

**Note:** `allow_upload` and `allow_delete` are the intersection of global permission and user read-write access:
```rust
allow_upload: self.args.allow_upload && readwrite,
allow_delete: self.args.allow_delete && readwrite,
```

### 4b. EditData (file edit/view page)

**Source:** `src/server.rs` lines 1660–1670, `handle_edit_file()` lines ~1005

```rust
struct EditData {
    href: String,           // current file relative path
    kind: DataKind,         // "Edit" or "View"
    uri_prefix: String,     // URL prefix
    allow_upload: bool,     // server allows upload (directly from args.allow_upload, no user filter)
    allow_delete: bool,     // server allows delete (directly from args.allow_delete)
    auth: bool,             // whether authentication is enabled
    user: Option<String>,   // current user
    editable: bool,         // file is editable: size <= 4MB AND content detected as text
}
```

**editable determination logic:**
```rust
const EDITABLE_TEXT_MAX_SIZE: u64 = 4194304; // 4MB
let editable = meta.len() <= EDITABLE_TEXT_MAX_SIZE
    && content_inspector::inspect(&buffer).is_text();
```

### 4c. PathItem (each entry in the paths array)

**Source:** `src/server.rs` lines 1569–1575

```rust
pub struct PathItem {
    pub path_type: PathType,  // "Dir" | "SymlinkDir" | "File" | "SymlinkFile"
    pub name: String,         // path relative to the current directory; directories have no trailing slash
    pub mtime: u64,           // Unix timestamp in milliseconds; 0 means unavailable
    pub size: u64,            // file = byte count; directory = child entry count (capped at 1000)
}
```

**PathType enum:**

| Value | Meaning |
|-------|---------|
| `"Dir"` | Regular directory |
| `"SymlinkDir"` | Symlink pointing to a directory |
| `"File"` | Regular file |
| `"SymlinkFile"` | Symlink pointing to a file |

**Special meaning of directory size:**
```rust
// server.rs to_pathitem(), for PathType::Dir or SymlinkDir:
let mut count = 0;
// iterate child entries; stop when count exceeds MAX_SUBPATHS_COUNT(1000)
if count >= MAX_SUBPATHS_COUNT { break; }
```
So a directory's `size` field = number of child entries (hidden files excluded), max 1000 (shows >999 when exceeded).

### 4d. DataKind Enum

| Value | Trigger Condition |
|-------|-------------------|
| `"Index"` | GET directory, search results |
| `"Edit"` | GET file + `?edit` parameter |
| `"View"` | GET file + `?view` parameter |

---

## 5. File Operation API

### 5a. Basic CRUD

| Method | Path | Conditions/Headers | Response | Notes |
|--------|------|--------------------|----------|-------|
| `PUT` | `/path/to/file` | `allow_upload=true` | 201 Created / 403 / 405 | Create or overwrite file; overwriting a non-empty existing file also requires `allow_delete=true` |
| `PATCH` | `/path/to/file` | `allow_upload=true`; `X-Update-Range: append` | 204 No Content | Resumable upload append; offset < size also requires `allow_delete=true` |
| `PATCH` | `/path/to/file` | `allow_upload=true`; `X-Update-Range: {range}` | 204 No Content | Overwrite a specific byte range |
| `DELETE` | `/path/to/file-or-dir` | `allow_delete=true` | 204 No Content | Delete file or recursively delete directory |
| `MKCOL` | `/path/to/newdir` | `allow_upload=true` | 201 Created | Create directory (including parents) |
| `MOVE` | `/path/to/src` | `allow_upload && allow_delete`; `Destination: <url>` | 204 No Content | Move / rename |
| `COPY` | `/path/to/src` | `allow_upload=true`; `Destination: <url>` | 204 No Content | Copy file (directories not supported) |

### 5b. GET File / Directory

| Query Parameter | Behavior |
|-----------------|----------|
| (none, directory) | Return HTML directory listing (contains `__INDEX_DATA__`) |
| `?q=keyword` | Search directory (requires `allow_search=true`), returns HTML |
| `?json` | Return IndexData or PathItem (for files) as JSON |
| `?simple` | Return plain-text name list (`name/\n` format) |
| `?zip` | Download directory as zip (requires `allow_archive=true`) |
| `?noscript` | Return no-JS HTML (noscript fallback) |
| `?edit` | File editor page (kind=Edit) |
| `?view` | File viewer page (kind=View) |
| `?hash` | Return file SHA-256 hash (requires `allow_hash=true`) |
| `?sort=name\|mtime\|size` | Sort field |
| `?order=asc\|desc` | Sort direction |
| `?tokengen` | Generate download token (for authenticated downloads) |
| `?token=<token>` | Authenticate with token |

### 5c. Special Methods

| Method | Path | Notes |
|--------|------|-------|
| `CHECKAUTH` | Any path | Verify authentication; `?login` forces the auth prompt; response body is username or empty |
| `LOGOUT` | Any path | Triggers 401 to clear client credentials |
| `PROPFIND` | Any path | WebDAV property query (Depth: 0 or 1) |
| `OPTIONS` | Any path | Returns WebDAV Allow header |
| `HEAD` | Any file | Get `content-length` for resume offset detection |

### 5d. Health Check

```
GET /__dufs__/health
→ 200 {"status":"OK"}
```

### 5e. Resumable Upload Flow

```sh
# 1. Get the already-uploaded offset
upload_offset=$(curl -I -s http://host/file | grep -i content-length | awk '{print $2}' | tr -d '\r')
# 2. Continue upload
dd skip=$upload_offset if=file status=none ibs=1 | \
  curl -X PATCH -H "X-Update-Range: append" --data-binary @- http://host/file
```

Frontend `Uploader.retry()` implementation:
1. `HEAD` request to get `content-length`
2. Resume with `PATCH + X-Update-Range: append + file.slice(offset)`

### 5f. Range Download

Standard `Range: bytes=start-end` requests are supported (HTTP 206).
Multi-range requests (`multipart/byteranges`) are supported.
`If-Modified-Since` / `If-None-Match` / `ETag` are all supported.

### 5g. Authentication

- Both HTTP Basic Auth and Digest Auth are supported
- Default authentication method is Digest (`--auth-method` can switch to basic)
- SHA-512 hashed passwords are supported (`$6$...` format); hashed passwords are incompatible with Digest Auth

---

## 6. Frontend INDEX_DATA Parsing

### 6a. Data Reading (`assets/index.js`)

```javascript
// index.js lines 175–180
window.addEventListener("DOMContentLoaded", async () => {
  const $indexData = document.getElementById('index-data');
  if (!$indexData) { alert("No data"); return; }
  DATA = JSON.parse(decodeBase64($indexData.innerHTML));
  // ...
});
```

- Data carrier: `<template id="index-data">__INDEX_DATA__</template>`
- Decoding: `decodeBase64()` (line ~985) → `atob()` + `TextDecoder` for Unicode
- Parsing: `JSON.parse()`

### 6b. DATA.kind Branch (line ~228)

```javascript
if (DATA.kind === "Index") {
    // directory listing: setupIndexPage()
} else if (DATA.kind === "Edit") {
    // editor page: setupEditorPage()
} else if (DATA.kind === "View") {
    // viewer page: setupEditorPage() (editor.readonly=true)
}
```

### 6c. Key Functions and Line Numbers

| Function | Line (approx.) | HTTP Method | Notes |
|----------|----------------|-------------|-------|
| `Uploader.ajax()` | ~215 | `PUT` / `PATCH+X-Update-Range:append` | File upload / resume |
| `Uploader.retry()` | ~241 | `HEAD` + `PATCH` | Resumable upload retry |
| `deletePath()` | ~702 | — | Entry point, calls doDeletePath |
| `doDeletePath()` | ~716 | `DELETE` | Actual delete request |
| `movePath()` | ~733 | — | Entry point, calls doMovePath |
| `doMovePath()` | ~741 | `HEAD` + `MOVE+Destination` | Move / rename |
| `saveChange()` | ~794 | `PUT` | Save editor content |
| `checkAuth()` | ~804 | `CHECKAUTH` | Verify authentication |
| `logout()` | ~816 | `LOGOUT` | Log out |
| `createFolder()` | ~825 | `MKCOL` | Create directory |
| `createFile()` | ~836 | `PUT` (empty body) | Create empty file |
| `decodeBase64()` | ~985 | — | Unicode-safe base64 decode |
| `addBreadcrumb()` | ~328 | — | Uses DATA.href + DATA.uri_prefix |
| `setupIndexPage()` | ~374 | — | Checks DATA.allow_* to control UI |

### 6d. DATA Field Usage Reference

| Field | Used For |
|-------|----------|
| `DATA.href` | Breadcrumb navigation path |
| `DATA.uri_prefix` | URL assembly base |
| `DATA.kind` | Determines render mode |
| `DATA.allow_upload` | Controls upload / new folder / new file button visibility |
| `DATA.allow_delete` | Controls delete / move / edit button visibility |
| `DATA.allow_search` | Controls search bar visibility |
| `DATA.allow_archive` | Controls zip download button |
| `DATA.auth` | Controls login/logout button; whether to call CHECKAUTH |
| `DATA.user` | Display username; token download feature |
| `DATA.dir_exists` | Empty directory hint text |
| `DATA.paths` | Render file list |
| `DATA.editable` | (EditData) Controls save button and iframe preview |

---

## 7. Server.init() HTML Loading

```rust
// server.rs lines ~82–88
let html = match args.assets.as_ref() {
    Some(path) => Cow::Owned(std::fs::read_to_string(path.join("index.html"))?),
    None => Cow::Borrowed(INDEX_HTML),
};
```

The HTML template is **loaded into memory once at server startup** (`Cow::Owned`); each subsequent request performs string replacement.
Therefore, changes to `index.html` on disk require a **dufs restart** to take effect.

---

## 8. Built-in Asset Files (available without --assets)

| URL Path | Content-Type |
|----------|-------------|
| `__dufs_v{V}__/index.js` | `application/javascript; charset=UTF-8` |
| `__dufs_v{V}__/index.css` | `text/css; charset=UTF-8` |
| `__dufs_v{V}__/favicon.ico` | `image/x-icon` |

---

## 9. Response Headers Summary

| Header | Value | Source |
|--------|-------|--------|
| `Cache-Control` (index) | `no-cache` | send_index / handle_edit_file |
| `Cache-Control` (assets) | `public, max-age=31536000, immutable` | handle_internal |
| `X-Content-Type-Options` | `nosniff` | handle_internal + send_index |
| `Content-Type` (index) | `text/html; charset=utf-8` | send_index |
| `Accept-Ranges` | `bytes` | handle_send_file |
