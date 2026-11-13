package com.dmonster.smap.ui.subscription

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.billing.BillingManager
import com.dmonster.smap.data.billing.BillingPurchaseState
import com.dmonster.smap.data.billing.SubscriptionOfferUiModel
import com.dmonster.smap.data.model.SubscriptionStatusResponse
import com.dmonster.smap.data.service.SubscriptionService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SubscriptionViewModel @Inject constructor(
    private val subscriptionService: SubscriptionService,
    private val billingManager: BillingManager
) : ViewModel() {

    val subscriptionStatus: StateFlow<SubscriptionStatusResponse?> = subscriptionService.subscriptionStatus
    val isRefreshingStatus: StateFlow<Boolean> = subscriptionService.isRefreshing

    val offers: StateFlow<List<SubscriptionOfferUiModel>> = billingManager.offers
    val isLoadingProducts: StateFlow<Boolean> = billingManager.isLoadingProducts
    val productLoadError: StateFlow<String?> = billingManager.productLoadError
    val purchaseState: StateFlow<BillingPurchaseState> = billingManager.purchaseState

    private val _selectedBasePlanId = MutableStateFlow(BillingManager.BASE_PLAN_YEARLY)
    val selectedBasePlanId: StateFlow<String> = _selectedBasePlanId.asStateFlow()

    fun onScreenEntered() {
        viewModelScope.launch {
            subscriptionService.refreshSubscriptionStatus()
        }
        viewModelScope.launch {
            billingManager.querySubscriptionProducts()
        }
        viewModelScope.launch {
            billingManager.reprocessPendingPurchases()
        }
    }

    fun retryLoadProducts() {
        viewModelScope.launch {
            billingManager.querySubscriptionProducts()
        }
    }

    fun selectPlan(basePlanId: String) {
        _selectedBasePlanId.value = basePlanId
    }

    fun startPurchase(activity: Activity) {
        val currentOffers = offers.value
        val target = currentOffers.firstOrNull { it.basePlanId == _selectedBasePlanId.value }
            ?: currentOffers.firstOrNull()
            ?: return
        billingManager.launchPurchaseFlow(activity, target)
    }

    fun restorePurchases() {
        viewModelScope.launch {
            billingManager.restorePurchases()
        }
    }

    fun clearPurchaseMessage() {
        billingManager.clearPurchaseState()
    }
}
