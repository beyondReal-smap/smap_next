//
//  MyPlaceView.swift
//  smap
//
//  내장소 (장소 관리) 메인 뷰
//  HomeView 패턴을 기반으로 사이드바와 플로팅 버튼 구현
//

import SwiftUI
import NMapsMap

// MARK: - MyPlace Main View

struct MyPlaceView: View {
    @StateObject private var viewModel = MyPlaceViewModel()
    @Environment(\.presentationMode) var presentationMode
    
    @State private var sidebarDragOffset: CGFloat = 0
    @State private var newLocationCoordinates: (lat: Double, lng: Double)?
    @State private var isMapLoading = true  // 지도 로딩 상태
    
    
    private let sidebarWidth: CGFloat = 320
    
    var body: some View {
        ZStack(alignment: .leading) {
            // 1. Map Layer
            MyPlaceMapView(
                locations: viewModel.locations,
                selectedLocation: $viewModel.selectedLocation,
                onLocationTap: { location in
                    viewModel.selectLocation(location)
                },
                onMapTap: { lat, lng in
                    newLocationCoordinates = (lat, lng)
                    viewModel.startNewLocation(latitude: lat, longitude: lng)
                }
            )
            .ignoresSafeArea()
            .offset(y: 60)
            
            // 2. Header
            VStack {
                MyPlaceHeaderView(
                    onBackTap: {
                        presentationMode.wrappedValue.dismiss()
                    },
                    onMenuTap: {
                        viewModel.toggleSidebar()
                    }
                )
                Spacer()
            }
            
            // 3. Sidebar Overlay
            if viewModel.isSidebarOpen || sidebarDragOffset > 0 {
                Color.black.opacity(overlayOpacity)
                    .ignoresSafeArea()
                    .onTapGesture {
                        viewModel.closeSidebar()
                    }
                    .transition(.opacity)
            }
            
            // 4. Sidebar
            MyPlaceSidebarView(viewModel: viewModel)
                .frame(width: sidebarWidth)
                .offset(x: sidebarOffset)
                .gesture(sidebarDragGesture)
                .zIndex(100)
            
            // 5. Edge Swipe Detection
            if !viewModel.isSidebarOpen {
                Color.clear
                    .frame(width: 20)
                    .contentShape(Rectangle())
                    .gesture(edgeSwipeGesture)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // 6. Floating Action Button
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    FloatingActionPlaceButton(count: viewModel.members.count) {
                        viewModel.toggleSidebar()
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
                }
            }
            
            // 7. Loading Overlay (데이터 로딩)
            if viewModel.isLoading {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .overlay(
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(1.5)
                    )
            }
            
            // 8. Map Loading Overlay (지도 초기화)
            if isMapLoading {
                MapLoadingOverlay()
                    .transition(AnyTransition.opacity)
                    .zIndex(1000)
            }
        }
        .onAppear {
            handleLoading()
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            await viewModel.loadInitialData()
        }
        .sheet(isPresented: $viewModel.isLocationPanelOpen) {
            LocationDetailPanel(
                viewModel: viewModel,
                initialCoordinates: newLocationCoordinates
            )
        }
        .alert("오류", isPresented: $viewModel.showError) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "알 수 없는 오류가 발생했습니다.")
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("closeSidebars"))) { notification in
            // 탭 전환 시 사이드바를 닫기
            viewModel.closeSidebar()
            
            // 본인 탭(내장소 = 1)으로 전환될 때만 로딩 화면을 다시 표시
            if let targetTab = notification.object as? Int, targetTab == 1 {
                isMapLoading = true
                handleLoading()
            }
        }
        .onDisappear {
            // 페이지를 벗어날 때 사이드바 자동 닫기 및 로딩 상태 리셋
            viewModel.closeSidebar()
            isMapLoading = true
        }
    }
    
    /// 지도 로딩 조절 로직 (최소 1.5초 및 데이터 완료 대기)
    private func handleLoading() {
        // 이미 진행 중인 타이머가 있을 수 있으므로 isMapLoading이 true일 때만 시작
        guard isMapLoading else { return }
        
        Task {
            // 최소 1.5초 대기
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            
            // 뷰모델 데이터 로딩 대기 (최대 5초)
            var retryCount = 0
            while viewModel.isLoading && retryCount < 25 {
                try? await Task.sleep(nanoseconds: 200_000_000)
                retryCount += 1
            }
            
            withAnimation(.easeOut(duration: 0.3)) {
                isMapLoading = false
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var sidebarOffset: CGFloat {
        if viewModel.isSidebarOpen {
            return max(0, sidebarDragOffset)
        } else {
            return min(0, -sidebarWidth + sidebarDragOffset)
        }
    }
    
    private var overlayOpacity: Double {
        let progress: Double
        if viewModel.isSidebarOpen {
            progress = 1.0 - Double(max(0, -sidebarDragOffset)) / Double(sidebarWidth)
        } else {
            progress = Double(sidebarDragOffset) / Double(sidebarWidth)
        }
        return 0.4 * max(0, min(1, progress))
    }
    
    // MARK: - Gestures
    
    private var edgeSwipeGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                if value.translation.width > 0 {
                    sidebarDragOffset = min(sidebarWidth, value.translation.width)
                }
            }
            .onEnded { value in
                if value.translation.width > sidebarWidth * 0.3 || value.predictedEndTranslation.width > sidebarWidth * 0.5 {
                    viewModel.openSidebar()
                    sidebarDragOffset = 0
                } else {
                    viewModel.closeSidebar()
                    sidebarDragOffset = 0
                }
            }
    }
    
    private var sidebarDragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                sidebarDragOffset = value.translation.width
            }
            .onEnded { value in
                if viewModel.isSidebarOpen {
                    if value.translation.width < -sidebarWidth * 0.3 || value.predictedEndTranslation.width < -sidebarWidth * 0.5 {
                        viewModel.closeSidebar()
                    }
                }
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    sidebarDragOffset = 0
                }
            }
    }
}

