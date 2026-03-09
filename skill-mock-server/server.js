'use strict';

const http = require('http');
const express = require('express');
const cors = require('cors');
const cookie = require('cookie');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8001);
const API_PREFIX = '/api/skill';
const WS_PATH = '/ws/skill/stream';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const db = {
  nextSessionId: 1,
  nextMessageId: 100,
  sessions: new Map(),
  messages: new Map(),
  permissions: new Map(),
  streams: new Map(),
};

const wsClients = new Set();

function nowIso() {
  return new Date().toISOString();
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readUserIdFromHeaders(headers) {
  const parsedCookie = cookie.parse(headers.cookie || '');
  return String(parsedCookie.userId || headers['x-user-id'] || '10001');
}

function readUserId(req) {
  return readUserIdFromHeaders(req.headers);
}

function ok(res, data) {
  return res.json({
    code: 0,
    errormsg: '',
    data,
  });
}

function fail(res, httpStatus, code, errormsg) {
  return res.status(httpStatus).json({
    code,
    errormsg,
    data: null,
  });
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parsePage(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function parseSize(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function paginate(items, page, size) {
  const start = page * size;
  const end = start + size;
  return {
    content: items.slice(start, end),
    page,
    size,
    total: items.length,
  };
}

function cloneSession(session) {
  const {
    welinkSessionId,
    userId,
    ak,
    title,
    imGroupId,
    status,
    toolSessionId,
    createdAt,
    updatedAt,
  } = session;

  return {
    welinkSessionId,
    userId,
    ak,
    title,
    imGroupId,
    status,
    toolSessionId,
    createdAt,
    updatedAt,
  };
}

function getSessionFromRequest(req, res) {
  const userId = readUserId(req);
  const welinkSessionId = parsePositiveInt(req.params.welinkSessionId);

  if (welinkSessionId === null) {
    fail(res, 400, 1000, 'Invalid welinkSessionId');
    return null;
  }

  const session = db.sessions.get(welinkSessionId);
  if (!session || session.userId !== userId) {
    fail(res, 404, 4000, 'Session not found');
    return null;
  }

  return session;
}

function getSessionMessages(sessionId) {
  return db.messages.get(sessionId) || [];
}

function nextMessageSeq(session) {
  session.messageSeqCounter += 1;
  return session.messageSeqCounter;
}

function nextEventSeq(session) {
  session.eventSeqCounter += 1;
  return session.eventSeqCounter;
}

function createSession({ userId, ak, title, imGroupId }) {
  const welinkSessionId = db.nextSessionId++;
  const timestamp = nowIso();
  const session = {
    welinkSessionId,
    userId,
    ak,
    title: title || '',
    imGroupId,
    status: 'ACTIVE',
    toolSessionId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    messageSeqCounter: 0,
    eventSeqCounter: 0,
  };

  db.sessions.set(welinkSessionId, session);
  db.messages.set(welinkSessionId, []);
  db.permissions.set(welinkSessionId, new Map());

  setTimeout(() => {
    const current = db.sessions.get(welinkSessionId);
    if (!current || current.status !== 'ACTIVE') {
      return;
    }
    current.toolSessionId = `ses_${welinkSessionId}`;
    current.updatedAt = nowIso();
  }, 300);

  return session;
}

function createMessage(session, { role, content, userId, parts }) {
  const message = {
    id: db.nextMessageId++,
    welinkSessionId: session.welinkSessionId,
    userId: userId === undefined ? null : userId,
    role,
    content: content || '',
    messageSeq: nextMessageSeq(session),
    parts: parts || [],
    createdAt: nowIso(),
  };

  getSessionMessages(session.welinkSessionId).push(message);
  session.updatedAt = nowIso();
  return message;
}

function getMessageById(sessionId, id) {
  return getSessionMessages(sessionId).find((item) => item.id === id) || null;
}

function ensurePart(message, partId, partSeq, type) {
  let part = message.parts.find((item) => item.partId === partId);
  if (!part) {
    part = {
      partId,
      partSeq,
      type,
      content: '',
    };
    message.parts.push(part);
  }

  part.partSeq = partSeq;
  part.type = type;
  message.parts.sort((left, right) => {
    const a = left.partSeq ?? Number.MAX_SAFE_INTEGER;
    const b = right.partSeq ?? Number.MAX_SAFE_INTEGER;
    return a - b;
  });
  return part;
}

function refreshMessageContent(message) {
  const textParts = message.parts
    .filter((part) => part.type === 'text' && typeof part.content === 'string')
    .map((part) => part.content);

  if (textParts.length > 0) {
    message.content = textParts.join('');
  }
}

function sendToClient(client, event) {
  if (client.ws.readyState !== WebSocket.OPEN) {
    return;
  }
  client.ws.send(JSON.stringify(event));
}

function broadcastToUser(userId, event) {
  for (const client of wsClients) {
    if (client.userId !== userId) {
      continue;
    }
    sendToClient(client, event);
  }
}

function emitEvent(session, type, payload, targetClient) {
  const event = {
    type,
    seq: nextEventSeq(session),
    welinkSessionId: String(session.welinkSessionId),
    emittedAt: nowIso(),
    ...compact(payload || {}),
  };

  if (targetClient) {
    sendToClient(targetClient, event);
  } else {
    broadcastToUser(session.userId, event);
  }
  return event;
}

function toSnapshotMessage(message) {
  return compact({
    id: `m_${message.id}`,
    seq: message.messageSeq,
    role: message.role,
    content: message.content,
    contentType: message.role === 'assistant' ? 'markdown' : 'plain',
    createdAt: message.createdAt,
    parts: message.parts.length > 0 ? deepClone(message.parts) : undefined,
  });
}

function toStreamingPart(part) {
  switch (part.type) {
    case 'tool':
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'tool',
        toolName: part.toolName,
        toolCallId: part.toolCallId,
        status: part.toolStatus,
        input: part.toolInput,
        output: part.toolOutput,
      });
    case 'question':
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'question',
        toolName: part.toolName,
        toolCallId: part.toolCallId,
        status: part.toolStatus,
        header: part.header,
        question: part.question,
        options: part.options,
      });
    case 'permission':
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'permission',
        permissionId: part.permissionId,
        permType: part.permType,
        toolName: part.toolName,
        content: part.content,
      });
    case 'file':
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'file',
        fileName: part.fileName,
        fileUrl: part.fileUrl,
        fileMime: part.fileMime,
      });
    case 'thinking':
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'thinking',
        content: part.content,
      });
    case 'text':
    default:
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'text',
        content: part.content,
      });
  }
}

