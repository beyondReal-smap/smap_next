//
// DatePickerWith10MinInterval.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI
import UIKit

// MARK: - Custom DatePicker with 10-minute intervals

/// UIKit의 UIDatePicker를 래핑하여 10분 단위 시간 선택 지원 + 앱 글꼴(SUITE) 적용
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
        applyMode(to: picker) // 크기를 재기 전에 모드가 정해져 있어야 날짜·시각 버튼 폭이 나온다
        picker.addTarget(context.coordinator, action: #selector(Coordinator.dateChanged(_:)), for: .valueChanged)

        applyAppFont(to: picker)

        return picker
    }

    func updateUIView(_ uiView: UIDatePicker, context: Context) {
        uiView.date = selection

        applyMode(to: uiView)

        uiView.tintColor = UIColor(accentColor)

        applyAppFont(to: uiView)
    }

    /// DatePicker 내부 UILabel에 앱 기본 폰트(SUITE) Medium 적용.
    private func applyAppFont(to view: UIView) {
        for subview in view.subviews {
            if let label = subview as? UILabel {
                label.font = .suite(size: label.font.pointSize, weight: .medium)
            }
            applyAppFont(to: subview)
        }
    }

    /// displayedComponents 에 따라 datePickerMode 설정
    private func applyMode(to picker: UIDatePicker) {
        if displayedComponents.contains(.date) && displayedComponents.contains(.hourAndMinute) {
            picker.datePickerMode = .dateAndTime
        } else if displayedComponents.contains(.date) {
            picker.datePickerMode = .date
        } else if displayedComponents.contains(.hourAndMinute) {
            picker.datePickerMode = .time
        }
    }

    /// 날짜·시각 버튼이 들어가는 만큼의 크기로 놓는다 — 없으면 SwiftUI 가 1pt 로 잡아 빈 캡슐만 보였다.
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UIDatePicker, context: Context) -> CGSize? {
        uiView.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
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
