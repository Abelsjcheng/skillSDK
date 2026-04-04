import React from 'react';
import type { Components } from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import { openH5Webview } from '../utils/hwext';

function isSafeLink(href?: string): href is string {
  if (!href) {
    return false;
  }

  const normalizedHref = href.trim().toLowerCase();
  return normalizedHref !== '' && !normalizedHref.startsWith('javascript:');
}

export function createMarkdownComponents(includeCodeBlock = false): Components {
  return {
    a({ href, children, ...props }) {
      return (
        <a
          {...props}
          href={href}
          onClick={(event) => {
            if (!isSafeLink(href)) {
              return;
            }
            event.preventDefault();
            openH5Webview({ uri: href });
          }}
        >
          {children}
        </a>
      );
    },
    ...(includeCodeBlock
      ? {
        code({ className, children, ...rest }) {
          const match = /language-(\w+)/.exec(className ?? '');
          const codeString = String(children).replace(/\n$/, '');
          if (match) {
            return <CodeBlock code={codeString} language={match[1]} />;
          }
          return (
            <code className={className} {...rest}>
              {children}
            </code>
          );
        },
      }
      : {}),
  };
}
