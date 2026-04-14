import SwiftUI

struct NewDMView: View {
    let onCreated: (Int) async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var groups: [SmapGroup] = []
    @State private var members: [SmapGroupMember] = []
    @State private var selectedGroup: SmapGroup?
    @State private var isLoading = false
    @State private var isCreating = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Group selector
                if !groups.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(groups, id: \.sgt_idx) { group in
                                Button(action: {
                                    selectedGroup = group
                                    Task { await loadMembers(sgtIdx: group.sgt_idx) }
                                }) {
                                    Text(group.sgt_title ?? "그룹")
                                        .font(.suite(size: 14, weight: selectedGroup?.sgt_idx == group.sgt_idx ? .bold : .medium))
                                        .foregroundColor(selectedGroup?.sgt_idx == group.sgt_idx ? .white : .primary)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                        .background(selectedGroup?.sgt_idx == group.sgt_idx ? SMAPTheme.Color.primary : Color.gray.opacity(0.1))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }
                }

                Divider()

                // Member list
                if isLoading {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else if members.isEmpty {
                    Spacer()
                    Text("그룹을 선택하세요")
                        .font(.suite(size: 15))
                        .foregroundColor(.gray)
                    Spacer()
                } else {
                    List(members, id: \.mt_idx) { member in
                        Button(action: { Task { await createDM(with: member.mt_idx) } }) {
                            HStack(spacing: 12) {
                                // Avatar
                                if let path = member.mt_file1, !path.isEmpty,
                                   let url = AuthService.getProfileImageURL(path) {
                                    AsyncImage(url: url) { phase in
                                        if let image = phase.image {
                                            image.resizable().aspectRatio(contentMode: .fill)
                                                .frame(width: 40, height: 40).clipShape(Circle())
                                        } else {
                                            defaultAvatar
                                        }
                                    }
                                } else {
                                    defaultAvatar
                                }

                                Text(member.displayName)
                                    .font(.suite(size: 16))

                                Spacer()

                                if isCreating {
                                    ProgressView()
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .disabled(isCreating)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("새 채팅")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
            }
            .task {
                do {
                    groups = try await GroupService.shared.getCurrentUserGroups()
                    if let first = groups.first {
                        selectedGroup = first
                        await loadMembers(sgtIdx: first.sgt_idx)
                    }
                } catch {
                    errorMessage = "그룹 목록을 불러올 수 없습니다."
                }
            }
            .alert("오류", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func loadMembers(sgtIdx: Int) async {
        isLoading = true
        let currentUserIdx = AuthService.shared.getUserData()?.mt_idx
        do {
            let allMembers = try await GroupService.shared.getGroupMembers(sgtIdx: sgtIdx)
            members = allMembers.filter { $0.mt_idx != currentUserIdx }
        } catch {
            errorMessage = "멤버 목록을 불러올 수 없습니다."
        }
        isLoading = false
    }

    private func createDM(with targetMtIdx: Int) async {
        isCreating = true
        do {
            let response = try await ChatService.shared.createDMRoom(targetMtIdx: targetMtIdx)
            await onCreated(response.scr_idx)
        } catch {
            errorMessage = "채팅방 생성에 실패했습니다."
        }
        isCreating = false
    }

    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .frame(width: 40, height: 40)
            .overlay(Image(systemName: "person.fill").foregroundColor(.gray))
    }
}
