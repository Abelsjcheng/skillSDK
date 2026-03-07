# Skill SDK for HarmonyOS

鸿蒙 ArkTS SDK，用于 IM 客户端、OpenCode Skill 服务端、小程序间交互。

## 文档导航

- **[QUICK_START.md](./QUICK_START.md)** - 快速开始指南（5 分钟上手）
- **[EXAMPLES.md](./EXAMPLES.md)** - 完整的接口调用示例和使用文档
- **[API_REFERENCE.md](./API_REFERENCE.md)** - API 参考文档
- **[DEVELOPMENT_SUMMARY.md](./DEVELOPMENT_SUMMARY.md)** - 开发总结
- **[Skill_SDK_接口文档.md](../Skill_SDK_接口文档.md)** - 完整接口文档

## 版本要求

- HarmonyOS API 20+
- DevEco Studio 4.0+

## 特性

- ✅ 单例模式设计
- ✅ WebSocket流式消息推送
- ✅ REST API封装
- ✅ 消息缓存机制
- ✅ 会话状态管理
- ✅ 完整的TypeScript类型支持

## 安装

将SDK模块添加到您的HarmonyOS项目中：

```typescript
import { SkillSDK } from './sdk/SkillSDK';
```

## 快速开始

### 1. 初始化SDK

```typescript
import { SkillSDK, SkillSDKConfig } from './sdk';

// 初始化配置
const config: SkillSDKConfig = {
  baseUrl: 'http://your-server:8082',
  wsUrl: 'ws://your-server:8082/ws/skill/stream',
  timeout: 30000,
  enableLog: true
};

// 获取单例实例
const skillSDK = SkillSDK.getInstance(config);
```

### 2. 执行技能

```typescript
import { ExecuteSkillParams } from './sdk';

try {
  const session = await skillSDK.executeSkill({
    imChatId: 'chat-789',
    skillDefinitionId: 1,
    userId: 'user-1001',
    skillContent: '请帮我重构登录模块',
    agentId: 99,           // 可选
    title: '重构登录模块'    // 可选
  });
  
  console.log('会话创建成功:', session.id);
  console.log('会话状态:', session.status);
} catch (error) {
  console.error('执行技能失败:', error.message);
}
```

### 3. 注册会话监听器

```typescript
// 定义回调函数
const onMessage = (message) => {
  switch (message.type) {
    case 'delta':
      console.log('AI响应片段:', message.content);
      break;
    case 'done':
      console.log('AI处理完成');
      break;
    case 'error':
      console.error('处理错误:', message.content);
      break;
  }
};

const onError = (error) => {
  console.error('连接错误:', error.code, error.message);
};

const onClose = (reason) => {
  console.log('连接关闭:', reason);
};

// 注册监听器
skillSDK.registerSessionListener({
  sessionId: '42',
  onMessage,
  onError,
  onClose
});
```

### 4. 发送消息

```typescript
try {
  const result = await skillSDK.sendMessage({
    sessionId: '42',
    content: '请帮我重构登录模块的校验逻辑'
  });
  
  console.log('消息发送成功，消息ID:', result.messageId);
} catch (error) {
  console.error('发送消息失败:', error.message);
}
```

### 5. 获取会话消息列表

```typescript
try {
  const result = await skillSDK.getSessionMessage({
    sessionId: '42',
    page: 0,
    size: 50
  });
  
  console.log('总消息数:', result.totalElements);
  result.content.forEach(message => {
    console.log(`[${message.role}] ${message.content}`);
  });
} catch (error) {
  console.error('获取消息列表失败:', error.message);
}
```

### 6. 关闭会话

```typescript
try {
  const result = await skillSDK.closeSkill({ sessionId: '42' });
  
  if (result.status === 'success') {
    console.log('会话关闭成功');
  }
} catch (error) {
  console.error('关闭会话失败:', error.message);
}
```

## API接口列表

### 1. executeSkill
执行技能，创建会话并发送首条消息。

### 2. closeSkill
关闭会话，释放资源。

### 3. stopSkill
停止会话，保持连接但停止接收消息。

### 4. onSessionStatusChange
监听会话状态变更（执行中、停止、完成）。

### 5. onSkillWecodeStatusChange
监听小程序状态变更（关闭、最小化）。

### 6. regenerateAnswer
重新生成回答。

### 7. sendMessageToIM
发送消息到IM客户端。

### 8. getSessionMessage
获取会话消息列表（支持分页和流式消息合并）。

### 9. registerSessionListener
注册会话监听器，接收WebSocket推送消息。

### 10. unregisterSessionListener
移除会话监听器。

### 11. sendMessage
发送用户消息，触发AI响应。

### 12. replyPermission
回复权限确认请求。

### 13. controlSkillWeCode
控制小程序（关闭/最小化）。

## 项目结构

```
harmony/
└── src/main/ets/
    ├── index.ets                      # SDK入口文件
    └── sdk/
        ├── SkillSDK.ets               # 主类（单例）
        ├── types/
        │   └── index.ets              # 类型定义
        ├── core/
        │   ├── HttpClient.ets         # HTTP客户端
        │   └── WebSocketManager.ets   # WebSocket管理器
        ├── managers/
        │   ├── MessageCacheManager.ets       # 消息缓存管理
        │   ├── SessionStateManager.ets       # 会话状态管理
        │   └── WeCodeStateManager.ets        # 小程序状态管理
        └── utils/
            ├── Validator.ets          # 参数验证工具
            └── Logger.ets             # 日志工具
```

## WebSocket消息类型

SDK支持以下WebSocket消息类型：

| 类型 | 说明 | 触发行为 |
|------|------|----------|
| `delta` | AI生成的增量内容 | 累加到流式消息缓存 |
| `done` | AI处理完成 | 标记流式消息完成 |
| `error` | 处理错误 | 清理缓存，停止会话 |
| `agent_offline` | Agent离线 | 会话状态变更为stopped |
| `agent_online` | Agent上线 | 会话状态变更为executing |

## 错误处理

SDK统一使用Error对象抛出异常：

```typescript
try {
  await skillSDK.executeSkill({ ... });
} catch (error) {
  if (error instanceof Error) {
    console.error('错误信息:', error.message);
  }
}
```

## 配置选项

| 选项 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| baseUrl | string | 是 | - | REST API基础URL |
| wsUrl | string | 是 | - | WebSocket URL |
| timeout | number | 否 | 30000 | 请求超时时间（毫秒） |
| enableLog | boolean | 否 | false | 是否启用日志 |

## 注意事项

1. **单例模式**：SDK使用单例模式，全局只需初始化一次。
2. **WebSocket单例**：WebSocket连接也是单例，所有会话共享同一连接。
3. **消息缓存**：SDK自动缓存流式消息，确保不丢失数据。
4. **时序安全**：可以在任何时机注册监听器，SDK保证消息不丢失。
5. **资源清理**：应用退出时建议调用 `SkillSDK.destroyInstance()` 清理资源。

## 许可证

MIT License