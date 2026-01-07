package com.dmonster.smap.ui.home

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.text.TextPaint
import androidx.core.content.res.ResourcesCompat
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.widthIn
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import kotlinx.coroutines.delay
import java.util.TimeZone
import java.text.SimpleDateFormat
import java.util.Locale

// MARK: - Map Loading Overlay

@Composable
fun MapLoadingOverlay() {
    var dotIndex by remember { mutableIntStateOf(0) }
    
    LaunchedEffect(Unit) {
        while (true) {
            delay(400)
            dotIndex = (dotIndex + 1) % 3
        }
    }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        BrandColors.Primary.copy(alpha = 0.95f),
                        Color(0xFF667EEA).copy(alpha = 0.95f)
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Map Icon Circle
            Box(
                modifier = Modifier
                    .size(90.dp)
                    .background(Color.White.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Map,
                    contentDescription = "Map",
                    tint = Color.White,
                    modifier = Modifier.size(44.dp)
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Loading Text
            Text(
                text = "지도 로딩 중",
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = SuiteFont,
                color = Color.White
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Animated Dots
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(3) { index ->
                    val scale by animateFloatAsState(
                        targetValue = if (dotIndex == index) 1.3f else 1.0f,
                        animationSpec = tween(durationMillis = 400),
                        label = "dot_scale_$index"
                    )
                    val alpha = if (dotIndex == index) 1.0f else 0.5f
                    
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .scale(scale)
                            .background(Color.White.copy(alpha = alpha), CircleShape)
                    )
                }
            }
        }
    }
}

// MARK: - Home Header View

@Composable
fun HomeHeaderView(
    title: String = "홈",
    hasUnread: Boolean = false,
    onNotificationTap: () -> Unit = {},
    onSettingsTap: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Color.White.copy(alpha = 0.9f)
            )
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = SuiteFont,
                color = Color.Black
            )
            Text(
                text = "그룹 멤버들과 실시간으로 소통해보세요",
                fontSize = 13.sp,
                fontFamily = SuiteFont,
                color = Color.Gray
            )
        }
        
        Row(horizontalArrangement = Arrangement.spacedBy(0.dp)) {
            // Notification Button
            Box(modifier = Modifier.size(48.dp)) {
                IconButton(
                    onClick = onNotificationTap,
                    modifier = Modifier.fillMaxSize()
                ) {
                    Icon(
                        imageVector = Icons.Filled.Notifications,
                        contentDescription = "Notifications",
                        tint = Color.Gray,
                        modifier = Modifier.size(24.dp)
                    )
                }
                if (hasUnread) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(Color.Red, CircleShape)
                            .align(Alignment.TopEnd)
                            .offset(x = (-4).dp, y = 4.dp)
                    )
                }
            }
            
            // Settings Button
            IconButton(
                onClick = onSettingsTap,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.Settings,
                    contentDescription = "Settings",
                    tint = Color.Gray,
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}

// MARK: - Member Info Window

@Composable
fun MemberInfoWindow(
    member: com.dmonster.smap.data.model.SmapGroupMember,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    val batteryLevel = member.mltBattery ?: 0
    val speed = member.mltSpeed ?: 0.0
    
    // GPS 시간 포맷팅 (iOS 스타일: 16:46)
    val gpsTimeStr = remember(member.mltGpsTime) {
        val gpsTime = member.mltGpsTime
        if (gpsTime.isNullOrBlank()) {
            "정보 없음"
        } else {
            try {
                // Input format: 2024-01-03T16:46:00Z or similar
                val inputSdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.KOREA)
                inputSdf.timeZone = TimeZone.getTimeZone("UTC")
                val date = inputSdf.parse(gpsTime.replace("Z", "").split(".")[0])
                if (date != null) {
                    val outputSdf = SimpleDateFormat("HH:mm", Locale.KOREA)
                    outputSdf.format(date)
                } else "정보 없음"
            } catch (e: Exception) {
                "정보 없음"
            }
        }
    }

    Card(
        modifier = modifier
            .width(170.dp),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier.padding(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 4.dp),
            verticalArrangement = Arrangement.spacedBy((-3).dp)
        ) {
            // Header: Icon + Name
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.Person,
                    contentDescription = null,
                    tint = Color(0xFF6366F1),
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = member.displayName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont,
                    color = Color.Black,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            
            // Battery Row
            InfoRow(
                icon = Icons.Filled.BatteryFull, // Ideally should change based on level, but matches screenshot type
                label = "배터리:",
                value = "$batteryLevel%",
                iconTint = Color(0xFF22C55E)
            )
            
            // Speed Row
            InfoRow(
                icon = Icons.Filled.DirectionsWalk,
                label = "속도:",
                value = "${String.format("%.1f", speed)}km/h",
                iconTint = Color(0xFFF59E0B)
            )
            
            // GPS Update Row
            InfoRow(
                icon = Icons.Filled.AccessTime,
                label = "GPS 업데이트:",
                value = gpsTimeStr,
                iconTint = Color(0xFF94A3B8)
            )
        }
    }
}

