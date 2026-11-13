package com.dmonster.smap.data.billing

import com.dmonster.smap.data.api.ApiResult
import com.dmonster.smap.data.model.SubscriptionStatusResponse
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

sealed class AccountTokenResult {
    /** 구매에 넣을 계정 토큰(UUID 문자열). */
    data class Token(val value: String) : AccountTokenResult() {
        override fun toString() = "Token(***)" // 토큰 값이 로그에 남지 않게 한다.
    }

    /** 서버가 토큰을 내려주지 않음(서버 비밀 미설정 등 정상 상태). 토큰 없이 진행한다. */
    data object None : AccountTokenResult()

    /** 구매를 시작하면 안 되는 상태. message는 사용자 표시용(토큰 값 미포함). */
    data class Failure(val message: String) : AccountTokenResult()
}

/**
 * 구매 직전에 현재 로그인 회원의 account_token을 확보한다.
 * - 메모리 캐시는 회원 식별자와 함께 보관하고, 현재 회원과 다르면 재조회한다.
 * - 로그아웃 시 [invalidate]로 비운다. 디스크에는 저장하지 않는다.
 * - 값이 없는 응답은 캐시하지 않는다(서버 비밀이 나중에 설정될 수 있음).
 * - 조회 실패·형식 이상은 [AccountTokenResult.Failure]로 구매를 막는다.
 */
class PurchaseAccountTokenResolver(
    private val currentMemberId: () -> Int,
    private val fetchStatus: suspend () -> ApiResult<SubscriptionStatusResponse>?
) {
    companion object {
        const val MAX_LENGTH = 64 // Google obfuscatedAccountId 상한
        private val UUID_REGEX = Regex(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        )
        const val MSG_LOOKUP_FAILED = "구독 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요."
        const val MSG_LOGIN_REQUIRED = "로그인이 필요합니다."
    }

    private val mutex = Mutex()
    private var cachedMemberId: Int = 0
    private var cachedToken: String? = null

    suspend fun resolve(): AccountTokenResult = mutex.withLock {
        val memberId = currentMemberId()
        if (memberId <= 0) {
            cachedToken = null
            return AccountTokenResult.Failure(MSG_LOGIN_REQUIRED)
        }
        val cached = cachedToken
        if (cached != null && cachedMemberId == memberId) {
            return AccountTokenResult.Token(cached)
        }
        cachedToken = null

        val result = fetchStatus()
        if (result !is ApiResult.Success) return AccountTokenResult.Failure(MSG_LOOKUP_FAILED)
        // 조회 중 계정이 바뀌었으면 응답을 신뢰하지 않는다.
        if (currentMemberId() != memberId) return AccountTokenResult.Failure(MSG_LOOKUP_FAILED)

        val raw = result.data.accountToken
        if (raw.isNullOrBlank()) return AccountTokenResult.None
        val token = raw.trim()
        if (token.length > MAX_LENGTH || !UUID_REGEX.matches(token)) {
            return AccountTokenResult.Failure(MSG_LOOKUP_FAILED)
        }
        cachedMemberId = memberId
        cachedToken = token
        AccountTokenResult.Token(token)
    }

    fun invalidate() {
        cachedToken = null
        cachedMemberId = 0
    }
}
