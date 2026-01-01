//
//  WebViewController.swift
//  smap
//
//  Created by Corp. Dmonster on 12/15/23.
//

import UIKit
import WebKit
import CoreMotion
import UserNotifications
import GoogleSignIn
import KakaoSDKCommon
import KakaoSDKAuth
import KakaoSDKUser
import CoreLocation

class WebViewController: UIViewController {
    
    // MARK: - Properties
    var webView: WKWebView!
    var activityIndicator: UIActivityIndicatorView!
    var refreshControl: UIRefreshControl!
    // 첫 로드 시 웹 내 "인증 실패" UI 노출 방지용 가드
    private var suppressAuthFailure: Bool = true
    
    // MARK: - 📍 위치 관련 프로퍼티
    private var locationManager: CLLocationManager?
    private var locationPrePromptShown: Bool = false
    private var motionPrePromptShown: Bool = false
    
    // MARK: - 🌐 URL 설정 (개발/프로덕션 환경 구분)
    private var webAppURL: String {
        #if DEBUG
        // 개발 환경: 운영 서버로 테스트 (햅틱 및 구글 로그인 테스트용)
        return "https://nextstep.smap.site"  // 운영 서버 테스트
        // return "http://localhost:3000"     // 로컬 개발 서버 (백업)
        #else
        // 프로덕션 환경: 항상 원격 서버 사용
        return "https://nextstep.smap.site"
        #endif
    }
    
    // 🔧 개발자용 URL 변경 함수 (런타임에서 변경 가능)
    private var customURL: String? = nil
    
    private func getWebAppURL() -> String {
        if let custom = customURL {
            print("🔧 [SMAP-URL] 커스텀 URL 사용: \(custom)")
            return custom
        }
        
        let url = webAppURL
        print("🌐 [SMAP-URL] 기본 URL 사용: \(url)")
        #if DEBUG
        if url.contains("localhost") {
            print("🛠️ [SMAP-URL] 로컬호스트 사용 중 - 연결 실패 시 원격 서버로 자동 전환")
            print("🛠️ [SMAP-URL] 수동 전환 함수:")
            print("   - SMAP_USE_REMOTE() : 원격 서버로 전환")
            print("   - SMAP_USE_LOCALHOST() : 로컬호스트로 전환")
        }
        #endif
        return url
    }
    
    // 🔧 런타임에서 URL 변경 (개발용)
    private func loadCustomURL(_ urlString: String) {
        customURL = urlString
        print("🔧 [SMAP-URL] URL 변경됨: \(urlString)")
        loadWebApp()
    }
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // 🚨 강제 빌드 트리거 변수 (Xcode가 파일 변경을 감지하도록)
        let forceBuildTrigger = "FORCE_BUILD_2025_08_07_USER_INFO_FIX_V1"
        
        // 🔥🔥🔥 빌드 확인 로그 (새로운 코드가 적용되었는지 확인용)
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        print("🚨 [SMAP-BUILD-CHECK] *** 2025.08.07 사용자 정보 처리 수정 버전 *** 🚨")
        print("🚨 [SMAP-BUILD-CHECK] 새로운 빌드가 적용되었습니다!")
        print("🚨 [SMAP-BUILD-CHECK] 사용자 정보 처리 문제 해결 버전")
        print("🚨 [SMAP-BUILD-CHECK] userInfo 메시지 처리 강화됨")
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        
        setupWebView()
        setupActivityIndicator()
        setupRefreshControl()
        setupNotificationObservers()
        
        // 📍 위치 추적 시스템 초기화
        setupLocationManager()
        
        // 🎮 햅틱 시스템 테스트 (디버그용)
        #if DEBUG
        testHapticSystem()
        #endif

        loadWebApp()

        // ✅ Utils에 WebView 등록 (FCM 메시지 전달용)
        Utils.shared.setWebView(webView)