// MARK: - Header View

struct MyPlaceHeaderView: View {
    let onBackTap: () -> Void
    let onMenuTap: () -> Void
    
    
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("내장소")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("장소를 등록하고 관리하세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            Button(action: onMenuTap) {
                Image(systemName: "magnifyingglass")
                    .font(.suite(size: 20))
                    .foregroundColor(.gray)
            }
            .frame(width: 36, height: 44)
            .accessibilityLabel("검색")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Color.white.opacity(0.95)
                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
                .ignoresSafeArea(edges: .top)
        )
    }
}

// MARK: - Floating Action Button

struct FloatingActionPlaceButton: View {
    let count: Int
    let action: () -> Void
    
    
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255) // Pink-500
    
    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                // Main Button Circle
                Circle()
                    .fill(SMAPTheme.Color.primary)
                    .frame(width: 56, height: 56)
                    .shadow(color: SMAPTheme.Color.primary.opacity(0.3), radius: 12, x: 0, y: 8)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.suite(size: 22))
                            .foregroundColor(.white)
                    )
                
                // Badge (Pink)
                if count > 0 {
                    Text(count > 99 ? "99+" : "\(count)")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .frame(minWidth: 24, minHeight: 24)
                        .background(pinkColor)
                        .clipShape(Circle())
                        .offset(x: 4, y: -4)
                }
            }
        }
    }
}

// MARK: - Sidebar View

