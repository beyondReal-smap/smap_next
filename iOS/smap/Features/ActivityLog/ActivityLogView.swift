//
// ActivityLogView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import UIKit
import NMapsMap

// MARK: - ActivityLog Main View
//
// 지도는 화면 전체, 위쪽 떠 있는 그룹 알약 + 아래 남색 머리 시트(날짜·요약·경로 따라가기·멤버).
// 이전의 왼쪽 사이드바·떠 있는 요약 카드·떠 있는 경로 막대·멤버 버튼을 대신한다(Android 와 같은 구조).

struct ActivityLogView: View {
    /// 지금 보이는 탭인지 — 탭 컨테이너가 이 화면을 계속 살려 둔다.
    var isActive: Bool = true
    @StateObject private var viewModel = ActivityLogViewModel()
    @State private var isSheetExpanded = false
    @State private var showGroupPicker = false
    @State private var hasLoadedOnce = false

    private var currentUserIdx: Int? { AuthService.shared.getUserData()?.mt_idx }

    var body: some View {
        let peek = ActivityLogSheet.peekHeight + (viewModel.sortedMapMarkers.isEmpty ? 0 : ActivityLogSheet.routeControlHeight)
        GeometryReader { geo in
            ZStack(alignment: .top) {
                ActivityLogMapView(
                    mapMarkers: viewModel.mapMarkers,
                    stayTimes: viewModel.stayTimes,
                    sliderValue: viewModel.sliderValue,
                    isSliderDragging: viewModel.isSliderDragging,
                    contentInsets: UIEdgeInsets(top: geo.safeAreaInsets.top + 64, left: 0, bottom: peek, right: 0)
                )
                .ignoresSafeArea(edges: .top)

                MapTopScrim()
                    .frame(height: geo.safeAreaInsets.top + 24)
                    .ignoresSafeArea(edges: .top)

                MapTopControls(groupName: viewModel.selectedGroup?.sgt_title, onGroupTap: { showGroupPicker = true })

                SMAPMapSheet(peekHeight: peek, isExpanded: $isSheetExpanded) {
                    ActivityLogSheetHeader(viewModel: viewModel, currentUserIdx: currentUserIdx)
                } content: {
                    ActivityLogSheetBody(viewModel: viewModel, currentUserIdx: currentUserIdx)
                }
                .animation(.easeOut(duration: 0.2), value: peek)

                if !hasLoadedOnce {
                    MapLoadingOverlay()
                        .transition(.opacity)
                        .zIndex(1000)
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            // 초기 데이터 로드 (그룹 목록 + 첫 그룹 선택 + 일별 카운트).
            // 지도 로딩 막은 처음 한 번만 — 이전에는 탭을 떠날 때마다 다시 켜 돌아올 때마다 깜빡였다.
            await viewModel.loadInitialData()
            withAnimation(.easeOut(duration: 0.3)) { hasLoadedOnce = true }
        }
        .onChange(of: isActive) { _, active in
            if !active { showGroupPicker = false; return }
            // 오늘 기록이 오래됐으면 화면을 가리지 않고 새로 받는다(미리 만들어 둔 탭은 앱을 켤 때 받아 두었다).
            Task { await viewModel.refreshIfStale() }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("groupsDidChange"))) { _ in
            Task { await viewModel.loadInitialData() }
        }
        .sheet(isPresented: $showGroupPicker) {
            GroupPickerSheet(
                groups: viewModel.groups,
                selectedGroupId: viewModel.selectedGroupId,
                onSelect: { group in Task { await viewModel.selectGroupFromPicker(group) } }
            )
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
            Text(viewModel.errorMessage ?? "알 수 없는 오류가 발생했습니다.")
        }
    }
}

// MARK: - Map View

struct ActivityLogMapView: UIViewRepresentable {
    let mapMarkers: [MapMarker]
    let stayTimes: [StayTime]
    let sliderValue: Double
    let isSliderDragging: Bool
    /// 위 조작 줄·아래 시트에 가리는 만큼 — 경로가 보이는 영역 가운데에 오게 한다.
    var contentInsets: UIEdgeInsets = .zero
    
