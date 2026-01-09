package com.dmonster.smap.ui.settings

import android.app.DatePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.compose.SubcomposeAsyncImage
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel
) {
    val user by viewModel.user.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val userMessage by viewModel.userMessage.collectAsState()
    val context = LocalContext.current
    
    var name by remember(user) { mutableStateOf(user?.mtName ?: "") }
    var nickname by remember(user) { mutableStateOf(user?.mtNickname ?: "") }
    var birthDate by remember(user) { mutableStateOf(user?.mtBirth ?: "") }
    var gender by remember(user) { mutableStateOf(user?.mtGender ?: 1) }
    
    // Check if original values exist (non-empty) to disable editing
    val isNameLocked = remember(user) { !user?.mtName.isNullOrBlank() }
    val isBirthDateLocked = remember(user) { !user?.mtBirth.isNullOrBlank() }
    val isGenderLocked = remember(user) { user?.mtGender != null && user?.mtGender != 0 }
    
    var showSuccessDialog by remember { mutableStateOf(false) }
    
    // Handle message from ViewModel
    LaunchedEffect(userMessage) {
        if (userMessage?.contains("업데이트") == true) {
            showSuccessDialog = true
            viewModel.clearMessage()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F7F7))
    ) {
        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
            // Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 20.dp)
            ) {
                Surface(
                    onClick = onBack,
                    shape = RoundedCornerShape(24.dp),
                    color = Color.White,
                    shadowElevation = 2.dp,
                    modifier = Modifier.height(44.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "뒤로",
                            tint = Color.Black,
                            modifier = Modifier.size(24.dp)
                        )
                        Text(
                            text = "뒤로",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color.Black
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Profile Avatar Section
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    val profileImage = user?.mtFile1
                    if (!profileImage.isNullOrBlank()) {
                        val imageUrl = when {
                            profileImage.startsWith("http") -> profileImage
                            profileImage.startsWith("/images/") -> "https://api3.smap.site$profileImage"
                            profileImage.startsWith("/") -> "https://api3.smap.site/images$profileImage"
                            else -> "https://api3.smap.site/images/$profileImage"
                        }
                        SubcomposeAsyncImage(
                            model = imageUrl,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(80.dp)
                                .clip(CircleShape)
                                .background(Color.Gray.opacity(0.1f)),
                            loading = {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        strokeWidth = 2.dp,
                                        color = BrandColors.Primary
                                    )
                                }
                            },
                            error = {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(Color.Gray.opacity(0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        Icons.Default.Person,
                                        contentDescription = null,
                                        tint = Color.Gray,
                                        modifier = Modifier.size(40.dp)
                                    )
                                }
                            }
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(CircleShape)
                                .background(Color.Gray.opacity(0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Person,
                                contentDescription = null,
                                tint = Color.Gray,
                                modifier = Modifier.size(40.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = user?.displayName ?: "사용자",
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = Color.Black
                    )
                }
                
                // Form Fields
                Surface(
                    color = Color.White,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column {
                        ProfileFormRow(
                            icon = Icons.Default.Person,
                            iconColor = BrandColors.Primary,
                            label = "이름",
                            value = name,
                            onValueChange = { name = it },
                            placeholder = "이름을 입력하세요",
                            enabled = !isNameLocked
                        )
                        HorizontalDivider(modifier = Modifier.padding(start = 52.dp), thickness = 0.5.dp, color = Color.Gray.opacity(0.1f))
                        ProfileFormRow(
                            icon = Icons.Default.AlternateEmail,
                            iconColor = Color(0xFFFFA726),
                            label = "닉네임",
                            value = nickname,
                            onValueChange = { nickname = it },
                            placeholder = "닉네임을 입력하세요",
                            enabled = true
                        )
                    }
                }
                
                // Birthday & Gender
                Surface(
                    color = Color.White,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column {
                        // Birthday Row
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .then(
                                    if (!isBirthDateLocked) {
                                        Modifier.clickable {
                                            val calendar = Calendar.getInstance()
                                            if (birthDate.isNotEmpty()) {
                                                try {
                                                    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                                                    sdf.parse(birthDate)?.let { calendar.time = it }
                                                } catch (e: Exception) { }
                                            }
                                            DatePickerDialog(
                                                context,
                                                { _, year, month, day ->
                                                    birthDate = String.format("%04d-%02d-%02d", year, month + 1, day)
                                                },
                                                calendar.get(Calendar.YEAR),
                                                calendar.get(Calendar.MONTH),
                                                calendar.get(Calendar.DAY_OF_MONTH)
                                            ).show()
                                        }
                                    } else Modifier
                                )
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .background(
                                        if (isBirthDateLocked) Color.Gray.opacity(0.5f) else Color(0xFFF06292),
                                        RoundedCornerShape(6.dp)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.DateRange, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                            }
                            Text(
                                "생년월일",
                                fontFamily = SuiteFont,
                                fontSize = 16.sp,
                                color = if (isBirthDateLocked) Color.Gray else Color.Black
                            )
                            Spacer(modifier = Modifier.weight(1f))
                            Text(
                                text = if (birthDate.isEmpty()) "선택" else birthDate,
                                fontFamily = SuiteFont,
                                fontSize = 15.sp,
                                color = if (isBirthDateLocked) Color.Gray else if (birthDate.isEmpty()) Color.Gray else Color.Black
                            )
                        }
                        
                        HorizontalDivider(modifier = Modifier.padding(start = 52.dp), thickness = 0.5.dp, color = Color.Gray.opacity(0.1f))
                        
                        // Gender Row
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .background(
                                        if (isGenderLocked) Color.Gray.opacity(0.5f) else Color(0xFF9C27B0),
                                        RoundedCornerShape(6.dp)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.People, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                            }
                            Text(
                                "성별",
                                fontFamily = SuiteFont,
                                fontSize = 16.sp,
                                color = if (isGenderLocked) Color.Gray else Color.Black
                            )
                            Spacer(modifier = Modifier.weight(1f))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                GenderChip(
                                    label = "남성",
                                    selected = gender == 1,
                                    onClick = { if (!isGenderLocked) gender = 1 },
                                    enabled = !isGenderLocked
                                )
                                GenderChip(
                                    label = "여성",
                                    selected = gender == 2,
                                    onClick = { if (!isGenderLocked) gender = 2 },
                                    enabled = !isGenderLocked
                                )
                            }
                        }
                    }
                }
                
                // Save Button
                Button(
                    onClick = { viewModel.updateProfile(name, nickname, birthDate.takeIf { it.isNotEmpty() }, gender) },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Primary),
                    enabled = !isLoading && name.isNotEmpty() && nickname.isNotEmpty()
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    } else {
                        Text("저장", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    }
                }
                
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }
    
    if (showSuccessDialog) {
        AlertDialog(
            onDismissRequest = { showSuccessDialog = false; onBack() },
            title = { Text("알림", fontFamily = SuiteFont, fontWeight = FontWeight.Bold) },
            text = { Text("프로필이 업데이트되었습니다.", fontFamily = SuiteFont) },
            confirmButton = {
                TextButton(onClick = { showSuccessDialog = false; onBack() }) {
                    Text("확인", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, color = BrandColors.Primary)
                }
            }
        )
    }
}

