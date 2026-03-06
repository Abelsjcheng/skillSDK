## `message.updated`

- 稳定性: `contracted`
- 端点可见性: `/event`, `/global/event`
- payload（结构化示例，非完整字段）:

```json
{
  "type": "message.updated",
  "properties": {
    "info": "<Message>"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `properties.info.id` | `string` | 消息 ID |
| `properties.info.sessionID` | `string` | 所属会话 ID |
| `properties.info.role` | `"user" | "assistant"` | 消息角色 |
| `properties.info.time.created` | `number` | 消息创建时间（毫秒） |
| `properties.info.time.completed` | `number?` | 消息完成时间（毫秒） |
| `properties.info.finish` | `string?` | 模型完成原因（完成阶段常见） |
| `properties.info.tokens` | `object?` | token 收敛统计（assistant 消息常见） |
| `properties.info.cost` | `number?` | 成本（assistant 消息常见） |

- 字段判定矩阵（基于 `Message = UserMessage | AssistantMessage`）:

| 字段 | 适用范围 | 判定 | 说明 |
| --- | --- | --- |
| `properties.info.parentID` | `assistant` | 条件必填（assistant） | 上游消息 ID |
| `properties.info.modelID` | `assistant` | 条件必填（assistant） | 实际使用模型 ID |
| `properties.info.providerID` | `assistant` | 条件必填（assistant） | 模型提供商 ID |
| `properties.info.mode` | `assistant` | 条件必填（assistant） | 响应模式 |
| `properties.info.agent` | `user` + `assistant` | 契约必填 | 处理该消息的 agent 标识 |
| `properties.info.model.providerID` | `user` | 条件必填（user） | 用户消息模型提供商 ID（`UserMessage.model`） |
| `properties.info.model.modelID` | `user` | 条件必填（user） | 用户消息模型 ID（`UserMessage.model`） |
| `properties.info.system` | `user` | 可选 | 用户消息的系统提示词 |
| `properties.info.tools` | `user` | 可选 | 用户消息携带的工具开关映射 |
| `properties.info.path.cwd` | `assistant` | 条件必填（assistant） | 执行上下文工作目录 |
| `properties.info.path.root` | `assistant` | 条件必填（assistant） | 执行上下文根目录 |
| `properties.info.tokens.input/output/reasoning` | `assistant` | 条件必填（assistant） | token 统计；常在完成阶段收敛为最终值 |
| `properties.info.tokens.cache.read/write` | `assistant` | 条件必填（assistant） | 缓存 token 读写统计 |
| `properties.info.error` | `assistant` | 可选 | 失败场景错误对象 |

- 报文示例（结构化示例）:

```json
{
  "type": "message.updated",
  "properties": {
    "info": {
      "id": "msg_001",
      "sessionID": "ses_001",
      "role": "assistant",
      "parentID": "msg_user_001",
      "modelID": "claude-3-5-sonnet",
      "providerID": "anthropic",
      "mode": "chat",
      "agent": "build",
      "path": {
        "cwd": "/repo",
        "root": "/repo"
      },
      "cost": 0,
      "tokens": {
        "input": 0,
        "output": 0,
        "reasoning": 0,
        "cache": {
          "read": 0,
          "write": 0
        }
      },
      "time": {
        "created": 1772593200000
      }
    }
  }
}
```

该示例为 `AssistantMessage` 分支。`UserMessage` 最小结构示意（结构化示例）：

```json
{
  "type": "message.updated",
  "properties": {
    "info": {
      "id": "msg_user_001",
      "sessionID": "ses_001",
      "role": "user",
      "time": {
        "created": 1772593199000
      },
      "agent": "build",
      "model": {
        "providerID": "anthropic",
        "modelID": "claude-3-5-sonnet"
      }
    }
  }
}
```

- 触发方式: 消息创建或消息级状态更新。

## `message.removed`

- 稳定性: `contracted`
- 端点可见性: `/event`, `/global/event`
- payload: 

```json
{
  "type": "message.removed",
  "properties": {
    "sessionID": "string",
    "messageID": "string"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `properties.sessionID` | `string` | 会话 ID |
| `properties.messageID` | `string` | 被删除消息 ID |

- 报文示例（结构化示例）:

```json
{
  "type": "message.removed",
  "properties": {
    "sessionID": "ses_001",
    "messageID": "msg_001"
  }
}
```

- 触发方式: 撤销、回滚或清理消息。

## `message.part.updated`

- 稳定性: `contracted`
- 端点可见性: `/event`, `/global/event`
- payload（结构化示例，非完整字段）:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": "<Part>",
    "delta": "string?"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `properties.part.id` | `string` | part ID |
| `properties.part.sessionID` | `string` | 所属会话 ID |
| `properties.part.messageID` | `string` | 所属消息 ID |
| `properties.part.type` | `string` | part 类型（`text`/`reasoning`/`tool`/...） |
| `properties.delta` | `string?` | 可选增量文本字段 |

### `part.type = "text"`（对话文本）

- payload 最小结构:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "prt_txt_1",
      "sessionID": "ses_001",
      "messageID": "msg_001",
      "type": "text",
      "text": "你好"
    }
  }
}
```

- 字段说明:
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `part.text` | `string` | 当前文本快照 |
| `delta` | `string?` | 本帧新增片段（可选） |
| `part.time` | `object?` | 文本段时间信息（可选） |

`part.time` 字段结构（若存在）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `part.time.start` | `number` | 文本段开始时间（毫秒） |
| `part.time.end` | `number?` | 文本段结束时间（毫秒） |

- 开始帧示例（结构化示例）:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "prt_txt_1",
      "sessionID": "ses_001",
      "messageID": "msg_001",
      "type": "text",
      "text": "你好"
    }
  }
}
```

