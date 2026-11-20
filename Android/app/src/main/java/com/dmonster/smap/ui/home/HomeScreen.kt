package com.dmonster.smap.ui.home

import com.dmonster.smap.ui.theme.FamilyColors
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.AppConstants
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.zIndex
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.settings.SettingsScreen
import com.dmonster.smap.ui.components.GroupPickerSheet
import com.dmonster.smap.ui.components.MapCircleButton
import com.dmonster.smap.ui.components.MapTopControls
import com.dmonster.smap.ui.components.SmapErrorState
import com.dmonster.smap.ui.components.SmapMapSheetScaffold
import com.dmonster.smap.ui.components.rememberSmapMapSheetState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.ui.platform.LocalContext
import com.naver.maps.geometry.LatLng
import com.naver.maps.map.CameraPosition
import com.naver.maps.map.CameraUpdate
import com.naver.maps.map.compose.PolylineOverlay
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.data.model.ScheduleStatus
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

/**
 * 홈 — 지도 전체 + 아래 시트(멤버·일정) + 위 조작 줄(그룹 전환·알림·설정).
 *
 * 36단계 재설계: 왼쪽 사이드바("멤버 조회")·오른쪽 아래 멤버 버튼·지도 위 말풍선을 없애고
 * [HomeSheetContent] 한 곳으로 모았다. 접힌 시트에서도 멤버 얼굴 줄이 보여 바로 고를 수 있다.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalNaverMapApi::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = hiltViewModel(),
    onLogout: () -> Unit,
    isVisible: Boolean = true,
    // 설정·알림 오버레이가 열려 있는 동안 상위(MainTabScreen)가 하단 탭바를 가릴 수 있게 알린다.
    onOverlayVisibleChange: (Boolean) -> Unit = {}
) {
    // Collect State
    val groups by viewModel.groups.collectAsState()
    val selectedGroup by viewModel.selectedGroup.collectAsState()
    val members by viewModel.members.collectAsState()
    val filteredSchedules by viewModel.filteredSchedules.collectAsState()
    val calendarDays by viewModel.daysForCalendar.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val loadFailed by viewModel.loadFailed.collectAsState()
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
    val isOverlayOpen = isSettingsVisible || isNotificationVisible
    LaunchedEffect(isOverlayOpen) { onOverlayVisibleChange(isOverlayOpen) }

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

    // 지도 시트 상태 — 멤버를 고르면 시트를 접어 지도가 보이게 한다.
    val sheetState = rememberSmapMapSheetState()
    var showGroupPicker by remember { mutableStateOf(false) }
    val statusBarTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    // Naver Map Camera State
    val cameraPositionState = rememberCameraPositionState {
        // Default position (Seoul City Hall) - 위치 권한이 없을 때 기본값
        position = CameraPosition(
            LatLng(AppConstants.DefaultLocation.LATITUDE, AppConstants.DefaultLocation.LONGITUDE),
            AppConstants.MapZoom.DEFAULT
        )
    }

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
            val imageUrl = com.dmonster.smap.ui.components.profileImageUrl(member.mtFile1) ?: return@forEach

            val key = MemoryCache.Key(avatarCacheKey(member.mtIdx))
            // 이미 캐시에 있으면 스킵
            if (imageLoader.memoryCache?.get(key) != null) return@forEach

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
    LaunchedEffect(selectedMemberId, selectedGroup?.sgtIdx, markerPoints.isNotEmpty(), isVisible) {
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
        } else if (markerPoints.size == 1) {
            cameraPositionState.move(CameraUpdate.scrollAndZoomTo(markerPoints.first(), 15.0))
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
        // 시트 목록과 같은 시작 시각 순 — 마커 번호가 목록 순서와 같게(iOS 와 같게)
        if (isVisible) { mapMembers = members; mapSchedules = filteredSchedules.sortedBy { it.date } }
    }

    // 시트에서 장소가 있는 일정을 누르면 그 장소로 지도를 옮기고 시트를 접어 지도를 보여 준다.
    val focusSchedule: (SmapSchedule) -> Unit = { schedule ->
        schedule.mapLatLng?.let { target ->
            scope.launch { sheetState.partialExpand() }
            scope.launch {
                cameraPositionState.animate(
                    update = CameraUpdate.scrollAndZoomTo(target, 16.0)
                        .animate(com.naver.maps.map.CameraAnimation.Easing, 600)
                )
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        SmapMapSheetScaffold(
            peekHeight = HomeSheetPeekHeight,
            headerSurface = FamilyColors.Paper,
            maxHeightFraction = 0.72f,
            sheetState = sheetState,
            snackbarHostState = snackbarHostState,
            sheetContent = {
                HomeSheetContent(
                    members = members,
                    selectedMemberId = selectedMemberId,
                    currentUserIdx = viewModel.getCurrentUserIdx(),
                    calendarDays = calendarDays,
                    selectedDate = selectedDate,
                    schedules = filteredSchedules,
                    memberStats = { viewModel.getMemberTodayStats(it) },
                    isExpanded = sheetState.currentValue == com.dmonster.smap.ui.components.SmapSheetValue.Expanded,
                    expansionProgress = { sheetState.expansionProgress },
                    onToggleSchedule = { scope.launch { sheetState.toggle() } },
                    onSelectMember = { m ->
                        viewModel.selectMember(m.mtIdx)
                        scope.launch { sheetState.partialExpand() }
                    },
                    onShowAll = {
                        viewModel.deselectAllMembers()
                        scope.launch { sheetState.partialExpand() }
                    },
                    onSelectDate = { viewModel.selectDate(it) },
                    onSelectSchedule = focusSchedule
                )
            },
            overlay = {
                MapTopControls(
                    groupName = selectedGroup?.sgtTitle,
                    onGroupClick = { showGroupPicker = true }
                ) {
                    MapCircleButton(
                        icon = Icons.Outlined.Notifications,
                        contentDescription = if (hasUnread) "알림, 읽지 않은 알림 있음" else "알림",
                        onClick = { isNotificationVisible = true },
                        badge = hasUnread
                    )
                    MapCircleButton(
                        icon = Icons.Outlined.Settings,
                        contentDescription = "설정",
                        onClick = { isSettingsVisible = true }
                    )
                }
            }
        ) {
            NaverMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                uiSettings = MapUiSettings(
                    isZoomControlEnabled = false,
                    isLocationButtonEnabled = false,
                    isLogoClickEnabled = false,
                    // 축척 막대는 가족 위치 확인에 거의 쓰이지 않고 시트와 겹친다(NAVER 로고는 약관상 유지).
                    isScaleBarEnabled = false
                ),
                // 위 조작 줄과 아래 접힌 시트만큼 비워, 전체 보기·멤버 이동 때 마커가 가려지지 않게 한다.
                contentPadding = PaddingValues(top = statusBarTop + 64.dp, bottom = HomeSheetPeekHeight)
            ) {
                // Member Markers — key 고정으로 Compose diff 최적화
                mapMembers.forEach { member ->
                    key(member.mtIdx) {
                        val memberLat = member.mltLat
                        val memberLng = member.mltLong
                        if (memberLat != null && memberLng != null) {
                            val avatar = avatarBitmap(member.mtIdx)
                            val memberMarkerBitmap = remember(member.displayName, member.isSelected, avatar) {
                                MarkerUtils.createMemberMarkerBitmap(context, member.mtIdx, member.displayName, member.isSelected, avatar)
                            }

                            Marker(
                                state = MarkerState(position = LatLng(memberLat, memberLng)),
                                icon = OverlayImage.fromBitmap(memberMarkerBitmap),
                                zIndex = if (member.isSelected) 2000 else 100,
                                onClick = {
                                    viewModel.selectMember(member.mtIdx)
                                    scope.launch { sheetState.partialExpand() }
                                    true
                                }
                            )
                        }
                    }
                }

                // Schedule Markers — sstIdx 로 key 고정
                // 일정 동선 — 멤버별로 그날 일정 장소를 시각 순 점선으로 잇는다(마커 아래)
                val routes = remember(mapSchedules) { scheduleRoutes(mapSchedules) }
                routes.forEach { coords ->
                    PolylineOverlay(
                        coords = coords,
                        width = 3.dp,
                        color = FamilyColors.Ink.copy(alpha = 0.6f),
                        pattern = arrayOf(8.dp, 6.dp),
                        capType = com.naver.maps.map.compose.LineCap.Round,
                        joinType = com.naver.maps.map.compose.LineJoin.Round,
                    )
                }

                mapSchedules.forEachIndexed { index, schedule ->
                    key(schedule.sstIdx) {
                        val lat = schedule.sstLocationLat
                        val lng = schedule.sstLocationLong
                        if (lat != null && lng != null) {
                            // 시간이나 상태(예정→진행 중→끝남)가 바뀌면 다시 그린다
                            val markerBitmap = remember(schedule.sstIdx, schedule.sstTitle, schedule.date, index, schedule.status) {
                                MarkerUtils.createScheduleMarkerBitmap(context, schedule, index)
                            }
                            // 끝난 일정은 흐리게·아래로 — 남은 일정이 먼저 보이게
                            val isDone = schedule.status == ScheduleStatus.COMPLETED

                            Marker(
                                state = MarkerState(position = LatLng(lat, lng)),
                                icon = OverlayImage.fromBitmap(markerBitmap),
                                // 좌표 = 아래 위치 점 중심
                                anchor = androidx.compose.ui.geometry.Offset(0.5f, ScheduleMarkerLayout.ANCHOR_Y),
                                alpha = if (isDone) 0.6f else 1f,
                                zIndex = if (isDone) 900 else 1000,
                                onClick = { true }
                            )
                        }
                    }
                }
            }
        }

        if (showGroupPicker) {
            GroupPickerSheet(
                groups = groups,
                selectedGroupId = selectedGroup?.sgtIdx,
                onSelect = { viewModel.selectGroup(it) },
                onDismiss = { showGroupPicker = false },
                onCreateGroup = { viewModel.openGroupCreationModal() },
                compact = true
            )
        }

        // 조회 실패 — 빈 지도와 구분해 다시 시도 가능하게 한다(지도는 유지).
        if (loadFailed && !isMapLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                SmapErrorState(
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .height(260.dp)
                        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp)),
                    title = "그룹 정보를 불러오지 못했어요",
                    onRetry = { viewModel.retryLoad() }
                )
            }
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
            modifier = Modifier.fillMaxSize().navigationBarsPadding()
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
            // 아래 내비게이션 막대 여백은 SettingsScreen 안에서 배경을 칠한 뒤 준다.
            // 여기서 주면 막대 뒤가 비어 홈 화면 시트 글자가 비쳐 보였다.
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
