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
} from './core.js?ui=0.1.0';
import { createIcon, ensureSprite } from './overlays.js?ui=0.1.0';

// iOS Safari only paints :active while a touch listener is attached to the
// document, so register a no-op one to make the mobile pressed states fire.
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', () => {}, { passive: true });
}

function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function entryIcon(item) {
  const img = document.createElement('img');
  img.className = 'entry-icon';
  img.alt = '';
  img.decoding = 'async';
  let base = iconName(item);
  if (isDirectory(item) && (item.name || '').startsWith('.')) {
    base = `${base}-hidden`;
  } else if ((item.name || '').startsWith('.')) {
    img.classList.add('entry-icon--hidden');
  }
  img.src = assetUrl(`icons/${base}.svg`);
  img.addEventListener('error', () => {
    if (img.dataset.fallback === '1') {
      img.style.visibility = 'hidden';
      return;
    }
    img.dataset.fallback = '1';
    img.src = assetUrl('icons/file-generic.svg');
  });
  return img;
}

function symlinkBadge() {
  const badge = document.createElement('img');
  badge.className = 'entry-badge mobile-row__badge';
  badge.alt = 'Symbolic link';
  badge.src = assetUrl('icons/symlink-badge.svg');
  return badge;
}

function rowIcon(item) {
  const wrap = create('span', 'mobile-row__icon');
  wrap.append(entryIcon(item));
  if (isSymlink(item)) wrap.append(symlinkBadge());
  return wrap;
}

function entryHref(item) {
  return joinEntryUrl(item.name, { directory: isDirectory(item) });
}

function navigate(href) {
  window.location.href = href;
}

function rootHref(data) {
  const prefix = data.uri_prefix || '/';
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

function messageFrom(error) {
  if (error == null) return 'Something went wrong';
  if (typeof error === 'string') return error;
  if (error.message) return String(error.message);
  return String(error);
}

function notifyError(context, error) {
  if (context.ui && typeof context.ui.error === 'function') {
    context.ui.error({ title: 'Action failed', message: messageFrom(error) });
  } else if (context.ui && typeof context.ui.showFatal === 'function') {
    context.ui.showFatal(error);
  }
}

async function downloadTo(url, filename) {
  const finalUrl = await api.downloadUrl(url);
  const anchor = document.createElement('a');
  anchor.href = finalUrl;
  anchor.download = filename || '';
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function itemRootPath(item, data) {
  const dir = String(data.href || '/').replace(/^\/+|\/+$/g, '');
  return dir ? `${dir}/${item.name}` : item.name;
}

async function confirmOverwrite(url, context, label) {
  const response = await api.head(url);
  if (response.status !== 200) return true;
  return context.ui.confirm({
    title: 'Overwrite?',
    message: `"${label}" already exists. Overwrite it?`,
    confirmLabel: 'Overwrite',
    danger: true,
  });
}

async function runMove(item, srcUrl, context) {
  const input = await context.ui.prompt({
    title: 'Rename or move',
    label: 'New path',
    value: itemRootPath(item, context.data),
    confirmLabel: 'Move',
  });
  if (input == null || !input.trim()) return;
  const destination = joinAbsolutePath(input.trim());
  try {
    if (!(await confirmOverwrite(destination, context, input.trim()))) return;
    await api.move(srcUrl, destination);
    window.location.reload();
  } catch (error) {
    notifyError(context, error);
  }
}

async function runCopy(item, srcUrl, context) {
  const input = await context.ui.prompt({
    title: 'Copy file',
    label: 'Destination path',
    value: itemRootPath(item, context.data),
    confirmLabel: 'Copy',
  });
  if (input == null || !input.trim()) return;
  const destination = joinAbsolutePath(input.trim());
  try {
    if (!(await confirmOverwrite(destination, context, input.trim()))) return;
    await api.copy(srcUrl, destination);
    window.location.reload();
  } catch (error) {
    notifyError(context, error);
  }
}

async function runDelete(item, srcUrl, context) {
  const confirmed = await context.ui.confirm({
    title: 'Delete',
    message: `Delete "${item.name}"?`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api.delete(srcUrl);
    window.location.reload();
  } catch (error) {
    notifyError(context, error);
  }
}

async function runCreateFolder(context) {
  const name = await context.ui.prompt({
    title: 'New folder',
    label: 'Folder name',
    value: '',
    confirmLabel: 'Create',
  });
  if (name == null || !name.trim()) return;
  try {
    await api.mkcol(joinEntryUrl(name.trim(), { directory: true }));
    window.location.reload();
  } catch (error) {
    notifyError(context, error);
  }
}

async function runCreateFile(context) {
  const name = await context.ui.prompt({
    title: 'New file',
    label: 'File name',
    value: '',
    confirmLabel: 'Create',
  });
  if (name == null || !name.trim()) return;
  const url = joinEntryUrl(name.trim());
  try {
    await api.put(url, '');
    navigate(`${url}?edit`);
  } catch (error) {
    notifyError(context, error);
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
        id: 'download',
        label: 'Download as zip',
        icon: 'download',
        run: () => downloadTo(`${url}?zip`),
      });
    }
  } else {
    items.push({
      id: 'download',
      label: 'Download',
      icon: 'download',
      run: () => downloadTo(url),
    });
    items.push({
      id: 'view',
      label: 'View',
      icon: 'eye',
      run: () => navigate(`${url}?view`),
    });
    if (caps.edit) {
      items.push({
        id: 'edit',
        label: 'Edit',
        icon: 'edit',
        run: () => navigate(`${url}?edit`),
      });
    }
  }

  if (caps.move) {
    items.push({
      id: 'move',
      label: 'Rename / Move',
      icon: 'move',
      run: () => runMove(item, url, context),
    });
  }
  if (!directory && caps.copy) {
    items.push({
      id: 'copy',
      label: 'Copy',
      icon: 'copy',
      run: () => runCopy(item, url, context),
    });
  }
  if (caps.remove) {
    items.push({
      id: 'delete',
      label: 'Delete',
      icon: 'delete',
      danger: true,
      run: () => runDelete(item, url, context),
    });
  }
  return items;
}

