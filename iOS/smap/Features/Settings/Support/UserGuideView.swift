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
        ZStack {
            Color(red: 0.98, green: 0.98, blue: 1.0).ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    // Header Card
                    VStack(spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(spacing: 8) {
                                    Text("사용 가이드").font(.suite(size: 22, weight: .bold)).foregroundColor(.white)
                                    HStack(spacing: 4) {
                                        Image(systemName: "play.fill").font(.suite(size: 10))
                                        Text("동영상").font(.suite(size: 11, weight: .medium))
                                    }.foregroundColor(.white.opacity(0.9)).padding(.horizontal, 8).padding(.vertical, 4)
                                    .background(Color.white.opacity(0.2)).cornerRadius(12)
                                }
                                Text("앱 사용법 및 도움말").font(.suite(size: 14)).foregroundColor(.white.opacity(0.85))
                                Text("동영상으로 쉽게 배우는 스케줄맵").font(.suite(size: 12)).foregroundColor(.white.opacity(0.7))
                            }
                            Spacer()
                            ZStack {
                                RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.2)).frame(width: 60, height: 60)
                                Image(systemName: "book.fill").font(.suite(size: 28)).foregroundColor(.white)
                            }
                        }

                        Divider().background(Color.white.opacity(0.3))

                        HStack(spacing: 0) {
                            VStack(spacing: 4) {
                                HStack(spacing: 4) { Image(systemName: "play.fill").font(.suite(size: 12)).foregroundColor(.white.opacity(0.7)); Text("총 영상").font(.suite(size: 12)).foregroundColor(.white.opacity(0.8)) }
                                Text("\(videos.count)개").font(.suite(size: 18, weight: .bold)).foregroundColor(.white)
                            }.frame(maxWidth: .infinity)
                            VStack(spacing: 4) {
                                HStack(spacing: 4) { Image(systemName: "book.fill").font(.suite(size: 12)).foregroundColor(.white.opacity(0.7)); Text("가이드").font(.suite(size: 12)).foregroundColor(.white.opacity(0.8)) }
                                Text("무료").font(.suite(size: 18, weight: .bold)).foregroundColor(.white)
                            }.frame(maxWidth: .infinity)
                        }
                    }
                    .padding(24)
                    .background(LinearGradient(gradient: Gradient(colors: [Color.yellow, Color.orange]), startPoint: .topLeading, endPoint: .bottomTrailing))
                    .cornerRadius(24).shadow(color: Color.orange.opacity(0.3), radius: 10, x: 0, y: 5).padding(.horizontal)

                    // Video List
                    VStack(spacing: 16) {
                        ForEach(videos.indices, id: \.self) { index in
                            let video = videos[index]
                            VStack(alignment: .leading, spacing: 12) {
                                HStack(spacing: 12) {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 8).fill(LinearGradient(gradient: Gradient(colors: [.yellow, .orange]), startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 28, height: 28)
                                        Image(systemName: "play.fill").font(.suite(size: 12)).foregroundColor(.white)
                                    }
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(video.title).font(.suite(size: 15, weight: .bold)).foregroundColor(.primary)
                                        Text(video.description).font(.suite(size: 12)).foregroundColor(.gray)
                                    }
                                }
                                YouTubePlayer(videoURL: video.url).frame(height: 200).cornerRadius(12)
                            }
                            .padding(16).background(Color.white).cornerRadius(16)
                            .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                        }
                    }.padding(.horizontal)

                    // Help Section
                    VStack(alignment: .leading, spacing: 12) {
                        Text("추가 도움이 필요하신가요?").font(.suite(size: 15, weight: .bold)).foregroundColor(.primary)
                        Text("동영상 가이드로 해결되지 않는 문제가 있으시면 언제든지 문의해 주세요.").font(.suite(size: 13)).foregroundColor(.gray)
                        NavigationLink(destination: InquiryView()) {
                            HStack {
                                Spacer()
                                Text("1:1 문의하기").font(.suite(size: 14, weight: .bold)).foregroundColor(.white)
                                Spacer()
                            }
                            .padding(.vertical, 14)
                            .background(LinearGradient(gradient: Gradient(colors: [.blue, .cyan]), startPoint: .leading, endPoint: .trailing))
                            .cornerRadius(12)
                        }
                    }
                    .padding(20)
                    .background(LinearGradient(gradient: Gradient(colors: [Color.blue.opacity(0.05), Color.cyan.opacity(0.05)]), startPoint: .leading, endPoint: .trailing))
                    .cornerRadius(16).padding(.horizontal).padding(.bottom, 40)
                }
                .padding(.top, 20)
            }
        }
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
