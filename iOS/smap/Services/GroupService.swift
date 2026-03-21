import Foundation

class GroupService {
    static let shared = GroupService()
    private let apiClient: APIClient
    private var token: String? { KeychainManager.shared.getToken() }

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Group CRUD

    /// 현재 사용자의 그룹 목록 가져오기
    func getCurrentUserGroups() async throws -> [SmapGroup] {
        try await apiClient.request(.getCurrentUserGroups, token: token)
    }

    /// 그룹 요약 정보 가져오기 (총 그룹 수, 총 멤버 수)
    func getGroupSummary() async throws -> GroupSummary {
        try await apiClient.request(.getGroupSummary, token: token)
    }

    /// 그룹 통계 가져오기
    func getGroupStats(sgtIdx: Int) async throws -> GroupStats {
        let result: StatsResponse = try await apiClient.request(.getGroupStats(sgtIdx: sgtIdx), token: token)
        guard result.success, let stats = result.data else {
            throw NetworkError.badRequest(result.message ?? "그룹 통계 로드 실패")
        }
        return stats
    }

    /// 그룹 생성
    func createGroup(title: String, memo: String) async throws -> SmapGroup {
        let result: GroupCreateResponse = try await apiClient.request(.createGroup(title: title, memo: memo), token: token)
        guard result.success, let group = result.data else {
            throw NetworkError.badRequest(result.message ?? "그룹 생성 실패")
        }
        return group
    }

    /// 그룹 수정
    func updateGroup(sgtIdx: Int, title: String, memo: String) async throws -> SmapGroup {
        let result: GroupCreateResponse = try await apiClient.request(.updateGroup(sgtIdx: sgtIdx, title: title, memo: memo), token: token)
        guard result.success, let group = result.data else {
            throw NetworkError.badRequest(result.message ?? "그룹 수정 실패")
        }
        return group
    }

    /// 그룹 삭제 (소프트 삭제 - sgt_show를 N으로 변경)
    func deleteGroup(sgtIdx: Int) async throws -> Bool {
        let _: (Data, HTTPURLResponse) = try await apiClient.requestRaw(.deleteGroup(sgtIdx: sgtIdx), token: token)
        return true
    }

    // MARK: - Group Join

    /// 그룹 가입 (초대 코드)
    func joinGroup(inviteCode: String) async throws -> Bool {
        // 1. 코드로 그룹 정보 조회
        let group: SmapGroup = try await apiClient.request(.joinGroupByCode(code: inviteCode), token: token)

        // 2. 가입 실행
        guard let mtIdx = AuthService.shared.currentUser?.mt_idx else {
            throw NetworkError.unauthorized
        }
        let _ = try await apiClient.requestRaw(.joinGroupById(sgtIdx: group.sgt_idx, mtIdx: mtIdx), token: token)
        return true
    }

    /// 그룹 가입 (초대 코드) - alias
    func joinGroupByCode(code: String) async throws -> Bool {
        try await joinGroup(inviteCode: code)
    }

    /// 그룹 ID로 직접 가입 (딥링크용)
    func joinGroupById(mt_idx: Int, sgt_idx: Int) async throws -> Bool {
        let _ = try await apiClient.requestRaw(.joinGroupById(sgtIdx: sgt_idx, mtIdx: mt_idx), token: token)
        return true
    }

    /// 콜백 기반 래퍼 (기존 UI 코드 호환용)
    func joinGroupById(mt_idx: Int, sgt_idx: Int, completion: @escaping (Bool, String?) -> Void) {
        Task {
            do {
                let success = try await joinGroupById(mt_idx: mt_idx, sgt_idx: sgt_idx)
                completion(success, nil)
            } catch {
                if let networkError = error as? NetworkError {
                    completion(false, networkError.userMessage)
                } else {
                    completion(false, error.localizedDescription)
                }
            }
        }
    }

    // MARK: - Group Members

    /// 그룹 멤버 목록 가져오기
    func getGroupMembers(sgtIdx: Int) async throws -> [SmapGroupMember] {
        try await apiClient.request(.getGroupMembers(sgtIdx: sgtIdx), token: token)
    }

    /// 멤버 권한 변경
    func updateMemberRole(sgtIdx: Int, mtIdx: Int, isLeader: Bool) async throws -> Bool {
        let result: SimpleResponse = try await apiClient.request(.updateMemberRole(sgtIdx: sgtIdx, mtIdx: mtIdx, isLeader: isLeader), token: token)
        return result.success
    }

    /// 그룹에서 멤버 내보내기/탈퇴
    func removeMember(sgtIdx: Int, mtIdx: Int) async throws -> Bool {
        let result: SimpleResponse = try await apiClient.request(.removeMember(sgtIdx: sgtIdx, mtIdx: mtIdx), token: token)
        return result.success
    }
}

// MARK: - API Response Helpers

struct GroupSummary: Codable {
    let group_count: Int
    let total_members: Int
}

struct StatsResponse: Codable {
    let success: Bool
    let message: String?
    let data: GroupStats?
}

struct GroupCreateResponse: Codable {
    let success: Bool
    let message: String?
    let data: SmapGroup?
}

struct SimpleResponse: Codable {
    let success: Bool
    let message: String?
}
