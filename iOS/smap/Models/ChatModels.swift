import Foundation

// MARK: - Chat Room

struct ChatRoom: Codable, Identifiable {
    let scr_idx: Int
    let sgt_idx: Int?
    let scr_type: String  // "group" or "dm"
    let scr_title: String?
    let scr_udate: String?
    let unread_count: Int
    let last_message: String?
    let last_message_time: String?
    let member_count: Int
    let dm_target_nickname: String?
    let dm_target_file1: String?

    var id: Int { scr_idx }

    var displayTitle: String {
        if scr_type == "dm" {
            return dm_target_nickname ?? "1:1 채팅"
        }
        return scr_title ?? "그룹 채팅"
    }

    var isGroupChat: Bool { scr_type == "group" }

    var formattedTime: String? {
        guard let timeStr = last_message_time ?? scr_udate else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: timeStr) {
            return ChatRoom.relativeFormatter.localizedString(for: date, relativeTo: Date())
        }
        // Try without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: timeStr) {
            return ChatRoom.relativeFormatter.localizedString(for: date, relativeTo: Date())
        }
        // Try simple format
        let simple = DateFormatter()
        simple.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        if let date = simple.date(from: timeStr) {
            return ChatRoom.relativeFormatter.localizedString(for: date, relativeTo: Date())
        }
        return nil
    }

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.unitsStyle = .abbreviated
        return f
    }()
}

struct ChatRoomListResponse: Codable {
    let rooms: [ChatRoom]
    let total_unread: Int
}

// MARK: - Chat Message

struct ChatMessage: Codable, Identifiable, Equatable {
    let scmsg_idx: Int
    let scr_idx: Int
    let mt_idx: Int
    let mt_nickname: String?
    let mt_file1: String?
    let scmsg_type: String
    let scmsg_content: String
    let scmsg_wdate: String
    var unread_count: Int

    var id: Int { scmsg_idx }

    var isSystemMessage: Bool { scmsg_type == "system" }

    var formattedTime: String {
        let simple = DateFormatter()
        simple.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        if let date = simple.date(from: scmsg_wdate) {
            let timeFormatter = DateFormatter()
            timeFormatter.dateFormat = "a h:mm"
            timeFormatter.locale = Locale(identifier: "ko_KR")
            return timeFormatter.string(from: date)
        }
        return ""
    }

    var dateString: String {
        let simple = DateFormatter()
        simple.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        if let date = simple.date(from: scmsg_wdate) {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy년 M월 d일 EEEE"
            dateFormatter.locale = Locale(identifier: "ko_KR")
            return dateFormatter.string(from: date)
        }
        return ""
    }

    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.scmsg_idx == rhs.scmsg_idx && lhs.unread_count == rhs.unread_count
    }
}

// MARK: - Request

struct CreateDMRequest: Codable {
    let target_mt_idx: Int
}

struct CreateDMResponse: Codable {
    let scr_idx: Int
    let is_new: Bool
}
