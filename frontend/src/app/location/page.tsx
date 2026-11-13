'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
// 공통 이미지 처리 유틸리티 import
import { getSafeImageUrl, getDefaultImage, handleImageError } from '@/lib/imageUtils';
import {
  FiSearch,
  FiTrash2,
  FiMapPin,
  FiChevronDown,
  FiX,
  FiLoader,
  FiBell,
  FiBellOff,
  FiFilter,
  FiMoreVertical,
  FiArrowLeft,
  FiCheckCircle,
  FiXCircle,
  FiInfo,
  FiUser,
  FiAlertTriangle,
  FiMenu
} from 'react-icons/fi';
import { FaSearch as FaSearchSolid, FaTrash, FaCrown } from 'react-icons/fa';
import dynamic from 'next/dynamic';
import { hasLocationAndActivityPermissions, requestLocationAndActivityPermissions } from '@/utils/androidPermissions';


// 커스텀 알림 상태 추가 (react-toastify 관련 없음)
interface CustomToast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// API 키는 환경 변수에서 가져옴
const API_KEYS = {
  NAVER_CLIENT_ID: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || '',
  NAVER_CLIENT_SECRET: process.env.NEXT_PUBLIC_NAVER_CLIENT_SECRET || '',
  NAVER_MAPS_CLIENT_ID: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || ''
};
import ReactDOM from 'react-dom';

// 역지오코딩 호출 최적화: 결과 캐시 + 진행 중 요청 공용화
const reverseGeocodeCache = new Map<string, string>();
const reverseGeocodeInflight = new Map<string, Promise<string>>();
const normalizeLatLngKey = (lat: number, lng: number, precision: number = 4) => {
  // 약 ~10m 그리드로 스냅하여 중복 호출 방지 (4자리 소수)
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
};
import memberService from '@/services/memberService';
import locationService, { OtherMemberLocationRaw } from '@/services/locationService';
import groupService, { Group } from '@/services/groupService';
import { useAuth } from '@/contexts/AuthContext';
import FloatingButton from '../../components/common/FloatingButton';
import { MapSkeleton } from '@/components/common/MapSkeleton';
import { hapticFeedback } from '@/utils/haptic';
import AnimatedHeader from '@/components/common/AnimatedHeader';
import { retryDataFetch, retryMapApiLoad, retryMapInitialization } from '@/utils/retryUtils';
import GroupSelector from '../../components/location/GroupSelector';
import { cubicBezier } from 'framer-motion';

// 모바일 최적화된 CSS 스타일
const mobileStyles = `
* {
  box-sizing: border-box;
}

html, body {
  width: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}



body {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

.full-map-container {
  position: fixed;
  top: 56px; /* 헤더 높이만큼 아래에서 시작 */
  left: 0;
  right: 0;
  bottom: 72px; /* 하단 네비게이션 바 높이만큼 위에서 끝 */
  width: 100vw;
  height: calc(100vh - 56px - 72px); /* 헤더와 네비게이션 바 높이를 제외한 높이 */
  margin: 0;
  padding: 0;
  overflow: hidden;
  z-index: 10; /* 헤더(z-50)보다 낮고, 일반 콘텐츠보다 높게 설정 */
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.location-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.location-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.3);
}

.location-card.selected {
  background: white; /* 배경색을 흰색으로 변경 */
  border-color: # ; /* 이 부분은 이전 코드에서 누락된 값으로 보입니다. 필요시 수정 */
  box-shadow: 0 8px 20px rgba(168, 85, 247, 0.25);
  transform: translateY(-1px) scale(1.01);
}

.member-avatar {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.member-avatar.selected {
  box-shadow: 0 0 0 3px #6366f1, 0 0 20px rgba(99, 102, 241, 0.4);
}



.bottom-sheet {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-top: 1px solid rgba(99, 102, 241, 0.1);
}

.search-input {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-input:focus {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
}

.mobile-button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}

.notification-badge {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.danger-badge {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.group-selector {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.group-selector:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.location-info-panel {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.1);
}

/* 앱 고정 레이아웃 - 전체 스크롤 비활성화 */
html, body {
  overflow: hidden !important;
  position: fixed !important;
  width: 100% !important;
  height: 100% !important;
  -webkit-overflow-scrolling: touch !important;
  touch-action: manipulation !important;
}

/* 지도 컨테이너 위치 정확성 보장 */
.full-map-container {
  position: fixed !important;
  top: 56px !important; /* 헤더 높이 */
  left: 0 !important;
  right: 0 !important;
  bottom: 72px !important; /* 네비게이션 바 높이 */
  width: 100vw !important;
  height: calc(100vh - 56px - 72px) !important;
  z-index: 10 !important;
  pointer-events: auto !important;
}

/* 모바일 사파리 bounce 효과 비활성화 */
body {
  overscroll-behavior: none !important;
  -webkit-overflow-scrolling: touch !important;
}

/* 모바일 앱 최적화 */
* {
  -webkit-tap-highlight-color: transparent !important;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

/* 네이버 지도 zoom 컨트롤 위치 조정 - 헤더 아래로 이동 */
.nmap_control_zoom {
  top: 180px !important;
  right: 10px !important;
}

/* 네이버 지도 줌 컨트롤 강제 위치 조정 */
div[class*="nmap_control_zoom"] {
  top: 180px !important;
  right: 10px !important;
}

/* 네이버 지도 컨트롤 전체 */
.nmap_control {
  top: 195px !important;
}

/* 지도 컨테이너 내부 지도 요소 독립적 움직임 보장 */
.full-map-container > div,
.full-map-container > div > div,
.full-map-container iframe,
.full-map-container canvas {
  position: relative !important;
  transform: none !important;
  -webkit-transform: none !important;
  will-change: auto !important;
  touch-action: pan-x pan-y !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}

/* 지도 터치 이벤트 격리 */
.full-map-container {
  touch-action: pan-x pan-y !important;
  -webkit-overflow-scrolling: touch !important;
  overscroll-behavior: contain !important;
}

/* 줌 컨트롤 버튼들 - 간격 제거 */
.nmap_control_zoom .nmap_control_zoom_in,
.nmap_control_zoom .nmap_control_zoom_out {
  position: relative !important;
  margin: 0 !important;
  border-radius: 0 !important;
}

/* 줌 인 버튼 (위쪽) */
.nmap_control_zoom .nmap_control_zoom_in {
  border-top-left-radius: 4px !important;
  border-top-right-radius: 4px !important;
  border-bottom: none !important;
}

/* 줌 아웃 버튼 (아래쪽) */
.nmap_control_zoom .nmap_control_zoom_out {
  border-bottom-left-radius: 4px !important;
  border-bottom-right-radius: 4px !important;
  border-top: 1px solid #ddd !important;
}

@media (max-width: 640px) {
  .location-card {
    min-width: 240px;
  }
  
  .member-avatar {
    width: 48px; 
    height: 48px; 
  }
  

}
`;

// Framer Motion 애니메이션 variants
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20
  },
  in: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,

    }
  },
  out: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,

    }
  }
};

// 사이드바 애니메이션 variants (고급스러운 효과)
const sidebarVariants = {
  closed: {
    x: -30,
    opacity: 0,
    scale: 0.99,
    filter: 'blur(1px)',
    boxShadow: '0 0 0 rgba(0,0,0,0)',
    transition: { duration: 0.7, ease: cubicBezier(0.22, 0.61, 0.36, 1) }
  },
  open: {
    x: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    boxShadow: '0 8px 32px rgba(31,41,55,0.18), 0 1.5px 6px rgba(0,0,0,0.08)',
    transition: { duration: 0.8, ease: cubicBezier(0.22, 0.61, 0.36, 1) }
  }
};

const sidebarOverlayVariants = {
  closed: {
    opacity: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.3 }
  },
  open: {
    opacity: 1,
    filter: 'blur(2.5px)',
    transition: { duration: 0.45 }
  }
};

const sidebarContentVariants = {
  closed: {
    opacity: 0,
    x: -30,
    scale: 0.98,
    transition: { duration: 0.3 }
  },
  open: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.4, delay: 0.05 }
  }
};

const memberItemVariants = {
  closed: {
    opacity: 1
  },
  open: {
    opacity: 1
  }
};



const memberAvatarVariants = {
  initial: {
    scale: 0.9,
    opacity: 0
  },
  animate: (index: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      delay: index * 0.04,
      type: "spring",
      stiffness: 300,
      damping: 25,
      duration: 0.4
    }
  }),
  hover: {
    scale: 1.02,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      duration: 0.15
    }
  },
  selected: {
    scale: 1.01,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      duration: 0.15
    }
  }
};

const locationCardVariants = {
  hidden: {
    opacity: 0,
    y: 15,
    scale: 0.98
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: index * 0.04,
      type: "spring",
      stiffness: 300,
      damping: 25,
      duration: 0.4
    }
  }),
  hover: {
    y: -2,
    scale: 1.01,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      duration: 0.15
    }
  },
  selected: {
    scale: 1.01,
    y: -1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      duration: 0.15
    }
  },
  tap: {
    scale: 0.99,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 25,
      duration: 0.1
    }
  }
};

const floatingButtonVariants = {
  initial: {
    scale: 0,
    rotate: -90,
    y: 50
  },
  animate: {
    scale: 1,
    rotate: 0,
    y: 0,
    transition: {
      delay: 0.3,
      type: "spring",
      stiffness: 300,
      damping: 25,
      duration: 0.5
    }
  },
  hover: {
    scale: 1.05,
    y: -2,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      duration: 0.15
    }
  },
  tap: {
    scale: 0.95,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 25,
      duration: 0.1
    }
  }
};

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 30
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
      duration: 0.4
    }
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 30,
    transition: {
      duration: 0.2,

    }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1
    }
  }
};

const staggerItem = {
  hidden: {
    opacity: 0,
    y: 15
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25
    }
  }
};

const spinnerVariants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// 초기 데이터 로딩 시뮬레이션 useEffect 추가





// 타입 정의
declare global {
  interface Window {
    naver: any;
  }
}

// 이미지 처리 함수들은 @/lib/imageUtils에서 import하여 사용

interface LocationData {
  id: string;
  name: string;
  address: string;
  category: string;
  coordinates: [number, number];
  memo: string;
  favorite: boolean;
  notifications?: boolean;
  slt_idx?: string | number;
  slt_title?: string;
}

interface NewLocationInput {
  id?: string;
  name: string;
  address: string;
  coordinates: [number, number];
  category?: string;
  memo?: string;
  favorite?: boolean;
  notifications?: boolean;
}

interface HomeLocation {
  lat: number;
  lng: number;
}

interface HomeSchedule {
  id: string;
  title: string;
  date: string;
  location: string;
}

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  mt_file1?: string | null;
  isSelected: boolean;
  location: HomeLocation;
  schedules: HomeSchedule[];
  savedLocations: LocationData[];
  savedLocationCount?: number; // 장소 개수 (미리 로드)
  mt_gender?: number | null;
  original_index: number;

  // 새로 추가된 위치 정보
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mlt_speed?: number | null;
  mlt_battery?: number | null;
  mlt_gps_time?: string | null;

  // 그룹 권한 정보
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
}

type NaverMap = any;
type NaverCoord = any;
type NaverMarker = any;
type NaverInfoWindow = any;
type NaverService = any;

