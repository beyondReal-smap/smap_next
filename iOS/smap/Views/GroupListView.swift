import SwiftUI

// MARK: - 그룹 탭

struct GroupListView: View {
    @Environment(\.smapAccent) private var accent
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var viewModel = GroupViewModel()
    @State private var inviteCode: String = ""
    @State private var showCreateModal: Bool = false

    @State private var showJoin = false

    private var currentUserIdx: Int? { AuthService.shared.getUserData()?.mt_idx }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
                    GroupListHero(
                        groups: viewModel.groups,
                        userName: AuthService.shared.getUserData()?.displayName,
                        currentUserIdx: currentUserIdx,
                        isLoading: showPlaceholder,
                        showJoin: showJoin,
                        onCreate: { showCreateModal = true },
                        onToggleJoin: {
                            let motion: Animation = showJoin ? .easeIn(duration: 0.18) : .easeOut(duration: 0.25)
                            withAnimation(reduceMotion ? nil : motion) { showJoin.toggle() }
                        }
                    )
                    if showJoin {
                        InviteJoinSection(inviteCode: $inviteCode, isJoining: viewModel.isJoining) {
                            viewModel.joinGroup(inviteCode: inviteCode)
                            inviteCode = ""
                        }
                        .transition(.offset(y: -8).combined(with: .opacity))
                    }
                    groupSection
                }
                .padding(SMAPTheme.Spacing.md)
                .padding(.bottom, SMAPTheme.Spacing.lg)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(SMAPTheme.Family.paper.ignoresSafeArea())
            .refreshable { viewModel.fetchGroups() }
            .toolbar(.hidden, for: .navigationBar)
            .onAppear { viewModel.fetchGroups() }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("groupsDidChange"))) { _ in
                viewModel.fetchGroups()
            }
            .alert("알림", isPresented: $viewModel.showError) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "오류가 발생했습니다.")
            }
            .sheet(isPresented: $showCreateModal) {
                GroupFormSheet(mode: .create, isSaving: viewModel.isCreating) { title, memo in
                    viewModel.createGroup(title: title, memo: memo)
                }
            }
        }
    }

    /// 이미 받은 목록이 있으면 다시 불러오는 동안에도 그대로 보여 준다(탭을 열 때마다 깜빡이지 않게). 자리 표시는 처음 한 번만.
    private var showPlaceholder: Bool { viewModel.isLoading && viewModel.groups.isEmpty }

    private var groupSection: some View {
        SMAPSection(title: viewModel.groups.isEmpty ? "내 그룹" : "내 그룹 · \(viewModel.groups.count)") {
            if showPlaceholder {
                SkeletonRow()
                SMAPRowDivider()
                SkeletonRow()
            } else if viewModel.groups.isEmpty {
                SMAPListRow(
                    title: "아직 그룹이 없어요",
                    subtitle: "가족·친구와 위치를 함께 보려면 그룹을 만들거나 초대 코드로 참여하세요.",
                    action: { showCreateModal = true },
                    leading: { SMAPRowIcon(systemImage: "person.3") },
                    trailing: {
                        Text("만들기").font(SMAPTheme.Font.captionBold).foregroundStyle(accent.base)
                    }
                )
            } else {
                ForEach(Array(viewModel.groups.enumerated()), id: \.element.id) { index, group in
                    if index > 0 { SMAPRowDivider() }
                    NavigationLink {
                        GroupDetailView(viewModel: viewModel, group: group)
                    } label: {
                        GroupRow(group: group, isMine: currentUserIdx != nil && group.mt_idx == currentUserIdx)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

/// 그룹 이름과 인원, 역할을 함께 표시한다.
private struct GroupRow: View {
    let group: SmapGroup
    let isMine: Bool

    var body: some View {
        let name = group.sgt_title.flatMap { $0.isEmpty ? nil : $0 } ?? "이름 없는 그룹"
        let memo = group.sgt_memo.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
        // NavigationLink 가 누름을 처리하므로 행 자체에는 동작을 주지 않는다.
        SMAPListRow(
            title: name,
            subtitle: (["멤버 \(group.member_count ?? 0)명"] + [memo].compactMap { $0 }).joined(separator: " · "),
            leading: {
                Text(String(name.prefix(1)))
                    .font(SMAPTheme.Font.headline)
                    .foregroundStyle(SMAPTheme.Family.ink)
                    .frame(width: 44, height: 48)
                    .background(SMAPTheme.Family.highlight, in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityHidden(true)
            },
            trailing: {
                HStack(spacing: SMAPTheme.Spacing.sm) {
                    if isMine { RoleBadge(text: "그룹장") }
                    RowChevron()
                }
            }
        )
        .contentShape(Rectangle())
    }
}

/// 그룹을 만들거나 초대 코드 입력을 열 수 있는 머리 카드.
/// 멤버 수는 그룹별 인원의 합이라 여러 그룹에 같은 사람이 있으면 겹쳐 센다("전체 멤버", Android 와 같은 기준).
private struct GroupListHero: View {
    let groups: [SmapGroup]
    let userName: String?
    let currentUserIdx: Int?
    let isLoading: Bool

    let showJoin: Bool
    let onCreate: () -> Void
    let onToggleJoin: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(userName.map { "\($0)님의 그룹" } ?? "내 그룹")
                    .font(SMAPTheme.Font.captionBold).foregroundStyle(SMAPTheme.Family.highlight)
                Text("함께하는 사람들")
                    .font(.suite(size: 30, weight: .bold)).foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                Text(isLoading ? "그룹을 불러오는 중…" : groups.isEmpty ? "첫 그룹을 만들거나 초대 코드로 참여하세요" :
                     "그룹 \(groups.count)개 · 그룹별 멤버 합계 \(groups.reduce(0) { $0 + ($1.member_count ?? 0) })명 · 내가 만든 그룹 \(groups.filter { currentUserIdx != nil && $0.mt_idx == currentUserIdx }.count)개")
                    .font(SMAPTheme.Font.captionSmall).foregroundStyle(.white.opacity(0.85))
            }
            HStack(spacing: 10) {
                Button(action: onCreate) {
                    Label("새 그룹", systemImage: "plus").frame(maxWidth: .infinity, minHeight: 46)
                        .foregroundStyle(SMAPTheme.Family.ink)
                        .background(SMAPTheme.Family.highlight, in: RoundedRectangle(cornerRadius: 13))
                }
                Button(action: onToggleJoin) {
                    Label(showJoin ? "코드 입력 닫기" : "코드로 참여", systemImage: "envelope")
                        .frame(maxWidth: .infinity, minHeight: 46).foregroundStyle(.white)
                        .overlay { RoundedRectangle(cornerRadius: 13).strokeBorder(.white.opacity(0.45)) }
                }
            }
            .buttonStyle(.plain).font(SMAPTheme.Font.captionBold)
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        .background(SMAPTheme.Family.ink, in: RoundedRectangle(cornerRadius: 24))
    }
}

/// 초대 코드로 참여 — 입력창 + 참여 버튼. 코드는 영문 대문자·숫자만 받는다.
/// 코드는 대개 카카오톡·문자로 받은 초대 메시지에서 복사해 넣는다. 제목 옆 "붙여넣기"나 입력창 붙여넣기 모두
/// 메시지 전체가 들어와도 코드만 골라 넣는다.
/// 시스템 PasteButton 은 허용 팝업이 없지만 글꼴을 바꿀 수 없어(앱 글꼴 SUITE 미적용) "+ 새 그룹"과 같은 글자 버튼으로 둔다.
/// 대신 처음 누를 때 iOS 가 붙여넣기 허용을 묻는다.
private struct InviteJoinSection: View {
    @Environment(\.smapAccent) private var accent
    @Binding var inviteCode: String
    let isJoining: Bool
    let onJoin: () -> Void

    var body: some View {
        let filtered = Binding<String>(
            get: { inviteCode },
            set: { newValue in
                // 한 번에 두 글자 이상 늘면 붙여넣기로 보고 메시지에서 코드만 고른다. 한 글자씩 칠 때는 거르기만.
                if newValue.count - inviteCode.count > 1 {
                    if let code = InviteCodeParser.extract(from: newValue) { inviteCode = code }
                } else {
                    inviteCode = InviteCodeParser.sanitize(newValue)
                }
            }
        )
        let canJoin = !inviteCode.isEmpty && !isJoining
        SMAPSection(title: "초대 코드로 참여", action: {
            Button {
                guard let text = UIPasteboard.general.string, let code = InviteCodeParser.extract(from: text) else { return }
                HapticManager.shared.selection()
                inviteCode = code
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "doc.on.clipboard").font(.system(size: 14, weight: .semibold))
                    Text("붙여넣기").font(SMAPTheme.Font.captionBold)
                }
                .foregroundStyle(accent.base)
                .padding(.horizontal, SMAPTheme.Spacing.sm)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("초대 코드 붙여넣기")
        }) {
            HStack(alignment: .bottom, spacing: SMAPTheme.Spacing.sm) {
                SMAPTextField(
                    "예: 5JDZRMNVEV",
                    text: filtered,
                    label: "초대 코드",
                    keyboardType: .asciiCapable,
                    submitLabel: .join,
                    onSubmit: { if canJoin { onJoin() } }
                )
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                SMAPButton("참여", isLoading: isJoining, isDisabled: !canJoin, action: onJoin)
                    .frame(width: 80)
            }
            .padding(SMAPTheme.Spacing.md)
        }
    }
}

/// 초대 메시지·링크에서 초대 코드만 꺼낸다.
/// 메시지 형식: "[도착했어] OO 그룹에 초대합니다!\n초대 코드: 5JDZRMNVEV\n링크: https://…/group/12/join?code=5JDZRMNVEV"
enum InviteCodeParser {
    /// 영문 대문자·숫자만 남긴다
    static func sanitize(_ text: String) -> String {
        text.uppercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber) }
    }

    /// 1) 링크의 code= 값 2) "코드:" 뒤 값 3) 대문자·숫자 6~12자 낱말(주소의 소문자 낱말·#색상값 제외)
    /// 4) 다 아니면 전체를 거른 값이 코드 길이(4~12자)일 때만. 초대와 무관한 긴 글이면 nil — 입력창을 그대로 둔다.
    static func extract(from text: String) -> String? {
        let patterns = [
            #"[?&]code=([A-Za-z0-9]+)"#,
            #"코드\s*[:：]?\s*([A-Za-z0-9]+)"#,
            #"(?<![A-Za-z0-9#])([A-Z0-9]{6,12})(?![A-Za-z0-9])"#,
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let range = Range(match.range(at: 1), in: text) {
                return sanitize(String(text[range]))
            }
        }
        let whole = sanitize(text)
        return (4...12).contains(whole.count) ? whole : nil
    }
}

// MARK: - 그룹 화면 공용 조각

/// 역할 배지 — 그룹장은 남색 채움(가장 강한 역할), 리더는 연한 남색.
struct RoleBadge: View {
    @Environment(\.smapAccent) private var accent
    let text: String

    var body: some View {
        let strong = text == "그룹장"
        Text(text)
            .font(SMAPTheme.Font.captionBold)
            .foregroundStyle(strong ? Color.white : accent.base)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background {
                if strong {
                    Capsule().fill(accent.gradient)
                } else {
                    Capsule().fill(accent.container)
                }
            }
    }
}

struct RowChevron: View {
    var body: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(SMAPTheme.Surface.outline)
            .accessibilityHidden(true)
    }
}