- 进行中帧示例（结构化示例）:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "prt_txt_1",
      "sessionID": "ses_001",
      "messageID": "msg_001",
      "type": "text",
      "text": "你好，我来帮你拆分文档。"
    },
    "delta": "，我来帮你拆分文档。"
  }
}
```

### `part.type = "reasoning"`（think）

- payload 最小结构:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "prt_reason_1",
      "sessionID": "ses_001",
      "messageID": "msg_001",
      "type": "reasoning",
      "text": "先确认事件分类再生成示例。",
      "time": {
        "start": 1772593200200
      }
    }
  }
}
```

- 字段说明:
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `part.text` | `string` | 推理文本 |
| `part.time.start` | `number` | 推理开始时间（必填） |
| `part.time.end` | `number?` | 推理结束时间（可选） |
| `part.metadata` | `object?` | 附加信息（可选） |

- 开始帧示例（结构化示例）:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "prt_reason_1",
      "sessionID": "ses_001",
      "messageID": "msg_001",
      "type": "reasoning",
      "text": "先确认事件分类再生成示例。",
      "time": {
        "start": 1772593200200
      }
    }
  }
}
```

- 结束帧示例（结构化示例）:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "prt_reason_1",
      "sessionID": "ses_001",
      "messageID": "msg_001",
      "type": "reasoning",
      "text": "已确认 message 相关契约与字段。",
      "time": {
        "start": 1772593200200,
        "end": 1772593200900
      }
    }
  }
}
```

### `part.type = "tool"`（工具调用）

