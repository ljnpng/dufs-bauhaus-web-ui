# Planner findings / risks

## Confirmed gaps

### R1. Storage has no data source

`IndexData` has no used bytes, total bytes, quota, or filesystem statistics. Visible file sizes are not storage usage and omit nested content.

Decision: show `Storage unavailable`; never copy `128 GB / 1 TB` from the effect image. A real meter needs a future server contract.

### R2. Sidebar cannot be a full tree

The payload contains only the current directory entries. It cannot show siblings of ancestors or recursively expand without navigation/additional requests.

Decision: sidebar lists current visible directories plus root/current selection. No synthetic tree.

### R3. Static assets are immutable for one year

The asset prefix changes with dufs version, not this UI version. Replacing custom files under the same dufs version may leave cached JS/CSS/icons.

Mitigation: version entry URLs with a UI query and verify under real dufs. If nested modules/icons remain stale, version filenames or all dynamic asset URLs too.

### R4. EditData differs from IndexData

Edit/View payloads omit `paths`, `allow_search`, `allow_archive`, and `dir_exists`. Their upload/delete fields are not filtered by user read/write permission in the same way as IndexData.

Mitigation: branch on `kind` before field access; default absent optional capabilities to false; treat server response as final authorization.

### R5. Editability is not permission

`editable` only means text and at most 4 MiB. Saving an existing file can still require upload and delete rights.

Mitigation: show Save only for `Edit && editable && allow_upload && allow_delete`.

## URL / protocol risks

### R6. `uri_prefix` is easy to lose

Root-relative URLs break deployments under `--path-prefix`. `Destination` for MOVE/COPY must also point through the prefix and encode each path segment.

Mitigation: only `core.js` constructs URLs. Test spaces, Unicode, `#`, `?`, nested paths, and prefix `/files/`.

### R7. Query leakage changes server response type

Preserving `json`, `simple`, `noscript`, `edit`, or `view` while sorting/searching can return non-UI responses.

Mitigation: whitelist `q`, `sort`, `order`; do not copy arbitrary current parameters.

### R8. Token download is required for authenticated direct download

A normal anchor may reopen Basic/Digest auth or fail in download contexts. Logged-in downloads need `?tokengen`, then `?token=`.

Mitigation: route all download actions through `api.downloadUrl()` when `DATA.user` is present.

### R9. Non-standard methods need live browser proof

CHECKAUTH, LOGOUT, MKCOL, MOVE, and COPY are not normal form methods. Browser, reverse proxy, and auth behavior cannot be proven by static preview.

Mitigation: complete the real dufs checklist. Keep LOGOUT on XMLHttpRequest with username, matching the known client behavior.

## Data / mutation risks

### R10. Directory size is not bytes

Directory `size` is visible child count capped at 1000. Summing it with file bytes is invalid.

Mitigation: type-aware formatter; `>=1000` means `>999 items`.

### R11. Resume can corrupt without offset checks

Blind PATCH duplicates data. A server file longer than the local file cannot resume safely.

Mitigation: HEAD first; append only for `0 < offset < local size`; exact size completes; larger size requires explicit overwrite.

### R12. No batch endpoint

Bulk delete/move would require multiple independent mutations and partial-failure handling.

Decision: first release uses single-entry actions and omits selection checkboxes. Selected row styling marks the row owning an open context menu.

### R13. COPY rejects directories

The service returns forbidden for directory COPY.

Decision: never show Copy for `Dir` or `SymlinkDir`.

### R14. Local optimistic updates drift

Moves, deletes, uploads, search results, and directory counts can become inconsistent if only one DOM node changes.

Decision: successful mutation reloads the current directory. Upload progress remains local until completion.

## UI / asset risks

### R15. Two responsive DOMs duplicate controls

Rendering desktop and mobile Index views together can duplicate ids, form names, and event side effects.

Mitigation: no repeated global ids inside view modules; scope queries to each root; core controller owns mutations/upload queue; inactive view is `display:none`.

### R16. Unescaped names are an XSS boundary

File names and errors are server-controlled text. Template string insertion into `innerHTML` is unsafe.

Mitigation: create elements and assign `textContent`; only trusted local SVG markup may use `innerHTML`.

### R17. External sprite compatibility

`<use href=".../actions.svg#id">` must be tested in Safari through dufs. Broken sprite loading would erase icon-only controls.

Mitigation: retain accessible labels; verify Safari. If it fails, load the sprite once into DOM from the same origin or use individual SVG assets.

### R18. No bundled Inter or JetBrains Mono

The spec names fonts, but no font assets were supplied. CDN use violates offline/no-dependency goals.

Decision: use the stated fallback stacks. Bundling fonts is a separate licensed asset decision.

### R19. Empty-state meanings differ

Empty `paths` can mean empty directory, no search results, or a path that will be created on first upload.

Mitigation: distinguish `q`, `dir_exists`, and ordinary empty state; do not use one generic message.

### R20. Effect image contains unsupported controls

Grid view, browser-like back/forward, capacity percentage, and full storage navigation are visual concepts, not all backed by dufs data or requirements.

Decision: ship list/table only. Back may use history, refresh may reload, but do not expose inert grid/storage controls.

## Scale / accessibility

### R21. Large directories are unbounded in the UI payload

No confirmed `paths` length cap exists. Building two complete views doubles DOM cost.

Mitigation: use DocumentFragment, avoid per-row document listeners, delegate actions. Virtualization is deferred until measured.

### R22. Menus and dialogs carry keyboard obligations

Custom overlays can trap focus, leave background interactive, or become inaccessible without labels.

Mitigation: semantic button/dialog/menu roles, focus containment/return, Escape, outside click, 44px targets, visible tokenized focus.

## Open verification

- Confirm UI query version works with dufs immutable asset serving for entry CSS/JS and nested modules.
- Confirm external SVG sprite fragments work in current Safari.
- Confirm EditData direct-access behavior for read-only users across Basic and Digest auth.
- Confirm reverse proxies in intended deployment allow CHECKAUTH/LOGOUT/MKCOL/MOVE/COPY/PATCH and `Destination`.
- Measure dual-DOM rendering with a directory containing several thousand entries before adding virtualization.
