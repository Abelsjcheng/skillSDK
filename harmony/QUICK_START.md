# Skill SDK for HarmonyOS - 快速开始指南

本指南帮助您快速上手 Skill SDK for HarmonyOS。

## 目录

- [环境准备](#环境准备)
- [安装配置](#安装配置)
- [5 分钟快速开始](#5-分钟快速开始)
- [进阶使用](#进阶使用)
- [常见问题](#常见问题)

---

## 环境准备

### 系统要求

- **HarmonyOS API**: 20+
- **DevEco Studio**: 4.0+
- **Node.js**: 14+ (用于构建工具)

### 开发环境

1. 安装 DevEco Studio 4.0 或更高版本
2. 配置 HarmonyOS SDK (API 20+)
3. 确保网络可以访问 Skill 服务端

---

## 安装配置

### 1. 添加 SDK 模块

将 SDK 模块添加到您的 HarmonyOS 项目中：

```
your-project/
├── entry/
├── skill-sdk/          # SDK 模块
│   ├── src/main/ets/
│   ├── build-profile.json5
│   ├── package.json
│   └── ...
└── build-profile.json5
```

### 2. 配置依赖

在 `entry` 模块的 `oh-package.json5` 中添加依赖：

```json
{
  "dependencies": {
    "@skill/sdk": "file:../skill-sdk"
  }
}
```

### 3. 导入 SDK

```typescript
import { SkillSDK, SkillSDKConfig } from '@skill/sdk';
```

---

## 5 分钟快速开始

### 步骤 1: 初始化 SDK

在 Ability 中初始化 SDK：

```typescript
// EntryAbility.ets
import UIAbility from '@ohos.app.ability.UIAbility';
import { SkillSDK, SkillSDKConfig } from '@skill/sdk';

export default class EntryAbility extends UIAbility {
  onCreate(want, launchParam) {
    // 配置 SDK
    const config: SkillSDKConfig = {
      baseUrl: 'http://192.168.1.100:8082',  // 替换为您的服务器地址
      wsUrl: 'ws://192.168.1.100:8082/ws/skill/stream',
      enableLog: true
    };
    
    // 初始化 SDK
    SkillSDK.getInstance(config);
    console.info('Skill SDK 初始化完成');
  }
}
```

### 步骤 2: 创建会话

```typescript
import { SkillSDK } from '@skill/sdk';

async function createSession() {
  try {
    const session = await SkillSDK.getInstance().executeSkill({
      imChatId: 'chat-001',
      skillDefinitionId: 1,
      userId: 'user-001',
      skillContent: '你好，请帮我分析代码'
    });
    
    console.log('会话创建成功:', session.id);
    return String(session.id);
  } catch (error) {
    console.error('创建会话失败:', error);
  }
}
```

### 步骤 3: 接收 AI 响应

```typescript
function setupListener(sessionId: string) {
  const callbacks = {
    onMessage: (message) => {
      if (message.type === 'delta') {
        console.log('AI:', message.content);
        // 更新 UI 显示
      } else if (message.type === 'done') {
        console.log('处理完成');
      }
    },
    onError: (error) => {
      console.error('错误:', error.message);
    },
    onClose: (reason) => {
      console.log('连接关闭:', reason);
    }
  };
  
  SkillSDK.getInstance().registerSessionListener({
    sessionId,
    ...callbacks
  });
  
  return callbacks;
}
```

### 步骤 4: 发送消息

```typescript
async function sendUserMessage(sessionId: string, content: string) {
  try {
    const result = await SkillSDK.getInstance().sendMessage({
      sessionId,
      content
    });
    
    console.log('消息发送成功:', result.messageId);
  } catch (error) {
    console.error('发送失败:', error);
  }
}
```

### 步骤 5: 关闭会话

```typescript
async function closeSession(sessionId: string, callbacks: any) {
  try {
    // 移除监听器
    SkillSDK.getInstance().unregisterSessionListener({
      sessionId,
      ...callbacks
    });
    
    // 关闭会话
    await SkillSDK.getInstance().closeSkill({ sessionId });
    
    console.log('会话已关闭');
  } catch (error) {
    console.error('关闭失败:', error);
  }
}
```

### 完整示例

```typescript
// ChatPage.ets
import { SkillSDK, SkillSDKConfig, RegisterSessionListenerParams } from '@skill/sdk';

@Entry
@Component
struct ChatPage {
  @State messages: string[] = [];
  @State inputText: string = '';
  @State isLoading: boolean = false;
  
  private sessionId: string = '';
  private callbacks: any = null;
  
  aboutToAppear() {
    this.initSession();
  }
  
  aboutToDisappear() {
    this.cleanup();
  }
  
  async initSession() {
    try {
      // 创建会话
      const session = await SkillSDK.getInstance().executeSkill({
        imChatId: 'chat-001',
        skillDefinitionId: 1,
        userId: 'user-001',
        skillContent: '你好'
      });
      
      this.sessionId = String(session.id);
      
      // 注册监听器
      this.callbacks = {
        onMessage: (message) => {
          if (message.type === 'delta') {
            this.messages.push(`AI: ${message.content}`);
          } else if (message.type === 'done') {
            this.isLoading = false;
          }
        },
        onError: (error) => {
          this.messages.push(`错误: ${error.message}`);
          this.isLoading = false;
        },
        onClose: (reason) => {
          this.messages.push(`连接关闭: ${reason}`);
        }
      };
      
      SkillSDK.getInstance().registerSessionListener({
        sessionId: this.sessionId,
        ...this.callbacks
      });
      
    } catch (error) {
      console.error('初始化失败:', error);
    }
  }
  
  async sendMessage() {
    if (!this.inputText.trim()) return;
    
    try {
      this.isLoading = true;
      this.messages.push(`用户: ${this.inputText}`);
      
      await SkillSDK.getInstance().sendMessage({
        sessionId: this.sessionId,
        content: this.inputText
      });
      
      this.inputText = '';
    } catch (error) {
      console.error('发送失败:', error);
      this.isLoading = false;
    }
  }
  
  async cleanup() {
    if (this.callbacks) {
      SkillSDK.getInstance().unregisterSessionListener({
        sessionId: this.sessionId,
        ...this.callbacks
      });
    }
    
    await SkillSDK.getInstance().closeSkill({
      sessionId: this.sessionId
    });
  }
  
  build() {
    Column() {
      // 消息列表
      List() {
        ForEach(this.messages, (message: string) => {
          ListItem() {
            Text(message)
              .width('100%')
              .padding(10)
          }
        })
      }
      .layoutWeight(1)
      
      // 输入框
      Row() {
        TextInput({ placeholder: '输入消息' })
          .layoutWeight(1)
          .onChange((value) => {
            this.inputText = value;
          })
        
        Button('发送')
          .enabled(!this.isLoading)
          .onClick(() => {
            this.sendMessage();
          })
      }
      .padding(10)
    }
  }
}
```

---

## 进阶使用

### 1. 会话状态管理

```typescript
// 监听会话状态
SkillSDK.getInstance().onSessionStatusChange({
  sessionId: this.sessionId,
  callback: (result) => {
    switch (result.status) {
      case 'executing':
        console.log('执行中');
        break;
      case 'stopped':
        console.log('已停止');
        break;
      case 'completed':
        console.log('已完成');
        break;
    }
  }
});
```

### 2. 小程序状态管理

```typescript
// 监听小程序状态
SkillSDK.getInstance().onSkillWecodeStatusChange({
  callback: (result) => {
    if (result.status === 'closed') {
      // 小程序关闭 - 决定是否关闭会话
      SkillSDK.getInstance().closeSkill({
        sessionId: this.sessionId
      });
    } else if (result.status === 'minimized') {
      // 小程序最小化 - 决定是否停止 AI 生成
      SkillSDK.getInstance().stopSkill({
        sessionId: this.sessionId
      });
    }
  }
});

// 控制小程序
await SkillSDK.getInstance().controlSkillWeCode({
  action: 'close'  // 或 'minimize'
});
```

### 3. 获取历史消息

```typescript
async function loadHistory(sessionId: string) {
  const result = await SkillSDK.getInstance().getSessionMessage({
    sessionId,
    page: 0,
    size: 50
  });
  
  console.log('总消息数:', result.totalElements);
  
  result.content.forEach(msg => {
    console.log(`[${msg.role}] ${msg.content}`);
  });
}
```

### 4. 重新生成回答

```typescript
async function regenerate(sessionId: string) {
  const result = await SkillSDK.getInstance().regenerateAnswer({
    sessionId,
    content: '请重新分析并提供更详细的方案'
  });
  
  console.log('重新生成已启动:', result.messageId);
}
```

### 5. 发送消息到 IM

```typescript
async function sendToIM(sessionId: string, content: string) {
  const result = await SkillSDK.getInstance().sendMessageToIM({
    sessionId,
    content
  });
  
  if (result.success) {
    console.log('已发送到 IM:', result.chatId);
  }
}
```

---

## 常见问题

### Q1: 初始化失败怎么办？

**A**: 检查以下几点：
1. 确认服务器地址和端口正确
2. 检查网络连接状态
3. 查看日志输出确认具体错误

```typescript
const config: SkillSDKConfig = {
  baseUrl: 'http://192.168.1.100:8082',  // 确认地址正确
  wsUrl: 'ws://192.168.1.100:8082/ws/skill/stream',
  enableLog: true  // 启用日志
};
```

### Q2: WebSocket 连接失败？

**A**: 
1. 确认 WebSocket 服务正常运行
2. 检查防火墙设置
3. 确认 WebSocket URL 格式正确

### Q3: 消息接收不到？

**A**: 
1. 确保在 `executeSkill` 之后注册监听器
2. 检查监听器回调函数是否正确
3. 查看日志确认消息是否到达

### Q4: 如何处理网络错误？

**A**: SDK 内部已实现错误处理，您可以在回调中处理：

```typescript
const onError = (error) => {
  if (error.code === 'NETWORK_ERROR') {
    // 网络错误处理
    showError('网络连接失败');
  } else if (error.code === 'TIMEOUT') {
    // 超时处理
    showError('请求超时');
  }
};
```

### Q5: 如何实现断线重连？

**A**: SDK 内部已实现自动重连机制，无需手动处理。

### Q6: 多个会话如何管理？

**A**: 使用 `sessionId` 区分不同会话：

```typescript
// 会话 1
const session1 = await skillSDK.executeSkill({ ... });
const sessionId1 = String(session1.id);

// 会话 2
const session2 = await skillSDK.executeSkill({ ... });
const sessionId2 = String(session2.id);

// 分别管理
skillSDK.registerSessionListener({ sessionId: sessionId1, ... });
skillSDK.registerSessionListener({ sessionId: sessionId2, ... });
```

---

## 下一步

- 查看 [EXAMPLES.md](./EXAMPLES.md) 了解更多详细示例
- 查看 [Skill_SDK_接口文档.md](../Skill_SDK_接口文档.md) 了解完整接口说明
- 查看 [skill-server-api.md](../skill-server-api.md) 了解服务端 API

---

## 技术支持

如有问题，请：
1. 查看文档
2. 查看日志输出
3. 联系技术支持团队
