package com.dmonster.smap.data.auth

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * AndroidX Security의 EncryptedSharedPreferences로 refresh token을 보관.
 * Keystore 기반 마스터 키로 AES-256-GCM 암호화.
 *
 * 키스토어 초기화에 실패하면 일반 SharedPreferences로 fallback. fallback은
 * 보안 약화이지만 기능 유지를 우선한다(앱이 시작조차 못 하는 것보다 낫다).
 */
@Singleton
class EncryptedTokenStore @Inject constructor(
    @ApplicationContext private val context: Context
) : TokenStore {

    companion object {
        private const val TAG = "EncryptedTokenStore"
        private const val PREFS_NAME = "smap_secure_prefs"
        private const val FALLBACK_PREFS_NAME = "smap_secure_prefs_plain"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
    }

    private val prefs: SharedPreferences by lazy { openPrefs() }

    private fun openPrefs(): SharedPreferences {
        return runCatching {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }.getOrElse { e ->
            Log.w(TAG, "EncryptedSharedPreferences init failed, falling back to plain prefs", e)
            context.getSharedPreferences(FALLBACK_PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    override fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    override fun saveRefreshToken(token: String) {
        prefs.edit().putString(KEY_REFRESH_TOKEN, token).apply()
    }

    override fun clearRefreshToken() {
        prefs.edit().remove(KEY_REFRESH_TOKEN).apply()
    }
}
