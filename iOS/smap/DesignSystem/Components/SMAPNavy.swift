import SwiftUI

// MARK: - 남색 강조 디자인 (Android SmapHero.kt 와 같은 값)
//
// 36단계 재설계("회색 바탕 + 흰 행")가 밋밋하다는 피드백(2026-11-16)에 따라 화면마다 남색 그라데이션
// 시각적 중심을 하나 둔다. 색은 브랜드 남색 계열만 쓴다.

extension SMAPTheme {
    enum Family {
        static let paper = SwiftUI.Color(red: 0xF4 / 255, green: 0xF8 / 255, blue: 0xFC / 255)
        static let ink = SwiftUI.Color(red: 0x29 / 255, green: 0x4F / 255, blue: 0x77 / 255)
        static let highlight = SwiftUI.Color(red: 0xFF / 255, green: 0xDB / 255, blue: 0xBC / 255)
        static let muted = SwiftUI.Color(red: 0x53 / 255, green: 0x67 / 255, blue: 0x7C / 255)
    }

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

// MARK: - 메뉴·멤버 강조색

/// 메뉴 강조색 한 벌 — 짙은 색 → 기준 색 → 밝은 색 그라데이션 + 옅은 바탕(아이콘 원·칩).
struct SMAPAccent {
    let deep: Color
    let base: Color
    let bright: Color
    let container: Color

    /// 요약 카드·강조 아이콘·선택 상태
    var gradient: LinearGradient { LinearGradient(colors: [deep, base, bright], startPoint: .topLeading, endPoint: .bottomTrailing) }
    /// 가로 방향만 변하는 그라데이션 — 위아래로 붙는 칸(시트 손잡이 띠·머리 줄)이 한 띠로 이어 보이게.
    var band: LinearGradient { LinearGradient(colors: [deep, base, bright], startPoint: .leading, endPoint: .trailing) }

    private static func rgb(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }

    static let navy = SMAPAccent(deep: SMAPTheme.Navy.deep, base: SMAPTheme.Navy.base, bright: SMAPTheme.Navy.bright, container: SMAPTheme.Surface.primaryContainer)
    static let teal = SMAPAccent(deep: rgb(0x0B4F4A), base: rgb(0x0F766E), bright: rgb(0x0D9488), container: rgb(0xE1F3F1))
    static let orange = SMAPAccent(deep: rgb(0x9A3412), base: rgb(0xC2410C), bright: rgb(0xEA580C), container: rgb(0xFCEBDD))
    static let purple = SMAPAccent(deep: rgb(0x4C1D95), base: rgb(0x6D28D9), bright: rgb(0x8B5CF6), container: rgb(0xEEE8FD))
    static let rose = SMAPAccent(deep: rgb(0x9F1239), base: rgb(0xBE185D), bright: rgb(0xDB2777), container: rgb(0xFBE6EF))

    static let family = SMAPAccent(deep: rgb(0x26496E), base: rgb(0x345F8C), bright: rgb(0x416996), container: rgb(0xE3EDF8))
    static let schedule = SMAPAccent(deep: rgb(0x2D4863), base: rgb(0x365B80), bright: rgb(0x3C6083), container: rgb(0xF9E8D9))
    static let places = SMAPAccent(deep: rgb(0x284B63), base: rgb(0x37627B), bright: rgb(0x406A81), container: rgb(0xE2EFF4))
    static let activity = SMAPAccent(deep: rgb(0x344968), base: rgb(0x495E83), bright: rgb(0x516789), container: rgb(0xE6ECF6))

    static func forTab(_ index: Int) -> SMAPAccent {
        switch index {
        case 2: return .schedule
        case 3: return .places
        case 4: return .activity
        default: return .family
        }
    }
}

private struct SMAPAccentKey: EnvironmentKey {
    static let defaultValue = SMAPAccent.family
}

extension EnvironmentValues {
    /// 지금 메뉴의 강조색. 홈·설정의 가족 강조색을 기본값으로 사용한다.
    var smapAccent: SMAPAccent {
        get { self[SMAPAccentKey.self] }
        set { self[SMAPAccentKey.self] = newValue }
    }
}

extension View {
    /// 이 아래 화면 전체의 강조색 — 공용 부품 색과 시스템 컨트롤(토글·날짜 선택 등) tint 를 함께 바꾼다.
    func smapAccent(_ accent: SMAPAccent) -> some View {
        environment(\.smapAccent, accent).tint(accent.base)
    }
}

// MARK: - 요약 카드

/// 남색 그라데이션 요약 카드 — 탭 맨 위·상세 화면 맨 위의 시각적 중심. 오른쪽 위 옅은 원 두 개로 깊이감을 준다.
struct SMAPHeroCard<Content: View>: View {
    @Environment(\.smapAccent) private var accent
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0, content: content)
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                GeometryReader { geo in
                    ZStack {
                        accent.gradient
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
                // 장식 원은 카드 밖으로 삐져나간다. clipShape 는 그림만 자르고 누름 영역은 자르지 않아
                // 카드 바로 아래 버튼(예: 그룹 탭 "+ 새 그룹")의 누름을 가로챌 수 있다 — 장식은 누름을 받지 않게 한다.
                .allowsHitTesting(false)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .shadow(color: accent.base.opacity(0.28), radius: 10, y: 4)
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
    @Environment(\.smapAccent) private var accent
    let systemImage: String
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(accent.gradient, in: Circle())
                .shadow(color: accent.base.opacity(0.35), radius: 6, y: 3)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}

/// 남색 머리 띠 위 주 동작 버튼 — 흰 알약 + 남색 글자·아이콘 (홈 "전체 보기", 내장소 "장소 추가").
struct SheetBandButton: View {
    @Environment(\.smapAccent) private var accent
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: systemImage).font(.system(size: 14, weight: .semibold))
                Text(title).font(SMAPTheme.Font.captionBold)
            }
            .foregroundStyle(accent.base)
            .padding(.horizontal, 14)
            .frame(height: 40)
            .background(Color.white, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct SMAPFamilyCover<Content: View>: View {
    let image: String
    var minHeight: CGFloat = 160
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .frame(minHeight: minHeight, alignment: .bottomLeading)
            .background {
                GeometryReader { geometry in
                    Image(image).resizable().scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                        .overlay(LinearGradient(colors: [.black.opacity(0.08), .black.opacity(0.8)], startPoint: .top, endPoint: .bottom))
                        .accessibilityHidden(true)
                }
            }
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}
