//
// MyPlaceView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import NMapsMap

// MARK: - MyPlace View

struct MyPlaceView: View {
    @StateObject private var viewModel = MyPlaceViewModel()
    @Environment(\.presentationMode) var presentationMode
    @State private var sidebarDragOffset: CGFloat = 0
    @State private var newLocationCoordinates: (lat: Double, lng: Double)?
    @State private var newLocationName: String? = nil
    @State private var newLocationAddress: String? = nil
    @State private var isMapLoading = true  // 지도 로딩 상태
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let sidebarWidth: CGFloat = 320
    
    var body: some View {
        ZStack(alignment: .leading) {
            // Map
            // Map - Render only after loading to ensure initial coordinates are set
            if !viewModel.isLoading {
                MyPlaceMapView(
                    locations: viewModel.locations,
                    selectedLocation: $viewModel.selectedLocation,
                    targetCoordinate: $viewModel.targetCoordinate,
                    initialCenter: viewModel.initialMapCenter,
                    onLocationTap: { viewModel.selectLocationFromMarker($0) },
                    onMapTap: { lat, lng in 
                        Task {
                            let address = try? await KakaoLocationSearchService.shared.reverseGeocode(latitude: lat, longitude: lng)
                            newLocationCoordinates = (lat, lng)
                            newLocationName = nil // Leave empty for user to fill
                            newLocationAddress = address ?? ""
                            viewModel.startNewLocation(latitude: lat, longitude: lng)
                        }
                    })
                .edgesIgnoringSafeArea(.all).offset(y: 60)
            }
            
            // Header
            VStack { 
                MyPlaceHeaderView(
                    onBackTap: { presentationMode.wrappedValue.dismiss() }, 
                    onSearchTap: { viewModel.isHeaderSearchPresented = true }
                )
                Spacer() 
            }
            
            // Sidebar Overlay
            if viewModel.isSidebarOpen || sidebarDragOffset > 0 {
                Color.black.opacity(overlayOpacity).edgesIgnoringSafeArea(.all).onTapGesture { viewModel.closeSidebar() }
            }
            
            // Sidebar
            MyPlaceSidebarView(viewModel: viewModel).frame(width: sidebarWidth).offset(x: sidebarOffset).gesture(sidebarDragGesture).zIndex(100)
            
            // Edge Swipe
            if !viewModel.isSidebarOpen {
                Color.clear.frame(width: 20).contentShape(Rectangle()).gesture(edgeSwipeGesture).frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // FAB
            VStack { Spacer(); HStack { Spacer(); FloatingActionPlaceButton(count: viewModel.members.count) { viewModel.toggleSidebar() }.padding(.trailing, 20).padding(.bottom, 20) } }
            
            // Loading
            
            if isMapLoading {
                MapLoadingOverlay()
                    .transition(AnyTransition.opacity)
                    .zIndex(1000)
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            handleLoading()
        }
        .task { await viewModel.loadInitialData() }
        .sheet(isPresented: $viewModel.isLocationPanelOpen) { 
            LocationDetailPanel(
                viewModel: viewModel, 
                initialCoordinates: newLocationCoordinates,
                initialName: newLocationName,
                initialAddress: newLocationAddress
            ) 
        }
        .sheet(isPresented: $viewModel.isHeaderSearchPresented) {
            NavigationView {
                LocationSearchView { place in
                    if let lat = Double(place.y), let lng = Double(place.x) {
                        newLocationCoordinates = (lat, lng)
                        newLocationName = place.place_name
                        newLocationAddress = place.road_address_name.isEmpty ? place.address_name : place.road_address_name
                        
                        viewModel.targetCoordinate = (lat: lat, lng: lng)
                        viewModel.selectedLocation = nil
                        viewModel.isEditMode = true
                        viewModel.isLocationPanelOpen = true
                        viewModel.isHeaderSearchPresented = false
                    }
                }
                .navigationBarItems(leading: Button(action: { viewModel.isHeaderSearchPresented = false }) {
                    Text("취소")
                        .font(.suite(size: 16))
                })
            }
        }
        .alert(isPresented: $viewModel.showError) { Alert(title: Text("오류"), message: Text(viewModel.errorMessage ?? ""), dismissButton: .default(Text("확인"))) }
        .onDisappear {
            // 페이지를 벗어날 때 사이드바 자동(즉시) 닫기
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
            // 다시 돌아올 때를 위해 로딩 상태 리셋
            isMapLoading = true
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("closeSidebars"))) { notification in
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
            if let targetTab = notification.object as? Int, targetTab == 3 {
                isMapLoading = true
                handleLoading()
            }
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
    
    private var sidebarOffset: CGFloat { viewModel.isSidebarOpen ? max(0, sidebarDragOffset) : min(0, -sidebarWidth + sidebarDragOffset) }
    private var overlayOpacity: Double { let progress = viewModel.isSidebarOpen ? 1.0 - Double(max(0, -sidebarDragOffset)) / Double(sidebarWidth) : Double(sidebarDragOffset) / Double(sidebarWidth); return 0.4 * max(0, min(1, progress)) }
    
    private var edgeSwipeGesture: some Gesture {
        DragGesture().onChanged { if $0.translation.width > 0 { sidebarDragOffset = min(sidebarWidth, $0.translation.width) } }
        .onEnded { if $0.translation.width > sidebarWidth * 0.3 { viewModel.openSidebar() } else { viewModel.closeSidebar() }; sidebarDragOffset = 0 }
    }
    
    private var sidebarDragGesture: some Gesture {
        DragGesture().onChanged { sidebarDragOffset = $0.translation.width }
        .onEnded { if viewModel.isSidebarOpen && $0.translation.width < -sidebarWidth * 0.3 { viewModel.closeSidebar() }; withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { sidebarDragOffset = 0 } }
    }
}

struct MyPlaceHeaderView: View {
    let onBackTap: () -> Void
    let onSearchTap: () -> Void
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
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
            
            Button(action: onSearchTap) {
                Image(systemName: "magnifyingglass")
                    .font(.suite(size: 20))
                    .foregroundColor(.gray)
            }
            .frame(width: 36, height: 44)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            BlurView(style: .systemUltraThinMaterialLight)
                .edgesIgnoringSafeArea(.top)
        )
    }
}

struct FloatingActionPlaceButton: View {
    let count: Int
    let action: () -> Void
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255) // Pink-500
    
    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                // Main Button Circle
                Circle()
                    .fill(brandColor)
                    .frame(width: 56, height: 56)
                    .shadow(color: brandColor.opacity(0.3), radius: 12, x: 0, y: 8)
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

struct MyPlaceSidebarView: View {
    @ObservedObject var viewModel: MyPlaceViewModel
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            sidebarHeader
                .padding(.top, 20)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Group Selector Section
                    groupSelectorSection
                    
