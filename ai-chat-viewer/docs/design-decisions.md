# 创建个人助理组件设计决策文档

- 项目：`ai-chat-viewer`
- 文档版本：`v3.64`
- 创建日期：`2026-03-18`
- 状态：`设计已确认，可进入计划拆分`

## 1. 设计目标

基于已确认需求，实现一个可独立页面打包导出的两步式“创建个人助理”页面，满足：
1. 页面整体宽度 `100%`；
2. 页面 1 录入基础信息（头像、名称、简介）；
3. 页面 2 选择助理大脑（内部助手/自定义助手）；
4. 完整支持禁用态、选中态、页面切换交互。
5. 页面对外不接收任何 `props`，不对外抛出回调事件。
6. 当前版本 `X` / “取消”点击事件调用 `window.Pedestal.remote.getCurrentWindow().close()`；页面 2 初始化调用 `window.getAgentType()`；“确定”点击事件调用 `window.createDigitalTwin()`。
7. 页面主容器宽高均以 `100%` 自适应填满父容器。
8. 页面入口直接渲染组件，宽高占满整个页面，不引入额外父容器。

## 2. 架构与文件组织

采用“页面入口 + 主组件 + 子视图组件 + 样式分层”结构，沿用当前工程 `React + Less` 风格；其中状态采用“页面内聚、父层最小化”原则。

### 2.1 新增文件（实现目标）

1. `src/components/PersonalAssistantCreator.tsx`
2. `src/pages/activateAssistant.tsx`
3. `src/components/createAssistant/StepBasicInfo.tsx`
4. `src/components/createAssistant/StepBrainSelect.tsx`
5. `src/components/createAssistant/CreatorStepHeader.tsx`
6. `src/components/createAssistant/CreatorStepFooter.tsx`
7. `src/components/createAssistant/constants.ts`
8. `src/styles/ActivateAssistant.less`
9. `src/imgs/activate-guide-1.svg`
10. `src/imgs/activate-guide-2.svg`
11. `src/imgs/assistant-bg.svg`
12. `src/styles/PersonalAssistantCreator.less`
13. `src/types/digitalTwin.ts`
14. `src/pages/createAssistant.tsx`
15. `public/create-assistant-page.html`
16. `webpack.create-assistant-page.config.js`
17. `src/pages/assistantDetail.tsx`
18. `src/pages/switchAssistant.tsx`
19. `src/components/assistant/AssistantPageHeader.tsx`
20. `src/styles/AssistantPageHeader.less`
21. `src/styles/AssistantDetail.less`
22. `src/styles/SwitchAssistant.less`
23. `src/imgs/icon-back.svg`
24. `src/imgs/icon-service.svg`
25. `src/imgs/icon-close.svg`
26. `src/imgs/assistant-avatar.svg`
27. `src/imgs/switch-assistant-avatar.svg`
28. `example/assistant-components-demo/index.html`
29. `example/assistant-components-demo/webpack.config.js`
30. `example/assistant-components-demo/src/index.tsx`
31. `example/assistant-components-demo/README.md`
32. `src/components/assistant/AssistantSelectionPage.tsx`
33. `src/pages/selectAssistant.tsx`
34. `src/components/__tests__/SelectAssistant.test.tsx`

### 2.2 修改文件（导出目标）

1. `src/lib/index.ts`
2. `package.json`
3. `src/components/__tests__/PersonalAssistantCreator.test.tsx`
4. `src/routes/AppRouter.tsx`

## 3. 页面打包导出策略

1. 新增独立页面打包配置 `webpack.create-assistant-page.config.js`，以 `src/pages/createAssistant.tsx` 作为入口。
2. 页面构建产物输出到 `dist/create-assistant-page`，包含 `index.html` 与页面脚本。
3. `src/lib/index.ts` 不再导出 `PersonalAssistantCreator`，保留 `AIChatViewer` 现有库导出能力。
4. 在 `package.json` 增加页面构建与本地预览脚本（`build:create-assistant-page`、`serve:create-assistant-page`）。
5. 页面模板需保证 `html/body/#root` 为 `100%` 宽高，确保组件可占满页面。
6. 页面入口不使用 `React.StrictMode` 包裹，避免开发环境下页面 2 初始化 `useEffect` 双执行导致重复请求。
7. `example/assistant-components-demo` 继续以 `require('../../../dist/lib/index.js')` 的方式消费库产物，验证真实打包结果，而不是直接引用源码模块。
8. `webpack.lib.config.js` 的 UMD 根对象改为 `globalThis`，避免 demo 二次打包 `dist/lib/index.js` 时因顶层 `this` 为 `undefined` 导致 `AIChatViewer` 挂载失败。
9. 取消 `library.export = 'default'`，使库构建产物同时暴露默认导出与命名导出，保障 `AssistantDetail`、`SwitchAssistant`、`mountAIChatViewer`、`unmountAIChatViewer` 在 demo 与宿主侧都可稳定读取。
10. 源码层页面/组件文件统一采用单一导出策略：组件文件仅保留 `default export`，如需命名导出能力，由 `src/lib/index.ts` 统一转出，避免源码层重复导出。

