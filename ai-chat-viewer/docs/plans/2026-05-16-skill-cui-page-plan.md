# SkillCUI 页面实现方案

- 方案日期：2026-05-16
- 目标工程：`ai-chat-viewer`

## 目标

新增独立页面 `SkillCUI`，满足以下目标：

1. 页面框架对齐旧版 `aiChat`
2. 会话渲染逻辑与 `weAgentCUI` 保持一致，尽量复用现有消息渲染层
3. 仅支持通过页面 query 传入 `welinkSessionId`
4. 保留复制、发送到 IM、最小化、关闭、停止生成等宿主动作
5. 不支持重新生成
6. 不支持 `assistantAccount` 初始化
7. 不支持新建会话、历史侧边栏

## 共享运行时

将当前 `App.tsx` 里的会话运行时抽出为共享 hook：

- `src/hooks/useChatSession.ts`

职责：

1. 根据 `welinkSessionId` 加载历史消息
2. 注册和注销 session listener
3. 处理流式消息
4. 维护会话状态
5. 暴露页面动作：
   - `send`
   - `stop`
   - `answerQuestion`
   - `loadMoreHistory`
   - `copy`
   - `sendToIM`
   - `minimize`
   - `close`
   - `resetTransientState`

## 类型迁移

`useChatSession.ts` 中的类型声明统一下沉到 `src/types` 目录，建议新增：

- `src/types/hooks/chatSession.ts`

这里放置：

- `ChatSessionMode`
- `UseChatSessionOptions`
- `UseChatSessionResult`

`useChatSession.ts` 仅保留 hook 实现，不再内联声明这些类型。

## 命名约定

本次将原 `skillChat` 相关的命名全部改为 `skillCUI`，包括但不限于：

- 页面文件名
- 组件目录名
- 组件名称
- 样式文件名
- 路由名
- 页面内标题和日志命名

## 页面结构

`SkillCUI` 页面采用旧版 `aiChat` 的三段式结构：

1. `header-wrapper`
2. `content-wrapper`
3. `footer-wrapper`

## 页面功能

### 支持

1. 根据 query 的 `welinkSessionId` 初始化会话
2. 渲染用户与 AI 消息
3. 渲染结构化消息块
4. 渲染流式输出
5. 渲染 pending assistant
6. 复制消息
7. 发送到 IM
8. 最小化
9. 关闭
10. 停止生成

### 不支持

1. `assistantAccount` 初始化
2. 新建会话
3. 历史会话侧边栏
4. 重新生成

## 实施拆分

### 1. 新增共享 hook

- 从 `App.tsx` 抽出 `useChatSession`
- 将 hook 类型声明迁移到 `src/types/hooks/chatSession.ts`

### 2. 新增 SkillCUI 页面

- 新增 `src/pages/skillCUI.tsx`
- 仅通过 query 读取 `welinkSessionId`
- 复用 `Content` 与共享 hook

### 3. 新增 SkillCUI 头尾组件

- `src/components/skillCUI/SkillCUIHeader.tsx`
- `src/components/skillCUI/SkillCUIFooter.tsx`

### 4. 新增路由

- 在 `AppRouter.tsx` 新增 `/skillCUI`

### 5. 验证

1. 历史消息加载
2. 流式消息
3. question / permission
4. 复制 / 发送到 IM / 最小化 / 关闭 / 停止生成
5. `weAgentCUI` 原有功能不回退
