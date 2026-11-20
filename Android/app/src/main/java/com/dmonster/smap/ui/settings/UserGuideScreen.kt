package com.dmonster.smap.ui.settings

import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.components.SmapTopBar
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

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
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
        SmapTopBar(title = "사용 가이드", onBack = onBack)
        androidx.compose.foundation.lazy.LazyColumn(
            modifier = Modifier.align(Alignment.CenterHorizontally).widthIn(max = 600.dp).fillMaxSize(),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            item { Text("동영상 가이드", style = SmapText.pageTitle, color = MaterialTheme.colorScheme.onSurface) }
            items(GUIDE_VIDEOS.size, key = { GUIDE_VIDEOS[it].url }) { index ->
                GuideVideoItem(GUIDE_VIDEOS[index])
            }
        }
    }
}

@Composable
fun GuideVideoItem(video: GuideVideo) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(video.description, style = SmapText.headline, color = MaterialTheme.colorScheme.onSurface)
        YouTubePlayerCompose(video.url)
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
fun YouTubePlayerCompose(url: String) {
    val trustedDomains = listOf("youtube.com", "www.youtube.com", "youtu.be", "www.youtube-nocookie.com")

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(16f / 9f)
            .clip(RoundedCornerShape(14.dp))
            .background(Color.Black)
    ) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): Boolean {
                            val host = request?.url?.host ?: return true
                            return trustedDomains.none { host == it || host.endsWith(".$it") }
                        }
                    }
                    loadUrl(url)
                }
            },
            modifier = Modifier.fillMaxSize(),
            onRelease = { webView ->
                webView.stopLoading()
                webView.destroy()
            }
        )
    }
}
