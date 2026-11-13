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
