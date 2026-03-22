package com.dmonster.smap.ui.activitylog

import com.dmonster.smap.BuildConfig
import androidx.compose.foundation.background
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dmonster.smap.data.model.LocationSummary
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.responsiveSp
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.collectIsDraggedAsState

// MARK: - ActivityLog Header

@Composable
fun ActivityLogHeader(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.9f))
            .statusBarsPadding()
            .padding(top = 8.dp, start = 16.dp, end = 16.dp, bottom = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "활동 로그",
                fontSize = 22.responsiveSp(),
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            Text(
                text = "그룹 멤버들의 활동 기록을 확인해보세요",
                fontSize = 13.sp,
                fontFamily = SuiteFont,
                color = Color.Gray
            )
        }
    }
}

// MARK: - Floating Info Card

@Composable
fun ActivityLogFloatingCard(
    member: SmapGroupMember?,
    displayDate: String,
    summary: LocationSummary?,
    isLoading: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .height(80.dp)
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Member Info (Compact)
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Avatar
                Box(modifier = Modifier.size(36.dp)) {
                    val imageUrl = remember(member?.mtFile1) {
                        if (!member?.mtFile1.isNullOrBlank()) {
                            when {
                                member!!.mtFile1!!.startsWith("http") -> member.mtFile1
                                member.mtFile1!!.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}${member.mtFile1}"
                                else -> "${BuildConfig.IMAGE_BASE_URL}/images/${member.mtFile1}"
                            }
                        } else null
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(Color.Gray.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (imageUrl != null) {
                            AsyncImage(
                                model = imageUrl,
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = Color.Gray,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    // Online indicator
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .align(Alignment.BottomEnd)
                            .offset(x = 2.dp, y = 2.dp)
                            .background(Color.Green, CircleShape)
                            .border(1.5.dp, Color.White, CircleShape)
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                Column(verticalArrangement = Arrangement.spacedBy((-3).dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = member?.displayName ?: "선택 없음",
                            fontSize = 13.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            color = Color.Black
                        )
                        Text(
                            text = "의 기록",
                            fontSize = 10.sp, // Slightly smaller
                            fontFamily = SuiteFont,
                            color = Color.Gray,
                            modifier = Modifier.padding(start = 2.dp)
                        )
                    }
                    Text(
                        text = displayDate,
                        fontSize = 11.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium,
                        color = BrandColors.Primary
                    )
                }
            }

            // Divider (Closer to left)
            Box(
                modifier = Modifier
                    .padding(horizontal = 8.dp) // Reduced from 10.dp
                    .width(1.dp)
                    .height(28.dp) // Slightly shorter
                    .background(Color.Gray.copy(alpha = 0.2f))
            )

            // Stats (Now has more weight/space)
            if (isLoading) {
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                }
            } else {
                Row(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    SummaryStatItem(icon = Icons.AutoMirrored.Filled.ArrowForward, color = Color(0xFFEF4444), value = summary?.distanceFormatted ?: "0 m", modifier = Modifier.weight(1f))
                    SummaryStatItem(icon = Icons.Default.AccessTime, color = Color(0xFFF59E0B), value = summary?.timeFormatted ?: "0분", modifier = Modifier.weight(1f))
                    SummaryStatItem(icon = Icons.Default.DirectionsWalk, color = Color(0xFF3B82F6), value = summary?.stepsFormatted ?: "0", modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
fun SummaryStatItem(
    icon: ImageVector,
    color: Color,
    value: String,
    modifier: Modifier = Modifier
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = modifier.padding(top = 1.dp)
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .background(color.copy(alpha = 0.8f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(12.dp)
            )
        }

        Text(
            text = value,
            fontSize = 11.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.SemiBold,
            color = Color.Gray,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// MARK: - Path Slider

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PathSlider(
    sliderValue: Double,
    isDragging: Boolean,
    onValueChange: (Double) -> Unit,
    onDraggingChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    // Use interactionSource to track actual dragging state
    val interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }

    // Track drag state from interaction source
    val isDragActive by interactionSource.collectIsDraggedAsState()

    // Update dragging state based on actual interaction
    LaunchedEffect(isDragActive) {
        android.util.Log.d("PathSlider", "isDragActive changed: $isDragActive")
        onDraggingChange(isDragActive)
    }

    Surface(
        modifier = modifier
            .width(220.dp), // Slightly wider for better touch
        shape = RoundedCornerShape(16.dp),
        color = Color.White.copy(alpha = 0.95f),
        shadowElevation = 8.dp
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .background(BrandColors.Primary, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
                Text(
                    text = "경로 따라가기",
                    fontSize = 14.responsiveSp(),
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
            }

            // Slider with larger touch area
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Slider(
                    value = sliderValue.toFloat(),
                    onValueChange = { newValue ->
                        android.util.Log.d("PathSlider", "onValueChange: $newValue")
                        onValueChange(newValue.toDouble())
                    },
                    onValueChangeFinished = {
                        android.util.Log.d("PathSlider", "onValueChangeFinished")
                    },
                    valueRange = 0f..100f,
                    interactionSource = interactionSource,
                    colors = SliderDefaults.colors(
                        thumbColor = BrandColors.Primary,
                        activeTrackColor = BrandColors.Primary,
                        inactiveTrackColor = Color.LightGray.copy(alpha = 0.3f)
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(40.dp), // Taller touch area
                    thumb = {
                        // Compact thumb with good touch area
                        Box(
                            modifier = Modifier
                                .size(20.dp)
                                .background(BrandColors.Primary, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .background(Color.White, CircleShape)
                            )
                        }
                    },
                    track = { sliderState ->
                        // Custom track with taller touch area
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color.LightGray.copy(alpha = 0.3f))
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(sliderState.value / 100f)
                                    .fillMaxHeight()
                                    .background(BrandColors.Primary, RoundedCornerShape(4.dp))
                            )
                        }
                    }
                )

                // Labels
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("시작", fontSize = 10.sp, color = Color.Gray)

                    Text(
                        text = "${sliderValue.toInt()}%",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = BrandColors.Primary,
                        modifier = Modifier
                            .background(BrandColors.Primary.copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    )

                    Text("종료", fontSize = 10.sp, color = Color.Gray)
                }
            }
        }
    }
}

// MARK: - Date Selector

@Composable
fun DateSelector(
    formattedDate: String,
    isToday: Boolean,
    canGoNext: Boolean,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onToday: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Previous Button
            IconButton(onClick = onPrevious) {
                Icon(
                    imageVector = Icons.Default.ChevronLeft,
                    contentDescription = "이전 날",
                    tint = BrandColors.Primary
                )
            }

            // Date Display
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable(enabled = !isToday, onClick = onToday)
            ) {
                Text(
                    text = formattedDate,
                    fontSize = 16.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF1F2937)
                )

                if (!isToday) {
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(
                        onClick = onToday,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "오늘",
                            fontSize = 12.sp,
                            fontFamily = SuiteFont,
                            color = BrandColors.Primary
                        )
                    }
                }
            }

            // Next Button
            IconButton(
                onClick = onNext,
                enabled = canGoNext
            ) {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = "다음 날",
                    tint = if (canGoNext) BrandColors.Primary else Color.Gray.copy(alpha = 0.3f)
                )
            }
        }
    }
}

// MARK: - Group Selector

@Composable
fun ActivityGroupSelector(
    selectedGroup: SmapGroup?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF3F4F6))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = selectedGroup?.sgtTitle ?: "그룹 선택",
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            color = Color(0xFF1F2937)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Icon(
            imageVector = Icons.Default.KeyboardArrowDown,
            contentDescription = null,
            tint = Color.Gray,
            modifier = Modifier.size(18.dp)
        )
    }
}

// MARK: - Empty State

@Composable
fun ActivityEmptyState(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.DirectionsWalk,
            contentDescription = null,
            tint = Color.Gray.copy(alpha = 0.4f),
            modifier = Modifier.size(64.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "이동 기록이 없습니다",
            fontSize = 16.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            color = Color.Gray,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "선택한 날짜에 이동 기록이 없어요",
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            color = Color.Gray.copy(alpha = 0.7f),
            textAlign = TextAlign.Center
        )
    }
}
