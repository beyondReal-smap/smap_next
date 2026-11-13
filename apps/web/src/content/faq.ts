import { APP_DISTRIBUTION, PRICING, SITE } from "./site";
import type { Faq, FaqCategory } from "./types";

/**
 * FAQ 지식 베이스 (SSOT).
 *
 * 생성형 검색엔진(ChatGPT Search / Perplexity / Google AI Overviews)은 질문-답변 쌍을
 * 가장 높은 확률로 인용합니다. 그래서 사이트에 흩어져 있던 정보를 명시적인 Q&A로 재구성했습니다.
 *
 * 답변 작성 규칙 — 모든 문장은 사이트에 실제로 게시된 사실에만 근거합니다.
 *   - 근거: /features, /contact, /legal/privacy, /account-deletion 페이지 본문
 *   - 추측성 수치나 미공개 정책은 넣지 않습니다. AI가 그대로 인용하면 곧 허위정보가 되기 때문입니다.
 *   - 첫 문장만 읽어도 답이 되도록 작성합니다(스니펫 추출 대비).
 */
export const FAQS: Faq[] = [
  {
    id: "what-is-smap",
    question: "SMAP은 어떤 서비스인가요?",
    answer:
      "SMAP은 부모가 자녀의 실시간 위치와 일정을 하나의 앱에서 확인하고 관리하는 가족 위치·일정 공유 서비스입니다. 초대받은 가족만 참여하는 비공개 그룹 안에서 실시간 위치 공유, 안전구역 출입 알림, 일정 관리, 이동 경로 안내, 최근 2주 이동 기록 조회를 제공합니다. iOS와 Android 앱으로 제공되며 운영사는 비욘드리얼입니다.",
    category: "시작하기",
    keywords: ["SMAP", "스맵", "서비스 소개", "자녀 위치", "가족 앱", "정의"],
  },
  {
    id: "supported-devices",
    question: "SMAP은 어떤 기기에서 사용할 수 있나요?",
    answer:
      "iOS와 Android 모두에서 사용할 수 있습니다. App Store 또는 Google Play에서 'SMAP'을 검색해 무료로 내려받을 수 있습니다.",
    category: "시작하기",
    keywords: ["기기", "지원", "아이폰", "안드로이드", "iOS", "Android", "호환"],
  },
  {
    id: "pricing",
    question: "SMAP은 무료인가요?",
    answer: `${PRICING.summary} 앱 설치와 회원가입에는 비용이 들지 않습니다.`,
    category: "요금",
    keywords: ["가격", "요금", "무료", "유료", "구독", "프리미엄", "결제"],
  },
  {
    id: "how-to-download",
    question: "SMAP 앱은 어디서 다운로드하나요?",
    answer: `iOS는 App Store(${APP_DISTRIBUTION.ios.url}), Android는 Google Play(${APP_DISTRIBUTION.android.url})에서 받을 수 있습니다. 웹사이트 다운로드 섹션의 QR 코드를 카메라로 스캔해도 바로 설치 페이지로 이동합니다.`,
    category: "시작하기",
    keywords: [
      "다운로드",
      "설치",
      "앱스토어",
      "구글플레이",
      "QR",
      "링크",
      "받는 법",
    ],
  },
  {
    id: "how-location-sharing-works",
    question: "자녀의 실시간 위치는 어떻게 확인하나요?",
    answer:
      "가족 그룹에 자녀를 초대해 연결하면 지도에서 자녀의 현재 위치를 실시간으로 확인할 수 있습니다. 위치는 GPS와 Wi-Fi, 기기 센서를 통해 수집되며, 이동 경로도 함께 표시되어 목적지까지 안전하게 이동했는지 파악할 수 있습니다.",
    category: "기능",
    keywords: [
      "실시간 위치",
      "위치 확인",
      "위치 추적",
      "GPS",
      "지도",
      "자녀 위치",
    ],
  },
  {
    id: "who-can-see-my-location",
    question: "가족이 아닌 다른 사람도 내 위치를 볼 수 있나요?",
    answer:
      "아니요. SMAP의 그룹은 초대제로만 운영되어 초대를 수락한 구성원만 그룹에 참여할 수 있고, 위치는 그 그룹 안에서만 공유됩니다. 이용자가 스스로 그룹 공유 기능을 선택해 위치를 노출하는 경우를 제외하면, 회사는 사전 동의 없이 개인정보를 외부에 제공하지 않습니다.",
    category: "개인정보·보안",
    keywords: [
      "공개 범위",
      "누가 보나",
      "초대제",
      "비공개",
      "프라이버시",
      "제3자 제공",
    ],
  },
  {
    id: "background-location",
    question: "앱을 켜두지 않아도 위치가 수집되나요?",
    answer:
      "이용자가 위치 권한을 '항상 허용'으로 설정한 경우에 한해, 앱이 닫혀 있거나 사용 중이 아닐 때도 백그라운드에서 위치 데이터를 수집합니다. 이는 그룹 구성원 간 실시간 위치 공유와 장소 기반 알림을 제공하기 위한 핵심 기능이며, 권한 설정은 언제든지 변경할 수 있습니다.",
    category: "개인정보·보안",
    keywords: [
      "백그라운드",
      "항상 허용",
      "권한",
      "앱 종료",
      "위치 권한",
      "배터리",
    ],
  },
  {
    id: "location-history-retention",
    question: "이동 기록은 얼마나 보관되나요?",
    answer:
      "최근 2주간의 이동 기록을 자동으로 저장해 언제든지 조회할 수 있습니다. 각 장소의 방문 시간과 체류 시간이 함께 기록되고, 이동 경로는 지도 위에 시각적으로 표시됩니다.",
    category: "기능",
    keywords: ["이동 기록", "보관 기간", "2주", "히스토리", "동선", "기록 조회"],
  },
  {
    id: "safe-zone-alerts",
    question: "안전구역 알림은 어떻게 동작하나요?",
    answer:
      "집, 학교, 학원처럼 자주 방문하는 장소를 안전구역으로 지정해 두면, 자녀가 그 구역에 도착하거나 벗어날 때 자동으로 알림을 받습니다. 알림 유형은 가족 구성원별로 원하는 것만 선택해 받을 수 있습니다.",
    category: "기능",
    keywords: [
      "안전구역",
      "지오펜스",
      "도착 알림",
      "이탈 알림",
      "학교 도착",
      "알림 설정",
    ],
  },
  {
    id: "schedule-notification-timing",
    question: "일정 알림은 언제 오나요?",
    answer:
      "학교, 학원, 특별 활동 등 등록된 일정의 시작 30분 전에 알림을 받을 수 있습니다.",
    category: "기능",
    keywords: ["일정 알림", "30분 전", "알림 시간", "리마인더"],
  },
  {
    id: "parent-manages-schedule",
    question: "부모가 자녀의 일정을 대신 등록할 수 있나요?",
    answer:
      "가능합니다. 부모는 자녀의 일정을 원격으로 추가·수정·삭제할 수 있고, 가족 구성원 전체의 일정을 통합 캘린더 한 화면에서 확인할 수 있습니다. 학교 행사 같은 중요한 일정은 모든 구성원에게 동기화됩니다.",
    category: "기능",
    keywords: [
      "원격 일정",
      "일정 등록",
      "부모 관리",
      "캘린더",
      "일정 수정",
      "공유 일정",
    ],
  },
  {
    id: "navigation-provider",
    question: "길 안내는 어떤 내비게이션을 사용하나요?",
    answer:
      "T-Map과 연동해 현재 위치에서 다음 일정 장소까지의 최적 경로를 안내합니다. 실시간 교통 상황이 반영되며, 일정에서 한 번의 클릭으로 바로 경로 안내를 시작할 수 있습니다.",
    category: "기능",
    keywords: ["티맵", "T맵", "내비게이션", "길찾기", "경로", "교통"],
  },
  {
    id: "daily-summary-content",
    question: "하루 요약에서는 어떤 정보를 볼 수 있나요?",
    answer:
      "하루 동안의 전체 일정 수와 완료된 일정 수, 총 이동 거리와 이동 시간을 한눈에 보여줍니다. 일별 데이터를 모아 주간·월간 활동 트렌드도 확인할 수 있습니다.",
    category: "기능",
    keywords: ["일일 요약", "통계", "이동 거리", "활동량", "리포트", "트렌드"],
  },
  {
    id: "group-settings",
    question: "그룹 기간이나 구성원 권한을 조정할 수 있나요?",
    answer:
      "그룹 전체의 유효 기간과 각 구성원의 개별 가입 기간을 따로 설정할 수 있고, 구성원별 권한도 지정할 수 있습니다. 여러 그룹을 동시에 만들어 관리하는 것도 가능합니다.",
    category: "기능",
    keywords: ["그룹 설정", "권한", "유효 기간", "다중 그룹", "멤버 관리"],
  },
  {
    id: "decline-location-consent",
    question: "위치 정보 수집 동의를 거부하면 어떻게 되나요?",
    answer:
      "이용자는 언제든지 위치 정보 수집 동의를 거부하거나 철회할 수 있습니다. 다만 이 경우 실시간 위치 공유를 비롯한 일부 서비스 이용이 제한됩니다.",
    category: "개인정보·보안",
    keywords: ["동의 철회", "거부", "권한 해제", "위치 끄기", "제한"],
  },
  {
    id: "data-collected",
    question: "SMAP은 어떤 개인정보를 수집하나요?",
    answer:
      "필수 항목으로 위치 정보(실시간 GPS 위치, 이동 경로, 기기 위치), 회원 정보(이메일, 비밀번호, 닉네임, 프로필 사진), 기기 정보(단말기 식별번호, OS 버전, 방문 기록)를 수집합니다. 각각 그룹 내 위치 공유, 가입 및 본인 확인, 서비스 최적화와 부정 이용 방지 목적으로 이용합니다. 자세한 내용은 개인정보 처리방침에서 확인할 수 있습니다.",
    category: "개인정보·보안",
    keywords: [
      "수집 항목",
      "개인정보",
      "처리방침",
      "위치정보",
      "회원정보",
      "기기정보",
    ],
  },
  {
    id: "delete-account",
    question: "계정을 삭제하려면 어떻게 하나요?",
    answer:
      "앱에 로그인할 수 있다면 [설정] → [계정 관리] → [회원탈퇴] 순서로 즉시 탈퇴할 수 있습니다. 로그인이 불가능한 경우 admin@smap.site로 가입한 이메일 또는 전화번호를 기재해 삭제를 요청하면 됩니다.",
    category: "계정",
    keywords: [
      "탈퇴",
      "계정 삭제",
      "회원탈퇴",
      "데이터 삭제",
      "해지",
      "가입 취소",
    ],
  },
  {
    id: "data-after-deletion",
    question: "탈퇴하면 데이터는 바로 삭제되나요?",
    answer:
      "탈퇴가 완료되면 사용자 프로필, 위치 추적 기록과 장소 데이터, 활동 로그, 소셜 로그인 연동 정보가 파기됩니다. 다만 법령과 약관에 따라 중복 가입·부정 이용 확인 정보는 탈퇴 후 30일, 전자상거래 소비자 보호 법령상 기록은 5년, 통신비밀보호법상 서비스 로그는 3개월간 보관됩니다.",
    category: "계정",
    keywords: [
      "데이터 삭제",
      "보관 기간",
      "파기",
      "탈퇴 후",
      "30일",
      "5년",
      "3개월",
    ],
  },
  {
    id: "contact-support",
    question: "문의는 어디로 하면 되나요?",
    answer: `${SITE.email}으로 이메일을 보내거나 웹사이트의 문의하기 페이지에서 문의 양식을 작성하면 됩니다.`,
    category: "시작하기",
    keywords: ["문의", "고객센터", "연락처", "이메일", "지원", "상담"],
  },
];

/** 카테고리별 그룹핑. FAQ 페이지 섹션 렌더링과 MCP 응답 구조화에 함께 사용합니다. */
export function groupFaqsByCategory(): Array<{
  category: FaqCategory;
  items: Faq[];
}> {
  const order: FaqCategory[] = [
    "시작하기",
    "기능",
    "요금",
    "개인정보·보안",
    "계정",
  ];
  return order
    .map((category) => ({
      category,
      items: FAQS.filter((faq) => faq.category === category),
    }))
    .filter((group) => group.items.length > 0);
}
