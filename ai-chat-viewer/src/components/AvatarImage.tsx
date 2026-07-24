import React, { useEffect, useState } from 'react';
import type { AvatarImageProps } from '../types/components';
import agentOnlineIcon from '../imgs/agent-online.svg';
import agentOfflineIcon from '../imgs/agent-offline.svg';
import agentOnlineDarkIcon from '../imgs/agent-online-dark.svg';
import agentOfflineDarkIcon from '../imgs/agent-offline-dark.svg';

const loadedRemoteAvatarSet = new Set<string>();

const isDarkMode = (): boolean => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

const AvatarImage: React.FC<AvatarImageProps> = ({
  src,
  fallbackSrc,
  showOnlineStatus = false,
  isOnline,
  className,
  ...rest
}) => {
  const [resolvedSrc, setResolvedSrc] = useState(loadedRemoteAvatarSet.has(src ?? '') ? src : fallbackSrc);
  const [darkMode, setDarkMode] = useState(isDarkMode);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) return;

    const handleChange = (event: MediaQueryListEvent) => setDarkMode(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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

  const statusIcon = showOnlineStatus
    ? isOnline
      ? darkMode
        ? agentOnlineDarkIcon
        : agentOnlineIcon
      : darkMode
        ? agentOfflineDarkIcon
        : agentOfflineIcon
    : null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' ,height: '100%'}}>
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
