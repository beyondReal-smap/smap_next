// ActivityLogView.swift
// smap
// 활동 로그 메인 뷰

import SwiftUI
import NMapsMap

// MARK: - ActivityLog Main View

struct ActivityLogView: View {
    @StateObject private var viewModel = ActivityLogViewModel()
    
    @State private var sidebarDragOffset: CGFloat = 0
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let sidebarWidth: CGFloat = 320
    
    var body: some View {
        ZStack(alignment: .leading) {
            // 1. Map Layer
            ActivityLogMapView(
                mapMarkers: viewModel.mapMarkers,
                stayTimes: viewModel.stayTimes,
                sliderValue: viewModel.sliderValue,
                isSliderDragging: viewModel.isSliderDragging
            )
            .edgesIgnoringSafeArea(.all)
            .offset(y: 60)
            
            // 2. Header
            VStack {
                ActivityLogHeaderView()
                Spacer()
            }
            
            // 3. Floating Info Card
            if viewModel.selectedMemberId != nil {
                VStack {
                    ActivityLogFloatingCard(
                        memberName: selectedMemberName,
                        memberPhoto: selectedMemberPhoto,
                        displayDate: viewModel.displayDate,
                        distance: viewModel.formattedDistance,
                        duration: viewModel.formattedDuration,
                        steps: viewModel.formattedSteps,
                        isLoading: viewModel.isLoading,
                        onTap: {
                            viewModel.toggleSidebar()
                        }
                    )
                    .padding(.horizontal, 20)
                    .padding(.top, 76)
                    
                    Spacer()
                }
            }
            
            // 4. Path Slider (Bottom Left)
            if !viewModel.sortedMapMarkers.isEmpty {
                VStack {
                    Spacer()
                    HStack {
                        PathSliderView(
                            sliderValue: $viewModel.sliderValue,
                            isSliderDragging: $viewModel.isSliderDragging
                        )
                        .padding(.leading, 16)
                        .padding(.bottom, 90)
                        
                        Spacer()
                    }
                }
            }
            
            // 5. Sidebar Overlay
            if viewModel.isSidebarOpen || sidebarDragOffset > 0 {
                Color.black.opacity(overlayOpacity)
                    .edgesIgnoringSafeArea(.all)
                    .onTapGesture {
                        viewModel.closeSidebar()
                    }
                    .transition(.opacity)
            }
            
            // 6. Sidebar
            ActivityLogSidebarView(viewModel: viewModel)
                .frame(width: sidebarWidth)
                .offset(x: sidebarOffset)
                .gesture(sidebarDragGesture)
                .zIndex(100)
            
            // 7. Edge Swipe Detection
            if !viewModel.isSidebarOpen {
                Color.clear
                    .frame(width: 20)
                    .contentShape(Rectangle())
                    .gesture(edgeSwipeGesture)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // 8. FAB
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    FloatingActionLogButton(count: viewModel.memberDailyCounts.count) {
                        viewModel.toggleSidebar()
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
                }
            }
            
            // 9. Loading Overlay
            if viewModel.isLoading && viewModel.mapMarkers.isEmpty {
                Color.black.opacity(0.3)
                    .edgesIgnoringSafeArea(.all)
                    .overlay(
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(1.5)
                    )
            }
        }
        .navigationBarHidden(true)
        .task {
            // 초기 데이터 로드 (그룹 목록 + 첫 그룹 선택 + 일별 카운트)
            await viewModel.loadInitialData()
        }
        .alert(isPresented: $viewModel.showError) {
            Alert(
                title: Text("오류"),
                message: Text(viewModel.errorMessage ?? "알 수 없는 오류가 발생했습니다."),
                dismissButton: .default(Text("확인"))
            )
        }
        .onDisappear {
            // 페이지를 벗어날 때 사이드바 자동 닫기
            viewModel.closeSidebar()
        }
    }
    
    // MARK: - Computed Properties
    
