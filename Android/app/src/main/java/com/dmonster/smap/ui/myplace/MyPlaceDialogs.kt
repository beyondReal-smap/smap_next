package com.dmonster.smap.ui.myplace

import kotlinx.coroutines.launch
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.dmonster.smap.data.model.SavedLocation
import com.dmonster.smap.data.model.KakaoPlace
import com.dmonster.smap.data.model.SmapGroupMember
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import android.util.Log
import coil.request.ImageRequest
import androidx.compose.ui.platform.LocalContext


// MARK: - Location Detail Sheet (iOS Style)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationDetailSheet(
    location: SavedLocation?,
    members: List<SmapGroupMember> = emptyList(),
    selectedMember: SmapGroupMember? = null,
    pendingInfo: Triple<String, String, String?>? = null,
    pendingLocation: Pair<Double, Double>? = null,
    isNew: Boolean = false,
    onDismiss: () -> Unit,
    onSearchClick: () -> Unit,
    onMemberSelect: (SmapGroupMember) -> Unit,
    onSave: (title: String, address: String, lat: Double, lng: Double, memo: String?) -> Unit,
    onDelete: (SavedLocation) -> Unit,
    onNotificationToggle: (SavedLocation) -> Unit,
    isLoading: Boolean
) {
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    
    // Helper to close with animation
    val closeWithAnimation: (onComplete: () -> Unit) -> Unit = { onComplete ->
        scope.launch {
            sheetState.hide()
        }.invokeOnCompletion {
            if (!sheetState.isVisible) {
                onComplete()
            }
        }
    }

    var isEditMode by remember { mutableStateOf(isNew) }
    
    // Form States
    var name by remember(location, pendingInfo) { 
        mutableStateOf(pendingInfo?.first ?: location?.name ?: "") 
    }
    var address by remember(location, pendingInfo) { 
        mutableStateOf(pendingInfo?.second ?: location?.address ?: "") 
    }
    var lat by remember(location, pendingLocation) {
        mutableStateOf(pendingLocation?.first ?: location?.latitude ?: 0.0)
    }
    var lng by remember(location, pendingLocation) {
        mutableStateOf(pendingLocation?.second ?: location?.longitude ?: 0.0)
    }
    var memo by remember(location) { mutableStateOf(location?.memo ?: pendingInfo?.third ?: "") }
    
    var showMemberSelector by remember { mutableStateOf(false) }
    

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() },
        containerColor = Color(0xFFF2F2F7),
        tonalElevation = 0.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xFFF2F2F7),
            tonalElevation = 0.dp
        ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 40.dp)
        ) {
            // Header Actions
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = { closeWithAnimation(onDismiss) }) {
                    Text("닫기", color = BrandColors.Primary, fontSize = 16.sp, fontFamily = SuiteFont)
                }
                
                Text(
                    text = when {
                        isNew -> "새 장소 등록"
                        isEditMode -> "장소 편집"
                        else -> "장소 정보"
                    },
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont
                )
                
                if (isEditMode || isNew) {
                    TextButton(
                        onClick = { 
                            onSave(name, address, lat, lng, memo.ifBlank { null })
                            // Closing is handled by the Screen/ViewModel setting state to false, 
                            // but we can try to animate out here if we want immediate feedback.
                            // However, since Screen's 'if' will cut it off, 
                            // we usually rely on the ViewModel's state change.
                            // To be safe, we let the Screen handle the 'if' and just trigger saving.
                        },
                        enabled = name.isNotBlank() && address.isNotBlank() && !isLoading
                    ) {
                        Text(
                            text = "저장",
                            color = BrandColors.Primary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            fontFamily = SuiteFont
                        )
                    }
                } else {
                    Spacer(modifier = Modifier.width(64.dp)) // Proper alignment
                }
            }

            AnimatedContent(
                targetState = isEditMode to (location != null),
                transitionSpec = {
                    fadeIn(animationSpec = tween(300)) togetherWith fadeOut(animationSpec = tween(300))
                },
                label = "ModeSwitch"
            ) { (editMode, hasLocation) ->
                if (!editMode && hasLocation) {
                    // VIEW MODE
                    val loc = location!!
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Profile Icon
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .background(
                                Brush.linearGradient(listOf(BrandColors.Primary, Color(0xFF9333EA))),
                                CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.LocationOn, null, tint = Color.White, modifier = Modifier.size(32.dp))
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(text = loc.name, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                    Text(text = loc.address, fontSize = 15.sp, color = Color.Gray, textAlign = TextAlign.Center)
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = Color.White,
                        shadowElevation = 2.dp,
                        tonalElevation = 0.dp
                    ) {
                        Column {
                            InfoRow(icon = Icons.Default.Public, title = "좌표", value = "${String.format("%.6f", loc.latitude)}, ${String.format("%.6f", loc.longitude)}")
                            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp), color = Color(0xFFF3F4F6))
                            InfoRow(
                                icon = Icons.Default.Notifications, 
                                title = "도착 알림", 
                                value = if (loc.sltEnterAlarm == "Y") "켜짐" else "꺼짐", 
                                isToggle = true,
                                isChecked = loc.sltEnterAlarm == "Y",
                                onToggle = { onNotificationToggle(loc) }
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // Buttons
                        ActionButton(text = "편집", icon = Icons.Default.Edit, bgColor = BrandColors.Primary) { isEditMode = true }
                        Spacer(modifier = Modifier.height(12.dp))
                        ActionButton(
                            text = if (loc.sltEnterAlarm == "Y") "알림 끄기" else "알림 켜기", 
                            icon = if (loc.sltEnterAlarm == "Y") Icons.Default.NotificationsOff else Icons.Default.NotificationsActive, 
                            bgColor = Color(0xFFF97316)
                        ) { onNotificationToggle(loc) }
                        Spacer(modifier = Modifier.height(12.dp))
                        ActionButton(text = "삭제", icon = Icons.Default.Delete, bgColor = Color.Red) { onDelete(loc) }
                    }
                } else {
                    // EDIT / NEW MODE
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                    // Target Member Selection (if NEW)
                    if (isNew) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(bottom = 4.dp)
                            ) {
                                Icon(Icons.Default.Person, null, tint = BrandColors.Primary, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("등록 대상 멤버", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF1F2937), fontFamily = SuiteFont)
                            }
                            
                            Surface(
                                modifier = Modifier.fillMaxWidth().clickable { 
                                    if (isNew && members.size > 1) showMemberSelector = true 
                                },
                                shape = RoundedCornerShape(16.dp),
                                color = Color.White,
                                shadowElevation = 2.dp,
                                tonalElevation = 0.dp
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    val imageUrl = remember(selectedMember?.mtFile1) {
                                        val file = selectedMember?.mtFile1
                                        if (!file.isNullOrBlank()) {
                                            when {
                                                file.startsWith("http") -> file
                                                file.startsWith("/images/") -> "https://api3.smap.site$file"
                                                file.startsWith("/") -> "https://api3.smap.site/images$file"
                                                else -> "https://api3.smap.site/images/$file"
                                            }
                                        } else null
                                    }
                                    
                                    Box(modifier = Modifier.size(44.dp).clip(CircleShape).background(Color.Gray.copy(alpha = 0.1f))) {
                                        if (imageUrl != null) {
                                            AsyncImage(
                                                model = ImageRequest.Builder(LocalContext.current)
                                                    .data(imageUrl)
                                                    .crossfade(true)
                                                    .build(),
                                                contentDescription = null,
                                                modifier = Modifier.fillMaxSize(),
                                                contentScale = ContentScale.Crop,
                                                onState = { state ->
                                                    if (state is coil.compose.AsyncImagePainter.State.Error) {
                                                        Log.e("LocationDetailSheet", "Avatar Load Error: ${state.result.throwable.message}")
                                                    }
                                                }
                                            )
                                        } else {
                                            Icon(Icons.Default.Person, null, tint = Color.Gray, modifier = Modifier.align(Alignment.Center))
                                        }
                                    }
                                    
                                    Spacer(modifier = Modifier.width(12.dp))
                                    
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = selectedMember?.displayName ?: "멤버 선택", fontSize = 16.sp, fontWeight = FontWeight.Bold, fontFamily = SuiteFont)
                                        Text(text = "이 멤버의 장소로 등록됩니다", fontSize = 13.sp, color = Color.Gray, fontFamily = SuiteFont)
                                    }
                                    
                                    if (isNew && members.size > 1) {
                                        Icon(Icons.Default.ExpandMore, null, tint = Color.Gray)
                                    }
                                }
                            }
                        }
                    }

                    // Place Info Section
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                         Row(
                             verticalAlignment = Alignment.CenterVertically,
                             modifier = Modifier.padding(bottom = 4.dp)
                         ) {
                            Icon(Icons.Default.Map, null, tint = BrandColors.Primary, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("장소 정보", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF1F2937), fontFamily = SuiteFont)
                        }

                        Surface(
                            modifier = Modifier.fillMaxWidth().clickable { onSearchClick() },
                            shape = RoundedCornerShape(12.dp),
                            color = Color.White,
                            shadowElevation = 2.dp,
                            tonalElevation = 0.dp
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Search, null, tint = BrandColors.Primary)
                                Spacer(modifier = Modifier.width(12.dp))
                                Text("주소 검색으로 찾기", fontSize = 16.sp, fontWeight = FontWeight.Medium, fontFamily = SuiteFont)
                                Spacer(modifier = Modifier.weight(1f))
                                Icon(Icons.Default.ChevronRight, null, tint = Color.Gray)
                            }
                        }
                        
                        // Inputs
                        InputSection(title = "장소 이름 *", value = name, placeholder = "장소 이름을 입력하세요") { name = it }
                        InputSection(title = "상세 주소 *", value = address, placeholder = "주소를 입력하세요") { address = it }
                    }
                    
                    // Coordinates (Read-only)
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 4.dp)) {
                            Icon(Icons.Default.Public, null, tint = BrandColors.Primary, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("좌표", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF1F2937), fontFamily = SuiteFont)
                        }
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFE5E7EB)
                        ) {
                            Text(
                                text = if (lat != 0.0 && lng != 0.0) {
                                    "${String.format("%.6f", lat)}, ${String.format("%.6f", lng)}"
                                } else "좌표 없음",
                                modifier = Modifier.padding(14.dp),
                                fontSize = 16.sp,
                                color = Color.Gray
                            )
                        }
                    }
                    
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = Color.White,
                        shadowElevation = 2.dp,
                        tonalElevation = 0.dp
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                             Column(modifier = Modifier.weight(1f)) {
                                 Row(verticalAlignment = Alignment.CenterVertically) {
                                     Icon(Icons.Default.Notifications, null, tint = BrandColors.Primary, modifier = Modifier.size(18.dp))
                                     Spacer(modifier = Modifier.width(8.dp))
                                     Text("도착 알림", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF1F2937), fontFamily = SuiteFont)
                                 }
                                 Spacer(modifier = Modifier.height(4.dp))
                                 Text(
                                     text = "멤버가 도착하면 푸시 알림을 받습니다",
                                     fontSize = 13.sp,
                                     color = Color.Gray,
                                     fontFamily = SuiteFont,
                                     lineHeight = 18.sp
                                 )
                             }
                            Switch(
                                checked = location?.sltEnterAlarm == "Y", 
                                onCheckedChange = { 
                                    if (location != null) onNotificationToggle(location)
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = BrandColors.Primary
                                )
                            )
                        }
                    }
                }
            }

                if (showMemberSelector) {
                    MemberSelectorDialog(
                        members = members,
                        selectedMemberId = selectedMember?.mtIdx,
                        onDismiss = { showMemberSelector = false },
                        onSelect = { 
                            onMemberSelect(it)
                            showMemberSelector = false
                        }
                    )
                }
            }
        }
    }
}
}

