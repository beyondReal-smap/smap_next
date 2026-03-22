//
//  AppDelegate.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import UIKit
import FirebaseCore
import FirebaseMessaging

import CoreLocation
import AVFoundation
import Photos
import CoreMotion
import SwiftyStoreKit
import GoogleSignIn
import WebKit
import KakaoSDKCommon
import KakaoSDKAuth
import KakaoSDKUser
import NMapsMap

// FCM Token Manager - 자동 토큰 업데이트 기능

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
        
        
        let config = GIDConfiguration(clientID: clientId)
        GIDSignIn.sharedInstance.configuration = config
        
        // Naver Map 인증 설정 (Info.plist 사용)
        NMFAuthManager.shared().delegate = self
        
        if Bundle.main.bundleIdentifier == nil {
             print("❌ [NaverMap] Bundle ID를 찾을 수 없음")
        }
        if Bundle.main.infoDictionary?["NMFNcpKeyId"] as? String == nil {
             print("🗺️ [NaverMap] Info.plist Client ID: \(Bundle.main.infoDictionary?["NMFClientId"] ?? "N/A")")
        }
        
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

        
        // ✅ FCM 자동 초기화 비활성화 - APNS 토큰 획득 후 수동 설정
        Messaging.messaging().isAutoInitEnabled = false
        print("✅ [FCM] 자동 초기화 비활성화 - APNS 토큰 대기")

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
        
        // 🔍 토큰 무결성 검증 시작
        if Messaging.messaging().apnsToken != nil {
            performTokenIntegrityCheck()
        } else {
            print("🚫 [FCM] APNS 토큰 대기 중 - 무결성 검증 지연")
        }

        // 저장된 토큰들 확인
        if UserDefaults.standard.string(forKey: "fcm_token") == nil {
            print("❌ [저장됨] FCM 토큰: 없음")
        }

        if UserDefaults.standard.string(forKey: "last_updated_fcm_token") == nil {
            print("❌ [DB] 마지막 업데이트 토큰: 없음")
        }

        if UserDefaults.standard.string(forKey: "last_apns_token") == nil {
            print("❌ [APNS] 저장된 토큰: 없음")
        }

        // 현재 FCM 토큰 가져오기 (비동기)
        Messaging.messaging().token { token, error in
            if let error = error {
                print("❌ [실시간] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
            } else if let token = token {

                // 저장된 토큰과 비교
                if let savedToken = UserDefaults.standard.string(forKey: "fcm_token") {
                    if token == savedToken {
                        print("✅ [토큰 일치] 실시간 토큰과 저장된 토큰이 일치합니다")
                    } else {
                        print("⚠️ [토큰 불일치] 실시간 토큰과 저장된 토큰이 다릅니다!")
                    }
                }

                // DB 토큰과 비교
                if let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") {
                    if token == dbToken {
                        print("✅ [DB 일치] 실시간 토큰과 DB 토큰이 일치합니다")
                    } else {
                        print("⚠️ [DB 불일치] 실시간 토큰과 DB 토큰이 다릅니다!")
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

        
        if #available(iOS 10.0, *) {
            // For iOS 10 display notification (sent via APNS)
            UNUserNotificationCenter.current().delegate = self
            // ✅ 앱 시작 시 푸시 알림 권한 요청 활성화
            
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
            #if !targetEnvironment(simulator)
                let settings: UIUserNotificationSettings =
                    UIUserNotificationSettings(types: [.alert, .badge, .sound], categories: nil)
                application.registerUserNotificationSettings(settings)
            #endif
            application.registerForRemoteNotifications()
        }
        
        // iOS 14+ 권장 방식: delegate 기반 위치 서비스 시작 (프리퍼미션 이후)
        if UserDefaults.standard.bool(forKey: "smap_location_prepermission_done") {
            restoreLocationManagerUserInfo()
            LocationManager.shared.startTracking()
        } else {
            print("📍 [LOCATION] 앱 시작 시 자동 위치 권한 요청 생략 (프리퍼미션 대기)")
        }
        
        StoreKitManager.shared.fetchReceipt { _, fetchError in
            if let fetchError = fetchError {
                print("fetchReceipt error - \(fetchError)")
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
                @unknown default:
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
        
        // APNS 토큰 확인 (없으면 FCM 토큰 요청 시 에러 발생함)
        guard Messaging.messaging().apnsToken != nil else {
             return
        }

        // 🚫 사용자가 식별되지 않았으면(mt_idx 없음) FCM 토큰 업데이트를 하지 않음
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                        UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        if !hasUserIdentified {
            return
        }


        // 마지막 앱 실행 시간 확인
        let lastAppLaunchTime = UserDefaults.standard.double(forKey: "last_app_launch_time")
        let currentTime = Date().timeIntervalSince1970
        let _ = currentTime - lastAppLaunchTime


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
                    let _ = UserDefaults.standard.double(forKey: "last_fcm_token_update_time")

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

        // 📱 앱 상태 확인 - 백그라운드에서도 토큰 검증 허용
        let _ = UIApplication.shared.applicationState


        // 사용자 ID 확인
        guard let mtIdxString = UserDefaults.standard.string(forKey: "mt_idx") ??
                              UserDefaults.standard.string(forKey: "savedMtIdx") ??
                              UserDefaults.standard.string(forKey: "current_mt_idx"),
              let mtIdx = Int(mtIdxString) else {
            // print("❌ [FCM Validation] 사용자 ID를 찾을 수 없음")
            return
        }

        // 현재 FCM 토큰 가져오기
        // APNS 토큰 확인 (필수)
        guard Messaging.messaging().apnsToken != nil else {
             return
        }
        
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                if error != nil {
                    // print("❌ [FCM Validation] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                    return
                }

                guard let token = token, !token.isEmpty else {
                    // print("❌ [FCM Validation] FCM 토큰이 nil이거나 비어있음")
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

        let urlString = "\(AppConfiguration.apiBaseURL)\(AppConfiguration.memberFcmTokenPath)/validate-and-refresh"
        guard let url = URL(string: urlString) else {
            // print("❌ [FCM Validation] 잘못된 URL: \(urlString)")
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
            // print("❌ [FCM Validation] JSON 변환 실패: \(error.localizedDescription)")
            return
        }

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if error != nil {
                    // print("❌ [FCM Validation] 네트워크 오류: \(error.localizedDescription)")
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    // print("❌ [FCM Validation] HTTP 응답이 아님")
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
                                // print("⚠️ [FCM Validation] 토큰 검증 실패: \(message)")

                                // 토큰이 유효하지 않은 경우 새 토큰 요청
                                if message.contains("만료") || message.contains("유효하지") {
                                    print("🔄 [FCM Validation] 토큰 만료 감지 - 새 토큰 요청")
                                    self?.forceRefreshFCMToken()
                                }
                            }
                        }
                    } catch {
                        // print("❌ [FCM Validation] JSON 파싱 오류: \(error.localizedDescription)")
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
        // APNS 토큰 확인
        guard Messaging.messaging().apnsToken != nil else {
             print("🚫 [FCM Force] APNS 토큰 없음 - 갱신 중단")
             return
        }
        
        Messaging.messaging().token { [weak self] token, error in
            DispatchQueue.main.async {
                if error != nil {
                    // print("❌ [FCM Force] 토큰 갱신 실패: \(error.localizedDescription)")
                    return
                }

                guard let token = token, !token.isEmpty else {
                    // print("❌ [FCM Force] 새 토큰이 nil이거나 비어있음")
                    return
                }

                print("✅ [FCM Force] 새 토큰 생성 성공: \(token.prefix(30))...")
                self?.sendFCMTokenToServer(token: token) { success in
                    if success {
                        print("✅ [FCM Force] 새 토큰 서버 업데이트 성공")
                    } else {
                        // print("❌ [FCM Force] 새 토큰 서버 업데이트 실패")
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
        // APNS 토큰 확인
        guard Messaging.messaging().apnsToken != nil else {
             return
        }
        
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

        // 로그인/가입 직후 권한 온보딩 트리거 (첫 로그인 시 applicationDidBecomeActive가 이미 지나간 경우)
        waitForPushPermissionSettlement { [weak self] in
            self?.runPermissionOnboardingIfNeeded()
        }
    }

    // MARK: - 🔑 로그인 시 FCM 토큰 강제 업데이트 (웹뷰에서 호출)
    @objc public func forceUpdateFCMTokenOnLogin() {
        print("🔑 [LOGIN] 로그인 시 FCM 토큰 강제 업데이트 시작")

        // 로그인 성공 시 FCM 실패 기록 및 재시도 횟수 초기화
        UserDefaults.standard.removeObject(forKey: "fcm_last_failed_update")
        UserDefaults.standard.set(0, forKey: "fcm_retry_count")
        UserDefaults.standard.synchronize()
        print("🧹 [LOGIN] 로그인 성공 - FCM 실패 기록 및 재시도 횟수 초기화")

        // 로그인 상태 확인
        let hasUserIdentified = UserDefaults.standard.string(forKey: "mt_idx") != nil ||
                               UserDefaults.standard.string(forKey: "savedMtIdx") != nil

        guard hasUserIdentified else {
            print("🔒 [LOGIN] 사용자가 식별되지 않음(mt_idx 없음) - 로그인 토큰 업데이트 대기")
            // 로그인 완료 후 호출되도록 플래그 설정
            forceTokenUpdateOnLogin = true
            return
        }

        // 로그인 전 저장된 pending FCM 토큰 처리
        if let pendingToken = UserDefaults.standard.string(forKey: "pending_fcm_token_after_login") {
            print("📋 [LOGIN] 로그인 전 저장된 FCM 토큰 발견 - 서버 등록 진행")
            print("   📱 토큰: \(pendingToken.prefix(30))...")

            sendFCMTokenToServer(token: pendingToken) { success in
                if success {
                    print("✅ [LOGIN] Pending FCM 토큰 서버 등록 성공")
                    // 성공 시 pending 토큰 제거
                    UserDefaults.standard.removeObject(forKey: "pending_fcm_token_after_login")
                    UserDefaults.standard.set(pendingToken, forKey: "fcm_token")
                    UserDefaults.standard.set(pendingToken, forKey: "last_updated_fcm_token")
                    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "fcm_token_updated_time")
                    UserDefaults.standard.synchronize()
                } else {
                    print("❌ [LOGIN] Pending FCM 토큰 서버 등록 실패")
                }
            }
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

        // FCM 토큰 재시도 횟수 체크 (무한 반복 방지)
        let retryCount = UserDefaults.standard.integer(forKey: "fcm_retry_count")
        if retryCount >= 3 {
            print("⏰ [LOGIN] FCM 토큰 재시도 횟수 초과 (3회) - 재시도 중단")
            print("💡 [LOGIN] 잠시 후 앱을 재시작하거나 나중에 다시 시도해주세요")

            // 재시도 횟수 초기화 (다음 로그인 시를 위해)
            UserDefaults.standard.set(0, forKey: "fcm_retry_count")
            UserDefaults.standard.synchronize()

            return
        }

        // 재시도 횟수 증가
        UserDefaults.standard.set(retryCount + 1, forKey: "fcm_retry_count")
        UserDefaults.standard.synchronize()
        print("🔢 [LOGIN] FCM 토큰 재시도 횟수: \(retryCount + 1)/3")

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
                                // Permission granted
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

        let _ = UNNotificationRequest(identifier: "fcm_message_\(Date().timeIntervalSince1970)", content: content, trigger: nil)

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

    // FCM 토큰 유효성 및 APNs 매칭 상태 검증
    private func validateFCMTokenIntegrity(_ token: String, completion: @escaping (Bool, String) -> Void) {

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
            guard currentAPNSToken != nil else {
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
        Messaging.messaging().token { refreshedToken, error in
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

    // 지연적 토큰 업데이트 작업 아이템 (취소용)
    private var delayedTokenUpdateWorkItem: DispatchWorkItem?

    /// 백그라운드 토큰 업데이트 전략
    enum BackgroundTokenUpdateStrategy {
        case immediate      // 즉시 업데이트
        case delayed(TimeInterval)  // 지연적 업데이트 (지연 시간)
        case cancel         // 업데이트 취소
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

    // FCM 푸시 알림 강제 표시 메소드
    private func forceDisplayFCMNotification(_ userInfo: [AnyHashable: Any]) {

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
        content.userInfo = userInfo

        print("   📋 알림 콘텐츠 설정 완료")
        print("   🔊 사운드: default")

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
    
    private func checkPushNotificationStatus() {
        
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
                
                // Firebase 토큰과 함께 상태 출력 (로그인된 경우만)
                if let token = Messaging.messaging().fcmToken {
                    
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
            print("⚠️ [SMAP-iOS] 메모리 경고 수신, 캐시 정리 수행 (쿠키/세션 보존)")
            // URL 캐시만 정리 (쿠키/세션은 보존하여 로그인 유지)
            URLCache.shared.removeAllCachedResponses()
            
            // ⚠️ 로그인 세션 유지를 위해 쿠키/세션은 삭제하지 않음
            // 캐시만 삭제 (diskCache, memoryCache, fetchCache)
            let cacheDataTypes: Set<String> = [
                WKWebsiteDataTypeDiskCache,
                WKWebsiteDataTypeMemoryCache,
                WKWebsiteDataTypeFetchCache,
                WKWebsiteDataTypeOfflineWebApplicationCache
            ]
            
            WKWebsiteDataStore.default().removeData(ofTypes: cacheDataTypes, modifiedSince: Date.distantPast) {
                print("✅ [SMAP-iOS] WebView 캐시 정리 완료 (쿠키/세션 보존됨)")
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

    // MARK: - 📍 위치 매니저 유저 정보 복원
    private func restoreLocationManagerUserInfo() {
        let udm = UserDefaultsManager.shared
        if let mtIdx = udm.mtIdx, !mtIdx.isEmpty {
            LocationManager.shared.updateUserInfo(
                mtIdx: mtIdx,
                mtId: udm.mtId ?? "",
                mtName: udm.mtName ?? ""
            )
        }
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
                UserDefaults.standard.set(true, forKey: "smap_location_prepermission_done")
                print("✅ [PERM] 권한 온보딩 완료 마크")
                // 위치 권한이 허용되었으면 추적 시작
                self?.restoreLocationManagerUserInfo()
                LocationManager.shared.startTracking()
                // 보완 체크 한 번 더 (혹시 한쪽이 여전히 notDetermined이면)
                self?.ensureMissingPermissionsSequence()
            }
            return
        }

        // 온보딩 이후: 결핍된 권한만 보완 요청
        print("🧭 [PERM] 재진입 - 결핍된 권한만 보완 요청 (모션 → 위치)")
        ensureMissingPermissionsSequence()
        // 기존 사용자 호환: prepermission 플래그 설정 + 유저 정보 복원 후 추적 시작
        UserDefaults.standard.set(true, forKey: "smap_location_prepermission_done")
        restoreLocationManagerUserInfo()
        LocationManager.shared.startTracking()
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
        let locStatus = CLLocationManager().authorizationStatus

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
        let status = CLLocationManager().authorizationStatus
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
            let s = CLLocationManager().authorizationStatus
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
            default:
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

        // FCM에 APNS 토큰 설정 (강화된 등록)
        Messaging.messaging().setAPNSToken(deviceToken as Data, type: .unknown)
        print("✅ [APNS] APNS 디바이스 토큰 FCM에 등록 완료")

        // 🔄 APNs 토큰 변경 감지 - FCM 토큰도 함께 갱신되어야 함
        print("🔄 [APNS→FCM] APNs 토큰 변경 감지 - FCM 토큰 동기화 필요")
        print("🎯 [이벤트 기반] FCM SDK가 자동으로 새로운 토큰을 생성할 때까지 대기")

        // FCM 서비스에 APNs 토큰 설정 (토큰 갱신 트리거)
        Messaging.messaging().setAPNSToken(deviceToken as Data, type: .unknown)

        // 🎯 이벤트 기반 토큰 관리 시스템
        // FCM 토큰 갱신 이벤트 기반 처리로 전환
        // messaging(_:didReceiveRegistrationToken:)에서 자동으로 처리됨

        // 현재 FCM 토큰도 확인해서 비교
        Messaging.messaging().token { fcmToken, error in
            if let error = error {
                print("❌ [FCM] 현재 FCM 토큰 가져오기 실패: \(error.localizedDescription)")
            } else if let fcmToken = fcmToken {

                // FCM 토큰을 UserDefaults에 저장 (디버깅용)
                UserDefaults.standard.set(fcmToken, forKey: "current_fcm_token")
                UserDefaults.standard.synchronize()

                // DB 토큰과 비교 (UserDefaults에서 가져옴)
                if let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") {
                    if fcmToken == dbToken {
                        print("✅ [토큰 일치] FCM 토큰과 DB 토큰이 일치합니다")
                    } else {
                        print("⚠️ [토큰 불일치] FCM 토큰과 DB 토큰이 다릅니다!")
                        print("   🔄 토큰 동기화 필요!")
                    }
                } else {
                    print("⚠️ [DB] DB에 저장된 FCM 토큰이 없습니다")
                }
            }
        }


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
    
    /// FCM 토큰 만료 여부 확인 (서버 mt_token_expiry_date 기준으로 매우 보수적)
    private func isFCMTokenExpired() -> Bool {
        // 1. 먼저 저장된 서버 만료 시간 확인
        if let expiryDateString = UserDefaults.standard.string(forKey: "server_token_expiry_date") {
            let dateFormatter = ISO8601DateFormatter()
            if let expiryDate = dateFormatter.date(from: expiryDateString) {
                let isExpired = Date() > expiryDate
                if isExpired {
                    print("⏰ [FCM Expiry] 서버 기준 FCM 토큰이 만료됨: \(expiryDateString)")
                } else {
                    let remainingTime = expiryDate.timeIntervalSinceNow
                    let remainingDays = remainingTime / (24 * 60 * 60)
                    print("✅ [FCM Expiry] 서버 기준 FCM 토큰이 유효함. 남은 기간: \(String(format: "%.1f", remainingDays))일")
                }
                return isExpired
            }
        }
        
        // 2. 서버 만료 시간이 없으면 매우 보수적으로 처리 - 만료되지 않았다고 가정
        print("⚠️ [FCM Expiry] 서버 만료 시간 정보 없음 - 매우 보수적으로 만료되지 않음으로 처리")
        print("⚠️ [FCM Expiry] 토큰 업데이트를 방지하여 기존 작동하는 토큰 보호")
        
        // 백업: 로컬 기준으로만 90일 이상된 경우만 만료로 처리
        let lastUpdateTime = UserDefaults.standard.double(forKey: "last_fcm_token_update_time")
        let currentTime = Date().timeIntervalSince1970
        let conservativeExpiryTime = TimeInterval(90 * 24 * 60 * 60) // 90일
        
        let isExpiredLocal = (currentTime - lastUpdateTime) > conservativeExpiryTime
        
        if isExpiredLocal {
            print("⏰ [FCM Expiry] 로컬 기준(90일) FCM 토큰 만료")
        } else {
            let remainingDays = 90.0 - ((currentTime - lastUpdateTime) / (24 * 60 * 60))
            print("✅ [FCM Expiry] 로컬 기준 FCM 토큰 유효. 남은 기간: \(String(format: "%.1f", remainingDays))일")
        }
        
        return isExpiredLocal
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

        print("[FCM] APNS registration failed")
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
        // print("🔍 [FCM Integrity] 토큰 무결성 검증 시작")
        
        // 재시도 횟수 초기화
        fcmTokenRetryCount = 0
        
        // 현재 FCM 토큰 가져오기
        Messaging.messaging().token { [weak self] token, error in
            guard let self = self else { return }
            
            if let error = error {
                // print("❌ [FCM Integrity] 토큰 가져오기 실패: \(error.localizedDescription)")
                self.handleTokenError(error)
                return
            }
            
            guard let token = token else {
                // print("❌ [FCM Integrity] 토큰이 nil")
                self.handleNilTokenReceived()
                return
            }
            
            // print("✅ [FCM Integrity] 토큰 가져오기 성공: \(token.prefix(30))...")
            
            // 토큰 형식 검증
            if !self.validateTokenFormat(token) {
                // print("❌ [FCM Integrity] 토큰 형식 불량")
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
            // print("❌ [Token Validation] 토큰 길이 불량: \(token.count)")
            return false
        }
        
        // 콜론 포함 여부 확인
        guard token.contains(":") else {
            // print("❌ [Token Validation] 콜론 없음")
            return false
        }
        
        // Project ID 형식 확인 (콜론 앞 부분)
        let components = token.components(separatedBy: ":")
        guard components.count == 2,
              components[0].count >= 20,
              components[1].hasPrefix("APA91b") else {
            // print("❌ [Token Validation] 프로젝트 ID 또는 APA91b 접두사 불량")
            return false
        }
        
        // print("✅ [Token Validation] 토큰 형식 검증 통과")
        return true
    }
    
    /// 토큰 에러 처리
    private func handleTokenError(_ error: Error) {
        fcmTokenRetryCount += 1
        
        if fcmTokenRetryCount < maxTokenRetryAttempts {
            // print("🔄 [FCM Error] 토큰 에러 재시도 \(fcmTokenRetryCount)/\(maxTokenRetryAttempts)")
            
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(fcmTokenRetryCount)) {
                self.performTokenIntegrityCheck()
            }
        } else {
            // print("❌ [FCM Error] 최대 재시도 초과 - FCM 서비스 재초기화")
            fcmTokenRetryCount = 0
            reinitializeFCMService()
        }
    }
    
    /// 새로운 토큰 요청
    private func requestNewToken() {
        // print("🆕 [FCM New Token] 새로운 토큰 요청 시작")
        
        // 기존 토큰 삭제
        Messaging.messaging().deleteToken { [weak self] error in
            if error != nil {
                // print("⚠️ [FCM New Token] 기존 토큰 삭제 실패: \(error.localizedDescription)")
            } else {
                // print("✅ [FCM New Token] 기존 토큰 삭제 성공")
            }
            
            // 새 토큰 요청
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self?.performTokenIntegrityCheck()
            }
        }
    }
    
    /// FCM 서비스 재초기화
    private func reinitializeFCMService() {
        // print("🔄 [FCM Reinit] FCM 서비스 재초기화 시작")
        
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


        }

        // FCM 메시지 수신 시 현재 토큰 상태 확인
        Messaging.messaging().token { [weak self] currentToken, error in
            if let currentToken = currentToken {

                // DB 토큰과 비교
                if let dbToken = UserDefaults.standard.string(forKey: "last_updated_fcm_token") {
                    if currentToken == dbToken {
                        print("✅ [메시지 수신] 토큰 일치: FCM ↔ DB")
                    } else {
                        print("⚠️ [메시지 수신] 토큰 불일치!")

                        // 토큰 불일치 시 FCM 서비스 상태 확인
                        print("🔍 [FCM Debug] 토큰 불일치로 FCM 서비스 상태 확인")
                        self?.checkFCMServiceRegistrationStatus()


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

    // MARK: - 🔍 FCM 토큰 서버 업데이트 (푸시 메시지 수신을 위해 개선)
    private func updateFCMTokenIfNeededWithCheck(token: String) {
        // 로그인 상태 확인 - 로그인 전에는 FCM 토큰 서버 등록하지 않음
        let isLoggedIn = UserDefaults.standard.bool(forKey: "is_logged_in")
        let mtIdx = UserDefaults.standard.string(forKey: "mt_idx")

        if !isLoggedIn || mtIdx == nil || mtIdx!.isEmpty {
            print("⚠️ [FCM] 로그인 상태가 아님 - FCM 토큰 서버 등록 건너뜀")
            print("   - isLoggedIn: \(isLoggedIn)")
            print("   - mtIdx: \(mtIdx ?? "nil")")
            print("   - 토큰은 로컬에 저장됨: \(token.prefix(20))...")

            // 토큰은 로컬에 저장해두고 로그인 후 등록할 수 있도록 함
            UserDefaults.standard.set(token, forKey: "pending_fcm_token_after_login")
            UserDefaults.standard.synchronize()
            return
        }

        print("✅ [FCM] 로그인 상태 확인 통과 - 서버 업데이트 진행")
        print("   - mtIdx: \(mtIdx!)")

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

        let urlString = AppConfiguration.apiBaseURL + AppConfiguration.memberFcmTokenPath
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

            // 무한 반복 방지를 위한 타임아웃 체크
            let lastFailedUpdate = UserDefaults.standard.double(forKey: "fcm_last_failed_update")
            let currentTime = Date().timeIntervalSince1970
            let timeSinceLastFailure = currentTime - lastFailedUpdate

            // 5분 이내에 실패한 기록이 있으면 더 이상 시도하지 않음
            if lastFailedUpdate > 0 && timeSinceLastFailure < 300 {
                self.fcmLog("⏰ 최근 FCM 업데이트 실패 기록 존재 - 5분 타임아웃 적용")
                self.fcmLog("📅 마지막 실패: \(Date(timeIntervalSince1970: lastFailedUpdate))")
                self.fcmLog("⏱️  경과 시간: \(Int(timeSinceLastFailure))초")
                completion(false)
                return
            }

            // 실패 시간 기록
            UserDefaults.standard.set(currentTime, forKey: "fcm_last_failed_update")
            UserDefaults.standard.synchronize()

            completion(false)
            return
        }

        // ✅ FCM 토큰 변경 방지 로직 - 자동 동기화를 위해 제거
        // 토큰 동기화가 우선이므로 변경 방지 로직을 비활성화
        print("🔄 [FCM API] 토큰 자동 동기화 모드 - 변경 방지 로직 건너뜀")

        // UserDefaults에서 mt_idx 가져오기 (여러 키에서 시도)
        var mtIdx = UserDefaults.standard.string(forKey: "mt_idx") ??
                   UserDefaults.standard.string(forKey: "savedMtIdx") ??
                   UserDefaults.standard.string(forKey: "current_mt_idx")

        guard let foundMtIdx = mtIdx, !foundMtIdx.isEmpty else {
            print("❌ [FCM API] 로그인 상태이지만 mt_idx를 찾을 수 없음 - 업데이트 건너뜀")
            completion(false)
            return
        }

        // mt_idx 값 검증 - 숫자형식인지 확인
        guard let mtIdxInt = Int(foundMtIdx), mtIdxInt > 0 else {
            print("❌ [FCM API] 잘못된 mt_idx 형식: \(foundMtIdx) - 업데이트 건너뜀")
            completion(false)
            return
        }

        // mt_idx 값 검증 완료 - 유효한 숫자형식이면 FCM 토큰 업데이트 진행

        mtIdx = foundMtIdx
        print("✅ [FCM API] mt_idx 검증 통과: \(foundMtIdx)")
        
        // 🔗 APNs 토큰도 함께 전송 (필수)
        var requestData: [String: Any] = [
            "mt_idx": foundMtIdx,
            "fcm_token": token
        ]

        // 🔴 APNs 토큰 확인 (백그라운드에서는 UserDefaults 우선 사용)
        let apnsToken = currentAPNSToken ?? UserDefaults.standard.string(forKey: "last_apns_token")

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
        let urlString = AppConfiguration.apiBaseURL + AppConfiguration.memberFcmTokenPath
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

                    // FCM 토큰 등록 성공 시 실패 기록 및 재시도 횟수 초기화
                    UserDefaults.standard.removeObject(forKey: "fcm_last_failed_update")
                    UserDefaults.standard.set(0, forKey: "fcm_retry_count")
                    UserDefaults.standard.synchronize()
                    self.fcmLog("🧹 FCM 토큰 등록 성공 - 실패 기록 및 재시도 횟수 초기화")

                    // 웹뷰에 FCM 토큰 등록 성공 알림 전송
                    DispatchQueue.main.async {
                        self.notifyWebViewFCMTokenRegistrationSuccess()
                    }

                    // 성공 completion 호출
                    completion(true)
                } else {
                    self.fcmLog("❌ FCM 토큰 서버 업데이트 실패 - 상태 코드: \(httpResponse.statusCode)")

                    // 🔒 실패 시에도 플래그 해제
                    UserDefaults.standard.set(false, forKey: "fcm_update_in_progress")
                    UserDefaults.standard.synchronize()
                    self.fcmLog("🔓 FCM 토큰 업데이트 실패로 인한 플래그 해제됨")

                    // 404 에러 특별 처리 - 사용자에게 앱 재시작 유도
                    if httpResponse.statusCode == 404 {
                        self.fcmLog("🚨 404 에러 감지 - FCM 토큰 등록 실패로 인한 사용자 안내 필요")

                        // 웹뷰에 FCM 토큰 등록 실패 알림 전송
                        DispatchQueue.main.async {
                            self.notifyWebViewFCMTokenRegistrationFailed(reason: "user_not_found")
                        }
                    }

                    // 타임아웃 적용 중인 경우 사용자 안내
                    let lastFailedUpdate = UserDefaults.standard.double(forKey: "fcm_last_failed_update")
                    let currentTime = Date().timeIntervalSince1970
                    let timeSinceLastFailure = currentTime - lastFailedUpdate

                    if lastFailedUpdate > 0 && timeSinceLastFailure < 300 {
                        self.fcmLog("⏰ FCM 업데이트 타임아웃 적용 중 - 사용자에게 안내 필요")

                        DispatchQueue.main.async {
                            self.notifyWebViewFCMTokenRegistrationFailed(reason: "timeout_active")
                        }
                    }

                    // 실패 completion 호출
                    completion(false)
                }
            }
        }
        
        task.resume()
    }

    /**
     * 웹뷰에 FCM 토큰 등록 실패 알림 전송
     */
    private func notifyWebViewFCMTokenRegistrationFailed(reason: String) {
        print("🚨 [FCM] 웹뷰에 FCM 토큰 등록 실패 알림 전송 - 이유: \(reason)")

        guard let webView = findWebViewInHierarchy() else {
            print("❌ [FCM] WebView를 찾을 수 없음 - FCM 토큰 등록 실패 알림 전송 건너뜀")
            return
        }

        DispatchQueue.main.async {
            let messageData = [
                "type": "fcm_token_registration_failed",
                "reason": reason,
                "message": "FCM 토큰 등록에 실패했습니다. 앱을 재시작해주세요.",
                "timestamp": Date().timeIntervalSince1970
            ] as [String: Any]

            if let jsonData = try? JSONSerialization.data(withJSONObject: messageData),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                let jsCode = "window.dispatchEvent(new CustomEvent('fcmTokenRegistrationFailed', { detail: \(jsonString) }));"
                webView.evaluateJavaScript(jsCode) { result, error in
                    if let error = error {
                        print("❌ [FCM] FCM 토큰 등록 실패 알림 WebView 전달 실패: \(error.localizedDescription)")
                    } else {
                        print("✅ [FCM] FCM 토큰 등록 실패 알림 WebView 전달 성공")
                    }
                }
            }
        }
    }

    /**
     * 웹뷰에 FCM 토큰 등록 성공 알림 전송
     */
    private func notifyWebViewFCMTokenRegistrationSuccess() {
        print("✅ [FCM] 웹뷰에 FCM 토큰 등록 성공 알림 전송")

        guard let webView = findWebViewInHierarchy() else {
            print("❌ [FCM] WebView를 찾을 수 없음 - FCM 토큰 등록 성공 알림 전송 건너뜀")
            return
        }

        DispatchQueue.main.async {
            let messageData = [
                "type": "fcm_token_registration_success",
                "message": "FCM 토큰이 성공적으로 등록되었습니다.",
                "timestamp": Date().timeIntervalSince1970
            ] as [String: Any]

            if let jsonData = try? JSONSerialization.data(withJSONObject: messageData),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                let jsCode = "window.dispatchEvent(new CustomEvent('fcmTokenRegistrationSuccess', { detail: \(jsonString) }));"
                webView.evaluateJavaScript(jsCode) { result, error in
                    if let error = error {
                        print("❌ [FCM] FCM 토큰 등록 성공 알림 WebView 전달 실패: \(error.localizedDescription)")
                    } else {
                        print("✅ [FCM] FCM 토큰 등록 성공 알림 WebView 전달 성공")
                    }
                }
            }
        }
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
        let urlString = AppConfiguration.apiBaseURL + AppConfiguration.memberFcmTokenPath
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
        let urlString = AppConfiguration.apiBaseURL + AppConfiguration.memberFcmTokenPath
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
        UNUserNotificationCenter.current().setBadgeCount(0)

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
        return DeepLinkService.shared.handleURL(url)
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
        guard let window = (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.windows.first else { return nil }

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
        var baseUrl = AppConfiguration.apiBaseURL

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

    // MARK: - 🔄 FCM 토큰 강제 동기화
    private func forceSyncFCMTokenWithDB() {

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
        let urlString = AppConfiguration.apiBaseURL + AppConfiguration.memberFcmTokenPath
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
        let task = session.dataTask(with: request) { data, response, error in
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
                    
                    // 서버 응답에서 만료 시간 추출 및 저장
                    if let data = data {
                        do {
                            if let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                                // token_expiry_date 추출 및 저장
                                if let tokenExpiryDate = json["token_expiry_date"] as? String {
                                    UserDefaults.standard.set(tokenExpiryDate, forKey: "server_token_expiry_date")
                                    print("📅 [FCM Request] 서버 토큰 만료 시간 저장: \(tokenExpiryDate)")
                                }
                                
                                // 추가 정보도 저장
                                if let tokenUpdatedAt = json["token_updated_at"] as? String {
                                    UserDefaults.standard.set(tokenUpdatedAt, forKey: "server_token_updated_at")
                                }
                                
                                UserDefaults.standard.synchronize()
                            }
                        } catch {
                            print("⚠️ [FCM Request] 서버 응답 파싱 실패: \(error)")
                        }
                    }
                    
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


// MARK: - 🚀 AppDelegate 백그라운드 푸시 최적화 Extension
extension AppDelegate {
    
    /// 백그라운드 앱 새로고침 설정
    func setupBackgroundAppRefresh() {
        
        // 백그라운드 앱 새로고침 권한 요청 (iOS 15+ Target: Deprecated API 제거, rely on default/BGTasks)
        // UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
        
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
    
    /// 즉시 로컬 알림 표시 (백그라운드 상태용)
    private func scheduleImmediateLocalNotification(userInfo: [AnyHashable: Any]) {
        print("🔔 [FCM] 즉시 로컬 알림 스케줄링 시작")
        
        // let center = UNUserNotificationCenter.current()
        
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
        content.categoryIdentifier = "GENERAL_NOTIFICATION"
        content.userInfo = userInfo
        
        // 즉시 트리거 (0.1초 후)
        // let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        
        // 고유 식별자 생성
        let identifier = "fcm_immediate_\(Int(Date().timeIntervalSince1970))"
        
        // 중복 알림 방지 - 즉시 로컬 알림 생성 비활성화 
        print("🚫 [FCM] 중복 방지를 위해 즉시 로컬 알림 생성 건너뛰기")
        print("📝 [FCM] 식별자: \(identifier) - 즉시 알림 생성하지 않음")
    }
    
    // MARK: - 백그라운드 FCM 토큰 관리 및 연결 유지
    
    private func setupBackgroundFCMTokenManagement() {
        isAppInBackground = true
        backgroundSessionStartTime = Date()
        
        print("🌙 [FCM BACKGROUND] 백그라운드 토큰 관리 준비 시작")
        
        // 백그라운드 작업 시작 (25초 제한으로 안전하게)
        backgroundTaskIdentifier = UIApplication.shared.beginBackgroundTask(withName: "FCMTokenBackgroundTask") {
            print("⏰ [FCM BACKGROUND] 백그라운드 작업 시간 만료")
            UIApplication.shared.endBackgroundTask(self.backgroundTaskIdentifier)
            self.backgroundTaskIdentifier = .invalid
        }
        
        // 25초 후 자동 종료 (iOS 30초 제한 전에 안전하게)
        DispatchQueue.main.asyncAfter(deadline: .now() + 25.0) { [weak self] in
            self?.stopBackgroundKeepAlive()
        }
        
        // 백그라운드에서 토큰 갱신 타이머 시작
        startBackgroundTokenRefreshTimer()
        
        // 토큰 만료일 확인 후 필요한 경우에만 서버 전송
        checkTokenExpiryDateFromServer { [weak self] isExpired in
            guard let self = self, isExpired else {
                print("✅ [Background] 토큰 아직 유효함 - 백그라운드 진입 시 전송 건너뛰기")
                return
            }
            
            print("⚠️ [Background] 토큰 만료됨 - 백그라운드 진입 시 토큰 전송")
            if let currentToken = self.currentFCMToken {
                self.updateFCMTokenToServerSilently(token: currentToken, reason: "background_entry_expired")
            }
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
        if currentFCMToken != nil {
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
        
        print("🔄 [Background] 백그라운드 토큰 갱신 시작")
        
        // 먼저 서버에서 현재 토큰 만료일 확인
        checkTokenExpiryDateFromServer { [weak self] isExpired in
            guard let self = self, isExpired else {
                print("✅ [Background] 토큰 아직 만료되지 않음 - 업데이트 건너뛰기")
                return
            }
            
            print("⚠️ [Background] 토큰 만료 확인됨 - 토큰 재전송 필요")
            // 기존 토큰 재전송으로 대체
            if let token = self.currentFCMToken {
                self.updateFCMTokenToServerSilently(token: token, reason: "background_token_expired")
            }
        }
    }
    
    /// 서버에서 토큰 만료일 확인
    private func checkTokenExpiryDateFromServer(completion: @escaping (Bool) -> Void) {
        guard let userIdx = UserDefaults.standard.object(forKey: "user_id") ?? UserDefaults.standard.object(forKey: "mt_idx") else {
            print("❌ [Background] 사용자 ID를 찾을 수 없음")
            completion(false)
            return
        }
        
        let urlString = "https://api3.smap.site/api/v1/member-fcm-token/status/\(userIdx)"
        guard let url = URL(string: urlString) else {
            print("❌ [Background] 토큰 상태 확인 URL 생성 실패")
            completion(false)
            return
        }
        
        print("🔍 [Background] 서버에서 토큰 만료일 확인 중...")
        
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                print("❌ [Background] 토큰 상태 확인 요청 실패: \(error.localizedDescription)")
                completion(false)
                return
            }
            
            guard let data = data else {
                print("❌ [Background] 토큰 상태 확인 응답 데이터 없음")
                completion(false)
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                    if let tokenExpiryDateString = json["token_expiry_date"] as? String {
                        let dateFormatter = ISO8601DateFormatter()
                        if let expiryDate = dateFormatter.date(from: tokenExpiryDateString) {
                            let isExpired = Date() > expiryDate
                            print("📅 [Background] 토큰 만료일: \(tokenExpiryDateString), 만료됨: \(isExpired)")
                            DispatchQueue.main.async {
                                completion(isExpired)
                            }
                            return
                        }
                    }
                    
                    // token_expiry_date가 없거나 파싱 실패 시 is_token_expired 확인
                    if let isExpired = json["is_token_expired"] as? Bool {
                        print("🏷️ [Background] 서버 토큰 만료 상태: \(isExpired)")
                        DispatchQueue.main.async {
                            completion(isExpired)
                        }
                        return
                    }
                }
                
                print("⚠️ [Background] 토큰 만료 정보 파싱 실패 - 안전하게 만료되지 않음으로 처리")
                DispatchQueue.main.async {
                    completion(false)
                }
                
            } catch {
                print("❌ [Background] 토큰 상태 응답 JSON 파싱 실패: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    completion(false)
                }
            }
        }
        
        task.resume()
    }
    
    private func updateFCMTokenToServerSilently(token: String, reason: String) {
        // mt_idx 가져오기
        guard let mtIdxString = UserDefaults.standard.string(forKey: "mt_idx") ??
                              UserDefaults.standard.string(forKey: "savedMtIdx"),
              let mtIdx = Int(mtIdxString) else {
            // print("🚫 [FCM BACKGROUND] mt_idx 없음 - 조용한 업데이트 건너뜀")
            return
        }

        // 조용한 백그라운드 업데이트 (로그 최소화)
        // URL 수정: /update -> /background-check
        // AppConfiguration.apiBaseURL 사용
        let urlString = "\(AppConfiguration.apiBaseURL)\(AppConfiguration.memberFcmTokenPath)/background-check"
        guard let url = URL(string: urlString) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Payload 수정 to match BackgroundTokenCheckRequest
        let body: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token,
            "check_type": "background",
            "force_refresh": false
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            URLSession.shared.dataTask(with: request) { _, response, _ in
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    // print("✅ [FCM BACKGROUND] 조용한 토큰 업데이트 성공")
                }
            }.resume()
        } catch {
            // print("❌ [FCM BACKGROUND] 요청 생성 실패: \(error.localizedDescription)")
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

// MARK: - Naver Map Auth Delegate
extension AppDelegate: NMFAuthManagerDelegate {
    func authorized(_ state: NMFAuthState, error: Error?) {
        if let error = error {
            print("❌ [NaverMap] Auth Error: \(error.localizedDescription)")
            print("❌ [NaverMap] Code: \((error as NSError).code)")
        } else {
            print("✅ [NaverMap] 인증 성공!")
        }
    }
}
