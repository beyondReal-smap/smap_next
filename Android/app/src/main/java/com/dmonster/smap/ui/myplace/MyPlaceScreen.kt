package com.dmonster.smap.ui.myplace

import com.dmonster.smap.ui.components.GroupPickerSheet
import com.dmonster.smap.ui.components.MapCircleButton
import com.dmonster.smap.ui.components.MapTopControls
import com.dmonster.smap.ui.components.SmapMapSheetScaffold
import com.dmonster.smap.ui.theme.SmapSpacing
import kotlinx.coroutines.launch

import com.dmonster.smap.AppConstants
import com.dmonster.smap.BuildConfig
import android.util.Log
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.dmonster.smap.ui.components.SmapErrorState
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.naver.maps.geometry.LatLng
import com.naver.maps.map.CameraPosition
import com.naver.maps.map.CameraUpdate
import com.naver.maps.map.compose.*
import com.naver.maps.map.overlay.Marker
import com.naver.maps.map.overlay.InfoWindow
import com.naver.maps.map.overlay.OverlayImage
import com.naver.maps.map.util.MarkerIcons
import com.dmonster.smap.R
import com.dmonster.smap.ui.myplace.LocationInfoWindowAdapter
import com.dmonster.smap.ui.home.MapLoadingOverlay

