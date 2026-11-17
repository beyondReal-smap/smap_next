package com.dmonster.smap.ui.group

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapDialogActions
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/*
 * 그룹 만들기·수정 — 36단계 재설계.
 * 이전: 가운데 대화상자 + 그라데이션/노란 네모 아이콘 + 남색 라벨, 수정 버튼만 노란색.
 * 지금: 아래에서 올라오는 시트 하나(GroupFormSheet)에 공용 입력칸·버튼. 만들기/수정은 제목과 버튼 글자만 다르다.
 */

private const val NAME_MAX = 50
private const val DESC_MAX = 100

@Composable
fun CreateGroupDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String) -> Unit,
    isLoading: Boolean
) {
    GroupFormSheet(
        title = "새 그룹 만들기",
        subtitle = "만들면 멤버를 초대할 수 있는 코드가 생겨요.",
        confirmText = "그룹 만들기",
        initialName = "",
        initialDescription = "",
        isLoading = isLoading,
        onDismiss = onDismiss,
        onSubmit = onCreate,
    )
}

@Composable
fun EditGroupDialog(
    group: SmapGroup,
    onDismiss: () -> Unit,
    onUpdate: (String, String) -> Unit,
    isLoading: Boolean
) {
    GroupFormSheet(
        title = "그룹 정보 수정",
        subtitle = null,
        confirmText = "저장",
        initialName = group.sgtTitle.orEmpty(),
        initialDescription = group.sgtMemo.orEmpty(),
        isLoading = isLoading,
        onDismiss = onDismiss,
        onSubmit = onUpdate,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GroupFormSheet(
    title: String,
    subtitle: String?,
    confirmText: String,
    initialName: String,
    initialDescription: String,
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (String, String) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val haptics = rememberSmapHaptics()
    var name by remember { mutableStateOf(initialName) }
    var description by remember { mutableStateOf(initialDescription) }
    var showDiscardConfirm by remember { mutableStateOf(false) }
    val hasUnsavedChanges = name != initialName || description != initialDescription

    // 입력한 내용이 있으면 시트를 끌어내리거나 바깥을 눌러도 바로 닫지 않고 확인한다.
    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = true,
        confirmValueChange = { target ->
            if (target == androidx.compose.material3.SheetValue.Hidden && hasUnsavedChanges && !isLoading) {
                showDiscardConfirm = true
                false
            } else true
        },
    )

    ModalBottomSheet(
        onDismissRequest = { if (hasUnsavedChanges) showDiscardConfirm = true else onDismiss() },
        sheetState = sheetState,
        containerColor = colors.surface,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .imePadding()
                .padding(start = SmapSpacing.screenHorizontal, end = SmapSpacing.screenHorizontal, bottom = SmapSpacing.md),
            verticalArrangement = Arrangement.spacedBy(SmapSpacing.md),
        ) {
            Column {
                Text(title, style = SmapText.headline, color = colors.onSurface, modifier = Modifier.semantics { heading() })
                if (subtitle != null) Text(subtitle, style = SmapText.caption, color = colors.onSurfaceVariant)
            }
            SmapTextField(
                value = name,
                onValueChange = { if (it.length <= NAME_MAX) name = it },
                label = "그룹 이름",
                placeholder = "예: 우리 가족, 회사 동료",
                helperText = "${name.length}/$NAME_MAX",
                imeAction = ImeAction.Next,
            )
            SmapTextField(
                value = description,
                onValueChange = { if (it.length <= DESC_MAX) description = it },
                label = "그룹 설명 (선택)",
                placeholder = "어떤 그룹인지 짧게 적어 주세요",
                helperText = "${description.length}/$DESC_MAX",
                singleLine = false,
            )
            SmapButton(
                text = confirmText,
                onClick = {
                    haptics.medium()
                    onSubmit(name.trim(), description.trim())
                },
                enabled = name.isNotBlank() && !isLoading && (initialName.isEmpty() || hasUnsavedChanges),
                isLoading = isLoading,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    if (showDiscardConfirm) {
        AlertDialog(
            onDismissRequest = { showDiscardConfirm = false },
            title = { Text("작성한 내용을 버릴까요?", style = SmapText.headline) },
            text = { Text("닫으면 입력한 내용이 저장되지 않아요.", style = SmapText.secondary) },
            confirmButton = {
                SmapDialogActions(
                    confirmText = "버리기",
                    dismissText = "계속 작성",
                    onConfirm = { showDiscardConfirm = false; onDismiss() },
                    onDismiss = { showDiscardConfirm = false },
                    destructive = true,
                )
            },
        )
    }
}

/** 그룹 삭제·나가기 확인. 경고 아이콘 없이 문장과 빨간 확인 버튼으로 위험을 알린다. */
@Composable
fun DeleteConfirmDialog(
    group: SmapGroup,
    isLeave: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
    isLoading: Boolean
) {
    val haptics = rememberSmapHaptics()
    val name = group.sgtTitle ?: "이 그룹"
    AlertDialog(
        onDismissRequest = { if (!isLoading) onDismiss() },
        containerColor = MaterialTheme.colorScheme.surface,
        title = { Text(if (isLeave) "'$name'에서 나갈까요?" else "'$name'을(를) 삭제할까요?", style = SmapText.headline) },
        text = {
            Text(
                if (isLeave) "다시 들어오려면 초대 코드가 필요해요."
                else "모든 멤버가 그룹에서 빠지고, 되돌릴 수 없어요.",
                style = SmapText.secondary,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        confirmButton = {
            SmapDialogActions(
                confirmText = if (isLeave) "나가기" else "삭제",
                onConfirm = { haptics.warning(); onConfirm() },
                onDismiss = onDismiss,
                destructive = true,
                isLoading = isLoading,
            )
        },
    )
}
