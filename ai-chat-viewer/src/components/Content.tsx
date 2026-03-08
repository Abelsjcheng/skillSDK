import React, { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../types';
import '../styles/Content.less';

interface ContentProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
}

const Content: React.FC<ContentProps> = ({ messages, onSend }) => {
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      showToast('已复制到剪贴板');
    }).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('已复制到剪贴板');
    });
  }, []);

  const handleSendToChat = useCallback((content: string) => {
    onSend(content);
  }, [onSend]);

  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('copy-toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  };

  return (
    <div className="content">
      <div className="messages-container">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message-block ${message.role === 'user' ? 'message-user' : 'message-assistant'}`}
          >
            <div className="message-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
            {message.role === 'assistant' && (
              <div className="message-actions">
                <button 
                  className="action-btn copy-btn" 
                  onClick={() => handleCopy(message.content)}
                  title="复制内容"
                >
                  📋 复制
                </button>
                <button 
                  className="action-btn send-btn" 
                  onClick={() => handleSendToChat(message.content)}
                  title="发送到聊天"
                >
                  ↗️ 发送
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Content;