struct MyPlaceSidebarView: View {
    @ObservedObject var viewModel: MyPlaceViewModel
    
    
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(SMAPTheme.Color.primary)
                        .frame(width: 40, height: 40)
                    Image(systemName: "mappin.and.ellipse")
                        .foregroundColor(.white)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("장소 관리")
                        .font(.suite(size: 20, weight: .bold))
                    Text("멤버를 선택해보세요")
                        .font(.suite(size: 15))
                        .foregroundColor(.secondary)
                }
            }
            .padding(.top, 20)
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Group Selector Section
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Circle().fill(Color.red).frame(width: 8, height: 8)
                            Text("그룹 선택").font(.suite(size: 16, weight: .bold))
                        }
                        
                        Menu {
                            ForEach(viewModel.groups) { group in
                                Button(group.sgt_title ?? "이름 없음") {
                                    viewModel.selectGroup(group)
                                }
                            }
                        } label: {
                            HStack {
                                Text(viewModel.selectedGroup?.sgt_title ?? "그룹 선택")
                                    .font(.suite(size: 17))
                                    .foregroundColor(.primary)
                                Spacer()
                                Image(systemName: "chevron.down")
                                    .font(.suite(size: 15))
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                            .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                    .padding(.horizontal, 20)
                    
                    // Member List Section
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 8) {
                            Circle().fill(Color.blue).frame(width: 8, height: 8)
                            Text("멤버 목록").font(.suite(size: 16, weight: .bold))
                            Spacer()
                            Text("\(viewModel.members.count)명")
                                .font(.suite(size: 14))
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Capsule().fill(Color.secondary.opacity(0.1)))
                        }
                        
                        if viewModel.isLoading {
                            HStack {
                                Spacer()
                                ProgressView()
                                Spacer()
                            }
                            .padding(.vertical, 20)
                        } else {
                            VStack(spacing: 8) {
                                ForEach(viewModel.members) { member in
                                    PlaceMemberCell(member: member) {
                                        viewModel.selectMember(member)
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                    .padding(.horizontal, 20)
                }
                
                // Location List Section (Only if member is selected)
                if let selectedMember = viewModel.selectedMember {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 8) {
                            Circle().fill(Color.orange).frame(width: 8, height: 8)
                            Text("\(selectedMember.displayName)의 장소").font(.suite(size: 16, weight: .bold))
                            Spacer()
                            Text("\(viewModel.locations.count)개")
                                .font(.suite(size: 14))
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Capsule().fill(Color.secondary.opacity(0.1)))
                        }
                        
                        if viewModel.isLoadingLocations {
                            HStack { Spacer(); ProgressView(); Spacer() }.padding(.vertical, 20)
                        } else if viewModel.locations.isEmpty {
                            Text("등록된 장소가 없습니다.")
                                .font(.suite(size: 14))
                                .foregroundColor(.gray)
                                .padding(.vertical, 20)
                                .frame(maxWidth: .infinity, alignment: .center)
                        } else {
                            LazyVStack(spacing: 12) {
                                ForEach(viewModel.locations) { location in
                                    LocationListCell(location: location, isSelected: viewModel.selectedLocation?.id == location.id, onToggleNotification: {
                                        Task { await viewModel.toggleNotification(for: location) }
                                    }) {
                                        viewModel.selectLocationFromSidebar(location)
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                }
            }
        }
        .frame(width: 320)
        .background(Color(red: 245/255, green: 247/255, blue: 250/255).ignoresSafeArea())
        .cornerRadius(24, corners: [.topRight, .bottomRight])
        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 5, y: 0)
    }
}

// MARK: - Location List Cell

struct LocationListCell: View {
    let location: SavedLocation
    let isSelected: Bool
    let onToggleNotification: () -> Void
    let onTap: () -> Void
    
    
    
