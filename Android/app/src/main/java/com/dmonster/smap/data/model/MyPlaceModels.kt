package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 저장 장소 데이터
 */
@Serializable
data class SavedLocation(
    @SerialName("slt_idx") val sltIdx: Int = 0,
    @SerialName("slt_title") val sltTitle: String? = null,
    @SerialName("slt_add") val sltAdd: String? = null,
    @SerialName("slt_lat") val sltLat: Double? = null,
    @SerialName("slt_long") val sltLong: Double? = null,
    @SerialName("slt_memo") val sltMemo: String? = null,
    @SerialName("slt_show") val sltShow: String? = null,
    @SerialName("slt_wdate") val sltWdate: String? = null,
    @SerialName("slt_udate") val sltUdate: String? = null,
    @SerialName("mt_idx") val mtIdx: Int? = null,
    @SerialName("sgt_idx") val sgtIdx: Int? = null,
    @SerialName("slt_enter_alarm") val sltEnterAlarm: String? = null
) {
    val id: Int get() = sltIdx
    val name: String get() = sltTitle ?: "이름 없음"
    val address: String get() = sltAdd ?: "주소 없음"
    val latitude: Double get() = sltLat ?: 0.0
    val longitude: Double get() = sltLong ?: 0.0
    val memo: String get() = sltMemo ?: ""

    val hasValidCoordinates: Boolean
        get() = sltLat != null && sltLong != null && sltLat != 0.0 && sltLong != 0.0 &&
                !sltLat.isNaN() && !sltLong.isNaN()
}

/**
 * 저장 장소 목록 API 응답
 */
@Serializable
data class SavedLocationListResponse(
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: List<SavedLocation>? = null,
    @SerialName("message") val message: String? = null
)

/**
 * 저장 장소 단일 API 응답
 */
@Serializable
data class SavedLocationResponse(
    @SerialName("success") val success: Boolean? = null,
    @SerialName("data") val data: SavedLocation? = null,
    @SerialName("message") val message: String? = null
)

/**
 * Kakao 장소 검색 결과 모델
 */
@Serializable
data class KakaoPlace(
    @SerialName("id") val id: String,
    @SerialName("place_name") val placeName: String,
    @SerialName("address_name") val addressName: String,
    @SerialName("road_address_name") val roadAddressName: String,
    @SerialName("x") val x: String, // Longitude
    @SerialName("y") val y: String  // Latitude
) {
    val latitude: Double get() = y.toDoubleOrNull() ?: 0.0
    val longitude: Double get() = x.toDoubleOrNull() ?: 0.0
    val displayName: String get() = placeName
    val displayAddress: String get() = if (roadAddressName.isNotBlank()) roadAddressName else addressName
}

/**
 * Kakao 장소 검색 API 응답
 */
@Serializable
data class KakaoPlaceResponse(
    @SerialName("documents") val documents: List<KakaoPlace> = emptyList()
)

/**
 * Kakao 역지오코딩 API 응답
 */
@Serializable
data class KakaoAddressResponse(
    @SerialName("documents") val documents: List<KakaoAddressDocument> = emptyList()
)

@Serializable
data class KakaoAddressDocument(
    @SerialName("address") val address: KakaoAddress? = null,
    @SerialName("road_address") val roadAddress: KakaoRoadAddress? = null
)

@Serializable
data class KakaoAddress(
    @SerialName("address_name") val addressName: String = ""
)

@Serializable
data class KakaoRoadAddress(
    @SerialName("address_name") val addressName: String = "",
    @SerialName("building_name") val buildingName: String? = null
)
