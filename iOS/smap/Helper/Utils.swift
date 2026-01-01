//
//  Utils.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import Foundation
import UIKit
import FirebaseMessaging
import WebKit

// FCM 메시지 처리를 위한 Notification 이름 정의
extension Notification.Name {
    static let fcmMessageReceived = Notification.Name("FCMMessageReceived")
}

class Utils {
    static let shared = Utils()

    // FCM 메시지 전송 함수
    func sendFCMMessageToWebView(_ messageData: [String: Any]) {
        print("📨 [Utils] FCM 메시지를 NotificationCenter로 전송")
        NotificationCenter.default.post(
            name: .fcmMessageReceived,
            object: nil,
            userInfo: messageData
        )
    }
    
    func setMtIdx(mtIdx: String) {
        UserDefaults.standard.set(mtIdx, forKey: "mt_idx")
    }
    
    func getMtIdx() -> String {
        return UserDefaults.standard.string(forKey: "mt_idx") ?? String()
    }
    
    func removeMtIdx() {
        UserDefaults.standard.removeObject(forKey: "mt_idx")
    }
    
    
    func setToken(token: String){
        if !token.isEmpty {
            UserDefaults.standard.set(token, forKey: "token")
        }
    }
    
    func getToken(completion: @escaping(String) -> Void) {
        Messaging.messaging().token { token, error in
            if let error = error {
                print("getToken error - \(error)")
                let savedToken = UserDefaults.standard.string(forKey: "token") ?? String()
                completion(savedToken)
            } else {
                if let _token = token {
                    if !_token.isEmpty {
                        print("getToken complete - \(_token)")
                        self.setToken(token: _token)
                        completion(_token)
                    } else {
                        let savedToken = UserDefaults.standard.string(forKey: "token") ?? String()
                        completion(savedToken)
                    }
                } else {
                    let savedToken = UserDefaults.standard.string(forKey: "token") ?? String()
                    completion(savedToken)
                }
            }
        }
    }
    
    //랜덤 문자열
    func randomString(length: Int) -> String{
        let str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        let iv = str.createRandomStr(length: length)
        
        return iv
    }
    
    func showSnackBar(view: UIView, message: String){
        AppSnackBar.make(in: view, message: message, duration: .lengthLong).show()
    }

    // MARK: - WebView 관리 (간소화)

    /// WKWebView 참조 저장용
    private weak var webView: WKWebView?

    /// WKWebView 참조 설정
    func setWebView(_ webView: WKWebView) {
        self.webView = webView
        print("✅ [Utils] WebView 참조 설정됨")
    }

    /// WKWebView 참조 가져오기
    func getWebView() -> WKWebView? {
        return webView
    }
}
