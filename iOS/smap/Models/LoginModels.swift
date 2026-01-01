// 
// LoginModels.swift
// smap
//
// Native iOS Login Screen Models
//

import Foundation

// MARK: - Login Request/Response Models

/// 전화번호/비밀번호 로그인 요청 모델
struct LoginRequest: Codable {
    let mt_id: String      // 전화번호 (010-1234-5678 형식 또는 01012345678)
    let mt_pwd: String     // 비밀번호
    let fcm_token: String? // FCM 토큰 (선택)
}

/// 로그인 응답 모델
struct LoginResponse: Codable {
    let success: Bool
    let message: String
    let data: LoginData?
}

/// 로그인 데이터 (사용자 정보 포함)
struct LoginData: Codable {
    let token: String?
    let user: SMAPUser?
    
    enum CodingKeys: String, CodingKey {
        case token
        case user
    }
}

/// 사용자 정보 모델 (KakaoSDKUser.User와 충돌 방지를 위해 SMAPUser로 명명)
struct SMAPUser: Codable, Identifiable {
    var id: Int { mt_idx ?? 0 }
    
    let mt_idx: Int?  // Changed to optional Int
    let mt_id: String?           // 전화번호
    let mt_name: String?         // 이름
    let mt_nickname: String?     // 닉네임
    let mt_email: String?        // 이메일
    let mt_hp: String?           // 전화번호 (대체 필드)
    let mt_level: Int?           // 레벨
    let mt_status: Int?          // 상태
    let mt_type: Int?            // 타입 (1: 일반, 2: Kakao, 3: Apple, 4: Google)
    let mt_file1: String?        // 프로필 이미지
    let mt_google_id: String?    // Google ID
    let mt_apple_id: String?     // Apple ID
    let mt_birth: String?        // 생년월일 (YYYY-MM-DD)
    let mt_gender: Int?          // 성별 (1: 남성, 2: 여성)
    let mt_wdate: String?        // 가입일
    let mt_ldate: String?        // 마지막 로그인
    
    /// 명시적 멤버와이즈 이니셜라이저 (프로필 이미지 업데이트 등에 필요)
    init(
        mt_idx: Int?,
        mt_id: String? = nil,
        mt_name: String? = nil,
        mt_nickname: String? = nil,
        mt_email: String? = nil,
        mt_hp: String? = nil,
        mt_level: Int? = nil,
        mt_status: Int? = nil,
        mt_type: Int? = nil,
        mt_file1: String? = nil,
        mt_google_id: String? = nil,
        mt_apple_id: String? = nil,
        mt_birth: String? = nil,
        mt_gender: Int? = nil,
        mt_wdate: String? = nil,
        mt_ldate: String? = nil
    ) {
        self.mt_idx = mt_idx
        self.mt_id = mt_id
        self.mt_name = mt_name
        self.mt_nickname = mt_nickname
        self.mt_email = mt_email
        self.mt_hp = mt_hp
        self.mt_level = mt_level
        self.mt_status = mt_status
        self.mt_type = mt_type
        self.mt_file1 = mt_file1
        self.mt_google_id = mt_google_id
        self.mt_apple_id = mt_apple_id
        self.mt_birth = mt_birth
        self.mt_gender = mt_gender
        self.mt_wdate = mt_wdate
        self.mt_ldate = mt_ldate
    }
    
    /// 표시용 이름 (닉네임 > 이름 > 이메일 순)
    var displayName: String {
        if let nickname = mt_nickname, !nickname.isEmpty { return nickname }
        if let name = mt_name, !name.isEmpty { return name }
        return mt_email ?? "사용자"
    }
    
    /// 전화번호 (mt_id 또는 mt_hp)
    var phoneNumber: String? {
        mt_id ?? mt_hp
    }
}

// MARK: - Google Login Models

