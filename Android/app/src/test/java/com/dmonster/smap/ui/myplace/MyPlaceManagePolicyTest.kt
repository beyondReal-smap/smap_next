package com.dmonster.smap.ui.myplace

import com.dmonster.smap.data.model.SmapGroupMember
import org.junit.Assert.*
import org.junit.Test

class MyPlaceManagePolicyTest {
    private fun m(id: Int, owner: Boolean = false, leader: Boolean = false) = SmapGroupMember(
        mtIdx = id,
        sgdtOwnerChk = if (owner) "Y" else "N",
        sgdtLeaderChk = if (leader) "Y" else "N"
    )

    // 1=그룹장, 2=리더, 3=일반, 4=일반(다른 일반 멤버)
    private val members = listOf(m(1, owner = true), m(2, leader = true), m(3), m(4))

    // 서버 CanManagePlace 규칙: 본인 / 그룹장→전원 / 리더→그룹장 제외 / 일반→본인만
    private fun serverRule(requester: Int, target: Int): Boolean = when {
        requester == target -> true
        requester == 1 -> true
        requester == 2 -> target != 1
        else -> false
    }

    @Test fun `all requester-target combinations match server rule`() {
        for (req in 1..4) for (target in 1..4) {
            val expected = serverRule(req, target)
            assertEquals("req=$req target=$target manage", expected,
                MyPlaceManagePolicy.canManageLocation(req, target, members))
            assertEquals("req=$req target=$target add", expected,
                MyPlaceManagePolicy.canAddLocation(req, target, members))
        }
    }

    @Test fun `owner can manage everyone`() {
        for (t in 1..4) assertTrue(MyPlaceManagePolicy.canManageLocation(1, t, members))
    }

    @Test fun `leader cannot manage group owner but can manage others`() {
        assertFalse(MyPlaceManagePolicy.canManageLocation(2, 1, members))
        assertTrue(MyPlaceManagePolicy.canManageLocation(2, 3, members))
        assertTrue(MyPlaceManagePolicy.canManageLocation(2, 2, members))
    }

    @Test fun `regular member manages only own`() {
        assertTrue(MyPlaceManagePolicy.canManageLocation(3, 3, members))
        assertFalse(MyPlaceManagePolicy.canManageLocation(3, 4, members))
        assertFalse(MyPlaceManagePolicy.canManageLocation(3, 1, members))
        assertFalse(MyPlaceManagePolicy.canManageLocation(3, 2, members))
    }

    @Test fun `unknown user or target is denied`() {
        assertFalse(MyPlaceManagePolicy.canManageLocation(null, 3, members))
        assertFalse(MyPlaceManagePolicy.canAddLocation(1, null, members))
        // 목록에 없는 대상(그룹 밖)은 그룹장이라도 불가, 본인은 항상 가능
        assertFalse(MyPlaceManagePolicy.canManageLocation(1, 99, members))
        assertTrue(MyPlaceManagePolicy.canManageLocation(99, 99, members))
        // 요청자가 목록에 없으면 타인 장소 불가
        assertFalse(MyPlaceManagePolicy.canManageLocation(99, 3, members))
    }
}