function getStreamState(sessionId) {
  return db.streams.get(sessionId) || null;
}

function getAssistantMessage(sessionId, streamState) {
  if (!streamState) {
    return null;
  }
  return getMessageById(sessionId, streamState.assistantMessageId);
}

function clearTimers(streamState) {
  for (const timer of streamState.timers) {
    clearTimeout(timer);
  }
  streamState.timers.length = 0;
}

function closeStream(session, options) {
  const streamState = getStreamState(session.welinkSessionId);
  if (!streamState) {
    return false;
  }

  const opts = {
    reason: 'aborted',
    emitStepDone: true,
    emitSessionIdle: true,
    ...options,
  };

  clearTimers(streamState);
  if (streamState.active) {
    const assistant = getAssistantMessage(session.welinkSessionId, streamState);
    if (assistant && opts.emitStepDone) {
      emitEvent(session, 'step.done', {
        messageId: streamState.wsMessageId,
        messageSeq: assistant.messageSeq,
        role: 'assistant',
        reason: opts.reason,
      });
    }
    if (opts.emitSessionIdle) {
      emitEvent(session, 'session.status', { sessionStatus: 'idle' });
    }
  }

  streamState.active = false;
  db.streams.delete(session.welinkSessionId);
  session.updatedAt = nowIso();
  return true;
}

function schedule(streamState, delayMs, callback) {
  const timer = setTimeout(() => {
    if (!streamState.active) {
      return;
    }
    try {
      callback();
    } catch (error) {
      const session = db.sessions.get(streamState.sessionId);
      if (session) {
        emitEvent(session, 'session.error', { error: error.message || 'mock stream failed' });
        emitEvent(session, 'session.status', { sessionStatus: 'idle' });
      }
      streamState.active = false;
      db.streams.delete(streamState.sessionId);
    }
  }, delayMs);
  streamState.timers.push(timer);
}

