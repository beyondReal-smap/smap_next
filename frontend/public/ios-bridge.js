// iOS-Next.js Bridge (완전 강화된 버전)
// iOS 웹뷰와 Next.js 애플리케이션 간의 통신 인터페이스

console.log('🌉 [iOS Bridge] 완전 강화된 초기화 시작');
console.log('🌉 [iOS Bridge] 현재 URL:', window.location.href);
console.log('🌉 [iOS Bridge] User Agent:', navigator.userAgent);

// 🔧 WebKit MessageHandler 환경 감지 및 강제 초기화 (대폭 강화)
(function initializeWebKitHandlers() {
    const currentURL = window.location.href;
    const isIOSWebView = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isProduction = window.location.hostname === 'nextstep.smap.site';
    const isSimulator = /Simulator/.test(navigator.userAgent);
    const isDevelopment = isLocalhost || !isProduction;
    
    // 🚨 IPC 과부하 방지 - 로그 출력 제한
    const debugLog = (message, data) => {
        if (isDevelopment) {
            if (data) {
                console.log(message, data);
            } else {
                console.log(message);
            }
        }
    };
    
    // 🚨 메시지 전송 빈도 제한 (Throttling)
    const messageThrottle = {
        lastSent: {},
        interval: 100, // 100ms 간격으로 제한
        
        canSend(messageType) {
            const now = Date.now();
            const lastTime = this.lastSent[messageType] || 0;
            
            if (now - lastTime > this.interval) {
                this.lastSent[messageType] = now;
                return true;
            }
            return false;
        }
    };
    
    debugLog('🔍 [iOS Bridge] 완전 강화된 환경 감지:', {
        isIOSWebView,
        isLocalhost,
        isProduction,
        isSimulator,
        currentURL,
        hostname: window.location.hostname,
        hasWebKit: !!window.webkit,
        hasMessageHandlers: !!(window.webkit?.messageHandlers),
        availableHandlers: window.webkit?.messageHandlers ? 
            Object.keys(window.webkit.messageHandlers) : [],
        userAgent: navigator.userAgent.substring(0, 100)
    });
    
    // 🚨 모든 iOS 환경에서 webkit 강제 초기화
    if (isIOSWebView) {
        if (!window.webkit) {
            console.warn('⚠️ [iOS Bridge] iOS 환경인데 webkit 없음 - 강제 객체 생성');
            window.webkit = {
                messageHandlers: {}
            };
        }
        
        // messageHandlers가 없다면 빈 객체로 초기화
        if (window.webkit && !window.webkit.messageHandlers) {
            console.warn('⚠️ [iOS Bridge] messageHandlers 없음 - 강제 객체 생성');
            window.webkit.messageHandlers = {};
        }
        
        // 필수 핸들러들이 없다면 완전한 가짜 핸들러 등록
        if (window.webkit && window.webkit.messageHandlers) {
            const requiredHandlers = ['smapIos', 'iosHandler'];
            
            requiredHandlers.forEach(handlerName => {
                if (!window.webkit.messageHandlers[handlerName]) {
                    console.warn(`⚠️ [iOS Bridge] ${handlerName} 핸들러 없음 - 완전한 가짜 핸들러 생성`);
                    window.webkit.messageHandlers[handlerName] = {
                        postMessage: function(message) {
                            // 🚨 메시지 전송 빈도 제한
                            if (!messageThrottle.canSend(handlerName)) {
                                return; // 너무 빈번한 메시지는 무시
                            }
                            
                            debugLog(`📤 [${handlerName}] 메시지 (가짜 핸들러):`, message);
                            
                            // 햅틱 메시지인 경우 특별 처리
                            if (message && (message.type === 'hapticFeedback' || message.action === 'hapticFeedback')) {
                                debugLog('🎮 [iOS Bridge] 햅틱 메시지 감지 - 특별 처리 시도');
                                
                                // 햅틱 관련 처리는 유지하지만 로그 줄임
                                try {
                                    if (window.navigator && window.navigator.vibrate) {
                                        window.navigator.vibrate([100, 50, 100]);
                                    }
                                    
                                    if (window.triggerHapticFeedback) {
                                        window.triggerHapticFeedback('medium');
                                    }
                                    
                                } catch (error) {
                                    if (isDevelopment) {
                                        console.error('🎮 [iOS Bridge] 햅틱 처리 실패:', error);
                                    }
                                }
                            }
                            
                            // CustomEvent로 네이티브에 알림 시도 (빈도 제한 적용)
                            window.dispatchEvent(new CustomEvent('smap-ios-message', {
                                detail: { handler: handlerName, message: message }
                            }));
                        }
                    };
                }
            });
        }
        
        // 강제 환경 플래그 설정
        window.__SMAP_IOS_ENVIRONMENT__ = {
            isWebView: true,
            hasHandlers: true,
            isSimulator: isSimulator,
            isLocalhost: isLocalhost,
            isProduction: isProduction,
            timestamp: Date.now()
        };
        
        debugLog('✅ [iOS Bridge] iOS 환경 강제 설정 완료:', window.__SMAP_IOS_ENVIRONMENT__);
    }
})();

