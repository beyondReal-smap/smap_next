import SwiftUI

// MARK: - 지도 탭 공용 시트 (Android SmapMapSheetScaffold 이식)
//
// 지도 탭(홈·내장소·활동 로그)은 지도를 화면 전체에 깔고, 조작은 아래에서 끌어올리는 시트 하나에 모은다.
// 이전에는 탭마다 모양이 다른 왼쪽 사이드바를 떠 있는 버튼으로 열어야 멤버를 고를 수 있었고, 열면 지도가 가려졌다.
// 시스템 .sheet 는 탭바·다른 시트(그룹 선택 등)와 겹쳐 쓸 수 없어 화면 안에 직접 그린다.

enum SMAPSheetMetrics {
    /// 머리 띠 아래 여백 — 각 시트의 접힌 높이에 이만큼 더한다.
    static let headerBandBottom: CGFloat = 8
    /// 머리 줄 최소 높이(띠 안)
    static let headerMinHeight: CGFloat = 48
    /// 남색 띠와 그 아래 첫 줄(멤버 얼굴 줄·날짜 줄) 사이 흰 여백
    static let headerBandGap: CGFloat = 14
    /// 그룹 알약 줄 위아래 여백 — 지도 탭과 일정 탭이 같아야 탭을 바꿔도 알약이 제자리다.
    static let topControlsVerticalPadding: CGFloat = 10
}

/// 아래에서 끌어올리는 지도 시트. 접힌 높이([peekHeight])에서도 핵심(멤버 얼굴 줄 등)이 보이고,
/// 손잡이·머리 띠를 끌어올리거나 누르면 화면의 [maxHeightFraction] 까지 펼쳐진다(지도 절반은 늘 보이게).
/// 내용이 더 길면 [content] 안의 ScrollView 가 스크롤한다.
struct SMAPMapSheet<Header: View, Content: View>: View {
    let peekHeight: CGFloat
    @Binding var isExpanded: Bool
    var maxHeightFraction: CGFloat = 0.55
    /// 손잡이에 이어지는 남색 머리 띠 안 내용 — 이 영역을 끌면 시트가 움직인다.
    @ViewBuilder var header: () -> Header
    /// 띠 아래 흰 영역
    @ViewBuilder var content: () -> Content

    @GestureState private var dragTranslation: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let maxHeight = max(peekHeight, min(geo.size.height * maxHeightFraction, geo.size.height - 76))
            let base = isExpanded ? maxHeight : peekHeight
            let height = min(max(base - dragTranslation, peekHeight), maxHeight)

            VStack(spacing: 0) {
                VStack(spacing: 0) {
                    SheetHandle()
                    header()
                        .frame(maxWidth: .infinity, minHeight: SMAPSheetMetrics.headerMinHeight, alignment: .leading)
                        .padding(.bottom, SMAPSheetMetrics.headerBandBottom)
                }
                .background(SMAPTheme.Navy.band)
                .contentShape(Rectangle())
                .gesture(dragGesture(maxHeight: maxHeight))
                .onTapGesture { toggle() }
                .accessibilityAction(named: isExpanded ? "시트 접기" : "시트 펼치기") { toggle() }

                content()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
            .frame(height: height, alignment: .top)
            .background(SMAPTheme.Surface.card)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: SMAPTheme.sheetRadius, topTrailingRadius: SMAPTheme.sheetRadius, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 12, y: -2)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .animation(.interactiveSpring(response: 0.32, dampingFraction: 0.86), value: isExpanded)
        }
    }

    private func toggle() {
        HapticManager.shared.selection()
        isExpanded.toggle()
    }

    private func dragGesture(maxHeight: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 6)
            .updating($dragTranslation) { value, state, _ in state = value.translation.height }
            .onEnded { value in
                // 놓은 위치와 손을 뗄 때의 속도(predicted)로 펼침/접힘을 정한다.
                let base = isExpanded ? maxHeight : peekHeight
                let projected = base - value.predictedEndTranslation.height
                let shouldExpand = projected > (peekHeight + maxHeight) / 2
                if shouldExpand != isExpanded { HapticManager.shared.selection() }
                isExpanded = shouldExpand
            }
    }
}

/// 손잡이 — 남색 띠 위 흰 막대. 바로 아래 머리 줄과 같은 띠로 이어져 시트 위쪽이 남색 머리로 보인다.
private struct SheetHandle: View {
    var body: some View {
        Capsule()
            .fill(Color.white.opacity(0.55))
            .frame(width: 36, height: 4)
            .frame(maxWidth: .infinity)
            .padding(.top, 7)
            .padding(.bottom, 5)
            .accessibilityHidden(true)
    }
}

// MARK: - 지도 위 조작

