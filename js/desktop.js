import {
  api,
  assetUrl,
  baseUrl,
  formatMtime,
  formatSize,
  iconName,
  isDirectory,
  isSymlink,
  joinAbsolutePath,
  joinEntryUrl,
} from "./core.js?ui=0.1.14";
import { bauhausLabel, createIcon } from "./overlays.js?ui=0.1.14";

const PREVIEW_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
  "mp3",
  "wav",
  "ogg",
  "oga",
  "m4a",
  "flac",
  "mp4",
  "webm",
  "ogv",
  "mov",
  "m4v",
]);

function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text != null) {
    node.textContent = text;
  }
  return node;
}

function uriRoot(data) {
  const prefix = data.uri_prefix || "/";
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function entryIcon(item) {
  const img = document.createElement("img");
  img.className = "entry-icon icon--file";
  img.alt = "";
  img.decoding = "async";
  let base = iconName(item);
  if (isDirectory(item) && (item.name || "").startsWith(".")) {
    base = `${base}-hidden`;
  } else if ((item.name || "").startsWith(".")) {
    img.classList.add("entry-icon--hidden");
  }
  img.src = assetUrl(`icons/${base}.svg`);
  img.addEventListener("error", () => {
    if (img.dataset.fallback === "1") {
      img.style.visibility = "hidden";
      return;
    }
    img.dataset.fallback = "1";
    img.src = assetUrl("icons/file-generic.svg");
  });
  return img;
}

function symlinkBadge() {
  const badge = document.createElement("img");
  badge.className = "entry-badge";
  badge.alt = "Symbolic link";
  badge.src = assetUrl("icons/symlink-badge.svg");
  return badge;
}

function iconButton(icon, label, onClick, extraClass = "icon-btn icon-btn--plain") {
  const button = create("button", extraClass);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(createIcon(icon));
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}

function entryHref(item) {
  return joinEntryUrl(item.name, { directory: isDirectory(item) });
}

function extensionOf(path) {
  const last = String(path || "").split("/").pop() || "";
  const dot = last.lastIndexOf(".");
  return dot > 0 ? last.slice(dot + 1).toLowerCase() : "";
}

function isPreviewable(path) {
  return PREVIEW_EXTENSIONS.has(extensionOf(path));
}

function buildQueryUrl(changes) {
  const params = new URLSearchParams();
  Object.entries(changes).forEach(([key, value]) => {
    if (value != null && value !== "") {
      params.set(key, value);
    }
  });
  const search = params.toString();
  return `${baseUrl()}${search ? `?${search}` : ""}`;
}

function navigate(href) {
  window.location.href = href;
}

function pickFiles(context) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.style.display = "none";
  input.addEventListener("change", () => {
    if (input.files && input.files.length) {
      context.uploadQueue.add(input.files);
      context.ui.showUploadQueue();
    }
    input.remove();
  });
  document.body.append(input);
  input.click();
}

