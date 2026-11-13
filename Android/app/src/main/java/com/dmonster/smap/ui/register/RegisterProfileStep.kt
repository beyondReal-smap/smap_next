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
import androidx.compose.material.icons.outlined.Cake
import androidx.compose.material.icons.outlined.DateRange
import androidx.compose.ui.semantics.Role
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SmapText
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
            text = "프로필 정보를 설정해 주세요",
            style = SmapText.title,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = "나중에 설정에서 바꿀 수 있어요. 건너뛰어도 됩니다.",
            style = SmapText.secondary,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        // 생년월일 (DatePicker)
        var showDatePicker by remember { mutableStateOf(false) }

        // 읽기 전용 입력창 위에 투명한 클릭 영역을 덮는다.
        // 기존에는 enabled=false 인 입력창에 clickable 을 붙여, 낭독기에 "사용 안 함"으로 읽히고
        // 글자색을 검정으로 고정해 다크 모드에서 보이지 않았다.
        Box {
            SmapTextField(
                value = uiState.registerData.mtBirth ?: "",
                onValueChange = {},
                label = "생년월일 (선택)",
                placeholder = "눌러서 선택",
                leadingIcon = Icons.Outlined.Cake,
                trailingContent = { Icon(Icons.Outlined.DateRange, contentDescription = null) },
                readOnly = true,
            )
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .clickable(
                        onClickLabel = "생년월일 선택",
                        role = Role.Button,
                    ) { showDatePicker = true }
            )
        }

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
            style = SmapText.captionMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
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
            containerColor = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
            contentColor = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
        ),
        border = if (!isSelected) BorderStroke(
            width = 1.dp,
            color = MaterialTheme.colorScheme.outline
        ) else null
    ) {
        // 선택 여부를 색만으로 구분하지 않도록 체크 아이콘을 함께 보인다.
        if (isSelected) {
            Icon(Icons.Default.Check, contentDescription = "선택됨", modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(text = text, style = if (isSelected) SmapText.bodyBold else SmapText.body)
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
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(80.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "가입을 환영합니다!",
            style = SmapText.title,
            color = MaterialTheme.colorScheme.onSurface,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "smap과 함께 소중한 사람들과\n위치를 공유해보세요",
            style = SmapText.body,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}
