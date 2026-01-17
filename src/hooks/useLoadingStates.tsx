import { useState, useCallback } from 'react';

export interface LoadingState {
  [key: string]: boolean;
}

export const useLoadingStates = () => {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));
  }, []);

  const isLoading = useCallback((key: string): boolean => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const withLoading = useCallback(async <T,>(
    key: string,
    asyncFn: () => Promise<T>
  ): Promise<T | null> => {
    try {
      setLoading(key, true);
      return await asyncFn();
    } finally {
      setLoading(key, false);
    }
  }, [setLoading]);

  const clearAll = useCallback(() => {
    setLoadingStates({});
  }, []);

  return {
    loadingStates,
    setLoading,
    isLoading,
    withLoading,
    clearAll,
  };
};