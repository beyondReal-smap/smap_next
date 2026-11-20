package com.dmonster.smap.ui.subscription

import com.dmonster.smap.R
import com.dmonster.smap.ui.components.SmapFamilyCover
import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.data.billing.BillingManager
import com.dmonster.smap.data.billing.BillingPurchaseState
import com.dmonster.smap.data.billing.SubscriptionOfferUiModel
import com.dmonster.smap.data.model.SubscriptionStatusResponse
import com.dmonster.smap.ui.components.SmapBanner
import com.dmonster.smap.ui.components.SmapBannerTone
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapButtonStyle
import com.dmonster.smap.ui.components.SmapErrorState
import com.dmonster.smap.ui.components.SmapLoadingState
import com.dmonster.smap.ui.components.SmapTextButton
import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.ui.settings.PrivacyPolicyScreen
import com.dmonster.smap.ui.settings.ServiceTermsScreen
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSize
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun SubscriptionScreen(
    onBack: () -> Unit,
    viewModel: SubscriptionViewModel = hiltViewModel()
) {
    val status by viewModel.subscriptionStatus.collectAsState()
    val isRefreshingStatus by viewModel.isRefreshingStatus.collectAsState()
    val offers by viewModel.offers.collectAsState()
    val isLoadingProducts by viewModel.isLoadingProducts.collectAsState()
    val productLoadError by viewModel.productLoadError.collectAsState()
    val purchaseState by viewModel.purchaseState.collectAsState()
    val selectedBasePlanId by viewModel.selectedBasePlanId.collectAsState()

    var activeLegalScreen by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        viewModel.onScreenEntered()
    }

    val handleBack: () -> Unit = {
        if (activeLegalScreen != null) {
            activeLegalScreen = null
        } else {
            onBack()
        }
    }
    BackHandler(onBack = handleBack)

    when (activeLegalScreen) {
        "service" -> {
            ServiceTermsScreen(onBack = { activeLegalScreen = null })
            return
        }
        "privacy" -> {
            PrivacyPolicyScreen(onBack = { activeLegalScreen = null })
            return
        }
    }

    val context = LocalContext.current
    val activity = context as? Activity
    val colors = MaterialTheme.colorScheme

    Scaffold(
        containerColor = colors.surface,
        topBar = {
            SmapTopBar(title = "도착했어 프리미엄", onBack = onBack)
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = SmapSpacing.screenHorizontal, vertical = SmapSpacing.md),
            verticalArrangement = Arrangement.spacedBy(SmapSpacing.md)
        ) {
            SmapFamilyCover(image = R.drawable.login_arrival_cycling, minHeight = 154.dp) {
                Text("도착했어 프리미엄", style = SmapText.pageTitle)
                Text("소중한 사람들의 기록을 더 오래, 더 많이.", style = SmapText.secondary)
            }
            when (val pState = purchaseState) {
                is BillingPurchaseState.Success -> {
                    SmapBanner(message = pState.message, tone = SmapBannerTone.Success)
                }
                is BillingPurchaseState.Info -> {
                    SmapBanner(message = pState.message, tone = SmapBannerTone.Info)
                }
                is BillingPurchaseState.PendingPayment -> {
                    SmapBanner(
                        message = "결제가 대기 중이에요. 결제가 완료되면 자동으로 반영돼요.",
                        tone = SmapBannerTone.Info
                    )
                }
                is BillingPurchaseState.Error -> {
                    SmapBanner(message = pState.message, tone = SmapBannerTone.Error)
                }
                else -> Unit
            }

            if (status?.isPremium == true) {
                ActiveSubscriptionSection(
                    status = status!!,
                    onManageSubscription = {
                        val uri = Uri.parse(
                            "https://play.google.com/store/account/subscriptions?sku=${BillingManager.PRODUCT_ID}&package=${context.packageName}"
                        )
                        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                    }
                )
            } else {
                NonSubscriberSection(
                    offers = offers,
                    selectedBasePlanId = selectedBasePlanId,
                    isLoadingProducts = isLoadingProducts || (isRefreshingStatus && offers.isEmpty() && productLoadError == null),
                    productLoadError = productLoadError,
                    isPurchasing = purchaseState is BillingPurchaseState.Purchasing,
                    onSelectPlan = viewModel::selectPlan,
                    onRetryProducts = viewModel::retryLoadProducts,
                    onPurchaseClick = {
                        if (activity != null) {
                            viewModel.startPurchase(activity)
                        }
                    },
                    onRestoreClick = viewModel::restorePurchases,
                    onTermsClick = { activeLegalScreen = "service" },
                    onPrivacyClick = { activeLegalScreen = "privacy" }
                )
            }
        }
    }
}

