import { AGENT_FILE_UPLOAD_METHOD, uploadAgentFile } from '../agentFileUpload';

describe('uploadAgentFile', () => {
  beforeEach(() => {
    delete (window as any).Pedestal;
  });

  it('calls the host upload method with fileName and filePath', async () => {
    const hostResult = {
      success: 'true',
      uploadId: 'upload-1',
      umLink: '/:um_begin{https://example.com/report.doc|File|5|report.doc|0|;;code|cdnUrl:https://example.com/report.doc}/:um_end',
    };
    const callMethod = jest.fn().mockResolvedValue(hostResult);
    (window as any).Pedestal = { callMethod };

    const result = await uploadAgentFile({
      fileName: 'report.doc',
      filePath: 'C:\\tmp\\report.doc',
      uploadId: 'upload-1',
    });

    expect(callMethod).toHaveBeenCalledWith(AGENT_FILE_UPLOAD_METHOD, expect.objectContaining({
      fileName: 'report.doc',
      filePath: 'C:\\tmp\\report.doc',
      uploadId: 'upload-1',
    }));
    expect(result).toBe(hostResult);
  });

  it('rejects when the host upload method is unavailable', async () => {
    await expect(uploadAgentFile({
      fileName: 'missing.doc',
      filePath: 'C:\\tmp\\missing.doc',
    })).rejects.toThrow('File upload method or file path is unavailable');
  });

  it('rejects host upload results without umLink', async () => {
    (window as any).Pedestal = {
      callMethod: jest.fn().mockResolvedValue({ success: 'true' }),
    };

    await expect(uploadAgentFile({
      fileName: 'broken.doc',
      filePath: 'C:\\tmp\\broken.doc',
    })).rejects.toThrow('File upload failed');
  });
});