@Composable
private fun InfoRow(
    icon: ImageVector, 
    title: String, 
    value: String, 
    isToggle: Boolean = false, 
    isChecked: Boolean = false,
    onToggle: ((Boolean) -> Unit)? = null
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = BrandColors.Primary, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Text(text = title, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF1F2937), fontFamily = SuiteFont)
        Spacer(modifier = Modifier.weight(1f))
        if (isToggle) {
            Switch(
                checked = isChecked, 
                onCheckedChange = { onToggle?.invoke(it) }, 
                modifier = Modifier.scale(0.8f),
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = BrandColors.Primary
                )
            )
        } else {
            Text(text = value, fontSize = 15.sp, color = Color.Black, fontFamily = SuiteFont)
        }
    }
}

@Composable
private fun ActionButton(text: String, icon: ImageVector, bgColor: Color, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(50.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = bgColor)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = text, fontSize = 16.sp, fontWeight = FontWeight.Bold, fontFamily = SuiteFont)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InputSection(title: String, value: String, placeholder: String, onValueChange: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                placeholder = { Text(placeholder, color = Color.Gray.copy(alpha = 0.7f)) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    focusedBorderColor = BrandColors.Primary,
                    unfocusedBorderColor = Color.Transparent
                )
            )
    }
}

// MARK: - Delete Confirm Dialog

