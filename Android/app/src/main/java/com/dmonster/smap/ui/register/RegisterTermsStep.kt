package com.dmonster.smap.ui.register

import androidx.compose.foundation.clickable
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
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

@Composable
internal fun TermsContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = "서비스 이용약관에\n동의해주세요",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp,
            lineHeight = 34.sp
        )

        Spacer(modifier = Modifier.height(8.dp))

        // 개별 약관 (전체 동의는 하단 버튼 위로 이동됨)
        TermsCheckItem(
            title = "서비스 이용약관 동의 (필수)",
            isChecked = uiState.registerData.mtAgree1,
            onCheckedChange = { viewModel.setAgree1(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.ServiceTerms) }
        )

        TermsCheckItem(
            title = "개인정보 처리방침 동의 (필수)",
            isChecked = uiState.registerData.mtAgree2,
            onCheckedChange = { viewModel.setAgree2(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.PrivacyPolicy) }
        )

        TermsCheckItem(
            title = "위치정보 이용약관 동의 (필수)",
            isChecked = uiState.registerData.mtAgree3,
            onCheckedChange = { viewModel.setAgree3(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.LocationTerms) }
        )

        TermsCheckItem(
            title = "개인정보 제3자 제공 동의 (선택)",
            isChecked = uiState.registerData.mtAgree4,
            onCheckedChange = { viewModel.setAgree4(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.ThirdPartyProvision) }
        )

        TermsCheckItem(
            title = "마케팅 정보 수신 동의 (선택)",
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
    isHeader: Boolean = false,
    onDetailClick: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!isChecked) }
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (isChecked) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (isChecked) BrandColors.Primary else BrandColors.TextSecondary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = title,
            fontFamily = SuiteFont,
            fontWeight = if (isHeader) FontWeight.SemiBold else FontWeight.Normal,
            fontSize = if (isHeader) 18.sp else 16.sp,
            color = BrandColors.TextPrimary
        )

        if (onDetailClick != null) {
            Spacer(modifier = Modifier.weight(1f))
            IconButton(
                onClick = onDetailClick,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = "상세보기",
                    tint = BrandColors.TextSecondary
                )
            }
        }
    }
}