## 4. 组件 API 决策

```ts
type BrainType = 'internal' | 'custom';

interface InternalAssistantOption {
  name: string;
  icon?: string;
  bizRobotId: string;
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
  selectedBizRobotId?: string;
}

interface CreateDigitalTwinParams {
  name: string;
  icon: string;
  description: string;
  weCrewType: 0 | 1;
  bizRobotId?: string;
}
```

决策说明：
1. 页面内部复用 `PersonalAssistantCreator`，其签名保持 `const PersonalAssistantCreator: React.FC = () => ...` 且不接收 `props`。
2. 图像资源内置于 `constants.ts`；内部助手数据通过 `window.getAgentType()` 动态获取。
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
   - 头像预览图片显示模式固定为 `object-fit: fill`；
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
16. 操作区按钮文本统一样式为 `font-size: 12px; line-height: 20px`。
17. “下一步”启用条件：`name.trim() && description.trim()`。

## 5.2 页面 2（大脑选择）

1. 标题区固定 `height: 40px`，`width: 100%`，`padding: 0 16px`，背景透明，继承页面线性渐变；渐变在前 `40px` 保持主题色，并从标题区后快速过渡到白色；样式与页面 1 一致，左侧展示标题“创建个人助理”，右侧展示 `X` 按钮。
2. 删除第二页原有独立插画区（标题区下方的 `160px` 插画区域不再渲染）。
3. 内容区使用 `padding: 0 24px`：
   - 单选：内部助手 / 自定义助手；
   - 动态区：
     - `internal`：显示 3x2 按钮组（由 `window.getAgentType()` 动态提供）；
     - `custom`：显示提示文案。
   - 内部助手数据请求过程中及空结果场景均不展示“内部助手加载中...”与“暂无可用内部助手”文案。
4. 内容区新增第三容器用于展示插画，尺寸为 `height: 114px; width: 100%`，圆角半径 `12px`。
5. 操作区使用 `padding: 16px 24px 12px`，按钮右对齐。
   - 按钮顺序为：取消 / 上一步 / 确定；
   - “上一步”按钮样式与“取消”一致（`64x28`、圆角 `4px`、浅灰背景）。
6. 操作区必须固定在组件容器可视范围内，不得超出底部边界；内容区域应自适应可滚动。
7. 操作区按钮文本统一样式为 `font-size: 12px; line-height: 20px`。
8. “确定”启用条件：
   - `brainType === 'custom'`：可直接启用；
   - `brainType === 'internal'`：需 `selectedBizRobotId` 已选择。
9. 第二页内容区标题文本与父容器顶部间距固定为 `6px`，并将标题元素默认外边距重置为 `0` 以避免偏差。
10. 第二页单选圆点按钮使用自定义样式：圆点容器 `20px x 20px`、左侧间距 `0px`；容器内圆点 `16.67px x 16.67px` 且垂直居中；按钮文本与圆点容器间距 `8px`；未选中为 `1.2px` 灰色边框白底，选中为蓝色外环与白色 `6.67px` 圆心。
11. 第二页第二个容器标题文本（“请选择”）与其父容器顶部间距固定为 `12px`，并重置标题默认外边距，避免浏览器默认样式干扰。
12. 第二页内部助手选择按钮圆角半径固定为 `8px`。
13. 第二页内部助手选择按钮在选中态时，按钮文本颜色固定为 `rgba(13,148,255,1)`。
14. 第二页内部助手选择按钮在选中态时，圆形 `√` 固定在按钮内部右侧，距离右边 `8px`。

## 5.3 移动端适配（isPcMiniApp）

1. 端类型判断通过 `isPcMiniApp` 完成：
   - `true`：维持当前 PC 布局与交互；
   - `false`：启用移动端布局覆盖。
2. 页面 1 移动端头部改为三段式：左返回区（调用 `window.HWH5.navigateBack()`）/中标题/右占位，头部高度 `44px`。
3. 页面 1 移动端头像预览改为 `48x48`（圆角 `60px`），头像选项圆角改为 `100px`。
4. 页面 1 移动端底部操作区仅保留“下一步”按钮，`44px` 高、全宽、圆角 `999px`。
5. 页面 2 移动端头部改为三段式：左返回区（调用 `onPrev` 返回第一页）/中标题/右占位，头部高度 `44px`。
6. 页面 2 移动端大脑类型单选改为两列等宽按钮样式：高度 `48px`、间距 `16px`、边框 `1px rgba(0,0,0,0.05)`、圆角 `8px`。
7. 页面 2 移动端单选圆点尺寸改为：容器 `24px`、外环 `20px`、内实心 `13.33px`。
8. 页面 2 移动端内部助手按钮组改为 1 列，每项高度 `48px`。
9. 页面 2 移动端底部操作区仅保留“确定”按钮，`44px` 高、全宽、圆角 `999px`。
10. 页面 2 移动端内部助手按钮选中态右侧 `√` 图标尺寸覆盖为 `24px x 24px`。

