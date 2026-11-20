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
    
    
    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    SMAPFamilyCover(image: "LoginArrivalDoorway", minHeight: 150) {
                        Text("그룹 시작하기").font(SMAPTheme.Font.pageTitle)
                    }
                    Picker("그룹 작업 선택", selection: $selectedTab) {
                        Text("그룹 만들기").tag(0)
                        Text("초대코드 입력").tag(1)
                    }
                    .pickerStyle(.segmented)

                    if selectedTab == 0 {
                        SMAPTextField("예: 우리 가족", text: $groupName, label: "그룹 이름")
                        SMAPTextField("그룹에 대한 간단한 설명", text: $groupDescription, label: "그룹 설명 (선택)")
                    } else {
                        SMAPTextField("초대 코드를 입력하세요", text: Binding(
                            get: { inviteCode },
                            set: { inviteCode = $0.uppercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber) } }
                        ), label: "초대 코드", helperText: "초대 코드는 그룹 관리자에게 받을 수 있어요.", keyboardType: .asciiCapable)
                    }
                    if let error = errorMessage { SMAPBanner(message: error, tone: .error) }
                }
                .padding(.vertical, 16)
                .animation(.easeInOut(duration: 0.2), value: selectedTab)
            }
            .scrollDismissesKeyboard(.interactively)
            SMAPButton(selectedTab == 0 ? "그룹 만들기" : "그룹 가입하기", isLoading: isCreating,
                       isDisabled: selectedTab == 0 ? groupName.isEmpty : inviteCode.isEmpty) {
                HapticManager.shared.impact(style: .medium)
                if selectedTab == 0 { createGroup() } else { joinGroup() }
            }
            .padding(.vertical, 10)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .background(Color(uiColor: .systemBackground))
        .smapAccent(.family)
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
                print("🟡 [GroupCreationView.joinGroup] mt_idx: \(String(describing: currentUser?.mt_idx))")
                
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
