# 创建个人助理页面需求文档

- 项目：`ai-chat-viewer`
- 文档版本：`v3.67`
- 创建日期：`2026-03-18`
- 状态：`需求已确认，可进入设计阶段`

## 1. 目标

在现有 `ai-chat-viewer` 工程中新增一个“创建个人 agent 助理”的独立页面，并支持以页面产物方式打包导出。页面内部包含 2 个步骤页，用于完成个人助理基础信息与“大脑类型/来源”配置。

## 2. 交付范围

1. 新增一个独立页面打包入口（暂记为 `create-assistant-page`），产物包含可直接访问的 `index.html` 与对应脚本资源。
2. 页面内部通过两个路由页面容器承载创建助理流程：第一页基础信息页与第二页能力选择页；不再保留 `PersonalAssistantCreator` 作为统一步骤壳组件。
3. 页面内部包含 2 个页面：
   - 页面 1：基础信息录入（头像、名称、简介）。
   - 页面 2：助理大脑类型选择（内部助手/自定义助手）。
4. 页面内包含完整交互状态：
   - 关闭、取消、下一步、确定；
   - 必填校验与按钮禁用/启用态；
   - 选中态视觉反馈（边框、勾选标识）。
5. 页面功能内部闭环，不向宿主页面透出回调或提交事件。
6. 当前版本中，`X` 与 `取消` 点击事件直接调用 `window.Pedestal.remote.getCurrentWindow().close()`；`确定` 点击事件调用 `window.createDigitalTwin()`。
7. 状态职责拆分：
   - 页面 1 的状态变量在 `StepBasicInfo` 内部管理；
   - 页面 2 的状态变量在 `StepBrainSelect` 内部管理；
   - 跨页面共享的第一页草稿通过路由 `state` 在 `/createAssistant` 与 `/selectBrainAssistant` 两个路由页面之间传递与回填，不落本地存储。
8. 新增“激活助理页面”，用于展示激活引导轮播与“立即启用”操作按钮。
9. 新增“助理详情页面”，用于展示助理基础信息、简介、创建者与组织信息。
10. 新增“切换助理页面”，用于展示可滚动助理列表并支持切换入口。
11. 助理详情页面与切换助理页面统一迁移到 `src/pages` 目录下实现（不再放在 `src/components`）。
12. 助理详情页面与切换助理页面中涉及的图标与图片资源统一放在 `src/imgs` 并通过 `import` 引用。
13. 两个页面的重复结构（如标题区）需提取为公共组件或公共方法复用。
14. 激活助理页面迁移到 `src/pages` 目录，并删除轮播能力，仅展示第一张引导图。
15. `src/pages` 中页面组件采用单文件方式管理（如 `assistantDetail.tsx`、`switchAssistant.tsx`），不再使用页面目录下的 `index.tsx` 结构。
16. 助理详情页面与切换助理页面需支持组件化导出使用。
17. `example` 中新增 demo，演示导入并渲染 `AssistantDetail`、`SwitchAssistant` 的组件化导出。
18. `assistant-components-demo` 需可直接消费 `dist/lib/index.js` 的构建产物并稳定运行，不能在浏览器中出现 `Cannot set properties of undefined (setting 'AIChatViewer')` 报错。
19. `dist/lib/index.js` 的库导出需同时支持默认导出能力与 `AssistantDetail`、`SwitchAssistant`、`mountAIChatViewer`、`unmountAIChatViewer` 等命名导出读取。
20. 组件/页面源码文件内部只保留一种导出方式，不允许在同一文件中同时使用 `export default Xxx;` 与 `export { Xxx };` 双导出；对外需要的命名导出统一由库入口文件转出。
21. 新增“启动助理页面”，页面结构与“切换助理页面”一致，仅调整标题文案与底部按钮文案。

## 3. 页面流程

1. 进入页面 1（基础信息页）。
2. 当“名称 + 简介”均已填写时，“下一步”可点击；点击后通过路由跳转进入页面 2（`#/selectBrainAssistant`）。
3. 页面 2 选择“大脑类型”并完成子项选择（如需）后，“确定”可点击。
4. 任一页面点击右上角 `X` 或“取消”时，直接调用 `window.Pedestal.remote.getCurrentWindow().close()` 关闭当前窗口。
5. 页面 2 点击“上一步”时返回页面 1（`#/createAssistant`）。
6. 页面 2 点击“上一步”返回页面 1 后，第一页中的头像选择、名称、简介需按返回前状态完整保留（包含自定义头像预览）；用户在页面 2 点击浏览器返回时，也需返回到页面 1。
7. 页面 2 点击“确定”时调用 `window.createDigitalTwin()`，并按规则组装分身创建入参。

### 3.1 全局布局约束

1. 页面整体宽度为 `100%`。
2. 页面整体高度为 `100%`。
3. 独立页面根节点需以 `width: 100%; height: 100%;` 自适应占满页面容器。
4. 页面 1 与页面 2 统一使用页面主题背景渐变：标题区高度范围（前 `40px`）保持 `rgba(206,233,255,1)`，并在标题区后快速过渡为白色；到页面 1 的“头像选择区域”起始位置时应已为白色（`linear-gradient(180deg, rgba(206,233,255,1) 0px, rgba(206,233,255,1) 40px, rgba(255,255,255,1) 176px, rgba(255,255,255,1) 100%)`）。
5. 页面主题背景需附加阴影效果：`box-shadow: 0 16px 48px 0 rgba(0,0,0,0.16)`。
6. 全页面取消“禁止复制”限制：不通过事件拦截或样式限制阻断系统默认文本选择与复制能力。

### 3.2 页面入口渲染约束

1. 主工程路由入口与 `create-assistant-page` 独立打包入口都需通过 Hash Router 承载创建助理相关页面，由两个路由页容器直接渲染创建助理 UI，不再保留 `PersonalAssistantCreator` 统一步骤壳组件。
2. 页面根节点层级（`html`、`body`、`#root`）需设置宽高为 `100%`。
3. 组件渲染后需占满整个页面可视区域。
4. 页面入口不使用 `React.StrictMode` 包裹，避免开发环境下页面 2 的初始化 `useEffect` 重复触发。

## 4. 页面 1（基础信息页）需求

### 4.1 标题区

| 项 | 规格 |
|---|---|
| 区域尺寸 | 高 `40px`，宽 `100%` |
| 内边距 | `padding: 0 16px` |
| 背景色 | 透明背景（继承页面主题渐变），标题区显示主题色，并在标题区后快速过渡到白色（头像选择区域起始处已为白色） |
| 字体色 | `rgba(25,25,25,1)` |
| 左侧标题 | 文本“创建个人助理”，尺寸 `72px x 22px` |
| 右侧按钮 | `X` 关闭按钮，尺寸 `20px x 20px` |
| 标题换行规则 | 标题文本必须单行显示，不允许换行 |
| 按钮位置规则 | `X` 按钮必须位于标题区容器内部右侧，不允许溢出容器 |
| 宽度占用规则 | 标题区宽度需自适应占满一整行（`100%`），并保证内边距不导致溢出 |
| 高度稳定规则 | 标题区高度必须保持 `40px`，不得被压缩 |

### 4.2 内容区

| 项 | 规格 |
|---|---|
| 区域内边距 | `padding: 16px 24px 12px 24px` |
| 结构 | 从上到下 4 个容器 |

#### 容器 1：头像展示说明

1. 容器宽 `100%`，高 `108px`，内容水平居中。
2. 顶部为头像显示块：
   - 尺寸 `80px x 80px`
   - 圆角 `24px`
   - 边框 `2px solid rgba(255,255,255,1)`
   - 头像图片显示模式：`object-fit: fill`
3. 头像显示块下方间距 `8px` 展示说明文案：
   - 内容：`支持JPG/PNG格式，小于2MB`
   - 颜色：`rgba(153,153,153,1)`
   - 字号/字重/行高：`12px / 400 / 20px`
   - 水平居中
   - 外边距规则：除顶部 `8px` 外，其他外边距为 `0`

#### 容器 2：头像来源选择

1. 水平居中排列 5 个块，块间距 `12px`。
2. 前 4 个为默认头像：
   - 尺寸 `40px x 40px`
   - 圆角 `12px`
   - 背景 `rgba(239,246,255,1)`
   - 选中后边框色：`rgba(13,148,255,1)`
   - 右下角显示 `src/imgs/selection_icon.png` 勾选图片：`12px x 12px`，圆角 `16px`
3. 第 5 个为自定义上传入口（`+`）：
   - 尺寸 `40px x 40px`
   - 圆角 `12px`
   - 背景 `rgba(249,249,249,1)`
   - 边框 `0.63px dashed rgba(221,221,221,1)`
4. 自定义上传入口触发文件选择时，必须执行上传限制：
   - 仅支持 `JPG/PNG` 格式（含 `jpg/jpeg/png`）。
   - 文件大小必须小于 `2MB`。
5. 上传文件不满足限制时：
   - 保持当前头像选中状态不变；
   - 通过 toast 弹窗提示错误文案，不再使用页面内 `avatarError` 错误提示文本；
   - 文件大小超限（`>=2MB`）提示：`图片大小需小于2MB`；
   - 格式不合法提示：`仅支持JPG/PNG格式`。
6. 头像上传相关 toast 视觉样式：
   - PC 端使用页面内统一自定义 toast：
     - 弹窗高度：`46px`，宽度按内容自适应；
     - 圆角：`8px`；
     - 内边距：`padding: 12px 16px`；
     - 背景色：白色；
     - 定位：距离页面顶部或标题区顶部 `50px`，水平居中；
     - 左侧为警告图标（从 `src/imgs` 导入），尺寸 `14px x 14px`；
     - 图标与文案间距：`8px`；
     - 右侧错误文案样式：`14px / 400`，颜色 `rgba(25,25,25,1)`。
   - 移动端统一调用宿主已有 `HWH5.showToast()` 能力展示，不再渲染页面内自定义 toast；
   - `HWH5.showToast()` 入参仅传 `{ msg, type: 'w' }`，其中 `msg` 为提示文本。

#### 容器 3：名称输入

1. 标签文本：
   - 内容：`名称`
   - 样式：`14px / 500 / 22px`，颜色默认黑色系（未单独指定）
2. 下方间距 `8px` 为输入框：
   - 整体可见高度 `36px`（包含边框与上下内边距），宽 `100%`
   - 圆角半径：`8px`
   - 内边距：左右 `8px`、上下 `7px`
   - 盒模型：`box-sizing: border-box`
   - 边框：`1px solid rgba(0,0,0,0.08)`
   - placeholder：`例如：智能助手`
   - placeholder 样式：`14px / 400 / 22px`，`rgba(204,204,204,1)`
   - 输入文字样式：`14px / 400 / 22px`，`rgba(51,51,51,1)`

#### 容器 4：简介输入

1. 标签文本：
   - 内容：`简介`
   - 样式：`14px / 500 / 22px`，颜色默认黑色系（未单独指定）
   - 标题块高度固定 `22px`，`margin: 0`
2. 下方间距 `8px` 为简介输入框：
   - 简介块整体高度 `112px`（标题 `22px` + 间距 `8px` + 简介输入框 `82px`）
   - 整体可见高度 `82px`（包含边框与上下内边距），宽 `100%`
   - 圆角半径：`8px`
   - 内边距：`8px`
   - 盒模型：`box-sizing: border-box`
   - 边框：`1px solid rgba(0,0,0,0.08)`
   - placeholder：`介绍助理的功能和应用场景`
   - placeholder 样式：`14px / 400 / 22px`，`rgba(204,204,204,1)`
   - 输入文字样式：`14px / 400 / 22px`，`rgba(51,51,51,1)`

### 4.3 操作按钮区

