// iOS WebView 전역 에러 핸들러
(function() {
  'use strict';
  
  // iOS WebView 감지
  const isIOSWebView = window.webkit && window.webkit.messageHandlers;
  
  // 전역 에러 핸들러
  window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    
    // iOS WebView에서 무시할 에러들
    const ignoredErrors = [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Script error',
      'Network request failed',
      'Loading chunk',
      'ChunkLoadError',
      'Can\'t find variable: location_refresh',
      'ReferenceError: Can\'t find variable',
      // 구글 로그인 관련 에러들
      'disallowed_useragent',
      'Google 정책에 의해',
      'accounts.google.com',
      'oauth2',
      'blocked_user_agent',
      'popup_blocked_by_browser',
      'popup_closed_by_user',
      'access_denied',
      '403 오류',
      // iOS WebView 라우팅 관련 에러들
      'Application error',
      'client-side exception',
      'localhost',
      'Hydration failed',
      'Text content does not match',
      'useRouter',
      'router.push',
      'Navigation cancelled',
      'Route change aborted',
      'Module not found',
      'Dynamic import',
      'Failed to import',
      'Unexpected token',
      'SyntaxError',
      'TypeError: null is not an object',
      'TypeError: undefined is not an object',
      'null is not an object (evaluating \'o.isArray\')',
      'null is not an object (evaluating \'Array.isArray\')',
      'undefined is not an object (evaluating \'Array.isArray\')',
      'ReferenceError: window is not defined',
      'ReferenceError: document is not defined',
      'Cannot read property',
      'Cannot read properties of null',
      'Cannot read properties of undefined'
    ];
    
    const shouldIgnore = ignoredErrors.some(ignoredError => 
      event.message?.includes(ignoredError) || 
      event.error?.message?.includes(ignoredError)
    );
    
    if (shouldIgnore) {
      console.warn('Ignoring known iOS WebView error:', event.message);
      event.preventDefault();
      return false;
    }
    
    // 네트워크 에러인 경우 재시도 로직
    if (event.message?.includes('Network') || event.message?.includes('fetch')) {
      console.log('Network error detected, attempting recovery...');
      setTimeout(() => {
        if (isIOSWebView) {
          window.location.reload();
        }
      }, 2000);
      event.preventDefault();
      return false;
    }
    
    // 개발 환경에서만 에러 표시
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      console.error('Unhandled error:', event.error);
    }
  });
  
  // Promise rejection 핸들러
  window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    
    // iOS WebView에서 무시할 Promise rejection들
    const ignoredRejections = [
      'Loading CSS chunk',
      'Loading chunk',
      'ChunkLoadError',
      'Network request failed',
      'fetch',
      'NetworkError'
    ];
    
    const shouldIgnore = ignoredRejections.some(ignoredRejection => 
      event.reason?.message?.includes(ignoredRejection) ||
      String(event.reason).includes(ignoredRejection)
    );
    
    if (shouldIgnore) {
      console.warn('Ignoring known iOS WebView promise rejection:', event.reason);
      event.preventDefault();
      return false;
    }
    
    // 네트워크 관련 Promise rejection 처리
    if (String(event.reason).includes('fetch') || String(event.reason).includes('Network')) {
      console.log('Network promise rejection detected, attempting recovery...');
      setTimeout(() => {
        if (isIOSWebView) {
          console.log('Reloading page due to network error...');
          window.location.reload();
        }
      }, 3000);
      event.preventDefault();
      return false;
    }
    
    // 개발 환경에서만 에러 표시
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      console.error('Unhandled promise rejection:', event.reason);
    }
  });
  
  // iOS WebView 특화 설정
  if (window.webkit && window.webkit.messageHandlers) {
    console.log('Running in iOS WebView');
    
    // iOS WebView에서 console.log를 네이티브로 전달
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn
    };
    
    // console.log 오버라이드 제거 - 과도한 로깅 방지
    // console.log = function(...args) {
    //   originalConsole.log.apply(console, args);
    //   try {
    //     if (window.webkit.messageHandlers.consoleLog) {
    //       window.webkit.messageHandlers.consoleLog.postMessage(args.join(' '));
    //     }
    //   } catch (e) {
    //     // 무시
    //   }
    // };
    
    // console.error 오버라이드 제거 - 과도한 로깅 방지
    // console.error = function(...args) {
    //   originalConsole.error.apply(console, args);
    //   try {
    //       if (window.webkit.messageHandlers.consoleError) {
    //         window.webkit.messageHandlers.consoleError.postMessage(args.join(' '));
    //       }
    //     } catch (e) {
    //       // 무시
    //     }
    //   };
  }
  
  // 네트워크 연결 상태 모니터링 (비활성화됨)
  // let connectionRetryCount = 0;
  // const maxRetries = 3;
  
  // function checkConnection() {
  //   if (isIOSWebView) {
  //     // 간단한 연결 테스트
  //     fetch('/api/health', { 
  //       method: 'GET',
  //       timeout: 5000,
  //       cache: 'no-cache'
  //     })
  //     .then(response => {
  //       console.log('Connection check successful');
  //       connectionRetryCount = 0;
  //     })
  //     .catch(error => {
  //       console.warn('Connection check failed:', error);
  //       connectionRetryCount++;
  //       
  //       if (connectionRetryCount <= maxRetries) {
  //         console.log(`Retrying connection... (${connectionRetryCount}/${maxRetries})`);
  //         setTimeout(checkConnection, 2000 * connectionRetryCount);
  //       } else {
  //         console.error('Max connection retries reached, reloading page...');
  //         window.location.reload();
  //       }
  //     });
  //   }
  // }
  
  // 페이지 로드 완료 시 iOS 앱에 알림 및 연결 확인
  window.addEventListener('load', function() {
    console.log('Page loaded successfully');
    
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pageLoaded) {
        window.webkit.messageHandlers.pageLoaded.postMessage('loaded');
      }
    } catch (e) {
      console.warn('Could not notify iOS app of page load:', e);
    }
    
    // 연결 상태 확인 (3초 후) - 비활성화됨
    // setTimeout(checkConnection, 3000);
  });
  
  // 페이지 가시성 변경 시 연결 확인 - 비활성화됨
  // document.addEventListener('visibilitychange', function() {
  //   if (!document.hidden && isIOSWebView) {
  //     console.log('Page became visible, checking connection...');
  //     setTimeout(checkConnection, 1000);
  //   }
  // });
  
  // iOS 앱 상태 변경 감지 - 비활성화됨
  // window.addEventListener('pageshow', function(event) {
  //   if (event.persisted && isIOSWebView) {
  //     console.log('Page restored from cache, checking connection...');
  //     setTimeout(checkConnection, 1000);
  //   }
  // });
  
})(); 