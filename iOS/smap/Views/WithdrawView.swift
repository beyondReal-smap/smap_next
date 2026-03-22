//
// WithdrawView.swift
// smap
//
// 회원탈퇴 페이지 (3단계 프로세스)
//

import SwiftUI

struct WithdrawReason: Identifiable {
    let id: Int
    let icon: String
    let text: String
}

struct WithdrawView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared
    
    @State private var currentStep = 1
    @State private var password = ""
    @State private var showPassword = false
    @State private var selectedReasons: Set<String> = []
    @State private var etcReason = ""
    @State private var agreement = false
    
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showSuccessAlert = false
    @State private var showConfirmWithdrawAlert = false
    
    
    private let errorRed = Color(red: 220/255, green: 38/255, blue: 38/255)
    
    let reasonsArr = [
        WithdrawReason(id: 1, icon: "😴", text: "자주 사용하지 않아요"),
        WithdrawReason(id: 2, icon: "🚫", text: "원하는 기능 부족"),
        WithdrawReason(id: 3, icon: "😕", text: "서비스가 불편해요"),
        WithdrawReason(id: 4, icon: "🔒", text: "개인정보 우려"),
        WithdrawReason(id: 5, icon: "❓", text: "기타 이유")
    ]
    
    private var isSocialLogin: Bool {
        guard let user = authService.currentUser else { return false }
        // 1: 일반, 2: Kakao, 3: Apple, 4: Google
        return user.mt_type != 1
    }
    
    var body: some View {
        ZStack {
            Color(UIColor.systemGroupedBackground).ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Header (Navigation Bar)
                HStack {
                    Button(action: {
                        if currentStep > 1 {
                            withAnimation {
                                currentStep -= 1
                            }
                        } else {
                            presentationMode.wrappedValue.dismiss()
                        }
                    }) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.primary)
                            .padding(8)
                    }
                    .accessibilityLabel("뒤로")
                    
                    Spacer()
                    
                    Text("회원탈퇴")
                        .font(.suite(size: 18, weight: .bold))
                    
                    Spacer()
                    
                    // Invisible spacer for balance
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.clear)
                        .padding(8)
                }
                .padding(.horizontal)
                .padding(.vertical, 12)
                .background(Color(UIColor.systemBackground))
                
                // Step Indicator
                HStack(spacing: 12) {
                    ForEach(1...3, id: \.self) { step in
                        HStack(spacing: 0) {
                            ZStack {
                                Circle()
                                    .fill(step <= currentStep ? SMAPTheme.Color.primary : Color.gray.opacity(0.2))
                                    .frame(width: 28, height: 28)
                                
                                if step < currentStep {
                                    Image(systemName: "check")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(.white)
                                } else {
                                    Text("\(step)")
                                        .font(.suite(size: 12, weight: .bold))
                                        .foregroundColor(step <= currentStep ? .white : .gray)
                                }
                            }
                            
                            if step < 3 {
                                Rectangle()
                                    .fill(step < currentStep ? SMAPTheme.Color.primary : Color.gray.opacity(0.2))
                                    .frame(width: 24, height: 2)
                                    .padding(.leading, 8)
                            }
                        }
                    }
                }
                .padding(.vertical, 20)
                
                // Content
                ScrollView {
                    VStack(spacing: 24) {
                        if currentStep == 1 {
                            stepOneView
                        } else if currentStep == 2 {
                            stepTwoView
                        } else {
                            stepThreeView
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                }
                
                // Bottom Button
                VStack(spacing: 0) {
                    if !errorMessage.isEmpty {
                        Text(errorMessage)
                            .font(.suite(size: 13))
                            .foregroundColor(errorRed)
                            .padding(.bottom, 12)
                    }
                    
                    Button(action: handleNext) {
                        HStack {
                            if isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .padding(.trailing, 8)
                            }
                            Text(currentStep == 3 ? "탈퇴하기" : "다음")
                                .font(.suite(size: 16, weight: .bold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(canProceed ? (currentStep == 3 ? errorRed : SMAPTheme.Color.primary) : Color.gray.opacity(0.3))
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .disabled(!canProceed || isLoading)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
                }
                .background(Color(UIColor.systemBackground))
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .alert("탈퇴 완료", isPresented: $showSuccessAlert) {
            Button("확인", role: .cancel) {
                // AuthService.withdraw already calls logout() which sends "logout" notification
                // Local logout handles redirection in RootView
            }
        } message: {
            Text("회원 탈퇴가 완료되었습니다. 그동안 서비스를 이용해주셔서 감사합니다.")
        }
        .alert("정말 탈퇴하시겠습니까?", isPresented: $showConfirmWithdrawAlert) {
            Button("취소", role: .cancel) {}
            Button("탈퇴", role: .destructive) {
                performWithdraw()
            }
        } message: {
            Text("모든 데이터가 삭제되며 복구할 수 없습니다.")
        }
    }
    
    private var canProceed: Bool {
        switch currentStep {
        case 1:
            return isSocialLogin || !password.isEmpty
        case 2:
            if selectedReasons.isEmpty { return false }
            if selectedReasons.contains("기타 이유") && etcReason.trimmingCharacters(in: .whitespaces).isEmpty {
                return false
            }
            return true
        case 3:
            return agreement
        default:
            return false
        }
    }
    
    // MARK: - Steps Views
    
    private var stepOneView: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("본인 확인")
                    .font(.suite(size: 22, weight: .bold))
                Text(isSocialLogin ? "소셜 계정으로 로그인 중입니다.\n본인 확인이 완료되었습니다." : "계정 보안을 위해 비밀번호를 입력해주세요.")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
            .padding(.bottom, 8)
            
            if isSocialLogin {
                HStack(spacing: 12) {
                    let userType = authService.currentUser?.mt_type ?? 0
                    Group {
                        if userType == 3 { // Apple
                            Image(systemName: "applelogo")
                                .font(.system(size: 24))
                            Text("Apple ID로 로그인됨")
                        } else if userType == 4 { // Google
                            Image(systemName: "person.circle.fill") // Fallback
                                .font(.system(size: 24))
                                .foregroundColor(.blue)
                            Text("Google 계정으로 로그인됨")
                        } else if userType == 2 { // Kakao
                            Image(systemName: "person.circle.fill") // Fallback
                                .font(.system(size: 24))
                                .foregroundColor(.yellow)
                            Text("카카오 계정으로 로그인됨")
                        } else {
                            Image(systemName: "person.badge.key.fill")
                                .font(.system(size: 24))
                            Text("소셜 계정으로 로그인됨")
                        }
                    }
                    .font(.suite(size: 16, weight: .medium))
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(12)
                .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("비밀번호")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                    
                    HStack {
                        if showPassword {
                            TextField("현재 비밀번호", text: $password)
                                .font(.suite(size: 16))
                        } else {
                            SecureField("현재 비밀번호", text: $password)
                                .font(.suite(size: 16))
                        }
                        
                        Button(action: { showPassword.toggle() }) {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .foregroundColor(.gray)
                        }
                        .accessibilityLabel(showPassword ? "비밀번호 숨기기" : "비밀번호 보기")
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(12)
                    .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
                }
            }
            
            // Info Card
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "shield.lefthalf.filled")
                    .foregroundColor(SMAPTheme.Color.primary)
                    .font(.system(size: 18))
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("보안 강화")
                        .font(.suite(size: 15, weight: .bold))
                    Text("탈퇴 전 본인 확인 과정을 통해 소중한 정보를 안전하게 보호합니다.")
                        .font(.suite(size: 13))
                        .foregroundColor(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SMAPTheme.Color.primary.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    private var stepTwoView: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 8) {
                Text("탈퇴 사유")
                    .font(.suite(size: 22, weight: .bold))
                Text("서비스 개선을 위해 소중한 의견을 들려주세요 (중복 선택 가능)")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
            
            VStack(spacing: 10) {
                ForEach(reasonsArr) { reason in
                    Button(action: {
                        if selectedReasons.contains(reason.text) {
                            selectedReasons.remove(reason.text)
                        } else {
                            selectedReasons.insert(reason.text)
                        }
                    }) {
                        HStack {
                            Text(reason.icon)
                                .font(.system(size: 20))
                                .frame(width: 32)
                            
                            Text(reason.text)
                                .font(.suite(size: 15, weight: .medium))
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            if selectedReasons.contains(reason.text) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(SMAPTheme.Color.primary)
                            } else {
                                Circle()
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                    .frame(width: 22, height: 22)
                            }
                        }
                        .padding()
                        .background(selectedReasons.contains(reason.text) ? SMAPTheme.Color.primary.opacity(0.05) : Color.white)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(selectedReasons.contains(reason.text) ? SMAPTheme.Color.primary : Color.clear, lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
                    }
                }
            }
            
            if selectedReasons.contains("기타 이유") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("상세 사유")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                    
                    TextEditor(text: $etcReason)
                        .font(.suite(size: 14))
                        .frame(height: 100)
                        .padding(8)
                        .background(Color.white)
                        .cornerRadius(12)
                        .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
                }
            }
        }
    }
    
    private var stepThreeView: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 8) {
                Text("최종 확인")
                    .font(.suite(size: 22, weight: .bold))
                Text("탈퇴 전 주의사항을 꼭 확인해주세요.")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
            
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                    Text("계정 정보 및 데이터 영구 삭제")
                        .font(.suite(size: 15, weight: .bold))
                }
                
                Text("탈퇴 시 회원의 모든 프로필 정보, 활동 내역, 설정 정보가 즉시 삭제되며 복구가 불가능합니다.")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .padding(.leading, 32)
                
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .foregroundColor(.orange)
                    Text("재가입 제한 안내")
                        .font(.suite(size: 15, weight: .bold))
                }
                
                Text("탈퇴 후 30일 동안 동일한 정보로 재가입이 제한될 수 있습니다.")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .padding(.leading, 32)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
            .cornerRadius(16)
            .shadow(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 4)
            
            Button(action: { agreement.toggle() }) {
                HStack(spacing: 12) {
                    Image(systemName: agreement ? "checkmark.square.fill" : "square")
                        .font(.system(size: 20))
                        .foregroundColor(agreement ? SMAPTheme.Color.primary : .gray)
                    
                    Text("안내사항을 모두 확인하였으며, 이에 동의합니다.")
                        .font(.suite(size: 14))
                        .foregroundColor(.primary)
                }
            }
            .padding(.top, 8)
        }
    }
    
    // MARK: - Actions
    
    private func handleNext() {
        errorMessage = ""
        
        if currentStep == 1 {
            if isSocialLogin {
                withAnimation { currentStep = 2 }
            } else {
                verifyPassword()
            }
        } else if currentStep == 2 {
            withAnimation { currentStep = 3 }
        } else {
            showConfirmWithdrawAlert = true
        }
    }
    
    private func verifyPassword() {
        isLoading = true
        Task {
            do {
                let response = try await authService.verifyPassword(password: password)
                await MainActor.run {
                    isLoading = false
                    if response.success {
                        withAnimation { currentStep = 2 }
                    } else {
                        errorMessage = response.message
                    }
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func performWithdraw() {
        isLoading = true
        
        let primaryReason = selectedReasons.first ?? "기타 이유"
        let reasonMapping: [String: Int] = [
            "자주 사용하지 않아요": 1,
            "원하는 기능 부족": 2,
            "서비스가 불편해요": 3,
            "개인정보 우려": 4,
            "기타 이유": 5
        ]
        let reasonIdx = reasonMapping[primaryReason] ?? 5
        
        Task {
            do {
                let response = try await authService.withdraw(
                    reasonIdx: reasonIdx,
                    etcReason: selectedReasons.contains("기타 이유") ? etcReason : nil,
                    reasons: Array(selectedReasons)
                )
                
                await MainActor.run {
                    isLoading = false
                    if response.success {
                        showSuccessAlert = true
                    } else {
                        errorMessage = response.message
                    }
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}

struct WithdrawView_Previews: PreviewProvider {
    static var previews: some View {
        WithdrawView()
    }
}
