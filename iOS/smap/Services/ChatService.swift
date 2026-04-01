import Foundation

/// 채팅 API 서비스
final class ChatService {
    static let shared = ChatService()

    private let apiClient = APIClient.shared
    private var token: String? { KeychainManager.shared.getToken() }

    /// 채팅방 목록 조회
    func getChatRooms() async throws -> ChatRoomListResponse {
        return try await apiClient.request(.getChatRooms, token: token)
    }

    /// 메시지 조회 (페이지네이션)
    func getMessages(scrIdx: Int, before: Int? = nil, limit: Int = 50) async throws -> [ChatMessage] {
        return try await apiClient.request(.getChatMessages(scrIdx: scrIdx, before: before, limit: limit), token: token)
    }

    /// 1:1 DM 채팅방 생성
    func createDMRoom(targetMtIdx: Int) async throws -> CreateDMResponse {
        return try await apiClient.request(.createDMRoom(targetMtIdx: targetMtIdx), token: token)
    }
}
