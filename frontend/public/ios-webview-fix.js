// iOS WebView 타임아웃 방지 및 빠른 로딩 최적화
(function() {
  'use strict';
  
  // iOS WebView 감지 및 즉시 최적화 시작
  const isIOSWebView = window.webkit && window.webkit.messageHandlers;
  
  if (isIOSWebView) {
    console.log('[iOS WebView] 타임아웃 방지 및 최적화 시작...');
    
    // 0. 전역 객체 초기화 문제 방지 (Array, Object 등) - 강화 버전
    function ensureGlobalObjects() {
      try {
        // Array 객체가 없거나 손상된 경우 복구
        if (typeof Array === 'undefined' || !Array || typeof Array.isArray !== 'function') {
          console.warn('[iOS WebView] Array 객체 손상 감지 - 복구 시도');
          if (typeof window !== 'undefined') {
            // 네이티브 Array 함수 복구
            window.Array = window.Array || function() {
              const arr = [];
              for (let i = 0; i < arguments.length; i++) {
                arr[i] = arguments[i];
              }
              return arr;
            };
            
            // Array.isArray 메소드 복구 - 강화 버전
            if (!window.Array.isArray) {
              window.Array.isArray = function(obj) {
                if (obj === null || obj === undefined) return false;
                try {
                  return Object.prototype.toString.call(obj) === '[object Array]';
                } catch (e) {
                  // Object.prototype.toString도 실패하면 기본 속성 체크
                  return !!(obj && typeof obj === 'object' && 
                           typeof obj.length === 'number' && 
                           typeof obj.push === 'function' &&
                           typeof obj.slice === 'function');
                }
              };
            }
            
            // 전역 스코프에도 할당
            if (typeof globalThis !== 'undefined') {
              globalThis.Array = window.Array;
            }
            if (typeof self !== 'undefined') {
              self.Array = window.Array;
            }
            
            // 추가 Array 메소드들도 복구
            if (!window.Array.prototype) {
              window.Array.prototype = Array.prototype || {};
            }
          }
        }
        
        // Object 객체가 없거나 손상된 경우 복구
        if (typeof Object === 'undefined' || !Object || !Object.prototype || !Object.prototype.toString) {
          console.warn('[iOS WebView] Object 객체 손상 감지 - 복구 시도');
          // Object는 더 복잡하므로 기본적인 복구만 시도
          if (typeof window !== 'undefined' && !window.Object) {
            window.Object = Object || {};
            if (!window.Object.prototype) {
              window.Object.prototype = {};
            }
            if (!window.Object.prototype.toString) {
              window.Object.prototype.toString = function() {
                return '[object Object]';
              };
            }
          }
        }
        
        // Function 객체 확인
        if (typeof Function === 'undefined' || !Function) {
          console.warn('[iOS WebView] Function 객체 손상 감지');
          if (typeof window !== 'undefined' && !window.Function) {
            window.Function = Function || function() {};
          }
        }
        
        console.log('[iOS WebView] 전역 객체 상태:', {
          Array: typeof Array,
          ArrayIsArray: typeof Array !== 'undefined' && Array && typeof Array.isArray === 'function',
          Object: typeof Object,
          ObjectPrototype: typeof Object !== 'undefined' && Object && Object.prototype && Object.prototype.toString,
          Function: typeof Function,
          window: typeof window
        });
      } catch (error) {
        console.error('[iOS WebView] 전역 객체 복구 실패:', error);
        // 에러가 발생해도 기본적인 복구는 시도
        try {
          if (typeof window !== 'undefined') {
            // 최소한의 Array.isArray만이라도 복구
            if (!window.Array || !window.Array.isArray) {
              window.Array = window.Array || Array || function() { return []; };
              window.Array.isArray = window.Array.isArray || function(obj) {
                return !!(obj && typeof obj === 'object' && typeof obj.length === 'number');
              };
            }
          }
        } catch (fallbackError) {
          console.error('[iOS WebView] 폴백 복구도 실패:', fallbackError);
        }
      }
    }
    
    // 즉시 전역 객체 확인 및 복구
    ensureGlobalObjects();
    
    // Next.js 스크립트 파싱 오류 방지 (추가)
    function preventNextJSParsingErrors() {
      try {
        // self.__next_f 및 self.__next_s 안전성 확보
        if (typeof window !== 'undefined') {
          window.self = window.self || window;
          window.self.__next_f = window.self.__next_f || [];
          window.self.__next_s = window.self.__next_s || [];
          
          // Array.prototype.push 안전성 강화
          const originalPush = Array.prototype.push;
          const safePush = function(...args) {
            try {
              return originalPush.apply(this, args);
            } catch (error) {
              console.warn('[iOS WebView] Next.js Array push 오류 무시:', error);
              return this.length;
            }
          };
          
          // Next.js 전용 배열에 안전한 push 적용
          if (window.self.__next_f && Array.isArray(window.self.__next_f)) {
            window.self.__next_f.push = safePush.bind(window.self.__next_f);
          }
          if (window.self.__next_s && Array.isArray(window.self.__next_s)) {
            window.self.__next_s.push = safePush.bind(window.self.__next_s);
          }
          
          console.log('[iOS WebView] Next.js 스크립트 파싱 오류 방지 설정 완료');
        }
      } catch (error) {
        console.error('[iOS WebView] Next.js 파싱 오류 방지 설정 실패:', error);
      }
    }
    
    // Next.js 파싱 오류 방지 즉시 실행
    preventNextJSParsingErrors();
    
    // 강화된 에러 핸들링 함수 정의
    function setupEnhancedErrorHandling() {
      // 구글 로그인 후 home 진입 시 발생하는 특정 에러들 처리
      const homePageErrorPatterns = [
        /null is not an object \(evaluating '.*\.isArray'\)/,
        /undefined is not an object \(evaluating '.*\.isArray'\)/,
        /o\.isArray/,
        /Array\.isArray/,
        /Cannot read property 'isArray'/,
        /Cannot read properties of null.*isArray/,
        /Cannot read properties of undefined.*isArray/
      ];
      
      // Next.js 파싱 오류 패턴 추가
      const nextJSErrorPatterns = [
        /__next_/,
        /self\.__next_f/,
        /self\.__next_s/,
        /Unexpected token/,
        /SyntaxError.*return/,
        /Return statements are only valid inside functions/,
        /_next\/static/,
        /chunk.*loading.*error/
      ];
      
      window.addEventListener('error', function(event) {
        const errorMessage = event.message || '';
        const errorFilename = event.filename || '';
        const isHomePageError = homePageErrorPatterns.some(pattern => pattern.test(errorMessage));
        const isNextJSError = nextJSErrorPatterns.some(pattern => pattern.test(errorMessage + errorFilename));
        
        if (isHomePageError) {
          console.warn('[iOS WebView] Home 페이지 Array.isArray 에러 감지, 복구 시도:', errorMessage);
          event.preventDefault();
          
          // 즉시 전역 객체 복구 재시도
          ensureGlobalObjects();
          
          // 에러가 발생한 페이지가 home이면 약간의 지연 후 새로고침
          if (window.location.pathname.includes('/home')) {
            setTimeout(() => {
              console.log('[iOS WebView] Home 페이지 Array.isArray 에러 복구를 위한 새로고침');
              window.location.reload();
            }, 1000);
          }
          
          return false;
        }
        
        if (isNextJSError) {
          console.warn('[iOS WebView] Next.js 스크립트 파싱 오류 감지, 무시:', errorMessage);
          event.preventDefault();
          
          // Next.js 파싱 오류 방지 함수 재실행
          preventNextJSParsingErrors();
          
          return false;
        }
      });
      
      // Promise rejection도 처리
      window.addEventListener('unhandledrejection', function(event) {
        const reason = String(event.reason || '');
        const isArrayError = reason.includes('isArray') || reason.includes('Array');
        
        if (isArrayError) {
          console.warn('[iOS WebView] Promise에서 Array 관련 에러 감지:', reason);
          event.preventDefault();
          ensureGlobalObjects();
          return false;
        }
      });
    }
    
    // 강화된 에러 핸들링 설정
    setupEnhancedErrorHandling();
    
    // 페이지 로드 완료 후 다시 한 번 확인
    document.addEventListener('DOMContentLoaded', function() {
      ensureGlobalObjects();
      setupEnhancedErrorHandling(); // 추가 안전장치
    });
    
    window.addEventListener('load', function() {
      ensureGlobalObjects();
      // home 페이지인 경우 추가 체크
      if (window.location.pathname.includes('/home')) {
        console.log('[iOS WebView] Home 페이지 로드 완료, Array.isArray 상태 체크');
        setTimeout(() => {
          if (typeof Array === 'undefined' || !Array || !Array.isArray) {
            console.warn('[iOS WebView] Home 페이지에서 Array.isArray 여전히 문제 있음, 재복구');
            ensureGlobalObjects();
          }
        }, 500);
      }
    });
    
    // 1. 즉시 로딩 상태 표시 (백그라운드 작업 타임아웃 방지)
    document.addEventListener('DOMContentLoaded', function() {
      const loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'ios-loading-indicator';
      loadingIndicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
        background: rgba(255, 255, 255, 0.95);
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: none;
      `;
      loadingIndicator.innerHTML = `
        <div style="width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
        <p style="margin: 0; color: #64748b; font-size: 14px;">로딩 중...</p>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      document.body.appendChild(loadingIndicator);
      
      // 로딩이 5초 이상 걸리면 표시
      const showLoadingTimer = setTimeout(() => {
        loadingIndicator.style.display = 'block';
      }, 5000);
      
      // 페이지 로드 완료 시 숨김
      window.addEventListener('load', () => {
        clearTimeout(showLoadingTimer);
        loadingIndicator.style.display = 'none';
      });
      
      // React 마운트 완료 감지
      const checkReactMount = setInterval(() => {
        if (document.querySelector('[data-react-mount]') || 
            document.querySelector('.min-h-screen') ||
            document.querySelector('#home-page-container')) {
          clearTimeout(showLoadingTimer);
          loadingIndicator.style.display = 'none';
          clearInterval(checkReactMount);
        }
      }, 500);
    });
    
    // 2. 백그라운드 작업 타임아웃 방지
    let backgroundTaskId = null;
    
    function startBackgroundTask() {
      if (window.webkit?.messageHandlers?.smapIos) {
        try {
          window.webkit.messageHandlers.smapIos.postMessage({
            type: 'startBackgroundTask',
            data: { reason: 'page_loading' }
          });
          console.log('[iOS WebView] 백그라운드 작업 시작');
        } catch (error) {
          console.warn('[iOS WebView] 백그라운드 작업 시작 실패:', error);
        }
      }
    }
    
    function endBackgroundTask() {
      if (window.webkit?.messageHandlers?.smapIos) {
        try {
          window.webkit.messageHandlers.smapIos.postMessage({
            type: 'endBackgroundTask',
            data: {}
          });
          console.log('[iOS WebView] 백그라운드 작업 종료');
        } catch (error) {
          console.warn('[iOS WebView] 백그라운드 작업 종료 실패:', error);
        }
      }
    }
    
    // 페이지 로딩 시작 시 백그라운드 작업 시작
    startBackgroundTask();
    
    // 페이지 로딩 완료 시 백그라운드 작업 종료
    window.addEventListener('load', endBackgroundTask);
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(endBackgroundTask, 2000); // 2초 후 종료
    });
    
    // 3. 네트워크 요청 타임아웃 단축
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
      const timeoutMs = options.timeout || 8000; // 8초로 단축
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const fetchOptions = {
        ...options,
        signal: controller.signal
      };
      
      return originalFetch(url, fetchOptions)
        .finally(() => clearTimeout(timeoutId))
        .catch(error => {
          if (error.name === 'AbortError') {
            console.warn('[iOS WebView] 요청 타임아웃:', url);
            // 타임아웃 시 간단한 재시도
            return originalFetch(url, { ...options, timeout: 5000 });
          }
          throw error;
        });
    };
    
    // 4. 메모리 최적화
    function optimizeMemoryForIOS() {
      // 사용하지 않는 DOM 요소 정리
      const cleanupElements = document.querySelectorAll('[data-cleanup="true"]');
      cleanupElements.forEach(el => el.remove());
      
      // 가비지 컬렉션 힌트
      if (window.gc) {
        setTimeout(() => {
          try {
            window.gc();
          } catch (e) {
            // 무시
          }
        }, 5000);
      }
    }
    
    // 5초 후 메모리 최적화 실행
    setTimeout(optimizeMemoryForIOS, 5000);
    
    // 5. 페이지 가시성 변경 시 최적화
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        // 페이지가 숨겨질 때 백그라운드 작업 종료
        endBackgroundTask();
      } else {
        // 페이지가 다시 보일 때 백그라운드 작업 시작
        startBackgroundTask();
      }
    });
    
    console.log('[iOS WebView] 타임아웃 방지 및 최적화 설정 완료');
  }
})();

