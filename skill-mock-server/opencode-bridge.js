'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookie = require('cookie');
const { spawn } = require('child_process');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8082);
const API_PREFIX = '/api/skill';
const WS_PATH = '/ws/skill/stream';
const DEFAULT_WORKDIR = process.env.OPENCODE_BRIDGE_WORKDIR || 'F:\\AIProject\\skillSDK';
const DEFAULT_CONFIG_HOME = process.env.OPENCODE_BRIDGE_CONFIG_HOME
  || path.join(DEFAULT_WORKDIR, '.opencode-config');
const OPENCODE_BIN = process.env.OPENCODE_BRIDGE_BIN || (process.platform === 'win32' ? 'opencode' : 'opencode');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const db = {
  nextSessionId: 1,
  nextMessageId: 100,
  sessions: new Map(),
  messages: new Map(),
  activeRuns: new Map(),
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
    totalPages: Math.ceil(items.length / size),
  };
}

function splitText(text, size) {
  if (!text) {
    return [];
  }
  const chunks = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

function createSession({
  userId,
  ak,
  title,
  businessSessionDomain,
  businessSessionType,
  businessSessionId,
  assistantAccount,
}) {
  const welinkSessionId = String(db.nextSessionId++);
  const timestamp = nowIso();
  const session = {
    welinkSessionId,
    userId,
    ak: ak || 'opencode-local-ak',
    title: title || '',
    bussinessDomain: businessSessionDomain || 'miniapp',
    bussinessType: businessSessionType || 'direct',
    bussinessId: businessSessionId || userId,
    assistantAccount: assistantAccount || 'opencode_local',
    status: 'ACTIVE',
    toolSessionId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    messageSeqCounter: 0,
    historySeqCounter: 0,
    eventSeqCounter: 0,
  };

  db.sessions.set(session.welinkSessionId, session);
  db.messages.set(session.welinkSessionId, []);
  return session;
}

function cloneSession(session) {
  return { ...session };
}

function getSessionMessages(sessionId) {
  return db.messages.get(sessionId) || [];
}

function nextMessageSeq(session) {
  session.messageSeqCounter += 1;
  return session.messageSeqCounter;
}

function nextHistorySeq(session) {
  session.historySeqCounter += 1;
  return session.historySeqCounter;
}

function nextEventSeq(session) {
  session.eventSeqCounter += 1;
  return session.eventSeqCounter;
}

function createMessage(session, { role, content, contentType, parts, meta }) {
  const createdAt = nowIso();
  const message = {
    id: String(db.nextMessageId++),
    welinkSessionId: session.welinkSessionId,
    seq: nextHistorySeq(session),
    messageSeq: nextMessageSeq(session),
    role,
    content: content || '',
    contentType: contentType || (role === 'assistant' ? 'markdown' : 'plain'),
    createdAt,
    meta: meta || null,
    parts: parts || [],
  };

  getSessionMessages(session.welinkSessionId).push(message);
  session.updatedAt = createdAt;
  return message;
}

function buildTextPart(partId, content, partSeq = 1) {
  return {
    partId,
    partSeq,
    type: 'text',
    content,
  };
}

function cloneMessage(message) {
  return {
    ...message,
    meta: message.meta ? { ...message.meta } : null,
    parts: Array.isArray(message.parts) ? message.parts.map((part) => ({ ...part })) : [],
  };
}

function getSessionFromRequest(req, res) {
  const userId = readUserId(req);
  const sessionId = String(req.params.sessionId || req.params.welinkSessionId || '').trim();
  if (!sessionId) {
    fail(res, 400, 1000, 'Invalid session ID');
    return null;
  }
  const session = db.sessions.get(sessionId);
  if (!session || session.userId !== userId) {
    fail(res, 404, 4000, 'Session not found');
    return null;
  }
  return session;
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

function emitEvent(session, type, payload) {
  const event = {
    type,
    seq: nextEventSeq(session),
    welinkSessionId: session.welinkSessionId,
    emittedAt: nowIso(),
    ...compact(payload || {}),
  };
  broadcastToUser(session.userId, event);
  return event;
}

function emitEventToClient(session, type, payload, client) {
  const event = {
    type,
    seq: nextEventSeq(session),
    welinkSessionId: session.welinkSessionId,
    emittedAt: nowIso(),
    ...compact(payload || {}),
  };
  sendToClient(client, event);
  return event;
}

function emitBusy(session, assistantMessage) {
  emitEvent(session, 'session.status', {
    sessionStatus: 'busy',
  });
  emitEvent(session, 'step.start', {
    messageId: assistantMessage.id,
    messageSeq: assistantMessage.messageSeq,
    role: 'assistant',
  });
}

function emitIdle(session, assistantMessage, options = {}) {
  if (assistantMessage && options.tokens) {
    emitEvent(session, 'step.done', {
      messageId: assistantMessage.id,
      messageSeq: assistantMessage.messageSeq,
      role: 'assistant',
      tokens: options.tokens,
      cost: options.cost,
      reason: options.reason || 'stop',
    });
  }

  emitEvent(session, 'session.status', {
    sessionStatus: 'idle',
  });
}

function finalizeAssistantMessage(session, assistantMessage, content, metadata) {
  assistantMessage.content = content;
  assistantMessage.parts = [buildTextPart(`text_${assistantMessage.id}`, content)];
  assistantMessage.contentType = 'markdown';
  if (metadata && (metadata.tokens || metadata.cost !== undefined)) {
    assistantMessage.meta = {
      ...(assistantMessage.meta || {}),
      ...(metadata.tokens ? { tokens: metadata.tokens } : {}),
      ...(metadata.cost !== undefined ? { cost: metadata.cost } : {}),
    };
  }
  session.updatedAt = nowIso();
}

function finalizeAssistantError(session, assistantMessage, errorMessage) {
  assistantMessage.content = errorMessage;
  assistantMessage.contentType = 'plain';
  assistantMessage.parts = [{
    partId: `error_${assistantMessage.id}`,
    partSeq: 1,
    type: 'error',
    content: errorMessage,
  }];
  session.updatedAt = nowIso();
}

function toStreamingPart(part) {
  switch (part.type) {
    case 'tool':
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'tool',
        content: part.content,
        toolName: part.toolName,
        toolCallId: part.toolCallId,
        status: part.status,
        input: part.input,
        output: part.output,
        error: part.error,
        title: part.title,
      });
    case 'question':
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'question',
        content: part.content,
        toolName: part.toolName,
        toolCallId: part.toolCallId,
        status: part.status,
        input: part.input,
        output: part.output,
        title: part.title,
        header: part.header,
        question: part.question,
        options: part.options,
      });
    case 'permission':
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'permission',
        content: part.content,
        permissionId: part.permissionId,
        permType: part.permType,
        metadata: part.metadata,
        response: part.response,
        toolName: part.toolName,
        title: part.title,
      });
    case 'file':
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: 'file',
        content: part.content,
        fileName: part.fileName,
        fileUrl: part.fileUrl,
        fileMime: part.fileMime,
      });
    case 'thinking':
    case 'text':
    default:
      return compact({
        partId: part.partId,
        partSeq: part.partSeq,
        type: part.type,
        content: part.content,
        status: part.status,
      });
  }
}

