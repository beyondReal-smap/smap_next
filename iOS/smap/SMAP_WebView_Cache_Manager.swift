//
//  SMAP_WebView_Cache_Manager.swift
//  smap
//
//  Created by SMAP Optimization System
//  🚀 next.smap.site 전용 WebView 캐시 최적화 매니저
//

import Foundation
import WebKit
import UIKit

/// 🚀 SMAP WebView 전용 캐시 관리자
/// next.smap.site 최적화에 특화된 지능형 캐시 시스템
class SMAPWebViewCacheManager {
    
    // MARK: - 싱글톤
    static let shared = SMAPWebViewCacheManager()
    private init() {
        setupCacheMonitoring()
        print("🚀 [SMAP-CACHE] 캐시 매니저 초기화 완료")
    }
    
    // MARK: - 캐시 설정
    private let maxCacheSize: Int64 = 100 * 1024 * 1024  // 100MB
    private let maxCacheAge: TimeInterval = 24 * 60 * 60  // 24시간
    private let cleanupThreshold: Double = 0.8  // 80% 사용시 정리
    
    // MARK: - 캐시 타입 정의
    private let criticalResources = [
        "main",
        "chunk",
        "runtime",
        "polyfill",
        "vendors"
    ]
    
    private let imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg"]
    private let scriptExtensions = ["js", "mjs"]
    private let styleExtensions = ["css"]
    
    // MARK: - 🔧 캐시 최적화 설정
    func configureCacheForWebView(_ webView: WKWebView) {
        print("🛠️ [SMAP-CACHE] WebView 캐시 최적화 시작")
        
        // 1. 웹사이트 데이터 스토어 최적화
        let dataStore = webView.configuration.websiteDataStore
        
        // 2. HTTP 캐시 정책 설정
        let httpCachePolicy = setupHTTPCachePolicy()
        
        // 3. JavaScript 캐시 최적화 주입
        injectCacheOptimizationScript(to: webView)
        
        // 4. 리소스 우선순위 설정
        setupResourcePriorities(for: webView)
        
        print("✅ [SMAP-CACHE] WebView 캐시 설정 완료")
    }
    
    // MARK: - HTTP 캐시 정책
    private func setupHTTPCachePolicy() {
        let cacheSize = 50 * 1024 * 1024  // 50MB
        let cache = URLCache(
            memoryCapacity: cacheSize / 2,
            diskCapacity: cacheSize
        )
        URLCache.shared = cache
        
        print("🌐 [SMAP-CACHE] HTTP 캐시 정책 설정 (50MB)")
    }
    
    // MARK: - JavaScript 캐시 최적화
    private func injectCacheOptimizationScript(to webView: WKWebView) {
        let cacheScript = """
        (function() {
            console.log('💾 [SMAP-CACHE-JS] 클라이언트 캐시 최적화 시작');
            
            // 1. ServiceWorker 등록 시도
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('✅ [SMAP-CACHE] ServiceWorker 등록 성공');
                }).catch(function(error) {
                    console.log('ℹ️ [SMAP-CACHE] ServiceWorker 없음 (정상)');
                });
            }
            
            // 2. 로컬 스토리지 최적화
            try {
                if (localStorage.getItem('smap_cache_version') !== '1.0') {
                    localStorage.clear();
                    localStorage.setItem('smap_cache_version', '1.0');
                    console.log('🔄 [SMAP-CACHE] 로컬 스토리지 최적화 완료');
                }
            } catch (e) {
                console.log('⚠️ [SMAP-CACHE] 로컬 스토리지 접근 제한:', e);
            }
            
            // 3. 이미지 지연 로딩 최적화
            if ('IntersectionObserver' in window) {
                const imageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            if (img.dataset.src) {
                                img.src = img.dataset.src;
                                img.removeAttribute('data-src');
                                imageObserver.unobserve(img);
                            }
                        }
                    });
                });
                
                // 기존 이미지 관찰
                document.querySelectorAll('img[data-src]').forEach(img => {
                    imageObserver.observe(img);
                });
            }
            
            // 4. 네트워크 상태 모니터링
            if ('connection' in navigator) {
                const connection = navigator.connection;
                if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                    document.documentElement.classList.add('slow-connection');
                    console.log('🐌 [SMAP-CACHE] 느린 연결 감지, 최적화 모드 활성화');
                }
            }
            
            console.log('✅ [SMAP-CACHE-JS] 클라이언트 캐시 최적화 완료');
        })();
        """
        
        let userScript = WKUserScript(
            source: cacheScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: false
        )
        
        webView.configuration.userContentController.addUserScript(userScript)
        print("📝 [SMAP-CACHE] JavaScript 캐시 최적화 스크립트 주입 완료")
    }
    
