export const AGENT_FILE_SELECT_TITLE = '\u9009\u62e9\u6587\u4ef6';

export const AGENT_SUPPORTED_FILE_EXTENSIONS = [
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'msg',
  'md',
  'zip',
];

export interface AgentSelectedFile {
  fileName: string;
  filePath: string;
}

export function getAgentFileNameFromPath(filePath: string): string {
  const normalizedPath = filePath.trim().replace(/^['\"]|['\"]$/g, '');
  return normalizedPath.split(/[\\/]/).filter(Boolean).pop() || normalizedPath;
}

export async function selectAgentFile(): Promise<AgentSelectedFile | null> {
  const showOpenDialog = typeof window === 'undefined'
    ? undefined
    : window.Pedestal?.remote?.dialog?.showOpenDialog;
  if (!showOpenDialog) {
    throw new Error('File select dialog is unavailable');
  }

  const result = await showOpenDialog({
    title: AGENT_FILE_SELECT_TITLE,
    properties: ['openFile'],
    filters: [{
      name: '\u652f\u6301\u7684\u6587\u4ef6',
      extensions: AGENT_SUPPORTED_FILE_EXTENSIONS,
    }],
  });

  if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
    return null;
  }

  const filePath = result.filePaths[0].trim().replace(/^['\"]|['\"]$/g, '');
  return {
    fileName: getAgentFileNameFromPath(filePath),
    filePath,
  };
}
