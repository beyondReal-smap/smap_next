package com.dmonster.smap.data.billing

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.SubscriptionPolicy
import com.dmonster.smap.data.service.SubscriptionService
import com.dmonster.smap.data.service.SubscriptionVerifyResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import kotlin.coroutines.resume

data class SubscriptionOfferUiModel(
    val basePlanId: String,
    val offerToken: String,
    val formattedPrice: String,
    val billingPeriod: String,
    val freeTrialText: String? = null,
    val monthlyEquivalentPrice: String? = null,
    val productDetails: ProductDetails
)

sealed class BillingPurchaseState {
    data object Idle : BillingPurchaseState()
    data object Purchasing : BillingPurchaseState()
    data object PendingPayment : BillingPurchaseState()
    data class Success(val message: String) : BillingPurchaseState()
    data class Info(val message: String) : BillingPurchaseState()
    data class Error(val message: String) : BillingPurchaseState()
}

/**
 * 앱 전역 Google Play BillingClient 래퍼 (Hilt @Singleton).
 * - 연결 끊김 시 재연결
 * - 구독 상품 조회 (smap_premium, monthly / yearly)
 * - 구매 흐름 실행
 * - 미완료 구매 재처리 및 구매 복원
 *
 * 중요: 구매 확인(acknowledgePurchase)은 백엔드가 수행하므로 앱에서 호출하지 않는다.
 * 중요: purchaseToken은 절대 로그에 남기지 않는다.
 */
