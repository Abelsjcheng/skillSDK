import React, { useRef, useState, useCallback } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1e1e2e',
    marginBlock: 8,
    fontSize: 13,
    lineHeight: 1.6,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 12px',
    backgroundColor: '#181825',
    color: '#a6adc8',
    fontSize: 12,
  },
  copyBtn: {
    background: 'none',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#cdd6f4',
    cursor: 'pointer',
    padding: '2px 8px',
    fontSize: 11,
    transition: 'all 0.2s',
  },
  pre: {
    margin: 0,
    padding: 12,
    overflowX: 'auto',
    color: '#cdd6f4',
    fontFamily: 'Consolas, "Courier New", Monaco, monospace',
    whiteSpace: 'pre',
    tabSize: 2,
  },
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const langLabel = language ?? 'text';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>{langLabel}</span>
        <button style={styles.copyBtn} onClick={handleCopy} type="button">
          {copied ? '已复制!' : '复制'}
        </button>
      </div>
      <pre style={styles.pre}>
        <code>{code}</code>
      </pre>
    </div>
  );
};