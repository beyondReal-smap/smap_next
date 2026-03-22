package com.dmonster.smap.ui.home

import com.dmonster.smap.BuildConfig
import com.dmonster.smap.AppConstants
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.zIndex
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.settings.SettingsScreen
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import android.graphics.PointF
import com.naver.maps.geometry.LatLng
import com.naver.maps.map.CameraPosition
import com.naver.maps.map.CameraUpdate
import com.naver.maps.map.compose.*
import com.naver.maps.map.overlay.OverlayImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.util.Log
import androidx.compose.ui.platform.LocalLifecycleOwner
import coil.request.ImageRequest
import coil.request.SuccessResult
import coil.imageLoader
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver

@OptIn(ExperimentalMaterial3Api::class, ExperimentalNaverMapApi::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = hiltViewModel(),
    onLogout: () -> Unit
) {
    // Collect State
    val groups by viewModel.groups.collectAsState()
    val selectedGroup by viewModel.selectedGroup.collectAsState()
    val members by viewModel.members.collectAsState()
    val filteredSchedules by viewModel.filteredSchedules.collectAsState()
    val calendarDays by viewModel.daysForCalendar.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val isSidebarOpen by viewModel.isSidebarOpen.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    

    // Snackbar Host State for error messages
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Show error message in Snackbar
    LaunchedEffect(errorMessage) {
        errorMessage?.let { message ->
            snackbarHostState.showSnackbar(
                message = message,
                actionLabel = "확인",
                duration = SnackbarDuration.Long
            )
            viewModel.clearError()
        }
    }

    // Map Loading State - Show overlay initially and for minimum 1 second
    var isMapLoading by remember { mutableStateOf(true) }
    
    // Notification Screen State
    var isNotificationVisible by remember { mutableStateOf(false) }
    
    // Settings Screen State
    var isSettingsVisible by remember { mutableStateOf(false) }
    
    // Notification ViewModel
    val notiViewModel: NotificationViewModel = hiltViewModel()
    val unreadCount by notiViewModel.summary.collectAsState()
    val hasUnread = unreadCount.unread > 0
    
    // 화면 진입 시 항상 데이터 새로고침 (위치 포함)
    LaunchedEffect(Unit) {
        Log.d("HomeScreen", "🔄 [HomeScreen] Screen entered - refreshing data")
        viewModel.refreshData()
    }
    
    // 앱이 foreground로 돌아올 때 데이터 새로고침
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                Log.d("HomeScreen", "🔄 [HomeScreen] App resumed - refreshing location data")
                viewModel.refreshData()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }
    
    LaunchedEffect(isLoading) {
        if (!isLoading && isMapLoading) {
            // Wait minimum 1 second before hiding overlay
            delay(1000)
            isMapLoading = false
        }
    }

    // Drawer State
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    // Sync Drawer State with ViewModel
    LaunchedEffect(isSidebarOpen) {
        if (isSidebarOpen) {
            drawerState.open()
        } else {
            drawerState.close()
        }
    }
    
    // Reverse Sync: Drawer gesture close -> ViewModel
    LaunchedEffect(drawerState.isOpen) {
        if (drawerState.isOpen != isSidebarOpen) {
            viewModel.setSidebarOpen(drawerState.isOpen)
        }
    }

    // Naver Map Camera State
    val cameraPositionState = rememberCameraPositionState {
        // Default position (Seoul City Hall) - 위치 권한이 없을 때 기본값
        position = CameraPosition(
            LatLng(AppConstants.DefaultLocation.LATITUDE, AppConstants.DefaultLocation.LONGITUDE), 
            AppConstants.MapZoom.DEFAULT
        )
    }

    // Info Window Position (Screen Coordinates)
    var markerScreenPosition by remember { mutableStateOf<PointF?>(null) }

    // Member Avatars State (Map of mtIdx to Bitmap)
    val memberAvatars = remember { mutableStateMapOf<Int, Bitmap>() }
    
    // Load Member Avatars
    LaunchedEffect(members) {
        members.forEach { member ->
            if (!member.mtFile1.isNullOrBlank() && !memberAvatars.containsKey(member.mtIdx)) {
                val imageUrl = when {
                    member.mtFile1.startsWith("http") -> member.mtFile1
                    member.mtFile1.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}${member.mtFile1}"
                    member.mtFile1.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images${member.mtFile1}"
                    else -> "${BuildConfig.IMAGE_BASE_URL}/images/${member.mtFile1}"
                }
                
                scope.launch {
                    try {
                        val request = ImageRequest.Builder(context)
                            .data(imageUrl)
                            .size(100) // Small size for marker
                            .allowHardware(false) // Disable hardware bitmaps for custom drawing
                            .build()
                        val result = (context.imageLoader.execute(request) as? SuccessResult)?.drawable
                        (result as? BitmapDrawable)?.bitmap?.let { 
                            memberAvatars[member.mtIdx] = it 
                        }
                    } catch (e: Exception) {
                        Log.e("HomeScreen", "Error loading marker avatar for ${member.displayName}: ${e.message}")
                    }
                }
            }
        }
    }

    // Effect: Move camera when member selected or group changes
    LaunchedEffect(members, filteredSchedules) {
        val selectedMember = members.find { it.isSelected }
        
        if (selectedMember != null && selectedMember.mltLat != null && selectedMember.mltLong != null) {
            // 1. Zoom to selected member
            cameraPositionState.animate(
                update = CameraUpdate.scrollAndZoomTo(LatLng(selectedMember.mltLat!!, selectedMember.mltLong!!), 16.0)
                    .animate(com.naver.maps.map.CameraAnimation.Fly, 1000)
            )
        } else {
            // 2. If no member selected or no location, try to fit all markers
            val markerPoints = mutableListOf<LatLng>()
            
            // Add member locations
            members.forEach { m ->
                if (m.mltLat != null && m.mltLong != null) {
                    markerPoints.add(LatLng(m.mltLat!!, m.mltLong!!))
                }
            }
            
            // Add schedule locations
            filteredSchedules.forEach { s ->
                if (s.sstLocationLat != null && s.sstLocationLong != null) {
                    markerPoints.add(LatLng(s.sstLocationLat!!, s.sstLocationLong!!))
                }
            }
            
            if (markerPoints.isNotEmpty()) {
                val bounds = com.naver.maps.geometry.LatLngBounds.Builder()
                    .include(markerPoints)
                    .build()
                
                cameraPositionState.animate(
                    update = CameraUpdate.fitBounds(bounds, 150) // 150px padding
                        .animate(com.naver.maps.map.CameraAnimation.Fly, 1000)
                )
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet(
                    drawerContainerColor = Color.White,
                    modifier = Modifier.width(320.dp)
                ) {
                    HomeSidebar(
                        groups = groups,
                        selectedGroup = selectedGroup,
                        onGroupSelected = { viewModel.selectGroup(it) },
                        calendarDays = calendarDays,
                        selectedDate = selectedDate,
                        onDateSelected = { viewModel.selectDate(it) },
                        members = members,
                        onMemberSelected = { memberId ->
                            viewModel.selectMember(memberId)
                            scope.launch { drawerState.close() }
                        },
                        currentUserIdx = viewModel.getCurrentUserIdx(),
                        getMemberStats = { mtIdx -> viewModel.getMemberTodayStats(mtIdx) }
                    )
                }
            },
            gesturesEnabled = false
        ) {
            Scaffold(
                snackbarHost = { SnackbarHost(snackbarHostState) }
            ) { paddingValues ->
                Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
                    // 1. Naver Map Layer
                    NaverMap(
                        modifier = Modifier.fillMaxSize(),
                        cameraPositionState = cameraPositionState,
                        uiSettings = MapUiSettings(
                            isZoomControlEnabled = false,
                            isLocationButtonEnabled = false,
                            isLogoClickEnabled = false
                        ),
                        contentPadding = PaddingValues(top = 60.dp)
                    ) {
                        // Member Markers (Show all members with locations)
                        members.forEach { member ->
                            if (member.mltLat != null && member.mltLong != null) {
                                val avatarBitmap = memberAvatars[member.mtIdx]
                                val memberMarkerBitmap = remember(member.mtIdx, member.displayName, member.isSelected, avatarBitmap) {
                                    MarkerUtils.createMemberMarkerBitmap(context, member.displayName, member.isSelected, avatarBitmap)
                                }
                                
                                Marker(
                                    state = MarkerState(position = LatLng(member.mltLat!!, member.mltLong!!)),
                                    icon = OverlayImage.fromBitmap(memberMarkerBitmap),
                                    zIndex = if (member.isSelected) 2000 else 100,
                                    onClick = {
                                        viewModel.selectMember(member.mtIdx)
                                        true
                                    }
                                )
                            }
                        }

                        // Schedule Markers
                        filteredSchedules.forEachIndexed { index, schedule ->
                            val lat = schedule.sstLocationLat
                            val lng = schedule.sstLocationLong
                            if (lat != null && lng != null) {
                                val markerBitmap = remember(schedule, index) {
                                    MarkerUtils.createScheduleMarkerBitmap(context, schedule, index)
                                }
                                
                                Marker(
                                    state = MarkerState(position = LatLng(lat, lng)),
                                    icon = OverlayImage.fromBitmap(markerBitmap),
                                    zIndex = 1000,
                                    onClick = {
                                        // TODO: Show Schedule Detail InfoWindow
                                        true
                                    }
                                )
                            }
                        }

                        // Effect: Update InfoWindow screen position
                        MapEffect(members, cameraPositionState.position, cameraPositionState.isMoving) { map ->
                            val selected = members.find { it.isSelected }
                            if (selected != null && selected.mltLat != null && selected.mltLong != null) {
                                markerScreenPosition = map.projection.toScreenLocation(LatLng(selected.mltLat!!, selected.mltLong!!))
                            } else {
                                markerScreenPosition = null
                            }
                        }
                    }
                    
                    // 2. Member Info Window (Anchored Overlay)
                    // Place it here so it's behind the Header and Loading Overlay
                    val selectedMember = members.find { it.isSelected }
                    if (selectedMember != null && markerScreenPosition != null) {
                        Box(
                            modifier = Modifier
                                .offset(
                                    x = with(LocalDensity.current) { (markerScreenPosition!!.x / density).dp } - 90.dp,
                                    y = with(LocalDensity.current) { (markerScreenPosition!!.y / density).dp } - 180.dp
                                )
                        ) {
                            MemberInfoWindow(
                                member = selectedMember,
                                onClose = { viewModel.deselectAllMembers() }
                            )
                        }
                    }

                    // 3. Header
                    HomeHeaderView(
                        title = "홈",
                        hasUnread = hasUnread,
                        onNotificationTap = { isNotificationVisible = true },
                        onSettingsTap = { isSettingsVisible = true }
                    )
                }
            }
        }
        
        // 4. Floating Action Button (Hidden during map loading)
        AnimatedVisibility(
            visible = !isMapLoading,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 20.dp)
        ) {
            FloatingActionHomeButton(
                memberCount = members.size,
                onClick = { viewModel.toggleSidebar() }
            )
        }

        // 5. Notification Screen Overlay (Slide-up Animation)
        AnimatedVisibility(
            visible = isNotificationVisible,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier.fillMaxSize()
        ) {
            NotificationScreen(
                onClose = { 
                    isNotificationVisible = false
                    notiViewModel.markAllAsRead() // iOS 스타일: 열람 시 모두 읽음 처리하거나 적절한 시점에 처리
                },
                viewModel = notiViewModel
            )
        }

        // 6. Settings Screen Overlay (Slide-up Animation)
        AnimatedVisibility(
            visible = isSettingsVisible,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier.fillMaxSize()
        ) {
            SettingsScreen(
                onClose = { isSettingsVisible = false },
                onLogout = {
                    isSettingsVisible = false
                    onLogout()
                }
            )
        }
        
        // 7. Map Loading Overlay (Covers entire screen including header)
        AnimatedVisibility(
            visible = isMapLoading,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize().zIndex(25f)
        ) {
            MapLoadingOverlay()
        }
    }
}
