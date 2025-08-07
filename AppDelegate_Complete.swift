import UIKit
import UserNotifications
import Firebase

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        print("╔═══════════════════════════════════════════════════════════════════════════════╗")
        print("║ 🚀 [SMAP-iOS] 앱 시작 - 완전 최적화 버전                                       ║")
        print("╚═══════════════════════════════════════════════════════════════════════════════╝")
        
        // Firebase 설정
        FirebaseApp.configure()
        print("🔥 [Firebase] Firebase 초기화 완료")
        
        // Firebase Messaging 델리게이트 설정
        Messaging.messaging().delegate = self
        
        // Firebase 초기화 완료 후 푸시 알림 권한 요청 (약간의 지연)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.requestNotificationPermission()
        }
        
        // 윈도우 생성
        window = UIWindow(frame: UIScreen.main.bounds)
        
        // 최적화된 WebView 컨트롤러 사용
        print("🔥🔥🔥 [CRITICAL] AppDelegate에서 EnhancedWebViewController 생성 시작! 🔥🔥🔥")
        let webViewController = EnhancedWebViewController()
        print("🔥🔥🔥 [CRITICAL] EnhancedWebViewController 생성 완료! 🔥🔥🔥")
        window?.rootViewController = webViewController
        print("🔥🔥🔥 [CRITICAL] rootViewController 설정 완료! 🔥🔥🔥")
        window?.makeKeyAndVisible()
        print("🔥🔥🔥 [CRITICAL] window 표시 완료! 🔥🔥🔥")
        
        // 앱 설정 최적화
        setupAppOptimizations()
        
        print("✅ [SMAP-iOS] 앱 초기화 완료")
        return true
    }
    
    private func setupAppOptimizations() {
        // 1. 메모리 관리 최적화
        setupMemoryManagement()
        
        // 2. 네트워크 설정 최적화
        setupNetworkOptimizations()
        
        // 3. 캐시 초기화
        initializeCacheManager()
    }
    
    private func setupMemoryManagement() {
        // 메모리 경고 알림 등록
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { _ in
            print("⚠️ [SMAP-iOS] 메모리 경고 수신, 캐시 정리 수행")
            WebViewCacheManager.shared.clearExpiredCache()
        }
        
        // 백그라운드 진입 시 최적화
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { _ in
            print("🔄 [SMAP-iOS] 백그라운드 진입, 리소스 정리")
            WebViewCacheManager.shared.optimizeForPerformance()
        }
    }
    
    private func setupNetworkOptimizations() {
        // URL 캐시 설정
        let cacheSize = 50 * 1024 * 1024 // 50MB
        let cache = URLCache(memoryCapacity: cacheSize / 2, diskCapacity: cacheSize)
        URLCache.shared = cache
        
        print("🌐 [SMAP-iOS] 네트워크 캐시 설정 완료 (50MB)")
    }
    
    private func initializeCacheManager() {
        // 캐시 매니저 초기화 및 성능 최적화
        WebViewCacheManager.shared.optimizeForPerformance()
        
        // 중요 리소스 사전 로드 (백그라운드에서)
        DispatchQueue.global(qos: .background).async {
            WebViewCacheManager.shared.preloadCriticalResources()
        }
        
        print("💾 [SMAP-iOS] 캐시 매니저 초기화 완료")
    }
    
    // MARK: - 앱 생명주기 최적화
    
    func applicationWillResignActive(_ application: UIApplication) {
        print("⏸️ [SMAP-iOS] 앱이 비활성화됨")
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        print("🔄 [SMAP-iOS] 백그라운드 진입")
        
        // 백그라운드 태스크로 캐시 정리
        var backgroundTask: UIBackgroundTaskIdentifier = .invalid
        backgroundTask = application.beginBackgroundTask {
            application.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
        
        DispatchQueue.global(qos: .background).async {
            WebViewCacheManager.shared.clearExpiredCache()
            application.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }
    
    func applicationWillEnterForeground(_ application: UIApplication) {
        print("🔄 [SMAP-iOS] 포어그라운드 진입")
    }
    
    func applicationDidBecomeActive(_ application: UIApplication) {
        print("▶️ [SMAP-iOS] 앱이 활성화됨")
        
        // 앱 활성화 시 성능 최적화
        WebViewCacheManager.shared.optimizeForPerformance()
        
        // 앱이 활성화될 때마다 푸시 알림 권한 상태 확인
        checkCurrentNotificationStatus()
    }
    
    func applicationWillTerminate(_ application: UIApplication) {
        print("🛑 [SMAP-iOS] 앱 종료")
        
        // 정리 작업
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - 🔔 푸시 알림 설정
    
    private func requestNotificationPermission() {
        print("🔔 [Firebase] 푸시 알림 권한 처리 시작")
        
        let center = UNUserNotificationCenter.current()
        
        // 먼저 현재 권한 상태를 확인
        center.getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔔 [Firebase] 현재 알림 권한 상태: \(settings.authorizationStatus.rawValue)")
                print("🔔 [Firebase] 알림 권한 상태 상세:")
                print("   - authorizationStatus: \(self.authorizationStatusString(settings.authorizationStatus))")
                print("   - notificationCenterSetting: \(settings.notificationCenterSetting.rawValue)")
                print("   - lockScreenSetting: \(settings.lockScreenSetting.rawValue)")
                print("   - carPlaySetting: \(settings.carPlaySetting.rawValue)")
                print("   - alertSetting: \(settings.alertSetting.rawValue)")
                print("   - badgeSetting: \(settings.badgeSetting.rawValue)")
                print("   - soundSetting: \(settings.soundSetting.rawValue)")
                
                switch settings.authorizationStatus {
                case .authorized, .provisional:
                    print("✅ [Firebase] 푸시 알림 권한이 이미 허용되어 있음")
                    self.registerForRemoteNotifications()
                    
                case .denied:
                    print("❌ [Firebase] 푸시 알림 권한이 거부되어 있음")
                    print("❌ [Firebase] 사용자가 설정에서 직접 권한을 허용해야 합니다")
                    print("❌ [Firebase] 권한 거부로 인해 APNS 등록을 건너뜁니다")
                    
                case .notDetermined:
                    print("🔄 [Firebase] 푸시 알림 권한이 아직 결정되지 않음 - 권한 요청 시작")
                    self.performActualPermissionRequest()
                    
                case .ephemeral:
                    print("⏱️ [Firebase] 임시 푸시 알림 권한")
                    self.registerForRemoteNotifications()
                    
                @unknown default:
                    print("❓ [Firebase] 알 수 없는 푸시 알림 권한 상태")
                    self.performActualPermissionRequest()
                }
            }
        }
    }
    
    private func performActualPermissionRequest() {
        print("🔔 [Firebase] 실제 푸시 알림 권한 요청 시작")
        
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DispatchQueue.main.async {
                print("🔔 [Firebase] 푸시 알림 권한 요청 결과 수신")
                print("🔔 [Firebase] 권한 허용 여부: \(granted)")
                
                if let error = error {
                    print("❌ [Firebase] 권한 요청 중 오류 발생: \(error.localizedDescription)")
                    print("❌ [Firebase] 오류 상세: \(error)")
                }
                
                if granted {
                    print("✅ [Firebase] 사용자가 푸시 알림 권한을 허용함")
                    self.registerForRemoteNotifications()
                } else {
                    print("❌ [Firebase] 사용자가 푸시 알림 권한을 거부함")
                    
                    // 권한 거부 후 현재 상태를 다시 확인
                    center.getNotificationSettings { newSettings in
                        DispatchQueue.main.async {
                            print("❌ [Firebase] 권한 거부 후 현재 상태: \(self.authorizationStatusString(newSettings.authorizationStatus))")
                        }
                    }
                }
            }
        }
    }
    
    private func authorizationStatusString(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined:
            return "notDetermined (결정되지 않음)"
        case .denied:
            return "denied (거부됨)"
        case .authorized:
            return "authorized (허용됨)"
        case .provisional:
            return "provisional (임시 허용)"
        case .ephemeral:
            return "ephemeral (임시)"
        @unknown default:
            return "unknown (알 수 없음)"
        }
    }
    
    private func checkCurrentNotificationStatus() {
        print("🔍 [Firebase] 현재 푸시 알림 권한 상태 확인 시작")
        
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔍 [Firebase] 앱 활성화 시 권한 상태: \(self.authorizationStatusString(settings.authorizationStatus))")
                
                switch settings.authorizationStatus {
                case .authorized, .provisional:
                    print("✅ [Firebase] 푸시 알림 권한이 허용되어 있음 - 토큰 갱신 확인")
                    // 권한이 허용되어 있으면 토큰이 제대로 등록되어 있는지 확인
                    self.checkFirebaseTokenStatus()
                    
                case .denied:
                    print("❌ [Firebase] 푸시 알림 권한이 거부되어 있음")
                    print("❌ [Firebase] APNS 토큰 없이 FCM 토큰 가져오기 건너뜁니다")
                    
                case .notDetermined:
                    print("🔄 [Firebase] 푸시 알림 권한이 아직 결정되지 않음")
                    
                case .ephemeral:
                    print("⏱️ [Firebase] 임시 푸시 알림 권한")
                    
                @unknown default:
                    print("❓ [Firebase] 알 수 없는 푸시 알림 권한 상태")
                }
            }
        }
    }
    
    private func checkFirebaseTokenStatus() {
        print("🔍 [Firebase] FCM 토큰 상태 확인")
        
        // 푸시 알림 권한 상태를 먼저 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                if settings.authorizationStatus == .denied {
                    print("❌ [Firebase] 푸시 권한 거부됨 - FCM 토큰 확인 건너뜀")
                    return
                }
                
                print("🔍 [Firebase] 권한 허용됨 - FCM 토큰 가져오기 시도")
                self.performTokenCheck()
            }
        }
    }
    
    private func performTokenCheck() {
        Messaging.messaging().token { token, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ [Firebase] FCM 토큰 가져오기 실패: \(error.localizedDescription)")
                } else if let token = token {
                    print("✅ [Firebase] 현재 FCM 토큰 확인됨")
                    print("🔔 [Firebase] FCM 토큰: \(token)")
                    
                    // 사용자가 제공한 토큰과 비교
                    let userProvidedToken = "fz6CAxDq4UVBmoaEdMtIHZ:APA91bG3i8_fwzaYnHOn9zQVLQdtZ0ZsmFY9EY0U1VGO1CPePWMTjsY1ls6Gpu6Dj44jDIq35AW-uZMWj6NjwO0lWV0O8RqWcvhuCez4Pv_jvncLg98zzFI"
                    if token == userProvidedToken {
                        print("✅ [Firebase] 토큰이 사용자 제공 토큰과 일치함")
                    } else {
                        print("⚠️ [Firebase] 토큰이 사용자 제공 토큰과 다름")
                        print("⚠️ [Firebase] 현재 토큰: \(token)")
                        print("⚠️ [Firebase] 제공된 토큰: \(userProvidedToken)")
                    }
                } else {
                    print("❌ [Firebase] FCM 토큰이 nil입니다")
                }
            }
        }
    }
    
    private func registerForRemoteNotifications() {
        print("🔔 [Firebase] 원격 알림 등록 시작")
        
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
    
    // MARK: - 🔔 푸시 알림 델리게이트
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        print("✅ [Firebase] 디바이스 토큰 등록 성공")
        
        // Firebase에 토큰 등록
        Messaging.messaging().apnsToken = deviceToken
        
        // 토큰을 문자열로 변환하여 로그 출력
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        print("🔔 [Firebase] APNS 디바이스 토큰: \(token)")
        
        // 권한 상태를 다시 한 번 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔔 [Firebase] 토큰 등록 후 권한 상태: \(self.authorizationStatusString(settings.authorizationStatus))")
            }
        }
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ [Firebase] 원격 알림 등록 실패: \(error)")
    }
    
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("🔔 [Firebase] 푸시 알림 수신: \(userInfo)")
        completionHandler(.newData)
    }
}

