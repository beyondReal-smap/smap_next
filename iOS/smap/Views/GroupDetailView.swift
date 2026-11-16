import SwiftUI

// MARK: - 그룹 상세 (Android GroupDetailContent 이식, 36단계 재설계)
//
// 이전: 남색 큰 카드(… 메뉴 안에 수정·초대·삭제가 숨어 있음) + 분홍·노랑·남색 통계 타일 + 왕관 달린 멤버 목록(톱니 메뉴).
// 지금: 남색 요약 카드(이름·메모 + 멤버/이번 주 일정/등록 장소) → 초대 → 멤버 → 관리 4구역.
// 숨어 있던 동작(초대·수정·삭제/나가기)을 구역으로 꺼내 바로 보이게 했다.

struct GroupDetailView: View {
    @ObservedObject var viewModel: GroupViewModel
    let group: SmapGroup

    @Environment(\.dismiss) private var dismiss
    @State private var showingEditSheet = false
    @State private var showingShareOptions = false
    @State private var showingQRCode = false
    @State private var showingDeleteAlert = false
    @State private var snackMessage = ""
    @State private var showSnack = false

    // 멤버 관리 — 행을 누르면 동작 선택, 내보내기는 한 번 더 확인
    @State private var managedMember: SmapGroupMember?
    @State private var memberToRemove: SmapGroupMember?