    var body: some View {
        ZStack(alignment: .trailing) {
            // Base layer: Main row content (tappable for selection)
            Button(action: onTap) {
                HStack(spacing: 12) {
                    // Icon
                    ZStack {
                        Circle()
                            .fill(isSelected ? SMAPTheme.Color.primary.opacity(0.1) : Color.gray.opacity(0.05))
                            .frame(width: 40, height: 40)
                        Image(systemName: "mappin.and.ellipse")
                            .font(.system(size: 18))
                            .foregroundColor(isSelected ? SMAPTheme.Color.primary : .gray)
                    }
                    
                    // Text
                    VStack(alignment: .leading, spacing: 2) {
                        Text(location.name)
                            .font(.suite(size: 16, weight: .medium))
                            .foregroundColor(isSelected ? SMAPTheme.Color.primary : .primary)
                            .lineLimit(1)
                        Text(location.address)
                            .font(.suite(size: 12))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    
                    Spacer()
                    
                    // Spacer for bell - explicitly disable hit testing here
                    Color.clear
                        .frame(width: 56, height: 44)
                        .allowsHitTesting(false)
                }
                .padding(12)
                .background(isSelected ? SMAPTheme.Color.primary.opacity(0.03) : Color.white)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? SMAPTheme.Color.primary.opacity(0.3) : Color.gray.opacity(0.1), lineWidth: 1)
                )
            }
            .buttonStyle(PlainButtonStyle())
            
            // Top layer: Bell button (separate from main button's touch area)
            Button(action: onToggleNotification) {
                Image(systemName: location.notifications ? "bell.fill" : "bell.slash")
                    .font(.system(size: 16))
                    .foregroundColor(location.notifications ? .orange : .gray.opacity(0.4))
                    .frame(width: 44, height: 44)
                    .background(Color.white)
                    .clipShape(Circle())
                    .shadow(color: Color.black.opacity(0.08), radius: 3, x: 0, y: 1)
                    .contentShape(Circle())
            }
            .buttonStyle(PlainButtonStyle())
            .accessibilityLabel(location.notifications ? "알림 끄기" : "알림 켜기")
            .padding(.trailing, 18)
        }
    }
}

// MARK: - Member Cell

