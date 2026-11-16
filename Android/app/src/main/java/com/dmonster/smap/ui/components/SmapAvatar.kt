package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.ui.theme.SuiteFont

/**
 * 서버가 주는 프로필 경로(절대 URL, "/images/..", "/..", 파일명)를 이미지 URL 로 바꾼다.
 * 화면마다 같은 분기를 복사해 쓰던 것을 한곳으로 모은다.
 */
fun profileImageUrl(path: String?): String? {
    if (path.isNullOrBlank()) return null
    return when {
        path.startsWith("http") -> path
        path.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}$path"
        path.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images$path"
        else -> "${BuildConfig.IMAGE_BASE_URL}/images/$path"
    }
}

/**
 * 멤버 얼굴 원. 사진이 없으면 이름 첫 글자를 연한 남색 원 위에 보인다(회색 사람 아이콘 대신 누구인지 구분되게).
 * [selected] 이면 남색 테두리와 흰 간격으로 선택을 표시한다.
 */
@Composable
fun SmapAvatar(
    name: String,
    imagePath: String?,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    selected: Boolean = false,
) {
    val colors = MaterialTheme.colorScheme
    val url = profileImageUrl(imagePath)
    val ring = if (selected) 2.5.dp else 0.dp
    Box(
        modifier = modifier
            .size(size)
            .then(if (selected) Modifier.border(ring, SmapBrush.navy, CircleShape) else Modifier)
            .padding(if (selected) ring + 2.dp else 0.dp)
            .clip(CircleShape)
            .background(colors.primaryContainer),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = name.trim().take(1).ifEmpty { "?" },
            color = colors.primary,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.38f).sp,
        )
        if (url != null) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current).data(url).crossfade(true).build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}
