# Skill SDK for HarmonyOS - 接口调用示例

本文档提供 Skill SDK for HarmonyOS 的完整接口调用示例，涵盖所有 13 个接口的详细使用方法。

## 目录

- [初始化配置](#初始化配置)
- [接口调用示例](#接口调用示例)
  - [1. executeSkill - 执行技能](#1-executeskill---执行技能)
  - [2. closeSkill - 关闭技能](#2-closeskill---关闭技能)
  - [3. stopSkill - 停止技能](#3-stopskill---停止技能)
  - [4. onSessionStatusChange - 会话状态监听](#4-onsessionstatuschange---会话状态监听)
  - [5. onSkillWecodeStatusChange - 小程序状态监听](#5-onskillwecodestatuschange---小程序状态监听)
  - [6. regenerateAnswer - 重新生成回答](#6-regenerateanswer---重新生成回答)
  - [7. sendMessageToIM - 发送消息到 IM](#7-sendmessagetoim---发送消息到-im)
  - [8. getSessionMessage - 获取会话消息](#8-getsessionmessage---获取会话消息)
  - [9. registerSessionListener - 注册会话监听器](#9-registersessionlistener---注册会话监听器)
  - [10. unregisterSessionListener - 移除会话监听器](#10-unregistersessionlistener---移除会话监听器)
  - [11. sendMessage - 发送消息](#11-sendmessage---发送消息)
  - [12. replyPermission - 权限确认](#12-replypermission---权限确认)
  - [13. controlSkillWeCode - 小程序控制](#13-controlskillwecode---小程序控制)
- [完整使用场景](#完整使用场景)
- [错误处理](#错误处理)
- [最佳实践](#最佳实践)

---

## 初始化配置

### 基础初始化

```typescript
import { SkillSDK, SkillSDKConfig } from './sdk';

// 配置 SDK
const config: SkillSDKConfig = {
  baseUrl: 'http://your-server:8082',      // REST API 基础 URL
  wsUrl: 'ws://your-server:8082/ws/skill/stream',  // WebSocket URL
  timeout: 30000,                           // 请求超时时间（毫秒）
  enableLog: true                           // 是否启用日志
};

// 获取 SDK 单例实例
const skillSDK = SkillSDK.getInstance(config);
```

### 在 Ability 中初始化

```typescript
// EntryAbility.ets
import { SkillSDK, SkillSDKConfig } from '../sdk';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    // 初始化 SDK
    const config: SkillSDKConfig = {
      baseUrl: 'http://192.168.1.100:8082',
      wsUrl: 'ws://192.168.1.100:8082/ws/skill/stream',
      enableLog: true
    };
    
    SkillSDK.getInstance(config);
    console.info('Skill SDK initialized');
  }
}
```

---

## 接口调用示例

### 1. executeSkill - 执行技能

执行技能，创建会话并发送首条消息。

```typescript
import { ExecuteSkillParams, SkillSession } from './sdk';

async function executeSkillExample() {
  try {
    const params: ExecuteSkillParams = {
      imChatId: 'chat-789',
      skillDefinitionId: 1,
      userId: 'user-1001',
      skillContent: '请帮我重构登录模块',
      agentId: 99,              // 可选：PCAgent ID
      title: '重构登录模块'      // 可选：会话标题
    };
    
    const session: SkillSession = await skillSDK.executeSkill(params);
    
    console.log('会话创建成功');
    console.log('会话 ID:', session.id);
    console.log('会话状态:', session.status);
    console.log('创建时间:', session.createdAt);
    
    // 保存会话 ID 用于后续操作
    const sessionId = String(session.id);
    
    return sessionId;
  } catch (error) {
    console.error('执行技能失败:', error.message);
    throw error;
  }
}
```

**参数说明**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| imChatId | string | 是 | IM 聊天 ID |
| skillDefinitionId | number | 是 | 技能定义 ID |
| userId | string | 是 | 用户 ID |
| skillContent | string | 是 | 用户输入的技能指令内容 |
| agentId | number | 否 | PCAgent ID |
| title | string | 否 | 会话标题 |

---

### 2. closeSkill - 关闭技能

关闭会话，释放所有相关资源。

```typescript
import { CloseSkillParams, CloseSkillResult } from './sdk';

async function closeSkillExample(sessionId: string) {
  try {
    const params: CloseSkillParams = {
      sessionId: sessionId
    };
    
    const result: CloseSkillResult = await skillSDK.closeSkill(params);
    
    if (result.status === 'success') {
      console.log('会话关闭成功');
      // 清理本地资源
      // ...
    }
    
    return result;
  } catch (error) {
    console.error('关闭会话失败:', error.message);
    throw error;
  }
}
```

---

### 3. stopSkill - 停止技能

停止接收消息，但保持会话连接。

```typescript
import { StopSkillParams, StopSkillResult } from './sdk';

async function stopSkillExample(sessionId: string) {
  try {
    const params: StopSkillParams = {
      sessionId: sessionId
    };
    
    const result: StopSkillResult = await skillSDK.stopSkill(params);
    
    if (result.status === 'success') {
      console.log('技能生成已停止');
      // 会话仍然保持，可以发送新消息继续对话
    }
    
    return result;
  } catch (error) {
    console.error('停止技能失败:', error.message);
    throw error;
  }
}
```

**与 closeSkill 的区别**：

| 特性 | stopSkill | closeSkill |
|------|-----------|------------|
| 会话连接 | 保持连接 | 释放资源 |
| 会话状态 | stopped | closed |
| 后续操作 | 可发送新消息继续对话 | 会话不可恢复 |

---

### 4. onSessionStatusChange - 会话状态监听

监听会话状态变更（执行中、停止、完成）。

```typescript
import { OnSessionStatusChangeParams, SessionStatus } from './sdk';

function setupSessionStatusListener(sessionId: string) {
  const params: OnSessionStatusChangeParams = {
    sessionId: sessionId,
    callback: (result) => {
      switch (result.status) {
        case SessionStatus.EXECUTING:
          console.log('会话状态：执行中');
          // 更新 UI 显示加载状态
          break;
          
        case SessionStatus.STOPPED:
          console.log('会话状态：已停止');
          // 停止加载动画
          break;
          
        case SessionStatus.COMPLETED:
          console.log('会话状态：已完成');
          // 显示完成状态
          break;
      }
    }
  };
  
  skillSDK.onSessionStatusChange(params);
  console.log('会话状态监听器已注册');
}
```

---

### 5. onSkillWecodeStatusChange - 小程序状态监听

监听小程序状态变更（关闭、最小化）。

```typescript
import { OnSkillWecodeStatusChangeParams, SkillWecodeStatus } from './sdk';

function setupWecodeStatusListener() {
  const params: OnSkillWecodeStatusChangeParams = {
    callback: (result) => {
      console.log('小程序状态变更:', result.status);
      console.log('时间戳:', result.timestamp);
      console.log('消息:', result.message);
      
      switch (result.status) {
        case SkillWecodeStatus.CLOSED:
          console.log('小程序已关闭');
          // 上层应用决定是否调用 closeSkill 关闭会话
          break;
          
        case SkillWecodeStatus.MINIMIZED:
          console.log('小程序已最小化');
          // 上层应用决定是否调用 stopSkill 停止 AI 生成
          break;
      }
    }
  };
  
  skillSDK.onSkillWecodeStatusChange(params);
  console.log('小程序状态监听器已注册');
}
```

---

### 6. regenerateAnswer - 重新生成回答

根据提供的内容重新生成回答。

```typescript
import { RegenerateAnswerParams, AnswerResult } from './sdk';

async function regenerateAnswerExample(sessionId: string) {
  try {
    const params: RegenerateAnswerParams = {
      sessionId: sessionId,
      content: '请重新分析这个问题并提供更详细的方案'
    };
    
    const result: AnswerResult = await skillSDK.regenerateAnswer(params);
    
    console.log('重新生成已启动');
    console.log('消息 ID:', result.messageId);
    
    return result;
  } catch (error) {
    console.error('重新生成失败:', error.message);
    throw error;
  }
}
```

---

### 7. sendMessageToIM - 发送消息到 IM

将 AI 生成的消息结果发送到 IM 客户端。

```typescript
import { SendMessageToIMParams, SendMessageToIMResult } from './sdk';

async function sendMessageToIMExample(sessionId: string) {
  try {
    const params: SendMessageToIMParams = {
      sessionId: sessionId,
      content: '代码重构已完成，请查看 PR #42'
    };
    
    const result: SendMessageToIMResult = await skillSDK.sendMessageToIM(params);
    
    if (result.success) {
      console.log('消息已发送到 IM');
      console.log('聊天 ID:', result.chatId);
      console.log('内容长度:', result.contentLength);
    } else {
      console.error('发送失败:', result.errorMessage);
    }
    
    return result;
  } catch (error) {
    console.error('发送消息到 IM 失败:', error.message);
    throw error;
  }
}
```

---

### 8. getSessionMessage - 获取会话消息

获取当前会话的消息列表，支持分页和流式消息合并。

```typescript
import { GetSessionMessageParams, PageResult, ChatMessage } from './sdk';

async function getSessionMessageExample(sessionId: string) {
  try {
    const params: GetSessionMessageParams = {
      sessionId: sessionId,
      page: 0,    // 页码（从 0 开始）
      size: 50    // 每页条数
    };
    
    const result: PageResult<ChatMessage> = await skillSDK.getSessionMessage(params);
    
    console.log('总消息数:', result.totalElements);
    console.log('总页数:', result.totalPages);
    console.log('当前页:', result.number);
    
    // 遍历消息列表
    result.content.forEach((message: ChatMessage) => {
      console.log(`[${message.role}] ${message.content}`);
      console.log(`  - 序号: ${message.seq}`);
      console.log(`  - 类型: ${message.contentType}`);
      console.log(`  - 时间: ${message.createdAt}`);
    });
    
    return result;
  } catch (error) {
    console.error('获取消息列表失败:', error.message);
    throw error;
  }
}
```

---

### 9. registerSessionListener - 注册会话监听器

注册会话监听器，接收 WebSocket 推送的 AI 响应流。

```typescript
import { 
  RegisterSessionListenerParams, 
  StreamMessage, 
  SessionError,
  WebSocketMessageType 
} from './sdk';

function registerSessionListenerExample(sessionId: string) {
  // 定义消息回调
  const onMessage = (message: StreamMessage) => {
    console.log('收到消息 - 会话 ID:', message.sessionId);
    console.log('消息类型:', message.type);
    console.log('序列号:', message.seq);
    
    switch (message.type) {
      case WebSocketMessageType.DELTA:
        // AI 生成的增量内容
        console.log('AI 响应片段:', message.content);
        // 累加显示到 UI
        appendToChatContent(message.content as string);
        break;
        
      case WebSocketMessageType.DONE:
        // AI 处理完成
        console.log('AI 处理完成');
        if (message.usage) {
          console.log('Token 用量:', message.usage);
        }
        // 隐藏加载状态
        hideLoading();
        break;
        
      case WebSocketMessageType.ERROR:
        // 处理错误
        console.error('处理错误:', message.content);
        // 显示错误提示
        showError(message.content as string);
        break;
        
      case WebSocketMessageType.AGENT_OFFLINE:
        // Agent 离线
        console.warn('Agent 离线');
        showWarning('Agent 已离线');
        break;
        
      case WebSocketMessageType.AGENT_ONLINE:
        // Agent 上线
        console.log('Agent 上线');
        showInfo('Agent 已上线');
        break;
    }
  };
  
  // 定义错误回调
  const onError = (error: SessionError) => {
    console.error('WebSocket 错误:', error.code, error.message);
    console.error('时间戳:', new Date(error.timestamp).toLocaleString());
    // 显示错误提示
    showError(`连接错误: ${error.message}`);
  };
  
  // 定义关闭回调
  const onClose = (reason: string) => {
    console.log('WebSocket 连接关闭:', reason);
    // 显示连接关闭提示
    showInfo('连接已关闭');
  };
  
  // 注册监听器
  const params: RegisterSessionListenerParams = {
    sessionId: sessionId,
    onMessage: onMessage,
    onError: onError,
    onClose: onClose
  };
  
  skillSDK.registerSessionListener(params);
  console.log('会话监听器已注册');
  
  // 返回回调函数引用，用于后续移除
  return { onMessage, onError, onClose };
}
```

---

### 10. unregisterSessionListener - 移除会话监听器

移除已注册的会话监听器。

```typescript
import { UnregisterSessionListenerParams } from './sdk';

function unregisterSessionListenerExample(
  sessionId: string,
  callbacks: { onMessage: Function; onError?: Function; onClose?: Function }
) {
  const params: UnregisterSessionListenerParams = {
    sessionId: sessionId,
    onMessage: callbacks.onMessage as any,
    onError: callbacks.onError as any,
    onClose: callbacks.onClose as any
  };
  
  skillSDK.unregisterSessionListener(params);
  console.log('会话监听器已移除');
}
```

---

### 11. sendMessage - 发送消息

发送用户输入的内容，触发 AI 响应。

```typescript
import { SendMessageParams, SendMessageResult } from './sdk';

async function sendMessageExample(sessionId: string, content: string) {
  try {
    const params: SendMessageParams = {
      sessionId: sessionId,
      content: content
    };
    
    const result: SendMessageResult = await skillSDK.sendMessage(params);
    
    console.log('消息发送成功');
    console.log('消息 ID:', result.messageId);
    console.log('消息序号:', result.seq);
    console.log('创建时间:', result.createdAt);
    
    // AI 响应将通过 registerSessionListener 注册的回调接收
    
    return result;
  } catch (error) {
    console.error('发送消息失败:', error.message);
    throw error;
  }
}
```

---

### 12. replyPermission - 权限确认

对 AI 发起的权限确认请求进行批准或拒绝。

```typescript
import { ReplyPermissionParams, ReplyPermissionResult } from './sdk';

async function replyPermissionExample(
  sessionId: string,
  permissionId: string,
  approved: boolean
) {
  try {
    const params: ReplyPermissionParams = {
      sessionId: sessionId,
      permissionId: permissionId,
      approved: approved
    };
    
    const result: ReplyPermissionResult = await skillSDK.replyPermission(params);
    
    if (result.success) {
      console.log('权限回复成功');
      console.log('权限 ID:', result.permissionId);
      console.log('已批准:', result.approved);
    }
    
    return result;
  } catch (error) {
    console.error('权限确认失败:', error.message);
    throw error;
  }
}
```

---

### 13. controlSkillWeCode - 小程序控制

执行小程序的关闭或最小化操作。

```typescript
import { ControlSkillWeCodeParams, ControlSkillWeCodeResult, SkillWeCodeAction } from './sdk';

async function controlSkillWeCodeExample(action: 'close' | 'minimize') {
  try {
    const params: ControlSkillWeCodeParams = {
      action: action === 'close' ? SkillWeCodeAction.CLOSE : SkillWeCodeAction.MINIMIZE
    };
    
    const result: ControlSkillWeCodeResult = await skillSDK.controlSkillWeCode(params);
    
    if (result.status === 'success') {
      console.log(`${action === 'close' ? '关闭' : '最小化'}小程序指令已发送`);
      // SDK 会通过 onSkillWecodeStatusChange 回调通知状态
      // 上层应用在回调中决定是否调用 closeSkill 或 stopSkill
    }
    
    return result;
  } catch (error) {
    console.error('控制小程序失败:', error.message);
    throw error;
  }
}
```

---

## 完整使用场景

### 场景 1：多轮对话

```typescript
import { SkillSDK, SkillSDKConfig, RegisterSessionListenerParams } from './sdk';

class ChatManager {
  private skillSDK: SkillSDK;
  private sessionId: string = '';
  private listenerCallbacks: any = null;
  
  constructor() {
    // 初始化 SDK
    const config: SkillSDKConfig = {
      baseUrl: 'http://192.168.1.100:8082',
      wsUrl: 'ws://192.168.1.100:8082/ws/skill/stream',
      enableLog: true
    };
    this.skillSDK = SkillSDK.getInstance(config);
  }
  
  // 开始新会话
  async startSession(userInput: string): Promise<void> {
    try {
      // 1. 执行技能
      const session = await this.skillSDK.executeSkill({
        imChatId: 'chat-001',
        skillDefinitionId: 1,
        userId: 'user-001',
        skillContent: userInput
      });
      
      this.sessionId = String(session.id);
      console.log('会话创建成功:', this.sessionId);
      
      // 2. 注册监听器
      this.setupListener();
      
      // 3. 注册状态监听
      this.skillSDK.onSessionStatusChange({
        sessionId: this.sessionId,
        callback: (result) => {
          console.log('会话状态:', result.status);
        }
      });
      
    } catch (error) {
      console.error('启动会话失败:', error);
      throw error;
    }
  }
  
  // 设置消息监听器
  private setupListener(): void {
    const onMessage = (message: any) => {
      if (message.type === 'delta') {
        this.appendMessage(message.content);
      } else if (message.type === 'done') {
        this.hideLoading();
      }
    };
    
    const onError = (error: any) => {
      this.showError(error.message);
    };
    
    const onClose = (reason: string) => {
      console.log('连接关闭:', reason);
    };
    
    const params: RegisterSessionListenerParams = {
      sessionId: this.sessionId,
      onMessage,
      onError,
      onClose
    };
    
    this.skillSDK.registerSessionListener(params);
    this.listenerCallbacks = { onMessage, onError, onClose };
  }
  
  // 发送消息
  async sendMessage(content: string): Promise<void> {
    try {
      await this.skillSDK.sendMessage({
        sessionId: this.sessionId,
        content: content
      });
      
      console.log('消息发送成功');
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }
  
  // 获取历史消息
  async getHistory(): Promise<void> {
    try {
      const result = await this.skillSDK.getSessionMessage({
        sessionId: this.sessionId,
        page: 0,
        size: 50
      });
      
      console.log('历史消息:', result.content);
    } catch (error) {
      console.error('获取历史失败:', error);
    }
  }
  
  // 结束会话
  async endSession(): Promise<void> {
    try {
      // 移除监听器
      if (this.listenerCallbacks) {
        this.skillSDK.unregisterSessionListener({
          sessionId: this.sessionId,
          ...this.listenerCallbacks
        });
      }
      
      // 关闭会话
      await this.skillSDK.closeSkill({
        sessionId: this.sessionId
      });
      
      console.log('会话已关闭');
    } catch (error) {
      console.error('关闭会话失败:', error);
    }
  }
  
  // UI 方法（示例）
  private appendMessage(content: string): void {
    // 更新 UI 显示消息
  }
  
  private hideLoading(): void {
    // 隐藏加载状态
  }
  
  private showError(message: string): void {
    // 显示错误提示
  }
}

// 使用示例
const chatManager = new ChatManager();

// 开始会话
await chatManager.startSession('请帮我分析这段代码');

// 发送后续消息
await chatManager.sendMessage('请详细解释一下');

// 获取历史
await chatManager.getHistory();

// 结束会话
await chatManager.endSession();
```

### 场景 2：小程序生命周期管理

```typescript
import { SkillSDK, SkillSDKConfig, SkillWeCodeAction } from './sdk';

class MiniAppManager {
  private skillSDK: SkillSDK;
  private sessionId: string = '';
  
  constructor() {
    const config: SkillSDKConfig = {
      baseUrl: 'http://192.168.1.100:8082',
      wsUrl: 'ws://192.168.1.100:8082/ws/skill/stream'
    };
    this.skillSDK = SkillSDK.getInstance(config);
    
    // 监听小程序状态
    this.setupWecodeListener();
  }
  
  private setupWecodeListener(): void {
    this.skillSDK.onSkillWecodeStatusChange({
      callback: (result) => {
        console.log('小程序状态:', result.status);
        
        if (result.status === 'closed') {
          // 小程序关闭 - 决定是否关闭会话
          this.handleClose();
        } else if (result.status === 'minimized') {
          // 小程序最小化 - 决定是否停止 AI 生成
          this.handleMinimize();
        }
      }
    });
  }
  
  private async handleClose(): Promise<void> {
    // 上层应用决定是否关闭会话
    if (this.sessionId) {
      await this.skillSDK.closeSkill({
        sessionId: this.sessionId
      });
      console.log('会话已关闭');
    }
  }
  
  private async handleMinimize(): Promise<void> {
    // 上层应用决定是否停止 AI 生成
    if (this.sessionId) {
      await this.skillSDK.stopSkill({
        sessionId: this.sessionId
      });
      console.log('AI 生成已停止');
    }
  }
  
  // 关闭小程序
  async closeMiniApp(): Promise<void> {
    await this.skillSDK.controlSkillWeCode({
      action: SkillWeCodeAction.CLOSE
    });
    console.log('关闭指令已发送');
  }
  
  // 最小化小程序
  async minimizeMiniApp(): Promise<void> {
    await this.skillSDK.controlSkillWeCode({
      action: SkillWeCodeAction.MINIMIZE
    });
    console.log('最小化指令已发送');
  }
}
```

---

## 错误处理

### 统一错误处理

```typescript
import { SessionError } from './sdk';

// 错误处理工具函数
function handleSDKError(error: unknown, operation: string): void {
  if (error instanceof Error) {
    console.error(`[${operation}] 错误:`, error.message);
    
    // 根据错误类型进行不同处理
    if (error.message.includes('network')) {
      showError('网络连接失败，请检查网络设置');
    } else if (error.message.includes('timeout')) {
      showError('请求超时，请稍后重试');
    } else if (error.message.includes('not found')) {
      showError('资源不存在');
    } else {
      showError(`操作失败: ${error.message}`);
    }
  }
}

// 使用示例
try {
  await skillSDK.executeSkill(params);
} catch (error) {
  handleSDKError(error, '执行技能');
}
```

### 错误码处理

```typescript
const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_CLOSED: 'SESSION_CLOSED',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  CONTENT_EMPTY: 'CONTENT_EMPTY'
};

function handleErrorCode(error: SessionError): void {
  switch (error.code) {
    case ERROR_CODES.NETWORK_ERROR:
      showError('网络错误，请检查连接');
      break;
      
    case ERROR_CODES.TIMEOUT:
      showError('请求超时，请重试');
      break;
      
    case ERROR_CODES.SESSION_NOT_FOUND:
      showError('会话不存在');
      break;
      
    case ERROR_CODES.SESSION_CLOSED:
      showError('会话已关闭');
      break;
      
    case ERROR_CODES.WEBSOCKET_ERROR:
      showError('连接错误，正在重连...');
      break;
      
    default:
      showError(`错误: ${error.message}`);
  }
}
```

---

## 最佳实践

### 1. 单例模式使用

```typescript
// ✅ 推荐：全局只初始化一次
// 在 Ability 中初始化
SkillSDK.getInstance(config);

// 在其他地方直接使用
const skillSDK = SkillSDK.getInstance();
```

### 2. 监听器管理

```typescript
// ✅ 推荐：保存回调函数引用
const callbacks = {
  onMessage: (msg) => { },
  onError: (err) => { },
  onClose: (reason) => { }
};

skillSDK.registerSessionListener({
  sessionId,
  ...callbacks
});

// 页面卸载时移除
onUnmount(() => {
  skillSDK.unregisterSessionListener({
    sessionId,
    ...callbacks
  });
});
```

### 3. 资源清理

```typescript
// ✅ 推荐：应用退出时清理资源
onDestroy(() => {
  // 移除所有监听器
  // 关闭所有会话
  // 销毁 SDK 实例
  SkillSDK.destroyInstance();
});
```

### 4. 错误重试

```typescript
// ✅ 推荐：实现错误重试机制
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`操作失败，第 ${i + 1} 次重试...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw lastError;
}

// 使用示例
const result = await executeWithRetry(() => 
  skillSDK.executeSkill(params)
);
```

### 5. 状态管理

```typescript
// ✅ 推荐：使用状态管理器
class SkillStateManager {
  private currentSessionId: string = '';
  private isProcessing: boolean = false;
  
  setSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }
  
  getSession(): string {
    return this.currentSessionId;
  }
  
  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }
  
  getProcessing(): boolean {
    return this.isProcessing;
  }
}

const stateManager = new SkillStateManager();
```

---

## 注意事项

1. **单例模式**：SDK 使用单例模式，全局只需初始化一次
2. **WebSocket 单例**：WebSocket 连接也是单例，所有会话共享同一连接
3. **消息缓存**：SDK 自动缓存流式消息，确保不丢失数据
4. **时序安全**：可以在任何时机注册监听器，SDK 保证消息不丢失
5. **资源清理**：应用退出时建议调用 `SkillSDK.destroyInstance()` 清理资源
6. **小程序控制**：`controlSkillWeCode` 仅通知状态，上层应用需管理会话
7. **停止技能**：`stopSkill` 仅停止接收消息，如需完全关闭会话请使用 `closeSkill`

---

## 常见问题

### Q1: WebSocket 连接失败怎么办？

A: 检查以下几点：
- 确认服务器地址和端口正确
- 检查网络连接状态
- 查看服务器日志确认 WebSocket 服务正常运行

### Q2: 如何处理消息丢失？

A: SDK 内部已实现消息缓存机制，确保不丢失消息。如果仍有问题：
- 确保在 `executeSkill` 之前注册监听器
- 检查网络连接稳定性

### Q3: 如何实现断线重连？

A: SDK 内部已实现自动重连机制，无需手动处理。

### Q4: 多个会话如何管理？

A: 使用 `sessionId` 区分不同会话，每个会话独立管理监听器和状态。

---

## 相关文档

- [README.md](./README.md) - SDK 基础文档
- [DEVELOPMENT_SUMMARY.md](./DEVELOPMENT_SUMMARY.md) - 开发总结
- [Skill_SDK_接口文档.md](../Skill_SDK_接口文档.md) - 完整接口文档
