import SwiftUI

// 화면 상태 3종(로딩 / 비어 있음 / 오류)과 인라인 배너.
// 조회 실패와 "데이터 없음"이 같은 빈 화면으로 보이던 문제를 없애기 위해, 오류에는 항상 다시 시도 동작을 준다.
// Android `ui/components/SmapStateViews.kt` 와 같은 규격이다.

struct SMAPLoadingView: View {
    var message: String?

    var body: some View {
        VStack(spacing: SMAPTheme.Spacing.md) {
            ProgressView()
                .controlSize(.large)
                .tint(SMAPTheme.Color.primary)
            if let message {
                Text(message)
                    .font(SMAPTheme.Font.secondary)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct SMAPEmptyState: View {
    let title: String
    var description: String?
    var systemImage: String = "tray"
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        SMAPStateLayout(
            systemImage: systemImage,
            tint: SMAPTheme.Color.textSecondary,
            title: title,
            description: description,
            actionTitle: actionTitle,
            action: action
        )
    }
}

struct SMAPErrorState: View {
    var title: String = "불러오지 못했어요"
    var description: String? = "네트워크 상태를 확인한 뒤 다시 시도해 주세요."
    var onRetry: (() -> Void)?

    var body: some View {
        SMAPStateLayout(
            systemImage: "wifi.exclamationmark",
            tint: SMAPTheme.Color.error,
            title: title,
            description: description,
            actionTitle: onRetry != nil ? "다시 시도" : nil,
            action: onRetry
        )
    }
}

private struct SMAPStateLayout: View {
    let systemImage: String
    let tint: Color
    let title: String
    let description: String?
    let actionTitle: String?
    let action: (() -> Void)?

    var body: some View {
        VStack(spacing: SMAPTheme.Spacing.sm) {
            Image(systemName: systemImage)
                .font(.system(size: 40))
                .foregroundStyle(tint)
                .padding(.bottom, SMAPTheme.Spacing.sm)
                .accessibilityHidden(true)
            Text(title)
                .font(SMAPTheme.Font.subheadline)
                .foregroundStyle(SMAPTheme.Color.textPrimary)
            if let description {
                Text(description)
                    .font(SMAPTheme.Font.secondary)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
            }
            if let actionTitle, let action {
                SMAPButton(actionTitle, style: .outline, action: action)
                    .frame(maxWidth: 200)
                    .padding(.top, SMAPTheme.Spacing.md)
            }
        }
        .multilineTextAlignment(.center)
        .padding(SMAPTheme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// 화면 안에 고정으로 보여주는 안내 배너(폼 상단 오류, 인증 메일 발송 안내 등).
/// 잠깐 떴다 사라지는 스낵바와 달리 사용자가 조치할 때까지 남아 있어야 하는 메시지에 쓴다.
struct SMAPBanner: View {
    enum Tone { case info, success, error }

    let message: String
    var tone: Tone = .info

    var body: some View {
        HStack(spacing: SMAPTheme.Spacing.sm) {
            // 색만으로 구분하지 않도록 아이콘도 함께 바꾼다.
            Image(systemName: iconName)
                .foregroundStyle(accent)
                .accessibilityHidden(true)
            Text(message)
                .font(SMAPTheme.Font.caption)
                .foregroundStyle(SMAPTheme.Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, SMAPTheme.Spacing.md)
        .padding(.vertical, 12)
        .background(accent.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
        .accessibilityElement(children: .combine)
    }

    private var accent: Color {
        switch tone {
        case .info: return SMAPTheme.Color.primary
        case .success: return SMAPTheme.Color.success
        case .error: return SMAPTheme.Color.error
        }
    }

    private var iconName: String {
        switch tone {
        case .info: return "info.circle"
        case .success: return "checkmark.circle"
        case .error: return "exclamationmark.circle"
        }
    }
}
