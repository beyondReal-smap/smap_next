//
//  Utils.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import Foundation
import UIKit

class Utils {
    static let shared = Utils()
    
    private init() {}
    
    // MARK: - Token Management
    func setToken(token: String) {
        UserDefaults.standard.set(token, forKey: "fcm_token")
        UserDefaults.standard.synchronize()
        
        // 웹뷰에 토큰 전달
        NotificationCenter.default.post(
            name: Notification.Name("fcmTokenUpdated"),
            object: nil,
            userInfo: ["token": token]
        )
    }
    
    func getToken() -> String? {
        return UserDefaults.standard.string(forKey: "fcm_token")
    }
    
    // MARK: - Device Info
    func getDeviceInfo() -> [String: Any] {
        let device = UIDevice.current
        
        return [
            "model": device.model,
            "systemName": device.systemName,
            "systemVersion": device.systemVersion,
            "name": device.name,
            "identifierForVendor": device.identifierForVendor?.uuidString ?? "",
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
            "buildNumber": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "",
            "bundleId": Bundle.main.bundleIdentifier ?? ""
        ]
    }
    
    // MARK: - Network Utilities
    func isNetworkAvailable() -> Bool {
        // 간단한 네트워크 상태 확인
        // 실제로는 Reachability 라이브러리 사용을 권장
        return true
    }
    
    // MARK: - UserDefaults Helpers
    func saveData(key: String, value: Any) {
        UserDefaults.standard.set(value, forKey: key)
        UserDefaults.standard.synchronize()
    }
    
    func getData(key: String) -> Any? {
        return UserDefaults.standard.object(forKey: key)
    }
    
    func removeData(key: String) {
        UserDefaults.standard.removeObject(forKey: key)
        UserDefaults.standard.synchronize()
    }
    
    // MARK: - UI Utilities
    func showToast(message: String, in view: UIView) {
        let toastLabel = UILabel()
        toastLabel.backgroundColor = UIColor.black.withAlphaComponent(0.8)
        toastLabel.textColor = UIColor.white
        toastLabel.textAlignment = .center
        toastLabel.font = UIFont.systemFont(ofSize: 16)
        toastLabel.text = message
        toastLabel.alpha = 1.0
        toastLabel.layer.cornerRadius = 20
        toastLabel.clipsToBounds = true
        
        view.addSubview(toastLabel)
        toastLabel.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            toastLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            toastLabel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -50),
            toastLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
            toastLabel.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),
            toastLabel.heightAnchor.constraint(equalToConstant: 40)
        ])
        
        UIView.animate(withDuration: 0.3, delay: 2.0, options: .curveEaseOut, animations: {
            toastLabel.alpha = 0.0
        }) { _ in
            toastLabel.removeFromSuperview()
        }
    }
    
    // MARK: - Date Utilities
    func formatDate(_ date: Date, format: String = "yyyy-MM-dd HH:mm:ss") -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter.string(from: date)
    }
    
    func dateFromString(_ dateString: String, format: String = "yyyy-MM-dd HH:mm:ss") -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter.date(from: dateString)
    }
} 