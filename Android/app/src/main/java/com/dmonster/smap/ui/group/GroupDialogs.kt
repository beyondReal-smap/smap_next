package com.dmonster.smap.ui.group

import com.dmonster.smap.BuildConfig
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

// MARK: - Create Group Dialog

@Composable
fun CreateGroupDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String) -> Unit,
    isLoading: Boolean
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    
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
                // Header
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(
                                    Brush.linearGradient(
                                        listOf(Color(0xFF3B82F6), Color(0xFF2563EB))
                                    ),
                                    RoundedCornerShape(10.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "새 그룹 만들기",
                                fontSize = 18.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1F2937)
                            )
                            Text(
                                text = "함께할 멤버들을 초대해보세요",
                                fontSize = 12.sp,
                                fontFamily = SuiteFont,
                                color = Color.Gray
                            )
                        }
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "닫기",
                            tint = Color.Gray
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Name Field
                Text(
                    text = "그룹명 *",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = BrandColors.Primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { if (it.length <= 50) name = it },
                    placeholder = { Text("예: 가족, 친구, 직장", fontFamily = SuiteFont) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
                Text(
                    text = "${name.length}/50",
                    fontSize = 12.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray,
                    modifier = Modifier.padding(top = 4.dp)
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Description Field
                Text(
                    text = "그룹 설명",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = BrandColors.Primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = description,
                    onValueChange = { if (it.length <= 100) description = it },
                    placeholder = { Text("그룹에 대한 간단한 설명을 입력해주세요", fontFamily = SuiteFont) },
                    minLines = 2,
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
                Text(
                    text = "${description.length}/100",
                    fontSize = 12.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray,
                    modifier = Modifier.padding(top = 4.dp)
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Create Button
                Button(
                    onClick = { onCreate(name, description) },
                    enabled = name.isNotBlank() && !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = BrandColors.Primary
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "그룹 만들기",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Edit Group Dialog

@Composable
fun EditGroupDialog(
    group: SmapGroup,
    onDismiss: () -> Unit,
    onUpdate: (String, String) -> Unit,
    isLoading: Boolean
) {
    var name by remember { mutableStateOf(group.sgtTitle ?: "") }
    var description by remember { mutableStateOf(group.sgtMemo ?: "") }
    
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
                // Header
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(
                                    Color(0xFFFBBF24),
                                    RoundedCornerShape(10.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "그룹 수정",
                            fontSize = 18.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1F2937)
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, "닫기", tint = Color.Gray)
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Name Field
                Text(
                    text = "그룹명 *",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = BrandColors.Primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { if (it.length <= 50) name = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Description Field
                Text(
                    text = "그룹 설명",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = BrandColors.Primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = description,
                    onValueChange = { if (it.length <= 100) description = it },
                    minLines = 2,
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Update Button
                Button(
                    onClick = { onUpdate(name, description) },
                    enabled = name.isNotBlank() && !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFFBBF24)
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = "수정하기",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Delete Confirm Dialog

@Composable
fun DeleteConfirmDialog(
    group: SmapGroup,
    isLeave: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
    isLoading: Boolean
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = Color.Red,
                modifier = Modifier.size(48.dp)
            )
        },
        title = {
            Text(
                text = if (isLeave) "그룹 나가기" else "그룹 삭제",
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        },
        text = {
            Text(
                text = if (isLeave) {
                    "'${group.sgtTitle}' 그룹에서 나가시겠습니까?\n\n이후 다시 가입하려면 초대 코드가 필요합니다."
                } else {
                    "'${group.sgtTitle}'을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 멤버가 그룹에서 나가게 됩니다."
                },
                fontFamily = SuiteFont,
                textAlign = TextAlign.Center,
                style = LocalTextStyle.current.copy(
                    lineBreak = LineBreak.Paragraph,
                    platformStyle = PlatformTextStyle(
                        emojiSupportMatch = androidx.compose.ui.text.EmojiSupportMatch.None
                    )
                )
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
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
                    Text(if (isLeave) "나가기" else "삭제", fontFamily = SuiteFont)
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

// MARK: - Share Dialog

@Composable
fun ShareGroupDialog(
    group: SmapGroup,
    onDismiss: () -> Unit,
    onCopyCode: () -> Unit,
    onCopyLink: () -> Unit,
    onSMS: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.Share,
                    contentDescription = null,
                    tint = Color(0xFF1F2937),
                    modifier = Modifier.size(48.dp)
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = "그룹 초대하기",
                    fontSize = 20.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold
                )
                
                Text(
                    text = group.sgtTitle ?: "",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Invite Code
                group.sgtCode?.let { code ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0xFFF3F4F6)
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "초대 코드",
                                fontSize = 12.sp,
                                fontFamily = SuiteFont,
                                color = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = code,
                                fontSize = 28.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold,
                                color = BrandColors.Primary,
                                letterSpacing = 4.sp
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onCopyCode,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("코드 복사", fontFamily = SuiteFont, fontSize = 13.sp)
                    }
                    
                    OutlinedButton(
                        onClick = onCopyLink,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Link,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("링크 복사", fontFamily = SuiteFont, fontSize = 13.sp)
                    }
                }
                
                Spacer(modifier = Modifier.height(12.dp))
                
                Button(
                    onClick = onSMS,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF22C55E)
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Sms,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("문자로 초대", fontFamily = SuiteFont)
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                TextButton(onClick = onDismiss) {
                    Text("닫기", fontFamily = SuiteFont, color = Color.Gray)
                }
            }
        }
    }
}

// MARK: - Member Manage Dialog

@Composable
fun MemberManageDialog(
    member: SmapGroupMember,
    onDismiss: () -> Unit,
    onChangeRole: (Boolean) -> Unit,
    onRemove: () -> Unit,
    isLoading: Boolean
) {
    val isLeader = member.sgdtLeaderChk == "Y"
    
    // Resolve avatar URL
    val imageUrl = androidx.compose.runtime.remember(member.mtFile1) {
        if (!member.mtFile1.isNullOrBlank()) {
            when {
                member.mtFile1.startsWith("http") -> member.mtFile1
                member.mtFile1.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}${member.mtFile1}"
                member.mtFile1.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images${member.mtFile1}"
                else -> "${BuildConfig.IMAGE_BASE_URL}/images/${member.mtFile1}"
            }
        } else null
    }
    
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Member Avatar
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .background(Color.Gray.copy(alpha = 0.1f), shape = CircleShape),
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
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = Color.Gray,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(10.dp))
                
                Text(
                    text = member.displayName,
                    fontSize = 18.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold
                )
                
                Text(
                    text = if (isLeader) "리더" else "멤버",
                    fontSize = 13.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray
                )
                
                Spacer(modifier = Modifier.height(14.dp))
                
                // Role Toggle
                Button(
                    onClick = { onChangeRole(!isLeader) },
                    enabled = !isLoading,
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isLeader) Color.Gray else Color(0xFF3B82F6)
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Star,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isLeader) "리더 해제" else "리더로 지정",
                        fontFamily = SuiteFont
                    )
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Remove Button
                OutlinedButton(
                    onClick = onRemove,
                    enabled = !isLoading,
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color.Red
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.Red,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.PersonRemove,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("그룹에서 내보내기", fontFamily = SuiteFont)
                    }
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                TextButton(onClick = onDismiss) {
                    Text("닫기", fontFamily = SuiteFont, color = Color.Gray)
                }
            }
        }
    }
}

