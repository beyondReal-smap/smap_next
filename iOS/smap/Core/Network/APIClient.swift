import Foundation

/// 통합 네트워크 클라이언트
final class APIClient: @unchecked Sendable {

    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: String

    /// 동시에 여러 401이 들어와도 refresh를 한 번만 수행하기 위한 직렬화 actor.
    private let refreshCoordinator = RefreshCoordinator()

    init(
        session: URLSession = .shared,
        baseURL: String = AppConfiguration.apiV1BaseURL
    ) {
        self.session = session
        self.baseURL = baseURL
    }

    // MARK: - JSON Request

    func request<T: Decodable>(
        _ endpoint: APIEndpoint,
        token: String? = nil,
        decoder: JSONDecoder = JSONDecoder()
    ) async throws -> T {
        let (data, _) = try await dispatch(endpoint: endpoint, token: token, retryOn401: true)
        do {
            return try decoder.decode(T.self, from: data)
        } catch let error as DecodingError {
            throw NetworkError.decodingFailed(error)
        }
    }

    /// Raw Data 반환 (상태 코드만 확인)
    func requestRaw(
        _ endpoint: APIEndpoint,
        token: String? = nil
    ) async throws -> (Data, HTTPURLResponse) {
        return try await dispatch(endpoint: endpoint, token: token, retryOn401: true)
    }

    // MARK: - 401 자동 재시도가 포함된 단일 진입점

    private func dispatch(
        endpoint: APIEndpoint,
        token: String?,
        retryOn401: Bool
    ) async throws -> (Data, HTTPURLResponse) {
        let effectiveToken = token ?? KeychainManager.shared.getToken()
        var urlRequest = endpoint.urlRequest(baseURL: baseURL)
        if let effectiveToken {
            urlRequest.setValue("Bearer \(effectiveToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await performRequest(urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(-1, data)
        }

        // 401 → refresh 후 한 번만 재시도. refresh 엔드포인트 자체는 재시도 안 함.
        if httpResponse.statusCode == 401, retryOn401, !endpoint.isRefreshEndpoint, !endpoint.isRegistrationEndpoint, effectiveToken != nil {
            let newAccess: String
            do {
                newAccess = try await refreshCoordinator.refreshIfNeeded(attemptedWith: effectiveToken, client: self)
            } catch NetworkError.unauthorized {
                if let effectiveToken {
                    await MainActor.run {
                        if AuthService.shared.getToken() == effectiveToken { AuthService.shared.expireSession() }
                    }
                }
                throw NetworkError.unauthorized
            }
            var retried = endpoint.urlRequest(baseURL: baseURL)
            retried.setValue("Bearer \(newAccess)", forHTTPHeaderField: "Authorization")
            let (data2, response2) = try await performRequest(retried)
            guard let http2 = response2 as? HTTPURLResponse else {
                throw NetworkError.unknown(-1, data2)
            }
            guard (200...299).contains(http2.statusCode) else {
                throw NetworkError.fromHTTPStatus(http2.statusCode, data: data2)
            }
            return (data2, http2)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.fromHTTPStatus(httpResponse.statusCode, data: data)
        }
        return (data, httpResponse)
    }

    // refresh 호출은 RefreshCoordinator에서 수행. 토큰 저장은 여기서.
    fileprivate func performRefresh(refreshToken raw: String) async throws -> String {
        let endpoint = APIEndpoint.refreshTokenV2(refreshToken: raw)
        let (data, _) = try await dispatch(endpoint: endpoint, token: nil, retryOn401: false)
        let response: RefreshTokenResponse
        do {
            response = try JSONDecoder().decode(RefreshTokenResponse.self, from: data)
        } catch let error as DecodingError {
            throw NetworkError.decodingFailed(error)
        }
        guard response.success, let access = response.token, !access.isEmpty else {
            throw NetworkError.unknown(-1, data)
        }
        guard KeychainManager.shared.getRefreshToken() == raw else {
            throw NetworkError.unknown(-1, nil)
        }
        KeychainManager.shared.saveToken(access)
        if let newRefresh = response.refresh_token, !newRefresh.isEmpty {
            KeychainManager.shared.saveRefreshToken(newRefresh)
        }
        return access
    }

    // MARK: - Multipart Upload

    func upload(
        _ endpoint: APIEndpoint,
        fileData: Data,
        fileName: String,
        fieldName: String = "file",
        mimeType: String = "image/jpeg",
        additionalFields: [String: String] = [:],
        token: String? = nil
    ) async throws -> Data {
        var urlRequest = endpoint.urlRequest(baseURL: baseURL)

        if let token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let boundary = UUID().uuidString
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)

        for (key, value) in additionalFields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        urlRequest.httpBody = body

        let (data, response) = try await performRequest(urlRequest)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw NetworkError.fromHTTPStatus(statusCode, data: data)
        }

        return data
    }

    // MARK: - Private

    private func performRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let error as URLError {
            throw NetworkError.network(error)
        }
    }
}

// MARK: - Refresh coordination

/// 동시에 들어온 401 요청들이 같은 raw refresh token으로 refresh를 두 번 호출해
/// 서버의 reuse detection을 트리거하지 않도록 한 번만 직렬화한다.
private actor RefreshCoordinator {
    private var inflight: Task<String, Error>?

    func refreshIfNeeded(attemptedWith oldAccess: String?, client: APIClient) async throws -> String {
        if let stored = KeychainManager.shared.getToken(),
           let attempted = oldAccess, stored != attempted {
            return stored
        }
        if let task = inflight { return try await task.value }
        guard let raw = KeychainManager.shared.getRefreshToken(), !raw.isEmpty else {
            throw NetworkError.unknown(-1, nil)
        }
        let task = Task<String, Error> { try await client.performRefresh(refreshToken: raw) }
        inflight = task
        defer { inflight = nil }
        return try await task.value
    }
}

// MARK: - APIEndpoint helpers

extension APIEndpoint {
    var isRegistrationEndpoint: Bool {
        if case .register = self { return true }
        return false
    }
    /// refresh 자체 호출이 401일 때 자기 자신을 다시 refresh하지 않도록 식별.
    var isRefreshEndpoint: Bool {
        if case .refreshTokenV2 = self { return true }
        return false
    }
}
