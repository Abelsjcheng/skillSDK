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

1. `src/pages/createAssistantBasic.tsx`
2. `src/pages/selectBrainAssistant.tsx`
3. `src/pages/activateAssistant.tsx`
4. `src/components/createAssistant/StepBasicInfo.tsx`
5. `src/components/createAssistant/StepBrainSelect.tsx`
6. `src/components/createAssistant/CreatorStepHeader.tsx`
7. `src/components/createAssistant/CreatorStepFooter.tsx`
8. `src/components/createAssistant/constants.ts`
9. `src/styles/ActivateAssistant.less`
10. `src/imgs/activate-guide-1.svg`
11. `src/imgs/activate-guide-2.svg`
12. `src/imgs/assistant-cui-bg.png`
13. `src/imgs/assistant-cui-pc-bg.png`
14. `src/styles/DigitalTwinCreator.less`
15. `src/types/digitalTwin.ts`
16. `src/pages/createAssistant.tsx`
17. `public/create-assistant-page.html`
18. `webpack.create-assistant-page.config.js`
19. `src/pages/assistantDetail.tsx`
20. `src/pages/switchAssistant.tsx`
21. `src/components/assistant/AssistantPageHeader.tsx`
22. `src/styles/AssistantPageHeader.less`
23. `src/styles/AssistantDetail.less`
24. `src/styles/SwitchAssistant.less`
25. `src/imgs/icon-back.svg`
26. `src/imgs/icon-service.svg`
27. `src/imgs/icon-close.svg`
28. `src/imgs/assistant-avatar.svg`
29. `src/imgs/switch-assistant-avatar.svg`
30. `example/assistant-components-demo/index.html`
31. `example/assistant-components-demo/webpack.config.js`
32. `example/assistant-components-demo/src/index.tsx`
33. `example/assistant-components-demo/README.md`
34. `src/components/assistant/AssistantSelectionPage.tsx`
35. `src/pages/selectAssistant.tsx`
36. `src/components/__tests__/SelectAssistant.test.tsx`

### 2.2 修改文件（导出目标）

1. `src/lib/index.ts`
2. `package.json`
3. `src/routes/CreateAssistantPageRouter.tsx`
4. `src/routes/AppRouter.tsx`

## 3. 页面打包导出策略

1. 新增独立页面打包配置 `webpack.create-assistant-page.config.js`，以 `src/pages/createAssistant.tsx` 作为入口。
2. 页面构建产物输出到 `dist/create-assistant-page`，包含 `index.html` 与页面脚本。
3. `src/lib/index.ts` 不导出创建助理流程组件，保留 `AIChatViewer` 现有库导出能力。
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
1. 创建助理流程最终由两个路由页面容器承载：第一页基础信息页与第二页能力选择页；旧的 `PersonalAssistantCreator` 统一步骤壳组件下线，不再作为运行时入口。
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
8. 页面 1 默认头像选中态右下角勾选标识改为 `src/imgs/selection_icon.png` 图片资源，通过组件导入渲染；图标尺寸固定为 `12px x 12px`，圆角半径 `16px`。
9. 名称输入框圆角半径固定为 `8px`，左右内边距 `8px`、上下内边距 `7px`。
10. 名称输入框整体可见高度固定为 `36px`（包含边框与上下内边距），实现采用 `box-sizing: border-box`。
11. 名称输入框与简介框边框统一为 `1px solid rgba(0,0,0,0.08)`。
12. 简介输入框整体可见高度固定为 `82px`（包含边框与上下内边距），实现采用 `box-sizing: border-box`，圆角半径 `8px`，`padding: 8px`。
13. 简介块（标题 + 间距 + 简介输入框）整体高度固定为 `112px`。
14. 为消除 2px 行盒误差，名称/简介标签采用块级元素并固定 `height: 22px; line-height: 22px; margin: 0`。
15. 操作区使用 `padding: 16px 24px 12px`，右对齐两个按钮：取消/下一步。
16. 操作区必须固定在组件容器可视范围内，不得超出底部边界；内容区域应自适应可滚动。
17. 操作区按钮文本统一样式为 `font-size: 12px; line-height: 20px`。
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
4. 内容区新增第三容器用于展示插画，尺寸为 `height: 114px; width: 100%`，圆角半径 `12px`；插画由 `StepBrainSelect` 组件内部直接从 `src/imgs` 静态导入，按当前国际化语言切换：中文使用 `banner.png`，英文使用 `banner-en.png`，不再通过父组件 props 透传。插画本身直接使用单个 `img` 标签渲染并绑定点击打开指导文档，不再额外包裹 `a` 或 `div` 容器。
5. 操作区使用 `padding: 16px 24px 12px`，按钮右对齐。
   - 按钮顺序为：取消 / 上一步 / 确定；
   - “上一步”按钮样式与“取消”一致（`64x28`、圆角 `4px`、浅灰背景）。
6. 操作区必须固定在组件容器可视范围内，不得超出底部边界；内容区域应自适应可滚动。
7. 操作区按钮文本统一样式为 `font-size: 12px; line-height: 20px`。
8. “确定”启用条件：
   - `brainType === 'custom'`：可直接启用；
   - `brainType === 'internal'`：内部助手列表有数据时默认选中第一项，因此默认可启用；仅当列表为空且 `selectedBizRobotId` 为空时保持禁用。
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

1. 创建助理不再通过 `PersonalAssistantCreator` 内部 `step` 状态切页；第一页固定路由为 `/createAssistant`，第二页固定路由为 `/selectBrainAssistant`。
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
4. 页面 2 默认 `brainType = 'internal'`，`selectedBizRobotId` 默认取内部助手列表第一项的 `bizRobotId`（若存在）
5. 页面 1 点击“下一步”时将当前头像/名称/简介快照写入路由 `state` 草稿；页面 2 点击“上一步”或浏览器返回时回到 `/createAssistant`，并继续携带该草稿回填 `StepBasicInfo` 本地状态，避免依赖本地存储。

