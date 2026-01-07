package com.dmonster.smap.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.SmapNotice
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.ui.theme.SuiteFont
import kotlinx.coroutines.launch

@Composable
fun NoticeListScreen(onBack: () -> Unit, onNoticeClick: (SmapNotice) -> Unit) {
    val context = LocalContext.current
    val authService = remember { AuthService.getInstance(context) }
    var notices by remember { mutableStateOf<List<SmapNotice>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val response = authService.getNotices()
                if (response != null) {
                    notices = response.notices
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Unknown error"
            } finally {
                isLoading = false
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F7F7))
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 20.dp)
            ) {
                Surface(
                    onClick = onBack,
                    shape = RoundedCornerShape(24.dp),
                    color = Color.White,
                    shadowElevation = 2.dp,
                    modifier = Modifier.height(44.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "뒤로",
                            tint = Color.Black,
                            modifier = Modifier.size(24.dp)
                        )
                        Text(
                            text = "뒤로",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color.Black
                        )
                    }
                }
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color.Red)
                }
            } else if (errorMessage != null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("오류: $errorMessage", color = Color.Gray, fontFamily = SuiteFont)
                }
            } else if (notices.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("등록된 공지사항이 없습니다.", color = Color.Gray, fontFamily = SuiteFont)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        // Header Card
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 12.dp)
                                .background(
                                    brush = Brush.linearGradient(
                                        colors = listOf(Color.Red, Color(0xFFCC0000))
                                    ),
                                    shape = RoundedCornerShape(24.dp)
                                )
                                .padding(24.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("공지사항", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color.White)
                                    Text("최신 소식 및 업데이트", fontFamily = SuiteFont, fontSize = 14.sp, color = Color.White.copy(alpha = 0.8f))
                                }
                                Icon(Icons.Default.Notifications, contentDescription = null, tint = Color.White.copy(alpha = 0.3f), modifier = Modifier.size(32.dp))
                            }
                        }
                    }

                    items(notices) { notice ->
                        NoticeItem(notice = notice, onClick = { onNoticeClick(notice) })
                    }
                }
            }
        }
    }
}

@Composable
fun NoticeItem(notice: SmapNotice, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(notice.ntTitle, fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.Black, maxLines = 1)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(notice.ntWdate.take(10), fontFamily = SuiteFont, fontSize = 12.sp, color = Color.Gray)
                Text("조회수 ${notice.ntHit}", fontFamily = SuiteFont, fontSize = 12.sp, color = Color.Gray)
            }
        }
    }
}

@Composable
fun NoticeDetailScreen(notice: SmapNotice, onBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F7F7))
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 20.dp)
            ) {
                Surface(
                    onClick = onBack,
                    shape = RoundedCornerShape(24.dp),
                    color = Color.White,
                    shadowElevation = 2.dp,
                    modifier = Modifier.height(44.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "뒤로",
                            tint = Color.Black,
                            modifier = Modifier.size(24.dp)
                        )
                        Text(
                            text = "뒤로",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color.Black
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
            ) {
                Text(notice.ntTitle, fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color.Black)
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(notice.ntWdate, fontFamily = SuiteFont, fontSize = 13.sp, color = Color.Gray)
                    Text("조회수 ${notice.ntHit}", fontFamily = SuiteFont, fontSize = 13.sp, color = Color.Gray)
                }
                
                HorizontalDivider(modifier = Modifier.padding(vertical = 24.dp), color = Color.Black.copy(alpha = 0.05f))
                
                Text(notice.ntContent, fontFamily = SuiteFont, fontSize = 15.sp, lineHeight = 24.sp, color = Color.Black)
                
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }
}
