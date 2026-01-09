package com.dmonster.smap.ui.schedule

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

/**
 * 일정 화면 - 달력 + 일정 목록
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(
    viewModel: ScheduleViewModel = viewModel()
) {
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
    val editOption by viewModel.editOption.collectAsState()
    
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
    
    // Handle messages
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearError()
        }
    }
    
    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearSuccess()
        }
    }
    
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color.White)
        ) {
            // Header - same as Group page style
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "일정",
                        fontSize = 22.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black
                    )
                    Text(
                        text = "그룹 멤버들과 일정을 공유해보세요",
                        fontSize = 13.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                }
                
                IconButton(onClick = { viewModel.showCreateDialog() }) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "일정 추가",
                        tint = BrandColors.Primary,
                        modifier = Modifier.size(28.dp)
                    )
                }
            }
            
            // Content below Header with gradient background
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.White)
            ) {
                // Group Selector Dropdown
                AnimatedVisibility(
                    visible = showGroupSelector,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    GroupSelectorDropdown(
                        groups = groups,
                        selectedGroup = selectedGroup,
                        onGroupSelect = { viewModel.selectGroup(it) },
                        onDismiss = { viewModel.hideGroupSelector() },
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
            
            // Calendar - Fixed at top
            MonthCalendar(
                currentMonth = currentMonth,
                selectedDate = selectedDate,
                eventDates = eventDates,
                onDateSelect = { viewModel.selectDate(it) },
                onPreviousMonth = { viewModel.goToPreviousMonth() },
                onNextMonth = { viewModel.goToNextMonth() },
                onToday = { viewModel.goToToday() },
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )
            
            // Scrollable Content Below Calendar
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentPadding = PaddingValues(bottom = 16.dp)
            ) {
                // Date Header
                item {
                    DateHeader(
                        date = selectedDate,
                        scheduleCount = selectedDateSchedules.size,
                        modifier = Modifier.padding(top = 12.dp, bottom = 12.dp)
                    )
                }
                
                // Event List
                if (isLoading || isLoadingSchedules) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = BrandColors.Primary)
                        }
                    }
                } else if (selectedDateSchedules.isEmpty()) {
                    item {
                        ScheduleEmptyState(
                            onAddClick = { viewModel.showCreateDialog() }
                        )
                    }
                } else {
                    items(selectedDateSchedules) { schedule ->
                        EventCard(
                            schedule = schedule,
                            onClick = { viewModel.showEventDetail(schedule) },
                            onEdit = {
                                if (schedule.isRecurring) {
                                    selectedScheduleForAction = schedule
                                    showRecurringEditDialog = true
                                } else {
                                    viewModel.showEditDialog(schedule)
                                }
                            },
                            onDelete = {
                                if (schedule.isRecurring) {
                                    selectedScheduleForAction = schedule
                                    showRecurringDeleteDialog = true
                                } else {
                                    viewModel.showDeleteDialog(schedule)
                                }
                            },
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}
    
    // Dialogs
    showEventDetail?.let { schedule ->
        EventDetailDialog(
            schedule = schedule,
            canEdit = true, // TODO: Check actual permission
            onDismiss = { viewModel.hideEventDetail() },
            onEdit = { viewModel.showEditDialog(schedule) },
            onDelete = { viewModel.showDeleteDialog(schedule) }
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
                isLoading = false
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
                viewModel.deleteSchedule(schedule.sstIdx, schedule.sgtIdx ?: 0, deleteOption)
            },
            isLoading = false
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
