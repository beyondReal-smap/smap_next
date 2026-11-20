package com.dmonster.smap.ui.myplace

import com.dmonster.smap.ui.components.SheetBandButton
import com.dmonster.smap.ui.components.SheetHeaderMinHeight
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import com.dmonster.smap.ui.theme.FamilyColors
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.NotificationsOff
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SavedLocation
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.components.MemberStrip
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

val MyPlaceSheetPeekHeight = 136.dp

/**
 * 내장소 지도 시트 — 사이드바("장소 관리")를 대신한다.
 * 접힌 시트에서 장소를 바로 열고, 펼치면 멤버 선택과 도착 알림을 관리한다.
 */
@Composable
fun ColumnScope.MyPlaceSheetContent(
    members: List<SmapGroupMember>,
    selectedMember: SmapGroupMember?,
    currentUserIdx: Int?,
    locations: List<SavedLocation>,
    selectedLocationId: Int?,
    isLoadingLocations: Boolean,
    canAddLocation: Boolean,
    canManageLocation: (SavedLocation) -> Boolean,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    onSelectMember: (SmapGroupMember) -> Unit,
    onSelectLocation: (SavedLocation) -> Unit,
    onToggleNotification: (SavedLocation) -> Unit,
    onAddClick: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val owner = when {
        selectedMember == null -> "내"
        selectedMember.mtIdx == currentUserIdx -> "내"
        else -> "${selectedMember.displayName}의"
    }

    Row(
        Modifier
            .fillMaxWidth().background(FamilyColors.Paper)
            .heightIn(min = SheetHeaderMinHeight)
            .padding(start = SmapSpacing.screenHorizontal, end = SmapSpacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(48.dp).background(FamilyColors.Highlight, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            Icon(Icons.Outlined.Place, contentDescription = null, tint = FamilyColors.Ink)
        }
        Spacer(Modifier.width(SmapSpacing.sm))
        Column(Modifier.weight(1f)) {
            Text(
                "$owner 장소",
                style = SmapText.title,
                color = FamilyColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                if (isLoadingLocations) "불러오는 중…"
                else if (locations.isEmpty()) "아직 등록한 장소가 없어요"
                else "저장 ${locations.size}곳 · 도착 알림 ${locations.count { it.sltEnterAlarm == "Y" }}곳",
                style = SmapText.caption,
                color = FamilyColors.Ink.copy(alpha = 0.8f),
            )
        }
        if (canAddLocation) {
            SheetBandButton(text = "장소 추가", icon = Icons.Outlined.Add, onClick = onAddClick)
        }
    }

    LazyRow(
        modifier = Modifier.fillMaxWidth().background(FamilyColors.Paper),
        contentPadding = PaddingValues(horizontal = SmapSpacing.md, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Button(onClick = onToggle, colors = ButtonDefaults.buttonColors(containerColor = FamilyColors.Ink, contentColor = Color.White)) {
                Text(if (isExpanded) "목록 접기" else "멤버·장소 보기", style = SmapText.captionBold)
            }
        }
        if (!isLoadingLocations) {
            items(locations) { location ->
                OutlinedButton(onClick = { onSelectLocation(location) }, colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White,
                    contentColor = FamilyColors.Ink), border = androidx.compose.foundation.BorderStroke(1.dp, FamilyColors.Ink.copy(alpha = 0.18f))) {
                    Icon(location.kind.icon, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(location.name, style = SmapText.captionBold, maxLines = 1)
                }
            }
        }
    }

    Column(
        Modifier
            .fillMaxWidth()
            .weight(1f, fill = false)
            .background(colors.background)
            .verticalScroll(rememberScrollState())
            .padding(SmapSpacing.md),
        verticalArrangement = Arrangement.spacedBy(SmapSpacing.md),
    ) {
        MemberStrip(
            members = members,
            selectedMemberId = selectedMember?.mtIdx,
            currentUserIdx = currentUserIdx,
            onSelect = onSelectMember,
        )
        when {
            isLoadingLocations -> Box(Modifier.fillMaxWidth().padding(SmapSpacing.xl), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.5.dp)
            }
            locations.isEmpty() -> SmapSection {
                SmapListRow(
                    title = "등록된 장소가 없어요",
                    subtitle = if (canAddLocation) "집·학교·회사를 등록하면 도착할 때 알려 드려요.\n지도를 길게 눌러도 추가할 수 있어요."
                    else "이 멤버가 등록한 장소가 아직 없어요.",
                    leading = { SmapRowIcon(Icons.Outlined.Place) },
                )
            }
            else -> SmapSection(title = "저장한 장소") {
                locations.forEachIndexed { i, loc ->
                    if (i > 0) SmapRowDivider()
                    val alarmOn = loc.sltEnterAlarm == "Y"
                    SmapListRow(
                        title = loc.name,
                        subtitle = loc.address,
                        leading = { SmapRowIcon(loc.kind.icon) },
                        selected = loc.sltIdx == selectedLocationId,
                        trailing = if (canManageLocation(loc)) {
                            {
                                IconButton(onClick = { onToggleNotification(loc) }) {
                                    Icon(
                                        if (alarmOn) Icons.Outlined.Notifications else Icons.Outlined.NotificationsOff,
                                        contentDescription = if (alarmOn) "${loc.name} 도착 알림 켜짐, 끄기" else "${loc.name} 도착 알림 꺼짐, 켜기",
                                        tint = if (alarmOn) colors.primary else colors.onSurfaceVariant,
                                    )
                                }
                            }
                        } else null,
                        onClick = { onSelectLocation(loc) },
                    )
                }
            }
        }
        Spacer(Modifier.height(SmapSpacing.lg))
    }
}
