package com.dmonster.smap.ui.group

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SemanticColors
import com.dmonster.smap.ui.theme.SuiteFont

// MARK: - Create Group Dialog

@Composable
fun CreateGroupDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String) -> Unit,
    isLoading: Boolean
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    val haptics = rememberSmapHaptics()

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp)
            ) {
                // Header
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(
                                    Brush.linearGradient(
                                        listOf(SemanticColors.IndicatorMember, BrandColors.Primary)
                                    ),
                                    RoundedCornerShape(10.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "새 그룹 만들기",
                                fontSize = 18.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold,
                                color = BrandColors.TextPrimary
                            )
                            Text(
                                text = "함께할 멤버들을 초대해보세요",
                                fontSize = 12.sp,
                                fontFamily = SuiteFont,
                                color = Color.Gray
                            )
                        }
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "닫기",
                            tint = Color.Gray
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Name Field
                Text(
                    text = "그룹명 *",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = BrandColors.Primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { if (it.length <= 50) name = it },
                    placeholder = { Text("예: 가족, 친구, 직장", fontFamily = SuiteFont) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
                Text(
                    text = "${name.length}/50",
                    fontSize = 12.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray,
                    modifier = Modifier.padding(top = 4.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Description Field
                Text(
                    text = "그룹 설명",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = BrandColors.Primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = description,
                    onValueChange = { if (it.length <= 100) description = it },
                    placeholder = { Text("그룹에 대한 간단한 설명을 입력해주세요", fontFamily = SuiteFont) },
                    minLines = 2,
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
                Text(
                    text = "${description.length}/100",
                    fontSize = 12.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray,
                    modifier = Modifier.padding(top = 4.dp)
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Create Button
                Button(
                    onClick = {
                        haptics.medium()
                        onCreate(name, description)
                    },
                    enabled = name.isNotBlank() && !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = BrandColors.Primary
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "그룹 만들기",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Edit Group Dialog

@Composable
fun EditGroupDialog(
    group: SmapGroup,
    onDismiss: () -> Unit,
    onUpdate: (String, String) -> Unit,
    isLoading: Boolean
) {
    val initialName = group.sgtTitle ?: ""
    val initialDesc = group.sgtMemo ?: ""
    var name by remember(group.sgtIdx) { mutableStateOf(initialName) }
    var description by remember(group.sgtIdx) { mutableStateOf(initialDesc) }
    val hasUnsavedChanges = name != initialName || description != initialDesc
    var showDiscardConfirm by remember { mutableStateOf(false) }
    val editHaptics = rememberSmapHaptics()

    val safeDismiss: () -> Unit = {
        if (hasUnsavedChanges) {
            editHaptics.warning()
            showDiscardConfirm = true
        } else {
            onDismiss()
        }
    }

    if (showDiscardConfirm) {
        AlertDialog(
            onDismissRequest = { showDiscardConfirm = false },
            title = { Text("변경사항이 저장되지 않았습니다", fontFamily = SuiteFont) },
            text = { Text("수정 중인 내용을 버리고 닫으시겠습니까?", fontFamily = SuiteFont) },
            confirmButton = {
                TextButton(onClick = {
                    showDiscardConfirm = false
                    onDismiss()
                }) { Text("변경사항 버리기", color = BrandColors.Error, fontFamily = SuiteFont) }
            },
            dismissButton = {
                TextButton(onClick = { showDiscardConfirm = false }) {
                    Text("계속 편집", fontFamily = SuiteFont)
                }
            }
        )
    }

    Dialog(onDismissRequest = safeDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp)
            ) {
                // Header
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(
                                    AccentColors.Crown,
                                    RoundedCornerShape(10.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "그룹 수정",
                            fontSize = 18.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            color = BrandColors.TextPrimary
                        )
                    }
                    IconButton(onClick = safeDismiss) {
                        Icon(Icons.Default.Close, "닫기", tint = BrandColors.TextSecondary)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Name Field
                Text(
                    text = "그룹명 *",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = BrandColors.Primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { if (it.length <= 50) name = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Description Field
                Text(
                    text = "그룹 설명",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = BrandColors.Primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = description,
                    onValueChange = { if (it.length <= 100) description = it },
                    minLines = 2,
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Update Button
                Button(
                    onClick = {
                        editHaptics.medium()
                        onUpdate(name, description)
                    },
                    enabled = name.isNotBlank() && !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AccentColors.Crown
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = "수정하기",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Delete Confirm Dialog

@Composable
fun DeleteConfirmDialog(
    group: SmapGroup,
    isLeave: Boolean = false,
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
                text = if (isLeave) "그룹 나가기" else "그룹 삭제",
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        },
        text = {
            Text(
                text = if (isLeave) {
                    "'${group.sgtTitle}' 그룹에서 나가시겠습니까?\n\n이후 다시 가입하려면 초대 코드가 필요합니다."
                } else {
                    "'${group.sgtTitle}'을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 멤버가 그룹에서 나가게 됩니다."
                },
                fontFamily = SuiteFont,
                textAlign = TextAlign.Center,
                style = LocalTextStyle.current.copy(
                    lineBreak = LineBreak.Paragraph,
                    platformStyle = PlatformTextStyle(
                        emojiSupportMatch = androidx.compose.ui.text.EmojiSupportMatch.None
                    )
                )
            )
        },
        confirmButton = {
            val deleteHaptics = rememberSmapHaptics()
            Button(
                onClick = {
                    deleteHaptics.warning()
                    onConfirm()
                },
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Error)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(if (isLeave) "나가기" else "삭제", fontFamily = SuiteFont)
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
