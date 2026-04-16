import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import arrowUpIcon from '../imgs/arrow_up_icon.svg';
import copyIcon from '../imgs/icon-copy.svg';
import '../styles/CodeBlock.less';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { copyTextToClipboard } from '../utils/clipboard';
import { WeLog } from '../utils/logger';
import { showToast } from '../utils/toast';

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
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    void copyTextToClipboard(code)
      .then(() => {
        showToast(t('common.copySuccess'));
        setCopied(true);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch((error) => {
        WeLog(`CodeBlock copyTextToClipboard failed | error=${JSON.stringify(error)}`);
      });
  }, [code, t]);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const normalizedLanguage = normalizeLanguage(language);

  return (
    <div
      className={[
        'code-block',
        collapsed ? 'code-block--collapsed' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="code-block__header">
        <button
          className="code-block__toggle"
          type="button"
          aria-label={collapsed ? t('codeBlock.expand') : t('codeBlock.collapse')}
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
          aria-label={copied ? t('codeBlock.copied') : t('codeBlock.copy')}
          title={copied ? t('codeBlock.copied') : t('codeBlock.copy')}
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
