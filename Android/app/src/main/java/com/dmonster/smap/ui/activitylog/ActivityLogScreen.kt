package com.dmonster.smap.ui.activitylog


import com.dmonster.smap.data.model.ScheduleStatus
import com.dmonster.smap.ui.home.MarkerUtils
import com.dmonster.smap.ui.home.ScheduleMarkerLayout
import com.dmonster.smap.ui.home.mapLatLng
import com.dmonster.smap.AppConstants
import com.dmonster.smap.BuildConfig
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.compose.foundation.shape.RoundedCornerShape
import com.dmonster.smap.ui.components.SmapErrorState
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.ActivityLogColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.components.GroupPickerSheet
import com.dmonster.smap.ui.components.MapTopControls
import com.dmonster.smap.ui.components.SmapMapSheetScaffold
import com.dmonster.smap.ui.components.rememberSmapMapSheetState
import com.dmonster.smap.ui.home.MapLoadingOverlay
import androidx.compose.material.icons.Icons
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import com.naver.maps.geometry.WebMercatorCoord
import com.naver.maps.geometry.LatLng
import com.naver.maps.map.CameraPosition
import com.naver.maps.map.CameraUpdate
import com.naver.maps.map.compose.*
import com.naver.maps.map.overlay.OverlayImage
import com.dmonster.smap.R

/**
 * 활동로그 화면 - 지도 + 이동경로 + 요약 (iOS 스타일)
 */
