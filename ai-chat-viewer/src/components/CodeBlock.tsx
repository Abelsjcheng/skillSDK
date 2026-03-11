import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import '../styles/CodeBlock.less';

interface CodeBlockProps {
  code: string;
  language?: string;
}

function normalizeLanguage(language?: string): string {
  console.log('language', language);
  
  if (!language) return 'text';
  return language.toLowerCase();
}

function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    void copyText(code).then(() => {
      setCopied(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const normalizedLanguage = normalizeLanguage(language);

  return (
    <div className="code-block">
      <div className="code-block__header">
        <span className="code-block__lang">{normalizedLanguage}</span>
        <button className="code-block__copy-btn" onClick={handleCopy} type="button">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        className="code-block__syntax"
        language={normalizedLanguage}
        style={oneDark}
        codeTagProps={{ className: 'code-block__code' }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};
