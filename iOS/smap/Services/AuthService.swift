//
// AuthService.swift
// smap
//
// 인증 관련 네트워크 서비스
//

import Foundation
import Security
import Combine

// MARK: - AuthService

/// 인증 관련 API 통신 서비스
class AuthService: ObservableObject {
    
    @Published var currentUser: SMAPUser?
    
    // MARK: - Singleton
    static let shared = AuthService()
    
    // MARK: - Constants
    let baseURL = "https://api3.smap.site/api/v1"
    static let imageBaseURL = "https://api3.smap.site"  // 프로필 이미지 서버
    private let tokenKey = "smap_auth_token"
    private let userDataKey = "smap_user_data"
    private let loginTimeKey = "smap_login_time"
    
    /// 프로필 이미지 전체 URL 생성 헬퍼
    static func getProfileImageURL(_ path: String?) -> URL? {
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
    
    private init() {
        self.currentUser = getUserData()
    }
    
    // MARK: - Token Management (Keychain)
    
    /// JWT 토큰 저장
    func saveToken(_ token: String) {
        let data = token.data(using: .utf8)!
        
        // 기존 토큰 삭제
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: tokenKey
        ]
        SecItemDelete(deleteQuery as CFDictionary)
        
        // 새 토큰 저장
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: tokenKey,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        SecItemAdd(addQuery as CFDictionary, nil)
        
        print("✅ [AuthService] 토큰 저장 완료")
    }
    
