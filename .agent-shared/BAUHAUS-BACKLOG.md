# Bauhaus 增强 backlog

对当前 web-ui 的 Bauhaus 元素盘点与增强计划。状态：`todo` / `doing` / `done`。
每项落地后更新本表与 `DECISIONS.md`（若改动稳定决定）。

## 现状（已有的 Bauhaus 底子）

- 三原色 token：`styles/tokens.css` 红 `#ef3340`、黄 `#f5b82e`、蓝（本次统一为 `#0758c9`）。
- 几何 empty-state 插画：`js/overlays.js` 圆/方/三角，`styles/overlays.css` 上三原色。
- 移动顶栏三点菜单红黄蓝：`styles/mobile.css`。
- 按压态用黄作 active：`tokens.css` `--color-action-active`、`base.css`。
- 表头全大写 + 字距：`styles/desktop.css`；选中行 3px 蓝 inset。
- 文件夹黄色实心、文件按类型红/黄/蓝：`icons/*`。
- favicon / wordmark 使用 `#0758c9 / #ef3037 / #f5ad17`。

## 增强点

| # | 主题 | 说明 | 状态 |
|---|------|------|------|
| 1 | 蓝色不统一 | `--color-primary` 原为 Tailwind 蓝 `#2563eb`，与品牌 `#0758c9` 及 `file-md/py/image.svg` 不一致。统一为 Bauhaus 蓝，并建立红/黄/蓝功能语义映射。 | done |
| 2 | 字体太通用 | `--font-ui` 改几何系统栈（Futura/Century Gothic/Avenir Next/Jost/URW Gothic），新增 `--font-display`；`--tracking-caps` 后按钮/表头/标题/badge 全部大写加字距加粗。 | done |
| 3 | 几何语言偏软 | 圆角全部归零（仅圆点保留 round）；阴影全部 `none`；新增 `--border-strong/--border-accent`；表格外框 2px、表头 2px 粗线、选中行左侧 4px 蓝条；toolbar/header 顶部 4px 红黄蓝 composition strip。 | done |
| 4 | 图标是 Lucide 风格 | `.icon` 改 `stroke-linecap: square` + `stroke-linejoin: miter`，描边 `1.875 → 2.25`；sprite 内 grid/copy rect 去圆角；symlink badge 去圆角。 | done |
| 5 | 桌面端无品牌标识 | 桌面工具栏新增 `brand.svg` 品牌 mark（`renderBrand`）；顶部三色 strip 作为统一构图元素。 | done |
| 6 | Overlay 组件 | menu/dialog 直角 + 顶部 4px 蓝 accent 条；toast 改白底强边 + 左侧类型色条；进度条直角方框。 | done |

## 柔和化调整（2026-09-21，0.1.6）

首版 0.1.5 过于 brutalist：全直角 + 满屏 2px 黑框 + 全程大写。按"保留方角/三原色/几何感，退掉最硬的三样"调整：

- 圆角回到 `2/3/4px`（近方不剃刀）。
- 控件描边 2px → 1px `--border-control`；仅结构保留 2px `--border-strong`。
- 大写只留表头与 badge；按钮/标题改 sentence case。
- 浮层恢复克制阴影；图标回圆头圆角、描边 2px；顶部三色条 4px → 3px。

## 最终方向：现代为底 + Bauhaus 小细节（2026-09-21，0.1.7）

用户定调：整体按现代设计，只在细节体现 Bauhaus。据此收回 0.1.5/0.1.6 的结构性 Bauhaus 强化：

- 字体回 Inter 系统栈；大写只留表头。
- 圆角回现代 `4/6/8px`；所有边框统一中性 1px 灰。
- 阴影回现代柔和阴影。
- 图标回标准 1.875 圆头描边。
- 按钮/title/badge 全部 sentence case。

保留的 Bauhaus 细节：顶部 3px 三色 strip、几何 wordmark/logo、traffic dots 菜单、彩色文件图标、几何 empty-state、胶黄按压态、三原色语义（蓝=主操作、黄=激活、红=危险）。

## 语义映射（#1 建立）

- 蓝 `#0758c9`：主操作、选中、焦点、链接、进度。
- 黄 `#f5b82e`：进行中/激活/按压反馈。
- 红 `#ef3340`：危险、删除、错误。
- 红/黄/蓝只作 accent，不作大面积背景（沿用 `DECISIONS.md` 约束）。

## 细节强化：首字母 accent + 几何 more（2026-09-21，0.1.9）

用户要求"在一些小细节上体现包豪斯"：

- 搜索框：放大镜蓝 + 清除 x 红（桌面/移动一致；桌面搜索框补 leading 放大镜）。
- 菜单去 icon：所有菜单项只留文字，首字母按 `red → yellow → blue` 循环上色；`Delete` 不再整行红，仅首字母红（整行保持常规文字色）。
- 别的含文字的按钮（Upload / Download / empty-state 动作 / dialog / Retry / Done / Reload / Save / Sign in）同样去 icon、首字母带色，并把**所有按钮统一为白底**（去掉蓝/红填充）；danger 首字母红、其余蓝。
- **仅移动端 toolbar** 右上角菜单按钮：红黄蓝 traffic dots → `more-bauhaus`（原始横排三点，其中红点→三角、黄点→方块，蓝圆保留）；桌面 toolbar 与行内仍用标准竖点 `more`。
- 新增 token：`--color-bauhaus-yellow-ink`（浅底小字可读黄）、`--color-danger-hover`。
- 新增共享 helper `bauhausLabel()`（`js/overlays.js`）+ `.bauhaus-initial`（`base.css`）。