function splitIntoChunks(text, chunkCount) {
  if (!text) {
    return [];
  }
  if (chunkCount <= 1 || text.length <= chunkCount) {
    return [text];
  }

  const size = Math.ceil(text.length / chunkCount);
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function buildScenario(prompt) {
  const lower = String(prompt || '').toLowerCase();
  const withPermission = /权限|permission|授权|bash|shell|命令/.test(lower);
  const withQuestion = /question|选择|选项|方案/.test(lower);
  const withFile = /file|文件|图片|image/.test(lower);

  return {
    withPermission,
    withTool: true,
    withQuestion,
    withFile,
  };
}

function buildMockAnswer(prompt, scenario, permissionResponse) {
  const lines = [];
  lines.push(`已处理你的请求：${prompt}`);
  lines.push('');
  lines.push('这是 Mock 服务端生成的结构化回答，用于联调前端流式渲染。');
  lines.push('');
  lines.push('## 执行摘要');
  lines.push(`- 工具调用：${scenario.withTool ? '已模拟' : '未触发'}`);
  lines.push(`- 权限流程：${scenario.withPermission ? permissionResponse || 'pending' : 'not-required'}`);
  lines.push(`- 问答流程：${scenario.withQuestion ? '已触发 question 事件' : '未触发'}`);
  lines.push(`- 文件输出：${scenario.withFile ? '已返回 file 事件' : '未触发'}`);
  lines.push('');
  lines.push('你可以继续发送下一条消息进行多轮对话。');
  return lines.join('\n');
}

function emitThinkingDelta(session, streamState, deltaText) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    return;
  }
  const part = ensurePart(assistant, 'p_0', 0, 'thinking');
  part.content = `${part.content || ''}${deltaText}`;
  emitEvent(session, 'thinking.delta', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    partId: 'p_0',
    partSeq: 0,
    content: deltaText,
  });
}

function emitThinkingDone(session, streamState, finalText) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    return;
  }
  const part = ensurePart(assistant, 'p_0', 0, 'thinking');
  part.content = finalText;
  emitEvent(session, 'thinking.done', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    partId: 'p_0',
    partSeq: 0,
    content: finalText,
  });
}

function emitToolUpdate(session, streamState, status) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    return;
  }
  const part = ensurePart(assistant, 'p_2', 2, 'tool');
  part.toolName = 'bash';
  part.toolCallId = `call_${assistant.id}`;
  part.toolStatus = status;
  part.toolInput = { command: 'npm run build' };
  if (status === 'completed') {
    part.toolOutput = 'Mock command finished successfully.';
  }
  if (status === 'error') {
    part.toolOutput = 'Mock command failed.';
  }

  emitEvent(session, 'tool.update', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    partId: 'p_2',
    partSeq: 2,
    toolName: part.toolName,
    toolCallId: part.toolCallId,
    status,
    input: part.toolInput,
    output: part.toolOutput,
    title: 'Execute bash command',
  });
}

function emitQuestion(session, streamState) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    return;
  }
  const part = ensurePart(assistant, 'p_3', 3, 'question');
  part.toolName = 'question';
  part.toolCallId = `call_q_${assistant.id}`;
  part.toolStatus = 'running';
  part.header = 'Mock Interactive Question';
  part.question = '你希望采用哪种执行策略？';
  part.options = ['快速模式', '标准模式', '深度模式'];
  part.content = part.question;

  emitEvent(session, 'question', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    partId: 'p_3',
    partSeq: 3,
    toolName: part.toolName,
    toolCallId: part.toolCallId,
    status: 'running',
    header: part.header,
    question: part.question,
    options: part.options,
  });
}

function emitFile(session, streamState) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    return;
  }
  const part = ensurePart(assistant, 'p_4', 4, 'file');
  part.fileName = 'mock-result.txt';
  part.fileUrl = `https://mock.skill.local/session-${session.welinkSessionId}/result.txt`;
  part.fileMime = 'text/plain';

  emitEvent(session, 'file', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    partId: 'p_4',
    partSeq: 4,
    fileName: part.fileName,
    fileUrl: part.fileUrl,
    fileMime: part.fileMime,
  });
}

