package com.dmonster.smap.ui.group

import com.dmonster.smap.BuildConfig
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.responsiveSp
import coil.compose.AsyncImage

// MARK: - Stats Cards

@Composable
fun GroupStatsCards(
    groupsCount: Int,
    totalMembers: Int,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Total Groups Card
        StatsCard(
            title = "총 그룹",
            value = "${groupsCount}개",
            icon = Icons.Filled.Layers,
            gradientColors = listOf(Color(0xFF001A8E), Color(0xFF0113A3)),
            modifier = Modifier.weight(1f)
        )
        
        // Total Members Card
        StatsCard(
            title = "총 멤버",
            value = "${totalMembers}명",
            icon = Icons.Filled.Groups,
            gradientColors = listOf(Color(0xFFBE185D), Color(0xFFDB2777)),
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun StatsCard(
    title: String,
    value: String,
    icon: ImageVector,
    gradientColors: List<Color>,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(90.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(gradientColors))
            .padding(16.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Text(
                text = title,
                fontSize = 14.responsiveSp(),
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.9f)
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = value,
                fontSize = 28.responsiveSp(),
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.3f),
            modifier = Modifier
                .size(48.dp)
                .align(Alignment.BottomEnd)
                .offset(x = 8.dp, y = 8.dp)
        )
    }
}

// MARK: - Invite Code Section

@Composable
fun InviteCodeSection(
    inviteCode: String,
    onCodeChange: (String) -> Unit,
    onJoin: () -> Unit,
    isLoading: Boolean,
    modifier: Modifier = Modifier
) {
    val focusManager = LocalFocusManager.current
    
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = inviteCode,
            onValueChange = { newValue ->
                // UI 레벨에서도 즉시 필터링 (영문 대문자와 숫자만)
                val filtered = newValue.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }
                onCodeChange(filtered)
            },
            placeholder = { Text("초대 코드 입력", style = TextStyle(color = Color.Gray, fontSize = 14.sp)) },
            singleLine = true,
            leadingIcon = {
                Icon(Icons.Filled.PersonAdd, null, tint = Color.Gray, modifier = Modifier.size(20.dp))
            },
            keyboardOptions = KeyboardOptions(
                capitalization = androidx.compose.ui.text.input.KeyboardCapitalization.Characters,
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Ascii, // 영문 키보드 권장
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(onDone = {
                focusManager.clearFocus()
                if (inviteCode.isNotBlank()) onJoin()
            }),
            modifier = Modifier
                .weight(1f)
                .height(60.dp),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFFF59E0B).copy(alpha = 0.5f),
                unfocusedBorderColor = Color.Gray.copy(alpha = 0.1f),
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White
            )
        )
        
        Box(
            modifier = Modifier
                .height(60.dp)
                .width(80.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(Color(0xFFFBBF24), Color(0xFFF59E0B))
                    )
                )
                .clickable(enabled = inviteCode.isNotBlank() && !isLoading) { onJoin() },
            contentAlignment = Alignment.Center
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            } else {
                Text(
                    text = "가입",
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 17.responsiveSp()
                )
            }
        }
    }
}

// MARK: - Group Card

