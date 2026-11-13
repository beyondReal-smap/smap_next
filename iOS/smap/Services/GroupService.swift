import Foundation

@MainActor
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
        // 여러 화면이 동시에 부르면 진행 중인 요청 1건을 공유한다 (HomeService.getMyGroups 와 같은 키)
        try await InFlightRequestCoalescer.shared.share(InFlightRequestKey.groups) { [apiClient, token] in
            try await apiClient.request(.getCurrentUserGroups, token: token)
        }
    }

    /// 그룹 요약 정보 가져오기 (총 그룹 수, 총 멤버 수)
    func getGroupSummary() async throws -> GroupSummary {
        try await apiClient.request(.getGroupSummary, token: token)
    }

    /// 그룹 통계 가져오기
    func getGroupStats(sgtIdx: Int) async throws -> GroupStats {
        try await apiClient.request(.getGroupStats(sgtIdx: sgtIdx), token: token)
    }

    /// 그룹 생성
    func createGroup(title: String, memo: String) async throws -> SmapGroup {
        let group: SmapGroup = try await apiClient.request(.createGroup(title: title, memo: memo), token: token)
        await InFlightRequestCoalescer.shared.invalidate() // 생성 전에 날아간 목록 요청에 이후 조회가 합류하지 않게
        return group
    }

    /// 그룹 수정
    func updateGroup(sgtIdx: Int, title: String, memo: String) async throws -> SmapGroup {
        let group: SmapGroup = try await apiClient.request(.updateGroup(sgtIdx: sgtIdx, title: title, memo: memo), token: token)
        await InFlightRequestCoalescer.shared.invalidate()
        return group
    }

    /// 그룹 삭제 (소프트 삭제 - sgt_show를 N으로 변경)
    func deleteGroup(sgtIdx: Int) async throws -> Bool {
        let _: (Data, HTTPURLResponse) = try await apiClient.requestRaw(.deleteGroup(sgtIdx: sgtIdx), token: token)
        await InFlightRequestCoalescer.shared.invalidate()
        return true
    }

    // MARK: - Group Join

    /// 그룹 가입 (초대 코드)
    func joinGroup(inviteCode: String) async throws -> Bool {
        do {
        // 1. 코드로 그룹 정보 조회
        let group: SmapGroup = try await apiClient.request(.joinGroupByCode(code: inviteCode), token: token)

        // 2. 가입 실행
        guard let mtIdx = AuthService.shared.getUserData()?.mt_idx else {
            throw NetworkError.unauthorized
        }
        let _ = try await apiClient.requestRaw(.joinGroupById(sgtIdx: group.sgt_idx, mtIdx: mtIdx, code: inviteCode), token: token)
        await InFlightRequestCoalescer.shared.invalidate()
        return true
        } catch NetworkError.forbidden {
            throw NetworkError.badRequest("초대 링크가 유효하지 않거나 만료됐어요")
        } catch NetworkError.notFound {
            throw NetworkError.badRequest("초대 링크가 유효하지 않거나 만료됐어요")
        }
    }

    /// 그룹 가입 (초대 코드) - alias
    func joinGroupByCode(code: String) async throws -> Bool {
        try await joinGroup(inviteCode: code)
    }

    /// 그룹 ID로 직접 가입 (딥링크용)
    func joinGroupById(mt_idx: Int, sgt_idx: Int, code: String? = nil) async throws -> Bool {
        let _ = try await apiClient.requestRaw(.joinGroupById(sgtIdx: sgt_idx, mtIdx: mt_idx, code: code), token: token)
        await InFlightRequestCoalescer.shared.invalidate()
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
        try await InFlightRequestCoalescer.shared.share(InFlightRequestKey.members(sgtIdx)) { [apiClient, token] in
            try await apiClient.request(.getGroupMembers(sgtIdx: sgtIdx), token: token)
        }
    }

    /// 멤버 권한 변경
    func updateMemberRole(sgtIdx: Int, mtIdx: Int, isLeader: Bool) async throws -> Bool {
        let result: SimpleResponse = try await apiClient.request(.updateMemberRole(sgtIdx: sgtIdx, mtIdx: mtIdx, isLeader: isLeader), token: token)
        await InFlightRequestCoalescer.shared.invalidate()
        return result.success
    }

    /// 그룹에서 멤버 내보내기/탈퇴
    func removeMember(sgtIdx: Int, mtIdx: Int) async throws -> Bool {
        let result: SimpleResponse = try await apiClient.request(.removeMember(sgtIdx: sgtIdx, mtIdx: mtIdx), token: token)
        await InFlightRequestCoalescer.shared.invalidate()
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

// MARK: - In-flight request sharing

/// InFlightRequestCoalescer 키. GroupService 와 HomeService 가 같은 요청을 같은 키로 합치도록 한곳에서 정의한다.
enum InFlightRequestKey {
    static let groups = "groups/current-user"
    static func members(_ sgtIdx: Int) -> String { "group-members/member/\(sgtIdx)" }
}

/// 같은 조회가 동시에 여러 번 나가는 것을 한 번으로 합친다 (Android RequestCoalescer 대응).
/// 결과를 저장해 두는 캐시가 아니라 "지금 날아가는 요청에 합류"만 하므로, 끝난 뒤의 호출은 항상 새로 가져온다.
/// 변경(생성/참여/탈퇴 등) 성공 직후에는 invalidate() 로 옛 요청에 이후 호출이 합류하지 못하게 한다.
actor InFlightRequestCoalescer {
    static let shared = InFlightRequestCoalescer()

    private struct Entry {
        let id: UUID
        let task: Any
    }
    private var entries: [String: Entry] = [:]

    func share<T>(_ key: String, _ operation: @escaping () async throws -> T) async throws -> T {
        if let existing = entries[key]?.task as? Task<T, Error> {
            return try await existing.value
        }
        let id = UUID()
        let task = Task { try await operation() }
        entries[key] = Entry(id: id, task: task)
        defer {
            // invalidate 뒤 새로 등록된 요청을 지우지 않도록 자기 자신일 때만 제거
            if entries[key]?.id == id { entries[key] = nil }
        }
        return try await task.value
    }

    func invalidate() {
        entries.removeAll()
    }
}
