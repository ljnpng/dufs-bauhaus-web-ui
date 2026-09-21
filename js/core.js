export const UI_VERSION = "0.1.14";

const VALID_KINDS = ["Index", "Edit", "View"];
const SORT_FIELDS = ["name", "mtime", "size"];
const EXT_ICONS = {
  txt: "file-txt",
  md: "file-md",
  markdown: "file-md",
  json: "file-json",
  js: "file-js",
  mjs: "file-js",
  cjs: "file-js",
  ts: "file-js",
  tsx: "file-js",
  jsx: "file-js",
  py: "file-py",
  java: "file-java",
  pdf: "file-pdf",
  zip: "file-zip",
  tar: "file-zip",
  gz: "file-zip",
  tgz: "file-zip",
  "7z": "file-zip",
  rar: "file-zip",
  jpg: "file-image",
  jpeg: "file-image",
  png: "file-image",
  gif: "file-image",
  webp: "file-image",
  svg: "file-image",
};

let DATA = null;

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function encodePath(path) {
  return String(path == null ? "" : path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function uriPrefix() {
  const raw = (DATA && DATA.uri_prefix) || "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export function parseIndexData() {
  const el = document.getElementById("index-data");
  if (!el) {
    throw new Error("Missing #index-data element");
  }
  const encoded = (el.innerHTML || "").trim();
  if (!encoded) {
    throw new Error("Empty index data");
  }
  let parsed;
  try {
    parsed = JSON.parse(decodeBase64(encoded));
  } catch (err) {
    throw new Error(`Failed to decode index data: ${err.message}`);
  }
  if (!parsed || !VALID_KINDS.includes(parsed.kind)) {
    throw new Error(`Unknown data kind: ${parsed && parsed.kind}`);
  }
  DATA = parsed;
  return parsed;
}

export function getQueryState() {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get("sort") || "";
  const order = params.get("order") || "";
  return {
    q: params.get("q") || "",
    sort: SORT_FIELDS.includes(sort) ? sort : "",
    order: order === "asc" || order === "desc" ? order : "",
  };
}

export function assetUrl(path) {
  const prefix = document.body.dataset.assetsPrefix || "./";
  const clean = String(path == null ? "" : path).replace(/^\/+/, "");
  const separator = clean.includes("?") ? "&" : "?";
  return `${prefix}${clean}${separator}ui=${UI_VERSION}`;
}

export function baseUrl() {
  return window.location.pathname;
}

export function joinEntryUrl(name, options = {}) {
  const base = baseUrl();
  const baseDir = base.endsWith("/") ? base : `${base}/`;
  const trailing = options.directory === true ? "/" : "";
  return `${baseDir}${encodePath(name)}${trailing}`;
}

export function joinAbsolutePath(path) {
  const clean = String(path == null ? "" : path).replace(/^\/+/, "");
  return `${window.location.origin}${uriPrefix()}${encodePath(clean)}`;
}

export function isDirectory(item) {
  return item.path_type === "Dir" || item.path_type === "SymlinkDir";
}

export function isSymlink(item) {
  return item.path_type === "SymlinkDir" || item.path_type === "SymlinkFile";
}

export function formatMtime(ms) {
  if (!ms) {
    return "\u2014";
  }
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return "\u2014";
  }
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function formatSize(item) {
  if (isDirectory(item)) {
    const count = item.size || 0;
    if (count >= 1000) {
      return ">999 items";
    }
    return `${count} item${count === 1 ? "" : "s"}`;
  }
  const bytes = item.size || 0;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) {
    return `${value} ${units[unit]}`;
  }
  return `${Number(value.toFixed(1))} ${units[unit]}`;
}

export function iconName(item) {
  if (isDirectory(item)) {
    return (item.size || 0) === 0 ? "folder-empty" : "folder-non-empty";
  }
  const name = item.name || "";
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return EXT_ICONS[ext] || "file-generic";
}

export function capabilities(data) {
  const kind = data.kind;
  const allowUpload = Boolean(data.allow_upload);
  const allowDelete = Boolean(data.allow_delete);
  const auth = Boolean(data.auth);
  const user = data.user == null ? null : data.user;
  const isIndex = kind === "Index";
  const isView = kind === "View";
  return {
    upload: isIndex && allowUpload,
    create: isIndex && allowUpload,
    copy: isIndex && allowUpload,
    remove: isIndex && allowDelete,
    move: isIndex && allowUpload && allowDelete,
    edit: isView ? false : allowUpload && allowDelete,
    search: isIndex && Boolean(data.allow_search),
    archive: isIndex && Boolean(data.allow_archive),
    login: auth && !user,
    logout: auth && Boolean(user),
  };
}

function httpError(status, body, statusText) {
  const error = new Error(body || statusText || `Request failed with status ${status}`);
  error.status = status;
  error.body = body || "";
  return error;
}

async function ensureOk(response) {
  if (response.ok) {
    return response;
  }
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "";
  }
  throw httpError(response.status, body, response.statusText);
}

