package com.dmonster.smap.ui.myplace

import org.junit.Assert.*
import org.junit.Test

class MyPlaceManagePolicyTest {
    @Test fun `owner can manage own location`() {
        assertTrue(MyPlaceManagePolicy.canManageLocation(currentUserId = 5, locationOwnerId = 5))
    }

    @Test fun `others location is view only even for group owner or leader`() {
        // 정책은 멤버 역할과 무관하게 소유자 본인만 허용
        assertFalse(MyPlaceManagePolicy.canManageLocation(currentUserId = 1, locationOwnerId = 5))
    }

    @Test fun `unknown current user cannot manage`() {
        assertFalse(MyPlaceManagePolicy.canManageLocation(currentUserId = null, locationOwnerId = 5))
        assertFalse(MyPlaceManagePolicy.canAddLocation(currentUserId = null, selectedMemberId = 5))
    }

    @Test fun `add is allowed only when selected member is self`() {
        assertTrue(MyPlaceManagePolicy.canAddLocation(5, 5))
        assertFalse(MyPlaceManagePolicy.canAddLocation(5, 6))
        assertFalse(MyPlaceManagePolicy.canAddLocation(5, null))
    }
}