window.SmapApp = {
    // iOS 네이티브 앱으로 메시지 전송 (강화된 버전)
    sendMessage: function(action, data = {}) {
        const hasIOSHandler = window.webkit?.messageHandlers?.iosHandler;
        const hasSmapIos = window.webkit?.messageHandlers?.smapIos;
        
        console.log('📤 [iOS Bridge] 메시지 전송 시도:', {
            action,
            data,
            hasIOSHandler,
            hasSmapIos,
            url: window.location.href
        });
        
        // smapIos 핸들러 우선 사용
        if (hasSmapIos) {
            try {
                window.webkit.messageHandlers.smapIos.postMessage({
                    type: action,
                    param: data,
                    timestamp: Date.now(),
                    url: window.location.href
                });
                console.log(`✅ [iOS Bridge] smapIos로 메시지 전송 성공: ${action}`);
                return true;
            } catch (error) {
                console.error(`❌ [iOS Bridge] smapIos 메시지 전송 실패: ${action}`, error);
            }
        }
        
        // iosHandler 백업 사용
        if (hasIOSHandler) {
            try {
                window.webkit.messageHandlers.iosHandler.postMessage({
                    action: action,
                    timestamp: Date.now(),
                    url: window.location.href,
                    ...data
                });
                console.log(`✅ [iOS Bridge] iosHandler로 메시지 전송 성공: ${action}`);
                return true;
            } catch (error) {
                console.error(`❌ [iOS Bridge] iosHandler 메시지 전송 실패: ${action}`, error);
            }
        }
        
        console.warn('⚠️ [iOS Bridge] iOS 네이티브 앱 연결이 없습니다.');
        console.warn('⚠️ [iOS Bridge] 사용 가능한 핸들러:', window.webkit?.messageHandlers ? Object.keys(window.webkit.messageHandlers) : 'none');
        
        return false;
    },

    // 디바이스 정보 확인
    isIOSApp: function() {
        return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosHandler);
    },

    // 네이티브 기능들
    notification: {
        // 알림 권한 요청
        requestPermission: function() {
            window.SmapApp.sendMessage('requestNotificationPermission');
        }
    },

    share: {
        // 콘텐츠 공유
        content: function(text, url = '') {
            const shareData = { content: text };
            if (url) shareData.url = url;
            window.SmapApp.sendMessage('shareContent', shareData);
        }
    },

    browser: {
        // 외부 URL 열기
        openURL: function(url) {
            window.SmapApp.sendMessage('openExternalURL', { url: url });
        }
    },

    feedback: {
        // 햅틱 피드백 (강화된 버전)
        impact: function(style = 'medium') {
            console.log('🎮 [SmapApp.feedback.impact] 햅틱 피드백 요청:', style);
            
            // 방법 1: 기본 메시지 전송
            const success1 = window.SmapApp.sendMessage('hapticFeedback', { style: style });
            
            // 방법 2: 백업 직접 webkit 호출
            try {
                if (window.webkit?.messageHandlers?.smapIos) {
                    window.webkit.messageHandlers.smapIos.postMessage({
                        type: 'hapticFeedback',
                        param: { style: style },
                        timestamp: Date.now()
                    });
                    console.log('🎮 [SmapApp.feedback.impact] 직접 webkit 호출 성공');
                }
            } catch (error) {
                console.warn('🎮 [SmapApp.feedback.impact] 직접 webkit 호출 실패:', error);
            }
            
            // 방법 3: navigator.vibrate 백업
            try {
                if (navigator.vibrate) {
                    const patterns = {
                        light: 50,
                        medium: 100,
                        heavy: 200,
                        success: [100, 50, 100],
                        warning: [50, 50, 50, 50, 50],
                        error: [200, 100, 200]
                    };
                    navigator.vibrate(patterns[style] || 100);
                    console.log('🎮 [SmapApp.feedback.impact] navigator.vibrate 백업 성공');
                }
            } catch (error) {
                console.warn('🎮 [SmapApp.feedback.impact] navigator.vibrate 백업 실패:', error);
            }
            
            // 방법 4: CustomEvent 발송
            window.dispatchEvent(new CustomEvent('smap-haptic-request', {
                detail: { style: style, source: 'SmapApp.feedback.impact' }
            }));
            
            // 명확한 로그 출력
            console.log('🎮🎮🎮 [HAPTIC FEEDBACK] SmapApp.feedback.impact 실행:', {
                style: style,
                timestamp: new Date().toISOString(),
                success: success1,
                url: window.location.href
            });
            
            return success1;
        }
    },

    device: {
        // 디바이스 정보 요청
        getInfo: function() {
            window.SmapApp.sendMessage('getDeviceInfo');
        }
    },

    ui: {
        // 토스트 메시지 표시
        showToast: function(message) {
            window.SmapApp.sendMessage('showToast', { message: message });
        }
    },

    // 🆕 사용자 정보 전송 (프론트엔드 → iOS)
    user: {
        // 로그인된 사용자 정보를 iOS로 전송
        sendUserInfo: function(userInfo) {
            console.log('👤 [iOS Bridge] 사용자 정보 iOS로 전송:', userInfo);
            
            const userData = {
                mt_idx: userInfo.mt_idx,
                mt_id: userInfo.mt_id,
                mt_name: userInfo.mt_name,
                mt_email: userInfo.mt_email,
                isLoggedIn: true,
                timestamp: Date.now()
            };
            
            window.SmapApp.sendMessage('userInfo', userData);
            
            // 💾 로컬스토리지에도 저장 (iOS에서 필요시 접근)
            try {
                localStorage.setItem('smap_user_info', JSON.stringify(userData));
                console.log('👤 [iOS Bridge] 사용자 정보 로컬스토리지 저장 완료');
            } catch (error) {
                console.error('👤 [iOS Bridge] 로컬스토리지 저장 실패:', error);
            }
        },

        // 로그아웃 시 사용자 정보 제거
        clearUserInfo: function() {
            console.log('👤 [iOS Bridge] 사용자 정보 제거');
            
            window.SmapApp.sendMessage('userLogout', {
                isLoggedIn: false,
                timestamp: Date.now()
            });
            
            try {
                localStorage.removeItem('smap_user_info');
                console.log('👤 [iOS Bridge] 로컬스토리지 사용자 정보 제거 완료');
            } catch (error) {
                console.error('👤 [iOS Bridge] 로컬스토리지 제거 실패:', error);
            }
        },

        // iOS에서 사용자 정보 요청 시 응답
        getUserInfo: function() {
            try {
                const userInfo = localStorage.getItem('smap_user_info');
                if (userInfo) {
                    const parsedInfo = JSON.parse(userInfo);
                    console.log('👤 [iOS Bridge] 저장된 사용자 정보 반환:', parsedInfo);
                    return parsedInfo;
                }
            } catch (error) {
                console.error('👤 [iOS Bridge] 사용자 정보 조회 실패:', error);
            }
            
            console.log('👤 [iOS Bridge] 저장된 사용자 정보 없음');
            return null;
        },

        // 🆕 자동으로 사용자 정보 확인 및 전송
        checkAndSendUserInfo: function() {
            console.log('👤 [iOS Bridge] 자동 사용자 정보 확인 시작');
            
            try {
                // 1. 로컬스토리지에서 사용자 정보 확인
                const storedUserInfo = localStorage.getItem('smap_user_info');
                if (storedUserInfo) {
                    const userInfo = JSON.parse(storedUserInfo);
                    console.log('👤 [iOS Bridge] 로컬스토리지에서 사용자 정보 발견:', userInfo);
                    this.sendUserInfo(userInfo);
                    return;
                }
                
                // 2. 전역 변수에서 사용자 정보 확인
                if (window.currentUser) {
                    console.log('👤 [iOS Bridge] 전역 변수에서 사용자 정보 발견:', window.currentUser);
                    this.sendUserInfo(window.currentUser);
                    return;
                }
                
                // 3. Auth 컨텍스트에서 사용자 정보 확인 (Next.js)
                if (window.authContext && window.authContext.user) {
                    console.log('👤 [iOS Bridge] Auth 컨텍스트에서 사용자 정보 발견:', window.authContext.user);
                    this.sendUserInfo(window.authContext.user);
                    return;
                }
                
                // 4. 쿠키에서 사용자 정보 확인
                const userCookie = this.getCookie('user_info');
                if (userCookie) {
                    try {
                        const userInfo = JSON.parse(decodeURIComponent(userCookie));
                        console.log('👤 [iOS Bridge] 쿠키에서 사용자 정보 발견:', userInfo);
                        this.sendUserInfo(userInfo);
                        return;
                    } catch (e) {
                        console.error('👤 [iOS Bridge] 쿠키 파싱 실패:', e);
                    }
                }
                
                // 5. 세션스토리지에서 사용자 정보 확인
                const sessionUserInfo = sessionStorage.getItem('user_info') || sessionStorage.getItem('smap_user');
                if (sessionUserInfo) {
                    try {
                        const userInfo = JSON.parse(sessionUserInfo);
                        console.log('👤 [iOS Bridge] 세션스토리지에서 사용자 정보 발견:', userInfo);
                        this.sendUserInfo(userInfo);
                        return;
                    } catch (e) {
                        console.error('👤 [iOS Bridge] 세션스토리지 파싱 실패:', e);
                    }
                }
                
                console.log('⚠️ [iOS Bridge] 사용자 정보를 찾을 수 없음 - 나중에 다시 시도');
                
                // 5초 후 다시 시도
                setTimeout(() => {
                    this.checkAndSendUserInfo();
                }, 5000);
                
            } catch (error) {
                console.error('❌ [iOS Bridge] 자동 사용자 정보 확인 중 오류:', error);
            }
        },

        // 쿠키 헬퍼 함수
        getCookie: function(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }
    }
};

