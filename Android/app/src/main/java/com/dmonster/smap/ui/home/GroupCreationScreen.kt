package com.dmonster.smap.ui.home

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material.icons.filled.TextSnippet
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

/**
 * 그룹 생성/가입 화면 (신규 가입자용 전체 화면 모달)
 * 그룹 만들기 또는 초대코드로 가입 선택 가능
 */
@Composable
fun GroupCreationScreen(
    isCreating: Boolean,
    onCreateGroup: (name: String, description: String) -> Unit,
    onJoinGroup: (inviteCode: String) -> Unit,
    errorMessage: String?
) {
    var groupName by remember { mutableStateOf("") }
    var groupDescription by remember { mutableStateOf("") }
    var inviteCode by remember { mutableStateOf("") }
    
    // Tab Selection: 0 = Create, 1 = Join
    var selectedTab by remember { mutableIntStateOf(0) }
    
    // Animation
    val animationScale by animateFloatAsState(
        targetValue = 1f,
        label = "iconScale"
    )
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFFFAFAFA),
                        Color.White
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(40.dp))
            
            // Header Icon
            Box(
                contentAlignment = Alignment.Center
            ) {
                // Outer Circle
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .scale(animationScale)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(
                                    BrandColors.Primary.copy(alpha = 0.1f),
                                    Color(0xFFEC4899).copy(alpha = 0.1f)
                                )
                            ),
                            CircleShape
                        )
                )
                // Inner Circle
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .scale(animationScale)
                        .shadow(16.dp, CircleShape, spotColor = BrandColors.Primary.copy(alpha = 0.3f))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(BrandColors.Primary, Color(0xFFEC4899))
                            ),
                            CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (selectedTab == 0) Icons.Filled.Groups else Icons.Filled.PersonAdd,
                        contentDescription = if (selectedTab == 0) "그룹 생성" else "그룹 참여",
                        tint = Color.White,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // Title
            Text(
                text = "그룹 시작하기",
                fontSize = 24.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "새 그룹을 만들거나 초대코드로 가입하세요",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                color = Color.Gray,
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Tab Selector
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.Gray.copy(alpha = 0.1f))
                    .padding(4.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                TabButton(
                    text = "그룹 만들기",
                    isSelected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    modifier = Modifier.weight(1f)
                )
                TabButton(
                    text = "초대코드 입력",
                    isSelected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    modifier = Modifier.weight(1f)
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Form Card
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(8.dp, RoundedCornerShape(20.dp)),
                shape = RoundedCornerShape(20.dp),
                color = Color.White
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp)
                ) {
                    if (selectedTab == 0) {
                        // === Create Group Form ===
                        Text(
                            text = "그룹 이름",
                            fontSize = 14.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.Gray
                        )
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        OutlinedTextField(
                            value = groupName,
                            onValueChange = { groupName = it },
                            placeholder = { 
                                Text(
                                    "예: 우리 가족, 회사 동료",
                                    fontFamily = SuiteFont,
                                    color = Color.Gray.copy(alpha = 0.6f)
                                ) 
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Filled.Tag,
                                    contentDescription = null,
                                    tint = BrandColors.Primary
                                )
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Color.White,
                                unfocusedContainerColor = Color.White,
                                focusedBorderColor = BrandColors.Primary,
                                unfocusedBorderColor = Color.Gray.copy(alpha = 0.3f)
                            ),
                            singleLine = true
                        )
                        
                        Spacer(modifier = Modifier.height(20.dp))
                        
                        Text(
                            text = "그룹 설명 (선택)",
                            fontSize = 14.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.Gray
                        )
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        OutlinedTextField(
                            value = groupDescription,
                            onValueChange = { groupDescription = it },
                            placeholder = { 
                                Text(
                                    "그룹에 대한 간단한 설명",
                                    fontFamily = SuiteFont,
                                    color = Color.Gray.copy(alpha = 0.6f)
                                ) 
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Filled.TextSnippet,
                                    contentDescription = null,
                                    tint = Color(0xFFEC4899)
                                )
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Color.White,
                                unfocusedContainerColor = Color.White,
                                focusedBorderColor = Color(0xFFEC4899),
                                unfocusedBorderColor = Color.Gray.copy(alpha = 0.3f)
                            ),
                            singleLine = true
                        )
                    } else {
                        // === Join Group Form ===
                        Text(
                            text = "초대 코드",
                            fontSize = 14.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.Gray
                        )
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        OutlinedTextField(
                            value = inviteCode,
                            onValueChange = { inviteCode = it.uppercase() },
                            placeholder = { 
                                Text(
                                    "초대 코드를 입력하세요",
                                    fontFamily = SuiteFont,
                                    color = Color.Gray.copy(alpha = 0.6f)
                                ) 
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Filled.PersonAdd,
                                    contentDescription = null,
                                    tint = Color(0xFFF59E0B)
                                )
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Color.White,
                                unfocusedContainerColor = Color.White,
                                focusedBorderColor = Color(0xFFF59E0B),
                                unfocusedBorderColor = Color.Gray.copy(alpha = 0.3f)
                            ),
                            singleLine = true
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        Text(
                            text = "그룹 초대 코드를 받으셨나요?\n코드를 입력하면 해당 그룹에 가입됩니다.",
                            fontSize = 13.sp,
                            fontFamily = SuiteFont,
                            color = Color.Gray,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
            
            // Error Message
            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = errorMessage,
                    fontSize = 13.sp,
                    fontFamily = SuiteFont,
                    color = BrandColors.Error
                )
            }
            
            Spacer(modifier = Modifier.weight(1f))
            
            // Action Button
            Button(
                onClick = { 
                    if (selectedTab == 0) {
                        onCreateGroup(groupName, groupDescription)
                    } else {
                        onJoinGroup(inviteCode)
                    }
                },
                enabled = (selectedTab == 0 && groupName.isNotBlank()) || 
                          (selectedTab == 1 && inviteCode.isNotBlank()) && !isCreating,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedTab == 0) BrandColors.Primary else Color(0xFFF59E0B),
                    disabledContainerColor = Color.Gray.copy(alpha = 0.3f)
                )
            ) {
                if (isCreating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(
                    text = if (selectedTab == 0) "그룹 만들기" else "그룹 가입하기",
                    fontSize = 16.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Tip
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (selectedTab == 0) Color(0xFFFFF9E6) else Color(0xFFFEF3C7)
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "💡",
                        fontSize = 16.sp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (selectedTab == 0) 
                            "그룹을 만들면 멤버들을 초대할 수 있는 코드가 생성됩니다"
                        else 
                            "초대 코드는 그룹 관리자에게 받을 수 있습니다",
                        fontSize = 12.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun TabButton(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(
                if (isSelected) Color.White else Color.Transparent
            )
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) BrandColors.Primary else Color.Gray
        )
    }
}

