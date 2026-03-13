import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import App, { type AppProps } from '../App';
import type {
  Message,
  MessagePart,
  StreamMessage,
  SessionMessage,
  SessionStatus,
  AgentStatus,
} from '../types';

export type {
  AppProps,
  Message,
  MessagePart,
  StreamMessage,
  SessionMessage,
  SessionStatus,
  AgentStatus,
};

const rootMap = new WeakMap<Element, Root>();

export function mountAIChatViewer(container: Element, props?: AppProps): Root {
  let root = rootMap.get(container);
  if (!root) {
    root = createRoot(container);
    rootMap.set(container, root);
  }

  root.render(React.createElement(App, props));
  return root;
}

export function unmountAIChatViewer(container: Element): void {
  const root = rootMap.get(container);
  if (!root) return;
  root.unmount();
  rootMap.delete(container);
}

type AppExport = typeof App & {
  mount: typeof mountAIChatViewer;
  unmount: typeof unmountAIChatViewer;
};

const AppWithMount = Object.assign(
  App,
  {
    mount: mountAIChatViewer,
    unmount: unmountAIChatViewer,
  },
) as AppExport;

export { AppWithMount as App };
export { AppWithMount as AIChatViewer };
export default AppWithMount;
