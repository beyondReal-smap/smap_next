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
        // 경로 막대는 늘 있으므로 접힌 높이는 날짜와 상관없이 같다.
        let peek = ActivityLogSheet.peekHeight + ActivityLogSheet.routeControlHeight
        GeometryReader { geo in
            ZStack(alignment: .top) {
                ScrubbedActivityLogMap(
                    scrubber: viewModel.scrubber,
                    mapMarkers: viewModel.sortedMapMarkers,
                    overlayRevision: viewModel.overlayRevision,
                    stayTimes: viewModel.stayTimes,
                    contentInsets: UIEdgeInsets(top: geo.safeAreaInsets.top + 64, left: 0, bottom: peek, right: 0)
                )
                .ignoresSafeArea(edges: .top)

                MapTopScrim()
                    .frame(height: geo.safeAreaInsets.top + 24)
                    .ignoresSafeArea(edges: .top)

                MapTopControls(groupName: viewModel.selectedGroup?.sgt_title, onGroupTap: { showGroupPicker = true })

                SMAPMapSheet(peekHeight: peek, isExpanded: $isSheetExpanded, maxHeightFraction: 0.76, headerSurface: SMAPAccent.activity.container) {
                    ActivityLogSheetHeader(viewModel: viewModel, currentUserIdx: currentUserIdx)
                } content: { _, _ in
                    ActivityLogSheetBody(viewModel: viewModel, currentUserIdx: currentUserIdx)
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
                onSelect: { group in Task { await viewModel.selectGroupFromPicker(group) } },
                compact: true
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

/// 경로 막대 값은 이 뷰에서만 읽는다 — 손가락이 움직일 때 지도만 다시 그리고,
/// 부모(시트 머리줄·날짜줄·멤버줄)는 매 프레임 다시 계산하지 않는다.
private struct ScrubbedActivityLogMap: View {
    let scrubber: ActivityLogScrubberState
    let mapMarkers: [MapMarker]
    let overlayRevision: Int
    let stayTimes: [StayTime]
    let contentInsets: UIEdgeInsets

    var body: some View {
        ActivityLogMapView(
            mapMarkers: mapMarkers,
            overlayRevision: overlayRevision,
            stayTimes: stayTimes,
            sliderValue: scrubber.value,
            isSliderDragging: scrubber.isDragging,
            contentInsets: contentInsets
        )
    }
}

struct ActivityLogMapView: UIViewRepresentable {
    let mapMarkers: [MapMarker]
    let overlayRevision: Int
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
        updateMap(mapView, coordinator: context.coordinator)
    }

    func updateMap(_ mapView: NMFMapView, coordinator: Coordinator) {
        if mapView.contentInset != contentInsets {
            mapView.contentInset = contentInsets
        }
        let routeChanged = coordinator.lastOverlayRevision != overlayRevision
        if routeChanged {
            coordinator.clearOverlays()
            coordinator.lastOverlayRevision = overlayRevision
            let coords = mapMarkers.map { NMGLatLng(lat: $0.latitude, lng: $0.longitude) }

            if coords.count >= 2 {
                let segments = coords.count - 1
                // 선은 모든 꼭짓점을 유지한다. 색 구간과 장식 개수만 제한한다.
                let lineStep = (segments + 47) / 48
                for start in stride(from: 0, to: segments, by: lineStep) {
                    let end = min(start + lineStep, segments)
                    if let line = NMFPolylineOverlay(Array(coords[start...end])) {
                        line.color = pathColor(at: start, segments: segments)
                        line.width = 6
                        line.capType = .round
                        line.joinType = .round
                        line.mapView = mapView
                        coordinator.polylines.append(line)
                    }
                }

                let dotStep = (coords.count + 39) / 40
                for i in stride(from: 0, to: coords.count, by: dotStep) {
                    let dot = NMFMarker()
                    dot.position = coords[i]
                    dot.iconImage = NMFOverlayImage(image: generatePathDotImage(color: pathColor(at: i, segments: segments)))
                    dot.width = 8
                    dot.height = 8
                    dot.anchor = CGPoint(x: 0.5, y: 0.5)
                    dot.mapView = mapView
                    coordinator.pathDotMarkers.append(dot)
                }

                let arrowStep = max(3, (segments + 15) / 16)
                for i in stride(from: 0, to: segments, by: arrowStep) {
                    let start = coords[i]
                    let end = coords[i + 1]
                    guard start.lat != end.lat || start.lng != end.lng else { continue }
                    let arrow = NMFMarker()
                    let a = NMGWebMercatorCoord(from: start)
                    let b = NMGWebMercatorCoord(from: end)
                    arrow.position = positionOnSegment(from: a, to: b, fraction: 0.5)
                    arrow.iconImage = NMFOverlayImage(image: generateArrowImage(color: pathColor(at: i, segments: segments)))
                    arrow.angle = atan2(b.x - a.x, b.y - a.y) * 180 / .pi
                    arrow.width = 12
                    arrow.height = 12
                    arrow.anchor = CGPoint(x: 0.5, y: 0.5)
                    arrow.mapView = mapView
                    coordinator.arrowMarkers.append(arrow)
                }
            }

            // Draw Start/End Markers
            if let first = mapMarkers.first {
                let m = NMFMarker()
                m.position = NMGLatLng(lat: first.latitude, lng: first.longitude)
                m.iconImage = NMFOverlayImage(image: generateStartEndMarkerImage(text: "S", color: UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1)))
                m.width = 24
                m.height = 24
                m.anchor = CGPoint(x: 0.5, y: 0.5)
                m.mapView = mapView
                coordinator.markers.append(m)
                
                if coordinator.lastCameraStart?.lat != first.latitude || coordinator.lastCameraStart?.lng != first.longitude {
                    coordinator.lastCameraStart = m.position
                    coordinator.lastSliderCameraValue = nil
                }
            }
            
            if let last = mapMarkers.last {
                let m = NMFMarker()
                m.position = NMGLatLng(lat: last.latitude, lng: last.longitude)
                m.iconImage = NMFOverlayImage(image: generateStartEndMarkerImage(text: "E", color: UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1)))
                m.width = 24
                m.height = 24
                m.anchor = CGPoint(x: 0.5, y: 0.5)
                m.mapView = mapView
                coordinator.markers.append(m)
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
                    coordinator.stayMarkers.append(m)
                }
            }
        }
        
        guard !mapMarkers.isEmpty else {
            coordinator.lastCameraStart = nil
            coordinator.lastSliderCameraValue = nil
            return
        }
        let progress = Double(mapMarkers.count - 1) * sliderValue / 100
        let index = Int(progress)
        let sample = mapMarkers[index]
        let start = NMGLatLng(lat: sample.latitude, lng: sample.longitude)
        let fraction = progress - Double(index)
        var position = start
        if fraction > 0, index + 1 < mapMarkers.count {
            let next = mapMarkers[index + 1]
            let end = NMGLatLng(lat: next.latitude, lng: next.longitude)
            position = positionOnSegment(from: NMGWebMercatorCoord(from: start), to: NMGWebMercatorCoord(from: end), fraction: fraction)
        }

        let marker = coordinator.currentPositionMarker
        if marker.mapView == nil {
            marker.iconImage = NMFOverlayImage(image: generateCurrentLocationMarkerImage(color: UIColor(SMAPAccent.activity.base)))
            marker.width = 24
            marker.height = 24
            marker.anchor = CGPoint(x: 0.5, y: 0.5)
            marker.zIndex = 1000
        }
        marker.position = position
        if marker.mapView == nil { marker.mapView = mapView }

        let info = coordinator.currentInfoMarker
        if coordinator.infoSampleIndex != index {
            let time = sample.mlt_gps_time.flatMap { time in
                time.range(of: #"[T ]\d{2}:\d{2}"#, options: .regularExpression).map { String(time[$0].dropFirst()) }
            } ?? "--:--"
            let speed = String(format: "%.1f km/h", sample.speed * 3.6)
            let image = generateCurrentPositionInfoImage(time: time, speed: speed)
            info.iconImage = NMFOverlayImage(image: image)
            info.width = image.size.width
            info.height = image.size.height
            info.anchor = CGPoint(x: 0.5, y: 1)
            info.zIndex = 1001
            coordinator.infoSampleIndex = index
        }
        info.position = position
        if info.mapView == nil { info.mapView = mapView }

        if coordinator.lastSliderCameraValue != sliderValue || (isSliderDragging && (!coordinator.wasSliderDragging || routeChanged)) {
            let update = NMFCameraUpdate(scrollTo: position)
            update.animation = .none
            mapView.moveCamera(update)
        }
        coordinator.lastSliderCameraValue = sliderValue
        coordinator.wasSliderDragging = isSliderDragging
    }

    private func positionOnSegment(from start: NMGWebMercatorCoord, to end: NMGWebMercatorCoord, fraction: Double) -> NMGLatLng {
        NMGWebMercatorCoord(x: start.x + (end.x - start.x) * fraction,
                            y: start.y + (end.y - start.y) * fraction).toLatLng()
    }

    private func pathColor(at index: Int, segments: Int) -> UIColor {
        let progress = Double(index) / Double(segments) * Double(rainbowColors.count - 1)
        let lower = Int(progress)
        return interpolateColor(color1: rainbowColors[lower], color2: rainbowColors[min(lower + 1, rainbowColors.count - 1)],
                                factor: CGFloat(progress - Double(lower)))
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
        let currentPositionMarker = NMFMarker()
        let currentInfoMarker = NMFMarker()
        var infoSampleIndex: Int?
        var lastOverlayRevision: Int?
        /// 마지막으로 카메라를 맞춘 출발점 — 같은 경로에 점만 늘어난 경우(조용한 새로고침) 카메라를 되돌리지 않기 위해
        var lastCameraStart: NMGLatLng?
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
            currentPositionMarker.mapView = nil
            currentInfoMarker.mapView = nil
            infoSampleIndex = nil
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
        let markerBottomPadding: CGFloat = 16 // 반지름 12pt인 위치 표시와 말풍선 사이 4pt
        
        let canvasSize = CGSize(width: capsuleWidth, height: capsuleHeight + markerBottomPadding)
        let renderer = UIGraphicsImageRenderer(size: canvasSize)
        
        return renderer.image { ctx in
            // Draw capsule background
            let capsuleRect = CGRect(x: 0, y: 0, width: capsuleWidth, height: capsuleHeight)
            let capsulePath = UIBezierPath(roundedRect: capsuleRect, cornerRadius: capsuleHeight / 2)
            UIColor(SMAPAccent.activity.deep).withAlphaComponent(0.9).setFill()
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