## 6. 状态模型决策

状态归属拆分：

1. `PersonalAssistantCreator` 仅维护跨页面状态：
   - `step: 1 | 2`
2. `StepBasicInfo` 维护页面 1 状态：
   - `avatarType: 'default' | 'custom'`
   - `avatarId?: string`
   - `avatarFile?: File`
   - `name: string`
   - `description: string`
3. `StepBrainSelect` 维护页面 2 状态：
   - `brainType?: BrainType`
   - `agentTypeList: InternalAssistantOption[]`
   - `selectedBizRobotId?: string`

默认状态：
1. `step = 1`
2. 页面 1 默认选中第一个默认头像（若存在）
3. 页面 1 `name/description` 为空
4. 页面 2 `brainType/selectedBizRobotId` 为空
5. 页面 1 点击“下一步”时将当前头像/名称/简介快照缓存到 `PersonalAssistantCreator`，页面 2 点击“上一步”返回时通过初始化参数回填 `StepBasicInfo` 本地状态，确保数据不丢失。

## 7. 交互与校验决策

1. 通过“+”自定义头像按钮触发文件选择时，执行客户端二次校验：
   - 仅允许 `jpg/jpeg/png`
   - 文件大小 `< 2MB`
2. 上传不合法时：
   - 不改变当前头像选择
   - 文件大小超限（`>= 2MB`）使用 toast 提示：`图片大小需小于2MB`
   - 文件格式不合法使用 toast 提示：`仅支持JPG/PNG格式`
   - 页面 1 不再维护 `avatarError` 组件内错误文本状态
3. 页面 1 上传校验 toast 按端分流：PC 端采用统一自定义结构（高度固定 `46px`、宽度按内容自适应、白底圆角 `8px`、`padding: 12px 16px`、顶部 `50px` 水平居中；左侧 `14x14` 警告图标来自 `src/imgs`，与右侧错误文案间距 `8px`；文案样式 `14px/400`、`rgba(25,25,25,1)`；右侧增加固定宽度 `40px` 的关闭操作区，内部放置 `8x8` 关闭图标按钮，点击后立即关闭 toast）；移动端统一调用宿主 `HWH5.showToast({ msg, type: 'w' })`，不再渲染页面内自定义 toast。
4. 点击头像项即切换选中态并更新预览区。
5. 页面切换不清空已输入数据。
6. 点击“上一步”时从页面 2 返回页面 1，且页面 1 的头像选择、名称和简介保持不变。
7. 页面 1 的“名称”和“简介”输入仅允许汉字/字母/数字字符；检测到其他字符时，对应输入框应用红色高亮边框，且“下一步”保持禁用。
8. 页面 1 移动端输入框（名称/简介）点击时，为降低 WebView 自动上抬概率，保留触摸聚焦兜底策略：在 `onTouchStart` 中优先执行 `focus({ preventScroll: true })`，并在下一帧恢复滚动位置；该策略禁止使用 `event.preventDefault()`，确保系统默认文本选择与复制能力不被拦截。
9. 点击 `X` 与“取消”时直接调用 `window.Pedestal.remote.getCurrentWindow().close()`。
10. 页面 2 初始化时调用 `window.getAgentType()`；返回项中：
   - `internalAssistants` 初始默认值来自 `constants.ts` 中的 `INTERNAL_ASSISTANTS = [{ name: '助手', icon: '', bizRobotId: '1234' }]`
   - `name` 显示为内部助手按钮文本
   - `icon` 显示为内部助手按钮图标
   - `bizRobotId` 用作内部助手唯一标识与确认入参
   - `getAgentType` 返回值直接通过 `setInternalAssistants` 设置，不做 `normalizeInternalAssistants` 归一化
   - 不渲染“内部助手加载中...”与“暂无可用内部助手”提示文案
11. 页面 2 选择“自定义助手”时，提示文案固定为“需在本地电脑自定义部署第三方助手，点击查看指导文档→”；其中“指导文档→”采用超链接渲染，点击打开 web 页面，链接地址当前留空；链接文本颜色固定为 `rgb(9,146,255)`。
12. 点击“确定”时调用 `window.createDigitalTwin(params)`，`params` 字段映射：
   - `name`：页面 1 名称输入值
   - `icon`：页面 1 当前选中头像地址
   - `description`：页面 1 简介输入值
   - `weCrewType`：页面 2 单选值映射（`internal => 1`，`custom => 0`）
   - `bizRobotId`：仅 `weCrewType = 1` 时传，值为选中内部助手项的 `bizRobotId`