// MARK: - Invite Member Bottom Sheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InviteMemberBottomSheet(
    group: SmapGroup,
    onDismiss: () -> Unit,
    onCopyLink: () -> Unit,
    onShowQRCode: () -> Unit,
    onShareSMS: () -> Unit,
    onDefaultShare: () -> Unit,
    onCopyCode: () -> Unit
) {
    val clipboardManager = LocalClipboardManager.current
    
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFF5F5F5),
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle = null
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Spacer(modifier = Modifier.width(48.dp))
                Text(
                    text = "그룹 초대",
                    fontSize = 17.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black
                )
                TextButton(onClick = onDismiss) {
                    Text(
                        text = "완료",
                        fontSize = 16.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium,
                        color = BrandColors.Primary
                    )
                }
            }
            
            // Section Header
            Text(
                text = "그룹 초대 방법",
                fontSize = 13.sp,
                fontFamily = SuiteFont,
                color = Color.Gray,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )
            
            // Invite Options Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column {
                    // Link Copy Option
                    InviteOptionItem(
                        icon = Icons.Default.ContentCopy,
                        iconTint = BrandColors.Primary,
                        title = "링크 복사",
                        subtitle = "초대 링크를 복사합니다",
                        onClick = onCopyLink
                    )
                    
                    HorizontalDivider(color = Color.Gray.copy(alpha = 0.1f))
                    
                    // QR Code Option
                    InviteOptionItem(
                        icon = Icons.Default.QrCode2,
                        iconTint = Color.Black,
                        title = "QR 코드 보기",
                        subtitle = "QR 코드로 쉽게 초대하세요",
                        onClick = onShowQRCode
                    )
                    
                    HorizontalDivider(color = Color.Gray.copy(alpha = 0.1f))
                    
                    // SMS Share Option
                    InviteOptionItem(
                        icon = Icons.Default.ChatBubbleOutline,
                        iconTint = Color.Black,
                        title = "문자로 공유",
                        subtitle = "문자 메시지로 초대 링크를 전송합니다",
                        onClick = onShareSMS
                    )
                    
                    HorizontalDivider(color = Color.Gray.copy(alpha = 0.1f))
                    
                    // Default Share Option
                    InviteOptionItem(
                        icon = Icons.Default.Share,
                        iconTint = Color.Black,
                        title = "기본 공유",
                        subtitle = "다양한 앱으로 공유할 수 있습니다",
                        onClick = onDefaultShare
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Invite Code Section Header
            Text(
                text = "초대 코드",
                fontSize = 13.sp,
                fontFamily = SuiteFont,
                color = Color.Gray,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )
            
            // Invite Code Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "복사하여 편한 방법으로 공유하세요.",
                            fontSize = 13.sp,
                            fontFamily = SuiteFont,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = group.sgtCode ?: "N/A",
                            fontSize = 24.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            color = BrandColors.Primary
                        )
                    }
                    
                    IconButton(
                        onClick = {
                            group.sgtCode?.let {
                                clipboardManager.setText(AnnotatedString(it))
                            }
                            onCopyCode()
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "복사",
                            tint = BrandColors.Primary,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InviteOptionItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 16.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Medium,
                color = Color.Black
            )
            Text(
                text = subtitle,
                fontSize = 13.sp,
                fontFamily = SuiteFont,
                color = Color.Gray
            )
        }
    }
}

