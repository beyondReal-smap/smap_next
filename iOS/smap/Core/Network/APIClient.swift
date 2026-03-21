import Foundation

/// 통합 네트워크 클라이언트
final class APIClient: @unchecked Sendable {

    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: String

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
        var urlRequest = endpoint.urlRequest(baseURL: baseURL)

        if let token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await performRequest(urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(-1, data)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.fromHTTPStatus(httpResponse.statusCode, data: data)
        }

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
        var urlRequest = endpoint.urlRequest(baseURL: baseURL)

        if let token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await performRequest(urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(-1, data)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.fromHTTPStatus(httpResponse.statusCode, data: data)
        }

        return (data, httpResponse)
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
