import {
  api,
  capabilities,
  createRouter,
  createUploadQueue,
  fetchDirectory,
  getQueryState,
  parseIndexData,
} from "./js/core.js?ui=0.1.14";
import {
  renderDesktopIndex,
  renderDesktopShell,
  renderEditor,
  updateDesktopContent,
  updateDesktopToolbar,
} from "./js/desktop.js?ui=0.1.14";
import {
  renderMobileIndex,
  renderMobileShell,
  updateMobileContent,
} from "./js/mobile.js?ui=0.1.14";
import { createUiServices } from "./js/overlays.js?ui=0.1.14";

function renderFatal(message) {
  const mount = document.getElementById("desktop-view") || document.getElementById("app");
  if (!mount) {
    return;
  }
  mount.textContent = "";
  const wrap = document.createElement("div");
  wrap.className = "fatal";
  const panel = document.createElement("div");
  panel.className = "fatal__panel";
  const title = document.createElement("p");
  title.className = "fatal__title";
  title.textContent = "Unable to load this page";
  const text = document.createElement("p");
  text.className = "fatal__text";
  text.textContent = message;
  panel.append(title, text);
  wrap.append(panel);
  mount.append(wrap);
}

function boot() {
  const desktopRoot = document.getElementById("desktop-view");
  const mobileRoot = document.getElementById("mobile-view");
  if (!desktopRoot || !mobileRoot) {
    renderFatal("Missing application mount points.");
    return;
  }

  let data;
  try {
    data = parseIndexData();
  } catch (error) {
    renderFatal(error.message);
    return;
  }

  const mode = data.kind === "Index" ? "index" : "editor";
  document.body.dataset.kind = data.kind;
  document.body.dataset.mode = mode;

  const overlayRoot = document.getElementById("overlay-root");
  const query = getQueryState();
  const caps = capabilities(data);

  let uiRef = null;
  const uploadQueue = createUploadQueue({
    confirm: (options) => uiRef.confirm(options),
    onUpdate: (items) => {
      uiRef.onUploadUpdate(items);
    },
  });

  const context = { data, query, capabilities: caps, api, uploadQueue, ui: null };
  const ui = createUiServices(overlayRoot, context);
  uiRef = ui;
  context.ui = ui;

  try {
    if (data.kind === "Index") {
      const mobileRefs = renderMobileShell(mobileRoot, context)
      const desktopRefs = renderDesktopShell(desktopRoot, context)

      updateMobileContent(mobileRefs.contentEl, context, mobileRefs)
      updateDesktopContent(desktopRefs.contentEl, context)
      updateDesktopToolbar(desktopRefs.toolbarEl, context)

      const router = createRouter(async (pathname, query) => {
        try {
          const newData = await fetchDirectory(pathname)
          context.data = newData
          context.query = query
          context.capabilities = capabilities(newData)
          document.title = pathname === '/' ? 'dufs' : pathname.split('/').filter(Boolean).pop() + ' — dufs'
          updateMobileContent(mobileRefs.contentEl, context, mobileRefs)
          updateDesktopContent(desktopRefs.contentEl, context)
          updateDesktopToolbar(desktopRefs.toolbarEl, context)
        } catch (err) {
          // Fall back to full-page navigation on fetch failure
          window.location.href = pathname + (query.q ? '?q=' + encodeURIComponent(query.q) : '')
        }
      })
      router.init()

      // Intercept directory link clicks (event delegation)
      function handleDirClick(e) {
        const a = e.target.closest('a')
        if (!a) return
        const href = a.getAttribute('href')
        if (!href) return
        const url = new URL(href, location.origin)
        if (url.origin !== location.origin) return
        if (!url.pathname.endsWith('/')) return
        // Only intercept clean directory navigation; bail if any param other than q is present
        const params = url.searchParams
        for (const key of params.keys()) {
          if (key !== 'q') return
        }
        e.preventDefault()
        router.push(url.pathname, {})
      }

      desktopRoot.addEventListener('click', handleDirClick)
      mobileRoot.addEventListener('click', handleDirClick)
    } else {
      renderEditor(desktopRoot, context);
      mobileRoot.textContent = "";
    }
  } catch (error) {
    ui.showFatal(error);
    renderFatal(error.message);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
