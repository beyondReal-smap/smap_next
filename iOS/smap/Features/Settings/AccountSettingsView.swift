//
// AccountSettingsView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
// Settings menu, account settings screen, and related components
//

import SwiftUI
import WebKit

// MARK: - Settings Menu View

public struct SettingMenuView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared

    

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.98, green: 0.98, blue: 1.0).ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Menu Sections
                        VStack(spacing: 24) {
                            SettingsMenuSectionView(title: "계정 관리", items: [
                                SettingsMenuItem(title: "계정설정", icon: "person.fill", color: .indigo, destination: AnyView(AccountSettingsView()))
                            ])

                            SettingsMenuSectionView(title: "약관 & 정책", items: [
                                SettingsMenuItem(title: "서비스 이용약관", icon: "doc.text.fill", color: .teal, destination: AnyView(ServiceTermsView())),
                                SettingsMenuItem(title: "개인정보 처리방침", icon: "shield.fill", color: .cyan, destination: AnyView(PrivacyPolicyView())),
                                SettingsMenuItem(title: "위치기반서비스 이용약관", icon: "location.fill", color: .purple, destination: AnyView(LocationTermsView())),
                                SettingsMenuItem(title: "마케팅 정보 수집 및 이용 동의", icon: "star.fill", color: Color(red: 1/255, green: 20/255, blue: 162/255), destination: AnyView(MarketingConsentView())),
                                SettingsMenuItem(title: "개인정보 제3자 제공 동의", icon: "person.2.fill", color: .pink, destination: AnyView(ThirdPartyProvisionView()))
                            ])

                            SettingsMenuSectionView(title: "고객 지원", items: [
                                SettingsMenuItem(title: "사용 가이드", icon: "book.fill", color: .yellow, destination: AnyView(UserGuideView())),
                                SettingsMenuItem(title: "1:1 문의", icon: "envelope.fill", color: .orange, destination: AnyView(InquiryView())),
                                SettingsMenuItem(title: "공지사항", icon: "bell.fill", color: .red, destination: AnyView(NoticeListView()))
                            ])
                        }
                        .padding(.horizontal)

                        // App Version Info
                        VStack(spacing: 4) {
                            Text("SMAP")
                                .font(.suite(size: 14, weight: .semibold))
                                .foregroundColor(.gray)
                            Text("버전 3.0.4")
                                .font(.suite(size: 12))
                                .foregroundColor(.gray.opacity(0.8))
                        }
                        .padding(.vertical, 32)
                    }
                    .padding(.vertical)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                                .font(.suite(size: 18, weight: .semibold))
                            Text("홈")
                                .font(.suite(size: 18, weight: .bold))
                        }
                        .foregroundColor(.primary)
                    }
                }
            }
        }
    }
}

// MARK: - Settings Menu Components

struct ProfileSummaryCard: View {
    let user: SMAPUser

    var body: some View {
        HStack(spacing: 16) {
            // Avatar
            if let avatarUrl = AuthService.getProfileImageURL(user.mt_file1) {
                AsyncImage(url: avatarUrl) { phase in
                    if let image = phase.image {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        Image(systemName: "person.circle.fill")
                            .resizable()
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
                .frame(width: 60, height: 60)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 2))
            } else {
                Image(systemName: "person.circle.fill")
                    .resizable()
                    .frame(width: 60, height: 60)
                    .foregroundColor(.white.opacity(0.5))
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(user.mt_nickname ?? user.mt_name ?? "사용자")
                        .font(.suite(size: 18, weight: .bold))
                        .foregroundColor(.white)

                    Text(user.mt_level == 5 ? "VIP" : "일반")
                        .font(.suite(size: 10, weight: .bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.2))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                }

                Text(user.mt_email ?? "이메일 정보 없음")
                    .font(.suite(size: 13))
                    .foregroundColor(.white.opacity(0.8))
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.white.opacity(0.5))
        }
        .padding(20)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [SMAPTheme.Color.primary, Color(red: 102/255, green: 126/255, blue: 234/255)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(24)
        .shadow(color: Color.blue.opacity(0.2), radius: 10, x: 0, y: 5)
    }
}

struct SettingsMenuSectionView: View {
    let title: String
    let items: [SettingsMenuItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.suite(size: 16, weight: .bold))
                    .foregroundColor(.primary)

