//
// NoticeListView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
// Contains: NoticeListView, NoticeRow, NoticeDetailView
//
// 36단계 — 설정 화면과 같은 "회색 바탕 + 구역 + 흰 행" 목록 / 흰 바탕 본문으로 (Android NoticeScreens 와 같은 구성).
// 이전에는 빨강 그라데이션 머리 카드 + 그림자 카드 목록이었다(빨강은 앱 어디에도 없는 색).

import SwiftUI

/// 최근 며칠 안에 올라온 공지에 "NEW" 표시
private let noticeNewBadgeDays = 7

struct NoticeListView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var notices: [SmapNotice] = []
    @State private var isLoading = true
    @State private var loadFailed = false

    var body: some View {
        Group {
            if isLoading {
                SMAPLoadingView()
            } else if loadFailed {
                SMAPErrorState(onRetry: fetchNotices)
            } else if notices.isEmpty {
                SMAPEmptyState(title: "등록된 공지사항이 없어요", description: "새 소식이 생기면 여기에 알려 드릴게요.", systemImage: "bell.slash")
            } else {
                ScrollView {
                    SMAPSection(title: "공지 \(notices.count)") {
                        ForEach(Array(notices.enumerated()), id: \.element.id) { index, notice in
                            if index > 0 { SMAPRowDivider() }
                            NavigationLink(destination: NoticeDetailView(notice: notice)) {
                                NoticeRow(notice: notice)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(SMAPTheme.Spacing.md)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SMAPTheme.Surface.canvas.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar { noticeToolbar(dismiss: dismiss) }
        .onAppear(perform: fetchNotices)
    }

    private func fetchNotices() {
        isLoading = true
        loadFailed = false
        Task {
            do {
                let response = try await NoticeService.shared.getNotices()
                await MainActor.run {
                    notices = response.notices
                    isLoading = false
                }
            } catch {
                print("[NoticeListView] 공지 목록 조회 실패: \(error)")
                await MainActor.run {
                    loadFailed = true
                    isLoading = false
                }
            }
        }
    }
}

/// 공지 한 줄 — 확성기 아이콘 · 제목 / 날짜·조회 · (NEW) ›
struct NoticeRow: View {
    let notice: SmapNotice

    var body: some View {
        SMAPListRow(
            title: notice.nt_title,
            subtitle: noticeMeta(notice),
            leading: { SMAPRowIcon(systemImage: "megaphone") },
            trailing: {
                HStack(spacing: SMAPTheme.Spacing.sm) {
                    if isRecentNotice(notice) { NoticeNewBadge() }
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                }
            }
        )
        .contentShape(Rectangle())
    }
}

struct NoticeDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let notice: SmapNotice

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
                HStack(spacing: SMAPTheme.Spacing.sm) {
                    if isRecentNotice(notice) { NoticeNewBadge() }
                    Text(noticeMeta(notice))
                        .font(SMAPTheme.Font.caption)
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                }
                Text(notice.nt_title)
                    .font(SMAPTheme.Font.title)
                    .foregroundStyle(SMAPTheme.Surface.onSurface)
                Rectangle()
                    .fill(SMAPTheme.Surface.divider)
                    .frame(height: 1)
                    .padding(.vertical, SMAPTheme.Spacing.md)
                Text(notice.nt_content)
                    .font(SMAPTheme.Font.body)
                    .foregroundStyle(SMAPTheme.Surface.onSurface)
                    .lineSpacing(7)
                    .textSelection(.enabled)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(SMAPTheme.Spacing.lg)
        }
        .background(SMAPTheme.Surface.card.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar { noticeToolbar(dismiss: dismiss) }
    }
}

/// 최근 공지 표시 — 메뉴 강조색 글자 + 옅은 바탕 알약
private struct NoticeNewBadge: View {
    @Environment(\.smapAccent) private var accent

    var body: some View {
        Text("NEW")
            .font(SMAPTheme.Font.captionBold)
            .foregroundStyle(accent.base)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(accent.container, in: Capsule())
    }
}

/// 목록·본문 공통 상단 — 가운데 "공지사항" + 왼쪽 "< 뒤로"(계정설정 화면과 같은 모양)
@ToolbarContentBuilder
private func noticeToolbar(dismiss: DismissAction) -> some ToolbarContent {
    ToolbarItem(placement: .principal) {
        Text("공지사항").font(SMAPTheme.Font.bodyBold)
    }
    ToolbarItem(placement: .navigationBarLeading) {
        Button(action: { dismiss() }) {
            HStack(spacing: 4) {
                Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold))
                Text("뒤로").font(SMAPTheme.Font.bodyBold)
            }
            .foregroundStyle(SMAPTheme.Surface.onSurface)
        }
    }
}

/// "2026.11.16 · 조회 3"
private func noticeMeta(_ notice: SmapNotice) -> String {
    let date = notice.nt_wdate.components(separatedBy: "T").first ?? notice.nt_wdate
    return "\(date.replacingOccurrences(of: "-", with: ".")) · 조회 \(notice.nt_hit)"
}

private func isRecentNotice(_ notice: SmapNotice) -> Bool {
    let day = String(notice.nt_wdate.prefix(10))
    guard let date = DateFormatter.yyyyMMdd.date(from: day) else { return false }
    let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: date), to: Calendar.current.startOfDay(for: Date())).day ?? Int.max
    return (0..<noticeNewBadgeDays).contains(days)
}
