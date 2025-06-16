// iOS WebView JavaScript 로그 핸들러
// 이 코드를 iOS 프로젝트의 WebView 관련 파일에 추가하세요

import WebKit
import UIKit

extension YourWebViewClass: WKScriptMessageHandler {
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        
        // 기존 메시지 처리
        if message.name == "smapIos" {
            guard let body = message.body as? [String: Any] else {
                print("❌ 메시지 본문 파싱 실패: \(message.body)")
                return
            }
            
            let type = body["type"] as? String ?? ""
            let param = body["param"] as? String ?? ""
            
            // JavaScript 로그 처리 (NEW)
            if type == "jsLog" {
                handleJavaScriptLog(param: param)
                return
            }
            
            // 기존 Google Sign-In 처리
            if type == "googleSignIn" {
                handleGoogleSignIn()
                return
            }
            
            // 기타 메시지 처리...
        }
    }
    
    // JavaScript 로그 처리 함수 (NEW)
    private func handleJavaScriptLog(param: String) {
        guard let data = param.data(using: .utf8),
              let logData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            print("❌ JS 로그 데이터 파싱 실패: \(param)")
            return
        }
        
        let level = logData["level"] as? String ?? "info"
        let message = logData["message"] as? String ?? ""
        let timestamp = logData["timestamp"] as? String ?? ""
        let dataString = logData["data"] as? String ?? ""
        
        // 로그 레벨에 따른 출력
        switch level {
        case "error":
            print("🔴 [JS ERROR] \(timestamp)")
            print("🔴 [JS ERROR] \(message)")
            if !dataString.isEmpty {
                print("🔴 [JS ERROR] Data: \(dataString)")
            }
            print("🔴 [JS ERROR] =====================================")
            
        case "warning":
            print("🟡 [JS WARNING] \(timestamp)")
            print("🟡 [JS WARNING] \(message)")
            if !dataString.isEmpty {
                print("🟡 [JS WARNING] Data: \(dataString)")
            }
            print("🟡 [JS WARNING] ===================================")
            
        default: // info
            print("🔵 [JS INFO] \(timestamp)")
            print("🔵 [JS INFO] \(message)")
            if !dataString.isEmpty {
                print("🔵 [JS INFO] Data: \(dataString)")
            }
            print("🔵 [JS INFO] ====================================")
        }
    }
    
    // 기존 Google Sign-In 처리 함수
    private func handleGoogleSignIn() {
        // 기존 Google Sign-In 로직...
        print("🔵 [iOS] Google Sign-In 요청 받음")
        
        // Google Sign-In 실행
        guard let clientID = Bundle.main.object(forInfoPlistKey: "GIDClientID") as? String else {
            print("❌ Google Client ID를 찾을 수 없습니다")
            return
        }
        
        guard let presentingViewController = self.window?.rootViewController else {
            print("❌ Presenting View Controller를 찾을 수 없습니다")
            return
        }
        
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        
        GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController) { [weak self] result, error in
            if let error = error {
                print("❌ Google Sign-In 실패: \(error.localizedDescription)")
                self?.callJavaScriptFunction("googleSignInError", args: [error.localizedDescription])
                return
            }
            
            guard let user = result?.user,
                  let idToken = user.idToken?.tokenString else {
                print("❌ Google Sign-In 사용자 정보 없음")
                self?.callJavaScriptFunction("googleSignInError", args: ["사용자 정보를 가져올 수 없습니다"])
                return
            }
            
            let userInfo: [String: Any] = [
                "email": user.profile?.email ?? "",
                "name": user.profile?.name ?? "",
                "givenName": user.profile?.givenName ?? "",
                "familyName": user.profile?.familyName ?? "",
                "imageURL": user.profile?.imageURL(withDimension: 200)?.absoluteString ?? ""
            ]
            
            print("✅ Google Sign-In 성공: \(userInfo)")
            print("✅ ID Token: \(idToken)")
            
            // JavaScript 콜백 호출
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: userInfo, options: [])
                let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
                self?.callJavaScriptFunction("googleSignInSuccess", args: [idToken, userInfo])
            } catch {
                print("❌ 사용자 정보 JSON 변환 실패: \(error)")
                self?.callJavaScriptFunction("googleSignInError", args: ["사용자 정보 처리 실패"])
            }
        }
    }
    
    // JavaScript 함수 호출 헬퍼
    private func callJavaScriptFunction(_ functionName: String, args: [Any]) {
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.webView else { return }
            
            let argsString = args.map { arg in
                if let stringArg = arg as? String {
                    return "'\(stringArg.replacingOccurrences(of: "'", with: "\\'"))'"
                } else if let dictArg = arg as? [String: Any] {
                    do {
                        let jsonData = try JSONSerialization.data(withJSONObject: dictArg, options: [])
                        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
                        return jsonString
                    } catch {
                        return "{}"
                    }
                } else {
                    return String(describing: arg)
                }
            }.joined(separator: ", ")
            
            let script = "\(functionName)(\(argsString))"
            print("🔵 [iOS] JavaScript 호출: \(script)")
            
            webView.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("❌ JavaScript 호출 실패: \(error)")
                } else {
                    print("✅ JavaScript 호출 성공")
                }
            }
        }
    }
}

/*
사용 방법:

1. 위 코드를 iOS 프로젝트의 WebView 관련 파일에 추가
2. YourWebViewClass를 실제 WebView 클래스 이름으로 변경
3. webView 프로퍼티가 실제 WKWebView 인스턴스를 가리키도록 확인
4. WKUserContentController에 메시지 핸들러 등록:

```swift
webView.configuration.userContentController.add(self, name: "smapIos")
```

이제 JavaScript에서 sendLogToiOS() 함수를 호출하면 
Xcode 콘솔에서 자세한 로그를 확인할 수 있습니다!
*/ 