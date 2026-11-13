package com.dmonster.smap.ui.home

import com.dmonster.smap.ui.components.SmapDialogActions
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.FlightTakeoff
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.data.model.PushLog
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationScreen(
    onClose: () -> Unit,
    viewModel: NotificationViewModel = hiltViewModel()
) {
    val logs by viewModel.logs.collectAsState()
    val summary by viewModel.summary.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    // Show error message in Snackbar
    LaunchedEffect(errorMessage) {
        errorMessage?.let { message ->
            snackbarHostState.showSnackbar(
                message = message,
                actionLabel = "확인",
                duration = SnackbarDuration.Long
            )
            viewModel.clearError()
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color.White
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
                // Header
                NotificationHeader(onClose = onClose, viewModel = viewModel)

                // Summary Cards
                NotificationSummaryRow(
                    total = summary.total,
                    unread = summary.unread,
                    read = summary.read
                )

                // List
                PullToRefreshBox(
                    isRefreshing = isRefreshing,
                    onRefresh = { viewModel.refresh() },
                    modifier = Modifier.fillMaxSize()
                ) {
                    if (isLoading && logs.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = AccentColors.Pink)
                        }
                    } else if (logs.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                text = "최근 7일 동안 받은 알림이 없어요",
                                fontFamily = SuiteFont,
                                color = BrandColors.TextSecondary
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(logs, key = { it.pltIdx }) { log ->
                                NotificationItem(log = log)
                            }
                        }
                    }
                }
            }
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
    }
}

@Composable
fun NotificationHeader(onClose: () -> Unit, viewModel: NotificationViewModel) {
    var showMenu by remember { mutableStateOf(false) }
    var showDeleteConfirmation by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(
            onClick = onClose,
            modifier = Modifier
                .size(48.dp) // 터치타깃 48dp 확보(접근성), 내부 아이콘 시각크기는 20dp 유지
                .background(BrandColors.InputBackground, CircleShape)
        ) {
            Icon(Icons.Default.Close, contentDescription = "닫기", tint = Color.LightGray, modifier = Modifier.size(20.dp))
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "알림",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = SuiteFont,
                color = Color.Black
            )
            Text(
                text = "최근 7일 동안 받은 알림이에요",
                fontSize = 12.sp,
                fontFamily = SuiteFont,
                color = BrandColors.TextSecondary
            )
        }

        Box {
            IconButton(
                onClick = { showMenu = true },
                modifier = Modifier
                    .size(48.dp) // 터치타깃 48dp 확보(접근성), 내부 아이콘 시각크기는 20dp 유지
                    .border(1.dp, BrandColors.Border, CircleShape)
            ) {
                Icon(Icons.Default.MoreHoriz, contentDescription = "메뉴", tint = Color.LightGray, modifier = Modifier.size(20.dp))
            }

            DropdownMenu(
                expanded = showMenu,
                onDismissRequest = { showMenu = false },
                modifier = Modifier.background(Color.White)
            ) {
                DropdownMenuItem(
                    text = {
                        Text(
                            text = "전체 삭제",
                            fontFamily = SuiteFont,
                            color = BrandColors.Error
                        )
                    },
                    onClick = {
                        showMenu = false
                        showDeleteConfirmation = true
                    }
                )
            }
        }
    }

    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = {
                Text(
                    text = "전체 삭제",
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = "모든 알림을 삭제하시겠습니까?",
                    fontFamily = SuiteFont
                )
            },
            confirmButton = {
                SmapDialogActions(
                    confirmText = "삭제",
                    onConfirm = {
                        showDeleteConfirmation = false
                        viewModel.deleteAllLogs()
                    },
                    onDismiss = { showDeleteConfirmation = false },
                    destructive = true
                )
            },
            shape = RoundedCornerShape(16.dp),
            containerColor = Color.White
        )
    }
}

@Composable
fun NotificationSummaryRow(total: Int, unread: Int, read: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        SummaryCard(
            count = total,
            label = "전체",
            bgColor = Color(0xFFE8EAF6),
            textColor = Color(0xFF3F51B5),
            modifier = Modifier.weight(1f)
        )
        SummaryCard(
            count = unread,
            label = "읽지 않음",
            bgColor = Color(0xFFFCE4EC),
            textColor = Color(0xFFE91E63),
            modifier = Modifier.weight(1f)
        )
        SummaryCard(
            count = read,
            label = "읽음",
            bgColor = Color(0xFFE8F5E9),
            textColor = Color(0xFF4CAF50),
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
fun SummaryCard(count: Int, label: String, bgColor: Color, textColor: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .height(80.dp)
            .background(bgColor, RoundedCornerShape(8.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = count.toString(),
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = SuiteFont,
            color = textColor
        )
        Text(
            text = label,
            fontSize = 12.sp,
            fontFamily = SuiteFont,
            color = Color.Gray
        )
    }
}

@Composable
fun NotificationItem(log: PushLog) {
    val isUnread = log.pltReadChk == "N"
    val pinkBorder = AccentColors.Pink.copy(alpha = 0.3f)
    val lightGreyBorder = BrandColors.Border
    
    // Parse timestamp (plt_sdate)
    val formattedTime = remember(log.pltSdate) {
        log.pltSdate?.let { dateStr ->
            try {
                val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(dateStr)
                if (date != null) {
                    val outFormat = SimpleDateFormat("a hh:mm", Locale.KOREAN)
                    outFormat.format(date)
                } else ""
            } catch (e: Exception) {
                ""
            }
        } ?: ""
    }
    
    // 알림 타입을 이모지 inline append 대신 Material 아이콘으로 표시(스크린리더 오독 방지 + 접근성)
    val (typeIcon, typeIconDesc) = when {
        log.pltTitle?.contains("방문") == true -> Icons.Default.Flag to "방문 알림"
        log.pltTitle?.contains("이탈") == true -> Icons.Default.FlightTakeoff to "이탈 알림"
        log.pltTitle?.contains("시작") == true -> Icons.Default.Schedule to "시작 알림"
        else -> Icons.Default.Notifications to "알림"
    }

    val displayTitle = log.pltTitle ?: "알림"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp, 
            if (isUnread) pinkBorder else lightGreyBorder
        ),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = typeIcon,
                    contentDescription = typeIconDesc,
                    tint = AccentColors.Pink,
                    modifier = Modifier
                        .padding(end = 6.dp)
                        .size(18.dp)
                )
                Text(
                    text = displayTitle,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont,
                    color = Color.Black,
                    modifier = Modifier.weight(1f)
                )
                
                if (isUnread) {
                    Box(
                        modifier = Modifier
                            .padding(end = 6.dp)
                            .background(Color(0xFFFCE4EC), RoundedCornerShape(4.dp))
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text("NEW", fontSize = 10.sp, color = Color(0xFFE91E63), fontWeight = FontWeight.Bold)
                    }
                }
                
                // Timestamp with grey background pill
                Box(
                    modifier = Modifier
                        .background(Color(0xFFF5F5F5), RoundedCornerShape(16.dp))
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = formattedTime,
                        fontSize = 11.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray
                    )
                }
            }
            
            Text(
                text = log.pltContent ?: "",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                color = Color.Gray,
                lineHeight = 16.sp, // Reduced from 18.sp
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp) // Minimal top padding instead of Spacer
            )
        }
    }
}
