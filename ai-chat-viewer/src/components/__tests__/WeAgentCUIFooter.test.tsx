import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    expect(input).toHaveValue('/new ');
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
    expect(input).toHaveValue('/help ');

    await user.clear(input);
    await user.keyboard('/');
    await waitFor(() => expect(screen.getByText('/new')).toBeInTheDocument());
    await user.keyboard('{Escape}');

    expect(screen.queryByText('/new')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('closes slash suggestions when clicking outside the slash panel', async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">outside</button>
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
        />
      </>,
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('/');
    await waitFor(() => expect(screen.getByText('/new')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByText('/new')).not.toBeInTheDocument();
  });

  it('keeps slash suggestions open when clicking the input', async () => {
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

    await user.click(input);

    expect(screen.getByText('/new')).toBeInTheDocument();
  });

  it('closes slash suggestions when clicking the send button', async () => {
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

    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(screen.queryByText('/new')).not.toBeInTheDocument();
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

  it('does not commit pinyin letters while IME composition is active', async () => {
    const onSend = jest.fn();
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        slashCommands={[{ command: '/new', description: '新建会话' }]}
        onRequestSlashCommands={jest.fn().mockResolvedValue(undefined)}
        onSend={onSend}
        onStop={jest.fn()}
      />,
    );

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: '发送' });

    fireEvent.compositionStart(input);
    (input as HTMLTextAreaElement).value = 'ni';
    fireEvent.input(input, { inputType: 'insertCompositionText', data: 'ni' });

    expect(sendButton).toBeDisabled();

    (input as HTMLTextAreaElement).value = '你';
    fireEvent.compositionEnd(input);

    expect(sendButton).not.toBeDisabled();
    await user.click(sendButton);

    expect(onSend).toHaveBeenCalledWith('你');
  });

  it('keeps normal PC textarea input editable', async () => {
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
    await user.keyboard('hello');

    expect(input).toHaveValue('hello');
  });

  it('keeps the selected slash command as plain input text', async () => {
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

    expect(input).toHaveValue('/new ');

    await user.keyboard('{Backspace}');

    expect(input).toHaveValue('/new');
    await user.keyboard('{Backspace}');

    expect(input).toHaveValue('/ne');
  });
});
