package com.dmonster.smap.ui.schedule

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

// MARK: - Delete Confirm Dialog

@Composable
fun DeleteScheduleDialog(
    schedule: SmapSchedule,
    isRepeat: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (deleteOption: String) -> Unit,
    isLoading: Boolean
) {
    var selectedOption by remember { mutableStateOf("this") }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = Color.Red,
                modifier = Modifier.size(32.dp)
            )
        },
        title = {
            Text(
                text = "일정 삭제",
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        },
        text = {
            Column {
                Text(
                    text = "'${schedule.title}'을(를) 삭제하시겠습니까?",
                    fontFamily = SuiteFont,
                    textAlign = TextAlign.Center
                )

                if (isRepeat) {
                    Spacer(modifier = Modifier.height(16.dp))

                    listOf(
                        "this" to "이 일정만",
                        "future" to "이후 모든 일정",
                        "all" to "모든 반복 일정"
                    ).forEach { (value, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { selectedOption = value }
                                .padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = selectedOption == value,
                                onClick = { selectedOption = value }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = label,
                                fontFamily = SuiteFont,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(selectedOption) },
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
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

// MARK: - Recurring Schedule Action Dialog

@Composable
fun RecurringScheduleActionDialog(
    title: String,
    message: String,
    thisOnlyLabel: String,
    allLabel: String,
    isDestructive: Boolean = false,
    onThisOnly: () -> Unit,
    onAll: () -> Unit,
    onDismiss: () -> Unit
) {
    val buttonColor = if (isDestructive) Color.Red else BrandColors.Primary

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = title,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = message,
                    fontFamily = SuiteFont,
                    textAlign = TextAlign.Center,
                    color = Color.Gray
                )
            }
        },
        confirmButton = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // "이 일정만" option
                Button(
                    onClick = onThisOnly,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = buttonColor
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = thisOnlyLabel,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // "모든 반복 일정" option
                Button(
                    onClick = onAll,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = buttonColor.copy(alpha = 0.8f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = allLabel,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Cancel button
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "취소",
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                }
            }
        },
        dismissButton = {}
    )
}
