//
// LoginViewModel.swift
// smap
//
// 로그인 화면 상태 관리 (iOS 13+)
//

import Foundation
import SwiftUI
import AuthenticationServices
import GoogleSignIn
import Combine

// MARK: - LoginViewModel

@MainActor
class LoginViewModel: ObservableObject {
    
    // MARK: - Published Properties
    
    /// 전화번호 입력값
    @Published var phoneNumber: String = ""
    
    /// 비밀번호 입력값
    @Published var password: String = ""
    
    /// 비밀번호 표시 여부
    @Published var showPassword: Bool = false
    
    /// 로딩 상태
    @Published var isLoading: Bool = false
    
    /// 에러 메시지
    @Published var errorMessage: String?
    
    /// 에러 표시 여부
    @Published var showError: Bool = false
    
    /// 로그인 성공 여부
    @Published var isLoggedIn: Bool = false
    
    /// 신규 회원 여부 (소셜 로그인 시)
    @Published var isNewUser: Bool = false
    
    /// 소셜 로그인 데이터 (신규 회원용)
    @Published var socialLoginData: [String: Any]?
    
    // MARK: - Private Properties
    
    private let authService = AuthService.shared
    
    // MARK: - Initialization
    
    init() {
        // 저장된 로그인 상태 확인
        isLoggedIn = authService.isLoggedIn
    }
    
    
    // MARK: - Validation
    
