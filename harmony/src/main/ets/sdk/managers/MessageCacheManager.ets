/**
 * Message Cache Manager
 * 消息缓存管理器，用于缓存流式消息和历史消息合并
 */

import { StreamMessage, ChatMessage, StreamingMessageCache } from '../types';

export class MessageCacheManager {
  // 流式消息缓存 (sessionId -> StreamingMessageCache)
  private streamingCache: Map<string, StreamingMessageCache> = new Map();
  
  private enableLog: boolean;

  constructor(enableLog: boolean = false) {
    this.enableLog = enableLog;
  }

  /**
   * 更新流式消息缓存
   * 根据WebSocket消息类型更新缓存
   */
  updateStreamingCache(message: StreamMessage): void {
    const sessionId = message.sessionId;
    
    switch (message.type) {
      case 'delta':
        // 增量消息 - 累加内容
        this.handleDeltaMessage(sessionId, message);
        break;
      case 'done':
        // 完成消息 - 标记完成
        this.handleDoneMessage(sessionId);
        break;
      case 'error':
        // 错误消息 - 清理缓存
        this.handleErrorMessage(sessionId);
        break;
      default:
        if (this.enableLog) {
          console.log(`[MessageCacheManager] Unhandled message type: ${message.type}`);
        }
    }
  }

  /**
   * 处理增量消息
   */
  private handleDeltaMessage(sessionId: string, message: StreamMessage): void {
    const existingCache = this.streamingCache.get(sessionId);
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    
    if (existingCache) {
      // 累加内容
      existingCache.content += content;
      existingCache.seq = message.seq;
      existingCache.lastUpdated = Date.now();
    } else {
      // 创建新缓存
      this.streamingCache.set(sessionId, {
        sessionId: sessionId,
        messageId: `streaming-${sessionId}`,
        content: content,
        seq: message.seq,
        isStreaming: true,
        createdAt: new Date().toISOString(),
        lastUpdated: Date.now()
      });
      
      if (this.enableLog) {
        console.log(`[MessageCacheManager] Created streaming cache for session: ${sessionId}`);
      }
    }
  }

  /**
   * 处理完成消息
   */
  private handleDoneMessage(sessionId: string): void {
    const cache = this.streamingCache.get(sessionId);
    if (cache) {
      cache.isStreaming = false;
      cache.lastUpdated = Date.now();
      
      if (this.enableLog) {
        console.log(`[MessageCacheManager] Streaming completed for session: ${sessionId}`);
      }
    }
  }

  /**
   * 处理错误消息
   */
  private handleErrorMessage(sessionId: string): void {
    this.streamingCache.delete(sessionId);
    
    if (this.enableLog) {
      console.log(`[MessageCacheManager] Cache cleared for session due to error: ${sessionId}`);
    }
  }

  /**
   * 获取流式消息缓存
   */
  getStreamingCache(sessionId: string): StreamingMessageCache | null {
    return this.streamingCache.get(sessionId) || null;
  }

  /**
   * 合并历史消息和流式消息
   * 用于 getSessionMessage 接口
   */
  mergeMessages(historicalMessages: ChatMessage[], sessionId: string): ChatMessage[] {
    const cache = this.streamingCache.get(sessionId);
    
    if (!cache) {
      return historicalMessages;
    }

    // 检查是否需要合并
    // 如果历史消息中已包含相同消息（通过seq判断），则不合并
    const maxSeq = Math.max(...historicalMessages.map(m => m.seq), 0);
    
    if (cache.seq <= maxSeq) {
      // 历史消息已包含此消息，不合并
      return historicalMessages;
    }

    // 构造流式消息对象
    const streamingMessage: ChatMessage = {
      id: cache.messageId,
      sessionId: parseInt(sessionId) || 0,
      seq: cache.seq,
      role: 'ASSISTANT',
      content: cache.content,
      contentType: 'MARKDOWN',
      createdAt: cache.createdAt,
      meta: JSON.stringify({ isStreaming: cache.isStreaming })
    };

    // 合并到消息列表
    const merged = [...historicalMessages, streamingMessage];
    
    if (this.enableLog) {
      console.log(`[MessageCacheManager] Merged streaming message for session: ${sessionId}`);
    }

    return merged;
  }

  /**
   * 清除指定会话的缓存
   */
  clearCache(sessionId: string): void {
    this.streamingCache.delete(sessionId);
    
    if (this.enableLog) {
      console.log(`[MessageCacheManager] Cache cleared for session: ${sessionId}`);
    }
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.streamingCache.clear();
    
    if (this.enableLog) {
      console.log('[MessageCacheManager] All cache cleared');
    }
  }

  /**
   * 检查是否有流式消息正在传输
   */
  isStreaming(sessionId: string): boolean {
    const cache = this.streamingCache.get(sessionId);
    return cache ? cache.isStreaming : false;
  }

  /**
   * 更新日志开关
   */
  setEnableLog(enable: boolean): void {
    this.enableLog = enable;
  }
}