// iOS 네이티브 앱에서 호출되는 함수들
window.handlePushNotification = function(notification) {
    console.log('[iOS Bridge] 푸시 알림 수신:', notification);
    
    // Next.js 앱에 커스텀 이벤트 전달
    const event = new CustomEvent('ios:pushNotification', {
        detail: notification
    });
    window.dispatchEvent(event);
    
    // React state 또는 store 업데이트를 위한 글로벌 함수 호출
    if (window.onPushNotification) {
        window.onPushNotification(notification);
    }
};

window.handleDeepLink = function(deeplink) {
    console.log('[iOS Bridge] 딥링크 수신:', deeplink);
    
    const event = new CustomEvent('ios:deepLink', {
        detail: deeplink
    });
    window.dispatchEvent(event);
    
    if (window.onDeepLink) {
        window.onDeepLink(deeplink);
    }
};

window.handleAppStateChange = function(state) {
    console.log('[iOS Bridge] 앱 상태 변경:', state);
    
    const event = new CustomEvent('ios:appStateChange', {
        detail: state
    });
    window.dispatchEvent(event);
    
    if (window.onAppStateChange) {
        window.onAppStateChange(state);
    }
};

window.handleNotificationPermissionResult = function(granted) {
    console.log('[iOS Bridge] 알림 권한 결과:', granted);
    
    const event = new CustomEvent('ios:notificationPermission', {
        detail: { granted: granted }
    });
    window.dispatchEvent(event);
    
    if (window.onNotificationPermissionResult) {
        window.onNotificationPermissionResult(granted);
    }
};

