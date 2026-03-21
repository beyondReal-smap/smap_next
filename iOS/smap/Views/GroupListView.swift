import SwiftUI

struct GroupListView: View {
    @StateObject private var viewModel = GroupViewModel()
    @State private var inviteCode: String = ""
    @State private var showCreateModal: Bool = false
    @State private var newGroupTitle: String = ""
    @State private var newGroupMemo: String = ""
    
    // Brand Colors
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let secondaryColor = Color.gray
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Custom Header
                GroupListHeaderView()
                    .padding(.bottom, 10)
                
                ZStack(alignment: .bottomTrailing) {
                    ScrollView {
                        VStack(spacing: 20) {
                            // 1. Stats Cards
                            StatsCardsView(groupCount: viewModel.groups.count, totalMembers: viewModel.totalMembers)
                            
                            // 2. Invite Code Section
                            InviteCodeSection(inviteCode: $inviteCode) {
                                viewModel.joinGroup(inviteCode: inviteCode)
                                inviteCode = "" // Clear after join
                            }
                            .disabled(viewModel.isJoining)
                            
                            // 3. Group List
                            if viewModel.isLoading {
                                ProgressView()
                                    .frame(maxWidth: .infinity, minHeight: 200)
                            } else if viewModel.groups.isEmpty {
                                EmptyGroupView()
                            } else {
                                LazyVStack(spacing: 16) {
                                    let groups = viewModel.groups
                                    ForEach(Array(groups.enumerated()), id: \.element.id) { index, group in
                                        NavigationLink(destination: GroupDetailView(viewModel: viewModel, group: group, groupIndex: index)) {
                                            GroupCard(group: group, index: index)
                                        }
                                    }
                                }
                                .padding(.horizontal)
                            }
                            
                            // Bottom Padding for FAB
                            Spacer(minLength: 80)
                        }
                        // Remove default top padding since we have custom header
                        // .padding(.top) 
                    }
                    .refreshable {
                        viewModel.fetchGroups()
                    }
                    
                    // Floating Action Button for Create Group
                    Button(action: {
                        showCreateModal = true
                    }) {
                        Image(systemName: "plus")
                            .font(.title2.bold())
                            .foregroundColor(.white)
                            .frame(width: 56, height: 56)
                            .background(
                                LinearGradient(gradient: Gradient(colors: [Color.yellow, Color.orange]), startPoint: .topLeading, endPoint: .bottomTrailing)
                            )
                            .clipShape(Circle())
                            .shadow(color: Color.black.opacity(0.2), radius: 5, x: 0, y: 5)
                    }
                    .padding()
                }
            }
            .background(Color(white: 0.98)) // Light gray background
            .navigationBarHidden(true)
            .onAppear {
                viewModel.fetchGroups()
                
                // 앱 실행 시 저장된 딥링크 그룹 ID가 있는지 확인
                if let pendingGroupId = UserDefaults.standard.string(forKey: "pending_join_group_id") {
                    print("👥 [DEEP_LINK] 저장된 펜딩 그룹 ID 발견: \(pendingGroupId)")
                    joinGroupById(pendingGroupId)
                    UserDefaults.standard.removeObject(forKey: "pending_join_group_id")
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("handleGroupJoinDeepLink"))) { notification in
                if let groupId = notification.userInfo?["group_id"] as? String {
                    print("👥 [DEEP_LINK] 알림 수신 - 그룹 가입 실행: \(groupId)")
                    joinGroupById(groupId)
                    UserDefaults.standard.removeObject(forKey: "pending_join_group_id")
                }
            }
            .alert(isPresented: $viewModel.showError) {
                Alert(title: Text("알림"), message: Text(viewModel.errorMessage ?? "오류가 발생했습니다."), dismissButton: .default(Text("확인")))
            }
            .sheet(isPresented: $showCreateModal) {
                CreateGroupView(isPresented: $showCreateModal, title: $newGroupTitle, memo: $newGroupMemo) {
                    viewModel.createGroup(title: newGroupTitle, memo: newGroupMemo)
                    newGroupTitle = ""
                    newGroupMemo = ""
                }
            }
        }
    }
    
    // 그룹 ID(sgt_idx)로 직접 가입하는 함수
    private func joinGroupById(_ groupId: String) {
        guard let sgt_idx = Int(groupId), let mt_idx = AuthService.shared.currentUser?.mt_idx else {
            print("❌ [DEEP_LINK] 가입 실패: 유효하지 않은 ID 또는 사용자 정보")
            return
        }
        
        print("🚀 [DEEP_LINK] 그룹 가입 API 호출 시작 - mt_idx: \(mt_idx), sgt_idx: \(sgt_idx)")
        
        Task {
            do {
                let success = try await GroupService.shared.joinGroupById(mt_idx: mt_idx, sgt_idx: sgt_idx)
                await MainActor.run {
                    if success {
                        print("✅ [DEEP_LINK] 그룹 가입 성공!")
                        viewModel.fetchGroups()
                    }
                }
            } catch {
                await MainActor.run {
                    print("❌ [DEEP_LINK] 그룹 가입 실패: \(error.localizedDescription)")
                }
            }
        }
    }
}

