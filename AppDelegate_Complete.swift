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
        
        // 푸시 알림 권한 요청
        requestNotificationPermission()
        
        // 윈도우 생성
        window = UIWindow(frame: UIScreen.main.bounds)
        
        // 최적화된 WebView 컨트롤러 사용
        let webViewController = EnhancedWebViewController()
        window?.rootViewController = webViewController
        window?.makeKeyAndVisible()
        
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
    }
    
    func applicationWillTerminate(_ application: UIApplication) {
        print("🛑 [SMAP-iOS] 앱 종료")
        
        // 정리 작업
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - 🔔 푸시 알림 설정
    
    private func requestNotificationPermission() {
        print("🔔 [Firebase] 푸시 알림 권한 요청 시작")
        
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DispatchQueue.main.async {
                if granted {
                    print("✅ [Firebase] 푸시 알림 권한 허용됨")
                    self.registerForRemoteNotifications()
                } else {
                    print("❌ [Firebase] 푸시 알림 권한 거부됨")
                    if let error = error {
                        print("❌ [Firebase] 권한 요청 오류: \(error)")
                    }
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
        print("🔔 [Firebase] 디바이스 토큰: \(token)")
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
        print("🔥 [Firebase] FCM 토큰 업데이트: \(fcmToken ?? "nil")")
        
        // FCM 토큰을 서버에 전송하는 로직을 여기에 추가할 수 있습니다
        if let token = fcmToken {
            print("🔥 [Firebase] FCM 토큰: \(token)")
        }
    }
}

// MARK: - iOS 13+ SceneDelegate 지원
@available(iOS 13.0, *)
extension AppDelegate {
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
} 