13. 所有 `HWH5EXT` / `HWH5` 能力调用在业务层进入 `catch` 分支时，统一直接通过 `showToast(固定错误文案)` 告知用户，不再解析 `error.message/errorMessage`；其中 PC 端由 toast 自身根据当前页面是否存在标题区动态定位，有标题区时显示在标题区顶部 `50px`，无标题区时显示在页面顶部 `50px`，并保持水平居中；移动端则统一透传到宿主 `HWH5.showToast({ msg, type: 'w' })`，不再维护页面内定位。toast 内部的端类型判断统一复用 `src/utils/hwext.ts` 导出的 `isPcMiniApp`，避免重复维护判端逻辑。

## 8. 样式与实现约束

1. 样式集中在 `src/styles/PersonalAssistantCreator.less`，使用 BEM 风格命名前缀：`digital-twin-`。
2. 布局单位优先使用 `px`，严格按需求值实现。
3. 颜色值优先使用需求中的 `rgba(...)` 原值。
4. 不引入新 UI 库；沿用当前项目原生 `button/input/textarea` + Less。
5. 组件根节点与主容器必须设置 `width: 100%; height: 100%;`，确保填满父容器。
6. 页面入口直接渲染 `PersonalAssistantCreator`，不创建额外父容器。
7. 布局采用 `header + content + actions` 的纵向弹性结构：`header/actions` 固定，`content` 使用 `flex: 1; min-height: 0; overflow: auto`。
8. 页面打包模式下入口文件负责挂载页面根节点，不通过库导出组件进行外部挂载。
9. 页面模板层（`html/body/#root`）需设置为 `width: 100%; height: 100%; margin: 0;`。
10. 样式维护中可删除重复或无效属性（如重复 margin/flex 收缩声明），前提是不改变页面视觉与交互。
11. 页面 1 与页面 2 主体区域统一使用线性渐变主题背景：`linear-gradient(180deg, rgba(206,233,255,1) 0px, rgba(206,233,255,1) 40px, rgba(255,255,255,1) 176px, rgba(255,255,255,1) 100%)`。
12. 页面主题背景容器附加统一阴影：`box-shadow: 0 16px 48px 0 rgba(0,0,0,0.16)`。
13. 移动端样式覆盖与结构切换基于 `isPcMiniApp` 对应 class 生效，不使用媒体查询替代端类型判断。
14. 页面 1 与页面 2 的重复结构（标题区、footer 操作区与主操作按钮 class 组装）抽取为公共实现，保持 UI 与交互行为不变，仅减少重复代码。
15. 激活助理页面使用独立组件实现轮播区与操作区，避免与创建流程页面样式互相污染。

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
   - 页面 2 初始化调用 `window.getAgentType()` 且正确渲染内部助手按钮文本/图标
   - 点击“确定”调用 `window.createDigitalTwin()` 且参数映射正确

## 10. 风险与边界

1. 内置资源风险：默认头像、插画需在工程内提供稳定静态路径；内部助手列表依赖 `window.getAgentType()` 可用性。
2. 当动态获取到的内部助手数量不为 6 时：
   - 组件仍渲染为两列网格；
   - 行数自适应，不阻塞流程。
3. 本期不包含后端接口对接，也不包含对外回调协议。
4. 本期关闭/取消调用 `window.Pedestal.remote.getCurrentWindow().close()`；页面 2 通过 `window.getAgentType()` 获取内部助手；确定调用前端 `window.createDigitalTwin()`，不包含后端接口联调。

## 11. 路由实现决策

1. 在主入口 `src/index.tsx` 基于 `react-router` 引入 `HashRouter`，路由配置下沉到独立路由组件。
2. 路由表包含六个业务页与重定向规则：
   - `/weAgentCUI` -> `App`（WeAgentCUI 对话页）
   - `/createAssistant` -> `PersonalAssistantCreator`（创建个人助理页）
   - `/activateAssistant` -> `ActivateAssistant`（激活助理页）
   - `/assistantDetail` -> `AssistantDetail`（助理详情页）
   - `/switchAssistant` -> `SwitchAssistant`（切换助理页）
   - `/selectAssistant` -> `SelectAssistant`（启动助理页）
   - `/` 与 `*` -> 重定向到 `/weAgentCUI`
3. 页面路由切换不改变原有业务逻辑，只做视图层分发。
4. `create-assistant-page` 独立打包入口维持现状，用于单页发布场景；与主入口路由方案并存。

