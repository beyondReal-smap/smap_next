package com.dmonster.smap.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSize
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.theme.SmapTextStyle

/** 버튼의 시각적 위계. 한 화면에 Primary 는 하나만 둔다. */
/** Neutral: 회색 바탕 — 확인창의 "취소"처럼 주 동작 옆에 같은 크기로 놓는 보조 동작. */
enum class SmapButtonStyle { Primary, Secondary, Destructive, Neutral }

/**
 * 앱 공용 버튼.
 *
 * 화면마다 Button 을 따로 꾸미면서 높이·모서리·로딩 표시가 제각각이던 것을 하나로 모은다.
 * [isLoading] 이면 클릭을 막고 스피너를 보여 중복 요청을 방지한다.
 */
@Composable
fun SmapButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: SmapButtonStyle = SmapButtonStyle.Primary,
    enabled: Boolean = true,
    isLoading: Boolean = false,
    leadingIcon: ImageVector? = null,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(SmapRadius.md)
    val clickable = enabled && !isLoading
    val buttonModifier = modifier
        .fillMaxWidth()
        .height(SmapSize.buttonHeight)
        .semantics { if (isLoading) contentDescription = "$text, 처리 중" }

    val content: @Composable () -> Unit = {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = when (style) {
                        SmapButtonStyle.Secondary -> colors.primary
                        SmapButtonStyle.Neutral -> colors.onSurface
                        else -> colors.onPrimary
                    },
                )
                Spacer(Modifier.width(8.dp))
            } else if (leadingIcon != null) {
                Icon(leadingIcon, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(text, style = SmapTextStyle.buttonPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }

    when (style) {
        SmapButtonStyle.Primary, SmapButtonStyle.Destructive -> {
            val container = if (style == SmapButtonStyle.Destructive) colors.error else colors.primary
            val onContainer = if (style == SmapButtonStyle.Destructive) colors.onError else colors.onPrimary
            // 주 동작 버튼은 남색 그라데이션으로 채워 화면에서 가장 먼저 눈에 들어오게 한다(평면 남색은 밋밋했다).
            // 비활성(enabled=false)일 때는 그라데이션을 빼고 회색으로 둔다. 로딩 중에는 그대로 유지.
            val gradient = style == SmapButtonStyle.Primary && enabled
            Button(
                onClick = onClick,
                modifier = if (gradient) buttonModifier.clip(shape).background(SmapBrush.accent) else buttonModifier,
                enabled = clickable,
                shape = shape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (gradient) Color.Transparent else container,
                    contentColor = onContainer,
                    // 로딩 중에는 색을 유지해 "눌렸다"는 것이 보이게 하고, 비활성일 때만 흐리게 한다.
                    disabledContainerColor = when {
                        gradient -> Color.Transparent
                        isLoading -> container
                        else -> colors.onSurface.copy(alpha = 0.12f)
                    },
                    disabledContentColor = if (isLoading) onContainer else colors.onSurface.copy(alpha = 0.38f),
                ),
                contentPadding = PaddingValues(horizontal = 16.dp),
            ) { content() }
        }
        SmapButtonStyle.Neutral -> {
            Button(
                onClick = onClick,
                modifier = buttonModifier,
                enabled = clickable,
                shape = shape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.surfaceVariant,
                    contentColor = colors.onSurface,
                    disabledContainerColor = colors.surfaceVariant,
                    disabledContentColor = colors.onSurface.copy(alpha = 0.38f),
                ),
                elevation = null,
                contentPadding = PaddingValues(horizontal = 16.dp),
            ) { content() }
        }
        SmapButtonStyle.Secondary -> {
            OutlinedButton(
                onClick = onClick,
                modifier = buttonModifier,
                enabled = clickable,
                shape = shape,
                border = BorderStroke(1.dp, if (enabled) colors.primary else colors.outline),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.primary),
                contentPadding = PaddingValues(horizontal = 16.dp),
            ) { content() }
        }
    }
}

/**
 * 본문 속 보조 동작용 텍스트 버튼("비밀번호 찾기", "재발송" 등).
 * 글자만 클릭 영역이면 터치 타깃이 작아지므로 최소 48dp 를 보장한다.
 */
@Composable
fun SmapTextButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    TextButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.defaultMinSize(minWidth = SmapSize.minTouchTarget, minHeight = SmapSize.minTouchTarget),
    ) {
        Text(text, style = SmapText.secondaryMedium)
    }
}
