import SwiftUI

// MARK: - 아바타·멤버 얼굴 줄·날짜 줄 (Android SmapAvatar / MemberStrip / DateStrip 이식)

/// 멤버 얼굴 원. 사진이 없으면 이름 첫 글자를 연한 남색 원 위에 보인다(회색 사람 아이콘 대신 누구인지 구분되게).
/// [selected] 면 남색 그라데이션 테두리와 흰 간격으로 선택을 표시한다.
struct SMAPAvatar: View {
    @Environment(\.smapAccent) private var accent
    let name: String
    let imagePath: String?
    var size: CGFloat = 44
    var selected: Bool = false
    var memberID: Int? = nil

    private static let familyColors: [SMAPAccent] = [.orange, .teal, .rose, .purple, .navy]

    static func familyColor(for memberID: Int) -> SMAPAccent {
        familyColors[abs(memberID % familyColors.count)]
    }

    var body: some View {
        let ring: CGFloat = selected ? 2.5 : 0
        let inner = selected ? size - (ring + 2) * 2 : size
        let initialsColor = memberID.map(Self.familyColor(for:)) ?? accent
        ZStack {
            Circle().fill(initialsColor.container)
            Text(String(name.trimmingCharacters(in: .whitespaces).prefix(1)).isEmpty ? "?" : String(name.trimmingCharacters(in: .whitespaces).prefix(1)))
                .font(.suite(size: inner * 0.38 - 2, weight: .bold))
                .foregroundStyle(initialsColor.base)
            if let url = AuthService.getProfileImageURL(imagePath) {
                AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.2))) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    }
                }
            }
        }
        .frame(width: inner, height: inner)
        .clipShape(Circle())
        .frame(width: size, height: size)
        .overlay {
            if selected {
                Circle().strokeBorder(accent.gradient, lineWidth: ring)
            }
        }
        .accessibilityHidden(true)
    }
}

/// 얼굴 줄 한 항목
struct MemberStripItem: Identifiable, Equatable {
    let id: Int
    let name: String
    let imagePath: String?
    let isMe: Bool
}