    /// 입력값 유효성 검사
    var isInputValid: Bool {
        let identifier = phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanPhone = identifier.replacingOccurrences(of: "-", with: "")
        let isPhone = cleanPhone.range(of: "^[0-9]{10,11}$", options: .regularExpression) != nil
        let isEmail = identifier.range(of: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", options: .regularExpression) != nil
        return (isPhone || isEmail) && !password.isEmpty
    }
    
    // MARK: - Login Actions
    
    /// 전화번호/비밀번호 로그인 (iOS 15+ async)
    @available(iOS 15.0, *)
    func login() async {
        guard isInputValid else {
            DispatchQueue.main.async { self.showErrorMessage("이메일 또는 전화번호와 비밀번호를 확인해주세요.") }
            return
        }
        
        DispatchQueue.main.async { 
            self.isLoading = true
            self.errorMessage = nil
        }
        
        do {
            let response = try await authService.login(
                phoneNumber: phoneNumber,
                password: password
            )
            
            DispatchQueue.main.async {
                if response.success {
                    print("✅ [LoginViewModel] 로그인 성공")
                    self.isLoggedIn = true
                } else {
                    self.showErrorMessage(response.message)
                }
                self.isLoading = false
            }
        } catch let error as NetworkError {
            DispatchQueue.main.async {
                self.showErrorMessage(error.userMessage)
                self.isLoading = false
            }
        } catch {
            DispatchQueue.main.async {
                self.showErrorMessage("네트워크 오류가 발생했습니다.")
                self.isLoading = false
            }
        }
    }

    /// 전화번호/비밀번호 로그인 (iOS 13/14 동기 래퍼)
    func loginSync() {
        guard isInputValid else {
            showErrorMessage("전화번호와 비밀번호를 입력해주세요.")
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        // dispatchQueue를 사용한 비동기 처리
        let currentPhoneNumber = phoneNumber
        let currentPassword = password
        
        DispatchQueue.global(qos: .userInitiated).async {
            let semaphore = DispatchSemaphore(value: 0)
            var loginResponse: LoginResponse?
            var loginError: Error?
            
            if #available(iOS 15.0, *) {
                Task {
                    do {
                        loginResponse = try await self.authService.login(
                            phoneNumber: currentPhoneNumber,
                            password: currentPassword
                        )
                    } catch {
                        loginError = error
                    }
                    semaphore.signal()
                }
            } else {
                // iOS 13/14에서는 URLSession을 직접 사용
                let url = URL(string: "https://api3.aiagnt.kr/api/v1/auth/login-home")!
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let cleanPhone = currentPhoneNumber.replacingOccurrences(of: "-", with: "")
                let body: [String: Any] = [
                    "mt_id": cleanPhone,
                    "mt_pwd": currentPassword
                ]
                request.httpBody = try? JSONSerialization.data(withJSONObject: body)

                URLSession.shared.dataTask(with: request) { data, response, error in
                    if let error = error {
                        loginError = error
                    } else if let data = data {
                        do {
                            loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
                        } catch {
                            print("❌ [LoginViewModel] 로그인 응답 파싱 실패: \(error)")
                            loginError = error
                        }
                    }
                    semaphore.signal()
                }.resume()
            }
            
            semaphore.wait()
            
            DispatchQueue.main.async {
                if let response = loginResponse {
                    if response.success {
                        print("✅ [LoginViewModel] 로그인 성공")
                        
                        // 토큰/사용자 데이터 저장
                        if let token = response.data?.token {
                            self.authService.saveToken(token)
                        }
                        if let user = response.data?.user {
                            self.authService.saveUserData(user)
                        }
                        
                        self.isLoggedIn = true
                    } else {
                        self.showErrorMessage(response.message)
                    }
                } else if let error = loginError {
                    self.showErrorMessage("네트워크 오류: \(error.localizedDescription)")
                } else {
                    self.showErrorMessage("로그인에 실패했습니다.")
                }
                self.isLoading = false
            }
        }
    }
    
    /// Google 로그인
    func googleLogin() {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            showErrorMessage("Google 로그인을 시작할 수 없습니다.")
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController) { [weak self] result, error in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                if let error = error {
                    if (error as NSError).code == GIDSignInError.canceled.rawValue {
                        print("ℹ️ [LoginViewModel] Google 로그인 취소됨")
                    } else {
                        self.showErrorMessage("Google 로그인에 실패했습니다: \(error.localizedDescription)")
                    }
                    self.isLoading = false
                    return
                }
                
                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString else {
                    self.showErrorMessage("Google 로그인 정보를 가져올 수 없습니다.")
                    self.isLoading = false
                    return
                }
                
                let email = user.profile?.email
                let name = user.profile?.name
                let googleId = user.userID
                
                print("✅ [LoginViewModel] Google 로그인 성공: \(email ?? "이메일 없음")")
                
                // 서버로 인증 요청
                self.processGoogleLoginSync(idToken: idToken, email: email, name: name, googleId: googleId)
            }
        }
    }
    
    /// Google 로그인 처리 (동기 래퍼)
    private func processGoogleLoginSync(idToken: String, email: String?, name: String?, googleId: String?) {
        DispatchQueue.global(qos: .userInitiated).async {
            let semaphore = DispatchSemaphore(value: 0)
            var loginResponse: SocialLoginResponse?
            var loginError: Error?
            
            if #available(iOS 15.0, *) {
                Task {
                    do {
                        loginResponse = try await self.authService.googleLogin(
                            idToken: idToken,
                            email: email,
                            name: name,
                            googleId: googleId
                        )
                        
                        // 신규 유저인 경우 자동 가입 시도 -> 제거 (사용자 요청에 따라 수동 가입으로 전환)
                        // Check both root property and data object property
                        let isNewUser = loginResponse?.isNewUser ?? loginResponse?.data?.isNewUser ?? false
                        
                        // IF isNewUser, do NOT register automatically. Just let it finish so UI can handle it.
                        if let _ = loginResponse, isNewUser == true {
                           print("🆕 [LoginViewModel] 신규 Google 회원 감지 - 수동 회원가입으로 이동합니다.")
                        }
                    } catch {
                        print("❌ [LoginViewModel] 자동 가입/로그인 중 오류: \(error)")
                        loginError = error
                    }
                    semaphore.signal()
                }
            } else {
                // iOS 13/14 fallback - 기존 로직 유지 (자동 가입 미지원)
                semaphore.signal()
            }
            
            semaphore.wait()
            
            DispatchQueue.main.async {
                if let response = loginResponse, response.success == true {
                    // 재로그인 후에는 isNewUser가 false여야 함
                    // Check logic again for final response
                    let finalIsNewUser = response.isNewUser ?? response.data?.isNewUser ?? false
                    
                    if finalIsNewUser == true {
                        // 자동 가입 실패 또는 로직 오류로 여전히 신규 유저로 인식됨 -> 수동 가입으로 이동
                        self.socialLoginData = [
                            "provider": "google",
                            "email": email ?? "",
                            "name": name ?? "",
                            "social_token": idToken,
                            "google_id": googleId ?? ""
                        ]
                        self.isNewUser = true
                        print("⚠️ [LoginViewModel] 자동 가입 실패? 수동 가입으로 전환")
                    } else {
                        // 로그인 성공
                        // Check both root token and data.token
                        if let token = response.token ?? response.data?.token {
                            self.authService.saveToken(token)
                            
                            if let user = response.user ?? response.data?.user {
                                self.authService.saveUserData(user)
                            }
                            self.isLoggedIn = true
                            print("✅ [LoginViewModel] Google 로그인 최종 성공")
                        } else {
                            print("❌ [LoginViewModel] 로그인 성공했으나 토큰이 없음 (Data token: \(response.data?.token ?? "nil"))")
                            self.showErrorMessage("로그인 정보가 올바르지 않습니다. (Token Missing)")
                        }
                    }
                } else if let error = loginError {
                    self.showErrorMessage("Google 로그인/가입에 실패했습니다: \(error.localizedDescription)")
                } else {
                     if #available(iOS 15.0, *) {
                         self.showErrorMessage("Google 로그인에 실패했습니다.")
                     } else {
                         // iOS 13/14에서는 여기서 에러 처리를 따로 해야 할 수도 있음
                         // 일단 기존 로직과 동일하게 유지하지 않음 (자동 가입 시도 코드가 15+ 전용이므로)
                          self.showErrorMessage("Google 로그인에 실패했습니다.")
                     }
                }
                self.isLoading = false
            }
        }
    }
    
    /// Apple 로그인 요청 생성
    func createAppleLoginRequest() -> ASAuthorizationAppleIDRequest {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.email, .fullName]
        return request
    }
    
    /// Apple 로그인 처리 (iOS 15+ async)
    @available(iOS 15.0, *)
    func handleAppleLogin(authorization: ASAuthorization) async {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            DispatchQueue.main.async { self.showErrorMessage("Apple 로그인 정보를 가져올 수 없습니다.") }
            return
        }
        
        DispatchQueue.main.async { self.isLoading = true }
        
        let userIdentifier = appleIDCredential.user
        let email = appleIDCredential.email
        let fullName = appleIDCredential.fullName
        let userName = [fullName?.givenName, fullName?.familyName]
            .compactMap { $0 }
            .joined(separator: " ")
        
        var identityToken: String?
        if let tokenData = appleIDCredential.identityToken {
            identityToken = String(data: tokenData, encoding: .utf8)
        }
        
        var authorizationCode: String?
        if let codeData = appleIDCredential.authorizationCode {
            authorizationCode = String(data: codeData, encoding: .utf8)
        }
        
        print("✅ [LoginViewModel] Apple 로그인 성공: \(email ?? "이메일 없음")")
        
        do {
            let response = try await authService.appleLogin(
                userIdentifier: userIdentifier,
                email: email,
                userName: userName.isEmpty ? nil : userName,
                identityToken: identityToken,
                authorizationCode: authorizationCode
            )
            
            DispatchQueue.main.async {
                if response.success {
                    if let data = response.data {
                        if data.isNewUser {
                            self.socialLoginData = [
                                "provider": "apple",
                                "social_token": identityToken ?? "",
                                "userIdentifier": userIdentifier,
                                "email": email ?? "",
                                "name": userName
                            ]
                            self.isNewUser = true
                            print("✅ [LoginViewModel] 신규 Apple 회원")
                        } else {
                            self.isLoggedIn = true
                            print("✅ [LoginViewModel] 기존 Apple 회원 로그인")
                        }
                    }
                } else {
                    self.showErrorMessage(response.message ?? "Apple 로그인에 실패했습니다.")
                }
                self.isLoading = false
            }
        } catch let error as NetworkError {
            DispatchQueue.main.async {
                self.showErrorMessage(error.userMessage)
                self.isLoading = false
            }
        } catch {
            DispatchQueue.main.async {
                self.showErrorMessage("네트워크 오류가 발생했습니다.")
                self.isLoading = false
            }
        }
    }

    /// Apple 로그인 처리 (iOS 13/14 동기 래퍼)
    func handleAppleLoginSync(authorization: ASAuthorization) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            showErrorMessage("Apple 로그인 정보를 가져올 수 없습니다.")
            return
        }
        
        isLoading = true
        
        let userIdentifier = appleIDCredential.user
        let email = appleIDCredential.email
        let fullName = appleIDCredential.fullName
        let userName = [fullName?.givenName, fullName?.familyName]
            .compactMap { $0 }
            .joined(separator: " ")
        
        var identityToken: String?
        if let tokenData = appleIDCredential.identityToken {
            identityToken = String(data: tokenData, encoding: .utf8)
        }
        
        var authorizationCode: String?
        if let codeData = appleIDCredential.authorizationCode {
            authorizationCode = String(data: codeData, encoding: .utf8)
        }
        
        print("✅ [LoginViewModel] Apple 로그인 성공: \(email ?? "이메일 없음")")
        
        DispatchQueue.global(qos: .userInitiated).async {
            let semaphore = DispatchSemaphore(value: 0)
            var loginResponse: AppleLoginResponse?
            var loginError: Error?
            
            if #available(iOS 15.0, *) {
                let currentIdentityToken = identityToken
                let currentAuthorizationCode = authorizationCode
                Task {
                    do {
                        loginResponse = try await self.authService.appleLogin(
                            userIdentifier: userIdentifier,
                            email: email,
                            userName: userName.isEmpty ? nil : userName,
                            identityToken: currentIdentityToken,
                            authorizationCode: currentAuthorizationCode
                        )
                    } catch {
                        loginError = error
                    }
                    semaphore.signal()
                }
            } else {
                // iOS 13/14 fallback
                semaphore.signal()
            }
            
            semaphore.wait()
            
            DispatchQueue.main.async {
                if let response = loginResponse, response.success {
                    if let data = response.data {
                        if data.isNewUser {
                            self.socialLoginData = [
                                "provider": "apple",
                                "social_token": identityToken ?? "",
                                "userIdentifier": userIdentifier,
                                "email": email ?? "",
                                "name": userName
                            ]
                            self.isNewUser = true
                            print("✅ [LoginViewModel] 신규 Apple 회원")
                        } else {
                            self.isLoggedIn = true
                            print("✅ [LoginViewModel] 기존 Apple 회원 로그인")
                        }
                    }
                } else if let error = loginError {
                    self.showErrorMessage("Apple 로그인에 실패했습니다: \(error.localizedDescription)")
                } else {
                    self.showErrorMessage("Apple 로그인에 실패했습니다.")
                }
                self.isLoading = false
            }
        }
    }
    
    /// Apple 로그인 실패 처리
    func handleAppleLoginError(_ error: Error) {
        if let authError = error as? ASAuthorizationError {
            switch authError.code {
            case .canceled:
                print("ℹ️ [LoginViewModel] Apple 로그인 취소됨")
            case .invalidResponse:
                showErrorMessage("Apple 로그인 응답이 올바르지 않습니다.")
            case .notHandled:
                showErrorMessage("Apple 로그인 요청을 처리할 수 없습니다.")
            case .failed:
                showErrorMessage("Apple 로그인에 실패했습니다.")
            case .notInteractive:
                showErrorMessage("Apple 로그인이 중단되었습니다.")
            case .unknown:
                showErrorMessage("알 수 없는 오류가 발생했습니다.")
            default:
                showErrorMessage("Apple 로그인에 실패했습니다.")
            }
        } else {
            showErrorMessage("Apple 로그인에 실패했습니다: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Error Handling
    
    /// 에러 메시지 표시
    private func showErrorMessage(_ message: String) {
        errorMessage = message
        showError = true
        
        // 3초 후 에러 메시지 숨김
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            self?.showError = false
        }
    }
    
    /// 에러 메시지 숨김
    func dismissError() {
        showError = false
        errorMessage = nil
    }
    
    // MARK: - Logout
    
    /// 로그아웃
    func logout() {
        authService.logout()
        isLoggedIn = false
        phoneNumber = ""
        password = ""
    }
}

// MARK: - RegisterViewModel

private func isServerPasswordValid(_ password: String) -> Bool {
    password.count >= 8 && password.range(of: "[A-Z]", options: .regularExpression) != nil &&
    password.range(of: "[a-z]", options: .regularExpression) != nil &&
    password.rangeOfCharacter(from: .decimalDigits) != nil &&
    password.rangeOfCharacter(from: CharacterSet(charactersIn: "!@#$%^&*(),.?\":{}|<>")) != nil
}

@MainActor
class RegisterViewModel: ObservableObject {
    // MARK: - Published Properties
    
    @Published var currentStep: RegisterStep = .terms
    @Published var registerData = RegisterRequest(
        mt_id: "",
        mt_name: "",
        mt_nickname: "",
        mt_agree1: false,
        mt_agree2: false,
        mt_agree3: false,
        mt_agree4: false,
        mt_agree5: false
    )
    
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showError = false
    @Published var socialSessionExpired = false
    
    // Step specific state
    @Published var verificationCode: String = ""
    @Published var passwordConfirm: String = ""
    @Published var optionalPhone: String = ""
    
    // Password visibility toggle
    @Published var showPassword: Bool = false
    @Published var showPasswordConfirm: Bool = false
    
    // Validation Errors
    @Published var phoneError: String?
    @Published var emailError: String?
    @Published var passwordError: String?
    @Published var birthError: String?
    
    // SMS Verification State
    @Published var verificationSent: Bool = false
    @Published var verificationTimer: Int = 0
    @Published var isVerificationLoading: Bool = false
    @Published var lastSentTime: Date? = nil
    private var verificationToken: String? = nil
    
    // 기존 가입자 알림 상태
    @Published var showExistingUserAlert: Bool = false
    var existingUserPhone: String = ""
    
    // 기존 가입자 발견 시 콜백 (로그인 페이지로 이동 + 전화번호 전달)
    var onExistingUserFound: ((String) -> Void)?
    
    private var timerCancellable: AnyCancellable?
    private let authService = AuthService.shared
    
    private let smsAPIURL = "https://api3.aiagnt.kr/api/v1/sms/send-verification-code"
    private let checkPhoneAPIURL = "https://api3.aiagnt.kr/api/v1/members/check/phone/"
    
    // MARK: - Initialization & Social Data
    
    // MARK: - Computed Properties
    
    var isSocialAccount: Bool {
        return registerData.mt_google_id != nil || registerData.mt_apple_id != nil || registerData.mt_kakao_id != nil
    }

    func applySocialData(_ data: [String: Any]?) {
        guard let data = data else { return }
        
        if let email = data["email"] as? String {
            registerData.mt_email = email
        }
        
        if let name = data["name"] as? String {
            registerData.mt_name = name
        }
        
        if let provider = data["provider"] as? String {
            registerData.social_provider = provider
            registerData.social_token = data["social_token"] as? String
            // "id" 키가 없으면 provider별 구체적 키 확인
            let googleId = data["google_id"] as? String
            let appleId = data["apple_id"] as? String ?? data["userIdentifier"] as? String  // Apple은 userIdentifier도 확인
            let kakaoId = data["kakao_id"] as? String
            let genericId = data["id"] as? String
            
            switch provider {
            case "google":
                let id = googleId ?? genericId
                registerData.mt_google_id = id
                registerData.mt_type = 4 // Google
                if let id = id { registerData.mt_id = "google_\(id)" }
            case "apple":
                let id = appleId ?? genericId
                registerData.mt_apple_id = id
                registerData.mt_type = 3 // Apple
                if let id = id { registerData.mt_id = "apple_\(id)" }
                print("📱 [RegisterViewModel] Apple 소셜 로그인 데이터 적용됨 - isSocialAccount: true")
            case "kakao":
                let id = kakaoId ?? genericId
                registerData.mt_kakao_id = id
                registerData.mt_type = 2 // Kakao
                if let id = id { registerData.mt_id = "kakao_\(id)" }
            default:
                break
            }
        }
        
        // 프로필 이미지 매핑
        if let file1 = data["mt_file1"] as? String {
            registerData.mt_file1 = file1
        } else if let picture = data["picture"] as? String {
            registerData.mt_file1 = picture
        } else if let profileImage = data["profile_image"] as? String {
            registerData.mt_file1 = profileImage
        }
    }
    // MARK: - Computed Properties
    
    var isTermsValid: Bool {
        return registerData.mt_agree1 && registerData.mt_agree2 && registerData.mt_agree3
    }
    
    var isPhoneValid: Bool {
        // Basic length check for now, specific logic can be added
        return validateEmail(registerData.mt_id) && !registerData.mt_id.isEmpty
    }
    
    var isBasicInfoValid: Bool {
        let isNameValid = !registerData.mt_name.isEmpty
        let isNicknameValid = !registerData.mt_nickname.isEmpty
        let isEmailValid = validateEmail(registerData.mt_email)
        
        let isPasswordValid = isValidPassword(registerData.mt_pwd ?? "")
        let isPasswordConfirmValid = registerData.mt_pwd == passwordConfirm && !passwordConfirm.isEmpty
        return isNameValid && isNicknameValid && isPasswordValid && isPasswordConfirmValid && isEmailValid
    }
    
    var isProfileValid: Bool {
        // 생년월일과 성별은 이제 선택 사항입니다. (Apple 가이드라인 5.1.1 준수)
        if let birth = registerData.mt_birth, !birth.isEmpty {
            return validateBirthDate(birth)
        }
        return true
    }
    
    // MARK: - Methods
    
    func nextStep() {
        switch currentStep {
        case .terms:
            if isTermsValid {
                currentStep = .phone
            }
        case .phone:
            // Skip verification for now or mock it
            sendVerificationCode()
        case .verification:
             if verificationToken != nil { currentStep = .basicInfo }
        case .basicInfo:
            if isBasicInfoValid { currentStep = .profile }
            else { showValidationErrors() }
        case .profile:
            if !isProfileValid {
                errorMessage = "생년월일 형식을 확인해주세요 (YYYY-MM-DD)"
                showError = true
                return
            }
            register()
        case .complete:
            break
        }
    }
    
    func previousStep() {
        switch currentStep {
        case .terms:
            break // Exit or dismiss
        case .phone:
            currentStep = .terms
        case .verification:
            currentStep = .phone
        case .basicInfo:
            // 소셜 계정은 약관 동의로 바로 이동
            if isSocialAccount {
                currentStep = .terms
            } else {
                currentStep = .phone
            }
        case .profile:
            currentStep = .basicInfo
        case .complete:
            break
        }
    }
    
    /// 유효성 검사 에러 표시
    func showValidationErrors() {
        if registerData.mt_name.isEmpty {
            errorMessage = "이름을 입력해주세요."
        } else if registerData.mt_nickname.isEmpty {
            errorMessage = "닉네임을 입력해주세요."
        } else if !validateEmail(registerData.mt_email) {
            errorMessage = "올바른 이메일 형식을 입력해주세요."
        } else {
            if !isValidPassword(registerData.mt_pwd ?? "") {
                errorMessage = "비밀번호는 8자 이상이며 영문 대소문자, 숫자, 특수문자를 포함해야 합니다."
            } else if registerData.mt_pwd != passwordConfirm || passwordConfirm.isEmpty {
                errorMessage = "비밀번호가 일치하지 않습니다."
            }
        }
        showError = true
    }
    
    // MARK: - SMS Verification Methods
    
    /// 전화번호에서 하이픈 제거
    func formatPhoneForAPI(_ phone: String) -> String {
        return phone.replacingOccurrences(of: "-", with: "")
    }
    
    /// 재발송 가능 여부 확인 (3분 제한)
    func canResend() -> Bool {
        guard let lastSent = lastSentTime else { return true }
        let elapsed = Date().timeIntervalSince(lastSent)
        return elapsed >= 60
    }
    
    /// 재발송까지 남은 시간 (초)
    func remainingResendTime() -> Int {
        guard let lastSent = lastSentTime else { return 0 }
        let elapsed = Date().timeIntervalSince(lastSent)
        let remaining = 60 - Int(elapsed)
        return max(0, remaining)
    }
    
    /// 타이머 시작 (180초)
    func startTimer() {
        verificationTimer = 600
        timerCancellable?.cancel()
        
        timerCancellable = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self = self else { return }
                if self.verificationTimer > 0 {
                    self.verificationTimer -= 1
                } else {
                    self.timerCancellable?.cancel()
                }
            }
    }
    
    /// 인증번호 발송 (기존 가입자 확인 후 발송)
    func updateEmail(_ value: String) {
        guard registerData.mt_id != value else { return }
        registerData.mt_id = value
        registerData.mt_email = value
        verificationToken = nil
        verificationSent = false
        verificationCode = ""
        verificationTimer = 0
        lastSentTime = nil
        timerCancellable?.cancel()
    }

    func sendVerificationCode() {
        let email = registerData.mt_id.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !isVerificationLoading else { return }
        guard isPhoneValid else { errorMessage = "올바른 이메일을 입력해주세요."; showError = true; return }
        if verificationToken != nil { currentStep = .basicInfo; return }
        guard canResend() else { errorMessage = "잠시 후 다시 시도해주세요."; showError = true; return }
        isVerificationLoading = true
        Task {
            defer { isVerificationLoading = false }
            do {
                let response = try await authService.emailAuth(path: "/auth/email/send-code", body: ["email": email, "purpose": "register"])
                guard registerData.mt_id.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == email else { return }
                guard response.success else { throw NetworkError.badRequest("인증번호 발송에 실패했습니다.") }
                registerData.mt_id = email
                registerData.mt_email = email
                verificationToken = nil
                verificationSent = true
                lastSentTime = Date()
                startTimer()
                currentStep = .verification
            } catch {
                errorMessage = (error as? NetworkError)?.userMessage ?? "네트워크 연결을 확인해주세요."
                showError = true
            }
        }
    }

    func verifyCode() {
        guard !isVerificationLoading else { return }
        if verificationToken != nil { currentStep = .basicInfo; return }
        guard verificationCode.count == 6, verificationTimer > 0 else { errorMessage = "인증번호를 확인해주세요."; showError = true; return }
        let email = registerData.mt_id.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        isVerificationLoading = true
        Task {
            defer { isVerificationLoading = false }
            do {
                let response = try await authService.emailAuth(path: "/auth/email/verify-code", body: ["email": email, "purpose": "register", "code": verificationCode])
                guard registerData.mt_id.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == email else { return }
                guard response.success, let token = response.verification_token, !token.isEmpty else { throw NetworkError.badRequest("인증번호 확인에 실패했습니다.") }
                verificationToken = token
                timerCancellable?.cancel()
                currentStep = .basicInfo
            } catch {
                errorMessage = (error as? NetworkError)?.userMessage ?? "네트워크 연결을 확인해주세요."
                showError = true
            }
        }
    }

    /// 인증번호 재발송
    func resendVerificationCode() {
        if canResend() {
            sendVerificationCode()
        } else {
            let remaining = remainingResendTime()
            let minutes = remaining / 60
            let seconds = remaining % 60
            errorMessage = "\(minutes)분 \(seconds)초 후에 재발송이 가능합니다."
            showError = true
        }
    }
    
    // MARK: - Validation Logic
    
    func isValidPassword(_ password: String) -> Bool {
        isServerPasswordValid(password)
    }

    /// 비밀번호 규칙 상세 체크 (UI 표시용)
    func passwordValidationDetails(_ password: String) -> (hasMinLength: Bool, hasLetter: Bool, hasNumber: Bool, hasSpecialChar: Bool) {
        let hasMinLength = password.count >= 8
        let hasLetter = password.range(of: "[A-Z]", options: .regularExpression) != nil && password.range(of: "[a-z]", options: .regularExpression) != nil
        let hasNumber = password.range(of: "[0-9]", options: .regularExpression) != nil
        let hasSpecialChar = password.rangeOfCharacter(from: CharacterSet(charactersIn: "!@#$%^&*(),.?\":{}|<>")) != nil
        
        return (hasMinLength, hasLetter, hasNumber, hasSpecialChar)
    }
    
    /// 이메일 형식 검증 (선택 필드이므로 빈 값은 허용)
    func validateEmail(_ email: String?) -> Bool {
        guard let email = email, !email.isEmpty else { return true }
        
        let emailRegex = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        return email.range(of: emailRegex, options: .regularExpression) != nil
    }
    
    /// 생년월일 형식 검증 (YYYY-MM-DD, 선택 필드)
    func validateBirthDate(_ birth: String?) -> Bool {
        guard let birth = birth, !birth.isEmpty else { return true }
        
        // YYYY-MM-DD 형식 체크
        let dateRegex = "^\\d{4}-\\d{2}-\\d{2}$"
        guard birth.range(of: dateRegex, options: .regularExpression) != nil else {
            return false
        }
        
        // 실제 유효한 날짜인지 확인
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        dateFormatter.locale = Locale(identifier: "ko_KR")
        
        guard let date = dateFormatter.date(from: birth) else {
            return false
        }
        
        // 미래 날짜가 아닌지 확인
        if date > Date() {
            return false
        }
        
        // 합리적인 범위 (1900년 이후)
        let calendar = Calendar.current
        let year = calendar.component(.year, from: date)
        if year < 1900 {
            return false
        }
        
        return true
    }
    
    /// 생년월일 입력 자동 포맷팅
    func formatBirthDate(_ value: String) -> String {
        let numbers = value.filter { $0.isNumber }
        let limited = String(numbers.prefix(8))
        
        switch limited.count {
        case 0...4:
            return limited
        case 5...6:
            let index1 = limited.index(limited.startIndex, offsetBy: 4)
            return "\(limited[..<index1])-\(limited[index1...])"
        default:
            let index1 = limited.index(limited.startIndex, offsetBy: 4)
            let index2 = limited.index(limited.startIndex, offsetBy: 6)
            return "\(limited[..<index1])-\(limited[index1..<index2])-\(limited[index2...])"
        }
    }
    
    // MARK: - API Calls
    
    func register() {
        guard let token = verificationToken else { errorMessage = "이메일 인증이 필요합니다."; showError = true; return }
        if isSocialAccount && (registerData.social_token?.isEmpty != false) {
            socialSessionExpired = true
            return
        }
        isLoading = true
        
        // FCM 토큰 주입
        if let fcmToken = authService.getFCMToken() {
            registerData.mt_token_id = fcmToken
        }
        
        Task {
            do {
                let result = try await authService.register(request: registerData, verificationToken: token, phoneNumber: optionalPhone)
                guard result.success else { throw NetworkError.badRequest(result.message) }
                DispatchQueue.main.async {
                    self.registerData.social_token = nil
                    self.isLoading = false
                    self.currentStep = .complete
                }
            } catch {
                DispatchQueue.main.async {
                    self.isLoading = false
                    if self.isSocialAccount, let networkError = error as? NetworkError, case .unauthorized = networkError {
                        self.registerData.social_token = nil
                        self.socialSessionExpired = true
                        return
                    }
                    if let networkError = error as? NetworkError {
                        self.errorMessage = networkError.userMessage
                    } else {
                        self.errorMessage = "회원가입 요청을 처리하지 못했습니다."
                    }
                    self.showError = true
                }
            }
        }
    }
}

