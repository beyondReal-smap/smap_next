// 도메인별 지도 로딩 문제 진단 스크립트
// nextstep.smap.site vs localhost:3000 차이점 분석

(function() {
    'use strict';
    
    console.log('🔍 [DOMAIN DEBUG] 지도 로딩 진단 시작');
    
    // 1. 현재 도메인 정보 확인
    const currentDomain = window.location.hostname;
    const currentProtocol = window.location.protocol;
    const currentPort = window.location.port;
    const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
    const isProduction = currentDomain.includes('smap.site');
    
    console.log('🌐 [DOMAIN DEBUG] 현재 환경:', {
        domain: currentDomain,
        protocol: currentProtocol,
        port: currentPort,
        isLocalhost,
        isProduction,
        fullURL: window.location.href
    });
    
    // 2. 네이버 지도 API 키 및 URL 확인
    function checkNaverMapsAPI() {
        console.log('🗺️ [NAVER MAPS] API 설정 확인');
        
        // 네이버 지도 스크립트 태그 찾기
        const naverScripts = Array.from(document.querySelectorAll('script')).filter(script => 
            script.src && script.src.includes('oapi.map.naver.com')
        );
        
        naverScripts.forEach((script, index) => {
            console.log(`📜 [NAVER SCRIPT ${index + 1}]`, {
                src: script.src,
                loaded: script.readyState || 'unknown',
                hasError: script.onerror !== null
            });
            
            // URL 파라미터 분석
            try {
                const url = new URL(script.src);
                const params = Object.fromEntries(url.searchParams);
                console.log(`🔧 [NAVER PARAMS ${index + 1}]`, params);
            } catch (e) {
                console.error(`❌ [NAVER URL PARSE ERROR ${index + 1}]`, e);
            }
        });
        
        // 네이버 지도 객체 확인
        if (window.naver && window.naver.maps) {
            console.log('✅ [NAVER MAPS] 객체 로드됨');
        } else {
            console.log('❌ [NAVER MAPS] 객체 로드되지 않음');
        }
    }
    
    // 3. 구글 지도 API 확인
    function checkGoogleMapsAPI() {
        console.log('🌍 [GOOGLE MAPS] API 설정 확인');
        
        const googleScripts = Array.from(document.querySelectorAll('script')).filter(script => 
            script.src && script.src.includes('maps.googleapis.com')
        );
        
        googleScripts.forEach((script, index) => {
            console.log(`📜 [GOOGLE SCRIPT ${index + 1}]`, {
                src: script.src,
                loaded: script.readyState || 'unknown'
            });
        });
        
        if (window.google && window.google.maps) {
            console.log('✅ [GOOGLE MAPS] 객체 로드됨');
        } else {
            console.log('❌ [GOOGLE MAPS] 객체 로드되지 않음');
        }
    }
    
    // 4. 네트워크 요청 모니터링
    function monitorNetworkRequests() {
        console.log('🌐 [NETWORK] 요청 모니터링 시작');
        
        // XMLHttpRequest 래핑
        const originalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            const originalOpen = xhr.open;
            
            xhr.open = function(method, url, ...args) {
                if (url.includes('map.naver.com') || url.includes('googleapis.com')) {
                    console.log(`🌐 [XHR REQUEST] ${method} ${url}`);
                    
                    xhr.addEventListener('load', () => {
                        console.log(`✅ [XHR SUCCESS] ${method} ${url} - Status: ${xhr.status}`);
                    });
                    
                    xhr.addEventListener('error', () => {
                        console.error(`❌ [XHR ERROR] ${method} ${url} - Status: ${xhr.status}`);
                    });
                }
                
                return originalOpen.apply(this, [method, url, ...args]);
            };
            
            return xhr;
        };
        
        // Fetch API 래핑
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            if (typeof url === 'string' && (url.includes('map.naver.com') || url.includes('googleapis.com'))) {
                console.log(`🌐 [FETCH REQUEST]`, { url, options });
                
                return originalFetch(url, options)
                    .then(response => {
                        console.log(`✅ [FETCH SUCCESS]`, { url, status: response.status, ok: response.ok });
                        return response;
                    })
                    .catch(error => {
                        console.error(`❌ [FETCH ERROR]`, { url, error });
                        throw error;
                    });
            }
            
            return originalFetch(url, options);
        };
    }
    
    // 5. CORS 및 보안 헤더 확인
    function checkSecurityHeaders() {
        console.log('🔒 [SECURITY] 보안 헤더 확인');
        
        // Content Security Policy 확인
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (cspMeta) {
            console.log('🛡️ [CSP]', cspMeta.content);
        } else {
            console.log('ℹ️ [CSP] Content Security Policy 메타 태그 없음');
        }
        
        // X-Frame-Options 확인 (일반적으로 개발자 도구에서 확인)
        if (isProduction) {
            fetch(window.location.href, { method: 'HEAD' })
                .then(response => {
                    console.log('🔒 [RESPONSE HEADERS]', {
                        'content-security-policy': response.headers.get('content-security-policy'),
                        'x-frame-options': response.headers.get('x-frame-options'),
                        'strict-transport-security': response.headers.get('strict-transport-security')
                    });
                })
                .catch(error => {
                    console.error('❌ [HEADERS CHECK ERROR]', error);
                });
        }
    }
    
    // 6. JavaScript 오류 모니터링
    function monitorJavaScriptErrors() {
        console.log('🐛 [ERROR MONITOR] JavaScript 오류 감지 시작');
        
        window.addEventListener('error', function(event) {
            if (event.filename && (event.filename.includes('map.naver.com') || event.filename.includes('googleapis.com'))) {
                console.error('❌ [MAP SCRIPT ERROR]', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error
                });
            }
        });
        
        // Unhandled Promise rejection 감지
        window.addEventListener('unhandledrejection', function(event) {
            if (event.reason && typeof event.reason === 'string' && 
                (event.reason.includes('naver') || event.reason.includes('google'))) {
                console.error('❌ [MAP PROMISE ERROR]', event.reason);
            }
        });
    }
    
    // 7. 로컬스토리지 및 쿠키 확인
    function checkStorageAndCookies() {
        console.log('💾 [STORAGE] 저장소 상태 확인');
        
        try {
            // 로컬스토리지 테스트
            localStorage.setItem('test', 'value');
            localStorage.removeItem('test');
            console.log('✅ [STORAGE] localStorage 사용 가능');
        } catch (e) {
            console.error('❌ [STORAGE] localStorage 사용 불가:', e);
        }
        
        try {
            // 세션스토리지 테스트
            sessionStorage.setItem('test', 'value');
            sessionStorage.removeItem('test');
            console.log('✅ [STORAGE] sessionStorage 사용 가능');
        } catch (e) {
            console.error('❌ [STORAGE] sessionStorage 사용 불가:', e);
        }
        
        // 쿠키 확인
        console.log('🍪 [COOKIES]', document.cookie ? '사용 가능' : '없음');
    }
    
    // 8. 환경별 차이점 분석
    function analyzeEnvironmentDifferences() {
        console.log('🔍 [ENVIRONMENT] 환경별 차이점 분석');
        
        const userAgent = navigator.userAgent;
        const isWebView = /wv/.test(userAgent);
        const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
        
        console.log('📱 [USER AGENT]', {
            userAgent,
            isWebView,
            isMobile,
            platform: navigator.platform,
            language: navigator.language,
            onLine: navigator.onLine
        });
        
        // 권한 상태 확인
        if (navigator.permissions) {
            ['geolocation', 'notifications'].forEach(permission => {
                navigator.permissions.query({ name: permission })
                    .then(result => {
                        console.log(`🔐 [PERMISSION ${permission.toUpperCase()}]`, result.state);
                    })
                    .catch(e => {
                        console.log(`ℹ️ [PERMISSION ${permission.toUpperCase()}]`, '확인 불가');
                    });
            });
        }
    }
    
    // 9. 지도 컨테이너 확인
    function checkMapContainers() {
        console.log('🗺️ [MAP CONTAINERS] 지도 컨테이너 상태 확인');
        
        const naverContainer = document.querySelector('[id*="naver"], [id*="map"][class*="naver"]');
        const googleContainer = document.querySelector('[id*="google"], [id*="map"][class*="google"]');
        const mapContainers = document.querySelectorAll('[id*="map"]');
        
        console.log('📦 [MAP CONTAINERS]', {
            totalMapContainers: mapContainers.length,
            naverContainer: naverContainer ? '발견됨' : '없음',
            googleContainer: googleContainer ? '발견됨' : '없음'
        });
        
        mapContainers.forEach((container, index) => {
            console.log(`📦 [CONTAINER ${index + 1}]`, {
                id: container.id,
                className: container.className,
                style: container.style.cssText,
                offsetWidth: container.offsetWidth,
                offsetHeight: container.offsetHeight,
                hasChildren: container.children.length > 0
            });
        });
    }
    
    // 전체 진단 실행
    function runFullDiagnosis() {
        console.log('🚀 [DIAGNOSIS] 전체 진단 시작');
        
        monitorNetworkRequests();
        monitorJavaScriptErrors();
        
        // DOM 로드 완료 후 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(() => {
                    checkNaverMapsAPI();
                    checkGoogleMapsAPI();
                    checkSecurityHeaders();
                    checkStorageAndCookies();
                    analyzeEnvironmentDifferences();
                    checkMapContainers();
                }, 1000);
            });
        } else {
            setTimeout(() => {
                checkNaverMapsAPI();
                checkGoogleMapsAPI();
                checkSecurityHeaders();
                checkStorageAndCookies();
                analyzeEnvironmentDifferences();
                checkMapContainers();
            }, 1000);
        }
        
        // 5초 후 재확인
        setTimeout(() => {
            console.log('🔄 [DIAGNOSIS] 5초 후 재확인');
            checkNaverMapsAPI();
            checkGoogleMapsAPI();
            checkMapContainers();
        }, 5000);
    }
    
    // 진단 시작
    runFullDiagnosis();
    
    // 전역 함수로 등록 (개발자 도구에서 수동 실행 가능)
    window.runMapDiagnosis = runFullDiagnosis;
    
})(); 