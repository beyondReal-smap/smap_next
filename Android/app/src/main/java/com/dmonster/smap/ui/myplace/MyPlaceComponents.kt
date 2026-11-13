package com.dmonster.smap.ui.myplace

import com.dmonster.smap.BuildConfig
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SavedLocation
import com.dmonster.smap.ui.components.SmapBanner
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.AdaptiveColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SemanticColors
import com.dmonster.smap.ui.theme.SuiteFont

// MARK: - Member Sidebar

@Composable
fun MemberSidebar(
    groups: List<SmapGroup>,
    selectedGroup: SmapGroup?,
    members: List<SmapGroupMember>,
    selectedMember: SmapGroupMember?,
    currentUserIdx: Int?,
    locations: List<SavedLocation>,
    onGroupSelect: (SmapGroup) -> Unit,
    onMemberSelect: (SmapGroupMember) -> Unit,
    onLocationClick: (SavedLocation) -> Unit,
    onLocationNotification: (SavedLocation) -> Unit,
    canManageLocation: (SavedLocation) -> Boolean,
    canAddLocation: Boolean,
    onClose: () -> Unit,
    isLoading: Boolean = false,
    isLoadingLocations: Boolean = false,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxHeight()
            .width(320.dp),
        shape = RoundedCornerShape(topEnd = 24.dp, bottomEnd = 24.dp),
        color = AdaptiveColors.SidebarBackgroundLight,
        shadowElevation = 8.dp
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(top = 20.dp, start = 24.dp, end = 24.dp, bottom = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(BrandColors.Primary, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = "장소 관리",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "장소 관리",
                        fontSize = 20.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black
                    )
                    Text(
                        text = "멤버를 선택해보세요",
                        fontSize = 15.sp,
                        fontFamily = SuiteFont,
                        color = BrandColors.TextSecondary
                    )
                }
            }

            // Group Selection Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .background(Color.White, RoundedCornerShape(16.dp))
                    .border(1.dp, Color.Gray.copy(alpha = 0.1f), RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(bottom = 12.dp)
                ) {
                    Box(modifier = Modifier.size(8.dp).background(SemanticColors.IndicatorGroup, CircleShape))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "그룹 선택",
                        fontSize = 16.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black
                    )
                }

                var expanded by remember { mutableStateOf(false) }
                Box(modifier = Modifier.fillMaxWidth()) {
                    OutlinedCard(
                        onClick = { expanded = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.outlinedCardColors(containerColor = Color.White),
                        border = CardDefaults.outlinedCardBorder().copy(width = 0.5.dp)
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
                                fontSize = 17.sp,
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
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Member List Section (Horizontal Scroll)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .background(Color.White, RoundedCornerShape(16.dp))
                    .border(1.dp, Color.Gray.copy(alpha = 0.1f), RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(8.dp).background(SemanticColors.IndicatorMember, CircleShape))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "멤버 선택",
                            fontSize = 16.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            color = Color.Black
                        )
                    }
                    
                    Box(
                        modifier = Modifier
                            .background(Color.Gray.copy(alpha = 0.1f), CircleShape)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "${members.size}명",
                            fontSize = 14.sp,
                            fontFamily = SuiteFont,
                            color = Color.Gray
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                if (isLoading) {
                    Box(modifier = Modifier.fillMaxWidth().height(80.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), color = BrandColors.Primary)
                    }
                } else {
                    // Horizontal Member List
                    androidx.compose.foundation.lazy.LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(horizontal = 4.dp)
                    ) {
                        items(members.size) { index ->
                            val member = members[index]
                            MemberAvatarItem(
                                member = member,
                                isSelected = member.mtIdx == selectedMember?.mtIdx,
                                isSelf = member.mtIdx == currentUserIdx,
                                onClick = { onMemberSelect(member) }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Location List Section (Selected Member's Locations)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 20.dp)
                    .background(Color.White, RoundedCornerShape(16.dp))
                    .border(1.dp, Color.Gray.copy(alpha = 0.1f), RoundedCornerShape(16.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(8.dp).background(SemanticColors.IndicatorLocation, CircleShape))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "장소목록",
                            fontSize = 16.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            color = Color.Black
                        )
                    }
                    
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (selectedMember != null) {
                            Text(
                                text = selectedMember.displayName,
                                fontSize = 14.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Medium,
                                color = BrandColors.Primary
                            )
                        }
                        Box(
                            modifier = Modifier
                                .background(SemanticColors.IndicatorLocation.copy(alpha = 0.1f), CircleShape)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "${locations.size}개",
                                fontSize = 14.sp,
                                fontFamily = SuiteFont,
                                color = SemanticColors.IndicatorLocation
                            )
                        }
                    }
                }
                
                // 추가 권한이 없는 멤버의 장소는 보기만 가능
                if (selectedMember != null && !canAddLocation) {
                    SmapBanner(
                        message = "다른 멤버의 장소는 볼 수만 있어요.",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    )
                }

                if (isLoadingLocations) {
                    Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), color = BrandColors.Primary)
                    }
                } else if (selectedMember == null) {
                    Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(horizontal = 24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.PersonOutline,
                                contentDescription = null,
                                tint = SemanticColors.IndicatorMember.copy(alpha = 0.5f),
                                modifier = Modifier.size(36.dp)
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "먼저 멤버를 선택해주세요",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                fontFamily = SuiteFont,
                                color = BrandColors.TextPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "위 멤버 목록에서 사용자를 고르면\n해당 사용자의 장소가 표시됩니다",
                                fontSize = 12.sp,
                                fontFamily = SuiteFont,
                                color = BrandColors.TextSecondary,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                } else if (locations.isEmpty()) {
                    Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(horizontal = 24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = SemanticColors.IndicatorLocation.copy(alpha = 0.5f),
                                modifier = Modifier.size(36.dp)
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "등록된 장소가 없어요",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                fontFamily = SuiteFont,
                                color = BrandColors.TextPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            if (canAddLocation) {
Text(
                                text = "지도를 길게 눌러 새 장소를 추가하거나\n주소 검색으로 장소를 찾아보세요",
                                fontSize = 12.sp,
                                fontFamily = SuiteFont,
                                color = BrandColors.TextSecondary,
                                textAlign = TextAlign.Center
                            )
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(horizontal = 12.dp),
                        contentPadding = PaddingValues(bottom = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        items(locations, key = { it.sltIdx }) { location ->
                            LocationListItem(
                                location = location,
                                canManage = canManageLocation(location),
                                onClick = { onLocationClick(location) },
                                onNotification = { onLocationNotification(location) }
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

// MARK: - Member Avatar Item (Horizontal List)

@Composable
private fun MemberAvatarItem(
    member: SmapGroupMember,
    isSelected: Boolean,
    isSelf: Boolean = false,
    onClick: () -> Unit
) {
    val imageUrl = remember(member.mtFile1) {
        if (!member.mtFile1.isNullOrBlank()) {
            when {
                member.mtFile1.startsWith("http") -> member.mtFile1
                member.mtFile1.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}${member.mtFile1}"
                member.mtFile1.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images${member.mtFile1}"
                else -> "${BuildConfig.IMAGE_BASE_URL}/images/${member.mtFile1}"
            }
        } else null
    }

    val badgeSuffix = when {
        member.sgdtOwnerChk == "Y" -> " (방장)"
        member.sgdtLeaderChk == "Y" -> " (리더)"
        else -> ""
    }
    val selfSuffix = if (isSelf) " (나)" else ""
    Column(
        modifier = Modifier
            .heightIn(min = 72.dp)
            .widthIn(min = 56.dp)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics {
                contentDescription = "${member.displayName}$selfSuffix$badgeSuffix"
                selected = isSelected
            }
            .padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier.size(60.dp),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(Color.Gray.copy(alpha = 0.1f))
                    .then(
                        if (isSelected) Modifier.border(3.dp, BrandColors.Primary, CircleShape)
                        else Modifier.border(1.dp, Color.Gray.copy(alpha = 0.2f), CircleShape)
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        tint = Color.Gray,
                        modifier = Modifier.size(28.dp)
                    )
                }
            }
            
            // Owner/Leader Badge
            if (member.sgdtOwnerChk == "Y") {
                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .align(Alignment.BottomEnd)
                        .background(AccentColors.Crown, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Star, null, tint = Color.White, modifier = Modifier.size(10.dp))
                }
            } else if (member.sgdtLeaderChk == "Y") {
                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .align(Alignment.BottomEnd)
                        .background(AccentColors.Orange, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Grade, null, tint = Color.White, modifier = Modifier.size(10.dp))
                }
            }
        }
        
        Spacer(modifier = Modifier.height(6.dp))
        
        Text(
            text = if (isSelf) "${member.displayName} (나)" else member.displayName,
            fontSize = 12.sp,
            fontFamily = SuiteFont,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) BrandColors.Primary else Color.Black,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// MARK: - Location List Item

@Composable
private fun LocationListItem(
    location: SavedLocation,
    canManage: Boolean,
    onClick: () -> Unit,
    onNotification: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = "${location.name}, ${location.address}"
            },
        shape = RoundedCornerShape(10.dp),
        color = BrandColors.InputBackground,
        border = BorderStroke(0.5.dp, Color.Gray.copy(alpha = 0.15f))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = location.name,
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 16.sp
                )
                Text(
                    text = location.address,
                    fontSize = 11.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 14.sp
                )
            }
            
            // Notification Bell Button — 48dp 최소 터치 타겟 확보
            if (canManage) {
                val alarmOn = location.sltEnterAlarm == "Y"
                IconButton(
                    onClick = onNotification,
                    modifier = Modifier.size(48.dp)
                ) {
                    Icon(
                        imageVector = if (alarmOn) Icons.Default.Notifications else Icons.Default.NotificationsNone,
                        contentDescription = if (alarmOn) "${location.name} 도착 알림 켜짐, 끄기" else "${location.name} 도착 알림 꺼짐, 켜기",
                        tint = if (alarmOn) AccentColors.Orange else BrandColors.TextSecondary.copy(alpha = 0.5f),
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }
    }
}

// MARK: - Group Selector Button

@Composable
fun MyPlaceGroupSelector(
    selectedGroup: SmapGroup?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(BrandColors.InputBackground)
            .heightIn(min = 48.dp)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics {
                contentDescription = "그룹 선택, 현재 ${selectedGroup?.sgtTitle ?: "미선택"}"
            }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = selectedGroup?.sgtTitle ?: "그룹 선택",
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            color = BrandColors.TextPrimary
        )
        Spacer(modifier = Modifier.width(4.dp))
        Icon(
            imageVector = Icons.Default.KeyboardArrowDown,
            contentDescription = null,
            tint = Color.Gray,
            modifier = Modifier.size(18.dp)
        )
    }
}

