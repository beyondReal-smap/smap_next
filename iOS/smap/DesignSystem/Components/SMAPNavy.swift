import SwiftUI

// MARK: - 남색 강조 디자인 (Android SmapHero.kt 와 같은 값)
//
// 36단계 재설계("회색 바탕 + 흰 행")가 밋밋하다는 피드백(2026-11-16)에 따라 화면마다 남색 그라데이션
// 시각적 중심을 하나 둔다. 색은 브랜드 남색 계열만 쓴다.

extension SMAPTheme {
    /// 재설계 화면 공용 색 — Android colorScheme 과 같은 값.
    enum Surface {
        static let canvas = SwiftUI.Color(red: 0xF4 / 255, green: 0xF5 / 255, blue: 0xF8 / 255)        // 회색 바탕
        static let card = SwiftUI.Color.white                                                            // 흰 묶음
        static let variant = SwiftUI.Color(red: 0xEE / 255, green: 0xF0 / 255, blue: 0xF4 / 255)       // 칩·빈 원
        static let outline = SwiftUI.Color(red: 0xD5 / 255, green: 0xD9 / 255, blue: 0xE0 / 255)
        static let divider = SwiftUI.Color(red: 0xE8 / 255, green: 0xEA / 255, blue: 0xEF / 255)
        static let onSurface = SwiftUI.Color(red: 0x11 / 255, green: 0x18 / 255, blue: 0x27 / 255)
        static let onSurfaceMuted = SwiftUI.Color(red: 0x6B / 255, green: 0x72 / 255, blue: 0x80 / 255)
        static let primaryContainer = SwiftUI.Color(red: 0xE8 / 255, green: 0xEB / 255, blue: 0xFB / 255)
        /// 남색 바탕 위 보조 글자
        static let onNavyMuted = SwiftUI.Color.white.opacity(0.72)
    }

    /// 브랜드 남색 그라데이션 — 짙은 남색 → 브랜드 → 밝은 남색.
    enum Navy {
        static let deep = SwiftUI.Color(red: 0x00 / 255, green: 0x0C / 255, blue: 0x78 / 255)
        static let base = SMAPTheme.Color.primary
        static let bright = SwiftUI.Color(red: 0x3D / 255, green: 0x55 / 255, blue: 0xEA / 255)

        /// 요약 카드·강조 아이콘·선택 상태
        static let gradient = LinearGradient(colors: [deep, base, bright], startPoint: .topLeading, endPoint: .bottomTrailing)
        /// 가로 방향만 변하는 그라데이션 — 위아래로 붙는 칸(시트 손잡이 띠·머리 줄)이 한 띠로 이어 보이게.
        static let band = LinearGradient(colors: [deep, base, bright], startPoint: .leading, endPoint: .trailing)
    }

    /// 아래에서 올라오는 시트 위쪽 모서리
    static let sheetRadius: CGFloat = 28
}

// MARK: - 요약 카드

/// 남색 그라데이션 요약 카드 — 탭 맨 위·상세 화면 맨 위의 시각적 중심. 오른쪽 위 옅은 원 두 개로 깊이감을 준다.
struct SMAPHeroCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0, content: content)
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                GeometryReader { geo in
                    ZStack {
                        SMAPTheme.Navy.gradient
                        Circle()
                            .fill(Color.white.opacity(0.08))
                            .frame(width: geo.size.width * 0.84)
                            .position(x: geo.size.width * 0.98, y: -geo.size.height * 0.05)
                        Circle()
                            .fill(Color.white.opacity(0.06))
                            .frame(width: geo.size.width * 0.44)
                            .position(x: geo.size.width * 0.80, y: geo.size.height * 1.02)
                    }
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .shadow(color: SMAPTheme.Navy.base.opacity(0.28), radius: 10, y: 4)
            .foregroundStyle(.white)
    }
}

/// 요약 카드 머리 — 작은 안내 줄 + 큰 제목 (+ 보조 줄).
struct SMAPHeroHeading: View {
    let eyebrow: String?
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let eyebrow {
                Text(eyebrow).font(SMAPTheme.Font.captionMedium).foregroundStyle(SMAPTheme.Surface.onNavyMuted).lineLimit(1)
            }
            Text(title)
                .font(SMAPTheme.Font.title)
                .foregroundStyle(.white)
                .lineLimit(2)
                .accessibilityAddTraits(.isHeader)
            if let subtitle, !subtitle.isEmpty {
                Text(subtitle).font(SMAPTheme.Font.caption).foregroundStyle(SMAPTheme.Surface.onNavyMuted).lineLimit(2)
            }
        }
    }
}

/// 요약 카드 아래쪽 숫자 칸 — 값(굵게) + 이름, 칸 사이 옅은 세로선.
struct SMAPHeroStats: View {
    let stats: [(value: String, label: String)]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(stats.enumerated()), id: \.offset) { index, stat in
                if index > 0 {
                    Rectangle().fill(Color.white.opacity(0.18)).frame(width: 1).padding(.vertical, 4)
                }
                VStack(spacing: 2) {
                    Text(stat.value).font(SMAPTheme.Font.headline).foregroundStyle(.white).lineLimit(1)
                    Text(stat.label).font(SMAPTheme.Font.captionSmall).foregroundStyle(SMAPTheme.Surface.onNavyMuted).lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .combine)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.top, SMAPTheme.Spacing.md)
    }
}

// MARK: - 버튼

/// 남색 그라데이션 원형 버튼 — 탭 맨 위 "추가"처럼 그 화면의 주 동작.
struct SMAPGradientIconButton: View {
    let systemImage: String
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(SMAPTheme.Navy.gradient, in: Circle())
                .shadow(color: SMAPTheme.Navy.base.opacity(0.35), radius: 6, y: 3)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}

/// 남색 머리 띠 위 주 동작 버튼 — 흰 알약 + 남색 글자·아이콘 (홈 "전체 보기", 내장소 "장소 추가").
struct SheetBandButton: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: systemImage).font(.system(size: 14, weight: .semibold))
                Text(title).font(SMAPTheme.Font.captionBold)
            }
            .foregroundStyle(SMAPTheme.Navy.base)
            .padding(.horizontal, 14)
            .frame(height: 40)
            .background(Color.white, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}
