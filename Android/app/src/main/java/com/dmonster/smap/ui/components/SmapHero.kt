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
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.material3.MaterialTheme
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
 * 메뉴별 강조색 — 36단계 재설계가 "회색 바탕 + 흰 행"만 남아 밋밋하다는 피드백(2026-11-16)에 따라
 * 화면마다 그라데이션 시각적 중심을 하나 둔다. 처음엔 남색 하나만 썼는데 모든 메뉴가 "파랑파랑"해
 * 단조롭다는 피드백(2026-11-16)에 따라 메뉴마다 색을 나눴다(iOS SMAPAccent 와 같은 값).
 * 홈·설정 남색 / 그룹 청록 / 일정 주황 / 내장소 보라 / 활동 로그 장미.
 */

/** 메뉴 강조색 한 벌 — 짙은 색 → 기준 색 → 밝은 색 그라데이션 + 옅은 바탕(아이콘 원·칩). */
@Immutable
data class SmapAccent(val deep: Color, val base: Color, val bright: Color, val container: Color) {
    /** 요약 카드·강조 아이콘·선택 상태 */
    val brush: Brush = Brush.linearGradient(listOf(deep, base, bright))

    /** 가로 방향만 변하는 그라데이션 — 시트 손잡이 띠와 머리 줄처럼 위아래로 붙는 두 칸이 한 띠로 이어 보이게. */
    val band: Brush = Brush.horizontalGradient(listOf(deep, base, bright))

    companion object {
        val Navy = SmapAccent(Color(0xFF000C78), Color(0xFF0113A3), Color(0xFF3D55EA), Color(0xFFE8EBFB))
        val Teal = SmapAccent(Color(0xFF0B4F4A), Color(0xFF0F766E), Color(0xFF0D9488), Color(0xFFE1F3F1))
        val Orange = SmapAccent(Color(0xFF9A3412), Color(0xFFC2410C), Color(0xFFEA580C), Color(0xFFFCEBDD))
        val Purple = SmapAccent(Color(0xFF4C1D95), Color(0xFF6D28D9), Color(0xFF8B5CF6), Color(0xFFEEE8FD))
        val Rose = SmapAccent(Color(0xFF9F1239), Color(0xFFBE185D), Color(0xFFDB2777), Color(0xFFFBE6EF))

        /** 하단 탭 순서(홈·그룹·일정·내장소·활동 로그)별 색 */
        fun forTab(index: Int): SmapAccent = when (index) {
            1 -> Teal
            2 -> Orange
            3 -> Purple
            4 -> Rose
            else -> Navy
        }
    }
}

/** 지금 메뉴의 강조색. 기본은 브랜드 남색(홈·설정). */
val LocalSmapAccent = staticCompositionLocalOf { SmapAccent.Navy }

/**
 * [accent] 를 이 아래 화면 전체의 강조색으로 쓴다 — 요약 카드·아이콘 원·버튼(SmapBrush)뿐 아니라
 * colorScheme.primary/primaryContainer 도 바꿔 입력창 테두리·글자 버튼·행 아이콘까지 같은 색이 되게 한다.
 */
@Composable
fun SmapAccentTheme(accent: SmapAccent, content: @Composable () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    MaterialTheme(
        colorScheme = scheme.copy(primary = accent.base, primaryContainer = accent.container, onPrimaryContainer = accent.deep),
        typography = MaterialTheme.typography,
        shapes = MaterialTheme.shapes,
    ) {
        CompositionLocalProvider(LocalSmapAccent provides accent, content = content)
    }
}

/** 지금 메뉴 강조색의 그라데이션 — 요약 카드·강조 아이콘·선택 상태 공용. */
object SmapBrush {
    val accent: Brush
        @Composable @ReadOnlyComposable get() = LocalSmapAccent.current.brush

    /** 가로 방향만 변하는 그라데이션 — 시트 손잡이 띠와 머리 줄처럼 위아래로 붙는 두 칸이 한 띠로 이어 보이게. */
    val accentBand: Brush
        @Composable @ReadOnlyComposable get() = LocalSmapAccent.current.band

    /** 강조색 기준 색(그림자·선택 글자) */
    val Accent: Color
        @Composable @ReadOnlyComposable get() = LocalSmapAccent.current.base
}

/** 남색 바탕 위 보조 글자색 */
val SmapOnNavyMuted = Color.White.copy(alpha = 0.72f)

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
            .shadow(10.dp, shape, ambientColor = SmapBrush.Accent, spotColor = SmapBrush.Accent)
            .clip(shape)
            .background(SmapBrush.accent)
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
            .shadow(6.dp, androidx.compose.foundation.shape.CircleShape, ambientColor = SmapBrush.Accent, spotColor = SmapBrush.Accent)
            .clip(androidx.compose.foundation.shape.CircleShape)
            .background(SmapBrush.accent)
            .clickable(onClickLabel = contentDescription, role = androidx.compose.ui.semantics.Role.Button, onClick = onClick)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = androidx.compose.ui.Alignment.Center,
    ) {
        androidx.compose.material3.Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
    }
}
