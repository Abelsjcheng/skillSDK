# 助手在线离线状态方案

## 背景与目标

在助手头像右下角显示在线/离线状态图标：
- **在线**：`src/imgs/agent-online.svg`
- **离线**：`src/imgs/agent-offline.svg`

状态数据来源：
1. **初始化时**：先从存储读取，再调用接口更新
2. **onMessage 中**：通过 `agent.online` / `agent.offline` 消息实时更新

---

## 现状分析

### 已有相关代码
- `AvatarImage` 组件可扩展支持在线状态图标
- `StreamMessage` 已有 `agent.online` 和 `agent.offline` 消息类型
- `slashCommandStore.ts` 提供了存储模式参考（memoryStore + 持久化存储）

### 存储模式（参考 slashCommandStore）
```typescript
// slashCommandStore.ts 模式
const memoryStore = new Map<string, T>();
// PC: localStorage, Mobile: HWH5.getStorage/setStorage
// 无过期时间
```

---

## 方案设计

### 1. 类型扩展

#### 1.1 扩展 StreamMessage（增加 partnerAccount）
```typescript
// src/types/index.ts
interface StreamMessage {
  // ... 现有字段
  partnerAccount?: string | null;  // 服务端会填充
}
```

#### 1.2 扩展 WeAgentListItem（增加在线状态）
```typescript
// src/types/bridge/hwext.ts
interface WeAgentListItem {
  // ... 现有字段
  isOnline?: boolean;
}
```

#### 1.3 扩展 ContentProps（传递在线状态）
```typescript
// src/types/components/chat.ts
interface ContentProps {
  // ... 现有字段
  showOnlineStatus?: boolean;  // 默认 false
  isOnline?: boolean;
}
```

---

### 2. 存储设计

#### 2.1 新建 storage.ts 工具模块
```typescript
// src/utils/storage.ts
// 通用持久化存储工具，参考 slashCommandStore 模式
// 支持 PC (localStorage) 和 Mobile (HWH5.getStorage/setStorage)
```

#### 2.2 新建 agentOnlineStatusStore.ts
```typescript
// src/utils/agentOnlineStatusStore.ts

interface AgentOnlineStatusData {
  statuses: Record<string, boolean>;  // { [partnerAccount]: isOnline }
}

const STORAGE_KEY = 'agent_online_status';
const memoryStore = new Map<string, AgentOnlineStatusData>();

export async function readAgentOnlineStatusStore()
export function writeAgentOnlineStatusStore(data: AgentOnlineStatusData)
export function getAgentOnlineStatusFromMemory()
export function clearAgentOnlineStatusMemoryStore()
```

#### 2.3 新建 getOnlineStatus 接口
```typescript
// src/utils/hwext.ts

// API 路径
// src/utils/apiEndpoints.ts
export const API_PATHS = {
  onlineStatus: '/api/skill/sessions/onlinestatus',
};

// getOnlineStatus() - 区分移动端和 PC
export async function getOnlineStatus(): Promise<GetOnlineStatusResult> {
  if (isPcMiniApp()) {
    return getOnlineStatusWithPcBridge();  // PC 返回空
  }
  return getOnlineStatusWithHWH5FetchFull();  // 移动端调用接口
}
```

---

### 3. useAgentOnlineStatus Hook

```typescript
// src/hooks/useAgentOnlineStatus.ts

export function useAgentOnlineStatus() {
  const [agentStatusMap, setAgentStatusMap] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      // 1. 先从存储读取
      const stored = await readAgentOnlineStatusStore();
      if (stored?.statuses) {
        setAgentStatusMap(stored.statuses);
      }

      // 2. 调用接口获取最新数据
      await fetchAllAgentStatus();

      // 3. 设置 isOpen=true
      setIsOpen(true);
    };
    init();
  }, []);

  const fetchAllAgentStatus = useCallback(async () => {
    const result = await getOnlineStatus();
    if (result?.statuses) {
      setAgentStatusMap(result.statuses);
      await writeAgentOnlineStatusStore({ statuses: result.statuses });
    }
  }, []);

  const updateAgentStatus = useCallback(async (partnerAccount: string, isOnline: boolean) => {
    setAgentStatusMap(prev => {
      const next = { ...prev, [partnerAccount]: isOnline };
      writeAgentOnlineStatusStore({ statuses: next });
      return next;
    });
  }, []);

  const resetIsOpen = useCallback(() => setIsOpen(false), []);

  return {
    agentStatusMap,
    isOpen,
    fetchAllAgentStatus,
    updateAgentStatus,
    resetIsOpen,
    getAgentStatus: (partnerAccount: string) => agentStatusMap[partnerAccount]
  };
}
```

---

### 4. useChatSession 修改

```typescript
// src/types/hooks/chatSession.ts

interface UseChatSessionOptions {
  // ... 现有参数
  onAgentStatusChange?: (partnerAccount: string, isOnline: boolean) => void;
  onSessionClose?: () => void;
}

// onMessage 回调中
case 'agent.online':
  agentOfflineHandledRef.current = false;
  onAgentStatusChangeRef.current?.(msg.partnerAccount, true);
  break;
case 'agent.offline':
  agentOfflineHandledRef.current = true;
  setSessionStatus('idle');
  onAgentStatusChangeRef.current?.(msg.partnerAccount, false);
  break;
```

---

### 5. App.tsx 集成