/// Google 로그인 요청 모델
struct GoogleLoginRequest: Codable {
    let google_id: String?
    let email: String?
    let name: String?
    let given_name: String?
    let family_name: String?
    let image: String?
    let id_token: String?
    let lookup_strategy: String?
    let search_by_email: Bool?
    let verify_email_match: Bool?
    let email_first_lookup: Bool?
    let lookup_priority: String?
    
    init(
        googleId: String?,
        email: String?,
        name: String?,
        givenName: String? = nil,
        familyName: String? = nil,
        image: String? = nil,
        idToken: String?
    ) {
        self.google_id = googleId
        self.email = email
        self.name = name
        self.given_name = givenName
        self.family_name = familyName
        self.image = image
        self.id_token = idToken
        self.lookup_strategy = "email_first"
        self.search_by_email = true
        self.verify_email_match = true
        self.email_first_lookup = true
        self.lookup_priority = "email"
    }
}

/// Google/Apple 소셜 로그인 응답 모델
struct SocialLoginResponse: Codable {
    let success: Bool
    let message: String?
    let error: String?
    let isNewUser: Bool?
    let user: SMAPUser?
    let token: String?
    let data: SocialLoginData?
}

struct SocialLoginData: Codable {
    let isNewUser: Bool?
    let user: SMAPUser?
    let token: String?
}

// MARK: - Apple Login Models

/// Apple 로그인 요청 모델
struct AppleLoginRequest: Codable {
    let userIdentifier: String
    let email: String?
    let userName: String?
    let identityToken: String?
    let authorizationCode: String?
}

/// Apple 로그인 응답 모델
struct AppleLoginResponse: Codable {
    let success: Bool
    let message: String?
    let data: AppleLoginData?
}

struct AppleLoginData: Codable {
    let isNewUser: Bool
    let user: SMAPUser?
    let token: String?
}

// MARK: - Error Models

/// API 에러 응답 모델
struct APIError: Codable, Error, LocalizedError {
    let detail: String?
    let message: String?
    
    var errorDescription: String? {
        message ?? detail ?? "알 수 없는 오류가 발생했습니다."
    }
}

// MARK: - Auth State

/// 인증 상태 열거형
enum AuthState {
    case idle
    case loading
    case authenticated(SMAPUser)
    case newUser(socialData: SocialLoginData)
    case error(String)
}

// MARK: - Home Screen Models (Merged from HomeModels)

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
        return mt_nickname ?? mt_name ?? "알 수 없음"
    }
}

/// Smap 일정 정보
struct SmapSchedule: Codable, Identifiable {
    var id: Int { sst_idx ?? 0 }
    let sst_idx: Int?
    let title: String?
    let date: String? // 시작일시 (ISO8601)
    let sst_edate: String? // 종료일시 (ISO8601)
    let sst_all_day: String?
    let sst_memo: String?
    let sgt_idx: Int?
    let sgdt_idx: Int?  // 그룹 멤버의 서브그룹 인덱스 (필터링 시 사용)
    let mt_idx: Int?
    let sst_location_lat: Double?
    let sst_location_long: Double?
    let sst_show: String? // 표시 여부 (Y/N)
    
    enum CodingKeys: String, CodingKey {
        case sst_idx = "id"
        case title, date, sst_edate, sst_all_day, sst_memo, sgt_idx, sgdt_idx, mt_idx, sst_location_lat, sst_location_long, sst_show
    }
    