function emitPermissionAsk(session, streamState) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    return null;
  }

  const permissionId = `perm_${session.welinkSessionId}_${Date.now()}`;
  const part = ensurePart(assistant, 'p_1', 1, 'permission');
  part.permissionId = permissionId;
  part.permType = 'bash';
  part.toolName = 'bash';
  part.content = '请求执行受限命令：npm run build';

  const permissionStore = db.permissions.get(session.welinkSessionId);
  permissionStore.set(permissionId, {
    permissionId,
    status: 'pending',
    assistantMessageId: assistant.id,
    createdAt: nowIso(),
  });

  streamState.waitingPermissionId = permissionId;
  emitEvent(session, 'permission.ask', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    permissionId,
    permType: 'bash',
    title: 'Execute shell command',
    metadata: {
      command: 'npm run build',
    },
  });

  return permissionId;
}

function emitPermissionReply(session, streamState, permissionId, response) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    return;
  }

  const part = ensurePart(assistant, 'p_1', 1, 'permission');
  part.permissionId = permissionId;
  part.content = response;

  emitEvent(session, 'permission.reply', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    permissionId,
    response,
  });
}

function emitTextDelta(session, streamState, deltaText) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    return;
  }
  const part = ensurePart(assistant, 'p_5', 5, 'text');
  part.content = `${part.content || ''}${deltaText}`;
  refreshMessageContent(assistant);

  emitEvent(session, 'text.delta', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    partId: 'p_5',
    partSeq: 5,
    content: deltaText,
  });
}

function emitTextDone(session, streamState, finalText) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    return;
  }
  const part = ensurePart(assistant, 'p_5', 5, 'text');
  part.content = finalText;
  refreshMessageContent(assistant);

  emitEvent(session, 'text.done', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    partId: 'p_5',
    partSeq: 5,
    content: finalText,
  });
}

function finalizeStream(session, streamState, reason) {
  const assistant = getAssistantMessage(session.welinkSessionId, streamState);
  if (!assistant) {
    streamState.active = false;
    db.streams.delete(session.welinkSessionId);
    return;
  }

  if (!session.title) {
    const userMessage = getSessionMessages(session.welinkSessionId)
      .filter((item) => item.role === 'user')
      .slice(-1)[0];
    if (userMessage && userMessage.content) {
      session.title = userMessage.content.slice(0, 24);
      emitEvent(session, 'session.title', { title: session.title });
    }
  }

  emitEvent(session, 'step.done', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    reason: reason || 'completed',
  });
  emitEvent(session, 'session.status', { sessionStatus: 'idle' });

  streamState.active = false;
  db.streams.delete(session.welinkSessionId);
  session.updatedAt = nowIso();
}

function continueAfterPermission(session, streamState, permissionResponse) {
  if (!streamState.active || streamState.hasContinued) {
    return;
  }
  streamState.hasContinued = true;

  let delay = 80;

  if (permissionResponse === 'reject') {
    const rejectText = '已收到拒绝指令，受限操作已取消。你可以继续提出其他需求。';
    schedule(streamState, delay, () => emitTextDelta(session, streamState, rejectText));
    delay += 120;
    schedule(streamState, delay, () => emitTextDone(session, streamState, rejectText));
    delay += 100;
    schedule(streamState, delay, () => finalizeStream(session, streamState, 'permission_rejected'));
    return;
  }

  if (streamState.scenario.withTool) {
    schedule(streamState, delay, () => emitToolUpdate(session, streamState, 'pending'));
    delay += 120;
    schedule(streamState, delay, () => emitToolUpdate(session, streamState, 'running'));
    delay += 120;
    schedule(streamState, delay, () => emitToolUpdate(session, streamState, 'completed'));
    delay += 100;
  }

  if (streamState.scenario.withQuestion) {
    schedule(streamState, delay, () => emitQuestion(session, streamState));
    delay += 120;
  }

  if (streamState.scenario.withFile) {
    schedule(streamState, delay, () => emitFile(session, streamState));
    delay += 120;
  }

  const finalAnswer = buildMockAnswer(streamState.prompt, streamState.scenario, permissionResponse);
  const chunks = splitIntoChunks(finalAnswer, 3);
  for (const chunk of chunks) {
    schedule(streamState, delay, () => emitTextDelta(session, streamState, chunk));
    delay += 120;
  }
  schedule(streamState, delay, () => emitTextDone(session, streamState, finalAnswer));
  delay += 100;
  schedule(streamState, delay, () => finalizeStream(session, streamState, 'completed'));
}

