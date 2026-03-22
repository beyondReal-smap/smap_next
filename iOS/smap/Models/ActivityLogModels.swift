//
//  ActivityLogModels.swift
//  smap
//
//  Activity log related data models
//  Extracted from LoginView.swift along with ActivityLogService/ViewModel
//

import Foundation

// MARK: - Location Log Models

/// 개별 위치 로그 데이터
struct LocationLog: Codable, Identifiable {
    let mlt_idx: Int
    let mt_idx: Int
    let mlt_gps_time: String?
    let mlt_speed: Double?
    let mlt_lat: Double?
    let mlt_long: Double?
    let mlt_accuacy: Double?
    let mt_health_work: Int?
    let mlt_battery: Int?
    let mlt_fine_location: String?
    let mlt_location_chk: String?
    let mlt_wdate: String?

    var id: Int { mlt_idx }

    var latitude: Double { mlt_lat ?? 0 }
    var longitude: Double { mlt_long ?? 0 }
    var timestamp: Date? {
        guard let timeStr = mlt_gps_time else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: timeStr) ?? DateFormatter.apiDateFormatter.date(from: timeStr)
    }
}

/// 위치 요약 데이터
struct LocationSummary: Codable {
    let schedule_count: String?
    let distance: String?
    let duration: String?
    let steps: Int?

    var formattedDistance: String {
        distance ?? "0 km"
    }

    var formattedDuration: String {
        duration ?? "0분"
    }

    var formattedSteps: String {
        if let s = steps {
            return "\(s) 걸음"
        }
        return "0 걸음"
    }
}

/// 지도 마커 데이터
struct MapMarker: Codable, Identifiable {
    let mlt_idx: Int?
    let mt_idx: Int?
    let mlt_gps_time: String?
    let mlt_speed: Double?
    let mlt_lat: Double?
    let mlt_long: Double?
    let mlt_accuacy: Double?
    let mt_health_work: Int?
    let mlt_battery: Int?
    let mlt_fine_location: String?
    let mlt_location_chk: String?
    let mlt_wdate: String?
    let stay_lat: Double?
    let stay_long: Double?

    var id: Int { mlt_idx ?? 0 }
    var latitude: Double { mlt_lat ?? stay_lat ?? 0 }
    var longitude: Double { mlt_long ?? stay_long ?? 0 }
    var speed: Double { mlt_speed ?? 0 }
    var accuracy: Double { mlt_accuacy ?? 0 }
    var batteryLevel: Int { mlt_battery ?? 0 }

    var timestamp: Date? {
        guard let timeStr = mlt_gps_time else { return nil }
        return DateFormatter.apiDateFormatter.date(from: timeStr)
    }

    var formattedTime: String {
        guard let timeStr = mlt_gps_time else { return "" }
        // "2025-01-01 12:30:45" 형식에서 시간만 추출
        let components = timeStr.split(separator: " ")
        if components.count >= 2 {
            let timePart = String(components[1])
            let timeComponents = timePart.split(separator: ":")
            if timeComponents.count >= 2 {
                return "\(timeComponents[0]):\(timeComponents[1])"
            }
        }
        return timeStr
    }
}

/// 체류 시간 분석 데이터
struct StayTime: Codable, Identifiable {
    let label: String?
    let grp: Int?
    let start_time: String
    let end_time: String
    let duration: Double
    let distance: Double?
    let start_lat: Double?
    let start_long: Double?
    let location: String?
    let latitude: Double?
    let longitude: Double?
    let stay_duration: String?
    let point_count: Int?

    var id: String { "\(grp ?? 0)_\(start_time)" }

    var stayLatitude: Double { latitude ?? start_lat ?? 0 }
    var stayLongitude: Double { longitude ?? start_long ?? 0 }

    var formattedDuration: String {
        if let sd = stay_duration {
            return sd
        }
        let durationInt = Int(duration)
        let hours = durationInt / 60
        let minutes = durationInt % 60
        if hours > 0 {
            return "\(hours)시간 \(minutes)분"
        }
        return "\(minutes)분"
    }
}

// MARK: - Daily Counts Models

/// 일별 활동 카운트
struct DailyCount: Codable, Identifiable {
    let date: String
    let count: Int
    let formatted_date: String
    let day_of_week: String
    let is_today: Bool
    let is_weekend: Bool

    var id: String { date }

    var hasActivity: Bool { count > 0 }
}

/// 멤버별 일별 카운트
struct MemberDailyCount: Codable, Identifiable {
    let member_id: Int
    let member_name: String
    let mt_nickname: String? // Added for nickname support
    let member_photo: String?
    let member_gender: Int?
    let daily_counts: [DailyCount]

    var id: Int { member_id }

    var displayName: String {
        if let nick = mt_nickname, !nick.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return nick
        }
        return member_name
    }

    /// 14일간 활동 여부 배열 (오래된 날짜 -> 최근 날짜 순)
    var activityDistribution: [Bool] {
        // 최근 14일 날짜 생성
        let calendar = Calendar.current
        let today = Date()
        var distribution = [Bool](repeating: false, count: 14)

        for i in 0..<14 {
            if let date = calendar.date(byAdding: .day, value: -(13 - i), to: today) {
                let dateString = DateFormatter.apiDateOnlyFormatter.string(from: date)
                if let dayCount = daily_counts.first(where: { $0.date == dateString }) {
                    distribution[i] = dayCount.count > 0
                }
            }
        }

        return distribution
    }

    /// 활동이 있는 총 일수
    var activeDaysCount: Int {
        activityDistribution.filter { $0 }.count
    }
}

/// 일별 카운트 API 응답
struct DailyCountsResponse: Codable {
    let member_daily_counts: [MemberDailyCount]
    let total_daily_counts: [DailyCount]?
    let total_days: Int
    let start_date: String
    let end_date: String
    let group_id: Int
    let total_members: Int
}

// MARK: - Member Activity Models

/// 멤버 활동 데이터
struct MemberActivity: Codable, Identifiable {
    let member_id: Int
    let member_name: String
    let mt_nickname: String? // Added for nickname support
    let member_photo: String?
    let member_gender: Int?
    let log_count: Int
    let first_log_time: String?
    let last_log_time: String?
    let is_active: Bool

    var id: Int { member_id }

    var displayName: String {
        if let nick = mt_nickname, !nick.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return nick
        }
        return member_name
    }
}

/// 멤버 활동 응답
struct MemberActivityResponse: Codable {
    let member_activities: [MemberActivity]
    let date: String
    let group_id: Int
    let total_members: Int
    let active_members: Int
}

// MARK: - API Response Wrapper

struct ActivityLogAPIResponse<T: Codable>: Codable {
    let result: String
    let data: T?
    let total_days: Int?
    let total_stays: Int?
    let total_markers: Int?
    let message: String?

    var isSuccess: Bool { result == "Y" }
}

// MARK: - DateFormatter Extensions

extension DateFormatter {
    static let apiDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()

    static let apiDateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()

    static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM월 dd일 (E)"
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()

    static let shortDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM.dd"
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()
}