    private let rainbowColors: [UIColor] = [
        UIColor(red: 255/255, green: 138/255, blue: 128/255, alpha: 1), // Pastel Red
        UIColor(red: 255/255, green: 183/255, blue: 77/255, alpha: 1),  // Pastel Orange
        UIColor(red: 255/255, green: 213/255, blue: 79/255, alpha: 1),  // Pastel Yellow
        UIColor(red: 129/255, green: 199/255, blue: 132/255, alpha: 1), // Pastel Green
        UIColor(red: 79/255, green: 195/255, blue: 247/255, alpha: 1),  // Pastel Blue
        UIColor(red: 121/255, green: 134/255, blue: 203/255, alpha: 1), // Pastel Indigo
        UIColor(red: 186/255, green: 104/255, blue: 200/255, alpha: 1)  // Pastel Violet
    ]

    func makeUIView(context: Context) -> NMFMapView {
        let m = NMFMapView()
        m.positionMode = .disabled
        m.logoAlign = .leftBottom
        m.zoomLevel = 15
        
        // 사용자의 현재 위치로 초기화
        let lastLocation = LocationManager.shared.lastLocation ?? CLLocation(latitude: 37.5665, longitude: 126.978)
        if lastLocation.coordinate.latitude != 0.0 && lastLocation.coordinate.longitude != 0.0 {
            let initialPosition = NMGLatLng(lat: lastLocation.coordinate.latitude, lng: lastLocation.coordinate.longitude)
            m.moveCamera(NMFCameraUpdate(scrollTo: initialPosition))
            print("📍 [ActivityLogMapView] Using device location: (\(lastLocation.coordinate.latitude), \(lastLocation.coordinate.longitude))")
        } else {
            print("📍 [ActivityLogMapView] No device location, using default")
        }
        
        return m
    }
    
