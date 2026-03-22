//
// NoticeListView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
// Contains: NoticeListView, NoticeRow, NoticeDetailView
//

import SwiftUI

struct NoticeListView: View {
    @Environment(\.presentationMode) var presentationMode
    @State private var notices: [SmapNotice] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color(red: 0.98, green: 0.98, blue: 1.0).ignoresSafeArea()

            if isLoading {
                ProgressView("공지사항을 불러오는 중...")
            } else if let error = errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.suite(size: 48))
                        .foregroundColor(.orange)
                    Text(error)
                        .font(.suite(size: 16))
                        .foregroundColor(.gray)
                    Button("다시 시도") {
                        fetchNotices()
                    }
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
            } else if notices.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "bell.slash")
                        .font(.suite(size: 48))
                        .foregroundColor(.gray.opacity(0.3))
                    Text("등록된 공지사항이 없습니다.")
                        .font(.suite(size: 16))
                        .foregroundColor(.gray)
                }
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        // Notice Header Card
                        VStack(spacing: 12) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("공지사항")
                                        .font(.suite(size: 20, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("최신 소식 및 업데이트")
                                        .font(.suite(size: 14))
                                        .foregroundColor(.white.opacity(0.8))
                                }
                                Spacer()
                                Image(systemName: "bell.fill")
                                    .font(.suite(size: 32))
                                    .foregroundColor(.white.opacity(0.3))
                            }
                        }
                        .padding(24)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [.red, Color(red: 0.8, green: 0, blue: 0)]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .cornerRadius(24)
                        .padding(.horizontal)
                        .padding(.top, 12)

                        // Notice List
                        VStack(spacing: 12) {
                            ForEach(notices) { notice in
                                NavigationLink(destination: NoticeDetailView(notice: notice)) {
                                    NoticeRow(notice: notice)
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                    .padding(.bottom, 20)
                }
            }
        }
        .navigationTitle("공지사항")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("공지사항")
                    .font(.suite(size: 18, weight: .bold))
            }
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: { presentationMode.wrappedValue.dismiss() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.suite(size: 18, weight: .semibold))
                        Text("뒤로")
                            .font(.suite(size: 18, weight: .bold))
                    }
                    .foregroundColor(.primary)
                }
            }
        }
        .onAppear {
            fetchNotices()
        }
    }

    private func fetchNotices() {
        isLoading = true
        errorMessage = nil

        Task {
            do {
                let response = try await NoticeService.shared.getNotices()
                await MainActor.run {
                    self.notices = response.notices
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
}

struct NoticeRow: View {
    let notice: SmapNotice

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(notice.nt_title)
                .font(.suite(size: 16, weight: .bold))
                .foregroundColor(.primary)
                .lineLimit(1)

            Text(notice.nt_content)
                .font(.suite(size: 14))
                .foregroundColor(.gray)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            HStack {
                Text(formatDate(notice.nt_wdate))
                    .font(.suite(size: 12))
                    .foregroundColor(.gray.opacity(0.6))

                Spacer()

                HStack(spacing: 4) {
                    Image(systemName: "eye.fill")
                        .font(.suite(size: 10))
                    Text("조회 \(notice.nt_hit)")
                        .font(.suite(size: 12))
                }
                .foregroundColor(.gray.opacity(0.4))
            }
            .padding(.top, 4)
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.02), radius: 5, x: 0, y: 2)
    }

    private func formatDate(_ dateString: String) -> String {
        if let dateOnly = dateString.components(separatedBy: "T").first {
            return dateOnly.replacingOccurrences(of: "-", with: ".")
        }
        return dateString
    }
}

struct NoticeDetailView: View {
    let notice: SmapNotice

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(notice.nt_title)
                        .font(.suite(size: 22, weight: .bold))
                        .foregroundColor(.primary)

                    HStack {
                        Text(formatDate(notice.nt_wdate))
                        Spacer()
                        Text("조회 \(notice.nt_hit)")
                    }
                    .font(.suite(size: 14))
                    .foregroundColor(.gray)
                }
                .padding(.bottom, 8)

                Divider()

                Text(notice.nt_content)
                    .font(.suite(size: 16))
                    .foregroundColor(.primary.opacity(0.8))
                    .lineSpacing(6)
            }
            .padding(20)
        }
        .navigationTitle("공지 상세")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func formatDate(_ dateString: String) -> String {
        if let dateOnly = dateString.components(separatedBy: "T").first {
            return dateOnly.replacingOccurrences(of: "-", with: ".")
        }
        return dateString
    }
}
