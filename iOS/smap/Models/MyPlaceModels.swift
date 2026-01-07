//
//  MyPlaceModels.swift
//  smap
//
//  내장소 관련 데이터 모델
//

import Foundation

// MARK: - Saved Location Model

/// 저장된 장소 데이터 모델 (백엔드 smap_location_t 테이블 매핑)
struct SavedLocation: Codable, Identifiable, Equatable {
    var id: Int { slt_idx }
    
    let slt_idx: Int
    let insert_mt_idx: Int?
    let mt_idx: Int?
    let sgt_idx: Int?
    let sgdt_idx: Int?
    let slt_title: String?
    let slt_add: String?
    let slt_lat: Double?
    let slt_long: Double?
    let slt_show: String?
    var slt_enter_alarm: String?  // 알림 설정 (Y/N)
    let slt_enter_chk: String?
    let slt_wdate: String?
    let slt_udate: String?
    
    /// 알림 설정 여부
    var notifications: Bool {
        slt_enter_alarm == "Y"
    }
    
    /// 표시 여부
    var isVisible: Bool {
        slt_show == "Y"
    }
    
    /// 위도 (기본값: 서울시청)
    var latitude: Double {
        slt_lat ?? 37.5665
    }
    
    /// 경도 (기본값: 서울시청)
    var longitude: Double {
        slt_long ?? 126.9780
    }
    
    /// 장소 이름 (기본값 처리)
    var name: String {
        slt_title ?? "이름 없음"
    }
    
    /// 주소 (기본값 처리)
    var address: String {
        slt_add ?? "주소 없음"
    }
    
    // MARK: - Custom Decoder for String-encoded Coordinates
    
    enum CodingKeys: String, CodingKey {
        case slt_idx, insert_mt_idx, mt_idx, sgt_idx, sgdt_idx
        case slt_title, slt_add, slt_lat, slt_long
        case slt_show, slt_enter_alarm, slt_enter_chk
        case slt_wdate, slt_udate
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        slt_idx = try container.decode(Int.self, forKey: .slt_idx)
        insert_mt_idx = try container.decodeIfPresent(Int.self, forKey: .insert_mt_idx)
        mt_idx = try container.decodeIfPresent(Int.self, forKey: .mt_idx)
        sgt_idx = try container.decodeIfPresent(Int.self, forKey: .sgt_idx)
        sgdt_idx = try container.decodeIfPresent(Int.self, forKey: .sgdt_idx)
        slt_title = try container.decodeIfPresent(String.self, forKey: .slt_title)
        slt_add = try container.decodeIfPresent(String.self, forKey: .slt_add)
        
        // Handle coordinates as either Double or String
        if let latDouble = try? container.decodeIfPresent(Double.self, forKey: .slt_lat) {
            slt_lat = latDouble
        } else if let latString = try? container.decodeIfPresent(String.self, forKey: .slt_lat) {
            slt_lat = Double(latString)
        } else {
            slt_lat = nil
        }
        
        if let longDouble = try? container.decodeIfPresent(Double.self, forKey: .slt_long) {
            slt_long = longDouble
        } else if let longString = try? container.decodeIfPresent(String.self, forKey: .slt_long) {
            slt_long = Double(longString)
        } else {
            slt_long = nil
        }
        
        slt_show = try container.decodeIfPresent(String.self, forKey: .slt_show)
        slt_enter_alarm = try container.decodeIfPresent(String.self, forKey: .slt_enter_alarm)
        slt_enter_chk = try container.decodeIfPresent(String.self, forKey: .slt_enter_chk)
        slt_wdate = try container.decodeIfPresent(String.self, forKey: .slt_wdate)
        slt_udate = try container.decodeIfPresent(String.self, forKey: .slt_udate)
    }
}

// MARK: - Location Create Request

/// 장소 생성 요청 모델
struct LocationCreateRequest: Codable {
    let slt_title: String
    let slt_add: String
    let slt_lat: Double
    let slt_long: Double
    let slt_show: String
    let slt_enter_alarm: String
    let slt_enter_chk: String
    
    init(
        title: String,
        address: String,
        latitude: Double,
        longitude: Double,
        show: String = "Y",
        enterAlarm: String = "Y",
        enterChk: String = "N"
    ) {
        self.slt_title = title
        self.slt_add = address
        self.slt_lat = latitude
        self.slt_long = longitude
        self.slt_show = show
        self.slt_enter_alarm = enterAlarm
        self.slt_enter_chk = enterChk
    }
}

// MARK: - Location Update Request

/// 장소 수정 요청 모델
struct LocationUpdateRequest: Codable {
    var slt_title: String?
    var slt_add: String?
    var slt_lat: Double?
    var slt_long: Double?
    var slt_show: String?
    var slt_enter_alarm: String?
}

// MARK: - API Response Models

/// 장소 생성/수정 응답 모델
struct LocationResponse: Codable {
    let success: Bool
    let message: String?
    let slt_idx: Int?
    let data: SavedLocation?
}

/// 장소 삭제 응답 모델
struct LocationDeleteResponse: Codable {
    let success: Bool?
    let message: String?
    let slt_idx: Int?
}

// MARK: - Place Group Member (for sidebar)

/// 사이드바에 표시될 멤버 정보 (장소 개수 포함)
struct PlaceMember: Identifiable {
    var id: Int { mt_idx }
    
    let mt_idx: Int
    let mt_name: String
    let mt_nickname: String?
    let mt_file1: String?
    let mt_gender: Int?
    let sgdt_owner_chk: String?
    let sgdt_leader_chk: String?
    var locationCount: Int
    var isSelected: Bool
    
    /// 표시용 이름
    var displayName: String {
        if let nickname = mt_nickname, !nickname.isEmpty {
            return nickname
        }
        return mt_name
    }
    
    /// 그룹 소유자 여부
    var isOwner: Bool {
        sgdt_owner_chk == "Y"
    }
    
    /// 그룹 리더 여부
    var isLeader: Bool {
        sgdt_leader_chk == "Y"
    }
    
    /// SmapGroupMember에서 변환
    init(from member: SmapGroupMember, locationCount: Int = 0, isSelected: Bool = false) {
        self.mt_idx = member.mt_idx ?? 0
        self.mt_name = member.mt_name ?? "알 수 없음"
        self.mt_nickname = member.mt_nickname
        self.mt_file1 = member.mt_file1
        self.mt_gender = member.mt_gender
        self.sgdt_owner_chk = member.sgdt_owner_chk
        self.sgdt_leader_chk = member.sgdt_leader_chk
        self.locationCount = locationCount
        self.isSelected = isSelected
    }
}
