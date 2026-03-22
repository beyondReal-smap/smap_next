package com.dmonster.smap.ui.register

import android.content.res.Configuration
import android.view.ContextThemeWrapper
import android.widget.DatePicker
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ProfileContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = "프로필 정보를 설정해주세요",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp
        )

        Spacer(modifier = Modifier.height(2.dp))

        var isFocusedBirth by remember { mutableStateOf(false) }

        // 생년월일 (DatePicker)
        var showDatePicker by remember { mutableStateOf(false) }

        OutlinedTextField(
            value = uiState.registerData.mtBirth ?: "",
            onValueChange = {},
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { isFocusedBirth = it.isFocused }
                .clickable { showDatePicker = true },
            label = { Text("생년월일 (선택)", fontFamily = SuiteFont) },
            placeholder = { Text("탭하여 선택", fontFamily = SuiteFont) },
            readOnly = true,
            enabled = false,
            leadingIcon = {
                Icon(
                    Icons.Default.Cake,
                    contentDescription = null,
                    tint = if (isFocusedBirth || showDatePicker) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            trailingIcon = {
                Icon(
                    Icons.Default.DateRange,
                    contentDescription = "날짜 선택",
                    tint = if (isFocusedBirth || showDatePicker) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                disabledTextColor = Color.Black,
                disabledBorderColor = BrandColors.Border,
                disabledLabelColor = BrandColors.TextSecondary,
                disabledPlaceholderColor = BrandColors.TextSecondary
            )
        )

        // Wheel Style (Spinner) DatePicker Dialog
        if (showDatePicker) {
            val calendar = Calendar.getInstance()
            // 기존 생년월일이 있으면 해당 날짜로 초기화
            uiState.registerData.mtBirth?.let { birth ->
                try {
                    val parts = birth.split("-")
                    if (parts.size == 3) {
                        calendar.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
                    }
                } catch (e: Exception) {}
            }

            var selectedYear = calendar.get(Calendar.YEAR)
            var selectedMonth = calendar.get(Calendar.MONTH)
            var selectedDay = calendar.get(Calendar.DAY_OF_MONTH)

            AlertDialog(
                onDismissRequest = { showDatePicker = false },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val formatted = String.format("%04d-%02d-%02d", selectedYear, selectedMonth + 1, selectedDay)
                            viewModel.setBirthDate(formatted)
                            showDatePicker = false
                        }
                    ) {
                        Text("확인", fontFamily = SuiteFont, color = BrandColors.Primary)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePicker = false }) {
                        Text("취소", fontFamily = SuiteFont, color = BrandColors.TextSecondary)
                    }
                },
                text = {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        AndroidView(
                            factory = { context ->
                                val locale = java.util.Locale.KOREA
                                java.util.Locale.setDefault(locale)
                                val config = Configuration(context.resources.configuration)
                                config.setLocale(locale)
                                val localizedContext = context.createConfigurationContext(config)

                                DatePicker(ContextThemeWrapper(localizedContext, android.R.style.Theme_Holo_Light_Dialog)).apply {
                                    calendarViewShown = false
                                    spinnersShown = true
                                    init(selectedYear, selectedMonth, selectedDay) { _, year, monthOfYear, dayOfMonth ->
                                        selectedYear = year
                                        selectedMonth = monthOfYear
                                        selectedDay = dayOfMonth
                                    }
                                }
                            },
                            modifier = Modifier.wrapContentSize()
                        )
                    }
                }
            )
        }

        // 성별 선택
        Text(
            text = "성별 (선택)",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            fontSize = 16.sp,
            color = BrandColors.TextSecondary
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GenderButton(
                text = "남성",
                isSelected = uiState.registerData.mtGender == 1,
                onClick = { viewModel.setGender(1) },
                modifier = Modifier.weight(1f)
            )
            GenderButton(
                text = "여성",
                isSelected = uiState.registerData.mtGender == 2,
                onClick = { viewModel.setGender(2) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun GenderButton(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isSelected) BrandColors.Primary else Color.White,
            contentColor = if (isSelected) Color.White else BrandColors.TextPrimary
        ),
        border = if (!isSelected) BorderStroke(
            width = 1.dp,
            color = BrandColors.Border
        ) else null
    ) {
        Text(
            text = text,
            fontFamily = SuiteFont,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
internal fun CompleteContent() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            tint = BrandColors.Primary,
            modifier = Modifier.size(80.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "가입을 환영합니다!",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "smap과 함께 소중한 사람들과\n위치를 공유해보세요",
            fontFamily = SuiteFont,
            color = BrandColors.TextSecondary,
            fontSize = 18.sp,
            textAlign = TextAlign.Center
        )
    }
}
