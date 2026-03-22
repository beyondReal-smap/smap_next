package com.dmonster.smap

/**
 * 앱 전역 상수
 */
object AppConstants {
    
    /**
     * 기본 위치 좌표 (서울 시청)
     * 위치 권한이 없거나 위치를 가져올 수 없을 때 사용
     */
    object DefaultLocation {
        const val LATITUDE = 37.5665
        const val LONGITUDE = 126.9780
        const val NAME = "서울 시청"
    }
    
    /**
     * 지도 기본 줌 레벨
     */
    object MapZoom {
        const val DEFAULT = 11.0
        const val CLOSE = 15.0
        const val MEMBER_FOCUS = 16.0
    }
}
