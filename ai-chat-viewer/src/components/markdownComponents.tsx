import React from 'react';
import type { Components } from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import { openH5Webview } from '../utils/hwext';

const INVALID_HTML_TAG_PATTERN = /<\/?([^\s>/]+)(?=[\s>/])/g;
const VALID_HTML_TAG_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;

function isSafeLink(href?: string): href is string {
  if (!href) {
    return false;
  }

  const normalizedHref = href.trim().toLowerCase();
  return normalizedHref !== '' && !normalizedHref.startsWith('javascript:');
}

export function normalizeMarkdownHtml(content: string): string {
  if (!content || content.indexOf('<') === -1) {
    return content;
  }

  return content.replace(INVALID_HTML_TAG_PATTERN, (match, tagName: string) => (
    VALID_HTML_TAG_NAME_PATTERN.test(tagName)
      ? match
      : match.replace('<', '&lt;')
  ));
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
