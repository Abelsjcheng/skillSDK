# 创建个人助理组件设计决策文档

- 项目：`ai-chat-viewer`
- 文档版本：`v3.6`
- 创建日期：`2026-03-18`
- 状态：`设计已确认，可进入计划拆分`

## 1. 设计目标

基于已确认需求，实现一个可独立页面打包导出的两步式“创建个人助理”页面，满足：
1. 页面整体宽度 `100%`；
2. 页面 1 录入基础信息（头像、名称、简介）；
3. 页面 2 选择助理大脑（内部助手/自定义助手）；
4. 完整支持禁用态、选中态、页面切换交互。
5. 页面对外不接收任何 `props`，不对外抛出回调事件。
6. 当前版本 `X` / “取消”点击事件调用 `window.Pedestal.remote.getCurrentWindow().close()`；“确定”点击事件先空实现（no-op）。
7. 页面主容器宽高均以 `100%` 自适应填满父容器。
8. 页面入口直接渲染组件，宽高占满整个页面，不引入额外父容器。

## 2. 架构与文件组织

采用“页面入口 + 主组件 + 子视图组件 + 样式分层”结构，沿用当前工程 `React + Less` 风格；其中状态采用“页面内聚、父层最小化”原则。

### 2.1 新增文件（实现目标）

1. `src/components/DigitalTwinCreator.tsx`
2. `src/components/digital-twin/StepBasicInfo.tsx`
3. `src/components/digital-twin/StepBrainSelect.tsx`
4. `src/components/digital-twin/constants.ts`
5. `src/styles/DigitalTwinCreator.less`
6. `src/types/digitalTwin.ts`
7. `src/pages/digital-twin/index.tsx`
8. `public/digital-twin-page.html`
9. `webpack.digital-twin-page.config.js`

### 2.2 修改文件（导出目标）

1. `src/lib/index.ts`
2. `package.json`
3. `src/components/__tests__/DigitalTwinCreator.test.tsx`

## 3. 页面打包导出策略

1. 新增独立页面打包配置 `webpack.digital-twin-page.config.js`，以 `src/pages/digital-twin/index.tsx` 作为入口。
2. 页面构建产物输出到 `dist/digital-twin-page`，包含 `index.html` 与页面脚本。
3. `src/lib/index.ts` 不再导出 `DigitalTwinCreator`，保留 `AIChatViewer` 现有库导出能力。
4. 在 `package.json` 增加页面构建与本地预览脚本（`build:digital-twin-page`、`serve:digital-twin-page`）。
5. 页面模板需保证 `html/body/#root` 为 `100%` 宽高，确保组件可占满页面。

## 4. 组件 API 决策

```ts
type BrainType = 'internal' | 'custom';

interface InternalAssistantOption {
  id: string;
  label: string;
  iconUrl?: string;
}

interface DefaultAvatarOption {
  id: string;
  imageUrl: string;
}

interface DigitalTwinFormData {
  avatarType: 'default' | 'custom';
  avatarId?: string;
  avatarFile?: File;
  name: string;
  description: string;
  brainType: BrainType;
  internalAssistantId?: string;
}
```

决策说明：
1. 页面内部复用 `DigitalTwinCreator`，其签名保持 `const DigitalTwinCreator: React.FC = () => ...` 且不接收 `props`。
2. 图像资源与内部助手数据内置于 `constants.ts`，页面可即插即用。
3. 提交结果保留在页面内部闭环，不向宿主返回数据。

## 5. 页面结构决策

## 5.1 页面 1（基础信息）