struct GroupListHeaderView: View {
    var body: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("그룹")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("그룹과 멤버를 한눈에 관리하세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer()
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
    }
}

// MARK: - Subviews

struct StatsCardsView: View {
    let groupCount: Int
    let totalMembers: Int
    
    var body: some View {
        HStack(spacing: 12) {
            // Total Groups Card
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("총 그룹")
                            .font(.suite(size: 14))
                            .foregroundColor(Color(red: 219/255, green: 234/255, blue: 254/255)) // text-blue-100
                        Text("\(groupCount)개")
                            .font(.suite(size: 24, weight: .bold))
                            .foregroundColor(.white)
                    }
                    Spacer()
                    Image(systemName: "square.stack.3d.up.fill")
                        .font(.custom("SUITE-Bold", size: 28))
                        .foregroundColor(Color(red: 191/255, green: 219/255, blue: 254/255).opacity(0.5)) // text-blue-200
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(gradient: Gradient(colors: [Color(red: 1/255, green: 19/255, blue: 163/255), Color(red: 0/255, green: 26/255, blue: 138/255)]), startPoint: .leading, endPoint: .trailing)
            )
            .cornerRadius(16)
            .shadow(color: Color.blue.opacity(0.3), radius: 8, x: 0, y: 4)
            
            // Total Members Card
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("총 멤버")
                            .font(.suite(size: 14))
                            .foregroundColor(Color(red: 252/255, green: 231/255, blue: 243/255)) // text-pink-100
                        Text("\(totalMembers)명")
                            .font(.suite(size: 24, weight: .bold))
                            .foregroundColor(.white)
                    }
                    Spacer()
                    Image(systemName: "person.2.fill")
                        .font(.custom("SUITE-Bold", size: 28))
                        .foregroundColor(Color(red: 251/255, green: 207/255, blue: 232/255).opacity(0.5)) // text-pink-200
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(gradient: Gradient(colors: [Color(red: 219/255, green: 39/255, blue: 119/255), Color(red: 190/255, green: 24/255, blue: 93/255)]), startPoint: .leading, endPoint: .trailing)
            )
            .cornerRadius(16)
            .shadow(color: Color.pink.opacity(0.3), radius: 8, x: 0, y: 4)
        }
        .padding(.horizontal)
    }
}

struct InviteCodeSection: View {
    @Binding var inviteCode: String
    var onJoin: () -> Void
    
    var body: some View {
        // 커스텀 바인딩을 사용하여 입력을 즉시 필터링
        let filteredBinding = Binding<String>(
            get: { self.inviteCode },
            set: { newValue in
                // 대문자로 변환하고 영문 알파벳(A-Z)과 숫자(0-9)만 허용
                self.inviteCode = newValue.uppercased().filter { char in
                    char.isASCII && (char.isLetter || char.isNumber)
                }
            }
        )
        
        HStack(spacing: 12) {
            HStack {
                Image(systemName: "person.badge.plus")
                    .foregroundColor(.gray)
                TextField("초대 코드 입력...", text: filteredBinding)
                    .font(.suite(size: 16))
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .keyboardType(.asciiCapable) // 영문/숫자 키보드 강제
            }
            .padding(.horizontal)
            .frame(height: 56) // 높이 고정
            .background(Color.white)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.orange.opacity(0.3), lineWidth: 1)
            )
            
            Button(action: onJoin) {
                Text("가입")
                    .font(.suite(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(gradient: Gradient(colors: [Color.orange, Color.yellow]), startPoint: .leading, endPoint: .trailing)
                    )
                    .cornerRadius(12)
                    .shadow(color: Color.orange.opacity(0.3), radius: 4, x: 0, y: 2)
            }
            .disabled(inviteCode.isEmpty)
        }
        .padding(.horizontal)
    }
}