/// 지도 위에 떠 있는 흰 원형 버튼. [badge] 면 오른쪽 위에 빨간 점(읽지 않은 알림 등).
struct MapCircleButton: View {
    let systemImage: String
    let accessibilityLabel: String
    var badge: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(SMAPTheme.Surface.onSurface)
                .frame(width: 44, height: 44)
                .background(Color.white, in: Circle())
                .shadow(color: .black.opacity(0.14), radius: 4, y: 2)
                .overlay(alignment: .topTrailing) {
                    if badge {
                        Circle().fill(SMAPTheme.Accent.notificationDot).frame(width: 9, height: 9).padding(6)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(badge ? "\(accessibilityLabel), 읽지 않은 항목 있음" : accessibilityLabel)
    }
}

/// 지도 왼쪽 위 그룹 전환 알약. 이전에는 사이드바를 열고 드롭다운을 눌러야 그룹을 바꿀 수 있었다.
struct GroupSwitcherPill: View {
    let groupName: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "person.2.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(SMAPTheme.Navy.base)
                Text(groupName ?? "그룹 선택")
                    .font(SMAPTheme.Font.captionBold)
                    .foregroundStyle(SMAPTheme.Surface.onSurface)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
            }
            .padding(.leading, 14)
            .padding(.trailing, 12)
            .frame(height: 44)
            .frame(maxWidth: 240)
            .background(Color.white, in: Capsule())
            .shadow(color: .black.opacity(0.14), radius: 4, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("그룹 \(groupName ?? "선택"), 눌러서 바꾸기")
    }
}

/// 지도 위 떠 있는 조작 줄 — 왼쪽 그룹 알약, 오른쪽 원형 버튼들.
struct MapTopControls<Actions: View>: View {
    let groupName: String?
    let onGroupTap: () -> Void
    @ViewBuilder var actions: () -> Actions

    var body: some View {
        HStack(spacing: SMAPTheme.Spacing.sm) {
            GroupSwitcherPill(groupName: groupName, action: onGroupTap)
            Spacer(minLength: 0)
            actions()
        }
        .padding(.horizontal, SMAPTheme.Spacing.md)
        .padding(.vertical, SMAPSheetMetrics.topControlsVerticalPadding)
    }
}

extension MapTopControls where Actions == EmptyView {
    init(groupName: String?, onGroupTap: @escaping () -> Void) {
        self.init(groupName: groupName, onGroupTap: onGroupTap) { EmptyView() }
    }
}

/// 상태 표시줄 아이콘이 지도 글자와 섞이지 않게 지도 위쪽에 까는 옅은 흰 막.
struct MapTopScrim: View {
    var body: some View {
        LinearGradient(
            stops: [
                .init(color: .white.opacity(0.92), location: 0),
                .init(color: .white.opacity(0.6), location: 0.6),
                .init(color: .white.opacity(0), location: 1),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .allowsHitTesting(false)
    }
}

/// 그룹 선택 시트 — 지도 탭과 일정 탭 공용. [onCreateGroup] 이 있으면 맨 아래 "새 그룹 만들기" 행.
struct GroupPickerSheet: View {
    let groups: [SmapGroup]
    let selectedGroupId: Int?
    let onSelect: (SmapGroup) -> Void
    var onCreateGroup: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("그룹")
                    .font(SMAPTheme.Font.headline)
                    .foregroundStyle(SMAPTheme.Surface.onSurface)
                    .padding(.horizontal, 20)
                    .padding(.top, 24)
                    .padding(.bottom, SMAPTheme.Spacing.sm)
                    .accessibilityAddTraits(.isHeader)
                ForEach(groups) { group in
                    let isSelected = group.sgt_idx == selectedGroupId
                    SMAPListRow(
                        title: group.sgt_title ?? "이름 없는 그룹",
                        subtitle: group.member_count.map { "멤버 \($0)명" },
                        action: {
                            onSelect(group)
                            dismiss()
                        },
                        leading: { SMAPRowIcon(systemImage: "person.2.fill", emphasized: isSelected) },
                        trailing: {
                            if isSelected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(SMAPTheme.Navy.base)
                                    .accessibilityLabel("선택됨")
                            }
                        }
                    )
                }
                if let onCreateGroup {
                    SMAPRowDivider(inset: false)
                    SMAPListRow(
                        title: "새 그룹 만들기",
                        action: {
                            dismiss()
                            onCreateGroup()
                        },
                        leading: {
                            Image(systemName: "plus")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                                .frame(width: 40, height: 40)
                                .background(SMAPTheme.Surface.variant, in: Circle())
                        }
                    )
                }
            }
            .padding(.bottom, SMAPTheme.Spacing.md)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(SMAPTheme.sheetRadius)
    }
}