        // ✅ FCM 메시지 NotificationCenter 관찰자 등록
        setupFCMMessageObserver()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)

        // FCM 메시지 NotificationCenter 관찰자 제거
        NotificationCenter.default.removeObserver(self, name: .fcmMessageReceived, object: nil)
        print("🔍 [FCM] FCM 메시지 NotificationCenter 관찰자 제거")
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        webView?.removeObserver(self, forKeyPath: "estimatedProgress")
    }
    
    // MARK: - Setup Methods
    private func setupWebView() {
        print("🛠️ [SMAP] WebView 설정 시작")
        
        let webConfiguration = WKWebViewConfiguration()
        
        // 🚀 SMAP 최적화 설정
        webConfiguration.allowsInlineMediaPlayback = true
        webConfiguration.mediaTypesRequiringUserActionForPlayback = []
        webConfiguration.allowsAirPlayForMediaPlayback = true
        webConfiguration.allowsPictureInPictureMediaPlayback = true
        
        // 📱 iOS 14+ 최적화
        if #available(iOS 14.0, *) {
            webConfiguration.defaultWebpagePreferences.allowsContentJavaScript = true
            webConfiguration.limitsNavigationsToAppBoundDomains = false
        }
        
        // 🎯 성능 최적화 설정
        webConfiguration.suppressesIncrementalRendering = false
        webConfiguration.allowsAirPlayForMediaPlayback = true
        
        // JavaScript 메시지 핸들러 (강화된 설정)
        let contentController = WKUserContentController()
        
        // 🚨 중요: 메시지 핸들러 등록 (여러 이름으로 등록하여 호환성 확보)
        contentController.add(self, name: "smapIos")    // 메인 핸들러
        contentController.add(self, name: "iosHandler") // 백업 핸들러
        contentController.add(self, name: "hapticHandler") // 햅틱 전용 핸들러
        contentController.add(self, name: "messageHandler") // 범용 핸들러
        contentController.add(self, name: "fcmHandler") // FCM 토큰 업데이트 전용 핸들러
        
        print("📱 [MessageHandler] 등록된 핸들러들:")
        print("   - smapIos (메인)")
        print("   - iosHandler (백업)")
        print("   - hapticHandler (햅틱 전용)")
        print("   - messageHandler (범용)")
        print("   - fcmHandler (FCM 토큰 업데이트)")
        
        // 핸들러 등록 확인을 위한 JavaScript 스크립트 (강화된 디버그용)
        let handlerCheckScript = """
            (function() {
                'use strict';
                
                // 즉시 핸들러 상태 확인
                function checkHandlers() {
                    console.log('🔍 [Handler Check] 핸들러 상태 확인 시작');
                    const webkit = window.webkit;
                    
                    if (!webkit) {
                        console.error('❌ [Handler Check] WebKit 객체 없음');
                        return false;
                    }
                    
                    if (!webkit.messageHandlers) {
                        console.error('❌ [Handler Check] messageHandlers 객체 없음');
                        return false;
                    }
                    
                    const handlers = Object.keys(webkit.messageHandlers);
                    console.log('✅ [Handler Check] 등록된 핸들러들:', handlers);
                    
                    // 각 핸들러 테스트
                    handlers.forEach(function(handlerName) {
                        try {
                            webkit.messageHandlers[handlerName].postMessage({
                                type: 'handlerTest',
                                handler: handlerName,
                                timestamp: Date.now(),
                                url: window.location.href
                            });
                            console.log('✅ [Handler Check] ' + handlerName + ' 테스트 성공');
                        } catch (error) {
                            console.error('❌ [Handler Check] ' + handlerName + ' 테스트 실패:', error);
                        }
                    });
                    
                    // 전역 함수로 등록 (웹에서 호출 가능)
                    window.SMAP_CHECK_NATIVE_HANDLERS = function() {
                        return {
                            hasWebKit: !!webkit,
                            hasMessageHandlers: !!webkit.messageHandlers,
                            handlers: handlers,
                            totalHandlers: handlers.length,
                            timestamp: new Date().toISOString()
                        };
                    };
                    
                    return handlers.length > 0;
                }
                
                // 즉시 실행
                checkHandlers();
                
                // 페이지 로드 완료 후 다시 확인
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', checkHandlers);
                } else {
                    setTimeout(checkHandlers, 100);
                }
                
                window.addEventListener('load', function() {
                    setTimeout(checkHandlers, 500);
                });
                
                console.log('🔍 [Handler Check] 핸들러 확인 스크립트 초기화 완료');
            })();
        """
        
        let handlerCheckUserScript = WKUserScript(source: handlerCheckScript, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        contentController.addUserScript(handlerCheckUserScript)
        
        // 🚀 SMAP 최적화 JavaScript 주입
        let optimizationScript = """
            (function() {
                console.log('🚀 [SMAP-JS] iOS WebView 최적화 스크립트 시작');
                
                // 1. User-Agent 감지 및 iOS 플래그 설정
                window.isSMAPiOS = true;
                window.SMAPVersion = '1.0';
                
                // 2. 콘솔 로그 iOS로 전송
                if (window.webkit && window.webkit.messageHandlers) {
                    const originalLog = console.log;
                    const originalError = console.error;
                    const originalWarn = console.warn;
                    
                    console.log = function(...args) {
                        originalLog.apply(console, args);
                        if (window.webkit.messageHandlers.consoleLog) {
                            window.webkit.messageHandlers.consoleLog.postMessage('[SMAP-JS] ' + args.join(' '));
                        }
                    };
                    
                    console.error = function(...args) {
                        originalError.apply(console, args);
                        if (window.webkit.messageHandlers.consoleError) {
                            window.webkit.messageHandlers.consoleError.postMessage('[SMAP-ERROR] ' + args.join(' '));
                        }
                    };
                    
                    console.warn = function(...args) {
                        originalWarn.apply(console, args);
                        if (window.webkit.messageHandlers.consoleWarn) {
                            window.webkit.messageHandlers.consoleWarn.postMessage('[SMAP-WARN] ' + args.join(' '));
                        }
                    };
                }
                
                // 3. 터치/스크롤 최적화
                document.addEventListener('touchstart', function() {}, {passive: true});
                document.addEventListener('touchmove', function() {}, {passive: true});
                
                // 4. iOS Safari 호환성 보장
                if (!window.requestIdleCallback) {
                    window.requestIdleCallback = function(cb) { return setTimeout(cb, 1); };
                    window.cancelIdleCallback = function(id) { clearTimeout(id); };
                }
                
                // 5. 로딩 완료 알림
                if (document.readyState === 'complete') {
                    console.log('✅ [SMAP-JS] 페이지 로딩 완료');
                } else {
                    window.addEventListener('load', function() {
                        console.log('✅ [SMAP-JS] 페이지 로딩 완료');
                    });
                }
                
                // 6. 햅틱 피드백 전역 함수 추가 (강화된 버전)
                window.smapHaptic = function(type) {
                    console.log('🎮 [SMAP-JS] 햅틱 요청 시작: ' + (type || 'medium'));
                    
                    if (!window.webkit) {
                        console.error('🎮 [SMAP-JS] WebKit 없음 - iOS 앱에서만 작동합니다');
                        return false;
                    }
                    
                    if (!window.webkit.messageHandlers) {
                        console.error('🎮 [SMAP-JS] messageHandlers 없음');
                        return false;
                    }
                    
                    if (!window.webkit.messageHandlers.smapIos) {
                        console.error('🎮 [SMAP-JS] smapIos 핸들러 없음');
                        console.log('🎮 [SMAP-JS] 사용 가능한 핸들러:', Object.keys(window.webkit.messageHandlers || {}));
                        return false;
                    }
                    
                    try {
                        const hapticMessage = {
                            type: 'haptic',
                            param: type || 'medium',
                            timestamp: Date.now(),
                            source: 'smapHaptic-function'
                        };
                        
                        window.webkit.messageHandlers.smapIos.postMessage(hapticMessage);
                        console.log('✅ [SMAP-JS] 햅틱 메시지 전송 성공:', hapticMessage);
                        return true;
                    } catch (error) {
                        console.error('❌ [SMAP-JS] 햅틱 메시지 전송 실패:', error);
                        return false;
                    }
                };
                
                // 햅틱 편의 함수들 (강화된 로그와 디버그 정보)
                window.hapticLight = function() { 
                    console.log('💡 [HAPTIC-JS] Light 햅틱 요청 (사이드바, 네비게이션)');
                    return window.smapHaptic('light'); 
                };
                window.hapticMedium = function() { 
                    console.log('🔷 [HAPTIC-JS] Medium 햅틱 요청 (버튼, 토글)');
                    return window.smapHaptic('medium'); 
                };
                window.hapticHeavy = function() { 
                    console.log('🔶 [HAPTIC-JS] Heavy 햅틱 요청 (중요 액션)');
                    return window.smapHaptic('heavy'); 
                };
                window.hapticSuccess = function() { 
                    console.log('✅ [HAPTIC-JS] Success 햅틱 요청 (완료, 성공)');
                    return window.smapHaptic('success'); 
                };
                window.hapticWarning = function() { 
                    console.log('⚠️ [HAPTIC-JS] Warning 햅틱 요청 (주의, 경고)');
                    return window.smapHaptic('warning'); 
                };
                window.hapticError = function() { 
                    console.log('❌ [HAPTIC-JS] Error 햅틱 요청 (오류, 실패)');
                    return window.smapHaptic('error'); 
                };
                
                // 7. FCM 토큰 업데이트 전역 함수 추가
                window.updateFCMToken = function() {
                    console.log('🔔 [FCM-JS] FCM 토큰 업데이트 요청 시작');
                    
                    if (!window.webkit) {
                        console.error('🔔 [FCM-JS] WebKit 없음 - iOS 앱에서만 작동합니다');
                        return false;
                    }
                    
                    if (!window.webkit.messageHandlers) {
                        console.error('🔔 [FCM-JS] messageHandlers 없음');
                        return false;
                    }
                    
                    if (!window.webkit.messageHandlers.fcmHandler) {
                        console.error('🔔 [FCM-JS] fcmHandler 없음');
                        console.log('🔔 [FCM-JS] 사용 가능한 핸들러:', Object.keys(window.webkit.messageHandlers || {}));
                        return false;
                    }
                    
                    try {
                        const fcmMessage = {
                            type: 'updateFCMToken',
                            param: 'manual',
                            timestamp: Date.now(),
                            source: 'updateFCMToken-function'
                        };
                        
                        window.webkit.messageHandlers.fcmHandler.postMessage(fcmMessage);
                        console.log('✅ [FCM-JS] FCM 토큰 업데이트 메시지 전송 성공:', fcmMessage);
                        return true;
                    } catch (error) {
                        console.error('❌ [FCM-JS] FCM 토큰 업데이트 메시지 전송 실패:', error);
                        return false;
                    }
                };
                
                // FCM 토큰 상태 확인 함수
                window.checkFCMTokenStatus = function() {
                    console.log('🔍 [FCM-JS] FCM 토큰 상태 확인 요청');
                    
                    if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.fcmHandler) {
                        console.error('🔍 [FCM-JS] fcmHandler를 사용할 수 없습니다');
                        return false;
                    }
                    
                    try {
                        const statusMessage = {
                            type: 'checkFCMTokenStatus',
                            param: 'status',
                            timestamp: Date.now(),
                            source: 'checkFCMTokenStatus-function'
                        };
                        
                        window.webkit.messageHandlers.fcmHandler.postMessage(statusMessage);
                        console.log('✅ [FCM-JS] FCM 토큰 상태 확인 메시지 전송 성공:', statusMessage);
                        return true;
                    } catch (error) {
                        console.error('❌ [FCM-JS] FCM 토큰 상태 확인 메시지 전송 실패:', error);
                        return false;
                    }
                };
                
                // 홈 사이드바 전용 햅틱 함수들 (SMAP-Home 전용)
                window.SMAP_HOME_SIDEBAR_OPEN = function() {
                    console.log('🏠🔷 [SMAP-HOME] 사이드바 열기 - Medium 햅틱');
                    return window.smapHaptic('medium');
                };
                window.SMAP_HOME_SIDEBAR_CLOSE = function() {
                    console.log('🏠💡 [SMAP-HOME] 사이드바 닫기 - Light 햅틱');
                    return window.smapHaptic('light');
                };
                
                // 개발자용 테스트 함수 (모든 햅틱 타입 순차 테스트)
                window.SMAP_TEST_ALL_HAPTICS_DEV = function() {
                    console.log('🧪 [DEV-TEST] 모든 햅틱 타입 테스트 시작');
                    const hapticTypes = [
                        {type: 'light', desc: '가벼운 터치', emoji: '💡'},
                        {type: 'medium', desc: '중간 터치', emoji: '🔷'},
                        {type: 'heavy', desc: '강한 터치', emoji: '🔶'},
                        {type: 'success', desc: '성공 알림', emoji: '✅'},
                        {type: 'warning', desc: '경고 알림', emoji: '⚠️'},
                        {type: 'error', desc: '오류 알림', emoji: '🚨'}
                    ];
                    
                    hapticTypes.forEach((haptic, index) => {
                        setTimeout(() => {
                            console.log(`🧪 [DEV-TEST] ${haptic.emoji} ${haptic.desc} (${haptic.type})`);
                            window.smapHaptic(haptic.type);
                        }, index * 1000);
                    });
                    
                    return true;
                };
                
                // 🔧 개발용 URL 변경 함수들
                window.SMAP_CHANGE_URL = function(newURL) {
                    console.log('🔧 [SMAP-URL] URL 변경 요청:', newURL);
                    if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.smapIos) {
                        console.error('🔧 [SMAP-URL] iOS 핸들러 없음');
                        return false;
                    }
                    
                    try {
                        window.webkit.messageHandlers.smapIos.postMessage({
                            type: 'changeURL',
                            url: newURL
                        });
                        return true;
                    } catch (error) {
                        console.error('🔧 [SMAP-URL] URL 변경 실패:', error);
                        return false;
                    }
                };
                
                // localhost 전환 편의 함수
                                  window.SMAP_USE_LOCALHOST = function() {
                      console.log('🔧 [SMAP-URL] localhost:3000으로 전환');
                      return window.SMAP_CHANGE_URL('http://localhost:3000');
                  };
                
                // 원격 서버 전환 편의 함수  
                window.SMAP_USE_REMOTE = function() {
                    console.log('🔧 [SMAP-URL] next.smap.site로 전환');
                    return window.SMAP_CHANGE_URL('https://nextstep.smap.site');
                };
                
                // 현재 URL 정보 조회
                window.SMAP_GET_URL_INFO = function() {
                    console.log('🔧 [SMAP-URL] 현재 URL 정보 조회');
                    if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.smapIos) {
                        console.error('🔧 [SMAP-URL] iOS 핸들러 없음');
                        return false;
                    }
                    
                    try {
                        window.webkit.messageHandlers.smapIos.postMessage({
                            type: 'getCurrentURL'
                        });
                        return true;
                    } catch (error) {
                        console.error('🔧 [SMAP-URL] URL 정보 조회 실패:', error);
                        return false;
                    }
                };
                
                // URL 정보 받기 콜백 (iOS에서 호출)
                window.handleCurrentURL = function(urlInfo) {
                    console.log('📤 [SMAP-URL] 현재 URL 정보:', urlInfo);
                    console.log('   - 현재 URL:', urlInfo.currentURL);
                    console.log('   - 커스텀 URL 사용:', urlInfo.isCustomURL);
                    console.log('   - 기본 URL:', urlInfo.webAppURL);
                };
                
                // 핸들러 상태 확인 함수
                window.SMAP_CHECK_HANDLERS = function() {
                    const webkit = window.webkit;
                    const status = {
                        hasWebKit: !!webkit,
                        hasMessageHandlers: !!webkit?.messageHandlers,
                        hasSmapIos: !!webkit?.messageHandlers?.smapIos,
                        hasIosHandler: !!webkit?.messageHandlers?.iosHandler,
                        availableHandlers: webkit?.messageHandlers ? Object.keys(webkit.messageHandlers) : [],
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent
                    };
                    
                    console.log('🔍 [SMAP-NATIVE-CHECK] 핸들러 상태:', status);
                    return status;
                };
                
                // 🚨 전역 JavaScript 에러 핸들러 추가
                window.addEventListener('error', function(event) {
                    const errorData = {
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno,
                        error: event.error ? event.error.toString() : null
                    };
                    
                    console.error('🚨 [Global Error] JavaScript 에러 감지:', errorData);
                    
                    // iOS로 에러 전송
                    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos) {
                        try {
                            window.webkit.messageHandlers.smapIos.postMessage({
                                type: 'jsError',
                                param: errorData,
                                timestamp: Date.now(),
                                url: window.location.href
                            });
                        } catch (sendError) {
                            console.error('🚨 [Global Error] iOS로 에러 전송 실패:', sendError);
                        }
                    }
                });
                
                // 🚨 Promise rejection 핸들러 추가
                window.addEventListener('unhandledrejection', function(event) {
                    const errorData = {
                        message: 'Unhandled Promise Rejection',
                        reason: event.reason ? event.reason.toString() : 'Unknown reason'
                    };
                    
                    console.error('🚨 [Promise Rejection] 처리되지 않은 Promise 거부:', errorData);
                    
                    // iOS로 에러 전송
                    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos) {
                        try {
                            window.webkit.messageHandlers.smapIos.postMessage({
                                type: 'jsError',
                                param: errorData,
                                timestamp: Date.now(),
                                url: window.location.href
                            });
                        } catch (sendError) {
                            console.error('🚨 [Promise Rejection] iOS로 에러 전송 실패:', sendError);
                        }
                    }
                });
                
                // 강제 햅틱 함수 (향상된 디버그용)
                window.SMAP_FORCE_HAPTIC = function(type) {
                    console.log('\\n' + '🚨'.repeat(50));
                    console.log('🚨 [SMAP-FORCE-HAPTIC] 강제 햅틱 시도 시작');
                    console.log('🚨 [SMAP-FORCE-HAPTIC] 요청 타입:', type || 'success');
                    console.log('🚨 [SMAP-FORCE-HAPTIC] 시간:', new Date().toLocaleTimeString());
                    console.log('🚨'.repeat(50));
                    
                    const webkit = window.webkit;
                    if (!webkit) {
                        console.error('❌ [SMAP-FORCE-HAPTIC] WebKit 없음 - iOS 앱이 아님');
                        return false;
                    }
                    
                    if (!webkit.messageHandlers) {
                        console.error('❌ [SMAP-FORCE-HAPTIC] messageHandlers 없음');
                        return false;
                    }
                    
                    const availableHandlers = Object.keys(webkit.messageHandlers || {});
                    console.log('🔍 [SMAP-FORCE-HAPTIC] 사용 가능한 핸들러들:', availableHandlers);
                    
                    if (!webkit.messageHandlers.smapIos) {
                        console.error('❌ [SMAP-FORCE-HAPTIC] smapIos 핸들러 없음');
                        console.log('💡 [SMAP-FORCE-HAPTIC] 다른 핸들러로 시도:', availableHandlers);
                        return false;
                    }
                    
                    try {
                        const forceMessage = {
                            type: 'haptic',
                            param: type || 'success',
                            source: 'force-haptic-enhanced',
                            timestamp: Date.now(),
                            userAgent: navigator.userAgent,
                            force: true
                        };
                        
                        console.log('📤 [SMAP-FORCE-HAPTIC] 전송할 메시지:', forceMessage);
                        webkit.messageHandlers.smapIos.postMessage(forceMessage);
                        console.log('✅ [SMAP-FORCE-HAPTIC] 메시지 전송 성공!');
                        console.log('🎉 [SMAP-FORCE-HAPTIC] 디바이스에서 진동을 확인하세요');
                        console.log('🚨'.repeat(50) + '\\n');
                        return true;
                    } catch (error) {
                        console.error('❌ [SMAP-FORCE-HAPTIC] 메시지 전송 실패:', error);
                        console.log('🚨'.repeat(50) + '\\n');
                        return false;
                    }
                };
                
                // 햅틱 테스트 시퀀스 함수
                window.SMAP_TEST_ALL_HAPTICS = function() {
                    console.log('🧪 [HAPTIC-TEST-ALL] 모든 햅틱 타입 테스트 시작');
                    const hapticTypes = ['light', 'medium', 'heavy', 'success', 'warning'];
                    
                    hapticTypes.forEach((type, index) => {
                        setTimeout(() => {
                            console.log(`🧪 [HAPTIC-TEST-ALL] [${index + 1}/${hapticTypes.length}] ${type} 테스트`);
                            window.SMAP_FORCE_HAPTIC(type);
                        }, index * 1000);
                    });
                    
                    setTimeout(() => {
                        console.log('✅ [HAPTIC-TEST-ALL] 모든 햅틱 테스트 완료!');
                    }, hapticTypes.length * 1000);
                };
                
                // 🌐 HTTP URL 변경 함수들 (Debug 모드 전용)
                window.SMAP_CHANGE_HTTP_URL = function(newURL) {
                    console.log('🔧 [SMAP-HTTP] HTTP URL 변경 요청:', newURL);
                    if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.smapIos) {
                        console.error('🔧 [SMAP-HTTP] iOS 핸들러 없음');
                        return false;
                    }
                    
                    try {
                        window.webkit.messageHandlers.smapIos.postMessage({
                            type: 'changeHttpURL',
                            param: newURL
                        });
                        console.log('✅ [SMAP-HTTP] HTTP URL 변경 요청 전송됨');
                        return true;
                    } catch (error) {
                        console.error('❌ [SMAP-HTTP] HTTP URL 변경 실패:', error);
                        return false;
                    }
                };
                
                window.SMAP_USE_LOCALHOST_HTTP = function() {
                    console.log('🏠 [SMAP-HTTP] localhost:3000으로 HTTP URL 전환');
                    return window.SMAP_CHANGE_HTTP_URL('http://localhost:3000/');
                };
                
                window.SMAP_USE_REMOTE_HTTP = function() {
                    console.log('🌐 [SMAP-HTTP] 원격 서버로 HTTP URL 전환');
                    return window.SMAP_CHANGE_HTTP_URL('https://nextstep.smap.site/');
                };
                
                window.SMAP_RESET_HTTP_URL = function() {
                    console.log('🔄 [SMAP-HTTP] HTTP URL 기본값 복원');
                    if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.smapIos) {
                        console.error('🔧 [SMAP-HTTP] iOS 핸들러 없음');
                        return false;
                    }
                    
                    try {
                        window.webkit.messageHandlers.smapIos.postMessage({
                            type: 'resetHttpURL'
                        });
                        console.log('✅ [SMAP-HTTP] HTTP URL 리셋 요청 전송됨');
                        return true;
                    } catch (error) {
                        console.error('❌ [SMAP-HTTP] HTTP URL 리셋 실패:', error);
                        return false;
                    }
                };
                
                window.SMAP_GET_HTTP_URL_INFO = function() {
                    console.log('📊 [SMAP-HTTP] HTTP URL 정보 조회');
                    if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.smapIos) {
                        console.error('🔧 [SMAP-HTTP] iOS 핸들러 없음');
                        return false;
                    }
                    
                    try {
                        window.webkit.messageHandlers.smapIos.postMessage({
                            type: 'getHttpURLInfo'
                        });
                        console.log('✅ [SMAP-HTTP] HTTP URL 정보 요청 전송됨');
                        return true;
                    } catch (error) {
                        console.error('❌ [SMAP-HTTP] HTTP URL 정보 조회 실패:', error);
                        return false;
                    }
                };
                
                console.log('🎮 [SMAP-JS] 햅틱 함수들 등록 완료');
                console.log('🔍 [SMAP-JS] 디버깅 함수들 등록 완료');
                console.log('✅ [SMAP-JS] iOS WebView 최적화 완료');
            })();
        """
        
        let userScript = WKUserScript(source: optimizationScript, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        contentController.addUserScript(userScript)

        // 🚫 초기 로딩 단계에서 "인증 실패" 문구/토스트/알림을 숨기는 가드 스크립트
        let authFailureGuardScript = """
            (function(){
                try {
                    window.__SMAP_SUPPRESS_AUTH_FAILURE__ = true;

                    function hideAuthFailureNodes(root){
                        if(!window.__SMAP_SUPPRESS_AUTH_FAILURE__) return;
                        const container = root || document;
                        const nodes = container.querySelectorAll('body *');
                        const regex = /(?:인증\s*실패|로그인\s*실패|인증\s*에러|Authentication\s*Failed|Unauthorized)/;
                        nodes.forEach(function(el){
                            try{
                                const txt = (el.innerText || '').trim();
                                if(txt && regex.test(txt)){
                                    el.style.display = 'none';
                                    el.setAttribute('data-smap-auth-guard', 'hidden');
                                }
                            }catch(_){/* noop */}
                        });
                    }

                    // alert 차단
                    const originalAlert = window.alert;
                    window.alert = function(msg){
                        if(window.__SMAP_SUPPRESS_AUTH_FAILURE__ && typeof msg === 'string' && /인증\s*실패|로그인\s*실패|인증\s*에러/i.test(msg)){
                            console.log('[SMAP-AUTH-GUARD] alert suppressed:', msg);
                            return; // 차단
                        }
                        return originalAlert.apply(window, arguments);
                    };

                    // Mutation 감시로 동적 DOM에도 적용
                    const observer = new MutationObserver(function(mutations){
                        if(!window.__SMAP_SUPPRESS_AUTH_FAILURE__) return;
                        mutations.forEach(function(m){
                            m.addedNodes && m.addedNodes.forEach(function(n){
                                if(n.nodeType === 1){ hideAuthFailureNodes(n); }
                            });
                        });
                    });
                    observer.observe(document.documentElement, {childList:true, subtree:true});

                    if(document.readyState === 'loading'){
                        document.addEventListener('DOMContentLoaded', function(){ hideAuthFailureNodes(); });
                    } else {
                        hideAuthFailureNodes();
                    }
                    window.addEventListener('load', function(){ hideAuthFailureNodes(); });

                    console.log('[SMAP-AUTH-GUARD] initialized');
                } catch(e) {
                    console.error('[SMAP-AUTH-GUARD] init error:', e);
                }
            })();
        """
        let authGuardUserScript = WKUserScript(source: authFailureGuardScript, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        contentController.addUserScript(authGuardUserScript)
        
        // 콘솔 로그 핸들러 추가
        contentController.add(self, name: "consoleLog")
        contentController.add(self, name: "consoleError")
        contentController.add(self, name: "consoleWarn")
        
        webConfiguration.userContentController = contentController
        
        // 쿠키 및 로컬 스토리지 설정
        webConfiguration.processPool = WKProcessPool()
        webConfiguration.websiteDataStore = WKWebsiteDataStore.default()
        
        // 🎯 사용자 에이전트 설정 (핵심 최적화!)
        webConfiguration.applicationNameForUserAgent = "SMAP-iOS-App/1.0"
        
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        
        // ✨ User-Agent 최적화 (가장 중요한 수정!)
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 SMAP-iOS/1.0"
        
        webView.navigationDelegate = self
        webView.uiDelegate = self
        
        // 🗺️ 지도 렌더링 강제 활성화
        webView.configuration.preferences.javaScriptEnabled = true
        webView.configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        webView.configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        webView.configuration.preferences.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true
        
        view.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // 진행률 모니터링
        webView.addObserver(self, forKeyPath: "estimatedProgress", options: .new, context: nil)
        
        // 🚀 WebView 캐시 최적화 적용
        configureWebViewOptimizations()
        
        // 🚀 SMAP 캐시 매니저 적용
        SMAPWebViewCacheManager.shared.configureCacheForWebView(webView)
        
        // 🗺️ 지도 렌더링 강제 활성화 스크립트 주입
        injectMapRenderingScript()
        
        print("✅ [SMAP] WebView 설정 완료")
    }
    
    // MARK: - 🗺️ 지도 렌더링 강제 활성화 JavaScript
    private func injectMapRenderingScript() {
        let mapRenderingScript = """
            (function() {
                'use strict';
                
                console.log('🗺️ [Map Rendering] 지도 렌더링 강제 활성화 스크립트 시작');
                
                // 1. 지도 컨테이너 강제 렌더링
                function forceMapRender() {
                    console.log('🗺️ [Map Rendering] 지도 강제 렌더링 시작');
                    
                    // Leaflet 지도 강제 렌더링
                    if (window.L && window.L.map) {
                        console.log('🗺️ [Map Rendering] Leaflet 감지됨 - 강제 렌더링 실행');
                        
                        // 모든 지도 인스턴스 강제 업데이트
                        if (window.smapMapInstances && window.smapMapInstances.length > 0) {
                            window.smapMapInstances.forEach(function(mapInstance, index) {
                                if (mapInstance && mapInstance.invalidateSize) {
                                    console.log('🗺️ [Map Rendering] 지도 인스턴스 ' + index + ' 강제 업데이트');
                                    mapInstance.invalidateSize();
                                    mapInstance.invalidateSize(true);
                                }
                            });
                        }
                        
                        // 전역 지도 객체 강제 업데이트
                        if (window.map) {
                            console.log('🗺️ [Map Rendering] 전역 지도 객체 강제 업데이트');
                            window.map.invalidateSize();
                            window.map.invalidateSize(true);
                        }
                    }
                    
                    // Google Maps 강제 렌더링
                    if (window.google && window.google.maps) {
                        console.log('🗺️ [Map Rendering] Google Maps 감지됨 - 강제 렌더링 실행');
                        
                        // Google Maps 인스턴스 강제 업데이트
                        if (window.googleMapsInstance) {
                            console.log('🗺️ [Map Rendering] Google Maps 인스턴스 강제 업데이트');
                            window.googleMapsInstance.setZoom(window.googleMapsInstance.getZoom());
                        }
                    }
                    
                    // 일반적인 지도 컨테이너 강제 리사이즈
                    const mapContainers = document.querySelectorAll('[id*="map"], [class*="map"], [id*="Map"], [class*="Map"]');
                    mapContainers.forEach(function(container, index) {
                        if (container && container.style) {
                            console.log('🗺️ [Map Rendering] 지도 컨테이너 ' + index + ' 강제 리사이즈');
                            container.style.display = 'none';
                            setTimeout(function() {
                                container.style.display = '';
                                // 강제 리플로우 트리거
                                container.offsetHeight;
                            }, 10);
                        }
                    });
                }
                
                // 2. 지도 렌더링 상태 확인
                function checkMapRendering() {
                    const mapElements = document.querySelectorAll('[id*="map"], [class*="map"], [id*="Map"], [class*="Map"]');
                    console.log('🗺️ [Map Rendering] 지도 요소 발견: ' + mapElements.length + '개');
                    
                    mapElements.forEach(function(element, index) {
                        const rect = element.getBoundingClientRect();
                        console.log('🗺️ [Map Rendering] 지도 요소 ' + index + ':', {
                            id: element.id,
                            className: element.className,
                            width: rect.width,
                            height: rect.height,
                            visible: rect.width > 0 && rect.height > 0
                        });
                    });
                }
                
                // 3. 지도 렌더링 강제 실행 함수들을 전역으로 등록
                window.SMAP_FORCE_MAP_RENDER = forceMapRender;
                window.SMAP_CHECK_MAP_RENDERING = checkMapRendering;
                
                // 4. 즉시 실행
                setTimeout(forceMapRender, 100);
                setTimeout(forceMapRender, 500);
                setTimeout(forceMapRender, 1000);
                setTimeout(forceMapRender, 2000);
                
                // 5. 페이지 로딩 완료 후 실행
                if (document.readyState === 'complete') {
                    forceMapRender();
                } else {
                    window.addEventListener('load', function() {
                        setTimeout(forceMapRender, 100);
                        setTimeout(forceMapRender, 500);
                    });
                }
                
                // 6. DOM 변경 감지하여 지도 렌더링 강제 실행
                const observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        if (mutation.type === 'childList' || mutation.type === 'attributes') {
                            const mapElements = mutation.target.querySelectorAll && mutation.target.querySelectorAll('[id*="map"], [class*="map"]');
                            if (mapElements && mapElements.length > 0) {
                                console.log('🗺️ [Map Rendering] DOM 변경 감지 - 지도 렌더링 강제 실행');
                                setTimeout(forceMapRender, 100);
                            }
                        }
                    });
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
                
                console.log('🗺️ [Map Rendering] 지도 렌더링 강제 활성화 스크립트 완료');
            })();
        """
        
        let mapRenderingUserScript = WKUserScript(source: mapRenderingScript, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
        contentController.addUserScript(mapRenderingUserScript)
        
        print("🗺️ [Map Rendering] 지도 렌더링 강제 활성화 스크립트 주입 완료")
    }
    
    // MARK: - 🚀 WebView 최적화 설정
    private func configureWebViewOptimizations() {
        // 스크롤 성능 최적화
        webView.scrollView.decelerationRate = UIScrollView.DecelerationRate.normal
        webView.scrollView.delaysContentTouches = false
        
        // iOS WebView 터치 최적화
        webView.scrollView.canCancelContentTouches = true
        
        // 메모리 압박 시 자동 정리 (쿠키/세션 보존)
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { _ in
            print("⚠️ [SMAP] 메모리 경고 수신, WebView 캐시 정리 (쿠키/세션 보존)")
            
            // ⚠️ 로그인 세션 유지를 위해 쿠키/세션은 삭제하지 않음
            // 캐시만 삭제 (diskCache, memoryCache, fetchCache)
            let cacheDataTypes: Set<String> = [
                WKWebsiteDataTypeDiskCache,
                WKWebsiteDataTypeMemoryCache,
                WKWebsiteDataTypeFetchCache,
                WKWebsiteDataTypeOfflineWebApplicationCache
            ]
            
            self.webView.configuration.websiteDataStore.removeData(
                ofTypes: cacheDataTypes,
                modifiedSince: Date().addingTimeInterval(-3600) // 1시간 전 캐시 삭제
            ) {
                print("✅ [SMAP] WebView 캐시 정리 완료 (쿠키/세션 보존됨)")
            }
        }
        
        print("🛠️ [SMAP] WebView 캐시 최적화 설정 완료")
    }
    
    private func setupActivityIndicator() {
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.center = view.center
        activityIndicator.hidesWhenStopped = true
        activityIndicator.color = .systemBlue
        view.addSubview(activityIndicator)
    }
    
    private func setupRefreshControl() {
        refreshControl = UIRefreshControl()
        refreshControl.addTarget(self, action: #selector(refreshWebView), for: .valueChanged)
        webView.scrollView.addSubview(refreshControl)
        webView.scrollView.bounces = true
    }
    
    private func setupNotificationObservers() {
        // 푸시 알림 수신
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePushNotification(_:)),
            name: Notification.Name("getPush"),
            object: nil
        )
        
        // 딥링크 수신
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDeepLink(_:)),
            name: Notification.Name("getDeepLink"),
            object: nil
        )
        
        // 앱 상태 변경
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppStateChange(_:)),
            name: Notification.Name("appStateChange"),
            object: nil
        )
        
        // FCM 토큰 업데이트
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleFCMTokenUpdate(_:)),
            name: Notification.Name("fcmTokenUpdated"),
            object: nil
        )
    }
    
    private func loadWebApp() {
        let urlString = getWebAppURL()
        guard let url = URL(string: urlString) else {
            showErrorAlert(message: "웹사이트 주소가 올바르지 않습니다: \(urlString)")
            return
        }
        
        var request = URLRequest(url: url)
        
        // 🔧 최적화된 헤더 설정
        request.setValue("SMAP-iOS-App/1.0", forHTTPHeaderField: "User-Agent")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        request.setValue("SMAP-iOS-WebView/1.0", forHTTPHeaderField: "X-Requested-With")
        request.setValue("same-origin", forHTTPHeaderField: "Sec-Fetch-Site")
        request.setValue("navigate", forHTTPHeaderField: "Sec-Fetch-Mode")
        request.setValue("document", forHTTPHeaderField: "Sec-Fetch-Dest")
        request.setValue("ko-KR,ko;q=0.9,en;q=0.8", forHTTPHeaderField: "Accept-Language")
        
        // �� SMAP 캐시 매니저로 요청 최적화
        SMAPWebViewCacheManager.shared.optimizeNetworkRequest(&request)
        
        // 캐시 정책 최적화
        request.cachePolicy = .useProtocolCachePolicy
        request.timeoutInterval = 30.0
        
        print("🌐 [SMAP] 웹사이트 로드 시작: \(urlString)")
        
        webView.load(request)
        activityIndicator.startAnimating()
        
        // 🗺️ 지도 렌더링 강제 실행 타이머 설정
        setupMapRenderingTimer()
    }
    
    // MARK: - 🗺️ 지도 렌더링 강제 실행 타이머
    private func setupMapRenderingTimer() {
        print("🗺️ [Map Rendering] 지도 렌더링 강제 실행 타이머 설정")
        
        // 페이지 로딩 완료 후 지도 렌더링 강제 실행
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.forceMapRenderingAfterLoad()
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
            self?.forceMapRenderingAfterLoad()
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
            self?.forceMapRenderingAfterLoad()
        }
    }
    
    // MARK: - 🗺️ 지도 렌더링 강제 실행 (페이지 로딩 완료 후)
    private func forceMapRenderingAfterLoad() {
        print("🗺️ [Map Rendering] 페이지 로딩 완료 - 지도 렌더링 강제 실행")
        
        let forceMapScript = """
            (function() {
                console.log('🗺️ [Map Rendering] iOS에서 지도 렌더링 강제 실행 시작');
                
                // 1. 즉시 실행
                if (window.SMAP_FORCE_MAP_RENDER) {
                    window.SMAP_FORCE_MAP_RENDER();
                }
                
                // 2. 지도 상태 확인
                if (window.SMAP_CHECK_MAP_RENDERING) {
                    window.SMAP_CHECK_MAP_RENDERING();
                }
                
                // 3. 추가 강제 렌더링 (지연 실행)
                setTimeout(function() {
                    if (window.SMAP_FORCE_MAP_RENDER) {
                        console.log('🗺️ [Map Rendering] 지연 실행 - 지도 강제 렌더링');
                        window.SMAP_FORCE_MAP_RENDER();
                    }
                }, 500);
                
                setTimeout(function() {
                    if (window.SMAP_FORCE_MAP_RENDER) {
                        console.log('🗺️ [Map Rendering] 지연 실행 2 - 지도 강제 렌더링');
                        window.SMAP_FORCE_MAP_RENDER();
                    }
                }, 1000);
                
                // 4. 지도 컨테이너 강제 리사이즈
                const mapContainers = document.querySelectorAll('[id*="map"], [class*="map"], [id*="Map"], [class*="Map"]');
                mapContainers.forEach(function(container, index) {
                    if (container && container.style) {
                        console.log('🗺️ [Map Rendering] 컨테이너 ' + index + ' 강제 리사이즈');
                        container.style.display = 'none';
                        setTimeout(function() {
                            container.style.display = '';
                            container.offsetHeight; // 강제 리플로우
                        }, 10);
                    }
                });
                
                console.log('🗺️ [Map Rendering] iOS 지도 렌더링 강제 실행 완료');
            })();
        """
        
        webView.evaluateJavaScript(forceMapScript) { result, error in
            if let error = error {
                print("❌ [Map Rendering] 지도 렌더링 강제 실행 실패: \(error.localizedDescription)")
            } else {
                print("✅ [Map Rendering] 지도 렌더링 강제 실행 성공")
            }
        }
    }
    
    private func checkNetworkAndReload() {
        // 네트워크 연결 상태 확인
        if !isNetworkAvailable() {
            showNoConnectionAlert()
        }
    }
    
    // MARK: - Actions
    @objc private func refreshWebView() {
        webView.reload()
        
        // 🗺️ 새로고침 후 지도 렌더링 강제 실행
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
            self?.forceMapRenderingAfterLoad()
        }
    }
    
    // MARK: - Notification Handlers
    @objc private func handlePushNotification(_ notification: Notification) {
        guard let userInfo = notification.userInfo else { return }
        
        let script = """
            if (window.handlePushNotification) {
                window.handlePushNotification(\(jsonString(from: userInfo)));
            }
        """
        
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
    
    @objc private func handleDeepLink(_ notification: Notification) {
        guard let userInfo = notification.userInfo else { return }
        
        let script = """
            if (window.handleDeepLink) {
                window.handleDeepLink(\(jsonString(from: userInfo)));
            }
        """
        
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
    
    @objc private func handleAppStateChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo else { return }
        
        let script = """
            if (window.handleAppStateChange) {
                window.handleAppStateChange(\(jsonString(from: userInfo)));
            }
        """
        
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
    
    @objc private func handleFCMTokenUpdate(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let token = userInfo["token"] as? String else { return }
        
        let script = """
            if (window.handleFCMTokenUpdate) {
                window.handleFCMTokenUpdate('\(token)');
            }
        """
        
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
    
    // MARK: - Helper Methods
    private func jsonString(from dictionary: [AnyHashable: Any]) -> String {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: dictionary, options: []),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return "{}"
        }
        return jsonString
    }
    
    private func isNetworkAvailable() -> Bool {
        // 간단한 네트워크 연결 확인 - 실제로는 Reachability 사용 권장
        return true
    }
    
    private func showErrorAlert(message: String) {
        let alert = UIAlertController(title: "오류", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "다시 시도", style: .default) { _ in
            self.loadWebApp()
        })
        alert.addAction(UIAlertAction(title: "취소", style: .cancel))
        present(alert, animated: true)
    }
    
    private func showNoConnectionAlert() {
        let alert = UIAlertController(
            title: "네트워크 연결 없음",
            message: "인터넷 연결을 확인한 후 다시 시도해주세요.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "다시 시도", style: .default) { _ in
            self.loadWebApp()
        })
        present(alert, animated: true)
    }
    
    // MARK: - KVO
    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        if keyPath == "estimatedProgress" {
            let progress = Float(webView.estimatedProgress)
            
            if progress >= 1.0 {
                activityIndicator.stopAnimating()
                refreshControl.endRefreshing()
            }
        }
    }
    
    // MARK: - Status Bar
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .default
    }
    
    // MARK: - 구글 로그인 처리
    private func handleGoogleLogin() {
        print("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥")
        print("🔥🔥🔥 [GOOGLE LOGIN] 네이티브 구글 로그인 시작!! 🔥🔥🔥")
        print("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥")
        
        // 구글 로그인 설정
        guard let presentingViewController = self else {
            print("❌ [GOOGLE LOGIN] presentingViewController 없음")
            sendGoogleLoginError("로그인 컨트롤러 초기화 실패")
            return
        }
        
        // 구글 로그인 실행
        GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController) { [weak self] (result, error) in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [GOOGLE LOGIN] 구글 로그인 실패: \(error)")
                    self?.sendGoogleLoginError("구글 로그인 실패: \(error.localizedDescription)")
                } else if let result = result {
                    print("✅ [GOOGLE LOGIN] 구글 로그인 성공")
                    self?.processGoogleLoginSuccess(result: result)
                }
            }
        }
    }
    
    private func processGoogleLoginSuccess(result: GIDSignInResult) {
        print("🔍 [GOOGLE LOGIN] 사용자 정보 처리 시작")
        
        let user = result.user
        let profile = user.profile
        
        // 구글 사용자 정보 구성
        let googleData: [String: Any] = [
            "credential": user.idToken?.tokenString ?? "",
            "user": [
                "email": profile?.email ?? "",
                "name": profile?.name ?? "",
                "nickname": profile?.givenName ?? profile?.name ?? "",
                "given_name": profile?.givenName ?? "",
                "family_name": profile?.familyName ?? "",
                "profile_image": profile?.imageURL(withDimension: 150)?.absoluteString ?? "",
                "google_id": user.userID ?? ""
            ]
        ]
        
        print("✅ [GOOGLE LOGIN] 구글 사용자 정보 구성 완료:", googleData)
        sendGoogleLoginSuccess(googleData: googleData)
    }
    
    private func sendGoogleLoginSuccess(googleData: [String: Any]) {
        // JSON 데이터를 안전하게 문자열로 변환
        guard let jsonData = try? JSONSerialization.data(withJSONObject: googleData, options: []),
              let googleDataJson = String(data: jsonData, encoding: .utf8) else {
            sendGoogleLoginError("구글 사용자 정보 직렬화 실패")
            return
        }
        
        let script = """
            try {
                console.log('🔍 [GOOGLE LOGIN] iOS에서 구글 로그인 성공 콜백 호출 시작');
                
                // handleGoogleLoginResult 함수 호출
                if (typeof window.handleGoogleLoginResult === 'function') {
                    console.log('🔍 [GOOGLE LOGIN] handleGoogleLoginResult 호출');
                    window.handleGoogleLoginResult(\(googleDataJson));
                    console.log('✅ [GOOGLE LOGIN] handleGoogleLoginResult 호출 완료');
                    
                } else {
                    console.warn('⚠️ [GOOGLE LOGIN] handleGoogleLoginResult 함수가 정의되지 않음');
                    
                    // 전역 변수에 저장해서 웹에서 확인 가능하게 함
                    window.__NATIVE_GOOGLE_LOGIN_DATA__ = \(googleDataJson);
                    console.log('✅ [GOOGLE LOGIN] 전역 변수에 데이터 저장 완료');
                }
            } catch (error) {
                console.error('❌ [GOOGLE LOGIN] 구글 로그인 성공 콜백 오류:', error);
            }
        """
        
        webView.evaluateJavaScript(script) { [weak self] (result, error) in
            if let error = error {
                print("❌ [GOOGLE LOGIN] JavaScript 실행 오류: \(error)")
            } else {
                print("✅ [GOOGLE LOGIN] 구글 로그인 성공 콜백 실행 완료")
            }
        }
    }
    
    private func sendGoogleLoginError(_ message: String) {
        let errorData: [String: Any] = [
            "error": message,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: errorData, options: []),
              let errorDataJson = String(data: jsonData, encoding: .utf8) else {
            return
        }
        
        let script = """
            try {
                console.error('❌ [GOOGLE LOGIN] iOS에서 구글 로그인 오류 콜백 호출');
                
                if (typeof window.handleGoogleLoginError === 'function') {
                    window.handleGoogleLoginError(\(errorDataJson));
                } else {
                    console.error('⚠️ [GOOGLE LOGIN] handleGoogleLoginError 함수가 정의되지 않음');
                    window.__NATIVE_GOOGLE_LOGIN_ERROR__ = \(errorDataJson);
                }
            } catch (error) {
                console.error('❌ [GOOGLE LOGIN] 구글 로그인 오류 콜백 실행 실패:', error);
            }
        """
        
        webView.evaluateJavaScript(script) { [weak self] (result, error) in
            if let error = error {
                print("❌ [GOOGLE LOGIN] JavaScript 오류 콜백 실행 실패: \(error)")
            }
        }
    }
    
    // MARK: - 카카오 로그인 처리
    private func handleKakaoLogin() {
        print("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥")
        print("🔥🔥🔥 [KAKAO LOGIN] 네이티브 카카오 로그인 시작!! 🔥🔥🔥")
        print("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥")
        
        if UserApi.isKakaoTalkLoginAvailable() {
            // 카카오톡 앱이 설치되어 있는 경우
            print("💬 [KAKAO LOGIN] 카카오톡 앱 로그인 시도")
            UserApi.shared.loginWithKakaoTalk { [weak self] (oauthToken, error) in
                DispatchQueue.main.async {
                    if let error = error {
                        print("❌ [KAKAO LOGIN] 카카오톡 로그인 실패: \(error)")
                        self?.sendKakaoLoginError("카카오톡 로그인 실패: \(error.localizedDescription)")
                    } else if let oauthToken = oauthToken {
                        print("✅ [KAKAO LOGIN] 카카오톡 로그인 성공")
                        self?.processKakaoLoginSuccess(oauthToken: oauthToken)
                    }
                }
            }
        } else {
            // 카카오톡 앱이 없는 경우 웹 로그인
            print("💬 [KAKAO LOGIN] 카카오 웹 로그인 시도")
            UserApi.shared.loginWithKakaoAccount { [weak self] (oauthToken, error) in
                DispatchQueue.main.async {
                    if let error = error {
                        print("❌ [KAKAO LOGIN] 카카오 웹 로그인 실패: \(error)")
                        self?.sendKakaoLoginError("카카오 웹 로그인 실패: \(error.localizedDescription)")
                    } else if let oauthToken = oauthToken {
                        print("✅ [KAKAO LOGIN] 카카오 웹 로그인 성공")
                        self?.processKakaoLoginSuccess(oauthToken: oauthToken)
                    }
                }
            }
        }
    }
    
    private func processKakaoLoginSuccess(oauthToken: OAuthToken) {
        print("💬 [KAKAO LOGIN] 사용자 정보 조회 시작")
        
        UserApi.shared.me { [weak self] (user, error) in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [KAKAO LOGIN] 사용자 정보 조회 실패: \(error)")
                    self?.sendKakaoLoginError("사용자 정보 조회 실패: \(error.localizedDescription)")
                } else if let user = user {
                    print("✅ [KAKAO LOGIN] 사용자 정보 조회 성공")
                    self?.sendKakaoLoginSuccess(user: user, oauthToken: oauthToken)
                }
            }
        }
    }
    
    private func sendKakaoLoginSuccess(user: User, oauthToken: OAuthToken) {
        let userInfo: [String: Any] = [
            "id": user.id,
            "email": user.kakaoAccount?.email ?? "",
            "nickname": user.kakaoAccount?.profile?.nickname ?? "",
            "profileImageUrl": user.kakaoAccount?.profile?.profileImageUrl?.absoluteString ?? "",
            "thumbnailImageUrl": user.kakaoAccount?.profile?.thumbnailImageUrl?.absoluteString ?? "",
            "accessToken": oauthToken.accessToken,
            "refreshToken": oauthToken.refreshToken ?? "",
            "expiresIn": oauthToken.expiredAt.timeIntervalSince1970
        ]
        
        // JSON 데이터를 안전하게 문자열로 변환
        guard let jsonData = try? JSONSerialization.data(withJSONObject: userInfo, options: []),
              let userInfoJson = String(data: jsonData, encoding: .utf8) else {
            sendKakaoLoginError("사용자 정보 직렬화 실패")
            return
        }
        
        let script = """
            try {
                console.log('💬 [KAKAO LOGIN] iOS에서 카카오 로그인 성공 콜백 호출 시작');
                
                // 새로운 onNativeKakaoLoginSuccess 콜백 우선 시도
                if (typeof window.onNativeKakaoLoginSuccess === 'function') {
                    console.log('💬 [KAKAO LOGIN] onNativeKakaoLoginSuccess 호출');
                    window.onNativeKakaoLoginSuccess(\(userInfoJson));
                    console.log('✅ [KAKAO LOGIN] onNativeKakaoLoginSuccess 호출 완료');
                    
                } else if (typeof window.kakaoLoginSuccess === 'function') {
                    // 기존 콜백도 호환성 유지
                    window.kakaoLoginSuccess(\(userInfoJson));
                    console.log('💬 [KAKAO LOGIN] kakaoLoginSuccess 호출 완료 (Legacy)');
                    
                } else {
                    console.warn('⚠️ [KAKAO LOGIN] 카카오 로그인 성공 콜백 함수가 정의되지 않음');
                    console.warn('   - window.onNativeKakaoLoginSuccess: 없음');
                    console.warn('   - window.kakaoLoginSuccess: 없음');
                    
                    // 전역 변수에 저장해서 웹에서 확인 가능하게 함
                    window.__NATIVE_KAKAO_LOGIN_DATA__ = \(userInfoJson);
                    console.log('✅ [KAKAO LOGIN] 전역 변수에 데이터 저장 완료');
                }
            } catch (error) {
                console.error('❌ [KAKAO LOGIN] 카카오 로그인 성공 콜백 오류:', error);
            }
        """
        
        webView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("❌ [KAKAO LOGIN] JavaScript 실행 실패: \(error)")
            } else {
                print("✅ [KAKAO LOGIN] JavaScript 실행 성공")
            }
        }
        
        print("💬 [KAKAO LOGIN] 카카오 로그인 성공 결과 전달 완료")
    }
    
    private func sendKakaoLoginError(_ message: String) {
        let errorInfo: [String: Any] = [
            "message": message,
            "source": "ios_native"
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: errorInfo, options: []),
              let errorInfoJson = String(data: jsonData, encoding: .utf8) else {
            print("❌ [KAKAO LOGIN] 에러 정보 직렬화 실패")
            return
        }
        
        let script = """
            try {
                console.log('❌ [KAKAO LOGIN] iOS에서 카카오 로그인 에러 콜백 호출 시작');
                
                // 새로운 onNativeKakaoLoginError 콜백 우선 시도
                if (typeof window.onNativeKakaoLoginError === 'function') {
                    console.log('❌ [KAKAO LOGIN] onNativeKakaoLoginError 호출');
                    window.onNativeKakaoLoginError(\(errorInfoJson));
                    console.log('✅ [KAKAO LOGIN] onNativeKakaoLoginError 호출 완료');
                    
                } else if (typeof window.kakaoLoginError === 'function') {
                    // 기존 콜백도 호환성 유지
                    window.kakaoLoginError('\(message)');
                    console.log('❌ [KAKAO LOGIN] kakaoLoginError 호출 완료 (Legacy)');
                    
                } else {
                    console.warn('⚠️ [KAKAO LOGIN] 카카오 로그인 에러 콜백 함수가 정의되지 않음');
                    console.warn('   - window.onNativeKakaoLoginError: 없음');
                    console.warn('   - window.kakaoLoginError: 없음');
                }
            } catch (error) {
                console.error('❌ [KAKAO LOGIN] 카카오 로그인 에러 콜백 오류:', error);
            }
        """
        
        webView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("❌ [KAKAO LOGIN] JavaScript 실행 실패: \(error)")
            } else {
                print("✅ [KAKAO LOGIN] JavaScript 실행 성공")
            }
        }
        
        print("❌ [KAKAO LOGIN] 카카오 로그인 에러 전달 완료: \(message)")
    }
    
    // MARK: - 햅틱 피드백 처리
    private func handleHapticFeedback(type: String) {
        print("🎮 [HAPTIC] 햅틱 피드백 실행: \(type)")
        
        DispatchQueue.main.async {
            switch type.lowercased() {
            case "light":
                let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                impactFeedback.impactOccurred()
                print("🎮 [HAPTIC] Light 햅틱 실행 완료")
                
            case "medium":
                let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
                impactFeedback.impactOccurred()
                print("🎮 [HAPTIC] Medium 햅틱 실행 완료")
                
            case "heavy":
                let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
                impactFeedback.impactOccurred()
                print("🎮 [HAPTIC] Heavy 햅틱 실행 완료")
                
            case "success":
                let notificationFeedback = UINotificationFeedbackGenerator()
                notificationFeedback.notificationOccurred(.success)
                print("🎮 [HAPTIC] Success 햅틱 실행 완료")
                
            case "warning":
                let notificationFeedback = UINotificationFeedbackGenerator()
                notificationFeedback.notificationOccurred(.warning)
                print("🎮 [HAPTIC] Warning 햅틱 실행 완료")
                
            case "error":
                let notificationFeedback = UINotificationFeedbackGenerator()
                notificationFeedback.notificationOccurred(.error)
                print("🎮 [HAPTIC] Error 햅틱 실행 완료")
                
            default:
                let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
                impactFeedback.impactOccurred()
                print("🎮 [HAPTIC] Default(Medium) 햅틱 실행 완료")
            }
        }
    }
    
    // MARK: - 🔔 FCM 토큰 관련 핸들러
    
    private func handleFCMTokenUpdate() {
        print("🔔 [FCM] FCM 토큰 업데이트 핸들러 시작")

        // 로그인 상태 확인 - 로그인 전에는 FCM 토큰 등록하지 않음
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in")
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx")

        if !isLoggedIn || mtIdx == nil || mtIdx!.isEmpty {
            print("⚠️ [FCM] 로그인 상태가 아님 - FCM 토큰 등록 건너뜀")
            print("   - isLoggedIn: \(isLoggedIn)")
            print("   - mtIdx: \(mtIdx ?? "nil")")

            // 웹뷰에 로그인 필요 알림 전송
            let loginRequiredScript = """
                console.log('⚠️ [iOS-FCM] 로그인 필요 - FCM 토큰 등록 건너뜀');
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('ios-fcm-login-required', {
                        detail: {
                            message: '로그인이 필요합니다.',
                            timestamp: new Date().toISOString()
                        }
                    }));
                }
            """

            DispatchQueue.main.async {
                self.webView?.evaluateJavaScript(loginRequiredScript) { result, error in
                    if let error = error {
                        print("❌ [FCM] 로그인 필요 알림 전송 실패: \(error)")
                    } else {
                        print("✅ [FCM] 웹뷰에 로그인 필요 알림 전송")
                    }
                }
            }
            return
        }

        print("✅ [FCM] 로그인 상태 확인 통과 - FCM 토큰 업데이트 진행")
        print("   - mtIdx: \(mtIdx!)")

        // AppDelegate의 FCM 토큰 업데이트 함수 호출
        if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
            appDelegate.updateFCMTokenManually()
            print("✅ [FCM] AppDelegate FCM 토큰 업데이트 함수 호출 완료")
        } else {
            print("❌ [FCM] AppDelegate를 찾을 수 없음")
        }
        
        // 웹뷰로 확인 응답 전송
        let confirmationScript = """
            console.log('🔔 [iOS-FCM] FCM 토큰 업데이트 요청 처리 완료:', {
                timestamp: new Date().toISOString()
            });
            
            // 전역 이벤트 발생
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('ios-fcm-token-update', {
                    detail: { 
                        success: true,
                        timestamp: new Date().toISOString()
                    }
                }));
            }
        """
        
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(confirmationScript) { result, error in
                if let error = error {
                    print("❌ [FCM] 웹뷰 FCM 토큰 업데이트 확인 스크립트 실행 실패: \(error)")
                } else {
                    print("✅ [FCM] 웹뷰에 FCM 토큰 업데이트 완료 알림")
                }
            }
        }
    }
    
    private func handleFCMTokenStatusCheck() {
        print("🔍 [FCM] FCM 토큰 상태 확인 핸들러 시작")

        // 로그인 상태 확인 - 로그인 전에는 FCM 토큰 상태 확인하지 않음
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in")
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx")

        if !isLoggedIn || mtIdx == nil || mtIdx!.isEmpty {
            print("⚠️ [FCM] 로그인 상태가 아님 - FCM 토큰 상태 확인 건너뜀")
            print("   - isLoggedIn: \(isLoggedIn)")
            print("   - mtIdx: \(mtIdx ?? "nil")")

            // 웹뷰에 로그인 필요 알림 전송
            let loginRequiredScript = """
                console.log('⚠️ [iOS-FCM] 로그인 필요 - FCM 토큰 상태 확인 건너뜀');
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('ios-fcm-login-required', {
                        detail: {
                            message: '로그인이 필요합니다.',
                            timestamp: new Date().toISOString()
                        }
                    }));
                }
            """

            DispatchQueue.main.async {
                self.webView?.evaluateJavaScript(loginRequiredScript) { result, error in
                    if let error = error {
                        print("❌ [FCM] 로그인 필요 알림 전송 실패: \(error)")
                    } else {
                        print("✅ [FCM] 웹뷰에 로그인 필요 알림 전송")
                    }
                }
            }
            return
        }

        print("✅ [FCM] 로그인 상태 확인 통과 - FCM 토큰 상태 확인 진행")
        print("   - mtIdx: \(mtIdx!)")

        // AppDelegate의 FCM 토큰 상태 확인 함수 호출
        if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
            appDelegate.checkCurrentFCMTokenStatus()
            print("✅ [FCM] AppDelegate FCM 토큰 상태 확인 함수 호출 완료")
        } else {
            print("❌ [FCM] AppDelegate를 찾을 수 없음")
        }
        
        // 웹뷰로 확인 응답 전송
        let confirmationScript = """
            console.log('🔍 [iOS-FCM] FCM 토큰 상태 확인 요청 처리 완료:', {
                timestamp: new Date().toISOString()
            });
            
            // 전역 이벤트 발생
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('ios-fcm-token-status-check', {
                    detail: { 
                        success: true,
                        timestamp: new Date().toISOString()
                    }
                }));
            }
        """
        
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(confirmationScript) { result, error in
                if let error = error {
                    print("❌ [FCM] 웹뷰 FCM 토큰 상태 확인 스크립트 실행 실패: \(error)")
                } else {
                    print("✅ [FCM] 웹뷰에 FCM 토큰 상태 확인 완료 알림")
                }
            }
        }
    }

    // MARK: - FCM 메시지 처리 (NotificationCenter 방식)

    /// FCM 메시지 NotificationCenter 관찰자 설정
    private func setupFCMMessageObserver() {
        print("🔍 [FCM] FCM 메시지 NotificationCenter 관찰자 설정")

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleFCMMessageNotification(_:)),
            name: .fcmMessageReceived,
            object: nil
        )
    }

    /// FCM 메시지 NotificationCenter 핸들러
    @objc private func handleFCMMessageNotification(_ notification: Notification) {
        print("📨 [FCM] NotificationCenter를 통해 FCM 메시지 수신")

        guard let messageData = notification.userInfo else {
            print("⚠️ [FCM] FCM 메시지 데이터가 없음")
            return
        }

        // FCM 메시지를 웹뷰로 전달
        sendFCMMessageToWebView(messageData)
    }

    /// FCM 메시지를 웹뷰로 전달
    private func sendFCMMessageToWebView(_ messageData: [AnyHashable: Any]) {
        print("📨 [FCM] 웹뷰로 FCM 메시지 전달 시작")

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: messageData, options: [])
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                let script = "window.postMessage({type: 'fcm_message', data: \(jsonString)}, '*');"

                DispatchQueue.main.async {
                    self.webView?.evaluateJavaScript(script) { result, error in
                        if let error = error {
                            print("❌ [FCM] 웹뷰 메시지 전달 실패: \(error)")
                        } else {
                            print("✅ [FCM] 웹뷰 메시지 전달 성공")
                        }
                    }
                }
            }
        } catch {
            print("❌ [FCM] FCM 메시지 JSON 변환 실패: \(error)")
        }
    }
}