window.handleFCMTokenUpdate = function(token) {
    console.log('[iOS Bridge] FCM 토큰 업데이트:', token);
    
    const event = new CustomEvent('ios:fcmTokenUpdate', {
        detail: { token: token }
    });
    window.dispatchEvent(event);
    
    if (window.onFCMTokenUpdate) {
        window.onFCMTokenUpdate(token);
    }
};

window.handleDeviceInfo = function(deviceInfo) {
    console.log('[iOS Bridge] 디바이스 정보:', deviceInfo);
    
    const event = new CustomEvent('ios:deviceInfo', {
        detail: deviceInfo
    });
    window.dispatchEvent(event);
    
    if (window.onDeviceInfo) {
        window.onDeviceInfo(deviceInfo);
    }
};

window.handlePageLoaded = function() {
    console.log('[iOS Bridge] 페이지 로딩 완료');
    
    const event = new CustomEvent('ios:pageLoaded');
    window.dispatchEvent(event);
    
    if (window.onPageLoaded) {
        window.onPageLoaded();
    }
};

// iOS 웹뷰에서 필요한 전역 함수들 정의
window.location_refresh = function() {
    console.log('[iOS Bridge] location_refresh 호출됨');
    // 위치 새로고침 로직 (필요시 구현)
    if (window.location && window.location.reload) {
        window.location.reload();
    }
};

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('[iOS Bridge] DOM 로드 완료');
    
    // iOS 앱인지 확인
    if (window.SmapApp.isIOSApp()) {
        console.log('[iOS Bridge] iOS 앱 환경에서 실행 중');
        
        // 페이지 로드 완료를 iOS에 알림
        setTimeout(() => {
            window.SmapApp.sendMessage('pageLoaded', {
                url: window.location.href,
                title: document.title
            });
        }, 100);
        
        // 디바이스 정보 요청
        setTimeout(() => {
            window.SmapApp.device.getInfo();
        }, 500);
        
        // 🆕 사용자 정보 자동 전송 (1초 후)
        setTimeout(() => {
            window.SmapApp.user.checkAndSendUserInfo();
        }, 1000);
    } else {
        console.log('[iOS Bridge] 웹 브라우저 환경에서 실행 중');
    }
});

// Next.js Router 변경 감지 (Next.js 13+ App Router)
if (typeof window !== 'undefined') {
    // 페이지 변경 시 iOS에 알림 (중복 방지 로직 추가)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    // 마지막 전송된 URL 추적
    let lastSentURL = '';
    let lastSentTime = 0;
    const ROUTE_CHANGE_THROTTLE = 1000; // 1초 간격으로 제한
    
    const sendRouteChangeIfNeeded = (url, method) => {
        const now = Date.now();
        
        // 같은 URL이고 1초 이내라면 무시
        if (url === lastSentURL && (now - lastSentTime) < ROUTE_CHANGE_THROTTLE) {
            console.log('🚫 [iOS Bridge] routeChange 중복 방지:', { url, method, timeSinceLastSent: now - lastSentTime });
            return;
        }
        
        lastSentURL = url;
        lastSentTime = now;
        
        if (window.SmapApp.isIOSApp()) {
            console.log('📤 [iOS Bridge] routeChange 전송:', { url, method, timestamp: now });
            window.SmapApp.sendMessage('routeChange', {
                url: url,
                method: method
            });
        }
    };
    
    history.pushState = function(...args) {
        originalPushState.apply(history, args);
        sendRouteChangeIfNeeded(window.location.href, 'push');
    };
    
    history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        sendRouteChangeIfNeeded(window.location.href, 'replace');
    };
    
    // 뒤로가기/앞으로가기 감지
    window.addEventListener('popstate', function(event) {
        sendRouteChangeIfNeeded(window.location.href, 'pop');
    });
}

