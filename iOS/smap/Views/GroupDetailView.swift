import SwiftUI

struct GroupDetailView: View {
    @ObservedObject var viewModel: GroupViewModel
    let group: SmapGroup
    let groupIndex: Int?
    
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
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // 1. Blue Gradient Header Card
                VStack(spacing: 16) {
                    HStack(spacing: 16) {
                        // Group Icon
                        ZStack {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.white.opacity(0.15))
                                .frame(width: 76, height: 76)
                            
                            let iconUrl = URL(string: "https://nextstep.smap.site/images/group\(((groupIndex ?? 0) % 2) + 1).webp")
                            
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
                            
                            if isCurrentUserOwner {
                                Button(role: .destructive, action: { showingDeleteAlert = true }) {
                                    Label("그룹 삭제", systemImage: "trash")
                                }
                            } else {
                                Button(role: .destructive, action: { showingDeleteAlert = true }) {
                                    Label("그룹 나가기", systemImage: "arrow.turn.up.left")
                                }
                            }
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.suite(size: 18, weight: .medium))
                                .foregroundColor(.white.opacity(0.8))
                                .frame(width: 32, height: 32)
                                .background(Color.white.opacity(0.15))
                                .clipShape(Circle())
                        }
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
                        gradient: Gradient(colors: [brandColor, Color(red: 0/255, green: 26/255, blue: 138/255)]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .cornerRadius(20)
                .padding(.horizontal)
                
                // 2. Stats Cards (3 separate colored cards)
                if let stats = viewModel.groupStats {
                    HStack(spacing: 12) {
                        // 멤버 Card (Red/Pink)
                        StatsCardView(
                            value: "\(stats.member_count)",
                            title: "멤버",
                            icon: "person.2.fill",
                            gradientColors: [Color(red: 251/255, green: 113/255, blue: 133/255), Color(red: 244/255, green: 63/255, blue: 94/255)]
                        )
                        
                        // 주간 일정 Card (Yellow)
                        StatsCardView(
                            value: "\(stats.weekly_schedules)",
                            title: "주간 일정",
                            icon: "calendar",
                            gradientColors: [Color(red: 253/255, green: 224/255, blue: 71/255), Color(red: 250/255, green: 204/255, blue: 21/255)]
                        )
                        
                        // 총 위치 Card (Blue)
                        StatsCardView(
                            value: "\(stats.total_locations)",
                            title: "총 위치",
                            icon: "location.fill",
                            gradientColors: [Color(red: 96/255, green: 165/255, blue: 250/255), Color(red: 59/255, green: 130/255, blue: 246/255)]
                        )
                    }
                    .padding(.horizontal)
                }
                
                // 3. Member List Section
                VStack(spacing: 12) {
                    // Header with Invite Button
                    HStack {
                        Text("그룹 멤버")
                            .font(.suite(size: 18, weight: .bold))
                            .foregroundColor(.primary)
                        
                        Spacer()
                    }
                    .padding(.horizontal, 20)
                    
                    // Member Cards
                    VStack(spacing: 0) {
                        ForEach(viewModel.groupMembers) { member in
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
                            
                            if member.id != viewModel.groupMembers.last?.id {
                                Divider().padding(.leading, 80)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                    .background(Color.white)
                    .cornerRadius(16)
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Color(white: 0.98))
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
                data: "https://smap.site/group/\(group.sgt_idx)/join",
                size: 250
            )
        }
        .alert("복사 완료", isPresented: $showingCopiedAlert) {
            Button("확인", role: .cancel) {}
        } message: {
            Text("초대 코드가 클립보드에 복사되었습니다.")
        }
        .alert(isPresented: $showingDeleteAlert) {
            if isCurrentUserOwner {
                return Alert(
                    title: Text("그룹 삭제"),
                    message: Text("정말로 이 그룹을 삭제하시겠습니까? 모든 데이터가 사라집니다."),
                    primaryButton: .destructive(Text("삭제")) {
                        viewModel.deleteGroup(sgtIdx: group.sgt_idx)
                    },
                    secondaryButton: .cancel()
                )
            } else {
                return Alert(
                    title: Text("그룹 나가기"),
                    message: Text("정말로 이 그룹을 나가시겠습니까?"),
                    primaryButton: .destructive(Text("나가기")) {
                        // TODO: Implement leave group (currently reusing delete/remove logic or need new API)
                        // For now, assuming remove self
                        if let _ = AuthService.shared.getUserData() {
                            // Temporary workaround: strictly speaking leave != delete, but for MVP member removal works
                            // Ideally GroupService needs leaveGroup endpoint
                        }
                    },
                    secondaryButton: .cancel()
                )
            }
        }
    }
    
    private var isCurrentUserOwner: Bool {
        guard let currentUser = AuthService.shared.getUserData() else { return false }
        // Find current user in member list and check owner status
        if let member = viewModel.groupMembers.first(where: { $0.mt_idx == currentUser.mt_idx ?? 0 }) {
            return member.sgdt_owner_chk == "Y"
        }
        return false 
        // Fallback: check stored group creator info if available (LoginModels SmapGroup uses mt_idx for creator)
        // return group.mt_idx == currentUser.mt_idx
    }
    
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
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
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
                
                // Crown for Owner/Leader
                if member.sgdt_owner_chk == "Y" || member.sgdt_leader_chk == "Y" {
                    Image(systemName: "crown.fill")
                        .font(.suite(size: 10))
                        .foregroundColor(.white)
                        .padding(4)
                        .background(member.sgdt_owner_chk == "Y" ? Color.yellow : Color.blue)
                        .clipShape(Circle())
                        .offset(x: 4, y: 4)
                }
            }
            
            // Name and Role
            VStack(alignment: .leading, spacing: 4) {
                Text(member.displayName)
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
                
                Text(getRoleText())
                    .font(.suite(size: 13))
                    .foregroundColor(getRoleColor())
            }
            
            Spacer()
            
            // Role Badge or Settings Gear
            if member.sgdt_owner_chk == "Y" {
                Text("그룹장")
                    .font(.suite(size: 12, weight: .medium))
                    .foregroundColor(brandColor)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(brandColor.opacity(0.1))
                    .cornerRadius(8)
            } else if isCurrentUserOwner {
                Menu {
                    Button(action: onPromote) {
                        Label(member.sgdt_leader_chk == "Y" ? "리더 해제" : "리더로 지정", 
                              systemImage: member.sgdt_leader_chk == "Y" ? "person.badge.minus" : "person.badge.shield.checkmark")
                    }
                    
                    Button(role: .destructive, action: onRemove) {
                        Label("그룹에서 내보내기", systemImage: "person.badge.minus")
                    }
                } label: {
                    Image(systemName: "gearshape")
                        .font(.suite(size: 18))
                        .foregroundColor(.gray)
                        .padding(4)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
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
            return .orange
        } else if member.sgdt_leader_chk == "Y" {
            return .blue
        } else {
            return .secondary
        }
    }
    
    // Helper function for avatar URL
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

