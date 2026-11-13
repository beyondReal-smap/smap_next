//
// NaverMapView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import UIKit
import NMapsMap

struct NaverMapView: UIViewRepresentable {
    @Binding var members: [SmapGroupMember]
    var schedules: [SmapSchedule]

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
        context.coordinator.updateMarkers(mapView: uiView.mapView, members: members, schedules: schedules)

        let selected = members.first(where: { $0.isSelected })
        if let member = selected, let lat = member.mlt_lat, let lon = member.mlt_long {
            if context.coordinator.lastSelectedMemberID != member.mt_idx {
                let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: lat, lng: lon))
                cameraUpdate.animation = .easeIn
                uiView.mapView.moveCamera(cameraUpdate)
                context.coordinator.lastSelectedMemberID = member.mt_idx
            }
        } else if selected == nil {
            context.coordinator.lastSelectedMemberID = nil
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, NMFMapViewTouchDelegate, NMFOverlayImageDataSource {
        var parent: NaverMapView
        var memberMarkers: [Int: NMFMarker] = [:]
        var memberSnapshots: [Int: SmapGroupMember] = [:]
        var scheduleMarkers: [String: NMFMarker] = [:]
        var scheduleSignatures: [String: String] = [:]
        private static let profileImages = NSCache<NSURL, UIImage>()
        private var imageRequests: Set<URL> = []
        var lastSelectedMemberID: Int?
        var infoWindow: NMFInfoWindow?
        var currentMapView: NMFMapView?
        var currentMember: SmapGroupMember?

        init(_ parent: NaverMapView) {
            self.parent = parent
            super.init()

            // InfoWindow 초기화
            infoWindow = NMFInfoWindow()
            infoWindow?.dataSource = self
            infoWindow?.anchor = CGPoint(x: 0.5, y: 1.2) // 마커와 간격 추가
        }

        // MARK: - NMFOverlayImageDataSource (InfoWindow 내용)
        func view(with overlay: NMFOverlay) -> UIView {
            let containerView = UIView()
            containerView.backgroundColor = .white
            containerView.layer.cornerRadius = 12
            containerView.layer.shadowColor = UIColor.black.cgColor
            containerView.layer.shadowOpacity = 0.15
            containerView.layer.shadowOffset = CGSize(width: 0, height: 4)
            containerView.layer.shadowRadius = 12

            guard let member = currentMember else {
                containerView.frame = CGRect(origin: .zero, size: CGSize(width: 100, height: 40))
                return containerView
            }

            // 멤버 정보 추출
            let name = member.displayName
            let battery = member.mlt_battery ?? 0
            let speed = (member.mlt_speed ?? 0.0) * 3.6
            let gpsTime = member.mlt_gps_time ?? "업데이트 없음"

            // 배터리 색상
            let _ : UIColor = battery > 50 ? .systemGreen : (battery > 20 ? .systemOrange : .systemRed)

            // 레이아웃
            let padding: CGFloat = 12
            let width: CGFloat = 150
            var yOffset: CGFloat = padding

            // 이름 라벨
            let nameLabel = UILabel()
            nameLabel.font = UIFont.suite(size: 14, weight: .semibold)
            nameLabel.attributedText = calloutLine(symbol: "person.fill", text: name, font: nameLabel.font, color: .black)
            nameLabel.textColor = .black
            nameLabel.frame = CGRect(x: padding, y: yOffset, width: width - padding * 2, height: 20)
            containerView.addSubview(nameLabel)
            yOffset += 24

            // 배터리 라벨
            let batteryLabel = UILabel()
            batteryLabel.font = UIFont.suite(size: 12)
            let batteryLevel = member.mlt_battery ?? -1
            let batteryText = batteryLevel < 0 ? "확인 불가" : "\(batteryLevel)%"
            batteryLabel.attributedText = calloutLine(symbol: "battery.100", text: "배터리: \(batteryText)", font: batteryLabel.font, color: .gray)
            batteryLabel.textColor = .gray
            batteryLabel.frame = CGRect(x: padding, y: yOffset, width: width - padding * 2, height: 18)
            containerView.addSubview(batteryLabel)
            yOffset += 20

            // 속도 라벨
            let speedLabel = UILabel()
            speedLabel.font = UIFont.suite(size: 12)
            speedLabel.attributedText = calloutLine(symbol: "figure.walk", text: "속도: \(String(format: "%.1f", speed))km/h", font: speedLabel.font, color: .gray)
            speedLabel.textColor = .gray
            speedLabel.frame = CGRect(x: padding, y: yOffset, width: width - padding * 2, height: 18)
            containerView.addSubview(speedLabel)
            yOffset += 20

            // GPS 시간 라벨
            let timeLabel = UILabel()
            timeLabel.font = UIFont.suite(size: 11)
            timeLabel.attributedText = calloutLine(symbol: "clock", text: "GPS 업데이트: \(formatGpsTime(gpsTime))", font: timeLabel.font, color: .lightGray)
            timeLabel.textColor = .lightGray
            timeLabel.frame = CGRect(x: padding, y: yOffset, width: width - padding * 2, height: 16)
            containerView.addSubview(timeLabel)
            yOffset += 20

            containerView.frame = CGRect(x: 0, y: 0, width: width, height: yOffset + padding)
            return containerView
        }

        private func formatGpsTime(_ timeStr: String) -> String {
            // "2024-12-30 13:45:00" -> "13:45"
            if timeStr.count >= 16 {
                let start = timeStr.index(timeStr.startIndex, offsetBy: 11)
                let end = timeStr.index(timeStr.startIndex, offsetBy: 16)
                return String(timeStr[start..<end])
            }
            return timeStr
        }

        // 콜아웃 라인 — 이모지 대신 SF Symbol 을 텍스트 앞에 붙여 시각 일관성 확보 (새 에셋 불필요)
        private func calloutLine(symbol: String, text: String, font: UIFont, color: UIColor) -> NSAttributedString {
            let result = NSMutableAttributedString()
            let config = UIImage.SymbolConfiguration(pointSize: font.pointSize, weight: .regular)
            if let image = UIImage(systemName: symbol, withConfiguration: config)?
                .withTintColor(color, renderingMode: .alwaysOriginal) {
                let attachment = NSTextAttachment()
                attachment.image = image
                result.append(NSAttributedString(attachment: attachment))
                result.append(NSAttributedString(string: " ", attributes: [.font: font, .foregroundColor: color]))
            }
            result.append(NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: color]))
            return result
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
                    marker.anchor = CGPoint(x: 0.5, y: 0.5)
                    marker.touchHandler = { [weak self] overlay -> Bool in
                        if let marker = overlay as? NMFMarker,
                           let memberData = marker.userInfo["member"] as? SmapGroupMember {
                            self?.showInfoWindow(for: memberData, at: marker)
                        }
                        return true
                    }
                    marker.mapView = mapView
                    memberMarkers[member.mt_idx] = marker
                }
                if old?.mlt_lat != lat || old?.mlt_long != lon {
                    marker.position = NMGLatLng(lat: lat, lng: lon)
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
                if member.isSelected && (currentMember?.mt_idx != member.mt_idx || old != member || currentMember?.mlt_battery != member.mlt_battery || currentMember?.mlt_gps_time != member.mlt_gps_time || currentMember?.mlt_speed != member.mlt_speed) {
                    showInfoWindow(for: member, at: marker)
                }
            }
            if let selectedID = currentMember?.mt_idx, !visibleIDs.contains(selectedID) {
                infoWindow?.close()
                currentMember = nil
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
                marker.iconImage = NMFOverlayImage(image: createScheduleMarkerImage(order: index + 1, title: schedule.title ?? "일정", startTime: schedule.date, endTime: schedule.sst_edate, status: schedule.status))
                marker.anchor = CGPoint(x: 0.5, y: 1.0)
                marker.userInfo = ["schedule": schedule]
                marker.zIndex = 1000
                marker.mapView = mapView
                scheduleMarkers[id] = marker
                scheduleSignatures[id] = signature
            }
            for id in scheduleMarkers.keys.filter({ !visibleScheduleIDs.contains($0) }) {
                scheduleMarkers.removeValue(forKey: id)?.mapView = nil
                scheduleSignatures.removeValue(forKey: id)
            }
        }

        // MARK: - Schedule Marker Factory

        private func createScheduleMarkerImage(order: Int, title: String, startTime: String?, endTime: String?, status: ScheduleStatus) -> UIImage {
            let width: CGFloat = 100
            let height: CGFloat = 75  // 65 -> 75 (상태 원이 잘리지 않도록)

            let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height))
            return renderer.image { context in
                let ctx = context.cgContext

                // Colors matching Next.js
                let orderCircleBg = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1) // 초록
                let titleBg = UIColor(red: 79/255, green: 70/255, blue: 229/255, alpha: 1) // 인디고
                let timeBg = UIColor(red: 236/255, green: 72/255, blue: 153/255, alpha: 1) // 핑크

                let statusColor: UIColor
                switch status {
                case .completed: statusColor = .systemGreen
                case .ongoing: statusColor = .systemOrange
                case .upcoming: statusColor = .systemBlue
                case .defaultStatus: statusColor = .systemGray
                }

                // 1. 순서 원 (상단 중앙)
                let orderSize: CGFloat = 16
                let orderX = (width - orderSize) / 2
                let orderY: CGFloat = 0
                ctx.setFillColor(orderCircleBg.cgColor)
                ctx.fillEllipse(in: CGRect(x: orderX, y: orderY, width: orderSize, height: orderSize))

                let orderText = "\(order)"
                let orderAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.suite(size: 11, weight: .bold),
                    .foregroundColor: UIColor.white
                ]
                let orderTextSize = orderText.size(withAttributes: orderAttr)
                let orderTextRect = CGRect(
                    x: orderX + (orderSize - orderTextSize.width) / 2,
                    y: orderY + (orderSize - orderTextSize.height) / 2,
                    width: orderTextSize.width,
                    height: orderTextSize.height
                )
                orderText.draw(in: orderTextRect, withAttributes: orderAttr)

                // 2. 제목 박스
                let titleHeight: CGFloat = 20
                let titleY = orderY + orderSize + 2
                let titleRect = CGRect(x: 4, y: titleY, width: width - 8, height: titleHeight)

                let titlePath = UIBezierPath(roundedRect: titleRect, cornerRadius: 6)
                ctx.setFillColor(titleBg.cgColor)
                ctx.addPath(titlePath.cgPath)
                ctx.fillPath()

                let displayTitle = title.count > 10 ? String(title.prefix(10)) + "..." : title
                let titleAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.suite(size: 12, weight: .semibold),
                    .foregroundColor: UIColor.white
                ]
                let titleTextSize = displayTitle.size(withAttributes: titleAttr)
                let titleTextRect = CGRect(
                    x: (width - titleTextSize.width) / 2,
                    y: titleY + (titleHeight - titleTextSize.height) / 2,
                    width: titleTextSize.width,
                    height: titleTextSize.height
                )
                displayTitle.draw(in: titleTextRect, withAttributes: titleAttr)

                // 3. 시간 박스
                let timeHeight: CGFloat = 16
                let timeY = titleY + titleHeight + 2

                let timeText = formatTimeRange(start: startTime, end: endTime)
                let timeWidth = max(width - 16, 60)
                let timeRect = CGRect(x: (width - timeWidth) / 2, y: timeY, width: timeWidth, height: timeHeight)

                let timePath = UIBezierPath(roundedRect: timeRect, cornerRadius: 4)
                ctx.setFillColor(timeBg.cgColor)
                ctx.addPath(timePath.cgPath)
                ctx.fillPath()

                let timeAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.suite(size: 10),
                    .foregroundColor: UIColor.white
                ]
                let timeTextSize = timeText.size(withAttributes: timeAttr)
                let timeTextRect = CGRect(
                    x: (width - timeTextSize.width) / 2,
                    y: timeY + (timeHeight - timeTextSize.height) / 2,
                    width: timeTextSize.width,
                    height: timeTextSize.height
                )
                timeText.draw(in: timeTextRect, withAttributes: timeAttr)

                // 4. 상태 원 (하단 중앙)
                let statusSize: CGFloat = 10
                let statusX = (width - statusSize) / 2
                let statusY = timeY + timeHeight + 2

                ctx.setFillColor(statusColor.cgColor)
                ctx.fillEllipse(in: CGRect(x: statusX, y: statusY, width: statusSize, height: statusSize))

                // 흰색 테두리
                ctx.setStrokeColor(UIColor.white.cgColor)
                ctx.setLineWidth(1.5)
                ctx.strokeEllipse(in: CGRect(x: statusX, y: statusY, width: statusSize, height: statusSize))
            }
        }

        private func formatTimeRange(start: String?, end: String?) -> String {
            guard let start = start else { return "시간 없음" }

            let startTime = extractTime(from: start)
            if let end = end {
                let endTime = extractTime(from: end)
                return "\(startTime) ~ \(endTime)"
            }
            return startTime
        }

        private func extractTime(from dateStr: String) -> String {
            // "2025-12-30T10:00:00" -> "10:00"
            if dateStr.contains("T") {
                let components = dateStr.components(separatedBy: "T")
                if components.count > 1 {
                    let timePart = components[1]
                    let timeComponents = timePart.components(separatedBy: ":")
                    if timeComponents.count >= 2 {
                        return "\(timeComponents[0]):\(timeComponents[1])"
                    }
                }
            }
            return dateStr
        }

        // MARK: - InfoWindow Display

        func showInfoWindow(for member: SmapGroupMember, at marker: NMFMarker) {
            // 현재 열린 InfoWindow 닫기
            infoWindow?.close()

            // InfoWindow 데이터 업데이트
            currentMember = member

            // InfoWindow 열기
            infoWindow?.open(with: marker)

            print("ℹ️ [NaverMapView] InfoWindow opened for: \(member.displayName)")
        }

        // 이미지 URL 처리 헬퍼 (Frontend imageUtils.ts 로직 반영)
        static func getSafeImageUrl(_ mtFile1: String?) -> URL? {
            return AuthService.getProfileImageURL(mtFile1)
        }
    }
}

