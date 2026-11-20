package com.dmonster.smap.ui.home

import com.dmonster.smap.ui.components.SmapDialogActions
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.FlightTakeoff
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.data.model.PushLog
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import com.dmonster.smap.ui.components.SmapAccent
import com.dmonster.smap.ui.components.SmapAccentTheme
import com.dmonster.smap.ui.components.SmapEmptyState
import com.dmonster.smap.ui.components.SmapFamilyCover
import com.dmonster.smap.R
import androidx.compose.ui.graphics.Color
import com.dmonster.smap.ui.components.SmapLoadingState
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationScreen(
    onClose: () -> Unit,
    viewModel: NotificationViewModel = hiltViewModel()
) = SmapAccentTheme(SmapAccent.Family) {
    val logs by viewModel.logs.collectAsState()
    val summary by viewModel.summary.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    // Show error message in Snackbar
    LaunchedEffect(errorMessage) {
        errorMessage?.let { message ->
            snackbarHostState.showSnackbar(
                message = message,
                actionLabel = "확인",
                duration = SnackbarDuration.Long
            )
            viewModel.clearError()
        }
    }

    val colors = MaterialTheme.colorScheme
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = colors.surface
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.fillMaxSize()) {
                NotificationHeader(onClose = onClose, viewModel = viewModel)

                PullToRefreshBox(
                    isRefreshing = isRefreshing,
                    onRefresh = { viewModel.refresh() },
                    modifier = Modifier.fillMaxSize()
                ) {
                    LazyColumn(
                        modifier = Modifier.align(Alignment.TopCenter).widthIn(max = 600.dp).fillMaxSize(),
                        contentPadding = PaddingValues(20.dp),
                        verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
                    ) {
                        item {
                            SmapFamilyCover(R.drawable.login_arrival_cycling, minHeight = 144.dp) {
                                Text("최근 7일", style = SmapText.captionBold, color = Color.White)
                                Spacer(Modifier.height(5.dp))
                                Text(
                                    if (summary.total > 0) "받은 알림 ${summary.total}건" else "가족 알림함",
                                    style = SmapText.pageTitle,
                                    color = Color.White,
                                )
                                if (summary.total > 0) {
                                    Spacer(Modifier.height(5.dp))
                                    Text("읽지 않음 ${summary.unread}  ·  읽음 ${summary.read}", style = SmapText.secondaryMedium, color = Color.White)
                                }
                            }
                        }

                        when {
                            isLoading && logs.isEmpty() -> item {
                                SmapLoadingState(modifier = Modifier.height(220.dp))
                            }
                            logs.isEmpty() -> item {
                                SmapEmptyState(
                                    title = "받은 알림이 없어요",
                                    description = "가족의 위치와 그룹 활동 알림이 여기에 표시돼요.",
                                    icon = Icons.Default.Notifications,
                                    modifier = Modifier.fillMaxWidth().heightIn(min = 220.dp),
                                )
                            }
                            else -> {
                                items(logs, key = { it.pltIdx }) { log ->
                                    Column {
                                        NotificationItem(log = log)
                                        HorizontalDivider(Modifier.padding(start = 52.dp), color = colors.outlineVariant)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
    }
}

@Composable
private fun NotificationHeader(onClose: () -> Unit, viewModel: NotificationViewModel) {
    var showMenu by remember { mutableStateOf(false) }
    var showDeleteConfirmation by remember { mutableStateOf(false) }

    SmapTopBar(title = "알림", onBack = onClose) {
        Box {
            IconButton(onClick = { showMenu = true }) {
                Icon(Icons.Default.MoreHoriz, contentDescription = "알림 메뉴")
            }
            DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                DropdownMenuItem(
                    text = {
                        Text("전체 삭제", style = SmapText.body, color = MaterialTheme.colorScheme.error)
                    },
                    onClick = {
                        showMenu = false
                        showDeleteConfirmation = true
                    }
                )
            }
        }
    }

    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = {
                Text("전체 삭제", style = SmapText.headline)
            },
            text = {
                Text("모든 알림을 삭제하시겠습니까?", style = SmapText.body)
            },
            confirmButton = {
                SmapDialogActions(
                    confirmText = "삭제",
                    onConfirm = {
                        showDeleteConfirmation = false
                        viewModel.deleteAllLogs()
                    },
                    onDismiss = { showDeleteConfirmation = false },
                    destructive = true
                )
            },
            shape = RoundedCornerShape(SmapRadius.lg),
            containerColor = MaterialTheme.colorScheme.surface
        )
    }
}

@Composable
private fun NotificationItem(log: PushLog) {
    val isUnread = log.pltReadChk == "N"
    val colors = MaterialTheme.colorScheme

    val today = LocalDate.now()
    val formattedTime = remember(log.pltSdate, today) {
        log.pltSdate?.let { raw ->
            try {
                val timestamp = DateTimeFormatter.ISO_DATE_TIME.parseBest(raw.replace(' ', 'T'), OffsetDateTime::from, LocalDateTime::from)
                val local = if (timestamp is OffsetDateTime) {
                    timestamp.atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime()
                } else {
                    LocalDateTime.from(timestamp)
                }
                val pattern = when (local.toLocalDate()) {
                    today -> "a h:mm"
                    today.minusDays(1) -> "'어제' a h:mm"
                    else -> "M월 d일 a h:mm"
                }
                local.format(DateTimeFormatter.ofPattern(pattern, Locale.KOREAN))
            } catch (_: DateTimeParseException) {
                raw
            }
        }.orEmpty()
    }

    val typeIcon = when {
        log.pltTitle?.contains("방문") == true || log.pltTitle?.contains("도착") == true -> Icons.Default.Flag
        log.pltTitle?.contains("이탈") == true -> Icons.Default.FlightTakeoff
        log.pltTitle?.contains("시작") == true || log.pltTitle?.contains("일정") == true || log.pltType == 3 -> Icons.Default.Schedule
        log.pltType == 2 -> Icons.Default.Flag
        else -> Icons.Default.Notifications
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                stateDescription = if (isUnread) "읽지 않음" else "읽음"
            }
            .padding(horizontal = 4.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(SmapSpacing.sm),
    ) {
        SmapRowIcon(typeIcon)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SmapSpacing.xs)) {
            Text(log.pltTitle ?: "알림", style = SmapText.bodyBold, color = colors.onSurface)
            if (!log.pltContent.isNullOrBlank()) {
                Text(
                    log.pltContent,
                    style = SmapText.secondary,
                    color = colors.onSurfaceVariant,
                )
            }
            if (formattedTime.isNotEmpty()) {
                Text(formattedTime, style = SmapText.captionSmall, color = colors.onSurfaceVariant)
            }
        }
        if (isUnread) {
            Box(Modifier.padding(top = 7.dp).size(7.dp).background(colors.primary, CircleShape))
        }
    }
}
