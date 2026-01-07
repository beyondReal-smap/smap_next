package com.dmonster.smap.ui.schedule

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
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.*

// MARK: - Schedule Status

enum class ScheduleStatus(val label: String, val color: Color, val bgColor: Color) {
    UPCOMING("예정", Color(0xFF2563EB), Color(0xFFDBEAFE)),
    ONGOING("진행중", Color(0xFF16A34A), Color(0xFFDCFCE7)),
    COMPLETED("완료", Color(0xFF6B7280), Color(0xFFF3F4F6))
}

fun getScheduleStatus(schedule: SmapSchedule): ScheduleStatus {
    val now = LocalDateTime.now()
    val dateStr = schedule.date ?: return ScheduleStatus.UPCOMING
    
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
            now.isBefore(startTime) -> ScheduleStatus.UPCOMING
            now.isAfter(endTime) -> ScheduleStatus.COMPLETED
            else -> ScheduleStatus.ONGOING
        }
    } catch (e: Exception) {
        ScheduleStatus.UPCOMING
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
                        fontSize = 16.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1F2937)
                    )
                    Text(
                        text = "오늘로 이동",
                        fontSize = 11.sp,
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
                            fontSize = 11.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Medium,
                            color = when (index) {
                                0 -> Color.Red
                                6 -> Color.Blue
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
                                    .height(36.dp)
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
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
            color = when {
                isSelected -> Color.White
                isToday -> BrandColors.Primary
                else -> Color(0xFF374151)
            },
            lineHeight = 14.sp // Remove extra line height
        )
        
        if (hasEvent) {
            Box(
                modifier = Modifier
                    .offset(y = (-2).dp) // Move dot closer to the number
                    .size(4.dp)
                    .clip(CircleShape)
                    .background(if (isSelected) Color.White else Color.Red)
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
    modifier: Modifier = Modifier
) {
    val status = getScheduleStatus(schedule)
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
                    fontSize = 22.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black,
                    lineHeight = 22.sp
                )
                if (endTime.isNotEmpty() && schedule.sstAllDay != "Y") {
                    Text(
                        text = "~ $endTime",
                        fontSize = 12.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray,
                        lineHeight = 12.sp
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
                            tint = Color(0xFF3B82F6),
                            modifier = Modifier.size(10.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(
                            text = repeatText ?: "반복",
                            fontSize = 11.sp,
                            fontFamily = SuiteFont,
                            color = Color(0xFF3B82F6),
                            lineHeight = 11.sp
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
                            model = if (photo.startsWith("http")) photo else "https://nextstep.smap.site$photo",
                            contentDescription = null,
                            modifier = Modifier
                                .size(16.dp)
                                .clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .size(16.dp)
                                .clip(CircleShape)
                                .background(Color.Gray.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = Color.Gray,
                                modifier = Modifier.size(10.dp)
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = schedule.validMemberName,
                        fontSize = 13.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF00148C)
                    )
                    
                    Text(
                        text = " · family",
                        fontSize = 12.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                }
                
                // Title
                Text(
                    text = schedule.displayTitle,
                    fontSize = 18.sp,
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
                                modifier = Modifier.size(11.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = location,
                                fontSize = 12.sp,
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
                        fontSize = 10.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = status.color
                    )
                }
                
                // Menu Button with Dropdown
                Box {
                    IconButton(
                        onClick = { showMenu = true },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.MoreHoriz,
                            contentDescription = "메뉴",
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
                                        contentDescription = null,
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
                                        contentDescription = null,
                                        tint = Color.Red,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("삭제", fontFamily = SuiteFont, color = Color.Red)
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
            .background(Color(0xFFF3F4F6))
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
            contentDescription = null,
            tint = Color.Gray,
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
                        color = Color(0xFF1F2937),
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

@Composable
fun ScheduleEmptyState(
    onAddClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 60.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.CalendarToday, // Using a similar icon as calendar.badge.plus isn't directly in Material Icons default
            contentDescription = null,
            tint = Color.Gray.copy(alpha = 0.2f),
            modifier = Modifier.size(64.dp)
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = "등록된 일정이 없습니다",
            fontSize = 16.sp,
            fontFamily = SuiteFont,
            color = Color.Gray
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(
            onClick = onAddClick,
            colors = ButtonDefaults.buttonColors(
                containerColor = BrandColors.Primary.copy(alpha = 0.1f),
                contentColor = BrandColors.Primary
            ),
            shape = RoundedCornerShape(20.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 10.dp),
            elevation = null
        ) {
            Text(
                text = "일정 추가하기",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
fun DateHeader(
    date: LocalDate,
    scheduleCount: Int = 0,
    modifier: Modifier = Modifier
) {
    val formatter = DateTimeFormatter.ofPattern("M월 d일 EEEE", Locale.KOREAN)
    
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF00148C)),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = date.format(formatter),
                fontSize = 18.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "${scheduleCount}개의 일정",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                color = Color.White.copy(alpha = 0.8f)
            )
        }
    }
}