    func updateUIView(_ mapView: NMFMapView, context: Context) {
        if mapView.contentInset != contentInsets {
            mapView.contentInset = contentInsets
        }
        // 1. Data Processing
        let sorted = mapMarkers.sorted { ($0.mlt_gps_time ?? "") < ($1.mlt_gps_time ?? "") }
        
        var validMarkers: [MapMarker] = []
        var coords: [NMGLatLng] = []
        for marker in sorted {
            if marker.latitude != 0 && marker.longitude != 0 {
                validMarkers.append(marker)
                coords.append(NMGLatLng(lat: marker.latitude, lng: marker.longitude))
            }
        }
        
        // 2. Path Drawing (Only if data changed)
        if context.coordinator.lastMapMarkersCount != mapMarkers.count || context.coordinator.lastMapMarkersCount == 0 {
            context.coordinator.clearOverlays()
            context.coordinator.lastMapMarkersCount = mapMarkers.count
            
            print("📍 [ActivityLogMapView] Redrawing path. Markers: \(validMarkers.count)")
            
            // Draw Gradient Path
            if coords.count >= 2 {
                for i in 0..<(coords.count - 1) {
                    let start = coords[i]
                    let end = coords[i+1]
                    
                    let progress = Double(i) / Double(coords.count - 1)
                    let colorIndex = Int(progress * Double(rainbowColors.count - 1))
                    let nextColorIndex = min(colorIndex + 1, rainbowColors.count - 1)
                    let segmentProgress = (progress * Double(rainbowColors.count - 1)) - Double(colorIndex)
                    
                    let color1 = rainbowColors[colorIndex]
                    let color2 = rainbowColors[nextColorIndex]
                    let interpolatedColor = interpolateColor(color1: color1, color2: color2, factor: CGFloat(segmentProgress))
                    
                    let line = NMFPolylineOverlay([start, end])
                    line?.color = interpolatedColor
                    line?.width = 6
                    line?.mapView = mapView
                    if let line = line {
                        context.coordinator.polylines.append(line)
                    }
                }
                
                // Draw Path Dots
                for i in 0..<coords.count {
                    let progress = Double(i) / Double(coords.count - 1)
                    let colorIndex = Int(progress * Double(rainbowColors.count - 1))
                    let nextColorIndex = min(colorIndex + 1, rainbowColors.count - 1)
                    let segmentProgress = (progress * Double(rainbowColors.count - 1)) - Double(colorIndex)
                    
                    let color1 = rainbowColors[colorIndex]
                    let color2 = rainbowColors[nextColorIndex]
                    let interpolatedColor = interpolateColor(color1: color1, color2: color2, factor: CGFloat(segmentProgress))
                    
                    let dot = NMFMarker()
                    dot.position = coords[i]
                    dot.iconImage = NMFOverlayImage(image: generatePathDotImage(color: interpolatedColor))
                    dot.width = 8
                    dot.height = 8
                    dot.anchor = CGPoint(x: 0.5, y: 0.5)
                    dot.mapView = mapView
                    context.coordinator.pathDotMarkers.append(dot)
                }
                
                // Draw Arrows
                for i in 0..<(coords.count - 1) {
                    if i % 3 == 0, i + 1 < coords.count {
                        let start = coords[i]
                        let end = coords[i+1]
                        
                        let dLon = (end.lng - start.lng) * .pi / 180
                        let y = sin(dLon) * cos(end.lat * .pi / 180)
                        let x = cos(start.lat * .pi / 180) * sin(end.lat * .pi / 180) - sin(start.lat * .pi / 180) * cos(end.lat * .pi / 180) * cos(dLon)
                        var heading = atan2(y, x) * 180 / .pi
                        if heading < 0 { heading += 360 }
                        
                        let progress = Double(i) / Double(coords.count - 1)
                        let colorIndex = Int(progress * Double(rainbowColors.count - 1))
                        let nextColorIndex = min(colorIndex + 1, rainbowColors.count - 1)
                        let segmentProgress = (progress * Double(rainbowColors.count - 1)) - Double(colorIndex)
                        
                        let color1 = rainbowColors[colorIndex]
                        let color2 = rainbowColors[nextColorIndex]
                        let interpolatedColor = interpolateColor(color1: color1, color2: color2, factor: CGFloat(segmentProgress))
                        
                        let arrow = NMFMarker()
                        arrow.position = NMGLatLng(lat: (start.lat + end.lat)/2, lng: (start.lng + end.lng)/2)
                        arrow.iconImage = NMFOverlayImage(image: generateArrowImage(color: interpolatedColor))
                        arrow.angle = heading
                        arrow.width = 12
                        arrow.height = 12
                        arrow.anchor = CGPoint(x: 0.5, y: 0.5)
                        arrow.mapView = mapView
                        context.coordinator.arrowMarkers.append(arrow)
                    }
                }
            }
            
            // Draw Start/End Markers
            if let first = validMarkers.first {
                let m = NMFMarker()
                m.position = NMGLatLng(lat: first.latitude, lng: first.longitude)
                m.iconImage = NMFOverlayImage(image: generateStartEndMarkerImage(text: "S", color: UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1)))
                m.width = 24
                m.height = 24
                m.anchor = CGPoint(x: 0.5, y: 0.5)
                m.mapView = mapView
                context.coordinator.markers.append(m)
                
                // 출발점이 바뀌었을 때(날짜·멤버 변경, 첫 표시)만 카메라를 옮긴다.
                // 이전에는 다시 그릴 때마다 출발점으로 날아가, 새로 받은 점이 붙기만 해도 보던 위치가 초기화됐다.
                let start = NMGLatLng(lat: first.latitude, lng: first.longitude)
                if context.coordinator.lastCameraStart.map({ $0.lat != start.lat || $0.lng != start.lng }) ?? true {
                    context.coordinator.lastCameraStart = start
                    let cameraUpdate = NMFCameraUpdate(scrollTo: start)
                    cameraUpdate.animation = .fly
                    mapView.moveCamera(cameraUpdate)
                }
            }
            
            if let last = validMarkers.last {
                let m = NMFMarker()
                m.position = NMGLatLng(lat: last.latitude, lng: last.longitude)
                m.iconImage = NMFOverlayImage(image: generateStartEndMarkerImage(text: "E", color: UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1)))
                m.width = 24
                m.height = 24
                m.anchor = CGPoint(x: 0.5, y: 0.5)
                m.mapView = mapView
                context.coordinator.markers.append(m)
            }
            
            // Stay Markers
            for (index, stay) in stayTimes.enumerated() {
                if stay.stayLatitude != 0 && stay.stayLongitude != 0 {
                    let m = NMFMarker()
                    m.position = NMGLatLng(lat: stay.stayLatitude, lng: stay.stayLongitude)
                    
                    let durationForColor = stay.duration
                    var color = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1)
                    var size: CGFloat = 26
                    
                    if durationForColor >= 300 { 
                        color = UIColor(red: 220/255, green: 38/255, blue: 38/255, alpha: 1); size = 40
                    } else if durationForColor >= 120 {
                        color = UIColor(red: 234/255, green: 88/255, blue: 12/255, alpha: 1); size = 36
                    } else if durationForColor >= 60 {
                        color = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1); size = 32
                    } else if durationForColor >= 30 {
                        color = UIColor(red: 234/255, green: 179/255, blue: 8/255, alpha: 1); size = 28
                    }
                    