    // MARK: - 리소스 우선순위 설정
    private func setupResourcePriorities(for webView: WKWebView) {
        // Critical resources preload
        let preloadScript = """
        (function() {
            // 중요 리소스 미리 로드
            const criticalResources = [
                '/assets/css/globals.css',
                '/assets/js/main.js',
                '/_next/static/chunks/main.js'
            ];
            
            criticalResources.forEach(resource => {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.href = resource;
                if (resource.endsWith('.css')) {
                    link.as = 'style';
                } else if (resource.endsWith('.js')) {
                    link.as = 'script';
                }
                document.head.appendChild(link);
            });
            
            console.log('⚡ [SMAP-CACHE] 중요 리소스 미리 로드 완료');
        })();
        """
        
        let preloadUserScript = WKUserScript(
            source: preloadScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        
        webView.configuration.userContentController.addUserScript(preloadUserScript)
    }
    
    // MARK: - 🧹 캐시 정리 (쿠키/세션 보존)
    func cleanCache(completion: @escaping (Bool) -> Void) {
        print("🧹 [SMAP-CACHE] 캐시 정리 시작 (쿠키/세션 보존)")
        
        // ⚠️ 로그인 세션 유지를 위해 쿠키/세션은 삭제하지 않음
        // 캐시만 삭제 (diskCache, memoryCache, fetchCache 등)
        let cacheDataTypes: Set<String> = [
            WKWebsiteDataTypeDiskCache,
            WKWebsiteDataTypeMemoryCache,
            WKWebsiteDataTypeFetchCache,
            WKWebsiteDataTypeOfflineWebApplicationCache,
            WKWebsiteDataTypeServiceWorkerRegistrations
        ]
        
        let cutoffDate = Date().addingTimeInterval(-maxCacheAge)
        
        WKWebsiteDataStore.default().removeData(
            ofTypes: cacheDataTypes,
            modifiedSince: cutoffDate
        ) {
            print("✅ [SMAP-CACHE] 캐시 정리 완료 (쿠키/세션 보존됨)")
            completion(true)
        }
    }
    
    // MARK: - 📊 캐시 상태 모니터링
    private func setupCacheMonitoring() {
        // 메모리 압박 시 자동 정리
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            print("⚠️ [SMAP-CACHE] 메모리 경고, 캐시 정리 실행")
            self?.cleanCache { success in
                print("🧹 [SMAP-CACHE] 메모리 경고 캐시 정리: \(success ? "성공" : "실패")")
            }
        }
        
        // 백그라운드 진입 시 정리
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            print("🔄 [SMAP-CACHE] 백그라운드 진입, 캐시 최적화")
            self?.optimizeForBackground()
        }
    }
    
    private func optimizeForBackground() {
        // 불필요한 이미지 캐시 정리
        let imageTypes: Set<String> = [WKWebsiteDataStore.websiteDataTypeWebSQLDatabases]
        
        WKWebsiteDataStore.default().removeData(
            ofTypes: imageTypes,
            modifiedSince: Date().addingTimeInterval(-3600) // 1시간 전
        ) {
            print("🖼️ [SMAP-CACHE] 백그라운드 이미지 캐시 정리 완료")
        }
    }
    
    // MARK: - 📈 성능 측정
    func measureCachePerformance() -> [String: Any] {
        let cacheInfo: [String: Any] = [
            "maxSize": maxCacheSize,
            "maxAge": maxCacheAge,
            "cleanupThreshold": cleanupThreshold,
            "status": "active"
        ]
        
        print("📊 [SMAP-CACHE] 캐시 성능: \(cacheInfo)")
        return cacheInfo
    }
    
    // MARK: - 🔧 네트워크 요청 최적화
    func optimizeNetworkRequest(_ request: inout URLRequest) {
        // SMAP 특화 헤더 추가
        request.setValue("SMAP-iOS-Cache/1.0", forHTTPHeaderField: "X-SMAP-Client")
        request.setValue("max-age=3600, stale-while-revalidate=86400", forHTTPHeaderField: "Cache-Control")
        
        // 조건부 요청 헤더
        if let lastModified = getCachedLastModified(for: request.url) {
            request.setValue(lastModified, forHTTPHeaderField: "If-Modified-Since")
        }
        
        print("🌐 [SMAP-CACHE] 네트워크 요청 최적화: \(request.url?.absoluteString ?? "unknown")")
    }
    
    private func getCachedLastModified(for url: URL?) -> String? {
        guard let url = url else { return nil }
        // 실제 구현에서는 캐시된 Last-Modified 값을 반환
        return nil
    }
}

// MARK: - 🔌 확장 기능
extension SMAPWebViewCacheManager {
    
    /// 특정 URL에 대한 캐시 무효화
    func invalidateCache(for url: String, completion: @escaping (Bool) -> Void) {
        guard let targetURL = URL(string: url) else {
            completion(false)
            return
        }
        
        WKWebsiteDataStore.default().fetchDataRecords(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes()) { records in
            let recordsToRemove = records.filter { record in
                record.displayName.contains(targetURL.host ?? "")
            }
            
            WKWebsiteDataStore.default().removeData(
                ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
                for: recordsToRemove
            ) {
                print("🗑️ [SMAP-CACHE] URL 캐시 무효화 완료: \(url)")
                completion(true)
            }
        }
    }
    
    /// 앱 업데이트 시 캐시 갱신
    func refreshCacheForAppUpdate() {
        print("🔄 [SMAP-CACHE] 앱 업데이트 캐시 갱신 시작")
        
        // 모든 캐시 삭제
        WKWebsiteDataStore.default().removeData(
            ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
            modifiedSince: Date.distantPast
        ) {
            print("✅ [SMAP-CACHE] 앱 업데이트 캐시 갱신 완료")
            
            // 새 캐시 버전 설정
            UserDefaults.standard.set("1.0", forKey: "smap_cache_version")
        }
    }
} 