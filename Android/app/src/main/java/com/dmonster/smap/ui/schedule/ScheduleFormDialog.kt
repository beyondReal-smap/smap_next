package com.dmonster.smap.ui.schedule

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SmapSchedule
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.ScheduleSectionColors
import com.dmonster.smap.ui.theme.SemanticColors
import com.dmonster.smap.ui.theme.SuiteFont
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

// MARK: - Create/Edit Event Dialog

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateEditEventDialog(
    isEdit: Boolean,
    schedule: SmapSchedule?,
    selectedDate: LocalDate,
    groups: List<SmapGroup>,
    selectedGroup: SmapGroup?,
    members: List<SmapGroupMember>,
    currentUserId: Int,
    onGroupSelect: (SmapGroup) -> Unit,
    onDismiss: () -> Unit,
    initialEditOption: String? = null,
    onSave: (
        targetMemberId: Int,
        title: String,
        startDate: String,
        endDate: String,
        isAllDay: Boolean,
        memo: String?,
        locationName: String?,
        locationLat: Double?,
        locationLng: Double?,
        alarmTime: String?,
        repeatConfig: String?,
        editOption: String
    ) -> Unit,
    isLoading: Boolean
) {
    val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    val dateString = selectedDate.format(dateFormatter)

    // rememberSaveable — 화면 회전/프로세스 재생성 시에도 입력값 유지
    var title by rememberSaveable { mutableStateOf(schedule?.title ?: "") }
    var isAllDay by rememberSaveable { mutableStateOf(schedule?.sstAllDay == "Y") }
    var startTime by rememberSaveable { mutableStateOf(schedule?.date?.drop(11)?.take(5) ?: "09:00") }
    var endTime by rememberSaveable { mutableStateOf(schedule?.sstEdate?.drop(11)?.take(5) ?: "10:00") }
    var memo by rememberSaveable { mutableStateOf(schedule?.sstMemo ?: "") }
    var locationName by rememberSaveable { mutableStateOf(schedule?.location ?: "") }
    var locationLat by rememberSaveable { mutableStateOf(schedule?.sstLocationLat) }
    var locationLng by rememberSaveable { mutableStateOf(schedule?.sstLocationLong) }
    // Fix #12: Initialize alarm from existing schedule data if editing
    // TODO: SmapSchedule does not have an alarm field yet; default to "없음"
    var alarmTime by rememberSaveable { mutableStateOf("없음") }
    var repeatConfig by rememberSaveable { mutableStateOf(schedule?.repeatDescription ?: "반복 안함") }
    var editOptionState by rememberSaveable { mutableStateOf(initialEditOption ?: "this") }
    // 생성 시 기본 대상은 로그인한 본인 (그룹장 명의로 요청이 가서 403 나는 문제 방지)
    var targetMember by remember(members, currentUserId) {
        mutableStateOf<SmapGroupMember?>(
            if (isEdit) members.find { it.mtIdx == (schedule?.mtScheduleIdx ?: schedule?.mtIdx) }
            else ScheduleTargetPolicy.defaultTarget(members, currentUserId)
        )
    }
    // 수정 모드는 기존 표시 유지, 생성 모드는 권한에 따라 대상 선택지 제한
    val targetCandidates = if (isEdit) members else ScheduleTargetPolicy.selectableMembers(members, currentUserId)

    // Date/Time State
    var showStartDatePicker by remember { mutableStateOf(false) }
    var showEndDatePicker by remember { mutableStateOf(false) }
    var showStartTimePicker by remember { mutableStateOf(false) }
    var showEndTimePicker by remember { mutableStateOf(false) }
    var startDate by remember { mutableStateOf(schedule?.date?.take(10) ?: dateString) }
    var endDate by remember { mutableStateOf(schedule?.sstEdate?.take(10) ?: dateString) }

    // Repeat/Alarm/Location Sheet State
    var showRepeatSheet by remember { mutableStateOf(false) }
    var showAlarmSheet by remember { mutableStateOf(false) }
    var showLocationSearch by remember { mutableStateOf(false) }

    // Location Search Dialog
    if (showLocationSearch) {
        LocationSearchDialog(
            onDismiss = { showLocationSearch = false },
            onSelect = { place ->
                locationName = place.placeName
                locationLat = place.latitude
                locationLng = place.longitude
                showLocationSearch = false
            }
        )
    }

    // Date Picker Dialogs
    if (showStartDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = LocalDate.parse(startDate).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        )
        DatePickerDialog(
            onDismissRequest = { showStartDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let {
                        startDate = java.time.Instant.ofEpochMilli(it).atZone(java.time.ZoneId.systemDefault()).toLocalDate().format(dateFormatter)
                    }
                    showStartDatePicker = false
                }) { Text("확인") }
            },
            dismissButton = {
                TextButton(onClick = { showStartDatePicker = false }) { Text("취소") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showEndDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = LocalDate.parse(endDate).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        )
        DatePickerDialog(
            onDismissRequest = { showEndDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let {
                        endDate = java.time.Instant.ofEpochMilli(it).atZone(java.time.ZoneId.systemDefault()).toLocalDate().format(dateFormatter)
                    }
                    showEndDatePicker = false
                }) { Text("확인") }
            },
            dismissButton = {
                TextButton(onClick = { showEndDatePicker = false }) { Text("취소") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showStartTimePicker) {
        val timePickerState = rememberTimePickerState(
            initialHour = startTime.take(2).toIntOrNull() ?: 9,
            initialMinute = startTime.drop(3).take(2).toIntOrNull() ?: 0
        )
        AlertDialog(
            onDismissRequest = { showStartTimePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    startTime = String.format(Locale.US, "%02d:%02d", timePickerState.hour, timePickerState.minute)
                    showStartTimePicker = false
                }) { Text("확인") }
            },
            dismissButton = {
                TextButton(onClick = { showStartTimePicker = false }) { Text("취소") }
            },
            text = { TimePicker(state = timePickerState) }
        )
    }

    if (showEndTimePicker) {
        val timePickerState = rememberTimePickerState(
            initialHour = endTime.take(2).toIntOrNull() ?: 10,
            initialMinute = endTime.drop(3).take(2).toIntOrNull() ?: 0
        )
        AlertDialog(
            onDismissRequest = { showEndTimePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    endTime = String.format(Locale.US, "%02d:%02d", timePickerState.hour, timePickerState.minute)
                    showEndTimePicker = false
                }) { Text("확인") }
            },
            dismissButton = {
                TextButton(onClick = { showEndTimePicker = false }) { Text("취소") }
            },
            text = { TimePicker(state = timePickerState) }
        )
    }

    // 반복/알람 선택은 ModalBottomSheet → DropdownMenu(inline anchor) 로 이관 — 하단 UI 블록 참조

    // 키보드 체인 — 제목 → 메모 포커스 이동
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val memoFocusRequester = remember { androidx.compose.ui.focus.FocusRequester() }

    // 실시간 제목 검증 — 저장 시도 후에만 경고 노출해 과도한 방해 방지
    var showTitleError by remember { mutableStateOf(false) }

    // Draft 자동 저장·복구 — 신규 작성 모드에서만 활성
    val context = LocalContext.current
    val draftStore = remember { ScheduleDraftStore.from(context) }
    var showDraftRestoreAlert by remember { mutableStateOf(false) }
    var pendingDraft by remember { mutableStateOf<ScheduleDraft?>(null) }
    var didSaveOrDiscard by remember { mutableStateOf(false) }

    // 최초 진입 시 draft 감지 (신규 모드 한정)
    LaunchedEffect(isEdit) {
        if (!isEdit) {
            draftStore.load()?.let {
                pendingDraft = it
                showDraftRestoreAlert = true
            }
        }
    }

    if (showDraftRestoreAlert) {
        pendingDraft?.let { draft ->
            AlertDialog(
                onDismissRequest = { showDraftRestoreAlert = false },
                title = { Text("이전 작성 내용이 있어요", fontFamily = SuiteFont) },
                text = {
                    Text(
                        "마지막 작성: ${draft.summaryLabel}\n이어서 작성할까요?",
                        fontFamily = SuiteFont
                    )
                },
                confirmButton = {
                    TextButton(onClick = {
                        title = draft.title
                        memo = draft.memo
                        startTime = draft.startTime
                        endTime = draft.endTime
                        isAllDay = draft.isAllDay
                        locationName = draft.locationName
                        locationLat = draft.locationLat
                        locationLng = draft.locationLng
                        alarmTime = draft.alarmTime
                        repeatConfig = draft.repeatConfig
                        showDraftRestoreAlert = false
                        pendingDraft = null
                    }) { Text("불러오기", fontFamily = SuiteFont) }
                },
                dismissButton = {
                    TextButton(onClick = {
                        draftStore.clear()
                        showDraftRestoreAlert = false
                        pendingDraft = null
                    }) { Text("새로 작성", color = BrandColors.Error, fontFamily = SuiteFont) }
                }
            )
        }
    }
    // 미저장 변경 confirmation
    var showDiscardConfirm by remember { mutableStateOf(false) }
    val initialTitle = remember(schedule?.sstIdx) { schedule?.sstTitle ?: "" }
    val initialMemo = remember(schedule?.sstIdx) { schedule?.sstMemo ?: "" }
    val hasUnsavedChanges = title != initialTitle || memo != initialMemo
    val haptics = rememberSmapHaptics()

    val safeDismiss: () -> Unit = {
        if (hasUnsavedChanges) {
            haptics.warning()
            showDiscardConfirm = true
        } else {
            onDismiss()
        }
    }

    // 시스템 Back 도 미저장 가드를 타도록 safeDismiss 경유
    BackHandler { safeDismiss() }

    if (showDiscardConfirm) {
        AlertDialog(
            onDismissRequest = { showDiscardConfirm = false },
            title = { Text("변경 사항이 저장되지 않았어요", fontFamily = SuiteFont) },
            text = { Text("수정 중인 내용을 버리고 닫으시겠습니까?", fontFamily = SuiteFont) },
            confirmButton = {
                TextButton(onClick = {
                    showDiscardConfirm = false
                    // 명시적 버리기 → draft 도 제거 + onDispose 저장 방지
                    if (!isEdit) draftStore.clear()
                    didSaveOrDiscard = true
                    onDismiss()
                }) { Text("변경사항 버리기", color = BrandColors.Error, fontFamily = SuiteFont) }
            },
            dismissButton = {
                TextButton(onClick = { showDiscardConfirm = false }) {
                    Text("계속 편집", fontFamily = SuiteFont)
                }
            }
        )
    }

    // 작성 중 dismiss / 앱 전환 시 draft 저장 (신규 모드 + 변경사항 있음)
    DisposableEffect(Unit) {
        onDispose {
            if (!isEdit && !didSaveOrDiscard && (title.isNotBlank() || memo.isNotBlank())) {
                draftStore.save(
                    ScheduleDraft(
                        title = title,
                        memo = memo,
                        startTime = startTime,
                        endTime = endTime,
                        isAllDay = isAllDay,
                        locationName = locationName,
                        locationLat = locationLat,
                        locationLng = locationLng,
                        alarmTime = alarmTime,
                        repeatConfig = repeatConfig,
                        selectedGroupSgtIdx = selectedGroup?.sgtIdx,
                        targetMemberMtIdx = targetMember?.mtIdx
                    )
                )
            }
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = BrandColors.InputBackground
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .imePadding() // 키보드 올라올 때 저장 버튼이 가려지지 않도록
                .padding(bottom = 24.dp)
        ) {
            // Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "취소",
                    modifier = Modifier
                        .align(Alignment.CenterStart)
                        .clickable { safeDismiss() }
                        .padding(8.dp),
                    fontFamily = SuiteFont,
                    color = BrandColors.TextSecondary,
                    fontSize = 16.sp
                )
                Text(
                    text = if (isEdit) "일정 수정" else "일정 추가",
                    fontSize = 18.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Section 1: Group & Member
                ScheduleSection(
                    number = "1",
                    title = "그룹 및 멤버 선택",
                    bgColor = Color.White,
                    iconColor = ScheduleSectionColors.BadgeGroup
                ) {
                    // Group Selector Dropdown (Simplified for sheet)
                    var expanded by remember { mutableStateOf(false) }
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedCard(
                            onClick = { if (!isEdit) expanded = true },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.outlinedCardColors(
                                containerColor = if (isEdit) BrandColors.InputBackground else Color.White
                            ),
                            border = BorderStroke(
                                width = 0.5.dp,
                                color = if (isEdit) Color.LightGray.copy(alpha = 0.5f) else Color.Gray.copy(alpha = 0.3f)
                            )
                        ) {
                            Row(
                                modifier = Modifier
                                    .padding(horizontal = 16.dp, vertical = 12.dp)
                                    .fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    if (isEdit) {
                                        // 편집 모드 명시 — "수정 불가" 라벨 + 자물쇠 아이콘
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                Icons.Default.Lock,
                                                contentDescription = null,
                                                tint = BrandColors.TextSecondary,
                                                modifier = Modifier.size(10.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                text = "수정 불가",
                                                fontFamily = SuiteFont,
                                                fontSize = 10.sp,
                                                color = BrandColors.TextSecondary
                                            )
                                        }
                                        Spacer(modifier = Modifier.height(2.dp))
                                    }
                                    Text(
                                        text = selectedGroup?.sgtTitle ?: "그룹 선택",
                                        fontFamily = SuiteFont,
                                        fontSize = 15.sp,
                                        color = if (isEdit) BrandColors.TextSecondary else BrandColors.TextPrimary
                                    )
                                }
                                Icon(
                                    if (isEdit) Icons.Default.Lock else Icons.Default.KeyboardArrowDown,
                                    contentDescription = if (isEdit) "수정 불가" else "그룹 선택",
                                    tint = BrandColors.TextSecondary
                                )
                            }
                        }
                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false },
                            modifier = Modifier.fillMaxWidth(0.9f)
                        ) {
                            groups.forEach { group ->
                                DropdownMenuItem(
                                    text = { Text(group.sgtTitle ?: "", fontFamily = SuiteFont) },
                                    onClick = {
                                        onGroupSelect(group)
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "대상 멤버",
                        fontSize = 13.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(end = 16.dp)
                    ) {
                        items(targetCandidates) { member ->
                            MemberItem(
                                member = member,
                                isSelected = targetMember?.mtIdx == member.mtIdx,
                                isEdit = isEdit,
                                onClick = {
                                    if (!isEdit) {
                                        targetMember = member
                                    }
                                }
                            )
                        }
                    }
                }

                // Section 2: Title & Content
                ScheduleSection(
                    number = "2",
                    title = "일정 제목 및 내용",
                    bgColor = Color.White,
                    iconColor = ScheduleSectionColors.BadgeContent
                ) {
                    Text(
                        text = "일정 제목 *",
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = title,
                        onValueChange = {
                            title = it
                            if (it.isNotBlank()) showTitleError = false // 입력 시작하면 경고 해제
                        },
                        placeholder = { Text("일정 제목을 입력하세요", fontFamily = SuiteFont) },
                        isError = showTitleError,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            imeAction = androidx.compose.ui.text.input.ImeAction.Next,
                            capitalization = androidx.compose.ui.text.input.KeyboardCapitalization.Sentences
                        ),
                        keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                            onNext = { memoFocusRequester.requestFocus() }
                        ),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = ScheduleSectionColors.BadgeContent,
                            unfocusedBorderColor = ScheduleSectionColors.BadgeContent.copy(alpha = 0.5f),
                            errorBorderColor = BrandColors.Error,
                            errorContainerColor = BrandColors.Error.copy(alpha = 0.05f)
                        )
                    )
                    if (showTitleError) {
                        Row(
                            modifier = Modifier.padding(top = 4.dp, start = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.ErrorOutline,
                                contentDescription = null,
                                tint = BrandColors.Error,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "필수 입력 항목입니다",
                                fontSize = 12.sp,
                                fontFamily = SuiteFont,
                                color = BrandColors.Error
                            )
                        }
                    } else {
                        Text(
                            text = "예) 팀 회의, 프로젝트 미팅 등",
                            fontSize = 12.sp,
                            fontFamily = SuiteFont,
                            color = BrandColors.TextSecondary,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "일정 내용 (선택)",
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = memo,
                        onValueChange = { memo = it },
                        placeholder = { Text("예) 회의 안건, 준비물, 참고사항 등", fontFamily = SuiteFont) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .focusRequester(memoFocusRequester),
                        minLines = 3,
                        maxLines = 5,
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            imeAction = androidx.compose.ui.text.input.ImeAction.Done,
                            capitalization = androidx.compose.ui.text.input.KeyboardCapitalization.Sentences
                        ),
                        keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                            onDone = { focusManager.clearFocus() }
                        ),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = ScheduleSectionColors.BadgeContent,
                            unfocusedBorderColor = Color.Gray.copy(alpha = 0.2f)
                        )
                    )
                }

                // Section 3: Date & Time
                ScheduleSection(
                    number = "3",
                    title = "날짜 및 시간",
                    bgColor = Color.White,
                    iconColor = ScheduleSectionColors.BadgeDateTime
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "하루 종일",
                            fontSize = 15.sp,
                            fontFamily = SuiteFont,
                            color = Color.Black
                        )
                        Switch(
                            checked = isAllDay,
                            onCheckedChange = { isAllDay = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color.White,
                                checkedTrackColor = ScheduleSectionColors.BadgeDateTime
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(color = Color.Gray.copy(alpha = 0.1f))
                    Spacer(modifier = Modifier.height(12.dp))

                    // Start Time Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("시작", fontFamily = SuiteFont, fontSize = 14.sp, color = Color.Gray)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TimeChip(text = startDate, onClick = { showStartDatePicker = true })
                            if (!isAllDay) TimeChip(text = startTime, onClick = { showStartTimePicker = true })
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(color = Color.Gray.copy(alpha = 0.1f))
                    Spacer(modifier = Modifier.height(12.dp))

                    // End Time Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("종료", fontFamily = SuiteFont, fontSize = 14.sp, color = Color.Gray)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TimeChip(text = endDate, onClick = { showEndDatePicker = true })
                            if (!isAllDay) TimeChip(text = endTime, onClick = { showEndTimePicker = true })
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // 반복 — DropdownMenu inline, ModalBottomSheet 제거로 맥락 유지
                        Box(modifier = Modifier.weight(1f)) {
                            SelectionField(
                                label = "반복",
                                value = repeatConfig,
                                onClick = { showRepeatSheet = true }
                            )
                            DropdownMenu(
                                expanded = showRepeatSheet,
                                onDismissRequest = { showRepeatSheet = false }
                            ) {
                                listOf("반복 안함", "매일", "매주", "매월", "매년").forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(option, fontFamily = SuiteFont) },
                                        onClick = {
                                            repeatConfig = option
                                            haptics.light()
                                            showRepeatSheet = false
                                        },
                                        trailingIcon = if (repeatConfig == option) {
                                            { Icon(Icons.Default.Check, null, tint = BrandColors.Primary) }
                                        } else null
                                    )
                                }
                            }
                        }
                        // 알림 — 동일 패턴
                        Box(modifier = Modifier.weight(1f)) {
                            SelectionField(
                                label = "알림",
                                value = alarmTime,
                                onClick = { showAlarmSheet = true }
                            )
                            DropdownMenu(
                                expanded = showAlarmSheet,
                                onDismissRequest = { showAlarmSheet = false }
                            ) {
                                listOf("없음", "정시", "5분 전", "10분 전", "15분 전", "30분 전", "1시간 전", "1일 전").forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(option, fontFamily = SuiteFont) },
                                        onClick = {
                                            alarmTime = option
                                            haptics.light()
                                            showAlarmSheet = false
                                        },
                                        trailingIcon = if (alarmTime == option) {
                                            { Icon(Icons.Default.Check, null, tint = BrandColors.Primary) }
                                        } else null
                                    )
                                }
                            }
                        }
                    }
                }

                // Section 4: Additional Settings
                ScheduleSection(
                    number = "4",
                    title = "추가 설정",
                    bgColor = Color.White,
                    iconColor = ScheduleSectionColors.BadgeExtra
                ) {
                    Text(
                        text = "장소 정보 (선택)",
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedCard(
                        onClick = { showLocationSearch = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.outlinedCardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, Color.Gray.copy(alpha = 0.2f))
                    ) {
                        Row(
                            modifier = Modifier
                                .padding(horizontal = 16.dp, vertical = 14.dp)
                                .fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(Icons.Default.PinDrop, null, tint = ScheduleSectionColors.BadgeExtra, modifier = Modifier.size(20.dp))
                            Text(
                                text = locationName.ifBlank { "장소를 입력하세요" },
                                fontFamily = SuiteFont,
                                fontSize = 15.sp,
                                color = if (locationName.isBlank()) Color.Gray else Color.Black,
                                modifier = Modifier.weight(1f)
                            )
                            Icon(Icons.Default.Search, null, tint = Color.Gray, modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }

            // Fix #9: Date validation error state
            var dateValidationError by remember { mutableStateOf<String?>(null) }

            dateValidationError?.let { error ->
                Text(
                    text = error,
                    color = BrandColors.Error,
                    fontSize = 13.sp,
                    fontFamily = SuiteFont,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp)
                )
            }

            // Save Button
            Button(
                    onClick = {
                        // 실시간 제목 검증 — 저장 시도 시 활성화
                        if (title.isBlank()) {
                            showTitleError = true
                            haptics.warning()
                            return@Button
                        }
                        // Fix #9: Validate start/end dates before saving
                        if (endDate < startDate || (endDate == startDate && endTime <= startTime && !isAllDay)) {
                            dateValidationError = "종료 시간은 시작 시간 이후여야 합니다"
                            haptics.warning()
                            return@Button
                        }
                        dateValidationError = null
                        showTitleError = false
                        haptics.medium()
                        // 저장 경로 — draft 제거 + onDispose 재저장 방지
                        if (!isEdit) draftStore.clear()
                        didSaveOrDiscard = true

                        val startDateTime = "$startDate $startTime"
                        val endDateTime = "$endDate $endTime"
                        onSave(
                            targetMember?.mtIdx ?: 0,
                            title,
                            startDateTime,
                            endDateTime,
                            isAllDay,
                            memo.ifBlank { null },
                            locationName.ifBlank { null },
                            locationLat,
                            locationLng,
                            // Fix #19: alarmTime is sent as display string (e.g., "없음", "5분 전").
                            // This is tightly coupled with the backend which expects these Korean display strings.
                            alarmTime,
                            if (repeatConfig == "반복 안함") null else repeatConfig,
                            editOptionState
                        )
                    },
                    enabled = title.isNotBlank() && !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .padding(top = 8.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (title.isNotBlank()) BrandColors.Primary else BrandColors.Border,
                        contentColor = Color.White
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                    } else {
                        Text(
                            text = if (isEdit) "일정 수정" else "일정 추가",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                }
            }
        }
    }
}