@Composable
fun GroupCard(
    group: SmapGroup,
    memberCount: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFFF7ED) // Very light orange/beige
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Group Avatar Grid Placeholder (iOS style)
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                // Simplified 4-dot grid for now to match screenshot 0 look
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(modifier = Modifier.size(12.dp).background(Color(0xFFFDE68A), CircleShape))
                        Box(modifier = Modifier.size(12.dp).background(Color(0xFFFCA5A5), CircleShape))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(modifier = Modifier.size(12.dp).background(Color(0xFF93C5FD), CircleShape))
                        Box(modifier = Modifier.size(12.dp).background(Color(0xFFD1D5DB), CircleShape))
                    }
                }
            }
            
            Spacer(modifier = Modifier.width(20.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = group.sgtTitle ?: "이름 없음",
                    fontSize = 20.responsiveSp(),
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
                
                Text(
                    text = group.sgtMemo ?: "지니 시리 다연 다은", // Mocking based on screenshot 0
                    fontSize = 15.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Filled.Groups,
                            contentDescription = null,
                            tint = Color(0xFF001A8E),
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "${memberCount}명",
                            fontSize = 14.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF001A8E)
                        )
                    }
                    
                    Text(
                        text = group.sgtWdate?.take(10) ?: "2024-10-11",
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = Color(0xFF0EA5E9)
                    )
                }
            }
            
            Icon(
                imageVector = Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = Color.Gray.copy(alpha = 0.5f),
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

// MARK: - Group Header Card (Detail View)

@Composable
fun GroupHeaderCard(
    group: SmapGroup,
    isOwner: Boolean,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit,
    onLeaveClick: () -> Unit,
    onCopyCode: () -> Unit,
    onInviteClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showMenu by remember { mutableStateOf(false) }
    
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF001A8E))
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            // Menu Button (Three dots horizontal)
            Box(
                modifier = Modifier.align(Alignment.TopEnd)
            ) {
                IconButton(
                    onClick = { showMenu = true },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.MoreHoriz,
                        contentDescription = "메뉴",
                        tint = Color.White.copy(alpha = 0.5f),
                        modifier = Modifier.size(24.dp)
                    )
                }
                
                DropdownMenu(
                    expanded = showMenu,
                    onDismissRequest = { showMenu = false }
                ) {
                    if (isOwner) {
                        DropdownMenuItem(
                            text = { Text("그룹 정보 수정", fontFamily = SuiteFont) },
                            onClick = {
                                showMenu = false
                                onEditClick()
                            },
                            leadingIcon = { Icon(Icons.Filled.Edit, null) }
                        )
                    }
                    
                    DropdownMenuItem(
                        text = { Text("멤버 초대하기", fontFamily = SuiteFont) },
                        onClick = {
                            showMenu = false
                            onInviteClick()
                        },
                        leadingIcon = { Icon(Icons.Filled.PersonAdd, null) }
                    )
                    
                    Divider()
                    
                    if (isOwner) {
                        DropdownMenuItem(
                            text = { Text("그룹 삭제", fontFamily = SuiteFont, color = Color.Red) },
                            onClick = {
                                showMenu = false
                                onDeleteClick()
                            },
                            leadingIcon = { Icon(Icons.Filled.Delete, null, tint = Color.Red) }
                        )
                    } else {
                        DropdownMenuItem(
                            text = { Text("그룹 나가기", fontFamily = SuiteFont, color = Color.Red) },
                            onClick = {
                                showMenu = false
                                onLeaveClick()
                            },
                            leadingIcon = { Icon(Icons.Filled.ExitToApp, null, tint = Color.Red) }
                        )
                    }
                }
            }
            
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Grid Avatar Placeholder
                    Box(
                        modifier = Modifier
                            .size(70.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.1f))
                            .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Box(modifier = Modifier.size(14.dp).background(Color(0xFFFDE68A), CircleShape))
                                Box(modifier = Modifier.size(14.dp).background(Color(0xFFFCA5A5), CircleShape))
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Box(modifier = Modifier.size(14.dp).background(Color(0xFF93C5FD), CircleShape))
                                Box(modifier = Modifier.size(14.dp).background(Color(0xFFD1D5DB), CircleShape))
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.width(16.dp))
                    
                    Column {
                        Text(
                            text = group.sgtTitle ?: "그룹",
                            fontSize = 24.responsiveSp(),
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = group.sgtMemo ?: "지니 시리 다연 다은",
                            fontSize = 15.sp,
                            fontFamily = SuiteFont,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(14.dp))
                Divider(color = Color.White.copy(alpha = 0.1f))
                Spacer(modifier = Modifier.height(14.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "초대 코드",
                            fontSize = 14.sp,
                            fontFamily = SuiteFont,
                            color = Color.White.copy(alpha = 0.5f)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Box(
                            modifier = Modifier
                                .background(Color.Black.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                .clickable { onCopyCode() },
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = group.sgtCode ?: "N/A",
                                    fontSize = 16.sp,
                                    fontFamily = SuiteFont,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Icon(
                                    imageVector = Icons.Filled.ContentCopy,
                                    contentDescription = "복사",
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                    
                    Text(
                        text = "생성일: ${group.sgtWdate?.take(10) ?: "2024.10.11"}",
                        fontSize = 13.sp,
                        fontFamily = SuiteFont,
                        color = Color.White.copy(alpha = 0.4f)
                    )
                }
            }
        }
    }
}

// MARK: - Detail Stats Cards

@Composable
fun DetailStatsCards(
    memberCount: Int,
    scheduleCount: Int,
    locationCount: Int,
    isLoading: Boolean,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        DetailStatCard(
            title = "멤버",
            value = memberCount.toString(),
            icon = Icons.Default.Person,
            backgroundColor = Color(0xFFFCA5A5),
            iconColor = Color(0xFF991B1B),
            isLoading = isLoading,
            modifier = Modifier.weight(1f)
        )
        DetailStatCard(
            title = "주간 일정",
            value = scheduleCount.toString(),
            icon = Icons.Default.CalendarMonth,
            backgroundColor = Color(0xFFFDE047),
            iconColor = Color(0xFF854D0E),
            isLoading = isLoading,
            modifier = Modifier.weight(1f)
        )
        DetailStatCard(
            title = "총 위치",
            value = locationCount.toString(),
            icon = Icons.Default.LocationOn,
            backgroundColor = Color(0xFF93C5FD),
            iconColor = Color(0xFF1E40AF),
            isLoading = isLoading,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun DetailStatCard(
    title: String,
    value: String,
    icon: ImageVector,
    backgroundColor: Color,
    iconColor: Color,
    isLoading: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.height(110.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(28.dp)
            )
            
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    strokeWidth = 2.dp,
                    color = iconColor
                )
            } else {
                Text(
                    text = value,
                    fontSize = 28.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = iconColor
                )
            }
            
            Text(
                text = title,
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = iconColor
            )
        }
    }
}

