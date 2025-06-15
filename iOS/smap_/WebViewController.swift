//
//  WebViewController.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import UIKit
import WebKit
import UserNotifications

class WebViewController: UIViewController {
    
    // MARK: - Properties
    var webView: WKWebView!
    var activityIndicator: UIActivityIndicatorView!
    
    // 웹 애플리케이션 URL - 로컬 개발 환경 또는 배포된 URL로 변경 가능
    private let webAppURL = "http://localhost:3000" // frontend 개발 서버
    // private let webAppURL = "https://your-domain.com" // 배포된 URL
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupWebView()
        setupActivityIndicator()
        setupNotificationObservers()
        loadWebApp()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - Setup Methods
    private func setupWebView() {
        let webConfiguration = WKWebViewConfiguration()
        
        // JavaScript와 상호작용을 위한 메시지 핸들러 추가
        let contentController = WKUserContentController()
        contentController.add(self, name: "iosHandler")
        webConfiguration.userContentController = contentController
        
        // 웹뷰 설정
        webConfiguration.allowsInlineMediaPlayback = true
        webConfiguration.mediaTypesRequiringUserActionForPlayback = []
        
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        
        view.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func setupActivityIndicator() {
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.center = view.center
        activityIndicator.hidesWhenStopped = true
        view.addSubview(activityIndicator)
    }
    
    private func setupNotificationObservers() {
        // 푸시 알림 수신 시 웹뷰에 전달
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePushNotification(_:)),
            name: Notification.Name("getPush"),
            object: nil
        )
        
        // 딥링크 수신 시 웹뷰에 전달
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDeepLink(_:)),
            name: Notification.Name("getDeepLink"),
            object: nil
        )
        
        // 앱 상태 변경 시 웹뷰에 전달
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppStateChange(_:)),
            name: Notification.Name("appStateChange"),
            object: nil
        )
    }
    
    private func loadWebApp() {
        guard let url = URL(string: webAppURL) else {
            showErrorAlert(message: "잘못된 URL입니다.")
            return
        }
        
        let request = URLRequest(url: url)
        webView.load(request)
        activityIndicator.startAnimating()
    }
    
    // MARK: - Notification Handlers
    @objc private func handlePushNotification(_ notification: Notification) {
        guard let userInfo = notification.userInfo else { return }
        
        let script = """
            if (window.handlePushNotification) {
                window.handlePushNotification(\(jsonString(from: userInfo)));
            }
        """
        
        webView.evaluateJavaScript(script) { (result, error) in
            if let error = error {
                print("Push notification 전달 실패: \(error)")
            }
        }
    }
    
    @objc private func handleDeepLink(_ notification: Notification) {
        guard let userInfo = notification.userInfo else { return }
        
        let script = """
            if (window.handleDeepLink) {
                window.handleDeepLink(\(jsonString(from: userInfo)));
            }
        """
        
        webView.evaluateJavaScript(script) { (result, error) in
            if let error = error {
                print("Deep link 전달 실패: \(error)")
            }
        }
    }
    
    @objc private func handleAppStateChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo else { return }
        
        let script = """
            if (window.handleAppStateChange) {
                window.handleAppStateChange(\(jsonString(from: userInfo)));
            }
        """
        
        webView.evaluateJavaScript(script) { (result, error) in
            if let error = error {
                print("App state change 전달 실패: \(error)")
            }
        }
    }
    
    // MARK: - Helper Methods
    private func jsonString(from dictionary: [AnyHashable: Any]) -> String {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: dictionary, options: []),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return "{}"
        }
        return jsonString
    }
    
    private func showErrorAlert(message: String) {
        let alert = UIAlertController(title: "오류", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in
            // 재시도 또는 앱 종료 등의 액션 추가 가능
        })
        present(alert, animated: true)
    }
    
    // MARK: - Status Bar
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .default
    }
}

// MARK: - WKNavigationDelegate
extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        activityIndicator.startAnimating()
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        activityIndicator.stopAnimating()
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        showErrorAlert(message: "웹페이지 로딩에 실패했습니다.\n\(error.localizedDescription)")
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        
        // 외부 링크 처리
        if let url = navigationAction.request.url {
            if url.scheme == "mailto" || url.scheme == "tel" || url.scheme == "sms" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
        }
        
        decisionHandler(.allow)
    }
}

// MARK: - WKUIDelegate
extension WebViewController: WKUIDelegate {
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }
    
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in
            completionHandler(true)
        })
        present(alert, animated: true)
    }
}

// MARK: - WKScriptMessageHandler
extension WebViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "iosHandler",
              let messageBody = message.body as? [String: Any],
              let action = messageBody["action"] as? String else {
            return
        }
        
        switch action {
        case "requestNotificationPermission":
            requestNotificationPermission()
        case "shareContent":
            if let content = messageBody["content"] as? String {
                shareContent(content)
            }
        case "openExternalURL":
            if let urlString = messageBody["url"] as? String,
               let url = URL(string: urlString) {
                UIApplication.shared.open(url)
            }
        case "hapticFeedback":
            let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
            impactFeedback.impactOccurred()
        default:
            print("Unknown action: \(action)")
        }
    }
    
    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            DispatchQueue.main.async {
                let script = """
                    if (window.handleNotificationPermissionResult) {
                        window.handleNotificationPermissionResult(\(granted));
                    }
                """
                self.webView.evaluateJavaScript(script, completionHandler: nil)
            }
        }
    }
    
    private func shareContent(_ content: String) {
        let activityViewController = UIActivityViewController(activityItems: [content], applicationActivities: nil)
        
        if let popover = activityViewController.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 0, height: 0)
            popover.permittedArrowDirections = []
        }
        
        present(activityViewController, animated: true)
    }
} 