@Composable
fun DeleteLocationDialog(
    location: SavedLocation,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
    isLoading: Boolean
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = Color.Red,
                modifier = Modifier.size(48.dp)
            )
        },
        title = {
            Text(
                text = "장소 삭제",
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        },
        text = {
            Text(
                text = "'${location.name}'을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.",
                fontFamily = SuiteFont,
                textAlign = TextAlign.Center
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text("삭제", fontFamily = SuiteFont)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("취소", fontFamily = SuiteFont)
            }
        }
    )
}

// MARK: - Location Search Sheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationSearchSheet(
    query: String,
    results: List<KakaoPlace>,
    isSearching: Boolean,
    hasSearched: Boolean,
    onQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
    onSelect: (KakaoPlace) -> Unit,
    onDismiss: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() },
        containerColor = Color(0xFFF2F2F7),
        tonalElevation = 0.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        modifier = Modifier.fillMaxHeight(0.9f)
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Color(0xFFF2F2F7),
            tonalElevation = 0.dp
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "장소 검색",
                        fontSize = 18.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black
                    )
                    IconButton(
                        onClick = {
                            scope.launch { sheetState.hide() }.invokeOnCompletion { onDismiss() }
                        },
                        modifier = Modifier.align(Alignment.CenterEnd)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "닫기")
                    }
                }

            // Search Bar
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    placeholder = { Text("지번, 도로명, 건물명으로 검색", fontSize = 14.sp, color = Color.Gray.copy(alpha = 0.7f)) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    leadingIcon = { Icon(Icons.Default.Search, null, tint = BrandColors.Primary) },
                    trailingIcon = {
                        if (query.isNotEmpty()) {
                            IconButton(onClick = { onQueryChange("") }) {
                                Icon(Icons.Default.Clear, null, tint = Color.Gray, modifier = Modifier.size(18.dp))
                            }
                        }
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { onSearch() }),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        focusedBorderColor = BrandColors.Primary.copy(alpha = 0.2f),
                        unfocusedBorderColor = Color.Transparent
                    )
                )
                
                Button(
                    onClick = onSearch,
                    enabled = query.isNotBlank() && !isSearching,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Primary),
                    modifier = Modifier.height(52.dp)
                ) {
                    Text("검색", fontWeight = FontWeight.Bold, fontFamily = SuiteFont)
                }
            }

            Text(
                text = "검색 결과 ${results.size}건",
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                fontSize = 13.sp,
                color = Color.Gray,
                fontFamily = SuiteFont
            )

            if (isSearching) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = BrandColors.Primary)
                }
            } else if (results.isEmpty()) {
                if (!hasSearched) {
                    SearchEmptyState(
                        icon = Icons.Default.Map,
                        title = "어디를 찾으시나요?",
                        message = "지번, 도로명 혹은 건물명을 입력하여\n원하는 장소를 검색해 보세요."
                    )
                } else {
                    SearchEmptyState(
                        icon = Icons.Default.Search,
                        title = "검색 결과 없음",
                        message = "'$query'에 대한 검색 결과가 없습니다.\n다른 검색어를 입력해 보세요."
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(results) { place ->
                        SearchPlaceItem(place = place, onClick = { onSelect(place) })
                    }
                }
            }
        }
    }
}
}