@OptIn(ExperimentalNaverMapApi::class, ExperimentalMaterial3Api::class)
@Composable
fun ActivityLogScreen(
    viewModel: ActivityLogViewModel = hiltViewModel(),
    isVisible: Boolean = true
) {
    val haptics = rememberSmapHaptics()

    // Collect States
    val groups by viewModel.groups.collectAsState()
    val selectedGroup by viewModel.selectedGroup.collectAsState()
    val members by viewModel.members.collectAsState()
    val selectedMember by viewModel.selectedMember.collectAsState()
    val locationLogs by viewModel.locationLogs.collectAsState()
    val locationSummary by viewModel.locationSummary.collectAsState()

    val isLoading by viewModel.isLoading.collectAsState()
    val isLoadingLogs by viewModel.isLoadingLogs.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val loadFailed by viewModel.loadFailed.collectAsState()
    
    val isMapLoading = isLoading
    
    val memberActivityStats by viewModel.memberActivityStats.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val stayTimes by viewModel.stayTimes.collectAsState()
    val daySchedules by viewModel.daySchedules.collectAsState()
    val subscriptionStatus by viewModel.subscriptionStatus.collectAsState()
    val retentionExceededMessage by viewModel.retentionExceededMessage.collectAsState()

    var mapLogs by remember { mutableStateOf(locationLogs) }
    var mapStayTimes by remember { mutableStateOf(stayTimes) }
    val currentVisibility = rememberUpdatedState(isVisible)
    // 탭에 들어올 때 오늘 기록이 오래됐으면 화면을 가리지 않고 새로 받는다(미리 만들어 둔 탭은 앱을 켤 때 받아 두었다).
    LaunchedEffect(isVisible) {
        if (isVisible) viewModel.refreshIfStale()
    }
    LaunchedEffect(isVisible, locationLogs, stayTimes) {
        // 보일 때만 지도에 반영한다. 단, 미리 만들어 둔 숨은 탭은 첫 데이터를 미리 그려 둔다 —
        // 그러지 않으면 처음 들어오는 순간 경로·표시를 한꺼번에 그려 전환이 끊겼다.
        if (isVisible || mapLogs.isEmpty()) { mapLogs = locationLogs; mapStayTimes = stayTimes }
    }

    // Performance Optimization: Cache heavy calculations & Sampling to max 200 points
    val processedData = remember(mapLogs) {
        val valid = mapLogs.filter { it.hasValidCoordinates }
        val maxPoints = 200
        val sampledLogs = if (valid.size > maxPoints) {
             val result = ArrayList<com.dmonster.smap.data.model.LocationLog>()
             if (valid.isNotEmpty()) {
                 result.add(valid.first())
                 val step = (valid.size - 1).toDouble() / (maxPoints - 1)
                 for (i in 1 until maxPoints - 1) {
                     val index = (i * step).toInt()
                     if (index < valid.size) result.add(valid[index])
                 }
                 if (valid.size > 1) result.add(valid.last())
             }
             result
        } else {
            valid
        }
        val coords = sampledLogs.map { LatLng(it.latitude, it.longitude) }
        if (BuildConfig.DEBUG) android.util.Log.d("ActivityLogScreen", "Data processed: raw=${locationLogs.size}, valid=${valid.size}, sampled=${sampledLogs.size}")
        Triple(sampledLogs, coords, sampledLogs.size)
    }
    
    val validLogs = processedData.first
    val allCoords = processedData.second
    val totalPoints = processedData.third
    
    // Map State
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition(
            LatLng(AppConstants.DefaultLocation.LATITUDE, AppConstants.DefaultLocation.LONGITUDE),
            15.0
        )
    }


    
    // Move camera when logs change (iOS Style: Start Point, Zoom 15)
    // 출발점이 바뀌었을 때(날짜·멤버 변경, 첫 표시)만 카메라를 옮긴다 — 조용히 새로 받아 점만 늘어난 경우엔
    // 보던 위치를 그대로 둔다(이전에는 다시 그릴 때마다 출발점으로 돌아갔다).
    val cameraStartLog = mapLogs.firstOrNull { it.hasValidCoordinates }
    LaunchedEffect(cameraStartLog?.latitude, cameraStartLog?.longitude) {
        if (totalPoints >= 2 && viewModel.isSliderDragging.value) return@LaunchedEffect
        if (mapLogs.isNotEmpty()) {
            val firstLog = cameraStartLog
            if (firstLog != null) {
                val startPos = LatLng(firstLog.latitude, firstLog.longitude)
                val update = CameraUpdate.toCameraPosition(CameraPosition(startPos, 15.0))
                cameraPositionState.move(update)
            }
        }
    }

    // Handle error messages via snackbar — Haptic 동반
    val snackbarHostState = remember { SnackbarHostState() }
    // 미리 만들어 둔 숨은 탭이 다른 탭에서 진동·안내를 내지 않게, 보일 때만 보여 준다(그 전엔 보류).
    LaunchedEffect(errorMessage, isVisible) {
        if (!isVisible) return@LaunchedEffect
        errorMessage?.let {
            haptics.error()
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    // 지도 시트 상태 / 그룹 선택
    val sheetState = rememberSmapMapSheetState()
    val scope = rememberCoroutineScope()
    var showGroupPicker by remember { mutableStateOf(false) }
    val statusBarTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    // 경로 따라가기 — 막대 위치의 시각과 하루의 처음·끝 시각을 함께 보여 준다. 끌 수 있는 건 이동 점이 2개 이상일 때만.
    // 막대 줄은 경로가 없는 날도 자리를 지킨다 — 날짜를 바꿀 때 시트 높이가 바뀌어 레이아웃이 흔들리지 않게(2026-11-20).
    val hasRoute = totalPoints >= 2
    val routeTimes = remember(validLogs) { validLogs.map { gpsHourMinute(it.mltGpsTime) } }
    val sheetPeek = ActivityLogSheetPeekHeight + ActivityLogRouteControlHeight

    Box(modifier = Modifier.fillMaxSize()) {
        SmapMapSheetScaffold(
            peekHeight = sheetPeek,
            headerSurface = com.dmonster.smap.ui.components.SmapAccent.Activity.container,
            maxHeightFraction = 0.76f,
            sheetState = sheetState,
            snackbarHostState = snackbarHostState,
            sheetContent = {
                ActivityLogSheetContent(
                    members = members,
                    selectedMember = selectedMember,
                    currentUserIdx = viewModel.getCurrentUserIdx(),
                    selectedDate = selectedDate,
                    summary = locationSummary,
                    hasLogs = locationLogs.isNotEmpty(),
                    isLoadingLogs = isLoadingLogs,
                    activityStats = memberActivityStats,
                    daySchedules = daySchedules,
                    subscriptionStatus = subscriptionStatus,
                    onSelectMember = {
                        viewModel.selectMember(it)
                        scope.launch { sheetState.partialExpand() }
                    },
                    onSelectDate = { viewModel.selectDate(it) },
                    onLockedDate = { viewModel.onLockedDateClicked(it) },
                    hasRoute = hasRoute,
                    routeControl = {
                        val sliderValue by viewModel.sliderValue.collectAsState()
                        if (hasRoute) {
                            val sampleIndex = ((totalPoints - 1) * (sliderValue / 100.0)).toInt().coerceIn(0, totalPoints - 1)
                            RouteScrubber(
                                value = sliderValue.toFloat(),
                                currentTime = routeTimes[sampleIndex],
                                startTime = routeTimes.firstOrNull(),
                                endTime = routeTimes.lastOrNull(),
                                onValueChange = { viewModel.setSliderValue(it.toDouble()) },
                                onDraggingChange = viewModel::setSliderDragging
                            )
                        } else {
                            RouteScrubber(
                                value = 0f,
                                currentTime = null,
                                startTime = null,
                                endTime = null,
                                onValueChange = {},
                                onDraggingChange = viewModel::setSliderDragging,
                                enabled = false,
                            )
                        }
                    }
                )
            },
            overlay = {
                MapTopControls(
                    groupName = selectedGroup?.sgtTitle,
                    onGroupClick = { showGroupPicker = true }
                )
            }
        ) {
            NaverMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                uiSettings = MapUiSettings(
                    isZoomControlEnabled = false,
                    isLocationButtonEnabled = false,
                    isLogoClickEnabled = false,
                    // 오른쪽 아래 떠 있는 멤버 버튼과 축척 막대가 겹쳐 둘 다 가려졌다. 가족 위치 확인에는
                    // 축척이 거의 쓰이지 않아 축척만 끈다(NAVER 로고는 약관상 유지, 왼쪽 아래라 겹치지 않음).
                    isScaleBarEnabled = false
                ),
                // 위 조작 줄과 아래 접힌 시트만큼 비워 경로가 가려지지 않게 한다.
                contentPadding = PaddingValues(top = statusBarTop + 64.dp, bottom = sheetPeek)
            ) {
                // 그날 일정 — 홈과 같은 한 줄 말풍선. 번호는 그날 일정 순서(장소 없는 일정도 번호를 차지해 시트 목록 번호와 맞는다).
                // 경로·시작·끝 마커(60~70)보다 위, 경로 따라가기 현재 위치(100·101)보다 아래 — 움직이는 위치를 가리지 않게.
                val mapContext = androidx.compose.ui.platform.LocalContext.current
                daySchedules.forEachIndexed { index, schedule ->
                    val position = schedule.mapLatLng ?: return@forEachIndexed
                    androidx.compose.runtime.key(schedule.sstIdx) {
                        val bitmap = remember(schedule.sstIdx, schedule.displayTitle, schedule.date, index, schedule.status) {
                            MarkerUtils.createScheduleMarkerBitmap(mapContext, schedule, index)
                        }
                        val isDone = schedule.status == ScheduleStatus.COMPLETED
                        Marker(
                            state = MarkerState(position = position),
                            icon = OverlayImage.fromBitmap(bitmap),
                            anchor = androidx.compose.ui.geometry.Offset(0.5f, ScheduleMarkerLayout.ANCHOR_Y),
                            alpha = if (isDone) 0.6f else 1f,
                            zIndex = if (isDone) 80 else 90,
                        )
                    }
                }

                // Path Overlay
                if (totalPoints >= 2) {
                    // 1. Full Path (Always visible)
                    androidx.compose.runtime.key(totalPoints) {
                        GradientPathOverlay(
                            coords = allCoords,
                            width = 6.dp
                        )
                    }
                    
                        // Stay Markers
                        val stayContext = androidx.compose.ui.platform.LocalContext.current
                        val stayDensity = stayContext.resources.displayMetrics.density
                    
                        mapStayTimes.forEachIndexed { index, stay ->
                            val stayLat = stay.stayLatitude
                            val stayLng = stay.stayLongitude
                            if (stayLat != null && stayLng != null && stayLat != 0.0 && stayLng != 0.0) {
                                val duration = stay.duration
                                val colorInt = when {
                                    duration >= 300 -> ActivityLogColors.StayLong.toArgb()
                                    duration >= 120 -> ActivityLogColors.StayMedium.toArgb()
                                    duration >= 60 -> ActivityLogColors.StayShort.toArgb()
                                    duration >= 30 -> ActivityLogColors.StayBrief.toArgb()
                                    else -> ActivityLogColors.StayInstant.toArgb()
                                }
                            
                                val baseSizePx = when {
                                    duration >= 300 -> 40f
                                    duration >= 120 -> 36f
                                    duration >= 60 -> 32f
                                    duration >= 30 -> 28f
                                    else -> 26f
                                } * stayDensity

                                val markerBitmap = remember(stay.startTime, stay.endTime, colorInt, baseSizePx) {
                                    ActivityLogMarkerUtils.createStayMarkerBitmap(
                                        stayContext,
                                        index + 1,
                                        stay.formattedDuration,
                                        colorInt,
                                        baseSizePx
                                    )
                                }

                                Marker(
                                    state = MarkerState(position = LatLng(stayLat, stayLng)),
                                    icon = OverlayImage.fromBitmap(markerBitmap),
                                    anchor = androidx.compose.ui.geometry.Offset(0.2f, 0.5f), // Adjusted anchor based on circle position in bitmap
                                    zIndex = 70
                                )
                            }
                        }
                    
                        // 2. Start Marker (iOS: "S" green circle)
                        if (allCoords.isNotEmpty()) {
                            Marker(
                                state = MarkerState(position = allCoords.first()),
                                icon = OverlayImage.fromResource(R.drawable.ic_marker_start),
                                // 기본 기준점은 아래 가운데라 원이 실제 시작·종료 지점보다 위로 떠 있었다. 원 중심을 지점에 맞춘다.
                                anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
                                width = 28.dp,
                                height = 28.dp,
                                zIndex = 60
                            )
                        }

                        // 3. End Marker (iOS: "E" red circle) - higher zIndex than start
                        if (allCoords.isNotEmpty()) {
                            Marker(
                                state = MarkerState(position = allCoords.last()),
                                icon = OverlayImage.fromResource(R.drawable.ic_marker_end),
                                // 기본 기준점은 아래 가운데라 원이 실제 시작·종료 지점보다 위로 떠 있었다. 원 중심을 지점에 맞춘다.
                                anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
                                width = 28.dp,
                                height = 28.dp,
                                zIndex = 61
                            )
                        }
                    
                        // 4. Current Position Marker & Camera Control (Native for Performance)
                        val context = androidx.compose.ui.platform.LocalContext.current
                        val density = context.resources.displayMetrics.density
                    
                        MapEffect(validLogs) { map ->
                            val projected = allCoords.map { WebMercatorCoord.valueOf(it) }
                            val marker = com.naver.maps.map.overlay.Marker().apply {
                                icon = OverlayImage.fromResource(R.drawable.ic_marker_current_circle)
                                zIndex = 100
                                width = (24 * density).toInt()
                                height = (24 * density).toInt()
                            }
                            marker.anchor = android.graphics.PointF(0.5f, 0.5f)
                            val infoMarker = com.naver.maps.map.overlay.Marker().apply {
                                anchor = android.graphics.PointF(0.5f, 1f)
                                zIndex = 101
                            }
                            var previousValue: Double? = null
                            var wasDragging = false
                            var infoSampleIndex = -1
                            try {
                                combine(viewModel.sliderValue, viewModel.isSliderDragging, ::Pair).collect { (value, dragging) ->
                                    val progress = (totalPoints - 1) * (value / 100.0).coerceIn(0.0, 1.0)
                                    val index = progress.toInt()
                                    val fraction = progress - index
                                    val position = if (fraction == 0.0) allCoords[index] else {
                                        val a = projected[index]
                                        val b = projected[index + 1]
                                        WebMercatorCoord(
                                            a.x + (b.x - a.x) * fraction,
                                            a.y + (b.y - a.y) * fraction,
                                        ).toLatLng()
                                    }
                                    marker.position = position
                                    infoMarker.position = position
                                    if (index != infoSampleIndex) {
                                        val speed = String.format(java.util.Locale.US, "%.1f km/h", validLogs[index].speed * 3.6) // 서버 값은 m/s
                                        val bitmap = ActivityLogMarkerUtils.createCurrentPositionInfoBitmap(
                                            context, routeTimes[index] ?: "--:--", speed,
                                        )
                                        infoMarker.icon = OverlayImage.fromBitmap(bitmap)
                                        infoMarker.width = bitmap.width
                                        infoMarker.height = bitmap.height
                                        infoSampleIndex = index
                                    }
                                    if (marker.map == null) {
                                        marker.map = map
                                        infoMarker.map = map
                                    }
                                    val follow = (previousValue != null && previousValue != value) || (dragging && !wasDragging)
                                    if (currentVisibility.value && follow) {
                                        map.moveCamera(CameraUpdate.scrollTo(position).animate(com.naver.maps.map.CameraAnimation.None))
                                    }
                                    previousValue = value
                                    wasDragging = dragging
                                }
                            } finally {
                                marker.map = null
                                infoMarker.map = null
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
                compact = true
            )
        }

        // 조회 실패 — "활동 데이터 없음"과 구분해 다시 시도 가능하게 한다(지도는 유지).
        if (loadFailed && !isLoading && !isLoadingLogs && !isMapLoading) {
            Box(
                modifier = Modifier.fillMaxSize().padding(top = statusBarTop + 64.dp, bottom = sheetPeek).zIndex(5f),
                contentAlignment = Alignment.Center
            ) {
                SmapErrorState(
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .height(260.dp)
                        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp)),
                    title = "활동 기록을 불러오지 못했어요",
                    onRetry = { viewModel.retryLoad() }
                )
            }
        }

        // 7. Map Loading Overlay
        if (isMapLoading) {
            Box(modifier = Modifier.fillMaxSize().zIndex(20f)) {
                MapLoadingOverlay()
            }
        }
        
        // Common Loading Overlay (API calls)
        if (isLoading && !isMapLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .zIndex(25f)
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        }


        // 대화상자는 별도 창이라 숨은 탭에서도 화면 위로 뜬다 — 이 탭이 보일 때만 띄운다.
        if (isVisible) retentionExceededMessage?.let { message ->
            AlertDialog(
                onDismissRequest = { viewModel.clearRetentionExceeded() },
                title = { Text("활동 기록 조회 안내") },
                text = { Text(message) },
                confirmButton = {
                    TextButton(
                        onClick = {
                            viewModel.clearRetentionExceeded()
                            com.dmonster.smap.data.GlobalEventBus.tryEmit(
                                com.dmonster.smap.data.GlobalEvent.OpenSubscriptionScreen
                            )
                        }
                    ) {
                        Text("프리미엄 알아보기")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { viewModel.clearRetentionExceeded() }) {
                        Text("닫기")
                    }
                }
            )
        }
    }
}

/** 서버 GPS 시각 문자열("2026-11-13 09:12:30" / "...T09:12:30.000Z")에서 "HH:mm". */
private fun gpsHourMinute(raw: String?): String? {
    val m = Regex("""[T ](\d{2}):(\d{2})""").find(raw.orEmpty()) ?: return null
    return "${m.groupValues[1]}:${m.groupValues[2]}"
}
