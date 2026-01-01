import Foundation

class GroupService {
    static let shared = GroupService()
    private let authService = AuthService.shared
    
    private init() {}
    
    private var baseURL: String {
        return authService.baseURL
    }
    
    /// 현재 사용자의 그룹 목록 가져오기
    func getCurrentUserGroups() async throws -> [SmapGroup] {
        let url = URL(string: "\(baseURL)/groups/current-user")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 목록을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode([SmapGroup].self, from: data)
    }
    
    /// 그룹 멤버 목록 가져오기
    func getGroupMembers(sgtIdx: Int) async throws -> [SmapGroupMember] {
        let url = URL(string: "\(baseURL)/group-members/member/\(sgtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "멤버 정보를 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode([SmapGroupMember].self, from: data)
    }
    
    /// 그룹 통계 가져오기
    func getGroupStats(sgtIdx: Int) async throws -> GroupStats {
        let url = URL(string: "\(baseURL)/groups/\(sgtIdx)/stats")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 통계를 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(StatsResponse.self, from: data)
        if result.success, let stats = result.data {
            return stats
        } else {
            throw APIError(detail: nil, message: result.message ?? "그룹 통계 로드 실패")
        }
    }
    
    /// 그룹 생성
    func createGroup(title: String, memo: String) async throws -> SmapGroup {
        let url = URL(string: "\(baseURL)/groups")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "sgt_title": title,
            "sgt_memo": memo,
            "sgt_show": "Y"
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, (httpResponse.statusCode == 200 || httpResponse.statusCode == 201) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 생성에 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(GroupCreateResponse.self, from: data)
        if result.success, let group = result.data {
            return group
        } else {
            throw APIError(detail: nil, message: result.message ?? "그룹 생성 실패")
        }
    }
    
    /// 그룹 수정
    func updateGroup(sgtIdx: Int, title: String, memo: String) async throws -> SmapGroup {
        let url = URL(string: "\(baseURL)/groups/\(sgtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "sgt_title": title,
            "sgt_memo": memo
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 수정에 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(GroupCreateResponse.self, from: data)
        if result.success, let group = result.data {
            return group
        } else {
            throw APIError(detail: nil, message: result.message ?? "그룹 수정 실패")
        }
    }
    
    /// 그룹 가입 (초대 코드)
    func joinGroup(inviteCode: String) async throws -> Bool {
        // 1. 코드로 그룹 정보 조회
        let codeUrl = URL(string: "\(baseURL)/groups/code/\(inviteCode)")!
        var codeRequest = URLRequest(url: codeUrl)
        codeRequest.httpMethod = "GET"
        
        if let token = authService.getToken() {
            codeRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (codeData, codeResponse) = try await URLSession.shared.data(for: codeRequest)
        
        guard let httpCodeResponse = codeResponse as? HTTPURLResponse, httpCodeResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "유효하지 않은 초대 코드입니다.")
        }
        
        let group = try JSONDecoder().decode(SmapGroup.self, from: codeData)
        
        // 2. 가입 실행
        let joinUrl = URL(string: "\(baseURL)/groups/\(group.sgt_idx)/join")!
        var joinRequest = URLRequest(url: joinUrl)
        joinRequest.httpMethod = "POST"
        
        if let token = authService.getToken() {
            joinRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (_, joinResponse) = try await URLSession.shared.data(for: joinRequest)
        
        guard let httpJoinResponse = joinResponse as? HTTPURLResponse, httpJoinResponse.statusCode == 200 else {
            let statusCode = (joinResponse as? HTTPURLResponse)?.statusCode ?? -1
            if statusCode == 409 {
                throw APIError(detail: nil, message: "이미 가입된 그룹입니다.")
            }
            throw APIError(detail: nil, message: "그룹 가입에 실패했습니다. (Error: \(statusCode))")
        }
        
        return true
    }
    
    /// 그룹 삭제 (소프트 삭제)
    func deleteGroup(sgtIdx: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/groups/\(sgtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // sgt_show를 N으로 변경하여 삭제 처리 (소프트 삭제)
        let body: [String: Any] = [
            "sgt_show": "N"
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 삭제에 실패했습니다. (Error: \(statusCode))")
        }
        
        return true
    }
    
    /// 멤버 권한 변경
    func updateMemberRole(sgtIdx: Int, mtIdx: Int, isLeader: Bool) async throws -> Bool {
        // web app code follows a specific endpoint pattern for role updates
        // Here we'll use the dedicated group-members endpoint if it exists or generic update
        let url = URL(string: "\(baseURL)/group-members/\(sgtIdx)/role")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "mt_idx": mtIdx,
            "is_leader": isLeader
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "권한 변경에 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(SimpleResponse.self, from: data)
        return result.success
    }
    
    /// 그룹에서 멤버 내보내기/탈퇴
    func removeMember(sgtIdx: Int, mtIdx: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/group-members/\(sgtIdx)/member/\(mtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "멤버 내보내기에 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(SimpleResponse.self, from: data)
        return result.success
    }
}

// MARK: - API Response Helpers

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
