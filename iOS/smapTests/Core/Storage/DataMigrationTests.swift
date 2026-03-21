import XCTest
@testable import smap

final class DataMigrationTests: XCTestCase {

    var defaults: UserDefaults!
    var store: UserDefaultsManager!
    var keychain: KeychainManager!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "com.dmonster.smap.migration-tests")!
        defaults.removePersistentDomain(forName: "com.dmonster.smap.migration-tests")
        store = UserDefaultsManager(defaults: defaults)
        keychain = KeychainManager(service: "com.dmonster.smap.migration-tests")
        keychain.deleteToken()
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "com.dmonster.smap.migration-tests")
        keychain.deleteToken()
        super.tearDown()
    }

    func testMigrateIfNeeded_migratesUserDefaults() {
        // Given: 기존 데이터 시뮬레이션
        defaults.set("42", forKey: "mt_idx")
        defaults.set("01012345678", forKey: "mt_id")
        defaults.set("홍길동", forKey: "mt_name")

        // When
        DataMigration.migrateIfNeeded(store: store, keychain: keychain, defaults: defaults)

        // Then
        XCTAssertEqual(store.mtIdx, "42")
        XCTAssertEqual(store.mtId, "01012345678")
        XCTAssertEqual(store.mtName, "홍길동")
        XCTAssertTrue(store.isStorageMigrated)
    }

    func testMigrateIfNeeded_skipsIfAlreadyMigrated() {
        // Given: 이미 마이그레이션된 상태
        store.isStorageMigrated = true
        defaults.set("old-value", forKey: "mt_idx")
        store.mtIdx = "new-value"

        // When
        DataMigration.migrateIfNeeded(store: store, keychain: keychain, defaults: defaults)

        // Then: store의 값은 변경되지 않아야 함
        XCTAssertEqual(store.mtIdx, "new-value")
    }

    func testMigrateIfNeeded_setsStorageMigratedFlag() {
        DataMigration.migrateIfNeeded(store: store, keychain: keychain, defaults: defaults)
        XCTAssertTrue(store.isStorageMigrated)
    }
}
