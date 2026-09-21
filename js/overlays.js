import { assetUrl } from './core.js?ui=0.1.3';

const NS = 'http://www.w3.org/2000/svg';
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let spritePromise = null;
let idCounter = 0;

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.appendChild(
      typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child,
    );
  }
}

export function createIcon(name, options = {}) {
  const { size, className = '' } = options;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', ['icon', className].filter(Boolean).join(' '));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (size) {
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
  }
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#${name}`);
  svg.appendChild(use);
  return svg;
}

export function ensureSprite() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.getElementById('dufs-icon-sprite')) return Promise.resolve();
  if (spritePromise) return spritePromise;
  spritePromise = fetch(assetUrl('icons/actions.svg'))
    .then((response) => {
      if (!response.ok) throw new Error(`sprite ${response.status}`);
      return response.text();
    })
    .then((markup) => {
      if (document.getElementById('dufs-icon-sprite')) return;
      const holder = document.createElement('div');
      holder.id = 'dufs-icon-sprite';
      holder.setAttribute('aria-hidden', 'true');
      holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      holder.innerHTML = markup;
      document.body.appendChild(holder);
    })
    .catch(() => {
      spritePromise = null;
    });
  return spritePromise;
}

function focusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (node) => node.getClientRects().length > 0,
  );
}

function trapFocus(event, container) {
  const list = focusable(container);
  if (!list.length) {
    event.preventDefault();
    return;
  }
  const first = list[0];
  const last = list[list.length - 1];
  const active = document.activeElement;
  const inside = container.contains(active);
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}

function messageFrom(error) {
  if (error == null) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error.message) return String(error.message);
  return String(error);
}

function cleanMessage(value) {
  let text = messageFrom(value);
  if (/<html|<!doctype|<body|<h1/i.test(text)) {
    text = text.replace(/<[^>]*>/g, ' ');
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 200) text = `${text.slice(0, 200)}\u2026`;
  return text || 'Request failed';
}

function queueItemsFrom(queue) {
  if (!queue) return null;
  if (typeof queue.getItems === 'function') return queue.getItems() || [];
  if (Array.isArray(queue)) return queue;
  return null;
}

function subscribeQueue(queue, callback) {
  if (!queue || typeof queue.subscribe !== 'function') return null;
  const unsubscribe = queue.subscribe(() => callback());
  return typeof unsubscribe === 'function' ? unsubscribe : null;
}

const STATUS_MAP = {
  queued: 'queued',
  pending: 'queued',
  waiting: 'queued',
  paused: 'queued',
  running: 'running',
  uploading: 'running',
  active: 'running',
  retry: 'retry',
  retrying: 'retry',
  failed: 'failed',
  error: 'failed',
  complete: 'complete',
  completed: 'complete',
  done: 'complete',
  success: 'complete',
};

function normalizeStatus(value) {
  return STATUS_MAP[String(value || '').toLowerCase()] || 'queued';
}

function statusLabel(status, item) {
  if (status === 'queued') return 'Queued';
  if (status === 'running') return 'Uploading';
  if (status === 'retry') return 'Retrying';
  if (status === 'complete') return 'Complete';
  if (status === 'failed') {
    const error = item && item.error;
    if (error && typeof error === 'object' && error.status) {
      return `Failed - HTTP ${error.status}`;
    }
    const detail = item && (item.error || item.detail);
    return detail ? `Failed - ${cleanMessage(detail)}` : 'Failed';
  }
  return '';
}

function statusIcon(status) {
  if (status === 'complete') return 'check';
  if (status === 'failed') return 'alert';
  if (status === 'running' || status === 'retry') return 'upload';
  return 'refresh';
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function actionButton(label, icon, onClick, variant) {
  const button = el('button', {
    type: 'button',
    class: `ui-btn${variant === 'primary' ? ' ui-btn--primary' : ''}`,
  });
  if (icon) button.appendChild(createIcon(icon));
  button.appendChild(el('span', { text: label }));
  if (typeof onClick === 'function') button.addEventListener('click', onClick);
  return button;
}

function emptyArt(kind) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'empty-art empty-state__art');
  svg.setAttribute('viewBox', '0 0 96 72');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.appendChild(node);
    return node;
  };
  if (kind === 'search') {
    add('circle', { class: 'art-lens', cx: '38', cy: '30', r: '25' });
    add('circle', { class: 'art-yellow', cx: '38', cy: '30', r: '18' });
    add('path', { class: 'art-handle', d: 'M55 47 72 64' });
  } else {
    add('circle', { class: 'art-yellow', cx: '28', cy: '26', r: '18' });
    add('rect', { class: 'art-red', x: '50', y: '12', width: '26', height: '26', rx: '3' });
    add('path', { class: 'art-blue', d: 'M20 62 34 38 48 62 Z' });
  }
  return svg;
}

