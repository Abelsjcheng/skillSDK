import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeAgentCUIFooter from '../assistant/WeAgentCUIFooter';
import { clearSlashCommandSuggestStateForTest } from '../../hooks/useSlashCommandSuggest';
import { clearSlashCommandMemoryStore } from '../../utils/slashCommandStore';

describe('WeAgentCUIFooter slash command suggestion', () => {
  beforeEach(() => {
    clearSlashCommandSuggestStateForTest();
    clearSlashCommandMemoryStore();
    delete (window as any).HWH5;
  });

  it('selects a slash command with keyboard on PC', async () => {
    (window as any).HWH5 = {
      fetch: jest.fn().mockResolvedValue({
        code: 200,
        errormsg: '',
        data: [
          { command: '/new', description: '新建会话' },
          { command: '/help', description: '帮助' },
        ],
      }),
    };
    const onSend = jest.fn();
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        ak="appkey"
        partnerAccount="partner-1"
        onSend={onSend}
        onStop={jest.fn()}
      />,
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('/n');

    await waitFor(() => expect(screen.getByText('/new')).toBeInTheDocument());
    await user.keyboard('{Enter}');

    expect(input).toHaveTextContent('/new');
    const slashToken = screen.getByTestId('slash-command-token');
    expect(slashToken).toHaveTextContent('/new');
    expect(slashToken).toHaveStyle({ color: '#0D94FF' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('moves highlight with arrow keys and closes with escape', async () => {
    (window as any).HWH5 = {
      fetch: jest.fn().mockResolvedValue({
        code: 200,
        errormsg: '',
        data: [
          { command: '/new', description: '新建会话' },
          { command: '/help', description: '帮助' },
        ],
      }),
    };
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        ak="appkey"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('/');
    await waitFor(() => expect(screen.getByText('/new')).toBeInTheDocument());

    await user.keyboard('{ArrowDown}{Enter}');
    expect(input).toHaveTextContent('/help');

    await user.keyboard('{Backspace}{Backspace}');
    await user.keyboard('/');
    await waitFor(() => expect(screen.getByText('/new')).toBeInTheDocument());
    await user.keyboard('{Escape}');

    expect(screen.queryByText('/new')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('only opens slash suggestions when slash is typed at the beginning', async () => {
    (window as any).HWH5 = {
      fetch: jest.fn().mockResolvedValue({
        code: 200,
        errormsg: '',
        data: [{ command: '/new', description: '新建会话' }],
      }),
    };
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        ak="appkey"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('hello /');

    expect(screen.queryByText('/new')).not.toBeInTheDocument();
    expect((window as any).HWH5.fetch).not.toHaveBeenCalled();
  });

  it('deletes a selected slash command as one token', async () => {
    (window as any).HWH5 = {
      fetch: jest.fn().mockResolvedValue({
        code: 200,
        errormsg: '',
        data: [{ command: '/new', description: '新建会话' }],
      }),
    };
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        ak="appkey"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('/n');
    await waitFor(() => expect(screen.getByText('/new')).toBeInTheDocument());
    await user.keyboard('{Enter}');

    expect(input).toHaveTextContent('/new');

    await user.keyboard('{Backspace}');

    expect(input).toHaveTextContent('/new');
    await user.keyboard('{Backspace}');

    expect(input).toBeEmptyDOMElement();
    expect(screen.queryByTestId('slash-command-token')).not.toBeInTheDocument();
  });
});
