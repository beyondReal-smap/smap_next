// iOS-Next.js Bridge (강화된 버전)
// iOS 웹뷰와 Next.js 애플리케이션 간의 통신 인터페이스

console.log('🌉 [iOS Bridge] 초기화 시작');

// 🔧 WebKit MessageHandler 환경 감지 및 강제 초기화
(function initializeWebKitHandlers() {
    const currentURL = window.location.href;
    const isIOSWebView = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    console.log('🔍 [iOS Bridge] 환경 감지:', {
        isIOSWebView,
        currentURL,
        hasWebKit: !!window.webkit,
        hasMessageHandlers: !!(window.webkit?.messageHandlers),
        availableHandlers: window.webkit?.messageHandlers ? 
            Object.keys(window.webkit.messageHandlers) : [],
        userAgent: navigator.userAgent.substring(0, 100)
    });
    
    // iOS WebView 환경에서 webkit이 없다면 강제 초기화 시도
    if (isIOSWebView && !window.webkit) {
        console.warn('⚠️ [iOS Bridge] iOS WebView 환경인데 webkit 없음 - 임시 객체 생성');
        window.webkit = {
            messageHandlers: {}
        };
    }
    
    // messageHandlers가 없다면 빈 객체로 초기화
    if (isIOSWebView && window.webkit && !window.webkit.messageHandlers) {
        console.warn('⚠️ [iOS Bridge] messageHandlers 없음 - 빈 객체 생성');
        window.webkit.messageHandlers = {};
    }
    
    // 필수 핸들러들이 없다면 가짜 핸들러 등록
    if (isIOSWebView && window.webkit && window.webkit.messageHandlers) {
        const requiredHandlers = ['smapIos', 'iosHandler'];
        
        requiredHandlers.forEach(handlerName => {
            if (!window.webkit.messageHandlers[handlerName]) {
                console.warn(`⚠️ [iOS Bridge] ${handlerName} 핸들러 없음 - 가짜 핸들러 생성`);
                window.webkit.messageHandlers[handlerName] = {
                    postMessage: function(message) {
                        console.log(`📤 [${handlerName}] 메시지:`, message);
                        // CustomEvent로 네이티브에 알림 시도
                        window.dispatchEvent(new CustomEvent('smap-ios-message', {
                            detail: { handler: handlerName, message: message }
                        }));
                    }
                };
            }
        });
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
        // 햅틱 피드백
        impact: function(style = 'medium') {
            window.SmapApp.sendMessage('hapticFeedback', { style: style });
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
    } else {
        console.log('[iOS Bridge] 웹 브라우저 환경에서 실행 중');
    }
});

// Next.js Router 변경 감지 (Next.js 13+ App Router)
if (typeof window !== 'undefined') {
    // 페이지 변경 시 iOS에 알림
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
        originalPushState.apply(history, args);
        if (window.SmapApp.isIOSApp()) {
            window.SmapApp.sendMessage('routeChange', {
                url: window.location.href,
                method: 'push'
            });
        }
    };
    
    history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        if (window.SmapApp.isIOSApp()) {
            window.SmapApp.sendMessage('routeChange', {
                url: window.location.href,
                method: 'replace'
            });
        }
    };
    
    // 뒤로가기/앞으로가기 감지
    window.addEventListener('popstate', function(event) {
        if (window.SmapApp.isIOSApp()) {
            window.SmapApp.sendMessage('routeChange', {
                url: window.location.href,
                method: 'pop'
            });
        }
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

// 자동 환경 감지 및 디버그 정보 출력
setTimeout(() => {
    console.log('🌉 [iOS Bridge] 초기화 완료');
    
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        console.log('📱 [iOS Bridge] iOS 디바이스 감지됨');
        window.SMAP_DEBUG_INFO();
        
        console.log('💡 [iOS Bridge] 테스트 함수 사용법:');
        console.log('   SMAP_HAPTIC_TEST("success") - 햅틱 테스트');
        console.log('   SMAP_GOOGLE_TEST() - Google 로그인 테스트');
        console.log('   SMAP_DEBUG_INFO() - 디버그 정보 출력');
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