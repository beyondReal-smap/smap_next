package com.dmonster.smap.ui.settings

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.ui.theme.SuiteFont

/**
 * 약관 화면 공통 베이스 레이아웃
 */
@Composable
fun TermsBaseScreen(
    title: String,
    date: String = "2024-05-30",
    onBack: () -> Unit,
    content: @Composable ColumnScope.() -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F7F7))
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 20.dp)
            ) {
                Surface(
                    onClick = onBack,
                    shape = RoundedCornerShape(24.dp),
                    color = Color.White,
                    shadowElevation = 2.dp,
                    modifier = Modifier.height(44.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "뒤로",
                            tint = Color.Black,
                            modifier = Modifier.size(24.dp)
                        )
                        Text(
                            text = "뒤로",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color.Black
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
            ) {
                // Header Text
                VStack(spacing = 8.dp) {
                    Text(
                        text = title,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        color = Color.Black
                    )
                    Text(
                        text = "시행일: $date",
                        fontFamily = SuiteFont,
                        fontSize = 14.sp,
                        color = Color.Gray
                    )
                }
                
                Spacer(modifier = Modifier.height(32.dp))
                
                content()
                
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }
}

@Composable
fun TermSection(title: String, content: String) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = title,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = Color(0xFF0113A3) // Brand Indigo
            )
            Text(
                text = content,
                fontFamily = SuiteFont,
                fontSize = 15.sp,
                lineHeight = 22.sp,
                color = Color.Black
            )
        }
    }
}