## 7. 交互与校验决策

1. 通过“+”自定义头像按钮触发文件选择时，执行客户端二次校验：
   - 仅允许 `jpg/jpeg/png`
   - 文件大小 `< 2MB`
2. 上传不合法时：
   - 不改变当前头像选择
   - 文件大小超限（`>= 2MB`）使用 toast 提示：`图片大小需小于2MB`
   - 文件格式不合法使用 toast 提示：`仅支持JPG/PNG格式`
   - 页面 1 不再维护 `avatarError` 组件内错误文本状态
3. 页面 1 上传校验 toast 按端分流：PC 端采用统一自定义结构（高度固定 `46px`、宽度按内容自适应、白底圆角 `8px`、`padding: 12px 16px`、顶部 `50px` 水平居中；左侧 `14x14` 警告图标来自 `src/imgs`，与右侧错误文案间距 `8px`；文案样式 `14px/400`、`rgba(25,25,25,1)`）；移动端统一调用宿主 `HWH5.showToast({ msg, type: 'w' })`，不再渲染页面内自定义 toast。
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
   - 当内部助手列表存在数据时，`selectedBizRobotId` 自动落到第一项；若从“自定义助手”切回“内部助手”时当前无选中项，也同样自动回落到第一项
   - 不渲染“内部助手加载中...”与“暂无可用内部助手”提示文案
11. 页面 2 选择“自定义助手”时，提示文案固定为“需在本地电脑自定义部署第三方助手，点击查看指导文档→”；其中“指导文档→”采用超链接渲染，点击打开 web 页面，链接地址当前留空；链接文本颜色固定为 `rgb(9,146,255)`。
12. 点击“确定”时调用 `window.createDigitalTwin(params)`，`params` 字段映射：
   - `name`：页面 1 名称输入值
   - `icon`：页面 1 当前选中头像地址
   - `description`：页面 1 简介输入值
   - `weCrewType`：页面 2 单选值映射（`internal => 1`，`custom => 0`）
   - `bizRobotId`：仅 `weCrewType = 1` 时传，值为选中内部助手项的 `bizRobotId`
13. 所有 `HWH5EXT` / `HWH5` 能力调用在业务层进入 `catch` 分支时，统一直接通过 `showToast(固定错误文案)` 告知用户，不再解析 `error.message/errorMessage`；其中 PC 端由 toast 自身根据当前页面是否存在标题区动态定位，有标题区时显示在标题区顶部 `50px`，无标题区时显示在页面顶部 `50px`，并保持水平居中；移动端则统一透传到宿主 `HWH5.showToast({ msg, type: 'w' })`，不再维护页面内定位。端类型判断统一收口到 `src/constants.tsx` 中的 `isPcMiniApp` / `isIosMobileDevice`，页面、组件与工具层都直接从常量模块取值；`src/utils/hwext.ts` 仅保留复用与兼容导出，避免业务层继续直接依赖环境工具文件中的判端实现。
14. PC 端 JSAPI 适配默认走 `method://agentSkills/handleSdk + funName`，但二维码接口按《小程序JSAPI接口文档》单独走专用 Pedestal 方法：
   - `queryQrcodeInfo`：`window.Pedestal.callMethod('method://agentSkillsDialog/queryQrcodeInfo', params)`
   - `updateQrcodeInfo`：`window.Pedestal.callMethod('method://agentSkillsDialog/updateQrcodeInfo', params)`
   - 这两个接口参数直接透传 `params`，不再包装 `{ funName, params }`。
15. 创建助理二维码场景采用“页面层判断 + 组件层展示”的分层实现：
   - 页面层在 `createAssistantBasic.tsx` 读取 `from` / `qrcode` query，并调用 `queryQrcodeInfo({ qrcode })`；
   - 失效判断只使用“当前时间戳 `Date.now()` 是否严格大于 `Number(expireTime)`”，与需求口径保持一致；
   - `StepBasicInfo` 仅新增受控的失效态展示能力，不在组件内部直接调用二维码查询接口；
   - 失效态使用独立样式 class 覆盖第一页内容区，背景固定 `rgba(196,196,196,1)`，内容区只承载一张从 `src/imgs` 导入的二维码失效提示 `png` 图。
16. 扫码场景改为第一页直创：`createAssistantBasic.tsx` 在 `from=qrcode` 时不再跳转第二页，第一页点击“确定”后直接触发 `createDigitalTwin`；该场景创建参数透传第一页表单已有字段 `name`、`icon`、`description`，并追加当前二维码值 `qrcode`，不再默认补齐“内部助手”语义，也不再额外请求或传入 `weCrewType`、`bizRobotId`。创建成功后的“非 `weAgent` 场景跳转”不在第一页和第二页各自维护，而是抽成共享的 `handleCreateForOtherScene` 方法，由 `createAssistantBasic.tsx` 与 `selectBrainAssistant.tsx` 共同复用，确保两处跳转逻辑始终一致。
17. 创建助理流程中的窗口关闭动作同样不在页面内重复定义：`closeCreateAssistantWindow` 抽成共享工具，与 `handleCreateForOtherScene` 放在同一创建流程工具模块中，由第一页、第二页及后续相关流程统一调用，避免宿主关闭逻辑散落多处。
18. 创建助理成功结果中的 `partnerAccount` 读取逻辑也统一收口：`resolvePartnerAccount` 抽成共享工具，第一页与第二页都不再各自重复声明，后续凡是需要从 `CreateDigitalTwinResult` 中解析 `partnerAccount` 的场景都复用该方法。
19. 二维码状态回写通过 `updateQrcodeInfo` 统一收口到页面层：
   - 状态 `1`：第一页 `queryQrcodeInfo` 查询成功后立即回写，不区分二维码是否已过期；
   - 状态 `2`：扫码场景第一页直创成功后立即回写；
   - 状态 `3`：扫码场景主动退出流程时回写。
   - `updateQrcodeStatusSafely` 自身不再判断 `qrcode` 是否为空、也不判断当前是否二维码场景，入参统一原样透传给 `updateQrcodeInfo`；是否需要触发回写由页面调用点自行决定。