struct GroupCard: View {
    let group: SmapGroup
    let index: Int
    
    // Random gradient for visual variety (deterministic based on ID)
    private var cardGradient: LinearGradient {
        let colors = [
            [Color(red: 240/255, green: 249/255, blue: 255/255), Color(red: 219/255, green: 234/255, blue: 254/255)], // Blueish
            [Color(red: 240/255, green: 253/255, blue: 244/255), Color(red: 220/255, green: 252/255, blue: 231/255)], // Greenish
            [Color(red: 255/255, green: 247/255, blue: 237/255), Color(red: 255/255, green: 237/255, blue: 213/255)]  // Orangish
        ]
        let index = abs(group.sgt_idx) % colors.count
        return LinearGradient(gradient: Gradient(colors: colors[index]), startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    
    var body: some View {
        HStack(spacing: 16) {
            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white)
                    .frame(width: 52, height: 52)
                    .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
                
                let iconUrl = URL(string: "https://nextstep.smap.site/images/group\((index % 2) + 1).webp")
                
                AsyncImage(url: iconUrl) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure(_):
                        Image(systemName: "person.3.fill")
                            .foregroundColor(.blue.opacity(0.6))
                    case .empty:
                        ProgressView()
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(width: 48, height: 48)
                .cornerRadius(10)
            }
            
            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(group.sgt_title ?? "이름 없음")
                    .font(.suite(size: 18, weight: .bold)) // Using Suite font as per design
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                
                Text(group.sgt_memo ?? "그룹 설명이 없습니다")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                
                HStack(spacing: 12) {
                    Label("\(group.member_count ?? 0)명", systemImage: "person.2.fill")
                        .font(.suite(size: 14))
                    
                    if let dateStr = group.sgt_wdate {
                        // Simple date formatting
                        let formattedDate = dateStr.components(separatedBy: "T").first ?? dateStr
                        Text(formattedDate)
                            .font(.suite(size: 14))
                            .foregroundColor(.blue)
                    }
                }
                .foregroundColor(Color(red: 1/255, green: 19/255, blue: 163/255))
                .padding(.top, 4)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
        .padding()
        .background(cardGradient)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 4)
    }
}

struct EmptyGroupView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.3.sequence.fill")
                .font(.suite(size: 60))
                .foregroundColor(.gray.opacity(0.3))
            
            Text("소속된 그룹이 없습니다")
                .font(.suite(size: 18, weight: .semibold))
                .foregroundColor(.secondary)
            
            Text("새 그룹을 생성하거나 초대 코드로 가입해보세요!")
                .font(.suite(size: 14))
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(maxWidth: .infinity)
        .background(Color.white)
        .cornerRadius(20)
        .padding(.horizontal)
        .shadow(color: Color.black.opacity(0.05), radius: 10)
    }
}

// Create Group Modal
struct CreateGroupView: View {
    @Binding var isPresented: Bool
    @Binding var title: String
    @Binding var memo: String
    var onSave: () -> Void
    
    @State private var isAnimating = false
    @FocusState private var focusedField: Field?
    
    enum Field { case title, memo }
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background Gradient
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(red: 248/255, green: 250/255, blue: 255/255),
                        Color.white
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .edgesIgnoringSafeArea(.all)
                
                VStack(spacing: 0) {
                    // Header Illustration
                    ZStack {
                        // Background Circle
                        Circle()
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [brandColor.opacity(0.1), pinkColor.opacity(0.1)]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 140, height: 140)
                            .scaleEffect(isAnimating ? 1.0 : 0.8)
                        
                        // Inner Circle
                        Circle()
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [brandColor, pinkColor]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 90, height: 90)
                            .shadow(color: brandColor.opacity(0.3), radius: 15, x: 0, y: 8)
                            .scaleEffect(isAnimating ? 1.0 : 0.9)
                        
