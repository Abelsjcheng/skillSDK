import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SelectAssistant from '../../pages/selectAssistant';
import * as constants from '../../constants';

const TEXT_SELECT_ASSISTANT = '\u9009\u62e9\u52a9\u624b';
const TEXT_BACK = '\u8fd4\u56de';
const TEXT_SERVICE = '\u5ba2\u670d';
const TEXT_START_USING = '\u5f00\u59cb\u4f7f\u7528';

describe('SelectAssistant', () => {
  let isPcMiniAppSpy: jest.SpyInstance<boolean, []>;

  beforeEach(() => {
    isPcMiniAppSpy = jest.spyOn(constants, 'isPcMiniApp');
  });

  afterEach(() => {
    isPcMiniAppSpy.mockRestore();
    delete (window as any).Pedestal;
    delete (window as any).HWH5EXT;
  });

  it('renders mobile layout when not in pc miniapp', async () => {
    isPcMiniAppSpy.mockReturnValue(false);
    Object.defineProperty(window, 'HWH5EXT', {
      value: {
        getWeAgentList: jest.fn(async () => ({ content: [] })),
      },
      configurable: true,
      writable: true,
    });

    const { container } = render(
      <MemoryRouter>
        <SelectAssistant />
      </MemoryRouter>,
    );

    expect(container.querySelector('.assistant-page-header__title')?.textContent).toBe(TEXT_SELECT_ASSISTANT);
    expect(screen.getByRole('button', { name: TEXT_BACK })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXT_SERVICE })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXT_START_USING })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '\u521b\u5efa\u52a9\u624b' })).not.toBeInTheDocument();
  });

  it('renders pc layout when in pc miniapp', async () => {
    isPcMiniAppSpy.mockReturnValue(true);
    Object.defineProperty(window, 'Pedestal', {
      value: {
        callMethod: jest.fn((_method: string, payload: { funName: string; params: unknown }) => {
          if (payload.funName === 'getWeAgentList') {
            return {
              content: [
                {
                  name: '\u6d4b\u8bd5\u52a9\u7406',
                  icon: '',
                  description: '\u7528\u4e8e\u6d4b\u8bd5\u81ea\u5b9a\u4e49\u6807\u7b7e\u56de\u9000',
                  partnerAccount: 'x00_1',
                  bizRobotName: 'staffAssistant',
                  bizRobotNameEn: 'staffAssistant',
                  bizRobotTag: 'myAgent',
                  robotId: '',
                },
              ],
            };
          }
          return undefined;
        }),
      },
      configurable: true,
      writable: true,
    });

    const { container } = render(
      <MemoryRouter>
        <SelectAssistant />
      </MemoryRouter>,
    );

    expect(container.querySelector('.start-assistant__title')?.textContent).toBe(TEXT_SELECT_ASSISTANT);
    expect(screen.queryByRole('button', { name: TEXT_BACK })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TEXT_SERVICE })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXT_START_USING })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '\u521b\u5efa\u52a9\u624b' })).not.toBeInTheDocument();
  });
});
