package com.dmonster.smap.ui.register

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.data.model.LegalContent
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapButtonStyle
import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.ui.theme.SmapText

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LegalScreen(
    document: LegalContent.LegalDocument,
    onBack: () -> Unit
) {
    Scaffold(
        topBar = { SmapTopBar(title = "약관 상세", onBack = onBack) },
        containerColor = MaterialTheme.colorScheme.surface
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Header
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.Start,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = document.title,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                document.effectiveDate?.let {
                    Text(
                        text = "시행일: $it",
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            // Intro
            document.intro?.let {
                Text(
                    text = it,
                    fontSize = 17.sp,
                    lineHeight = 24.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            
            // Sections
            document.sections.forEach { section ->
                TermSection(title = section.title, content = section.content)
            }
            
            // Footer
            document.footer?.let {
                Column(
                    modifier = Modifier.padding(top = 20.dp, bottom = 40.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "부칙",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = it,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // 전문 보기 — 웹에 게시한 원문(표·신고확인증 이미지 포함)을 연다
            val uriHandler = LocalUriHandler.current
            SmapButton(
                text = "전문 보기",
                onClick = { uriHandler.openUri("${BuildConfig.WEB_BASE_URL}/${document.webPath}") },
                style = SmapButtonStyle.Secondary,
                modifier = Modifier.padding(bottom = 40.dp),
            )
        }
    }
}

@Composable
fun TermSection(title: String, content: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            style = SmapText.headline,
            color = MaterialTheme.colorScheme.primary
        )
        
        Text(
            text = content,
            fontSize = 16.sp,
            lineHeight = 22.sp,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
