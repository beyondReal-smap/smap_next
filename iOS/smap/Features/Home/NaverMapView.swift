//
// NaverMapView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import UIKit
import NMapsMap

/// 시트에서 고른 일정 장소로 지도를 옮기라는 요청. token 이 바뀔 때만 한 번 옮긴다(같은 일정을 다시 눌러도 다시 옮김).
struct MapFocus: Equatable {
    let latitude: Double
    let longitude: Double
    let token: Int
}

extension SmapSchedule {
    /// 지도에 찍을 수 있는 일정 장소. 좌표가 없거나 (0,0)·범위 밖이면 nil.
    var mapCoordinate: CLLocationCoordinate2D? {
        guard let lat = sst_location_lat, let lng = sst_location_long, lat != 0 || lng != 0 else { return nil }
        let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        return CLLocationCoordinate2DIsValid(coordinate) ? coordinate : nil
    }
}

struct NaverMapView: UIViewRepresentable {
    @Binding var members: [SmapGroupMember]
    let groupID: Int?
    var schedules: [SmapSchedule]
    /// 지도 위 조작 줄·아래 시트에 가리는 만큼 — 선택한 멤버가 보이는 영역 가운데에 오게 한다.
    var contentInsets: UIEdgeInsets = .zero
    /// 값이 바뀔 때마다 모든 멤버가 보이게 지도를 맞춘다(시트 "전체" 보기).
    var fitAllToken: Int = 0
    /// 마커를 누르면 그 멤버를 고른다 — 상태는 시트 머리 줄이 보여 준다(이전의 지도 말풍선 대신).
    var onMemberTap: (SmapGroupMember) -> Void = { _ in }
    /// 시트에서 일정을 눌렀을 때 옮겨 갈 장소
    var focus: MapFocus?

    func makeUIView(context: Context) -> NMFNaverMapView {
        let view = NMFNaverMapView()
        view.showZoomControls = false
        view.showLocationButton = false  // 현재위치 플로팅 버튼 숨김
        view.mapView.positionMode = .disabled  // 현재위치 마커 숨김
        view.mapView.zoomLevel = 15
        view.mapView.touchDelegate = context.coordinator

        // 사용자의 현재 위치로 초기화 (LocationManager에서 가져옴)
        let lastLocation = LocationManager.shared.lastLocation ?? CLLocation(latitude: 37.5665, longitude: 126.978)
        if lastLocation.coordinate.latitude != 0.0 && lastLocation.coordinate.longitude != 0.0 {
            let initialPosition = NMGLatLng(lat: lastLocation.coordinate.latitude, lng: lastLocation.coordinate.longitude)
            view.mapView.moveCamera(NMFCameraUpdate(scrollTo: initialPosition))
            print("📍 [NaverMapView-Home] Using device location: (\(lastLocation.coordinate.latitude), \(lastLocation.coordinate.longitude))")
        } else {
            print("📍 [NaverMapView-Home] No device location, using default")
        }

        return view
    }

