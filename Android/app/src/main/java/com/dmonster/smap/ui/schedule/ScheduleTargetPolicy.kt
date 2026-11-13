package com.dmonster.smap.ui.schedule

import com.dmonster.smap.data.model.SmapGroupMember

/**
 * 일정 생성 시 대상 멤버 결정 규칙 (서버 정책: 본인 일정은 누구나, 타인 일정은 그룹장·리더만).
 * ScheduleViewModel.canManageSchedule 과 동일한 기준(그룹장 전체 / 리더는 그룹장 제외)을 사용한다.
 */
object ScheduleTargetPolicy {

    /** 요청자가 그룹장 또는 리더인지 */
    fun canPickOtherMembers(members: List<SmapGroupMember>, currentUserId: Int): Boolean {
        val me = members.find { it.mtIdx == currentUserId } ?: return false
        return me.sgdtOwnerChk == "Y" || me.sgdtLeaderChk == "Y"
    }

    /** 생성 화면에 노출할 대상 멤버. 일반 멤버는 본인만, 리더는 그룹장을 제외한 전원, 그룹장은 전원 */
    fun selectableMembers(members: List<SmapGroupMember>, currentUserId: Int): List<SmapGroupMember> {
        val me = members.find { it.mtIdx == currentUserId } ?: return emptyList()
        return when {
            me.sgdtOwnerChk == "Y" -> members
            me.sgdtLeaderChk == "Y" -> members.filter { it.mtIdx == currentUserId || it.sgdtOwnerChk != "Y" }
            else -> listOf(me)
        }
    }

    /** 생성 화면의 초기 대상: 항상 로그인한 본인 (목록에 없으면 null) */
    fun defaultTarget(members: List<SmapGroupMember>, currentUserId: Int): SmapGroupMember? =
        members.find { it.mtIdx == currentUserId }

    /**
     * 생성 요청 본문에 실을 mt_idx. 선택값이 허용 목록에 없으면 본인으로 되돌린다
     * (일반 멤버는 항상 본인).
     */
    fun resolveCreateTargetId(members: List<SmapGroupMember>, currentUserId: Int, requestedId: Int?): Int {
        if (requestedId == null || requestedId == currentUserId) return currentUserId
        return if (selectableMembers(members, currentUserId).any { it.mtIdx == requestedId }) requestedId else currentUserId
    }
}