                        // Icon
                        Image(systemName: "person.3.fill")
                            .font(.suite(size: 36, weight: .medium))
                            .foregroundColor(.white)
                            .scaleEffect(isAnimating ? 1.0 : 0.8)
                    }
                    .padding(.top, 30)
                    .padding(.bottom, 20)
                    .onAppear {
                        withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                            isAnimating = true
                        }
                    }
                    
                    // Title
                    VStack(spacing: 6) {
                        Text(title.isEmpty ? "새 그룹 생성" : "그룹 정보 수정")
                            .font(.suite(size: 24, weight: .bold))
                            .foregroundColor(.black)
                        
                        Text("소중한 사람들과 위치를 공유할 그룹을 만들어보세요")
                            .font(.suite(size: 14))
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.bottom, 30)
                    
                    // Form Section
                    VStack(spacing: 16) {
                        // Group Name Field
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 6) {
                                Image(systemName: "tag.fill")
                                    .font(.suite(size: 12))
                                    .foregroundColor(brandColor)
                                Text("그룹 이름")
                                    .font(.suite(size: 13, weight: .semibold))
                                    .foregroundColor(.gray)
                            }
                            
                            HStack(spacing: 12) {
                                Image(systemName: "person.3.sequence.fill")
                                    .foregroundColor(focusedField == .title ? brandColor : .gray.opacity(0.5))
                                    .font(.suite(size: 18))
                                
                                TextField("예: 우리가족, 친한 친구들", text: $title)
                                    .font(.suite(size: 16))
                                    .focused($focusedField, equals: .title)
                                
                                if !title.isEmpty {
                                    Button(action: { title = "" }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(.gray.opacity(0.4))
                                    }
                                }
                            }
                            .padding(16)
                            .background(Color.white)
                            .cornerRadius(14)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(focusedField == .title ? brandColor : Color.gray.opacity(0.15), lineWidth: focusedField == .title ? 2 : 1)
                            )
                            .shadow(color: focusedField == .title ? brandColor.opacity(0.1) : Color.clear, radius: 8, x: 0, y: 4)
                        }
                        
                        // Group Description Field
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 6) {
                                Image(systemName: "text.alignleft")
                                    .font(.suite(size: 12))
                                    .foregroundColor(pinkColor)
                                Text("그룹 설명 (선택)")
                                    .font(.suite(size: 13, weight: .semibold))
                                    .foregroundColor(.gray)
                            }
                            
                            HStack(spacing: 12) {
                                Image(systemName: "doc.text.fill")
                                    .foregroundColor(focusedField == .memo ? pinkColor : .gray.opacity(0.5))
                                    .font(.suite(size: 18))
                                
                                TextField("그룹에 대한 간단한 설명을 입력해주세요", text: $memo)
                                    .font(.suite(size: 16))
                                    .focused($focusedField, equals: .memo)
                                
                                if !memo.isEmpty {
                                    Button(action: { memo = "" }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(.gray.opacity(0.4))
                                    }
                                }
                            }
                            .padding(16)
                            .background(Color.white)
                            .cornerRadius(14)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(focusedField == .memo ? pinkColor : Color.gray.opacity(0.15), lineWidth: focusedField == .memo ? 2 : 1)
                            )
                            .shadow(color: focusedField == .memo ? pinkColor.opacity(0.1) : Color.clear, radius: 8, x: 0, y: 4)
                        }
                    }
                    .padding(.horizontal, 24)
                    
                    Spacer()
                    
                    // Create Button
                    Button(action: {
                        onSave()
                        isPresented = false
                    }) {
                        HStack(spacing: 10) {
                            Image(systemName: title.isEmpty ? "plus.circle.fill" : "checkmark.circle.fill")
                                .font(.suite(size: 20, weight: .medium))
                            
                            Text(title.isEmpty ? "그룹 생성" : "저장하기")
                                .font(.suite(size: 17, weight: .bold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(
                            Group {
                                if title.isEmpty {
                                    LinearGradient(
                                        gradient: Gradient(colors: [Color.gray.opacity(0.4), Color.gray.opacity(0.3)]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                } else {
                                    LinearGradient(
                                        gradient: Gradient(colors: [brandColor, Color(red: 99/255, green: 102/255, blue: 241/255)]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                }
                            }
                        )
                        .cornerRadius(16)
                        .shadow(color: title.isEmpty ? Color.clear : brandColor.opacity(0.3), radius: 12, x: 0, y: 6)
                    }
                    .disabled(title.isEmpty)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 20)
                    
                    // Tips Section
                    HStack(spacing: 8) {
                        Image(systemName: "lightbulb.fill")
                            .font(.suite(size: 14))
                            .foregroundColor(.yellow)
                        
                        Text("그룹을 만들면 멤버들을 초대할 수 있는 코드가 생성됩니다")
                            .font(.suite(size: 12))
                            .foregroundColor(.gray)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color.yellow.opacity(0.1))
                    .cornerRadius(12)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 30)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { isPresented = false }) {
                        Image(systemName: "xmark")
                            .font(.suite(size: 16, weight: .medium))
                            .foregroundColor(.gray)
                    }
                }
            }
        }
    }
}