async function downloadTo(url, filename) {
  const finalUrl = await api.downloadUrl(url);
  const anchor = document.createElement("a");
  anchor.href = finalUrl;
  anchor.download = filename || "";
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function renderBreadcrumb(data) {
  const nav = create("nav", "breadcrumb");
  nav.setAttribute("aria-label", "Breadcrumb");
  const prefix = uriRoot(data);
  const segments = String(data.href || "/").split("/").filter(Boolean);

  // No home crumb — the brand mark already links to root, so at root level
  // the breadcrumb is empty (mirrors the mobile topbar).
  if (segments.length === 0) return nav;

  const crumbs = [];
  let path = prefix;
  segments.forEach((segment, index) => {
    path += `${encodeURIComponent(segment)}/`;
    crumbs.push({ label: segment, href: path, last: index === segments.length - 1 });
  });

  // Deep paths (3+ segments) collapse the middle into a "…" link pointing at
  // the parent so the trail stays readable without expand state.
  //   1 segment : current
  //   2 segments: first > current
  //   3+ segments: first > … > current
  let visible;
  if (crumbs.length <= 2) {
    visible = crumbs;
  } else {
    const parent = crumbs[crumbs.length - 2];
    visible = [
      crumbs[0],
      { label: "\u2026", href: parent.href, ellipsis: true },
      crumbs[crumbs.length - 1],
    ];
  }

  visible.forEach((item) => {
    // Always prepend a separator — the leading one anchors the trail to the
    // brand mark that acts as home.
    const sep = create("span", "breadcrumb__separator");
    sep.setAttribute("aria-hidden", "true");
    sep.append(createIcon("chevron-right"));
    nav.append(sep);

    if (item.last) {
      const current = create("span", "breadcrumb__current", item.label);
      current.setAttribute("aria-current", "page");
      nav.append(current);
    } else {
      const link = create(
        "a",
        item.ellipsis ? "breadcrumb__link breadcrumb__link--ellipsis" : "breadcrumb__link",
        item.label,
      );
      link.href = item.href;
      if (item.ellipsis) link.setAttribute("aria-label", "Parent folders");
      nav.append(link);
    }
  });
  return nav;
}

function renderBrand(data) {
  const link = create("a", "desktop-brand");
  link.href = uriRoot(data);
  link.setAttribute("aria-label", "dufs home");
  const img = document.createElement("img");
  img.className = "desktop-brand__mark";
  img.src = assetUrl("brand.svg");
  img.alt = "";
  img.decoding = "async";
  img.addEventListener("error", () => {
    img.style.visibility = "hidden";
  });
  link.append(img);
  return link;
}

function renderSearch(data, query) {
  const form = create("form", "toolbar-search");
  form.setAttribute("role", "search");
  const field = create("div", "toolbar-search__field");
  const input = create("input", "field-input");
  input.type = "search";
  input.name = "q";
  input.placeholder = "Search files...";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Search files");
  input.value = query.q || "";
  const clear = iconButton("close", "Clear search", () => {
    navigate(buildQueryUrl({}));
  }, "icon-btn icon-btn--plain toolbar-search__clear");
  clear.hidden = !query.q;
  field.append(createIcon("search"), input, clear);
  form.append(field);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    navigate(buildQueryUrl({ q: value }));
  });
  input.addEventListener("input", () => {
    clear.hidden = input.value.length === 0;
  });
  return form;
}

function renderSortHeader(label, field, query) {
  const th = create("th", field === "name" ? "col-name" : `col-${field}`);
  const active = query.sort === field || (field === "name" && !query.sort);
  const direction = active && query.order === "desc" ? "desc" : "asc";
  if (active) {
    th.setAttribute("aria-sort", direction === "desc" ? "descending" : "ascending");
  }
  const button = create("button", "th-sort", label);
  button.type = "button";
  const marker = create("span", "th-sort__marker", active ? (direction === "desc" ? "\u2193" : "\u2191") : "\u2195");
  button.append(marker);
  button.addEventListener("click", () => {
    const nextOrder = active && direction === "asc" ? "desc" : "asc";
    navigate(buildQueryUrl({ q: query.q, sort: field, order: nextOrder }));
  });
  th.append(button);
  return th;
}

function renderToolbar(data, query, context) {
  const caps = context.capabilities;
  const toolbar = create("div", "desktop-toolbar");
  toolbar.append(renderBrand(data), renderBreadcrumb(data));

  if (caps.search) {
    toolbar.append(renderSearch(data, query));
  }

  const actions = create("div", "toolbar-actions");

  if (caps.login) {
    const login = create("button", "btn");
    login.type = "button";
    login.append(bauhausLabel("Sign in"));
    login.addEventListener("click", async () => {
      try {
        await api.checkAuth(true);
      } catch {
        // Authentication prompt cancelled or rejected.
      }
      window.location.reload();
    });
    actions.append(login);
  }

  const menuItems = [];
  if (caps.upload) {
    menuItems.push({
      id: "upload",
      label: "Upload",
      run: () => pickFiles(context),
    });
  }
  if (caps.create) {
    menuItems.push({
      id: "new-folder",
      label: "New folder",
      run: () => runCreateFolder(context),
    });
    menuItems.push({
      id: "new-file",
      label: "New file",
      run: () => runCreateFile(context),
    });
  }
  if (caps.logout) {
    menuItems.push({
      id: "logout",
      label: `Sign out${data.user ? ` (${data.user})` : ""}`,
      run: () => runLogout(data),
    });
  }
  if (menuItems.length) {
    actions.append(iconButton("more", "More actions", (event) => {
      context.ui.menu(event.currentTarget, menuItems);
    }));
  }

  toolbar.append(actions);
  return toolbar;
}

