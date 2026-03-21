import XCTest
@testable import smap

final class UserDefaultsManagerTests: XCTestCase {

    var store: UserDefaultsManager!
    var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "com.dmonster.smap.tests")!
        defaults.removePersistentDomain(forName: "com.dmonster.smap.tests")
        store = UserDefaultsManager(defaults: defaults)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "com.dmonster.smap.tests")
        super.tearDown()
    }

    func testMtIdx_saveAndRetrieve() {
        store.mtIdx = "123"
        XCTAssertEqual(store.mtIdx, "123")
    }

    func testMtIdx_defaultsToNil() {
        XCTAssertNil(store.mtIdx)
    }

    func testIsLoggedIn_defaultsToFalse() {
        XCTAssertFalse(store.isLoggedIn)
    }

    func testIsLoggedIn_saveAndRetrieve() {
        store.isLoggedIn = true
        XCTAssertTrue(store.isLoggedIn)
    }

    func testUserData_encodeDecode() {
        let user = SMAPUser(
            mt_idx: 42,
            mt_id: "01012345678",
            mt_name: "테스트",
            mt_nickname: "닉네임"
        )
        store.saveUserData(user)
        let retrieved = store.getUserData()
        XCTAssertEqual(retrieved?.mt_idx, 42)
        XCTAssertEqual(retrieved?.mt_name, "테스트")
    }

    func testClearAll_removesAllKeys() {
        store.mtIdx = "123"
        store.isLoggedIn = true
        store.fcmToken = "fcm-token"
        store.clearAll()
        XCTAssertNil(store.mtIdx)
        XCTAssertFalse(store.isLoggedIn)
        XCTAssertNil(store.fcmToken)
    }

    func testFcmToken_saveAndRetrieve() {
        store.fcmToken = "fcm-token-abc"
        XCTAssertEqual(store.fcmToken, "fcm-token-abc")
    }
}
