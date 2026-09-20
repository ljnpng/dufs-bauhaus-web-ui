# 当前有效需求（ coordinator 维护 ）

- 在 `dufs-bauhaus-web-ui/` 创建 dufs 第三方 webui，可被 `dufs --assets <dir>` 直接使用。
- `dufs/` 仅作只读参考，不修改。
- 设计输入：`bauhaus-design.png`（desktop 表格 + mobile 列表+FAB + icon 体系），`design-component-spec.md`（token 与组件参数）。
- 关键约束：红黄蓝只做 accent，不大面积铺底；圆角克制（4/6/8px）；hover 靠背景/边框/几何 accent；Lucide 风格 action icon + 自绘 Folder/File 资产；desktop compact（row 44px）。
- 工程约束：`--assets` 目录必须含 `index.html`；占位符 `__ASSETS_PREFIX__` / `__INDEX_DATA__` 由 dufs 服务端替换；静态资源经 `__dufs_v<version>__/` 前缀 serving；产物应为静态 `index.html + css + js (+favicon)`，无构建或最小构建。