    func updateUIView(_ uiView: NMFNaverMapView, context: Context) {
        context.coordinator.parent = self
        if uiView.mapView.contentInset != contentInsets {
            uiView.mapView.contentInset = contentInsets
        }
        context.coordinator.updateMarkers(mapView: uiView.mapView, members: members, schedules: schedules)

        let selected = members.first(where: { $0.isSelected })
        if let member = selected, let lat = member.mlt_lat, let lon = member.mlt_long {
            context.coordinator.fittedGroupID = nil
            if context.coordinator.lastSelectedMemberID != member.mt_idx {
                let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: lat, lng: lon))
                cameraUpdate.animation = .easeIn
                uiView.mapView.moveCamera(cameraUpdate)
                context.coordinator.lastSelectedMemberID = member.mt_idx
            }
        } else if selected == nil {
            context.coordinator.lastSelectedMemberID = nil
        }

        if let focus, context.coordinator.lastFocusToken != focus.token {
            context.coordinator.lastFocusToken = focus.token
            let update = NMFCameraUpdate(scrollTo: NMGLatLng(lat: focus.latitude, lng: focus.longitude), zoomTo: 16)
            update.animation = .easeIn
            uiView.mapView.moveCamera(update)
            return  // 같은 갱신에서 "전체 맞춤"이 다시 덮어쓰지 않게
        }

        if selected == nil, let groupID,
           context.coordinator.fittedGroupID != groupID || context.coordinator.lastFitAllToken != fitAllToken {
            let points = members.compactMap { m -> NMGLatLng? in
                guard let lat = m.mlt_lat, let lon = m.mlt_long, (lat != 0 || lon != 0),
                      CLLocationCoordinate2DIsValid(CLLocationCoordinate2D(latitude: lat, longitude: lon)) else { return nil }
                return NMGLatLng(lat: lat, lng: lon)
            }
            guard !points.isEmpty else { return }
            context.coordinator.fittedGroupID = groupID
            context.coordinator.lastFitAllToken = fitAllToken
            if points.count == 1 {
                let update = NMFCameraUpdate(scrollTo: points[0], zoomTo: 15)
                update.animation = .easeIn
                uiView.mapView.moveCamera(update)
            } else if points.count > 1 {
                let update = NMFCameraUpdate(fit: NMGLatLngBounds(latLngs: points), padding: 64)
                update.animation = .easeIn
                uiView.mapView.moveCamera(update)
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, NMFMapViewTouchDelegate {
        var parent: NaverMapView
        var memberMarkers: [Int: NMFMarker] = [:]
        var memberSnapshots: [Int: SmapGroupMember] = [:]
        var scheduleMarkers: [String: NMFMarker] = [:]
        /// 일정 동선(멤버별 점선). 좌표가 그대로면 다시 그리지 않는다.
        var scheduleRoutes: [NMFPolylineOverlay] = []
        var scheduleRouteSignature = ""
        var scheduleSignatures: [String: String] = [:]
        private static let profileImages = NSCache<NSURL, UIImage>()
        private var imageRequests: Set<URL> = []
        var lastSelectedMemberID: Int?
        var fittedGroupID: Int?
        var lastFitAllToken = 0
        var lastFocusToken: Int?
        var currentMapView: NMFMapView?

        init(_ parent: NaverMapView) {
            self.parent = parent
            super.init()
        }

        func updateMarkers(mapView: NMFMapView, members: [SmapGroupMember], schedules: [SmapSchedule]) {
            currentMapView = mapView
            let visibleIDs = Set(members.filter { $0.mlt_lat != nil && $0.mlt_long != nil }.map { $0.mt_idx })
            for id in memberMarkers.keys.filter({ !visibleIDs.contains($0) }) {
                memberMarkers.removeValue(forKey: id)?.mapView = nil
                memberSnapshots.removeValue(forKey: id)
            }
            for member in members {
                guard let lat = member.mlt_lat, let lon = member.mlt_long else { continue }
                let old = memberSnapshots[member.mt_idx]
                let marker: NMFMarker
                if let existing = memberMarkers[member.mt_idx] {
                    marker = existing
                } else {
                    marker = NMFMarker()
                    marker.anchor = CGPoint(x: 0.5, y: 1)
                    marker.touchHandler = { [weak self] overlay -> Bool in
                        if let marker = overlay as? NMFMarker,
                           let memberData = marker.userInfo["member"] as? SmapGroupMember {
                            self?.parent.onMemberTap(memberData)
                        }
                        return true
                    }
                    memberMarkers[member.mt_idx] = marker
                }
                if old?.mlt_lat != lat || old?.mlt_long != lon {
                    marker.position = NMGLatLng(lat: lat, lng: lon)
                }
                // 위치를 넣은 뒤에 지도에 올린다 — 위치 없이 올리면 SDK 가 무시해 멤버 마커가 지도에 보이지 않았다.
                if marker.mapView == nil {
                    marker.mapView = mapView
                }
                let url = Self.getSafeImageUrl(member.mt_file1)
                if old == nil || old?.displayName != member.displayName || old?.isSelected != member.isSelected || old?.mt_file1 != member.mt_file1 {
                    let image = url.flatMap { Self.profileImages.object(forKey: $0 as NSURL) }
                    marker.iconImage = NMFOverlayImage(image: MarkerFactory.createMarkerImage(for: member, image: image))
                }
                marker.userInfo = ["member": member]
                marker.zIndex = member.isSelected ? 2000 : 100
                memberSnapshots[member.mt_idx] = member
                if let url, Self.profileImages.object(forKey: url as NSURL) == nil, imageRequests.insert(url).inserted {
                    URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                        let image = data.flatMap { UIImage(data: $0) }
                        DispatchQueue.main.async {
                            guard let self else { return }
                            self.imageRequests.remove(url)
                            guard let image else { return }
                            Self.profileImages.setObject(image, forKey: url as NSURL)
                            for (id, current) in self.memberSnapshots where Self.getSafeImageUrl(current.mt_file1) == url {
                                self.memberMarkers[id]?.iconImage = NMFOverlayImage(image: MarkerFactory.createMarkerImage(for: current, image: image))
                            }
                        }
                    }.resume()
                }
            }
            var visibleScheduleIDs = Set<String>()
            for (index, schedule) in schedules.enumerated() {
                guard let lat = schedule.sst_location_lat, let lon = schedule.sst_location_long else { continue }
                let id = schedule.sst_idx.map { "id:\($0)" } ?? "index:\(index)"
                visibleScheduleIDs.insert(id)
                let signature = "\(index)|\(lat)|\(lon)|\(schedule.title ?? "")|\(schedule.date ?? "")|\(schedule.sst_edate ?? "")|\(schedule.status)"
                if scheduleSignatures[id] == signature { continue }
                let marker = scheduleMarkers[id] ?? NMFMarker()
                marker.position = NMGLatLng(lat: lat, lng: lon)
                marker.iconImage = NMFOverlayImage(image: ScheduleMarkerRenderer.image(order: index + 1, title: schedule.title ?? "일정", startTime: schedule.date, tone: .init(schedule.status)))
                marker.anchor = CGPoint(x: 0.5, y: ScheduleMarkerLayout.anchorY)
                marker.userInfo = ["schedule": schedule]
                // 끝난 일정은 흐리게·아래로 — 남은 일정이 먼저 보이게
                let tone = ScheduleMarkerRenderer.Tone(schedule.status)
                marker.alpha = tone.alpha
                marker.zIndex = tone.zIndex
                marker.mapView = mapView
                scheduleMarkers[id] = marker
                scheduleSignatures[id] = signature
            }
            for id in scheduleMarkers.keys.filter({ !visibleScheduleIDs.contains($0) }) {
                scheduleMarkers.removeValue(forKey: id)?.mapView = nil
                scheduleSignatures.removeValue(forKey: id)
            }
            updateScheduleRoutes(schedules, on: mapView)
        }

        // MARK: - Schedule Routes

        /// 멤버마다 그날 일정 장소를 시작 시각 순으로 점선으로 잇는다 — "오늘 어디 어디 가는지"를 한눈에.
        /// 멤버끼리 섞어 이으면 아무도 다니지 않는 길이 되므로 mt_idx 로 나눈다. `schedules` 는 이미 시각 순.
        private func updateScheduleRoutes(_ schedules: [SmapSchedule], on mapView: NMFMapView) {
            let routes = ScheduleRoute.routes(schedules)
            let signature = routes.map { $0.map { "\($0.latitude),\($0.longitude)" }.joined(separator: ";") }.joined(separator: "|")
            guard signature != scheduleRouteSignature else { return }
            scheduleRouteSignature = signature
            scheduleRoutes.forEach { $0.mapView = nil }
            scheduleRoutes = routes.compactMap { coords in
                guard let line = NMFPolylineOverlay(coords.map { NMGLatLng(lat: $0.latitude, lng: $0.longitude) }) else { return nil }
                line.width = 3
                line.color = UIColor(SMAPTheme.Family.ink).withAlphaComponent(0.6)
                line.pattern = [8, 6]
                line.capType = .round
                line.joinType = .round
                line.mapView = mapView
                return line
            }
        }

        // MARK: - Schedule Marker Factory

        // 이미지 URL 처리 헬퍼 (Frontend imageUtils.ts 로직 반영)
        static func getSafeImageUrl(_ mtFile1: String?) -> URL? {
            return AuthService.getProfileImageURL(mtFile1)
        }
    }
}