20. 扫码场景的退出动作按“是否离开创建流程”区分：
   - 第一步页面：移动端左上角返回、PC 端右上角关闭、PC 端取消按钮，都视为退出流程，回写 `status:3`。
21. 扫码场景第一页额外接入宿主返回键监听：在 `createAssistantBasic.tsx` 页面层、且仅在移动端 `from=qrcode` 时调用 `HWH5.addEventListener({ type: 'back', func })` 注册；`func` 内通过 `void updateQrcodeStatusSafely(3)` 异步触发二维码取消回写，并同步 `return true` 交还宿主返回结果，不把监听逻辑下沉到 `StepBasicInfo`。
22. 二维码状态回写失败不阻断主流程：
   - `status:1` 回写失败只 toast 提示，第一页仍进入失效态；
   - `status:2` 回写失败只 toast 提示，创建成功后的既有非 `weAgent` 流程继续执行；
   - `status:3` 回写失败只 toast 提示，关闭窗口或返回动作继续执行。

## 8. 样式与实现约束

1. 创建助理样式集中在 `src/styles/DigitalTwinCreator.less`，使用 BEM 风格命名前缀：`digital-twin-`。
2. 布局单位优先使用 `px`，严格按需求值实现。
3. 颜色值优先使用需求中的 `rgba(...)` 原值。
4. 不引入新 UI 库；沿用当前项目原生 `button/input/textarea` + Less。
5. 组件根节点与主容器必须设置 `width: 100%; height: 100%;`，确保填满父容器。
6. 页面入口直接渲染路由页容器，并由路由页显式引入 `DigitalTwinCreator.less`，不再通过旧步骤壳组件间接注入样式。
7. 布局采用 `header + content + actions` 的纵向弹性结构：`header/actions` 固定，`content` 使用 `flex: 1; min-height: 0; overflow: auto`。
8. 页面打包模式下入口文件负责挂载页面根节点，不通过库导出组件进行外部挂载。
9. 页面模板层（`html/body/#root`）需设置为 `width: 100%; height: 100%; margin: 0;`。
10. 样式维护中可删除重复或无效属性（如重复 margin/flex 收缩声明），前提是不改变页面视觉与交互。
11. 页面 1 与页面 2 主体区域统一使用线性渐变主题背景：`linear-gradient(180deg, rgba(206,233,255,1) 0px, rgba(206,233,255,1) 40px, rgba(255,255,255,1) 176px, rgba(255,255,255,1) 100%)`。
12. 页面主题背景容器附加统一阴影：`box-shadow: 0 16px 48px 0 rgba(0,0,0,0.16)`。
13. 移动端样式覆盖与结构切换基于 `isPcMiniApp` 对应 class 生效，不使用媒体查询替代端类型判断。
16. 通用端判断方法统一放在 `src/constants.tsx`：`isPcMiniApp()` 用于 PC/移动端分支，`isIosMobileDevice()` 用于 iOS 移动端特性开关；除 `hwext` 内部复用外，其余页面、组件、工具文件都从该常量模块导入，避免判端入口分散。
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

1. 在主入口 `src/index.tsx` 基于 `react-router-dom` 引入官方 `HashRouter`，路由配置下沉到独立路由组件，不再维护项目内自定义 `HashRouter`。
2. 路由表包含创建助理双页与其他业务页：
   - `/weAgentCUI` -> `App`（WeAgentCUI 对话页）
   - `/createAssistant` -> 创建个人助理第一页
   - `/selectBrainAssistant` -> 创建个人助理第二页
   - `/activateAssistant` -> `ActivateAssistant`（激活助理页）
   - `/assistantDetail` -> `AssistantDetail`（助理详情页）
   - `/switchAssistant` -> `SwitchAssistant`（切换助理页）
   - `/selectAssistant` -> `SelectAssistant`（启动助理页）
   - `/` 与 `*` -> 重定向到 `/weAgentCUI`
3. 页面路由切换不改变原有业务逻辑，只做视图层分发。
4. `create-assistant-page` 独立打包入口同步引入 Hash Router，并与主入口复用 `/createAssistant`、`/selectBrainAssistant` 两个创建助理路由，保证浏览器返回行为一致。
5. 创建助理拆分为两个路由页后，页面级容器需继续显式引入 `src/styles/DigitalTwinCreator.less`，不能再依赖旧的 `PersonalAssistantCreator` 组件间接带入样式，避免出现新路由页结构已切换但样式丢失的问题。

## 11.1 WeCodeUrl Host 解析

1. `weCodeUrl` 的 host 提取统一收敛到 `src/utils/hwext.ts`。
2. 由于业务 URI 存在 `h5://123456/html/index.html` 这类自定义协议地址，host 解析不依赖 `URL.host`，改为通过正则表达式从 `://` 后到下一个 `/` 之前的片段提取。
3. 解析失败时返回空字符串，后续 `openWeAgentCUI` 参数组装继续走现有兜底逻辑。

## 12. 激活助理页面设计

1. 页面结构拆分为两段：
   - 内容区：容器宽度自适应 `100%`、高度按内容自适应，图片容器按图片原始尺寸展示，顶部间距 `78px`；
   - 操作区：与内容区间距 `65px`，仅保留“立即启用”主按钮。
   - 页面根容器背景改为通用助理背景图，移动端使用 `assistant-cui-bg.png`、PC 端使用 `assistant-cui-pc-bg.png`，并统一按页面尺寸拉伸显示（`background-size: 100% 100%`）。
2. 内容区仅展示本地引导图资源，不再保留轮播状态与指示器逻辑；图片选择规则统一按端类型与当前国际化语言确定：
   - PC 中文：`src/imgs/activate-guide-pc.png`
   - PC 英文：`src/imgs/activate-guide-pc-en.png`
   - 移动中文：`src/imgs/activate-guide.png`
   - 移动英文：`src/imgs/activate-guide-en.png`
