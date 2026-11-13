//
// HomeHeaderView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - Home Subviews

struct HomeHeaderView: View {
    let groups: [SmapGroup]
    @Binding var selectedGroup: SmapGroup?
    let hasUnread: Bool
    let onSelect: (SmapGroup) -> Void
    let onNotificationTap: () -> Void
    let onSettingsTap: () -> Void

    var body: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("홈")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("그룹 멤버들과 실시간으로 소통해보세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }

            Spacer()

            // HIG: 최소 터치 타겟 44x44pt. 아이콘은 20pt지만 히트 영역은 Rectangle 로 확장.
            HStack(spacing: 4) {
                Button(action: {
                    onNotificationTap()
                }) {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(.gray)

                        if hasUnread {
                            Circle()
                                .fill(SMAPTheme.Accent.notificationDot)
                                .frame(width: 8, height: 8)
                                .offset(x: 2, y: -2)
                                .accessibilityHidden(true)
                        }
                    }
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
                }
                .accessibilityLabel("알림")
                .accessibilityValue(hasUnread ? "읽지 않은 알림 있음" : "")

                Button(action: {
                    onSettingsTap()
                }) {
                    Image(systemName: "gearshape.fill")
                        .font(.suite(size: 20))
                        .foregroundColor(.gray)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("설정")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            BlurView(style: .systemUltraThinMaterialLight)
                .ignoresSafeArea(edges: .top)
        )
    }
}

struct BlurView: UIViewRepresentable {
    var style: UIBlurEffect.Style
    func makeUIView(context: Context) -> UIVisualEffectView {
        return UIVisualEffectView(effect: UIBlurEffect(style: style))
    }
    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {
        uiView.effect = UIBlurEffect(style: style)
    }
}
