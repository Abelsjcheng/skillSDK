# require 引入示例

这个示例演示如何在前端工程中通过 CommonJS `require` 引入 `ai-chat-viewer` 的组件化产物（`dist/lib/index.js`），并直接使用产物暴露的 `mount/unmount` API。

组件使用侧不需要额外手动引入 `react` 或 `react-dom`。

## 运行

1. 在 `ai-chat-viewer` 根目录执行：

```bash
npm run build:require-demo
```

2. 本地预览：

```bash
npm run serve:require-demo
```

默认地址：`http://localhost:3080`

## 关键代码

```js
const AIChatViewerModule = require('../../../dist/lib/index.js');

const mountAIChatViewer =
  AIChatViewerModule.mountAIChatViewer ||
  AIChatViewerModule.default.mount;

const unmountAIChatViewer =
  AIChatViewerModule.unmountAIChatViewer ||
  AIChatViewerModule.default.unmount;

mountAIChatViewer(container, {
  welinkSessionId: 20260310,
  HWH5EXT: mockHwh5ext,
});
```

示例页面内置了 `mount`、`unmount`、`remount` 按钮，便于验证组件生命周期和重新挂载行为。
