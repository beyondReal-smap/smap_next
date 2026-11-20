import XCTest
import SwiftUI
import NMapsMap
@testable import smap

final class PlaceholderTests: XCTestCase {
    func testAppLaunches() {
        // Phase 1 infrastructure tests will be added here
        XCTAssertTrue(true)
    }
}

/// 장소 관리 권한 판정(서버 `ManagesMemberInSharedGroup`과 동일 규칙) 전수 테스트: 요청자 4역할 x 대상 4역할
final class MyPlaceManagePermissionTests: XCTestCase {
    private enum Role: CaseIterable { case selfMember, owner, leader, normal }

    /// 서버 규칙을 그대로 옮긴 기대값: 본인 허용, 그룹장은 모두, 리더는 그룹장 제외, 일반은 본인만
    private func expected(requester: Role, target: Role) -> Bool {
        if requester == .selfMember && target == .selfMember { return true }
        switch requester {
        case .owner: return true
        case .leader: return target != .owner
        default: return false
        }
    }

    func testPermissionMatrix_allCombinations() {
        // 요청자(역할) x 대상(역할, 서로 다른 사용자) 16조합. 본인=같은 id, 나머지는 다른 id.
        for requester in [Role.owner, .leader, .normal] {
            for target in Role.allCases {
                let requesterId = 1
                let targetId = target == .selfMember ? 1 : 2
                let result = MyPlaceViewModel.canManagePlace(
                    requesterId: requesterId,
                    requesterIsOwner: requester == .owner,
                    requesterIsLeader: requester == .leader,
                    targetId: targetId,
                    targetIsOwner: target == .owner
                )
                let want = target == .selfMember ? true : expected(requester: requester, target: target)
                XCTAssertEqual(result, want, "requester=\(requester) target=\(target)")
            }
        }
    }

    func testOwnerSelf_alwaysAllowed() {
        XCTAssertTrue(MyPlaceViewModel.canManagePlace(requesterId: 1, requesterIsOwner: true, requesterIsLeader: false, targetId: 1, targetIsOwner: true))
    }

    func testLeaderCannotManageOwner_butCanManageNormalAndOtherLeader() {
        XCTAssertFalse(MyPlaceViewModel.canManagePlace(requesterId: 1, requesterIsOwner: false, requesterIsLeader: true, targetId: 2, targetIsOwner: true))
        XCTAssertTrue(MyPlaceViewModel.canManagePlace(requesterId: 1, requesterIsOwner: false, requesterIsLeader: true, targetId: 3, targetIsOwner: false))
    }

    func testNormalMember_onlyOwnPlaces() {
        XCTAssertFalse(MyPlaceViewModel.canManagePlace(requesterId: 1, requesterIsOwner: false, requesterIsLeader: false, targetId: 2, targetIsOwner: false))
        XCTAssertFalse(MyPlaceViewModel.canManagePlace(requesterId: 1, requesterIsOwner: false, requesterIsLeader: false, targetId: 2, targetIsOwner: true))
        XCTAssertTrue(MyPlaceViewModel.canManagePlace(requesterId: 1, requesterIsOwner: false, requesterIsLeader: false, targetId: 1, targetIsOwner: false))
    }
}

/// 구매용 계정 토큰 확보(32단계, 구독 M-1) 순수 로직 테스트
final class PurchaseAccountTokenTests: XCTestCase {
    private let validToken = "123e4567-e89b-42d3-a456-426614174000"

    private func status(token: String?) -> SubscriptionStatus {
        SubscriptionStatus(
            is_premium: false, plan: nil, platform: nil, expires_at: nil, auto_renew: nil,
            in_grace_period: false, limits: SubscriptionLimits(max_places: 2, log_retention_days: 2),
            enforcement_enabled: true, account_token: token
        )
    }

    private struct FetchError: Error {}

