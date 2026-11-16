package com.dmonster.smap.data.billing

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/*
 * billing-ktx 대신 쓰는 코루틴 래퍼.
 * Play 정책상 결제 라이브러리 8.0.0 이상이 필요한데, billing-ktx 8.x 는 Kotlin 2.1 로 빌드돼
 * 이 프로젝트(Kotlin 1.9)에서 읽히지 않는다. 그래서 자바 라이브러리(billing)의 콜백 API 를 직접 감싼다.
 */

internal class ProductDetailsQuery(
    val billingResult: BillingResult,
    val productDetailsList: List<ProductDetails>,
)

internal class PurchasesQuery(
    val billingResult: BillingResult,
    val purchasesList: List<Purchase>,
)

internal suspend fun BillingClient.awaitProductDetails(params: QueryProductDetailsParams): ProductDetailsQuery =
    suspendCancellableCoroutine { cont ->
        queryProductDetailsAsync(params) { billingResult, result ->
            if (cont.isActive) cont.resume(ProductDetailsQuery(billingResult, result.productDetailsList))
        }
    }

internal suspend fun BillingClient.awaitPurchases(params: QueryPurchasesParams): PurchasesQuery =
    suspendCancellableCoroutine { cont ->
        queryPurchasesAsync(params) { billingResult, purchases ->
            if (cont.isActive) cont.resume(PurchasesQuery(billingResult, purchases))
        }
    }
