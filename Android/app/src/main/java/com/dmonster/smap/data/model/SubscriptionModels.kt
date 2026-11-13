package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * GET /api/v1/subscriptions/me 및 POST /api/v1/subscriptions/verify 응답 모델.
 * 계약 문서(.claude/plans/subscription_contract.md) 3.1절 기준.
 */
@Serializable
data class SubscriptionStatusResponse(
    @SerialName("is_premium") val isPremium: Boolean = false,
    @SerialName("plan") val plan: String? = null, // "month" | "year" | null
    @SerialName("platform") val platform: String? = null, // "ios" | "android" | "legacy" | null
    @SerialName("expires_at") val expiresAt: String? = null, // ISO 8601 UTC
    @SerialName("auto_renew") val autoRenew: Boolean? = null,
    @SerialName("in_grace_period") val inGracePeriod: Boolean = false,
    @SerialName("limits") val limits: SubscriptionLimits = SubscriptionLimits(),
    @SerialName("enforcement_enabled") val enforcementEnabled: Boolean = false
)

@Serializable
data class SubscriptionLimits(
    @SerialName("max_places") val maxPlaces: Int? = 2, // null이면 무제한, 무료는 2
    @SerialName("log_retention_days") val logRetentionDays: Int = 2 // 무료 2, 프리미엄 14
)

/**
 * POST /api/v1/subscriptions/verify Android 요청 모델.
 * 계약 문서 3.2절 기준.
 */
@Serializable
data class SubscriptionVerifyRequest(
    @SerialName("platform") val platform: String = "android",
    @SerialName("product_id") val productId: String,
    @SerialName("purchase_token") val purchaseToken: String
)

/**
 * FastAPI 403/400/409 등의 {"detail": ...} 오류 본문에서 추출한 구조화 오류.
 */
data class ParsedApiDetail(
    val code: String? = null,
    val message: String? = null
)

object SubscriptionErrorCodes {
    const val PLACE_LIMIT_EXCEEDED = "PLACE_LIMIT_EXCEEDED"
    const val LOG_RETENTION_EXCEEDED = "LOG_RETENTION_EXCEEDED"
}