// iOS WebView 특화 수정사항
(function() {
  'use strict';
  
  // iOS WebView 감지
  const isIOSWebView = window.webkit && window.webkit.messageHandlers;
  
  if (isIOSWebView) {
    console.log('iOS WebView detected, applying fixes...');
    
    // 1. location_refresh 함수 정의 (로그에서 발견된 에러 해결)
    window.location_refresh = function() {
      console.log('location_refresh called');
      window.location.reload();
    };
    
    // 2. iOS WebView에서 fetch 요청 최적화 (안전한 버전)
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
      // 기본 옵션 설정 (최소한의 설정만)
      const fetchOptions = {
        ...options,
        credentials: options.credentials || 'same-origin'
      };
      
      // 원본 fetch 호출
      return originalFetch(url, fetchOptions)
        .catch(error => {
          console.warn('Fetch error in iOS WebView:', error);
          
          // 특정 에러 타입에 대해서만 재시도
          if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            console.log('Network error detected, retrying once...');
            // 한 번만 재시도
            return originalFetch(url, fetchOptions);
          }
          
          // 다른 에러는 그대로 전파
          throw error;
        });
    };
    
    // 3. iOS WebView에서 XMLHttpRequest 최적화
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
      this.timeout = 10000; // 10초 타임아웃
      return originalXHROpen.call(this, method, url, async, user, password);
    };
    
    // 4. iOS WebView에서 이미지 로딩 최적화
    document.addEventListener('DOMContentLoaded', function() {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        img.addEventListener('error', function() {
          console.warn('Image load failed:', this.src);
          // 이미지 로드 실패 시 재시도
          setTimeout(() => {
            const newSrc = this.src;
            this.src = '';
            this.src = newSrc;
          }, 1000);
        });
      });
    });
    
    // 5. iOS WebView에서 스크롤 성능 최적화
    document.addEventListener('DOMContentLoaded', function() {
      document.body.style.webkitOverflowScrolling = 'touch';
      document.body.style.overflowScrolling = 'touch';
      
      // iOS WebView에서 애니메이션 강제 적용
      fixAnimationsForIOS();
    });
    
    // iOS WebView 애니메이션 수정 함수 (강화된 버전)
    function fixAnimationsForIOS() {
      console.log('Fixing animations for iOS WebView...');
      
      // 모든 animate-spin 요소 찾기 및 강제 애니메이션 적용
      const spinElements = document.querySelectorAll('.animate-spin, [class*="animate-spin"]');
      spinElements.forEach((element, index) => {
        console.log(`Fixing spin animation for element ${index}:`, element.className);
        
        // 기존 클래스 유지하면서 강제 스타일 적용
        element.classList.add('ios-animate-spin', 'force-spin');
        
        // 인라인 스타일로 강제 적용 (CSS보다 우선순위 높음)
        element.style.webkitAnimation = 'continuous-spin 0.8s linear infinite';
        element.style.animation = 'continuous-spin 0.8s linear infinite';
        element.style.webkitTransformOrigin = 'center center';
        element.style.transformOrigin = 'center center';
        element.style.willChange = 'transform';
        element.style.webkitBackfaceVisibility = 'hidden';
        element.style.backfaceVisibility = 'hidden';
        element.style.display = 'inline-block';
        element.style.webkitPerspective = '1000px';
        element.style.perspective = '1000px';
        
        // requestAnimationFrame을 사용한 강제 애니메이션
        let rotation = 0;
        function forceRotate() {
          rotation += 4; // 4도씩 회전
          if (rotation >= 360) rotation = 0;
          
          element.style.webkitTransform = `rotate(${rotation}deg)`;
          element.style.transform = `rotate(${rotation}deg)`;
          
          // 요소가 여전히 DOM에 있고 애니메이션이 필요한 경우 계속 실행
          if (document.contains(element) && element.classList.contains('animate-spin')) {
            requestAnimationFrame(forceRotate);
          }
        }
        
        // CSS 애니메이션이 작동하지 않을 경우를 대비한 JavaScript 애니메이션
        setTimeout(() => {
          const computedStyle = window.getComputedStyle(element);
          const animationName = computedStyle.animationName;
          
          if (animationName === 'none' || !animationName) {
            console.log(`CSS animation not working for element ${index}, using JavaScript fallback`);
            forceRotate();
          }
        }, 100);
      });
      
      // 모든 animate-pulse 요소 찾기
      const pulseElements = document.querySelectorAll('.animate-pulse, [class*="animate-pulse"]');
      pulseElements.forEach((element, index) => {
        // console.log(`Fixing pulse animation for element ${index}:`, element.className);
        
        element.classList.add('ios-animate-pulse');
        element.style.webkitAnimation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
        element.style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
        element.style.willChange = 'transform, opacity';
        element.style.webkitBackfaceVisibility = 'hidden';
        element.style.backfaceVisibility = 'hidden';
      });
      
      // 모든 animate-bounce 요소 찾기
      const bounceElements = document.querySelectorAll('.animate-bounce, [class*="animate-bounce"]');
      bounceElements.forEach((element, index) => {
        console.log(`Fixing bounce animation for element ${index}:`, element.className);
        
        element.classList.add('ios-animate-bounce');
        element.style.webkitAnimation = 'bounce 1s infinite';
        element.style.animation = 'bounce 1s infinite';
        element.style.willChange = 'transform';
        element.style.webkitBackfaceVisibility = 'hidden';
        element.style.backfaceVisibility = 'hidden';
      });
      
      console.log(`Fixed ${spinElements.length} spin, ${pulseElements.length} pulse, ${bounceElements.length} bounce animations`);
    }
    
    // DOM 변경 감지하여 새로 추가된 애니메이션 요소들도 수정
    const observer = new MutationObserver(function(mutations) {
      let shouldFix = false;
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              if (node.classList && (
                node.classList.contains('animate-spin') ||
                node.classList.contains('animate-pulse') ||
                node.classList.contains('animate-bounce')
              )) {
                shouldFix = true;
              }
              // 자식 요소들도 확인
              const animatedChildren = node.querySelectorAll && node.querySelectorAll('.animate-spin, .animate-pulse, .animate-bounce');
              if (animatedChildren && animatedChildren.length > 0) {
                shouldFix = true;
              }
            }
          });
        }
      });
      
      if (shouldFix) {
        setTimeout(fixAnimationsForIOS, 100); // 약간의 지연 후 수정
      }
    });
    
    // DOM 감시 시작
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // 6. iOS WebView에서 지도 API 로딩 문제 해결
    function fixMapLoadingForIOS() {
      console.log('Fixing map loading for iOS WebView...');
      
      // iOS WebView 전용 네이버 지도 설정
      if (typeof window.naver === 'undefined') {
        window.naver = {};
      }
      
      // 네이버 지도 API 로딩 상태 확인 및 최적화
      function checkAndOptimizeNaverMaps() {
        const naverScript = document.querySelector('script[src*="oapi.map.naver.com"]');
        
        if (naverScript) {
          console.log('Naver Maps script found, optimizing for iOS WebView...');
          
          // 스크립트 로딩 완료 대기
          const checkNaverAPI = setInterval(() => {
            if (window.naver && window.naver.maps) {
              clearInterval(checkNaverAPI);
              console.log('Naver Maps API loaded successfully in iOS WebView');
              
              try {
                // iOS WebView 전용 네이버 지도 설정
                window.naver.maps.jsapi = window.naver.maps.jsapi || {};
                
                // 인증 실패 처리
                const originalLoad = window.naver.maps.load;
                if (originalLoad) {
                  window.naver.maps.load = function(modules, callback) {
                    console.log('Naver Maps load called with modules:', modules);
                    
                    try {
                      return originalLoad.call(this, modules, function() {
                        console.log('Naver Maps modules loaded successfully');
                        if (callback) callback.apply(this, arguments);
                      });
                    } catch (error) {
                      console.error('Naver Maps load error:', error);
                      // 구글 지도로 폴백
                      setTimeout(() => {
                        const fallbackEvent = new CustomEvent('mapFallbackToGoogle', {
                          detail: { reason: 'naver_load_error', error: error.message }
                        });
                        document.dispatchEvent(fallbackEvent);
                      }, 1000);
                      
                      if (callback) callback();
                    }
                  };
                }
                
                // 네이버 지도 준비 완료 이벤트
                const readyEvent = new CustomEvent('naverMapsReady', {
                  detail: { source: 'ios-webview-fix' }
                });
                document.dispatchEvent(readyEvent);
                
              } catch (error) {
                console.error('Error setting up Naver Maps for iOS WebView:', error);
              }
            }
          }, 100);
          
          // 10초 후 타임아웃
          setTimeout(() => {
            clearInterval(checkNaverAPI);
            if (!window.naver || !window.naver.maps) {
              console.log('Naver Maps loading timeout in iOS WebView, falling back to Google Maps');
              const timeoutEvent = new CustomEvent('mapFallbackToGoogle', {
                detail: { reason: 'naver_timeout' }
              });
              document.dispatchEvent(timeoutEvent);
            }
          }, 10000);
          
        } else {
          console.log('Naver Maps script not found, will fallback to Google Maps');
          setTimeout(() => {
            const noScriptEvent = new CustomEvent('mapFallbackToGoogle', {
              detail: { reason: 'naver_script_not_found' }
            });
            document.dispatchEvent(noScriptEvent);
          }, 2000);
        }
      }
      
      // 구글 지도 API 최적화
      function optimizeGoogleMaps() {
        if (window.google && window.google.maps) {
          console.log('Google Maps API already loaded in iOS WebView');
          
          // 구글 지도 준비 완료 이벤트
          const readyEvent = new CustomEvent('googleMapsReady', {
            detail: { source: 'ios-webview-fix' }
          });
          document.dispatchEvent(readyEvent);
        }
      }
      
      // 지도 컨테이너 최적화
      function optimizeMapContainers() {
        const mapContainers = document.querySelectorAll('[id*="map"], .map-container, #googleMapContainer, #naverMapContainer');
        
        mapContainers.forEach(container => {
          if (container) {
            console.log('Optimizing map container for iOS WebView:', container.id || container.className);
            
            // iOS WebView 전용 스타일 적용
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'relative';
            container.style.overflow = 'hidden';
            container.style.webkitTransform = 'translateZ(0)';
            container.style.transform = 'translateZ(0)';
            container.style.webkitBackfaceVisibility = 'hidden';
            container.style.backfaceVisibility = 'hidden';
            
            // 강제 리사이즈 트리거
            setTimeout(() => {
              const resizeEvent = new Event('resize');
              window.dispatchEvent(resizeEvent);
            }, 500);
          }
        });
      }
      
      // 실행
      checkAndOptimizeNaverMaps();
      optimizeGoogleMaps();
      optimizeMapContainers();
      
      // DOM 변경 감지하여 새로운 지도 컨테이너 최적화
      const mapObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function(node) {
              if (node.nodeType === 1) {
                const mapElements = node.querySelectorAll && node.querySelectorAll('[id*="map"], .map-container');
                if (mapElements && mapElements.length > 0) {
                  setTimeout(optimizeMapContainers, 100);
                }
              }
            });
          }
        });
      });
      
      mapObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
    // 7. iOS WebView에서 네트워크 요청 최적화
    function optimizeNetworkForIOS() {
      console.log('Optimizing network requests for iOS WebView...');
      
      // Fetch API 래퍼로 타임아웃 및 재시도 로직 추가
      const originalFetch = window.fetch;
      window.fetch = function(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
        
        const fetchOptions = {
          ...options,
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...options.headers
          }
        };
        
        return originalFetch(url, fetchOptions)
          .then(response => {
            clearTimeout(timeoutId);
            return response;
          })
          .catch(error => {
            clearTimeout(timeoutId);
            console.error('Fetch error:', error);
            
            // 네트워크 오류 시 재시도
            if (error.name === 'AbortError' || error.message.includes('network')) {
              console.log('Retrying fetch request...');
              return new Promise(resolve => {
                setTimeout(() => {
                  resolve(originalFetch(url, options));
                }, 1000);
              });
            }
            throw error;
          });
      };
    }
    
    // 8. iOS WebView에서 지도 스크립트 로딩 최적화
    function optimizeMapScriptLoading() {
      console.log('Optimizing map script loading for iOS WebView...');
      
      // 스크립트 로딩 상태 추적
      window.mapScriptLoadStatus = window.mapScriptLoadStatus || {
        naver: false,
        google: false
      };
      
      // 네이버 지도 스크립트 로딩 감지
      const checkNaverMaps = setInterval(() => {
        if (window.naver && window.naver.maps && !window.mapScriptLoadStatus.naver) {
          console.log('Naver Maps API detected and ready');
          window.mapScriptLoadStatus.naver = true;
          clearInterval(checkNaverMaps);
          
          // 지도 준비 완료 이벤트 발생
          const event = new CustomEvent('naverMapsReady');
          document.dispatchEvent(event);
        }
      }, 100);
      
      // 구글 지도 스크립트 로딩 감지
      const checkGoogleMaps = setInterval(() => {
        if (window.google && window.google.maps && !window.mapScriptLoadStatus.google) {
          console.log('Google Maps API detected and ready');
          window.mapScriptLoadStatus.google = true;
          clearInterval(checkGoogleMaps);
          
          // 지도 준비 완료 이벤트 발생
          const event = new CustomEvent('googleMapsReady');
          document.dispatchEvent(event);
        }
      }, 100);
      
      // 10초 후 체크 중단
      setTimeout(() => {
        clearInterval(checkNaverMaps);
        clearInterval(checkGoogleMaps);
      }, 10000);
    }
    
    // iOS WebView 최적화 함수들 실행
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(() => {
        fixMapLoadingForIOS();
        optimizeNetworkForIOS();
        optimizeMapScriptLoading();
      }, 1000);
    });
    
    // 페이지 로드 완료 후에도 실행
    window.addEventListener('load', function() {
      setTimeout(() => {
        fixMapLoadingForIOS();
        fixGoogleAuthForIOS();
      }, 2000);
    });
    
    // 9. iOS WebView에서 구글 로그인 문제 해결
    function fixGoogleAuthForIOS() {
      console.log('Fixing Google Auth for iOS WebView...');
      
      // User-Agent 스푸핑으로 구글 로그인 우회
      if (window.webkit && window.webkit.messageHandlers) {
        // 구글 로그인 관련 요청 감지 및 처리
        const originalOpen = window.open;
        window.open = function(url, target, features) {
          console.log('Window.open intercepted:', url);
          
          // 구글 OAuth URL 감지
          if (url && (url.includes('accounts.google.com') || url.includes('oauth2'))) {
            console.log('Google OAuth detected, redirecting to native handler');
            
            // iOS 앱에 구글 로그인 요청 전달
            try {
              if (window.webkit.messageHandlers.googleLogin) {
                window.webkit.messageHandlers.googleLogin.postMessage({
                  url: url,
                  action: 'login'
                });
                return null; // 기본 동작 차단
              }
            } catch (e) {
              console.error('Failed to send Google login request to iOS:', e);
            }
          }
          
          return originalOpen.call(window, url, target, features);
        };
        
        // 구글 로그인 버튼 클릭 이벤트 가로채기
        document.addEventListener('click', function(event) {
          const target = event.target;
          
          // 구글 로그인 버튼 감지 (다양한 선택자로) - React 핸들러 제외
          if ((target.closest('[data-provider="google"]') || 
              target.closest('.google-login') ||
              target.closest('[class*="google"]') ||
              target.textContent?.includes('Google') ||
              target.textContent?.includes('구글')) &&
              !target.closest('[data-google-login="react-handler"]')) { // React 핸들러 제외
            
            console.log('Google login button clicked');
            event.preventDefault();
            event.stopPropagation();
            
            // iOS 앱에 구글 로그인 요청
            try {
              if (window.webkit.messageHandlers.googleLogin) {
                window.webkit.messageHandlers.googleLogin.postMessage({
                  action: 'startLogin',
                  source: 'button_click'
                });
              }
            } catch (e) {
              console.error('Failed to trigger native Google login:', e);
              // 폴백: 일반 로그인 페이지로 이동
              window.location.href = '/signin';
            }
          }
        }, true);
        
        // 구글 로그인 성공 콜백 함수 등록
        window.handleGoogleLoginSuccess = function(userData) {
          console.log('Google login success received from iOS:', userData);
          
          // 로그인 성공 처리
          if (userData && userData.token) {
            // 토큰을 localStorage에 저장
            localStorage.setItem('authToken', userData.token);
            
            // 사용자 정보 저장
            if (userData.user) {
              localStorage.setItem('userData', JSON.stringify(userData.user));
            }
            
            // 홈 페이지로 리다이렉트
            window.location.href = '/home';
          }
        };
        
        // 구글 로그인 실패 콜백 함수 등록
        window.handleGoogleLoginError = function(error) {
          console.error('Google login error received from iOS:', error);
          
          // 에러 메시지 표시
          alert('구글 로그인에 실패했습니다. 다시 시도해주세요.');
        };
      }
    }
    
    // 10. User-Agent 수정으로 구글 로그인 우회 시도
    function modifyUserAgentForGoogle() {
      // 구글 로그인 페이지에서만 User-Agent 수정
      if (window.location.href.includes('accounts.google.com') || 
          window.location.href.includes('oauth2')) {
        
        console.log('Modifying User-Agent for Google OAuth');
        
        // User-Agent를 Safari로 변경하는 스크립트 삽입
        const script = document.createElement('script');
        script.textContent = `
          Object.defineProperty(navigator, 'userAgent', {
            get: function() {
              return 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
            },
            configurable: true
          });
        `;
        document.head.appendChild(script);
      }
    }
    
    // 페이지 로드 시 User-Agent 수정 실행
    modifyUserAgentForGoogle();
    
    // 11. iOS WebView 라우팅 문제 해결
    function fixIOSWebViewRouting() {
      console.log('Fixing iOS WebView routing issues...');
      
      if (window.webkit && window.webkit.messageHandlers) {
        // Next.js 라우터 에러 처리
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(state, title, url) {
          try {
            console.log('History pushState:', url);
            return originalPushState.call(history, state, title, url);
          } catch (error) {
            console.warn('History pushState error (ignored):', error);
            // 에러 무시하고 현재 페이지 유지
          }
        };
        
        history.replaceState = function(state, title, url) {
          try {
            console.log('History replaceState:', url);
            return originalReplaceState.call(history, state, title, url);
          } catch (error) {
            console.warn('History replaceState error (ignored):', error);
            // 에러 무시하고 현재 페이지 유지
          }
        };
        
        // popstate 이벤트 처리
        window.addEventListener('popstate', function(event) {
          console.log('Popstate event:', event.state);
          try {
            // iOS WebView에서 안전한 네비게이션 처리
            if (event.state && event.state.url) {
              window.location.href = event.state.url;
            }
          } catch (error) {
            console.warn('Popstate handling error (ignored):', error);
          }
        });
        
        // Next.js 라우터 이벤트 가로채기
        if (typeof window !== 'undefined') {
          // 라우터 변경 감지
          let lastUrl = window.location.href;
          const observer = new MutationObserver(function() {
            if (window.location.href !== lastUrl) {
              console.log('URL changed from', lastUrl, 'to', window.location.href);
              lastUrl = window.location.href;
              
              // iOS 앱에 라우터 변경 알림
              try {
                if (window.webkit.messageHandlers.routeChanged) {
                  window.webkit.messageHandlers.routeChanged.postMessage({
                    url: window.location.href,
                    pathname: window.location.pathname
                  });
                }
              } catch (e) {
                console.warn('Failed to notify iOS app of route change:', e);
              }
            }
          });
          
          observer.observe(document, { subtree: true, childList: true });
        }
      }
    }
    
    // 12. iOS WebView 모듈 로딩 문제 해결
    function fixIOSWebViewModuleLoading() {
      console.log('Fixing iOS WebView module loading...');
      
      // 동적 import 에러 처리
      const originalImport = window.import || function() {};
      window.import = function(module) {
        try {
          return originalImport.call(this, module);
        } catch (error) {
          console.warn('Dynamic import error (ignored):', error);
          return Promise.resolve({});
        }
      };
      
      // require 함수 폴백
      if (typeof window.require === 'undefined') {
        window.require = function(module) {
          console.warn('Require called for:', module);
          return {};
        };
      }
      
      // AMD 모듈 로더 폴백
      if (typeof window.define === 'undefined') {
        window.define = function(deps, factory) {
          console.warn('AMD define called');
          if (typeof factory === 'function') {
            try {
              return factory();
            } catch (e) {
              console.warn('AMD factory error:', e);
              return {};
            }
          }
          return {};
        };
        window.define.amd = true;
      }
    }
    
    // iOS WebView 수정 함수들 실행
    fixIOSWebViewRouting();
    fixIOSWebViewModuleLoading();
    
    // 6. iOS WebView에서 터치 이벤트 최적화
    document.addEventListener('touchstart', function() {}, { passive: true });
    document.addEventListener('touchmove', function() {}, { passive: true });
    
    // 7. 메모리 관리 최적화
    window.addEventListener('pagehide', function() {
      // 페이지 숨김 시 리소스 정리
      console.log('Page hidden, cleaning up resources...');
    });
    
    // 8. iOS 앱과의 통신 개선
    function notifyIOSApp(message, data = {}) {
      try {
        if (window.webkit.messageHandlers.jsToNative) {
          window.webkit.messageHandlers.jsToNative.postMessage({
            type: message,
            data: data,
            timestamp: Date.now()
          });
        }
      } catch (e) {
        console.warn('Could not notify iOS app:', e);
      }
    }
    
    // 페이지 로드 상태 알림
    window.addEventListener('load', function() {
      notifyIOSApp('pageLoaded', { url: window.location.href });
    });
    
    // 에러 발생 시 iOS 앱에 알림
    window.addEventListener('error', function(event) {
      notifyIOSApp('jsError', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    // 13. 프로덕션 환경용 강제 햅틱 함수 추가
    if (window.location.hostname.includes('.aiagnt.kr')) {
      console.log('[iOS WebView] 프로덕션 환경 - 강제 햅틱 함수 설정');
      
      // 강제 햅틱 실행 함수
      window.SMAP_FORCE_HAPTIC = function(hapticType) {
        console.log(`🚀 [FORCE-HAPTIC] 프로덕션 강제 햅틱 실행: ${hapticType}`);
        
        // iOS 네이티브 햅틱 시도
        try {
          if (window.webkit && window.webkit.messageHandlers) {
            const possibleHandlers = ['smapIos', 'iosHandler', 'nativeHandler', 'jsToNative'];
            
            for (const handlerName of possibleHandlers) {
              if (window.webkit.messageHandlers[handlerName]) {
                try {
                  // 다양한 메시지 형식으로 시도
                  const messageFormats = [
                    { type: 'haptic', param: hapticType },
                    { type: 'hapticFeedback', param: JSON.stringify({ feedbackType: hapticType }) },
                    hapticType
                  ];
                  
                  for (const message of messageFormats) {
                    try {
                      window.webkit.messageHandlers[handlerName].postMessage(message);
                      console.log(`✅ [FORCE-HAPTIC] ${handlerName} 성공: ${hapticType} | 형식: ${typeof message === 'string' ? '직접' : message.type}`);
                      return true;
                    } catch (formatError) {
                      console.warn(`⚠️ [FORCE-HAPTIC] ${handlerName} 형식 실패:`, formatError);
                      continue;
                    }
                  }
                } catch (e) {
                  console.warn(`⚠️ [FORCE-HAPTIC] ${handlerName} 실패:`, e);
                  continue;
                }
              }
            }
          }
          
          // 웹 바이브레이션 대체
          if ('vibrate' in navigator) {
            const vibrationPattern = hapticType === 'heavy' ? 100 : hapticType === 'medium' ? 50 : 25;
            navigator.vibrate(vibrationPattern);
            console.log(`📳 [FORCE-HAPTIC] 웹 바이브레이션 대체: ${vibrationPattern}ms`);
            return true;
          }
          
          return false;
        } catch (error) {
          console.error(`❌ [FORCE-HAPTIC] 에러:`, error);
          return false;
        }
      };
      
      // 핸들러 상태 확인 함수
      window.SMAP_CHECK_HANDLERS = function() {
        const webkit = window.webkit;
        const result = {
          hasWebKit: !!webkit,
          hasMessageHandlers: !!(webkit && webkit.messageHandlers),
          hasSmapIos: !!(webkit && webkit.messageHandlers && webkit.messageHandlers.smapIos),
          availableHandlers: []
        };
        
        if (webkit && webkit.messageHandlers) {
          const knownHandlers = ['smapIos', 'iosHandler', 'nativeHandler', 'jsToNative'];
          knownHandlers.forEach(handler => {
            if (webkit.messageHandlers[handler]) {
              result.availableHandlers.push(handler);
            }
          });
        }
        
        // console.log(`🔍 [HANDLER-CHECK] 핸들러 상태:`, result);
        return result;
      };
      
      // 주기적 핸들러 상태 체크 (프로덕션에서만, 10초마다)
      setInterval(() => {
        window.SMAP_CHECK_HANDLERS();
      }, 10000);
    }

    // 14. iOS 웹뷰 고정 요소 (헤더/네비게이션) 최적화
    function enforceFixedElements() {
      console.log('[iOS WebView] 고정 요소 (헤더/네비게이션) 최적화...');
      
      // CSS 고정 요소 최적화 스타일 추가
      const fixedElementStyle = document.createElement('style');
      fixedElementStyle.id = 'ios-fixed-element-style';
      if (!document.getElementById('ios-fixed-element-style')) {
        fixedElementStyle.textContent = `
          /* iOS 웹뷰 헤더 고정 보장 (notice, setting 페이지 제외) */
          .header-fixed:not([data-page="/notice"]):not([data-page="/setting"]), 
          header[class*="fixed"]:not([data-page="/notice"]):not([data-page="/setting"]) {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 9999 !important;
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            transform: translateZ(0) !important;
            -webkit-transform: translateZ(0) !important;
            will-change: transform !important;
            -webkit-perspective: 1000 !important;
            -webkit-backface-visibility: hidden !important;
          }
          
          /* iOS 웹뷰 네비게이션 고정 보장 */
          .navigation-fixed, nav[class*="fixed"], nav[class*="bottom"] {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 9999 !important;
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            transform: translateZ(0) !important;
            -webkit-transform: translateZ(0) !important;
            will-change: transform !important;
            -webkit-perspective: 1000 !important;
            -webkit-backface-visibility: hidden !important;
          }
          
          /* iOS Safe Area 대응 */
          @supports (padding: max(0px)) {
            .header-fixed, header[class*="fixed"] {
              padding-top: max(16px, env(safe-area-inset-top)) !important;
            }
            
            .navigation-fixed, nav[class*="fixed"], nav[class*="bottom"] {
              padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
            }
          }
          
          /* 모든 고정 요소에 대한 iOS 최적화 */
          .fixed, [style*="position: fixed"], [style*="position:fixed"] {
            transform: translateZ(0) !important;
            -webkit-transform: translateZ(0) !important;
            will-change: transform !important;
            -webkit-perspective: 1000 !important;
            -webkit-backface-visibility: hidden !important;
          }
        `;
        document.head.appendChild(fixedElementStyle);
      }
      
      // 헤더 요소 강제 고정 (setting, notice 페이지 제외)
      function fixHeaders() {
        // setting, notice 페이지에서는 헤더 강제 고정하지 않음
        if (window.location.pathname.startsWith('/setting') || window.location.pathname.startsWith('/notice')) {
          return;
        }
        
        const headerSelectors = [
          'header', 
          '.header-fixed', 
          '[class*="header"]',
          'motion.header',
          '[data-framer-component*="header"]'
        ];
        
        headerSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(header => {
            if (header.offsetTop <= 100) { // 상단 근처 요소만
              header.style.position = 'fixed';
              header.style.top = '0';
              header.style.left = '0';
              header.style.right = '0';
              header.style.zIndex = '9999';
              header.style.background = 'rgba(255, 255, 255, 0.95)';
              header.style.backdropFilter = 'blur(20px)';
              header.style.webkitBackdropFilter = 'blur(20px)';
              header.style.transform = 'translateZ(0)';
              header.style.webkitTransform = 'translateZ(0)';
              header.style.willChange = 'transform';
              header.style.webkitPerspective = '1000';
              header.style.webkitBackfaceVisibility = 'hidden';
            }
          });
        });
      }
      
      // 네비게이션 요소 강제 고정 (location, setting 페이지 제외)
      function fixNavigations() {
        const navSelectors = [
          'nav', 
          '.navigation-fixed', 
          '[class*="navigation"]',
          '[class*="bottom-nav"]',
          '[class*="BottomNavigation"]'
        ];
        
        navSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(nav => {
            // location, setting 페이지에서는 네비게이션 바 위치 조정하지 않음
            if (window.location.pathname === '/location' || window.location.pathname.startsWith('/setting')) {
              return;
            }
            
            // 하단 네비게이션으로 보이는 요소들만
            const rect = nav.getBoundingClientRect();
            const isBottomNav = rect.bottom >= window.innerHeight - 100 || 
                              nav.style.bottom === '0' || 
                              nav.className.includes('bottom') ||
                              nav.className.includes('navigation');
            
            if (isBottomNav) {
              nav.style.position = 'fixed';
              nav.style.bottom = '0';
              nav.style.left = '0';
              nav.style.right = '0';
              nav.style.zIndex = '9999';
              nav.style.background = 'rgba(255, 255, 255, 0.95)';
              nav.style.backdropFilter = 'blur(20px)';
              nav.style.webkitBackdropFilter = 'blur(20px)';
              nav.style.transform = 'translateZ(0)';
              nav.style.webkitTransform = 'translateZ(0)';
              nav.style.willChange = 'transform';
              nav.style.webkitPerspective = '1000';
              nav.style.webkitBackfaceVisibility = 'hidden';
            }
          });
        });
      }
      
      // 초기 적용
      fixHeaders();
      fixNavigations();
      
      // DOM 변화 감지하여 재적용
      const observer = new MutationObserver((mutations) => {
        let shouldReapply = false;
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) { // Element node
                const tagName = node.tagName?.toLowerCase();
                const className = typeof node.className === 'string' ? node.className : (node.className?.toString() || '');
                if (tagName === 'header' || tagName === 'nav' || 
                    className.includes('header') || 
                    className.includes('navigation')) {
                  shouldReapply = true;
                  break;
                }
              }
            }
          }
        });
        
        if (shouldReapply) {
          setTimeout(() => {
            fixHeaders();
            fixNavigations();
          }, 100);
        }
      });
      
      // 감지 시작
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
      
      // 주기적 체크 (안전장치)
      setInterval(() => {
        fixHeaders();
        fixNavigations();
      }, 5000);
    }
    
    // DOM 준비되면 고정 요소 최적화 시작
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', enforceFixedElements);
    } else {
      enforceFixedElements();
    }
    
    // 페이지 로드 완료 후에도 다시 한 번
    window.addEventListener('load', enforceFixedElements);
    
    // 방향 변경 시 재적용
    window.addEventListener('orientationchange', () => {
      setTimeout(enforceFixedElements, 300);
    });

    console.log('iOS WebView fixes applied successfully');
  }
})();

 