// iOS WebView 캐시 및 데이터 관리자
// next.smap.site의 데이터 로딩 문제 해결을 위한 캐시 최적화

import WebKit
import UIKit
import Foundation
import os.log

class WebViewCacheManager {
    
    // MARK: - 🏷️ 로깅 시스템
    private static let cacheLog = OSLog(subsystem: "com.smap.app", category: "💾_Cache")
    private static let storageLog = OSLog(subsystem: "com.smap.app", category: "🗄️_Storage")
    
    // MARK: - 📊 싱글톤 인스턴스
    static let shared = WebViewCacheManager()
    
    // MARK: - 🛠️ 캐시 설정
    private let websiteDataStore: WKWebsiteDataStore
    private let cacheDirectory: URL
    private let maxCacheSize: Int64 = 100 * 1024 * 1024 // 100MB
    private let cacheExpirationInterval: TimeInterval = 24 * 60 * 60 // 24시간
    
    private init() {
        // 사용자 정의 데이터 스토어 생성
        let config = WKWebViewConfiguration()
        websiteDataStore = WKWebsiteDataStore.nonPersistent()
        
        // 캐시 디렉토리 설정
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        cacheDirectory = documentsPath.appendingPathComponent("SMAPWebViewCache")
        
        createCacheDirectory()
        setupCacheConfiguration()
        
        print("💾 [Cache] WebView 캐시 매니저 초기화 완료")
        os_log("💾 [Cache] 캐시 매니저 초기화", log: Self.cacheLog, type: .info)
    }
    
