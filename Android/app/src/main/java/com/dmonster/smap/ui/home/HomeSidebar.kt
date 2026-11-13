package com.dmonster.smap.ui.home

import com.dmonster.smap.BuildConfig
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.AdaptiveColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SemanticColors
import com.dmonster.smap.ui.theme.SuiteFont
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@Composable
fun HomeSidebar(
    groups: List<SmapGroup>,
    selectedGroup: SmapGroup?,
    onGroupSelected: (SmapGroup) -> Unit,
    calendarDays: List<Pair<String, String>>, // (yyyy-MM-dd, D)
    selectedDate: String,
    onDateSelected: (String) -> Unit,
    members: List<SmapGroupMember>,
    onMemberSelected: (Int) -> Unit,
    currentUserIdx: Int? = null,
    getMemberStats: (Int) -> MemberStats = { MemberStats(0, 0, 0) }
) {
    var isGroupSelectorExpanded by remember { mutableStateOf(false) }
    val sidebarBackground = AdaptiveColors.SidebarBackgroundLight
    val haptics = rememberSmapHaptics()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(sidebarBackground)
    ) {
        // Sidebar Header - matching iOS "멤버 조회"
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .padding(top = 20.dp, start = 24.dp, end = 24.dp, bottom = 16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(BrandColors.Primary, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Groups,
                    contentDescription = "멤버 조회",
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "멤버 조회",
                    fontSize = 21.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = BrandColors.TextPrimary
                )
                Text(
                    text = "멤버를 선택해보세요",
                    fontSize = 15.sp,
                    fontFamily = SuiteFont,
                    color = BrandColors.TextSecondary
                )
            }
        }

        // Scrollable Content
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            // Group Selector Section - Card style matching iOS
            item {
                SectionCard {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SectionHeader(title = "그룹 목록", color = SemanticColors.IndicatorGroup)
                        
                        Box {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(BrandColors.InputBackground)
                                    .clickable { isGroupSelectorExpanded = true }
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = selectedGroup?.sgtTitle ?: "그룹 선택",
                                    fontFamily = SuiteFont,
                                    fontSize = 17.sp
                                )
                                Icon(
                                    imageVector = Icons.Filled.KeyboardArrowDown,
                                    contentDescription = "그룹 선택",
                                    tint = BrandColors.TextSecondary
                                )
                            }
                            
                            DropdownMenu(
                                expanded = isGroupSelectorExpanded,
                                onDismissRequest = { isGroupSelectorExpanded = false },
                                modifier = Modifier.fillMaxWidth(0.7f)
                            ) {
                                groups.forEach { group ->
                                    DropdownMenuItem(
                                        text = { Text(text = group.sgtTitle ?: "이름 없음", fontFamily = SuiteFont) },
                                        onClick = {
                                            haptics.light()
                                            onGroupSelected(group)
                                            isGroupSelectorExpanded = false
                                        },
                                        trailingIcon = if (selectedGroup?.sgtIdx == group.sgtIdx) {
                                            { Icon(Icons.Filled.Check, null, tint = BrandColors.Primary) }
                                        } else null
                                    )
                                }
                            }
                        }
                    }
                }
            }
            
            // Date Selector Section - 14 days forward matching iOS
            item {
                SectionCard {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SectionHeader(title = "날짜 선택", color = SemanticColors.IndicatorDate)
                        
                        // 14일 고정 → LazyRow 중첩 대신 Row + horizontalScroll 로 스크롤 충돌 제거
                        val dateScrollState = rememberScrollState()
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier
                                .horizontalScroll(dateScrollState)
                                .padding(vertical = 4.dp)
                        ) {
                            calendarDays.forEach { (fullDate, dayDisplay) ->
                                key(fullDate) {
                                    val isSelected = fullDate == selectedDate
                                    val dayOfWeek = getDayOfWeek(fullDate)

                                    Column(
                                        modifier = Modifier
                                            .width(50.dp)
                                            .height(60.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(if (isSelected) BrandColors.Primary else BrandColors.InputBackground)
                                            .clickable {
                                                haptics.light()
                                                onDateSelected(fullDate)
                                            }
                                            .semantics {
                                                contentDescription = "$fullDate $dayOfWeek"
                                                if (isSelected) selected = true
                                                role = Role.Button
                                            },
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy((-3).dp, Alignment.CenterVertically)
                                    ) {
                                        Text(
                                            text = dayOfWeek,
                                            fontSize = 11.sp,
                                            color = if (isSelected) Color.White.copy(alpha = 0.8f) else BrandColors.TextSecondary,
                                            fontFamily = SuiteFont
                                        )
                                        Text(
                                            text = dayDisplay,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelected) Color.White else Color.Black,
                                            fontFamily = SuiteFont
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Member List Section
            item {
                SectionCard {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(bottom = 5.dp)
                        ) {
                            Box(modifier = Modifier.size(8.dp).background(SemanticColors.IndicatorMember, CircleShape))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "멤버 목록",
                                fontSize = 17.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.weight(1f))
                            Text(
                                text = "${members.size}명",
                                fontSize = 14.sp,
                                color = BrandColors.TextSecondary,
                                fontFamily = SuiteFont,
                                modifier = Modifier
                                    .background(BrandColors.TextSecondary.copy(0.1f), CircleShape)
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                        
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            members.forEach { member ->
                                MemberVerticalItem(
                                    member = member,
                                    isSelf = member.mtIdx == currentUserIdx,
                                    stats = getMemberStats(member.mtIdx),
                                    onClick = {
                                        haptics.light()
                                        onMemberSelected(member.mtIdx)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionCard(content: @Composable () -> Unit) {
    Card(
        modifier = Modifier
            .padding(horizontal = 20.dp, vertical = 8.dp)
            .fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        content()
    }
}

@Composable
fun SectionHeader(title: String, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(bottom = 2.dp)
    ) {
        Box(modifier = Modifier.size(8.dp).background(color, CircleShape))
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = title,
            fontSize = 17.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun MemberVerticalItem(
    member: SmapGroupMember,
    isSelf: Boolean = false,
    stats: MemberStats,
    onClick: () -> Unit
) {
    val isSelected = member.isSelected

    val backgroundColor = if (isSelected) BrandColors.Primary.copy(alpha = 0.05f) else Color.White.copy(alpha = 0.6f)
    val borderColor = if (isSelected) BrandColors.Primary.copy(alpha = 0.3f) else Color.Transparent

    val accessibilityName = if (isSelf) "${member.displayName} (나)" else member.displayName

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .border(1.dp, borderColor, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(12.dp)
            .semantics {
                contentDescription = "$accessibilityName, 완료 ${stats.completed}, 진행 ${stats.ongoing}, 예정 ${stats.upcoming}"
                if (isSelected) selected = true
                role = Role.Button
            },
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Avatar with selection border
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(BrandColors.TextSecondary.copy(0.2f))
                .border(
                    width = if (isSelected) 2.5.dp else 0.dp,
                    color = if (isSelected) BrandColors.Primary else Color.Transparent,
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            if (!member.mtFile1.isNullOrBlank()) {
                val imageUrl = when {
                    member.mtFile1.startsWith("http") -> member.mtFile1
                    member.mtFile1.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}${member.mtFile1}"
                    member.mtFile1.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images${member.mtFile1}"
                    else -> "${BuildConfig.IMAGE_BASE_URL}/images/${member.mtFile1}"
                }
                if (BuildConfig.DEBUG) {
                    Log.d("HomeSidebar", "🖼️ Loading avatar for ${member.displayName}: $imageUrl")
                }
                
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(imageUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = member.displayName,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                    onState = { state ->
                        if (state is coil.compose.AsyncImagePainter.State.Error && BuildConfig.DEBUG) {
                            Log.e("HomeSidebar", "❌ Coil Error for ${member.displayName}: ${state.result.throwable.message}")
                        }
                    }
                )
            } else {
                Icon(Icons.Filled.Person, contentDescription = "프로필", tint = BrandColors.TextSecondary)
            }
        }
        
        Spacer(modifier = Modifier.width(12.dp))
        
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy((-6).dp)
        ) {
            Text(
                text = if (isSelf) "${member.displayName} (나)" else member.displayName,
                fontSize = 17.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = SuiteFont
            )
            
            // Schedule Stats Row — iOS SemanticColors 와 동일 매핑
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatItemView(label = "완료", count = stats.completed, color = SemanticColors.StatCompleted)
                StatItemView(label = "진행", count = stats.ongoing, color = SemanticColors.StatOngoing)
                StatItemView(label = "예정", count = stats.upcoming, color = SemanticColors.StatUpcoming)
            }
        }
    }
}

@Composable
private fun StatItemView(label: String, count: Int, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            fontSize = 10.sp,
            color = BrandColors.TextSecondary,
            fontFamily = SuiteFont
        )
        Spacer(modifier = Modifier.width(2.dp))
        Text(
            text = count.toString(),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            fontFamily = SuiteFont
        )
    }
}

private fun getDayOfWeek(dateStr: String): String {
    return try {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.KOREA)
        val dayFormat = SimpleDateFormat("E", Locale.KOREA)
        val date = dateFormat.parse(dateStr)
        date?.let { dayFormat.format(it) } ?: ""
    } catch (e: Exception) {
        ""
    }
}
