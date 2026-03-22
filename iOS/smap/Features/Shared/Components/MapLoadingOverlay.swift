//
// MapLoadingOverlay.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

struct MapLoadingOverlay: View {
    @State private var dotOffset = 0
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let timer = Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            // 배경 (브랜드 컬러 그라데이션)
            LinearGradient(
                gradient: Gradient(colors: [
                    brandColor.opacity(0.95),
                    Color(red: 102/255, green: 126/255, blue: 234/255).opacity(0.95)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .edgesIgnoringSafeArea(.all)

            VStack(spacing: 30) {
                // 지도 아이콘
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.15))
                        .frame(width: 90, height: 90)

                    Image(systemName: "map.fill")
                        .font(.system(size: 36))
                        .foregroundColor(.white)
                }

                VStack(spacing: 16) {
                    Text("지도 로딩 중")
                        .font(.suite(size: 18, weight: .bold))
                        .foregroundColor(.white)

                    // 순차적으로 움직이는 점 3개
                    HStack(spacing: 8) {
                        ForEach(0..<3) { index in
                            Circle()
                                .fill(Color.white)
                                .frame(width: 10, height: 10)
                                .scaleEffect(dotOffset == index ? 1.5 : 1.0)
                                .opacity(dotOffset == index ? 1.0 : 0.4)
                        }
                    }
                }
            }
        }
        .onAppear {
            print("🎬 [MapLoadingOverlay] Overlay appeared")
        }
        .onReceive(timer) { _ in
            withAnimation(.easeInOut(duration: 0.4)) {
                dotOffset = (dotOffset + 1) % 3
            }
        }
    }
}