function renderTable(data, query, context) {
  const table = create("table", "file-table");
  const caption = create("caption", "visually-hidden", query.q ? `Search results for ${query.q}` : "Directory contents");
  table.append(caption);

  const thead = create("thead");
  const headRow = create("tr");
  headRow.append(
    renderSortHeader("Name", "name", query),
    renderSortHeader("Last modified", "mtime", query),
    renderSortHeader("Size", "size", query),
  );
  const actionsHead = create("th", "col-actions");
  actionsHead.scope = "col";
  actionsHead.append(create("span", "visually-hidden", "Actions"));
  headRow.append(actionsHead);
  thead.append(headRow);
  table.append(thead);

  const tbody = create("tbody");
  const fragment = document.createDocumentFragment();

  (data.paths || []).forEach((item, index) => {
    const row = create("tr", "file-row");
    row.dataset.index = String(index);

    const nameCell = create("td", "col-name");
    const link = create("a", "name-cell");
    link.href = entryHref(item);
    link.append(entryIcon(item), create("span", "name-text truncate", item.name));
    if (isSymlink(item)) {
      link.append(symlinkBadge());
    }
    nameCell.append(link);

    const mtimeCell = create("td", "col-mtime mtime-cell", formatMtime(item.mtime));
    const sizeCell = create("td", "col-size size-cell", formatSize(item));

    const actionsCell = create("td", "col-actions");
    const menuButton = iconButton("more", `Actions for ${item.name}`, null, "icon-btn icon-btn--plain row-action");
    menuButton.dataset.action = "menu";
    actionsCell.append(menuButton);

    row.append(nameCell, mtimeCell, sizeCell, actionsCell);
    fragment.append(row);
  });

  tbody.append(fragment);
  table.append(tbody);

  table.addEventListener("click", (event) => {
    const button = event.target.closest(".row-action");
    if (!button) {
      return;
    }
    const row = button.closest(".file-row");
    if (!row) {
      return;
    }
    const item = (data.paths || [])[Number(row.dataset.index)];
    if (!item) {
      return;
    }
    openRowMenu(button, row, item, context);
  });

  return table;
}

function openRowMenu(anchor, row, item, context) {
  const items = rowMenuItems(item, context);
  if (!items.length) {
    return;
  }
  row.setAttribute("aria-selected", "true");
  const wrapped = items.map((entry) => ({
    ...entry,
    run: () => {
      row.removeAttribute("aria-selected");
      return entry.run();
    },
  }));
  const close = context.ui.menu(anchor, wrapped);
  close.finally(() => row.removeAttribute("aria-selected"));
}

function rowMenuItems(item, context) {
  const caps = context.capabilities;
  const directory = isDirectory(item);
  const url = entryHref(item);
  const items = [];

  if (directory) {
    if (caps.archive) {
      items.push({
        id: "download",
        label: "Download as zip",
        run: () => downloadTo(`${url}?zip`),
      });
    }
  } else {
    items.push({
      id: "download",
      label: "Download",
      run: () => downloadTo(url),
    });
    if (caps.edit) {
      items.push({
        id: "edit",
        label: "Edit",
        run: () => navigate(`${url}?edit`),
      });
    }
  }

  if (caps.move) {
    items.push({
      id: "move",
      label: "Rename / Move",
      run: () => runMove(item, url, context),
    });
  }
  if (!directory && caps.copy) {
    items.push({
      id: "copy",
      label: "Copy",
      run: () => runCopy(item, url, context),
    });
  }
  if (caps.remove) {
    items.push({
      id: "delete",
      label: "Delete",
      danger: true,
      run: () => runDelete(item, url, context),
    });
  }
  return items;
}

function itemRootPath(item, data) {
  const dir = String(data.href || "/").replace(/^\/+|\/+$/g, "");
  return dir ? `${dir}/${item.name}` : item.name;
}

async function confirmOverwrite(url, context, label) {
  const response = await api.head(url);
  if (response.status !== 200) {
    return true;
  }
  return context.ui.confirm({
    title: "Overwrite?",
    message: `"${label}" already exists. Overwrite it?`,
    confirmLabel: "Overwrite",
    danger: true,
  });
}