// 전역 오류 처리
window.addEventListener('error', function(event) {
    if (window.SmapApp.isIOSApp()) {
        window.SmapApp.sendMessage('jsError', {
            message: event.error?.message || 'Unknown error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack
        });
    }
});

// Promise rejection 처리
window.addEventListener('unhandledrejection', function(event) {
    if (window.SmapApp.isIOSApp()) {
        window.SmapApp.sendMessage('jsError', {
            message: event.reason?.message || 'Unhandled promise rejection',
            type: 'unhandledrejection',
            reason: event.reason
        });
    }
});

// 🧪 강화된 테스트 함수들 (전역 접근 가능)
window.SMAP_HAPTIC_TEST = function(type = 'success') {
    console.log(`🧪 [SMAP TEST] 햅틱 테스트 시작: ${type}`);
    
    // 여러 방법으로 햅틱 전송 시도
    const methods = [
        () => window.iosBridge?.haptic?.[type]?.(),
        () => window.SmapApp?.sendMessage('hapticFeedback', { style: type }),
        () => {
            if (window.webkit?.messageHandlers?.smapIos) {
                window.webkit.messageHandlers.smapIos.postMessage({
                    type: 'haptic',
                    param: type,
                    timestamp: Date.now(),
                    source: 'SMAP_HAPTIC_TEST'
                });
            }
        }
    ];
    
    methods.forEach((method, index) => {
        try {
            console.log(`🧪 [SMAP TEST] 방법 ${index + 1} 시도 중...`);
            method();
        } catch (error) {
            console.error(`❌ [SMAP TEST] 방법 ${index + 1} 실패:`, error);
        }
    });
};

window.SMAP_GOOGLE_TEST = function() {
    console.log('🧪 [SMAP TEST] Google Sign-In 테스트 시작');
    
    // 여러 방법으로 구글 로그인 시도
    const methods = [
        () => window.iosBridge?.googleSignIn?.signIn?.(),
        () => window.SmapApp?.sendMessage('googleSignIn'),
        () => {
            if (window.webkit?.messageHandlers?.smapIos) {
                window.webkit.messageHandlers.smapIos.postMessage({
                    type: 'googleSignIn',
                    param: '',
                    timestamp: Date.now(),
                    source: 'SMAP_GOOGLE_TEST'
                });
            }
        }
    ];
    
    methods.forEach((method, index) => {
        try {
            console.log(`🧪 [SMAP TEST] Google 방법 ${index + 1} 시도 중...`);
            method();
        } catch (error) {
            console.error(`❌ [SMAP TEST] Google 방법 ${index + 1} 실패:`, error);
        }
    });
};

window.SMAP_DEBUG_INFO = function() {
    const debugInfo = {
        currentURL: window.location.href,
        userAgent: navigator.userAgent,
        isIOSWebView: /iPad|iPhone|iPod/.test(navigator.userAgent),
        webkit: {
            exists: !!window.webkit,
            messageHandlers: !!window.webkit?.messageHandlers,
            availableHandlers: window.webkit?.messageHandlers ? 
                Object.keys(window.webkit.messageHandlers) : []
        },
        bridge: {
            SmapApp: !!window.SmapApp,
            iosBridge: !!window.iosBridge,
            hapticFunction: !!window.iosBridge?.haptic,
            googleFunction: !!window.iosBridge?.googleSignIn
        },
        tests: {
            SMAP_HAPTIC_TEST: !!window.SMAP_HAPTIC_TEST,
            SMAP_GOOGLE_TEST: !!window.SMAP_GOOGLE_TEST,
            SMAP_DEBUG_INFO: !!window.SMAP_DEBUG_INFO
        }
    };
    
    console.log('🔍 [SMAP DEBUG] 환경 정보:', debugInfo);
    return debugInfo;
};

// 🚨 강력한 테스트 함수들 추가 (nextstep.smap.site용)
window.TEST_ENV = function() {
    const info = {
        url: window.location.href,
        hostname: window.location.hostname,
        userAgent: navigator.userAgent.substring(0, 100) + '...',
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        hasWebKit: !!window.webkit,
        hasMessageHandlers: !!window.webkit?.messageHandlers,
        handlers: window.webkit?.messageHandlers ? Object.keys(window.webkit.messageHandlers) : [],
        iosBridge: !!window.iosBridge,
        smapApp: !!window.SmapApp,
        testFunctions: {
            SMAP_HAPTIC_TEST: !!window.SMAP_HAPTIC_TEST,
            SMAP_GOOGLE_TEST: !!window.SMAP_GOOGLE_TEST,
            SMAP_DEBUG_INFO: !!window.SMAP_DEBUG_INFO,
            TEST_HAPTIC: !!window.TEST_HAPTIC,
            TEST_GOOGLE: !!window.TEST_GOOGLE
        }
    };
    
    console.log('🔍 [TEST_ENV] 환경 정보:', info);
    return info;
};

