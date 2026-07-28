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
  data: [
    {
      assistantAccount: 'xxx',
      status: 'ONLINE' | 'OFFLINE'
    }
  ]
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

#### 1.1 扩展 StreamMessage（增加 assistantAccount）
```typescript
// src/types/index.ts
interface StreamMessage {
  // ... 现有字段
  assistantAccount?: string | null;  // 服务端会填充
}
```

#### 1.2 GetOnlineStatusResult 类型
```typescript
// src/types/bridge/hwext.ts
export interface GetOnlineStatusResult {
  assistantAccount: string;
  status: 'ONLINE' | 'OFFLINE';
}

export interface GetOnlineStatusResponse {
  code: number;
  data: GetOnlineStatusResult[];
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
  statuses: Record<string, boolean>;  // { [assistantAccount]: isOnline }
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
export async function getOnlineStatus(assistantAccountList: string[]): Promise<GetOnlineStatusResult[]> {
  if (isPcMiniApp()) {
    return getOnlineStatusWithPcBridge();  // PC 返回空数组
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

const SESSION_ID = 'config_agent';

export function useAgentOnlineStatus(options: UseAgentOnlineStatusOptions = {}) {
  const { fetchOnInit = false } = options;
  const [agentStatusMap, setAgentStatusMap] = useState<Record<string, boolean>>({});
  const isOpenRef = useRef(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  // 更新单个助手状态（写入存储）
  const updateAgentStatus = useCallback(async (assistantAccount: string, isOnline: boolean) => {
    setAgentStatusMap((prev) => {
      const next = { ...prev, [assistantAccount]: isOnline };
      writeAgentOnlineStatusStore({ statuses: next });
      return next;
    });
  }, []);

  // 手动获取全量数据
  const fetchAllAgentStatus = useCallback(async (assistantList?: WeAgentListItem[]) => {
    // 检查功能开关
    if (!await canIUse.weAgentOnline()) {
      showOnlineStatus && setShowOnlineStatus(false);
      return;
    }

    // 如果传入了列表，直接用；否则重新获取
    const list = assistantList ?? (await getWeAgentList(DEFAULT_ASSISTANT_LIST_QUERY)).content;
    const assistantAccountList = list.map((item) => item.assistantAccount);

    const result = await getOnlineStatus(assistantAccountList);
    if (result && result.length > 0) {
      const statuses: Record<string, boolean> = {};
      result.forEach((a) => {
        statuses[a.assistantAccount] = a.status === 'ONLINE';
      });
      setAgentStatusMap(statuses);
      writeAgentOnlineStatusStore({ statuses });
    }
  }, []);

  // 初始化：从存储读取， optionally 全量查询
  const initAgentOnlineStatus = useCallback(async () => {
    // 检查功能开关
    if (!await canIUse.weAgentOnline()) {
      showOnlineStatus && setShowOnlineStatus(false);
      return;
    }

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

  const streamOnMessage = useCallback((msg: StreamMessage) => {
    if (!isOpenRef.current) {
      isOpenRef.current = true;
      fetchAllAgentStatus();
    }
    if (msg.type === 'agent.online') {
      updateAgentStatus(msg.assistantAccount ?? '', true);
    } else if (msg.type === 'agent.offline') {
      updateAgentStatus(msg.assistantAccount ?? '', false);
    }
  }, [isOpenRef, updateAgentStatus, fetchAllAgentStatus]);

  const streamOnClose = useCallback(() => {
    resetIsOpen();
  }, []);

  const onlineStatusRegister = useCallback(() => {
    isOpenRef.current = true;
    registerSessionListener({
      welinkSessionId: SESSION_ID,
      onMessage: streamOnMessage,
      onClose: streamOnClose,
    });
  }, []);

  // 注册 App 生命周期
  useEffect(() => {
    initAgentOnlineStatus();
    onlineStatusRegister();

    if (isPcMiniApp()) {
      // PC 端监听自定义事件
      const handleAgentLogin = () => {
        fetchAllAgentStatus();
      };
      window.addEventListener('agent_login', handleAgentLogin);
      return () => {
        window.removeEventListener('agent_login', handleAgentLogin);
        unregisterSessionListener({ welinkSessionId: SESSION_ID });
      };
    }
    // 移动端只注册一次
  }, []);

  const resetIsOpen = useCallback(() => { isOpenRef.current = false; }, []);

  return {
    agentStatusMap,
    fetchAllAgentStatus,
    updateAgentStatus,
    resetIsOpen,
    getAgentStatus: (assistantAccount: string) => agentStatusMap[assistantAccount],
    streamOnClose,
    streamOnMessage,
    showOnlineStatus
  };
}
```

---

### 4. useChatSession 修改

