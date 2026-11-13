package com.dmonster.smap.data.service

/** [RequestCoalescer] 키. GroupService와 HomeService가 같은 요청을 같은 키로 합치도록 한곳에서 정의한다. */
object RequestKeys {
    const val GROUPS = "groups/current-user"
    fun members(groupId: Int) = "group-members/member/$groupId"
    fun schedules(groupId: Int, days: Int) = "schedules/group/$groupId?days=$days"
}
