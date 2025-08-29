//
//  AppDelegate.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import UIKit
import FirebaseCore
import FirebaseMessaging
import IQKeyboardManagerSwift
import CoreLocation
import AVFoundation
import Photos
import CoreMotion
import SwiftyStoreKit
import GoogleSignIn
import WebKit
import KakaoSDKCommon
import KakaoSDKAuth

// FCM Token Manager - 자동 토큰 업데이트 기능

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    var window: UIWindow?
    private let motionManager = CMMotionActivityManager()
    
    // MARK: - FCM 자동 토큰 업데이트 관련 프로퍼티
    private var fcmAutoUpdateTimer: Timer?
    private var backgroundFCMTimer: Timer?  // 백그라운드용 토큰 검증 타이머
    private var lastFCMTokenUpdateTime: Date?
    private let fcmTokenUpdateInterval: TimeInterval = 60 // 1분 (60초) - 포그라운드용
    private let backgroundFCMCheckInterval: TimeInterval = 1800 // 30분 (1800초) - 백그라운드용
    private var isFCMUpdateInProgress = false
    private var appEnteredBackgroundTime: Date?  // 백그라운드 진입 시간
    
    var title = String()
    var body = String()
    var event_url = String()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        print("╔═══════════════════════════════════════════════════════════════════════════════╗")
        print("║ 🚀 [SMAP-iOS] 앱 시작 - 완전 최적화 버전                                       ║")
        print("╚═══════════════════════════════════════════════════════════════════════════════╝")
        
        // 앱 설정 최적화 먼저 실행
        setupAppOptimizations()
        
        FirebaseApp.configure()
        
        // Google Sign-In 설정
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let plist = NSDictionary(contentsOfFile: path),
              let clientId = plist["CLIENT_ID"] as? String else {
            print("❌ GoogleService-Info.plist에서 CLIENT_ID를 찾을 수 없습니다.")
            print("❌ Google Sign-In이 제대로 설정되지 않았습니다.")
            return true
        }
        
        print("✅ Google Client ID: \(clientId)")
        
        let config = GIDConfiguration(clientID: clientId)
        GIDSignIn.sharedInstance.configuration = config
        print("✅ Google Sign-In 설정 완료")
        
        // URL Scheme 디버깅
        if let reversedClientId = plist["REVERSED_CLIENT_ID"] as? String {
            print("✅ Reversed Client ID: \(reversedClientId)")
        }
        
        // 번들 ID 확인
        if let bundleId = Bundle.main.bundleIdentifier {
            print("✅ Bundle ID: \(bundleId)")
        }
        
        // Google Mobile Ads SDK 초기화 제거됨 (웹뷰 앱에서는 사용하지 않음)
        // GADMobileAds.sharedInstance().start(completionHandler: nil)

        
        // ✅ FCM 자동 초기화 활성화 - 즉시 푸시 알림 수신 가능하도록
        Messaging.messaging().isAutoInitEnabled = true
        print("✅ [FCM] 자동 초기화 활성화 - 푸시 알림 즉시 수신 가능")
        
        // ✅ FCM delegate 즉시 설정
        Messaging.messaging().delegate = self
        print("✅ [FCM] FCM delegate 설정 완료")
        
        if #available(iOS 10.0, *) {
            // For iOS 10 display notification (sent via APNS)
            UNUserNotificationCenter.current().delegate = self
            // ✅ 앱 시작 시 푸시 알림 권한 요청 활성화
            print("🔔 [PUSH] 런치 시 푸시 알림 권한 요청 활성화")
            
            // 즉시 푸시 알림 권한 요청
            let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
            UNUserNotificationCenter.current().requestAuthorization(
                options: authOptions,
                completionHandler: { didAllow, error in
                    DispatchQueue.main.async {
                        if let error = error {
                            print("❌ [PUSH] 푸시 알림 권한 요청 오류: \(error.localizedDescription)")
                        } else {
                            print("✅ [PUSH] 푸시 알림 권한 요청 완료: \(didAllow)")
                            if didAllow {
                                // 권한이 허용되면 원격 알림 등록
                                UIApplication.shared.registerForRemoteNotifications()
                                print("✅ [PUSH] 원격 알림 등록 완료")
                            }
                        }
                    }
                }
            )
        } else {
            // iOS 10 미만에서도 푸시 알림 권한 요청
            print("✅ [PUSH] iOS 10 미만에서도 푸시 알림 권한 요청")
            let settings: UIUserNotificationSettings =
                UIUserNotificationSettings(types: [.alert, .badge, .sound], categories: nil)
            application.registerUserNotificationSettings(settings)
            application.registerForRemoteNotifications()
        }
        
        IQKeyboardManager.shared.enable = true
        IQKeyboardManager.shared.enableAutoToolbar = false
        IQKeyboardManager.shared.resignOnTouchOutside = true
        
        // iOS 14+ 권장 방식: delegate 기반 위치 서비스 시작 (프리퍼미션 이후)
        if UserDefaults.standard.bool(forKey: "smap_location_prepermission_done") {
            LocationService.sharedInstance.startLocationUpdatesWithPermissionCheck()
        } else {
            print("📍 [LOCATION] 앱 시작 시 자동 위치 권한 요청 생략 (프리퍼미션 대기)")
        }
        
        StoreKitManager.shared.fetchReceipt { encryptedReceipt, error in
            if let error = error {
                print("fetchReceipt error - \(error)")
                return
            }
            
            StoreKitManager.shared.restorePurchases { msg in
                print("restorePurchases === \(msg ?? "")")
            }
        }
        
        SwiftyStoreKit.completeTransactions(atomically: true) { purchases in
            for purchase in purchases {
                switch purchase.transaction.transactionState {
                case .purchased, .restored:
                    if purchase.needsFinishTransaction {
                        // Deliver content from server, then:
                        SwiftyStoreKit.finishTransaction(purchase.transaction)
                    }
                    // Unlock content
                case .failed, .purchasing, .deferred:
                    break // do nothing
                default:
                    break
                }
            }
        }
        
        // 카카오 SDK 초기화
        if let kakaoAppKey = Bundle.main.infoDictionary?["KAKAO_APP_KEY"] as? String {
            KakaoSDK.initSDK(appKey: kakaoAppKey)
            print("✅ Kakao SDK 초기화 완료: \(kakaoAppKey.prefix(8))...")
        } else {
            print("❌ KAKAO_APP_KEY를 Info.plist에서 찾을 수 없습니다.")
        }
        
        print("✅ [SMAP-iOS] 앱 초기화 완료")

        // 🚨 퍼미션 디버그 스위즐 설치 (로그인 전 푸시 권한 호출을 원천 차단 + 호출 스택 로깅)
        Self.installPermissionDebugGuards()

        // 디버그: Info.plist 권한 문구 확인
        debugPrintUsageDescriptions()
        
        // 🚨 임시 해결책: Info.plist 값이 비어있을 경우 런타임 경고
        checkAndWarnEmptyUsageDescriptions()
        
        // ✅ FCM 자동 토큰 업데이트 초기화
        setupFCMAutoTokenUpdate()

        // 🚨 FCM 토큰 유효성 검증 초기화
        setupFCMTokenValidation()
        
        return true
    }
    
    // MARK: - 🔔 FCM 자동 토큰 업데이트 관리
    
    private func setupFCMAutoTokenUpdate() {
        print("🚀 [FCM Auto] FCM 자동 토큰 업데이트 초기화")

        // 앱 상태 변화 감지기 설정
        setupFCMAppStateObservers()

        // 로그인 상태 확인 (여러 키에서 확인)
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if isLoggedIn {
            print("✅ [FCM Auto] 로그인 상태 감지됨 - 자동 업데이트 시작")
            startFCMAutoTokenUpdate()

            // 🚨 앱 시작 시 즉시 FCM 토큰 확인 및 갱신
            performImmediateFCMTokenValidation()
        } else {
            print("🔒 [FCM Auto] 로그인 상태가 아님 - 자동 업데이트 대기")
        }
    }

    // MARK: - 🔍 FCM 토큰 유효성 검증 초기화
    private func setupFCMTokenValidation() {
        print("🔍 [FCM Validation] FCM 토큰 유효성 검증 초기화")

        // 로그인 상태 확인
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if isLoggedIn {
            print("✅ [FCM Validation] 로그인 상태 감지됨 - 토큰 검증 시작")
            performFCMTokenValidation()
        } else {
            print("🔒 [FCM Validation] 로그인 상태가 아님 - 토큰 검증 대기")
        }
    }

    // MARK: - 🔍 FCM 토큰 유효성 검증 실행
    private func performFCMTokenValidation() {
        print("🔍 [FCM Validation] FCM 토큰 유효성 검증 시작")

        // 사용자 ID 확인
        guard let mtIdxString = UserDefaults.standard.string(forKey: "mt_idx") ??
                              UserDefaults.standard.string(forKey: "savedMtIdx") ??
                              UserDefaults.standard.string(forKey: "current_mt_idx"),
              let mtIdx = Int(mtIdxString) else {
            print("❌ [FCM Validation] 사용자 ID를 찾을 수 없음")
            return
        }

        // 현재 FCM 토큰 가져오기
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM Validation] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                    return
                }

                guard let token = token, !token.isEmpty else {
                    print("❌ [FCM Validation] FCM 토큰이 nil이거나 비어있음")
                    return
                }

                print("✅ [FCM Validation] FCM 토큰 획득 성공: \(token.prefix(30))...")
                self?.validateTokenWithServer(token: token, mtIdx: mtIdx)
            }
        }
    }

    // MARK: - 🌐 서버에 FCM 토큰 유효성 검증 요청
    private func validateTokenWithServer(token: String, mtIdx: Int) {
        print("🌐 [FCM Validation] 서버에 토큰 검증 요청 시작")

        let urlString = "\(Http.shared.BASE_URL)\(Http.shared.memberFcmTokenUrl)/validate-and-refresh"
        guard let url = URL(string: urlString) else {
            print("❌ [FCM Validation] 잘못된 URL: \(urlString)")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token,
            "device_type": "ios",
            "platform": "ios"
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: requestData)
        } catch {
            print("❌ [FCM Validation] JSON 변환 실패: \(error.localizedDescription)")
            return
        }

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM Validation] 네트워크 오류: \(error.localizedDescription)")
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ [FCM Validation] HTTP 응답이 아님")
                    return
                }

                print("🌐 [FCM Validation] HTTP 상태 코드: \(httpResponse.statusCode)")

                if let data = data {
                    do {
                        if let jsonResponse = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                            print("📋 [FCM Validation] 서버 응답: \(jsonResponse)")

                            let success = jsonResponse["success"] as? Bool ?? false
                            let message = jsonResponse["message"] as? String ?? "알 수 없는 응답"

                            if success {
                                print("✅ [FCM Validation] 토큰 검증 성공: \(message)")

                                // 토큰이 갱신된 경우 로컬에도 업데이트
                                if message.contains("갱신") {
                                    UserDefaults.standard.set(token, forKey: "last_fcm_token")
                                    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_fcm_token_update_time")
                                    UserDefaults.standard.synchronize()
                                }
                            } else {
                                print("⚠️ [FCM Validation] 토큰 검증 실패: \(message)")

                                // 토큰이 유효하지 않은 경우 새 토큰 요청
                                if message.contains("만료") || message.contains("유효하지") {
                                    print("🔄 [FCM Validation] 토큰 만료 감지 - 새 토큰 요청")
                                    self?.forceRefreshFCMToken()
                                }
                            }
                        }
                    } catch {
                        print("❌ [FCM Validation] JSON 파싱 오류: \(error.localizedDescription)")
                    }
                }
            }
        }.resume()
    }

    // MARK: - 🔄 FCM 토큰 강제 갱신
    private func forceRefreshFCMToken() {
        print("🔄 [FCM Force] FCM 토큰 강제 갱신 시작")

        // 기존 토큰 무효화
        UserDefaults.standard.removeObject(forKey: "last_fcm_token")
        UserDefaults.standard.synchronize()

        // FCM 토큰 재생성 요청
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM Force] 토큰 갱신 실패: \(error.localizedDescription)")
                    return
                }

                guard let token = token, !token.isEmpty else {
                    print("❌ [FCM Force] 새 토큰이 nil이거나 비어있음")
                    return
                }

                print("✅ [FCM Force] 새 토큰 생성 성공: \(token.prefix(30))...")
                self?.sendFCMTokenToServer(token: token)
            }
        }
    }

    // MARK: - 🚨 앱 시작 시 즉시 FCM 토큰 검증
    private func performImmediateFCMTokenValidation() {
        print("🔍 [FCM] 앱 시작 시 즉시 FCM 토큰 검증 시작")

        // 마지막 토큰 업데이트 시간 확인
        let lastUpdateTime = UserDefaults.standard.double(forKey: "last_fcm_token_update_time")
        let currentTime = Date().timeIntervalSince1970
        let timeSinceLastUpdate = currentTime - lastUpdateTime

        print("📊 [FCM] 마지막 토큰 업데이트로부터 \(String(format: "%.1f", timeSinceLastUpdate / 3600))시간 경과")

        // 24시간 이상 경과했거나 처음 실행인 경우 강제 토큰 갱신
        if timeSinceLastUpdate > (24 * 60 * 60) || lastUpdateTime == 0 {
            print("🚨 [FCM] 24시간 이상 경과 또는 첫 실행 - 강제 토큰 갱신 실행")
            forceRefreshFCMTokenOnAppStart()
        } else {
            print("✅ [FCM] 최근에 토큰 업데이트됨 - 일반 검증 진행")
            updateFCMTokenIfNeeded()
        }
    }

    private func forceRefreshFCMTokenOnAppStart() {
        print("🔄 [FCM] 앱 시작 시 강제 토큰 갱신")

        // 기존 토큰 무효화
        UserDefaults.standard.removeObject(forKey: "last_fcm_token")
        UserDefaults.standard.synchronize()

        // FCM 토큰 재생성 요청
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM] 앱 시작 시 토큰 갱신 실패: \(error.localizedDescription)")
                    // 네트워크 문제일 수 있으므로 30초 후 재시도
                    DispatchQueue.main.asyncAfter(deadline: .now() + 30.0) {
                        self?.updateFCMTokenIfNeeded()
                    }
                    return
                }

                guard let token = token, !token.isEmpty else {
                    print("❌ [FCM] 앱 시작 시 토큰이 nil이거나 비어있음")
                    return
                }

                print("✅ [FCM] 앱 시작 시 토큰 갱신 성공: \(token.prefix(30))...")
                self?.checkAndUpdateFCMTokenIfNeeded(currentToken: token)
            }
        }
    }
    
    private func setupFCMAppStateObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(fcmAppDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(fcmAppDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(fcmAppWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        
        print("✅ [FCM Auto] 앱 상태 변화 감지기 설정 완료")
    }
    
    private func startFCMAutoTokenUpdate() {
        print("🚀 [FCM Auto] 자동 FCM 토큰 업데이트 시작")
        
        // 기존 타이머 정리
        stopFCMAutoTokenUpdate()
        
        // 즉시 첫 번째 토큰 업데이트 실행
        updateFCMTokenIfNeeded()
        
        // 5분마다 자동 업데이트 타이머 시작
        fcmAutoUpdateTimer = Timer.scheduledTimer(withTimeInterval: fcmTokenUpdateInterval, repeats: true) { [weak self] _ in
            self?.updateFCMTokenIfNeeded()
        }
        
        print("✅ [FCM Auto] 1분마다 자동 FCM 토큰 업데이트 타이머 시작됨")
    }
    
    private func stopFCMAutoTokenUpdate() {
        print("⏹️ [FCM Auto] 자동 FCM 토큰 업데이트 중지")

        fcmAutoUpdateTimer?.invalidate()
        fcmAutoUpdateTimer = nil

        print("✅ [FCM Auto] 자동 FCM 토큰 업데이트 타이머 중지됨")
    }

    // MARK: - 백그라운드 FCM 토큰 검증 타이머 관리
    private func startBackgroundFCMTimer() {
        print("🚀 [FCM Background] 백그라운드 FCM 토큰 검증 타이머 시작")

        // 기존 타이머 정리
        stopBackgroundFCMTimer()

        // 백그라운드 진입 시간 기록
        appEnteredBackgroundTime = Date()

        // 30분마다 백그라운드 토큰 검증
        backgroundFCMTimer = Timer.scheduledTimer(withTimeInterval: backgroundFCMCheckInterval, repeats: true) { [weak self] _ in
            self?.performBackgroundFCMTokenCheck()
        }

        print("✅ [FCM Background] 30분마다 백그라운드 FCM 토큰 검증 타이머 시작됨")
    }

    private func stopBackgroundFCMTimer() {
        print("⏹️ [FCM Background] 백그라운드 FCM 토큰 검증 타이머 중지")

        backgroundFCMTimer?.invalidate()
        backgroundFCMTimer = nil
        appEnteredBackgroundTime = nil

        print("✅ [FCM Background] 백그라운드 FCM 토큰 검증 타이머 중지됨")
    }

    // MARK: - 백그라운드 FCM 토큰 검증 실행
    private func performBackgroundFCMTokenCheck() {
        print("🔍 [FCM Background] 백그라운드 FCM 토큰 검증 시작")

        // 로그인 상태 확인
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        guard isLoggedIn else {
            print("🔒 [FCM Background] 로그인 상태가 아님 - 백그라운드 검증 스킵")
            return
        }

        // 백그라운드에 너무 오래 있었는지 확인 (24시간 이상)
        if let backgroundTime = appEnteredBackgroundTime {
            let timeInBackground = Date().timeIntervalSince(backgroundTime)
            if timeInBackground > (24 * 60 * 60) { // 24시간
                print("🚨 [FCM Background] 백그라운드에 24시간 이상 체류 - 강제 토큰 갱신")
                forceRefreshFCMTokenForBackground()
                return
            }
        }

        // 현재 FCM 토큰 확인 및 서버 검증
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM Background] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                    return
                }

                guard let token = token, !token.isEmpty else {
                    print("❌ [FCM Background] FCM 토큰이 nil이거나 비어있음")
                    return
                }

                print("✅ [FCM Background] FCM 토큰 확인 성공: \(token.prefix(30))...")

                // 백그라운드용 토큰 검증 (더 가벼운 검증)
                self?.validateFCMTokenForBackground(token: token)
            }
        }
    }

    // MARK: - 백그라운드용 강제 토큰 갱신
    private func forceRefreshFCMTokenForBackground() {
        print("🔄 [FCM Background] 백그라운드용 강제 FCM 토큰 갱신 시작")

        // 기존 토큰 무효화
        UserDefaults.standard.removeObject(forKey: "last_fcm_token")
        UserDefaults.standard.synchronize()

        // FCM 토큰 재생성 요청
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM Background] 백그라운드 토큰 갱신 실패: \(error.localizedDescription)")
                    // 네트워크 문제일 수 있으므로 1시간 후 재시도
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3600.0) {
                        self?.forceRefreshFCMTokenForBackground()
                    }
                    return
                }

                guard let token = token, !token.isEmpty else {
                    print("❌ [FCM Background] 백그라운드 새 토큰이 nil이거나 비어있음")
                    return
                }

                print("✅ [FCM Background] 백그라운드 토큰 갱신 성공: \(token.prefix(30))...")
                self?.sendFCMTokenToServer(token: token)

                // 백그라운드 진입 시간 리셋
                self?.appEnteredBackgroundTime = Date()
            }
        }
    }
    
    private func updateFCMTokenIfNeeded() {
        // 🔒 중복 실행 방지
        guard !isFCMUpdateInProgress else {
            print("⏳ [FCM Auto] FCM 토큰 업데이트 이미 진행 중 - 스킵")
            return
        }
        
        // 로그인 상태 확인 (여러 키에서 확인)
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil
        
        guard isLoggedIn else {
            print("🔒 [FCM Auto] 로그인 상태가 아님 - FCM 토큰 업데이트 스킵")
            return
        }
        
        // 🚨 강제 업데이트: 1분마다 무조건 업데이트 실행
        print("🔄 [FCM Auto] FCM 토큰 업데이트 시작 (1분마다 강제)")
        isFCMUpdateInProgress = true
        
        // 현재 FCM 토큰 가져오기
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                defer {
                    self?.isFCMUpdateInProgress = false
                }
                
                if let error = error {
                    print("❌ [FCM Auto] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                    return
                }
                
                guard let token = token, !token.isEmpty else {
                    print("❌ [FCM Auto] FCM 토큰이 nil이거나 비어있음")
                    return
                }
                
                print("✅ [FCM Auto] FCM 토큰 가져오기 성공: \(token.prefix(30))...")
                
                // 토큰 변경 감지 및 서버 업데이트
                self?.checkAndUpdateFCMTokenIfNeeded(currentToken: token)
            }
        }
    }
    
    // MARK: - 🔔 FCM 앱 상태 변화 핸들러
    
    @objc private func fcmAppDidBecomeActive() {
        print("▶️ [FCM Auto] 앱이 활성화됨 - 즉시 FCM 토큰 업데이트")
        
        // 로그인 상태 확인
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil
        
        if isLoggedIn {
            print("✅ [FCM Auto] 로그인 상태 감지 - FCM 토큰 업데이트 실행")
            updateFCMTokenIfNeeded()
        } else {
            print("🔒 [FCM Auto] 로그인 상태가 아님 - FCM 토큰 업데이트 스킵")
        }
    }
    
    @objc private func fcmAppDidEnterBackground() {
        print("⏸️ [FCM Auto] 앱이 백그라운드로 진입")
        // 백그라운드 진입 시에도 토큰 업데이트 (필요시)
        // updateFCMTokenIfNeeded()
    }
    
    @objc private func fcmAppWillEnterForeground() {
        print("▶️ [FCM Auto] 앱이 포그라운드로 진입 예정 - 즉시 FCM 토큰 업데이트")
        updateFCMTokenIfNeeded()
    }
    
    // MARK: - 🔔 푸시 알림 권한 처리
    
    private func setupPushNotificationPermissions() {
        print("🔔 [PUSH] 푸시 알림 권한 설정 시작")
        
        let center = UNUserNotificationCenter.current()
        
        // 현재 권한 상태 먼저 확인
        center.getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔔 [PUSH] 현재 권한 상태: \(self.authorizationStatusString(settings.authorizationStatus))")
                
                switch settings.authorizationStatus {
                case .authorized, .provisional:
                    print("✅ [PUSH] 이미 권한이 허용되어 있음")
                    UIApplication.shared.registerForRemoteNotifications()
                    
                case .denied:
                    print("❌ [PUSH] 권한이 거부되어 있음")
                    
                case .notDetermined:
                    print("🔄 [PUSH] 권한 미결정 - 로그인 후 요청 예정")
                    print("🔒 [PUSH] 로그인 전 자동 권한 요청 차단")
                    
                case .ephemeral:
                    print("⏱️ [PUSH] 임시 권한")
                    UIApplication.shared.registerForRemoteNotifications()
                    
                @unknown default:
                    print("❓ [PUSH] 알 수 없는 권한 상태 - 로그인 후 처리")
                    print("🔒 [PUSH] 로그인 전 자동 권한 요청 차단")
                }
            }
        }
    }
    
    private func requestPushNotificationPermission() {
        print("🔔 [PUSH] 푸시 알림 권한 요청 시작")
        
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(
            options: authOptions,
            completionHandler: { granted, error in
                DispatchQueue.main.async {
                    print("🔔 [PUSH] 권한 요청 결과: \(granted ? "허용" : "거부")")
                    
                    if let error = error {
                        print("❌ [PUSH] 권한 요청 오류: \(error.localizedDescription)")
                    }
                    
                    if granted {
                        print("✅ [PUSH] 사용자가 푸시 알림 권한을 허용함")
                        UIApplication.shared.registerForRemoteNotifications()
                    } else {
                        print("❌ [PUSH] 사용자가 푸시 알림 권한을 거부함")
                    }
                }
            })
    }
    
    private func checkPushNotificationStatus() {
        print("🔔 [PUSH] 푸시 알림 권한 상태 상세 확인 시작")
        
        // 🚨 로그인 전에는 권한 상태 체크하지 않음
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil
        
        guard isLoggedIn else {
            print("🔒 [PUSH] 로그인 전 - 권한 상태 체크 생략")
            return
        }
        
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔍 [PUSH] 앱 활성화 시 권한 상태: \(self.authorizationStatusString(settings.authorizationStatus))")
                
                // Firebase 토큰과 함께 상태 출력 (로그인된 경우만)
                if let token = Messaging.messaging().fcmToken {
                    print("🔔 [PUSH] 현재 FCM 토큰: \(token)")
                    
                    if settings.authorizationStatus == .denied {
                        print("❌ [PUSH] 경고: FCM 토큰은 있지만 권한이 거부됨!")
                    } else if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                        print("✅ [PUSH] FCM 토큰과 권한 모두 정상!")
                        
                        // 🔔 중요: FCM 토큰이 변경되었는지 확인하고 서버에 업데이트
                        self.checkAndUpdateFCMTokenIfNeeded(currentToken: token)
                        
                        // ✅ FCM 자동 업데이트 시간 기록
                        self.lastFCMTokenUpdateTime = Date()
                    }
                } else {
                    print("❌ [PUSH] FCM 토큰이 없음")
                }
            }
        }
    }
    
    // MARK: - 🔔 FCM 토큰 변경 감지 및 서버 업데이트
    private func checkAndUpdateFCMTokenIfNeeded(currentToken: String) {
        // 🔒 중복 실행 방지: 이미 업데이트 진행 중이면 스킵
        if UserDefaults.standard.bool(forKey: "fcm_update_in_progress") {
            print("⏳ [FCM] FCM 토큰 업데이트 이미 진행 중 - 스킵")
            return
        }
        
        // 로그인 상태 확인 (여러 키에서 확인)
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil
        
        guard isLoggedIn else {
            print("🔒 [FCM] 로그인 상태가 아님 - FCM 토큰 업데이트 스킵")
            return
        }
        
        // 이전에 저장된 FCM 토큰과 비교
        let lastSavedToken = UserDefaults.standard.string(forKey: "last_fcm_token")
        
        // 🚨 강제 업데이트: 1분마다 무조건 서버에 업데이트
        print("🔄 [FCM] FCM 토큰 강제 업데이트 실행!")
        print("🔄 [FCM] 이전 토큰: \(lastSavedToken ?? "없음")")
        print("🔄 [FCM] 현재 토큰: \(currentToken)")
        print("🔄 [FCM] 토큰 변경 여부: \(lastSavedToken != currentToken)")
        print("🔄 [FCM] 저장된 토큰 없음: \(lastSavedToken == nil)")
        
        // 🔒 업데이트 진행 중 플래그 설정
        UserDefaults.standard.set(true, forKey: "fcm_update_in_progress")
        UserDefaults.standard.synchronize()
        
        // 새로운 토큰을 UserDefaults에 저장
        UserDefaults.standard.set(currentToken, forKey: "last_fcm_token")
        UserDefaults.standard.synchronize()

        // 서버에 FCM 토큰 업데이트 (무조건 실행)
        print("🚀 [FCM] FCM 토큰을 서버에 강제 업데이트 시작")
        self.sendFCMTokenToServer(token: currentToken)

        // ✅ FCM 자동 업데이트 시간 기록 (UserDefaults에도 저장)
        let currentTime = Date().timeIntervalSince1970
        UserDefaults.standard.set(currentTime, forKey: "last_fcm_token_update_time")
        UserDefaults.standard.synchronize()
        lastFCMTokenUpdateTime = Date()

        print("📅 [FCM] 토큰 업데이트 시간 기록됨: \(Date().description)")
    }
    
    private func authorizationStatusString(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined:
            return "notDetermined (미결정)"
        case .denied:
            return "denied (거부됨)"
        case .authorized:
            return "authorized (허용됨)"
        case .provisional:
            return "provisional (임시허용)"
        case .ephemeral:
            return "ephemeral (임시)"
        @unknown default:
            return "unknown (알수없음)"
        }
    }
    
    // MARK: - 🚀 앱 최적화 설정
    private func setupAppOptimizations() {
        // 1. 메모리 관리 최적화
        setupMemoryManagement()
        
        // 2. 네트워크 설정 최적화
        setupNetworkOptimizations()
        
        // 3. WebView 캐시 초기화 (필요시)
        initializeWebViewOptimizations()
    }
    
    private func setupMemoryManagement() {
        // 메모리 경고 알림 등록
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { _ in
            print("⚠️ [SMAP-iOS] 메모리 경고 수신, 캐시 정리 수행")
            // WebView 캐시 정리
            URLCache.shared.removeAllCachedResponses()
            WKWebsiteDataStore.default().removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: Date.distantPast) { 
                print("✅ [SMAP-iOS] WebView 데이터 정리 완료")
            }
        }
        
        // 백그라운드 진입 시 최적화
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { _ in
            print("🔄 [SMAP-iOS] 백그라운드 진입, 리소스 정리")
            URLCache.shared.removeAllCachedResponses()
        }
    }
    
    private func setupNetworkOptimizations() {
        // URL 캐시 설정 (50MB)
        let cacheSize = 50 * 1024 * 1024
        let cache = URLCache(memoryCapacity: cacheSize / 2, diskCapacity: cacheSize)
        URLCache.shared = cache
        
        print("🌐 [SMAP-iOS] 네트워크 캐시 설정 완료 (50MB)")
    }
    
    private func initializeWebViewOptimizations() {
        // WebView 최적화를 위한 초기 설정
        print("💾 [SMAP-iOS] WebView 최적화 준비 완료")
    }
    
    func applicationDidBecomeActive(_ application: UIApplication) {
        print("▶️ [SMAP-iOS] 앱이 활성화됨")

        // 앱 활성화 시 성능 최적화
        URLCache.shared.removeAllCachedResponses()

        // 🚨 로그인 전에는 푸시 알림 권한 체크하지 않음
        if UserDefaults.standard.bool(forKey: "is_logged_in") {
            print("🔍 [PUSH] 로그인 상태 - 푸시 알림 권한 상태 확인")
            checkPushNotificationStatus()
            // 로그인 후 권한 온보딩/보완 실행 - 반드시 푸시 권한 요청이 끝난 다음에 진행
            waitForPushPermissionSettlement { [weak self] in
                self?.runPermissionOnboardingIfNeeded()
            }

            // ✅ FCM 자동 토큰 업데이트 시작 (백그라운드 타이머 중지)
            stopBackgroundFCMTimer()
            startFCMAutoTokenUpdate()

            // 🔔 큐에 저장된 FCM 메시지들 처리
            processQueuedFCMMessages()

            // 🔄 백그라운드 푸시 데이터 처리
            processBackgroundPushData()
        } else {
            print("🔒 [PUSH] 로그인 전 - 푸시 알림 권한 상태 체크 생략")
        }
    }

    // MARK: - 🔔 푸시 권한 요청 종료 대기
    private func waitForPushPermissionSettlement(maxWaitSeconds: Double = 8.0, completion: @escaping () -> Void) {
        let center = UNUserNotificationCenter.current()
        var waited: Double = 0
        func poll() {
            center.getNotificationSettings { settings in
                DispatchQueue.main.async {
                    let status = settings.authorizationStatus
                    // notDetermined가 아니면 요청창이 사라진 상태로 간주
                    if status != .notDetermined {
                        print("🔔 [PUSH] 권한 상태 확정: \(self.authorizationStatusString(status)) → 후속 온보딩 진행")
                        completion()
                        return
                    }
                    if waited >= maxWaitSeconds {
                        print("⚠️ [PUSH] 권한 상태 대기 타임아웃 → 후속 온보딩 진행")
                        completion()
                        return
                    }
                    waited += 0.4
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { poll() }
                }
            }
        }
        poll()
    }

    // MARK: - 📍🏃 권한 온보딩/보완 로직
    private func runPermissionOnboardingIfNeeded() {
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in")
        guard isLoggedIn else { return }

        let hasDoneOnboarding = UserDefaults.standard.bool(forKey: "smap_permission_onboarding_done")

        if !hasDoneOnboarding {
            print("🧭 [PERM] 첫 진입 - 모든 주요 권한 순차 요청 시작 (모션 → 위치)")
            performInitialPermissionSequence { [weak self] in
                // 온보딩 완료 마크 (다음부터는 보완 로직으로)
                UserDefaults.standard.set(true, forKey: "smap_permission_onboarding_done")
                print("✅ [PERM] 권한 온보딩 완료 마크")
                // 보완 체크 한 번 더 (혹시 한쪽이 여전히 notDetermined이면)
                self?.ensureMissingPermissionsSequence()
            }
            return
        }

        // 온보딩 이후: 결핍된 권한만 보완 요청
        print("🧭 [PERM] 재진입 - 결핍된 권한만 보완 요청 (모션 → 위치)")
        ensureMissingPermissionsSequence()
    }

    private func requestLocationWhenInUse() {
        let lm = CLLocationManager()
        // 스위즐 가드에 의해 is_logged_in && smap_allow_location_request_now 일 때만 실제 요청됨
        lm.requestWhenInUseAuthorization()
        // 요청 후 자동 차단되도록 스위즐 측에서 allow 플래그를 false로 돌림
    }

    private func ensureLocationPermissionIfNotDetermined() {
        let status: CLAuthorizationStatus
        if #available(iOS 14.0, *) {
            status = CLLocationManager().authorizationStatus
        } else {
            status = CLLocationManager.authorizationStatus()
        }
        if status == .notDetermined {
            print("📍 [PERM] 위치 권한 미결정 - 요청 진행")
            UserDefaults.standard.set(true, forKey: "smap_allow_location_request_now")
            requestLocationWhenInUse()
        } else {
            print("📍 [PERM] 위치 권한 상태: \(status.rawValue)")
        }
    }

    private func requestMotionPermissionIfNeeded() {
        if CMMotionActivityManager.isActivityAvailable() {
            let status = CMMotionActivityManager.authorizationStatus()
            if status == .notDetermined {
                print("🏃 [PERM] 모션 권한 미결정 - 요청 트리거")
                motionManager.startActivityUpdates(to: OperationQueue.main) { _ in
                    // 즉시 중지 (권한 요청만 트리거)
                    self.motionManager.stopActivityUpdates()
                    print("🏃 [PERM] 모션 권한 요청 트리거 완료")
                }
            } else {
                print("🏃 [PERM] 모션 권한 상태: \(status.rawValue)")
            }
        } else {
            print("🏃 [PERM] 모션 액티비티 비지원 디바이스")
        }
    }

    private func ensureMotionPermissionIfNotDetermined() {
        if CMMotionActivityManager.isActivityAvailable() {
            let status = CMMotionActivityManager.authorizationStatus()
            if status == .notDetermined {
                print("🏃 [PERM] 모션 권한 미결정 - 보완 요청 트리거")
                motionManager.startActivityUpdates(to: OperationQueue.main) { _ in
                    self.motionManager.stopActivityUpdates()
                    print("🏃 [PERM] 모션 권한 보완 요청 완료")
                }
            }
        }
    }

    // MARK: - 🔁 순차 권한 요청 시나리오
    private func performInitialPermissionSequence(completion: @escaping () -> Void) {
        // 순서: 카메라 → 사진 → 모션 → 위치
        requestCameraPermissionSequential { [weak self] in
            self?.requestPhotoPermissionSequential { [weak self] in
                self?.requestMotionPermissionIfNeededSequential { [weak self] in
                    self?.requestLocationPermissionSequential {
                        completion()
                    }
                }
            }
        }
    }

    private func ensureMissingPermissionsSequence() {
        // 재진입 보완: 요구사항에 따라 모션/위치만 보완 (카메라/사진은 제외)
        // 순서: 모션 → 위치
        let motionStatus = CMMotionActivityManager.isActivityAvailable() ? CMMotionActivityManager.authorizationStatus() : .authorized
        let locStatus: CLAuthorizationStatus = {
            if #available(iOS 14.0, *) { return CLLocationManager().authorizationStatus }
            return CLLocationManager.authorizationStatus()
        }()

        if motionStatus == .notDetermined {
            requestMotionPermissionIfNeededSequential { [weak self] in
                if locStatus == .notDetermined {
                    self?.requestLocationPermissionSequential { 
                        print("✅ [PERM] 위치 권한 보완 완료")
                    }
                }
            }
        } else if locStatus == .notDetermined {
            requestLocationPermissionSequential { 
                print("✅ [PERM] 위치 권한 보완 완료")
            }
        } else {
            print("✅ [PERM] 모든 권한 이미 처리됨")
        }
    }

    // 모션 권한 요청 (순차용) - 완료 콜백 제공
    private func requestMotionPermissionIfNeededSequential(completion: @escaping () -> Void) {
        guard CMMotionActivityManager.isActivityAvailable() else { completion(); return }
        let status = CMMotionActivityManager.authorizationStatus()
        if status != .notDetermined {
            completion()
            return
        }
        print("🏃 [PERM] 모션 권한 요청 시작 (순차)")
        var attempts = 0
        motionManager.startActivityUpdates(to: OperationQueue.main) { [weak self] _ in
            attempts += 1
            let current = CMMotionActivityManager.authorizationStatus()
            if current != .notDetermined || attempts >= 3 {
                self?.motionManager.stopActivityUpdates()
                print("🏃 [PERM] 모션 권한 요청 완료. status=\(current.rawValue)")
                completion()
            }
        }
    }

    // 위치 권한 요청 (순차용) - 완료 콜백 제공
    private func requestLocationPermissionSequential(completion: @escaping () -> Void) {
        let status: CLAuthorizationStatus = {
            if #available(iOS 14.0, *) { return CLLocationManager().authorizationStatus }
            return CLLocationManager.authorizationStatus()
        }()
        if status != .notDetermined {
            completion()
            return
        }
        print("📍 [PERM] 위치 권한 요청 시작 (순차)")
        UserDefaults.standard.set(true, forKey: "smap_allow_location_request_now")
        let lm = CLLocationManager()
        lm.requestWhenInUseAuthorization() // 스위즐 가드로 컨트롤됨

        // 상태가 결정될 때까지 폴링 (최대 10초)
        var waited: Double = 0
        func poll() {
            let s: CLAuthorizationStatus = {
                if #available(iOS 14.0, *) { return CLLocationManager().authorizationStatus }
                return CLLocationManager.authorizationStatus()
            }()
            if s != .notDetermined {
                print("📍 [PERM] 위치 권한 요청 완료. status=\(s.rawValue)")
                completion()
            } else if waited >= 10.0 {
                print("⚠️ [PERM] 위치 권한 요청 타임아웃")
                completion()
            } else {
                waited += 0.3
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { poll() }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { poll() }
    }

    // 카메라 권한 요청 (순차용)
    private func requestCameraPermissionSequential(completion: @escaping () -> Void) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized, .restricted, .denied:
            // 이미 결정됨 (restricted/denied 포함) → 다음 단계로 진행
            completion()
        case .notDetermined:
            print("📷 [PERM] 카메라 권한 요청 시작 (순차)")
            AVCaptureDevice.requestAccess(for: .video) { _ in
                DispatchQueue.main.async {
                    print("📷 [PERM] 카메라 권한 요청 완료")
                    completion()
                }
            }
        @unknown default:
            completion()
        }
    }

    // 사진 라이브러리 권한 요청 (순차용)
    private func requestPhotoPermissionSequential(completion: @escaping () -> Void) {
        let completeOnMain: () -> Void = { DispatchQueue.main.async { completion() } }
        if #available(iOS 14.0, *) {
            let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
            switch status {
            case .authorized, .limited, .denied, .restricted:
                completeOnMain()
            case .notDetermined:
                print("🖼️ [PERM] 사진 권한 요청 시작 (순차, readWrite)")
                PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in
                    completeOnMain()
                }
            @unknown default:
                completeOnMain()
            }
        } else {
            let status = PHPhotoLibrary.authorizationStatus()
            switch status {
            case .authorized, .denied, .restricted:
                completeOnMain()
            case .notDetermined:
                print("🖼️ [PERM] 사진 권한 요청 시작 (순차, legacy)")
                PHPhotoLibrary.requestAuthorization { _ in
                    completeOnMain()
                }
            @unknown default:
                completeOnMain()
            }
        }
    }

    // 프리퍼미션 알림 제거: 시스템 권한 시트만 노출 (UsageDescription으로 안내)

    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        // 세로방향 고정
        return UIInterfaceOrientationMask.portrait
    }
    
    //앱이 현재 화면에서 실행되고 있을 때
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let userInfo = notification.request.content.userInfo
        print("🔔 [FCM] 포그라운드에서 푸시 알림 수신")
        print("📨 [FCM] 알림 데이터: \(userInfo)")
        print("Handle push from foreground")
        print("\(userInfo)")
        
        self.title = "\(userInfo["title"] ?? String())"
        self.body = "\(userInfo["body"] ?? String())"
        self.event_url = "\(userInfo["event_url"] ?? String())"
        
        print("title - \(self.title) body - \(self.body) event_url - \(self.event_url)")
        
        if let navigationController = self.window?.rootViewController as? UINavigationController {
            navigationController.popToRootViewController(animated: true)
        }
        
        let pushUserInfo: [AnyHashable: Any] = ["title":self.title, "body": self.body, "event_url": self.event_url]
        UserDefaults.standard.set(self.event_url, forKey: "event_url")
        NotificationCenter.default.post(name: Notification.Name("getPush"), object: nil, userInfo: pushUserInfo)
        
        completionHandler([.alert, .sound, .badge])
    }
    
    //앱은 꺼져있지만 완전히 종료되지 않고 백그라운드에서 실행중일 때
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        print("🔔 [FCM] 백그라운드에서 푸시 알림 수신")
        print("📨 [FCM] 알림 데이터: \(userInfo)")
        print("Handle push from background or closed")
        print("\(userInfo)")
    
        self.title = "\(userInfo["title"] ?? String())"
        self.body = "\(userInfo["body"] ?? String())"
        self.event_url = "\(userInfo["event_url"] ?? String())"
        
        if let navigationController = self.window?.rootViewController as? UINavigationController {
            navigationController.popToRootViewController(animated: true)
        }
        
        let pushUserInfo: [AnyHashable: Any] = ["title":self.title, "body": self.body, "event_url": self.event_url]
        UserDefaults.standard.set(self.event_url, forKey: "event_url")
        NotificationCenter.default.post(name: Notification.Name("getPush"), object: nil, userInfo: pushUserInfo)
        completionHandler()
    }
    
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any]) {
        print("Push notification received: \(userInfo)")
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("🔔 [FCM] 백그라운드에서 원격 알림 수신 (앱 종료 상태 가능)")
        print("📨 [FCM] 백그라운드 메시지 데이터: \(userInfo)")

        Messaging.messaging().appDidReceiveMessage(userInfo)

        // 백그라운드 푸시인지 확인
        let isBackgroundPush = userInfo["content-available"] as? String == "1" ||
                              userInfo["content-available"] as? Int == 1 ||
                              userInfo["background_push"] as? String == "true"

        // Silent 푸시인지 확인 (사용자에게 표시되지 않는 푸시)
        let isSilentPush = userInfo["silent_push"] as? String == "true" ||
                          userInfo["token_refresh"] as? String == "true"

        if isSilentPush {
            print("🤫 [FCM] Silent 푸시 감지 - 사용자에게 표시하지 않고 토큰 갱신만 수행")
            handleSilentPushMessage(userInfo, completionHandler: completionHandler)

        } else if isBackgroundPush {
            print("🔄 [FCM] 백그라운드 푸시 감지 - 백그라운드에서 처리")
            handleBackgroundPushMessage(userInfo, completionHandler: completionHandler)

            // 백그라운드 푸시 수신 시 FCM 토큰 상태 확인 및 갱신
            print("🔄 [FCM] 백그라운드 푸시 수신으로 토큰 상태 확인")
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.updateFCMTokenIfNeeded()
            }
        } else {
            print("🔔 [FCM] 일반 푸시 알림 - 큐에 저장 후 완료")
            // 백그라운드에서 FCM 메시지 수신 시 처리
            handleBackgroundFCMMessage(userInfo)
            completionHandler(UIBackgroundFetchResult.newData)
        }
    }

    // MARK: - 🤫 Silent 푸시 처리
    private func handleSilentPushMessage(_ userInfo: [AnyHashable: Any], completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("🤫 [FCM] Silent 푸시 메시지 처리 시작")

        // Silent 푸시는 백그라운드에서 최소한의 작업만 수행
        DispatchQueue.global(qos: .background).async {
            // FCM 토큰 상태 확인 및 갱신 (사용자에게 표시되지 않음)
            print("🤫 [FCM] Silent 푸시로 FCM 토큰 상태 확인 및 갱신")

            DispatchQueue.main.async {
                // FCM 토큰 갱신 시도
                self.updateFCMTokenIfNeeded()

                // Silent 푸시 수신 기록 (디버깅용)
                let lastSilentPushTime = Date().timeIntervalSince1970
                UserDefaults.standard.set(lastSilentPushTime, forKey: "last_silent_push_time")
                UserDefaults.standard.synchronize()

                print("✅ [FCM] Silent 푸시 처리 완료 - 토큰 갱신 완료")

                // 백그라운드 작업 완료
                completionHandler(.newData)
            }
        }
    }

    // MARK: - 🔄 백그라운드 푸시 처리
    private func handleBackgroundPushMessage(_ userInfo: [AnyHashable: Any], completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("🔄 [FCM] 백그라운드 푸시 메시지 처리 시작")

        // 백그라운드에서 수행할 작업들
        DispatchQueue.global(qos: .background).async {
            // 1. 데이터 미리 가져오기 (필요시)
            self.prefetchDataIfNeeded(userInfo)

            // 2. 로컬 저장소 업데이트
            self.updateLocalStorageWithBackgroundData(userInfo)

            // 3. 중요하지 않은 작업들은 메인 큐에서 처리
            DispatchQueue.main.async {
                // 4. 메시지를 큐에 저장
                self.saveFCMMessageToQueue(userInfo)

                // 5. 백그라운드 푸시의 경우 사용자에게 알림 표시하지 않음
                // (필요시 조건부로 표시 가능)
                if self.shouldShowNotificationForBackgroundPush(userInfo) {
                    self.showLocalNotificationForBackgroundPush(userInfo)
                }

                print("✅ [FCM] 백그라운드 푸시 처리 완료")
                completionHandler(.newData)
            }
        }
    }

    private func prefetchDataIfNeeded(_ userInfo: [AnyHashable: Any]) {
        print("📥 [FCM] 백그라운드 데이터 미리 가져오기")

        // 메시지에 따라 필요한 데이터 미리 가져오기
        if let eventUrl = userInfo["event_url"] as? String {
            // 이벤트 관련 데이터 미리 로드
            print("🔗 [FCM] 이벤트 URL 데이터 미리 로드: \(eventUrl)")
            // 실제로는 여기서 API 호출 등을 통해 데이터를 캐싱
        }

        // 그룹 일정 데이터 미리 로드 등의 작업 가능
        if let scheduleId = userInfo["schedule_id"] as? String {
            print("📅 [FCM] 일정 데이터 미리 로드: \(scheduleId)")
        }
    }

    private func updateLocalStorageWithBackgroundData(_ userInfo: [AnyHashable: Any]) {
        print("💾 [FCM] 백그라운드 데이터 로컬 저장소 업데이트")

        // 백그라운드에서 받은 데이터를 로컬에 저장
        let backgroundDataKey = "background_push_data"
        var existingData = UserDefaults.standard.dictionary(forKey: backgroundDataKey) ?? [:]

        // 타임스탬프와 함께 저장
        let timestampedData: [String: Any] = [
            "userInfo": userInfo,
            "timestamp": Date().timeIntervalSince1970,
            "processed": false
        ]

        existingData["last_background_push"] = timestampedData
        UserDefaults.standard.set(existingData, forKey: backgroundDataKey)
        UserDefaults.standard.synchronize()

        print("✅ [FCM] 백그라운드 데이터 저장 완료")
    }

    private func shouldShowNotificationForBackgroundPush(_ userInfo: [AnyHashable: Any]) -> Bool {
        // 백그라운드 푸시의 경우 특정 조건에서만 알림 표시
        // 예: 긴급한 메시지이거나 사용자가 설정한 경우

        if let priority = userInfo["priority"] as? String, priority == "high" {
            return true
        }

        if let showNotification = userInfo["show_notification"] as? String, showNotification == "true" {
            return true
        }

        // 기본적으로 백그라운드 푸시는 알림을 표시하지 않음
        return false
    }

    private func showLocalNotificationForBackgroundPush(_ userInfo: [AnyHashable: Any]) {
        print("📢 [FCM] 백그라운드 푸시에 대한 로컬 알림 표시")

        guard let aps = userInfo["aps"] as? [AnyHashable: Any],
              let alert = aps["alert"] as? [AnyHashable: Any] else {
            print("⚠️ [FCM] 백그라운드 푸시 알림 데이터 없음")
            return
        }

        let content = UNMutableNotificationContent()
        content.title = alert["title"] as? String ?? "백그라운드 알림"
        content.body = alert["body"] as? String ?? ""
        content.sound = .default
        content.badge = 1
        content.userInfo = userInfo

        let request = UNNotificationRequest(identifier: "background_push_\(UUID().uuidString)", content: content, trigger: nil)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ [FCM] 백그라운드 푸시 로컬 알림 표시 실패: \(error.localizedDescription)")
            } else {
                print("✅ [FCM] 백그라운드 푸시 로컬 알림 표시 성공")
            }
        }
    }                                          

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().setAPNSToken(deviceToken as Data, type: .unknown)
        print("✅ [APNS] APNS 디바이스 토큰 등록 완료")
        
        // ✅ 즉시 FCM 토큰 가져오기 시도
        Messaging.messaging().token { token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                } else if let token = token {
                    print("✅ [FCM] FCM 토큰 즉시 가져오기 성공: \(token.prefix(30))...")
                    Utils.shared.setToken(token: token)
                    
                    // 즉시 서버에 업데이트
                    self.sendFCMTokenToServer(token: token)
                } else {
                    print("❌ [FCM] FCM 토큰이 nil입니다")
                }
            }
        }
    }
    
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("🔥 [FCM] FCM 토큰 업데이트 델리게이트 호출됨")
        print("🔥 [FCM] 새로운 FCM 토큰: \(fcmToken ?? "nil")")
        
        guard let token = fcmToken else {
            print("❌ [FCM] FCM 토큰이 nil입니다")
            return
        }
        
        Utils.shared.setToken(token: token)
        print("🔥 [FCM] Firebase registration token: \(token)")
        print("🔥 [FCM] 토큰 길이: \(token.count) 문자")
        print("🔥 [FCM] 토큰 미리보기: \(token.prefix(30))...")
        
        // 권한 상태 확인 먼저
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔥 [FCM] 토큰 업데이트 시 권한 상태: \(self.authorizationStatusString(settings.authorizationStatus))")
                
                if settings.authorizationStatus == .denied {
                    print("❌ [FCM] 경고: FCM 토큰은 있지만 푸시 알림 권한이 거부됨!")
                    return
                }
                
                // 🔔 중요: FCM 토큰 변경 감지 및 서버 업데이트
                self.checkAndUpdateFCMTokenIfNeeded(currentToken: token)
            }
        }
    }
    
    // MARK: - 🚀 FCM 토큰 직접 API 업데이트
    
    private func sendFCMTokenToServer(token: String) {
        print("🚀 [FCM API] FCM 토큰 서버 업데이트 시작")
        
        // UserDefaults에서 mt_idx 가져오기 (여러 키에서 시도)
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ?? 
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")
        
        guard let mtIdx = mtIdx, !mtIdx.isEmpty else {
            print("⚠️ [FCM API] 로그인 상태이지만 mt_idx를 찾을 수 없음 - 나중에 재시도")
            print("❌ [FCM API] 현재 사용자 정보를 찾을 수 없음 - 나중에 재시도")
            // 5초 후 재시도
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                self.retryFCMTokenUpdate(token: token, retryCount: 1)
            }
            return
        }
        
        print("✅ [FCM API] mt_idx 발견: \(mtIdx)")
        
        // API 요청 데이터 준비
        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token,
            "device_type": "ios",
            "platform": "ios"
        ]
        
        // JSON 데이터로 변환
        guard let jsonData = try? JSONSerialization.data(withJSONObject: requestData) else {
            print("❌ [FCM API] JSON 데이터 변환 실패")
            return
        }
        
        // API URL 구성
        let urlString = Http.shared.BASE_URL + Http.shared.memberFcmTokenUrl
        guard let url = URL(string: urlString) else {
            print("❌ [FCM API] 잘못된 URL: \(urlString)")
            return
        }
        
        print("🌐 [FCM API] 요청 URL: \(urlString)")
        print("📤 [FCM API] 요청 데이터: \(requestData)")
        
        // URLRequest 구성
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        
        // URLSession으로 API 호출
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                                    if let error = error {
                        print("❌ [FCM API] 네트워크 오류: \(error.localizedDescription)")
                        
                        // 🔒 네트워크 오류 시에도 플래그 해제
                        DispatchQueue.main.async {
                            UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                            UserDefaults.standard.synchronize()
                            print("🔓 [FCM] 네트워크 오류로 인한 플래그 해제됨")
                        }
                        return
                    }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ [FCM API] HTTP 응답이 아님")
                    return
                }
                
                print("📡 [FCM API] HTTP 상태 코드: \(httpResponse.statusCode)")
                
                if let data = data, let responseString = String(data: data, encoding: .utf8) {
                    print("📨 [FCM API] 서버 응답: \(responseString)")
                }
                
                                        if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                            print("✅ [FCM API] FCM 토큰 서버 업데이트 성공!")
                            
                            // 🔒 업데이트 진행 중 플래그 해제
                            UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                            UserDefaults.standard.synchronize()
                            print("🔓 [FCM] FCM 토큰 업데이트 진행 중 플래그 해제됨")
                        } else {
                            print("❌ [FCM API] FCM 토큰 서버 업데이트 실패 - 상태 코드: \(httpResponse.statusCode)")
                            
                            // 🔒 실패 시에도 플래그 해제
                            UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                            UserDefaults.standard.synchronize()
                            print("🔓 [FCM] FCM 토큰 업데이트 실패로 인한 플래그 해제됨")
                        }
            }
        }
        
        task.resume()
    }
    

    
    // MARK: - 🔔 FCM 자동 업데이트 시작 (로그인 완료 시 호출)
    @objc func startFCMAutoUpdateAfterLogin() {
        print("🚀 [FCM Auto] 로그인 완료 - FCM 자동 업데이트 시작")
        
        // 🚨 로그인 완료 시 FCM 토큰 강제 업데이트
        print("🚨 [FCM Auto] 로그인 완료 - FCM 토큰 강제 업데이트 실행")
        forceUpdateFCMToken()
        
        // 자동 업데이트 타이머 시작
        startFCMAutoTokenUpdate()
    }
    
    // MARK: - 🔔 사용자 정보 저장 시 FCM 토큰 업데이트 (MainView에서 호출)
    @objc func onUserInfoSaved() {
        print("👤 [FCM USER] 사용자 정보 저장 감지 - FCM 토큰 업데이트 트리거")
        
        // 사용자 정보가 저장된 후 FCM 토큰 업데이트
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            print("🚨 [FCM USER] 사용자 정보 저장 후 FCM 토큰 강제 업데이트 실행")
            self.forceUpdateFCMToken()
        }
    }
    
    // MARK: - 🔔 FCM 토큰 강제 업데이트 (디버깅용)
    @objc func forceUpdateFCMToken() {
        print("🚨 [FCM FORCE] FCM 토큰 강제 업데이트 시작")
        
        // 저장된 토큰 초기화
        UserDefaults.standard.removeObject(forKey: "last_fcm_token")
        UserDefaults.standard.synchronize()
        print("🗑️ [FCM FORCE] 저장된 토큰 초기화 완료")
        
        // 즉시 FCM 토큰 업데이트 실행
        updateFCMTokenIfNeeded()
    }
    
    // MARK: - 🔔 FCM 토큰 즉시 업데이트 (디버깅용)
    @objc func updateFCMTokenNow() {
        print("🚨 [FCM NOW] FCM 토큰 즉시 업데이트 실행")
        
        // 저장된 토큰 초기화
        UserDefaults.standard.removeObject(forKey: "last_fcm_token")
        UserDefaults.standard.synchronize()
        print("🗑️ [FCM NOW] 저장된 토큰 초기화 완료")
        
        // 즉시 FCM 토큰 업데이트 실행
        updateFCMTokenIfNeeded()
    }
    
    // MARK: - 🔔 FCM 토큰 상태 상세 확인 (디버깅용)
    @objc func checkFCMTokenStatus() {
        print("🔍 [FCM DEBUG] FCM 토큰 상태 상세 확인")
        
        // 1. 현재 FCM 토큰 확인
        Messaging.messaging().token { token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM DEBUG] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                    return
                }
                
                if let token = token, !token.isEmpty {
                    print("✅ [FCM DEBUG] 현재 FCM 토큰: \(token)")
                    print("📏 [FCM DEBUG] 토큰 길이: \(token.count)")
                } else {
                    print("❌ [FCM DEBUG] FCM 토큰이 nil이거나 비어있음")
                }
                
                // 2. 저장된 토큰과 비교
                let savedToken = UserDefaults.standard.string(forKey: "last_fcm_token")
                print("💾 [FCM DEBUG] 저장된 토큰: \(savedToken ?? "없음")")
                
                if let currentToken = token, let savedToken = savedToken {
                    if currentToken == savedToken {
                        print("✅ [FCM DEBUG] 토큰 일치")
                    } else {
                        print("❌ [FCM DEBUG] 토큰 불일치!")
                    }
                }
                
                // 3. 푸시 알림 권한 상태 확인
                UNUserNotificationCenter.current().getNotificationSettings { settings in
                    DispatchQueue.main.async {
                        print("🔔 [FCM DEBUG] 푸시 알림 권한 상태: \(self.authorizationStatusString(settings.authorizationStatus))")
                        print("🔔 [FCM DEBUG] 알림 허용: \(settings.alertSetting == .enabled)")
                        print("🔔 [FCM DEBUG] 배지 허용: \(settings.badgeSetting == .enabled)")
                        print("🔔 [FCM DEBUG] 소리 허용: \(settings.soundSetting == .enabled)")
                        
                        // 4. 앱 등록 상태 확인
                        if UIApplication.shared.isRegisteredForRemoteNotifications {
                            print("✅ [FCM DEBUG] 원격 알림 등록됨")
                        } else {
                            print("❌ [FCM DEBUG] 원격 알림 등록되지 않음")
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - 🔔 FCM 토큰 수동 업데이트 (웹뷰에서 호출 가능)
    @objc func updateFCMTokenManually() {
        print("🚀 [FCM MANUAL] 수동 FCM 토큰 업데이트 시작")
        
        // 현재 FCM 토큰 가져오기
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM MANUAL] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                    return
                }
                
                guard let token = token, !token.isEmpty else {
                    print("❌ [FCM MANUAL] FCM 토큰이 nil이거나 비어있음")
                    return
                }
                
                print("✅ [FCM MANUAL] FCM 토큰 가져오기 성공: \(token.prefix(50))...")
                self?.sendFCMTokenToServer(token: token)
            }
        }
    }
    
    // MARK: - 🔍 현재 FCM 토큰 상태 확인
    @objc func checkCurrentFCMTokenStatus() {
        print("🔍 [FCM STATUS] 현재 FCM 토큰 상태 확인")
        
        // UserDefaults에서 mt_idx 확인
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ?? 
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")
        
        print("🔍 [FCM STATUS] UserDefaults mt_idx: \(mtIdx ?? "nil")")
        
        // 현재 FCM 토큰 확인
        Messaging.messaging().token { token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM STATUS] FCM 토큰 확인 실패: \(error.localizedDescription)")
                    return
                }
                
                if let token = token, !token.isEmpty {
                    print("✅ [FCM STATUS] FCM 토큰 존재: \(token.prefix(50))...")
                    
                    // 🔔 FCM 토큰 상태 상세 정보 출력
                    let lastSavedToken = UserDefaults.standard.string(forKey: "last_fcm_token")
                    print("🔍 [FCM STATUS] 마지막으로 저장된 FCM 토큰: \(lastSavedToken ?? "없음")")
                    print("🔍 [FCM STATUS] 현재 FCM 토큰: \(token)")
                    print("🔍 [FCM STATUS] 토큰 변경 여부: \(lastSavedToken != token ? "변경됨" : "변경 없음")")
                    
                    // 토큰이 변경되었다면 서버에 업데이트
                    if lastSavedToken != token {
                        print("🔄 [FCM STATUS] 토큰 변경 감지 - 서버 업데이트 시작")
                        self.checkAndUpdateFCMTokenIfNeeded(currentToken: token)
                    }
                } else {
                    print("❌ [FCM STATUS] FCM 토큰이 nil이거나 비어있음")
                }
            }
        }
    }
    
    private func getCurrentUserMtIdx() -> Int? {
        // 방법 1: UserDefaults에서 사용자 정보 확인
        if let mtIdx = UserDefaults.standard.object(forKey: "mt_idx") as? Int {
            print("🔍 [FCM API] UserDefaults에서 mt_idx 찾음: \(mtIdx)")
            return mtIdx
        }
        
        // 방법 2: Utils에서 사용자 정보 확인 (기존 방식) - 비동기 처리 필요하므로 생략
        // Utils.getToken은 비동기 메서드이므로 동기적 처리가 필요한 이 컨텍스트에서는 사용하지 않음
        
        // 방법 3: 로그인 상태 확인
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in")
        if isLoggedIn {
            print("⚠️ [FCM API] 로그인 상태이지만 mt_idx를 찾을 수 없음 - 나중에 재시도")
            return nil
        }
        
        // 방법 4: 하드코딩된 테스트 사용자 (개발/테스트용)
        print("⚠️ [FCM API] 사용자 정보 없음 - 테스트 사용자(1186) 사용")
        return 1186
    }
    

    
    private func retryFCMTokenUpdate(token: String, retryCount: Int) {
        let maxRetries = 3
        
        if retryCount > maxRetries {
            print("❌ [FCM API] 최대 재시도 횟수 초과")
            
            // 🔒 재시도 실패 시 플래그 해제
            UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
            UserDefaults.standard.synchronize()
            print("🔓 [FCM] 재시도 실패로 인한 플래그 해제됨")
            return
        }
        
        print("�� [FCM API] FCM 토큰 업데이트 재시도 \(retryCount)/\(maxRetries)")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(retryCount) * 5.0) {
            self.sendFCMTokenUpdateWithRetry(token: token, retryCount: retryCount + 1)
        }
    }
    
    // MARK: - 🔄 재시도용 FCM 토큰 업데이트 (플래그 없이)
    private func sendFCMTokenUpdateWithRetry(token: String, retryCount: Int) {
        print("🔄 [FCM API] 재시도 \(retryCount) - FCM 토큰 서버 업데이트 시작")
        
        // UserDefaults에서 mt_idx 가져오기 (여러 키에서 시도)
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")
        
        guard let mtIdx = mtIdx, !mtIdx.isEmpty else {
            print("⚠️ [FCM API] 재시도 \(retryCount) - mt_idx를 찾을 수 없음")
            if retryCount < 3 {
                self.retryFCMTokenUpdate(token: token, retryCount: retryCount)
            } else {
                // 🔒 최대 재시도 실패 시 플래그 해제
                UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                UserDefaults.standard.synchronize()
                print("🔓 [FCM] 최대 재시도 실패로 인한 플래그 해제됨")
            }
            return
        }
        
        print("✅ [FCM API] 재시도 \(retryCount) - mt_idx 발견: \(mtIdx)")
        
        // API 요청 데이터 준비
        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token,
            "device_type": "ios",
            "platform": "ios"
        ]
        
        // JSON 데이터로 변환
        guard let jsonData = try? JSONSerialization.data(withJSONObject: requestData) else {
            print("❌ [FCM API] 재시도 \(retryCount) - JSON 데이터 변환 실패")
            return
        }
        
        // API URL 구성
        let urlString = Http.shared.BASE_URL + Http.shared.memberFcmTokenUrl
        guard let url = URL(string: urlString) else {
            print("❌ [FCM API] 재시도 \(retryCount) - 잘못된 URL: \(urlString)")
            return
        }
        
        print("🌐 [FCM API] 재시도 \(retryCount) - 요청 URL: \(urlString)")
        print("📤 [FCM API] 재시도 \(retryCount) - 요청 데이터: \(requestData)")
        
        // URLRequest 구성
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        
        // URLSession으로 API 호출
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM API] 재시도 \(retryCount) - 네트워크 오류: \(error.localizedDescription)")
                    if retryCount < 3 {
                        self?.retryFCMTokenUpdate(token: token, retryCount: retryCount)
                    } else {
                        // 🔒 최대 재시도 실패 시 플래그 해제
                        UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                        UserDefaults.standard.synchronize()
                        print("🔓 [FCM] 최대 재시도 실패로 인한 플래그 해제됨")
                    }
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ [FCM API] 재시도 \(retryCount) - HTTP 응답이 아님")
                    return
                }
                
                print("📡 [FCM API] 재시도 \(retryCount) - HTTP 상태 코드: \(httpResponse.statusCode)")
                
                if let data = data, let responseString = String(data: data, encoding: .utf8) {
                    print("📨 [FCM API] 재시도 \(retryCount) - 서버 응답: \(responseString)")
                }
                
                if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                    print("✅ [FCM API] 재시도 \(retryCount) - FCM 토큰 업데이트 성공!")
                    
                    // 🔒 업데이트 진행 중 플래그 해제
                    UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                    UserDefaults.standard.synchronize()
                    print("🔓 [FCM] 재시도 성공으로 인한 플래그 해제됨")
                } else {
                    print("❌ [FCM API] 재시도 \(retryCount) - FCM 토큰 업데이트 실패 - 상태 코드: \(httpResponse.statusCode)")
                    
                    if retryCount < 3 {
                        self?.retryFCMTokenUpdate(token: token, retryCount: retryCount)
                    } else {
                        // 🔒 최대 재시도 실패 시 플래그 해제
                        UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                        UserDefaults.standard.synchronize()
                        print("🔓 [FCM] 재시도 실패로 인한 플래그 해제됨")
                    }
                }
            }
        }
        
        task.resume()
    }
    
    private func verifyFCMTokenUpdate(mtIdx: Int) {
        print("🔍 [FCM API] FCM 토큰 업데이트 확인 시작")
        
        guard let url = URL(string: "https://api3.smap.site/api/v1/member-fcm-token/status/\(mtIdx)") else {
            print("❌ [FCM API] 잘못된 확인 URL")
            return
        }
        
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM API] 확인 요청 오류: \(error.localizedDescription)")
                    return
                }
                
                if let data = data {
                    do {
                        if let jsonResponse = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                            print("📋 [FCM API] 토큰 상태 확인: \(jsonResponse)")
                            
                            if let hasToken = jsonResponse["has_token"] as? Bool, hasToken {
                                if let tokenPreview = jsonResponse["token_preview"] as? String {
                                    print("✅ [FCM API] DB에 토큰 저장 확인됨: \(tokenPreview)")
                                }
                            } else {
                                print("❌ [FCM API] DB에 토큰이 저장되지 않음")
                            }
                        }
                    } catch {
                        print("❌ [FCM API] 확인 응답 파싱 오류: \(error.localizedDescription)")
                    }
                }
            }
        }
        
        task.resume()
    }
    
    func setAlarmPermission(escapingHandler : @escaping (Bool) -> ()) -> Void {
        UNUserNotificationCenter.current().delegate = self

        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(
            options: authOptions,
            completionHandler: {didAllow,error in
                if error != nil {
                    escapingHandler(false)
                    return
                }
                
                if didAllow {
                    escapingHandler(true)
                } else {
                    escapingHandler(false)
                }
            })

        UIApplication.shared.registerForRemoteNotifications()
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        let userInfo: [AnyHashable: Any] = ["state": "background"]

        NotificationCenter.default.post(name: Notification.Name("appStateChange"), object: nil, userInfo: userInfo)

        // ✅ 백그라운드 진입 시 포그라운드용 FCM 자동 토큰 업데이트 중지
        stopFCMAutoTokenUpdate()

        // 🚀 백그라운드 진입 시 백그라운드용 FCM 토큰 검증 타이머 시작
        startBackgroundFCMTimer()

        // 백그라운드 진입 시 FCM 토큰 상태 확인 및 갱신 준비
        print("🔄 [FCM] 백그라운드 진입 - FCM 토큰 상태 준비")
        prepareFCMTokenForBackground()

        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }
    
    func applicationWillEnterForeground(_ application: UIApplication) {
        UIApplication.shared.applicationIconBadgeNumber = 0

        let userInfo: [AnyHashable: Any] = ["state": "foreground"]

        NotificationCenter.default.post(name: Notification.Name("appStateChange"), object: nil, userInfo: userInfo)
        NotificationCenter.default.post(name: Notification.Name("appStateForeground"), object: nil, userInfo: nil)

        // ✅ 포그라운드 진입 시 백그라운드 FCM 타이머 중지
        stopBackgroundFCMTimer()

        // 🚀 포그라운드 진입 시 포그라운드용 FCM 토큰 업데이트 시작
        if UserDefaults.standard.bool(forKey: "is_logged_in") {
            print("✅ [FCM] 포그라운드 진입 - FCM 자동 업데이트 재시작")
            startFCMAutoTokenUpdate()
        }

        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }
    
    // MARK: - URL Scheme 처리
    
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        print("📱 AppDelegate: URL 열기 요청 - \(url)")
        print("📱 URL Scheme: \(url.scheme ?? "nil")")
        print("📱 URL Host: \(url.host ?? "nil")")
        
        // Google Sign-In URL 처리
        if GIDSignIn.sharedInstance.handle(url) {
            print("✅ Google Sign-In URL 처리됨")
            return true
        }
        
        // Kakao Login URL 처리
        if AuthApi.isKakaoTalkLoginUrl(url) {
            print("✅ Kakao Login URL 처리됨")
            return AuthController.handleOpenUrl(url: url)
        }
        
        // 기존 딥링크 처리
        if url.scheme == "smapapp" {
            print("딥링크 URL: \(url)")
            
            if url.host == "invitation" {
                let invitation_code = url.lastPathComponent
                UserDefaults.standard.set(invitation_code, forKey: "invitation_code")
                print("초대 코드: \(invitation_code)")
                
                NotificationCenter.default.post(
                    name: NSNotification.Name(rawValue: "getDeepLink"),
                    object: nil,
                    userInfo: ["invitation_code": invitation_code]
                )
            } else {
                let event_url = url.absoluteString
                UserDefaults.standard.set(event_url, forKey: "event_url")
                print("이벤트 URL: \(event_url)")
                
                NotificationCenter.default.post(
                    name: NSNotification.Name(rawValue: "getPush"),
                    object: nil,
                    userInfo: ["event_url": event_url]
                )
            }
            return true
        }
        
        print("⚠️ 처리되지 않은 URL: \(url)")
        return false
    }
    
    // MARK: - 🔔 백그라운드 FCM 메시지 처리 헬퍼 메서드들

    private func handleBackgroundFCMMessage(_ userInfo: [AnyHashable : Any]) {
        print("🔄 [FCM] 백그라운드 FCM 메시지 처리 시작")

        // 메시지를 로컬 저장소에 큐잉 (앱 재시작 시 처리)
        saveFCMMessageToQueue(userInfo)

        // 중요 메시지인 경우 로컬 알림 표시
        if isImportantMessage(userInfo) {
            showLocalNotificationForFCMMessage(userInfo)
        }
    }

    private func saveFCMMessageToQueue(_ userInfo: [AnyHashable : Any]) {
        print("💾 [FCM] FCM 메시지를 큐에 저장")

        var queuedMessages = UserDefaults.standard.array(forKey: "fcm_message_queue") as? [[AnyHashable: Any]] ?? []

        // 큐 크기 제한 (최대 50개)
        if queuedMessages.count >= 50 {
            queuedMessages.removeFirst()
        }

        let messageWithTimestamp: [AnyHashable: Any] = [
            "userInfo": userInfo,
            "timestamp": Date().timeIntervalSince1970,
            "processed": false
        ]

        queuedMessages.append(messageWithTimestamp)

        UserDefaults.standard.set(queuedMessages, forKey: "fcm_message_queue")
        UserDefaults.standard.synchronize()

        print("✅ [FCM] 큐에 메시지 저장 완료 (총 \(queuedMessages.count)개)")
    }

    private func isImportantMessage(_ userInfo: [AnyHashable : Any]) -> Bool {
        // 일정 관련 메시지나 중요한 알림은 중요 메시지로 간주
        if let aps = userInfo["aps"] as? [AnyHashable: Any],
           let alert = aps["alert"] as? [AnyHashable: Any],
           let title = alert["title"] as? String {
            return title.contains("일정") || title.contains("알림") || title.contains("초대")
        }
        return false
    }

    private func showLocalNotificationForFCMMessage(_ userInfo: [AnyHashable : Any]) {
        print("📢 [FCM] 중요 메시지에 대한 로컬 알림 표시")

        guard let aps = userInfo["aps"] as? [AnyHashable: Any],
              let alert = aps["alert"] as? [AnyHashable: Any] else { return }

        let content = UNMutableNotificationContent()
        content.title = alert["title"] as? String ?? "알림"
        content.body = alert["body"] as? String ?? ""
        content.sound = .default
        content.badge = 1

        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ [FCM] 로컬 알림 표시 실패: \(error.localizedDescription)")
            } else {
                print("✅ [FCM] 로컬 알림 표시 성공")
            }
        }
    }

    // MARK: - 📋 큐에 저장된 메시지 처리
    func processQueuedFCMMessages() {
        print("🔄 [FCM] 큐에 저장된 메시지들 처리 시작")

        guard let queuedMessages = UserDefaults.standard.array(forKey: "fcm_message_queue") as? [[AnyHashable: Any]] else {
            print("ℹ️ [FCM] 처리할 큐 메시지가 없음")
            return
        }

        var processedCount = 0
        for messageData in queuedMessages {
            if let userInfo = messageData["userInfo"] as? [AnyHashable: Any],
               let processed = messageData["processed"] as? Bool,
               !processed {
                // 메시지 처리
                processQueuedMessage(userInfo)
                processedCount += 1
            }
        }

        if processedCount > 0 {
            print("✅ [FCM] \(processedCount)개의 큐 메시지 처리 완료")
            // 처리된 메시지들은 다음 앱 시작 때까지 유지 (중복 처리 방지)
        } else {
            print("ℹ️ [FCM] 처리할 새로운 큐 메시지가 없음")
        }
    }

    private func processQueuedMessage(_ userInfo: [AnyHashable: Any]) {
        print("📨 [FCM] 큐 메시지 처리: \(userInfo)")

        // WebView에 메시지 전달 (WebView가 로드된 경우)
        if let webView = findWebViewInHierarchy() {
            DispatchQueue.main.async {
                let messageData = [
                    "type": "queued_fcm_message",
                    "userInfo": userInfo,
                    "timestamp": Date().timeIntervalSince1970
                ] as [String: Any]

                if let jsonData = try? JSONSerialization.data(withJSONObject: messageData),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    let jsCode = "window.dispatchEvent(new CustomEvent('queuedFCMMessage', { detail: \(jsonString) }));"
                    webView.evaluateJavaScript(jsCode) { result, error in
                        if let error = error {
                            print("❌ [FCM] 큐 메시지 WebView 전달 실패: \(error.localizedDescription)")
                        } else {
                            print("✅ [FCM] 큐 메시지 WebView 전달 성공")
                        }
                    }
                }
            }
        }
    }

    // MARK: - 🔄 백그라운드 푸시 데이터 처리
    func processBackgroundPushData() {
        print("🔄 [FCM] 백그라운드 푸시 데이터 처리 시작")

        guard let backgroundData = UserDefaults.standard.dictionary(forKey: "background_push_data") else {
            print("ℹ️ [FCM] 처리할 백그라운드 푸시 데이터가 없음")
            return
        }

        var processedCount = 0
        for (key, value) in backgroundData {
            if key == "last_background_push",
               let pushData = value as? [String: Any],
               let processed = pushData["processed"] as? Bool,
               !processed {

                // 백그라운드 푸시 데이터를 WebView에 전달
                processBackgroundPushToWebView(pushData)
                processedCount += 1

                // 처리 완료로 표시
                var updatedData = pushData
                updatedData["processed"] = true
                var updatedBackgroundData = backgroundData
                updatedBackgroundData[key] = updatedData
                UserDefaults.standard.set(updatedBackgroundData, forKey: "background_push_data")
                UserDefaults.standard.synchronize()
            }
        }

        if processedCount > 0 {
            print("✅ [FCM] \(processedCount)개의 백그라운드 푸시 데이터 처리 완료")
        } else {
            print("ℹ️ [FCM] 처리할 새로운 백그라운드 푸시 데이터가 없음")
        }
    }

    private func processBackgroundPushToWebView(_ pushData: [String: Any]) {
        print("📨 [FCM] 백그라운드 푸시 데이터를 WebView에 전달")

        if let webView = findWebViewInHierarchy() {
            DispatchQueue.main.async {
                let messageData = [
                    "type": "background_push_data",
                    "pushData": pushData,
                    "timestamp": Date().timeIntervalSince1970
                ] as [String: Any]

                if let jsonData = try? JSONSerialization.data(withJSONObject: messageData),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    let jsCode = "window.dispatchEvent(new CustomEvent('backgroundPushData', { detail: \(jsonString) }));"
                    webView.evaluateJavaScript(jsCode) { result, error in
                        if let error = error {
                            print("❌ [FCM] 백그라운드 푸시 데이터 WebView 전달 실패: \(error.localizedDescription)")
                        } else {
                            print("✅ [FCM] 백그라운드 푸시 데이터 WebView 전달 성공")
                        }
                    }
                }
            }
        } else {
            print("⚠️ [FCM] WebView를 찾을 수 없어 백그라운드 푸시 데이터 처리 스킵")
        }
    }

    private func findWebViewInHierarchy() -> WKWebView? {
        guard let window = UIApplication.shared.windows.first else { return nil }

        func findWebView(in view: UIView) -> WKWebView? {
            if let webView = view as? WKWebView {
                return webView
            }
            for subview in view.subviews {
                if let found = findWebView(in: subview) {
                    return found
                }
            }
            return nil
        }

        return findWebView(in: window)
    }

    // MARK: - 🔄 백그라운드 FCM 토큰 준비
    private func prepareFCMTokenForBackground() {
        print("🔄 [FCM] 백그라운드 FCM 토큰 준비 시작")

        // 로그인 상태 확인
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        guard isLoggedIn else {
            print("🔒 [FCM] 로그인 상태가 아님 - 백그라운드 FCM 준비 스킵")
            return
        }

        // 현재 FCM 토큰 확인
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM] 백그라운드 토큰 확인 실패: \(error.localizedDescription)")
                    return
                }

                guard let token = token, !token.isEmpty else {
                    print("❌ [FCM] 백그라운드 토큰이 없음")
                    return
                }

                print("✅ [FCM] 백그라운드 토큰 준비 완료: \(token.prefix(30))...")

                // 토큰이 백그라운드에서도 유효한지 서버에 확인
                self?.validateFCMTokenForBackground(token: token)

                // 백그라운드 푸시 수신 준비 완료 로그
                print("🔄 [FCM] 백그라운드 푸시 수신 준비 완료")
            }
        }
    }

    // MARK: - 🔍 백그라운드 FCM 토큰 유효성 검증
    private func validateFCMTokenForBackground(token: String) {
        print("🔍 [FCM] 백그라운드 FCM 토큰 유효성 검증 시작")

        // 사용자 정보 확인
        guard let mtIdxString = UserDefaults.standard.string(forKey: "mt_idx") ??
                              UserDefaults.standard.string(forKey: "savedMtIdx") ??
                              UserDefaults.standard.string(forKey: "current_mt_idx"),
              let mtIdx = Int(mtIdxString) else {
            print("❌ [FCM] 백그라운드 검증 실패 - 사용자 정보 없음")
            return
        }

        // 새로운 백그라운드 토큰 검증 API 사용
        let urlString = "\(Http.shared.BASE_URL)\(Http.shared.memberFcmTokenUrl)/background-check"
        guard let url = URL(string: urlString) else {
            print("❌ [FCM] 백그라운드 검증 실패 - 잘못된 URL")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token,
            "check_type": "background",
            "force_refresh": false
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: requestData)
        } catch {
            print("❌ [FCM] 백그라운드 검증 실패 - JSON 변환 오류")
            return
        }

        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM] 백그라운드 검증 네트워크 오류: \(error.localizedDescription)")
                    return
                }

                if let httpResponse = response as? HTTPURLResponse {
                    print("📡 [FCM] 백그라운드 검증 HTTP 상태: \(httpResponse.statusCode)")

                    if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                        print("✅ [FCM] 백그라운드 FCM 토큰 검증 성공")

                        // 응답 데이터 확인 (토큰 갱신 여부)
                        if let data = data {
                            do {
                                if let jsonResponse = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                                   let success = jsonResponse["success"] as? Bool, success,
                                   let message = jsonResponse["message"] as? String {
                                    print("📋 [FCM] 백그라운드 검증 응답: \(message)")

                                    // 토큰이 갱신된 경우 로컬에도 업데이트
                                    if message.contains("갱신") {
                                        UserDefaults.standard.set(token, forKey: "last_fcm_token")
                                        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_fcm_token_update_time")
                                        UserDefaults.standard.synchronize()
                                    }
                                }
                            } catch {
                                print("❌ [FCM] 백그라운드 검증 응답 파싱 오류: \(error.localizedDescription)")
                            }
                        }
                    } else {
                        print("⚠️ [FCM] 백그라운드 FCM 토큰 검증 실패 - 상태 코드: \(httpResponse.statusCode)")
                    }
                }
            }
        }.resume()
    }

    // MARK: - 정리
    deinit {
        print("🧹 [FCM Auto] AppDelegate 정리 시작")

        // FCM 자동 토큰 업데이트 타이머 정리
        stopFCMAutoTokenUpdate()

        // 백그라운드 FCM 토큰 검증 타이머 정리
        stopBackgroundFCMTimer()

        // 앱 상태 변화 감지기 제거
        NotificationCenter.default.removeObserver(self)

        print("✅ [FCM Auto] AppDelegate 정리 완료")
    }
}

