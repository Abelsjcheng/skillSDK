import { useCallback, useRef, useState } from 'react';

export function useSubmitLock() {
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const runWithSubmitLock = useCallback(async <T>(task: () => Promise<T> | T): Promise<T | undefined> => {
    if (submittingRef.current) {
      return undefined;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      return await task();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, []);

  return {
    submitting,
    runWithSubmitLock,
  };
}