// MARK: - Marker Factory (Custom Image Generation)

struct MarkerFactory {
    static func createMarkerImage(for member: SmapGroupMember, image: UIImage?) -> UIImage {
        let accent = SMAPAvatar.familyColor(for: member.mt_idx)
        let ink = UIColor(SMAPTheme.Family.ink)
        let name = member.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let font = UIFont.suite(size: 13, weight: .bold)
        let textWidth = min(92, max(12, ceil((name as NSString).size(withAttributes: [.font: font]).width)))
        let width = 4 + 30 + 6 + textWidth + 12
        let size = CGSize(width: width, height: 48)
        return UIGraphicsImageRenderer(size: size).image { renderer in
            let ctx = renderer.cgContext
            let fill = member.isSelected ? ink : UIColor.white
            let body = UIBezierPath(roundedRect: CGRect(x: 1, y: 1, width: width - 2, height: 38), cornerRadius: 19)
            ctx.setShadow(offset: CGSize(width: 0, height: 1), blur: 2, color: UIColor.black.withAlphaComponent(0.20).cgColor)
            fill.setFill()
            body.fill()
            ctx.setShadow(offset: .zero, blur: 0, color: nil)
            (member.isSelected ? ink : UIColor(accent.base).withAlphaComponent(0.55)).setStroke()
            body.lineWidth = 1.5
            body.stroke()

            let tip = UIBezierPath()
            tip.move(to: CGPoint(x: width / 2 - 6, y: 38))
            tip.addLine(to: CGPoint(x: width / 2, y: size.height))
            tip.addLine(to: CGPoint(x: width / 2 + 6, y: 38))
            tip.close()
            ink.setFill()
            tip.fill()

            let face = CGRect(x: 5, y: 5, width: 30, height: 30)
            ctx.saveGState()
            UIBezierPath(ovalIn: face).addClip()
            UIColor(accent.container).setFill()
            ctx.fill(face)
            if let image, image.size.width > 0, image.size.height > 0 {
                let scale = max(face.width / image.size.width, face.height / image.size.height)
                let w = image.size.width * scale, h = image.size.height * scale
                image.draw(in: CGRect(x: face.midX - w / 2, y: face.midY - h / 2, width: w, height: h))
            } else {
                let initial = (name.first.map(String.init) ?? "?") as NSString
                let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.suite(size: 15, weight: .bold), .foregroundColor: UIColor(accent.base)]
                let letter = initial.size(withAttributes: attrs)
                initial.draw(at: CGPoint(x: face.midX - letter.width / 2, y: face.midY - letter.height / 2), withAttributes: attrs)
            }
            ctx.restoreGState()

            let paragraph = NSMutableParagraphStyle()
            paragraph.lineBreakMode = .byTruncatingTail
            let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: member.isSelected ? UIColor.white : ink, .paragraphStyle: paragraph]
            (name as NSString).draw(in: CGRect(x: 41, y: 20 - font.lineHeight / 2, width: textWidth, height: ceil(font.lineHeight)), withAttributes: attrs)
        }
    }

    static func createPlaceMarkerImage(title: String, isSelected: Bool) -> UIImage {
        let size: CGFloat = 28
        let borderWidth: CGFloat = 2.0
        let labelHeight: CGFloat = 14
        let labelPadding: CGFloat = 3
        let topPadding: CGFloat = 2

        // Marker size is 80x(topPadding + size + 5 + labelHeight)
        let totalWidth: CGFloat = 80
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: totalWidth, height: topPadding + size + 5 + labelHeight))

        return renderer.image { context in
            _ = context.cgContext

            // 1. Circle & Pin
            let rect = CGRect(x: (totalWidth - size) / 2, y: topPadding, width: size, height: size)
            let path = UIBezierPath(ovalIn: rect)

            // Background (White)
            UIColor.white.setFill()
            path.fill()

            // Border Color (Selected: Red, Normal: Indigo/Blue)
            let color = isSelected ?
                UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1.0) : // ef4444 (Red)
                UIColor(red: 99/255, green: 102/255, blue: 241/255, alpha: 1.0)  // 6366f1 (Indigo/Blue)

            color.setStroke()
            path.lineWidth = borderWidth
            path.stroke()

            // Enlarged & Centered Pin Icon
            let x = rect.midX
            let y = rect.midY // Center of the circle

            let pinPath = UIBezierPath()
            // Top circle parts (larger radius 6 vs 4)
            pinPath.addArc(withCenter: CGPoint(x: x, y: y - 2), radius: 6, startAngle: 0, endAngle: .pi, clockwise: false)
            // Tip (longer tip)
            pinPath.addLine(to: CGPoint(x: x, y: y + 9))
            pinPath.close()

            color.setFill()
            pinPath.fill()

            // Center hole (larger hole for larger pin)
            let holePath = UIBezierPath(ovalIn: CGRect(x: x - 2, y: y - 4, width: 4, height: 4))
            UIColor.white.setFill()
            holePath.fill()

            // 2. Name Label
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.alignment = .center

            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.suite(size: 10, weight: .medium),
                .foregroundColor: UIColor.white,
                .paragraphStyle: paragraphStyle
            ]

            let name = title as NSString
            let textSize = name.size(withAttributes: attrs)
            let labelWidth = min(76, textSize.width + (labelPadding * 2))
            let labelRect = CGRect(
                x: (totalWidth - labelWidth) / 2,
                y: topPadding + size + 3,
                width: labelWidth,
                height: labelHeight
            )

            // Label Background (Solid Black)
            let labelPath = UIBezierPath(roundedRect: labelRect, cornerRadius: 4)
            UIColor.black.withAlphaComponent(0.8).setFill()
            labelPath.fill()

            // Draw Text
            name.draw(in: CGRect(x: labelRect.origin.x, y: labelRect.origin.y + (labelHeight - textSize.height)/2, width: labelRect.width, height: textSize.height), withAttributes: attrs)
        }
    }
}