// MARK: - Member List Item

@Composable
fun MemberListItem(
    member: SmapGroupMember,
    isOwner: Boolean,
    canManage: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isOwnerMember = member.sgdtOwnerChk == "Y"
    val isLeader = member.sgdtLeaderChk == "Y"
    
    // Resolve avatar URL
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

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clickable(enabled = canManage && !isOwnerMember, onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar with crown badge
            Box {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(Color.Gray.copy(alpha = 0.05f))
                        .border(1.dp, Color.Gray.copy(alpha = 0.1f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    if (imageUrl != null) {
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = androidx.compose.ui.layout.ContentScale.Crop
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Filled.Person,
                            contentDescription = null,
                            tint = Color.Gray.copy(alpha = 0.3f),
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }
                
                // Crown badge for owner/leader
                if (isOwnerMember || isLeader) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .size(24.dp)
                            .background(Color.White, CircleShape)
                            .padding(2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    if (isOwnerMember) Color(0xFFFBBF24) else Color(0xFF3B82F6),
                                    CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (isOwnerMember) Icons.Filled.Star else Icons.Filled.Verified,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = member.displayName,
                    fontSize = 18.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1F2937)
                )
                
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = when {
                            isOwnerMember -> "그룹 관리자"
                            isLeader -> "리더"
                            else -> "멤버"
                        },
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = if (isOwnerMember) Color(0xFFF59E0B) else if (isLeader) Color(0xFF3B82F6) else Color.Gray
                    )
                    
                    if (isOwnerMember || isLeader) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .background(
                                    if (isOwnerMember) Color(0xFFFEF3C7) else Color(0xFFDBEAFE),
                                    RoundedCornerShape(6.dp)
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = if (isOwnerMember) "그룹장" else "리더",
                                fontSize = 11.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold,
                                color = if (isOwnerMember) Color(0xFFB45309) else Color(0xFF1E40AF)
                            )
                        }
                    }
                }
            }
            
            if (canManage && !isOwnerMember) {
                Icon(
                    imageVector = Icons.Filled.Settings,
                    contentDescription = "관리",
                    tint = Color.Gray.copy(alpha = 0.5f),
                    modifier = Modifier.size(22.dp)
                )
            }
        }
    }
}
