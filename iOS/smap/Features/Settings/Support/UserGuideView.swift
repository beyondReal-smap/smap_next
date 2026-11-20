//
// UserGuideView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
// Contains: UserGuideView, YouTubePlayer
//

import SwiftUI
import WebKit

// MARK: - User Guide View
struct UserGuideView: View {
    @Environment(\.presentationMode) var presentationMode

    private let videos: [(title: String, description: String, url: String)] = [
        ("소개1", "스케줄맵 기본 소개", "https://www.youtube.com/embed/fRLxsHCvwuQ"),
        ("소개2", "스케줄맵 상세 소개", "https://www.youtube.com/embed/xOqCizxr2uk"),
        ("그룹", "그룹 기능 사용법", "https://www.youtube.com/embed/Bvzaz5vFyAo"),
        ("일정", "일정 관리 방법", "https://www.youtube.com/embed/Ba83-yfjvBQ"),
        ("내장소", "내장소 등록 및 관리", "https://www.youtube.com/embed/EDcvCwZmF38")
    ]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                Text("동영상 가이드").font(SMAPTheme.Font.pageTitle).accessibilityAddTraits(.isHeader)
                ForEach(videos.indices, id: \.self) { index in
                    let video = videos[index]
                    VStack(alignment: .leading, spacing: 10) {
                        Text(video.description).font(SMAPTheme.Font.headline).accessibilityAddTraits(.isHeader)
                        YouTubePlayer(videoURL: video.url)
                            .aspectRatio(16 / 9, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    Divider()
                }
                NavigationLink(destination: InquiryView()) {
                    Label("1:1 문의하기", systemImage: "envelope")
                        .font(SMAPTheme.Font.bodyBold)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .foregroundStyle(.white)
                        .background(SMAPAccent.family.deep, in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: 600)
            .padding(20)
            .frame(maxWidth: .infinity)
        }
        .background(Color(uiColor: .systemBackground))
        .navigationTitle("사용 가이드").navigationBarTitleDisplayMode(.inline).navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .principal) { Text("사용 가이드").font(.suite(size: 18, weight: .bold)) }
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: { presentationMode.wrappedValue.dismiss() }) {
                    HStack(spacing: 4) { Image(systemName: "chevron.left").font(.suite(size: 18, weight: .semibold)); Text("뒤로").font(.suite(size: 18, weight: .bold)) }.foregroundColor(.primary)
                }
            }
        }
    }
}

// MARK: - YouTube Player
struct YouTubePlayer: UIViewRepresentable {
    let videoURL: String

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.scrollView.isScrollEnabled = false
        webView.isOpaque = false
        webView.backgroundColor = .black
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        if let url = URL(string: videoURL) {
            uiView.load(URLRequest(url: url))
        }
    }
}