@Composable
fun ServiceTermsScreen(onBack: () -> Unit) {
    TermsBaseScreen(title = "서비스 이용약관", onBack = onBack) {
        TermSection(
            title = "제1조(목적)",
            content = "이 약관은 비욘드리얼(이하 \"회사\")가 제공하는 제반 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다."
        )
        TermSection(
            title = "제2조(정의)",
            content = """1. "서비스"라 함은 구현되는 단말기(PC, TV, 휴대형단말기 등의 각종 유무선 장치를 포함)와 상관없이 이용자가 이용할 수 있는 회사의 제반 서비스를 의미합니다.
   ① smap 서비스
   ② 기타 회사가 정하는 서비스
2. "smap 서비스"라 함은 실시간 위치조회, 위치와 일정 기반 알림 등 회사가 이용자에게 제공하는 서비스를 말합니다.
3. "이용자"란 회사가 제공하는 서비스를 받는 개인회원과 비회원을 말합니다.
4. "개인회원"은 회사에 개인정보를 제공하여 회원등록을 한 사람으로, 회사로부터 지속적으로 정보를 제공받고 서비스를 계속적으로 이용할 수 있는 자를 말합니다.
5. "비회원"은 회원가입 없이 회사가 제공하는 서비스를 이용하는 자를 말합니다.
6. "아이디(ID)"란 회원의 식별과 서비스 이용을 위하여 회원이 정하고 회사가 승인하는 문자 또는 문자와 숫자의 조합을 의미합니다.
7. "비밀번호"란 회원이 부여받은 아이디와 일치되는 회원임을 확인하고 비밀의 보호를 위해 회원이 정한 문자(특수문자 포함)와 숫자의 조합을 의미합니다.
8. "유료서비스"란 회사가 유료로 제공하는 제반 서비스를 의미합니다.
9. "결제"란 회사가 제공하는 유료서비스를 이용하기 위하여 회원이 지불수단을 선택하고 금융정보를 입력하는 행위를 말합니다.
10. "할인쿠폰"은 이용자가 회사의 서비스를 이용하면서 그 대가를 지급하는 데 사용하기 위하여 회사가 발행 및 관리하는 지급수단을 말합니다.
11. "콘텐츠"란 정보통신망법에 따라 정보통신망에서 사용되는 부호·문자·음성·음향·이미지 또는 영상 등으로 정보 형태의 글, 사진, 동영상 및 각종 파일과 링크 등을 말합니다."""
        )
        TermSection(
            title = "제3조(약관 외 준칙)",
            content = "이 약관에서 정하지 아니한 사항은 법령 또는 회사가 정한 서비스의 개별약관, 운영정책 및 규칙 등(이하 \"세부지침\")의 규정에 따르며, 본 약관과 세부지침이 충돌할 경우 세부지침이 우선합니다."
        )
        TermSection(
            title = "제4조(약관의 효력과 변경)",
            content = """1. 이 약관은 회사가 제공하는 모든 인터넷서비스에 게시하여 공시합니다. 회사는 전자상거래법, 약관규제법, 정보통신망법 등 관련 법령에 위배되지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 최소 7일(불리하거나 중대한 사항은 30일) 이전부터 공지합니다. 기존 이용자에게는 전자적 수단(전자우편, 문자메시지, 서비스 내 알림 등)으로 개별 통지할 수 있습니다. 변경 된 약관은 시행일부터 효력이 발생합니다.
2. 회사는 개정약관 공지 또는 통지 시, '변경에 동의하지 아니한 경우 공지일 또는 통지를 받은 날로부터 7일(불리하거나 중대한 사항은 30일) 내 해지 가능하며, 해지 의사표시가 없으면 동의한 것으로 간주'됨을 함께 통지합니다.
3. 이용자가 전항의 기간 내 거절 의사를 표시하지 않을 때에는 개정 약관에 동의한 것으로 봅니다."""
        )
        TermSection(
            title = "제5조(이용자에 대한 통지)",
            content = """1. 회사는 이 약관에 별도 규정이 없는 한 전자우편, 문자(SMS), 전자쪽지, 푸시 알림 등의 전자적 수단으로 통지할 수 있습니다.
2. 이용자 전체에 대한 통지는 7일 이상 서비스 내 공지 게시로 갈음할 수 있습니다. 다만, 회원 개별 거래에 중대한 영향을 미치는 사항은 개별 통지합니다.
3. 연락처 미기재, 변경 후 미수정, 오기재 등으로 개별 통지가 어려운 경우 공지로 개별 통지를 갈음한 것으로 간주합니다."""
        )
        TermSection(
            title = "제6조(이용계약의 체결)",
            content = """1. 회원가입 시, 이용자가 약관에 동의하고 가입 신청을 하며 회사가 이를 승낙한 때
2. 비회원 유료 이용의 경우, 결제가 완료된 때
3. 무료 서비스인 경우, 관련 부가 기능 이용에 필요한 절차 진행 시"""
        )
        TermSection(
            title = "제7조(회원가입에 대한 승낙)",
            content = """1. 회사는 이용계약 요청이 있으면 원칙적으로 승낙합니다.
2. 필요 시 실명확인 및 본인인증을 요청할 수 있습니다.
3. 설비 부족, 기술·업무상 문제 등으로 승낙을 유보할 수 있습니다.
4. 승낙 거절·유보 시 원칙적으로 신청자에게 알립니다(불가피한 경우 예외).
5. 계약 성립 시점은 가입완료(또는 결제완료) 표시 시점입니다.
6. 회사 정책에 따라 등급별로 이용시간·횟수·메뉴 등에 차등을 둘 수 있습니다.
7. 관련 법령에 따른 연령·등급 제한을 둘 수 있습니다."""
        )
        TermSection(
            title = "기타 조항",
            content = "제8조부터 제24조까지의 상세 내용은 서비스 내 운영정책을 따르며, 회사는 개인정보보호, 서비스 이용 제한, 손해배상 및 면책사항 등에 대해 관련 법령을 준수합니다. 상세 문의는 고객센터를 통해 확인 가능합니다."
        )
        TermSection(
            title = "부칙",
            content = "본 약관은 2024-05-30부터 시행합니다."
        )
    }
}