// MARK: - 🚨 Permission Debug Guards (Swizzling)
import ObjectiveC

extension AppDelegate {
    fileprivate func debugPrintUsageDescriptions() {
        print("🔎 [PERM] UsageDescription 체크 시작")
        
        // 번들 정보 상세 출력
        print("🔎 [PERM] Bundle Path: \(Bundle.main.bundlePath)")
        print("🔎 [PERM] Bundle URL: \(Bundle.main.bundleURL)")
        print("🔎 [PERM] BundleIdentifier: \(Bundle.main.bundleIdentifier ?? "nil")")
        
        // Info.plist 파일 직접 읽기 시도
        let infoPlistPath = Bundle.main.path(forResource: "Info", ofType: "plist")
        print("🔎 [PERM] Info.plist Path: \(infoPlistPath ?? "NOT FOUND")")
        
        if let path = infoPlistPath,
           let plistData = NSDictionary(contentsOfFile: path) {
            print("🔎 [PERM] Info.plist 직접 읽기 성공")
            print("🔎 [PERM] Direct NSCameraUsageDescription: \(plistData["NSCameraUsageDescription"] as? String ?? "EMPTY")")
            print("🔎 [PERM] Direct NSPhotoLibraryUsageDescription: \(plistData["NSPhotoLibraryUsageDescription"] as? String ?? "EMPTY")")
            print("🔎 [PERM] Direct NSMotionUsageDescription: \(plistData["NSMotionUsageDescription"] as? String ?? "EMPTY")")
            print("🔎 [PERM] Direct NSLocationWhenInUseUsageDescription: \(plistData["NSLocationWhenInUseUsageDescription"] as? String ?? "EMPTY")")
            
            // 🔧 실제 번들 내 Info.plist 파일의 모든 키 출력
            print("🔎 [PERM] 실제 Info.plist 파일 내 모든 키:")
            let allKeys = plistData.allKeys.compactMap { $0 as? String }.sorted()
            for key in allKeys.filter({ $0.contains("Usage") }) {
                let value = plistData[key] as? String ?? "nil"
                print("   \(key): \(value)")
            }
        } else {
            print("🔎 [PERM] Info.plist 직접 읽기 실패")
        }
        
        // Bundle.main을 통한 읽기 (기존)
        let keys = [
            "NSCameraUsageDescription",
            "NSPhotoLibraryUsageDescription", 
            "NSPhotoLibraryAddUsageDescription",
            "NSMotionUsageDescription",
            "NSLocationWhenInUseUsageDescription",
            "NSLocationAlwaysAndWhenInUseUsageDescription"
        ]
        
        for key in keys {
            let value = Bundle.main.object(forInfoDictionaryKey: key) as? String
            print("🔎 [PERM] Bundle \(key): \(value ?? "<nil>")")
        }
        
        // infoDictionary 전체 출력 (일부만)
        if let infoDict = Bundle.main.infoDictionary {
            print("🔎 [PERM] infoDictionary keys count: \(infoDict.keys.count)")
            let permissionKeys = infoDict.keys.filter { $0.contains("Usage") }
            print("🔎 [PERM] Found permission keys: \(permissionKeys)")
        }
    }
    