// 이미지 로딩 상태 관리 훅
const useImageWithFallback = (src: string | null, fallbackSrc: string) => {
  const [imageSrc, setImageSrc] = useState<string>(src || fallbackSrc);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setImageSrc(fallbackSrc);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
      setHasError(false);
    };
    img.onerror = () => {
      console.log('[이미지 로딩 실패] 기본 이미지로 대체:', src, '->', fallbackSrc);
      setImageSrc(fallbackSrc);
      setIsLoading(false);
      setHasError(true);
    };
    img.src = src;
  }, [src, fallbackSrc]);

  return { imageSrc, isLoading, hasError };
};
export default function LocationPage() {
  const router = useRouter();
  const { user } = useAuth(); // 현재 로그인한 사용자 정보

  // 성능 측정을 위한 페이지 로드 시간 기록
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).pageLoadStart) {
      (window as any).pageLoadStart = performance.now();
      console.log('[성능] Location 페이지 로드 시작 (최적화 버전)');
    }
  }, []);

  // 🔥 위치 페이지 진입 시 권한 체크
  useEffect(() => {
    const checkLocationPermissions = async () => {
      console.log('🔥 [LOCATION_PAGE] 위치 권한 체크 시작');

      if (!hasLocationAndActivityPermissions()) {
        console.log('⚠️ [LOCATION_PAGE] 위치/동작 권한이 없음 - 요청');
        try {
          const granted = await requestLocationAndActivityPermissions();
          if (granted) {
            console.log('✅ [LOCATION_PAGE] 위치/동작 권한 요청 성공');
          } else {
            console.log('⚠️ [LOCATION_PAGE] 위치/동작 권한 요청 실패');
          }
        } catch (error) {
          console.error('❌ [LOCATION_PAGE] 위치/동작 권한 요청 중 오류:', error);
        }
      } else {
        console.log('✅ [LOCATION_PAGE] 위치/동작 권한 이미 허용됨');
      }
    };

    // 페이지 로드 후 1초 뒤에 권한 체크
    const timeoutId = setTimeout(checkLocationPermissions, 1000);

    return () => clearTimeout(timeoutId);
  }, []);


  // 헤더 상단 패딩 강제 제거 (런타임)
  useEffect(() => {
    const forceRemoveHeaderPadding = () => {
      if (typeof document === 'undefined') return;

      // 모든 헤더 관련 요소 선택
      const selectors = [
        'header',
        '.header-fixed',
        '.glass-effect',
        '.location-header',
        '.register-header-fixed',
        '.activelog-header',
        '.group-header',
        '.schedule-header',
        '.home-header',
        '[role="banner"]',
        '#location-page-container'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element: Element) => {
          const htmlElement = element as HTMLElement;
          htmlElement.style.paddingTop = '0px';
          htmlElement.style.marginTop = '0px';
          htmlElement.style.setProperty('padding-top', '0px', 'important');
          htmlElement.style.setProperty('margin-top', '0px', 'important');
          if (selector === 'header' || selector.includes('header')) {
            htmlElement.style.setProperty('top', '0px', 'important');
            htmlElement.style.setProperty('position', 'fixed', 'important');
          }
        });
      });

      // body와 html 요소도 확인
      document.body.style.setProperty('padding-top', '0px', 'important');
      document.body.style.setProperty('margin-top', '0px', 'important');
      document.documentElement.style.setProperty('padding-top', '0px', 'important');
      document.documentElement.style.setProperty('margin-top', '0px', 'important');

      // 헤더 아이콘 정렬 강제 적용
      const headerIconContainer = document.querySelector('.header-fixed .flex.items-center.h-14');
      if (headerIconContainer) {
        const headerElement = headerIconContainer as HTMLElement;
        headerElement.style.setProperty('display', 'flex', 'important');
        headerElement.style.setProperty('align-items', 'center', 'important');
        headerElement.style.setProperty('justify-content', 'space-between', 'important');
        headerElement.style.setProperty('padding-left', '16px', 'important');
        headerElement.style.setProperty('padding-right', '0px', 'important');
        headerElement.style.setProperty('margin-right', '0px', 'important');
      }

      // 헤더 오른쪽 아이콘들 정렬
      const iconContainer = document.querySelector('.header-fixed .flex.items-center.h-14 > div:last-child');
      if (iconContainer) {
        const iconElement = iconContainer as HTMLElement;
        iconElement.style.setProperty('display', 'flex', 'important');
        iconElement.style.setProperty('align-items', 'center', 'important');
        iconElement.style.setProperty('gap', '16px', 'important');
        iconElement.style.setProperty('margin-left', 'auto', 'important');
        iconElement.style.setProperty('padding-right', '0px', 'important');
        iconElement.style.setProperty('margin-right', '0px', 'important');
      }
    };

    // 즉시 실행
    forceRemoveHeaderPadding();

    // 정기적으로 강제 적용 (다른 스타일이 덮어쓸 수 있으므로)
    const interval = setInterval(forceRemoveHeaderPadding, 500);

    return () => {
      clearInterval(interval);
    };
  }, []);



  // 상태 관리
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapLoadError, setMapLoadError] = useState(false);
  const [mapRetryCount, setMapRetryCount] = useState(0);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFetchingGroupMembers, setIsFetchingGroupMembers] = useState(false);
  const [isFirstMemberSelectionComplete, setIsFirstMemberSelectionComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingOtherLocations, setIsLoadingOtherLocations] = useState(false);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);

  // 데이터 로딩 상태 추적을 위한 ref 추가
  const dataFetchedRef = useRef({
    groups: false,
    members: false,
    locations: false
  });

  // 마커 업데이트 중 플래그 (중복 실행 방지)
  const isUpdatingMarkersRef = useRef(false);

  // 지도 관련 상태
  const [map, setMap] = useState<NaverMap | null>(null);
  const [markers, setMarkers] = useState<NaverMarker[]>([]);
  const [memberMarkers, setMemberMarkers] = useState<NaverMarker[]>([]); // Add state for member markers
  // 최신 마커 배열을 추적하기 위한 ref (setState 비동기 반영 지연으로 인한 누락 방지)
  const locationMarkersRef = useRef<NaverMarker[]>([]);
  const memberMarkersRef = useRef<NaverMarker[]>([]);
  // 중복 마커 생성으로 인한 깜빡임 방지용 시그니처
  const lastMarkersSignatureRef = useRef<string>('');
  const lastMarkerUpdateTimeRef = useRef<number>(0); // 🚨 중복 실행 방지를 위한 마지막 업데이트 시간
  const previousSelectedMemberIdRef = useRef<string | null>(null); // 🚨 이전 선택된 멤버 ID 추적 (멤버 변경 감지)
  const isMarkerClickingRef = useRef<boolean>(false); // 🚨 마커 클릭 중인지 확인하는 플래그
  const [infoWindow, setInfoWindow] = useState<NaverInfoWindow | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const tempMarker = useRef<NaverMarker | null>(null);

  // 그룹 및 멤버 관련 상태
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedMemberIdRef, setSelectedMemberIdRef] = useState<React.MutableRefObject<string | null>>({ current: null });

  // 🖼️ 사용자 프로필 이미지 변경 감지 및 마커 업데이트 (중복 방지)
  useEffect(() => {
    if (user && user.mt_file1 && groupMembers.length > 0) {
      // 현재 사용자의 마커 찾아서 업데이트
      const currentUserMember = groupMembers.find(member => member.id === user.mt_idx?.toString());
      if (currentUserMember && currentUserMember.photo !== user.mt_file1) {
        console.log('[LOCATION] 사용자 프로필 이미지 변경 감지 - 마커 업데이트:', {
          memberId: currentUserMember.id,
          oldPhoto: currentUserMember.photo,
          newPhoto: user.mt_file1
        });

        // 마커 업데이트 (강제 업데이트 모드로 현재 사용자 마커만 업데이트)
        updateAllMarkers(groupMembers, null, true);
      }
    }
  }, [user?.mt_file1, groupMembers]);

  // 사이드바 멤버 선택 시에만 자동 InfoWindow 표시를 허용하는 플래그
  const shouldAutoOpenInfoWindowRef = useRef<boolean>(false);
  // 자동 InfoWindow 재생성 방지용 타이머와 시그니처
  const autoInfoWindowTimeoutRef = useRef<number | null>(null);
  const lastAutoInfoSignatureRef = useRef<string>("");
  // 멤버 선택 버전(레이스 컨디션 방지용)
  const selectionVersionRef = useRef<number>(0);
  // 멤버 선택 플로우 진행 중 가드
  const selectionFlowInProgressRef = useRef<boolean>(false);

  // 🚨 선택된 멤버의 InfoWindow를 강제로 띄우는 헬퍼 - 강화된 버전
  const openInfoWindowForSelectedMember = useCallback((): boolean => {
    try {
      if (!shouldAutoOpenInfoWindowRef.current) {
        console.log('[openInfoWindowForSelectedMember] 🚨 자동 열기 플래그 비활성화');
        return false;
      }
      if (!map || !window.naver?.maps) {
        console.warn('[openInfoWindowForSelectedMember] 🚨 맵 또는 네이버 맵스 API 없음');
        return false;
      }

      // 🚨 핵심 수정: selectedMemberIdRef.current를 사용하여 최신 선택된 멤버 ID 확인
      const currentSelectedMemberId = selectedMemberIdRef.current;
      if (!currentSelectedMemberId) {
        console.warn('[openInfoWindowForSelectedMember] 🚨 selectedMemberIdRef에 값 없음');
        return false;
      }

      // 🚨 ID로 멤버 찾기 (groupMembers.find(m => m.isSelected) 대신)
      const sel = groupMembers.find((m) => m.id === currentSelectedMemberId);
      if (!sel) {
        console.warn('[openInfoWindowForSelectedMember] 🚨 선택된 멤버 ID로 멤버를 찾을 수 없음:', currentSelectedMemberId);
        return false;
      }

      console.log('[openInfoWindowForSelectedMember] 🚨 선택된 멤버 확인:', {
        memberId: sel.id,
        memberName: sel.name,
        isSelected: sel.isSelected,
        fromRef: currentSelectedMemberId
      });

      // 기존 InfoWindow는 닫고 새로 생성
      try {
        if (infoWindow && infoWindow.getMap()) {
          infoWindow.close();
          setInfoWindow(null);
        }
      } catch (_) { }

      // 🚨 멤버 마커 찾기 로직 강화: 여러 방법으로 마커 찾기
      const key = String(sel.id);
      let selectedMarker: any = null;

      console.log('[openInfoWindowForSelectedMember] 🚨 마커 찾기 시작:', {
        memberId: sel.id,
        memberName: sel.name,
        memberMarkersRefLength: memberMarkersRef.current?.length || 0,
        memberMarkersLength: memberMarkers.length
      });

      // 1. __key로 찾기
      const byKey = memberMarkersRef.current?.find((mk: any) => mk && (mk as any).__key === key) || null;
      if (byKey) {
        selectedMarker = byKey;
        console.log('[openInfoWindowForSelectedMember] 🚨 __key로 마커 찾음');
      }

      // 2. 인덱스로 찾기
      if (!selectedMarker) {
        const idx = groupMembers.findIndex((m) => m.id === sel.id);
        if (idx >= 0 && memberMarkersRef.current && memberMarkersRef.current[idx]) {
          selectedMarker = memberMarkersRef.current[idx];
          console.log('[openInfoWindowForSelectedMember] 🚨 인덱스로 마커 찾음:', idx);
        }
      }

      // 3. title로 찾기
      if (!selectedMarker && memberMarkersRef.current?.length) {
        selectedMarker = memberMarkersRef.current.find((mk: any) => mk?.getTitle?.() === sel.name) || null;
        if (selectedMarker) {
          console.log('[openInfoWindowForSelectedMember] 🚨 title로 마커 찾음');
        }
      }

      // 4. memberMarkers 상태에서도 찾기
      if (!selectedMarker && memberMarkers.length > 0) {
        const idx = groupMembers.findIndex((m) => m.id === sel.id);
        if (idx >= 0 && memberMarkers[idx]) {
          selectedMarker = memberMarkers[idx];
          console.log('[openInfoWindowForSelectedMember] 🚨 memberMarkers 상태에서 마커 찾음:', idx);
        }
      }

      console.log('[openInfoWindowForSelectedMember] 🚨 마커 찾기 결과:', {
        found: !!selectedMarker,
        markerExists: !!selectedMarker?.getMap,
        markerOnMap: selectedMarker?.getMap ? !!selectedMarker.getMap() : false
      });

      if (selectedMarker) {
        console.log('[openInfoWindowForSelectedMember] 🚨 마커 찾음, InfoWindow 생성 시작');

        // 마커가 지도에 제대로 표시되어 있는지 확인
        if (selectedMarker.getMap && !selectedMarker.getMap()) {
          console.warn('[openInfoWindowForSelectedMember] 🚨 마커가 지도에 없음, 지도에 추가');
          selectedMarker.setMap(map);
        }

        // InfoWindow 생성
        createMemberInfoWindow(sel, selectedMarker);
        shouldAutoOpenInfoWindowRef.current = false; // 한 번 열면 플래그 해제
        return true;
      }

      console.warn('[openInfoWindowForSelectedMember] 🚨 마커를 찾을 수 없음');
      return false;
    } catch (e) {
      console.warn('[openInfoWindowForSelectedMember] 실패:', e);
      return false;
    }
  }, [groupMembers, infoWindow, map]);

  // 지도 오버레이 하드 리셋 함수 (멤버 변경 시 사용)
  const hardResetMapOverlays = (reason: string) => {
    try {
      console.log('[hardResetMapOverlays] 시작:', reason);
      // InfoWindow 정리 - 🚨 첫 로드 시에는 닫지 않음 (초기 설정이 아직 완료되지 않은 경우)
      // reason에 '멤버 변경'이 포함된 경우에만 인포윈도우 닫기
      if (!reason.includes('멤버 변경') || reason.includes('추가 정리')) {
        console.log('[hardResetMapOverlays] 🚨 인포윈도우 정리 건너뜀 - reason:', reason);
      } else {
        try {
          if (infoWindow) {
            infoWindow.close();
            setInfoWindow(null);
          }
        } catch (e) { }
      }
      // 패널 임시 마커 정리
      try {
        if (tempMarker.current) {
          tempMarker.current.setMap(null);
          tempMarker.current = null;
        }
      } catch (_) { }
      // 🚨 멤버 마커는 제거하지 않음 (사라지는 문제 해결)
      console.log('[hardResetMapOverlays] 🚨 멤버 마커 보존 - 장소 마커만 제거');

      // 장소 마커 제거 (강화된 버전)
      console.log('[hardResetMapOverlays] 현재 장소 마커 상태:', {
        locationMarkersRefLength: locationMarkersRef.current?.length || 0,
        markersLength: markers?.length || 0
      });

      // 1. locationMarkersRef에서 제거 (ref는 비우지 않음 - updateAllMarkers에서 관리)
      if (locationMarkersRef.current && locationMarkersRef.current.length > 0) {
        const markersToRemove = [...locationMarkersRef.current]; // 복사본으로 순회
        markersToRemove.forEach((mk, idx) => {
          try {
            if (mk && typeof mk.setMap === 'function') {
              mk.setMap(null);
              console.log(`[hardResetMapOverlays] locationMarkersRef 마커 ${idx + 1} 지도에서 제거`);
            }
          } catch (e) {
            console.warn(`[hardResetMapOverlays] locationMarkersRef 마커 ${idx + 1} 제거 실패:`, e);
          }
        });
        // 🚨 ref는 여기서 비우지 않음 - updateAllMarkers에서 새 마커로 교체
      }

      // 2. markers 상태에서 제거
      if (markers && markers.length > 0) {
        markers.forEach((mk, idx) => {
          try {
            if (mk && typeof mk.setMap === 'function') {
              mk.setMap(null);
              console.log(`[hardResetMapOverlays] markers 상태 마커 ${idx + 1} 제거 완료`);
            }
          } catch (e) {
            console.warn(`[hardResetMapOverlays] markers 상태 마커 ${idx + 1} 제거 실패:`, e);
          }
        });
      }

      // 3. 상태 즉시 초기화
      setMarkers([]);
      console.log('[hardResetMapOverlays] 장소 마커 상태 초기화 완료');

      // 자동 오픈 스케줄 취소 및 시그니처 초기화
      if (autoInfoWindowTimeoutRef.current) {
        clearTimeout(autoInfoWindowTimeoutRef.current);
        autoInfoWindowTimeoutRef.current = null;
      }
      lastAutoInfoSignatureRef.current = '';
      selectionFlowInProgressRef.current = false;
      console.log('[hardResetMapOverlays] 완료');
    } catch (e) {
      console.warn('[hardResetMapOverlays] 경고:', e);
    }
  };

  // ========================================
  // 🚨 새로운 간단한 마커 관리 로직
  // ========================================

  // 1. 모든 장소 마커 제거 (단일 책임)
  const clearAllLocationMarkers = useCallback(() => {
    console.log('[clearAllLocationMarkers] 시작 - 마커 수:', locationMarkersRef.current?.length || 0);
    if (locationMarkersRef.current && locationMarkersRef.current.length > 0) {
      locationMarkersRef.current.forEach((marker, idx) => {
        try {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
          }
        } catch (e) {
          console.warn(`[clearAllLocationMarkers] 마커 ${idx} 제거 실패:`, e);
        }
      });
      locationMarkersRef.current = [];
    }
    // markers 상태도 초기화
    setMarkers([]);
    console.log('[clearAllLocationMarkers] 완료');
  }, []);

  // 2. 멤버 마커 색상만 업데이트 (마커 재생성 없이)
  const updateMemberMarkerStyles = useCallback((selectedMemberId: string) => {
    console.log('[updateMemberMarkerStyles] 시작 - 선택된 멤버:', selectedMemberId);

    memberMarkers.forEach((marker, index) => {
      try {
        const markerKey = (marker as any).__key;
        if (!markerKey) return;

        // 해당 멤버 찾기
        const member = groupMembers.find(m => String(m.id) === markerKey || String(m.name) === markerKey);
        if (!member) return;

        const isSelected = member.id === selectedMemberId;
        const borderColor = isSelected ? '#ef4444' : '#3b82f6'; // 빨간색 vs 파란색
        const photoUrl = getSafeImageUrl(member.mt_file1, member.mt_gender, member.original_index);

        // 마커 아이콘 업데이트
        const newIcon = `
          <div style="position: relative; text-align: center;">
            <div style="width: 28px; height: 28px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
              <img src="${photoUrl}" alt="${member.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/images/avatar1.png'"/>
            </div>
            <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; white-space: nowrap; font-size: 10px; font-weight: 500;">
              ${member.name}
            </div>
          </div>
        `;

        if (marker.setIcon) {
          marker.setIcon({ content: newIcon, anchor: new window.naver.maps.Point(14, 14) });
        }

        console.log(`[updateMemberMarkerStyles] ${member.name} - ${isSelected ? '선택됨(빨강)' : '선택안됨(파랑)'}`);
      } catch (e) {
        console.warn(`[updateMemberMarkerStyles] 마커 ${index} 업데이트 실패:`, e);
      }
    });

    console.log('[updateMemberMarkerStyles] 완료');
  }, [groupMembers, memberMarkers]);

  // 3. 멤버 변경 시 핵심 처리 함수 (장소 마커 교체 + 색상 업데이트)
  const handleMemberChange = useCallback(async (newMemberId: string, newMember: GroupMember, locations: LocationData[]) => {
    console.log('[handleMemberChange] 시작:', newMember.name, '장소 수:', locations?.length || 0);

    if (!map || !window.naver?.maps || !isMapReady) {
      console.warn('[handleMemberChange] 지도 준비 안됨');
      return;
    }

    // 1. 이전 장소 마커 모두 제거
    clearAllLocationMarkers();

    // 2. 멤버 마커 색상 업데이트
    updateMemberMarkerStyles(newMemberId);

    // 3. 새 장소 마커 생성
    if (locations && locations.length > 0) {
      console.log('[handleMemberChange] 새 장소 마커 생성 시작:', locations.length);
      const newLocationMarkers: NaverMarker[] = [];

      locations.forEach((location, index) => {
        try {
          const coords = location.coordinates;
          if (!coords || coords.length < 2 || coords[0] === 0 || coords[1] === 0) {
            console.warn(`[handleMemberChange] 무효한 좌표:`, location.name);
            return;
          }

          const position = new window.naver.maps.LatLng(coords[1], coords[0]);
          const isSelectedLocation = selectedLocationIdRef.current === location.id;
          const markerColor = isSelectedLocation ? '#ec4899' : '#3b82f6'; // 선택: 핑크, 일반: 파란색
          const markerSize = isSelectedLocation ? '28px' : '24px';

          // 장소 마커 생성 (기존 원형 스타일 사용)
          const marker = new window.naver.maps.Marker({
            position,
            map: map,
            icon: {
              content: `
                <div style="position: relative; text-align: center;">
                  <div style="
                    width: ${markerSize};
                    height: ${markerSize};
                    background-color: white;
                    border: 2px solid ${markerColor};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    transition: all 0.3s ease;
                  ">
                    <svg width="${isSelectedLocation ? '16' : '14'}" height="${isSelectedLocation ? '16' : '14'}" fill="${markerColor}" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                    </svg>
                  </div>
                  <div style="
                    position: absolute;
                    bottom: -18px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: ${isSelectedLocation ? 'rgba(236, 72, 153, 0.95)' : 'rgba(0,0,0,0.85)'};
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    white-space: nowrap;
                    font-size: 10px;
                    font-weight: 500;
                    max-width: 100px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  ">
                    ${location.name || '장소'}
                  </div>
                </div>
              `,
              anchor: new window.naver.maps.Point(parseInt(markerSize) / 2, parseInt(markerSize) / 2)
            },
            zIndex: isSelectedLocation ? 200 : 100,
            title: location.name
          });

          (marker as any).__locationId = location.id;
          (marker as any).__locationName = location.name;
          (marker as any).__isLocationMarker = true;

          // 🚨 장소 마커 클릭 이벤트 추가
          window.naver.maps.Event.addListener(marker, 'click', () => {
            console.log(`[handleMemberChange] 🎯 장소 마커 클릭: ${location.name} (${location.id})`);

            // 마커 클릭 플래그 설정
            isMarkerClickingRef.current = true;

            // 🚨 1단계: ref와 상태 먼저 업데이트 (마커 스타일 변경에 필요)
            selectedLocationIdRef.current = location.id;
            setSelectedLocationId(location.id);

            // 🚨 2단계: 마커 스타일 즉시 업데이트 (빨간색으로 변경)
            updateAllLocationMarkerStyles(location.id);

            // 🚨 3단계: 장소 위치로 지도 중심 이동
            const [lng, lat] = location.coordinates;
            const clickPosition = new window.naver.maps.LatLng(lat, lng);
            if (clickPosition && map) {
              map.setCenter(clickPosition);
            }

            // 🚨 4단계: InfoWindow 생성 및 표시 (약간의 지연으로 UI 업데이트 완료 대기)
            setTimeout(() => {
              // 기존 InfoWindow 닫기 (있다면)
              try {
                if (infoWindow && infoWindow.getMap && infoWindow.getMap()) {
                  infoWindow.close();
                }
              } catch (e) {
                console.warn('[handleMemberChange 장소 클릭] 기존 InfoWindow 닫기 실패:', e);
              }

              // InfoWindow 생성 및 표시
              const newInfoWindow = createLocationInfoWindow(
                location.name || '제목 없음',
                location.address || '주소 정보 없음',
                location
              );
              newInfoWindow.open(map, marker);
              setInfoWindow(newInfoWindow);

              console.log('[handleMemberChange 장소 클릭] InfoWindow 표시 완료:', {
                장소명: location.name,
                장소ID: location.id
              });

              // 마커 클릭 플래그 리셋
              setTimeout(() => {
                isMarkerClickingRef.current = false;
              }, 100);
            }, 50); // 마커 스타일 업데이트 후 짧은 지연
          });

          newLocationMarkers.push(marker);
          console.log(`[handleMemberChange] 장소 마커 생성: ${location.name}`);
        } catch (e) {
          console.warn(`[handleMemberChange] 장소 마커 ${index} 생성 실패:`, e);
        }
      });

      // ref 및 상태 업데이트
      locationMarkersRef.current = newLocationMarkers;
      setMarkers(newLocationMarkers);
      console.log('[handleMemberChange] 장소 마커 생성 완료:', newLocationMarkers.length);
    }

    console.log('[handleMemberChange] 완료');
  }, [map, isMapReady, clearAllLocationMarkers, updateMemberMarkerStyles]);

  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<number, number>>({});

  // 장소 관련 상태
  const [otherMembersSavedLocations, setOtherMembersSavedLocations] = useState<OtherMemberLocationRaw[]>([]);
  const [selectedMemberSavedLocations, setSelectedMemberSavedLocations] = useState<LocationData[] | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLocationIdRef, setSelectedLocationIdRef] = useState<React.MutableRefObject<string | null>>({ current: null });

  // UI 상태
  const [activeView, setActiveView] = useState<'selectedMemberPlaces' | 'otherMembersPlaces'>('selectedMemberPlaces');
  const [isLocationInfoPanelOpen, setIsLocationInfoPanelOpen] = useState(false);
  const [isEditingPanel, setIsEditingPanel] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLocationSearchModalOpen, setIsLocationSearchModalOpen] = useState(false);

  // 사이드바 상태 추가
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);



  // 검색 관련 상태
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [isSearchingLocationForPanel, setIsSearchingLocationForPanel] = useState(false);
  const [locationSearchModalCaller, setLocationSearchModalCaller] = useState<'panel' | 'modal' | null>(null);

  // 새 장소 입력 상태
  const [newLocation, setNewLocation] = useState<NewLocationInput>({
    name: '',
    address: '',
    coordinates: [0, 0],
    category: '기타',
    memo: '',
    favorite: false,
    notifications: true
  });
  const [clickedCoordinates, setClickedCoordinates] = useState<[number, number] | null>(null);
  const [isSavingLocationPanel, setIsSavingLocationPanel] = useState(false);

  // 드래그 관련 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);

  // 스와이프 관련 상태
  const [isHorizontalSwipe, setIsHorizontalSwipe] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState(0);
  const [swipeThreshold] = useState(50); // 스와이프 감지 임계값

  // Refs
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  // 멤버 선택 관련 상태
  const [firstMemberSelected, setFirstMemberSelected] = useState(false);

  // 장소 선택 시 멤버 위치로 지도 이동 방지 플래그
  const isLocationSelectingRef = useRef(false);
  const reverseGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);
  }, []);

  // 모달 상태 추가
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onConfirm?: () => void; // 확인 콜백 추가
  } | null>(null);

  // 장소 삭제 모달 상태 추가
  const [isLocationDeleteModalOpen, setIsLocationDeleteModalOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<LocationData | OtherMemberLocationRaw | null>(null);
  const [isDeletingLocation, setIsDeletingLocation] = useState(false);

  // 컴팩트 토스트 모달 상태 추가
  const [toastModal, setToastModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'loading';
    title: string;
    message: string;
    progress?: number;
    autoClose?: boolean;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    progress: 0,
    autoClose: true
  });

  // InfoWindow에서 삭제 버튼 클릭 시 호출되는 전역 함수
  // 테스트 함수들을 전역에 등록
  useEffect(() => {
    // 역지오코딩 테스트 함수
    // (window as any).testReverseGeocode = async (lat?: number, lng?: number) => {
    //   const testLat = lat || 37.5665; // 시청 좌표
    //   const testLng = lng || 126.9780;

    //   console.log(`[TEST] 역지오코딩 테스트 시작: ${testLat}, ${testLng}`);

    //   try {
    //     const address = await getAddressFromCoordinates(testLat, testLng);
    //     console.log(`[TEST] 역지오코딩 결과: ${address}`);
    //     alert(`테스트 결과: ${address}`);
    //     return address;
    //   } catch (error) {
    //     console.error(`[TEST] 역지오코딩 실패:`, error);
    //     alert(`테스트 실패: ${error}`);
    //     return null;
    //   }
    // };

    // 네이버 맵 상태 확인 함수
    (window as any).checkNaverMapStatus = () => {
      const status = {
        hasNaver: !!window.naver,
        hasMaps: !!window.naver?.maps,
        hasService: !!window.naver?.maps?.Service,
        hasPoint: !!window.naver?.maps?.Point,
        hasLatLng: !!window.naver?.maps?.LatLng,
        mapInstance: !!map,
        serviceMethods: window.naver?.maps?.Service ? Object.getOwnPropertyNames(window.naver.maps.Service) : []
      };

      console.log('[TEST] 네이버 맵 상태:', status);
      alert(`네이버 맵 상태:\n${JSON.stringify(status, null, 2)}`);
      return status;
    };

    console.log('[TEST] 테스트 함수 등록 완료');
    console.log('[TEST] 콘솔에서 다음 명령어를 사용하세요:');
    console.log('[TEST] - checkNaverMapStatus(): 네이버 맵 상태 확인');
    // console.log('[TEST] - testReverseGeocode(): 기본 좌표로 역지오코딩 테스트');
    // console.log('[TEST] - testReverseGeocode(37.5194524, 126.9229853): 특정 좌표로 테스트');

    (window as any).handleLocationDeleteFromInfoWindow = (locationId: string) => {
      console.log('[InfoWindow 삭제] 장소 삭제 요청:', locationId);

      // 해당 장소 찾기
      let targetLocation: LocationData | OtherMemberLocationRaw | null = null;

      // 선택된 멤버의 장소에서 찾기
      if (selectedMemberSavedLocations) {
        targetLocation = selectedMemberSavedLocations.find(loc => loc.id === locationId) || null;
      }

      // 다른 멤버들의 장소에서 찾기
      if (!targetLocation) {
        targetLocation = otherMembersSavedLocations.find(loc =>
          (loc.id === locationId) || (loc.slt_idx?.toString() === locationId)
        ) || null;
      }

      if (targetLocation) {
        // InfoWindow 닫기
        if (infoWindow) {
          infoWindow.close();
          setInfoWindow(null);
        }

        // 삭제 모달 열기
        openLocationDeleteModal(targetLocation);
      } else {
        console.error('[InfoWindow 삭제] 장소를 찾을 수 없음:', locationId);
        openModal('오류', '삭제할 장소를 찾을 수 없습니다.', 'error');
      }
    };

    // InfoWindow 닫기 전역 함수
    (window as any).closeInfoWindow = () => {
      console.log('[InfoWindow 닫기] 닫기 요청');
      console.log('[InfoWindow 닫기] 현재 infoWindow 상태:', !!infoWindow);
      if (infoWindow) {
        try {
          console.log('[InfoWindow 닫기] close() 메서드 호출 시작');
          infoWindow.close();
          setInfoWindow(null);
          console.log('[InfoWindow 닫기] 성공');
        } catch (error) {
          console.error('[InfoWindow 닫기] 실패:', error);
          setInfoWindow(null);
        }
      } else {
        console.warn('[InfoWindow 닫기] infoWindow가 null이므로 닫을 수 없음');
      }
    };

    // 전역 함수 설정 완료 로그
    console.log('[전역 함수 설정] 완료:', {
      handleLocationDeleteFromInfoWindow: typeof (window as any).handleLocationDeleteFromInfoWindow,
      closeInfoWindow: typeof (window as any).closeInfoWindow
    });

    // 컴포넌트 언마운트 시 전역 함수 정리
    return () => {
      console.log('[전역 함수 정리] 컴포넌트 언마운트');
      delete (window as any).handleLocationDeleteFromInfoWindow;
      delete (window as any).closeInfoWindow;
    };
  }, [selectedMemberSavedLocations, otherMembersSavedLocations, infoWindow]);

  // 🚨 사이드바 업데이트 디버깅 로그 제거 (성능 최적화)

  // 뒤로가기 핸들러
  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  // 모달 열기 함수 수정
  const openModal = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info',
    onConfirmCallback?: () => void, // 콜백 파라미터 추가
    autoClose?: boolean // 자동 닫기 옵션 추가
  ) => {
    setModalContent({ title, message, type, onConfirm: onConfirmCallback });
    setIsModalOpen(true);

    // 자동 닫기 옵션이 true이고 onConfirm이 없는 경우 (단순 정보 모달)
    if (autoClose && !onConfirmCallback) {
      setTimeout(() => {
        closeModal();
      }, 3000);
    }
  };

  // 모달 닫기 함수
  const closeModal = () => {
    setIsModalOpen(false);
    // 모달이 닫힐 때 onConfirm 콜백이 남아있지 않도록 초기화 (선택적)
    // setModalContent(null); // 이렇게 하면 onConfirm도 null이 됨
  };

  // 컴팩트 토스트 모달 함수들
  const showToastModal = (
    type: 'success' | 'error' | 'loading',
    title: string,
    message: string,
    autoClose: boolean = true,
    duration: number = 3000
  ) => {
    setToastModal({
      isOpen: true,
      type,
      title,
      message,
      progress: 0,
      autoClose
    });

    if (autoClose && type !== 'loading') {
      // 프로그레스 바 애니메이션
      let progress = 0;
      const interval = setInterval(() => {
        progress += (100 / duration) * 50; // 50ms마다 업데이트
        if (progress >= 100) {
          clearInterval(interval);
          setToastModal(prev => ({ ...prev, isOpen: false }));
        } else {
          setToastModal(prev => ({ ...prev, progress }));
        }
      }, 50);
    }
  };

  const hideToastModal = () => {
    setToastModal(prev => ({ ...prev, isOpen: false }));
  };

  // 선택된 멤버 위치로 지도 중심 이동 함수
  const moveToSelectedMember = () => {
    const selectedMember = groupMembers.find(m => m.isSelected);
    if (selectedMember && map) {
      const lat = parseCoordinate(selectedMember?.mlt_lat) || parseCoordinate(selectedMember?.location?.lat);
      const lng = parseCoordinate(selectedMember?.mlt_long) || parseCoordinate(selectedMember?.location?.lng);

      if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
        const position = createSafeLatLng(lat, lng);
        if (!position) {
          console.warn('[moveToSelectedMember] LatLng 생성 실패');
          return;
        }
        map.setCenter(position);
        console.log('[지도 이동] 선택된 멤버 위치로 이동:', selectedMember?.name || '알 수 없음', { lat, lng });
      }
    }
  };

  // 알림 토글 핸들러 (바로 실행, 3초 후 자동 닫기)
  const handleNotificationToggle = async (location: LocationData | OtherMemberLocationRaw) => {
    try {
      const locationId = 'slt_idx' in location ? location.slt_idx?.toString() : location.id;
      const sltIdx = 'slt_idx' in location ? location.slt_idx : null;
      const locationName = 'slt_title' in location ? location.slt_title : location.name;

      // 현재 알림 상태 정확히 파악
      let currentNotificationStatus = false;
      if ('slt_enter_alarm' in location) {
        // OtherMemberLocationRaw 타입인 경우
        currentNotificationStatus = location.slt_enter_alarm === 'Y' || location.notifications === true;
      } else {
        // LocationData 타입인 경우
        currentNotificationStatus = location.notifications === true;
      }

      const newNotificationStatus = !currentNotificationStatus;

      console.log('[알림 토글] 시작:', {
        locationId,
        sltIdx,
        현재상태: currentNotificationStatus,
        새상태: newNotificationStatus,
        location타입: 'slt_enter_alarm' in location ? 'OtherMemberLocationRaw' : 'LocationData'
      });

      // DB 업데이트 (slt_idx가 있는 경우에만)
      if (sltIdx) {
        try {
          const sltIdxNumber = typeof sltIdx === 'string' ? parseInt(sltIdx, 10) : sltIdx;
          await locationService.updateLocationNotification(sltIdxNumber, newNotificationStatus);
          console.log('[알림 토글] DB 업데이트 성공:', sltIdxNumber, newNotificationStatus);
        } catch (dbError) {
          console.error('[알림 토글] DB 업데이트 실패:', dbError);
          openModal('알림 설정 실패', '알림 설정 저장에 실패했습니다.', 'error');
          return; // DB 업데이트 실패 시 UI 업데이트하지 않음
        }
      }

      // 1. 선택된 멤버의 장소 업데이트
      if (selectedMemberSavedLocations) {
        setSelectedMemberSavedLocations(prev =>
          prev ? prev.map(loc =>
            loc.id === locationId
              ? { ...loc, notifications: newNotificationStatus }
              : loc
          ) : null
        );
      }

      // 2. 다른 멤버 장소 데이터 업데이트 (중요: slt_enter_alarm과 notifications 둘 다 업데이트)
      if ('slt_idx' in location && location.slt_idx) {
        setOtherMembersSavedLocations(prev => {
          const updated = prev.map(loc =>
            loc.slt_idx === location.slt_idx
              ? {
                ...loc,
                slt_enter_alarm: newNotificationStatus ? 'Y' : 'N',
                notifications: newNotificationStatus
              }
              : loc
          );
          console.log('[알림 토글] otherMembersSavedLocations 업데이트:', {
            대상_slt_idx: location.slt_idx,
            업데이트된_장소_수: updated.filter(loc => loc.slt_idx === location.slt_idx).length,
            새로운_알림상태: newNotificationStatus
          });
          return updated;
        });
      }

      // 3. 그룹멤버 상태 업데이트
      setGroupMembers(prevMembers => prevMembers.map(member => ({
        ...member,
        savedLocations: member.savedLocations.map(loc =>
          loc.id === locationId
            ? { ...loc, notifications: newNotificationStatus }
            : loc
        )
      })));

      // 4. 정보창이 열려있고 현재 선택된 장소라면 패널도 업데이트
      if (isLocationInfoPanelOpen && newLocation.id === locationId) {
        setNewLocation(prev => ({ ...prev, notifications: newNotificationStatus }));
      }

      console.log('[알림 토글] 완료:', {
        locationId,
        새상태: newNotificationStatus,
        상태업데이트완료: true
      });

      // 알림 설정 완료 모달 (3초 후 자동 닫기)
      openModal('알림 설정 완료', `'${locationName}' 장소의 알림이 ${newNotificationStatus ? '켜졌습니다' : '꺼졌습니다'}.`, 'success', undefined, true);

    } catch (error) {
      console.error('알림 토글 실패:', error);
      openModal('알림 설정 실패', '알림 설정 중 오류가 발생했습니다.', 'error');
    }
  };

  // 장소 숨김 처리 핸들러 (DB 업데이트 포함)
  const handleHideLocation = async (location: LocationData | OtherMemberLocationRaw) => {
    openLocationDeleteModal(location);
  };

  // 다른 멤버 장소 조회 헬퍼
  const getOtherMemberLocationById = (id: string, locations: OtherMemberLocationRaw[]) => {
    return locations.find(loc => loc.id === id || loc.slt_idx?.toString() === id);
  };

  // 패널 주소 검색 핸들러
  const handlePanelAddressSearch = async () => {
    if (!locationSearchQuery.trim()) return;

    setIsSearchingLocationForPanel(true);
    setLocationSearchModalCaller('panel');

    try {
      const response = await fetch(`/api/kakao-search?query=${encodeURIComponent(locationSearchQuery)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (data.documents && data.documents.length > 0) {
        const resultsWithIds = data.documents.map((doc: any, index: number) => ({
          ...doc,
          temp_id: `${doc.x}-${doc.y}-${index}`
        }));
        setLocationSearchResults(resultsWithIds);
      } else {
        setLocationSearchResults([]);
      }

    } catch (error) {
      console.error('주소 검색 실패:', error);
      openModal('주소 검색 실패', '주소 검색 중 오류가 발생했습니다.', 'error');
      setLocationSearchResults([]);
    } finally {
      setIsSearchingLocationForPanel(false);
    }
  };

  // 패널용 장소 선택 핸들러
  const handleSelectLocationForPanel = (place: any) => {
    const coordinates: [number, number] = [parseFloat(place.x), parseFloat(place.y)];

    console.log('[장소 검색 선택] 현재 newLocation 상태:', newLocation);
    console.log('[장소 검색 선택] 선택한 장소:', place);

    setNewLocation(prev => {
      const updated = {
        ...prev,
        name: place.place_name || '',
        address: place.road_address_name || place.address_name || '',
        coordinates
      };
      console.log('[장소 검색 선택] newLocation 업데이트:', { prev, updated });
      return updated;
    });

    setLocationSearchResults([]);
    setLocationSearchQuery('');
    setLocationSearchModalCaller(null);

    // 지도에 임시 마커 표시
    if (map && window.naver) {
      if (tempMarker.current) {
        tempMarker.current.setMap(null);
      }

      console.log('[패널 장소 선택] 임시 마커 생성:', coordinates);

      const position = createSafeLatLng(coordinates[1], coordinates[0]);
      if (!position) {
        console.warn('[handleSelectLocationForPanel] LatLng 생성 실패');
        return;
      }
      tempMarker.current = new window.naver.maps.Marker({
        position,
        map,
        icon: {
          content: `<div style="
            width: 24px;
            height: 24px;
            background: #ef4444;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            position: relative;
            z-index: 1000;
          "></div>`,
          anchor: new window.naver.maps.Point(12, 12)
        },
        zIndex: 1000
      });

      // 지도 중심을 해당 위치로 즉시 이동
      map.setCenter(position);

      // 줌 레벨 조정 (즉시)
      const currentZoom = map.getZoom();
      if (currentZoom < 15) {
        map.setZoom(16);
      }
    }
  };
  // 패널 액션 확인 핸들러
  const handleConfirmPanelAction = async () => {
    if (!newLocation.name.trim() || !newLocation.address.trim()) {
      openModal('입력 오류', '장소 이름과 주소를 입력해주세요.', 'error'); // toast -> openModal
      return;
    }

    setIsSavingLocationPanel(true);

    try {
      // 실제 장소 저장 API 호출
      console.log('[handleConfirmPanelAction] 장소 등록 API 호출 시작');
      console.log('[handleConfirmPanelAction] 등록할 장소 정보:', newLocation);

      // 현재 선택된 멤버 ID 가져오기
      const currentMemberId = selectedMemberIdRef.current;
      if (!currentMemberId) {
        openModal('멤버 선택 필요', '장소를 등록할 멤버를 먼저 선택해주세요.', 'error');
        return;
      }

      if (!selectedGroupId) {
        openModal('그룹 선택 필요', '장소를 등록할 그룹을 먼저 선택해주세요.', 'error');
        return;
      }

      if (!newLocation.coordinates || !newLocation.coordinates[0] || !newLocation.coordinates[1]) {
        openModal('위치 선택 필요', '지도에서 유효한 위치를 선택해주세요.', 'error');
        return;
      }

      const locationData = {
        slt_title: newLocation.name.trim(),
        slt_add: newLocation.address.trim(),
        slt_lat: newLocation.coordinates[1], // latitude
        slt_long: newLocation.coordinates[0], // longitude
        sgt_idx: selectedGroupId, // 선택된 그룹 ID
        sgdt_idx: selectedGroupId, // 그룹 상세 ID
        slt_show: 'Y',
        slt_enter_alarm: newLocation.notifications ? 'Y' : 'N',
        slt_enter_chk: 'N'
      };

      console.log('[handleConfirmPanelAction] 전송할 데이터:', locationData);
      console.log('[handleConfirmPanelAction] 선택된 멤버 ID:', currentMemberId);

      // 새 장소 데이터 생성 (즉시 UI 반영용)
      const newLocationForUI: LocationData = {
        id: `temp_${Date.now()}`, // 임시 ID
        name: newLocation.name.trim(),
        address: newLocation.address.trim(),
        coordinates: [newLocation.coordinates[0], newLocation.coordinates[1]],
        category: newLocation.category || '기타',
        memo: newLocation.memo || '',
        favorite: newLocation.favorite || false,
        notifications: newLocation.notifications
      };

      // 즉시 UI에 새 장소 추가 (낙관적 업데이트)
      console.log('[handleConfirmPanelAction] UI에 즉시 새 장소 추가:', newLocationForUI);

      // 1. 선택된 멤버의 장소 목록에 추가
      setSelectedMemberSavedLocations(prev =>
        prev ? [...prev, newLocationForUI] : [newLocationForUI]
      );

      // 2. 다른 멤버 장소 목록에도 추가 (원본 데이터 형식으로)
      const newLocationForOtherMembers: OtherMemberLocationRaw = {
        id: newLocationForUI.id,
        slt_idx: Date.now(), // 임시 숫자 ID
        name: newLocationForUI.name,
        slt_title: newLocationForUI.name,
        address: newLocationForUI.address,
        slt_add: newLocationForUI.address,
        coordinates: newLocationForUI.coordinates,
        slt_long: String(newLocationForUI.coordinates[0]),
        slt_lat: String(newLocationForUI.coordinates[1]),
        category: newLocationForUI.category,
        memo: newLocationForUI.memo,
        favorite: newLocationForUI.favorite,
        notifications: newLocationForUI.notifications,
        slt_enter_alarm: newLocationForUI.notifications ? 'Y' : 'N'
      };

      setOtherMembersSavedLocations(prev => [...prev, newLocationForOtherMembers]);

      // 3. 그룹멤버 상태에도 추가 (사이드바 목록과 개수 업데이트)
      setGroupMembers(prevMembers =>
        prevMembers.map(member => {
          if (member.id === currentMemberId) {
            const updatedSavedLocations = [...member.savedLocations, newLocationForUI];
            return {
              ...member,
              savedLocations: updatedSavedLocations,
              savedLocationCount: updatedSavedLocations.length
            };
          }
          return member;
        })
      );

      // 멤버별 장소 생성 서비스 사용 (백그라운드에서 실제 저장)
      try {
        const result = await locationService.createMemberLocation(
          parseInt(currentMemberId),
          locationData
        );
        console.log('[handleConfirmPanelAction] 멤버별 장소 생성 성공:', result);

        // 백엔드에서 실제 ID를 받았다면 UI 업데이트
        if (result.data && result.data.slt_idx) {
          const realId = result.data.slt_idx.toString();

          // 임시 ID를 실제 ID로 교체
          setSelectedMemberSavedLocations(prev =>
            prev ? prev.map(loc =>
              loc.id === newLocationForUI.id
                ? { ...loc, id: realId }
                : loc
            ) : null
          );

          setOtherMembersSavedLocations(prev =>
            prev.map(loc =>
              loc.id === newLocationForUI.id
                ? { ...loc, id: realId, slt_idx: result.data.slt_idx }
                : loc
            )
          );

          setGroupMembers(prevMembers =>
            prevMembers.map(member => {
              if (member.id === currentMemberId) {
                const updatedSavedLocations = member.savedLocations.map(loc =>
                  loc.id === newLocationForUI.id
                    ? { ...loc, id: realId }
                    : loc
                );
                return {
                  ...member,
                  savedLocations: updatedSavedLocations,
                  savedLocationCount: updatedSavedLocations.length
                };
              }
              return member;
            })
          );

          console.log('[handleConfirmPanelAction] 임시 ID를 실제 ID로 교체 완료:', realId);
        }

        showToastModal('success', '등록 완료', `"${newLocation.name}" 장소가 등록되었습니다.`);

        // 선택된 멤버 위치로 지도 이동
        setTimeout(() => {
          moveToSelectedMember();
        }, 500);

      } catch (error) {
        console.error('[handleConfirmPanelAction] 멤버별 장소 생성 에러:', error);

        // 백엔드 에러 발생 시 UI는 그대로 유지 (이미 추가되어 있음)
        console.log('[handleConfirmPanelAction] 백엔드 에러 발생했지만 UI는 이미 업데이트됨');
        showToastModal('success', '등록 완료', `"${newLocation.name}" 장소가 등록되었습니다.`);

        // 선택된 멤버 위치로 지도 이동
        setTimeout(() => {
          moveToSelectedMember();
        }, 500);
      }

      setIsLocationInfoPanelOpen(false);

      // 임시 마커를 실제 장소 마커로 교체
      if (tempMarker.current) {
        tempMarker.current.setMap(null);
        tempMarker.current = null;
      }

      // 상태 초기화
      setNewLocation({
        name: '',
        address: '',
        coordinates: [0, 0],
        category: '기타',
        memo: '',
        favorite: false,
        notifications: true
      });

      // 지도 마커 즉시 업데이트 (새로 추가된 장소 포함)
      console.log('[handleConfirmPanelAction] 지도 마커 즉시 업데이트');

      // 약간의 지연 후 마커 업데이트 (상태 업데이트 완료 후)
      setTimeout(() => {
        // selectedMemberSavedLocations가 업데이트되면 useEffect에 의해 자동으로 마커 업데이트됨
        console.log('[handleConfirmPanelAction] 마커 자동 업데이트 대기 중...');
      }, 100);
    } catch (error) {
      console.error('[handleConfirmPanelAction] 장소 등록 오류:', error);
      showToastModal('success', '등록 완료', `"${newLocation.name}" 장소가 등록되었습니다.`);

      // 선택된 멤버 위치로 지도 이동
      setTimeout(() => {
        moveToSelectedMember();
      }, 500);

      setIsLocationInfoPanelOpen(false);
      if (tempMarker.current) {
        tempMarker.current.setMap(null);
        tempMarker.current = null;
      }

      // 상태 초기화
      setNewLocation({
        name: '',
        address: '',
        coordinates: [0, 0],
        category: '기타',
        memo: '',
        favorite: false,
        notifications: true
      });

      // 에러 발생 시에도 마커 업데이트는 useEffect의 updateAllMarkers에서 자동으로 처리됨
      console.log('[handleConfirmPanelAction] 에러 후 마커 업데이트는 useEffect에서 자동 처리됨');
    } finally {
      setIsSavingLocationPanel(false);
    }
  };

  // 개선된 드래그 및 스와이프 핸들러들
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    setIsDragging(true);
    setDragStartY(clientY);
    setDragCurrentY(clientY); // 초기 Y 설정
    setSwipeStartX(clientX);
    setIsHorizontalSwipe(false); // 드래그 시작 시점에 방향 초기화 (아직 미정 상태)

    // 드래그 시작 시간 기록 (속도 계산용) - 더 정확한 시간 측정
    (e.target as any)._startedAt = performance.now();
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    const deltaX = clientX - swipeStartX; // x 이동량 (방향 포함)
    const deltaY = clientY - dragStartY; // y 이동량 (방향 포함)
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const directionThreshold = 8; // 방향 감지 최소 임계값 (더 민감하게)

    // 방향이 아직 결정되지 않았다면 결정 시도
    if (isHorizontalSwipe === false && absDeltaX > directionThreshold && absDeltaX > absDeltaY) {
      setIsHorizontalSwipe(true);
      console.log('[DragMove] 가로 스와이프 감지');
    } else if (isHorizontalSwipe === false && absDeltaY > directionThreshold && absDeltaY > absDeltaX) {
      setIsHorizontalSwipe(false); // 세로 드래그 감지 (false로 유지)
      console.log('[DragMove] 세로 드래그 감지');
    }

    // 세로 드래그인 경우에만 Y 좌표 업데이트 (바텀시트 위치 반영용)
    if (!isHorizontalSwipe) {
      setDragCurrentY(clientY);
    }
    // 가로 스와이프인 경우 swipeContainerRef의 scrollLeft는 touchAction에 의해 자동으로 업데이트됩니다.
    // 터치 동작 제어는 CSS touchAction 속성에 의존하여 passive listener 문제 해결
  };

  const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;

    setIsDragging(false);
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.changedTouches[0].clientY : e.clientY;

    const swipeDeltaX = clientX - swipeStartX; // 최종 X 이동량
    const dragDeltaY = clientY - dragStartY; // 최종 Y 이동량

    const swipeThresholdEnd = 60; // 스와이프 완료 임계값 (더 민감하게)
    const dragThresholdEnd = 15; // 드래그 완료 임계값 - 더욱 민감하게 조정
    const velocityThreshold = 0.2; // 속도 임계값 - 더욱 민감하게 조정

    // 최종 움직임 속도 계산 (더 정확한 계산)
    const startTime = (e.target as any)._startedAt || performance.now() - 200; // 기본값 설정
    const duration = performance.now() - startTime;
    const velocityX = duration > 0 ? Math.abs(swipeDeltaX) / duration : 0;
    const velocityY = duration > 0 ? Math.abs(dragDeltaY) / duration : 0;

    console.log('[DragEnd] isHorizontalSwipe:', isHorizontalSwipe, 'swipeDeltaX:', swipeDeltaX, 'dragDeltaY:', dragDeltaY, 'velocityX:', velocityX, 'velocityY:', velocityY);

    // 방향이 결정되었을 때만 해당 방향의 완료 로직 실행
    if (isHorizontalSwipe === true) {
      // 가로 스와이프 완료 처리
      console.log('[DragEnd] 가로 스와이프 처리');
      if (Math.abs(swipeDeltaX) > swipeThresholdEnd || velocityX > velocityThreshold) {
        if (swipeDeltaX > 0) {
          // 오른쪽 스와이프 → 첫 번째 뷰 (selectedMemberPlaces)
          console.log('[DragEnd] 오른쪽 스와이프 감지 -> selectedMemberPlaces');
          handleViewChange('selectedMemberPlaces');
        } else {
          // 왼쪽 스와이프 → 두 번째 뷰 (otherMembersPlaces)
          console.log('[DragEnd] 왼쪽 스와이프 감지 -> otherMembersPlaces');
          handleViewChange('otherMembersPlaces');
        }
        // 햅틱 피드백 (더 부드러운 진동)
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate([50, 10, 30]); // 패턴으로 더 부드러운 피드백
          }
        } catch (error) {
          console.debug('햅틱 피드백이 차단되었습니다:', error);
        }
      } else {
        // 임계값 미달 시 현재 뷰로 되돌림 (handleViewChange 내부에서 처리)
        console.log('[DragEnd] 가로 스와이프 임계값 미달 -> 현재 뷰 유지');
        handleViewChange(activeView); // 현재 뷰로 스크롤 위치 복원
      }
    } else { // 세로 드래그 완료 처리 (isHorizontalSwipe === false)
      console.log('[DragEnd] 세로 드래그 처리');
      const triggerHaptic = () => {
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate([20, 5, 15]); // 더 부드러운 햅틱 패턴
          }
        } catch (error) {
          // 햅틱 피드백이 차단되어도 조용히 무시
          console.debug('햅틱 피드백이 차단되었습니다:', error);
        }
      };

      // 바텀시트 제거로 인한 드래그 로직 간소화
      console.log('[DragEnd] 드래그 완료');
    }
    // _startedAt 초기화 (이벤트 객체에 직접 접근은 불안정할 수 있음)
    (e.target as any)._startedAt = 0; // 시작 시간 초기화
  };

  // 그룹 선택 핸들러
  // 그룹 선택 핸들러 - activelog/page.tsx 방식 적용
  const handleGroupSelect = useCallback(async (groupId: number) => {
    console.log('[handleGroupSelect] 그룹 선택:', groupId, '현재 선택된 그룹:', selectedGroupId);

    // 현재 선택된 그룹과 동일한 그룹을 선택한 경우 드롭다운만 닫기
    if (selectedGroupId === groupId) {
      console.log('[handleGroupSelect] 동일한 그룹 선택 - 드롭다운만 닫음');
      setIsGroupSelectorOpen(false);
      return;
    }

    console.log('[handleGroupSelect] 새로운 그룹 선택 - 데이터 초기화 및 새 그룹 로딩 시작');

    // 🚨 그룹 변경 시 멤버 마커는 보존하고 장소 마커만 제거 (멤버 마커 사라짐 문제 해결)
    console.log('[handleGroupSelect] 🚨 멤버 마커 보존 - 장소 마커만 제거');

    // 장소 마커도 안전하게 제거
    if (markers.length > 0) {
      markers.forEach((marker, index) => {
        try {
          if (marker && typeof marker.setMap === 'function' && marker.getMap()) {
            marker.setMap(null);
            console.log('[handleGroupSelect] 장소 마커 제거 성공:', index);
          }
        } catch (error) {
          console.warn('[handleGroupSelect] 장소 마커 제거 실패:', index, error);
        }
      });
    }
    setMarkers([]);

    // InfoWindow 안전하게 닫기
    try {
      if (infoWindow && typeof infoWindow.close === 'function') {
        infoWindow.close();
        setInfoWindow(null);
      }
    } catch (error) {
      console.warn('[handleGroupSelect] InfoWindow 닫기 실패:', error);
      setInfoWindow(null);
    }

    console.log('[handleGroupSelect] 그룹 변경으로 지도 초기화 완료');

    // 이전 그룹 캐시 무효화 (선택적)
    if (selectedGroupId) {
      console.log('[handleGroupSelect] 이전 그룹 캐시 무효화:', selectedGroupId);
    }

    // 먼저 그룹 ID 변경
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);

    // 기존 데이터 초기화
    setGroupMembers([]);
    setSelectedMemberSavedLocations(null);
    setOtherMembersSavedLocations([]);
    setFirstMemberSelected(false);
    setIsFirstMemberSelectionComplete(false);
    selectedMemberIdRef.current = null;

    // 🚨 그룹 변경 시 인포윈도우 초기화 플래그 리셋 (새 그룹에서 인포윈도우가 제대로 생성되도록)
    initialMarkerSetupDoneRef.current = false;
    shouldAutoOpenInfoWindowRef.current = true;

    // 데이터 로딩 상태 초기화
    dataFetchedRef.current = {
      groups: dataFetchedRef.current.groups, // 그룹 데이터는 유지
      members: false,
      locations: false
    };

    // 선택된 장소 관련 상태도 초기화
    setSelectedLocationId(null);
    selectedLocationIdRef.current = null;

    console.log('[handleGroupSelect] 기존 데이터 초기화 완료, 새 그룹 데이터 로딩 시작');

    // 🚨 중복 호출 방지: useEffect에서 자동으로 처리되므로 직접 호출 제거
    console.log('[handleGroupSelect] 그룹 변경 완료 - useEffect에서 자동으로 데이터 로딩됨');
  }, [selectedGroupId]); // 🚨 중복 호출 방지: 불필요한 의존성 제거

  const fetchGroupMembersData = async (groupId?: number) => {
    const targetGroupId = groupId || selectedGroupId;
    if (!targetGroupId) {
      console.error('[fetchGroupMembersData] 선택된 그룹이 없습니다.');
      return;
    }

    // 🚨 중복 호출 방지: 이미 해당 그룹 데이터를 가져오는 중이면 중단
    if (isFetchingGroupMembers) {
      console.warn('[fetchGroupMembersData] 이미 그룹 데이터를 가져오는 중입니다. 중복 호출 방지.');
      return;
    }

    // 🚨 중복 호출 방지: 이미 해당 그룹 데이터가 있으면 중단 (그룹 변경이 아닌 경우)
    if (dataFetchedRef.current.members && groupMembers.length > 0 && !groupId) {
      console.warn('[fetchGroupMembersData] 이미 멤버 데이터가 있습니다. 중복 호출 방지.');
      return;
    }

    setIsFetchingGroupMembers(true);
    setIsFirstMemberSelectionComplete(false);

    try {
      console.log('[fetchGroupMembersData] 시작, 그룹ID:', targetGroupId);
      const membersData = await retryDataFetch(
        () => memberService.getGroupMembers(targetGroupId.toString()),
        'LOCATION_GROUP_MEMBERS'
      );
      console.log('[fetchGroupMembersData] 멤버 데이터 조회 완료:', membersData);

      if (membersData && membersData.length > 0) {
        // 장소 개수는 나중에 필요시에만 로딩 (초기 로딩 속도 개선)
        const memberLocationCounts: { [key: string]: number } = {};

        // 첫 번째 멤버만 즉시 로딩, 나머지는 백그라운드에서 처리
        console.log('[fetchGroupMembersData] 첫 번째 멤버만 우선 로딩으로 속도 개선');

        // 데이터 즉시 처리 (장소 개수는 나중에 로딩)
        const convertedMembers = membersData.map((member: any, index: number) => {
          // 현재 로그인한 사용자인지 확인
          const isCurrentUser = !!(user && member.mt_idx === user.mt_idx);
          const memberId = member.mt_idx.toString();

          return {
            id: memberId,
            name: member.mt_name || member.mt_nickname || '이름 없음',
            photo: member.mt_file1,
            mt_file1: member.mt_file1,
            isSelected: index === 0, // 첫 번째 멤버를 선택
            location: {
              lat: parseFloat(String(member.mlt_lat || '37.5665')) || 37.5665,
              lng: parseFloat(String(member.mlt_long || '126.9780')) || 126.9780
            },
            schedules: [],
            savedLocations: [], // 나중에 선택할 때 로드
            savedLocationCount: 0, // 초기값 0으로 설정, 나중에 로딩
            mt_gender: member.mt_gender,
            original_index: index,
            mlt_lat: member.mlt_lat,
            mlt_long: member.mlt_long,
            mlt_speed: member.mlt_speed,
            mlt_battery: member.mlt_battery,
            mlt_gps_time: member.mlt_gps_time,
            sgdt_owner_chk: member.sgdt_owner_chk,
            sgdt_leader_chk: member.sgdt_leader_chk,
          };
        });

        // 현재 로그인한 사용자가 선택되지 않은 경우 첫 번째 멤버 선택
        const hasSelectedUser = convertedMembers.some(member => member.isSelected);
        if (!hasSelectedUser && convertedMembers.length > 0) {
          convertedMembers[0].isSelected = true;
        }

        // selectedMemberIdRef 업데이트 - 선택된 멤버의 ID로 설정
        const selectedMember = convertedMembers.find(member => member.isSelected);
        if (selectedMember) {
          selectedMemberIdRef.current = selectedMember?.id || convertedMembers[0]?.id;
        } else if (convertedMembers.length > 0) {
          selectedMemberIdRef.current = convertedMembers[0]?.id;
        }

        setGroupMembers(convertedMembers);
        console.log('[fetchGroupMembersData] 그룹멤버 설정 완료:', convertedMembers.length, '명');

        // 멤버 데이터 로딩 완료 표시
        dataFetchedRef.current.members = true;

        // 첫 번째 멤버의 장소 데이터만 즉시 로드하고, 나머지는 백그라운드에서 처리
        if (convertedMembers.length > 0) {
          const firstMember = convertedMembers[0];
          console.log('[fetchGroupMembersData] 첫 번째 멤버 장소 데이터 우선 로드 시작:', firstMember.name);

          // 첫 번째 멤버 장소 데이터 로드
          (async () => {
            try {
              setIsLoadingOtherLocations(true);
              const memberLocationsRaw = await retryDataFetch(
                () => locationService.getOtherMembersLocations(firstMember.id),
                'FIRST_MEMBER_LOCATIONS'
              );
              console.log("[fetchGroupMembersData] 첫 번째 멤버 장소 조회 완료:", memberLocationsRaw.length, '개');

              // LocationData 형식으로 변환
              const convertedLocations = memberLocationsRaw.map(loc => ({
                id: loc.slt_idx ? loc.slt_idx.toString() : Date.now().toString(),
                name: loc.name || loc.slt_title || '제목 없음',
                address: loc.address || loc.slt_add || '주소 정보 없음',
                coordinates: [
                  parseFloat(String(loc.slt_long || '0')) || 0,
                  parseFloat(String(loc.slt_lat || '0')) || 0
                ] as [number, number],
                category: loc.category || '기타',
                memo: loc.memo || '',
                favorite: loc.favorite || false,
                notifications: loc.notifications !== undefined ? loc.notifications : ((loc as any).slt_enter_alarm === 'Y' || (loc as any).slt_enter_alarm === undefined)
              }));

              // 상태 업데이트
              setSelectedMemberSavedLocations(convertedLocations);
              setOtherMembersSavedLocations(memberLocationsRaw);
              setActiveView('selectedMemberPlaces');

              // 첫 번째 멤버의 장소 개수 업데이트 (다른 멤버 데이터 보존)
              setGroupMembers(prevMembers =>
                prevMembers.map((member, index) =>
                  index === 0
                    ? { ...member, savedLocations: convertedLocations, savedLocationCount: convertedLocations.length }
                    : {
                      ...member,
                      savedLocations: member.savedLocations,
                      savedLocationCount: member.savedLocationCount
                    }
                )
              );

            } catch (error) {
              console.error('[fetchGroupMembersData] 첫 번째 멤버 장소 로드 실패:', error);
              setSelectedMemberSavedLocations([]);
              setOtherMembersSavedLocations([]);
            } finally {
              setIsLoadingOtherLocations(false);
              // 첫 번째 멤버 로딩 완료 햅틱 피드백
              hapticFeedback.dataLoadComplete();
            }
          })();

          // 나머지 멤버들의 장소 개수를 백그라운드에서 로딩 (UI 블로킹 없이)
          if (convertedMembers.length > 1) {
            console.log('[fetchGroupMembersData] 나머지 멤버 장소 개수 백그라운드 로딩 시작');
            setTimeout(async () => {
              const remainingMembers = convertedMembers.slice(1);

              // 3개씩 배치로 나누어 처리 (과도한 동시 요청 방지)
              const batchSize = 3;
              for (let i = 0; i < remainingMembers.length; i += batchSize) {
                const batch = remainingMembers.slice(i, i + batchSize);

                await Promise.all(
                  batch.map(async (member, batchIndex) => {
                    try {
                      const memberLocations = await locationService.getOtherMembersLocations(member.id);
                      const actualIndex = i + batchIndex + 1; // +1은 첫 번째 멤버 제외

                      // 장소 개수만 업데이트 (기존 데이터 보존)
                      setGroupMembers(prevMembers =>
                        prevMembers.map((prevMember, index) =>
                          index === actualIndex
                            ? { ...prevMember, savedLocationCount: memberLocations.length }
                            : {
                              ...prevMember,
                              savedLocations: prevMember.savedLocations,
                              savedLocationCount: prevMember.savedLocationCount
                            }
                        )
                      );

                      console.log(`[백그라운드] ${member.name}의 장소 개수:`, memberLocations.length);
                    } catch (error) {
                      console.error(`[백그라운드] ${member.name}의 장소 개수 로딩 실패:`, error);
                    }
                  })
                );

                // 배치 간 250ms 대기 (서버 부하 방지)
                if (i + batchSize < remainingMembers.length) {
                  await new Promise(resolve => setTimeout(resolve, 250));
                }
              }

              console.log('[fetchGroupMembersData] 백그라운드 장소 개수 로딩 완료');
            }, 500); // 초기 로딩 완료 후 500ms 대기
          }
        }

        setIsFirstMemberSelectionComplete(true);
        setIsFetchingGroupMembers(false);
        setIsLoading(false);

        // 첫번째 멤버 자동 선택 완료 (InfoWindow도 표시)
        if (convertedMembers.length > 0) {
          const firstSelectedMember = convertedMembers.find(m => m.isSelected) || convertedMembers[0];
          console.log('[fetchGroupMembersData] 첫번째 멤버 자동 선택 처리 완료:', firstSelectedMember.name, '- 장소 데이터 미리 로드');

          // 🚨 첫 번째 멤버의 장소 데이터 미리 로드하여 마커 표시 보장
          (async () => {
            try {
              console.log('[fetchGroupMembersData] 첫 번째 멤버 장소 데이터 로드 시작:', firstSelectedMember.id);
              const memberLocationsRaw = await locationService.getOtherMembersLocations(firstSelectedMember.id);

              if (memberLocationsRaw && memberLocationsRaw.length > 0) {
                console.log('[fetchGroupMembersData] 첫 번째 멤버 장소 데이터 로드 완료:', memberLocationsRaw.length, '개');

                // LocationData 형식으로 변환
                const convertedLocations: LocationData[] = memberLocationsRaw.map(loc => ({
                  id: loc.slt_idx?.toString() || '',
                  name: loc.slt_title || '',
                  address: loc.slt_add || '',
                  coordinates: [
                    parseFloat(String(loc.slt_long || '0')) || 0,
                    parseFloat(String(loc.slt_lat || '0')) || 0
                  ] as [number, number],
                  notifications: loc.slt_enter_alarm === 'Y',
                  favorite: true, // 기본값
                  category: '', // 기본값
                  memo: '', // 기본값
                  slt_idx: loc.slt_idx,
                  slt_title: loc.slt_title || undefined,
                  slt_add: loc.slt_add || undefined,
                  slt_long: loc.slt_long || undefined,
                  slt_lat: loc.slt_lat || undefined,
                  slt_enter_alarm: loc.slt_enter_alarm
                }));

                // 🚨 핵심 수정: 현재 선택 상태를 보존하면서 장소 데이터만 업데이트
                // convertedMembers 대신 prevMembers를 사용하여 현재 isSelected 상태 유지
                setGroupMembers(prevMembers => {
                  // 현재 선택된 멤버 ID 확인
                  const currentSelectedId = prevMembers.find(m => m.isSelected)?.id || selectedMemberIdRef.current;

                  return prevMembers.map(member => {
                    if (member.id === firstSelectedMember.id) {
                      return {
                        ...member,
                        savedLocations: convertedLocations,
                        savedLocationCount: convertedLocations.length,
                        // 🚨 현재 선택 상태 유지 (덮어쓰지 않음)
                        isSelected: member.id === currentSelectedId
                      };
                    }
                    return {
                      ...member,
                      // 🚨 현재 선택 상태 유지
                      isSelected: member.id === currentSelectedId
                    };
                  });
                });
                setSelectedMemberSavedLocations(convertedLocations);

                console.log('[fetchGroupMembersData] 첫 번째 멤버 장소 데이터 상태 업데이트 완료 (선택 상태 보존)');

                // 🚨 handleMemberSelectCore 호출 시에도 현재 선택된 멤버 ID 확인
                // 첫 번째 멤버가 아직 선택되어 있을 경우에만 호출
                setTimeout(() => {
                  const currentSelectedMemberId = selectedMemberIdRef.current;
                  if (currentSelectedMemberId === firstSelectedMember.id) {
                    console.log('[fetchGroupMembersData] 첫 번째 멤버 handleMemberSelectCore 호출:', firstSelectedMember.name);
                    handleMemberSelectCore(firstSelectedMember.id, false, undefined, false, null, false);
                  } else {
                    console.log('[fetchGroupMembersData] 🚨 다른 멤버가 선택됨 - handleMemberSelectCore 호출 스킵:', currentSelectedMemberId);
                  }
                }, 300); // 상태 업데이트 완료를 위한 짧은 지연
              } else {
                console.log('[fetchGroupMembersData] 첫 번째 멤버에 장소 데이터 없음');
                // 🚨 장소 데이터가 없어도 현재 선택된 멤버 확인 후 호출
                setTimeout(() => {
                  const currentSelectedMemberId = selectedMemberIdRef.current;
                  if (currentSelectedMemberId === firstSelectedMember.id) {
                    handleMemberSelectCore(firstSelectedMember.id, false, undefined, false, null, false);
                  } else {
                    console.log('[fetchGroupMembersData] 🚨 다른 멤버가 선택됨 - 장소 없음 케이스 handleMemberSelectCore 호출 스킵');
                  }
                }, 300);
              }
            } catch (error) {
              console.error('[fetchGroupMembersData] 첫 번째 멤버 장소 데이터 로드 실패:', error);
              // 🚨 실패해도 현재 선택된 멤버 확인 후 호출
              setTimeout(() => {
                const currentSelectedMemberId = selectedMemberIdRef.current;
                if (currentSelectedMemberId === firstSelectedMember.id) {
                  handleMemberSelectCore(firstSelectedMember.id, false, undefined, false, null, false);
                } else {
                  console.log('[fetchGroupMembersData] 🚨 다른 멤버가 선택됨 - 에러 케이스 handleMemberSelectCore 호출 스킵');
                }
              }, 300);
            }
          })();
        }
      } else {
        console.warn('[fetchGroupMembersData] 그룹멤버 데이터가 없거나 비어있습니다.');

        setGroupMembers([]);
        setIsFirstMemberSelectionComplete(true);
        setIsFetchingGroupMembers(false);
        setIsLoading(false);
        // 멤버 데이터가 없어도 로딩 완료로 표시
        dataFetchedRef.current.members = true;
      }
    } catch (error) {
      console.error('[fetchGroupMembersData] 오류:', error);
      openModal('조회 실패', '그룹 멤버 목록을 불러오는데 실패했습니다.', 'error');

      setGroupMembers([]);
      setIsFirstMemberSelectionComplete(true);
      setIsFetchingGroupMembers(false);
      setIsLoading(false);
      // 오류 발생해도 로딩 완료로 표시하여 무한 로딩 방지
      dataFetchedRef.current.members = true;
    }

    console.log('[fetchGroupMembersData] 완료');
  };
  // 멤버 선택 핸들러 (디바운스 적용)
  const handleMemberSelectCore = async (memberId: string, openLocationPanel = false, membersArray?: GroupMember[], fromMarkerClick = false, clickedMarker?: any, onlyShowInfoWindow = false) => {
    console.log('[handleMemberSelect] 멤버 선택:', memberId, '패널 열기:', openLocationPanel, '마커 클릭:', fromMarkerClick);

    // 🚨 동일 멤버 재선택 처리 개선
    // - 마커 클릭이 아닌 경우: 동일 멤버 재선택 시 동작 생략
    // - 마커 클릭인 경우: 장소 데이터가 없으면 강제 업데이트 진행
    if (selectedMemberIdRef.current === memberId) {
      // 마커 클릭인 경우에는 장소 마커/데이터 상태 확인
      if (fromMarkerClick) {
        const hasLocationMarkersRef = locationMarkersRef.current && locationMarkersRef.current.length > 0;
        const hasMarkersState = markers && markers.length > 0;
        const hasSavedLocations = selectedMemberSavedLocations && selectedMemberSavedLocations.length > 0;

        console.log('[handleMemberSelect] 동일 멤버 재선택 (마커 클릭) - 장소 상태 확인:', {
          hasLocationMarkersRef,
          hasMarkersState,
          hasSavedLocations,
          locationMarkersRefLength: locationMarkersRef.current?.length || 0,
          markersLength: markers?.length || 0,
          savedLocationsLength: selectedMemberSavedLocations?.length || 0
        });

        // 장소 마커가 있고 저장된 장소 데이터도 있으면 동작 생략
        if ((hasLocationMarkersRef || hasMarkersState) && hasSavedLocations) {
          console.log('[handleMemberSelect] 동일 멤버 재선택 (마커 클릭) - 장소 마커/데이터 있음, 동작 생략');
          return;
        } else {
          console.log('[handleMemberSelect] 동일 멤버 재선택 (마커 클릭) - 장소 마커/데이터 없음, 강제 업데이트 진행');
          // 장소 마커가 없으면 강제로 업데이트 진행 (return 하지 않음)
        }
      } else {
        console.log('[handleMemberSelect] 동일 멤버 재선택 - 동작 생략');
        return;
      }
    }

    // 즉시 햅틱 피드백 (사용자 응답성 개선)
    try {
      hapticFeedback.menuSelect();
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.debug('햅틱 피드백이 차단되었습니다:', error);
    }

    // membersArray가 제공되면 사용하고, 없으면 현재 상태의 groupMembers 사용
    const membersToSearch = membersArray || groupMembers;
    const newlySelectedMember = membersToSearch.find(member => member.id === memberId);

    if (!newlySelectedMember) {
      console.log('[handleMemberSelect] 멤버를 찾을 수 없습니다:', memberId, '검색 대상:', membersToSearch.length, '명');
      return;
    }

    // 위 가드에서 동일 멤버는 이미 반환되므로 이하 로직 진행

    // *** 마커 정리 로직 - 지도에서 마커 제거 (ref는 updateAllMarkers에서 관리) ***
    console.log('[handleMemberSelect] 🚨 이전 장소 마커 지도에서 제거 시작');

    // 1. 지도에서 장소 마커 제거 (ref는 비우지 않음 - updateAllMarkers에서 관리)
    if (locationMarkersRef.current && locationMarkersRef.current.length > 0) {
      const markersToRemove = [...locationMarkersRef.current]; // 복사본 생성
      markersToRemove.forEach((marker, idx) => {
        try {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
            console.log(`[handleMemberSelect] locationMarkersRef 마커 ${idx + 1} 지도에서 제거`);
          }
        } catch (e) {
          console.warn(`[handleMemberSelect] locationMarkersRef 마커 ${idx + 1} 제거 실패:`, e);
        }
      });
      // 🚨 ref는 여기서 비우지 않음 - updateAllMarkers에서 새 마커로 교체
    }

    // 2. markers 상태의 마커도 지도에서 제거
    if (markers && markers.length > 0) {
      markers.forEach((marker, idx) => {
        try {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
            console.log(`[handleMemberSelect] markers 상태 마커 ${idx + 1} 지도에서 제거`);
          }
        } catch (e) {
          console.warn(`[handleMemberSelect] markers 상태 마커 ${idx + 1} 제거 실패:`, e);
        }
      });
    }

    console.log('[handleMemberSelect] 🚨 이전 장소 마커 지도에서 제거 완료');

    // 3. InfoWindow 정리 (마커 클릭이 아닌 경우에만 - 마커 클릭 시에는 createMemberInfoWindow에서 처리)
    if (!fromMarkerClick) {
      try {
        if (infoWindow) {
          infoWindow.close();
          setInfoWindow(null);
        }
      } catch (e) {
        console.warn('[handleMemberSelect] InfoWindow 정리 실패:', e);
      }
    } else {
      console.log('[handleMemberSelect] 마커 클릭 - InfoWindow 정리 건너뜀 (createMemberInfoWindow에서 처리)');
    }

    // 하드 리셋 실행 (추가 정리)
    hardResetMapOverlays('[handleMemberSelect] 멤버 변경 (추가 정리)');
    console.log('[handleMemberSelect] 🚨 모든 마커 정리 완료 - 마커 클릭:', fromMarkerClick, '사이드바 선택:', !fromMarkerClick);

    // 선택 버전 증가 (이후 비동기 처리에서 최신 선택만 유효하도록)
    selectionVersionRef.current += 1;
    const currentSelectionVersion = selectionVersionRef.current;

    // 2. 선택된 장소 관련 상태 초기화 (다른 멤버 선택 시에만)
    const currentlySelectedMember = groupMembers.find(m => m.isSelected);
    const isSelectingSameMember = currentlySelectedMember?.id === memberId;

    if (!isSelectingSameMember) {
      console.log('[handleMemberSelect] 다른 멤버 선택 - 선택된 장소 및 장소 데이터 초기화');
      setSelectedLocationId(null);
      selectedLocationIdRef.current = null;
      // 🚨 다른 멤버 선택 시 이전 멤버 장소 데이터 초기화 (새 멤버 장소 마커 즉시 로드를 위해)
      setSelectedMemberSavedLocations(null);
      setOtherMembersSavedLocations([]);
    } else {
      console.log('[handleMemberSelect] 같은 멤버 재선택 - 장소 상태 유지');
    }

    selectedMemberIdRef.current = memberId;
    // 🚨 마커 클릭과 사이드바 선택 모두 자동 InfoWindow 허용
    shouldAutoOpenInfoWindowRef.current = true;

    // 🚨 멤버 선택 시 다른 멤버 데이터를 절대 건드리지 않음
    console.log('[handleMemberSelect] 🔍 멤버 선택 전 현재 상태:',
      groupMembers.map(m => ({
        name: m.name,
        count: m.savedLocationCount,
        isSelected: m.isSelected,
        hasLocations: !!m.savedLocations?.length
      }))
    );

    // 선택 상태만 변경하고 기존 데이터는 절대 건드리지 않음
    console.log('[handleMemberSelect] 🔍 멤버 선택 - 다른 멤버 데이터는 절대 건드리지 않음');

    // 🚨 핵심 수정: 선택 상태만 업데이트 (다른 멤버 데이터는 절대 건드리지 않음)
    setGroupMembers(prevMembers =>
      prevMembers.map(member => ({
        ...member,
        isSelected: member.id === memberId
        // 🚨 savedLocations와 savedLocationCount는 절대 건드리지 않음!
      }))
    );
    console.log('[handleMemberSelect] 선택 상태 업데이트 완료:', memberId);

    // 🚨 디버깅: 지도 이동 조건 확인
    console.log('[handleMemberSelect] 🚨 지도 이동 조건 확인 (await 이전):', {
      hasMap: !!map,
      hasNaverMaps: !!window.naver?.maps,
      fromMarkerClick,
      willExecute: !!(map && window.naver?.maps && !fromMarkerClick)
    });

    // 🚨 핵심 수정: 지도 이동 및 InfoWindow를 await 이전에 즉시 실행 (컴포넌트 리렌더링 전)
    if (map && window.naver?.maps && !fromMarkerClick) {
      console.log('[handleMemberSelect] 🚨 지도 이동 및 InfoWindow 즉시 실행 (await 이전)');

      // 좌표 파싱 및 검증 - 실시간 위치(mlt_lat, mlt_long) 우선 사용
      const lat = parseCoordinate(newlySelectedMember?.mlt_lat) || parseCoordinate(newlySelectedMember?.location?.lat);
      const lng = parseCoordinate(newlySelectedMember?.mlt_long) || parseCoordinate(newlySelectedMember?.location?.lng);

      console.log('[handleMemberSelect] 좌표 파싱 결과:', { lat, lng, memberName: newlySelectedMember?.name });

      // 지도 이동
      let targetLat: number = 37.5665; // 기본값
      let targetLng: number = 126.9780;

      if (lat !== null && lng !== null && lat !== 0 && lng !== 0 &&
        lat >= 33 && lat <= 43 && lng >= 124 && lng <= 132) {
        targetLat = lat;
        targetLng = lng;
      }

      const position = createSafeLatLng(targetLat, targetLng);
      if (position) {
        console.log('[handleMemberSelect] 🚨 지도 중심 이동 실행:', { targetLat, targetLng });
        map.setCenter(position);

        const currentZoom = map.getZoom();
        if (currentZoom < 14) {
          map.setZoom(15);
        }
      }

      // InfoWindow 생성 (마커가 지도에 표시될 때까지 대기)
      const createInfoWindowWhenReady = (retryCount: number = 0) => {
        const key = String(memberId);
        let selectedMarker = memberMarkers.find((marker: any) => marker.__key === key);

        if (!selectedMarker && memberMarkersRef.current?.length > 0) {
          selectedMarker = memberMarkersRef.current.find((marker: any) => marker.__key === key);
        }

        // 마커가 지도에 표시되었는지 확인
        const markerOnMap = selectedMarker && selectedMarker.getMap && selectedMarker.getMap() === map;

        if (selectedMarker && newlySelectedMember && markerOnMap) {
          console.log('[handleMemberSelect] 🚨 InfoWindow 생성 (마커 지도에 표시됨):', newlySelectedMember.name);
          createMemberInfoWindow(newlySelectedMember, selectedMarker);
        } else if (retryCount < 5) {
          // 마커가 아직 지도에 표시되지 않았으면 재시도 (최대 5회, 총 1.5초)
          console.log('[handleMemberSelect] 🚨 마커 지도 표시 대기 중 - 재시도:', retryCount + 1, { hasMarker: !!selectedMarker, markerOnMap });
          setTimeout(() => createInfoWindowWhenReady(retryCount + 1), 300);
        } else if (selectedMarker && newlySelectedMember) {
          // 5회 재시도 후에도 지도에 없으면 그냥 생성 (기본 위치에 표시될 수 있음)
          console.log('[handleMemberSelect] 🚨 InfoWindow 강제 생성 (재시도 초과):', newlySelectedMember.name);
          createMemberInfoWindow(newlySelectedMember, selectedMarker);
        }
      };

      // 500ms 후 시작 (마커 생성 완료 대기)
      setTimeout(() => createInfoWindowWhenReady(0), 500);
    }

    // 🚨 멤버 선택 상태 변경 후 마커 색상 업데이트
    setTimeout(() => {
      if (memberMarkers.length > 0) {
        console.log('[handleMemberSelect] 🚨 멤버 마커 색상 업데이트 실행');
        // 멤버 마커 색상 업데이트 함수 호출
        memberMarkers.forEach((marker, index) => {
          try {
            // 🚨 마커의 __key를 사용하여 정확한 멤버 찾기
            const markerKey = (marker as any).__key;
            if (!markerKey) {
              console.warn(`[handleMemberSelect] 🚨 마커 ${index}에 __key가 없음`);
              return;
            }

            // 🚨 __key를 사용하여 groupMembers에서 해당 멤버 찾기
            const member = groupMembers.find(m => String(m.id) === markerKey || String(m.name) === markerKey);
            if (!member) {
              console.warn(`[handleMemberSelect] 🚨 마커 ${index}에 해당하는 멤버를 찾을 수 없음: ${markerKey}`);
              return;
            }

            const borderColor = member.id === memberId ? '#ef4444' : '#3b82f6'; // 선택된 멤버는 빨간색, 나머지는 파란색
            const photoForMarker = getSafeImageUrl(member.mt_file1, member.mt_gender, member.original_index);

            console.log(`[handleMemberSelect] 🚨 마커 ${index} 색상 업데이트: ${member.name} (선택됨: ${member.id === memberId}, 색상: ${borderColor === '#ef4444' ? '빨간색' : '파란색'})`);

            const updatedIconContent = `
              <div style="position: relative; text-align: center;">
                <div style="width: 28px; height: 28px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                  <img 
                    src="${photoForMarker}" 
                    alt="${member.name}" 
                    style="width: 100%; height: 100%; object-fit: cover;" 
                    onerror="this.src='/images/avatar1.png'"
                  />
                </div>
                <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; white-space: nowrap; font-size: 10px; font-weight: 500;">
                  ${member.name}
                </div>
              </div>
            `;

            marker.setIcon({
              content: updatedIconContent,
              size: new window.naver.maps.Size(60, 50),
              anchor: new window.naver.maps.Point(30, 32)
            });

            // z-index도 업데이트
            marker.setZIndex(member.id === memberId ? 200 : 150);

            console.log(`[handleMemberSelect] 🚨 멤버 마커 색상 업데이트 완료: ${member.name} (${member.id === memberId ? '빨간색' : '파란색'})`);
          } catch (error) {
            console.warn(`[handleMemberSelect] 🚨 멤버 마커 ${index} 색상 업데이트 실패:`, error);
          }
        });
      }
    }, 100); // 상태 업데이트 후 약간의 지연을 두고 실행

    // 선택된 멤버의 장소 데이터 로드
    const loadSelectedMemberLocations = async () => {
      try {
        console.log('[handleMemberSelect] 선택된 멤버 장소 데이터 로드 시작:', newlySelectedMember?.name || '알 수 없음');

        const memberLocationsRaw = await locationService.getOtherMembersLocations(memberId);
        if (selectionVersionRef.current !== currentSelectionVersion) {
          console.log('[handleMemberSelect] 선택 버전 불일치 - 오래된 요청 결과 폐기');
          return;
        }
        console.log('[handleMemberSelect] 멤버 장소 데이터 로드 완료:', {
          멤버ID: memberId,
          원본데이터수: memberLocationsRaw.length
        });

        // LocationData 형식으로 변환
        const convertedLocations = memberLocationsRaw.map(loc => ({
          id: loc.slt_idx ? loc.slt_idx.toString() : Date.now().toString(),
          name: loc.name || loc.slt_title || '제목 없음',
          address: loc.address || loc.slt_add || '주소 정보 없음',
          coordinates: [
            parseFloat(String(loc.slt_long || '0')) || 0,
            parseFloat(String(loc.slt_lat || '0')) || 0
          ] as [number, number],
          category: loc.category || '기타',
          memo: loc.memo || '',
          favorite: loc.favorite || false,
          notifications: loc.notifications !== undefined ? loc.notifications : ((loc as any).slt_enter_alarm === 'Y' || (loc as any).slt_enter_alarm === undefined)
        }));

        // 상태 업데이트 - 선택된 멤버의 장소만 설정
        setSelectedMemberSavedLocations(convertedLocations);
        setActiveView('selectedMemberPlaces');

        // 🚨 핵심 수정: 선택된 멤버의 장소 데이터만 업데이트 (다른 멤버는 절대 건드리지 않음)
        setGroupMembers(prevMembers => {
          const updatedMembers = prevMembers.map(member => {
            if (member.id === memberId) {
              // 선택된 멤버만 장소 데이터 업데이트
              return {
                ...member,
                savedLocations: convertedLocations,
                savedLocationCount: convertedLocations.length
              };
            } else {
              // 🚨 다른 멤버는 기존 데이터를 절대 건드리지 않음 (0으로 초기화하지 않음!)
              return {
                ...member,
                // 🚨 savedLocations와 savedLocationCount는 절대 건드리지 않음!
                savedLocations: member.savedLocations,
                savedLocationCount: member.savedLocationCount
              };
            }
          });

          // 🚨 검증: 다른 멤버의 데이터가 보존되었는지 확인
          console.log('[handleMemberSelect] 🚨 다른 멤버 데이터 보존 확인:',
            updatedMembers
              .filter(m => m.id !== memberId)
              .map(m => ({
                name: m.name,
                count: m.savedLocationCount,
                hasLocations: !!m.savedLocations?.length
              }))
          );

          return updatedMembers;
        });

        // 🚨 상태 업데이트 후 실제 확인
        console.log('[handleMemberSelect] 📊 선택된 멤버 장소 데이터 업데이트 완료:', {
          선택된멤버: newlySelectedMember?.name,
          장소개수: convertedLocations.length
        });

        // 🚨 장소 데이터 업데이트 완료
        console.log('[handleMemberSelect] 🚨 선택된 멤버 장소 데이터 업데이트 완료');

        // 🚨 즉시 마커 업데이트 실행 (useEffect 대기하지 않음)
        console.log('[handleMemberSelect] 🚨 즉시 마커 업데이트 실행');

        // 🚨 새로운 간단한 마커 관리 로직 사용
        if (map && isMapReady && newlySelectedMember) {
          console.log('[handleMemberSelect] 🚨 handleMemberChange 호출 - 새 마커 관리 로직');
          handleMemberChange(memberId, newlySelectedMember, convertedLocations || []);
        } else {
          console.warn('[handleMemberSelect] 🚨 마커 업데이트 조건 미충족:', {
            hasMap: !!map,
            isMapReady,
            hasNewMember: !!newlySelectedMember
          });
        }
      } catch (error) {
        console.error('[handleMemberSelect] 장소 데이터 로드 실패:', error);
        setSelectedMemberSavedLocations([]);
        setOtherMembersSavedLocations([]);
      }
    };

    // 장소 데이터 로드 실행
    await loadSelectedMemberLocations();

    // InfoWindow 즉시 생성 (사이드바 선택 시에만 - 마커 클릭 시에는 이미 생성됨)
    console.log('[handleMemberSelect] InfoWindow 생성 시작 (마커 클릭:', fromMarkerClick, ')');

    // 🚨 마커 클릭 시에는 이미 createMemberInfoWindow가 호출되었으므로 건너뜀
    if (!fromMarkerClick) {
      // 지도 이동 완료 후 InfoWindow 생성
      setTimeout(() => {
        openInfoWindowForSelectedMember();
        console.log('[handleMemberSelect] InfoWindow 생성 완료');
      }, 100); // 지도 이동 후 약간의 지연
    } else {
      console.log('[handleMemberSelect] 마커 클릭 - InfoWindow 이미 생성됨, openInfoWindowForSelectedMember 건너뜀');
    }

    // 🚨 디버깅: map 및 naver?.maps 상태 확인
    console.log('[handleMemberSelect] 🚨 지도 상태 확인:', {
      hasMap: !!map,
      hasNaverMaps: !!window.naver?.maps,
      mapInstance: map ? 'exists' : 'null'
    });

    if (map && window.naver?.maps) {
      // 🚨 디버깅: 지도 이동 조건 분석
      console.log('[handleMemberSelect] 🚨 지도 이동 조건 분석:', {
        fromMarkerClick,
        isLocationSelectingRef: isLocationSelectingRef.current,
        openLocationPanel,
        willMoveMap: !fromMarkerClick && !(isLocationSelectingRef.current && !openLocationPanel)
      });

      // 🚨 마커 클릭 시 지도 이동 없이 InfoWindow만 표시, 사이드바 선택 시 지도 이동 (사용자 요구사항)
      if (fromMarkerClick) {
        console.log('[handleMemberSelect] 마커 클릭 - 지도 이동 건너뜀, InfoWindow만 표시');
      } else if (isLocationSelectingRef.current && !openLocationPanel) {
        console.log('[handleMemberSelect] 지도 이동 건너뜀 - 장소 선택 중:', isLocationSelectingRef.current, '패널 열기:', openLocationPanel);
      } else {
        // 사이드바에서 멤버 선택 시에만 지도 중심 이동 (바텀시트에 가려지지 않도록 아래쪽으로 오프셋)
        console.log('[handleMemberSelect] 사이드바 멤버 선택 - 지도 중심 이동:', newlySelectedMember?.name || '알 수 없음', '위치 데이터:', {
          mlt_lat: newlySelectedMember?.mlt_lat,
          mlt_long: newlySelectedMember?.mlt_long,
          location: newlySelectedMember?.location
        });

        // 좌표 파싱 및 검증 - 실시간 위치(mlt_lat, mlt_long) 우선 사용
        const lat = parseCoordinate(newlySelectedMember?.mlt_lat) || parseCoordinate(newlySelectedMember?.location?.lat);
        const lng = parseCoordinate(newlySelectedMember?.mlt_long) || parseCoordinate(newlySelectedMember?.location?.lng);

        console.log('[handleMemberSelect] 좌표 파싱 결과:', {
          mlt_lat: newlySelectedMember?.mlt_lat,
          mlt_long: newlySelectedMember?.mlt_long,
          location: newlySelectedMember?.location,
          parsed: { lat, lng },
          isValid: lat !== null && lng !== null && lat !== 0 && lng !== 0 &&
            Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
            Math.abs(lat) >= 33 && Math.abs(lat) <= 43 && // 한국 위도 범위
            Math.abs(lng) >= 124 && Math.abs(lng) <= 132 // 한국 경도 범위
        });

        // 사이드바 멤버 선택 시에만 지도 이동
        if (map && window.naver?.maps) {
          // 좌표 검증 (유효한 좌표가 있으면 해당 위치로, 없으면 기본 위치로)
          let targetLat: number = 37.5665; // 기본값 설정
          let targetLng: number = 126.9780;

          if (lat !== null && lng !== null && lat !== 0 && lng !== 0 &&
            lat >= 33 && lat <= 43 && lng >= 124 && lng <= 132) {
            // 유효한 위치 데이터가 있으면 해당 위치로 설정
            targetLat = lat;
            targetLng = lng;
          } else {
            // 유효한 위치 데이터가 없으면 기본 위치(서울 중심)로 설정
            console.log('[handleMemberSelect] 유효한 위치 데이터 없음 - 기본 위치로 이동:', newlySelectedMember?.name);
          }

          const position = createSafeLatLng(targetLat, targetLng);
          if (!position) {
            console.warn('[handleMemberSelect] LatLng 생성 실패 - 지도 이동 건너뛰고 진행');
            // 🚨 return 제거 - 인포윈도우 생성은 계속 진행
          } else {

            console.log('[handleMemberSelect] 지도 중심 이동 실행 (사이드바 선택):', {
              member: newlySelectedMember?.name || '알 수 없음',
              originalPosition: { lat, lng },
              targetPosition: { lat: targetLat, lng: targetLng },
              mapInstance: !!map
            });

            // 즉시 지도 중심 이동 (애니메이션 없이 바로 이동)
            map.setCenter(position);

            // 적절한 줌 레벨 설정 (즉시)
            const currentZoom = map.getZoom();
            if (currentZoom < 14) {
              map.setZoom(15);
            }

            console.log('[handleMemberSelect] 지도 중심 이동 완료');

            // 사이드바는 유지하여 사용자가 장소 리스트를 볼 수 있도록 함
            // 멤버 선택 시 사이드바 자동 닫기 비활성화
            console.log('[handleMemberSelect] 사이드바 유지 - 장소 리스트 표시를 위해');
          } // 🚨 else 블록 닫기 (position 존재 시)
        }
      }

      // 기존 InfoWindow 처리 (마커 클릭인 경우 제외)
      if (infoWindow && !fromMarkerClick) {
        try {
          // 기존 InfoWindow가 장소 InfoWindow인 경우에만 닫기
          const infoWindowContent = infoWindow.getContent();
          const isMemberInfoWindow = infoWindowContent && infoWindowContent.includes('member-info-window-container');

          if (!isMemberInfoWindow) {
            infoWindow.close();
            console.log('[handleMemberSelect] 기존 장소 InfoWindow 닫기');
          } else {
            console.log('[handleMemberSelect] 기존 멤버 InfoWindow 유지');
          }
        } catch (error) {
          console.error('[handleMemberSelect] InfoWindow 처리 오류:', error);
        }
      } else if (fromMarkerClick) {
        console.log('[handleMemberSelect] 마커 클릭으로 인한 호출 - InfoWindow 닫지 않음');
      }

      // 멤버 InfoWindow 생성 및 표시 (사이드바 선택 시에만 생성)
      // 마커 클릭 시에는 createMemberInfoWindow에서 이미 InfoWindow가 생성되었으므로 건너뜀
      if (!onlyShowInfoWindow && !fromMarkerClick) {
        // 🚨 마커 찾기 및 InfoWindow 생성 함수 (재시도 지원)
        const findMarkerAndShowInfoWindow = (retryCount: number = 0) => {
          // 클릭된 마커가 전달되면 사용하고, 아니면 배열에서 찾기
          let selectedMarker = clickedMarker;
          let memberIndex = -1;

          // 클릭된 마커가 없을 경우에만 배열에서 찾기
          if (!selectedMarker) {
            const key = String(memberId);

            // 🚨 1. __key로 마커 찾기 (가장 정확)
            selectedMarker = memberMarkers.find((marker: any) => marker.__key === key);

            // 🚨 2. __key로 못 찾으면 인덱스로 시도
            if (!selectedMarker) {
              memberIndex = groupMembers.findIndex(m => m.id === memberId);
              if (memberIndex >= 0 && memberMarkers.length > memberIndex) {
                selectedMarker = memberMarkers[memberIndex];
              }
            }

            // 🚨 3. 그래도 못 찾으면 memberMarkersRef에서 시도
            if (!selectedMarker && memberMarkersRef.current?.length > 0) {
              selectedMarker = memberMarkersRef.current.find((marker: any) => marker.__key === key);
            }
          }

          console.log('[handleMemberSelect] 사이드바 멤버 선택 - createMemberInfoWindow 호출:', {
            memberName: newlySelectedMember?.name || '알 수 없음',
            hasClickedMarker: !!clickedMarker,
            hasSelectedMarker: !!selectedMarker,
            memberIndex,
            totalMarkers: memberMarkers.length,
            memberId,
            retryCount
          });

          // 마커가 있고 지도와 네이버 맵스가 로드되었을 때 createMemberInfoWindow 호출
          if (selectedMarker && map && window.naver?.maps && newlySelectedMember) {
            // 전체 정보가 있는 InfoWindow 생성 (이름, 업데이트 시간, 배터리 정보 포함)
            createMemberInfoWindow(newlySelectedMember, selectedMarker);
            console.log('[handleMemberSelect] 사이드바 멤버 선택 - createMemberInfoWindow로 InfoWindow 표시 완료:', newlySelectedMember?.name || '알 수 없음');
          } else if (retryCount < 3) {
            // 🚨 마커를 못 찾으면 재시도 (최대 3회)
            console.log('[handleMemberSelect] 사이드바 멤버 선택 - 마커 찾기 재시도 예정:', retryCount + 1);
            setTimeout(() => findMarkerAndShowInfoWindow(retryCount + 1), 300);
          } else {
            console.warn('[handleMemberSelect] 사이드바 멤버 선택 - 마커를 찾을 수 없음 (재시도 초과):', {
              memberIndex,
              hasSelectedMarker: !!selectedMarker,
              totalMarkers: memberMarkers.length,
              memberName: newlySelectedMember?.name || '알 수 없음'
            });
          }
        };

        // 🚨 마커 업데이트가 완료된 후 InfoWindow 생성하도록 약간의 지연 추가
        setTimeout(() => findMarkerAndShowInfoWindow(0), 300);

        console.log('[handleMemberSelect] 멤버 선택 완료 - InfoWindow 표시 예정');
      } else {
        const invalidCoords = {
          lat: parseCoordinate(newlySelectedMember?.mlt_lat) || parseCoordinate(newlySelectedMember?.location?.lat) || 0,
          lng: parseCoordinate(newlySelectedMember?.mlt_long) || parseCoordinate(newlySelectedMember?.location?.lng) || 0
        };
        console.warn('[handleMemberSelect] 유효하지 않은 좌표 또는 한국 범위 밖:', invalidCoords);
        // 사이드바는 닫기
        setTimeout(() => {
          setIsSidebarOpen(false);
        }, 100);
      }

      // 첫번째 멤버 선택 완료 상태 설정
      if (!isFirstMemberSelectionComplete) {
        setIsFirstMemberSelectionComplete(true);
        console.log('[handleMemberSelect] 첫번째 멤버 선택 완료');
      }

      // 멤버의 저장된 장소 처리
      if (newlySelectedMember?.savedLocations && newlySelectedMember.savedLocations.length > 0) {
        // 이미 로드된 장소가 있으면 바로 사용
        console.log('[handleMemberSelect] 이미 로드된 장소 사용:', newlySelectedMember.savedLocations.length, '개');

        // 먼저 상태 업데이트 (마커 업데이트를 위해)
        setSelectedMemberSavedLocations(newlySelectedMember.savedLocations);

        // 원본 데이터 형식으로 변환하여 otherMembersSavedLocations에도 설정
        const rawLocationsForOtherMembers = newlySelectedMember.savedLocations.map(loc => ({
          id: loc.id,
          slt_idx: parseInt(loc.id),
          name: loc.name,
          slt_title: loc.name,
          address: loc.address,
          slt_add: loc.address,
          coordinates: [loc.coordinates[0], loc.coordinates[1]] as [number, number],
          slt_long: String(loc.coordinates[0]),
          slt_lat: String(loc.coordinates[1]),
          category: loc.category,
          memo: loc.memo,
          favorite: loc.favorite,
          notifications: loc.notifications !== undefined ? loc.notifications : ((loc as any).slt_enter_alarm === 'Y' || (loc as any).slt_enter_alarm === undefined),
          slt_enter_alarm: loc.notifications ? 'Y' : 'N'
        }));
        setOtherMembersSavedLocations(rawLocationsForOtherMembers);

        // activeView 설정 - 멤버 장소 리스트 보여주기
        setActiveView('selectedMemberPlaces');

        // 상태 업데이트 후 마커 업데이트를 위한 지연 (React 상태 업데이트 보장)
        setTimeout(() => {
          console.log('[handleMemberSelect] 장소 데이터 로드 완료 후 마커 업데이트 실행');
          // 상태 업데이트가 완료되었으므로 마커 업데이트 실행
        }, 100);

      } else {
        // 저장된 장소가 없으면 API에서 조회
        console.log('[handleMemberSelect] API에서 장소 조회 시작:', newlySelectedMember?.name || '알 수 없음');
        setIsLoadingOtherLocations(true);

        try {
          const memberLocationsRaw = await locationService.getOtherMembersLocations(newlySelectedMember?.id || '');
          console.log("[handleMemberSelect] API에서 조회한 장소 (raw):", memberLocationsRaw);

          // LocationData 형식으로 변환
          const convertedLocations = memberLocationsRaw.map(loc => ({
            id: loc.slt_idx ? loc.slt_idx.toString() : Date.now().toString(),
            name: loc.name || loc.slt_title || '제목 없음',
            address: loc.address || loc.slt_add || '주소 정보 없음',
            coordinates: [
              parseFloat(String(loc.slt_long || '0')) || 0,
              parseFloat(String(loc.slt_lat || '0')) || 0
            ] as [number, number],
            category: loc.category || '기타',
            memo: loc.memo || '',
            favorite: loc.favorite || false,
            notifications: loc.notifications !== undefined ? loc.notifications : ((loc as any).slt_enter_alarm === 'Y' || (loc as any).slt_enter_alarm === undefined),
            slt_enter_alarm: loc.notifications ? 'Y' : 'N'
          }));

          console.log("[handleMemberSelect] 변환된 장소 데이터:", convertedLocations);

          // 상태 업데이트
          setSelectedMemberSavedLocations(convertedLocations);
          setOtherMembersSavedLocations(memberLocationsRaw);
          setActiveView('selectedMemberPlaces');

          // 그룹멤버 상태의 savedLocations와 savedLocationCount도 업데이트 (다음에는 API 호출 없이 사용하기 위해)
          setGroupMembers(prevMembers =>
            prevMembers.map(member =>
              member.id === memberId
                ? { ...member, savedLocations: convertedLocations, savedLocationCount: convertedLocations.length }
                : member
            )
          );

        } catch (error) {
          console.error("Failed to fetch selected member's locations in handleMemberSelect:", error);
          setSelectedMemberSavedLocations([]);
          setOtherMembersSavedLocations([]);
          setActiveView('selectedMemberPlaces');
        } finally {
          setIsLoadingOtherLocations(false);
          // 멤버별 위치 로딩 완료 햅틱 피드백
          hapticFeedback.dataLoadComplete();
        }
      }

      if (!openLocationPanel) {
        setIsLocationInfoPanelOpen(false);
        setIsEditingPanel(false);
        if (tempMarker.current) {
          tempMarker.current.setMap(null);
        }
      }

      console.log('[handleMemberSelect] 멤버 선택 및 데이터 로딩 완료:', newlySelectedMember?.name || '알 수 없음');
    }
  };

  // 🚨 멤버 선택 핸들러 - 즉시 실행 (디바운스 제거)
  const handleMemberSelect = (
    memberId: string,
    openLocationPanel = false,
    membersArray?: GroupMember[],
    fromMarkerClick = false,
    clickedMarker?: any,
    onlyShowInfoWindow = false
  ) => {
    console.log('[handleMemberSelect] 즉시 실행:', memberId, '패널 열기:', openLocationPanel, '마커 클릭:', fromMarkerClick);
    // 즉시 handleMemberSelectCore 호출
    handleMemberSelectCore(memberId, openLocationPanel, membersArray, fromMarkerClick, clickedMarker, onlyShowInfoWindow);
  };

  // 뷰 변경 핸들러 (자동 완성 스크롤)
  const handleViewChange = (view: 'selectedMemberPlaces' | 'otherMembersPlaces') => {
    console.log('[handleViewChange] 뷰 변경:', view);
    setActiveView(view);

    if (swipeContainerRef.current) {
      const container = swipeContainerRef.current;
      const targetScrollLeft = view === 'selectedMemberPlaces' ? 0 : container.scrollWidth / 2;

      // 부드러운 스크롤 애니메이션
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });

      // 햅틱 피드백
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      } catch (error) {
        console.debug('햅틱 피드백이 차단되었습니다:', error);
      }

      console.log('[handleViewChange] 스크롤 이동:', targetScrollLeft);
    }
  };

  // 모달 렌더러
  const renderModal = (content: React.ReactNode) => {
    return ReactDOM.createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={() => setIsAddModalOpen(false)}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </motion.div>,
      document.body
    );
  };

  // 초기 데이터 로딩 시뮬레이션 (home/page.tsx와 동일)
  useEffect(() => {
    // 1초 후 초기 데이터 로딩 완료
    const timer = setTimeout(() => {
      setIsInitialDataLoaded(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // 백업 타이머 - 5초 후 강제로 로딩 완료 (home/page.tsx와 동일)
  useEffect(() => {
    const backupTimer = setTimeout(() => {
      setIsMapLoading(false);
    }, 5000);

    return () => clearTimeout(backupTimer);
  }, []);

  // 네이버 지도 로드 (최적화)
  useEffect(() => {
    const loadNaverMaps = async () => {
      console.log('[네이버 지도 로드] 시작');

      if (window.naver && window.naver.maps) {
        console.log('[네이버 지도 로드] 이미 로드됨');
        setIsMapLoading(false);
        return;
      }

      // 프로덕션 환경에서는 서브모듈 최소화 (로딩 속도 최적화)
      const isProduction = window.location.hostname.includes('.aiagnt.kr');
      const isIOSWebView = typeof window !== 'undefined' &&
        window.webkit &&
        window.webkit.messageHandlers;

      // 보장 로더 우선 시도 (실패/타임아웃시 폴백)
      try {
        const { ensureNaverMapsLoaded } = await import('../../services/ensureNaverMaps');
        const submodules = (isIOSWebView || isProduction) ? 'geocoder' : 'geocoder,drawing,visualization';
        await ensureNaverMapsLoaded({ maxRetries: 6, initialDelayMs: 300, submodules });
        setIsMapLoading(false);
        return;
      } catch (e) {
        console.error('[LOCATION] 지도 로드 실패:', e);
        setMapLoadError(true);
        setIsMapLoading(false);
      }
    };

    setMapLoadError(false);
    setIsMapLoading(true);
    loadNaverMaps();
  }, [mapRetryCount]);

  // 지도 컨테이너 렌더링 확인
  useEffect(() => {
    if (mapContainer.current) {
      console.log('[지도 컨테이너] 렌더링 완료');
    }
  }, [mapContainer.current]);
  // 지도 초기화 (최적화 - 멤버 데이터가 있으면 즉시 초기화)
  useEffect(() => {
    console.log('[지도 초기화 조건 체크] (최적화)', {
      isMapLoading,
      hasMapContainer: !!mapContainer.current,
      hasNaverAPI: !!(window.naver && window.naver.maps),
      hasMap: !!map,
      hasGroupMembers: groupMembers.length > 0,
      isFetchingGroupMembers
    });

    // 그룹멤버 로딩이 완료되면 즉시 지도 초기화 (장소 데이터 로딩 대기 없이)
    if (!isMapLoading && mapContainer.current && window.naver && window.naver.maps && !map && groupMembers.length > 0 && !isFetchingGroupMembers) {
      console.log('[지도 초기화] 시작 - 첫 번째 그룹멤버 위치로 초기화');

      try {
        // 첫 번째 그룹 멤버 위치로 지도 초기화
        const firstMember = groupMembers[0];
        let initialCenter = createSafeLatLng(37.5665, 126.9780); // 기본값
        let initialZoom = 16;
        let foundMemberLocation = false;

        if (!initialCenter) {
          console.error('[지도 초기화] 기본 LatLng 생성 실패');
          return;
        }

        const lat = parseCoordinate(firstMember.mlt_lat) || parseCoordinate(firstMember.location?.lat);
        const lng = parseCoordinate(firstMember.mlt_long) || parseCoordinate(firstMember.location?.lng);

        console.log('[지도 초기화] 첫 번째 멤버 위치 확인:', {
          memberName: firstMember.name,
          lat,
          lng,
          hasValidCoords: lat !== null && lng !== null && lat !== 0 && lng !== 0
        });

        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          // 첫 번째 멤버 위치로 지도 중심 설정
          const memberCenter = createSafeLatLng(lat, lng);
          if (memberCenter) {
            initialCenter = memberCenter;
            initialZoom = 16;
            foundMemberLocation = true;
            console.log('[지도 초기화] 첫 번째 멤버 위치로 초기화:', firstMember.name, { lat, lng });
          }
        }

        if (!foundMemberLocation) {
          console.log('[지도 초기화] 멤버 위치를 찾을 수 없어 기본 위치로 초기화:', { lat: 37.5665, lng: 126.9780 });
        }

        // home, activelog 페이지와 동일한 MAP_CONFIG 사용으로 일관성 확보
        const mapOptions = {
          center: initialCenter,
          zoom: initialZoom,
          minZoom: 8,
          maxZoom: 18,
          mapTypeControl: false,
          scaleControl: false,
          logoControl: false,
          mapDataControl: false,
          zoomControl: false // 기본 줌 컨트롤 비활성화
        };

        const newMap = new window.naver.maps.Map(mapContainer.current, mapOptions);

        // 지도 초기화 완료 이벤트 리스너 추가
        window.naver.maps.Event.addListener(newMap, 'init', () => {
          console.log('[지도 초기화] ✅ 네이버 지도 초기화 완료 (최적화됨)');
          setIsMapInitialized(true);
          setIsMapReady(true);

          // 성능 로깅
          const endTime = performance.now();
          console.log(`[성능] 지도 로딩 완료 시간: ${endTime - (window as any).pageLoadStart || 0}ms`);
        });

        setMap(newMap);
        console.log('[지도 초기화] 완료 - 지도 준비됨');

        // 지도 클릭 이벤트
        window.naver.maps.Event.addListener(newMap, 'click', (e: any) => {
          // 🚨 마커 클릭 중이면 지도 클릭 이벤트 무시 (이벤트 버블링 방지)
          if (isMarkerClickingRef.current) {
            console.log('[지도 클릭] 마커 클릭 중 - 지도 클릭 이벤트 무시');
            return;
          }

          // 열려있는 InfoWindow가 있으면 닫기
          if (infoWindow) {
            console.log('[지도 클릭] InfoWindow 닫기');
            try {
              infoWindow.close();
              setInfoWindow(null);
              console.log('[지도 클릭] InfoWindow 닫기 성공');
            } catch (error) {
              console.error('[지도 클릭] InfoWindow 닫기 실패:', error);
              // 강제로 상태만 초기화
              setInfoWindow(null);
            }
          }

          const coord = e.coord;
          const coordinates: [number, number] = [coord.lng(), coord.lat()];

          console.log('[지도 클릭] 이벤트 발생:', { lat: coord.lat(), lng: coord.lng() });
          console.log('[지도 클릭] 현재 newLocation 상태:', newLocation);

          setClickedCoordinates(coordinates);

          // 임시 마커 표시 (상태 업데이트 전에)
          if (tempMarker.current) {
            tempMarker.current.setMap(null);
          }

          // newLocation 상태 업데이트 (강제로 새 객체 생성)
          const updatedLocation = {
            name: '', // 지도 클릭 시 장소 이름 초기화
            address: '주소 변환 중...',
            coordinates,
            category: newLocation.category,
            memo: newLocation.memo,
            favorite: newLocation.favorite,
            notifications: newLocation.notifications
          };

          console.log('[지도 클릭] newLocation 강제 업데이트:', { prev: newLocation, updated: updatedLocation });
          setNewLocation(updatedLocation);

          console.log('[지도 클릭] 임시 마커 생성 시작:', coord.lat(), coord.lng());

          tempMarker.current = new window.naver.maps.Marker({
            position: coord,
            map: newMap,
            icon: {
              content: `<div style="
                width: 24px;
                height: 24px;
                background: #ef4444;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                position: relative;
                z-index: 1000;
              "></div>`,
              anchor: new window.naver.maps.Point(12, 12)
            },
            zIndex: 1000
          });

          console.log('[지도 클릭] 임시 마커 생성 완료:', tempMarker.current);

          // 지도 중심을 클릭한 위치로 즉시 이동
          newMap.setCenter(coord);

          // 줌 레벨도 즉시 변경
          const currentZoom = newMap.getZoom();
          if (currentZoom < 15) {
            newMap.setZoom(16);
          }

          setIsLocationInfoPanelOpen(true);
          setIsEditingPanel(false);

          // 주소 변환 (신규 장소 등록용) - 캐시/서버 캐시 활용
          console.log('[지도 클릭] 주소 변환 시작:', { lat: coordinates[1], lng: coordinates[0] });

          // 주소 변환 (카카오 API 폴백 포함)
          const performReverseGeocode = async () => {
            try {
              console.log('[지도 클릭] 주소 변환 시작');
              const resolvedAddress = await getAddressFromCoordinates(coordinates[1], coordinates[0]);
              console.log('[지도 클릭] 주소 변환 성공:', resolvedAddress);
              setNewLocation(prev => ({
                ...prev,
                address: resolvedAddress || '주소를 찾을 수 없습니다.'
              }));
            } catch (error) {
              console.error('[지도 클릭] 주소 변환 실패:', error);
              setNewLocation(prev => ({
                ...prev,
                address: '주소를 찾을 수 없습니다.'
              }));
            }
          };

          // 500ms 지연 후 역지오코딩 실행 (getAddressFromCoordinates 내부에서 카카오 폴백 처리)
          if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);
          reverseGeocodeTimerRef.current = setTimeout(performReverseGeocode, 500);
        });
      } catch (error) {
        console.error('[지도 초기화] 오류:', error);
      }
    }
  }, [isMapLoading, map, groupMembers, isFetchingGroupMembers]); // 최적화를 위해 isFetchingGroupMembers 추가



  // 초기 데이터 로딩 완료 - 즉시 설정
  useEffect(() => {
    setIsInitialDataLoaded(true);
  }, []);

  // 컴포넌트 마운트 시 그룹 데이터 먼저 로드
  useEffect(() => {
    if (isInitialDataLoaded) {
      fetchUserGroups();
    }
  }, [isInitialDataLoaded]);

  // 선택된 그룹이 변경될 때 멤버 데이터 불러오기
  useEffect(() => {
    if (selectedGroupId && !isFetchingGroupMembers) {
      console.log('[useEffect] selectedGroupId 변경으로 인한 멤버 데이터 로딩:', selectedGroupId, {
        dataFetched: dataFetchedRef.current.members,
        isFetching: isFetchingGroupMembers,
        groupMembersLength: groupMembers.length
      });

      // 그룹이 변경되었거나 아직 데이터를 가져오지 않은 경우 로딩
      // 더 확실한 조건: 그룹 멤버가 비어있거나 데이터를 가져오지 않은 경우
      if (groupMembers.length === 0 || !dataFetchedRef.current.members) {
        console.log('[useEffect] 멤버 데이터 로딩 시작');
        fetchGroupMembersData();
      }
    }
  }, [selectedGroupId]); // 🚨 중복 호출 방지: groupMembers.length와 isFetchingGroupMembers 의존성 제거

  // 첫번째 멤버 자동 선택을 위한 안전한 조건 검사
  const shouldSelectFirstMember = useMemo(() => {
    try {
      return groupMembers && groupMembers.length > 0 &&
        !groupMembers.some(m => m.isSelected) &&
        !firstMemberSelected &&
        selectedGroupId &&
        isMapReady &&
        map;
    } catch (error) {
      console.error('[LOCATION] shouldSelectFirstMember 계산 오류:', error);
      return false;
    }
  }, [groupMembers?.length, groupMembers?.some && groupMembers.some(m => m.isSelected), firstMemberSelected, selectedGroupId, isMapReady, map]);

  // 첫번째 멤버 자동 선택 - handleMemberSelect를 통한 정상적인 마커 업데이트
  useEffect(() => {
    if (!shouldSelectFirstMember || !groupMembers?.[0]) return;

    // 🚨 핵심 수정: 이미 선택된 멤버가 있으면 스킵 (사용자가 이미 다른 멤버를 선택한 경우)
    const hasAlreadySelectedMember = groupMembers.some(m => m.isSelected);
    if (hasAlreadySelectedMember) {
      console.log('[LOCATION] 🚨 이미 선택된 멤버 있음 - 첫 번째 멤버 자동 선택 스킵');
      return;
    }

    // 🚨 selectedMemberIdRef로도 확인 (더 정확한 현재 상태)
    if (selectedMemberIdRef.current) {
      console.log('[LOCATION] 🚨 selectedMemberIdRef에 값 있음 - 첫 번째 멤버 자동 선택 스킵:', selectedMemberIdRef.current);
      return;
    }

    console.log('[LOCATION] 첫번째 멤버 자동 선택 조건 만족:', {
      memberCount: groupMembers.length,
      hasSelectedMember: hasAlreadySelectedMember,
      firstMemberSelected,
      selectedGroupId,
      isMapReady,
      hasMap: !!map
    });

    // 중복 실행 방지
    setFirstMemberSelected(true);

    // 첫번째 멤버 정상 선택 (handleMemberSelect 호출로 마커 업데이트 포함)
    const firstMember = groupMembers[0];
    console.log('[LOCATION] 첫번째 멤버 자동 선택 실행:', firstMember.name, firstMember.id);

    // 🚨 인포윈도우 자동 열기 플래그 활성화 (핵심 수정)
    shouldAutoOpenInfoWindowRef.current = true;

    // 🚨 initialMarkerSetupDoneRef 리셋 (새 그룹 선택 시 인포윈도우 다시 생성할 수 있도록)
    initialMarkerSetupDoneRef.current = false;

    // 업데이트된 멤버 정보 생성 (선택 상태 반영)
    const updatedMembersForSelection = groupMembers.map(member => ({
      ...member,
      isSelected: member.id === firstMember.id
    }));

    // handleMemberSelect를 호출하여 마커 업데이트 포함 (업데이트된 멤버 정보 전달)
    handleMemberSelect(firstMember.id, false, updatedMembersForSelection, false, null, false);

    // 첫번째 멤버 선택 완료 상태 설정
    setIsFirstMemberSelectionComplete(true);

    console.log('[LOCATION] 첫번째 멤버 자동 선택 완료:', firstMember.name);

    // 🚨 ensureInitialMemberInfoWindow를 폴백으로 재활성화 (memberMarkers useEffect가 실패할 경우 대비)
    setTimeout(() => {
      ensureInitialMemberInfoWindow();
    }, 1000);
  }, [shouldSelectFirstMember]); // 🚨 groupMembers 제거 - 매번 재실행 방지

  // 첫번째 멤버 선택 완료 (InfoWindow는 표시하지 않음)
  // 멤버 InfoWindow 자동 표시는 제거됨

  // 초기 선택된 멤버의 InfoWindow 표시를 보장하는 헬퍼 함수
  const ensureInitialMemberInfoWindow = useCallback(() => {
    try {
      const selectedMember = groupMembers.find(m => m.isSelected);
      if (!selectedMember) {
        console.log('[ensureInitialMemberInfoWindow] 선택된 멤버 없음');
        return;
      }

      console.log('[ensureInitialMemberInfoWindow] 초기 선택된 멤버 InfoWindow 보장 시작:', selectedMember.name);

      // 멤버 마커가 준비되었는지 확인
      if (memberMarkers.length === 0) {
        console.log('[ensureInitialMemberInfoWindow] 멤버 마커 아직 생성되지 않음, 잠시 후 재시도');
        setTimeout(() => ensureInitialMemberInfoWindow(), 300);
        return;
      }

      // 멤버 마커가 지도에 제대로 표시되었는지 확인
      const selectedMemberIndex = groupMembers.findIndex(m => m.id === selectedMember.id);
      const selectedMarker = memberMarkers[selectedMemberIndex];

      if (!selectedMarker) {
        console.log('[ensureInitialMemberInfoWindow] 선택된 멤버의 마커를 찾을 수 없음, 잠시 후 재시도');
        setTimeout(() => ensureInitialMemberInfoWindow(), 300);
        return;
      }

      // 마커가 지도에 표시되어 있는지 확인
      if (!selectedMarker.getMap || selectedMarker.getMap() !== map) {
        console.log('[ensureInitialMemberInfoWindow] 마커가 지도에 표시되지 않음, 잠시 후 재시도');
        setTimeout(() => ensureInitialMemberInfoWindow(), 300);
        return;
      }

      // InfoWindow 표시 플래그 활성화 후 InfoWindow 표시 시도
      shouldAutoOpenInfoWindowRef.current = true;

      console.log('[ensureInitialMemberInfoWindow] InfoWindow 표시 시도:', selectedMember.name);

      // InfoWindow 생성 및 표시
      createMemberInfoWindow(selectedMember, selectedMarker);
      console.log('[ensureInitialMemberInfoWindow] 초기 선택된 멤버 InfoWindow 표시 성공:', selectedMember.name);

      // 🚨 장소 마커도 표시 (새 handleMemberChange 사용)
      const locations = selectedMember.savedLocations || selectedMemberSavedLocations || [];
      if (locations.length > 0) {
        console.log('[ensureInitialMemberInfoWindow] 장소 마커 표시 시작:', locations.length);
        handleMemberChange(selectedMember.id, selectedMember, locations);
      } else {
        console.log('[ensureInitialMemberInfoWindow] 장소 데이터 없음 - 멤버 마커 색상만 업데이트 (나중에 재시도)');
        updateMemberMarkerStyles(selectedMember.id);

        // 🚨 장소 데이터가 아직 로드되지 않았으면 나중에 다시 시도
        setTimeout(() => {
          const retryLocations = groupMembers.find(m => m.id === selectedMember.id)?.savedLocations || [];
          if (retryLocations.length > 0) {
            console.log('[ensureInitialMemberInfoWindow] 장소 데이터 재시도 성공:', retryLocations.length);
            handleMemberChange(selectedMember.id, selectedMember, retryLocations);
          }
        }, 1000);
      }

    } catch (error) {
      console.error('[ensureInitialMemberInfoWindow] 오류:', error);
      // 실패 시 잠시 후 재시도
      setTimeout(() => ensureInitialMemberInfoWindow(), 500);
    }
  }, [groupMembers, memberMarkers, map, selectedMemberSavedLocations, handleMemberChange, updateMemberMarkerStyles]);

  // 🚨 memberMarkers가 생성된 후 첫 번째 멤버 선택 시 인포윈도우만 표시
  // (장소 마커는 handleMemberSelect에서 이미 처리됨)
  const initialMarkerSetupDoneRef = useRef<boolean>(false);
  const initialInfoWindowTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // 멤버 마커가 없거나 이미 초기화 완료된 경우 스킵
    if (memberMarkers.length === 0 || initialMarkerSetupDoneRef.current) return;

    // 선택된 멤버 확인
    const selectedMember = groupMembers.find(m => m.isSelected);
    if (!selectedMember) return;

    // 🚨 인포윈도우가 이미 열려있는지 확인 (이미 열려있으면 스킵)
    try {
      if (infoWindow && infoWindow.getMap && infoWindow.getMap()) {
        console.log('[memberMarkers useEffect] 🚨 인포윈도우 이미 표시됨 - 스킵');
        initialMarkerSetupDoneRef.current = true;
        return;
      }
    } catch (e) {
      // 무시
    }

    console.log('[memberMarkers useEffect] 🚨 멤버 마커 생성 완료 - 인포윈도우 표시:', {
      memberMarkersCount: memberMarkers.length,
      selectedMember: selectedMember.name
    });

    // 중복 실행 방지
    initialMarkerSetupDoneRef.current = true;

    // 선택된 멤버의 마커 찾기
    const selectedMarkerIndex = memberMarkers.findIndex((marker: any) =>
      marker.__key === String(selectedMember.id) || marker.__key === selectedMember.name
    );
    const selectedMarker = memberMarkers[selectedMarkerIndex];

    if (selectedMarker && map) {
      console.log('[memberMarkers useEffect] 🚨 선택된 멤버 마커 발견, 인포윈도우 생성 시작');

      // 🚨 기존 타이머 취소
      if (initialInfoWindowTimerRef.current) {
        clearTimeout(initialInfoWindowTimerRef.current);
      }

      // 🚨 멤버 ID 캡처 - 타이머 실행 시 현재 선택된 멤버와 비교용
      const capturedMemberId = selectedMember.id;

      // 🚨 인포윈도우 즉시 생성 (타이밍을 300ms로 단축)
      initialInfoWindowTimerRef.current = setTimeout(() => {
        // 🚨 타이머 실행 시 현재 선택된 멤버 확인 - ref를 사용해 최신 상태 확인
        const currentSelectedMemberId = selectedMemberIdRef.current;
        if (currentSelectedMemberId !== capturedMemberId) {
          console.log('[memberMarkers useEffect] 🚨 선택된 멤버가 변경됨 - 인포윈도우 생성 스킵:', {
            captured: capturedMemberId,
            current: currentSelectedMemberId
          });
          return;
        }

        // 🚨 인포윈도우가 이미 열려있는지 다시 확인
        try {
          if (infoWindow && infoWindow.getMap && infoWindow.getMap()) {
            console.log('[memberMarkers useEffect] 🚨 인포윈도우 이미 표시됨 (타이머 내) - 스킵');
            return;
          }
        } catch (e) {
          // 무시
        }

        console.log('[memberMarkers useEffect] 🚨 인포윈도우 생성 실행');
        createMemberInfoWindow(selectedMember, selectedMarker);
      }, 300); // 🚨 500ms에서 300ms로 단축하여 더 빠르게 표시
    }

    // 클린업: 타이머 정리
    return () => {
      if (initialInfoWindowTimerRef.current) {
        clearTimeout(initialInfoWindowTimerRef.current);
        initialInfoWindowTimerRef.current = null;
      }
    };
  }, [memberMarkers, groupMembers, map]);

  // groupMembers 상태 변경 시 마커 업데이트 (그룹 멤버 리스트에서 선택 시 InfoWindow 표시를 위해)
  // 그룹 멤버 변경 시 마커 업데이트 - updateAllMarkers로 통합됨
  // useEffect(() => {
  //   // 이 useEffect는 더 이상 필요하지 않습니다.
  //   // updateAllMarkers를 호출하는 통합 useEffect에서 처리됩니다.
  // }, [groupMembers, map, isMapReady]);



  // 페이지 로드 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 디버깅용 - 로딩 상태 추적 (프로덕션에서는 완전 비활성화)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[로딩 상태 추적]', {
        isMapLoading,
        isMapReady,
        isMapInitialized,
        isFetchingGroupMembers,
        groupMembersCount: groupMembers.length,
        hasMap: !!map,
        hasNaverAPI: !!(window.naver && window.naver.maps),
        selectedMemberSavedLocationsCount: selectedMemberSavedLocations?.length || 0
      });
    }
  }, [isMapLoading, isMapReady, isMapInitialized, isFetchingGroupMembers, groupMembers.length, map, selectedMemberSavedLocations]);

  // 지도 정보창에서 호출할 글로벌 함수 설정
  useEffect(() => {
    // 알림 토글 함수를 window 객체에 등록
    (window as any).handleNotificationToggleFromMap = (locationId: string) => {
      const location = selectedMemberSavedLocations?.find(loc => loc.id === locationId) ||
        otherMembersSavedLocations.find(loc => loc.slt_idx?.toString() === locationId);
      if (location) {
        handleNotificationToggle(location);
      }
    };

    // 장소 숨김 함수를 window 객체에 등록
    (window as any).handleHideLocationFromMap = (locationId: string) => {
      const location = selectedMemberSavedLocations?.find(loc => loc.id === locationId) ||
        otherMembersSavedLocations.find(loc => loc.slt_idx?.toString() === locationId);
      if (location) {
        handleHideLocation(location); // 여기서는 handleHideLocation 호출
      }
    };

    // 장소 숨김(삭제) 함수를 window 객체에 등록 (이제 모달을 띄우는 역할)
    (window as any).handleDeleteLocationFromMap = (locationId: string, locationName: string) => {
      const locationObject = selectedMemberSavedLocations?.find(loc => loc.id === locationId) ||
        otherMembersSavedLocations.find(loc => (loc.slt_idx ? loc.slt_idx.toString() : loc.id) === locationId);
      if (locationObject) {
        openModal(
          `'${locationName}' 삭제 확인`,
          '정말로 이 장소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
          'info',
          () => handleHideLocation(locationObject) // 실제 삭제는 handleHideLocation이 담당
        );
      }
    };

    // 컴포넌트 언마운트 시 정리
    return () => {
      delete (window as any).handleNotificationToggleFromMap;
      delete (window as any).handleDeleteLocationFromMap;
    };
  }, [selectedMemberSavedLocations, otherMembersSavedLocations, handleNotificationToggle, handleHideLocation, openModal]); // openModal 의존성 추가

  // 다른 멤버 장소 로드
  useEffect(() => {
    const loadOtherMemberLocations = async () => {
      const currentSelectedMember = groupMembers.find(m => m.isSelected);
      if (activeView === 'otherMembersPlaces' && currentSelectedMember?.id) {
        setIsLoadingOtherLocations(true);
        try {
          const fetchedLocationsRaw = await locationService.getOtherMembersLocations(currentSelectedMember?.id || '');
          console.log("[useEffect/activeView] Other members' locations (raw):", fetchedLocationsRaw);
          setOtherMembersSavedLocations(fetchedLocationsRaw);
        } catch (error) {
          console.error("Failed to fetch other members' locations on view change", error);
          setOtherMembersSavedLocations([]);
        } finally {
          setIsLoadingOtherLocations(false);
          // 다른 멤버 위치 뷰 로딩 완료 햅틱 피드백
          hapticFeedback.dataLoadComplete();
        }
      } else if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
        // selectedMemberPlaces 뷰에서는 이미 로드된 데이터 사용
      } else if (!currentSelectedMember) {
        // 선택된 멤버가 없으면 빈 배열
        setOtherMembersSavedLocations([]);
      }
    };

    if (isMapInitialized) {
      loadOtherMemberLocations();
    }
  }, [isMapInitialized, activeView]); // selectedMemberIdRef.current 제거하여 무한 재조회 방지

  // 그룹별 멤버 수 조회
  useEffect(() => {
    const fetchGroupMemberCounts = async () => {
      if (!userGroups || userGroups.length === 0) return;

      console.log('[LOCATION] 그룹 멤버 수 조회 시작:', userGroups.length, '개 그룹');

      const counts: Record<number, number> = {};

      await Promise.all(userGroups.map(async (group) => {
        try {
          const count = await getGroupMemberCount(group.sgt_idx);
          counts[group.sgt_idx] = count;
          console.log(`[LOCATION] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수:`, count);
        } catch (error) {
          console.error(`[LOCATION] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
          counts[group.sgt_idx] = 0;
        }
      }));

      setGroupMemberCounts(counts);
      console.log('[LOCATION] 그룹 멤버 수 조회 완료:', counts);
    };

    fetchGroupMemberCounts();
  }, [userGroups]);

  // 사용자 그룹 목록 불러오기
  const fetchUserGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const groups = await groupService.getCurrentUserGroups();
      console.log('[fetchUserGroups] 그룹 목록 조회:', groups);
      setUserGroups(groups);

      // 첫 번째 그룹을 기본 선택
      if (groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groups[0].sgt_idx);
        console.log('[fetchUserGroups] 첫 번째 그룹 자동 선택:', groups[0].sgt_title);
      }

      // 그룹 데이터 로딩 완료 표시
      dataFetchedRef.current.groups = true;
    } catch (error) {
      console.error('[fetchUserGroups] 그룹 목록 조회 실패:', error);
      setUserGroups([]);
      // 실패해도 로딩 완료로 표시하여 무한 로딩 방지
      dataFetchedRef.current.groups = true;
    } finally {
      setIsLoadingGroups(false);
      // 그룹 목록 로딩 완료 햅틱 피드백
      hapticFeedback.dataLoadComplete();
    }
  };

  // 그룹 멤버 수를 가져오는 함수
  const getGroupMemberCount = async (groupId: number): Promise<number> => {
    try {
      const memberData = await memberService.getGroupMembers(groupId.toString());
      return memberData ? memberData.length : 0;
    } catch (error) {
      console.error(`그룹 ${groupId} 멤버 수 조회 실패:`, error);
      return 0;
    }
  };

  // 좌표 안전성 검사 헬퍼 함수
  const parseCoordinate = (coord: any): number | null => {
    if (typeof coord === 'number') return coord;
    if (typeof coord === 'string' && !isNaN(parseFloat(coord))) return parseFloat(coord);
    return null;
  };

  // 안전한 LatLng 생성 함수
  const createSafeLatLng = (lat: number, lng: number): any | null => {
    try {
      if (window.naver && window.naver.maps && window.naver.maps.LatLng) {
        return new window.naver.maps.LatLng(lat, lng);
      } else {
        console.warn('[createSafeLatLng] LatLng 생성 실패 - 네이버 지도 API 미준비');
        return null;
      }
    } catch (error) {
      console.error('[createSafeLatLng] LatLng 생성 오류:', error);
      return null;
    }
  };

  // 이미지 처리 함수들은 @/lib/imageUtils에서 import하여 사용

  // 시간을 월/일 hh:mm 형식으로 변환하는 함수
  const formatTimeToMMDDHHMM = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${month}/${day} ${hours}:${minutes}`;
    } catch (error) {
      console.error('시간 포맷 변환 오류:', error);
      return '시간 정보 없음';
    }
  };

  // 네이버 맵 역지오코딩 API를 사용한 좌표 -> 주소 변환
  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
    try {
      const key = normalizeLatLngKey(lat, lng);
      if (reverseGeocodeCache.has(key)) return reverseGeocodeCache.get(key)!;
      if (reverseGeocodeInflight.has(key)) return await reverseGeocodeInflight.get(key)!;

      const inflight = (async () => {
        // 0) 서버 캐시 조회 (히트 시 즉시 반환)
        try {
          const query = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() }).toString();
          const res = await fetch(`/api/revgeo-cache?${query}`, { method: 'GET', cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data?.address && typeof data.address === 'string') {
              console.log('[getAddressFromCoordinates] 서버 캐시 히트:', data.address);
              reverseGeocodeCache.set(key, data.address);
              return data.address;
            }
          } else {
            console.log('[getAddressFromCoordinates] 서버 캐시 미스:', res.status);
          }
        } catch (error) {
          console.log('[getAddressFromCoordinates] 서버 캐시 조회 실패:', error);
        }

        // 카카오 API 폴백 로직 (네이버 Service 사용 불가 시)
        console.log('[getAddressFromCoordinates] 네이버 Service 상태 확인:', {
          hasNaver: !!window.naver,
          hasMaps: !!window.naver?.maps,
          hasService: !!window.naver?.maps?.Service
        });

        if (!window.naver?.maps?.Service) {
          console.log('[getAddressFromCoordinates] 네이버 Service 사용 불가, 카카오 API로 폴백');

          try {
            const response = await fetch(`/api/kakao-search?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);

            if (response.ok) {
              const data = await response.json();
              console.log('[getAddressFromCoordinates] 카카오 API 응답:', data);

              if (data.documents && data.documents.length > 0) {
                const doc = data.documents[0];
                let address = '';

                // 도로명주소 우선
                if (doc.road_address && doc.road_address.address_name) {
                  address = doc.road_address.address_name;
                  console.log('[getAddressFromCoordinates] 카카오 도로명주소 사용:', address);
                }
                // 지번주소 사용
                else if (doc.address && doc.address.address_name) {
                  address = doc.address.address_name;
                  console.log('[getAddressFromCoordinates] 카카오 지번주소 사용:', address);
                }

                if (address) {
                  console.log('[getAddressFromCoordinates] 카카오 API 최종 주소:', address);
                  reverseGeocodeCache.set(key, address);

                  // 서버 캐시에 저장
                  try {
                    await fetch('/api/revgeo-cache', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ lat, lng, address })
                    });
                  } catch (_) { }

                  return address;
                }
              }
            } else {
              console.error('[getAddressFromCoordinates] 카카오 API 응답 오류:', response.status);
            }
          } catch (kakaoError) {
            console.error('[getAddressFromCoordinates] 카카오 API 오류:', kakaoError);
          }
        }

        // 네이버 Service가 있는 경우에만 사용
        if (!window.naver?.maps?.Service) {
          console.warn('[getAddressFromCoordinates] 네이버 맵 Service 사용 불가, 좌표 반환');
          throw new Error('주소 변환에 실패했습니다.');
        }

        console.log('[getAddressFromCoordinates] 네이버 Service 사용 가능, 역지오코딩 시작');

        return new Promise<string>((resolve, reject) => {
          const coord = createSafeLatLng(lat, lng);
          if (!coord) {
            console.warn('[getAddressFromCoordinates] LatLng 생성 실패');
            reject(new Error('좌표 변환에 실패했습니다.'));
            return;
          }

          window.naver.maps.Service.reverseGeocode({
            coords: coord,
            orders: [
              window.naver.maps.Service.OrderType.ROAD_ADDR,
              window.naver.maps.Service.OrderType.ADDR
            ].join(',')
          }, (status: any, response: any) => {
            if (status === window.naver.maps.Service.Status.ERROR) {
              console.warn('[getAddressFromCoordinates] 역지오코딩 오류:', status);
              reject(new Error('주소 변환에 실패했습니다.'));
              return;
            }

            try {
              console.log('[getAddressFromCoordinates] 전체 응답:', JSON.stringify(response, null, 2));

              let address = '';

              // 1단계: v2 응답에서 도로명주소 우선 확인
              if (response?.v2?.results && Array.isArray(response.v2.results)) {
                console.log('[getAddressFromCoordinates] v2 결과 개수:', response.v2.results.length);

                for (const result of response.v2.results) {
                  console.log('[getAddressFromCoordinates] 결과 항목 상세:', JSON.stringify(result, null, 2));

                  // 도로명주소가 있는지 확인
                  if (result.name === 'roadaddr' && result.region) {
                    const roadParts: string[] = [];
                    if (result.region.area1?.name) roadParts.push(result.region.area1.name);
                    if (result.region.area2?.name) roadParts.push(result.region.area2.name);
                    if (result.region.area3?.name) roadParts.push(result.region.area3.name);
                    if (result.region.area4?.name) roadParts.push(result.region.area4.name);

                    // 도로명 정보 추가
                    if (result.land?.name) roadParts.push(result.land.name);
                    if (result.land?.number1) {
                      if (result.land.number2) {
                        roadParts.push(`${result.land.number1}-${result.land.number2}`);
                      } else {
                        roadParts.push(result.land.number1);
                      }
                    }

                    const roadAddress = roadParts.filter(part => part && part.trim()).join(' ');
                    if (roadAddress && roadAddress.length > 5) {
                      address = roadAddress;
                      console.log('[getAddressFromCoordinates] 도로명주소 사용:', address);
                      break;
                    }
                  }

                  // 지번주소 확인 (roadaddr이 없을 때)
                  if (!address && result.name === 'addr' && result.region) {
                    const addrParts: string[] = [];
                    if (result.region.area1?.name) addrParts.push(result.region.area1.name);
                    if (result.region.area2?.name) addrParts.push(result.region.area2.name);
                    if (result.region.area3?.name) addrParts.push(result.region.area3.name);
                    if (result.region.area4?.name) addrParts.push(result.region.area4.name);

                    // 지번 정보 추가
                    if (result.land?.name) addrParts.push(result.land.name);
                    if (result.land?.number1) {
                      if (result.land.number2) {
                        addrParts.push(`${result.land.number1}-${result.land.number2}`);
                      } else {
                        addrParts.push(result.land.number1);
                      }
                    }

                    const jibunAddress = addrParts.filter(part => part && part.trim()).join(' ');
                    if (jibunAddress && jibunAddress.length > 5) {
                      address = jibunAddress;
                      console.log('[getAddressFromCoordinates] 지번주소 사용:', address);
                      break;
                    }
                  }
                }
              }

              // 2단계: v1 응답 확인 (v2가 실패한 경우)
              if (!address && response?.result?.items && Array.isArray(response.result.items)) {
                console.log('[getAddressFromCoordinates] v1 응답 확인');
                for (const item of response.result.items) {
                  if (item.address && typeof item.address === 'string' && item.address.length > 5) {
                    address = item.address;
                    console.log('[getAddressFromCoordinates] v1 주소 사용:', address);
                    break;
                  }
                }
              }

              // 3단계: 임의의 name 필드 사용 (마지막 수단)
              if (!address && response?.v2?.results && Array.isArray(response.v2.results)) {
                for (const result of response.v2.results) {
                  if (result.region) {
                    const simpleParts: string[] = [];
                    if (result.region.area1?.name) simpleParts.push(result.region.area1.name);
                    if (result.region.area2?.name) simpleParts.push(result.region.area2.name);
                    if (result.region.area3?.name) simpleParts.push(result.region.area3.name);

                    const simpleAddress = simpleParts.filter(part => part && part.trim()).join(' ');
                    if (simpleAddress && simpleAddress.length > 3) {
                      address = simpleAddress;
                      console.log('[getAddressFromCoordinates] 간단한 주소 사용:', address);
                      break;
                    }
                  }
                }
              }

              // 최종적으로 주소가 없는 경우 좌표 표시
              if (!address || address.trim() === '' || address.length < 3) {
                throw new Error('주소를 찾을 수 없습니다.');
              }

              console.log('[getAddressFromCoordinates] 최종 주소:', address);
              reverseGeocodeCache.set(key, address.trim());
              resolve(address.trim());
            } catch (parseError) {
              console.error('[getAddressFromCoordinates] 응답 파싱 오류:', parseError);
              reject(parseError);
            }
          });
        });
      })();

      reverseGeocodeInflight.set(key, inflight);
      let result: string;
      try {
        result = await inflight;
      } finally {
        reverseGeocodeInflight.delete(key);
      }

      // 1) 서버 캐시에 저장 (베스트 에포트)
      try {
        await fetch('/api/revgeo-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, address: result })
        });
      } catch (_) { }

      return result;
    } catch (error) {
      console.error('[getAddressFromCoordinates] 역지오코딩 에러:', error);
      throw error;
    }
  };
  // 🚨 제거: updateMapMarkers 함수는 더 이상 사용되지 않음
  // 모든 마커 생성은 updateAllMarkers 함수에서 통합 관리됨

  // 통합 마커 업데이트 함수 - 멤버 마커와 선택된 멤버의 장소 마커만 동시 생성
  const updateAllMarkers = useCallback((members: GroupMember[], locations: LocationData[] | null, forceUpdate: boolean = false) => {
    // 🚨 디버깅: 파라미터 상세 로깅
    console.log('[updateAllMarkers] 🚨 파라미터 상세 분석:', {
      membersCount: members?.length || 0,
      locationsCount: locations?.length || 0,
      locationsType: typeof locations,
      locationsIsArray: Array.isArray(locations),
      locationsSample: locations?.slice(0, 2) || [],
      forceUpdate: forceUpdate,
      현재선택된장소ID: selectedLocationIdRef.current
    });

    // 🚨 강제 업데이트 시에도 선택 상태 보존 경고
    if (forceUpdate && selectedLocationIdRef.current) {
      console.warn('[updateAllMarkers] 🚨 강제 업데이트이지만 선택된 장소 보존 필요:', selectedLocationIdRef.current);
    }

    // 🚨 마커 보존 모드 결정
    const shouldPreserveMarkers = !forceUpdate && !!selectedLocationIdRef.current;

    if (!map || !window.naver || !window.naver.maps || !window.naver.maps.LatLng || !isMapReady) {
      console.log('[updateAllMarkers] 지도가 준비되지 않음 - 네이버 지도 API 로딩 중');
      return;
    }

    // 선택된 멤버 확인
    const selectedMember = members.find(member => member.isSelected);
    console.log('[updateAllMarkers] 🚀 시작 - 멤버:', members.length, '명, 선택된 멤버:', selectedMember?.name || '없음', '장소:', locations?.length || 0, '개');

    // 현재 상태의 시그니처 생성 (멤버 좌표 + 선택된 멤버 + 장소 좌표 + 선택된 장소)
    const markerSignature = JSON.stringify({
      members: (members || []).map(m => ({
        id: m.id,
        lat: parseCoordinate(m.mlt_lat) || parseCoordinate(m.location?.lat),
        lng: parseCoordinate(m.mlt_long) || parseCoordinate(m.location?.lng),
        isSelected: !!m.isSelected,
      })),
      selectedMemberId: selectedMember?.id || null,
      selectedLocationId: selectedLocationIdRef.current || null,
      locations: (locations || []).map(l => ({ id: l.id, coords: l.coordinates }))
    });

    // 🚨 마커 업데이트 중 중복 실행 방지 (강화된 버전) - 강제 업데이트 시에는 건너뜀
    if (!forceUpdate && isUpdatingMarkersRef.current) {
      console.log('[updateAllMarkers] ⏭️ 마커 업데이트 중 - 중복 실행 방지');
      return;
    }

    // 🚨 최근 업데이트 시간 체크 (500ms 이내 재호출 방지) - 강제 업데이트 시에는 건너뜀
    const now = Date.now();
    if (!forceUpdate && now - lastMarkerUpdateTimeRef.current < 500) {
      console.log('[updateAllMarkers] ⏭️ 최근 업데이트 (500ms 이내) - 중복 실행 방지');
      return;
    }

    // 🚨 강제 업데이트 모드일 때는 시그니처 체크 완전 우회
    if (forceUpdate) {
      console.log('[updateAllMarkers] 🚨 강제 업데이트 모드 - 시그니처 체크 우회');
      lastMarkersSignatureRef.current = ''; // 시그니처 리셋
    } else {
      // 시그니처 중복 체크 완화 - 마커가 실제로 표시되지 않은 경우 강제 업데이트
      const hasVisibleMarkers = memberMarkers.length > 0 && locationMarkersRef.current.length >= 0;
      const shouldSkipUpdate = lastMarkersSignatureRef.current === markerSignature && hasVisibleMarkers;

      if (shouldSkipUpdate) {
        console.log('[updateAllMarkers] ⏭️ 시그니처 동일하고 마커 존재 - 중복 방지');
        return;
      } else if (lastMarkersSignatureRef.current === markerSignature) {
        console.log('[updateAllMarkers] 🔄 시그니처 동일하지만 마커 없음 - 강제 업데이트');
      }
    }

    // 마커 업데이트 시작 플래그 설정 및 시간 기록
    isUpdatingMarkersRef.current = true;
    lastMarkerUpdateTimeRef.current = now;
    lastMarkersSignatureRef.current = markerSignature;
    console.log('[updateAllMarkers] 📊 현재 마커 상태:', {
      기존멤버마커수: memberMarkers.length,
      기존장소마커수: markers.length,
      호출시간: new Date().toLocaleTimeString()
    });

    // 🚨 멤버 변경 시 모든 기존 마커 완전 제거
    console.log('[updateAllMarkers] 🚨 마커 업데이트 시작 - 기존 마커 완전 제거');

    // 1. 모든 장소 마커 제거 (강화된 버전)
    console.log('[updateAllMarkers] 🚨 장소 마커 제거 시작 - 현재 상태:', {
      locationMarkersRefLength: locationMarkersRef.current?.length || 0,
      markersLength: markers?.length || 0
    });

    // 1a. locationMarkersRef에서 제거
    if (locationMarkersRef.current && locationMarkersRef.current.length > 0) {
      locationMarkersRef.current.forEach((marker, idx) => {
        try {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
            console.log(`[updateAllMarkers] locationMarkersRef 마커 ${idx + 1} 제거 완료`);
          }
        } catch (e) {
          console.warn(`[updateAllMarkers] locationMarkersRef 마커 ${idx + 1} 제거 실패:`, e);
        }
      });
      locationMarkersRef.current = [];
    }

    // 1b. markers 상태에서 제거
    if (markers && markers.length > 0) {
      markers.forEach((marker, idx) => {
        try {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
            console.log(`[updateAllMarkers] markers 상태 마커 ${idx + 1} 제거 완료`);
          }
        } catch (e) {
          console.warn(`[updateAllMarkers] markers 상태 마커 ${idx + 1} 제거 실패:`, e);
        }
      });
    }

    // 1c. 상태 즉시 초기화 (강제)
    setMarkers([]);
    console.log('[updateAllMarkers] 🚨 장소 마커 상태 초기화 완료');

    // 2. 멤버 마커는 보존 (사용자 요구사항: 이전 멤버 마커가 사라지지 않도록)
    console.log('[updateAllMarkers] 🚨 멤버 마커 보존 - 장소 마커만 제거');
    console.log('[updateAllMarkers] 현재 멤버 마커 상태:', {
      memberMarkersRefLength: memberMarkersRef.current?.length || 0,
      memberMarkersLength: memberMarkers?.length || 0
    });

    // 3. 지도에서 실제로 남아있는 마커 강제 확인 및 제거
    setTimeout(() => {
      if (map && map.getLayers && typeof map.getLayers === 'function') {
        try {
          // 네이버 지도 API로 지도에 남아있는 모든 오버레이 확인
          const overlays = map.getLayers ? map.getLayers() : [];
          console.log('[updateAllMarkers] 🚨 지도 오버레이 확인:', overlays?.length || 0);

          // 추가적인 마커 제거 시도
          if (window.naver && window.naver.maps) {
            // 지도에 직접 접근해서 마커 제거
            const mapDiv = map.getElement && map.getElement();
            if (mapDiv) {
              console.log('[updateAllMarkers] 🚨 지도 DOM에서 마커 강제 정리');
            }
          }
        } catch (e) {
          console.warn('[updateAllMarkers] 🚨 지도 오버레이 확인 실패:', e);
        }
      }
    }, 100);

    // 🚨 모든 마커 제거 완료 - 이제 새로 구성
    console.log('[updateAllMarkers] 🚨 모든 기존 마커 제거 완료 - 새 마커 생성 시작');

    // 6. 마커 제거 완료를 위한 짧은 지연 (React 상태 업데이트 보장)
    // await 대신 setTimeout을 사용하여 비동기 처리

    // 7. InfoWindow 처리 - 멤버 InfoWindow는 무조건 보존, 선택된 장소 InfoWindow도 보존
    if (infoWindow) {
      try {
        // InfoWindow 내용을 확인하여 멤버 InfoWindow인지 장소 InfoWindow인지 판단
        const infoWindowContent = infoWindow.getContent();
        const isMemberInfoWindow = infoWindowContent && infoWindowContent.includes('member-info-window-container');

        if (isMemberInfoWindow) {
          // 🚨 멤버 InfoWindow는 무조건 보존 (첫 진입 시 사라지는 문제 해결)
          console.log('[updateAllMarkers] 멤버 InfoWindow 보존 (무조건)');
        } else if (selectedLocationIdRef.current) {
          // 🚨 선택된 장소가 있으면 장소 InfoWindow도 보존 (마커 클릭 직후 닫히는 문제 해결)
          console.log('[updateAllMarkers] 장소 InfoWindow 보존 (선택된 장소:', selectedLocationIdRef.current, ')');
        } else {
          // 선택된 장소가 없는 경우에만 장소 InfoWindow 닫기
          infoWindow.close();
          setInfoWindow(null);
          console.log('[updateAllMarkers] 장소 InfoWindow 닫기 (선택된 장소 없음)');
        }
      } catch (error) {
        console.error('[updateAllMarkers] InfoWindow 처리 실패:', error);
        // 에러 발생 시에도 멤버 InfoWindow일 수 있으므로 닫지 않음
        console.log('[updateAllMarkers] InfoWindow 처리 오류 - 상태 유지');
      }
    }

    console.log('[updateAllMarkers] 기존 마커 제거 완료 - 강화된 로직 적용');

    // 🚨 멤버 마커 생성 전 기존 멤버 마커 제거 (새 마커 생성을 위해)
    console.log('[updateAllMarkers] 🚨 기존 멤버 마커 제거 시작');

    // 기존 멤버 마커 제거 (새 마커 생성을 위해)
    if (memberMarkersRef.current && memberMarkersRef.current.length > 0) {
      memberMarkersRef.current.forEach((marker, idx) => {
        try {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
          }
        } catch (e) {
          console.warn(`[updateAllMarkers] 멤버 마커 ${idx + 1} 제거 실패:`, e);
        }
      });
      memberMarkersRef.current = [];
    }

    if (memberMarkers && memberMarkers.length > 0) {
      memberMarkers.forEach((marker, idx) => {
        try {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
          }
        } catch (e) {
          console.warn(`[updateAllMarkers] memberMarkers 상태 마커 ${idx + 1} 제거 실패:`, e);
        }
      });
    }

    console.log('[updateAllMarkers] 🚨 기존 멤버 마커 제거 완료');

    // 새 멤버 마커들 생성
    const newMemberMarkers: NaverMarker[] = [];

    if (members.length > 0) {
      members.forEach((member, index) => {
        const lat = parseCoordinate(member.mlt_lat) || parseCoordinate(member.location?.lat);
        const lng = parseCoordinate(member.mlt_long) || parseCoordinate(member.location?.lng);

        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          const photoForMarker = getSafeImageUrl(member.mt_file1, member.mt_gender, member.original_index);

          // 안전한 LatLng 생성
          const position = createSafeLatLng(lat, lng);
          if (!position) {
            console.warn('[updateAllMarkers] 멤버 마커 LatLng 생성 실패');
            return;
          }

          const borderColor = member.isSelected ? '#ef4444' : '#3b82f6';

          console.log(`[updateAllMarkers] 멤버 마커 생성: ${member.name} (선택됨: ${member.isSelected}, 색상: ${borderColor === '#ef4444' ? '빨간색' : '파란색'})`);

          const key = String(member.id || member.name || index);

          // 🚨 중복 마커 방지: 같은 위치에 이미 마커가 있는지 확인
          const existingMarker = newMemberMarkers.find(m => (m as any).__key === key);
          if (existingMarker) {
            console.log(`[updateAllMarkers] 🚨 중복 멤버 마커 방지: ${member.name} (${key})`);
            return;
          }

          // 🚨 기존 마커 재사용하지 않음 - 항상 새로 생성
          console.log(`[updateAllMarkers] 🚨 새 멤버 마커 생성: ${member.name} (${borderColor})`);

          // 새 마커 생성
          const marker = new window.naver.maps.Marker({
            position: position,
            map: map,
            title: member.name,
            icon: {
              content: `
                <div style="position: relative; text-align: center;">
                  <div style="width: 28px; height: 28px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    <img
                      src="${photoForMarker}"
                      alt="${member.name}"
                      style="width: 100%; height: 100%; object-fit: cover;"
                      onerror="this.src='/images/avatar1.png'"
                    />
                  </div>
                  <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; white-space: nowrap; font-size: 10px; font-weight: 500;">
                    ${member.name}
                  </div>
                </div>
              `,
              size: new window.naver.maps.Size(60, 50),
              anchor: new window.naver.maps.Point(30, 32)
            },
            zIndex: member.isSelected ? 200 : 150
          });

          // 마커가 지도에 제대로 추가되었는지 즉시 확인
          setTimeout(() => {
            if (marker.getMap && marker.getMap() === map) {
              console.log(`[updateAllMarkers] 멤버 마커 지도에 정상 표시 확인: ${member.name} (${key})`);
            } else {
              console.warn(`[updateAllMarkers] 멤버 마커 지도 표시 실패 확인: ${member.name} (${key})`);
              // 재시도
              marker.setMap(map);
              console.log(`[updateAllMarkers] 멤버 마커 재설정 시도: ${member.name}`);
            }
          }, 50);
          (marker as any).__key = key;

          // 🚨 기존 이벤트 리스너 제거 (중복 방지)
          window.naver.maps.Event.clearListeners(marker, 'click');

          // 멤버 마커 클릭 이벤트 - 멤버 InfoWindow 생성 및 표시
          window.naver.maps.Event.addListener(marker, 'click', (e: any) => {
            console.log('[멤버 마커 클릭] 멤버 선택 시작:', member.name);

            // 🚨 이벤트 전파 방지 (중복 처리 방지)
            if (e && e.domEvent) {
              e.domEvent.stopPropagation();
              e.domEvent.preventDefault();
            }

            // 🚨 먼저 멤버 선택 처리 - 동일 멤버 재선택 확인
            const isSameMember = selectedMemberIdRef.current === member.id;
            console.log('[멤버 마커 클릭] 동일 멤버 확인:', { current: selectedMemberIdRef.current, clicked: member.id, isSame: isSameMember });

            if (isSameMember) {
              console.log('[멤버 마커 클릭] 동일 멤버 재선택');

              // 🚨 InfoWindow 토글 기능 (상태 확인 강화)
              let isInfoWindowOpen = false;

              // InfoWindow 상태를 더 정확히 확인
              if (infoWindow) {
                try {
                  const mapInstance = infoWindow.getMap();
                  isInfoWindowOpen = !!mapInstance;
                  console.log('[멤버 마커 클릭] InfoWindow 상태 상세 확인:', {
                    hasInfoWindow: !!infoWindow,
                    mapInstance: !!mapInstance,
                    isOnMap: isInfoWindowOpen
                  });
                } catch (error) {
                  console.warn('[멤버 마커 클릭] InfoWindow 상태 확인 중 오류:', error);
                  isInfoWindowOpen = false;
                }
              } else {
                console.log('[멤버 마커 클릭] InfoWindow가 null 상태');
              }

              if (isInfoWindowOpen) {
                // InfoWindow가 열려있으면 닫기만 하고 종료 (장소 마커는 유지)
                console.log('[멤버 마커 클릭] InfoWindow 열려있음 - 닫기 수행 (장소 마커 유지)');
                try {
                  infoWindow.close();
                  setInfoWindow(null);
                  console.log('[멤버 마커 클릭] InfoWindow 닫기 완료');
                } catch (error) {
                  console.error('[멤버 마커 클릭] InfoWindow 닫기 실패:', error);
                  setInfoWindow(null);
                }
                return; // 닫기만 하고 종료 - 장소 마커는 이미 표시되어 있음
              } else {
                // InfoWindow가 닫혀있거나 없으면 새로 생성하여 열기
                console.log('[멤버 마커 클릭] InfoWindow 닫혀있음 - 새로 열기');
                // 기존 InfoWindow가 있다면 완전히 정리
                if (infoWindow) {
                  try {
                    infoWindow.close();
                  } catch (e) {
                    console.warn('[멤버 마커 클릭] 기존 InfoWindow 정리 중 오류:', e);
                  }
                  setInfoWindow(null);
                }

                // InfoWindow 생성
                setTimeout(() => {
                  createMemberInfoWindow(member, marker);
                }, 100);

                // 🚨 장소 마커가 없으면 장소 데이터 로드 (동일 멤버지만 장소 마커가 아직 없는 경우)
                // 이미 장소 마커가 있으면 handleMemberSelect에서 조기 종료됨
                console.log('[멤버 마커 클릭] 동일 멤버 - 장소 마커 확인 후 필요 시 로드');
                handleMemberSelect(member.id, false, members, true, marker, false);
                return;
              }
            }

            // 기존 InfoWindow 닫기
            if (infoWindow) {
              infoWindow.close();
            }

            // 멤버 InfoWindow 생성 및 표시
            createMemberInfoWindow(member, marker);

            // 🚨 멤버 선택 처리 (장소 마커도 업데이트되도록 onlyShowInfoWindow를 false로 설정)
            // onlyShowInfoWindow: false로 변경하여 해당 멤버의 장소 데이터 로드 및 마커 표시
            handleMemberSelect(member.id, false, members, true, marker, false);

            console.log('[멤버 마커 클릭] 멤버 InfoWindow 생성 및 선택 완료:', member.name);
          });

          // 🚨 멤버 마커를 지도에 표시 및 확인
          if (map && marker.setMap) {
            marker.setMap(map);

            // 마커가 지도에 제대로 추가되었는지 확인
            setTimeout(() => {
              if (marker.getMap && marker.getMap() === map) {
                console.log(`[updateAllMarkers] 🚨 멤버 마커 지도에 정상 표시 확인: ${member.name} (${key})`);
              } else {
                console.warn(`[updateAllMarkers] 🚨 멤버 마커 지도 표시 실패 확인: ${member.name} (${key})`);
                // 재시도
                marker.setMap(map);
                console.log(`[updateAllMarkers] 🚨 멤버 마커 재설정 시도: ${member.name}`);
              }
            }, 50);
          } else {
            console.warn(`[updateAllMarkers] 🚨 멤버 마커 지도 표시 실패: ${member.name} (${key}) - map: ${!!map}, setMap: ${!!marker.setMap}`);
          }

          newMemberMarkers.push(marker);
          console.log(`[updateAllMarkers] 🚨 멤버 마커 배열에 추가: ${member.name} (${key})`);
        }
      });

      console.log('[updateAllMarkers] 🚨 멤버 마커 생성 완료:', {
        생성된마커수: newMemberMarkers.length,
        멤버목록: newMemberMarkers.map(m => (m as any).__key)
      });

      // 지도 초기화 시점에 이미 올바른 위치로 설정되므로 추가 이동 불필요
      // (handleMemberSelect에서만 지도 중심 이동 처리)
    }

    // 🚨 장소 마커 생성 전 상태 초기화 (지도에서 제거는 위에서 이미 완료)

    // 새 장소 마커들 생성
    const newLocationMarkers: NaverMarker[] = [];

    // 🚨 장소 마커 생성 시작 - 상세 로깅
    console.log('[updateAllMarkers] 🚨 장소 마커 생성 시작:', {
      hasSelectedMember: !!selectedMember,
      selectedMemberName: selectedMember?.name || '없음',
      hasLocations: !!locations,
      locationsLength: Array.isArray(locations) ? locations.length : 0,
      locations: Array.isArray(locations) ? locations.map(loc => ({
        id: loc.id,
        name: loc.name,
        coordinates: loc.coordinates,
        isValidCoords: loc.coordinates[0] !== 0 && loc.coordinates[1] !== 0
      })) : []
    });

    // 🚨 각 장소 데이터 상세 분석
    if (Array.isArray(locations)) {
      locations.forEach((location, index) => {
        console.log(`[updateAllMarkers] 🚨 장소 ${index + 1}/${locations.length} 상세 분석:`, {
          id: location.id,
          name: location.name,
          coordinates: location.coordinates,
          coordinatesType: typeof location.coordinates,
          coordinatesLength: Array.isArray(location.coordinates) ? location.coordinates.length : 'N/A',
          firstCoord: Array.isArray(location.coordinates) ? location.coordinates[0] : 'N/A',
          secondCoord: Array.isArray(location.coordinates) ? location.coordinates[1] : 'N/A'
        });
      });
    }

    // *** 🚨 장소 마커 생성 로직 재활성화 ***
    console.log('[updateAllMarkers] 🚨 장소 마커 생성 시작');
    if (locations && Array.isArray(locations) && locations.length > 0) {
      // 🚨 중복 제거 로직은 위에서 이미 처리됨

      // 🚨 마커 보존 모드일 때 기존 마커 재사용 여부 결정
      // 🚨 기존 마커 재사용 로직 제거 - 항상 새로운 마커 생성
      console.log('[updateAllMarkers] 🚨 기존 마커 재사용하지 않음 - 항상 새로운 마커 생성');
      console.log('[updateAllMarkers] 🎯 선택된 멤버의 장소 마커 생성 시작:', {
        selectedMemberName: selectedMember?.name || '없음',
        selectedMemberId: selectedMember?.id || '없음',
        locationsCount: locations!.length,
        locationsPreview: locations!.slice(0, 3).map(loc => ({ name: loc.name, coordinates: loc.coordinates })),
        locationsFull: locations!.map(loc => ({ id: loc.id, name: loc.name, coordinates: loc.coordinates }))
      });

      // 🚨 항상 새로운 마커 생성 (기존 마커 재사용하지 않음)
      console.log('[updateAllMarkers] 🚨 새로운 장소 마커 생성 모드 시작');

      // 선택된 멤버의 장소를 반영하되, 선택된 장소는 강조 표시
      locations!.forEach((location, index) => {
        const [lng, lat] = location.coordinates;

        console.log(`[updateAllMarkers] 장소 ${index + 1}/${locations!.length} 처리:`, {
          id: location.id,
          name: location.name,
          coordinates: [lng, lat],
          isValidCoords: lat !== 0 && lng !== 0,
          hasValidLng: lng !== 0,
          hasValidLat: lat !== 0
        });

        // 🚨 좌표 유효성 검사 강화
        if (lat === 0 && lng === 0) {
          console.log(`[updateAllMarkers] ❌ 장소 ${location.name} 건너뜀: 유효하지 않은 좌표 (0, 0)`);
          return;
        }

        if (!lat || !lng) {
          console.log(`[updateAllMarkers] ❌ 장소 ${location.name} 건너뜀: 좌표 누락 (lat: ${lat}, lng: ${lng})`);
          return;
        }

        // 🚨 추가 검증: 좌표가 숫자인지 확인
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          console.log(`[updateAllMarkers] ❌ 장소 ${location.name} 건너뜀: 좌표 타입 오류 (lat: ${typeof lat}, lng: ${typeof lng})`);
          return;
        }

        // 🚨 추가 검증: 좌표 범위 확인 (한반도 범위)
        if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
          console.log(`[updateAllMarkers] ⚠️ 장소 ${location.name} 좌표 범위 경고: (${lat}, ${lng}) - 한반도 범위를 벗어남`);
          // 경고만 하고 계속 진행
        }

        // 안전한 LatLng 생성
        const position = createSafeLatLng(lat, lng);
        if (!position) {
          console.warn('[updateAllMarkers] 장소 마커 LatLng 생성 실패');
          return;
        }

        const isMarkerSelected = selectedLocationIdRef.current === location.id;

        // 🚨 디버깅: 선택 상태 확인
        if (location.id === selectedLocationIdRef.current) {
          console.log('[updateAllMarkers] 🔴 선택된 장소 마커 생성:', {
            locationId: location.id,
            locationName: location.name,
            selectedLocationId: selectedLocationIdRef.current,
            isMarkerSelected: isMarkerSelected,
            willBeRed: isMarkerSelected
          });
        }

        // 선택된 멤버의 장소인지 확인 (selectedMemberSavedLocations에 있는지 체크)
        const isSelectedMemberLocation = selectedMember && selectedMemberSavedLocations &&
          selectedMemberSavedLocations.some(selectedLoc => selectedLoc.id === location.id);

        // 🚨 마커 색상 및 크기 결정: 선택된 마커만 빨간색으로 강조
        let markerColor = '#3b82f6'; // 기본 색상 (파란색)
        let markerSize = '24px'; // 기본 크기
        let markerZIndex = 160;

        if (isMarkerSelected) {
          markerColor = '#ef4444'; // 선택된 마커만 빨간색으로 강조
          markerSize = '28px'; // 선택된 마커는 더 크게
          markerZIndex = 220;
        }
        // 🚨 기본 크기를 26px로 통일 (24px 제거)

        const memberCount = members.length;

        // 🚨 중복 마커 방지: 완전히 새로운 마커 생성 방식으로 변경
        const key = String(location.id);

        // 🚨 기존 마커 재사용 로직 제거 - 항상 새로운 마커 생성하여 중복 방지
        console.log(`[updateAllMarkers] 🆕 새로운 장소 마커 생성: ${location.name} (ID: ${location.id}, 색상: ${markerColor === '#ef4444' ? '빨간색' : '파란색'})`);

        // 🚨 마커 생성 전 중복 체크 강화
        const isDuplicateInNewMarkers = newLocationMarkers.some(marker =>
          (marker as any).__locationId === location.id
        );

        if (isDuplicateInNewMarkers) {
          console.log(`[updateAllMarkers] ❌ 중복 마커 방지: ${location.name} (ID: ${location.id}) - 이미 생성됨`);
          return;
        }

        // 🚨 새로운 마커 생성
        try {
          const marker = new window.naver.maps.Marker({
            position,
            map: map,
            title: location.name,
            icon: {
              content: `
              <div style="position: relative; text-align: center;">
                <div style="
                  width: ${markerSize};
                  height: ${markerSize};
                  background-color: white;
                  border: 2px solid ${markerColor};
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                  transition: all 0.3s ease;
                ">
                  <svg width="${markerSize === '28px' ? '16' : '14'}" height="${markerSize === '28px' ? '16' : '14'}" fill="${markerColor}" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                  </svg>
                </div>
                ${isMarkerSelected ? `
                  <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 40px;
                    height: 40px;
                    background: rgba(236, 72, 153, 0.2);
                    border-radius: 50%;
                    animation: selectedGlow 2s ease-in-out infinite;
                    z-index: -1;
                  "></div>
                  <style>
                    @keyframes selectedGlow {
                      0%, 100% { 
                        transform: translate(-50%, -50%) scale(0.8);
                        opacity: 0.4; 
                      }
                      50% {
                        transform: translate(-50%, -50%) scale(1.2);
                        opacity: 0.1; 
                      }
                    }
                  </style>
                ` : ''}
                <div style="
                  position: absolute;
                  bottom: -18px;
                  left: 50%;
                  transform: translateX(-50%);
                  background-color: rgba(0,0,0,0.7);
                  color: white;
                  padding: 2px 5px;
                  border-radius: 3px;
                  white-space: nowrap;
                  font-size: 10px;
                  font-weight: 500;
                  max-width: 80px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                ">
                  ${location.name || (location as any).slt_title || '제목 없음'}
                </div>
              </div>
            `,
              size: new window.naver.maps.Size(parseInt(markerSize), parseInt(markerSize)),
              anchor: new window.naver.maps.Point(parseInt(markerSize) / 2, parseInt(markerSize) / 2)
            },
            zIndex: markerZIndex
          });

          // 🚨 마커에 고유 식별자 추가 - 중복 방지를 위한 핵심
          (marker as any).__key = key;
          (marker as any).__locationId = location.id;
          (marker as any).__isLocationMarker = true;

          // 🚨 마커 클릭 이벤트 추가
          window.naver.maps.Event.addListener(marker, 'click', () => {
            console.log(`[updateAllMarkers] 🎯 장소 마커 클릭: ${location.name} (${location.id})`);

            // 🚨 마커 클릭 플래그 설정 (지도 클릭 이벤트 무시용)
            isMarkerClickingRef.current = true;

            // 🚨 기존 InfoWindow 닫기
            if (infoWindow) {
              console.log('[장소 마커 클릭] 기존 InfoWindow 닫기');
              infoWindow.close();
            }

            // 🚨 장소 위치로 지도 중심 이동
            const [lng, lat] = location.coordinates;
            const position = createSafeLatLng(lat, lng);
            if (!position) {
              console.warn('[장소 마커 클릭] LatLng 생성 실패');
              return;
            }

            map.setCenter(position);

            // 🚨 1단계: InfoWindow 즉시 생성 및 표시 (마커 스타일 업데이트 전에!)
            const newInfoWindow = createLocationInfoWindow(
              location.name || (location as any).slt_title || '제목 없음',
              location.address || (location as any).slt_add || '주소 정보 없음',
              location
            );
            newInfoWindow.open(map, marker);
            setInfoWindow(newInfoWindow);

            console.log('[장소 마커 클릭] InfoWindow 즉시 생성 및 표시 완료 (최우선):', {
              장소명: location.name,
              InfoWindow: !!newInfoWindow,
              마커: !!marker
            });

            // 🚨 2단계: ref 업데이트
            const previousSelectedId = selectedLocationIdRef.current;
            selectedLocationIdRef.current = location.id;

            console.log('[장소 마커 클릭] ref 업데이트:', {
              이전선택: previousSelectedId,
              현재선택: location.id,
              장소명: location.name
            });

            // 🚨 3단계: 마커 스타일 업데이트 (InfoWindow 표시 후)
            // setTimeout을 사용하여 InfoWindow가 완전히 표시된 후 마커 스타일 업데이트
            setTimeout(() => {
              updateAllLocationMarkerStyles(location.id);
              console.log('[장소 마커 클릭] 마커 스타일 업데이트 완료 (InfoWindow 표시 후)');
            }, 10);

            // 🚨 4단계: 선택 상태 업데이트 (React 상태 동기화)
            setTimeout(() => {
              setSelectedLocationId(location.id);
              console.log('[장소 마커 클릭] 선택 상태 업데이트 완료');

              // 🚨 마커 클릭 플래그 리셋 (약간의 지연 후 - 지도 클릭 이벤트가 처리된 후)
              setTimeout(() => {
                isMarkerClickingRef.current = false;
              }, 100);
            }, 20);
          });

          // 🚨 마커 생성 직후 지도 표시 상태 강제 확인 및 설정
          if (marker && map) {
            // 마커가 지도에 표시되었는지 즉시 확인
            const markerOnMap = marker.getMap && marker.getMap();
            if (!markerOnMap) {
              console.warn(`[updateAllMarkers] 🚨 마커 생성 직후 지도에 표시되지 않음 - 강제 설정: ${location.name}`);
              marker.setMap(map);
            }

            // 마커 가시성 강제 설정
            if (marker.setVisible) {
              marker.setVisible(true);
            }

            // 마커 위치 재확인
            if (marker.getPosition) {
              const markerPos = marker.getPosition();
              console.log(`[updateAllMarkers] 🚨 마커 생성 직후 위치 확인: ${location.name}`, {
                설정된위치: `${lat}, ${lng}`,
                실제위치: `${markerPos.lat()}, ${markerPos.lng()}`,
                지도에표시됨: !!marker.getMap && !!marker.getMap()
              });
            }
          }

          // 🚨 마커 가시성 강제 설정
          if (marker.setVisible) {
            marker.setVisible(true);
            console.log(`[updateAllMarkers] 🚨 마커 가시성 강제 설정: ${location.name}`);
          }

          // 🚨 마커 생성 직후 지도 설정 확인
          console.log(`[updateAllMarkers] 🚨 마커 생성 직후 상태 확인: ${location.name}`, {
            마커객체존재: !!marker,
            지도객체존재: !!map,
            마커의지도: marker.getMap ? !!marker.getMap() : '메서드없음',
            마커위치: marker.getPosition ? `${marker.getPosition().lat()}, ${marker.getPosition().lng()}` : '위치없음',
            마커제목: marker.getTitle ? marker.getTitle() : '제목없음'
          });

          // 🚨 마커를 배열에 추가 - 중복 방지 강화
          newLocationMarkers.push(marker);
          console.log(`[updateAllMarkers] ✅ 새 마커 생성 및 배열 추가: ${location.name} (ID: ${location.id})`);

          // 🚨 마커가 지도에 제대로 표시되었는지 즉시 확인
          const markerOnMap = marker.getMap && marker.getMap();
          if (!markerOnMap && map) {
            console.warn(`[updateAllMarkers] 🚨 마커가 지도에 없음 - 강제 재설정: ${location.name}`);
            marker.setMap(map);
          }

        } catch (markerError) {
          console.error(`[updateAllMarkers] 장소 마커 생성 실패: ${location.name}`, markerError);
        }
      }); // locations.forEach 루프 종료

      console.log('[updateAllMarkers] 🎯 새로운 장소 마커 생성 완료');

      // 🚨 마커 상태 업데이트는 아래쪽에서 통합 처리 (중복 제거)

      console.log('[updateAllMarkers] 🎯 선택된 멤버의 장소 마커 처리 완료:', {
        selectedMemberName: selectedMember?.name || '없음',
        totalMarkersCreated: newLocationMarkers.length,
        expectedCount: locations!.length,
        createdMarkers: newLocationMarkers.map((marker, idx) => ({
          index: idx,
          title: marker.getTitle?.() || '제목없음',
          position: marker.getPosition ? { lat: marker.getPosition().lat(), lng: marker.getPosition().lng() } : '위치없음'
        }))
      });
    } else {
      // *** 중요: 선택된 멤버가 없거나 장소 데이터가 없으면 장소 마커를 생성하지 않음 ***
      // 이제 선택된 멤버의 장소 마커만 표시하므로 이 조건은 거의 발생하지 않음
      console.log('[updateAllMarkers] 🚫 장소 마커 생성 건너뜀:', {
        hasSelectedMember: !!selectedMember,
        selectedMemberName: selectedMember?.name || '없음',
        hasLocations: !!locations,
        locationsLength: Array.isArray(locations) ? locations.length : 0,
        reason: !selectedMember ? '선택된 멤버 없음' : !Array.isArray(locations) ? '장소 데이터가 배열이 아님' : '장소 배열 비어있음'
      });

      // 🚨 장소 데이터가 없어도 기존 장소 마커 상태 초기화
      console.log('[updateAllMarkers] 🚨 장소 데이터 없음 - 기존 장소 마커 상태 초기화');
      setMarkers([]);
      locationMarkersRef.current = [];
    }

    // 상태 업데이트 (배치 처리로 리렌더링 최소화)
    console.log('[updateAllMarkers] 🔄 상태 업데이트 시작:', {
      이전멤버마커수: memberMarkers.length,
      이전장소마커수: markers.length,
      새멤버마커수: newMemberMarkers.length,
      새장소마커수: newLocationMarkers.length,
      보존모드: shouldPreserveMarkers
    });

    // 🚨 마커 상태 업데이트 - 순차적 업데이트로 안정성 확보
    console.log('[updateAllMarkers] 🚨 마커 상태 업데이트 시작');

    // 1. 멤버 마커 상태 업데이트
    setMemberMarkers(newMemberMarkers);
    memberMarkersRef.current = newMemberMarkers;
    console.log('[updateAllMarkers] 🚨 멤버 마커 상태 업데이트 완료:', newMemberMarkers.length);

    // 2. 장소 마커 상태 업데이트
    setMarkers(newLocationMarkers);
    locationMarkersRef.current = newLocationMarkers;
    console.log('[updateAllMarkers] 🚨 장소 마커 상태 업데이트 완료:', newLocationMarkers.length);

    // 3. 마커 표시 상태 확인 (디버깅용 로그만)
    // 🚨 현재 선택된 멤버 ID 캡처 (멤버 변경 감지용)
    const capturedSelectedMemberId = selectedMemberIdRef.current;

    setTimeout(() => {
      // 🚨 핵심 수정: 멤버가 변경되었으면 마커 복원 건너뜀
      // (handleMemberChange가 새 마커를 생성했을 수 있음)
      if (selectedMemberIdRef.current !== capturedSelectedMemberId) {
        console.log('[updateAllMarkers] setTimeout - 멤버 변경됨, 마커 복원 건너뜀:', {
          캡처된멤버: capturedSelectedMemberId,
          현재멤버: selectedMemberIdRef.current
        });
        return;
      }

      // 멤버 마커 표시 상태 확인
      const visibleMemberMarkers = newMemberMarkers.filter(marker => {
        try {
          return marker && marker.getMap && marker.getMap() === map;
        } catch (e) {
          return false;
        }
      });

      const invisibleMemberMarkers = newMemberMarkers.filter(marker => {
        try {
          return marker && (!marker.getMap || marker.getMap() !== map);
        } catch (e) {
          return true;
        }
      });

      // 🚨 핵심 수정: locationMarkersRef.current 사용 (stale closure 방지)
      // newLocationMarkers 대신 최신 ref 사용
      const currentLocationMarkers = locationMarkersRef.current || [];

      const visibleLocationMarkers = currentLocationMarkers.filter(marker => {
        try {
          return marker && marker.getMap && marker.getMap() === map;
        } catch (e) {
          return false;
        }
      });

      const invisibleLocationMarkers = currentLocationMarkers.filter(marker => {
        try {
          return marker && (!marker.getMap || marker.getMap() !== map);
        } catch (e) {
          return true;
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[updateAllMarkers] 마커 표시 상태 확인:', {
          멤버마커_표시됨: visibleMemberMarkers.length,
          멤버마커_숨겨짐: invisibleMemberMarkers.length,
          장소마커_표시됨: visibleLocationMarkers.length,
          장소마커_숨겨짐: invisibleLocationMarkers.length
        });
      }

      // 마커 표시 상태가 잘못된 경우에만 재설정
      if (invisibleMemberMarkers.length > 0) {
        console.warn('[updateAllMarkers] 지도에 표시되지 않은 멤버 마커 재설정:', invisibleMemberMarkers.length);
        invisibleMemberMarkers.forEach(marker => {
          try {
            if (marker && map) {
              marker.setMap(map);
            }
          } catch (e) {
            console.warn('[updateAllMarkers] 멤버 마커 표시 실패:', e);
          }
        });
      }

      // 🚨 핵심 수정: 장소 마커 복원 시에도 멤버 변경 여부 재확인
      if (invisibleLocationMarkers.length > 0 && selectedMemberIdRef.current === capturedSelectedMemberId) {
        console.warn('[updateAllMarkers] 지도에 표시되지 않은 장소 마커 재설정:', invisibleLocationMarkers.length);
        invisibleLocationMarkers.forEach(marker => {
          try {
            if (marker && map) {
              marker.setMap(map);
            }
          } catch (e) {
            console.warn('[updateAllMarkers] 장소 마커 표시 실패:', e);
          }
        });
      }
    }, 200);

    console.log('[updateAllMarkers] ✅ 완료 - 멤버 마커:', newMemberMarkers.length, '개, 선택된 멤버의 장소 마커:', newLocationMarkers.length, '개');
    console.log('[updateAllMarkers] ✅ 핵심 결과: 선택된 멤버', selectedMember?.name || '없음', '의 장소 마커 표시, 선택된 장소는 강조 표시');

    // 마커 업데이트 완료 - 플래그 해제
    isUpdatingMarkersRef.current = false;
  }, [map, isMapReady, memberMarkers, markers, infoWindow, selectedLocationIdRef, lastMarkersSignatureRef, parseCoordinate, createSafeLatLng]);


  // 멤버 선택 상태 변경 시 마커 색상 업데이트 (최적화)
  useEffect(() => {
    if (groupMembers.length > 0 && memberMarkers.length > 0 && map && isMapReady) {
      // 선택된 멤버가 변경되었는지 확인
      const selectedMember = groupMembers.find(m => m.isSelected);
      if (!selectedMember) return;

      // 이전 선택된 멤버와 다른지 확인
      const previousSelectedMemberId = memberMarkers.find(marker => {
        const markerKey = (marker as any).__key;
        return groupMembers.find(m => String(m.id) === markerKey && m.isSelected);
      });

      if (!previousSelectedMemberId) {
        console.log('[useEffect 멤버 선택] 마커 색상 업데이트 실행');

        memberMarkers.forEach((marker, index) => {
          try {
            const markerKey = (marker as any).__key;
            if (!markerKey) return;

            const member = groupMembers.find(m => String(m.id) === markerKey || String(m.name) === markerKey);
            if (!member) return;

            const borderColor = member.isSelected ? '#ef4444' : '#3b82f6';
            const photoForMarker = getSafeImageUrl(member.photo, member.mt_gender, member.original_index);

            const updatedIconContent = `
              <div style="position: relative; text-align: center;">
                <div style="width: 28px; height: 28px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                  <img
                    src="${photoForMarker}"
                    alt="${member.name}"
                    style="width: 100%; height: 100%; object-fit: cover;"
                    onerror="this.src='/images/avatar1.png'"
                  />
                </div>
                <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; white-space: nowrap; font-size: 10px; font-weight: 500;">
                  ${member.name}
                </div>
              </div>
            `;

            marker.setIcon({
              content: updatedIconContent,
              size: new window.naver.maps.Size(60, 50),
              anchor: new window.naver.maps.Point(30, 32)
            });

            marker.setZIndex(member.isSelected ? 200 : 150);
          } catch (error) {
            console.warn(`[useEffect 멤버 선택] 마커 ${index} 색상 업데이트 실패:`, error);
          }
        });
      }
    }
  }, [groupMembers, memberMarkers, map, isMapReady]);

  // 멤버 마커와 선택된 멤버의 장소 마커를 동시 업데이트 (안정화된 버전)
  // 선택된 멤버 ID를 메모이제이션
  const selectedMemberId = useMemo(() => {
    return groupMembers.find(m => m.isSelected)?.id || null;
  }, [groupMembers]);

  useEffect(() => {
    // 마커 업데이트 중에는 실행하지 않음
    if (isUpdatingMarkersRef.current) {
      return;
    }

    // 지도와 멤버 데이터가 준비되었고, 첫 번째 멤버 선택이 완료된 경우에만 실행
    if (!map || !isMapReady || groupMembers.length === 0 || !isFirstMemberSelectionComplete || !selectedMemberId) {
      return;
    }

    const selectedMember = groupMembers.find(m => m.id === selectedMemberId);
    if (!selectedMember) {
      return;
    }

    // 🚨 선택된 멤버의 장소 데이터 수집 - selectedMemberSavedLocations 우선 사용
    // 초기 진입 시 groupMembers.savedLocations가 아직 업데이트되지 않았을 수 있으므로
    // selectedMemberSavedLocations 상태를 우선적으로 사용
    const allLocations: LocationData[] = [];

    // 🚨 핵심 수정: selectedMemberSavedLocations 우선 사용 (초기 진입 시 마커 표시 보장)
    if (selectedMemberSavedLocations && selectedMemberSavedLocations.length > 0) {
      console.log('[useEffect 통합 마커] selectedMemberSavedLocations에서 장소 데이터 사용:', selectedMemberSavedLocations.length, '개');
      allLocations.push(...selectedMemberSavedLocations);
    } else if (selectedMember.savedLocations && selectedMember.savedLocations.length > 0) {
      console.log('[useEffect 통합 마커] selectedMember.savedLocations에서 장소 데이터 사용:', selectedMember.savedLocations.length, '개');
      allLocations.push(...selectedMember.savedLocations);
    }

    // 🚨 핵심 수정: 멤버가 변경되었는지 확인 (이전 멤버 ID와 비교)
    const memberChanged = previousSelectedMemberIdRef.current !== selectedMemberId;
    const shouldForceUpdate = memberChanged; // 멤버 변경 시 강제 업데이트

    if (memberChanged) {
      console.log('[useEffect 통합 마커] 🚨 멤버 변경 감지 - 강제 업데이트:', {
        이전멤버: previousSelectedMemberIdRef.current,
        현재멤버: selectedMemberId
      });
      // 이전 멤버 ID 업데이트
      previousSelectedMemberIdRef.current = selectedMemberId;
    }

    // 최근 업데이트 시간 체크 (1초 이내 재호출 방지) - 🚨 멤버 변경 시에는 우회
    const now = Date.now();
    if (!shouldForceUpdate && now - lastMarkerUpdateTimeRef.current < 1000) {
      console.log('[useEffect 통합 마커] 최근 업데이트 (1초 이내) - 중복 실행 방지');
      return;
    }

    console.log('[useEffect 통합 마커] 마커 업데이트 실행:', {
      selectedMemberName: selectedMember?.name,
      locationsCount: allLocations.length,
      source: selectedMemberSavedLocations?.length ? 'selectedMemberSavedLocations' : 'selectedMember.savedLocations',
      forceUpdate: shouldForceUpdate,
      memberChanged
    });
    // 🚨 멤버 변경 시에는 강제 업데이트 모드로 마커 업데이트 실행
    updateAllMarkers(groupMembers, allLocations, shouldForceUpdate);
  }, [map, isMapReady, groupMembers.length, isFirstMemberSelectionComplete, selectedMemberId, selectedMemberSavedLocations, updateAllMarkers]);

  // 선택된 멤버 변경 또는 멤버 마커 생성 후 InfoWindow 자동 표시 보강
  useEffect(() => {
    if (!map || !isMapReady) return;
    // 장소 선택 중에는 자동 표시 방지
    if (isLocationSelectingRef.current) return;

    const sel = groupMembers.find(m => m.isSelected);
    if (!sel) return;

    // 이미 열려 있으면 재생성하지 않음
    try {
      if (infoWindow && infoWindow.getMap()) return;
    } catch (_) { }

    // 네비게이션/라우팅 결과로 리렌더링된 경우 자동 오픈 방지
    if (!shouldAutoOpenInfoWindowRef.current) return;
    // InfoWindow 자동 생성
    openInfoWindowForSelectedMember();
    shouldAutoOpenInfoWindowRef.current = false;
    // 클린업: 의존성 변경/언마운트 시 pending 타이머 정리
    return () => {
      if (autoInfoWindowTimeoutRef.current) {
        clearTimeout(autoInfoWindowTimeoutRef.current);
        autoInfoWindowTimeoutRef.current = null;
      }
    };
  }, [groupMembers, memberMarkers, map, isMapReady, infoWindow]);



  // 마커 색상 업데이트 함수
  const updateMarkerColors = (selectedId: string | null) => {
    console.log('[updateMarkerColors] 마커 색상 업데이트:', selectedId);

    markers.forEach((marker, index) => {
      // selectedMemberSavedLocations 또는 otherMembersSavedLocations에서 해당 location 찾기
      let location = null;

      if (selectedMemberSavedLocations && selectedMemberSavedLocations[index]) {
        location = selectedMemberSavedLocations[index];
      } else if (otherMembersSavedLocations && otherMembersSavedLocations[index]) {
        location = otherMembersSavedLocations[index];
        // otherMembersSavedLocations의 경우 id 구성이 다를 수 있음
        location = {
          ...location,
          id: location.slt_idx ? location.slt_idx.toString() : location.id
        };
      }

      if (location) {
        const isSelected = selectedId === location.id;

        // 마커 아이콘 업데이트
        marker.setIcon({
          content: `
            <div style="position: relative; text-align: center;">
              <div style="
                width: 28px;
                height: 28px;
                background-color: white;
                border: 2px solid ${isSelected ? '#f59e0b' : '#6366f1'};
                border-radius: 50%;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                position: relative;
                z-index: ${isSelected ? '200' : '150'};
                transition: all 0.3s ease;
              ">
                <svg width="16" height="16" fill="${isSelected ? '#ef4444' : '#3b82f6'}" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                </svg>
              </div>
              
              ${isSelected ? `
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 40px;
                  height: 40px;
                  background: rgba(236, 72, 153, 0.2);
                  border-radius: 50%;
                  animation: selectedGlow 2s ease-in-out infinite;
                  z-index: 140;
                "></div>
              ` : ''}
              
              <div style="
                position: absolute;
                bottom: -18px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0,0,0,0.7);
                color: white;
                padding: 2px 5px;
                border-radius: 3px;
                white-space: nowrap;
                font-size: 10px;
                font-weight: 500;
                max-width: 80px;
                overflow: hidden;
                text-overflow: ellipsis;
              ">
                ${location.name || (location as any).slt_title || '제목 없음'}
              </div>
            </div>
            
            <style>
              @keyframes selectedGlow {
                0%, 100% { 
                  transform: translate(-50%, -50%) scale(0.8);
                  opacity: 0.4; 
                }
                50% {
                  transform: translate(-50%, -50%) scale(1.2);
                  opacity: 0.1; 
                }
              }
            </style>
          `,
          anchor: new window.naver.maps.Point(16, 16)
        });

        // z-index 업데이트
        marker.setZIndex(isSelected ? 200 : 150);
      }
    });
  };
  // 🚨 모든 장소 마커의 스타일을 업데이트하는 헬퍼 함수 (이벤트 리스너 제거 방지)
  const updateAllLocationMarkerStyles = useCallback((selectedId: string | null) => {
    if (!selectedMemberSavedLocations || !locationMarkersRef.current || locationMarkersRef.current.length === 0) {
      return;
    }

    console.log('[updateAllLocationMarkerStyles] 모든 장소 마커 스타일 업데이트 시작:', selectedId);

    locationMarkersRef.current.forEach((m, idx) => {
      const loc = selectedMemberSavedLocations[idx];
      if (loc && m) {
        const isSelected = loc.id === selectedId || loc.slt_idx?.toString() === selectedId;
        const markerColor = isSelected ? '#ef4444' : '#3b82f6';

        m.setIcon({
          content: `
            <div style="position: relative; text-align: center;">
              <div style="
                width: 28px;
                height: 28px;
                background-color: white;
                border: 2px solid ${markerColor};
                border-radius: 50%;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                position: relative;
                z-index: ${isSelected ? '200' : '150'};
                transition: all 0.3s ease;
              ">
                <svg width="16" height="16" fill="${markerColor}" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                </svg>
              </div>
              
              ${isSelected ? `
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 40px;
                  height: 40px;
                  background: rgba(245, 158, 11, 0.2);
                  border-radius: 50%;
                  animation: selectedGlow 2s ease-in-out infinite;
                  z-index: 140;
                "></div>
              ` : ''}
              
              <div style="
                position: absolute;
                bottom: -18px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0,0,0,0.7);
                color: white;
                padding: 2px 5px;
                border-radius: 3px;
                white-space: nowrap;
                font-size: 10px;
                font-weight: 500;
                pointer-events: none;
              ">${loc.name || (loc as any).slt_title || '제목 없음'}</div>
            </div>
          `,
          anchor: new window.naver.maps.Point(14, 14)
        });
        m.setZIndex(isSelected ? 200 : 150);
      }
    });

    console.log('[updateAllLocationMarkerStyles] 모든 장소 마커 스타일 업데이트 완료');
  }, [selectedMemberSavedLocations]);

  // 선택된 장소가 변경될 때만 마커 스타일 업데이트 (무한 루프 방지)
  // 🚨 완전히 비활성화 - 마커 클릭 시 updateAllLocationMarkerStyles()로 이미 스타일 업데이트하므로 중복 실행 방지
  // 이 useEffect가 실행되면 setIcon으로 인해 이벤트 리스너가 사라질 수 있음
  useEffect(() => {
    // 🚨 마커 클릭으로 인한 업데이트는 이미 완료되었으므로 건너뜀
    console.log('[useEffect] 선택된 장소 변경 감지 - updateAllLocationMarkerStyles()로 이미 업데이트됨, 건너뜀');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId]); // selectedLocationId가 변경될 때만 실행

  // 🚨 아래 코드는 비활성화됨 (주석 처리)
  /*
  useEffect(() => {
    if (selectedMemberSavedLocations && selectedMemberSavedLocations.length > 0 && markers.length > 0) {
      console.log('[useEffect] 선택된 장소 변경으로 마커 스타일 업데이트:', selectedLocationIdRef.current);
      
      // 기존 마커들의 스타일만 업데이트 (재생성 없이)
      markers.forEach((marker, index) => {
        const location = selectedMemberSavedLocations[index];
        if (location) {
          const isSelected = selectedLocationIdRef.current === location.id;
          
          // 마커 아이콘 업데이트
          marker.setIcon({
            content: `
              <div style="position: relative; text-align: center;">
                <div style="
                  width: 28px;
                  height: 28px;
                  background-color: white;
                  border: 2px solid ${isSelected ? '#ef4444' : '#3b82f6'};
                  border-radius: 50%;
                  overflow: hidden;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                  position: relative;
                  z-index: ${isSelected ? '200' : '150'};
                  transition: all 0.3s ease;
                ">
                  <svg width="16" height="16" fill="${isSelected ? '#ef4444' : '#3b82f6'}" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                  </svg>
                </div>
                
                ${isSelected ? `
                  <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 40px;
                    height: 40px;
                    background: rgba(245, 158, 11, 0.2);
                    border-radius: 50%;
                    animation: selectedGlow 2s ease-in-out infinite;
                    z-index: 140;
                  "></div>
                ` : ''}
                
                <div style="
                  position: absolute;
                  bottom: -18px;
                  left: 50%;
                  transform: translateX(-50%);
                  background-color: rgba(0,0,0,0.7);
                  color: white;
                  padding: 2px 5px;
                  border-radius: 3px;
                  white-space: nowrap;
                  font-size: 10px;
                  font-weight: 500;
                  max-width: 80px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                ">
                  ${location.name}
                </div>
              </div>
              
              <style>
                @keyframes selectedGlow {
                  0%, 100% { 
                    transform: translate(-50%, -50%) scale(0.8); 
                    opacity: 0.4; 
                  }
                  50% { 
                    transform: translate(-50%, -50%) scale(1.2); 
                    opacity: 0.1; 
                  }
                }
              </style>
            `,
            anchor: new window.naver.maps.Point(16, 16)
          });
          
          // z-index 업데이트
          marker.setZIndex(isSelected ? 200 : 150);
        }
      });
    }
  }, [selectedLocationId]);
  */


  // 🚨 멤버 InfoWindow 생성 함수 - 강화된 버전
  const createMemberInfoWindow = (member: GroupMember, marker: NaverMarker) => {
    if (!map || !window.naver?.maps) {
      console.warn('[createMemberInfoWindow] 맵 또는 네이버 맵스 API 없음');
      return;
    }

    // 🚨 InfoWindow 생성 (위치 정보가 없어도 생성하되, 내용에서 처리)
    console.log('[createMemberInfoWindow] 🚨 InfoWindow 생성 시작:', member.name);

    console.log('[createMemberInfoWindow] 🚨 시작:', {
      memberName: member.name,
      memberId: member.id,
      hasMarker: !!marker,
      markerOnMap: marker?.getMap ? !!marker.getMap() : false,
      mapReady: !!map,
      battery: member.mlt_battery
    });

    // 🚨 getSafeImageUrl 호출 수정 - 올바른 파라미터 전달
    const photoUrl = getSafeImageUrl(member.mt_file1, member.mt_gender, member.original_index);
    const lat = member.mlt_lat || 0;
    const lng = member.mlt_long || 0;

    const memberInfoWindow = new window.naver.maps.InfoWindow({
      content: `
        <style>
          @keyframes slideInFromBottom {
            0% {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          .member-info-window-container {
            animation: slideInFromBottom 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          }
          .close-button {
            transition: all 0.2s ease;
          }
          .close-button:hover {
            background: rgba(0, 0, 0, 0.2) !important;
            transform: scale(1.1);
          }
        </style>
        <div class="member-info-window-container" data-member-id="${member.id}" id="member-address-${member.id}" style="
          padding: 12px 16px;
          min-width: 200px;
          max-width: 280px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          position: relative;
        ">
          <!-- 닫기 버튼 -->
          <button class="close-button" onclick="this.parentElement.parentElement.style.display='none'; event.stopPropagation();" style="
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.1);
            border: none;
            border-radius: 50%;
            width: 22px;
            height: 22px;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
          ">×</button>

          <div style="
            display: flex;
            align-items: center;
            margin-bottom: 8px;
          ">
            <div style="
              width: 40px;
              height: 40px;
              border-radius: 50%;
              overflow: hidden;
              margin-right: 12px;
              border: 2px solid #f59e0b;
              flex-shrink: 0;
            ">
              <img src="${photoUrl}" 
                   style="width: 100%; height: 100%; object-fit: cover;" 
                   alt="${member.name}" />
            </div>
            <div style="padding-right: 25px;">
              <h3 style="
                margin: 0;
                font-size: 14px;
                font-weight: 600;
                color: #111827;
              ">${member.name}</h3>
              <p style="
                margin: 2px 0 0 0;
                font-size: 12px;
                color: #64748b;
              ">그룹 멤버</p>
            </div>
          </div>
          

          
          <div style="margin-bottom: 4px;">
            <div style="display: flex; align-items: center; font-size: 11px; color: #9ca3af;">
              <span style="flex-shrink: 0;">🕐 </span>
              <span style="margin-left: 2px;">
                마지막 업데이트: ${member.mlt_gps_time ? formatTimeToMMDDHHMM(member.mlt_gps_time) : '알 수 없음'}
              </span>
            </div>
          </div>

          <div style="margin-bottom: 4px;">
            <div style="display: flex; align-items: center; font-size: 11px; color: #9ca3af;">
              <span style="flex-shrink: 0;">🔋 </span>
              <span style="margin-left: 2px;">
                배터리: ${member.mlt_battery !== null && member.mlt_battery !== undefined ? `${member.mlt_battery}%` : '정보 없음'}
              </span>
            </div>
          </div>
        </div>
      `,
      borderWidth: 0,
      backgroundColor: 'transparent',
      disableAnchor: true,
      pixelOffset: new window.naver.maps.Point(0, -50) // 🚨 마커 위쪽으로 위치 조정
    });

    // InfoWindow 열기 (단순화된 로직)
    try {
      // 🚨 핵심 수정: 마커의 getPosition()으로 위치를 직접 가져옴
      const markerPosition = marker?.getPosition?.();
      const markerOnMap = marker?.getMap ? !!marker.getMap() : false;

      console.log('[createMemberInfoWindow] InfoWindow 열기 시도:', {
        markerExists: !!marker,
        markerOnMap,
        hasPosition: !!markerPosition,
        position: markerPosition ? `${markerPosition.lat()}, ${markerPosition.lng()}` : 'null'
      });

      // 🚨 마커 위치가 있으면 해당 위치에 InfoWindow 표시 (getMap() 비교 제거)
      if (marker && markerPosition) {
        // 마커 위치를 직접 사용하여 InfoWindow 열기
        memberInfoWindow.open(map, markerPosition as any);
        setInfoWindow(memberInfoWindow);
        console.log('[createMemberInfoWindow] InfoWindow 마커 위치에 표시 완료:', {
          lat: markerPosition.lat(),
          lng: markerPosition.lng()
        });
      } else if (marker && marker.getMap && marker.getMap()) {
        // 위치를 못 가져왔지만 마커가 지도에 있으면 마커에 직접 연결
        memberInfoWindow.open(map, marker);
        setInfoWindow(memberInfoWindow);
        console.log('[createMemberInfoWindow] InfoWindow 마커에 직접 연결 표시 완료');
      } else {
        // 마커가 없거나 위치가 없으면 기본 위치(서울 중심)에 표시
        const defaultPos = createSafeLatLng(37.5665, 126.9780);
        if (defaultPos) {
          memberInfoWindow.open(map, defaultPos as any);
          setInfoWindow(memberInfoWindow);
          console.log('[createMemberInfoWindow] InfoWindow 기본 위치에 표시 완료');
        }
      }
    } catch (e) {
      console.error('[createMemberInfoWindow] InfoWindow 열기 실패:', e);
    }

    // 주소 변환 제거

    console.log('[createMemberInfoWindow] 멤버 InfoWindow 생성 완료:', member.name);
  };

  // 통일된 정보창 생성 함수 - home/page.tsx 스타일 적용 + 삭제 버튼 추가
  const createLocationInfoWindow = (locationName: string, locationAddress: string, locationData?: OtherMemberLocationRaw | LocationData) => {
    // 🚨 강화된 locationId 추출 로직
    const getLocationId = (data: OtherMemberLocationRaw | LocationData) => {
      // slt_idx가 있으면 우선 사용 (DB의 실제 ID)
      if ('slt_idx' in data && data.slt_idx) {
        return data.slt_idx.toString();
      }
      // 그 다음 id 사용
      if (data.id) {
        // temp_ 접두사 제거
        const cleanId = data.id.toString().replace(/^temp_/, '');
        return cleanId;
      }
      return '';
    };

    const locationId = locationData ? getLocationId(locationData) : '';
    console.log('[createLocationInfoWindow] locationId 추출:', {
      locationData,
      extractedId: locationId,
      slt_idx: locationData && 'slt_idx' in locationData ? locationData.slt_idx : null,
      id: locationData?.id
    });

    // 🆕 slt_title을 고려한 장소명 처리
    const displayName = locationData && 'slt_title' in locationData && locationData.slt_title
      ? locationData.slt_title
      : locationName;

    const newInfoWindow = new window.naver.maps.InfoWindow({
      content: `
        <style>
          @keyframes slideInFromBottom {
            0% {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          .location-info-window-container {
            animation: slideInFromBottom 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          }
          .info-button {
            transition: all 0.2s ease;
            border: none;
            border-radius: 50%;
            width: 22px;
            height: 22px;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            top: 8px;
          }
          .close-button {
            background: rgba(0, 0, 0, 0.1) !important;
            color: #666 !important;
            right: 8px;
            z-index: 999999 !important;
            pointer-events: auto !important;
            position: absolute !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            touch-action: manipulation !important;
          }
          .close-button:hover {
            background: rgba(0, 0, 0, 0.2) !important;
            color: #333 !important;
            transform: scale(1.1) !important;
          }
          .close-button:active {
            background: rgba(0, 0, 0, 0.3) !important;
            transform: scale(1.05) !important;
          }
          .delete-button {
            background: rgba(153, 27, 27, 0.1);
            color: #991b1b;
            right: 38px;
            z-index: 10000 !important;
            pointer-events: auto !important;
            position: absolute !important;
          }
          .delete-button:hover {
            background: rgba(153, 27, 27, 0.2) !important;
            transform: scale(1.1);
          }
        </style>
        <div class="location-info-window-container" style="
          padding: 12px 16px;
          min-width: 200px;
          max-width: 280px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          position: relative;
        ">
          <!-- 삭제 버튼 -->
          ${locationData ? `
          <button class="info-button delete-button" 
            onclick="
              console.log('=== 삭제 버튼 onclick 실행 ===');
              console.log('삭제 버튼 클릭:', '${locationId}');
              window.ignoreInfoWindowClick = true;
              if(window.handleLocationDeleteFromInfoWindow) { 
                console.log('삭제 함수 호출 시작');
                window.handleLocationDeleteFromInfoWindow('${locationId}'); 
                console.log('삭제 함수 호출 완료');
              } else { 
                console.error('삭제 함수가 정의되지 않음'); 
              }
            " 
            onmousedown="console.log('삭제 버튼 mousedown'); window.ignoreInfoWindowClick = true;" 
            onmouseup="console.log('삭제 버튼 mouseup');"
            style="z-index: 9999; pointer-events: auto;"
            title="장소 삭제">
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z"/>
              <path d="M9 8V17H11V8H9ZM13 8V17H15V8H13Z"/>
            </svg>
          </button>
          ` : ''}
          
          <!-- 닫기 버튼 -->
          <button class="info-button close-button location-close-btn" 
                  data-action="close" 
                  style="z-index: 999999 !important; pointer-events: auto !important;"
                  title="닫기">
            ×
          </button>
          
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; padding-right: ${locationData ? '60px' : '30px'};">
            📍 ${displayName}
          </h3>
          <div style="margin-bottom: 6px;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              <span style="color: #64748b; font-weight: 500; word-break: keep-all;">${locationAddress}</span>
            </p>
          </div>
        </div>
      `,
      borderWidth: 0,
      backgroundColor: 'transparent',
      disableAnchor: true,
      pixelOffset: new window.naver.maps.Point(0, -10) // InfoWindow를 마커 위로 더 띄움 (간격 개선)
    });

    // InfoWindow가 닫힐 때 상태 업데이트
    window.naver.maps.Event.addListener(newInfoWindow, 'close', () => {
      console.log('[InfoWindow] 닫힘 이벤트 발생');
      setInfoWindow(null);
    });

    // 대안적 접근법: InfoWindow 자체에 클릭 이벤트 리스너 추가
    window.naver.maps.Event.addListener(newInfoWindow, 'domready', () => {
      console.log('[InfoWindow] DOM 준비 완료 - 클릭 이벤트 추가');
      try {
        // 네이버 지도 InfoWindow의 DOM 요소 직접 접근
        const iwContent = newInfoWindow.getContentElement ? newInfoWindow.getContentElement() : null;
        if (iwContent) {
          console.log('[InfoWindow] InfoWindow 컨텐트 요소 발견');

          // 이벤트 위임을 사용하여 닫기 버튼 클릭 감지
          iwContent.addEventListener('click', (e: Event) => {
            const target = e.target as HTMLElement;
            console.log('[InfoWindow] 컨텐트 클릭:', target.className, target.getAttribute('data-action'));

            if (target.matches('.location-close-btn') ||
              target.closest('.location-close-btn') ||
              target.getAttribute('data-action') === 'close') {
              console.log('[InfoWindow] 닫기 버튼 클릭 감지 - InfoWindow 닫기');
              e.stopPropagation();
              e.preventDefault();

              newInfoWindow.close();
              setInfoWindow(null);
            }
          });

          console.log('[InfoWindow] 이벤트 위임 추가 완료');
        }
      } catch (domReadyError) {
        console.warn('[InfoWindow] DOM ready 이벤트 처리 실패:', domReadyError);
      }
    });

    // InfoWindow 열린 후 DOM 요소에 직접 닫기 이벤트 연결 (개선된 접근법)
    setTimeout(() => {
      try {
        // 더 구체적인 선택자로 장소 InfoWindow의 닫기 버튼만 선택
        const locationCloseButtons = document.querySelectorAll('.location-close-btn[data-action="close"]');
        console.log('[DOM 이벤트] 찾은 장소 닫기 버튼 수:', locationCloseButtons.length);

        locationCloseButtons.forEach((button, index) => {
          // 기존 이벤트 리스너가 없는 경우에만 추가
          if (!button.hasAttribute('data-close-attached')) {
            // 여러 이벤트 타입으로 확실하게 잡기
            ['click', 'mousedown', 'touchstart'].forEach(eventType => {
              button.addEventListener(eventType, (e) => {
                console.log(`[DOM 이벤트] 장소 InfoWindow 닫기 버튼 ${eventType} 이벤트 감지`);
                e.stopPropagation();
                e.preventDefault();

                // 1차: 전역 함수 시도
                if ((window as any).closeInfoWindow) {
                  console.log('[DOM 이벤트] 전역 함수로 닫기 시도');
                  (window as any).closeInfoWindow();
                }
                // 2차: 직접 InfoWindow API 사용
                else if (newInfoWindow) {
                  console.log('[DOM 이벤트] 직접 InfoWindow API로 닫기');
                  newInfoWindow.close();
                  setInfoWindow(null);
                }
                // 3차: DOM 조작으로 강제 숨김
                else {
                  console.log('[DOM 이벤트] DOM 조작으로 강제 숨김');
                  try {
                    // 네이버 지도 InfoWindow 구조에 맞게 부모 요소들 탐색
                    let targetElement = button.closest('.location-info-window-container');
                    if (!targetElement) {
                      targetElement = button.parentElement;
                    }

                    // 여러 레벨 위로 올라가면서 InfoWindow 컨테이너 찾기
                    let current = targetElement;
                    for (let i = 0; i < 5 && current; i++) {
                      if (current instanceof HTMLElement) {
                        current.style.display = 'none';
                        current.style.visibility = 'hidden';
                        current.style.opacity = '0';
                      }
                      current = current.parentElement;
                    }
                    console.log('[DOM 이벤트] InfoWindow 강제 숨김 완료');
                  } catch (hideError) {
                    console.error('[DOM 이벤트] InfoWindow 강제 숨김 실패:', hideError);
                  }
                }
              }, { capture: true }); // 캡처링 단계에서 이벤트 잡기
            });

            button.setAttribute('data-close-attached', 'true');
            console.log(`[DOM 이벤트] 장소 닫기 버튼 ${index + 1} 이벤트 리스너 추가됨`);
          }
        });
      } catch (domError) {
        console.warn('[DOM 이벤트] 장소 닫기 버튼 이벤트 추가 실패:', domError);
      }
    }, 200); // 시간을 더 늘려서 DOM이 완전히 렌더링되도록

    return newInfoWindow;
  };

  // 장소 카드 클릭 핸들러
  const handleLocationCardClick = (location: OtherMemberLocationRaw) => {
    const lat = parseFloat(String(location.slt_lat || '0')) || 0;
    const lng = parseFloat(String(location.slt_long || '0')) || 0;

    // 선택된 장소 ID 설정 - 좌표와 관계없이 항상 설정
    const locationId = location.slt_idx ? location.slt_idx.toString() : location.id;
    const previousSelectedId = selectedLocationIdRef.current;

    // 상태 업데이트
    selectedLocationIdRef.current = locationId;

    // 🚨 마커 스타일 업데이트 (이벤트 리스너 제거 방지)
    updateAllLocationMarkerStyles(locationId);

    setSelectedLocationId(locationId);

    console.log('[handleLocationCardClick] 장소 선택됨:', locationId, location.name || location.slt_title, '이전 선택:', previousSelectedId);

    // 지도와 좌표가 유효한 경우에만 지도 이동 및 마커 처리
    if (!map || !window.naver || lat === 0 || lng === 0) {
      console.log('[handleLocationCardClick] 지도 이동 불가 - 좌표 없음 또는 지도 미초기화');
      return;
    }

    // 장소 위치로 지도 중심 이동
    const position = createSafeLatLng(lat, lng);
    if (!position) {
      console.warn('[handleLocationCardClick] LatLng 생성 실패');
      return;
    }

    // 지도 중심을 해당 위치로 이동
    map.setCenter(position);
    map.setZoom(16);

    // 해당 마커 클릭 시뮬레이션 (정보창 표시)
    const markerIndex = otherMembersSavedLocations.findIndex(loc =>
      (loc.slt_idx ? loc.slt_idx.toString() : loc.id) === locationId
    );

    if (markerIndex !== -1 && markers[markerIndex]) {
      // 기존 정보창 닫기
      if (infoWindow) {
        infoWindow.close();
      }

      // 통일된 정보창 생성 및 표시
      const locationName = location.name || location.slt_title || '제목 없음';
      const locationAddress = location.address || location.slt_add || '주소 정보 없음';

      const newInfoWindow = createLocationInfoWindow(locationName, locationAddress, location);
      newInfoWindow.open(map, markers[markerIndex]);
      setInfoWindow(newInfoWindow);
    }

    console.log('[handleLocationCardClick] 장소 카드 클릭:', location.name || location.slt_title || '제목 없음', '위치:', lat, lng);
  };

  // 지도 준비 완료 후 첫 번째 멤버 자동 선택 - 제거하여 무한 재조회 방지
  // useEffect(() => {
  //   if (isMapReady && groupMembers.length > 0 && !isFetchingGroupMembers) {
  //     const hasSelectedMember = groupMembers.some(member => member.isSelected);

  //     if (!hasSelectedMember) {
  //       console.log('[useEffect] 지도 준비 완료 - 첫 번째 멤버 자동 선택');
  //       handleMemberSelect(groupMembers[0].id, false, groupMembers);
  //     } else {
  //       // 이미 선택된 멤버가 있다면 해당 멤버의 장소 데이터 로드
  //       const selectedMember = groupMembers.find(m => m.isSelected);
  //       if (selectedMember && (!selectedMemberSavedLocations || selectedMemberSavedLocations.length === 0)) {
  //         console.log('[useEffect] 선택된 멤버의 장소 데이터 로드:', selectedMember.name);
  //         handleMemberSelect(selectedMember.id, false, groupMembers);
  //       }
  //     }
  //   }
  // }, [isMapReady, groupMembers, isFetchingGroupMembers]);

  // 장소 삭제 모달 열기
  const openLocationDeleteModal = (location: LocationData | OtherMemberLocationRaw) => {
    setLocationToDelete(location);
    setIsLocationDeleteModalOpen(true);
  };

  // 장소 삭제 모달 닫기
  const closeLocationDeleteModal = () => {
    if (!isDeletingLocation) {
      setLocationToDelete(null);
      setIsLocationDeleteModalOpen(false);
    }
  };

  // 실제 장소 삭제 처리
  const handleLocationDelete = async () => {
    if (!locationToDelete) return;

    setIsDeletingLocation(true);
    const locationName = 'slt_title' in locationToDelete ? locationToDelete.slt_title : locationToDelete.name;

    // 삭제 중 토스트 표시
    showToastModal('loading', '장소 삭제 중', `"${locationName}" 장소를 삭제하고 있습니다...`, false);

    try {
      const locationId = 'slt_idx' in locationToDelete ? locationToDelete.slt_idx?.toString() : locationToDelete.id;
      const sltIdx = 'slt_idx' in locationToDelete ? locationToDelete.slt_idx : null;

      console.log('[장소 삭제] 시작:', locationId, 'slt_idx:', sltIdx, locationName);

      // DB에서 실제 삭제 (locationId를 slt_idx로 사용)
      if (locationId && !isNaN(parseInt(locationId, 10))) {
        try {
          const deleteId = parseInt(locationId, 10);
          await locationService.deleteLocation(deleteId);
          console.log('[장소 삭제] DB 처리 성공 (실제 삭제):', deleteId);
        } catch (dbError) {
          console.error('[장소 삭제] DB 처리 실패:', dbError);
          hideToastModal();
          showToastModal('error', '삭제 실패', '장소 삭제 중 오류가 발생했습니다.');
          return;
        }
      } else {
        console.warn('[장소 삭제] DB 삭제 건너뜀 - 유효한 locationId가 없음:', locationId);
      }

      // UI 업데이트 로직
      if (selectedMemberSavedLocations) {
        setSelectedMemberSavedLocations(prev =>
          prev ? prev.filter(loc => loc.id !== locationId) : null
        );
      }

      if ('slt_idx' in locationToDelete && locationToDelete.slt_idx) {
        setOtherMembersSavedLocations(prev => prev.filter(loc => loc.slt_idx !== locationToDelete.slt_idx));
      }

      // groupMembers 상태 업데이트 (사이드바 목록과 개수 업데이트)
      setGroupMembers(prevMembers => prevMembers.map(member => {
        const updatedSavedLocations = member.savedLocations.filter(loc => loc.id !== locationId);
        return {
          ...member,
          savedLocations: updatedSavedLocations,
          savedLocationCount: updatedSavedLocations.length
        };
      }));

      // 🗺️ 지도에서 마커 제거 (중요!)
      console.log('[장소 삭제] 지도 마커 제거 시작, locationId:', locationId);
      const markerToRemove = locationMarkersRef.current.find(marker => {
        const markerId = (marker as any).locationId || (marker as any).id;
        return markerId === locationId || markerId?.toString() === locationId;
      });

      if (markerToRemove) {
        console.log('[장소 삭제] 마커 찾음, 지도에서 제거:', markerToRemove);
        markerToRemove.setMap(null); // 지도에서 마커 제거

        // markers 상태 업데이트
        setMarkers(prev => prev.filter(m => {
          const mId = (m as any).locationId || (m as any).id;
          return mId !== locationId && mId?.toString() !== locationId;
        }));

        // locationMarkersRef 업데이트
        locationMarkersRef.current = locationMarkersRef.current.filter(m => {
          const mId = (m as any).locationId || (m as any).id;
          return mId !== locationId && mId?.toString() !== locationId;
        });

        console.log('[장소 삭제] ✅ 지도 마커 제거 완료');
      } else {
        console.warn('[장소 삭제] ⚠️ 제거할 마커를 찾을 수 없음, locationId:', locationId);
        console.warn('[장소 삭제] 현재 마커 목록:', locationMarkersRef.current.map(m => ({
          id: (m as any).locationId || (m as any).id,
          marker: m
        })));
      }

      if (selectedLocationId === locationId) {
        setSelectedLocationId(null);
        selectedLocationIdRef.current = null;
      }

      setIsLocationInfoPanelOpen(false);
      setIsEditingPanel(false);
      if (infoWindow) {
        infoWindow.close();
        setInfoWindow(null);
      }

      // 삭제 모달 닫기
      closeLocationDeleteModal();

      // 성공 토스트 표시
      hideToastModal();
      showToastModal('success', '삭제 완료', `"${locationName}" 장소가 삭제되었습니다.`);

      // 선택된 멤버 위치로 지도 이동
      setTimeout(() => {
        moveToSelectedMember();
      }, 500);

    } catch (error) {
      console.error('장소 삭제 처리 중 전체 오류:', error);
      hideToastModal();
      showToastModal('error', '삭제 실패', '장소 삭제 처리 중 예기치 않은 오류가 발생했습니다.');
    } finally {
      setIsDeletingLocation(false);
    }
  };

  // 사이드바 토글 함수
  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };
  // 장소 선택 핸들러 (사이드바에서 장소 클릭 시)
  const handleLocationSelect = (location: LocationData) => {
    console.log('[handleLocationSelect] 장소 선택:', location.name);

    // 즉시 햅틱 피드백 (사용자 응답성 개선)
    try {
      hapticFeedback.menuSelect();
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.debug('햅틱 피드백이 차단되었습니다:', error);
    }

    // 장소 선택 중임을 표시하여 다른 로직의 지도 이동 방지
    isLocationSelectingRef.current = true;

    // 장소 선택 시 멤버 InfoWindow 자동 생성을 방지하기 위한 플래그 설정
    const preventMemberInfoWindow = true;

    // 지도에서 해당 장소로 이동 (사이드바 닫기 전에 먼저 실행)
    if (map && location.coordinates) {
      const [lng, lat] = location.coordinates;

      if (lat && lng && lat !== 0 && lng !== 0) {
        console.log('[handleLocationSelect] 지도 이동:', { lat, lng });

        // 즉시 지도 중심 이동
        const targetPosition = createSafeLatLng(lat, lng);
        if (!targetPosition) {
          console.warn('[handleLocationSelect] LatLng 생성 실패');
          return;
        }
        map.setCenter(targetPosition);

        // 줌 레벨 조정 (장소를 잘 볼 수 있도록)
        const currentZoom = map.getZoom();
        if (currentZoom < 16) {
          map.setZoom(17);
        }

        // 기존 InfoWindow 즉시 닫기
        if (infoWindow) {
          infoWindow.close();
        }

        // 1. 선택 상태 업데이트 (즉시 ref와 state 모두 업데이트)
        const previousSelectedId = selectedLocationIdRef.current;
        selectedLocationIdRef.current = location.id;

        // 🚨 마커 스타일 업데이트 (이벤트 리스너 제거 방지)
        updateAllLocationMarkerStyles(location.id);

        setSelectedLocationId(location.id); // 🚨 state도 즉시 업데이트

        console.log('[handleLocationSelect] 장소 선택됨:', location.id, location.name, '이전 선택:', previousSelectedId);
        console.log('[handleLocationSelect] 🚨 selectedLocationIdRef 업데이트 완료:', selectedLocationIdRef.current);

        // 2. 마커 상태 확인 및 업데이트
        console.log('[handleLocationSelect] 마커 상태 확인:', {
          hasLocations: !!selectedMemberSavedLocations,
          locationsCount: selectedMemberSavedLocations?.length || 0,
          markersCount: markers.length,
          groupMembersCount: groupMembers.length,
          hasMap: !!map
        });

        if (selectedMemberSavedLocations && selectedMemberSavedLocations.length > 0) {
          if (markers.length > 0) {
            // 기존 마커들의 스타일 직접 업데이트 (재생성 없이)
            console.log('[handleLocationSelect] 기존 마커 스타일 업데이트');
            markers.forEach((marker, index) => {
              const markerLocation = selectedMemberSavedLocations[index];
              if (markerLocation) {
                const isSelected = location.id === markerLocation.id;

                // 마커 아이콘 업데이트
                marker.setIcon({
                  content: `
                    <div style="position: relative; text-align: center;">
                      <div style="
                        width: ${isSelected ? '28px' : '24px'};
                        height: ${isSelected ? '28px' : '24px'};
                        background-color: white;
                        border: 2px solid ${isSelected ? '#ef4444' : '#3b82f6'};
                        border-radius: 50%;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                        position: relative;
                        z-index: ${isSelected ? '200' : '150'};
                        transition: all 0.3s ease;
                      ">
                        <svg width="${isSelected ? '16' : '12'}" height="${isSelected ? '16' : '12'}" fill="${isSelected ? '#ef4444' : '#3b82f6'}" viewBox="0 0 24 24">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                        </svg>
                      </div>
                      
                      ${isSelected ? `
                        <div style="
                          position: absolute;
                          top: 50%;
                          left: 50%;
                          transform: translate(-50%, -50%);
                          width: 40px;
                          height: 40px;
                          background: rgba(236, 72, 153, 0.2);
                          border-radius: 50%;
                          animation: selectedGlow 2s ease-in-out infinite;
                          z-index: 140;
                        "></div>
                      ` : ''}
                      
                      <div style="
                        position: absolute;
                        bottom: ${isSelected ? '-20px' : '-18px'};
                        left: 50%;
                        transform: translateX(-50%);
                        background-color: rgba(0,0,0,0.7);
                        color: white;
                        padding: 2px 5px;
                        border-radius: 3px;
                        white-space: nowrap;
                        font-size: 10px;
                        font-weight: 500;
                        max-width: 80px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                      ">
                        ${markerLocation.name}
                      </div>
                    </div>
                    
                    <style>
                      @keyframes selectedGlow {
                        0%, 100% { 
                          transform: translate(-50%, -50%) scale(0.8); 
                          opacity: 0.4; 
                        }
                        50% { 
                          transform: translate(-50%, -50%) scale(1.2); 
                          opacity: 0.1; 
                        }
                      }
                    </style>
                  `,
                  anchor: new window.naver.maps.Point(isSelected ? 16 : 12, isSelected ? 16 : 12)
                });

                // z-index 업데이트
                marker.setZIndex(isSelected ? 200 : 150);
              }
            });
          } else {
            // 마커가 없는 경우 새로 생성
            console.log('[handleLocationSelect] 마커가 없어 새로 생성');
            if (groupMembers.length > 0) {
              // 🚨 사용자 요구사항: 선택된 멤버의 장소만 표시, 다른 멤버 장소는 표시하지 않음
              const selectedMemberLocations: LocationData[] = [];

              // 🚨 선택된 멤버 장소 데이터 상세 분석
              console.log('[handleLocationSelect] 🚨 선택된 멤버 장소 데이터 분석:', {
                selectedMemberSavedLocations_존재: !!selectedMemberSavedLocations,
                selectedMemberSavedLocations_타입: typeof selectedMemberSavedLocations,
                selectedMemberSavedLocations_배열여부: Array.isArray(selectedMemberSavedLocations),
                selectedMemberSavedLocations_길이: selectedMemberSavedLocations?.length || 0,
                selectedMemberSavedLocations_첫번째: selectedMemberSavedLocations?.[0] || '없음'
              });

              // 선택된 멤버의 장소 데이터만 추가
              if (selectedMemberSavedLocations && selectedMemberSavedLocations.length > 0) {
                selectedMemberLocations.push(...selectedMemberSavedLocations);
                console.log('[handleLocationSelect] 🚨 selectedMemberSavedLocations 추가 완료:', selectedMemberLocations.length);
              } else {
                console.warn('[handleLocationSelect] 🚨 selectedMemberSavedLocations가 비어있거나 null입니다');
              }

              // 🚨 핵심 수정: 선택된 장소를 항상 추가 (중복 체크 후)
              const isLocationInSelectedMember = selectedMemberLocations.some(loc => loc.id === location.id);
              if (!isLocationInSelectedMember) {
                console.log('[handleLocationSelect] 🚨 선택된 장소를 selectedMemberLocations에 추가:', location.name);
                selectedMemberLocations.push(location);
              } else {
                console.log('[handleLocationSelect] 🚨 선택된 장소는 이미 존재함:', location.name);
              }

              // 🚨 강제 추가: selectedMemberLocations가 비어있으면 선택한 장소라도 추가
              if (selectedMemberLocations.length === 0) {
                console.warn('[handleLocationSelect] 🚨 selectedMemberLocations가 완전히 비어있어 선택한 장소 강제 추가');
                selectedMemberLocations.push(location);
              }

              console.log('[handleLocationSelect] 선택된 멤버 장소만 마커 생성:', {
                선택된멤버: groupMembers.find(m => m.isSelected)?.name || '없음',
                선택된멤버장소수: selectedMemberLocations.length,
                선택된장소: location.name
              });

              // 🚨 장소 선택 시 즉시 마커 업데이트 (선택된 멤버 장소만)
              console.log('[handleLocationSelect] 🚨 마커 업데이트 시작:', {
                전달할멤버수: groupMembers.length,
                전달할장소수: selectedMemberLocations.length,
                선택된장소: location.name,
                선택된장소ID: location.id,
                선택된장소좌표: location.coordinates
              });

              updateAllMarkers(groupMembers, selectedMemberLocations, true);
              console.log('[handleLocationSelect] 즉시 마커 업데이트 완료 - 선택된 멤버 장소만 표시');

              // 🚨 마커 업데이트 후 선택 상태 검증
              console.log('[handleLocationSelect] 🚨 마커 업데이트 후 선택 상태 검증:', {
                업데이트전_선택된장소ID: location.id,
                업데이트후_selectedLocationIdRef: selectedLocationIdRef.current,
                업데이트후_selectedLocationId_state: selectedLocationId,
                선택상태_일치여부: selectedLocationIdRef.current === location.id
              });

              // 🚨 선택 상태가 손실되었다면 복구
              if (selectedLocationIdRef.current !== location.id) {
                console.warn('[handleLocationSelect] 🚨 선택 상태 손실 감지 - 복구 시도');
                selectedLocationIdRef.current = location.id;
                setSelectedLocationId(location.id);
              }

              // 🚨 마커 생성 확인을 위한 추가 검증
              setTimeout(() => {
                console.log('[handleLocationSelect] 🚨 마커 생성 결과 확인:', {
                  현재마커수: markers.length,
                  현재장소마커수: locationMarkersRef.current?.length || 0,
                  선택된장소ID: selectedLocationIdRef.current,
                  지도준비상태: !!map
                });

                // 🚨 선택된 장소 마커가 실제로 지도에 표시되는지 확인
                const selectedLocationMarker = locationMarkersRef.current?.find(marker =>
                  marker.getTitle && marker.getTitle() === location.name
                );

                if (selectedLocationMarker) {
                  console.log('[handleLocationSelect] ✅ 선택된 장소 마커 발견:', location.name);
                  if (selectedLocationMarker.getMap && selectedLocationMarker.getMap()) {
                    console.log('[handleLocationSelect] ✅ 선택된 장소 마커가 지도에 표시됨');
                  } else {
                    console.warn('[handleLocationSelect] ⚠️ 선택된 장소 마커가 지도에 표시되지 않음');
                  }
                } else {
                  console.warn('[handleLocationSelect] ⚠️ 선택된 장소 마커를 찾을 수 없음:', location.name);
                }
              }, 100);
            }
          }
        }

        // 사이드바 즉시 닫기 (장소 선택 시 사용자 경험 개선)
        setTimeout(() => {
          setIsSidebarOpen(false);
          console.log('[handleLocationSelect] 사이드바 닫기 완료');
        }, 100); // 빠른 응답성을 위해 짧은 지연

        // 🚨 상태는 이미 위에서 업데이트됨 (중복 제거)

        // 🚨 중복 마커 생성 방지: 첫 번째 updateAllMarkers 호출만 유지
        console.log('[handleLocationSelect] 🚨 중복 마커 생성 방지: 강제 재생성 제거됨');

        // 3. InfoWindow 생성 및 표시 (지도 위치에 표시)
        setTimeout(() => {
          console.log('[handleLocationSelect] InfoWindow 생성 시작:', location.name);

          // 기존 InfoWindow 닫기
          if (infoWindow) {
            console.log('[handleLocationSelect] 기존 InfoWindow 닫기');
            infoWindow.close();
            setInfoWindow(null);
          }

          const newInfoWindow = createLocationInfoWindow(
            location.name || (location as any).slt_title || '제목 없음',
            location.address || (location as any).slt_add || '주소 정보 없음',
            location
          );

          // 해당 장소의 마커 찾기
          const locationIndex = selectedMemberSavedLocations ? selectedMemberSavedLocations.findIndex(loc => loc.id === location.id) : -1;
          const selectedMarker = locationIndex >= 0 ? markers[locationIndex] : null;

          console.log('[handleLocationSelect] 마커 찾기 결과:', {
            locationIndex,
            hasSelectedMarker: !!selectedMarker,
            totalMarkers: markers.length,
            selectedMemberSavedLocationsCount: selectedMemberSavedLocations?.length || 0
          });

          if (selectedMarker) {
            // 마커에 InfoWindow 연결
            newInfoWindow.open(map, selectedMarker);
            console.log('[handleLocationSelect] InfoWindow를 마커에 연결:', location.name || (location as any).slt_title || '제목 없음');
          } else {
            // 마커가 없으면 임시 마커를 생성하여 InfoWindow 표시
            console.log('[handleLocationSelect] 마커가 없어 임시 마커 생성');
            const tempInfoMarker = new window.naver.maps.Marker({
              position: targetPosition,
              map: map,
              visible: false // 보이지 않는 마커
            });

            newInfoWindow.open(map, tempInfoMarker);
            console.log('[handleLocationSelect] InfoWindow를 임시 마커에 연결:', location.name || (location as any).slt_title || '제목 없음');

            // 임시 마커는 InfoWindow가 닫힐 때 같이 제거되도록 설정
            setTimeout(() => {
              if (tempInfoMarker) {
                tempInfoMarker.setMap(null);
              }
            }, 100);
          }

          setInfoWindow(newInfoWindow);
          console.log('[handleLocationSelect] InfoWindow 설정 완료');
        }, 300); // 마커 업데이트 완료 후 InfoWindow 표시

        // 상태 업데이트는 이미 위에서 완료됨

        // 장소 선택 완료, 플래그 해제
        isLocationSelectingRef.current = false;
        console.log('[handleLocationSelect] 장소 선택 완료 - 플래그 해제');

      } else {
        console.warn('[handleLocationSelect] 유효하지 않은 좌표:', { lat, lng });
        setIsSidebarOpen(false);
      }
    } else {
      console.warn('[handleLocationSelect] 지도 또는 좌표가 없습니다:', { map: !!map, coordinates: location.coordinates });
      setIsSidebarOpen(false);
    }
  };

  // 사이드바 외부 클릭 처리
  useEffect(() => {
    const handleSidebarClickOutside = (event: MouseEvent) => {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };

    if (isSidebarOpen) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleSidebarClickOutside);
      }, 100);

      return () => {
        document.removeEventListener('mousedown', handleSidebarClickOutside);
      };
    }
  }, [isSidebarOpen]);

  // 그룹 선택 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (isGroupSelectorOpen) {
        const target = event.target as HTMLElement;

        // 그룹 드롭다운 관련 요소들을 더 구체적으로 확인
        const isGroupDropdownContainer = target.closest('[data-group-dropdown-container]');
        const isGroupDropdownButton = target.closest('[data-group-selector]');
        const isGroupDropdownMenu = target.closest('[data-group-dropdown-menu]');
        const isGroupDropdownOption = target.closest('[data-group-option]');
        const isGroupSelector = target.closest('.group-selector');

        // 그룹 드롭다운 관련 요소가 아닌 외부 클릭인 경우에만 닫기
        if (!isGroupDropdownContainer && !isGroupDropdownButton && !isGroupDropdownMenu && !isGroupDropdownOption && !isGroupSelector) {
          console.log('[handleClickOutside] 그룹 드롭다운 외부 클릭 감지 - 드롭다운 닫기');
          setIsGroupSelectorOpen(false);
        } else {
          console.log('[handleClickOutside] 그룹 드롭다운 내부 클릭 감지 - 드롭다운 유지');
        }
      }
    };

    if (isGroupSelectorOpen) {
      // 더 긴 지연을 주어 그룹 선택 클릭이 완전히 처리된 후 리스너 추가
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isGroupSelectorOpen]);

  // InfoWindow 외부 클릭 감지
  useEffect(() => {
    if (!infoWindow) return;

    let ignoreNextClick = false;

    const handleDocumentClick = (e: MouseEvent) => {
      // 전역 플래그로 클릭 무시
      if ((window as any).ignoreInfoWindowClick) {
        console.log('[InfoWindow 외부 클릭] 클릭 무시됨 (전역 플래그)');
        (window as any).ignoreInfoWindowClick = false;
        return;
      }

      // 🚨 마커 클릭 중에는 외부 클릭 처리 무시 (마커 클릭 핸들러에서 InfoWindow를 직접 관리)
      if (isMarkerClickingRef.current) {
        console.log('[InfoWindow 외부 클릭] 클릭 무시됨 (마커 클릭 중)');
        return;
      }

      const target = e.target as HTMLElement;

      console.log('[InfoWindow 외부 클릭] 클릭 감지:', target.tagName, target.className);

      // 🚨 사이드바 관련 요소 클릭은 무시 (사이드바 닫기 시 InfoWindow가 닫히지 않도록)
      const isSidebarElement = target.closest('.sidebar') ||
        target.closest('[class*="sidebar"]') ||
        target.closest('.glass-effect') ||
        target.closest('motion.div') ||
        target.closest('[data-sidebar]') ||
        target.classList.contains('sidebar') ||
        target.closest('.member-avatar') ||
        target.closest('.group-selector') ||
        target.tagName === 'svg' ||
        target.tagName === 'path' ||
        target.tagName === 'IMG' ||
        target.closest('svg') ||
        // 🚨 추가: 사이드바 내부의 DIV 요소들
        (target.tagName === 'DIV' && (
          target.classList.contains('flex') ||
          target.classList.contains('items-center') ||
          target.classList.contains('justify-between') ||
          target.closest('[class*="flex"]')
        )) ||
        // 🚨 추가: motion.div의 자식 요소들
        target.closest('[style*="transform"]');

      if (isSidebarElement) {
        console.log('[InfoWindow 외부 클릭] 사이드바 요소 클릭 - 무시');
        return;
      }

      // 삭제 버튼 클릭인지 먼저 확인 (가장 우선순위)
      const isDeleteButton = target.classList.contains('delete-button') ||
        target.closest('.delete-button') ||
        target.textContent?.trim() === '🗑️' ||
        target.textContent?.includes('🗑️') ||
        target.getAttribute('title') === '장소 삭제' ||
        (target.tagName === 'BUTTON' && target.textContent?.includes('🗑️'));

      // 닫기 버튼 클릭인지 확인
      const isCloseButton = target.classList.contains('close-button') ||
        target.closest('.close-button') ||
        target.textContent?.includes('×') ||
        target.getAttribute('title') === '닫기';

      // 모든 InfoWindow 관련 버튼인지 확인
      const isInfoWindowButton = isDeleteButton || isCloseButton;

      if (isDeleteButton) {
        console.log('[InfoWindow 외부 클릭] 삭제 버튼 클릭 감지, InfoWindow 닫기 방지');
        // 다음 클릭도 무시하도록 플래그 설정
        (window as any).ignoreInfoWindowClick = true;
        return;
      }

      if (isCloseButton) {
        console.log('[InfoWindow 외부 클릭] 닫기 버튼 클릭 감지');
        return; // 닫기 버튼은 자체적으로 처리
      }

      // InfoWindow 내부 요소인지 확인
      const isInfoWindowElement = target.closest('.location-info-window-container') ||
        target.closest('.iw_container') ||
        target.closest('.iw_content') ||
        target.classList.contains('info-button') ||
        target.parentElement?.classList.contains('iw_container') ||
        target.classList.contains('iw_container') ||
        isInfoWindowButton;

      if (!isInfoWindowElement && infoWindow) {
        console.log('[InfoWindow 외부 클릭] InfoWindow 닫기 시도');
        if (infoWindow.close) {
          infoWindow.close();
        }
        setInfoWindow(null);
      }
    };

    // 즉시 이벤트 리스너 등록 (지연 없음)
    console.log('[InfoWindow useEffect] 외부 클릭 리스너 등록');
    document.addEventListener('click', handleDocumentClick, true); // capture 단계에서 처리
    document.addEventListener('mousedown', handleDocumentClick, true); // capture 단계에서 처리

    return () => {
      console.log('[InfoWindow useEffect] 외부 클릭 리스너 제거');
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('mousedown', handleDocumentClick, true);
    };
  }, [infoWindow]);

  // ESC 키로 InfoWindow 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && infoWindow && infoWindow.getMap && infoWindow.getMap()) {
        console.log('[ESC] InfoWindow 닫기');
        infoWindow.close();
        setInfoWindow(null);
      }
    };

    if (infoWindow) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [infoWindow]);

  // InfoWindow 관련 전역 함수 등록
  useEffect(() => {
    // InfoWindow 닫기 함수 등록
    (window as any).closeInfoWindow = () => {
      console.log('[window.closeInfoWindow] InfoWindow 닫기 함수 호출됨');
      if (infoWindow) {
        infoWindow.close();
        setInfoWindow(null);
        console.log('[window.closeInfoWindow] InfoWindow 닫기 완료');
      } else {
        console.log('[window.closeInfoWindow] 닫을 InfoWindow가 없음');
      }
    };

    // 장소 삭제 함수 등록 (강화된 ID 매칭)
    (window as any).handleLocationDeleteFromInfoWindow = (locationId: string) => {
      console.log('[window.handleLocationDeleteFromInfoWindow] 장소 삭제 함수 호출됨:', locationId);

      // 🚨 temp_ 접두사 제거 및 다양한 ID 형식 처리
      const cleanLocationId = locationId.replace(/^temp_/, '');
      console.log('[window.handleLocationDeleteFromInfoWindow] 정리된 locationId:', cleanLocationId);

      let targetLocation = null;

      // 🚨 selectedMemberSavedLocations에서 다양한 방식으로 찾기
      if (selectedMemberSavedLocations) {
        targetLocation = selectedMemberSavedLocations.find(loc => {
          const locId = loc.id?.toString();
          const locSltIdx = loc.slt_idx?.toString();

          return locId === locationId ||
            locId === cleanLocationId ||
            locSltIdx === locationId ||
            locSltIdx === cleanLocationId ||
            loc.id === locationId ||
            loc.id === cleanLocationId;
        }) || null;
      }

      // 🚨 otherMembersSavedLocations에서 다양한 방식으로 찾기
      if (!targetLocation) {
        targetLocation = otherMembersSavedLocations.find(loc => {
          const locId = loc.id?.toString();
          const locSltIdx = loc.slt_idx?.toString();

          return locId === locationId ||
            locId === cleanLocationId ||
            locSltIdx === locationId ||
            locSltIdx === cleanLocationId ||
            loc.id === locationId ||
            loc.id === cleanLocationId ||
            loc.slt_idx === parseInt(locationId) ||
            loc.slt_idx === parseInt(cleanLocationId);
        }) || null;
      }

      if (targetLocation) {
        console.log('[window.handleLocationDeleteFromInfoWindow] 장소 찾음:', targetLocation);
        openLocationDeleteModal(targetLocation);
      } else {
        console.error('[window.handleLocationDeleteFromInfoWindow] 삭제할 장소를 찾을 수 없음:', {
          원본ID: locationId,
          정리된ID: cleanLocationId,
          selectedMemberSavedLocations: selectedMemberSavedLocations?.map(loc => ({
            id: loc.id,
            slt_idx: loc.slt_idx,
            name: loc.name || loc.slt_title
          })),
          otherMembersSavedLocations: otherMembersSavedLocations?.map(loc => ({
            id: loc.id,
            slt_idx: loc.slt_idx,
            name: loc.slt_title
          }))
        });
      }
    };

    // 컴포넌트 언마운트 시 전역 함수 정리
    return () => {
      delete (window as any).closeInfoWindow;
      delete (window as any).handleLocationDeleteFromInfoWindow;
    };
  }, [infoWindow, otherMembersSavedLocations]);
  return (
    <>
      <style jsx global>{mobileStyles}</style>

      <motion.div
        initial="initial"
        animate={
          isExiting ? "out" : "in"
        }
        variants={pageVariants}
        className="fixed inset-0 overflow-hidden"
        id="location-page-container"
        style={{
          background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)',
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px'
        }}
      >
        {/* 통일된 헤더 애니메이션 */}
        <AnimatedHeader
          variant="simple"
          className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed location-header"
          style={{
            paddingTop: '0px',
            marginTop: '0px',
            top: '0px',
            position: 'fixed'
          }}
        >
          <div
            className="flex items-center"
            style={{
              paddingLeft: '16px',
              paddingRight: '0px !important',  // 오른쪽 패딩 제거
              paddingTop: '0px !important',    // 위쪽 패딩 제거
              paddingBottom: '0px !important', // 아래쪽 패딩 제거
              height: '56px',  // 정확한 높이 설정
              width: '100%',
              boxSizing: 'border-box',
              position: 'relative'  // 절대 위치 아이콘들을 위한 relative 설정
            }}
          >
            {/* 왼쪽 영역 - 고정 너비 */}
            <AnimatePresence mode="wait">
              <motion.div
                key="location-header"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="flex items-center space-x-3 motion-div"
              >
                <div className="flex items-center space-x-3">
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">내 장소</h1>
                    <p className="text-xs text-gray-500">그룹 멤버들과 장소를 공유해보세요</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* 오른쪽 영역 - 아이콘들 */}
            <motion.div
              className="flex items-center justify-center"
              style={{
                position: 'absolute',
                right: '16px',  // 절대 위치로 오른쪽에서 16px 떨어진 곳에 고정
                top: '0',
                bottom: '0',
                gap: '12px',  // 아이콘 간격 늘리기
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '56px'  // 헤더 높이와 동일하게 설정
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: "easeOut"
              }}
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="p-0.5 hover:bg-white/50 rounded-xl transition-all duration-200 mobile-button"
                onClick={() => {
                  setIsLocationInfoPanelOpen(true);
                  setIsEditingPanel(false);

                  // 새 장소 입력을 위한 기본값 설정
                  setNewLocation({
                    name: '',
                    address: '',
                    coordinates: [0, 0],
                    category: '기타',
                    memo: '',
                    favorite: false,
                    notifications: true
                  });
                }}
              >
                <FiSearch className="w-6 h-6 text-gray-600" />
              </motion.button>
            </motion.div>
          </div>
        </AnimatedHeader>

        {/* 지도 영역 - 고정 위치 */}
        <div
          className="absolute inset-0 safe-area-all"
          style={{
            top: '56px', // 헤더 높이만큼 아래로
            bottom: '48px', // 네비게이션 바 높이만큼 위로
            left: '0',
            right: '0',
            zIndex: 1
          }}
        >
          {mapLoadError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white">
              <p>지도를 불러오지 못했습니다.</p>
              <button type="button" onClick={() => setMapRetryCount(count => count + 1)}>다시 시도</button>
            </div>
          )}
          {/* 스켈레톤 UI - 지도 로딩 중일 때 표시 */}
          {isMapLoading && (
            <MapSkeleton
              showControls={true}
              showMemberList={false}
              className="absolute top-0 left-0 w-full h-full z-5"
            />
          )}

          <div ref={mapContainer} className="w-full h-full" />

          {/* 커스텀 줌 컨트롤 */}
          {map && (
            <div className="absolute top-[80px] right-[16px] z-30 flex flex-col">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (map) {
                    // InfoWindow 상태 완전히 저장
                    let savedInfoWindow = null;
                    if (infoWindow && infoWindow.getMap()) {
                      savedInfoWindow = {
                        position: infoWindow.getPosition(),
                        content: infoWindow.getContent(),
                        options: infoWindow.getOptions ? infoWindow.getOptions() : {}
                      };
                      console.log('[줌인] InfoWindow 상태 저장:', savedInfoWindow);
                    }

                    const currentZoom = map.getZoom();
                    map.setZoom(currentZoom + 1);

                    // 줌 완료 후 InfoWindow 재생성
                    if (savedInfoWindow) {
                      // 줌 애니메이션이 완료될 때까지 기다린 후 InfoWindow 재생성
                      setTimeout(() => {
                        try {
                          // 새로운 InfoWindow 생성
                          const newInfoWindow = new window.naver.maps.InfoWindow({
                            content: savedInfoWindow.content,
                            position: savedInfoWindow.position,
                            backgroundColor: '#ffffff',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            anchorSize: new window.naver.maps.Size(10, 10)
                          });

                          newInfoWindow.open(map);
                          setInfoWindow(newInfoWindow);
                          console.log('[줌인] InfoWindow 재생성 완료');
                        } catch (error) {
                          console.error('[줌인] InfoWindow 재생성 실패:', error);
                        }
                      }, 300);
                    }
                  }
                }}
                className="w-10 h-10 bg-white border border-gray-300 rounded-t-lg shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-bold">+</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (map) {
                    // InfoWindow 상태 완전히 저장
                    let savedInfoWindow = null;
                    if (infoWindow && infoWindow.getMap()) {
                      savedInfoWindow = {
                        position: infoWindow.getPosition(),
                        content: infoWindow.getContent(),
                        options: infoWindow.getOptions ? infoWindow.getOptions() : {}
                      };
                      console.log('[줌아웃] InfoWindow 상태 저장:', savedInfoWindow);
                    }

                    const currentZoom = map.getZoom();
                    map.setZoom(currentZoom - 1);

                    // 줌 완료 후 InfoWindow 재생성
                    if (savedInfoWindow) {
                      // 줌 애니메이션이 완료될 때까지 기다린 후 InfoWindow 재생성
                      setTimeout(() => {
                        try {
                          // 새로운 InfoWindow 생성
                          const newInfoWindow = new window.naver.maps.InfoWindow({
                            content: savedInfoWindow.content,
                            position: savedInfoWindow.position,
                            backgroundColor: '#ffffff',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            anchorSize: new window.naver.maps.Size(10, 10)
                          });

                          newInfoWindow.open(map);
                          setInfoWindow(newInfoWindow);
                          console.log('[줌아웃] InfoWindow 재생성 완료');
                        } catch (error) {
                          console.error('[줌아웃] InfoWindow 재생성 실패:', error);
                        }
                      }, 300);
                    }
                  }
                }}
                className="w-10 h-10 bg-white border border-gray-300 rounded-b-lg shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-bold">−</span>
              </motion.button>
            </div>
          )}


        </div>

        {/* 개선된 위치 정보 패널 */}
        <AnimatePresence>
          {isLocationInfoPanelOpen && (
            <motion.div
              ref={infoPanelRef}
              initial={{ opacity: 0, y: -30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.96 }}
              transition={{ duration: 0.3, }}
              className="location-info-panel fixed top-20 left-4 right-4 z-30 rounded-2xl p-3 shadow-2xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-2">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex-1 pr-2"
                >
                  <h3 className="text-base font-bold text-gray-800 leading-tight">
                    {isEditingPanel ? "장소 정보" :
                      (groupMembers.find(m => m.isSelected)?.name ?
                        `${groupMembers.find(m => m.isSelected)?.name}의 새 장소 등록` :
                        "새 장소 등록")
                    }
                  </h3>
                  <p className="text-xs font-medium mt-0.5" style={{ color: '#0113A3' }}>
                    {isEditingPanel ? "장소 정보를 확인하고 관리하세요" : "지도를 클릭하거나 검색하세요"}
                  </p>
                </motion.div>

                <div className="flex items-center space-x-1 flex-shrink-0">
                  {isEditingPanel && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        // 편집 모드에서만 실제 데이터 업데이트
                        if (isEditingPanel && newLocation.id) {
                          const locationData = selectedMemberSavedLocations?.find(loc => loc.id === newLocation.id) ||
                            otherMembersSavedLocations.find(loc => (loc.slt_idx ? loc.slt_idx.toString() : loc.id) === newLocation.id);

                          if (locationData) {
                            handleNotificationToggle(locationData);
                          }
                        }
                      }}
                      className={`p-1.5 rounded-lg transition-all duration-200 ${newLocation.notifications
                        ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200'
                        }`}
                      aria-label={newLocation.notifications ? '알림 끄기' : '알림 켜기'}
                    >
                      {newLocation.notifications ? <FiBell size={14} /> : <FiBellOff size={14} />}
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsLocationInfoPanelOpen(false);
                      if (tempMarker.current) tempMarker.current.setMap(null);
                      setIsEditingPanel(false);
                      // 패널 닫기
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-200"
                  >
                    <FiX size={18} />
                  </motion.button>
                </div>
              </div>

              {isEditingPanel ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-800 truncate">{newLocation.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5 break-words leading-tight">{newLocation.address || '주소 정보 없음'}</p>
                  </div>

                  {/* 편집 모드 액션 버튼들 */}
                  <motion.div className="flex space-x-2 mt-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // 삭제 확인 모달을 먼저 띄웁니다.
                        const locationToProcess = selectedMemberSavedLocations?.find(loc => loc.id === newLocation.id) ||
                          otherMembersSavedLocations.find(loc => (loc.slt_idx ? loc.slt_idx.toString() : loc.id) === newLocation.id);
                        if (locationToProcess) {
                          openModal(
                            `'${newLocation.name}' 삭제 확인`,
                            '정말로 이 장소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                            'info', // type을 'info' 또는 'warning' 등으로 하여 확인 모달임을 표시
                            () => handleHideLocation(locationToProcess) // 확인 시 실행할 콜백
                          );
                        }
                      }}
                      className="flex-1 py-2 px-3 text-white font-medium rounded-lg shadow-md mobile-button text-sm"
                      style={{ backgroundColor: '#0113A3' }}
                    >
                      <div className="flex items-center justify-center">
                        <FiTrash2 className="mr-1.5" size={14} />
                        삭제
                      </div>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setIsLocationInfoPanelOpen(false);
                        if (tempMarker.current) tempMarker.current.setMap(null);
                        setIsEditingPanel(false);
                      }}
                      className="flex-1 py-2 px-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-lg shadow-md mobile-button text-sm"
                    >
                      닫기
                    </motion.button>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="relative mb-2">
                    <input
                      type="text"
                      placeholder="지번, 도로명, 건물명으로 검색"
                      className="search-input w-full py-2.5 pl-10 pr-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 text-sm"
                      value={locationSearchQuery}
                      onChange={(e) => setLocationSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePanelAddressSearch();
                        }
                      }}
                    />
                    {isSearchingLocationForPanel ? (
                      <FiLoader className="absolute left-3 top-3 text-blue-600 unified-animate-spin" size={16} style={{ marginTop: '2px' }} />
                    ) : (
                      <FaSearchSolid className="absolute left-3 top-3 text-gray-400 cursor-pointer" size={16} style={{ marginTop: '2px' }} onClick={handlePanelAddressSearch} />
                    )}
                  </div>

                  {/* 검색 결과 */}
                  <AnimatePresence>
                    {locationSearchModalCaller === 'panel' && locationSearchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-2"
                      >
                        <p className="text-xs font-medium mb-1 px-1" style={{ color: '#0113A3' }}>검색 결과</p>
                        <div className="max-h-24 overflow-y-auto bg-gray-50 rounded-lg border border-gray-100">
                          <ul className="divide-y divide-gray-200">
                            {locationSearchResults.map((place, index) => (
                              <motion.li
                                key={place.temp_id || place.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="p-2 cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                                onClick={() => handleSelectLocationForPanel(place)}
                              >
                                <p className="font-semibold text-gray-800 truncate text-xs leading-tight">{place.place_name}</p>
                                <p className="text-gray-600 truncate text-xs leading-tight mt-0.5">{place.road_address_name || place.address_name}</p>
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-2 mb-2">
                    <p className="text-xs font-medium mb-1" style={{ color: '#0113A3' }}>선택한 위치 주소</p>
                    <div className="flex text-xs font-medium text-gray-700 min-h-[16px] leading-tight">
                      <span className="opacity-0 pointer-events-none select-none text-xs font-medium mb-1" style={{ color: '#0113A3' }}>
                        장소 태그 (이름)
                      </span>
                      <span className="ml-[-7ch]">
                        {isLocationInfoPanelOpen ?
                          (newLocation.address ? newLocation.address : (clickedCoordinates && !newLocation.address ? ' 주소 변환 중...' : ' 지도를 클릭하거나 검색하세요.'))
                          : ''}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="panelLocationName" className="block text-xs font-medium mb-2" style={{ color: '#0113A3' }}>장소 태그 (이름)</label>
                    <input
                      type="text"
                      id="panelLocationName"
                      className="search-input w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 text-sm"
                      placeholder="이 장소에 대한 나만의 이름을 지어주세요."
                      value={newLocation.name}
                      onChange={(e) => {
                        console.log('[입력 필드] 장소 이름 변경:', e.target.value);
                        setNewLocation(prev => ({ ...prev, name: e.target.value }));
                      }}
                    />
                  </div>

                  {/* 액션 버튼들 */}
                  <motion.div className="flex space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setIsLocationInfoPanelOpen(false);
                        if (tempMarker.current) tempMarker.current.setMap(null);
                        setIsEditingPanel(false);
                        // 패널 닫기
                      }}
                      className="flex-1 py-2 px-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-lg shadow-md mobile-button text-sm"
                    >
                      닫기
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleConfirmPanelAction}
                      className="flex-1 py-2 px-3 text-white font-medium rounded-lg shadow-md mobile-button text-sm"
                      style={{ backgroundColor: '#0113A3' }}
                    >
                      내 장소 등록
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 플로팅 사이드바 토글 버튼 */}
        {typeof window !== 'undefined' && ReactDOM.createPortal(
          <FloatingButton
            variant="location"
            onClick={() => {
              console.log('[토글 버튼] 클릭됨, 현재 상태:', isSidebarOpen);
              // 강제로 상태 토글 (최신 상태를 확실히 반영)
              setIsSidebarOpen(prevState => {
                const newState = !prevState;
                console.log('[토글 버튼] 상태 변경:', prevState, '->', newState);
                return newState;
              });
            }}
            isOpen={isSidebarOpen}
            badgeCount={groupMembers.length}
            style={{
              bottom: 'calc(48px + 40px)',
              zIndex: 9998
            }}
          />,
          document.body
        )}

        {/* 사이드바 오버레이 */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              variants={sidebarOverlayVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
              style={{ zIndex: 9998 }}
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* 사이드바 */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              ref={sidebarRef}
              variants={sidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed left-0 top-0 w-72 shadow-2xl border-r z-[99999] flex flex-col"
              style={{
                background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)',
                borderColor: 'rgba(1, 19, 163, 0.1)',
                height: 'calc(100vh - 48px)', // 네비게이션 바(48px) 높이만큼 여유 공간
                borderRadius: '0 18px 18px 0',
                boxShadow: '0 8px 32px rgba(31,41,55,0.18), 0 1.5px 6px rgba(0,0,0,0.08)',
                transform: 'translateZ(0)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                WebkitPerspective: 1000,
                WebkitTransform: 'translateZ(0)'
              }}
            >
              <motion.div
                variants={sidebarContentVariants}
                initial="closed"
                animate="open"
                exit="closed"
                className="p-8 h-full flex flex-col relative z-10"
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      className="p-2 rounded-xl shadow-lg"
                      style={{ backgroundColor: '#0113A3' }}
                      whileHover={{ scale: 1.05, rotate: 5 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FiUser className="w-5 h-5 text-white" />
                    </motion.div>
                    <div>
                      <h2 className="text-xl font-bold bg-gray-900 bg-clip-text text-transparent">
                        그룹 멤버
                      </h2>
                      <p className="text-sm text-gray-600">멤버를 선택해보세요</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 hover:bg-white/60 rounded-xl transition-all duration-200 backdrop-blur-sm"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>

                {/* 그룹 목록 섹션 */}
                <div className="mb-5">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0113A3' }}></div>
                    <h3 className="text-base font-semibold text-gray-800">그룹 목록</h3>
                  </div>

                  <GroupSelector
                    userGroups={userGroups}
                    selectedGroupId={selectedGroupId}
                    isGroupSelectorOpen={isGroupSelectorOpen}
                    isSidebarOpen={isSidebarOpen}
                    groupMemberCounts={groupMemberCounts}
                    onOpen={() => {
                      console.log('[GroupSelector] onOpen 호출됨');
                      setIsGroupSelectorOpen(true);
                    }}
                    onClose={() => {
                      console.log('[GroupSelector] onClose 호출됨');
                      setIsGroupSelectorOpen(false);
                    }}
                    onToggleSelector={() => {
                      console.log('[GroupSelector] onToggleSelector 호출됨, 현재 상태:', isGroupSelectorOpen);
                      // 강제로 상태를 반대로 변경
                      const newState = !isGroupSelectorOpen;
                      console.log('[GroupSelector] 새로운 상태:', newState);
                      setIsGroupSelectorOpen(newState);
                    }}
                    onGroupSelect={(groupId) => {
                      if (selectedGroupId !== groupId) {
                        handleGroupSelect(groupId);
                      }
                    }}
                  />
                </div>

                {/* 멤버 목록 섹션 */}
                <div className="flex-1 min-h-0">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    <h3 className="text-base font-semibold text-gray-800">멤버 목록</h3>
                  </div>

                  <div className="overflow-y-auto flex-1 space-y-3 pb-6">
                    {groupMembers.length > 0 ? (
                      groupMembers.map((member, index) => (
                        <motion.div
                          key={member.id}
                          variants={memberItemVariants}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            // 햅틱 피드백 추가
                            hapticFeedback.navigation();

                            // 즉시 사이드바 닫기 (상태 변경 순서 중요)
                            setIsSidebarOpen(false);

                            // 즉시 멤버 선택 실행 (InfoWindow 포함, 지도 이동 활성화)
                            handleMemberSelect(member.id, true, groupMembers, false, null, false);
                            console.log('[사이드바 멤버 선택] 멤버 선택 완료 - InfoWindow 생성 포함, 지도 이동 활성화:', member.name);
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${member.isSelected
                            ? 'bg-white shadow-lg'
                            : 'bg-white/60 hover:bg-white/80'
                            }`}
                          style={member.isSelected
                            ? { borderColor: '#0113A3', boxShadow: '0 4px 12px rgba(1, 19, 163, 0.15)' }
                            : { borderColor: 'rgba(1, 19, 163, 0.1)' }
                          }
                        >
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <img
                                src={getSafeImageUrl(member.mt_file1, member.mt_gender, member.original_index)}
                                alt={member.name}
                                className={`w-10 h-10 rounded-full object-cover transition-all duration-200 ${member.isSelected ? 'ring-2 ring-blue-600' : ''
                                  }`}
                              />
                              {member.isSelected && (
                                <div
                                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: '#0113A3' }}
                                >
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${member.isSelected ? 'text-gray-900' : 'text-gray-700'
                                }`}>
                                {member.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {member.savedLocations?.length || 0}개의 저장된 장소
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <FiUser className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">
                          {isLoadingGroups ? '그룹을 불러오는 중...' : '그룹을 선택해주세요'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      {/* 개선된 커스텀 모달 */}
      <AnimatePresence>
        {isModalOpen && modalContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md"
            onClick={closeModal}
          >
            <motion.div
              className="bg-white rounded-3xl w-full max-w-md mx-4"
              variants={{
                hidden: {
                  opacity: 0,
                  y: 100,
                  scale: 0.95
                },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }
                },
                exit: {
                  opacity: 0,
                  y: 100,
                  scale: 0.95,
                  transition: {
                    duration: 0.2,
                    ease: [0.55, 0.06, 0.68, 0.19]
                  }
                }
              }}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${modalContent.type === 'success' ? 'bg-green-100' :
                    modalContent.type === 'error' ? 'bg-red-100' :
                      modalContent.type === 'info' ? 'bg-orange-100' : 'bg-blue-100'
                    }`}>
                    {modalContent.type === 'success' && <FiCheckCircle className="w-8 h-8 text-green-500" />}
                    {modalContent.type === 'error' && <FiXCircle className="w-8 h-8 text-red-500" />}
                    {modalContent.type === 'info' && <FiAlertTriangle className="w-8 h-8 text-orange-500" />}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{modalContent.title}</h3>
                  <p className="text-gray-600 mb-4">{modalContent.message}</p>

                  {/* 삭제 확인 모달인 경우 진행 바 표시 */}
                  {modalContent.onConfirm && modalContent.type === 'info' && (
                    <div className="w-full bg-gray-200 rounded-full h-1 mb-2">
                      <motion.div
                        className="bg-orange-500 h-1 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3 }}
                      />
                    </div>
                  )}

                  {/* 알림 설정 완료 모달인 경우 자동 닫기 진행 바 및 텍스트 표시 */}
                  {!modalContent.onConfirm && modalContent.type === 'success' && modalContent.title.includes('알림 설정') && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-1 mb-3">
                        <motion.div
                          className="bg-green-500 h-1 rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 3, ease: "linear" }}
                        />
                      </div>
                      <p className="text-sm text-gray-500 mb-2">3초 후 자동으로 닫힙니다</p>
                    </>
                  )}
                </div>

                {/* 버튼 영역 */}
                <div className="flex flex-col gap-3">
                  {modalContent.onConfirm ? (
                    <>
                      <motion.button
                        onClick={() => {
                          if (modalContent.onConfirm) {
                            modalContent.onConfirm();
                          }
                          closeModal();
                        }}
                        className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center transition-all duration-200 ${modalContent.type === 'info'
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {modalContent.type === 'info' ? '삭제하기' : '확인'}
                      </motion.button>
                      <motion.button
                        onClick={closeModal}
                        className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-medium transition-all duration-200"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        취소
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      onClick={closeModal}
                      className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center transition-all duration-200 ${modalContent.type === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' :
                        modalContent.type === 'error' ? 'bg-red-500 hover:bg-red-600 text-white' :
                          'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      확인
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 컴팩트한 장소 삭제 확인 모달 */}
      <AnimatePresence>
        {isLocationDeleteModalOpen && locationToDelete && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLocationDeleteModal}
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-sm mx-auto shadow-2xl"
              variants={{
                hidden: {
                  opacity: 0,
                  y: 50,
                  scale: 0.9
                },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: 0.25,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }
                },
                exit: {
                  opacity: 0,
                  y: 50,
                  scale: 0.9,
                  transition: {
                    duration: 0.2,
                    ease: [0.55, 0.06, 0.68, 0.19]
                  }
                }
              }}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FaTrash className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">장소 삭제</h3>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-red-600">
                      "{'slt_title' in locationToDelete ? locationToDelete.slt_title : locationToDelete.name}"
                    </span>
                    <br />장소를 삭제하시겠습니까?
                  </p>
                </div>

                <div className="flex space-x-3">
                  <motion.button
                    onClick={closeLocationDeleteModal}
                    disabled={isDeletingLocation}
                    className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium disabled:opacity-50 text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    취소
                  </motion.button>

                  <motion.button
                    onClick={handleLocationDelete}
                    disabled={isDeletingLocation}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isDeletingLocation ? (
                      <>
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-white rounded-full unified-animate-spin mr-1"></div>
                        삭제 중
                      </>
                    ) : (
                      '삭제'
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 컴팩트 토스트 모달 */}
      <AnimatePresence>
        {toastModal.isOpen && (
          <motion.div
            className="fixed bottom-40 left-4 z-[130] w-3/4 max-w-sm"
            style={{ bottom: '67px' }} // 네비게이션바(64px) + 7px
            initial={{ opacity: 0, x: -100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-full">
              <div className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${toastModal.type === 'success' ? 'bg-green-100' :
                    toastModal.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                    {toastModal.type === 'success' && (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {toastModal.type === 'error' && (
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {toastModal.type === 'loading' && (
                      <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full unified-animate-spin"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{toastModal.title}</h4>
                    <p className="text-xs text-gray-600 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{toastModal.message}</p>
                  </div>
                  {toastModal.autoClose && toastModal.type !== 'loading' && (
                    <button
                      onClick={hideToastModal}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* 프로그레스 바 */}
              {toastModal.autoClose && toastModal.type !== 'loading' && (
                <div className="h-1 bg-gray-100">
                  <motion.div
                    className={`h-full ${toastModal.type === 'success' ? 'bg-green-500' :
                      toastModal.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${100 - (toastModal.progress || 0)}%` }}
                    transition={{ duration: 0.1, ease: 'linear' }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 사이드바 */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* 오버레이 */}
            <motion.div
              variants={sidebarOverlayVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
              onClick={() => setIsSidebarOpen(false)}
              style={{
                // 모바일 사파리 최적화
                transform: 'translateZ(0)',
                willChange: 'opacity',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
              }}
            />

            {/* 사이드바 */}
            <motion.div
              ref={sidebarRef}
              variants={sidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed left-0 top-0 w-72 shadow-2xl border-r z-[99999] flex flex-col"
              style={{
                background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)',
                borderColor: 'rgba(1, 19, 163, 0.1)',
                height: 'calc(100vh - 48px)', // 네비게이션 바 높이만큼 여유 공간
                borderRadius: '0 18px 18px 0',
                boxShadow: '0 8px 32px rgba(31,41,55,0.18), 0 1.5px 6px rgba(0,0,0,0.08)',
                transform: 'translateZ(0)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                WebkitPerspective: 1000,
                WebkitTransform: 'translateZ(0)'
              }}
            >
              <motion.div
                variants={sidebarContentVariants}
                initial="closed"
                animate="open"
                exit="closed"
                className="p-8 h-full flex flex-col relative z-10"
              >
                {/* 개선된 헤더 */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      className="p-2 rounded-xl shadow-lg"
                      style={{ backgroundColor: '#0113A3' }}
                      whileHover={{ scale: 1.05, rotate: 5 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FiUser className="w-5 h-5 text-white" />
                    </motion.div>
                    <div>
                      <h2 className="text-xl font-bold bg-gray-900 bg-clip-text text-transparent">
                        그룹 멤버
                      </h2>
                      <p className="text-sm text-gray-600">멤버를 선택해보세요</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 hover:bg-white/60 rounded-xl transition-all duration-200 backdrop-blur-sm"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>

                {/* 그룹 선택 드롭다운 */}
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0113A3' }}></div>
                    <h3 className="text-base font-semibold text-gray-800">그룹 목록</h3>
                  </div>

                  <GroupSelector
                    userGroups={userGroups}
                    selectedGroupId={selectedGroupId}
                    isGroupSelectorOpen={isGroupSelectorOpen}
                    isSidebarOpen={isSidebarOpen}
                    groupMemberCounts={groupMemberCounts}
                    onOpen={() => {
                      console.log('[GroupSelector] onOpen 호출됨');
                      setIsGroupSelectorOpen(true);
                    }}
                    onClose={() => {
                      console.log('[GroupSelector] onClose 호출됨');
                      setIsGroupSelectorOpen(false);
                    }}
                    onGroupSelect={(groupId) => {
                      console.log('[GroupSelector onGroupSelect] 그룹 선택 시도:', groupId, '현재 선택된 그룹:', selectedGroupId);
                      if (selectedGroupId !== groupId) {
                        console.log('[GroupSelector onGroupSelect] 다른 그룹 선택 - handleGroupSelect 호출');
                        handleGroupSelect(groupId);
                      } else {
                        console.log('[GroupSelector onGroupSelect] 같은 그룹 선택 - 드롭다운만 닫기');
                        setIsGroupSelectorOpen(false);
                      }
                    }}
                  />
                </div>



                {/* 멤버 목록 */}
                <div className="flex-1 min-h-0">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-2 h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"></div>
                    <h3 className="text-base font-semibold text-gray-800">멤버 목록</h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-emerald-200/50 to-transparent"></div>
                    <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-full backdrop-blur-sm">
                      {groupMembers.length}명
                    </span>
                  </div>
                  <div className="h-full overflow-y-auto hide-scrollbar space-y-3 pb-4">
                    {groupMembers.length > 0 ? (
                      <motion.div variants={sidebarContentVariants} className="space-y-2">
                        {groupMembers.map((member, index) => (
                          <motion.div
                            key={member.id}
                            variants={memberItemVariants}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              handleMemberSelect(member.id);
                              // 사이드바는 닫지 않고 유지하여 장소 리스트를 볼 수 있도록 함
                            }}
                            className={`p-4 rounded-xl cursor-pointer transition-all duration-300 backdrop-blur-sm ${member.isSelected
                              ? 'border-2 shadow-lg'
                              : 'bg-white/60 hover:bg-white/90 border hover:shadow-md'
                              }`}
                            style={member.isSelected
                              ? {
                                background: 'linear-gradient(to bottom right, rgba(240, 249, 255, 0.8), rgba(253, 244, 255, 0.8))',
                                borderColor: 'rgba(1, 19, 163, 0.3)',
                                boxShadow: '0 10px 25px rgba(1, 19, 163, 0.1)'
                              }
                              : {
                                borderColor: 'rgba(1, 19, 163, 0.1)'
                              }
                            }
                          >
                            <div className="flex items-center space-x-4">
                              <div className="relative">
                                <motion.div
                                  className={`w-12 h-12 rounded-full overflow-hidden ${member.isSelected
                                    ? 'ring-3 shadow-lg'
                                    : 'ring-2 ring-white/50'
                                    }`}
                                  style={member.isSelected
                                    ? {
                                      '--tw-ring-color': 'rgba(1, 19, 163, 0.3)',
                                      boxShadow: '0 10px 25px rgba(1, 19, 163, 0.2)'
                                    } as React.CSSProperties
                                    : {}
                                  }
                                  transition={{ type: "spring", stiffness: 300 }}
                                >
                                  <img
                                    src={member.mt_file1 || getDefaultImage(member.mt_gender, member.original_index)}
                                    alt={member.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      const defaultImg = getDefaultImage(member.mt_gender, member.original_index);
                                      target.src = defaultImg;
                                    }}
                                  />
                                </motion.div>

                                {/* 리더/오너 왕관 표시 */}
                                {member.sgdt_owner_chk === 'Y' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
                                    <FaCrown className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                                {member.sgdt_owner_chk !== 'Y' && member.sgdt_leader_chk === 'Y' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
                                    <FaCrown className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h4 className={`font-normal text-sm ${member.isSelected ? 'text-gray-900' : 'text-gray-900'} truncate`}>
                                    {member.name}
                                  </h4>
                                  {/* 총 장소 수 */}
                                  <div className="flex items-center space-x-1">
                                    <span className="text-xs text-gray-500">📍</span>
                                    <span className={`text-xs font-normal ${member.isSelected ? 'text-gray-700' : 'text-gray-700'
                                      }`}>
                                      {member.savedLocationCount ?? member.savedLocations?.length ?? 0}개
                                    </span>
                                  </div>
                                </div>

                                {/* 선택된 멤버의 장소 리스트 표시 */}
                                {member.isSelected && member.savedLocations && member.savedLocations.length > 0 && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="mt-3"
                                  >
                                    <div className="max-h-48 overflow-y-auto hide-scrollbar space-y-2 pr-1">
                                      {member.savedLocations.map((location, locationIndex) => (
                                        <motion.div
                                          key={location.id}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: locationIndex * 0.1 }}
                                          className="flex items-center space-x-2 p-2 bg-white/40 rounded-lg backdrop-blur-sm border border-white/30 hover:bg-white/60 transition-colors cursor-pointer"
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                          onClick={() => handleLocationSelect(location)}
                                        >
                                          <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex-shrink-0"></div>
                                          <span className="text-xs text-gray-600 truncate flex-1">
                                            {location.name}
                                          </span>
                                          {/* <span className="text-xs text-gray-400 flex-shrink-0">
                                            {location.category}
                                          </span> */}
                                          <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-2.5 h-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                    {member.savedLocations.length > 0 && (
                                      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-200/50 mt-2">
                                        총 {member.savedLocations.length}개의 장소
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <FiUser className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium text-sm">그룹 멤버가 없습니다</p>
                        <p className="text-xs text-gray-400 mt-1">그룹을 선택하거나 멤버를 초대해보세요</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}