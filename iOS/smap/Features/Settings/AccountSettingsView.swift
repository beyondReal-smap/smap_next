//
// AccountSettingsView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
// Settings menu, account settings screen, and related components
//

import SwiftUI
import WebKit
import Combine

// MARK: - Settings Menu View

public struct SettingMenuView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared
    @State private var showEmailChange = false

    /// 로그인한 회원의 이메일이 비어 있으면 미등록 (전화번호 가입 회원·소셜 회원 공통)
    private var isEmailMissing: Bool {
        guard let user = authService.currentUser else { return false }
        return (user.mt_email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                SMAPTheme.Adaptive.pageBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // 이메일 미등록 안내 — 설정 화면 상단에만 표시한다(홈·다른 탭에는 띄우지 않음).
                        if isEmailMissing {
                            VStack(spacing: SMAPTheme.Spacing.sm) {
                                SMAPBanner(message: "이메일을 등록해 주세요. 비밀번호를 잊었을 때 필요해요.")
                                SMAPButton("등록하기", style: .outline) { showEmailChange = true }
                                    .frame(maxWidth: 200)
                            }
                            .padding(.horizontal)
                        }

                        // Menu Sections
                        VStack(spacing: 24) {
                            SettingsMenuSectionView(title: "계정 관리", items: [
                                SettingsMenuItem(title: "계정설정", icon: "person.fill", color: .indigo, destination: AnyView(AccountSettingsView())),
                                SettingsMenuItem(title: "SMAP 프리미엄", icon: "crown.fill", color: SMAPTheme.Accent.crown, destination: AnyView(PremiumView()))
                            ])

                            SettingsMenuSectionView(title: "약관 & 정책", items: [
                                SettingsMenuItem(title: "서비스 이용약관", icon: "doc.text.fill", color: .teal, destination: AnyView(ServiceTermsView())),
                                SettingsMenuItem(title: "개인정보 처리방침", icon: "shield.fill", color: .cyan, destination: AnyView(PrivacyPolicyView())),
                                SettingsMenuItem(title: "위치기반서비스 이용약관", icon: "location.fill", color: .purple, destination: AnyView(LocationTermsView())),
                                SettingsMenuItem(title: "마케팅 정보 수집 및 이용 동의", icon: "star.fill", color: SMAPTheme.Color.primary, destination: AnyView(MarketingConsentView())),
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
                            // Bundle에서 직접 읽어 빌드 버전(MARKETING_VERSION)과 항상 일치시킨다.
                            // 하드코딩 시 버전 업마다 두 곳을 동기화해야 해 누락 위험.
                            Text("버전 \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")")
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
            .navigationDestination(isPresented: $showEmailChange) {
                EmailChangeView()
            }
            .task {
                // 이메일 등록 여부(미등록 배너)가 최신 서버 값을 따르도록 프로필을 갱신한다.
                do {
                    _ = try await authService.fetchUserProfile()
                } catch {
                    print("[SettingMenuView] 프로필 갱신 실패: \(type(of: error))")
                }
            }
        }
    }
}

// MARK: - Settings Menu Components

struct ProfileSummaryCard: View {
    let user: SMAPUser
    @ObservedObject private var storeKit = StoreKitManager.shared

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

                    // 구독 상태(is_premium)가 확정된 뒤에만 배지를 표시한다(로드 전에 "일반"으로 잘못 보이지 않게).
                    if let isPremium = storeKit.status?.is_premium {
                        Text(isPremium ? "프리미엄" : "일반")
                            .font(.suite(size: 10, weight: .bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.2))
                            .cornerRadius(10)
                            .foregroundColor(.white)
                    }
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
                gradient: Gradient(colors: [SMAPTheme.Color.primary, SMAPTheme.Accent.primarySoft]),
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
    @State private var showingWithdrawConfirm = false // 회원탈퇴 사전 확인
    @State private var isWithdrawActive = false       // 확인 후 이동 플래그

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
                HapticManager.shared.notification(type: .warning)
                authService.logout()
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
            _ = try? await authService.fetchUserProfile()
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
                        .font(.suite(size: 10, weight: .semibold))
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
                gradient: Gradient(colors: [SMAPTheme.Color.primary, SMAPTheme.Accent.primarySoft]),
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

            Divider().padding(.leading, 52)

            NavigationLink(destination: EmailChangeView()) {
                EmailSettingsRowView(email: authService.currentUser?.mt_email)
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
                        .font(.suite(size: 15, weight: .medium))
                        .foregroundColor(.white)
                        .frame(width: 28, height: 28)
                        .background(SMAPTheme.Color.error.opacity(0.8))
                        .cornerRadius(6)

                    Text("로그아웃")
                        .font(.suite(size: 16))
                        .foregroundColor(SMAPTheme.Color.error)

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.suite(size: 13, weight: .semibold))
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
        // Destructive 액션 — 실수로 탭하지 않도록 confirmation 경유.
        // 숨겨진 NavigationLink 를 통해 isActive 플래그로 이동 제어.
        ZStack {
            NavigationLink(isActive: $isWithdrawActive) {
                WithdrawView()
            } label: {
                EmptyView()
            }
            .hidden()

            Button {
                HapticManager.shared.impact(style: .medium)
                showingWithdrawConfirm = true
            } label: {
                Text("회원탈퇴")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .underline()
                    .frame(minHeight: 44) // HIG 터치 타겟
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("회원탈퇴")
            .accessibilityHint("계정 영구 삭제 화면으로 이동 전 확인이 표시됩니다")
        }
        .padding(.top, 8)
        .alert("회원탈퇴", isPresented: $showingWithdrawConfirm) {
            Button("취소", role: .cancel) {}
            Button("계속", role: .destructive) {
                isWithdrawActive = true
            }
        } message: {
            Text("계정 영구 삭제는 되돌릴 수 없습니다. 계속 진행하시겠습니까?")
        }
    }

    private var defaultAvatar: some View {
        Image(systemName: "person.circle.fill")
            .resizable()
            .frame(width: 90, height: 90)
            .foregroundColor(Color.gray.opacity(0.3))
    }

    private func uploadImage() {
        guard let image = inputImage,
              let imageData = image.jpegData(compressionQuality: 0.7) else {
            return
        }

        isLoadingImage = true
        HapticManager.shared.impact(style: .light)

        Task {
            do {
                let response = try await authService.uploadProfileImage(image: imageData)
                await MainActor.run {
                    isLoadingImage = false
                    if response.success {
                        HapticManager.shared.notification(type: .success)
                        inputImage = nil
                    } else {
                        HapticManager.shared.notification(type: .error)
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
                    selectedImage = nil
                    HapticManager.shared.notification(type: .error)
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
                .font(.suite(size: 15, weight: .medium))
                .foregroundColor(.white)
                .frame(width: 28, height: 28)
                .background(iconColor)
                .cornerRadius(6)

            Text(title)
                .font(.suite(size: 16))
                .foregroundColor(.primary)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.suite(size: 13, weight: .semibold))
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
                .font(.suite(size: 14, weight: .medium))
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
                    .font(.suite(size: 12, weight: .bold))
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
                .font(.suite(size: 20))
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
                .font(.suite(size: 14, weight: .semibold))
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
                .font(.suite(size: 14))
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
                .font(.suite(size: 16))
                .foregroundColor(.indigo)
                .frame(width: 24)

            Text(label)
                .font(.suite(size: 16))
                .foregroundColor(.primary)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.suite(size: 14, weight: .semibold))
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


// MARK: - 이메일 등록·변경 (로그인 상태)
// 전화번호로 가입한 기존 회원이 이메일을 등록하거나 바꾼다. 가입 화면의 이메일 인증 단계(RegisterPhoneView/
// RegisterVerificationView)와 같은 문구 톤·컴포넌트·간격을 쓴다. 새 Swift 파일을 추가할 수 없어 이 파일에 둔다.

/// 계정설정 목록의 "이메일" 행 — 현재 이메일을 오른쪽에 보여 주고, 없으면 "등록 필요"를 강조한다.
struct EmailSettingsRowView: View {
    let email: String?

    private var trimmedEmail: String { (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "envelope.fill")
                .font(.suite(size: 15, weight: .medium))
                .foregroundColor(.white)
                .frame(width: 28, height: 28)
                .background(Color.blue)
                .cornerRadius(6)
                .accessibilityHidden(true)

            Text("이메일")
                .font(SMAPTheme.Font.body)
                .foregroundStyle(SMAPTheme.Color.textPrimary)

            Spacer(minLength: SMAPTheme.Spacing.sm)

            if trimmedEmail.isEmpty {
                Text("등록 필요")
                    .font(SMAPTheme.Font.captionBold)
                    .foregroundStyle(SMAPTheme.Color.primary)
            } else {
                Text(trimmedEmail)
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Image(systemName: "chevron.right")
                .font(.suite(size: 13, weight: .semibold))
                .foregroundColor(Color(UIColor.tertiaryLabel))
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(trimmedEmail.isEmpty ? "이메일, 등록 필요" : "이메일, \(trimmedEmail)")
    }
}

/// 이메일 등록·변경 상태 관리 — 발송 여부, 쿨다운, 검증 토큰을 이 화면 안에서만 가진다.
/// 가입 ViewModel 규칙을 따른다: 이메일을 고치면 인증 상태 초기화, 늦게 온 이전 이메일의 응답은 무시.
@MainActor
final class EmailChangeViewModel: ObservableObject {
    enum Step { case enterEmail, enterCode }

    static let codeLifetimeSeconds = 600
    static let resendCooldownSeconds = 60

    @Published private(set) var step: Step = .enterEmail
    @Published private(set) var email = ""
    @Published private(set) var code = ""
    @Published private(set) var remainingSeconds = 0
    @Published private(set) var resendWaitSeconds = 0
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var isCompleted = false

    /// 현재 등록된 이메일(없으면 빈 문자열)
    let currentEmail: String

    private let authService: AuthService
    /// 인증 성공 후 받은 토큰 — 메모리에만 둔다. change 실패 시 재시도에 쓰고, 이메일 수정·화면 이탈 시 폐기.
    private var verificationToken: String?
    private var timer: AnyCancellable?

    init(authService: AuthService? = nil) {
        let authService = authService ?? AuthService.shared
        self.authService = authService
        self.currentEmail = (authService.currentUser?.mt_email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    deinit { timer?.cancel() }

    var normalizedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }

    var isEmailFormatValid: Bool {
        normalizedEmail.range(of: "^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", options: .regularExpression) != nil
    }

    var isSameAsCurrent: Bool { !currentEmail.isEmpty && normalizedEmail == currentEmail }

    var canSend: Bool { isEmailFormatValid && !isSameAsCurrent && !isLoading }
    var canResend: Bool { step == .enterCode && resendWaitSeconds == 0 && !isLoading }
    var canConfirm: Bool { step == .enterCode && code.count == 6 && !isLoading }

    var helperTextForEmail: String? {
        if isSameAsCurrent { return "현재 사용 중인 이메일이에요." }
        return nil
    }

    // MARK: 입력

    /// 이메일을 고치면 인증 상태를 모두 초기화한다.
    func updateEmail(_ value: String) {
        guard email != value else { return }
        email = value
        resetVerification()
        errorMessage = nil
    }

    func updateCode(_ value: String) {
        code = String(value.filter { $0.isNumber }.prefix(6))
    }

    /// 2단계 → 1단계 (이메일 수정). 인증 상태는 초기화된다.
    func backToEmail() {
        guard !isLoading else { return }
        resetVerification()
        errorMessage = nil
    }

    // MARK: 요청

    func sendCode() {
        guard canSend else { return }
        requestCode()
    }

    func resendCode() {
        guard canResend else { return }
        requestCode()
    }

    private func requestCode() {
        let target = normalizedEmail
        isLoading = true
        errorMessage = nil
        Task {
            defer { isLoading = false }
            do {
                let response = try await authService.sendChangeEmailCode(email: target)
                guard normalizedEmail == target else { return } // 그 사이 이메일이 바뀌었으면 무시
                guard response.success else { throw NetworkError.badRequest(nil) }
                verificationToken = nil
                code = ""
                step = .enterCode
                startTimers()
            } catch {
                guard normalizedEmail == target else { return }
                errorMessage = Self.message(for: error)
            }
        }
    }

    func confirm() {
        guard step == .enterCode, !isLoading else { return }
        guard remainingSeconds > 0 else {
            errorMessage = "인증번호가 만료됐어요. 다시 받아 주세요."
            return
        }
        guard code.count == 6 else {
            errorMessage = "인증번호 6자리를 입력해 주세요."
            return
        }
        let target = normalizedEmail
        let enteredCode = code
        isLoading = true
        errorMessage = nil
        Task {
            defer { isLoading = false }
            do {
                if verificationToken == nil {
                    let verified = try await authService.verifyChangeEmailCode(email: target, code: enteredCode)
                    guard normalizedEmail == target else { return }
                    guard verified.success, let token = verified.verification_token, !token.isEmpty else {
                        throw NetworkError.badRequest(nil)
                    }
                    verificationToken = token
                }
                guard let token = verificationToken else { return }
                let changed = try await authService.changeEmail(email: target, verificationToken: token)
                guard normalizedEmail == target else { return }
                guard changed.success else { throw NetworkError.badRequest(nil) }

                verificationToken = nil
                timer?.cancel()
                // 저장된 사용자 정보의 이메일을 서버 값으로 갱신해 설정 화면에 바로 반영한다.
                do {
                    _ = try await authService.fetchUserProfile()
                } catch {
                    print("[EmailChange] 프로필 갱신 실패(설정 화면 진입 시 다시 갱신됨): \(type(of: error))")
                }
                isCompleted = true
            } catch {
                guard normalizedEmail == target else { return }
                // 토큰이 거절된 경우(400/403)에는 새 인증이 필요하므로 폐기한다.
                if case NetworkError.badRequest? = error as? NetworkError { verificationToken = nil }
                if case NetworkError.forbidden? = error as? NetworkError { verificationToken = nil }
                errorMessage = Self.message(for: error)
            }
        }
    }

    // MARK: 내부

    private func resetVerification() {
        step = .enterEmail
        code = ""
        verificationToken = nil
        remainingSeconds = 0
        resendWaitSeconds = 0
        timer?.cancel()
    }

    private func startTimers() {
        remainingSeconds = Self.codeLifetimeSeconds
        resendWaitSeconds = Self.resendCooldownSeconds
        timer?.cancel()
        timer = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                if self.remainingSeconds > 0 { self.remainingSeconds -= 1 }
                if self.resendWaitSeconds > 0 { self.resendWaitSeconds -= 1 }
                if self.remainingSeconds == 0 && self.resendWaitSeconds == 0 { self.timer?.cancel() }
            }
    }

    /// 사용자에게 보이는 오류 문구 — HTTP 코드나 영문 예외를 노출하지 않는다.
    static func message(for error: Error) -> String {
        let temporary = "일시적인 오류예요. 잠시 후 다시 시도해 주세요."
        guard let networkError = error as? NetworkError else { return temporary }
        switch networkError {
        case .conflict:
            return "이미 다른 계정에서 사용 중인 이메일이에요."
        case .rateLimited:
            return "요청이 많아요. 잠시 후 다시 시도해 주세요."
        case .badRequest(let detail):
            if let detail, !detail.isEmpty { return detail }
            return "요청을 처리하지 못했어요. 다시 시도해 주세요."
        case .unauthorized:
            return "로그인이 만료됐어요. 다시 로그인해 주세요."
        case .forbidden:
            return "인증 정보가 올바르지 않아요. 인증번호를 다시 받아 주세요."
        default:
            return temporary
        }
    }
}

struct EmailChangeView: View {
    @StateObject private var viewModel = EmailChangeViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
                switch viewModel.step {
                case .enterEmail: emailStep
                case .enterCode: codeStep
                }

                if viewModel.isCompleted {
                    SMAPBanner(message: "이메일을 등록했어요.", tone: .success)
                        .padding(.top, SMAPTheme.Spacing.sm)
                } else if let message = viewModel.errorMessage {
                    SMAPBanner(message: message, tone: .error)
                        .padding(.top, SMAPTheme.Spacing.sm)
                }
            }
            .padding(SMAPTheme.Spacing.lg)
        }
        .background(SMAPTheme.Adaptive.pageBackground.ignoresSafeArea())
        .navigationTitle("이메일")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: goBack) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("뒤로")
                    }
                    .foregroundStyle(SMAPTheme.Color.textPrimary)
                }
                .disabled(viewModel.isLoading)
            }
        }
        // 성공 안내를 잠깐 보여 준 뒤 이전 화면으로 돌아간다.
        .task(id: viewModel.isCompleted) {
            guard viewModel.isCompleted else { return }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            dismiss()
        }
    }

    /// 상단 뒤로 — 2단계면 1단계로, 1단계면 화면을 닫는다.
    private func goBack() {
        if viewModel.step == .enterCode {
            viewModel.backToEmail()
        } else {
            dismiss()
        }
    }

    private var emailStep: some View {
        Group {
            Text(viewModel.currentEmail.isEmpty ? "이메일을 등록해 주세요" : "이메일을 변경해 주세요")
                .font(SMAPTheme.Font.title)
                .foregroundStyle(SMAPTheme.Color.textPrimary)
            Text(viewModel.currentEmail.isEmpty
                 ? "이메일을 등록하면 비밀번호를 잊었을 때 계정을 되찾을 수 있어요. 등록한 이메일로도 로그인할 수 있어요."
                 : "새 이메일로 인증하면 이메일이 변경돼요.")
                .font(SMAPTheme.Font.secondary)
                .foregroundStyle(SMAPTheme.Color.textSecondary)

            SMAPTextField(
                "name@example.com",
                text: Binding(get: { viewModel.email }, set: { viewModel.updateEmail($0) }),
                label: "이메일",
                helperText: viewModel.helperTextForEmail,
                keyboardType: .emailAddress,
                textContentType: .emailAddress
            )
            .disabled(viewModel.isLoading)
            .padding(.top, SMAPTheme.Spacing.md)

            SMAPButton("인증번호 받기", isLoading: viewModel.isLoading, isDisabled: !viewModel.canSend) {
                viewModel.sendCode()
            }
            .padding(.top, SMAPTheme.Spacing.md)
        }
    }

    private var codeStep: some View {
        let expired = viewModel.remainingSeconds <= 0
        return Group {
            Text("인증번호를 입력해 주세요")
                .font(SMAPTheme.Font.title)
                .foregroundStyle(SMAPTheme.Color.textPrimary)
            Text("\(viewModel.normalizedEmail)\n위 주소로 보낸 6자리 숫자를 입력해 주세요.")
                .font(SMAPTheme.Font.secondary)
                .foregroundStyle(SMAPTheme.Color.textSecondary)

            SMAPTextField(
                "6자리 숫자",
                text: Binding(get: { viewModel.code }, set: { viewModel.updateCode($0) }),
                label: "인증번호",
                helperText: expired ? nil : "남은 시간 \(timeString(viewModel.remainingSeconds))",
                errorMessage: expired ? "인증번호가 만료됐어요. 다시 받아 주세요." : nil,
                keyboardType: .numberPad,
                textContentType: .oneTimeCode
            )
            .padding(.top, SMAPTheme.Spacing.md)

            HStack {
                Text("메일이 오지 않았나요?")
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
                Spacer()
                Button {
                    viewModel.resendCode()
                } label: {
                    Text(viewModel.resendWaitSeconds > 0 ? "다시 받기 (\(viewModel.resendWaitSeconds)초)" : "인증번호 다시 받기")
                        .font(SMAPTheme.Font.secondaryMedium)
                        .foregroundStyle(viewModel.canResend ? SMAPTheme.Color.primary : SMAPTheme.Color.textSecondary)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .disabled(!viewModel.canResend)
            }

            SMAPBanner(message: "메일이 보이지 않으면 스팸함을 확인해 주세요.")

            SMAPButton("확인", isLoading: viewModel.isLoading, isDisabled: !viewModel.canConfirm || expired) {
                viewModel.confirm()
            }
            .padding(.top, SMAPTheme.Spacing.md)

            Button {
                viewModel.backToEmail()
            } label: {
                Text("이메일 수정")
                    .font(SMAPTheme.Font.secondaryMedium)
                    .foregroundStyle(SMAPTheme.Color.primary)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .disabled(viewModel.isLoading)
        }
    }

    private func timeString(_ time: Int) -> String {
        String(format: "%d:%02d", time / 60, time % 60)
    }
}