    fileprivate func checkAndWarnEmptyUsageDescriptions() {
        let criticalKeys = [
            "NSCameraUsageDescription": "카메라",
            "NSPhotoLibraryUsageDescription": "사진 보관함",
            "NSMotionUsageDescription": "모션",
            "NSLocationWhenInUseUsageDescription": "위치"
        ]
        
        var emptyKeys: [String] = []
        for (key, name) in criticalKeys {
            let value = Bundle.main.object(forInfoDictionaryKey: key) as? String
            if value?.isEmpty != false {
                emptyKeys.append("\(name)(\(key))")
            }
        }
        
        if !emptyKeys.isEmpty {
            print("🚨🚨🚨 [CRITICAL] Info.plist UsageDescription 값들이 런타임에서 비어있습니다!")
            print("🚨🚨🚨 [CRITICAL] 비어있는 키들: \(emptyKeys.joined(separator: ", "))")
            print("🚨🚨🚨 [CRITICAL] 시스템 권한 다이얼로그에서 설명이 표시되지 않습니다!")
            print("🔧 [FIX] 해결 방법:")
            print("   1. Xcode에서 Shift+Cmd+K (Clean Build Folder)")
            print("   2. 시뮬레이터/기기에서 앱 완전 삭제")
            print("   3. 프로젝트 재빌드 및 설치")
            print("   4. Build Settings > Packaging > Info.plist File 경로 확인")
        } else {
            print("✅ [PERM] 모든 필수 UsageDescription 값들이 정상적으로 로드됨")
        }
        
        // 🔧 Info.plist 문제 해결 시도: 런타임에서 강제로 설정
        if !emptyKeys.isEmpty {
            print("🔧 [FIX] Info.plist 문제로 인해 런타임 하드코딩 설명 사용 활성화")
            setupRuntimePermissionDescriptions()
        }
    }
    

    
    private func setupRuntimePermissionDescriptions() {
        print("🔧 [RUNTIME] 런타임 권한 설명 설정 시작")
        
        // Bundle의 Info dictionary에 직접 값 설정 시도 (읽기 전용이므로 실패할 가능성 높음)
        // 하지만 iOS는 이미 앱 시작 시 Info.plist를 로드하므로 런타임에서 수정 불가
        
        // 대신 권한 요청 시 커스텀 alert를 먼저 보여주는 방식으로 해결
        print("🔧 [RUNTIME] Info.plist는 런타임에서 수정 불가 - 권한 요청 시 커스텀 설명 제공 예정")
    }
    