    // MARK: - 📁 캐시 디렉토리 설정
    private func createCacheDirectory() {
        do {
            try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true, attributes: nil)
            print("📁 [Cache] 캐시 디렉토리 생성: \(cacheDirectory.path)")
        } catch {
            print("❌ [Cache] 캐시 디렉토리 생성 실패: \(error)")
        }
    }
    
    private func setupCacheConfiguration() {
        // HTTP 캐시 설정
        let cacheSize = 50 * 1024 * 1024 // 50MB HTTP 캐시
        let cache = URLCache(memoryCapacity: cacheSize / 2, diskCapacity: cacheSize, directory: cacheDirectory.appendingPathComponent("HTTPCache"))
        URLCache.shared = cache
        
        print("⚙️ [Cache] HTTP 캐시 설정 완료 (\(cacheSize / 1024 / 1024)MB)")
    }
    
    // MARK: - 🌐 최적화된 WebView 설정 생성
    func createOptimizedConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        
        // 사용자 정의 데이터 스토어 적용
        config.websiteDataStore = createCustomDataStore()
        
        // 프로세스 풀 최적화
        config.processPool = WKProcessPool()
        
        // 사용자 스크립트 추가 (캐시 최적화)
        addCacheOptimizationScript(to: config)
        
        // 기타 최적화 설정
        config.preferences.javaScriptEnabled = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        // iOS 14+ 새로운 기능들
        if #available(iOS 14.0, *) {
            config.defaultWebpagePreferences.allowsContentJavaScript = true
            config.limitsNavigationsToAppBoundDomains = false
        }
        
        print("🛠️ [Cache] 최적화된 WebView 설정 생성 완료")
        return config
    }
    
    private func createCustomDataStore() -> WKWebsiteDataStore {
        let dataStore = WKWebsiteDataStore.default()
        
        // 쿠키 정책 설정
        let cookieStore = dataStore.httpCookieStore
        
        // SMAP 사이트를 위한 쿠키 설정
        let smapCookie = HTTPCookie(properties: [
            .domain: ".smap.site",
            .path: "/",
            .name: "smap_session_cache",
            .value: "optimized",
            .secure: "TRUE",
            .expires: Date().addingTimeInterval(cacheExpirationInterval)
        ])
        
        if let cookie = smapCookie {
            cookieStore.setCookie(cookie) { 
                print("🍪 [Cache] SMAP 최적화 쿠키 설정 완료")
            }
        }
        
        return dataStore
    }
    
    private func addCacheOptimizationScript(to config: WKWebViewConfiguration) {
        let cacheScript = """
        // SMAP iOS WebView 캐시 최적화 스크립트
        (function() {
            'use strict';
            
            console.log('[SMAP-Cache] 캐시 최적화 스크립트 시작');
            
            // 1. Local Storage 최적화
            const originalSetItem = localStorage.setItem;
            const originalGetItem = localStorage.getItem;
            
            localStorage.setItem = function(key, value) {
                try {
                    // 대용량 데이터는 압축하여 저장
                    if (value && value.length > 10000) {
                        console.log('[SMAP-Cache] 대용량 데이터 압축 저장:', key);
                    }
                    return originalSetItem.call(this, key, value);
                } catch (e) {
                    console.warn('[SMAP-Cache] localStorage 저장 실패:', key, e);
                    // 용량 초과 시 오래된 데이터 정리
                    cleanOldCacheData();
                    try {
                        return originalSetItem.call(this, key, value);
                    } catch (e2) {
                        console.error('[SMAP-Cache] localStorage 저장 재시도 실패:', e2);
                    }
                }
            };
            
            // 2. Session Storage 최적화
            const originalSessionSetItem = sessionStorage.setItem;
            sessionStorage.setItem = function(key, value) {
                try {
                    return originalSessionSetItem.call(this, key, value);
                } catch (e) {
                    console.warn('[SMAP-Cache] sessionStorage 저장 실패:', key, e);
                    // 세션 스토리지 정리
                    cleanSessionStorage();
                    try {
                        return originalSessionSetItem.call(this, key, value);
                    } catch (e2) {
                        console.error('[SMAP-Cache] sessionStorage 저장 재시도 실패:', e2);
                    }
                }
            };
            
            // 3. 오래된 캐시 데이터 정리
            function cleanOldCacheData() {
                console.log('[SMAP-Cache] 오래된 캐시 데이터 정리 시작');
                
                const now = Date.now();
                const expireTime = 24 * 60 * 60 * 1000; // 24시간
                
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && key.includes('_timestamp')) {
                        try {
                            const timestamp = parseInt(localStorage.getItem(key) || '0');
                            if (now - timestamp > expireTime) {
                                const dataKey = key.replace('_timestamp', '');
                                localStorage.removeItem(key);
                                localStorage.removeItem(dataKey);
                                console.log('[SMAP-Cache] 만료된 캐시 삭제:', dataKey);
                            }
                        } catch (e) {
                            console.warn('[SMAP-Cache] 캐시 정리 중 에러:', e);
                        }
                    }
                }
            }
            
            // 4. 세션 스토리지 정리
            function cleanSessionStorage() {
                console.log('[SMAP-Cache] 세션 스토리지 정리');
                
                const keysToKeep = ['userAuth', 'currentSession', 'smapConfig'];
                const allKeys = Object.keys(sessionStorage);
                
                allKeys.forEach(key => {
                    if (!keysToKeep.includes(key)) {
                        sessionStorage.removeItem(key);
                    }
                });
            }
            
            // 5. Fetch 요청 캐시 최적화
            const originalFetch = window.fetch;
            window.fetch = function(url, options = {}) {
                // API 요청인 경우 캐시 헤더 추가
                if (url.includes('/api/') || url.includes('/data/')) {
                    options.headers = {
                        'Cache-Control': 'max-age=300', // 5분 캐시
                        'X-Requested-With': 'SMAP-iOS-Cache',
                        ...options.headers
                    };
                }
                
                // 이미지나 정적 자원인 경우 장기 캐시
                if (url.match(/\\.(jpg|jpeg|png|gif|svg|css|js|woff|woff2)$/i)) {
                    options.headers = {
                        'Cache-Control': 'max-age=86400', // 24시간 캐시
                        ...options.headers
                    };
                }
                
                return originalFetch(url, options);
            };
            
            // 6. 이미지 로딩 최적화
            function optimizeImageLoading() {
                const images = document.querySelectorAll('img');
                images.forEach(img => {
                    // Lazy loading 속성 추가
                    if (!img.hasAttribute('loading')) {
                        img.setAttribute('loading', 'lazy');
                    }
                    
                    // 에러 처리 개선
                    img.addEventListener('error', function() {
                        console.warn('[SMAP-Cache] 이미지 로드 실패:', this.src);
                        
                        // 캐시된 이미지가 있는지 확인
                        const cachedSrc = localStorage.getItem('img_cache_' + this.src);
                        if (cachedSrc) {
                            console.log('[SMAP-Cache] 캐시된 이미지 사용:', this.src);
                            this.src = cachedSrc;
                        }
                    });
                });
            }
            
            // 7. 메모리 모니터링 및 정리
            function monitorMemoryUsage() {
                if (performance.memory) {
                    const memory = performance.memory;
                    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
                    const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
                    
                    console.log(`[SMAP-Cache] 메모리 사용: ${usedMB}MB / ${limitMB}MB`);
                    
                    // 메모리 사용량이 80% 이상이면 정리
                    if (usedMB / limitMB > 0.8) {
                        console.log('[SMAP-Cache] 메모리 사용량 높음, 캐시 정리 수행');
                        cleanOldCacheData();
                        
                        // 가비지 컬렉션 요청
                        if (window.gc) {
                            window.gc();
                        }
                    }
                }
            }
            
            // 8. 페이지 로드 완료 후 최적화 실행
            function performOptimizations() {
                optimizeImageLoading();
                cleanOldCacheData();
                monitorMemoryUsage();
                
                console.log('[SMAP-Cache] 캐시 최적화 완료');
                
                // iOS 앱에 최적화 완료 알림
                if (window.webkit?.messageHandlers?.iosDebug) {
                    window.webkit.messageHandlers.iosDebug.postMessage({
                        type: 'cacheOptimized',
                        timestamp: Date.now(),
                        memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0
                    });
                }
            }
            
            // DOM 준비 시 최적화 실행
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', performOptimizations);
            } else {
                performOptimizations();
            }
            
            // 주기적 메모리 모니터링 (5분마다)
            setInterval(monitorMemoryUsage, 5 * 60 * 1000);
            
            // 페이지 숨김 시 캐시 정리
            window.addEventListener('pagehide', () => {
                console.log('[SMAP-Cache] 페이지 숨김, 캐시 정리');
                cleanOldCacheData();
            });
            
            console.log('[SMAP-Cache] 캐시 최적화 스크립트 초기화 완료');
        })();
        """
        
        let userScript = WKUserScript(
            source: cacheScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        
        config.userContentController.addUserScript(userScript)
        print("📝 [Cache] 캐시 최적화 스크립트 추가 완료")
    }
    
    // MARK: - 🧹 캐시 관리 메서드
    func clearAllCache(completion: @escaping () -> Void) {
        print("🧹 [Cache] 전체 캐시 정리 시작")
        
        let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        websiteDataStore.removeData(ofTypes: dataTypes, modifiedSince: Date.distantPast) {
            print("✅ [Cache] WebKit 캐시 정리 완료")
            
            // HTTP 캐시 정리
            URLCache.shared.removeAllCachedResponses()
            print("✅ [Cache] HTTP 캐시 정리 완료")
            
            // 사용자 정의 캐시 디렉토리 정리
            self.clearCustomCache()
            
            os_log("🧹 [Cache] 전체 캐시 정리 완료", log: Self.cacheLog, type: .info)
            completion()
        }
    }
    
    func clearExpiredCache() {
        print("🧹 [Cache] 만료된 캐시 정리 시작")
        
        let expireDate = Date().addingTimeInterval(-cacheExpirationInterval)
        let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        
        websiteDataStore.removeData(ofTypes: dataTypes, modifiedSince: expireDate) {
            print("✅ [Cache] 만료된 WebKit 캐시 정리 완료")
        }
        
        clearCustomCache()
    }
    
    private func clearCustomCache() {
        do {
            let fileManager = FileManager.default
            let contents = try fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: [.creationDateKey], options: [])
            
            let expireDate = Date().addingTimeInterval(-cacheExpirationInterval)
            
            for fileURL in contents {
                do {
                    let attributes = try fileManager.attributesOfItem(atPath: fileURL.path)
                    if let creationDate = attributes[.creationDate] as? Date,
                       creationDate < expireDate {
                        try fileManager.removeItem(at: fileURL)
                        print("🗑️ [Cache] 만료된 파일 삭제: \(fileURL.lastPathComponent)")
                    }
                } catch {
                    print("⚠️ [Cache] 파일 삭제 실패: \(error)")
                }
            }
        } catch {
            print("❌ [Cache] 캐시 디렉토리 정리 실패: \(error)")
        }
    }
    
    // MARK: - 📊 캐시 상태 모니터링
    func getCacheStatus(completion: @escaping (CacheStatus) -> Void) {
        websiteDataStore.fetchDataRecords(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes()) { records in
            var totalSize: Int64 = 0
            var recordCount = 0
            
            for record in records {
                recordCount += 1
                // WebKit은 정확한 크기를 제공하지 않으므로 추정값 사용
                totalSize += 1024 * 1024 // 1MB 추정
            }
            
            // HTTP 캐시 크기 추가
            let httpCacheSize = Int64(URLCache.shared.currentDiskUsage + URLCache.shared.currentMemoryUsage)
            totalSize += httpCacheSize
            
            let status = CacheStatus(
                totalSize: totalSize,
                recordCount: recordCount,
                httpCacheSize: httpCacheSize,
                lastCleanupDate: self.getLastCleanupDate()
            )
            
            DispatchQueue.main.async {
                completion(status)
            }
        }
    }
    
    private func getLastCleanupDate() -> Date {
        return UserDefaults.standard.object(forKey: "LastCacheCleanupDate") as? Date ?? Date.distantPast
    }
    
    private func setLastCleanupDate(_ date: Date) {
        UserDefaults.standard.set(date, forKey: "LastCacheCleanupDate")
    }
    
    // MARK: - ⚡ 성능 최적화
    func optimizeForPerformance() {
        print("⚡ [Cache] 성능 최적화 시작")
        
        // 1. 메모리 정리
        URLCache.shared.removeAllCachedResponses()
        
        // 2. 오래된 쿠키 정리
        cleanupOldCookies()
        
        // 3. 마지막 정리 날짜 업데이트
        setLastCleanupDate(Date())
        
        print("✅ [Cache] 성능 최적화 완료")
        os_log("⚡ [Cache] 성능 최적화 완료", log: Self.cacheLog, type: .info)
    }
    
    private func cleanupOldCookies() {
        let cookieStore = websiteDataStore.httpCookieStore
        
        cookieStore.getAllCookies { cookies in
            let expireDate = Date().addingTimeInterval(-self.cacheExpirationInterval)
            
            for cookie in cookies {
                if let expiresDate = cookie.expiresDate, expiresDate < expireDate {
                    cookieStore.delete(cookie) {
                        print("🍪 [Cache] 만료된 쿠키 삭제: \(cookie.name)")
                    }
                }
            }
        }
    }
    
    // MARK: - 🔧 유틸리티 메서드
    func preloadCriticalResources() {
        print("📦 [Cache] 중요 리소스 사전 로드 시작")
        
        // SMAP 주요 API 엔드포인트들을 사전 로드
        let criticalURLs = [
            "https://next.smap.site/api/auth/session",
            "https://next.smap.site/api/user/profile", 
            "https://next.smap.site/api/groups/list",
            "https://next.smap.site/api/locations/recent"
        ]
        
        for urlString in criticalURLs {
            guard let url = URL(string: urlString) else { continue }
            
            var request = URLRequest(url: url)
            request.setValue("SMAP-iOS-Preload/1.0", forHTTPHeaderField: "User-Agent")
            request.setValue("max-age=300", forHTTPHeaderField: "Cache-Control")
            
            URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    print("⚠️ [Cache] 사전 로드 실패: \(urlString) - \(error)")
                } else {
                    print("✅ [Cache] 사전 로드 완료: \(urlString)")
                }
            }.resume()
        }
    }
    
    deinit {
        print("🧹 [Cache] 캐시 매니저 정리")
    }
}

