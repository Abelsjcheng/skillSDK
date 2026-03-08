# AI Chat Viewer

AI 问答展示前端项目，使用 React 18.3 + TypeScript 开发。

## 功能特点

- 📦 **React 18.3 + TypeScript**: 现代化技术栈
- 🌐 **兼容低版本浏览器**: 支持 IE11+
- 📝 **Markdown 渲染**: 完整支持 Markdown 格式
- 💬 **问答交互**: 实时展示 AI 问答过程和结果
- 📊 **状态显示**: AI 执行进展图标
- 🎨 **简洁界面**: 标题区、内容区、操作区三部分布局

## 项目结构

```
ai-chat-viewer/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Header.tsx      # 标题区组件
│   │   ├── Header.css
│   │   ├── Content.tsx     # 内容区组件
│   │   ├── Content.css
│   │   ├── Input.tsx       # 操作区组件
│   │   └── Input.css
│   ├── types/
│   │   └── index.ts        # TypeScript 类型定义
│   ├── App.tsx             # 主应用组件
│   ├── App.css
│   ├── index.tsx           # 入口文件
│   └── index.css
├── webpack.config.js       # Webpack 配置
├── tsconfig.json           # TypeScript 配置
├── .babelrc                # Babel 配置
└── package.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

自动在浏览器中打开 http://localhost:3000

### 生产构建

```bash
npm run build
```

构建文件输出到 `dist` 目录

### 代码检查

```bash
npm run lint
```

## 页面布局

### 标题区
- 左侧：AI 执行进展图标（💬空闲 / 🤔思考 / ⚙️处理中 / ✅完成 / ❌错误）
- 中间：当前问答标题（靠左对齐）
- 右侧：放大/缩小按钮、关闭按钮

### 内容区
- 渲染 AI 返回的 Markdown 文档
- 支持代码块、表格、列表等格式
- 自动滚动到最新消息

### 操作区
- 输入框（支持 Enter 发送，Shift+Enter 换行）
- 发送按钮

## 浏览器兼容性

配置了 `browserslist` 支持：
- IE 11+
- 最近 2 个版本的主流浏览器
- 全球使用率 >0.5% 的浏览器

## 技术栈

- React: 18.3.1
- TypeScript: 5.4+
- Webpack: 5.90+
- react-markdown: 9.0+
- Babel: 7.24+（含 IE11 兼容配置）
