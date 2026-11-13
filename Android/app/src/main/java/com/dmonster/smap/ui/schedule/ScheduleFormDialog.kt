package com.dmonster.smap.ui.schedule

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SmapSchedule
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.LocalContext
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.components.GroupPickerSheet
import com.dmonster.smap.ui.components.MemberStrip
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.components.SmapTopBar
import androidx.compose.foundation.background
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.WbSunny
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.DpOffset
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
            initialSelectedDateMillis = LocalDate.parse(startDate).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()
        )
        DatePickerDialog(
            onDismissRequest = { showStartDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let {
                        startDate = java.time.Instant.ofEpochMilli(it).atZone(java.time.ZoneOffset.UTC).toLocalDate().format(dateFormatter)
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
            initialSelectedDateMillis = LocalDate.parse(endDate).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()
        )
        DatePickerDialog(
            onDismissRequest = { showEndDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let {
                        endDate = java.time.Instant.ofEpochMilli(it).atZone(java.time.ZoneOffset.UTC).toLocalDate().format(dateFormatter)
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

    // 작성 화면 — 36단계 재설계.
    // 이전: 번호 매긴 4색 구역(1 그룹·2 제목·3 날짜·4 추가) + 색마다 다른 입력칸 테두리.
    // 지금: 회색 바탕 위 "무엇 / 누구 / 언제 / 어디" 흰 묶음, 저장 버튼은 아래 고정.
    val colors = MaterialTheme.colorScheme
    var showGroupPicker by remember { mutableStateOf(false) }
    var dateValidationError by remember { mutableStateOf<String?>(null) }
    if (showGroupPicker) {
        GroupPickerSheet(
            groups = groups,
            selectedGroupId = selectedGroup?.sgtIdx,
            onSelect = { onGroupSelect(it); showGroupPicker = false },
            onDismiss = { showGroupPicker = false }
        )
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = colors.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding() // 키보드 올라올 때 저장 버튼이 가려지지 않도록
        ) {
            SmapTopBar(
                title = if (isEdit) "일정 수정" else "새 일정",
                onBack = null,
                actions = {
                    IconButton(onClick = safeDismiss) {
                        Icon(Icons.Outlined.Close, contentDescription = "닫기")
                    }
                }
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(SmapSpacing.md),
                verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg)
            ) {
                // 무엇
                SmapSection(title = "무엇") {
                    Column(
                        Modifier.padding(SmapSpacing.md),
                        verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
                    ) {
                        SmapTextField(
                            value = title,
                            onValueChange = {
                                title = it
                                if (it.isNotBlank()) showTitleError = false // 입력 시작하면 경고 해제
                            },
                            label = "제목",
                            placeholder = "예: 병원 예약, 학원 픽업",
                            errorText = if (showTitleError) "제목을 입력해 주세요" else null,
                            imeAction = ImeAction.Next,
                            keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) })
                        )
                        SmapTextField(
                            value = memo,
                            onValueChange = { memo = it },
                            label = "메모 (선택)",
                            placeholder = "준비물, 참고할 내용",
                            singleLine = false,
                            imeAction = ImeAction.Done,
                            keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() })
                        )
                    }
                }

                // 누구
                SmapSection(title = "누구의 일정") {
                    SmapListRow(
                        title = selectedGroup?.sgtTitle ?: "그룹을 골라 주세요",
                        subtitle = if (isEdit) "그룹은 바꿀 수 없어요" else "그룹",
                        leading = { SmapRowIcon(Icons.Outlined.Groups) },
                        trailing = when {
                            isEdit -> { { Icon(Icons.Outlined.Lock, contentDescription = null, tint = colors.outline) } }
                            groups.size >= 2 -> { { Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = colors.outline) } }
                            else -> null
                        },
                        onClick = if (isEdit || groups.size < 2) null else ({ showGroupPicker = true })
                    )
                    if (targetCandidates.isNotEmpty()) {
                        SmapRowDivider()
                        MemberStrip(
                            members = targetCandidates,
                            selectedMemberId = targetMember?.mtIdx,
                            currentUserIdx = currentUserId,
                            onSelect = { if (!isEdit) targetMember = it },
                            modifier = Modifier.padding(vertical = SmapSpacing.md)
                        )
                    }
                }

                // 언제
                SmapSection(title = "언제") {
                    SmapListRow(
                        title = "하루 종일",
                        leading = { SmapRowIcon(Icons.Outlined.WbSunny) },
                        trailing = { Switch(checked = isAllDay, onCheckedChange = { isAllDay = it }) },
                        onClick = { isAllDay = !isAllDay }
                    )
                    SmapRowDivider()
                    SmapListRow(
                        title = "시작",
                        leading = { SmapRowIcon(Icons.Outlined.Schedule) },
                        trailing = {
                            ValueChip(formatFormDate(startDate)) { showStartDatePicker = true }
                            if (!isAllDay) ValueChip(startTime) { showStartTimePicker = true }
                        }
                    )
                    SmapRowDivider()
                    SmapListRow(
                        title = "종료",
                        leading = { SmapRowIcon(Icons.Outlined.Flag) },
                        trailing = {
                            ValueChip(formatFormDate(endDate)) { showEndDatePicker = true }
                            if (!isAllDay) ValueChip(endTime) { showEndTimePicker = true }
                        }
                    )
                    SmapRowDivider()
                    // 반복 — 행을 누르면 바로 옆에 목록이 뜬다.
                    Box {
                        SmapListRow(
                            title = "반복",
                            leading = { SmapRowIcon(Icons.Outlined.Repeat) },
                            trailing = { Text(repeatConfig, style = SmapText.secondary, color = colors.onSurfaceVariant) },
                            onClick = { showRepeatSheet = true }
                        )
                        OptionMenu(
                            expanded = showRepeatSheet,
                            options = listOf("반복 안함", "매일", "매주", "매월", "매년"),
                            selected = repeatConfig,
                            onSelect = { repeatConfig = it; haptics.light(); showRepeatSheet = false },
                            onDismiss = { showRepeatSheet = false }
                        )
                    }
                    SmapRowDivider()
                    Box {
                        SmapListRow(
                            title = "알림",
                            leading = { SmapRowIcon(Icons.Outlined.NotificationsNone) },
                            trailing = { Text(alarmTime, style = SmapText.secondary, color = colors.onSurfaceVariant) },
                            onClick = { showAlarmSheet = true }
                        )
                        OptionMenu(
                            expanded = showAlarmSheet,
                            options = listOf("없음", "정시", "5분 전", "10분 전", "15분 전", "30분 전", "1시간 전", "1일 전"),
                            selected = alarmTime,
                            onSelect = { alarmTime = it; haptics.light(); showAlarmSheet = false },
                            onDismiss = { showAlarmSheet = false }
                        )
                    }
                }

                // 어디
                SmapSection(title = "어디") {
                    SmapListRow(
                        title = locationName.ifBlank { "장소 추가" },
                        subtitle = if (locationName.isBlank()) "검색해서 고를 수 있어요 (선택)" else null,
                        leading = { SmapRowIcon(Icons.Outlined.Place) },
                        trailing = {
                            if (locationName.isNotBlank()) {
                                IconButton(onClick = {
                                    locationName = ""
                                    locationLat = null
                                    locationLng = null
                                }) { Icon(Icons.Outlined.Close, contentDescription = "장소 지우기", tint = colors.onSurfaceVariant) }
                            } else {
                                Icon(Icons.Outlined.Search, contentDescription = null, tint = colors.outline)
                            }
                        },
                        onClick = { showLocationSearch = true }
                    )
                }
            }

            // 아래 고정 — 검증 문구 + 저장 버튼
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(colors.surface)
                    .padding(horizontal = SmapSpacing.md, vertical = SmapSpacing.sm)
            ) {
                dateValidationError?.let { error ->
                    Text(
                        text = error,
                        color = colors.error,
                        style = SmapText.caption,
                        modifier = Modifier.padding(start = 4.dp, bottom = SmapSpacing.sm)
                    )
                }
                SmapButton(
                    text = if (isEdit) "저장" else "일정 추가",
                    onClick = {
                        // 실시간 제목 검증 — 저장 시도 시 활성화
                        if (title.isBlank()) {
                            showTitleError = true
                            haptics.warning()
                            return@SmapButton
                        }
                        // Fix #9: Validate start/end dates before saving
                        if (endDate < startDate || (endDate == startDate && endTime <= startTime && !isAllDay)) {
                            dateValidationError = "끝나는 시각이 시작 시각보다 뒤여야 해요"
                            haptics.warning()
                            return@SmapButton
                        }
                        dateValidationError = null
                        showTitleError = false
                        haptics.medium()
                        // 저장 경로 — draft 제거 + onDispose 재저장 방지
                        if (!isEdit) draftStore.clear()
                        didSaveOrDiscard = true

                        onSave(
                            targetMember?.mtIdx ?: 0,
                            title,
                            // 운영 서버(pydantic)는 초가 없는 "yyyy-MM-dd HH:mm" 을 422 로 거절한다 — 초까지 보낸다(iOS 와 같은 형식).
                            "$startDate $startTime:00",
                            "$endDate $endTime:00",
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
                    enabled = !isLoading,
                    isLoading = isLoading,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

/** 시작·종료 행 오른쪽의 눌러서 바꾸는 값(날짜·시각). */
@Composable
private fun ValueChip(text: String, onClick: () -> Unit) {
    Text(
        text,
        style = SmapText.captionBold,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = Modifier
            .clip(RoundedCornerShape(SmapRadius.sm))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    )
}

@Composable
private fun OptionMenu(
    expanded: Boolean,
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    DropdownMenu(expanded = expanded, onDismissRequest = onDismiss, offset = DpOffset(68.dp, 0.dp)) {
        options.forEach { option ->
            DropdownMenuItem(
                text = { Text(option, style = SmapText.body) },
                onClick = { onSelect(option) },
                trailingIcon = if (selected == option) {
                    { Icon(Icons.Filled.Check, contentDescription = "선택됨", tint = MaterialTheme.colorScheme.primary) }
                } else null
            )
        }
    }
}

/** "2026-11-13" → "11월 13일 (금)" */
private fun formatFormDate(raw: String): String =
    runCatching {
        LocalDate.parse(raw).format(DateTimeFormatter.ofPattern("M월 d일 (E)", Locale.KOREAN))
    }.getOrDefault(raw)
