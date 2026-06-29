import React, {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import type { SlashCommandComposerHandle, SlashCommandComposerProps } from '../../types/components';


function getTextNodeLength(node: Node): number {
  return node.textContent?.length ?? 0;
}

function getNodeTextLength(node: Node): number {
  return node.textContent?.length ?? 0;
}

function getOffsetForSelectionPoint(root: HTMLElement, targetNode: Node | null, targetOffset: number): number {
  if (!targetNode || !root.contains(targetNode)) {
    return normalizeComposerText(root).length;
  }

  let offset = 0;
  let found = false;

  const visit = (node: Node): void => {
    if (found) {
      return;
    }

    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += targetOffset;
      } else {
        Array.from(node.childNodes).slice(0, targetOffset).forEach((childNode) => {
          offset += getNodeTextLength(childNode);
        });
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += getTextNodeLength(node);
      return;
    }

    Array.from(node.childNodes).forEach(visit);
  };

  visit(root);
  return offset;
}

function getCaretOffset(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return normalizeComposerText(root).length;
  }
  return getOffsetForSelectionPoint(root, selection.anchorNode, selection.anchorOffset);
}

function getSelectionRange(root: HTMLElement): { start: number; end: number } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    const cursor = normalizeComposerText(root).length;
    return { start: cursor, end: cursor };
  }

  const anchorOffset = getOffsetForSelectionPoint(root, selection.anchorNode, selection.anchorOffset);
  const focusOffset = getOffsetForSelectionPoint(root, selection.focusNode, selection.focusOffset);
  return {
    start: Math.min(anchorOffset, focusOffset),
    end: Math.max(anchorOffset, focusOffset),
  };
}

function setCaretOffset(root: HTMLElement, cursor: number): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const safeCursor = Math.max(0, cursor);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = safeCursor;
  let currentNode = walker.nextNode();
  while (currentNode) {
    const nodeLength = getTextNodeLength(currentNode);
    if (remaining <= nodeLength) {
      const range = document.createRange();
      range.setStart(currentNode, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= nodeLength;
    currentNode = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function normalizeComposerText(element: HTMLElement): string {
  return (element.innerText ?? element.textContent ?? '').replace(/\n$/, '');
}

const SlashCommandComposer = forwardRef<SlashCommandComposerHandle, SlashCommandComposerProps>(({
  className,
  isPcMiniApp = false,
  placeholder,
  slashToken,
  value,
  onChange,
  onKeyDown,
}, ref) => {
  const composerRef = useRef<HTMLDivElement | null>(null);
  const nextCursorRef = useRef<number | null>(null);
  const hasSlashToken = Boolean(
    slashToken && value.slice(slashToken.start, slashToken.end) === slashToken.command,
  );

  useImperativeHandle(ref, () => ({
    focus: () => {
      composerRef.current?.focus();
    },
    getSelectionRange: () => {
      if (!composerRef.current) {
        return { start: value.length, end: value.length };
      }
      return getSelectionRange(composerRef.current);
    },
    setCursor: (cursor: number) => {
      nextCursorRef.current = cursor;
      const element = composerRef.current;
      if (!element) {
        return;
      }
      element.focus();
      setCaretOffset(element, cursor);
    },
  }), []);

  useLayoutEffect(() => {
    const cursor = nextCursorRef.current;
    if (cursor === null || !composerRef.current) {
      return;
    }
    nextCursorRef.current = null;
    composerRef.current.focus();
    setCaretOffset(composerRef.current, cursor);
  }, [value, slashToken]);

  const handleInput = (event: React.FormEvent<HTMLDivElement>): void => {
    const target = event.currentTarget;
    const cursor = getCaretOffset(target);
    nextCursorRef.current = cursor;
    onChange(normalizeComposerText(target), cursor);
  };

  const renderContent = () => {
    if (!hasSlashToken || !slashToken) {
      return value;
    }

    return (
      <>
        {value.slice(0, slashToken.start)}
        <span
          className="we-agent-cui-footer__slash-token"
          contentEditable={false}
          data-testid="slash-command-token"
          data-slash-token={slashToken.command}
          style={{ color: '#0D94FF' }}
        >
          {slashToken.command}
        </span>
        {value.slice(slashToken.end)}
      </>
    );
  };

  return (
    <div
      ref={composerRef}
      role="textbox"
      aria-label={placeholder}
      aria-multiline={isPcMiniApp}
      className={className}
      contentEditable
      data-placeholder={placeholder}
      data-empty={value ? 'false' : 'true'}
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }}
    >
      {renderContent()}
    </div>
  );
});

SlashCommandComposer.displayName = 'SlashCommandComposer';

export default SlashCommandComposer;
