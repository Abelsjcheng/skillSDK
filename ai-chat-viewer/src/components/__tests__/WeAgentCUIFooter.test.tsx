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
    const onRequestSlashCommands = jest.fn().mockResolvedValue(undefined);
    const onSend = jest.fn();
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        slashCommands={[
          { command: '/new', description: '新建会话' },
          { command: '/help', description: '帮助' },
        ]}
        onRequestSlashCommands={onRequestSlashCommands}
        onSend={onSend}
        onStop={jest.fn()}
      />,
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('/n');

    await waitFor(() => expect(screen.getByText('/new')).toBeInTheDocument());
    expect(onRequestSlashCommands).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');

    expect(input).toHaveTextContent('/new');
    const slashToken = screen.getByTestId('slash-command-token');
    expect(slashToken).toHaveTextContent('/new');
    expect(slashToken).toHaveStyle({ color: '#0D94FF' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('moves highlight with arrow keys and closes with escape', async () => {
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        slashCommands={[
          { command: '/new', description: '新建会话' },
          { command: '/help', description: '帮助' },
        ]}
        onRequestSlashCommands={jest.fn().mockResolvedValue(undefined)}
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
    const onRequestSlashCommands = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        slashCommands={[{ command: '/new', description: '新建会话' }]}
        onRequestSlashCommands={onRequestSlashCommands}
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('hello /');

    expect(screen.queryByText('/new')).not.toBeInTheDocument();
    expect(onRequestSlashCommands).not.toHaveBeenCalled();
  });

  it('deletes a selected slash command as one token', async () => {
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        slashCommands={[{ command: '/new', description: '新建会话' }]}
        onRequestSlashCommands={jest.fn().mockResolvedValue(undefined)}
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
