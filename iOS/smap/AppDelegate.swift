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
    
    // MARK: - FCM 토큰 관리 관련 프로퍼티 (개선된 토큰 관리)
    private var lastFCMTokenUpdateTime: Date?
    private var isFCMUpdateInProgress = false
    private var shouldUpdateFCMToken: Bool = false // 토큰 업데이트 필요 여부
    private var fcmTokenRetryCount: Int = 0 // 토큰 갱신 재시도 횟수
    private var backgroundTaskIdentifier: UIBackgroundTaskIdentifier = .invalid

    // 🔄 FCM 토큰 관리 설정 (백그라운드/포그라운드 모두 지원)
    private let fcmTokenExpiryDays: Int = 90 // 90일로 연장 - APNs 만료 시간과 일치
    private let maxTokenRetryAttempts: Int = 15 // 최대 재시도 횟수 더 증가
    private var isFCMTokenRefreshInProgress: Bool = false // 토큰 갱신 진행 중 플래그

    // 🔑 FCM 토큰 강제 업데이트 플래그 (모든 상황에서 업데이트 허용)
    private var forceTokenUpdateOnLogin: Bool = true // 로그인 시 무조건 토큰 업데이트
    private var shouldForceTokenRefreshOnResume: Bool = true // 앱 재개 시 항상 토큰 갱신
    private var isFCMTokenChangeBlocked: Bool = false // 토큰 변경 차단 플래그 (기존 호환성)
    
    // 🚀 백그라운드 푸시 최적화 설정
    private var lastBackgroundFetchTime: Date?
    private var backgroundTokenRefreshTimer: Timer?
    private let backgroundTokenRefreshInterval: TimeInterval = 1800 // 30분마다 토큰 상태 확인 (더 자주)
    private var isAppInBackground: Bool = false
    private var backgroundSessionStartTime: Date?
    private var backgroundKeepAliveTimer: Timer? // 백그라운드 연결 유지용 타이머
    private let backgroundKeepAliveInterval: TimeInterval = 600 // 10분마다 연결 유지
    
    var title = String()
    var body = String()
    var event_url = String()

    // APNS 및 FCM 토큰 저장용 프로퍼티
    private var currentAPNSToken: String?
    private var currentFCMToken: String?

    // 중복 FCM 알림 표시 방지용 프로퍼티
    private var lastProcessedFCMMessageId: String?
    private var lastFCMNotificationTime: Date?
    private let fcmDuplicatePreventionInterval: TimeInterval = 30.0 // 30초 이내 같은 메시지 무시

    // 알림 표시 성공 추적용 프로퍼티 (하나만 성공하면 나머지 작업 스킵)
    private var notificationDisplayedSuccessfully: Bool = false
    private var currentFCMMessageId: String? // 현재 처리 중인 메시지 ID

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

        
                // ✅ FCM 자동 초기화 활성화 - 푸시 메시지 수신을 위해
        Messaging.messaging().isAutoInitEnabled = true
        print("✅ [FCM] 자동 초기화 활성화 - 푸시 메시지 수신 가능")

        // ✅ FCM delegate 설정 활성화 - 토큰 수신을 위해
        Messaging.messaging().delegate = self
        print("✅ [FCM] FCM delegate 설정 활성화 - 토큰 수신 가능")

        // 🔥 FCM 토큰 강제 동기화 - 앱 시작 시 무조건 현재 토큰으로 DB 업데이트
        forceSyncFCMTokenOnAppLaunch()

        // 📱 백그라운드 토큰 갱신 준비
        setupBackgroundTokenRefresh()
        
        // 🚀 백그라운드 앱 새로고침 활성화
        setupBackgroundAppRefresh()
        
        // 🔄 정기적 토큰 상태 모니터링 시작
        startPeriodicTokenMonitoring()

        // 📱 현재 토큰 상태 확인 및 로깅 (개선된 토큰 검증 포함)
        print("\n╔══════════════════════════════════════════════════════════════╗")
        print("║ 📊 [토큰 상태] 앱 시작 시 토큰 정보 확인 및 검증                    ║")
        print("╚══════════════════════════════════════════════════════════════╝")
        
        // 🔍 토큰 무결성 검증 시작
        performTokenIntegrityCheck()

        // 저장된 토큰들 확인
        if let savedFCMToken = UserDefaults.standard.string(forKey: "fcm_token") {
            print("💾 [저장됨] FCM 토큰: \(savedFCMToken.prefix(30))... (길이: \(savedFCMToken.count))")
        } else {
            print("❌ [저장됨] FCM 토큰: 없음")
        }

        if let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") {
            print("💾 [DB] 마지막 업데이트 토큰: \(dbToken.prefix(30))... (길이: \(dbToken.count))")
        } else {
            print("❌ [DB] 마지막 업데이트 토큰: 없음")
        }

        if let apnsToken = UserDefaults.standard.string(forKey: "last_apns_token") {
            print("📱 [APNS] 저장된 토큰: \(apnsToken.prefix(30))... (길이: \(apnsToken.count))")
        } else {
            print("❌ [APNS] 저장된 토큰: 없음")
        }

        // 현재 FCM 토큰 가져오기 (비동기)
        Messaging.messaging().token { token, error in
            if let error = error {
                print("❌ [실시간] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
            } else if let token = token {
                print("🔥 [실시간] 현재 FCM 토큰: \(token.prefix(30))... (길이: \(token.count))")

                // 저장된 토큰과 비교
                if let savedToken = UserDefaults.standard.string(forKey: "fcm_token") {
                    if token == savedToken {
                        print("✅ [토큰 일치] 실시간 토큰과 저장된 토큰이 일치합니다")
                    } else {
                        print("⚠️ [토큰 불일치] 실시간 토큰과 저장된 토큰이 다릅니다!")
                        print("   📱 실시간: \(token.prefix(20))...")
                        print("   💾 저장됨: \(savedToken.prefix(20))...")
                    }
                }

                // DB 토큰과 비교
                if let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") {
                    if token == dbToken {
                        print("✅ [DB 일치] 실시간 토큰과 DB 토큰이 일치합니다")
                    } else {
                        print("⚠️ [DB 불일치] 실시간 토큰과 DB 토큰이 다릅니다!")
                        print("   📱 실시간: \(token.prefix(20))...")
                        print("   💾 DB: \(dbToken.prefix(20))...")
                        print("   🔄 서버 토큰 업데이트 필요!")
                    }
                }
            } else {
                print("❌ [실시간] FCM 토큰: nil")
            }
        }

        // 🔄 Pending FCM 토큰 동기화 (실패했던 토큰 재시도)
        if let pendingToken = UserDefaults.standard.string(forKey: "pending_fcm_token") {
            print("🔄 [FCM] Pending 토큰 발견 - 동기화 재시도")
            print("   📱 Pending 토큰: \(pendingToken.prefix(20))...")

            // 백그라운드에서 자동 동기화 시도
            DispatchQueue.global(qos: .background).async {
                self.sendFCMTokenToServer(token: pendingToken) { success in
                    DispatchQueue.main.async {
                        if success {
                            UserDefaults.standard.removeObject(forKey: "pending_fcm_token")
                            UserDefaults.standard.set(pendingToken, forKey: "fcm_token")
                            UserDefaults.standard.set(pendingToken, forKey: "last_updated_fcm_token")
                            UserDefaults.standard.synchronize()
                            print("✅ [FCM] Pending 토큰 동기화 성공")
                        } else {
                            print("❌ [FCM] Pending 토큰 동기화 실패 - 다음 기회에 재시도")
                        }
                    }
                }
            }
        }

        print("═══════════════════════════════════════════════════════════════")
        
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
        print("🚀 앱 시작 시 FCM 토큰 검증 시작 (mt_idx 식별 시에만 업데이트)")

        // 🚫 사용자가 식별되지 않았으면(mt_idx 없음) FCM 토큰 업데이트를 하지 않음
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if !hasUserIdentified {
            print("🚫 [FCM] 사용자가 식별되지 않음(mt_idx 없음) - FCM 토큰 업데이트 건너뜀")
            return
        }

        print("👤 사용자 식별됨(mt_idx 있음) - FCM 토큰 검증 진행")

        // 마지막 앱 실행 시간 확인
        let lastAppLaunchTime = UserDefaults.standard.double(forKey: "last_app_launch_time")
        let currentTime = Date().timeIntervalSince1970
        let timeSinceLastLaunch = currentTime - lastAppLaunchTime

        print("📊 마지막 앱 실행으로부터 \(String(format: "%.1f", timeSinceLastLaunch / 3600))시간 경과")

        // 현재 앱 실행 시간 기록
        UserDefaults.standard.set(currentTime, forKey: "last_app_launch_time")
        UserDefaults.standard.synchronize()

        // 로그인 상태에서만 FCM 토큰 검증 진행
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { // Firebase 초기화 대기
            Messaging.messaging().token { token, error in
                DispatchQueue.main.async {
                    if let error = error {
                        print("❌ 로그인 상태 FCM 토큰 확인 실패: \(error.localizedDescription)")
                        return
                    }

                    guard let token = token, !token.isEmpty else {
                        print("❌ 로그인 상태 FCM 토큰 없음")
                        return
                    }

                    print("✅ 로그인 상태 FCM 토큰 확인 성공: \(token.prefix(30))...")

                    // 저장된 토큰과 비교
                    let savedToken = UserDefaults.standard.string(forKey: "last_fcm_token")
                    let lastTokenUpdateTime = UserDefaults.standard.double(forKey: "last_fcm_token_update_time")

                    if savedToken != token {
                        // 토큰이 변경되었고 유효기간이 지났을 때만 업데이트
                        if self.isFCMTokenExpired() {
                            print("🔄 FCM 토큰 변경 감지 + 유효기간 만료 - 서버 업데이트 실행")
                            self.sendFCMTokenToServer(token: token) { success in
                                if success {
                                    print("✅ FCM 토큰 변경 + 만료 - 서버 업데이트 성공")
                                } else {
                                    print("❌ FCM 토큰 변경 + 만료 - 서버 업데이트 실패")
                                }
                            }
                        } else {
                            print("🚫 FCM 토큰 변경 감지되었으나 유효기간이 남아있음 - 업데이트 건너뜀")
                        }
                    } else if self.isFCMTokenExpired() {
                        print("⏰ FCM 토큰 유효기간 만료 - 서버 재동기화")
                        self.sendFCMTokenToServer(token: token) { success in
                            if success {
                                print("✅ FCM 토큰 유효기간 만료 - 서버 재동기화 성공")
                            } else {
                                print("❌ FCM 토큰 유효기간 만료 - 서버 재동기화 실패")
                            }
                        }
                    } else {
                        print("✅ FCM 토큰 상태 양호 (유효기간 내) - 추가 작업 불필요")
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

        // 사용자 식별 상태 확인 (mt_idx 기준)
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if hasUserIdentified {
            print("✅ [FCM Auto] 사용자 식별됨(mt_idx 있음) - 수동 토큰 검증만 진행")
            // 🚨 앱 시작 시 즉시 FCM 토큰 확인 및 갱신 (타이머 제거됨)
            performImmediateFCMTokenValidation()
        } else {
            print("🔒 [FCM Auto] 사용자가 식별되지 않음(mt_idx 없음) - 토큰 검증 대기")
        }
    }

    // MARK: - 🔍 FCM 토큰 유효성 검증 초기화
    private func setupFCMTokenValidation() {
        print("🔍 [FCM Validation] FCM 토큰 유효성 검증 초기화")

        // 사용자 식별 상태 확인
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if hasUserIdentified {
            print("✅ [FCM Validation] 사용자 식별됨(mt_idx 있음) - 토큰 검증 시작")
            performFCMTokenValidation()
        } else {
            print("🔒 [FCM Validation] 사용자가 식별되지 않음(mt_idx 없음) - 토큰 검증 대기")
        }
    }

    // MARK: - 🔍 FCM 토큰 유효성 검증 실행
    private func performFCMTokenValidation() {
        print("🔍 [FCM Validation] FCM 토큰 유효성 검증 시작")

        // 📱 앱 상태 확인 - 백그라운드에서도 토큰 검증 허용
        let appState = UIApplication.shared.applicationState
        let isBackground = appState == .background

        print("📱 [FCM Validation] 앱 상태: \(isBackground ? "백그라운드" : "포그라운드") - 토큰 검증 허용")

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
            updateFCMTokenIfNeededWithFetch()
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
                        self?.updateFCMTokenIfNeededWithFetch()
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

        // 🔑 FCM 토큰 강제 업데이트 요청 Notification 추가
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleForceUpdateFCMToken(_:)),
            name: Notification.Name("ForceUpdateFCMToken"),
            object: nil
        )

        print("✅ [FCM Auto] 앱 상태 변화 감지기 설정 완료")
    }

    // 🔑 FCM 토큰 강제 업데이트 Notification 핸들러
    @objc private func handleForceUpdateFCMToken(_ notification: Notification) {
        print("📢 [NOTIFICATION] FCM 토큰 강제 업데이트 요청 수신")
        // 기존의 forceUpdateFCMTokenOnLogin 메소드 호출
        forceUpdateFCMTokenOnLogin()
    }
    
        // 타이머 기반 자동 업데이트 제거됨

    // 백그라운드 타이머 기반 토큰 검증 제거됨

    // MARK: - 백그라운드 FCM 토큰 검증 실행 (타이머 제거됨)
    private func performBackgroundFCMTokenCheck() { // 호출되지 않음
        let bgTimestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        print("🔍 [FCM-BG-VERIFY][\(bgTimestamp)] 백그라운드 FCM 토큰 검증 시작")

        // 사용자 식별 상태 확인
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        guard hasUserIdentified else {
            print("🔒 [FCM Background] 사용자가 식별되지 않음(mt_idx 없음) - 백그라운드 검증 스킵")
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
    
    // MARK: - 🔄 APNs 등록 후 FCM 토큰 처리
    private func handleFCMTokenAfterAPNSRegistration(_ token: String) {
        print("🔄 [APNS+FCM] APNs 등록 후 FCM 토큰 처리 시작: \(token.prefix(30))...")

        // 기존 토큰과 비교
        let existingToken = UserDefaults.standard.string(forKey: "fcm_token")

        // FCM 토큰 저장
        Utils.shared.setToken(token: token)
        UserDefaults.standard.set(token, forKey: "fcm_token")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_received_time")
        UserDefaults.standard.set(token, forKey: "last_updated_fcm_token")
        UserDefaults.standard.synchronize()

        currentFCMToken = token

        print("✅ [APNS+FCM] FCM 토큰 저장 완료")

        // 사용자 식별 상태 확인
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                               UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if hasUserIdentified {
            print("🚀 [APNS+FCM] 사용자 식별됨 - 서버 업데이트 진행")
            updateFCMTokenIfNeededWithCheck(token: token)
        } else {
            print("⏳ [APNS+FCM] 사용자 미식별 - 서버 업데이트 대기")
            UserDefaults.standard.set(token, forKey: "pending_fcm_token_after_user_identified")
            UserDefaults.standard.synchronize()
        }
    }

    // MARK: - 🔄 FCM 토큰 재생성 재시도
    private func retryFCMTokenGeneration() {
        print("🔄 [FCM Retry] FCM 토큰 재생성 재시도")

        Messaging.messaging().token { [weak self] fcmToken, error in
            if let error = error {
                print("❌ [FCM Retry] FCM 토큰 재생성 최종 실패: \(error.localizedDescription)")
                print("🔄 [FCM Retry] 5초 후 최종 재시도")
                DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                    self?.finalFCMTokenAttempt()
                }
            } else if let fcmToken = fcmToken {
                print("✅ [FCM Retry] FCM 토큰 재생성 성공: \(fcmToken.prefix(30))...")
                self?.handleFCMTokenAfterAPNSRegistration(fcmToken)
            }
        }
    }

    // MARK: - 🔄 FCM 토큰 검증 재시도
    private func retryTokenVerification(_ originalToken: String) {
        print("🔄 [FCM Verify Retry] FCM 토큰 검증 재시도")

        Messaging.messaging().token { [weak self] verifiedToken, error in
            if let error = error {
                print("❌ [FCM Verify Retry] 토큰 검증 재시도 실패: \(error.localizedDescription)")
            } else if let verifiedToken = verifiedToken {
                print("✅ [FCM Verify Retry] 토큰 검증 재시도 성공: \(verifiedToken.prefix(30))...")
                if verifiedToken == originalToken {
                    print("✅ [FCM Verify Retry] 토큰 일치 확인 - FCM 서비스 등록 정상")
                    self?.verifyAndRefreshFCMRegistration(verifiedToken)
                } else {
                    print("⚠️ [FCM Verify Retry] 토큰 불일치 - 새로운 토큰으로 업데이트")
                    self?.handleFCMTokenUpdate(verifiedToken)
                }
            }
        }
    }

    // MARK: - 🔄 FCM 토큰 최종 시도
    private func finalFCMTokenAttempt() {
        print("🔄 [FCM Final] FCM 토큰 최종 생성 시도")

        // FCM 서비스 완전 리셋
        Messaging.messaging().isAutoInitEnabled = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            Messaging.messaging().isAutoInitEnabled = true

            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                Messaging.messaging().token { [weak self] fcmToken, error in
                    if let fcmToken = fcmToken {
                        print("✅ [FCM Final] FCM 토큰 최종 성공: \(fcmToken.prefix(30))...")
                        self?.handleFCMTokenAfterAPNSRegistration(fcmToken)
                    } else {
                        print("❌ [FCM Final] FCM 토큰 생성 최종 실패 - 수동 재시도 필요")
                    }
                }
            }
        }
    }

    // MARK: - 🔑 로그인 시 FCM 토큰 강제 업데이트 (웹뷰에서 호출)
    @objc public func forceUpdateFCMTokenOnLogin() {
        print("🔑 [LOGIN] 로그인 시 FCM 토큰 강제 업데이트 시작")

        // 로그인 상태 확인
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                               UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        guard hasUserIdentified else {
            print("🔒 [LOGIN] 사용자가 식별되지 않음(mt_idx 없음) - 로그인 토큰 업데이트 대기")
            // 로그인 완료 후 호출되도록 플래그 설정
            forceTokenUpdateOnLogin = true
            return
        }

        // 현재 FCM 토큰 상태 확인
        let currentToken = UserDefaults.standard.string(forKey: "fcm_token")

        if currentToken == nil || currentToken!.isEmpty {
            print("❌ [LOGIN] 저장된 FCM 토큰이 없음 - 새로운 토큰 강제 생성")
            forceRefreshFCMTokenOnLogin()
        } else {
            print("✅ [LOGIN] FCM 토큰 존재: \(currentToken!.prefix(30))... - 서버 동기화 진행")
            sendFCMTokenToServer(token: currentToken!) { success in
                if success {
                    print("✅ [LOGIN] FCM 토큰 서버 동기화 성공")
                } else {
                    print("❌ [LOGIN] FCM 토큰 서버 동기화 실패 - 재시도")
                    self.forceRefreshFCMTokenOnLogin()
                }
            }
        }
    }

    // 로그인 시 FCM 토큰 강제 새로고침
    private func forceRefreshFCMTokenOnLogin() {
        print("🔄 [LOGIN] 로그인 시 FCM 토큰 강제 새로고침 시작")

        // APNs 토큰이 있는지 확인
        let apnsToken = currentAPNSToken ?? UserDefaults.standard.string(forKey: "last_apns_token")

        if apnsToken != nil {
            print("📱 [LOGIN] APNs 토큰 존재 - FCM 토큰 재생성")
            Messaging.messaging().setAPNSToken(apnsToken!.data(using: .utf8) ?? Data(), type: .unknown)
        } else {
            print("⚠️ [LOGIN] APNs 토큰 없음 - FCM 토큰 재생성 시도")
        }

        // FCM 토큰 강제 새로고침
        Messaging.messaging().token { [weak self] token, error in
            guard let self = self else { return }

            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [LOGIN] FCM 토큰 새로고침 실패: \(error.localizedDescription)")
                    return
                }

                guard let token = token, !token.isEmpty else {
                    print("❌ [LOGIN] FCM 토큰 새로고침 결과가 비어있음")
                    return
                }

                print("✅ [LOGIN] FCM 토큰 새로고침 성공: \(token.prefix(30))...")

                            // 🔥 FCM 토큰 형식 검증 (잘못된 토큰 방지)
            if !self.isValidFCMToken(token) {
                print("🚨 [LOGIN] 잘못된 FCM 토큰 형식 감지 - 서버 업데이트 취소")
                print("   잘못된 토큰: \(token.prefix(50))...")
                print("   토큰 길이: \(token.count)자")

                // 잘못된 토큰 감지 시 FCM 서비스 재초기화 시도
                print("🔄 [LOGIN] 잘못된 토큰으로 인해 FCM 서비스 재초기화 시도")
                self.forceRefreshFCMService()
                return
            }

                print("✅ [LOGIN] FCM 토큰 형식 검증 통과")

                // 무조건 서버에 업데이트 (토큰 비교 없이)
                self.sendFCMTokenToServer(token: token) { success in
                    if success {
                        print("✅ [LOGIN] FCM 토큰 서버 동기화 성공")
                        print("🔄 [LOGIN] 로그인 시 DB 토큰이 현재 앱 토큰과 일치하도록 업데이트됨")

                        // 로컬 저장소에도 업데이트
                        UserDefaults.standard.set(token, forKey: "fcm_token")
                        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_token_update_time")
                        UserDefaults.standard.synchronize()

                    } else {
                        print("❌ [LOGIN] FCM 토큰 서버 동기화 실패 - 재시도")
                        self.forceRefreshFCMTokenOnLogin()
                    }
                }
            }
        }
    }

    // MARK: - 🔐 FCM 메시지 수신 시 권한 재요청
    private func requestNotificationPermissionIfNeeded() {
        print("🔐 [PERMISSION] FCM 메시지 수신 시 권한 재요청 시작")

        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                let isAuthorized = settings.authorizationStatus == .authorized
                let canShowAlerts = settings.alertSetting == .enabled
                let canShowBadges = settings.badgeSetting == .enabled
                let canPlaySounds = settings.soundSetting == .enabled

                print("🔐 [PERMISSION] 현재 권한 상태:")
                print("   • 허용 상태: \(settings.authorizationStatus.rawValue) (\(isAuthorized ? "허용" : "거부"))")
                print("   • 알림 표시: \(settings.alertSetting.rawValue) (\(canShowAlerts ? "가능" : "불가능"))")
                print("   • 배지 표시: \(settings.badgeSetting.rawValue) (\(canShowBadges ? "가능" : "불가능"))")
                print("   • 소리 재생: \(settings.soundSetting.rawValue) (\(canPlaySounds ? "가능" : "불가능"))")

                // 권한이 거부되었거나 일부 기능이 비활성화된 경우 재요청
                if !isAuthorized || !canShowAlerts || !canShowBadges || !canPlaySounds {
                    print("⚠️ [PERMISSION] 권한이 불충분하여 재요청 진행")

                    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                        DispatchQueue.main.async {
                            if granted {
                                print("✅ [PERMISSION] 푸시 권한 재요청 성공")
                                // 권한이 허용되었으므로 로컬 알림 스케줄링
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                                    self.scheduleTestLocalNotification()
                                }
                            } else {
                                print("❌ [PERMISSION] 푸시 권한 재요청 실패 또는 거부됨")
                                if let error = error {
                                    print("❌ [PERMISSION] 권한 요청 오류: \(error.localizedDescription)")
                                }
                                print("💡 [PERMISSION] 사용자가 권한을 거부했습니다.")
                                print("💡 [PERMISSION] 설정 → SMAP → 알림에서 수동으로 권한을 허용해주세요.")
                            }
                        }
                    }
                } else {
                    print("✅ [PERMISSION] 모든 권한이 정상입니다")
                }
            }
        }
    }

    // 테스트 로컬 알림 스케줄링
    private func scheduleTestLocalNotification() {
        print("🔔 [LOCAL] 권한 허용 후 테스트 로컬 알림 스케줄링")

        let content = UNMutableNotificationContent()
        content.title = "🔔 FCM 권한 복원 완료"
        content.body = "푸시 알림 권한이 허용되었습니다. 이제 FCM 메시지가 정상 표시됩니다."
        content.sound = .default
        content.badge = 1

        let request = UNNotificationRequest(identifier: "fcm_permission_restored", content: content, trigger: nil)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ [LOCAL] 테스트 알림 스케줄링 실패: \(error.localizedDescription)")
            } else {
                print("✅ [LOCAL] 테스트 알림 스케줄링 성공")
            }
        }
    }

    // FCM 메시지를 로컬 알림으로 표시 (권한이 없어도 표시 가능)
    private func displayFCMMessageAsLocalNotification(_ remoteMessage: Any) {
        print("📢 [FCM-LOCAL] FCM 메시지를 로컬 알림으로 표시 시도")

        guard let message = remoteMessage as? [AnyHashable: Any] else {
            print("❌ [FCM-LOCAL] 메시지 형식이 올바르지 않음")
            return
        }

        // FCM 메시지에서 제목과 내용 추출
        var title = "📨 FCM 메시지 수신"
        var body = "FCM 메시지가 수신되었습니다"

        if let notification = message["notification"] as? [String: Any] {
            if let msgTitle = notification["title"] as? String {
                title = msgTitle
            }
            if let msgBody = notification["body"] as? String {
                body = msgBody
            }
        } else if let aps = message["aps"] as? [String: Any],
                  let alert = aps["alert"] as? [String: Any] {
            if let msgTitle = alert["title"] as? String {
                title = msgTitle
            }
            if let msgBody = alert["body"] as? String {
                body = msgBody
            }
        }

        print("📝 [FCM-LOCAL] 추출된 제목: \(title)")
        print("📝 [FCM-LOCAL] 추출된 내용: \(body)")

        // 로컬 알림 생성
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = 1
        content.categoryIdentifier = "FCM_MESSAGE"

        let request = UNNotificationRequest(identifier: "fcm_message_\(Date().timeIntervalSince1970)", content: content, trigger: nil)

        // 중복 알림 방지 - FCM 로컬 알림 생성 비활성화
        print("🚫 [FCM-LOCAL] 중복 방지를 위해 FCM 로컬 알림 생성 건너뛰기")
        print("📝 [FCM-LOCAL] 원본 FCM 알림만 사용하여 중복 방지")
    }

    // MARK: - 🔄 FCM 토큰 업데이트 핸들러 (백그라운드 제어 포함)
    private func handleFCMTokenUpdate(_ token: String) {
        print("🔄 [FCM Handler] FCM 토큰 업데이트 핸들러 호출: \(token.prefix(30))...")
        
        // 백그라운드에서는 토큰 변경을 제한
        if isAppInBackground {
            print("🌙 [FCM Handler] 백그라운드 상태 - 토큰 변경 제한")
            
            // 마지막 토큰 업데이트로부터 충분한 시간이 지났는지 확인
            let lastUpdateTime = UserDefaults.standard.double(forKey: "last_background_token_update")
            let currentTime = Date().timeIntervalSince1970
            let timeSinceLastUpdate = currentTime - lastUpdateTime
            
            // 백그라운드에서는 최소 1시간 간격으로만 토큰 업데이트 허용
            if timeSinceLastUpdate < 3600 {
                print("⏳ [FCM Handler] 백그라운드 토큰 업데이트 쿨다운 중 - 스킵")
                return
            }
            
            print("✅ [FCM Handler] 백그라운드 토큰 업데이트 허용 (1시간 경과)")
            UserDefaults.standard.set(currentTime, forKey: "last_background_token_update")
        }

        // 기존 토큰과 비교
        let existingToken = UserDefaults.standard.string(forKey: "fcm_token")
        if existingToken == token {
            print("ℹ️ [FCM Handler] 토큰이 이미 최신 상태입니다")
            return
        }

        // 새로운 토큰으로 업데이트
        Utils.shared.setToken(token: token)
        UserDefaults.standard.set(token, forKey: "fcm_token")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_received_time")
        UserDefaults.standard.set(token, forKey: "last_updated_fcm_token")
        UserDefaults.standard.synchronize()

        currentFCMToken = token

        print("✅ [FCM Handler] FCM 토큰 업데이트 완료")

        // 서버 업데이트 진행 (사용자 식별 확인)
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                               UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if hasUserIdentified {
            print("🚀 [FCM Handler] 사용자 식별됨 - 서버 업데이트 진행")
            updateFCMTokenIfNeededWithCheck(token: token)
        } else {
            print("⏳ [FCM Handler] 사용자 미식별 - 서버 업데이트 대기")
            UserDefaults.standard.set(token, forKey: "pending_fcm_token_after_user_identified")
            UserDefaults.standard.synchronize()
        }
    }

    // MARK: - 🔥 FCM 서비스 강제 재등록 (토큰 변경 시)
    private func forceRefreshFCMServiceRegistration(_ token: String) {
        print("🔥 [FCM Force] FCM 서비스 강제 재등록 시작")

        // 1. FCM 서비스 완전 리셋 (더 강력한 방법)
        print("🔄 [FCM Force] FCM 서비스 완전 리셋")
        Messaging.messaging().isAutoInitEnabled = false

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            Messaging.messaging().isAutoInitEnabled = true

            // 2. APNs 토큰 재설정 (있는 경우)
            if let apnsToken = self.currentAPNSToken {
                print("📱 [FCM Force] APNs 토큰 재설정: \(apnsToken.prefix(20))...")
                Messaging.messaging().setAPNSToken(apnsToken.data(using: .utf8) ?? Data(), type: .unknown)
            } else {
                print("⚠️ [FCM Force] APNs 토큰 없음 - FCM 재등록에 영향 가능")
            }

            // 3. FCM 토큰 재생성 및 재등록 (강화된 시도)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.retryFCMTokenRegistration(token, attempt: 1, maxAttempts: 5) // 시도 횟수 증가
            }
        }

        print("✅ [FCM Force] FCM 서비스 강제 재등록 요청 완료")
    }

    // MARK: - 🔄 FCM 서비스 재초기화

    /// FCM 서비스 재초기화 - 잘못된 토큰 감지 시 호출
    private func forceRefreshFCMService() {
        print("🔄 [FCM Service] FCM 서비스 강제 재초기화 시작")

        // 재시도 카운터 초기화
        UserDefaults.standard.set(0, forKey: "fcm_retry_attempt")
        UserDefaults.standard.synchronize()

        // FCM 토큰 캐시 클리어
        UserDefaults.standard.removeObject(forKey: "fcm_token")
        UserDefaults.standard.removeObject(forKey: "last_token_update_time")
        UserDefaults.standard.synchronize()

        // FCM 서비스 재초기화
        Messaging.messaging().deleteToken { error in
            if let error = error {
                print("❌ [FCM Service] FCM 토큰 삭제 실패: \(error.localizedDescription)")
            } else {
                print("✅ [FCM Service] FCM 토큰 삭제 성공")

                // 잠시 대기 후 재초기화
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    print("🔄 [FCM Service] FCM 서비스 재초기화 진행")

                    // FCM delegate 재설정
                    Messaging.messaging().delegate = self

                    // APNs 토큰 재설정 (있는 경우)
                    if let apnsToken = self.currentAPNSToken ?? UserDefaults.standard.string(forKey: "last_apns_token") {
                        print("📱 [FCM Service] APNs 토큰 재설정")
                        Messaging.messaging().setAPNSToken(apnsToken.data(using: .utf8) ?? Data(), type: .unknown)
                    }

                    // 새로운 FCM 토큰 요청
                    Messaging.messaging().token { token, error in
                        if let error = error {
                            print("❌ [FCM Service] 새로운 FCM 토큰 요청 실패: \(error.localizedDescription)")
                        } else if let token = token {
                            print("✅ [FCM Service] 새로운 FCM 토큰 획득: \(token.prefix(30))...")

                            // 새로운 토큰 검증
                            if self.isValidFCMToken(token) {
                                print("✅ [FCM Service] 새로운 토큰 검증 통과 - 서버 업데이트 진행")
                                self.sendFCMTokenToServer(token: token) { success in
                                    if success {
                                        print("✅ [FCM Service] FCM 서비스 재초기화 및 토큰 업데이트 성공")
                                    } else {
                                        print("❌ [FCM Service] 서버 업데이트 실패")
                                    }
                                }
                            } else {
                                print("🚨 [FCM Service] 새로운 토큰도 잘못됨 - 추가 재시도 필요")
                                // 최대 3회까지 재시도
                                let maxRetryAttempts = 3
                                let currentAttempt = UserDefaults.standard.integer(forKey: "fcm_retry_attempt")
                                if currentAttempt < maxRetryAttempts {
                                    UserDefaults.standard.set(currentAttempt + 1, forKey: "fcm_retry_attempt")
                                    UserDefaults.standard.synchronize()

                                    // 점진적 재시도 간격 (1초, 3초, 5초)
                                    let retryDelay = Double(currentAttempt + 1) * 2.0 - 1.0
                                    print("🔄 [FCM Service] 재시도 \(currentAttempt + 1)/\(maxRetryAttempts) - \(retryDelay)초 후 재시도")

                                    DispatchQueue.main.asyncAfter(deadline: .now() + retryDelay) {
                                        self.forceRefreshFCMService()
                                    }
                                } else {
                                    print("❌ [FCM Service] 최대 재시도 횟수 초과 - 재시도 중단")
                                    UserDefaults.standard.set(0, forKey: "fcm_retry_attempt")
                                    UserDefaults.standard.synchronize()
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - 🔍 FCM 토큰 검증 헬퍼 함수들

    /// FCM 토큰 형식을 검증하는 함수
    private func isValidFCMToken(_ token: String) -> Bool {
        // FCM 토큰 기본 검증
        guard !token.isEmpty else {
            fcmEventLog("❌ FCM 토큰이 비어있음")
            return false
        }

        // 길이 검증 (FCM 토큰은 보통 140-180자 정도)
        guard token.count >= 100 && token.count <= 200 else {
            fcmEventLog("❌ FCM 토큰 길이가 올바르지 않음: \(token.count)자")
            return false
        }

        // 형식 검증 (프로젝트ID:APA91b... 형태)
        guard token.contains(":") else {
            fcmEventLog("❌ FCM 토큰에 콜론(:)이 없음")
            return false
        }

        let parts = token.split(separator: ":", maxSplits: 1)
        guard parts.count == 2 else {
            fcmEventLog("❌ FCM 토큰 형식이 올바르지 않음")
            return false
        }

        let projectId = String(parts[0])
        let tokenPart = String(parts[1])

        // 프로젝트 ID 검증 (숫자 또는 문자열 모두 허용)
        guard !projectId.isEmpty && projectId.count >= 1 && projectId.count <= 50 else {
            fcmEventLog("❌ FCM 토큰 프로젝트 ID가 올바르지 않음 (길이: \(projectId.count))")
            return false
        }

        // 프로젝트 ID에 유효하지 않은 문자 검증 (공백, 특수문자 등)
        let invalidChars = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "<>\"{}|\\^`"))
        guard projectId.rangeOfCharacter(from: invalidChars) == nil else {
            fcmEventLog("❌ FCM 토큰 프로젝트 ID에 유효하지 않은 문자가 포함됨")
            return false
        }

        // 토큰 부분 검증 (APA91b로 시작하는지)
        guard tokenPart.hasPrefix("APA91b") || tokenPart.hasPrefix("APA91") else {
            fcmEventLog("❌ FCM 토큰이 APA91로 시작하지 않음")
            return false
        }

        // 토큰 부분 길이 검증
        guard tokenPart.count >= 100 else {
            fcmEventLog("❌ FCM 토큰 부분이 너무 짧음: \(tokenPart.count)자")
            return false
        }

        fcmEventLog("✅ FCM 토큰 형식 검증 통과")
        return true
    }

    // MARK: - 🔥 FCM 토큰 강제 동기화 (앱 시작 시)

    /// 앱 시작 시 FCM 토큰 강제 동기화 - 무조건 현재 토큰으로 DB 업데이트
    private func forceSyncFCMTokenOnAppLaunch() {
        print("🔥 [FCM Force Sync] 앱 시작 시 FCM 토큰 강제 동기화 시작")

        // 사용자 식별 상태 확인
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                               UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if !hasUserIdentified {
            print("⏳ [FCM Force Sync] 사용자 미식별 - 토큰 동기화 대기")
            return
        }

        // 강제 업데이트 플래그 확인
        let forceUpdate = UserDefaults.standard.bool(forKey: "force_fcm_token_update")
        if forceUpdate {
            print("🚩 [FCM Force Sync] 토큰 변경 감지됨 - 강제 업데이트 모드 활성화")
        }

        // FCM 토큰을 가져와서 즉시 서버 업데이트
        Messaging.messaging().token { [weak self] token, error in
            guard let self = self else { return }

            if let error = error {
                print("❌ [FCM Force Sync] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                return
            }

            guard let token = token else {
                print("❌ [FCM Force Sync] FCM 토큰이 nil입니다")
                return
            }

            print("🔥 [FCM Force Sync] 현재 FCM 토큰 발견: \(token.prefix(30))...")

            // 🔥 FCM 토큰 형식 검증 (잘못된 토큰 방지)
            if !self.isValidFCMToken(token) {
                print("🚨 [FCM Force Sync] 잘못된 FCM 토큰 형식 감지 - 서버 업데이트 취소")
                print("   잘못된 토큰: \(token.prefix(50))...")
                print("   토큰 길이: \(token.count)자")

                // 잘못된 토큰 감지 시 FCM 서비스 재초기화 시도
                print("🔄 [FCM Force Sync] 잘못된 토큰으로 인해 FCM 서비스 재초기화 시도")
                self.forceRefreshFCMService()
                return
            }

            print("✅ [FCM Force Sync] FCM 토큰 형식 검증 통과")

            // 무조건 서버에 업데이트 (토큰 비교 없이)
            self.sendFCMTokenToServer(token: token) { success in
                if success {
                    print("✅ [FCM Force Sync] 앱 시작 시 FCM 토큰 강제 동기화 성공")
                    print("🔄 [FCM Force Sync] DB 토큰이 현재 앱 토큰과 일치하도록 업데이트됨")

                    // 로컬 저장소에도 업데이트
                    UserDefaults.standard.set(token, forKey: "fcm_token")
                    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_token_update_time")
                    UserDefaults.standard.synchronize()

                    // 강제 업데이트 플래그 리셋
                    UserDefaults.standard.set(false, forKey: "force_fcm_token_update")
                    UserDefaults.standard.synchronize()
                    print("🔄 [FCM Force Sync] 강제 업데이트 플래그 리셋됨")

                } else {
                    print("❌ [FCM Force Sync] 앱 시작 시 FCM 토큰 강제 동기화 실패")
                    print("🔄 [FCM Force Sync] 다음 기회에 재시도 예정")
                }
            }
        }
    }

    // MARK: - 🕐 FCM 로그 헬퍼 함수들

    /// FCM 로그에 타임스탬프 추가 (정밀한 시분초)
    private func fcmLog(_ message: String) {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        let timestamp = formatter.string(from: Date())
        print("🔔 [FCM][\(timestamp)] \(message)")
    }

    /// FCM 이벤트 로그 (더 자세한 정보용)
    private func fcmEventLog(_ message: String, token: String? = nil) {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        let timestamp = formatter.string(from: Date())
        var logMessage = "🔥 [FCM-EVENT][\(timestamp)] \(message)"
        if let token = token {
            logMessage += " | Token: \(token.prefix(20))..."
        }
        print(logMessage)
    }

    /// FCM 백그라운드 로그
    private func fcmBackgroundLog(_ message: String) {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        let timestamp = formatter.string(from: Date())
        print("🛡️ [FCM-BG][\(timestamp)] \(message)")
    }

    // MARK: - 🔄 FCM 토큰 재등록 재시도
    private func retryFCMTokenRegistration(_ originalToken: String, attempt: Int, maxAttempts: Int) {
        print("🔄 [FCM Retry] 토큰 재등록 시도 \(attempt)/\(maxAttempts)")

        DispatchQueue.main.asyncAfter(deadline: .now() + TimeInterval(attempt)) {
            Messaging.messaging().token { [weak self] refreshedToken, error in
                if let error = error {
                    print("❌ [FCM Retry] 재등록 시도 \(attempt) 실패: \(error.localizedDescription)")
                    if attempt < maxAttempts {
                        self?.retryFCMTokenRegistration(originalToken, attempt: attempt + 1, maxAttempts: maxAttempts)
                    } else {
                        print("❌ [FCM Retry] 모든 재등록 시도 실패 - 백그라운드 재등록 시도")
                        // 모든 시도가 실패하면 백그라운드 재등록 시도
                        self?.performBackgroundFCMRegistration(originalToken)
                    }
                } else if let refreshedToken = refreshedToken {
                    print("✅ [FCM Retry] 재등록 시도 \(attempt) 성공: \(refreshedToken.prefix(30))...")
                    if refreshedToken == originalToken {
                        print("🎯 [FCM Retry] FCM 서비스 재등록 완료 - 토큰 일치")
                        // FCM 등록 상태 검증
                        self?.verifyFCMRegistrationStatus(refreshedToken)
                    } else {
                        print("⚠️ [FCM Retry] 재등록 토큰 불일치 - 새로운 토큰 사용")
                        self?.handleFCMTokenUpdate(refreshedToken)
                    }
                }
            }
        }
    }

    // MARK: - 🔒 FCM 토큰 백업 및 유효성 검증 시스템

    // FCM 토큰 변경 전 백업 저장
    private func backupCurrentFCMToken(_ token: String) {
        print("💾 [FCM Backup] FCM 토큰 변경 전 백업 저장")
        UserDefaults.standard.set(token, forKey: "fcm_token_backup")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_backup_time")
        UserDefaults.standard.synchronize()
        print("✅ [FCM Backup] FCM 토큰 백업 완료: \(token.prefix(20))...")
    }

    // FCM 토큰 유효성 및 APNs 매칭 상태 검증
    private func validateFCMTokenIntegrity(_ token: String, completion: @escaping (Bool, String) -> Void) {
        print("🔍 [FCM Validation] FCM 토큰 유효성 검증 시작")

        // 1. 기본 토큰 형식 검증
        guard token.count >= 100 else {
            completion(false, "토큰 길이 비정상")
            return
        }

        guard token.contains(":") else {
            completion(false, "토큰 형식 오류")
            return
        }

        // 2. APNs 토큰 존재 확인 (백그라운드에서는 선택적)
        let appState = UIApplication.shared.applicationState
        let isBackground = appState == .background

        if !isBackground {
            // 포그라운드에서는 APNs 토큰 필수
            guard let apnsToken = currentAPNSToken else {
                completion(false, "APNs 토큰 없음 (포그라운드)")
                return
            }
        } else {
            // 백그라운드에서는 APNs 토큰이 없어도 FCM 검증 진행 (푸시 수신 우선)
            if currentAPNSToken == nil {
                print("⚠️ [FCM Validation] 백그라운드에서 APNs 토큰 없음 - FCM 검증 계속 진행")
            }
        }

        // 3. FCM 서비스 상태 확인 (간단한 토큰 요청으로 검증)
        Messaging.messaging().token { [weak self] refreshedToken, error in
            if let error = error {
                print("❌ [FCM Validation] FCM 서비스 검증 실패: \(error.localizedDescription)")
                completion(false, "FCM 서비스 오류: \(error.localizedDescription)")
                return
            }

            if let refreshedToken = refreshedToken {
                // 4. 토큰 일관성 확인
                let isConsistent = refreshedToken == token
                if isConsistent {
                    print("✅ [FCM Validation] FCM 토큰 검증 성공 - 일관성 확인됨")
                    completion(true, "FCM 토큰 유효")
                } else {
                    print("⚠️ [FCM Validation] FCM 토큰 불일치 감지")
                    print("   📱 요청 토큰: \(token.prefix(20))...")
                    print("   🔄 갱신 토큰: \(refreshedToken.prefix(20))...")

                    if isBackground {
                        // 백그라운드에서는 토큰 불일치가 발생해도 검증 통과 (푸시 수신 우선)
                        print("🛡️ [FCM Validation] 백그라운드 토큰 불일치 - 검증 통과 (푸시 수신 우선)")
                        completion(true, "FCM 토큰 유효 (백그라운드)")
                    } else {
                        completion(false, "FCM 토큰 불일치")
                    }
                }
            } else {
                // FCM 토큰 갱신 실패
                if isBackground {
                    // 백그라운드에서는 FCM 토큰 갱신 실패해도 검증 통과 (푸시 수신 우선)
                    print("⚠️ [FCM Validation] 백그라운드 FCM 토큰 갱신 실패 - 검증 통과 (푸시 수신 우선)")
                    completion(true, "FCM 토큰 유효 (백그라운드 - 갱신 실패)")
                } else {
                    completion(false, "FCM 토큰 갱신 실패")
                }
            }
        }
    }

    // FCM 토큰 롤백 (이전 토큰으로 복원)
    private func rollbackFCMToken(_ reason: String) {
        print("🔄 [FCM Rollback] FCM 토큰 롤백 시작 - 사유: \(reason)")

        guard let backupToken = UserDefaults.standard.string(forKey: "fcm_token_backup") else {
            print("❌ [FCM Rollback] 백업 토큰 없음 - 롤백 불가")
            return
        }

        // 백업 토큰을 현재 토큰으로 복원
        UserDefaults.standard.set(backupToken, forKey: "fcm_token")
        UserDefaults.standard.set(backupToken, forKey: "last_updated_fcm_token")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_received_time")

        // FCM 서비스에 백업 토큰 재등록
        Messaging.messaging().setAPNSToken(currentAPNSToken?.data(using: .utf8) ?? Data(), type: .unknown)

        print("✅ [FCM Rollback] FCM 토큰 롤백 완료: \(backupToken.prefix(20))...")

        // 롤백 기록
        UserDefaults.standard.set(reason, forKey: "last_rollback_reason")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_rollback_time")
        UserDefaults.standard.synchronize()
    }

    // FCM 토큰 안전 업데이트 (검증 후 업데이트)
    private func safelyUpdateFCMToken(_ newToken: String, completion: @escaping (Bool) -> Void) {
        print("🛡️ [FCM Safe Update] 안전한 FCM 토큰 업데이트 시작")

        // 1. 현재 토큰 백업
        let currentToken = UserDefaults.standard.string(forKey: "fcm_token") ?? ""
        if !currentToken.isEmpty {
            backupCurrentFCMToken(currentToken)
        }

        // 2. FCM 토큰 유효성 검증
        validateFCMTokenIntegrity(newToken) { [weak self] isValid, reason in
            if isValid {
                print("✅ [FCM Safe Update] 토큰 검증 성공 - DB 업데이트 진행")

                // 검증 성공: DB 업데이트 진행
                self?.sendFCMTokenToServer(token: newToken) { success in
                    if success {
                        print("🎯 [FCM Safe Update] DB 업데이트 성공")

                        // DB 업데이트 성공 후 FCM 서비스 상태 확인
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                            print("🔍 [FCM Debug] DB 업데이트 성공 후 FCM 서비스 상태 확인")
                            self?.checkFCMServiceRegistrationStatus()
                        }

                        completion(true)
                    } else {
                        print("⚠️ [FCM Safe Update] DB 업데이트 실패 - 롤백 실행")
                        self?.rollbackFCMToken("DB 업데이트 실패")

                        // DB 업데이트 실패 시 FCM 서비스 상태 확인
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                            print("🔍 [FCM Debug] DB 업데이트 실패 후 FCM 서비스 상태 확인")
                            self?.checkFCMServiceRegistrationStatus()
                        }

                        completion(false)
                    }
                }
            } else {
                print("❌ [FCM Safe Update] 토큰 검증 실패 - 롤백 실행")
                print("   사유: \(reason)")

                // 검증 실패: 롤백 실행
                self?.rollbackFCMToken("토큰 검증 실패: \(reason)")

                // 토큰 검증 실패 시 FCM 서비스 상태 확인
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    print("🔍 [FCM Debug] 토큰 검증 실패 후 FCM 서비스 상태 확인")
                    self?.checkFCMServiceRegistrationStatus()
                }

                completion(false)
            }
        }
    }

    /// 백그라운드용 안전한 FCM 토큰 업데이트 (강화된 버전)
    private func safelyUpdateFCMTokenBackground(_ newToken: String, completion: @escaping (Bool) -> Void) {
        print("🛡️ [FCM Background Safe Update] 백그라운드용 안전한 FCM 토큰 업데이트 시작")

        // 백그라운드에서는 더 엄격한 토큰 검증
        validateFCMTokenIntegrityBackground(newToken) { [weak self] isValid, reason in
            guard let self = self else {
                print("❌ [FCM Background Safe Update] self가 nil입니다 - 업데이트 중단")
                return
            }

            if isValid {
                print("✅ [FCM Background Safe Update] 백그라운드 토큰 검증 성공 - DB 업데이트 진행")

                // 백그라운드에서는 서버 업데이트를 2번 시도
                self.sendFCMTokenToServerBackground(token: newToken, retryCount: 0) { success in
                    if success {
                        print("🎯 [FCM Background Safe Update] 백그라운드 DB 업데이트 성공")

                        // 백그라운드 토큰 업데이트 성공 후 로컬 저장 보장
                        UserDefaults.standard.set(newToken, forKey: "fcm_token")
                        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_token_update_time")
                        UserDefaults.standard.synchronize()

                        completion(true)
                    } else {
                        print("❌ [FCM Background Safe Update] 백그라운드 DB 업데이트 실패")
                        completion(false)
                    }
                }
            } else {
                print("❌ [FCM Background Safe Update] 백그라운드 토큰 검증 실패")
                print("   사유: \(reason)")
                completion(false)
            }
        }
    }

    /// 백그라운드용 FCM 토큰 검증 (더 엄격한 검증)
    private func validateFCMTokenIntegrityBackground(_ token: String, completion: @escaping (Bool, String) -> Void) {
        print("🔍 [FCM Background Validate] 백그라운드용 토큰 검증 시작")

        // 1. 기본 검증 (길이, 형식)
        if token.isEmpty {
            completion(false, "토큰이 비어있음")
            return
        }

        if token.count < 100 {
            completion(false, "토큰 길이가 너무 짧음 (\(token.count)자)")
            return
        }

        // 2. iOS 토큰 형식 검증 (콜론 포함)
        if !token.contains(":") {
            completion(false, "iOS 토큰 형식이 아님 (콜론 누락)")
            return
        }

        // 3. 현재 앱 상태 확인
        let appState = UIApplication.shared.applicationState
        print("📱 [FCM Background Validate] 현재 앱 상태: \(appState.rawValue)")

        // 4. FCM 서비스 상태 확인 (백그라운드용 강화된 검증)
        if Messaging.messaging().fcmToken == nil {
            print("⚠️ [FCM Background Validate] FCM 서비스에서 현재 토큰이 nil")
            print("🔄 [FCM Background Validate] FCM 서비스 재초기화 시도")

            // FCM 서비스 재초기화 시도
            Messaging.messaging().isAutoInitEnabled = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                Messaging.messaging().isAutoInitEnabled = true

                // 1초 후 토큰 재확인
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    if Messaging.messaging().fcmToken != nil {
                        print("✅ [FCM Background Validate] FCM 서비스 재초기화 성공")
                        self.validateFCMTokenIntegrityBackground(token, completion: completion)
                    } else {
                        print("❌ [FCM Background Validate] FCM 서비스 재초기화 실패")
                        completion(false, "FCM 서비스 재초기화 실패")
                    }
                }
            }
            return
        }

        // FCM 토큰 길이 검증 (백그라운드용)
        if token.count < 140 || token.count > 180 {
            print("⚠️ [FCM Background Validate] FCM 토큰 길이 비정상: \(token.count)자")
            print("🔄 [FCM Background Validate] 토큰 재생성 시도")

            // 토큰 재생성 시도
            Messaging.messaging().token { [weak self] newToken, error in
                if let newToken = newToken, error == nil {
                    print("✅ [FCM Background Validate] 토큰 재생성 성공")
                    self?.validateFCMTokenIntegrityBackground(newToken, completion: completion)
                } else {
                    print("❌ [FCM Background Validate] 토큰 재생성 실패")
                    completion(false, "토큰 재생성 실패")
                }
            }
            return
        }

        // 5. 백그라운드에서는 APNs 토큰 상태도 확인
        let apnsTokenSet = UserDefaults.standard.data(forKey: "apns_token") != nil
        if !apnsTokenSet {
            print("⚠️ [FCM Background Validate] APNs 토큰이 설정되지 않음")
        }

        print("✅ [FCM Background Validate] 백그라운드 토큰 검증 완료")
        completion(true, "검증 통과")
    }

    /// 백그라운드용 서버 토큰 전송 (재시도 기능 포함)
    private func sendFCMTokenToServerBackground(token: String, retryCount: Int, completion: @escaping (Bool) -> Void) {
        print("📡 [FCM Background Server] 백그라운드 서버 토큰 전송 시작 (시도 \(retryCount + 1)/2)")

        sendFCMTokenToServer(token: token) { [weak self] success in
            guard let self = self else {
                print("❌ [FCM Background Server] self가 nil입니다 - 전송 중단")
                completion(false)
                return
            }

            if success {
                print("✅ [FCM Background Server] 백그라운드 서버 토큰 전송 성공")
                completion(true)
            } else {
                if retryCount < 1 { // 최대 2번 시도
                    print("⚠️ [FCM Background Server] 백그라운드 서버 토큰 전송 실패 - 3초 후 재시도")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                        self.sendFCMTokenToServerBackground(token: token, retryCount: retryCount + 1, completion: completion)
                    }
                } else {
                    print("❌ [FCM Background Server] 백그라운드 서버 토큰 전송 최종 실패")
                    completion(false)
                }
            }
        }
    }

    /// 백그라운드 토큰 업데이트 재시도 로직
    private func retryBackgroundTokenUpdate(_ token: String, attempt: Int) {
        print("🔄 [FCM Background Retry] 백그라운드 토큰 업데이트 재시도 \(attempt)/3")

        if attempt >= 3 {
            print("❌ [FCM Background Retry] 최대 재시도 횟수 초과 - 백그라운드 토큰 업데이트 포기")
            return
        }

        // 재시도 간격: 1회=5초, 2회=10초, 3회=15초
        let delay = Double(attempt) * 5.0

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            print("🔄 [FCM Background Retry] 재시도 \(attempt) 시작")

            // FCM 서비스 재등록부터 다시 시작
            self.forceRefreshFCMServiceRegistration(token)

            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.safelyUpdateFCMTokenBackground(token) { success in
                    if success {
                        print("✅ [FCM Background Retry] 재시도 \(attempt) 성공")
                    } else {
                        print("❌ [FCM Background Retry] 재시도 \(attempt) 실패 - 다음 재시도")
                        self.retryBackgroundTokenUpdate(token, attempt: attempt + 1)
                    }
                }
            }
        }
    }

    /// 백그라운드 푸시 수신 상태 검증
    private func verifyBackgroundPushReception(_ token: String) {
        print("🔔 [FCM Background Verify] 백그라운드 푸시 수신 상태 검증 시작")

        // 1. FCM 서비스 상태 확인
        checkFCMServiceRegistrationStatus()

        // 2. 토큰 일치성 확인
        let currentToken = UserDefaults.standard.string(forKey: "fcm_token")
        let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token")

        print("🔍 [FCM Background Verify] 토큰 일치성 확인:")
        print("   📱 현재 토큰: \(currentToken?.prefix(20) ?? "없음")...")
        print("   💾 DB 토큰: \(dbToken?.prefix(20) ?? "없음")...")

        if currentToken != dbToken {
            print("⚠️ [FCM Background Verify] 토큰 불일치 감지 - 추가 동기화 필요")
            // 백그라운드에서 토큰 불일치 시 즉시 서버 동기화
            sendFCMTokenToServerBackground(token: token, retryCount: 0) { success in
                if success {
                    print("✅ [FCM Background Verify] 백그라운드 토큰 동기화 성공")
                } else {
                    print("❌ [FCM Background Verify] 백그라운드 토큰 동기화 실패")
                }
            }
        } else {
            print("✅ [FCM Background Verify] 토큰 일치 확인")
        }

        // 3. APNs 권한 상태 확인
        checkPushNotificationPermissions { granted, settings in
            print("🔐 [FCM Background Verify] 푸시 권한 상태: \(granted ? "허용" : "거부")")
            if !granted {
                print("⚠️ [FCM Background Verify] 푸시 권한이 거부됨 - 권한 재요청 필요")
            }
        }

        print("✅ [FCM Background Verify] 백그라운드 푸시 수신 상태 검증 완료")
    }

    /// 푸시 알림 권한 상태 확인 (간단 버전)
    private func checkPushNotificationPermissions() {
        checkPushNotificationPermissions { granted, settings in
            print("🔐 [Push Permission] 푸시 권한 상태: \(granted ? "허용" : "거부")")
        }
    }

    /// 푸시 알림 권한 상태 확인 (상세 버전)
    private func checkPushNotificationPermissions(completion: @escaping (Bool, UNNotificationSettings) -> Void) {
        print("🔐 [Push Permission] 푸시 알림 권한 상태 확인 시작")

        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                let isAuthorized = settings.authorizationStatus == .authorized
                let canShowAlerts = settings.alertSetting == .enabled
                let canShowBadges = settings.badgeSetting == .enabled
                let canPlaySounds = settings.soundSetting == .enabled

                print("🔐 [Push Permission] 권한 상세 상태:")
                print("   • 허용 상태: \(settings.authorizationStatus.rawValue) (\(isAuthorized ? "허용" : "거부"))")
                print("   • 알림 표시: \(settings.alertSetting.rawValue) (\(canShowAlerts ? "가능" : "불가능"))")
                print("   • 배지 표시: \(settings.badgeSetting.rawValue) (\(canShowBadges ? "가능" : "불가능"))")
                print("   • 소리 재생: \(settings.soundSetting.rawValue) (\(canPlaySounds ? "가능" : "불가능"))")

                let overallGranted = isAuthorized && canShowAlerts && canShowBadges && canPlaySounds
                completion(overallGranted, settings)
            }
        }
    }

    /// FCM 토큰 긴급 복구 (백그라운드용)
    private func emergencyFCMTokenRecovery() {
        print("🚨 [FCM Emergency] FCM 토큰 긴급 복구 시작")

        // 1. 저장된 토큰 확인
        if let savedToken = UserDefaults.standard.string(forKey: "fcm_token"), !savedToken.isEmpty {
            print("🔍 [FCM Emergency] 저장된 토큰 발견 - 재등록 시도")
            forceRefreshFCMServiceRegistration(savedToken)
        } else {
            print("⚠️ [FCM Emergency] 저장된 토큰 없음 - FCM 서비스 재초기화")
            // FCM 서비스 재초기화
            Messaging.messaging().isAutoInitEnabled = true
            Messaging.messaging().delegate = self
        }

        // 2. 5초 후 재확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            self.checkFCMServiceRegistrationStatus()
        }

        print("✅ [FCM Emergency] FCM 토큰 긴급 복구 완료")
    }

    /// FCM 서비스 긴급 복구 (백그라운드용)
    private func emergencyFCMServiceRecovery(_ token: String) {
        print("🚨 [FCM Emergency] FCM 서비스 긴급 복구 시작")

        // 1. FCM 서비스 상태 재설정
        Messaging.messaging().isAutoInitEnabled = true
        Messaging.messaging().delegate = self

        // 2. FCM 토큰 강제 재등록
        forceRefreshFCMServiceRegistration(token)

        // 3. APNs 토큰 재설정 (가능한 경우)
        if let apnsToken = UserDefaults.standard.data(forKey: "apns_token") {
            print("🔄 [FCM Emergency] APNs 토큰 재설정")
            Messaging.messaging().apnsToken = apnsToken
        }

        // 4. 3초 후 상태 재확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            self.checkFCMServiceRegistrationStatus()
        }

        print("✅ [FCM Emergency] FCM 서비스 긴급 복구 완료")
    }

    /// 토큰 변경 시 지연적 서버 업데이트 (백그라운드 최적화)
    private func scheduleDelayedTokenUpdate(_ token: String, delay: TimeInterval = 10.0) {
        print("⏰ [FCM Delayed Update] 토큰 변경 시 지연적 서버 업데이트 예약 (\(Int(delay))초 후)")

        // 기존 예약된 업데이트 취소
        cancelDelayedTokenUpdate()

        // 새로운 업데이트 예약
        let updateWorkItem = DispatchWorkItem { [weak self] in
            print("⏰ [FCM Delayed Update] 지연적 서버 업데이트 실행")
            self?.sendFCMTokenToServerBackground(token: token, retryCount: 0) { success in
                if success {
                    print("✅ [FCM Delayed Update] 지연적 서버 업데이트 성공")
                } else {
                    print("❌ [FCM Delayed Update] 지연적 서버 업데이트 실패 - 재예약")
                    // 실패 시 더 긴 지연으로 재예약
                    self?.scheduleDelayedTokenUpdate(token, delay: delay * 2)
                }
            }
        }

        // 예약된 작업 저장 (취소용)
        UserDefaults.standard.set(Date().timeIntervalSince1970 + delay, forKey: "delayed_token_update_scheduled")
        UserDefaults.standard.synchronize()

        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: updateWorkItem)

        // 작업 아이템 저장 (취소용)
        delayedTokenUpdateWorkItem = updateWorkItem

        print("✅ [FCM Delayed Update] 지연적 서버 업데이트 예약 완료")
    }

    /// 지연적 토큰 업데이트 취소
    private func cancelDelayedTokenUpdate() {
        if let workItem = delayedTokenUpdateWorkItem {
            workItem.cancel()
            delayedTokenUpdateWorkItem = nil
            print("🗑️ [FCM Delayed Update] 기존 지연적 업데이트 취소")
        }

        UserDefaults.standard.removeObject(forKey: "delayed_token_update_scheduled")
        UserDefaults.standard.synchronize()
    }

    /// 백그라운드 토큰 업데이트 전략 (지연적 vs 즉시)
    private func determineBackgroundTokenUpdateStrategy(_ token: String) -> BackgroundTokenUpdateStrategy {
        let appState = UIApplication.shared.applicationState
        let backgroundTimeRemaining = UIApplication.shared.backgroundTimeRemaining

        print("🎯 [FCM Strategy] 백그라운드 토큰 업데이트 전략 결정")
        print("📊 [FCM Strategy] 백그라운드 잔여 시간: \(backgroundTimeRemaining)초")
        print("📱 [FCM Strategy] 앱 상태: \(appState.rawValue)")

        // 백그라운드 시간이 충분하면 즉시 업데이트
        if backgroundTimeRemaining > 25.0 {
            fcmBackgroundLog("✅ 백그라운드 시간이 충분 (\(Int(backgroundTimeRemaining))초) - 즉시 업데이트")
            return .immediate
        }

        // 백그라운드 시간이 보통이면 짧은 지연으로 업데이트
        else if backgroundTimeRemaining > 15.0 {
            fcmBackgroundLog("⏰ 백그라운드 시간 보통 (\(Int(backgroundTimeRemaining))초) - 3초 지연 업데이트")
            return .delayed(3.0)
        }

        // 백그라운드 시간이 부족하면 긴 지연으로 업데이트 (포그라운드 진입 대기)
        else if backgroundTimeRemaining > 8.0 {
            fcmBackgroundLog("⏳ 백그라운드 시간 부족 (\(Int(backgroundTimeRemaining))초) - 10초 지연 업데이트")
            return .delayed(10.0)
        }

        // 백그라운드 시간이 매우 부족하면 취소 (다음 기회에)
        else {
            fcmBackgroundLog("❌ 백그라운드 시간 매우 부족 (\(Int(backgroundTimeRemaining))초) - 취소 (포그라운드에서 재시도)")
            return .cancel
        }
    }

    /// 백그라운드 토큰 업데이트 실행
    private func executeBackgroundTokenUpdate(_ token: String, strategy: BackgroundTokenUpdateStrategy) {
        switch strategy {
        case .immediate:
            self.fcmBackgroundLog("🚀 즉시 토큰 업데이트 실행")
            safelyUpdateFCMTokenBackground(token) { success in
                if success {
                    self.fcmBackgroundLog("✅ 즉시 업데이트 성공")
                } else {
                    self.fcmBackgroundLog("❌ 즉시 업데이트 실패 - 10초 지연 업데이트로 전환")
                    self.scheduleDelayedTokenUpdate(token, delay: 10.0)
                }
            }

        case .delayed(let delay):
            self.fcmBackgroundLog("⏰ 지연적 토큰 업데이트 실행 (\(Int(delay))초 후)")
            scheduleDelayedTokenUpdate(token, delay: delay)

        case .cancel:
            self.fcmBackgroundLog("🗑️ 토큰 업데이트 취소")
            self.fcmBackgroundLog("🔄 포그라운드 진입 시 재시도 예정")

            // 취소된 토큰을 임시 저장하여 포그라운드에서 재시도
            UserDefaults.standard.set(token, forKey: "pending_background_fcm_token")
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "pending_token_cancelled_time")
            UserDefaults.standard.set(token, forKey: "fcm_token") // 로컬 저장도 유지
            UserDefaults.standard.synchronize()

            self.fcmBackgroundLog("💾 취소된 토큰 임시 저장 - 포그라운드에서 재시도")
        }
    }

    // 지연적 토큰 업데이트 작업 아이템 (취소용)
    private var delayedTokenUpdateWorkItem: DispatchWorkItem?

    /// 백그라운드 토큰 업데이트 전략
    enum BackgroundTokenUpdateStrategy {
        case immediate      // 즉시 업데이트
        case delayed(TimeInterval)  // 지연적 업데이트 (지연 시간)
        case cancel         // 업데이트 취소
    }

    // MARK: - 🛡️ 백그라운드 FCM 토큰 안정화 시스템

    // 백그라운드에서 FCM 토큰 변경 최소화 메소드
    private func stabilizeBackgroundFCMToken(_ newToken: String) -> Bool {
        print("🛡️ [FCM Stabilize] 백그라운드 FCM 토큰 안정화 시작")

        // 현재 저장된 토큰 확인
        guard let currentToken = UserDefaults.standard.string(forKey: "fcm_token") else {
            print("ℹ️ [FCM Stabilize] 현재 토큰 없음 - 변경 허용")
            return true // 토큰이 없으면 변경 허용
        }

        // 토큰이 동일하면 변경 불필요
        if currentToken == newToken {
            print("✅ [FCM Stabilize] 토큰 동일 - 변경 불필요")
            return false // 변경하지 않음
        }

        // 백그라운드 토큰 안정성 점수 계산
        let stabilityScore = calculateFCMTokenStability()

        // 안정성 점수가 높으면 변경 제한 (백그라운드에서)
        if stabilityScore >= 80 {
            // 디버깅용 값들 미리 계산
            let lastUpdateHours = Int((Date().timeIntervalSince1970 - UserDefaults.standard.double(forKey: "last_token_update_time")) / 3600)
            let lastRollbackHours = Int((Date().timeIntervalSince1970 - UserDefaults.standard.double(forKey: "last_rollback_time")) / 3600)
            let appLaunchHours = Int((Date().timeIntervalSince1970 - UserDefaults.standard.double(forKey: "app_launch_time")) / 3600)
            let hasApnsToken = currentAPNSToken != nil ? "있음" : "없음"

            print("🛡️ [FCM Stabilize] 토큰 안정성 높음 (\(stabilityScore)점) - 백그라운드 변경 제한")
            print("   📱 새로운 토큰: \(newToken.prefix(20))...")
            print("   💾 현재 토큰: \(currentToken.prefix(20))...")
            print("   📊 안정화 요소:")
            print("      • 최근 변경: \(lastUpdateHours)시간 전")
            print("      • 최근 롤백: \(lastRollbackHours)시간 전")
            print("      • APNs 토큰: \(hasApnsToken)")
            print("      • 앱 실행: \(appLaunchHours)시간 전")
            return false // 변경하지 않음
        }

        print("⚠️ [FCM Stabilize] 토큰 안정성 낮음 (\(stabilityScore)점) - 변경 허용")
        return true // 변경 허용
    }

    // FCM 토큰 안정성 점수 계산 (0-100)
    private func calculateFCMTokenStability() -> Int {
        var score = 100

        // 1. 최근 토큰 변경 빈도 확인 (-20점)
        let lastUpdate = UserDefaults.standard.double(forKey: "last_token_update_time")
        let currentTime = Date().timeIntervalSince1970
        let hoursSinceLastUpdate = (currentTime - lastUpdate) / 3600

        if hoursSinceLastUpdate < 1 {
            score -= 20 // 1시간 이내 변경
        } else if hoursSinceLastUpdate < 24 {
            score -= 10 // 24시간 이내 변경
        }

        // 2. 최근 롤백 기록 확인 (-30점)
        let lastRollback = UserDefaults.standard.double(forKey: "last_rollback_time")
        let hoursSinceLastRollback = (currentTime - lastRollback) / 3600

        if hoursSinceLastRollback < 24 {
            score -= 30 // 24시간 이내 롤백
        } else if hoursSinceLastRollback < 168 { // 7일
            score -= 15 // 7일 이내 롤백
        }

        // 3. APNs 토큰 안정성 확인 (-15점)
        if currentAPNSToken == nil {
            score -= 15 // APNs 토큰 없음
        }

        // 4. 앱 실행 시간 기반 안정성 (-10점)
        let appLaunchTime = UserDefaults.standard.double(forKey: "app_launch_time")
        let hoursSinceLaunch = (currentTime - appLaunchTime) / 3600

        if hoursSinceLaunch < 1 {
            score -= 10 // 앱 실행 1시간 이내
        }

        // 최소 점수 보장
        return max(score, 0)
    }

    // 백그라운드 FCM 토큰 변경 사전 검증
    private func preValidateBackgroundFCMTokenChange(_ newToken: String, completion: @escaping (Bool, String) -> Void) {
        print("🔍 [FCM Pre-Validate] 백그라운드 FCM 토큰 변경 사전 검증")

        // 1. 안정성 기반 변경 필요성 확인 (백그라운드에서는 완화)
        let shouldChange = stabilizeBackgroundFCMToken(newToken)
        if !shouldChange {
            print("🛡️ [FCM Pre-Validate] 안정성 점수가 높아 변경 제한되었으나, FCM 서비스 재등록 강제")
            // 안정성 점수가 높아도 백그라운드에서는 FCM 서비스 재등록 강제
            completion(true, "안정성 점수 높음 - FCM 서비스 재등록 강제")
            return
        }

        // 2. APNs 토큰 존재 및 유효성 확인 (백그라운드에서는 선택적)
        if currentAPNSToken == nil {
            print("⚠️ [FCM Pre-Validate] 백그라운드에서 APNs 토큰 없음 - 검증 계속 진행 (푸시 수신 우선)")
            // 백그라운드에서는 APNs 토큰이 없어도 FCM 검증 진행
        }

        // 3. 최소 변경 간격 확인 (백그라운드에서 2분으로 완화)
        let lastUpdate = UserDefaults.standard.double(forKey: "last_token_update_time")
        let currentTime = Date().timeIntervalSince1970
        let minutesSinceLastUpdate = (currentTime - lastUpdate) / 60

        if minutesSinceLastUpdate < 2 {
            print("⏳ [FCM Pre-Validate] 최소 변경 간격 미충족 (\(Int(minutesSinceLastUpdate))분) - FCM 서비스 재등록 강제")
            // 최소 간격 미충족해도 백그라운드에서는 FCM 서비스 재등록 강제
            completion(true, "최소 간격 미충족 - FCM 서비스 재등록 강제")
            return
        }

        // 4. 토큰 형식 검증
        guard newToken.count >= 100 && newToken.contains(":") else {
            completion(false, "토큰 형식 오류")
            return
        }

        print("✅ [FCM Pre-Validate] 백그라운드 토큰 변경 사전 검증 통과")
        completion(true, "변경 허용")
    }

    // MARK: - 🔄 백그라운드 FCM 재등록 (최후의 수단)
    private func performBackgroundFCMRegistration(_ token: String) {
        print("🔄 [FCM Background Registration] 백그라운드 FCM 재등록 시작")

        // 백그라운드에서 FCM 서비스 완전 리셋
        DispatchQueue.global(qos: .background).async {
            // FCM 서비스 초기화 상태 리셋
            Messaging.messaging().isAutoInitEnabled = false

            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                Messaging.messaging().isAutoInitEnabled = true

                // APNs 토큰 재설정 (가능한 경우)
                if let apnsToken = self.currentAPNSToken {
                    Messaging.messaging().setAPNSToken(apnsToken.data(using: .utf8) ?? Data(), type: .unknown)
                    print("✅ [FCM Background] APNs 토큰 백그라운드 재설정 완료")
                }

                // 백그라운드에서 FCM 토큰 재요청
                DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                    Messaging.messaging().token { [weak self] backgroundToken, error in
                        if let backgroundToken = backgroundToken {
                            print("✅ [FCM Background] 백그라운드 토큰 재등록 성공: \(backgroundToken.prefix(30))...")
                            if backgroundToken == token {
                                print("🎯 [FCM Background] 백그라운드 FCM 재등록 완료")
                                self?.verifyFCMRegistrationStatus(backgroundToken)
                            } else {
                                print("⚠️ [FCM Background] 백그라운드 토큰 불일치 - 새로운 토큰으로 업데이트")
                                self?.handleFCMTokenUpdate(backgroundToken)
                            }
                        } else {
                            print("❌ [FCM Background] 백그라운드 FCM 재등록 최종 실패")
                            print("📱 [FCM Background] 수동 재시작 필요할 수 있음")
                        }
                    }
                }
            }
        }

        print("✅ [FCM Background Registration] 백그라운드 FCM 재등록 요청 완료")
    }

    // MARK: - 🔍 FCM 서비스 상태 실시간 확인 (디버깅용)
    private func checkFCMServiceRegistrationStatus() {
        let appState = UIApplication.shared.applicationState
        let isBackground = appState == .background
        print("🔍 [FCM Debug] FCM 서비스 등록 상태 확인 시작 (\(isBackground ? "백그라운드" : "포그라운드"))")

        // 백그라운드에서는 더 상세한 로그 출력
        if isBackground {
            print("🕒 [FCM Debug] 백그라운드에서 FCM 상태 확인")
            print("📊 [FCM Debug] 앱 상태: \(appState.rawValue)")
        }

        // 1. 현재 FCM 토큰 확인
        Messaging.messaging().token { [weak self] currentToken, error in
            if let error = error {
                print("❌ [FCM Debug] FCM 토큰 조회 실패: \(error.localizedDescription)")
                if isBackground {
                    print("🛡️ [FCM Debug] 백그라운드에서 토큰 조회 실패 - FCM 서비스 재등록 시도")
                    // 백그라운드에서 토큰 조회 실패 시 서비스 재등록
                    DispatchQueue.main.async {
                        if let token = UserDefaults.standard.string(forKey: "fcm_token") {
                            self?.forceRefreshFCMServiceRegistration(token)
                        }
                    }
                }
                return
            }

            guard let currentToken = currentToken else {
                print("❌ [FCM Debug] FCM 토큰 없음")
                if isBackground {
                    print("🛡️ [FCM Debug] 백그라운드에서 토큰 없음 - 긴급 복구 시도")
                    // 백그라운드에서 토큰이 없으면 복구 시도
                    DispatchQueue.main.async {
                        self?.emergencyFCMTokenRecovery()
                    }
                }
                return
            }

            print("✅ [FCM Debug] 현재 FCM 토큰: \(currentToken.prefix(30))...")
            print("📊 [FCM Debug] 토큰 길이: \(currentToken.count)자")

            // 2. 로컬 저장 토큰과 비교
            let savedToken = UserDefaults.standard.string(forKey: "fcm_token") ?? ""
            if savedToken == currentToken {
                print("✅ [FCM Debug] 로컬 토큰 일치")
            } else {
                print("⚠️ [FCM Debug] 로컬 토큰 불일치")
                print("   📱 현재 토큰: \(currentToken.prefix(20))...")
                print("   💾 저장 토큰: \(savedToken.prefix(20))...")
                if isBackground {
                    print("🛡️ [FCM Debug] 백그라운드에서 토큰 불일치 - 긴급 업데이트")
                    // 백그라운드에서 토큰 불일치 시 즉시 업데이트
                    UserDefaults.standard.set(currentToken, forKey: "fcm_token")
                    UserDefaults.standard.synchronize()
                }
            }

            // 3. 서버 저장 토큰과 비교
            let serverToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") ?? ""
            if serverToken == currentToken {
                print("✅ [FCM Debug] 서버 토큰 일치")
            } else {
                print("⚠️ [FCM Debug] 서버 토큰 불일치")
                print("   📱 현재 토큰: \(currentToken.prefix(20))...")
                print("   🖥️ 서버 토큰: \(serverToken.prefix(20))...")
                if isBackground {
                    print("🛡️ [FCM Debug] 백그라운드에서 서버 토큰 불일치 - 백그라운드 동기화")
                    // 백그라운드에서 서버 토큰 불일치 시 백그라운드 동기화
                    self?.sendFCMTokenToServerBackground(token: currentToken, retryCount: 0) { success in
                        if success {
                            print("✅ [FCM Debug] 백그라운드 서버 동기화 성공")
                        } else {
                            print("❌ [FCM Debug] 백그라운드 서버 동기화 실패")
                        }
                    }
                }
            }

            // 4. FCM 서비스 상태 확인
            let isAutoInitEnabled = Messaging.messaging().isAutoInitEnabled
            print("🔧 [FCM Debug] Auto Init: \(isAutoInitEnabled ? "활성화" : "비활성화")")

            // 백그라운드에서는 Auto Init이 비활성화되어 있으면 재활성화
            if isBackground && !isAutoInitEnabled {
                print("🛡️ [FCM Debug] 백그라운드에서 Auto Init 비활성화 - 재활성화")
                DispatchQueue.main.async {
                    Messaging.messaging().isAutoInitEnabled = true
                }
            }

            // 5. APNs 토큰 상태 확인
            let hasApnsToken = self?.currentAPNSToken != nil
            print("📱 [FCM Debug] APNs 토큰: \(hasApnsToken ? "있음" : "없음")")

            // 6. FCM 토큰 유효성 검증
            self?.validateFCMTokenForPushReception(currentToken) { isValid, message in
                print("🎯 [FCM Debug] 푸시 수신 가능성: \(isValid ? "가능" : "불가능") - \(message)")
                if isBackground && !isValid {
                    print("🛡️ [FCM Debug] 백그라운드에서 푸시 수신 불가능 - 긴급 복구")
                    // 백그라운드에서 푸시 수신 불가능하면 긴급 복구
                    self?.emergencyFCMServiceRecovery(currentToken)
                }
            }
        }
    }

    // FCM 토큰 푸시 수신 가능성 검증
    private func validateFCMTokenForPushReception(_ token: String, completion: @escaping (Bool, String) -> Void) {
        // 토큰 형식 검증
        guard token.count >= 100 else {
            completion(false, "토큰 길이 비정상")
            return
        }

        guard token.contains(":") else {
            completion(false, "토큰 형식 오류")
            return
        }

        // FCM 서비스 연결 상태 확인
        Messaging.messaging().token { refreshedToken, error in
            if let error = error {
                completion(false, "FCM 서비스 연결 실패: \(error.localizedDescription)")
                return
            }

            guard let refreshedToken = refreshedToken else {
                completion(false, "FCM 토큰 갱신 실패")
                return
            }

            // 토큰 일관성 확인
            if refreshedToken == token {
                completion(true, "FCM 토큰 유효하고 일관성 있음")
            } else {
                completion(false, "FCM 토큰 불일치 - 서비스 재등록 필요")
            }
        }
    }

    // FCM 푸시 메시지 수신 테스트 (개발용)
    private func testFCMPushReception() {
        print("🔔 [FCM Test] FCM 푸시 메시지 수신 테스트 시작")

        checkFCMServiceRegistrationStatus()

        // 5초 후 재확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            print("🔄 [FCM Test] 5초 후 FCM 상태 재확인")
            self.checkFCMServiceRegistrationStatus()
        }
    }

    // FCM 푸시 메시지 표시 상태 확인 메소드
    private func checkFCMPushDisplayStatus() {
        print("🔔 [FCM Push Status] FCM 푸시 메시지 표시 상태 확인 시작")

        // 현재 푸시 알림 권한 상태 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔧 [FCM Push Status] 푸시 알림 권한 상태: \(settings.authorizationStatus.rawValue)")
                print("🔧 [FCM Push Status] 권한 상세:")
                print("   • 알림 허용: \(settings.authorizationStatus == .authorized)")
                print("   • 알림 표시: \(settings.alertSetting == .enabled)")
                print("   • 배지 표시: \(settings.badgeSetting == .enabled)")
                print("   • 소리 재생: \(settings.soundSetting == .enabled)")

                // FCM 서비스 상태 확인
                let isAutoInitEnabled = Messaging.messaging().isAutoInitEnabled
                print("🔧 [FCM Push Status] FCM Auto Init: \(isAutoInitEnabled ? "활성화" : "비활성화")")

                // APNs 토큰 상태 확인
                let hasApnsToken = self.currentAPNSToken != nil
                print("🔧 [FCM Push Status] APNs 토큰: \(hasApnsToken ? "있음" : "없음")")

                // FCM 토큰 상태 확인
                Messaging.messaging().token { token, error in
                    if let token = token {
                        print("🔧 [FCM Push Status] FCM 토큰 상태: 유효")
                        print("🔧 [FCM Push Status] 토큰 길이: \(token.count)자")

                        // FCM 토큰 검증
                        self.validateFCMTokenForPushReception(token) { isValid, message in
                            print("🎯 [FCM Push Status] 푸시 수신 가능성: \(isValid ? "가능" : "불가능")")
                            print("📝 [FCM Push Status] 검증 결과: \(message)")

                            if !isValid {
                                print("⚠️ [FCM Push Status] FCM 토큰 검증 실패 - 수동 재등록 필요")
                                self.forceRefreshFCMServiceRegistration(token)

                                // 검증 실패 시 추가 디버깅 정보 출력
                                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                                    print("🔍 [FCM Debug] FCM 토큰 검증 실패로 추가 디버깅")
                                    self.printFCMDebugInfo()
                                }
                            } else {
                                print("✅ [FCM Push Status] FCM 토큰 검증 성공 - 푸시 수신 준비 완료")

                                // 푸시 수신 가능할 때 추가 검증
                                self.performDetailedFCMPushTest(token)
                            }
                        }
                    } else {
                        print("❌ [FCM Push Status] FCM 토큰 없음")
                        if let error = error {
                            print("❌ [FCM Push Status] 토큰 조회 오류: \(error.localizedDescription)")
                        }
                    }
                }
            }
        }
    }

    // FCM 푸시 수신 상세 테스트 메소드
    private func performDetailedFCMPushTest(_ fcmToken: String) {
        print("🔬 [FCM Push Test] FCM 푸시 수신 상세 테스트 시작")

        // 1. FCM 토큰 포맷 검증
        let isValidFormat = fcmToken.count > 100 && fcmToken.contains(":")
        print("📋 [FCM Push Test] 토큰 포맷 검증: \(isValidFormat ? "유효" : "잘못됨")")

        // 2. FCM 토큰 접두사 확인
        let tokenPrefix = String(fcmToken.prefix(20))
        print("📋 [FCM Push Test] 토큰 접두사: \(tokenPrefix)...")

        // 3. DB 토큰과의 일치성 확인
        if let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") {
            let isTokenMatch = fcmToken == dbToken
            print("📋 [FCM Push Test] DB 토큰 일치: \(isTokenMatch ? "일치" : "불일치")")

            if !isTokenMatch {
                print("⚠️ [FCM Push Test] 토큰 불일치 발견!")
                print("   📱 현재 토큰: \(fcmToken.prefix(30))...")
                print("   💾 DB 토큰: \(dbToken.prefix(30))...")
            }
        } else {
            print("⚠️ [FCM Push Test] DB 토큰 없음")
        }

        // 4. APNs 토큰 상태 재확인
        if let apnsToken = self.currentAPNSToken {
            print("📋 [FCM Push Test] APNs 토큰 존재: \(apnsToken.count)자")
        } else {
            print("⚠️ [FCM Push Test] APNs 토큰 없음")
        }

        // 5. FCM 서비스 상태 재확인
        let isAutoInitEnabled = Messaging.messaging().isAutoInitEnabled
        print("📋 [FCM Push Test] FCM Auto Init: \(isAutoInitEnabled ? "활성화" : "비활성화")")

        // 6. 푸시 알림 권한 재확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("📋 [FCM Push Test] 푸시 권한 상태:")
                print("   • 권한 상태: \(settings.authorizationStatus.rawValue)")
                print("   • 알림 표시: \(settings.alertSetting.rawValue)")
                print("   • 소리 재생: \(settings.soundSetting.rawValue)")
                print("   • 배지 표시: \(settings.badgeSetting.rawValue)")

                // 7. 권한 문제 분석
                if settings.authorizationStatus != .authorized {
                    print("🚨 [FCM Push Test] 푸시 알림 권한이 거부됨")
                    print("💡 [FCM Push Test] 해결: 설정 > 알림 > SMAP > 알림 허용")
                } else if settings.alertSetting != .enabled {
                    print("🚨 [FCM Push Test] 알림 표시가 비활성화됨")
                    print("💡 [FCM Push Test] 해결: 설정 > 알림 > SMAP > 알림 표시 허용")
                } else if !isAutoInitEnabled {
                    print("🚨 [FCM Push Test] FCM Auto Init 비활성화")
                    print("💡 [FCM Push Test] 해결: FCM 서비스 재초기화 필요")
                } else {
                            print("✅ [FCM Push Test] 모든 설정이 정상 - 푸시 수신 준비 완료")
        print("💡 [FCM Push Test] 서버에서 FCM 메시지를 전송해보세요")
        print("💡 [FCM Push Test] 테스트 토큰: \(fcmToken)")

        // 서버 테스트를 위한 curl 명령어 출력
        print("🔧 [FCM Push Test] 서버 테스트용 명령어:")
        print("curl -X POST https://api3.smap.site/api/v1/fcm/send \\")
        print("  -H 'Content-Type: application/json' \\")
        print("  -d '{\"fcm_token\":\"\(fcmToken)\",\"title\":\"테스트 알림\",\"body\":\"FCM 푸시 테스트 메시지\"}'")
                }
            }
        }

        // 8. FCM 서비스 재연결 테스트
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            print("🔄 [FCM Push Test] FCM 서비스 재연결 테스트")
            Messaging.messaging().token { refreshedToken, error in
                if let refreshedToken = refreshedToken {
                    if refreshedToken == fcmToken {
                        print("✅ [FCM Push Test] 토큰 일관성 유지")
                    } else {
                        print("⚠️ [FCM Push Test] 토큰 변경됨")
                        print("   📱 새 토큰: \(refreshedToken.prefix(30))...")
                    }
                } else {
                    print("❌ [FCM Push Test] 토큰 재조회 실패")
                    if let error = error {
                        print("❌ [FCM Push Test] 오류: \(error.localizedDescription)")
                    }
                }
            }
        }
    }

    // FCM 메시지 수신 콜백 디버깅 강화
    private func debugFCMMessageReception(_ message: Any) {
        print("🔍 [FCM Message Debug] FCM 메시지 수신 디버깅 시작")

        if let messageData = message as? [String: Any] {
            print("📨 [FCM Message Debug] 메시지 데이터:")
            for (key, value) in messageData {
                print("   • \(key): \(value)")
            }
        }

        // FCM 서비스 상태 확인
        Messaging.messaging().token { token, error in
            if let token = token {
                print("🔥 [FCM Message Debug] 메시지 수신 시 FCM 토큰: \(token.prefix(20))...")

                // DB 토큰과 비교
                if let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") {
                    if token == dbToken {
                        print("✅ [FCM Message Debug] 토큰 일치: FCM ↔ DB")
                    } else {
                        print("⚠️ [FCM Message Debug] 토큰 불일치!")
                        print("   📱 현재 토큰: \(token.prefix(20))...")
                        print("   💾 DB 토큰: \(dbToken.prefix(20))...")

                        // 토큰 불일치 시 서비스 상태 확인
                        self.checkFCMServiceRegistrationStatus()
                    }
                } else {
                    print("⚠️ [FCM Message Debug] DB 토큰 없음")
                }
            } else {
                print("❌ [FCM Message Debug] FCM 토큰 조회 실패")
                if let error = error {
                    print("❌ [FCM Message Debug] 오류: \(error.localizedDescription)")
                }
            }
        }

        // 푸시 알림 권한 상태 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔔 [FCM Message Debug] 푸시 알림 권한 상태:")
                print("   • 권한 상태: \(settings.authorizationStatus.rawValue)")
                print("   • 알림 표시: \(settings.alertSetting.rawValue)")
                print("   • 소리 재생: \(settings.soundSetting.rawValue)")
                print("   • 배지 표시: \(settings.badgeSetting.rawValue)")

                if settings.authorizationStatus != .authorized {
                    print("⚠️ [FCM Message Debug] 푸시 알림 권한이 거부됨")
                }
                if settings.alertSetting != .enabled {
                    print("⚠️ [FCM Message Debug] 알림 표시가 비활성화됨")
                }

                // FCM 메시지 수신 시 강제 알림 표시 테스트
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    print("🔔 [FCM Message Debug] FCM 메시지 수신 시 강제 알림 표시 테스트")
                    self.forceDisplayFCMNotificationTest(message)
                }

                // 일반 알림 표시 테스트
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    print("🔔 [FCM Message Debug] 일반 알림 표시 테스트 시작")
                    self.testNotificationDisplay()
                }
            }
        }
    }

    // FCM 메시지 수신 시 강제 알림 표시 테스트
    private func forceDisplayFCMNotificationTest(_ message: Any) {
        print("🔔 [FCM Force Test] FCM 메시지 기반 강제 알림 표시 테스트")

        guard let userInfo = message as? [AnyHashable: Any] else {
            print("❌ [FCM Force Test] 메시지 변환 실패")
            return
        }

        // 중복 알림 표시 방지 로직
        if let messageId = userInfo["gcm.message_id"] as? String,
           let lastMessageId = lastProcessedFCMMessageId,
           let lastTime = lastFCMNotificationTime,
           messageId == lastMessageId,
           Date().timeIntervalSince(lastTime) < fcmDuplicatePreventionInterval {
            print("🚫 [FCM Force Test] 중복 FCM 메시지 감지 - 알림 표시 스킵")
            print("   • 메시지 ID: \(messageId)")
            print("   • 경과 시간: \(Date().timeIntervalSince(lastTime))초")
            return
        }

        // 메시지에서 제목과 본문 추출
        let title = userInfo["title"] as? String ?? "🔔 FCM 수신 알림"
        let body = userInfo["body"] as? String ?? "FCM 메시지가 수신되었습니다"

        print("📝 [FCM Force Test] 알림 내용:")
        print("   • 제목: \(title)")
        print("   • 본문: \(body)")

        // 중복 방지 정보 및 성공 플래그 업데이트
        if let messageId = userInfo["gcm.message_id"] as? String {
            lastProcessedFCMMessageId = messageId
            lastFCMNotificationTime = Date()

            // 현재 메시지와 일치하는 경우 성공 플래그 설정
            if messageId == currentFCMMessageId {
                notificationDisplayedSuccessfully = true
                print("✅ [FCM Force Test] 알림 표시 성공 - 후속 작업 스킵 플래그 설정")
            }

            print("✅ [FCM Force Test] 중복 방지 정보 업데이트: \(messageId)")
        }

        // 강제 로컬 알림 표시
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)
        content.userInfo = userInfo

        // 고유 식별자로 중복 방지
        let identifier = "fcm_force_test_\(Date().timeIntervalSince1970)"
        let request = UNNotificationRequest(identifier: identifier,
                                          content: content,
                                          trigger: nil)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ [FCM Force Test] 강제 알림 표시 실패: \(error.localizedDescription)")
                print("💡 [FCM Force Test] FCM 권한 또는 설정에 문제가 있을 수 있습니다")
            } else {
                print("✅ [FCM Force Test] 강제 알림 표시 성공")
                print("💡 [FCM Force Test] 잠시 후 Notification Center에 알림이 표시되는지 확인하세요")
                print("💡 [FCM Force Test] 알림이 표시되면 FCM 권한은 정상입니다")
                print("💡 [FCM Force Test] 알림이 표시되지 않으면 iOS 설정을 확인하세요")
            }
        }
    }

    // 알림 표시 테스트 메소드
    private func testNotificationDisplay() {
        print("🔔 [Notification Test] 로컬 알림 표시 테스트 시작")

        let content = UNMutableNotificationContent()
        content.title = "🧪 FCM 테스트 알림"
        content.body = "이 알림이 표시되면 FCM 푸시 설정이 정상입니다"
        content.sound = .default
        content.badge = NSNumber(value: 1)

        let request = UNNotificationRequest(identifier: "fcm_test_notification_\(Date().timeIntervalSince1970)",
                                          content: content,
                                          trigger: nil)

        // 중복 알림 방지 - 테스트 로컬 알림 생성 비활성화
        print("🚫 [Notification Test] 중복 방지를 위해 테스트 로컬 알림 생성 건너뛰기")
        print("📝 [Notification Test] 원본 FCM 알림만 사용하여 권한 테스트")
    }

    // FCM 푸시 알림 강제 표시 메소드
    private func forceDisplayFCMNotification(_ userInfo: [AnyHashable: Any]) {
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║ 🔔 [FCM-FORCE-DISPLAY] 알림 표시 시작                          ║")
        print("╚══════════════════════════════════════════════════════════════╝")

        // 중복 알림 표시 방지 로직
        print("🔍 [FCM-FORCE-DISPLAY] 단계 1: 중복 알림 방지 확인")
        if let messageId = userInfo["gcm.message_id"] as? String,
           let lastMessageId = lastProcessedFCMMessageId,
           let lastTime = lastFCMNotificationTime,
           messageId == lastMessageId,
           Date().timeIntervalSince(lastTime) < fcmDuplicatePreventionInterval {
            print("🚫 [FCM-FORCE-DISPLAY] 중복 FCM 메시지 감지 - 알림 표시 스킵")
            print("   📝 메시지 ID: \(messageId)")
            print("   ⏱️  경과 시간: \(Date().timeIntervalSince(lastTime))초")
            print("   🎯 중복 방지 시간: \(fcmDuplicatePreventionInterval)초")
            return
        }
        print("✅ [FCM-FORCE-DISPLAY] 중복 메시지 없음 - 알림 표시 진행")

        // 메시지에서 제목과 본문 추출
        print("📝 [FCM-FORCE-DISPLAY] 단계 2: 메시지 내용 추출")
        let title = userInfo["title"] as? String ?? "SMAP 알림"
        let body = userInfo["body"] as? String ?? "새로운 메시지가 도착했습니다"

        print("   📋 제목: \(title)")
        print("   📋 본문: \(body)")

        // 중복 방지 정보 및 성공 플래그 업데이트
        print("🔄 [FCM-FORCE-DISPLAY] 단계 3: 중복 방지 정보 업데이트")
        if let messageId = userInfo["gcm.message_id"] as? String {
            lastProcessedFCMMessageId = messageId
            lastFCMNotificationTime = Date()

            // 현재 메시지와 일치하는 경우 성공 플래그 설정
            if messageId == currentFCMMessageId {
                notificationDisplayedSuccessfully = true
                print("✅ [FCM-FORCE-DISPLAY] 알림 표시 성공 - 후속 작업 스킵 플래그 설정")
                print("   📝 현재 메시지 ID: \(currentFCMMessageId!)")
                print("   🎯 플래그 상태: notificationDisplayedSuccessfully = true")
            }

            print("✅ [FCM-FORCE-DISPLAY] 중복 방지 정보 업데이트 완료")
            print("   📝 메시지 ID: \(messageId)")
            print("   ⏱️  타임스탬프: \(Date())")
        }

        // 로컬 알림으로 강제 표시
        print("📱 [FCM-FORCE-DISPLAY] 단계 4: 로컬 알림 생성 및 표시")
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)
        content.userInfo = userInfo

        print("   📋 알림 콘텐츠 설정 완료")
        print("   🔊 사운드: default")
        print("   🔴 배지: \(UIApplication.shared.applicationIconBadgeNumber + 1)")

        let request = UNNotificationRequest(identifier: "fcm_force_display_\(Date().timeIntervalSince1970)",
                                          content: content,
                                          trigger: nil)

        print("📤 [FCM-FORCE-DISPLAY] 단계 5: Notification Center에 알림 요청")
        print("   🆔 식별자: \(request.identifier)")

        UNUserNotificationCenter.current().add(request) { error in
            print("📊 [FCM-FORCE-DISPLAY] 단계 6: 알림 표시 결과")
            if let error = error {
                print("❌ [FCM-FORCE-DISPLAY] 강제 표시 실패")
                print("   🚨 에러: \(error.localizedDescription)")
            } else {
                print("✅ [FCM-FORCE-DISPLAY] 강제 표시 성공")
                print("   🎯 결과: Notification Center에 알림 표시 요청 완료")
                print("   💡 확인: 잠시 후 Notification Center에 알림이 표시되는지 확인하세요")
            }
        }
    }

    // Notification Center 상태 확인 메소드
    private func checkNotificationCenterStatus() {
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║ 📱 [NOTIFICATION-CENTER] 상태 확인 시작                         ║")
        print("╚══════════════════════════════════════════════════════════════╝")
        print("🔍 [NOTIFICATION-CENTER] 단계 1: Notification Center 알림 조회")
        print("   📊 대상: UNUserNotificationCenter.current()")
        print("   🎯 목적: FCM 관련 알림 존재 여부 확인")

        UNUserNotificationCenter.current().getDeliveredNotifications { deliveredNotifications in
            DispatchQueue.main.async {
                print("📊 [NOTIFICATION-CENTER] 단계 2: 알림 개수 분석")
                print("   📱 전달된 알림 총 개수: \(deliveredNotifications.count)")

                // [NOTIFICATION-CENTER] 단계 3: FCM 알림 필터링
                print("🔍 [NOTIFICATION-CENTER] 단계 3: FCM 알림 필터링")
                let fcmNotifications = deliveredNotifications.filter { notification in
                    let title = notification.request.content.title
                    let body = notification.request.content.body
                    let identifier = notification.request.identifier

                    let isFCM = title.contains("FCM") ||
                               title.contains("🔔") ||
                               body.contains("FCM") ||
                               body.contains("테스트") ||
                               identifier.contains("FCM") ||
                               identifier.contains("fcm")

                    if isFCM {
                        print("   ✅ FCM 알림 발견: '\(title)'")
                    }

                    return isFCM
                }

                // [NOTIFICATION-CENTER] 단계 4: SMAP 알림 필터링
                print("🔍 [NOTIFICATION-CENTER] 단계 4: SMAP 알림 필터링")
                let smapNotifications = deliveredNotifications.filter { notification in
                    let title = notification.request.content.title
                    let body = notification.request.content.body
                    let identifier = notification.request.identifier

                    let isSMAP = title.contains("SMAP") ||
                                title.contains("smap") ||
                                body.contains("SMAP") ||
                                body.contains("smap") ||
                                identifier.contains("SMAP") ||
                                identifier.contains("smap")

                    if isSMAP {
                        print("   ✅ SMAP 알림 발견: '\(title)'")
                    }

                    return isSMAP
                }

                print("📊 [NOTIFICATION-CENTER] 단계 5: 필터링 결과")
                print("   🔍 FCM 관련 알림 개수: \(fcmNotifications.count)")
                print("   🔍 SMAP 관련 알림 개수: \(smapNotifications.count)")

                // [NOTIFICATION-CENTER] 단계 6: 성공 플래그 설정
                print("🎯 [NOTIFICATION-CENTER] 단계 6: 성공 플래그 평가")
                if !fcmNotifications.isEmpty,
                   let currentId = self.currentFCMMessageId {
                    self.notificationDisplayedSuccessfully = true
                    print("✅ [NOTIFICATION-CENTER] FCM 알림 발견 - 성공 플래그 설정")
                    print("   📝 현재 메시지 ID: \(currentId)")
                    print("   🎉 결과: 알림 표시 성공으로 판정")
                } else {
                    print("❌ [NOTIFICATION-CENTER] FCM 알림 없음 - 성공 플래그 유지 안 함")
                    print("   📝 현재 메시지 ID: \(self.currentFCMMessageId ?? "없음")")
                    print("   🎯 결과: 알림 표시 실패로 판정")
                }

                // [NOTIFICATION-CENTER] 단계 7: FCM 알림 분석 및 결과 출력
                print("📋 [NOTIFICATION-CENTER] 단계 7: FCM 알림 분석 및 결과 출력")

                if fcmNotifications.isEmpty {
                    print("🚨 [NOTIFICATION-CENTER] FCM 알림 분석 결과: 없음")
                    print("💡 [NOTIFICATION-CENTER] FCM 메시지 수신 후 알림 표시 실패")
                    print("🔧 [NOTIFICATION-CENTER] 문제 해결을 위한 확인 사항:")
                    print("   • iOS 설정 > 알림 > SMAP > 모든 스위치 ON")
                    print("   • 앱 알림 권한 상태 확인")
                    print("   • FCM 토큰 유효성 확인")
                    print("   • 앱 백그라운드 실행 상태 확인")
                } else {
                    print("✅ [NOTIFICATION-CENTER] FCM 알림 분석 결과: 발견됨")
                    print("📝 [NOTIFICATION-CENTER] 발견된 FCM 알림 상세 정보:")
                    for (index, notification) in fcmNotifications.enumerated() {
                        print("   \(index + 1). 제목: '\(notification.request.content.title)'")
                        print("      내용: '\(notification.request.content.body.prefix(50))...'")
                        print("      시간: \(notification.date)")
                        print("      ID: \(notification.request.identifier)")
                    }
                    print("✅ [FCM SUCCESS] FCM 메시지가 Notification Center에 정상 표시되었습니다!")
                    print("🎉 [FCM SUCCESS] FCM 푸시 알림 표시 성공!")
                    print("📝 [FCM] FCM 알림 상세 정보:")
                    for (index, notification) in fcmNotifications.prefix(3).enumerated() {
                        print("   \(index + 1). 제목: \(notification.request.content.title)")
                        print("      내용: \(notification.request.content.body.prefix(50))...")
                        print("      시간: \(notification.date)")
                        print("      ID: \(notification.request.identifier)")
                    }
                }

                // SMAP 알림 분석
                if smapNotifications.isEmpty {
                    print("⚠️ [SMAP] SMAP 앱의 알림이 전달되지 않았습니다")
                    if !fcmNotifications.isEmpty {
                        print("💡 [SMAP] FCM 알림은 있지만 SMAP 알림이 없는 것은 정상일 수 있습니다")
                    }
                } else {
                    print("✅ [SMAP] SMAP 앱의 알림이 정상적으로 전달되었습니다")
                    print("📝 [SMAP] SMAP 알림 상세 정보:")
                    for (index, notification) in smapNotifications.prefix(3).enumerated() {
                        print("   \(index + 1). 제목: \(notification.request.content.title)")
                        print("      내용: \(notification.request.content.body.prefix(50))...")
                        print("      시간: \(notification.date)")
                        print("      ID: \(notification.request.identifier)")
                    }
                }

                // 전체 알림 목록 (최대 5개)
                if !deliveredNotifications.isEmpty {
                    print("📋 [전체] 최근 알림 목록 (최대 5개):")
                    for (index, notification) in deliveredNotifications.prefix(5).enumerated() {
                        let title = notification.request.content.title
                        let body = notification.request.content.body
                        let identifier = notification.request.identifier

                        print("   \(index + 1). 제목: \(title)")
                        print("      내용: \(body.prefix(30))...")
                        print("      앱: \(identifier)")
                        print("      시간: \(notification.date)")
                    }
                }

                // 현재 앱의 알림 권한 상태 재확인
                UNUserNotificationCenter.current().getNotificationSettings { settings in
                    DispatchQueue.main.async {
                        print("🔧 [Notification Center] 현재 알림 권한 상태:")
                        print("   • 권한 상태: \(settings.authorizationStatus.rawValue) (\(settings.authorizationStatus == .authorized ? "허용" : "거부"))")
                        print("   • 알림 표시: \(settings.alertSetting.rawValue) (\(settings.alertSetting == .enabled ? "활성" : "비활성"))")
                        print("   • 소리: \(settings.soundSetting.rawValue) (\(settings.soundSetting == .enabled ? "활성" : "비활성"))")
                        print("   • 배지: \(settings.badgeSetting.rawValue) (\(settings.badgeSetting == .enabled ? "활성" : "비활성"))")

                        // 권한 상태 분석
                        if settings.authorizationStatus != .authorized {
                            print("🚨 [권한] 알림 권한이 거부됨 - iOS 설정 > 알림 > SMAP 에서 허용해주세요")
                        } else if settings.alertSetting != .enabled {
                            print("🚨 [권한] 알림 표시가 비활성화됨 - iOS 설정 > 알림 > SMAP 에서 활성화해주세요")
                        } else if settings.badgeSetting != .enabled {
                            print("⚠️ [권한] 배지 표시가 비활성화됨 - 앱 아이콘에 알림 표시가 안될 수 있습니다")
                        } else if settings.soundSetting != .enabled {
                            print("⚠️ [권한] 소리가 비활성화됨 - 알림 소리가 재생되지 않습니다")
                        } else {
                            print("✅ [권한] 모든 알림 권한이 정상입니다")
                        }

                        // FCM 알림이 없고 권한이 정상인 경우 추가 진단
                        if fcmNotifications.isEmpty && settings.authorizationStatus == .authorized && settings.alertSetting == .enabled {
                            print("🔍 [진단] FCM 알림이 없지만 권한은 정상입니다")
                            print("💡 [진단] 가능한 원인:")
                            print("   • FCM 메시지가 앱에 도달하지 못함")
                            print("   • 시스템 알림 표시 메커니즘이 실패함")
                            print("   • FCM 토큰이 유효하지 않음")
                            print("   • 앱이 백그라운드에서 제대로 동작하지 않음")
                        }
                    }
                }
            }
        }

        // 대기 중인 알림도 확인
        UNUserNotificationCenter.current().getPendingNotificationRequests { pendingRequests in
            DispatchQueue.main.async {
                print("⏳ [Notification Center] 대기 중인 알림 개수: \(pendingRequests.count)")

                if pendingRequests.isEmpty {
                    print("ℹ️ [Notification Center] 대기 중인 알림 요청이 없습니다")
                } else {
                    print("📋 [Notification Center] 대기 중인 알림 목록:")
                    for (index, request) in pendingRequests.prefix(5).enumerated() {
                        print("   \(index + 1). ID: \(request.identifier)")
                        print("      제목: \(request.content.title)")
                        print("      트리거: \(String(describing: request.trigger))")
                    }
                }

                print("═══════════════════════════════════════════════════════════════")
            }
        }
    }

    // FCM 서비스 연결 상태 모니터링 메소드
    private func monitorFCMServiceConnection() {
        print("🔗 [FCM Monitor] FCM 서비스 연결 상태 모니터링 시작")

        let monitorTimer = Timer.scheduledTimer(withTimeInterval: 300.0, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }
            
            // 백그라운드에서는 모니터링 건너뛰기 (배터리 절약)
            if self.isAppInBackground {
                print("💤 [FCM Monitor] 백그라운드 상태 - 모니터링 건너뛰기 (배터리 절약)")
                return
            }

            // FCM 서비스 상태 주기적 확인 (포그라운드에서만)
            Messaging.messaging().token { token, error in
                if let error = error {
                    print("⚠️ [FCM Monitor] FCM 서비스 연결 오류: \(error.localizedDescription)")
                    print("🔄 [FCM Monitor] FCM 서비스 재연결 시도")
                    self.forceRefreshFCMServiceRegistration("")
                } else if let token = token {
                    // FCM 토큰 검증
                    self.validateFCMTokenForPushReception(token) { isValid, message in
                        if !isValid {
                            print("⚠️ [FCM Monitor] FCM 토큰 검증 실패: \(message)")
                            print("🔄 [FCM Monitor] FCM 서비스 재등록 시도")
                            self.forceRefreshFCMServiceRegistration(token)
                        } else {
                            let monitorTimestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
                    print("✅ [FCM-MONITOR][\(monitorTimestamp)] FCM 서비스 연결 정상")
                        }
                    }
                } else {
                    print("⚠️ [FCM Monitor] FCM 토큰 없음")
                    print("🔄 [FCM Monitor] FCM 서비스 재초기화 시도")
                    Messaging.messaging().isAutoInitEnabled = false
                    Messaging.messaging().isAutoInitEnabled = true
                }
            }
        }

        // 타이머를 UserDefaults에 저장하여 앱 재시작 시에도 유지
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_monitor_start_time")
        UserDefaults.standard.synchronize()

        print("✅ [FCM Monitor] FCM 서비스 모니터링 시작됨 (5분 간격)")
    }

    // 로컬 알림 표시 테스트 메소드 (FCM 수신 시 강제 표시용)
    func testLocalNotificationDisplay() {
        print("🔔 [FCM Local Test] 로컬 알림 표시 테스트 시작")

        let content = UNMutableNotificationContent()
        content.title = "🧪 FCM 로컬 알림 테스트"

        // iOS 15.0 미만에서도 호환되는 날짜 포맷팅
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let formattedDate = dateFormatter.string(from: Date())
        content.body = "FCM 메시지 수신 후 로컬 알림 표시 테스트 - \(formattedDate)"

        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)
        content.categoryIdentifier = "GENERAL"
        content.userInfo = [
            "type": "fcm_local_test",
            "timestamp": Date().timeIntervalSince1970,
            "notification_id": "local_test_\(Int(Date().timeIntervalSince1970))"
        ]

        let request = UNNotificationRequest(
            identifier: "fcm_local_test_\(Int(Date().timeIntervalSince1970))",
            content: content,
            trigger: nil // 즉시 표시
        )

        // 중복 알림 방지 - 테스트 로컬 알림 생성 비활성화
        print("🚫 [FCM Local Test] 중복 방지를 위해 테스트 로컬 알림 생성 건너뛰기")
        print("📝 [FCM Local Test] 테스트 알림 생성하지 않음 - 원본 FCM만 사용")
        
        // Notification Center 상태는 여전히 확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            print("📱 [FCM Local Test] Notification Center 상태 확인")
            self.checkNotificationCenterStatus()
        }
    }

    // 수동 FCM 푸시 테스트 메소드
    func testFCMPushManually() {
        print("🧪 [FCM Manual Test] 수동 FCM 푸시 테스트 시작")

        // 1. FCM 서비스 상태 확인
        checkFCMPushDisplayStatus()

        // 2. 5초 후 FCM 토큰 검증
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            print("🔍 [FCM Manual Test] FCM 토큰 검증 중...")
            Messaging.messaging().token { token, error in
                if let token = token {
                    self.validateFCMTokenForPushReception(token) { isValid, message in
                        print("🎯 [FCM Manual Test] 토큰 검증 결과: \(isValid ? "성공" : "실패")")
                        print("📝 [FCM Manual Test] 검증 메시지: \(message)")

                        if !isValid {
                            print("🔄 [FCM Manual Test] FCM 서비스 재등록 실행")
                            self.forceRefreshFCMServiceRegistration(token)
                        } else {
                            print("✅ [FCM Manual Test] FCM 푸시 수신 준비 완료")
                            print("💡 [FCM Manual Test] 이제 서버에서 FCM 메시지를 전송해보세요")
                        }
                    }
                } else {
                    print("❌ [FCM Manual Test] FCM 토큰 없음")
                    if let error = error {
                        print("❌ [FCM Manual Test] 오류: \(error.localizedDescription)")
                    }
                }
            }
        }

        // 3. 10초 후 최종 상태 확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) {
            print("📊 [FCM Manual Test] 최종 FCM 상태 확인")
            self.checkFCMServiceRegistrationStatus()
        }
    }

    // FCM 디버깅 정보 출력 (개발자가 수동으로 호출 가능)
    func printFCMDebugInfo() {
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║ 🔍 [FCM Debug] FCM 디버깅 정보 출력                             ║")
        print("╚══════════════════════════════════════════════════════════════╝")

        // FCM 서비스 상태 확인
        checkFCMServiceRegistrationStatus()

        // 3초 후 추가 정보 출력
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            print("📊 [FCM Debug] 추가 디버깅 정보:")

            // FCM 토큰 정보
            let currentToken = UserDefaults.standard.string(forKey: "fcm_token") ?? "없음"
            let serverToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") ?? "없음"
            let backupToken = UserDefaults.standard.string(forKey: "fcm_token_backup") ?? "없음"

            print("   📱 현재 FCM 토큰: \(currentToken.prefix(20))...")
            print("   🖥️ 서버 FCM 토큰: \(serverToken.prefix(20))...")
            print("   💾 백업 FCM 토큰: \(backupToken.prefix(20))...")

            // 타임스탬프 정보
            let lastUpdate = UserDefaults.standard.double(forKey: "last_token_update_time")
            let lastRollback = UserDefaults.standard.double(forKey: "last_rollback_time")
            let appLaunch = UserDefaults.standard.double(forKey: "app_launch_time")

            let updateTime = lastUpdate > 0 ? Date(timeIntervalSince1970: lastUpdate).description : "없음"
            let rollbackTime = lastRollback > 0 ? Date(timeIntervalSince1970: lastRollback).description : "없음"
            let launchTime = appLaunch > 0 ? Date(timeIntervalSince1970: appLaunch).description : "없음"

            print("   ⏰ 마지막 토큰 업데이트: \(updateTime)")
            print("   🔄 마지막 롤백: \(rollbackTime)")
            print("   🚀 앱 실행 시간: \(launchTime)")

            // 안정화 점수 계산
            let stabilityScore = self.calculateFCMTokenStability()
            print("   📊 안정화 점수: \(stabilityScore)/100")

            // 마지막 롤백 사유
            let rollbackReason = UserDefaults.standard.string(forKey: "last_rollback_reason") ?? "없음"
            print("   📝 마지막 롤백 사유: \(rollbackReason)")

            // FCM 푸시 메시지 표시 상태 확인
            print("   🔔 FCM 푸시 표시 상태 확인 중...")
            self.checkFCMPushDisplayStatus()
        }
    }

    // MARK: - 🔍 FCM 등록 상태 검증
    private func verifyFCMRegistrationStatus(_ token: String) {
        print("🔍 [FCM Verify Status] FCM 등록 상태 검증 시작")

        // FCM 토큰 유효성 기본 검증
        if token.count < 100 {
            print("⚠️ [FCM Verify Status] 토큰 길이 비정상: \(token.count)자")
            return
        }

        if !token.contains(":") {
            print("⚠️ [FCM Verify Status] 토큰 형식 비정상 (콜론 없음)")
            return
        }

        print("✅ [FCM Verify Status] FCM 토큰 형식 유효성 검증 통과")
        print("🎯 [FCM Verify Status] FCM 토큰이 Firebase 서비스에 등록됨")
    }

    // MARK: - 🔍 FCM 서비스 등록 상태 확인 및 재등록
    private func verifyAndRefreshFCMRegistration(_ token: String) {
        print("🔍 [FCM Verify] FCM 서비스 등록 상태 확인 시작")

        // 1. APNs 토큰 재설정 시도 (푸시 수신 보장)
        if let apnsToken = currentAPNSToken {
            print("🔄 [FCM Verify] APNs 토큰 재설정 시도")
            Messaging.messaging().setAPNSToken(apnsToken.data(using: .utf8) ?? Data(), type: .unknown)
        } else {
            print("⚠️ [FCM Verify] APNs 토큰 없음 - FCM 등록에 영향 가능")
        }

        // 2. FCM 토큰 유효성 검증
        if token.count < 100 {
            print("⚠️ [FCM Verify] FCM 토큰 길이가 비정상적: \(token.count)자")
            return
        } else {
            print("✅ [FCM Verify] FCM 토큰 길이 정상: \(token.count)자")
        }

        // 3. FCM 서비스 상태 재초기화
        print("🔄 [FCM Verify] FCM 서비스 상태 재초기화")
        Messaging.messaging().isAutoInitEnabled = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            Messaging.messaging().isAutoInitEnabled = true

            // 4. FCM 토큰 재확인
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                Messaging.messaging().token { [weak self] verifiedToken, error in
                    if let error = error {
                        print("❌ [FCM Verify] FCM 서비스 재확인 실패: \(error.localizedDescription)")
                        // 재시도
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                            self?.forceFCMRegistrationRetry(token)
                        }
                    } else if let verifiedToken = verifiedToken {
                        if verifiedToken == token {
                            print("✅ [FCM Verify] FCM 서비스 등록 상태 정상 확인")
                            print("🎯 [FCM Verify] FCM 토큰이 FCM 서비스에 제대로 등록됨")
                        } else {
                            print("⚠️ [FCM Verify] FCM 서비스 토큰 불일치 감지")
                            print("   📱 기대 토큰: \(token.prefix(20))...")
                            print("   🔍 확인 토큰: \(verifiedToken.prefix(20))...")
                            print("🔄 [FCM Verify] 새로운 토큰으로 재등록 시도")
                            self?.handleFCMTokenUpdate(verifiedToken)
                        }
                    }
                }
            }
        }

        print("✅ [FCM Verify] FCM 서비스 등록 상태 확인 완료")
    }

    // MARK: - 🔥 FCM 등록 강제 재시도
    private func forceFCMRegistrationRetry(_ token: String) {
        print("🔥 [FCM Force Retry] FCM 등록 강제 재시도 시작")

        // FCM 서비스 완전 리셋
        Messaging.messaging().isAutoInitEnabled = false

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            Messaging.messaging().isAutoInitEnabled = true

            // APNs 토큰 재설정
            if let apnsToken = self.currentAPNSToken {
                Messaging.messaging().setAPNSToken(apnsToken.data(using: .utf8) ?? Data(), type: .unknown)
                print("✅ [FCM Force Retry] APNs 토큰 재설정 완료")
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                Messaging.messaging().token { [weak self] finalToken, error in
                    if let finalToken = finalToken {
                        print("✅ [FCM Force Retry] FCM 등록 최종 성공: \(finalToken.prefix(30))...")
                        if finalToken == token {
                            print("🎯 [FCM Force Retry] FCM 토큰 등록 완료 - 푸시 수신 보장")
                        } else {
                            print("🔄 [FCM Force Retry] 새로운 토큰 감지 - 업데이트 진행")
                            self?.handleFCMTokenUpdate(finalToken)
                        }
                    } else {
                        print("❌ [FCM Force Retry] FCM 등록 최종 실패")
                        print("📱 [FCM Force Retry] 수동 재시작 필요할 수 있음")
                    }
                }
            }
        }
    }

    private func updateFCMTokenIfNeededWithFetch() {
        // 🔒 중복 실행 방지
        guard !isFCMUpdateInProgress else {
            print("⏳ [FCM Auto] FCM 토큰 업데이트 이미 진행 중 - 스킵")
            return
        }
        
        // 사용자 식별 상태 확인 (mt_idx 기준)
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil
        
        guard hasUserIdentified else {
            print("🔒 [FCM Auto] 사용자가 식별되지 않음(mt_idx 없음) - FCM 토큰 업데이트 스킵")
            return
        }
        
        // ✅ 스마트 업데이트: 토큰 변경 시에만 업데이트 실행
        print("🔄 [FCM Auto] FCM 토큰 업데이트 시작 (토큰 변경 감지 시)")
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
                
                // 토큰 변경 감지 및 서버 업데이트 (실제 변경되었을 때만)
                self?.checkAndUpdateFCMTokenIfNeeded(currentToken: token)
            }
        }
    }

    // MARK: - 🔄 FCM 토큰 업데이트 (토큰 파라미터로 직접 호출)
    private func updateFCMTokenIfNeededDirect(token: String) {
        // 🔒 중복 실행 방지
        if isFCMUpdateInProgress {
            print("⏳ [FCM Direct] FCM 토큰 업데이트 이미 진행 중 - 스킵")
            return
        }

        // 📱 앱 상태 확인 - 백그라운드에서도 토큰 업데이트 허용
        let appState = UIApplication.shared.applicationState
        let isBackground = appState == .background

        print("📱 [FCM Direct] 앱 상태: \(isBackground ? "백그라운드" : "포그라운드") - 토큰 업데이트 허용")

        // 사용자 식별 상태 확인 (mt_idx 기준)
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                               UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        guard hasUserIdentified else {
            print("🔒 [FCM Direct] 사용자가 식별되지 않음(mt_idx 없음) - FCM 토큰 업데이트 스킵")
            return
        }

        print("🔄 [FCM Direct] FCM 토큰 서버 업데이트 시작: \(token.prefix(30))...")
        isFCMUpdateInProgress = true

        // 서버 업데이트 수행 (토큰 변경 확인 생략 - 이미 확인됨)
        sendFCMTokenToServer(token: token) { success in
            DispatchQueue.main.async {
                self.isFCMUpdateInProgress = false
                if success {
                    print("✅ [FCM Direct] FCM 토큰 서버 업데이트 성공")

                    // 성공 시 로컬 저장소 업데이트
                    UserDefaults.standard.set(token, forKey: "fcm_token")
                    UserDefaults.standard.set(token, forKey: "last_updated_fcm_token")
                    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_updated_time")
                    UserDefaults.standard.synchronize()

                    self.lastFCMTokenUpdateTime = Date()
                } else {
                    print("❌ [FCM Direct] FCM 토큰 서버 업데이트 실패")
                }
            }
        }
    }
    
    // MARK: - 🔔 FCM 앱 상태 변화 핸들러
    
    @objc private func fcmAppDidBecomeActive() {
        print("▶️ [FCM Auto] 앱이 활성화됨")

        // 🔑 로그인 시 토큰 업데이트 플래그 확인
        if forceTokenUpdateOnLogin {
            print("🔑 [LOGIN] 로그인 시 토큰 업데이트 플래그 감지 - FCM 토큰 강제 업데이트 실행")
            forceTokenUpdateOnLogin = false // 플래그 초기화
            forceUpdateFCMTokenOnLogin()
            return
        }

        // 로그인 상태 확인
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in") ||
                        UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if isLoggedIn {
            print("✅ [FCM Auto] 로그인 상태 감지 - FCM 토큰 상태 확인")

            // 토큰 변경 여부 확인 후 업데이트 (불필요한 빈번한 업데이트 방지)
            let lastCheckTime = UserDefaults.standard.double(forKey: "last_fcm_check_time")
            let currentTime = Date().timeIntervalSince1970
            let timeSinceLastCheck = currentTime - lastCheckTime

            // 마지막 확인 후 10분 이상 지났거나 처음인 경우에만 확인
            if timeSinceLastCheck > 600 || lastCheckTime == 0 {
                print("🔄 [FCM Auto] FCM 토큰 상태 확인 필요 (\(Int(timeSinceLastCheck/60))분 경과)")
            updateFCMTokenIfNeededWithFetch()
                UserDefaults.standard.set(currentTime, forKey: "last_fcm_check_time")
                UserDefaults.standard.synchronize()
            } else {
                print("⏳ [FCM Auto] 최근에 확인했음 - 스킵 (\(Int(timeSinceLastCheck/60))분 전)")
            }
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
        print("▶️ [FCM Auto] 앱이 포그라운드로 진입 예정")

        // 포그라운드 진입 시 불필요한 빈번한 업데이트 방지
        let lastForegroundCheck = UserDefaults.standard.double(forKey: "last_foreground_fcm_check")
        let currentTime = Date().timeIntervalSince1970
        let timeSinceLastCheck = currentTime - lastForegroundCheck

        // 마지막 포그라운드 체크 후 30분 이상 지났거나 처음인 경우에만 확인
        if timeSinceLastCheck > 1800 || lastForegroundCheck == 0 {
            print("🔄 [FCM Auto] 포그라운드 진입 시 토큰 상태 확인 필요")
        updateFCMTokenIfNeededWithFetch()
            UserDefaults.standard.set(currentTime, forKey: "last_foreground_fcm_check")
            UserDefaults.standard.synchronize()
        } else {
            print("⏳ [FCM Auto] 포그라운드 진입 시 최근에 확인했음 - 스킵")
        }
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

        // 🚫 백그라운드에서는 업데이트하지 않음
        let appState = UIApplication.shared.applicationState
        let isBackground = appState == .background

        if isBackground {
            print("🛡️ [FCM] 앱이 백그라운드 상태 - 토큰 업데이트 허용 (푸시 수신 우선)")
            // 백그라운드에서도 토큰 업데이트 진행 (푸시 수신 보장)
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
        
        // ✅ 스마트 업데이트: 토큰이 실제로 변경되었을 때만 업데이트
        let hasTokenChanged = lastSavedToken != currentToken
        let hasNoSavedToken = lastSavedToken == nil

        print("🔍 [FCM] 토큰 변경 분석:")
        print("   이전 토큰: \(lastSavedToken?.prefix(20) ?? "없음")...")
        print("   현재 토큰: \(currentToken.prefix(20))...")
        print("   토큰 변경됨: \(hasTokenChanged)")
        print("   저장된 토큰 없음: \(hasNoSavedToken)")

        // 토큰이 변경되었거나 저장된 토큰이 없는 경우에만 업데이트
        guard hasTokenChanged || hasNoSavedToken else {
            print("ℹ️ [FCM] FCM 토큰이 변경되지 않음 - 서버 업데이트 스킵")
            return
        }
        
        // 🔒 업데이트 진행 중 플래그 설정
        UserDefaults.standard.set(true, forKey: "fcm_update_in_progress")
        UserDefaults.standard.synchronize()
        
        // 새로운 토큰을 UserDefaults에 저장
        UserDefaults.standard.set(currentToken, forKey: "last_fcm_token")
        UserDefaults.standard.synchronize()

        // 서버에 FCM 토큰 업데이트 (토큰 변경 시에만)
        print("🚀 [FCM] FCM 토큰을 서버에 업데이트 시작 (토큰 변경됨)")
        self.sendFCMTokenToServer(token: currentToken) { success in
            if success {
                print("✅ [FCM] FCM 토큰 업데이트 성공")
            } else {
                print("❌ [FCM] FCM 토큰 업데이트 실패")
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

        // 백그라운드에서 취소된 FCM 토큰 업데이트 재시도
        retryCancelledBackgroundTokenUpdate()

        // 앱 활성화 시 성능 최적화
        URLCache.shared.removeAllCachedResponses()

        // 🚨 로그인 전에는 푸시 알림 권한 체크하지 않음
        if UserDefaults.standard.bool(forKey: "is_logged_in") {
            print("🔍 [PUSH] 로그인 상태 - 푸시 알림 권한 상태 확인")

            // 🔍 FCM 수신 상태 진단 (디버깅용)
            diagnoseFCMTokenReception()

            // 🔄 FCM 토큰 DB 동기화 (토큰 불일치 문제 해결)
            print("🔄 [앱 시작] FCM 토큰 DB 동기화 시작")
            forceSyncFCMTokenWithDB()

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
        print("📱 [FCM] 알림 제목: \(notification.request.content.title)")
        print("📱 [FCM] 알림 내용: \(notification.request.content.body)")
        print("📱 [FCM] 알림 사운드: \(notification.request.content.sound?.description ?? "없음")")
        print("📱 [FCM] 알림 배지: \(notification.request.content.badge ?? 0)")
        print("Handle push from foreground")
        print("\(userInfo)")

        // FCM 메시지 기록 업데이트
        UserDefaults.standard.set(userInfo, forKey: "last_fcm_message")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_fcm_message_time")
        UserDefaults.standard.synchronize()

        // 🚨 권한 상태 재확인
        center.getNotificationSettings { settings in
            print("🔧 [FCM] 현재 알림 권한 상태:")
            print("   • 허용 상태: \(settings.authorizationStatus.rawValue)")
            print("   • 알림 표시: \(settings.alertSetting.rawValue)")
            print("   • 소리: \(settings.soundSetting.rawValue)")
            print("   • 배지: \(settings.badgeSetting.rawValue)")
            print("   • 잠금화면: \(settings.lockScreenSetting.rawValue)")
            print("   • 알림 센터: \(settings.notificationCenterSetting.rawValue)")
        }

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
        
        // iOS 푸시 확실한 수신을 위한 강화된 표시 옵션
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .list, .sound, .badge])
        } else {
            completionHandler([.alert, .sound, .badge])
        }
        
        // 추가적인 처리 완료 로깅
        print("✅ [FCM] 포그라운드 푸시 처리 완료 - 알림 표시함")
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
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║ 🔔 [FCM] 백그라운드에서 원격 알림 수신!                        ║")
        print("╚══════════════════════════════════════════════════════════════╝")
        
        let appState = UIApplication.shared.applicationState
        let stateString = appState == .background ? "백그라운드" : appState == .active ? "포그라운드" : "비활성"
        print("📱 [FCM] 앱 상태: \(stateString)")
        print("📨 [FCM] 백그라운드 메시지 데이터: \(userInfo)")
        
        // 푸시 알림 즉시 처리 보장 - 백그라운드 작업 시작
        var backgroundTaskIdentifier: UIBackgroundTaskIdentifier = .invalid
        backgroundTaskIdentifier = UIApplication.shared.beginBackgroundTask(withName: "FCM_Message_Processing") {
            print("⚠️ [FCM] 백그라운드 작업 시간 초과")
            UIApplication.shared.endBackgroundTask(backgroundTaskIdentifier)
            backgroundTaskIdentifier = .invalid
        }
        
        defer {
            if backgroundTaskIdentifier != .invalid {
                UIApplication.shared.endBackgroundTask(backgroundTaskIdentifier)
            }
        }
        
        // AnyHashable을 String으로 변환하여 정렬
        let sortedKeys = userInfo.keys.compactMap { $0 as? String }.sorted()
        print("🔍 [FCM] 메시지 키들: \(sortedKeys)")

        // FCM 메시지 ID 확인
        if let messageId = userInfo["gcm.message_id"] as? String {
            print("📨 [FCM] 메시지 ID: \(messageId)")
        } else if let messageId = userInfo["google.c.fid"] as? String {
            print("📨 [FCM] FCM ID: \(messageId)")
        }

        // FCM SDK에 메시지 수신 알림
        Messaging.messaging().appDidReceiveMessage(userInfo)

        // 백그라운드 푸시인지 확인
        let isBackgroundPush = userInfo["content-available"] as? String == "1" ||
                              userInfo["content-available"] as? Int == 1 ||
                              userInfo["background_push"] as? String == "true"

        // Silent 푸시인지 확인 (사용자에게 표시되지 않는 푸시)
        let isSilentPush = userInfo["silent_push"] as? String == "true" ||
                          userInfo["token_refresh"] as? String == "true" ||
                          userInfo["action"] as? String == "token_refresh" ||
                          userInfo["type"] as? String == "silent_push"

        // Notification 객체가 포함된 푸시인지 확인 (사용자에게 표시되는 푸시)
        let hasNotification = userInfo["aps"] as? [String: Any] != nil ||
                             (userInfo["aps"] as? [String: Any])?["alert"] != nil

        print("📊 [FCM] 메시지 분석 결과:")
        print("   🔇 Silent 푸시: \(isSilentPush ? "예" : "아니오")")
        print("   🌙 백그라운드 푸시: \(isBackgroundPush ? "예" : "아니오")")
        print("   🔔 알림 포함: \(hasNotification ? "예" : "아니오")")

        // FCM 메시지 구조 상세 분석
        if let aps = userInfo["aps"] as? [String: Any] {
            print("   📨 APS 구조: \(aps)")
            if let alert = aps["alert"] as? [String: Any] {
                print("   📨 알림 제목: \(alert["title"] ?? "없음")")
                print("   📨 알림 내용: \(alert["body"] ?? "없음")")
            }
        }

        // FCM 메시지 전체 구조 분석
        print("🔍 [FCM 상세] 메시지 전체 구조:")
        for (key, value) in userInfo {
            print("   🔑 \(key): \(value)")
        }

        // 백그라운드 푸시 감지 로깅
        if let contentAvailable = userInfo["content-available"] as? String {
            print("   🌙 content-available: \(contentAvailable)")
        } else if let contentAvailable = userInfo["content-available"] as? Int {
            print("   🌙 content-available: \(contentAvailable)")
        }

        // FCM 메시지 ID 확인
        if let gcmMessageId = userInfo["gcm.message_id"] as? String {
            print("   📨 FCM 메시지 ID: \(gcmMessageId)")
        }

        // Google FCM 필드 확인
        if let googleSenderId = userInfo["google.c.sender.id"] as? String {
            print("   📨 Google Sender ID: \(googleSenderId)")
        }

        // 백그라운드/종료 상태에서 확실한 푸시 알림 표시
        if appState == .background || appState == .inactive {
            print("🔔 [FCM] 백그라운드/비활성 상태 - 강제 로컬 알림 표시")
            showLocalNotificationForBackgroundPush(userInfo)
            
            // 추가적인 시스템 알림도 시도
            DispatchQueue.main.async {
                self.scheduleImmediateLocalNotification(userInfo: userInfo)
            }
        } else if hasNotification {
            print("🔔 [FCM] 포그라운드 알림 데이터 포함 - 로컬 알림으로 표시")
            showLocalNotificationForBackgroundPush(userInfo)
        } else if isBackgroundPush && !isSilentPush {
            print("⚠️ [FCM] 백그라운드 푸시지만 알림 데이터 없음 - 기본 로컬 알림 표시")
            showLocalNotificationForBackgroundPush(userInfo)
        } else {
            print("🔇 [FCM] Silent 푸시 - 로컬 알림 표시하지 않음")
        }

        // FCM 메시지 기록 및 통계 (진단용)
        UserDefaults.standard.set(userInfo, forKey: "last_fcm_message")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_fcm_message_time")
        UserDefaults.standard.synchronize()

        print("💾 [FCM] 메시지 저장됨 - last_fcm_message 키에 기록")

        // FCM 토큰 유효성 즉시 검증
        print("🔍 [FCM 진단] FCM 토큰 유효성 검증 시작")
        if let currentToken = UserDefaults.standard.string(forKey: "fcm_token") {
            print("🔑 [FCM 진단] 현재 저장된 토큰: \(currentToken.prefix(30))...")
            print("📊 [FCM 진단] 토큰 길이: \(currentToken.count)자")
        } else {
            print("❌ [FCM 진단] 저장된 FCM 토큰 없음!")
        }

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

            // 백그라운드에서 알림 표시를 위한 로컬 알림 생성
            print("🔔 [FCM] 알림 포함 푸시 감지 - 백그라운드에서 로컬 알림 표시")
            self.showLocalNotificationForFCMMessage(userInfo)
        }
        UserDefaults.standard.synchronize()

        // 🔇 Silent Push 처리 (토큰 갱신용)
        if isSilentPush {
            print("🔇 [Silent Push] 토큰 갱신용 Silent Push 감지!")
            
            // 백그라운드 작업으로 토큰 갱신 수행
            var taskId: UIBackgroundTaskIdentifier = .invalid
            taskId = UIApplication.shared.beginBackgroundTask(withName: "SilentPushTokenRefresh") { 
                UIApplication.shared.endBackgroundTask(taskId)
            }
            
            DispatchQueue.global(qos: .utility).async { [weak self] in
                guard let self = self else {
                    UIApplication.shared.endBackgroundTask(taskId)
                    return
                }
                
                print("🔄 [Silent Push] 토큰 갱신 프로세스 시작")
                
                // 강제 토큰 갱신 실행
                self.handleSilentPushTokenRefresh(userInfo) { success in
                    DispatchQueue.main.async {
                        print("✅ [Silent Push] 토큰 갱신 완료 - 성공: \(success)")
                        UIApplication.shared.endBackgroundTask(taskId)
                        completionHandler(success ? .newData : .failed)
                    }
                }
            }
            return
        }
        
        if false { // 원래 조건
            // 이 블록은 실행되지 않음
            print("🤫 [FCM] Silent 푸시 감지 - 사용자에게 표시하지 않고 토큰 갱신만 수행")

            // FCM 토큰 변경 알림인지 확인
            if let forceTokenUpdate = userInfo["force_token_update"] as? String,
               forceTokenUpdate == "true" {
                print("🔄 [FCM] FCM 토큰 변경 알림 수신 - 강제 토큰 갱신 수행")

                // FCM 토큰 변경 이유 확인
                let reason = userInfo["reason"] as? String ?? "unknown"
                print("🔍 [FCM] 토큰 변경 이유: \(reason)")

                // 백그라운드에서 FCM 토큰 강제 갱신 (여러 번 시도)
                DispatchQueue.main.async {
                    self.forceRefreshFCMTokenInBackgroundWithRetry(maxAttempts: 3)
                }
            }

            // 백그라운드 앱 깨우기 플래그 확인
            if let backgroundWake = userInfo["background_wake"] as? String,
               backgroundWake == "true" {
                print("🌅 [FCM] 백그라운드 앱 깨우기 플래그 감지 - 앱 활성화 유지")
                // 앱이 백그라운드에서 깨어나도록 추가 작업 수행
                DispatchQueue.main.async {
                    // 최소한의 작업으로 앱이 깨어나도록 함
                    let tempToken = Messaging.messaging().fcmToken
                    print("🌅 [FCM] 백그라운드 앱 깨우기 완료 - 현재 토큰: \(tempToken?.prefix(20) ?? "없음")...")
                }
            }

            handleSilentPushMessage(userInfo, completionHandler: completionHandler)

        } else if isBackgroundPush && !hasNotification {
            // 백그라운드 푸시이지만 notification 객체가 없는 경우 (진정한 백그라운드 푸시)
            print("🔄 [FCM] 백그라운드 푸시 감지 (알림 없음) - 백그라운드에서 처리")
            handleBackgroundPushMessage(userInfo, completionHandler: completionHandler)

            // 백그라운드 푸시 수신 시 FCM 토큰 상태 확인 및 갱신
            print("🔄 [FCM] 백그라운드 푸시 수신으로 토큰 상태 확인")
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.updateFCMTokenIfNeededWithFetch()
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
                // Silent 푸시 수신 시 불필요한 빈번한 토큰 업데이트 방지
                let lastSilentPushUpdate = UserDefaults.standard.double(forKey: "last_silent_push_token_update")
                let currentTime = Date().timeIntervalSince1970
                let timeSinceLastUpdate = currentTime - lastSilentPushUpdate

                // 마지막 Silent 푸시 토큰 업데이트 후 1시간 이상 지났거나 처음인 경우에만 업데이트
                if timeSinceLastUpdate > 3600 || lastSilentPushUpdate == 0 {
                    print("🔄 [FCM] Silent 푸시 수신 - 토큰 상태 확인 필요")
                self.updateFCMTokenIfNeededWithFetch()
                    UserDefaults.standard.set(currentTime, forKey: "last_silent_push_token_update")
                    UserDefaults.standard.synchronize()
                } else {
                    print("⏳ [FCM] Silent 푸시 수신 - 최근에 토큰 확인했음 - 스킵")
                }

                // Silent 푸시 수신 기록 (디버깅용)
                let lastSilentPushTime = Date().timeIntervalSince1970
                UserDefaults.standard.set(lastSilentPushTime, forKey: "last_silent_push_time")
                UserDefaults.standard.synchronize()

                print("✅ [FCM] Silent 푸시 처리 완료")

                // 백그라운드 작업 완료
                completionHandler(.newData)
            }
        }
    }

    // MARK: - 🔔 알림 포함 푸시 처리 (iOS 푸시 문제 해결용)
    private func handleNotificationPushMessage(_ userInfo: [AnyHashable: Any], completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("🔔 [FCM] 알림 포함 푸시 메시지 처리 시작")

        // FCM 메시지 수신 시 다중 레벨 디버깅 시스템 시작
        print("📨 [FCM] 백그라운드 FCM 메시지 수신 - 알림 표시 시작")
        print("📝 [FCM] 백그라운드 메시지 내용: \(userInfo)")

        // FCM 메시지 수신 시 즉시 알림 표시 상태 확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            print("🔍 [FCM] 백그라운드 FCM 메시지 수신 후 즉시 알림 표시 상태 확인")
            self.checkFCMPushDisplayStatus()
        }

        // FCM 메시지 수신 즉시 로컬 알림 표시 테스트 (백업용)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            print("🔔 [FCM] 백그라운드 FCM 메시지 수신 즉시 로컬 알림 표시 테스트")
            self.testLocalNotificationDisplay()
        }

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

                // FCM 메시지 수신 시 알림 표시 (한 번만)
                print("🔔 [FCM] 백그라운드에서 FCM 메시지 수신 - 알림 표시 시작")

                // 현재 메시지 ID 설정 및 플래그 초기화
                if let messageId = userInfo["gcm.message_id"] as? String {
                    self.currentFCMMessageId = messageId
                    self.notificationDisplayedSuccessfully = false
                    print("╔══════════════════════════════════════════════════════════════╗")
                    print("║ 🔵 [FCM-BACKGROUND] 백그라운드 FCM 메시지 처리 시작                ║")
                    print("╚══════════════════════════════════════════════════════════════╝")
                    print("📝 [FCM-BACKGROUND] 메시지 ID: \(messageId)")
                    print("📝 [FCM-BACKGROUND] 메시지 내용: \(userInfo)")
                    print("🔄 [FCM-BACKGROUND] 알림 표시 성공 플래그 초기화")
                }

                // [FCM-BACKGROUND] 단계 1: 중복 메시지 확인
                print("🔍 [FCM-BACKGROUND] 단계 1: 중복 메시지 확인 시작")
                if let messageId = userInfo["gcm.message_id"] as? String,
                   let lastMessageId = self.lastProcessedFCMMessageId,
                   let lastTime = self.lastFCMNotificationTime,
                   messageId == lastMessageId,
                   Date().timeIntervalSince(lastTime) < self.fcmDuplicatePreventionInterval {
                    print("🚫 [FCM-BACKGROUND] 중복 FCM 메시지 감지 - 전체 처리 스킵")
                    print("   📝 메시지 ID: \(messageId)")
                    print("   ⏱️  경과 시간: \(Date().timeIntervalSince(lastTime))초")
                    print("   🎯 중복 방지 시간: \(self.fcmDuplicatePreventionInterval)초")
                    return
                }
                print("✅ [FCM-BACKGROUND] 중복 메시지 없음 - 처리 계속 진행")

                // [FCM-BACKGROUND] 단계 2: 알림 표시 시도
                print("🔔 [FCM-BACKGROUND] 단계 2: 알림 표시 시도 시작")
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    print("🔔 [FCM-BACKGROUND] 알림 표시 시도 (한 번만)")
                    print("   📱 대상: Notification Center")
                    print("   ⏱️  지연 시간: 0.3초")
                    self.forceDisplayFCMNotification(userInfo)
                }

                // [FCM-BACKGROUND] 단계 3: Notification Center 상태 확인
                print("📱 [FCM-BACKGROUND] 단계 3: Notification Center 상태 확인 준비")
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    print("🔍 [FCM-BACKGROUND] Notification Center 상태 확인 실행")
                    print("   ⏱️  지연 시간: 1.0초")

                    // 이미 알림 표시가 성공했다면 확인 스킵
                    if self.notificationDisplayedSuccessfully,
                       let currentId = self.currentFCMMessageId,
                       let lastId = self.lastProcessedFCMMessageId,
                       currentId == lastId {
                        print("✅ [FCM-BACKGROUND] 알림 표시 이미 성공 - Notification Center 확인 스킵")
                        print("   📝 현재 메시지 ID: \(currentId)")
                        print("   📝 마지막 처리 ID: \(lastId)")
                        return
                    }

                    print("📱 [FCM-BACKGROUND] Notification Center 상태 확인 진행")
                    print("   🎯 목적: 알림 표시 성공 여부 확인")
                    self.checkNotificationCenterStatus()
                }

                // FCM 메시지 수신 후 사용자에게 직접 확인 요청 (알림 표시 실패 시에만)
                DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) {
                    // 이미 알림 표시가 성공했다면 사용자 확인 요청 스킵
                    if self.notificationDisplayedSuccessfully,
                       let currentId = self.currentFCMMessageId,
                       let lastId = self.lastProcessedFCMMessageId,
                       currentId == lastId {
                        print("✅ [FCM] 백그라운드 알림 표시 성공 확인됨 - 사용자 확인 요청 스킵")
                        return
                    }

                    print("🚨 [FCM] 백그라운드 FCM 메시지가 수신되었지만 알림이 표시되지 않을 수 있습니다!")
                    print("💡 [FCM] 즉시 다음 작업을 수행하세요:")
                    print("   1. 화면 상단을 아래로 스와이프해서 Notification Center를 확인")
                    print("   2. SMAP 앱의 알림이 있는지 확인")
                    print("   3. 알림이 없으면 iOS 설정 > 알림 > SMAP 앱 설정 확인")
                    print("   4. 아래 명령어로 수동 테스트:")
                    print("      (UIApplication.shared.delegate as? AppDelegate)?.testFCMPushManually()")
                }

                print("✅ [FCM] 알림 포함 푸시 처리 완료")

                // FCM 토큰 상태 확인 및 갱신 (알림 푸시 수신 시점에 토큰 검증)
                print("🔄 [FCM] 알림 푸시 수신으로 토큰 상태 확인")
                self.updateFCMTokenIfNeededWithFetch()

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

