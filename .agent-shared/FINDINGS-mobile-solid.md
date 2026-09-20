# FINDINGS — mobile-solid

角色：implementer（一次性 bounded UX 改进）。
范围：只改 `styles/mobile.css`、`styles/overlays.css`、`js/mobile.js`；`js/overlays.js` 未改动（无需改）。
不动：行为/契约、API、menu/dialog 接口、权限门控、`tokens.css`、`DECISIONS.md`、`../dufs/`。
未 commit / 未 push。

## 结论

手机端从“纸一样”改为结实、可按压：触控目标放大到 48px 基准、全可点元素有
`:active`（背景变深 + scale）反馈、文件名 600/16px、FAB 56px 重阴影、
bottom nav 命中区拉满且当前 tab 加粗、移动端 context menu/dialog 同步加重。
桌面端经 scoped 处理保持**零差异**（1440 对话框截图 sha256 逐字节相同）。

## 修改

### `styles/mobile.css`

1. 触控目标 48px（= `calc(--density-hit-target + --space-1)`，44+4）：
   `.mobile-iconbtn`、面包屑 `.crumb`、`.mobile-row__more`、`.mobile-search__clear` 的宽高。
   搜索框 `.mobile-search__field` 由 40 → 48（`calc(--size-primary + --space-2)`）。
2. 按压反馈（120ms token，颜色 + `transform: scale(.97/.98)`）新增于
   `.mobile-iconbtn`、`a.crumb`、`.mobile-search__clear`、`.mobile-row__main`、
   `.mobile-row__more`、`.mobile-bottom-nav__item`、`.mobile-fab`；并把 `transform`
   加入各自的 transition。
   - 背景变深用既有 token：中性项 `--color-border`，行内主区 `--color-primary-soft`
     （与 selected/hover 语义一致），nav 项 `--color-hover`。
3. 视觉重量：`.mobile-row__name` 字重 medium → **semibold**（尺寸已是 16px
   `--font-size-mobile`）；行 `min-height` 52 → **56**，上下各加 `--space-1` 内边距；
   分隔仍是 `--border-default` 实线。次要信息维持 `--color-text-muted`（对比不降）。
4. FAB：48 → **56px**（`calc(--size-fab + --space-2)`），阴影
   `--shadow-panel` → `--shadow-menu`，`:active` 为 `translateX(-50%) scale(.94)`；
   图标 20 → 24（`--icon-size-file`）。定位按新尺寸重新居中。
   FAB 菜单 bottom 随新 FAB 高度上移，避免与 FAB 重叠。
5. bottom nav：`.mobile-bottom-nav__item` 加 `align-self: stretch`，命中区拉满 60px nav；
   `.is-active` 字重 semibold，并加顶部 3px 主色指示条
   （`calc(--border-width * 3)` + `--color-primary`）。
6. `prefers-reduced-motion: reduce`：所有新 `:active` 只保留颜色变化，
   `transform: none`（FAB 只保留 `translateX(-50%)`）。

### `styles/overlays.css`

新增 `@media (max-width: 639px)` 段（**只作用于移动端，桌面规则不动**）：

- `.ui-menu-item`：`min-height` 48px、`font-weight: semibold`；danger 项与图标
  `--color-danger`；`:active` 背景 `--color-border` / danger 用 `--color-danger-soft`，
  并 `scale(.98)`。
- `.ui-btn`：移动端默认 `min-height` 48px；`:active` `scale(.98)`，
  非主/危险按钮背景 `--color-border`，主按钮 `--color-primary-hover`。
- `.ui-dialog__footer .ui-btn`：**40px**（`--size-primary`）+ semibold，
  主按钮沿用既有实心 `--color-primary`。
- reduced-motion 下清掉 overlays 的 `:active` transform。

> 说明：任务 1 要求按钮 ≥48，任务 5 明确 dialog 主按钮 40px。按后者精确实现：
> dialog footer 40px，其余移动端按钮 48px。若需统一 48 可去 footer 覆盖行。

### `js/mobile.js`

模块顶层注册一次空 `touchstart` passive 监听：iOS Safari 仅在有 touch 监听时才绘制
`:active`，否则真机的按压反馈不会出现。行为无副作用（不 preventDefault）。

## 验证

### node --check（5 个）

`app.js`、`js/core.js`、`js/desktop.js`、`js/mobile.js`、`js/overlays.js` 全部 exit 0。

### Python 静态冒烟（`python3 -m http.server` + fixture）

fixture：Index，`/config/nvim`，6 条（含 hidden/symlink 文件、长名、Unicode）。
Playwright 驱动系统 Chromium，`http://127.0.0.1:8099`。

- 320 / 375 / 430：`scrollWidth == innerWidth`，body 无横向滚动；
  server log 零 404/500；page console / pageerror / http>=400 均为空。
- 触控尺寸（375，getBoundingClientRect）：
  row main 56、row more 48、topbar menu 48、bottom nav item 59、FAB 56、search 48。
- 移动 context menu：item 高 48、label weight 600、danger `rgb(220,38,38)`。
- FAB 菜单项高 52；dialog footer 高 40、weight 600、主按钮 `rgb(37,99,235)` 实心。
- `:active` 用 CDP `CSS.forcePseudoState` 实测（等 250ms 过渡后）：
  - row main → `scale(.98)` + `rgb(239,246,255)`
  - row more → `scale(.97)` + `rgb(229,231,235)`
  - FAB → `scale(.94) translateX(-28)`
  - nav item → `scale(.97)` + `rgb(243,244,246)`
  - iconbtn / crumb → `scale(.97)` + `rgb(229,231,235)`
  - reduced-motion：以上 transform 全部 `none`，背景色仍变化。
- 截图存 `/tmp/dufs-ms/shots/`（list / rowmenu / fabmenu / dialog 的 before+after），未进仓库。

### 桌面 1440 回归（overlays 共用）

同 fixture 另起 baseline（`git show HEAD` 版本的 overlays/mobile 文件）于 8098，
当前 8099，Playwright 打开 row menu + Delete 确认对话框：

| 指标 | baseline | current |
|---|---|---|
| menu item 高 / 字重 | 44 / 400 | 44 / 400 |
| danger 颜色 | rgb(220,38,38) | rgb(220,38,38) |
| dialog 按钮 高 / 字重 | 36 / 500 | 36 / 500 |
| 1440 对话框截图 sha256 | `b69a80ac56c2…` | `b69a80ac56c2…` **逐字节相同** |

菜单/对话框行为一致（打开、Esc 关闭、焦点、danger 确认）。桌面零视觉差异。

### 字面量检查

`git diff` 新增行内无新 hex；唯二命中为
`env(safe-area-inset-bottom, 0px)` 的既有 fallback 与 `@media (max-width: 639px)`
断点常量（DECISIONS 明确允许）。全部新值均引用既有 token 或 token 的 `calc` 组合。

## 未做

- 未新增/修改 token，未改 `tokens.css`、`DECISIONS.md`。
- 未改 `js/overlays.js`（overlays 共用，改动全部收敛进 overlays.css 的移动端媒体查询）。
- 未做真机/线上验证（由协调者在 8090 dufs 实例验证；index.html 未变，无需重启）。