| 项 | 规格 |
|---|---|
| 区域尺寸 | 高 `60px`，宽 `100%` |
| 区域内边距 | `padding: 16px 24px 12px 24px` |
| 容器边界规则 | 操作区必须完整位于组件容器内，不允许超出底部边界 |
| 对齐方式 | 按钮组右对齐，间距 `8px` |
| 按钮文本样式 | 字号 `12px`，行高 `20px` |
| 取消按钮 | 文本“取消”，`64px x 28px`，圆角 `4px`，背景 `rgba(0,0,0,0.05)` |
| 下一步按钮 | 文本“下一步”，`64px x 28px`，圆角 `4px` |

### 4.4 校验与交互

1. “名称”和“简介”为必填。
2. 任一必填为空时：
   - “下一步”不可点击；
   - 按钮背景色 `rgba(206,233,255,1)`。
3. 两项均填写后：
   - “下一步”可点击；
   - 按钮背景色 `rgba(13,148,255,1)`。
4. 自定义头像上传校验为强限制，不因“下一步”按钮状态放宽：
   - 格式不合法提示：`仅支持JPG/PNG格式`（toast 弹窗提示）；
   - 大小超限提示：`图片大小需小于2MB`（toast 弹窗提示）。
5. “名称”输入校验规则：
   - 仅允许：汉字 / 字母 / 数字；
   - 长度限制：`2-50` 个字符。
6. “简介”输入校验规则：
   - 仅允许：汉字 / 字母 / 数字 / 常用标点符号；
   - 常用标点包含中英文常见句读（如 `，。！？；：、,.!?;:()【】《》“”‘’` 等）；
   - 长度限制：`2-256` 个字符。
7. 当“名称”或“简介”任一项不满足字符集或长度规则时：
   - 对应输入框显示红色高亮边框提醒；
   - “下一步”不可点击（保持禁用态）。
8. 移动端输入框交互要求：
   - 点击“名称/简介”输入框时，需尽量避免 WebView 自动滚动导致页面整体上抬；
   - 不允许通过 `preventDefault` 拦截触摸默认行为，以免影响系统文本选择与复制能力；
   - 防上抬逻辑应采用“无阻断”方式实现（如无滚动聚焦与滚动位置恢复）。
9. `HWH5EXT` / `HWH5` 接口错误提示约束：
   - 所有通过 `HWH5EXT` 或 `HWH5` 发起的能力调用，只要业务代码进入 `catch` 分支，必须通过 toast 弹窗向用户展示错误；
   - toast 统一直接调用 `showToast(message)` 展示，不再直接调用传入 `error` 对象的 toast 包装方法；
   - toast 文案统一使用业务代码中已定义的固定错误文案，不再从 `error` 对象中解析宿主返回信息；
   - PC 端 toast 定位规则：当前页面存在标题区时，toast 距离该标题区顶部 `50px`；当前页面无标题区时，toast 距离页面顶部 `50px`；始终水平居中；
   - 移动端 toast 统一通过 `HWH5.showToast({ msg, type: 'w' })` 调用宿主原生提示能力，业务侧不再自行控制页面内定位样式。
10. 创建个人助理二维码场景：
   - 当路由 query 中 `from=qrcode` 且存在 `qrcode` 时，视为扫二维码打开创建个人助理第一页；
   - 页面打开后需根据 `小程序JSAPI接口文档.md` 调用 `queryQrcodeInfo({ qrcode })` 查询二维码信息；
   - 二维码是否失效必须通过 `expireTime` 与当前时间戳比较判断，不以 `expired` 字段直接替代判断；
   - 仅当“当前时间戳 > expireTime”时才判定为已过期；
   - 若二维码未失效，则继续展示第一页现有创建表单；
   - 若二维码已失效，则第一页内容区切换为失效态：
      - 内容区背景颜色 `rgba(196,196,196,1)`；
      - 内容垂直居中显示一张从 `src/imgs` 导入的二维码失效提示 `png` 图片；
      - 失效态下不再展示表单内容与底部操作按钮；
   - `queryQrcodeInfo({ qrcode })` 查询成功后，无论二维码是否过期，都需调用 `updateQrcodeInfo({ qrcode, status: 1 })`，将二维码状态更新为已扫码；
   - 扫码场景下，第一页底部主按钮文案改为“确定”；
   - 扫码场景下，第一页点击“确定”后直接触发创建助理接口，不再跳转到 `/selectBrainAssistant` 页面；
   - 扫码场景第一页直创时，`createDigitalTwin` 入参需透传第一页表单已有字段 `name`、`icon`、`description`，并追加传入当前二维码值 `qrcode`；不再额外传 `weCrewType` 与 `bizRobotId`；
   - 当创建助理接口调用成功后，需先调用 `updateQrcodeInfo({ qrcode, robotId, status: 2 })`，其中 `robotId` 取创建助理接口返回值；回写完成后继续复用第二页中 `handleCreateForOtherScene` 共享方法承载的成功跳转逻辑：
      - 移动端优先调用 `window.HWH5.openIMChat({ chatId: partnerAccount })`，若宿主无该能力则调用 `window.HWH5.close()`；
      - PC 端调用 `window.Pedestal.callMethod('method://agentSkills/handleSdk', { owner: partnerAccount })`；
      - 不再跳转到 `/selectBrainAssistant` 页面。
   - 扫码场景下，用户主动退出创建流程时：
      - 移动端第一页点击左上角返回；
      - PC 端点击右上角关闭按钮；
      - PC 端点击会直接关闭页面的“取消”按钮；
      - 以上场景都需先调用 `updateQrcodeInfo({ qrcode, status: 3 })` 更新为取消，再继续原有关闭/返回动作；
   - 扫码进入第一页后，移动端需额外调用 `HWH5.addEventListener({ type: 'back', func })` 注册宿主返回监听；
      - `func` 中需调用 `updateQrcodeInfo({ qrcode, status: 3 })`；
      - `func` 必须同步 `return true`；
      - 宿主 `back` 监听中的二维码状态回写同样复用页面内既有的错误提示逻辑，不额外解析错误对象；
   - 扫码场景的二维码状态流转全部收口在第一页 `/createAssistant`，第二页 `/selectBrainAssistant` 不再承接二维码状态回写与退出处理；
   - 创建助理页面涉及关闭当前窗口的逻辑统一复用共享 `closeCreateAssistantWindow` 方法，不在不同页面各自重复实现宿主关闭代码；
   - 创建助理成功结果中的 `partnerAccount` 解析统一复用共享 `resolvePartnerAccount` 方法，不在第一页、第二页各自重复实现字符串读取与裁剪逻辑；
   - 二维码状态回写 helper 不对 `qrcode`、`robotId`、`status` 做本地入参校验，调用时直接按当前业务参数透传 `updateQrcodeInfo`；
   - `updateQrcodeInfo(status: 1/2/3)` 进入 `catch` 分支时，需 toast 提示固定错误文案，但不阻断当前页面既有关闭、返回或创建成功后的后续流程。

## 5. 页面 2（大脑选择页）需求

### 5.1 标题区

| 项 | 规格 |
|---|---|
| 区域尺寸 | 高 `40px`，宽 `100%` |
| 内边距 | `padding: 0 16px` |
| 背景色 | 透明背景（继承页面主题渐变），标题区显示主题色，并在标题区后快速过渡到白色 |
| 字体色 | `rgba(25,25,25,1)` |
| 左侧标题 | 文本“创建个人助理”，尺寸 `72px x 22px` |
| 结构说明 | 样式与页面 1 标题区一致，左侧为标题文本，右侧为 `X` 关闭按钮 |
| 右侧按钮 | `X` 关闭按钮，尺寸 `20px x 20px` |
| 高度稳定规则 | 标题区高度必须保持 `40px`，不得被压缩 |

### 5.2 插画区

1. 第二页删除独立插画区（原标题区下方 `160px` 插画区域不再展示）。

### 5.3 内容区

| 项 | 规格 |
|---|---|
| 区域内边距 | 左右 `24px` |
| 结构 | 从上到下 3 个容器 |

#### 容器 1：大脑类型单选

1. 顶部间距 `6px` 展示标题：
   - 内容：`请选择你的个人助理大脑：`
   - 样式：`16px / 700 / 24px`，颜色 `rgba(51,51,51,1)`
   - 标题元素默认外边距为 `0`，确保标题文本顶部距离父容器顶部为 `6px`
2. 下方间距 `8px` 展示单选项（左对齐）：
   - 选项 1：`内部助手`
   - 选项 2：`自定义助手`
   - 选项间距：`36px`
   - 单选圆点容器尺寸：`20px x 20px`，距离左侧 `0px`
   - 圆点尺寸：`16.67px x 16.67px`，在容器内垂直居中
   - 按钮文本距离圆点容器 `8px`
   - 未选中态：边框 `1.2px solid rgba(204,204,204,1)`，圆底色 `rgba(255,255,255,1)`
   - 选中态：圆外环颜色 `rgba(13,148,255,1)`，圆心为白色 `6.67px x 6.67px`
   - 文本样式：`14px / 400 / 22px`，颜色 `rgba(51,51,51,1)`

#### 容器 2：按单选结果显示动态内容

当选择“内部助手”时：
1. 显示标题：
   - 内容：`请选择`
   - 样式：`14px / 400 / 22px`，颜色 `rgba(153,153,153,1)`
   - 标题文本距离第二个容器父容器顶部 `12px`
2. 下方间距 `8px` 展示 3 行 2 列选项按钮组：
   - 数据来源：调用 `window.getAgentType()` 获取内部助手列表
   - 默认值规则：页面初始化时 `internalAssistants` 先使用内置常量 `INTERNAL_ASSISTANTS = [{ name: '助手', icon: '', bizRobotId: '1234' }]`
   - 默认选中规则：当内部助手列表存在有效数据时，进入第二步后默认选中列表第一项；若用户从“自定义助手”切回“内部助手”且当前无选中项，也需自动回落为第一项
   - 数据写入规则：`window.getAgentType()` 返回值直接通过 `setInternalAssistants` 设置，不做额外归一化/结构兼容转换
   - 文案规则：不显示“内部助手加载中...”与“暂无可用内部助手”提示文案
   - 按钮文本：使用出参 `name`
   - 按钮图标：使用出参 `icon`
   - 业务标识：保留出参 `bizRobotId` 供确认时透传
   - 列间距 `12px`，行间距 `8px`
   - 单按钮样式：
      - 高 `36px`，宽自适应，`padding: 0 8px`
      - 圆角半径 `8px`
      - 左侧图标 `20px x 20px`
      - 图标与文本间距 `4px`
   - 未选中态：`1px solid rgba(0,0,0,0.08)`
    - 选中态：
      - 背景 `rgba(236,246,255,1)`
      - 边框 `1px solid rgba(13,148,255,1)`
      - 按钮文本颜色 `rgba(13,148,255,1)`
      - 右侧显示圆形 `√`：`12px x 12px`，圆角 `16px`，颜色 `rgba(13,148,255,1)`
      - 圆形 `√` 位于按钮内部，距离按钮右边 `8px`

当选择“自定义助手”时：
1. 显示说明文本：
   - 内容：`需在本地电脑自定义部署第三方助手，点击查看指导文档→`
   - 其中“指导文档→”为超链接，点击后打开 web 页面（当前链接地址先留空）
   - “指导文档→”文本颜色：`rgb(9,146,255)`
   - 样式：`14px / 400 / 22px`，颜色 `rgba(153,153,153,1)`

#### 容器 3：插画展示

1. 作为内容区第三个容器显示一张插画。
2. 尺寸：高度 `114px`，宽度自适应占满一行（`100%`）。
3. 圆角半径：`12px`。
4. 插画资源由 `StepBrainSelect` 组件内部直接从 `src/imgs` 导入使用，不再通过父组件 props 透传，也不再使用内联 SVG / data URI。
5. 插画按当前国际化语言切换：
   - 中文使用 `src/imgs/banner.png`
   - 英文使用 `src/imgs/banner-en.png`
6. 个人助理插画需要支持点击打开指导文档；插画本身直接使用单个 `img` 标签承载点击事件，不再额外包裹 `a` 或 `div` 容器。

