//
// MyPlaceView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import NMapsMap

// MARK: - MyPlace View
//
// 지도는 화면 전체, 위쪽 떠 있는 줄(그룹 알약·검색) + 아래 남색 머리 시트(멤버 얼굴 줄·장소 목록).
// 이전의 왼쪽 사이드바·떠 있는 멤버 버튼·흐린 머리 막대를 대신한다(Android 와 같은 구조).
// 지도를 누르면 임시 핀 + 확인 카드 → "이 위치 추가"로 장소 등록 창을 연다.

struct MyPlaceView: View {
    /// 지금 보이는 탭인지 — 탭 컨테이너가 이 화면을 계속 살려 둔다.
    var isActive: Bool = true
    @StateObject private var viewModel = MyPlaceViewModel()
    @State private var newLocationCoordinates: (lat: Double, lng: Double)?
    @State private var newLocationName: String? = nil
    @State private var newLocationAddress: String? = nil
    @State private var pendingCoordinate: (lat: Double, lng: Double)?
    @State private var isResolvingAddress = false
    @State private var isSheetExpanded = false
    @State private var showGroupPicker = false
    @State private var hasLoadedOnce = false

    private var currentUserIdx: Int? { AuthService.shared.getUserData()?.mt_idx }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                MyPlaceMapView(
                    locations: viewModel.locations,
                    selectedLocation: $viewModel.selectedLocation,
                    targetCoordinate: $viewModel.targetCoordinate,
                    initialCenter: viewModel.initialMapCenter,
                    pendingCoordinate: pendingCoordinate,
                    contentInsets: UIEdgeInsets(top: geo.safeAreaInsets.top + 64, left: 0, bottom: MyPlaceSheet.peekHeight, right: 0),
                    onLocationTap: { viewModel.selectLocationFromMarker($0) },
                    onMapTap: { lat, lng in
                        // 선택한 멤버의 장소를 관리할 권한이 없으면 장소 추가 흐름을 시작하지 않는다
                        guard viewModel.canAddToSelectedMember else { return }
                        HapticManager.shared.selection()
                        isSheetExpanded = false
                        withAnimation(.easeOut(duration: 0.2)) { pendingCoordinate = (lat, lng) }
                    }
                )
                .ignoresSafeArea(edges: .top)

                MapTopScrim()
                    .frame(height: geo.safeAreaInsets.top + 24)
                    .ignoresSafeArea(edges: .top)

                MapTopControls(groupName: viewModel.selectedGroup?.sgt_title, onGroupTap: { showGroupPicker = true }) {
                    MapCircleButton(systemImage: "magnifyingglass", accessibilityLabel: "장소 검색") {
                        viewModel.isHeaderSearchPresented = true
                    }
                }

                SMAPMapSheet(peekHeight: MyPlaceSheet.peekHeight, isExpanded: $isSheetExpanded, maxHeightFraction: 0.72, headerSurface: SMAPTheme.Family.paper) {
                    MyPlaceSheetHeader(viewModel: viewModel, currentUserIdx: currentUserIdx) {
                        viewModel.isHeaderSearchPresented = true
                    }
                } content: { _, toggleSheet in
                    MyPlaceSheetBody(viewModel: viewModel, currentUserIdx: currentUserIdx, isExpanded: isSheetExpanded,
                                    onToggle: toggleSheet) { location in
                        viewModel.selectLocationFromList(location)
                        isSheetExpanded = false
                    }
                }