/// 불러오는 동안 행 자리 표시(회색 원 + 두 줄)
struct SkeletonRow: View {
    var body: some View {
        HStack(spacing: 12) {
            Circle().fill(SMAPTheme.Surface.variant).frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 4).fill(SMAPTheme.Surface.variant).frame(width: 140, height: 14)
                RoundedRectangle(cornerRadius: 4).fill(SMAPTheme.Surface.variant).frame(width: 90, height: 10)
            }
            Spacer(minLength: 0)
        }
        .padding(SMAPTheme.Spacing.md)
        .accessibilityHidden(true)
    }
}

// MARK: - 그룹 만들기·수정 창

/// 그룹 이름·설명 입력 창 — 만들기와 수정이 같이 쓴다.
/// 이전 창은 "이름이 비었는지"로 만들기/수정을 구분해 수정 중 이름을 지우면 제목이 "새 그룹 생성"으로 바뀌었다. 이제 mode 로 구분한다.
/// 분홍·노랑 장식 원과 팁 상자는 빼고 Android 와 같은 입력창 두 개 + 남색 주 버튼으로.
struct GroupFormSheet: View {
    enum Mode { case create, edit(title: String, memo: String) }

    let mode: Mode
    let isSaving: Bool
    let onSave: (_ title: String, _ memo: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var memo = ""
    @State private var showDiscardAlert = false

    private var isEdit: Bool { if case .edit = mode { return true } else { return false } }
    private var original: (String, String) { if case let .edit(t, m) = mode { return (t, m) } else { return ("", "") } }
    private var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var hasChanges: Bool { title != original.0 || memo != original.1 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
                    Text(isEdit ? "그룹 이름이나 설명을 바꿀 수 있어요" : "함께 위치를 나눌 그룹을 만들어요.\n만들면 멤버를 초대할 코드가 생겨요.")
                        .font(SMAPTheme.Font.caption)
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                    SMAPTextField("예: 우리 가족, 친한 친구들", text: $title, label: "그룹 이름", submitLabel: .next)
                    SMAPTextField("그룹을 짧게 설명해 주세요", text: $memo, label: "설명 (선택)")
                    SMAPButton(isEdit ? "저장" : "그룹 만들기", isLoading: isSaving, isDisabled: trimmedTitle.isEmpty || (isEdit && !hasChanges)) {
                        onSave(trimmedTitle, memo.trimmingCharacters(in: .whitespacesAndNewlines))
                        dismiss()
                    }
                    .padding(.top, SMAPTheme.Spacing.sm)
                }
                .padding(20)
            }
            .background(SMAPTheme.Surface.card.ignoresSafeArea())
            .navigationTitle(isEdit ? "그룹 정보 수정" : "새 그룹")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") {
                        if hasChanges { showDiscardAlert = true } else { dismiss() }
                    }
                }
            }
            .alert("입력한 내용을 버릴까요?", isPresented: $showDiscardAlert) {
                Button("계속 입력", role: .cancel) {}
                Button("버리기", role: .destructive) { dismiss() }
            }
        }
        // 입력 중 아래로 쓸어 실수로 닫히지 않게
        .interactiveDismissDisabled(hasChanges)
        .presentationDetents([.medium, .large])
        .onAppear {
            title = original.0
            memo = original.1
        }
    }
}