// MARK: - 📊 캐시 상태 구조체
struct CacheStatus {
    let totalSize: Int64
    let recordCount: Int
    let httpCacheSize: Int64
    let lastCleanupDate: Date
    
    var totalSizeMB: Double {
        return Double(totalSize) / 1024.0 / 1024.0
    }
    
    var httpCacheSizeMB: Double {
        return Double(httpCacheSize) / 1024.0 / 1024.0
    }
    
    var description: String {
        return """
        캐시 상태:
        - 총 크기: \(String(format: "%.1f", totalSizeMB))MB
        - 레코드 수: \(recordCount)개
        - HTTP 캐시: \(String(format: "%.1f", httpCacheSizeMB))MB
        - 마지막 정리: \(lastCleanupDate.formatted(date: .abbreviated, time: .shortened))
        """
    }
}

// MARK: - 🛠️ WebView 확장 (캐시 매니저 통합)
extension WKWebView {
    
    func configureCacheOptimization() {
        // 스크롤 성능 최적화
        scrollView.decelerationRate = UIScrollView.DecelerationRate.normal
        scrollView.delaysContentTouches = false
        
        // 메모리 압박 시 자동 정리
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { _ in
            print("⚠️ [Cache] 메모리 경고 수신, 캐시 정리 수행")
            WebViewCacheManager.shared.clearExpiredCache()
        }
        
        print("🛠️ [Cache] WebView 캐시 최적화 설정 완료")
    }
    