async function runMove(item, srcUrl, context) {
  const currentPath = itemRootPath(item, context.data);
  const input = await context.ui.prompt({
    title: "Rename or move",
    label: "New path",
    value: currentPath,
    cursorAtEnd: true,
    confirmLabel: "Move",
  });
  if (input == null || !input.trim()) {
    return;
  }
  const destination = joinAbsolutePath(input.trim());
  try {
    if (!(await confirmOverwrite(destination, context, input.trim()))) {
      return;
    }
    await api.move(srcUrl, destination);
    window.location.reload();
  } catch (error) {
    context.ui.showFatal(error);
  }
}

async function runCopy(item, srcUrl, context) {
  const input = await context.ui.prompt({
    title: "Copy file",
    label: "Destination path",
    value: itemRootPath(item, context.data),
    confirmLabel: "Copy",
  });
  if (input == null || !input.trim()) {
    return;
  }
  const destination = joinAbsolutePath(input.trim());
  try {
    if (!(await confirmOverwrite(destination, context, input.trim()))) {
      return;
    }
    await api.copy(srcUrl, destination);
    window.location.reload();
  } catch (error) {
    context.ui.showFatal(error);
  }
}

async function runDelete(item, srcUrl, context) {
  const confirmed = await context.ui.confirm({
    title: "Delete",
    message: `Delete "${item.name}"?`,
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  try {
    await api.delete(srcUrl);
    window.location.reload();
  } catch (error) {
    context.ui.showFatal(error);
  }
}

async function runCreateFolder(context) {
  const name = await context.ui.prompt({
    title: "New folder",
    label: "Folder name",
    value: "",
    confirmLabel: "Create",
  });
  if (name == null || !name.trim()) {
    return;
  }
  try {
    await api.mkcol(joinEntryUrl(name.trim(), { directory: true }));
    window.location.reload();
  } catch (error) {
    context.ui.showFatal(error);
  }
}

async function runCreateFile(context) {
  const name = await context.ui.prompt({
    title: "New file",
    label: "File name",
    value: "",
    confirmLabel: "Create",
  });
  if (name == null || !name.trim()) {
    return;
  }
  const url = joinEntryUrl(name.trim());
  try {
    await api.put(url, "");
    navigate(`${url}?edit`);
  } catch (error) {
    context.ui.showFatal(error);
  }
}

async function runLogout(data) {
  try {
    await api.logout(data.user);
  } catch {
    // Fall through to navigation regardless of the XHR result.
  }
  window.location.href = baseUrl();
}

const EMPTY_COPY = {
  empty: { title: "This folder is empty", message: "Upload files or create a folder to get started." },
  search: { title: "No matches", message: "No files or folders match the current search." },
  pending: { title: "Folder not found", message: "It will be created when you upload the first file." },
};

function renderEmpty(container, kind, query, context) {
  const copy = EMPTY_COPY[kind] || EMPTY_COPY.empty;
  const spec = {
    kind,
    query: query.q,
    capabilities: context.capabilities,
    onUpload: () => pickFiles(context),
    onCreateFolder: () => runCreateFolder(context),
    onNewFile: () => runCreateFile(context),
    onClearSearch: () => navigate(buildQueryUrl({})),
    title: copy.title,
    message: copy.message,
  };
  context.ui.emptyState(container, spec);
}

/**
 * Build the desktop chrome once. Creates desktop-shell, desktop-main,
 * renders the full toolbar (breadcrumb + search + actions), and appends
 * an empty desktop-content container.
 *
 * @param {Element} root     – mount point (will be cleared)
 * @param {object}  context  – { data, query, capabilities, ui, … }
 * @returns {{ contentEl: Element, toolbarEl: Element }}
 */
export function renderDesktopShell(root, context) {
  root.textContent = "";

  const { data, query } = context;
  const shell = create("div", "desktop-shell");
  const main = create("div", "desktop-main");

  const toolbarEl = renderToolbar(data, query, context);
  main.append(toolbarEl);

  const contentEl = create("div", "desktop-content");
  main.append(contentEl);
  shell.append(main);
  root.append(shell);

  return { contentEl, toolbarEl };
}

/**
 * Re-render only the file list area. Safe to call on every navigation.
 *
 * @param {Element} contentEl – the .desktop-content element from renderDesktopShell
 * @param {object}  context   – { data, query, … }
 */
export function updateDesktopContent(contentEl, context) {
  contentEl.textContent = "";

  const { data, query } = context;
  const paths = data.paths || [];
  if (paths.length === 0) {
    const variant = query.q ? "search" : data.dir_exists === false ? "pending" : "empty";
    renderEmpty(contentEl, variant, query, context);
  } else {
    contentEl.append(renderTable(data, query, context));
  }
}

/**
 * Re-render only the dynamic parts of the toolbar:
 *   – replaces the .breadcrumb element
 *   – syncs the search input value
 *
 * @param {Element} toolbarEl – the .desktop-toolbar element from renderDesktopShell
 * @param {object}  context   – { data, query, … }
 */
export function updateDesktopToolbar(toolbarEl, context) {
  const { data, query } = context;

  // Replace breadcrumb
  const oldBreadcrumb = toolbarEl.querySelector(".breadcrumb");
  const newBreadcrumb = renderBreadcrumb(data);
  if (oldBreadcrumb) {
    toolbarEl.replaceChild(newBreadcrumb, oldBreadcrumb);
  }

  // Search input value is owned by the user — only cleared on explicit submit
  // or clear action, never on directory navigation.
}

/**
 * Original entry-point kept for backward compatibility.
 * Delegates to renderDesktopShell + updateDesktopContent.
 */
export function renderDesktopIndex(root, context) {
  const { contentEl } = renderDesktopShell(root, context);
  updateDesktopContent(contentEl, context);
}

export function renderEditor(root, context) {
  root.textContent = "";

  const { data } = context;
  const caps = context.capabilities;
  const shell = create("div", "editor-shell");

  const toolbar = create("header", "editor-toolbar");
  toolbar.append(renderBreadcrumb(data));

  const actions = create("div", "editor-toolbar__actions");
  actions.append(iconButton("download", "Download", () => downloadTo(baseUrl())));

  let saveButton = null;
  const canSave = data.kind === "Edit" && data.editable === true && caps.edit;
  if (canSave) {
    saveButton = create("button", "btn btn--primary");
    saveButton.type = "button";
    saveButton.append(bauhausLabel("Save"));
    saveButton.disabled = true;
    actions.append(saveButton);
  }
  toolbar.append(actions);

  const body = create("div", "editor-body");
  shell.append(toolbar, body);
  root.append(shell);

  const fileUrl = baseUrl();
  const canEditText = data.editable === true;

  if (canEditText) {
    const textarea = create("textarea", "editor-textarea");
    textarea.spellcheck = false;
    textarea.setAttribute("aria-label", "File contents");
    if (data.kind === "View") {
      textarea.readOnly = true;
    }
    body.append(textarea);

    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        saveButton.disabled = true;
        try {
          await api.put(fileUrl, textarea.value);
          window.location.reload();
        } catch (error) {
          context.ui.showFatal(error);
          saveButton.disabled = false;
        }
      });
    }

    loadText(textarea, saveButton, fileUrl, context);
    return;
  }

  if (isPreviewable(data.href)) {
    const frame = create("iframe", "editor-preview");
    frame.setAttribute("sandbox", "");
    frame.setAttribute("title", `Preview of ${data.href}`);
    frame.src = fileUrl;
    body.append(frame);
    return;
  }

  const message = create("div", "editor-message");
  message.append(
    create("p", "editor-message__title", data.kind === "View" ? "Preview unavailable" : "Editing unavailable"),
    create(
      "p",
      "editor-message__text",
      "This file cannot be shown in the browser. Download it to open locally.",
    ),
  );
  const download = create("button", "btn btn--primary");
  download.type = "button";
  download.append(bauhausLabel("Download"));
  download.addEventListener("click", () => downloadTo(fileUrl));
  message.append(download);
  body.append(message);
}

async function loadText(textarea, saveButton, url, context) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load file (${response.status})`);
    }
    textarea.value = await response.text();
  } catch (error) {
    context.ui.showFatal(error);
    textarea.value = "";
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
    }
  }
}