## 11.1 WeCodeUrl Host 解析

1. `weCodeUrl` 的 host 提取统一收敛到 `src/utils/hwext.ts`。
2. 由于业务 URI 存在 `h5://123456/html/index.html` 这类自定义协议地址，host 解析不依赖 `URL.host`，改为通过正则表达式从 `://` 后到下一个 `/` 之前的片段提取。
3. 解析失败时返回空字符串，后续 `openWeAgentCUI` 参数组装继续走现有兜底逻辑。

## 12. 激活助理页面设计

1. 页面结构拆分为两段：
   - 内容区：容器宽度自适应 `100%`、高度按内容自适应，图片容器按图片原始尺寸展示，顶部间距 `78px`；
   - 操作区：与内容区间距 `65px`，仅保留“立即启用”主按钮。
   - 页面根容器背景统一使用纯色：`rgba(244,247,253,1)`。
2. 内容区仅展示第一张本地图片资源 `src/imgs/activate-guide-1.svg`，不再保留轮播状态与指示器逻辑。
3. “选择助理/立即启用”按钮按端区分样式：移动端使用 `250x38`、圆角 `99px`；PC 端使用 `140x32`、圆角 `4px`；背景统一为线性渐变 `linear-gradient(90deg, #1f78ff 0%, #42b0ff 100%)`，当前版本点击事件空实现（预留业务接入）。

## 13. 依赖版本兼容决策

1. 构建工具链保持对 `Node.js 18.x` 的可运行性。
2. `copy-webpack-plugin` 固定为 `13.x`，避免 `14.x` 依赖 `Array.prototype.toSorted`（`Node 20+`）导致开发服务与生产构建失败。

## 14. 助理详情页面设计

1. 页面采用“标题区 + 内容区”纵向结构，整体宽高自适应占满路由容器。
2. 标题区以外的页面区域背景统一改为线性渐变：`linear-gradient(180deg, #f3f8ff, #ffffff 100%)`。
3. 标题区通过 `isPcMiniApp` 区分端样式：
   - `isPcMiniApp === true`（PC）：`height: 54px; padding: 11px 16px;`，左侧 `32x32` 关闭按钮（内含 `20x20` 关闭图标），右侧 `32x32` 客服按钮（内含 `20x20` 客服图标），中间标题居中。
   - `isPcMiniApp === false`（移动）：沿用现有 `44px` 高度与左侧返回+客服按钮布局。
4. 内容区改为通过内边距控制与标题区间距，使用 `padding: 12px 16px 16px`（上 `12px`、左右 `16px`），包含三个白底圆角卡片（圆角 `8px`）：
   - 卡片 1：头像（`72x72`，圆角 `19px`）+ 名称“小咪”+ 标签“员工助手”；名称文本需独立水平居中，标签不参与名称居中计算；
   - 卡片 2：助理简介标题与正文（“你的全能AI生活助理”）+ 创建者行（左“创建者”，右 `creatorName + ' ' + createdBy`）；
   - 卡片 3：组织信息两行（“部门/测试”“责任人/测试”），其中“责任人”值展示为 `ownerName + ' ' + ownerWelinkId`，行样式与创建者行保持一致。
   - 卡片 2 中“助理简介内容”和“创建者行”之间增加 `1px solid rgba(0,0,0,0.05)` 分割线；
   - 卡片 3 中“部门”与“责任人”两行之间增加 `1px solid rgba(0,0,0,0.05)` 分割线。
   - 标题区与头像区域相关图标/图片均通过 `src/imgs` 静态资源导入，不再使用内联 SVG 或纯色块占位。
5. 页面为静态展示页，当前版本不接入接口与状态管理；按钮点击仅保留空实现占位，后续按业务接入。

## 15. 切换助理页面设计

1. 页面结构采用“标题区 + 列表内容区”，整体宽高占满路由容器。
2. 标题区以外的页面区域背景统一改为线性渐变：`linear-gradient(180deg, #f3f8ff, #ffffff 100%)`。
3. 标题区复用助理详情页的结构与样式规范（含 `isPcMiniApp` 的 PC/移动端分支），标题文案使用“切换助理”。
4. 内容区使用 `padding: 12px 16px`，内部助理列表容器设置 `overflow-y: auto` 支持超出滚动，并隐藏可视滚动条。
5. 助理列表项样式固定：
   - 列表项间距 `12px`；
   - 单项尺寸 `height: 72px; width: 100%; border-radius: 8px; padding: 16px 12px`；
   - 左侧头像 `40x40`，与右侧说明块间距 `16px`。
   - 列表项支持单选态，点击后为当前项增加 `1px solid rgba(13,148,255,1)` 边框；未选中项保持透明边框，避免布局抖动。
   - 列表项去除浏览器默认点击/聚焦高亮，仅保留选中边框作为反馈。
