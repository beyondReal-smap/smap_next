// iOS-Next.js Bridge (완전 강화된 버전)
// iOS 웹뷰와 Next.js 애플리케이션 간의 통신 인터페이스

console.log('🌉 [iOS Bridge] 완전 강화된 초기화 시작');
console.log('🌉 [iOS Bridge] 현재 URL:', window.location.href);
console.log('🌉 [iOS Bridge] User Agent:', navigator.userAgent);

// 🔄 FCM 토큰 등록 상태 관리
window.__FCM_TOKEN_STATUS__ = {
    isRegistered: false,
    lastAttemptTime: 0,
    failureCount: 0,
    isBlocked: false,
    blockUntil: 0
};

// FCM 토큰 등록 상태 초기화 함수 추가
window.__resetFCMTokenStatus__ = function() {
    console.log('🔄 [iOS Bridge] FCM 토큰 상태 초기화');
    window.__FCM_TOKEN_STATUS__ = {
        isRegistered: false,
        lastAttemptTime: 0,
        failureCount: 0,
        isBlocked: false,
        blockUntil: 0
    };
};

// FCM 토큰 등록 상태 확인 함수
window.__checkFCMTokenStatus__ = function() {
    const now = Date.now();
    const status = window.__FCM_TOKEN_STATUS__;

    // 차단 상태 확인
    if (status.isBlocked && now < status.blockUntil) {
        console.log('🚫 [iOS Bridge] FCM 토큰 등록이 차단된 상태 - 메시지 전송 건너뜀');
        console.log('⏰ [iOS Bridge] 차단 해제까지:', Math.ceil((status.blockUntil - now) / 1000), '초 남음');
        return false;
    }

    // 최근 실패가 있었고 아직 타임아웃이 지나지 않은 경우
    if (!status.isRegistered && status.failureCount > 0 && (now - status.lastAttemptTime) < 300000) { // 5분
        console.log('⏳ [iOS Bridge] FCM 토큰 등록 실패 후 쿨다운 중 - 메시지 전송 건너뜀');
        return false;
    }

    return true;
};

// FCM 토큰 등록 상태 업데이트 함수
window.__updateFCMTokenStatus__ = function(isRegistered, isError = false) {
    const status = window.__FCM_TOKEN_STATUS__;
    const now = Date.now();

    if (isRegistered) {
        status.isRegistered = true;
        status.failureCount = 0;
        status.isBlocked = false;
        console.log('✅ [iOS Bridge] FCM 토큰 등록 성공 - 상태 업데이트');
    } else if (isError) {
        status.lastAttemptTime = now;
        status.failureCount++;

        // 3회 이상 실패 시 5분간 차단
        if (status.failureCount >= 3) {
            status.isBlocked = true;
            status.blockUntil = now + (5 * 60 * 1000); // 5분
            console.log('🚨 [iOS Bridge] FCM 토큰 등록 3회 실패 - 5분간 메시지 전송 차단');
        }
    }
};

// 🔄 FCM 토큰 등록 이벤트 리스너 설정
(function setupFCMTokenEventListeners() {
    console.log('🎧 [iOS Bridge] FCM 토큰 이벤트 리스너 설정 시작');

    // FCM 토큰 등록 성공 이벤트 리스너
    window.addEventListener('fcmTokenRegistrationSuccess', function(event) {
        console.log('✅ [iOS Bridge] FCM 토큰 등록 성공 이벤트 수신');
        window.__updateFCMTokenStatus__(true, false);
    });

    // FCM 토큰 등록 실패 이벤트 리스너
    window.addEventListener('fcmTokenRegistrationFailed', function(event) {
        console.log('❌ [iOS Bridge] FCM 토큰 등록 실패 이벤트 수신:', event.detail);
        window.__updateFCMTokenStatus__(false, true);
    });

    console.log('✅ [iOS Bridge] FCM 토큰 이벤트 리스너 설정 완료');
})();

