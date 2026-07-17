# 助手在线离线状态方案

## 背景与目标

在助手头像右下角显示在线/离线状态图标：
- **在线**：`src/imgs/agent-online.svg`
- **离线**：`src/imgs/agent-offline.svg`

状态数据来源：
1. **初始化时**：先从存储读取，再调用接口更新
2. **onMessage 中**：通过 `agent.online` / `agent.offline` 消息实时更新

---

## 接口规范

### 获取助手在线状态

**URL**: `/api/skill/agent/status`
**Method**: POST

**Request Body**:
```typescript
{
  assistantAccountList: ['partnerAccount1', 'partnerAccount2']
}
```

**Response**:
```typescript
{
  code: 0,
  data: {
    agent: [
      {
        assistantAccount: 'xxx',
        ak: 'xxx',
        online: true/false,
        toolType: 'xxx',
        assistantType: 'business' | 'personal'
      }
    ]
  }
}
```

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

#### 1.2 新增 AgentOnlineStatus 类型
```typescript
// src/types/bridge/hwext.ts
export interface AgentOnlineStatus {
  assistantAccount: string;
  ak: string;
  online: boolean;
  toolType: string;
  assistantType: 'business' | 'personal';
}

export interface GetOnlineStatusResult {
  agent: AgentOnlineStatus[];
}
```

#### 1.3 扩展 ContentProps（传递在线状态）
```typescript
// src/types/components/chat.ts
interface ContentProps {
  // ... 现有字段
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
  onlineStatus: '/api/skill/agent/status',
};

// getOnlineStatus() - 区分移动端和 PC
export async function getOnlineStatus(assistantAccountList: string[]): Promise<GetOnlineStatusResult> {
  if (isPcMiniApp()) {
    return getOnlineStatusWithPcBridge();  // PC 返回空
  }
  return getOnlineStatusWithHWH5FetchFull(assistantAccountList);  // 移动端调用接口
}
```

---

### 3. useAgentOnlineStatus Hook

```typescript
// src/hooks/useAgentOnlineStatus.ts

export interface UseAgentOnlineStatusOptions {
  /** 初始化时是否全量查询在线状态，默认 false */
  fetchOnInit?: boolean;
}

export function useAgentOnlineStatus(options: UseAgentOnlineStatusOptions = {}) {
  const { fetchOnInit = false } = options;
  const [agentStatusMap, setAgentStatusMap] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(false);

  // 从存储读取， optionally 全量查询
  const initAgentOnlineStatus = useCallback(async () => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    // 从存储读取
    const stored = await readAgentOnlineStatusStore();
    if (stored?.statuses) {
      setAgentStatusMap(stored.statuses);
    }

    // 如果配置了 fetchOnInit，则全量查询
    if (fetchOnInit) {
      await fetchAllAgentStatus();
    }
  }, [fetchOnInit]);

  // 手动获取全量数据
  const fetchAllAgentStatus = useCallback(async (assistantList?: WeAgentListItem[]) => {
    try {
      // 如果传入了列表，直接用；否则重新获取
      const list = assistantList ?? (await getWeAgentList(DEFAULT_ASSISTANT_LIST_QUERY)).content;
      const assistantAccountList = list.map((item) => item.partnerAccount);

      const result = await getOnlineStatus(assistantAccountList);
      if (result?.agent) {
        const statuses: Record<string, boolean> = {};
        result.agent.forEach((a) => {
          statuses[a.assistantAccount] = a.online;
        });
        setAgentStatusMap(statuses);
        await writeAgentOnlineStatusStore({ statuses });
      }
    } catch (error) {
      console.error('fetchAllAgentStatus failed:', error);
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
  getAgentStatus,
} = useAgentOnlineStatus({ fetchOnInit: true });

// Content 组件传递 isOnline={getAgentStatus(assistantAccount)}
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
│  ├── fetchAllAgentStatus(list?) → 拉取全量│
│  ├── updateAgentStatus() → 更新并存储 │
│  └── resetIsOpen() → onClose 时调用    │
└────────────────────────────────────────┘
         ↓                        ↓
┌─────────────────┐    ┌─────────────────────────┐
│   App.tsx       │    │   SelectAssistant       │
│                 │    │   SwitchAssistant       │
│ fetchOnInit:true│    │                         │
│ useChatSession  │    │ loadAssistantList() 后  │
│   onMessage     │    │   fetchAllAgentStatus(list) │
│   agent.online │    │                         │
│   agent.offline│    │                         │
└─────────────────┘    └─────────────────────────┘
```

---

### 7. isOpen 状态逻辑

- `isOpen` 默认为 `false`
- 当 `registerSessionListener` 触发 `onClose` 时，设置 `isOpen=false`
- 防止会话中途打开页面时状态不一致

---

### 8. 页面初始化策略

