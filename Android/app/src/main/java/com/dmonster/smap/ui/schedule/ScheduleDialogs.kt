package com.dmonster.smap.ui.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import java.time.LocalDate
import java.time.LocalTime
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.graphics.vector.ImageVector

// MARK: - Event Detail Dialog

@Composable
fun EventDetailDialog(
    schedule: SmapSchedule,
    canEdit: Boolean,
    onDismiss: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val status = getScheduleStatus(schedule)
    val startTime = schedule.date?.drop(11)?.take(5) ?: "00:00"
    val endTime = schedule.sstEdate?.drop(11)?.take(5) ?: ""
    val dateStr = schedule.date?.take(10) ?: ""
    
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp)
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState())
                ) {
                    // Header with status
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Box(
                                modifier = Modifier
                                    .background(status.bgColor, RoundedCornerShape(8.dp))
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = status.label,
                                    fontSize = 12.sp,
                                    fontFamily = SuiteFont,
                                    fontWeight = FontWeight.Medium,
                                    color = status.color
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = schedule.title ?: "제목 없음",
                                fontSize = 20.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1F2937)
                            )
                        }
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, "닫기", tint = Color.Gray)
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    // Date & Time
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Schedule,
                            contentDescription = null,
                            tint = BrandColors.Primary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = dateStr,
                                fontSize = 15.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF1F2937)
                            )
                            Text(
                                text = if (schedule.sstAllDay == "Y") "종일" else "$startTime${if (endTime.isNotEmpty()) " - $endTime" else ""}",
                                fontSize = 14.sp,
                                fontFamily = SuiteFont,
                                color = Color.Gray
                            )
                        }
                    }
                    
                    // Location
                    schedule.location?.let { location ->
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = BrandColors.Primary,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = location,
                                fontSize = 15.sp,
                                fontFamily = SuiteFont,
                                color = Color(0xFF1F2937)
                            )
                        }
                    }
                    
                    // Memo
                    schedule.sstMemo?.let { memo ->
                        if (memo.isNotBlank()) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Row(verticalAlignment = Alignment.Top) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.Notes,
                                    contentDescription = null,
                                    tint = BrandColors.Primary,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    text = memo,
                                    fontSize = 15.sp,
                                    fontFamily = SuiteFont,
                                    color = Color(0xFF1F2937)
                                )
                            }
                        }
                    }
                }

                
                if (canEdit) {
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDelete,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = Color.Red
                            )
                        ) {
                            Icon(Icons.Default.Delete, null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("삭제", fontFamily = SuiteFont)
                        }
                        
                        Button(
                            onClick = onEdit,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = BrandColors.Primary
                            )
                        ) {
                            Icon(Icons.Default.Edit, null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("수정", fontFamily = SuiteFont)
                        }
                    }
                }
            }
        }
    }
}

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

    var title by remember { mutableStateOf(schedule?.title ?: "") }
    var isAllDay by remember { mutableStateOf(schedule?.sstAllDay == "Y") }
    var startTime by remember { mutableStateOf(schedule?.date?.drop(11)?.take(5) ?: "09:00") }
    var endTime by remember { mutableStateOf(schedule?.sstEdate?.drop(11)?.take(5) ?: "10:00") }
    var memo by remember { mutableStateOf(schedule?.sstMemo ?: "") }
    var locationName by remember { mutableStateOf(schedule?.location ?: "") }
    var locationLat by remember { mutableStateOf(schedule?.sstLocationLat) }
    var locationLng by remember { mutableStateOf(schedule?.sstLocationLong) }
    var alarmTime by remember { mutableStateOf("없음") }
    var repeatConfig by remember { mutableStateOf(schedule?.repeatDescription ?: "반복 안함") }
    var editOptionState by remember { mutableStateOf(initialEditOption ?: "this") }
    var targetMember by remember { mutableStateOf<SmapGroupMember?>(members.find { it.mtIdx == (schedule?.mtScheduleIdx ?: schedule?.mtIdx) } ?: members.firstOrNull()) }
    
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
                locationLat = place.y
                locationLng = place.x
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
                    startTime = String.format("%02d:%02d", timePickerState.hour, timePickerState.minute)
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
                    endTime = String.format("%02d:%02d", timePickerState.hour, timePickerState.minute)
                    showEndTimePicker = false
                }) { Text("확인") }
            },
            dismissButton = {
                TextButton(onClick = { showEndTimePicker = false }) { Text("취소") }
            },
            text = { TimePicker(state = timePickerState) }
        )
    }

    // Repeat/Alarm Selection Sheets
    if (showRepeatSheet) {
        ModalBottomSheet(onDismissRequest = { showRepeatSheet = false }) {
            val options = listOf("반복 안함", "매일", "매주", "매월", "매년")
            Column(modifier = Modifier.padding(bottom = 32.dp)) {
                Text("반복 설정", modifier = Modifier.padding(16.dp), fontWeight = FontWeight.Bold, fontFamily = SuiteFont)
                options.forEach { option ->
                    ListItem(
                        headlineContent = { Text(option, fontFamily = SuiteFont) },
                        modifier = Modifier.clickable { 
                            repeatConfig = option
                            showRepeatSheet = false
                        }
                    )
                }
            }
        }
    }

    if (showAlarmSheet) {
        ModalBottomSheet(onDismissRequest = { showAlarmSheet = false }) {
            val options = listOf("없음", "정시", "5분 전", "10분 전", "15분 전", "30분 전", "1시간 전", "1일 전")
            Column(modifier = Modifier.padding(bottom = 32.dp)) {
                Text("알림 설정", modifier = Modifier.padding(16.dp), fontWeight = FontWeight.Bold, fontFamily = SuiteFont)
                options.forEach { option ->
                    ListItem(
                        headlineContent = { Text(option, fontFamily = SuiteFont) },
                        modifier = Modifier.clickable { 
                            alarmTime = option
                            showAlarmSheet = false
                        }
                    )
                }
            }
        }
    }

    // UI Colors
    // UI Colors (Updated to white per user request)
    // Removed specific section backgrounds to ensure all are white

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFF2F2F7),
        tonalElevation = 0.dp,
        dragHandle = { BottomSheetDefaults.DragHandle() },
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Color(0xFFF2F2F7),
            tonalElevation = 0.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
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
                        .clickable { onDismiss() }
                        .padding(8.dp),
                    fontFamily = SuiteFont,
                    color = Color.Gray,
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
                    iconColor = Color(0xFFEF4444)
                ) {
                    // Group Selector Dropdown (Simplified for sheet)
                    var expanded by remember { mutableStateOf(false) }
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedCard(
                            onClick = { if (!isEdit) expanded = true },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.outlinedCardColors(
                                containerColor = if (isEdit) Color(0xFFF2F2F7) else Color.White
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
                                Text(
                                    text = selectedGroup?.sgtTitle ?: "그룹 선택",
                                    fontFamily = SuiteFont,
                                    fontSize = 15.sp,
                                    color = Color.Black
                                )
                                Icon(Icons.Default.KeyboardArrowDown, null, tint = Color.Gray)
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
                        items(members) { member ->
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
                    iconColor = Color(0xFF3B82F6)
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
                        onValueChange = { title = it },
                        placeholder = { Text("일정 제목을 입력하세요", fontFamily = SuiteFont) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = Color(0xFF3B82F6),
                            unfocusedBorderColor = Color(0xFF3B82F6).copy(alpha = 0.5f)
                        )
                    )
                    Text(
                        text = "예) 팀 회의, 프로젝트 미팅 등",
                        fontSize = 12.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray,
                        modifier = Modifier.padding(top = 4.dp)
                    )

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
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        maxLines = 5,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = Color.Gray.copy(alpha = 0.2f),
                            unfocusedBorderColor = Color.Gray.copy(alpha = 0.2f)
                        )
                    )
                }

                // Section 3: Date & Time
                ScheduleSection(
                    number = "3",
                    title = "날짜 및 시간",
                    bgColor = Color.White,
                    iconColor = Color(0xFF22C55E)
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
                                checkedTrackColor = Color(0xFF22C55E)
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
                        SelectionField(
                            label = "반복",
                            value = repeatConfig,
                            onClick = { showRepeatSheet = true },
                            modifier = Modifier.weight(1f)
                        )
                        SelectionField(
                            label = "알림",
                            value = alarmTime,
                            onClick = { showAlarmSheet = true },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                // Section 4: Additional Settings
                ScheduleSection(
                    number = "4",
                    title = "추가 설정",
                    bgColor = Color.White,
                    iconColor = Color(0xFFF59E0B)
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
                            Icon(Icons.Default.PinDrop, null, tint = Color(0xFFF59E0B), modifier = Modifier.size(20.dp))
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

            // Save Button
            Button(
                    onClick = {
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
                        containerColor = if (title.isNotBlank()) BrandColors.Primary else Color(0xFFD1D5DB),
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
}

@Composable
fun ScheduleSection(
    number: String,
    title: String,
    bgColor: Color,
    iconColor: Color,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color.Gray.copy(alpha = 0.1f)),
        tonalElevation = 0.dp,
        shadowElevation = 2.dp
    ) {
        Column(
            modifier = Modifier.padding(16.dp).background(Color.White)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(bottom = 16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .background(iconColor, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = number,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = SuiteFont
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = title,
                    fontSize = 17.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
            }
            content()
        }
    }
}

@Composable
fun MemberItem(
    member: SmapGroupMember,
    isSelected: Boolean,
    isEdit: Boolean = false,
    onClick: () -> Unit
) {
    // Resolve avatar URL
    val imageUrl = remember(member.mtFile1) {
        if (!member.mtFile1.isNullOrBlank()) {
            when {
                member.mtFile1.startsWith("http") -> member.mtFile1
                member.mtFile1.startsWith("/images/") -> "https://api3.smap.site${member.mtFile1}"
                member.mtFile1.startsWith("/") -> "https://api3.smap.site/images${member.mtFile1}"
                else -> "https://api3.smap.site/images/${member.mtFile1}"
            }
        } else null
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clickable(onClick = onClick)
            .alpha(if (isEdit && !isSelected) 0.5f else 1.0f)
    ) {
        Box(
            modifier = Modifier.size(60.dp),
            contentAlignment = Alignment.Center
        ) {
            // Layer 1: Avatar / Placeholder
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .background(Color.Gray.copy(alpha = 0.1f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = null,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(Icons.Default.Person, null, tint = Color.Gray, modifier = Modifier.size(28.dp))
                }
            }
            
            // Layer 2: Selection Border (Only shown when selected)
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .border(2.dp, Color(0xFFEF4444), CircleShape)
                )
            }
            
            // Layer 3: Check Icon (Only shown when selected, top-most layer)
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(bottom = 2.dp, end = 2.dp)
                        .size(22.dp)
                        .background(Color.White, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = member.displayName,
            fontSize = 12.sp,
            fontFamily = SuiteFont,
            color = if (isSelected) Color(0xFFEF4444) else Color.Gray,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(60.dp),
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun TimeChip(text: String, onClick: () -> Unit = {}) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color.Gray.copy(alpha = 0.1f)),
        tonalElevation = 0.dp,
        shadowElevation = 1.dp
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            fontFamily = SuiteFont,
            fontSize = 14.sp,
            color = Color.Black
        )
    }
}

@Composable
fun SelectionField(
    label: String,
    value: String,
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Text(text = label, fontSize = 12.sp, fontFamily = SuiteFont, color = Color.Gray)
        Spacer(modifier = Modifier.height(4.dp))
        Surface(
            onClick = onClick,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
            color = Color.White,
            border = BorderStroke(1.dp, Color.Gray.copy(alpha = 0.1f)),
            tonalElevation = 0.dp,
            shadowElevation = 1.dp
        ) {
            Row(
                modifier = Modifier
                    .padding(horizontal = 12.dp, vertical = 10.dp)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = value, fontSize = 14.sp, fontFamily = SuiteFont, color = Color.Black)
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
            }
        }
    }
}

