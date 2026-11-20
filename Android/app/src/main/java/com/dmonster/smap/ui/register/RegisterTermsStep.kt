package com.dmonster.smap.ui.register

import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.LegalContent
import com.dmonster.smap.R
import com.dmonster.smap.ui.theme.SuiteFont

@Composable
internal fun TermsContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column {
        RegisterPhotoHeader(R.drawable.login_arrival_doorway, "이용 약관을\n확인해 주세요", 176.dp)
        Spacer(Modifier.height(16.dp))
        Box(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(14.dp))) {
            TermsCheckItem(
                title = "전체 동의하기", isChecked = viewModel.isAllTermsAgreed, onCheckedChange = viewModel::setAllTerms,
            )
        }
        Spacer(Modifier.height(16.dp))
        TermsCheckItem(
            required = true, title = "서비스 이용약관",
            isChecked = uiState.registerData.mtAgree1,
            onCheckedChange = { viewModel.setAgree1(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.ServiceTerms) }
        )

        TermsCheckItem(
            required = true, title = "개인정보 처리방침",
            isChecked = uiState.registerData.mtAgree2,
            onCheckedChange = { viewModel.setAgree2(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.PrivacyPolicy) }
        )

        TermsCheckItem(
            required = true, title = "위치기반서비스 이용약관",
            isChecked = uiState.registerData.mtAgree3,
            onCheckedChange = { viewModel.setAgree3(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.LocationTerms) }
        )

        HorizontalDivider(Modifier.padding(vertical = 4.dp), color = MaterialTheme.colorScheme.outlineVariant)
        TermsCheckItem(
            required = false, title = "개인정보 제3자 제공 동의",
            isChecked = uiState.registerData.mtAgree4,
            onCheckedChange = { viewModel.setAgree4(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.ThirdPartyProvision) }
        )

        TermsCheckItem(
            required = false, title = "마케팅 정보 수신 동의",
            isChecked = uiState.registerData.mtAgree5,
            onCheckedChange = { viewModel.setAgree5(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.MarketingConsent) }
        )
    }
}

@Composable
internal fun TermsCheckItem(
    title: String,
    isChecked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    required: Boolean? = null,
    onDetailClick: (() -> Unit)? = null
) {
    val colors = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Row(
            modifier = Modifier.weight(1f)
                .toggleable(value = isChecked, role = Role.Checkbox, onValueChange = onCheckedChange)
                .heightIn(min = if (required == null) 54.dp else 48.dp)
                .padding(horizontal = if (required == null) 16.dp else 0.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                imageVector = if (isChecked) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                contentDescription = null,
                tint = if (required == null) colors.onPrimaryContainer else if (isChecked) colors.primary else colors.onSurfaceVariant,
                modifier = Modifier.size(if (required == null) 22.dp else 19.dp),
            )
            if (required != null) {
                Text(if (required) "필수" else "선택", fontFamily = SuiteFont, fontSize = 12.sp,
                    fontWeight = FontWeight.Bold, color = colors.onSurfaceVariant)
            }
            Text(title, fontFamily = SuiteFont, fontSize = if (required == null) 17.sp else 15.sp,
                fontWeight = if (required == null) FontWeight.Bold else FontWeight.Medium,
                color = if (required == null) colors.onPrimaryContainer else colors.onSurface)
        }
        if (onDetailClick != null) {
            IconButton(onClick = onDetailClick) {
                Icon(Icons.Default.ChevronRight, contentDescription = "$title 보기", tint = colors.onSurfaceVariant,
                    modifier = Modifier.size(20.dp))
            }
        }
    }
}
