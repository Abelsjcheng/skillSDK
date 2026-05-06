import { useEffect, useState } from 'react';

export function useMobileDarkMode(isPcMiniApp: boolean): boolean {
  const [prefersDarkMode, setPrefersDarkMode] = useState(() =>
    !isPcMiniApp && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false),
  );

  useEffect(() => {
    if (isPcMiniApp) {
      setPrefersDarkMode(false);
      return;
    }

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) {
      return;
    }

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersDarkMode(event.matches);
    };

    setPrefersDarkMode(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [isPcMiniApp]);

  return prefersDarkMode;
}