@Composable
private fun ActiveSubscriptionSection(
    status: SubscriptionStatusResponse,
    onManageSubscription: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    val planLabel = when (status.plan) {
        "year" -> "연간 요금제"
        "month" -> "월간 요금제"
        else -> "프리미엄 이용권"
    }
    val formattedDate = remember(status.expiresAt) { formatExpiryDate(status.expiresAt) }
    val dateDescription = when {
        formattedDate == null -> null
        status.autoRenew == false -> "${formattedDate}에 종료 예정"
        else -> "다음 결제일: $formattedDate"
    }

    if (status.inGracePeriod) {
        SmapBanner(
            message = "결제 수단 확인이 필요해요. 결제 정보를 업데이트하지 않으면 곧 프리미엄 혜택이 종료돼요.",
            tone = SmapBannerTone.Error
        )
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(SmapRadius.lg),
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        border = BorderStroke(1.dp, colors.outline)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(SmapSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
            ) {
                Icon(
                    imageVector = Icons.Outlined.WorkspacePremium,
                    contentDescription = null,
                    tint = colors.primary,
                    modifier = Modifier.size(28.dp)
                )
                Text(
                    text = "프리미엄 이용 중",
                    style = SmapText.title,
                    color = colors.onSurface
                )
            }
            Text(
                text = planLabel,
                style = SmapText.subheadline,
                color = colors.primary
            )
            if (dateDescription != null) {
                Text(
                    text = dateDescription,
                    style = SmapText.secondary,
                    color = colors.onSurfaceVariant
                )
            }
        }
    }

    BenefitListCard()

    when (status.platform) {
        "ios" -> {
            SmapBanner(
                message = "이 구독은 App Store에서 결제됐어요. 변경·해지는 해당 스토어에서 할 수 있어요.",
                tone = SmapBannerTone.Info
            )
        }
        "legacy" -> {
            SmapBanner(
                message = "기존 프리미엄 이용권이 적용 중이에요.",
                tone = SmapBannerTone.Info
            )
        }
        else -> {
            SmapButton(
                text = "구독 관리",
                onClick = onManageSubscription,
                style = SmapButtonStyle.Secondary
            )
        }
    }
}

@Composable
private fun NonSubscriberSection(
    offers: List<SubscriptionOfferUiModel>,
    selectedBasePlanId: String,
    isLoadingProducts: Boolean,
    productLoadError: String?,
    isPurchasing: Boolean,
    onSelectPlan: (String) -> Unit,
    onRetryProducts: () -> Unit,
    onPurchaseClick: () -> Unit,
    onRestoreClick: () -> Unit,
    onTermsClick: () -> Unit,
    onPrivacyClick: () -> Unit
) {
    val colors = MaterialTheme.colorScheme

    BenefitListCard()

    when {
        isLoadingProducts -> {
            BoxLoadingPlaceholder()
        }
        productLoadError != null -> {
            SmapErrorState(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 200.dp),
                title = productLoadError,
                description = "스토어 정보를 가져올 수 없어요.",
                onRetry = onRetryProducts
            )
        }
        else -> {
            val selectedOffer = offers.firstOrNull { it.basePlanId == selectedBasePlanId } ?: offers.firstOrNull()

            Column(verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)) {
                offers.forEach { offer ->
                    PlanOptionCard(
                        offer = offer,
                        isSelected = selectedOffer?.basePlanId == offer.basePlanId,
                        onClick = { onSelectPlan(offer.basePlanId) }
                    )
                }
            }

            Spacer(Modifier.height(SmapSpacing.xs))

            val buttonLabel = if (selectedOffer?.freeTrialText != null) {
                "무료 체험 시작하기"
            } else {
                "구독 시작하기"
            }
            SmapButton(
                text = buttonLabel,
                onClick = onPurchaseClick,
                enabled = selectedOffer != null,
                isLoading = isPurchasing
            )
        }
    }

    Text(
        text = "구독은 현재 이용 기간이 끝나기 최소 24시간 전에 해지하지 않으면 자동으로 갱신되며, Google Play 계정 설정에서 언제든 해지할 수 있어요.",
        style = SmapText.captionSmall,
        color = colors.onSurfaceVariant
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        SmapTextButton(text = "이용약관", onClick = onTermsClick)
        SmapTextButton(text = "개인정보 처리방침", onClick = onPrivacyClick)
        SmapTextButton(text = "구매 복원", onClick = onRestoreClick)
    }
}

