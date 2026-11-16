package com.dmonster.smap.ui.myplace

import com.dmonster.smap.ui.components.SmapDialogActions
import androidx.compose.material.icons.automirrored.outlined.Notes
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Search
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.text.style.TextOverflow
import com.dmonster.smap.ui.components.SmapAvatar
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapButtonStyle
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
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
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
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
            // 지도에서 고른 위치·검색 결과로 미리 채운 이름·주소는 사용자가 입력한 것이 아니므로 변경으로 보지 않는다.
            // (이전에는 아무것도 입력하지 않고 닫아도 미리 채운 주소 때문에 "저장하지 않은 변경사항" 확인창이 떴다.)
            isNew -> name != (pendingInfo?.first ?: "") ||
                address != (pendingInfo?.second ?: "") ||
                memo != (pendingInfo?.third ?: "")
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
    

    // 36단계 재설계와 같은 모양 — 일정 상세·작성 시트처럼.
    // 이전: 남색 원 아이콘 + 그림자 카드 + 남색·주황·빨강 전폭 버튼 3개(알림 버튼은 토글과 중복), 좌표 숫자 노출.
    // 지금: 회색 바탕 위 흰 묶음(SmapSection) + 공용 행(SmapListRow), 아래에 [삭제][편집] / [저장].
    // 색은 내장소 탭 강조색(보라)을 SmapAccentTheme 로 그대로 물려받는다.
    val colors = MaterialTheme.colorScheme
    val focusManager = LocalFocusManager.current
    val sheetTitle = when {
        isNew -> if (targetMemberName != null) "${targetMemberName}님의 장소 추가" else "새 장소 등록"
        isEditMode -> if (targetMemberName != null) "${targetMemberName}님의 장소 편집" else "장소 편집"
        else -> if (targetMemberName != null) "${targetMemberName}님의 장소" else "장소 정보"
    }
    val canSave = name.isNotBlank() && address.isNotBlank() && !isLoading

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
        containerColor = colors.background,
        tonalElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .imePadding()
                .padding(bottom = SmapSpacing.md)
        ) {
            // 머리 줄 — [닫기] 제목
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = SmapSpacing.xs),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { attemptDismiss() }) {
                    Icon(Icons.Outlined.Close, contentDescription = "닫기", tint = colors.onSurfaceVariant)
                }
                Text(
                    text = sheetTitle,
                    style = SmapText.headline,
                    color = colors.onSurface,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .weight(1f)
                        .semantics { heading() }
                )
                Spacer(modifier = Modifier.width(48.dp))
            }

            Column(
                modifier = Modifier
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState())
            ) {
                AnimatedContent(
                    targetState = isEditMode to (location != null),
                    transitionSpec = {
                        fadeIn(animationSpec = tween(300)) togetherWith fadeOut(animationSpec = tween(300))
                    },
                    label = "ModeSwitch"
                ) { (editMode, hasLocation) ->
                    if (!editMode && hasLocation) {
                        // 보기
                        val loc = location!!
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = SmapSpacing.md),
                            verticalArrangement = Arrangement.spacedBy(SmapSpacing.md)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = SmapSpacing.xs, vertical = SmapSpacing.sm),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                SmapRowIcon(Icons.Outlined.Place, emphasized = true)
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(loc.name, style = SmapText.title, color = colors.onSurface)
                                    Text(loc.address, style = SmapText.secondary, color = colors.onSurfaceVariant)
                                }
                            }
                            SmapSection {
                                val alarmOn = loc.sltEnterAlarm == "Y"
                                SmapListRow(
                                    title = "도착 알림",
                                    subtitle = if (alarmOn) "도착하면 알려 드려요" else "꺼져 있어요",
                                    leading = { SmapRowIcon(Icons.Outlined.NotificationsNone) },
                                    trailing = { Switch(checked = alarmOn, onCheckedChange = { onNotificationToggle(loc) }) },
                                    onClick = { onNotificationToggle(loc) }
                                )
                                loc.memo?.takeIf { it.isNotBlank() }?.let { memoText ->
                                    SmapRowDivider()
                                    SmapListRow(
                                        title = memoText,
                                        subtitle = "메모",
                                        leading = { SmapRowIcon(Icons.AutoMirrored.Outlined.Notes) }
                                    )
                                }
                            }
                        }
                    } else {
                        // 편집 / 새로 등록
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(SmapSpacing.md),
                            verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg)
                        ) {
                            if (isNew) {
                                val memberSelectClickable = members.size > 1
                                SmapSection(title = "누구의 장소") {
                                    SmapListRow(
                                        title = selectedMember?.displayName ?: "멤버 선택",
                                        subtitle = "이 멤버의 장소로 등록돼요",
                                        leading = {
                                            SmapAvatar(
                                                name = selectedMember?.displayName ?: "멤버",
                                                imagePath = selectedMember?.mtFile1,
                                                size = 40.dp
                                            )
                                        },
                                        trailing = if (memberSelectClickable) {
                                            { Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = colors.outline) }
                                        } else null,
                                        onClick = if (memberSelectClickable) ({ showMemberSelector = true }) else null
                                    )
                                }
                            }

                            SmapSection(title = "어디") {
                                SmapListRow(
                                    title = "주소 검색으로 찾기",
                                    subtitle = if (lat == 0.0 && lng == 0.0) "아직 위치를 고르지 않았어요" else null,
                                    leading = { SmapRowIcon(Icons.Outlined.Search) },
                                    trailing = { Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = colors.outline) },
                                    onClick = onSearchClick
                                )
                                SmapRowDivider()
                                Column(
                                    modifier = Modifier.padding(SmapSpacing.md),
                                    verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
                                ) {
                                    SmapTextField(
                                        value = name,
                                        onValueChange = { name = it },
                                        label = "장소 이름",
                                        placeholder = "예: 우리 집, 학교, 학원",
                                        imeAction = ImeAction.Next,
                                        keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) })
                                    )
                                    SmapTextField(
                                        value = address,
                                        onValueChange = { address = it },
                                        label = "주소",
                                        placeholder = "주소를 입력해 주세요",
                                        imeAction = ImeAction.Next,
                                        keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) })
                                    )
                                    SmapTextField(
                                        value = memo,
                                        onValueChange = { memo = it },
                                        label = "메모 (선택)",
                                        placeholder = "참고할 내용",
                                        singleLine = false,
                                        imeAction = ImeAction.Done,
                                        keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() })
                                    )
                                }
                            }

                            SmapSection(title = "알림") {
                                SmapListRow(
                                    title = "도착 알림",
                                    subtitle = "멤버가 도착하면 알림을 받아요",
                                    leading = { SmapRowIcon(Icons.Outlined.NotificationsNone) },
                                    trailing = {
                                        Switch(
                                            checked = enterAlarm == "Y",
                                            onCheckedChange = { enterAlarm = if (it) "Y" else "N" }
                                        )
                                    },
                                    onClick = { enterAlarm = if (enterAlarm == "Y") "N" else "Y" }
                                )
                            }
                        }
                    }
                }
            }

            // 아래 고정 버튼 — 보기: [삭제][편집], 편집·등록: [저장]
            if (canManage) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = SmapSpacing.md, end = SmapSpacing.md, top = SmapSpacing.sm),
                    horizontalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
                ) {
                    if (!isEditMode && location != null) {
                        SmapButton(
                            text = "삭제",
                            onClick = { onDelete(location) },
                            style = SmapButtonStyle.Secondary,
                            modifier = Modifier.weight(1f)
                        )
                        SmapButton(
                            text = "편집",
                            onClick = { isEditMode = true },
                            leadingIcon = Icons.Outlined.Edit,
                            modifier = Modifier.weight(2f)
                        )
                    } else {
                        SmapButton(
                            text = if (isNew) "장소 추가" else "저장",
                            onClick = {
                                haptics.medium()
                                onSave(name, address, lat, lng, memo.ifBlank { null }, enterAlarm)
                            },
                            enabled = canSave,
                            isLoading = isLoading,
                            modifier = Modifier.fillMaxWidth()
                        )
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

    if (showUnsavedChangesDialog) {
        // 장소 삭제·그룹·일정 확인창과 같은 모양 — 경고 아이콘 없이 문장 + [계속 편집][버리기] 같은 크기 버튼.
        AlertDialog(
            onDismissRequest = { showUnsavedChangesDialog = false },
            title = { Text("입력한 내용을 버릴까요?", style = com.dmonster.smap.ui.theme.SmapText.headline) },
            text = {
                Text(
                    "닫으면 저장하지 않은 내용이 사라져요.",
                    style = com.dmonster.smap.ui.theme.SmapText.secondary,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            },
            confirmButton = {
                SmapDialogActions(
                    confirmText = "버리기",
                    dismissText = "계속 편집",
                    onConfirm = {
                        showUnsavedChangesDialog = false
                        haptics.warning()
                        closeWithAnimation(onDismiss)
                    },
                    onDismiss = { showUnsavedChangesDialog = false },
                    destructive = true
                )
            }
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
    // 그룹·일정 삭제 확인과 같은 모양 — 경고 아이콘 없이 문장 + [취소][삭제] 같은 크기 버튼.
    AlertDialog(
        onDismissRequest = { if (!isLoading) onDismiss() },
        title = { Text("'${location.name}'을(를) 삭제할까요?", style = com.dmonster.smap.ui.theme.SmapText.headline) },
        text = {
            Text(
                "삭제하면 되돌릴 수 없어요.",
                style = com.dmonster.smap.ui.theme.SmapText.secondary,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        confirmButton = {
            SmapDialogActions(
                confirmText = "삭제",
                onConfirm = onConfirm,
                onDismiss = onDismiss,
                destructive = true,
                isLoading = isLoading
            )
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
