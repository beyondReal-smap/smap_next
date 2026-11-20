import SwiftUI

// MARK: - 내장소 지도 시트 (Android MyPlaceSheet.kt 이식)
//
// 사이드바("장소 관리")·떠 있는 멤버 버튼을 대신한다.
// 접힌 시트에서 장소를 바로 열고, 펼치면 멤버 선택과 도착 알림을 관리한다.

enum MyPlaceSheet {
    static let peekHeight: CGFloat = 140
}

/// 머리 띠 안 — 누구의 장소인지·몇 곳인지 + 장소 추가
struct MyPlaceSheetHeader: View {
    @ObservedObject var viewModel: MyPlaceViewModel
    let currentUserIdx: Int?
    let onAddTap: () -> Void

    var body: some View {
        HStack(spacing: SMAPTheme.Spacing.sm) {
            Image(systemName: "map.fill")
                .font(.system(size: 22, weight: .semibold)).foregroundStyle(SMAPTheme.Family.ink)
                .frame(width: 48, height: 48).background(SMAPTheme.Family.highlight, in: RoundedRectangle(cornerRadius: 14))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(owner) 장소")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundStyle(SMAPTheme.Family.ink)
                    .lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                Text(subtitle)
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Family.ink.opacity(0.80))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if viewModel.canAddToSelectedMember {
                SheetBandButton(title: "장소 추가", systemImage: "plus", action: onAddTap)
            }
        }
        .padding(.leading, 20)
        .padding(.trailing, SMAPTheme.Spacing.md)
    }

    private var owner: String {
        guard let member = viewModel.selectedMember, member.mt_idx != currentUserIdx else { return "내" }
        return "\(member.displayName)의"
    }

    private var subtitle: String {
        if viewModel.isLoadingLocations { return "불러오는 중…" }
        if viewModel.locations.isEmpty { return "아직 등록한 장소가 없어요" }
        return "저장 \(viewModel.locations.count)곳 · 도착 알림 \(viewModel.locations.filter { $0.slt_enter_alarm == "Y" }.count)곳"
    }
}

