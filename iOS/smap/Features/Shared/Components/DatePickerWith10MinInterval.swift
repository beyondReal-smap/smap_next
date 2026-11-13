//
// DatePickerWith10MinInterval.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI
import UIKit

// MARK: - Custom DatePicker with 10-minute intervals

/// UIKit의 UIDatePicker를 래핑하여 10분 단위 시간 선택 지원 + AtoZ(A2Z) 폰트 적용
struct DatePickerWith10MinInterval: UIViewRepresentable {
    @Binding var selection: Date
    var displayedComponents: DatePickerComponents
    var accentColor: Color

    struct DatePickerComponents: OptionSet {
        let rawValue: Int
        static let date = DatePickerComponents(rawValue: 1 << 0)
        static let hourAndMinute = DatePickerComponents(rawValue: 1 << 1)
    }

    func makeUIView(context: Context) -> UIDatePicker {
        let picker = UIDatePicker()
        picker.minuteInterval = 10 // 10분 단위
        picker.preferredDatePickerStyle = .compact
        picker.addTarget(context.coordinator, action: #selector(Coordinator.dateChanged(_:)), for: .valueChanged)

        applyAppFont(to: picker)

        return picker
    }

    func updateUIView(_ uiView: UIDatePicker, context: Context) {
        uiView.date = selection

        // displayedComponents에 따라 datePickerMode 설정
        if displayedComponents.contains(.date) && displayedComponents.contains(.hourAndMinute) {
            uiView.datePickerMode = .dateAndTime
        } else if displayedComponents.contains(.date) {
            uiView.datePickerMode = .date
        } else if displayedComponents.contains(.hourAndMinute) {
            uiView.datePickerMode = .time
        }

        uiView.tintColor = UIColor(accentColor)

        applyAppFont(to: uiView)
    }

    /// DatePicker 내부 UILabel에 앱 기본 폰트(AtoZ) Medium 적용.
    /// UIFont.suite는 AppStyles에서 A2Z 패밀리를 반환한다.
    private func applyAppFont(to view: UIView) {
        for subview in view.subviews {
            if let label = subview as? UILabel {
                label.font = .suite(size: label.font.pointSize, weight: .medium)
            }
            applyAppFont(to: subview)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject {
        var parent: DatePickerWith10MinInterval

        init(_ parent: DatePickerWith10MinInterval) {
            self.parent = parent
        }

        @objc func dateChanged(_ sender: UIDatePicker) {
            parent.selection = sender.date
            parent.applyAppFont(to: sender)
        }
    }
}
