import React, { useState, useCallback, useRef, useEffect } from 'react';
import Header from './components/Header';
import Content from './components/Content';
import Footer from './components/Footer';
import { ChatMessage, ChatState, AIProgressStatus } from './types';
import './styles/App.less';

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: '您好！我是 AI 助手，请问有什么可以帮您的吗？',
    timestamp: Date.now(),
  },
];

const initialProgress: AIProgressStatus = {
  status: 'idle',
  step: 0,
  totalSteps: 0,
};

const initialTitle = 'AI 智能问答';

function App() {
  const [chatState, setChatState] = useState<ChatState>({
    title: initialTitle,
    messages: initialMessages,
    progress: initialProgress,
    isLoading: false,
    isMaximized: false,
  });

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [chatState.messages]);

  const handleSendMessage = useCallback((content: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      progress: {
        status: 'thinking',
        step: 0,
        totalSteps: 3,
      },
      title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
    }));

    setTimeout(() => {
      setChatState((prev) => ({
        ...prev,
        progress: {
          status: 'processing',
          step: 1,
          totalSteps: 3,
        },
      }));
    }, 1000);

    setTimeout(() => {
      setChatState((prev) => ({
        ...prev,
        progress: {
          status: 'processing',
          step: 2,
          totalSteps: 3,
        },
      }));
    }, 2000);

    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: `感谢您的问题：**${content}**\n\n这是一个示例回复，实际使用时您可以接入真实的 AI 后端服务。\n\n## 功能特点\n\n1. **Markdown 渲染**: 支持各种 Markdown 格式\n2. **实时状态**: 显示 AI 执行进展\n3. **交互友好**: 简洁的界面设计\n\n\`\`\`javascript\nconsole.log('Hello World');\n\`\`\`\n\n> 如有任何问题，请随时提问！`,
        timestamp: Date.now(),
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, aiResponse],
        isLoading: false,
        progress: {
          status: 'completed',
          step: 3,
          totalSteps: 3,
        },
      }));

      setTimeout(() => {
        setChatState((prev) => ({
          ...prev,
          progress: {
            status: 'idle',
            step: 0,
            totalSteps: 0,
          },
        }));
      }, 2000);
    }, 3000);
  }, []);

  const handleMaximize = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      isMaximized: !prev.isMaximized,
    }));
  }, []);

  const handleClose = useCallback(() => {
    const confirmClose = window.confirm('确认要关闭当前问答吗？');
    if (confirmClose) {
      setChatState({
        title: initialTitle,
        messages: initialMessages,
        progress: initialProgress,
        isLoading: false,
        isMaximized: false,
      });
    }
  }, []);

  return (
    <div 
      className={`app-container ${chatState.isMaximized ? 'maximized' : ''}`}
    >
      <div className="header-wrapper">
        <Header
          title={chatState.title}
          progress={chatState.progress}
          isMaximized={chatState.isMaximized}
          onMaximize={handleMaximize}
          onClose={handleClose}
        />
      </div>
      <div className="content-wrapper" ref={contentRef}>
        <Content 
          messages={chatState.messages} 
          onSend={handleSendMessage} 
        />
      </div>
      <div className="footer-wrapper">
        <Footer 
          onSend={handleSendMessage} 
          disabled={chatState.isLoading} 
        />
      </div>
    </div>
  );
}

export default App;
