//
// PlaceKindPicker.swift
// smap
//
// 장소를 저장할 때 아이콘을 고르는 칸(2026-11-20). 이름으로 짐작한 종류가 미리 골라져 있고, 누르면 바뀐다.
//

import SwiftUI

struct PlaceKindPicker: View {
    @Environment(\.smapAccent) private var accent
    let selected: PlaceKind
    let onSelect: (PlaceKind) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 5)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(PlaceKind.allCases, id: \.self) { kind in
                let isOn = kind == selected
                Button {
                    HapticManager.shared.impact(style: .light)
                    onSelect(kind)
                } label: {
                    VStack(spacing: 4) {
                        ZStack {
                            Circle().fill(isOn ? AnyShapeStyle(accent.gradient) : AnyShapeStyle(accent.container))
                            Image(systemName: kind.systemImage)
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(isOn ? Color.white : accent.base)
                        }
                        .frame(width: 44, height: 44)
                        Text(kind.label)
                            .font(isOn ? SMAPTheme.Font.captionBold : SMAPTheme.Font.caption)
                            .foregroundStyle(isOn ? SMAPTheme.Surface.onSurface : SMAPTheme.Surface.onSurfaceMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(kind.label) 아이콘")
                .accessibilityAddTraits(isOn ? .isSelected : [])
            }
        }
    }
}