window.TEST_HAPTIC = function(type = 'success') {
    console.log(`🎮 [TEST_HAPTIC] ${type} 햅틱 테스트 시작`);
    
    // 방법 1: SMAP_HAPTIC_TEST 사용
    if (window.SMAP_HAPTIC_TEST) {
        console.log('🎮 [TEST_HAPTIC] 방법 1: SMAP_HAPTIC_TEST 사용');
        window.SMAP_HAPTIC_TEST(type);
    }
    
    // 방법 2: SmapApp.feedback.impact 사용
    if (window.SmapApp?.feedback?.impact) {
        console.log('🎮 [TEST_HAPTIC] 방법 2: SmapApp.feedback.impact 사용');
        window.SmapApp.feedback.impact(type);
    }
    
    // 방법 3: iosBridge.haptic 사용
    if (window.iosBridge?.haptic?.[type]) {
        console.log(`🎮 [TEST_HAPTIC] 방법 3: iosBridge.haptic.${type} 사용`);
        window.iosBridge.haptic[type]();
    }
    
    // 방법 4: 직접 webkit 호출
    if (window.webkit?.messageHandlers?.smapIos) {
        console.log('🎮 [TEST_HAPTIC] 방법 4: 직접 webkit 호출');
        try {
            window.webkit.messageHandlers.smapIos.postMessage({
                type: 'haptic',
                param: type,
                timestamp: Date.now(),
                source: 'TEST_HAPTIC'
            });
            console.log('🎮 [TEST_HAPTIC] 직접 webkit 호출 성공');
        } catch (error) {
            console.error('🎮 [TEST_HAPTIC] 직접 webkit 호출 실패:', error);
        }
    }
    
    console.log(`🎮 [TEST_HAPTIC] ${type} 햅틱 테스트 완료`);
};

window.TEST_GOOGLE = function() {
    console.log('🔍 [TEST_GOOGLE] Google 로그인 테스트 시작');
    
    if (window.SMAP_GOOGLE_TEST) {
        console.log('🔍 [TEST_GOOGLE] SMAP_GOOGLE_TEST 사용');
        window.SMAP_GOOGLE_TEST();
    } else {
        console.log('🔍 [TEST_GOOGLE] 직접 방법들 시도');
        
        // 여러 방법 시도
        const methods = [
            () => window.iosBridge?.googleSignIn?.signIn?.(),
            () => window.SmapApp?.sendMessage('googleSignIn'),
            () => {
                if (window.webkit?.messageHandlers?.smapIos) {
                    window.webkit.messageHandlers.smapIos.postMessage({
                        type: 'googleSignIn',
                        param: '',
                        timestamp: Date.now(),
                        source: 'TEST_GOOGLE'
                    });
                }
            }
        ];
        
        methods.forEach((method, index) => {
            try {
                console.log(`🔍 [TEST_GOOGLE] 방법 ${index + 1} 시도`);
                method();
            } catch (error) {
                console.error(`🔍 [TEST_GOOGLE] 방법 ${index + 1} 실패:`, error);
            }
        });
    }
    
    console.log('🔍 [TEST_GOOGLE] Google 로그인 테스트 완료');
};

// 자동 환경 감지 및 디버그 정보 출력
setTimeout(() => {
    console.log('🌉 [iOS Bridge] 완전 강화된 초기화 완료');
    console.log('🌉 [iOS Bridge] URL:', window.location.href);
    
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        console.log('📱 [iOS Bridge] iOS 디바이스 감지됨');
        window.SMAP_DEBUG_INFO?.();
        
        console.log('💡 [iOS Bridge] 🚨 강화된 테스트 함수 사용법:');
        console.log('   TEST_ENV() - 환경 정보 전체 출력');
        console.log('   TEST_HAPTIC("success") - 햅틱 완전 테스트');
        console.log('   TEST_GOOGLE() - Google 로그인 완전 테스트');
        console.log('   SMAP_HAPTIC_TEST("success") - 고급 햅틱 테스트');
        console.log('   SMAP_DEBUG_INFO() - 상세 디버그 정보');
        
        // nextstep.smap.site에서 자동 디버그 정보 출력
        if (window.location.hostname === 'nextstep.smap.site') {
            console.log('🚨 [AUTO-DEBUG] nextstep.smap.site 감지 - 자동 환경 체크');
            setTimeout(() => {
                window.TEST_ENV();
            }, 2000);
        }
    } else {
        console.log('🌐 [iOS Bridge] 비-iOS 환경, 테스트 함수만 등록');
        console.log('💡 [iOS Bridge] 테스트 함수: TEST_ENV(), TEST_HAPTIC(), TEST_GOOGLE()');
    }
}, 1000);

