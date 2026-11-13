import XCTest
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