/// 일정 마커(한 줄 말풍선) 치수 — pt. Android `ScheduleMarkerLayout` 과 같은 값(dp).
enum ScheduleMarkerLayout {
    static let chipHeight: CGFloat = 26
    static let border: CGFloat = 1.5
    static let inset: CGFloat = 4
    static let orderSize: CGFloat = 18
    static let gap: CGFloat = 6
    static let timeGap: CGFloat = 5
    static let trailing: CGFloat = 10
    static let tailWidth: CGFloat = 10
    static let tailHeight: CGFloat = 6
    static let dotSize: CGFloat = 9
    static var dotCenterY: CGFloat { border + chipHeight + tailHeight + dotSize / 2 }
    static var totalHeight: CGFloat { dotCenterY + dotSize / 2 + 1.5 }  // 점 테두리 여유
    /// 마커 기준점 = 위치 점 중심
    static var anchorY: CGFloat { dotCenterY / totalHeight }
}

/// 일정 동선 계산 — Android `scheduleRoutes()` 와 같은 규칙.
enum ScheduleRoute {
    /// 멤버별 좌표 목록(2곳 이상인 것만). 같은 자리가 이어지면 한 번만, 멤버를 모르는 일정은 잇지 않는다.
    static func routes(_ schedules: [SmapSchedule]) -> [[CLLocationCoordinate2D]] {
        var order: [Int] = []
        var byMember: [Int: [CLLocationCoordinate2D]] = [:]
        for schedule in schedules {
            guard let member = schedule.ownerIdx, let point = schedule.mapCoordinate else { continue }
            if byMember[member] == nil { order.append(member) }
            var points = byMember[member, default: []]
            if let last = points.last, last.latitude == point.latitude, last.longitude == point.longitude { continue }
            points.append(point)
            byMember[member] = points
        }
        return order.compactMap { byMember[$0] }.filter { $0.count >= 2 }
    }
}

