package com.dmonster.smap.ui.settings

import androidx.compose.foundation.layout.navigationBarsPadding
import com.dmonster.smap.data.model.SMAPUser
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.components.SmapOnNavyMuted
import com.dmonster.smap.ui.components.SmapAvatar
import com.dmonster.smap.ui.components.HeroHeading
import com.dmonster.smap.ui.components.SmapHeroCard
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.components.SmapTopBar
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.activity.compose.BackHandler

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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import com.dmonster.smap.data.model.SmapNotice
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

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

    BackHandler(enabled = isAnySubScreenVisible) {
        when {
            selectedNotice != null -> selectedNotice = null
            isNoticeListVisible -> isNoticeListVisible = false
            isInquiryVisible -> isInquiryVisible = false
            isUserGuideVisible -> isUserGuideVisible = false
            selectedTermsScreen != null -> selectedTermsScreen = null
            isAccountSettingsVisible -> isAccountSettingsVisible = false
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .navigationBarsPadding()
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
            // 37단계 남색 강조 — 설정 첫 화면도 다른 탭과 같은 언어로: 위에 남색 프로필 카드,
            // 아래는 "구역 제목 + 흰 묶음" 행. 이전에는 메뉴마다 하늘·보라·분홍·주황 아이콘이라 산만했다.
            val user by viewModel.user.collectAsState()
            val haptics = rememberSmapHaptics()
            fun open(action: () -> Unit) { haptics.light(); action() }
            Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
                SmapTopBar(title = "설정", onBack = onClose)
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = SmapSpacing.md),
                    verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg)
                ) {
                    Spacer(Modifier.height(SmapSpacing.xs))
                    SettingsProfileHero(user = user, onClick = { open { isAccountSettingsVisible = true } })

                    SmapSection(title = "계정 관리") {
                        SmapListRow(title = "계정설정", leading = { SmapRowIcon(Icons.Default.Person) }, trailing = { SettingsChevron() }, onClick = { open { isAccountSettingsVisible = true } })
                        SmapRowDivider()
                        SmapListRow(
                            title = "도착했어 프리미엄",
                            leading = { SmapRowIcon(Icons.Default.WorkspacePremium, emphasized = true) },
                            trailing = { SettingsChevron() },
                            onClick = { open { GlobalEventBus.tryEmit(GlobalEvent.OpenSubscriptionScreen) } }
                        )
                    }

                    SmapSection(title = "약관 & 정책") {
                        SmapListRow(title = "서비스 이용약관", leading = { SmapRowIcon(Icons.Default.Description) }, trailing = { SettingsChevron() }, onClick = { open { selectedTermsScreen = "service" } })
                        SmapRowDivider()
                        SmapListRow(title = "개인정보 처리방침", leading = { SmapRowIcon(Icons.Default.Shield) }, trailing = { SettingsChevron() }, onClick = { open { selectedTermsScreen = "privacy" } })
                        SmapRowDivider()
                        SmapListRow(title = "위치기반서비스 이용약관", leading = { SmapRowIcon(Icons.Default.NearMe) }, trailing = { SettingsChevron() }, onClick = { open { selectedTermsScreen = "location" } })
                        SmapRowDivider()
                        SmapListRow(title = "마케팅 정보 수집 및 이용 동의", leading = { SmapRowIcon(Icons.Default.Star) }, trailing = { SettingsChevron() }, onClick = { open { selectedTermsScreen = "marketing" } })
                        SmapRowDivider()
                        SmapListRow(title = "개인정보 제3자 제공 동의", leading = { SmapRowIcon(Icons.Default.Groups) }, trailing = { SettingsChevron() }, onClick = { open { selectedTermsScreen = "thirdparty" } })
                    }

                    SmapSection(title = "고객 지원") {
                        SmapListRow(title = "사용 가이드", leading = { SmapRowIcon(Icons.AutoMirrored.Filled.MenuBook) }, trailing = { SettingsChevron() }, onClick = { open { isUserGuideVisible = true } })
                        SmapRowDivider()
                        SmapListRow(title = "1:1 문의", leading = { SmapRowIcon(Icons.Default.Email) }, trailing = { SettingsChevron() }, onClick = { open { isInquiryVisible = true } })
                        SmapRowDivider()
                        SmapListRow(title = "공지사항", leading = { SmapRowIcon(Icons.Default.Notifications) }, trailing = { SettingsChevron() }, onClick = { open { isNoticeListVisible = true } })
                    }

                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = SmapSpacing.lg),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text("도착했어", style = SmapText.captionBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("버전 ${BuildConfig.VERSION_NAME}", style = SmapText.captionSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(modifier = Modifier.height(SmapSpacing.xl))
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
                    contentDescription = "프로필 수정",
                    tint = Color.White.copy(alpha = 0.5f)
                )
            }
        }
    }
}

/**
 * 설정 맨 위 남색 프로필 카드 — 누르면 계정설정. 사진이 없으면 이름 첫 글자 원.
 */
@Composable
private fun SettingsProfileHero(user: SMAPUser?, onClick: () -> Unit) {
    val name = user?.mtNickname?.takeIf { it.isNotBlank() } ?: user?.mtName?.takeIf { it.isNotBlank() } ?: "회원"
    SmapHeroCard(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .clickable(onClickLabel = "계정설정 열기", role = Role.Button, onClick = onClick)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(60.dp)
                    .background(Color.White.copy(alpha = 0.22f), CircleShape)
                    .padding(3.dp)
            ) { SmapAvatar(name = name, imagePath = user?.mtFile1, size = 54.dp) }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                HeroHeading(eyebrow = "내 계정", title = name, subtitle = user?.mtEmail?.takeIf { it.isNotBlank() })
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = SmapOnNavyMuted)
        }
    }
}

@Composable
private fun SettingsChevron() {
    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(20.dp))
}