3. “选择助理/立即启用”按钮按端区分样式：移动端使用 `250x38`、圆角 `99px`；PC 端使用 `140x32`、圆角 `4px`；背景统一为线性渐变 `linear-gradient(90deg, #1f78ff 0%, #42b0ff 100%)`，当前版本点击事件空实现（预留业务接入）。

## 13. 依赖版本兼容决策

1. 构建工具链保持对 `Node.js 18.x` 的可运行性。
2. `copy-webpack-plugin` 固定为 `13.x`，避免 `14.x` 依赖 `Array.prototype.toSorted`（`Node 20+`）导致开发服务与生产构建失败。

## 14. 助理详情页面设计

1. 页面采用“标题区 + 内容区”纵向结构，整体宽高自适应占满路由容器。
2. 标题区以外的页面区域背景统一改为助理背景图，并按页面区域尺寸拉伸显示（`background-size: 100% 100%`）。
3. 标题区通过 `isPcMiniApp` 区分端样式：
   - `isPcMiniApp === true`（PC）：`height: 54px; padding: 11px 16px;`，左侧 `32x32` 关闭按钮（内含 `20x20` 关闭图标），右侧 `32x32` 客服按钮（内含 `20x20` 客服图标），中间标题居中。
   - `isPcMiniApp === false`（移动）：沿用 `44px` 高度与左侧返回+客服按钮布局，左侧首个按钮距离页面左边 `12px`，右侧编辑按钮距离页面右边 `12px`；右侧编辑按钮尺寸 `24x24`，图标资源使用 `src/imgs/edit_icon.png`。
4. 内容区改为通过内边距控制与标题区间距，使用 `padding: 12px 16px 16px`（上 `12px`、左右 `16px`），包含三个白底圆角卡片（圆角 `8px`）：
   - 卡片 1：头像（`72x72`，圆角 `19px`）+ 名称“小咪”+ 标签“员工助手”；名称文本需独立水平居中，标签不参与名称居中计算；
   - 卡片 2：助理简介标题与正文（“你的全能AI生活助理”）+ 创建者行；创建者右侧值按当前语言选择：中文使用 `creatorName + ' ' + createdBy`，英文使用 `creatorNameEn + ' ' + createdBy`；
   - 卡片 3：内部助理场景仅展示 1 行“能力提供方 / displayTag”，不再展示“部门/责任人”；外部助理场景继续展示 `APPID` 与 `密钥` 两行。
   - 卡片 2 中“助理简介内容”和“创建者行”之间增加 `1px solid rgba(0,0,0,0.05)` 分割线；
   - 卡片 3 仅在外部助理双行场景下保留上下分层布局；内部助理单行场景不再需要“部门/责任人”之间的分割线。
   - 标题区与头像区域相关图标/图片均通过 `src/imgs` 静态资源导入，不再使用内联 SVG 或纯色块占位。
5. 页面为静态展示页，当前版本不接入接口与状态管理；按钮点击仅保留空实现占位，后续按业务接入。
6. 移动端客服按钮点击按 `weCodeUrl.host` 分支处理：若当前 `weCodeUrl` 的 host 与 `APP_ID` 一致，则直接打开固定 `CUSTOMER_SERVICE_WEBVIEW_URI`；若 host 与 `APP_ID` 不一致，则继续复用 `buildCustomerServiceWebviewUri(weCodeUrl)`；`weCodeUrl` 为空时维持现有提示逻辑。
7. 助理详情页移动端新增两个覆盖层组件：
   - 底部操作弹窗：由编辑按钮触发，采用独立组件 + `createPortal(document.body)` + 固定定位整页蒙层方案；面板高度改为按内容自适应、顶部圆角 `12px`、白底，内部依次展示“修改助理信息 / 删除助理 / 取消”三个 `48px` 高的文本操作项，并按需求保留 `336px` 分割线与 `8px` 灰色间隔区。
   - 删除确认弹窗：点击“删除助理”后出现，使用独立组件 + `createPortal(document.body)` + 固定定位居中面板，宽度 `280px`、圆角 `8px`、白底；标题使用当前助理名称插值，样式调整为 `16px/400/24px` 且允许换行显示，内容说明文本保持居中对齐，底部通过两个文本按钮“取消 / 删除”组成操作区，中间有 `1px x 16px` 分割线。
8. 两个覆盖层组件样式从 `AssistantDetail.less` 中拆出，分别维护独立 less 文件，避免继续受详情页主容器样式污染。
9. 页面层不再用两个分散的布尔值控制弹窗，而是收口成单一 overlay 状态（如 `none / action-sheet / delete-modal`），减少切换时的样式与时序问题。
10. 交互上“取消”和蒙层负责关闭对应弹窗；“修改助理信息”继续保留空实现；移动端最终“删除”按钮接入真实删除链路：调用 `deleteWeAgent({ partnerAccount, robotId? })`，成功后直接执行 `window.HWH5.close()`，失败则按既有规范 `showToast(固定错误文案)`。
11. 编辑助理页回填头像时，默认头像识别与头像显示分开处理：默认头像判断阶段直接使用原始 `detail.icon` 与 `DEFAULT_AVATARS.image` 做严格相等比较，不走 `resolveAssistantIconUrl`；真正回填给表单展示的 `icon` 则统一使用 `resolveAssistantIconUrl(detail.icon)`，保证非默认头像与默认头像回显都使用同一显示规范化结果。

## 15. 切换助理页面设计

1. 页面结构采用“标题区 + 列表内容区”，整体宽高占满路由容器。
2. 标题区以外的页面区域背景统一改为助理背景图，并按页面区域尺寸拉伸显示（`background-size: 100% 100%`）。
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
8. 移动端客服按钮点击后直接打开固定 `CUSTOMER_SERVICE_WEBVIEW_URI`，不再拼接 `sourceURL`；PC 端保持现有逻辑不变。
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
2. 页面背景统一改为助理背景图，并按当前页面尺寸拉伸显示（`background-size: 100% 100%`）。
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
9. 移动端客服按钮点击后直接打开固定 `CUSTOMER_SERVICE_WEBVIEW_URI`，不再拼接 `sourceURL`；PC 端保持现有逻辑不变。

