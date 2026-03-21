import XCTest
@testable import smap

final class GroupServiceTests: XCTestCase {
    var service: GroupService!

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        let client = APIClient(session: URLSession(configuration: config))
        service = GroupService(apiClient: client)
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    // MARK: - getCurrentUserGroups

    func testGetCurrentUserGroups_decodesResponse() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/groups/current-user"))
            XCTAssertEqual(request.httpMethod, "GET")
            let json = """
            [{"sgt_idx": 1, "sgt_title": "Test Group"}]
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        let groups = try await service.getCurrentUserGroups()
        XCTAssertEqual(groups.count, 1)
        XCTAssertEqual(groups.first?.sgt_idx, 1)
        XCTAssertEqual(groups.first?.sgt_title, "Test Group")
    }

    // MARK: - getGroupSummary

    func testGetGroupSummary_decodesResponse() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/groups/current-user/summary"))
            XCTAssertEqual(request.httpMethod, "GET")
            let json = """
            {"group_count": 3, "total_members": 12}
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        let summary = try await service.getGroupSummary()
        XCTAssertEqual(summary.group_count, 3)
        XCTAssertEqual(summary.total_members, 12)
    }

    // MARK: - getGroupStats

    func testGetGroupStats_decodesWrappedResponse() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/groups/5/stats"))
            let json = """
            {
                "success": true,
                "message": null,
                "data": {
                    "group_id": 5,
                    "group_title": "Test",
                    "member_count": 3,
                    "weekly_schedules": 1,
                    "total_locations": 2,
                    "stats_period": {"start_date": "2026-03-01", "end_date": "2026-03-22", "days": 21},
                    "member_stats": []
                }
            }
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        let stats = try await service.getGroupStats(sgtIdx: 5)
        XCTAssertEqual(stats.group_id, 5)
        XCTAssertEqual(stats.member_count, 3)
    }

    func testGetGroupStats_throwsOnFailure() async {
        MockURLProtocol.requestHandler = { request in
            let json = """
            {"success": false, "message": "Not found", "data": null}
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        do {
            _ = try await service.getGroupStats(sgtIdx: 999)
            XCTFail("Expected error to be thrown")
        } catch {
            XCTAssertTrue(error is NetworkError)
        }
    }

    // MARK: - createGroup

    func testCreateGroup_sendsPostAndDecodes() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertTrue(request.url!.path.contains("/groups"))
            let json = """
            {"success": true, "message": null, "data": {"sgt_idx": 10, "sgt_title": "New Group"}}
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: nil)!, json)
        }
        let group = try await service.createGroup(title: "New Group", memo: "memo")
        XCTAssertEqual(group.sgt_idx, 10)
        XCTAssertEqual(group.sgt_title, "New Group")
    }

    // MARK: - updateGroup

    func testUpdateGroup_sendsPutAndDecodes() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.httpMethod, "PUT")
            XCTAssertTrue(request.url!.path.contains("/groups/7"))
            let json = """
            {"success": true, "message": null, "data": {"sgt_idx": 7, "sgt_title": "Updated"}}
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        let group = try await service.updateGroup(sgtIdx: 7, title: "Updated", memo: "memo")
        XCTAssertEqual(group.sgt_idx, 7)
        XCTAssertEqual(group.sgt_title, "Updated")
    }

    // MARK: - deleteGroup

    func testDeleteGroup_sendsPutMethod() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.httpMethod, "PUT")
            XCTAssertTrue(request.url!.path.contains("/groups/42"))
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
        }
        let result = try await service.deleteGroup(sgtIdx: 42)
        XCTAssertTrue(result)
    }

    // MARK: - getGroupMembers

    func testGetGroupMembers_decodesResponse() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/group-members/member/3"))
            XCTAssertEqual(request.httpMethod, "GET")
            let json = """
            [{"mt_idx": 1, "mt_name": "User1"}, {"mt_idx": 2, "mt_name": "User2"}]
            """.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        let members = try await service.getGroupMembers(sgtIdx: 3)
        XCTAssertEqual(members.count, 2)
    }

    // MARK: - updateMemberRole

    func testUpdateMemberRole_decodesSimpleResponse() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.httpMethod, "PUT")
            XCTAssertTrue(request.url!.path.contains("/group-members/1/role"))
            let json = #"{"success": true, "message": null}"#.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        let result = try await service.updateMemberRole(sgtIdx: 1, mtIdx: 2, isLeader: true)
        XCTAssertTrue(result)
    }

    // MARK: - removeMember

    func testRemoveMember_sendsDeleteMethod() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.httpMethod, "DELETE")
            XCTAssertTrue(request.url!.path.contains("/group-members/1/member/2"))
            let json = #"{"success": true, "message": null}"#.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }
        let result = try await service.removeMember(sgtIdx: 1, mtIdx: 2)
        XCTAssertTrue(result)
    }

    // MARK: - joinGroupById

    func testJoinGroupById_sendsPostAndReturnsTrue() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertTrue(request.url!.path.contains("/groups/5/join"))
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
        }
        let result = try await service.joinGroupById(mt_idx: 1, sgt_idx: 5)
        XCTAssertTrue(result)
    }

    // MARK: - Error Handling

    func testGetCurrentUserGroups_throwsOnServerError() async {
        MockURLProtocol.requestHandler = { request in
            return (HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!, Data())
        }
        do {
            _ = try await service.getCurrentUserGroups()
            XCTFail("Expected error to be thrown")
        } catch {
            XCTAssertTrue(error is NetworkError)
        }
    }

    func testDeleteGroup_throwsOnUnauthorized() async {
        MockURLProtocol.requestHandler = { request in
            return (HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!, Data())
        }
        do {
            _ = try await service.deleteGroup(sgtIdx: 1)
            XCTFail("Expected error to be thrown")
        } catch let error as NetworkError {
            XCTAssertTrue(error.isUnauthorized)
        } catch {
            XCTFail("Expected NetworkError, got \(type(of: error))")
        }
    }
}