function head(url) {
  return fetch(url, { method: "HEAD" });
}

async function put(url, body) {
  return ensureOk(await fetch(url, { method: "PUT", body }));
}

async function patch(url, body, range) {
  const headers = {};
  if (range) {
    headers["X-Update-Range"] = range;
  }
  return ensureOk(await fetch(url, { method: "PATCH", headers, body }));
}

function patchAppend(url, body) {
  return patch(url, body, "append");
}

async function remove(url) {
  return ensureOk(await fetch(url, { method: "DELETE" }));
}

async function mkcol(url) {
  return ensureOk(await fetch(url, { method: "MKCOL" }));
}

async function move(src, destination) {
  return ensureOk(
    await fetch(src, { method: "MOVE", headers: { Destination: destination } }),
  );
}

async function copy(src, destination) {
  return ensureOk(
    await fetch(src, { method: "COPY", headers: { Destination: destination } }),
  );
}

async function checkAuth(forceLogin = false) {
  if (!DATA || !DATA.auth) {
    return null;
  }
  const url = `${baseUrl()}${forceLogin ? "?login" : ""}`;
  const response = await fetch(url, { method: "CHECKAUTH" });
  await ensureOk(response);
  return response.text();
}

function logout(user) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("LOGOUT", baseUrl(), true, user || undefined);
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error("Logout failed"));
    xhr.send();
  });
}

async function downloadUrl(url) {
  if (!DATA || !DATA.user) {
    return url;
  }
  try {
    const generator = new URL(url, window.location.origin);
    generator.searchParams.set("tokengen", "");
    const response = await fetch(generator.toString());
    if (!response.ok) {
      return url;
    }
    const token = (await response.text()).trim();
    if (!token) {
      return url;
    }
    const finalUrl = new URL(url, window.location.origin);
    finalUrl.searchParams.set("token", token);
    return finalUrl.toString();
  } catch {
    return url;
  }
}

export const api = {
  head,
  put,
  patch,
  patchAppend,
  delete: remove,
  mkcol,
  move,
  copy,
  checkAuth,
  logout,
  downloadUrl,
};

function uploadRequest({ method, url, body, range }, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (range) {
      xhr.setRequestHeader("X-Update-Range", range);
    }
    if (onProgress && xhr.upload) {
      xhr.upload.addEventListener("progress", onProgress);
    }
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr);
      } else {
        reject(httpError(xhr.status, xhr.responseText, xhr.statusText));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
    xhr.send(body);
  });
}