## 17. WeAgentCUI 页面设计

1. `WeAgentCUI` 为当前唯一对话页，`App` 仅保留 `weAgentCUI` 数据流与会话能力（消息加载、发送、流式更新、停止、历史分页）。
2. 页面结构为：`对话内容区 + 多功能按钮区 + 底部输入区`。
4. `weAgentCUI` 页面根容器背景统一使用助理背景图，并按当前页面尺寸拉伸显示（`background-size: 100% 100%`）；移动端默认 `assistant-cui-bg.png`，PC 端继续通过页面级 class 覆盖为 `assistant-cui-pc-bg.png`。
5. 多功能按钮区高度固定为 `32px`，左侧提供相邻排列的“新建会话”“历史会话”两个 `32px x 32px` 的白底圆角按钮，按钮间距固定 `8px`，图标统一为 `16px x 16px`；其中“新建会话”按钮按最简规则直接使用 `messages.length === 0` 判断当前是否为空会话，满足时不重复创建会话，直接 toast 提示“当前是最新会话”；中间增加白底圆角状态提示块“输出中...”，高度 `32px`、圆角 `20px`、文本样式 `12px/400`、颜色 `rgba(38,159,255,1)`，仅在 AI 生成阶段显示，且位置固定在整行多功能按钮区的水平中点。该提示块必须与当前激活的 `welinkSessionId` 绑定，切换会话后不继承旧会话的生成态，旧会话晚到的 `busy/idle/error` 事件也不得影响当前会话的显示状态。
6. 消息渲染层在 `MessageBubble` 增加变体样式支持：
   - 用户消息右对齐，头部文案为“测试 + 时间”，右侧头像 `24x24`；
   - 助手消息左对齐，头部文案为“小米 + 时间”，左侧头像 `24x24`；
   - 助手消息中，头像名称头部块与下方 AI 回复消息块之间的纵向间距固定为 `8px`；
   - 用户气泡使用蓝色线性渐变；助手气泡容器宽度改为占满当前消息容器整行，适用于所有 AI 消息类型块，不再仅限代码块场景。
   - AI 消息块内部的可折叠子组件（代码块、思考块、工具调用块）统一使用 `arrow_up_icon.svg` 作为箭头资源，并保持“展开朝上、收缩朝下”的方向约定，避免不同卡片各自使用字符箭头或方向不一致。
   - `CodeBlock` 在助手消息中按块级元素独占一行展示，并占满当前消息内容区域的可用宽度；普通文本内容仍保持气泡按内容宽度收缩。
   - `CodeBlock` 在移动端不启用强制折行，长代码统一保持原始行结构，通过代码块内容区自身的横向滚动承载，避免窄屏下把代码缩进和语义打散；代码区域滚动条隐藏，但不移除横向滚动能力。
7. 输入区在 `Footer` 增加变体样式支持：
   - 容器 `height: 40px; padding: 8px 12px; border-radius: 30px; background: #fff`；
   - placeholder 固定为“有问题尽管问我~”；
   - 发送按钮为 `24x24` 图标按钮，图标尺寸 `20x20`。
8. iOS 端 `WeAgentCUI` 输入框唤起软键盘时，不再通过对底部输入区做 `transform` 上抬来规避遮挡；改为继续监听 `HWH5.onKeyboardHeightChange`，并将键盘高度写入页面根容器的布局变量，由 `we-agent-cui-main` 按真实高度缩减可视区域。键盘打开期间页面外层需保持 `overflow: hidden`，只允许消息内容区内部滚动，避免 iOS WebView 暴露整页滚动条。
9. `WeAgentCUI` 内容区滚动容器需保持“可滚动但隐藏滚动条”的策略；除通用 `.content` 样式外，还需对 `.content--we-agent-cui` 单独补充 `scrollbar-width: none`、`-ms-overflow-style: none` 与 `::-webkit-scrollbar { display: none; width: 0; height: 0; }`，尽量降低 iOS WebView 中系统滚动指示条的可见概率。
10. 样式文件 `src/styles/WeAgentCUI.less` 负责维护 WeAgentCUI 布局，class 前缀统一使用 `we-agent-cui-`。
11. 新增图标资源：
   - `src/imgs/icon-we-agent-new-session.svg`
   - `src/imgs/icon-we-agent-history.svg`
   - `src/imgs/icon-we-agent-send.svg`
12. `aiChat` 页面及其相关逻辑已移除，不再保留 `variant` 分支与 `/aiChat` 路由。
13. 在 `weAgentCUI` 变体下，当消息列表为空时，`Content` 区渲染欢迎块（头像 + 标题 + 副标题），样式规则如下：
   - 顶部间距 `27px`；
   - 纵向 `12px` 间距、水平居中；
   - 头像容器 `72x72`，圆角 `124px`，白色 `2px` 边框；
   - 标题文本使用运行时用户信息动态生成（如存在 `weAgentUserName` 则展示 `早上好，${weAgentUserName}`）；其中 `weAgentUserName` 按当前国际化语言选择用户字段：中文取 `userNameZH`，英文取 `userNameEN`，样式 `18px/500/26px`、`rgba(25,25,25,1)`；
   - 对应国际化资源中的用户名占位符统一使用 `i18next` 标准插值语法 `{{name}}`，避免欢迎块渲染时把 `{name}` 原样输出到页面；
   - 副标题文本使用运行时助理信息动态拼接（`weAgentAssistantName | weAgentAssistantDescription`），样式 `14px/400/22px`、`rgba(89,89,89,1)`；
   - 不为欢迎标题和副标题提供默认兜底文案；当对应数据为空时直接不渲染文本节点。
