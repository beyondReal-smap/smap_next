package com.dmonster.smap.ui.home

import com.dmonster.smap.data.model.SmapSchedule
import com.naver.maps.geometry.LatLng
import org.junit.Assert.assertEquals
import org.junit.Test

class ScheduleRouteTest {

    private fun s(id: Int, member: Int?, lat: Double?, lng: Double?) =
        SmapSchedule(sstIdx = id.toString(), mtIdx = member, sstLocationLat = lat, sstLocationLong = lng)

    @Test
    fun `멤버별로 따로 잇고 시각 순서를 지킨다`() {
        val routes = scheduleRoutes(listOf(
            s(1, 1, 37.50, 127.00),
            s(2, 2, 37.60, 127.10),
            s(3, 1, 37.51, 127.01),
            s(4, 2, 37.61, 127.11),
        ))
        assertEquals(listOf(
            listOf(LatLng(37.50, 127.00), LatLng(37.51, 127.01)),
            listOf(LatLng(37.60, 127.10), LatLng(37.61, 127.11)),
        ), routes)
    }

    @Test
    fun `한 곳뿐이거나 장소·멤버가 없으면 잇지 않는다`() {
        val routes = scheduleRoutes(listOf(
            s(1, 1, 37.50, 127.00),
            s(2, 1, null, null),       // 장소 없음
            s(3, 1, 0.0, 0.0),         // 좌표 0,0
            s(4, null, 37.52, 127.02), // 멤버 모름
            s(5, 2, 37.60, 127.10),
        ))
        assertEquals(emptyList<List<LatLng>>(), routes)
    }

    @Test
    fun `같은 자리가 이어지면 한 번만`() {
        val routes = scheduleRoutes(listOf(
            s(1, 1, 37.50, 127.00),
            s(2, 1, 37.50, 127.00),
            s(3, 1, 37.51, 127.01),
        ))
        assertEquals(listOf(listOf(LatLng(37.50, 127.00), LatLng(37.51, 127.01))), routes)
    }
}