    // 일정 상태 계산을 위한 헬퍼
    var status: ScheduleStatus {
        // 시작일은 필수
        guard let sDateStr = date else {
            return .defaultStatus
        }
        
        // 날짜 파싱 시도 (여러 형식 지원)
        var sDate: Date? = nil
        var eDate: Date? = nil
        
        let dateFormats = [
            "yyyy-MM-dd'T'HH:mm:ss",     // ISO8601 without timezone: 2025-12-30T00:05:00
            "yyyy-MM-dd HH:mm:ss",       // Space separator: 2025-12-30 00:05:00
            "yyyy-MM-dd'T'HH:mm:ssZ",    // ISO8601 with Z: 2025-12-30T00:05:00Z
            "yyyy-MM-dd'T'HH:mm:ssXXXXX" // ISO8601 with timezone: 2025-12-30T00:05:00+09:00
        ]
        
        for format in dateFormats {
            if sDate != nil { break }
            let f = DateFormatter()
            f.dateFormat = format
            f.locale = Locale(identifier: "en_US_POSIX")
            sDate = f.date(from: sDateStr)
            
            if let eDateStr = sst_edate, sDate != nil {
                eDate = f.date(from: eDateStr)
            }
        }
        
        guard let start = sDate else {
            return .defaultStatus
        }
        
        // 종료일이 없으면 시작일 + 1시간으로 추정
        let end = eDate ?? start.addingTimeInterval(3600)
        
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

// MARK: - Registration Models

enum RegisterStep: String, CaseIterable {
    case terms
    case phone
    case verification
    case basicInfo
    case profile
    case complete
    
    var title: String {
        switch self {
        case .terms: return "약관 동의"
        case .phone: return "전화번호 인증"
        case .verification: return "인증번호 확인"
        case .basicInfo: return "기본 정보"
        case .profile: return "프로필 정보"
        case .complete: return "가입 완료"
        }
    }
}

struct RegisterRequest: Codable {
    var mt_type: Int = 1
    var mt_level: Int = 2
    var mt_status: Int = 1
    var mt_id: String // Phone or Email
    var mt_pwd: String?
    var mt_name: String
    var mt_nickname: String
    var mt_email: String?
    var mt_birth: String? // YYYY-MM-DD
    var mt_gender: Int?
    var mt_file1: String?
    var mt_onboarding: String = "N"
    var mt_show: String = "Y"
    
    // Terms
    var mt_agree1: Bool
    var mt_agree2: Bool
    var mt_agree3: Bool
    var mt_agree4: Bool
    var mt_agree5: Bool
    
    var mt_push1: Bool = true
    
    var mt_lat: Double?
    var mt_long: Double?
    
    // Social Login
    var mt_google_id: String?
    var mt_kakao_id: String?
    var mt_apple_id: String?
    
    var mt_token_id: String? = nil // FCM Token
}

struct UserIdentity: Codable {
    let mt_idx: Int
    let mt_id: String
    let mt_name: String
    let mt_nickname: String?
    let mt_level: Int
}

// MARK: - Profile Update Models

struct UpdateProfileRequest: Codable {
    let mt_name: String
    let mt_nickname: String
    let mt_birth: String?
    let mt_gender: Int?
}

struct UpdateProfileResponse: Codable {
    let success: Bool
    let message: String
    let result: String? // "Y" or "N"
}

struct UpdateContactRequest: Codable {
    let mt_hp: String
    let mt_email: String
}

struct UpdateContactResponse: Codable {
    let success: Bool
    let message: String
    let result: String?
}

// MARK: - Password Change Models

struct ChangePasswordRequest: Codable {
    let currentPassword: String
    let newPassword: String
}

struct ChangePasswordResponse: Codable {
    let success: Bool
    let message: String
    let result: String?
}

// MARK: - Profile Image Upload Models

struct ProfileImageUploadData: Codable {
    let file_path: String?
    let file_name: String?
    let file_size: Int?
}

struct ProfileImageUploadResponse: Codable {
    let success: Bool
    let message: String
    let data: ProfileImageUploadData?
    
    /// 새 프로필 이미지 URL 반환 (편의 프로퍼티)
    var newImageUrl: String? {
        data?.file_path
    }
}

// MARK: - Account Withdrawal Models

struct VerifyPasswordRequest: Codable {
    let currentPassword: String
}

struct VerifyPasswordResponse: Codable {
    let success: Bool
    let message: String
    let result: String? // "Y" or "N"
}

struct WithdrawRequest: Codable {
    let mt_retire_chk: Int
    let mt_retire_etc: String?
    let reasons: [String]?
}

struct WithdrawResponse: Codable {
    let success: Bool
    let message: String
    let result: String? // "Y" or "N"
}
