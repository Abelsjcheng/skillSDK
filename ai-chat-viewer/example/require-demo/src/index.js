const AIChatViewerModule = require('../../../dist/lib/index.js');
const { createMockHwh5ext } = require('./mockHwh5ext');

const AIChatViewerExport =
  AIChatViewerModule.default ||
  AIChatViewerModule.AIChatViewer ||
  AIChatViewerModule;

const mountAIChatViewer =
  AIChatViewerModule.mountAIChatViewer ||
  (AIChatViewerExport && AIChatViewerExport.mount);

const unmountAIChatViewer =
  AIChatViewerModule.unmountAIChatViewer ||
  (AIChatViewerExport && AIChatViewerExport.unmount);

const rootElement = document.getElementById('root');
const statusElement = document.getElementById('status');
const mountButton = document.getElementById('mountBtn');
const unmountButton = document.getElementById('unmountBtn');
const remountButton = document.getElementById('remountBtn');

if (!rootElement) {
  throw new Error('[require-demo] Missing #root container.');
}

if (typeof mountAIChatViewer !== 'function') {
  throw new Error('[require-demo] mountAIChatViewer is not available.');
}

if (typeof unmountAIChatViewer !== 'function') {
  throw new Error('[require-demo] unmountAIChatViewer is not available.');
}

const HWH5EXT = createMockHwh5ext();
let sessionSeed = 20260310;
let mounted = false;

function setStatus(text) {
  if (!statusElement) return;
  statusElement.textContent = '[require-demo] ' + text;
}

function buildProps() {
  sessionSeed += 1;
  return {
    welinkSessionId: sessionSeed,
    HWH5EXT: HWH5EXT,
    onMinimize: function onMinimize() {
      console.log('[require-demo] minimize callback');
    },
    onClose: function onClose() {
      console.log('[require-demo] close callback');
    },
  };
}

function mount() {
  mountAIChatViewer(rootElement, buildProps());
  mounted = true;
  setStatus('mounted');
}

function unmount() {
  unmountAIChatViewer(rootElement);
  mounted = false;
  setStatus('unmounted');
}

function remount() {
  if (mounted) {
    unmount();
  }
  mount();
}

if (mountButton) {
  mountButton.addEventListener('click', mount);
}
if (unmountButton) {
  unmountButton.addEventListener('click', unmount);
}
if (remountButton) {
  remountButton.addEventListener('click', remount);
}

mount();

window.addEventListener('beforeunload', function onBeforeUnload() {
  if (!mounted) return;
  unmountAIChatViewer(rootElement);
});