                Spacer()

                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(height: 1)
                    .padding(.leading, 8)
            }

            VStack(spacing: 0) {
                ForEach(0..<items.count, id: \.self) { index in
                    NavigationLink(destination: items[index].destination) {
                        SettingsMenuItemView(item: items[index])
                    }

                    if index < items.count - 1 {
                        Divider().padding(.leading, 56)
                    }
                }
            }
            .background(Color.white)
            .cornerRadius(20)
            .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
        }
    }
}

struct SettingsMenuItem {
    let title: String
    let icon: String
    let color: Color
    let destination: AnyView
}

struct SettingsMenuItemView: View {
    let item: SettingsMenuItem

    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(item.color.opacity(0.1))
                    .frame(width: 40, height: 40)

                Image(systemName: item.icon)
                    .foregroundColor(item.color)
                    .font(.suite(size: 18))
            }

            Text(item.title)
                .font(.suite(size: 16, weight: .medium))
                .foregroundColor(.primary)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.suite(size: 14, weight: .semibold))
                .foregroundColor(.gray.opacity(0.4))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

// MARK: - Account Settings View

struct AccountSettingsView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared

    @State private var showingLogoutAlert = false

    @State private var showingImagePicker = false
    @State private var inputImage: UIImage?
    @State private var selectedImage: UIImage? // 즉시 표시용
    @State private var isLoadingImage = false
    @State private var showingImageUploadError = false
    @State private var imageUploadErrorMessage = ""

    

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                profileHeaderCard

                if authService.currentUser != nil {
                    accountManagementSection
                    accountInfoSection
                    logoutSection
                    withdrawLink
                }

                Spacer(minLength: 40)
            }
        }
        .background(Color(UIColor.secondarySystemBackground).ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("계정설정")
                    .font(.suite(size: 18, weight: .bold))
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: { presentationMode.wrappedValue.dismiss() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.suite(size: 18, weight: .semibold))
                        Text("뒤로")
                            .font(.suite(size: 18, weight: .bold))
                    }
                    .foregroundColor(.primary)
                }
            }
        }
        .sheet(isPresented: $showingImagePicker) {
            ImagePicker(image: $inputImage)
        }
        .onChange(of: inputImage) { _, newImage in
            if let newImage = newImage {
                selectedImage = newImage
                uploadImage()
            }
        }
        .alert("로그아웃", isPresented: $showingLogoutAlert) {
            Button("취소", role: .cancel) {}
            Button("로그아웃", role: .destructive) {
                authService.logout()
                NotificationCenter.default.post(name: NSNotification.Name("logout"), object: nil)
            }
        } message: {
            Text("정말로 로그아웃 하시겠습니까?")
        }
        .onAppear {
            // 페이지 진입 시 로컬 선택 이미지 초기화 (서버 데이터로 표시)
            selectedImage = nil
            inputImage = nil
        }
        .task {
            // 서버에서 최신 사용자 정보 가져오기
            do {
                _ = try await authService.fetchUserProfile()
                print("✅ [AccountSettingsView] 사용자 프로필 갱신 완료")
            } catch {
                print("⚠️ [AccountSettingsView] 사용자 프로필 갱신 실패: \(error)")
            }
        }
        .alert("이미지 업로드 실패", isPresented: $showingImageUploadError) {
            Button("확인", role: .cancel) { }
        } message: {
            Text(imageUploadErrorMessage)
        }
    }

    // MARK: - Extracted View Properties

    private var profileHeaderCard: some View {
        HStack(spacing: 20) {
            ZStack(alignment: .bottomTrailing) {
                if isLoadingImage {
                    ProgressView()
                        .frame(width: 80, height: 80)
                        .background(Color.gray.opacity(0.1))
                        .clipShape(Circle())
                } else if let selected = selectedImage {
                    Image(uiImage: selected)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 80, height: 80)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 3))
                        .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
                } else if let user = authService.currentUser,
                          let avatarUrl = AuthService.getProfileImageURL(user.mt_file1) {
                    AsyncImage(url: avatarUrl) { phase in
                        if let image = phase.image {
                            image.resizable().aspectRatio(contentMode: .fill)
                        } else {
                            defaultAvatar
                        }
                    }
                    .frame(width: 80, height: 80)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color.white, lineWidth: 3))
                    .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
                } else {
                    defaultAvatar
                }

                Button(action: { showingImagePicker = true }) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(6)
                        .background(SMAPTheme.Color.primary)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                }
                .accessibilityLabel("프로필 사진 변경")
                .offset(x: 2, y: 2)
            }

            if let user = authService.currentUser {
                VStack(alignment: .leading, spacing: 4) {
                    Text(user.displayName)
                        .font(.suite(size: 20, weight: .bold))
                        .foregroundColor(.white)

                    if let email = user.mt_email, !email.isEmpty {
                        Text(email)
                            .font(.suite(size: 13))
                            .foregroundColor(.white.opacity(0.8))
                            .lineLimit(1)
                    }
                }
            }
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [SMAPTheme.Color.primary, Color(red: 102/255, green: 126/255, blue: 234/255)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(24)
        .shadow(color: SMAPTheme.Color.primary.opacity(0.3), radius: 12, x: 0, y: 8)
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var accountManagementSection: some View {
        SettingsSectionView(title: "계정 관리") {
            NavigationLink(destination: EditProfileView()) {
                SettingsRowView(icon: "person.fill", iconColor: .indigo, title: "프로필 편집")
            }

            Divider().padding(.leading, 52)

            NavigationLink(destination: ChangePasswordView()) {
                SettingsRowView(icon: "lock.fill", iconColor: .pink, title: "비밀번호 변경")
            }
        }
    }

    @ViewBuilder
    private var accountInfoSection: some View {
        if let user = authService.currentUser {
            // 소셜 로그인 여부 확인 (2=카카오, 3=Apple, 4=Google)
            let isSocialLogin = user.mt_type == 2 || user.mt_type == 3 || user.mt_type == 4

            SettingsSectionView(title: "내 정보") {
                // 소셜 로그인이 아닌 경우에만 휴대폰 번호 표시
                if !isSocialLogin {
                    SettingsInfoRowView(icon: "phone.fill", iconColor: SMAPTheme.Color.primary, title: "휴대폰", value: user.mt_id ?? "-")
                    Divider().padding(.leading, 52)
                }
                SettingsInfoRowView(icon: "at", iconColor: .orange, title: "닉네임", value: user.mt_nickname ?? "-")
                Divider().padding(.leading, 52)
                SettingsInfoRowView(icon: "person.badge.key.fill", iconColor: .purple, title: "로그인 방식", value: getLoginMethodText(user.mt_type))
                Divider().padding(.leading, 52)
                SettingsInfoRowView(icon: "calendar", iconColor: .teal, title: "가입일", value: formatDate(user.mt_wdate))
            }
        }
    }

    private var logoutSection: some View {
        VStack(spacing: 0) {
            Button(action: { showingLogoutAlert = true }) {
                HStack(spacing: 12) {
                    // 로그아웃 아이콘
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(.white)
                        .frame(width: 28, height: 28)
                        .background(Color.red.opacity(0.8))
                        .cornerRadius(6)

                    Text("로그아웃")
                        .font(.suite(size: 16))
                        .foregroundColor(.red)

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color(UIColor.tertiaryLabel))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color(UIColor.systemBackground))
            }
        }
        .cornerRadius(12)
        .padding(.horizontal, 16)
    }

    private var withdrawLink: some View {
        NavigationLink(destination: WithdrawView()) {
            Text("회원탈퇴")
                .font(.suite(size: 14))
                .foregroundColor(.secondary)
        }
        .padding(.top, 8)
    }

    private var defaultAvatar: some View {
        Image(systemName: "person.circle.fill")
            .resizable()
            .frame(width: 90, height: 90)
            .foregroundColor(Color.gray.opacity(0.3))
    }

    private func uploadImage() {
        guard let image = inputImage else {
            print("❌ [AccountSettingsView] inputImage가 nil")
            return
        }
        guard let imageData = image.jpegData(compressionQuality: 0.7) else {
            print("❌ [AccountSettingsView] JPEG 변환 실패")
            return
        }

        print("📸 [AccountSettingsView] 이미지 업로드 시작 - 크기: \(imageData.count) bytes")
        isLoadingImage = true

        Task {
            do {
                let response = try await authService.uploadProfileImage(image: imageData)
                await MainActor.run {
                    isLoadingImage = false
                    if response.success {
                        print("✅ [AccountSettingsView] 이미지 업로드 성공")
                        inputImage = nil
                        // selectedImage는 유지 (성공 시 즉시 표시 유지)
                    } else {
                        print("❌ [AccountSettingsView] 서버 응답 실패: \(response.message)")
                        selectedImage = nil
                        inputImage = nil
                        imageUploadErrorMessage = response.message
                        showingImageUploadError = true
                    }
                }
            } catch {
                await MainActor.run {
                    isLoadingImage = false
                    inputImage = nil
                    selectedImage = nil // Revert on failure
                    print("❌ [AccountSettingsView] 프로필 이미지 업로드 실패: \(error)")
                    imageUploadErrorMessage = error.localizedDescription
                    showingImageUploadError = true
                }
            }
        }
    }

    private func getLoginMethodText(_ type: Int?) -> String {
        switch type {
        case 1: return "일반"
        case 2: return "카카오"
        case 3: return "Apple"
        case 4: return "Google"
        default: return "일반"
        }
    }

    private func formatDate(_ dateString: String?) -> String {
        guard let dateString = dateString else { return "-" }
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "yyyy.MM.dd"
            return displayFormatter.string(from: date)
        }
        return dateString.components(separatedBy: "T").first ?? dateString
    }
}