@Composable
fun PrivacyPolicyScreen(onBack: () -> Unit) {
    TermsBaseScreen(title = "개인정보 처리방침", onBack = onBack) {
        Text(
            text = "비욘드리얼 (\"회사\"라 함)는 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법, 통신비밀보호법, 전기통신사업법, 등 정보통신서비스제공자가 준수하여야 할 관련 법령상의 개인정보보호 규정을 준수하며, 관련 법령에 의거한 개인정보처리방침을 정하여 이용자 권익 보호에 최선을 다하고 있습니다.",
            fontFamily = SuiteFont,
            fontSize = 15.sp,
            lineHeight = 22.sp
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "본 개인정보처리방침은 회사가 제공하는 \"홈페이지(www.smap.co.kr)\" 및 \"어플리케이션 (smap)\" (이하에서는 홈페이지 및 어플리케이션을 이하 '서비스'라 합니다.) 이용에 적용되며 다음과 같은 내용을 담고 있습니다.",
            fontFamily = SuiteFont,
            fontSize = 15.sp,
            lineHeight = 22.sp
        )
        Spacer(modifier = Modifier.height(20.dp))
        TermSection(
            title = "개인정보 수집 항목 및 이용목적",
            content = "\"회사\"는 회원가입, 원활한 고객상담, 각종 서비스의 제공을 위해 아래와 같은 최소한의 개인정보를 필수항목으로 수집하고 있습니다."
        )
        TermSection(
            title = "개인정보의 제3자에 대한 제공",
            content = "회사는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다."
        )
        TermSection(
            title = "개인정보의 처리 및 보유기간",
            content = "회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다."
        )
        TermSection(
            title = "개인정보의 파기",
            content = "회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다."
        )
        TermSection(
            title = "정보주체의 권리·의무 및 행사방법",
            content = "이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다."
        )
        TermSection(
            title = "개인정보 보호책임자",
            content = """회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.

담당: 정진
전화: 070-8065-2207
이메일: admin@smap.site"""
        )
    }
}

@Composable
fun LocationTermsScreen(onBack: () -> Unit) {
    TermsBaseScreen(title = "위치기반서비스 이용약관", onBack = onBack) {
        TermSection(
            title = "제1조(목적)",
            content = "본 약관은 회원(비욘드리얼 서비스 약관에 동의한 자, 이하 \"회원\")이 비욘드리얼(이하 \"회사\")이 제공하는 웹/모바일 애플리케이션(\"smap\")의 위치기반서비스를 이용함에 있어 회원과 회사의 권리와 의무, 기타 제반 사항을 정함을 목적으로 합니다."
        )
        TermSection(
            title = "제2조(가입자격)",
            content = "서비스에 가입할 수 있는 회원은 위치기반서비스를 이용할 수 있는 이동전화 단말기의 소유자 본인이어야 합니다."
        )
        TermSection(
            title = "제3조(서비스 가입)",
            content = """회사는 다음 각 호에 해당하는 가입신청을 승낙하지 않을 수 있습니다.
1. 실명이 아니거나 타인의 명의를 사용하는 등 허위로 신청하는 경우
2. 고객 등록 사항을 누락하거나 오기하여 신청하는 경우
3. 공공질서 또는 미풍양속을 저해하거나 저해할 목적을 가지고 신청하는 경우
4. 기타 회사가 정한 이용신청 요건이 충족되지 않았을 경우"""
        )
        TermSection(
            title = "제4조(서비스 해지)",
            content = "회원은 회사가 정한 절차를 통해 서비스 해지를 신청할 수 있습니다."
        )
        TermSection(
            title = "제5조(이용약관의 효력 및 변경)",
            content = """1. 본 약관은 서비스를 신청한 고객 또는 개인위치정보주체가 회사가 정한 절차에 따라 회원으로 등록함으로써 효력이 발생합니다.
2. 서비스 신청자가 온라인에서 본 약관을 모두 읽고 "동의하기"를 클릭한 경우 본 약관의 내용에 동의한 것으로 봅니다.
3. 본 약관에 동의하지 않는 경우, 회사가 개인위치정보를 기반으로 제공하는 혜택 및 편의 제공에 일부 제한이 발생할 수 있습니다.
4. 회사는 관계 법령의 범위 내에서 본 약관을 개정할 수 있으며, 개정 시 적용일자, 개정사유를 명시하여 적용일자 10일 전부터 서비스 내 공지합니다. 회원에게 불리하거나 권리를 제한하는 개정의 경우 30일 전부터 공지하고 전자적 수단으로 고지합니다."""
        )
        TermSection(
            title = "제6조(약관 외 준칙)",
            content = "본 약관에 명시되지 않은 사항은 관계 법령 및 건전한 거래관행에 따릅니다."
        )
        TermSection(
            title = "제7조(서비스의 내용)",
            content = """회사가 제공하는 위치기반서비스는 아래와 같습니다.
1. 위치기반 콘텐츠 분류(지오태깅)
2. 회사 및 제휴사의 상품/서비스 정보 제공
3. 마케팅 서비스 및 프로모션 혜택 알림 제공
4. 길 안내 등 생활편의 서비스 제공"""
        )
        TermSection(
            title = "제8조(서비스 이용요금)",
            content = """1. 서비스는 무료 제공을 원칙으로 합니다. 단, 유료서비스는 해당 화면에 명시된 요금을 지불하여 이용할 수 있습니다.
2. 무선 데이터 통신료는 이동통신사 정책에 따르며 회원이 부담합니다.
3. MMS 등으로 게시물을 등록할 경우 발생하는 요금은 이동통신사 정책에 따릅니다."""
        )
        TermSection(
            title = "부칙",
            content = "본 약관은 2024-05-30부터 시행합니다."
        )
    }
}