```typescript
// src/types/hooks/chatSession.ts

interface UseChatSessionOptions {
  // ... 现有参数
  onAgentStatusChange?: (assistantAccount: string, isOnline: boolean) => void;
  onSessionClose?: () => void;
}

// onMessage 回调中
case 'agent.online':
  agentOfflineHandledRef.current = false;
  onAgentStatusChangeRef.current?.(msg.assistantAccount, true);
  break;
case 'agent.offline':
  agentOfflineHandledRef.current = true;
  setSessionStatus('idle');
  onAgentStatusChangeRef.current?.(msg.assistantAccount, false);
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
│  ├── isOpenRef (ref)                │
│  ├── showOnlineStatus (state)       │
│  ├── fetchAllAgentStatus(list?) → 拉取全量│
│  ├── updateAgentStatus() → 更新并存储 │
│  ├── streamOnMessage() → 消息回调   │
│  └── streamOnClose() → 关闭回调     │
└────────────────────────────────────────┘
         ↓                        ↓
┌─────────────────┐    ┌─────────────────────────┐
│   App.tsx       │    │   SelectAssistant       │
│                 │    │   SwitchAssistant       │
│ fetchOnInit:true│    │                         │
│ onlineStatus   │    │ loadAssistantList() 后  │
│ Register()      │    │   fetchAllAgentStatus(list) │
│ agent_login     │    │                         │
└─────────────────┘    └─────────────────────────┘
```

---

### 7. 功能开关

- 使用 `canIUse.weAgentOnline()` 检查功能是否支持
- 不支持时设置 `showOnlineStatus = false`，隐藏在线状态图标
- 功能开关在 `initAgentOnlineStatus` 和 `fetchAllAgentStatus` 中检查

---

### 8. 页面初始化策略

| 页面 | fetchOnInit | 说明 |
|------|-------------|------|
| App.tsx | `true` | 初始化时全量查询助手在线状态 |
| selectAssistant.tsx | `false` | 加载助手列表后手动调用 `fetchAllAgentStatus(list)` |
| switchAssistant.tsx | `false` | 加载助手列表后手动调用 `fetchAllAgentStatus(list)` |

---

### 9. 日志节点

| 文件 | 日志内容 |
|------|---------|
| **useAgentOnlineStatus.ts** | |
| | `[AgentStatus] initAgentOnlineStatus start` - 初始化开始 |
| | `[AgentStatus] initAgentOnlineStatus from storage` / `no storage data` - 存储读取结果 |
| | `[AgentStatus] initAgentOnlineStatus weAgentOnline feature not supported` - 功能不支持 |
| | `[AgentStatus] fetchAllAgentStatus` - 获取开始，含助手数量 |
| | `[AgentStatus] fetchAllAgentStatus success` - 获取成功，更新数量 |
| | `[AgentStatus] fetchAllAgentStatus failed` - 失败错误 |
| | `[AgentStatus] update status` - 单个状态更新 |
| | `[AgentStatus] registerSessionListener` - 注册监听 |
| | `[AgentStatus] onMessage` - 收到消息，含 type 和 assistantAccount |
| | `[AgentStatus] onClose` - 会话关闭 |
| **hwext.ts** | |
| | `[AgentStatus] getOnlineStatus request` - 请求发出，含助手数量 |
| | `[AgentStatus] getOnlineStatus response` - 响应结果，含 code 和数量 |
| | `[AgentStatus] getOnlineStatus failed` - 请求失败 |

---

### 10. 待确认事项

| 序号 | 事项 | 状态 |
|------|------|------|
| 1 | 全量在线状态接口（地址、参数、返回格式） | **已完成** |
| 2 | agent.online/offline 消息中 assistantAccount 来源 | **服务端会填充** |
| 3 | 图标样式 | 使用现有 `agent-online.svg` / `agent-offline.svg` |
| 4 | 功能开关 | 使用 `canIUse.weAgentOnline()` 检查 |
| 5 | PC 端适配 | **不需要不同尺寸**，统一尺寸 |

---

