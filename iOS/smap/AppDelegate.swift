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
    
    // MARK: - FCM 토큰 관리 관련 프로퍼티 (최소화)
    private var lastFCMTokenUpdateTime: Date?
    private var isFCMUpdateInProgress = false
    private var shouldUpdateFCMToken: Bool = false // 토큰 업데이트 필요 여부
    
    var title = String()
    var body = String()
    var event_url = String()

    // APNS 및 FCM 토큰 저장용 프로퍼티
    private var currentAPNSToken: String?
    private var currentFCMToken: String?

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

        
        // ✅ FCM 자동 초기화 비활성화 - 토큰 변경 방지
        Messaging.messaging().isAutoInitEnabled = false
        print("✅ [FCM] 자동 초기화 비활성화 - 토큰 변경 방지")
        
        // ✅ FCM delegate 설정 (필요할 때만 토큰 업데이트)
        Messaging.messaging().delegate = self
        print("✅ [FCM] FCM delegate 설정 완료 (최소 토큰 업데이트)")
        
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

        // 🚀 앱 시작 시 FCM 토큰 즉시 검증 (완전 종료 후 재시작 대비)
        performAppLaunchFCMTokenCheck()

        // 📱 푸시 알림으로 앱이 실행되었는지 확인 (완전 종료 후 재시작)
        if let launchOptions = launchOptions {
            if let notification = launchOptions[UIApplication.LaunchOptionsKey.remoteNotification] as? [AnyHashable: Any] {
                print("📱 앱이 푸시 알림으로 완전 종료 후 재실행됨")
                print("📨 푸시 데이터: \(notification)")

                // 푸시 데이터를 저장하여 앱이 활성화되었을 때 처리
                UserDefaults.standard.set(notification, forKey: "launch_push_notification")
                UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_app_restart_by_push")
                UserDefaults.standard.synchronize()

                print("💾 푸시 데이터 저장됨 - 앱 활성화 시 처리 예정")
            }
        }

        return true
    }

    // MARK: - 🚀 앱 시작 시 FCM 토큰 즉시 검증
    private func performAppLaunchFCMTokenCheck() {
        print("🚀 앱 시작 시 FCM 토큰 즉시 검증 시작")

        // 마지막 앱 실행 시간 확인
        let lastAppLaunchTime = UserDefaults.standard.double(forKey: "last_app_launch_time")
        let currentTime = Date().timeIntervalSince1970
        let timeSinceLastLaunch = currentTime - lastAppLaunchTime

        // 푸시로 인해 앱이 재시작되었는지 확인
        let lastAppRestartByPush = UserDefaults.standard.double(forKey: "last_app_restart_by_push")
        let wasRestartedByPush = (currentTime - lastAppRestartByPush) < 60 // 1분 이내 재시작

        print("📊 마지막 앱 실행으로부터 \(String(format: "%.1f", timeSinceLastLaunch / 3600))시간 경과")
        print("📱 푸시로 인한 재시작: \(wasRestartedByPush ? "✅" : "❌")")

        // 푸시로 인해 재시작되었거나 오랜 시간 경과한 경우 더 철저한 토큰 검증
        if wasRestartedByPush || timeSinceLastLaunch > (6 * 60 * 60) { // 6시간 이상 경과
            print("🚨 앱 재시작 또는 장시간 경과로 인한 철저한 토큰 검증 실행")
        }

        // 현재 앱 실행 시간 기록
        UserDefaults.standard.set(currentTime, forKey: "last_app_launch_time")
        UserDefaults.standard.synchronize()

        // FCM 토큰 상태 확인 및 필요시 강제 업데이트
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { // Firebase 초기화 대기
            Messaging.messaging().token { token, error in
                DispatchQueue.main.async {
                    if let error = error {
                        print("❌ 앱 시작 FCM 토큰 확인 실패: \(error.localizedDescription)")
                        return
                    }

                    guard let token = token, !token.isEmpty else {
                        print("❌ 앱 시작 FCM 토큰 없음 - APNS 토큰 등록 재시도")
                        // APNS 토큰 재등록 시도
                        UIApplication.shared.registerForRemoteNotifications()
                        return
                    }

                    print("✅ 앱 시작 FCM 토큰 확인 성공: \(token.prefix(30))...")

                    // 저장된 토큰과 비교
                    let savedToken = UserDefaults.standard.string(forKey: "last_fcm_token")
                    let lastTokenUpdateTime = UserDefaults.standard.double(forKey: "last_fcm_token_update_time")

                    if savedToken != token {
                        print("🔄 FCM 토큰 변경 감지 - 서버 업데이트 즉시 실행")
                        self.sendFCMTokenToServer(token: token) { success in
                            if success {
                                print("✅ FCM 토큰 변경 감지 - 서버 업데이트 성공")
                            } else {
                                print("❌ FCM 토큰 변경 감지 - 서버 업데이트 실패")
                            }
                        }
                    } else if currentTime - lastTokenUpdateTime > (24 * 60 * 60) { // 24시간 이상 경과
                        print("⏰ FCM 토큰 24시간 이상 업데이트되지 않음 - 서버 재동기화")
                        self.sendFCMTokenToServer(token: token) { success in
                            if success {
                                print("✅ FCM 토큰 24시간 경과 - 서버 재동기화 성공")
                            } else {
                                print("❌ FCM 토큰 24시간 경과 - 서버 재동기화 실패")
                            }
                        }
                    } else {
                        print("✅ FCM 토큰 상태 양호 - 추가 작업 불필요")
                    }

                    // 로그인 상태 확인 후 토큰 검증
                    let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                                    UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                                    UserDefaults.standard.string(forKey: "savedMtIdx") != nil

                    if isLoggedIn {
                        print("👤 로그인 상태 확인됨 - FCM 토큰 검증 실행")
                        self.performFCMTokenValidation()
                    }
                }
            }
        }
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
            print("✅ [FCM Auto] 로그인 상태 감지됨 - 수동 토큰 검증만 진행")
            // 🚨 앱 시작 시 즉시 FCM 토큰 확인 및 갱신 (타이머 제거됨)
            performImmediateFCMTokenValidation()
        } else {
            print("🔒 [FCM Auto] 로그인 상태가 아님 - 토큰 검증 대기")
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
                self?.sendFCMTokenToServer(token: token) { success in
                    if success {
                        print("✅ [FCM Force] 새 토큰 서버 업데이트 성공")
                    } else {
                        print("❌ [FCM Force] 새 토큰 서버 업데이트 실패")
                    }
                }
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
    
        // 타이머 기반 자동 업데이트 제거됨

    // 백그라운드 타이머 기반 토큰 검증 제거됨

    // MARK: - 백그라운드 FCM 토큰 검증 실행 (타이머 제거됨)
    private func performBackgroundFCMTokenCheck() { // 호출되지 않음
        print("🔍 [FCM Background] 백그라운드 FCM 토큰 검증 시작")

        // 로그인 상태 확인
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        guard isLoggedIn else {
            print("🔒 [FCM Background] 로그인 상태가 아님 - 백그라운드 검증 스킵")
            return
        }

        // 백그라운드 시간 체크 제거됨 (타이머 기반 검증 제거)

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

    // MARK: - 백그라운드용 강제 토큰 갱신 (타이머 제거됨)
    private func forceRefreshFCMTokenForBackground() { // 호출되지 않음
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
                self?.sendFCMTokenToServer(token: token) { success in
                    if success {
                        print("✅ [FCM Background] 백그라운드 토큰 서버 업데이트 성공")
                    } else {
                        print("❌ [FCM Background] 백그라운드 토큰 서버 업데이트 실패")
                    }
                }

                // 백그라운드 시간 리셋 제거됨 (타이머 기반 검증 제거)
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
        self.sendFCMTokenToServer(token: currentToken) { success in
            if success {
                print("✅ [FCM] FCM 토큰 강제 업데이트 성공")
            } else {
                print("❌ [FCM] FCM 토큰 강제 업데이트 실패")
            }
        }

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

            // ✅ FCM 토큰 검증 시작 (타이머 제거됨)

            // 🔔 큐에 저장된 FCM 메시지들 처리
            processQueuedFCMMessages()

            // 🔄 백그라운드 푸시 데이터 처리
            processBackgroundPushData()

            // 📱 앱 시작 시 저장된 푸시 데이터 처리
            processLaunchPushNotification()
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

        // FCM 메시지 기록 및 통계 (진단용)
        UserDefaults.standard.set(userInfo, forKey: "last_fcm_message")

        // 포그라운드 알림 통계 기록
        let count = UserDefaults.standard.integer(forKey: "foreground_push_count") + 1
        UserDefaults.standard.set(count, forKey: "foreground_push_count")
        UserDefaults.standard.synchronize()

        // Notification 객체가 포함된 경우 이를 우선 사용 (iOS 푸시 문제 해결)
        if let aps = userInfo["aps"] as? [String: Any],
           let alert = aps["alert"] as? [String: Any] {
            // Notification 객체에서 제목과 본문 추출
            self.title = "\(alert["title"] ?? userInfo["title"] ?? String())"
            self.body = "\(alert["body"] ?? userInfo["body"] ?? String())"
        } else {
            // 기존 방식 (data 객체에서 추출)
            self.title = "\(userInfo["title"] ?? String())"
            self.body = "\(userInfo["body"] ?? String())"
        }

        // event_url은 data 객체에서 추출
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

        // Notification 객체가 포함된 푸시인지 확인 (사용자에게 표시되는 푸시)
        let hasNotification = userInfo["aps"] as? [String: Any] != nil ||
                             (userInfo["aps"] as? [String: Any])?["alert"] != nil

        // FCM 메시지 기록 및 통계 (진단용)
        UserDefaults.standard.set(userInfo, forKey: "last_fcm_message")
        UserDefaults.standard.synchronize()

        // 메시지 유형별 통계 기록
        if isSilentPush {
            let count = UserDefaults.standard.integer(forKey: "silent_push_count") + 1
            UserDefaults.standard.set(count, forKey: "silent_push_count")
        } else if isBackgroundPush && !hasNotification {
            let count = UserDefaults.standard.integer(forKey: "background_push_count") + 1
            UserDefaults.standard.set(count, forKey: "background_push_count")
        } else if hasNotification {
            let count = UserDefaults.standard.integer(forKey: "notification_push_count") + 1
            UserDefaults.standard.set(count, forKey: "notification_push_count")
        }
        UserDefaults.standard.synchronize()

        if isSilentPush {
            print("🤫 [FCM] Silent 푸시 감지 - 사용자에게 표시하지 않고 토큰 갱신만 수행")
            handleSilentPushMessage(userInfo, completionHandler: completionHandler)

        } else if isBackgroundPush && !hasNotification {
            // 백그라운드 푸시이지만 notification 객체가 없는 경우 (진정한 백그라운드 푸시)
            print("🔄 [FCM] 백그라운드 푸시 감지 (알림 없음) - 백그라운드에서 처리")
            handleBackgroundPushMessage(userInfo, completionHandler: completionHandler)

            // 백그라운드 푸시 수신 시 FCM 토큰 상태 확인 및 갱신
            print("🔄 [FCM] 백그라운드 푸시 수신으로 토큰 상태 확인")
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.updateFCMTokenIfNeeded()
            }

        } else if hasNotification {
            // Notification 객체가 포함된 푸시 (사용자에게 표시되는 푸시)
            print("🔔 [FCM] 알림 포함 푸시 감지 - 사용자에게 표시")
            handleNotificationPushMessage(userInfo, completionHandler: completionHandler)

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

    // MARK: - 🔔 알림 포함 푸시 처리 (iOS 푸시 문제 해결용)
    private func handleNotificationPushMessage(_ userInfo: [AnyHashable: Any], completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("🔔 [FCM] 알림 포함 푸시 메시지 처리 시작")

        // 백그라운드에서 수행할 작업들
        DispatchQueue.global(qos: .background).async {
            // 1. 데이터 미리 가져오기 (필요시)
            self.prefetchDataIfNeeded(userInfo)

            // 2. 로컬 저장소 업데이트
            self.updateLocalStorageWithBackgroundData(userInfo)

            // 3. 중요하지 않은 작업들은 메인 큐에서 처리
            DispatchQueue.main.async {
                // 4. 메시지를 큐에 저장 (앱 활성화 시 처리)
                self.saveFCMMessageToQueue(userInfo)

                // 5. 알림 포함 푸시의 경우 사용자에게 이미 알림이 표시되었으므로 추가 로컬 알림은 생성하지 않음
                // iOS 시스템이 notification 객체를 처리하여 자동으로 알림 표시

                print("✅ [FCM] 알림 포함 푸시 처리 완료")

                // FCM 토큰 상태 확인 및 갱신 (알림 푸시 수신 시점에 토큰 검증)
                print("🔄 [FCM] 알림 푸시 수신으로 토큰 상태 확인")
                self.updateFCMTokenIfNeeded()

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
        print("📱 [APNS] APNS 디바이스 토큰 수신 시작")

        // APNS 토큰을 문자열로 변환하여 저장
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        currentAPNSToken = token

        print("📱 [APNS] APNS 토큰 변환 성공: \(token.prefix(20))... (길이: \(token.count))")

        // APNS 토큰을 UserDefaults에 저장 (디버깅용)
        UserDefaults.standard.set(token, forKey: "last_apns_token")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "apns_token_received_time")
        UserDefaults.standard.synchronize()

        // FCM에 APNS 토큰 설정
        Messaging.messaging().setAPNSToken(deviceToken as Data, type: .unknown)
        print("✅ [APNS] APNS 디바이스 토큰 FCM에 등록 완료")

        // APNS 토큰이 변경되었는지 확인
        let currentAPNSTokenKey = token
        let savedAPNSToken = UserDefaults.standard.string(forKey: "last_saved_apns_token")

        if savedAPNSToken != currentAPNSTokenKey {
            print("🔄 [APNS] APNS 토큰 변경 감지 - FCM 토큰 강제 갱신 필요")
            UserDefaults.standard.set(currentAPNSTokenKey, forKey: "last_saved_apns_token")
            UserDefaults.standard.synchronize()

            // APNS 토큰 변경 시 FCM 토큰도 새로 생성되므로 약간의 지연 후 FCM 토큰 확인
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.forceRefreshFCMTokenOnAPNSTokenChange()
            }
        }

        // FCM 토큰이 이미 있는지 확인
        if let existingFCMToken = Messaging.messaging().fcmToken {
            print("🔥 [FCM] 기존 FCM 토큰 발견: \(existingFCMToken.prefix(30))...")
            currentFCMToken = existingFCMToken
            Utils.shared.setToken(token: existingFCMToken)

            // 기존 토큰으로 서버 업데이트
            self.sendFCMTokenToServer(token: existingFCMToken) { success in
                if success {
                    print("✅ [FCM] 기존 FCM 토큰 서버 업데이트 성공")
                } else {
                    print("❌ [FCM] 기존 FCM 토큰 서버 업데이트 실패")
                }
            }
        } else {
            print("🔥 [FCM] FCM 토큰이 아직 없음, 생성 대기")
        }

        // FCM 토큰 생성을 위한 추가 시도 (안전하게)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            Messaging.messaging().token { token, error in
                DispatchQueue.main.async {
                    if let error = error {
                        print("❌ [FCM] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                        print("💡 FCM 토큰 생성 실패 원인:")
                        print("   - 인터넷 연결 확인")
                        print("   - Firebase 프로젝트 설정 확인")
                        print("   - APNS 토큰이 올바르게 등록되었는지 확인")
                    } else if let token = token {
                        print("✅ [FCM] FCM 토큰 생성 성공: \(token.prefix(30))... (길이: \(token.count))")
                        self.currentFCMToken = token
                        Utils.shared.setToken(token: token)

                        // 서버에 업데이트
                        self.sendFCMTokenToServer(token: token) { success in
                            if success {
                                print("✅ [FCM] 새 FCM 토큰 서버 업데이트 성공")
                            } else {
                                print("❌ [FCM] 새 FCM 토큰 서버 업데이트 실패")
                            }
                        }
                    } else {
                        print("❌ [FCM] FCM 토큰이 nil입니다")
                        print("💡 FCM 토큰이 nil인 경우:")
                        print("   - APNS 토큰 등록 상태 재확인")
                        print("   - 앱 재시작 후 다시 시도")
                        print("   - Firebase Console에서 프로젝트 설정 확인")
                    }
                }
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ [APNS] APNS 등록 실패: \(error.localizedDescription)")
        print("💡 APNS 등록 실패 원인:")

        // 오류 유형별 안내 메시지
        let nsError = error as NSError
        switch nsError.code {
        case 3000:
            print("   - 시뮬레이터에서는 APNS를 사용할 수 없습니다")
            print("   - 실제 기기에서 테스트해주세요")
        case 3010:
            print("   - 앱 번들 ID가 잘못되었거나 인증서가 일치하지 않습니다")
            print("   - Apple Developer Console에서 앱 ID와 인증서를 확인해주세요")
        default:
            print("   - 네트워크 연결을 확인해주세요")
            print("   - 앱 권한 설정을 확인해주세요")
        }

        // APNS 등록 실패를 UserDefaults에 기록
        UserDefaults.standard.set("FAILED: \(error.localizedDescription)", forKey: "last_apns_error")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "apns_error_time")
        UserDefaults.standard.synchronize()

        print("🔍 [DEBUG] APNS 등록 실패 - debugPushNotificationStatus()로 상세 진단 가능")
    }

    // ✅ FCM 토큰 변경 감지 - 최소한의 업데이트만 수행
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("🔍 [FCM] FCM 토큰 변경 감지됨")
        
        guard let token = fcmToken else {
            print("❌ [FCM] FCM 토큰이 nil입니다")
            return
        }

        // 기존 토큰과 비교하여 실제 변경이 필요한지 확인
        let oldToken = UserDefaults.standard.string(forKey: "fcm_token")
        if oldToken == token {
            print("✅ [FCM] 토큰 변경 없음 - 업데이트 불필요")
            return
        }

        print("🔄 [FCM] 토큰 변경 감지: \(oldToken?.prefix(10) ?? "nil")... → \(token.prefix(10))...")
        
        // 토큰 저장
        Utils.shared.setToken(token: token)
        UserDefaults.standard.set(token, forKey: "fcm_token")
        
        // 권한 상태 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                if settings.authorizationStatus == .denied {
                    print("❌ [FCM] 푸시 알림 권한이 거부됨 - 토큰 업데이트 건너뜀")
                    return
                }

                // 로그인 상태일 때만 서버 업데이트
                if UserDefaults.standard.bool(forKey: "is_logged_in") {
                    print("✅ [FCM] 로그인 상태 - 토큰 서버 업데이트 수행")
                    self.updateFCMTokenIfNeeded(token: token)
                } else {
                    print("ℹ️ [FCM] 로그인 상태 아님 - 토큰 서버 업데이트 건너뜀")
                }
            }
        }
    }
    
    // MARK: - 🔍 필요한 경우에만 FCM 토큰 업데이트
    private func updateFCMTokenIfNeeded(token: String) {
        // 마지막 업데이트 시간 확인 (24시간 내에는 업데이트하지 않음)
        if let lastUpdate = lastFCMTokenUpdateTime {
            let timeSinceLastUpdate = Date().timeIntervalSince(lastUpdate)
            if timeSinceLastUpdate < 24 * 60 * 60 { // 24시간
                print("⏰ [FCM] 마지막 업데이트로부터 24시간이 지나지 않음 - 업데이트 건너뜀")
                return
            }
        }
        
        // 업데이트 진행 중이면 건너뜀
        if isFCMUpdateInProgress {
            print("⏳ [FCM] 이미 업데이트가 진행 중 - 건너뜀")
            return
        }
        
        print("✅ [FCM] FCM 토큰 서버 업데이트 시작")
        isFCMUpdateInProgress = true
        
        // 서버 업데이트 수행
        sendFCMTokenToServer(token: token) { success in
            DispatchQueue.main.async {
                self.isFCMUpdateInProgress = false
                if success {
                    self.lastFCMTokenUpdateTime = Date()
                    print("✅ [FCM] FCM 토큰 서버 업데이트 성공")
                } else {
                    print("❌ [FCM] FCM 토큰 서버 업데이트 실패")
                }
            }
        }
    }

    // MARK: - 📝 토큰 변경 로그 기록
    private func logTokenChange(reason: String, newToken: String) {
        let oldToken = UserDefaults.standard.string(forKey: "fcm_token")

        switch reason {
        case "auto_refresh":
            print("🔄 [FCM POLICY 2] 자동 토큰 갱신: \(oldToken?.prefix(10) ?? "nil")... → \(newToken.prefix(10))...")
        case "login_register":
            print("📝 [FCM POLICY 1] 로그인 시 토큰 등록: \(newToken.prefix(10))...")
        case "app_launch_check":
            if oldToken != newToken {
                print("🔍 [FCM POLICY 3] 앱 실행 시 토큰 변경 감지: \(oldToken?.prefix(10) ?? "nil")... → \(newToken.prefix(10))...")
            } else {
                print("✅ [FCM POLICY 3] 앱 실행 시 토큰 동일 - 갱신 불필요")
            }
        default:
            print("📝 [FCM LOG] 토큰 변경: \(reason) - \(newToken.prefix(10))...")
        }
    }

    // MARK: - 🚀 FCM 토큰 강제 업데이트 (무조건 푸시 수신 보장)

    private func forceUpdateFCMTokenToServer(token: String, reason: String = "force_update") {
        print("🚀 [FCM FORCE] FCM 토큰 강제 서버 업데이트 시작 - 이유: \(reason)")
        print("🚀 [FCM FORCE] 토큰: \(token.prefix(30))...")

        // 기존 업데이트가 진행 중이면 취소
        if UserDefaults.standard.bool(forKey: "fcm_force_update_in_progress") {
            print("⚠️ [FCM FORCE] 이전 강제 업데이트가 진행 중 - 취소하고 새로 시작")
            UserDefaults.standard.set(false, forKey: "fcm_force_update_in_progress")
        }

        // 강제 업데이트 진행 중 플래그 설정
        UserDefaults.standard.set(true, forKey: "fcm_force_update_in_progress")
        UserDefaults.standard.synchronize()

        // 즉시 서버 업데이트 (재시도 없이)
        performImmediateFCMTokenUpdate(token: token, reason: reason)
    }

    private func performImmediateFCMTokenUpdate(token: String, reason: String) {
        // UserDefaults에서 mt_idx 가져오기
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")

        guard let mtIdx = mtIdx, !mtIdx.isEmpty else {
            print("❌ [FCM FORCE] mt_idx 없음 - 로그인 필요")
            UserDefaults.standard.set(false, forKey: "fcm_force_update_in_progress")
            return
        }

        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token,
            "device_type": "ios",
            "platform": "ios",
            "force_update": true,
            "reason": reason
        ]

        guard let jsonData = try? JSONSerialization.data(withJSONObject: requestData) else {
            print("❌ [FCM FORCE] JSON 변환 실패")
            UserDefaults.standard.set(false, forKey: "fcm_force_update_in_progress")
            return
        }

        let urlString = Http.shared.BASE_URL + Http.shared.memberFcmTokenUrl
        guard let url = URL(string: urlString) else {
            print("❌ [FCM FORCE] 잘못된 URL")
            UserDefaults.standard.set(false, forKey: "fcm_force_update_in_progress")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30.0  // 30초 타임아웃
        request.httpBody = jsonData

        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                // 플래그 해제
                UserDefaults.standard.set(false, forKey: "fcm_force_update_in_progress")
                UserDefaults.standard.synchronize()

                if let error = error {
                    print("❌ [FCM FORCE] 네트워크 오류: \(error.localizedDescription)")
                    // 3초 후 재시도
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                        self?.performImmediateFCMTokenUpdate(token: token, reason: reason + "_retry")
                    }
                    return
                }

                if let httpResponse = response as? HTTPURLResponse {
                    print("📊 [FCM FORCE] 서버 응답 코드: \(httpResponse.statusCode)")

                    if httpResponse.statusCode == 200 {
                        print("✅ [FCM FORCE] FCM 토큰 강제 업데이트 성공")
                        // 성공 시 마지막 업데이트 시간 기록
                        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_force_fcm_update")
                        UserDefaults.standard.synchronize()
                    } else {
                        print("❌ [FCM FORCE] 서버 오류: \(httpResponse.statusCode)")
                        // 실패 시 5초 후 재시도
                        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                            self?.performImmediateFCMTokenUpdate(token: token, reason: reason + "_retry")
                        }
                    }
                }
            }
        }
        task.resume()
    }

    // MARK: - 🚀 FCM 토큰 직접 API 업데이트

    private func sendFCMTokenToServer(token: String, completion: @escaping (Bool) -> Void) {
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
                        
                        // 네트워크 오류 completion 호출
                        completion(false)
                        return
                    }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ [FCM API] HTTP 응답이 아님")
                    completion(false)
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
                            print("🔓 [FCM] FCM 토큰 업데이트 완료로 인한 플래그 해제됨")
                            
                            // 성공 completion 호출
                            completion(true)
                        } else {
                            print("❌ [FCM API] FCM 토큰 서버 업데이트 실패 - 상태 코드: \(httpResponse.statusCode)")
                            
                            // 🔒 실패 시에도 플래그 해제
                            UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                            UserDefaults.standard.synchronize()
                            print("🔓 [FCM] FCM 토큰 업데이트 실패로 인한 플래그 해제됨")
                            
                            // 실패 completion 호출
                            completion(false)
                        }
            }
        }
        
        task.resume()
    }
    

    
    // MARK: - 🔔 FCM 자동 업데이트 시작 (로그인 완료 시 호출)
    @objc func startFCMAutoUpdateAfterLogin() {
        print("🚀 [FCM Auto] 로그인 완료 - FCM 자동 업데이트 시작")
        
        // 🚨 로그인 완료 시 FCM 토큰 강제 업데이트 (타이머 제거됨)
        print("🚨 [FCM Auto] 로그인 완료 - FCM 토큰 강제 업데이트 실행")
        forceUpdateFCMToken()

        // 타이머 기반 자동 업데이트 제거됨
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
                self?.sendFCMTokenToServer(token: token) { success in
                    if success {
                        print("✅ [FCM MANUAL] FCM 토큰 수동 업데이트 성공")
                    } else {
                        print("❌ [FCM MANUAL] FCM 토큰 수동 업데이트 실패")
                    }
                }
            }
                }
    }

    // MARK: - 🔄 APNS 토큰 변경 시 FCM 토큰 강제 갱신
    private func forceRefreshFCMTokenOnAPNSTokenChange() {
        print("🔄 [APNS] APNS 토큰 변경으로 인한 FCM 토큰 강제 갱신 시작")

        // 기존 FCM 토큰 삭제
        Messaging.messaging().deleteToken { error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [APNS] FCM 토큰 삭제 실패: \(error.localizedDescription)")
                    return
                }

                print("✅ [APNS] FCM 토큰 삭제 완료, 새 토큰 생성 대기")

                // 새 FCM 토큰 생성 대기
                DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                    Messaging.messaging().token { token, error in
                        DispatchQueue.main.async {
                            if let error = error {
                                print("❌ [APNS] 새 FCM 토큰 생성 실패: \(error.localizedDescription)")
                                return
                            }

                            if let token = token, !token.isEmpty {
                                print("✅ [APNS] APNS 토큰 변경 후 새 FCM 토큰 생성 성공: \(token.prefix(30))...")
                                self.currentFCMToken = token
                                Utils.shared.setToken(token: token)

                                // 서버에 즉시 업데이트
                                self.sendFCMTokenToServer(token: token) { success in
                                    if success {
                                        print("✅ [APNS] APNS 토큰 변경 후 FCM 토큰 서버 업데이트 성공")
                                    } else {
                                        print("❌ [APNS] APNS 토큰 변경 후 FCM 토큰 서버 업데이트 실패")
                                    }
                                }

                                print("🚀 [APNS] APNS 토큰 변경에 따른 FCM 토큰 갱신 완료")
                            } else {
                                print("❌ [APNS] 새 FCM 토큰이 nil이거나 비어있음")
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - 🔍 종합 푸시 상태 디버그 (문제 진단용)
    @objc func debugPushNotificationStatus() {
        print("\n" + String(repeating: "=", count: 80))
        print("🔍 [DEBUG] iOS 푸시 알림 종합 상태 진단 (실시간)")
        print("📅 진단 시간: \(Date().description)")
        print(String(repeating: "=", count: 80))

        // 1. 로그인 상태 확인
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil
        print("👤 로그인 상태: \(isLoggedIn ? "✅ 로그인됨" : "❌ 로그인되지 않음")")

        // 2. 사용자 정보 확인
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")
        print("🆔 사용자 ID: \(mtIdx ?? "❌ 없음")")

        // 3. APNS 토큰 등록 상태 확인
        if UIApplication.shared.isRegisteredForRemoteNotifications {
            print("📱 APNS 등록 상태: ✅ 등록됨")
        } else {
            print("📱 APNS 등록 상태: ❌ 등록되지 않음 - APNS 토큰을 받을 수 없음!")
        }

        // 4. APNS 토큰 확인
        if let apnsToken = currentAPNSToken ?? UserDefaults.standard.string(forKey: "last_apns_token") {
            print("📱 APNS 토큰: ✅ 존재 (\(apnsToken.prefix(20))...)")
            print("📱 APNS 토큰 길이: \(apnsToken.count)자")
        } else {
            print("📱 APNS 토큰: ❌ 없음 - APNS 토큰 등록 실패!")
        }

        // APNS 등록 실패 기록 확인
        if let apnsError = UserDefaults.standard.string(forKey: "last_apns_error") {
            print("❌ 마지막 APNS 오류: \(apnsError)")
        }

        // APNS 토큰 변경 기록 확인
        let savedAPNSToken = UserDefaults.standard.string(forKey: "last_saved_apns_token")
        if let savedAPNSToken = savedAPNSToken {
            print("💾 저장된 APNS 토큰: \(savedAPNSToken.prefix(20))...")
        } else {
            print("💾 저장된 APNS 토큰: 없음")
        }

        // 5. FCM 토큰 확인
        if let fcmToken = Messaging.messaging().fcmToken {
            print("🔥 FCM 토큰: ✅ 존재 (\(fcmToken.prefix(30))...)")
            print("🔥 FCM 토큰 길이: \(fcmToken.count)자")
        } else {
            print("🔥 FCM 토큰: ❌ 없음 - FCM 토큰 생성 실패!")
            print("💡 FCM 토큰 없음 원인:")
            print("   - APNS 토큰이 제대로 등록되지 않음")
            print("   - 인터넷 연결 문제")
            print("   - Firebase 설정 문제")
        }

        // 5. 푸시 권한 상태 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔔 푸시 권한 상태: \(self.authorizationStatusString(settings.authorizationStatus))")

                if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                    print("✅ 푸시 알림 권한: 허용됨")
                } else if settings.authorizationStatus == .denied {
                    print("❌ 푸시 알림 권한: 거부됨 - 설정에서 허용해주세요!")
                } else {
                    print("⚠️ 푸시 알림 권한: 미결정 - 권한 요청 필요")
                }

                print("🔔 알림 허용: \(settings.alertSetting == .enabled ? "✅" : "❌")")
                print("🔔 배지 허용: \(settings.badgeSetting == .enabled ? "✅" : "❌")")
                print("🔔 소리 허용: \(settings.soundSetting == .enabled ? "✅" : "❌")")

                // 6. 서버에 저장된 토큰 확인
                if let mtIdx = mtIdx, let _ = Int(mtIdx) {
                    self.checkServerTokenStatus(mtIdx: mtIdx)
                } else {
                    print("❌ 서버 토큰 확인 불가: 사용자 ID 없음")
                }

                        // 7. FCM 자동 초기화 상태 확인
        print("🔥 FCM 자동 초기화: \(Messaging.messaging().isAutoInitEnabled ? "✅ 활성화" : "❌ 비활성화")")

                        // 8. Firebase 설정 검증
        self.validateFirebaseConfiguration()

                // 9. FCM 메시지 유형 확인
        self.validateFCMMessageTypes()

                // 10. FCM 서버 연결 테스트
        self.testFCMServerConnection()

                // 8. 앱 상태 확인
                let appState = UIApplication.shared.applicationState
                switch appState {
                case .active:
                    print("📱 앱 상태: ✅ 활성화 (포그라운드)")
                case .inactive:
                    print("📱 앱 상태: ⚠️ 비활성화")
                case .background:
                    print("📱 앱 상태: 🔄 백그라운드")
                @unknown default:
                    print("📱 앱 상태: ❓ 알 수 없음")
                }

                // 9. 백그라운드 작업 권한 확인
                if #available(iOS 13.0, *) {
                    print("🔄 백그라운드 작업 권한: \(UIApplication.shared.backgroundRefreshStatus == .available ? "✅ 사용 가능" : "❌ 제한됨")")
                }

                print(String(repeating: "=", count: 80))
                print("🔍 [DEBUG] 진단 완료 - 위 정보를 개발팀에 제공해주세요")
                print(String(repeating: "=", count: 80))
            }
        }
    }

    // MARK: - 🌐 서버 토큰 상태 확인
    private func checkServerTokenStatus(mtIdx: String) {
        print("🌐 서버 토큰 상태 확인 시작")

        let urlString = "\(Http.shared.BASE_URL)\(Http.shared.memberFcmTokenUrl)/status/\(mtIdx)"
        guard let url = URL(string: urlString) else {
            print("❌ 서버 토큰 확인 실패: 잘못된 URL")
            return
        }

        URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ 서버 토큰 확인 네트워크 오류: \(error.localizedDescription)")
                    return
                }

                if let httpResponse = response as? HTTPURLResponse {
                    print("📡 서버 응답 상태: \(httpResponse.statusCode)")

                    if httpResponse.statusCode == 200, let data = data {
                        do {
                            if let jsonResponse = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                                print("📋 서버 토큰 상태:")
                                print("   - 토큰 존재: \(jsonResponse["has_token"] as? Bool == true ? "✅" : "❌")")

                                if let tokenPreview = jsonResponse["token_preview"] as? String {
                                    print("   - 서버 토큰 미리보기: \(tokenPreview)")

                                    // 로컬 토큰과 서버 토큰 비교
                                    if let localToken = Messaging.messaging().fcmToken {
                                        let serverTokenStart = tokenPreview.replacingOccurrences(of: "...", with: "")
                                        let localTokenStart = String(localToken.prefix(serverTokenStart.count))
                                        print("   - 토큰 일치: \(localTokenStart == serverTokenStart ? "✅" : "❌")")
                                    }
                                }

                                if let lastUpdated = jsonResponse["token_updated_at"] as? String {
                                    print("   - 마지막 업데이트: \(lastUpdated)")
                                }

                                if let expiryDate = jsonResponse["token_expiry_date"] as? String {
                                    print("   - 만료 예정일: \(expiryDate)")
                                }

                                if let isExpired = jsonResponse["is_token_expired"] as? Bool, isExpired {
                                    print("   - 토큰 상태: ❌ 만료됨")
                                } else if let isNearExpiry = jsonResponse["is_token_near_expiry"] as? Bool, isNearExpiry {
                                    print("   - 토큰 상태: ⚠️ 곧 만료")
                                } else {
                                    print("   - 토큰 상태: ✅ 정상")
                                }
                            }
                        } catch {
                            print("❌ 서버 응답 파싱 오류: \(error.localizedDescription)")
                        }
                    } else {
                        print("❌ 서버 토큰 확인 실패: HTTP \(httpResponse.statusCode)")
                    }
                }
            }
        }.resume()
    }

    // MARK: - 🔧 Firebase 설정 검증
    private func validateFirebaseConfiguration() {
        print("🔧 Firebase 설정 검증 시작")

        // GoogleService-Info.plist 파일 검증
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let plist = NSDictionary(contentsOfFile: path) {
            print("✅ GoogleService-Info.plist 파일: 발견됨")

            // 필수 키들 검증
            let requiredKeys = ["PROJECT_ID", "GCM_SENDER_ID", "GOOGLE_APP_ID", "CLIENT_ID"]
            var missingKeys: [String] = []

            for key in requiredKeys {
                if plist[key] == nil || (plist[key] as? String)?.isEmpty == true {
                    missingKeys.append(key)
                }
            }

            if missingKeys.isEmpty {
                print("✅ GoogleService-Info.plist 필수 값들: 모두 존재")

                // 프로젝트 ID 출력 (마스킹)
                if let projectId = plist["PROJECT_ID"] as? String {
                    print("📋 프로젝트 ID: \(projectId)")
                }

                // GCM Sender ID 출력
                if let gcmSenderId = plist["GCM_SENDER_ID"] as? String {
                    print("📋 GCM Sender ID: \(gcmSenderId)")
                }
            } else {
                print("❌ GoogleService-Info.plist 누락된 값들: \(missingKeys.joined(separator: ", "))")
            }
        } else {
            print("❌ GoogleService-Info.plist 파일: 찾을 수 없음")
            print("💡 해결 방법:")
            print("   - Firebase Console에서 GoogleService-Info.plist 다운로드")
            print("   - Xcode 프로젝트에 추가")
            print("   - Target Membership 확인")
        }

        // Firebase 앱 초기화 상태 확인
        if let firebaseApp = FirebaseApp.app() {
            print("✅ Firebase 앱 초기화: 성공")
            print("📋 Firebase 앱 이름: \(firebaseApp.name)")
            let options = firebaseApp.options
            print("📋 Firebase 프로젝트 ID: \(options.projectID ?? "알 수 없음")")
            print("📋 Firebase 앱 ID: \(options.googleAppID)")
        } else {
            print("❌ Firebase 앱 초기화: 실패")
            print("💡 Firebase 초기화 실패 원인:")
            print("   - GoogleService-Info.plist 파일 문제")
            print("   - Firebase.configure() 호출 시점 문제")
        }

        // APNS 환경 확인
        #if DEBUG
            print("🔧 빌드 환경: Debug (Development APNS)")
        #else
            print("🔧 빌드 환경: Release (Production APNS)")
        #endif
    }

    // MARK: - 📨 FCM 메시지 유형 검증 (iOS 푸시 문제 진단용)
    private func validateFCMMessageTypes() {
        print("📨 FCM 메시지 유형 검증 시작")

        // 최근 FCM 메시지 기록 확인
        if let lastFCMMessage = UserDefaults.standard.dictionary(forKey: "last_fcm_message") {
            print("📋 최근 FCM 메시지 분석:")

            // 메시지 유형 판별
            let hasNotification = lastFCMMessage["aps"] as? [String: Any] != nil ||
                                 (lastFCMMessage["aps"] as? [String: Any])?["alert"] != nil

            let hasData = lastFCMMessage.keys.contains(where: { key in
                !["aps", "gcm.message_id", "google.c.sender.id", "google.c.fid"].contains(key)
            })

            let isBackgroundPush = lastFCMMessage["content-available"] as? String == "1" ||
                                  lastFCMMessage["content-available"] as? Int == 1 ||
                                  lastFCMMessage["background_push"] as? String == "true"

            let isSilentPush = lastFCMMessage["silent_push"] as? String == "true" ||
                              lastFCMMessage["token_refresh"] as? String == "true"

            print("   - Notification 객체 포함: \(hasNotification ? "✅" : "❌")")
            print("   - Data 객체 포함: \(hasData ? "✅" : "❌")")
            print("   - 백그라운드 푸시: \(isBackgroundPush ? "✅" : "❌")")
            print("   - Silent 푸시: \(isSilentPush ? "✅" : "❌")")

            // 메시지 유형에 따른 진단
            if !hasNotification && (isBackgroundPush || isSilentPush) {
                print("   ⚠️  경고: 백그라운드/Silent 푸시인데 Notification 객체가 없음")
                print("   💡 해결: 서버에서 Notification 객체를 포함하여 전송해야 함")
            } else if hasNotification {
                print("   ✅ 정상: Notification 객체가 포함되어 있음")
            }

        } else {
            print("📋 저장된 FCM 메시지가 없음")
        }

        // FCM 메시지 처리 통계
        let silentPushCount = UserDefaults.standard.integer(forKey: "silent_push_count")
        let backgroundPushCount = UserDefaults.standard.integer(forKey: "background_push_count")
        let notificationPushCount = UserDefaults.standard.integer(forKey: "notification_push_count")
        let foregroundPushCount = UserDefaults.standard.integer(forKey: "foreground_push_count")

        print("📊 FCM 메시지 처리 통계:")
        print("   - Silent 푸시: \(silentPushCount)회")
        print("   - 백그라운드 푸시: \(backgroundPushCount)회")
        print("   - 알림 푸시: \(notificationPushCount)회")
        print("   - 포그라운드 푸시: \(foregroundPushCount)회")
    }

    // MARK: - 🌐 FCM 서버 연결 테스트
    private func testFCMServerConnection() {
        print("🌐 FCM 서버 연결 테스트 시작")

        // FCM 토큰 확인
        guard let fcmToken = Messaging.messaging().fcmToken else {
            print("❌ FCM 토큰 없음 - FCM 서버 연결 불가")
            return
        }

        // 서버 연결 테스트 (간단한 토큰 검증 요청)
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")

        guard let userId = mtIdx else {
            print("❌ 사용자 ID 없음 - 로그인 필요")
            return
        }

        let urlString = "\(Http.shared.BASE_URL)\(Http.shared.memberFcmTokenUrl)/status/\(userId)"
        guard let url = URL(string: urlString) else {
            print("❌ 서버 URL 구성 실패")
            return
        }

        print("📡 서버 연결 테스트: \(urlString)")

        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ 서버 연결 실패: \(error.localizedDescription)")
                    print("💡 네트워크 문제 또는 서버 다운 가능성")
                    return
                }

                if let httpResponse = response as? HTTPURLResponse {
                    print("📊 서버 응답 코드: \(httpResponse.statusCode)")

                    if httpResponse.statusCode == 200 {
                        print("✅ 서버 연결 성공")
                        print("💡 FCM 푸시가 안 된다면 다음을 확인:")
                        print("   1. Firebase 콘솔에서 APNS 인증서 설정")
                        print("   2. 실제 iOS 디바이스에서 테스트")
                        print("   3. iOS 설정 > 알림 > 앱 권한 확인")
                        print("   4. 저전력 모드 해제")
                    } else {
                        print("⚠️ 서버 응답 오류: \(httpResponse.statusCode)")
                    }
                }
            }
        }
        task.resume()
    }

    // MARK: - 🧪 FCM 토큰 생성 테스트
    @objc func testFCMTokenGeneration() {
        print("🧪 FCM 토큰 생성 테스트 시작")

        // FCM 토큰 강제 재생성
        Messaging.messaging().deleteToken { error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ FCM 토큰 삭제 실패: \(error.localizedDescription)")
                    return
                }

                print("✅ FCM 토큰 삭제 완료, 새 토큰 생성 시도")

                // 새 토큰 생성
                Messaging.messaging().token { token, error in
                    DispatchQueue.main.async {
                        if let error = error {
                            print("❌ 새 FCM 토큰 생성 실패: \(error.localizedDescription)")
                            print("💡 가능한 원인:")
                            print("   - 인터넷 연결 확인")
                            print("   - Firebase 설정 확인")
                            print("   - APNS 토큰 등록 상태 확인")
                            return
                        }

                        if let token = token, !token.isEmpty {
                            print("✅ 새 FCM 토큰 생성 성공: \(token.prefix(30))...")
                            print("📏 토큰 길이: \(token.count)자")

                            // 서버에 업데이트
                            self.sendFCMTokenToServer(token: token) { success in
                                if success {
                                    print("✅ [FCM TEST] FCM 토큰 생성 테스트 서버 업데이트 성공")
                                } else {
                                    print("❌ [FCM TEST] FCM 토큰 생성 테스트 서버 업데이트 실패")
                                }
                            }
                        } else {
                            print("❌ 새 FCM 토큰이 nil이거나 비어있음")
                            print("💡 가능한 원인:")
                            print("   - APNS 토큰 등록 실패")
                            print("   - Firebase 프로젝트 설정 문제")
                            print("   - 앱 권한 문제")
                        }
                    }
                }
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

        // ✅ 백그라운드 진입 시 토큰 상태 관리

        // 🚀 백그라운드 진입 시 토큰 상태 준비 (타이머 제거됨)

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

        // ✅ 포그라운드 진입 시 토큰 상태 관리

        // 🚀 포그라운드 진입 시 토큰 검증 (타이머 제거됨)
        if UserDefaults.standard.bool(forKey: "is_logged_in") {
            print("✅ [FCM] 포그라운드 진입 - 수동 토큰 검증 진행")
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

    // MARK: - 📱 앱 시작 시 푸시 데이터 처리
    private func processLaunchPushNotification() {
        print("📱 앱 시작 시 저장된 푸시 데이터 처리 시작")

        guard let pushData = UserDefaults.standard.dictionary(forKey: "launch_push_notification") else {
            print("ℹ️ 처리할 앱 시작 푸시 데이터가 없음")
            return
        }

        print("📨 앱 시작 푸시 데이터 발견: \(pushData)")

        // 푸시 데이터를 WebView에 전달
        if let webView = findWebViewInHierarchy() {
            DispatchQueue.main.async {
                let messageData = [
                    "type": "launch_push_notification",
                    "pushData": pushData,
                    "timestamp": Date().timeIntervalSince1970,
                    "processed": false
                ] as [String: Any]

                if let jsonData = try? JSONSerialization.data(withJSONObject: messageData),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    let jsCode = "window.dispatchEvent(new CustomEvent('launchPushNotification', { detail: \(jsonString) }));"
                    webView.evaluateJavaScript(jsCode) { result, error in
                        if let error = error {
                            print("❌ 앱 시작 푸시 데이터 WebView 전달 실패: \(error.localizedDescription)")
                        } else {
                            print("✅ 앱 시작 푸시 데이터 WebView 전달 성공")
                        }
                    }
                }
            }
        } else {
            print("⚠️ WebView를 찾을 수 없어 앱 시작 푸시 데이터 처리 스킵")
        }

        // 처리된 데이터는 삭제 (중복 처리 방지)
        UserDefaults.standard.removeObject(forKey: "launch_push_notification")
        UserDefaults.standard.synchronize()

        print("🗑️ 앱 시작 푸시 데이터 처리 완료 및 삭제됨")
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
    private func validateFCMTokenForBackground(token: String) { // 호출되지 않음
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

        // FCM 타이머 정리 (제거됨)

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

    // MARK: - 🔧 FCM 푸시 문제 해결 가이드
    @objc func showFCMTroubleshootingGuide() {
        print("\n" + String(repeating: "=", count: 80))
        print("🔧 FCM 푸시 문제 해결 가이드")
        print("📱 iOS 푸시 알림이 작동하지 않는 경우 단계별 해결")
        print(String(repeating: "=", count: 80))

        print("\n🚨 가장 중요한 확인사항:")
        print("1️⃣ 실제 iOS 디바이스에서 테스트 중인가?")
        print("   - 시뮬레이터에서는 FCM 푸시가 작동하지 않습니다")
        print("   - 실제 iPhone/iPad에서 테스트하세요")

        print("\n2️⃣ Firebase 콘솔 APNS 설정 확인:")
        print("   - Firebase Console → 프로젝트 설정 → Cloud Messaging")
        print("   - iOS 앱 구성에서 APNS 인증서/키가 등록되어 있는지 확인")
        print("   - Development/Production 환경에 맞는 인증서 등록")

        print("\n3️⃣ iOS 디바이스 설정 확인:")
        print("   - 설정 → 알림 → [앱 이름] → 알림 허용")
        print("   - 설정 → 일반 → 백그라운드 앱 새로고침 → [앱 이름] 활성화")
        print("   - 저전력 모드 해제")

        print("\n🛠️ 문제 진단을 위한 명령어:")
        print("   debugPushNotificationStatus()     // 종합 상태 확인")
        print("   testFCMTokenGeneration()          // 토큰 재생성 테스트")
        print("   updateFCMTokenManually()          // 수동 토큰 업데이트")

        print("\n📞 추가 도움이 필요한 경우:")
        print("   위 명령어들의 출력 결과를 개발팀에 제공해주세요")
        print("   특히 'APNS 등록 상태'와 'FCM 토큰' 상태가 중요합니다")

        print(String(repeating: "=", count: 80))
    }
}


