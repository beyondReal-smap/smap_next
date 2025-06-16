import UIKit

@available(iOS 13.0, *)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    
    var window: UIWindow?
    
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        print("╔═══════════════════════════════════════════════════════════════════════════════╗")
        print("║ 🚀 [SMAP-iOS] Scene 연결 - iOS 13+ 최적화 버전                                ║")
        print("╚═══════════════════════════════════════════════════════════════════════════════╝")
        
        // 윈도우 설정
        window = UIWindow(windowScene: windowScene)
        
        // 최적화된 WebView 컨트롤러 사용
        let webViewController = EnhancedWebViewController()
        window?.rootViewController = webViewController
        window?.makeKeyAndVisible()
        
        // Scene 최적화 설정
        setupSceneOptimizations()
        
        print("✅ [SMAP-iOS] Scene 초기화 완료")
    }
    
    private func setupSceneOptimizations() {
        // iOS 13+ 특화 최적화
        if #available(iOS 14.0, *) {
            // iOS 14+ 기능 활성화
            print("📱 [SMAP-iOS] iOS 14+ 기능 활성화")
        }
        
        // 캐시 매니저 성능 최적화
        WebViewCacheManager.shared.optimizeForPerformance()
    }
    
    func sceneDidDisconnect(_ scene: UIScene) {
        print("🔌 [SMAP-iOS] Scene 연결 해제")
    }
    
    func sceneDidBecomeActive(_ scene: UIScene) {
        print("▶️ [SMAP-iOS] Scene 활성화")
        
        // Scene 활성화 시 최적화
        WebViewCacheManager.shared.optimizeForPerformance()
    }
    
    func sceneWillResignActive(_ scene: UIScene) {
        print("⏸️ [SMAP-iOS] Scene 비활성화 예정")
    }
    
    func sceneWillEnterForeground(_ scene: UIScene) {
        print("🔄 [SMAP-iOS] Scene 포어그라운드 진입")
    }
    
    func sceneDidEnterBackground(_ scene: UIScene) {
        print("🔄 [SMAP-iOS] Scene 백그라운드 진입")
        
        // 백그라운드 진입 시 캐시 정리
        WebViewCacheManager.shared.clearExpiredCache()
    }
} 