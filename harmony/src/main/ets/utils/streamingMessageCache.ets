import { ChatMessage, StreamMessage } from '../types';

export interface StreamingMessage {
  id: string | number;
  sessionId: number;
  seq: number;
  role: string;
  content: string;
  contentType: string;
  createdAt: string;
  meta: string | null;
  isStreaming: boolean;
}

export class StreamingMessageCache {
  private cache: Map<string, StreamingMessage> = new Map();
  private sessionId: string = '';

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  updateFromStreamMessage(message: StreamMessage): void {
    if (message.type === 'delta') {
      const existingMessage = this.cache.get(this.sessionId);
      
      if (existingMessage) {
        existingMessage.content += message.content as string;
        existingMessage.seq = message.seq;
      } else {
        const streamingMessage: StreamingMessage = {
          id: `streaming-${this.sessionId}`,
          sessionId: parseInt(this.sessionId),
          seq: message.seq,
          role: 'ASSISTANT',
          content: message.content as string,
          contentType: 'MARKDOWN',
          createdAt: new Date().toISOString(),
          meta: JSON.stringify({ isStreaming: true }),
          isStreaming: true
        };
        this.cache.set(this.sessionId, streamingMessage);
      }
    } else if (message.type === 'done') {
      const existingMessage = this.cache.get(this.sessionId);
      if (existingMessage) {
        existingMessage.isStreaming = false;
        existingMessage.meta = JSON.stringify({
          isStreaming: false,
          usage: message.usage
        });
      }
    } else if (message.type === 'error') {
      this.clear();
    }
  }

  getStreamingMessage(): StreamingMessage | null {
    return this.cache.get(this.sessionId) || null;
  }

  hasStreamingMessage(): boolean {
    const message = this.cache.get(this.sessionId);
    return message !== null && message !== undefined && message.isStreaming;
  }

  clear(): void {
    this.cache.delete(this.sessionId);
  }

  mergeWithHistory(historyMessages: ChatMessage[]): ChatMessage[] {
    const streamingMessage = this.getStreamingMessage();
    
    if (!streamingMessage) {
      return historyMessages;
    }

    const existingIds = new Set(historyMessages.map(msg => msg.id));
    
    if (existingIds.has(parseInt(streamingMessage.id as string)) || 
        existingIds.has(streamingMessage.id)) {
      return historyMessages;
    }

    const mergedMessages: ChatMessage[] = [...historyMessages];
    
    const chatMessage: ChatMessage = {
      id: streamingMessage.id as number,
      sessionId: streamingMessage.sessionId,
      seq: streamingMessage.seq,
      role: streamingMessage.role,
      content: streamingMessage.content,
      contentType: streamingMessage.contentType,
      createdAt: streamingMessage.createdAt,
      meta: streamingMessage.meta
    };
    
    mergedMessages.push(chatMessage);
    
    return mergedMessages;
  }
}
