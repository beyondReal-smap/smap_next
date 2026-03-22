//
// HapticManager.swift
// smap
//
// Extracted from LoginView.swift
//

import UIKit

// MARK: - Haptic Feedback Manager

struct HapticManager {
    static let shared = HapticManager()

    private init() {}

    /// 가벼운 충격 (버튼 탭, 리프레시 등)
    func impact(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }

    /// 알림 유형 (성공, 경고, 에러)
    func notification(type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
    }

    /// 선택 변경 (피커, 리스트 선택 등)
    func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }
}