6. 说明块第一行左侧主标题样式为 `16px/500/24px`、`rgba(51,51,51,1)`，右侧 tag 为内容自适应宽度、`padding: 2px 4px`、`4px` 圆角、`rgba(217,232,255,1)` 背景，tag 文本为 `10px/400/14px`、`rgba(65,142,255,1)`。
7. 说明块第二行描述文案样式为 `14px/400/22px`、`rgba(102,102,102,1)`，采用单行省略号截断。
8. 页面底部新增固定操作区，样式为 `height: 68px; width: 100%; padding: 12px 16px`，包含两个按钮分别左右对齐（左“取消选择”、右“确认切换”）：
   - “取消选择”：`156x44`、圆角 `50px`、背景 `rgba(255,255,255,1)`；
   - “确认切换”：`156x44`、圆角 `50px`、背景 `rgba(13,148,255,1)`。
9. 底部按钮点击行为当前均采用空实现函数占位，后续按业务接入真实切换逻辑。
10. 切换助理页标题区与头像图标统一通过 `src/imgs` 静态资源导入，不使用内联 SVG。
11. 助理详情页与切换助理页迁移至 `src/pages` 目录单文件组件（`assistantDetail.tsx`、`switchAssistant.tsx`），并将重复标题区提取到 `src/components/assistant/AssistantPageHeader.tsx` 复用。
12. 助理详情页与切换助理页源码文件仅保留 `default export`；组件化引用场景所需的命名导出统一由 `src/lib/index.ts` 转出。
13. 新增 `example/assistant-components-demo`，用于演示通过库产物（`dist/lib/index.js`）导入 `AssistantDetail` 与 `SwitchAssistant` 并进行页面切换展示。
14. “切换助理页”与“启动助理页”共用列表布局与交互结构，提取到 `src/components/assistant/AssistantSelectionPage.tsx` 复用；两个页面仅传入不同的标题和底部按钮文案。

## 16. 启动助理页面设计

1. 页面组件放在 `src/pages/selectAssistant.tsx`。
2. 标题区以外的页面区域背景统一改为线性渐变：`linear-gradient(180deg, #f3f8ff, #ffffff 100%)`。
3. 使用 `isPcMiniApp` 做双端分支：
   - `false`（移动）：继续复用 `AssistantSelectionPage` 的现有样式与交互，不做变更；
   - `true`（PC）：走独立 PC 布局渲染。
4. PC 布局采用 `500px` 宽度的居中面板（标题区 + 内容区 + 底部操作区）。
5. PC 标题区仅显示标题“启用助理”，字号 `24px`、字重 `700`、行高 `24px`，高度随内容自适应。
6. PC 内容区内边距固定为 `padding: 36px 24px`。
7. PC 底部操作区水平居中显示两个按钮，间距 `12px`：
   - 左按钮“创建助理”：`80x32`，圆角 `4px`，背景 `rgba(0,0,0,0.05)`；
   - 右按钮“立即启用”：`80x32`，圆角 `4px`，背景 `rgba(13,148,255,1)`。
8. PC 与移动端按钮事件保持空实现占位，后续再接入业务逻辑。

## 17. WeAgentCUI 页面设计

1. `WeAgentCUI` 为当前唯一对话页，`App` 仅保留 `weAgentCUI` 数据流与会话能力（消息加载、发送、流式更新、停止、历史分页）。
2. 页面结构为：`对话内容区 + 多功能按钮区 + 底部输入区`。
4. `weAgentCUI` 页面根容器背景统一使用线性渐变：`linear-gradient(90deg, rgba(243,248,255,1), rgba(255,255,255,1) 100%)`。
5. 多功能按钮区高度固定为 `32px`，左侧提供相邻排列的“新建会话”“历史会话”两个 `32px x 32px` 的白底圆角按钮，按钮间距固定 `8px`，图标统一为 `16px x 16px`；其中“新建会话”按钮按最简规则直接使用 `messages.length === 0` 判断当前是否为空会话，满足时不重复创建会话，直接 toast 提示“当前是最新会话”；中间增加白底圆角状态提示块“输出中...”，高度 `32px`、圆角 `20px`、文本样式 `12px/400`、颜色 `rgba(38,159,255,1)`，仅在 AI 生成阶段显示，且位置固定在整行多功能按钮区的水平中点。
6. 消息渲染层在 `MessageBubble` 增加变体样式支持：
   - 用户消息右对齐，头部文案为“测试 + 时间”，右侧头像 `24x24`；
   - 助手消息左对齐，头部文案为“小米 + 时间”，左侧头像 `24x24`；
   - 用户气泡使用蓝色线性渐变；助手气泡改为按内容宽度自适应，不再强制占满当前消息容器，并补充 `8px` 圆角与 `1px solid #1890ff` 边框。
   - AI 消息块内部的可折叠子组件（代码块、思考块、工具调用块）统一使用 `arrow_up_icon.svg` 作为箭头资源，并保持“展开朝上、收缩朝下”的方向约定，避免不同卡片各自使用字符箭头或方向不一致。
   - `CodeBlock` 在助手消息中按块级元素独占一行展示，并占满当前消息内容区域的可用宽度；普通文本内容仍保持气泡按内容宽度收缩。
   - `CodeBlock` 在移动端不启用强制折行，长代码统一保持原始行结构，通过代码块内容区自身的横向滚动承载，避免窄屏下把代码缩进和语义打散；代码区域滚动条隐藏，但不移除横向滚动能力。