@Composable
private fun InfoRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    iconTint: Color
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(14.dp)
        )
        Text(
            text = label,
            fontSize = 12.sp,
            fontFamily = SuiteFont,
            color = Color(0xFF64748B),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = value,
            fontSize = 12.sp,
            fontFamily = SuiteFont,
            color = Color(0xFF64748B),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
    }
}

// MARK: - Floating Action Home Button

@Composable
fun FloatingActionHomeButton(
    memberCount: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pinkColor = Color(0xFFEC4899)
    
    Box(modifier = modifier) {
        FloatingActionButton(
            onClick = onClick,
            containerColor = BrandColors.Primary,
            contentColor = Color.White,
            shape = CircleShape, // Explicitly set CircleShape
            modifier = Modifier.size(64.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.Person,
                contentDescription = "Members",
                modifier = Modifier.size(32.dp)
            )
        }
        
        // Member Count Badge
        if (memberCount > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 4.dp, y = (-4).dp) // Adjust offset for reverted button size
                    .size(26.dp)
                    .background(pinkColor, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (memberCount > 99) "99+" else memberCount.toString(),
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont
                )
            }
        }
    }
}

// MARK: - Marker Utils

object MarkerUtils {

    /**
     * 멤버 마커 비트맵 생성 (핀 + 아바타 + 하단 캡션)
     */
    fun createMemberMarkerBitmap(context: Context, name: String, isSelected: Boolean, avatar: Bitmap? = null): Bitmap {
        val suiteBold = ResourcesCompat.getFont(context, com.dmonster.smap.R.font.suite_bold)
        
        // Dimensions
        val pinSize = 100f // 키워서 아바타가 잘 보이게 함
        val avatarSize = 80f
        val textPadding = 12f
        val textSize = 28f
        
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (isSelected) AndroidColor.WHITE else AndroidColor.BLACK
            this.textSize = textSize
            typeface = suiteBold ?: Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        
        val textWidth = textPaint.measureText(name)
        val bgPaddingH = 16f
        val bgPaddingV = 8f
        val bubbleWidth = textWidth + (bgPaddingH * 2)
        val bubbleHeight = textSize + (bgPaddingV * 2)
        
        val width = maxOf(pinSize, bubbleWidth)
        val height = pinSize + textPadding + bubbleHeight
        
        val bitmap = Bitmap.createBitmap(width.toInt(), height.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        
        val cx = width / 2
        
        // 1. Draw Pin (Background Circle)
        paint.color = if (isSelected) AndroidColor.parseColor("#4F46E5") else AndroidColor.GRAY
        canvas.drawCircle(cx, pinSize / 2, pinSize / 2, paint)
        
        // 2. Draw Avatar or White Inner Circle
        if (avatar != null) {
            // Draw White Border for Avatar
            paint.color = AndroidColor.WHITE
            canvas.drawCircle(cx, pinSize / 2, avatarSize / 2 + 4f, paint)
            
            // Draw Cropped Avatar
            val avatarRect = RectF(
                cx - avatarSize / 2,
                pinSize / 2 - avatarSize / 2,
                cx + avatarSize / 2,
                pinSize / 2 + avatarSize / 2
            )
            
            // Create circular path for clipping
            val path = android.graphics.Path().apply {
                addCircle(cx, pinSize / 2, avatarSize / 2, android.graphics.Path.Direction.CW)
            }
            
            canvas.save()
            canvas.clipPath(path)
            canvas.drawBitmap(avatar, null, avatarRect, Paint(Paint.FILTER_BITMAP_FLAG))
            canvas.restore()
        } else {
            // Fallback: White inner circle
            paint.color = AndroidColor.WHITE
            canvas.drawCircle(cx, pinSize / 2, pinSize / 4, paint)
        }
        
        // 3. Draw Text Bubble (Name)
        val bubbleRect = RectF(
            cx - bubbleWidth / 2,
            pinSize + textPadding,
            cx + bubbleWidth / 2,
            pinSize + textPadding + bubbleHeight
        )
        
        paint.color = if (isSelected) AndroidColor.parseColor("#4F46E5") else AndroidColor.WHITE
        if (!isSelected) {
            paint.setShadowLayer(4f, 0f, 2f, AndroidColor.LTGRAY)
        }
        canvas.drawRoundRect(bubbleRect, 15f, 15f, paint)
        paint.clearShadowLayer()
        
        // Draw Text
        val textBaseline = bubbleRect.centerY() - (textPaint.fontMetrics.descent + textPaint.fontMetrics.ascent) / 2
        canvas.drawText(name, cx, textBaseline, textPaint)
        
        return bitmap
    }

    /**
     * 일정 마커 비트맵 생성 (순번 + 제목 + 시간)
     */
    fun createScheduleMarkerBitmap(context: Context, schedule: SmapSchedule, index: Int): Bitmap {
        val order = index + 1
        val title = schedule.title ?: "No Title"
        val scheduleDate = schedule.date
        val time = if (scheduleDate != null && scheduleDate.length >= 16) scheduleDate.substring(11, 16) else ""

        // Custom Font (Suite-Bold)
        val suiteBold = ResourcesCompat.getFont(context, com.dmonster.smap.R.font.suite_bold)

        // Dimensions
        val orderSize = 56f  // Reduced slightly for better proportions
        val titleHeight = 70f
        val timeHeight = 45f
        val padding = 12f
        val cornerRadius = 24f

        // Paints
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            textSize = 32f
            typeface = suiteBold ?: Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }

        // Measure Title Width
        textPaint.textSize = 32f
        val titleWidth = textPaint.measureText(title) + 80f
        val width = maxOf(titleWidth, 200f) 
        val totalHeight = orderSize + titleHeight + (if (time.isNotEmpty()) timeHeight + padding else 0f) + (padding * 2)

        val bitmap = Bitmap.createBitmap(width.toInt(), totalHeight.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // 1. Draw Order Circle (MUST BE PERFECT CIRCLE)
        val cx = width / 2
        val cyOrder = orderSize / 2
        paint.color = AndroidColor.parseColor("#22C55E") // Green
        canvas.drawCircle(cx, cyOrder, orderSize / 2, paint)
        
        // Draw Order Text
        textPaint.textSize = 28f
        val fontMetrics = textPaint.fontMetrics
        val baseline = cyOrder - (fontMetrics.descent + fontMetrics.ascent) / 2
        canvas.drawText(order.toString(), cx, baseline, textPaint)

        // 2. Draw Title Box
        paint.color = AndroidColor.parseColor("#4F46E5") // Indigo
        val titleRect = RectF(0f, orderSize + 8f, width, orderSize + 8f + titleHeight)
        canvas.drawRoundRect(titleRect, cornerRadius, cornerRadius, paint)
        
        // Draw Title Text
        textPaint.textSize = 32f
        val titleBaseline = titleRect.centerY() - (textPaint.fontMetrics.descent + textPaint.fontMetrics.ascent) / 2
        canvas.drawText(title, cx, titleBaseline, textPaint)

        // 3. Draw Time Box
        if (time.isNotEmpty()) {
            paint.color = AndroidColor.parseColor("#EC4899") // Pink
            val timeRect = RectF(width / 4, titleRect.bottom + 8f, width * 3 / 4, titleRect.bottom + 8f + timeHeight)
            canvas.drawRoundRect(timeRect, 15f, 15f, paint)
            
            // Draw Time Text
            textPaint.textSize = 26f
            val timeBaseline = timeRect.centerY() - (textPaint.fontMetrics.descent + textPaint.fontMetrics.ascent) / 2
            canvas.drawText(time, cx, timeBaseline, textPaint)
        }
        
        return bitmap
    }
}
