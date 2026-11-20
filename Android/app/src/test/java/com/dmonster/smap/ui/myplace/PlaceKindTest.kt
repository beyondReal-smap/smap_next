package com.dmonster.smap.ui.myplace

import org.junit.Assert.assertEquals
import org.junit.Test

class PlaceKindTest {
    @Test
    fun 기본_종류() {
        assertEquals(PlaceKind.Home, placeKindOf("집"))
        assertEquals(PlaceKind.Home, placeKindOf("우리집"))
        assertEquals(PlaceKind.School, placeKindOf("문래초등학교"))
        assertEquals(PlaceKind.Office, placeKindOf("회사"))
        assertEquals(PlaceKind.Academy, placeKindOf("영어학원"))
        assertEquals(PlaceKind.Hospital, placeKindOf("서울대병원"))
        assertEquals(PlaceKind.Transit, placeKindOf("강남역"))
        assertEquals(PlaceKind.Home, placeKindOf("Home"))
    }

    @Test
    fun 순서가_뜻을_가르는_이름() {
        // "집"이 들어 있어도 더 구체적인 종류가 먼저
        assertEquals(PlaceKind.School, placeKindOf("해님어린이집"))
        assertEquals(PlaceKind.Restaurant, placeKindOf("동네 맛집"))
        assertEquals(PlaceKind.Family, placeKindOf("할머니집"))
    }

    @Test
    fun 모르는_이름은_핀() {
        assertEquals(PlaceKind.Other, placeKindOf("지역 모임"))  // "역"이 끝이 아니면 역 아님
        assertEquals(PlaceKind.Other, placeKindOf("자주 가는 곳"))
        assertEquals(PlaceKind.Other, placeKindOf(""))
    }

    @Test
    fun 고른_아이콘이_이름보다_먼저() {
        assertEquals(PlaceKind.Cafe, placeKindOf("cafe", "우리 집"))
        // 고르지 않았거나 이 앱이 모르는 키(새 버전에서 추가된 종류)는 이름으로 짐작
        assertEquals(PlaceKind.Home, placeKindOf(null, "우리 집"))
        assertEquals(PlaceKind.Home, placeKindOf("spaceship", "우리 집"))
    }

    @Test
    fun 키는_서버_형식에_맞고_겹치지_않는다() {
        val keys = PlaceKind.entries.map { it.key }
        assertEquals(keys.size, keys.toSet().size)
        keys.forEach { assert(Regex("^[a-z][a-z_]{0,19}$").matches(it)) { it } }
    }
}