function buildStreamingParts(runState) {
  const messageParts = Array.isArray(runState.assistantMessage.parts) ? runState.assistantMessage.parts : [];
  if (messageParts.length > 0) {
    return messageParts.map((part) => toStreamingPart(part));
  }

  if (!runState.currentText) {
    return [];
  }

  return [{
    partId: runState.textPartId || `text_${runState.assistantMessage.id}`,
    partSeq: 1,
    type: 'text',
    content: runState.currentText,
    status: 'running',
  }];
}

function sendBootstrapEvents(client) {
  const sessions = Array.from(db.sessions.values())
    .filter((session) => session.userId === client.userId && session.status === 'ACTIVE')
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  sessions.forEach((session) => {
    emitEventToClient(session, 'agent.online', {}, client);

    const activeRun = db.activeRuns.get(session.welinkSessionId);
    const allMessages = getSessionMessages(session.welinkSessionId);
    const completedMessages = allMessages.filter((message) => {
      if (!activeRun || activeRun.completed) {
        return true;
      }
      return message.id !== activeRun.assistantMessage.id;
    });

    if (completedMessages.length > 0) {
      emitEventToClient(session, 'snapshot', {
        messages: completedMessages.map((message) => cloneMessage(message)),
      }, client);
    }

    if (activeRun && !activeRun.completed) {
      const streamingParts = buildStreamingParts(activeRun);
      if (streamingParts.length > 0) {
        emitEventToClient(session, 'streaming', {
          sessionStatus: 'busy',
          messageId: activeRun.assistantMessage.id,
          messageSeq: activeRun.assistantMessage.messageSeq,
          role: 'assistant',
          parts: streamingParts,
        }, client);
      }
    }
  });
}

