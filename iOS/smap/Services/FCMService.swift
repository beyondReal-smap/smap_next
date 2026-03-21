//
// FCMService.swift
// smap
//
// FCM 토큰 관리 서비스 (AppDelegate에서 추출)
//

import Foundation
import FirebaseMessaging

/// FCM 토큰 등록 및 관리 서비스
class FCMService {

    // MARK: - Singleton

    static let shared = FCMService()

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let keychain: KeychainManager
    private let userDefaults: UserDefaultsManager

    // MARK: - Initializers

    private init() {
        self.apiClient = .shared
        self.keychain = .shared
        self.userDefaults = .shared
    }

    /// 테스트용 DI 이니셜라이저
    init(apiClient: APIClient, keychain: KeychainManager, userDefaults: UserDefaultsManager) {
        self.apiClient = apiClient
        self.keychain = keychain
        self.userDefaults = userDefaults
    }

    // MARK: - Token Registration

    /// 서버에 FCM 토큰 등록
    /// - Parameters:
    ///   - token: FCM 토큰
    ///   - apnsToken: APNs 토큰 (선택, 없으면 저장된 값 사용)
    ///   - completion: 등록 성공 여부 콜백
    func registerTokenWithServer(token: String, apnsToken: String? = nil, completion: @escaping (Bool) -> Void) {
        guard let mtIdx = userDefaults.mtIdx, !mtIdx.isEmpty else {
            print("[FCMService] mt_idx 없음 - 토큰 등록 건너뜀")
            completion(false)
            return
        }

        // mt_idx 숫자 형식 검증
        guard let mtIdxInt = Int(mtIdx), mtIdxInt > 0 else {
            print("[FCMService] 잘못된 mt_idx 형식: \(mtIdx)")
            completion(false)
            return
        }

        let finalApnsToken = apnsToken ?? userDefaults.apnsToken

        Task {
            do {
                let _ = try await apiClient.requestRaw(
                    .registerFCMToken(mtIdx: mtIdx, fcmToken: token, apnsToken: finalApnsToken),
                    token: keychain.getToken()
                )

                // 성공 시 토큰 저장
                userDefaults.fcmToken = token
                userDefaults.lastFCMUpdate = token
                if let finalApnsToken { userDefaults.apnsToken = finalApnsToken }

                print("[FCMService] 토큰 등록 성공")
                completion(true)
            } catch {
                print("[FCMService] 토큰 등록 실패: \(error)")
                completion(false)
            }
        }
    }

    /// 서버에 FCM 토큰 등록 (async 버전)
    @discardableResult
    func registerTokenWithServer(token: String, apnsToken: String? = nil) async -> Bool {
        await withCheckedContinuation { continuation in
            registerTokenWithServer(token: token, apnsToken: apnsToken) { success in
                continuation.resume(returning: success)
            }
        }
    }

    // MARK: - Token Validation

    /// FCM 토큰 형식 검증
    /// - Parameter token: 검증할 FCM 토큰
    /// - Returns: 유효한 토큰이면 true
    func isValidToken(_ token: String) -> Bool {
        // 빈 토큰 검사
        guard !token.isEmpty else { return false }

        // 길이 검증 (FCM 토큰은 보통 140-180자)
        guard token.count >= 100 && token.count <= 200 else { return false }

        // 형식 검증 (프로젝트ID:APA91b... 형태)
        let parts = token.split(separator: ":", maxSplits: 1)
        guard parts.count == 2 else { return false }

        let projectId = String(parts[0])
        let tokenPart = String(parts[1])

        // 프로젝트 ID 검증
        guard !projectId.isEmpty, projectId.count <= 50 else { return false }

        let invalidChars = CharacterSet.whitespacesAndNewlines
            .union(CharacterSet(charactersIn: "<>\"{}|\\^`"))
        guard projectId.rangeOfCharacter(from: invalidChars) == nil else { return false }

        // 토큰 부분 검증 (APA91로 시작, 100자 이상)
        guard tokenPart.hasPrefix("APA91b") || tokenPart.hasPrefix("APA91"),
              tokenPart.count >= 100 else { return false }

        return true
    }

    // MARK: - Token Access

    /// 현재 FCM 토큰 가져오기 (Firebase SDK에서)
    func getCurrentToken() async -> String? {
        try? await Messaging.messaging().token()
    }

    /// 저장된 FCM 토큰
    var savedToken: String? {
        get { userDefaults.fcmToken }
        set { userDefaults.fcmToken = newValue }
    }

    /// 저장된 APNs 토큰
    var savedAPNSToken: String? {
        get { userDefaults.apnsToken }
        set { userDefaults.apnsToken = newValue }
    }

    /// 토큰 변경 여부 확인
    func hasTokenChanged(_ newToken: String) -> Bool {
        guard let saved = savedToken else { return true }
        return saved != newToken
    }
}
