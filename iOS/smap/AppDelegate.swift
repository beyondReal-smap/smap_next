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
import SwiftyStoreKit
import GoogleSignIn
import WebKit
import KakaoSDKCommon
import KakaoSDKAuth

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    var window: UIWindow?
    
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

        
        Messaging.messaging().isAutoInitEnabled = true
        Messaging.messaging().delegate = self
        
        if #available(iOS 10.0, *) {
            // For iOS 10 display notification (sent via APNS)
            UNUserNotificationCenter.current().delegate = self
            // 앱 시작 시 자동 권한 요청 완전 비활성화 (로그인 후 MainView에서 프리퍼미션 처리)
            print("🔔 [PUSH] 런치 시 권한 요청 비활성화 - 로그인 후 처리")
        } else {
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
        return true
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
                    print("🔄 [PUSH] 권한 미결정 - 권한 요청 시작")
                    self.requestPushNotificationPermission()
                    
                case .ephemeral:
                    print("⏱️ [PUSH] 임시 권한")
                    UIApplication.shared.registerForRemoteNotifications()
                    
                @unknown default:
                    print("❓ [PUSH] 알 수 없는 권한 상태")
                    self.requestPushNotificationPermission()
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
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔍 [PUSH] 앱 활성화 시 권한 상태: \(self.authorizationStatusString(settings.authorizationStatus))")
                
                // Firebase 토큰과 함께 상태 출력
                if let token = Messaging.messaging().fcmToken {
                    print("🔔 [PUSH] 현재 FCM 토큰: \(token)")
                    
                    if settings.authorizationStatus == .denied {
                        print("❌ [PUSH] 경고: FCM 토큰은 있지만 권한이 거부됨!")
                    } else if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                        print("✅ [PUSH] FCM 토큰과 권한 모두 정상!")
                    }
                } else {
                    print("❌ [PUSH] FCM 토큰이 없음")
                }
            }
        }
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
            WKWebsiteDataStore.default().removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: Date.distantPast) { }
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
        
        // 푸시 알림 권한 상태 확인
        checkPushNotificationStatus()
    }

    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        // 세로방향 고정
        return UIInterfaceOrientationMask.portrait
    }
    
    //앱이 현재 화면에서 실행되고 있을 때
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        print("Handle push from foreground")
        print("\(notification.request.content.userInfo)")
        
        self.title = "\(notification.request.content.userInfo["title"] ?? String())"
        self.body = "\(notification.request.content.userInfo["body"] ?? String())"
        self.event_url = "\(notification.request.content.userInfo["event_url"] ?? String())"
        
        print("title - \(self.title) body - \(self.body) event_url - \(self.event_url)")
        
        if let navigationController = self.window?.rootViewController as? UINavigationController {
            navigationController.popToRootViewController(animated: true)
        }
        
        let userInfo: [AnyHashable: Any] = ["title":self.title, "body": self.body, "event_url": self.event_url]
        UserDefaults.standard.set(self.event_url, forKey: "event_url")
        NotificationCenter.default.post(name: Notification.Name("getPush"), object: nil, userInfo: userInfo)
        
        completionHandler([.alert, .sound, .badge])
    }
    
    //앱은 꺼져있지만 완전히 종료되지 않고 백그라운드에서 실행중일 때
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        print("Handle push from background or closed")
        print("\(response.notification.request.content.userInfo)")
    
        self.title = "\(response.notification.request.content.userInfo["title"] ?? String())"
        self.body = "\(response.notification.request.content.userInfo["body"] ?? String())"
        self.event_url = "\(response.notification.request.content.userInfo["event_url"] ?? String())"
        
        if let navigationController = self.window?.rootViewController as? UINavigationController {
            navigationController.popToRootViewController(animated: true)
        }
        
        let userInfo: [AnyHashable: Any] = ["title":self.title, "body": self.body, "event_url": self.event_url]
        UserDefaults.standard.set(self.event_url, forKey: "event_url")
        NotificationCenter.default.post(name: Notification.Name("getPush"), object: nil, userInfo: userInfo)
        completionHandler()
    }
    
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any]) {
        print("Push notification received: \(userInfo)")
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        
        Messaging.messaging().appDidReceiveMessage(userInfo)
        completionHandler(UIBackgroundFetchResult.newData)
    }                                          

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().setAPNSToken(deviceToken as Data, type: .unknown)
        print("didRegisterForRemoteNotificationsWithDeviceToken -- 1", Messaging.messaging().apnsToken ?? String())
        
        guard let token = Messaging.messaging().fcmToken else { return }
        Utils.shared.setToken(token: token)
        print("token --> \(token)")
    }
    
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else {return}
        Utils.shared.setToken(token: token)

        print("🔥 [FCM] Firebase registration token: \(token)")
        print("🔥 [FCM] 토큰 길이: \(token.count) 문자")
        print("🔥 [FCM] 토큰 미리보기: \(token.prefix(30))...")
        
        // 🚀 직접 API 호출로 FCM 토큰을 서버에 업데이트
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.updateFCMTokenToServer(token: token)
        }
    }
    
    // MARK: - 🚀 FCM 토큰 직접 API 업데이트
    
    private func updateFCMTokenToServer(token: String) {
        print("🚀 [FCM API] FCM 토큰 서버 업데이트 시작")
        
        // 현재 로그인된 사용자 정보 가져오기
        guard let currentUserMtIdx = getCurrentUserMtIdx() else {
            print("❌ [FCM API] 현재 사용자 정보를 찾을 수 없음 - 나중에 재시도")
            // 5초 후 재시도
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                self.retryFCMTokenUpdate(token: token, retryCount: 1)
            }
            return
        }
        
        sendFCMTokenToServer(token: token, mtIdx: currentUserMtIdx)
    }
    
    private func getCurrentUserMtIdx() -> Int? {
        // 방법 1: UserDefaults에서 사용자 정보 확인
        if let mtIdx = UserDefaults.standard.object(forKey: "mt_idx") as? Int {
            print("🔍 [FCM API] UserDefaults에서 mt_idx 찾음: \(mtIdx)")
            return mtIdx
        }
        
        // 방법 2: Utils에서 사용자 정보 확인 (기존 방식)
        // Utils.shared에서 사용자 정보를 가져오는 로직 (존재하는 경우)
        
        // 방법 3: 하드코딩된 테스트 사용자 (임시)
        print("⚠️ [FCM API] 사용자 정보 없음 - 테스트 사용자(1186) 사용")
        return 1186
    }
    
    private func sendFCMTokenToServer(token: String, mtIdx: Int) {
        print("🌐 [FCM API] 서버로 토큰 전송 시작 - mt_idx: \(mtIdx)")
        
        // API 엔드포인트 URL
        guard let url = URL(string: "https://api3.smap.site/api/v1/member-fcm-token/check-and-update") else {
            print("❌ [FCM API] 잘못된 URL")
            return
        }
        
        // 요청 데이터 구성
        let requestData: [String: Any] = [
            "mt_idx": mtIdx,
            "fcm_token": token
        ]
        
        // HTTP 요청 설정
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("SMAP-iOS-App", forHTTPHeaderField: "User-Agent")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: requestData)
        } catch {
            print("❌ [FCM API] JSON 직렬화 실패: \(error.localizedDescription)")
            return
        }
        
        // API 호출
        let session = URLSession.shared
        let task = session.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [FCM API] 네트워크 오류: \(error.localizedDescription)")
                    // 재시도
                    self.retryFCMTokenUpdate(token: token, retryCount: 1)
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ [FCM API] 잘못된 응답")
                    return
                }
                
                print("🌐 [FCM API] HTTP 응답 코드: \(httpResponse.statusCode)")
                
                if let data = data {
                    do {
                        if let jsonResponse = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                            print("📋 [FCM API] 서버 응답: \(jsonResponse)")
                            
                            if let success = jsonResponse["success"] as? Bool, success {
                                print("✅ [FCM API] FCM 토큰 업데이트 성공!")
                                
                                // 성공 후 확인
                                self.verifyFCMTokenUpdate(mtIdx: mtIdx)
                            } else {
                                let message = jsonResponse["message"] as? String ?? "알 수 없는 오류"
                                print("❌ [FCM API] 서버 오류: \(message)")
                            }
                        }
                    } catch {
                        print("❌ [FCM API] JSON 파싱 오류: \(error.localizedDescription)")
                    }
                }
            }
        }
        
        task.resume()
        print("🚀 [FCM API] API 요청 전송됨")
    }
    
    private func retryFCMTokenUpdate(token: String, retryCount: Int) {
        let maxRetries = 3
        
        if retryCount > maxRetries {
            print("❌ [FCM API] 최대 재시도 횟수 초과")
            return
        }
        
        print("🔄 [FCM API] FCM 토큰 업데이트 재시도 \(retryCount)/\(maxRetries)")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(retryCount) * 5.0) {
            self.updateFCMTokenToServer(token: token)
        }
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
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }
    
    func applicationWillEnterForeground(_ application: UIApplication) {
        UIApplication.shared.applicationIconBadgeNumber = 0
        
        let userInfo: [AnyHashable: Any] = ["state": "foreground"]

        NotificationCenter.default.post(name: Notification.Name("appStateChange"), object: nil, userInfo: userInfo)
        NotificationCenter.default.post(name: Notification.Name("appStateForeground"), object: nil, userInfo: nil)
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
}