// MARK: - Settings Section Components

struct SettingsSectionView<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.suite(size: 13, weight: .medium))
                .foregroundColor(.secondary)
                .padding(.horizontal, 20)

            VStack(spacing: 0) {
                content
            }
            .background(Color(UIColor.systemBackground))
            .cornerRadius(12)
            .padding(.horizontal, 16)
        }
    }
}

struct SettingsRowView: View {
    let icon: String
    let iconColor: Color
    let title: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.white)
                .frame(width: 28, height: 28)
                .background(iconColor)
                .cornerRadius(6)

            Text(title)
                .font(.suite(size: 16))
                .foregroundColor(.primary)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color(UIColor.tertiaryLabel))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

struct SettingsInfoRowView: View {
    let icon: String
    let iconColor: Color
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.white)
                .frame(width: 28, height: 28)
                .background(iconColor)
                .cornerRadius(6)

            Text(title)
                .font(.suite(size: 16))
                .foregroundColor(.primary)

            Spacer()

            Text(value)
                .font(.suite(size: 15))
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(UIColor.systemBackground))
    }
}

struct PremiumBadgeCard: View {
    let title: String
    let value: String
    let icon: String
    let gradientColors: [Color]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .bold))
                Text(title)
                    .font(.suite(size: 12, weight: .medium))
            }
            .foregroundColor(.white.opacity(0.9))

            Text(value)
                .font(.suite(size: 18, weight: .bold))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            LinearGradient(colors: gradientColors, startPoint: .topLeading, endPoint: .bottomTrailing)
                .clipShape(RoundedRectangle(cornerRadius: 16))
        )
        .shadow(color: gradientColors.first?.opacity(0.3) ?? .clear, radius: 8, x: 0, y: 4)
    }
}

