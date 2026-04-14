import Foundation
import Security

/// Keychain 기반 토큰 관리
final class KeychainManager: Sendable {

    static let shared = KeychainManager()

    private let service: String
    private let tokenAccount = "smap_auth_token"
    private let refreshTokenAccount = "smap_refresh_token"

    init(service: String = "com.dmonster.smap") {
        self.service = service
    }

    // MARK: - Access token

    func saveToken(_ token: String) { save(token, account: tokenAccount) }
    func getToken() -> String? { fetch(account: tokenAccount) }
    func deleteToken() { remove(account: tokenAccount) }
    var hasToken: Bool { getToken() != nil }

    // MARK: - Refresh token (별도 keychain item)

    func saveRefreshToken(_ token: String) { save(token, account: refreshTokenAccount) }
    func getRefreshToken() -> String? { fetch(account: refreshTokenAccount) }
    func deleteRefreshToken() { remove(account: refreshTokenAccount) }

    // MARK: - Internals

    private func save(_ value: String, account: String) {
        remove(account: account)
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private func fetch(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func remove(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