// 🔧 WebKit MessageHandler 환경 감지 및 강제 초기화 (대폭 강화)
(function initializeWebKitHandlers() {
    const currentURL = window.location.href;
    const isIOSWebView = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isProduction = window.location.hostname === 'nextstep.aiagnt.kr';
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

            // 🚨 퍼미션 가드: 로그인 전 권한 유발 postMessage 차단 (가장 이른 시점에 설치)
            try {
                if (!window.__SMAP_PM_GUARD_INSTALLED__) {
                    window.__SMAP_PM_GUARD_INSTALLED__ = true;
                    const blockedTypes = [
                        'requestNotificationPermission',
                        'requestCameraPermission',
                        'requestPhotoLibraryPermission',
                        'requestLocationPermission',
                        'openPhoto',
                        'openAlbum',
                        'startLocationUpdates',
                        'checkLocationPermission',
                        'setAlarmPermission'
                    ];
                    const wrapHandler = (handlerName) => {
                        const handler = window.webkit.messageHandlers[handlerName];
                        if (!handler || typeof handler.postMessage !== 'function' || handler.__smapWrapped__) return;
                        const __origPost__ = handler.postMessage.bind(handler);
                        handler.postMessage = function(message) {
                            try {
                                const allow = !!window.__SMAP_PERM_ALLOW__;
                                const type = (message && (message.type || message.action)) || '';
                                if (!allow && blockedTypes.includes(type)) {
                                    console.warn('[SMAP-PERM] postMessage blocked until login:', handlerName, type);
                                    return;
                                }
                            } catch (e) {}
                            return __origPost__(message);
                        };
                        handler.__smapWrapped__ = true;
                        debugLog(`[iOS Bridge] postMessage permission guard installed for ${handlerName}`);
                    };
                    Object.keys(window.webkit.messageHandlers).forEach(wrapHandler);
                }
            } catch (e) {
                console.warn('[iOS Bridge] postMessage guard install failed:', e);
            }
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
        const importantMessages = ['userInfo', 'routeChange', 'pageLoaded'];
        if (importantMessages.includes(action)) {
            if (!window.__checkFCMTokenStatus__()) {
                console.log(`🚫 [iOS Bridge] FCM 토큰 상태 문제로 ${action} 메시지 전송 건너뜀`);
                return false;
            }
        }

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
        // 알림 권한 요청 (로그인 전 차단)
        requestPermission: function() {
            if (!(window.__SMAP_PERM_ALLOW__)) {
                console.warn('[SMAP-PERM] ios-bridge notification.requestPermission blocked until login');
                return;
            }
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
        // 전송 중복 방지 상태
        __lastSentUserId: null,
        __lastSentAt: 0,
        __sendInProgress: false,

        // 최근 전송 여부 확인 (동일 사용자 10초 이내 중복 차단)
        __shouldSendNow(userId) {
            const now = Date.now();
            try {
                const sentInfoRaw = sessionStorage.getItem('smap_user_info_sent');
                if (sentInfoRaw) {
                    const sentInfo = JSON.parse(sentInfoRaw);
                    if (sentInfo && sentInfo.mt_idx === userId && (now - (sentInfo.timestamp || 0)) < 10000) {
                        console.log('👤 [iOS Bridge] 사용자 정보 전송 건너뜀 (중복 방지 창 내):', { userId, sinceMs: now - (sentInfo.timestamp || 0) });
                        return false;
                    }
                }
            } catch (_) {}

            const sameUser = this.__lastSentUserId && this.__lastSentUserId === userId;
            if (sameUser && (now - this.__lastSentAt) < 10000) {
                console.log('👤 [iOS Bridge] 사용자 정보 전송 건너뜀 (메모리 중복 방지):', { userId, sinceMs: now - this.__lastSentAt });
                return false;
            }
            if (this.__sendInProgress) {
                console.log('👤 [iOS Bridge] 사용자 정보 전송 대기 중 - 중복 전송 방지');
                return false;
            }
            return true;
        },
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

            // 전송 중복 방지 가드
            if (!this.__shouldSendNow(userData.mt_idx)) {
                return false;
            }
            this.__sendInProgress = true;

            window.SmapApp.sendMessage('userInfo', userData);
            this.__lastSentUserId = userData.mt_idx;
            this.__lastSentAt = Date.now();
            try {
                sessionStorage.setItem('smap_user_info_sent', JSON.stringify({ mt_idx: userData.mt_idx, timestamp: this.__lastSentAt }));
            } catch (_) {}

            // 💾 로컬스토리지에도 저장 (iOS에서 필요시 접근)
            try {
                localStorage.setItem('smap_user_info', JSON.stringify(userData));
                console.log('👤 [iOS Bridge] 사용자 정보 로컬스토리지 저장 완료');
            } catch (error) {
                console.error('👤 [iOS Bridge] 로컬스토리지 저장 실패:', error);
            }
            this.__sendInProgress = false;
            return true;
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
            console.log('👤 [iOS Bridge] 현재 URL:', window.location.href);
            console.log('👤 [iOS Bridge] document.readyState:', document.readyState);
            
            try {
                // 이미 최근에 전송되었으면 즉시 종료 (중복 방지)
                try {
                    const sent = sessionStorage.getItem('smap_user_info_sent');
                    if (sent) {
                        const { mt_idx, timestamp } = JSON.parse(sent) || {};
                        if (mt_idx && Date.now() - (timestamp || 0) < 10000) {
                            console.log('👤 [iOS Bridge] 최근 전송 기록 발견, 자동 확인 생략');
                            return;
                        }
                    }
                } catch (_) {}
                if (this.__lastSentUserId && (Date.now() - this.__lastSentAt) < 10000) {
                    console.log('👤 [iOS Bridge] 메모리 기준 최근 전송, 자동 확인 생략');
                    return;
                }
                // 🔍 모든 가능한 저장소 검사
                this.debugAllStorages();
                
                // 1. 로컬스토리지에서 사용자 정보 확인 (다양한 키)
                const localKeys = [
                    'smap_user_data',      // ✅ 실제 발견된 키!
                    'user',                // ✅ 실제 발견된 키!
                    'smap_user_info', 
                    'user_info', 
                    'userData', 
                    'currentUser', 
                    'authUser', 
                    'loginUser'
                ];
                for (const key of localKeys) {
                    const storedData = localStorage.getItem(key);
                    if (storedData) {
                        try {
                            const userInfo = JSON.parse(storedData);
                            if (userInfo && (userInfo.mt_idx || userInfo.id || userInfo.user_id)) {
                                console.log(`👤 [iOS Bridge] 로컬스토리지(${key})에서 사용자 정보 발견:`, userInfo);
                                this.sendUserInfo(this.normalizeUserInfo(userInfo));
                                return;
                            }
                        } catch (e) {
                            console.warn(`👤 [iOS Bridge] 로컬스토리지(${key}) 파싱 실패:`, e);
                        }
                    }
                }
                
                // 2. 세션스토리지에서 사용자 정보 확인
                const sessionKeys = ['user_info', 'smap_user', 'session_user', 'authData'];
                for (const key of sessionKeys) {
                    const sessionData = sessionStorage.getItem(key);
                    if (sessionData) {
                        try {
                            const userInfo = JSON.parse(sessionData);
                            if (userInfo && (userInfo.mt_idx || userInfo.id || userInfo.user_id)) {
                                console.log(`👤 [iOS Bridge] 세션스토리지(${key})에서 사용자 정보 발견:`, userInfo);
                                this.sendUserInfo(this.normalizeUserInfo(userInfo));
                                return;
                            }
                        } catch (e) {
                            console.warn(`👤 [iOS Bridge] 세션스토리지(${key}) 파싱 실패:`, e);
                        }
                    }
                }
                
                // 3. 전역 변수에서 사용자 정보 확인
                const globalVars = ['currentUser', 'user', 'authUser', 'userData', 'loginData'];
                for (const varName of globalVars) {
                    if (window[varName] && (window[varName].mt_idx || window[varName].id || window[varName].user_id)) {
                        console.log(`👤 [iOS Bridge] 전역변수(${varName})에서 사용자 정보 발견:`, window[varName]);
                        this.sendUserInfo(this.normalizeUserInfo(window[varName]));
                        return;
                    }
                }
                
                // 4. React/Next.js 상태에서 확인
                if (window.__NEXT_DATA__ && window.__NEXT_DATA__.props) {
                    const nextData = window.__NEXT_DATA__.props;
                    if (nextData.pageProps && nextData.pageProps.user) {
                        console.log('👤 [iOS Bridge] Next.js pageProps에서 사용자 정보 발견:', nextData.pageProps.user);
                        this.sendUserInfo(this.normalizeUserInfo(nextData.pageProps.user));
                        return;
                    }
                }
                
                // 5. 쿠키에서 사용자 정보 확인
                const cookieKeys = ['user_info', 'auth_user', 'login_data', 'smap_user', 'client-token'];
                for (const key of cookieKeys) {
                    const userCookie = this.getCookie(key);
                    if (userCookie) {
                        try {
                            const decodedCookie = decodeURIComponent(userCookie);
                            console.log(`🍪 [iOS Bridge] 쿠키(${key}) 원본:`, decodedCookie.substring(0, 200));
                            
                            let userInfo;
                            if (key === 'client-token') {
                                // client-token은 특별한 형식으로 파싱
                                userInfo = JSON.parse(decodedCookie);
                                if (userInfo.userId) {
                                    userInfo.mt_idx = userInfo.userId;
                                    userInfo.id = userInfo.userId;
                                }
                            } else {
                                userInfo = JSON.parse(decodedCookie);
                            }
                            
                            if (userInfo && (userInfo.mt_idx || userInfo.id || userInfo.user_id || userInfo.userId)) {
                                console.log(`👤 [iOS Bridge] 쿠키(${key})에서 사용자 정보 발견:`, userInfo);
                                this.sendUserInfo(this.normalizeUserInfo(userInfo));
                                return;
                            }
                        } catch (e) {
                            console.warn(`👤 [iOS Bridge] 쿠키(${key}) 파싱 실패:`, e);
                        }
                    }
                }
                
                console.log('⚠️ [iOS Bridge] 사용자 정보를 찾을 수 없음');
                console.log('💡 [iOS Bridge] 수동 테스트: window.SMAP_TEST_USER_INFO() 실행 가능');
                
                // 5초 후 다시 시도 (최대 3번)
                if (!this.retryCount) this.retryCount = 0;
                if (this.retryCount < 3) {
                    this.retryCount++;
                    console.log(`🔄 [iOS Bridge] ${this.retryCount}/3 사용자 정보 재시도 예약`);
                    setTimeout(() => {
                        this.checkAndSendUserInfo();
                    }, 5000);
                }
                
            } catch (error) {
                console.error('❌ [iOS Bridge] 자동 사용자 정보 확인 중 오류:', error);
            }
        },

        // 사용자 정보 정규화 (다양한 형식을 통일)
        normalizeUserInfo: function(userInfo) {
            return {
                mt_idx: userInfo.mt_idx || userInfo.id || userInfo.user_id || userInfo.userId || '',
                mt_id: userInfo.mt_id || userInfo.email || userInfo.username || userInfo.login_id || '',
                mt_name: userInfo.mt_name || userInfo.name || userInfo.displayName || userInfo.nickname || '',
                mt_email: userInfo.mt_email || userInfo.email || userInfo.mail || ''
            };
        },

        // 모든 저장소 디버깅
        debugAllStorages: function() {
            console.log('🔍 [iOS Bridge] === 저장소 전체 검사 ===');
            
            // 로컬스토리지
            console.log('📦 [localStorage] 전체 키:', Object.keys(localStorage));
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                if (value && (value.includes('mt_idx') || value.includes('user') || value.includes('auth'))) {
                    console.log(`📦 [localStorage] ${key}:`, value.substring(0, 200));
                }
            }
            
            // 세션스토리지
            console.log('📁 [sessionStorage] 전체 키:', Object.keys(sessionStorage));
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const value = sessionStorage.getItem(key);
                if (value && (value.includes('mt_idx') || value.includes('user') || value.includes('auth'))) {
                    console.log(`📁 [sessionStorage] ${key}:`, value.substring(0, 200));
                }
            }
            
            // 쿠키
            console.log('🍪 [cookies]:', document.cookie);
            
            // 전역 변수
            const globalVars = Object.keys(window).filter(key => 
                key.toLowerCase().includes('user') || 
                key.toLowerCase().includes('auth') || 
                key.toLowerCase().includes('login')
            );
            console.log('🌐 [globals] 사용자 관련 변수들:', globalVars);
            
            console.log('🔍 [iOS Bridge] === 검사 완료 ===');
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

// 🔄 즉시 실행 함수 (DOM 상태 관계없이)
(function initializeIOSBridgeImmediately() {
    console.log('🚀 [iOS Bridge] 즉시 초기화 시작');
    console.log('🚀 [iOS Bridge] document.readyState:', document.readyState);
    
    if (window.SmapApp && window.SmapApp.isIOSApp()) {
        console.log('🚀 [iOS Bridge] iOS 앱 환경에서 즉시 실행');
        
        // 즉시 사용자 정보 확인 시도
        setTimeout(() => {
            console.log('👤 [iOS Bridge] 즉시 사용자 정보 확인 시작');
            window.SmapApp.user.checkAndSendUserInfo();
        }, 500);
        
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
        }, 800);
    }
})();