// 기존 showLocalNotificationForBackgroundPush 메소드는 아래의 새 버전으로 대체되었습니다.

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║ 📱 [APNS] APNS 디바이스 토큰 수신 시작                          ║")
        print("╚══════════════════════════════════════════════════════════════╝")

        // APNS 토큰을 문자열로 변환하여 저장
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        currentAPNSToken = token

        print("📱 [APNS] APNS 토큰 변환 성공: \(token.prefix(20))... (길이: \(token.count))")
        print("📱 [APNS] 전체 APNS 토큰: \(token)")
        print("📱 [APNS] APNS 토큰 길이: \(token.count)자")

        // APNS 토큰을 UserDefaults에 저장 (백그라운드용 다중 백업)
        UserDefaults.standard.set(token, forKey: "last_apns_token")
        UserDefaults.standard.set(token, forKey: "apns_token_backup")
        UserDefaults.standard.set(deviceToken, forKey: "apns_token_data")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "apns_token_received_time")
        UserDefaults.standard.synchronize()

        print("💾 [APNS] APNS 토큰 다중 백업 저장 완료 (백그라운드 대비)")

        // 앱 실행 시간 기록 (안정화 점수 계산용)
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "app_launch_time")
        UserDefaults.standard.synchronize()

        // FCM 토큰 안정화 점수 계산 및 로깅
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            let stabilityScore = self.calculateFCMTokenStability()
            print("📊 [FCM Stability] 앱 시작 시 FCM 토큰 안정화 점수: \(stabilityScore)/100")

            if stabilityScore >= 80 {
                print("🟢 [FCM Stability] 토큰 안정성 양호 - 백그라운드 변경 제한 활성화")
            } else if stabilityScore >= 50 {
                print("🟡 [FCM Stability] 토큰 안정성 보통 - 조건부 변경 허용")
            } else {
                print("🔴 [FCM Stability] 토큰 안정성 낮음 - 변경 허용")
            }
        }

        // FCM 서비스 연결 모니터링 시작
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            print("🔗 [FCM] FCM 서비스 연결 모니터링 시작")
            self.monitorFCMServiceConnection()
        }

        // FCM에 APNS 토큰 설정 (강화된 등록)
        Messaging.messaging().setAPNSToken(deviceToken as Data, type: .unknown)
        print("✅ [APNS] APNS 디바이스 토큰 FCM에 등록 완료")

        // 🔄 APNs 토큰 변경 감지 - FCM 토큰도 함께 갱신되어야 함
        print("🔄 [APNS→FCM] APNs 토큰 변경 감지 - FCM 토큰 동기화 필요")
        print("🎯 [이벤트 기반] FCM SDK가 자동으로 새로운 토큰을 생성할 때까지 대기")

        // FCM 서비스에 APNs 토큰 설정 (토큰 갱신 트리거)
        Messaging.messaging().setAPNSToken(deviceToken as Data, type: .unknown)
        print("📡 [APNS→FCM] APNs 토큰을 FCM에 설정 - 토큰 갱신 이벤트 유발")

        // 🎯 이벤트 기반 토큰 관리 시스템
        // FCM 토큰 갱신 이벤트 기반 처리로 전환
        // messaging(_:didReceiveRegistrationToken:)에서 자동으로 처리됨
        print("⏳ [이벤트 기반] FCM 토큰 갱신 이벤트 대기 중...")
        print("🎯 [messaging(_:didReceiveRegistrationToken:)] 메서드가 새로운 토큰을 처리할 예정")
        print("🔗 [APNs→FCM 연동] APNs 토큰 변경 → FCM 토큰 자동 갱신 → 서버 업데이트")

        // 현재 FCM 토큰도 확인해서 비교
        Messaging.messaging().token { fcmToken, error in
            if let error = error {
                print("❌ [FCM] 현재 FCM 토큰 가져오기 실패: \(error.localizedDescription)")
            } else if let fcmToken = fcmToken {
                print("🔥 [FCM] 현재 FCM 토큰: \(fcmToken)")
                print("🔥 [FCM] FCM 토큰 길이: \(fcmToken.count)자")
                print("🔥 [FCM] FCM 토큰 접두사: \(fcmToken.prefix(30))...")

                // FCM 토큰을 UserDefaults에 저장 (디버깅용)
                UserDefaults.standard.set(fcmToken, forKey: "current_fcm_token")
                UserDefaults.standard.synchronize()

                // DB 토큰과 비교 (UserDefaults에서 가져옴)
                if let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") {
                    print("💾 [DB] DB에 저장된 FCM 토큰: \(dbToken.prefix(30))...")
                    if fcmToken == dbToken {
                        print("✅ [토큰 일치] FCM 토큰과 DB 토큰이 일치합니다")
                    } else {
                        print("⚠️ [토큰 불일치] FCM 토큰과 DB 토큰이 다릅니다!")
                        print("   📱 현재 디바이스 FCM 토큰: \(fcmToken.prefix(20))...")
                        print("   💾 DB에 저장된 토큰: \(dbToken.prefix(20))...")
                        print("   🔄 토큰 동기화 필요!")
                    }
                } else {
                    print("⚠️ [DB] DB에 저장된 FCM 토큰이 없습니다")
                }
            }
        }

        print("═══════════════════════════════════════════════════════════════")

        // 🚫 APNS 토큰 변경 시 FCM 토큰 강제 갱신 비활성화 - 토큰 변경 방지
        let currentAPNSTokenKey = token
        let savedAPNSToken = UserDefaults.standard.string(forKey: "last_saved_apns_token")

        if savedAPNSToken != currentAPNSTokenKey {
            print("🚫 [APNS] APNS 토큰 변경 감지됨 - FCM 토큰 강제 갱신 비활성화")
            UserDefaults.standard.set(currentAPNSTokenKey, forKey: "last_saved_apns_token")
            UserDefaults.standard.synchronize()
            print("🚫 [APNS] FCM 토큰 강제 갱신 건너뜀 - 기존 토큰 유지")
        }

        // ✅ FCM 토큰 상태 확인 및 처리
        if let existingFCMToken = Messaging.messaging().fcmToken {
            print("🔥 [FCM] 기존 FCM 토큰 발견: \(existingFCMToken.prefix(30))...")
            currentFCMToken = existingFCMToken
            Utils.shared.setToken(token: existingFCMToken)

            // ✅ FCM 토큰이 있는 경우 서버 업데이트 허용
            print("✅ [FCM] 기존 FCM 토큰 서버 업데이트 허용")
        } else {
            print("🔥 [FCM] FCM 토큰이 아직 없음, 생성 대기")
        }

        // ✅ FCM 토큰 생성 활성화 - 푸시 메시지 수신을 위해
        print("✅ [FCM] FCM 토큰 자동 생성 활성화 - 푸시 메시지 수신 가능")
    }
    
    // MARK: - 🚫 FCM 토큰 변경 방지 로직
    
    /// FCM 토큰 만료 여부 확인 (7일 기준)
    private func isFCMTokenExpired() -> Bool {
        let lastUpdateTime = UserDefaults.standard.double(forKey: "last_fcm_token_update_time")
        let currentTime = Date().timeIntervalSince1970
        let expiryTime = TimeInterval(fcmTokenExpiryDays * 24 * 60 * 60) // 7일을 초로 변환
        
        let isExpired = (currentTime - lastUpdateTime) > expiryTime
        
        if isExpired {
            print("⏰ [FCM Expiry] FCM 토큰이 만료되었습니다. 마지막 업데이트: \(Date(timeIntervalSince1970: lastUpdateTime))")
        } else {
            let remainingDays = Double(fcmTokenExpiryDays) - ((currentTime - lastUpdateTime) / (24 * 60 * 60))
            print("✅ [FCM Expiry] FCM 토큰이 유효합니다. 남은 기간: \(String(format: "%.1f", remainingDays))일")
        }
        
        return isExpired
    }
    
    /// FCM 토큰 변경 차단 여부 확인
    private func shouldBlockFCMTokenChange() -> Bool {
        // 이미 토큰 변경이 차단된 상태라면 true 반환
        if isFCMTokenChangeBlocked {
            print("🚫 [FCM Block] FCM 토큰 변경이 이미 차단된 상태")
            return true
        }
        
        // 토큰이 만료되지 않았다면 변경 차단
        if !isFCMTokenExpired() {
            print("🚫 [FCM Block] FCM 토큰이 만료되지 않음 - 변경 차단")
            return true
        }
        
        return false
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

    // 🎯 FCM 토큰 갱신 이벤트 핸들러 - 개선된 이벤트 기반 토큰 관리
    // 📱 iOS 시스템이 "토큰이 변경되었으니 새 토큰으로 업데이트해!"라고 알려줄 때 호출됨
    // 🔗 APNs 토큰 변경 → FCM 토큰 자동 갱신 → 이 메서드 호출 → 서버 업데이트
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("🎯 [FCM Delegate] FCM 토큰 갱신 이벤트 발생!")

        guard let token = fcmToken else {
            print("❌ [FCM Delegate] FCM 토큰이 nil입니다")
            
            // nil 토큰에 대한 더 강력한 처리
            handleNilTokenReceived()
            return
        }

        print("✅ [FCM Delegate] 새로운 FCM 토큰 수신: \(token.prefix(30))...")
        print("📏 [FCM Delegate] 토큰 길이: \(token.count)자")

        // 🔥 개선된 FCM 토큰 형식 검증
        if !validateTokenFormat(token) {
            print("🚨 [FCM Delegate] 잘못된 FCM 토큰 형식 감지 - 새 토큰 요청")
            print("❌ [FCM Delegate] 잘못된 토큰: \(token.prefix(50))...")
            
            // 잘못된 토큰 감지 시 새로운 토큰 요청
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.requestNewToken()
            }
            return
        }

        print("✅ [FCM Delegate] FCM 토큰 형식 검증 통과")

        // 기존 토큰과 비교하여 실제 변경되었는지 확인
        let existingToken = UserDefaults.standard.string(forKey: "fcm_token")
        let lastSyncedToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token")
        
        if token == existingToken && token == lastSyncedToken {
            print("ℹ️ [FCM Delegate] FCM 토큰이 변경되지 않았고 서버와 동기화됨 - 업데이트 건너뜀")
            return
        }

        print("🔄 [FCM Delegate] FCM 토큰 변경됨 또는 동기화 필요")
        if let existingToken = existingToken {
            print("📱 [FCM Delegate] 이전 토큰: \(existingToken.prefix(20))...")
        }
        print("🆕 [FCM Delegate] 새로운 토큰: \(token.prefix(20))...")

        // 토큰 업데이트 처리
        handleFCMTokenUpdate(token)
    }
    
    /// nil 토큰 수신 처리 (개선된 버전)
    private func handleNilTokenReceived() {
        print("⚠️ [FCM Nil Token] nil 토큰 수신 처리 시작")
        
        fcmTokenRetryCount += 1
        
        if fcmTokenRetryCount <= 3 {
            let delay = Double(fcmTokenRetryCount) * 2.0
            print("🔄 [FCM Nil Token] 재시도 \(fcmTokenRetryCount)/3 - \(delay)초 후")
            
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                Messaging.messaging().token { token, error in
                    if let token = token {
                        print("✅ [FCM Nil Token] 재시도 성공 - 토큰 수신")
                        self.handleFCMTokenUpdate(token)
                    } else {
                        print("❌ [FCM Nil Token] 재시도 실패")
                        self.handleNilTokenReceived()
                    }
                }
            }
        } else {
            print("❌ [FCM Nil Token] 최대 재시도 초과 - FCM 서비스 재초기화")
            fcmTokenRetryCount = 0
            reinitializeFCMService()
        }
    }
    
    // MARK: - Enhanced FCM Token Management Functions
    
    /// 백그라운드 토큰 갱신 시스템 설정
    private func setupBackgroundTokenRefresh() {
        print("🔧 [FCM Setup] 백그라운드 토큰 갱신 시스템 설정 시작")
        
        // 앱 상태 변화 감지
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        
        print("✅ [FCM Setup] 백그라운드 토큰 갱신 시스템 설정 완료")
    }
    
    /// 앱이 백그라운드로 전환될 때 호출
    @objc private func appDidEnterBackground() {
        print("🌙 [FCM Background] 앱 백그라운드 전환 감지")
        
        // 백그라운드 작업 시작
        backgroundTaskIdentifier = UIApplication.shared.beginBackgroundTask(withName: "FCMTokenRefresh") {
            self.endBackgroundTask()
        }
        
        // 토큰 갱신이 필요한 경우 예약
        if shouldForceTokenRefreshOnResume {
            print("📝 [FCM Background] 토큰 갱신 필요 - 포그라운드 전환 시 실행 예약")
        }
        
        // Enhanced 백그라운드 처리 실행
        appDidEnterBackgroundEnhanced()
    }
    
    /// 앱이 포그라운드로 전환될 때 호출
    @objc private func appWillEnterForeground() {
        print("🌅 [FCM Foreground] 앱 포그라운드 전환 감지")
        
        // 예약된 토큰 갱신 실행
        if shouldForceTokenRefreshOnResume {
            print("🔄 [FCM Foreground] 예약된 토큰 갱신 실행")
            shouldForceTokenRefreshOnResume = false
            performTokenIntegrityCheck()
        }
        
        // 백그라운드 작업 종료
        endBackgroundTask()
        
        // Enhanced 포그라운드 처리 실행
        appWillEnterForegroundEnhanced()
    }
    
    /// 백그라운드 작업 종료
    private func endBackgroundTask() {
        if backgroundTaskIdentifier != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTaskIdentifier)
            backgroundTaskIdentifier = .invalid
        }
    }
    
    /// 토큰 무결성 검증 수행
    private func performTokenIntegrityCheck() {
        print("🔍 [FCM Integrity] 토큰 무결성 검증 시작")
        
        // 재시도 횟수 초기화
        fcmTokenRetryCount = 0
        
        // 현재 FCM 토큰 가져오기
        Messaging.messaging().token { [weak self] token, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [FCM Integrity] 토큰 가져오기 실패: \(error.localizedDescription)")
                self.handleTokenError(error)
                return
            }
            
            guard let token = token else {
                print("❌ [FCM Integrity] 토큰이 nil")
                self.handleNilTokenReceived()
                return
            }
            
            print("✅ [FCM Integrity] 토큰 가져오기 성공: \(token.prefix(30))...")
            
            // 토큰 형식 검증
            if !self.validateTokenFormat(token) {
                print("❌ [FCM Integrity] 토큰 형식 불량")
                self.requestNewToken()
                return
            }
            
            // 서버와 동기화
            self.syncTokenWithServer(token)
        }
    }
    
    /// FCM 토큰 형식 검증
    private func validateTokenFormat(_ token: String) -> Bool {
        // 기본 길이 검증 (일반적으로 140-200자)
        guard token.count >= 140 && token.count <= 200 else {
            print("❌ [Token Validation] 토큰 길이 불량: \(token.count)")
            return false
        }
        
        // 콜론 포함 여부 확인
        guard token.contains(":") else {
            print("❌ [Token Validation] 콜론 없음")
            return false
        }
        
        // Project ID 형식 확인 (콜론 앞 부분)
        let components = token.components(separatedBy: ":")
        guard components.count == 2,
              components[0].count >= 20,
              components[1].hasPrefix("APA91b") else {
            print("❌ [Token Validation] 프로젝트 ID 또는 APA91b 접두사 불량")
            return false
        }
        
        print("✅ [Token Validation] 토큰 형식 검증 통과")
        return true
    }
    
    /// 토큰 에러 처리
    private func handleTokenError(_ error: Error) {
        fcmTokenRetryCount += 1
        
        if fcmTokenRetryCount < maxTokenRetryAttempts {
            print("🔄 [FCM Error] 토큰 에러 재시도 \(fcmTokenRetryCount)/\(maxTokenRetryAttempts)")
            
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(fcmTokenRetryCount)) {
                self.performTokenIntegrityCheck()
            }
        } else {
            print("❌ [FCM Error] 최대 재시도 초과 - FCM 서비스 재초기화")
            fcmTokenRetryCount = 0
            reinitializeFCMService()
        }
    }
    
    /// 새로운 토큰 요청
    private func requestNewToken() {
        print("🆕 [FCM New Token] 새로운 토큰 요청 시작")
        
        // 기존 토큰 삭제
        Messaging.messaging().deleteToken { [weak self] error in
            if let error = error {
                print("⚠️ [FCM New Token] 기존 토큰 삭제 실패: \(error.localizedDescription)")
            } else {
                print("✅ [FCM New Token] 기존 토큰 삭제 성공")
            }
            
            // 새 토큰 요청
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self?.performTokenIntegrityCheck()
            }
        }
    }
    
    /// FCM 서비스 재초기화
    private func reinitializeFCMService() {
        print("🔄 [FCM Reinit] FCM 서비스 재초기화 시작")
        
        // FCM 비활성화
        Messaging.messaging().isAutoInitEnabled = false
        isFCMTokenRefreshInProgress = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            // FCM 재활성화
            Messaging.messaging().isAutoInitEnabled = true
            Messaging.messaging().delegate = self
            
            self.isFCMTokenRefreshInProgress = false
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                print("✅ [FCM Reinit] FCM 서비스 재초기화 완료")
                self.performTokenIntegrityCheck()
            }
        }
    }
    
    /// 서버와 토큰 동기화
    private func syncTokenWithServer(_ token: String) {
        print("🔄 [FCM Sync] 서버와 토큰 동기화 시작")
        
        // 현재 로컬 저장된 토큰과 비교
        let currentSavedToken = UserDefaults.standard.string(forKey: "fcm_token")
        let lastSyncedToken = UserDefaults.standard.string(forKey: "last_synced_fcm_token")
        
        // 토큰이 변경되었거나 동기화된 적이 없는 경우에만 서버 업데이트
        if token != currentSavedToken || token != lastSyncedToken {
            print("🔄 [FCM Sync] 토큰 변경 감지 - 서버 업데이트 필요")
            
            // 로컬 저장
            UserDefaults.standard.set(token, forKey: "fcm_token")
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_received_time")
            UserDefaults.standard.synchronize()
            
            currentFCMToken = token
            
            // 서버 업데이트
            sendFCMTokenToServer(token: token, completion: { success in
                if success {
                    print("✅ [FCM Sync] 서버 동기화 성공")
                    UserDefaults.standard.set(token, forKey: "last_synced_fcm_token")
                    UserDefaults.standard.synchronize()
                } else {
                    print("❌ [FCM Sync] 서버 동기화 실패")
                    self.handleSyncFailure(token)
                }
            })
        } else {
            print("✅ [FCM Sync] 토큰 동기화 불필요 - 이미 최신 상태")
        }
    }
    
    /// 동기화 실패 처리
    private func handleSyncFailure(_ token: String) {
        print("⚠️ [FCM Sync Failure] 동기화 실패 처리")
        
        // 실패한 토큰을 "대기 중" 상태로 저장
        UserDefaults.standard.set(token, forKey: "pending_fcm_token")
        UserDefaults.standard.synchronize()
        
        // 앱 재개 시 재시도하도록 플래그 설정
        scheduleTokenRefreshForResume()
    }
    
    /// 앱 재개 시 토큰 갱신 예약
    private func scheduleTokenRefreshForResume() {
        shouldForceTokenRefreshOnResume = true
        print("📝 [FCM Schedule] 앱 재개 시 토큰 갱신 예약됨")
    }
    
    /// 백그라운드 푸시를 위한 로컬 알림 표시
    private func showLocalNotificationForBackgroundPush(_ userInfo: [AnyHashable: Any]) {
        let content = UNMutableNotificationContent()
        
        // 메시지 내용 추출
        if let title = userInfo["title"] as? String {
            content.title = title
        } else if let aps = userInfo["aps"] as? [String: Any],
                  let alert = aps["alert"] as? [String: Any],
                  let alertTitle = alert["title"] as? String {
            content.title = alertTitle
        } else {
            content.title = "새 메시지"
        }
        
        if let body = userInfo["body"] as? String {
            content.body = body
        } else if let aps = userInfo["aps"] as? [String: Any],
                  let alert = aps["alert"] as? [String: Any],
                  let alertBody = alert["body"] as? String {
            content.body = alertBody
        } else {
            content.body = "새로운 알림이 도착했습니다."
        }
        
        // 중복 방지
        let messageId = userInfo["gcm.message_id"] as? String ?? UUID().uuidString
        if let lastId = lastProcessedFCMMessageId,
           let lastTime = lastFCMNotificationTime,
           messageId == lastId,
           Date().timeIntervalSince(lastTime) < fcmDuplicatePreventionInterval {
            print("🚫 [Local Notification] 중복 알림 방지")
            return
        }
        
        content.sound = .default
        content.badge = 1
        
        // 중복 알림 방지 - 백그라운드 로컬 알림 생성 비활성화
        print("🚫 [Local Notification] 중복 방지를 위해 백그라운드 로컬 알림 생성 건너뛰기")
        print("📝 [Local Notification] 메시지 ID: \(messageId) - 원본 FCM 알림만 사용")
        
        // 중복 방지를 위한 메시지 ID 추적은 유지
        self.lastProcessedFCMMessageId = messageId
        self.lastFCMNotificationTime = Date()
    }



    // ✅ FCM 메시지 수신 처리 활성화
    func messaging(_ messaging: Messaging, didReceive remoteMessage: Any) {
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║ 📨 [FCM] FCM 메시지 수신 시작: \(Date())                         ║")
        print("╚══════════════════════════════════════════════════════════════╝")

        // FCM 메시지 구조 상세 분석
        if let message = remoteMessage as? [String: Any] {
            print("📨 [FCM] 메시지 구조 분석:")
            print("   • 전체 키: \(message.keys)")

            if let data = message["data"] as? [String: Any] {
                print("   • 데이터: \(data)")
            }

            if let notification = message["notification"] as? [String: Any] {
                print("   • 알림: \(notification)")
                print("     - 제목: \(notification["title"] ?? "없음")")
                print("     - 내용: \(notification["body"] ?? "없음")")
            }

            if let aps = message["aps"] as? [String: Any] {
                print("   • APS: \(aps)")
                if let alert = aps["alert"] as? [String: Any] {
                    print("     - Alert 제목: \(alert["title"] ?? "없음")")
                    print("     - Alert 내용: \(alert["body"] ?? "없음")")
                }
            }
        }

        // FCM 메시지 수신 디버깅
        debugFCMMessageReception(remoteMessage)

        // FCM 메시지 수신 시 즉시 알림 표시 상태 확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            print("🔍 [FCM] FCM 메시지 수신 후 즉시 알림 표시 상태 확인")
            self.checkFCMPushDisplayStatus()
        }

        // FCM 메시지 수신 즉시 로컬 알림 표시 테스트
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            print("🔔 [FCM] FCM 메시지 수신 즉시 로컬 알림 표시 테스트")
            self.testLocalNotificationDisplay()
        }

            // FCM 메시지 수신 시 권한 상태 즉시 확인 및 재요청
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            print("🔧 [FCM] FCM 메시지 수신 시 권한 상태 확인 및 재요청")
            self.requestNotificationPermissionIfNeeded()
        }

        // FCM 메시지 수신 시 로컬 알림으로 표시 (권한이 없어도 표시)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            print("📢 [FCM] FCM 메시지 수신 시 로컬 알림으로 표시 시도")
            self.displayFCMMessageAsLocalNotification(remoteMessage)
        }

        // FCM 메시지에서 사용자 정보 추출하여 알림 표시 (한 번만)
        if let userInfo = remoteMessage as? [AnyHashable: Any] {
            print("╔══════════════════════════════════════════════════════════════╗")
            print("║ 🟢 [FCM-FOREGROUND] 포그라운드 FCM 메시지 처리 시작              ║")
            print("╚══════════════════════════════════════════════════════════════╝")
            print("📨 [FCM-FOREGROUND] FCM 메시지 수신")
            print("📝 [FCM-FOREGROUND] 메시지 내용: \(userInfo)")

            // 현재 메시지 ID 설정 및 플래그 초기화
            if let messageId = userInfo["gcm.message_id"] as? String {
                self.currentFCMMessageId = messageId
                self.notificationDisplayedSuccessfully = false
                print("📝 [FCM-FOREGROUND] 메시지 ID: \(messageId)")
                print("🔄 [FCM-FOREGROUND] 알림 표시 성공 플래그 초기화")
            }

            // [FCM-FOREGROUND] 단계 1: 중복 메시지 확인
            print("🔍 [FCM-FOREGROUND] 단계 1: 중복 메시지 확인 시작")
            if let messageId = userInfo["gcm.message_id"] as? String,
               let lastMessageId = self.lastProcessedFCMMessageId,
               let lastTime = self.lastFCMNotificationTime,
               messageId == lastMessageId,
               Date().timeIntervalSince(lastTime) < self.fcmDuplicatePreventionInterval {
                print("🚫 [FCM-FOREGROUND] 중복 FCM 메시지 감지 - 전체 처리 스킵")
                print("   📝 메시지 ID: \(messageId)")
                print("   ⏱️  경과 시간: \(Date().timeIntervalSince(lastTime))초")
                print("   🎯 중복 방지 시간: \(self.fcmDuplicatePreventionInterval)초")
                return
            }
            print("✅ [FCM-FOREGROUND] 중복 메시지 없음 - 처리 계속 진행")

            // [FCM-FOREGROUND] 단계 2: 알림 표시 시도
            print("🔔 [FCM-FOREGROUND] 단계 2: 알림 표시 시도 시작")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                print("🔔 [FCM-FOREGROUND] 알림 표시 시도 (한 번만)")
                print("   📱 대상: Notification Center")
                print("   ⏱️  지연 시간: 0.3초")
                self.forceDisplayFCMNotification(userInfo)
            }

            // FCM 메시지 기반 추가 알림 표시 시도 제거 (중복 방지)

            // [FCM-FOREGROUND] 단계 3: Notification Center 상태 확인
            print("📱 [FCM-FOREGROUND] 단계 3: Notification Center 상태 확인 준비")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                print("🔍 [FCM-FOREGROUND] Notification Center 상태 확인 실행")
                print("   ⏱️  지연 시간: 0.5초")

                // 이미 알림 표시가 성공했다면 확인 스킵
                if self.notificationDisplayedSuccessfully,
                   let currentId = self.currentFCMMessageId,
                   let lastId = self.lastProcessedFCMMessageId,
                   currentId == lastId {
                    print("✅ [FCM-FOREGROUND] 알림 표시 이미 성공 - Notification Center 확인 스킵")
                    print("   📝 현재 메시지 ID: \(currentId)")
                    print("   📝 마지막 처리 ID: \(lastId)")
                    return
                }

                print("📱 [FCM-FOREGROUND] Notification Center 상태 확인 진행")
                print("   🎯 목적: 알림 표시 성공 여부 확인")
                self.checkNotificationCenterStatus()
            }

            // FCM 메시지 수신 후 사용자에게 직접 확인 요청 (알림 표시 실패 시에만)
            DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) {
                // 이미 알림 표시가 성공했다면 사용자 확인 요청 스킵
                if self.notificationDisplayedSuccessfully,
                   let currentId = self.currentFCMMessageId,
                   let lastId = self.lastProcessedFCMMessageId,
                   currentId == lastId {
                    print("✅ [FCM] 포그라운드 알림 표시 성공 확인됨 - 사용자 확인 요청 스킵")
                    return
                }

                print("🚨 [FCM] FCM 메시지가 수신되었지만 알림이 표시되지 않을 수 있습니다!")
                print("💡 [FCM] 즉시 다음 작업을 수행하세요:")
                print("   1. 화면 상단을 아래로 스와이프해서 Notification Center를 확인")
                print("   2. SMAP 앱의 알림이 있는지 확인")
                print("   3. 알림이 없으면 iOS 설정 > 알림 > SMAP 앱 설정 확인")
                print("   4. 아래 명령어로 수동 테스트:")
                print("      (UIApplication.shared.delegate as? AppDelegate)?.testFCMPushManually()")
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 13.0) {
                // 이미 알림 표시가 성공했다면 추가 확인 스킵
                if self.notificationDisplayedSuccessfully,
                   let currentId = self.currentFCMMessageId,
                   let lastId = self.lastProcessedFCMMessageId,
                   currentId == lastId {
                    print("✅ [FCM] 포그라운드 알림 표시 성공 확인됨 - 추가 확인 요청 스킵")
                    return
                }

                print("🚨 [FCM] 아직 알림이 표시되지 않았나요?")
                print("💡 [FCM] 다음 사항들을 확인하세요:")
                print("   • iOS 설정 > 알림 > SMAP > 알림 허용: 켜짐")
                print("   • iOS 설정 > 알림 > SMAP > 알림 표시: 켜짐")
                print("   • iOS 설정 > 알림 > SMAP > 배지: 켜짐")
                print("   • iOS 설정 > 알림 > SMAP > 소리: 켜짐")
                print("💡 [FCM] 설정이 모두 정상이라면 FCM 토큰 문제가 있을 수 있습니다")
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 18.0) {
                print("🚨 [FCM] FCM 알림 표시 문제가 지속되면 다음을 시도하세요:")
                print("   1. 앱을 완전히 종료하고 다시 실행")
                print("   2. iOS 설정 > 일반 > 소프트웨어 업데이트 확인")
                print("   3. FCM 토큰 수동 리프레시:")
                print("      (UIApplication.shared.delegate as? AppDelegate)?.forceRefreshFCMServiceRegistration('')")
                print("   4. 알림 설정 재설정:")
                print("      iOS 설정 > 알림 > SMAP > 모두 끄고 다시 켜기")
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 25.0) {
                print("🚨 [FCM] 긴급: FCM 알림이 전혀 표시되지 않는 경우")
                print("💡 [FCM] 다음 단계별로 시도하세요:")
                print("   1️⃣ iOS 설정 > 알림 > SMAP 앱 선택")
                print("   2️⃣ 모든 스위치를 OFF로 설정")
                print("   3️⃣ 앱을 완전히 종료 (스와이프 업)")
                print("   4️⃣ 다시 앱 실행")
                print("   5️⃣ iOS 설정 > 알림 > SMAP에서 모든 스위치를 ON으로 설정")
                print("   6️⃣ FCM 테스트 메시지 다시 전송")
            }
        }

        // FCM 메시지 수신 시 현재 토큰 상태 확인
        Messaging.messaging().token { [weak self] currentToken, error in
            if let currentToken = currentToken {
                print("🔥 [메시지 수신 시] 현재 FCM 토큰: \(currentToken.prefix(30))...")

                // DB 토큰과 비교
                if let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") {
                    if currentToken == dbToken {
                        print("✅ [메시지 수신] 토큰 일치: FCM ↔ DB")
                    } else {
                        print("⚠️ [메시지 수신] 토큰 불일치!")
                        print("   📱 현재: \(currentToken.prefix(20))...")
                        print("   💾 DB: \(dbToken.prefix(20))...")

                        // 토큰 불일치 시 FCM 서비스 상태 확인
                        print("🔍 [FCM Debug] 토큰 불일치로 FCM 서비스 상태 확인")
                        self?.checkFCMServiceRegistrationStatus()

                        // FCM 푸시 표시 상태도 확인
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                            print("🔔 [FCM Debug] FCM 푸시 표시 상태 확인")
                            self?.checkFCMPushDisplayStatus()
                        }
                    }
                } else {
                    print("⚠️ [메시지 수신] DB 토큰 없음")
                }
            } else {
                print("❌ [메시지 수신] FCM 토큰 없음")
            }
        }

        // FCM 메시지 수신 카운터 증가
        let messageCount = UserDefaults.standard.integer(forKey: "fcm_message_received_count") + 1
        UserDefaults.standard.set(messageCount, forKey: "fcm_message_received_count")
        UserDefaults.standard.synchronize()

        print("📨 [FCM] FCM 메시지 수신 #\(messageCount)")
        print("═══════════════════════════════════════════════════════════════")

        // 메시지 데이터를 Dictionary로 변환
        var messageData: [String: Any] = [:]

        if let dict = remoteMessage as? [String: Any] {
            messageData = dict
            print("📨 [FCM] Dictionary 타입 메시지 수신")
        } else {
            // 다른 타입의 메시지를 Dictionary로 변환 시도
            messageData["raw_message"] = remoteMessage
            messageData["message_type"] = String(describing: type(of: remoteMessage))
            print("📨 [FCM] 기타 타입 메시지 수신: \(type(of: remoteMessage))")
        }

        // 메시지 내용 로깅
        print("📨 [FCM] 메시지 내용:")
        for (key, value) in messageData {
            print("   \(key): \(value)")
        }

        // 메시지 데이터를 UserDefaults에 저장 (디버깅용)
        UserDefaults.standard.set(messageData, forKey: "last_fcm_message")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_fcm_message_time")
        UserDefaults.standard.synchronize()

        // FCM 푸시 수신 성공 표시 (햅틱 피드백)
        DispatchQueue.main.async {
            let notificationFeedback = UINotificationFeedbackGenerator()
            notificationFeedback.notificationOccurred(.success)
        }

        print("✅ [FCM] FCM 메시지 수신 처리 완료")

        // NotificationCenter를 통해 메시지 전달 (순환 참조 방지)
        DispatchQueue.main.async {
            Utils.shared.sendFCMMessageToWebView(messageData)
        }
    }

    // MARK: - 🔍 FCM 디버그 및 수동 업데이트 (개발용)
    @objc func debugFCMTokenStatus() {
        print("🔍 [FCM DEBUG] FCM 토큰 상태 확인 시작")

        let fcmToken = Messaging.messaging().fcmToken
        let apnsToken = currentAPNSToken
        let storedToken = UserDefaults.standard.string(forKey: "fcm_token")
        let lastUpdatedToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token")

        print("🔍 [FCM DEBUG] 현재 FCM 토큰: \(fcmToken?.prefix(30) ?? "없음")")
        print("🔍 [FCM DEBUG] 저장된 FCM 토큰: \(storedToken?.prefix(30) ?? "없음")")
        print("🔍 [FCM DEBUG] 마지막 업데이트 토큰: \(lastUpdatedToken?.prefix(30) ?? "없음")")
        print("🔍 [FCM DEBUG] APNS 토큰: \(apnsToken?.prefix(30) ?? "없음")")

        // FCM 메시지 수신 통계
        let messageCount = UserDefaults.standard.integer(forKey: "fcm_message_received_count")
        let lastMessageTime = UserDefaults.standard.double(forKey: "last_fcm_message_time")

        print("🔍 [FCM DEBUG] FCM 메시지 수신 통계:")
        print("   - 총 수신 메시지 수: \(messageCount)")
        if lastMessageTime > 0 {
            let lastMessageDate = Date(timeIntervalSince1970: lastMessageTime)
            print("   - 마지막 메시지 수신: \(lastMessageDate)")
        } else {
            print("   - 마지막 메시지 수신: 없음")
        }

        // 권한 상태 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔍 [FCM DEBUG] 알림 권한 상태: \(settings.authorizationStatus.rawValue)")
                print("🔍 [FCM DEBUG] 알림 권한: \(settings.authorizationStatus == .authorized ? "허용" : "거부")")
                print("🔍 [FCM DEBUG] 소리 권한: \(settings.soundSetting.rawValue)")
                print("🔍 [FCM DEBUG] 배지 권한: \(settings.badgeSetting.rawValue)")
                print("🔍 [FCM DEBUG] 배너 권한: \(settings.alertSetting.rawValue)")
            }
        }
    }

    @objc func forceUpdateFCMTokenDebug() {
        print("🔄 [FCM DEBUG] FCM 토큰 강제 업데이트 시작 (디버그용)")

        if let fcmToken = Messaging.messaging().fcmToken {
            print("🔄 [FCM DEBUG] 기존 FCM 토큰으로 서버 업데이트 시도")
            updateFCMTokenIfNeededWithCheck(token: fcmToken)
        } else {
            print("🔄 [FCM DEBUG] FCM 토큰이 없음 - 재생성 시도")
            Messaging.messaging().token { token, error in
                if let error = error {
                    print("❌ [FCM DEBUG] 토큰 재생성 실패: \(error)")
                } else if let token = token {
                    print("✅ [FCM DEBUG] 토큰 재생성 성공: \(token.prefix(30))...")
                    self.updateFCMTokenIfNeededWithCheck(token: token)
                }
            }
        }
    }

    // FCM 푸시 메시지 수신 테스트
    @objc func testFCMPushMessage() {
        print("🧪 [FCM TEST] FCM 푸시 메시지 수신 테스트 시작")

        // 현재 FCM 토큰 상태 확인
        let fcmToken = Messaging.messaging().fcmToken
        let storedToken = UserDefaults.standard.string(forKey: "fcm_token")

        print("🧪 [FCM TEST] FCM 토큰 상태:")
        print("   - 현재 토큰: \(fcmToken?.prefix(20) ?? "없음")...")
        print("   - 저장된 토큰: \(storedToken?.prefix(20) ?? "없음")...")

        // 토큰 일치 여부 확인
        if fcmToken == storedToken {
            print("✅ [FCM TEST] FCM 토큰 일치 - 푸시 메시지 수신 가능")
        } else {
            print("⚠️ [FCM TEST] FCM 토큰 불일치 - 토큰 업데이트 필요")
        }

        // FCM 메시지 수신 통계
        let messageCount = UserDefaults.standard.integer(forKey: "fcm_message_received_count")
        let lastMessageTime = UserDefaults.standard.double(forKey: "last_fcm_message_time")

        print("🧪 [FCM TEST] FCM 메시지 수신 상태:")
        print("   - 총 수신 메시지: \(messageCount)개")
        if lastMessageTime > 0 {
            let lastMessageDate = Date(timeIntervalSince1970: lastMessageTime)
            let timeSinceLastMessage = Date().timeIntervalSince(lastMessageDate)
            print("   - 마지막 메시지: \(Int(timeSinceLastMessage))초 전")
        }

        // 권한 상태 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🧪 [FCM TEST] 푸시 권한 상태:")
                print("   - 알림 권한: \(settings.authorizationStatus.rawValue) (\(settings.authorizationStatus == .authorized ? "허용" : "거부"))")
                print("   - 소리 권한: \(settings.soundSetting.rawValue)")
                print("   - 배지 권한: \(settings.badgeSetting.rawValue)")

                if settings.authorizationStatus == .authorized {
                    print("✅ [FCM TEST] 푸시 권한 정상 - FCM 메시지 수신 가능")
                } else {
                    print("❌ [FCM TEST] 푸시 권한 거부 - 설정에서 권한 허용 필요")
                }
            }
        }

        // FCM 자동 초기화 상태 확인
        print("🧪 [FCM TEST] FCM 설정 상태:")
        print("   - 자동 초기화: \(Messaging.messaging().isAutoInitEnabled)")
        print("   - APNS 토큰: \(self.currentAPNSToken?.prefix(20) ?? "없음")...")

        print("✅ [FCM TEST] FCM 푸시 메시지 수신 테스트 완료")
    }

    // FCM 토큰 유효성 검증
    @objc func validateFCMToken() {
        print("🔍 [FCM VALIDATION] FCM 토큰 유효성 검증 시작")

        guard let fcmToken = Messaging.messaging().fcmToken else {
            print("❌ [FCM VALIDATION] FCM 토큰이 없음")
            return
        }

        print("🔍 [FCM VALIDATION] FCM 토큰 검증: \(fcmToken.prefix(30))...")

        // 토큰 길이 검증
        if fcmToken.count < 100 {
            print("⚠️ [FCM VALIDATION] FCM 토큰 길이가 너무 짧음: \(fcmToken.count)자")
        } else if fcmToken.count > 300 {
            print("⚠️ [FCM VALIDATION] FCM 토큰 길이가 너무 김: \(fcmToken.count)자")
        } else {
            print("✅ [FCM VALIDATION] FCM 토큰 길이 정상: \(fcmToken.count)자")
        }

        // 토큰 형식 검증 (FCM 토큰은 일반적으로 특정 패턴을 따름)
        let tokenPattern = "^[a-zA-Z0-9_-]+$"
        if fcmToken.range(of: tokenPattern, options: .regularExpression) != nil {
            print("✅ [FCM VALIDATION] FCM 토큰 형식 정상")
        } else {
            print("⚠️ [FCM VALIDATION] FCM 토큰 형식이 비정상적")
        }

        // 저장된 토큰과 비교
        let storedToken = UserDefaults.standard.string(forKey: "fcm_token")
        if fcmToken == storedToken {
            print("✅ [FCM VALIDATION] FCM 토큰 일치 - 서버와 동기화됨")
        } else {
            print("⚠️ [FCM VALIDATION] FCM 토큰 불일치 - 서버 업데이트 필요")
            print("   - 현재 토큰: \(fcmToken.prefix(20))...")
            print("   - 저장 토큰: \(storedToken?.prefix(20) ?? "없음")...")
        }

        // 🔴 APNs 토큰 존재 여부 확인 (푸시 알림 필수)
        if let apnsToken = currentAPNSToken ?? UserDefaults.standard.string(forKey: "last_apns_token") {
            print("✅ [FCM VALIDATION] APNs 토큰 존재: \(apnsToken.prefix(20))...")
            print("📱 [FCM VALIDATION] FCM + APNs 모두 정상 - 푸시 알림 완벽 지원")
        } else {
            print("🚨 [FCM VALIDATION] APNs 토큰 없음 - 푸시 메시지 수신 불가")
            print("📱 [FCM VALIDATION] FCM 토큰만 있어도 백그라운드 푸시는 작동하나, 포그라운드 푸시는 제한됨")
            print("🔧 [FCM VALIDATION] 해결 방법: 앱 설정 > 알림 > [앱명] 켜기")
        }

        print("✅ [FCM VALIDATION] FCM 토큰 유효성 검증 완료")
    }

    // MARK: - 📱 APNs 등록 완료 후 FCM 토큰 업데이트
    private func checkAndUpdateFCMTokenAfterAPNSRegistration() {
        print("🔍 [APNS+FCM] APNs 등록 후 FCM 토큰 상태 확인")

        // 백그라운드에서도 FCM 토큰 업데이트 허용 (푸시 수신 보장)
        let appState = UIApplication.shared.applicationState
        let isBackground = appState == .background

        if isBackground {
            print("🛡️ [APNS+FCM] 앱이 백그라운드 상태 - FCM 토큰 업데이트 허용 (푸시 수신 우선)")
        }

        // 사용자 식별 상태 확인
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                               UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if !hasUserIdentified {
            print("🔒 [APNS+FCM] 사용자 식별 안됨 - FCM 토큰 업데이트 대기")
            return
        }

        // FCM 토큰 확인 및 업데이트
        Messaging.messaging().token { [weak self] fcmToken, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [APNS+FCM] FCM 토큰 확인 실패: \(error.localizedDescription)")
                    return
                }

                guard let fcmToken = fcmToken, !fcmToken.isEmpty else {
                    print("❌ [APNS+FCM] FCM 토큰 없음")
                    return
                }

                print("✅ [APNS+FCM] FCM 토큰 확인 성공: \(fcmToken.prefix(20))...")

                // FCM 토큰 업데이트 실행 (APNs 토큰이 있으므로 무조건 성공)
                print("🚀 [APNS+FCM] FCM 토큰 서버 업데이트 시작")
                self?.updateFCMTokenIfNeededWithCheck(token: fcmToken)
            }
        }
    }

    // MARK: - 🔄 백그라운드 FCM 토큰 강제 갱신 (Silent Push 수신 시)
    @objc func forceRefreshFCMTokenInBackground() {
        print("🔄 [FCM BACKGROUND] 백그라운드 FCM 토큰 강제 갱신 시작")
        forceRefreshFCMTokenInBackgroundWithRetry(maxAttempts: 1)
    }

    @objc func forceRefreshFCMTokenInBackgroundWithRetry(maxAttempts: Int) {
        print("🔄 [FCM BACKGROUND] 백그라운드 FCM 토큰 강제 갱신 시작 (최대 시도: \(maxAttempts)회)")

        var attempts = 0

        func attemptTokenRefresh() {
            attempts += 1
            print("🔄 [FCM BACKGROUND] 토큰 갱신 시도 \(attempts)/\(maxAttempts)")

            // FCM 토큰 재생성 요청
            Messaging.messaging().token { [weak self] token, error in
                DispatchQueue.main.async {
                    if let error = error {
                        print("❌ [FCM BACKGROUND] FCM 토큰 재생성 실패 (시도 \(attempts)): \(error.localizedDescription)")

                        // 재시도 가능하면 다시 시도
                        if attempts < maxAttempts {
                            print("🔄 [FCM BACKGROUND] 재시도 대기 중...")
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                                attemptTokenRefresh()
                            }
                        } else {
                            print("❌ [FCM BACKGROUND] 모든 재시도 실패")
                        }
                        return
                    }

                    guard let newToken = token else {
                        print("❌ [FCM BACKGROUND] 새로운 FCM 토큰이 nil입니다 (시도 \(attempts))")

                        // 재시도 가능하면 다시 시도
                        if attempts < maxAttempts {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                                attemptTokenRefresh()
                            }
                        }
                        return
                    }

                    print("✅ [FCM BACKGROUND] 새로운 FCM 토큰 생성됨 (시도 \(attempts)): \(newToken.prefix(30))...")

                    // 기존 토큰과 비교
                    let existingToken = UserDefaults.standard.string(forKey: "fcm_token")
                    if existingToken == newToken {
                        print("ℹ️ [FCM BACKGROUND] 토큰이 변경되지 않음 - 업데이트 건너뜀")
                        return
                    }

                    print("🔄 [FCM BACKGROUND] 토큰 변경 감지 - 기존: \(existingToken?.prefix(15) ?? "없음"), 새 토큰: \(newToken.prefix(15))...")

                    // 토큰 저장
                    Utils.shared.setToken(token: newToken)
                    UserDefaults.standard.set(newToken, forKey: "fcm_token")
                    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_received_time")
                    UserDefaults.standard.set(newToken, forKey: "last_updated_fcm_token")
                    UserDefaults.standard.synchronize()

                    // FCM 토큰 변수 업데이트
                    self?.currentFCMToken = newToken

                    // 백그라운드에서도 서버 업데이트 수행
                    print("🔄 [FCM BACKGROUND] 백그라운드에서 서버 토큰 업데이트 시작")
                    self?.updateFCMTokenIfNeededWithCheck(token: newToken)

                    // 성공 햅틱 피드백 (백그라운드에서도 가능)
                    if let strongSelf = self {
                        let notificationFeedback = UINotificationFeedbackGenerator()
                        notificationFeedback.notificationOccurred(.success)
                    }

                    print("✅ [FCM BACKGROUND] FCM 토큰 강제 갱신 완료")
                }
            }
        }

        // 첫 번째 시도 시작
        attemptTokenRefresh()
    }

    // MARK: - 🔍 FCM 토큰 서버 업데이트 (푸시 메시지 수신을 위해 개선)
    private func updateFCMTokenIfNeededWithCheck(token: String) {
        // 업데이트 진행 중이면 건너뜀
        if isFCMUpdateInProgress {
            print("⏳ [FCM] 이미 업데이트가 진행 중 - 건너뜀")
            return
        }

        // ✅ 토큰 변경이 실제로 필요한지 확인
        let oldToken = UserDefaults.standard.string(forKey: "fcm_token")
        let hasTokenChanged = oldToken != token
        let hasNoSavedToken = oldToken == nil

        // 토큰이 변경되었거나 저장된 토큰이 없는 경우에만 업데이트
        guard hasTokenChanged || hasNoSavedToken else {
            print("ℹ️ [FCM] FCM 토큰이 변경되지 않음 - 서버 업데이트 스킵")
            return
        }

        print("🔄 [FCM] FCM 토큰 변경 감지")
        print("   📱 이전 토큰: \(oldToken?.prefix(20) ?? "없음")...")
        print("   🆕 새 토큰: \(token.prefix(20))...")
        print("   🔄 변경 이유: \(hasNoSavedToken ? "토큰 없음" : "토큰 변경")")

        print("✅ [FCM] FCM 토큰 서버 업데이트 시작: \(token.prefix(20))...")
        isFCMUpdateInProgress = true

        // 🔄 서버 업데이트 수행 (강제 업데이트 모드)
        sendFCMTokenToServer(token: token) { success in
            DispatchQueue.main.async {
                self.isFCMUpdateInProgress = false
                if success {
                    // ✅ 성공 시 로컬 저장
                    self.lastFCMTokenUpdateTime = Date()
                    UserDefaults.standard.set(token, forKey: "fcm_token")
                    UserDefaults.standard.set(token, forKey: "last_updated_fcm_token")
                    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_updated_time")
                    UserDefaults.standard.synchronize()

                    print("✅ [FCM] FCM 토큰 서버 업데이트 성공")
                    print("💾 [FCM] 로컬 저장소 업데이트 완료")
                } else {
                    print("❌ [FCM] FCM 토큰 서버 업데이트 실패")
                    print("🔄 [FCM] 다음 기회에 다시 시도합니다")

                    // 실패 시에도 로컬에 저장 (다음 성공 시 동기화)
                    UserDefaults.standard.set(token, forKey: "pending_fcm_token")
                    UserDefaults.standard.synchronize()
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
        let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        print("🚀 [FCM-API][\(timestamp)] FCM 토큰 서버 업데이트 시작")

        // 📱 앱 상태 확인 - 백그라운드에서도 토큰 업데이트 허용
        let appState = UIApplication.shared.applicationState
        let isBackground = appState == .background

        self.fcmLog("📱 앱 상태: \(isBackground ? "백그라운드" : "포그라운드") - 토큰 업데이트 허용")

        // 🚫 사용자가 식별되지 않았으면(mt_idx 없음) 업데이트하지 않음
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if !hasUserIdentified {
            self.fcmLog("🚫 사용자가 식별되지 않음(mt_idx 없음) - FCM 토큰 업데이트 건너뜀")
            completion(false)
            return
        }

        // ✅ FCM 토큰 변경 방지 로직 - 자동 동기화를 위해 제거
        // 토큰 동기화가 우선이므로 변경 방지 로직을 비활성화
        print("🔄 [FCM API] 토큰 자동 동기화 모드 - 변경 방지 로직 건너뜀")

        // UserDefaults에서 mt_idx 가져오기 (여러 키에서 시도)
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")

        guard let mtIdx = mtIdx, !mtIdx.isEmpty else {
            print("❌ [FCM API] 로그인 상태이지만 mt_idx를 찾을 수 없음 - 업데이트 건너뜀")
            completion(false)
            return
        }
        
        print("✅ [FCM API] mt_idx 발견: \(mtIdx)")
        
        // 🔗 APNs 토큰도 함께 전송 (필수)
        var requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token
        ]

        // 🔴 APNs 토큰 확인 (백그라운드에서는 UserDefaults 우선 사용)
        var apnsToken = currentAPNSToken ?? UserDefaults.standard.string(forKey: "last_apns_token")

        // 백그라운드에서 APNs 토큰이 없으면 재시도 (한 번 더 확인)
        if apnsToken == nil && isBackground {
            print("⚠️ [FCM API] 백그라운드에서 APNs 토큰 없음 - 재확인 시도")

            // 잠시 대기 후 재시도
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                let retryApnsToken = UserDefaults.standard.string(forKey: "last_apns_token") ??
                                   UserDefaults.standard.string(forKey: "apns_token_backup")

                if let retryToken = retryApnsToken {
                    print("✅ [FCM API] 백그라운드에서 APNs 토큰 재발견: \(retryToken.prefix(20))...")
                    self.sendFCMTokenToServerWithApnsToken(token, apnsToken: retryToken, completion: completion)
                } else {
                    print("❌ [FCM API] 백그라운드에서 APNs 토큰 재발견 실패 - 토큰만 전송")
                    self.sendFCMTokenToServerWithoutApnsToken(token, completion: completion)
                }
            }
            return
        }

        // 일반적인 경우 APNs 토큰 확인
        guard let finalApnsToken = apnsToken else {
            print("❌ [FCM API] APNs 토큰 없음 - FCM 토큰 업데이트 취소")
            print("📱 [FCM API] APNs 토큰이 있어야 푸시 알림이 정상 작동합니다")
            completion(false)
            return
        }

        requestData["apns_token"] = finalApnsToken
        print("📱 [FCM API] APNs 토큰 함께 전송: \(finalApnsToken.prefix(20))...")

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
                guard let self = self else {
                    print("❌ [FCM API] self가 nil입니다 - 클로저 실행 중단")
                    return
                }

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

                let responseTimestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
                print("📡 [FCM-API][\(responseTimestamp)] HTTP 상태 코드: \(httpResponse.statusCode)")

                if let data = data, let responseString = String(data: data, encoding: .utf8) {
                    self.fcmLog("📨 서버 응답: \(responseString)")
                }

                if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                    self.fcmLog("✅ FCM 토큰 서버 업데이트 성공!")

                    // 🔒 업데이트 진행 중 플래그 해제
                    UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                    UserDefaults.standard.synchronize()
                    self.fcmLog("🔓 FCM 토큰 업데이트 완료로 인한 플래그 해제됨")

                    // 성공 completion 호출
                    completion(true)
                } else {
                    self.fcmLog("❌ FCM 토큰 서버 업데이트 실패 - 상태 코드: \(httpResponse.statusCode)")

                    // 🔒 실패 시에도 플래그 해제
                    UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                    UserDefaults.standard.synchronize()
                    self.fcmLog("🔓 FCM 토큰 업데이트 실패로 인한 플래그 해제됨")

                    // 실패 completion 호출
                    completion(false)
                }
            }
        }
        
        task.resume()
    }
    

    
    // MARK: - 🔄 임시 저장된 FCM 토큰 서버 전송
    private func sendPendingFCMTokenToServer(pendingToken: String) {
        print("📤 [FCM Pending] 임시 저장된 FCM 토큰 서버 전송 시작")
        print("📤 [FCM Pending] 토큰: \(pendingToken.prefix(30))...")

        // 🚫 백그라운드에서는 업데이트하지 않음
        let appState = UIApplication.shared.applicationState
        let isBackground = appState == .background

        if isBackground {
            print("🔒 [FCM Pending] 앱이 백그라운드 상태 - 서버 전송 스킵")
            return
        }

        // UserDefaults에서 mt_idx 가져오기 (사용자 식별 확인)
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")

        guard let mtIdx = mtIdx, !mtIdx.isEmpty else {
            print("❌ [FCM Pending] mt_idx를 찾을 수 없음(사용자 미식별) - 서버 전송 실패")
            // mt_idx가 없는 경우 재시도용으로 저장
            UserDefaults.standard.set(pendingToken, forKey: "retry_pending_fcm_token")
            UserDefaults.standard.synchronize()
            print("🔄 [FCM Pending] 재시도용으로 토큰 저장됨")
            return
        }

        print("✅ [FCM Pending] 사용자 식별됨(mt_idx: \(mtIdx))")

        // 🔗 APNs 토큰도 함께 전송 (필수)
        var requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": pendingToken
        ]

        // 🔴 APNs 토큰 필수 확인 (푸시 알림을 위해 반드시 필요)
        guard let apnsToken = currentAPNSToken ?? UserDefaults.standard.string(forKey: "last_apns_token") else {
            print("❌ [FCM Pending] APNs 토큰 없음 - FCM 토큰 업데이트 취소")
            print("📱 [FCM Pending] APNs 토큰이 있어야 푸시 알림이 정상 작동합니다")
            // 재시도용으로 저장
            UserDefaults.standard.set(pendingToken, forKey: "retry_pending_fcm_token")
            UserDefaults.standard.synchronize()
            return
        }

        requestData["apns_token"] = apnsToken
        print("📱 [FCM Pending] APNs 토큰 함께 전송: \(apnsToken.prefix(20))...")

        // JSON 데이터로 변환
        guard let jsonData = try? JSONSerialization.data(withJSONObject: requestData) else {
            print("❌ [FCM Pending] JSON 데이터 변환 실패")
            return
        }

        // API URL 구성
        let urlString = Http.shared.BASE_URL + Http.shared.memberFcmTokenUrl
        guard let url = URL(string: urlString) else {
            print("❌ [FCM Pending] 잘못된 URL: \(urlString)")
            return
        }

        print("🌐 [FCM Pending] 요청 URL: \(urlString)")

        // URLRequest 구성
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData

        // URLSession으로 API 호출
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM Pending] 네트워크 오류: \(error.localizedDescription)")
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ [FCM Pending] HTTP 응답이 아님")
                    return
                }

                print("🌐 [FCM Pending] HTTP 상태 코드: \(httpResponse.statusCode)")

                if httpResponse.statusCode == 200 {
                    print("✅ [FCM Pending] 임시 저장된 FCM 토큰 서버 전송 성공")

                    // 성공 시 로컬 저장소 업데이트
                    UserDefaults.standard.set(pendingToken, forKey: "last_updated_fcm_token")
                    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_updated_time")
                    UserDefaults.standard.synchronize()

                    print("💾 [FCM Pending] 로컬 저장소 업데이트 완료")
                } else {
                    print("❌ [FCM Pending] 서버 응답 실패: \(httpResponse.statusCode)")

                    // 실패 시 재시도 플래그 설정
                    UserDefaults.standard.set(pendingToken, forKey: "retry_pending_fcm_token")
                    UserDefaults.standard.synchronize()
                }
            }
        }
        task.resume()
    }

    // MARK: - 🔔 FCM 자동 업데이트 시작 (사용자 식별 완료 시 호출)
    @objc func startFCMAutoUpdateAfterUserIdentified() {
        print("🚀 [FCM Auto] 사용자 식별 완료 - FCM 자동 업데이트 시작")

        // 🔍 사용자 식별 전에 저장된 FCM 토큰이 있는지 확인
        if let pendingToken = UserDefaults.standard.string(forKey: "pending_fcm_token_after_user_identified") {
            print("🔄 [FCM Auto] 사용자 식별 전 임시 저장된 FCM 토큰 발견: \(pendingToken.prefix(30))...")
            print("📤 [FCM Auto] 임시 저장된 토큰을 서버로 전송")

            // 임시 저장된 토큰을 서버로 전송
            sendPendingFCMTokenToServer(pendingToken: pendingToken)

            // 임시 토큰 제거
            UserDefaults.standard.removeObject(forKey: "pending_fcm_token_after_user_identified")
            UserDefaults.standard.synchronize()
        } else {
            print("ℹ️ [FCM Auto] 사용자 식별 전 임시 저장된 FCM 토큰 없음")
        }

        // 🔄 이전에 실패한 토큰 재시도 확인
        if let retryToken = UserDefaults.standard.string(forKey: "retry_pending_fcm_token") {
            print("🔄 [FCM Auto] 이전에 실패한 FCM 토큰 재시도: \(retryToken.prefix(30))...")
            print("📤 [FCM Auto] 실패한 토큰 재전송")

            // 실패한 토큰 재전송
            sendPendingFCMTokenToServer(pendingToken: retryToken)

            // 재시도 토큰 제거
            UserDefaults.standard.removeObject(forKey: "retry_pending_fcm_token")
            UserDefaults.standard.synchronize()
        }

        // 🚨 사용자 식별 완료 시 FCM 토큰 강제 업데이트 (타이머 제거됨)
        print("🚨 [FCM Auto] 사용자 식별 완료 - FCM 토큰 강제 업데이트 실행")

        // 🔍 실제 토큰 변경이 있는 경우에만 강제 업데이트
        Messaging.messaging().token { [weak self] currentToken, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM Auto] FCM 토큰 확인 실패: \(error.localizedDescription)")
                    return
                }

                guard let currentToken = currentToken, !currentToken.isEmpty else {
                    print("❌ [FCM Auto] FCM 토큰 없음")
                    return
                }

                let savedToken = UserDefaults.standard.string(forKey: "fcm_token")
                let hasTokenChanged = savedToken != currentToken

                print("🔍 [FCM Auto] 최종 토큰 변경 확인:")
                print("   저장된 토큰: \(savedToken?.prefix(20) ?? "없음")...")
                print("   현재 토큰: \(currentToken.prefix(20))...")
                print("   토큰 변경됨: \(hasTokenChanged)")

                if hasTokenChanged {
                    print("🔄 [FCM Auto] 토큰이 변경됨 - 강제 업데이트 진행")
                    self?.forceUpdateFCMTokenMain()
                } else {
                    print("ℹ️ [FCM Auto] 토큰이 변경되지 않음 - 강제 업데이트 스킵")
                }
            }
        }

        // 타이머 기반 자동 업데이트 제거됨
    }
    
    // MARK: - 🔔 사용자 정보 저장 시 FCM 토큰 업데이트 (MainView에서 호출)
    @objc func onUserInfoSaved() {
        print("👤 [FCM USER] 사용자 정보 저장 감지 - FCM 토큰 업데이트 트리거")
        
        // 사용자 정보가 저장된 후 토큰 변경 여부 확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            Messaging.messaging().token { [weak self] currentToken, error in
                DispatchQueue.main.async {
                    if let error = error {
                        print("❌ [FCM USER] FCM 토큰 확인 실패: \(error.localizedDescription)")
                        return
                    }

                    guard let currentToken = currentToken, !currentToken.isEmpty else {
                        print("❌ [FCM USER] FCM 토큰 없음")
                        return
                    }

                    let savedToken = UserDefaults.standard.string(forKey: "fcm_token")
                    let hasTokenChanged = savedToken != currentToken

                    print("🔍 [FCM USER] 토큰 변경 확인:")
                    print("   저장된 토큰: \(savedToken?.prefix(20) ?? "없음")...")
                    print("   현재 토큰: \(currentToken.prefix(20))...")
                    print("   토큰 변경됨: \(hasTokenChanged)")

                    if hasTokenChanged {
                        print("🚨 [FCM USER] 토큰이 변경됨 - 업데이트 실행")
                        self?.startFCMAutoUpdateAfterUserIdentified()
                    } else {
                        print("ℹ️ [FCM USER] 토큰이 변경되지 않음 - 업데이트 스킵")
                    }
                }
            }
        }
    }
    
    // MARK: - 🔔 FCM 토큰 강제 업데이트 (메인용)
    @objc func forceUpdateFCMTokenMain() {
        print("🚨 [FCM FORCE] FCM 토큰 강제 업데이트 시작 (메인)")

        // 현재 FCM 토큰 가져와서 바로 업데이트 (이미 변경 확인됨)
        Messaging.messaging().token { [weak self] currentToken, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM FORCE] FCM 토큰 확인 실패: \(error.localizedDescription)")
                    return
                }

                guard let currentToken = currentToken, !currentToken.isEmpty else {
                    print("❌ [FCM FORCE] FCM 토큰 없음")
                    return
                }

                print("🔄 [FCM FORCE] 토큰 확인됨 - 바로 업데이트 진행: \(currentToken.prefix(20))...")
                self?.updateFCMTokenIfNeededWithCheck(token: currentToken)
            }
        }
    }
    
    // MARK: - 🔔 FCM 토큰 즉시 업데이트 (디버깅용)
    @objc func updateFCMTokenNow() {
        print("🚨 [FCM NOW] FCM 토큰 즉시 업데이트 실행")
        
        // 저장된 토큰 초기화
        UserDefaults.standard.removeObject(forKey: "last_fcm_token")
        UserDefaults.standard.synchronize()
        print("🗑️ [FCM NOW] 저장된 토큰 초기화 완료")
        
        // 즉시 FCM 토큰 업데이트 실행
        updateFCMTokenIfNeededWithFetch()
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
        
        // API 요청 데이터 준비 (register 엔드포인트용 - 간단하게)
        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token
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
        print("🌙 [APP STATE] 백그라운드 진입")
        
        // 백그라운드 상태로 설정
        isAppInBackground = true
        
        let userInfo: [AnyHashable: Any] = ["state": "background"]
        NotificationCenter.default.post(name: Notification.Name("appStateChange"), object: nil, userInfo: userInfo)

        // 로그인 상태일 때만 FCM 토큰 관리
        if UserDefaults.standard.bool(forKey: "is_logged_in") {
            print("🔍 [FCM] 백그라운드 진입 - FCM 토큰 DB 확인")
            checkAndUpdateFCMTokenFromDB()
        }

        // 백그라운드 진입 시 FCM 토큰 상태 확인 및 갱신 준비
        print("🔄 [FCM] 백그라운드 진입 - FCM 토큰 상태 준비")
        setupBackgroundFCMTokenManagement()
        
        // 백그라운드 연결 유지 시작
        startBackgroundKeepAlive()

        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }
    
    func applicationWillEnterForeground(_ application: UIApplication) {
        UIApplication.shared.applicationIconBadgeNumber = 0

        let userInfo: [AnyHashable: Any] = ["state": "foreground"]

        NotificationCenter.default.post(name: Notification.Name("appStateChange"), object: nil, userInfo: userInfo)
        NotificationCenter.default.post(name: Notification.Name("appStateForeground"), object: nil, userInfo: nil)

        // ✅ 포그라운드 진입 시 토큰 상태 관리

        // 백그라운드 연결 유지 중단
        stopBackgroundKeepAlive()
        isAppInBackground = false
        
        // 포그라운드 진입 시 FCM 토큰 상태 확인
        if UserDefaults.standard.bool(forKey: "is_logged_in") {
            print("🔍 [FCM] 포그라운드 진입 - FCM 토큰 DB 확인")
            checkAndUpdateFCMTokenFromDB()

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

        // 백엔드 FCM 토큰 검증 API 사용
        var baseUrl = Http.shared.BASE_URL

        // BASE_URL에 이미 /api가 포함되어 있는지 확인하고 중복 방지
        if baseUrl.hasSuffix("/api/") {
            baseUrl = String(baseUrl.dropLast(5)) // "/api/" 제거
            print("🔧 [FCM] BASE_URL에서 '/api/' 제거: \(baseUrl)")
        } else if baseUrl.hasSuffix("/api") {
            baseUrl = String(baseUrl.dropLast(4)) // "/api" 제거
            print("🔧 [FCM] BASE_URL에서 '/api' 제거: \(baseUrl)")
        }

        let urlString = "\(baseUrl)/api/v1/member-fcm-token/background-check"
        guard let url = URL(string: urlString) else {
            print("❌ [FCM] 백그라운드 검증 실패 - 잘못된 URL: \(urlString)")
            return
        }

        print("🔗 [FCM] 백그라운드 검증 URL: \(urlString)")
        print("📋 [FCM] BASE_URL 원본: \(Http.shared.BASE_URL)")
        print("📋 [FCM] BASE_URL 수정 후: \(baseUrl)")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // FCM 토큰 변경 감지 및 서버 업데이트 강제
        let currentToken = UserDefaults.standard.string(forKey: "fcm_token")
        let isTokenChanged = currentToken != token

        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token,
            "check_type": "background",
            "force_refresh": isTokenChanged // 토큰 변경 시 서버 업데이트 강제
        ]

        if isTokenChanged {
            print("🔄 [FCM Background] 토큰 변경 감지 - 서버 업데이트 강제 적용")
            print("   📱 현재 토큰: \(token.prefix(20))...")
            print("   💾 저장 토큰: \(currentToken?.prefix(20) ?? "없음")...")
        }

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
                        let successTimestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
                        print("✅ [FCM-BG-VERIFY][\(successTimestamp)] 백그라운드 FCM 토큰 검증 성공")

                        // 응답 데이터 확인 (토큰 갱신 여부)
                        if let data = data {
                            do {
                                if let jsonResponse = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                                   let success = jsonResponse["success"] as? Bool, success,
                                   let message = jsonResponse["message"] as? String {
                                    print("📋 [FCM] 백그라운드 검증 응답: \(message)")

                                    // 토큰이 갱신된 경우 로컬에도 업데이트
                                    if message.contains("갱신") || message.contains("변경") {
                                        print("🔄 [FCM Background] 백그라운드 토큰 변경 감지 - 로컬 업데이트")
                                        UserDefaults.standard.set(token, forKey: "fcm_token")
                                        UserDefaults.standard.set(token, forKey: "last_updated_fcm_token")
                                        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_received_time")
                                        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_fcm_token_update_time")
                                        UserDefaults.standard.synchronize()

                                        // FCM 서비스 재등록 강제 실행 (백그라운드 푸시 수신 보장)
                                        DispatchQueue.main.async {
                                            print("🔥 [FCM Background] 백그라운드 FCM 서비스 재등록 강제 실행")
                                            self.forceRefreshFCMServiceRegistration(token)

                                            // FCM 서비스 재등록 후 안전한 토큰 업데이트 수행
                                            self.safelyUpdateFCMToken(token) { success in
                                                if success {
                                                    print("✅ [FCM Background] 백그라운드 토큰 안전 업데이트 성공")

                                                    // 토큰 업데이트 성공 후 FCM 서비스 상태 확인
                                                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                                                        print("🔍 [FCM Debug] 백그라운드 토큰 업데이트 성공 후 FCM 서비스 상태 확인")
                                                        self.checkFCMServiceRegistrationStatus()
                                                    }
                                                } else {
                                                    print("❌ [FCM Background] 백그라운드 토큰 안전 업데이트 실패")

                                                    // 토큰 업데이트 실패 후 FCM 서비스 상태 확인
                                                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                                                        print("🔍 [FCM Debug] 백그라운드 토큰 업데이트 실패 후 FCM 서비스 상태 확인")
                                                        self.checkFCMServiceRegistrationStatus()
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch {
                                print("❌ [FCM] 백그라운드 검증 응답 파싱 오류: \(error.localizedDescription)")
                            }
                        }
                    } else {
                        let failTimestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
                        print("⚠️ [FCM-BG-VERIFY][\(failTimestamp)] 백그라운드 FCM 토큰 검증 실패 - 상태 코드: \(httpResponse.statusCode)")
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

    private func showLocalNotificationForFCMMessage(_ userInfo: [AnyHashable: Any]) {
        print("🔔 [FCM Local] FCM 메시지를 위한 로컬 알림 표시")

        // FCM 메시지에서 알림 데이터를 추출
        var title = "알림"
        var body = ""

        // aps.alert에서 데이터 추출
        if let aps = userInfo["aps"] as? [String: Any],
           let alert = aps["alert"] as? [String: Any] {
            title = alert["title"] as? String ?? userInfo["title"] as? String ?? "알림"
            body = alert["body"] as? String ?? userInfo["body"] as? String ?? ""
        } else {
            // data 필드에서 직접 추출
            title = userInfo["title"] as? String ?? "알림"
            body = userInfo["body"] as? String ?? ""
        }

        print("📨 [FCM Local] 알림 제목: \(title)")
        print("📨 [FCM Local] 알림 내용: \(body)")

        // 로컬 알림 생성
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)

        // FCM 메시지 ID를 식별자로 사용
        let messageId = userInfo["gcm.message_id"] as? String ??
                       userInfo["google.c.fid"] as? String ??
                       UUID().uuidString

        // 중복 로컬 알림 방지 - 이미 FCM이 자동으로 알림을 표시하므로 로컬 알림 생성 비활성화
        print("🚫 [FCM Local] 중복 방지를 위해 로컬 알림 생성 건너뛰기 - 원본 FCM 알림 사용")
        print("📝 [FCM Local] 메시지 ID: \(messageId) - 로컬 알림 생성하지 않음")
    }

    // MARK: - 🔄 FCM 토큰 DB 확인 및 업데이트
    private func checkAndUpdateFCMTokenFromDB() {
        print("🔍 [FCM DB] FCM 토큰 DB 확인 및 업데이트 시작")

        // 로그인 상태 확인
        guard UserDefaults.standard.bool(forKey: "is_logged_in") else {
            print("🔒 [FCM DB] 로그인 상태가 아님 - FCM 토큰 확인 건너뜀")
            return
        }

        // mt_idx 확인
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")

        guard let userIdx = mtIdx, !userIdx.isEmpty else {
            print("❌ [FCM DB] 사용자 ID(mt_idx) 없음 - FCM 토큰 확인 건너뜀")
            return
        }

        print("👤 [FCM DB] 사용자 ID: \(userIdx)")

        // 현재 iOS 기기의 FCM 토큰 확인
        let currentDeviceToken = UserDefaults.standard.string(forKey: "fcm_token") ??
                               UserDefaults.standard.string(forKey: "last_fcm_token") ??
                               UserDefaults.standard.string(forKey: "last_updated_fcm_token")

        guard let deviceToken = currentDeviceToken, !deviceToken.isEmpty else {
            print("❌ [FCM DB] iOS 기기 FCM 토큰 없음 - 토큰 확인 건너뜀")
            return
        }

        print("📱 [FCM DB] iOS 기기 FCM 토큰: \(deviceToken.prefix(30))...")

        // DB에서 FCM 토큰 조회 요청
        fetchFCMTokenFromDB(mtIdx: userIdx, deviceToken: deviceToken)
    }

    private func fetchFCMTokenFromDB(mtIdx: String, deviceToken: String) {
        print("🌐 [FCM DB] DB에서 FCM 토큰 조회 요청")
        print("📡 [FCM DB] 사용자 ID: \(mtIdx)")

        // API URL 구성 - BASE_URL 중복 방지
        var baseUrl = Http.shared.BASE_URL

        // BASE_URL에 이미 /api가 포함되어 있는지 확인하고 중복 방지
        if baseUrl.hasSuffix("/api/") {
            baseUrl = String(baseUrl.dropLast(5)) // "/api/" 제거
            print("🔧 [FCM DB] BASE_URL에서 '/api/' 제거: \(baseUrl)")
        } else if baseUrl.hasSuffix("/api") {
            baseUrl = String(baseUrl.dropLast(4)) // "/api" 제거
            print("🔧 [FCM DB] BASE_URL에서 '/api' 제거: \(baseUrl)")
        }

        let validateUrl = "\(baseUrl)/api/v1/member-fcm-token/validate-and-refresh"

        guard let url = URL(string: validateUrl) else {
            print("❌ [FCM DB] 잘못된 API URL: \(validateUrl)")
            return
        }

        print("🔗 [FCM DB] FCM 토큰 검증 URL: \(validateUrl)")

        // 요청 데이터 구성 - 백엔드 API 스키마에 맞게 수정
        guard let mtIdxInt = Int(mtIdx) else {
            print("❌ [FCM DB] mt_idx를 숫자로 변환할 수 없음: \(mtIdx)")
            return
        }

        let requestData: [String: Any] = [
            "mt_idx": mtIdxInt,  // int 타입으로 변환
            "fcm_token": deviceToken  // 올바른 필드명 사용
        ]

        // JSON 데이터로 변환
        guard let jsonData = try? JSONSerialization.data(withJSONObject: requestData) else {
            print("❌ [FCM DB] JSON 데이터 변환 실패")
            return
        }

        // URLRequest 구성
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData

        print("📤 [FCM DB] 요청 데이터: \(requestData)")

        // API 호출
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM DB] FCM 토큰 조회 요청 실패: \(error.localizedDescription)")
                    self?.handleFCMTokenDBCheckFailure()
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ [FCM DB] HTTP 응답이 아님")
                    self?.handleFCMTokenDBCheckFailure()
                    return
                }

                print("📡 [FCM DB] FCM 토큰 조회 응답 코드: \(httpResponse.statusCode)")

                if httpResponse.statusCode == 200,
                   let data = data {
                    self?.handleFCMTokenDBCheckSuccess(data: data, deviceToken: deviceToken)
                } else {
                    print("❌ [FCM DB] FCM 토큰 조회 실패 - 상태 코드: \(httpResponse.statusCode)")
                    if let responseData = data,
                       let responseString = String(data: responseData, encoding: .utf8) {
                        print("📨 [FCM DB] 서버 응답: \(responseString)")
                    }
                    self?.handleFCMTokenDBCheckFailure()
                }
            }
        }

        task.resume()
    }

    private func handleFCMTokenDBCheckSuccess(data: Data, deviceToken: String) {
        do {
            if let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                print("✅ [FCM DB] FCM 토큰 조회 성공")
                print("📨 [FCM DB] 서버 응답: \(json)")

                // 백엔드 API 응답에서 토큰 정보 추출
                // validate-and-refresh API는 token_preview만 반환하므로
                // DB 토큰 정보를 직접 얻을 수 없음
                // 대신 has_token과 success 상태로 토큰 존재 여부 판단
                let hasToken = json["has_token"] as? Bool ?? false
                let success = json["success"] as? Bool ?? false
                let message = json["message"] as? String ?? ""

                print("📊 [FCM DB] API 응답 분석:")
                print("   - success: \(success)")
                print("   - has_token: \(hasToken)")
                print("   - message: \(message)")

                // 토큰이 없거나 API 호출이 실패한 경우
                if !success || !hasToken {
                    print("⚠️ [FCM DB] DB에 유효한 FCM 토큰이 없음")
                    print("🔄 [FCM DB] 새로운 FCM 토큰 등록 시작")

                    // 토큰이 없으면 새로 등록
                    self.sendFCMTokenToServer(token: deviceToken) { success in
                        if success {
                            print("✅ [FCM DB] FCM 토큰 신규 등록 성공")
                        } else {
                            print("❌ [FCM DB] FCM 토큰 신규 등록 실패")
                        }
                    }
                } else {
                    // 토큰이 존재하는 경우 - 별도 검증 필요 없음
                    print("✅ [FCM DB] DB에 유효한 FCM 토큰 존재 확인")
                    print("🔄 [FCM DB] 추가 토큰 검증 불필요")

                    // 백엔드에서 토큰이 유효하다고 확인되었으므로
                    // 추가적인 토큰 비교나 업데이트는 필요하지 않음
                }

                // 토큰 검증 성공 알림
                NotificationCenter.default.post(name: Notification.Name("fcmTokenDBVerified"), object: nil, userInfo: [
                    "device_token": deviceToken,
                    "has_server_token": hasToken,
                    "verification_success": success
                ])

            } else {
                print("❌ [FCM DB] 서버 응답 JSON 파싱 실패")
                self.handleFCMTokenDBCheckFailure()
            }

        } catch {
            print("❌ [FCM DB] FCM 토큰 응답 파싱 실패: \(error.localizedDescription)")
            self.handleFCMTokenDBCheckFailure()
        }
    }

    private func handleFCMTokenDBCheckFailure() {
        print("⚠️ [FCM DB] FCM 토큰 DB 확인 실패")
        print("💡 [FCM DB] 다음 앱 상태 변경 시 다시 시도됩니다")

        // 실패 카운트 증가 (과도한 재시도 방지)
        let failureCount = UserDefaults.standard.integer(forKey: "fcm_db_check_failures") + 1
        UserDefaults.standard.set(failureCount, forKey: "fcm_db_check_failures")
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_fcm_db_check_failure")
        UserDefaults.standard.synchronize()

        if failureCount >= 5 {
            print("🚨 [FCM DB] FCM 토큰 DB 확인 실패가 5회 이상 누적됨")
            print("💡 [FCM DB] 네트워크 연결을 확인해주세요")
        }
    }

    // MARK: - 🔍 FCM 토큰 수신 진단
    private func diagnoseFCMTokenReception() {
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║ 🔍 [FCM 진단] FCM 토큰 수신 상태 종합 진단                     ║")
        print("╚══════════════════════════════════════════════════════════════╝")

        // 1. FCM 토큰 상태 확인
        print("\n📱 1. FCM 토큰 상태:")
        if let token = UserDefaults.standard.string(forKey: "fcm_token") {
            print("   ✅ FCM 토큰 존재: \(token.prefix(30))... (길이: \(token.count))")
        } else {
            print("   ❌ FCM 토큰 없음")
        }

        if let lastUpdated = UserDefaults.standard.double(forKey: "last_fcm_token_update_time") as Double? {
            let timeAgo = Date().timeIntervalSince1970 - lastUpdated
            print("   ⏰ 마지막 토큰 업데이트: \(Int(timeAgo))초 전")
        }

        // 2. 최근 FCM 메시지 확인
        print("\n📨 2. 최근 FCM 메시지:")
        if let lastMessage = UserDefaults.standard.dictionary(forKey: "last_fcm_message") {
            print("   ✅ 최근 메시지 존재")
            print("   🔍 메시지 키들: \(lastMessage.keys.sorted())")
            if let timestamp = UserDefaults.standard.double(forKey: "last_fcm_message_time") as Double? {
                let timeAgo = Date().timeIntervalSince1970 - timestamp
                print("   ⏰ 메시지 수신 시간: \(Int(timeAgo))초 전")
            }
        } else {
            print("   ❌ 최근 FCM 메시지 없음")
        }

        // 3. 푸시 권한 상태 확인
        print("\n🔔 3. 푸시 알림 권한:")
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("   📱 권한 상태: \(settings.authorizationStatus)")
                print("   🔕 알림 표시: \(settings.alertSetting)")
                print("   🔊 소리: \(settings.soundSetting)")
                print("   🔴 배지: \(settings.badgeSetting)")
            }
        }

        // 4. FCM 서비스 상태 확인
        print("\n🔥 4. FCM 서비스 상태:")
        if Messaging.messaging().isAutoInitEnabled {
            print("   ✅ FCM 자동 초기화 활성화됨")
        } else {
            print("   ❌ FCM 자동 초기화 비활성화됨")
        }

        if Messaging.messaging().delegate != nil {
            print("   ✅ FCM 델리게이트 설정됨")
        } else {
            print("   ❌ FCM 델리게이트 설정 안됨")
        }

        // 5. APNs 토큰 상태 확인
        print("\n📡 5. APNs 토큰 상태:")
        if currentAPNSToken != nil {
            print("   ✅ APNs 토큰 존재: \(currentAPNSToken!.prefix(30))...")
        } else if let savedAPNSToken = UserDefaults.standard.string(forKey: "last_apns_token") {
            print("   ⚠️ 저장된 APNs 토큰: \(savedAPNSToken.prefix(30))...")
        } else {
            print("   ❌ APNs 토큰 없음")
        }

        // 6. 백그라운드 모드 확인
        print("\n🌙 6. 백그라운드 실행 모드:")
        let appState = UIApplication.shared.applicationState
        print("   📱 현재 앱 상태: \(appState == .active ? "활성" : appState == .background ? "백그라운드" : "비활성")")

        if let backgroundModes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] {
            print("   ✅ 백그라운드 모드: \(backgroundModes)")
        } else {
            print("   ❌ 백그라운드 모드 설정 없음")
        }

        // 7. 진단 결과 요약
        print("\n📋 7. 진단 결과 요약:")
        print("   💡 FCM 메시지가 수신되지 않는 경우:")
        print("      1. iOS 푸시 알림 권한이 '허용' 상태인지 확인")
        print("      2. FCM 토큰이 DB와 일치하는지 확인")
        print("      3. 앱이 완전히 종료된 상태에서는 백그라운드 푸시 제한될 수 있음")
        print("      4. FCM 메시지에 'notification' 필드가 포함되어 있는지 확인")
        print("      5. Firebase Console에서 APNs 인증서가 올바르게 설정되었는지 확인")

        print("\n🔧 디버깅 명령어:")
        print("   debugPushNotificationStatus()     // 푸시 상태 상세 확인")
        print("   testFCMTokenGeneration()          // 토큰 재생성 테스트")
        print("   diagnoseFCMTokenReception()       // 이 진단 실행")
        print("   forceSyncFCMTokenWithDB()         // FCM 토큰 DB 강제 동기화")
        print("   testFCMMessageReception()         // FCM 메시지 수신 테스트")

        print("═══════════════════════════════════════════════════════════════")
    }

    // MARK: - 🔄 FCM 토큰 강제 동기화
    private func forceSyncFCMTokenWithDB() {
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║ 🔄 [FCM 동기화] FCM 토큰 DB 강제 동기화 시작                  ║")
        print("╚══════════════════════════════════════════════════════════════╝")

        // 로그인 상태 확인
        guard UserDefaults.standard.bool(forKey: "is_logged_in") else {
            print("🔒 [FCM 동기화] 로그인 상태가 아님 - 동기화 건너뜀")
            return
        }

        // mt_idx 확인
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")

        guard let userIdx = mtIdx, !userIdx.isEmpty else {
            print("❌ [FCM 동기화] 사용자 ID(mt_idx) 없음 - 동기화 건너뜀")
            return
        }

        print("👤 [FCM 동기화] 사용자 ID: \(userIdx)")

        // 현재 iOS 기기의 FCM 토큰 가져오기
        Messaging.messaging().token { [weak self] token, error in
            guard let self = self else { return }

            if let error = error {
                print("❌ [FCM 동기화] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                return
            }

            guard let deviceToken = token else {
                print("❌ [FCM 동기화] FCM 토큰이 nil입니다")
                return
            }

            print("🔑 [FCM 동기화] 현재 iOS 기기 FCM 토큰: \(deviceToken.prefix(30))...")

            // FCM 토큰을 서버에 강제 업데이트
            print("📤 [FCM 동기화] FCM 토큰을 DB에 강제 업데이트")
            self.sendFCMTokenToServer(token: deviceToken) { success in
                if success {
                    print("✅ [FCM 동기화] FCM 토큰 DB 동기화 성공")
                    print("🔄 [FCM 동기화] 이제 FCM 메시지가 정상적으로 수신될 것입니다")

                    // UserDefaults에도 업데이트
                    UserDefaults.standard.set(deviceToken, forKey: "fcm_token")
                    UserDefaults.standard.set(deviceToken, forKey: "last_updated_fcm_token")
                    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_fcm_token_update_time")
                    UserDefaults.standard.synchronize()

                    print("💾 [FCM 동기화] 로컬 저장소에도 토큰 업데이트 완료")

                } else {
                    print("❌ [FCM 동기화] FCM 토큰 DB 동기화 실패")
                    print("💡 [FCM 동기화] 네트워크 연결을 확인해주세요")
                }
            }
        }
    }



    // MARK: - 🧪 FCM 메시지 수신 테스트
    private func testFCMMessageReception() {
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║ 🧪 [FCM 테스트] FCM 메시지 수신 테스트 시작                   ║")
        print("╚══════════════════════════════════════════════════════════════╝")

        // 1. FCM 토큰 확인
        if let token = UserDefaults.standard.string(forKey: "fcm_token") {
            print("✅ [FCM 테스트] FCM 토큰 존재: \(token.prefix(30))...")
        } else {
            print("❌ [FCM 테스트] FCM 토큰 없음")
            print("💡 [FCM 테스트] FCM 토큰이 없으면 메시지를 수신할 수 없습니다")
            return
        }

        // 2. 최근 FCM 메시지 확인
        if let lastMessage = UserDefaults.standard.dictionary(forKey: "last_fcm_message") {
            print("✅ [FCM 테스트] 최근 FCM 메시지 존재")

            if let timestamp = UserDefaults.standard.double(forKey: "last_fcm_message_time") as Double? {
                let timeAgo = Date().timeIntervalSince1970 - timestamp
                print("⏰ [FCM 테스트] 마지막 메시지 수신: \(Int(timeAgo))초 전")

                if timeAgo < 300 { // 5분 이내
                    print("✅ [FCM 테스트] 최근에 메시지를 수신했습니다")
                } else {
                    print("⚠️ [FCM 테스트] 최근 메시지 수신 기록이 없음")
                }
            }
        } else {
            print("❌ [FCM 테스트] FCM 메시지 수신 기록 없음")
            print("💡 [FCM 테스트] 아직 FCM 메시지를 수신한 적이 없습니다")
        }

        // 3. FCM 서비스 상태 확인
        print("\n🔥 [FCM 테스트] FCM 서비스 상태:")
        if Messaging.messaging().isAutoInitEnabled {
            print("   ✅ FCM 자동 초기화 활성화")
        } else {
            print("   ❌ FCM 자동 초기화 비활성화")
        }

        if Messaging.messaging().delegate != nil {
            print("   ✅ FCM 델리게이트 설정됨")
        } else {
            print("   ❌ FCM 델리게이트 설정 안됨")
        }

        // 4. APNs 토큰 상태 확인
        if let apnsToken = UserDefaults.standard.string(forKey: "last_apns_token") {
            print("   ✅ APNs 토큰 존재: \(apnsToken.prefix(30))...")
        } else {
            print("   ❌ APNs 토큰 없음")
        }

        // 5. 푸시 권한 상태 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("\n🔔 [FCM 테스트] 푸시 권한 상태: \(settings.authorizationStatus)")

                // 6. 테스트 결과 요약
                print("\n📋 [FCM 테스트] 테스트 결과:")
                if settings.authorizationStatus == .authorized {
                    print("   ✅ 푸시 권한 허용됨")
                } else {
                    print("   ❌ 푸시 권한 거부됨 - FCM 메시지를 표시할 수 없습니다")
                }

                if let _ = UserDefaults.standard.string(forKey: "fcm_token") {
                    print("   ✅ FCM 토큰 존재")
                } else {
                    print("   ❌ FCM 토큰 없음")
                }

                if let _ = UserDefaults.standard.dictionary(forKey: "last_fcm_message") {
                    print("   ✅ FCM 메시지 수신 기록 존재")
                } else {
                    print("   ❌ FCM 메시지 수신 기록 없음")
                }

                print("\n💡 [FCM 테스트] 문제 해결 방법:")
                print("   1. FCM 토큰이 DB와 일치하는지 확인하세요")
                print("   2. 백엔드에서 올바른 FCM 토큰으로 메시지를 전송하는지 확인하세요")
                print("   3. 앱이 백그라운드에 있을 때 FCM 메시지가 수신되는지 확인하세요")
                print("   4. Firebase Console에서 APNs 설정이 올바른지 확인하세요")

                print("\n🔧 [FCM 테스트] 추가 진단:")
                print("   forceSyncFCMTokenWithDB()  // FCM 토큰 DB 동기화")
                print("   diagnoseFCMTokenReception() // 종합 진단")

                print("═══════════════════════════════════════════════════════════════")
            }
        }
    }

    // MARK: - 🛠️ FCM 백그라운드 헬퍼 메서드들

    /// APNs 토큰과 함께 FCM 토큰 전송 (백그라운드용)
    private func sendFCMTokenToServerWithApnsToken(_ token: String, apnsToken: String, completion: @escaping (Bool) -> Void) {
        print("📡 [FCM Helper] APNs 토큰과 함께 FCM 토큰 전송")

        // UserDefaults에서 mt_idx 가져오기
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")

        guard let mtIdx = mtIdx, !mtIdx.isEmpty else {
            print("❌ [FCM Helper] mt_idx를 찾을 수 없음")
            completion(false)
            return
        }

        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token,
            "apns_token": apnsToken
        ]

        sendFCMTokenRequest(requestData, completion: completion)
    }

    /// APNs 토큰 없이 FCM 토큰만 전송 (백그라운드 비상용)
    private func sendFCMTokenToServerWithoutApnsToken(_ token: String, completion: @escaping (Bool) -> Void) {
        print("⚠️ [FCM Helper] APNs 토큰 없이 FCM 토큰만 전송 (비상 모드)")

        // UserDefaults에서 mt_idx 가져오기
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")

        guard let mtIdx = mtIdx, !mtIdx.isEmpty else {
            print("❌ [FCM Helper] mt_idx를 찾을 수 없음")
            completion(false)
            return
        }

        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token
        ]

        sendFCMTokenRequest(requestData, completion: completion)
    }

    /// FCM 토큰 요청 공통 로직
    private func sendFCMTokenRequest(_ requestData: [String: Any], completion: @escaping (Bool) -> Void) {
        print("📡 [FCM Request] FCM 토큰 요청 시작")

        // JSON 데이터로 변환
        guard let jsonData = try? JSONSerialization.data(withJSONObject: requestData) else {
            print("❌ [FCM Request] JSON 데이터 변환 실패")
            completion(false)
            return
        }

        // API URL 구성
        let urlString = Http.shared.BASE_URL + Http.shared.memberFcmTokenUrl
        guard let url = URL(string: urlString) else {
            print("❌ [FCM Request] 잘못된 URL: \(urlString)")
            completion(false)
            return
        }

        // 백그라운드용 타임아웃 설정 (더 짧게)
        let appState = UIApplication.shared.applicationState
        let timeoutInterval: TimeInterval = appState == .background ? 15.0 : 30.0

        // URLRequest 구성
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        request.timeoutInterval = timeoutInterval

        print("🌐 [FCM Request] 요청 URL: \(urlString)")
        print("⏱️ [FCM Request] 타임아웃: \(timeoutInterval)초")

        // URLSession으로 API 호출 (백그라운드용 설정)
        let configuration = URLSessionConfiguration.default
        if appState == .background {
            configuration.timeoutIntervalForRequest = timeoutInterval
            configuration.timeoutIntervalForResource = timeoutInterval
        }

        let session = URLSession(configuration: configuration)
        let task = session.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM Request] 네트워크 오류: \(error.localizedDescription)")
                    completion(false)
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ [FCM Request] HTTP 응답이 아님")
                    completion(false)
                    return
                }

                print("📡 [FCM Request] HTTP 상태 코드: \(httpResponse.statusCode)")

                if let data = data, let responseString = String(data: data, encoding: .utf8) {
                    print("📨 [FCM Request] 서버 응답: \(responseString)")
                }

                if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                    print("✅ [FCM Request] FCM 토큰 서버 업데이트 성공!")
                    completion(true)
                } else {
                    print("❌ [FCM Request] FCM 토큰 서버 업데이트 실패 - 상태 코드: \(httpResponse.statusCode)")
                    completion(false)
                }
            }
        }

        task.resume()
    }

    /// 백그라운드에서 취소된 FCM 토큰 업데이트 재시도
    private func retryCancelledBackgroundTokenUpdate() {
        // 취소된 토큰이 있는지 확인
        if let pendingToken = UserDefaults.standard.string(forKey: "pending_background_fcm_token"),
           let cancelledTime = UserDefaults.standard.object(forKey: "pending_token_cancelled_time") as? TimeInterval {

            let currentTime = Date().timeIntervalSince1970
            let timeSinceCancelled = currentTime - cancelledTime

            // 24시간 이내 취소된 토큰만 재시도
            if timeSinceCancelled < (24 * 60 * 60) {
                print("🔄 [FCM Retry] 백그라운드 취소 토큰 재시도: \(pendingToken.prefix(20))...")
                print("⏱️ [FCM Retry] 취소 후 \(Int(timeSinceCancelled))초 경과")

                // 취소된 토큰 제거
                UserDefaults.standard.removeObject(forKey: "pending_background_fcm_token")
                UserDefaults.standard.removeObject(forKey: "pending_token_cancelled_time")
                UserDefaults.standard.synchronize()

                // 토큰 업데이트 재시도
                updateFCMTokenIfNeededWithCheck(token: pendingToken)
            } else {
                print("⏰ [FCM Retry] 취소된 토큰 만료됨 (24시간 경과) - 제거")
                UserDefaults.standard.removeObject(forKey: "pending_background_fcm_token")
                UserDefaults.standard.removeObject(forKey: "pending_token_cancelled_time")
                UserDefaults.standard.synchronize()
            }
        }
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
        
        // 🔧 [중요] 푸시 알림 확실한 수신을 위해 로그인 여부와 관계없이 권한 허용
        print("✅ [SWZ-PUSH] 푸시 권한 요청 허용 - iOS 푸시 수신 안정성 향상")
        
        // Call original (swizzled) implementation - 로그인 상태와 관계없이 실행
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

// MARK: - 🚀 AppDelegate 백그라운드 푸시 최적화 Extension
extension AppDelegate {
    
    /// 백그라운드 앱 새로고침 설정
    func setupBackgroundAppRefresh() {
        print("🚀 [Background] 백그라운드 앱 새로고침 설정 시작")
        
        // 백그라운드 앱 새로고침 권한 요청
        UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
        
        // 백그라운드 작업 알림 등록 (Enhanced 버전 사용)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackgroundEnhanced),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForegroundEnhanced),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        
        print("✅ [Background] 백그라운드 앱 새로고침 설정 완료")
    }
    
    /// 정기적 토큰 상태 모니터링 시작
    func startPeriodicTokenMonitoring() {
        print("🔄 [Monitoring] 정기적 토큰 상태 모니터링 시작")
        
        // 기존 타이머 정리
        backgroundTokenRefreshTimer?.invalidate()
        
        // 1시간마다 토큰 상태 확인
        backgroundTokenRefreshTimer = Timer.scheduledTimer(withTimeInterval: backgroundTokenRefreshInterval, repeats: true) { [weak self] _ in
            self?.performPeriodicTokenCheck()
        }
        
        print("✅ [Monitoring] 토큰 상태 모니터링 타이머 시작 (간격: \(backgroundTokenRefreshInterval)초)")
    }
    
    /// 정기적 토큰 상태 확인
    private func performPeriodicTokenCheck() {
        print("🔍 [Monitoring] 정기적 토큰 상태 확인 실행")
        
        // 백그라운드에서만 실행
        guard isAppInBackground else {
            print("ℹ️ [Monitoring] 앱이 포그라운드 상태 - 토큰 확인 건너뜀")
            return
        }
        
        // 마지막 확인 시간 체크 (중복 실행 방지)
        if let lastFetch = lastBackgroundFetchTime,
           Date().timeIntervalSince(lastFetch) < 1800 { // 30분 이내 중복 방지
            print("ℹ️ [Monitoring] 최근 토큰 확인 완료 - 건너뜀")
            return
        }
        
        lastBackgroundFetchTime = Date()
        
        // 백그라운드 작업으로 토큰 확인
        let taskId = UIApplication.shared.beginBackgroundTask(withName: "PeriodicTokenCheck") { [weak self] in
            self?.endBackgroundTask()
        }
        
        DispatchQueue.global(qos: .utility).async { [weak self] in
            self?.performTokenIntegrityCheck()
            
            DispatchQueue.main.async {
                UIApplication.shared.endBackgroundTask(taskId)
            }
        }
    }
    
    /// 앱이 백그라운드로 진입할 때 호출 (enhanced version)
    @objc func appDidEnterBackgroundEnhanced() {
        print("🌙 [Background Enhanced] 앱이 백그라운드로 진입")
        
        isAppInBackground = true
        backgroundSessionStartTime = Date()
        
        // 즉시 토큰 상태 확인 (백그라운드 진입 시)
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
            self?.performBackgroundTokenRefresh()
        }
    }
    
    /// 앱이 포그라운드로 복귀할 때 호출 (enhanced version)
    @objc func appWillEnterForegroundEnhanced() {
        print("🌅 [Foreground Enhanced] 앱이 포그라운드로 복귀")
        
        isAppInBackground = false
        
        // 백그라운드 세션 시간 확인
        if let startTime = backgroundSessionStartTime {
            let backgroundDuration = Date().timeIntervalSince(startTime)
            print("📊 [Foreground Enhanced] 백그라운드 지속 시간: \(Int(backgroundDuration))초")
            
            // 30분 이상 백그라운드에 있었으면 토큰 갱신 강제 실행
            if backgroundDuration > 1800 { // 30분
                print("⚠️ [Foreground Enhanced] 장시간 백그라운드 - 토큰 갱신 필요")
                shouldForceTokenRefreshOnResume = true
            }
        }
        
        // 토큰 갱신이 예약되었다면 실행
        if shouldForceTokenRefreshOnResume {
            print("🔄 [Foreground Enhanced] 예약된 토큰 갱신 실행")
            shouldForceTokenRefreshOnResume = false
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.performTokenIntegrityCheck()
            }
        }
    }
    
    /// 앱이 활성화될 때 호출
    @objc func appDidBecomeActive() {
        print("✨ [Active] 앱이 활성화됨")
        
        // 앱이 활성화될 때마다 토큰 상태 확인
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.performTokenIntegrityCheck()
        }
    }
    
    /// 백그라운드에서 토큰 갱신 수행
    private func performBackgroundTokenRefresh() {
        print("🔄 [Background] 백그라운드 토큰 갱신 시작")
        
        guard isAppInBackground else {
            print("ℹ️ [Background] 앱이 포그라운드로 복귀 - 백그라운드 갱신 취소")
            return
        }
        
        // 현재 토큰 상태 확인
        Messaging.messaging().token { [weak self] token, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [Background] 백그라운드 토큰 가져오기 실패: \(error.localizedDescription)")
                return
            }
            
            guard let token = token else {
                print("❌ [Background] 백그라운드에서 토큰이 nil")
                return
            }
            
            print("✅ [Background] 백그라운드 토큰 확인 성공: \(token.prefix(30))...")
            
            // 저장된 토큰과 비교
            let savedToken = UserDefaults.standard.string(forKey: "fcm_token")
            if token != savedToken {
                print("🔄 [Background] 토큰 변경 감지 - 서버 동기화 필요")
                self.syncTokenWithServer(token)
            } else {
                print("✅ [Background] 토큰 상태 정상 - 동기화 불필요")
            }
        }
    }
    

    
    /// Silent Push를 통한 토큰 갱신 처리
    func handleSilentPushTokenRefresh(_ userInfo: [AnyHashable: Any], completion: @escaping (Bool) -> Void) {
        print("🔇 [Silent Push Handler] 토큰 갱신 처리 시작")
        
        // 토큰 갱신 타임스탬프 확인
        if let timestamp = userInfo["timestamp"] as? String {
            print("🔇 [Silent Push Handler] 요청 타임스탬프: \(timestamp)")
        }
        
        // 강제 토큰 업데이트 플래그 설정
        shouldForceTokenRefreshOnResume = true
        
        // 현재 토큰 상태 확인 및 갱신
        Messaging.messaging().token { [weak self] token, error in
            guard let self = self else {
                completion(false)
                return
            }
            
            if let error = error {
                print("❌ [Silent Push Handler] 토큰 가져오기 실패: \(error.localizedDescription)")
                completion(false)
                return
            }
            
            guard let token = token else {
                print("❌ [Silent Push Handler] 토큰이 nil")
                completion(false)
                return
            }
            
            print("✅ [Silent Push Handler] 현재 토큰 확인: \(token.prefix(30))...")
            
            // 저장된 토큰과 비교
            let savedToken = UserDefaults.standard.string(forKey: "fcm_token")
            
            if token != savedToken {
                print("🔄 [Silent Push Handler] 토큰 변경 감지 - 서버 동기화 진행")
                
                // 서버에 토큰 업데이트
                self.sendFCMTokenToServer(token: token) { success in
                    if success {
                        print("✅ [Silent Push Handler] 토큰 동기화 성공")
                        
                        // 로컬 저장 업데이트
                        UserDefaults.standard.set(token, forKey: "fcm_token")
                        UserDefaults.standard.set(token, forKey: "last_updated_fcm_token")
                        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_token_update_time")
                        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_silent_push_refresh_time")
                        UserDefaults.standard.synchronize()
                        
                        completion(true)
                    } else {
                        print("❌ [Silent Push Handler] 토큰 동기화 실패")
                        completion(false)
                    }
                }
            } else {
                print("✅ [Silent Push Handler] 토큰 상태 정상 - 동기화 불필요")
                
                // Silent Push로 토큰 확인했다는 기록
                UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "last_silent_push_check_time")
                UserDefaults.standard.synchronize()
                
                completion(true)
            }
        }
        
        // 토큰 무결성 검증도 함께 수행
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.performTokenIntegrityCheck()
        }
    }
    
    // MARK: - 🎯 백그라운드 앱 새로고침 대리자 메서드
    
    func application(_ application: UIApplication, performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("🔄 [Background Fetch] 시스템 백그라운드 새로고침 실행")
        
        // 토큰 상태 확인
        Messaging.messaging().token { [weak self] token, error in
            guard let self = self else {
                completionHandler(.failed)
                return
            }
            
            if let error = error {
                print("❌ [Background Fetch] 토큰 가져오기 실패: \(error.localizedDescription)")
                completionHandler(.failed)
                return
            }
            
            guard let token = token else {
                print("❌ [Background Fetch] 토큰이 nil")
                completionHandler(.noData)
                return
            }
            
            print("✅ [Background Fetch] 토큰 확인 성공: \(token.prefix(30))...")
            
            // 저장된 토큰과 비교하여 변경사항 확인
            let savedToken = UserDefaults.standard.string(forKey: "fcm_token")
            if token != savedToken {
                print("🔄 [Background Fetch] 토큰 변경 감지 - 동기화 진행")
                
                self.sendFCMTokenToServer(token: token) { success in
                    if success {
                        UserDefaults.standard.set(token, forKey: "fcm_token")
                        UserDefaults.standard.synchronize()
                        print("✅ [Background Fetch] 토큰 동기화 성공")
                        completionHandler(.newData)
                    } else {
                        print("❌ [Background Fetch] 토큰 동기화 실패")
                        completionHandler(.failed)
                    }
                }
            } else {
                print("✅ [Background Fetch] 토큰 상태 정상")
                completionHandler(.noData)
            }
        }
    }
    
    // MARK: - 🔍 푸시 알림 디버깅 메서드들 (Enhanced)
    
    /// 푸시 권한 강제 재요청 (Enhanced)
    @objc func forcePushPermissionRequestEnhanced() {
        print("🔔 [PUSH DEBUG Enhanced] 푸시 권한 강제 재요청 시작")
        
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [PUSH DEBUG Enhanced] 푸시 권한 요청 오류: \(error.localizedDescription)")
                } else {
                    print("✅ [PUSH DEBUG Enhanced] 푸시 권한 요청 결과: \(granted ? "허용됨" : "거부됨")")
                    
                    if granted {
                        print("📱 [PUSH DEBUG Enhanced] APNs 등록 시작")
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                }
            }
        }
    }
    
    /// 알림 설정을 문자열로 변환 (Enhanced)
    private func notificationSettingStringEnhanced(_ setting: UNNotificationSetting) -> String {
        switch setting {
        case .notSupported: return "지원되지 않음"
        case .disabled: return "비활성화"
        case .enabled: return "활성화"
        @unknown default: return "알 수 없음"
        }
    }
    
    /// 즉시 로컬 알림 표시 (백그라운드 상태용)
    private func scheduleImmediateLocalNotification(userInfo: [AnyHashable: Any]) {
        print("🔔 [FCM] 즉시 로컬 알림 스케줄링 시작")
        
        let center = UNUserNotificationCenter.current()
        
        // 제목과 내용 추출
        var title = "새 알림"
        var body = "새로운 메시지가 도착했습니다."
        
        if let aps = userInfo["aps"] as? [String: Any],
           let alert = aps["alert"] as? [String: Any] {
            title = alert["title"] as? String ?? title
            body = alert["body"] as? String ?? body
        } else if let dataTitle = userInfo["title"] as? String,
                  let dataBody = userInfo["body"] as? String {
            title = dataTitle
            body = dataBody
        }
        
        print("🔔 [FCM] 로컬 알림 내용 - 제목: \(title), 내용: \(body)")
        
        // 알림 내용 구성
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)
        content.categoryIdentifier = "GENERAL_NOTIFICATION"
        content.userInfo = userInfo
        
        // 즉시 트리거 (0.1초 후)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        
        // 고유 식별자 생성
        let identifier = "fcm_immediate_\(Int(Date().timeIntervalSince1970))"
        
        // 중복 알림 방지 - 즉시 로컬 알림 생성 비활성화 
        print("🚫 [FCM] 중복 방지를 위해 즉시 로컬 알림 생성 건너뛰기")
        print("📝 [FCM] 식별자: \(identifier) - 즉시 알림 생성하지 않음")
    }
    
    /// 강제 로컬 알림 테스트 (시각적 확인용)
    @objc func testLocalNotification() {
        print("🔔 [LOCAL TEST] 강제 로컬 알림 테스트 시작")
        
        let center = UNUserNotificationCenter.current()
        let content = UNMutableNotificationContent()
        content.title = "🧪 로컬 알림 테스트"
        content.body = "이 알림이 보인다면 iOS 알림 시스템이 정상 작동 중입니다 - \(Date().description)"
        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)
        
        // 즉시 트리거
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let request = UNNotificationRequest(identifier: "local_test_\(Int(Date().timeIntervalSince1970))", content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("❌ [LOCAL TEST] 로컬 알림 실패: \(error.localizedDescription)")
            } else {
                print("✅ [LOCAL TEST] 로컬 알림 스케줄됨 - 화면에 표시되는지 확인하세요")
            }
        }
    }
    
    /// 테스트 푸시 전송 요청
    @objc func sendTestPushNotification() {
        print("📤 [PUSH DEBUG] 테스트 푸시 전송 요청")
        
        guard let savedToken = UserDefaults.standard.string(forKey: "fcm_token"), !savedToken.isEmpty else {
            print("❌ [PUSH DEBUG] FCM 토큰이 없음 - 토큰 갱신 후 다시 시도")
            forceRefreshFCMToken()
            return
        }
        
        // 현재 시간으로 테스트 메시지 생성
        let timestamp = DateFormatter().string(from: Date())
        let testMessage = "테스트 푸시 - \(timestamp)"
        
        print("📤 [PUSH DEBUG] 테스트 푸시 전송 중...")
        print("   - 토큰: \(savedToken.prefix(30))...")
        print("   - 메시지: \(testMessage)")
        
        // 실제 서버 API 호출 (fcm_sendone 엔드포인트 사용)
        let url = URL(string: "https://api3.smap.site/api/v1/fcm_sendone")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody: [String: Any] = [
            "plt_type": "TEST_DEBUG",
            "sst_idx": "0",
            "plt_condition": "iOS Debug Test",
            "plt_memo": testMessage,
            "mt_idx": 1186, // 실제 사용자 ID
            "plt_title": "🔍 iOS 푸시 디버그",
            "plt_content": testMessage
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        } catch {
            print("❌ [PUSH DEBUG] JSON 직렬화 오류: \(error)")
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [PUSH DEBUG] 테스트 푸시 전송 오류: \(error.localizedDescription)")
                } else if let httpResponse = response as? HTTPURLResponse {
                    print("📱 [PUSH DEBUG] 테스트 푸시 응답: HTTP \(httpResponse.statusCode)")
                    
                    if let data = data,
                       let responseString = String(data: data, encoding: .utf8) {
                        print("📝 [PUSH DEBUG] 응답 내용: \(responseString)")
                    }
                    
                    if httpResponse.statusCode == 200 {
                        print("✅ [PUSH DEBUG] 테스트 푸시 전송 성공 - 5초 후 수신 여부 확인하세요")
                    } else {
                        print("❌ [PUSH DEBUG] 테스트 푸시 전송 실패 - HTTP \(httpResponse.statusCode)")
                    }
                }
            }
        }.resume()
    }
    
    // MARK: - 백그라운드 FCM 토큰 관리 및 연결 유지
    
    private func setupBackgroundFCMTokenManagement() {
        isAppInBackground = true
        backgroundSessionStartTime = Date()
        
        print("🌙 [FCM BACKGROUND] 백그라운드 토큰 관리 준비 시작")
        
        // 백그라운드 작업 시작
        backgroundTaskIdentifier = UIApplication.shared.beginBackgroundTask(withName: "FCMTokenBackgroundTask") {
            print("⏰ [FCM BACKGROUND] 백그라운드 작업 시간 만료")
            UIApplication.shared.endBackgroundTask(self.backgroundTaskIdentifier)
            self.backgroundTaskIdentifier = .invalid
        }
        
        // 백그라운드에서 토큰 갱신 타이머 시작
        startBackgroundTokenRefreshTimer()
        
        // 현재 토큰 상태를 서버에 한 번 더 전송
        if let currentToken = currentFCMToken {
            updateFCMTokenToServerSilently(token: currentToken, reason: "background_entry")
        }
    }
    
    private func startBackgroundKeepAlive() {
        print("💚 [FCM BACKGROUND] 백그라운드 연결 유지 시작")
        
        backgroundKeepAliveTimer?.invalidate()
        backgroundKeepAliveTimer = Timer.scheduledTimer(withTimeInterval: backgroundKeepAliveInterval, repeats: true) { [weak self] _ in
            self?.performBackgroundKeepAlive()
        }
    }
    
    private func stopBackgroundKeepAlive() {
        print("💛 [FCM BACKGROUND] 백그라운드 연결 유지 중단")
        
        backgroundKeepAliveTimer?.invalidate()
        backgroundKeepAliveTimer = nil
        backgroundTokenRefreshTimer?.invalidate()
        backgroundTokenRefreshTimer = nil
        
        if backgroundTaskIdentifier != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTaskIdentifier)
            backgroundTaskIdentifier = .invalid
        }
    }
    
    private func startBackgroundTokenRefreshTimer() {
        backgroundTokenRefreshTimer?.invalidate()
        backgroundTokenRefreshTimer = Timer.scheduledTimer(withTimeInterval: backgroundTokenRefreshInterval, repeats: true) { [weak self] _ in
            self?.handleBackgroundTokenRefresh()
        }
    }
    
    private func performBackgroundKeepAlive() {
        guard isAppInBackground else { return }
        
        print("🔄 [FCM BACKGROUND] 백그라운드 연결 유지 수행")
        
        // 마지막 백그라운드 토큰 업데이트 시간 확인
        let lastBackgroundUpdate = UserDefaults.standard.double(forKey: "last_background_keepalive_update")
        let currentTime = Date().timeIntervalSince1970
        let timeSinceLastUpdate = currentTime - lastBackgroundUpdate
        
        // 백그라운드에서는 최소 30분 간격으로만 토큰 상태 확인
        if timeSinceLastUpdate < 1800 { // 30분
            print("⏳ [FCM BACKGROUND] 백그라운드 토큰 상태 확인 쿨다운 중 - 스킵")
            return
        }
        
        // FCM 토큰 상태 확인 (서버 업데이트 없이)
        if let token = currentFCMToken {
            print("📊 [FCM BACKGROUND] 백그라운드 토큰 상태만 확인 (업데이트 없음)")
            // 토큰 상태 확인만 하고 서버 업데이트는 하지 않음
            UserDefaults.standard.set(currentTime, forKey: "last_background_keepalive_update")
        }
        
        // 백그라운드 시간이 매우 길면 (3시간 이상) 토큰 검증만 수행
        if let startTime = backgroundSessionStartTime,
           Date().timeIntervalSince(startTime) > 10800 { // 3시간 이상
            print("⚠️ [FCM BACKGROUND] 장시간 백그라운드 감지 - 토큰 검증만 수행")
            // 토큰 유효성만 검증하고 변경은 하지 않음
            validateCurrentFCMToken()
        }
    }
    
    private func handleBackgroundTokenRefresh() {
        guard isAppInBackground,
              UserDefaults.standard.bool(forKey: "is_logged_in") else { return }
        
        print("🔄 [FCM BACKGROUND] 백그라운드 토큰 갱신 수행")
        
        // 토큰 만료 시간 확인
        if let lastUpdate = lastFCMTokenUpdateTime,
           Date().timeIntervalSince(lastUpdate) > TimeInterval(fcmTokenExpiryDays * 24 * 3600) {
            print("⚠️ [FCM BACKGROUND] 토큰 만료 감지 - 토큰 재전송")
            // 기존 토큰 재전송으로 대체
            if let token = currentFCMToken {
                updateFCMTokenToServerSilently(token: token, reason: "background_token_expired")
            }
        } else {
            // 기존 토큰 재전송
            if let token = currentFCMToken {
                updateFCMTokenToServerSilently(token: token, reason: "background_refresh")
            }
        }
    }
    
    private func updateFCMTokenToServerSilently(token: String, reason: String) {
        // 조용한 백그라운드 업데이트 (로그 최소화)
        guard let url = URL(string: "https://api3.smap.site/api/v1/member-fcm-token/update") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "fcm_token": token,
            "reason": reason,
            "background_update": true
        ] as [String: Any]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            URLSession.shared.dataTask(with: request) { _, response, error in
                if let error = error {
                    print("❌ [FCM BACKGROUND] 조용한 토큰 업데이트 실패: \(error.localizedDescription)")
                } else if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    print("✅ [FCM BACKGROUND] 조용한 토큰 업데이트 성공")
                }
            }.resume()
        } catch {
            print("❌ [FCM BACKGROUND] 요청 생성 실패: \(error.localizedDescription)")
        }
    }
    
    // MARK: - FCM 토큰 검증 (업데이트 없이)
    
    private func validateCurrentFCMToken() {
        guard let token = currentFCMToken else {
            print("❌ [FCM VALIDATE] 현재 FCM 토큰이 없음")
            return
        }
        
        print("🔍 [FCM VALIDATE] FCM 토큰 유효성 검증 (업데이트 없음)")
        
        // 토큰 형식만 검증하고 서버에는 전송하지 않음
        if validateTokenFormat(token) {
            print("✅ [FCM VALIDATE] 토큰 형식 유효")
        } else {
            print("❌ [FCM VALIDATE] 토큰 형식 무효 - 포그라운드 복귀 시 갱신 예정")
        }
    }
}
