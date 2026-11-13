package com.dmonster.smap.ui.myplace

import com.dmonster.smap.data.model.SmapGroupMember

/**
 * 장소 관리 권한 판정 — 정책 변경 지점(한 곳).
 * 서버(Go API `CanManagePlace`)와 같은 규칙:
 *  - 본인 장소는 항상 관리 가능
 *  - 그룹장: 같은 그룹 모든 멤버의 장소 관리 가능
 *  - 리더: 그룹장을 제외한 멤버의 장소 관리 가능 (그룹장의 장소는 그룹장만)
 *  - 일반 멤버: 본인 것만 (타 멤버 장소는 보기만)
 * 그룹장·리더 여부는 서버 멤버 목록의 sgdt_owner_chk / sgdt_leader_chk 로 판단한다.
 * 서버는 대상이 같은 그룹 현재 멤버가 아니면 거부하므로, 목록에 없는 대상(본인 제외)은 허용하지 않는다.
 */
object MyPlaceManagePolicy {
    /** [targetId] 멤버의 장소를 [currentUserId] 가 추가·수정·삭제·알림 변경할 수 있는지 */
    fun canManageMemberPlaces(
        currentUserId: Int?,
        targetId: Int?,
        members: List<SmapGroupMember>
    ): Boolean {
        if (currentUserId == null || targetId == null) return false
        if (currentUserId == targetId) return true
        val me = members.find { it.mtIdx == currentUserId } ?: return false
        val target = members.find { it.mtIdx == targetId } ?: return false
        return when {
            me.sgdtOwnerChk == "Y" -> true
            me.sgdtLeaderChk == "Y" -> target.sgdtOwnerChk != "Y"
            else -> false
        }
    }

    /** 기존 장소를 수정·삭제·알림 토글할 수 있는지 */
    fun canManageLocation(
        currentUserId: Int?,
        locationOwnerId: Int?,
        members: List<SmapGroupMember>
    ): Boolean = canManageMemberPlaces(currentUserId, locationOwnerId, members)

    /** 현재 선택된 멤버의 장소를 추가할 수 있는지 */
    fun canAddLocation(
        currentUserId: Int?,
        selectedMemberId: Int?,
        members: List<SmapGroupMember>
    ): Boolean = canManageMemberPlaces(currentUserId, selectedMemberId, members)
}
