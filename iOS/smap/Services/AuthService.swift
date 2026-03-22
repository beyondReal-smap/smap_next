//
// AuthService.swift
// smap
//
// 인증 관련 네트워크 서비스
//

import Foundation
import Combine
import UIKit

// MARK: - AuthService

/// 인증 관련 API 통신 서비스
@MainActor
class AuthService: ObservableObject {

    @Published var currentUser: SMAPUser?

    // MARK: - Singleton
    static let shared = AuthService()

    // MARK: - Dependencies
    private let apiClient: APIClient
    private let keychain: KeychainManager
    private let userDefaults: UserDefaultsManager

    // MARK: - Constants

    /// 외부 호환용 baseURL (기존 코드에서 authService.baseURL 참조)
    let baseURL = AppConfiguration.apiV1BaseURL
    static let imageBaseURL = AppConfiguration.imageBaseURL

    /// 프로필 이미지 전체 URL 생성 헬퍼
    nonisolated static func getProfileImageURL(_ path: String?) -> URL? {
        guard let path = path?.trimmingCharacters(in: .whitespaces), !path.isEmpty else { return nil }

        // 1. 완전한 URL인 경우
        if path.hasPrefix("http://") || path.hasPrefix("https://") {
            return URL(string: path)
        }

        // 2. 상대 경로 (/로 시작)인 경우
        if path.hasPrefix("/") {
            return URL(string: "\(imageBaseURL)\(path)")
        }

        // 3. 파일명만 있는 경우 (/images/ 추가)
        return URL(string: "\(imageBaseURL)/images/\(path)")
    }

    // MARK: - Initializers

    private init() {
        self.apiClient = .shared
        self.keychain = .shared
        self.userDefaults = .shared
        self.currentUser = userDefaults.getUserData()
    }

    /// 테스트용 DI 이니셜라이저
    init(apiClient: APIClient, keychain: KeychainManager, userDefaults: UserDefaultsManager) {
        self.apiClient = apiClient
        self.keychain = keychain
        self.userDefaults = userDefaults
        self.currentUser = userDefaults.getUserData()
    }

    // MARK: - Token Management (KeychainManager)

    /// JWT 토큰 저장
    func saveToken(_ token: String) {
        keychain.saveToken(token)
        print("[AuthService] 토큰 저장 완료")
    }

    /// JWT 토큰 조회
    nonisolated func getToken() -> String? {
        keychain.getToken()
    }

    /// JWT 토큰 삭제
    func deleteToken() {
        keychain.deleteToken()
        print("[AuthService] 토큰 삭제 완료")
    }

    // MARK: - User Data Management (UserDefaultsManager)

    /// 사용자 데이터 저장
    func saveUserData(_ user: SMAPUser) {
        // UserDefaultsManager로 사용자 데이터 저장
        userDefaults.saveUserData(user)

        // 기존 Native 코드 및 WebView 호환성을 위한 키 설정
        let mtIdx = String(user.mt_idx ?? 0)
        userDefaults.mtIdx = mtIdx
        userDefaults.mtId = user.mt_id
        userDefaults.mtName = user.mt_name
        userDefaults.mtEmail = user.mt_email
        userDefaults.isLoggedIn = true

        // 위치 서비스에 사용자 정보 전달
        LocationService.sharedInstance.updateUserInfo(
            mtIdx: mtIdx,
            mtId: user.mt_id ?? "",
            mtName: user.mt_name ?? user.displayName
        )

        self.currentUser = user
        print("[AuthService] 사용자 데이터 저장 완료: \(user.displayName) (idx: \(mtIdx))")

        // FCM 토큰 업데이트 트리거 (AppDelegate의 handleForceUpdateFCMToken 호출)
        NotificationCenter.default.post(name: NSNotification.Name("ForceUpdateFCMToken"), object: nil)
        print("[AuthService] FCM 토큰 강제 업데이트 노티피케이션 발송")
    }

    /// 사용자 데이터 조회
    nonisolated func getUserData() -> SMAPUser? {
        userDefaults.getUserData()
    }

    /// 사용자 데이터 삭제
    func deleteUserData() {
        // 기존 키들도 삭제
        userDefaults.mtIdx = nil
        userDefaults.mtId = nil
        userDefaults.mtName = nil
        userDefaults.mtEmail = nil
        userDefaults.isLoggedIn = false
        userDefaults.clearAll()

        // 위치 서비스 정보 초기화
        LocationService.sharedInstance.clearUserInfo()

        self.currentUser = nil
        print("[AuthService] 사용자 데이터 삭제 완료")
    }

    /// 로그인 상태 확인
    nonisolated var isLoggedIn: Bool {
        return getToken() != nil && getUserData() != nil
    }