- payload 最小结构:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "prt_tool_1",
      "sessionID": "ses_001",
      "messageID": "msg_001",
      "type": "tool",
      "callID": "call_001",
      "tool": "apply_patch",
      "state": {
        "status": "running",
        "input": {
          "path": "docs/api/sse/03-message-events.md"
        },
        "time": {
          "start": 1772593201000
        }
      }
    }
  }
}
```

- 字段说明:
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `part.callID` | `string` | 工具调用 ID |
| `part.tool` | `string` | 工具名 |
| `part.state.status` | `string` | `pending`/`running`/`completed`/`error` |
| `part.state.input` | `object` | 工具输入 |
| `part.state.time` | `object?` | 工具状态时间信息（是否出现取决于 `status`） |

`part.state` 在不同 `status` 下的字段要求（以 SDK 类型为准）：

| `part.state.status` | 契约必填字段 | 可选字段 |
| --- | --- | --- |
| `pending` | `input`, `raw` | 无 |
| `running` | `input`, `time.start` | `title`, `metadata` |
| `completed` | `input`, `output`, `title`, `metadata`, `time.start`, `time.end` | `time.compacted`, `attachments` |
| `error` | `input`, `error`, `time.start`, `time.end` | `metadata` |

- 开始/运行帧示例（结构化示例）:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "prt_tool_1",
      "sessionID": "ses_001",
      "messageID": "msg_001",
      "type": "tool",
      "callID": "call_001",
      "tool": "apply_patch",
      "state": {
        "status": "running",
        "input": {
          "path": "docs/api/sse/03-message-events.md"
        },
        "time": {
          "start": 1772593201000
        }
      }
    }
  }
}
```

