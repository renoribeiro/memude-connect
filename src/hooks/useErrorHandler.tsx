import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  customMessage?: string;
}

export const useErrorHandler = () => {
  const handleError = useCallback((
    error: Error | string | unknown,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      logToConsole = true,
      customMessage
    } = options;

    let errorMessage: string;
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Ocorreu um erro inesperado';
    }

    // Log to console in development
    if (logToConsole && process.env.NODE_ENV === 'development') {
      console.error('Error handled by useErrorHandler:', error);
    }

    // Show toast notification
    if (showToast) {
      toast({
        title: 'Erro',
        description: customMessage || errorMessage,
        variant: 'destructive',
      });
    }

    return errorMessage;
  }, []);

  const handleAsyncError = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    options: ErrorHandlerOptions = {}
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error, options);
      return null;
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
  };
};

export default useErrorHandler;