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
} from "./core.js?ui=0.1.0";
import { createIcon, renderEmptyState } from "./overlays.js?ui=0.1.0";

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
      if (context.ui && typeof context.ui.showUploadQueue === "function") {
        context.ui.showUploadQueue();
      }
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

  const root = create("a", "breadcrumb__link");
  root.href = prefix;
  root.setAttribute("aria-label", "Root");
  root.append(createIcon("home"));
  nav.append(root);

  let path = prefix;
  segments.forEach((segment, index) => {
    nav.append(create("span", "breadcrumb__separator", "/"));
    path += `${encodeURIComponent(segment)}/`;
    if (index === segments.length - 1) {
      const current = create("span", "breadcrumb__current", segment);
      current.setAttribute("aria-current", "page");
      nav.append(current);
    } else {
      const link = create("a", "breadcrumb__link", segment);
      link.href = path;
      nav.append(link);
    }
  });
  return nav;
}

function renderSearch(data, query) {
  const form = create("form", "toolbar-search");
  form.setAttribute("role", "search");
  const input = create("input", "field-input");
  input.type = "search";
  input.name = "q";
  input.placeholder = "Search";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Search files");
  input.value = query.q || "";
  const clear = iconButton("close", "Clear search", () => {
    navigate(buildQueryUrl({}));
  }, "icon-btn icon-btn--plain toolbar-search__clear");
  clear.hidden = !query.q;
  form.append(input, clear);
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

function renderSidebar(data, context) {
  const aside = create("aside", "desktop-sidebar");

  const brand = create("div", "sidebar-brand");
  const mark = create("span", "sidebar-brand__mark");
  mark.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 4; i += 1) {
    mark.append(create("span"));
  }
  brand.append(mark, create("span", "sidebar-brand__name", "dufs"));
  aside.append(brand);

  const nav = create("nav", "sidebar-nav");
  nav.setAttribute("aria-label", "Directories");
  nav.append(create("p", "sidebar-nav__heading", "Directories"));

  const prefix = uriRoot(data);
  const home = create("a", "sidebar-link");
  home.href = prefix;
  home.append(createIcon("home"), create("span", "sidebar-link__label", "Home"));
  if (data.href === "/" || data.href === "") {
    home.setAttribute("aria-current", "page");
  }
  nav.append(home);

  const directories = (data.paths || []).filter(isDirectory);
  directories.forEach((item) => {
    const link = create("a", "sidebar-link");
    link.href = joinEntryUrl(item.name, { directory: true });
    link.append(createIcon("folder"), create("span", "sidebar-link__label truncate", item.name));
    nav.append(link);
  });
  aside.append(nav);

  const storage = create("div", "storage");
  storage.append(create("div", "storage__label", "Storage"), create("div", "storage__value", "Storage unavailable"));
  aside.append(storage);

  return aside;
}

function renderToolbar(data, query, context) {
  const caps = context.capabilities;
  const toolbar = create("div", "desktop-toolbar");
  toolbar.append(renderBreadcrumb(data));

  if (caps.search) {
    toolbar.append(renderSearch(data, query));
  }

  const actions = create("div", "toolbar-actions");

  if (caps.upload) {
    const uploadBtn = create("button", "btn btn--primary");
    uploadBtn.type = "button";
    uploadBtn.append(createIcon("upload"), create("span", null, "Upload"));
    uploadBtn.addEventListener("click", () => pickFiles(context));
    actions.append(uploadBtn);
  }

  if (caps.archive) {
    actions.append(
      iconButton("download", "Download folder as zip", () => downloadTo(`${baseUrl()}?zip`)),
    );
  }

  actions.append(iconButton("refresh", "Refresh", () => window.location.reload()));

  if (caps.login) {
    const login = create("button", "btn");
    login.type = "button";
    login.textContent = "Sign in";
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
  if (caps.create) {
    menuItems.push({
      id: "new-folder",
      label: "New folder",
      icon: "add",
      run: () => runCreateFolder(context),
    });
    menuItems.push({
      id: "new-file",
      label: "New file",
      icon: "add",
      run: () => runCreateFile(context),
    });
  }
  if (caps.logout) {
    menuItems.push({
      id: "logout",
      label: `Sign out${data.user ? ` (${data.user})` : ""}`,
      icon: "logout",
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
  if (close && typeof close.then === "function") {
    close.finally(() => row.removeAttribute("aria-selected"));
  }
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
        icon: "download",
        run: () => downloadTo(`${url}?zip`),
      });
    }
  } else {
    items.push({
      id: "download",
      label: "Download",
      icon: "download",
      run: () => downloadTo(url),
    });
    items.push({
      id: "view",
      label: "View",
      icon: "list",
      run: () => navigate(`${url}?view`),
    });
    if (caps.edit) {
      items.push({
        id: "edit",
        label: "Edit",
        icon: "edit",
        run: () => navigate(`${url}?edit`),
      });
    }
  }

  if (caps.move) {
    items.push({
      id: "move",
      label: "Rename / Move",
      icon: "move",
      run: () => runMove(item, url, context),
    });
  }
  if (!directory && caps.copy) {
    items.push({
      id: "copy",
      label: "Copy",
      icon: "copy",
      run: () => runCopy(item, url, context),
    });
  }
  if (caps.remove) {
    items.push({
      id: "delete",
      label: "Delete",
      icon: "delete",
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
  if (context.ui && typeof context.ui.emptyState === "function") {
    context.ui.emptyState(container, spec);
    return;
  }
  renderEmptyState(container, spec);
}

export function renderDesktopIndex(root, context) {
  root.textContent = "";

  const { data, query } = context;
  const shell = create("div", "desktop-shell");
  shell.append(renderSidebar(data, context));

  const main = create("div", "desktop-main");
  main.append(renderToolbar(data, query, context));

  const content = create("div", "desktop-content");
  const paths = data.paths || [];
  if (paths.length === 0) {
    const variant = query.q ? "search" : data.dir_exists === false ? "pending" : "empty";
    renderEmpty(content, variant, query, context);
  } else {
    content.append(renderTable(data, query, context));
  }
  main.append(content);
  shell.append(main);
  root.append(shell);
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
    saveButton.textContent = "Save";
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
  download.append(createIcon("download"), create("span", null, "Download"));
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
