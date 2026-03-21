import Foundation

/// 타입-safe API 엔드포인트 정의
enum APIEndpoint {

    // MARK: - Auth
    case login(mt_id: String, mt_pwd: String, fcmToken: String? = nil, deviceId: String? = nil, deviceModel: String? = nil, osVersion: String? = nil, appVersion: String? = nil)
    case googleLogin(GoogleLoginRequest)
    case appleLogin(AppleLoginRequest)
    case register(RegisterRequest)

    // MARK: - Profile
    case fetchProfile
    case updateProfile(UpdateProfileRequest)
    case changePassword(ChangePasswordRequest)
    case uploadProfileImage  // multipart — body는 APIClient에서 별도 처리
    case verifyPassword(VerifyPasswordRequest)
    case withdraw(WithdrawRequest)

    // MARK: - Groups
    case getCurrentUserGroups
    case getGroupStats(sgtIdx: Int)
    case createGroup(title: String, memo: String)
    case updateGroup(sgtIdx: Int, title: String, memo: String)
    case deleteGroup(sgtIdx: Int)  // Note: HTTP PUT (soft delete via sgt_show="N"), not DELETE
    case joinGroupByCode(code: String)
    case joinGroupById(sgtIdx: Int, mtIdx: Int)
    case getGroupSummary

    // MARK: - Group Members
    case getGroupMembers(sgtIdx: Int)
    case updateMemberRole(sgtIdx: Int, mtIdx: Int, isLeader: Bool)
    case removeMember(sgtIdx: Int, mtIdx: Int)

    // MARK: - My Places (Locations)
    case getMemberLocations(memberId: Int)
    case createLocation(memberId: Int, request: AnyEncodable)
    case updateLocation(locationId: Int, request: AnyEncodable)
    case deleteLocation(locationId: Int)
    case toggleLocationNotification(locationId: Int, enabled: String)

    // MARK: - Schedules
    case getGroupSchedules(sgtIdx: Int)

    // MARK: - Notifications
    case getMemberPushLogs(memberId: Int)
    case markNotificationRead(notificationId: Int)
    case markAllNotificationsRead(memberId: Int)
    case deleteNotification(notificationId: Int)
    case deleteAllNotifications(memberId: Int)

    // MARK: - Location Logging
    case createLocationLog(params: [String: Any])

    // MARK: - FCM
    case registerFCMToken(mtIdx: String, fcmToken: String, apnsToken: String?)

    // MARK: - Legacy (Phase 4에서 제거 예정)
    case legacyTokenAuth(mt_token_id: String)
    case legacyFileUpload(mt_idx: String)

    // MARK: - URL Request Builder

    func urlRequest(baseURL: String) -> URLRequest {
        let url: URL
        if let absoluteURL = absoluteURL {
            url = URL(string: absoluteURL)!
        } else {
            url = URL(string: "\(baseURL)\(path)")!
        }
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body = body {
            request.httpBody = body
        }
        return request
    }

    /// Legacy 엔드포인트용 절대 URL (v1 base URL을 사용하지 않는 경우)
    private var absoluteURL: String? {
        switch self {
        case .legacyTokenAuth:
            return AppConfiguration.apiBaseURL + "auth/"
        case .legacyFileUpload:
            return AppConfiguration.fileAPIURL + "member_file_upload.php"
        default:
            return nil
        }
    }

    private var path: String {
        switch self {
        case .login: return "/auth/login"
        case .googleLogin: return "/auth/google-login"
        case .appleLogin: return "/auth/apple-login"
        case .register: return "/auth/register"
        case .fetchProfile: return "/members/me"
        case .updateProfile: return "/members/update-profile"
        case .changePassword: return "/members/change-password"
        case .uploadProfileImage: return "/members/upload-profile-image"
        case .verifyPassword: return "/members/verify-password"
        case .withdraw: return "/members/withdraw"
        case .getCurrentUserGroups: return "/groups/current-user"
        case .getGroupStats(let sgtIdx): return "/groups/\(sgtIdx)/stats"
        case .createGroup: return "/groups/"
        case .updateGroup(let sgtIdx, _, _): return "/groups/\(sgtIdx)"
        case .deleteGroup(let sgtIdx): return "/groups/\(sgtIdx)"
        case .joinGroupByCode(let code): return "/groups/code/\(code)"
        case .joinGroupById(let sgtIdx, _): return "/groups/\(sgtIdx)/join"
        case .getGroupSummary: return "/groups/current-user/summary"
        case .getGroupMembers(let sgtIdx): return "/group-members/member/\(sgtIdx)"
        case .updateMemberRole(let sgtIdx, _, _): return "/group-members/\(sgtIdx)/role"
        case .removeMember(let sgtIdx, let mtIdx): return "/group-members/\(sgtIdx)/member/\(mtIdx)"
        case .getMemberLocations(let memberId): return "/locations/member/\(memberId)"
        case .createLocation(let memberId, _): return "/locations/members/\(memberId)/locations"
        case .updateLocation(let locationId, _): return "/locations/\(locationId)"
        case .deleteLocation(let locationId): return "/locations/\(locationId)"
        case .toggleLocationNotification(let locationId, _): return "/locations/\(locationId)/notification"
        case .getGroupSchedules(let sgtIdx): return "/schedules/group/\(sgtIdx)"
        case .getMemberPushLogs(let memberId): return "/push-logs/member/\(memberId)"
        case .markNotificationRead(let id): return "/push-logs/\(id)/read"
        case .markAllNotificationsRead(let memberId): return "/push-logs/read-all?mt_idx=\(memberId)"
        case .deleteNotification(let id): return "/push-logs/\(id)"
        case .deleteAllNotifications(let memberId): return "/push-logs/delete-all?mt_idx=\(memberId)"
        case .createLocationLog: return "/logs/member-location-logs"
        case .registerFCMToken: return "/member-fcm-token/register"
        case .legacyTokenAuth, .legacyFileUpload: return "" // absoluteURL 사용
        }
    }