@Composable
private fun ProfileFormRow(
    icon: ImageVector,
    iconColor: Color,
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    enabled: Boolean = true
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .padding(top = 4.dp)
                .size(32.dp)
                .background(
                    if (enabled) iconColor else Color.Gray.opacity(0.5f),
                    RoundedCornerShape(8.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = label,
                fontFamily = SuiteFont,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = Color.Gray
            )
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                placeholder = {
                    Text(
                        text = placeholder,
                        fontFamily = SuiteFont,
                        fontSize = 15.sp,
                        color = Color.Gray.copy(alpha = 0.4f),
                        maxLines = 1
                    )
                },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 52.dp),
                textStyle = LocalTextStyle.current.copy(
                    fontFamily = SuiteFont,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (enabled) Color.Black else Color.Gray
                ),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BrandColors.Primary,
                    unfocusedBorderColor = Color.Gray.copy(alpha = 0.2f),
                    disabledBorderColor = Color.Gray.copy(alpha = 0.2f),
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color(0xFFFAFAFA),
                    disabledContainerColor = Color(0xFFF5F5F5),
                    cursorColor = BrandColors.Primary,
                    disabledTextColor = Color.Gray
                )
            )
        }
    }
}

@Composable
private fun GenderChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    enabled: Boolean = true
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(20.dp),
        color = when {
            !enabled && selected -> Color.Gray.opacity(0.5f)
            !enabled -> Color.Gray.opacity(0.1f)
            selected -> BrandColors.Primary
            else -> Color.Gray.opacity(0.1f)
        }
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            fontFamily = SuiteFont,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            fontSize = 14.sp,
            color = when {
                !enabled -> Color.Gray
                selected -> Color.White
                else -> Color.Gray
            }
        )
    }
}

private fun Color.opacity(alpha: Float): Color = this.copy(alpha = alpha)
