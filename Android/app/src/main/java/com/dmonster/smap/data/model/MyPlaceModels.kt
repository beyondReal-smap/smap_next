package com.dmonster.smap.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

/**
 * 저장 장소 데이터
 */
data class SavedLocation(
    @SerializedName("slt_idx") val sltIdx: Int,
    @SerializedName("slt_title") val sltTitle: String?,
    @SerializedName("slt_add") val sltAdd: String?,
    @SerializedName("slt_lat") val sltLat: Double?,
    @SerializedName("slt_long") val sltLong: Double?,
    @SerializedName("slt_memo") val sltMemo: String?,
    @SerializedName("slt_show") val sltShow: String?,
    @SerializedName("slt_wdate") val sltWdate: String?,
    @SerializedName("slt_udate") val sltUdate: String?,
    @SerializedName("mt_idx") val mtIdx: Int?,
    @SerializedName("sgt_idx") val sgtIdx: Int?,
    @SerializedName("slt_enter_alarm") val sltEnterAlarm: String?
) : Serializable {
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
data class SavedLocationListResponse(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: List<SavedLocation>?,
    @SerializedName("message") val message: String?
)

/**
 * 저장 장소 단일 API 응답
 */
data class SavedLocationResponse(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("data") val data: SavedLocation?,
    @SerializedName("message") val message: String?
)

/**
 * Kakao 장소 검색 결과 모델
 */
data class KakaoPlace(
    @SerializedName("id") val id: String,
    @SerializedName("place_name") val placeName: String,
    @SerializedName("address_name") val addressName: String,
    @SerializedName("road_address_name") val roadAddressName: String,
    @SerializedName("x") val x: String, // Longitude
    @SerializedName("y") val y: String  // Latitude
) : java.io.Serializable {
    val latitude: Double get() = y.toDoubleOrNull() ?: 0.0
    val longitude: Double get() = x.toDoubleOrNull() ?: 0.0
    val displayName: String get() = placeName
    val displayAddress: String get() = if (roadAddressName.isNotBlank()) roadAddressName else addressName
}

/**
 * Kakao 장소 검색 API 응답
 */
data class KakaoPlaceResponse(
    @SerializedName("documents") val documents: List<KakaoPlace>
)

/**
 * Kakao 역지오코딩 API 응답
 */
data class KakaoAddressResponse(
    @SerializedName("documents") val documents: List<KakaoAddressDocument>
)

data class KakaoAddressDocument(
    @SerializedName("address") val address: KakaoAddress?,
    @SerializedName("road_address") val roadAddress: KakaoRoadAddress?
)

data class KakaoAddress(
    @SerializedName("address_name") val addressName: String
)

data class KakaoRoadAddress(
    @SerializedName("address_name") val addressName: String
)
