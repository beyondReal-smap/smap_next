package com.dmonster.smap.ui.settings

import com.dmonster.smap.BuildConfig
import com.dmonster.smap.data.model.LegalContent
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapButtonStyle
import com.dmonster.smap.ui.components.SmapTopBar
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.ui.theme.SuiteFont

/**
 * 약관 화면 공통 베이스 레이아웃
 *
 * 맨 아래 "전문 보기"로 웹에 게시한 원문([webPath])을 연다(표·신고확인증 이미지는 웹에만 있다).
 * (예전 전문은 Notion 페이지에만 있었다. 2026-11-19 smap.aiagnt.kr/legal/… 로 옮겼다.)
 */
@Composable
fun TermsBaseScreen(
    title: String,
    webPath: String,
    /** null 이면 시행일 줄을 숨긴다(원문에 시행일이 없는 동의서) */
    date: String? = "2026-01-08",
    onBack: () -> Unit,
    content: @Composable ColumnScope.() -> Unit
) {
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 640.dp).fillMaxSize()) {
            SmapTopBar(title = "약관 및 정책", onBack = onBack)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                Spacer(Modifier.height(16.dp))
                Text(title, style = SmapText.pageTitle, color = MaterialTheme.colorScheme.onSurface)
                if (date != null) {
                    Spacer(Modifier.height(8.dp))
                    Text("시행일: $date", style = SmapText.caption, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(28.dp))
                content()

                Spacer(Modifier.height(24.dp))
                val uriHandler = LocalUriHandler.current
                SmapButton(
                    text = "전문 보기",
                    onClick = { uriHandler.openUri("${BuildConfig.WEB_BASE_URL}/$webPath") },
                    style = SmapButtonStyle.Secondary,
                )
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }
}

@Composable
fun TermSection(title: String, content: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, style = SmapText.headline, color = MaterialTheme.colorScheme.primary)
        Text(content, style = SmapText.body.copy(lineHeight = 24.sp), color = MaterialTheme.colorScheme.onSurface)
        HorizontalDivider(Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.outlineVariant)
    }
}

/**
 * 약관 문서 데이터(LegalContent)를 그린다. 이용약관·위치기반서비스·제3자 제공·마케팅 4종 공용.
 * 본문은 Notion 원문에서 생성한 LegalContent 에 있다(회원가입 화면 LegalScreen 과 같은 데이터).
 */
@Composable
fun LegalDocumentScreen(document: LegalContent.LegalDocument, onBack: () -> Unit) {
    TermsBaseScreen(title = document.title, webPath = document.webPath, date = document.effectiveDate, onBack = onBack) {
        document.intro?.let {
            Text(it, style = SmapText.body.copy(lineHeight = 24.sp), color = MaterialTheme.colorScheme.onSurface)
            Spacer(Modifier.height(8.dp))
        }
        document.sections.forEach { TermSection(title = it.title, content = it.content) }
    }
}

@Composable
fun ServiceTermsScreen(onBack: () -> Unit) = LegalDocumentScreen(LegalContent.ServiceTerms, onBack)