/// 일정 마커 그림 — 홈 지도와 활동 로그 지도가 함께 쓴다(Android MarkerUtils.createScheduleMarkerBitmap 과 같은 모양).
enum ScheduleMarkerRenderer {
    /// 번호 원·위치 점 색의 단계. 홈(SmapSchedule)과 일정 API(Schedule)의 상태 종류가 달라 여기로 모은다.
    enum Tone {
        case upcoming, ongoing, done

        init(_ status: ScheduleStatus) {
            switch status {
            case .ongoing: self = .ongoing
            case .completed: self = .done
            case .upcoming, .defaultStatus: self = .upcoming
            }
        }

        init(_ status: ScheduleDisplayStatus) {
            switch status {
            case .ongoing: self = .ongoing
            case .completed: self = .done
            case .upcoming, .defaultStatus: self = .upcoming
            }
        }

        /// 예정 주황, 진행 중 초록(#15803D, 흰 숫자 대비 5:1 — 시스템 초록은 2:1 남짓), 끝남 회색.
        var tint: UIColor {
            switch self {
            case .ongoing: return UIColor(red: 0x15 / 255, green: 0x80 / 255, blue: 0x3D / 255, alpha: 1)
            case .done: return UIColor(red: 0x6B / 255, green: 0x72 / 255, blue: 0x80 / 255, alpha: 1)
            case .upcoming: return UIColor(SMAPAccent.orange.base)
            }
        }

