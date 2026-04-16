import React, { useEffect, useState } from 'react';
import { isRemoteAvatarUrl } from '../utils/avatar';

interface AvatarImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackSrc: string;
}

const AvatarImage: React.FC<AvatarImageProps> = ({ src, fallbackSrc, ...rest }) => {
  const [resolvedSrc, setResolvedSrc] = useState(fallbackSrc);

  useEffect(() => {
    const nextSrc = (src ?? '').trim();

    if (!nextSrc) {
      setResolvedSrc(fallbackSrc);
      return undefined;
    }

    if (!isRemoteAvatarUrl(nextSrc)) {
      setResolvedSrc(nextSrc);
      return undefined;
    }

    let active = true;
    setResolvedSrc(fallbackSrc);

    const image = new Image();
    image.onload = () => {
      if (active) {
        setResolvedSrc(nextSrc);
      }
    };
    image.onerror = () => {
      if (active) {
        setResolvedSrc(fallbackSrc);
      }
    };
    image.src = nextSrc;

    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [src, fallbackSrc]);

  return <img {...rest} src={resolvedSrc} />;
};

export default AvatarImage;