// MARK: - ForgotPasswordViewModel

@MainActor
class ForgotPasswordViewModel: ObservableObject {
    
    enum Step {
        case phone
        case verification
        case newPassword
        case complete
    }
    
    // MARK: - Published Properties
    
    @Published var currentStep: Step = .phone
    @Published var phoneNumber: String = "" {
        didSet {
            if phoneNumber != oldValue {
                verificationToken = nil
                verificationSent = false
                verificationTimer = 0
                lastSentTime = nil
                timerCancellable?.cancel()
            }
        }
    }
    
    @Published var verificationCode: String = ""
    @Published var newPassword: String = ""
    @Published var confirmPassword: String = ""
    
    /// 비밀번호 표시 여부
    @Published var showNewPassword: Bool = false
    @Published var showConfirmPassword: Bool = false
    
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var showError: Bool = false
    
    // Verification state
    @Published var verificationSent: Bool = false
    @Published var verificationTimer: Int = 0
    @Published var lastSentTime: Date? = nil
    private var verificationToken: String? = nil
    private var timerCancellable: AnyCancellable?
    
    private let authService = AuthService.shared
    private let smsAPIURL = "https://api3.aiagnt.kr/api/v1/sms/send-verification-code"
    private let checkPhoneAPIURL = "https://api3.aiagnt.kr/api/v1/members/check/phone/"
    private let resetPasswordAPIURL = "https://api3.aiagnt.kr/api/v1/auth/reset-password-by-phone"
    
