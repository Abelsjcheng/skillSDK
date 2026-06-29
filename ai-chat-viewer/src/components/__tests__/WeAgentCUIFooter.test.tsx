import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeAgentCUIFooter from '../assistant/WeAgentCUIFooter';
import { uploadAgentFile } from '../../utils/agentFileUpload';
import { AGENT_FILE_SELECT_TITLE, AGENT_SUPPORTED_FILE_EXTENSIONS } from '../../utils/agentFileSelect';
import { showToast } from '../../utils/toast';
import { clearSlashCommandSuggestStateForTest } from '../../hooks/useSlashCommandSuggest';
import { zh } from '../../i18n/resources/zh';
import { clearSlashCommandMemoryStore } from '../../utils/slashCommandStore';

jest.mock('../../utils/agentFileUpload', () => ({
  uploadAgentFile: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  WeLog: jest.fn(),
}));

jest.mock('../../utils/toast', () => ({
  showToast: jest.fn(),
}));

const mockUploadAgentFile = uploadAgentFile as jest.MockedFunction<typeof uploadAgentFile>;
const mockShowToast = showToast as jest.MockedFunction<typeof showToast>;

function mockFileDialog(filePaths: string[] = ['C:\\tmp\\report.doc'], canceled = false) {
  const showOpenDialog = jest.fn().mockResolvedValue({ canceled, filePaths });
  (window as any).Pedestal = {
    remote: {
      dialog: {
        showOpenDialog,
      },
    },
  };
  return showOpenDialog;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('WeAgentCUIFooter slash command suggestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSlashCommandSuggestStateForTest();
    clearSlashCommandMemoryStore();
    delete (window as any).HWH5;
    delete (window as any).Pedestal;
  });

  it('selects a slash command with keyboard on PC', async () => {
    (window as any).HWH5 = {
      fetch: jest.fn().mockResolvedValue({
        code: 200,
        errormsg: '',
        data: [
          { command: '/new', description: 'new session' },
          { command: '/help', description: 'help' },
        ],
      }),
    };
    const onSend = jest.fn();
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        slashCommands={[
          { command: '/new', description: 'New session' },
          { command: '/help', description: 'Help' },
        ]}
        onRequestSlashCommands={jest.fn().mockResolvedValue(undefined)}
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
          { command: '/new', description: 'new session' },
          { command: '/help', description: 'help' },
        ],
      }),
    };
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        slashCommands={[
          { command: '/new', description: 'New session' },
          { command: '/help', description: 'Help' },
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
    (window as any).HWH5 = {
      fetch: jest.fn().mockResolvedValue({
        code: 200,
        errormsg: '',
        data: [{ command: '/new', description: 'new session' }],
      }),
    };
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        slashCommands={[{ command: '/new', description: 'New session' }]}
        onRequestSlashCommands={jest.fn().mockResolvedValue(undefined)}
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('hello /');

    expect(screen.queryByText('/new')).not.toBeInTheDocument();
    expect(screen.queryByText('/new')).not.toBeInTheDocument();
  });

  it('deletes a selected slash command as one token', async () => {
    (window as any).HWH5 = {
      fetch: jest.fn().mockResolvedValue({
        code: 200,
        errormsg: '',
        data: [{ command: '/new', description: 'new session' }],
      }),
    };
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        slashCommands={[{ command: '/new', description: 'New session' }]}
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

  it('renders the file upload affordance with tooltip on PC', async () => {
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton.querySelector('img')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.hover(uploadButton);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(zh['weAgent.fileUploadToolTip']);
    expect(document.body).toContainElement(tooltip);

    await user.unhover(uploadButton);
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('renders the file upload affordance on mobile', () => {
    render(
      <WeAgentCUIFooter
        mode="generate"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton.querySelector('img')).toBeInTheDocument();
  });

  it('opens the container file dialog from the upload affordance', async () => {
    const user = userEvent.setup();
    const showOpenDialog = mockFileDialog(['C:\\tmp\\report.doc']);

    render(
      <WeAgentCUIFooter
        mode="generate"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);

    await waitFor(() => expect(showOpenDialog).toHaveBeenCalledWith({
      title: AGENT_FILE_SELECT_TITLE,
      properties: ['openFile'],
      filters: [{
        name: expect.any(String),
        extensions: AGENT_SUPPORTED_FILE_EXTENSIONS,
      }],
    }));
    expect(document.querySelector('.we-agent-cui-footer__hidden-file-input')).not.toBeInTheDocument();
  });

  it('renders and deletes selected file cards from selected file path', async () => {
    const user = userEvent.setup();
    mockFileDialog(['C:\\tmp\\very-long-report-name-for-ellipsis.doc']);

    render(
      <WeAgentCUIFooter
        mode="generate"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);

    const fileCard = await waitFor(() => document.querySelector('.we-agent-cui-footer__file-card'));
    const fileName = document.querySelector('.we-agent-cui-footer__file-card-name');
    expect(fileCard).toBeInTheDocument();
    expect(fileName).toHaveTextContent('very-long-report-name-for-ellipsis.doc');
    expect(fileName).toHaveClass('we-agent-cui-footer__file-card-name');
    expect(document.querySelector('.we-agent-cui-footer__file-list-upload')).toBeInTheDocument();

    const deleteButton = document.querySelector('.we-agent-cui-footer__file-card-delete') as HTMLButtonElement;
    await user.click(deleteButton);

    expect(document.querySelector('.we-agent-cui-footer__file-card')).not.toBeInTheDocument();
    expect(document.querySelector('.we-agent-cui-footer__file-list-upload')).not.toBeInTheDocument();
  });

  it('keeps multiple selected file cards inside the capped file list area', async () => {
    const user = userEvent.setup();
    const showOpenDialog = mockFileDialog();
    showOpenDialog
      .mockResolvedValueOnce({ canceled: false, filePaths: ['C:\\tmp\\one.doc'] })
      .mockResolvedValueOnce({ canceled: false, filePaths: ['C:\\tmp\\two.pdf'] })
      .mockResolvedValueOnce({ canceled: false, filePaths: ['C:\\tmp\\three.zip'] });

    render(
      <WeAgentCUIFooter
        mode="generate"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);
    const trailingUploadButton = await waitFor(() => {
      const button = document.querySelector('.we-agent-cui-footer__file-list-upload') as HTMLButtonElement | null;
      expect(button).toBeInTheDocument();
      return button as HTMLButtonElement;
    });
    await user.click(trailingUploadButton);
    await user.click(trailingUploadButton);

    const footer = document.querySelector('.we-agent-cui-footer');
    const fileList = document.querySelector('.we-agent-cui-footer__file-list');
    await waitFor(() => expect(fileList?.querySelectorAll('.we-agent-cui-footer__file-card')).toHaveLength(3));
    expect(footer).toHaveClass('we-agent-cui-footer--has-files');
    expect(fileList).toBeInTheDocument();
    expect(fileList?.querySelector('.we-agent-cui-footer__file-list-upload')).toBeInTheDocument();
  });

  it('does not add a file card when selection is canceled or empty', async () => {
    const user = userEvent.setup();
    mockFileDialog([], true);

    render(
      <WeAgentCUIFooter
        mode="generate"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);

    await waitFor(() => expect(document.querySelector('.we-agent-cui-footer__file-card')).not.toBeInTheDocument());
  });

  it('shows a toast when the container file dialog is unavailable', async () => {
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        mode="generate"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);

    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(zh['weAgent.fileSelectFailed']));
    expect(document.querySelector('.we-agent-cui-footer__file-card')).not.toBeInTheDocument();
  });

  it('uploads selected file path and sends umLink before typed text', async () => {
    const user = userEvent.setup();
    const onSend = jest.fn();
    const umLink = '/:um_begin{https://mock.example.com/report.doc|File|5|report.doc|0|;;code|cdnUrl:https://mock.example.com/report.doc}/:um_end';
    mockFileDialog(['C:\\tmp\\report.doc']);
    mockUploadAgentFile.mockResolvedValue({ success: true, umLink });

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        onSend={onSend}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('hello');

    const sendButton = document.querySelector('.we-agent-cui-footer__send-btn') as HTMLButtonElement;
    await user.click(sendButton);

    await waitFor(() => expect(mockUploadAgentFile).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'report.doc',
      filePath: 'C:\\tmp\\report.doc',
      uploadId: expect.any(String),
    })));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(umLink + '\nhello'));
    expect(document.querySelector('.we-agent-cui-footer__file-card')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeEmptyDOMElement();
  });

  it('uploads multiple selected file paths and sends concatenated umLinks without text', async () => {
    const user = userEvent.setup();
    const onSend = jest.fn();
    const showOpenDialog = mockFileDialog();
    showOpenDialog
      .mockResolvedValueOnce({ canceled: false, filePaths: ['C:\\tmp\\one.doc'] })
      .mockResolvedValueOnce({ canceled: false, filePaths: ['C:\\tmp\\two.pdf'] });
    const umLinks = [
      '/:um_begin{https://mock.example.com/one.doc|File|3|one.doc|0|;;code|cdnUrl:https://mock.example.com/one.doc}/:um_end',
      '/:um_begin{https://mock.example.com/two.pdf|File|3|two.pdf|0|;;code|cdnUrl:https://mock.example.com/two.pdf}/:um_end',
    ];
    mockUploadAgentFile.mockImplementation(({ fileName }) => Promise.resolve({
      success: true,
      umLink: fileName === 'one.doc' ? umLinks[0] : umLinks[1],
    }));

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        onSend={onSend}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);
    const trailingUploadButton = await waitFor(() => {
      const button = document.querySelector('.we-agent-cui-footer__file-list-upload') as HTMLButtonElement | null;
      expect(button).toBeInTheDocument();
      return button as HTMLButtonElement;
    });
    await user.click(trailingUploadButton);
    const sendButton = document.querySelector('.we-agent-cui-footer__send-btn') as HTMLButtonElement;
    expect(sendButton).not.toBeDisabled();

    await user.click(sendButton);

    await waitFor(() => expect(onSend).toHaveBeenCalledWith(umLinks.join('')));
    expect(mockUploadAgentFile).toHaveBeenCalledTimes(2);
  });

  it('keeps selected files and does not send when upload fails', async () => {
    const user = userEvent.setup();
    const onSend = jest.fn();
    mockFileDialog(['C:\\tmp\\failed.doc']);
    mockUploadAgentFile.mockRejectedValue(new Error('network failed'));

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        onSend={onSend}
        onStop={jest.fn()}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);
    const sendButton = document.querySelector('.we-agent-cui-footer__send-btn') as HTMLButtonElement;
    await user.click(sendButton);

    await waitFor(() => expect(mockUploadAgentFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.querySelector('.we-agent-cui-footer__stop-btn')).not.toBeInTheDocument());
    expect(onSend).not.toHaveBeenCalled();
    expect(document.querySelector('.we-agent-cui-footer__file-card')).toBeInTheDocument();
  });

  it('shows stop state while uploading and ignores upload result after stop', async () => {
    const user = userEvent.setup();
    const onSend = jest.fn();
    const onStop = jest.fn();
    mockFileDialog(['C:\\tmp\\stop.doc']);
    const deferred = createDeferred<{ success: true; umLink: string }>();
    mockUploadAgentFile.mockReturnValue(deferred.promise);

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        onSend={onSend}
        onStop={onStop}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);
    const sendButton = document.querySelector('.we-agent-cui-footer__send-btn') as HTMLButtonElement;
    await user.click(sendButton);

    await waitFor(() => expect(mockUploadAgentFile).toHaveBeenCalledTimes(1));
    const stopButton = await waitFor(() => {
      const button = document.querySelector('.we-agent-cui-footer__stop-btn') as HTMLButtonElement | null;
      expect(button).toBeInTheDocument();
      return button as HTMLButtonElement;
    });
    await user.click(stopButton);

    expect(onStop).toHaveBeenCalledTimes(1);
    deferred.resolve({
      success: true,
      umLink: '/:um_begin{https://mock.example.com/stop.doc|File|5|stop.doc|0|;;code|cdnUrl:https://mock.example.com/stop.doc}/:um_end',
    });

    await waitFor(() => expect(document.querySelector('.we-agent-cui-footer__stop-btn')).not.toBeInTheDocument());
    expect(onSend).not.toHaveBeenCalled();
    expect(document.querySelector('.we-agent-cui-footer__file-card')).toBeInTheDocument();
  });

  it('does not reopen the file dialog while uploading', async () => {
    const user = userEvent.setup();
    const onStop = jest.fn();
    const showOpenDialog = mockFileDialog(['C:\\tmp\\busy.doc']);
    const deferred = createDeferred<{ success: true; umLink: string }>();
    mockUploadAgentFile.mockReturnValue(deferred.promise);

    render(
      <WeAgentCUIFooter
        isPcMiniApp
        mode="generate"
        partnerAccount="partner-1"
        onSend={jest.fn()}
        onStop={onStop}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);
    const sendButton = document.querySelector('.we-agent-cui-footer__send-btn') as HTMLButtonElement;
    await user.click(sendButton);

    await waitFor(() => expect(mockUploadAgentFile).toHaveBeenCalledTimes(1));
    const trailingUploadButton = document.querySelector('.we-agent-cui-footer__file-list-upload') as HTMLButtonElement;
    await user.click(trailingUploadButton);

    expect(showOpenDialog).toHaveBeenCalledTimes(1);
    deferred.resolve({
      success: true,
      umLink: '/:um_begin{https://mock.example.com/busy.doc|File|5|busy.doc|0|;;code|cdnUrl:https://mock.example.com/busy.doc}/:um_end',
    });
    await waitFor(() => expect(document.querySelector('.we-agent-cui-footer__stop-btn')).not.toBeInTheDocument());
  });
  it('does not send or stop when the file upload affordance is clicked', async () => {
    const onSend = jest.fn();
    const onStop = jest.fn();
    const user = userEvent.setup();

    render(
      <WeAgentCUIFooter
        mode="generate"
        partnerAccount="partner-1"
        onSend={onSend}
        onStop={onStop}
      />,
    );

    const uploadButton = document.querySelector('.we-agent-cui-footer__file-upload-btn') as HTMLButtonElement;
    await user.click(uploadButton);

    expect(onSend).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });
});