12. `WeAgentCUI` 消息区不保留“复制消息”“发送到IM”入口，`App -> Content -> MessageBubble` 组件链路中移除 `onCopy`、`onSendToIM` 参数透传。
13. 历史消息中的 AI `Question` / `Permission` 卡片统一按只读展示处理：`App` 在历史消息映射阶段标记来源，`MessageBubble` 将该标记透传到 `QuestionCard` 与 `PermissionCard`，并在组件内部禁用选项点击、输入提交及授权按钮点击。
14. `MessageBubble` 保持现有消息渲染优先级：优先消费 `message.parts` 渲染结构化消息；仅当 `parts` 不存在或为空时才回退到 `message.content`。在该回退分支下，若 `message.content === ''`，则直接不渲染该条消息，避免历史消息或实时消息出现空文本占位。
15. 全页面取消“禁止复制”限制：不通过触摸事件 `preventDefault` 或样式策略阻断系统默认文本选择与复制行为。
16. 历史会话侧栏的每个会话 item 标题按单行省略处理，超出宽度显示 `...`。
17. 历史会话侧栏面板保持纵向滚动能力，同时隐藏可视滚动条（`scrollbar-width: none` + `::-webkit-scrollbar { display: none; }`）。
18. 历史会话面板按端分流：移动端改为“左侧抽屉 + 右侧蒙层”方案；PC 端为左侧固定宽度 `260px` 的历史会话栏，并通过页面布局为右侧对话区预留空间，形成左右分栏显示。由于组件触发按钮位于多功能按钮区内部，PC 端侧边栏外层容器必须脱离按钮区局部定位上下文，采用覆盖整个页面左侧区域的定位方式，避免被按钮区 `32px` 高度裁剪。PC 端 `weAgentCUI` 根容器去除外层 `padding`；右侧 AI 对话容器单独承担上下内边距，固定 `padding-top: 16px`、`padding-bottom: 30px`。默认状态下右侧 AI 对话容器左右内边距为 `150px`，内容宽度占满右侧可用区域；当历史会话侧边栏展开时，左右内边距切换为 `50px`，内容宽度仍占满右侧可用区域，不再限制 `max-width`。
19. PC 端历史会话关闭按钮不参与页面分栏宽度计算：侧边栏布局宽度始终按 `260px` 计算，关闭按钮通过 `position: absolute` 悬浮到侧边栏右侧，可超出侧边栏盒模型显示，但不额外占用页面宽度。
20. 历史会话侧边栏面板改为“整块容器统一 `padding: 20px 18px`”的布局模式；顶部标题区位于该容器内部，尺寸为“高 `32px`、宽占满”；标题文案为“历史对话”，标题容器 `padding: 6px 12px`，文本样式 `12px/500`、`rgba(51,51,51,1)`。标题区下方内容区继续承担分组列表和空态内容。
21. 历史会话侧边栏在挂载显示时增加过渡动画：面板使用轻量平移动画进入，蒙层同步做透明度过渡；历史数据请求过程中不再渲染“加载中...”文字，仅保留面板基础结构。
22. 历史会话空态图片尺寸调整为宽 `100px`、高自适应，避免当前图标占位过小。
23. PC 端历史会话分组标题由“今天 / 昨天 / 3天前”组成；“今天”“昨天”“3天前”标题容器高度统一 `32px`，`padding: 6px 12px`，文本样式 `12px/400`、`rgba(153,153,153,1)`。
24. PC 端历史会话 item 容器高度统一 `32px`，`padding: 6px 12px`；item 文本样式 `12px/400`、`rgba(51,51,51,1)`，当前会话选中态背景改为白色、圆角半径 `8px`。
23. PC 端发送快捷键弹窗样式固定为：`180px x 72px`、圆角 `8px`、内边距 `4px`；快捷键 item 选中态背景 `rgba(204,204,204,0.25)` 且圆角 `8px`；item 文本样式 `14px/400` 左对齐；item 左侧图标槽宽度 `28px`；选中态 `√` 使用 `src/imgs` 导入图标，尺寸 `12px x 12px`，在图标槽内居中显示。
24. `WeAgentCUI` 的 `QuestionCard` 统一按对象化选项模型渲染：`options` 在进入 UI 前归一化为 `{ label, description? }[]`；渲染时按钮主文案展示 `label`，存在 `description` 时在下方展示辅助说明，同时兼容字符串数组输入并转换为仅含 `label` 的对象项。若协议同时返回顶层 `options` 与 `input.questions[0].options` / `input.options`，解析层优先采用 `input` 中的对象化选项数据，以保留 `description`，仅在 `input` 内无有效选项时再回退到顶层 `options`。选项区域改为纵向单列布局，每个问题选项块独占一行。选项按钮 hover 态仅允许背景或边框变化，主文案与说明文案颜色保持默认值，不随 hover 切换为白色。参考 `skill-miniapp`，`QuestionCard` 不在组件内部直接调用 `sendMessage`，而是只把 `answer + toolCallId` 上抛给 `App`；`App` 统一复用现有用户发送链路插入独立用户消息，并让后续 AI 回复继续走常规流式助手消息。为避免 question 完成事件在流式态结束后又重新生成一个 question 消息块，监听层需在 `question completed/error` 且当前无活跃流式 question 消息时，仅补丁更新原 `QuestionCard` 的回答状态与结果。
25. `WeAgentCUI` 对 `session.error` / `error` 采用消息内错误块方案：监听到错误事件后，不单独依赖控制台输出；若存在当前流式中的助手消息，则在该消息 `parts` 末尾追加一个 `error` 类型 Part，否则创建新的助手消息并挂载该错误 Part，再由 `MessageBubble` 渲染统一的错误块组件。
26. `PermissionCard` 宽度统一改为占满当前消息容器可用宽度（`width: 100%`），不再按内容自适应收缩，也不再区分 PC 端最小宽度 `414px` 的特殊约束。
26. `WeAgentCUI` 新增消费 `message.user` 流式事件，用于消息漫游场景下同步展示其他端已发送的用户消息。处理时基于 `knownUserMessageIdsRef` 按 `messageId` 去重：若缓存中已存在同 `messageId` 的用户消息，则直接跳过插入；否则按用户消息插入到消息列表，并同步刷新“最近一条用户输入”缓存。无论该条用户消息是否已在本地列表中，`message.user` 都代表新一轮 assistant 回复即将开始；该阶段仅打开独立的“正在生成中，请稍等...”预览块，并重置上一轮 assistant 的流式上下文，不再向 `messages` 插入随机 `id` 的 pending assistant message。
27. `WeAgentCUI` 的 UI `Message` 状态需保留 `contentType`。历史消息、发送结果、快照恢复优先透传上游 `contentType`；运行时手动创建的消息按角色兜底：`assistant -> markdown`、`tool -> code`、`user/system -> plain`，避免后续消息归一化与渲染策略丢失内容类型信息。
28. `WeAgentCUI` 对 AI 流式助手消息采用“独立占位预览 + 真实消息直写”的策略：页面显示“正在生成中，请稍等...”时，不把该占位块作为 `Message` 写入 `messages`；该独立占位预览仅由 `message.user` 事件拉起。真正承载内容的 AI 事件根据 SDK 文档保证都会携带真实 `messageId`，因此实时内容、`streaming` 补流、`snapshot`/历史恢复都直接按该真实 `messageId` 创建或更新 assistant 消息，不再做随机占位消息 ID 提权。
29. `streamingMsgIdRef` 保持原命名，但语义收敛为“当前真实 assistant 消息的 `messageId` 引用”：在尚未收到真正内容前始终为 `null`；收到首个承载内容事件时写入真实 `messageId`；会话结束、停止、错误、切换会话、快照恢复时统一清空。
30. 通用助理背景图分流继续留在样式层实现：移动端默认使用 `assistant-cui-bg.png`，PC 端新增 `assistant-cui-pc-bg.png` 并通过 `.pc-mode`、`--pc` 这类页面级 class 覆盖 `background-image`；不把背景图选择下沉到组件内的 `isPcMiniApp()` 运行时判断，避免同一视觉资源策略散落到 JSX 逻辑里。
21. 本地 JSAPI mock 增加关键词驱动的错误注入策略：`sendMessage` 命中特定提示词时，不走正常完成回复，而是先输出一段前置 `text.delta`，再按场景发送 `session.error` 或 `error`，用于稳定验证 `WeAgentCUI` 的消息内错误块渲染与流式收尾逻辑。
22. 本地 JSAPI mock 的目标扩展到全部业务页面：`activateAssistant`、`selectAssistant`、`switchAssistant`、`assistantDetail`、`createAssistant`、`weAgentCUI` 都应能在浏览器本地通过 mock 数据直接访问与联动。
23. mock 环境不单独维护一套伪判端逻辑，端类型判断统一复用 `src/utils/hwext.ts` 中的 `isPcMiniApp`：仅当存在真实或 mock 的 `window.Pedestal.callMethod` 时视为 PC，否则按移动端处理，避免样式和 toast 分流与生产逻辑偏离。
24. 为保证页面在浏览器本地可完整跑通，mock 除业务 JSAPI 外还需补齐最小宿主桥能力：`HWH5.openWebview`、`HWH5.showToast`、`HWH5.getDeviceInfo`、`HWH5.getUserInfo`、`HWH5.getAccountInfo`、`HWH5.navigateBack`、`HWH5.close`；其中 `showToast` 仅模拟原生提示调用，不额外渲染页面内 UI。