    private static var didInstallDebugGuards = false
    static func installPermissionDebugGuards() {
        guard !didInstallDebugGuards else { return }
        didInstallDebugGuards = true
        UNUserNotificationCenter.smap_installRequestAuthSwizzle()
        CLLocationManager.smap_installLocationAuthSwizzle()
    }
    
}

extension UNUserNotificationCenter {
    private static let smap_swizzleOnce: Void = {
        let originalSelector = #selector(UNUserNotificationCenter.requestAuthorization(options:completionHandler:))
        let swizzledSelector = #selector(UNUserNotificationCenter.smap_requestAuthorization(options:completionHandler:))
        if let originalMethod = class_getInstanceMethod(UNUserNotificationCenter.self, originalSelector),
           let swizzledMethod = class_getInstanceMethod(UNUserNotificationCenter.self, swizzledSelector) {
            method_exchangeImplementations(originalMethod, swizzledMethod)
            print("🧩 [SWZ-PUSH] requestAuthorization swizzled for debug logging")
        } else {
            print("❌ [SWZ-PUSH] Failed to swizzle requestAuthorization")
        }
    }()
    static func smap_installRequestAuthSwizzle() {
        _ = smap_swizzleOnce
    }

    @objc func smap_requestAuthorization(options: UNAuthorizationOptions, completionHandler: @escaping (Bool, Error?) -> Void) {
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in")
        let stack = Thread.callStackSymbols.joined(separator: "\n")
        print("🛑 [SWZ-PUSH] requestAuthorization intercepted. isLoggedIn=\(isLoggedIn). Options=\(options).\n📚 CallStack:\n\(stack)")
        if !isLoggedIn {
            print("🛑 [SWZ-PUSH] Blocked push permission before login → returning (false)")
            DispatchQueue.main.async { completionHandler(false, nil) }
            return
        }
        // Call original (swizzled) implementation
        self.smap_requestAuthorization(options: options, completionHandler: completionHandler)
    }
}

