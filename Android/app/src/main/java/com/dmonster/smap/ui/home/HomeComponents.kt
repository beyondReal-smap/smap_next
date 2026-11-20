package com.dmonster.smap.ui.home

import com.dmonster.smap.ui.components.SmapAccent
import com.dmonster.smap.ui.theme.FamilyColors
import com.dmonster.smap.ui.components.SmapTabHeader
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.text.TextUtils
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
import androidx.compose.ui.graphics.toArgb
import com.dmonster.smap.ui.components.familyColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.widthIn
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.data.model.ScheduleStatus
import com.naver.maps.geometry.LatLng
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SemanticColors
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
                        SmapAccent.Family.deep.copy(alpha = 0.95f),
                        SmapAccent.Family.bright.copy(alpha = 0.95f)
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
                    contentDescription = "지도",
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
    // 탭 공용 머리글로 통일 — 지도 위에 얹히므로 overMap.
    SmapTabHeader(title = title, overMap = true) {
        Row(horizontalArrangement = Arrangement.spacedBy(0.dp)) {
            // Notification Button with Badge — 읽지 않음 dot 는 AccentColors 토큰
            IconButton(
                onClick = onNotificationTap,
                modifier = Modifier.size(48.dp)
            ) {
                BadgedBox(
                    badge = {
                        if (hasUnread) {
                            Badge(
                                modifier = Modifier
                                    .size(8.dp)
                                    .offset(x = 2.dp, y = (-2).dp),
                                containerColor = AccentColors.NotificationDot
                            )
                        }
                    }
                ) {
                    Icon(
                        imageVector = Icons.Filled.Notifications,
                        contentDescription = if (hasUnread) "알림, 읽지 않은 알림 있음" else "알림",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(24.dp)
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
                    contentDescription = "설정",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
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
    val batteryLevel = member.mltBattery
    val speed = (member.mltSpeed ?: 0.0) * 3.6 // 서버 값은 m/s — km/h 로 바꿔 보여 준다(iOS 와 같게)
    
    // 값이 없는 항목은 "정보없음"을 보여 주는 대신 줄 자체를 숨긴다(빈 값이 정보처럼 보이지 않게).
    val batteryText = batteryLevel?.takeIf { it >= 0 }?.let { "$it%" }

    // GPS 시간 포맷팅 (iOS 스타일: 16:46). 파싱할 수 없으면 null — 줄을 숨긴다.
    val gpsTimeStr: String? = remember(member.mltGpsTime) {
        val gpsTime = member.mltGpsTime
        if (gpsTime.isNullOrBlank()) {
            null
        } else {
            try {
                // Input format: 2024-01-03T16:46:00Z or similar
                val inputSdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.KOREA)
                inputSdf.timeZone = TimeZone.getTimeZone("UTC")
                val date = inputSdf.parse(gpsTime.replace("Z", "").split(".")[0])
                if (date != null) {
                    val outputSdf = SimpleDateFormat("HH:mm", Locale.KOREA)
                    outputSdf.timeZone = TimeZone.getDefault()
                    outputSdf.format(date)
                } else null
            } catch (e: Exception) {
                null
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
                    tint = AccentColors.Indigo,
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
            
            // Battery Row — 값이 있을 때만
            if (batteryText != null) {
                InfoRow(
                    icon = Icons.Filled.BatteryFull,
                    label = "배터리",
                    value = batteryText,
                    iconTint = SemanticColors.StatCompleted
                )
            }

            // Speed Row
            InfoRow(
                icon = Icons.Filled.DirectionsWalk,
                label = "속도",
                value = "${String.format(Locale.US, "%.1f", speed)} km/h",
                iconTint = AccentColors.Orange
            )

            // GPS Update Row — 값이 있을 때만
            if (gpsTimeStr != null) {
                InfoRow(
                    icon = Icons.Filled.AccessTime,
                    label = "위치 갱신",
                    value = gpsTimeStr,
                    iconTint = BrandColors.TextSecondary
                )
            }
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
    // "라벨 값" 형식으로 통일(이전: "배터리:"·"GPS 업데이트:" 처럼 콜론·띄어쓰기가 제각각).
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
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
            color = BrandColors.TextSecondary,
            maxLines = 1
        )
        Text(
            text = value,
            fontSize = 12.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            color = BrandColors.TextPrimary,
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
    val pinkColor = AccentColors.Pink
    val haptics = rememberSmapHaptics()

    Box(modifier = modifier) {
        FloatingActionButton(
            onClick = {
                haptics.medium()
                onClick()
            },
            containerColor = BrandColors.Primary,
            contentColor = Color.White,
            shape = CircleShape,
            modifier = Modifier.size(64.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.Person,
                contentDescription = if (memberCount > 0) "멤버 조회, ${memberCount}명" else "멤버 조회",
                modifier = Modifier.size(32.dp)
            )
        }

        // Member Count Badge — 접근성 라벨은 FAB 에 통합, 배지는 장식적 표시
        if (memberCount > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 4.dp, y = (-4).dp)
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
    fun createMemberMarkerBitmap(context: Context, memberId: Int, name: String, isSelected: Boolean, avatar: Bitmap?): Bitmap {
        val accent = familyColor(memberId)
        val ink = FamilyColors.Ink.toArgb()
        val density = context.resources.displayMetrics.density
        val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = ResourcesCompat.getFont(context, com.dmonster.smap.R.font.suite_bold)
            textSize = 13f
            color = if (isSelected) AndroidColor.WHITE else ink
        }
        val label = TextUtils.ellipsize(name.trim(), textPaint, 92f, TextUtils.TruncateAt.END).toString()
        val width = 52f + textPaint.measureText(label).coerceAtLeast(12f)
        val bitmap = Bitmap.createBitmap(kotlin.math.ceil(width * density).toInt(), kotlin.math.ceil(48f * density).toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.scale(density, density)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        val body = RectF(1f, 1f, width - 1f, 39f)
        paint.color = if (isSelected) ink else AndroidColor.WHITE
        paint.setShadowLayer(2f, 0f, 1f, AndroidColor.argb(50, 0, 0, 0))
        canvas.drawRoundRect(body, 19f, 19f, paint)
        paint.clearShadowLayer()
        paint.color = if (isSelected) ink else accent.base.copy(alpha = 0.55f).toArgb()
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 1.5f
        canvas.drawRoundRect(body, 19f, 19f, paint)
        paint.style = Paint.Style.FILL
        paint.color = ink
        canvas.drawPath(android.graphics.Path().apply {
            moveTo(width / 2 - 6, 38f)
            lineTo(width / 2, 48f)
            lineTo(width / 2 + 6, 38f)
            close()
        }, paint)

        canvas.save()
        canvas.clipPath(android.graphics.Path().apply { addCircle(20f, 20f, 15f, android.graphics.Path.Direction.CW) })
        paint.color = accent.container.toArgb()
        canvas.drawCircle(20f, 20f, 15f, paint)
        if (avatar != null) {
            val side = minOf(avatar.width, avatar.height)
            val x = (avatar.width - side) / 2
            val y = (avatar.height - side) / 2
            canvas.drawBitmap(avatar, android.graphics.Rect(x, y, x + side, y + side), RectF(5f, 5f, 35f, 35f), paint)
        } else {
            val initialPaint = TextPaint(textPaint).apply {
                color = accent.base.toArgb()
                textSize = 15f
                textAlign = Paint.Align.CENTER
            }
            canvas.drawText(name.trim().take(1).ifEmpty { "?" }, 20f, 20f - (initialPaint.ascent() + initialPaint.descent()) / 2, initialPaint)
        }
        canvas.restore()
        canvas.drawText(label, 41f, 20f - (textPaint.ascent() + textPaint.descent()) / 2, textPaint)
        return bitmap
    }

    /**
     * 일정 마커 비트맵 — 한 줄 말풍선 `[번호] 15:30 제목` + 꼬리 + 위치 점(좌표 = 점 중심, [ScheduleMarkerLayout.anchorY]).
     * 2026-11-20 바꿈: 이전엔 순번 원·제목·시간·상태 점 네 칸을 세로로 쌓아 멤버 아바타보다 두 배 가까이 높았고,
     * 일정 몇 개만 돼도 서로·아바타와 겹쳤다. iOS createScheduleMarkerImage 와 같은 모양·치수(dp = pt).
     * 번호 원·위치 점 색이 곧 상태(예정 주황 · 진행 중 초록 · 끝남 회색). 끝난 일정의 흐림은 Marker alpha 로.
     */
    fun createScheduleMarkerBitmap(context: Context, schedule: SmapSchedule, index: Int): Bitmap {
        val d = context.resources.displayMetrics.density
        val L = ScheduleMarkerLayout
        val tint = scheduleStatusTint(schedule.status)
        val navy = FamilyColors.Ink.toArgb()
        val suiteBold = ResourcesCompat.getFont(context, com.dmonster.smap.R.font.suite_bold)
            ?: Typeface.create(Typeface.DEFAULT, Typeface.BOLD)

        val rawTitle = schedule.title ?: "일정"
        // iOS 와 같게 10자 넘으면 줄인다 — 긴 제목이 지도를 가리지 않게
        val title = if (rawTitle.length > 10) rawTitle.take(10) + "…" else rawTitle
        val time = markerClock(schedule.date)

        fun textPaint(sizeDp: Float, color: Int) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            textSize = sizeDp * d
            typeface = suiteBold
        }
        val orderPaint = textPaint(11f, android.graphics.Color.WHITE).apply { textAlign = Paint.Align.CENTER }
        val timePaint = textPaint(11f, android.graphics.Color.argb(191, 255, 255, 255))  // 흰색 75%
        val titlePaint = textPaint(12f, android.graphics.Color.WHITE)

        val titleW = titlePaint.measureText(title)
        val timeW = time?.let { timePaint.measureText(it) } ?: 0f
        // [안쪽 여백 4][번호 원][6][시각][5][제목][10]
        var chipW = (L.INSET + L.ORDER_SIZE + L.GAP + L.TRAILING) * d + kotlin.math.ceil(titleW)
        if (time != null) chipW += kotlin.math.ceil(timeW) + L.TIME_GAP * d
        val border = L.BORDER * d
        val chipH = L.CHIP_HEIGHT * d
        val width = chipW + border * 2
        val height = L.TOTAL_HEIGHT * d

        val bitmap = Bitmap.createBitmap(kotlin.math.ceil(width).toInt(), kotlin.math.ceil(height).toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val cx = width / 2
        val chip = RectF(border, border, border + chipW, border + chipH)

        // 1. 꼬리 (칩 아래 가운데 → 위치 점)
        paint.color = navy
        canvas.drawPath(android.graphics.Path().apply {
            moveTo(cx - L.TAIL_WIDTH * d / 2, chip.bottom - d)
            lineTo(cx + L.TAIL_WIDTH * d / 2, chip.bottom - d)
            lineTo(cx, chip.bottom + L.TAIL_HEIGHT * d)
            close()
        }, paint)

        // 2. 칩 + 흰 테두리 — 지도 위에서 떠 보이게
        canvas.drawRoundRect(chip, chipH / 2, chipH / 2, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = border
        paint.color = android.graphics.Color.WHITE
        canvas.drawRoundRect(chip, chipH / 2, chipH / 2, paint)
        paint.style = Paint.Style.FILL

        // 3. 번호 원 — 색이 곧 상태
        val orderR = L.ORDER_SIZE * d / 2
        val orderCx = chip.left + L.INSET * d + orderR
        paint.color = tint
        canvas.drawCircle(orderCx, chip.centerY(), orderR, paint)
        fun baseline(p: TextPaint) = chip.centerY() - (p.fontMetrics.ascent + p.fontMetrics.descent) / 2
        canvas.drawText((index + 1).toString(), orderCx, baseline(orderPaint), orderPaint)

        // 4. 시각 · 제목
        var x = orderCx + orderR + L.GAP * d
        if (time != null) {
            canvas.drawText(time, x, baseline(timePaint), timePaint)
            x += kotlin.math.ceil(timeW) + L.TIME_GAP * d
        }
        canvas.drawText(title, x, baseline(titlePaint), titlePaint)

        // 5. 위치 점 — 이 점의 중심이 일정 좌표
        val dotCy = L.DOT_CENTER_Y * d
        val dotR = L.DOT_SIZE * d / 2
        paint.color = tint
        canvas.drawCircle(cx, dotCy, dotR, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 2 * d
        paint.color = android.graphics.Color.WHITE
        canvas.drawCircle(cx, dotCy, dotR, paint)

        return bitmap
    }

    /** 번호 원·위치 점 색. 진행 중 초록은 흰 숫자가 읽히는 진한 값(#15803D, 대비 5:1). iOS scheduleStatusTint 와 같음. */
    private fun scheduleStatusTint(status: ScheduleStatus): Int = when (status) {
        ScheduleStatus.ONGOING -> 0xFF15803D.toInt()
        ScheduleStatus.COMPLETED -> 0xFF6B7280.toInt()
        ScheduleStatus.UPCOMING, ScheduleStatus.DEFAULT -> SmapAccent.Orange.base.toArgb()
    }
}

/** 일정 마커(한 줄 말풍선) 치수 — dp. iOS `ScheduleMarkerLayout` 과 같은 값(pt). */
internal object ScheduleMarkerLayout {
    const val CHIP_HEIGHT = 26f
    const val BORDER = 1.5f
    const val INSET = 4f
    const val ORDER_SIZE = 18f
    const val GAP = 6f
    const val TIME_GAP = 5f
    const val TRAILING = 10f
    const val TAIL_WIDTH = 10f
    const val TAIL_HEIGHT = 6f
    const val DOT_SIZE = 9f
    const val DOT_CENTER_Y = BORDER + CHIP_HEIGHT + TAIL_HEIGHT + DOT_SIZE / 2
    const val TOTAL_HEIGHT = DOT_CENTER_Y + DOT_SIZE / 2 + 1.5f  // 점 테두리 여유
    /** 마커 기준점 = 위치 점 중심 */
    const val ANCHOR_Y = DOT_CENTER_Y / TOTAL_HEIGHT
}

/** "2026-11-20 15:30:00"·"2026-11-20T15:30:00" → "15:30". 시각을 못 찾으면 null. */
private fun markerClock(raw: String?): String? =
    raw?.let { Regex("[T ](\\d{2}):(\\d{2})").find(it) }?.let { "${it.groupValues[1]}:${it.groupValues[2]}" }

/** 지도에 찍을 수 있는 일정 장소. 좌표가 없거나 (0,0)·범위 밖이면 null. */
internal val SmapSchedule.mapLatLng: LatLng?
    get() {
        val lat = sstLocationLat ?: return null
        val lng = sstLocationLong ?: return null
        if (lat == 0.0 && lng == 0.0) return null
        if (lat !in -90.0..90.0 || lng !in -180.0..180.0) return null
        return LatLng(lat, lng)
    }