class BillingManager(
    context: Context,
    private val subscriptionService: SubscriptionService,
    private val authService: AuthService
) : PurchasesUpdatedListener {

    companion object {
        private const val TAG = "BillingManager"
        const val PRODUCT_ID = "smap_premium"
        const val BASE_PLAN_MONTHLY = "monthly"
        const val BASE_PLAN_YEARLY = "yearly"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val accountTokenResolver = PurchaseAccountTokenResolver(
        currentMemberId = { authService.getMtIdx() },
        fetchStatus = { subscriptionService.refreshSubscriptionStatus() }
    )
    private val connectionMutex = Mutex()
    private val reprocessMutex = Mutex()

    private val billingClient: BillingClient = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build()
        )
        .build()

    init {
        scope.launch {
            GlobalEventBus.events.collect { event ->
                if (event is GlobalEvent.LoggedOut) accountTokenResolver.invalidate()
            }
        }
    }

    private val _offers = MutableStateFlow<List<SubscriptionOfferUiModel>>(emptyList())
    val offers: StateFlow<List<SubscriptionOfferUiModel>> = _offers.asStateFlow()

    private val _isLoadingProducts = MutableStateFlow(false)
    val isLoadingProducts: StateFlow<Boolean> = _isLoadingProducts.asStateFlow()

    private val _productLoadError = MutableStateFlow<String?>(null)
    val productLoadError: StateFlow<String?> = _productLoadError.asStateFlow()

    private val _purchaseState = MutableStateFlow<BillingPurchaseState>(BillingPurchaseState.Idle)
    val purchaseState: StateFlow<BillingPurchaseState> = _purchaseState.asStateFlow()

    fun clearPurchaseState() {
        _purchaseState.value = BillingPurchaseState.Idle
    }

    private suspend fun ensureConnected(): Boolean = connectionMutex.withLock {
        if (billingClient.isReady) return true
        return suspendCancellableCoroutine { cont ->
            billingClient.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(billingResult: BillingResult) {
                    if (cont.isActive) {
                        cont.resume(billingResult.responseCode == BillingClient.BillingResponseCode.OK)
                    }
                }

                override fun onBillingServiceDisconnected() {
                    Log.w(TAG, "Billing service disconnected")
                    if (cont.isActive) {
                        cont.resume(false)
                    }
                }
            })
        }
    }

    suspend fun querySubscriptionProducts(): Boolean {
        _isLoadingProducts.value = true
        _productLoadError.value = null
        return try {
            if (!ensureConnected()) {
                _productLoadError.value = "요금제를 불러오지 못했어요."
                return false
            }

            val productList = listOf(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(PRODUCT_ID)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
            )
            val params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build()

            val result = billingClient.awaitProductDetails(params)
            if (result.billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                Log.w(TAG, "queryProductDetails failed: code=${result.billingResult.responseCode}")
                _productLoadError.value = "요금제를 불러오지 못했어요."
                return false
            }

            val details = result.productDetailsList.firstOrNull { it.productId == PRODUCT_ID }
            if (details == null) {
                _offers.value = emptyList()
                _productLoadError.value = "요금제를 불러오지 못했어요."
                return false
            }

            val parsedOffers = parseOffers(details)
            if (parsedOffers.isEmpty()) {
                _offers.value = emptyList()
                _productLoadError.value = "요금제를 불러오지 못했어요."
                false
            } else {
                _offers.value = parsedOffers
                true
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to query subscription products", e)
            _productLoadError.value = "요금제를 불러오지 못했어요."
            false
        } finally {
            _isLoadingProducts.value = false
        }
    }

    private fun parseOffers(details: ProductDetails): List<SubscriptionOfferUiModel> {
        val offerDetailsList = details.subscriptionOfferDetails ?: return emptyList()
        val byBasePlan = offerDetailsList.groupBy { it.basePlanId }

        val targetPlans = listOf(BASE_PLAN_YEARLY, BASE_PLAN_MONTHLY)
        val result = mutableListOf<SubscriptionOfferUiModel>()

        for (basePlanId in targetPlans) {
            val candidates = byBasePlan[basePlanId].orEmpty()
            if (candidates.isEmpty()) continue

            // 무료 체험(priceAmountMicros == 0)이 포함된 오퍼를 우선 선택한다.
            val selectedOffer = candidates.firstOrNull { offer ->
                offer.pricingPhases.pricingPhaseList.any { it.priceAmountMicros == 0L }
            } ?: candidates.first()

            val phases = selectedOffer.pricingPhases.pricingPhaseList
            val freeTrialPhase = phases.firstOrNull { it.priceAmountMicros == 0L }
            val recurringPhase = phases.lastOrNull { it.priceAmountMicros > 0L } ?: phases.lastOrNull() ?: continue

            val freeTrialText = freeTrialPhase?.billingPeriod?.let { formatTrialPeriod(it) }
            val monthlyEquivalent = if (basePlanId == BASE_PLAN_YEARLY) {
                formatMonthlyEquivalent(recurringPhase.priceAmountMicros, recurringPhase.priceCurrencyCode)
            } else {
                null
            }

            result.add(
                SubscriptionOfferUiModel(
                    basePlanId = basePlanId,
                    offerToken = selectedOffer.offerToken,
                    formattedPrice = recurringPhase.formattedPrice,
                    billingPeriod = recurringPhase.billingPeriod,
                    freeTrialText = freeTrialText,
                    monthlyEquivalentPrice = monthlyEquivalent,
                    productDetails = details
                )
            )
        }
        return result
    }

    private fun formatTrialPeriod(isoPeriod: String): String {
        val match = Regex("^P(\\d+)([DWMY])$").matchEntire(isoPeriod)
        if (match == null) return "무료 체험"
        val count = match.groupValues[1].toIntOrNull() ?: return "무료 체험"
        return when (match.groupValues[2]) {
            "D" -> "${count}일 무료 체험"
            "W" -> "${count}주 무료 체험"
            "M" -> "${count}개월 무료 체험"
            "Y" -> "${count}년 무료 체험"
            else -> "무료 체험"
        }
    }

    private fun formatMonthlyEquivalent(yearlyMicros: Long, currencyCode: String): String? {
        return try {
            val monthlyValue = (yearlyMicros / 12.0) / 1_000_000.0
            val formatter = NumberFormat.getCurrencyInstance(Locale.getDefault())
            formatter.currency = Currency.getInstance(currencyCode)
            if (currencyCode == "KRW" || currencyCode == "JPY") {
                formatter.maximumFractionDigits = 0
            }
            "월 약 ${formatter.format(monthlyValue)}"
        } catch (_: Exception) {
            null
        }
    }

    fun launchPurchaseFlow(activity: Activity, offer: SubscriptionOfferUiModel) {
        scope.launch(Dispatchers.Main) {
            if (!ensureConnected()) {
                _purchaseState.value = BillingPurchaseState.Error("스토어에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.")
                return@launch
            }
            _purchaseState.value = BillingPurchaseState.Purchasing
            // 구매를 현재 회원 계정에 묶기 위한 토큰. 조회 실패 시 토큰 없이 진행하지 않는다.
            val accountToken = when (val resolved = accountTokenResolver.resolve()) {
                is AccountTokenResult.Token -> resolved.value
                is AccountTokenResult.None -> null
                is AccountTokenResult.Failure -> {
                    _purchaseState.value = BillingPurchaseState.Error(resolved.message)
                    return@launch
                }
            }
            val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(offer.productDetails)
                .setOfferToken(offer.offerToken)
                .build()
            val billingFlowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(listOf(productDetailsParams))
                .apply { if (accountToken != null) setObfuscatedAccountId(accountToken) }
                .build()

            val launchResult = billingClient.launchBillingFlow(activity, billingFlowParams)
            if (launchResult.responseCode != BillingClient.BillingResponseCode.OK) {
                if (launchResult.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
                    _purchaseState.value = BillingPurchaseState.Idle
                } else {
                    Log.w(TAG, "launchBillingFlow failed: code=${launchResult.responseCode}")
                    _purchaseState.value = BillingPurchaseState.Error("결제를 시작하지 못했어요. 다시 시도해 주세요.")
                }
            }
        }
    }

    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: MutableList<Purchase>?) {
        when (billingResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                if (purchases.isNullOrEmpty()) {
                    _purchaseState.value = BillingPurchaseState.Idle
                    return
                }
                scope.launch {
                    handleUpdatedPurchases(purchases)
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                // 계약 5절: 사용자가 결제를 취소하면 아무 것도 표시하지 않는다.
                _purchaseState.value = BillingPurchaseState.Idle
            }
            else -> {
                Log.w(TAG, "onPurchasesUpdated error: code=${billingResult.responseCode}")
                _purchaseState.value = BillingPurchaseState.Error("결제를 완료하지 못했어요. 다시 시도해 주세요.")
            }
        }
    }

    private suspend fun handleUpdatedPurchases(purchases: List<Purchase>) {
        for (purchase in purchases) {
            when (purchase.purchaseState) {
                Purchase.PurchaseState.PENDING -> {
                    // 지시서 4번: 결제 대기(PENDING) 상태의 구매는 완료로 취급하지 않는다.
                    _purchaseState.value = BillingPurchaseState.PendingPayment
                }
                Purchase.PurchaseState.PURCHASED -> {
                    if (!authService.isLoggedIn) {
                        // 로그인하지 않은 상태에서는 서버에 보내지 않고 로그인 후로 미룬다.
                        _purchaseState.value = BillingPurchaseState.Idle
                        continue
                    }
                    // 서버가 acknowledge를 수행하므로 앱에서는 acknowledgePurchase를 호출하지 않고 검증 API만 호출한다.
                    when (val verify = subscriptionService.verifyPurchaseOnServer(PRODUCT_ID, purchase.purchaseToken)) {
                        is SubscriptionVerifyResult.Success -> {
                            _purchaseState.value = BillingPurchaseState.Success("프리미엄 구독이 시작되었어요.")
                        }
                        is SubscriptionVerifyResult.Conflict -> {
                            _purchaseState.value = BillingPurchaseState.Error(verify.message)
                        }
                        is SubscriptionVerifyResult.RetryLater -> {
                            _purchaseState.value = BillingPurchaseState.Info(verify.message)
                        }
                        is SubscriptionVerifyResult.Invalid -> {
                            _purchaseState.value = BillingPurchaseState.Error(verify.message)
                        }
                        is SubscriptionVerifyResult.Error -> {
                            _purchaseState.value = BillingPurchaseState.Error(verify.message)
                        }
                    }
                }
                else -> Unit
            }
        }
    }

    /**
     * 앱 시작 시 / 화면 복귀 시 / 로그인 직후 호출:
     * 아직 서버에 반영되지 않은(미확인) PURCHASED 구독을 찾아 서버 검증에 보낸다.
     */
    suspend fun reprocessPendingPurchases() = reprocessMutex.withLock {
        if (!authService.isLoggedIn) return@withLock
        if (!ensureConnected()) return@withLock

        val purchasesResult = billingClient.awaitPurchases(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        )
        if (purchasesResult.billingResult.responseCode != BillingClient.BillingResponseCode.OK) return@withLock

        val targetPurchases = purchasesResult.purchasesList.filter { purchase ->
            SubscriptionPolicy.shouldReprocessPurchase(
                isLoggedIn = authService.isLoggedIn,
                isPurchasedState = purchase.purchaseState == Purchase.PurchaseState.PURCHASED,
                isAcknowledged = purchase.isAcknowledged,
                matchesProduct = purchase.products.contains(PRODUCT_ID)
            )
        }

        for (purchase in targetPurchases) {
            subscriptionService.verifyPurchaseOnServer(PRODUCT_ID, purchase.purchaseToken)
        }
    }

    /**
     * 사용자가 "구매 복원" 버튼을 눌렀을 때 호출.
     * 보유 구독을 조회해 서버 검증에 보낸다.
     */
    suspend fun restorePurchases() {
        if (!authService.isLoggedIn) {
            _purchaseState.value = BillingPurchaseState.Error("로그인이 필요합니다.")
            return
        }
        _purchaseState.value = BillingPurchaseState.Purchasing
        if (!ensureConnected()) {
            _purchaseState.value = BillingPurchaseState.Error("스토어에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.")
            return
        }

        val purchasesResult = billingClient.awaitPurchases(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        )
        if (purchasesResult.billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
            _purchaseState.value = BillingPurchaseState.Error("구독 내역을 확인하지 못했어요.")
            return
        }

        val purchasedSubs = purchasesResult.purchasesList.filter { purchase ->
            purchase.purchaseState == Purchase.PurchaseState.PURCHASED &&
                purchase.products.contains(PRODUCT_ID)
        }

        if (purchasedSubs.isEmpty()) {
            _purchaseState.value = BillingPurchaseState.Info("복원할 구독이 없어요.")
            return
        }

        var restoredAny = false
        var latestError: String? = null
        var retryLaterMsg: String? = null

        for (purchase in purchasedSubs) {
            when (val verify = subscriptionService.verifyPurchaseOnServer(PRODUCT_ID, purchase.purchaseToken)) {
                is SubscriptionVerifyResult.Success -> restoredAny = true
                is SubscriptionVerifyResult.Conflict -> latestError = verify.message
                is SubscriptionVerifyResult.RetryLater -> retryLaterMsg = verify.message
                is SubscriptionVerifyResult.Invalid -> latestError = verify.message
                is SubscriptionVerifyResult.Error -> latestError = verify.message
            }
        }

        _purchaseState.value = when {
            restoredAny -> BillingPurchaseState.Success("구독을 복원했어요.")
            latestError != null -> BillingPurchaseState.Error(latestError)
            retryLaterMsg != null -> BillingPurchaseState.Info(retryLaterMsg)
            else -> BillingPurchaseState.Info("복원할 구독이 없어요.")
        }
    }
}
