import Foundation

/// 통합 네트워크 에러 타입
enum NetworkError: Error, LocalizedError {
    case network(URLError)
    case unauthorized
    case forbidden
    case notFound
    case badRequest(String?)
    case serverError(Int, String?)
    case decodingFailed(DecodingError)
    case unknown(Int, Data?)

    var errorDescription: String? { userMessage }

    var userMessage: String {
        switch self {
        case .network:
            return "네트워크 연결을 확인해주세요."
        case .unauthorized:
            return "로그인이 만료되었습니다."
        case .forbidden:
            return "접근 권한이 없습니다."
        case .notFound:
            return "요청한 정보를 찾을 수 없습니다."
        case .badRequest(let message):
            return message ?? "잘못된 요청입니다."
        case .serverError:
            return "서버 오류가 발생했습니다."
        case .decodingFailed:
            return "데이터 처리 중 오류가 발생했습니다."
        case .unknown:
            return "알 수 없는 오류가 발생했습니다."
        }
    }

    var isUnauthorized: Bool {
        if case .unauthorized = self { return true }
        return false
    }

    /// HTTP 상태 코드로부터 적절한 에러 생성
    static func fromHTTPStatus(_ statusCode: Int, data: Data?) -> NetworkError {
        switch statusCode {
        case 401:
            return .unauthorized
        case 403:
            return .forbidden
        case 404:
            return .notFound
        case 400:
            let message = data.flatMap { try? JSONDecoder().decode(ErrorDetail.self, from: $0) }?.detail
            return .badRequest(message)
        case 500...599:
            let message = data.flatMap { String(data: $0, encoding: .utf8) }
            return .serverError(statusCode, message)
        default:
            return .unknown(statusCode, data)
        }
    }
}

/// 서버 에러 응답 디코딩용 (내부 사용)
private struct ErrorDetail: Decodable {
    let detail: String?
    let message: String?
}