    // MARK: - Helper Methods
    
    
    private func formatPhoneForAPI(_ phone: String) -> String {
        return phone.replacingOccurrences(of: "-", with: "")
    }
    
    // MARK: - Password Validation Rules
    
    var isPasswordLengthValid: Bool {
        newPassword.count >= 8
    }
    
    var hasPasswordLetter: Bool {
        newPassword.range(of: "[a-z]", options: .regularExpression) != nil && newPassword.range(of: "[A-Z]", options: .regularExpression) != nil
    }
    
    var hasPasswordNumber: Bool {
        newPassword.range(of: "[0-9]", options: .regularExpression) != nil
    }
    
    var hasPasswordSpecialChar: Bool {
        newPassword.range(of: "[!@#$%^&*(),.?\":{}|<>]", options: .regularExpression) != nil
    }
    
    var isPasswordRulesSatisfied: Bool {
        isServerPasswordValid(newPassword)
    }
    
    func canResend() -> Bool {
        guard let lastSent = lastSentTime else { return true }
        return Date().timeIntervalSince(lastSent) >= 60
    }
    
    func remainingResendTime() -> Int {
        guard let lastSent = lastSentTime else { return 0 }
        let elapsed = Int(Date().timeIntervalSince(lastSent))
        return max(0, 60 - elapsed)
    }
    
