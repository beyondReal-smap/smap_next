package com.dmonster.smap.ui.schedule

import com.dmonster.smap.BuildConfig
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.theme.SuiteFont

@Composable
fun ScheduleSection(
    number: String,
    title: String,
    bgColor: Color,
    iconColor: Color,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color.Gray.copy(alpha = 0.1f)),
        tonalElevation = 0.dp,
        shadowElevation = 2.dp
    ) {
        Column(
            modifier = Modifier.padding(16.dp).background(Color.White)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(bottom = 16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .background(iconColor, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = number,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = SuiteFont
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = title,
                    fontSize = 17.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
            }
            content()
        }
    }
}

@Composable
fun MemberItem(
    member: SmapGroupMember,
    isSelected: Boolean,
    isEdit: Boolean = false,
    onClick: () -> Unit
) {
    // Resolve avatar URL
    val imageUrl = remember(member.mtFile1) {
        if (!member.mtFile1.isNullOrBlank()) {
            when {
                member.mtFile1.startsWith("http") -> member.mtFile1
                member.mtFile1.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}${member.mtFile1}"
                member.mtFile1.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images${member.mtFile1}"
                else -> "${BuildConfig.IMAGE_BASE_URL}/images/${member.mtFile1}"
            }
        } else null
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clickable(onClick = onClick)
            .alpha(if (isEdit && !isSelected) 0.5f else 1.0f)
    ) {
        Box(
            modifier = Modifier.size(60.dp),
            contentAlignment = Alignment.Center
        ) {
            // Layer 1: Avatar / Placeholder
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .background(Color.Gray.copy(alpha = 0.1f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = null,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(Icons.Default.Person, null, tint = Color.Gray, modifier = Modifier.size(28.dp))
                }
            }

            // Layer 2: Selection Border (Only shown when selected)
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .border(2.dp, Color(0xFFEF4444), CircleShape)
                )
            }

            // Layer 3: Check Icon (Only shown when selected, top-most layer)
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(bottom = 2.dp, end = 2.dp)
                        .size(22.dp)
                        .background(Color.White, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = member.displayName,
            fontSize = 12.sp,
            fontFamily = SuiteFont,
            color = if (isSelected) Color(0xFFEF4444) else Color.Gray,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(60.dp),
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun TimeChip(text: String, onClick: () -> Unit = {}) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color.Gray.copy(alpha = 0.1f)),
        tonalElevation = 0.dp,
        shadowElevation = 1.dp
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            fontFamily = SuiteFont,
            fontSize = 14.sp,
            color = Color.Black
        )
    }
}

@Composable
fun SelectionField(
    label: String,
    value: String,
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Text(text = label, fontSize = 12.sp, fontFamily = SuiteFont, color = Color.Gray)
        Spacer(modifier = Modifier.height(4.dp))
        Surface(
            onClick = onClick,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
            color = Color.White,
            border = BorderStroke(1.dp, Color.Gray.copy(alpha = 0.1f)),
            tonalElevation = 0.dp,
            shadowElevation = 1.dp
        ) {
            Row(
                modifier = Modifier
                    .padding(horizontal = 12.dp, vertical = 10.dp)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = value, fontSize = 14.sp, fontFamily = SuiteFont, color = Color.Black)
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
            }
        }
    }
}