export function createUploadQueue(options = {}) {
  const maxConcurrent = 1;
  const listeners = new Set();
  const items = [];
  let running = 0;
  let sequence = 0;
  let beforeUnloadBound = false;

  function snapshot() {
    return items.map((item) => ({ ...item }));
  }

  function hasPending() {
    return items.some((item) => item.status === "queued" || item.status === "running");
  }

  function beforeUnloadHandler(event) {
    event.preventDefault();
    event.returnValue = "";
  }

  function syncBeforeUnload() {
    if (hasPending() && !beforeUnloadBound) {
      window.addEventListener("beforeunload", beforeUnloadHandler);
      beforeUnloadBound = true;
    } else if (!hasPending() && beforeUnloadBound) {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      beforeUnloadBound = false;
    }
  }

  function emit() {
    const list = snapshot();
    listeners.forEach((listener) => listener(list));
    if (typeof options.onUpdate === "function") {
      options.onUpdate(list);
    }
    syncBeforeUnload();
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  }

  function confirmOverwrite(item) {
    if (typeof options.confirm === "function") {
      return options.confirm({
        title: "Overwrite file?",
        message: `The server already has a larger "${item.name}". Overwrite it?`,
        confirmLabel: "Overwrite",
        danger: true,
      });
    }
    return Promise.resolve(true);
  }

  async function send(item, method, body, range) {
    const baseOffset = range === "append" ? item.offset || 0 : 0;
    await uploadRequest({ method, url: item.url, body, range }, (event) => {
      if (!event.lengthComputable) {
        return;
      }
      item.uploaded = baseOffset + event.loaded;
      item.loaded = item.uploaded;
      item.progress = item.size ? Math.min(1, item.uploaded / item.size) : 1;
      emit();
    });
  }

  async function resume(item) {
    const response = await api.head(item.url);
    let offset = 0;
    let exists = false;
    if (response.status === 200) {
      exists = true;
      offset = Number(response.headers.get("content-length")) || 0;
    }
    if (exists && offset === item.size) {
      item.uploaded = item.size;
      item.loaded = item.size;
      item.progress = 1;
      return;
    }
    if (exists && offset > item.size) {
      const confirmed = await confirmOverwrite(item);
      if (!confirmed) {
        throw new Error("Upload cancelled");
      }
      item.offset = 0;
      await send(item, "PUT", item.file, null);
      return;
    }
    if (exists && offset > 0) {
      item.offset = offset;
      item.uploaded = offset;
      item.loaded = offset;
      item.progress = item.size ? offset / item.size : 0;
      emit();
      await send(item, "PATCH", item.file.slice(offset), "append");
      return;
    }
    item.offset = 0;
    await send(item, "PUT", item.file, null);
  }

  async function process(item) {
    item.status = "running";
    item.error = null;
    emit();
    try {
      await checkAuth(false);
      if (item.resume) {
        await resume(item);
      } else {
        await send(item, "PUT", item.file, null);
      }
      item.status = "complete";
      item.progress = 1;
      item.uploaded = item.size;
      item.loaded = item.size;
    } catch (error) {
      item.status = "failed";
      item.error = error;
    }
    emit();
  }

  function pump() {
    while (running < maxConcurrent) {
      const next = items.find((item) => item.status === "queued");
      if (!next) {
        return;
      }
      running += 1;
      process(next).finally(() => {
        running -= 1;
        emit();
        pump();
      });
    }
  }

  function add(files, addOptions = {}) {
    const list = Array.from(files || []).filter((file) => file instanceof File);
    list.forEach((file) => {
      const relativeName =
        file.webkitRelativePath && file.webkitRelativePath.length
          ? file.webkitRelativePath
          : file.name;
      const path = addOptions.basePath
        ? `${String(addOptions.basePath).replace(/\/+$/, "")}/${relativeName}`
        : relativeName;
      items.push({
        id: `upload-${(sequence += 1)}`,
        file,
        name: relativeName,
        url: joinEntryUrl(path, { directory: false }),
        status: "queued",
        progress: 0,
        uploaded: 0,
        loaded: 0,
        size: file.size,
        total: file.size,
        attempt: 0,
        resume: false,
        offset: 0,
        error: null,
      });
    });
    emit();
    pump();
    return list;
  }

  function retry(id) {
    const item = items.find((entry) => entry.id === id || entry.name === id);
    if (!item) {
      return false;
    }
    item.attempt += 1;
    item.resume = true;
    item.status = "queued";
    item.error = null;
    emit();
    pump();
    return true;
  }

  function retryAll() {
    items.forEach((item) => {
      if (item.status === "failed") {
        item.attempt += 1;
        item.resume = true;
        item.status = "queued";
        item.error = null;
      }
    });
    emit();
    pump();
  }

  function remove(id) {
    const index = items.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return false;
    }
    if (items[index].status === "running") {
      return false;
    }
    items.splice(index, 1);
    emit();
    return true;
  }

  function clear() {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].status !== "running") {
        items.splice(i, 1);
      }
    }
    emit();
  }

  return {
    add,
    retry,
    retryAll,
    remove,
    clear,
    subscribe,
    hasPending,
    getItems: snapshot,
  };
}

export async function fetchDirectory(url) {
  const separator = url.includes("?") ? "&" : "?";
  const response = await fetch(`${url}${separator}json`);
  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "";
    }
    throw httpError(response.status, body, response.statusText);
  }
  return response.json();
}

export function createRouter(onNavigate) {
  function buildUrl(pathname, query) {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.sort) params.set("sort", query.sort);
    if (query.order) params.set("order", query.order);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function onPopState() {
    onNavigate(location.pathname, getQueryState());
  }

  function init() {
    window.addEventListener("popstate", onPopState);
  }

  function push(pathname, query) {
    history.pushState(null, "", buildUrl(pathname, query));
    onNavigate(pathname, query);
  }

  function replace(pathname, query) {
    history.replaceState(null, "", buildUrl(pathname, query));
  }

  function destroy() {
    window.removeEventListener("popstate", onPopState);
  }

  return { init, push, replace, destroy };
}
