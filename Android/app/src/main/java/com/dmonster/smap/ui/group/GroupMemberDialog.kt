package com.dmonster.smap.ui.group

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PersonRemove
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.components.SmapAvatar
import com.dmonster.smap.ui.components.SmapDialogActions
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 멤버 관리 시트(그룹장 전용) — 36단계 재설계.
 * 이전: 가운데 대화상자에 큰 사진·버튼 세 개. 지금: 시트 머리(얼굴·이름) + "리더" 스위치 행 + 빨간 "내보내기" 행.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemberManageDialog(
    member: SmapGroupMember,
    onDismiss: () -> Unit,
    onChangeRole: (Boolean) -> Unit,
    onRemove: () -> Unit,
    isLoading: Boolean
) {
    val colors = MaterialTheme.colorScheme
    val isLeader = member.sgdtLeaderChk == "Y"
    var showRemoveConfirm by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(bottom = SmapSpacing.md)
        ) {
            Row(
                Modifier.padding(horizontal = SmapSpacing.screenHorizontal, vertical = SmapSpacing.sm),
                verticalAlignment = Alignment.CenterVertically
            ) {
                SmapAvatar(name = member.displayName, imagePath = member.mtFile1, size = 52.dp)
                Spacer(Modifier.width(SmapSpacing.md))
                Column(Modifier.weight(1f)) {
                    Text(member.displayName, style = SmapText.headline, color = colors.onSurface)
                    Text(if (isLeader) "리더" else "멤버", style = SmapText.caption, color = colors.onSurfaceVariant)
                }
                if (isLoading) CircularProgressIndicator(Modifier.padding(4.dp), strokeWidth = 2.dp)
            }
            Spacer(Modifier.padding(top = SmapSpacing.sm))
            SmapListRow(
                title = "리더로 지정",
                subtitle = "리더는 다른 멤버의 장소를 관리할 수 있어요",
                leading = { SmapRowIcon(Icons.Outlined.Shield) },
                trailing = {
                    Switch(checked = isLeader, onCheckedChange = { onChangeRole(it) }, enabled = !isLoading)
                },
                onClick = if (isLoading) null else ({ onChangeRole(!isLeader) }),
            )
            SmapRowDivider()
            SmapListRow(
                title = "그룹에서 내보내기",
                leading = { SmapRowIcon(Icons.Outlined.PersonRemove) },
                destructive = true,
                onClick = if (isLoading) null else ({ showRemoveConfirm = true }),
            )
        }
    }

    if (showRemoveConfirm) {
        AlertDialog(
            onDismissRequest = { showRemoveConfirm = false },
            containerColor = colors.surface,
            title = { Text("${member.displayName}님을 내보낼까요?", style = SmapText.headline) },
            text = { Text("다시 들어오려면 초대 코드가 필요해요.", style = SmapText.secondary, color = colors.onSurfaceVariant) },
            confirmButton = {
                SmapDialogActions(
                    confirmText = "내보내기",
                    onConfirm = { showRemoveConfirm = false; onRemove() },
                    onDismiss = { showRemoveConfirm = false },
                    destructive = true,
                )
            }
        )
    }
}