    /// 완전 로그아웃
    func logout() {
        deleteToken()
        deleteUserData()
        print("[AuthService] 로그아웃 완료 - 알림 발송")
        // NotificationCenter를 통해 로그아웃 알림 전송 (RootView에서 수신)
        NotificationCenter.default.post(name: NSNotification.Name("logout"), object: nil)
    }

    // MARK: - Login API

    /// 전화번호/비밀번호 로그인
    func login(phoneNumber: String, password: String, fcmToken: String? = nil) async throws -> LoginResponse {
        // 전화번호에서 하이픈 제거
        let cleanPhone = phoneNumber.replacingOccurrences(of: "-", with: "")

        // 기기 정보 가져오기 (MainActor에서 캡처)
        let deviceInfo = await MainActor.run {
            let device = UIDevice.current
            return (
                deviceId: device.identifierForVendor?.uuidString,
                deviceModel: device.model,
                osVersion: device.systemVersion
            )
        }
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String

        print("[AuthService] 로그인 요청: \(cleanPhone)")

        let response: LoginResponse = try await apiClient.request(
            .login(
                mt_id: cleanPhone,
                mt_pwd: password,
                fcmToken: fcmToken ?? getFCMToken(),
                deviceId: deviceInfo.deviceId,
                deviceModel: deviceInfo.deviceModel,
                osVersion: deviceInfo.osVersion,
                appVersion: appVersion
            ),
            token: nil
        )

        if response.success, let userData = response.data {
            if let token = userData.token {
                saveToken(token)
            }
            if let user = userData.user {
                saveUserData(user)
            }
        }

        return response
    }

    // MARK: - Google Login API

    /// Google 로그인
    func googleLogin(idToken: String, email: String?, name: String?, googleId: String?) async throws -> SocialLoginResponse {
        let googleRequest = GoogleLoginRequest(
            googleId: googleId,
            email: email,
            name: name,
            idToken: idToken
        )

        print("[AuthService] Google 로그인 요청: \(email ?? "이메일 없음")")

        let response: SocialLoginResponse = try await apiClient.request(
            .googleLogin(googleRequest),
            token: nil
        )

        if response.success == true, let user = response.user {
            if let token = response.token {
                saveToken(token)
            }
            saveUserData(user)
        }

        return response
    }

    // MARK: - Apple Login API

    /// Apple 로그인
    func appleLogin(
        userIdentifier: String,
        email: String?,
        userName: String?,
        identityToken: String?,
        authorizationCode: String?
    ) async throws -> AppleLoginResponse {
        let appleRequest = AppleLoginRequest(
            userIdentifier: userIdentifier,
            email: email,
            userName: userName,
            identityToken: identityToken,
            authorizationCode: authorizationCode
        )

        print("[AuthService] Apple 로그인 요청: \(email ?? "이메일 없음")")

        let response: AppleLoginResponse = try await apiClient.request(
            .appleLogin(appleRequest),
            token: nil
        )

        if response.success, let loginData = response.data {
            // 신규 회원이 아닌 경우에만 저장
            if !loginData.isNewUser {
                if let token = loginData.token {
                    saveToken(token)
                }
                if let user = loginData.user {
                    saveUserData(user)
                }
            }
        }

        return response
    }

    // MARK: - Registration

    /// 회원가입
    func register(request: RegisterRequest) async throws -> LoginResponse {
        print("[AuthService] 회원가입 요청: \(request.mt_id)")

        let response: LoginResponse = try await apiClient.request(
            .register(request),
            token: nil
        )

        // 토큰 및 사용자 정보 저장 (Backend가 토큰을 반환하므로 즉시 로그인 처리)
        if let data = response.data, let token = data.token {
            saveToken(token)
            print("[AuthService] 회원가입 후 토큰 저장 완료")

            if let user = data.user {
                saveUserData(user)
                print("[AuthService] 회원가입 후 사용자 정보 저장 완료: \(user.displayName)")
            }
        }

        return response
    }

    // MARK: - User Management API

    /// 사용자 프로필 정보 조회 및 업데이트
    func fetchUserProfile() async throws -> SMAPUser {
        struct ProfileResponse: Codable {
            let success: Bool
            let data: SMAPUser?
        }

        let response: ProfileResponse = try await apiClient.request(
            .fetchProfile,
            token: getToken()
        )

        if response.success, let user = response.data {
            saveUserData(user)
            return user
        } else {
            throw NetworkError.badRequest("프로필 정보를 가져오는데 실패했습니다.")
        }
    }

    /// 프로필 정보 업데이트
    func updateProfile(name: String, nickname: String, birth: String?, gender: Int?) async throws -> UpdateProfileResponse {
        let updateRequest = UpdateProfileRequest(mt_name: name, mt_nickname: nickname, mt_birth: birth, mt_gender: gender)

        let response: UpdateProfileResponse = try await apiClient.request(
            .updateProfile(updateRequest),
            token: getToken()
        )

        if response.success {
            _ = try? await fetchUserProfile() // 정보 갱신
        }
        return response
    }

