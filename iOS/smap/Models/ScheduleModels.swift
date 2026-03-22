//
// ScheduleModels.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import Foundation

struct AlertItem: Identifiable {
    let id = UUID()
    let message: String
}

struct ScheduleListResponse: Codable {
    let success: Bool
    let data: ScheduleData?
    let error: String?
}

struct ScheduleData: Codable {
    let schedules: [Schedule]
    let groupMembers: [SmapGroupMember]
    let userPermission: UserPermissions
}

struct UserPermissions: Codable {
    let canManage: Bool
    let isOwner: Bool
    let isLeader: Bool
}

struct Schedule: Codable, Identifiable, Equatable {
    var id: String { sst_idx }
    let sst_idx: String
    let mt_idx: Int?
    let sst_title: String?
    let sst_sdate: String?
    let sst_edate: String?
    let sst_all_day: String?
    let sgt_idx: Int?
    let sst_location_title: String?
    let sst_location_add: String?
    let sst_location_lat: Double?
    let sst_location_long: Double?
    let sst_memo: String?
    let sst_show: String?
    let mt_name: String?
    let mt_file1: String?
    let sst_alram: Int?
    let sst_alarm_t: String? // Human-readable alarm text like "10분 전"
    let sst_supplies: String?
    let sst_repeat_json: String? // Added for recurrence
    let sst_repeat_json_v: String?
    let sst_pidx: Int? // Added for recurring schedule identification
    let member_name: String?
    let member_photo: String?

    enum CodingKeys: String, CodingKey {
        case sst_idx, mt_idx, sst_title, sst_sdate, sst_edate, sst_all_day, sgt_idx
        case sst_location_title, sst_location_add, sst_location_lat, sst_location_long
        case sst_memo, sst_show, mt_name, mt_file1
        case sst_alram, sst_alarm_t, sst_supplies
        case sst_repeat_json, sst_repeat_json_v, sst_pidx
        case member_name, member_photo
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Flexible decoding for sst_idx (String or Int)
        if let idInt = try? container.decode(Int.self, forKey: .sst_idx) {
            sst_idx = String(idInt)
        } else {
            sst_idx = try container.decode(String.self, forKey: .sst_idx)
        }

        mt_idx = try? container.decode(Int.self, forKey: .mt_idx)
        sst_title = try? container.decode(String.self, forKey: .sst_title)
        sst_sdate = try? container.decode(String.self, forKey: .sst_sdate)
        sst_edate = try? container.decode(String.self, forKey: .sst_edate)
        sst_all_day = try? container.decode(String.self, forKey: .sst_all_day)
        sgt_idx = try? container.decode(Int.self, forKey: .sgt_idx)
        sst_location_title = try? container.decode(String.self, forKey: .sst_location_title)
        sst_location_add = try? container.decode(String.self, forKey: .sst_location_add)
        sst_location_lat = try? container.decode(Double.self, forKey: .sst_location_lat)
        sst_location_long = try? container.decode(Double.self, forKey: .sst_location_long)
        sst_memo = try? container.decode(String.self, forKey: .sst_memo)
        sst_show = try? container.decode(String.self, forKey: .sst_show)
        mt_name = try? container.decode(String.self, forKey: .mt_name)
        mt_file1 = try? container.decode(String.self, forKey: .mt_file1)

        // Flexible decoding for sst_alram (Int or String)
        if let alramInt = try? container.decode(Int.self, forKey: .sst_alram) {
            sst_alram = alramInt
        } else if let alramStr = try? container.decode(String.self, forKey: .sst_alram) {
            sst_alram = Int(alramStr)
        } else {
            sst_alram = nil
        }

        sst_supplies = try? container.decode(String.self, forKey: .sst_supplies)
        sst_alarm_t = try? container.decode(String.self, forKey: .sst_alarm_t)
        sst_repeat_json = try? container.decode(String.self, forKey: .sst_repeat_json)
        sst_repeat_json_v = try? container.decode(String.self, forKey: .sst_repeat_json_v)

        // Flexible decoding for sst_pidx (String or Int)
        if let pidxInt = try? container.decode(Int.self, forKey: .sst_pidx) {
            sst_pidx = pidxInt
        } else if let pidxStr = try? container.decode(String.self, forKey: .sst_pidx) {
            sst_pidx = Int(pidxStr)
        } else {
            sst_pidx = nil
        }

        member_name = try? container.decode(String.self, forKey: .member_name)
        member_photo = try? container.decode(String.self, forKey: .member_photo)
    }

    // Parsed properties for UI
    var validMemberName: String {
        return member_name ?? mt_name ?? "알 수 없음"
    }

    var validMemberPhoto: String? {
        return member_photo ?? mt_file1
    }

