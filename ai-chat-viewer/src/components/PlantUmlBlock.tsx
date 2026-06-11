import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import arrowUpIcon from '../imgs/arrow_up_icon.svg';
import downloadIcon from '../imgs/icon-download.svg';
import plantUmlErrorIcon from '../imgs/plantuml-error.svg';
import '../styles/PlantUmlBlock.less';
import { MarkdownRuntimeConfigContext } from './MarkdownRuntimeConfigContext';
import { ImagePreview } from './ImagePreview';
import type { PlantUmlFailureStage } from '../types/plantUml';
import { downloadPlantUmlImage } from '../utils/plantUmlDownload';
import {
  reportPlantUmlExportFailed,
  reportPlantUmlRenderFailed,
} from '../utils/uemUtil';
import { renderPlantUml } from '../utils/hwext';
import { isPcMiniApp } from '../constants';

const MAX_CACHE_SIZE = 50;
const renderCache = new Map<string, string>();

interface PlantUmlBlockProps {
  code: string;
}

type PreviewStatus = 'idle' | 'loading' | 'success' | 'error';

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(index);
    hash &= 0xffffffff;
  }
  return (hash >>> 0).toString(36);
}

function getCacheKey(content: string, convertType: 'svg' | 'png'): string {
  return `puml:${convertType}:${content.length}:${hashString(content)}`;
}

function getCachedImage(content: string, convertType: 'svg' | 'png'): string | undefined {
  const key = getCacheKey(content, convertType);
  const image = renderCache.get(key);
  if (image === undefined) {
    return undefined;
  }
  renderCache.delete(key);
  renderCache.set(key, image);
  return image;
}

function setCachedImage(content: string, convertType: 'svg' | 'png', image: string): void {
  const key = getCacheKey(content, convertType);
  renderCache.delete(key);
  renderCache.set(key, image);
  while (renderCache.size > MAX_CACHE_SIZE) {
    const oldestKey = renderCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    renderCache.delete(oldestKey);
  }
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const value = (error as { code?: unknown; errorCode?: unknown }).code
    ?? (error as { code?: unknown; errorCode?: unknown }).errorCode;
  return value === undefined || value === null ? undefined : String(value);
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object') {
    const value = (error as { message?: unknown; errorMessage?: unknown }).message
      ?? (error as { message?: unknown; errorMessage?: unknown }).errorMessage;
    return typeof value === 'string' ? value : undefined;
  }
  return typeof error === 'string' ? error : undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function normalizeDownloadStage(error: unknown): PlantUmlFailureStage {
  const code = getErrorCode(error);
  if (code === 'download_unsupported' || code === 'dialog_failed' || code === 'write_failed') {
    return code;
  }
  return 'unknown';
}

function normalizeRenderStage(error: unknown, fallback: PlantUmlFailureStage): PlantUmlFailureStage {
  return getErrorCode(error) === 'missing_renderer' ? 'missing_renderer' : fallback;
}

function base64ToBlob(image: string): Blob {
  const normalized = image.includes(',')
    ? image.slice(image.indexOf(',') + 1)
    : image;
  const binary = window.atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: 'image/png' });
}