    private var selectedMemberName: String {
        guard let memberId = viewModel.selectedMemberId else { return "" }
        return viewModel.memberDailyCounts.first { $0.member_id == memberId }?.displayName ?? ""
    }
    
    private var selectedMemberPhoto: String? {
        guard let memberId = viewModel.selectedMemberId else { return nil }
        return viewModel.memberDailyCounts.first { $0.member_id == memberId }?.member_photo
    }
    
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
                    viewModel.isSidebarOpen = true
                    sidebarDragOffset = 0
                } else {
                    viewModel.isSidebarOpen = false
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

struct ActivityLogHeaderView: View {
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("활동 로그")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("그룹 멤버들의 활동 기록을 확인해보세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Color.white.opacity(0.95)
                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
                .edgesIgnoringSafeArea(.top)
        )
    }
}

// MARK: - Floating Info Card

struct ActivityLogFloatingCard: View {
    let memberName: String
    let memberPhoto: String?
    let displayDate: String
    let distance: String
    let duration: String
    let steps: String
    let isLoading: Bool
    let onTap: () -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Member Info
                HStack(spacing: 10) {
                    // Avatar
                    ZStack(alignment: .bottomTrailing) {
                        Group {
                            if let url = getProfileImageUrl(memberPhoto) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                    default:
                                        defaultAvatar
                                    }
                                }
                            } else {
                                defaultAvatar
                            }
                        }
                        .frame(width: 36, height: 36)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .shadow(color: Color.black.opacity(0.1), radius: 2)
                        
                        // Online indicator
                        Circle()
                            .fill(Color.green)
                            .frame(width: 10, height: 10)
                            .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                            .offset(x: 2, y: 2)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Text(memberName)
                                .font(.suite(size: 14, weight: .bold))
                                .foregroundColor(.black)
                            Text("의 기록")
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                        }
                        
                        Text(displayDate)
                            .font(.suite(size: 12, weight: .medium))
                            .foregroundColor(brandColor)
                    }
                }
                
                // Divider
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(width: 1, height: 32)
                
                // Stats
                if isLoading {
                    ProgressView()
                        .frame(width: 100)
                } else {
                    HStack(spacing: 12) {
                        StatItem(icon: "arrow.up.right", color: .red, value: distance)
                        StatItem(icon: "clock", color: .yellow, value: duration)
                        StatItem(icon: "figure.walk", color: .blue, value: steps)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white)
                    .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 4)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

struct StatItem: View {
    let icon: String
    let color: Color
    let value: String
    
    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(color.opacity(0.8))
                .frame(width: 24, height: 24)
                .overlay(
                    Image(systemName: icon)
                        .font(.suite(size: 10, weight: .bold))
                        .foregroundColor(.white)
                )
            
            Text(value)
                .font(.suite(size: 10, weight: .semibold))
                .foregroundColor(.gray)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(minWidth: 50)
    }
}

// MARK: - Path Slider View

struct PathSliderView: View {
    @Binding var sliderValue: Double
    @Binding var isSliderDragging: Bool
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack(spacing: 8) {
                Circle()
                    .fill(brandColor)
                    .frame(width: 20, height: 20)
                    .overlay(
                        Image(systemName: "play.fill")
                            .font(.suite(size: 8))
                            .foregroundColor(.white)
                    )
                
                Text("경로 따라가기")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(.black)
            }
            
