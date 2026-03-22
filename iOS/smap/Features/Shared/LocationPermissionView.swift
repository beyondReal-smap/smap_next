//
// LocationPermissionView.swift
// smap
//
// 위치 권한이 없을 때 설정으로 유도하는 전체 화면 오버레이
//

import SwiftUI
import CoreLocation

struct LocationPermissionView: View {
    var onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // 일러스트 영역
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.08))
                    .frame(width: 140, height: 140)

                Image(systemName: "location.circle.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.blue)
            }
            .padding(.bottom, 32)

            // 타이틀
            Text("잠깐! 위치 권한이 필요해요")
                .font(.title2.bold())
                .padding(.bottom, 12)

            // 설명
            Text("소중한 가족과 친구들의 위치를 확인하고\n서로의 안전을 지키기 위해\n위치 접근 권한을 허용해 주세요.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
                .padding(.bottom, 8)

            Text("허용하시면 바로 smap을 이용하실 수 있어요!")
                .font(.subheadline)
                .foregroundColor(.blue)
                .padding(.bottom, 32)

            // 버튼 영역
            VStack(spacing: 12) {
                Button {
                    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                    UIApplication.shared.open(url)
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "gearshape.fill")
                        Text("설정에서 허용하기")
                    }
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.blue)
                    .cornerRadius(14)
                }

                Text("설정 > smap > 위치 >\n'항상' 또는 '앱을 사용하는 동안'을 선택해 주세요")
                    .font(.caption)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)

                Button {
                    onDismiss()
                } label: {
                    Text("나중에 하기")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                        .padding(.top, 8)
                }
            }
            .padding(.horizontal, 24)

            Spacer()
        }
        .padding()
        .background(Color(.systemBackground))
    }
}

// MARK: - Permission Checker

@MainActor
class LocationPermissionChecker: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var status: CLAuthorizationStatus = .notDetermined

    private let manager = CLLocationManager()

    var isAuthorized: Bool {
        status == .authorizedAlways || status == .authorizedWhenInUse
    }

    override init() {
        super.init()
        manager.delegate = self
        updateStatus()

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    @objc private func appDidBecomeActive() {
        updateStatus()
    }

    private func updateStatus() {
        status = manager.authorizationStatus
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.status = manager.authorizationStatus
        }
    }
}
