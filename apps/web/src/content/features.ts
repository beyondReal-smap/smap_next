import type { Feature } from "./types";

/**
 * SMAP 제품 기능 카탈로그 (SSOT).
 *
 * /features 페이지 렌더링, JSON-LD의 featureList, /api/ai/features, MCP의 smap_list_features가
 * 모두 이 배열 하나를 읽습니다. 기능이 추가되면 여기만 고치면 전 경로에 반영됩니다.
 * 프레젠테이션 속성(이미지·색상)은 콘텐츠가 아니므로 페이지 쪽에 남겨 두었습니다.
 */
export const FEATURES: Feature[] = [
  {
    id: "private-group",
    category: "프라이버시 보호",
    title: "가족만의 프라이빗 공간",
    summary:
      "초대제로 운영되는 비공개 그룹이라 초대받은 가족 구성원만 서로의 위치를 볼 수 있습니다.",
    details: [
      {
        title: "초대제 운영 시스템",
        description:
          "초대를 통해서만 가입할 수 있어 안전한 가족 공간을 보장합니다.",
      },
      {
        title: "실시간 위치 공유",
        description:
          "가족 구성원들은 언제 어디서나 서로의 위치를 실시간으로 확인할 수 있습니다.",
      },
      {
        title: "정보 보안",
        description:
          "가족의 개인정보와 위치 데이터는 철저한 보안 시스템으로 보호됩니다.",
      },
    ],
    href: "/features#private-group",
    keywords: [
      "비공개 그룹",
      "초대제",
      "가족 그룹",
      "프라이버시",
      "위치 공유",
      "보안",
    ],
  },
  {
    id: "route-guidance",
    category: "편리한 이동",
    title: "최적의 이동 경로 안내",
    summary:
      "현재 위치에서 다음 일정 장소까지 T-Map 기반 최적 경로를 원클릭으로 안내합니다.",
    details: [
      {
        title: "T-Map 연동 시스템",
        description:
          "국내 최고의 내비게이션 서비스인 T-Map과 연동되어 정확한 경로를 제공합니다.",
      },
      {
        title: "원클릭 길 안내",
        description:
          "일정 장소까지 한 번의 클릭으로 바로 경로 안내를 시작할 수 있습니다.",
      },
      {
        title: "실시간 교통 정보",
        description: "실시간 교통 상황을 반영한 최적의 경로를 제공합니다.",
      },
    ],
    href: "/features#route-guidance",
    keywords: [
      "경로 안내",
      "T맵",
      "티맵",
      "내비게이션",
      "길찾기",
      "교통 정보",
      "이동 경로",
    ],
  },
  {
    id: "smart-notification",
    category: "맞춤형 알림",
    title: "가족 맞춤 스마트 알림",
    summary:
      "일정 30분 전 알림과 안전구역 출입 알림을 가족 구성원별로 설정할 수 있습니다.",
    details: [
      {
        title: "일정 알림 설정",
        description:
          "학교, 학원, 특별 활동 등 중요한 일정 30분 전에 알림을 받을 수 있습니다.",
      },
      {
        title: "위치 기반 알림",
        description:
          "자녀가 지정된 안전 구역에 도착하거나 떠날 때 자동으로 알림을 받습니다.",
      },
      {
        title: "맞춤형 알림 설정",
        description:
          "가족 구성원별로 원하는 유형의 알림만 선택하여 받을 수 있습니다.",
      },
    ],
    href: "/features#smart-notification",
    keywords: [
      "알림",
      "푸시 알림",
      "안전구역",
      "지오펜싱",
      "도착 알림",
      "일정 알림",
    ],
  },
  {
    id: "location-history",
    category: "이동 기록",
    title: "가족의 발자취 기록",
    summary:
      "최근 2주간의 이동 기록을 지도 위 경로와 장소별 체류 시간으로 조회할 수 있습니다.",
    details: [
      {
        title: "2주 기록 보관",
        description:
          "최근 2주간의 이동 기록을 자동으로 저장하여 언제든지 확인할 수 있습니다.",
      },
      {
        title: "상세 방문 정보",
        description:
          "각 장소별 방문 시간, 체류 시간 등 상세한 정보를 제공합니다.",
      },
      {
        title: "경로 시각화",
        description:
          "지도 위에 이동 경로를 시각적으로 표시하여 한눈에 파악할 수 있습니다.",
      },
    ],
    href: "/features#location-history",
    keywords: [
      "이동 기록",
      "위치 기록",
      "동선",
      "히스토리",
      "체류 시간",
      "2주 보관",
    ],
  },
  {
    id: "schedule-management",
    category: "효율적 관리",
    title: "스마트 일정 관리",
    summary:
      "부모가 자녀의 일정을 원격으로 추가·수정·삭제하고 가족 전체 일정을 한 화면에서 봅니다.",
    details: [
      {
        title: "원격 일정 관리",
        description:
          "부모님이 자녀의 일정을 원격으로 추가, 수정, 삭제할 수 있습니다.",
      },
      {
        title: "통합 가족 캘린더",
        description: "가족 구성원 전체의 일정을 한 화면에서 확인할 수 있습니다.",
      },
      {
        title: "일정 동기화",
        description:
          "학교 행사나 중요 일정을 모든 가족 구성원과 동기화합니다.",
      },
    ],
    href: "/features#schedule-management",
    keywords: [
      "일정 관리",
      "캘린더",
      "학원 일정",
      "가족 일정",
      "동기화",
      "스케줄",
    ],
  },
  {
    id: "group-management",
    category: "맞춤형 설정",
    title: "유연한 그룹 관리",
    summary:
      "그룹 유효 기간과 구성원별 가입 기간·권한을 개별 설정하고 여러 그룹을 동시에 운영합니다.",
    details: [
      {
        title: "기간별 설정",
        description:
          "그룹의 전체 유효 기간과 각 구성원의 개별 가입 기간을 설정할 수 있습니다.",
      },
      {
        title: "권한 관리",
        description: "그룹 내 구성원별로 다양한 권한을 설정할 수 있습니다.",
      },
      {
        title: "다중 그룹 관리",
        description:
          "여러 그룹을 동시에 관리할 수 있어 효율적으로 운영할 수 있습니다.",
      },
    ],
    href: "/features#group-management",
    keywords: ["그룹 관리", "권한", "멤버", "다중 그룹", "가입 기간"],
  },
  {
    id: "daily-summary",
    category: "간편한 요약",
    title: "하루를 한눈에",
    summary:
      "하루 일정 수, 총 이동 거리, 이동 시간을 요약하고 주간·월간 트렌드까지 보여줍니다.",
    details: [
      {
        title: "일정 통계",
        description:
          "하루 동안의 전체 일정 수와 완료된 일정 수를 통계로 보여줍니다.",
      },
      {
        title: "이동 분석",
        description:
          "총 이동 거리와 이동 시간을 보여주어 활동량을 파악할 수 있습니다.",
      },
      {
        title: "주간/월간 트렌드",
        description:
          "일별 데이터를 기반으로 주간 및 월간 활동 트렌드를 확인할 수 있습니다.",
      },
    ],
    href: "/features#daily-summary",
    keywords: ["일일 요약", "통계", "리포트", "이동 거리", "활동량", "트렌드"],
  },
];

/** 기능 id로 단건 조회. 없으면 undefined. */
export function findFeature(id: string): Feature | undefined {
  return FEATURES.find((feature) => feature.id === id);
}