function startAssistantStream(session, prompt) {
  closeStream(session, { emitSessionIdle: false, emitStepDone: false });

  const assistant = createMessage(session, {
    role: 'assistant',
    content: '',
    userId: null,
    parts: [],
  });

  const streamState = {
    sessionId: session.welinkSessionId,
    assistantMessageId: assistant.id,
    wsMessageId: `m_${assistant.id}`,
    prompt,
    scenario: buildScenario(prompt),
    waitingPermissionId: null,
    hasContinued: false,
    active: true,
    timers: [],
  };
  db.streams.set(session.welinkSessionId, streamState);

  emitEvent(session, 'session.status', { sessionStatus: 'busy' });
  emitEvent(session, 'step.start', {
    messageId: streamState.wsMessageId,
    messageSeq: assistant.messageSeq,
    role: 'assistant',
    title: 'mock-step',
  });

  schedule(streamState, 80, () => emitThinkingDelta(session, streamState, '正在分析你的需求...'));
  schedule(streamState, 220, () => emitThinkingDone(session, streamState, `已分析完成：${prompt}`));

  if (streamState.scenario.withPermission) {
    schedule(streamState, 360, () => emitPermissionAsk(session, streamState));
    return;
  }

  schedule(streamState, 360, () => continueAfterPermission(session, streamState, 'once'));
}

function sendBootstrapEvents(client) {
  const sessions = [...db.sessions.values()]
    .filter((session) => session.userId === client.userId && session.status === 'ACTIVE')
    .sort((left, right) => left.welinkSessionId - right.welinkSessionId);

  for (const session of sessions) {
    emitEvent(session, 'agent.online', {}, client);

    const streamState = getStreamState(session.welinkSessionId);
    const allMessages = getSessionMessages(session.welinkSessionId);
    const completedMessages = allMessages.filter((message) => {
      if (!streamState || !streamState.active) {
        return true;
      }
      return message.id !== streamState.assistantMessageId;
    });

    if (completedMessages.length > 0) {
      emitEvent(session, 'snapshot', {
        messages: completedMessages.map(toSnapshotMessage),
      }, client);
    }

    if (streamState && streamState.active) {
      const assistant = getAssistantMessage(session.welinkSessionId, streamState);
      if (assistant) {
        emitEvent(session, 'streaming', {
          sessionStatus: 'busy',
          messageId: streamState.wsMessageId,
          messageSeq: assistant.messageSeq,
          role: 'assistant',
          parts: assistant.parts.map(toStreamingPart),
        }, client);
      }
    }
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: nowIso() });
});

app.post(`${API_PREFIX}/sessions`, (req, res) => {
  const userId = readUserId(req);
  const { ak, title, imGroupId } = req.body || {};

  if (typeof ak !== 'string' || ak.trim() === '' || typeof imGroupId !== 'string' || imGroupId.trim() === '') {
    return fail(res, 400, 1000, 'Invalid parameters: ak and imGroupId are required');
  }

  const session = createSession({
    userId,
    ak: ak.trim(),
    title: typeof title === 'string' ? title.trim() : '',
    imGroupId: imGroupId.trim(),
  });

  emitEvent(session, 'agent.online', {});
  return ok(res, cloneSession(session));
});

app.post(`${API_PREFIX}/sessions/:welinkSessionId/messages`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }
  if (session.status !== 'ACTIVE') {
    return fail(res, 409, 4001, 'Session is closed');
  }

  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content) {
    return fail(res, 400, 1000, 'Invalid content');
  }

  const userMessage = createMessage(session, {
    role: 'user',
    content,
    userId: readUserId(req),
    parts: [],
  });

  setTimeout(() => {
    const latest = db.sessions.get(session.welinkSessionId);
    if (!latest || latest.status !== 'ACTIVE') {
      return;
    }
    startAssistantStream(latest, content);
  }, 30);

  return ok(res, deepClone(userMessage));
});

app.post(`${API_PREFIX}/sessions/:welinkSessionId/permissions/:permId`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  const permId = String(req.params.permId || '').trim();
  const response = String(req.body?.response || '').trim();
  if (!permId || !['once', 'always', 'reject'].includes(response)) {
    return fail(res, 400, 1000, 'Invalid response');
  }

  const permissionStore = db.permissions.get(session.welinkSessionId);
  const permission = permissionStore.get(permId);
  if (!permission) {
    return fail(res, 404, 4007, 'Permission request not found');
  }
  if (permission.status !== 'pending') {
    return fail(res, 409, 4008, 'Permission request already resolved');
  }

  permission.status = 'resolved';
  permission.response = response;

  const streamState = getStreamState(session.welinkSessionId);
  if (streamState && streamState.active) {
    emitPermissionReply(session, streamState, permId, response);
    streamState.waitingPermissionId = null;
    continueAfterPermission(session, streamState, response);
  }

  return ok(res, {
    welinkSessionId: session.welinkSessionId,
    permissionId: permId,
    response,
  });
});

