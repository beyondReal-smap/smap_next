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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

// MARK: - Invite Member Bottom Sheet

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

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFF5F5F5),
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle = null
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
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
                    text = "그룹 초대",
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

            // Section Header
            Text(
                text = "그룹 초대 방법",
                fontSize = 13.sp,
                fontFamily = SuiteFont,
                color = Color.Gray,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )

            // Invite Options Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column {
                    // Link Copy Option
                    InviteOptionItem(
                        icon = Icons.Default.ContentCopy,
                        iconTint = BrandColors.Primary,
                        title = "링크 복사",
                        subtitle = "초대 링크를 복사합니다",
                        onClick = onCopyLink
                    )

                    HorizontalDivider(color = Color.Gray.copy(alpha = 0.1f))

                    // QR Code Option
                    InviteOptionItem(
                        icon = Icons.Default.QrCode2,
                        iconTint = Color.Black,
                        title = "QR 코드 보기",
                        subtitle = "QR 코드로 쉽게 초대하세요",
                        onClick = onShowQRCode
                    )

                    HorizontalDivider(color = Color.Gray.copy(alpha = 0.1f))

                    // SMS Share Option
                    InviteOptionItem(
                        icon = Icons.Default.ChatBubbleOutline,
                        iconTint = Color.Black,
                        title = "문자로 공유",
                        subtitle = "문자 메시지로 초대 링크를 전송합니다",
                        onClick = onShareSMS
                    )

                    HorizontalDivider(color = Color.Gray.copy(alpha = 0.1f))

                    // Default Share Option
                    InviteOptionItem(
                        icon = Icons.Default.Share,
                        iconTint = Color.Black,
                        title = "기본 공유",
                        subtitle = "다양한 앱으로 공유할 수 있습니다",
                        onClick = onDefaultShare
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Invite Code Section Header
            Text(
                text = "초대 코드",
                fontSize = 13.sp,
                fontFamily = SuiteFont,
                color = Color.Gray,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )

            // Invite Code Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "복사하여 편한 방법으로 공유하세요.",
                            fontSize = 13.sp,
                            fontFamily = SuiteFont,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = group.sgtCode ?: "N/A",
                            fontSize = 24.sp,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            color = BrandColors.Primary
                        )
                    }

                    IconButton(
                        onClick = {
                            group.sgtCode?.let {
                                clipboardManager.setText(AnnotatedString(it))
                            }
                            onCopyCode()
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "복사",
                            tint = BrandColors.Primary,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InviteOptionItem(
    icon: ImageVector,
    iconTint: Color,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 16.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Medium,
                color = Color.Black
            )
            Text(
                text = subtitle,
                fontSize = 13.sp,
                fontFamily = SuiteFont,
                color = Color.Gray
            )
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
    val qrBitmap = remember(data) { generateQRCodeBitmap(data, 512) }

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
                text = "QR 코드를 스캔하여 그룹에 참여하세요",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                color = Color.Gray
            )

            Spacer(modifier = Modifier.height(24.dp))

            // QR Code Image
            if (qrBitmap != null) {
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
                            bitmap = qrBitmap.asImageBitmap(),
                            contentDescription = "QR Code",
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
                InstructionRow(number = "3", text = "링크를 탭하여 그룹에 참여하세요")
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