7. 输入区在 `Footer` 增加变体样式支持：
   - 容器 `height: 40px; padding: 8px 12px; border-radius: 30px; background: #fff`；
   - placeholder 固定为“有问题尽管问我~”；
   - 发送按钮为 `24x24` 图标按钮，图标尺寸 `20x20`。
8. 样式文件 `src/styles/WeAgentCUI.less` 负责维护 WeAgentCUI 布局，class 前缀统一使用 `we-agent-cui-`。
9. 新增图标资源：
   - `src/imgs/icon-we-agent-new-session.svg`
   - `src/imgs/icon-we-agent-history.svg`
   - `src/imgs/icon-we-agent-send.svg`
10. `aiChat` 页面及其相关逻辑已移除，不再保留 `variant` 分支与 `/aiChat` 路由。
11. 在 `weAgentCUI` 变体下，当消息列表为空时，`Content` 区渲染欢迎块（头像 + 标题 + 副标题），样式规则如下：
   - 顶部间距 `27px`；
   - 纵向 `12px` 间距、水平居中；
   - 头像容器 `72x72`，圆角 `124px`，白色 `2px` 边框；
   - 标题文本使用运行时用户信息动态生成（如存在 `weAgentUserName` 则展示 `早上好，${weAgentUserName}`），样式 `18px/500/26px`、`rgba(25,25,25,1)`；
   - 副标题文本使用运行时助理信息动态拼接（`weAgentAssistantName | weAgentAssistantDescription`），样式 `14px/400/22px`、`rgba(89,89,89,1)`；
   - 不为欢迎标题和副标题提供默认兜底文案；当对应数据为空时直接不渲染文本节点。
