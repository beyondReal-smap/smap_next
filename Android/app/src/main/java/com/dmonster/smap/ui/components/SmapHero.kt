package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/*
 * 남색 강조 — 36단계 재설계가 "회색 바탕 + 흰 행"만 남아 밋밋하다는 피드백(2026-11-16)에 따라
 * 화면마다 시각적 중심을 하나 둔다. 색은 브랜드 남색 계열만 쓴다(다색 팔레트는 고르지 않음).
 */

/** 브랜드 남색 그라데이션 — 요약 카드·강조 아이콘·선택 상태 공용. 짙은 남색 → 브랜드 → 밝은 남색. */
object SmapBrush {
    val NavyDeep = Color(0xFF000C78)
    val Navy = Color(0xFF0113A3)
    val NavyBright = Color(0xFF3D55EA)

    val navy: Brush = Brush.linearGradient(listOf(NavyDeep, Navy, NavyBright))
}

/** 남색 카드 위 흰 글자 단계 */
private val HeroMuted = Color.White.copy(alpha = 0.72f)

/**
 * 남색 그라데이션 요약 카드 — 탭 맨 위·상세 화면 맨 위의 시각적 중심.
 * 오른쪽 위에 옅은 원 두 개를 깔아 평면 그라데이션보다 깊이감을 준다. 안의 기본 글자색은 흰색.
 */
@Composable
fun SmapHeroCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(20.dp)
    Box(
        modifier
            .fillMaxWidth()
            .shadow(10.dp, shape, ambientColor = SmapBrush.Navy, spotColor = SmapBrush.Navy)
            .clip(shape)
            .background(SmapBrush.navy)
            .drawBehind {
                drawCircle(Color.White.copy(alpha = 0.08f), radius = size.width * 0.42f, center = Offset(size.width * 0.98f, -size.height * 0.05f))
                drawCircle(Color.White.copy(alpha = 0.06f), radius = size.width * 0.22f, center = Offset(size.width * 0.80f, size.height * 1.02f))
            },
    ) {
        CompositionLocalProvider(LocalContentColor provides Color.White) {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 20.dp), content = content)
        }
    }
}

/** 요약 카드 머리 — 작은 안내 줄 + 큰 제목. */
@Composable
fun HeroHeading(eyebrow: String?, title: String, subtitle: String? = null) {
    if (eyebrow != null) {
        Text(eyebrow, style = SmapText.captionMedium, color = HeroMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(4.dp))
    }
    Text(
        title,
        style = SmapText.title,
        color = Color.White,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.semantics { heading() },
    )
    if (!subtitle.isNullOrBlank()) {
        Spacer(Modifier.height(4.dp))
        Text(subtitle, style = SmapText.caption, color = HeroMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/** 요약 카드 아래쪽 숫자 칸들 — 값(굵게) + 이름, 칸 사이 옅은 세로선. */
@Composable
fun HeroStats(stats: List<Pair<String, String>>, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(top = SmapSpacing.md)
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.10f))
            .height(IntrinsicSize.Min)
            .padding(vertical = 12.dp),
    ) {
        stats.forEachIndexed { i, (value, label) ->
            if (i > 0) {
                Box(
                    Modifier
                        .width(1.dp)
                        .fillMaxHeight()
                        .padding(vertical = 4.dp)
                        .background(Color.White.copy(alpha = 0.18f))
                )
            }
            Column(
                Modifier
                    .weight(1f)
                    .semantics(mergeDescendants = true) {},
                horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
            ) {
                Text(value, style = SmapText.headline, color = Color.White, maxLines = 1)
                Text(label, style = SmapText.captionSmall, color = HeroMuted, maxLines = 1)
            }
        }
    }
}

/** 남색 그라데이션 원형 버튼 — 탭 맨 위 "추가"처럼 그 화면의 주 동작. */
@Composable
fun SmapGradientIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .size(44.dp)
            .shadow(6.dp, androidx.compose.foundation.shape.CircleShape, ambientColor = SmapBrush.Navy, spotColor = SmapBrush.Navy)
            .clip(androidx.compose.foundation.shape.CircleShape)
            .background(SmapBrush.navy)
            .clickable(onClickLabel = contentDescription, role = androidx.compose.ui.semantics.Role.Button, onClick = onClick)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = androidx.compose.ui.Alignment.Center,
    ) {
        androidx.compose.material3.Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
    }
}
