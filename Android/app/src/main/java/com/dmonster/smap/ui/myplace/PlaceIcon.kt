package com.dmonster.smap.ui.myplace

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Business
import androidx.compose.material.icons.outlined.Church
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.LocalCafe
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Park
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Train
import androidx.compose.ui.graphics.vector.ImageVector
import com.dmonster.smap.data.model.SavedLocation

/**
 * 저장한 장소의 종류 — 목록 왼쪽 아이콘을 장소마다 다르게 보여 주려고 쓴다(2026-11-20, 전부 같은 핀이라 구분이 안 됐다).
 * 사용자가 저장할 때 고른 값(slt_icon)이 있으면 그것을, 없으면(예전 장소) 이름의 낱말로 짐작한다.
 * iOS PlaceIcon.swift 와 같은 키·규칙.
 *
 * key 는 서버 slt_icon 에 저장하는 값 — 바꾸면 이미 저장된 장소의 아이콘이 풀리니 바꾸지 말 것.
 * 선언 순서가 아이콘 고르기 화면의 순서다.
 */
enum class PlaceKind(val key: String, val label: String) {
    Home("home", "집"),
    Family("family", "가족"),
    Office("office", "회사"),
    School("school", "학교"),
    Academy("academy", "학원"),
    Hospital("hospital", "병원"),
    Cafe("cafe", "카페"),
    Restaurant("restaurant", "식당"),
    Shopping("shopping", "마트"),
    Fitness("fitness", "운동"),
    Park("park", "공원"),
    Religion("religion", "종교"),
    Transit("transit", "교통"),
    Other("other", "기타");

    companion object {
        fun fromKey(key: String?): PlaceKind? = entries.firstOrNull { it.key == key }
    }
}

/**
 * 위에서부터 먼저 맞는 종류. 순서가 뜻을 가른다:
 * "어린이집"은 집보다 학교, "맛집"은 집보다 식당, "할머니집"은 집보다 가족이 먼저 걸리게 한다.
 */
private val PlaceKindRules: List<Pair<PlaceKind, List<String>>> = listOf(
    PlaceKind.School to listOf("학교", "대학", "유치원", "어린이집", "캠퍼스", "school"),
    PlaceKind.Academy to listOf("학원", "도서관", "독서실", "스터디"),
    PlaceKind.Restaurant to listOf("맛집", "식당", "레스토랑", "음식점"),
    PlaceKind.Cafe to listOf("카페", "커피", "스타벅스", "cafe", "coffee"),
    PlaceKind.Family to listOf("할머니", "할아버지", "외가", "친가", "본가", "부모님", "엄마", "아빠", "시댁", "처가"),
    PlaceKind.Home to listOf("집", "아파트", "빌라", "자택", "home"),
    PlaceKind.Office to listOf("회사", "사무실", "직장", "오피스", "본사", "지사", "출근", "office", "work"),
    PlaceKind.Hospital to listOf("병원", "의원", "치과", "약국", "보건소", "hospital"),
    PlaceKind.Shopping to listOf("마트", "시장", "편의점", "백화점", "쇼핑", "아울렛", "다이소", "코스트코"),
    PlaceKind.Fitness to listOf("헬스", "체육관", "수영장", "필라테스", "요가", "태권도", "피트니스", "gym"),
    PlaceKind.Park to listOf("공원", "놀이터", "운동장", "park"),
    PlaceKind.Religion to listOf("교회", "성당", "사찰", "법당"),
    PlaceKind.Transit to listOf("정류장", "터미널", "공항"),
)

/** 저장된 키가 있으면 그 종류, 없거나 이 앱이 모르는 키면 이름으로 짐작한다. */
fun placeKindOf(icon: String?, name: String): PlaceKind = PlaceKind.fromKey(icon) ?: placeKindOf(name)

/** 목록·칩·상세에 보여 줄 종류 — 고른 아이콘이 먼저, 없으면 이름으로 짐작 */
val SavedLocation.kind: PlaceKind get() = placeKindOf(sltIcon, name)

fun placeKindOf(name: String): PlaceKind {
    val text = name.trim().lowercase()
    PlaceKindRules.firstOrNull { (_, words) -> words.any { it in text } }?.let { return it.first }
    // "역"은 한 글자라 "지역" 등에도 들어 있어 이름 끝에 올 때만(강남역·서울역)
    if (text.endsWith("역")) return PlaceKind.Transit
    return PlaceKind.Other
}

val PlaceKind.icon: ImageVector
    get() = when (this) {
        PlaceKind.School -> Icons.Outlined.School
        PlaceKind.Academy -> Icons.Outlined.MenuBook
        PlaceKind.Restaurant -> Icons.Outlined.Restaurant
        PlaceKind.Cafe -> Icons.Outlined.LocalCafe
        PlaceKind.Family -> Icons.Outlined.Favorite
        PlaceKind.Home -> Icons.Outlined.Home
        PlaceKind.Office -> Icons.Outlined.Business
        PlaceKind.Hospital -> Icons.Outlined.LocalHospital
        PlaceKind.Shopping -> Icons.Outlined.ShoppingCart
        PlaceKind.Fitness -> Icons.Outlined.FitnessCenter
        PlaceKind.Park -> Icons.Outlined.Park
        PlaceKind.Religion -> Icons.Outlined.Church
        PlaceKind.Transit -> Icons.Outlined.Train
        PlaceKind.Other -> Icons.Outlined.Place
    }