function buildEmptyState(spec = {}) {
  const {
    kind = 'empty',
    query = '',
    title,
    message,
    text,
    capabilities = null,
    onUpload,
    onCreateFolder,
    onNewFile,
    onClearSearch,
  } = spec;

  let heading;
  let body;
  if (kind === 'search') {
    heading = 'No results';
    body = query ? `Nothing matches "${query}".` : 'Try a different search term.';
  } else if (kind === 'pending') {
    heading = 'This folder is not on disk yet.';
    body = 'Upload a file to create it.';
  } else if (kind === 'error') {
    heading = 'Something went wrong';
    body = 'Please try again.';
  } else if (kind === 'fatal') {
    heading = 'This page could not load';
    body = 'Reload to try again.';
  } else {
    heading = 'Nothing here yet.';
    body = 'Upload something to get started.';
  }
  if (title) heading = title;
  if (message) body = message;
  if (text) body = text;

  const wrap = el(
    'div',
    { class: 'empty-state' },
    emptyArt(kind),
    el('h2', { class: 'empty-state__title', text: heading }),
    el('p', { class: 'empty-state__message', text: body }),
  );

  const canUpload = capabilities == null ? Boolean(onUpload) : Boolean(capabilities.upload);
  const actions = el('div', { class: 'empty-state__actions' });
  if (kind === 'search' && onClearSearch) {
    actions.appendChild(actionButton('Clear search', 'close', onClearSearch));
  }
  if ((kind === 'empty' || kind === 'pending') && canUpload) {
    if (onUpload) actions.appendChild(actionButton('Upload', 'upload', onUpload, 'primary'));
    if (onCreateFolder) {
      actions.appendChild(actionButton('New folder', 'folder-plus', onCreateFolder));
    }
    if (onNewFile) actions.appendChild(actionButton('New file', 'file-plus', onNewFile));
  }
  if (actions.childNodes.length) wrap.appendChild(actions);

  return wrap;
}

export function renderEmptyState(container, spec = {}) {
  if (!container) return null;
  const node = buildEmptyState(spec);
  container.replaceChildren(node);
  return node;
}

function positionMenu(node, anchor) {
  const rect = anchor.getBoundingClientRect();
  const menu = node.getBoundingClientRect();
  const gap = 4;
  const margin = 8;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  let left = rect.right - menu.width;
  let top = rect.bottom + gap;
  if (left < margin) left = margin;
  if (left + menu.width > vw - margin) left = Math.max(margin, vw - menu.width - margin);
  if (top + menu.height > vh - margin) {
    const above = rect.top - gap - menu.height;
    top = above >= margin ? above : Math.max(margin, vh - menu.height - margin);
  }
  node.style.left = `${Math.round(left)}px`;
  node.style.top = `${Math.round(top)}px`;
}