window.iosBridge = {
    // 기존 메서드들...
    
    // 알림 관련
    requestNotificationPermission() {
        if (window.webkit?.messageHandlers?.smapIos) {
            window.webkit.messageHandlers.smapIos.postMessage({
                type: 'requestNotificationPermission',
                param: ''
            });
        }
    },

    sendNotification(title, body) {
        if (window.webkit?.messageHandlers?.smapIos) {
            window.webkit.messageHandlers.smapIos.postMessage({
                type: 'sendNotification',
                param: { title, body }
            });
        }
    },

    // 공유하기
    share(content) {
        if (window.webkit?.messageHandlers?.smapIos) {
            window.webkit.messageHandlers.smapIos.postMessage({
                type: 'openShare',
                param: content
            });
        }
    },

    // 햅틱 피드백 메서드들 (강화된 버전)
    haptic: {
        // 🎮 통합 햅틱 전송 함수
        _sendHaptic(type) {
            const currentURL = window.location.href;
            console.log(`🎮 [Haptic] ${type} 햅틱 요청 시작:`, { type, url: currentURL });
            
            // 1순위: smapIos 핸들러 사용
            if (window.webkit?.messageHandlers?.smapIos) {
                try {
                    window.webkit.messageHandlers.smapIos.postMessage({
                        type: 'haptic',
                        param: type,
                        timestamp: Date.now(),
                        url: currentURL,
                        source: 'ios-bridge-haptic'
                    });
                    console.log(`✅ [Haptic] smapIos로 ${type} 햅틱 전송 성공`);
                    return true;
                } catch (error) {
                    console.error(`❌ [Haptic] smapIos ${type} 햅틱 전송 실패:`, error);
                }
            }
            
            // 2순위: iosHandler 백업 사용
            if (window.webkit?.messageHandlers?.iosHandler) {
                try {
                    window.webkit.messageHandlers.iosHandler.postMessage({
                        action: 'hapticFeedback',
                        style: type,
                        timestamp: Date.now(),
                        url: currentURL,
                        source: 'ios-bridge-haptic-backup'
                    });
                    console.log(`✅ [Haptic] iosHandler로 ${type} 햅틱 전송 성공`);
                    return true;
                } catch (error) {
                    console.error(`❌ [Haptic] iosHandler ${type} 햅틱 전송 실패:`, error);
                }
            }
            
            console.warn(`⚠️ [Haptic] ${type} 햅틱 전송 실패 - iOS 핸들러 없음`);
            console.warn('⚠️ [Haptic] 사용 가능한 핸들러:', window.webkit?.messageHandlers ? Object.keys(window.webkit.messageHandlers) : 'none');
            return false;
        },

        // 가벼운 햅틱 (버튼 탭, 가벼운 상호작용)
        light() {
            return this._sendHaptic('light');
        },

        // 중간 햅틱 (중간 정도의 상호작용)
        medium() {
            return this._sendHaptic('medium');
        },

        // 강한 햅틱 (중요한 액션, 경고)
        heavy() {
            return this._sendHaptic('heavy');
        },

        // 성공 햅틱
        success() {
            return this._sendHaptic('success');
        },

        // 경고 햅틱
        warning() {
            return this._sendHaptic('warning');
        },

        // 에러 햅틱
        error() {
            return this._sendHaptic('error');
        },

        // 선택 변경 햅틱 (탭 전환, 선택 변경)
        selection() {
            return this._sendHaptic('selection');
        }
    },

    // 디바이스 정보
    getDeviceInfo() {
        if (window.webkit?.messageHandlers?.smapIos) {
            window.webkit.messageHandlers.smapIos.postMessage({
                type: 'getDeviceInfo',
                param: ''
            });
        }
    },

    // Google Sign-In 기능 (강화된 버전)
    googleSignIn: {
        // 🔐 통합 구글 메시지 전송 함수
        _sendGoogleMessage(type, param = '') {
            const currentURL = window.location.href;
            console.log(`🔐 [GoogleSignIn] ${type} 요청 시작:`, { type, param, url: currentURL });
            
            // 1순위: smapIos 핸들러 사용
            if (window.webkit?.messageHandlers?.smapIos) {
                try {
                    window.webkit.messageHandlers.smapIos.postMessage({
                        type: type,
                        param: param,
                        timestamp: Date.now(),
                        url: currentURL,
                        source: 'ios-bridge-google'
                    });
                    console.log(`✅ [GoogleSignIn] smapIos로 ${type} 전송 성공`);
                    return true;
                } catch (error) {
                    console.error(`❌ [GoogleSignIn] smapIos ${type} 전송 실패:`, error);
                }
            }
            
            // 2순위: iosHandler 백업 사용
            if (window.webkit?.messageHandlers?.iosHandler) {
                try {
                    window.webkit.messageHandlers.iosHandler.postMessage({
                        action: type,
                        data: param,
                        timestamp: Date.now(),
                        url: currentURL,
                        source: 'ios-bridge-google-backup'
                    });
                    console.log(`✅ [GoogleSignIn] iosHandler로 ${type} 전송 성공`);
                    return true;
                } catch (error) {
                    console.error(`❌ [GoogleSignIn] iosHandler ${type} 전송 실패:`, error);
                }
            }
            
            console.warn(`⚠️ [GoogleSignIn] ${type} 전송 실패 - iOS 핸들러 없음`);
            console.warn('⚠️ [GoogleSignIn] 사용 가능한 핸들러:', window.webkit?.messageHandlers ? Object.keys(window.webkit.messageHandlers) : 'none');
            return false;
        },

        // Google 로그인 시작
        signIn() {
            return this._sendGoogleMessage('googleSignIn');
        },

        // Google 로그아웃
        signOut() {
            return this._sendGoogleMessage('googleSignOut');
        },

        // 현재 로그인 상태 확인
        checkStatus() {
            return this._sendGoogleMessage('googleSignInStatus');
        }
    }
};

