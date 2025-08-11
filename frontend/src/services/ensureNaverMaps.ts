import { API_KEYS } from '../config';

declare global {
  interface Window {
    __NAVER_MAPS_LOADING__?: boolean;
    __NAVER_MAPS_PROMISE__?: Promise<void> | null;
  }
}

type EnsureOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
  submodules?: string; // e.g., 'geocoder,drawing,visualization'
  useCallbackParam?: boolean; // API 문서 스타일의 callback 파라미터 사용
};

const DEFAULT_OPTIONS: Required<EnsureOptions> = {
  maxRetries: 5,
  initialDelayMs: 400,
  submodules: 'geocoder',
  useCallbackParam: true,
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildScriptUrl(submodules: string, useCallbackParam: boolean, cbName: string): string {
  const clientId = API_KEYS.NAVER_MAPS_CLIENT_ID;
  const url = new URL('https://oapi.map.naver.com/openapi/v3/maps.js');
  url.searchParams.set('ncpKeyId', clientId);
  if (submodules) url.searchParams.set('submodules', submodules);
  if (useCallbackParam) url.searchParams.set('callback', cbName);
  // 캐시 버스터
  url.searchParams.set('ts', String(Date.now()));
  return url.toString();
}

function injectScript(src: string, id: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // 기존 스크립트 제거 (id/URL 둘 다 검사)
    const existingById = document.getElementById(id);
    if (existingById) existingById.remove();
    const existingByUrl = Array.from(document.querySelectorAll('script'))
      .find((s) => (s as HTMLScriptElement).src?.includes('oapi.map.naver.com/openapi/v3/maps.js'));
    if (existingByUrl && existingByUrl.parentElement) existingByUrl.parentElement.removeChild(existingByUrl);

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;

    const handleLoad = () => resolve();
    const handleError = () => reject(new Error('Naver Maps script load error'));

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    document.head.appendChild(script);
  });
}

export async function ensureNaverMapsLoaded(options?: EnsureOptions): Promise<void> {
  const isAndroidWebView = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && /WebView|wv|SMAP-Android/i.test(navigator.userAgent);
  // 안드로이드 WebView에서는 네이버 스크립트 URL 리라이트 이슈(ORB, 경로 왜곡) 회피를 위해 submodules 제거 및 callback 미사용
  const platformSafeOverrides: Partial<EnsureOptions> = isAndroidWebView
    ? { submodules: '', useCallbackParam: false }
    : {};
  const opts = { ...DEFAULT_OPTIONS, ...platformSafeOverrides, ...(options || {}) };

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (window.naver?.maps) return;
  if (window.__NAVER_MAPS_PROMISE__) {
    return window.__NAVER_MAPS_PROMISE__!;
  }

  const p = new Promise<void>(async (resolve, reject) => {
    let attempt = 0;
    let lastError: any = null;

    // 전역 에러 리스너로 인증/서버 오류 감지 시 재시도 트리거
    const onWindowError = (event: ErrorEvent) => {
      const msg = event.message || '';
      if (
        msg.includes('oapi.map.naver.com') ||
        msg.includes('naver') ||
        msg.includes('maps') ||
        msg.includes('Unauthorized') ||
        msg.includes('Internal Server Error')
      ) {
        // swallow; 다음 루프에서 재시도
        lastError = new Error(msg);
      }
    };
    window.addEventListener('error', onWindowError);

    try {
      while (attempt <= opts.maxRetries) {
        try {
          const cbName = '__NAVER_MAPS_READY__';
          let resolvedByCallback = false;

          // callback 방식 등록
          if (opts.useCallbackParam) {
            (window as any)[cbName] = () => {
              resolvedByCallback = true;
              resolve();
            };
          }

          const src = buildScriptUrl(opts.submodules, !!opts.useCallbackParam, cbName);
          await injectScript(src, 'naver-maps-ensure');

          // 폴백: callback 미호출 시에도 준비 확인 (최대 8초)
          const deadline = Date.now() + 8000;
          while (!window.naver?.maps && Date.now() < deadline && !resolvedByCallback) {
            await delay(50);
          }
          if (window.naver?.maps || resolvedByCallback) {
            resolve();
            return;
          }
          throw new Error('Naver Maps not initialized in time');
        } catch (e) {
          lastError = e;
          attempt += 1;
          if (attempt > opts.maxRetries) break;
          const backoff = opts.initialDelayMs * Math.pow(2, attempt - 1);
          await delay(backoff);
        }
      }
      throw lastError || new Error('Failed to load Naver Maps');
    } finally {
      window.removeEventListener('error', onWindowError);
    }
  });

  window.__NAVER_MAPS_PROMISE__ = p;

  try {
    await p;
  } catch (e) {
    window.__NAVER_MAPS_PROMISE__ = null;
    throw e;
  }
}

export default ensureNaverMapsLoaded;


