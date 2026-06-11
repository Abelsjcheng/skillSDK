import type { PlantUmlDownloadPayload } from '../types/plantUml';

export type PcFileDownloadErrorCode = 'download_unsupported' | 'dialog_failed' | 'write_failed';

export class PcFileDownloadError extends Error {
  code: PcFileDownloadErrorCode;

  constructor(code: PcFileDownloadErrorCode, message: string) {
    super(message);
    this.name = 'PcFileDownloadError';
    this.code = code;
  }
}

function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index >= 0 ? filename.slice(index + 1) : 'png';
}

async function readBlobAsBuffer(blob: Blob): Promise<Uint8Array> {
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function resolveDefaultPath(filename: string): Promise<string> {
  try {
    const setting = await Promise.resolve(
      window.Pedestal?.callMethod?.('method://pedestal/getLocalSettingInfo'),
    );
    const folder = typeof (setting as { fileDownloadFolderAddress?: unknown } | null)?.fileDownloadFolderAddress === 'string'
      ? ((setting as { fileDownloadFolderAddress: string }).fileDownloadFolderAddress)
      : '';
    return folder ? `${folder.replace(/[\\/]$/, '')}/${filename}` : filename;
  } catch {
    return filename;
  }
}

async function writeFile(filePath: string, data: Uint8Array): Promise<void> {
  const fsModule = window.require?.('fs') as {
    promises?: { writeFile?: (path: string, data: Uint8Array) => Promise<void> };
    writeFile?: (path: string, data: Uint8Array, callback: (error?: Error | null) => void) => void;
  } | undefined;

  if (!fsModule) {
    throw new PcFileDownloadError('download_unsupported', 'fs module is not available.');
  }

  if (typeof fsModule.promises?.writeFile === 'function') {
    await fsModule.promises.writeFile(filePath, data);
    return;
  }

  if (typeof fsModule.writeFile === 'function') {
    await new Promise<void>((resolve, reject) => {
      fsModule.writeFile?.(filePath, data, (error?: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    return;
  }

  throw new PcFileDownloadError('download_unsupported', 'fs.writeFile is not available.');
}

export async function downloadFileWithPedestal(payload: PlantUmlDownloadPayload): Promise<void> {
  const dialog = window.Pedestal?.remote?.dialog;
  if (!dialog || typeof dialog.showSaveDialog !== 'function') {
    throw new PcFileDownloadError('download_unsupported', 'Pedestal save dialog is not available.');
  }

  let filePath = '';
  try {
    const result = await Promise.resolve(dialog.showSaveDialog({
      defaultPath: await resolveDefaultPath(payload.filename),
      filters: [{
        name: 'PNG Image',
        extensions: [getFileExtension(payload.filename)],
      }],
    }));
    if (result?.canceled) {
      return;
    }
    filePath = result?.filePath ?? '';
  } catch (error) {
    throw Object.assign(
      new PcFileDownloadError('dialog_failed', 'Pedestal save dialog failed.'),
      { cause: error },
    );
  }

  if (!filePath) {
    return;
  }

  try {
    await writeFile(filePath, await readBlobAsBuffer(payload.fileStream));
  } catch (error) {
    if (error instanceof PcFileDownloadError) {
      throw error;
    }
    throw Object.assign(
      new PcFileDownloadError('write_failed', 'Write download file failed.'),
      { cause: error },
    );
  }
}