    func startTimer() {
        verificationTimer = 600
        timerCancellable?.cancel()
        timerCancellable = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self = self else { return }
                if self.verificationTimer > 0 {
                    self.verificationTimer -= 1
                } else {
                    self.timerCancellable?.cancel()
                }
            }
    }
    
    // MARK: - Actions
    
    /// 사용자 존재 여부 확인 후 인증번호 발송
    func checkUserAndSendCode() {
        let email = phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !isLoading else { return }
        guard email.range(of: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", options: .regularExpression) != nil else { errorMessage = "올바른 이메일을 입력해주세요."; showError = true; return }
        guard canResend() else { errorMessage = "잠시 후 다시 시도해주세요."; showError = true; return }
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                let response = try await authService.emailAuth(path: "/auth/email/send-code", body: ["email": email, "purpose": "reset_password"])
                guard phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == email else { return }
                guard response.success else { throw NetworkError.badRequest("인증번호 발송에 실패했습니다.") }
                verificationToken = nil
                verificationSent = true
                lastSentTime = Date()
                startTimer()
                currentStep = .verification
            } catch { errorMessage = (error as? NetworkError)?.userMessage ?? "네트워크 연결을 확인해주세요."; showError = true }
        }
    }

    func verifyCode() {
        guard !isLoading else { return }
        if verificationToken != nil { currentStep = .newPassword; return }
        guard verificationCode.count == 6, verificationTimer > 0 else { errorMessage = "인증번호를 확인해주세요."; showError = true; return }
        let email = phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                let response = try await authService.emailAuth(path: "/auth/email/verify-code", body: ["email": email, "purpose": "reset_password", "code": verificationCode])
                guard phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == email else { return }
                guard response.success, let token = response.verification_token, !token.isEmpty else { throw NetworkError.badRequest("인증번호 확인에 실패했습니다.") }
                verificationToken = token
                timerCancellable?.cancel()
                currentStep = .newPassword
            } catch { errorMessage = (error as? NetworkError)?.userMessage ?? "네트워크 연결을 확인해주세요."; showError = true }
        }
    }

    func resetPassword() {
        guard !isLoading else { return }
        guard isPasswordRulesSatisfied, newPassword == confirmPassword else { errorMessage = "비밀번호 규칙과 확인값을 확인해주세요."; showError = true; return }
        guard let token = verificationToken else { errorMessage = "이메일 인증이 필요합니다."; showError = true; return }
        let email = phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                let response = try await authService.emailAuth(path: "/auth/reset-password-by-email", body: ["email": email, "verification_token": token, "new_password": newPassword])
                guard response.success else { throw NetworkError.badRequest("비밀번호 변경에 실패했습니다.") }
                verificationToken = nil
                currentStep = .complete
            } catch { errorMessage = (error as? NetworkError)?.userMessage ?? "네트워크 연결을 확인해주세요."; showError = true }
        }
    }
}
