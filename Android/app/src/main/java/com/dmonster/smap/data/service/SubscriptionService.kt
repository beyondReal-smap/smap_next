package com.dmonster.smap.data.service

import android.content.SharedPreferences
import android.util.Log
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import com.dmonster.smap.data.api.ApiResult
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.api.safeApiCall
import com.dmonster.smap.data.model.SubscriptionStatusResponse
import com.dmonster.smap.data.model.SubscriptionVerifyRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDate

sealed class SubscriptionVerifyResult {
    data class Success(val status: SubscriptionStatusResponse) : SubscriptionVerifyResult()
    data class Conflict(val message: String) : SubscriptionVerifyResult()
    data class RetryLater(val message: String) : SubscriptionVerifyResult()
    data class Invalid(val message: String) : SubscriptionVerifyResult()
    data class Error(val message: String) : SubscriptionVerifyResult()
}

/**
 * 구독 정책 판단용 순수 함수 모음 (단위 테스트 대상).
 */
object SubscriptionPolicy {
    /**
     * 활동 로그 날짜 선택 UI에서 잠금 표시 여부를 결정한다.
     * - enforcement_enabled == false 이면 항상 false (잠금 없음).
     * - is_premium == true 이면 항상 false.
     * - 그 외에는 today 기준 최근 logRetentionDays(오늘 포함) 이전 날짜만 true.
     */
    fun isActivityDateLocked(
        date: LocalDate,
        today: LocalDate,
        status: SubscriptionStatusResponse?
    ): Boolean {
        if (status == null) return false
        if (!status.enforcementEnabled || status.isPremium) return false
        val retentionDays = status.limits.logRetentionDays.coerceAtLeast(1)
        val minAllowedDate = today.minusDays((retentionDays - 1).toLong())
        return date.isBefore(minAllowedDate)
    }

    /**
     * 미완료 구매 재처리 대상 필터(순수 로직, 단위 테스트용).
     * PURCHASED 상태이면서 아직 서버에 의해 확인(acknowledge)되지 않은 구매만 재처리한다.
     * PENDING 상태는 완료로 취급하지 않는다.
     */
    fun shouldReprocessPurchase(
        isLoggedIn: Boolean,
        isPurchasedState: Boolean,
        isAcknowledged: Boolean,
        matchesProduct: Boolean
    ): Boolean {
        return isLoggedIn && isPurchasedState && !isAcknowledged && matchesProduct
    }
}

/**
 * 전역 구독 상태 보관 및 백엔드 구독 API 통신 서비스.
 * 기존 AuthService의 SharedPreferences + StateFlow 패턴을 따른다.
 */
class SubscriptionService(
    private val api: SmapApi,
    private val prefs: SharedPreferences,
    private val authService: AuthService
) {
    companion object {
        private const val TAG = "SubscriptionService"
        private const val KEY_SUBSCRIPTION_STATUS = "subscription_status_json"
        const val PRODUCT_ID = "smap_premium"
    }

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _subscriptionStatus = MutableStateFlow<SubscriptionStatusResponse?>(loadCachedStatus())
    val subscriptionStatus: StateFlow<SubscriptionStatusResponse?> = _subscriptionStatus.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    init {
        scope.launch {
            GlobalEventBus.events.collect { event ->
                if (event is GlobalEvent.LoggedOut) {
                    clear()
                }
            }
        }
    }

    private fun loadCachedStatus(): SubscriptionStatusResponse? {
        if (!authService.isLoggedIn) return null
        val raw = prefs.getString(KEY_SUBSCRIPTION_STATUS, null) ?: return null
        return try {
            json.decodeFromString<SubscriptionStatusResponse>(raw)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse cached subscription status", e)
            null
        }
    }

    private fun saveStatus(status: SubscriptionStatusResponse) {
        _subscriptionStatus.value = status
        try {
            prefs.edit().putString(KEY_SUBSCRIPTION_STATUS, json.encodeToString(status)).apply()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to cache subscription status", e)
        }
    }

    fun clear() {
        _subscriptionStatus.value = null
        prefs.edit().remove(KEY_SUBSCRIPTION_STATUS).apply()
    }

    suspend fun refreshSubscriptionStatus(): ApiResult<SubscriptionStatusResponse>? {
        if (!authService.isLoggedIn) {
            clear()
            return null
        }
        _isRefreshing.value = true
        return try {
            val result = safeApiCall { api.getSubscriptionMe() }
            if (result is ApiResult.Success) {
                saveStatus(result.data)
            }
            result
        } finally {
            _isRefreshing.value = false
        }
    }

    /**
     * Google Play 구매 토큰을 서버로 전송해 검증 및 계정 반영을 요청한다.
     * 주의: purchaseToken은 절대 로그에 남기지 않는다.
     */
    suspend fun verifyPurchaseOnServer(
        productId: String = PRODUCT_ID,
        purchaseToken: String
    ): SubscriptionVerifyResult {
        if (!authService.isLoggedIn) {
            return SubscriptionVerifyResult.Error("로그인이 필요합니다.")
        }
        val result = safeApiCall {
            api.verifySubscription(
                SubscriptionVerifyRequest(
                    platform = "android",
                    productId = productId,
                    purchaseToken = purchaseToken
                )
            )
        }
        return when (result) {
            is ApiResult.Success -> {
                saveStatus(result.data)
                SubscriptionVerifyResult.Success(result.data)
            }
            is ApiResult.Error -> {
                when (result.code) {
                    409 -> SubscriptionVerifyResult.Conflict(
                        result.detailMessage ?: "이 구매는 다른 계정에 연결되어 있어요."
                    )
                    502, 503 -> SubscriptionVerifyResult.RetryLater(
                        "결제는 완료됐지만 확인이 지연되고 있어요. 잠시 후 자동으로 반영돼요."
                    )
                    400 -> SubscriptionVerifyResult.Invalid(
                        result.detailMessage ?: "유효하지 않은 구매 내역입니다."
                    )
                    else -> SubscriptionVerifyResult.Error(
                        result.detailMessage ?: "구독 확인 중 오류가 발생했습니다 (${result.code})."
                    )
                }
            }
            is ApiResult.NetworkError -> {
                SubscriptionVerifyResult.RetryLater(
                    "결제는 완료됐지만 확인이 지연되고 있어요. 잠시 후 자동으로 반영돼요."
                )
            }
        }
    }
}