    func testParse_nilIsNoToken_validIsUUID_malformedThrows() throws {
        XCTAssertNil(try PurchaseAccountToken.parse(nil))
        XCTAssertEqual(try PurchaseAccountToken.parse(validToken), UUID(uuidString: validToken))
        XCTAssertThrowsError(try PurchaseAccountToken.parse("not-a-uuid")) {
            XCTAssertEqual($0 as? PurchaseAccountToken.TokenError, .malformed)
        }
        XCTAssertThrowsError(try PurchaseAccountToken.parse(""))
    }

    func testResolve_sameMember_reusesCache_withoutFetch() async throws {
        var fetched = 0
        let result = try await PurchaseAccountToken.resolve(
            cached: status(token: validToken), cachedOwner: 7, currentMember: 7
        ) { fetched += 1; return self.status(token: nil) }
        XCTAssertEqual(fetched, 0)
        XCTAssertEqual(result.token, UUID(uuidString: validToken))
    }

    func testResolve_differentMember_fetchesAndIgnoresOldToken() async throws {
        let other = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        var fetched = 0
        let result = try await PurchaseAccountToken.resolve(
            cached: status(token: validToken), cachedOwner: 7, currentMember: 8
        ) { fetched += 1; return self.status(token: other) }
        XCTAssertEqual(fetched, 1)
        XCTAssertEqual(result.token, UUID(uuidString: other))
    }

    func testResolve_unknownMemberOrNoCache_fetches() async throws {
        var fetched = 0
        _ = try await PurchaseAccountToken.resolve(cached: status(token: validToken), cachedOwner: 7, currentMember: nil) {
            fetched += 1; return self.status(token: nil)
        }
        _ = try await PurchaseAccountToken.resolve(cached: nil, cachedOwner: nil, currentMember: 7) {
            fetched += 1; return self.status(token: nil)
        }
        XCTAssertEqual(fetched, 2)
    }

    func testResolve_noTokenInResponse_isNormal() async throws {
        let result = try await PurchaseAccountToken.resolve(cached: nil, cachedOwner: nil, currentMember: 1) {
            self.status(token: nil)
        }
        XCTAssertNil(result.token)
    }

    func testResolve_malformedToken_throws() async {
        do {
            _ = try await PurchaseAccountToken.resolve(cached: nil, cachedOwner: nil, currentMember: 1) {
                self.status(token: "garbage")
            }
            XCTFail("형식 오류는 던져야 한다")
        } catch {
            XCTAssertEqual(error as? PurchaseAccountToken.TokenError, .malformed)
        }
    }

    func testResolve_fetchFailure_throwsFetchFailed() async {
        do {
            _ = try await PurchaseAccountToken.resolve(cached: nil, cachedOwner: nil, currentMember: 1) {
                throw FetchError()
            }
            XCTFail("조회 실패는 던져야 한다")
        } catch {
            XCTAssertEqual(error as? PurchaseAccountToken.TokenError, .fetchFailed)
        }
    }
}

@MainActor
final class ActivityLogScrubbingTests: XCTestCase {
    private func route(_ longitudes: [Double]) throws -> [MapMarker] {
        try longitudes.map { longitude in
            let data = try JSONEncoder().encode(["mlt_lat": 37.5, "mlt_long": longitude])
            return try JSONDecoder().decode(MapMarker.self, from: data)
        }
    }

    func testCameraAndMarkerFollowForwardAndReverseBetweenSamples() throws {
        let map = NMFMapView(frame: CGRect(x: 0, y: 0, width: 390, height: 640))
        let coordinator = ActivityLogMapView.Coordinator()
        let samples = try route([127.0, 127.01])
        for percent in [0.0, 25, 50, 100, 75, 0] {
            ActivityLogMapView(mapMarkers: samples, overlayRevision: 1, stayTimes: [],
                               sliderValue: percent, isSliderDragging: true)
                .updateMap(map, coordinator: coordinator)
            let expected = 127.0 + 0.01 * percent / 100
            XCTAssertEqual(coordinator.currentPositionMarker.anchor, CGPoint(x: 0.5, y: 0.5))
            XCTAssertEqual(coordinator.currentPositionMarker.position.lng, expected, accuracy: 0.000001)
            XCTAssertEqual(coordinator.currentInfoMarker.position.lng, expected, accuracy: 0.000001)
            XCTAssertEqual(map.cameraPosition.target.lng, expected, accuracy: 0.000001)
        }
    }

