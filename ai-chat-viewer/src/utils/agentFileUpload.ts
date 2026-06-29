export const AGENT_FILE_UPLOAD_METHOD = 'method://agentSkillsDialog/uploadFile';

export interface AgentFileUploadResult {
  success: string | boolean;
  uploadId?: string;
  umLink?: string;
  umUrl?: string;
  umPlainAccessCode?: string;
  error?: string;
}

export interface AgentFileUploadInput {
  fileName: string;
  filePath: string;
  size?: number;
}

export interface AgentFileUploadParams extends AgentFileUploadInput {
  uploadId?: string;
  onProgress?: (percent: number, uploadId: string) => void;
}

interface HostUploadPayload {
  fileName: string;
  filePath: string;
  uploadId?: string;
  onProgress?: (percent: number, uploadId: string) => void;
}

function normalizeUploadResult(result: unknown): AgentFileUploadResult {
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result) as unknown;
      return normalizeUploadResult(parsed);
    } catch {
      return {
        success: false,
        error: result,
      };
    }
  }

  if (!result || typeof result !== 'object') {
    return {
      success: false,
      error: 'Invalid upload result',
    };
  }

  return result as AgentFileUploadResult;
}

function isUploadSuccess(success: AgentFileUploadResult['success']): boolean {
  return success === true || success === 'true' || success === 'success' || success === '1';
}

export async function uploadAgentFile({
  fileName,
  filePath,
  uploadId,
  onProgress,
}: AgentFileUploadParams): Promise<AgentFileUploadResult> {
  const pedestal = typeof window === 'undefined' ? undefined : window.Pedestal;
  if (!pedestal?.callMethod || !filePath) {
    throw new Error('File upload method or file path is unavailable');
  }

  const payload: HostUploadPayload = {
    fileName,
    filePath,
    uploadId,
    onProgress,
  };
  const result = normalizeUploadResult(await pedestal.callMethod(AGENT_FILE_UPLOAD_METHOD, payload));
  if (!isUploadSuccess(result.success) || !result.umLink) {
    throw new Error(result.error || 'File upload failed');
  }
  return result;
}