// MARK: - 🧩 CLLocationManager Swizzle (requestWhenInUseAuthorization / requestAlwaysAuthorization)
extension CLLocationManager {
    private static let smap_swizzleOnceLoc: Void = {
        let targetPairs: [(Selector, Selector)] = [
            (#selector(CLLocationManager.requestWhenInUseAuthorization), #selector(CLLocationManager.smap_requestWhenInUseAuthorization)),
            (#selector(CLLocationManager.requestAlwaysAuthorization), #selector(CLLocationManager.smap_requestAlwaysAuthorization))
        ]
        for (origSel, swzSel) in targetPairs {
            if let m1 = class_getInstanceMethod(CLLocationManager.self, origSel),
               let m2 = class_getInstanceMethod(CLLocationManager.self, swzSel) {
                method_exchangeImplementations(m1, m2)
            }
        }
        print("🧩 [SWZ-LOC] CLLocationManager auth methods swizzled for debug logging")
    }()
    static func smap_installLocationAuthSwizzle() { _ = smap_swizzleOnceLoc }

    @objc func smap_requestWhenInUseAuthorization() {
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in")
        let allowNow = UserDefaults.standard.bool(forKey: "smap_allow_location_request_now")
        let stack = Thread.callStackSymbols.joined(separator: "\n")
        print("🛑 [SWZ-LOC] requestWhenInUseAuthorization intercepted. isLoggedIn=\(isLoggedIn), allowNow=\(allowNow)\n📚 CallStack:\n\(stack)")
        guard isLoggedIn && allowNow else {
            print("🛑 [SWZ-LOC] Blocked location auth request (not allowed at this stage)")
            return
        }
        UserDefaults.standard.set(false, forKey: "smap_allow_location_request_now")
        self.smap_requestWhenInUseAuthorization()
    }

    @objc func smap_requestAlwaysAuthorization() {
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in")
        let allowNow = UserDefaults.standard.bool(forKey: "smap_allow_location_request_now")
        print("🛑 [SWZ-LOC] requestAlwaysAuthorization intercepted. isLoggedIn=\(isLoggedIn), allowNow=\(allowNow)")
        guard isLoggedIn && allowNow else {
            print("🛑 [SWZ-LOC] Blocked location ALWAYS auth request")
            return
        }
        UserDefaults.standard.set(false, forKey: "smap_allow_location_request_now")
        self.smap_requestAlwaysAuthorization()
    }
}


