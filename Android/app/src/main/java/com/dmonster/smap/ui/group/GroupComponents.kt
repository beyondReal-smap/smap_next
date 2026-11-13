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
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SemanticColors
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
            gradientColors = listOf(BrandColors.PrimaryDark, BrandColors.Primary),
            modifier = Modifier.weight(1f)
        )
        
        // Total Members Card
        StatsCard(
            title = "총 멤버",
            value = "${totalMembers}명",
            icon = Icons.Filled.Groups,
            gradientColors = listOf(AccentColors.PinkDeep, AccentColors.Pink),
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
                focusedBorderColor = BrandColors.Primary.copy(alpha = 0.5f),
                unfocusedBorderColor = BrandColors.Primary.copy(alpha = 0.2f),
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White
            )
        )

        // iOS 스타일: 단색 Primary 가입 버튼 — 입력이 비어있을 때는 Gray 0.4
        Box(
            modifier = Modifier
                .height(60.dp)
                .width(80.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(
                    if (inviteCode.isBlank()) Color.Gray.copy(alpha = 0.4f)
                    else BrandColors.Primary
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
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(0.5.dp, BrandColors.Border.copy(alpha = 0.5f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // iOS 스타일: Primary 톤 배경 + 하얀색 아이콘 한 개
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(BrandColors.Primary.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Groups,
                    contentDescription = null,
                    tint = BrandColors.Primary.copy(alpha = 0.8f),
                    modifier = Modifier.size(26.dp)
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = group.sgtTitle ?: "이름 없음",
                    fontSize = 17.responsiveSp(),
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = BrandColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Text(
                    text = group.sgtMemo?.takeIf { it.isNotBlank() } ?: "그룹 설명이 없습니다",
                    fontSize = 13.responsiveSp(),
                    fontFamily = SuiteFont,
                    color = BrandColors.TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                // 보조정보 — 멤버수 · 생성일, 모두 Primary tint 로 통일
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.Groups,
                        contentDescription = null,
                        tint = BrandColors.Primary,
                        modifier = Modifier.size(12.dp)
                    )
                    Text(
                        text = "${memberCount}명",
                        fontSize = 12.responsiveSp(),
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium,
                        color = BrandColors.Primary
                    )
                    val dateStr = group.sgtWdate?.take(10).orEmpty()
                    if (dateStr.isNotEmpty()) {
                        Text(
                            text = "·",
                            fontSize = 12.responsiveSp(),
                            fontFamily = SuiteFont,
                            color = BrandColors.TextSecondary
                        )
                        Text(
                            text = dateStr,
                            fontSize = 12.responsiveSp(),
                            fontFamily = SuiteFont,
                            color = BrandColors.TextSecondary,
                            maxLines = 1
                        )
                    }
                }
            }

            Icon(
                imageVector = Icons.Filled.ChevronRight,
                contentDescription = "상세 보기",
                tint = BrandColors.TextSecondary.copy(alpha = 0.5f),
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
    
    // iOS 스타일: Primary→PrimaryDark 대각선 그라디언트
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(BrandColors.Primary, BrandColors.PrimaryDark)
                    )
                )
                .padding(20.dp)
        ) {
            // Menu Button (Three dots horizontal)
            Box(
                modifier = Modifier.align(Alignment.TopEnd)
            ) {
                IconButton(
                    onClick = { showMenu = true },
                    modifier = Modifier.size(48.dp) // HIG/Material 권장 터치 타겟
                ) {
                    Icon(
                        imageVector = Icons.Filled.MoreHoriz,
                        contentDescription = "그룹 관리 메뉴",
                        tint = Color.White.copy(alpha = 0.7f),
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
                            leadingIcon = { Icon(Icons.Filled.Edit, contentDescription = "수정") }
                        )
                    }
                    
                    DropdownMenuItem(
                        text = { Text("멤버 초대하기", fontFamily = SuiteFont) },
                        onClick = {
                            showMenu = false
                            onInviteClick()
                        },
                        leadingIcon = { Icon(Icons.Filled.PersonAdd, contentDescription = "초대") }
                    )
                    
                    HorizontalDivider()

                    if (isOwner) {
                        DropdownMenuItem(
                            text = { Text("그룹 삭제", fontFamily = SuiteFont, color = BrandColors.Error) },
                            onClick = {
                                showMenu = false
                                onDeleteClick()
                            },
                            leadingIcon = { Icon(Icons.Filled.Delete, contentDescription = "삭제", tint = BrandColors.Error) }
                        )
                    } else {
                        DropdownMenuItem(
                            text = { Text("그룹 나가기", fontFamily = SuiteFont, color = BrandColors.Error) },
                            onClick = {
                                showMenu = false
                                onLeaveClick()
                            },
                            leadingIcon = { Icon(Icons.Filled.ExitToApp, contentDescription = "나가기", tint = BrandColors.Error) }
                        )
                    }
                }
            }
            
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // iOS 스타일: 반투명 흰색 박스 + 하얀 그룹 아이콘
                    Box(
                        modifier = Modifier
                            .size(68.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Groups,
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.85f),
                            modifier = Modifier.size(36.dp)
                        )
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
                            text = group.sgtMemo ?: "",
                            fontSize = 15.responsiveSp(),
                            fontFamily = SuiteFont,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(14.dp))
                HorizontalDivider(color = Color.White.copy(alpha = 0.1f))
                Spacer(modifier = Modifier.height(14.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "초대 코드",
                            fontSize = 14.responsiveSp(),
                            fontFamily = SuiteFont,
                            color = Color.White.copy(alpha = 0.5f)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Box(
                            // clickable 을 맨 앞에 두고 minimumInteractiveComponentSize 로 터치 영역을 48dp 이상 확보한다.
                            // (padding 뒤에 clickable 이 있으면 터치 영역이 칩 크기에 그쳐 48dp 에 못 미침) 시각 크기는 그대로.
                            modifier = Modifier
                                .clickable { onCopyCode() }
                                .minimumInteractiveComponentSize()
                                .background(Color.Black.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = group.sgtCode ?: "N/A",
                                    fontSize = 16.responsiveSp(),
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
                        text = "생성일: ${group.sgtWdate?.take(10) ?: ""}",
                        fontSize = 13.responsiveSp(),
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
    // iOS SMAPTheme 그라디언트 3종 — Pink / Crown→Orange / Primary→PrimaryDark
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
            gradient = listOf(AccentColors.Pink, AccentColors.PinkDeep),
            isLoading = isLoading,
            modifier = Modifier.weight(1f)
        )
        DetailStatCard(
            title = "주간 일정",
            value = scheduleCount.toString(),
            icon = Icons.Default.CalendarMonth,
            gradient = listOf(AccentColors.Crown.copy(alpha = 0.9f), AccentColors.Orange),
            isLoading = isLoading,
            modifier = Modifier.weight(1f)
        )
        DetailStatCard(
            title = "총 위치",
            value = locationCount.toString(),
            icon = Icons.Default.LocationOn,
            gradient = listOf(BrandColors.Primary, BrandColors.PrimaryDark),
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
    gradient: List<Color>,
    isLoading: Boolean,
    modifier: Modifier = Modifier
) {
    // iOS 스타일: 그라디언트 배경 + 흰색 텍스트/아이콘 — 대비 높고 세련된 톤
    Card(
        modifier = modifier.height(110.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.linearGradient(colors = gradient))
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
                    tint = Color.White,
                    modifier = Modifier.size(26.dp)
                )

                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        strokeWidth = 2.dp,
                        color = Color.White
                    )
                } else {
                    Text(
                        text = value,
                        fontSize = 26.responsiveSp(),
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Text(
                    text = title,
                    fontSize = 13.responsiveSp(),
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White.copy(alpha = 0.95f)
                )
            }
        }
    }
}

// MARK: - Member List Item

@Composable
fun MemberListItem(
    member: SmapGroupMember,
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
            .clickable(enabled = canManage && !isOwnerMember, onClick = onClick)
            .border(1.dp, BrandColors.Border.copy(alpha = 0.5f), RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        // flat 스타일 — elevation 제거, 경계는 stroke 로 표현
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
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
                                    if (isOwnerMember) AccentColors.Crown else SemanticColors.IndicatorMember,
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
                    fontSize = 18.responsiveSp(),
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = BrandColors.TextPrimary
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    // iOS: 소유주=Crown(Yellow), 리더·멤버=indicatorMember(Blue)
                    val roleColor = when {
                        isOwnerMember -> AccentColors.Crown
                        else -> SemanticColors.IndicatorMember
                    }
                    Text(
                        text = when {
                            isOwnerMember -> "그룹 관리자"
                            isLeader -> "리더"
                            else -> "멤버"
                        },
                        fontSize = 14.responsiveSp(),
                        fontFamily = SuiteFont,
                        color = if (isOwnerMember || isLeader) roleColor else BrandColors.TextSecondary
                    )

                    if (isOwnerMember || isLeader) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .background(
                                    roleColor.copy(alpha = 0.15f),
                                    RoundedCornerShape(6.dp)
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = if (isOwnerMember) "그룹장" else "리더",
                                fontSize = 11.responsiveSp(),
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold,
                                color = roleColor
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
