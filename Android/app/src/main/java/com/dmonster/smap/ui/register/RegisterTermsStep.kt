package com.dmonster.smap.ui.register

import androidx.compose.foundation.clickable
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
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SuiteFont

@Composable
internal fun TermsContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column {
        Text(
            // 제목·항목 이름은 iOS RegisterTermsView 와 같은 문구("(필수)/(선택)"을 앞에 둬 필수 항목이 먼저 보이게)
            text = "서비스 이용을 위해\n약관에 동의해주세요",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 24.sp,
            lineHeight = 32.sp
        )

        Spacer(modifier = Modifier.height(SmapSpacing.md))

        // 개별 약관 (전체 동의는 하단 버튼 위로 이동됨)
        TermsCheckItem(
            title = "(필수) 서비스 이용약관",
            isChecked = uiState.registerData.mtAgree1,
            onCheckedChange = { viewModel.setAgree1(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.ServiceTerms) }
        )

        TermsCheckItem(
            title = "(필수) 개인정보 처리방침",
            isChecked = uiState.registerData.mtAgree2,
            onCheckedChange = { viewModel.setAgree2(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.PrivacyPolicy) }
        )

        TermsCheckItem(
            title = "(필수) 위치기반서비스 이용약관",
            isChecked = uiState.registerData.mtAgree3,
            onCheckedChange = { viewModel.setAgree3(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.LocationTerms) }
        )

        TermsCheckItem(
            title = "(선택) 개인정보 제3자 제공 동의",
            isChecked = uiState.registerData.mtAgree4,
            onCheckedChange = { viewModel.setAgree4(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.ThirdPartyProvision) }
        )

        TermsCheckItem(
            title = "(선택) 마케팅 정보 수신 동의",
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
            // 약관 동의는 법적 동의 컨트롤이므로 toggleable + Role.Checkbox 로 체크 상태를
            // TalkBack 에 전달한다. (아이콘 모양/색만으로는 스크린리더가 상태를 알 수 없음)
            .toggleable(value = isChecked, role = Role.Checkbox, onValueChange = onCheckedChange)
            // 한 행 = 48dp(터치 최소). 예전엔 위아래 여백 4dp + 행 사이 4dp 가 더해져 60dp 로 벌어져 보였다.
            .heightIn(min = 48.dp),
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
            fontSize = 16.sp,
            color = BrandColors.TextPrimary
        )

        if (onDetailClick != null) {
            Spacer(modifier = Modifier.weight(1f))
            IconButton(
                onClick = onDetailClick,
                modifier = Modifier.size(48.dp) // 터치타깃 48dp 확보(아이콘 시각 크기는 24dp 유지)
            ) {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = "약관 상세보기",
                    tint = BrandColors.TextSecondary
                )
            }
        }
    }
}
