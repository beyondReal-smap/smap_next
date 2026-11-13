package com.dmonster.smap.ui.schedule

import com.dmonster.smap.data.model.SmapGroupMember
import org.junit.Assert.*
import org.junit.Test

class ScheduleTargetPolicyTest {
    private val owner = SmapGroupMember(mtIdx = 1, sgdtOwnerChk = "Y", sgdtLeaderChk = "N")
    private val leader = SmapGroupMember(mtIdx = 2, sgdtOwnerChk = "N", sgdtLeaderChk = "Y")
    private val member = SmapGroupMember(mtIdx = 3, sgdtOwnerChk = "N", sgdtLeaderChk = "N")
    private val member2 = SmapGroupMember(mtIdx = 4, sgdtOwnerChk = "N", sgdtLeaderChk = "N")
    // 서버는 그룹장을 목록 앞에 정렬한다
    private val all = listOf(owner, leader, member, member2)

    @Test
    fun `default target is the logged in user, not the first member`() {
        assertEquals(3, ScheduleTargetPolicy.defaultTarget(all, 3)?.mtIdx)
        assertNull(ScheduleTargetPolicy.defaultTarget(all, 99))
    }

    @Test
    fun `plain member only sees self and cannot pick others`() {
        assertFalse(ScheduleTargetPolicy.canPickOtherMembers(all, 3))
        assertEquals(listOf(3), ScheduleTargetPolicy.selectableMembers(all, 3).map { it.mtIdx })
    }

    @Test
    fun `plain member request body is always self`() {
        assertEquals(3, ScheduleTargetPolicy.resolveCreateTargetId(all, 3, 1))
        assertEquals(3, ScheduleTargetPolicy.resolveCreateTargetId(all, 3, 4))
        assertEquals(3, ScheduleTargetPolicy.resolveCreateTargetId(all, 3, null))
        assertEquals(3, ScheduleTargetPolicy.resolveCreateTargetId(all, 3, 0))
    }

    @Test
    fun `owner can pick everyone`() {
        assertTrue(ScheduleTargetPolicy.canPickOtherMembers(all, 1))
        assertEquals(4, ScheduleTargetPolicy.selectableMembers(all, 1).size)
        assertEquals(4, ScheduleTargetPolicy.resolveCreateTargetId(all, 1, 4))
    }

    @Test
    fun `leader can pick others except owner`() {
        assertTrue(ScheduleTargetPolicy.canPickOtherMembers(all, 2))
        assertEquals(listOf(2, 3, 4), ScheduleTargetPolicy.selectableMembers(all, 2).map { it.mtIdx })
        assertEquals(4, ScheduleTargetPolicy.resolveCreateTargetId(all, 2, 4))
        assertEquals(2, ScheduleTargetPolicy.resolveCreateTargetId(all, 2, 1))
    }

    @Test
    fun `user not in member list gets no selectable members`() {
        assertTrue(ScheduleTargetPolicy.selectableMembers(all, 99).isEmpty())
        assertFalse(ScheduleTargetPolicy.canPickOtherMembers(all, 99))
    }
}
