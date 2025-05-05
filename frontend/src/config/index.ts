/**
 * SMAP 애플리케이션 공통 설정 파일
 * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환
 */

// 앱 정보
export const APP_INFO = {
  DOMAIN: 'https://app2.smap.site',
  CDN_HTTP: 'https://app2.smap.site',
  DESIGN_HTTP: 'https://app2.smap.site/design',
  ADMIN_NAME: 'SMAP',
  OG_IMAGE: 'https://app2.smap.site/img/og-image.png',
  VERSION: '20240522_8', // CSS, JS 캐시 리셋용 버전
};

// 다국어 지원
export const getLocalizedAppInfo = (language: string = 'ko') => {
  switch (language) {
    case 'ko':
      return {
        APP_AUTHOR: "SMAP - 자녀 일정·위치 확인",
        APP_TITLE: "SMAP - 자녀 일정·위치 확인",
        DESCRIPTION: "자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서."
      };
    case 'en':
      return {
        APP_AUTHOR: "SMAP - Child Schedule and Location Tracking",
        APP_TITLE: "SMAP - Child Schedule and Location Tracking",
        DESCRIPTION: "From child location tracking to schedule sharing, everything in one place."
      };
    case 'ja':
      return {
        APP_AUTHOR: "SMAP - 子供のスケジュール・位置確認",
        APP_TITLE: "SMAP - 子供のスケジュール・位置確認",
        DESCRIPTION: "子供の位置確認からスケジュール共有まで、すべてを一か所で。"
      };
    // 더 많은 언어 지원 추가 가능
    default:
      return {
        APP_AUTHOR: "SMAP - Child Schedule and Location Tracking",
        APP_TITLE: "SMAP - Child Schedule and Location Tracking",
        DESCRIPTION: "From child location tracking to schedule sharing, everything in one place."
      };
  }
};

// API 키
export const API_KEYS = {
  // 지도 API 키
  GOOGLE_MAPS_API_KEY: 'AIzaSyBkWlND5fvW4tmxaj11y24XNs_LQfplwpw', // com.dmonster.smap
  NAVER_MAPS_CLIENT_ID: 'unxdi5mt3f',
  NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',
  
  // 소셜/메시징 API 키
  KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',
  KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',
  FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',
  
  // NCP 관련 키
  NCP_ACCESS_KEY: "ncp_iam_BPAMKR5amCXCgRSDodA7",
  NCP_SECRET_KEY: "ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl",
};

// 지도 관련 설정
export const MAP_CONFIG = {
  // Naver Maps 설정
  NAVER: {
    // 네이버 지도 API에 등록된 도메인 목록
    // 실제 환경에 맞게 업데이트 필요
    ALLOWED_DOMAINS: [
      'app2.smap.site',
      'app.smap.site',
      'smap.site',
      // 개발 환경
      'localhost',
      '127.0.0.1',
    ],
    // 네이버 지도 옵션
    DEFAULT_OPTIONS: {
      mapTypeControl: false,
      scaleControl: false,
      zoom: 14
    }
  },
  // Google Maps 설정
  GOOGLE: {
    DEFAULT_OPTIONS: {
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoom: 14
    }
  }
};

// 카카오 공유 관련 설정
export const KAKAO_SHARE = {
  TITLE: 'SMAP, 친구와 가족을 더 가까이',
  DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',
  IMG: 'https://app2.smap.site/img/kakao_link_img.png',
};

// 위치 관련 설정
export const LOCATION_CONFIG = {
  RECOM_CIRCLE: 5000, // 5km
  LOCATION_MEMBER_NUM: 10, // 위치 그룹원 추가 최대값
  ACCURACY: 50,
  SPEED: 1,
  NO_PROFILE_IMG_URL: 'https://app2.smap.site/img/no_profile.png',
  MAP_RECOM_POINT_IMG_URL: 'https://app2.smap.site/img/map_recom_point.png',
  INVITE_URL: 'https://app2.smap.site/invite?sit_code=',
};

// 게시판 설정
export const BOARD_CONFIG = {
  DEFAULT_LIMIT: 10,
  GROUP_LIMIT: 7,
  NOTICE_LIMIT: 7,
};

// 이미지 및 파일 관련 설정
export const FILE_CONFIG = {
  IMAGE_EXTENSIONS: ["jpg", "png", "gif", "jpeg", "bmp"],
  NO_IMAGE_URL: 'https://app2.smap.site/img/no_image.png',
  UPLOADS_URL: 'https://app2.smap.site/img/uploads',
  PDF_URL: 'https://app2.smap.site/img/pdf',
  EXCEL_URL: 'https://app2.smap.site/img/excel',
};

// 기본 렌더링 언어 감지
export const detectLanguage = (): string => {
  if (typeof window !== 'undefined') {
    return navigator.language.substring(0, 2);
  }
  return 'ko'; // 기본값
};

// 환경 변수 (Next.js의 환경 변수와 통합)
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.smap.site',
};

export default {
  APP_INFO,
  API_KEYS,
  KAKAO_SHARE,
  LOCATION_CONFIG,
  BOARD_CONFIG,
  FILE_CONFIG,
  getLocalizedAppInfo,
  detectLanguage,
  ENV,
  MAP_CONFIG,
}; 