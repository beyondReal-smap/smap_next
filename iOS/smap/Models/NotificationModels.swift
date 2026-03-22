//
// NotificationModels.swift
// smap
//
// 푸시 알림 로그 관련 모델
//

import Foundation

/// 푸시 알림 읽음 상태
enum ReadCheck: String, Codable, Equatable {
    case Y = "Y"
    case N = "N"
}

/// 푸시 알림 표시 여부
enum ShowStatus: String, Codable, Equatable {
    case Y = "Y"
    case N = "N"
}

/// 푸시 알림 타입 (plt_type 기반)
enum PushNotificationType: Int, Codable, Equatable {
    case general = 1      // 일반
    case visit = 2        // 방문 (지오펜스 인/아웃)
    case schedule = 3     // 일정 알림
    case system = 4       // 시스템 알림
    case visitRequest = 5 // 방문 요청
    case visitAccepted = 6// 방문 수락
    
    var iconName: String {
        switch self {
        case .general: return "bell.fill"
        case .visit: return "mappin.and.ellipse"
        case .schedule: return "calendar"
        case .system: return "exclamationmark.triangle.fill"
        case .visitRequest: return "person.badge.plus"
        case .visitAccepted: return "checkmark.circle.fill"
        }
    }
}

/// 푸시 로그 데이터 모델
struct PushLog: Codable, Identifiable, Equatable {
    var id: Int { plt_idx }
    
    let plt_idx: Int
    let plt_type: Int?
    let mt_idx: Int?
    let sst_idx: Int?
    let plt_condition: String?
    let plt_memo: String?
    let plt_title: String?
    let plt_content: String?
    let plt_sdate: String?   // 발송일시
    let plt_status: Int?     // 2: 전송완료
    let plt_read_chk: ReadCheck?
    let plt_show: ShowStatus?
    let push_json: String?
    let plt_wdate: String?   // 생성일시
    let plt_rdate: String?   // 읽은일시
    
    /// 알림 타입 열거형 반환
    var type: PushNotificationType {
        PushNotificationType(rawValue: plt_type ?? 1) ?? .general
    }
    
    /// iOS 알림센터 스타일 시간 문자열 (예: 오전 04:05, 어제 13:11, (일) 오전 11:10)
    var relativeTime: String {
        guard let sDateStr = plt_sdate else { return "" }
        
        let dateFormats = [
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm:ssZ",
            "yyyy-MM-dd'T'HH:mm:ssXXXXX"
        ]
        
        var date: Date? = nil
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        
        for format in dateFormats {
            f.dateFormat = format
            if let d = f.date(from: sDateStr) {
                date = d
                break
            }
        }
        
        guard let targetDate = date else { return sDateStr }
        
        let calendar = Calendar.current
        let now = Date()
        
        // 시간 포맷 (오전/오후 HH:mm)
        let timeFormatter = DateFormatter()
        timeFormatter.locale = Locale(identifier: "ko_KR")
        timeFormatter.dateFormat = "a hh:mm"
        let timeString = timeFormatter.string(from: targetDate)
        
        // 오늘인지 확인
        if calendar.isDateInToday(targetDate) {
            return timeString
        }
        
        // 어제인지 확인
        if calendar.isDateInYesterday(targetDate) {
            return "어제 " + timeString
        }
        
        // 그 외: 요일 + 시간
        let weekdayFormatter = DateFormatter()
        weekdayFormatter.locale = Locale(identifier: "ko_KR")
        weekdayFormatter.dateFormat = "(E)"
        let weekday = weekdayFormatter.string(from: targetDate)
        
        return weekday + " " + timeString
    }
}

/// 알림 전체 삭제/읽음 처리 응답
struct NotificationActionResponse: Codable, Equatable {
    let success: Bool?
    let message: String?
}