@Composable
fun MarketingConsentScreen(onBack: () -> Unit) {
    TermsBaseScreen(title = "마케팅 정보 수집 및 이용 동의", onBack = onBack) {
        Text(
            text = "비욘드리얼(이하 \"회사\")는 고객에게 더 나은 서비스와 혜택을 제공하기 위해 마케팅 정보 수집 및 이용에 대한 동의를 요청합니다.",
            fontFamily = SuiteFont,
            fontSize = 15.sp,
            lineHeight = 22.sp
        )
        Spacer(modifier = Modifier.height(20.dp))
        TermSection(
            title = "수집하는 마케팅 정보",
            content = """회사는 다음과 같은 마케팅 정보를 수집할 수 있습니다:
• 이름, 연락처(전화번호, 이메일)
• 서비스 이용 내역 및 선호도
• 마케팅 캠페인 참여 이력
• 고객 만족도 조사 결과"""
        )
        TermSection(
            title = "마케팅 정보 이용 목적",
            content = """수집된 마케팅 정보는 다음 목적으로만 이용됩니다:
• 신규 서비스 및 이벤트 안내
• 맞춤형 혜택 및 프로모션 제공
• 고객 만족도 향상을 위한 서비스 개선
• 마케팅 성과 분석 및 통계"""
        )
        TermSection(
            title = "동의 철회 및 거부",
            content = "고객은 언제든지 마케팅 정보 수집 및 이용에 대한 동의를 철회하거나 거부할 수 있습니다."
        )
    }
}

@Composable
fun ThirdPartyProvisionScreen(onBack: () -> Unit) {
    TermsBaseScreen(title = "개인정보 제3자 제공 동의", onBack = onBack) {
        Text(
            text = "비욘드리얼(이하 \"회사\")는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다.",
            fontFamily = SuiteFont,
            fontSize = 15.sp,
            lineHeight = 22.sp
        )
        Spacer(modifier = Modifier.height(20.dp))
        TermSection(
            title = "제3자 제공이 필요한 경우",
            content = """다음의 경우에만 개인정보를 제3자에게 제공할 수 있습니다:
• 이용자가 개인정보의 수집 및 이용에 대한 동의와 별도로 제3자 제공에 사전 동의한 경우
• 법률규정이 있거나 법령상 의무준수를 위해 불가피한 경우
• 수사기관이 수사목적을 위해 관계법령이 정한 절차를 거쳐 요구하는 경우
• 통계작성 및 학술연구 등의 목적을 위해 필요한 경우"""
        )
        TermSection(
            title = "제3자 제공 시 고지사항",
            content = """개인정보를 제3자에게 제공하는 경우 다음 사항을 미리 고지합니다:
• 개인정보를 제공받는 자의 성명과 연락처
• 제공받는 자의 개인정보 이용 목적
• 제공하는 개인정보의 항목
• 제공받는 자의 개인정보 보유 및 이용 기간
• 동의 거부권이 존재한다는 사실 및 동의 거부에 따른 불이익의 내용"""
        )
        TermSection(
            title = "동의 철회 및 거부",
            content = "이용자는 언제든지 제3자 제공에 대한 동의를 철회하거나 거부할 수 있습니다."
        )
    }
}

@Composable
private fun VStack(spacing: androidx.compose.ui.unit.Dp, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(spacing)) {
        content()
    }
}
