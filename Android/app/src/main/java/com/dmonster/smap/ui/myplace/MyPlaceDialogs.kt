package com.dmonster.smap.ui.myplace

import com.dmonster.smap.BuildConfig
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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
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
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.AccentColors
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
    // Default to emptyList() because the edit-mode caller does not pass members;
    // only the add-mode caller provides the member list for the target-member selector.
    members: List<SmapGroupMember> = emptyList(),
    selectedMember: SmapGroupMember? = null,
    pendingInfo: Triple<String, String, String?>? = null,
    pendingLocation: Pair<Double, Double>? = null,
    isNew: Boolean = false,
    onDismiss: () -> Unit,
    onSearchClick: () -> Unit,
    onMemberSelect: (SmapGroupMember) -> Unit,
    onSave: (title: String, address: String, lat: Double, lng: Double, memo: String?, enterAlarm: String) -> Unit,
    onDelete: (SavedLocation) -> Unit,
    onNotificationToggle: (SavedLocation) -> Unit,
    isLoading: Boolean,
    canManage: Boolean = true,
    /** 본인이 아닌 멤버의 장소를 다룰 때 그 멤버 이름 (제목에 명시해 본인 장소로 착각하지 않게 한다) */
    targetMemberName: String? = null
) {
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false) // 전체 화면 확장을 위해 false로 설정
    val haptics = rememberSmapHaptics()
    
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

    var isEditMode by rememberSaveable { mutableStateOf(isNew) }

    // Form States (rememberSaveable: 회전/프로세스 복귀 시 입력 보존)
    // location/pendingInfo 가 바뀌면 키가 달라지며 자동으로 재초기화된다.
    val locationKey = location?.sltIdx?.toString() ?: "new"
    var name by rememberSaveable(locationKey, pendingInfo) {
        mutableStateOf(pendingInfo?.first ?: location?.name ?: "")
    }
    var address by rememberSaveable(locationKey, pendingInfo) {
        mutableStateOf(pendingInfo?.second ?: location?.address ?: "")
    }
    var lat by rememberSaveable(locationKey, pendingLocation) {
        mutableStateOf(pendingLocation?.first ?: location?.latitude ?: 0.0)
    }
    var lng by rememberSaveable(locationKey, pendingLocation) {
        mutableStateOf(pendingLocation?.second ?: location?.longitude ?: 0.0)
    }
    var memo by rememberSaveable(locationKey) { mutableStateOf(location?.memo ?: pendingInfo?.third ?: "") }
    var enterAlarm by rememberSaveable(locationKey) { mutableStateOf(location?.sltEnterAlarm ?: "Y") }

    var showMemberSelector by rememberSaveable { mutableStateOf(false) }
    var showUnsavedChangesDialog by rememberSaveable { mutableStateOf(false) }

    // 변경사항 감지 — 닫기 확인용
    val hasUnsavedChanges: () -> Boolean = {
        when {
            !(isEditMode || isNew) -> false
            isNew -> name.isNotBlank() || address.isNotBlank() || memo.isNotBlank()
            else -> {
                val orig = location
                orig != null && (
                    name != (orig.name) ||
                    address != (orig.address) ||
                    (memo.ifBlank { null }) != orig.memo ||
                    enterAlarm != orig.sltEnterAlarm
                )
            }
        }
    }

    val attemptDismiss: () -> Unit = {
        if (hasUnsavedChanges()) {
            showUnsavedChangesDialog = true
        } else {
            closeWithAnimation(onDismiss)
        }
    }
    

    ModalBottomSheet(
        onDismissRequest = {
            // 스와이프/스크림 탭으로 닫힐 때도 미저장 변경 확인
            if (hasUnsavedChanges()) {
                showUnsavedChangesDialog = true
            } else {
                onDismiss()
            }
        },
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() },
        containerColor = BrandColors.InputBackground,
        tonalElevation = 0.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = BrandColors.InputBackground,
            tonalElevation = 0.dp
        ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .imePadding()
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
                TextButton(onClick = { attemptDismiss() }) {
                    Text("닫기", color = BrandColors.Primary, fontSize = 16.sp, fontFamily = SuiteFont)
                }
                
                Text(
                    text = when {
                        isNew -> if (targetMemberName != null) "${targetMemberName}님의 장소 추가" else "새 장소 등록"
                        isEditMode -> if (targetMemberName != null) "${targetMemberName}님의 장소 편집" else "장소 편집"
                        else -> if (targetMemberName != null) "${targetMemberName}님의 장소" else "장소 정보"
                    },
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont
                )
                
                if ((isEditMode || isNew) && canManage) {
                    TextButton(
                        onClick = {
                            haptics.medium()
                            onSave(name, address, lat, lng, memo.ifBlank { null }, enterAlarm)
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
                    Spacer(modifier = Modifier.width(64.dp))
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
                                Brush.linearGradient(listOf(BrandColors.Primary, AccentColors.PrimarySoft)),
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
                            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp), color = BrandColors.InputBackground)
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
                        if (canManage) {
                            ActionButton(text = "편집", icon = Icons.Default.Edit, bgColor = BrandColors.Primary) { isEditMode = true }
                            Spacer(modifier = Modifier.height(12.dp))
                            ActionButton(
                                text = if (loc.sltEnterAlarm == "Y") "알림 끄기" else "알림 켜기", 
                                icon = if (loc.sltEnterAlarm == "Y") Icons.Default.NotificationsOff else Icons.Default.NotificationsActive, 
                                bgColor = AccentColors.Orange
                            ) { onNotificationToggle(loc) }
                            Spacer(modifier = Modifier.height(12.dp))
                            ActionButton(text = "삭제", icon = Icons.Default.Delete, bgColor = BrandColors.Error) { onDelete(loc) }
                        }
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
                                Text("등록 대상 멤버", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = BrandColors.TextPrimary, fontFamily = SuiteFont)
                            }
                            
                            val memberSelectClickable = isNew && members.size > 1
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .alpha(if (memberSelectClickable) 1f else 0.6f)
                                    .clickable(
                                        enabled = memberSelectClickable,
                                        role = Role.Button
                                    ) {
                                        showMemberSelector = true
                                    }
                                    .semantics {
                                        contentDescription = if (memberSelectClickable) {
                                            "등록 대상 멤버 선택, 현재 ${selectedMember?.displayName ?: "미선택"}"
                                        } else {
                                            "등록 대상 멤버 ${selectedMember?.displayName ?: "없음"} (변경 불가)"
                                        }
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
                                                file.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}$file"
                                                file.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images$file"
                                                else -> "${BuildConfig.IMAGE_BASE_URL}/images/$file"
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
                                                contentDescription = "${selectedMember?.displayName ?: "멤버"} 프로필 사진",
                                                modifier = Modifier.fillMaxSize(),
                                                contentScale = ContentScale.Crop,
                                                onState = { state ->
                                                    if (state is coil.compose.AsyncImagePainter.State.Error && BuildConfig.DEBUG) {
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
                                        Icon(Icons.Default.ExpandMore, contentDescription = null, tint = Color.Gray)
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
                            Text("장소 정보", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = BrandColors.TextPrimary, fontFamily = SuiteFont)
                        }

                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(role = Role.Button) { onSearchClick() }
                                .semantics { contentDescription = "주소 검색으로 장소 찾기" },
                            shape = RoundedCornerShape(12.dp),
                            color = Color.White,
                            shadowElevation = 2.dp,
                            tonalElevation = 0.dp
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Search, contentDescription = null, tint = BrandColors.Primary)
                                Spacer(modifier = Modifier.width(12.dp))
                                Text("주소 검색으로 찾기", fontSize = 16.sp, fontWeight = FontWeight.Medium, fontFamily = SuiteFont)
                                Spacer(modifier = Modifier.weight(1f))
                                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color.Gray)
                            }
                        }
                        
                        // Inputs — imeAction 연쇄로 키보드 플로우 자연스럽게
                        InputSection(
                            title = "장소 이름 *",
                            value = name,
                            placeholder = "장소 이름을 입력하세요",
                            imeAction = ImeAction.Next,
                            onValueChange = { name = it }
                        )
                        InputSection(
                            title = "상세 주소 *",
                            value = address,
                            placeholder = "주소를 입력하세요",
                            imeAction = ImeAction.Next,
                            onValueChange = { address = it }
                        )
                        InputSection(
                            title = "메모",
                            value = memo,
                            placeholder = "메모를 입력하세요 (선택)",
                            imeAction = ImeAction.Done,
                            onValueChange = { memo = it }
                        )
                    }
                    
                    // Coordinates (Read-only)
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 4.dp)) {
                            Icon(Icons.Default.Public, null, tint = BrandColors.Primary, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("좌표", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = BrandColors.TextPrimary, fontFamily = SuiteFont)
                        }
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            color = BrandColors.Border
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
                                     Text("도착 알림", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = BrandColors.TextPrimary, fontFamily = SuiteFont)
                                 }
                                 Spacer(modifier = Modifier.height(4.dp))
                                 Text(
                                     text = "멤버가 도착하면 알림을 받아요",
                                     fontSize = 13.sp,
                                     color = Color.Gray,
                                     fontFamily = SuiteFont,
                                     lineHeight = 18.sp
                                 )
                             }
                            Switch(
                                checked = enterAlarm == "Y", 
                                onCheckedChange = { 
                                    enterAlarm = if (it) "Y" else "N"
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

    if (showUnsavedChangesDialog) {
        AlertDialog(
            onDismissRequest = { showUnsavedChangesDialog = false },
            icon = {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = AccentColors.Orange,
                    modifier = Modifier.size(36.dp)
                )
            },
            title = {
                Text(
                    text = "저장하지 않은 변경사항이 있어요",
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            },
            text = {
                Text(
                    text = "지금 닫으면 입력한 내용이 사라집니다.\n그래도 닫으시겠습니까?",
                    fontFamily = SuiteFont,
                    textAlign = TextAlign.Center
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showUnsavedChangesDialog = false
                        haptics.warning()
                        closeWithAnimation(onDismiss)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Error)
                ) {
                    Text("버리기", fontFamily = SuiteFont, color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnsavedChangesDialog = false }) {
                    Text("계속 편집", fontFamily = SuiteFont)
                }
            }
        )
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
        Text(text = title, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = BrandColors.TextPrimary, fontFamily = SuiteFont)
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
private fun InputSection(
    title: String,
    value: String,
    placeholder: String,
    imeAction: ImeAction = ImeAction.Next,
    onValueChange: (String) -> Unit
) {
    val focusManager = LocalFocusManager.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder, color = Color.Gray.copy(alpha = 0.7f)) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            keyboardOptions = KeyboardOptions(
                imeAction = imeAction,
                keyboardType = KeyboardType.Text
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) },
                onDone = { focusManager.clearFocus() }
            ),
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
                tint = BrandColors.Error,
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
                text = "'${location.name}'을(를) 삭제할까요?\n삭제하면 되돌릴 수 없어요.",
                fontFamily = SuiteFont,
                textAlign = TextAlign.Center
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Error)
            ) {
                if (isLoading) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                        Text("삭제 중...", fontFamily = SuiteFont, color = Color.White)
                    }
                } else {
                    Text("삭제", fontFamily = SuiteFont, color = Color.White)
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
        tonalElevation = 0.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        modifier = Modifier.fillMaxSize() // 검색창은 다 가려버리기 위해 fillMaxSize 사용
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = BrandColors.InputBackground,
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
                                Icon(Icons.Default.Clear, "검색어 지우기", tint = Color.Gray, modifier = Modifier.size(18.dp))
                            }
                        }
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        imeAction = ImeAction.Search,
                        keyboardType = KeyboardType.Text
                    ),
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
                        message = "지번, 도로명 혹은 건물명을 입력하여\n원하는 장소를 검색해 보세요.",
                        modifier = Modifier.weight(1f)
                    )
                } else {
                    SearchEmptyState(
                        icon = Icons.Default.Search,
                        title = "검색 결과 없음",
                        message = "'$query' 검색 결과가 없어요.\n다른 검색어를 입력해 보세요.",
                        modifier = Modifier.weight(1f)
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
                    items(members, key = { it.mtIdx }) { member ->
                        val isSelected = member.mtIdx == selectedMemberId

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) BrandColors.Primary.copy(alpha = 0.1f) else Color.Transparent)
                                .heightIn(min = 48.dp)
                                .clickable(role = Role.Button) { onSelect(member) }
                                .semantics {
                                    contentDescription = "${member.displayName}${if (isSelected) " 선택됨" else ""}"
                                }
                                .padding(12.dp)
                        ) {
                            val imageUrl = remember(member.mtFile1) {
                                val file = member.mtFile1
                                if (!file.isNullOrBlank()) {
                                    when {
                                        file.startsWith("http") -> file
                                        file.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}$file"
                                        file.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images$file"
                                        else -> "${BuildConfig.IMAGE_BASE_URL}/images/$file"
                                    }
                                } else null
                            }
                            
                            Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(Color.Gray.copy(alpha = 0.1f))) {
                                if (imageUrl != null) {
                                    AsyncImage(
                                        model = ImageRequest.Builder(LocalContext.current).data(imageUrl).build(),
                                        contentDescription = "${member.displayName} 프로필 사진",
                                        modifier = Modifier.fillMaxSize(),
                                        contentScale = ContentScale.Crop
                                    )
                                } else {
                                    Icon(Icons.Default.Person, contentDescription = null, tint = Color.Gray, modifier = Modifier.align(Alignment.Center))
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
private fun SearchEmptyState(icon: ImageVector, title: String, message: String, modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
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