| 页面 | fetchOnInit | 说明 |
|------|-------------|------|
| App.tsx | `true` | 初始化时全量查询助手在线状态 |
| selectAssistant.tsx | `false` | 加载助手列表后手动调用 `fetchAllAgentStatus(list)` |
| switchAssistant.tsx | `false` | 加载助手列表后手动调用 `fetchAllAgentStatus(list)` |

---

### 9. 待确认事项

| 序号 | 事项 | 状态 |
|------|------|------|
| 1 | 全量在线状态接口（地址、参数、返回格式） | **已完成** |
| 2 | agent.online/offline 消息中 partnerAccount 来源 | **服务端会填充** |
| 3 | 图标样式 | 使用现有 `agent-online.svg` / `agent-offline.svg` |
| 4 | 功能开关 | **已移除**，始终显示在线状态 |
| 5 | PC 端适配 | **不需要不同尺寸**，统一尺寸 |

---

### 10. 关键文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/types/index.ts` | StreamMessage 增加 partnerAccount 字段 |
| `src/types/bridge/hwext.ts` | AgentOnlineStatus 类型、GetOnlineStatusResult 改为 agent 数组 |
| `src/types/hooks/chatSession.ts` | UseChatSessionOptions 增加 onAgentStatusChange/onSessionClose |
| `src/types/components/chat.ts` | ContentProps/MessageBubbleProps/PendingAssistantBubbleProps/AvatarImageProps 移除 showOnlineStatus |
| `src/types/components/assistant.ts` | AssistantCardListProps/AssistantSelectionPageProps 移除 showOnlineStatus |
| `src/types/assistant.ts` | AssistantItem 增加 isOnline 字段 |
| `src/utils/storage.ts` | **新建**：通用持久化存储工具 |
| `src/utils/agentOnlineStatusStore.ts` | **新建**：助手在线状态存储模块 |
| `src/utils/apiEndpoints.ts` | **修改**：onlineStatus 路径改为 `/api/skill/agent/status` |
| `src/utils/hwext.ts` | **修改**：getOnlineStatus 接受 assistantAccountList 参数，改为 POST |
| `src/hooks/useAgentOnlineStatus.ts` | **新建**：助手在线状态管理 hook，增加 fetchOnInit 选项 |
| `src/hooks/useChatSession.ts` | onMessage 中触发 onAgentStatusChange 回调 |
| `src/App.tsx` | 集成 useAgentOnlineStatus，传入 fetchOnInit: true |
| `src/components/Content.tsx` | 传递 isOnline 给子组件，移除 showOnlineStatus |
| `src/components/MessageBubble.tsx` | 传递 isOnline 给 AvatarImage，移除 showOnlineStatus |
| `src/components/PendingAssistantBubble.tsx` | 传递 isOnline 给 AvatarImage，移除 showOnlineStatus |
| `src/components/AvatarImage.tsx` | 始终显示在线/离线图标，移除 showOnlineStatus 逻辑 |
| `src/components/assistant/AssistantCardList.tsx` | 移除 showOnlineStatus prop |
| `src/components/assistant/AssistantSelectionPage.tsx` | 移除 showOnlineStatus prop |
| `src/pages/selectAssistant.tsx` | 加载列表后调用 fetchAllAgentStatus(list) |
| `src/pages/switchAssistant.tsx` | 加载列表后调用 fetchAllAgentStatus(list) |
| `src/imgs/agent-online.svg` | **新建**：在线状态图标 |
| `src/imgs/agent-offline.svg` | **新建**：离线状态图标 |

### 11. 测试文件

| 文件 | 内容 |
|------|------|
| `src/utils/__tests__/agentOnlineStatusStore.test.ts` | **新建**：存储模块测试 |
| `src/utils/__tests__/hwext.test.ts` | **修改**：getOnlineStatus 测试适配新接口 |

---

### 12. 实现顺序（已完成）

1. ✅ **新建 storage.ts**：通用持久化存储工具
2. ✅ **新建 agentOnlineStatusStore.ts**：存储模块
3. ✅ **类型扩展**：StreamMessage、AgentOnlineStatus、ContentProps、AssistantItem
4. ✅ **新建 getOnlineStatus 接口**：区分移动端和 PC，支持 POST body
5. ✅ **新建 useAgentOnlineStatus hook**：状态管理，增加 fetchOnInit 选项
6. ✅ **修改 useChatSession**：暴露 onAgentStatusChange 回调
7. ✅ **修改 App.tsx**：集成 hook，传入 fetchOnInit: true
8. ✅ **修改 AvatarImage**：始终渲染在线/离线图标
9. ✅ **修改 SelectAssistant/SwitchAssistant**：加载列表后调用 fetchAllAgentStatus
10. ✅ **移除 showOnlineStatus**：始终显示在线状态
11. ✅ **单元测试**：存储模块和 hwext 测试适配新接口