// MARK: - 🔔 Firebase Messaging 델리게이트
extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("🔥 [Firebase] FCM 토큰 업데이트 델리게이트 호출됨")
        print("🔥 [Firebase] 새로운 FCM 토큰: \(fcmToken ?? "nil")")
        
        // 권한 상태 확인 먼저
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("🔥 [Firebase] 토큰 업데이트 시 권한 상태: \(self.authorizationStatusString(settings.authorizationStatus))")
                
                if settings.authorizationStatus == .denied {
                    print("❌ [Firebase] 경고: FCM 토큰은 있지만 푸시 알림 권한이 거부됨!")
                    print("❌ [Firebase] 토큰: \(fcmToken ?? "nil")")
                    return
                }
                
                if let token = fcmToken {
                    self.handleValidFCMToken(token, settings: settings)
                } else {
                    print("❌ [Firebase] FCM 토큰이 nil입니다 - Firebase 설정을 확인해주세요")
                }
            }
        }
    }
    
    private func handleValidFCMToken(_ token: String, settings: UNNotificationSettings) {
        print("✅ [Firebase] 유효한 FCM 토큰 수신됨")
        print("🔔 [Firebase] FCM 토큰 전체: \(token)")
        
        // 사용자가 제공한 토큰과 비교
        let userProvidedToken = "fz6CAxDq4UVBmoaEdMtIHZ:APA91bG3i8_fwzaYnHOn9zQVLQdtZ0ZsmFY9EY0U1VGO1CPePWMTjsY1ls6Gpu6Dj44jDIq35AW-uZMWj6NjwO0lWV0O8RqWcvhuCez4Pv_jvncLg98zzFI"
        if token == userProvidedToken {
            print("✅ [Firebase] 새 토큰이 사용자 제공 토큰과 일치함")
        } else {
            print("⚠️ [Firebase] 새 토큰이 사용자 제공 토큰과 다름")
            print("⚠️ [Firebase] 델리게이트 토큰: \(token)")
            print("⚠️ [Firebase] 제공된 토큰: \(userProvidedToken)")
        }
        
        if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            print("✅ [Firebase] FCM 토큰과 푸시 알림 권한 모두 정상!")
        } else {
            print("⚠️ [Firebase] FCM 토큰은 있지만 권한 상태: \(authorizationStatusString(settings.authorizationStatus))")
        }
        
        // FCM 토큰을 서버에 전송하는 로직을 여기에 추가할 수 있습니다
        // 예: sendTokenToServer(token)
    }
}

// MARK: - iOS 13+ SceneDelegate 지원
@available(iOS 13.0, *)
extension AppDelegate {
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
} 