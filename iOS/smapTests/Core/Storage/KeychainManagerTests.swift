import XCTest
@testable import smap

final class KeychainManagerTests: XCTestCase {

    var manager: KeychainManager!

    private let service = "com.dmonster.smap.tests"

    override func setUp() {
        super.setUp()
        manager = KeychainManager(service: service)
        manager.deleteToken()
        manager.deleteRefreshToken()
    }

    override func tearDown() {
        manager.deleteToken()
        manager.deleteRefreshToken()
        super.tearDown()
    }

    func testSaveAndRetrieveToken() {
        manager.saveToken("test-jwt-token-12345")
        XCTAssertEqual(manager.getToken(), "test-jwt-token-12345")
    }

    func testGetToken_returnsNil_whenNoTokenSaved() {
        XCTAssertNil(manager.getToken())
    }

    func testDeleteToken_removesToken() {
        manager.saveToken("token-to-delete")
        manager.deleteToken()
        XCTAssertNil(manager.getToken())
    }

    func testSaveToken_overwritesExistingToken() {
        manager.saveToken("old-token")
        manager.saveToken("new-token")
        XCTAssertEqual(manager.getToken(), "new-token")
    }

    func testHasToken() {
        XCTAssertFalse(manager.hasToken)
        manager.saveToken("some-token")
        XCTAssertTrue(manager.hasToken)
    }

    func testSaveToken_usesAfterFirstUnlockAccessibility() {
        manager.saveToken("token")
        manager.saveRefreshToken("refresh")
        let expected = KeychainManager.tokenAccessibility as String
        XCTAssertEqual(manager.accessibility(account: "smap_auth_token"), expected)
        XCTAssertEqual(manager.accessibility(account: "smap_refresh_token"), expected)
    }

    func testUpgradeAccessibility_convertsLegacyWhenUnlockedItems() {
        // 3.3.7 이전 앱이 저장하던 방식(WhenUnlocked)으로 직접 넣는다.
        for (account, value) in [("smap_auth_token", "legacy-access"), ("smap_refresh_token", "legacy-refresh")] {
            let status = SecItemAdd([
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
                kSecValueData as String: Data(value.utf8),
                kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            ] as CFDictionary, nil)
            XCTAssertEqual(status, errSecSuccess)
        }
        XCTAssertEqual(manager.accessibility(account: "smap_auth_token"), kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String)

        manager.upgradeAccessibilityIfNeeded()

        let expected = KeychainManager.tokenAccessibility as String
        XCTAssertEqual(manager.accessibility(account: "smap_auth_token"), expected)
        XCTAssertEqual(manager.accessibility(account: "smap_refresh_token"), expected)
        XCTAssertEqual(manager.getToken(), "legacy-access")
        XCTAssertEqual(manager.getRefreshToken(), "legacy-refresh")
    }

    func testUpgradeAccessibility_noItems_isNoOp() {
        manager.upgradeAccessibilityIfNeeded()
        XCTAssertNil(manager.getToken())
        XCTAssertNil(manager.getRefreshToken())
    }
}
