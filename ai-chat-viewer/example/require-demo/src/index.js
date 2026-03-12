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
window.HWH5EXT = HWH5EXT;
if (!window.HWH5) {
  window.HWH5 = {
    close: function close() {
      console.log('[require-demo] window.HWH5.close called');
    },
  };
}
let sessionSeed = 20260310;
let mounted = false;

function setStatus(text) {
  if (!statusElement) return;
  statusElement.textContent = '[require-demo] ' + text;
}

function injectSessionIdToUrl() {
  sessionSeed += 1;
  var url = new URL(window.location.href);
  url.searchParams.set('welinkSessionId', String(sessionSeed));
  window.history.replaceState({}, '', url.toString());
}

function mount() {
  injectSessionIdToUrl();
  mountAIChatViewer(rootElement);
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
