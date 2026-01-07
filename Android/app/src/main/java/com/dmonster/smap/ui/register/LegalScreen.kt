package com.dmonster.smap.ui.register

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.LegalContent
import com.dmonster.smap.ui.theme.BrandColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LegalScreen(
    document: LegalContent.LegalDocument,
    onBack: () -> Unit
) {
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = document.title,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = BrandColors.TextPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.Default.ChevronLeft,
                            contentDescription = "뒤로",
                            tint = BrandColors.TextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color.White
                )
            )
        },
        containerColor = Color(0xFFFAFAFF) // iOS 스타일 배경색 (red: 0.98, green: 0.98, blue: 1.0)
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
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = document.title,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color = BrandColors.TextPrimary
                )
                
                Text(
                    text = "시행일: ${document.effectiveDate}",
                    fontSize = 16.sp,
                    color = Color.Gray
                )
            }
            
            // Intro
            document.intro?.let {
                Text(
                    text = it,
                    fontSize = 17.sp,
                    lineHeight = 24.sp,
                    color = BrandColors.TextPrimary
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
                        color = BrandColors.TextPrimary
                    )
                    Text(
                        text = it,
                        fontSize = 16.sp,
                        color = Color.Gray
                    )
                }
            }
        }
    }
}

@Composable
fun TermSection(title: String, content: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = BrandColors.TextPrimary
        )
        
        Text(
            text = content,
            fontSize = 16.sp,
            lineHeight = 22.sp,
            color = Color.DarkGray
        )
    }
}