// 🔥 카카오 로그인 JavaScript 핸들러 함수들 (새로운 핸들러로 위임)
// 기존 복잡한 로직은 새로운 kakao-login-handler.js로 이동
window.kakaoSignInSuccess = function(token, userInfo) {
    console.log('📱 [KAKAO-iOS] 새로운 핸들러로 위임:', { hasToken: !!token, hasUserInfo: !!userInfo });
    // 새로운 핸들러가 있으면 위임, 없으면 기본 처리
    if (window.kakaoSignInSuccess && window.kakaoSignInSuccess !== arguments.callee) {
        window.kakaoSignInSuccess(token, userInfo);
    }
};

window.kakaoSignInError = function(error) {
    console.error('📱 [KAKAO-iOS] 새로운 핸들러로 위임:', error);
    // 새로운 핸들러가 있으면 위임, 없으면 기본 처리
    if (window.kakaoSignInError && window.kakaoSignInError !== arguments.callee) {
        window.kakaoSignInError(error);
    }
};

// 🔥 구글 로그인 JavaScript 핸들러 함수들 (네이티브 iOS에서 호출)
window.googleSignInSuccess = function(token, userInfo) {
    console.log('📱 [GOOGLE-iOS] 네이티브 구글 로그인 성공:', {
        hasToken: !!token,
        hasUserInfo: !!userInfo
    });
    
    try {
        // userInfo가 문자열이면 JSON 파싱
        let parsedUserInfo = userInfo;
        if (typeof userInfo === 'string') {
            parsedUserInfo = JSON.parse(userInfo);
        }
        
        // 성공 햅틱 피드백
        if (window.SmapApp && window.SmapApp.haptic) {
            window.SmapApp.haptic.success();
        }
        
        // 구글 로그인 성공 처리
        if (window.handleNativeGoogleLoginSuccess) {
            window.handleNativeGoogleLoginSuccess(token, parsedUserInfo);
        } else {
            // 백업 처리
            console.log('📱 [GOOGLE-iOS] 직접 처리 - 홈으로 이동');
            window.location.href = '/home';
        }
        
    } catch (error) {
        console.error('📱 [GOOGLE-iOS] 로그인 성공 처리 오류:', error);
        window.googleSignInError(error.message);
    }
};

window.googleSignInError = function(error) {
    console.error('📱 [GOOGLE-iOS] 네이티브 구글 로그인 실패:', error);
    
    // 에러 햅틱 피드백
    if (window.SmapApp && window.SmapApp.haptic) {
        window.SmapApp.haptic.error();
    }
    
    // 에러 메시지를 한글로 변환
    const originalMessage = typeof error === 'string' ? error : (error.message || '구글 로그인에 실패했습니다.');
    let userFriendlyMessage = originalMessage;
    
    if (originalMessage.includes('cancelled') || originalMessage.includes('canceled') || originalMessage.includes('The user canceled the sign-in-flow')) {
        userFriendlyMessage = '로그인을 취소했습니다.';
    } else if (originalMessage.includes('network') || originalMessage.includes('Network')) {
        userFriendlyMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
    } else if (originalMessage.includes('configuration') || originalMessage.includes('Configuration')) {
        userFriendlyMessage = 'Google 로그인 설정에 문제가 있습니다. 앱을 다시 시작해주세요.';
    }
    
    if (window.handleNativeGoogleLoginError) {
        window.handleNativeGoogleLoginError(userFriendlyMessage);
    } else {
        // 백업 처리
        if (window.showError) {
            window.showError(userFriendlyMessage);
        } else {
            alert(userFriendlyMessage);
        }
    }
};

console.log('✅ [iOS Bridge] 카카오/구글 로그인 JavaScript 핸들러 함수들 등록 완료');
console.log('  - kakaoSignInSuccess()');
console.log('  - kakaoSignInError()');
console.log('  - googleSignInSuccess()');
console.log('  - googleSignInError()'); 