@Composable
fun PrivacyPolicyScreen(onBack: () -> Unit) {
    TermsBaseScreen(title = "개인정보 처리방침", webPath = "legal/privacy", onBack = onBack) {
        Text(
            text = "비욘드리얼(\"회사\"라 함)는 이용자의 개인정보를 소중하게 생각하며, 『개인정보 보호법』 및 『위치정보의 보호 및 이용 등에 관한 법률』 등 관련 법령을 준수하고 있습니다.",
            fontFamily = SuiteFont,
            fontSize = 15.sp,
            lineHeight = 22.sp
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "본 방침은 \"도착했어\" 서비스 이용 시 수집되는 위치 데이터를 포함한 개인정보의 처리 과정을 상세히 공개합니다.",
            fontFamily = SuiteFont,
            fontSize = 15.sp,
            lineHeight = 22.sp
        )
        Spacer(modifier = Modifier.height(20.dp))
        TermSection(
            title = "1. 개인정보 수집 항목 및 이용목적",
            content = """회사는 서비스 제공을 위해 아래와 같은 개인정보 및 기기 액세스 권한을 수집·이용합니다.

[위치 정보 (필수)]
• 수집 항목: 실시간 GPS 위치 데이터, 이동 경로, 기기 위치 정보
• 이용 목적: 그룹 내 실시간 위치 공유, 일정 장소 기반 알림, 위치 기반 서비스 제공

[회원 정보 (필수)]
• 수집 항목: 이메일 주소, 비밀번호, 닉네임, 프로필 사진
• 이용 목적: 서비스 가입 및 본인 확인, 사용자 식별

[기기 정보 (필수)]
• 수집 항목: 단말기 식별번호(ID), OS 버전, 방문 기록
• 이용 목적: 서비스 최적화 및 부정 이용 방지"""
        )
        
        // 중요 고지 카드
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF8E1)),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "[중요] 위치 정보 액세스 고지",
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color(0xFFE65100)
                )
                Text(
                    text = "\"도착했어\"는 앱이 닫혀 있거나 사용 중이 아닐 때도 실시간 위치 공유 기능을 지원하기 위해 위치 데이터를 수집합니다.",
                    fontFamily = SuiteFont,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = Color(0xFF5D4037)
                )
                Text(
                    text = "이용자가 '항상 허용'으로 설정한 경우에 한해 백그라운드에서 위치 정보를 액세스하며, 이는 그룹 멤버 간의 원활한 일정 및 위치 공유를 위한 핵심 기능입니다.",
                    fontFamily = SuiteFont,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = Color(0xFF5D4037)
                )
            }
        }
        
        TermSection(
            title = "2. 위치정보의 보호 및 이용 (추가)",
            content = """회사는 위치기반서비스를 제공하기 위해 이용자의 위치정보를 처리하며, 다음과 같은 원칙을 준수합니다.

• 수집 방법: GPS, Wi-Fi, 기기 센서 등을 통해 실시간으로 수집합니다.
• 보유 및 이용: 이용 목적이 달성되거나 이용자가 동의를 철회할 경우 즉시 파기합니다. 단, 관련 법령에 따라 기록을 보존해야 하는 경우 해당 기간(예: 위치정보 이용·제공사실 확인자료 6개월) 동안 보관합니다.
• 이용자 권리: 이용자는 언제든지 위치 정보 수집에 대한 동의를 거부하거나 철회할 수 있으며, 이 경우 서비스의 일부(실시간 공유 등) 이용이 제한될 수 있습니다."""
        )
        TermSection(
            title = "3. 개인정보의 제3자에 대한 제공",
            content = """회사는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다.

단, 그룹 공유 기능을 선택하여 이용자가 스스로 위치 정보를 그룹 멤버에게 노출하는 경우는 예외로 합니다."""
        )
        TermSection(
            title = "4. 개인정보의 파기",
            content = "개인정보는 수집 및 이용목적이 달성되면 지체 없이 파기합니다. 전자적 파일 형태는 복구가 불가능한 기술적 방법을 사용하여 삭제합니다."
        )
        TermSection(
            title = "5. 개인정보 보호책임자",
            content = """회사는 개인정보 및 위치정보와 관련한 고충 처리를 위하여 아래와 같이 책임자를 지정하고 있습니다.

성명: 정진
전화: 070-8065-2207
이메일: admin@aiagnt.kr"""
        )
    }
}

@Composable
fun LocationTermsScreen(onBack: () -> Unit) = LegalDocumentScreen(LegalContent.LocationTerms, onBack)

@Composable
fun MarketingConsentScreen(onBack: () -> Unit) = LegalDocumentScreen(LegalContent.MarketingConsent, onBack)

@Composable
fun ThirdPartyProvisionScreen(onBack: () -> Unit) = LegalDocumentScreen(LegalContent.ThirdPartyProvision, onBack)
