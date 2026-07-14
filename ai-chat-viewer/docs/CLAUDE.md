# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`ai-chat-viewer` is a React-based H5/WeChat MiniApp chat interface for AI assistants (called "WeAgent"). It provides a conversation UI with streaming AI responses, tool call display, and assistant management.

## Common Commands

```bash
cd ai-chat-viewer
npm run dev          # Start dev server with hot reload
npm run build        # Production build
npm run build:pc     # PC MiniApp build (uses window.Pedestal adapter)
npm run build:uat    # UAT environment build
npm run lint         # ESLint check
npm run test         # Run Jest tests (--runInBand)
```

## Architecture

### Two Build Targets
- **H5/WeChat MiniApp**: Uses `window.HWH5` and `window.HWH5EXT` native bridge APIs
- **PC MiniApp**: Uses `window.Pedestal` with adapter pattern in `createPedestalAdapter()`
- **OpenCode**: Local development uses mock bridge in `src/opencode/installOpencodeBridge.ts`

### Native Bridge Layer
- `src/utils/hwext.ts` - Main wrapper for `window.HWH5EXT` (sendMessage, createNewSession, getSessionMessage, etc.)
- `src/types/bridge/hwext.ts` - TypeScript interfaces for HWH5Bridge and HWH5EXT
- `src/types/global.d.ts` - Global window interface declarations

### Chat Session Flow
1. `App.tsx` initializes via `useChatSession` hook
2. `useChatSession.ts` (29KB) manages messages, WebSocket streaming, pending previews
3. `Content.tsx` renders message list with scroll preservation
4. `MessageBubble.tsx` renders individual messages (user vs assistant variants)
5. `AvatarImage.tsx` handles avatar display with fallback logic

### Key Components
- `src/components/MessageBubble.tsx` - Chat message bubble with avatar, name, timestamp
- `src/components/PendingAssistantBubble.tsx` - "AI is generating" indicator with animated icon
- `src/components/ToolCard.tsx` - Tool call status display (pending/running/completed/error)
- `src/components/AvatarImage.tsx` - Avatar with remote image caching and fallback
- `src/components/ThinkingBlock.tsx` - Expandable streaming thinking display

### Routes (in `src/routes/AppRouter.tsx`)
- `/weAgentCUI` - Main chat interface
- `/skillCUI` - Skill CUI page
- `/assistantDetail` - Assistant detail page
- `/selectAssistant` - Assistant selection
- `/createAssistant` - Assistant creation flow

### Status Indicator Patterns
Existing status indicators use CSS classes: `.is-pending`, `.has-code-block`
Tool statuses: `pending`, `running`, `completed`, `error` (see `ToolCard.tsx`)

## Tech Stack

- React 18.3.1 + TypeScript 5.9.3
- React Router DOM 6.26.0 (HashRouter)
- react-i18next 15.7.3
- react-markdown 8.0.7 + remark-gfm + rehype-katex
- Webpack 5.105.4
- Jest 30.3.0 + Testing Library