export function createUiServices(root, context) {
  const overlayRoot =
    document.getElementById('overlay-root') || root || document.body;

  const toastRoot = (() => {
    const existing = document.getElementById('toast-root');
    if (existing) {
      existing.classList.add('ui-toast-root');
      return existing;
    }
    const node = el('div', { id: 'toast-root', class: 'ui-toast-root' });
    document.body.appendChild(node);
    return node;
  })();

  ensureSprite();

  let activeMenu = null;
  const layers = [];

  let uploadItems = [];
  let uploadQueueRef = (context && context.uploadQueue) || null;

  function syncScrollLock() {
    document.body.classList.toggle('ui-no-scroll', layers.length > 0);
  }

  function openDialog(options = {}) {
    const {
      title = '',
      body = null,
      footer = null,
      initialFocus = null,
      onDismiss = null,
      dismissOnBackdrop = true,
    } = options;

    const layer = el('div', { class: 'ui-layer' });
    const backdrop = el('div', { class: 'ui-backdrop' });
    const titleId = nextId('ui-dialog-title');
    const dialog = el('div', {
      class: 'ui-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
    });

    dialog.appendChild(
      el(
        'div',
        { class: 'ui-dialog__header' },
        el('h2', { class: 'ui-dialog__title', id: titleId, text: title }),
      ),
    );
    dialog.appendChild(el('div', { class: 'ui-dialog__body' }, body));
    if (footer) dialog.appendChild(footer);

    layer.append(backdrop, dialog);
    overlayRoot.appendChild(layer);
    layers.push(layer);
    syncScrollLock();

    const previous = document.activeElement;

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKeydown, true);
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      syncScrollLock();
      layer.remove();
      if (previous && document.contains(previous) && typeof previous.focus === 'function') {
        try {
          previous.focus({ preventScroll: true });
        } catch {
          previous.focus();
        }
      }
      if (typeof onDismiss === 'function') onDismiss();
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === 'Tab') {
        trapFocus(event, dialog);
      }
    }

    if (dismissOnBackdrop) backdrop.addEventListener('click', close);
    document.addEventListener('keydown', onKeydown, true);

    const target = initialFocus || focusable(dialog)[0] || dialog;
    if (target && typeof target.focus === 'function') {
      requestAnimationFrame(() => {
        if (!closed) target.focus();
      });
    }

    return close;
  }

  function closeMenu(options = {}) {
    if (!activeMenu) return;
    const { node, anchor, cleanup, resolve } = activeMenu;
    activeMenu = null;
    cleanup();
    node.remove();
    if (
      options.restoreFocus !== false &&
      anchor &&
      document.contains(anchor) &&
      typeof anchor.focus === 'function'
    ) {
      try {
        anchor.focus({ preventScroll: true });
      } catch {
        anchor.focus();
      }
    }
    if (typeof resolve === 'function') resolve();
  }

  function moveFocus(buttons, direction) {
    const enabled = buttons.filter((item) => !item.disabled);
    if (!enabled.length) return;
    const current = enabled.indexOf(document.activeElement);
    const index = current === -1 ? 0 : (current + direction + enabled.length) % enabled.length;
    enabled[index].focus();
  }

  function menu(anchor, items) {
    closeMenu({ restoreFocus: false });
    const list = (items || []).filter(Boolean).filter((item) => item.separator || item.label);
    if (!anchor || !list.length) return Promise.resolve();

    return new Promise((resolve) => {
      const node = el('div', { class: 'ui-menu', role: 'menu', tabindex: '-1' });
      const buttons = [];

      for (const item of list) {
        if (item.separator) {
          node.appendChild(el('div', { class: 'ui-menu-sep', role: 'separator' }));
          continue;
        }
        const button = el('button', {
          type: 'button',
          role: 'menuitem',
          class: `ui-menu-item${item.danger ? ' ui-menu-item--danger' : ''}`,
        });
        if (item.disabled) {
          button.disabled = true;
          button.setAttribute('aria-disabled', 'true');
        }
        if (item.icon) button.appendChild(createIcon(item.icon));
        button.appendChild(el('span', { class: 'ui-menu-label', text: item.label }));
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (item.disabled) return;
          closeMenu({ restoreFocus: false });
          Promise.resolve()
            .then(() => (typeof item.run === 'function' ? item.run() : undefined))
            .catch((error) => {
              errorDialog({ title: 'Action failed', message: messageFrom(error) });
            });
        });
        buttons.push(button);
        node.appendChild(button);
      }

      overlayRoot.appendChild(node);
      positionMenu(node, anchor);
      const first = buttons.find((button) => !button.disabled);
      if (first) first.focus();

      const onPointerDown = (event) => {
        if (!node.contains(event.target) && !anchor.contains(event.target)) closeMenu();
      };
      const onKeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveFocus(buttons, 1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveFocus(buttons, -1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          const firstEnabled = buttons.find((button) => !button.disabled);
          if (firstEnabled) firstEnabled.focus();
        } else if (event.key === 'End') {
          event.preventDefault();
          const lastEnabled = [...buttons].reverse().find((button) => !button.disabled);
          if (lastEnabled) lastEnabled.focus();
        } else if (event.key === 'Tab') {
          closeMenu();
        }
      };
      const onReflow = () => closeMenu({ restoreFocus: false });

      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKeydown, true);
      window.addEventListener('resize', onReflow);
      window.addEventListener('scroll', onReflow, true);

      activeMenu = {
        node,
        anchor,
        resolve,
        cleanup() {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeydown, true);
          window.removeEventListener('resize', onReflow);
          window.removeEventListener('scroll', onReflow, true);
        },
      };
    });
  }

  function confirm(options = {}) {
    const {
      title = 'Confirm',
      message = '',
      confirmLabel,
      confirmText,
      cancelLabel,
      cancelText,
      danger = false,
    } = options;

    return new Promise((resolve) => {
      let settled = false;
      let close = () => {};
      const finish = (value) => {
        if (settled) return;
        settled = true;
        close();
        resolve(value);
      };

      const footer = el('div', { class: 'ui-dialog__footer' });
      const cancel = el(
        'button',
        { type: 'button', class: 'ui-btn' },
        cancelLabel || cancelText || 'Cancel',
      );
      cancel.addEventListener('click', () => finish(false));
      const ok = el(
        'button',
        { type: 'button', class: `ui-btn ${danger ? 'ui-btn--danger' : 'ui-btn--primary'}` },
        confirmLabel || confirmText || 'Confirm',
      );
      ok.addEventListener('click', () => finish(true));
      footer.append(cancel, ok);

      close = openDialog({
        title,
        body: el('p', { class: 'ui-dialog__message', text: message }),
        footer,
        initialFocus: danger ? cancel : ok,
        onDismiss: () => finish(false),
      });
    });
  }

  function prompt(options = {}) {
    const {
      title = '',
      label = '',
      value = '',
      placeholder = '',
      confirmLabel,
      confirmText,
      cancelLabel,
      cancelText,
      required = true,
      type = 'text',
    } = options;

    return new Promise((resolve) => {
      let settled = false;
      let close = () => {};
      const finish = (result) => {
        if (settled) return;
        settled = true;
        close();
        resolve(result);
      };

      const inputId = nextId('ui-input');
      const errorEl = el('p', { class: 'ui-field__error', hidden: true });
      const input = el('input', {
        class: 'ui-input',
        id: inputId,
        type,
        value,
        placeholder,
        autocomplete: 'off',
        spellcheck: 'false',
      });
      const field = el('div', { class: 'ui-field' });
      if (label) {
        field.appendChild(el('label', { class: 'ui-field__label', for: inputId, text: label }));
      }
      field.append(input, errorEl);

      const form = el('form', { class: 'ui-dialog__form', novalidate: true }, field);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const trimmed = input.value.trim();
        if (required && !trimmed) {
          errorEl.textContent = 'A value is required.';
          errorEl.hidden = false;
          input.focus();
          return;
        }
        finish(trimmed);
      });

      const footer = el('div', { class: 'ui-dialog__footer' });
      const cancel = el(
        'button',
        { type: 'button', class: 'ui-btn' },
        cancelLabel || cancelText || 'Cancel',
      );
      cancel.addEventListener('click', () => finish(null));
      const ok = el(
        'button',
        { type: 'submit', class: 'ui-btn ui-btn--primary' },
        confirmLabel || confirmText || 'OK',
      );
      footer.append(cancel, ok);

      close = openDialog({
        title,
        body: form,
        footer,
        initialFocus: input,
        onDismiss: () => finish(null),
      });
    });
  }

  function errorDialog(options = {}) {
    const normalized = typeof options === 'string' ? { message: options } : options;
    const { title = 'Something went wrong', message = '', detail = '' } = normalized;

    return new Promise((resolve) => {
      const body = el('div');
      body.appendChild(el('p', { class: 'ui-dialog__message', text: cleanMessage(message) }));
      if (detail) body.appendChild(el('p', { class: 'ui-dialog__detail', text: cleanMessage(detail) }));

      const footer = el('div', { class: 'ui-dialog__footer' });
      const ok = el('button', { type: 'button', class: 'ui-btn ui-btn--primary' }, 'OK');
      footer.appendChild(ok);

      const close = openDialog({
        title,
        body,
        footer,
        initialFocus: ok,
        onDismiss: () => resolve(),
      });
      ok.addEventListener('click', () => close());
    });
  }

  function toast(message, type = 'info') {
    const kind = type === 'success' || type === 'error' ? type : 'info';
    const node = el('div', {
      class: `ui-toast ui-toast--${kind}`,
      role: kind === 'error' ? 'alert' : 'status',
    });
    const icons = { success: 'check', error: 'alert', info: 'info' };
    node.appendChild(createIcon(icons[kind]));
    node.appendChild(el('span', { class: 'ui-toast__msg', text: messageFrom(message) }));
    toastRoot.appendChild(node);

    const ttl = kind === 'error' ? 6000 : 4000;
    const timer = setTimeout(() => node.remove(), ttl);
    node.addEventListener('click', () => {
      clearTimeout(timer);
      node.remove();
    });
    return () => {
      clearTimeout(timer);
      node.remove();
    };
  }

  function renderUploadItem(queue, item) {
    const status = normalizeStatus(item && (item.status ?? item.state));
    const name =
      (item && (item.name || item.fileName)) ||
      (item && item.file && item.file.name) ||
      'Upload';
    const li = el('li', { class: `upload-item upload-item--${status}` });
    li.appendChild(createIcon(statusIcon(status), { className: 'upload-item__icon' }));

    const meta = el('div', { class: 'upload-item__meta' });
    meta.appendChild(el('p', { class: 'upload-item__name', text: name }));
    meta.appendChild(
      el('p', {
        class: `upload-item__status upload-item__status--${status}`,
        text: statusLabel(status, item),
      }),
    );

    const loaded = toNumber(
      item && (item.loaded ?? item.uploaded ?? item.sent ?? item.transferred),
      0,
    );
    const total = toNumber(item && (item.total ?? item.size), 0);
    let percent =
      item && item.progress != null && !total
        ? Math.round(toNumber(item.progress, 0) * 100)
        : total > 0
          ? Math.round((loaded / total) * 100)
          : 0;
    percent = Math.max(0, Math.min(100, percent || 0));

    const bar = el('span', { class: 'upload-progress__bar' });
    bar.style.width = `${status === 'complete' ? 100 : percent}%`;
    const progress = el(
      'div',
      {
        class: 'upload-progress',
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(status === 'complete' ? 100 : percent),
      },
      bar,
    );
    meta.appendChild(progress);
    li.appendChild(meta);

    if (status === 'failed') {
      const retry = el('button', { type: 'button', class: 'ui-btn upload-item__retry' }, 'Retry');
      retry.addEventListener('click', () => {
        const retryFn = queue && (queue.retry || queue.retryUpload || queue.resume);
        if (typeof retryFn !== 'function') {
          toast('This upload cannot be retried.', 'error');
          return;
        }
        try {
          retryFn.call(queue, item && item.id != null ? item.id : item);
        } catch (error) {
          errorDialog({ title: 'Retry failed', message: messageFrom(error) });
        }
      });
      li.appendChild(retry);
    }

    return li;
  }

  function showUploadQueue(queue) {
    const targetQueue = queue || uploadQueueRef;
    const list = el('ul', { class: 'upload-list' });
    const empty = el('p', { class: 'ui-dialog__message', text: 'No uploads in this session.' });
    const body = el('div', {}, empty, list);

    const footer = el('div', { class: 'ui-dialog__footer' });
    const done = el('button', { type: 'button', class: 'ui-btn ui-btn--primary' }, 'Done');
    footer.appendChild(done);

    let unsubscribe = null;
    let poll = null;

    const render = () => {
      const items = queueItemsFrom(targetQueue) || uploadItems || [];
      empty.hidden = items.length > 0;
      list.replaceChildren();
      for (const item of items) list.appendChild(renderUploadItem(targetQueue, item));
    };

    const close = openDialog({
      title: 'Uploads',
      body,
      footer,
      initialFocus: done,
      onDismiss: () => {
        if (unsubscribe) unsubscribe();
        if (poll) clearInterval(poll);
      },
    });

    done.addEventListener('click', () => close());
    render();
    if (targetQueue) unsubscribe = subscribeQueue(targetQueue, render);
    if (!unsubscribe) poll = setInterval(render, 500);
    return { close };
  }

  function showFatal(error) {
    const message = cleanMessage(error) || 'Reload to try again.';
    const layer = el('div', { class: 'fatal-state', role: 'alertdialog', 'aria-modal': 'true' });
    layer.appendChild(createIcon('alert', { className: 'fatal-state__icon' }));
    layer.appendChild(el('h2', { class: 'empty-state__title', text: 'This page could not load' }));
    layer.appendChild(el('p', { class: 'empty-state__message', text: message }));
    const reload = el('button', { type: 'button', class: 'ui-btn ui-btn--primary' }, 'Reload');
    reload.addEventListener('click', () => location.reload());
    layer.appendChild(reload);
    overlayRoot.appendChild(layer);
    requestAnimationFrame(() => reload.focus());
    return layer;
  }

  function empty(options = {}) {
    const { variant = 'empty', query = '', title, text } = options;
    const kind =
      variant === 'search' ? 'search' : variant === 'missing' || variant === 'pending' ? 'pending' : 'empty';
    return buildEmptyState({ kind, query, title, text });
  }

  function emptyState(container, spec) {
    return renderEmptyState(container, spec);
  }

  function onUploadUpdate(items) {
    uploadItems = Array.isArray(items) ? items : [];
  }

  function setUploadQueue(queue) {
    uploadQueueRef = queue || null;
  }

  return {
    menu,
    prompt,
    confirm,
    toast,
    showUploadQueue,
    showFatal,
    empty,
    emptyState,
    error: errorDialog,
    onUploadUpdate,
    setUploadQueue,
    closeMenu,
  };
}
