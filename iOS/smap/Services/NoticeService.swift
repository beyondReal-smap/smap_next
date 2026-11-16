//
// NoticeService.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import Foundation

@MainActor
class NoticeService {
    static let shared = NoticeService()
    private let authService = AuthService.shared
    private let baseURL = "https://api3.aiagnt.kr/api/v1"

    private init() {}

    func getNotices(page: Int = 1, size: Int = 20) async throws -> SmapNoticeListWithPagination {
        let url = URL(string: "\(baseURL)/notices/?page=\(page)&size=\(size)&show_only=true")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "공지사항을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }

        return try JSONDecoder().decode(SmapNoticeListWithPagination.self, from: data)
    }

    /// GET /notices/{id} — 서버가 조회수를 1 올린 뒤 공지를 돌려준다(increment_hit 기본 true).
    /// 공지를 열 때 호출한다.
    func getNotice(id: Int) async throws -> SmapNotice {
        let url = URL(string: "\(baseURL)/notices/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "공지사항을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }

        return try JSONDecoder().decode(SmapNotice.self, from: data)
    }
}
