package com.dmonster.smap.ui.navigation

import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.filled.People
import android.view.HapticFeedbackConstants
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import com.dmonster.smap.ui.activitylog.ActivityLogScreen
import com.dmonster.smap.ui.chat.ChatScreen
import com.dmonster.smap.ui.group.GroupScreen
import com.dmonster.smap.ui.home.GroupCreationScreen
import com.dmonster.smap.ui.home.HomeScreen
import com.dmonster.smap.ui.home.HomeViewModel
import com.dmonster.smap.ui.myplace.MyPlaceScreen
import com.dmonster.smap.ui.schedule.ScheduleScreen
import com.dmonster.smap.ui.subscription.SubscriptionScreen
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

/**
 * iOS MainTabView와 동일한 5개 탭을 가진 메인 화면
 * - 홈, 그룹, 일정, 내장소, 활동 로그
 */

sealed class TabItem(
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    data object Home : TabItem("홈", Icons.Filled.Home, Icons.Outlined.Home)
    data object Group : TabItem("그룹", Icons.Filled.People, Icons.Outlined.People)
    data object Schedule : TabItem("일정", Icons.Filled.CalendarMonth, Icons.Outlined.CalendarMonth)
    data object MyPlace : TabItem("내장소", Icons.Filled.LocationOn, Icons.Outlined.Place)
    data object ActivityLog : TabItem("활동 로그", Icons.Filled.History, Icons.Outlined.History)
    data object Chat : TabItem("채팅", Icons.Filled.Chat, Icons.Filled.Chat)
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun MainTabScreen(
    onLogout: () -> Unit
) {
    var selectedTabIndex by rememberSaveable { mutableIntStateOf(0) }
    val view = LocalView.current
    var visitedMyPlace by rememberSaveable { mutableStateOf(false) }
    var visitedActivityLog by rememberSaveable { mutableStateOf(false) }
    // 홈의 설정·알림 오버레이가 열려 있으면 하단 탭바를 가려, 오버레이 위로 탭바가 노출되거나
    // 오버레이를 연 채 탭을 바꿔 설정 상태가 사라지는 일을 막는다.
    var homeOverlayOpen by remember { mutableStateOf(false) }
    var showSubscriptionScreen by rememberSaveable { mutableStateOf(false) }
    if (selectedTabIndex == 3) visitedMyPlace = true
    if (selectedTabIndex == 4) visitedActivityLog = true

    LaunchedEffect(Unit) {
        GlobalEventBus.events.collect { event ->
            if (event is GlobalEvent.OpenSubscriptionScreen) {
                showSubscriptionScreen = true
            }
        }
    }
    
    // HomeViewModel to access group creation modal state
    val homeViewModel: HomeViewModel = hiltViewModel()
    val showGroupCreationModal by homeViewModel.showGroupCreationModal.collectAsState()
    val isCreatingGroup by homeViewModel.isCreatingGroup.collectAsState()
    val errorMessage by homeViewModel.errorMessage.collectAsState()
    
    val tabs = listOf(
        TabItem.Home,
        TabItem.Group,
        TabItem.Schedule,
        TabItem.MyPlace,
        TabItem.ActivityLog
        // TabItem.Chat  // TODO: 채팅 기능 완성 후 활성화
    )

    // 보조 탭에서 시스템 Back 시 앱 종료 대신 홈 탭으로 복귀(Android 관례).
    // 홈 탭(0)에서는 비활성화하여 기본 동작을 따른다. 내부(모달 등)의 BackHandler가
    // 더 안쪽에 컴포즈되면 그쪽이 우선 처리한다.
    BackHandler(enabled = selectedTabIndex != 0) {
        selectedTabIndex = 0
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0), // 시스템 인셋 수동 제어
        bottomBar = {
            // 그룹 시작 화면(전체 화면 모달)이 떠 있을 때도 탭바를 숨긴다. 이전에는 모달 아래로 탭바가 보여
            // 눌러도 선택 표시만 바뀌고 화면은 그대로여서 고장 난 것처럼 보였다.
            if (!showSubscriptionScreen && !showGroupCreationModal && !(selectedTabIndex == 0 && homeOverlayOpen)) NavigationBar(
                modifier = Modifier, // Remove fixed height to allow flexible inset-based taller height on gesture nav
                containerColor = Color.White,
                tonalElevation = 0.dp,
                contentColor = BrandColors.Primary
                // NavigationBar naturally handles NavigationBarDefaults.windowInsets
            ) {
                tabs.forEachIndexed { index, tab ->
                    val isSelected = selectedTabIndex == index
                    
                    NavigationBarItem(
                        icon = {
                            Icon(
                                imageVector = if (isSelected) tab.selectedIcon else tab.unselectedIcon,
                                // 라벨 Text 가 탭 이름을 읽어주므로 아이콘은 null 로 두어
                                // TalkBack 의 "홈 홈" 이중 읽기를 방지한다. 선택 상태는
                                // NavigationBarItem 의 selected 시맨틱이 전달한다.
                                contentDescription = null
                            )
                        },
                        label = {
                            Text(
                                text = tab.title,
                                modifier = Modifier.offset(y = (-4).dp),
                                fontFamily = SuiteFont,
                                fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal,
                                fontSize = 13.sp,
                                maxLines = 1
                            )
                        },
                        selected = isSelected,
                        onClick = {
                            if (selectedTabIndex != index) {
                                view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                                selectedTabIndex = index
                            }
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = BrandColors.Primary,
                            selectedTextColor = BrandColors.Primary,
                            unselectedIconColor = Color(0xFF94A3B8),
                            unselectedTextColor = Color(0xFF94A3B8),
                            indicatorColor = Color.Transparent
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .consumeWindowInsets(innerPadding) // 하위 화면에서 중복 패딩 방지
        ) {
            Layout(content = {
                Box { HomeScreen(viewModel = homeViewModel, onLogout = onLogout, isVisible = selectedTabIndex == 0, onOverlayVisibleChange = { homeOverlayOpen = it }) }
                if (visitedMyPlace) Box { MyPlaceScreen(isVisible = selectedTabIndex == 3) }
                if (visitedActivityLog) Box { ActivityLogScreen(isVisible = selectedTabIndex == 4) }
                if (selectedTabIndex == 1) Box { GroupScreen() }
                if (selectedTabIndex == 2) Box { ScheduleScreen() }
            }) { measurables, constraints ->
                val placeables = measurables.map { it.measure(constraints) }
                val visibleIndex = when (selectedTabIndex) {
                    0 -> 0
                    3 -> 1
                    4 -> 1 + if (visitedMyPlace) 1 else 0
                    else -> placeables.lastIndex
                }
                layout(constraints.maxWidth, constraints.maxHeight) {
                    placeables.getOrNull(visibleIndex)?.placeRelative(0, 0)
                }
            }

            // Full-screen Group Creation Modal
            if (showGroupCreationModal) {
                BackHandler {
                    homeViewModel.hideGroupCreationModal()
                }
                GroupCreationScreen(
                    isCreating = isCreatingGroup,
                    onCreateGroup = { name, desc -> homeViewModel.createGroup(name, desc) },
                    onJoinGroup = { inviteCode -> homeViewModel.joinGroup(inviteCode) },
                    errorMessage = errorMessage,
                    onDismiss = { homeViewModel.hideGroupCreationModal() }
                )
            }

            if (showSubscriptionScreen) {
                SubscriptionScreen(
                    onBack = { showSubscriptionScreen = false }
                )
            }
        }
    }
}
