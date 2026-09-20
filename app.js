import {
  api,
  capabilities,
  createUploadQueue,
  getQueryState,
  parseIndexData,
} from "./js/core.js?ui=0.1.3";
import { renderDesktopIndex, renderEditor } from "./js/desktop.js?ui=0.1.3";
import { renderMobileIndex } from "./js/mobile.js?ui=0.1.3";
import { createUiServices } from "./js/overlays.js?ui=0.1.3";

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
    confirm: (options) => (uiRef ? uiRef.confirm(options) : Promise.resolve(false)),
    onUpdate: (items) => {
      if (uiRef && typeof uiRef.onUploadUpdate === "function") {
        uiRef.onUploadUpdate(items);
      }
    },
  });

  const context = { data, query, capabilities: caps, api, uploadQueue, ui: null };
  const ui = createUiServices(overlayRoot, context);
  uiRef = ui;
  context.ui = ui;

  try {
    if (data.kind === "Index") {
      renderDesktopIndex(desktopRoot, context);
      renderMobileIndex(mobileRoot, context);
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