1. 标题区固定 `height: 40px`，`width: 100%`，`padding: 0 16px`，背景透明，继承页面线性渐变；渐变在前 `40px` 保持主题色，并从标题区后快速过渡到白色（页面 1 到头像选择区域时已为白色）。
2. 标题区使用单行横向布局：左标题 + 右关闭按钮，按钮必须位于容器内部右侧。
3. 标题文本强制单行显示（`white-space: nowrap`），不允许换行。
4. 标题区需设置 `box-sizing: border-box`，确保 `width: 100%` 时含内边距仍不溢出。
5. 标题区需设置 `min-height: 40px` 与 `flex-shrink: 0`（或等效策略），确保高度不被压缩。
6. 内容区使用 `padding: 16px 24px 12px`，并采用四段式布局：
   - 头像预览与格式说明；
   - 4 个默认头像 + 1 个自定义上传入口；
   - 自定义上传入口边框固定为 `0.63px dashed rgba(221,221,221,1)`；
   - 名称输入；
   - 简介输入。
7. 头像说明文案样式固定为 `12px / 400 / 20px`，且仅保留 `margin-top: 8px`，左右/底部外边距均为 `0`。
8. 名称输入框左右内边距固定为 `12px`。
9. 名称输入框整体可见高度固定为 `36px`（包含边框与上下内边距），实现采用 `box-sizing: border-box` 与 `padding: 6px 12px`。
10. 名称输入框与简介框边框统一为 `1px solid rgba(0,0,0,0.08)`。
11. 简介输入框整体可见高度固定为 `82px`（包含边框与上下内边距），实现采用 `box-sizing: border-box`。
12. 简介块（标题 + 间距 + 简介输入框）整体高度固定为 `112px`。
13. 为消除 2px 行盒误差，名称/简介标签采用块级元素并固定 `height: 22px; line-height: 22px; margin: 0`。
14. 操作区使用 `padding: 16px 24px 12px`，右对齐两个按钮：取消/下一步。
15. 操作区必须固定在组件容器可视范围内，不得超出底部边界；内容区域应自适应可滚动。
16. “下一步”启用条件：`name.trim() && description.trim()`。

## 5.2 页面 2（大脑选择）

1. 标题区固定 `height: 40px`，`width: 100%`，`padding: 0 16px`，背景透明，继承页面线性渐变；渐变在前 `40px` 保持主题色，并从标题区后快速过渡到白色；样式与页面 1 一致，但仅展示右侧 `X` 按钮。
2. 插画区固定 `height: 160px`，`width: 100%`。
3. 内容区使用 `padding: 0 24px`：
   - 单选：内部助手 / 自定义助手；
   - 动态区：
     - `internal`：显示 3x2 按钮组（由内置常量提供）；
     - `custom`：显示提示文案。
4. 操作区使用 `padding: 16px 24px 12px`，按钮右对齐。
5. 操作区必须固定在组件容器可视范围内，不得超出底部边界；内容区域应自适应可滚动。
6. “确定”启用条件：
   - `brainType === 'custom'`：可直接启用；
   - `brainType === 'internal'`：需 `internalAssistantId` 已选择。
7. 第二页内容区标题文本与父容器顶部间距固定为 `6px`，并将标题元素默认外边距重置为 `0` 以避免偏差。
8. 第二页单选圆点按钮使用自定义样式：圆点容器 `20px x 20px`、左侧间距 `0px`；容器内圆点 `16.67px x 16.67px` 且垂直居中；按钮文本与圆点容器间距 `8px`；未选中为 `1.2px` 灰色边框白底，选中为蓝色外环与白色 `6.67px` 圆心。
9. 第二页第二个容器标题文本（“请选择”）与其父容器顶部间距固定为 `12px`，并重置标题默认外边距，避免浏览器默认样式干扰。
10. 第二页内部助手选择按钮圆角半径固定为 `8px`。
11. 第二页内部助手选择按钮在选中态时，按钮文本颜色固定为 `rgba(13,148,255,1)`。
12. 第二页内部助手选择按钮在选中态时，圆形 `√` 固定在按钮内部右侧，距离右边 `8px`。

## 6. 状态模型决策

状态归属拆分：

1. `DigitalTwinCreator` 仅维护跨页面状态：
   - `step: 1 | 2`
