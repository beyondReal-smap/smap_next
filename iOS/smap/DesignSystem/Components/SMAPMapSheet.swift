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

/// 시트가 자리로 가는 움직임 — 펼침·접힘과 끌다 놓은 뒤 되돌아가는 움직임이 같은 곡선을 쓴다.
/// 0.5초 동안 처음엔 손을 이어받듯 움직이다 끝에서 천천히 내려앉는다(Android SheetSettleSpec 과 같은 값, 2026-11-19).
/// 이전 interactiveSpring(response 0.32)은 툭 올라가 가벼워 보였다.
private let sheetSettleDuration: TimeInterval = 0.5
private let sheetSettleAnimation = Animation.timingCurve(0.2, 0.75, 0.2, 1, duration: sheetSettleDuration)

/// 놓을 때 방향을 정하는 기준(Android SmapMapSheetState 와 같은 값).
private enum SheetDragRule {
    /// 이보다 빠르게 튕기면 움직인 거리와 상관없이 튕긴 방향으로(pt/s)
    static let flingVelocity: CGFloat = 300
    /// 이만큼만 움직여도 그 방향으로 끝까지(pt)
    static let directionSlop: CGFloat = 4
}

/// 아래에서 끌어올리는 지도 시트. 접힌 높이([peekHeight])에서도 핵심(멤버 얼굴 줄 등)이 보이고,
/// 손잡이·머리 띠를 끌어올리거나 누르면 화면의 [maxHeightFraction] 까지 펼쳐진다(지도 절반은 늘 보이게).
/// 내용이 더 길면 [content] 안의 ScrollView 가 스크롤한다.
struct SMAPMapSheet<Header: View, Content: View>: View {
    @Environment(\.smapAccent) private var accent
    let peekHeight: CGFloat
    @Binding var isExpanded: Bool
    var maxHeightFraction: CGFloat = 0.55
    var headerSurface: Color? = nil
    var keepsContentSize = false
    /// 손잡이에 이어지는 남색 머리 띠 안 내용 — 이 영역을 끌면 시트가 움직인다.
    @ViewBuilder var header: () -> Header
    /// 띠 아래 영역. 현재 펼침 비율과 시트 전환 동작을 전달한다.
    @ViewBuilder var content: (CGFloat, @escaping () -> Void) -> Content

    @GestureState private var isDragging = false
    @State private var dragTranslation: CGFloat = 0
    /// 펼침·접힘이 움직이는 중 — 이때 들어온 끌기·탭은 무시한다.
    @State private var isSettling = false
    /// 마지막으로 시작한 움직임 번호 — 앞선 움직임의 타이머가 뒤 움직임의 잠금을 풀지 않게.
    @State private var settleGeneration = 0