function rowText(item) {
  const text = create('span', 'mobile-row__text');
  text.append(create('span', 'mobile-row__name', item.name));
  const meta = create('span', 'mobile-row__meta');
  meta.append(create('span', null, formatSize(item)));
  if (item.mtime) {
    meta.append(create('span', 'mobile-row__meta-mtime', ` \u00b7 ${formatMtime(item.mtime)}`));
  }
  text.append(meta);
  return text;
}

function renderRow(item, context) {
  const row = create('div', 'mobile-row');
  row.setAttribute('role', 'listitem');

  const main = create('a', 'mobile-row__main');
  main.href = entryHref(item);
  main.append(rowIcon(item), rowText(item));
  row.append(main);

  const more = create('button', 'mobile-row__more');
  more.type = 'button';
  more.setAttribute('aria-label', `Actions for ${item.name}`);
  more.setAttribute('aria-haspopup', 'menu');
  more.append(createIcon('more'));
  more.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const items = rowMenuItems(item, context);
    if (!items.length || !context.ui || typeof context.ui.menu !== 'function') return;
    row.classList.add('is-active');
    const closed = context.ui.menu(more, items);
    if (closed && typeof closed.finally === 'function') {
      closed.finally(() => row.classList.remove('is-active'));
    }
  });
  row.append(more);
  return row;
}

function renderBreadcrumb(data) {
  const nav = create('nav', 'mobile-breadcrumb');
  nav.setAttribute('aria-label', 'Breadcrumb');
  const prefix = rootHref(data);

  const home = create('a', 'crumb crumb--home');
  home.href = prefix;
  home.setAttribute('aria-label', 'Home');
  home.append(createIcon('home'));
  nav.append(home);

  const segments = String(data.href || '/').split('/').filter(Boolean);
  let path = prefix;
  segments.forEach((segment, index) => {
    const separator = create('span', 'crumb-sep');
    separator.setAttribute('aria-hidden', 'true');
    separator.append(createIcon('chevron-right'));
    nav.append(separator);

    path += `${encodeURIComponent(segment)}/`;
    if (index === segments.length - 1) {
      const current = create('span', 'crumb crumb--current', segment);
      current.setAttribute('aria-current', 'page');
      nav.append(current);
    } else {
      const link = create('a', 'crumb', segment);
      link.href = path;
      nav.append(link);
    }
  });
  return nav;
}

function renderSearch(query) {
  const form = create('form', 'mobile-search');
  form.setAttribute('role', 'search');
  form.action = baseUrl();
  form.method = 'get';

  const field = create('div', 'mobile-search__field');
  const input = create('input', 'mobile-search__input');
  input.type = 'search';
  input.name = 'q';
  input.placeholder = 'Search files...';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Search files');
  input.value = query.q || '';
  field.append(createIcon('search'), input);

  const clear = create('button', 'mobile-search__clear');
  clear.type = 'button';
  clear.setAttribute('aria-label', 'Clear search');
  clear.append(createIcon('close'));
  clear.hidden = !query.q;
  clear.addEventListener('click', () => navigate(baseUrl()));

  form.append(field, clear);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    navigate(value ? `${baseUrl()}?q=${encodeURIComponent(value)}` : baseUrl());
  });
  input.addEventListener('input', () => {
    clear.hidden = input.value.length === 0;
  });
  return form;
}

