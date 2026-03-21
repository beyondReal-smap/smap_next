import Foundation
import SwiftUI
import Combine

class GroupViewModel: ObservableObject {
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?
    @Published var groupMembers: [SmapGroupMember] = []
    @Published var groupStats: GroupStats?
    @Published var totalMembers: Int = 0
    
    // Loading States
    @Published var isLoading: Bool = false
    @Published var isCreating: Bool = false
    @Published var isUpdating: Bool = false
    @Published var isDeleting: Bool = false
    @Published var isJoining: Bool = false
    
    // Error States
    @Published var errorMessage: String?
    @Published var showError: Bool = false
    
    private let groupService = GroupService.shared
    
    // MARK: - Group Management
    
    /// 내 그룹 목록 조회
    func fetchGroups() {
        isLoading = true
        Task {
            do {
                let fetchedGroups = try await groupService.getCurrentUserGroups()
                DispatchQueue.main.async {
                    self.groups = fetchedGroups
                    self.isLoading = false
                    
                    if let selected = self.selectedGroup,
                       let updated = fetchedGroups.first(where: { $0.sgt_idx == selected.sgt_idx }) {
                        self.selectedGroup = updated
                    } else if self.selectedGroup == nil && !fetchedGroups.isEmpty {
                        // 선택된 그룹이 없으면 첫번째 그룹 선택 (옵션)
                        // self.selectedGroup = fetchedGroups.first
                    }
                    
                    // 요약 정보도 갱신
                    self.fetchGroupSummary()
                }
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isLoading = false
                }
            }
        }
    }
    
    /// 그룹 생성
    func createGroup(title: String, memo: String) {
        guard !title.isEmpty else { return }
        isCreating = true
        Task {
            do {
                let newGroup = try await groupService.createGroup(title: title, memo: memo)
                DispatchQueue.main.async {
                    self.groups.append(newGroup)
                    self.selectedGroup = newGroup
                    self.isCreating = false
                    self.fetchGroups() // 목록 갱신
                    // Notify other views that groups have changed
                    NotificationCenter.default.post(name: NSNotification.Name("groupsDidChange"), object: nil)
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isCreating = false
                }
            }
        }
    }
    
    /// 그룹 수정
    func updateGroup(sgtIdx: Int, title: String, memo: String) {
        guard !title.isEmpty else { return }
        isUpdating = true
        Task {
            do {
                // 수정된 그룹 정보 반환을 가정하거나, 다시 조회
                let updatedGroup = try await groupService.updateGroup(sgtIdx: sgtIdx, title: title, memo: memo)
                DispatchQueue.main.async {
                    if let index = self.groups.firstIndex(where: { $0.sgt_idx == sgtIdx }) {
                        self.groups[index] = updatedGroup
                    }
                    if self.selectedGroup?.sgt_idx == sgtIdx {
                        self.selectedGroup = updatedGroup
                    }
                    self.isUpdating = false
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isUpdating = false
                }
            }
        }
    }
    
    /// 그룹 삭제 (소프트 삭제)
    func deleteGroup(sgtIdx: Int) {
        isDeleting = true
        Task {
            do {
                let success = try await groupService.deleteGroup(sgtIdx: sgtIdx)
                if success {
                    DispatchQueue.main.async {
                        self.groups.removeAll(where: { $0.sgt_idx == sgtIdx })
                        if self.selectedGroup?.sgt_idx == sgtIdx {
                            self.selectedGroup = nil
                            self.groupMembers = []
                            self.groupStats = nil
                        }
                        self.isDeleting = false
                        // Notify other views that groups have changed
                        NotificationCenter.default.post(name: NSNotification.Name("groupsDidChange"), object: nil)
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isDeleting = false
                }
            }
        }
    }
    
    /// 그룹 가입 (초대 코드)
    func joinGroup(inviteCode: String) {
        guard !inviteCode.isEmpty else { return }
        isJoining = true
        Task {
            do {
                let success = try await groupService.joinGroup(inviteCode: inviteCode)
                if success {
                    DispatchQueue.main.async {
                        self.isJoining = false
                        self.fetchGroups() // 목록 갱신 및 UI 이동
                        // Notify other views that groups have changed
                        NotificationCenter.default.post(name: NSNotification.Name("groupsDidChange"), object: nil)
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isJoining = false
                }
            }
        }
    }
    
    // MARK: - Detail Info
    
    /// 그룹 멤버 조회
    func fetchGroupMembers(sgtIdx: Int) {
        // 이미 로딩 중이면 스킵하거나, 개별 로딩 상태 관리
        Task {
            do {
                let members = try await groupService.getGroupMembers(sgtIdx: sgtIdx)
                DispatchQueue.main.async {
                    self.groupMembers = members
                }
            } catch {
                print("❌ [GroupViewModel] 멤버 조회 실패: \(error)")
            }
        }
    }
    
    /// 그룹 통계 조회
    func fetchGroupStats(sgtIdx: Int) {
        Task {
            do {
                let stats = try await groupService.getGroupStats(sgtIdx: sgtIdx)
                DispatchQueue.main.async {
                    self.groupStats = stats
                }
            } catch {
                print("❌ [GroupViewModel] 통계 조회 실패: \(error)")
            }
        }
    }
    
    /// 멤버 권한 변경 (리더 위임 등)
    func updateMemberRole(member: SmapGroupMember, isLeader: Bool) {
        guard let group = selectedGroup else { return }
        Task {
            do {
                let success = try await groupService.updateMemberRole(sgtIdx: group.sgt_idx, mtIdx: member.mt_idx, isLeader: isLeader)
                if success {
                    self.fetchGroupMembers(sgtIdx: group.sgt_idx) // 멤버 목록 갱신
                }
            } catch {
                DispatchQueue.main.async { self.handleError(error) }
            }
        }
    }
    
    /// 멤버 강퇴
    func removeMember(member: SmapGroupMember) {
        guard let group = selectedGroup else { return }
        Task {
            do {
                let success = try await groupService.removeMember(sgtIdx: group.sgt_idx, mtIdx: member.mt_idx)
                if success {
                    self.fetchGroupMembers(sgtIdx: group.sgt_idx) // 멤버 목록 갱신
                    self.fetchGroupStats(sgtIdx: group.sgt_idx) // 통계도 갱신
                    self.fetchGroups() // 내 그룹 목록 갱신
                }
            } catch {
                DispatchQueue.main.async { self.handleError(error) }
            }
        }
    }
    
    /// 그룹 나가기 (탈퇴)
    func leaveGroup(sgtIdx: Int) {
        guard let currentUser = AuthService.shared.getUserData(),
              let mtIdx = currentUser.mt_idx else {
            self.errorMessage = "사용자 정보를 찾을 수 없습니다."
            self.showError = true
            return
        }
        
        isDeleting = true
        Task {
            do {
                let success = try await groupService.removeMember(sgtIdx: sgtIdx, mtIdx: mtIdx)
                if success {
                    DispatchQueue.main.async {
                        self.groups.removeAll(where: { $0.sgt_idx == sgtIdx })
                        if self.selectedGroup?.sgt_idx == sgtIdx {
                            self.selectedGroup = nil
                            self.groupMembers = []
                            self.groupStats = nil
                        }
                        self.isDeleting = false
                        // 목록 갱신 및 알림
                        self.fetchGroups()
                        NotificationCenter.default.post(name: NSNotification.Name("groupsDidChange"), object: nil)
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isDeleting = false
                }
            }
        }
    }
    
    private func handleError(_ error: Error) {
        if let networkError = error as? NetworkError {
            self.errorMessage = networkError.userMessage
        } else {
            self.errorMessage = error.localizedDescription
        }
        self.showError = true
    }
    
    /// 그룹 요약 정보 조회 (총 그룹, 총 멤버)
    func fetchGroupSummary() {
        Task {
            do {
                let summary = try await groupService.getGroupSummary()
                DispatchQueue.main.async {
                    self.totalMembers = summary.total_members
                }
            } catch {
                print("❌ [GroupViewModel] 요약 정보 조회 실패: \(error)")
            }
        }
    }
}