                    // Member Horizontal Selector
                    memberSelectorSection
                    
                    // Location List Section
                    locationListSection
                }
                .padding(.bottom, 40)
            }
        }
        .frame(width: 320)
        .background(
            Color(red: 245/255, green: 247/255, blue: 250/255)
                .edgesIgnoringSafeArea(.all)
        )
        .cornerRadius(24, corners: [.topRight, .bottomRight])
        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 5, y: 0)
    }
    
    // MARK: - Sections
    
    private var sidebarHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(brandColor)
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
    }
    
    private var groupSelectorSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Circle().fill(Color.red).frame(width: 8, height: 8)
                Text("그룹 선택").font(.suite(size: 16, weight: .bold))
            }
            
            Menu {
                ForEach(viewModel.groups) { group in
                    Button(group.sgt_title ?? "이름 없음") { viewModel.selectGroup(group) }
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
    }
    
    private var memberSelectorSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Circle().fill(Color.blue).frame(width: 8, height: 8)
                Text("멤버 선택").font(.suite(size: 16, weight: .bold))
                Spacer()
                Text("\(viewModel.members.count)명")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
            }
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    let currentUserIdx = AuthService.shared.getUserData()?.mt_idx
                    ForEach(viewModel.members) { member in
                        PlaceMemberCircleCell(
                            member: member,
                            isSelf: member.mt_idx == currentUserIdx
                        ) {
                            viewModel.selectMember(member)
                        }
                    }
                }
                .padding(.horizontal, 2)
                .padding(.vertical, 4)
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
        .padding(.horizontal, 20)
    }
    
    private var locationListSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Circle().fill(Color.green).frame(width: 8, height: 8)
                Text("장소 목록").font(.suite(size: 16, weight: .bold))
                Spacer()
                if let selected = viewModel.selectedMember {
                    Text("\(selected.displayName)님의 장소")
                        .font(.suite(size: 13))
                        .foregroundColor(.secondary)
                }
            }
            
            if viewModel.isLoadingLocations {
                HStack { Spacer(); ProgressView().padding(); Spacer() }
            } else if viewModel.locations.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "mappin.slash")
                        .font(.system(size: 30))
                        .foregroundColor(.gray.opacity(0.4))
                    Text("등록된 장소가 없습니다")
                        .font(.suite(size: 15))
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
            } else {
                VStack(spacing: 10) {
                    ForEach(viewModel.locations) { location in
                        PlaceLocationCell(
                            location: location,
                            isSelected: viewModel.selectedLocation?.slt_idx == location.slt_idx,
                            canManage: viewModel.canManageLocation(location),
                            onToggleNotification: {
                                Task { await viewModel.toggleNotification(for: location) }
                            }
                        ) {
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
    }
}


struct PlaceMemberCell: View {
    let member: PlaceMember
    var isSelf: Bool = false
    let onTap: () -> Void
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
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
                            .stroke(member.isSelected ? brandColor : Color.clear, lineWidth: 2.5)
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
                    Text(isSelf ? "\(member.displayName) (나)" : member.displayName)
                        .font(.suite(size: 17, weight: .medium))
                        .foregroundColor(.primary)
                    Text("장소 \(member.locationCount)개")
                        .font(.suite(size: 13))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                if member.isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(brandColor)
                        .font(.suite(size: 22))
                }
            }
            .padding(12)
            .background(member.isSelected ? brandColor.opacity(0.05) : Color.white)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(member.isSelected ? brandColor.opacity(0.3) : Color.clear, lineWidth: 1)
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

// MARK: - New Member Circle Cell for Horizontal selector

struct PlaceMemberCircleCell: View {
    let member: PlaceMember
    var isSelf: Bool = false
    let onTap: () -> Void
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                ZStack(alignment: .bottomTrailing) {
                    // Profile Image
                    Group {
                        if let url = getProfileImageUrl(member.mt_file1) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .empty:
                                    ProgressView().frame(width: 48, height: 48)
                                case .success(let image):
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 48, height: 48)
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
                            .stroke(member.isSelected ? brandColor : Color.gray.opacity(0.2), lineWidth: 2)
                    )
                    
                    // Owner/Leader Badge
                    if member.isOwner {
                        Circle()
                            .fill(Color.yellow)
                            .frame(width: 14, height: 14)
                            .overlay(Image(systemName: "crown.fill").font(.system(size: 7)).foregroundColor(.white))
                            .offset(x: 2, y: 2)
                    } else if member.isLeader {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 14, height: 14)
                            .overlay(Image(systemName: "star.fill").font(.system(size: 7)).foregroundColor(.white))
                            .offset(x: 2, y: 2)
                    }
                }
                
                Text(isSelf ? "\(member.displayName) (나)" : member.displayName)
                    .font(.suite(size: 13, weight: member.isSelected ? .bold : .medium))
                    .foregroundColor(member.isSelected ? brandColor : .primary)
                    .lineLimit(1)
                    .frame(width: 65)
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .frame(width: 48, height: 48)
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