/// 장소 바로가기와 멤버별 장소 목록
struct MyPlaceSheetBody: View {
    @Environment(\.smapAccent) private var accent
    @ObservedObject var viewModel: MyPlaceViewModel
    let currentUserIdx: Int?
    let isExpanded: Bool
    let onToggle: () -> Void
    let onSelectLocation: (SavedLocation) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    Button(action: onToggle) {
                        Label(isExpanded ? "목록 접기" : "멤버·장소 보기", systemImage: "list.bullet")
                            .font(SMAPTheme.Font.captionBold).padding(.horizontal, 14).frame(minHeight: 44)
                            .foregroundStyle(.white).background(SMAPTheme.Family.ink, in: Capsule())
                    }
                    if !viewModel.isLoadingLocations {
                        ForEach(viewModel.locations) { location in
                            Button { onSelectLocation(location) } label: {
                                Label(location.name, systemImage: location.kind.systemImage)
                                    .font(SMAPTheme.Font.captionBold).lineLimit(1)
                                    .padding(.horizontal, 14).frame(minHeight: 44)
                                    .foregroundStyle(SMAPTheme.Family.ink).background(.white, in: Capsule())
                                    .overlay { Capsule().strokeBorder(SMAPTheme.Family.ink.opacity(0.18)) }
                            }
                        }
                    }
                }
                .buttonStyle(.plain)
                .padding(.horizontal, SMAPTheme.Spacing.md)
            }
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SMAPTheme.Family.paper)

            ScrollView {
                VStack(alignment: .leading, spacing: SMAPTheme.Spacing.md) {
                    MemberStrip(
                        members: viewModel.members.map {
                            MemberStripItem(id: $0.mt_idx, name: $0.displayName, imagePath: $0.mt_file1, isMe: $0.mt_idx == currentUserIdx)
                        },
                        selectedId: viewModel.selectedMember?.mt_idx,
                        onSelect: { item in
                            if let member = viewModel.members.first(where: { $0.mt_idx == item.id }) { viewModel.selectMember(member) }
                        }
                    )
                    if viewModel.isLoadingLocations {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(SMAPTheme.Spacing.xl)
                    } else if viewModel.locations.isEmpty {
                        SMAPSection {
                            SMAPListRow(
                                title: "등록된 장소가 없어요",
                                subtitle: viewModel.canAddToSelectedMember
                                    ? "집·학교·회사를 등록하면 도착할 때 알려 드려요.\n지도를 눌러도 추가할 수 있어요."
                                    : "이 멤버가 등록한 장소가 아직 없어요.",
                                leading: { SMAPRowIcon(systemImage: "mappin.and.ellipse") }
                            )
                        }
                    } else {
                        SMAPSection(title: "저장한 장소") {
                            ForEach(Array(viewModel.locations.enumerated()), id: \.element.id) { index, location in
                                if index > 0 { SMAPRowDivider() }
                                locationRow(location)
                            }
                        }
                    }
                }
                .padding(SMAPTheme.Spacing.md)
                .padding(.bottom, SMAPTheme.Spacing.lg)
            }
            .background(SMAPTheme.Surface.canvas)
        }
    }

    private func locationRow(_ location: SavedLocation) -> some View {
        let alarmOn = location.slt_enter_alarm == "Y"
        return SMAPListRow(
            title: location.name,
            subtitle: location.address,
            selected: viewModel.selectedLocation?.slt_idx == location.slt_idx,
            action: { onSelectLocation(location) },
            leading: { SMAPRowIcon(systemImage: location.kind.systemImage, emphasized: true) },
            trailing: {
                if viewModel.canManageLocation(location) {
                    Button {
                        Task { await viewModel.toggleNotification(for: location) }
                    } label: {
                        Image(systemName: alarmOn ? "bell.fill" : "bell.slash")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundStyle(alarmOn ? accent.base : SMAPTheme.Surface.onSurfaceMuted)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(alarmOn ? "\(location.name) 도착 알림 켜짐, 끄기" : "\(location.name) 도착 알림 꺼짐, 켜기")
                }
            }
        )
    }
}

/// 지도를 눌렀을 때 접힌 시트 위에 뜨는 확인 카드.
/// 이전에는 "길게 누르기"로만 장소를 추가할 수 있어 기능을 찾기 어려웠다. 누르자마자 입력 창을 띄우면
/// 지도를 움직이다 스친 것만으로도 열리므로, 임시 핀 + 이 카드로 한 번 더 확인받는다. 지도를 다시 누르면 핀이 옮겨 간다.
struct MapTapAddCard: View {
    let targetMemberName: String?
    let onAdd: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            HStack(spacing: 12) {
                SMAPRowIcon(systemImage: "mappin.and.ellipse")
                VStack(alignment: .leading, spacing: 2) {
                    Text(targetMemberName.map { "\($0)님 장소로 추가할까요?" } ?? "이 위치를 장소로 추가할까요?")
                        .font(SMAPTheme.Font.bodyBold)
                        .foregroundStyle(SMAPTheme.Surface.onSurface)
                    Text("지도를 다시 누르면 위치를 옮길 수 있어요")
                        .font(SMAPTheme.Font.caption)
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("닫기")
            }
            SMAPButton("이 위치 추가", style: .primary, action: onAdd)
                .padding(.trailing, SMAPTheme.Spacing.sm)
        }
        .padding(.leading, SMAPTheme.Spacing.md)
        .padding(.trailing, SMAPTheme.Spacing.xs)
        .padding(.vertical, SMAPTheme.Spacing.sm)
        .padding(.bottom, SMAPTheme.Spacing.xs)
        .background(SMAPTheme.Surface.card, in: RoundedRectangle(cornerRadius: SMAPTheme.Radius.lg, style: .continuous))
        .shadow(color: .black.opacity(0.14), radius: 8, y: 3)
    }
}
