package com.dmonster.smap.ui.myplace

/**
 * 장소 관리 권한 판정 — 정책 변경 지점(한 곳).
 * 현재 서버 정책: 장소는 소유자 본인만 추가·수정·삭제·알림 토글 (locations.py).
 * "그룹장·리더가 멤버 장소 관리"로 정책이 바뀌면 이 객체만 수정한다.
 */
object MyPlaceManagePolicy {
    /** 기존 장소를 수정·삭제·알림 토글할 수 있는지 */
    fun canManageLocation(currentUserId: Int?, locationOwnerId: Int?): Boolean =
        currentUserId != null && currentUserId == locationOwnerId

    /** 현재 선택된 멤버의 장소를 추가할 수 있는지 (본인 선택 시에만) */
    fun canAddLocation(currentUserId: Int?, selectedMemberId: Int?): Boolean =
        currentUserId != null && selectedMemberId != null && currentUserId == selectedMemberId
}
