import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SelectAssistant from '../../pages/selectAssistant';

const TEXT_SELECT_ASSISTANT = '\u9009\u62e9\u52a9\u7406';
const TEXT_BACK = '\u8fd4\u56de';
const TEXT_SERVICE = '\u5ba2\u670d';
const TEXT_CREATE_ASSISTANT = '\u521b\u5efa\u52a9\u7406';
const TEXT_START_USING = '\u5f00\u59cb\u4f7f\u7528';
const TEXT_CUSTOM_ASSISTANT = '\u81ea\u5b9a\u4e49\u52a9\u7406';

describe('SelectAssistant', () => {
  afterEach(() => {
    delete (window as any).Pedestal;
  });

  it('renders mobile layout when not in pc miniapp', () => {
    Object.defineProperty(window, 'Pedestal', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <SelectAssistant />
      </MemoryRouter>,
    );

    expect(screen.getByText(TEXT_SELECT_ASSISTANT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXT_BACK })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXT_SERVICE })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXT_CREATE_ASSISTANT })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXT_START_USING })).toBeInTheDocument();
  });

  it('renders pc layout when in pc miniapp', async () => {
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
                  bizRobotName: '',
                  bizRobotNameEn: '',
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

    render(
      <MemoryRouter>
        <SelectAssistant />
      </MemoryRouter>,
    );

    expect(screen.getByText(TEXT_SELECT_ASSISTANT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TEXT_BACK })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TEXT_SERVICE })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXT_CREATE_ASSISTANT })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXT_START_USING })).toBeInTheDocument();
    expect(await screen.findByText(TEXT_CUSTOM_ASSISTANT)).toBeInTheDocument();
  });
});
