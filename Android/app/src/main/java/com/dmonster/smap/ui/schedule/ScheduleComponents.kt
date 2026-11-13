package com.dmonster.smap.ui.schedule

import androidx.compose.ui.semantics.semantics
import androidx.compose.material.icons.outlined.EventAvailable
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.components.SmapEmptyState
import com.dmonster.smap.BuildConfig
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SemanticColors
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.responsiveSp
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.*

// MARK: - Schedule Status

enum class ScheduleStatusUI(val label: String, val color: Color, val bgColor: Color) {
    UPCOMING("예정", SemanticColors.StatUpcoming, SemanticColors.StatUpcoming.copy(alpha = 0.12f)),
    ONGOING("진행중", SemanticColors.StatCompleted, SemanticColors.StatCompleted.copy(alpha = 0.12f)),
    COMPLETED("완료", Color(0xFF6B7280), Color(0xFFF3F4F6))
}

fun getScheduleStatusUI(schedule: SmapSchedule): ScheduleStatusUI {
    val now = LocalDateTime.now()
    val dateStr = schedule.date ?: return ScheduleStatusUI.UPCOMING
    
    return try {
        val startTime = if (dateStr.length >= 16) {
            LocalDateTime.parse(dateStr.take(16), DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
        } else {
            LocalDate.parse(dateStr.take(10)).atStartOfDay()
        }
        
        val endTimeStr = schedule.sstEdate
        val endTime = if (!endTimeStr.isNullOrEmpty() && endTimeStr.length >= 16) {
            LocalDateTime.parse(endTimeStr.take(16), DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
        } else {
            startTime.plusHours(1)
        }
        
        when {
            now.isBefore(startTime) -> ScheduleStatusUI.UPCOMING
            now.isAfter(endTime) -> ScheduleStatusUI.COMPLETED
            else -> ScheduleStatusUI.ONGOING
        }
    } catch (e: Exception) {
        ScheduleStatusUI.UPCOMING
    }
}

// MARK: - Month Calendar

@Composable
fun MonthCalendar(
    currentMonth: YearMonth,
    selectedDate: LocalDate,
    eventDates: Set<LocalDate>,
    onDateSelect: (LocalDate) -> Unit,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit,
    onToday: () -> Unit,
    modifier: Modifier = Modifier
) {
    val today = LocalDate.now()
    val daysInMonth = currentMonth.lengthOfMonth()
    val firstDayOfWeek = currentMonth.atDay(1).dayOfWeek.value % 7
    
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onPreviousMonth) {
                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = "이전 달",
                        tint = Color.Gray
                    )
                }
                
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${currentMonth.year}년 ${currentMonth.monthValue}월",
                        fontSize = 18.responsiveSp(),
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = BrandColors.TextPrimary
                    )
                    Text(
                        text = "오늘로 이동",
                        fontSize = 13.sp,
                        fontFamily = SuiteFont,
                        color = BrandColors.Primary,
                        modifier = Modifier.clickable(onClick = onToday)
                    )
                }
                
                IconButton(onClick = onNextMonth) {
                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = "다음 달",
                        tint = Color.Gray
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(4.dp))
            
            // Weekday Headers
            Row(modifier = Modifier.fillMaxWidth()) {
                listOf("일", "월", "화", "수", "목", "금", "토").forEachIndexed { index, day ->
                    Box(
                        modifier = Modifier.weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = day,
                            fontSize = 13.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Medium,
                            color = when (index) {
                                0 -> SemanticColors.CalendarSunday
                                6 -> SemanticColors.CalendarSaturday
                                else -> Color.Gray
                            }
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(4.dp))
            
            // Calendar Grid
            val totalCells = firstDayOfWeek + daysInMonth
            val rows = (totalCells + 6) / 7
            
            Column {
                for (row in 0 until rows) {
                    Row(modifier = Modifier.fillMaxWidth()) {
                        for (col in 0 until 7) {
                            val cellIndex = row * 7 + col
                            val dayNumber = cellIndex - firstDayOfWeek + 1
                            
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(40.dp)
                                    .padding(1.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                if (dayNumber in 1..daysInMonth) {
                                    val date = currentMonth.atDay(dayNumber)
                                    val isSelected = date == selectedDate
                                    val isToday = date == today
                                    val hasEvent = date in eventDates
                                    
                                    CalendarDay(
                                        day = dayNumber,
                                        isSelected = isSelected,
                                        isToday = isToday,
                                        hasEvent = hasEvent,
                                        onClick = { onDateSelect(date) }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CalendarDay(
    day: Int,
    isSelected: Boolean,
    isToday: Boolean,
    hasEvent: Boolean,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    isSelected -> BrandColors.Primary
                    isToday -> BrandColors.Primary.copy(alpha = 0.1f)
                    else -> Color.Transparent
                }
            )
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = day.toString(),
            fontSize = 16.sp,
            fontFamily = SuiteFont,
            fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
            color = when {
                isSelected -> Color.White
                isToday -> BrandColors.Primary
                else -> BrandColors.TextPrimary
            },
            lineHeight = 14.sp // Remove extra line height
        )
        
        if (hasEvent) {
            Box(
                modifier = Modifier
                    .offset(y = (-2).dp) // Move dot closer to the number
                    .size(4.dp)
                    .clip(CircleShape)
                    .background(if (isSelected) Color.White else AccentColors.NotificationDot)
            )
        }
    }
}

// MARK: - Event Card

@Composable
fun EventCard(
    schedule: SmapSchedule,
    onClick: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
    canManage: Boolean = true
) {
    val status = getScheduleStatusUI(schedule)
    var showMenu by remember { mutableStateOf(false) }
    
    // Parse time from date string (format: 2026-01-04T10:00:00)
    val startTime = schedule.date?.let {
        if (it.length >= 16) it.substring(11, 16) else "00:00"
    } ?: "00:00"
    val endTime = schedule.sstEdate?.let {
        if (it.length >= 16) it.substring(11, 16) else ""
    } ?: ""
    
    val repeatText = schedule.repeatDescription
    val isRecurring = schedule.isRecurring
    
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Left: Time Block
            Column(
                modifier = Modifier.width(72.dp),
                horizontalAlignment = Alignment.Start,
                verticalArrangement = Arrangement.spacedBy(0.dp)
            ) {
                Text(
                    text = if (schedule.sstAllDay == "Y") "종일" else startTime,
                    fontSize = 24.responsiveSp(),
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black,
                    lineHeight = 24.sp
                )
                if (endTime.isNotEmpty() && schedule.sstAllDay != "Y") {
                    Text(
                        text = "~ $endTime",
                        fontSize = 13.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray,
                        lineHeight = 13.sp
                    )
                }
                
                if (isRecurring) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(top = 4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Repeat,
                            contentDescription = null,
                            tint = SemanticColors.IndicatorMember,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(
                            text = repeatText ?: "반복",
                            fontSize = 12.sp,
                            fontFamily = SuiteFont,
                            color = SemanticColors.IndicatorMember,
                            lineHeight = 12.sp
                        )
                    }
                }
            }
            
            // Middle: Member Info + Content
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 8.dp),
                verticalArrangement = Arrangement.spacedBy(0.dp)
            ) {
                // Member Info Row
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Avatar
                    val photo = schedule.validMemberPhoto
                    if (!photo.isNullOrEmpty()) {
                        AsyncImage(
                            model = if (photo.startsWith("http")) photo else "${BuildConfig.WEB_BASE_URL}$photo",
                            contentDescription = null,
                            modifier = Modifier
                                .size(20.dp)
                                .clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .size(20.dp)
                                .clip(CircleShape)
                                .background(Color.Gray.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = Color.Gray,
                                modifier = Modifier.size(12.dp)
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = schedule.validMemberName,
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = BrandColors.PrimaryDark
                    )
                    
                    // Fix #14: Removed hardcoded " · family" text
                }
                
                // Title
                Text(
                    text = schedule.displayTitle,
                    fontSize = 20.responsiveSp(),
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = Color.Black,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                // Location
                schedule.location?.let { location ->
                    if (location.isNotEmpty()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = Color.Gray,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = location,
                                fontSize = 13.sp,
                                fontFamily = SuiteFont,
                                color = Color.Gray,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
            
            // Right: Status Badge + Menu
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                // Status Badge
                Box(
                    modifier = Modifier
                        .background(status.color.copy(alpha = 0.1f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = status.label,
                        fontSize = 11.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = status.color
                    )
                }
                
                // Menu Button with Dropdown
                if (canManage) {
                    Box {
                        IconButton(
                            onClick = { showMenu = true },
                            // 터치영역 48dp 확보(아이콘 시각 크기 18dp 유지)
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.MoreHoriz,
                                contentDescription = "일정 메뉴",
                                tint = Color.Gray,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        
                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Edit,
                                            contentDescription = "수정",
                                            tint = Color.Gray,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("수정", fontFamily = SuiteFont)
                                    }
                                },
                                onClick = {
                                    showMenu = false
                                    onEdit()
                                }
                            )
                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = "삭제",
                                            tint = BrandColors.Error,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("삭제", fontFamily = SuiteFont, color = BrandColors.Error)
                                    }
                                },
                                onClick = {
                                    showMenu = false
                                    onDelete()
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Group Selector

@Composable
fun GroupSelectorButton(
    selectedGroup: SmapGroup?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(BrandColors.InputBackground)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = selectedGroup?.sgtTitle ?: "전체",
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            color = Color.Black
        )
        Icon(
            imageVector = Icons.Default.KeyboardArrowDown,
            contentDescription = "그룹 선택",
            tint = BrandColors.TextSecondary,
            modifier = Modifier.size(18.dp)
        )
    }
}

@Composable
fun GroupSelectorDropdown(
    groups: List<SmapGroup>,
    selectedGroup: SmapGroup?,
    onGroupSelect: (SmapGroup) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(modifier = Modifier.padding(8.dp)) {
            groups.forEach { group ->
                val isSelected = group.sgtIdx == selectedGroup?.sgtIdx
                
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isSelected) BrandColors.Primary.copy(alpha = 0.1f) else Color.Transparent)
                        .clickable { onGroupSelect(group) }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(BrandColors.Primary.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Groups,
                            contentDescription = null,
                            tint = BrandColors.Primary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    
                    Spacer(modifier = Modifier.width(12.dp))
                    
                    Text(
                        text = group.sgtTitle ?: "이름 없음",
                        fontSize = 15.sp,
                        fontFamily = SuiteFont,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        color = BrandColors.TextPrimary,
                        modifier = Modifier.weight(1f)
                    )
                    
                    if (isSelected) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = null,
                            tint = BrandColors.Primary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Empty State

/**
 * 선택한 날짜에 일정이 없을 때 — 공용 빈 상태(SmapEmptyState)로 다른 화면과 같은 모양을 쓴다.
 */
@Composable
fun ScheduleEmptyState(
    onAddClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    SmapEmptyState(
        title = "이 날은 일정이 없어요",
        icon = Icons.Outlined.EventAvailable,
        actionText = "일정 추가",
        onAction = onAddClick,
        modifier = modifier.padding(vertical = 24.dp)
    )
}

/**
 * 달력 아래 선택 날짜 제목 줄 — "11월 13일 금요일 · 일정 2개".
 *
 * 이전에는 남색 큰 카드(그림자 포함)가 날짜 한 줄을 보여 주느라 달력만큼 눈에 띄었다.
 * 목록 섹션 제목 수준의 무게로 줄여 일정 카드가 주인공이 되게 했다.
 */
@Composable
fun DateHeader(
    date: LocalDate,
    scheduleCount: Int = 0,
    modifier: Modifier = Modifier
) {
    val formatter = DateTimeFormatter.ofPattern("M월 d일 EEEE", Locale.KOREA)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = SmapSpacing.screenHorizontal)
            .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = date.format(formatter),
            style = SmapText.headline,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )
        if (scheduleCount > 0) {
            Text(
                text = "일정 ${scheduleCount}개",
                style = SmapText.captionMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