    var repeatDescription: String? {
        if let v = sst_repeat_json_v, !v.isEmpty, v != "안함", v != "None" {
            return v
        }
        guard let jsonResult = sst_repeat_json,
              let data = jsonResult.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
              let r1 = json["r1"] as? String else {
            return nil
        }
        switch r1 {
        case "1": return "매일"
        case "2": return "매월"
        case "3": return "매주"
        case "4": return "매년"
        default: return nil
        }
    }

    // Check if schedule is recurring (robust check)
    var isRecurring: Bool {
        // Check repeat_json
        if let json = sst_repeat_json, !json.isEmpty, json != "null" {
            // Check if it's "None" or "안함" just in case, though usually those are in repeat_json_v
             if json == "None" || json == "안함" { return false }
            return true
        }

        // Check pidx (parent index for recurring instances)
        if let pidx = sst_pidx, pidx > 0 {
            return true
        }

        return false
    }

    static func == (lhs: Schedule, rhs: Schedule) -> Bool {
        return lhs.sst_idx == rhs.sst_idx && lhs.sst_title == rhs.sst_title && lhs.sst_sdate == rhs.sst_sdate && lhs.sst_edate == rhs.sst_edate && lhs.sst_all_day == rhs.sst_all_day && lhs.sst_location_title == rhs.sst_location_title && lhs.sst_memo == rhs.sst_memo
    }

    var status: ScheduleDisplayStatus {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let isoFormatter = DateFormatter()
        isoFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"

        guard let sDateStr = sst_sdate, let eDateStr = sst_edate else { return .defaultStatus }

        let start = formatter.date(from: sDateStr) ?? isoFormatter.date(from: sDateStr)
        let end = formatter.date(from: eDateStr) ?? isoFormatter.date(from: eDateStr)

        guard let validStart = start, let validEnd = end else { return .defaultStatus }

        let now = Date()
        if now > validEnd { return .completed }
        if now >= validStart && now <= validEnd { return .ongoing }
        return .upcoming
    }

    var startDateOnly: Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let isoFormatter = DateFormatter()
        isoFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"

        guard let dateStr = sst_sdate else { return nil }
        guard let date = formatter.date(from: dateStr) ?? isoFormatter.date(from: dateStr) else { return nil }
        return Calendar.current.startOfDay(for: date)
    }
}

struct CreateScheduleRequest: Codable {
    let groupId: Int
    let targetMemberId: Int
    let sst_title: String
    let sst_sdate: String
    let sst_edate: String
    let sst_all_day: String
    let sst_location_title: String?
    let sst_location_add: String?
    let sst_location_lat: Double?
    let sst_location_long: Double?
    let sst_memo: String?
    let sst_alram: Int?
    let sst_alarm_t: String? // Human-readable alarm text
    let sst_schedule_alarm_chk: String? // Y/N
    let sst_pick_type: String? // minute/hour/day
    let sst_pick_result: String? // numeric value
    let sst_location_alarm: Int? // 4 when location is set
    let sst_supplies: String?
    let sst_repeat_json: String?
    let sst_repeat_json_v: String?
}

struct UpdateScheduleRequest: Codable {
    let sst_idx: String
    let groupId: Int
    let sst_pidx: Int?
    let sst_title: String
    let sst_sdate: String
    let sst_edate: String
    let sst_all_day: String
    let sst_location_title: String?
    let sst_location_add: String?
    let sst_location_lat: Double?
    let sst_location_long: Double?
    let sst_memo: String?
    let sst_alram: Int?
    let sst_alarm_t: String? // Human-readable alarm text
    let sst_schedule_alarm_chk: String? // Y/N
    let sst_pick_type: String? // minute/hour/day
    let sst_pick_result: String? // numeric value
    let sst_location_alarm: Int? // 4 when location is set
    let sst_supplies: String?
    let sst_repeat_json: String?
    let sst_repeat_json_v: String?
    let editOption: String? // "this", "all", "future" for repeat schedules
    let editorId: String?
    let editorName: String?
}

struct DeleteScheduleRequest: Codable {
    let sst_idx: String
    let groupId: Int
    let sst_pidx: Int?
    let deleteOption: String? // "this", "all", "future" for repeat schedules
    let editorId: String?
    let editorName: String?
}

struct ScheduleSimpleResponse: Codable {
    let success: Bool
    let message: String?
}

enum ScheduleDisplayStatus {
    case completed
    case ongoing
    case upcoming
    case defaultStatus

    var text: String {
        switch self {
        case .completed: return "완료"
        case .ongoing: return "진행중"
        case .upcoming: return "예정"
        case .defaultStatus: return "-"
        }
    }
}