### 11. 关键文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/types/index.ts` | StreamMessage 增加 assistantAccount 字段 |
| `src/types/bridge/hwext.ts` | GetOnlineStatusResult 改为 status: 'ONLINE'/'OFFLINE' 数组 |
| `src/types/hooks/chatSession.ts` | UseChatSessionOptions 增加 onAgentStatusChange/onSessionClose |
| `src/types/components/chat.ts` | ContentProps/MessageBubbleProps/PendingAssistantBubbleProps 增加 showOnlineStatus |
| `src/types/components/assistant.ts` | AssistantCardListProps/AssistantSelectionPageProps 移除 showOnlineStatus |
| `src/types/assistant.ts` | AssistantItem 增加 isOnline 字段 |
| `src/utils/storage.ts` | **新建**：通用持久化存储工具 |
| `src/utils/agentOnlineStatusStore.ts` | **新建**：助手在线状态存储模块 |
| `src/utils/apiEndpoints.ts` | **修改**：onlineStatus 路径改为 `/api/skill/agent/status` |
| `src/utils/hwext.ts` | **修改**：getOnlineStatus 接受 assistantAccountList 参数，改为 POST |
| `src/utils/versionCheck.ts` | **修改**：增加 canIUse.weAgentOnline() 功能开关检查 |
| `src/hooks/useAgentOnlineStatus.ts` | **新建**：助手在线状态管理 hook，增加 fetchOnInit/showOnlineStatus 选项 |
| `src/hooks/useChatSession.ts` | onMessage 中触发 onAgentStatusChange 回调 |
| `src/App.tsx` | 集成 useAgentOnlineStatus，传入 fetchOnInit: true |
| `src/components/Content.tsx` | 传递 isOnline/showOnlineStatus 给子组件 |
| `src/components/MessageBubble.tsx` | 传递 isOnline/showOnlineStatus 给 AvatarImage |
| `src/components/PendingAssistantBubble.tsx` | 传递 isOnline/showOnlineStatus 给 AvatarImage |
| `src/components/AvatarImage.tsx` | 根据 showOnlineStatus 显示在线/离线图标 |
| `src/components/assistant/AssistantCardList.tsx` | 传递 showOnlineStatus=true 给 AvatarImage |
| `src/components/assistant/AssistantSelectionPage.tsx` | 移除 showOnlineStatus prop |
| `src/pages/selectAssistant.tsx` | 加载列表后调用 fetchAllAgentStatus(list) |
| `src/pages/switchAssistant.tsx` | 加载列表后调用 fetchAllAgentStatus(list) |
| `src/imgs/agent-online.svg` | **新建**：在线状态图标 |
| `src/imgs/agent-offline.svg` | **新建**：离线状态图标 |

### 12. 测试文件

| 文件 | 内容 |
|------|------|
| `src/utils/__tests__/agentOnlineStatusStore.test.ts` | **新建**：存储模块测试 |
| `src/utils/__tests__/hwext.test.ts` | **修改**：getOnlineStatus 测试适配新接口 |
| `src/hooks/__tests__/useAgentOnlineStatus.test.tsx` | **新建**：hook 测试 |

---

### 13. 实现顺序（已完成）

1. ✅ **新建 storage.ts**：通用持久化存储工具
2. ✅ **新建 agentOnlineStatusStore.ts**：存储模块
3. ✅ **类型扩展**：StreamMessage、GetOnlineStatusResult、ContentProps、AssistantItem
4. ✅ **新建 getOnlineStatus 接口**：区分移动端和 PC，支持 POST body
5. ✅ **新建 useAgentOnlineStatus hook**：状态管理，增加 fetchOnInit/showOnlineStatus 选项
6. ✅ **修改 useChatSession**：暴露 onAgentStatusChange 回调
7. ✅ **修改 App.tsx**：集成 hook，传入 fetchOnInit: true
8. ✅ **修改 AvatarImage**：根据 showOnlineStatus 显示在线/离线图标
9. ✅ **修改 SelectAssistant/SwitchAssistant**：加载列表后调用 fetchAllAgentStatus
10. ✅ **功能开关**：使用 canIUse.weAgentOnline() 检查
11. ✅ **日志添加**：关键节点添加日志
12. ✅ **单元测试**：存储模块、hwext、hook 测试

---

### 14. 测试建议

#### 14.1 手动测试场景

| 场景 | 测试步骤 | 预期结果 |
|------|---------|---------|
| **助手列表显示** | 进入选择助手页面 | 头像右下角显示在线/离线图标 |
| **全量刷新** | 切换到助手页面 | 自动调用接口刷新在线状态 |
| **实时更新** | 助手下线时 | 图标从绿色变为灰色 |
| **功能开关关闭** | 客户端不支持时 | 不显示在线状态图标 |
| **PC 端适配** | 在 PC 端进入助手页面 | 正常显示，不调用接口 |

#### 14.2 日志验证

通过日志 `[AgentStatus]` 过滤，可验证以下流程：

```
# 初始化流程
[AgentStatus] initAgentOnlineStatus start
[AgentStatus] initAgentOnlineStatus from storage | count=3  # 从存储读取
[AgentStatus] initAgentOnlineStatus fetchOnInit=true, calling fetchAllAgentStatus
[AgentStatus] fetchAllAgentStatus | count=5  # 开始获取
[AgentStatus] getOnlineStatus request | count=5  # API 请求
[AgentStatus] getOnlineStatus response | code=0 | count=5  # API 返回
[AgentStatus] fetchAllAgentStatus success | updated=5  # 更新成功

# 实时消息流程
[AgentStatus] onMessage | type=agent.offline | assistantAccount=xxx  # 收到下线消息
[AgentStatus] update status | assistantAccount=xxx | isOnline=false  # 状态更新

# 错误流程
[AgentStatus] fetchAllAgentStatus failed | error=...  # 失败日志
[AgentStatus] getOnlineStatus failed | code=xxx  # API 错误
```

#### 14.3 边界条件

| 条件 | 测试场景 |
|------|---------|
| 空列表 | `assistantAccountList=[]` 时接口调用 |
| 部分在线 | 3个助手，1个在线2个离线 |
| 网络错误 | 接口返回非0 code |
| 存储为空 | 首次进入，无缓存数据 |
| 功能不支持 | `canIUse.weAgentOnline()` 返回 false |
