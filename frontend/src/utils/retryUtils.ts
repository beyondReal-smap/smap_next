/**
 * 재시도 로직을 위한 유틸리티 함수들
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: any) => void;
  shouldRetry?: (error: any) => boolean;
}

interface RetryState {
  attempt: number;
  isRetrying: boolean;
  lastError?: any;
}

/**
 * 지수 백오프를 사용한 재시도 함수
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
    shouldRetry = () => true
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      
      // 마지막 시도인 경우 에러를 던짐
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 재시도 여부 확인
      if (!shouldRetry(error)) {
        throw error;
      }
      
      // 재시도 콜백 호출
      if (onRetry) {
        onRetry(attempt + 1, error);
      }
      
      // 지수 백오프 지연
      const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * 네트워크 에러인지 확인
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  // axios 에러
  if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') {
    return true;
  }
  
  // fetch 에러
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true;
  }
  
  // 기타 네트워크 관련 에러
  const networkMessages = [
    'network error',
    'connection failed',
    'timeout',
    'unreachable',
    'connection refused',
    'dns_probe_finished_nxdomain'
  ];
  
  const errorMessage = (error.message || '').toLowerCase();
  return networkMessages.some(msg => errorMessage.includes(msg));
}

/**
 * 재시도 가능한 에러인지 확인
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  // 네트워크 에러는 재시도 가능
  if (isNetworkError(error)) {
    return true;
  }
  
  // HTTP 상태 코드 기반 판단
  if (error.response && error.response.status) {
    const status = error.response.status;
    // 5xx 서버 에러와 일부 4xx 에러는 재시도 가능
    return status >= 500 || status === 408 || status === 429;
  }
  
  return false;
}

/**
 * 지도 API 로딩 재시도 함수
 */
export async function retryMapApiLoad(
  loadFn: () => Promise<void>,
  mapType: 'google' | 'naver',
  options: RetryOptions = {}
): Promise<void> {
  const defaultOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 8000,
    shouldRetry: (error) => {
      // 지도 API 로딩 실패는 대부분 재시도 가능
      return true;
    },
    onRetry: (attempt, error) => {
      console.warn(`[${mapType.toUpperCase()} MAP] 재시도 ${attempt}/${options.maxRetries || 3}:`, error.message);
    }
  };
  
  return retryWithBackoff(loadFn, { ...defaultOptions, ...options });
}

/**
 * 데이터 페칭 재시도 함수
 */
export async function retryDataFetch<T>(
  fetchFn: () => Promise<T>,
  dataType: string,
  options: RetryOptions = {}
): Promise<T> {
  const defaultOptions: RetryOptions = {
    maxRetries: 2,
    baseDelay: 1500,
    maxDelay: 6000,
    shouldRetry: isRetryableError,
    onRetry: (attempt, error) => {
      console.warn(`[${dataType.toUpperCase()}] 데이터 로딩 재시도 ${attempt}/${options.maxRetries || 2}:`, error.message);
    }
  };
  
  console.log(`[RETRY UTILS] retryDataFetch 시작: ${dataType}`);
  
  try {
    const result = await retryWithBackoff(fetchFn, { ...defaultOptions, ...options });
    console.log(`[RETRY UTILS] retryDataFetch 성공: ${dataType}`, {
      result,
      resultType: typeof result,
      isArray: Array.isArray(result),
      length: Array.isArray(result) ? result.length : 'N/A'
    });
    return result;
  } catch (error) {
    console.error(`[RETRY UTILS] retryDataFetch 실패: ${dataType}`, error);
    throw error;
  }
}

/**
 * 재시도 상태 관리 훅
 */
export function createRetryState(): {
  state: RetryState;
  setRetrying: (isRetrying: boolean) => void;
  setAttempt: (attempt: number) => void;
  setError: (error: any) => void;
  reset: () => void;
} {
  const state: RetryState = {
    attempt: 0,
    isRetrying: false,
    lastError: null
  };
  
  return {
    state,
    setRetrying: (isRetrying: boolean) => {
      state.isRetrying = isRetrying;
    },
    setAttempt: (attempt: number) => {
      state.attempt = attempt;
    },
    setError: (error: any) => {
      state.lastError = error;
    },
    reset: () => {
      state.attempt = 0;
      state.isRetrying = false;
      state.lastError = null;
    }
  };
}

/**
 * 지도 초기화 재시도 함수
 */
export async function retryMapInitialization(
  initFn: () => void,
  mapType: 'google' | 'naver',
  options: RetryOptions = {}
): Promise<void> {
  const defaultOptions: RetryOptions = {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 4000,
    onRetry: (attempt, error) => {
      console.warn(`[${mapType.toUpperCase()} MAP] 초기화 재시도 ${attempt}/${options.maxRetries || 2}:`, error);
    }
  };
  
  return retryWithBackoff(async () => {
    return new Promise<void>((resolve, reject) => {
      try {
        initFn();
        // 지도 초기화는 동기적이므로 즉시 완료로 처리
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }, { ...defaultOptions, ...options });
} 