import SwiftUI

struct GroupDetailView: View {
    @ObservedObject var viewModel: GroupViewModel
    let group: SmapGroup
    let groupIndex: Int?
    
    @Environment(\.dismiss) private var dismiss
    @State private var showingActionSheet = false
    @State private var showingEditSheet = false
    @State private var showingShareSheet = false
    @State private var showingDeleteAlert = false
    @State private var showingQRCode = false
    @State private var showingShareOptions = false
    @State private var editTitle: String = ""
    @State private var editMemo: String = ""
    
    // Member Management
    @State private var selectedMember: SmapGroupMember?
    @State private var showingMemberActionSheet = false
    @State private var showingCopiedAlert = false

    // 멤버 리스트 축약 표시 — 많을 때 첫 페이지에 과다 노출되지 않도록.
    private let memberPreviewLimit = 6
    @State private var showAllMembers = false

    // 편집 시트의 미저장 변경 Confirmation
    @State private var showUnsavedEditsAlert = false
    
    
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                headerSection
                
                statsSection
                
                memberListSection
            }
            .padding(.vertical)
        }
        .background(SMAPTheme.Adaptive.pageBackground)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("그룹 상세")
                    .font(.suite(size: 17, weight: .semibold))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            viewModel.selectedGroup = group
            viewModel.fetchGroupMembers(sgtIdx: group.sgt_idx)
            viewModel.fetchGroupStats(sgtIdx: group.sgt_idx)
        }
        .sheet(isPresented: $showingEditSheet) {
            CreateGroupView(isPresented: $showingEditSheet, title: $editTitle, memo: $editMemo) {
                viewModel.updateGroup(sgtIdx: group.sgt_idx, title: editTitle, memo: editMemo)
            }
            // 미저장 변경이 있을 때 스와이프로 실수 dismiss 방지. Alert 로 명시적 확인.
            .interactiveDismissDisabled(hasUnsavedEdits)
        }
        .alert("변경사항이 저장되지 않았습니다", isPresented: $showUnsavedEditsAlert) {
            Button("계속 편집", role: .cancel) {}
            Button("버리기", role: .destructive) {
                editTitle = group.sgt_title ?? ""
                editMemo = group.sgt_memo ?? ""
                showingEditSheet = false
            }
        } message: {
            Text("수정 중인 내용을 버리시겠습니까?")
        }
        .sheet(isPresented: $showingShareOptions) {
            ShareOptionsView(
                group: group,
                isPresented: $showingShareOptions,
                showingQRCode: $showingQRCode
            )
        }
        .sheet(isPresented: $showingQRCode) {
            QRCodeView(
                data: group.inviteLink,
                size: 250
            )
        }
        .alert("복사 완료", isPresented: $showingCopiedAlert) {
            Button("확인", role: .cancel) {}
        } message: {
            Text("초대 코드가 클립보드에 복사되었습니다.")
        }
        .alert(isCurrentUserOwner ? "그룹 삭제" : "그룹 나가기", isPresented: $showingDeleteAlert) {
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
            Text(isCurrentUserOwner ? "정말로 이 그룹을 삭제하시겠습니까? 모든 데이터가 사라집니다." : "정말로 이 그룹을 나가시겠습니까?")
        }
    }
    
    @ViewBuilder
    private var headerSection: some View {
        VStack(spacing: 16) {
            HStack(spacing: 16) {
                // Group Icon
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.white.opacity(0.15))
                        .frame(width: 76, height: 76)
                    
                    let iconUrl = URL(string: "https://nextstep.aiagnt.kr/images/group\(((groupIndex ?? 0) % 2) + 1).webp")
                    
                    AsyncImage(url: iconUrl) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable()
                                .aspectRatio(contentMode: .fill)
                        default:
                            Image(systemName: "person.3.fill")
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                    .frame(width: 68, height: 68)
                    .cornerRadius(12)
                }
                
                // Group Info
                VStack(alignment: .leading, spacing: 6) {
                    Text(group.sgt_title ?? "이름 없음")
                        .font(.suite(size: 22, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    
                    if let memo = group.sgt_memo, !memo.isEmpty {
                        Text(memo)
                            .font(.suite(size: 14))
                            .foregroundColor(.white.opacity(0.9))
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                
                Spacer()
                
                // Settings Menu
                Menu {
                    Button(action: {
                        editTitle = group.sgt_title ?? ""
                        editMemo = group.sgt_memo ?? ""
                        showingEditSheet = true
                    }) {
                        Label("그룹 정보 수정", systemImage: "pencil")
                    }
                    
                    Button(action: { showingShareOptions = true }) {
                        Label("멤버 초대하기", systemImage: "square.and.arrow.up")
                    }
                    
                    Divider()
                    
                    if ownerStatus == true {
                        Button(role: .destructive, action: { showingDeleteAlert = true }) {
                            Label("그룹 삭제", systemImage: "trash")
                        }
                    } else if ownerStatus == false {
                        Button(role: .destructive, action: { showingDeleteAlert = true }) {
                            Label("그룹 나가기", systemImage: "arrow.turn.up.left")
                        }
                    }
                } label: {
                    // HIG 최소 터치 타겟 44pt 확보. 시각 원은 36pt로 유지하되 히트 영역은 44pt.
                    Image(systemName: "ellipsis")
                        .font(.suite(size: 18, weight: .medium))
                        .foregroundColor(.white.opacity(0.9))
                        .frame(width: 36, height: 36)
                        .background(Color.white.opacity(0.15))
                        .clipShape(Circle())
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("그룹 설정")
                .accessibilityHint("멤버 초대, 정보 수정, 그룹 삭제/나가기")
            }
            
            Divider().background(Color.white.opacity(0.2))
            
            // Invite Code & Creation Date
            HStack(alignment: .center) {
                HStack(spacing: 8) {
                    Text("초대 코드")
                        .font(.suite(size: 13))
                        .foregroundColor(.white.opacity(0.8))
                    
                    if let code = group.sgt_code {
                        HStack(spacing: 6) {
                            Text(code)
                                .font(.suite(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            
                            Button(action: {
                                UIPasteboard.general.string = code
                                showingCopiedAlert = true
                            }) {
                                Image(systemName: "doc.on.doc")
                                    .font(.suite(size: 12))
                                    .foregroundColor(.white.opacity(0.8))
                            }
                            .accessibilityLabel("초대 코드 복사")
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(Color.black.opacity(0.3))
                        .cornerRadius(6)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                Text("생성일: \(formatDate(group.sgt_wdate ?? ""))")
                    .font(.suite(size: 12))
                    .foregroundColor(.white.opacity(0.7))
                    .layoutPriority(1)
            }
        }
        .padding(20)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [SMAPTheme.Color.primary, SMAPTheme.Color.primaryDark]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(20)
        .padding(.horizontal)
    }
    
    @ViewBuilder
    private var statsSection: some View {
        if let stats = viewModel.groupStats {
            HStack(spacing: 12) {
                // 멤버 Card — 핑크 Accent
                StatsCardView(
                    value: "\(stats.member_count)",
                    title: "멤버",
                    icon: "person.2.fill",
                    gradientColors: [SMAPTheme.Accent.pink, SMAPTheme.Accent.pinkDeep]
                )

                // 주간 일정 Card — 크라운(옐로우 계열)
                StatsCardView(
                    value: "\(stats.weekly_schedules)",
                    title: "주간 일정",
                    icon: "calendar",
                    gradientColors: [SMAPTheme.Accent.crown.opacity(0.9), SMAPTheme.Accent.orange]
                )

                // 총 위치 Card — 브랜드 primary
                StatsCardView(
                    value: "\(stats.total_locations)",
                    title: "총 위치",
                    icon: "location.fill",
                    gradientColors: [SMAPTheme.Color.primary, SMAPTheme.Color.primaryDark]
                )
            }
            .padding(.horizontal)
        }
    }
    
    @ViewBuilder
    private var memberListSection: some View {
        // 멤버 섹션 — 제목 옆 카운트 + "초대" CTA 를 표면화해 "설정 메뉴 안에 숨은 액션" 문제 해결.
        let allMembers = viewModel.groupMembers
        let visibleMembers = showAllMembers
            ? allMembers
            : Array(allMembers.prefix(memberPreviewLimit))
        let hiddenCount = max(0, allMembers.count - visibleMembers.count)

        VStack(spacing: 12) {
            // Section Header
            HStack(alignment: .center, spacing: 8) {
                Text("그룹 멤버")
                    .font(.suite(size: 18, weight: .bold))
                    .foregroundColor(.primary)

                Text("\(allMembers.count)명")
                    .font(.suite(size: 13, weight: .medium))
                    .foregroundColor(SMAPTheme.Color.primary)
                    .monospacedDigit()
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(SMAPTheme.Color.primary.opacity(0.1))
                    .clipShape(Capsule())
                    .accessibilityLabel("\(allMembers.count)명")

                Spacer()

                // 초대 CTA — 주요 액션을 메뉴에서 꺼내 표면화
                Button {
                    HapticManager.shared.impact(style: .light)
                    showingShareOptions = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "person.crop.circle.badge.plus")
                            .font(.suite(size: 14, weight: .semibold))
                        Text("초대")
                            .font(.suite(size: 13, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 32)
                    .background(SMAPTheme.Color.primary)
                    .clipShape(Capsule())
                }
                .frame(minWidth: 44, minHeight: 44) // HIG 터치 영역
                .contentShape(Rectangle())
                .accessibilityLabel("멤버 초대")
                .accessibilityHint("초대 코드 또는 링크 공유")
            }
            .padding(.horizontal, 20)

            // Member Cards
            VStack(spacing: 0) {
                ForEach(visibleMembers) { member in
                    MemberRowNew(
                        member: member,
                        isCurrentUserOwner: isCurrentUserOwner,
                        onPromote: {
                            viewModel.updateMemberRole(member: member, isLeader: member.sgdt_leader_chk != "Y")
                        },
                        onRemove: {
                            viewModel.removeMember(member: member)
                        }
                    )

                    if member.id != visibleMembers.last?.id {
                        Divider().padding(.leading, 80)
                    }
                }

                // 축약 표시 — N명 더 or 접기
                if hiddenCount > 0 || (showAllMembers && allMembers.count > memberPreviewLimit) {
                    Divider().padding(.leading, 80)

                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showAllMembers.toggle()
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: showAllMembers ? "chevron.up" : "chevron.down")
                                .font(.suite(size: 12, weight: .semibold))
                            Text(showAllMembers ? "접기" : "\(hiddenCount)명 더보기")
                                .font(.suite(size: 14, weight: .medium))
                        }
                        .foregroundColor(SMAPTheme.Color.primary)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .accessibilityLabel(showAllMembers ? "멤버 목록 접기" : "멤버 \(hiddenCount)명 더보기")
                }
            }
            .padding(.vertical, 8)
            .background(Color.white)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.black.opacity(0.06), lineWidth: 1)
            )
            .padding(.horizontal)
        }
    }
    
    private var hasUnsavedEdits: Bool {
        (editTitle != (group.sgt_title ?? "")) || (editMemo != (group.sgt_memo ?? ""))
    }

    private var ownerStatus: Bool? {
        guard viewModel.loadedMembersGroupId == group.sgt_idx,
              let currentUserId = AuthService.shared.getUserData()?.mt_idx,
              let member = viewModel.groupMembers.first(where: { $0.mt_idx == currentUserId }),
              let owner = member.sgdt_owner_chk, owner == "Y" || owner == "N" else { return nil }
        return owner == "Y"
    }

    private var isCurrentUserOwner: Bool { ownerStatus == true }

    private func formatDate(_ dateString: String) -> String {
        // Try ISO8601 format first
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        var date: Date? = isoFormatter.date(from: dateString)
        
        // Try without fractional seconds
        if date == nil {
            isoFormatter.formatOptions = [.withInternetDateTime]
            date = isoFormatter.date(from: dateString)
        }
        
        // Try simple date formats
        if date == nil {
            let formats = ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd"]
            let dateFormatter = DateFormatter()
            dateFormatter.locale = Locale(identifier: "en_US_POSIX")
            for format in formats {
                dateFormatter.dateFormat = format
                if let d = dateFormatter.date(from: dateString) {
                    date = d
                    break
                }
            }
        }
        
        if let date = date {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "yyyy.MM.dd"
            return displayFormatter.string(from: date)
        }
        
        // Fallback: extract just the date part
        if let dateOnly = dateString.components(separatedBy: "T").first {
            return dateOnly.replacingOccurrences(of: "-", with: ".")
        }
        return dateString
    }
    
    // Helper function for avatar URL
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
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

// MARK: - Stats Card View (Colored Cards)

struct StatsCardView: View {
    let value: String
    let title: String
    let icon: String
    let gradientColors: [Color]
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.suite(size: 24))
                .foregroundColor(.white.opacity(0.9))
            
            Text(value)
                .font(.suite(size: 24, weight: .bold))
                .foregroundColor(.white)
            
            Text(title)
                .font(.suite(size: 12))
                .foregroundColor(.white.opacity(0.9))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(
            LinearGradient(gradient: Gradient(colors: gradientColors), startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .cornerRadius(16)
    }
}

// MARK: - Member Row New (With Settings Gear)

struct MemberRowNew: View {
    let member: SmapGroupMember
    let isCurrentUserOwner: Bool
    let onPromote: () -> Void
    let onRemove: () -> Void
    
    @State private var showingRemoveConfirmation = false
    @State private var showingLeaderConfirmation = false
    
    
    
    private var isLeader: Bool {
        member.sgdt_leader_chk == "Y"
    }
    
    var body: some View {
        HStack(spacing: 16) {
            // Avatar
            ZStack(alignment: .bottomTrailing) {
                if let url = getProfileImageUrl(member.mt_file1) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            Image(systemName: "person.circle.fill")
                                .resizable()
                                .foregroundColor(.gray.opacity(0.3))
                        }
                    }
                    .frame(width: 52, height: 52)
                    .clipShape(Circle())
                } else {
                    Image(systemName: "person.circle.fill")
                        .resizable()
                        .foregroundColor(.gray.opacity(0.3))
                        .frame(width: 52, height: 52)
                }
                
                // Crown for Owner/Leader — 오너는 노란 왕관, 리더는 파란 왕관.
                if member.sgdt_owner_chk == "Y" || member.sgdt_leader_chk == "Y" {
                    Image(systemName: "crown.fill")
                        .font(.suite(size: 10))
                        .foregroundColor(.white)
                        .padding(4)
                        .background(member.sgdt_owner_chk == "Y" ? SMAPTheme.Accent.crown : SMAPTheme.Semantic.indicatorMember)
                        .clipShape(Circle())
                        .offset(x: 4, y: 4)
                        .accessibilityLabel(member.sgdt_owner_chk == "Y" ? "그룹 오너" : "그룹 리더")
                }
            }
            
            // Name and Role
            VStack(alignment: .leading, spacing: 4) {
                Text(member.displayName)
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                
                Text(getRoleText())
                    .font(.suite(size: 13))
                    .foregroundColor(getRoleColor())
            }
            
            Spacer()
            
            // Role Badge or Settings Gear
            if member.sgdt_owner_chk == "Y" {
                Text("그룹장")
                    .font(.suite(size: 12, weight: .medium))
                    .foregroundColor(SMAPTheme.Color.primary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(SMAPTheme.Color.primary.opacity(0.1))
                    .cornerRadius(8)
            } else if isCurrentUserOwner {
                Menu {
                    Button(action: {
                        showingLeaderConfirmation = true
                    }) {
                        Label(isLeader ? "리더 해제" : "리더로 지정", 
                              systemImage: isLeader ? "person.badge.minus" : "person.badge.shield.checkmark")
                    }
                    
                    Button(role: .destructive, action: {
                        showingRemoveConfirmation = true
                    }) {
                        Label("그룹에서 내보내기", systemImage: "person.badge.minus")
                    }
                } label: {
                    Image(systemName: "gearshape")
                        .font(.suite(size: 18))
                        .foregroundColor(.gray)
                        .frame(width: 44, height: 44) // HIG 터치 타겟
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("멤버 관리")
                .accessibilityHint("리더 지정 또는 그룹에서 내보내기")
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .alert("멤버 내보내기", isPresented: $showingRemoveConfirmation) {
            Button("취소", role: .cancel) {}
            Button("내보내기", role: .destructive) {
                onRemove()
            }
        } message: {
            Text("\(member.displayName)님을 그룹에서 내보내시겠습니까?")
        }
        .alert(isLeader ? "리더 해제" : "리더 지정", isPresented: $showingLeaderConfirmation) {
            Button("취소", role: .cancel) {}
            Button(isLeader ? "해제" : "지정", role: isLeader ? .destructive : nil) {
                onPromote()
            }
        } message: {
            Text(isLeader 
                 ? "\(member.displayName)님의 리더 권한을 해제하시겠습니까?" 
                 : "\(member.displayName)님을 리더로 지정하시겠습니까?")
        }
    }
    
    private func getRoleText() -> String {
        if member.sgdt_owner_chk == "Y" {
            return "그룹 관리자"
        } else if member.sgdt_leader_chk == "Y" {
            return "리더"
        } else {
            return "멤버"
        }
    }
    
    private func getRoleColor() -> Color {
        if member.sgdt_owner_chk == "Y" {
            return SMAPTheme.Accent.crown
        } else if member.sgdt_leader_chk == "Y" {
            return SMAPTheme.Semantic.indicatorMember
        } else {
            return .secondary
        }
    }
    
    // Helper function for avatar URL
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

