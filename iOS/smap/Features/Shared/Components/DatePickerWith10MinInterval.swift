//
// DatePickerWith10MinInterval.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

// MARK: - Custom DatePicker with 10-minute intervals

/// UIKit의 UIDatePicker를 래핑하여 10분 단위 시간 선택 지원 + SUITE 폰트 적용
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

        // SUITE 폰트를 DatePicker 내부 라벨에 적용
        applySuiteFont(to: picker)

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

        // accentColor 적용
        uiView.tintColor = UIColor(accentColor)

        // 폰트 재적용 (상태 변경 시)
        applySuiteFont(to: uiView)
    }

    /// SUITE 폰트를 DatePicker의 모든 UILabel에 적용
    private func applySuiteFont(to view: UIView) {
        for subview in view.subviews {
            if let label = subview as? UILabel {
                label.font = UIFont(name: "SUITE-Medium", size: label.font.pointSize) ?? label.font
            }
            applySuiteFont(to: subview)
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
            // 값 변경 후 폰트 재적용
            parent.applySuiteFont(to: sender)
        }
    }
}
