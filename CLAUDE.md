# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **multi-platform Skill SDK** project for integrating AI skill capabilities into IM clients, OpenCode Skill servers, and mini-apps. The SDK enables real-time AI responses via WebSocket streaming.

### Sub-projects

| Platform | Path | Language | Notes |
|----------|------|----------|-------|
| Harmony | `harmony/` | ArkTS | Entry: `harmony/src/main/ets/index.ets` |
| iOS | `ios/WLAgentSkillsSDK/` | Objective-C | Uses AFNetworking |
| Android | `android/skill-sdk/` | Java | Uses OkHttp, Gson; minSdk 24 |
| AI Chat Viewer | `ai-chat-viewer/` | React + TypeScript | Web demo UI |
| Vue3 Demo | `vue3-skill-demo/` | Vue 2 | Demo integration |
| Mock Server | `skill-mock-server/` | Node.js | Testing server |

## Commands

### AI Chat Viewer
```bash
cd ai-chat-viewer
npm install
npm run dev      # Development server on localhost:3000
npm run build    # Production build to dist/
npm run lint     # Code linting
npx jest         # Run tests
```

### Skill Mock Server
```bash
cd skill-mock-server
npm install
npm start              # Start server
npm run start:opencode # Start with OpenCode bridge
```

### Vue3 Skill Demo
```bash
cd vue3-skill-demo
npm install
npm run dev    # Webpack dev server
npm run build  # Production build
```

## Architecture

### Core SDK Pattern (All Platforms)
All platform SDKs implement the same **13 interfaces** for session management:

1. `createSession` - Create/reuse session, ensure WebSocket connection
2. `closeSkill` - Close local WebSocket, keep server session
3. `stopSkill` - Stop current round execution, session remains active
4. `onSessionStatusChange` - Listen for `executing/stopped/completed` states
5. `onSkillWecodeStatusChange` - Listen for `closed/minimized` states
6. `regenerateAnswer` - Regenerate response for last user message
7. `sendMessageToIM` - Send final AI message to IM
8. `getSessionMessage` - Get session message list (history + streaming merge)
9. `registerSessionListener` - Register streaming listener (one per sessionId, error 4011 on duplicate)
10. `unregisterSessionListener` - Remove listener by sessionId
11. `sendMessage` - Send user message, trigger AI response
12. `replyPermission` - Approve/reject `once/always/reject` permission requests
13. `controlSkillWeCode` - Control mini-app `close` or `minimize`

### WebSocket Streaming
- Single WebSocket connection receives all session messages (multiplexing)
- Internal cache listener auto-registers to prevent data loss before user registers
- Messages include: `delta` (incremental content), `done` (completion), `error`, `agent_offline/online`
- `getSessionMessage` merges server history with local streaming cache

### Data Flow
```
createSession (REST) → WebSocket connect → sendMessage (REST) → AI response stream
                                        ↓
                              registerSessionListener callbacks
```

## Key Files

### Interface Documentation
- `Skill_SDK_接口文档.md` - Full API documentation with data flow diagrams
- `DigitalTwinSdkInterfaceV1.md` - Digital twin (分身) SDK interface
- `min-api.md` - Event message types (`message.updated`, `message.part.delta`, `permission.asked`, etc.)

### Platform SDKs
- `harmony/README.md` - HarmonyOS SDK usage
- `ios/README.md` - iOS SDK usage
- `android/README.md` - Android SDK usage
- `ai-chat-viewer/README.md` - React viewer project details

## Testing

The `skill-mock-server` provides a local testing server. Start it before testing any SDK:
```bash
cd skill-mock-server && npm start
```

## Error Handling

All SDKs throw typed exceptions:
- **Harmony**: `SkillSdkException` with `errorCode`, `errorMessage`
- **iOS**: `NSError` with `WLAgentSkillsErrorCodeKey`, `WLAgentSkillsErrorMessageKey`
- **Android**: `SkillSdkException` with `getErrorCode()`, `getErrorMessage()`
