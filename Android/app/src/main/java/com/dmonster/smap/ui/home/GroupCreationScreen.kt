package com.dmonster.smap.ui.home

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material.icons.filled.TextSnippet
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

/**
 * 그룹 생성 화면 (신규 가입자용 전체 화면 모달)
 * iOS의 GroupCreationView 참고
 */
@Composable
fun GroupCreationScreen(
    isCreating: Boolean,
    onCreateGroup: (name: String, description: String) -> Unit,
    errorMessage: String?
) {
    var groupName by remember { mutableStateOf("") }
    var groupDescription by remember { mutableStateOf("") }
    
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
            Spacer(modifier = Modifier.height(60.dp))
            
            // Header Icon
            Box(
                contentAlignment = Alignment.Center
            ) {
                // Outer Circle
                Box(
                    modifier = Modifier
                        .size(140.dp)
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
                        .size(90.dp)
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
                        imageVector = Icons.Filled.Groups,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(36.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Title
            Text(
                text = "첫 그룹을 만들어보세요",
                fontSize = 24.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "소중한 사람들과 위치를 공유할 그룹을 만들어보세요",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                color = Color.Gray
            )
            
            Spacer(modifier = Modifier.height(40.dp))
            
            // Form Card (using Surface to avoid Material3 tonal elevation tinting)
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
                    // Group Name Field
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
                    
                    // Group Description Field
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
            
            // Create Button
            Button(
                onClick = { onCreateGroup(groupName, groupDescription) },
                enabled = groupName.isNotBlank() && !isCreating,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BrandColors.Primary,
                    disabledContainerColor = BrandColors.Primary.copy(alpha = 0.3f)
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
                    text = "그룹 만들기",
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
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF9E6))
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
                        text = "그룹을 만들면 멤버들을 초대할 수 있는 코드가 생성됩니다",
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