function openGlobalMenu(anchor, context, pickFiles) {
  const caps = context.capabilities;
  const data = context.data;
  const items = [];
  if (caps.upload && typeof pickFiles === 'function') {
    items.push({ id: 'upload', label: 'Upload', icon: 'upload', run: () => pickFiles() });
  }
  if (caps.create) {
    items.push({
      id: 'folder',
      label: 'New folder',
      icon: 'folder-plus',
      run: () => runCreateFolder(context),
    });
    items.push({
      id: 'file',
      label: 'New file',
      icon: 'file-plus',
      run: () => runCreateFile(context),
    });
  }
  if (caps.login || caps.logout) {
    if (items.length) items.push({ separator: true });
    if (caps.login) {
      items.push({
        id: 'login',
        label: 'Sign in',
        icon: 'login',
        run: async () => {
          await api.checkAuth(true);
          window.location.reload();
        },
      });
    }
  if (caps.logout) {
    items.push({
      id: 'logout',
      label: data.user ? `Sign out (${data.user})` : 'Sign out',
      icon: 'logout',
      run: async () => {
        try {
          await api.logout(data.user);
        } catch {
          // Ignore and return to the anonymous view.
        }
        navigate(baseUrl());
      },
    });
  }
  }
  context.ui.menu(anchor, items);
}

function createTrafficDots() {
  const dots = create('span', 'mobile-traffic-dots');
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i += 1) dots.append(create('span'));
  return dots;
}

export function renderMobileIndex(root, context) {
  if (!root || !context) return;
  const { data, query, capabilities, ui } = context;
  ensureSprite();
  root.textContent = '';

  const shell = create('div', 'mobile-shell');
  const header = create('header', 'mobile-header');

  const topbar = create('div', 'mobile-topbar');
  const brand = create('a', 'mobile-brand');
  brand.href = rootHref(data);
  brand.setAttribute('aria-label', 'dufs');
  const mark = document.createElement('img');
  mark.className = 'mobile-brand__mark';
  mark.src = assetUrl('brand.svg');
  mark.alt = '';
  mark.decoding = 'async';
  mark.addEventListener('error', () => {
    mark.style.visibility = 'hidden';
  });
  brand.append(mark);

  const fileInput = create('input', 'visually-hidden');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.tabIndex = -1;
  fileInput.setAttribute('aria-hidden', 'true');
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length && context.uploadQueue) {
      if (ui && typeof ui.setUploadQueue === 'function') ui.setUploadQueue(context.uploadQueue);
      context.uploadQueue.add(fileInput.files);
      if (ui && typeof ui.showUploadQueue === 'function') {
        ui.showUploadQueue(context.uploadQueue);
      }
    }
    fileInput.value = '';
  });
  const pickFiles = () => fileInput.click();

  const menuButton = create('button', 'mobile-iconbtn');
  menuButton.type = 'button';
  menuButton.setAttribute('aria-label', 'Open menu');
  menuButton.setAttribute('aria-haspopup', 'menu');
  menuButton.append(createTrafficDots());
  menuButton.addEventListener('click', () => openGlobalMenu(menuButton, context, pickFiles));

  const topActions = create('div', 'mobile-topbar__actions');
  topActions.append(menuButton);

  topbar.append(brand, topActions);
  header.append(topbar, renderBreadcrumb(data));

  if (capabilities.search) {
    header.append(renderSearch(query));
  }
  shell.append(header);

  const paths = data.paths || [];
  if (paths.length === 0) {
    const host = create('div', 'mobile-empty-host');
    const kind = query.q ? 'search' : data.dir_exists === false ? 'pending' : 'empty';
    if (ui && typeof ui.emptyState === 'function') {
      ui.emptyState(host, {
        kind,
        query: query.q || '',
        capabilities,
        onUpload: capabilities.upload ? pickFiles : undefined,
        onCreateFolder: capabilities.create ? () => runCreateFolder(context) : undefined,
        onNewFile: capabilities.create ? () => runCreateFile(context) : undefined,
        onClearSearch: query.q ? () => navigate(baseUrl()) : undefined,
      });
    }
    shell.append(host);
  } else {
    const list = create('div', 'mobile-list');
    list.setAttribute('role', 'list');
    const fragment = document.createDocumentFragment();
    paths.forEach((item) => fragment.append(renderRow(item, context)));
    list.append(fragment);
    shell.append(list);
  }

  shell.append(fileInput);
  root.append(shell);
}
