import XCTest
@testable import smap

final class APIEndpointTests: XCTestCase {

    let baseURL = "https://api3.smap.site/api/v1"

    func testLogin_urlAndMethod() {
        let endpoint = APIEndpoint.login(mt_id: "01012345678", mt_pwd: "pass123")
        let request = endpoint.urlRequest(baseURL: baseURL)
        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/auth/login")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func testGetGroups_urlAndMethod() {
        let endpoint = APIEndpoint.getCurrentUserGroups
        let request = endpoint.urlRequest(baseURL: baseURL)
        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/groups/current-user")
        XCTAssertEqual(request.httpMethod, "GET")
    }

    func testGetGroupMembers_urlContainsSgtIdx() {
        let endpoint = APIEndpoint.getGroupMembers(sgtIdx: 42)
        let request = endpoint.urlRequest(baseURL: baseURL)
        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/group-members/member/42")
        XCTAssertEqual(request.httpMethod, "GET")
    }

    func testCreateGroup_hasPostBody() {
        let endpoint = APIEndpoint.createGroup(title: "테스트 그룹", memo: "메모")
        let request = endpoint.urlRequest(baseURL: baseURL)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertNotNil(request.httpBody)
        let body = try! JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
        XCTAssertEqual(body["sgt_title"] as? String, "테스트 그룹")
    }

    func testDeleteMember_urlAndMethod() {
        let endpoint = APIEndpoint.removeMember(sgtIdx: 1, mtIdx: 2)
        let request = endpoint.urlRequest(baseURL: baseURL)
        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/group-members/1/member/2")
        XCTAssertEqual(request.httpMethod, "DELETE")
    }

    func testMarkNotificationRead_usesPatch() {
        let endpoint = APIEndpoint.markNotificationRead(notificationId: 99)
        let request = endpoint.urlRequest(baseURL: baseURL)
        XCTAssertEqual(request.httpMethod, "PATCH")
        XCTAssertTrue(request.url!.absoluteString.contains("99"))
    }

    func testMemberLocations_hasCorrectPath() {
        let endpoint = APIEndpoint.getMemberLocations(memberId: 5)
        let request = endpoint.urlRequest(baseURL: baseURL)
        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/locations/member/5")
        XCTAssertEqual(request.httpMethod, "GET")
    }

    func testFetchProfile_urlAndMethod() {
        let endpoint = APIEndpoint.fetchProfile
        let request = endpoint.urlRequest(baseURL: baseURL)
        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/members/me")
        XCTAssertEqual(request.httpMethod, "GET")
    }
}
