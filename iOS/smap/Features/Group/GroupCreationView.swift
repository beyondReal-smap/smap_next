//
// GroupCreationView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - Group Creation View (Mandatory)

struct GroupCreationView: View {
    @ObservedObject var viewModel: HomeViewModel
    @State private var groupName: String = ""
    @State private var groupDescription: String = ""
    @State private var inviteCode: String = ""
    @State private var isCreating: Bool = false
    @State private var errorMessage: String?
    @State private var selectedTab: Int = 0 // 0 = Create, 1 = Join
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    private let orangeColor = Color(red: 245/255, green: 158/255, blue: 11/255)
    
    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                gradient: Gradient(colors: [Color(white: 0.98), Color.white]),
                startPoint: .top,
                endPoint: .bottom
            )
            .edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 0) {
                // Header Icon
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [brandColor.opacity(0.1), pinkColor.opacity(0.1)]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 120, height: 120)
                    
                    Circle()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [brandColor, pinkColor]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 80, height: 80)
                        .shadow(color: brandColor.opacity(0.3), radius: 16, x: 0, y: 8)
                    
                    Image(systemName: selectedTab == 0 ? "person.3.fill" : "person.badge.plus")
                        .font(.system(size: 32))
                        .foregroundColor(.white)
                }
                .padding(.top, 40)
                .padding(.bottom, 20)
                
                // Title
                Text("그룹 시작하기")
                    .font(.suite(size: 24, weight: .bold))
                    .foregroundColor(.black)
                
                Text("새 그룹을 만들거나 초대코드로 가입하세요")
                    .font(.suite(size: 14))
                    .foregroundColor(.gray)
                    .padding(.top, 8)
                
                // Tab Selector
                HStack(spacing: 0) {
                    TabButton(text: "그룹 만들기", isSelected: selectedTab == 0) {
                        withAnimation { selectedTab = 0 }
                    }
                    TabButton(text: "초대코드 입력", isSelected: selectedTab == 1) {
                        withAnimation { selectedTab = 1 }
                    }
                }
                .padding(4)
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)
                .padding(.horizontal, 24)
                .padding(.top, 24)
                
                // Form Card
                VStack(spacing: 20) {
                    if selectedTab == 0 {
                        // === Create Group Form ===
                        VStack(alignment: .leading, spacing: 6) {
                            Text("그룹 이름")
                                .font(.suite(size: 14, weight: .bold))
                                .foregroundColor(.gray)
                            
                            FocusableTextField(
                                placeholder: "예: 우리 가족, 회사 동료",
                                text: $groupName,
                                icon: "tag"
                            )
                            .frame(height: 56)
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("그룹 설명 (선택)")
                                .font(.suite(size: 14, weight: .medium))
                                .foregroundColor(.gray)
                            
                            FocusableTextField(
                                placeholder: "그룹에 대한 간단한 설명",
                                text: $groupDescription,
                                icon: "doc.text"
                            )
                            .frame(height: 56)
                        }
                    } else {
                        // === Join Group Form ===
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
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("초대 코드")
                                .font(.suite(size: 14, weight: .bold))
                                .foregroundColor(.gray)
                            
                            FocusableTextField(
                                placeholder: "초대 코드를 입력하세요",
                                text: filteredBinding,
                                icon: "person.badge.plus",
                                keyboardType: .asciiCapable, // 영문/숫자 키보드 강제
                                autocapitalizationType: .allCharacters
                            )
                            .frame(height: 56)
                            // FocusableTextField 내부에 전달되지 않을 수 있으므로 내부 TextField 수정 필요
                        }
                        
                        Text("그룹 초대 코드를 받으셨나요?\n코드를 입력하면 해당 그룹에 가입됩니다.")
                            .font(.suite(size: 13))
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                            .padding(.top, 8)
                    }
                }
                .padding(24)
                .background(Color.white)
                .cornerRadius(20)
                .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 4)
                .padding(.horizontal, 24)
                .padding(.top, 24)
                
                if let error = errorMessage {
                    Text(error)
                        .font(.suite(size: 13))
                        .foregroundColor(.red)
                        .padding(.top, 16)
                        .padding(.horizontal, 24)
                }
                
                Spacer()
                
                // Submit Button
                Button(action: {
                    print("🔘 [GroupCreationView] 버튼 클릭됨 - selectedTab: \(selectedTab), inviteCode: '\(inviteCode)', groupName: '\(groupName)'")
                    HapticManager.shared.impact(style: .medium)
                    if selectedTab == 0 {
                        print("🔘 [GroupCreationView] createGroup() 호출")
                        createGroup()
                    } else {
                        print("🔘 [GroupCreationView] joinGroup() 호출")
                        joinGroup()
                    }
                }) {
                    HStack {
                        if isCreating {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .padding(.trailing, 8)
                        }
                        Text(selectedTab == 0 ? "그룹 만들기" : "그룹 가입하기")
                            .font(.suite(size: 16, weight: .bold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(
                        (selectedTab == 0 && groupName.isEmpty) || (selectedTab == 1 && inviteCode.isEmpty)
                            ? Color.gray.opacity(0.3)
                            : (selectedTab == 0 ? brandColor : orangeColor)
                    )
                    .cornerRadius(12)
                    .shadow(color: (selectedTab == 0 ? brandColor : orangeColor).opacity(0.3), radius: 8, x: 0, y: 4)
                }
                .disabled((selectedTab == 0 && groupName.isEmpty) || (selectedTab == 1 && inviteCode.isEmpty) || isCreating)
                .padding(.horizontal, 24)
                
                // Tip
                HStack(spacing: 8) {
                    Text("💡")
                        .font(.system(size: 16))
                    Text(selectedTab == 0
                        ? "그룹을 만들면 멤버들을 초대할 수 있는 코드가 생성됩니다"
                        : "초대 코드는 그룹 관리자에게 받을 수 있습니다")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(selectedTab == 0 ? Color.yellow.opacity(0.1) : Color.orange.opacity(0.1))
                .cornerRadius(12)
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 32)
            }
        }
    }
    
    // Tab Button Component
    @ViewBuilder
    private func TabButton(text: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(.suite(size: 14, weight: isSelected ? .bold : .medium))
                .foregroundColor(isSelected ? brandColor : .gray)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(isSelected ? Color.white : Color.clear)
                .cornerRadius(10)
        }
    }
    
    private func createGroup() {
        guard !groupName.isEmpty else { return }
        
        isCreating = true
        errorMessage = nil
        
        Task {
            do {
                let _ = try await GroupService.shared.createGroup(title: groupName, memo: groupDescription)
                await viewModel.fetchInitialData()
                
                DispatchQueue.main.async {
                    viewModel.showGroupCreationModal = false
                    isCreating = false
                }
            } catch {
                DispatchQueue.main.async {
                    isCreating = false
                    if let apiError = error as? APIError {
                        errorMessage = apiError.message ?? "그룹 생성에 실패했습니다."
                    } else {
                        errorMessage = "알 수 없는 오류가 발생했습니다."
                    }
                }
            }
        }
    }
    
    private func joinGroup() {
        print("🔵 [GroupCreationView.joinGroup] 함수 호출됨 - inviteCode: '\(inviteCode)'")
        
        guard !inviteCode.isEmpty else {
            print("🔴 [GroupCreationView.joinGroup] 초대코드가 비어있음 - 종료")
            return
        }
        
        print("🟢 [GroupCreationView.joinGroup] 초대코드 확인됨 - 가입 시작")
        isCreating = true
        errorMessage = nil
        
        Task {
            do {
                // 사용자 정보 확인
                let currentUser = AuthService.shared.currentUser
                print("🟡 [GroupCreationView.joinGroup] currentUser: \(String(describing: currentUser))")
                print("🟡 [GroupCreationView.joinGroup] mt_idx: \(String(describing: currentUser?.mt_idx))")
                print("🟡 [GroupCreationView.joinGroup] token: \(AuthService.shared.getToken()?.prefix(20) ?? "nil")...")
                
                print("🟡 [GroupCreationView.joinGroup] GroupService.joinGroup 호출 시작")
                let success = try await GroupService.shared.joinGroup(inviteCode: inviteCode)
                print("🟡 [GroupCreationView.joinGroup] GroupService.joinGroup 결과: \(success)")
                
                if success {
                    print("✅ [GroupCreationView.joinGroup] 가입 성공 - 데이터 갱신 시작")
                    await viewModel.fetchInitialData()
                    
                    await MainActor.run {
                        viewModel.showGroupCreationModal = false
                        isCreating = false
                        print("✅ [GroupCreationView.joinGroup] 모달 닫기 완료")
                    }
                } else {
                    print("❌ [GroupCreationView.joinGroup] 가입 실패 (success=false)")
                    await MainActor.run {
                        isCreating = false
                        errorMessage = "그룹 가입에 실패했습니다. 초대 코드를 확인해주세요."
                    }
                }
            } catch {
                print("❌ [GroupCreationView.joinGroup] 에러 발생: \(error)")
                await MainActor.run {
                    isCreating = false
                    if let apiError = error as? APIError {
                        errorMessage = apiError.message ?? "그룹 가입에 실패했습니다."
                        print("❌ [GroupCreationView.joinGroup] API 에러 메시지: \(apiError.message ?? "nil")")
                    } else {
                        errorMessage = "알 수 없는 오류가 발생했습니다: \(error.localizedDescription)"
                        print("❌ [GroupCreationView.joinGroup] 일반 에러: \(error.localizedDescription)")
                    }
                }
            }
        }
    }
}
