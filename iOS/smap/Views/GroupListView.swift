import SwiftUI

struct GroupListView: View {
    @StateObject private var viewModel = GroupViewModel()
    @State private var inviteCode: String = ""
    @State private var showCreateModal: Bool = false
    @State private var newGroupTitle: String = ""
    @State private var newGroupMemo: String = ""
    
    // Brand Colors
    
    private let secondaryColor = Color.gray
    
    var body: some View {
        NavigationStack {
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
                    
                    // Floating Action Button for Create Group — 타 화면 FAB(홈/내장소/위치기록)와 위치·그림자 통일.
                    Button(action: {
                        showCreateModal = true
                    }) {
                        Image(systemName: "plus")
                            .font(.title2.bold())
                            .foregroundColor(.white)
                            .frame(width: 56, height: 56)
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [SMAPTheme.Color.primary, SMAPTheme.Color.primaryDark]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .clipShape(Circle())
                            .shadow(color: SMAPTheme.Color.primary.opacity(0.3), radius: 12, x: 0, y: 8)
                    }
                    .accessibilityLabel("그룹 추가")
                    .accessibilityAddTraits(.isButton)
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
                }
            }
            .background(Color(white: 0.98)) // Light gray background
            .toolbar(.hidden, for: .navigationBar)
            .onAppear {
                viewModel.fetchGroups()
                
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("groupsDidChange"))) { _ in
                viewModel.fetchGroups()
            }
            .alert("알림", isPresented: $viewModel.showError) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "오류가 발생했습니다.")
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
                        .font(.suite(size: 28, weight: .bold))
                        .foregroundColor(Color(red: 191/255, green: 219/255, blue: 254/255).opacity(0.5)) // text-blue-200
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(gradient: Gradient(colors: [SMAPTheme.Color.primary, SMAPTheme.Color.primaryDark]), startPoint: .leading, endPoint: .trailing)
            )
            .cornerRadius(16)
            .shadow(color: SMAPTheme.Color.primary.opacity(0.25), radius: 4, x: 0, y: 2)

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
                        .font(.suite(size: 28, weight: .bold))
                        .foregroundColor(Color(red: 251/255, green: 207/255, blue: 232/255).opacity(0.5)) // text-pink-200
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(gradient: Gradient(colors: [SMAPTheme.Accent.pink, SMAPTheme.Accent.pinkDeep]), startPoint: .leading, endPoint: .trailing)
            )
            .cornerRadius(16)
            .shadow(color: SMAPTheme.Accent.pink.opacity(0.25), radius: 4, x: 0, y: 2)
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
                // 입력 영역 stroke — 브랜드 primary tint로 통일 (FAB/가입 버튼과 조화)
                RoundedRectangle(cornerRadius: 12)
                    .stroke(SMAPTheme.Color.primary.opacity(0.2), lineWidth: 1)
            )
            
            Button(action: onJoin) {
                Text("가입")
                    .font(.suite(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .frame(minHeight: 44) // HIG 터치 타겟
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(
                        inviteCode.isEmpty ? Color.gray.opacity(0.4) : SMAPTheme.Color.primary
                    )
                    .cornerRadius(12)
                    .shadow(color: SMAPTheme.Color.primary.opacity(0.2), radius: 4, x: 0, y: 2)
            }
            .disabled(inviteCode.isEmpty)
            .accessibilityHint(inviteCode.isEmpty ? "초대 코드를 먼저 입력하세요" : "입력한 코드로 그룹에 가입")
        }
        .padding(.horizontal)
    }
}

struct GroupCard: View {
    let group: SmapGroup
    let index: Int

