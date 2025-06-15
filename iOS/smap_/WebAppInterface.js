// WebAppInterface.js
// iOS 웹뷰와 네이티브 앱 간의 통신을 위한 JavaScript 인터페이스

window.SmapApp = {
    // iOS 네이티브 앱으로 메시지 전송
    sendMessage: function(action, data) {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosHandler) {
            window.webkit.messageHandlers.iosHandler.postMessage({
                action: action,
                ...data
            });
        } else {
            console.warn('iOS 네이티브 앱 연결이 없습니다.');
        }
    },

    // 알림 권한 요청
    requestNotificationPermission: function() {
        this.sendMessage('requestNotificationPermission');
    },

    // 콘텐츠 공유
    shareContent: function(content) {
        this.sendMessage('shareContent', { content: content });
    },

    // 외부 URL 열기
    openExternalURL: function(url) {
        this.sendMessage('openExternalURL', { url: url });
    },

    // 햅틱 피드백 실행
    hapticFeedback: function() {
        this.sendMessage('hapticFeedback');
    },

    // 앱 정보 가져오기
    getAppInfo: function() {
        this.sendMessage('getAppInfo');
    },

    // 디바이스 정보 가져오기
    getDeviceInfo: function() {
        this.sendMessage('getDeviceInfo');
    }
};

// iOS 네이티브 앱에서 호출되는 함수들
window.handlePushNotification = function(notification) {
    console.log('푸시 알림 수신:', notification);
    
    // React 앱에 푸시 알림 이벤트 전달
    if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('pushNotification', {
            detail: notification
        }));
    }
};

window.handleDeepLink = function(deeplink) {
    console.log('딥링크 수신:', deeplink);
    
    // React 앱에 딥링크 이벤트 전달
    if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('deepLink', {
            detail: deeplink
        }));
    }
};

window.handleAppStateChange = function(state) {
    console.log('앱 상태 변경:', state);
    
    // React 앱에 앱 상태 변경 이벤트 전달
    if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('appStateChange', {
            detail: state
        }));
    }
};

window.handleNotificationPermissionResult = function(granted) {
    console.log('알림 권한 결과:', granted);
    
    // React 앱에 알림 권한 결과 전달
    if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('notificationPermissionResult', {
            detail: { granted: granted }
        }));
    }
};

window.handleFCMTokenUpdate = function(token) {
    console.log('FCM 토큰 업데이트:', token);
    
    // React 앱에 FCM 토큰 업데이트 이벤트 전달
    if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('fcmTokenUpdate', {
            detail: { token: token }
        }));
    }
};

// 페이지 로드 완료 시 iOS 앱에 알림
document.addEventListener('DOMContentLoaded', function() {
    console.log('웹 페이지 로드 완료');
    
    if (window.SmapApp) {
        // iOS 앱에 페이지 로드 완료 알림
        setTimeout(function() {
            window.SmapApp.sendMessage('pageLoaded');
        }, 100);
    }
});

// 콘솔 로그를 iOS 앱으로 전달 (디버깅용)
if (window.SmapApp) {
    const originalLog = console.log;
    console.log = function(...args) {
        originalLog.apply(console, args);
        
        // 개발 모드에서만 로그 전달
        if (process.env.NODE_ENV === 'development') {
            window.SmapApp.sendMessage('consoleLog', {
                message: args.join(' ')
            });
        }
    };
} 