app.post(`${API_PREFIX}/sessions/:welinkSessionId/abort`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  closeStream(session, { reason: 'aborted' });
  return ok(res, {
    welinkSessionId: session.welinkSessionId,
    status: 'aborted',
  });
});

app.delete(`${API_PREFIX}/sessions/:welinkSessionId`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  closeStream(session, { reason: 'closed', emitSessionIdle: false });
  session.status = 'CLOSED';
  session.updatedAt = nowIso();
  emitEvent(session, 'agent.offline', { reason: 'session_closed' });

  return ok(res, {
    welinkSessionId: session.welinkSessionId,
    status: 'closed',
  });
});

app.get(`${API_PREFIX}/sessions/:welinkSessionId/messages`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  const page = parsePage(req.query.page, 0);
  const size = parseSize(req.query.size, 50);
  const messages = getSessionMessages(session.welinkSessionId).map((item) => deepClone(item));
  const result = paginate(messages, page, size);

  return ok(res, result);
});

app.get(`${API_PREFIX}/sessions`, (req, res) => {
  const userId = readUserId(req);
  const page = parsePage(req.query.page, 0);
  const size = parseSize(req.query.size, 20);
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const ak = typeof req.query.ak === 'string' ? req.query.ak : null;
  const imGroupId = typeof req.query.imGroupId === 'string' ? req.query.imGroupId : null;

  const sessions = [...db.sessions.values()]
    .filter((session) => session.userId === userId)
    .filter((session) => (status ? session.status === status : true))
    .filter((session) => (ak ? session.ak === ak : true))
    .filter((session) => (imGroupId ? session.imGroupId === imGroupId : true))
    .sort((left, right) => right.welinkSessionId - left.welinkSessionId)
    .map((session) => cloneSession(session));

  return ok(res, paginate(sessions, page, size));
});

app.get(`${API_PREFIX}/sessions/:welinkSessionId`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }
  return ok(res, cloneSession(session));
});

app.post(`${API_PREFIX}/sessions/:welinkSessionId/send-to-im`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }
  if (!session.imGroupId) {
    return res.status(409).json({ success: false, message: 'IM group is not bound to this session' });
  }

  let content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const maybeMessageId = parsePositiveInt(req.body?.messageId);

  if (!content && maybeMessageId !== null) {
    const target = getMessageById(session.welinkSessionId, maybeMessageId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    content = target.content || '';
  }

  if (!content) {
    return res.status(400).json({ success: false, message: 'content is required' });
  }

  return res.status(200).json({
    success: true,
    chatId: session.imGroupId,
    contentLength: content.length,
  });
});

app.use((error, _req, res, _next) => {
  return fail(res, 500, 7000, error?.message || 'Internal server error');
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname !== WS_PATH) {
    socket.destroy();
    return;
  }

  const userId = readUserIdFromHeaders(request.headers);
  wss.handleUpgrade(request, socket, head, (ws) => {
    ws.userId = userId;
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, req) => {
  const userId = ws.userId || readUserIdFromHeaders(req.headers);
  const client = { ws, userId };
  wsClients.add(client);

  sendBootstrapEvents(client);

  ws.on('close', () => {
    wsClients.delete(client);
  });
  ws.on('error', () => {
    wsClients.delete(client);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  
  // eslint-disable-next-line no-console
  console.log(`Skill mock server is running on:`);
  // eslint-disable-next-line no-console
  console.log(`  - Local:   http://localhost:${PORT}`);
  for (const addr of addresses) {
    // eslint-disable-next-line no-console
    console.log(`  - Network: http://${addr}:${PORT}`);
  }
  // eslint-disable-next-line no-console
  console.log(`WebSocket endpoint: ws://localhost:${PORT}${WS_PATH}`);
  for (const addr of addresses) {
    // eslint-disable-next-line no-console
    console.log(`WebSocket endpoint: ws://${addr}:${PORT}${WS_PATH}`);
  }
});
