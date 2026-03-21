import XCTest
@testable import smap

final class AuthServiceTests: XCTestCase {
    var service: AuthService!
    var keychain: KeychainManager!
    var defaults: UserDefaultsManager!

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        let client = APIClient(session: URLSession(configuration: config))
        keychain = KeychainManager(service: "com.dmonster.smap.auth-tests")
        let ud = UserDefaults(suiteName: "com.dmonster.smap.auth-tests")!
        ud.removePersistentDomain(forName: "com.dmonster.smap.auth-tests")
        defaults = UserDefaultsManager(defaults: ud)
        service = AuthService(apiClient: client, keychain: keychain, userDefaults: defaults)
    }

    override func tearDown() {
        keychain.deleteToken()
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    // MARK: - Token Management

    func testSaveAndGetToken() {
        service.saveToken("test-token")
        XCTAssertEqual(service.getToken(), "test-token")
    }

    func testDeleteToken() {
        service.saveToken("token-to-delete")
        XCTAssertNotNil(service.getToken())
        service.deleteToken()
        XCTAssertNil(service.getToken())
    }

    // MARK: - User Data Management

    func testSaveAndGetUserData() {
        let user = SMAPUser(mt_idx: 42, mt_name: "TestUser")
        service.saveUserData(user)
        let retrieved = service.getUserData()
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.mt_idx, 42)
        XCTAssertEqual(retrieved?.mt_name, "TestUser")
    }

    func testSaveUserData_setsCompatibilityKeys() {
        let user = SMAPUser(mt_idx: 5, mt_id: "01012345678", mt_name: "Name", mt_email: "test@example.com")
        service.saveUserData(user)
        XCTAssertEqual(defaults.mtIdx, "5")
        XCTAssertEqual(defaults.mtId, "01012345678")
        XCTAssertEqual(defaults.mtName, "Name")
        XCTAssertEqual(defaults.mtEmail, "test@example.com")
        XCTAssertTrue(defaults.isLoggedIn)
    }

    func testSaveUserData_updatesCurrentUser() {
        let user = SMAPUser(mt_idx: 1, mt_name: "Test")
        service.saveUserData(user)
        XCTAssertNotNil(service.currentUser)
        XCTAssertEqual(service.currentUser?.mt_idx, 1)
    }

    func testDeleteUserData_clearsEverything() {
        let user = SMAPUser(mt_idx: 1, mt_name: "Test")
        service.saveUserData(user)
        service.deleteUserData()
        XCTAssertNil(service.getUserData())
        XCTAssertNil(service.currentUser)
        XCTAssertNil(defaults.mtIdx)
        XCTAssertNil(defaults.mtId)
        XCTAssertNil(defaults.mtName)
        XCTAssertNil(defaults.mtEmail)
        XCTAssertFalse(defaults.isLoggedIn)
    }

    // MARK: - Login State

    func testIsLoggedIn_requiresTokenAndUserData() {
        XCTAssertFalse(service.isLoggedIn)
        service.saveToken("token")
        XCTAssertFalse(service.isLoggedIn)
        service.saveUserData(SMAPUser(mt_idx: 1, mt_name: "Test"))
        XCTAssertTrue(service.isLoggedIn)
    }

    // MARK: - Logout

    func testLogout_clearsTokenAndUserData() {
        service.saveToken("token")
        let user = SMAPUser(mt_idx: 1, mt_name: "Test")
        service.saveUserData(user)
        XCTAssertTrue(service.isLoggedIn)
        service.logout()
        XCTAssertNil(service.getToken())
        XCTAssertNil(service.getUserData())
        XCTAssertNil(service.currentUser)
        XCTAssertFalse(service.isLoggedIn)
    }

    // MARK: - FCM Token

    func testGetFCMToken_readsFromUserDefaults() {
        XCTAssertNil(service.getFCMToken())
        defaults.fcmToken = "test-fcm-token"
        XCTAssertEqual(service.getFCMToken(), "test-fcm-token")
    }

    // MARK: - Profile Image URL

    func testGetProfileImageURL_fullURL() {
        let url = AuthService.getProfileImageURL("https://example.com/image.jpg")
        XCTAssertEqual(url?.absoluteString, "https://example.com/image.jpg")
    }

    func testGetProfileImageURL_relativePath() {
        let url = AuthService.getProfileImageURL("/uploads/profile.jpg")
        XCTAssertNotNil(url)
        XCTAssertTrue(url!.absoluteString.hasSuffix("/uploads/profile.jpg"))
    }

    func testGetProfileImageURL_nilOrEmpty() {
        XCTAssertNil(AuthService.getProfileImageURL(nil))
        XCTAssertNil(AuthService.getProfileImageURL(""))
        XCTAssertNil(AuthService.getProfileImageURL("   "))
    }

    // MARK: - Login API

    func testLogin_savesTokenAndUser() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/auth/login"))
            XCTAssertEqual(request.httpMethod, "POST")
            let json = """
            {
                "success": true,
                "message": "로그인 성공",
                "data": {
                    "token": "jwt-token-123",
                    "user": {
                        "mt_idx": 10,
                        "mt_name": "TestUser",
                        "mt_id": "01012345678"
                    }
                }
            }
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        let response = try await service.login(phoneNumber: "010-1234-5678", password: "password123")
        XCTAssertTrue(response.success)
        XCTAssertEqual(service.getToken(), "jwt-token-123")
        XCTAssertEqual(service.currentUser?.mt_idx, 10)
    }

    func testLogin_throwsOnServerError() async {
        MockURLProtocol.requestHandler = { request in
            return (HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!, Data())
        }
        do {
            _ = try await service.login(phoneNumber: "01012345678", password: "pwd")
            XCTFail("Expected error to be thrown")
        } catch {
            XCTAssertTrue(error is NetworkError)
        }
    }

    // MARK: - Register API

    func testRegister_savesTokenAndUser() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/auth/register"))
            XCTAssertEqual(request.httpMethod, "POST")
            let json = """
            {
                "success": true,
                "message": "가입 성공",
                "data": {
                    "token": "new-user-token",
                    "user": {
                        "mt_idx": 99,
                        "mt_name": "NewUser",
                        "mt_id": "01099998888"
                    }
                }
            }
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: nil)!, json)
        }
        let req = RegisterRequest(
            mt_id: "01099998888",
            mt_pwd: "password",
            mt_name: "NewUser",
            mt_nickname: "Nick",
            mt_agree1: true,
            mt_agree2: true,
            mt_agree3: true,
            mt_agree4: false,
            mt_agree5: false
        )
        let response = try await service.register(request: req)
        XCTAssertTrue(response.success)
        XCTAssertEqual(service.getToken(), "new-user-token")
        XCTAssertEqual(service.currentUser?.mt_idx, 99)
    }

    // MARK: - Withdraw API

    func testWithdraw_logsOutOnSuccess() async throws {
        // Pre-populate auth state
        service.saveToken("token")
        service.saveUserData(SMAPUser(mt_idx: 1, mt_name: "Test"))
        XCTAssertTrue(service.isLoggedIn)

        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/members/withdraw"))
            let json = """
            {"success": true, "message": "탈퇴 완료", "result": "Y"}
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        let response = try await service.withdraw(reasonIdx: 1, etcReason: nil, reasons: ["test"])
        XCTAssertTrue(response.success)
        XCTAssertFalse(service.isLoggedIn)
    }
}
