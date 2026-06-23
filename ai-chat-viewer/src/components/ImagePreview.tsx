import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
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

type PreviewTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

type DragGesture = {
  type: 'mouse' | 'touch';
  lastX: number;
  lastY: number;
};

type PinchGesture = {
  type: 'pinch';
  lastDistance: number;
  lastCenterX: number;
  lastCenterY: number;
};

type PreviewGesture = DragGesture | PinchGesture | null;
type PreviewIconType = 'zoomIn' | 'zoomOut' | 'close';

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
const ZOOM_STEP = 1.2;

const DEFAULT_TRANSFORM: PreviewTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getTouchDistance(touchA: Touch, touchB: Touch): number {
  const deltaX = touchB.clientX - touchA.clientX;
  const deltaY = touchB.clientY - touchA.clientY;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function getTouchCenter(touchA: Touch, touchB: Touch): { clientX: number; clientY: number } {
  return {
    clientX: (touchA.clientX + touchB.clientX) / 2,
    clientY: (touchA.clientY + touchB.clientY) / 2,
  };
}

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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<PreviewTransform>({ ...DEFAULT_TRANSFORM });
  const gestureRef = useRef<PreviewGesture>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const applyTransform = useCallback(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    const { scale, translateX, translateY } = transformRef.current;
    content.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
  }, []);

  const setTransform = useCallback((nextTransform: PreviewTransform) => {
    transformRef.current = {
      scale: clamp(nextTransform.scale, MIN_SCALE, MAX_SCALE),
      translateX: nextTransform.translateX,
      translateY: nextTransform.translateY,
    };
    applyTransform();
  }, [applyTransform]);

  const resetTransform = useCallback(() => {
    transformRef.current = { ...DEFAULT_TRANSFORM };
    applyTransform();
  }, [applyTransform]);

  const getFocalPoint = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) {
      return { x: 0, y: 0 };
    }
    const rect = stage.getBoundingClientRect();
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2,
    };
  }, []);

  const zoomAt = useCallback((clientX: number, clientY: number, nextScale: number) => {
    const current = transformRef.current;
    const nextClampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    if (nextClampedScale === current.scale) {
      return;
    }

    const focal = getFocalPoint(clientX, clientY);
    const ratio = nextClampedScale / current.scale;
    setTransform({
      scale: nextClampedScale,
      translateX: focal.x - (focal.x - current.translateX) * ratio,
      translateY: focal.y - (focal.y - current.translateY) * ratio,
    });
  }, [getFocalPoint, setTransform]);

  const zoomFromStageCenter = useCallback((factor: number) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, transformRef.current.scale * factor);
  }, [zoomAt]);

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
    gestureRef.current = null;
    setOpen(false);
  }, []);

  const openPreview = useCallback(() => {
    if (!imageSrc || disabled || typeof document === 'undefined') {
      return;
    }
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : triggerRef.current;
    setOpen(true);
  }, [disabled, imageSrc]);

  const startMouseDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    gestureRef.current = {
      type: 'mouse',
      lastX: event.clientX,
      lastY: event.clientY,
    };
  }, []);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    resetTransform();
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
      gestureRef.current = null;
    };
  }, [open, resetTransform]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return undefined;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.type !== 'mouse') {
        return;
      }
      event.preventDefault();
      const deltaX = event.clientX - gesture.lastX;
      const deltaY = event.clientY - gesture.lastY;
      gestureRef.current = {
        ...gesture,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      const current = transformRef.current;
      setTransform({
        ...current,
        translateX: current.translateX + deltaX,
        translateY: current.translateY + deltaY,
      });
    };

    const stopMouseDrag = () => {
      if (gestureRef.current?.type === 'mouse') {
        gestureRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopMouseDrag);
    window.addEventListener('blur', stopMouseDrag);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopMouseDrag);
      window.removeEventListener('blur', stopMouseDrag);
    };
  }, [open, setTransform]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreview();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePreview, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomAt(event.clientX, event.clientY, transformRef.current.scale * factor);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        event.preventDefault();
        const touchA = event.touches[0];
        const touchB = event.touches[1];
        const center = getTouchCenter(touchA, touchB);
        gestureRef.current = {
          type: 'pinch',
          lastDistance: getTouchDistance(touchA, touchB),
          lastCenterX: center.clientX,
          lastCenterY: center.clientY,
        };
        return;
      }

      if (event.touches.length === 1) {
        event.preventDefault();
        const touch = event.touches[0];
        gestureRef.current = {
          type: 'touch',
          lastX: touch.clientX,
          lastY: touch.clientY,
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) {
        return;
      }

      if (gesture.type === 'pinch' && event.touches.length >= 2) {
        event.preventDefault();
        const touchA = event.touches[0];
        const touchB = event.touches[1];
        const nextDistance = getTouchDistance(touchA, touchB);
        if (gesture.lastDistance <= 0 || nextDistance <= 0) {
          return;
        }

        const center = getTouchCenter(touchA, touchB);
        const current = transformRef.current;
        const nextScale = clamp(current.scale * (nextDistance / gesture.lastDistance), MIN_SCALE, MAX_SCALE);
        const focal = getFocalPoint(center.clientX, center.clientY);
        const ratio = nextScale / current.scale;
        const centerDeltaX = center.clientX - gesture.lastCenterX;
        const centerDeltaY = center.clientY - gesture.lastCenterY;

        setTransform({
          scale: nextScale,
          translateX: focal.x - (focal.x - current.translateX) * ratio + centerDeltaX,
          translateY: focal.y - (focal.y - current.translateY) * ratio + centerDeltaY,
        });

        gestureRef.current = {
          type: 'pinch',
          lastDistance: nextDistance,
          lastCenterX: center.clientX,
          lastCenterY: center.clientY,
        };
        return;
      }

      if (gesture.type === 'touch' && event.touches.length === 1) {
        event.preventDefault();
        const touch = event.touches[0];
        const deltaX = touch.clientX - gesture.lastX;
        const deltaY = touch.clientY - gesture.lastY;
        gestureRef.current = {
          type: 'touch',
          lastX: touch.clientX,
          lastY: touch.clientY,
        };
        const current = transformRef.current;
        setTransform({
          ...current,
          translateX: current.translateX + deltaX,
          translateY: current.translateY + deltaY,
        });
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        const touchA = event.touches[0];
        const touchB = event.touches[1];
        const center = getTouchCenter(touchA, touchB);
        gestureRef.current = {
          type: 'pinch',
          lastDistance: getTouchDistance(touchA, touchB),
          lastCenterX: center.clientX,
          lastCenterY: center.clientY,
        };
        return;
      }

      if (event.touches.length === 1) {
        const touch = event.touches[0];
        gestureRef.current = {
          type: 'touch',
          lastX: touch.clientX,
          lastY: touch.clientY,
        };
        return;
      }

      gestureRef.current = null;
    };

    const listenerOptions = { passive: false };
    stage.addEventListener('wheel', handleWheel, listenerOptions);
    stage.addEventListener('touchstart', handleTouchStart, listenerOptions);
    stage.addEventListener('touchmove', handleTouchMove, listenerOptions);
    stage.addEventListener('touchend', handleTouchEnd);
    stage.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      stage.removeEventListener('wheel', handleWheel);
      stage.removeEventListener('touchstart', handleTouchStart);
      stage.removeEventListener('touchmove', handleTouchMove);
      stage.removeEventListener('touchend', handleTouchEnd);
      stage.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [getFocalPoint, open, setTransform, zoomAt]);

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
      >
        <div className="image-preview__toolbar" aria-label={t('imagePreview.toolbar')}>
          <button
            className="image-preview__control"
            type="button"
            aria-label={t('imagePreview.zoomIn')}
            title={t('imagePreview.zoomIn')}
            onClick={() => zoomFromStageCenter(ZOOM_STEP)}
          >
            <PreviewIcon type="zoomIn" />
          </button>
          <button
            className="image-preview__control"
            type="button"
            aria-label={t('imagePreview.zoomOut')}
            title={t('imagePreview.zoomOut')}
            onClick={() => zoomFromStageCenter(1 / ZOOM_STEP)}
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
        <div
          ref={stageRef}
          className="image-preview__stage"
          onMouseDown={startMouseDrag}
        >
          <div ref={contentRef} className="image-preview__transform-content">
            <img
              className="image-preview__modal-image"
              src={imageSrc}
              alt={alt}
              draggable="false"
            />
          </div>
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