```typescript
// App.tsx
const {
  agentStatusMap,
  isOpen,
  fetchAllAgentStatus,
  updateAgentStatus,
  resetIsOpen,
  getAgentStatus
} = useAgentOnlineStatus();

const session = useChatSession({
  mode: 'weAgentCUI',
  welinkSessionId: welinkSessionId ?? '',
  onAgentStatusChange: (partnerAccount, isOnline) => {
    if (!isOpen) {
      fetchAllAgentStatus().then(() => updateAgentStatus(partnerAccount, isOnline));
    } else {
      updateAgentStatus(partnerAccount, isOnline);
    }
  },
  onSessionClose: () => {
    resetIsOpen();
  }
});

// Content 组件传递 showOnlineStatus={isOpen} isOnline={getAgentStatus(assistantAccount)}
```

---

### 6. 数据流图

```
agentOnlineStatusStore (memoryStore + 持久化)
├── readAgentOnlineStatusStore()
└── writeAgentOnlineStatusStore()
         ↓
┌────────────────────────────────────────┐
│  useAgentOnlineStatus hook             │
│  ├── agentStatusMap                  │
│  ├── isOpen (默认 false)             │
│  ├── fetchAllAgentStatus() → 拉取全量│
│  ├── updateAgentStatus() → 更新并存储 │
│  └── resetIsOpen() → onClose 时调用    │
└────────────────────────────────────────┘
         ↓                        ↓
┌─────────────────┐    ┌─────────────────────────┐
│   App.tsx       │    │   SelectAssistant       │
│                 │    │                         │
│ useChatSession  │    │ 每次 onMount:           │
│   onMessage     │    │   readAgentOnlineStatusStore() │
│   agent.online │    │   fetchAllAgentStatus()    │
│   agent.offline│    │                         │
└─────────────────┘    └─────────────────────────┘
```

---

### 7. isOpen 状态逻辑

- `isOpen` 默认为 `false`
- 当 `registerSessionListener` 收到 `onMessage` 且 `isOpen=false` 时，重新拉取全量数据并设置 `isOpen=true`
- 当 `registerSessionListener` 触发 `onClose` 时，设置 `isOpen=false`
- 防止会话中途打开页面时状态不一致

---

### 8. 待确认事项

| 序号 | 事项 | 状态 |
|------|------|------|
| 1 | 全量在线状态接口（地址、参数、返回格式） | **待定** |
| 2 | agent.online/offline 消息中 partnerAccount 来源 | **服务端会填充** |
| 3 | 图标样式 | 使用现有 `agent-online.svg` / `agent-offline.svg` |
| 4 | 功能开关 | 服务端接口控制，**默认关闭** |
| 5 | PC 端适配 | **不需要不同尺寸**，统一尺寸 |

---

### 9. 关键文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/types/index.ts` | StreamMessage 增加 partnerAccount 字段 |
| `src/types/bridge/hwext.ts` | WeAgentListItem 增加 isOnline；GetOnlineStatusResult/Response 类型 |
| `src/types/hooks/chatSession.ts` | UseChatSessionOptions 增加 onAgentStatusChange/onSessionClose |
| `src/types/components/chat.ts` | ContentProps/MessageBubbleProps/PendingAssistantBubbleProps/AvatarImageProps 增加 showOnlineStatus/isOnline |
| `src/types/assistant.ts` | AssistantItem 增加 isOnline 字段 |
| `src/utils/storage.ts` | **新建**：通用持久化存储工具 |
| `src/utils/agentOnlineStatusStore.ts` | **新建**：助手在线状态存储模块 |
| `src/utils/apiEndpoints.ts` | **修改**：增加 onlineStatus API 路径 |
| `src/utils/hwext.ts` | **修改**：增加 getOnlineStatus() 方法 |
| `src/hooks/useAgentOnlineStatus.ts` | **新建**：助手在线状态管理 hook |
| `src/hooks/useChatSession.ts` | onMessage 中触发 onAgentStatusChange 回调 |
| `src/App.tsx` | 集成 useAgentOnlineStatus |
| `src/components/Content.tsx` | 传递 showOnlineStatus/isOnline 给子组件 |
| `src/components/MessageBubble.tsx` | 传递 showOnlineStatus/isOnline 给 AvatarImage |
| `src/components/PendingAssistantBubble.tsx` | 传递 showOnlineStatus/isOnline 给 AvatarImage |
| `src/components/AvatarImage.tsx` | 渲染在线/离线状态图标 |
| `src/pages/selectAssistant.tsx` | 独立使用 hook，每次 onMount 刷新 |
| `src/imgs/agent-online.svg` | **新建**：在线状态图标 |
| `src/imgs/agent-offline.svg` | **新建**：离线状态图标 |

### 10. 测试文件

| 文件 | 内容 |
|------|------|
| `src/utils/__tests__/agentOnlineStatusStore.test.ts` | **新建**：存储模块测试 |
| `src/utils/__tests__/hwext.test.ts` | **修改**：增加 getOnlineStatus 测试 |

---

### 11. 实现顺序（已完成）

1. ✅ **新建 storage.ts**：通用持久化存储工具
2. ✅ **新建 agentOnlineStatusStore.ts**：存储模块
3. ✅ **类型扩展**：StreamMessage、WeAgentListItem、ContentProps、AssistantItem
4. ✅ **新建 getOnlineStatus 接口**：区分移动端和 PC
5. ✅ **新建 useAgentOnlineStatus hook**：状态管理
6. ✅ **修改 useChatSession**：暴露 onAgentStatusChange 回调
7. ✅ **修改 App.tsx**：集成 hook
8. ✅ **修改 AvatarImage**：渲染图标
9. ✅ **修改 SelectAssistant**：独立使用 hook
10. ✅ **单元测试**：存储模块和 hwext 测试