    private enum HTTPMethod: String {
        case GET, POST, PUT, DELETE, PATCH
    }

    private var method: HTTPMethod {
        switch self {
        case .getCurrentUserGroups, .getGroupMembers, .getGroupStats,
             .fetchProfile, .getMemberLocations, .getGroupSchedules,
             .getMemberPushLogs, .joinGroupByCode, .getGroupSummary:
            return .GET
        case .login, .googleLogin, .appleLogin, .register,
             .createGroup, .joinGroupById, .createLocation,
             .updateProfile, .changePassword, .verifyPassword, .withdraw,
             .uploadProfileImage, .createLocationLog, .registerFCMToken,
             .markAllNotificationsRead, .deleteAllNotifications,
             .legacyTokenAuth, .legacyFileUpload:
            return .POST
        case .updateGroup, .updateLocation, .toggleLocationNotification,
             .updateMemberRole, .deleteGroup:
            return .PUT
        case .deleteLocation, .removeMember, .deleteNotification:
            return .DELETE
        case .markNotificationRead:
            return .PATCH
        }
    }

    private var body: Data? {
        switch self {
        case .login(let mtId, let mtPwd, let fcmToken, let deviceId, let deviceModel, let osVersion, let appVersion):
            var dict: [String: Any] = ["mt_id": mtId, "mt_pwd": mtPwd, "os_type": "ios"]
            if let fcmToken { dict["fcm_token"] = fcmToken }
            if let deviceId { dict["device_id"] = deviceId }
            if let deviceModel { dict["device_model"] = deviceModel }
            if let osVersion { dict["os_version"] = osVersion }
            if let appVersion { dict["app_version"] = appVersion }
            return try? JSONSerialization.data(withJSONObject: dict)
        case .googleLogin(let req): return try? JSONEncoder().encode(req)
        case .appleLogin(let req): return try? JSONEncoder().encode(req)
        case .register(let req): return try? JSONEncoder().encode(req)
        case .updateProfile(let req): return try? JSONEncoder().encode(req)
        case .changePassword(let req): return try? JSONEncoder().encode(req)
        case .verifyPassword(let req): return try? JSONEncoder().encode(req)
        case .withdraw(let req): return try? JSONEncoder().encode(req)
        case .createGroup(let title, let memo):
            return try? JSONSerialization.data(withJSONObject: ["sgt_title": title, "sgt_memo": memo, "sgt_show": "Y"])
        case .updateGroup(_, let title, let memo):
            return try? JSONSerialization.data(withJSONObject: ["sgt_title": title, "sgt_memo": memo])
        case .deleteGroup:
            return try? JSONSerialization.data(withJSONObject: ["sgt_show": "N"])
        case .joinGroupById(_, let mtIdx):
            return try? JSONSerialization.data(withJSONObject: ["mt_idx": mtIdx])
        case .updateMemberRole(_, let mtIdx, let isLeader):
            return try? JSONSerialization.data(withJSONObject: ["mt_idx": mtIdx, "is_leader": isLeader])
        case .createLocation(_, let req), .updateLocation(_, let req):
            return try? JSONEncoder().encode(req)
        case .toggleLocationNotification(_, let enabled):
            return try? JSONSerialization.data(withJSONObject: ["slt_enter_alarm": enabled])
        case .createLocationLog(let params):
            return try? JSONSerialization.data(withJSONObject: params)
        case .registerFCMToken(let mtIdx, let fcmToken, let apnsToken):
            var dict: [String: Any] = ["mt_idx": mtIdx, "fcm_token": fcmToken]
            if let apnsToken { dict["apns_token"] = apnsToken }
            return try? JSONSerialization.data(withJSONObject: dict)
        case .legacyTokenAuth(let mt_token_id):
            return try? JSONSerialization.data(withJSONObject: ["mt_token_id": mt_token_id])
        case .legacyFileUpload:
            return nil // multipart body는 APIClient.upload에서 별도 처리
        default:
            return nil
        }
    }
}

// MARK: - AnyEncodable (타입-erased Encodable wrapper)

struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        _encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
