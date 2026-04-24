import React, { useEffect, useState } from 'react';
import type { AvatarImageProps } from '../types/components';
import { isRemoteAvatarUrl } from '../utils/avatar';

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

  return <img {...rest} src={resolvedSrc} draggable="false" />;
};

export default AvatarImage;
