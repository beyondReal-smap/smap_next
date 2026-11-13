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
import androidx.activity.compose.BackHandler
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.memory.MemoryCache
import coil.request.ImageRequest
import coil.request.SuccessResult
import coil.imageLoader
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.repeatOnLifecycle

@OptIn(ExperimentalMaterial3Api::class, ExperimentalNaverMapApi::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = hiltViewModel(),
    onLogout: () -> Unit,
    isVisible: Boolean = true
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
    val selectedMemberId by viewModel.selectedMemberId.collectAsState()

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
    val showGroupCreationModal by viewModel.showGroupCreationModal.collectAsState()
    LaunchedEffect(isVisible) {
        if (!isVisible) {
            isSettingsVisible = false
            isNotificationVisible = false
        }
    }
    
    // Notification ViewModel
    val notiViewModel: NotificationViewModel = hiltViewModel()
    val unreadCount by notiViewModel.summary.collectAsState()
    val hasUnread = unreadCount.unread > 0
    
    // 앱이 foreground로 돌아올 때 데이터 새로고침 (ON_RESUME handles initial load too)
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(lifecycleOwner, isVisible, isSettingsVisible, isNotificationVisible, showGroupCreationModal) {
        if (isVisible && !isSettingsVisible && !isNotificationVisible && !showGroupCreationModal) {
            lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
                while (true) {
                    delay(30_000)
                    viewModel.refreshData()
                }
            }
        }
    }
    DisposableEffect(lifecycleOwner, isVisible) {
        val observer = LifecycleEventObserver { _, event ->
            if (isVisible && event == Lifecycle.Event.ON_RESUME) {
                if (BuildConfig.DEBUG) {
                    Log.d("HomeScreen", "🔄 [HomeScreen] App resumed - refreshing location data")
                }
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

    // Member Avatars — Coil MemoryCache 에 위임해 Compose state 바깥에서 관리.
    // 변경 감지는 version int 증가로 트리거 (State 에 Bitmap 을 보관하지 않음 → recomposition 폭발 방지).
    var avatarCacheVersion by remember { mutableStateOf(0) }
    val imageLoader = remember(context) { context.imageLoader }

    fun avatarCacheKey(mtIdx: Int): String = "memberAvatar:$mtIdx"

    fun avatarBitmap(mtIdx: Int): Bitmap? {
        // memoryCache 는 nullable
        val cache = imageLoader.memoryCache ?: return null
        @Suppress("UNUSED_EXPRESSION") avatarCacheVersion // read — 리컴포지션 키 역할
        return cache[MemoryCache.Key(avatarCacheKey(mtIdx))]?.bitmap
    }

    // 로드 시그니처 — mtIdx + mtFile1 조합만 바뀌었을 때 재실행
    val avatarLoadSignature = remember(members) {
        members.joinToString(";") { "${it.mtIdx}:${it.mtFile1 ?: ""}" }
    }

    // Load Member Avatars into Coil MemoryCache
    LaunchedEffect(isVisible, avatarLoadSignature) {
        if (!isVisible) return@LaunchedEffect
        members.forEach { member ->
            val photo = member.mtFile1
            if (photo.isNullOrBlank()) return@forEach

            val key = MemoryCache.Key(avatarCacheKey(member.mtIdx))
            // 이미 캐시에 있으면 스킵
            if (imageLoader.memoryCache?.get(key) != null) return@forEach

            val imageUrl = when {
                photo.startsWith("http") -> photo
                photo.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}$photo"
                photo.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images$photo"
                else -> "${BuildConfig.IMAGE_BASE_URL}/images/$photo"
            }

            try {
                val request = ImageRequest.Builder(context)
                    .data(imageUrl)
                    .size(128) // 마커용 다운샘플
                    .allowHardware(false) // Canvas 에 그리기 위해 software bitmap
                    .memoryCacheKey(key)
                    .build()
                val result = (imageLoader.execute(request) as? SuccessResult)?.drawable
                (result as? BitmapDrawable)?.bitmap?.let { bmp ->
                    imageLoader.memoryCache?.set(key, MemoryCache.Value(bmp))
                    avatarCacheVersion++
                }
            } catch (e: Exception) {
                if (BuildConfig.DEBUG) {
                    Log.e("HomeScreen", "Error loading marker avatar for ${member.displayName}: ${e.message}")
                }
            }
        }
    }

    // 화면 완전 종료 시 아바타 캐시 비우기 (다른 화면 Coil 캐시에는 영향 없음 — 키 prefix 기반)
    DisposableEffect(Unit) {
        onDispose {
            val cache = imageLoader.memoryCache ?: return@onDispose
            // Coil 은 개별 key remove API 를 공개하지 않으므로 명시적 clear 는 생략 (LRU 가 정리)
            // 필요 시 imageLoader.memoryCache?.clear() 로 전체 비우기 가능.
        }
    }

    // selectedMember 는 State 기반 derivedStateOf — 반복 .find 호출 제거
    val selectedMemberState by remember {
        derivedStateOf { members.find { it.isSelected } }
    }

    // 전체 보기용 markerPoints — members/schedules 변화 시에만 재계산
    val markerPoints by remember {
        derivedStateOf {
            val points = mutableListOf<LatLng>()
            members.forEach { m ->
                val lat = m.mltLat
                val lng = m.mltLong
                if (lat != null && lng != null) points.add(LatLng(lat, lng))
            }
            filteredSchedules.forEach { s ->
                val lat = s.sstLocationLat
                val lng = s.sstLocationLong
                if (lat != null && lng != null) points.add(LatLng(lat, lng))
            }
            points
        }
    }

    // Effect: Move camera when member selected or group changes
    LaunchedEffect(selectedMemberId, selectedGroup) {
        if (!isVisible) return@LaunchedEffect
        val m = selectedMemberState
        val lat = m?.mltLat
        val lng = m?.mltLong
        if (m != null && lat != null && lng != null) {
            // 1. 선택된 멤버로 줌
            cameraPositionState.animate(
                update = CameraUpdate.scrollAndZoomTo(LatLng(lat, lng), 16.0)
                    .animate(com.naver.maps.map.CameraAnimation.Fly, 1000)
            )
        } else if (markerPoints.isNotEmpty()) {
            // 2. 멤버 미선택 → 전체 마커 fit
            val bounds = com.naver.maps.geometry.LatLngBounds.Builder()
                .include(markerPoints)
                .build()
            cameraPositionState.animate(
                update = CameraUpdate.fitBounds(bounds, 150)
                    .animate(com.naver.maps.map.CameraAnimation.Fly, 1000)
            )
        }
    }

    var mapMembers by remember { mutableStateOf(members) }
    var mapSchedules by remember { mutableStateOf(filteredSchedules) }
    LaunchedEffect(isVisible, members, filteredSchedules) {
        if (isVisible) { mapMembers = members; mapSchedules = filteredSchedules }
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
                        // Member Markers — key 고정으로 Compose diff 최적화
                        mapMembers.forEach { member ->
                            key(member.mtIdx) {
                                val memberLat = member.mltLat
                                val memberLng = member.mltLong
                                if (memberLat != null && memberLng != null) {
                                    val avatar = avatarBitmap(member.mtIdx)
                                    val memberMarkerBitmap = remember(member.displayName, member.isSelected, avatar) {
                                        MarkerUtils.createMemberMarkerBitmap(context, member.displayName, member.isSelected, avatar)
                                    }

                                    Marker(
                                        state = MarkerState(position = LatLng(memberLat, memberLng)),
                                        icon = OverlayImage.fromBitmap(memberMarkerBitmap),
                                        zIndex = if (member.isSelected) 2000 else 100,
                                        onClick = {
                                            viewModel.selectMember(member.mtIdx)
                                            true
                                        }
                                    )
                                }
                            }
                        }

                        // Schedule Markers — sstIdx 로 key 고정
                        mapSchedules.forEachIndexed { index, schedule ->
                            key(schedule.sstIdx) {
                                val lat = schedule.sstLocationLat
                                val lng = schedule.sstLocationLong
                                if (lat != null && lng != null) {
                                    val markerBitmap = remember(schedule.sstIdx, schedule.sstTitle, index) {
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
                        }

                        // Effect: Update InfoWindow screen position
                        // 키를 선택 멤버 id + 위치만으로 압축해 불필요 재실행 제거
                        val mapSelectedMember = mapMembers.find { it.isSelected }
                        MapEffect(
                            mapSelectedMember?.mtIdx,
                            mapSelectedMember?.mltLat,
                            mapSelectedMember?.mltLong,
                            cameraPositionState.position,
                            cameraPositionState.isMoving
                        ) { map ->
                            val m = mapSelectedMember
                            val lat = m?.mltLat
                            val lng = m?.mltLong
                            markerScreenPosition = if (m != null && lat != null && lng != null) {
                                map.projection.toScreenLocation(LatLng(lat, lng))
                            } else null
                        }
                    }
                    
                    // 2. Member Info Window (Anchored Overlay) — 캐시된 selectedMemberState 재사용
                    val selectedMember = selectedMemberState
                    val screenPos = markerScreenPosition
                    if (selectedMember != null && screenPos != null) {
                        Box(
                            modifier = Modifier
                                .offset(
                                    x = with(LocalDensity.current) { (screenPos.x / density).dp } - 90.dp,
                                    y = with(LocalDensity.current) { (screenPos.y / density).dp } - 180.dp
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

        // BackHandler for overlay screens
        BackHandler(enabled = isVisible && isNotificationVisible) {
            isNotificationVisible = false
            if (hasUnread) {
                notiViewModel.markAllAsRead()
            }
        }
        BackHandler(enabled = isVisible && isSettingsVisible) {
            isSettingsVisible = false
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
                    if (hasUnread) {
                        notiViewModel.markAllAsRead()
                    }
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
