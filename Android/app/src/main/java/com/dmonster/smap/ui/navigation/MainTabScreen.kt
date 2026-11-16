package com.dmonster.smap.ui.navigation

import kotlinx.coroutines.launch
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.FastOutSlowInEasing
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
import com.dmonster.smap.ui.components.SmapAccent
import com.dmonster.smap.ui.components.SmapAccentTheme
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
    // 탭 전환 좌우 슬라이드 — 이전에는 한 프레임에 화면 전체가 바뀌어 "깜빡"이는 것처럼 보였다.
    // 왼쪽 탭 → 오른쪽 탭이면 새 화면이 오른쪽에서 들어오고, 반대면 왼쪽에서 들어온다.
    // 진행률은 탭을 누르는 순간 0 으로 바꿔(동기) 첫 프레임부터 이전 화면이 그대로 보이게 한다.
    var transitionFrom by remember { mutableStateOf<Int?>(null) }
    var transitionProgress by remember { mutableFloatStateOf(1f) }
    val tabScope = rememberCoroutineScope()
    var tabTransitionJob by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }
    fun switchTab(index: Int) {
        if (index == selectedTabIndex) return
        tabTransitionJob?.cancel()
        transitionFrom = selectedTabIndex
        transitionProgress = 0f
        selectedTabIndex = index
        tabTransitionJob = tabScope.launch {
            androidx.compose.animation.core.animate(
                initialValue = 0f,
                targetValue = 1f,
                animationSpec = tween(durationMillis = 280, easing = FastOutSlowInEasing),
            ) { value, _ -> transitionProgress = value }
            transitionFrom = null
        }
    }
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
        switchTab(0)
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0), // 시스템 인셋 수동 제어
        bottomBar = {
            // 그룹 시작 화면(전체 화면 모달)이 떠 있을 때도 탭바를 숨긴다. 이전에는 모달 아래로 탭바가 보여
            // 눌러도 선택 표시만 바뀌고 화면은 그대로여서 고장 난 것처럼 보였다.
            if (!showSubscriptionScreen && !showGroupCreationModal && !(selectedTabIndex == 0 && homeOverlayOpen)) CompositionLocalProvider(LocalRippleConfiguration provides null) { NavigationBar(
                modifier = Modifier, // Remove fixed height to allow flexible inset-based taller height on gesture nav
                containerColor = Color.White,
                tonalElevation = 0.dp,
                contentColor = BrandColors.Primary
                // NavigationBar naturally handles NavigationBarDefaults.windowInsets
            ) {
                tabs.forEachIndexed { index, tab ->
                    val isSelected = selectedTabIndex == index
                    // 선택된 탭 글자·아이콘은 그 메뉴의 강조색
                    val tabColor = SmapAccent.forTab(index).base

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
                                switchTab(index)
                            }
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = tabColor,
                            selectedTextColor = tabColor,
                            unselectedIconColor = Color(0xFF94A3B8),
                            unselectedTextColor = Color(0xFF94A3B8),
                            indicatorColor = Color.Transparent
                        )
                    )
                }
            } }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .consumeWindowInsets(innerPadding) // 하위 화면에서 중복 패딩 방지
        ) {
            val from = transitionFrom
            Layout(
                modifier = Modifier.clipToBounds(),
                content = {
                    // 탭마다 강조색을 따로 준다(홈 남색·그룹 청록·일정 주황·내장소 보라·활동 로그 장미) — 전부 남색이라 단조로웠다.
                    // 지도 탭은 한 번 열면 계속 살려 둔다(지도·상태 유지). 그룹·일정은 보일 때와 밀려 나가는 동안만 둔다.
                    Box(Modifier.layoutId(0)) { SmapAccentTheme(SmapAccent.forTab(0)) { HomeScreen(viewModel = homeViewModel, onLogout = onLogout, isVisible = selectedTabIndex == 0, onOverlayVisibleChange = { homeOverlayOpen = it }) } }
                    if (visitedMyPlace) Box(Modifier.layoutId(3)) { SmapAccentTheme(SmapAccent.forTab(3)) { MyPlaceScreen(isVisible = selectedTabIndex == 3) } }
                    if (visitedActivityLog) Box(Modifier.layoutId(4)) { SmapAccentTheme(SmapAccent.forTab(4)) { ActivityLogScreen(isVisible = selectedTabIndex == 4) } }
                    if (selectedTabIndex == 1 || from == 1) Box(Modifier.layoutId(1)) { SmapAccentTheme(SmapAccent.forTab(1)) { GroupScreen() } }
                    if (selectedTabIndex == 2 || from == 2) Box(Modifier.layoutId(2)) { SmapAccentTheme(SmapAccent.forTab(2)) { ScheduleScreen() } }
                },
            ) { measurables, constraints ->
                val placeables = measurables.associate { (it.layoutId as Int) to it.measure(constraints) }
                val width = constraints.maxWidth
                layout(width, constraints.maxHeight) {
                    if (from == null || from == selectedTabIndex) {
                        placeables[selectedTabIndex]?.placeRelative(0, 0)
                    } else {
                        val direction = if (selectedTabIndex > from) 1 else -1
                        val p = transitionProgress
                        placeables[from]?.placeRelative((-direction * width * p).toInt(), 0)
                        placeables[selectedTabIndex]?.placeRelative((direction * width * (1f - p)).toInt(), 0)
                    }
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
