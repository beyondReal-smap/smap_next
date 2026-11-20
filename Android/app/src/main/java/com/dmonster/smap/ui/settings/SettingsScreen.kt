package com.dmonster.smap.ui.settings

import androidx.compose.foundation.layout.navigationBarsPadding
import com.dmonster.smap.data.model.SMAPUser
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.components.SmapOnNavyMuted
import com.dmonster.smap.ui.components.SmapAccent
import com.dmonster.smap.ui.components.SmapAccentTheme
import com.dmonster.smap.ui.components.SmapAvatar
import com.dmonster.smap.ui.components.HeroHeading
import com.dmonster.smap.ui.components.SmapFamilyCover
import com.dmonster.smap.R
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
import androidx.compose.foundation.isSystemInDarkTheme
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
import com.dmonster.smap.ui.theme.FamilyColors
import com.dmonster.smap.ui.theme.SuiteFont

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onClose: () -> Unit,
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) = SmapAccentTheme(SmapAccent.Family) {
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

    val canvas = MaterialTheme.colorScheme.surface
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(canvas)
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
            val user by viewModel.user.collectAsState()
            val haptics = rememberSmapHaptics()
            fun open(action: () -> Unit) { haptics.light(); action() }
            Column(modifier = Modifier.fillMaxSize().background(canvas)) {
                SmapTopBar(title = "설정", onBack = onClose)
                Column(
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally).widthIn(max = 600.dp).fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg)
                ) {
                    Spacer(Modifier.height(SmapSpacing.xs))
                    SettingsProfileHero(user = user, onClick = { open { isAccountSettingsVisible = true } })

                    SmapSection(title = "멤버십") {
                        SmapListRow(
                            title = "도착했어 프리미엄",
                            leading = { SmapRowIcon(Icons.Default.WorkspacePremium, emphasized = true) },
                            trailing = { SettingsChevron() },
                            onClick = { open { GlobalEventBus.tryEmit(GlobalEvent.OpenSubscriptionScreen) } }
                        )
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("고객 지원", style = SmapText.bodyBold, color = MaterialTheme.colorScheme.onSurface)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            SupportLink("사용 가이드", Icons.AutoMirrored.Filled.MenuBook, Modifier.weight(1f)) { open { isUserGuideVisible = true } }
                            SupportLink("1:1 문의", Icons.Default.Email, Modifier.weight(1f)) { open { isInquiryVisible = true } }
                            SupportLink("공지사항", Icons.Default.Campaign, Modifier.weight(1f)) { open { isNoticeListVisible = true } }
                        }
                    }

                    SmapSection(title = "약관 및 정책") {
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
    SmapFamilyCover(
        image = R.drawable.login_arrival_doorway,
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
                HeroHeading(eyebrow = "계정설정", title = name, subtitle = user?.mtEmail?.takeIf { it.isNotBlank() })
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = SmapOnNavyMuted)
        }
    }
}

@Composable
private fun SettingsChevron() {
    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(20.dp))
}

@Composable
private fun SupportLink(title: String, icon: ImageVector, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(role = Role.Button, onClick = onClick).heightIn(min = 74.dp).padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(9.dp, Alignment.CenterVertically),
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        Text(title, style = SmapText.captionBold, color = MaterialTheme.colorScheme.onSurface)
    }
}