    /// JWT 토큰 조회
    func getToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: tokenKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecSuccess, let data = result as? Data {
            return String(data: data, encoding: .utf8)
        }
        return nil
    }
    
    /// JWT 토큰 삭제
    func deleteToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: tokenKey
        ]
        SecItemDelete(query as CFDictionary)
        print("✅ [AuthService] 토큰 삭제 완료")
    }
    
    // MARK: - User Data Management (UserDefaults)
    
    /// 사용자 데이터 저장
    func saveUserData(_ user: SMAPUser) {
        if let encoded = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(encoded, forKey: userDataKey)
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: loginTimeKey)
            
            // 🆕 기존 Native 코드 및 WebView 호환성을 위한 키 설정
            let mtIdx = String(user.mt_idx)
            UserDefaults.standard.set(mtIdx, forKey: "mt_idx")
            UserDefaults.standard.set(user.mt_id, forKey: "mt_id")
            UserDefaults.standard.set(user.mt_name, forKey: "mt_name")
            UserDefaults.standard.set(user.mt_email, forKey: "mt_email")
            UserDefaults.standard.set(true, forKey: "is_logged_in")
            
            // 📍 위치 서비스에 사용자 정보 전달
            LocationService.sharedInstance.updateUserInfo(
                mtIdx: mtIdx,
                mtId: user.mt_id ?? "",
                mtName: user.mt_name ?? user.displayName
            )
            
            self.currentUser = user
            print("✅ [AuthService] 사용자 데이터 저장 완료: \(user.displayName) (idx: \(mtIdx))")
        }
    }
    
    /// 사용자 데이터 조회
    func getUserData() -> SMAPUser? {
        if let data = UserDefaults.standard.data(forKey: userDataKey) {
            return try? JSONDecoder().decode(SMAPUser.self, from: data)
        }
        return nil
    }
    
    /// 사용자 데이터 삭제
    func deleteUserData() {
        UserDefaults.standard.removeObject(forKey: userDataKey)
        UserDefaults.standard.removeObject(forKey: loginTimeKey)
        
        // 🆕 기존 키들도 삭제
        UserDefaults.standard.removeObject(forKey: "mt_idx")
        UserDefaults.standard.removeObject(forKey: "mt_id")
        UserDefaults.standard.removeObject(forKey: "mt_name")
        UserDefaults.standard.removeObject(forKey: "mt_email")
        UserDefaults.standard.set(false, forKey: "is_logged_in")
        
        // 📍 위치 서비스 정보 초기화
        LocationService.sharedInstance.clearUserInfo()
        
        self.currentUser = nil
        print("✅ [AuthService] 사용자 데이터 삭제 완료")
    }
    
    /// 로그인 상태 확인
    var isLoggedIn: Bool {
        return getToken() != nil && getUserData() != nil
    }
    
    /// 완전 로그아웃
    func logout() {
        deleteToken()
        deleteUserData()
        print("✅ [AuthService] 로그아웃 완료 - 알림 발송")
        // NotificationCenter를 통해 로그아웃 알림 전송 (MainView 및 RootCoordinator에서수신)
        NotificationCenter.default.post(name: NSNotification.Name("logout"), object: nil)
    }
    
    // MARK: - Login API
    
    /// 전화번호/비밀번호 로그인
    func login(phoneNumber: String, password: String, fcmToken: String? = nil) async throws -> LoginResponse {
        let url = URL(string: "\(baseURL)/auth/login")!
        
        // 전화번호에서 하이픈 제거
        let cleanPhone = phoneNumber.replacingOccurrences(of: "-", with: "")
        
        let request = LoginRequest(
            mt_id: cleanPhone,
            mt_pwd: password,
            fcm_token: fcmToken ?? getFCMToken()
        )
        
        print("📤 [AuthService] 로그인 요청: \(cleanPhone)")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError(detail: nil, message: "네트워크 오류가 발생했습니다.")
        }
        
        print("📥 [AuthService] 로그인 응답 상태: \(httpResponse.statusCode)")
        
        // 디버깅: 응답 본문 출력
        if let responseString = String(data: data, encoding: .utf8) {
            print("📥 [AuthService] 응답 데이터: \(responseString)")
        }
        
        // 응답 파싱
        let decoder = JSONDecoder()
        
        if httpResponse.statusCode == 200 {
            let loginResponse = try decoder.decode(LoginResponse.self, from: data)
            
            if loginResponse.success, let userData = loginResponse.data {
                // 토큰 저장
                if let token = userData.token {
                    saveToken(token)
                }
                // 사용자 데이터 저장
                if let user = userData.user {
                    saveUserData(user)
                }
            }
            
            return loginResponse
        } else {
            // 에러 응답 처리
            if let errorResponse = try? decoder.decode(APIError.self, from: data) {
                throw errorResponse
            }
            throw APIError(detail: nil, message: "로그인에 실패했습니다. (코드: \(httpResponse.statusCode))")
        }
    }
    
    // MARK: - Google Login API
    
    /// Google 로그인
    func googleLogin(idToken: String, email: String?, name: String?, googleId: String?) async throws -> SocialLoginResponse {
        let url = URL(string: "\(baseURL)/auth/google-login")!
        
        let request = GoogleLoginRequest(
            googleId: googleId,
            email: email,
            name: name,
            idToken: idToken
        )
        
        print("📤 [AuthService] Google 로그인 요청: \(email ?? "이메일 없음")")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError(detail: nil, message: "네트워크 오류가 발생했습니다.")
        }
        
        print("📥 [AuthService] Google 로그인 응답 상태: \(httpResponse.statusCode)")
        
        if let responseString = String(data: data, encoding: .utf8) {
            print("📥 [AuthService] 응답 데이터: \(responseString)")
        }
        
        let decoder = JSONDecoder()
        
        if httpResponse.statusCode == 200 {
            let loginResponse = try decoder.decode(SocialLoginResponse.self, from: data)
            
            if loginResponse.success == true, let user = loginResponse.user {
                // 토큰 저장
                if let token = loginResponse.token {
                    saveToken(token)
                }
                // 사용자 데이터 저장
                saveUserData(user)
            }
            
            return loginResponse
        } else {
            if let errorResponse = try? decoder.decode(APIError.self, from: data) {
                throw errorResponse
            }
            throw APIError(detail: nil, message: "Google 로그인에 실패했습니다.")
        }
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
        let url = URL(string: "\(baseURL)/auth/apple-login")!
        
        let request = AppleLoginRequest(
            userIdentifier: userIdentifier,
            email: email,
            userName: userName,
            identityToken: identityToken,
            authorizationCode: authorizationCode
        )
        
        print("📤 [AuthService] Apple 로그인 요청: \(email ?? "이메일 없음")")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError(detail: nil, message: "네트워크 오류가 발생했습니다.")
        }
        
        print("📥 [AuthService] Apple 로그인 응답 상태: \(httpResponse.statusCode)")
        
        if let responseString = String(data: data, encoding: .utf8) {
            print("📥 [AuthService] 응답 데이터: \(responseString)")
        }
        
        let decoder = JSONDecoder()
        
        if httpResponse.statusCode == 200 {
            let loginResponse = try decoder.decode(AppleLoginResponse.self, from: data)
            
            if loginResponse.success, let loginData = loginResponse.data {
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
            
            return loginResponse
        } else {
            if let errorResponse = try? decoder.decode(APIError.self, from: data) {
                throw errorResponse
            }
            throw APIError(detail: nil, message: "Apple 로그인에 실패했습니다.")
        }
    }
    
    // MARK: - Registration
    
    /// 회원가입
    func register(request: RegisterRequest) async throws -> UserIdentity {
        let url = URL(string: "\(baseURL)/auth/register")!
        
        print("📤 [AuthService] 회원가입 요청: \(request.mt_id)")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError(detail: nil, message: "네트워크 오류가 발생했습니다.")
        }
        
        print("📥 [AuthService] 회원가입 응답 상태: \(httpResponse.statusCode)")
        
        if let responseString = String(data: data, encoding: .utf8) {
            print("📥 [AuthService] 응답 데이터: \(responseString)")
        }
        
        let decoder = JSONDecoder()
        
        if httpResponse.statusCode == 201 {
            let userIdentity = try decoder.decode(UserIdentity.self, from: data)
            
            // 회원가입 성공 후 자동 로그인 처리를 위해 데이터 저장
            // 토큰은 응답에 포함되지 않을 수 있으므로 (UserIdentity만 반환됨),
            // 별도 로그인 과정을 거치거나, 백엔드에서 토큰을 같이 주도록 수정이 필요할 수 있음.
            // 현재 백엔드(auth.py) 코드를 보면 UserIdentity만 리턴함.
            // 따라서 가입 후 바로 로그인이 안될 수 있음. -> 로그인 화면으로 이동하거나, 별도 로그인 호출 필요.
            // User schema (backend/app/api/v1/endpoints/auth.py @router.post("/register")) returns UserIdentity.
            
            return userIdentity
        } else {
            if let errorResponse = try? decoder.decode(APIError.self, from: data) {
                throw errorResponse
            }
            throw APIError(detail: nil, message: "회원가입에 실패했습니다. (코드: \(httpResponse.statusCode))")
        }
    }

    // MARK: - User Management API

    /// 사용자 프로필 정보 조회 및 업데이트
    func fetchUserProfile() async throws -> SMAPUser {
        let url = URL(string: "\(baseURL)/members/me")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        if let token = getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError(detail: nil, message: "네트워크 오류가 발생했습니다.")
        }
        
        if httpResponse.statusCode != 200 {
            throw APIError(detail: nil, message: "프로필 정보를 가져오는데 실패했습니다. (코드: \(httpResponse.statusCode))")
        }
        
        // Backend returns: {"result": "Y", "data": profile_data, "message": "...", "success": True}
        struct ProfileResponse: Codable {
            let success: Bool
            let data: SMAPUser?
        }
        
        do {
            let profileResponse = try JSONDecoder().decode(ProfileResponse.self, from: data)
            if profileResponse.success, let user = profileResponse.data {
                saveUserData(user)
                return user
            } else {
                throw APIError(detail: nil, message: "프로필 정보를 가져오는데 실패했습니다.")
            }
        } catch {
            print("❌ [AuthService] 프로필 파싱 실패: \(error)")
            throw APIError(detail: nil, message: "데이터 처리 중 오류가 발생했습니다.")
        }
    }

    /// 프로필 정보 업데이트
    func updateProfile(name: String, nickname: String, birth: String?, gender: Int?) async throws -> UpdateProfileResponse {
        let url = URL(string: "\(baseURL)/members/update-profile")!
        let updateRequest = UpdateProfileRequest(mt_name: name, mt_nickname: nickname, mt_birth: birth, mt_gender: gender)
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(updateRequest)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "프로필 업데이트에 실패했습니다.")
        }
        
        let updateResponse = try JSONDecoder().decode(UpdateProfileResponse.self, from: data)
        if updateResponse.success {
            _ = try? await fetchUserProfile() // 정보 갱신
        }
        return updateResponse
    }

    /// 비밀번호 변경
    func changePassword(current: String, new: String) async throws -> ChangePasswordResponse {
        let url = URL(string: "\(baseURL)/members/change-password")!
        let passwordRequest = ChangePasswordRequest(currentPassword: current, newPassword: new)
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(passwordRequest)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "비밀번호 변경에 실패했습니다.")
        }
        
        return try JSONDecoder().decode(ChangePasswordResponse.self, from: data)
    }

    /// 프로필 이미지 업로드
    func uploadProfileImage(image: Data) async throws -> ProfileImageUploadResponse {
        let url = URL(string: "\(baseURL)/members/upload-profile-image")!
        let boundary = "Boundary-\(UUID().uuidString)"
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token = getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"profile.jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(image)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        // 디버깅: 응답 출력
        if let responseString = String(data: data, encoding: .utf8) {
            print("📸 [AuthService] 프로필 이미지 업로드 응답: \(responseString)")
        }
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "이미지 업로드에 실패했습니다.")
        }
        
        let uploadResponse = try JSONDecoder().decode(ProfileImageUploadResponse.self, from: data)
        
        if uploadResponse.success {
            print("✅ [AuthService] 프로필 이미지 업로드 성공: \(uploadResponse.newImageUrl ?? "URL 없음")")
            
            // 서버에서 최신 사용자 정보 가져오기
            do {
                let updatedUser = try await fetchUserProfile()
                print("✅ [AuthService] 사용자 정보 갱신 완료: mt_file1 = \(updatedUser.mt_file1 ?? "nil")")
            } catch {
                // fetchUserProfile 실패 시에도 로컬에서 즉시 업데이트
                print("⚠️ [AuthService] fetchUserProfile 실패, 로컬 업데이트 시도: \(error)")
                if let newImageUrl = uploadResponse.newImageUrl, let existingUser = currentUser {
                    // 로컬 사용자 데이터에 새 이미지 URL 반영
                    // SMAPUser는 let 프로퍼티이므로 새 인스턴스 생성 필요
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
                    print("✅ [AuthService] 로컬 사용자 데이터에 새 이미지 URL 반영: \(newImageUrl)")
                }
            }
        }
        
        return uploadResponse
    }

    // MARK: - Account Withdrawal

    /// 비밀번호 확인 (회원탈퇴 전 본인 확인용)
    func verifyPassword(password: String) async throws -> VerifyPasswordResponse {
        let url = URL(string: "\(baseURL)/members/verify-password")!
        let verifyRequest = VerifyPasswordRequest(currentPassword: password)
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(verifyRequest)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "비밀번호 확인에 실패했습니다.")
        }
        
        return try JSONDecoder().decode(VerifyPasswordResponse.self, from: data)
    }

    /// 회원 탈퇴
    func withdraw(reasonIdx: Int, etcReason: String?, reasons: [String]) async throws -> WithdrawResponse {
        let url = URL(string: "\(baseURL)/members/withdraw")!
        let withdrawRequest = WithdrawRequest(
            mt_retire_chk: reasonIdx,
            mt_retire_etc: etcReason,
            reasons: reasons
        )
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(withdrawRequest)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "회원 탈퇴 처리에 실패했습니다.")
        }
        
        let withdrawResponse = try JSONDecoder().decode(WithdrawResponse.self, from: data)
        if withdrawResponse.success {
            logout() // 탈퇴 성공 시 로그아웃 처리
        }
        return withdrawResponse
    }

    // MARK: - FCM Token
    
    /// 저장된 FCM 토큰 조회
    private func getFCMToken() -> String? {
        return UserDefaults.standard.string(forKey: "fcm_token")
    }
}