- 完成帧示例（结构化示例）:

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "prt_tool_1",
      "sessionID": "ses_001",
      "messageID": "msg_001",
      "type": "tool",
      "callID": "call_001",
      "tool": "apply_patch",
      "state": {
        "status": "completed",
        "input": {
          "path": "docs/api/sse/03-message-events.md"
        },
        "output": "updated 1 file",
        "title": "Patch applied",
        "metadata": {
          "files": 1
        },
        "time": {
          "start": 1772593201000,
          "end": 1772593201800
        }
      }
    }
  }
}
```

## `message.part.delta`

- 稳定性: `contracted`
- 契约来源: `EventMessagePartDelta` (`dev:packages/sdk/js/src/v2/gen/types.gen.ts`)
- Since: `v1.2.0`
- 端点可见性: `/event`, `/global/event`
- payload: 

```json
{
  "type": "message.part.delta",
  "properties": {
    "sessionID": "string",
    "messageID": "string",
    "partID": "string",
    "field": "string",
    "delta": "string"
  }
}
```

| 字段 | 类型 | 必填性 | 版本 | 说明 |
| --- | --- | --- | --- | --- |
| `properties.sessionID` | `string` | 必填 | `since v1.2.0` | 会话 ID |
| `properties.messageID` | `string` | 必填 | `since v1.2.0` | 消息 ID |
| `properties.partID` | `string` | 必填 | `since v1.2.0` | part ID |
| `properties.field` | `string` | 必填 | `since v1.2.0` | 增量字段名（常见为 `text`） |
| `properties.delta` | `string` | 必填 | `since v1.2.0` | 本帧增量内容 |

- 真实报文示例（`/global/event`, `v1.2.15`）:

```json
{
  "directory": "/Users/zy/Code/opencode/opencode",
  "payload": {
    "type": "message.part.delta",
    "properties": {
      "sessionID": "ses_34232427effetUOuZjMITxXVqQ",
      "messageID": "msg_cc09f5068001zq5skdikwSiWpl",
      "partID": "prt_cc09fc7da001BZIuCOBAvBYIv1",
      "field": "text",
      "delta": "你好"
    }
  }
}
```




## `permission.asked`

- 稳定性: `contracted`
- 端点可见性: `/event`, `/global/event`
- payload: 

```json
{
  "type": "permission.asked",
  "properties": {
    "id": "string",
    "sessionID": "string",
    "permission": "string",
    "patterns": [
      "string"
    ],
    "always": [
      "string"
    ],
    "metadata": {},
    "tool": {
      "messageID": "string",
      "callID": "string"
    }
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `properties.id` | `string` | 权限请求 ID |
| `properties.sessionID` | `string` | 会话 ID |
| `properties.permission` | `string` | 权限类型 |
| `properties.patterns` | `string[]` | 请求匹配范围 |
| `properties.always` | `string[]` | 可持久放行范围 |
| `properties.tool` | `object?` | 关联工具调用 |

- 真实报文示例:

```json
{
  "type": "permission.asked",
  "properties": {
    "id": "perm_001",
    "sessionID": "ses_3493ea0d5ffeyIpkiiH9FYGHFt",
    "permission": "edit",
    "patterns": [
      "/Users/zy/Code/opencode/opencode/docs/**"
    ],
    "always": [
      "/Users/zy/Code/opencode/opencode/docs/**"
    ],
    "metadata": {
      "tool": "apply_patch"
    },
    "tool": {
      "messageID": "msg_001",
      "callID": "call_001"
    }
  }
}
```

- 触发方式: 需要用户授权的工具调用。

## `permission.replied`

- 稳定性: `contracted`
- 端点可见性: `/event`, `/global/event`
- payload: 

```json
{
  "type": "permission.replied",
  "properties": {
    "sessionID": "string",
    "requestID": "string",
    "reply": "once|always|reject"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `properties.sessionID` | `string` | 会话 ID |
| `properties.requestID` | `string` | 请求 ID |
| `properties.reply` | `string` | `once`/`always`/`reject` |

- 真实报文示例:

```json
{
  "type": "permission.replied",
  "properties": {
    "sessionID": "ses_3493ea0d5ffeyIpkiiH9FYGHFt",
    "requestID": "perm_001",
    "reply": "once"
  }
}
```

- 触发方式: 调用权限回复接口或 UI 授权操作。

## `question.asked`

- 稳定性: `contracted`
- 端点可见性: `/event`, `/global/event`
- payload: 

```json
{
  "type": "question.asked",
  "properties": {
    "id": "string",
    "sessionID": "string",
    "questions": [
      {
        "header": "string",
        "question": "string",
        "options": [
          {
            "label": "string",
            "description": "string"
          }
        ],
        "multiple": false,
        "custom": true
      }
    ],
    "tool": {
      "messageID": "string",
      "callID": "string"
    }
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `properties.id` | `string` | 提问请求 ID |
| `properties.questions` | `QuestionInfo[]` | 问题与选项列表 |
| `properties.tool` | `object?` | 来源工具调用 |

- 真实报文示例:

```json
{
  "type": "question.asked",
  "properties": {
    "id": "q_001",
    "sessionID": "ses_3493ea0d5ffeyIpkiiH9FYGHFt",
    "questions": [
      {
        "header": "文档位置",
        "question": "输出到哪个目录？",
        "options": [
          {
            "label": "docs/api",
            "description": "API 文档目录"
          }
        ],
        "multiple": false,
        "custom": true
      }
    ]
  }
}
```

- 触发方式: 需要用户选择输入时。

## `question.replied`

- 稳定性: `contracted`
- 端点可见性: `/event`, `/global/event`
- payload: 

```json
{
  "type": "question.replied",
  "properties": {
    "sessionID": "string",
    "requestID": "string",
    "answers": [
      [
        "string"
      ]
    ]
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `properties.sessionID` | `string` | 会话 ID |
| `properties.requestID` | `string` | 请求 ID |
| `properties.answers` | `string[][]` | 每个问题的答案集合 |

- 真实报文示例:

```json
{
  "type": "question.replied",
  "properties": {
    "sessionID": "ses_3493ea0d5ffeyIpkiiH9FYGHFt",
    "requestID": "q_001",
    "answers": [
      [
        "docs/api"
      ]
    ]
  }
}
```

- 触发方式: 用户提交问题答案。

## `question.rejected`

- 稳定性: `contracted`
- 端点可见性: `/event`, `/global/event`
- payload: 

```json
{
  "type": "question.rejected",
  "properties": {
    "sessionID": "string",
    "requestID": "string"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `properties.sessionID` | `string` | 会话 ID |
| `properties.requestID` | `string` | 请求 ID |

- 真实报文示例:

```json
{
  "type": "question.rejected",
  "properties": {
    "sessionID": "ses_3493ea0d5ffeyIpkiiH9FYGHFt",
    "requestID": "q_001"
  }
}
```

- 触发方式: 用户拒绝回答。