// DOM 로드 완료 시 초기화 (백업)
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 [iOS Bridge] DOM 로드 완료 (백업 실행)');
    
    // iOS 앱인지 확인
    if (window.SmapApp.isIOSApp()) {
        console.log('📋 [iOS Bridge] iOS 앱 환경에서 실행 중 (백업)');
        
        // 🆕 사용자 정보 자동 전송 (백업 - 2초 후)
        setTimeout(() => {
            console.log('👤 [iOS Bridge] 백업 사용자 정보 확인 시작');
            window.SmapApp.user.checkAndSendUserInfo();
        }, 2000);
    } else {
        console.log('📋 [iOS Bridge] 웹 브라우저 환경에서 실행 중');
    }
});

// 페이지가 이미 로드된 경우를 위한 추가 체크
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('⚡ [iOS Bridge] 페이지 이미 로드됨 - 추가 초기화');
    
    setTimeout(() => {
        if (window.SmapApp && window.SmapApp.isIOSApp()) {
            console.log('⚡ [iOS Bridge] 이미 로드된 페이지에서 사용자 정보 확인');
            window.SmapApp.user.checkAndSendUserInfo();
        }
    }, 1500);
}

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

        // 🔄 FCM 토큰 등록 상태 확인 - 문제가 있으면 routeChange 전송 건너뜀
        if (!window.__checkFCMTokenStatus__()) {
            console.log('🚫 [iOS Bridge] FCM 토큰 상태 문제로 routeChange 전송 건너뜀:', { url, method });
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

// 🔍 FCM 토큰 상태 디버그 함수
window.DEBUG_FCM_STATUS = function() {
    const status = window.__FCM_TOKEN_STATUS__ || {};
    const now = Date.now();

    console.log('🔍 [DEBUG] FCM 토큰 등록 상태:');
    console.log('  ✅ 등록됨:', status.isRegistered ? '예' : '아니오');
    console.log('  ❌ 실패 횟수:', status.failureCount || 0);
    console.log('  🚫 차단됨:', status.isBlocked ? '예' : '아니오');
    console.log('  ⏰ 마지막 시도:', status.lastAttemptTime ? new Date(status.lastAttemptTime).toLocaleString() : '없음');
    console.log('  🕐 차단 해제:', status.blockUntil ? new Date(status.blockUntil).toLocaleString() : '없음');

    if (status.isBlocked && status.blockUntil) {
        const remaining = Math.ceil((status.blockUntil - now) / 1000);
        console.log('  ⏳ 차단 해제까지:', remaining > 0 ? `${remaining}초` : '만료됨');
    }

    console.log('  🔄 상태 확인:', window.__checkFCMTokenStatus__() ? '정상' : '문제 있음');

    return status;
};

// 🔄 FCM 토큰 상태 리셋 함수 (개발용)
window.RESET_FCM_STATUS = function() {
    window.__FCM_TOKEN_STATUS__ = {
        isRegistered: false,
        lastAttemptTime: 0,
        failureCount: 0,
        isBlocked: false,
        blockUntil: 0
    };
    console.log('🔄 [DEBUG] FCM 토큰 상태 초기화됨');
    return window.__FCM_TOKEN_STATUS__;
};

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

// 🚨 강력한 테스트 함수들 추가 (nextstep.aiagnt.kr용)
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

        
        // nextstep.aiagnt.kr에서 자동 디버그 정보 출력
        if (window.location.hostname === 'nextstep.aiagnt.kr') {
            console.log('🚨 [AUTO-DEBUG] nextstep.aiagnt.kr 감지 - 자동 환경 체크');
            setTimeout(() => {
                window.TEST_ENV();
            }, 2000);
        }
    } else {
        console.log('🌐 [iOS Bridge] 비-iOS 환경, 테스트 함수만 등록');
        console.log('💡 [iOS Bridge] 테스트 함수: TEST_ENV(), TEST_HAPTIC(), TEST_GOOGLE()');
        console.log('💡 [iOS Bridge] FCM 디버그 함수: DEBUG_FCM_STATUS(), RESET_FCM_STATUS()');
    }
}, 1000);

window.iosBridge = {
    // 기존 메서드들...
    
    // 알림 관련 (로그인 전 차단)
    requestNotificationPermission() {
        if (!(window.__SMAP_PERM_ALLOW__)) {
            console.warn('[SMAP-PERM] ios-bridge requestNotificationPermission blocked until login');
            return;
        }
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