// MARK: - WKScriptMessageHandler
extension WebViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        print("🚨 [MESSAGE-HANDLER-2025-08-07] 새로운 빌드에서 메시지 수신!! 🚨")
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        print("📨 [MessageHandler] 메시지 수신: \(message.name)")
        print("📦 [MessageHandler] 메시지 내용: \(message.body)")
        print("🔍 [MessageHandler] 메시지 타입: \(type(of: message.body))")
        print("💫 [MessageHandler] 처리 시작...")
        
        // 🚨 모든 등록된 핸들러 이름을 처리
        let validHandlerNames = ["smapIos", "iosHandler", "hapticHandler", "messageHandler", "consoleLog", "consoleError", "consoleWarn", "fcmHandler"]
        
        print("🔍 [MessageHandler] 핸들러 이름 검증 중...")
        guard validHandlerNames.contains(message.name) else {
            print("⚠️ [MessageHandler] 유효하지 않은 핸들러 이름: \(message.name)")
            print("⚠️ [MessageHandler] 유효한 핸들러들: \(validHandlerNames)")
            return
        }
        print("✅ [MessageHandler] 핸들러 이름 검증 통과: \(message.name)")
        
        // 🚨 콘솔 메시지 핸들러 (특수 처리)
        if message.name == "consoleLog" || message.name == "consoleError" || message.name == "consoleWarn" {
            let logMessage = message.body as? String ?? "\(message.body)"
            let logType = message.name.replacingOccurrences(of: "console", with: "").uppercased()
            print("📝 [CONSOLE \(logType)] \(logMessage)")
            return
        }
        
        print("🔍 [MessageHandler] 메시지 본문 파싱 시도...")
        guard let messageBody = message.body as? [String: Any] else {
            print("⚠️ [MessageHandler] 메시지 본문을 Dictionary로 변환 실패")
            print("⚠️ [MessageHandler] 원본 메시지: \(message.body)")
            print("⚠️ [MessageHandler] 메시지 타입: \(type(of: message.body))")
            return
        }
        print("✅ [MessageHandler] 메시지 파싱 성공: \(messageBody)")
        
        print("🔍 [MessageHandler] 액션 추출 시도...")
        print("🔍 [MessageHandler] messageBody 전체: \(messageBody)")
        print("🔍 [MessageHandler] messageBody.keys: \(messageBody.keys)")
        
        // 웹 앱에서 사용하는 형식 (type, param) 처리
        var action: String?
        var parameters: [String: Any] = [:]
        
        if let type = messageBody["type"] as? String {
            // 웹 앱 형식: { type: "userInfo", param: { mt_idx: 1186, ... } }
            print("✅ [MessageHandler] 웹 앱 형식 감지 - type: \(type)")
            action = type
            
            // param을 parameters에 저장
            if let param = messageBody["param"] {
                print("🔍 [MessageHandler] param 발견: \(param)")
                print("🔍 [MessageHandler] param 타입: \(type(of: param))")
                parameters["param"] = param
            } else {
                print("⚠️ [MessageHandler] param이 없음")
            }
            
            // 전체 messageBody도 parameters에 복사 (호환성)
            parameters.merge(messageBody) { current, _ in current }
            
        } else if let actionValue = messageBody["action"] as? String {
            // 기존 형식: { action: "kakaoLogin", ... }
            print("✅ [MessageHandler] 기존 형식 감지 - action: \(actionValue)")
            action = actionValue
            parameters = messageBody
        }
        
        print("🔍 [MessageHandler] 최종 parameters: \(parameters)")
        
        guard let actionName = action else {
            print("⚠️ [MessageHandler] 액션 추출 실패 - 알 수 없는 메시지 형식: \(messageBody)")
            return
        }
        
        print("📱 [MessageHandler] 액션 추출 성공: \(actionName)")
        print("🚀 [MessageHandler] Switch문 진입...")
        
        // 🚨 중요: Switch문 전 로깅 추가
        print("🔍 [MessageHandler] Switch문 실행 - actionName: '\(actionName)'")
        print("🔍 [MessageHandler] actionName 타입: \(type(of: actionName))")
        print("🔍 [MessageHandler] actionName 길이: \(actionName.count)")
        
        switch actionName {
        case "userInfo":
            print("🔥🔥🔥 [USER INFO] Switch에서 userInfo case 매칭!! 🔥🔥🔥")
            // 웹뷰에서 보내는 실제 구조: {type: "userInfo", userInfo: {...}}
            if let userInfo = parameters["userInfo"] as? [String: Any] {
                print("✅ [USER INFO] userInfo 파싱 성공: \(userInfo)")
                handleUserInfo(param: userInfo)
            } else if let param = parameters["param"] as? [String: Any] {
                // 기존 방식도 지원 (하위 호환성)
                print("✅ [USER INFO] param 파싱 성공 (기존 방식): \(param)")
                handleUserInfo(param: param)
            } else {
                print("❌ [USER INFO] userInfo/param 파싱 실패")
                print("❌ [USER INFO] parameters: \(parameters)")
                print("❌ [USER INFO] userInfo 타입: \(type(of: parameters["userInfo"]))")
                print("❌ [USER INFO] param 타입: \(type(of: parameters["param"]))")
                print("💡 [USER INFO] 웹뷰에서 보내는 메시지 구조를 확인해주세요")
                print("💡 [USER INFO] 예상 구조: {type: 'userInfo', userInfo: {isLoggedIn: 1, mt_idx: 1186, mt_name: 'jin'}}")
            }
            break
        case "userLogout":
            print("👤 [USER LOGOUT] Switch에서 userLogout case 매칭!")
            handleUserLogout()
            break
        case "kakaoLogin":
            print("🚨🚨🚨 [KAKAO LOGIN] 카카오 로그인 요청 수신!! 🚨🚨🚨")
            print("🚨🚨🚨 [KAKAO LOGIN] handleKakaoLogin() 함수 호출 시작!! 🚨🚨🚨")
            
            // 테스트용 햅틱
            DispatchQueue.main.async {
                let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
                impactFeedback.impactOccurred()
                print("🚨🚨🚨 [KAKAO LOGIN] 테스트 햅틱 실행!! 🚨🚨🚨")
            }
            
            handleKakaoLogin()
            print("🚨🚨🚨 [KAKAO LOGIN] handleKakaoLogin() 함수 호출 완료!! 🚨🚨🚨")
        case "googleLogin":
            print("🔥🔥🔥 [GOOGLE LOGIN] 구글 로그인 요청 수신!! 🔥🔥🔥")
            print("🔥🔥🔥 [GOOGLE LOGIN] handleGoogleLogin() 함수 호출 시작!! 🔥🔥🔥")
            
            // 테스트용 햅틱
            DispatchQueue.main.async {
                let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
                impactFeedback.impactOccurred()
                print("🔥🔥🔥 [GOOGLE LOGIN] 테스트 햅틱 실행!! 🔥🔥🔥")
            }
            
            handleGoogleLogin()
            print("🔥🔥🔥 [GOOGLE LOGIN] handleGoogleLogin() 함수 호출 완료!! 🔥🔥🔥")
        case "googleSignIn":
            print("🔍 [GOOGLE LOGIN] 구글 로그인 요청 수신 (Legacy)")
            // 기존 구글 로그인 처리 (이미 구현되어 있음)
            break
        case "appleSignIn":
            print("🍎 [APPLE LOGIN] 애플 로그인 요청 수신")
            print("🍎 [APPLE LOGIN] 애플 로그인은 웹에서 직접 처리됨")
            // 애플 로그인은 웹에서 직접 처리하므로 여기서는 로그만 출력
            break
        case "haptic", "hapticFeedback":
            print("🎮 [HAPTIC] 햅틱 피드백 요청 수신")
            let hapticType = parameters["param"] as? String ?? "medium"
            handleHapticFeedback(type: hapticType)
            break
        case "handlerTest":
            print("🔍 [HANDLER TEST] 핸들러 테스트 메시지 수신: \(message.name)")
            print("🔍 [HANDLER TEST] 테스트 성공 - 핸들러가 정상 작동 중")
            break
        case "jsError":
            if let errorParam = parameters["param"] as? String {
                print("🚨 [JS ERROR] JavaScript 에러 발생: \(errorParam)")
            } else if let errorParam = parameters["param"] as? [String: Any] {
                print("🚨 [JS ERROR] JavaScript 에러 상세:", errorParam)
            } else {
                print("🚨 [JS ERROR] JavaScript 에러 (상세 정보 없음): \(parameters)")
            }
            break
        case "updateFCMToken":
            print("🔔 [FCM] FCM 토큰 업데이트 요청 수신")
            handleFCMTokenUpdate()
            break
        case "checkFCMTokenStatus":
            print("🔍 [FCM] FCM 토큰 상태 확인 요청 수신")
            handleFCMTokenStatusCheck()
            break
        case "navigateToSchedule":
            print("📅 [NAVIGATION] 일정 화면으로 이동 요청 수신")
            NotificationCenter.default.post(name: NSNotification.Name("navigateToSchedule"), object: nil)
            break
        default:
            print("⚠️ [MessageHandler] 알 수 없는 액션: \(actionName)")
            print("⚠️ [MessageHandler] 전체 메시지: \(messageBody)")
        }
    }
    
    // MARK: - 📍 위치 추적 관련 함수들
    
    private func setupLocationManager() {
        print("🔥🔥🔥 [CRITICAL] setupLocationManager 호출됨! 위치 추적 시스템 초기화! 🔥🔥🔥")
        
        guard CLLocationManager.locationServicesEnabled() else {
            print("❌ [LOCATION] 위치 서비스가 비활성화됨")
            return
        }
        
        locationManager = CLLocationManager()
        locationManager?.delegate = self
        locationManager?.desiredAccuracy = kCLLocationAccuracyBest
        locationManager?.distanceFilter = 10 // 10미터마다 업데이트
        
        print("✅ [LOCATION] 위치 관리자 설정 완료")
    }

    // MARK: - Pre-permission dialogs
    private func presentPrePermissionAlert(title: String, message: String, continueTitle: String = "계속", cancelTitle: String = "나중에", onContinue: @escaping () -> Void) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: cancelTitle, style: .cancel))
        alert.addAction(UIAlertAction(title: continueTitle, style: .default) { _ in onContinue() })
        self.present(alert, animated: true)
    }

    private func showLocationPrePermissionAndRequest() {
        locationPrePromptShown = true
        let status = CLLocationManager.authorizationStatus()
        if status == .notDetermined {
            presentPrePermissionAlert(
                title: "위치 권한 안내",
                message: "모임 장소 안내와 도착 알림을 위해 위치 정보가 필요합니다. 예: 일정 장소까지의 거리 표시 및 근접 시 알림 제공",
                onContinue: { [weak self] in
                    UserDefaults.standard.set(true, forKey: "smap_location_prepermission_done")
                    self?.locationManager?.requestWhenInUseAuthorization()
                }
            )
        }
    }

    private func showMotionPrePermissionAndRequest() {
        motionPrePromptShown = true
        if #available(iOS 11.0, *) {
            let status = CMMotionActivityManager.authorizationStatus()
            if status == .notDetermined {
                presentPrePermissionAlert(
                    title: "동작 및 피트니스 권한 안내",
                    message: "이동 거리 계산 및 활동 기반 알림 제공을 위해 동작 및 피트니스 데이터 접근이 필요합니다. 예: 걸음 수/이동량을 활용한 도착 안내",
                    onContinue: {
                        UserDefaults.standard.set(true, forKey: "smap_motion_prepermission_done")
                        // 권한 트리거를 위해 짧은 쿼리 실행
                        let manager = CMMotionActivityManager()
                        let now = Date()
                        let tenMinAgo = now.addingTimeInterval(-600)
                        manager.queryActivityStarting(from: tenMinAgo, to: now, to: OperationQueue.main) { _, _ in
                            // no-op
                        }
                    }
                )
            }
        }
    }
    
    private func startContinuousLocationTracking() {
        print("📍 [LOCATION] 지속적 위치 추적 시작")
        locationManager?.startUpdatingLocation()
        print("✅ [LOCATION] 위치 업데이트 시작됨")
    }
    
    private func stopContinuousLocationTracking() {
        print("📍 [LOCATION] 지속적 위치 추적 중지")
        locationManager?.stopUpdatingLocation()
        print("✅ [LOCATION] 위치 업데이트 중지됨")
    }
    
    private func sendLocationUpdateToWeb(latitude: Double, longitude: Double, accuracy: Double, speed: Double, altitude: Double, timestamp: Date) {
        print("🔥🔥🔥 [CRITICAL] sendLocationUpdateToWeb 호출됨! 웹뷰로 위치 데이터 전송! 🔥🔥🔥")
        print("📍 [LOCATION] 전송할 데이터:")
        print("   📍 위도: \(latitude)")
        print("   📍 경도: \(longitude)")
        print("   📍 정확도: \(accuracy)")
        print("   📍 속도: \(speed)")
        print("   📍 고도: \(altitude)")
        print("   📍 타임스탬프: \(timestamp)")
        
        let timestampMs = Int(timestamp.timeIntervalSince1970 * 1000)
        let resultScript = """
            console.log('🔥🔥🔥 [iOS-NATIVE] 위치 업데이트 스크립트 실행 시작! 🔥🔥🔥');
            console.log('📍 [iOS-NATIVE] window.onLocationUpdate 존재 여부:', typeof window.onLocationUpdate);
            
            if (window.onLocationUpdate) {
                console.log('📍 [iOS-NATIVE] 지속적 위치 업데이트 콜백 실행');
                window.onLocationUpdate({
                    latitude: \(latitude),
                    longitude: \(longitude),
                    accuracy: \(accuracy),
                    speed: \(speed),
                    altitude: \(altitude),
                    timestamp: \(timestampMs),
                    source: 'ios-native-continuous'
                });
                console.log('📍 [iOS-NATIVE] 위치 업데이트 콜백 실행 완료');
            } else {
                console.log('⚠️ [iOS-NATIVE] onLocationUpdate 함수를 찾을 수 없습니다');
                console.log('⚠️ [iOS-NATIVE] window 객체 확인:', typeof window);
                
                // 강제로 onLocationUpdate 함수 등록
                console.log('🔧 [iOS-NATIVE] onLocationUpdate 함수 강제 등록');
                window.onLocationUpdate = function(data) {
                    console.log('📍 [TEMP] 임시 onLocationUpdate 함수 호출:', data);
                };
                
                // 다시 시도
                window.onLocationUpdate({
                    latitude: \(latitude),
                    longitude: \(longitude),
                    accuracy: \(accuracy),
                    speed: \(speed),
                    altitude: \(altitude),
                    timestamp: \(timestampMs),
                    source: 'ios-native-continuous'
                });
            }
        """
        
        print("📍 [LOCATION] JavaScript 스크립트 생성 완료")
        print("📍 [LOCATION] webView 존재 여부: \(webView != nil)")
        
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(resultScript) { result, error in
                if let error = error {
                    print("❌ [LOCATION] 위치 업데이트 웹 콜백 실행 실패: \(error)")
                } else {
                    print("✅ [LOCATION] 위치 업데이트 웹 콜백 실행 완료")
                    print("📍 [LOCATION] JavaScript 실행 결과: \(result ?? "null")")
                }
            }
        }
    }
}