    /// 목록이 갱신되면 최신 그룹 정보(이름·메모 수정 결과)를 쓴다.
    private var current: SmapGroup {
        viewModel.groups.first(where: { $0.sgt_idx == group.sgt_idx }) ?? group
    }
    private var currentUserIdx: Int? { AuthService.shared.getUserData()?.mt_idx }
    private var membersLoaded: Bool { viewModel.loadedMembersGroupId == group.sgt_idx }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
                heroSection
                inviteSection
                memberSection
                if ownerStatus != nil { manageSection }
            }
            .padding(SMAPTheme.Spacing.md)
            .padding(.bottom, SMAPTheme.Spacing.lg)
        }
        .background(SMAPTheme.Surface.canvas.ignoresSafeArea())
        .navigationTitle("그룹")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            viewModel.selectedGroup = group
            viewModel.fetchGroupMembers(sgtIdx: group.sgt_idx)
            viewModel.fetchGroupStats(sgtIdx: group.sgt_idx)
        }
        .smapSnackBar(isPresented: $showSnack, message: snackMessage, duration: 2)
        .sheet(isPresented: $showingEditSheet) {
            GroupFormSheet(mode: .edit(title: current.sgt_title ?? "", memo: current.sgt_memo ?? ""), isSaving: viewModel.isUpdating) { title, memo in
                viewModel.updateGroup(sgtIdx: group.sgt_idx, title: title, memo: memo)
            }
        }
        .sheet(isPresented: $showingShareOptions) {
            ShareOptionsView(group: current, isPresented: $showingShareOptions, showingQRCode: $showingQRCode)
        }
        .sheet(isPresented: $showingQRCode) {
            QRCodeView(data: current.inviteLink, size: 250)
        }
        .alert(isCurrentUserOwner ? "그룹을 삭제할까요?" : "그룹에서 나갈까요?", isPresented: $showingDeleteAlert) {
            Button("취소", role: .cancel) {}
            Button(isCurrentUserOwner ? "삭제" : "나가기", role: .destructive) {
                guard let isOwner = ownerStatus else { return }
                if isOwner {
                    viewModel.deleteGroup(sgtIdx: group.sgt_idx)
                } else {
                    viewModel.leaveGroup(sgtIdx: group.sgt_idx)
                }
                dismiss()
            }
        } message: {
            Text(isCurrentUserOwner ? "모든 멤버가 그룹에서 빠지고 되돌릴 수 없어요." : "다시 들어오려면 초대 코드가 필요해요.")
        }
        .confirmationDialog(
            managedMember?.displayName ?? "",
            isPresented: Binding(get: { managedMember != nil }, set: { if !$0 { managedMember = nil } }),
            titleVisibility: .visible,
            presenting: managedMember
        ) { member in
            let isLeader = member.sgdt_leader_chk == "Y"
            Button(isLeader ? "리더 해제" : "리더로 지정") {
                viewModel.updateMemberRole(member: member, isLeader: !isLeader)
            }
            Button("그룹에서 내보내기", role: .destructive) { memberToRemove = member }
            Button("취소", role: .cancel) {}
        }
        .alert(
            "\(memberToRemove?.displayName ?? "")님을 내보낼까요?",
            isPresented: Binding(get: { memberToRemove != nil }, set: { if !$0 { memberToRemove = nil } }),
            presenting: memberToRemove
        ) { member in
            Button("취소", role: .cancel) {}
            Button("내보내기", role: .destructive) { viewModel.removeMember(member: member) }
        } message: { _ in
            Text("이 멤버는 그룹의 위치·일정을 더 볼 수 없어요.")
        }
    }

    // MARK: 요약 — 화면의 시각적 중심(남색 카드)

    private var heroSection: some View {
        SMAPHeroCard {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: "person.3.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 52, height: 52)
                    .background(Color.white.opacity(0.16), in: Circle())
                    .accessibilityHidden(true)
                SMAPHeroHeading(
                    eyebrow: ownerStatus == nil ? nil : (isCurrentUserOwner ? "내가 만든 그룹" : "참여 중인 그룹"),
                    title: current.sgt_title.flatMap { $0.isEmpty ? nil : $0 } ?? "이름 없는 그룹",
                    subtitle: current.sgt_memo
                )
            }
            let stats = viewModel.groupStats?.group_id == group.sgt_idx ? viewModel.groupStats : nil
            SMAPHeroStats(stats: [
                (stats.map { "\($0.member_count)명" } ?? (membersLoaded ? "\(viewModel.groupMembers.count)명" : "-"), "멤버"),
                (stats.map { "\($0.weekly_schedules)개" } ?? "-", "이번 주 일정"),
                (stats.map { "\($0.total_locations)곳" } ?? "-", "등록 장소"),
            ])
        }
    }

    // MARK: 초대

    private var inviteSection: some View {
        SMAPSection(title: "초대") {
            SMAPListRow(
                title: current.sgt_code ?? "초대 코드 없음",
                subtitle: "이 코드를 받은 사람은 그룹에 참여할 수 있어요",
                leading: { SMAPRowIcon(systemImage: "person.badge.plus") },
                trailing: {
                    if let code = current.sgt_code {
                        Button {
                            UIPasteboard.general.string = code
                            HapticManager.shared.impact(style: .light)
                            snackMessage = "초대 코드를 복사했어요"
                            showSnack = true
                        } label: {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 17, weight: .medium))
                                .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("초대 코드 복사")
                    }
                }
            )
            SMAPButton("멤버 초대하기") { showingShareOptions = true }
                .padding([.horizontal, .bottom], SMAPTheme.Spacing.md)
        }
    }

    // MARK: 멤버

    private var memberSection: some View {
        SMAPSection(title: membersLoaded ? "멤버 \(viewModel.groupMembers.count)" : "멤버") {
            if !membersLoaded {
                SkeletonRow()
                SMAPRowDivider()
                SkeletonRow()
                SMAPRowDivider()
                SkeletonRow()
            } else if viewModel.groupMembers.isEmpty {
                SMAPListRow(
                    title: "아직 멤버가 없어요",
                    subtitle: "초대 코드를 보내 멤버를 초대해 보세요",
                    leading: { SMAPRowIcon(systemImage: "person.badge.plus") }
                )
            } else {
                ForEach(Array(viewModel.groupMembers.enumerated()), id: \.element.id) { index, member in
                    if index > 0 { SMAPRowDivider() }
                    memberRow(member)
                }
            }
        }
    }

    private func memberRow(_ member: SmapGroupMember) -> some View {
        let role: String? = member.sgdt_owner_chk == "Y" ? "그룹장" : (member.sgdt_leader_chk == "Y" ? "리더" : nil)
        // 그룹장만 다른 멤버(그룹장 제외)를 관리한다.
        let manageable = isCurrentUserOwner && member.sgdt_owner_chk != "Y"
        return SMAPListRow(
            title: member.mt_idx == currentUserIdx ? "\(member.displayName) (나)" : member.displayName,
            // 역할은 오른쪽 배지로만 보여 준다(보조 줄과 배지에 같은 말이 두 번 나오지 않게).
            subtitle: role == nil && !manageable ? "멤버" : nil,
            action: manageable ? { managedMember = member } : nil,
            leading: { SMAPAvatar(name: member.displayName, imagePath: member.mt_file1) },
            trailing: {
                HStack(spacing: SMAPTheme.Spacing.sm) {
                    if let role { RoleBadge(text: role) }
                    if manageable { RowChevron() }
                }
            }
        )
        .accessibilityHint(manageable ? "리더 지정 또는 내보내기" : "")
    }

    // MARK: 관리

    private var manageSection: some View {
        SMAPSection(title: "관리") {
            if isCurrentUserOwner {
                SMAPListRow(
                    title: "그룹 정보 수정",
                    action: { showingEditSheet = true },
                    leading: { SMAPRowIcon(systemImage: "pencil") },
                    trailing: { RowChevron() }
                )
                SMAPRowDivider()
                SMAPListRow(
                    title: "그룹 삭제",
                    subtitle: "모든 멤버가 그룹에서 빠지고 되돌릴 수 없어요",
                    destructive: true,
                    action: { showingDeleteAlert = true },
                    leading: { DangerIcon(systemImage: "trash") }
                )
            } else {
                SMAPListRow(
                    title: "그룹 나가기",
                    destructive: true,
                    action: { showingDeleteAlert = true },
                    leading: { DangerIcon(systemImage: "rectangle.portrait.and.arrow.right") }
                )
            }
        }
    }

    /// 내 역할 — 멤버 목록을 받기 전에는 모른다(nil). 모를 때 관리 구역을 숨겨 잘못된 동작(삭제/나가기)을 보이지 않는다.
    private var ownerStatus: Bool? {
        guard membersLoaded,
              let currentUserIdx,
              let member = viewModel.groupMembers.first(where: { $0.mt_idx == currentUserIdx }),
              let owner = member.sgdt_owner_chk, owner == "Y" || owner == "N" else { return nil }
        return owner == "Y"
    }

    private var isCurrentUserOwner: Bool { ownerStatus == true }
}

/// 위험 동작 아이콘 — 연한 빨강 원 + 빨강 아이콘
private struct DangerIcon: View {
    let systemImage: String

    var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(SMAPTheme.Color.error)
            .frame(width: 40, height: 40)
            .background(SMAPTheme.Color.error.opacity(0.08), in: Circle())
            .accessibilityHidden(true)
    }
}

// MARK: - Subviews

struct ShareSheet: UIViewControllerRepresentable {
    var activityItems: [Any]
    var applicationActivities: [UIActivity]? = nil

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: applicationActivities)
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
