import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import arrowUpIcon from '../imgs/arrow_up_icon.svg';
import copyIcon from '../imgs/icon-copy.svg';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { copyTextToClipboard } from '../utils/clipboard';
import { showToast } from '../utils/toast';
import '../styles/CodeBlock.less';

interface CodeBlockProps {
  code: string;
  language?: string;
}

function normalizeLanguage(language?: string): string {
  if (!language) return 'text';
  const normalized = language.toLowerCase();
  const aliasMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'jsx',
    tsx: 'tsx',
    sh: 'bash',
    shell: 'bash',
    yml: 'yaml',
    cxx: 'cpp',
    'c++': 'cpp',
    hpp: 'cpp',
  };
  return aliasMap[normalized] ?? normalized;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    void copyTextToClipboard(code)
      .then(() => {
        showToast('复制成功');
        setCopied(true);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch((error) => {
        console.error('copyTextToClipboard failed in CodeBlock:', error);
      });
  }, [code]);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const normalizedLanguage = normalizeLanguage(language);

  return (
    <div className={[
      'code-block',
      collapsed ? 'code-block--collapsed' : '',
    ].filter(Boolean).join(' ')}>
      <div className="code-block__header">
        <button
          className="code-block__toggle"
          type="button"
          aria-label={collapsed ? 'Expand code block' : 'Collapse code block'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((current) => !current)}
        >
          <span className="code-block__lang">{normalizedLanguage}</span>
          <img
            className={[
              'code-block__chevron-icon',
              collapsed ? 'is-collapsed' : '',
            ].filter(Boolean).join(' ')}
            src={arrowUpIcon}
            alt=""
            aria-hidden="true"
          />
        </button>
        <button
          className={[
            'code-block__copy-btn',
            copied ? 'is-copied' : '',
          ].filter(Boolean).join(' ')}
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              handleCopy();
            });
          }}
          type="button"
          aria-label={copied ? 'Copied' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy code'}
        >
          <img className="code-block__copy-icon" src={copyIcon} alt="" />
        </button>
      </div>
      {!collapsed ? (
        <SyntaxHighlighter
          className="code-block__syntax"
          language={normalizedLanguage}
          style={oneLight}
          codeTagProps={{ className: 'code-block__code' }}
          customStyle={{
            margin: 0,
            padding: '8px 12px',
            background: '#ffffff',
            overflowX: 'auto',
            fontSize: '15px',
            lineHeight: 1.8,
            borderRadius: 0,
          }}
          lineNumberStyle={{
            minWidth: '26px',
            paddingRight: '12px',
            color: '#a9a9a9',
            textAlign: 'right',
            userSelect: 'none',
            fontSize: '14px',
            fontWeight: 400,
            lineHeight: 1.8,
            fontFamily: '"SFMono-Regular", Consolas, "Courier New", Monaco, monospace',
            fontVariantNumeric: 'tabular-nums',
          }}
          showLineNumbers
        >
          {code}
        </SyntaxHighlighter>
      ) : null}
    </div>
  );
};
