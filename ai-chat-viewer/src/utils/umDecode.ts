export type UMFileType = 'File' | 'Img' | 'Video' | string;
export type UMFileIconType = 'doc' | 'excel' | 'txt' | 'video' | 'unknown';

export interface UMAsset {
  raw: string;
  url: string;
  fileType: UMFileType;
  fileSize?: number;
  fileName: string;
  duration?: string;
  width?: number;
  height?: number;
  accessCode?: string;
  extProps: Record<string, string>;
}

export type UMContentSegment =
  | { type: 'text'; content: string }
  | { type: 'asset'; asset: UMAsset };

const UM_PATTERN = /\/:um_begin\{([\s\S]*?)\}\/:um_end/g;
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

function appendTextSegment(segments: UMContentSegment[], content: string): void {
  if (!content) {
    return;
  }
  const lastSegment = segments[segments.length - 1];
  if (lastSegment?.type === 'text') {
    lastSegment.content += content;
    return;
  }
  segments.push({ type: 'text', content });
}

function parseNumber(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseExtProps(value?: string): Record<string, string> {
  if (!value) {
    return {};
  }
  return value.split(';').reduce<Record<string, string>>((props, item) => {
    const separatorIndex = item.indexOf(':');
    if (separatorIndex <= 0) {
      return props;
    }
    const key = item.slice(0, separatorIndex).trim();
    const propValue = item.slice(separatorIndex + 1).trim();
    if (key) {
      props[key] = propValue;
    }
    return props;
  }, {});
}

export function parseUMAsset(raw: string, body: string): UMAsset | null {
  const fields = body.split('|');
  if (fields.length < 4) {
    return null;
  }

  const [url = '', fileType = '', fileSize = '', fileName = '', duration = '', mediaInfo = ''] = fields;
  if (!url.trim() || !fileType.trim() || !fileName.trim()) {
    return null;
  }

  const [width, height, accessCode] = mediaInfo.split(';');
  return {
    raw,
    url: url.trim(),
    fileType: fileType.trim(),
    fileSize: parseNumber(fileSize),
    fileName: fileName.trim(),
    duration: duration.trim() || undefined,
    width: parseNumber(width),
    height: parseNumber(height),
    accessCode: accessCode?.trim() || undefined,
    extProps: parseExtProps(fields.slice(6).join('|')),
  };
}

export function parseUMContent(content: string): UMContentSegment[] {
  const segments: UMContentSegment[] = [];
  let cursor = 0;

  UM_PATTERN.lastIndex = 0;
  let match = UM_PATTERN.exec(content);
  while (match) {
    const raw = match[0];
    const body = match[1];
    appendTextSegment(segments, content.slice(cursor, match.index));

    const asset = parseUMAsset(raw, body);
    if (asset) {
      segments.push({ type: 'asset', asset });
    } else {
      appendTextSegment(segments, raw);
    }

    cursor = match.index + raw.length;
    match = UM_PATTERN.exec(content);
  }

  appendTextSegment(segments, content.slice(cursor));
  return segments.length > 0 ? segments : [{ type: 'text', content }];
}

export function formatUMFileSize(size?: number): string {
  if (!Number.isFinite(size) || size === undefined || size <= 0) {
    return '0B';
  }

  let normalizedSize = size;
  let unitIndex = 0;
  while (normalizedSize >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    normalizedSize /= 1024;
    unitIndex += 1;
  }

  const precision = normalizedSize >= 10 || unitIndex === 0 ? 0 : 1;
  return `${normalizedSize.toFixed(precision).replace(/\.0$/, '')}${FILE_SIZE_UNITS[unitIndex]}`;
}

export function getUMFileIconType(fileName: string, fileType?: UMFileType): UMFileIconType {
  if (fileType === 'Video') {
    return 'video';
  }

  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension || extension === fileName.toLowerCase()) {
    return 'unknown';
  }

  if (['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm'].includes(extension)) {
    return 'video';
  }
  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return 'excel';
  }
  if (['txt'].includes(extension)) {
    return 'txt';
  }
  if (['doc', 'docx', 'ppt', 'pptx', 'pdf', 'md', 'msg'].includes(extension)) {
    return 'doc';
  }
  return 'unknown';
}
