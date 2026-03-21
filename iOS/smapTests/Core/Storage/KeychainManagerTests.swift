import XCTest
@testable import smap

final class KeychainManagerTests: XCTestCase {

    var manager: KeychainManager!

    override func setUp() {
        super.setUp()
        manager = KeychainManager(service: "com.dmonster.smap.tests")
        manager.deleteToken()
    }

    override func tearDown() {
        manager.deleteToken()
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
}
