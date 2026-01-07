package com.dmonster.smap.ui.settings

import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.dmonster.smap.ui.theme.SuiteFont

data class GuideVideo(val title: String, val description: String, val url: String)

val GUIDE_VIDEOS = listOf(
    GuideVideo("소개1", "스케줄맵 기본 소개", "https://www.youtube.com/embed/fRLxsHCvwuQ"),
    GuideVideo("소개2", "스케줄맵 상세 소개", "https://www.youtube.com/embed/xOqCizxr2uk"),
    GuideVideo("그룹", "그룹 기능 사용법", "https://www.youtube.com/embed/Bvzaz5vFyAo"),
    GuideVideo("일정", "일정 관리 방법", "https://www.youtube.com/embed/Ba83-yfjvBQ"),
    GuideVideo("내장소", "내장소 등록 및 관리", "https://www.youtube.com/embed/EDcvCwZmF38")
)

@Composable
fun UserGuideScreen(onBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F7F7))
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header - Back Button
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
                    .padding(bottom = 40.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Gradient Header Card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .background(
                            brush = Brush.linearGradient(
                                colors = listOf(Color(0xFFFFC107), Color(0xFFFF9800))
                            ),
                            shape = RoundedCornerShape(24.dp)
                        )
                        .padding(24.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("사용 가이드", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color.White)
                                Surface(
                                    color = Color.White.copy(alpha = 0.2f),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Color.White, modifier = Modifier.size(10.dp))
                                        Text("동영상", fontFamily = SuiteFont, fontSize = 11.sp, color = Color.White)
                                    }
                                }
                            }
                            Text("앱 사용법 및 도움말", fontFamily = SuiteFont, fontSize = 14.sp, color = Color.White.copy(alpha = 0.85f))
                            Text("동영상으로 쉽게 배우는 스케줄맵", fontFamily = SuiteFont, fontSize = 12.sp, color = Color.White.copy(alpha = 0.7f))
                        }
                        
                        Surface(
                            modifier = Modifier.size(60.dp),
                            color = Color.White.copy(alpha = 0.2f),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Icon(Icons.Default.Book, contentDescription = null, tint = Color.White, modifier = Modifier.padding(16.dp))
                        }
                    }
                }

                // Video List
                GUIDE_VIDEOS.forEach { video ->
                    GuideVideoItem(video)
                }
            }
        }
    }
}

@Composable
fun GuideVideoItem(video: GuideVideo) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .background(
                            brush = Brush.linearGradient(colors = listOf(Color(0xFFFFC107), Color(0xFFFF9800))),
                            shape = RoundedCornerShape(8.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                }
                Column {
                    Text(video.title, fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color.Black)
                    Text(video.description, fontFamily = SuiteFont, fontSize = 12.sp, color = Color.Gray)
                }
            }
            
            // YouTube WebView
            YouTubePlayerCompose(video.url)
        }
    }
}

@Composable
fun YouTubePlayerCompose(url: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(200.dp)
            .background(Color.Black, RoundedCornerShape(12.dp))
    ) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    webViewClient = WebViewClient()
                    loadUrl(url)
                }
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}