// MARK: - Marker Factory (Custom Image Generation)

struct MarkerFactory {
    static func createMarkerImage(for member: SmapGroupMember, image: UIImage?) -> UIImage {
        // Layout Constants (reduced by 30%)
        let avatarSize: CGFloat = 28 // was 40
        let borderWidth: CGFloat = 1.5 // was 2
        let topPadding: CGFloat = 3 // was 4
        let labelHeight: CGFloat = 14 // was 16
        let labelPadding: CGFloat = 3 // was 4
        let totalWidth: CGFloat = max(avatarSize, 60) // was 80
        let totalHeight: CGFloat = topPadding + avatarSize + 5 + labelHeight // 여백 + 아바타 + 간격 + 라벨

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: totalWidth, height: totalHeight))

        return renderer.image { context in
            let ctx = context.cgContext

            // 1. Avatar Circle (위쪽 여백 추가)
            let avatarRect = CGRect(x: (totalWidth - avatarSize) / 2, y: topPadding, width: avatarSize, height: avatarSize)
            let path = UIBezierPath(ovalIn: avatarRect)

            // Border Color (Selected vs Normal)
            let borderColor: UIColor = member.isSelected ?
                UIColor(red: 236/255, green: 72/255, blue: 153/255, alpha: 1.0) : // Pink
                UIColor(red: 79/255, green: 70/255, blue: 229/255, alpha: 1.0)  // Indigo

            // Fill Background (White)
            UIColor.white.setFill()
            path.fill()

            // Draw Image (Clipped)
            path.addClip()
            if let img = image {
                img.draw(in: avatarRect)
            } else {
                // Placeholder (Gray)
                UIColor.systemGray5.setFill()
                path.fill()
            }

            // Reset Clip to draw border
            ctx.resetClip()

            // Draw Border
            borderColor.setStroke()
            path.lineWidth = borderWidth
            path.stroke()

            // 2. Name Label
            let name = member.displayName
            if !name.isEmpty {
                let paragraphStyle = NSMutableParagraphStyle()
                paragraphStyle.alignment = .center

                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.suite(size: 10, weight: .medium),
                    .foregroundColor: UIColor.white,
                    .paragraphStyle: paragraphStyle
                ]

                let textSize = (name as NSString).size(withAttributes: attrs)
                let labelWidth = textSize.width + (labelPadding * 2)
                let labelRect = CGRect(
                    x: (totalWidth - labelWidth) / 2,
                    y: topPadding + avatarSize + 2, // 여백 + 아바타 바로 아래
                    width: labelWidth,
                    height: labelHeight
                )

                // Label Background (Semi-transparent Black)
                let labelPath = UIBezierPath(roundedRect: labelRect, cornerRadius: 4)
                UIColor.black.withAlphaComponent(0.7).setFill()
                labelPath.fill()

                // Draw Text
                (name as NSString).draw(in: CGRect(x: labelRect.origin.x, y: labelRect.origin.y + (labelHeight - textSize.height)/2, width: labelRect.width, height: textSize.height), withAttributes: attrs)
            }
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
