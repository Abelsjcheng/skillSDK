import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createHighlighter, type Highlighter } from 'shiki';

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
  },
  pre: {
    margin: 0,
    padding: 12,
    overflowX: 'auto',
  },
  fallbackCode: {
    margin: 0,
    padding: 12,
    overflowX: 'auto',
    color: '#cdd6f4',
    fontFamily: 'Consolas, "Courier New", monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
};

let highlighterPromise: Promise<Highlighter> | null = null;

function getOrCreateHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['catppuccin-mocha'],
      langs: [
        'javascript',
        'typescript',
        'json',
        'html',
        'css',
        'python',
        'java',
        'go',
        'rust',
        'bash',
        'sql',
        'yaml',
        'markdown',
        'tsx',
        'jsx',
      ],
    });
  }
  return highlighterPromise;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const highlighter = await getOrCreateHighlighter();
        const langs = highlighter.getLoadedLanguages();
        const lang = language && langs.includes(language) ? language : 'text';

        if (language && !langs.includes(language)) {
          try {
            await highlighter.loadLanguage(language as Parameters<Highlighter['loadLanguage']>[0]);
            if (!cancelled) {
              const result = highlighter.codeToHtml(code, {
                lang: language,
                theme: 'catppuccin-mocha',
              });
              setHtml(result);
              return;
            }
          } catch {
            /* fall through to default */
          }
        }

        if (!cancelled) {
          const result = highlighter.codeToHtml(code, {
            lang,
            theme: 'catppuccin-mocha',
          });
          setHtml(result);
        }
      } catch {
        /* highlighter failed; fall back to plain text */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

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
      {html ? (
        <div
          style={styles.pre}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre style={styles.fallbackCode}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};