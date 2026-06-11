import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch';
import '../styles/ImagePreview.less';

export interface ImagePreviewProps {
  src?: string;
  svgSource?: string;
  alt?: string;
  title?: string;
  className?: string;
  imageClassName?: string;
  disabled?: boolean;
  onSourceError?: (error: unknown) => void;
}

type PreviewIconType = 'zoomIn' | 'zoomOut' | 'close';

function revokeObjectUrl(url: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function createSvgObjectUrl(svgSource: string): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('createObjectURL is not supported');
  }
  const blob = new Blob([svgSource], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(blob);
}

function PreviewIcon({ type }: { type: PreviewIconType }): JSX.Element {
  if (type === 'zoomIn') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M11 5a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H6a1 1 0 1 1 0-2h4V6a1 1 0 0 1 1-1Z" />
      </svg>
    );
  }

  if (type === 'zoomOut') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 10h10a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.3 5.3a1 1 0 0 1 1.4 0L12 9.6l4.3-4.3a1 1 0 1 1 1.4 1.4L13.4 11l4.3 4.3a1 1 0 0 1-1.4 1.4L12 12.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  src,
  svgSource,
  alt = '',
  title,
  className,
  imageClassName,
  disabled = false,
  onSourceError,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [svgUrl, setSvgUrl] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const supportsResizeObserver = typeof window !== 'undefined' && 'ResizeObserver' in window;

  useEffect(() => {
    if (!svgSource) {
      setSvgUrl('');
      return undefined;
    }

    let url = '';
    try {
      url = createSvgObjectUrl(svgSource);
    } catch (error) {
      setSvgUrl('');
      onSourceError?.(error);
      return undefined;
    }
    setSvgUrl(url);
    return () => {
      revokeObjectUrl(url);
    };
  }, [onSourceError, svgSource]);

  const imageSrc = useMemo(() => {
    if (svgSource) {
      return svgUrl;
    }
    return src || '';
  }, [src, svgSource, svgUrl]);

  const closePreview = useCallback(() => {
    setOpen(false);
  }, []);

  const openPreview = useCallback(() => {
    if (!imageSrc || disabled) {
      return;
    }
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : triggerRef.current;
    setOpen(true);
  }, [disabled, imageSrc]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreview();
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        transformRef.current?.zoomIn(0.25, 180);
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        transformRef.current?.zoomOut(0.25, 180);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePreview, open]);

  if (!imageSrc) {
    return null;
  }

  const rootClassName = [
    'image-preview',
    disabled ? 'image-preview--disabled' : '',
    className || '',
  ].filter(Boolean).join(' ');

  const image = (
    <img
      className={['image-preview__image', imageClassName || ''].filter(Boolean).join(' ')}
      src={imageSrc}
      alt={alt}
      draggable="false"
    />
  );

  const modal = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="image-preview__modal"
        role="dialog"
        aria-modal="true"
        aria-label={title || alt || t('imagePreview.dialogTitle')}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closePreview();
          }
        }}
      >
        <div className="image-preview__toolbar" aria-label={t('imagePreview.toolbar')}>
          <button
            className="image-preview__control"
            type="button"
            aria-label={t('imagePreview.zoomIn')}
            title={t('imagePreview.zoomIn')}
            onClick={() => transformRef.current?.zoomIn(0.25, 180)}
          >
            <PreviewIcon type="zoomIn" />
          </button>
          <button
            className="image-preview__control"
            type="button"
            aria-label={t('imagePreview.zoomOut')}
            title={t('imagePreview.zoomOut')}
            onClick={() => transformRef.current?.zoomOut(0.25, 180)}
          >
            <PreviewIcon type="zoomOut" />
          </button>
          <button
            ref={closeButtonRef}
            className="image-preview__control"
            type="button"
            aria-label={t('imagePreview.close')}
            title={t('imagePreview.close')}
            onClick={closePreview}
          >
            <PreviewIcon type="close" />
          </button>
        </div>
        <div className="image-preview__stage">
          <TransformWrapper
            ref={transformRef}
            minScale={0.5}
            maxScale={6}
            initialScale={1}
            centerOnInit={supportsResizeObserver}
            centerZoomedOut
            limitToBounds={false}
            wheel={{ step: 0.18 }}
            pinch={{ step: 6 }}
            panning={{ allowLeftClickPan: true, velocityDisabled: true }}
            doubleClick={{ mode: 'toggle', step: 1.2 }}
          >
            <TransformComponent
              wrapperClass="image-preview__transform-wrapper"
              contentClass="image-preview__transform-content"
            >
              <img
                className="image-preview__modal-image"
                src={imageSrc}
                alt={alt}
                draggable="false"
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
      </div>,
      document.body,
    )
    : null;

  if (disabled) {
    return (
      <span className={rootClassName}>
        {image}
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={rootClassName}
        type="button"
        aria-label={title || alt || t('imagePreview.open')}
        title={title || t('imagePreview.open')}
        onClick={openPreview}
      >
        {image}
      </button>
      {modal}
    </>
  );
};
