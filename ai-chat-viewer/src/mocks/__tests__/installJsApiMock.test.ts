import type { StreamMessage } from '../../types';

describe('installJsApiMock', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    delete (window as any).HWH5EXT;
    delete (window as any).HWH5;
    delete (window as any).__AI_CHAT_VIEWER_JSAPI_MOCK__;
    window.history.replaceState({}, '', 'http://localhost/#/weAgentCUI?assistantAccount=mock_assistant_001&mockJsApi=1');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits mock-um-file as UM encoded text instead of a structured file part', async () => {
    const { installJsApiMock } = await import('../installJsApiMock');

    installJsApiMock();
    const api = (window as any).HWH5EXT;
    const session = await api.createNewSession({ assistantAccount: 'mock_assistant_001' });
    const messages: StreamMessage[] = [];

    api.registerSessionListener({
      welinkSessionId: session.welinkSessionId,
      onMessage: (message: StreamMessage) => messages.push(message),
      onError: jest.fn(),
      onClose: jest.fn(),
    });

    await api.sendMessage({
      welinkSessionId: session.welinkSessionId,
      content: 'mock-um-file',
    });
    jest.runOnlyPendingTimers();

    const textDone = messages.find((message) => message.type === 'text.done');
    expect(textDone?.content).toContain('/:um_begin{');
    expect(textDone?.content).toContain('mock-um-release-notes.docx');
    expect(messages.some((message) => message.type === 'file')).toBe(false);
  });
  it('does not echo uploaded UM links in the assistant acknowledgement', async () => {
    const { installJsApiMock } = await import('../installJsApiMock');

    installJsApiMock();
    const api = (window as any).HWH5EXT;
    const session = await api.createNewSession({ assistantAccount: 'mock_assistant_001' });
    const messages: StreamMessage[] = [];
    const umLink = '/:um_begin{https://ai-chat-viewer.mock.local/downloads/mock-release-notes.md|File|2048000|mock-release-notes.md|0|;;mock_access_code|cdnUrl:https://ai-chat-viewer.mock.local/downloads/mock-release-notes.md}/:um_end';

    api.registerSessionListener({
      welinkSessionId: session.welinkSessionId,
      onMessage: (message: StreamMessage) => messages.push(message),
      onError: jest.fn(),
      onClose: jest.fn(),
    });

    await api.sendMessage({
      welinkSessionId: session.welinkSessionId,
      content: umLink,
    });
    jest.runOnlyPendingTimers();

    const textDone = messages.find((message) => message.type === 'text.done');
    expect(textDone?.content).toBe('Mock upload received. The file card above is rendered from the sent UM link.');
  });

  it('installs Pedestal file select and upload mocks for local preview', async () => {
    const { installJsApiMock } = await import('../installJsApiMock');

    installJsApiMock();

    const pedestal = (window as any).Pedestal;
    expect(typeof pedestal?.remote?.dialog?.showOpenDialog).toBe('function');
    expect(typeof pedestal?.callMethod).toBe('function');

    const selectResult = await pedestal.remote.dialog.showOpenDialog({
      title: 'select file',
      properties: ['openFile'],
      filters: [{ name: 'files', extensions: ['md'] }],
    });
    expect(selectResult).toEqual({
      canceled: false,
      filePaths: ['C:\\mock\\mock-release-notes.md'],
    });

    const uploadResult = await pedestal.callMethod('method://agentSkillsDialog/uploadFile', {
      fileName: 'mock-release-notes.md',
      filePath: selectResult.filePaths[0],
      uploadId: 'mock-upload-1',
    });
    expect(uploadResult).toMatchObject({
      success: 'true',
      uploadId: 'mock-upload-1',
      umPlainAccessCode: 'mock_upload_access_code',
    });
    expect(uploadResult.umLink).toContain('/:um_begin{');
    expect(uploadResult.umLink).toContain('mock-release-notes.md');
    expect(uploadResult.umLink).toContain('/:um_end');
  });
  it('routes PC Pedestal handleSdk calls through the mock skill API', async () => {
    const { installJsApiMock } = await import('../installJsApiMock');

    installJsApiMock();

    const pedestal = (window as any).Pedestal;
    const session = await pedestal.callMethod('method://agentSkills/handleSdk', {
      funName: 'createNewSession',
      params: { assistantAccount: 'mock_assistant_001' },
    });
    const messages: StreamMessage[] = [];
    const onMessage = (event: Event) => {
      messages.push((event as CustomEvent<{ msg: StreamMessage }>).detail.msg);
    };

    window.addEventListener('agentSkills_registerSessionListener_onMessage', onMessage);
    await pedestal.callMethod('method://agentSkills/handleSdk', {
      funName: 'registerSessionListener',
      params: { welinkSessionId: session.welinkSessionId },
    });
    await pedestal.callMethod('method://agentSkills/handleSdk', {
      funName: 'sendMessage',
      params: { welinkSessionId: session.welinkSessionId, content: 'mock-um-file' },
    });
    jest.runOnlyPendingTimers();
    window.removeEventListener('agentSkills_registerSessionListener_onMessage', onMessage);

    const textDone = messages.find((message) => message.type === 'text.done');
    expect(textDone?.content).toContain('/:um_begin{');
    expect(textDone?.content).toContain('mock-um-release-notes.docx');
  });

});