// MARK: - QR Code Dialog

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QRCodeDialog(
    data: String,
    onDismiss: () -> Unit,
    onShare: (android.graphics.Bitmap) -> Unit
) {
    val qrBitmap = remember(data) { generateQRCodeBitmap(data, 512) }
    
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle = null,
        contentWindowInsets = { WindowInsets(0, 0, 0, 0) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 48.dp)
                .navigationBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Spacer(modifier = Modifier.width(48.dp))
                Text(
                    text = "QR 코드",
                    fontSize = 17.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black
                )
                TextButton(onClick = onDismiss) {
                    Text(
                        text = "완료",
                        fontSize = 16.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium,
                        color = BrandColors.Primary
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Title
            Text(
                text = "QR 코드로 초대하기",
                fontSize = 22.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "QR 코드를 스캔하여 그룹에 참여하세요",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                color = Color.Gray
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // QR Code Image
            if (qrBitmap != null) {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                    modifier = Modifier.size(280.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        androidx.compose.foundation.Image(
                            bitmap = qrBitmap.asImageBitmap(),
                            contentDescription = "QR Code",
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            } else {
                Box(
                    modifier = Modifier
                        .size(280.dp)
                        .background(Color.Gray.copy(alpha = 0.1f), RoundedCornerShape(20.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = BrandColors.Primary)
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Instructions
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                InstructionRow(number = "1", text = "카메라 앱을 열어주세요")
                InstructionRow(number = "2", text = "QR 코드를 스캔해주세요")
                InstructionRow(number = "3", text = "링크를 탭하여 그룹에 참여하세요")
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Share Button
            Button(
                onClick = { qrBitmap?.let { onShare(it) } },
                enabled = qrBitmap != null,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Primary)
            ) {
                Icon(
                    imageVector = Icons.Filled.FileUpload,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "QR 코드 공유",
                    fontSize = 16.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun InstructionRow(number: String, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .background(BrandColors.Primary, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = number,
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
        Text(
            text = text,
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            color = Color.Gray
        )
    }
}

// QR Code Bitmap Generation using ZXing
private fun generateQRCodeBitmap(content: String, size: Int): android.graphics.Bitmap? {
    return try {
        val hints = hashMapOf<com.google.zxing.EncodeHintType, Any>()
        hints[com.google.zxing.EncodeHintType.MARGIN] = 1
        hints[com.google.zxing.EncodeHintType.ERROR_CORRECTION] = com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.H
        
        val bitMatrix = com.google.zxing.qrcode.QRCodeWriter().encode(
            content,
            com.google.zxing.BarcodeFormat.QR_CODE,
            size,
            size,
            hints
        )
        
        val width = bitMatrix.width
        val height = bitMatrix.height
        val pixels = IntArray(width * height)
        
        for (y in 0 until height) {
            for (x in 0 until width) {
                pixels[y * width + x] = if (bitMatrix[x, y]) {
                    android.graphics.Color.BLACK
                } else {
                    android.graphics.Color.WHITE
                }
            }
        }
        
        android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888).apply {
            setPixels(pixels, 0, width, 0, 0, width, height)
        }
    } catch (e: Exception) {
        null
    }
}

// Extension to convert Bitmap to ImageBitmap - import added
