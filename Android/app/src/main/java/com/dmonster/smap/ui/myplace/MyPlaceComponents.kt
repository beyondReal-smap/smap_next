package com.dmonster.smap.ui.myplace

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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SavedLocation
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont


// MARK: - Location Card

@Composable
fun LocationCard(
    location: SavedLocation,
    isSelected: Boolean,
    onClick: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) BrandColors.Primary.copy(alpha = 0.1f) else Color.White
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isSelected) 4.dp else 2.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Location Icon
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (isSelected)
                            Brush.linearGradient(listOf(BrandColors.Primary, Color(0xFF001A8A)))
                        else
                            Brush.linearGradient(listOf(Color(0xFFF3F4F6), Color(0xFFE5E7EB)))
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = if (isSelected) Color.White else Color.Gray,
                    modifier = Modifier.size(24.dp)
                )
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = location.name,
                    fontSize = 16.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF1F2937),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Text(
                    text = location.address,
                    fontSize = 13.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                
                if (location.memo.isNotBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = location.memo,
                        fontSize = 12.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray.copy(alpha = 0.8f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            
            // Edit/Delete Buttons
            Column {
                IconButton(
                    onClick = onEdit,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "수정",
                        tint = Color.Gray,
                        modifier = Modifier.size(18.dp)
                    )
                }
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "삭제",
                        tint = Color.Red.copy(alpha = 0.7f),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

// MARK: - Member Sidebar

@Composable
fun MemberSidebar(
    groups: List<SmapGroup>,
    selectedGroup: SmapGroup?,
    members: List<SmapGroupMember>,
    selectedMember: SmapGroupMember?,
    locations: List<SavedLocation>,
    onGroupSelect: (SmapGroup) -> Unit,
    onMemberSelect: (SmapGroupMember) -> Unit,
    onLocationClick: (SavedLocation) -> Unit,
    onLocationNotification: (SavedLocation) -> Unit,
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
        color = Color(0xFFF5F7FA),
        shadowElevation = 8.dp
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 24.dp, start = 24.dp, end = 24.dp, bottom = 16.dp),
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
                        contentDescription = null,
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
                        color = Color.Gray
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
                    Box(modifier = Modifier.size(8.dp).background(Color.Red, CircleShape))
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
                        Box(modifier = Modifier.size(8.dp).background(Color.Blue, CircleShape))
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
                        Box(modifier = Modifier.size(8.dp).background(Color(0xFF10B981), CircleShape))
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
                                .background(Color(0xFF10B981).copy(alpha = 0.1f), CircleShape)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "${locations.size}개",
                                fontSize = 14.sp,
                                fontFamily = SuiteFont,
                                color = Color(0xFF10B981)
                            )
                        }
                    }
                }
                
                if (isLoadingLocations) {
                    Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), color = BrandColors.Primary)
                    }
                } else if (selectedMember == null) {
                    Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                        Text(
                            text = "멤버를 선택해주세요",
                            fontSize = 14.sp,
                            fontFamily = SuiteFont,
                            color = Color.Gray,
                            textAlign = TextAlign.Center
                        )
                    }
                } else if (locations.isEmpty()) {
                    Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.LocationOff,
                                contentDescription = null,
                                tint = Color.Gray.copy(alpha = 0.4f),
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "등록된 장소가 없어요",
                                fontSize = 14.sp,
                                fontFamily = SuiteFont,
                                color = Color.Gray
                            )
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
                        items(locations) { location ->
                            LocationListItem(
                                location = location,
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
    onClick: () -> Unit
) {
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
        modifier = Modifier
            .clickable(onClick = onClick)
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
                        .background(Color(0xFFFFD700), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Star, null, tint = Color.White, modifier = Modifier.size(10.dp))
                }
            } else if (member.sgdtLeaderChk == "Y") {
                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .align(Alignment.BottomEnd)
                        .background(Color(0xFFFFA500), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Grade, null, tint = Color.White, modifier = Modifier.size(10.dp))
                }
            }
        }
        
        Spacer(modifier = Modifier.height(6.dp))
        
        Text(
            text = member.displayName,
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
    onClick: () -> Unit,
    onNotification: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        color = Color(0xFFF9FAFB),
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
            
            // Notification Bell Button
            IconButton(onClick = onNotification, modifier = Modifier.size(28.dp)) {
                Icon(
                    imageVector = Icons.Default.Notifications,
                    contentDescription = "알림",
                    tint = if (location.sltEnterAlarm == "Y") Color(0xFFFF9500) else Color.Gray.copy(alpha = 0.4f),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun MemberItem(
    member: SmapGroupMember,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    // Resolve profile image URL
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

    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp)),
        color = if (isSelected) BrandColors.Primary.copy(alpha = 0.05f) else Color.White.copy(alpha = 0.6f),
        border = if (isSelected) BorderStroke(1.dp, BrandColors.Primary.copy(alpha = 0.3f)) else null
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar with Badge
            Box(
                modifier = Modifier
                    .size(52.6.dp), // Slightly larger matching iOS frame
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(Color.Gray.copy(alpha = 0.1f))
                        .then(
                            if (isSelected) Modifier.border(2.5.dp, BrandColors.Primary, CircleShape)
                            else Modifier
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
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
                
                // Owner/Leader Badge
                if (member.sgdtOwnerChk == "Y") {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .align(Alignment.BottomEnd)
                            .offset(x = 4.dp, y = 4.dp)
                            .background(Color(0xFFFFD700), CircleShape), // Gold
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Star, null, tint = Color.White, modifier = Modifier.size(10.dp))
                    }
                } else if (member.sgdtLeaderChk == "Y") {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .align(Alignment.BottomEnd)
                            .offset(x = 4.dp, y = 4.dp)
                            .background(Color(0xFFFFA500), CircleShape), // Orange
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Grade, null, tint = Color.White, modifier = Modifier.size(10.dp))
                    }
                }
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = member.displayName,
                    fontSize = 17.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = Color.Black
                )
                
                // Location count not available in model, omitted to match iOS look when data exists though
            }
            
            if (isSelected) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = BrandColors.Primary,
                    modifier = Modifier.size(22.dp)
                )
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
            .background(Color(0xFFF3F4F6))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = selectedGroup?.sgtTitle ?: "그룹 선택",
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            color = Color(0xFF1F2937)
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

// MARK: - Empty State

@Composable
fun MyPlaceEmptyState(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.LocationOn,
            contentDescription = null,
            tint = Color.Gray.copy(alpha = 0.4f),
            modifier = Modifier.size(64.dp)
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = "저장된 장소가 없습니다",
            fontSize = 16.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            color = Color.Gray
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = "지도를 길게 눌러 장소를 추가해보세요",
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            color = Color.Gray.copy(alpha = 0.7f)
        )
    }
}

// MARK: - Location Count Badge

@Composable
fun LocationCountBadge(
    count: Int,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .background(BrandColors.Primary.copy(alpha = 0.1f), RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.LocationOn,
            contentDescription = null,
            tint = BrandColors.Primary,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "$count",
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.SemiBold,
            color = BrandColors.Primary
        )
    }
}