    func testSameSizeReplacementAndEmptyRoute() throws {
        let map = NMFMapView(frame: CGRect(x: 0, y: 0, width: 390, height: 640))
        let coordinator = ActivityLogMapView.Coordinator()
        for (revision, coordinates) in [[127.0, 127.01], [128.0, 128.01], []].enumerated() {
            ActivityLogMapView(mapMarkers: try route(coordinates), overlayRevision: revision,
                               stayTimes: [], sliderValue: 0, isSliderDragging: false)
                .updateMap(map, coordinator: coordinator)
            if let start = coordinates.first {
                XCTAssertEqual(coordinator.pathDotMarkers.first?.position.lng, start)
                XCTAssertEqual(coordinator.currentPositionMarker.position.lng, start)
            } else {
                XCTAssertTrue(coordinator.polylines.isEmpty)
                XCTAssertNil(coordinator.currentPositionMarker.mapView)
                XCTAssertNil(coordinator.currentInfoMarker.mapView)
            }
        }
    }

    func testRefreshWhileDraggingKeepsCameraOnMarker() throws {
        let map = NMFMapView(frame: CGRect(x: 0, y: 0, width: 390, height: 640))
        let coordinator = ActivityLogMapView.Coordinator()
        for (revision, samples) in [[127.0, 127.01], [127.0, 127.01, 127.03]].enumerated() {
            ActivityLogMapView(mapMarkers: try route(samples), overlayRevision: revision, stayTimes: [],
                               sliderValue: 50, isSliderDragging: true)
                .updateMap(map, coordinator: coordinator)
        }
        XCTAssertEqual(map.cameraPosition.target.lng, coordinator.currentPositionMarker.position.lng, accuracy: 0.000001)
    }

