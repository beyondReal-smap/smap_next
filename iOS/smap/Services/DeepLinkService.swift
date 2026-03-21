//
// DeepLinkService.swift
// smap
//
// URL scheme 딥링크 처리 서비스 (AppDelegate에서 추출)
//

import Foundation
import GoogleSignIn
import KakaoSDKAuth

/// URL scheme 딥링크 처리 서비스
class DeepLinkService {

    // MARK: - Singleton

    static let shared = DeepLinkService()

    private init() {}

    // MARK: - URL Scheme 처리

    /// URL scheme 처리 — AppDelegate application(_:open:options:)에서 호출
    func handleURL(_ url: URL) -> Bool {
        print("📱 DeepLinkService: URL 열기 요청 - \(url)")
        print("📱 URL Scheme: \(url.scheme ?? "nil")")
        print("📱 URL Host: \(url.host ?? "nil")")

        // Google Sign-In URL 처리
        if GIDSignIn.sharedInstance.handle(url) {
            print("✅ Google Sign-In URL 처리됨")
            return true
        }

        // Kakao Login URL 처리
        if AuthApi.isKakaoTalkLoginUrl(url) {
            print("✅ Kakao Login URL 처리됨")
            return AuthController.handleOpenUrl(url: url)
        }

        // smap 딥링크 처리 (통합 스킴)
        if url.scheme == "smap" {
            return handleSmapScheme(url)
        }

        // 기존 smapapp 딥링크 처리 (하위 호환성)
        if url.scheme == "smapapp" {
            return handleLegacyScheme(url)
        }

        print("⚠️ 처리되지 않은 URL: \(url)")
        return false
    }

    // MARK: - smap:// 스킴 처리

    /// smap:// 딥링크 처리 (그룹 가입 등)
    /// 형식: smap://group/{id}/join
    private func handleSmapScheme(_ url: URL) -> Bool {
        print("📱 [DEEP_LINK] smap 스킴 감지됨: \(url)")

        let pathComponents = url.pathComponents // ["/", "group", "{id}", "join"]
        if pathComponents.count >= 3 && pathComponents[1] == "group" {
            let groupId = pathComponents[2]
            print("👥 [DEEP_LINK] 그룹 가입 요청 감지 - 그룹 ID: \(groupId)")

            // 그룹 정보 저장 및 알림 발송
            UserDefaults.standard.set(groupId, forKey: "pending_join_group_id")

            NotificationCenter.default.post(
                name: NSNotification.Name(rawValue: "handleGroupJoinDeepLink"),
                object: nil,
                userInfo: ["group_id": groupId]
            )
        }
        return true
    }

    // MARK: - smapapp:// 스킴 처리

    /// smapapp:// 딥링크 처리 (초대 코드, 이벤트 URL — 하위 호환성)
    private func handleLegacyScheme(_ url: URL) -> Bool {
        print("딥링크 URL: \(url)")

        if url.host == "invitation" {
            let invitation_code = url.lastPathComponent
            UserDefaults.standard.set(invitation_code, forKey: "invitation_code")
            print("초대 코드: \(invitation_code)")

            NotificationCenter.default.post(
                name: NSNotification.Name(rawValue: "getDeepLink"),
                object: nil,
                userInfo: ["invitation_code": invitation_code]
            )
        } else {
            let event_url = url.absoluteString
            UserDefaults.standard.set(event_url, forKey: "event_url")
            print("이벤트 URL: \(event_url)")

            NotificationCenter.default.post(
                name: NSNotification.Name(rawValue: "getPush"),
                object: nil,
                userInfo: ["event_url": event_url]
            )
        }
        return true
    }
}
