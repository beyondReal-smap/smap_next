package com.dmonster.smap.ui.myplace

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.components.SmapBrush
import com.dmonster.smap.ui.theme.SmapText

private const val PickerColumns = 5

/**
 * 장소를 저장할 때 아이콘을 고르는 칸(2026-11-20). 이름으로 짐작한 종류가 미리 골라져 있고, 누르면 바뀐다.
 * 시트 안 세로 스크롤에 들어가므로 LazyVerticalGrid 대신 줄을 직접 나눈다(중첩 스크롤 금지).
 */
@Composable
fun PlaceKindPicker(selected: PlaceKind, onSelect: (PlaceKind) -> Unit, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    val haptics = rememberSmapHaptics()
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        PlaceKind.entries.chunked(PickerColumns).forEach { row ->
            Row(Modifier.fillMaxWidth()) {
                row.forEach { kind ->
                    val isOn = kind == selected
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            // selectable 이 이름표 글자와 선택 상태를 한 항목으로 묶어 읽힌다("학원, 선택됨").
                            .selectable(selected = isOn, role = Role.RadioButton) {
                                haptics.light()
                                onSelect(kind)
                            }
                            .padding(vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .then(if (isOn) Modifier.background(SmapBrush.accent) else Modifier.background(colors.primaryContainer)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(kind.icon, contentDescription = null, tint = if (isOn) Color.White else colors.primary, modifier = Modifier.size(22.dp))
                        }
                        Text(
                            kind.label,
                            style = if (isOn) SmapText.captionBold else SmapText.caption,
                            color = if (isOn) colors.onSurface else colors.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
                // 마지막 줄이 덜 찼을 때 칸 너비를 다른 줄과 맞춘다
                repeat(PickerColumns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}