@Composable
private fun SearchPlaceItem(place: KakaoPlace, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        shadowElevation = 2.dp,
        tonalElevation = 0.dp
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier.size(40.dp).background(BrandColors.Primary.copy(alpha = 0.1f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.LocationOn, null, tint = BrandColors.Primary, modifier = Modifier.size(20.dp))
            }
            
            Column(modifier = Modifier.weight(1f)) {
                Text(text = place.placeName, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.Black, fontFamily = SuiteFont)
                Text(text = place.displayAddress, fontSize = 13.sp, color = Color.Gray, fontFamily = SuiteFont)
            }
            
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Color.LightGray, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun MemberSelectorDialog(
    members: List<SmapGroupMember>,
    selectedMemberId: Int?,
    onDismiss: () -> Unit,
    onSelect: (SmapGroupMember) -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = Color.White,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp)
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(
                    text = "멤버 선택",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                
                LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(members) { member ->
                        val isSelected = member.mtIdx == selectedMemberId
                        
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) BrandColors.Primary.copy(alpha = 0.1f) else Color.Transparent)
                                .clickable { onSelect(member) }
                                .padding(12.dp)
                        ) {
                            val imageUrl = remember(member.mtFile1) {
                                val file = member.mtFile1
                                if (!file.isNullOrBlank()) {
                                    when {
                                        file.startsWith("http") -> file
                                        file.startsWith("/images/") -> "https://api3.smap.site$file"
                                        file.startsWith("/") -> "https://api3.smap.site/images$file"
                                        else -> "https://api3.smap.site/images/$file"
                                    }
                                } else null
                            }
                            
                            Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(Color.Gray.copy(alpha = 0.1f))) {
                                if (imageUrl != null) {
                                    AsyncImage(
                                        model = ImageRequest.Builder(LocalContext.current).data(imageUrl).build(),
                                        contentDescription = null,
                                        modifier = Modifier.fillMaxSize(),
                                        contentScale = ContentScale.Crop
                                    )
                                } else {
                                    Icon(Icons.Default.Person, null, tint = Color.Gray, modifier = Modifier.align(Alignment.Center))
                                }
                            }
                            
                            Spacer(modifier = Modifier.width(12.dp))
                            
                            Text(
                                text = member.displayName,
                                fontSize = 16.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                fontFamily = SuiteFont,
                                color = if (isSelected) BrandColors.Primary else Color.Black
                            )
                            
                            if (isSelected) {
                                Spacer(modifier = Modifier.weight(1f))
                                Icon(Icons.Default.Check, null, tint = BrandColors.Primary)
                            }
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text("닫기", fontFamily = SuiteFont)
                }
            }
        }
    }
}

@Composable
private fun SearchEmptyState(icon: ImageVector, title: String, message: String) {
    Box(modifier = Modifier.fillMaxWidth().fillMaxHeight(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(40.dp)
        ) {
            Surface(
                modifier = Modifier.size(100.dp),
                shape = CircleShape,
                color = Color.White,
                shadowElevation = 2.dp
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        modifier = Modifier.size(40.dp),
                        tint = BrandColors.Primary.copy(alpha = 0.6f)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Text(text = title, fontSize = 18.sp, fontWeight = FontWeight.Bold, fontFamily = SuiteFont)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = message,
                fontSize = 14.sp,
                color = Color.Gray,
                textAlign = TextAlign.Center,
                fontFamily = SuiteFont,
                lineHeight = 20.sp
            )
        }
    }
}
