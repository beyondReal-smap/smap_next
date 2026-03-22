//
//  Utils.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import Foundation
import UIKit
import FirebaseMessaging

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
    
    func showSnackBar(view: UIView, message: String){
        let toastLabel = UILabel()
        toastLabel.backgroundColor = UIColor.black.withAlphaComponent(0.8)
        toastLabel.textColor = UIColor.white
        toastLabel.font = UIFont.systemFont(ofSize: 14)
        toastLabel.textAlignment = .center
        toastLabel.text = message
        toastLabel.alpha = 1.0
        toastLabel.layer.cornerRadius = 10
        toastLabel.clipsToBounds = true
        toastLabel.numberOfLines = 0
        let maxWidth = view.frame.size.width - 40
        let textSize = toastLabel.sizeThatFits(CGSize(width: maxWidth, height: CGFloat.greatestFiniteMagnitude))
        toastLabel.frame = CGRect(
            x: (view.frame.size.width - textSize.width - 40) / 2,
            y: view.frame.size.height - 100,
            width: textSize.width + 40,
            height: textSize.height + 20
        )
        view.addSubview(toastLabel)
        UIView.animate(withDuration: 3.0, delay: 0.1, options: .curveEaseOut) {
            toastLabel.alpha = 0.0
        } completion: { _ in
            toastLabel.removeFromSuperview()
        }
    }
}
