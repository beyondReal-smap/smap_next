package com.dmonster.smap.ui.myplace

import android.annotation.SuppressLint
import android.util.Log
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import com.dmonster.smap.ui.schedule.GroupSelectorDropdown
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
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
@SuppressLint("UnusedMaterial3ScaffoldPaddingParameter")
@OptIn(ExperimentalMaterial3Api::class, ExperimentalNaverMapApi::class)
@Composable
fun MyPlaceScreen(
    viewModel: MyPlaceViewModel = viewModel()
) {
    val context = LocalContext.current
    
    // Collect States
    val groups by viewModel.groups.collectAsState()
    val selectedGroup by viewModel.selectedGroup.collectAsState()
    val members by viewModel.members.collectAsState()
    val selectedMember by viewModel.selectedMember.collectAsState()
    val locations by viewModel.locations.collectAsState()
    val selectedLocation by viewModel.selectedLocation.collectAsState()
    
    val isLoading by viewModel.isLoading.collectAsState()
    val isLoadingLocations by viewModel.isLoadingLocations.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    // Dialog States
    val showGroupSelector by viewModel.showGroupSelector.collectAsState()
    val showMemberSidebar by viewModel.showMemberSidebar.collectAsState()
    val showAddDialog by viewModel.showAddDialog.collectAsState()
    val showEditDialog by viewModel.showEditDialog.collectAsState()
    val showDeleteDialog by viewModel.showDeleteDialog.collectAsState()
    val pendingLocation by viewModel.pendingLocation.collectAsState()
    val pendingPlaceInfo by viewModel.pendingPlaceInfo.collectAsState()
    val isCreating by viewModel.isCreating.collectAsState()
    
    // Search States
    val showSearchScreen by viewModel.showSearchScreen.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()
    val hasSearched by viewModel.hasSearched.collectAsState()
    val isMapLoading by viewModel.isMapLoading.collectAsState()
    
    // Snackbar
    val snackbarHostState = remember { SnackbarHostState() }
    
    // NaverMap Camera State
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition(LatLng(37.5665, 126.9780), 11.0)
    }

    // Trigger loading on every visit
    LaunchedEffect(Unit) {
        viewModel.performInitialLoad()
    }
    
    // Handle messages
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearError()
        }
    }
    
    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearSuccess()
        }
    }
    
    // Move camera to selected location
    LaunchedEffect(selectedLocation) {
        selectedLocation?.let { location ->
            if (location.hasValidCoordinates) {
                cameraPositionState.animate(
                    update = CameraUpdate.scrollTo(LatLng(location.latitude, location.longitude))
                )
            }
        }
    }

    // Default to Seoul City Hall if no locations
    LaunchedEffect(isMapLoading) {
        if (!isMapLoading && selectedLocation == null && locations.isEmpty()) {
            cameraPositionState.animate(
                update = CameraUpdate.scrollTo(LatLng(37.5665, 126.9780))
            )
        }
    }
    
    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // Naver Map (Compose version)
                NaverMap(
                    modifier = Modifier.fillMaxSize(),
                    cameraPositionState = cameraPositionState,
                    uiSettings = MapUiSettings(
                        isZoomControlEnabled = false,
                        isLocationButtonEnabled = false,
                        isLogoClickEnabled = false
                    ),
                    onMapLongClick = { _, coord ->
                        viewModel.showAddDialog(coord.latitude, coord.longitude)
                    }
                ) {
                    // Native Marker & InfoWindow Management via MapEffect
                    val adapter = remember { LocationInfoWindowAdapter(context) }
                    val nativeOverlays = remember { mutableListOf<com.naver.maps.map.overlay.Overlay>() }
                    
                    MapEffect(locations, selectedLocation) { naverMap ->
                        try {
                            // 1. Clear existing markers/infowindows
                            nativeOverlays.forEach { it.map = null }
                            nativeOverlays.clear()
                            
                            Log.d("MyPlaceScreen", "Re-creating ${locations.size} native overlays")
                            
                            locations.filter { it.hasValidCoordinates }.forEach { location ->
                                val lat = location.latitude
                                val lng = location.longitude
                                
                                if (lat.isNaN() || lng.isNaN()) {
                                    Log.e("MyPlaceScreen", "Skipping location with NaN coordinates: ${location.name}")
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
                                    this.offsetY = if (isSelected) -context.dpToPx(36) else -context.dpToPx(32)
                                    this.zIndex = 200
                                    this.alpha = 0.9f
                                    open(marker)
                                    nativeOverlays.add(this)
                                }
                            }
                        } catch (e: Exception) {
                            Log.e("MyPlaceScreen", "Error managing map overlays: ${e.message}", e)
                        }
                    }
                }

                // Top Bar (Overlay)
                MyPlaceTopBar(
                    onSearchClick = { viewModel.showSearchScreen() }
                )
                
                // Group Selector Dropdown
                AnimatedVisibility(
                    visible = showGroupSelector,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically(),
                    modifier = Modifier.padding(top = 100.dp, start = 16.dp, end = 16.dp)
                ) {
                    GroupSelectorDropdown(
                        groups = groups,
                        selectedGroup = selectedGroup,
                        onGroupSelect = { viewModel.selectGroup(it) },
                        onDismiss = { viewModel.hideGroupSelector() }
                    )
                }
                
                // Removed FloatingActionPlaceButton from inside Scaffold to put it above overlay

                // Loading overlay
                if (isLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.3f)),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = BrandColors.Primary)
                    }
                }
            }
        }
        
        // Member Sidebar Overlay (covers screen except tab bar)
        AnimatedVisibility(
            visible = showMemberSidebar,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f))
                    .clickable { viewModel.hideMemberSidebar() }
                    .zIndex(5f)
            )
        }
        
        // Floating Action Button with Badge (PLACED OUTSIDE SCAFFOLD)
        // This ensures it stays above the overlay when zIndex is set
        FloatingActionPlaceButton(
            count = members.size,
            onClick = { viewModel.toggleMemberSidebar() },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 60.dp)
                .zIndex(10f) // Higher than Sidebar Overlay (5f)
        )
        
        // Member Sidebar (slides in separately)
        AnimatedVisibility(
            visible = showMemberSidebar,
            enter = slideInHorizontally { -it },
            exit = slideOutHorizontally { -it },
            modifier = Modifier.zIndex(20f) // Above overlay
        ) {
            MemberSidebar(
                groups = groups,
                selectedGroup = selectedGroup,
                members = members,
                selectedMember = selectedMember,
                locations = locations,
                onGroupSelect = { viewModel.selectGroup(it) },
                onMemberSelect = { viewModel.selectMember(it) },
                onLocationClick = { 
                    viewModel.selectLocation(it)
                    viewModel.hideMemberSidebar()
                },
                onLocationNotification = { viewModel.toggleLocationNotification(it) },
                onClose = { viewModel.hideMemberSidebar() },
                isLoading = isLoading,
                isLoadingLocations = isLoadingLocations
            )
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
    
    // Location Detail Sheet (iOS Style)
    if (showAddDialog && (pendingLocation != null || pendingPlaceInfo != null)) {
        LocationDetailSheet(
            location = null,
            members = members,
            selectedMember = selectedMember,
            pendingInfo = pendingPlaceInfo,
            pendingLocation = pendingLocation,
            isNew = true,
            onDismiss = { viewModel.hideAddDialog() },
            onSearchClick = { viewModel.showSearchScreen() },
            onMemberSelect = { viewModel.selectMember(it) },
            onSave = { title, address, lat, lng, memo ->
                viewModel.createLocation(title, address, lat, lng, memo)
            },
            onDelete = {},
            onNotificationToggle = { /* Not applicable for new items yet */ },
            isLoading = isCreating
        )
    } else if (showEditDialog != null) {
        LocationDetailSheet(
            location = showEditDialog,
            pendingInfo = pendingPlaceInfo,
            pendingLocation = pendingLocation,
            isNew = false,
            onDismiss = { viewModel.hideEditDialog() },
            onSearchClick = { viewModel.showSearchScreen() },
            onMemberSelect = {},
            onSave = { title, address, lat, lng, memo ->
                viewModel.updateLocation(
                    locationId = showEditDialog!!.sltIdx,
                    title = title,
                    address = address,
                    lat = lat,
                    lng = lng,
                    memo = memo
                )
            },
            onDelete = { viewModel.showDeleteDialog(it) },
            onNotificationToggle = { viewModel.toggleLocationNotification(it) },
            isLoading = isLoading
        )
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
            onConfirm = { viewModel.deleteLocation(location.sltIdx) },
            isLoading = isLoading
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MyPlaceTopBar(
    onSearchClick: () -> Unit
) {
    Surface(
        color = Color.White.copy(alpha = 0.95f),
        shadowElevation = 2.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "내장소",
                    fontSize = 22.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
                Text(
                    text = "장소를 등록하고 관리하세요",
                    fontSize = 13.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray
                )
            }
            
            IconButton(
                onClick = onSearchClick,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "장소 검색",
                    tint = BrandColors.Primary,
                    modifier = Modifier.size(28.dp)
                )
            }
        }
    }
}

@Composable
fun FloatingActionPlaceButton(
    count: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pinkColor = Color(0xFFEC4899)
    
    Box(modifier = modifier) {
        FloatingActionButton(
            onClick = onClick,
            containerColor = BrandColors.Primary,
            contentColor = Color.White,
            shape = CircleShape,
            modifier = Modifier.size(64.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.Person,
                contentDescription = "Members",
                modifier = Modifier.size(32.dp)
            )
        }
        
        // Member Count Badge
        if (count > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 4.dp, y = (-4).dp)
                    .size(26.dp)
                    .background(pinkColor, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (count > 99) "99+" else count.toString(),
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont
                )
            }
        }
    }
}

// Extension functions for DP/PX conversion
fun android.content.Context.dpToPx(dp: Int): Int {
    return (dp * resources.displayMetrics.density).toInt()
}

fun android.content.Context.pxToDp(px: Int): Int {
    return (px / resources.displayMetrics.density).toInt()
}