/// 시트 맨 위 가로 멤버 얼굴 줄 — 접힌 시트에서도 보여 한 번에 멤버를 고른다.
/// [onAllTap] 이 있으면 맨 앞에 "전체" 항목(모든 멤버가 보이게 지도 맞춤)을 둔다.
struct MemberStrip: View {
    @Environment(\.smapAccent) private var accent
    let members: [MemberStripItem]
    let selectedId: Int?
    let onSelect: (MemberStripItem) -> Void
    var onAllTap: (() -> Void)? = nil

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                if let onAllTap {
                    let selected = selectedId == nil
                    stripItem(label: "전체", selected: selected, accessibility: "전체 멤버 보기", action: onAllTap) {
                        ZStack {
                            Circle().fill(accent.container)
                            if members.count >= 2 {
                                HStack(spacing: -7) {
                                    ForEach(members.prefix(2)) { member in
                                        SMAPAvatar(name: member.name, imagePath: member.imagePath, size: 21, memberID: member.id)
                                            .overlay { Circle().strokeBorder(.white, lineWidth: 1.5) }
                                    }
                                }
                            } else {
                                Image(systemName: "map")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(accent.base)
                            }
                        }
                        .frame(width: 40, height: 40)
                    }
                }
                ForEach(members) { member in
                    let selected = member.id == selectedId
                    stripItem(
                        label: member.isMe ? "나" : member.name,
                        selected: selected,
                        accessibility: member.isMe ? "\(member.name), 나" : member.name,
                        action: { onSelect(member) }
                    ) {
                        SMAPAvatar(name: member.name, imagePath: member.imagePath, size: onAllTap == nil ? 52 : 40,
                                   selected: onAllTap == nil && selected,
                                   memberID: onAllTap == nil ? nil : member.id)
                    }
                }
            }
            .padding(.horizontal, SMAPTheme.Spacing.md)
        }
    }

    private func stripItem<Avatar: View>(label: String, selected: Bool, accessibility: String, action: @escaping () -> Void, @ViewBuilder avatar: () -> Avatar) -> some View {
        Button(action: {
            HapticManager.shared.selection()
            action()
        }) {
            if onAllTap != nil {
                HStack(spacing: 7) {
                    avatar()
                    Text(label)
                        .font(SMAPTheme.Font.captionBold)
                        .lineLimit(1)
                        .frame(maxWidth: 96)
                        .fixedSize(horizontal: true, vertical: false)
                }
                .padding(.leading, 5)
                .padding(.trailing, 13)
                .frame(height: 50)
                .foregroundStyle(selected ? Color.white : SMAPTheme.Surface.onSurface)
                .background(selected ? accent.deep : .white, in: Capsule())
                .overlay { Capsule().strokeBorder(accent.deep.opacity(selected ? 0 : 0.16)) }
            } else {
                VStack(spacing: 6) {
                    avatar()
                    Text(label)
                        .font(selected ? SMAPTheme.Font.captionBold : SMAPTheme.Font.caption)
                        .foregroundStyle(selected ? accent.base : SMAPTheme.Surface.onSurfaceMuted)
                        .lineLimit(1)
                }
                .frame(width: 60)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibility)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

/// 날짜 줄 한 칸. [dot] 은 그날 기록(일정·활동)이 있는지, [locked] 는 구독이 필요한 날.
struct DateChipItem: Identifiable, Equatable {
    var id: Date { date }
    let date: Date
    var dot: Bool = false
    var locked: Bool = false
}

/// 가로 날짜 줄 — 홈(일정 날짜)·활동 로그(14일) 공용. 선택한 날은 남색으로 채운다.
/// 처음 그릴 때 선택한 날이 보이도록 스크롤한다.
struct DateStrip: View {
    @Environment(\.smapAccent) private var accent
    let items: [DateChipItem]
    let selected: Date
    let onSelect: (DateChipItem) -> Void

    private static let weekdayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "E"
        return f
    }()

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(items) { item in
                        chip(item).id(Calendar.current.startOfDay(for: item.date))
                    }
                }
                .padding(.horizontal, SMAPTheme.Spacing.md)
            }
            .onAppear {
                proxy.scrollTo(Calendar.current.startOfDay(for: selected), anchor: .center)
            }
        }
    }

    private func chip(_ item: DateChipItem) -> some View {
        let calendar = Calendar.current
        let isSelected = calendar.isDate(item.date, inSameDayAs: selected)
        let isToday = calendar.isDateInToday(item.date)
        let isSunday = calendar.component(.weekday, from: item.date) == 1
        let weekday = Self.weekdayFormatter.string(from: item.date)
        let weekdayColor: Color = isSelected ? .white.opacity(0.94) : (isSunday ? SMAPAccent.orange.deep : SMAPTheme.Surface.onSurfaceMuted)
        var a11y = "\(calendar.component(.month, from: item.date))월 \(calendar.component(.day, from: item.date))일 \(weekday)요일"
        if isToday { a11y += ", 오늘" }
        if item.locked { a11y += ", 구독 필요" }
        if item.dot { a11y += ", 기록 있음" }

        return Button {
            HapticManager.shared.selection()
            onSelect(item)
        } label: {
            VStack(spacing: 2) {
                Text(isToday ? "오늘" : weekday)
                    .font(SMAPTheme.Font.captionSmall)
                    .foregroundStyle(weekdayColor)
                if item.locked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted.opacity(0.6))
                        .frame(height: 24)
                } else {
                    Text("\(calendar.component(.day, from: item.date))")
                        .font(SMAPTheme.Font.subheadline)
                        .foregroundStyle(isSelected ? Color.white : SMAPTheme.Surface.onSurface)
                        .frame(height: 24)
                }
                Circle()
                    .fill(!item.dot ? Color.clear : (isSelected ? Color.white : accent.base))
                    .frame(width: 5, height: 5)
                    .padding(.top, 2)
            }
            .padding(.top, 8)
            .padding(.bottom, 7)
            .frame(width: 48)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isSelected ? AnyShapeStyle(accent.gradient) : AnyShapeStyle(SMAPTheme.Surface.variant))
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11y)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
