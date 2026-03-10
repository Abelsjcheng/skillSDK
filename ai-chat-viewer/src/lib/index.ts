import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import AIChatViewer, { AIChatViewerProps } from './AIChatViewer';
import type {
  Message,
  MessagePart,
  StreamMessage,
  SessionMessage,
  SessionStatus,
  AgentStatus,
} from '../types';

export type { AIChatViewerProps };
export type {
  Message,
  MessagePart,
  StreamMessage,
  SessionMessage,
  SessionStatus,
  AgentStatus,
};

const rootMap = new WeakMap<Element, Root>();

export function mountAIChatViewer(
  container: Element,
  props: AIChatViewerProps,
): Root {
  let root = rootMap.get(container);
  if (!root) {
    root = createRoot(container);
    rootMap.set(container, root);
  }

  root.render(React.createElement(AIChatViewer, props));
  return root;
}

export function unmountAIChatViewer(container: Element): void {
  const root = rootMap.get(container);
  if (!root) return;
  root.unmount();
  rootMap.delete(container);
}

type AIChatViewerExport = typeof AIChatViewer & {
  mount: typeof mountAIChatViewer;
  unmount: typeof unmountAIChatViewer;
};

const AIChatViewerWithMount = Object.assign(
  AIChatViewer,
  {
    mount: mountAIChatViewer,
    unmount: unmountAIChatViewer,
  },
) as AIChatViewerExport;

export { AIChatViewerWithMount as AIChatViewer };
export default AIChatViewerWithMount;
