package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 화면 상태 3종(로딩 / 비어 있음 / 오류) 공용 뷰.
 *
 * 기존 화면은 조회 실패와 "데이터 없음"을 같은 빈 화면으로 보여줘서, 사용자가
 * 네트워크 문제인지 정말 기록이 없는지 구분할 수 없었다. 오류에는 항상 다시 시도 동작을 준다.
 */
@Composable
fun SmapLoadingState(modifier: Modifier = Modifier, message: String? = null) {
    Column(
        modifier = modifier.fillMaxSize().padding(SmapSpacing.lg),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        if (message != null) {
            Spacer(Modifier.height(SmapSpacing.md))
            Text(message, style = SmapText.secondary, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun SmapEmptyState(
    title: String,
    modifier: Modifier = Modifier,
    description: String? = null,
    icon: ImageVector = Icons.Outlined.Info,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
) {
    StateLayout(
        icon = icon,
        iconTint = MaterialTheme.colorScheme.onSurfaceVariant,
        title = title,
        description = description,
        actionText = actionText,
        onAction = onAction,
        modifier = modifier,
    )
}

@Composable
fun SmapErrorState(
    modifier: Modifier = Modifier,
    title: String = "불러오지 못했어요",
    description: String? = "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
    onRetry: (() -> Unit)? = null,
) {
    StateLayout(
        icon = Icons.Outlined.CloudOff,
        iconTint = MaterialTheme.colorScheme.error,
        title = title,
        description = description,
        actionText = if (onRetry != null) "다시 시도" else null,
        onAction = onRetry,
        modifier = modifier,
    )
}

@Composable
private fun StateLayout(
    icon: ImageVector,
    iconTint: androidx.compose.ui.graphics.Color,
    title: String,
    description: String?,
    actionText: String?,
    onAction: (() -> Unit)?,
    modifier: Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(SmapSpacing.xl),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(SmapSpacing.md))
        Text(title, style = SmapText.subheadline, color = MaterialTheme.colorScheme.onSurface, textAlign = TextAlign.Center)
        if (description != null) {
            Spacer(Modifier.height(SmapSpacing.sm))
            Text(
                description,
                style = SmapText.secondary,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
        if (actionText != null && onAction != null) {
            Spacer(Modifier.height(SmapSpacing.lg))
            SmapButton(
                text = actionText,
                onClick = onAction,
                style = SmapButtonStyle.Secondary,
                modifier = Modifier.widthIn(max = 200.dp),
            )
        }
    }
}

/** 인라인 안내 배너의 의미. 색과 아이콘을 함께 바꿔 색만으로 구분하지 않게 한다. */
enum class SmapBannerTone { Info, Success, Error }

/**
 * 화면 안에 고정으로 보여주는 안내 배너(폼 상단 오류, 인증 메일 발송 안내 등).
 * 잠깐 떴다 사라지는 스낵바와 달리, 사용자가 조치할 때까지 남아 있어야 하는 메시지에 쓴다.
 */
@Composable
fun SmapBanner(
    message: String,
    modifier: Modifier = Modifier,
    tone: SmapBannerTone = SmapBannerTone.Info,
) {
    val colors = MaterialTheme.colorScheme
    val (accent, icon) = when (tone) {
        SmapBannerTone.Info -> colors.primary to Icons.Outlined.Info
        SmapBannerTone.Success -> BrandColors.Success to Icons.Outlined.CheckCircle
        SmapBannerTone.Error -> colors.error to Icons.Outlined.ErrorOutline
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(accent.copy(alpha = 0.10f), RoundedCornerShape(SmapRadius.md))
            .padding(horizontal = SmapSpacing.md, vertical = 12.dp)
            // 오류·안내가 나타나면 화면 낭독기가 읽어 주도록 한다.
            .semantics { liveRegion = LiveRegionMode.Polite },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(SmapSpacing.sm))
        Text(message, style = SmapText.caption, color = colors.onSurface)
    }
}

/** 지도 등 콘텐츠 위에 덮는 로딩 표시. 실제 로딩 중일 때만 쓴다(인위적 지연 금지). */
@Composable
fun SmapLoadingOverlay(visible: Boolean, modifier: Modifier = Modifier) {
    if (!visible) return
    Box(
        modifier = modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface.copy(alpha = 0.6f)),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}
