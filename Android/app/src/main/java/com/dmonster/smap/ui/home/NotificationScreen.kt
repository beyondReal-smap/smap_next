package com.dmonster.smap.ui.home

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
import androidx.compose.material.icons.filled.MoreHoriz
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

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color.White
    ) {
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
                        CircularProgressIndicator(color = Color(0xFFF06292))
                    }
                } else if (logs.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = "최근 7일간의 알림이 없습니다",
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
                        items(logs) { log ->
                            NotificationItem(log = log)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationHeader(onClose: () -> Unit, viewModel: NotificationViewModel) {
    var showMenu by remember { mutableStateOf(false) }

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
                .size(36.dp)
                .background(Color(0xFFF5F5F5), CircleShape)
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
                text = "최근 7일간의 알림을 확인하세요",
                fontSize = 12.sp,
                fontFamily = SuiteFont,
                color = BrandColors.TextSecondary
            )
        }

        Box {
            IconButton(
                onClick = { showMenu = true },
                modifier = Modifier
                    .size(36.dp)
                    .border(1.dp, Color(0xFFEEEEEE), CircleShape)
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
                        viewModel.deleteAllLogs()
                    }
                )
            }
        }
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
    val pinkBorder = Color(0xFFFFD1DC)
    val lightGreyBorder = Color(0xFFEEEEEE)
    
    // Parse timestamp (plt_sdate)
    val formattedTime = remember(log.pltSdate) {
        try {
            val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(log.pltSdate) ?: Date()
            val outFormat = SimpleDateFormat("a hh:mm", Locale.KOREAN)
            outFormat.format(date)
        } catch (e: Exception) {
            ""
        }
    }
    
    // Determine icon/emoji - Only add if NOT already in the title
    val emoji = when {
        log.pltTitle?.contains("방문") == true -> "🚩"
        log.pltTitle?.contains("이탈") == true -> "🚀"
        log.pltTitle?.contains("시작") == true -> "⏰"
        else -> "🔔"
    }
    
    val displayTitle = if (log.pltTitle?.contains(emoji) == true) {
        log.pltTitle
    } else {
        "${log.pltTitle ?: "알림"} $emoji"
    }

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
                Text(
                    text = displayTitle ?: "알림",
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
