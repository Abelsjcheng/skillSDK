import { formatUMFileSize, getUMFileIconType, parseUMContent } from '../umDecode';

describe('umDecode', () => {
  it('parses a File UM asset with core fields and extension props', () => {
    const content = '/:um_begin{https://origin.example/report.docx|File|1536|report.docx|||cdnUrl:https://cdn.example/report.docx;md5:abc}/:um_end';

    const segments = parseUMContent(content);

    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe('asset');
    if (segments[0].type !== 'asset') {
      throw new Error('Expected asset segment');
    }
    expect(segments[0].asset.url).toBe('https://origin.example/report.docx');
    expect(segments[0].asset.fileType).toBe('File');
    expect(segments[0].asset.fileSize).toBe(1536);
    expect(segments[0].asset.fileName).toBe('report.docx');
    expect(segments[0].asset.extProps.cdnUrl).toBe('https://cdn.example/report.docx');
    expect(segments[0].asset.extProps.md5).toBe('abc');
  });

  it('keeps text and multiple UM assets in source order', () => {
    const content = 'before /:um_begin{https://a.example/a.txt|File|1|a.txt||||}/:um_end middle /:um_begin{https://b.example/b.mp4|Video|2|b.mp4|8|||}/:um_end after';

    const segments = parseUMContent(content);

    expect(segments.map((segment) => segment.type)).toEqual(['text', 'asset', 'text', 'asset', 'text']);
    expect(segments[0]).toEqual({ type: 'text', content: 'before ' });
    expect(segments[2]).toEqual({ type: 'text', content: ' middle ' });
    expect(segments[4]).toEqual({ type: 'text', content: ' after' });
  });

  it('returns malformed UM as text', () => {
    const content = 'prefix /:um_begin{missing-fields}/:um_end suffix';

    expect(parseUMContent(content)).toEqual([{ type: 'text', content }]);
  });

  it('formats file sizes and maps icons', () => {
    expect(formatUMFileSize(0)).toBe('0B');
    expect(formatUMFileSize(1536)).toBe('1.5KB');
    expect(formatUMFileSize(1048576)).toBe('1MB');
    expect(getUMFileIconType('table.xlsx', 'File')).toBe('excel');
    expect(getUMFileIconType('clip.any', 'Video')).toBe('video');
    expect(getUMFileIconType('archive.zip', 'File')).toBe('unknown');
  });
});