struct PremiumActionRow: View {
    let label: String
    let subtitle: String
    let icon: String
    let iconColor: Color

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(iconColor)
                .frame(width: 36, height: 36)
                .background(iconColor.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
                Text(subtitle)
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.gray.opacity(0.4))
        }
        .padding(14)
    }
}

struct AccountInfoRowV2: View {
    let label: String
    let value: String
    let icon: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(.gray)
                .frame(width: 36, height: 36)
                .background(Color.gray.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
                Text(value)
                    .font(.suite(size: 15, weight: .medium))
                    .foregroundColor(.primary)
            }

            Spacer()
        }
        .padding(14)
    }
}

struct AccountActionRow: View {
    let label: String
    let icon: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(.indigo)
                .frame(width: 24)

            Text(label)
                .font(.suite(size: 16))
                .foregroundColor(.primary)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.gray.opacity(0.3))
        }
        .padding()
    }
}

struct InfoBadgeCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.suite(size: 14))
                    .foregroundColor(color)
                Text(title)
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
            }

            Text(value)
                .font(.suite(size: 16, weight: .bold))
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.02), radius: 5, x: 0, y: 2)
    }
}

struct AccountInfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.suite(size: 15))
                .foregroundColor(.gray)
            Spacer()
            Text(value)
                .font(.suite(size: 15, weight: .medium))
                .foregroundColor(.primary)
        }
        .padding()
    }
}

struct TermsWebView: View {
    let title: String
    let url: String

    var body: some View {
        WebViewWrapper(urlString: url)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
    }
}

struct WebViewWrapper: UIViewRepresentable {
    let urlString: String

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        if let url = URL(string: urlString) {
            let request = URLRequest(url: url)
            uiView.load(request)
        }
    }
}