// MARK: - 📍 CLLocationManagerDelegate
extension WebViewController: CLLocationManagerDelegate {
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        print("🔥🔥🔥 [CRITICAL] didChangeAuthorization 호출됨! 권한 상태: \(status.rawValue) 🔥🔥🔥")
        print("📍 [LOCATION] 권한 상태 변경: CLAuthorizationStatus(rawValue: \(status.rawValue))")
        
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            print("✅ [LOCATION] GPS 권한 허용됨 - 위치 업데이트 시작")
            startContinuousLocationTracking()
        case .denied, .restricted:
            print("❌ [LOCATION] 위치 권한 거부됨")
        case .notDetermined:
            print("⏳ [LOCATION] 위치 권한 결정되지 않음")
        @unknown default:
            print("❓ [LOCATION] 알 수 없는 권한 상태")
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        print("🔥🔥🔥 [CRITICAL] didUpdateLocations 호출됨! WebViewController에서 위치 데이터 수신! 🔥🔥🔥")
        print("📍 [LOCATION] GPS 데이터 수신 시작 - 위치 개수: \(locations.count)")
        
        guard let location = locations.last else {
            print("❌ [LOCATION] 위치 정보 없음")
            return
        }
        
        // GPS 데이터 상세 정보 로깅
        print("✅ [LOCATION] GPS 데이터 수신 성공:")
        print("   📍 위도: \(location.coordinate.latitude)")
        print("   📍 경도: \(location.coordinate.longitude)")
        print("   📍 정확도: \(location.horizontalAccuracy)m")
        print("   �� 고도: \(location.altitude)m")
        print("   📍 속도: \(location.speed)m/s")
        print("   📍 시간: \(location.timestamp)")
        print("   📍 신호 품질: \(location.horizontalAccuracy < 10 ? "우수" : location.horizontalAccuracy < 50 ? "양호" : "보통")")
        
