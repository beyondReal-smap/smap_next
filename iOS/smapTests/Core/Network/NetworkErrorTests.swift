import XCTest
@testable import smap

final class NetworkErrorTests: XCTestCase {

    func testNetworkErrorDescription_unauthorized() {
        let error = NetworkError.unauthorized
        XCTAssertEqual(error.userMessage, "로그인이 만료되었습니다.")
    }

    func testNetworkErrorDescription_networkError() {
        let urlError = URLError(.notConnectedToInternet)
        let error = NetworkError.network(urlError)
        XCTAssertEqual(error.userMessage, "네트워크 연결을 확인해주세요.")
    }

    func testNetworkErrorDescription_serverError() {
        let error = NetworkError.serverError(500, "Internal Server Error")
        XCTAssertEqual(error.userMessage, "서버 오류가 발생했습니다.")
    }

    func testNetworkErrorDescription_decodingFailed() {
        let context = DecodingError.Context(codingPath: [], debugDescription: "test")
        let decodingError = DecodingError.dataCorrupted(context)
        let error = NetworkError.decodingFailed(decodingError)
        XCTAssertEqual(error.userMessage, "데이터 처리 중 오류가 발생했습니다.")
    }

    func testNetworkErrorDescription_notFound() {
        let error = NetworkError.notFound
        XCTAssertEqual(error.userMessage, "요청한 정보를 찾을 수 없습니다.")
    }

    func testNetworkErrorDescription_forbidden() {
        let error = NetworkError.forbidden
        XCTAssertEqual(error.userMessage, "접근 권한이 없습니다.")
    }

    func testNetworkErrorDescription_badRequest() {
        let error = NetworkError.badRequest("Invalid input")
        XCTAssertEqual(error.userMessage, "Invalid input")
    }

    func testNetworkError_isUnauthorized() {
        XCTAssertTrue(NetworkError.unauthorized.isUnauthorized)
        XCTAssertFalse(NetworkError.notFound.isUnauthorized)
    }

    // MARK: - fromHTTPStatus factory method

    func testFromHTTPStatus_401_returnsUnauthorized() {
        let error = NetworkError.fromHTTPStatus(401, data: nil)
        XCTAssertTrue(error.isUnauthorized)
    }

    func testFromHTTPStatus_403_returnsForbidden() {
        let error = NetworkError.fromHTTPStatus(403, data: nil)
        if case .forbidden = error {} else { XCTFail("Expected .forbidden") }
    }

    func testFromHTTPStatus_404_returnsNotFound() {
        let error = NetworkError.fromHTTPStatus(404, data: nil)
        if case .notFound = error {} else { XCTFail("Expected .notFound") }
    }

    func testFromHTTPStatus_400_parsesDetailFromBody() {
        let body = #"{"detail": "Invalid phone number"}"#.data(using: .utf8)
        let error = NetworkError.fromHTTPStatus(400, data: body)
        if case .badRequest(let message) = error {
            XCTAssertEqual(message, "Invalid phone number")
        } else {
            XCTFail("Expected .badRequest")
        }
    }

    func testFromHTTPStatus_500_returnsServerError() {
        let error = NetworkError.fromHTTPStatus(500, data: "Internal".data(using: .utf8))
        if case .serverError(let code, _) = error {
            XCTAssertEqual(code, 500)
        } else {
            XCTFail("Expected .serverError")
        }
    }

    func testFromHTTPStatus_unknownCode_returnsUnknown() {
        let error = NetworkError.fromHTTPStatus(418, data: nil)
        if case .unknown(let code, _) = error {
            XCTAssertEqual(code, 418)
        } else {
            XCTFail("Expected .unknown")
        }
    }
}
