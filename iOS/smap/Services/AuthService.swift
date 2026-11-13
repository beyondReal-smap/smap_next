//
// AuthService.swift
// smap
//
// 인증 관련 네트워크 서비스
//

import Foundation
import Combine
import UIKit
import KakaoSDKAuth
import KakaoSDKUser

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
    nonisolated static let imageBaseURL = AppConfiguration.imageBaseURL

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

    /// Refresh token 저장 (Keychain 별도 item)
    func saveRefreshToken(_ token: String) {
        keychain.saveRefreshToken(token)
        print("[AuthService] Refresh 토큰 저장 완료 (\(token.count)자)")
    }

    /// Refresh token 조회
    nonisolated func getRefreshToken() -> String? {
        keychain.getRefreshToken()
    }

    /// Refresh token 삭제
    func deleteRefreshToken() {
        keychain.deleteRefreshToken()
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
        LocationManager.shared.updateUserInfo(
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
    func getUserData() -> SMAPUser? {
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
        LocationManager.shared.clearUserInfo()

        self.currentUser = nil
        print("[AuthService] 사용자 데이터 삭제 완료")
    }

    /// 로그인 상태 확인
    var isLoggedIn: Bool {
        return getToken() != nil && getUserData() != nil
    }

    func expireSession() {
        deleteToken()
        deleteRefreshToken()
        deleteUserData()
        NotificationCenter.default.post(name: NSNotification.Name("logout"), object: nil)
    }

    func logout() {
        Task {
            await unregisterPushToken()
            finishLogout()
        }
    }

    private func unregisterPushToken() async {
        guard let token = getToken() else { return }
        guard let fcmToken = getFCMToken(), !fcmToken.isEmpty else {
            print("[AuthService] 저장된 푸시 토큰이 없어 서버 해제를 건너뜁니다.")
            return
        }
        do {
            let _ = try await apiClient.requestRaw(.unregisterFCMToken(fcmToken), token: token)
        } catch {
            // 해제 실패로 사용자의 로그아웃이나 탈퇴를 막지 않습니다.
            print("[AuthService] 푸시 토큰 해제 실패: \(type(of: error))")
        }
    }

    /// Kakao SDK 에 저장된 토큰/세션 정리. 토큰이 없으면(Kakao 로 로그인하지 않은 사용자) 아무것도 하지 않는다.
    private func clearKakaoSession() {
        guard AuthApi.hasToken() else { return }
        UserApi.shared.logout { error in
            if let error {
                print("[AuthService] Kakao 세션 정리 실패: \(type(of: error))")
            }
        }
    }

    private func finishLogout() {
        clearKakaoSession()
        let refresh = getRefreshToken()
        deleteToken()
        deleteRefreshToken()
        deleteUserData()
        print("[AuthService] 로그아웃 완료 - 알림 발송")
        NotificationCenter.default.post(name: NSNotification.Name("logout"), object: nil)

        if let refresh, !refresh.isEmpty {
            Task.detached {
                do {
                    let _: LogoutResponse = try await APIClient.shared.request(
                        .logoutWithRefresh(refreshToken: refresh)
                    )
                    print("[AuthService] 서버 logout 완료")
                } catch {
                    print("[AuthService] 서버 logout 실패(로컬은 이미 정리됨): \(error)")
                }
            }
        }
    }

    // MARK: - Login API

    /// 전화번호/비밀번호 로그인
    func login(phoneNumber: String, password: String, fcmToken: String? = nil) async throws -> LoginResponse {
        // 전화번호에서 하이픈 제거
        let identifier = phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanPhone = identifier.contains("@") ? identifier : identifier.replacingOccurrences(of: "-", with: "")

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
            if let refresh = userData.refresh_token, !refresh.isEmpty {
                saveRefreshToken(refresh)
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

        if response.success == true,
           !(response.isNewUser ?? response.data?.isNewUser ?? false),
           let user = response.user ?? response.data?.user {
            if let token = response.token ?? response.data?.token {
                saveToken(token)
            }
            if let refresh = response.data?.refresh_token, !refresh.isEmpty {
                saveRefreshToken(refresh)
            }
            saveUserData(user)
        }

        return response
    }

    // MARK: - Kakao Login API

    /// Kakao 로그인 — 서버가 access token 으로 Kakao 사용자 ID 를 검증한다. 토큰은 로그에 남기지 않는다.
    func kakaoLogin(accessToken: String, kakaoId: String, email: String?, nickname: String?) async throws -> SocialLoginResponse {
        let request = KakaoLoginRequest(
            kakao_id: kakaoId,
            email: email,
            nickname: nickname,
            access_token: accessToken,
            os_type: "ios"
        )

        print("[AuthService] Kakao 로그인 요청")

        let response: SocialLoginResponse = try await apiClient.request(
            .kakaoLogin(request),
            token: nil
        )

        if response.success == true,
           !(response.isNewUser ?? response.data?.isNewUser ?? false),
           let user = response.user ?? response.data?.user {
            if let token = response.token ?? response.data?.token {
                saveToken(token)
            }
            if let refresh = response.data?.refresh_token, !refresh.isEmpty {
                saveRefreshToken(refresh)
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
                if let refresh = loginData.refresh_token, !refresh.isEmpty {
                    saveRefreshToken(refresh)
                }
                if let user = loginData.user {
                    saveUserData(user)
                }
            }
        }

        return response
    }

    struct EmailCodeResult: Decodable {
        let success: Bool
        let verification_token: String?
    }

    /// SMS 인증·전화번호 재설정 응답 — 실패 사유는 서버의 error/message 를 그대로 쓴다.
    struct PhoneAuthResult: Decodable {
        let success: Bool
        let error: String?
        let message: String?

        /// 사용자에게 보여 줄 서버 문구 (없으면 nil)
        var serverMessage: String? { error ?? message }
    }

    func emailAuth(path: String, body: [String: String]) async throws -> EmailCodeResult {
        try await unauthenticatedPost(path: path, body: body)
    }

    /// 전화번호 비밀번호 찾기용 호출 (/sms/send-verification-code, /sms/verify-code, /auth/reset-password-by-phone)
    func phoneAuth(path: String, body: [String: String]) async throws -> PhoneAuthResult {
        try await unauthenticatedPost(path: path, body: body)
    }

    private func unauthenticatedPost<T: Decodable>(path: String, body: [String: String]) async throws -> T {
        guard let url = URL(string: baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path) else {
            throw NetworkError.badRequest("인증 요청을 처리할 수 없습니다.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw NetworkError.badRequest("서버 응답을 확인해주세요.") }
            guard (200...299).contains(http.statusCode) else { throw NetworkError.fromHTTPStatus(http.statusCode, data: data) }
            return try JSONDecoder().decode(T.self, from: data)
        } catch let error as NetworkError { throw error }
        catch { throw NetworkError.badRequest("네트워크 연결을 확인해주세요.") }
    }

    // MARK: - 이메일 등록·변경 (로그인 상태, purpose: change_email)

    /// 인증번호 발송 — 401 시 APIClient 가 토큰 갱신 후 재시도한다.
    func sendChangeEmailCode(email: String) async throws -> EmailCodeResult {
        try await apiClient.request(.authedEmail(path: "/auth/email/send-code", body: ["email": email, "purpose": "change_email"]))
    }

    func verifyChangeEmailCode(email: String, code: String) async throws -> EmailCodeResult {
        try await apiClient.request(.authedEmail(path: "/auth/email/verify-code", body: ["email": email, "purpose": "change_email", "code": code]))
    }

    func changeEmail(email: String, verificationToken: String) async throws -> EmailCodeResult {
        try await apiClient.request(.authedEmail(path: "/auth/email/change", body: ["email": email, "verification_token": verificationToken]))
    }

    // MARK: - Registration

    /// 회원가입
    func register(request: RegisterRequest, verificationToken: String, phoneNumber: String?) async throws -> LoginResponse {
        print("[AuthService] 회원가입 요청: \(request.mt_id)")

        let response: LoginResponse = try await apiClient.request(
            .register(request, verificationToken: verificationToken, phoneNumber: phoneNumber),
            token: nil
        )

        guard response.success, let data = response.data,
              let token = data.token, !token.isEmpty,
              let refresh = data.refresh_token, !refresh.isEmpty,
              let user = data.user else {
            throw NetworkError.badRequest(response.success ? "회원가입 응답을 확인해주세요." : response.message)
        }
        saveToken(token)
        saveRefreshToken(refresh)
        saveUserData(user)

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
        await unregisterPushToken()
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
            finishLogout()
        }
        return response
    }

    // MARK: - FCM Token

    /// 저장된 FCM 토큰 조회
    func getFCMToken() -> String? {
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

    /// 그룹 일정 목록 가져오기 (홈 화면용 — 간략 응답)
    func getGroupSchedules(sgtIdx: Int) async throws -> [SmapSchedule] {
        try await apiClient.request(.getGroupSchedulesSummary(sgtIdx: sgtIdx), token: token)
    }
}