@Composable
private fun BoxLoadingPlaceholder() {
    SmapLoadingState(
        modifier = Modifier
            .fillMaxWidth()
            .height(160.dp),
        message = "요금제를 불러오는 중..."
    )
}

@Composable
private fun BenefitListCard() {
    val colors = MaterialTheme.colorScheme
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(SmapRadius.lg),
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        border = BorderStroke(1.dp, colors.outline)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(SmapSpacing.md),
            verticalArrangement = Arrangement.spacedBy(SmapSpacing.md)
        ) {
            BenefitRow(
                icon = Icons.Outlined.Place,
                title = "내 장소 무제한 등록",
                subtitle = "무료는 2개"
            )
            BenefitRow(
                icon = Icons.Outlined.History,
                title = "활동 기록 14일 보기",
                subtitle = "무료는 2일"
            )
        }
    }
}

@Composable
private fun BenefitRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String
) {
    val colors = MaterialTheme.colorScheme
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = colors.primary,
            modifier = Modifier.size(24.dp)
        )
        Column {
            Text(text = title, style = SmapText.bodyBold, color = colors.onSurface)
            Text(text = subtitle, style = SmapText.caption, color = colors.onSurfaceVariant)
        }
    }
}

@Composable
private fun PlanOptionCard(
    offer: SubscriptionOfferUiModel,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    val isYearly = offer.basePlanId == BillingManager.BASE_PLAN_YEARLY
    val planTitle = if (isYearly) "연간" else "월간"
    val priceDisplay = if (offer.freeTrialText != null) {
        "${offer.freeTrialText} 후 ${offer.formattedPrice}"
    } else {
        offer.formattedPrice
    }
    val accessibilityText = buildString {
        append(planTitle)
        append(", ")
        append(priceDisplay)
        if (offer.monthlyEquivalentPrice != null) {
            append(", ")
            append(offer.monthlyEquivalentPrice)
        }
        append(if (isSelected) ", 선택됨" else ", 선택 안 됨")
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = SmapSize.minTouchTarget)
            .clickable(role = Role.RadioButton, onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = accessibilityText
            },
        shape = RoundedCornerShape(SmapRadius.lg),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) colors.primaryContainer.copy(alpha = 0.25f) else colors.surface
        ),
        border = BorderStroke(
            width = if (isSelected) 2.dp else 1.dp,
            color = if (isSelected) colors.primary else colors.outline
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(SmapSpacing.md),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = if (isSelected) Icons.Filled.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                    contentDescription = null,
                    tint = if (isSelected) colors.primary else colors.onSurfaceVariant,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(Modifier.width(SmapSpacing.sm))
                Column(verticalArrangement = Arrangement.spacedBy(SmapSpacing.xs)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
                    ) {
                        Text(
                            text = planTitle,
                            style = SmapText.subheadline,
                            color = colors.onSurface
                        )
                        if (isYearly) {
                            Surface(
                                color = colors.primary,
                                shape = RoundedCornerShape(SmapRadius.sm)
                            ) {
                                Text(
                                    text = "추천",
                                    style = SmapText.captionSmall,
                                    color = colors.onPrimary,
                                    modifier = Modifier.padding(horizontal = SmapSpacing.sm, vertical = 2.dp)
                                )
                            }
                        }
                    }
                    Text(
                        text = priceDisplay,
                        style = SmapText.bodyBold,
                        color = colors.onSurface
                    )
                    if (offer.monthlyEquivalentPrice != null) {
                        Text(
                            text = offer.monthlyEquivalentPrice,
                            style = SmapText.caption,
                            color = colors.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

private fun formatExpiryDate(isoUtc: String?): String? {
    if (isoUtc.isNullOrBlank()) return null
    return try {
        val instant = Instant.parse(isoUtc)
        val localDate = instant.atZone(ZoneId.systemDefault()).toLocalDate()
        localDate.format(DateTimeFormatter.ofPattern("yyyy.MM.dd"))
    } catch (_: Exception) {
        null
    }
}
