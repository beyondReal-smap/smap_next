package com.dmonster.smap.ui.group

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Sms
import androidx.compose.material.icons.outlined.Share
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// MARK: - Invite Member Bottom Sheet

/**
 * 멤버 초대 시트 — 36단계 재설계.
 * 코드를 크게 보여 주고(눌러서 복사), 그 아래 보내는 방법을 공용 행으로 나열한다.
 * 이전에는 회색 바탕에 회색 아이콘 카드가 이어져 "무엇을 보내는지"(코드)가 보이지 않았다.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InviteMemberBottomSheet(
    group: SmapGroup,
    onDismiss: () -> Unit,
    onCopyLink: () -> Unit,
    onShowQRCode: () -> Unit,
    onShareSMS: () -> Unit,
    onDefaultShare: () -> Unit,
    onCopyCode: () -> Unit
) {
    val clipboardManager = LocalClipboardManager.current
    val haptics = rememberSmapHaptics()
    val colors = MaterialTheme.colorScheme
    val code = group.sgtCode

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(bottom = SmapSpacing.md)
        ) {
            Text(
                "멤버 초대",
                style = SmapText.headline,
                color = colors.onSurface,
                modifier = Modifier.padding(horizontal = SmapSpacing.screenHorizontal)
            )
            Text(
                "${group.sgtTitle ?: "그룹"}에 함께할 사람에게 초대 코드를 보내세요.",
                style = SmapText.caption,
                color = colors.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = SmapSpacing.screenHorizontal)
            )
            if (code != null) {
                Row(
                    modifier = Modifier
                        .padding(SmapSpacing.screenHorizontal)
                        .fillMaxWidth()
                        .background(colors.primaryContainer, RoundedCornerShape(16.dp))
                        .clickable {
                            clipboardManager.setText(AnnotatedString(code))
                            haptics.success()
                            onCopyCode()
                        }
                        .padding(horizontal = SmapSpacing.lg, vertical = SmapSpacing.md),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("초대 코드", style = SmapText.captionSmall, color = colors.primary)
                        Text(
                            code,
                            style = SmapText.title.copy(letterSpacing = 2.sp),
                            color = colors.primary
                        )
                    }
                    Icon(Icons.Outlined.ContentCopy, contentDescription = "초대 코드 복사", tint = colors.primary)
                }
            }
            SmapListRow(title = "링크 복사", subtitle = "누르면 바로 참여하는 링크예요", leading = { SmapRowIcon(Icons.Outlined.Link) }, onClick = onCopyLink)
            SmapRowDivider()
            SmapListRow(title = "QR 코드 보여 주기", subtitle = "옆 사람이 카메라로 찍으면 참여해요", leading = { SmapRowIcon(Icons.Outlined.QrCode2) }, onClick = onShowQRCode)
            SmapRowDivider()
            SmapListRow(title = "문자로 보내기", leading = { SmapRowIcon(Icons.Outlined.Sms) }, onClick = onShareSMS)
            SmapRowDivider()
            SmapListRow(title = "다른 앱으로 공유", leading = { SmapRowIcon(Icons.Outlined.Share) }, onClick = onDefaultShare)
        }
    }
}

// MARK: - QR Code Dialog

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QRCodeDialog(
    data: String,
    onDismiss: () -> Unit,
    onShare: (android.graphics.Bitmap) -> Unit
) {
    var qrBitmap by remember { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(data) {
        qrBitmap = withContext(Dispatchers.Default) {
            generateQRCodeBitmap(data, 512)
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle = null,
        contentWindowInsets = { WindowInsets(0, 0, 0, 0) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 48.dp)
                .navigationBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Spacer(modifier = Modifier.width(48.dp))
                Text(
                    text = "QR 코드",
                    fontSize = 17.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black
                )
                TextButton(onClick = onDismiss) {
                    Text(
                        text = "완료",
                        fontSize = 16.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium,
                        color = BrandColors.Primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Title
            Text(
                text = "QR 코드로 초대하기",
                fontSize = 22.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "QR 코드를 스캔하면 그룹에 참여해요",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                color = Color.Gray
            )

            Spacer(modifier = Modifier.height(24.dp))

            // QR Code Image
            val currentBitmap = qrBitmap
            if (currentBitmap != null) {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                    modifier = Modifier.size(280.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        androidx.compose.foundation.Image(
                            bitmap = currentBitmap.asImageBitmap(),
                            contentDescription = "그룹 초대 QR 코드",
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            } else {
                Box(
                    modifier = Modifier
                        .size(280.dp)
                        .background(Color.Gray.copy(alpha = 0.1f), RoundedCornerShape(20.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = BrandColors.Primary)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Instructions
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                InstructionRow(number = "1", text = "카메라 앱을 열어주세요")
                InstructionRow(number = "2", text = "QR 코드를 스캔해주세요")
                InstructionRow(number = "3", text = "링크를 누르면 그룹에 참여해요")
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Share Button
            Button(
                onClick = { qrBitmap?.let { onShare(it) } },
                enabled = qrBitmap != null,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Primary)
            ) {
                Icon(
                    imageVector = Icons.Filled.FileUpload,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "QR 코드 공유",
                    fontSize = 16.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun InstructionRow(number: String, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .background(BrandColors.Primary, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = number,
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
        Text(
            text = text,
            fontSize = 14.sp,
            fontFamily = SuiteFont,
            color = Color.Gray
        )
    }
}

// QR Code Bitmap Generation using ZXing
private fun generateQRCodeBitmap(content: String, size: Int): android.graphics.Bitmap? {
    return try {
        val hints = hashMapOf<com.google.zxing.EncodeHintType, Any>()
        hints[com.google.zxing.EncodeHintType.MARGIN] = 1
        hints[com.google.zxing.EncodeHintType.ERROR_CORRECTION] = com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.H

        val bitMatrix = com.google.zxing.qrcode.QRCodeWriter().encode(
            content,
            com.google.zxing.BarcodeFormat.QR_CODE,
            size,
            size,
            hints
        )

        val width = bitMatrix.width
        val height = bitMatrix.height
        val pixels = IntArray(width * height)

        for (y in 0 until height) {
            for (x in 0 until width) {
                pixels[y * width + x] = if (bitMatrix[x, y]) {
                    android.graphics.Color.BLACK
                } else {
                    android.graphics.Color.WHITE
                }
            }
        }

        android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888).apply {
            setPixels(pixels, 0, width, 0, 0, width, height)
        }
    } catch (e: Exception) {
        null
    }
}
