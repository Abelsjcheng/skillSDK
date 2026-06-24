export interface PlantUmlRenderParams {
  content: string;
  contentType: 'svg' | 'png';
  fileType: 'puml';
}

export interface PlantUmlRenderResult {
  image: string;
}

export interface PlantUmlRenderResponse {
  code: '0' | string;
  /** 服务端约定字段名，中文错误消息。 */
  messgaeCn: string;
  /** 英文错误消息。 */
  messageEn: string;
  data: PlantUmlRenderResult;
}

export type PlantUmlFailureStage =
  | 'missing_renderer'
  | 'server_error'
  | 'empty_image'
  | 'svg_blob_failed'
  | 'png_render_failed'
  | 'invalid_base64'
  | 'download_unsupported'
  | 'dialog_failed'
  | 'write_failed'
  | 'unknown';

export interface PlantUmlFailureTelemetryPayload {
  page?: 'weAgentCUI' | 'skillCUI' | string;
  contentType: 'svg' | 'png';
  diagramHash: string;
  contentLength: number;
  failureStage: PlantUmlFailureStage;
  errorCode?: string;
  errorMessage?: string;
}

export interface PlantUmlDownloadPayload {
  fileStream: Blob;
  fileSize: number;
  filename: string;
  mimeType: 'image/png';
  diagramId: string;
}
