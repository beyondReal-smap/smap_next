import XCTest
@testable import smap

final class APIClientTests: XCTestCase {

    var client: APIClient!

    // 테스트 전용 디코딩 타입 — 모델 레이어와 결합 방지
    private struct TestItem: Decodable, Equatable {
        let id: Int
        let name: String
    }

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        client = APIClient(session: URLSession(configuration: config), baseURL: "https://test.api.com/v1")
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testRequest_decodesSuccessResponse() async throws {
        let responseJSON = """
        [{"id": 1, "name": "Test"}]
        """.data(using: .utf8)!

        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.url?.path, "/v1/groups/current-user")
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, responseJSON)
        }

        let items: [TestItem] = try await client.request(.getCurrentUserGroups)
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].name, "Test")
    }

    func testRequest_throwsUnauthorized_on401() async {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
            return (response, Data())
        }

        do {
            let _: [TestItem] = try await client.request(.getCurrentUserGroups)
            XCTFail("Should have thrown")
        } catch let error as NetworkError {
            XCTAssertTrue(error.isUnauthorized)
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func testRequest_throwsServerError_on500() async {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!
            return (response, "Server Error".data(using: .utf8)!)
        }

        do {
            let _: [TestItem] = try await client.request(.getCurrentUserGroups)
            XCTFail("Should have thrown")
        } catch let error as NetworkError {
            if case .serverError(let code, _) = error {
                XCTAssertEqual(code, 500)
            } else {
                XCTFail("Expected serverError, got \(error)")
            }
        } catch {
            XCTFail("Wrong error type")
        }
    }

    func testRequest_injectsAuthorizationHeader() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, "[]".data(using: .utf8)!)
        }

        let _: [TestItem] = try await client.request(.getCurrentUserGroups, token: "test-token")
    }

    func testRequest_throwsDecodingError_onInvalidJSON() async {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, "not json".data(using: .utf8)!)
        }

        do {
            let _: [TestItem] = try await client.request(.getCurrentUserGroups)
            XCTFail("Should have thrown")
        } catch let error as NetworkError {
            if case .decodingFailed = error {
                // Expected
            } else {
                XCTFail("Expected decodingFailed, got \(error)")
            }
        } catch {
            XCTFail("Wrong error type")
        }
    }
}

// MARK: - MockURLProtocol

class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = MockURLProtocol.requestHandler else {
            fatalError("MockURLProtocol.requestHandler not set")
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