// MARK: - Delete Confirm Dialog

@Composable
fun DeleteScheduleDialog(
    schedule: SmapSchedule,
    isRepeat: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (deleteOption: String) -> Unit,
    isLoading: Boolean
) {
    var selectedOption by remember { mutableStateOf("this") }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = Color.Red,
                modifier = Modifier.size(32.dp)
            )
        },
        title = {
            Text(
                text = "일정 삭제",
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        },
        text = {
            Column {
                Text(
                    text = "'${schedule.title}'을(를) 삭제하시겠습니까?",
                    fontFamily = SuiteFont,
                    textAlign = TextAlign.Center
                )
                
                if (isRepeat) {
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    listOf(
                        "this" to "이 일정만",
                        "future" to "이후 모든 일정",
                        "all" to "모든 반복 일정"
                    ).forEach { (value, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { selectedOption = value }
                                .padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = selectedOption == value,
                                onClick = { selectedOption = value }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = label,
                                fontFamily = SuiteFont,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(selectedOption) },
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("삭제", fontFamily = SuiteFont)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("취소", fontFamily = SuiteFont)
            }
        }
    )
}

// MARK: - Recurring Schedule Action Dialog

@Composable
fun RecurringScheduleActionDialog(
    title: String,
    message: String,
    thisOnlyLabel: String,
    allLabel: String,
    isDestructive: Boolean = false,
    onThisOnly: () -> Unit,
    onAll: () -> Unit,
    onDismiss: () -> Unit
) {
    val buttonColor = if (isDestructive) Color.Red else BrandColors.Primary
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = title,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = message,
                    fontFamily = SuiteFont,
                    textAlign = TextAlign.Center,
                    color = Color.Gray
                )
            }
        },
        confirmButton = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // "이 일정만" option
                Button(
                    onClick = onThisOnly,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = buttonColor
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = thisOnlyLabel,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium
                    )
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // "모든 반복 일정" option
                Button(
                    onClick = onAll,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = buttonColor.copy(alpha = 0.8f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = allLabel,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium
                    )
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Cancel button
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "취소",
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                }
            }
        },
        dismissButton = {}
    )
}