12. `WeAgentCUI` 消息区不保留“复制消息”“发送到IM”入口，`App -> Content -> MessageBubble` 组件链路中移除 `onCopy`、`onSendToIM` 参数透传。
13. 历史消息中的 AI `Question` / `Permission` 卡片统一按只读展示处理：`App` 在历史消息映射阶段标记来源，`MessageBubble` 将该标记透传到 `QuestionCard` 与 `PermissionCard`，并在组件内部禁用选项点击、输入提交及授权按钮点击。
14. `MessageBubble` 保持现有消息渲染优先级：优先消费 `message.parts` 渲染结构化消息；仅当 `parts` 不存在或为空时才回退到 `message.content`。在该回退分支下，若 `message.content === ''`，则直接不渲染该条消息，避免历史消息或实时消息出现空文本占位。
15. 全页面取消“禁止复制”限制：不通过触摸事件 `preventDefault` 或样式策略阻断系统默认文本选择与复制行为。
16. 历史会话侧栏的每个会话 item 标题按单行省略处理，超出宽度显示 `...`。
17. 历史会话侧栏面板保持纵向滚动能力，同时隐藏可视滚动条（`scrollbar-width: none` + `::-webkit-scrollbar { display: none; }`）。
18. 历史会话面板按端分流：移动端改为“左侧抽屉 + 右侧蒙层”方案；PC 端为左侧固定宽度 `260px` 的历史会话栏，并通过页面布局为右侧对话区预留空间，形成左右分栏显示。PC 端 `weAgentCUI` 根容器去除外层 `padding`；右侧 AI 对话容器单独承担上下内边距，固定 `padding-top: 16px`、`padding-bottom: 30px`。默认状态下右侧 AI 对话容器左右内边距为 `150px`，内容宽度占满右侧可用区域；当历史会话侧边栏展开时，左右内边距切换为 `50px`，内容宽度仍占满右侧可用区域，不再限制 `max-width`。
19. PC 端历史会话关闭按钮不参与页面分栏宽度计算：侧边栏布局宽度始终按 `260px` 计算，关闭按钮通过 `position: absolute` 悬浮到侧边栏右侧，可超出侧边栏盒模型显示，但不额外占用页面宽度。
20. 历史会话侧边栏面板改为“整块容器统一 `padding: 20px 18px`”的布局模式；顶部标题区位于该容器内部，尺寸为“高 `32px`、宽占满”；标题文案为“历史对话”，文本左侧内边距 `12px`，样式 `12px/500`、`rgba(51,51,51,1)`。标题区下方内容区继续承担分组列表和空态内容。
21. 历史会话侧边栏在挂载显示时增加过渡动画：面板使用轻量平移动画进入，蒙层同步做透明度过渡；历史数据请求过程中不再渲染“加载中...”文字，仅保留面板基础结构。
22. 历史会话空态图片尺寸调整为宽 `100px`、高自适应，避免当前图标占位过小。
23. PC 端发送快捷键弹窗样式固定为：`180px x 72px`、圆角 `8px`、内边距 `4px`；快捷键 item 选中态背景 `rgba(204,204,204,0.25)` 且圆角 `8px`；item 文本样式 `14px/400` 左对齐；item 左侧图标槽宽度 `28px`；选中态 `√` 使用 `src/imgs` 导入图标，尺寸 `12px x 12px`，在图标槽内居中显示。
24. `WeAgentCUI` 的 `QuestionCard` 统一按对象化选项模型渲染：`options` 在进入 UI 前归一化为 `{ label, description? }[]`；渲染时按钮主文案展示 `label`，存在 `description` 时在下方展示辅助说明，同时兼容字符串数组输入并转换为仅含 `label` 的对象项。若协议同时返回顶层 `options` 与 `input.questions[0].options` / `input.options`，解析层优先采用 `input` 中的对象化选项数据，以保留 `description`，仅在 `input` 内无有效选项时再回退到顶层 `options`。选项区域改为纵向单列布局，每个问题选项块独占一行。选项按钮 hover 态仅允许背景或边框变化，主文案与说明文案颜色保持默认值，不随 hover 切换为白色。用户提交回答成功后，`QuestionCard` 本身继续保留“已回答/回答结果”展示，同时通过上抛 `sendMessage` 返回结果让 `App` 复用现有 `appendMessageFromOperation` 链路插入一条独立用户消息；AI 后续回复仍沿用现有流式消息机制，作为后续独立助手消息块展示。
25. `WeAgentCUI` 对 `session.error` / `error` 采用消息内错误块方案：监听到错误事件后，不单独依赖控制台输出；若存在当前流式中的助手消息，则在该消息 `parts` 末尾追加一个 `error` 类型 Part，否则创建新的助手消息并挂载该错误 Part，再由 `MessageBubble` 渲染统一的错误块组件。
26. `PermissionCard` 宽度统一改为占满当前消息容器可用宽度（`width: 100%`），不再按内容自适应收缩，也不再区分 PC 端最小宽度 `414px` 的特殊约束。
26. `WeAgentCUI` 新增消费 `message.user` 流式事件，用于消息漫游场景下同步展示其他端已发送的用户消息。处理时基于 `knownUserMessageIdsRef` 按 `messageId` 去重：若缓存中已存在同 `messageId` 的用户消息，则直接跳过；否则按用户消息插入到消息列表，并同步刷新“最近一条用户输入”缓存。
27. `WeAgentCUI` 的 UI `Message` 状态需保留 `contentType`。历史消息、发送结果、快照恢复优先透传上游 `contentType`；运行时手动创建的消息按角色兜底：`assistant -> markdown`、`tool -> code`、`user/system -> plain`，避免后续消息归一化与渲染策略丢失内容类型信息。
21. 本地 JSAPI mock 增加关键词驱动的错误注入策略：`sendMessage` 命中特定提示词时，不走正常完成回复，而是先输出一段前置 `text.delta`，再按场景发送 `session.error` 或 `error`，用于稳定验证 `WeAgentCUI` 的消息内错误块渲染与流式收尾逻辑。
22. 本地 JSAPI mock 的目标扩展到全部业务页面：`activateAssistant`、`selectAssistant`、`switchAssistant`、`assistantDetail`、`createAssistant`、`weAgentCUI` 都应能在浏览器本地通过 mock 数据直接访问与联动。
23. mock 环境不单独维护一套伪判端逻辑，端类型判断统一复用 `src/utils/hwext.ts` 中的 `isPcMiniApp`：仅当存在真实或 mock 的 `window.Pedestal.callMethod` 时视为 PC，否则按移动端处理，避免样式和 toast 分流与生产逻辑偏离。
24. 为保证页面在浏览器本地可完整跑通，mock 除业务 JSAPI 外还需补齐最小宿主桥能力：`HWH5.openWebview`、`HWH5.showToast`、`HWH5.getDeviceInfo`、`HWH5.getUserInfo`、`HWH5.getAccountInfo`、`HWH5.navigateBack`、`HWH5.close`；其中 `showToast` 仅模拟原生提示调用，不额外渲染页面内 UI。






