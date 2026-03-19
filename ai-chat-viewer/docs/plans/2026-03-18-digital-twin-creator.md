# 个人助理创建组件执行计划

- 计划日期：`2026-03-18`
- 对应需求：`docs/requirements.md (v0.7)`
- 对应设计：`docs/design-decisions.md (v0.3)`
- 执行策略：`串行（后置任务依赖前置任务）`

## Task 1：补齐前端单测基础设施

文件：
1. 修改：`package.json`
2. 修改：`package-lock.json`
3. 新建：`jest.config.js`
4. 新建：`src/test/setupTests.ts`

Step 1：先写一个失败测试（红灯）
1. 新建 `src/utils/__tests__/smoke.test.ts`，仅断言 `expect(true).toBe(true)`，先不配置 Jest。

Step 2：运行测试确认失败
1. 命令：`npx jest --runInBand`
2. 预期：测试执行失败（缺少测试环境/配置或无法解析工程模块）。

Step 3：写最小实现让测试通过（绿灯）
1. 安装依赖并落配置：
   - `npm install -D jest @types/jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom identity-obj-proxy`
2. 在 `package.json` 增加脚本：
   - `"test": "jest --runInBand"`
3. 新增 `jest.config.js`：
   - `testEnvironment: 'jsdom'`
   - `setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts']`
   - `moduleNameMapper` 处理 `less/css` 为 `identity-obj-proxy`
   - `transform` 使用 `babel-jest` 处理 `ts/tsx`
4. 新建 `src/test/setupTests.ts`，引入 `@testing-library/jest-dom`。

Step 4：再次运行测试确认通过
1. 命令：`npm test`
2. 预期：`smoke.test.ts` 通过。

Step 5：提交
1. 命令：`git add package.json package-lock.json jest.config.js src/test/setupTests.ts src/utils/__tests__/smoke.test.ts`
2. 命令：`git commit -m "test(viewer): setup jest and rtl infrastructure"`

## Task 2：实现领域类型与纯函数校验（TDD）

文件：
1. 新建：`src/types/digitalTwin.ts`
2. 新建：`src/utils/digitalTwinValidation.ts`
3. 新建：`src/utils/__tests__/digitalTwinValidation.test.ts`

Step 1：先写失败测试（红灯）
1. 在 `digitalTwinValidation.test.ts` 增加用例：
   - 名称/简介为空时 `canProceedNext` 返回 `false`
   - 名称/简介均有值时 `canProceedNext` 返回 `true`
   - `brainType=custom` 时 `canConfirm` 返回 `true`
   - `brainType=internal` 且无 `internalAssistantId` 时 `canConfirm` 返回 `false`
   - `jpg/png` 且 `<2MB` 头像文件通过，其他失败

Step 2：运行测试确认失败
1. 命令：`npm test -- src/utils/__tests__/digitalTwinValidation.test.ts`
2. 预期：因目标模块不存在而失败。

Step 3：写最小实现（绿灯）
1. 在 `digitalTwin.ts` 定义：
   - `BrainType`
   - `InternalAssistantOption`
   - `DefaultAvatarOption`
   - `DigitalTwinFormData`
2. 在 `digitalTwinValidation.ts` 实现：
   - `canProceedNext(name, description)`
   - `canConfirm(brainType, internalAssistantId?)`
   - `validateAvatarFile(file)`（返回 `{ valid: boolean; reason?: string }`）

Step 4：再次运行测试确认通过
1. 命令：`npm test -- src/utils/__tests__/digitalTwinValidation.test.ts`
2. 预期：用例全部通过。

Step 5：提交
1. 命令：`git add src/types/digitalTwin.ts src/utils/digitalTwinValidation.ts src/utils/__tests__/digitalTwinValidation.test.ts`
2. 命令：`git commit -m "feat(viewer): add digital twin types and validation utils"`

## Task 3：实现页面 1 子组件（基础信息）

文件：
1. 新建：`src/components/digital-twin/StepBasicInfo.tsx`
2. 新建：`src/components/digital-twin/__tests__/StepBasicInfo.test.tsx`
3. 新建：`src/components/digital-twin/constants.ts`
4. 修改：`src/styles/DigitalTwinCreator.less`

Step 1：先写失败测试（红灯）
1. 断言点：
   - 初始“下一步”按钮禁用且背景为 `rgba(206,233,255,1)`
   - 填写名称与简介后“下一步”可点击，背景为 `rgba(13,148,255,1)`
   - 点击默认头像后出现选中态 class
   - 上传非法头像文件时显示错误提示

Step 2：运行测试确认失败
1. 命令：`npm test -- src/components/digital-twin/__tests__/StepBasicInfo.test.tsx`
2. 预期：组件不存在导致失败。

