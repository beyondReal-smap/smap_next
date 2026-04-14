import Foundation
import Combine

@MainActor
class ChatViewModel: ObservableObject {
    @Published var rooms: [ChatRoom] = []
    @Published var totalUnread: Int = 0
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let chatService = ChatService.shared

    func loadRooms() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await chatService.getChatRooms()
            self.rooms = response.rooms
            self.totalUnread = response.total_unread
        } catch {
            self.errorMessage = "채팅방 목록을 불러올 수 없습니다."
            print("❌ [ChatViewModel] loadRooms error: \(error)")
        }
        isLoading = false
    }

    var groupRooms: [ChatRoom] {
        rooms.filter { $0.isGroupChat }
    }

    var dmRooms: [ChatRoom] {
        rooms.filter { !$0.isGroupChat }
    }
}
