describe('installJsApiMock session deletion helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    window.history.pushState({}, '', '/#/weAgentCUI?mockJsApi=1');
    delete (window as any).Pedestal;
    delete (window as any).HWH5EXT;
    delete (window as any).HWH5;
    delete (window as any).__AI_CHAT_VIEWER_JSAPI_MOCK__;
    delete (window as any).__AI_CHAT_VIEWER_MOCK__;
  });

  it('deletes a mock session through HWH5.fetch and emits session.deleted', async () => {
    const { installJsApiMock } = await import('../installJsApiMock');
    installJsApiMock();

    const sessionId = window.__AI_CHAT_VIEWER_MOCK__?.listSessionIds()[0] ?? '';
    const onMessage = jest.fn();
    window.HWH5EXT?.registerSessionListener({
      welinkSessionId: sessionId,
      onMessage,
    });

    const response = await window.HWH5.fetch?.(
      `/api/skill/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'delete',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    const reply = await response?.json();

    expect(reply).toEqual({
      code: 0,
      data: {
        status: 'deleted',
        welinkSessionId: sessionId,
      },
    });
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'session.deleted',
      sessionId,
      content: {
        welinkSessionId: sessionId,
      },
    }));
    expect(window.__AI_CHAT_VIEWER_MOCK__?.listSessionIds()).not.toContain(sessionId);
  });

  it('emits session.deleted from the debug helper', async () => {
    const { installJsApiMock } = await import('../installJsApiMock');
    installJsApiMock();

    const sessionId = window.__AI_CHAT_VIEWER_MOCK__?.listSessionIds()[0] ?? '';
    const onMessage = jest.fn();
    window.HWH5EXT?.registerSessionListener({
      welinkSessionId: sessionId,
      onMessage,
    });

    expect(window.__AI_CHAT_VIEWER_MOCK__?.emitSessionDeleted(sessionId)).toBe(true);
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'session.deleted',
      sessionId,
      content: {
        welinkSessionId: sessionId,
      },
    }));
  });
});