Step 3：写最小实现（绿灯）
1. 实现标题区、内容区、按钮区。
2. 在 `constants.ts` 内置默认头像与插画资源路径。
3. 实现头像预览、默认头像选择、自定义上传与格式校验。
4. 点击“取消/关闭”事件先 no-op（保留事件入口）。
5. 实现名称/简介受控输入与下一步启用逻辑。

Step 4：再次运行测试确认通过
1. 命令：`npm test -- src/components/digital-twin/__tests__/StepBasicInfo.test.tsx`
2. 预期：全部用例通过。

Step 5：提交
1. 命令：`git add src/components/digital-twin/StepBasicInfo.tsx src/components/digital-twin/__tests__/StepBasicInfo.test.tsx src/components/digital-twin/constants.ts src/styles/DigitalTwinCreator.less`
2. 命令：`git commit -m "feat(viewer): implement digital twin basic info step"`

## Task 4：实现页面 2 子组件（大脑选择）

文件：
1. 新建：`src/components/digital-twin/StepBrainSelect.tsx`
2. 新建：`src/components/digital-twin/__tests__/StepBrainSelect.test.tsx`
3. 修改：`src/styles/DigitalTwinCreator.less`

Step 1：先写失败测试（红灯）
1. 断言点：
   - 选择“自定义助手”时“确定”可用
   - 选择“内部助手”但未选具体项时“确定”禁用
   - 选择内部助手项后“确定”可用
   - 内部助手项选中态 class、勾选标识显示正确

Step 2：运行测试确认失败
1. 命令：`npm test -- src/components/digital-twin/__tests__/StepBrainSelect.test.tsx`
2. 预期：组件不存在导致失败。

Step 3：写最小实现（绿灯）
1. 实现标题区、插画区、单选区、动态内容区、按钮区。
2. 内部助手选项读取 `constants.ts` 内置数据并渲染 3x2 网格。
3. 实现内部助手选中态。
4. 实现“确定”按钮启用逻辑。
5. 点击“确定”事件先 no-op（保留事件入口）。

Step 4：再次运行测试确认通过
1. 命令：`npm test -- src/components/digital-twin/__tests__/StepBrainSelect.test.tsx`
2. 预期：全部用例通过。

Step 5：提交
1. 命令：`git add src/components/digital-twin/StepBrainSelect.tsx src/components/digital-twin/__tests__/StepBrainSelect.test.tsx src/styles/DigitalTwinCreator.less`
2. 命令：`git commit -m "feat(viewer): implement digital twin brain select step"`

## Task 5：组装主组件并完成独立导出

文件：
1. 新建：`src/components/DigitalTwinCreator.tsx`
2. 新建：`src/components/__tests__/DigitalTwinCreator.test.tsx`
3. 修改：`src/lib/index.ts`
4. 修改：`src/styles/DigitalTwinCreator.less`

Step 1：先写失败测试（红灯）
1. 断言点：
   - 页面 1 完成输入后可进入页面 2
   - 点击关闭后状态不变（no-op）
   - 点击取消后状态不变（no-op）
   - 页面 2 点击确定后状态不变（no-op）
   - 组件从 `src/lib/index.ts` 可被导出

Step 2：运行测试确认失败
1. 命令：`npm test -- src/components/__tests__/DigitalTwinCreator.test.tsx`
2. 预期：主组件或导出不存在导致失败。

Step 3：写最小实现（绿灯）
1. 组装 `StepBasicInfo` 与 `StepBrainSelect`，实现状态提升与步骤切换。
2. 完成 `src/lib/index.ts` 的组件导出（不增加 props 协议）。

Step 4：回归验证
1. 命令：`npm test`
2. 预期：新增测试全部通过。
3. 命令：`npm run lint`
4. 预期：无 lint 报错。
5. 命令：`npx tsc --noEmit`
6. 预期：类型检查通过。
7. 命令：`npm run build:lib`
8. 预期：库构建成功，导出产物更新。

Step 5：提交
1. 命令：`git add src/components/DigitalTwinCreator.tsx src/components/__tests__/DigitalTwinCreator.test.tsx src/lib/index.ts src/styles/DigitalTwinCreator.less`
2. 命令：`git commit -m "feat(viewer): export digital twin creator component"`

## Task 6：人工验收与结果记录

文件：
1. 新建：`docs/acceptance/2026-03-18-digital-twin-creator.md`

Step 1：整理验收清单（来源于 `docs/requirements.md`）
1. 包含页面 1/2 结构、尺寸、交互、禁用态、no-op 行为检查项。

Step 2：本地人工验收
1. 命令：`npm run dev`
2. 预期：组件渲染正常，交互符合需求。

Step 3：记录结果
1. 在验收文档中勾选通过项，并记录发现问题（如有）。

Step 4：提交
1. 命令：`git add docs/acceptance/2026-03-18-digital-twin-creator.md`
2. 命令：`git commit -m "docs(viewer): add digital twin creator acceptance checklist"`