function killActiveRun(sessionId) {
  const runState = db.activeRuns.get(sessionId);
  if (!runState) {
    return false;
  }

  db.activeRuns.delete(sessionId);
  if (!runState.completed) {
    runState.completed = true;
    try {
      runState.child.kill();
    } catch (error) {
      // ignore
    }
    emitIdle(runState.session, runState.assistantMessage, {
      reason: 'aborted',
    });
  }
  return true;
}

function createOpencodeArgs(prompt, toolSessionId) {
  const args = [
    'run',
    prompt,
    '--format',
    'json',
    '--pure',
  ];

  if (toolSessionId) {
    args.push('--session', toolSessionId);
  }

  return args;
}

function parseJsonLines(buffer, onObject) {
  const lines = buffer.split(/\r?\n/);
  const rest = lines.pop() || '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) {
      continue;
    }
    try {
      onObject(JSON.parse(trimmed));
    } catch (error) {
      // ignore non-JSON diagnostic lines
    }
  }

  return rest;
}

function handleOpencodeEvent(runState, event) {
  const { session, assistantMessage } = runState;
  const part = event && typeof event === 'object' ? event.part || {} : {};
  const sessionId = typeof event.sessionID === 'string' ? event.sessionID : null;
  if (sessionId && !session.toolSessionId) {
    session.toolSessionId = sessionId;
  }

  if (event.type === 'step_start') {
    return;
  }

  if (event.type === 'text') {
    const nextText = typeof part.text === 'string' ? part.text : '';
    const previousText = runState.currentText;
    if (!nextText) {
      return;
    }

    const textPartId = runState.textPartId || `text_${assistantMessage.id}`;
    runState.textPartId = textPartId;

    if (nextText.startsWith(previousText)) {
      const delta = nextText.slice(previousText.length);
      splitText(delta, 24).forEach((chunk) => {
        emitEvent(session, 'text.delta', {
          messageId: assistantMessage.id,
          messageSeq: assistantMessage.messageSeq,
          role: 'assistant',
          partId: textPartId,
          partSeq: 1,
          content: chunk,
        });
      });
    } else if (!previousText) {
      splitText(nextText, 24).forEach((chunk) => {
        emitEvent(session, 'text.delta', {
          messageId: assistantMessage.id,
          messageSeq: assistantMessage.messageSeq,
          role: 'assistant',
          partId: textPartId,
          partSeq: 1,
          content: chunk,
        });
      });
    }

    runState.currentText = nextText;
    runState.assistantMessage.content = nextText;
    runState.assistantMessage.parts = [buildTextPart(textPartId, nextText)];
    runState.assistantMessage.contentType = 'markdown';
    runState.session.updatedAt = nowIso();
    return;
  }

  if (event.type === 'step_finish') {
    const tokens = part && typeof part.tokens === 'object'
      ? {
        input: part.tokens.input,
        output: part.tokens.output,
        reasoning: part.tokens.reasoning,
        cache: part.tokens.cache,
      }
      : undefined;
    const cost = typeof part.cost === 'number' ? part.cost : undefined;
    const reason = typeof part.reason === 'string' ? part.reason : 'stop';

    finalizeAssistantMessage(session, assistantMessage, runState.currentText, {
      tokens,
      cost,
    });

    emitEvent(session, 'text.done', {
      messageId: assistantMessage.id,
      messageSeq: assistantMessage.messageSeq,
      role: 'assistant',
      partId: runState.textPartId || `text_${assistantMessage.id}`,
      partSeq: 1,
      content: runState.currentText,
    });

    emitIdle(session, assistantMessage, {
      tokens,
      cost,
      reason,
    });
    runState.completed = true;
    db.activeRuns.delete(session.welinkSessionId);
  }
}

