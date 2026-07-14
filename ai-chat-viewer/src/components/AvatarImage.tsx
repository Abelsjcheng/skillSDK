import React, { useEffect, useState } from 'react';
import type { AvatarImageProps } from '../types/components';
import agentOnlineIcon from '../imgs/agent-online.svg';
import agentOfflineIcon from '../imgs/agent-offline.svg';

const loadedRemoteAvatarSet = new Set<string>();

const AvatarImage: React.FC<AvatarImageProps> = ({
  src,
  fallbackSrc,
  showOnlineStatus,
  isOnline,
  className,
  ...rest
}) => {
  const [resolvedSrc, setResolvedSrc] = useState(loadedRemoteAvatarSet.has(src ?? '') ? src : fallbackSrc);

  useEffect(() => {
    const nextSrc = (src ?? '').trim();

    if (!nextSrc) {
      setResolvedSrc(fallbackSrc);
      return undefined;
    }

    if (loadedRemoteAvatarSet.has(nextSrc)) {
      setResolvedSrc(nextSrc);
      return undefined;
    }

    let active = true;
    setResolvedSrc(fallbackSrc);

    const image = new Image();
    image.onload = () => {
      if (active) {
        loadedRemoteAvatarSet.add(nextSrc);
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

  const statusIcon = showOnlineStatus ? (isOnline ? agentOnlineIcon : agentOfflineIcon) : null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img {...rest} src={resolvedSrc ?? undefined} draggable="false" className={className} />
      {statusIcon && (
        <img
          src={statusIcon}
          alt=""
          className="avatar-status-icon"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            border: '2px solid #ffffff',
          }}
        />
      )}
    </div>
  );
};

export default AvatarImage;