### 5.4 操作按钮区

| 项 | 规格 |
|---|---|
| 区域尺寸 | 高 `60px`，宽 `100%` |
| 区域内边距 | `padding: 16px 24px 12px 24px` |
| 容器边界规则 | 操作区必须完整位于组件容器内，不允许超出底部边界 |
| 对齐方式 | 按钮组右对齐，间距 `8px` |
| 按钮文本样式 | 字号 `12px`，行高 `20px` |
| 取消按钮 | 文本“取消”，`64px x 28px`，圆角 `4px`，背景 `rgba(0,0,0,0.05)` |
| 上一步按钮 | 文本“上一步”，`64px x 28px`，圆角 `4px`，背景 `rgba(0,0,0,0.05)`，位于“取消”和“确定”之间 |
| 确定按钮 | 文本“确定”，`64px x 28px`，圆角 `4px` |

### 5.5 校验与交互

1. 未完成选择时，“确定”不可点击，背景 `rgba(206,233,255,1)`。
2. 完成选择后，“确定”可点击，背景 `rgba(13,148,255,1)`。
3. 选择规则：
   - 选择“自定义助手”后即可点击“确定”；
   - 若选择“内部助手”，当列表存在数据时默认选中第一项并可直接点击“确定”；仅当内部助手列表为空时才保持不可点击。
4. 点击“上一步”后返回页面 1，并保留页面 1 的头像选择、名称和简介。

## 6. 页面输入/输出（内部闭环）

### 6.1 输入数据（页面内部状态）

1. 页面 1（`StepBasicInfo`）内部状态：
   - `avatarSelection`：默认头像索引或自定义头像文件。
   - `name`：助理名称（必填）。
   - `description`：助理简介（必填）。
2. 页面 2（`StepBrainSelect`）内部状态：
   - `brainType`：`internal` 或 `custom`。
   - `agentTypeList`：由 `window.getAgentType()` 返回的内部助手列表（`name/icon/bizRobotId`）。
   - `selectedBizRobotId`：当 `brainType=internal` 时必填。
3. 跨页面共享状态：
   - 第一步草稿通过路由 `state` 在两个路由页之间传递与回填。

### 6.2 输出行为（页面内部）

1. 不对外提供回调或事件。
2. 点击 `X` / “取消”时：
   - 直接调用 `window.Pedestal.remote.getCurrentWindow().close()` 关闭当前窗口。
3. 页面 2 初始化时调用 `window.getAgentType()` 获取内部助手列表；渲染规则：
   - 按钮文本显示 `name`；
   - 按钮图标显示 `icon`；
   - 选中项记录 `bizRobotId` 供确认提交。
   - 列表有数据时默认选中第一项，并将其 `bizRobotId` 作为当前选中项。
   - 列表为空或接口失败时不展示“内部助手加载中...”与“暂无可用内部助手”文案。
4. 点击“确定”时直接调用 `window.createDigitalTwin(params)`，入参规则如下：
   - `name`（string）：分身名称，取页面 1 “名称”输入框值。
   - `icon`（string）：分身头像地址，取页面 1 当前选中头像地址。
   - `description`（string）：分身简介，取页面 1 “简介”输入框值。
   - `weCrewType`（number）：分身类型，`internal` 传 `1`，`custom` 传 `0`。
   - `bizRobotId`（string，可选）：仅当 `weCrewType=1` 且已选择内部助手时传入，值取所选内部助手的 `bizRobotId`。

## 7. 资源与依赖

1. 默认头像资源：4 个（需提供具体图源）。
2. 插画背景资源：1 张（页面 2，需提供具体图源）。
3. 内部助手选项资源：通过 `window.getAgentType()` 动态获取（每项包含 `name/icon/bizRobotId`）。
4. 激活助理轮播图资源：`src/imgs/activate-guide-1.svg`、`src/imgs/activate-guide-2.svg`。
5. 助理通用背景图资源：移动端 `src/imgs/assistant-cui-bg.png`，PC 端 `src/imgs/assistant-cui-pc-bg.png`。
6. 助理详情/切换助理页面图标资源：`src/imgs/icon-back.svg`、`src/imgs/icon-service.svg`。
7. 助理详情/切换助理页面 PC 标题区关闭图标资源：`src/imgs/icon-close.svg`。
8. 助理详情/切换助理页面头像资源：`src/imgs/assistant-avatar.svg`、`src/imgs/switch-assistant-avatar.svg`。

## 8. 验收标准（功能）

1. 个人助理功能可作为独立页面产物打包导出，并可直接访问页面入口运行。
2. `src/lib/index.ts` 不导出创建助理流程组件；创建助理仅以页面路由与独立打包页形式提供。
3. 页面 1 与页面 2 的区域结构、布局关系、文案、尺寸和颜色符合需求。
4. 页面 1 的“下一步”严格受“名称/简介必填”控制。
5. 页面 2 的“确定”严格受选择状态控制。
6. 头像默认选择与选中态、内部助手按钮组选中态视觉正确。
7. `X` 与取消点击会触发 `window.Pedestal.remote.getCurrentWindow().close()` 且不报错；页面 2 初始化会触发 `window.getAgentType()`；确定点击会触发 `window.createDigitalTwin()` 且入参符合本文件定义。
8. 下一步行为正常可用，且符合本文件定义（无需对外事件）。
9. 页面内部主容器以 `100%` 宽高自适应填充整个页面。
10. 两个创建助理路由页都通过统一页面容器承载 `digital-twin-` 样式，不依赖旧的步骤壳组件间接挂载。
11. 两个页面的底部操作区均完整显示在容器内，不出现底部溢出。
12. 清理冗余样式属性后，页面视觉表现与交互行为保持不变。
13. 在不改变视觉与交互验收结果的前提下，可提取页面 1 与页面 2 的重复代码为公共实现（如标题区、footer 操作区、主按钮状态 class 组装），以降低维护成本。

## 9. 待确认项

无。

## 10. 移动端适配要求（isPcMiniApp）

1. 保持当前 PC 端样式与交互不变。
2. 通过 `isPcMiniApp` 区分端类型：
   - `isPcMiniApp === true`：使用现有 PC 样式与交互；
   - `isPcMiniApp === false`：启用本章节定义的移动端样式调整。
3. 移动端样式为在 PC 样式基础上的局部覆盖，不改变既有业务流程与校验逻辑。

### 10.1 移动端页面 1（基础信息）

1. 标题区：
   - 高度 `44px`。
   - 左侧控件 `92px x 44px`，内含返回图标按钮 `24px x 24px`，距离左侧 `10px`，垂直居中。
   - 返回按钮点击直接调用 `window.HWH5.navigateBack()`。
   - 中间标题：`创建个人助理`，水平垂直居中，`16px / 500 / 24px`。
   - 右侧控件 `92px x 44px`，为空占位。
2. 内容区：
   - 头像显示块 `48px x 48px`，圆角 `60px`。
   - 默认头像和自定义头像 5 个按钮：`40px x 40px`，圆角 `100px`。
3. 操作区：
   - 高度 `68px`，宽度 `100%`，`padding: 12px 16px`。
   - 仅保留一个“下一步”按钮：高度 `44px`，宽度占满，圆角 `999px`。
4. 点击“名称/简介”输入框时，不允许页面整体上抬，页面视觉位置保持稳定。

### 10.2 移动端页面 2（大脑选择）

1. 标题区：
   - 高度 `44px`。
   - 左侧控件 `92px x 44px`，内含返回图标按钮 `24px x 24px`，距离左侧 `10px`，垂直居中。
   - 返回按钮点击后返回创建助理第一页。
   - 中间标题：`创建个人助理`，水平垂直居中，`16px / 500 / 24px`。
   - 右侧控件 `92px x 44px`，为空占位。
2. 内容区：
   - 第一个容器中的单选组合容器高度 `48px`，宽度占满。
   - 两个按钮间距 `16px`，每个按钮高度 `48px`，宽度自适应占满，边框 `1px solid rgba(0,0,0,0.05)`，圆角 `8px`。
   - 单选圆圈按钮尺寸 `24px x 24px`；外圆环 `20px x 20px`；内圆实心 `13.33px x 13.33px`，颜色 `rgba(13,148,255,1)`。
   - 内部助手选择按钮组合改为 1 列展示，每个按钮宽度占满一行，高度 `48px`。
   - 内部助手选择按钮选中态右侧 `√` 图标在移动端尺寸为 `24px x 24px`。
3. 操作区：
   - 高度 `68px`，宽度 `100%`，`padding: 12px 16px`。
   - 仅保留一个“确定”按钮：高度 `44px`，宽度占满，圆角 `999px`。

## 11. 路由页面划分（React Router）

1. 主工程入口（`src/index.tsx`）需通过 `react-router-dom` 管理页面路由。
2. 路由模式使用 `react-router-dom` 提供的 `HashRouter`。
3. 当前保留七个页面路由：
   - `WeAgentCUI 对话页面`：哈希路径 `#/weAgentCUI`
   - `创建个人助理第一页`：哈希路径 `#/createAssistant`
   - `创建个人助理第二页`：哈希路径 `#/selectBrainAssistant`
   - `激活助理页面`：哈希路径 `#/activateAssistant`
   - `助理详情页面`：哈希路径 `#/assistantDetail`
   - `切换助理页面`：哈希路径 `#/switchAssistant`
   - `启动助理页面`：哈希路径 `#/selectAssistant`
4. 根路径 `#/` 默认重定向到 `#/weAgentCUI`。
5. 未匹配路径统一重定向到 `#/weAgentCUI`。
6. PC 与移动端样式规则不变，路由仅负责页面切换。
7. `create-assistant-page` 独立打包入口继续保留，不受主路由改造影响。

## 12. 构建环境兼容

1. 当前本地构建环境需兼容 `Node.js 18.x`。
2. 为兼容 `Node.js 18.x`，`copy-webpack-plugin` 版本需使用兼容分支（`13.x`），避免 `14.x` 在 `Node 18` 下因 `toSorted` 不可用导致构建失败。

## 13. 激活助理页面

1. 内容区：
   - 内容区容器宽度为自适应 `100%`；
   - 内容区容器高度为内容自适应；
   - 页面整体背景改为助理背景图：
      - 移动端使用 `src/imgs/assistant-cui-bg.png`；
      - PC 端使用 `src/imgs/assistant-cui-pc-bg.png`；
   - 背景图按当前页面尺寸拉伸显示（`background-size: 100% 100%`），不再使用 `cover`；
   - 图片展示容器与“选择助理”按钮作为整体在页面中水平垂直居中；
   - 移动端（`isPcMiniApp === false`）图片容器尺寸为 `322px x 350px`；
   - PC 端（`isPcMiniApp === true`）图片容器尺寸为 `500px x 347px`；
   - 图片自适应容器大小展示；
   - 激活引导图按端与语言共同区分：
      - `isPcMiniApp === true`（PC）且当前语言为中文时，使用 `src/imgs/activate-guide-pc.png`；
      - `isPcMiniApp === true`（PC）且当前语言为英文时，使用 `src/imgs/activate-guide-pc-en.png`；
      - `isPcMiniApp === false`（移动）且当前语言为中文时，使用 `src/imgs/activate-guide.png`；
      - `isPcMiniApp === false`（移动）且当前语言为英文时，使用 `src/imgs/activate-guide-en.png`；
   - 不展示轮播按钮区域。
2. 操作区：
   - 移动端按钮距离图片 `63px`；
   - PC 端按钮距离图片 `80px`；
   - 水平居中显示“选择助理”按钮；
   - 移动端按钮尺寸 `250px x 38px`，圆角半径 `99px`；
   - PC 端按钮尺寸 `140px x 32px`，圆角半径 `4px`；
   - 背景线性渐变（从左到右）：`linear-gradient(90deg, #1f78ff 0%, #42b0ff 100%)`。

## 14. 助理详情页面