        /// 끝난 일정은 흐리게 — 남은 일정이 먼저 보이게
        var alpha: CGFloat { self == .done ? 0.6 : 1 }
        var zIndex: Int { self == .done ? 900 : 1000 }
    }

    /// 일정 마커 한 장. 좌표는 아래 위치 점의 중심 — `scheduleMarkerAnchorY` 로 맞춘다.
    /// 2026-11-20 한 줄 말풍선으로 바꿈: 이전엔 순번 원·제목·시간·상태 점 네 칸을 세로로 쌓아
    /// 멤버 아바타보다 두 배 가까이 높았고, 일정 몇 개만 돼도 서로·아바타와 겹쳤다.
    static func image(order: Int, title: String, startTime: String?, tone: Tone) -> UIImage {
        let layout = ScheduleMarkerLayout.self
        let tint = tone.tint
        let navy = UIColor(SMAPTheme.Family.ink)

        let orderText = "\(order)"
        let orderAttr: [NSAttributedString.Key: Any] = [.font: UIFont.suite(size: 11, weight: .bold), .foregroundColor: UIColor.white]
        let timeText = startTime.flatMap(clock(from:))
        let timeAttr: [NSAttributedString.Key: Any] = [.font: UIFont.suite(size: 11, weight: .semibold), .foregroundColor: UIColor.white.withAlphaComponent(0.75)]
        let displayTitle = title.count > 10 ? String(title.prefix(10)) + "…" : title
        let titleAttr: [NSAttributedString.Key: Any] = [.font: UIFont.suite(size: 12, weight: .bold), .foregroundColor: UIColor.white]

        let timeSize = timeText?.size(withAttributes: timeAttr) ?? .zero
        let titleSize = displayTitle.size(withAttributes: titleAttr)
        // [안쪽 여백 4][번호 원][6][시각][5][제목][10]
        var chipWidth = layout.inset + layout.orderSize + layout.gap + ceil(titleSize.width) + layout.trailing
        if timeText != nil { chipWidth += ceil(timeSize.width) + layout.timeGap }
        let width = chipWidth + layout.border * 2
        let height = layout.totalHeight

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height))
        return renderer.image { context in
            let ctx = context.cgContext
            let chipRect = CGRect(x: layout.border, y: layout.border, width: chipWidth, height: layout.chipHeight)
            let cx = width / 2

            // 1. 꼬리 (칩 아래 가운데 → 위치 점)
            ctx.setFillColor(navy.cgColor)
            ctx.move(to: CGPoint(x: cx - layout.tailWidth / 2, y: chipRect.maxY - 1))
            ctx.addLine(to: CGPoint(x: cx + layout.tailWidth / 2, y: chipRect.maxY - 1))
            ctx.addLine(to: CGPoint(x: cx, y: chipRect.maxY + layout.tailHeight))
            ctx.closePath()
            ctx.fillPath()

            // 2. 칩 — 흰 테두리로 지도 위에서 떠 보이게
            let chipPath = UIBezierPath(roundedRect: chipRect, cornerRadius: layout.chipHeight / 2)
            ctx.setFillColor(navy.cgColor)
            ctx.addPath(chipPath.cgPath)
            ctx.fillPath()
            ctx.setStrokeColor(UIColor.white.cgColor)
            ctx.setLineWidth(layout.border)
            ctx.addPath(chipPath.cgPath)
            ctx.strokePath()

            // 3. 번호 원 — 색이 곧 상태
            let orderRect = CGRect(x: chipRect.minX + layout.inset, y: chipRect.midY - layout.orderSize / 2, width: layout.orderSize, height: layout.orderSize)
            ctx.setFillColor(tint.cgColor)
            ctx.fillEllipse(in: orderRect)
            let orderSize = orderText.size(withAttributes: orderAttr)
            orderText.draw(at: CGPoint(x: orderRect.midX - orderSize.width / 2, y: orderRect.midY - orderSize.height / 2), withAttributes: orderAttr)

            // 4. 시각 · 제목
            var x = orderRect.maxX + layout.gap
            if let timeText {
                timeText.draw(at: CGPoint(x: x, y: chipRect.midY - timeSize.height / 2), withAttributes: timeAttr)
                x += ceil(timeSize.width) + layout.timeGap
            }
            displayTitle.draw(at: CGPoint(x: x, y: chipRect.midY - titleSize.height / 2), withAttributes: titleAttr)

            // 5. 위치 점 — 이 점의 중심이 일정 좌표
            let dotRect = CGRect(x: cx - layout.dotSize / 2, y: layout.dotCenterY - layout.dotSize / 2, width: layout.dotSize, height: layout.dotSize)
            ctx.setFillColor(tint.cgColor)
            ctx.fillEllipse(in: dotRect)
            ctx.setStrokeColor(UIColor.white.cgColor)
            ctx.setLineWidth(2)
            ctx.strokeEllipse(in: dotRect)
        }
    }

    /// "2026-11-20 15:30:00"·"2026-11-20T15:30:00" → "15:30". 이전에는 T 형식만 읽어 공백 형식이면 날짜 전체가 찍혔다.
    static func clock(from dateStr: String) -> String? {
        guard let range = dateStr.range(of: #"[T ](\d{2}):(\d{2})"#, options: .regularExpression) else { return nil }
        return String(dateStr[range].dropFirst())
    }
}

