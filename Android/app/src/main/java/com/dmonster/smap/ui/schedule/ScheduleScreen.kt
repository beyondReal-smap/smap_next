package com.dmonster.smap.ui.schedule

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale
import com.dmonster.smap.ui.components.DateChipItem
import com.dmonster.smap.ui.components.DateStrip
import com.dmonster.smap.ui.components.LocalSmapAccent
import com.dmonster.smap.ui.theme.FamilyColors
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.EventAvailable
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.components.GroupPickerSheet
import com.dmonster.smap.ui.components.SmapGradientIconButton
import com.dmonster.smap.ui.components.TopControlsVerticalPadding
import com.dmonster.smap.ui.components.GroupSwitcherPill
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import androidx.compose.material3.pulltorefresh.PullToRefreshBox

/**
 * 일정 화면 - 달력 + 일정 목록
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(
    viewModel: ScheduleViewModel = hiltViewModel()
) {
    val haptics = rememberSmapHaptics()
    var showsMonth by rememberSaveable { mutableStateOf(false) }

    // Collect States
    val currentMonth by viewModel.currentMonth.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val schedules by viewModel.schedules.collectAsState()
    val groups by viewModel.groups.collectAsState()
    val selectedGroup by viewModel.selectedGroup.collectAsState()
    val members by viewModel.members.collectAsState() // Added
    
    val isLoading by viewModel.isLoading.collectAsState()
    val isLoadingSchedules by viewModel.isLoadingSchedules.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    // Dialog States
    val showGroupSelector by viewModel.showGroupSelector.collectAsState()
    val showEventDetail by viewModel.showEventDetail.collectAsState()
    val showCreateDialog by viewModel.showCreateDialog.collectAsState()
    val showEditDialog by viewModel.showEditDialog.collectAsState()
    val showDeleteDialog by viewModel.showDeleteDialog.collectAsState()
    val isCreating by viewModel.isCreating.collectAsState()
    val isActionLoading by viewModel.isActionLoading.collectAsState()
    val editOption by viewModel.editOption.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    
    // Recurring schedule action states
    var showRecurringEditDialog by remember { mutableStateOf(false) }
    var showRecurringDeleteDialog by remember { mutableStateOf(false) }
    var selectedScheduleForAction by remember { mutableStateOf<SmapSchedule?>(null) }
    
    // Smooth transition states
    var lastEditSchedule by remember { mutableStateOf<SmapSchedule?>(null) }
    if (showEditDialog != null) lastEditSchedule = showEditDialog
    
    // Reactive Derived States - re-computed when schedules or selectedDate changes
    val selectedDateSchedules = remember(schedules, selectedDate) {
        viewModel.getSchedulesForDate(selectedDate)
    }
    val eventDates = remember(schedules) {
        viewModel.getEventDates()
    }
    
    // Snackbar
    val snackbarHostState = remember { SnackbarHostState() }
    
    // Handle messages — 피드백에 Haptic 동반
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            haptics.error()
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearError()
        }
    }

    LaunchedEffect(successMessage) {
        successMessage?.let {
            haptics.success()
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearSuccess()
        }
    }
    
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = if (androidx.compose.foundation.isSystemInDarkTheme()) MaterialTheme.colorScheme.background else FamilyColors.Paper
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // 그룹 선택·일정 추가 줄과 선택한 날 카드는 위에 고정 — 목록을 내려도 어느 그룹·어느 날을 보는지 늘 보이게.
            Column(
                modifier = Modifier.padding(start = SmapSpacing.md, end = SmapSpacing.md, bottom = SmapSpacing.md),
                verticalArrangement = Arrangement.spacedBy(SmapSpacing.md)
            ) {
                // 맨 위 줄 — 그룹 전환 알약(지도 탭과 같은 모양·위치)과 일정 추가 버튼.
                // 아래 탭 막대에 이미 "일정"이 표시돼 큰 제목은 중복이라 뺐다(대표님 요청).
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = TopControlsVerticalPadding),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(Modifier.weight(1f)) {
                        GroupSwitcherPill(
                            groupName = selectedGroup?.sgtTitle,
                            onClick = { viewModel.toggleGroupSelector() }
                        )
                    }
                    // 일정 추가는 이 탭의 주 동작이라 남색 그라데이션 원으로 강조한다.
                    SmapGradientIconButton(
                        icon = Icons.Outlined.Add,
                        contentDescription = "일정 추가",
                        onClick = { viewModel.showCreateDialog() }
                    )
                }

                Row(
                    Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(22.dp)).padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(Modifier.size(68.dp, 76.dp).background(FamilyColors.Highlight, RoundedCornerShape(15.dp)),
                        contentAlignment = Alignment.Center) {
                        Text("${selectedDate.dayOfMonth}", style = SmapText.title.copy(fontSize = 46.sp, lineHeight = 52.sp), color = FamilyColors.Ink)
                    }
                    Column(Modifier.weight(1f)) {
                        Text("${selectedDate.year}년 ${selectedDate.monthValue}월", style = SmapText.captionBold, color = LocalSmapAccent.current.deep)
                        Text(selectedDate.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.KOREAN),
                            style = SmapText.title, color = FamilyColors.Ink)
                    }
                    FilledTonalButton(onClick = { showsMonth = !showsMonth },
                        colors = ButtonDefaults.filledTonalButtonColors(containerColor = LocalSmapAccent.current.container,
                            contentColor = LocalSmapAccent.current.deep), contentPadding = PaddingValues(horizontal = 12.dp)) {
                        Text(if (showsMonth) "달력 접기" else "월 달력", style = SmapText.captionBold)
                    }
                }
            }
            PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = { viewModel.refresh() },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = SmapSpacing.md, end = SmapSpacing.md, bottom = SmapSpacing.xl),
                    verticalArrangement = Arrangement.spacedBy(SmapSpacing.md)
                ) {
                    item {
                        if (showsMonth) {
                            MonthCalendar(
                                currentMonth = currentMonth, selectedDate = selectedDate, eventDates = eventDates,
                                onDateSelect = { viewModel.selectDate(it); showsMonth = false },
                                onPreviousMonth = { viewModel.goToPreviousMonth() }, onNextMonth = { viewModel.goToNextMonth() },
                                onToday = { viewModel.goToToday(); showsMonth = false }
                            )
                        } else {
                            val days = remember(currentMonth, eventDates) {
                                (1..currentMonth.lengthOfMonth()).map { day ->
                                    val date = currentMonth.atDay(day)
                                    DateChipItem(date, dot = date in eventDates)
                                }
                            }
                            key(currentMonth) { DateStrip(days, selectedDate, onSelect = { viewModel.selectDate(it.date) }) }
                        }
                    }

                    item {
                        val count = selectedDateSchedules.size
                        SmapSection(
                            modifier = Modifier.padding(top = SmapSpacing.sm),
                            title = (if (selectedDate == LocalDate.now()) "오늘의 약속" else "이날의 약속") + if (count > 0) " · ${count}개" else ""
                        ) {
                            when {
                                // 그날 일정이 이미 보이면 새로 불러오는 동안에도 그대로 둔다(탭을 열 때마다 스피너로 깜빡이던 것).
                                (isLoading || isLoadingSchedules) && !isRefreshing && selectedDateSchedules.isEmpty() -> Box(
                                    Modifier
                                        .fillMaxWidth()
                                        .height(96.dp),
                                    contentAlignment = Alignment.Center
                                ) { CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.5.dp) }
                                selectedDateSchedules.isEmpty() -> Column(Modifier.fillMaxWidth().padding(SmapSpacing.md),
                                    verticalArrangement = Arrangement.spacedBy(14.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Box(Modifier.size(46.dp, 48.dp).background(LocalSmapAccent.current.container, RoundedCornerShape(12.dp)),
                                            contentAlignment = Alignment.Center) {
                                            Icon(Icons.Outlined.EventAvailable, contentDescription = null, tint = LocalSmapAccent.current.deep)
                                        }
                                        Text("아직 약속이 없는 날이에요", style = SmapText.headline, color = MaterialTheme.colorScheme.onSurface)
                                    }
                                    Button(onClick = { viewModel.showCreateDialog() }, modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = FamilyColors.Ink, contentColor = Color.White),
                                        shape = RoundedCornerShape(13.dp)) {
                                        Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("이날 약속 추가", style = SmapText.captionBold)
                                    }
                                }
                                else -> selectedDateSchedules.forEachIndexed { i, schedule ->
                                    if (i > 0) SmapRowDivider()
                                    ScheduleRow(schedule = schedule, onClick = { viewModel.showEventDetail(schedule) })
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 그룹 선택 — 지도 탭과 같은 아래 시트.
    if (showGroupSelector) {
        GroupPickerSheet(
            groups = groups,
            selectedGroupId = selectedGroup?.sgtIdx,
            onSelect = { viewModel.selectGroup(it) },
            onDismiss = { viewModel.hideGroupSelector() }
        )
    }

    // Fix #5: Route recurring events through RecurringScheduleActionDialog from EventDetailDialog
    showEventDetail?.let { schedule ->
        val canManage = viewModel.canManageSchedule(schedule)
        EventDetailDialog(
            schedule = schedule,
            canEdit = canManage,
            onDismiss = { viewModel.hideEventDetail() },
            onEdit = {
                viewModel.dismissEventDetail()
                if (schedule.isRecurring) {
                    selectedScheduleForAction = schedule
                    showRecurringEditDialog = true
                } else {
                    viewModel.showEditDialog(schedule)
                }
            },
            onDelete = {
                viewModel.dismissEventDetail()
                if (schedule.isRecurring) {
                    selectedScheduleForAction = schedule
                    showRecurringDeleteDialog = true
                } else {
                    viewModel.showDeleteDialog(schedule)
                }
            }
        )
    }
    // Create Event Screen
    AnimatedVisibility(
        visible = showCreateDialog,
        enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
        exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
    ) {
        CreateEditEventDialog(
            isEdit = false,
            schedule = null,
            selectedDate = selectedDate,
            groups = groups,
            selectedGroup = selectedGroup,
            members = members,
            currentUserId = viewModel.currentUserId,
            onGroupSelect = { viewModel.selectGroup(it) },
            onDismiss = { viewModel.hideCreateDialog() },
            initialEditOption = null,
            onSave = { targetMemberId, title, startDate, endDate, isAllDay, memo, location, lat, lng, alarm, repeat, _ ->
                viewModel.createSchedule(
                    targetMemberId = targetMemberId,
                    title = title,
                    startDate = startDate,
                    endDate = endDate,
                    isAllDay = isAllDay,
                    memo = memo,
                    locationName = location,
                    locationLat = lat,
                    locationLng = lng,
                    alarmTime = alarm,
                    repeatConfig = repeat
                )
            },
            isLoading = isCreating
        )
    }

    // Edit Event Screen
    AnimatedVisibility(
        visible = showEditDialog != null,
        enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
        exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
    ) {
        val scheduleToEdit = showEditDialog ?: lastEditSchedule
        scheduleToEdit?.let { schedule ->
            CreateEditEventDialog(
                isEdit = true,
                schedule = schedule,
                selectedDate = selectedDate,
                groups = groups,
                selectedGroup = selectedGroup,
                members = members,
                currentUserId = viewModel.currentUserId,
                onGroupSelect = { viewModel.selectGroup(it) },
                onDismiss = { viewModel.hideEditDialog() },
                initialEditOption = editOption,
                onSave = { targetMemberId, title, startDate, endDate, isAllDay, memo, location, lat, lng, alarm, repeat, editOption ->
                    viewModel.updateSchedule(
                        scheduleId = schedule.sstIdx,
                        title = title,
                        startDate = startDate,
                        endDate = endDate,
                        isAllDay = isAllDay,
                        memo = memo,
                        locationName = location,
                        locationLat = lat,
                        locationLng = lng,
                        alarmTime = alarm,
                        repeatConfig = repeat,
                        editOption = editOption
                    )
                },
                isLoading = isActionLoading
            )
        }
    }

    showDeleteDialog?.let { schedule ->
        val isRepeat = !schedule.sstIdx.isNullOrEmpty() && schedule.sstIdx.contains("-")
        DeleteScheduleDialog(
            schedule = schedule,
            isRepeat = isRepeat,
            onDismiss = { viewModel.hideDeleteDialog() },
            onConfirm = { deleteOption ->
                haptics.warning() // 삭제 확정 피드백
                viewModel.deleteSchedule(schedule.sstIdx, schedule.sgtIdx ?: 0, deleteOption)
            },
            isLoading = isActionLoading
        )
    }
    
    // Recurring Schedule Edit Dialog
    if (showRecurringEditDialog) {
        RecurringScheduleActionDialog(
            title = "반복 일정 수정",
            message = "수정할 범위를 선택해 주세요.",
            thisOnlyLabel = "이 일정만 수정",
            allLabel = "모든 반복 일정 수정",
            onThisOnly = {
                showRecurringEditDialog = false
                selectedScheduleForAction?.let { schedule ->
                    viewModel.showEditDialogWithOption(schedule, "this")
                }
                selectedScheduleForAction = null
            },
            onAll = {
                showRecurringEditDialog = false
                selectedScheduleForAction?.let { schedule ->
                    viewModel.showEditDialogWithOption(schedule, "all")
                }
                selectedScheduleForAction = null
            },
            onDismiss = {
                showRecurringEditDialog = false
                selectedScheduleForAction = null
            }
        )
    }
    
    // Recurring Schedule Delete Dialog
    if (showRecurringDeleteDialog) {
        RecurringScheduleActionDialog(
            title = "반복 일정 삭제",
            message = "삭제할 범위를 선택해 주세요.",
            thisOnlyLabel = "이 일정만 삭제",
            allLabel = "모든 반복 일정 삭제",
            isDestructive = true,
            onThisOnly = {
                showRecurringDeleteDialog = false
                selectedScheduleForAction?.let { schedule ->
                    viewModel.deleteSchedule(schedule.sstIdx, schedule.sgtIdx ?: 0, "this")
                }
                selectedScheduleForAction = null
            },
            onAll = {
                showRecurringDeleteDialog = false
                selectedScheduleForAction?.let { schedule ->
                    viewModel.deleteSchedule(schedule.sstIdx, schedule.sgtIdx ?: 0, "all")
                }
                selectedScheduleForAction = null
            },
            onDismiss = {
                showRecurringDeleteDialog = false
                selectedScheduleForAction = null
            }
        )
    }
}