                if pendingCoordinate != nil {
                    VStack {
                        Spacer()
                        MapTapAddCard(
                            targetMemberName: viewModel.isViewingOtherMember ? viewModel.selectedMember?.displayName : nil,
                            onAdd: addPendingLocation,
                            onDismiss: { withAnimation(.easeOut(duration: 0.2)) { pendingCoordinate = nil } }
                        )
                        .padding(.horizontal, SMAPTheme.Spacing.md)
                        .padding(.bottom, MyPlaceSheet.peekHeight + SMAPTheme.Spacing.sm)
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                if !hasLoadedOnce {
                    MapLoadingOverlay()
                        .transition(.opacity)
                        .zIndex(1000)
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            // 지도 로딩 막은 처음 한 번만 — 이전에는 탭을 떠날 때마다 다시 켜 돌아올 때마다 깜빡였다.
            await viewModel.loadInitialData()
            withAnimation(.easeOut(duration: 0.3)) { hasLoadedOnce = true }
        }
        .onChange(of: isActive) { _, active in
            if !active {
                pendingCoordinate = nil
                showGroupPicker = false
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("groupsDidChange"))) { _ in
            Task { await viewModel.loadInitialData() }
        }
        .sheet(isPresented: $showGroupPicker) {
            GroupPickerSheet(
                groups: viewModel.groups,
                selectedGroupId: viewModel.selectedGroup?.sgt_idx,
                onSelect: { viewModel.selectGroup($0) },
                compact: true
            )
        }
        .sheet(isPresented: $viewModel.isLocationPanelOpen) {
            LocationDetailPanel(
                viewModel: viewModel,
                initialCoordinates: newLocationCoordinates,
                initialName: newLocationName,
                initialAddress: newLocationAddress
            )
        }
        .sheet(isPresented: $viewModel.isHeaderSearchPresented) {
            NavigationStack {
                LocationSearchView { place in
                    if let lat = Double(place.y), let lng = Double(place.x) {
                        newLocationCoordinates = (lat, lng)
                        newLocationName = place.place_name
                        newLocationAddress = place.road_address_name.isEmpty ? place.address_name : place.road_address_name
                        pendingCoordinate = nil

                        viewModel.targetCoordinate = (lat: lat, lng: lng)
                        viewModel.isHeaderSearchPresented = false
                        // 권한이 없으면 지도만 이동하고 장소 등록 패널은 열지 않는다
                        guard viewModel.canAddToSelectedMember else { return }
                        viewModel.selectedLocation = nil
                        viewModel.isEditMode = true
                        viewModel.isLocationPanelOpen = true
                    }
                }
                .navigationBarItems(leading: Button(action: { viewModel.isHeaderSearchPresented = false }) {
                    Text("취소")
                        .font(.suite(size: 16))
                })
            }
        }
        // 미리 만들어 둔 숨은 탭의 알림이 다른 탭 위로 뜨지 않게, 이 탭이 보일 때만 띄운다(그 전엔 보류).
        .subscriptionLimitAlert(message: Binding(
            get: { isActive ? viewModel.subscriptionLimitMessage : nil },
            set: { viewModel.subscriptionLimitMessage = $0 }
        ))
        .alert("오류", isPresented: Binding(
            get: { isActive && viewModel.showError },
            set: { viewModel.showError = $0 }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }

    /// 확인 카드 "이 위치 추가" — 주소를 찾아 장소 등록 창을 연다.
    private func addPendingLocation() {
        guard let pending = pendingCoordinate, !isResolvingAddress else { return }
        isResolvingAddress = true
        Task {
            defer { isResolvingAddress = false }
            do {
                let address = try await KakaoLocationSearchService.shared.reverseGeocode(latitude: pending.lat, longitude: pending.lng)
                newLocationCoordinates = pending
                newLocationName = nil
                newLocationAddress = address
                pendingCoordinate = nil
                viewModel.startNewLocation(latitude: pending.lat, longitude: pending.lng)
            } catch {
                viewModel.errorMessage = "주소를 불러오지 못했습니다."
                viewModel.showError = true
            }
        }
    }
}

struct MyPlaceMapView: UIViewRepresentable {
    @Environment(\.smapAccent) private var accent
    let locations: [SavedLocation]
    @Binding var selectedLocation: SavedLocation?
    @Binding var targetCoordinate: (lat: Double, lng: Double)?
    var initialCenter: (lat: Double, lng: Double)?  // Initial center for map initialization
    /// 지도를 눌러 고른 임시 위치 — 확인 카드가 떠 있는 동안 핀으로 보인다.
    var pendingCoordinate: (lat: Double, lng: Double)? = nil
    /// 위 조작 줄·아래 시트에 가리는 만큼 — 고른 장소가 보이는 영역 가운데에 오게 한다.
    var contentInsets: UIEdgeInsets = .zero
    let onLocationTap: (SavedLocation) -> Void
    let onMapTap: (Double, Double) -> Void
    
    func makeUIView(context: Context) -> NMFMapView {
        let mapView = NMFMapView()
        mapView.positionMode = .disabled
        mapView.logoAlign = .leftBottom
        mapView.zoomLevel = 15
        
        // 사용자의 현재 위치로 초기화 (LocationManager에서 가져옴)
        var userLat: Double = 37.5665  // 기본값은 서울
        var userLng: Double = 126.9780

        // 현재 기기의 마지막 위치 사용
        let lastLocation = LocationManager.shared.lastLocation ?? CLLocation(latitude: 37.5665, longitude: 126.978)
        if lastLocation.coordinate.latitude != 0.0 && lastLocation.coordinate.longitude != 0.0 {
            userLat = lastLocation.coordinate.latitude
            userLng = lastLocation.coordinate.longitude
            print("📍 [MyPlaceMapView-LoginView] Using device location: (\(userLat), \(userLng))")
        } else {
            print("📍 [MyPlaceMapView-LoginView] No device location, using Seoul default")
        }
        
        // Use initial center if provided, otherwise use user's location
        let center = initialCenter ?? (lat: userLat, lng: userLng)
        mapView.moveCamera(NMFCameraUpdate(scrollTo: NMGLatLng(lat: center.lat, lng: center.lng)))
        
        mapView.touchDelegate = context.coordinator
        return mapView
    }
    
    func updateUIView(_ mapView: NMFMapView, context: Context) {
        if mapView.contentInset != contentInsets {
            mapView.contentInset = contentInsets
        }
        // Update markers
        context.coordinator.clearMarkers()
        if let pending = pendingCoordinate {
            let pin = NMFMarker(position: NMGLatLng(lat: pending.lat, lng: pending.lng))
            // 기본 초록 마커에 색을 입히면 섞여 청록이 된다 — 검정 마커에 남색을 입힌다.
            pin.iconImage = NMF_MARKER_IMAGE_BLACK
            pin.iconTintColor = UIColor(accent.base)
            // 기본 크기(약 40pt 폭)는 지도 위에서 커 보였다 — 비율을 유지한 채 약 3/4 로 (Android 와 같은 크기).
            pin.width = 28
            pin.height = 37
            pin.zIndex = 2000
            pin.mapView = mapView
            context.coordinator.markers.append(pin)
        }
        for location in locations {
            let marker = NMFMarker()
            marker.position = NMGLatLng(lat: location.latitude, lng: location.longitude)
            
            // Custom Icon matching Next.js style
            let isSelected = selectedLocation?.id == location.id
            let iconImage = MarkerFactory.createPlaceMarkerImage(title: location.name, isSelected: isSelected)
            marker.iconImage = NMFOverlayImage(image: iconImage)
            marker.anchor = CGPoint(x: 0.5, y: 0.4) // Adjust anchor to keep circle centered
            
            marker.touchHandler = { _ in 
                context.coordinator.onLocationTap(location)
                return true 
            }
            marker.zIndex = isSelected ? 1000 : 100
            marker.mapView = mapView
            context.coordinator.markers.append(marker)
        }
        
        // Center map on target coordinate if set
        if let target = targetCoordinate {
            let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: target.lat, lng: target.lng))
            cameraUpdate.animation = .easeIn
            cameraUpdate.animationDuration = 0.3
            mapView.moveCamera(cameraUpdate)
            
            // Clear target after moving (to allow re-triggering)
            DispatchQueue.main.async {
                self.targetCoordinate = nil
            }
        }
    }
    
    func makeCoordinator() -> Coordinator { Coordinator(onLocationTap: onLocationTap, onMapTap: onMapTap) }
    
    class Coordinator: NSObject, NMFMapViewTouchDelegate {
        var markers: [NMFMarker] = []
        let onLocationTap: (SavedLocation) -> Void
        let onMapTap: (Double, Double) -> Void
        init(onLocationTap: @escaping (SavedLocation) -> Void, onMapTap: @escaping (Double, Double) -> Void) { self.onLocationTap = onLocationTap; self.onMapTap = onMapTap }
        func clearMarkers() { markers.forEach { $0.mapView = nil }; markers.removeAll() }
        // 한 번 누르기·길게 누르기 모두 임시 핀을 놓는다(확인 카드에서 한 번 더 확인).
        func mapView(_ mapView: NMFMapView, didTapMap latlng: NMGLatLng, point: CGPoint) { onMapTap(latlng.lat, latlng.lng) }
        func mapView(_ mapView: NMFMapView, didLongTapMap latlng: NMGLatLng, point: CGPoint) { onMapTap(latlng.lat, latlng.lng) }
    }
}
