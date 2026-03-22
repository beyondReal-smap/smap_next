package com.dmonster.smap.ui.settings

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.data.model.SmapNotice
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.BrandColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onClose: () -> Unit,
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    var isAccountSettingsVisible by remember { mutableStateOf(false) }
    var selectedTermsScreen by remember { mutableStateOf<String?>(null) }
    var isUserGuideVisible by remember { mutableStateOf(false) }
    var isInquiryVisible by remember { mutableStateOf(false) }
    var isNoticeListVisible by remember { mutableStateOf(false) }
    var selectedNotice by remember { mutableStateOf<SmapNotice?>(null) }
    
    // Remember last states for smooth exit animations
    var lastTermsType by remember { mutableStateOf<String?>(null) }
    if (selectedTermsScreen != null) lastTermsType = selectedTermsScreen
    
    var lastNotice by remember { mutableStateOf<SmapNotice?>(null) }
    if (selectedNotice != null) lastNotice = selectedNotice

    // Track if any sub-screen is visible
    val isAnySubScreenVisible = isAccountSettingsVisible || 
        selectedTermsScreen != null || 
        isUserGuideVisible || 
        isInquiryVisible || 
        isNoticeListVisible || 
        selectedNotice != null

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F7F7)) // iOS style light gray background
    ) {
        // Main Settings Content with Slide Animation
        AnimatedVisibility(
            visible = !isAnySubScreenVisible,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> -fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> -fullWidth },
                animationSpec = tween(300)
            )
        ) {
            Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
                // Header - Custom Pill-style Back Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 20.dp)
                ) {
                    Surface(
                        onClick = onClose,
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
                                text = "홈",
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
                    verticalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    // Menu Sections - Exact match with iOS screenshot
                    SettingsMenuSection(title = "계정 관리") {
                        SettingsMenuItem(
                            icon = Icons.Default.Person,
                            iconColor = Color(0xFF6271D8),
                            iconBg = Color(0xFFE8EAF6),
                            title = "계정설정",
                            onClick = { isAccountSettingsVisible = true }
                        )
                    }

                    SettingsMenuSection(title = "약관 & 정책") {
                        SettingsMenuItem(icon = Icons.Default.Description, iconColor = Color(0xFF00BCD4), iconBg = Color(0xFFE0F7FA), title = "서비스 이용약관", onClick = { selectedTermsScreen = "service" })
                        HorizontalDivider(color = Color(0xFFF5F5F5), thickness = 1.dp, modifier = Modifier.padding(start = 56.dp))
                        SettingsMenuItem(icon = Icons.Default.Shield, iconColor = Color(0xFF03A9F4), iconBg = Color(0xFFE1F5FE), title = "개인정보 처리방침", onClick = { selectedTermsScreen = "privacy" })
                        HorizontalDivider(color = Color(0xFFF5F5F5), thickness = 1.dp, modifier = Modifier.padding(start = 56.dp))
                        SettingsMenuItem(icon = Icons.Default.NearMe, iconColor = Color(0xFF9C27B0), iconBg = Color(0xFFF3E5F5), title = "위치기반서비스 이용약관", onClick = { selectedTermsScreen = "location" })
                        HorizontalDivider(color = Color(0xFFF5F5F5), thickness = 1.dp, modifier = Modifier.padding(start = 56.dp))
                        SettingsMenuItem(icon = Icons.Default.Star, iconColor = Color(0xFF3F51B5), iconBg = Color(0xFFE8EAF6), title = "마케팅 정보 수집 및 이용 동의", onClick = { selectedTermsScreen = "marketing" })
                        HorizontalDivider(color = Color(0xFFF5F5F5), thickness = 1.dp, modifier = Modifier.padding(start = 56.dp))
                        SettingsMenuItem(icon = Icons.Default.Groups, iconColor = Color(0xFFE91E63), iconBg = Color(0xFFFCE4EC), title = "개인정보 제3자 제공 동의", onClick = { selectedTermsScreen = "thirdparty" })
                    }

                    SettingsMenuSection(title = "고객 지원") {
                        SettingsMenuItem(icon = Icons.AutoMirrored.Filled.MenuBook, iconColor = Color(0xFFFFB300), iconBg = Color(0xFFFFFDE7), title = "사용 가이드", onClick = { isUserGuideVisible = true })
                        HorizontalDivider(color = Color(0xFFF5F5F5), thickness = 1.dp, modifier = Modifier.padding(start = 56.dp))
                        SettingsMenuItem(icon = Icons.Default.Email, iconColor = Color(0xFFFF9800), iconBg = Color(0xFFFFF3E0), title = "1:1 문의", onClick = { isInquiryVisible = true })
                        HorizontalDivider(color = Color(0xFFF5F5F5), thickness = 1.dp, modifier = Modifier.padding(start = 56.dp))
                        SettingsMenuItem(icon = Icons.Default.Notifications, iconColor = Color(0xFFF44336), iconBg = Color(0xFFFFEBEE), title = "공지사항", onClick = { isNoticeListVisible = true })
                    }
                    
                    // Version Info
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text("SMAP", fontFamily = SuiteFont, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color.Gray)
                        Text("버전 3.0.4", fontFamily = SuiteFont, fontSize = 12.sp, color = Color.Gray.copy(alpha = 0.8f))
                    }
                    
                    Spacer(modifier = Modifier.height(40.dp))
                }
            }
        }

        // Sub-screens Navigation with Slide Animations
        AnimatedVisibility(
            visible = isAccountSettingsVisible,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            AccountSettingsScreen(
                onBack = { isAccountSettingsVisible = false },
                onLogout = {
                    isAccountSettingsVisible = false
                    onLogout()
                },
                viewModel = viewModel
            )
        }
        
        AnimatedVisibility(
            visible = selectedTermsScreen != null,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            val termsType = selectedTermsScreen ?: lastTermsType
            termsType?.let { type ->
                when (type) {
                    "service" -> ServiceTermsScreen(onBack = { selectedTermsScreen = null })
                    "privacy" -> PrivacyPolicyScreen(onBack = { selectedTermsScreen = null })
                    "location" -> LocationTermsScreen(onBack = { selectedTermsScreen = null })
                    "marketing" -> MarketingConsentScreen(onBack = { selectedTermsScreen = null })
                    "thirdparty" -> ThirdPartyProvisionScreen(onBack = { selectedTermsScreen = null })
                }
            }
        }
        
        AnimatedVisibility(
            visible = isUserGuideVisible,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            UserGuideScreen(onBack = { isUserGuideVisible = false })
        }
        
        AnimatedVisibility(
            visible = isInquiryVisible,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            InquiryScreen(onBack = { isInquiryVisible = false })
        }
        
        AnimatedVisibility(
            visible = isNoticeListVisible && selectedNotice == null,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            NoticeListScreen(
                onBack = { isNoticeListVisible = false },
                onNoticeClick = { notice: SmapNotice -> selectedNotice = notice }
            )
        }
        
        AnimatedVisibility(
            visible = selectedNotice != null,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            val noticeToDisplay = selectedNotice ?: lastNotice
            noticeToDisplay?.let { notice ->
                NoticeDetailScreen(
                    notice = notice,
                    onBack = { selectedNotice = null }
                )
            }
        }
    }
}