export const PlantUmlBlock: React.FC<PlantUmlBlockProps> = ({ code }) => {
  const { t } = useTranslation();
  const {
    isStreaming = false,
    page,
  } = useContext(MarkdownRuntimeConfigContext);
  const [collapsed, setCollapsed] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewSvg, setPreviewSvg] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const diagramHash = useMemo(() => hashString(code), [code]);
  const diagramId = useMemo(() => `plantuml-${diagramHash}`, [diagramHash]);
  const isPc = isPcMiniApp();

  const reportRenderFailure = useCallback((failureStage: PlantUmlFailureStage, error?: unknown) => {
    reportPlantUmlRenderFailed({
      page,
      convertType: 'svg',
      diagramHash,
      contentLength: code.length,
      failureStage,
      errorCode: getErrorCode(error),
      errorMessage: getErrorMessage(error),
    });
  }, [code.length, diagramHash, page]);

  const reportExportFailure = useCallback((failureStage: PlantUmlFailureStage, error?: unknown) => {
    reportPlantUmlExportFailed({
      page,
      convertType: 'png',
      diagramHash,
      contentLength: code.length,
      failureStage,
      errorCode: getErrorCode(error),
      errorMessage: getErrorMessage(error),
    });
  }, [code.length, diagramHash, page]);

  const handlePreviewSourceError = useCallback((error: unknown) => {
    setPreviewStatus('error');
    reportRenderFailure('svg_blob_failed', error);
  }, [reportRenderFailure]);

  useEffect(() => {
    if (isStreaming) {
      setPreviewStatus('loading');
      return undefined;
    }

    const cached = getCachedImage(code, 'svg');
    if (cached !== undefined) {
      setPreviewSvg(cached);
      setPreviewStatus('success');
      return undefined;
    }

    const controller = new AbortController();
    let disposed = false;
    setPreviewStatus('loading');

    void renderPlantUml({
      content: code,
      convertType: 'svg',
      fileType: 'puml',
    }, { signal: controller.signal })
      .then((result) => {
        if (disposed) {
          return;
        }
        if (!result.image) {
          setPreviewStatus('error');
          reportRenderFailure('empty_image');
          return;
        }
        setCachedImage(code, 'svg', result.image);
        setPreviewSvg(result.image);
        setPreviewStatus('success');
      })
      .catch((error) => {
        if (disposed || isAbortError(error)) {
          return;
        }
        setPreviewStatus('error');
        reportRenderFailure(normalizeRenderStage(error, 'server_error'), error);
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [code, isStreaming, reportRenderFailure]);

  const handleExport = useCallback(async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    const controller = new AbortController();
    try {
      let image = getCachedImage(code, 'png');
      if (image === undefined) {
        const result = await renderPlantUml({
          content: code,
          convertType: 'png',
          fileType: 'puml',
        }, { signal: controller.signal });
        image = result.image;
        if (!image) {
          reportExportFailure('empty_image');
          return;
        }
      }

      let fileStream: Blob;
      try {
        fileStream = base64ToBlob(image);
      } catch (error) {
        reportExportFailure('invalid_base64', error);
        return;
      }
      setCachedImage(code, 'png', image);

      try {
        await downloadPlantUmlImage({
          fileStream,
          fileSize: fileStream.size,
          filename: `${diagramId}.png`,
          mimeType: 'image/png',
          diagramId,
        });
      } catch (error) {
        reportExportFailure(normalizeDownloadStage(error), error);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        reportExportFailure(normalizeRenderStage(error, 'png_render_failed'), error);
      }
    } finally {
      setIsExporting(false);
    }
  }, [code, diagramId, isExporting, reportExportFailure]);

  const canExport = isPc && previewStatus === 'success' && !collapsed;

  return (
    <div
      className={[
        'weAgent-code-content',
        'plantuml-block',
        collapsed ? 'plantuml-block--collapsed' : '',
        `plantuml-block--${previewStatus}`,
      ].filter(Boolean).join(' ')}
    >
      <div className="plantuml-block__header">
        <button
          className="plantuml-block__toggle"
          type="button"
          aria-label={collapsed ? t('plantuml.expand') : t('plantuml.collapse')}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((current) => !current)}
        >
          <span className="plantuml-block__lang">plantuml</span>
          <img
            className={[
              'plantuml-block__chevron-icon',
              collapsed ? 'is-collapsed' : '',
            ].filter(Boolean).join(' ')}
            src={arrowUpIcon}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        </button>
        {canExport ? (
          <button
            className="plantuml-block__export-btn"
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            aria-label={t('plantuml.exportImage')}
            title={t('plantuml.exportImage')}
          >
            <img className="plantuml-block__export-icon" src={downloadIcon} alt="" draggable="false" />
          </button>
        ) : null}
      </div>
      {!collapsed ? (
        <div className="plantuml-block__body">
          {previewStatus === 'success' && previewSvg ? (
            <ImagePreview
              className="plantuml-block__image-preview"
              imageClassName="plantuml-block__image"
              svgSource={previewSvg}
              alt="PlantUML diagram"
              title={t('plantuml.previewImage')}
              onSourceError={handlePreviewSourceError}
            />
          ) : null}
          {previewStatus === 'loading' ? (
            <div className="plantuml-block__status">
              <span>{t('plantuml.rendering')}</span>
              <span className="plantuml-block__dots" aria-hidden="true">...</span>
            </div>
          ) : null}
          {previewStatus === 'error' ? (
            <div className="plantuml-block__status plantuml-block__status--error">
              <img
                className="plantuml-block__error-illustration"
                src={plantUmlErrorIcon}
                alt=""
                aria-hidden="true"
                draggable="false"
              />
              <span>{t('plantuml.renderFailed')}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