function startOpencodeRun(session, prompt) {
  const existingRun = db.activeRuns.get(session.welinkSessionId);
  if (existingRun && !existingRun.completed) {
    throw new Error('Session is already generating');
  }

  const assistantMessage = createMessage(session, {
    role: 'assistant',
    content: '',
    contentType: 'markdown',
    parts: [],
    meta: null,
  });

  emitBusy(session, assistantMessage);

  const args = createOpencodeArgs(prompt, session.toolSessionId);
  const child = spawn(OPENCODE_BIN, args, {
    cwd: DEFAULT_WORKDIR,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: DEFAULT_CONFIG_HOME,
      NO_COLOR: '1',
    },
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const runState = {
    session,
    assistantMessage,
    child,
    completed: false,
    currentText: '',
    textPartId: null,
    stdoutBuffer: '',
    stderrBuffer: '',
  };
  db.activeRuns.set(session.welinkSessionId, runState);

  child.stdout.on('data', (chunk) => {
    runState.stdoutBuffer += chunk.toString('utf8');
    runState.stdoutBuffer = parseJsonLines(runState.stdoutBuffer, (event) => {
      handleOpencodeEvent(runState, event);
    });
  });

  child.stderr.on('data', (chunk) => {
    runState.stderrBuffer += chunk.toString('utf8');
  });

  child.on('error', (error) => {
    if (runState.completed) {
      return;
    }
    runState.completed = true;
    db.activeRuns.delete(session.welinkSessionId);
    finalizeAssistantError(session, assistantMessage, error.message || 'Failed to start opencode process');
    // eslint-disable-next-line no-console
    console.error('[opencode-bridge] child process error:', error);
    emitEvent(session, 'session.error', {
      error: error.message || 'Failed to start opencode process',
    });
    emitEvent(session, 'session.status', {
      sessionStatus: 'idle',
    });
  });

  child.on('close', (code) => {
    if (runState.completed) {
      return;
    }

    const trailing = runState.stdoutBuffer.trim();
    if (trailing.startsWith('{')) {
      try {
        handleOpencodeEvent(runState, JSON.parse(trailing));
      } catch (error) {
        // ignore trailing parse errors
      }
    }

    if (!runState.completed) {
      runState.completed = true;
      db.activeRuns.delete(session.welinkSessionId);
      if (!runState.currentText) {
        const errorMessage = `opencode exited with code ${code}${runState.stderrBuffer ? `: ${runState.stderrBuffer.trim()}` : ''}`;
        finalizeAssistantError(session, assistantMessage, errorMessage);
        // eslint-disable-next-line no-console
        console.error('[opencode-bridge] opencode exited without text:', errorMessage);
        emitEvent(session, 'session.error', {
          error: errorMessage,
        });
        emitEvent(session, 'session.status', {
          sessionStatus: 'idle',
        });
      } else {
        finalizeAssistantMessage(session, assistantMessage, runState.currentText);
        emitEvent(session, 'text.done', {
          messageId: assistantMessage.id,
          messageSeq: assistantMessage.messageSeq,
          role: 'assistant',
          partId: runState.textPartId || `text_${assistantMessage.id}`,
          partSeq: 1,
          content: runState.currentText,
        });
        emitEvent(session, 'session.status', {
          sessionStatus: 'idle',
        });
      }
    }
  });
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    timestamp: nowIso(),
    workdir: DEFAULT_WORKDIR,
    configHome: DEFAULT_CONFIG_HOME,
    opencodeBin: OPENCODE_BIN,
  });
});

app.post(`${API_PREFIX}/sessions`, (req, res) => {
  const userId = readUserId(req);
  const session = createSession({
    userId,
    ak: typeof req.body?.ak === 'string' ? req.body.ak.trim() : 'opencode-local-ak',
    title: typeof req.body?.title === 'string' ? req.body.title.trim() : '',
    businessSessionDomain: typeof req.body?.businessSessionDomain === 'string'
      ? req.body.businessSessionDomain.trim()
      : 'miniapp',
    businessSessionType: typeof req.body?.businessSessionType === 'string'
      ? req.body.businessSessionType.trim()
      : 'direct',
    businessSessionId: typeof req.body?.businessSessionId === 'string'
      ? req.body.businessSessionId.trim()
      : userId,
    assistantAccount: typeof req.body?.assistantAccount === 'string'
      ? req.body.assistantAccount.trim()
      : 'opencode_local',
  });

  return ok(res, cloneSession(session));
});

app.get(`${API_PREFIX}/sessions`, (req, res) => {
  const userId = readUserId(req);
  const page = parsePage(req.query.page, 0);
  const size = parseSize(req.query.size, 20);

  const sessions = Array.from(db.sessions.values())
    .filter((session) => session.userId === userId)
    .filter((session) => !req.query.assistantAccount || session.assistantAccount === req.query.assistantAccount)
    .filter((session) => !req.query.ak || session.ak === req.query.ak)
    .filter((session) => !req.query.status || session.status === req.query.status)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .map((session) => cloneSession(session));

  return ok(res, paginate(sessions, page, size));
});