1. 标题区：
   - 通过 `isPcMiniApp` 区分标题区样式：
      - `isPcMiniApp === true`（PC）：
         - 标题区高度 `54px`，`padding: 11px 16px`，背景白色；
         - 左侧为关闭按钮区域：`32px x 32px`，内含 `X` 关闭图标 `20px x 20px`（从 `src/imgs` 导入）；
         - 中间标题：`助理详情`，水平垂直居中，字体 `16px/400/22px`；
         - 右侧为客服按钮区域：`32px x 32px`，内含客服图标 `20px x 20px`。
      - `isPcMiniApp === false`（移动）：
         - 高度 `44px`，背景白色；
         - 左侧控件尺寸 `90px x 44px`，包含返回按钮（`24px x 24px`，左间距 `12px`）和客服按钮（`24px x 24px`，与返回按钮间距 `16px`）；
         - 中间标题：`助理详情`，水平垂直居中，字体 `16px/400/22px`；
         - 右侧控件尺寸 `90px x 44px`，新增编辑按钮，图标资源为 `src/imgs/edit_icon.png`，尺寸 `24px x 24px`，距离页面右侧 `12px`。
2. 页面背景：
   - 标题区以外的页面区域背景统一使用助理背景图；
   - 背景图按页面区域自定义尺寸拉伸显示（`background-size: 100% 100%`），不使用 `cover`。
3. 内容区：
   - `padding-top: 12px; padding-left: 16px; padding-right: 16px;`
   - 包含 3 个容器：
      - 容器 1：高度自适应，宽度占满，圆角 `8px`，背景白色，`padding: 12px`。
      - 容器 1 内头像块：`72px x 72px`，水平居中，顶部 `0px`，圆角 `19px`。
      - 容器 1 内名称块：距离头像 `12px`，宽度占满，水平居中，文本 `小咪`，字体 `16px/700/24px`，颜色 `rgba(51,51,51,1)`。
      - 名称右侧 tag：距离名称 `8px`，`48px x 16px`，圆角 `8px`，背景 `rgba(235,240,255,1)`，文本 `员工助手`，字体 `10px/400/12px`，颜色 `rgba(59,112,255,1)`。
      - `bizRobotId` 有值时显示 tag；`bizRobotId` 为空时隐藏 tag。
      - 对齐规则：仅“名称文本”在容器内水平居中，tag 不参与名称的居中计算（避免“名称+tag”整体居中导致名称偏移）。
      - 容器 2：距离上个容器 `12px`，宽度占满，高度自适应，圆角 `8px`，背景白色，`padding: 12px 12px 0 12px`。
      - 容器 2 内助理简介标题：左对齐，文本 `助理简介`，字体 `14px/500/22px`，颜色 `rgba(51,51,51,1)`。
       - 容器 2 内助理简介内容：距离标题 `8px`，宽度占满，高度自适应，文本 `你的全能AI生活助理`，字体 `14px/400/22px`，颜色 `rgba(102,102,102,1)`。
       - 容器 2 内创建者块：距离简介块 `12px`，高度 `48px`，宽度占满，左文案 `创建者`（`14px/500/22px`，`rgba(51,51,51,1)`），右文案按当前语言展示：
         - 中文：`creatorName + ' ' + createdBy`
         - 英文：`creatorNameEn + ' ' + createdBy`
         - 样式统一为 `14px/400/22px`，`rgba(102,102,102,1)`。
       - 助理简介块与创建者块之间增加描边：`1px solid rgba(0,0,0,0.05)`。
       - 容器 3：距离上个容器 `12px`，宽度占满，高度自适应，圆角 `8px`，背景白色，`padding-left: 12px; padding-right: 12px;`。
      - 容器 3 内 item 样式与创建者块一致，按 `bizRobotId` 分支展示：
         - `bizRobotId` 有值（内部助理）：
            - 仅展示 1 个 item：左侧 `能力提供方`，右侧展示 `displayTag`；
            - 不再展示 `部门` 与 `责任人`。
         - `bizRobotId` 为空（外部助理）：
            - item 1：左侧 `APPID`，右侧展示 `appKey`；
            - item 2：左侧 `密钥`，右侧展示 `appSecret` 的掩码文本（`*`）；
            - 右侧密钥支持按压查看：按下显示明文，松手恢复 `*` 掩码。
      - 容器 3 中 `能力提供方`、`APPID`、`密钥` 对应右侧值显示块保持不溢出容器边界。
      - 内部助理场景下，容器 3 不再渲染第二行组织信息，也不再展示“部门/责任人”之间的描边分割。
4. 数据渲染约束：
   - 页面展示数据全部来自 `getWeAgentDetails` 接口返回；
   - 不再使用本地默认值/兜底文案/兜底图片（包含名称、标签、简介、创建者、能力提供方、头像）。
   - 助理类型判断规则：`bizRobotId` 有值视为内部助理，`bizRobotId` 为空视为外部助理。
5. 客服按钮跳转规则：
   - PC 端保持现有打开方式不变；
   - 移动端点击客服时：
      - 若当前 `weCodeUrl` 解析出的 host 等于 `APP_ID`，则直接调用 `openWebview({ uri: CUSTOMER_SERVICE_WEBVIEW_URI })`；
      - 若当前 `weCodeUrl` 解析出的 host 不等于 `APP_ID`，则继续使用现有 `buildCustomerServiceWebviewUri(weCodeUrl)` 逻辑；
      - 若 `weCodeUrl` 为空，则保持当前不可跳转提示。
6. 移动端编辑操作：
   - 点击导航栏右侧编辑按钮后，弹出底部操作弹窗（独立组件）；
   - 底部操作弹窗通过 `createPortal` 渲染到 `document.body`，避免受助理详情页面滚动区、背景图和层级影响；
   - 弹窗容器固定在页面底部，宽度占满，高度按内容自适应，顶部圆角 `12px 12px 0 0`，背景白色，外层蒙层颜色 `rgba(0,0,0,0.4)`；
   - 弹窗内从上到下展示 3 个操作块，每个高度 `48px`，文本水平垂直居中，字号 `16px`，字重 `400`：
      - 操作 1：`修改助理信息`，颜色 `rgba(51,51,51,1)`；
      - 操作 2：`删除助理`，颜色 `rgba(243,111,100,1)`；
      - 操作 3：`取消`，颜色 `rgba(51,51,51,1)`；
   - 操作 1 和操作 2 之间增加一条水平分割线：宽 `336px`、高 `0.5px`、水平居中、颜色 `rgba(238,238,238,1)`；
   - 操作 2 与操作 3 之间增加 `8px` 间隔区，间隔区背景 `rgba(249,249,249,1)`；
   - 点击“取消”块或蒙层时关闭底部操作弹窗；
   - 点击“删除助理”后，关闭底部操作弹窗并弹出删除确认弹窗；
   - 点击“修改助理信息”当前先保留空实现。
7. 移动端删除确认弹窗：
   - 删除确认弹窗使用独立容器组件，蒙层颜色 `rgba(0,0,0,0.4)`；
   - 删除确认弹窗同样通过 `createPortal` 渲染到 `document.body`，不挂载在助理详情页内容区内部；
   - 弹窗宽度固定 `280px`，在页面中水平垂直居中，高度自适应，圆角半径 `8px`，背景白色；
   - 标题距离顶部 `24px`，水平居中，文案为：`确认删除个人助理"{name}"吗？`，其中 `{name}` 取当前助理详情中的助理名称；样式 `16px/400/24px`，颜色 `rgba(51,51,51,1)`，文本允许换行显示；
   - 内容区距离标题 `12px`，`padding: 0 16px`，文案为：`删除后，该助理将从消息列表、群组及 WeAgent 菜单中同步移除，且不可恢复，请谨慎操作！`，样式 `14px/400`，颜色 `rgba(51,51,51,1)`，文本水平居中；
   - 底部操作区距离内容区 `8px`，`padding: 14px 16px 15px`；
   - 底部操作区包含两个文本按钮：
      - 左侧“取消”，样式 `16px/400`，颜色 `rgba(51,51,51,1)`；
      - 右侧“删除”，样式 `16px/400`，颜色 `rgba(243,111,100,1)`；
   - 两个按钮之间增加一条分割线：宽 `1px`、高 `16px`、颜色 `rgba(238,238,238,1)`，与左右按钮各间隔 `4px`；
   - 点击“取消”或蒙层关闭删除确认弹窗；
   - 点击确认删除按钮时，根据 `小程序JSAPI接口文档.md` 调用 `deleteWeAgent`；
   - `deleteWeAgent` 入参按当前详情数据透传：优先传 `partnerAccount`，若当前详情存在 `id`，则同时传 `robotId=id`；
   - `deleteWeAgent` 调用成功后，直接调用 `window.HWH5.close();` 关闭当前页面；
   - `deleteWeAgent` 调用失败时，按全局错误提示规范通过 toast 展示固定错误文案，不关闭页面。
8. 编辑助理页面头像回填规则：
   - 打开编辑助理页面时，先使用助理详情中的原始 `detail.icon` 与 `DEFAULT_AVATARS` 中的 `avatar.image` 直接做严格相等比较，不对比较值做 `resolveAssistantIconUrl` 规范化；
   - 若原始 `detail.icon` 命中 4 个默认头像之一，则默认选中该默认头像；
   - 若未命中，则选中自定义头像入口；
   - 无论是否命中默认头像，回填到表单中用于显示的头像地址统一使用 `resolveAssistantIconUrl(detail.icon)` 规范化结果。

## 15. 切换助理页面

1. 标题区：
   - 与“助理详情页面”标题区样式一致（含 `isPcMiniApp` 的 PC/移动端分支逻辑）；
   - PC 样式下使用左侧 `X` 关闭按钮（`32px` 容器、`20px` 图标）和右侧客服按钮（`32px` 容器、`20px` 图标）；
   - 中间标题建议为 `切换助理`，水平垂直居中，字体 `16px/400/22px`。
2. 页面背景：
   - 标题区以外的页面区域背景统一使用助理背景图；
   - 背景图按页面区域自定义尺寸拉伸显示（`background-size: 100% 100%`），不使用 `cover`。
3. 内容区：
   - `padding: 12px 16px`（上下 `12px`、左右 `16px`）；
   - 内部为助理列表容器，超出区域可纵向滚动；
   - 列表滚动条隐藏，但保留滚动能力；
   - 助理块间距 `12px`；
   - 单个助理块样式：
      - 宽度占满，固定高度 `72px`，圆角 `8px`；
      - `padding: 16px 12px`（需使用 `box-sizing: border-box` 保证总高为 `72px`）；
      - 左侧头像图标尺寸固定 `40px x 40px`；
      - 图标右侧间距 `16px` 为助理说明块。
   - 点击助理块后，当前选中块仅显示 `1px solid rgba(13,148,255,1)` 边框，不显示额外高亮效果（如背景高亮、系统点击高亮或焦点发光）。
   - 列表数据完全来自 `getWeAgentList` 接口返回，不使用本地 mock 列表或默认业务数据。
4. 助理说明块：
   - 第一行：
      - 左侧文本：`编程助理`，样式 `16px/500/24px`，颜色 `rgba(51,51,51,1)`；
      - 右侧 tag：宽度自适应内容，`padding: 2px 4px`，圆角 `4px`，背景 `rgba(217,232,255,1)`；
      - tag 文本：`某某助手`，样式 `10px/400/14px`，颜色 `rgba(65,142,255,1)`。
   - 第二行：
      - 文本：`设计师一枚`，样式 `14px/400/22px`，颜色 `rgba(102,102,102,1)`；
      - 超出部分以省略号 `...` 显示（单行截断）。
5. 底部操作区：
   - 宽度占满，固定高度 `68px`；
   - 内边距：`padding: 12px 16px`（上下 `12px`、左右 `16px`）；
   - 内部包含两个按钮，左侧“取消选择”靠左对齐，右侧“确认切换”靠右对齐：
      - “取消选择”按钮：`156px x 44px`，圆角半径 `50px`，背景 `rgba(255,255,255,1)`；
      - “确认切换”按钮：`156px x 44px`，圆角半径 `50px`，背景 `rgba(13,148,255,1)`。
   - 两个按钮点击事件当前均为空实现（占位）。
