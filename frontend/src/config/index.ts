/**
 * SMAP 애플리케이션 공통 설정 파일
 * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환
 */

// 앱 정보
export const APP_INFO = {
  DOMAIN: 'https://app2.aiagnt.kr',
  CDN_HTTP: 'https://app2.aiagnt.kr',
  DESIGN_HTTP: 'https://app2.aiagnt.kr/design',
  ADMIN_NAME: 'SMAP',
  OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',
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
  // Google Maps API 키 제거됨 (사용하지 않음)
  // 동적 네이버 지도 Client ID (도메인별 자동 선택)
  get NAVER_MAPS_CLIENT_ID() {
    if (typeof window !== 'undefined') {
      const currentDomain = window.location.host;
      const domainClientId = MAP_CONFIG.NAVER.CLIENT_IDS[currentDomain as keyof typeof MAP_CONFIG.NAVER.CLIENT_IDS];
      
      // Vercel 환경 감지 및 로깅
      const isVercel = currentDomain.includes('vercel.app') || currentDomain.includes('nextstep.aiagnt.kr');
      console.log(`🗺️ [NAVER MAPS] 도메인: ${currentDomain}, Vercel: ${isVercel}, Client ID: ${domainClientId || '기본값'}`);
      
      // Vercel 환경에서는 환경 변수 우선 사용
      if (isVercel && process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID) {
        console.log(`🗺️ [NAVER MAPS] Vercel 환경에서 환경 변수 사용: ${process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID.substring(0, 8)}...`);
        return process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;
      }
      
      return domainClientId || process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID || '91y2nh0yff';
    }
    return process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID || '91y2nh0yff';
  },
  NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',
  MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
  
  // 소셜/메시징 API 키
  KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',
  KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',
  KAKAO_REST_API_KEY: process.env.NEXT_PUBLIC_KAKAO_MAPS_API_KEY || '7fbf60571daf54ca5bee8373a1f31d2d', // 카카오 로컬 API용 REST API 키 추가
  FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',
  
  // 동적 Google OAuth Client ID (도메인별 자동 선택)
  get GOOGLE_CLIENT_ID() {
    if (typeof window !== 'undefined') {
      const currentDomain = window.location.host;
      const domainClientId = GOOGLE_CONFIG.OAUTH.CLIENT_IDS[currentDomain as keyof typeof GOOGLE_CONFIG.OAUTH.CLIENT_IDS];
      
      // Vercel 환경 감지 및 로깅
      const isVercel = currentDomain.includes('vercel.app') || currentDomain.includes('nextstep.aiagnt.kr');
      console.log(`🔐 [GOOGLE OAUTH] 도메인: ${currentDomain}, Vercel: ${isVercel}, Client ID: ${domainClientId ? domainClientId.substring(0, 12) + '...' : '기본값'}`);
      
      // Vercel 환경에서는 환경 변수 우선 사용
      if (isVercel && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        console.log(`🔐 [GOOGLE OAUTH] Vercel 환경에서 환경 변수 사용: ${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID.substring(0, 12)}...`);
        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      }
      
      return domainClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';
    }
    return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';
  },
  
  // NCP 관련 키
  NCP_ACCESS_KEY: "ncp_iam_BPAMKR5amCXCgRSDodA7",
  NCP_SECRET_KEY: "ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl",
};

// 지도 관련 설정
export const MAP_CONFIG = {
  // Naver Maps 설정
  NAVER: {
    // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)
    ALLOWED_DOMAINS: [
      'nextstep.aiagnt.kr',  // 현재 운영 도메인
      'app2.aiagnt.kr',
      'app.aiagnt.kr',
      'aiagnt.kr',
      // Vercel 환경
      '*.vercel.app',
      // 개발 환경
      'localhost:3000',
      '127.0.0.1:3000',
    ],
    // 프로덕션 환경별 Client ID 설정
    CLIENT_IDS: {
      'nextstep.aiagnt.kr': '91y2nh0yff',  // 운영 환경용
      'app2.aiagnt.kr': '91y2nh0yff',      // 스테이징용
      'localhost:3000': '91y2nh0yff',      // 개발용
      // Vercel 환경은 환경 변수에서 가져옴
    },
    // 네이버 지도 옵션
    DEFAULT_OPTIONS: {
      mapTypeControl: false,
      scaleControl: false,
      zoom: 16
    }
  },
  // Google Maps 설정 제거됨 (사용하지 않음)
};

// Google 서비스 관련 설정
export const GOOGLE_CONFIG = {
  // Google OAuth 설정
  OAUTH: {
    // Google Console에 등록된 도메인별 Client ID
    ALLOWED_DOMAINS: [
      'nextstep.aiagnt.kr',  // 현재 운영 도메인
      'app2.aiagnt.kr',
      'app.aiagnt.kr',
      'aiagnt.kr',
      // Vercel 환경
      '*.vercel.app',
      // 개발 환경
      'localhost:3000',
      '127.0.0.1:3000',
    ],
    // 프로덕션 환경별 Google OAuth Client ID 설정
    CLIENT_IDS: {
      // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)
      // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음
      // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm
      'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',  // ✅ 실제 등록된 Client ID
      'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',      // 스테이징용
      'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',      // 개발용
      // Vercel 환경은 환경 변수에서 가져옴
    },
  },
  // Mapbox 설정
  MAPBOX: {
    DEFAULT_OPTIONS: {
      style: 'mapbox://styles/mapbox/streets-v11',
      zoom: 16
    }
  }
};

// 카카오 공유 관련 설정
export const KAKAO_SHARE = {
  TITLE: 'SMAP, 친구와 가족을 더 가까이',
  DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',
  IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png',
};

// 위치 관련 설정
export const LOCATION_CONFIG = {
  RECOM_CIRCLE: 5000, // 5km
  LOCATION_MEMBER_NUM: 10, // 위치 그룹원 추가 최대값
  ACCURACY: 50,
  SPEED: 1,
  NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',
  MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',
  INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code=',
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
  NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',
  UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',
  PDF_URL: 'https://app2.aiagnt.kr/img/pdf',
  EXCEL_URL: 'https://app2.aiagnt.kr/img/excel',
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
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.aiagnt.kr',
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
  GOOGLE_CONFIG,
}; 