app.get(`${API_PREFIX}/sessions/:sessionId`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }
  return ok(res, cloneSession(session));
});

app.delete(`${API_PREFIX}/sessions/:sessionId`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  killActiveRun(session.welinkSessionId);
  session.status = 'CLOSED';
  session.updatedAt = nowIso();
  emitEvent(session, 'agent.offline', {
    reason: 'session_closed',
  });

  return ok(res, {
    welinkSessionId: session.welinkSessionId,
    status: 'closed',
  });
});

app.post(`${API_PREFIX}/sessions/:sessionId/abort`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  killActiveRun(session.welinkSessionId);
  return ok(res, {
    welinkSessionId: session.welinkSessionId,
    status: 'aborted',
  });
});

app.post(`${API_PREFIX}/sessions/:sessionId/messages`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  if (session.status === 'CLOSED') {
    return fail(res, 409, 4001, 'Session is closed');
  }

  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content) {
    return fail(res, 400, 1000, 'Content is required');
  }

  if (db.activeRuns.has(session.welinkSessionId)) {
    return fail(res, 409, 4002, 'Session is already generating');
  }

  const userMessage = createMessage(session, {
    role: 'user',
    content,
    contentType: 'plain',
    parts: [],
    meta: null,
  });

  emitEvent(session, 'message.user', {
    messageId: userMessage.id,
    messageSeq: userMessage.messageSeq,
    role: 'user',
    content: userMessage.content,
  });

  try {
    startOpencodeRun(session, content);
  } catch (error) {
    return fail(res, 500, 5000, error.message || 'Failed to start opencode');
  }

  return ok(res, cloneMessage(userMessage));
});

app.get(`${API_PREFIX}/sessions/:sessionId/messages`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  const page = parsePage(req.query.page, 0);
  const size = parseSize(req.query.size, 50);
  const messages = getSessionMessages(session.welinkSessionId).map((item) => cloneMessage(item));
  return ok(res, paginate(messages, page, size));
});

app.get(`${API_PREFIX}/sessions/:sessionId/messages/history`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  const size = parseSize(req.query.size, 50);
  const beforeSeq = req.query.beforeSeq !== undefined ? parsePositiveInt(req.query.beforeSeq) : null;
  const sortedMessages = getSessionMessages(session.welinkSessionId)
    .slice()
    .sort((left, right) => (left.seq || 0) - (right.seq || 0));

  const scoped = typeof beforeSeq === 'number'
    ? sortedMessages.filter((message) => (message.seq || 0) < beforeSeq)
    : sortedMessages;
  const startIndex = Math.max(0, scoped.length - size);
  const content = scoped.slice(startIndex).map((message) => cloneMessage(message));
  const hasMore = startIndex > 0;
  const nextBeforeSeq = hasMore && content[0] ? content[0].seq : null;

  return ok(res, {
    content,
    size,
    hasMore,
    nextBeforeSeq,
  });
});

app.post(`${API_PREFIX}/sessions/:sessionId/permissions/:permId`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  const response = typeof req.body?.response === 'string' ? req.body.response.trim() : '';
  if (!response) {
    return fail(res, 400, 1000, 'Response is required');
  }

  emitEvent(session, 'permission.reply', {
    permissionId: String(req.params.permId || ''),
    response,
  });

  return ok(res, {
    welinkSessionId: session.welinkSessionId,
    permissionId: String(req.params.permId || ''),
    response,
  });
});

app.post(`${API_PREFIX}/sessions/:sessionId/send-to-im`, (req, res) => {
  const session = getSessionFromRequest(req, res);
  if (!session) {
    return;
  }

  return ok(res, {
    success: true,
    welinkSessionId: session.welinkSessionId,
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

  ws.on('message', (rawMessage) => {
    const payload = String(rawMessage || '').trim();
    if (!payload) {
      return;
    }

    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === 'object' && parsed.action === 'resume') {
        sendBootstrapEvents(client);
      }
    } catch (error) {
      // ignore unsupported client payloads
    }
  });

  ws.on('close', () => {
    wsClients.delete(client);
  });

  ws.on('error', () => {
    wsClients.delete(client);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`OpenCode bridge is running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`WebSocket endpoint: ws://localhost:${PORT}${WS_PATH}`);
  // eslint-disable-next-line no-console
  console.log(`OpenCode workdir: ${DEFAULT_WORKDIR}`);
  // eslint-disable-next-line no-console
  console.log(`OpenCode config home: ${DEFAULT_CONFIG_HOME}`);
});
