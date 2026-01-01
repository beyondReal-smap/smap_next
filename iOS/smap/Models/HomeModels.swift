import Foundation

/// Smap 그룹 정보
struct SmapGroup: Codable, Identifiable, Equatable {
    var id: Int { sgt_idx }
    let sgt_idx: Int
    let sgt_title: String?
    let sgt_code: String?
    let sgt_memo: String?
    let mt_idx: Int?
    let member_count: Int?
    let sgt_show: String?
    let sgt_wdate: String?
    let sgt_udate: String?
    
    // Custom init to handle missing optional fields
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        sgt_idx = try container.decode(Int.self, forKey: .sgt_idx)
        sgt_title = try container.decodeIfPresent(String.self, forKey: .sgt_title)
        sgt_code = try container.decodeIfPresent(String.self, forKey: .sgt_code)
        sgt_memo = try container.decodeIfPresent(String.self, forKey: .sgt_memo)
        mt_idx = try container.decodeIfPresent(Int.self, forKey: .mt_idx)
        member_count = try container.decodeIfPresent(Int.self, forKey: .member_count)
        sgt_show = try container.decodeIfPresent(String.self, forKey: .sgt_show)
        sgt_wdate = try container.decodeIfPresent(String.self, forKey: .sgt_wdate)
        sgt_udate = try container.decodeIfPresent(String.self, forKey: .sgt_udate)
    }
    
    // Manual memberwise initializer
    init(
        sgt_idx: Int,
        sgt_title: String? = nil,
        sgt_code: String? = nil,
        sgt_memo: String? = nil,
        mt_idx: Int? = nil,
        member_count: Int? = nil,
        sgt_show: String? = nil,
        sgt_wdate: String? = nil,
        sgt_udate: String? = nil
    ) {
        self.sgt_idx = sgt_idx
        self.sgt_title = sgt_title
        self.sgt_code = sgt_code
        self.sgt_memo = sgt_memo
        self.mt_idx = mt_idx
        self.member_count = member_count
        self.sgt_show = sgt_show
        self.sgt_wdate = sgt_wdate
        self.sgt_udate = sgt_udate
    }
    
    enum CodingKeys: String, CodingKey {
        case sgt_idx, sgt_title, sgt_code, sgt_memo, mt_idx, member_count, sgt_show, sgt_wdate, sgt_udate
    }
    
    static func == (lhs: SmapGroup, rhs: SmapGroup) -> Bool {
        return lhs.sgt_idx == rhs.sgt_idx &&
               lhs.sgt_title == rhs.sgt_title &&
               lhs.sgt_code == rhs.sgt_code &&
               lhs.sgt_memo == rhs.sgt_memo &&
               lhs.member_count == rhs.member_count &&
               lhs.sgt_show == rhs.sgt_show
    }
}

/// Smap 그룹 멤버 정보 (위치 정보 포함)
struct SmapGroupMember: Codable, Identifiable, Equatable {
    var id: Int { mt_idx }
    let mt_idx: Int
    let mt_id: String?
    let mt_name: String?
    let mt_nickname: String? // Added for nickname support
    let mt_email: String?
    let mt_file1: String? // 프로필 이미지
    
    // 그룹 관리 필드
    let sgdt_idx: Int?
    let sgdt_owner_chk: String?
    let sgdt_leader_chk: String?
    let sgdt_wdate: String?
    
    // 위치 정보 (mlt_...)
    var mlt_lat: Double?
    var mlt_long: Double?
    var mlt_speed: Double?
    var mlt_battery: Int?
    var mlt_gps_time: String?
    
    var isSelected: Bool = false
    
    enum CodingKeys: String, CodingKey {
        case mt_idx, mt_id, mt_name, mt_nickname, mt_email, mt_file1
        case sgdt_idx, sgdt_owner_chk, sgdt_leader_chk, sgdt_wdate
        case mlt_lat, mlt_long, mlt_speed, mlt_battery, mlt_gps_time
    }
    
    static func == (lhs: SmapGroupMember, rhs: SmapGroupMember) -> Bool {
        return lhs.mt_idx == rhs.mt_idx &&
               lhs.mt_name == rhs.mt_name &&
               lhs.mt_nickname == rhs.mt_nickname &&
               lhs.mt_file1 == rhs.mt_file1 &&
               lhs.sgdt_owner_chk == rhs.sgdt_owner_chk &&
               lhs.sgdt_leader_chk == rhs.sgdt_leader_chk &&
               lhs.mlt_lat == rhs.mlt_lat &&
               lhs.mlt_long == rhs.mlt_long &&
               lhs.isSelected == rhs.isSelected
    }
    var displayName: String {
        if let nick = mt_nickname, !nick.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return nick
        }
        return mt_name ?? "알 수 없음"
    }
}

/// Smap 일정 정보
struct SmapSchedule: Codable, Identifiable {
    let sst_idx: String
    var id: String { sst_idx }
    let title: String?
    let date: String? // 시작일시 (ISO8601)
    let sst_edate: String? // 종료일시 (ISO8601)
    let sst_all_day: String?
    let sst_memo: String?
    let sgt_idx: Int?
    let location: String? // location
    
    // 위치 정보 (일정에 장소가 있는 경우)
    let sst_location_lat: Double?
    let sst_location_long: Double?
    
    enum CodingKeys: String, CodingKey {
        case sst_idx = "id"
        case title, date, sst_edate, sst_all_day, sst_memo, sgt_idx
        case location
        case sst_location_lat, sst_location_long
    }
    
    // 일정 상태 계산을 위한 헬퍼
    var status: ScheduleStatus {
        guard let sDateStr = date, let eDateStr = sst_edate else { return .defaultStatus }
        
        // "2023-10-27T09:00:00" or "2023-10-27 09:00:00"
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        
        var sDate = formatter.date(from: sDateStr)
        var eDate = formatter.date(from: eDateStr)
        
        // fallback for space instead of T
        if sDate == nil {
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd HH:mm:ss"
            sDate = f.date(from: sDateStr)
            eDate = f.date(from: eDateStr)
        }
        
        guard let start = sDate, let end = eDate else {
            return .defaultStatus
        }
        
        let now = Date()
        if now > end { return .completed }
        if now >= start && now <= end { return .ongoing }
        return .upcoming
    }
}

enum ScheduleStatus {
    case completed, ongoing, upcoming, defaultStatus
    
    var text: String {
        switch self {
        case .completed: return "완료"
        case .ongoing: return "진행 중"
        case .upcoming: return "예정"
        case .defaultStatus: return "상태 없음"
        }
    }
}
// MARK: - Group Statistics Models

struct GroupStats: Codable {
    let group_id: Int
    let group_title: String
    let member_count: Int
    let weekly_schedules: Int
    let total_locations: Int
    let stats_period: StatsPeriod
    let member_stats: [GroupMemberStats]
}

struct StatsPeriod: Codable {
    let start_date: String
    let end_date: String
    let days: Int
}

struct GroupMemberStats: Codable {
    let mt_idx: Int
    let mt_name: String
    let mt_nickname: String
    let weekly_schedules: Int
    let total_locations: Int
    let weekly_locations: Int
    let is_owner: Bool
    let is_leader: Bool
}