                    let markerResult = generateStayMarkerImage(number: index + 1, duration: stay.formattedDuration, color: color, size: size)
                    
                    m.iconImage = NMFOverlayImage(image: markerResult.image)
                    m.width = CGFloat(markerResult.image.size.width)
                    m.height = CGFloat(markerResult.image.size.height)
                    m.anchor = markerResult.anchor
                    
                    m.mapView = mapView
                    context.coordinator.stayMarkers.append(m)
                }
            }
        }
        
        // 3. Current Position Marker & Camera
        if !validMarkers.isEmpty {
            let index = Int(Double(validMarkers.count - 1) * sliderValue / 100.0)
            let curr = validMarkers[max(0, min(index, validMarkers.count - 1))]
            
            context.coordinator.currentPositionMarker?.mapView = nil
            context.coordinator.currentInfoMarker?.mapView = nil
            
            // Get time and speed from current log
            let timeStr: String
            if let gpsTime = curr.mlt_gps_time {
                let cleanedTime = gpsTime.replacingOccurrences(of: "Z", with: "").components(separatedBy: ".").first ?? gpsTime
                if cleanedTime.count >= 16 {
                    let startIdx = cleanedTime.index(cleanedTime.startIndex, offsetBy: 11)
                    let endIdx = cleanedTime.index(cleanedTime.startIndex, offsetBy: 16)
                    timeStr = String(cleanedTime[startIdx..<endIdx])
                } else {
                    timeStr = "--:--"
                }
            } else {
                timeStr = "--:--"
            }
            let speed = (curr.mlt_speed ?? 0.0) * 3.6
            let speedStr = String(format: "%.1f km/h", speed)
            
            // Current Position Marker (Blue Bordered Circle)
            let m = NMFMarker()
            m.position = NMGLatLng(lat: curr.latitude, lng: curr.longitude)
            m.iconImage = NMFOverlayImage(image: generateCurrentLocationMarkerImage(color: UIColor(red: 1/255, green: 19/255, blue: 163/255, alpha: 1)))
            m.width = 24
            m.height = 24
            m.zIndex = 1000
            m.mapView = mapView
            context.coordinator.currentPositionMarker = m
            
            // Info Capsule Marker (Time + Speed)
            let infoMarker = NMFMarker()
            infoMarker.position = NMGLatLng(lat: curr.latitude, lng: curr.longitude)
            let infoImage = generateCurrentPositionInfoImage(time: timeStr, speed: speedStr)
            infoMarker.iconImage = NMFOverlayImage(image: infoImage)
            infoMarker.width = CGFloat(infoImage.size.width)
            infoMarker.height = CGFloat(infoImage.size.height)
            infoMarker.anchor = CGPoint(x: 0.5, y: 1.0) // Bottom center anchor
            infoMarker.zIndex = 1001
            infoMarker.mapView = mapView
            context.coordinator.currentInfoMarker = infoMarker
            
            let now = Date.timeIntervalSinceReferenceDate
            let coordinator = context.coordinator
            if (isSliderDragging && now - coordinator.lastSliderCameraMove >= 0.1) ||
                (!isSliderDragging && (coordinator.wasSliderDragging || coordinator.lastSliderCameraValue != sliderValue)) {
                let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: curr.latitude, lng: curr.longitude))
                cameraUpdate.animation = .none
                mapView.moveCamera(cameraUpdate)
                coordinator.lastSliderCameraMove = now
                coordinator.lastSliderCameraValue = sliderValue
            }
            coordinator.wasSliderDragging = isSliderDragging
        }
    }
    
    private func interpolateColor(color1: UIColor, color2: UIColor, factor: CGFloat) -> UIColor {
        var r1: CGFloat=0, g1: CGFloat=0, b1: CGFloat=0, a1: CGFloat=0
        var r2: CGFloat=0, g2: CGFloat=0, b2: CGFloat=0, a2: CGFloat=0
        color1.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        color2.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        return UIColor(
            red: r1 + (r2 - r1) * factor,
            green: g1 + (g2 - g1) * factor,
            blue: b1 + (b2 - b1) * factor,
            alpha: 1.0
        )
    }
    
    func makeCoordinator() -> Coordinator { Coordinator() }
    
    private func generateArrowImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 20, height: 20)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let path = UIBezierPath()
            path.move(to: CGPoint(x: 10, y: 0))
            path.addLine(to: CGPoint(x: 20, y: 20))
            path.addLine(to: CGPoint(x: 10, y: 15))
            path.addLine(to: CGPoint(x: 0, y: 20))
            path.close()
            color.setFill()
            path.fill()
        }
    }
    
    private func generatePathDotImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 8, height: 8)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let path = UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: 8, height: 8))
            color.setFill()
            path.fill()
            let borderPath = UIBezierPath(ovalIn: CGRect(x: 0.5, y: 0.5, width: 7, height: 7))
            UIColor.white.setStroke()
            borderPath.lineWidth = 1.0
            borderPath.stroke()
        }
    }
    
    private func generateStayMarkerImage(number: Int, duration: String, color: UIColor, size: CGFloat = 30) -> (image: UIImage, anchor: CGPoint) {
        let bubbleFont = UIFont.suite(size: 11, weight: .medium)
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center
        let bubbleAttrs: [NSAttributedString.Key: Any] = [
            .font: bubbleFont,
            .foregroundColor: UIColor.white,
            .paragraphStyle: paragraphStyle
        ]
        let bubbleSizeCalc = duration.size(withAttributes: bubbleAttrs)
        let bubblePaddingH: CGFloat = 12
        let bubblePaddingV: CGFloat = 4
        let bubbleW = bubbleSizeCalc.width + bubblePaddingH
        let bubbleH = bubbleSizeCalc.height + bubblePaddingV
        let margin: CGFloat = 10
        let markerX: CGFloat = margin
        let initialMarkerY: CGFloat = margin + bubbleH/2 
        let bubbleX = markerX + size - 10
        let bubbleBottom = initialMarkerY + 8
        let bubbleY = bubbleBottom - bubbleH
        let yShift = max(0, margin - bubbleY)
        let finalMarkerY = initialMarkerY + yShift
        let finalBubbleY = bubbleY + yShift
        let canvasW = bubbleX + bubbleW + margin
        let canvasH = max(finalMarkerY + size + margin, finalBubbleY + bubbleH + margin)
        let canvasSize = CGSize(width: canvasW, height: canvasH)
        let renderer = UIGraphicsImageRenderer(size: canvasSize)
        let image = renderer.image { ctx in
            let bubbleRect = CGRect(x: bubbleX, y: finalBubbleY, width: bubbleW, height: bubbleH)
            let bubblePath = UIBezierPath(roundedRect: bubbleRect, cornerRadius: 6)
            UIColor(red: 31/255, green: 41/255, blue: 55/255, alpha: 1).setFill()
            bubblePath.fill()
            let textRect = CGRect(x: bubbleRect.minX, y: bubbleRect.minY + (bubbleRect.height - bubbleSizeCalc.height) / 2, width: bubbleRect.width, height: bubbleSizeCalc.height)
            duration.draw(in: textRect, withAttributes: bubbleAttrs)
            let markerRect = CGRect(x: markerX, y: finalMarkerY, width: size, height: size)
            let circlePath = UIBezierPath(ovalIn: markerRect)
            color.setFill()
            circlePath.fill()
            let borderRect = markerRect.insetBy(dx: 1.5, dy: 1.5)
            let borderPath = UIBezierPath(ovalIn: borderRect)
            UIColor.white.setStroke()
            borderPath.lineWidth = 3
            borderPath.stroke()
            let numberStr = "\(number)"
            let numberFont = UIFont.suite(size: 12, weight: .bold)
            let numberAttrs: [NSAttributedString.Key: Any] = [.font: numberFont, .foregroundColor: UIColor.white, .paragraphStyle: paragraphStyle]
            let numberSize = numberStr.size(withAttributes: numberAttrs)
            let numberRect = CGRect(x: markerRect.midX - numberSize.width/2, y: markerRect.midY - numberSize.height/2, width: numberSize.width, height: numberSize.height)
            numberStr.draw(in: numberRect, withAttributes: numberAttrs)
        }
        let anchorX = (markerX + size/2) / canvasSize.width
        let anchorY = (finalMarkerY + size/2) / canvasSize.height
        return (image: image, anchor: CGPoint(x: anchorX, y: anchorY))
    }
    
    private func generateCurrentLocationMarkerImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 24, height: 24)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            // White circle background
            let circleRect = CGRect(x: 2.5, y: 2.5, width: 19, height: 19)
            let circlePath = UIBezierPath(ovalIn: circleRect)
            UIColor.white.setFill()
            circlePath.fill()
            
            // Color border
            color.setStroke()
            circlePath.lineWidth = 5
            circlePath.stroke()
        }
    }
    
    private func generateStartEndMarkerImage(text: String, color: UIColor) -> UIImage {
        let size = CGSize(width: 24, height: 24)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let rect = CGRect(x: 2, y: 2, width: 20, height: 20)
            let path = UIBezierPath(ovalIn: rect)
            color.setFill()
            path.fill()
            UIColor.white.setStroke()
            path.lineWidth = 2
            path.stroke()
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.alignment = .center
            let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.boldSystemFont(ofSize: 10), .foregroundColor: UIColor.white, .paragraphStyle: paragraphStyle]
            let textSize = text.size(withAttributes: attrs)
            let textRect = CGRect(x: (24 - textSize.width)/2, y: (24 - textSize.height)/2, width: textSize.width, height: textSize.height)
            text.draw(in: textRect, withAttributes: attrs)
        }
    }

    class Coordinator: NSObject {
        var markers: [NMFMarker] = []
        var stayMarkers: [NMFMarker] = []
        var arrowMarkers: [NMFMarker] = []
        var pathDotMarkers: [NMFMarker] = []
        var polylines: [NMFPolylineOverlay] = []
        var currentPositionMarker: NMFMarker?
        var currentInfoMarker: NMFMarker?
        var lastMapMarkersCount: Int = 0
        /// 마지막으로 카메라를 맞춘 출발점 — 같은 경로에 점만 늘어난 경우(조용한 새로고침) 카메라를 되돌리지 않기 위해
        var lastCameraStart: NMGLatLng?
        var lastSliderCameraMove: TimeInterval = 0
        /// 카메라가 마지막으로 따라간 슬라이더 값 — 위치 순번이 아니라 값으로 비교해,
        /// 조용히 새로 받아 점이 늘어 순번만 바뀐 경우엔 카메라를 옮기지 않는다
        var lastSliderCameraValue: Double?
        var wasSliderDragging = false
        
        func clearOverlays() {
            markers.forEach { $0.mapView = nil }
            markers.removeAll()
            stayMarkers.forEach { $0.mapView = nil }
            stayMarkers.removeAll()
            arrowMarkers.forEach { $0.mapView = nil }
            arrowMarkers.removeAll()
            pathDotMarkers.forEach { $0.mapView = nil }
            pathDotMarkers.removeAll()
            polylines.forEach { $0.mapView = nil }
            polylines.removeAll()
            currentPositionMarker?.mapView = nil
            currentPositionMarker = nil
            currentInfoMarker?.mapView = nil
            currentInfoMarker = nil
            lastMapMarkersCount = 0
        }
    }
    
    private func generateCurrentPositionInfoImage(time: String, speed: String) -> UIImage {
        let font = UIFont.suite(size: 12, weight: .bold)
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: UIColor.white,
            .paragraphStyle: paragraphStyle
        ]
        
        let displayText = "\(time)  |  \(speed)"
        let textSize = displayText.size(withAttributes: attrs)
        
        let paddingH: CGFloat = 12
        let paddingV: CGFloat = 6
        let capsuleWidth = textSize.width + paddingH * 2
        let capsuleHeight = textSize.height + paddingV * 2
        let markerBottomPadding: CGFloat = 32 // Gap between capsule and marker
        
        let canvasSize = CGSize(width: capsuleWidth, height: capsuleHeight + markerBottomPadding)
        let renderer = UIGraphicsImageRenderer(size: canvasSize)
        
        return renderer.image { ctx in
            // Draw capsule background
            let capsuleRect = CGRect(x: 0, y: 0, width: capsuleWidth, height: capsuleHeight)
            let capsulePath = UIBezierPath(roundedRect: capsuleRect, cornerRadius: capsuleHeight / 2)
            UIColor(red: 1/255, green: 19/255, blue: 163/255, alpha: 0.9).setFill()
            capsulePath.fill()
            
            // Draw text
            let textRect = CGRect(
                x: (capsuleWidth - textSize.width) / 2,
                y: (capsuleHeight - textSize.height) / 2,
                width: textSize.width,
                height: textSize.height
            )
            displayText.draw(in: textRect, withAttributes: attrs)
        }
    }
}

// MARK: - Preview

struct ActivityLogView_Previews: PreviewProvider {
    static var previews: some View {
        ActivityLogView()
    }
}