// MARK: - HomeService

class HomeService {
    static let shared = HomeService()
    private let authService = AuthService.shared
    
    private init() {}
    
    private var baseURL: String {
        return authService.baseURL
    }
    
    /// 내 그룹 목록 가져오기
    func getMyGroups() async throws -> [SmapGroup] {
        let url = URL(string: "\(baseURL)/groups/current-user")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 인증 토큰 추가
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        print("🌐 [HomeService] getMyGroups request: \(url.absoluteString)")
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("🌐 [HomeService] getMyGroups response Code: \(httpResponse.statusCode)")
            if httpResponse.statusCode != 200 {
                let errorBody = String(data: data, encoding: .utf8) ?? "No body"
                print("🌐 [HomeService] getMyGroups error body: \(errorBody)")
            }
        }
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 목록을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode([SmapGroup].self, from: data)
    }
    
    /// 그룹 멤버 및 위치 정보 가져오기
    func getGroupMembers(sgtIdx: Int) async throws -> [SmapGroupMember] {
        let url = URL(string: "\(baseURL)/group-members/member/\(sgtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 인증 토큰 추가
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        print("🌐 [HomeService] getGroupMembers request: \(url.absoluteString)")
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("🌐 [HomeService] getGroupMembers response Code: \(httpResponse.statusCode)")
            if httpResponse.statusCode != 200 {
                let errorBody = String(data: data, encoding: .utf8) ?? "No body"
                print("🌐 [HomeService] getGroupMembers error body: \(errorBody)")
            }
        }
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "멤버 정보를 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode([SmapGroupMember].self, from: data)
    }
    
    /// 그룹 일정 목록 가져오기
    func getGroupSchedules(sgtIdx: Int) async throws -> [SmapSchedule] {
        let url = URL(string: "\(baseURL)/schedules/group/\(sgtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 인증 토큰 추가
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        print("🌐 [HomeService] getGroupSchedules request: \(url.absoluteString)")
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("🌐 [HomeService] getGroupSchedules response Code: \(httpResponse.statusCode)")
            if httpResponse.statusCode != 200 {
                let errorBody = String(data: data, encoding: .utf8) ?? "No body"
                print("🌐 [HomeService] getGroupSchedules error body: \(errorBody)")
            }
        }
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "일정 목록을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode([SmapSchedule].self, from: data)
    }
}
