package com.dmonster.smap.ui.navigation

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.dmonster.smap.ui.activitylog.ActivityLogScreen
import com.dmonster.smap.ui.group.GroupScreen
import com.dmonster.smap.ui.home.GroupCreationScreen
import com.dmonster.smap.ui.home.HomeScreen
import com.dmonster.smap.ui.home.HomeViewModel
import com.dmonster.smap.ui.myplace.MyPlaceScreen
import com.dmonster.smap.ui.schedule.ScheduleScreen
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
    data object Home : TabItem("홈", Icons.Filled.Home, Icons.Filled.Home)
    data object Group : TabItem("그룹", Icons.Filled.Groups, Icons.Filled.Groups)
    data object Schedule : TabItem("일정", Icons.Filled.CalendarMonth, Icons.Filled.CalendarMonth)
    data object MyPlace : TabItem("내장소", Icons.Filled.LocationOn, Icons.Filled.LocationOn)
    data object ActivityLog : TabItem("활동 로그", Icons.Filled.History, Icons.Filled.History)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainTabScreen(
    onLogout: () -> Unit
) {
    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val view = LocalView.current
    
    // HomeViewModel to access group creation modal state
    val homeViewModel: HomeViewModel = viewModel()
    val showGroupCreationModal by homeViewModel.showGroupCreationModal.collectAsState()
    val isCreatingGroup by homeViewModel.isCreatingGroup.collectAsState()
    val errorMessage by homeViewModel.errorMessage.collectAsState()
    
    val tabs = listOf(
        TabItem.Home,
        TabItem.Group,
        TabItem.Schedule,
        TabItem.MyPlace,
        TabItem.ActivityLog
    )
    
    Box(modifier = Modifier.fillMaxSize()) {
        // Content Area - 하단 탭바 높이만큼 패딩
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 80.dp) // Navigation bar 높이 (약 80dp)
        ) {
            when (selectedTabIndex) {
                0 -> HomeScreen(viewModel = homeViewModel, onLogout = onLogout)
                1 -> GroupScreen()
                2 -> ScheduleScreen()
                3 -> MyPlaceScreen()
                4 -> ActivityLogScreen()
            }
        }
        
        // Bottom Navigation Bar
        NavigationBar(
            modifier = Modifier.align(Alignment.BottomCenter),
            containerColor = Color.White,
            tonalElevation = 0.dp, // Ensure it's purely white, no tonal tint
            contentColor = BrandColors.Primary
        ) {
            tabs.forEachIndexed { index, tab ->
                val isSelected = selectedTabIndex == index
                
                NavigationBarItem(
                    icon = {
                        Icon(
                            imageVector = if (isSelected) tab.selectedIcon else tab.unselectedIcon,
                            contentDescription = tab.title
                        )
                    },
                    label = {
                        Text(
                            text = tab.title,
                            modifier = Modifier.offset(y = (-4).dp),
                            fontFamily = SuiteFont,
                            fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal,
                            fontSize = 12.sp,
                            maxLines = 1
                        )
                    },
                    selected = isSelected,
                    onClick = {
                        if (selectedTabIndex != index) {
                            // Haptic feedback (iOS와 동일)
                            view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                            selectedTabIndex = index
                        }
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = BrandColors.Primary,
                        selectedTextColor = BrandColors.Primary,
                        unselectedIconColor = Color(0xFF94A3B8), // Slate 400 for better contrast on white
                        unselectedTextColor = Color(0xFF94A3B8),
                        indicatorColor = Color.Transparent // Remove the oval indicator to match iOS style more closely
                    )
                )
            }
        }
        
        // Full-screen Group Creation Modal (covers everything including tab bar)
        if (showGroupCreationModal) {
            GroupCreationScreen(
                isCreating = isCreatingGroup,
                onCreateGroup = { name, desc -> homeViewModel.createGroup(name, desc) },
                errorMessage = errorMessage
            )
        }
    }
}
