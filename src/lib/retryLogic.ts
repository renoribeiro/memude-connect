export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  retryOn?: (error: any) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attemptsMade: number;
  totalDelay: number;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 segundo
  maxDelay: 30000, // 30 segundos
  backoffFactor: 2,
  jitter: true,
  retryOn: (error: any) => {
    // Retry em erros de rede, timeouts, e erros 5xx
    if (error?.name === 'NetworkError') return true;
    if (error?.name === 'TimeoutError') return true;
    if (error?.status >= 500) return true;
    if (error?.code === 'ECONNRESET') return true;
    if (error?.code === 'ETIMEDOUT') return true;
    return false;
  }
};

export class RetryableError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...defaultRetryOptions, ...options };
  
  let lastError: any;
  let totalDelay = 0;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const data = await operation();
      return {
        success: true,
        data,
        attemptsMade: attempt,
        totalDelay
      };
    } catch (error) {
      lastError = error;
      
      // Se é um erro não-retryable, para imediatamente
      if (error instanceof NonRetryableError) {
        break;
      }
      
      // Se não deve tentar novamente, para
      if (!opts.retryOn(error)) {
        break;
      }
      
      // Se é a última tentativa, para
      if (attempt === opts.maxAttempts) {
        break;
      }
      
      // Calcula delay com backoff exponencial
      let delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelay
      );
      
      // Adiciona jitter para evitar thundering herd
      if (opts.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }
      
      totalDelay += delay;
      
      console.log(`Retry attempt ${attempt} failed, waiting ${Math.round(delay)}ms:`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return {
    success: false,
    error: lastError,
    attemptsMade: opts.maxAttempts,
    totalDelay
  };
}

// Wrapper específico para chamadas Supabase
export async function withSupabaseRetry<T>(
  operation: () => Promise<{ data: T; error: any }>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  return withRetry(async () => {
    const result = await operation();
    
    if (result.error) {
      // Classifica erros do Supabase
      if (result.error.code === 'PGRST116') {
        throw new NonRetryableError('Resource not found', result.error);
      }
      
      if (result.error.code?.startsWith('PGRST')) {
        throw new NonRetryableError('Database constraint error', result.error);
      }
      
      throw new RetryableError(result.error.message || 'Supabase error', result.error);
    }
    
    return result.data;
  }, {
    retryOn: (error) => {
      if (error instanceof NonRetryableError) return false;
      return defaultRetryOptions.retryOn(error);
    },
    ...options
  });
}

// Wrapper específico para Edge Functions
export async function withEdgeFunctionRetry<T>(
  operation: () => Promise<{ data: T; error: any }>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  return withRetry(async () => {
    const result = await operation();
    
    if (result.error) {
      // Erros 4xx geralmente não devem ser retriados
      if (result.error.status >= 400 && result.error.status < 500) {
        throw new NonRetryableError('Client error', result.error);
      }
      
      throw new RetryableError(result.error.message || 'Edge function error', result.error);
    }
    
    return result.data;
  }, {
    maxAttempts: 3,
    baseDelay: 2000, // Edge functions podem precisar de mais tempo
    ...options
  });
}

// Wrapper para operações de WhatsApp
export async function withWhatsAppRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  return withRetry(operation, {
    maxAttempts: 5, // WhatsApp pode ser instável
    baseDelay: 3000,
    maxDelay: 60000, // Até 1 minuto para WhatsApp
    retryOn: (error) => {
      // Retry em rate limiting
      if (error?.status === 429) return true;
      // Retry em timeout do WhatsApp
      if (error?.code === 'WHATSAPP_TIMEOUT') return true;
      return defaultRetryOptions.retryOn(error);
    },
    ...options
  });
}

// Helper para criar delays
export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Circuit breaker simples
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;
  
  constructor(
    private threshold = 5,
    private timeout = 60000 // 1 minuto
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.reset();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.isOpen = false;
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.isOpen = true;
    }
  }
  
  private reset(): void {
    this.failures = 0;
    this.isOpen = false;
  }
  
  get status() {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}