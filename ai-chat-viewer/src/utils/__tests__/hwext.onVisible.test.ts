import { isPcMiniApp } from '../../constants';
import { registerOnVisibleListener } from '../hwext';

jest.mock('../../constants', () => ({
  ...jest.requireActual('../../constants'),
  isPcMiniApp: jest.fn(),
}));

const mockIsPcMiniApp = isPcMiniApp as jest.MockedFunction<typeof isPcMiniApp>;

describe('registerOnVisibleListener', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as typeof window & { Pedestal?: unknown }).Pedestal;
    delete (window as typeof window & { HWH5?: unknown }).HWH5;
  });

  it('registers mobile onVisible and forwards the visibility payload', async () => {
    mockIsPcMiniApp.mockReturnValue(false);
    const listener = jest.fn();
    const addEventListener = jest.fn();
    Object.defineProperty(window, 'HWH5', {
      value: { addEventListener },
      configurable: true,
    });

    await registerOnVisibleListener(listener);

    expect(addEventListener).toHaveBeenCalledWith(expect.objectContaining({ type: 'onVisible' }));
    const params = addEventListener.mock.calls[0][0] as { func: (payload: { visibility: 0 | 1 }) => void };
    params.func({ visibility: 0 });
    expect(listener).toHaveBeenCalledWith({ visibility: 0 });
  });

  it('maps PC page-visible events to visibility 1', async () => {
    mockIsPcMiniApp.mockReturnValue(true);
    const listener = jest.fn();
    const addEventListener = jest.spyOn(window, 'addEventListener');
    Object.defineProperty(window, 'Pedestal', {
      value: { callMethod: jest.fn() },
      configurable: true,
    });

    await registerOnVisibleListener(listener);

    const pageVisibleRegistration = addEventListener.mock.calls.find(
      ([type]) => type === 'agentskills_pageVisible',
    );
    expect(pageVisibleRegistration).toBeDefined();
    (pageVisibleRegistration?.[1] as EventListener)(new Event('agentskills_pageVisible'));
    expect(listener).toHaveBeenCalledWith({ visibility: 1 });
  });
});