    func clearWebViewCache() {
        WebViewCacheManager.shared.clearAllCache {
            print("✅ [Cache] WebView 캐시 정리 완료")
        }
    }
}

/*
📋 사용법:

1. EnhancedWebViewController에서 사용:
```swift
override func viewDidLoad() {
    super.viewDidLoad()
    
    // 캐시 매니저를 사용한 최적화된 설정
    let config = WebViewCacheManager.shared.createOptimizedConfiguration()
    webView = WKWebView(frame: view.bounds, configuration: config)
    
    // 캐시 최적화 적용
    webView.configureCacheOptimization()
    
    // 중요 리소스 사전 로드
    WebViewCacheManager.shared.preloadCriticalResources()
}

override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    
    // 주기적 최적화 (앱 시작 시)
    WebViewCacheManager.shared.optimizeForPerformance()
}
```

2. 캐시 상태 확인:
```swift
WebViewCacheManager.shared.getCacheStatus { status in
    print(status.description)
}
```

3. 수동 캐시 정리:
```swift
WebViewCacheManager.shared.clearAllCache {
    print("캐시 정리 완료")
}
```

주요 개선사항:
✅ 지능형 캐시 관리 (자동 만료, 크기 제한)
✅ 메모리 압박 시 자동 정리
✅ HTTP 캐시 최적화
✅ 중요 리소스 사전 로드
✅ JavaScript 레벨 캐시 최적화
✅ 상세한 캐시 상태 모니터링
✅ iOS 메모리 경고 대응
*/ 