6. 客服按钮跳转规则：
   - PC 端保持现有打开方式不变；
   - 移动端点击客服时，直接调用 `openWebview({ uri: CUSTOMER_SERVICE_WEBVIEW_URI })`，不再拼接 `sourceURL`。

## 16. 启动助理页面

1. 页面组件文件路径：`src/pages/selectAssistant.tsx`。
2. 通过 `isPcMiniApp` 区分端样式：
   - `isPcMiniApp === false`（移动）：保持当前页面样式与交互不变。
   - `isPcMiniApp === true`（PC）：使用本章节新增 PC 样式。
3. 页面背景：
   - 页面背景统一使用助理背景图；
   - 背景图按当前页面尺寸拉伸显示（`background-size: 100% 100%`），不使用 `cover`。
4. PC 端整体布局：
   - `标题区 + 内容区 + 底部操作区` 整体宽度固定 `500px`；
   - 整体在页面内水平、垂直居中。
5. PC 标题区：
   - 仅显示标题文本：`启用助理`；
   - 文本水平居中；
   - 文本样式：`font-size: 24px; font-weight: 700; line-height: 24px`；
   - 标题区高度自适应内容高度。
6. PC 内容区：
   - `padding: 36px 24px`（上下 `36px`，左右 `24px`）。
7. PC 底部操作区：
   - 高度自适应内容高度；
   - 内部两个按钮水平居中，间距 `12px`；
   - 左按钮“创建助理”：`80px x 32px`，圆角 `4px`，背景 `rgba(0,0,0,0.05)`；
   - 右按钮“立即启用”：`80px x 32px`，圆角 `4px`，背景 `rgba(13,148,255,1)`。
8. PC 底部两个按钮点击事件当前均为空实现（占位）。
9. 列表数据渲染约束：
   - 页面助理列表、名称、标签、简介、头像均直接使用 `getWeAgentList` 接口返回值；
   - 不使用本地默认值/mock 业务数据进行补齐。

## 17. WeAgentCUI 对话页面

1. `WeAgentCUI` 为当前唯一对话页面，页面功能按本章节定义实现。
2. 整体布局：
   - 页面根容器内边距：左右 `12px`、上下 `8px`（`padding: 8px 12px`）。
   - 页面分为 3 个区域：对话内容区、多功能按钮区、底部输入区。
   - 3 个区域垂直间距统一为 `12px`。
   - 页面根容器背景统一使用助理背景图；
   - 背景图按当前页面尺寸拉伸显示（`background-size: 100% 100%`），不使用 `cover`。
3. 对话内容区：
   - 宽度、高度自适应占满可用空间。
   - `padding-top: 7px; padding-bottom: 7px`。
   - 消息块间距 `24px`。
4. 用户消息块：
   - 靠右显示。
   - 第一行为“对话人名+发送时间 + 头像”，二者间距 `4px`，整行靠右。
   - 文本样式：`12px / 400 / 20px`，颜色 `rgba(57,57,57,1)`，示例：`测试 2026-04-13 08:07`。
   - 头像尺寸：`24px x 24px`，圆角 `12px`。
   - 用户名数据来源：`window.HWH5.getUserInfo()` 返回的用户信息；当前语言为中文时取 `userNameZH`，当前语言为英文时取 `userNameEN`。
   - 发送后用户消息时间来源：`sendMessage` 返回结果中的 `createdAt`。
   - 用户头像来源：静态在线地址 `https://` 拼接 `getUserInfo` 返回的 `corpUserId`。
   - 消息内容块距第一行 `4px`，圆角 `24px 0 24px 24px`，`padding: 10px 20px`，背景 `linear-gradient(270deg, rgba(13,148,255,1), rgba(22,115,246,1) 100%)`，文字白色 `14px / 400 / 22px`。
5. AI 消息块：
   - 靠左显示。
   - 第一行为“头像 + AI 助理名+发送时间”，二者间距 `4px`。
   - 文本样式：`12px / 400 / 20px`，颜色 `rgba(57,57,57,1)`，示例：`小米 2026-04-13 08:07`。
   - 头像尺寸：`24px x 24px`。
   - AI 头像来源：助理详情 `icon` 字段，渲染前按 `host` 规则补全地址。
   - AI 助理名来源：助理详情 `name` 字段。
   - AI 消息时间来源：消息生成时间（当前消息对象的时间戳）。
   - 消息内容块距第一行 `8px`，宽度占满当前消息容器整行；该规则适用于所有 AI 消息类型块，不再仅代码块独占整行。
   - 权限消息块（`PermissionCard`）宽度占满当前消息容器可用宽度，不再按内容宽度收缩。
   - AI 消息块内部涉及展开/收起的交互组件（如代码块、思考块、工具调用块）统一使用 `src/imgs/arrow_up_icon.svg` 作为箭头图标资源；展开状态箭头朝上，收缩状态箭头朝下。
   - AI 消息块内如果渲染代码组件块，则该代码组件块需作为块级内容单独占满一整行可用宽度；普通文本消息块仍保持按内容宽度自适应。
   - 代码块在移动端显示时不允许强制换行；当代码内容超出手机屏幕宽度时，代码块内部应保持单行结构并支持横向滚动查看，不得破坏原始缩进与换行语义。
   - 代码块显示代码区域的滚动条需隐藏，但保留横向滚动能力。
6. 多功能按钮区：
   - 区域高度 `32px`。
   - 两个按钮相邻排列，按钮间距 `8px`，按钮背景白色。
   - 按钮 1：新建会话，尺寸 `32px x 32px`，圆角 `20px`，图标 `16px x 16px`；当当前会话消息列表为空（`messages.length === 0`）时，点击后不新建会话，直接 toast 提示“当前是最新会话”。
   - 中间状态提示块：文案“输出中...”，高度 `32px`，圆角 `20px`，背景白色；文本样式 `12px / 400`，颜色 `rgba(38,159,255,1)`；位置固定在整行多功能按钮区的水平中点。
   - “输出中...”仅在当前激活的 `welinkSessionId` 会话处于生成中时显示；若在 A 会话输出中切换到 B 会话，B 会话不显示该提示，且旧会话的晚到状态事件不得回写当前会话页面。
   - 按钮 2：历史会话，尺寸 `32px x 32px`，圆角 `20px`，图标 `16px x 16px`，点击事件空实现。
   - 图标资源在 `src/imgs` 文件夹中创建并通过 `import` 使用。
7. 底部输入区：
   - 宽度占满，高度 `40px`，内边距 `8px 12px`，圆角 `30px`，背景白色。
   - 内部左侧输入框与右侧发送按钮间距 `8px`。
   - 输入框 placeholder：`有问题尽管问我~`。
   - 发送按钮尺寸 `24px x 24px`，发送图标尺寸 `20px x 20px`。
   - iOS 端唤起软键盘后，不允许通过 `transform` 将底部输入区视觉上移；需改为根据键盘高度真实缩减 `WeAgentCUI` 主内容区高度，并保持页面外层不可滚动，仅消息区内部可滚动。
   - `WeAgentCUI` 内容区滚动容器需隐藏滚动条：补充 `scrollbar-width: none`、`-ms-overflow-style: none`，并对 `::-webkit-scrollbar` 使用 `display: none; width: 0; height: 0;`，保持消息区可滚动但默认不显示滚动条。
8. 当对话内容区消息为空时，显示欢迎块：
   - 欢迎块距离内容区顶部 `27px`；
   - 欢迎块内包含 3 个容器，容器间距 `12px`，内容均水平居中；
   - 容器 1：AI 头像图标，尺寸 `72px x 72px`，圆角 `124px`，边框 `2px solid rgba(255,255,255,1)`；
   - 容器 2：欢迎标题文本使用运行时用户信息动态展示（如存在 `weAgentUserName` 则展示 `早上好，${weAgentUserName}`），样式 `18px / 500 / 26px`，颜色 `rgba(25,25,25,1)`；
   - 欢迎语国际化资源需使用 `i18next` 标准插值占位格式 `{{name}}`，不可使用字面量 `{name}`，避免页面直接显示占位符文本；
   - 容器 3：副标题文本使用运行时助理信息动态展示（`weAgentAssistantName` 与 `weAgentAssistantDescription` 组合），样式 `14px / 400 / 22px`，颜色 `rgba(89,89,89,1)`；
   - 当欢迎标题或副标题缺少对应动态数据时，不显示默认兜底文案，也不渲染对应空文本节点。
   - 页面进入时优先显示欢迎块，不展示“加载历史消息中”loading 文案；历史消息加载完成后若存在消息则切换为消息列表展示。
   - `Content.tsx` 中不再展示“加载消息中...”loading 文案（含三点动画），加载中阶段按当前消息态渲染欢迎块或空态。
9. 页面进入解析规则：
   - 进入 `#/weAgentCUI` 页面时，需从 URL query（含 HashRouter query）中解析 `assistantAccount`；
   - 解析结果需在页面内保留（用于后续业务逻辑处理），不影响当前对话 UI 展示逻辑。
10. 历史会话侧边栏：
   - 移动端：点击“历史会话”图标后，在当前页面左侧弹出历史会话侧边栏；
   - 移动端：侧边栏覆盖在当前页面上方，容器宽度 `260px`，高度占满页面可用高度；
   - 移动端：侧边栏右侧显示蒙层，点击蒙层关闭侧边栏；
   - PC 端：点击“历史会话”图标后，历史会话列表在页面左侧弹出，并与右侧对话页面分栏显示，不再使用覆盖式右侧抽屉；
   - PC 端：历史会话列表宽度保持 `260px`，高度占满当前页面可用高度；
   - PC 端：历史会话侧边栏弹窗容器需脱离按钮区定位，不得受多功能按钮区 `32px` 高度或局部相对定位容器裁剪；侧边栏定位应覆盖整个 `weAgentCUI` 页面左侧区域；
   - PC 端：`weAgentCUI` 页面外层去除 `padding`，页面按左右分栏布局；
   - PC 端：右侧 AI 对话容器包含内容区、按钮区、输入区，容器保留 `padding-top: 16px`、`padding-bottom: 30px`；
   - PC 端：默认状态下，右侧 AI 对话容器左右内边距固定为 `150px`，内容宽度占满右侧可用区域，不再限制 `max-width`；
   - PC 端：当历史会话侧边栏展开时，右侧 AI 对话容器左右内边距切换为 `50px`，内容宽度继续占满右侧可用区域；
   - PC 端：关闭历史会话按钮采用悬浮定位显示在侧边栏右侧，不计入页面分栏宽度；
   - PC 端：历史会话侧边栏在布局计算中仍只占 `260px` 宽度，关闭按钮不额外挤占右侧对话容器宽度；
   - 历史会话侧边栏弹出时需带过渡动画；
   - 历史会话侧边栏整体弹窗容器内边距统一为 `padding: 20px 18px`；
   - 历史会话侧边栏顶部新增标题区：高度 `32px`，宽度占满；标题区位于上述弹窗容器内部；标题容器 `padding: 6px 12px`；标题文本内容为“历史对话”，样式 `12px / 500`、`rgba(51,51,51,1)`；
   - 侧边栏保持可滚动，但需隐藏可视滚动条。
11. 历史会话数据获取：
   - 打开侧边栏时调用 `getHistorySessionsList`；
   - 调用参数需带 `assistantAccount`（来自 `weAgentCUI` 页面入口 query 解析结果）进行过滤查询。
   - 获取历史消息统一使用 `getSessionMessageHistory` 接口；
   - `getSessionMessageHistory` 返回 `content` 顺序为“从旧到新”，页面按接口顺序直接渲染（不额外 reverse）；
   - 上拉加载更早消息时，使用上一批返回的 `nextBeforeSeq` 作为 `beforeSeq` 继续拉取；
   - 渲染历史消息时，若 AI 回复包含 `Question` 或 `Permission` 类型消息块，则该消息块仅展示，不允许选择选项、输入提交或点击授权按钮；
   - 渲染历史消息时，保持“优先按 `parts` 渲染、`parts` 为空时再回退到 `message.content`”的现有逻辑；仅当进入 `message.content` 回退分支且 `content === ''` 时，该条消息不渲染；
   - 获取历史消息（`getSessionMessageHistory`）接口失败时，页面需通过 toast 弹窗提示失败信息。
