import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import SkillCUI from '../pages/skillCUI';
import type { SkillCUIProps } from '../types/pages';
import { ensureLanguageInitialized } from '../i18n/config';
export type { SkillCUIProps };

const rootMap = new WeakMap<Element, Root>();

export function mountSkillCUI(container: Element, props?: SkillCUIProps): Root {
  let root = rootMap.get(container);
  if (!root) {
    root = createRoot(container);
    rootMap.set(container, root);
  }
  ensureLanguageInitialized();
  root.render(React.createElement(SkillCUI, props));
  return root;
}

export function unmountSkillCUI(container: Element): void {
  const root = rootMap.get(container);
  if (!root) return;
  root.unmount();
  rootMap.delete(container);
}

type SkillCUIExport = typeof SkillCUI & {
  mount: typeof mountSkillCUI;
  unmount: typeof unmountSkillCUI;
};

const SkillCUIWithMount = Object.assign(
  SkillCUI,
  {
    mount: mountSkillCUI,
    unmount: unmountSkillCUI,
  },
) as SkillCUIExport;

export { SkillCUIWithMount as SkillCUI };
export default SkillCUIWithMount;
