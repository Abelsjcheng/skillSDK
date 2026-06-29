import {
  AGENT_FILE_SELECT_TITLE,
  AGENT_SUPPORTED_FILE_EXTENSIONS,
  getAgentFileNameFromPath,
  selectAgentFile,
} from '../agentFileSelect';

describe('selectAgentFile', () => {
  beforeEach(() => {
    delete (window as any).Pedestal;
  });

  it('calls container open dialog and returns selected file information', async () => {
    const showOpenDialog = jest.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['C:\\tmp\\report.doc'],
    });
    (window as any).Pedestal = {
      remote: {
        dialog: {
          showOpenDialog,
        },
      },
    };

    const result = await selectAgentFile();

    expect(showOpenDialog).toHaveBeenCalledWith({
      title: AGENT_FILE_SELECT_TITLE,
      properties: ['openFile'],
      filters: [{
        name: '支持的文件',
        extensions: AGENT_SUPPORTED_FILE_EXTENSIONS,
      }],
    });
    expect(result).toEqual({
      fileName: 'report.doc',
      filePath: 'C:\\tmp\\report.doc',
    });
  });

  it('returns null when selection is canceled or empty', async () => {
    const showOpenDialog = jest.fn().mockResolvedValue({ canceled: true, filePaths: [] });
    (window as any).Pedestal = { remote: { dialog: { showOpenDialog } } };

    await expect(selectAgentFile()).resolves.toBeNull();
  });

  it('strips wrapping quotes and parses Windows or POSIX file names', () => {
    expect(getAgentFileNameFromPath('"C:\\tmp\\quoted.pdf"')).toBe('quoted.pdf');
    expect(getAgentFileNameFromPath('/tmp/report.md')).toBe('report.md');
  });

  it('rejects when the container dialog is unavailable', async () => {
    await expect(selectAgentFile()).rejects.toThrow('File select dialog is unavailable');
  });
});
