// iOS-Next.js Bridge
// iOS 웹뷰와 Next.js 애플리케이션 간의 통신 인터페이스

window.SmapApp = {
    // iOS 네이티브 앱으로 메시지 전송
    sendMessage: function(action, data = {}) {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosHandler) {
            try {
                window.webkit.messageHandlers.iosHandler.postMessage({
                    action: action,
                    timestamp: Date.now(),
                    ...data
                });
                console.log(`[iOS Bridge] 메시지 전송: ${action}`, data);
            } catch (error) {
                console.error(`[iOS Bridge] 메시지 전송 실패: ${action}`, error);
            }
        } else {
            console.warn('[iOS Bridge] iOS 네이티브 앱 연결이 없습니다.');
            // 개발 환경에서 테스트용 로그
            if (process.env.NODE_ENV === 'development') {
                console.log(`[iOS Bridge] DEV MODE - Action: ${action}`, data);
            }
        }
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

console.log('[iOS Bridge] 초기화 완료'); 