    var body: some View {
        GeometryReader { geo in
            let maxHeight = max(peekHeight, min(geo.size.height * maxHeightFraction, geo.size.height - 76))
            let base = isExpanded ? maxHeight : peekHeight
            let height = min(max(base - dragTranslation, peekHeight), maxHeight)
            let travel = maxHeight - peekHeight
            let expansionProgress = travel > 0 ? (height - peekHeight) / travel : 0

            VStack(spacing: 0) {
                VStack(spacing: 0) {
                    SheetHandle(color: headerSurface == nil ? .white.opacity(0.55) : .black.opacity(0.22))
                    header()
                        .frame(maxWidth: .infinity, minHeight: SMAPSheetMetrics.headerMinHeight, alignment: .leading)
                        .padding(.bottom, SMAPSheetMetrics.headerBandBottom)
                }
                .background(headerSurface.map { AnyShapeStyle($0) } ?? AnyShapeStyle(accent.band))
                .contentShape(Rectangle())
                // 펼침·접힘이 움직이는 동안은 이 끌기를 끈다(안쪽 버튼 등은 그대로) — 손이 닿아도 끝까지 간다.
                .gesture(dragGesture, including: isSettling ? .subviews : .all)
                .onTapGesture { toggle() }
                .onChange(of: isDragging) { _, dragging in
                    if !dragging { finishCancelledDrag() }
                }
                .accessibilityAction(named: isExpanded ? "시트 접기" : "시트 펼치기") { toggle() }

                content(expansionProgress, toggle)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .scrollDisabled(keepsContentSize && isSettling)
            }
            // 콘텐츠는 펼친 높이에서 배치하고 시트의 보이는 높이만 바꾼다.
            .frame(height: keepsContentSize ? maxHeight : nil, alignment: .top)
            .frame(height: height, alignment: .top)
            .background(SMAPTheme.Surface.card)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: SMAPTheme.sheetRadius, topTrailingRadius: SMAPTheme.sheetRadius, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 12, y: -2)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .animation(sheetSettleAnimation, value: isExpanded)
        }
    }

    private func toggle() {
        guard !isSettling else { return }
        HapticManager.shared.selection()
        settle(expanded: !isExpanded)
    }

    /// [expanded] 자리까지 끝까지 움직인다. 움직이는 동안([isSettling])은 끌기·탭을 받지 않아 중간에 멈추지 않는다.
    private func settle(expanded: Bool) {
        isSettling = true
        settleGeneration += 1
        let generation = settleGeneration
        withAnimation(sheetSettleAnimation) {
            dragTranslation = 0
            isExpanded = expanded
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + sheetSettleDuration) {
            if settleGeneration == generation { isSettling = false }
        }
    }

    /// 놓은(또는 시스템이 끌기를 가져간) 순간 방향을 정한다(2026-11-17). 이전에는 "예상 도착점이 절반을 넘어야" 펼쳐져서
    /// 조금 올리다 놓으면 제자리로 튕겨 돌아갔다.
    ///  1) 놓을 때 뚜렷하게 튕겼으면 그 방향  2) 아니면 움직인 방향  3) 거의 안 움직였으면 그대로
    /// [moved]·[velocity] 는 아래가 + (pt, pt/s).
    private func finishDrag(moved: CGFloat, velocity: CGFloat) {
        let shouldExpand: Bool
        if abs(velocity) >= SheetDragRule.flingVelocity {
            shouldExpand = velocity < 0
        } else if abs(moved) >= SheetDragRule.directionSlop {
            shouldExpand = moved < 0
        } else {
            shouldExpand = isExpanded
        }
        if shouldExpand != isExpanded { HapticManager.shared.selection() }
        settle(expanded: shouldExpand)
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 6, coordinateSpace: .global)
            .updating($isDragging) { _, state, _ in state = true }
            .onChanged { dragTranslation = $0.translation.height }
            .onEnded { finishDrag(moved: $0.translation.height, velocity: $0.velocity.height) }
    }

    /// 시스템이 드래그를 취소해 onEnded가 오지 않아도 마지막 드래그 위치부터 마무리한다.
    private func finishCancelledDrag() {
        DispatchQueue.main.async {
            guard !isDragging, !isSettling, dragTranslation != 0 else { return }
            finishDrag(moved: dragTranslation, velocity: 0)
        }
    }
}

/// 손잡이 — 남색 띠 위 흰 막대. 바로 아래 머리 줄과 같은 띠로 이어져 시트 위쪽이 남색 머리로 보인다.
private struct SheetHandle: View {
    let color: Color

    var body: some View {
        Capsule()
            .fill(color)
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
    @Environment(\.smapAccent) private var accent
    let groupName: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: "person.2.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(accent.base)
                Text(groupName ?? "그룹 선택")
                    .font(SMAPTheme.Font.captionBold)
                    .foregroundStyle(SMAPTheme.Surface.onSurface)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
            }
            .padding(.horizontal, 10)
            .frame(height: 34)
            .background(Color.white, in: Capsule())
            .shadow(color: .black.opacity(0.14), radius: 4, y: 2)
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(maxWidth: 240, alignment: .leading)
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
    @Environment(\.smapAccent) private var accent
    let groups: [SmapGroup]
    let selectedGroupId: Int?
    let onSelect: (SmapGroup) -> Void
    var onCreateGroup: (() -> Void)? = nil
    var compact: Bool = false
    @Environment(\.dismiss) private var dismiss

    private var detents: Set<PresentationDetent> {
        guard compact else { return [.medium, .large] }
        let rowCount = groups.count + (onCreateGroup == nil ? 0 : 1)
        if rowCount <= 2 {
            return [.height(72 + CGFloat(rowCount) * 60)]
        }
        return [.custom(CompactGroupPickerDetent.self)]
    }

    var body: some View {
        Group {
            if compact {
                groupList.presentationBackground(SMAPTheme.Surface.card)
            } else {
                groupList
            }
        }
        .presentationDetents(detents)
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(SMAPTheme.sheetRadius)
    }

    private var groupList: some View {
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
                                    .foregroundStyle(accent.base)
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
    }
}


private struct CompactGroupPickerDetent: CustomPresentationDetent {
    static func height(in context: Context) -> CGFloat? {
        min(320, context.maxDetentValue * 0.44)
    }
}