@Composable
fun ProfileSummaryCard(
    name: String,
    email: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(24.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(BrandColors.Primary, BrandColors.Secondary)
                    )
                )
                .padding(20.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Avatar Placeholder
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .background(Color.White.copy(alpha = 0.2f), CircleShape)
                        .padding(2.dp)
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.6f),
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(12.dp)
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = name,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        Surface(
                            color = Color.White.copy(alpha = 0.2f),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text(
                                text = "일반",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                color = Color.White
                            )
                        }
                    }
                    Text(
                        text = email,
                        fontFamily = SuiteFont,
                        fontSize = 13.sp,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }

                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.5f)
                )
            }
        }
    }
}

@Composable
fun SettingsMenuSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = title,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp, // Slightly smaller
                color = Color.Black
            )
            HorizontalDivider(
                modifier = Modifier.weight(1f),
                thickness = 0.5.dp, // Thinner divider
                color = Color.Black.copy(alpha = 0.05f)
            )
        }
        
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(28.dp), // More rounded
            modifier = Modifier.fillMaxWidth(),
            shadowElevation = 0.dp // Usually flat in iOS with subtle border or just background contrast
        ) {
            Column(content = content)
        }
    }
}

@Composable
fun SettingsMenuItem(
    icon: ImageVector,
    iconColor: Color,
    iconBg: Color = Color.Transparent,
    title: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(iconBg, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(22.dp) // Slightly larger icon
            )
        }

        Text(
            text = title,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            fontSize = 16.sp,
            color = Color(0xFF333333),
            modifier = Modifier.weight(1f)
        )

        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = Color(0xFFD1D1D6), // iOS systemGray4
            modifier = Modifier.size(20.dp)
        )
    }
}