struct PlaceMemberCell: View {
    let member: PlaceMember
    let onTap: () -> Void
    
    
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Avatar with Badge
                ZStack(alignment: .bottomTrailing) {
                    // Profile Image with Selection Border
                    Group {
                        if let url = getProfileImageUrl(member.mt_file1) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .empty:
                                    ProgressView()
                                        .frame(width: 44, height: 44)
                                case .success(let image):
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 44, height: 44)
                                        .clipShape(Circle())
                                case .failure:
                                    defaultAvatar
                                @unknown default:
                                    defaultAvatar
                                }
                            }
                        } else {
                            defaultAvatar
                        }
                    }
                    .overlay(
                        Circle()
                            .stroke(member.isSelected ? SMAPTheme.Color.primary : Color.clear, lineWidth: 2.5)
                    )
                    
                    // Crown/Star Icon
                    if member.isOwner {
                        Circle()
                            .fill(Color.yellow)
                            .frame(width: 16, height: 16)
                            .overlay(Image(systemName: "crown.fill").font(.suite(size: 8)).foregroundColor(.white))
                            .offset(x: 4, y: 4)
                    } else if member.isLeader {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 16, height: 16)
                            .overlay(Image(systemName: "star.fill").font(.suite(size: 8)).foregroundColor(.white))
                            .offset(x: 4, y: 4)
                    }
                }
                .frame(width: 52, height: 52)
                
                // Member Info
                VStack(alignment: .leading, spacing: 2) {
                    Text(member.displayName)
                        .font(.suite(size: 17, weight: .medium))
                        .foregroundColor(.primary)
                    
                    Text("장소 \(member.locationCount)개")
                        .font(.suite(size: 13))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                if member.isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(SMAPTheme.Color.primary)
                        .font(.suite(size: 22))
                }
            }
            .padding(12)
            .background(member.isSelected ? SMAPTheme.Color.primary.opacity(0.05) : Color.white.opacity(0.6))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(member.isSelected ? SMAPTheme.Color.primary.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .frame(width: 44, height: 44)
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    // Helper function to construct proper profile image URL
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

// MARK: - Map View (Wrapper)

struct MyPlaceMapView: UIViewRepresentable {
    let locations: [SavedLocation]
    @Binding var selectedLocation: SavedLocation?
    let onLocationTap: (SavedLocation) -> Void
    let onMapTap: (Double, Double) -> Void
    
    func makeUIView(context: Context) -> NMFMapView {
        let mapView = NMFMapView()
        mapView.positionMode = .disabled
        mapView.logoAlign = .leftBottom
        mapView.zoomLevel = 15
        
        // 사용자의 현재 위치로 초기화 (LocationManager에서 가져옴)
        var initialLat: Double = 37.5665  // 기본값은 서울
        var initialLng: Double = 126.9780

        // 현재 기기의 마지막 위치 사용
        let lastLocation = LocationManager.shared.lastLocation ?? CLLocation(latitude: 37.5665, longitude: 126.978)
        if lastLocation.coordinate.latitude != 0.0 && lastLocation.coordinate.longitude != 0.0 {
            initialLat = lastLocation.coordinate.latitude
            initialLng = lastLocation.coordinate.longitude
            print("📍 [MyPlaceMapView] Using device location: (\(initialLat), \(initialLng))")
        } else {
            print("📍 [MyPlaceMapView] No device location, using Seoul default")
        }
        
        let defaultPosition = NMGLatLng(lat: initialLat, lng: initialLng)
        mapView.moveCamera(NMFCameraUpdate(scrollTo: defaultPosition))
        
        // 맵 탭 이벤트
        mapView.touchDelegate = context.coordinator
        
        return mapView
    }
    
    func updateUIView(_ mapView: NMFMapView, context: Context) {
        // 기존 마커 제거
        context.coordinator.clearMarkers()
        
        // 새 마커 추가
        for location in locations {
            let marker = NMFMarker()
            marker.position = NMGLatLng(lat: location.latitude, lng: location.longitude)
            marker.captionText = location.name
            marker.captionTextSize = 12
            marker.captionColor = UIColor.black
            marker.captionHaloColor = UIColor.white
            
            // 선택된 장소 강조
            if selectedLocation?.slt_idx == location.slt_idx {
                marker.iconImage = NMFOverlayImage(name: "ic_marker_selected")
                marker.width = 40
                marker.height = 50
            } else {
                marker.iconImage = NMFOverlayImage(name: "ic_marker_default")
                marker.width = 30
                marker.height = 40
            }
            
            marker.touchHandler = { [weak context] _ in
                context?.coordinator.onLocationTap(location)
                return true
            }
            
            marker.mapView = mapView
            context.coordinator.markers.append(marker)
        }
        
        // 선택된 장소로 카메라 이동
        if let selected = selectedLocation {
            let position = NMGLatLng(lat: selected.latitude, lng: selected.longitude)
            mapView.moveCamera(NMFCameraUpdate(scrollTo: position))
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(onLocationTap: onLocationTap, onMapTap: onMapTap)
    }
    
    class Coordinator: NSObject, NMFMapViewTouchDelegate {
        var markers: [NMFMarker] = []
        let onLocationTap: (SavedLocation) -> Void
        let onMapTap: (Double, Double) -> Void
        
        init(onLocationTap: @escaping (SavedLocation) -> Void, onMapTap: @escaping (Double, Double) -> Void) {
            self.onLocationTap = onLocationTap
            self.onMapTap = onMapTap
        }
        
        func clearMarkers() {
            for marker in markers {
                marker.mapView = nil
            }
            markers.removeAll()
        }
        
        func mapView(_ mapView: NMFMapView, didTapMap latlng: NMGLatLng, point: CGPoint) {
            onMapTap(latlng.lat, latlng.lng)
        }
    }
}

// MARK: - Preview

struct MyPlaceView_Previews: PreviewProvider {
    static var previews: some View {
        MyPlaceView()
    }
}