12. 历史会话分组与展示：
   - 按 `updatedAt` 将历史会话分为 3 组：`今天`、`昨天`、`3天前`；
   - 每个分组由“标题区 + 会话项列表”组成，分组内标题与列表间距 `10px`；
   - PC 端分组标题容器：高度 `32px`，宽度自适应，`padding: 6px 12px`，左对齐，文本为对应分组标题，样式 `12px / 400`，颜色 `rgba(153,153,153,1)`；
   - PC 端会话项：高度 `32px`，宽度自适应，`padding: 6px 12px`，左对齐，文本内容为会话标题 `title`，每个 item 标题超出显示 `...`，样式 `12px / 400`，颜色 `rgba(51,51,51,1)`。
   - 侧边栏请求历史会话时不再展示“加载中...”文字提示。
   - 无历史会话时，空态图片宽度固定 `100px`，高度自适应。
13. 会话项选中态：
   - 点击会话项后显示选中样式：PC 端为圆角 `8px`、背景白色；
   - 选中文本样式：`16px / 500 / 24px`，颜色 `rgba(59,112,255,1)`；
   - 点击会话项后的会话切换事件当前为空实现（预留后续逻辑）。
14. 组件化约束：
   - `WeAgentCUI` 历史会话侧边栏需拆分为 `src/components/assistant` 下的独立组件；
   - 侧边栏相关逻辑（显隐状态、加载状态、历史列表请求、按 `updatedAt` 分组、会话项选中态）需内聚在该组件内部；
   - `App.tsx` 仅负责在按钮区使用该组件，不再保留侧边栏内部状态与渲染细节。
15. 底部操作区组件拆分：
- `WeAgentCUI` 页面底部操作区需拆分为独立组件；
   - `WeAgentCUI` 底部操作区仅保留输入框与纸飞机发送按钮；
- 纸飞机发送按钮点击行为：输入非空时发送并清空输入框；
   - 发送图标需从 `src/imgs` 中导入使用。
16. 底部发送/停止按钮切换：
- `WeAgentCUI` 底部操作区发送按钮点击后，按钮状态需切换为“停止按钮”，并进入 `generating` 态；
   - 点击“停止按钮”并调用 `stopSkill` 成功后，按钮需恢复为“发送按钮”；
   - 停止按钮样式：`32px x 32px`，圆角 `20px`，背景 `rgba(10,89,247,0.05)`，`padding: 6px`；
   - 停止按钮内图标尺寸：`20px x 20px`；
   - 停止图标资源需放在 `src/imgs` 并通过 `import` 导入使用。
17. 历史会话高亮与会话切换联动：
   - 侧边栏打开后需根据当前对话页的 `welinkSessionId` 高亮对应会话项（列表由 `assistantAccount` 过滤后展示）；
   - 点击其他会话项后，需将该项 `welinkSessionId` 同步到对话页主状态；
   - 同步后对话页需按新会话重新加载消息并刷新会话状态（含加载态、消息列表、监听器绑定）。
18. `WeAgentCUI` 消息区不提供“复制消息”和“发送到IM”操作，组件链路中移除 `onCopy`、`onSendToIM` 未使用参数。
19. PC 端发送快捷键弹窗样式：
   - 弹窗尺寸：`180px x 72px`，圆角 `8px`，`padding: 4px`；
   - 选中 item 背景：`rgba(204,204,204,0.25)`，圆角 `8px`；
   - item 文本样式：`14px / 400`，左对齐；
   - item 左侧为固定宽度 `28px` 的图标容器；
   - 选中态 `√` 图标必须从 `src/imgs` 导入，图标尺寸 `12px x 12px`，在左侧容器内水平垂直居中。
20. `WeAgentCUI` 中渲染 AI `question` 类型消息块时：
   - `options` 需支持对象结构 `{ label, description }`；
   - 选项按钮主文案显示 `label`；
   - 当 `description` 有值时，需在 `label` 下方追加展示说明文案，不可丢失；
   - 每个问题选项块按行显示，一行仅展示一个选项块，不再并排换行布局；
   - 鼠标移入问题选项按钮时，选项主文案与说明文案的字体颜色保持默认展示颜色不变，不因 hover 态切换为白色或其他高亮文字色；
   - 用户提交问题回答成功后，原 AI `QuestionCard` 中仍需保留“已回答”状态和回答结果展示；
   - 参考 `skill-miniapp` 的处理方式，`QuestionCard` 组件本身只负责展示和本地“已回答”状态维护，不在组件内部直接调用宿主 `sendMessage`；
   - `QuestionCard` 提交回答时仅向页面上层上抛 `answer` 与 `toolCallId`，由页面上层统一复用现有发送链路调用 `sendMessage`；
   - 同时，用户本次回答内容还需插入为一条独立的用户消息气泡，进入正常消息流展示；
   - 用户回答后的 AI 后续回复继续按现有流式链路渲染为后续独立 AI 消息块，不并入原 `QuestionCard`；
   - 问题回答消息在排序上需直接落到当前消息列表尾部，不得复用普通输入框发送场景中“插入到当前流式 AI 消息前”的特殊逻辑；
   - 若后续收到 `question completed/error` 事件时，原 question 所在助手消息已经结束流式态，则只更新原 `QuestionCard` 的回答状态与结果，不重新创建新的 question 助手消息块；
   - 当同一条 `question` 同时存在顶层 `options` 与 `input.questions[0].options` / `input.options` 时，需优先使用带对象结构的 `input` 内选项数据，避免被仅含字符串的顶层 `options` 覆盖，导致 `description` 丢失；
   - 为兼容历史数据或简化结构，若后端仅返回字符串数组，也需按 `label` 兜底渲染。
21. `WeAgentCUI` 中收到 AI 流式错误事件时：
   - 适用事件类型包含 `session.error` 与 `error`；
   - 错误信息需在 AI 回复消息区内渲染为独立错误信息块，不仅输出到控制台；
   - 若当前存在进行中的 AI 回复消息，则错误块追加在该条 AI 消息内部；
   - 若当前不存在可复用的 AI 回复消息，则新建一条助手消息承载错误块；
   - 错误块文案优先展示事件中的 `error` 字段，无明确内容时使用场景兜底文案。
22. `WeAgentCUI` 中 AI 流式回复的消息 ID 处理规则：
   - “正在生成中，请稍等...”占位块不再作为 `Message` 插入 `messages`，而是改为独立的临时预览渲染态；
   - `messages` 列表中仅保留真实消息，assistant 消息 `id` 只使用服务端真实 `messageId`；
   - `streamingMsgIdRef` 仅保存当前真实 assistant 消息的 `messageId`，在尚未收到真正承载内容的 AI 事件前必须保持为空；
   - 当收到真正承载内容的 AI 流式事件（如 `text.delta`、`text.done`、`thinking.delta`、`thinking.done`、`tool.update`、`question`、`permission.ask`、`file`、`streaming`）时，直接使用事件中的真实 `messageId` 创建或更新 assistant 消息；
   - 独立占位块仅允许由 `message.user` 事件拉起，不得在 `handleGenerate`、`step.start`、`session.status=busy` 等时机提前显示，也不得创建随机 `id` 的 fake assistant message；
   - `snapshot`、历史消息恢复、`streaming` 补流到来时，需清理本地占位块，并继续只按真实 `messageId` 恢复 assistant 消息，避免重复渲染。
23. 页面背景资源规则补充：
   - 原 `assistant-bg.svg` 统一下线，移动端背景资源改为 `assistant-cui-bg.png`；
   - 新增 PC 端背景资源 `assistant-cui-pc-bg.png`；
   - 样式层以移动端背景为默认值，PC 端通过页面级 PC class 覆盖 `background-image`，不在业务组件内通过 JS 内联样式分流背景图。

## 18. 页面 JSAPI 联动补充（基于小程序JSAPI接口文档）

1. 接口调用端能力适配：
   - 移动端：通过 `window.HWH5EXT.xxx` 调用对应 JSAPI；
   - PC 端：默认通过 `window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'xxx', params})` 调用同名能力；
   - 二维码相关接口按《小程序JSAPI接口文档》走专用方法，不复用 `handleSdk`：
      - `queryQrcodeInfo`：`window.Pedestal.callMethod('method://agentSkillsDialog/queryQrcodeInfo', params)`
      - `updateQrcodeInfo`：`window.Pedestal.callMethod('method://agentSkillsDialog/updateQrcodeInfo', params)`
   - 页面内统一封装调用入口，保证业务代码按同一方法名调用，不直接耦合端差异。
   - `getWeAgentDetails` 参数适配：
      - 业务侧统一按单个账号传入 `partnerAccount`；
      - 封装层在移动端透传 `{ partnerAccount }`；
      - 封装层在 PC 端转换为 `{ partnerAccounts: [partnerAccount] }`（PC 入参保持数组不变）。
2. 激活助理页面（`/activateAssistant`）：
   - 页面初始化调用 `getWeAgentList` 获取列表，使用返回结构 `content` 作为列表数据源；
   - 点击“选择助理”时按端能力分支处理：
      - PC 端（`isPcMiniApp === true`）：
         - 列表非空：通过 `react-router` 导航（`navigate('/selectAssistant')`）跳转；
         - 列表为空：空实现（不跳转、不打开新页面）。
      - 移动端（`isPcMiniApp === false`）：
         - 为空：调用 `window.HWH5.openWebview({ uri: 'h5://123456/html/index.html?from=weAgent#createAssistant' })`；
         - 非空：调用 `window.HWH5.openWebview({ uri: 'h5://123456/html/index.html?from=weAgent#selectAssistant' })`。
3. 启动助理页面（`/selectAssistant`）：
   - 页面初始化调用 `getWeAgentList`，并将返回的 `content` 助理信息填充到列表项；
   - 点击“创建助理”：通过 `react-router-dom` 导航到 `/createAssistant?from=weAgent`；
   - 路由渲染约束：统一使用 `react-router-dom` 的路由能力，不再维护自定义 `HashRouter` 实现；
   - 点击“创建助理”仅通过 `react-router` 导航处理，不再依赖手动改 `window.location.hash` 与 `window.location.reload()` 强刷页面；
   - 选中某个助理后点击“立即启用”：
      - 使用选中项 `partnerAccount` 调用 `getWeAgentDetails({ partnerAccount })`（封装层按端能力适配实际入参）；
      - 组装 `openWeAgentCUI` 入参时，`weCodeUrl` 取值规则如下：
         - 若助理详情 `weCodeUrl` 不为空，则先解析其 host；
         - 当 `weCodeUrl.host !== APP_ID` 时：取助理详情 `weCodeUrl`，并追加 query `wecodePlace=weAgent` 与 `robotId=<detail.robotId>`；
         - 当 `weCodeUrl.host === APP_ID` 时：取助理详情 `weCodeUrl`，并追加 query `wecodePlace=weAgent` 与 `assistantAccount=<partnerAccount>`；
         - 若 `weCodeUrl` 为空：使用 `WE_AGENT_BASE_URI` 默认值（`h5://123456/index.html#weAgentCUI`），并追加 query `wecodePlace=weAgent` 与 `assistantAccount=<partnerAccount>`；
      - 按上述 `weCodeUrl` 规则组装 `openWeAgentCUI` 入参并调用 `openWeAgentCUI`。