/**
 * 내장소 화면 - 지도 + 장소 목록
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalNaverMapApi::class)
@Composable
fun MyPlaceScreen(
    viewModel: MyPlaceViewModel = hiltViewModel(),
    isVisible: Boolean = true
) {
    val context = LocalContext.current
    val haptics = rememberSmapHaptics()

    // Collect States
    val groups by viewModel.groups.collectAsState()
    val selectedGroup by viewModel.selectedGroup.collectAsState()
    val members by viewModel.members.collectAsState()
    val selectedMember by viewModel.selectedMember.collectAsState()
    // 선택한 멤버의 장소를 추가할 권한이 없으면 보기만 가능 (추가 UI 숨김).
    // members 를 읽어 두어 역할 변경 시 재계산되게 한다.
    val canAddLocation = selectedMember != null && members.isNotEmpty() && viewModel.canAddLocation()
    val currentUserIdx = viewModel.getCurrentUserIdx()
    val otherMemberName = selectedMember?.takeIf { it.mtIdx != currentUserIdx }?.displayName
    val locations by viewModel.locations.collectAsState()
    val selectedLocation by viewModel.selectedLocation.collectAsState()
    
    val isLoading by viewModel.isLoading.collectAsState()
    val isLoadingLocations by viewModel.isLoadingLocations.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    // Dialog States
    val showAddDialog by viewModel.showAddDialog.collectAsState()
    val showEditDialog by viewModel.showEditDialog.collectAsState()
    val showDeleteDialog by viewModel.showDeleteDialog.collectAsState()
    val pendingLocation by viewModel.pendingLocation.collectAsState()
    val pendingPlaceInfo by viewModel.pendingPlaceInfo.collectAsState()
    val isCreating by viewModel.isCreating.collectAsState()
    val limitExceededMessage by viewModel.limitExceededMessage.collectAsState()
    
    // Search States
    val showSearchScreen by viewModel.showSearchScreen.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()
    val hasSearched by viewModel.hasSearched.collectAsState()
    val isMapLoading by viewModel.isMapLoading.collectAsState()
    val loadFailed by viewModel.loadFailed.collectAsState()
    
    // Snackbar
    val snackbarHostState = remember { SnackbarHostState() }
    
    // NaverMap Camera State
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition(
            LatLng(AppConstants.DefaultLocation.LATITUDE, AppConstants.DefaultLocation.LONGITUDE), 
            AppConstants.MapZoom.DEFAULT
        )
    }

    // Trigger loading on every visit
    LaunchedEffect(Unit) {
        viewModel.performInitialLoad()
    }
    
    // Handle messages — Haptic 동반
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            haptics.error()
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearError()
        }
    }

    LaunchedEffect(successMessage) {
        successMessage?.let {
            haptics.success()
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearSuccess()
        }
    }
    
    // Move camera to selected location with zoom
    LaunchedEffect(selectedLocation) {
        if (!isVisible) return@LaunchedEffect
        selectedLocation?.let { location ->
            if (location.hasValidCoordinates) {
                cameraPositionState.animate(
                    update = CameraUpdate.scrollAndZoomTo(
                        LatLng(location.latitude, location.longitude),
                        15.0
                    )
                )
            }
        }
    }

    // Default to Seoul City Hall if no locations
    LaunchedEffect(isMapLoading) {
        if (!isVisible) return@LaunchedEffect
        if (!isMapLoading && selectedLocation == null && locations.isEmpty()) {
            cameraPositionState.animate(
                update = CameraUpdate.scrollTo(
                    LatLng(AppConstants.DefaultLocation.LATITUDE, AppConstants.DefaultLocation.LONGITUDE)
                )
            )
        }
    }
    
    var mapLocations by remember { mutableStateOf(locations) }
    var mapSelectedLocation by remember { mutableStateOf(selectedLocation) }
    LaunchedEffect(isVisible, locations, selectedLocation) {
        if (isVisible) { mapLocations = locations; mapSelectedLocation = selectedLocation }
    }

    // 지도 시트 — 장소를 고르면 접어서 지도가 보이게 한다.
    val sheetScaffoldState = rememberBottomSheetScaffoldState(
        bottomSheetState = rememberStandardBottomSheetState(
            initialValue = SheetValue.PartiallyExpanded,
            skipHiddenState = true
        )
    )
    val scope = rememberCoroutineScope()
    var showGroupPicker by remember { mutableStateOf(false) }
    val statusBarTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    // 지도를 한 번 눌러 고른 임시 위치(장소 추가 확인 카드용). 화면 안에서만 쓰는 UI 상태라 ViewModel 에 두지 않는다.
    var tapPin by remember { mutableStateOf<LatLng?>(null) }
    val tapPinColor = MaterialTheme.colorScheme.primary
    // 다른 멤버·그룹으로 바꾸거나 추가 권한이 없어지면 이전 대상에 대한 임시 핀은 의미가 없다.
    LaunchedEffect(selectedMember?.mtIdx, selectedGroup?.sgtIdx, canAddLocation) { tapPin = null }

    Box(modifier = Modifier.fillMaxSize()) {
        SmapMapSheetScaffold(
            peekHeight = MyPlaceSheetPeekHeight,
            scaffoldState = sheetScaffoldState,
            snackbarHostState = snackbarHostState,
            sheetContent = {
                MyPlaceSheetContent(
                    members = members,
                    selectedMember = selectedMember,
                    currentUserIdx = currentUserIdx,
                    locations = locations,
                    selectedLocationId = selectedLocation?.sltIdx,
                    isLoadingLocations = isLoadingLocations,
                    canAddLocation = canAddLocation,
                    canManageLocation = { viewModel.canManageLocation(it) },
                    onSelectMember = { viewModel.selectMember(it) },
                    onSelectLocation = {
                        tapPin = null
                        viewModel.selectLocation(it)
                        scope.launch { sheetScaffoldState.bottomSheetState.partialExpand() }
                    },
                    onToggleNotification = { viewModel.toggleLocationNotification(it) },
                    onAddClick = { viewModel.showSearchScreen() }
                )
            },
            overlay = {
                MapTopControls(
                    groupName = selectedGroup?.sgtTitle,
                    onGroupClick = { showGroupPicker = true }
                ) {
                    if (canAddLocation) {
                        MapCircleButton(
                            icon = Icons.Default.Search,
                            contentDescription = "장소 검색",
                            onClick = { viewModel.showSearchScreen() }
                        )
                    }
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
                // 오른쪽 아래 떠 있는 멤버 버튼과 축척 막대가 겹쳐 둘 다 가려졌다. 가족 위치 확인에는
                // 축척이 거의 쓰이지 않아 축척만 끈다(NAVER 로고는 약관상 유지, 왼쪽 아래라 겹치지 않음).
                isScaleBarEnabled = false
            ),
            // 위 조작 줄과 아래 접힌 시트만큼 비워 선택한 장소가 가려지지 않게 한다.
            contentPadding = PaddingValues(top = statusBarTop + 64.dp, bottom = MyPlaceSheetPeekHeight),
            onMapLongClick = { _, coord ->
                if (canAddLocation) {
                    haptics.warning()
                    tapPin = null
                    viewModel.showAddDialog(coord.latitude, coord.longitude)
                }
            },
            // 한 번 누르기: 선택된 장소가 있으면 선택 해제가 먼저(기존 동작 유지), 없으면 임시 핀 + 추가 확인 카드.
            onMapClick = { _, coord ->
                when {
                    selectedLocation != null -> viewModel.clearSelection()
                    canAddLocation -> {
                        haptics.light()
                        tapPin = coord
                    }
                }
            }
        ) {
            tapPin?.let { pin ->
                // 파일 위쪽에서 지도 SDK 의 Marker 클래스를 직접 import 하고 있어 Compose Marker 는 전체 이름으로 부른다.
                com.naver.maps.map.compose.Marker(
                    state = MarkerState(position = pin),
                    icon = MarkerIcons.BLACK,
                    iconTintColor = tapPinColor,
                    // 기본 크기(약 38×50dp)는 지도 위에서 커 보였다 — 비율을 유지한 채 약 3/4 로 (iOS 와 같은 크기).
                    width = 28.dp,
                    height = 37.dp,
                    captionText = "새 장소",
                    zIndex = 300
                )
            }

            // Native Marker & InfoWindow Management via MapEffect
            val adapter = remember { LocationInfoWindowAdapter(context) }
            val nativeOverlays = remember { mutableListOf<com.naver.maps.map.overlay.Overlay>() }
            
            MapEffect(mapLocations, mapSelectedLocation) { naverMap ->
                val locations = mapLocations
                val selectedLocation = mapSelectedLocation
                try {
                    // 1. Clear existing markers/infowindows
                    nativeOverlays.forEach { it.map = null }
                    nativeOverlays.clear()
                    
                    if (BuildConfig.DEBUG) Log.d("MyPlaceScreen", "Re-creating ${locations.size} native overlays")
                    
                    locations.filter { it.hasValidCoordinates }.forEach { location ->
                        val lat = location.latitude
                        val lng = location.longitude
                        
                        if (lat.isNaN() || lng.isNaN()) {
                            if (BuildConfig.DEBUG) Log.e("MyPlaceScreen", "Skipping location with NaN coordinates: ${location.name}")
                            return@forEach
                        }

                        val isSelected = selectedLocation?.sltIdx == location.sltIdx
                        
                        val marker = com.naver.maps.map.overlay.Marker().apply {
                            position = LatLng(lat, lng)
                            anchor = android.graphics.PointF(0.5f, 0.5f)
                            icon = OverlayImage.fromResource(
                                if (isSelected) R.drawable.ic_marker_selected
                                else R.drawable.ic_marker_default
                            )
                            width = if (isSelected) context.dpToPx(32) else context.dpToPx(24)
                            height = if (isSelected) context.dpToPx(32) else context.dpToPx(24)
                            map = naverMap
                            tag = location.name
                            zIndex = if (isSelected) 100 else 0
                            
                            setOnClickListener {
                                viewModel.showEditDialog(location)
                                true
                            }
                        }
                        nativeOverlays.add(marker)
                        
                        // InfoWindow for Label - create unique instance for each marker
                        com.naver.maps.map.overlay.InfoWindow().apply {
                            this.adapter = adapter
                            this.anchor = android.graphics.PointF(0.5f, 0.0f)
                            // offsetY positions the info window above the marker.
                            // Values correspond to marker drawable height: selected=32dp, default=24dp,
                            // plus a 4dp gap so the label doesn't overlap the icon.
                            this.offsetY = if (isSelected) -context.dpToPx(36) else -context.dpToPx(32)
                            this.zIndex = 200
                            this.alpha = 0.9f
                            open(marker)
                            nativeOverlays.add(this)
                        }
                    }
                } catch (e: Exception) {
                    if (BuildConfig.DEBUG) Log.e("MyPlaceScreen", "Error managing map overlays: ${e.message}", e)
                }
            }
        }

            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }

            tapPin?.let { pin ->
                MapTapAddCard(
                    targetMemberName = otherMemberName,
                    onAdd = {
                        tapPin = null
                        viewModel.showAddDialog(pin.latitude, pin.longitude)
                    },
                    onDismiss = { tapPin = null },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(start = SmapSpacing.md, end = SmapSpacing.md, bottom = MyPlaceSheetPeekHeight + 12.dp)
                )
            }
        }

        if (showGroupPicker) {
            GroupPickerSheet(
                groups = groups,
                selectedGroupId = selectedGroup?.sgtIdx,
                onSelect = { viewModel.selectGroup(it) },
                onDismiss = { showGroupPicker = false }
            )
        }

        // 조회 실패 — "등록된 장소 없음"과 구분해 다시 시도 가능하게 한다(지도는 유지).
        if (loadFailed && !isMapLoading) {
            Box(
                modifier = Modifier.fillMaxSize().zIndex(6f),
                contentAlignment = Alignment.Center
            ) {
                SmapErrorState(
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .height(260.dp)
                        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp)),
                    title = "내 장소를 불러오지 못했어요",
                    onRetry = { viewModel.performInitialLoad() }
                )
            }
        }

        // Map Loading Overlay (Topmost)
        AnimatedVisibility(
            visible = isMapLoading,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.zIndex(25f)
        ) {
            MapLoadingOverlay()
        }
    }
    
    if (isVisible) {
    // Location Detail Sheet (iOS Style)
    if (showAddDialog && (pendingLocation != null || pendingPlaceInfo != null)) {
        LocationDetailSheet(
            location = null,
            members = viewModel.addableMembers(),
            selectedMember = selectedMember,
            targetMemberName = otherMemberName,
            pendingInfo = pendingPlaceInfo,
            pendingLocation = pendingLocation,
            isNew = true,
            onDismiss = { viewModel.hideAddDialog() },
            onSearchClick = { viewModel.showSearchScreen() },
            onMemberSelect = { viewModel.selectMember(it) },
            onSave = { title, address, lat, lng, memo, alarm ->
                viewModel.createLocation(title, address, lat, lng, memo, alarm)
            },
            onDelete = {},
            onNotificationToggle = { /* Not applicable for new items yet */ },
            isLoading = isCreating
        )
    } else {
        showEditDialog?.let { location ->
            val canManage = viewModel.canManageLocation(location)
            LocationDetailSheet(
                location = location,
                canManage = canManage,
                targetMemberName = otherMemberName,
                pendingInfo = pendingPlaceInfo,
                pendingLocation = pendingLocation,
                isNew = false,
                onDismiss = { viewModel.hideEditDialog() },
                onSearchClick = { viewModel.showSearchScreen() },
                onMemberSelect = {},
                onSave = { title, address, lat, lng, memo, alarm ->
                    viewModel.updateLocation(
                        locationId = location.sltIdx,
                        title = title,
                        address = address,
                        lat = lat,
                        lng = lng,
                        memo = memo,
                        enterAlarm = alarm
                    )
                },
                onDelete = { viewModel.showDeleteDialog(it) },
                onNotificationToggle = { viewModel.toggleLocationNotification(it) },
                isLoading = isLoading
            )
        }
    }
    
    // Location Search Sheet
    if (showSearchScreen) {
        LocationSearchSheet(
            query = searchQuery,
            results = searchResults,
            isSearching = isSearching,
            hasSearched = hasSearched,
            onQueryChange = { viewModel.updateSearchQuery(it) },
            onSearch = { viewModel.performSearch() },
            onSelect = { viewModel.onPlaceSelected(it) },
            onDismiss = { viewModel.hideSearchScreen() }
        )
    }
    
    showDeleteDialog?.let { location ->
        DeleteLocationDialog(
            location = location,
            onDismiss = { viewModel.hideDeleteDialog() },
            onConfirm = {
                haptics.warning() // 삭제 확정 피드백
                viewModel.deleteLocation(location.sltIdx)
            },
            isLoading = isLoading
        )
    }

    limitExceededMessage?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.clearLimitExceeded() },
            title = { Text("내 장소 등록 안내") },
            text = { Text(message) },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.clearLimitExceeded()
                        com.dmonster.smap.data.GlobalEventBus.tryEmit(
                            com.dmonster.smap.data.GlobalEvent.OpenSubscriptionScreen
                        )
                    }
                ) {
                    Text("프리미엄 알아보기")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.clearLimitExceeded() }) {
                    Text("닫기")
                }
            }
        )
    }
    }
}

// Extension function for DP/PX conversion
fun android.content.Context.dpToPx(dp: Int): Int {
    return (dp * resources.displayMetrics.density).toInt()
}
