package com.dmonster.smap.ui.register

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.material.icons.outlined.DateRange
import com.dmonster.smap.ui.theme.SmapText
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.Instant
import com.dmonster.smap.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ProfileContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        StepHeader("프로필을 채워볼까요?", "생년월일과 성별은 선택 사항이에요. 비워 두고 가입할 수 있어요.")

        var showDatePicker by rememberSaveable { mutableStateOf(false) }
        OutlinedButton(
            onClick = { showDatePicker = true }, shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
        ) {
            Text("생년월일 (선택)", style = SmapText.bodyBold, color = MaterialTheme.colorScheme.onSurface)
            Spacer(Modifier.weight(1f))
            Text(uiState.registerData.mtBirth ?: "날짜 선택", style = SmapText.secondary)
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Outlined.DateRange, contentDescription = null, modifier = Modifier.size(18.dp))
        }
        if (showDatePicker) {
            val initialDate = uiState.registerData.mtBirth?.let(LocalDate::parse) ?: LocalDate.now()
            val picker = rememberDatePickerState(initialSelectedDateMillis = initialDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
            DatePickerDialog(
                onDismissRequest = { showDatePicker = false },
                confirmButton = {
                    TextButton(enabled = picker.selectedDateMillis != null, onClick = {
                        picker.selectedDateMillis?.let { millis ->
                            viewModel.setBirthDate(Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString())
                        }
                        showDatePicker = false
                    }) { Text("확인") }
                },
                dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("취소") } },
            ) { DatePicker(state = picker) }
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
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        RegisterPhotoHeader(R.drawable.login_arrival_cycling, "가입을 마쳤어요", 300.dp)
        Text("이제 가족과 위치와 일정을 공유할 수 있어요.", style = SmapText.body, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