    var body: some View {
        HStack(spacing: 14) {
            // Icon — flat 스타일, 브랜드 tint 배경
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(SMAPTheme.Color.primary.opacity(0.08))
                    .frame(width: 52, height: 52)

                let iconUrl = URL(string: "https://nextstep.aiagnt.kr/images/group\((index % 2) + 1).webp")

                AsyncImage(url: iconUrl) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure(_):
                        Image(systemName: "person.3.fill")
                            .foregroundColor(SMAPTheme.Color.primary.opacity(0.8))
                            .font(.suite(size: 22))
                    case .empty:
                        ProgressView()
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(width: 48, height: 48)
                .cornerRadius(10)
            }
            .accessibilityHidden(true)

            // Info — 제목 / 메모 / 보조정보 3단 위계
            VStack(alignment: .leading, spacing: 3) {
                Text(group.sgt_title ?? "이름 없음")
                    .font(.suite(size: 17, weight: .bold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.9)

                Text(group.sgt_memo ?? "그룹 설명이 없습니다")
                    .font(.suite(size: 13))
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                // 보조정보: 멤버수(좌) + 날짜(우). Spacer 로 자연 분리되어 짤림 방지.
                HStack(spacing: 6) {
                    Image(systemName: "person.2.fill")
                        .font(.suite(size: 11, weight: .semibold))
                    Text("\(group.member_count ?? 0)명")
                        .font(.suite(size: 12, weight: .medium))
                        .monospacedDigit()

                    if let dateStr = group.sgt_wdate {
                        Text("·")
                            .font(.suite(size: 12))
                            .foregroundColor(.secondary)
                        Text(dateStr.components(separatedBy: "T").first ?? dateStr)
                            .font(.suite(size: 12))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
                .foregroundColor(SMAPTheme.Color.primary)
                .padding(.top, 4)
            }

            Spacer(minLength: 4)

            Image(systemName: "chevron.right")
                .font(.suite(size: 13, weight: .semibold))
                .foregroundColor(Color.secondary.opacity(0.6))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .frame(minHeight: 80) // 안정적인 Row 높이, 멤버 몇 명이든 레이아웃 일관
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
        )
        .overlay(
            // 그림자 대신 가벼운 stroke로 분리감. iOS 최신 flat 트렌드와 정합.
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(group.sgt_title ?? "이름 없음") 그룹, 멤버 \(group.member_count ?? 0)명")
        .accessibilityHint("상세 보기")
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
    
    
    private var pinkColor: Color { SMAPTheme.Accent.pink }
    
    var body: some View {
        NavigationStack {
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
                .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Header Illustration
                    ZStack {
                        // Background Circle
                        Circle()
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [SMAPTheme.Color.primary.opacity(0.1), pinkColor.opacity(0.1)]),
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
                                    gradient: Gradient(colors: [SMAPTheme.Color.primary, pinkColor]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 90, height: 90)
                            .shadow(color: SMAPTheme.Color.primary.opacity(0.3), radius: 15, x: 0, y: 8)
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
                                    .foregroundColor(SMAPTheme.Color.primary)
                                Text("그룹 이름")
                                    .font(.suite(size: 13, weight: .semibold))
                                    .foregroundColor(.gray)
                            }
                            
                            HStack(spacing: 12) {
                                Image(systemName: "person.3.sequence.fill")
                                    .foregroundColor(focusedField == .title ? SMAPTheme.Color.primary : .gray.opacity(0.5))
                                    .font(.suite(size: 18))
                                
                                TextField("예: 우리가족, 친한 친구들", text: $title)
                                    .font(.suite(size: 16))
                                    .focused($focusedField, equals: .title)
                                
                                if !title.isEmpty {
                                    Button(action: { title = "" }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(.gray.opacity(0.4))
                                    }
                                    .accessibilityLabel("그룹 이름 지우기")
                                }
                            }
                            .padding(16)
                            .background(Color.white)
                            .cornerRadius(14)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(focusedField == .title ? SMAPTheme.Color.primary : Color.gray.opacity(0.15), lineWidth: focusedField == .title ? 2 : 1)
                            )
                            .shadow(color: focusedField == .title ? SMAPTheme.Color.primary.opacity(0.1) : Color.clear, radius: 8, x: 0, y: 4)
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
                                    .accessibilityLabel("그룹 설명 지우기")
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
                                        gradient: Gradient(colors: [SMAPTheme.Color.primary, Color(red: 99/255, green: 102/255, blue: 241/255)]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                }
                            }
                        )
                        .cornerRadius(16)
                        .shadow(color: title.isEmpty ? Color.clear : SMAPTheme.Color.primary.opacity(0.3), radius: 12, x: 0, y: 6)
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
                    .background(SMAPTheme.Accent.crown.opacity(0.1))
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
                    .accessibilityLabel("닫기")
                }
            }
        }
    }
}