    /// 비밀번호 변경
    func changePassword(current: String, new: String) async throws -> ChangePasswordResponse {
        let passwordRequest = ChangePasswordRequest(currentPassword: current, newPassword: new)

        return try await apiClient.request(
            .changePassword(passwordRequest),
            token: getToken()
        )
    }

    /// 프로필 이미지 업로드
    func uploadProfileImage(image: Data) async throws -> ProfileImageUploadResponse {
        let responseData = try await apiClient.upload(
            .uploadProfileImage,
            fileData: image,
            fileName: "profile.jpg",
            fieldName: "file",
            mimeType: "image/jpeg",
            token: getToken()
        )

        let uploadResponse = try JSONDecoder().decode(ProfileImageUploadResponse.self, from: responseData)

        if uploadResponse.success {
            print("[AuthService] 프로필 이미지 업로드 성공: \(uploadResponse.newImageUrl ?? "URL 없음")")

            // 서버에서 최신 사용자 정보 가져오기
            do {
                let updatedUser = try await fetchUserProfile()
                print("[AuthService] 사용자 정보 갱신 완료: mt_file1 = \(updatedUser.mt_file1 ?? "nil")")
            } catch {
                // fetchUserProfile 실패 시에도 로컬에서 즉시 업데이트
                print("[AuthService] fetchUserProfile 실패, 로컬 업데이트 시도: \(error)")
                if let newImageUrl = uploadResponse.newImageUrl, let existingUser = currentUser {
                    let newUser = SMAPUser(
                        mt_idx: existingUser.mt_idx,
                        mt_id: existingUser.mt_id,
                        mt_name: existingUser.mt_name,
                        mt_nickname: existingUser.mt_nickname,
                        mt_email: existingUser.mt_email,
                        mt_hp: existingUser.mt_hp,
                        mt_level: existingUser.mt_level,
                        mt_status: existingUser.mt_status,
                        mt_type: existingUser.mt_type,
                        mt_file1: newImageUrl,
                        mt_google_id: existingUser.mt_google_id,
                        mt_apple_id: existingUser.mt_apple_id,
                        mt_birth: existingUser.mt_birth,
                        mt_gender: existingUser.mt_gender,
                        mt_wdate: existingUser.mt_wdate,
                        mt_ldate: existingUser.mt_ldate
                    )
                    saveUserData(newUser)
                    print("[AuthService] 로컬 사용자 데이터에 새 이미지 URL 반영: \(newImageUrl)")
                }
            }
        }

        return uploadResponse
    }

    // MARK: - Account Withdrawal

    /// 비밀번호 확인 (회원탈퇴 전 본인 확인용)
    func verifyPassword(password: String) async throws -> VerifyPasswordResponse {
        let verifyRequest = VerifyPasswordRequest(currentPassword: password)

        return try await apiClient.request(
            .verifyPassword(verifyRequest),
            token: getToken()
        )
    }

    /// 회원 탈퇴
    func withdraw(reasonIdx: Int, etcReason: String?, reasons: [String]) async throws -> WithdrawResponse {
        let withdrawRequest = WithdrawRequest(
            mt_retire_chk: reasonIdx,
            mt_retire_etc: etcReason,
            reasons: reasons
        )

        let response: WithdrawResponse = try await apiClient.request(
            .withdraw(withdrawRequest),
            token: getToken()
        )

        if response.success {
            logout() // 탈퇴 성공 시 로그아웃 처리
        }
        return response
    }

    // MARK: - FCM Token

    /// 저장된 FCM 토큰 조회
    nonisolated func getFCMToken() -> String? {
        return userDefaults.fcmToken
    }
}

// MARK: - HomeService

class HomeService {
    static let shared = HomeService()
    private let apiClient: APIClient
    private var token: String? { KeychainManager.shared.getToken() }

    private init() {
        self.apiClient = .shared
    }

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    /// 내 그룹 목록 가져오기
    func getMyGroups() async throws -> [SmapGroup] {
        try await apiClient.request(.getCurrentUserGroups, token: token)
    }

    /// 그룹 멤버 및 위치 정보 가져오기
    func getGroupMembers(sgtIdx: Int) async throws -> [SmapGroupMember] {
        try await apiClient.request(.getGroupMembers(sgtIdx: sgtIdx), token: token)
    }

    /// 그룹 일정 목록 가져오기
    func getGroupSchedules(sgtIdx: Int) async throws -> [SmapSchedule] {
        try await apiClient.request(.getGroupSchedules(sgtIdx: sgtIdx), token: token)
    }
}
