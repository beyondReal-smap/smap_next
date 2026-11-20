package com.dmonster.smap.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.NotificationsOff
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapNotice
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.ui.components.SmapEmptyState
import com.dmonster.smap.ui.components.SmapErrorState
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapLoadingState
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CancellationException
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/*
 * 공지사항 — 36단계: 설정 화면과 같은 "회색 바탕 + 구역 + 흰 행" 목록 / 흰 바탕 본문으로 (iOS NoticeListView 와 같은 구성).
 * 이전에는 흰 "< 뒤로" 알약 머리 + 빨강 그라데이션 머리 카드 + 그림자 카드 목록이었다(빨강은 앱 어디에도 없는 색).
 */

/** 최근 며칠 안에 올라온 공지에 "NEW" 표시 */
private const val NEW_BADGE_DAYS = 7L

@EntryPoint
@InstallIn(SingletonComponent::class)
interface NoticeEntryPoint {
    fun authService(): AuthService
}

@Composable
fun NoticeListScreen(onBack: () -> Unit, onNoticeClick: (SmapNotice) -> Unit) {
    val context = LocalContext.current
    val authService = remember {
        EntryPointAccessors.fromApplication(context.applicationContext, NoticeEntryPoint::class.java).authService()
    }
    var notices by remember { mutableStateOf<List<SmapNotice>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var loadFailed by remember { mutableStateOf(false) }
    var reloadKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(reloadKey) {
        isLoading = true
        loadFailed = false
        try {
            val response = authService.getNotices()
            // 응답이 없으면(null) 실패로 본다 — 이전에는 빈 목록("공지가 없습니다")으로 보여 원인이 가려졌다.
            if (response != null) notices = response.notices else loadFailed = true
        } catch (e: Exception) {
            android.util.Log.e("NoticeListScreen", "공지 목록 조회 실패", e)
            loadFailed = true
        } finally {
            isLoading = false
        }
    }

    val colors = MaterialTheme.colorScheme
    Scaffold(
        containerColor = colors.surface,
        topBar = { SmapTopBar(title = "공지사항", onBack = onBack) }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            when {
                isLoading -> SmapLoadingState()
                loadFailed -> SmapErrorState(onRetry = { reloadKey++ })
                notices.isEmpty() -> SmapEmptyState(
                    title = "등록된 공지사항이 없어요",
                    description = "새 소식이 생기면 여기에 알려 드릴게요.",
                    icon = Icons.Outlined.NotificationsOff,
                )
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(SmapSpacing.md),
                ) {
                    item {
                        Column {
                            Text("공지 ${notices.size}건", style = SmapText.pageTitle, color = colors.onSurface, modifier = Modifier.padding(bottom = 12.dp))
                            notices.forEachIndexed { index, notice ->
                                if (index > 0) SmapRowDivider()
                                NoticeRow(notice = notice, onClick = { onNoticeClick(notice) })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NoticeRow(notice: SmapNotice, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    SmapListRow(
        title = notice.ntTitle,
        subtitle = noticeMeta(notice),
        leading = { SmapRowIcon(Icons.Outlined.Campaign) },
        trailing = {
            if (isRecent(notice)) NewBadge()
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = colors.onSurfaceVariant)
        },
        onClick = onClick,
    )
}

/** 최근 공지 표시 — 메뉴 강조색 글자 + 옅은 바탕 알약 */
@Composable
private fun NewBadge() {
    val colors = MaterialTheme.colorScheme
    Text(
        "NEW",
        style = SmapText.captionBold,
        color = colors.primary,
        modifier = Modifier
            .background(colors.primaryContainer, RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
fun NoticeDetailScreen(notice: SmapNotice, onBack: () -> Unit) {
    val context = LocalContext.current
    val authService = remember {
        EntryPointAccessors.fromApplication(context.applicationContext, NoticeEntryPoint::class.java).authService()
    }
    // 목록에서 받은 내용으로 바로 보여 주고, 서버가 조회수를 올려 돌려준 값으로 바꾼다(iOS 와 같은 동작).
    var shown by remember(notice.ntIdx) { mutableStateOf(notice) }
    LaunchedEffect(notice.ntIdx) {
        try {
            shown = authService.getNotice(notice.ntIdx)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // 조회수 반영만 실패한 것 — 본문은 이미 보이므로 화면은 그대로 두고 원인을 남긴다.
            android.util.Log.e("NoticeDetailScreen", "공지 상세 조회(조회수 증가) 실패: ${notice.ntIdx}", e)
        }
    }
    val colors = MaterialTheme.colorScheme
    Scaffold(
        containerColor = colors.surface,
        topBar = { SmapTopBar(title = "공지사항", onBack = onBack) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(SmapSpacing.lg),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(SmapSpacing.sm)) {
                if (isRecent(shown)) NewBadge()
                Text(noticeMeta(shown), style = SmapText.caption, color = colors.onSurfaceVariant)
            }
            Spacer(Modifier.height(SmapSpacing.sm))
            Text(shown.ntTitle, style = SmapText.pageTitle, color = colors.onSurface)
            HorizontalDivider(modifier = Modifier.padding(vertical = SmapSpacing.lg), color = colors.outlineVariant)
            Text(
                shown.ntContent,
                style = SmapText.body.copy(lineHeight = SmapText.body.fontSize * 1.65f),
                color = colors.onSurface,
                overflow = TextOverflow.Clip,
            )
            Spacer(Modifier.height(SmapSpacing.xl))
        }
    }
}

/** "2026.11.16 · 조회 3" */
private fun noticeMeta(notice: SmapNotice): String =
    "${notice.ntWdate.take(10).replace('-', '.')} · 조회 ${notice.ntHit}"

private fun isRecent(notice: SmapNotice): Boolean {
    val date = runCatching { LocalDate.parse(notice.ntWdate.take(10)) }.getOrNull() ?: return false
    return ChronoUnit.DAYS.between(date, LocalDate.now()) in 0 until NEW_BADGE_DAYS
}
