package com.dmonster.smap.ui.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

// MARK: - Event Detail Dialog

@Composable
fun EventDetailDialog(
    schedule: SmapSchedule,
    canEdit: Boolean,
    onDismiss: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val status = getScheduleStatus(schedule)
    val startTime = schedule.date?.drop(11)?.take(5) ?: "00:00"
    val endTime = schedule.sstEdate?.drop(11)?.take(5) ?: ""
    val dateStr = schedule.date?.take(10) ?: ""

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
                Column(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState())
                ) {
                    // Header with status
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Box(
                                modifier = Modifier
                                    .background(status.bgColor, RoundedCornerShape(8.dp))
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = status.label,
                                    fontSize = 12.sp,
                                    fontFamily = SuiteFont,
                                    fontWeight = FontWeight.Medium,
                                    color = status.color
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = schedule.title ?: "제목 없음",
                                fontSize = 20.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1F2937)
                            )
                        }
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, "닫기", tint = Color.Gray)
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Date & Time
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Schedule,
                            contentDescription = null,
                            tint = BrandColors.Primary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = dateStr,
                                fontSize = 15.sp,
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF1F2937)
                            )
                            Text(
                                text = if (schedule.sstAllDay == "Y") "종일" else "$startTime${if (endTime.isNotEmpty()) " - $endTime" else ""}",
                                fontSize = 14.sp,
                                fontFamily = SuiteFont,
                                color = Color.Gray
                            )
                        }
                    }

                    // Location
                    schedule.location?.let { location ->
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = BrandColors.Primary,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = location,
                                fontSize = 15.sp,
                                fontFamily = SuiteFont,
                                color = Color(0xFF1F2937)
                            )
                        }
                    }

                    // Memo
                    schedule.sstMemo?.let { memo ->
                        if (memo.isNotBlank()) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Row(verticalAlignment = Alignment.Top) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.Notes,
                                    contentDescription = null,
                                    tint = BrandColors.Primary,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    text = memo,
                                    fontSize = 15.sp,
                                    fontFamily = SuiteFont,
                                    color = Color(0xFF1F2937)
                                )
                            }
                        }
                    }
                }


                if (canEdit) {
                    Spacer(modifier = Modifier.height(24.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDelete,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = Color.Red
                            )
                        ) {
                            Icon(Icons.Default.Delete, null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("삭제", fontFamily = SuiteFont)
                        }

                        Button(
                            onClick = onEdit,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = BrandColors.Primary
                            )
                        ) {
                            Icon(Icons.Default.Edit, null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("수정", fontFamily = SuiteFont)
                        }
                    }
                }
            }
        }
    }
}
