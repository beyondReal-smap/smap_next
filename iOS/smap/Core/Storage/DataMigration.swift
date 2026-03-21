import Foundation
import Security

/// 기존 UserDefaults/Keychain 데이터를 새 Manager로 1회 마이그레이션
enum DataMigration {

    static func migrateIfNeeded(
        store: UserDefaultsManager = .shared,
        keychain: KeychainManager = .shared,
        defaults: UserDefaults = .standard
    ) {
        guard !store.isStorageMigrated else { return }

        // 기존 Keychain 토큰 마이그레이션
        if let oldToken = legacyKeychainRead("smap_auth_token"), !keychain.hasToken {
            keychain.saveToken(oldToken)
        }

        // 기존 UserDefaults 값 마이그레이션
        if let mtIdx = defaults.string(forKey: "mt_idx") {
            store.mtIdx = mtIdx
        }
        if let mtId = defaults.string(forKey: "mt_id") {
            store.mtId = mtId
        }
        if let mtName = defaults.string(forKey: "mt_name") {
            store.mtName = mtName
        }
        if let mtEmail = defaults.string(forKey: "mt_email") {
            store.mtEmail = mtEmail
        }
        if defaults.object(forKey: "is_logged_in") != nil {
            store.isLoggedIn = defaults.bool(forKey: "is_logged_in")
        }
        if let fcmToken = defaults.string(forKey: "fcm_token") {
            store.fcmToken = fcmToken
        }

        // 기존 인코딩된 사용자 데이터
        if let userData = defaults.data(forKey: "smap_user_data"),
           let user = try? JSONDecoder().decode(SMAPUser.self, from: userData) {
            store.saveUserData(user)
        }

        // 마이그레이션 후 레거시 Keychain 항목 정리
        legacyKeychainDelete("smap_auth_token")

        store.isStorageMigrated = true
    }

    // MARK: - Legacy Keychain Access

    /// 기존 AuthService의 Keychain 접근 패턴 (service 미지정)
    private static func legacyKeychainRead(_ account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// 레거시 Keychain 항목 삭제 (service 미지정)
    private static func legacyKeychainDelete(_ account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
