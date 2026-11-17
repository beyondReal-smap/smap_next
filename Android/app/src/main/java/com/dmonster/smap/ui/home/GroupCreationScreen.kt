package com.dmonster.smap.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.components.SmapBanner
import com.dmonster.smap.ui.components.SmapBannerTone
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 그룹 생성/가입 화면 (그룹이 없는 회원용 전체 화면 모달)
 * 그룹 만들기 또는 초대 코드로 참여를 고른다.
 *
 * 디자인 시스템 정돈:
 * - 그라데이션 원형 아이콘, 칸마다 다른 강조색(남색·분홍·주황), 노란 팁 상자를 걷어내고
 *   공용 SmapTextField / SmapButton / SmapBanner 로 로그인·가입 화면과 같은 규격을 쓴다.
 * - 배경을 Surface 로 깔아 빈 곳을 눌러도 뒤의 지도가 반응하지 않게 한다(이전에는 터치가 지도로 새어
 *   NAVER 지도 정보 창이 열렸다).
 * - 키보드가 올라와도 버튼이 가리지 않게 본문은 스크롤, 버튼은 아래에 고정한다.
 */
@Composable
fun GroupCreationScreen(
    isCreating: Boolean,
    onCreateGroup: (name: String, description: String) -> Unit,
    onJoinGroup: (inviteCode: String) -> Unit,
    errorMessage: String?,
    onDismiss: (() -> Unit)? = null
) {
    var groupName by remember { mutableStateOf("") }
    var groupDescription by remember { mutableStateOf("") }
    var inviteCode by remember { mutableStateOf("") }

    // Tab Selection: 0 = Create, 1 = Join
    var selectedTab by remember { mutableIntStateOf(0) }
    val isCreateTab = selectedTab == 0
    val canSubmit = (if (isCreateTab) groupName.isNotBlank() else inviteCode.isNotBlank()) && !isCreating
    val submit = {
        if (isCreateTab) onCreateGroup(groupName, groupDescription) else onJoinGroup(inviteCode)
    }
    val colors = MaterialTheme.colorScheme

    Surface(modifier = Modifier.fillMaxSize(), color = colors.surface) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
        ) {
            // 닫기 — 오른쪽 위. 닫을 수 없는 흐름이면 같은 높이의 빈 공간만 둔다.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                if (onDismiss != null) {
                    IconButton(onClick = onDismiss, modifier = Modifier.padding(end = SmapSpacing.xs)) {
                        Icon(Icons.Default.Close, contentDescription = "닫기", tint = colors.onSurfaceVariant)
                    }
                }
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = SmapSpacing.screenHorizontal),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(SmapSpacing.md)
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .background(colors.primary.copy(alpha = 0.08f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isCreateTab) Icons.Outlined.Groups else Icons.Outlined.PersonAdd,
                        contentDescription = null,
                        tint = colors.primary,
                        modifier = Modifier.size(36.dp)
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = "그룹 시작하기", style = SmapText.title, color = colors.onSurface)
                    Spacer(Modifier.height(SmapSpacing.xs))
                    Text(
                        text = "가족·친구와 위치를 함께 보려면 그룹이 필요해요.",
                        style = SmapText.secondary,
                        color = colors.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }

                // 만들기 / 참여 전환 — 낭독기에 "탭, 선택됨"으로 읽히도록 selectable + Role.Tab
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = SmapSpacing.sm)
                        .background(colors.surfaceVariant, RoundedCornerShape(SmapRadius.md))
                        .padding(4.dp)
                        .selectableGroup()
                ) {
                    ModeTab("새 그룹 만들기", isCreateTab, { selectedTab = 0 }, Modifier.weight(1f))
                    ModeTab("초대 코드로 참여", !isCreateTab, { selectedTab = 1 }, Modifier.weight(1f))
                }

                if (isCreateTab) {
                    SmapTextField(
                        value = groupName,
                        onValueChange = { groupName = it },
                        label = "그룹 이름",
                        placeholder = "예: 우리 가족, 회사 동료",
                        imeAction = ImeAction.Next
                    )
                    SmapTextField(
                        value = groupDescription,
                        onValueChange = { groupDescription = it },
                        label = "그룹 설명 (선택)",
                        imeAction = ImeAction.Done
                    )
                    SmapBanner(message = "그룹을 만들면 멤버를 초대할 수 있는 코드가 생겨요.")
                } else {
                    SmapTextField(
                        value = inviteCode,
                        // 초대 코드는 영문 대문자·숫자로만 이뤄진다(그룹 탭 입력과 같은 규칙).
                        onValueChange = { v -> inviteCode = v.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' } },
                        label = "초대 코드",
                        helperText = "그룹장에게 받은 코드를 입력해 주세요.",
                        keyboardType = KeyboardType.Ascii,
                        imeAction = ImeAction.Done
                    )
                }

                if (errorMessage != null) {
                    SmapBanner(message = errorMessage, tone = SmapBannerTone.Error)
                }

                Spacer(Modifier.height(SmapSpacing.md))
            }

            SmapButton(
                text = if (isCreateTab) "그룹 만들기" else "그룹에 참여하기",
                onClick = submit,
                enabled = canSubmit,
                isLoading = isCreating,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = SmapSpacing.screenHorizontal, vertical = SmapSpacing.md)
            )
        }
    }
}

@Composable
private fun ModeTab(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MaterialTheme.colorScheme
    Box(
        modifier = modifier
            .heightIn(min = 44.dp)
            .background(
                if (isSelected) colors.surface else androidx.compose.ui.graphics.Color.Transparent,
                RoundedCornerShape(SmapRadius.sm)
            )
            .selectable(selected = isSelected, onClick = onClick, role = Role.Tab),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            style = if (isSelected) SmapText.captionBold else SmapText.captionMedium,
            color = if (isSelected) colors.primary else colors.onSurfaceVariant
        )
    }
}