    func testMarkerCenterStaysOnScreenPathThroughTurnAndReverse() throws {
        let map = NMFMapView(frame: CGRect(x: 0, y: 0, width: 390, height: 720))
        let coordinator = ActivityLogMapView.Coordinator()
        let data = Data(#"[{"mlt_lat":37.50,"mlt_long":127.00},{"mlt_lat":37.52,"mlt_long":127.04},{"mlt_lat":37.51,"mlt_long":127.06}]"#.utf8)
        let samples = try JSONDecoder().decode([MapMarker].self, from: data)
        for percent in [0.0, 25, 50, 75, 100, 25] {
            ActivityLogMapView(mapMarkers: samples, overlayRevision: 1, stayTimes: [],
                               sliderValue: percent, isSliderDragging: true,
                               contentInsets: UIEdgeInsets(top: 70, left: 0, bottom: 264, right: 0))
                .updateMap(map, coordinator: coordinator)
            let progress = percent / 50
            let segment = min(Int(progress), 1)
            let fraction = CGFloat(progress - Double(segment))
            let start = map.projection.point(from: NMGLatLng(lat: samples[segment].latitude, lng: samples[segment].longitude))
            let end = map.projection.point(from: NMGLatLng(lat: samples[segment + 1].latitude, lng: samples[segment + 1].longitude))
            let marker = map.projection.point(from: coordinator.currentPositionMarker.position)
            XCTAssertEqual(marker.x, start.x + (end.x - start.x) * fraction, accuracy: 0.5)
            XCTAssertEqual(marker.y, start.y + (end.y - start.y) * fraction, accuracy: 0.5)
        }
    }

    func testDenseRouteRetainsEverySegmentWithBoundedOverlayCount() throws {
        let samples = try route((0...360).map { 127 + Double($0) / 100_000 })
        let coordinator = ActivityLogMapView.Coordinator()
        let map = NMFMapView(frame: CGRect(x: 0, y: 0, width: 390, height: 640))
        ActivityLogMapView(mapMarkers: samples, overlayRevision: 1, stayTimes: [],
                           sliderValue: 50, isSliderDragging: true)
            .updateMap(map, coordinator: coordinator)
        XCTAssertLessThanOrEqual(coordinator.polylines.count, 48)
        XCTAssertLessThanOrEqual(coordinator.pathDotMarkers.count, 40)
        XCTAssertLessThanOrEqual(coordinator.arrowMarkers.count, 16)
        XCTAssertEqual(coordinator.polylines.reduce(0) { $0 + $1.line.points.count - 1 }, samples.count - 1)
    }
}

@MainActor
final class HomeMapLayoutTests: XCTestCase {
    func testFamilyOpensTogetherAndRefreshPreservesExplicitSelection() throws {
        let data = Data(#"[{"mt_idx":1,"mt_name":"지우"},{"mt_idx":2,"mt_name":"민준"}]"#.utf8)
        let family = try JSONDecoder().decode([SmapGroupMember].self, from: data)
        let model = HomeViewModel()
        model.updateMembers(family)
        XCTAssertFalse(model.members.contains(where: { $0.isSelected }))
        model.selectMember(family[1])
        model.updateMembers(family.reversed())
        XCTAssertEqual(model.members.filter { $0.isSelected }.map(\.mt_idx), [2])
        model.updateMembers([family[0]])
        XCTAssertFalse(model.members.contains(where: { $0.isSelected }))
    }

    /// 가운데 줄에서 흰색 알약의 오른쪽 끝을 측정한다. 화면 너비와 픽셀 너비를 1:1로 맞춘다.
    private func whiteRightEdge(_ view: some View, width: Int) throws -> Int {
        let renderer = ImageRenderer(content: view.frame(width: CGFloat(width), height: 48, alignment: .leading)
            .background(Color.black))
        renderer.scale = 1
        let image = try XCTUnwrap(renderer.cgImage)
        var pixels = [UInt8](repeating: 0, count: width * 48 * 4)
        return try pixels.withUnsafeMutableBytes { bytes in
            let context = try XCTUnwrap(CGContext(data: bytes.baseAddress, width: width, height: 48,
                                                   bitsPerComponent: 8, bytesPerRow: width * 4,
                                                   space: CGColorSpaceCreateDeviceRGB(),
                                                   bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: 48))
            return try XCTUnwrap((0..<width).last { x in
                let i = (width * 24 + x) * 4
                return bytes[i] > 245 && bytes[i + 1] > 245 && bytes[i + 2] > 245
            })
        }
    }

    func testGroupPillGrowsWithNameAndCapsLongNames() throws {
        let short = try whiteRightEdge(GroupSwitcherPill(groupName: "가족", action: {}), width: 320)
        let long = try whiteRightEdge(GroupSwitcherPill(groupName: String(repeating: "우리 가족 ", count: 8), action: {}), width: 320)
        XCTAssertLessThan(short, long - 40)
        XCTAssertLessThanOrEqual(long, 240)
    }

    func testShowAllHasComfortableInsetOnCompactAndWideScreens() throws {
        var member = try JSONDecoder().decode(SmapGroupMember.self, from: Data(#"{"mt_idx":1,"mt_name":"아주 긴 이름을 쓰는 우리 가족"}"#.utf8))
        member.isSelected = true
        let header = HomeSheetHeader(members: [member], currentUserIdx: nil, selectedDate: Date(), onShowAll: {})
        for width in [320, 375, 430] {
            let edge = try whiteRightEdge(header, width: width)
            XCTAssertEqual(Double(width - edge - 1), 24, accuracy: 1)
        }
    }
}
