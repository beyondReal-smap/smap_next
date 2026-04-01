package com.dmonster.smap.ui.activitylog

import com.dmonster.smap.AppConstants
import com.dmonster.smap.BuildConfig
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import android.graphics.Color as AndroidColor
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.myplace.FloatingActionPlaceButton
import com.dmonster.smap.ui.home.MapLoadingOverlay
import kotlinx.coroutines.delay
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import com.naver.maps.geometry.LatLng
import com.naver.maps.map.CameraPosition
import com.naver.maps.map.CameraUpdate
import com.naver.maps.map.compose.*
import com.naver.maps.map.overlay.OverlayImage
import com.dmonster.smap.R

/**
 * 활동로그 화면 - 지도 + 이동경로 + 요약 (iOS 스타일)
 */
@OptIn(ExperimentalNaverMapApi::class)
@Composable
fun ActivityLogScreen(
    viewModel: ActivityLogViewModel = hiltViewModel()
) {
    // Collect States
    val groups by viewModel.groups.collectAsState()
    val selectedGroup by viewModel.selectedGroup.collectAsState()
    val members by viewModel.members.collectAsState()
    val selectedMember by viewModel.selectedMember.collectAsState()
    val locationLogs by viewModel.locationLogs.collectAsState()
    val locationSummary by viewModel.locationSummary.collectAsState()
    val vmSliderValue by viewModel.sliderValue.collectAsState()
    val vmDragging by viewModel.isSliderDragging.collectAsState()
    var isLocalDragging by remember { mutableStateOf(false) }
    val isSliderDragging = vmDragging || isLocalDragging

    // UI Source of Truth
    var uiSliderValue by remember { mutableFloatStateOf(0f) }

    LaunchedEffect(vmSliderValue) {
        if (!isLocalDragging) {
            uiSliderValue = vmSliderValue.toFloat()
        }
    }
    
    val isLoading by viewModel.isLoading.collectAsState()
    val isLoadingLogs by viewModel.isLoadingLogs.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    
    // Map Loading State
    var isMapLoading by remember { mutableStateOf(true) }
    
    LaunchedEffect(Unit) {
        // Ensure map loading shows for at least 1.5 seconds
        delay(1500)
        isMapLoading = false
    }
    
    // UI States
    val showGroupSelector by viewModel.showGroupSelector.collectAsState()
    val showMemberSidebar by viewModel.showMemberSidebar.collectAsState()
    val memberActivityStats by viewModel.memberActivityStats.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val stayTimes by viewModel.stayTimes.collectAsState()

    // Performance Optimization: Cache heavy calculations & Sampling to max 200 points
    val processedData = remember(locationLogs) {
        val valid = locationLogs.filter { it.hasValidCoordinates }
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
    
    // Debug logging for slider value changes
    LaunchedEffect(uiSliderValue) {
        if (BuildConfig.DEBUG) android.util.Log.d("ActivityLogScreen", "Slider: value=$uiSliderValue, totalPoints=$totalPoints, isDragging=$isSliderDragging")
    }


    // Map State
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition(
            LatLng(AppConstants.DefaultLocation.LATITUDE, AppConstants.DefaultLocation.LONGITUDE),
            15.0
        )
    }


    
    // Move camera when logs change (iOS Style: Start Point, Zoom 15)
    LaunchedEffect(locationLogs) {
        if (locationLogs.isNotEmpty()) {
            val firstLog = locationLogs.firstOrNull { it.hasValidCoordinates }
            if (firstLog != null) {
                val startPos = LatLng(firstLog.latitude, firstLog.longitude)
                cameraPositionState.animate(CameraUpdate.toCameraPosition(CameraPosition(startPos, 15.0)))
            }
        }
    }

    // Handle error messages via snackbar
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // 1. Map Layer
        NaverMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = cameraPositionState,
            uiSettings = MapUiSettings(
                isZoomControlEnabled = false,
                isLocationButtonEnabled = false,
                isLogoClickEnabled = false
            )
        ) {
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
                    
                    stayTimes.forEachIndexed { index, stay ->
                        val stayLat = stay.stayLatitude
                        val stayLng = stay.stayLongitude
                        if (stayLat != null && stayLng != null && stayLat != 0.0 && stayLng != 0.0) {
                            val duration = stay.duration
                            val colorInt = when {
                                duration >= 300 -> AndroidColor.parseColor("#FF6B6B") // Vivid Red
                                duration >= 120 -> AndroidColor.parseColor("#FF9F43") // Vivid Orange
                                duration >= 60 -> AndroidColor.parseColor("#FFD600") // Vivid Yellow
                                duration >= 30 -> AndroidColor.parseColor("#4CAF50") // Vivid Green
                                else -> AndroidColor.parseColor("#2196F3") // Vivid Blue
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
                            width = 28.dp,
                            height = 28.dp,
                            zIndex = 61
                        )
                    }
                    
                    // 4. Current Position Marker & Camera Control (Native for Performance)
                    val context = androidx.compose.ui.platform.LocalContext.current
                    val density = context.resources.displayMetrics.density
                    
                    MapEffect(validLogs) { map ->
                        if (totalPoints < 1) return@MapEffect
                        
                        // Current position marker (blue circle)
                        val marker = com.naver.maps.map.overlay.Marker()
                        marker.zIndex = 100
                        marker.width = (24 * density).toInt()
                        marker.height = (24 * density).toInt()
                        if (allCoords.isNotEmpty()) {
                            marker.position = allCoords.first()
                        }
                        marker.map = map
                        
                        // Info capsule marker (time + speed)
                        val infoMarker = com.naver.maps.map.overlay.Marker()
                        infoMarker.zIndex = 101
                        infoMarker.anchor = android.graphics.PointF(0.5f, 1.0f) // Bottom center
                        if (allCoords.isNotEmpty()) {
                            infoMarker.position = allCoords.first()
                        }
                        infoMarker.map = map
                        
                        val currentIcon = OverlayImage.fromResource(R.drawable.ic_marker_current_circle)
                        
                        // Capture current coords and logs for use in flow
                        val capturedCoords = allCoords
                        val capturedLogs = validLogs
                        val capturedTotalPoints = totalPoints
                        
                        val job = launch {
                            // Watch slider value changes
                            snapshotFlow { uiSliderValue }
                                .collect { value ->
                                    if (capturedTotalPoints < 1) return@collect
                                    
                                    val idx = ((capturedTotalPoints - 1) * (value / 100.0)).toInt()
                                        .coerceIn(0, capturedTotalPoints - 1)
                                    
                                    if (idx < capturedCoords.size && idx < capturedLogs.size) {
                                        val pos = capturedCoords[idx]
                                        val currentLog = capturedLogs[idx]
                                        
                                        // Update position marker
                                        marker.position = pos
                                        marker.icon = currentIcon
                                        
                                        // Extract time from GPS time string
                                        val timeStr = currentLog.mltGpsTime?.let { gpsTime ->
                                            val cleanedTime = gpsTime.replace("Z", "").split(".").firstOrNull() ?: gpsTime
                                            if (cleanedTime.length >= 16) {
                                                cleanedTime.substring(11, 16)
                                            } else {
                                                "--:--"
                                            }
                                        } ?: "--:--"
                                        
                                        val speed = currentLog.mltSpeed ?: 0.0
                                        val speedStr = String.format("%.1f km/h", speed)
                                        
                                        // Update info marker
                                        infoMarker.position = pos
                                        val infoBitmap = ActivityLogMarkerUtils.createCurrentPositionInfoBitmap(context, timeStr, speedStr)
                                        infoMarker.icon = OverlayImage.fromBitmap(infoBitmap)
                                        infoMarker.width = infoBitmap.width
                                        infoMarker.height = infoBitmap.height
                                        
                                        // Always move camera to follow slider position (match iOS behavior)
                                        val update = CameraUpdate.scrollTo(pos)
                                        update.animate(com.naver.maps.map.CameraAnimation.None)
                                        map.moveCamera(update)
                                    }
                                }
                        }
                        
                        try {
                            awaitCancellation()
                        } finally {
                            marker.map = null
                            infoMarker.map = null
                            job.cancel()
                        }
                    }
                    
                    // Camera Follow Logic removed (Handled by snapshotFlow above)
                }
            }
        
        // 2. Header Overlay
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
        ) {
            ActivityLogHeader()
        }
        
        // 3. Floating Summary Card Overlay
        AnimatedVisibility(
            visible = selectedMember != null && !showMemberSidebar,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(top = 85.dp) // Below Header
        ) {
            ActivityLogFloatingCard(
                member = selectedMember,
                displayDate = viewModel.getFormattedDate(),
                summary = locationSummary,
                isLoading = isLoadingLogs,
                onClick = { viewModel.toggleMemberSidebar() }
            )
        }
        
        // 4. Path Slider Overlay
        AnimatedVisibility(
            visible = locationLogs.isNotEmpty() && !showMemberSidebar,
            enter = fadeIn() + slideInVertically { it },
            exit = fadeOut() + slideOutVertically { it },
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp, bottom = 20.dp)
                .zIndex(8f)
        ) {
            PathSlider(
                sliderValue = uiSliderValue.toDouble(),
                isDragging = isSliderDragging,
                onValueChange = {
                    if (BuildConfig.DEBUG) android.util.Log.d("ActivityLogScreen", "PathSlider onValueChange: $it")
                    uiSliderValue = it.toFloat()
                },
                onDraggingChange = { dragging ->
                    if (BuildConfig.DEBUG) android.util.Log.d("ActivityLogScreen", "PathSlider onDraggingChange: $dragging")
                    if (isLocalDragging != dragging) {
                        isLocalDragging = dragging
                        viewModel.setSliderDragging(dragging)
                        if (!dragging) {
                            viewModel.setSliderValue(uiSliderValue.toDouble())
                        }
                    }
                }
            )
        }
        
        // 5. FAB Overlay (Members Selection)
        AnimatedVisibility(
            visible = !showMemberSidebar,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 20.dp)
                .zIndex(10f)
        ) {
            FloatingActionPlaceButton(
                count = members.size,
                onClick = { viewModel.toggleMemberSidebar() }
            )
        }
        
        // 6. Sidebar Overlay
        // 6. Sidebar Overlay System
        
        // 6.1 Dim Overlay (Fade In/Out)
        AnimatedVisibility(
            visible = showMemberSidebar,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.zIndex(5f)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f))
                    .clickable { viewModel.hideMemberSidebar() }
            )
        }
        
        // 6.2 Sidebar Content (Slide In/Out)
        AnimatedVisibility(
            visible = showMemberSidebar,
            enter = slideInHorizontally { -it } + fadeIn(),
            exit = slideOutHorizontally { -it } + fadeOut(),
            modifier = Modifier.zIndex(15f) // Ensure it is above everything
        ) {
            ActivityMemberSidebar(
                groups = groups,
                selectedGroup = selectedGroup,
                members = members,
                selectedMember = selectedMember,
                currentUserIdx = viewModel.getCurrentUserIdx(),
                selectedDate = selectedDate,
                activityStats = memberActivityStats,
                onGroupSelect = { viewModel.selectGroup(it) },
                onMemberSelect = { viewModel.selectMember(it) },
                onMemberAndDateSelect = { member, date -> viewModel.selectMemberAndDate(member, date) },
                onClose = { viewModel.hideMemberSidebar() }
            )
        }
        
        // Empty state overlay for map when no location data
        if (locationLogs.isEmpty() && selectedMember != null && !isLoading && !isLoadingLogs && !isMapLoading) {
            Box(
                modifier = Modifier.fillMaxSize().zIndex(5f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "활동 데이터가 없습니다",
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color.DarkGray
                    )
                    Text(
                        "선택한 날짜에 기록된 활동이 없습니다",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.Gray
                    )
                }
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
                    .background(Color.White.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = BrandColors.Primary)
            }
        }

        // Snackbar Host (inside main Box with proper zIndex)
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .zIndex(100f)
        )
    }
}
