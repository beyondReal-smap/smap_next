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

            HStack(spacing: 0) {
                Button(action: {
                    onNotificationTap()
                }) {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(.gray)

                        if hasUnread {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 8, height: 8)
                                .offset(x: 2, y: -2)
                        }
                    }
                }
                .frame(width: 36, height: 44)

                Button(action: {
                    onSettingsTap()
                }) {
                    Image(systemName: "gearshape.fill")
                        .font(.suite(size: 20))
                        .foregroundColor(.gray)
                }
                .frame(width: 36, height: 44)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            BlurView(style: .systemUltraThinMaterialLight)
                .edgesIgnoringSafeArea(.top)
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
