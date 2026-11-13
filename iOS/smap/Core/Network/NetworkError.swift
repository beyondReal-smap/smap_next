import Foundation

/// 통합 네트워크 에러 타입
enum NetworkError: Error, LocalizedError {
    case network(URLError)
    case unauthorized
    case forbidden
    case notFound
    case badRequest(String?)
    /// 409. `userMessage`는 기존(가입 중복) 문구를 유지하고, 구독 등 서버 문구가 필요한 곳은 `serverMessage`를 쓴다.
    case conflict(serverMessage: String?)
    /// 502/503 — 서버 또는 외부(스토어) 검증 서버 일시 장애. 재시도 가능한 오류.
    case unavailable
    /// 403 + 객체형 detail 중 구독 제한 코드(PLACE_LIMIT_EXCEEDED, LOG_RETENTION_EXCEEDED).
    case subscriptionLimit(code: String, message: String)
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
        case .conflict:
            return "이미 가입된 이메일입니다."
        case .unavailable:
            return "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        case .subscriptionLimit(_, let message):
            return message
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
            if let limit = subscriptionLimit(from: data) { return limit }
            return .forbidden
        case 404:
            return .notFound
        case 409:
            let message = data.flatMap { try? JSONDecoder().decode(ErrorDetail.self, from: $0) }?.detail
            return .conflict(serverMessage: message)
        case 422:
            return .badRequest("입력한 정보를 확인해주세요.")
        case 429:
            return .badRequest("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")
        case 400:
            let message = data.flatMap { try? JSONDecoder().decode(ErrorDetail.self, from: $0) }?.detail
            return .badRequest(message)
        case 502, 503:
            return .unavailable
        case 500...599:
            let message = data.flatMap { String(data: $0, encoding: .utf8) }
            return .serverError(statusCode, message)
        default:
            return .unknown(statusCode, data)
        }
    }

    /// 403 응답의 detail 이 `{"code": ..., "message": ...}` 객체이고 구독 제한 코드이면 변환한다.
    private static func subscriptionLimit(from data: Data?) -> NetworkError? {
        guard let data,
              let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let detail = root["detail"] as? [String: Any],
              let code = detail["code"] as? String,
              code == "PLACE_LIMIT_EXCEEDED" || code == "LOG_RETENTION_EXCEEDED",
              let message = detail["message"] as? String else { return nil }
        return .subscriptionLimit(code: code, message: message)
    }
}

/// 서버 에러 응답 디코딩용 (내부 사용)
private struct ErrorDetail: Decodable {
    let detail: String?
    let message: String?
}