// MARK: - Place Location Cell

struct PlaceLocationCell: View {
    let location: SavedLocation
    let isSelected: Bool
    let canManage: Bool
    let onToggleNotification: () -> Void
    let onTap: () -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        ZStack(alignment: .trailing) {
            // Base layer: Main row content (tappable for selection)
            Button(action: onTap) {
                HStack(spacing: 12) {
                    // Location Info
                    VStack(alignment: .leading, spacing: 3) {
                        Text(location.name)
                            .font(.suite(size: 16, weight: .medium))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                        Text(location.address)
                            .font(.suite(size: 10))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    
                    Spacer()
                    
                    // Placeholder for bell button (important: disable hit testing)
                    Color.clear
                        .frame(width: 40, height: 40)
                        .allowsHitTesting(false)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(isSelected ? brandColor.opacity(0.08) : Color.white.opacity(0.6))
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isSelected ? brandColor.opacity(0.3) : Color.clear, lineWidth: 1)
                )
            }
            .buttonStyle(PlainButtonStyle())
            
            // Top layer: Notification Toggle Button (independent touch target)
            if canManage {
                Button(action: onToggleNotification) {
                    Image(systemName: location.notifications ? "bell.fill" : "bell.slash")
                        .font(.system(size: 14))
                        .foregroundColor(location.notifications ? .orange : .gray.opacity(0.4))
                        .frame(width: 36, height: 36)
                        .background(Color.white)
                        .clipShape(Circle())
                        .shadow(color: Color.black.opacity(0.08), radius: 2, x: 0, y: 1)
                        .contentShape(Circle())
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.trailing, 12)
            }
        }
    }
}

struct MyPlaceMapView: UIViewRepresentable {
    let locations: [SavedLocation]
    @Binding var selectedLocation: SavedLocation?
    @Binding var targetCoordinate: (lat: Double, lng: Double)?
    var initialCenter: (lat: Double, lng: Double)?  // Initial center for map initialization
    let onLocationTap: (SavedLocation) -> Void
    let onMapTap: (Double, Double) -> Void
    
    func makeUIView(context: Context) -> NMFMapView {
        let mapView = NMFMapView()
        mapView.positionMode = .disabled
        mapView.logoAlign = .leftBottom
        mapView.zoomLevel = 15
        
        // 사용자의 현재 위치로 초기화 (LocationService에서 가져옴)
        var userLat: Double = 37.5665  // 기본값은 서울
        var userLng: Double = 126.9780
        
        // 현재 기기의 마지막 위치 사용 (getLastLocation은 non-optional)
        let lastLocation = LocationService.sharedInstance.getLastLocation()
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
        // Update markers
        context.coordinator.clearMarkers()
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
        func mapView(_ mapView: NMFMapView, didTapMap latlng: NMGLatLng, point: CGPoint) { onMapTap(latlng.lat, latlng.lng) }
    }
}