4. 创建助理页面（`/createAssistant`）：
   - 页面初始化读取 query 参数 `from`；
   - 第一页点击“下一步”时，将基础信息草稿写入路由 `state`，并通过路由跳转到 `/selectBrainAssistant`，同时保留当前 query 参数；
   - 第二页（`/selectBrainAssistant`）初始化时先从路由 `state` 读取第一页草稿；若草稿缺失，则重定向回 `/createAssistant`；
   - 第二页进入后调用 `getAgentType`，使用返回 `content` 获取内部助手数据；
   - 第二页点击浏览器返回时，应回到 `/createAssistant`；
   - 点击“确定”调用 `createDigitalTwin`；
   - 若 `from=weAgent`：
      - 从创建结果获取 `partnerAccount`，调用 `getWeAgentDetails({ partnerAccount })`（封装层按端能力适配实际入参）；
      - 组装 `openWeAgentCUI` 入参时，`weCodeUrl` 取值规则如下：
         - 若助理详情 `weCodeUrl` 不为空，则先解析其 host；
         - `weCodeUrl` 的 host 提取统一通过共享工具层使用正则表达式解析，例如 `h5://123456/html/index.html` 需解析出 host=`123456`；
         - 当 `weCodeUrl.host !== APP_ID` 时：取助理详情 `weCodeUrl`，并追加 query `wecodePlace=weAgent` 与 `robotId=<detail.robotId>`；
         - 当 `weCodeUrl.host === APP_ID` 时：取助理详情 `weCodeUrl`，并追加 query `wecodePlace=weAgent` 与 `assistantAccount=<partnerAccount>`；
         - 若 `weCodeUrl` 为空：使用 `WE_AGENT_BASE_URI` 默认值（`h5://123456/index.html#weAgentCUI`），并追加 query `wecodePlace=weAgent` 与 `assistantAccount=<partnerAccount>`；
      - 按上述 `weCodeUrl` 规则组装 `openWeAgentCUI` 入参并调用 `openWeAgentCUI`；
   - 若 `from` 非 `weAgent`：
      - 业务侧统一调用 `hwext` 封装方法（参考 `getJsApiOrThrow` 风格）；
      - 封装方法内部按端能力分流：
         - 移动端（`isPcMiniApp === false`）：调用 `window.HWH5.openIMChat({ chatId: partnerAccount })`；
         - PC 端（`isPcMiniApp === true`）：调用 `window.Pedestal.callMethod('method://agentSkills/handleSdk', { owner: partnerAccount })`。
5. 助理详情页面（`/assistantDetail`）：
   - 读取 query 参数 `partnerAccount`；
   - 调用 `getWeAgentDetails({ partnerAccount })` 获取详情并渲染 `weAgentDetailsArray[0]`（封装层按端能力适配实际入参）。
6. 切换助理页面（`/switchAssistant`）：
   - 读取 query 参数 `partnerAccount`；
   - 调用 `getWeAgentList` 渲染 `content` 列表，并默认选中与 query 匹配的助理项；
   - 底部按钮点击分端处理（`onLeftButtonClick` 与 `onRightButtonClick` 分开实现）：
      - 点击“取消选择”：
         - 移动端：直接调用 `window.HWH5.close()`；
         - PC 端：调用 `dispatchSwitchAssistantCancelEvent`。
      - 点击“确认切换”：
         - PC 端：调用 `dispatchSwitchAssistantConfirmEvent`；
         - 移动端：执行 `handleConfirmSwitch` 逻辑：
            - 根据当前选中项 `partnerAccount` 调用 `getWeAgentDetails({ partnerAccount })`（封装层按端能力适配实际入参）；
            - 组装 `openWeAgentCUI` 入参时，`weCodeUrl` 取值规则如下：
               - 若助理详情 `weCodeUrl` 不为空，则先解析其 host；
               - 当 `weCodeUrl.host !== APP_ID` 时：取助理详情 `weCodeUrl`，并追加 query `wecodePlace=weAgent` 与 `robotId=<detail.robotId>`；
               - 当 `weCodeUrl.host === APP_ID` 时：取助理详情 `weCodeUrl`，并追加 query `wecodePlace=weAgent` 与 `assistantAccount=<partnerAccount>`；
               - 若 `weCodeUrl` 为空：使用 `WE_AGENT_BASE_URI` 默认值（`h5://123456/index.html#weAgentCUI`），并追加 query `wecodePlace=weAgent` 与 `assistantAccount=<partnerAccount>`；
            - 按上述 `weCodeUrl` 规则组装 `openWeAgentCUI` 入参并调用 `openWeAgentCUI`；
            - 处理完成后同步调用 `window.HWH5.close()`。
7. `openWeAgentCUI` 参数组装规则：
   - 若助理详情 `weCodeUrl` 不为空，则先解析其 host；
   - `weCodeUrl` 的 host 提取统一通过共享工具层使用正则表达式解析，例如 `h5://123456/html/index.html` 需解析出 host=`123456`；
   - 当 `weCodeUrl.host !== APP_ID` 时，`weAgentUri` 取 `weCodeUrl` 并追加 query `wecodePlace=weAgent` 与 `robotId=<detail.robotId>`；
   - 当 `weCodeUrl.host === APP_ID` 时，`weAgentUri` 取 `weCodeUrl` 并追加 query `wecodePlace=weAgent` 与 `assistantAccount=<partnerAccount>`；
   - 若 `weCodeUrl` 为空，则 `weAgentUri` 取 `WE_AGENT_BASE_URI` 默认值（`h5://123456/index.html#weAgentCUI`），随后追加 query `wecodePlace=weAgent` 与 `assistantAccount=<partnerAccount>`；
   - `assistantDetailUri`：`h5://123456/index.html` 追加 query `partnerAccount`，并追加 hash `assistantDetail`；
   - `switchAssistantUri`：`h5://123456/index.html` 追加 query `partnerAccount`，并追加 hash `switchAssistant`。
8. 移动端标题栏状态栏适配（创建助理/启动助理/切换助理/助理详情）：
   - 当 `isPcMiniApp === false` 时，需要调用 `window.HWH5.getDeviceInfo()`；
   - 从出参对象读取 `statusBarHeight`（状态栏高度）；
   - 将标题栏顶部安全距离设置为 `statusBarHeight`，避免系统状态栏遮挡标题栏内容；
   - 业务页面在标题组件中直接调用 `hwext.ts` 的 `getDeviceInfo` 获取该值，不使用单独的 `useMobileStatusBarHeight.ts` 方法文件。
   - `getDeviceInfo/statusBarHeight` 封装实现需遵循最小判空策略：仅保留必要能力判断与数值归一化，不引入重复空判断分支。
9. 移动端标题栏返回事件（创建助理/助理详情/切换助理/启动助理）：
   - 返回按钮点击后直接调用 `window.HWH5.navigateBack()`；
   - 不增加空判断、可选链或兜底逻辑。
10. `WeAgentCUI` 历史会话侧边栏联动：
   - 点击“历史会话”图标时调用 `getHistorySessionsList`；
   - 查询参数使用页面入口解析得到的 `assistantAccount`；
   - 接口返回列表按 `updatedAt` 分组展示为 `今天`、`昨天`、`3天前`。
   - 侧边栏选中态需与对话页当前 `welinkSessionId` 保持一致；
   - 点击会话项后需回传 `welinkSessionId` 到对话页并触发会话切换刷新逻辑。
11. `WeAgentCUI` 会话初始化与新建逻辑：
   - 页面进入后，基于 query 解析得到的 `assistantAccount` 调用 `getWeAgentDetails` 获取当前助理详情；
   - 再调用 `getHistorySessionsList({ assistantAccount, status: 'ACTIVE' })` 查询当前助理活跃会话：
      - 若存在会话：按 `updatedAt` 取最新会话；
      - 若不存在会话：调用 `createNewSession` 创建会话，入参固定为：
         - `bussinessDomain: 'miniapp'`
         - `bussinessType: 'direct'`
         - `assistantAccount`
         - `ak: 助理详情.appKey`
         - `bussinessId: window.HWH5.getUserInfo()` 返回的 `uid` 字符串
   - 将选中/新建会话的 `welinkSessionId` 作为后续 AI 对话与历史消息展示的会话 ID；
   - 点击“新建会话”图标按钮时，按同样参数调用 `createNewSession`，并用新会话 `welinkSessionId` 更新当前对话会话上下文。
12. 助理头像地址兼容规则（助理详情/切换助理/启用助理）：
   - 在 `ai-chat-viewer/src/constants.tsx` 中维护 `HOST` 常量；
   - `HOST` 需通过环境变量 `isProEnv` 动态取值：
      - `isProEnv=true`（production）：`h5://921535418692659`
      - `isProEnv=false`（uat）：`h5://S008623`
   - 当接口返回的助理 `icon` 以 `/` 开头时，渲染头像前需拼接 `HOST`；
   - 当 `icon` 为绝对地址（如 `http://`、`https://`）时保持原值不变。
13. 新增 UAT 打包能力：
   - 在 `package.json` 中新增 `build:uat` 脚本，产物需通过 `isProEnv=false` 进入 uat 常量分支；
   - 默认 `build`（production）产物保持不变。

## 19. 宿主事件桥与库打包约束

1. 助理页面需要补充宿主事件桥，统一通过 `window.dispatchEvent(new CustomEvent(...))` 向宿主通知关键交互。
2. 事件名与触发时机：
   - `weAgent:assistant-close`：
      - 点击标题区关闭按钮（PC）时触发；
      - 点击助理详情页或切换助理页根容器空白区域（即背景层）时触发。
   - `weAgent:switch-assistant-select`：
      - 切换助理页点击某个助理卡片并完成选中时触发；
      - `detail` 中带 `{ id: selectedAssistantId }`。
   - `weAgent:switch-assistant-cancel`：
      - 仅 PC 端点击“取消选择”按钮时触发；
      - `detail` 中带 `{ id: selectedAssistantId }`（允许为空字符串）。
   - `weAgent:switch-assistant-confirm`：
      - 仅 PC 端点击“确认切换”按钮时触发；
      - `detail` 中带 `{ id: selectedAssistantId }`。
3. `SwitchAssistant` 组件化导出场景支持通过 `defaultSelectedAssistantId` 传入默认选中项；若未传则按页面 query 默认选中规则处理。
4. 库构建（`webpack.lib.config.js`）需将以下依赖配置为 `externals`，避免宿主集成时重复打包 React 产生运行时冲突：
   - `react`
   - `react-dom/client`
   - `react/jsx-runtime`

## 20. URL Query/Hash 统一处理规范

1. `ai-chat-viewer` 内关于 URL 的 query/hash 取值与设值逻辑统一收敛到 `src/utils/hwext.ts`。
2. 所有 query/hash 解析必须优先使用 `URL` 对象与 `searchParams`，不再使用字符串 `indexOf/slice/split` 手动拆分。
3. `getQueryParam` 需同时支持三类来源：
   - 路由传入的 `routeSearch`；
   - `window.location.search`；
   - `window.location.hash` 中的路由 query（HashRouter 场景）。
4. `appendQueryParam` 需使用 `URL.searchParams` 进行 query 设值，保证编码与覆盖行为一致。
5. `openH5Webview` 在无宿主 `openWebview` 能力时的 fallback 跳转逻辑，需基于 `URL` 对象解析目标 URI，并正确保留 hash 路由与 query 信息。
6. `parseWelinkSessionId` 读取 `welinkSessionId` 时，需复用统一 query 解析能力，兼容 search/hash 两种位置。

## 21. JSAPI Mock 示例（WeAgentCUI 可对话）

1. 目标：
   - 基于 `小程序JSAPI接口文档.md`、`SkillClientSdkInterfaceV1.md`、`SkillClientSdkInterfaceV2.md`，提供一套浏览器本地可运行的 JSAPI Mock；
   - 在无真实 SDK（`window.HWH5EXT` / `window.Pedestal`）时，`weAgentCUI` 页面可完成“会话初始化 -> 发消息 -> 渲染 AI 回复 -> 拉取历史会话”的完整链路。
