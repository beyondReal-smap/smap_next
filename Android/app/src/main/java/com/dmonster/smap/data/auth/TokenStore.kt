package com.dmonster.smap.data.auth

/**
 * Refresh token 저장소 추상화.
 * - access token은 기존 SharedPreferences("smap_auth_prefs")의 "auth_token" 키 사용 (호환).
 * - refresh token만 EncryptedSharedPreferences로 분리해 보관한다.
 */
interface TokenStore {
    fun getRefreshToken(): String?
    fun saveRefreshToken(token: String)
    fun clearRefreshToken()
}
