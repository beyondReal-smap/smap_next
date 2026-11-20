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

    // MARK: - Accessibility

    /// 토큰 키체인 보호 등급 — "첫 잠금 해제 이후 계속 읽기 가능".
    /// 화면이 잠긴 채 백그라운드에서 위치를 올릴 때도 토큰을 읽어야 한다(WhenUnlocked 면 잠긴 동안 읽기 실패 →
    /// 인증 없는 업로드가 서버에서 거부됨). ThisDeviceOnly 라 백업·다른 기기로는 넘어가지 않는다.
    static let tokenAccessibility = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

    /// 예전 등급(WhenUnlocked)으로 저장된 토큰을 새 등급으로 바꾼다. 잠금이 풀린 상태(앱 활성화 시)에서 호출해야 한다.
    func upgradeAccessibilityIfNeeded() {
        for account in [tokenAccount, refreshTokenAccount] {
            guard let current = accessibility(account: account),
                  current != Self.tokenAccessibility as String else { continue }
            let status = SecItemUpdate(
                baseQuery(account: account) as CFDictionary,
                [kSecAttrAccessible as String: Self.tokenAccessibility] as CFDictionary
            )
            if status == errSecSuccess {
                print("🔐 [Keychain] 보호 등급 전환 완료 (\(account))")
            } else {
                print("⚠️ [Keychain] 보호 등급 변경 실패 (\(account), status: \(status))")
            }
        }
    }

    /// 저장된 항목의 보호 등급. 항목이 없거나 읽을 수 없으면 nil.
    func accessibility(account: String) -> String? {
        var query = baseQuery(account: account)
        query[kSecReturnAttributes as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let attributes = result as? [String: Any] else { return nil }
        return attributes[kSecAttrAccessible as String] as? String
    }

    // MARK: - Internals

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    private func save(_ value: String, account: String) {
        remove(account: account)
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: Self.tokenAccessibility
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