            // Slider
            VStack(spacing: 8) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        // Track
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 8)
                        
                        // Progress
                        RoundedRectangle(cornerRadius: 4)
                            .fill(brandColor)
                            .frame(width: max(0, geometry.size.width * CGFloat(sliderValue / 100)), height: 8)
                        
                        // Thumb
                        Circle()
                            .fill(brandColor)
                            .frame(width: 20, height: 20)
                            .overlay(
                                Circle()
                                    .fill(Color.white)
                                    .frame(width: 6, height: 6)
                            )
                            .shadow(radius: 2)
                            .offset(x: max(0, min(geometry.size.width - 20, geometry.size.width * CGFloat(sliderValue / 100) - 10)))
                            .scaleEffect(isSliderDragging ? 1.2 : 1.0)
                    }
                    .frame(height: 24)
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                isSliderDragging = true
                                let percentage = min(100, max(0, Double(value.location.x / geometry.size.width) * 100))
                                sliderValue = percentage
                            }
                            .onEnded { _ in
                                isSliderDragging = false
                            }
                    )
                }
                .frame(height: 24)
                
                // Labels
                HStack {
                    Text("시작")
                        .font(.suite(size: 10))
                        .foregroundColor(.gray)
                    
                    Spacer()
                    
                    Text("\(Int(sliderValue))%")
                        .font(.suite(size: 10, weight: .semibold))
                        .foregroundColor(brandColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(brandColor.opacity(0.1))
                        .cornerRadius(8)
                    
                    Spacer()
                    
                    Text("종료")
                        .font(.suite(size: 10))
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(12)
        .frame(width: 210)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.95))
                .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
        )
    }
}

// MARK: - FAB

struct FloatingActionLogButton: View {
    let count: Int
    let action: () -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let greenColor = Color(red: 34/255, green: 197/255, blue: 94/255)
    
    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                Circle()
                    .fill(brandColor)
                    .frame(width: 56, height: 56)
                    .shadow(color: brandColor.opacity(0.3), radius: 12, x: 0, y: 8)
                    .overlay(
                        Image(systemName: "chart.bar.fill")
                            .font(.suite(size: 22))
                            .foregroundColor(.white)
                    )
                
                if count > 0 {
                    Text(count > 99 ? "99+" : "\(count)")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .frame(minWidth: 24, minHeight: 24)
                        .background(greenColor)
                        .clipShape(Circle())
                        .offset(x: 4, y: -4)
                }
            }
        }
    }
}

// MARK: - Map View

struct ActivityLogMapView: UIViewRepresentable {
    let mapMarkers: [MapMarker]
    let stayTimes: [StayTime]
    let sliderValue: Double
    let isSliderDragging: Bool
    
    func makeUIView(context: Context) -> NMFMapView {
        let mapView = NMFMapView()
        mapView.positionMode = .disabled
        mapView.logoAlign = .leftBottom
        mapView.zoomLevel = 15
        
        // 기본 위치 (서울)
        let defaultPosition = NMGLatLng(lat: 37.5665, lng: 126.9780)
        mapView.moveCamera(NMFCameraUpdate(scrollTo: defaultPosition))
        
        return mapView
    }
    