## 18. 无用代码清理策略

1. 不做“为清理而清理”的大改造，只删除已确认无引用或与当前实现重复的代码，避免引入页面样式和行为回归。
2. `CodeBlock` 复制逻辑统一复用 `src/utils/clipboard.ts`，不在组件内部重复保留一套 `textarea + execCommand` 实现。
3. `digitalTwinValidation.ts` 中未参与当前头像校验逻辑的历史常量需同步移除，保持实现语义与实际行为一致。
4. `StepBasicInfo`、`App`、`hwext` 等文件中的未使用 import / 类型 / 常量直接删除，避免继续作为噪音留在主链路代码中。
5. 已与当前实现脱节的测试用例按现状收敛：
   - 删除已经不存在的 DOM 或上传链路断言；
   - 保留仍覆盖真实行为的页面入口、交互和参数组装断言。
6. 现阶段不删除独立 webpack 页面入口、库导出接口和 `example` 演示代码，因为这些文件虽然在主应用运行时不一定被直接引用，但仍属于构建产物的一部分。

## 19. plugin.json 构建脚本设计

1. 构建脚本采用“双入口”方案：
   - 根目录 `build.js` 作为外部固定调用入口；
   - `.build_config/build.js` 作为真实实现，集中维护文件改写逻辑。
2. 这样既满足“脚本归档在 `.build_config`”的整理诉求，也兼容外部仍通过 `node ./build.js ${appid}` 执行的现有习惯。
3. `indexURL` 的 host 更新使用 `URL` 解析后写回，不手写字符串替换，避免未来 `indexURL` 带 query/hash 时被误改。
4. 脚本只修改 `plugin.json` 的 `indexURL` 与 `appId`，不引入额外构建流程依赖，也不改动其他字段。

## 20. 国际化方案迁移设计

1. `ai-chat-viewer` 的国际化底座从项目内自研轻量实现迁移为 `react-i18next + i18next`，统一收口到社区标准能力，便于后续扩展语言包、命名空间与按需加载。
2. 迁移后不再保留 `src/i18n/index.ts` 这一层自定义运行时封装；组件内统一直接使用 `useTranslation()`，非 React 模块统一直接引用 `i18n` 实例调用 `i18n.t(...)`。
3. 现有文案 key 体系保持不变，继续使用扁平 key 形式（如 `weAgent.outputting`、`codeBlock.copy`），避免业务层在本轮迁移中同时改动 key 命名和调用方式。
4. `src/i18n` 目录调整为标准资源组织：
   - `src/i18n/config.ts`：负责初始化 `i18next`、注册 `react-i18next`、导出 `i18n` 实例与语言标准化方法；
   - `src/i18n/resources/zh.ts`、`src/i18n/resources/en.ts`：分别维护中英文资源；
   - `src/i18n/types.ts`：提供资源类型声明与 `i18next` 模块增强，尽量保留 key 的类型约束能力。