2. `StepBasicInfo` 维护页面 1 状态：
   - `avatarType: 'default' | 'custom'`
   - `avatarId?: string`
   - `avatarFile?: File`
   - `name: string`
   - `description: string`
3. `StepBrainSelect` 维护页面 2 状态：
   - `brainType?: BrainType`
   - `internalAssistantId?: string`

默认状态：
1. `step = 1`
2. 页面 1 默认选中第一个默认头像（若存在）
3. 页面 1 `name/description` 为空
4. 页面 2 `brainType/internalAssistantId` 为空

## 7. 交互与校验决策

1. 通过“+”自定义头像按钮触发文件选择时，执行客户端二次校验：
   - 仅允许 `jpg/jpeg/png`
   - 文件大小 `< 2MB`
2. 上传不合法时：
   - 不改变当前头像选择
   - 文件大小超限（`>= 2MB`）使用 toast 提示：`图片大小需小于2MB`
   - 文件格式不合法使用组件内轻提示（文本区域）：`仅支持JPG/PNG格式`
3. 点击头像项即切换选中态并更新预览区。
4. 页面切换不清空已输入数据。
5. 点击 `X` 与“取消”时直接调用 `window.Pedestal.remote.getCurrentWindow().close()`。
6. 点击“确定”当前版本先 no-op（保留事件入口，不做状态变化）。

## 8. 样式与实现约束

1. 样式集中在 `src/styles/DigitalTwinCreator.less`，使用 BEM 风格命名前缀：`digital-twin-`。
2. 布局单位优先使用 `px`，严格按需求值实现。
3. 颜色值优先使用需求中的 `rgba(...)` 原值。
4. 不引入新 UI 库；沿用当前项目原生 `button/input/textarea` + Less。
5. 组件根节点与主容器必须设置 `width: 100%; height: 100%;`，确保填满父容器。
6. 页面入口直接渲染 `DigitalTwinCreator`，不创建额外父容器。
7. 布局采用 `header + content + actions` 的纵向弹性结构：`header/actions` 固定，`content` 使用 `flex: 1; min-height: 0; overflow: auto`。
8. 页面打包模式下入口文件负责挂载页面根节点，不通过库导出组件进行外部挂载。
9. 页面模板层（`html/body/#root`）需设置为 `width: 100%; height: 100%; margin: 0;`。
10. 样式维护中可删除重复或无效属性（如重复 margin/flex 收缩声明），前提是不改变页面视觉与交互。
11. 页面 1 与页面 2 主体区域统一使用线性渐变主题背景：`linear-gradient(180deg, rgba(206,233,255,1) 0px, rgba(206,233,255,1) 40px, rgba(255,255,255,1) 176px, rgba(255,255,255,1) 100%)`。
12. 页面主题背景容器附加统一阴影：`box-shadow: 0 16px 48px 0 rgba(0,0,0,0.16)`。

## 9. 可访问性与可测性

1. 所有可点击控件提供 `aria-label` 或可读文本。
2. 禁用按钮使用真实 `disabled` 属性（非仅视觉禁用）。
3. 关键状态节点暴露可测 class：
   - 头像选中态
   - 内部助手选中态
   - 下一步/确定可用态
4. 关键行为需可测：
   - 点击 `X` 调用 `window.Pedestal.remote.getCurrentWindow().close()`
   - 点击“取消”调用 `window.Pedestal.remote.getCurrentWindow().close()`
   - 点击“确定”不改变当前页面与选择状态

## 10. 风险与边界

1. 内置资源风险：默认头像、插画、内部助手图标需在工程内提供稳定静态路径。
2. 当内置内部助手数量不为 6 时：
   - 组件仍渲染为两列网格；
   - 行数自适应，不阻塞流程。
3. 本期不包含后端接口对接，也不包含对外回调协议。
4. 本期关闭/取消仅调用 `window.Pedestal.remote.getCurrentWindow().close()`；确定不实现业务提交行为。

