import { reportCoreFlowError } from '../telemetry';

describe('reportCoreFlowError', () => {
  const uem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'HWH5', {
      value: {
        getAppInfo: jest.fn(async () => ({
          language: 'zh',
          versionName: '1.2.3',
          environment: 'uat',
        })),
        getDeviceInfo: jest.fn(async () => ({
          osType: 'ios',
          statusBarHeight: 0,
        })),
        log: jest.fn(),
        uem,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    delete (window as any).HWH5;
  });

  it('reports flow error with common fields and normalized error details', async () => {
    const error = {
      errorCode: 50001,
      errorMessage: 'bridge unavailable',
    };

    await reportCoreFlowError('flow_host_bridge_error', '宿主桥接错误', error, {
      page: 'createAssistant',
      stage: 'openIMChat',
      bridgeMethod: 'openIMChat',
    });

    expect(uem).toHaveBeenCalledWith('event', expect.objectContaining({
      code: 'flow_host_bridge_error',
      name: '宿主桥接错误',
      data: expect.objectContaining({
        entry: 'WeAgent',
        clientType: 'ios',
        versionName: '1.2.3',
        environment: 'uat',
        type: 'error',
        page: 'createAssistant',
        stage: 'openIMChat',
        bridgeMethod: 'openIMChat',
        errorCode: '50001',
        errorMessage: 'bridge unavailable',
      }),
    }));
  });
});