5. 启动语言初始化继续复用 `getAppInfo().language`：语言来源兼容统一在 [hwext.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/utils/hwext.ts) 的 `getAppInfo()` 函数内部实现，通过 `isPcMiniApp()` 区分端类型，移动端直接读取 `window.HWH5.getAppInfo()`，PC 端直接读取 `window.localStorage?.getItem('language')`，并在该函数内部统一映射为 `{ language: 'zh' | 'en' }`。前端 `normalizeLanguage` 仅作为最后一道兜底，兼容 `1033 -> en`、`2052 -> zh` 以及 `en-US` / `zh-CN` 等旧值，再调用 `i18n.changeLanguage(...)`。
6. PC 端新增运行时语言桥接：在 `hwext.ts` 中统一封装宿主 `window.onReceive(payload)` 监听，其中 `2052` 映射为 `zh`、`1033` 映射为 `en`；应用初始化时注册一次监听，收到合法语言值后直接通知 `i18n` 单例执行 `changeLanguage`，不增加 `localStorage` 回写、旧回调链保留等额外兼容逻辑。
7. 页面入口需在最早阶段引入 `src/i18n/config.ts`，确保首次渲染前完成国际化实例初始化，避免首屏出现未初始化或文案闪动；同时在该配置层内注册运行时语言监听。
8. 本轮迁移范围优先覆盖当前已接入自研 i18n 的链路：
   - `App.tsx`
   - `routes/AppRouter.tsx`
   - `utils/toast.ts`
   - `utils/streaming.ts`
   - `activateAssistant`
   - `createAssistant` / `createAssistantBasic` / `selectBrainAssistant` / `StepBasicInfo` / `StepBrainSelect` / `CreatorStepHeader`
   - `assistantDetail`
   - `selectAssistant` / `switchAssistant`
   - `CodeBlock` / `PermissionCard` / `QuestionCard` / `ThinkingBlock`
   - `Content` / `AssistantPageHeader` / `WeAgentCUIFooter` / `WeAgentHistorySidebar`
9. 当前尚未纳入国际化体系的硬编码中文页面和组件不在本轮库迁移中强制一并改造；本轮目标是在完成底座迁移后，逐页补齐剩余文案，且 `activateAssistant`、创建助理相关页面与 `assistantDetail` 已纳入当前覆盖范围。
10. 旧的 `src/i18n/messages.ts` 不再作为运行时词典入口保留；原有资源内容拆分迁移到 `resources/zh.ts` 与 `resources/en.ts` 后，可直接删除旧文件，避免双套词典并存。
11. 非 React 场景（如 toast、streaming、工具层辅助方法）禁止继续自定义包装 `t()`；统一直接依赖单例 `i18n`，减少额外抽象层。

## 21. 类型收口设计

1. `src/utils/hwext.ts` 仅保留运行时能力适配与辅助方法，不再承担类型中转导出职责。
2. 桥接层相关类型统一以 `src/types/bridge` 为单一来源；业务层如果需要 `WeAgentDetails`、`GetWeAgentListParams`、`HWH5EXT`、`CreateDigitalTwinResult` 等类型，直接从 `src/types/bridge` 导入。
3. 页面、组件、mock、opencode 适配层禁止再通过 `hwext.ts` 获取类型，避免出现“工具模块既导出函数又转导出类型”的双重职责。
4. 页面对外暴露的 props 类型也按页面域收口到 `src/types/pages`，例如 `AssistantDetailProps` 不再定义在 `src/pages/assistantDetail.tsx` 内部，而是放到 `src/types/pages/assistant.ts` 后由页面文件和库导出入口共同引用。
5. 此次收口不调整类型定义语义，只调整导入边界：类型定义位置保持稳定，`hwext.ts` 侧只删除 type re-export 和相关下游依赖。

## 22. 全局版本更新弹窗设计

1. 全局版本更新能力挂在应用根路由层实现，由 `AppRouter` 负责注册一次 `onTabForUpdate` 监听并渲染弹窗容器，避免多个页面重复监听导致重复弹窗。
2. 监听注册通过 `src/utils/hwext.ts` 新增运行时封装方法完成，业务层不直接访问 `window.HWH5EXT.onTabForUpdate`。
3. 版本更新确认框与助理详情页删除确认框统一抽象为通用确认弹窗组件，保留相同的蒙层、Portal 和底部双按钮结构，仅通过入参区分标题、描述和确认按钮颜色。
4. 通用确认弹窗默认沿用当前删除弹窗的视觉骨架：居中展示、白底圆角 `8px`、标题/正文居中、底部双按钮与中间竖分割线。
5. 更新弹窗确认按钮颜色单独配置为 `#0D94FF`；删除助理场景继续通过入参覆盖为红色 `rgba(243, 111, 100, 1)`，保证删除交互视觉不回退。
6. `AppRouter` 中收到版本更新回调后，仅更新本地弹窗显隐状态，不立即调用重启。
7. 用户点击取消按钮或蒙层时只关闭弹窗；点击确认按钮时调用 `src/utils/hwext.ts` 中封装的 `rebootApp()`，内部转发到 `window.HWH5.reboot()`。
8. `rebootApp()` 调用失败时，`AppRouter` 捕获异常并按现有规范直接执行 `showToast(固定错误文案)`；不解析宿主错误对象。
9. 为保持本地调试与 OpenCode 适配编译通过，`HWH5EXT` mock / opencode 适配层需要补齐 `onTabForUpdate` 空实现，`HWH5` mock 需要补齐 `reboot` 空实现。
10. 更新弹窗文案纳入现有 `react-i18next` 资源，统一由 `useTranslation()` 读取，避免全局组件引入新的文案常量来源。