    func updateUIView(_ mapView: NMFMapView, context: Context) {
        // 기존 오버레이 제거
        context.coordinator.clearOverlays()
        
        guard !mapMarkers.isEmpty else { return }
        
        // 정렬된 마커
        let sortedMarkers = mapMarkers.sorted { ($0.mlt_gps_time ?? "") < ($1.mlt_gps_time ?? "") }
        
        // 폴리라인 그리기
        var coords: [NMGLatLng] = []
        for marker in sortedMarkers {
            if marker.latitude != 0 && marker.longitude != 0 {
                coords.append(NMGLatLng(lat: marker.latitude, lng: marker.longitude))
            }
        }
        
        if coords.count >= 2 {
            let polyline = NMFPolylineOverlay(coords)
            polyline?.color = UIColor(red: 1/255, green: 19/255, blue: 163/255, alpha: 1)
            polyline?.width = 4
            polyline?.mapView = mapView
            context.coordinator.polyline = polyline
        }
        
        // 시작/종료 마커
        if let first = sortedMarkers.first, first.latitude != 0 {
            let startMarker = NMFMarker()
            startMarker.position = NMGLatLng(lat: first.latitude, lng: first.longitude)
            startMarker.captionText = "시작"
            startMarker.captionTextSize = 12
            startMarker.iconImage = NMFOverlayImage(name: "ic_marker_start")
            startMarker.width = 30
            startMarker.height = 40
            startMarker.mapView = mapView
            context.coordinator.markers.append(startMarker)
        }
        
        if sortedMarkers.count > 1, let last = sortedMarkers.last, last.latitude != 0 {
            let endMarker = NMFMarker()
            endMarker.position = NMGLatLng(lat: last.latitude, lng: last.longitude)
            endMarker.captionText = "종료"
            endMarker.captionTextSize = 12
            endMarker.iconImage = NMFOverlayImage(name: "ic_marker_end")
            endMarker.width = 30
            endMarker.height = 40
            endMarker.mapView = mapView
            context.coordinator.markers.append(endMarker)
        }
        
        // 현재 슬라이더 위치 마커 및 카메라 이동
        if !sortedMarkers.isEmpty {
            let index = Int(Double(sortedMarkers.count - 1) * sliderValue / 100.0)
            let clampedIndex = max(0, min(index, sortedMarkers.count - 1))
            let currentMarker = sortedMarkers[clampedIndex]
            
            if currentMarker.latitude != 0 {
                let posMarker = NMFMarker()
                posMarker.position = NMGLatLng(lat: currentMarker.latitude, lng: currentMarker.longitude)
                posMarker.iconImage = NMFOverlayImage(name: "ic_marker_current")
                posMarker.width = 24
                posMarker.height = 24
                posMarker.zIndex = 100
                posMarker.mapView = mapView
                context.coordinator.currentPositionMarker = posMarker
                
                // 슬라이더 드래그 중이거나 슬라이더 값이 변경되면 현재 위치로 카메라 이동 (애니메이션 없이 즉시)
                let currentPosition = NMGLatLng(lat: currentMarker.latitude, lng: currentMarker.longitude)
                let cameraUpdate = NMFCameraUpdate(scrollTo: currentPosition)
                cameraUpdate.animation = .none  // 애니메이션 없이 즉시 이동
                mapView.moveCamera(cameraUpdate)
            }
        } else if let first = sortedMarkers.first, first.latitude != 0 {
            // 마커가 없을 때만 첫 위치로 이동
            let position = NMGLatLng(lat: first.latitude, lng: first.longitude)
            mapView.moveCamera(NMFCameraUpdate(scrollTo: position))
        }
        
        // 체류 시간 마커
        for stayTime in stayTimes {
            if stayTime.stayLatitude != 0 && stayTime.stayLongitude != 0 {
                let stayMarker = NMFMarker()
                stayMarker.position = NMGLatLng(lat: stayTime.stayLatitude, lng: stayTime.stayLongitude)
                stayMarker.captionText = stayTime.formattedDuration
                stayMarker.captionTextSize = 10
                stayMarker.subCaptionText = stayTime.location ?? ""
                stayMarker.subCaptionTextSize = 9
                stayMarker.iconImage = NMFOverlayImage(name: "ic_marker_stay")
                stayMarker.width = 24
                stayMarker.height = 24
                stayMarker.mapView = mapView
                context.coordinator.stayMarkers.append(stayMarker)
            }
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject {
        var markers: [NMFMarker] = []
        var stayMarkers: [NMFMarker] = []
        var polyline: NMFPolylineOverlay?
        var currentPositionMarker: NMFMarker?
        
        func clearOverlays() {
            for marker in markers {
                marker.mapView = nil
            }
            markers.removeAll()
            
            for marker in stayMarkers {
                marker.mapView = nil
            }
            stayMarkers.removeAll()
            
            polyline?.mapView = nil
            polyline = nil
            
            currentPositionMarker?.mapView = nil
            currentPositionMarker = nil
        }
    }
}

// MARK: - Preview

struct ActivityLogView_Previews: PreviewProvider {
    static var previews: some View {
        ActivityLogView()
    }
}