2. 启用策略：
   - 仅在本地调试环境启用（`localhost/127.0.0.1`）或 URL 明确携带 `mockJsApi=1` 时启用；
   - mock 仅在“无真实 SDK”前提下补齐浏览器本地调试能力，不覆盖真实 `window.HWH5EXT`、`window.Pedestal` 与真实端判断结果；
   - 本地 mock 的端类型判断仍统一复用 `isPcMiniApp` 真实逻辑，即仅当存在 `window.Pedestal.callMethod` 时视为 PC 端，否则按移动端分支处理；
   - 若已存在真实 SDK，mock 不覆盖真实实现。
   - mock 初始化失败时仅打印错误日志，不阻断页面渲染（避免首屏白屏）。
3. mock 覆盖接口（最小闭环）：
   - V1 对话链路：`createNewSession`、`getHistorySessionsList`、`getSessionMessageHistory`、`registerSessionListener`、`unregisterSessionListener`、`sendMessage`、`regenerateAnswer`、`stopSkill`、`sendMessageToIM`；
   - V2 助理链路：`getWeAgentList`、`getWeAgentDetails`、`getAgentType`、`createDigitalTwin`、`getWeAgentUri`、`openWeAgentCUI`。
   - 浏览器宿主桥 mock 需补齐最小可运行能力：`HWH5.openWebview`、`HWH5.showToast`、`HWH5.getDeviceInfo`、`HWH5.getUserInfo`、`HWH5.getAccountInfo`、`HWH5.navigateBack`、`HWH5.close`。
4. 对话行为要求：
   - `sendMessage` 返回用户消息对象，并异步通过 `registerSessionListener` 回调 `text.delta` / `text.done` / `session.status`；
   - `getSessionMessageHistory` 返回当前会话历史消息列表，且顺序为“从旧到新”，确保页面刷新后可回显历史；
   - `getHistorySessionsList` 返回当前助理维度的会话列表，支持侧边栏分组展示；
   - `createNewSession` 可创建新会话并生成 `welinkSessionId`。
   - mock 需提供可稳定复现的 AI 错误场景：当用户输入命中特定触发词时，分别回调 `session.error` 或 `error` 事件，供 `WeAgentCUI` 验证消息区错误块渲染。
5. 默认 mock 数据要求：
   - 至少包含 1 个助理（`partnerAccount`、`name`、`icon`、`appKey`、`weCodeUrl`）；
   - 助理详情字段需满足 `WeAgentCUI`、助理详情页、切换页渲染所需；
   - 助理列表、助理详情、创建助理、切换助理、激活助理、WeAgentCUI 六类页面在本地浏览器下都需具备可直接访问的 mock 数据，不依赖手工修改源码；
   - 默认返回“可对话”会话状态（如 `ACTIVE` / `IDLE`）。
   - 默认历史消息可保留普通问答示例；错误场景通过发送特定提示词实时触发，无需依赖额外手工改 mock 数据。
6. 验收标准：
   - 本地运行后可直接访问以下页面并看到可用 mock 数据：
      - `#/activateAssistant?mockJsApi=1`
      - `#/selectAssistant?mockJsApi=1`
      - `#/switchAssistant?partnerAccount=mock_assistant_001&mockJsApi=1`
      - `#/assistantDetail?partnerAccount=mock_assistant_001&mockJsApi=1`
      - `#/createAssistant?from=weAgent&mockJsApi=1`
      - `#/weAgentCUI?assistantAccount=mock_assistant_001&mockJsApi=1`
   - 本地运行 `ai-chat-viewer` 后进入 `#/weAgentCUI?assistantAccount=<mock_account>`，可发送文本并看到 AI 回复内容渲染；
   - 点击“新建会话”后能创建并切换到新会话；
   - 打开“历史会话”侧边栏可看到 mock 会话列表；
   - 输入约定的错误触发词后，可看到 AI 回复消息区渲染错误信息块；
   - 不影响真实 SDK 场景下的接口调用行为。

## 22. 无用代码清理约束

1. 本轮清理仅允许删除或收敛“已确认无业务价值”的无用代码，不得影响现有页面视觉、路由能力、库导出能力与宿主集成行为。
2. 可清理范围包括：
   - 未使用的 import、类型、常量、辅助函数；
   - 已有公共实现可覆盖的重复工具逻辑；
   - 与当前组件实现不一致、已失效的测试代码；
   - 当前脚本声明存在但无法实际生效的工程配置噪音。
3. 不可误删以下仍有真实用途的代码：
   - `src/lib/index.ts` 中面向库构建的命名导出与挂载/卸载方法；
   - `src/pages/createAssistant.tsx` 这类被独立 webpack 入口消费的页面入口文件；
   - `example/` 中用于演示库产物消费方式的样例代码。
4. `CodeBlock` 与助理详情页涉及复制能力时，项目内只保留一套公共剪贴板实现，避免重复维护。
5. 数字人创建链路中，若头像校验当前只基于文件路径后缀生效，则历史遗留但未参与实际判断的大小/MIME 常量与对应过期测试应一并移除或更新，保证实现与测试口径一致。
6. 清理完成后至少需满足：
   - `npm run build` 通过；
   - `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` 不再报本轮已确认的未使用项；
   - 若仍存在失败测试，需要明确指出是历史测试基座问题还是本轮残留问题。

## 23. plugin.json 构建前置改写脚本

1. `ai-chat-viewer` 根目录需要提供一个可直接执行的 `build.js` 入口，支持命令：`node ./build.js ${appid}`。
2. 实际脚本逻辑放在根目录的 `.build_config/build.js` 中；根目录 `build.js` 仅负责转发调用，兼容外部固定的执行方式。
3. 脚本入参 `appid` 为必填；缺失时需以非 `0` 退出码结束，并输出明确错误信息。
4. 脚本执行时需修改 [plugin.json](/F:/AIProject/skillSDK/ai-chat-viewer/plugin.json) 中两个字段：
   - `appId`：直接替换为传入的 `appid`
   - `indexURL`：仅替换 URL 的 host 值为传入的 `appid`，保留原协议、路径、query、hash 不变
5. 当前 `plugin.json` 默认形态为 `h5://<host>/index.html`，脚本需兼容自定义 scheme 的解析，不允许通过简单字符串拼接破坏原有 URL 结构。
6. 脚本应保持输出最小可读：成功时打印目标文件路径和最终写入的 `appid`，失败时打印明确原因。

## 24. 国际化底座迁移需求

1. `ai-chat-viewer` 当前自研国际化实现需迁移到 `react-i18next` 第三方方案，后续页面和组件统一基于标准 `i18next` 实例工作。
2. 本轮迁移后不保留 [src/i18n/index.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/i18n/index.ts)；原先通过该文件导出的 `t`、`useI18n`、`setLanguage` 等能力全部移除。
3. 国际化资源目录需调整为：
   - [src/i18n/config.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/i18n/config.ts)
   - [src/i18n/resources/zh.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/i18n/resources/zh.ts)
   - [src/i18n/resources/en.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/i18n/resources/en.ts)
   - [src/i18n/types.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/i18n/types.ts)
4. 当前已有文案 key 不调整命名方式，继续沿用扁平 key 形式，避免页面改造时同时重命名资源 key。
5. 组件内国际化调用统一使用 `useTranslation()`：
   - 不再引入 `useI18n()`
   - 不再使用项目自定义 hook 包装层
6. 非 React 模块国际化调用统一直接引用 `i18n` 实例并使用 `i18n.t(...)`：
   - 适用范围包括 toast、streaming、辅助工具模块
   - 不再额外保留项目级 `t()` 包装函数
7. 启动语言初始化仍以 `getAppInfo().language` 为准，语言来源兼容统一收口到 [src/utils/hwext.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/utils/hwext.ts) 的 `getAppInfo()` 函数内部：
   - 通过 `isPcMiniApp()` 区分端类型；
   - 移动端直接调用 `window.HWH5.getAppInfo()` 并读取返回值中的 `language`；
   - PC 端直接调用 `window.localStorage?.getItem('language')` 读取语言值；
   - `getAppInfo()` 最终统一返回 `{ language: 'zh' | 'en' }`，业务层与页面层不再区分 PC/移动语言来源。
   - PC 端需新增运行时语言变化监听：应用初始化时注册宿主回调 `window.onReceive = (payload) => {}`，`payload='2052'` 表示中文、`payload='1033'` 表示英文；收到监听后直接更新 `i18next` 当前语言即可，不额外承担本地存储回写或其他桥接兼容逻辑。
8. 前端 `normalizeLanguage` 继续保留为最后一道兜底兼容，兼容规则需覆盖：
   - `en` / `en-US` / `en_US` / `1033` 统一归为 `en`
   - `zh` / `zh-CN` / `zh_CN` / `2052` 统一归为 `zh`
   - 其他值统一回退到 `zh`
9. 页面入口需在应用启动时优先初始化国际化配置，确保根组件渲染前 `i18next` 已完成实例注册。
10. 本轮迁移优先覆盖当前已经接入国际化的页面、组件和工具模块，要求迁移后展示文案与迁移前保持一致；其中 `activateAssistant` 页面、`createAssistant` 页面与 `assistantDetail` 页面需补齐接入现有 `react-i18next` 方案。
11. 当前尚未接入国际化的硬编码中文文案不要求在本轮一并全部替换；但 `activateAssistant`、`createAssistant` 与 `assistantDetail` 不再归类为后续补齐页面，需在当前版本完成文案替换。
12. 迁移完成后，旧 [src/i18n/messages.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/i18n/messages.ts) 不再保留为运行时入口，避免出现双套资源定义并存。

## 28. 类型声明收口

1. [src/utils/hwext.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/utils/hwext.ts) 只负责 JSAPI 调用适配、参数归一化与运行时工具方法，不再对外导出任何 interface/type。
2. 所有桥接层相关接口与类型统一收口到 `src/types` 目录：
   - JSAPI / HWH5EXT / WeAgent 相关类型放在 `src/types/bridge`
   - 页面、组件、系统与业务领域类型继续分别放在 `src/types/pages`、`src/types/components`、`src/types/system`、`src/types/digitalTwin` 等目录
   - 页面组件对外暴露的 props 类型（如 `AssistantDetailProps`）同样视为页面类型，需定义在 `src/types/pages` 并由页面文件导入使用，不再内联定义在页面组件文件中
3. 业务页面、组件、mock、opencode 适配层在使用接口/类型时，必须直接从 `src/types` 目录导入，不允许再通过 `src/utils/hwext.ts` 间接获取类型。

## 29. 全局版本更新弹窗

1. `ai-chat-viewer` 需要在应用全局入口注册移动端版本更新监听，不在单个业务页面重复注册。
2. 全局更新监听统一在 `AppRouter` 层初始化，并在应用生命周期内只注册一次。
3. 监听能力来源于 `hwext` 封装方法，对应宿主接口为 `HWH5EXT.onTabForUpdate(callback)`。
4. 仅移动端注册该监听；PC 端不弹版本更新确认框。
5. 当收到 `onTabForUpdate` 回调时，页面需弹出全局确认弹窗，不直接执行重启。
6. 该弹窗使用通用确认弹窗组件实现，不再为“删除助理”和“版本更新”分别维护两套确认弹窗结构。
7. 更新弹窗文案固定为：
   - 标题：`更新提示`
   - 内容：`新版本已经准备好，是否重启应用？`
   - 左按钮：`取消`
   - 右按钮：`确认`
8. 更新弹窗底部右侧“确认”按钮文本颜色固定为 `#0D94FF`。
9. 用户点击取消按钮或蒙层时，仅关闭弹窗，不执行其他动作。
10. 用户点击确认按钮时，统一调用 `HWH5.reboot()` 重启应用；该能力通过 `hwext.ts` 中的运行时封装方法触发。
11. 若调用 `HWH5.reboot()` 失败并进入业务 `catch` 分支，需继续遵循全局错误提示规范，直接通过 `showToast(固定错误文案)` 提示用户。