        // 임시 사용자 ID 설정 (실제로는 로그인된 사용자 ID를 사용해야 함)
        print("mt_idx - 1")  // 임시로 사용자 ID 1로 설정
        print("📍 [LOCATION] 임시 사용자 ID 설정: 1")
        
        // 웹으로 결과 전송 (지속적 업데이트)
        print("🌐 [LOCATION] 웹뷰로 GPS 데이터 전송 시작")
        sendLocationUpdateToWeb(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracy: location.horizontalAccuracy,
            speed: location.speed,
            altitude: location.altitude,
            timestamp: location.timestamp
        )
        print("🌐 [LOCATION] sendLocationUpdateToWeb 함수 호출 완료")
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("❌ [LOCATION] 위치 정보 가져오기 실패: \(error.localizedDescription)")
    }
    
    // MARK: - 👤 사용자 정보 처리 메서드
    
    private func handleUserInfo(param: [String: Any]) {
        print("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥")
        print("🔥🔥🔥 [USER INFO] handleUserInfo 메서드 호출됨!! 🔥🔥🔥")
        print("🔥🔥🔥 [USER INFO] 사용자 정보 처리 시작!! 🔥🔥🔥")
        print("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥")
        print("📨 [USER INFO] 받은 사용자 정보: \(param)")
        print("📨 [USER INFO] param.keys: \(param.keys)")
        
        // mt_idx를 숫자와 문자열 모두 지원
        var mtIdx: String = ""
        if let mtIdxString = param["mt_idx"] as? String {
            mtIdx = mtIdxString
        } else if let mtIdxNumber = param["mt_idx"] as? Int {
            mtIdx = String(mtIdxNumber)
        } else if let mtIdxNumber = param["mt_idx"] as? NSNumber {
            mtIdx = mtIdxNumber.stringValue
        }
        
        guard !mtIdx.isEmpty else {
            print("❌ [USER INFO] mt_idx가 없거나 비어있음")
            print("❌ [USER INFO] mt_idx 원본 값: \(param["mt_idx"] ?? "nil")")
            print("❌ [USER INFO] mt_idx 원본 타입: \(type(of: param["mt_idx"]))")
            return
        }
        
        // mt_id도 숫자와 문자열 모두 지원
        var mtId: String = ""
        if let mtIdString = param["mt_id"] as? String {
            mtId = mtIdString
        } else if let mtIdNumber = param["mt_id"] as? Int {
            mtId = String(mtIdNumber)
        } else if let mtIdNumber = param["mt_id"] as? NSNumber {
            mtId = mtIdNumber.stringValue
        }
        
        let mtIdxString = mtIdx
        let mtName = param["mt_name"] as? String ?? ""
        let mtEmail = param["mt_email"] as? String ?? ""
        
        print("✅ [USER INFO] 사용자 정보 파싱 성공:")
        print("   👤 mt_idx: \(mtIdxString)")
        print("   👤 mt_id: \(mtId)")
        print("   👤 mt_name: \(mtName)")
        print("   👤 mt_email: \(mtEmail)")
        
        // 💾 UserDefaults에 저장
        UserDefaults.standard.set(mtIdxString, forKey: "mt_idx")
        UserDefaults.standard.set(mtId, forKey: "mt_id")
        UserDefaults.standard.set(mtName, forKey: "mt_name")
        UserDefaults.standard.set(mtEmail, forKey: "mt_email")
        UserDefaults.standard.set(true, forKey: "is_logged_in")
        UserDefaults.standard.synchronize()
        
        print("💾 [USER INFO] 사용자 정보 로컬 저장 완료")

        // 📍 LocationService에 사용자 정보 전달
        LocationService.sharedInstance.updateUserInfo(mtIdx: mtIdxString, mtId: mtId, mtName: mtName)
        print("🔗 [USER INFO] LocationService에 사용자 정보 전달 완료")

        // 🔑 로그인 성공 시 FCM 토큰 강제 업데이트
        print("🔑 [LOGIN] 로그인 성공 감지 - FCM 토큰 강제 업데이트 시작")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { // 약간의 지연 후 실행
            if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
                appDelegate.forceUpdateFCMTokenOnLogin()
                print("✅ [LOGIN] FCM 토큰 강제 업데이트 호출 완료")
            } else {
                print("❌ [LOGIN] AppDelegate를 찾을 수 없음")
            }
        }
        
        // 🌐 웹뷰로 확인 응답 전송
        let confirmationScript = """
            console.log('✅ [iOS-USER] 사용자 정보 저장 완료:', {
                mt_idx: '\(mtIdxString)',
                mt_name: '\(mtName)',
                timestamp: new Date().toISOString()
            });
            
            // 전역 이벤트 발생
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('ios-user-info-saved', {
                    detail: {
                        mt_idx: '\(mtIdxString)',
                        mt_name: '\(mtName)',
                        success: true
                    }
                }));
            }
        """
        
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(confirmationScript) { result, error in
                if let error = error {
                    print("❌ [USER INFO] 웹뷰 확인 스크립트 실행 실패: \(error)")
                } else {
                    print("✅ [USER INFO] 웹뷰에 사용자 정보 저장 완료 알림")
                }
            }
        }
        
        print("🎉 [USER INFO] 사용자 정보 처리 완료!")

        // 인증 성공 처리로 초기 "인증 실패" 가드 해제
        suppressAuthFailure = false
        let disableGuardScript = """
            try {
                window.__SMAP_SUPPRESS_AUTH_FAILURE__ = false;
                // 숨겨둔 요소 복원 시도
                document.querySelectorAll('[data-smap-auth-guard="hidden"]').forEach(function(el){
                    el.style.removeProperty('display');
                    el.removeAttribute('data-smap-auth-guard');
                });
                console.log('[SMAP-AUTH-GUARD] disabled');
            } catch(e) { console.error('[SMAP-AUTH-GUARD] disable error:', e); }
        """
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(disableGuardScript, completionHandler: nil)
        }
    }
    
    private func handleUserLogout() {
        print("👤 [USER LOGOUT] 사용자 로그아웃 처리 시작")
        
        // 💾 UserDefaults에서 사용자 정보 제거
        UserDefaults.standard.removeObject(forKey: "mt_idx")
        UserDefaults.standard.removeObject(forKey: "mt_id")
        UserDefaults.standard.removeObject(forKey: "mt_name")
        UserDefaults.standard.removeObject(forKey: "mt_email")
        UserDefaults.standard.set(false, forKey: "is_logged_in")
        UserDefaults.standard.synchronize()
        
        print("💾 [USER LOGOUT] 로컬 사용자 정보 제거 완료")
        
        // 📍 LocationService에 로그아웃 알림
        LocationService.sharedInstance.clearUserInfo()
        
        // 🌐 웹뷰로 확인 응답 전송
        let confirmationScript = """
            console.log('✅ [iOS-USER] 사용자 로그아웃 처리 완료:', {
                timestamp: new Date().toISOString()
            });
            
            // 전역 이벤트 발생
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('ios-user-logout', {
                    detail: { success: true }
                }));
            }
        """
        
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(confirmationScript) { result, error in
                if let error = error {
                    print("❌ [USER LOGOUT] 웹뷰 로그아웃 확인 스크립트 실행 실패: \(error)")
                } else {
                    print("✅ [USER LOGOUT] 웹뷰에 로그아웃 완료 알림")
                }
            }
        }
        
        print("✅ [USER LOGOUT] 사용자 로그아웃 처리 완료")
    }
}

// MARK: - WKNavigationDelegate
extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url {
            let path = url.path
            print("🌐 [NAVIGATION] URL 요청: \(path)")
            
            // 일정 페이지 요청 시 네이티브 화면으로 전환
            if path.contains("/schedule") {
                print("📅 [NAVIGATION] 웹 일정 페이지 감지 - 네이티브 전환")
                NotificationCenter.default.post(name: NSNotification.Name("navigateToSchedule"), object: nil)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }
}
 